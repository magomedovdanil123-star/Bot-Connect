#!/usr/bin/env node
// Telegram-бот «Моушн-студия»: сценарий любой длины -> моушн-ролик 16:9 с режиссурой, переходами и звуковым дизайном.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { loadEnv } from './src/env.js';
import { makeVideo, loadProject, describeStyle } from './src/make.js';
import { buildPlan } from './src/planner.js';
import { listChannels, missingSecrets, saveSecretsFromText, secret, setThumbnail, uploadVideo } from './src/youtube.js';
import { createCloneProfile, prepareReference, voiceSample, voiceStudioAlive, voiceStudioVoices } from './src/voicestudio.js';
import { generateScript, scriptGenReady } from './src/scriptgen.js';

loadEnv();
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { console.error('Нет BOT_TOKEN в .env'); process.exit(1); }
const API = `https://api.telegram.org/bot${TOKEN}`;
const ALLOWED = (process.env.ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
// озвучка: VoiceStudio (свой клон голоса на компьютере) или Lumean; VOICE_PROVIDER=lumean — принудительно Lumean
const LUMEAN = process.env.LUMEAN_KEY && process.env.LUMEAN_TEMPLATE ? { key: process.env.LUMEAN_KEY, template: process.env.LUMEAN_TEMPLATE } : null;
const VSTUDIO = () => secret('VOICESTUDIO_URL') ? { provider: 'voicestudio', url: secret('VOICESTUDIO_URL'), token: secret('VOICESTUDIO_TOKEN'), voice: secret('VOICESTUDIO_VOICE') || 'default', model: secret('VOICESTUDIO_MODEL') || 'omnivoice', speed: Number(secret('VOICESTUDIO_SPEED')) || 1 } : null;
const voiceCfg = () => process.env.VOICE_PROVIDER === 'lumean' ? (LUMEAN || VSTUDIO()) : (VSTUDIO() || LUMEAN);
const hasVoice = () => Boolean(voiceCfg());
async function showVoices(chat, note = '') {
  const vs = VSTUDIO(); if (!vs) return send(chat, 'VoiceStudio не подключён — отправьте /voicestudio.');
  if (!(await voiceStudioAlive(vs))) return send(chat, `${note}⚠️ <b>VoiceStudio не отвечает</b> по адресу <code>${esc(vs.url)}</code>\nПроверьте, что программа запущена на компьютере и сетевой доступ (Tailscale) включён.`);
  let list = []; try { list = await voiceStudioVoices(vs); } catch (e) { return send(chat, `${note}⚠️ ${esc(e.message)}`); }
  const rows = list.slice(0, 30).map(v => [{ text: `${v.id === vs.voice ? '✅' : '🎙'} ${v.name || v.id}`.slice(0, 60), callback_data: `vs:v:${String(v.id).slice(0, 56)}` }]);
  return send(chat, `${note}✅ <b>VoiceStudio подключён</b>\nВыберите голос для озвучки — ваш клон из программы:`, { reply_markup: { inline_keyboard: rows.length ? rows : [[{ text: 'Голосов нет — создайте клон в VoiceStudio', callback_data: 'menu' }]] } });
}

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
  [{ text: '🎬 Создать ролик', callback_data: 'make' }, ...(hasVoice() ? [{ text: '🎙 С озвучкой', callback_data: 'make_voice' }] : [])],
  [{ text: '✨ Сценарий по теме', callback_data: 'gen' }],
  [{ text: '📖 Как писать сценарий', callback_data: 'help' }],
] });
const FACTORY_REQUIRED = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_DB_PASSWORD', 'OPENROUTER_API_KEY', 'LUMEAN_API_KEY|VOICE_API_KEY'];
const gens = new Map();   // chatId -> { topic, script, variant } — последний сгенерированный сценарий
const GEN_KB = () => ({ inline_keyboard: [
  ...(hasVoice() ? [[{ text: '🎙 Собрать с озвучкой', callback_data: 'gen:make:voice' }]] : []),
  [{ text: '🎬 Собрать без озвучки', callback_data: 'gen:make:plain' }, { text: '🔄 Другой вариант', callback_data: 'gen:again' }],
] });
async function runGen(chat, g) {
  const m = await send(chat, `✍️ <b>Пишу сценарий</b>${g.variant ? ` · вариант ${g.variant + 1}` : ''}
<i>${esc(g.topic)}</i>

Обычно это 20–60 секунд…`);
  try {
    g.script = await generateScript(g.topic, { variant: g.variant }); gens.set(chat, g);
    await edit(chat, m.message_id, `<b>✨ Сценарий готов</b> · ${g.script.split('\n').length} сцен\n\n${esc(g.script)}\n\n<i>Хотите поправить — скопируйте, измените и пришлите текст боту.</i>`, { reply_markup: GEN_KB() });
  } catch (e) { await edit(chat, m.message_id, `<b>❌ Не получилось написать сценарий</b>\n<code>${esc(String(e.message).slice(0, 400))}</code>`, { reply_markup: MENU() }); }
}
const COLLECT_KB = s => ({ inline_keyboard: [[{ text: '✅ Собрать ролик', callback_data: 'collect:done' }],
  ...(hasVoice() ? [[{ text: s.mode === 'voice' ? '🎙 Озвучка: включена' : '🔇 Озвучка: выключена', callback_data: 'collect:voice' }]] : []),
  [{ text: '🗑 Отменить', callback_data: 'collect:cancel' }]] });
