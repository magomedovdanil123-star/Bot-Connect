#!/usr/bin/env node
// Telegram-бот «Моушн-студия»: сценарий любой длины -> моушн-ролик 16:9 с режиссурой, переходами и звуковым дизайном.
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { loadEnv } from './src/env.js';
import { makeVideo, loadProject, describeStyle, offerLink } from './src/make.js';
import { buildPlan } from './src/planner.js';
import { direct } from './src/director.js';
import { renderBrand } from './src/render.js';
import { authUrl, checkChannels, connectFromRedirect, listChannels, missingSecrets, nicheTrends, postComment, saveSecretsFromText, secret, SECRET_KEYS, setThumbnail, uploadVideo } from './src/youtube.js';
import { createCloneProfile, prepareReference, voiceSample, voiceStudioAlive, voiceStudioVoices } from './src/voicestudio.js';
import { generateScript, generateShort, generateTechnique, loadStyle, rewriteScript, RUBRICS, saveStyle, scriptGenReady } from './src/scriptgen.js';
import { blogScript, BLOG_FORMATS, fillFormat, learnFormat } from './src/blogtpl.js';
import { nextShort, SERIES, tgEnd } from './src/shorts.js';
import { giftFor, markUsed, radar, sequelTopic, topicById, topicScript, topicSeo } from './src/topics.js';
import { composePost, pickDrop } from './src/posts.js';
import { topicKey } from './src/planner.js';
import { HERO_VOICES, synthesize } from './src/voice.js';
import { buildReport, recordJoin, recordVideo, refreshStats, seriesWeights, loadStats, saveStats } from './src/stats.js';
import { analyzeSite } from './src/screens.js';
import { collectMedia, fetchNews, NEWS_GIFT, newsDuration, newsScript, newsSeo, parseNewsInput, sortNews, RUB_ORDER, RUBRICS as NEWS_RUBRICS } from './src/news.js';

