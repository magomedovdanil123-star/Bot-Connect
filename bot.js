#!/usr/bin/env node
// Telegram-бот: кнопка «Создать видео» -> сценарий -> моушн-ролик MP4. Long polling, без внешних зависимостей.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadEnv } from './src/env.js';
import { makeVideo } from './src/make.js';
import { buildPlan } from './src/planner.js';

loadEnv();
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { console.error('Нет BOT_TOKEN в .env'); process.exit(1); }
const API = `https://api.telegram.org/bot${TOKEN}`;
const ALLOWED = (process.env.ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
const VOICE = process.env.LUMEAN_KEY && process.env.LUMEAN_TEMPLATE ? { key: process.env.LUMEAN_KEY, template: process.env.LUMEAN_TEMPLATE } : null;
const MAX_CHARS = Number(process.env.MAX_SCRIPT_CHARS || 8000);

async function tg(method, body) {
  const isForm = body instanceof FormData;
  const r = await fetch(`${API}/${method}`, { method: 'POST', body: isForm ? body : JSON.stringify(body || {}), headers: isForm ? undefined : { 'Content-Type': 'application/json' } });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.description}`);
  return j.result;
}
const send = (chat_id, text, extra = {}) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra });
const edit = (chat_id, message_id, text) => tg('editMessageText', { chat_id, message_id, text, parse_mode: 'HTML' }).catch(() => {});

const MENU = () => ({
  inline_keyboard: [
    [{ text: '🎬 Создать видео', callback_data: 'make' }],
    ...(VOICE ? [[{ text: '🎙 Видео с озвучкой', callback_data: 'make_voice' }]] : []),
    [{ text: 'ℹ️ Как писать сценарий', callback_data: 'help' }],
  ],
});
const HELP = `<b>Как писать сценарий</b>
• Пиши текст диктора как есть: каждое предложение станет отдельной сценой.
• Числа и годы → счётчики и таймлайны («84 миллиона», «в 2011 году»).
• «Если у X …, то у Y …» → сравнение. «с 6,25 до 3,125» → было/стало.
• Несколько вопросов подряд → анкета с вопросами.
• «Первая история — …» → заставка главы.
• Короткие фразы («Но подожди.») → крупный заголовок.
• Названия латиницей (Bitcoin, ETF) подсвечиваются автоматически.
• «подписывайся», «ссылка в шапке профиля», «не финансовая рекомендация» → готовые концовки.

Можно прислать текстом или .txt файлом. Лимит — ${MAX_CHARS} символов.`;

const state = new Map();   // chatId -> { mode: 'plain'|'voice' } ожидание сценария
const queue = [];          // задачи рендера, выполняются по одной
let busy = false;

function allowed(u) { return !ALLOWED.length || ALLOWED.includes(String(u.id)) || (u.username && ALLOWED.includes('@' + u.username)); }

async function enqueue(chat, script, mode) {
  if (script.length > MAX_CHARS) return send(chat, `Сценарий слишком длинный: ${script.length} символов (лимит ${MAX_CHARS}).`);
  const plan = buildPlan(script);
  const estSec = plan.scenes.reduce((a, s) => a + Math.max(2.4, s.text.length / 14.5 + .8), 0);
  const msg = await send(chat, `✅ Принял сценарий: <b>${plan.scenes.length}</b> сцен, ролик ≈ ${Math.round(estSec)} с.\n${queue.length || busy ? `⏳ В очереди: ${queue.length + 1}` : '⚙️ Начинаю…'}`);
  queue.push({ chat, script, mode, msgId: msg.message_id });
  pump();
}

async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const job = queue.shift();
  const out = path.join(os.tmpdir(), `motion_${job.chat}_${Date.now()}.mp4`);
  let last = 0;
  const status = text => edit(job.chat, job.msgId, text);
  try {
    const t0 = Date.now();
    const r = await makeVideo(job.script, {
      out, voice: job.mode === 'voice' ? VOICE : null,
      onStage: (st, a, b) => { if (st === 'voice') status(`🎙 Озвучка через Lumean… ${a || ''} ${b != null ? b + '%' : ''}`); if (st === 'render') status(`🎬 Рендер ${a} сцен… 0%`); },
      onProgress: p => { const now = Date.now(); if (now - last > 4000 || p >= 1) { last = now; status(`🎬 Рендер… ${Math.round(p * 100)}%`); } },
    });
    await status(`📤 Отправляю видео (${r.sizeMB.toFixed(1)} МБ)…`);
    const fd = new FormData();
    fd.append('chat_id', String(job.chat));
    fd.append('supports_streaming', 'true');
    fd.append('caption', `Готово: ${r.scenes.length} сцен, ${Math.round(r.duration)} с, рендер ${Math.round((Date.now() - t0) / 1000)} с`);
    fd.append('video', await fs.openAsBlob(out, { type: 'video/mp4' }), 'motion.mp4');
    await tg('sendVideo', fd);
    await status('✅ Готово!');
    await send(job.chat, 'Ещё ролик?', { reply_markup: MENU() });
  } catch (e) {
    console.error(e);
    await status('❌ Ошибка: ' + String(e.message).slice(0, 300));
  } finally {
    fs.rmSync(out, { force: true });
    busy = false; pump();
  }
}

async function onUpdate(u) {
  if (u.callback_query) {
    const q = u.callback_query, chat = q.message.chat.id;
    tg('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
    if (!allowed(q.from)) return send(chat, '⛔ Нет доступа.');
    if (q.data === 'help') return send(chat, HELP, { reply_markup: MENU() });
    if (q.data === 'make' || q.data === 'make_voice') {
      state.set(chat, { mode: q.data === 'make_voice' ? 'voice' : 'plain' });
      return send(chat, `📝 Пришли сценарий${q.data === 'make_voice' ? ' — озвучу его через Lumean' : ''}: текстом или .txt файлом.`);
    }
    if (q.data.startsWith('go:')) {
      const st = state.get(chat); if (!st?.pending) return;
      const script = st.pending; state.delete(chat);
      return enqueue(chat, script, q.data === 'go:voice' ? 'voice' : 'plain');
    }
    return;
  }
  const m = u.message; if (!m) return;
  const chat = m.chat.id;
  if (!allowed(m.from)) return send(chat, `⛔ Нет доступа. Твой id: <code>${m.from.id}</code>`);
  if (m.text && /^\/(start|menu)/.test(m.text)) return send(chat, '👋 Я делаю моушн-видео по сценарию: тёмная сетка, неон, кинетическая типографика, схемы и графики.\nЖми кнопку и присылай текст.', { reply_markup: MENU() });
  if (m.text && /^\/help/.test(m.text)) return send(chat, HELP, { reply_markup: MENU() });
  let script = m.text;
  if (m.document && /\.txt$/i.test(m.document.file_name || '')) {
    const f = await tg('getFile', { file_id: m.document.file_id });
    script = await (await fetch(`https://api.telegram.org/file/bot${TOKEN}/${f.file_path}`)).text();
  }
  if (!script) return;
  const st = state.get(chat);
  if (st?.mode) { state.delete(chat); return enqueue(chat, script.trim(), st.mode); }
  if (script.length < 40) return send(chat, 'Нажми кнопку, чтобы создать видео 👇', { reply_markup: MENU() });
  state.set(chat, { pending: script.trim() });
  return send(chat, 'Сделать видео по этому тексту?', { reply_markup: { inline_keyboard: [[{ text: '🎬 Без озвучки', callback_data: 'go:plain' }], ...(VOICE ? [[{ text: '🎙 С озвучкой', callback_data: 'go:voice' }]] : [])] } });
}

async function main() {
  const me = await tg('getMe');
  console.log(`Бот @${me.username} запущен. Озвучка: ${VOICE ? 'вкл' : 'выкл'}. Доступ: ${ALLOWED.length ? ALLOWED.join(', ') : 'все'}`);
  await tg('setMyCommands', { commands: [{ command: 'start', description: 'Меню' }, { command: 'help', description: 'Как писать сценарий' }] }).catch(() => {});
  let offset = 0;
  for (;;) {
    try {
      const ups = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query'] });
      for (const u of ups) { offset = u.update_id + 1; onUpdate(u).catch(e => console.error('update', e)); }
    } catch (e) { console.error('poll', e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
}
main();