const AFTER_KB = id => ({ inline_keyboard: [
  [{ text: '📱 Shorts 9:16', callback_data: `again:short:${id}` }, { text: '🎲 Новый стиль', callback_data: `again:new:${id}` }],
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
Ограничений по длине нет. Длинный текст присылайте несколькими сообщениями подряд или <code>.txt</code> файлом, затем нажмите «✅ Собрать ролик». Длинные ролики приходят частями по ~50 МБ.

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
    let jobVoice = job.voice ? voiceCfg() : null;
    if (jobVoice?.provider === 'voicestudio' && !(await voiceStudioAlive(jobVoice))) {
      if (LUMEAN) { jobVoice = LUMEAN; await send(job.chat, '⚠️ VoiceStudio на компьютере не отвечает — озвучиваю через Lumean.'); }
      else throw new Error('VoiceStudio не отвечает: запустите программу на компьютере и включите сетевой доступ (Tailscale).');
    }
    const r = await makeVideo(job.script, {
      out, voice: job.voice ? jobVoice : null, projectId: job.projectId || null, seed: job.seed ?? null, vertical: !!job.vertical,
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
      fd.append('chat_id', String(job.chat)); fd.append('supports_streaming', 'true'); fd.append('width', r.vertical ? '1080' : '1920'); fd.append('height', r.vertical ? '1920' : '1080'); fd.append('parse_mode', 'HTML');
      const head = total > 1 ? `<b>Часть ${i + 1}/${total}</b>\n` : '';
      const last = i === total - 1;
      fd.append('caption', last
        ? `${head}<b>${r.vertical ? '📱 Shorts готов' : '🎬 Моушн-ролик готов'}</b>\n${r.scenes.length} сцен · ${fmtTime(r.duration)}${r.voiced ? ' · 🎙 озвучка' : ''} · 🔊 ${r.sfx.count} звуков\n<i>${esc(describeStyle(r.style))}</i>\nПроект <code>${r.id}</code> · seed <code>${r.seed}</code> · сборка ${fmtTime((Date.now() - t0) / 1000)}`
        : head);
      if (last) fd.append('reply_markup', JSON.stringify(AFTER_KB(r.id)));
      fd.append('video', await fs.openAsBlob(f, { type: 'video/mp4' }), total > 1 ? `motion_part${i + 1}.mp4` : 'motion.mp4');
      await tg('sendVideo', fd);
    }
    await tg('deleteMessage', { chat_id: job.chat, message_id: job.msgId }).catch(() => edit(job.chat, job.msgId, '✅ Готово'));
    // полный файл (без нарезки) сохраняем для загрузки на YouTube; Shorts — отдельной карточкой публикации (<id>s)
    const pid = r.vertical ? r.id + 's' : r.id, pdir = path.join(DATA_DIR, 'projects', pid); fs.mkdirSync(pdir, { recursive: true });
    fs.copyFileSync(r.file, path.join(pdir, 'video.mp4'));
    // обложки: три варианта одним альбомом
    if (r.thumbs?.length) {
      const fd = new FormData(); fd.append('chat_id', String(job.chat));
      fd.append('media', JSON.stringify(r.thumbs.map((f, i) => ({ type: 'photo', media: `attach://t${i}`, ...(i === 0 ? { caption: '🖼 <b>Обложки</b> — выберите в карточке публикации, бот поставит её на YouTube', parse_mode: 'HTML' } : {}) }))));
      for (const [i, f] of r.thumbs.entries()) fd.append(`t${i}`, await fs.openAsBlob(f, { type: 'image/jpeg' }), `thumb_${i + 1}.jpg`);
      await tg('sendMediaGroup', fd).catch(e => console.error('thumbs', e.message));
    }
    const pub = loadPub(pid) || {}; savePub(pid, { ...r.seo, privacy: DEFAULT_PRIVACY, selected: lastSelected(), thumb: r.thumbs?.length ? 1 : 0, ...pub, ...(pub.title ? {} : r.seo) });
    await showPublish(job.chat, pid);
  } catch (e) {
    console.error(e);
    await edit(job.chat, job.msgId, `<b>❌ Не удалось собрать ролик</b>\n\n<code>${esc(String(e.message).slice(0, 500))}</code>`, { reply_markup: MENU() });
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    cleanupVideos();
    busy = false; pump();
  }
}

// ---------- публикация на YouTube ----------
const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(new URL(import.meta.url).pathname), 'data');
const DEFAULT_PRIVACY = process.env.YOUTUBE_DEFAULT_PRIVACY_STATUS || 'public';
const PRIVACY = { public: '🌍 Открытый', unlisted: '🔗 По ссылке', private: '🔒 Приватный' };
const pubFile = id => path.join(DATA_DIR, 'projects', id, 'publish.json');
const loadPub = id => { try { return JSON.parse(fs.readFileSync(pubFile(id), 'utf8')); } catch { return null; } };
const savePub = (id, p) => fs.writeFileSync(pubFile(id), JSON.stringify(p, null, 1));
const prefsFile = path.join(DATA_DIR, 'youtube_prefs.json');
const lastSelected = () => { try { return JSON.parse(fs.readFileSync(prefsFile, 'utf8')).selected || []; } catch { return []; } };
function cleanupVideos() { // видео для публикации храним 3 дня
  try { for (const id of fs.readdirSync(path.join(DATA_DIR, 'projects'))) { const f = path.join(DATA_DIR, 'projects', id, 'video.mp4'); if (fs.existsSync(f) && Date.now() - fs.statSync(f).mtimeMs > 3 * 864e5) fs.rmSync(f); } } catch { /* нет папки */ }
}
const pubCards = new Map(); // projectId -> message_id карточки публикации

async function showPublish(chat, id, notice = '') {
  const p = loadPub(id); if (!p) return send(chat, 'Проект не найден.');
  let channels = [], err = null;
  const miss = missingSecrets();
  if (!miss.length) { try { channels = await listChannels(); } catch (e) { err = e.message; } }
  const sel = new Set(p.selected || []);
  const rows = [];
  if (channels.length) {
    rows.push([{ text: '☑️ Все каналы', callback_data: `yt:all:${id}` }, { text: '◻️ Снять все', callback_data: `yt:none:${id}` }]);
    for (const c of channels) rows.push([{ text: `${sel.has(c.id) ? '✅' : '⬜'} ${c.title}`, callback_data: `yt:t:${id}:${c.id}` }]);
  } else rows.push([{ text: '🔑 Подключить каналы из Bot-Connect', callback_data: 'yt:setup' }]);
  rows.push([{ text: '✏️ Название', callback_data: `yt:e:title:${id}` }, { text: '✏️ Описание', callback_data: `yt:e:desc:${id}` }, { text: '🏷 Теги', callback_data: `yt:e:tags:${id}` }]);
  const nThumbs = [1, 2, 3].filter(i => fs.existsSync(path.join(DATA_DIR, 'projects', id, `thumb_${i}.jpg`))).length;
  rows.push([{ text: `Доступ: ${PRIVACY[p.privacy] || p.privacy}`, callback_data: `yt:p:${id}` }, ...(nThumbs ? [{ text: `🖼 Обложка: ${p.thumb ? `№${p.thumb}` : 'авто YouTube'}`, callback_data: `yt:th:${id}` }] : [])]);
  const n = channels.filter(c => sel.has(c.id)).length;
  if (channels.length) rows.push([{ text: n ? `🚀 Опубликовать на ${n} ${n === 1 ? 'канал' : n < 5 ? 'канала' : 'каналов'}` : '🚀 Выберите каналы', callback_data: `yt:go:${id}` }]);
  rows.push([{ text: '✖️ Не публиковать', callback_data: `yt:x:${id}` }]);
  const desc = p.description.length > 900 ? p.description.slice(0, 900) + '…' : p.description;
  const text = `<b>📺 Публикация на YouTube</b>${notice ? `\n${notice}` : ''}\n\n<b>Название</b> (${p.title.length}/100):\n${esc(p.title)}\n\n<b>Описание</b>:\n${esc(desc)}\n\n<b>Теги</b> (${p.tags.length}): ${esc(p.tags.join(', '))}\n\n` +
    (channels.length ? `Выберите каналы — отмечено: <b>${n}</b> из ${channels.length}.` : miss.length ? `⚠️ Каналы не подключены: нужны ключи из Replit (${miss.join(', ')}).` : `⚠️ Не удалось получить каналы: <code>${esc(String(err).slice(0, 300))}</code>`);
  const old = pubCards.get(id);
  if (old) { const ok = await tg('editMessageText', { chat_id: chat, message_id: old, text, parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } }).then(() => true).catch(e => /not modified/.test(e.message)); if (ok) return; }
  const m = await send(chat, text, { reply_markup: { inline_keyboard: rows } }); pubCards.set(id, m.message_id);
}