loadEnv();
const TOKEN = process.env.BOT_TOKEN;
if (!TOKEN) { console.error('Нет BOT_TOKEN в .env'); process.exit(1); }
// TELEGRAM_API_BASE — свой адрес Bot API (например, прокси, если api.telegram.org недоступен с сервера)
const TG_BASE = (process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');
const API = `${TG_BASE}/bot${TOKEN}`;
const ALLOWED = (process.env.ALLOWED_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
// озвучка: VoiceStudio (свой клон голоса на компьютере) или Lumean; VOICE_PROVIDER=lumean — принудительно Lumean
const LUMEAN = process.env.LUMEAN_KEY && process.env.LUMEAN_TEMPLATE ? { key: process.env.LUMEAN_KEY, template: process.env.LUMEAN_TEMPLATE } : null;
const VSTUDIO = () => secret('VOICESTUDIO_URL') ? { provider: 'voicestudio', url: secret('VOICESTUDIO_URL'), token: secret('VOICESTUDIO_TOKEN'), voice: secret('VOICESTUDIO_VOICE') || 'default', model: secret('VOICESTUDIO_MODEL') || 'omnivoice', speed: Number(secret('VOICESTUDIO_SPEED')) || 1 } : null;
const voiceCfg = () => process.env.VOICE_PROVIDER === 'lumean' ? (LUMEAN || VSTUDIO()) : (VSTUDIO() || LUMEAN);
const hasVoice = () => Boolean(voiceCfg());
// голоса героев (шаблоны Lumean): свой у ведущего формата и у героев с репликами
const HERO_KEYS = { owl: ['LUMEAN_TEMPLATE_OWL', '🦉 Сова'], mole: ['LUMEAN_TEMPLATE_MOLE', '🐀 Крот'], hamster: ['LUMEAN_TEMPLATE_HAMSTER', '🐹 Хомяк'], raccoon: ['LUMEAN_TEMPLATE_RACCOON', '🦝 Енот'], wolf: ['LUMEAN_TEMPLATE_WOLF', '🐺 Волк'] };
const heroVoices = () => Object.fromEntries(Object.entries(HERO_KEYS).map(([k, [env]]) => [k, secret(env) || HERO_VOICES[k] || '']).filter(([, v]) => v));
// VoiceStudio в соседнем контейнере на этом же сервере (voice-server.sh), а не на компьютере
const VS_LOCAL = () => /\/\/voicestudio[:/]/.test(secret('VOICESTUDIO_URL'));
const VS_DOWN = () => VS_LOCAL() ? 'Сервис озвучки на сервере ещё запускается (первый запуск скачивает модели — до 15 минут). Проверьте: <code>docker compose logs --tail 30 voicestudio</code>' : 'Проверьте, что программа запущена на компьютере и сетевой доступ (Tailscale) включён.';
const REF_WAV = () => path.join(DATA_DIR, 'voice', 'reference.wav');
const owner = () => ALLOWED.find(x => /^\d+$/.test(x));

// Клон делается один раз: образец лежит в data/voice/reference.wav. Если профиль в VoiceStudio пропал
// (переустановка, очистка) или голос ещё не выбран — бот сам пересоздаёт клон из этого образца.
let ensuring = false;
async function ensureClone() {
  const vs = VSTUDIO(); if (ensuring || !vs || !fs.existsSync(REF_WAV()) || !(await voiceStudioAlive(vs))) return;
  ensuring = true;
  try {
    const list = await voiceStudioVoices(vs).catch(() => null);
    if (!list || (vs.voice !== 'default' && list.some(v => String(v.id) === vs.voice))) return;
    const id = await createCloneProfile(vs, REF_WAV(), 'Голос канала');
    saveSecretsFromText(`VOICESTUDIO_VOICE=${id}`);
    if (owner()) await send(owner(), `🎙 Клон голоса восстановлен из сохранённого образца · профиль <code>${esc(id)}</code>`).catch(() => {});
  } catch (e) { console.error('ensureClone', e.message); } finally { ensuring = false; }
}
async function showVoices(chat, note = '') {
  const vs = VSTUDIO(); if (!vs) return send(chat, 'VoiceStudio не подключён — отправьте /voicestudio.');
  if (!(await voiceStudioAlive(vs))) return send(chat, `${note}⚠️ <b>VoiceStudio не отвечает</b> по адресу <code>${esc(vs.url)}</code>\n${VS_DOWN()}`);
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

// режимы — отдельными кнопками: стиль ролика выбирается явно, а не угадывается по тексту
const MENU = () => ({ inline_keyboard: [
  [{ text: '📰 Зверо-новости', callback_data: 'news' }],
  [{ text: '✨ Сценарий по теме', callback_data: 'gen' }, { text: '🏭 Shorts-фабрика', callback_data: 'ap' }],
  [{ text: '🗑 Мусор', callback_data: 'trash' }],
] });
// редко нужное — в «Мусоре», чтобы главное меню не пестрело
const TRASH = () => ({ inline_keyboard: [
  [{ text: '🐹 Хомяк-история', callback_data: 'make:ham' }, { text: '💜 Неон-инфографика', callback_data: 'make:neon' }],
  [{ text: '📡 Радар тем', callback_data: 'radar' }, { text: `🏷 Реклама${loadOffer() ? ' ✅' : ''}`, callback_data: 'offer' }],
  [{ text: '🎙 Голос', callback_data: 'voice' }, { text: '📖 Как писать сценарий', callback_data: 'help' }],
  [{ text: '⬅️ В меню', callback_data: 'menu' }],
] });
const STYLE_NAME = { ham: '🐹 Хомяк-история', neon: '💜 Неон-инфографика' };
// ---------- рекламное предложение (партнёрка): data/offer.json ----------
const offerFile = () => path.join(DATA_DIR, 'offer.json');
function loadOffer() { try { return JSON.parse(fs.readFileSync(offerFile(), 'utf8')); } catch { return null; } }
const OFFER_KEYS = { НАЗВАНИЕ: 'title', TITLE: 'title', ССЫЛКА: 'link', LINK: 'link', ERID: 'erid', РЕКЛАМОДАТЕЛЬ: 'advertiser', ADVERTISER: 'advertiser', ВЫГОДЫ: 'perks', PERKS: 'perks', НАДПИСЬ: 'cardText', CARD: 'cardText', ЦВЕТ: 'color', COLOR: 'color', КОРОТКО: 'short', ВЫПЛАТА: 'payout', УСЛОВИЕ: 'condition', ЗАДАЧА: 'task', САЙТ: 'site' };
function parseOffer(text, base = loadOffer()) {
  const o = { ...(base || {}) };
  for (const l of text.split('\n')) { const m = /^\s*([A-Za-zА-Яа-яЁё]+)\s*[=:]\s*(.+?)\s*$/.exec(l); const k = m && OFFER_KEYS[m[1].toUpperCase()]; if (k) o[k] = k === 'perks' ? m[2].split(/[;|]/).map(x => x.trim()).filter(Boolean).slice(0, 3) : m[2]; }
  if (o.title && !o.short) o.short = /карт/i.test(o.title) ? 'карту' : /счёт|счет/i.test(o.title) ? 'счёт' : 'предложение';
  return o;
}
const offerText = o => o ? `<b>${esc(o.title || '—')}</b>\nВыгоды: ${esc((o.perks || []).join(' · ') || '—')}\nСсылка: ${esc(o.link || '—')}\nРекламодатель: ${esc(o.advertiser || '—')} · erid: <code>${esc(o.erid || '—')}</code>` : 'не задано';
// строка со ссылкой превращается в сцену предложения; если её нет — добавляем перед призывом подписаться
function withOfferLine(script, o) {
  if (/ссылк\S*.*(описани|закреп)/i.test(script)) return script;
  const lines = script.split('\n'), line = `Ссылка на ${o.short || 'предложение'} — в описании под видео.`, i = lines.findLastIndex(l => /подпис/i.test(l));
  if (i >= 0) lines.splice(i, 0, line); else lines.push(line); return lines.join('\n');
}
const FACTORY_REQUIRED = ['TELEGRAM_BOT_TOKEN', 'SUPABASE_DB_PASSWORD', 'OPENROUTER_API_KEY', 'LUMEAN_API_KEY|VOICE_API_KEY'];
const gens = new Map();   // chatId -> { topic, script, variant } — последний сгенерированный сценарий
const GEN_KB = () => ({ inline_keyboard: [
  [{ text: '🎬 Собрать (выбрать стиль и формат)', callback_data: 'gen:make' }],
  [{ text: '🔄 Другой вариант', callback_data: 'gen:again' }, { text: '🗂 Другая рубрика', callback_data: 'gen' }],
] });
const RUBRIC_KB = () => ({ inline_keyboard: [...Object.entries(RUBRICS).map(([k, r]) => [{ text: r.name, callback_data: `gen:r:${k}` }]), [{ text: '🎲 Любая', callback_data: 'gen:r:any' }]] });
// выпуск «разбор сайта»: формат каждый раз другой (не повторяем прошлый), содержание — со страницы.
// Форматы — встроенные и свои (их пользователь сохраняет кнопкой «⭐» или командой /formats).
const blogLastFile = () => path.join(DATA_DIR, 'blog_last.json'), formatsFile = () => path.join(DATA_DIR, 'formats.json');
function loadFormats() { try { return JSON.parse(fs.readFileSync(formatsFile(), 'utf8')); } catch { return []; } }
function saveFormats(list) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(formatsFile(), JSON.stringify(list, null, 1)); }
const SCRIPT_KB = () => ({ inline_keyboard: [[{ text: '🔄 Другой формат', callback_data: 'blog:again' }, { text: '⭐ Сохранить как мой формат', callback_data: 'fmt:save' }],
  ...(scriptGenReady() ? [[{ text: '✏️ Переделать по комментарию', callback_data: 'gen:rewrite' }]] : [])] });
async function showFormats(chat, note = '') {
  const list = loadFormats();
  return send(chat, `${note}🗂 <b>Форматы выпусков</b>\n\nВстроенные: ${Object.values(BLOG_FORMATS).join(', ')}\nВаши: ${list.length ? list.map(f => `⭐ ${esc(f.name)} (${f.lines.length} строк)`).join(', ') : 'пока нет'}\n\n<i>Свой формат: поправьте любой сценарий и нажмите «⭐ Сохранить как мой формат», или добавьте с нуля.</i>`,
    { reply_markup: { inline_keyboard: [[{ text: '➕ Добавить формат', callback_data: 'fmt:add' }], ...list.map(f => [{ text: `🗑 ${f.name}`.slice(0, 60), callback_data: `fmt:del:${f.id}` }])] } });
}
async function runBlog(chat, b) {
  let last = ''; try { last = JSON.parse(fs.readFileSync(blogLastFile(), 'utf8')).format; } catch { /* первый выпуск */ }
  const user = loadFormats(), all = [...Object.keys(BLOG_FORMATS), ...user.map(f => 'u:' + f.id)];
  // свои форматы автор сделал сам — им чуть больше шансов
  const pool = all.filter(k => k !== last && k !== b.format), weighted = pool.flatMap(k => k.startsWith('u:') ? [k, k] : [k]);
  const format = weighted[Math.floor(Math.random() * weighted.length)] || all[0]; b.format = format;
  fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(blogLastFile(), JSON.stringify({ format }));
  const offer = b.offer ? loadOffer() : null, uf = format.startsWith('u:') && user.find(f => 'u:' + f.id === format);
  if (scriptGenReady() && !uf) {
    const g = { topic: `разбор сайта ${b.site}${b.wish ? '. ' + b.wish : ''}`, variant: 0, rubric: 'blog', offer: !!offer, facts: b.facts, format: BLOG_FORMATS[format] };
    gens.set(chat, { ...g, blog: b }); return runGen(chat, g);
  }
  const script = uf ? fillFormat(uf, { site: b.site, facts: b.facts, offer }) : blogScript({ site: b.site, offer, facts: b.facts, format });
  const ns = newSession('ham', { parts: [script], offer: !!offer, replaceNext: true }); sessions.set(chat, ns); gens.set(chat, { blog: b, script });
  await send(chat, `📝 <b>Сценарий · ${esc(uf ? '⭐ ' + uf.name : BLOG_FORMATS[format])}</b>\n\n${esc(script)}\n\n<i>Поправьте под себя и пришлите целиком — бот заменит сценарий. Понравилось — «⭐ Сохранить как мой формат», и бот будет писать так для любых сайтов.</i>`, { reply_markup: SCRIPT_KB() });
  return showCollect(chat, ns);
}
async function runGen(chat, g) {
  const m = await send(chat, `✍️ <b>Пишу сценарий</b>${RUBRICS[g.rubric] ? ` · ${RUBRICS[g.rubric].name}` : ''}${g.variant ? ` · вариант ${g.variant + 1}` : ''}
<i>${esc(g.topic)}</i>

Обычно это 20–60 секунд…`);
  try {
    g.script = await generateScript(g.topic, { variant: g.variant, rubric: g.rubric, offer: g.offer ? loadOffer() : null, facts: g.facts, format: g.format }); gens.set(chat, { ...(gens.get(chat) || {}), ...g });
    await edit(chat, m.message_id, `<b>✨ Сценарий готов</b> · ${g.script.split('\n').length} сцен\n\n${esc(g.script)}\n\n<i>Хотите поправить — скопируйте, измените и пришлите текст боту.</i>`, { reply_markup: { inline_keyboard: [...GEN_KB().inline_keyboard, ...SCRIPT_KB().inline_keyboard.slice(gens.get(chat)?.blog ? 0 : 1)] } });
  } catch (e) { await edit(chat, m.message_id, `<b>❌ Не получилось написать сценарий</b>\n<code>${esc(String(e.message).slice(0, 400))}</code>`, { reply_markup: MENU() }); }
}
const COLLECT_KB = s => ({ inline_keyboard: [[{ text: '✅ Собрать ролик', callback_data: 'collect:done' }, { text: '📦 Всё сразу', callback_data: 'collect:pack' }],
  [{ text: s.style === 'neon' ? '💜 Стиль: неон' : '🐹 Стиль: хомяк', callback_data: 'collect:style' }, { text: s.vertical ? '📱 Формат: Shorts' : '🖥 Формат: 16:9', callback_data: 'collect:fmt' }],
  [...(hasVoice() ? [{ text: s.mode === 'voice' ? '🎙 Озвучка: вкл' : '🔇 Озвучка: выкл', callback_data: 'collect:voice' }] : []), ...(loadOffer() ? [{ text: s.offer ? '🏷 Реклама: вкл' : '🏷 Реклама: выкл', callback_data: 'collect:offer' }] : [])],
  [{ text: '🗑 Отменить', callback_data: 'collect:cancel' }]].filter(r => r.length) });
const newSession = (style, extra = {}) => ({ mode: hasVoice() ? 'voice' : 'plain', style, vertical: false, offer: false, parts: [], ...extra });
const AFTER_KB = (id, pid = id) => ({ inline_keyboard: [
  [{ text: '📱 Shorts 9:16', callback_data: `again:short:${id}` }, { text: '🎲 Новый стиль', callback_data: `again:new:${id}` }],
  [{ text: '🔁 Пересобрать 1:1', callback_data: `again:same:${id}` }, { text: '🎬 Новый сценарий', callback_data: 'menu' }],
  [{ text: '📣 В Telegram-канал', callback_data: `tg:post:${pid}` }],
] });

// ---------- Telegram-канал проекта: бот публикует туда ролики с готовым текстом поста ----------
let BOT_ID = 0;
const channelFile = () => path.join(DATA_DIR, 'tgchannel.json');
function loadChannel() { try { return JSON.parse(fs.readFileSync(channelFile(), 'utf8')); } catch { return null; } }
// канал проекта подключается сам, если бот уже его администратор (TG_CHANNEL в .env, по умолчанию @traffichomyak) — без /channel
async function ensureChannel() {
  if (loadChannel()) return loadChannel();
  try {
    const c = await tg('getChat', { chat_id: process.env.TG_CHANNEL || '@traffichomyak' }), me = await tg('getChatMember', { chat_id: c.id, user_id: BOT_ID });
    if (me.status !== 'administrator' || me.can_post_messages === false) return null;
    fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(channelFile(), JSON.stringify({ chat: c.id, title: c.title, username: c.username || '' }));
    console.log(`Telegram-канал подключён автоматически: ${c.title}`); return loadChannel();
  } catch (e) { console.error('канал:', e.message); return null; }
}
// текст поста: заголовок-крючок, 2–3 главные мысли из сценария, ссылка с меткой канала и маркировка рекламы
function buildPost(pid) {
  const pub = loadPub(pid) || {}, prj = loadProject(pid.replace(/s$/, '')) || {}, o = prj.offer;
  const skip = /привет|с вами|на связи|подпис|ссылк\S* .*(описани|закреп)|^(а )?это /i;
  const lines = (prj.script || '').split('\n').map(l => l.trim()).filter(l => l && !skip.test(l));
  const key = [...lines.filter(l => /\d|\?|!|честно|главн|важн/i.test(l)), ...lines].filter((l, i, a) => a.indexOf(l) === i).slice(0, 3);
  let t = `<b>${esc((pub.title || prj.seo?.title || 'Новый выпуск').replace(/\s*#shorts$/i, ''))}</b>\n\n${key.map(l => '▫️ ' + esc(l)).join('\n')}`;
  if (o?.link) t += `\n\n👉 <a href="${esc(offerLink(o.link, 'tg_' + pid))}">${esc(o.title || 'Ссылка')}</a>${o.advertiser || o.erid ? `\n<i>Реклама. ${esc(o.advertiser || '')}${o.erid ? `. erid: ${esc(o.erid)}` : ''}</i>` : ''}`;
  if (!o?.link) t += '\n\n📌 С чего начать — в закреплённом посте';
  t += '\n\n💬 Вопросы — в комментариях\n#хомяк #деньги #заработок';
  return t.length > 1000 ? t.slice(0, 990) + '…' : t;
}
// закреп канала: кто мы, что здесь будет, с чего начать (ссылка с меткой и маркировкой, если задано предложение)
function pinText() {
  const o = loadOffer(), ch = loadChannel();
  return `🐹 <b>${esc(ch?.title || 'Хомяк зарабатывает')}</b> — честно о заработке в интернете.\n\nЗдесь:\n▫️ разборы сервисов: где правда платят, а где развод\n▫️ реальные цифры — сколько получается заработать\n▫️ пошаговые инструкции для новичков\n▫️ короткие мультики с Хомяком 🐹\n\n` +
    (o?.link ? `👉 <b>С чего начать:</b> <a href="${esc(offerLink(o.link, 'tg_pin'))}">${esc(o.title || 'регистрация')}</a>${o.advertiser || o.erid ? `\n<i>Реклама. ${esc(o.advertiser || '')}${o.erid ? `. erid: ${esc(o.erid)}` : ''}</i>` : ''}\n\n` : '') +
    '💬 Вопросы — в комментариях под постами. Отвечаю всем.';
}
async function postToChannel(chat, pid) {
  const ch = loadChannel(), pub = loadPub(pid); if (!ch || !pub?.tgFiles?.length) return send(chat, 'Канал не подключён или видео не найдено.');
  try {
    let first = null; const text = pub.tgCaption || buildPost(pid), long = text.length > 1000;   // подпись к видео — до 1024 знаков; длинный пост-подарок идёт следом отдельным сообщением
    const cap = long ? text.split('\n\n')[0] + '\n\n👇 Всё — в следующем посте' : text;
    for (const [i, fid] of pub.tgFiles.entries()) { const m = await tg('sendVideo', { chat_id: ch.chat, video: fid, supports_streaming: true, ...(i === 0 ? { caption: cap, parse_mode: 'HTML' } : {}) }); first ||= m; }
    if (long) await tg('sendMessage', { chat_id: ch.chat, text: text.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true });
    const url = ch.username && first ? `https://t.me/${ch.username}/${first.message_id}` : '';
    return send(chat, `✅ Опубликовано в ${esc(ch.title || ch.chat)}${url ? `\n${url}` : ''}`);
  } catch (e) { return send(chat, `❌ Не опубликовал в канал: <code>${esc(String(e.message).slice(0, 300))}</code>\nПроверьте, что бот — администратор канала с правом публикации.`); }
}

// ---------- Shorts-фабрика: по расписанию (время московское) бот сам делает Shorts из рубрик ----------
// Режим «на проверку» — присылает готовое с кнопками; «сразу» — публикует: каждый ролик на ОДИН канал по очереди + пост в Telegram-канал.
const apFile = () => path.join(DATA_DIR, 'autopilot.json'), sitesFile = () => path.join(DATA_DIR, 'sites.json');
function loadSites() { try { return JSON.parse(fs.readFileSync(sitesFile(), 'utf8')); } catch { return []; } }
// товары под рубрики: пост-подарок в канале заканчивается товаром именно под тему ролика («Сервис дня» → этот сервис),
// товар без рубрик — общий, для остальных. Нет товара — ведём в закреп «с чего начать».
const productsFile = () => path.join(DATA_DIR, 'products.json');
function loadProducts() { try { return JSON.parse(fs.readFileSync(productsFile(), 'utf8')); } catch { return []; } }
const RUBRIC_WORDS = { term: /слов|термин/, mistake: /ошиб/, calc: /привыч|теря/, myth: /миф/, expect: /ожидан/, save: /отклад|коп/, challenge: /челлендж/, site: /сервис|сайт/, hack: /лайфхак/ };
const rubricsOf = str => Object.keys(RUBRIC_WORDS).filter(k => str.toLowerCase().split(/[,;]/).some(w => (w = w.trim()) && (w === k || RUBRIC_WORDS[k].test(w))));
const productFor = (series, id) => { const all = loadProducts(); return (id && all.find(p => p.id === id)) || all.find(p => p.series?.includes(series)) || all.find(p => !p.series?.length) || loadOffer(); };
const EARN = ['calc', 'save', 'expect', 'site', 'hack', 'offer'];
// пост к ролику: подарок (если ролик его обещал) + полезная техника по теме ролика + товар или закреп
const dropsFile = () => path.join(DATA_DIR, 'drops_used.json');
async function videoPost({ script, gift = null, series = null, offer = null, pid = '' }) {
  let used = []; try { used = JSON.parse(fs.readFileSync(dropsFile(), 'utf8')); } catch { /* первый пост */ }
  let drop = null;
  if (scriptGenReady()) { try { drop = await generateTechnique({ script, avoid: used.slice(-12) }); } catch (e) { console.error('post drop:', e.message); } }
  drop ||= pickDrop(topicKey(script), used);
  fs.writeFileSync(dropsFile(), JSON.stringify([...used, drop.title].slice(-40)));
  const footer = offer?.link ? `\n\n👉 <a href="${esc(offerLink(offer.link, 'tg_' + pid))}">${esc(offer.title || 'Ссылка')}</a>${offer.advertiser || offer.erid ? `\n<i>Реклама. ${esc(offer.advertiser || '')}${offer.erid ? `. erid: ${esc(offer.erid)}` : ''}</i>` : ''}\n\n💬 Вопросы — в комментариях\n#хомяк #деньги #заработок`
    : giftFooter(series || 'base', gift);
  return composePost({ gift, drop: { title: esc(drop.title), body: drop.body }, footer });
}
function giftFooter(series, gift) {
  const o = productFor(series, gift?.productId);
  let t = '';
  if (o?.link) t += `\n\n${EARN.includes(series) ? '💸 С чего начать мне помогло:' : '👉 Что выбрал я:'} <a href="${esc(offerLink(o.link, 'tg_' + series))}">${esc(o.title || 'ссылка')}</a>${o.perks?.length ? `\n<i>${esc(o.perks.join(' · '))}</i>` : ''}${o.advertiser || o.erid ? `\n<i>Реклама. ${esc(o.advertiser || '')}${o.erid ? `. erid: ${esc(o.erid)}` : ''}</i>` : ''}`;
  else t += `\n\n📌 ${EARN.includes(series) ? 'Как я зарабатываю на рекомендациях' : 'С чего начать зарабатывать'} — в закреплённом посте.`;
  return t + '\n\n💬 Вопросы — в комментариях\n#хомяк #деньги #заработок';
}
function showProducts(chat, note = '') {
  const all = loadProducts(), name = k => SERIES[k]?.name || k;
  const list = all.length ? all.map((p, i) => `${i + 1}. <b>${esc(p.title)}</b> → ${p.series?.length ? p.series.map(name).join(', ') : 'общий (для остальных рубрик)'}`).join('\n') : 'пока нет — посты ведут в закреп';
  return send(chat, `${note}🛍 <b>Товары под рубрики</b>\n\nВ конце каждого поста-подарка в канале — товар под тему ролика.\n\n${list}\n\nДобавить — одним сообщением:\n<code>НАЗВАНИЕ=Сервис, который рекомендуешь\nССЫЛКА=https://ваша-партнёрская-ссылка\nERID=токен из кабинета\nРЕКЛАМОДАТЕЛЬ=ООО «…», ИНН …\nВЫГОДЫ=Бесплатно; Регистрация за 2 минуты\nРУБРИКИ=сервис, лайфхак, привычки\nВЫПЛАТА=до 35 000 ₽\nУСЛОВИЕ=курьер выполнил 30 заказов\nЗАДАЧА=приведи курьера в своём городе\nСАЙТ=https://страница-оффера</code>\n\nС ВЫПЛАТОЙ товар попадает в рубрику «💸 Оффер дня» (ролик про него, с маркировкой рекламы).\n\nРубрики: ${Object.keys(SERIES).map(name).join(' · ')}. Без РУБРИК — товар общий.`,
    { reply_markup: { inline_keyboard: [[{ text: '➕ Добавить товар', callback_data: 'prod:add' }], ...all.map(p => [{ text: `🗑 ${p.title.slice(0, 40)}`, callback_data: `prod:del:${p.id}` }])] } });
}
const AP_DEF = () => ({ on: false, perDay: 2, mode: 'review', series: Object.keys(SERIES), rr: 0, done: {} });
function loadAP() { try { return { ...AP_DEF(), ...JSON.parse(fs.readFileSync(apFile(), 'utf8')) }; } catch { return AP_DEF(); } }
function saveAP(a) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(apFile(), JSON.stringify(a, null, 1)); }
const AP_TIMES = { 1: ['18:00'], 2: ['12:00', '19:00'], 3: ['10:00', '15:00', '19:00'], 5: ['09:00', '12:00', '15:00', '18:00', '21:00'] };
const mskNow = () => { const d = new Date(Date.now() + 3 * 3600e3).toISOString(); return { day: d.slice(0, 10), hm: d.slice(11, 16) }; };
const apText = a => `🏭 <b>Shorts-фабрика</b> · ${a.on ? '🟢 работает' : '⏸ выключена'}\n\nВ день: <b>${a.perDay}</b> (${(AP_TIMES[a.perDay] || []).join(', ')} МСК)\nРежим: <b>${a.mode === 'auto' ? '🚀 сразу публиковать' : '👀 присылать на проверку'}</b>\nКаналы YouTube по очереди: ${lastSelected().length || 'не выбраны — отметьте в любой карточке публикации'}\nTelegram-канал: ${loadChannel()?.title ? esc(loadChannel().title) : 'не подключён (/channel)'}\n\n<i>Каждый Shorts — новая тема, свой образ и студия; каждый ролик уходит на один канал, без дублей.</i>`;
const AP_KB = a => ({ inline_keyboard: [
  [{ text: a.on ? '⏸ Выключить' : '▶️ Включить', callback_data: 'ap:on' }, { text: '🚀 Сделать сейчас', callback_data: 'ap:now' }],
  [1, 2, 3, 5].map(n => ({ text: `${a.perDay === n ? '✅ ' : ''}${n}/день`, callback_data: `ap:n:${n}` })),
  [{ text: a.mode === 'auto' ? '🚀 Режим: сразу публиковать' : '👀 Режим: на проверку', callback_data: 'ap:mode' }],
  [{ text: a.radar === false ? '📡 Радар по утрам: выкл' : '📡 Радар по утрам: вкл (10:15)', callback_data: 'ap:radar' }, { text: '📡 Темы сейчас', callback_data: 'radar' }],
  ...Object.entries(SERIES).map(([k, v]) => [{ text: `${a.series.includes(k) ? '✅' : '▫️'} ${v.name}`, callback_data: `ap:s:${k}` }]),
] });
// каналы YouTube: проверка доступа и переподключение (доступ «устаревает», если OAuth-приложение в Google Cloud в режиме Testing)
async function showYT(chat, note = '') {
  if (missingSecrets().length) return send(chat, note + '📺 Каналы YouTube ещё не подключены: откройте карточку публикации любого ролика → «🔑 Подключить каналы».');
  let list; try { list = await checkChannels(); } catch (e) { return send(chat, `❌ Не удалось проверить каналы: <code>${esc(String(e.message).slice(0, 200))}</code>`); }
  const bad = list.filter(c => !c.ok).length;
  return send(chat, `${note}📺 <b>Каналы YouTube</b>\n\n${list.map(c => `${c.ok ? '✅' : '❌'} ${esc(c.title)}${c.ok ? '' : ' — доступ истёк'}`).join('\n') || 'нет каналов'}\n\n` +
    (bad ? `Чтобы переподключить, нажмите «🔑 Подключить / обновить канал» и повторите для каждого ❌.\n\n<b>Один раз в Google Cloud</b> (иначе доступ снова «устареет» через 7 дней):\n1. console.cloud.google.com → APIs &amp; Services → <b>Credentials</b> → ваш OAuth-клиент (ID начинается с <code>${esc(String(secret('YOUTUBE_CLIENT_ID')).slice(0, 12))}…</code>) → Authorized redirect URIs → добавить <code>https://homyak.magomedov-danil123.workers.dev/oauth</code> → Save.\n2. <b>OAuth consent screen</b> (Google Auth Platform → Audience) → <b>Publish app</b> → In production.` : 'Все каналы на связи 👍'),
    { reply_markup: { inline_keyboard: [[{ text: '🔑 Подключить / обновить канал', callback_data: 'ytc:link' }], [{ text: '🔄 Проверить ещё раз', callback_data: 'ytc:check' }]] } });
}
const showAP = (chat, note = '') => { const a = loadAP(); a.chat = chat; saveAP(a); return send(chat, note + apText(a), { reply_markup: AP_KB(a) }); };
async function apMakeOne(chat, a) {
  await ensureChannel();
  const offers = loadProducts().filter(p => p.payout && p.link);
  const n = nextShort(a, a.series, { tg: Boolean(loadChannel()?.username), sites: loadSites(), offers, weights: seriesWeights(loadStats(DATA_DIR)) }); saveAP(a);
  if (!n) return send(chat, '⚠️ Включите хотя бы одну рубрику (для «Сервис дня» нужен список сайтов: /sites).');
  // нейросеть превращает черновик рубрики в живой сценарий; без ключа или при ошибке — шаблон как есть
  let script = n.script;
  if (scriptGenReady()) { try { script = (await generateShort({ name: n.name, draft: n.body })) + '\n' + n.end; } catch (e) { console.error('shorts gen:', e.message); send(chat, `⚠️ Нейросеть не написала сценарий (<code>${esc(String(e.message).slice(0, 200))}</code>) — ролик собран по шаблону.`).catch(() => {}); } }
  else if (a.aiHint !== mskNow().day) { a.aiHint = mskNow().day; saveAP(a); send(chat, '✍️ Сценарий собран по шаблону — фразы меняются, но факты и структура рубрики те же. Чтобы каждый текст нейросеть писала с нуля (и названия тоже), подключите ключ:', { reply_markup: { inline_keyboard: [[{ text: '🔑 Подключить нейросеть', callback_data: 'ai:key' }]] } }).catch(() => {}); }
  return enqueue(chat, { script, voice: hasVoice(), theme: 'ink', mascot: true, vertical: true, offer: n.gift?.productId ? offers.find(o => o.id === n.gift.productId) || null : null, gift: n.gift && { ...n.gift, series: n.series }, seoHints: n.seo, auto: { mode: a.mode, series: n.name } });
}
// ---------- радар тем: 10 тем на выбор → сценарий на проверку → правки → сборка ----------
const radarFile = () => path.join(DATA_DIR, 'radar.json'), draftFile = () => path.join(DATA_DIR, 'drafts.json');
const loadJ = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const saveJ = (f, v) => { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(f, JSON.stringify(v)); };
// залетевшие ролики: просмотры заметно выше обычных (в 3 раза выше медианы и не меньше 1 000)
function hitsNow() {
  const st = loadStats(DATA_DIR), vs = st.videos.filter(v => Date.now() - v.at < 45 * 864e5 && st.views[v.id]).map(v => ({ ...v, views: st.views[v.id].views }));
  if (!vs.length) return [];
  const sorted = vs.map(v => v.views).sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)];
  const seen = new Set(); return vs.filter(v => v.views >= Math.max(1000, med * 3)).sort((a, b) => b.views - a.views).filter(v => !seen.has(v.title) && seen.add(v.title));
}
async function showRadar(chat, fresh = true) {
  let r = loadJ(radarFile(), {})[chat];
  if (fresh || !r) {
    const m = await send(chat, '📡 Ищу темы: календарь, твои хиты' + (scriptGenReady() ? ', тренды YouTube' : '') + '…');
    await statsRefresh().catch(() => {});
    let trends = []; if (scriptGenReady() && !missingSecrets().length) trends = await nicheTrends().catch(e => { console.error('trends', e.message); return []; });
    r = { at: Date.now(), items: radar(DATA_DIR, { hits: hitsNow(), trends }) };
    const all = loadJ(radarFile(), {}); all[chat] = r; saveJ(radarFile(), all);
    tg('deleteMessage', { chat_id: chat, message_id: m.message_id }).catch(() => {});
  }
  const kinds = { hit: 'продолжение твоего хита', season: 'по календарю — ищут прямо сейчас', trend: 'в трендах YouTube за неделю', bank: 'жизненная тема' };
  return send(chat, `📡 <b>Радар тем — 10 на сегодня</b>\n\n${r.items.map((x, i) => `${i + 1}. ${x.label} ${esc(x.title)}${x.hit ? ` <i>(${x.hit.views.toLocaleString('ru')} просм.)</i>` : x.trend?.views ? ` <i>(${x.trend.views.toLocaleString('ru')} просм.)</i>` : ''}`).join('\n')}\n\n<i>🔥 ${kinds.hit} · 📅 ${kinds.season} · 📈 ${kinds.trend}</i>\n\nВыбери тему — пришлю сценарий на проверку.`,
    { reply_markup: { inline_keyboard: [...r.items.map((x, i) => [{ text: `${i + 1}. ${x.label} ${x.title.slice(0, 48)}`, callback_data: `rd:${i}` }]), [{ text: '🔄 Другие темы', callback_data: 'rd:new' }]] } });
}
async function makeDraft(chat, i) {
  const r = loadJ(radarFile(), {})[chat], it = r?.items?.[i]; if (!it) return showRadar(chat);
  const m = await send(chat, `✍️ Пишу сценарий: <b>${esc(it.title)}</b>…`);
  if (it.kind === 'news') { tg('deleteMessage', { chat_id: chat, message_id: m.message_id }).catch(() => {}); return newsDraft(chat, it.news); }
  let script, gift, seo, topic = null;
  if (it.kind === 'trend') {
    if (!scriptGenReady()) return edit(chat, m.message_id, 'Для тем из трендов нужна нейросеть: /ai');
    script = await generateShort({ name: 'Тренд недели', draft: `Тема из трендов YouTube: «${it.title}»`, free: true });
    const kind = { spend: 'spend', save: 'save', work: 'earn', online: 'earn' }[topicKey(script)] || 'spend'; gift = giftFor({ kind });
    seo = { series: 'topic:trend', topic: it.title.slice(0, 40), title: it.title.slice(0, 80), tags: ['хомяк и крот', 'финансовая грамотность'], promise: gift.promise };
  } else {
    const t = it.kind === 'hit' ? sequelTopic(DATA_DIR, it.hit) : topicById(it.id); if (!t) return edit(chat, m.message_id, 'Тема не найдена — обнови радар.');
    topic = t.id; gift = giftFor(t); seo = topicSeo(t); script = topicScript(t, { sequel: it.kind === 'hit' });
    // с нейросетью продолжение хита — про тот же сюжет, что залетел (часть 2), а не просто тема того же типа
    if (scriptGenReady()) { try { script = it.kind === 'hit' ? await generateShort({ name: 'Продолжение хита', draft: `Наш ролик «${it.hit.title}» залетел. Сделай часть 2: те же герои и тот же тип крючка, новый поворот этой же темы. Основа для идей:\n${script}`, free: true }) : await generateShort({ name: t.title, draft: script, fmt: t.fmt }); } catch (e) { console.error('draft gen', e.message); } }
  }
  if (loadChannel()?.username) script += '\n' + tgEnd(gift).join('\n');
  const all = loadJ(draftFile(), {}); all[chat] = { i, title: it.title, script, gift, seo, topic }; saveJ(draftFile(), all);
  tg('deleteMessage', { chat_id: chat, message_id: m.message_id }).catch(() => {});
  return showDraft(chat);
}
// «Зверо-новости»: свои новости (текст или ссылка) или из радара → сценарий на проверку
const NEWS_HELP = `📰 <b>Зверо-новости</b> — ведёт Сова, рядом Крот.\n\nПришли новость: <b>заголовок первой строкой</b>, ниже 1–3 предложения сути. Или просто <b>ссылку на статью</b> — заголовок, суть и картинку возьму сам.\n\n📷 <b>Фото и видео</b>: пришли их с подписью-новостью или сразу после новости — покажу в выпуске (видео — первые 7 секунд). Фото людей из заголовка поищу в Википедии сам.\n\nВ выпуске до 5 новостей (лучше 3–4): присылай по одной или сразу несколько через пустую строку. Бот сам разложит их по рубрикам — 🌟 звёзды, 🤖 нейросети, 🛒 новинки, 😂 тренд дня, 🏆 хорошие новости — и сделает анонс с фото. Когда хватит — жми «✅ Собрать выпуск».`;
// список принятых новостей с рубриками; у последней — кнопки смены рубрики
const NEWS_KB = (n, items = []) => ({ reply_markup: { inline_keyboard: [
  ...(items.length ? [RUB_ORDER.map(k => ({ text: NEWS_RUBRICS[k].icon + (items[items.length - 1].rub === k ? '✓' : ''), callback_data: `nw:rub:${items.length - 1}:${k}` }))] : []),
  ...(n ? [[{ text: `✅ Собрать выпуск (${n})`, callback_data: 'nw:go' }]] : []), [{ text: '🗑 Начать заново', callback_data: 'nw:reset' }]] } });
