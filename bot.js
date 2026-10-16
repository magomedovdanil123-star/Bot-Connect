#!/usr/bin/env node
// Telegram-бот «Моушн-студия»: сценарий любой длины -> моушн-ролик 16:9 с режиссурой, переходами и звуковым дизайном.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadEnv } from './src/env.js';
import { makeVideo, loadProject, describeStyle } from './src/make.js';
import { buildPlan } from './src/planner.js';

loadEnv();
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { console.error('Нет BOT_TOKEN в .env'); process.exit(1); }
const API = `https://api.telegram.org/bot${TOKEN}`;
const ALLOWED = (process.env.ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
const VOICE = process.env.LUMEAN_KEY && process.env.LUMEAN_TEMPLATE ? { key: process.env.LUMEAN_KEY, template: process.env.LUMEAN_TEMPLATE } : null;
const MAX_CHARS = Math.max(120000, Number(process.env.MAX_SCRIPT_CHARS || 0)); // старые .env с 8000 не ограничивают

async function tg(method, body) {
  const isForm = body instanceof FormData;
  const r = await fetch(`${API}/${method}`, { method: 'POST', body: isForm ? body : JSON.stringify(body || {}), headers: isForm ? undefined : { 'Content-Type': 'application/json' } });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description}`);
  return j.result;
}
const send = (chat_id, text, extra = {}) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', disable_web_page_preview: true, ...extra });
const edit = (chat_id, message_id, text, extra = {}) => tg('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML', ...extra }).catch(() => {});
const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const bar = (p, n = 14) => '▰'.repeat(Math.round(p * n)) + '▱'.repeat(n - Math.round(p * n));
const fmtTime = s => s >= 60 ? `${Math.floor(s / 60)} мин ${Math.round(s % 60)} с` : `${Math.round(s)} с`;

const MENU = () => ({ inline_keyboard: [
  [{ text: '🎬 Создать ролик', callback_data: 'make' }, ...(VOICE ? [{ text: '🎙 С озвучкой', callback_data: 'make_voice' }] : [])],
  [{ text: '📖 Как писать сценарий', callback_data: 'help' }],
] });
const COLLECT_KB = s => ({ inline_keyboard: [[{ text: '✅ Собрать ролик', callback_data: 'collect:done' }],
  ...(VOICE ? [[{ text: s.mode === 'voice' ? '🎙 Озвучка: включена' : '🔇 Озвучка: выключена', callback_data: 'collect:voice' }]] : []),
  [{ text: '🗑 Отменить', callback_data: 'collect:cancel' }]] });
const AFTER_KB = id => ({ inline_keyboard: [
  [{ text: '🎲 Новый визуальный стиль', callback_data: `again:new:${id}` }],
  [{ text: '🔁 Пересобрать 1:1', callback_data: `again:same:${id}` }, { text: '🎬 Новый сценарий', callback_data: 'menu' }],
] });

const HELP = `<b>📖 Как писать сценарий</b>

Пишите текст диктора как есть. Каждое предложение — отдельная сцена со своей анимацией и звуком.

<b>Что превращается в анимацию</b>
• Год («в 2011 году») → таймлайн
• Число («5 миллионов») → счётчик с тиканьем
• «с 8 до 200» → было / стало с ударом
• «у X …, то у Y …» → сравнение полосами
• Вопросы подряд → анкета
• «Первая причина — …» → заставка главы
• Рост / падение → график или свечи
• Короткая фраза («Но подожди.») → крупный заголовок
• Названия латиницей (Bitcoin, ETF) и числа подсвечиваются

<b>Длина без ограничений</b>
Длинный текст присылайте несколькими сообщениями подряд или <code>.txt</code> файлом, затем нажмите «✅ Собрать ролик». Длинные ролики приходят частями по ~50 МБ.

<b>Уникальность</b>
Каждый ролик получает свой визуальный почерк: акцент, переходы, камера, типографика, частицы, финал. Бот помнит прошлые ролики и не повторяет их решения.`;

// ---------- состояние ----------
const sessions = new Map();   // chatId -> { mode:'plain'|'voice', parts:[], msgId }
const queue = []; let busy = false;
const allowed = u => !ALLOWED.length || ALLOWED.includes(String(u.id)) || (u.username && ALLOWED.includes('@' + u.username));

async function showCollect(chat, s) {
  const text = s.parts.join('\n\n'), sc = text ? buildPlan(text).scenes.length : 0;
  const body = `<b>📥 Сценарий${s.mode === 'voice' ? ' · 🎙 с озвучкой' : ''}</b>\n\nЧастей: <b>${s.parts.length}</b> · символов: <b>${text.length.toLocaleString('ru')}</b> · сцен: <b>${sc}</b>\n\nПрисылайте продолжение следующими сообщениями или <code>.txt</code> файлом.\nКогда всё отправлено — жмите «✅ Собрать ролик».`;
  if (s.msgId) { await tg('deleteMessage', { chat_id: chat, message_id: s.msgId }).catch(() => {}); }
  const m = await send(chat, body, { reply_markup: COLLECT_KB(s) }); s.msgId = m.message_id;
}

async function enqueue(chat, job) {
  const pos = queue.length + (busy ? 1 : 0);
  const m = await send(chat, `<b>🎬 Ролик принят в работу</b>\n${pos ? `⏳ Перед вами в очереди: ${pos}` : '⚙️ Начинаю…'}`);
  queue.push({ chat, msgId: m.message_id, ...job }); pump();
}

async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const job = queue.shift(), outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-out-')), out = path.join(outDir, 'motion.mp4');
  const t0 = Date.now(); let last = 0, header = '<b>🎬 Собираю ролик</b>';
  const status = (lines, force) => { const now = Date.now(); if (!force && now - last < 3500) return; last = now; edit(job.chat, job.msgId, `${header}\n\n${lines}\n\n⏱ ${fmtTime((now - t0) / 1000)}`); };
  try {
    const r = await makeVideo(job.script, {
      out, voice: job.voice ? VOICE : null, projectId: job.projectId || null, seed: job.seed ?? null,
      onStage: (st, info = {}) => {
        if (st === 'voice') status(`🎙 Озвучка Lumean${info.parts > 1 ? ` · часть ${info.part}/${info.parts}` : ''}\n${bar((info.percent || 0) / 100)} ${info.percent || 0}%`, true);
        if (st === 'render') { header = `<b>🎬 Собираю ролик</b>\n<i>${esc(describeStyle(info.style))}</i>`; status(`🎞 Сцен: ${info.scenes}\n${bar(0)} 0%`, true); }
      },
      onProgress: p => status(`🎞 Рендер кадров\n${bar(p)} ${Math.round(p * 100)}%`, p >= 1),
    });
    await status('📤 Отправляю…', true);
    const total = r.files.length;
    for (const [i, f] of r.files.entries()) {
      const fd = new FormData();
      fd.append('chat_id', String(job.chat)); fd.append('supports_streaming', 'true'); fd.append('width', '1920'); fd.append('height', '1080'); fd.append('parse_mode', 'HTML');
      const head = total > 1 ? `<b>Часть ${i + 1}/${total}</b>\n` : '';
      const last = i === total - 1;
      fd.append('caption', last
        ? `${head}<b>🎬 Моушн-ролик готов</b>\n${r.scenes.length} сцен · ${fmtTime(r.duration)}${r.voiced ? ' · 🎙 озвучка' : ''} · 🔊 ${r.sfx.count} звуков\n<i>${esc(describeStyle(r.style))}</i>\nПроект <code>${r.id}</code> · seed <code>${r.seed}</code> · сборка ${fmtTime((Date.now() - t0) / 1000)}`
        : head);
      if (last) fd.append('reply_markup', JSON.stringify(AFTER_KB(r.id)));
      fd.append('video', await fs.openAsBlob(f, { type: 'video/mp4' }), total > 1 ? `motion_part${i + 1}.mp4` : 'motion.mp4');
      await tg('sendVideo', fd);
    }
    await tg('deleteMessage', { chat_id: job.chat, message_id: job.msgId }).catch(() => edit(job.chat, job.msgId, '✅ Готово'));
  } catch (e) {
    console.error(e);
    await edit(job.chat, job.msgId, `<b>❌ Не удалось собрать ролик</b>\n\n<code>${esc(String(e.message).slice(0, 500))}</code>`, { reply_markup: MENU() });
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    busy = false; pump();
  }
}

async function readDocument(doc) {
  const f = await tg('getFile', { file_id: doc.file_id });
  return (await (await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.file_path}`)).text()).trim();
}