let uploadChain = Promise.resolve();
async function publish(chat, id) {
  const p = loadPub(id), file = path.join(DATA_DIR, 'projects', id, 'video.mp4');
  if (!p?.selected?.length) return showPublish(chat, id, '⚠️ Сначала отметьте хотя бы один канал.');
  if (!fs.existsSync(file)) return send(chat, 'Видео для публикации уже удалено (храним 3 дня). Пересоберите ролик кнопкой «🔁 Пересобрать 1:1».');
  const channels = (await listChannels()).filter(c => p.selected.includes(c.id));
  fs.writeFileSync(prefsFile, JSON.stringify({ selected: p.selected }));
  const m = await send(chat, `<b>🚀 Публикую на YouTube</b>\n${channels.map(c => `⏳ ${esc(c.title)}`).join('\n')}`);
  uploadChain = uploadChain.then(async () => {
    const lines = channels.map(c => `⏳ ${esc(c.title)}`);
    for (const [i, c] of channels.entries()) {
      lines[i] = `📤 ${esc(c.title)} — загружаю…`; await edit(chat, m.message_id, `<b>🚀 Публикую на YouTube</b>\n${lines.join('\n')}`);
      try {
        const r = await uploadVideo(c.id, file, p); lines[i] = `✅ ${esc(c.title)} — ${r.url} (${PRIVACY[r.privacy] || r.privacy})`;
        const tf = p.thumb && path.join(DATA_DIR, 'projects', id, `thumb_${p.thumb}.jpg`);
        if (tf && fs.existsSync(tf)) await setThumbnail(c.id, r.id, tf).then(() => { lines[i] += ' · 🖼 обложка'; }).catch(e => { lines[i] += ` · ⚠️ обложка не встала: ${esc(String(e.message).slice(0, 120))}`; });
      }
      catch (e) { lines[i] = `❌ ${esc(c.title)} — ${esc(String(e.message).slice(0, 200))}`; }
      await edit(chat, m.message_id, `<b>🚀 Публикация на YouTube</b>\n${lines.join('\n')}`);
    }
    await edit(chat, m.message_id, `<b>📺 Публикация завершена</b>\n${lines.join('\n')}`, { disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: '🎬 Новый ролик', callback_data: 'menu' }]] } });
  }).catch(e => console.error('upload', e));
}