const newsList = items => items.map((it, i) => `${i + 1}. ${NEWS_RUBRICS[it.rub]?.icon || '📰'} ${esc(it.title)}${it.media?.length ? ' 📎' : ''}`).join('\n');
const NEWS_RUB_HINT = `\n\n<i>Рубрика определилась сама — поменять у последней новости: ${RUB_ORDER.map(k => NEWS_RUBRICS[k].icon + ' ' + NEWS_RUBRICS[k].title).join(' · ')}</i>`;
// фото/видео к новости: с подписью — это новая новость с картинкой; без подписи — к последней присланной
async function newsMediaIn(chat, m, s) {
  const f = m.photo ? m.photo[m.photo.length - 1] : m.video || m.animation || m.document, isVideo = !m.photo && (m.video || m.animation || /^video\//.test(m.document?.mime_type || ''));
  if (f.file_size > 20e6) return send(chat, '⚠️ Файл больше 20 МБ — Telegram не даёт боту его скачать. Пришли покороче или сожми.', NEWS_KB(s.items.length));
  const info = await tg('getFile', { file_id: f.file_id }), dir = path.join(DATA_DIR, 'news_media'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, crypto.randomBytes(6).toString('hex') + (path.extname(info.file_path) || (isVideo ? '.mp4' : '.jpg')));
  fs.writeFileSync(file, Buffer.from(await (await fetch(`${TG_BASE}/file/bot${TOKEN}/${info.file_path}`)).arrayBuffer()));
  const media = { kind: isVideo ? 'video' : 'photo', file, credit: '' };
  if (m.caption?.trim()) { const got = await parseNewsInput(m.caption).catch(() => []); if (got.length) { got[0].media = [media]; s.items.push(...got); s.items = s.items.slice(0, 5); } }
  else if (s.items.length) { const it = s.items[s.items.length - 1]; (it.media ||= []).push(media); }
  else (s.pending ||= []).push(media);   // фото раньше новости — приложим к первой
  if (s.pending?.length && s.items.length) { (s.items[0].media ||= []).unshift(...s.pending); s.pending = []; }
  return send(chat, `${isVideo ? '🎬 Видео' : '📷 Фото'} принял${s.items.length ? ` — к новости «${esc(s.items[s.items.length - 1].title.slice(0, 60))}»` : ' — приложу к первой новости'}.`, NEWS_KB(s.items.length, s.items));
}
// ---------- голоса героев ----------
function showHeroVoices(chat, note = '') {
  const hv = heroVoices();
  return send(chat, `${note}🎙 <b>Голоса героев</b> (шаблоны Lumean)\n\n${Object.entries(HERO_KEYS).map(([k, [, label]]) => `${label}: ${hv[k] ? `<code>${esc(hv[k])}</code>` : '<i>основной голос</i>'}`).join('\n')}\n\nРеплики героя со своим голосом звучат его голосом (в новостях Сова читает и сами новости), все остальные — основным голосом.\nЧтобы поменять — выбери героя и пришли ID шаблона или ссылку на него.${LUMEAN ? '' : '\n\n⚠️ Нет ключа Lumean (LUMEAN_KEY) — голоса героев работают только через Lumean.'}`,
    { reply_markup: { inline_keyboard: [...Object.entries(HERO_KEYS).map(([k, [, label]]) => [{ text: `${label}: поменять`, callback_data: 'hv:ask:' + k }, ...(hv[k] ? [{ text: '▶️ Проба', callback_data: 'hv:test:' + k }] : [])])] } });
}
async function saveHeroVoice(chat, kind, id) {
  saveSecretsFromText(`${HERO_KEYS[kind][0]}=${id}`);
  await send(chat, `✅ ${HERO_KEYS[kind][1]}: голос <code>${esc(id)}</code> сохранён. Озвучиваю пробную фразу…`);
  return testHeroVoice(chat, kind);
}
async function testHeroVoice(chat, kind) {
  const id = heroVoices()[kind]; if (!LUMEAN || !id) return send(chat, '⚠️ Нет ключа Lumean или голоса у героя.');
  const phrase = { owl: 'Всем привет! В эфире Зверо-новости. С вами Сова.', mole: 'Привет! Я Крот. Я ничего не вижу, но всё слышу!', hamster: 'Привет! Это Хомяк. Сегодня считаем деньги.', raccoon: 'Привет! Я Енот, и я ищу подработку.', wolf: 'Привет! Я Волк. Работаю курьером.' }[kind];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-'));
  try {
    const r = await synthesize([phrase], { key: LUMEAN.key, template: id, dir }), ogg = path.join(dir, 'sample.ogg');
    await new Promise((res, rej) => { const p = spawn('ffmpeg', ['-y', '-v', 'error', '-i', r.file, '-c:a', 'libopus', '-b:a', '64k', ogg]); p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()); });
    const fd = new FormData(); fd.append('chat_id', String(chat)); fd.append('caption', `🎧 ${HERO_KEYS[kind][1]} — так звучит в роликах.`); fd.append('voice', await fs.openAsBlob(ogg, { type: 'audio/ogg' }), 'sample.ogg'); await tg('sendVoice', fd);
  } catch (e) { await send(chat, `❌ Lumean не озвучил этим шаблоном: <code>${esc(String(e.message).slice(0, 300))}</code>\n\nЕсли это ссылка «поделиться» — открой её в Lumean, сохрани шаблон себе и пришли ID из своих шаблонов.`); }
  finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
// ---------- раздел «Зверо-новости» в главном меню ----------
function newsMenu(chat) {
  return send(chat, `📰 <b>Зверо-новости</b>\n\nВыпуск по рубрикам: 🌟 звёзды · 🤖 нейросети · 🛒 новинки · 😂 тренд дня · 🏆 хорошие новости.\nВедут Сова и Крот, в начале — анонс с фото новостей.\n\n✍️ <b>Свои новости</b> — пришли текстом, ссылкой или с фото/видео.\n💡 <b>Подсказать</b> — бот найдёт свежие новости, выберешь нужные.`,
    { reply_markup: { inline_keyboard: [[{ text: '✍️ Вписать свои новости', callback_data: 'nw:start' }], [{ text: '💡 Подсказать свежие', callback_data: 'nw:feed' }], [{ text: '🎙 Голоса ведущих', callback_data: 'hv:menu' }]] } });
}
// свежие новости из ленты: тап — добавить в выпуск
async function newsFeed(chat) {
  const m = await send(chat, '🔎 Ищу свежие новости…');
  const list = await fetchNews(DATA_DIR).catch(() => []); tg('deleteMessage', { chat_id: chat, message_id: m.message_id }).catch(() => {});
  if (!list.length) return send(chat, 'Свежих новостей по нашим темам сейчас не нашлось — впиши свои.', { reply_markup: { inline_keyboard: [[{ text: '✍️ Вписать свои новости', callback_data: 'nw:start' }]] } });
  const s = sessions.get(chat)?.newsInput ? sessions.get(chat) : { newsInput: true, items: [] }; s.feed = list.slice(0, 8); sessions.set(chat, s);
  return send(chat, `💡 <b>Свежие новости</b> — нажми, чтобы добавить в выпуск:\n\n${s.feed.map((it, i) => `${i + 1}. ${NEWS_RUBRICS[it.rub]?.icon || '📰'} ${esc(it.title)}`).join('\n')}`,
    { reply_markup: { inline_keyboard: [...s.feed.map((it, i) => [{ text: `${i + 1}. ${it.title.slice(0, 50)}`, callback_data: 'nw:add:' + i }]), ...(s.items.length ? [[{ text: `✅ Собрать выпуск (${s.items.length})`, callback_data: 'nw:go' }]] : [])] } });
}
function startNews(chat, reset = false) { const cur = sessions.get(chat); sessions.set(chat, !reset && cur?.newsInput ? cur : { newsInput: true, items: [] });   // выбранные в «Подсказать» не теряются
  const it = sessions.get(chat).items; return send(chat, NEWS_HELP + (it.length ? `\n\n<b>Уже в выпуске:</b>\n${newsList(it)}` : ''), NEWS_KB(it.length, it)); }
async function newsDraft(chat, items) {
  items = items.length > 1 ? sortNews(items) : items;   // порядок выпуска — по рубрикам; фото привязываются к номеру новости в выпуске
  const m = await send(chat, `✍️ Пишу выпуск: ${items.length === 1 ? 'срочная новость' : items.length + ' новости'} · ищу фото…`);
  await collectMedia(items, path.join(DATA_DIR, 'news_media')).catch(e => console.error('news media', e.message));
  let script = newsScript(items);
  if (scriptGenReady()) { try { script = await generateShort({ name: 'Зверо-новости', draft: `${script}\n\nФакты новостей:\n${items.map((it, i) => `${i + 1}) [рубрика: ${NEWS_RUBRICS[it.rub]?.title || 'Главное'}] ${it.title}. ${it.body.join(' ')}`).join('\n')}`, fmt: 'news' }); } catch (e) { console.error('news gen', e.message); } }
  if (!/^всем привет/i.test(script)) script = 'Всем привет! В эфире Зверо-новости.\n' + script.replace(/^.*зверо-новост.*\n/i, '');
  if (loadChannel()?.username) script += '\n' + tgEnd(NEWS_GIFT).join('\n');
  const newsMedia = Object.fromEntries(items.map((it, i) => [i + 1, it.media || []]).filter(([, l]) => l.length)), seo = newsSeo(items);
  const credits = [...new Set(Object.values(newsMedia).flat().map(x => x.credit).filter(Boolean))]; if (credits.length) seo.about += '\n\n' + credits.join(' · ');
  const all = loadJ(draftFile(), {}); all[chat] = { title: '📰 ' + (items.length === 1 ? items[0].title : 'Зверо-новости: ' + items.length + ' новости'), script, gift: NEWS_GIFT, seo, topic: items.map(i => i.id).join('|'), newsMedia }; saveJ(draftFile(), all);
  tg('deleteMessage', { chat_id: chat, message_id: m.message_id }).catch(() => {});
  const nm = Object.values(newsMedia).flat(), ph = nm.filter(x => x.kind === 'photo').length, vd = nm.filter(x => x.kind === 'video').length;
  const dur = newsDuration(script), long = dur > 110 ? `⏱ Выпуск ≈ ${dur} с — длинновато для Shorts (лучше до 90–100 с). Убери новость или сократи текст.\n\n` : `⏱ Выпуск ≈ ${dur} с\n\n`;
  return showDraft(chat, long + (nm.length ? `🖼 В выпуске: ${ph ? `📷 фото — ${ph}` : ''}${ph && vd ? ', ' : ''}${vd ? `🎬 видео — ${vd}` : ''}\n\n` : '🖼 Фото не нашлось — во вставках будет мультик. Пришли своё фото к новости в /news.\n\n'));
}
function showDraft(chat, note = '') {
  const d = loadJ(draftFile(), {})[chat]; if (!d) return showRadar(chat);
  return send(chat, `${note}📝 <b>Сценарий</b> · ${esc(d.title)}\n<i>${d.script.split('\n').length} строк · ~${Math.round(d.script.length / 15)} с</i>\n\n<pre>${esc(d.script)}</pre>\n\n<i>Нажми на текст — он скопируется целиком. Поправь и пришли через «✏️ Исправить текст».</i>`, { reply_markup: { inline_keyboard: [
    [{ text: '✅ Собрать ролик', callback_data: 'dr:make' }],
    [{ text: '✏️ Исправить текст', callback_data: 'dr:edit' }, { text: '🔄 Другой вариант', callback_data: 'dr:again' }],
    ...(scriptGenReady() ? [[{ text: '🧠 Переписать по комментарию', callback_data: 'dr:ai' }]] : []),
    [{ text: '⬅️ К темам', callback_data: 'rd:list' }]] } });
}
function makeFromDraft(chat) {
  const d = loadJ(draftFile(), {})[chat]; if (!d) return showRadar(chat);
  if (d.topic) for (const id of d.topic.split('|')) markUsed(DATA_DIR, id);
  const all = loadJ(draftFile(), {}); delete all[chat]; saveJ(draftFile(), all);
  return enqueue(chat, { script: d.script, voice: hasVoice(), theme: 'ink', mascot: true, vertical: true, gift: d.gift, seoHints: d.seo, topic: d.topic, newsMedia: d.newsMedia || null });
}

