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
import { buildSeo, keywords } from './seo.js';

const LEAD = .6; // секунд затемнения в начале ролика
const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const projectDir = id => path.join(DATA_DIR, 'projects', id);

export function loadProject(id) {
  try { return JSON.parse(fs.readFileSync(path.join(projectDir(id), 'project.json'), 'utf8')); } catch { return null; }
}

/**
 * @param script            текст сценария
 * @param opts.voice        { key, template } — озвучка Lumean, или null
 * @param opts.projectId    повторить существующий проект (озвучка и сценарий берутся из него)
 * @param opts.seed         seed стиля; не задан — новый (новый визуальный почерк)
 */
export async function makeVideo(script, { out, voice = null, projectId = null, seed = null, localVoice = null, vertical = false, onStage, onProgress } = {}) {
  const prev = projectId ? loadProject(projectId) : null;
  if (projectId && !prev) throw new Error('Проект не найден');
  if (prev) { script = prev.script; voice = prev.voiced ? (voice || { cached: true }) : null; }
  const id = projectId || crypto.randomBytes(5).toString('hex');
  const dir = projectDir(id); fs.mkdirSync(dir, { recursive: true });

  const plan = buildPlan(script);
  if (!plan.scenes.length) throw new Error('Пустой сценарий');
  seed = seed ?? newSeed();
  const sameAsSaved = prev && seed === prev.seed;
  const style = sameAsSaved ? prev.style : chooseStyle(seed, { lockAccent: process.env.STYLE_ACCENT, theme: plan.hasMascot ? 'ink' : undefined });

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
    const r = await synth(plan.scenes.map(s => s.text), { ...voice, dir: work, onStatus: (st, pc, part, parts) => onStage?.('voice', { status: st, percent: pc, part, parts }) });
    fs.copyFileSync(r.file, cachedVoice); voiceFile = cachedVoice; timings = r.timings;
    fs.writeFileSync(cachedTm, JSON.stringify(timings));
    fs.rmSync(work, { recursive: true, force: true });
  }

  // ---- режиссура: монтаж, эффекты, звуковые события ----
  direct(plan, { seed, style, timings, lead: LEAD });
  if (vertical) plan.vertical = true;
  // синхрон губ талисмана с озвучкой
  if (voiceFile && plan.hasMascot) plan.mouth = await mouthEnvelope(voiceFile, plan.voiceLead ?? LEAD).catch(() => null);
  const sfxFile = path.join(dir, 'sfx.wav');
  const sfxStats = renderSfxBus(plan.sfx, plan.total, sfxFile);
  onStage?.('render', { scenes: plan.scenes.length, style });

  // музыкальная подложка (MUSIC=0 в .env — выключить)
  const musicFile = process.env.MUSIC === '0' ? null : path.join(dir, 'music.wav');
  const music = musicFile ? renderMusic(plan, musicFile) : null;
  const res = await renderVideo(plan, out, { voice: voiceFile, voiceOffset: plan.voiceLead ?? LEAD, sfx: sfxFile, music: musicFile, musicDb: Number(process.env.MUSIC_DB) || undefined, onProgress });
  fs.rmSync(sfxFile, { force: true }); if (musicFile) fs.rmSync(musicFile, { force: true });

  if (!sameAsSaved && !vertical) rememberStyle(style);
  const seo = buildSeo(script, plan);
  // обложки: три варианта (эмоция героя + 1–2 строки крупного текста)
  let thumbs = [];
  if (!vertical) { try { thumbs = await renderThumbs(plan, dir, thumbVariants(plan, script)); } catch (e) { console.error('thumbs:', e.message); } }
  if (vertical) { seo.title = (seo.title.length > 88 ? seo.title.slice(0, 86) + '…' : seo.title) + ' #shorts'; seo.tags = ['shorts', ...seo.tags]; return { ...res, id, seed, style, seo, dir, sfx: sfxStats, music, voiced: Boolean(voiceFile), vertical: true }; }
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({
    id, script, seed, style, voiced: Boolean(voiceFile), created: prev?.created || new Date().toISOString(), updated: new Date().toISOString(),
    scenes: res.scenes.map(s => ({ type: s.type, transition: s.transition, camera: s.camera, level: s.level, start: +s.start.toFixed(2), dur: +s.dur.toFixed(2) })),
    sfx: sfxStats, music: music && { bpm: music.bpm, bars: music.bars }, seo,
  }, null, 1));
  return { ...res, id, seed, style, seo, dir, sfx: sfxStats, music, voiced: Boolean(voiceFile), thumbs };
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