// образец голоса из Telegram -> лучший фрагмент -> профиль-клон в VoiceStudio -> выбран для озвучки -> пробная фраза
async function cloneFromTelegram(chat, f) {
  const vs = VSTUDIO(); if (!(await voiceStudioAlive(vs))) throw new Error('VoiceStudio не отвечает — запустите программу и включите Tailscale.');
  const m = await send(chat, '🎙 Готовлю образец…');
  const dir = path.join(DATA_DIR, 'voice'); fs.mkdirSync(dir, { recursive: true });
  const info = await tg('getFile', { file_id: f.file_id }), ext = (path.extname(info.file_path) || '.mp3').toLowerCase();
  const orig = path.join(dir, 'reference_original' + ext), ref = path.join(dir, 'reference.wav');
  fs.writeFileSync(orig, Buffer.from(await (await fetch(`https://api.telegram.org/file/bot${TOKEN}/${info.file_path}`)).arrayBuffer()));
  const cut = await prepareReference(orig, ref);
  await edit(chat, m.message_id, `🎙 Фрагмент ${cut.seconds} с (${cut.begin.toFixed(1)}–${cut.end.toFixed(1)} с). Создаю клон в VoiceStudio…`);
  const id = await createCloneProfile(vs, ref, 'Голос канала');
  saveSecretsFromText(`VOICESTUDIO_VOICE=${id}`);
  await edit(chat, m.message_id, `✅ <b>Клон создан и выбран</b> · профиль <code>${esc(id)}</code>\nОзвучиваю пробную фразу…`);
  const wav = await voiceSample({ ...VSTUDIO(), voice: id }, 'Привет! Это Хомяк. Сегодня разберёмся, как перестать терять деньги.');
  const ogg = path.join(dir, 'sample.ogg'), wavF = path.join(dir, 'sample.wav'); fs.writeFileSync(wavF, wav);
  await new Promise((res, rej) => { const p = spawn('ffmpeg', ['-y', '-v', 'error', '-i', wavF, '-c:a', 'libopus', '-b:a', '64k', ogg]); p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()); });
  const fd = new FormData(); fd.append('chat_id', String(chat)); fd.append('caption', '🎧 Так звучит голос канала. Не похоже? Пришлите другой образец через /clone.');
  fd.append('voice', await fs.openAsBlob(ogg, { type: 'audio/ogg' }), 'sample.ogg'); await tg('sendVoice', fd);
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
    const vsv = /^vs:v:(.+)$/.exec(data);
    if (vsv) { saveSecretsFromText(`VOICESTUDIO_VOICE=${vsv[1]}`); return showVoices(chat, '🎙 Голос выбран — все ролики «С озвучкой» будут им.\n\n'); }
    if (data === 'gen') {
      if (!scriptGenReady()) { sessions.set(chat, { awaitSecrets: true }); return send(chat, '🔑 <b>Нужен ключ API нейросети</b>\n\nПришлите одним сообщением (бот сразу его удалит):\n<code>ANTHROPIC_API_KEY=ваш_ключ</code>\n\nЕсли сервер в России — добавьте второй строкой адрес посредника, который выдал ключ:\n<code>ANTHROPIC_BASE_URL=https://…</code>'); }
      sessions.set(chat, { awaitTopic: true }); return send(chat, '✨ <b>О чём ролик?</b>\n\nНапишите тему и, если хотите, пожелания. Например:\n<i>как кэшбэк экономит 20 000 в год</i>\n<i>почему зарплата «исчезает» за неделю</i>');
    }
    if (data === 'gen:again') { const gg = gens.get(chat); if (!gg) return send(chat, 'Начните заново: «✨ Сценарий по теме».', { reply_markup: MENU() }); return runGen(chat, { ...gg, variant: gg.variant + 1 }); }
    if (data === 'gen:make:voice' || data === 'gen:make:plain') { const gg = gens.get(chat); if (!gg) return send(chat, 'Сценарий не найден — сгенерируйте заново.', { reply_markup: MENU() }); return enqueue(chat, { script: gg.script, voice: data === 'gen:make:voice' }); }
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
      return enqueue(chat, { script, voice: s.mode === 'voice' });
    }
    if (data === 'yt:setup') {
      sessions.set(chat, { awaitSecrets: true, lastProject: [...pubCards.keys()].pop() });
      return send(chat, `<b>🔑 Подключение каналов из Bot-Connect</b>\n\nКаналы уже подключены в основном боте — нужны только его ключи. Откройте Replit → проект Bot-Connect → <b>Secrets</b> и пришлите <b>одним сообщением</b> (каждый с новой строки):\n\n<code>YOUTUBE_CLIENT_ID=…\nYOUTUBE_CLIENT_SECRET=…\nYOUTUBE_TOKEN_ENCRYPTION_KEY=…\nSUPABASE_DB_PASSWORD=…</code>\n\nЕсли в Secrets вместо пароля есть <code>SUPABASE_DB_URL</code> или <code>DATABASE_URL</code> — пришлите его.\n🔒 Ключи сохранятся только на вашем сервере, а сообщение я сразу удалю из чата.`);
    }
    const yt = /^yt:(all|none|t|e|p|go|x|th):(?:(title|desc|tags):)?([a-f0-9]+s?)(?::(\d+))?$/.exec(data);
    if (yt) {
      const [, act, field, id, conn] = yt; const p = loadPub(id); if (!p) return send(chat, 'Проект не найден.');
      if (act === 'x') { pubCards.delete(id); return edit(chat, q.message.message_id, '✖️ Публикация отменена. Видео хранится 3 дня — можно вернуться позже.'); }
      if (act === 'go') return publish(chat, id);
      if (act === 'e') { sessions.set(chat, { edit: { field, id } }); return send(chat, field === 'tags' ? '🏷 Пришлите теги через запятую:' : field === 'title' ? '✏️ Пришлите новое название (до 100 символов):' : '✏️ Пришлите новое описание целиком:'); }
      if (act === 'p') p.privacy = { public: 'unlisted', unlisted: 'private', private: 'public' }[p.privacy] || 'public';
      if (act === 'th') { const n = [1, 2, 3].filter(i => fs.existsSync(path.join(DATA_DIR, 'projects', id, `thumb_${i}.jpg`))).length; p.thumb = (p.thumb || 0) >= n ? 0 : (p.thumb || 0) + 1; }
      if (act === 'all') p.selected = (await listChannels().catch(() => [])).map(c => c.id);
      if (act === 'none') p.selected = [];
      if (act === 't') { const c = Number(conn), set = new Set(p.selected || []); set.has(c) ? set.delete(c) : set.add(c); p.selected = [...set]; }
      savePub(id, p); pubCards.set(id, q.message.message_id); return showPublish(chat, id);
    }
    const again = /^again:(new|same|short):([a-f0-9]+)$/.exec(data);
    if (again) {
      const p = loadProject(again[2]); if (!p) return send(chat, 'Проект не найден (возможно, сервер переустанавливали).');
      return enqueue(chat, { script: p.script, projectId: p.id, seed: again[1] === 'new' ? null : p.seed, voice: p.voiced, vertical: again[1] === 'short' });
    }
    return;
  }
  const m = u.message; if (!m) return;
  const chat = m.chat.id;
  if (!allowed(m.from)) return send(chat, `⛔ Нет доступа. Ваш id: <code>${m.from.id}</code>`);
  if (m.text && /^\/(start|menu)/.test(m.text)) return send(chat, '<b>🎬 Моушн-студия</b>\n\nПревращаю сценарий в моушн-ролик 16:9: кинетическая типографика, переходы, графики, частицы и звуковой дизайн. Каждый ролик — со своим визуальным почерком.', { reply_markup: MENU() });
  if (m.text && /^\/help/.test(m.text)) return send(chat, HELP, { reply_markup: MENU() });
  if (m.text && /^\/cancel/.test(m.text)) { sessions.delete(chat); return send(chat, 'Отменено.', { reply_markup: MENU() }); }
  // ключи для AI Content Factory (второй бот на этом же сервере): только для владельцев из ALLOWED_USERS
  if (m.text && /^\/clone/.test(m.text)) {
    if (!VSTUDIO()) return send(chat, 'Сначала подключите VoiceStudio: /voicestudio');
    sessions.set(chat, { awaitClone: true });
    return send(chat, '🎙 <b>Клон голоса</b>\n\nПришлите аудиофайл с образцом голоса (mp3, wav, ogg или голосовое сообщение), 15–60 секунд чистой речи без музыки.\nБот вырежет лучший фрагмент, создаст клон в VoiceStudio и сделает его голосом канала.');
  }
  if (sessions.get(chat)?.awaitClone && (m.audio || m.voice || (m.document && /\.(mp3|wav|ogg|m4a|flac)$/i.test(m.document.file_name || '')))) {
    sessions.delete(chat);
    return cloneFromTelegram(chat, m.audio || m.voice || m.document).catch(e => send(chat, `<b>❌ Не получилось</b>\n<code>${esc(String(e.message).slice(0, 400))}</code>`));
  }
  if (m.text && /^\/voicestudio/.test(m.text)) {
    if (VSTUDIO() && !/new|нов/.test(m.text)) return showVoices(chat);
    sessions.set(chat, { awaitSecrets: true });
    return send(chat, '🎙 <b>Подключение VoiceStudio</b>\n\nПришлите одним сообщением адрес программы (из её настроек сети / Tailscale), при необходимости — токен:\n<code>VOICESTUDIO_URL=http://100.x.y.z:порт</code>\n<code>VOICESTUDIO_TOKEN=…</code>\n\nПотом бот покажет ваши голоса — выберите клон.');
  }
  if (m.text && /^\/factory/.test(m.text)) {
    if (!ALLOWED.length) return send(chat, '⚠️ Сначала ограничьте доступ к боту: ALLOWED_USERS в .env.');
    sessions.set(chat, { awaitFactory: true });
    return send(chat, `🏭 <b>Ключи AI Content Factory</b>\n\nПришлите одним сообщением строки вида <code>ИМЯ=значение</code> — можно все секреты из Replit сразу. Сообщение будет удалено, ключи сохранятся на сервере.\n\nОбязательные: ${FACTORY_REQUIRED.map(k => `<code>${k}</code>`).join(', ')}`);
  }
  let text = m.text || m.caption || '';
  if (m.document && /\.txt$/i.test(m.document.file_name || '')) text = await readDocument(m.document);
  if (!text.trim()) return;
  let s = sessions.get(chat);
  if (s?.awaitFactory) {
    sessions.delete(chat);
    await tg('deleteMessage', { chat_id: chat, message_id: m.message_id }).catch(() => {});
    const file = path.join(DATA_DIR, 'ai-factory.env'), cur = {};
    try { for (const l of fs.readFileSync(file, 'utf8').split('\n')) { const x = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(l); if (x) cur[x[1]] = x[2]; } } catch { /* нет файла */ }
    const saved = [];
    for (const l of text.split('\n')) { const x = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*[=:]\s*["']?(.*?)["']?\s*$/.exec(l); if (x && x[2]) { cur[x[1]] = x[2]; saved.push(x[1]); } }
    if (!saved.length) return send(chat, 'Не нашёл строк <code>ИМЯ=значение</code>. Отправьте /factory ещё раз.');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, Object.entries(cur).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
    const miss = FACTORY_REQUIRED.filter(k => k.includes('|') ? !k.split('|').some(x => cur[x]) : !cur[k]);
    return send(chat, `✅ Сохранено: ${saved.map(k => `<code>${k}</code>`).join(', ')}\n${miss.length ? `⚠️ Ещё нужны: ${miss.map(k => `<code>${k}</code>`).join(', ')}` : '🎉 Все обязательные ключи на месте.'}\n\nСервер применит ключи в течение 2 минут.`);
  }
  if (s?.awaitSecrets) {
    sessions.delete(chat);
    await tg('deleteMessage', { chat_id: chat, message_id: m.message_id }).catch(() => {});
    const saved = saveSecretsFromText(text);
    if (!saved.length) return send(chat, 'Не нашёл ключей в формате <code>ИМЯ=значение</code>. Попробуйте ещё раз.');
    if (saved.some(k => k.startsWith('VOICESTUDIO_'))) return showVoices(chat, `✅ Сохранено: ${saved.join(', ')}\n\n`);
    if (saved.every(k => k.startsWith('ANTHROPIC_'))) { sessions.set(chat, { awaitTopic: true }); return send(chat, `✅ Сохранено: ${saved.join(', ')}\n\n✨ Теперь напишите тему ролика.`); }
    try {
      const ch = await listChannels();
      await send(chat, `✅ Сохранено: ${saved.join(', ')}\n📺 Каналы: ${ch.map(c => esc(c.title)).join(', ') || 'нет'}`);
    } catch (e) { await send(chat, `⚠️ Ключи сохранены (${saved.join(', ')}), но каналы не прочитались: <code>${esc(e.message.slice(0, 300))}</code>`); }
    return s.lastProject ? showPublish(chat, s.lastProject) : undefined;
  }
  if (s?.awaitTopic) { sessions.delete(chat); return runGen(chat, { topic: text.trim().slice(0, 500), variant: 0 }); }
  if (s?.edit) {
    sessions.delete(chat); const { field, id } = s.edit; const p = loadPub(id); if (!p) return;
    if (field === 'title') p.title = text.trim().slice(0, 100);
    if (field === 'desc') p.description = text.trim().slice(0, 5000);
    if (field === 'tags') p.tags = text.split(/[,\n]/).map(x => x.trim().replace(/^#/, '')).filter(Boolean);
    savePub(id, p); pubCards.delete(id); return showPublish(chat, id, '✏️ Изменения сохранены.');
  }
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
  console.log(`Бот @${me.username} запущен. Озвучка: ${voiceCfg()?.provider || (LUMEAN ? 'lumean' : 'выкл')}. Доступ: ${ALLOWED.length ? ALLOWED.join(', ') : 'все'}`);
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