// ---------- цифры: просмотры раз в день, отчёт по понедельникам, пригласительные ссылки по YouTube-каналам ----------
const seriesNames = () => Object.fromEntries(Object.entries(SERIES).map(([k, v]) => [k, v.name]));
async function statsRefresh() { const ch = loadChannel(); let members = null; if (ch) members = await tg('getChatMemberCount', { chat_id: ch.chat }).catch(() => null); return refreshStats(DATA_DIR, { tgMembers: members }); }
async function showInvites(chat) {
  const ch = await ensureChannel(); if (!ch) return send(chat, '📲 Сначала подключите Telegram-канал: /channel @адрес');
  let yt = []; try { yt = await listChannels(); } catch { /* каналы YouTube не подключены */ }
  const st = loadStats(DATA_DIR);
  for (const c of yt) if (!st.links[c.title]) { try { st.links[c.title] = (await tg('createChatInviteLink', { chat_id: ch.chat, name: c.title.slice(0, 32) })).invite_link; } catch (e) { return send(chat, `❌ Не смог создать ссылку: <code>${esc(e.message)}</code>\nДайте боту в канале право «Приглашать пользователей».`); } }
  saveStats(DATA_DIR, st);
  return send(chat, `🔗 <b>Ссылки на Telegram для каждого YouTube-канала</b>\n\nПоставьте каждую в шапку профиля своего канала (YouTube Studio → Настройка канала → Основные сведения → Ссылки). Бот будет считать, сколько людей пришло с каждого канала — это видно в /stats и в отчёте по понедельникам.\n\n${Object.entries(st.links).map(([n, l]) => `▫️ <b>${esc(n)}</b>\n<code>${l}</code>`).join('\n\n') || 'YouTube-каналы не подключены (/youtube)'}`);
}
function statsTick() {
  const { day, hm } = mskNow(), a = loadAP();
  if (hm === '09:00' && a.statsDay !== day) { a.statsDay = day; saveAP(a); statsRefresh().catch(e => console.error('stats', e.message)); }
  // радар тем каждое утро в 10:15 МСК — 10 тем на выбор
  if (hm === '10:15' && a.radarDay !== day && a.chat && a.radar !== false) { a.radarDay = day; saveAP(a); showRadar(a.chat, true).catch(e => console.error('radar', e.message)); }
  // отчёт по понедельникам в 10:05 МСК — в чат, где настроена фабрика
  if (hm === '10:05' && new Date(day).getUTCDay() === 1 && a.reportDay !== day && a.chat) { a.reportDay = day; saveAP(a); statsRefresh().then(({ st }) => send(a.chat, buildReport(st, seriesNames()), { disable_web_page_preview: true })).catch(e => console.error('report', e.message)); }
}
function apTick() {
  const a = loadAP(); if (!a.on || !a.chat) return; const { day, hm } = mskNow();
  // раз в день (10:00 МСК) проверяем доступ к каналам YouTube: сгоревший канал — напоминание с кнопкой, а не тихий провал публикации
  if (hm === '10:00' && a.ytChecked !== day && !missingSecrets().length) { a.ytChecked = day; saveAP(a);
    checkChannels().then(list => { const bad = list.filter(c => !c.ok); if (bad.length) send(a.chat, `⚠️ Доступ к каналам YouTube истёк: ${bad.map(c => esc(c.title)).join(', ')}.\nПереподключите (1 минута на канал), иначе фабрика не сможет выкладывать.`, { reply_markup: { inline_keyboard: [[{ text: '🔑 Переподключить', callback_data: 'ytc:link' }]] } }); }).catch(() => {}); }
  for (const t of AP_TIMES[a.perDay] || []) {
    const key = `${day} ${t}`, [h, m] = t.split(':').map(Number), [nh, nm] = hm.split(':').map(Number), late = (nh * 60 + nm) - (h * 60 + m);
    if (late >= 0 && late < 30 && !a.done[key]) { a.done = Object.fromEntries(Object.entries(a.done).filter(([k]) => k.startsWith(day))); a.done[key] = 1; saveAP(a); apMakeOne(a.chat, a).catch(e => console.error('autopilot', e)); }
  }
}
async function previewPost(chat, pid) {
  const pub = loadPub(pid); if (!pub?.tgFiles?.length) return send(chat, 'Видео для этого проекта не найдено — соберите ролик заново.');
  const ch = loadChannel(); if (!ch) return send(chat, '📣 Канал ещё не подключён: отправьте /channel.');
  return send(chat, `📣 <b>Пост для ${esc(ch.title || ch.chat)}</b>\n— — —\n${pub.tgCaption || buildPost(pid)}`, { reply_markup: { inline_keyboard: [[{ text: '✅ Опубликовать', callback_data: `tg:go:${pid}` }, { text: '✏️ Изменить текст', callback_data: `tg:edit:${pid}` }], [{ text: '✖️ Отмена', callback_data: 'tg:x' }]] } });
}

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
  const body = `<b>📥 Сценарий · ${STYLE_NAME[s.style] || STYLE_NAME.ham}</b>\n\nЧастей: <b>${s.parts.length}</b> · символов: <b>${text.length.toLocaleString('ru')}</b> · сцен: <b>${sc}</b>\n\nПрисылайте продолжение следующими сообщениями или <code>.txt</code> файлом.\nКогда всё отправлено — жмите «✅ Собрать ролик».`;
  if (s.msgId) { await tg('deleteMessage', { chat_id: chat, message_id: s.msgId }).catch(() => {}); }
  const m = await send(chat, body, { reply_markup: COLLECT_KB(s) }); s.msgId = m.message_id;
}

