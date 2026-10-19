// Сценарий -> (озвучка) -> режиссура (стиль, монтаж, звук) -> MP4. Общая точка входа для бота и CLI.
// Каждый ролик сохраняется как проект (data/projects/<id>/): сценарий, seed, стиль, озвучка с таймингами.
// Повтор проекта с тем же seed воспроизводит ролик 1:1 (озвучка берётся из проекта, Lumean повторно не платится).
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPlan } from './planner.js';
import { renderThumbs, renderVideo } from './render.js';
import { alignSentences, mouthEnvelope, run, synthesize } from './voice.js';
import { chooseStyle, direct, newSeed, rememberStyle } from './director.js';
import { renderSfxBus } from './sfx.js';
import { renderMusic } from './music.js';
import { synthesizeVoiceStudio } from './voicestudio.js';
import { captureScreens } from './screens.js';
import { buildSeo, keywords } from './seo.js';
import { polishSeo } from './scriptgen.js';

const LEAD = .6; // секунд затемнения в начале ролика
const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const projectDir = id => path.join(DATA_DIR, 'projects', id);

// фото и видео к новостям → кадры для движка (data URL): фото до 1280 px, видео — первые 7 с по 12 кадров/с.
// Готовое лежит в папке проекта (media.json) — при повторе и продолжении сборки ничего не пересчитываем.
export async function prepNewsMedia(newsMedia, dir) {
  const cache = path.join(dir, 'media.json');
  if (fs.existsSync(cache)) try { return JSON.parse(fs.readFileSync(cache, 'utf8')); } catch { /* пересоберём */ }
  if (!newsMedia || !Object.keys(newsMedia).length) return null;
  const out = {}, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'media-')), url = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');
  try {
    for (const [n, list] of Object.entries(newsMedia)) for (const [i, m] of list.entries()) {
      if (!m?.file || !fs.existsSync(m.file)) continue;
      try {
        if (n === 'prop') {   // товар из пожелания автора — PNG, чтобы сохранить прозрачность (фон движок уберёт сам, если его нет)
          const f = path.join(tmp, `prop_${i}.png`);
          await run('ffmpeg', ['-y', '-v', 'error', '-i', m.file, '-vf', "scale='min(800,iw)':-2", '-frames:v', '1', f]);
          (out.prop ||= []).push({ kind: 'photo', src: 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') });
        } else if (m.kind === 'video') {
          const d = path.join(tmp, `v${n}_${i}`); fs.mkdirSync(d);
          await run('ffmpeg', ['-y', '-v', 'error', '-t', '7', '-i', m.file, '-vf', 'fps=12,scale=720:-2', '-q:v', '5', path.join(d, 'f_%03d.jpg')]);
          const frames = fs.readdirSync(d).sort().map(f => url(path.join(d, f))); if (frames.length) (out[n] ||= []).push({ kind: 'video', frames, fps: 12, credit: m.credit || '' });
        } else {
          const f = path.join(tmp, `p${n}_${i}.jpg`);
          await run('ffmpeg', ['-y', '-v', 'error', '-i', m.file, '-vf', "scale='min(1280,iw)':-2", '-frames:v', '1', '-q:v', '4', f]);
          (out[n] ||= []).push({ kind: 'photo', src: url(f), credit: m.credit || '' });
        }
      } catch (e) { console.error('news media', m.file, e.message); }
    }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  if (Object.keys(out).length) fs.writeFileSync(cache, JSON.stringify(out));
  return Object.keys(out).length ? out : null;
}

export function loadProject(id) {
  try { return JSON.parse(fs.readFileSync(path.join(projectDir(id), 'project.json'), 'utf8')); } catch { return null; }
}

/**
 * @param script            текст сценария
 * @param opts.voice        { key, template } — озвучка Lumean, или null
 * @param opts.projectId    повторить существующий проект (озвучка и сценарий берутся из него)
 * @param opts.seed         seed стиля; не задан — новый (новый визуальный почерк)
 */
export async function makeVideo(script, { out, voice = null, projectId = null, seed = null, localVoice = null, vertical = false, offer = null, theme = null, mascot = false, tg = null, seoHints = null, candy = null, newsMedia = null, newId = null, onStage, onProgress, signal = null } = {}) {
  const stop = () => { if (signal?.aborted) throw new Error('STOPPED'); };   // «⏹ Остановить сборку» в боте
  const prev = projectId ? loadProject(projectId) : null;
  if (projectId && !prev) throw new Error('Проект не найден');
  if (prev) { script = prev.script; voice = prev.voiced ? (voice || { cached: true }) : null; offer = offer || prev.offer || null; theme = theme || prev.theme || null; mascot = mascot || !!prev.mascot; }
  const id = projectId || newId || crypto.randomBytes(5).toString('hex');   // newId — свой номер у задачи: после сбоя продолжаем в той же папке (озвучка и готовые куски уже там)
  const dir = projectDir(id); fs.mkdirSync(dir, { recursive: true });

  candy = (candy ?? (mascot && theme !== 'neon')) && vertical;   // «конфетка» (весь экран, караоке-субтитры, реплики, знакомства) — по умолчанию у всех Shorts с Хомяком
  const plan = buildPlan(script, { mascot, candy }); if (candy) plan.candy = true;
  if (!plan.scenes.length) throw new Error('Пустой сценарий');
  if (offer) plan.offer = offer;   // рекламная интеграция: сцена предложения + маркировка
  if (tg) plan.tg = tg;
  if (plan.news) plan.media = await prepNewsMedia(newsMedia, dir);   // «Зверо-новости»: настоящие фото и видео к новостям            // Telegram-канал проекта: сцена-переход и ссылка в описании (tg.promise — пост-подарок на телефоне)
  for (const s of plan.scenes) if (s.type === 'tgcta' && !s.p.where) s.p.where = vertical ? 'profile' : 'desc';   // у Shorts ссылка в профиле, у роликов — в описании
  seed = seed ?? newSeed();
  const sameAsSaved = prev && seed === prev.seed;
  const style = sameAsSaved ? prev.style : chooseStyle(seed, { lockAccent: process.env.STYLE_ACCENT, theme: theme || (plan.hasMascot ? 'ink' : undefined) });

  // ---- озвучка (из кэша проекта, если есть) ----
  let voiceFile = null, timings = null;
  const cachedVoice = path.join(dir, 'voice.wav'), cachedTm = path.join(dir, 'timings.json');
  if (voice && fs.existsSync(cachedVoice) && fs.existsSync(cachedTm)) { voiceFile = cachedVoice; timings = JSON.parse(fs.readFileSync(cachedTm, 'utf8')); }
  else if (localVoice) { // тест/ручная озвучка: готовый аудиофайл, тайминги по паузам
    await run('ffmpeg', ['-y', '-v', 'error', '-i', localVoice, '-ac', '1', '-ar', '48000', cachedVoice]);
    const a = await alignSentences(cachedVoice, plan.scenes.map(s => s.text));
    voiceFile = cachedVoice; timings = a.sentences; fs.writeFileSync(cachedTm, JSON.stringify(timings));
  }
  else if (voice && !voice.cached) {
    onStage?.('voice', { parts: 1 });
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
    const synth = voice.provider === 'voicestudio' ? synthesizeVoiceStudio : synthesize;
    // голоса героев: реплики героя со своим голосом (Сова, Волк) — его голосом; всё остальное (другие герои, рассказ) — основным.
    // В новостях Сова — ведущая: без чужой реплики фразу читает она (заголовки, суть новости)
    const heroes = voice.heroes || {}, kindOf = s => s.p?.say ? (s.p.cast || []).find(c => c.name === s.p.say.who)?.kind : plan.lead === 'owl' ? 'owl' : null;
    const templates = voice.provider === 'voicestudio' ? null : plan.scenes.map(s => heroes[kindOf(s)] || voice.template);
    const r = await synth(plan.scenes.map(s => s.text), { ...voice, templates, dir: work, onStatus: (st, pc, part, parts) => onStage?.('voice', { status: st, percent: pc, part, parts }) });
    fs.copyFileSync(r.file, cachedVoice); voiceFile = cachedVoice; timings = r.timings;
    fs.writeFileSync(cachedTm, JSON.stringify(timings));
    fs.rmSync(work, { recursive: true, force: true });
  }

  // ---- снимки сайтов для сцен «Экран» (кэшируются в проекте) ----
  if (plan.scenes.some(s => s.type === 'screen')) await captureScreens(plan, dir, domain => onStage?.('screens', { domain })).catch(e => console.error('screens:', e.message));

  // ---- режиссура: монтаж, эффекты, звуковые события ----
  // Shorts: без заставки и тёмной паузы — голос и крючок с первой секунды; крючок крупно на первом кадре (и в конце — петля)
  if (vertical) { plan.vertical = true; plan.hook = String(seoHints?.title || plan.scenes[0]?.text || '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim(); }
  direct(plan, { seed, style, timings, lead: vertical ? 0 : LEAD });
  if (vertical && plan.scenes[0]?.dir) Object.assign(plan.scenes[0].dir, { transition: 'cut', tw: 0 });
  // синхрон губ талисмана с озвучкой
  if (voiceFile && plan.hasMascot) plan.mouth = await mouthEnvelope(voiceFile, plan.voiceLead ?? LEAD).catch(() => null);
  const sfxFile = path.join(dir, 'sfx.wav');
  const sfxStats = renderSfxBus(plan.sfx, plan.total, sfxFile);
  stop(); onStage?.('render', { scenes: plan.scenes.length, style });

  // музыкальная подложка (MUSIC=0 в .env — выключить)
  const musicFile = process.env.MUSIC === '0' ? null : path.join(dir, 'music.wav');
  const music = musicFile ? renderMusic(plan, musicFile) : null;
  const res = await renderVideo(plan, out, { cacheDir: path.join(dir, 'segments'), voice: voiceFile, voiceOffset: plan.voiceLead ?? LEAD, sfx: sfxFile, music: musicFile, musicDb: Number(process.env.MUSIC_DB) || undefined, onProgress, signal });
  fs.rmSync(sfxFile, { force: true }); if (musicFile) fs.rmSync(musicFile, { force: true });

  if (!sameAsSaved && !vertical) rememberStyle(style);
  const seo = buildSeo(script, plan, { hints: seoHints, tg });
  if (seoHints) await polishSeo(seo, script, seoHints).catch(e => console.error('seo:', e.message));   // нейросеть доводит название и крючок, если есть ключ
  if (offer) seo.description = offerBlock(offer, vertical ? id + 's' : id) + seo.description;
  if (tg?.username && !seoHints) seo.description = `📲 Наш Telegram: https://t.me/${tg.username}\n\n` + seo.description;
  // обложки: три варианта (эмоция героя + 1–2 строки крупного текста)
  let thumbs = [];
  if (!vertical) { try { thumbs = await renderThumbs(plan, dir, thumbVariants(plan, script)); } catch (e) { console.error('thumbs:', e.message); } }
  if (vertical && projectId) { seo.title = (seo.title.length > 88 ? seo.title.slice(0, 86) + '…' : seo.title) + ' #shorts'; seo.tags = ['shorts', ...seo.tags]; return { ...res, id, seed, style, seo, dir, sfx: sfxStats, music, voiced: Boolean(voiceFile), vertical: true }; }
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({
    id, script, seed, style, theme, mascot, voiced: Boolean(voiceFile), created: prev?.created || new Date().toISOString(), updated: new Date().toISOString(),
    scenes: res.scenes.map(s => ({ type: s.type, transition: s.transition, camera: s.camera, level: s.level, start: +s.start.toFixed(2), dur: +s.dur.toFixed(2) })),
    sfx: sfxStats, music: music && { bpm: music.bpm, bars: music.bars }, seo, offer,
  }, null, 1));
  if (vertical) { seo.title = (seo.title.length > 88 ? seo.title.slice(0, 86) + '…' : seo.title) + ' #shorts'; seo.tags = ['shorts', ...seo.tags]; }
  return { ...res, id, seed, style, seo, dir, sfx: sfxStats, music, voiced: Boolean(voiceFile), thumbs, vertical };
}

// описание ролика с рекламой: маркировка по 38-ФЗ и ссылка с меткой ролика (subid) — видно, какой ролик приносит заявки
export function offerLink(link, subid) {
  if (!link) return '';
  if (link.includes('{subid}')) return link.replace('{subid}', encodeURIComponent(subid));
  try { const u = new URL(link); u.searchParams.set('subid', subid); return u.toString(); } catch { return link; }
}
function offerBlock(o, subid) {
  const mark = o.advertiser || o.erid ? `Реклама. ${o.advertiser || ''}${o.erid ? `. erid: ${o.erid}` : ''}`.replace(/\.\s*\./g, '.') + '\n' : '';
  return `${mark}👉 ${o.title || 'Предложение'}: ${offerLink(o.link, subid)}\n\n`;
}

export function describeStyle(style) {
  const names = {
    edit: { kinetic: 'кинетичный', clean: 'чистый', digital: 'цифровой', cinematic: 'кинематографичный' },
    accent: { violet: 'фиолетовый', cyan: 'циан', mint: 'мятный', magenta: 'маджента', amber: 'янтарный', electric: 'электрик' },
  };
  return `${names.edit[style.edit] || style.edit} монтаж · акцент ${names.accent[style.accent] || style.accent}`;
}

// тексты и места для обложек: сумма из сценария, главная тема, вопрос-крючок
function thumbVariants(plan, script) {
  const vals = plan.scenes.flatMap(s => (s.p?.acts || []).map(a => a.value).filter(Boolean));
  const raw = vals[vals.length - 1] || ((script.match(/\d[\d\s]{0,8}\d?\s?(?:₽|руб\S*|%|\$)/) || [''])[0]).replace(/\s?руб\S*/, ' ₽').trim();
  const num = raw ? '+' + raw.replace(/^\+/, '') : '';
  // тема — самая частая финансовая тема сценария (в именительном падеже), иначе ключевое слово
  const TOPICS = { 'инфляц': 'ИНФЛЯЦИЯ', 'кэшб': 'КЭШБЭК', 'кешб': 'КЭШБЭК', 'зарплат': 'ЗАРПЛАТА', 'накоп': 'НАКОПЛЕНИЯ', 'вклад': 'ВКЛАДЫ', 'кредит': 'КРЕДИТЫ', 'ипотек': 'ИПОТЕКА', 'процент': 'ПРОЦЕНТЫ',
    'бюджет': 'БЮДЖЕТ', 'долг': 'ДОЛГИ', 'налог': 'НАЛОГИ', 'пенси': 'ПЕНСИЯ', 'инвест': 'ИНВЕСТИЦИИ', 'портфел': 'ПОРТФЕЛЬ', 'акци': 'АКЦИИ', 'биткоин': 'БИТКОИН', 'bitcoin': 'БИТКОИН', 'крипт': 'КРИПТА', 'эконом': 'ЭКОНОМИЯ', 'сбереж': 'СБЕРЕЖЕНИЯ', 'карт': 'КАРТЫ', 'цен': 'ЦЕНЫ' };
  const low = script.toLowerCase(), counts = Object.entries(TOPICS).map(([k, v]) => [v, (low.match(new RegExp('(^|[^а-яёa-z])' + k, 'g')) || []).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
  const topic = counts[0]?.[0] || (keywords(script, 12, [plan.main]).find(w => w.length >= 4 && w.length <= 11 && !/^(хомя|рубл|знаком)/i.test(w)) || plan.title || 'ДЕНЬГИ').toUpperCase();
  const hook = /почему/i.test(script) ? 'ПОЧЕМУ?' : /(^|\s)как(\s|$)/i.test(script) ? 'КАК?' : 'СЕКРЕТ';
  const places = [...new Set(plan.scenes.map(s => s.p?.place).filter(Boolean))].sort((a, b) => ['space', 'exchange', 'bank', 'shop', 'office', 'street', 'home'].indexOf(a) - ['space', 'exchange', 'bank', 'shop', 'office', 'street', 'home'].indexOf(b));
  const pl = i => places[i % Math.max(1, places.length)] || 'home';
  return [
    { variant: 0, lines: [topic, num || 'ВСЕ ОШИБАЮТСЯ'].filter(Boolean), place: pl(0) },
    { variant: 1, lines: [hook, topic], place: pl(1) },
    { variant: 2, lines: [num || topic], place: pl(2) },
  ];
}