async function onUpdate(u) {
  if (u.callback_query) {
    const q = u.callback_query, chat = q.message.chat.id, data = q.data || '';
    tg('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
    if (!allowed(q.from)) return send(chat, '⛔ Нет доступа.');
    if (data === 'help') return send(chat, HELP, { reply_markup: MENU() });
    if (data === 'menu') return send(chat, '<b>🎬 Моушн-студия</b>\n\nВыберите режим и пришлите сценарий.', { reply_markup: MENU() });
    if (data === 'make' || data === 'make_voice') {
      const s = { mode: data === 'make_voice' ? 'voice' : 'plain', parts: [] }; sessions.set(chat, s);
      const m = await send(chat, `<b>✍️ Пришлите сценарий${s.mode === 'voice' ? ' · 🎙 с озвучкой' : ''}</b>\n\nТекстом или <code>.txt</code> файлом. Длинный сценарий можно отправить несколькими сообщениями подряд — я соберу их вместе.`, { reply_markup: { inline_keyboard: [[{ text: '🗑 Отменить', callback_data: 'collect:cancel' }]] } });
      s.msgId = m.message_id; return;
    }
    if (data === 'collect:voice') { const s = sessions.get(chat); if (!s) return; s.mode = s.mode === 'voice' ? 'plain' : 'voice'; s.msgId = null; await tg('deleteMessage', { chat_id: chat, message_id: q.message.message_id }).catch(() => {}); return showCollect(chat, s); }
    if (data === 'collect:cancel') { sessions.delete(chat); return edit(chat, q.message.message_id, 'Отменено.', { reply_markup: MENU() }); }
    if (data === 'collect:done') {
      const s = sessions.get(chat); if (!s?.parts.length) return send(chat, 'Сценарий пустой — пришлите текст.');
      sessions.delete(chat); await tg('deleteMessage', { chat_id: chat, message_id: q.message.message_id }).catch(() => {});
      const script = s.parts.join('\n\n');
      if (script.length > MAX_CHARS) return send(chat, `Сценарий слишком длинный: ${script.length} символов (лимит ${MAX_CHARS}).`);
      return enqueue(chat, { script, voice: s.mode === 'voice' });
    }
    const again = /^again:(new|same):([a-f0-9]+)$/.exec(data);
    if (again) {
      const p = loadProject(again[2]); if (!p) return send(chat, 'Проект не найден (возможно, сервер переустанавливали).');
      return enqueue(chat, { script: p.script, projectId: p.id, seed: again[1] === 'same' ? p.seed : null, voice: p.voiced });
    }
    return;
  }
  const m = u.message; if (!m) return;
  const chat = m.chat.id;
  if (!allowed(m.from)) return send(chat, `⛔ Нет доступа. Ваш id: <code>${m.from.id}</code>`);
  if (m.text && /^\/(start|menu)/.test(m.text)) return send(chat, '<b>🎬 Моушн-студия</b>\n\nПревращаю сценарий в моушн-ролик 16:9: кинетическая типографика, переходы, графики, частицы и звуковой дизайн. Каждый ролик — со своим визуальным почерком.', { reply_markup: MENU() });
  if (m.text && /^\/help/.test(m.text)) return send(chat, HELP, { reply_markup: MENU() });
  if (m.text && /^\/cancel/.test(m.text)) { sessions.delete(chat); return send(chat, 'Отменено.', { reply_markup: MENU() }); }
  let text = m.text || m.caption || '';
  if (m.document && /\.txt$/i.test(m.document.file_name || '')) text = await readDocument(m.document);
  if (!text.trim()) return;
  let s = sessions.get(chat);
  if (!s) { // текст без нажатия кнопки — начинаем сбор сценария и спрашиваем режим в конце
    if (text.length < 40) return send(chat, 'Нажмите кнопку, чтобы создать ролик 👇', { reply_markup: MENU() });
    s = { mode: 'plain', parts: [] }; sessions.set(chat, s);
  }
  s.parts.push(text.trim());
  // Telegram режет длинный текст на несколько сообщений — ждём, пока придут все части, и показываем сводку один раз
  clearTimeout(s.timer); s.timer = setTimeout(() => showCollect(chat, s).catch(e => console.error(e)), 1200);
}

async function main() {
  const me = await tg('getMe');
  console.log(`Бот @${me.username} запущен. Озвучка: ${VOICE ? 'вкл' : 'выкл'}. Доступ: ${ALLOWED.length ? ALLOWED.join(', ') : 'все'}`);
  await tg('setMyCommands', { commands: [{ command: 'start', description: 'Меню' }, { command: 'help', description: 'Как писать сценарий' }, { command: 'cancel', description: 'Отменить' }] }).catch(() => {});
  let offset = 0;
  for (;;) {
    try {
      const ups = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
      for (const u of ups) { offset = u.update_id + 1; onUpdate(u).catch(e => console.error('update', e)); }
    } catch (e) { console.error('poll', e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
}
main();