async function enqueue(chat, job) {
  const pos = queue.length + (busy ? 1 : 0);
  const m = await send(chat, `<b>🎬 Ролик принят в работу</b>\n${pos ? `⏳ Перед вами в очереди: ${pos}` : '⚙️ Начинаю…'}`);
  queue.push({ chat, msgId: m.message_id, ...job }); pump();
}

// текущая сборка на диске: если бот перезапустился посреди рендера, после старта предложим продолжить (озвучка и готовые куски сохранены)
const jobFile = () => path.join(DATA_DIR, 'job.json'), busyFile = () => path.join(DATA_DIR, 'busy');
const touchBusy = () => { try { fs.writeFileSync(busyFile(), String(Date.now())); } catch { /* не критично */ } };
async function offerResume() {
  const j = loadJ(jobFile(), null); if (!j?.chat) return;
  return send(j.chat, `⚠️ <b>Сборка ролика прервалась</b>${j.title ? ` («${esc(j.title)}»)` : ''} — бот перезапускался.\nОзвучка и готовые куски сохранены: продолжу с места сбоя, без повторной оплаты озвучки.`,
    { reply_markup: { inline_keyboard: [[{ text: '▶️ Продолжить сборку', callback_data: 'job:resume' }], [{ text: '✖️ Отменить', callback_data: 'job:drop' }]] } });
}
async function pump() {
  if (busy || !queue.length) return;
  busy = true;
  const job = queue.shift(), outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-out-')), out = path.join(outDir, 'motion.mp4');
  const t0 = Date.now(); let last = 0, header = '<b>🎬 Собираю ролик</b>';
  const status = (lines, force) => { const now = Date.now(); if (!force && now - last < 3500) return; last = now; edit(job.chat, job.msgId, `${header}\n\n${lines}\n\n⏱ ${fmtTime((now - t0) / 1000)}`); };
  job.newId ||= job.projectId ? null : crypto.randomBytes(5).toString('hex'); job.seed ??= Math.floor(Math.random() * 2 ** 31);
  saveJ(jobFile(), { ...job, msgId: undefined, title: job.seoHints?.title || job.script.split('\n')[0].slice(0, 60) }); touchBusy();
  const busyTimer = setInterval(touchBusy, 30000);
  try {
    let jobVoice = job.voice ? voiceCfg() : null;
    // голоса героев (Lumean): реплики Совы и Волка — их голосами, остальное — основным
    if (jobVoice && jobVoice.provider !== 'voicestudio') jobVoice = { ...jobVoice, heroes: heroVoices() };
    if (jobVoice?.provider === 'voicestudio' && !(await voiceStudioAlive(jobVoice))) {
      if (LUMEAN) { jobVoice = LUMEAN; await send(job.chat, `⚠️ VoiceStudio ${VS_LOCAL() ? 'на сервере' : 'на компьютере'} не отвечает — озвучиваю через Lumean.`); }
      else throw new Error(`VoiceStudio не отвечает. ${VS_DOWN().replace(/<[^>]+>/g, '')}`);
    }
    const r = await makeVideo(job.script, {
      out, voice: job.voice ? jobVoice : null, projectId: job.projectId || null, newId: job.newId || null, seed: job.seed ?? null, vertical: !!job.vertical,
      theme: job.theme || null, mascot: !!job.mascot, offer: job.offer || null, tg: loadChannel()?.username ? { ...loadChannel(), promise: job.gift?.promise } : null, seoHints: job.seoHints || null, candy: job.candy ?? null, newsMedia: job.newsMedia || null,
      onStage: (st, info = {}) => {
        if (st === 'voice') status(`🎙 Озвучка ${info.status === 'VoiceStudio' ? 'вашим голосом' : 'Lumean'}${info.parts > 1 ? ` · часть ${info.part}/${info.parts}` : ''}\n${bar((info.percent || 0) / 100)} ${info.percent || 0}%`, true);
        if (st === 'screens') status(`📸 Открываю и снимаю сайт ${esc(info.domain || '')}…`, true);
        if (st === 'render') { header = `<b>🎬 Собираю ролик</b>\n<i>${esc(describeStyle(info.style))}</i>`; status(`🎞 Сцен: ${info.scenes}\n${bar(0)} 0%`, true); }
      },
      onProgress: p => status(`🎞 Рендер кадров\n${bar(p)} ${Math.round(p * 100)}%`, p >= 1),
    });
    await status('📤 Отправляю…', true);
    const total = r.files.length, pid = r.vertical ? r.id + 's' : r.id, tgFiles = [];
    for (const [i, f] of r.files.entries()) {
      const fd = new FormData();
      fd.append('chat_id', String(job.chat)); fd.append('supports_streaming', 'true'); fd.append('width', r.vertical ? '1080' : '1920'); fd.append('height', r.vertical ? '1920' : '1080'); fd.append('parse_mode', 'HTML');
      const head = total > 1 ? `<b>Часть ${i + 1}/${total}</b>\n` : '';
      const last = i === total - 1;
      fd.append('caption', last
        ? `${head}<b>${r.vertical ? '📱 Shorts готов' : '🎬 Моушн-ролик готов'}</b>\n${r.scenes.length} сцен · ${fmtTime(r.duration)}${r.voiced ? ' · 🎙 озвучка' : ''} · 🔊 ${r.sfx.count} звуков\n<i>${esc(describeStyle(r.style))}</i>\nПроект <code>${r.id}</code> · seed <code>${r.seed}</code> · сборка ${fmtTime((Date.now() - t0) / 1000)}`
        : head);
      if (last) fd.append('reply_markup', JSON.stringify(AFTER_KB(r.id, pid)));
      fd.append('video', await fs.openAsBlob(f, { type: 'video/mp4' }), total > 1 ? `motion_part${i + 1}.mp4` : 'motion.mp4');
      const sent = await tg('sendVideo', fd); if (sent?.video?.file_id) tgFiles.push(sent.video.file_id);   // по file_id ролик потом уходит в канал без повторной загрузки
    }
    await tg('deleteMessage', { chat_id: job.chat, message_id: job.msgId }).catch(() => edit(job.chat, job.msgId, '✅ Готово'));
    // полный файл (без нарезки) сохраняем для загрузки на YouTube; Shorts — отдельной карточкой публикации (<id>s)
    const pdir = path.join(DATA_DIR, 'projects', pid); fs.mkdirSync(pdir, { recursive: true });
    fs.copyFileSync(r.file, path.join(pdir, 'video.mp4'));
    // обложки: три варианта одним альбомом
    if (r.thumbs?.length) {
      const fd = new FormData(); fd.append('chat_id', String(job.chat));
      fd.append('media', JSON.stringify(r.thumbs.map((f, i) => ({ type: 'photo', media: `attach://t${i}`, ...(i === 0 ? { caption: '🖼 <b>Обложки</b> — выберите в карточке публикации, бот поставит её на YouTube', parse_mode: 'HTML' } : {}) }))));
      for (const [i, f] of r.thumbs.entries()) fd.append(`t${i}`, await fs.openAsBlob(f, { type: 'image/jpeg' }), `thumb_${i + 1}.jpg`);
      await tg('sendMediaGroup', fd).catch(e => console.error('thumbs', e.message));
    }
    const pub = loadPub(pid) || {}; savePub(pid, { ...r.seo, privacy: DEFAULT_PRIVACY, selected: lastSelected(), thumb: r.thumbs?.length ? 1 : 0, ...pub, ...(pub.title ? {} : r.seo), tgFiles, tgCaption: loadChannel() ? await videoPost({ script: job.script, gift: job.gift, series: job.gift?.series || job.seoHints?.series, offer: job.offer, pid }).catch(e => { console.error('post', e.message); return null; }) : null, series: job.seoHints?.series || null , topic: job.topic || null });
    await showPublish(job.chat, pid);
    if (job.pack === true && !r.vertical) {
      if (loadChannel()) await previewPost(job.chat, pid);
      await enqueue(job.chat, { script: job.script, voice: job.voice, theme: job.theme, mascot: job.mascot, offer: job.offer, projectId: r.id, seed: r.seed, vertical: true, pack: 'short' });
    }
    if (job.auto) {
      if (job.auto.mode === 'auto') {
        const pool = lastSelected(), a = loadAP();
        if (pool.length) { const p = loadPub(pid); p.selected = [pool[a.rr % pool.length]]; a.rr = (a.rr || 0) + 1; saveAP(a); savePub(pid, p); await publish(job.chat, pid); }
        else await send(job.chat, '⚠️ Shorts-фабрика: не выбраны каналы YouTube — отметьте каналы в карточке публикации, бот запомнит их.');
        if (loadChannel()) await postToChannel(job.chat, pid);
      } else if (loadChannel()) await previewPost(job.chat, pid);
    }
    if (job.pack === 'short') await send(job.chat, '📦 <b>Пакет готов</b>: ролик, Shorts, обложки, карточки YouTube' + (loadChannel() ? ' и пост в канал.' : '.') + '\nОсталось нажать «Опубликовать» в карточках.');
  } catch (e) {
    console.error(e);
    await edit(job.chat, job.msgId, `<b>❌ Не удалось собрать ролик</b>\n\n<code>${esc(String(e.message).slice(0, 500))}</code>`, { reply_markup: MENU() });
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
    cleanupVideos();
    clearInterval(busyTimer); fs.rmSync(busyFile(), { force: true }); fs.rmSync(jobFile(), { force: true });
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

// текст комментария автора: зовём в обсуждение и отметить друга, напоминаем про подарок (ссылки в комментариях YouTube режет — ведём в профиль)
function authorComment(p) {
  const ch = loadChannel(), hero = /Ёж/.test(p.description || '') && !/Крот/.test(p.description || '') ? 'Ежа' : 'Крота';
  // свой вопрос у форматов: новости — «что разобрать», Енот и Волк — «отметь друга»
  const any = a => a[Math.floor(Math.random() * a.length)];
  const ask = p.series === 'news' ? any(['Какая новость удивила больше всего? Пиши 👇', 'Какую новость разобрать в следующем выпуске? Пиши в комментарии 👇']) : p.series === 'topic:ref' ? any(['Отметь друга, которому нужна работа 👇', 'Ты больше Волк или Енот? 👇']) : [`Отметь своего ${hero} 👇 Пусть посмотрит 😅`, `А у тебя есть такой ${hero.replace(/а$/, '')}? Отметь его 👇`, 'Узнал себя? Пиши «я Крот» или «я Белка» 👇'][Math.floor(Math.random() * 3)];
  const gift = p.promise || (p.description || '').match(/🎁 ([^—\n]+)/)?.[1]?.trim();
  return `${ask}${ch?.username ? `\n\n🎁 ${gift ? gift + ' — ' : ''}забирай бесплатно в нашем Telegram «${ch.title || 'Хомяк на Трафике'}» — ссылка в шапке профиля (или найди @${ch.username})` : ''}`;
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
        // комментарий автора: зовём отметить друга (комментарии двигают ролик) и напоминаем про подарок в Telegram
        if (p.authorComment !== false) await postComment(c.id, r.id, authorComment(p)).then(() => { lines[i] += ' · 💬 комментарий'; }).catch(e => { lines[i] += ` · ⚠️ комментарий: ${esc(String(e.message).slice(0, 100))}`; });
        recordVideo(DATA_DIR, { id: r.id, conn: c.id, channel: c.title, pid: id, series: p.series || null, topic: p.topic || null, title: p.title });
        const tf = p.thumb && path.join(DATA_DIR, 'projects', id, `thumb_${p.thumb}.jpg`);
        if (tf && fs.existsSync(tf)) await setThumbnail(c.id, r.id, tf).then(() => { lines[i] += ' · 🖼 обложка'; }).catch(e => { lines[i] += ` · ⚠️ обложка не встала: ${esc(String(e.message).slice(0, 120))}`; });
      }
      catch (e) { lines[i] = `❌ ${esc(c.title)} — ${esc(String(e.message).slice(0, 200))}`; }
      await edit(chat, m.message_id, `<b>🚀 Публикация на YouTube</b>\n${lines.join('\n')}`);
    }
    // всё ушло на YouTube — файл больше не нужен, место на сервере освобождаем сразу (в Telegram ролик живёт по file_id)
    if (lines.every(l => l.startsWith('✅'))) { try { fs.rmSync(file); } catch { /* уже удалён */ } }
    const expired = lines.some(l => /истёк|отозван/.test(l));   // доступ к каналу сгорел — сразу даём переподключить
    await edit(chat, m.message_id, `<b>📺 Публикация завершена</b>\n${lines.join('\n')}`, { disable_web_page_preview: true, reply_markup: { inline_keyboard: [...(expired ? [[{ text: '🔑 Переподключить канал', callback_data: 'ytc:link' }]] : []), [{ text: '🎬 Новый ролик', callback_data: 'menu' }]] } });
  }).catch(e => console.error('upload', e));
}

// образец голоса из Telegram -> лучший фрагмент -> профиль-клон в VoiceStudio -> выбран для озвучки -> пробная фраза
async function cloneFromTelegram(chat, f) {
  const vs = VSTUDIO(); if (!(await voiceStudioAlive(vs))) throw new Error(VS_LOCAL() ? 'Сервис озвучки на сервере ещё запускается — повторите /clone через 10–15 минут.' : 'VoiceStudio не отвечает — запустите программу и включите Tailscale.');
  const m = await send(chat, '🎙 Готовлю образец…');
  const dir = path.join(DATA_DIR, 'voice'); fs.mkdirSync(dir, { recursive: true });
  const info = await tg('getFile', { file_id: f.file_id }), ext = (path.extname(info.file_path) || '.mp3').toLowerCase();
  const orig = path.join(dir, 'reference_original' + ext), ref = REF_WAV();
  fs.writeFileSync(orig, Buffer.from(await (await fetch(`${TG_BASE}/file/bot${TOKEN}/${info.file_path}`)).arrayBuffer()));
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
  return (await (await fetch(`${TG_BASE}/file/bot${TOKEN}/${f.file_path}`)).text()).trim();
}

async function onUpdate(u) {
  // кто-то вступил в канал по нашей пригласительной ссылке — считаем, с какого YouTube-канала пришёл
  if (u.chat_member) { const cm = u.chat_member; if (['member', 'restricted'].includes(cm.new_chat_member?.status) && ['left', 'kicked'].includes(cm.old_chat_member?.status) && cm.invite_link?.name) recordJoin(DATA_DIR, cm.invite_link.name); return; }
  if (u.callback_query) {
    const q = u.callback_query, chat = q.message.chat.id, data = q.data || '';
    tg('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
    if (!allowed(q.from)) return send(chat, '⛔ Нет доступа.');
    if (data === 'help') return send(chat, HELP, { reply_markup: MENU() });
    if (data === 'job:resume') { const j = loadJ(jobFile(), null); fs.rmSync(jobFile(), { force: true }); if (!j) return send(chat, 'Нечего продолжать — всё уже собрано.'); return enqueue(chat, j); }
    if (data === 'job:drop') { fs.rmSync(jobFile(), { force: true }); return send(chat, 'Ок, отменил.'); }
    if (data === 'rd:new' || data === 'radar') return showRadar(chat, true);
    if (data === 'rd:list') return showRadar(chat, false);
    if (data === 'trash') return send(chat, '🗑 <b>Мусор</b> — всё, что нужно редко.', { reply_markup: TRASH() });
    if (data === 'news') return newsMenu(chat);
    if (data === 'nw:feed') return newsFeed(chat);
    if (data === 'hv:menu') return showHeroVoices(chat);
    const nwa = /^nw:add:(\d+)$/.exec(data);
    if (nwa) { const s = sessions.get(chat), it = s?.feed?.[+nwa[1]]; if (!it) return newsFeed(chat); if (!s.items.some(x => x.id === it.id)) s.items.push(it); s.items = s.items.slice(0, 5);
      return send(chat, `✅ В выпуске (${s.items.length}/5):\n${newsList(s.items)}\n\nДобавь ещё, впиши свою или собирай.${NEWS_RUB_HINT}`, NEWS_KB(s.items.length, s.items)); }
    if (data === 'nw:start') return startNews(chat);
    if (data === 'nw:reset') return startNews(chat, true);
    const nwr = /^nw:rub:(\d+):(\w+)$/.exec(data);
    if (nwr) { const s = sessions.get(chat), it = s?.items?.[+nwr[1]]; if (!it || !NEWS_RUBRICS[nwr[2]]) return startNews(chat); it.rub = nwr[2]; return send(chat, `${NEWS_RUBRICS[it.rub].icon} Рубрика: <b>${NEWS_RUBRICS[it.rub].title}</b>\n\n${newsList(s.items)}`, NEWS_KB(s.items.length, s.items)); }
    const hvm = /^hv:(ask|test|set):(\w+)$/.exec(data);
    if (hvm && HERO_KEYS[hvm[2]]) {
      if (hvm[1] === 'test') return testHeroVoice(chat, hvm[2]);
      if (hvm[1] === 'set') { const id = sessions.get(chat)?.pickVoice; sessions.delete(chat); return id ? saveHeroVoice(chat, hvm[2], id) : showHeroVoices(chat); }
      sessions.set(chat, { heroVoice: hvm[2] }); return send(chat, `🎙 Пришли ID шаблона Lumean или ссылку на него для: ${HERO_KEYS[hvm[2]][1]}`);
    }
    if (data === 'nw:go') { const s = sessions.get(chat); if (!s?.items?.length) return startNews(chat); sessions.delete(chat); return newsDraft(chat, s.items).catch(e => send(chat, `❌ Не получилось: <code>${esc(String(e.message).slice(0, 300))}</code>`)); }
    const rdi = /^rd:(\d+)$/.exec(data); if (rdi) return makeDraft(chat, +rdi[1]).catch(e => send(chat, `❌ Не получилось написать сценарий: <code>${esc(String(e.message).slice(0, 300))}</code>`));
    if (data === 'dr:make') return makeFromDraft(chat);
    if (data === 'dr:again') { const d = loadJ(draftFile(), {})[chat]; return d ? makeDraft(chat, d.i) : showRadar(chat); }
    if (data === 'dr:edit') { sessions.set(chat, { editDraft: true }); return send(chat, '✏️ Пришли исправленный сценарий целиком одним сообщением (скопируй текст выше, поправь и отправь). Одна строка — одна сцена.'); }
    if (data === 'dr:ai') { sessions.set(chat, { aiDraft: true }); return send(chat, '🧠 Напиши, что поменять: например, «смешнее концовку», «больше Ежа», «короче на 5 строк».'); }
    const vsv = /^vs:v:(.+)$/.exec(data);
    if (vsv) { saveSecretsFromText(`VOICESTUDIO_VOICE=${vsv[1]}`); return showVoices(chat, '🎙 Голос выбран — все ролики «С озвучкой» будут им.\n\n'); }
    if (data === 'ai:key') { sessions.set(chat, { awaitSecrets: true }); return send(chat, '🔑 <b>Ключ API нейросети</b>\n\nПришлите одним сообщением (бот сразу его удалит):\n<code>ANTHROPIC_API_KEY=ваш_ключ</code>\n\nЕсли сервер в России — добавьте второй строкой адрес посредника, который выдал ключ:\n<code>ANTHROPIC_BASE_URL=https://…</code>'); }
    if (data === 'gen') return send(chat, '🗂 <b>Рубрика ролика</b>\n\nЧередуйте рубрики — так канал не надоедает.' + (scriptGenReady() ? '' : '\n<i>«🎙 Блог: разбор сайта» работает и без ключа нейросети — по шаблону.</i>'), { reply_markup: RUBRIC_KB() });
    if (data === 'gen:r:blog') {
      sessions.set(chat, { awaitBlog: true });
      const o = loadOffer(), dom = o?.link && (() => { try { return new URL(o.link).hostname.replace(/^www\./, ''); } catch { return ''; } })();
      return send(chat, `🎙 <b>Блог: разбор сайта</b>\n\nПришлите адрес сайта, который разбираем${dom ? ` (например, <code>${esc(dom)}</code>)` : ''}. Можно добавить пожелания одной строкой ниже.\n\nХомяк поздоровается в студии, объяснит рефералы на анимации, бот сам снимет сайт и обведёт кнопку регистрации, в конце — сцена со ссылкой.`);
    }
    const rb = /^gen:r:(\w+)$/.exec(data);
    if (data === 'gen' || rb) {
      if (!scriptGenReady()) { sessions.set(chat, { awaitSecrets: true }); return send(chat, '🔑 <b>Нужен ключ API нейросети</b>\n\nПришлите одним сообщением (бот сразу его удалит):\n<code>ANTHROPIC_API_KEY=ваш_ключ</code>\n\nЕсли сервер в России — добавьте второй строкой адрес посредника, который выдал ключ:\n<code>ANTHROPIC_BASE_URL=https://…</code>'); }
      sessions.set(chat, { awaitTopic: true, rubric: rb && rb[1] !== 'any' ? rb[1] : null }); return send(chat, '✨ <b>О чём ролик?</b>\n\nНапишите тему и, если хотите, пожелания. Например:\n<i>как кэшбэк экономит 20 000 в год</i>\n<i>почему зарплата «исчезает» за неделю</i>');
    }
    if (data === 'gen:again') { const gg = gens.get(chat); if (!gg) return send(chat, 'Начните заново: «✨ Сценарий по теме».', { reply_markup: MENU() }); return runGen(chat, { ...gg, variant: gg.variant + 1 }); }
    const tgc = /^tg:(post|go|edit):([a-f0-9]+s?)$/.exec(data);
    if (tgc) {
      const [, act, pid] = tgc;
      if (act === 'post') return previewPost(chat, pid);
      if (act === 'edit') { sessions.set(chat, { editTg: pid }); return send(chat, '✏️ Пришлите новый текст поста целиком (до 1000 символов). Можно с <b>жирным</b> и ссылками.'); }
      return postToChannel(chat, pid);
    }
    if (data === 'ap') return showAP(chat);
    const apc = /^ap:(on|mode|radar|now|n|s):?(\w*)$/.exec(data);
    if (apc) {
      const a = loadAP(), [, act, arg] = apc; a.chat = chat;
      if (act === 'on') a.on = !a.on;
      if (act === 'mode') a.mode = a.mode === 'auto' ? 'review' : 'auto';
      if (act === 'radar') a.radar = a.radar === false;
      if (act === 'n') a.perDay = Number(arg) || 2;
      if (act === 's') a.series = a.series.includes(arg) ? a.series.filter(x => x !== arg) : [...a.series, arg];
      saveAP(a);
      if (act === 'now') return apMakeOne(chat, a);
      return tg('editMessageText', { chat_id: chat, message_id: q.message.message_id, text: apText(a), parse_mode: 'HTML', reply_markup: AP_KB(a) }).catch(() => showAP(chat));
    }
    if (data === 'pin:go') {
      const ch = loadChannel(); if (!ch) return send(chat, 'Сначала подключите канал: /channel @адрес');
      try { const pm = await tg('sendMessage', { chat_id: ch.chat, text: pinText(), parse_mode: 'HTML', disable_web_page_preview: true }); await tg('pinChatMessage', { chat_id: ch.chat, message_id: pm.message_id, disable_notification: true }).catch(e => send(chat, `⚠️ Пост опубликован, но не закреплён: дайте боту право «Закреплять сообщения».`)); return send(chat, '📌 Закреп опубликован в канале.'); }
      catch (e) { return send(chat, `❌ <code>${esc(String(e.message).slice(0, 300))}</code>`); }
    }
    if (data === 'tg:x') return edit(chat, q.message.message_id, '✖️ Публикация в канал отменена.');
    if (data === 'blog:again') { const gg = gens.get(chat); if (!gg?.blog) return send(chat, 'Начните заново: «✨ Сценарий по теме» → «🎙 Блог».', { reply_markup: MENU() }); return runBlog(chat, gg.blog); }
    if (data === 'gen:make') { const gg = gens.get(chat); if (!gg) return send(chat, 'Сценарий не найден — сгенерируйте заново.', { reply_markup: MENU() }); const s = newSession('ham', { parts: [gg.script], offer: !!gg.offer && !!loadOffer(), replaceNext: true }); sessions.set(chat, s); return showCollect(chat, s); }
    // «⭐»: текущий сценарий (с правками автора) -> свой формат + образец стиля для нейросети
    if (data === 'fmt:save') {
      const gg = gens.get(chat) || {}, cur = sessions.get(chat)?.parts?.slice(-1)[0] || gg.script; if (!cur) return send(chat, 'Сначала получите сценарий.');
      const b = gg.blog || {}, lines = learnFormat(cur, { site: b.site, facts: b.facts, offer: loadOffer() }), list = loadFormats(), id = Date.now().toString(36);
      list.push({ id, name: `Мой формат ${list.length + 1}`, lines }); saveFormats(list);
      const st = loadStyle(); st.examples.push(cur); saveStyle(st);
      return send(chat, `⭐ <b>Сохранено как «Мой формат ${list.length}»</b>\nБот будет чередовать его с другими форматами для любых сайтов. Сайт, кнопка и заголовок стали заготовками:\n\n<code>${esc(lines.join('\n').slice(0, 1500))}</code>\n\nСписок и удаление — /formats.`);
    }
    if (data === 'gen:rewrite') { sessions.set(chat, { ...(sessions.get(chat) || {}), awaitRewrite: true }); return send(chat, '✏️ Что поменять? Например: <i>сделай живее, добавь шутку, короче вступление</i>'); }
    const fd = /^fmt:del:(\w+)$/.exec(data);
    if (fd) { saveFormats(loadFormats().filter(f => f.id !== fd[1])); return showFormats(chat, '🗑 Формат удалён.\n\n'); }
    if (data === 'fmt:add') { sessions.set(chat, { awaitFormat: true }); return send(chat, `➕ <b>Новый формат</b>\n\nПришлите сценарий-шаблон: одна строка — одна сцена. Первой строкой можно написать <code>Название: …</code>.\n\nЗаготовки: <code>{сайт}</code> <code>{бренд}</code> <code>{заголовок}</code> <code>{разделы}</code> <code>{кнопка}</code> <code>{цифры}</code> <code>{выгоды}</code> <code>{ссылка}</code>\nВарианты фразы — через <code> | </code>, бот выберет случайно.\n\nПример:\n<code>Название: Быстрый разбор\nЙо, ребят! Хомяк на связи. | Привет, друзья! С вами Хомяк.\nСегодня смотрим {бренд} — стоит ли оно того?\nЗаходим на {сайт}.\nВидишь «{кнопка}»? Жмём!\n{ссылка}\nПодписывайся!</code>`); }
    if (data === 'style:clear') { saveStyle({ rules: [], examples: [] }); return send(chat, '🧹 Правила и образцы стиля очищены.'); }
    if (data === 'style:add') { sessions.set(chat, { awaitStyle: true }); return send(chat, '✍️ Пришлите правила — каждое с новой строки. Например:\n<i>всегда шути про трафик\nне используй слово «короче»\nв конце задавай зрителю вопрос</i>'); }
    if (data === 'offer') return send(chat, `🏷 <b>Рекламное предложение</b>\n\n${offerText(loadOffer())}\n\nЧтобы задать или изменить, пришлите одним сообщением (любые строки):\n<code>НАЗВАНИЕ=Дебетовая карта с кэшбэком\nССЫЛКА=https://ваша-партнёрская-ссылка\nERID=токен из кабинета партнёрки\nРЕКЛАМОДАТЕЛЬ=ООО «…», ИНН …\nВЫГОДЫ=Кэшбэк до 5%; Обслуживание 0 ₽; Доставка бесплатно\nНАДПИСЬ=КЭШБЭК\nЦВЕТ=#1f8f5f</code>\n\nВ ролике с рекламой: сцена с картой, «ссылка в описании», маркировка «Реклама. … erid» в кадре и в описании, ссылка с меткой ролика (subid).`,
      { reply_markup: { inline_keyboard: [[{ text: '✏️ Задать / изменить', callback_data: 'offer:edit' }], ...(loadOffer() ? [[{ text: '🗑 Удалить', callback_data: 'offer:del' }]] : [])] } });
    if (data === 'prod:add') { sessions.set(chat, { awaitProduct: true }); return send(chat, 'Пришлите товар одним сообщением (пример — в /products).'); }
    if (data.startsWith('prod:del:')) { const id = data.slice(9); fs.writeFileSync(productsFile(), JSON.stringify(loadProducts().filter(p => p.id !== id), null, 1)); return showProducts(chat, '🗑 Удалено\n\n'); }
    if (data === 'offer:edit') { sessions.set(chat, { awaitOffer: true }); return send(chat, 'Пришлите строки предложения (см. пример выше).'); }
    if (data === 'offer:del') { fs.rmSync(offerFile(), { force: true }); return send(chat, '🗑 Предложение удалено.', { reply_markup: MENU() }); }
    if (data === 'voice') { const v = voiceCfg(); return send(chat, `🎙 <b>Озвучка</b>: ${v ? (v.provider === 'voicestudio' ? `VoiceStudio, голос <code>${esc(v.voice)}</code>` : `Lumean, шаблон <code>${esc(v.template)}</code>`) : 'не настроена'}${v?.provider === 'voicestudio' ? '\n\nСменить голос: /voicestudio · новый клон: /clone' : ''}`, { reply_markup: MENU() }); }
    if (data === 'menu') return send(chat, '<b>🎬 Моушн-студия</b>\n\nВыберите режим и пришлите сценарий.', { reply_markup: MENU() });
    if (data === 'make' || data === 'make_voice' || data === 'make:ham' || data === 'make:neon') {
      const s = newSession(data === 'make:neon' ? 'neon' : 'ham'); if (data === 'make') s.mode = 'plain'; sessions.set(chat, s);
      const m = await send(chat, `<b>✍️ Пришлите сценарий · ${STYLE_NAME[s.style]}</b>${s.style === 'ham' ? '\n<i>Хомяк сыграет каждую фразу с действием или местом; цифры и графики останутся инфографикой.</i>' : ''}\n\nТекстом или <code>.txt</code> файлом. Длинный сценарий можно отправить несколькими сообщениями подряд — я соберу их вместе.`, { reply_markup: { inline_keyboard: [[{ text: '🗑 Отменить', callback_data: 'collect:cancel' }]] } });
      s.msgId = m.message_id; return;
    }
    const tog = /^collect:(voice|style|fmt|offer)$/.exec(data);
    if (tog) {
      const s = sessions.get(chat); if (!s?.parts) return;
      if (tog[1] === 'voice') s.mode = s.mode === 'voice' ? 'plain' : 'voice';
      if (tog[1] === 'style') s.style = s.style === 'neon' ? 'ham' : 'neon';
      if (tog[1] === 'fmt') s.vertical = !s.vertical;
      if (tog[1] === 'offer') s.offer = !s.offer;
      return tg('editMessageReplyMarkup', { chat_id: chat, message_id: q.message.message_id, reply_markup: COLLECT_KB(s) }).catch(() => {});
    }
    if (data === 'collect:cancel') { sessions.delete(chat); return edit(chat, q.message.message_id, 'Отменено.', { reply_markup: MENU() }); }
    if (data === 'collect:done' || data === 'collect:pack') {
      const s = sessions.get(chat); if (!s?.parts?.length) return send(chat, 'Сценарий пустой — пришлите текст.');
      clearTimeout(s.timer); sessions.delete(chat); await tg('deleteMessage', { chat_id: chat, message_id: q.message.message_id }).catch(() => {});
      const offer = s.offer ? loadOffer() : null, script = offer ? withOfferLine(s.parts.join('\n\n'), offer) : s.parts.join('\n\n');
      // «📦 Всё сразу»: ролик 16:9 → обложки и карточка YouTube → пост в канал → Shorts из того же проекта (озвучка не оплачивается повторно)
      const pack = data === 'collect:pack';
      if (pack) await send(chat, `📦 <b>Делаю весь пакет</b>\n1. Ролик 16:9 + 3 обложки + название и описание для YouTube\n2. ${loadChannel() ? 'Пост в Telegram-канал (на проверку)' : 'Пост в канал — подключите канал командой /channel'}\n3. Shorts 9:16 из того же ролика`);
      return enqueue(chat, { script, voice: s.mode === 'voice', theme: s.style === 'neon' ? 'neon' : 'ink', mascot: s.style !== 'neon', vertical: pack ? false : !!s.vertical, offer, pack });
    }
    if (data === 'ytc:check') return showYT(chat);
    if (data === 'ytc:link') {
      if (missingSecrets().length) return send(chat, '⚠️ Сначала нужны ключи OAuth: нажмите «🔑 Подключить каналы» в карточке публикации.');
      sessions.set(chat, { awaitYtCode: true });
      return send(chat, `🔑 <b>Подключение канала YouTube</b>\n\n1. Откройте ссылку и войдите в Google-аккаунт канала (если каналов несколько — выберите нужный):\n${authUrl()}\n\n2. Разрешите доступ. Google предупредит «приложение не проверено» — это ваше приложение: «Дополнительные настройки» → «Перейти».\n3. Откроется страница «✅ Почти готово» — нажмите <b>«Скопировать код»</b> и пришлите код сюда.\n\nКаждый канал подключается отдельно: повторите для всех.`);
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
    if (VS_LOCAL()) return send(chat, `⚠️ <b>Сервис озвучки на сервере не отвечает.</b>\n${VS_DOWN()}`);
    sessions.set(chat, { awaitSecrets: true });
    return send(chat, '🎙 <b>Подключение VoiceStudio</b>\n\nПришлите одним сообщением адрес программы (из её настроек сети / Tailscale), при необходимости — токен:\n<code>VOICESTUDIO_URL=http://100.x.y.z:порт</code>\n<code>VOICESTUDIO_TOKEN=…</code>\n\nПотом бот покажет ваши голоса — выберите клон.');
  }
  // какие ключи сохранены (без значений) и видит ли бот каналы — ключи лежат в data/secrets.env и переживают перезапуски и обновления
  if (m.text && /^\/channel/.test(m.text)) {
    const ch = loadChannel(), arg = m.text.split(/\s+/)[1];
    if (!arg) return send(chat, `📣 <b>Telegram-канал</b>: ${ch ? esc(ch.title) + (ch.username ? ' (@' + esc(ch.username) + ')' : '') : 'не подключён'}\n\nПодключить: добавьте бота администратором канала с правом «Публикация сообщений» и отправьте:\n<code>/channel @адрес_канала</code>`);
    try {
      const c = await tg('getChat', { chat_id: arg.startsWith('@') || arg.startsWith('-') ? arg : '@' + arg });
      const me = await tg('getChatMember', { chat_id: c.id, user_id: BOT_ID });
      if (me.status !== 'administrator' || me.can_post_messages === false) return send(chat, '⚠️ Бот не администратор этого канала или у него нет права публиковать сообщения. Канал → Администраторы → добавить бота → «Публикация сообщений».');
      fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(channelFile(), JSON.stringify({ chat: c.id, title: c.title, username: c.username || '' }));
      return send(chat, `✅ Канал подключён: <b>${esc(c.title)}</b>\nТеперь под каждым роликом есть кнопка «📣 В Telegram-канал».`);
    } catch (e) { return send(chat, `❌ Не нашёл канал: <code>${esc(String(e.message).slice(0, 200))}</code>\nПроверьте адрес и что бот добавлен в канал.`); }
  }
  if (m.text && /^\/version/.test(m.text)) { let v = 'неизвестно (VERSION нет — сервер ещё не пересобрался новым update.sh)'; try { v = fs.readFileSync(path.resolve('VERSION'), 'utf8').trim(); } catch { /* старая сборка */ } return send(chat, `🛠 <b>Версия бота</b>: <code>${esc(v)}</code>\n\nВ этой версии: переходы «вжух», жесты Хомяка, 18 локаций по теме, удержание Shorts, посты-дропы, /stats, /youtube, «Оффер дня».`); }
  if (m.text && /^\/stats/.test(m.text)) { const w = await send(chat, '📊 Собираю цифры…'); const { st, errors } = await statsRefresh(); return edit(chat, w.message_id, buildReport(st, seriesNames()) + (errors.length ? `\n\n⚠️ Не все каналы отдали статистику: ${esc(errors[0].slice(0, 150))}` : ''), { disable_web_page_preview: true }); }
  if (m.text && /^\/invites/.test(m.text)) return showInvites(chat);
  if (m.text && /^\/youtube/.test(m.text)) return showYT(chat);
  if (m.text && /^\/autopilot/.test(m.text)) return showAP(chat);
  if (m.text && /^\/products/.test(m.text)) return showProducts(chat);
  if (m.text && /^\/sites/.test(m.text)) {
    const list = [...new Set((m.text.match(/(?:[a-z0-9-]+\.)+[a-z]{2,}/gi) || []).map(x => x.toLowerCase().replace(/^www\./, '')))];
    if (list.length) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(sitesFile(), JSON.stringify(list)); }
    const cur = loadSites();
    return send(chat, `🔥 <b>Сайты для «Сервис дня»</b>: ${cur.length ? cur.map(esc).join(', ') : 'пока нет'}\n\nЗадать список: <code>/sites pampadu.ru, сайт2.ru, сайт3.ru</code>\nБот по очереди показывает их в Shorts: снимает сайт и обводит кнопку регистрации.`);
  }
  if (m.text && /^\/brand/.test(m.text)) {
    const m2 = await send(chat, '🎨 Рисую аватарку и шапку с хомяком…');
    try {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-')), plan = buildPlan('Это Хомяк.'); direct(plan, { seed: 1 });
      const [avatar, banner] = await renderBrand(plan, dir, ['avatar', 'banner']);
      const fa = new FormData(); fa.append('chat_id', String(chat)); fa.append('caption', '🐹 Аватарка канала (800×800) — поставьте в настройках канала'); fa.append('photo', await fs.openAsBlob(avatar, { type: 'image/png' }), 'avatar.png'); await tg('sendPhoto', fa);
      const fb = new FormData(); fb.append('chat_id', String(chat)); fb.append('caption', '🖼 Шапка (2560×1440) — для YouTube и ВК'); fb.append('document', await fs.openAsBlob(banner, { type: 'image/png' }), 'banner.png'); await tg('sendDocument', fb);
      fs.rmSync(dir, { recursive: true, force: true }); await tg('deleteMessage', { chat_id: chat, message_id: m2.message_id }).catch(() => {});
    } catch (e) { await edit(chat, m2.message_id, `❌ <code>${esc(String(e.message).slice(0, 300))}</code>`); }
    return send(chat, `📌 <b>Закреплённый пост для канала</b>\n— — —\n${pinText()}`, { reply_markup: { inline_keyboard: [[{ text: '📌 Опубликовать и закрепить в канале', callback_data: 'pin:go' }]] } });
  }
  if (m.text && /^\/formats/.test(m.text)) return showFormats(chat);
  if (m.text && /^\/style/.test(m.text)) {
    const st = loadStyle();
    return send(chat, `🎨 <b>Стиль сценариев</b>\n\n${st.rules.length ? st.rules.map(r => '• ' + esc(r)).join('\n') : 'Правил пока нет.'}\n\nОбразцов (⭐): ${st.examples.length}\n<i>Правила и образцы нейросеть учитывает при каждом новом сценарии.</i>`,
      { reply_markup: { inline_keyboard: [[{ text: '➕ Добавить правила', callback_data: 'style:add' }], [{ text: '🧹 Очистить', callback_data: 'style:clear' }]] } });
  }
  if (m.text && /^\/radar\b/.test(m.text)) return showRadar(chat, true);
  if (m.text && /^\/news\b/.test(m.text)) return newsMenu(chat);
  if (m.text && /^\/voices\b/.test(m.text)) return showHeroVoices(chat);
  // ссылка на шаблон Lumean — спросим, чей это голос
  const lum = /lumean\.app\/template\?shared=([0-9a-f-]{36})/i.exec(m.text || '');
  if (lum && !sessions.get(chat)?.heroVoice) { sessions.set(chat, { pickVoice: lum[1] }); return send(chat, '🎙 Чей это голос?', { reply_markup: { inline_keyboard: Object.entries(HERO_KEYS).map(([k, [, label]]) => [{ text: label, callback_data: 'hv:set:' + k }]) } }); }
  // ключ нейросети: та же форма, что и кнопка «🔑 Подключить нейросеть»
  if (m.text && /^\/ai\b/.test(m.text)) { sessions.set(chat, { awaitSecrets: true }); return send(chat, `🔑 <b>Ключ API нейросети</b> ${scriptGenReady() ? '(сейчас подключён ✅ — пришлите новый, чтобы заменить)' : '(сейчас не подключён)'}\n\nПришлите одним сообщением (бот сразу его удалит):\n<code>ANTHROPIC_API_KEY=ваш_ключ</code>`); }
  // тестовый ролик нового формата: Хомяк рассказывает от себя, кореш Крот, Белка; Shorts «конфетка» с озвучкой
  if (m.text && /^\/test_?krot/.test(m.text)) return enqueue(chat, { script: fs.readFileSync(new URL('./examples/krot.txt', import.meta.url), 'utf8'), voice: hasVoice(), theme: 'ink', mascot: true, vertical: true, candy: true, gift: { promise: 'Таблица «сначала себе»', series: 'save' }, seoHints: { title: 'Мой кореш Крот слепой как котёнок 🙈', topic: 'как накопить', tags: ['как накопить деньги', 'сначала себе', 'куда уходят деньги'], promise: 'Таблица «сначала себе»' } });
  if (m.text && /^\/keys/.test(m.text)) {
    const keys = ['BOT_TOKEN', 'LUMEAN_KEY', 'LUMEAN_TEMPLATE', ...SECRET_KEYS.filter(k => !/^SUPABASE_DB_(HOST|USER|PORT|NAME)$|^VOICESTUDIO_(MODEL|SPEED)$/.test(k))];
    const lines = keys.map(k => `${(k.startsWith('LUMEAN') || k === 'BOT_TOKEN' ? process.env[k] : secret(k)) ? '✅' : '▫️'} <code>${k}</code>`);
    let ch = ''; try { const list = await listChannels(); ch = `📺 Каналы: ${list.map(c => esc(c.title)).join(', ') || 'нет'}`; } catch (e) { ch = `⚠️ Каналы не читаются: <code>${esc(String(e.message).slice(0, 200))}</code>`; }
    return send(chat, `<b>🔑 Ключи на сервере</b>\n${lines.join('\n')}\n\n${ch}\n\n<i>Ключи хранятся в файле data/secrets.env на сервере и не пропадают при перезапуске и обновлениях.</i>`);
  }
  if (m.text && /^\/factory/.test(m.text)) {
    if (!ALLOWED.length) return send(chat, '⚠️ Сначала ограничьте доступ к боту: ALLOWED_USERS в .env.');
    sessions.set(chat, { awaitFactory: true });
    return send(chat, `🏭 <b>Ключи AI Content Factory</b>\n\nПришлите одним сообщением строки вида <code>ИМЯ=значение</code> — можно все секреты из Replit сразу. Сообщение будет удалено, ключи сохранятся на сервере.\n\nОбязательные: ${FACTORY_REQUIRED.map(k => `<code>${k}</code>`).join(', ')}`);
  }
  const ns = sessions.get(chat);
  if (ns?.newsInput && (m.photo || m.video || m.animation || /^(image|video)\//.test(m.document?.mime_type || ''))) return newsMediaIn(chat, m, ns).catch(e => send(chat, `⚠️ Не смог скачать файл: ${esc(e.message)}`));
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
  if (s?.awaitYtCode && /code=|^\s*4\//.test(text)) {
    sessions.delete(chat); await tg('deleteMessage', { chat_id: chat, message_id: m.message_id }).catch(() => {});
    try { const r = await connectFromRedirect(text); return showYT(chat, `✅ Канал <b>${esc(r.title)}</b> ${r.created ? 'подключён' : 'переподключён'}.\n\n`); }
    catch (e) { return send(chat, `❌ ${esc(e.message)}`, { reply_markup: { inline_keyboard: [[{ text: '🔄 Попробовать снова', callback_data: 'ytc:link' }]] } }); }
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
  if (s?.awaitTopic) { sessions.delete(chat); return runGen(chat, { topic: text.trim().slice(0, 500), variant: 0, rubric: s.rubric || null, offer: !!loadOffer() && s.rubric !== 'mistake' && s.rubric !== 'challenge' }); }
  if (s?.awaitBlog) {
    sessions.delete(chat);
    const site = /((?:[a-z0-9-]+\.)+[a-z]{2,})(\/\S*)?/i.exec(text)?.[0];
    if (!site) return send(chat, '⚠️ Не нашёл адрес сайта. Нажмите «✨ Сценарий по теме» → «🎙 Блог» и пришлите адрес вида <code>pampadu.ru</code>.');
    const wish = text.replace(site, '').trim(), offer = loadOffer();
    const m = await send(chat, `🔎 Изучаю ${esc(site)}: заголовки, разделы, кнопки…`);
    const facts = await analyzeSite(site).catch(e => { console.error('analyzeSite', e.message); return null; });
    await edit(chat, m.message_id, facts ? `🔎 <b>${esc(facts.domain)}</b>: ${esc(facts.h1 || facts.title || 'страница открыта')}${facts.ctas?.length ? `\nКнопки: ${esc(facts.ctas.join(', '))}` : ''}` : `⚠️ Сайт не открылся — пишу сценарий без деталей страницы.`);
    return runBlog(chat, { site, wish, facts, offer: !!offer });
  }
  if (s?.heroVoice) { const id = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(text)?.[1]; if (!id) return send(chat, '⚠️ Не нашёл ID шаблона (вида 01a151b1-0c9f-…). Пришли ещё раз.'); sessions.delete(chat); return saveHeroVoice(chat, s.heroVoice, id); }
  if (s?.newsInput) {
    const got = await parseNewsInput(text).catch(() => []);
    if (!got.length) return send(chat, '⚠️ Не разобрал новость. Заголовок — первой строкой, ниже суть. Или ссылка на статью.', NEWS_KB(s.items.length));
    s.items.push(...got); s.items = s.items.slice(0, 5);
    if (s.pending?.length) { (s.items[0].media ||= []).unshift(...s.pending); s.pending = []; }
    if (s.items.length >= 5) { sessions.delete(chat); return newsDraft(chat, s.items); }
    return send(chat, `✅ Принял (${s.items.length}/5):\n${newsList(s.items)}\n\nПришли ещё или собирай выпуск. Лучше всего — 3–4 новости (≈ 1,5 мин).${NEWS_RUB_HINT}`, NEWS_KB(s.items.length, s.items));
  }
  if (s?.editDraft) { sessions.delete(chat); const all = loadJ(draftFile(), {}); if (!all[chat]) return showRadar(chat); all[chat].script = text.split('\n').map(l => l.trim()).filter(Boolean).join('\n'); saveJ(draftFile(), all); return showDraft(chat, '✅ Сценарий обновлён.\n\n'); }
  if (s?.aiDraft) { sessions.delete(chat); const all = loadJ(draftFile(), {}); if (!all[chat]) return showRadar(chat); const m = await send(chat, '🧠 Переписываю…');
    try { all[chat].script = await rewriteScript(all[chat].script, text); saveJ(draftFile(), all); tg('deleteMessage', { chat_id: chat, message_id: m.message_id }).catch(() => {}); return showDraft(chat, '✅ Переписал.\n\n'); }
    catch (e) { return edit(chat, m.message_id, `❌ ${esc(String(e.message).slice(0, 300))}`); } }
  if (s?.editTg) { sessions.delete(chat); const p = loadPub(s.editTg); if (!p) return; p.tgCaption = text.trim().slice(0, 4000); savePub(s.editTg, p); return previewPost(chat, s.editTg); }
  if (s?.awaitFormat) {
    sessions.delete(chat); const ls = text.split('\n').map(l => l.trim()).filter(Boolean), nm = /^название\s*:\s*(.+)$/i.exec(ls[0] || '');
    const lines = nm ? ls.slice(1) : ls; if (lines.length < 3) return send(chat, '⚠️ Слишком коротко — нужно хотя бы 3 строки. /formats → «➕ Добавить формат».');
    const list = loadFormats(); list.push({ id: Date.now().toString(36), name: nm ? nm[1].slice(0, 40) : `Мой формат ${list.length + 1}`, lines }); saveFormats(list);
    return showFormats(chat, '✅ Формат добавлен — бот начнёт чередовать его в «🎙 Блог».\n\n');
  }
  if (s?.awaitStyle) { sessions.delete(chat); const st = loadStyle(); st.rules.push(...text.split('\n').map(l => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean)); saveStyle(st); return send(chat, `✅ Правил стиля: ${st.rules.length}. Посмотреть — /style.`); }
  if (s?.awaitRewrite) {
    const cur = s.parts?.slice(-1)[0] || gens.get(chat)?.script; delete s.awaitRewrite; if (!cur) return send(chat, 'Сценарий не найден.');
    const m2 = await send(chat, '✏️ Переписываю…');
    try {
      const out = await rewriteScript(cur, text.slice(0, 600)); gens.set(chat, { ...(gens.get(chat) || {}), script: out });
      const ns = { ...newSession('ham', { replaceNext: true, offer: !!s.offer }), ...(s.parts ? { style: s.style, vertical: s.vertical, mode: s.mode } : {}), parts: [out] }; sessions.set(chat, ns);
      await edit(chat, m2.message_id, `✏️ <b>Новая версия</b>\n\n${esc(out)}`, { reply_markup: SCRIPT_KB() }); return showCollect(chat, ns);
    } catch (e) { return edit(chat, m2.message_id, `❌ <code>${esc(String(e.message).slice(0, 300))}</code>`); }
  }
  if (s?.awaitProduct) {
    sessions.delete(chat); const o = parseOffer(text, {}), rub = /^\s*(РУБРИКИ|ТЕМЫ)\s*[=:]\s*(.+)$/im.exec(text);
    if (!o.title || !o.link) return send(chat, '⚠️ Нужны хотя бы <code>НАЗВАНИЕ=</code> и <code>ССЫЛКА=</code>. Отправьте /products ещё раз.');
    o.series = rub ? rubricsOf(rub[2]) : []; o.id = Date.now().toString(36);
    const all = loadProducts(); all.push(o); fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(productsFile(), JSON.stringify(all, null, 1));
    return showProducts(chat, `✅ Добавлено: <b>${esc(o.title)}</b>${o.erid ? '' : '\n⚠️ Без erid публиковать рекламу нельзя (38-ФЗ).'}\n\n`);
  }
  if (s?.awaitOffer) {
    sessions.delete(chat); const o = parseOffer(text);
    if (!o.title || !o.link) return send(chat, '⚠️ Нужны хотя бы <code>НАЗВАНИЕ=</code> и <code>ССЫЛКА=</code>. Нажмите «🏷 Реклама» ещё раз.');
    fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(offerFile(), JSON.stringify(o, null, 1));
    return send(chat, `✅ Предложение сохранено\n\n${offerText(o)}${o.erid ? '' : '\n\n⚠️ Без erid ролик с рекламой публиковать нельзя (38-ФЗ) — возьмите токен в кабинете партнёрки.'}`, { reply_markup: MENU() });
  }
  if (s?.edit) {
    sessions.delete(chat); const { field, id } = s.edit; const p = loadPub(id); if (!p) return;
    if (field === 'title') p.title = text.trim().slice(0, 100);
    if (field === 'desc') p.description = text.trim().slice(0, 5000);
    if (field === 'tags') p.tags = text.split(/[,\n]/).map(x => x.trim().replace(/^#/, '')).filter(Boolean);
    savePub(id, p); pubCards.delete(id); return showPublish(chat, id, '✏️ Изменения сохранены.');
  }
  if (!s?.parts) { // текст без нажатия кнопки (или после незаконченной команды) — начинаем сбор сценария
    if (text.length < 40) return send(chat, 'Нажмите кнопку, чтобы создать ролик 👇', { reply_markup: MENU() });
    s = newSession('ham'); sessions.set(chat, s);
  }
  // сценарий от бота + присланная правка — это замена целиком, а не продолжение
  if (s.replaceNext && text.trim().length > 80) { s.parts = [text.trim()]; if (gens.get(chat)) gens.get(chat).script = text.trim(); clearTimeout(s.timer); s.timer = setTimeout(() => showCollect(chat, s).catch(e => console.error(e)), 1200); return; }
  s.parts.push(text.trim());
  // Telegram режет длинный текст на несколько сообщений — ждём, пока придут все части, и показываем сводку один раз
  clearTimeout(s.timer); s.timer = setTimeout(() => showCollect(chat, s).catch(e => console.error(e)), 1200);
}

async function main() {
  // сеть до Telegram бывает нестабильной — не падаем, а ждём и пробуем снова
  let me;
  for (let i = 0; !me; i++) {
    try { me = await tg('getMe'); BOT_ID = me.id; } catch (e) { console.error(`Telegram недоступен (${e.cause?.code || e.message}), повтор через ${Math.min(60, 5 * (i + 1))} с`); await new Promise(r => setTimeout(r, Math.min(60, 5 * (i + 1)) * 1000)); }
  }
  console.log(`Бот @${me.username} запущен. Озвучка: ${voiceCfg()?.provider || (LUMEAN ? 'lumean' : 'выкл')}. Доступ: ${ALLOWED.length ? ALLOWED.join(', ') : 'все'}`);
  await tg('setMyCommands', { commands: [{ command: 'start', description: 'Меню' }, { command: 'help', description: 'Как писать сценарий' }, { command: 'radar', description: 'Радар: 10 актуальных тем на выбор' }, { command: 'news', description: 'Зверо-новости: выпуск по рубрикам' }, { command: 'voices', description: 'Голоса героев (Сова, Крот, Хомяк…)' }, { command: 'autopilot', description: 'Shorts-фабрика: ролики по расписанию' }, { command: 'ai', description: 'Подключить ключ нейросети' }, { command: 'youtube', description: 'Каналы YouTube: проверить и переподключить' }, { command: 'version', description: 'Какая версия бота работает на сервере' }, { command: 'stats', description: 'Цифры: просмотры, рубрики, Telegram' }, { command: 'invites', description: 'Ссылки на Telegram для каждого YouTube-канала' }, { command: 'sites', description: 'Сайты для рубрики «Сервис дня»' }, { command: 'products', description: 'Товары под рубрики (для постов в канале)' }, { command: 'channel', description: 'Подключить Telegram-канал' }, { command: 'brand', description: 'Аватарка, шапка и закреп для канала' }, { command: 'formats', description: 'Форматы выпусков (свои и встроенные)' }, { command: 'style', description: 'Правила стиля сценариев' }, { command: 'keys', description: 'Какие ключи сохранены' }, { command: 'cancel', description: 'Отменить' }] }).catch(() => {});
  fs.rmSync(busyFile(), { force: true }); offerResume().catch(e => console.error('resume', e.message));   // сборку прервал перезапуск — предложим продолжить
  ensureClone(); setInterval(ensureClone, 10 * 60 * 1000); ensureChannel();
  setInterval(apTick, 60 * 1000); setInterval(statsTick, 60 * 1000);
  let offset = 0;
  for (;;) {
    try {
      const ups = await tg('getUpdates', { offset, timeout: 50, allowed_updates: ['message', 'callback_query', 'chat_member'] });
      for (const u of ups) {
        offset = u.update_id + 1;
        onUpdate(u).catch(e => { // ошибка не должна молча «съедать» сообщение — говорим пользователю
          console.error('update', e); const chat = u.message?.chat.id || u.callback_query?.message.chat.id;
          if (chat) send(chat, `⚠️ Что-то пошло не так: <code>${esc(String(e.message).slice(0, 300))}</code>\nПопробуйте ещё раз или нажмите /start.`, { reply_markup: MENU() }).catch(() => {});
        });
      }
    } catch (e) { console.error('poll', e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
}
main();
