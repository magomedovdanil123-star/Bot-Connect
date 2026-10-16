// Сценарий -> (озвучка) -> режиссура (стиль, монтаж, звук) -> MP4. Общая точка входа для бота и CLI.
// Каждый ролик сохраняется как проект (data/projects/<id>/): сценарий, seed, стиль, озвучка с таймингами.
// Повтор проекта с тем же seed воспроизводит ролик 1:1 (озвучка берётся из проекта, Lumean повторно не платится).
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildPlan } from './planner.js';
import { renderVideo } from './render.js';
import { alignSentences, run, synthesize } from './voice.js';
import { chooseStyle, direct, newSeed, rememberStyle } from './director.js';
import { renderSfxBus } from './sfx.js';

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
export async function makeVideo(script, { out, voice = null, projectId = null, seed = null, localVoice = null, onStage, onProgress } = {}) {
  const prev = projectId ? loadProject(projectId) : null;
  if (projectId && !prev) throw new Error('Проект не найден');
  if (prev) { script = prev.script; voice = prev.voiced ? (voice || { cached: true }) : null; }
  const id = projectId || crypto.randomBytes(5).toString('hex');
  const dir = projectDir(id); fs.mkdirSync(dir, { recursive: true });

  const plan = buildPlan(script);
  if (!plan.scenes.length) throw new Error('Пустой сценарий');
  seed = seed ?? newSeed();
  const sameAsSaved = prev && seed === prev.seed;
  const style = sameAsSaved ? prev.style : chooseStyle(seed, { lockAccent: process.env.STYLE_ACCENT });

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
    const r = await synthesize(plan.scenes.map(s => s.text), { ...voice, dir: work, onStatus: (st, pc, part, parts) => onStage?.('voice', { status: st, percent: pc, part, parts }) });
    fs.copyFileSync(r.file, cachedVoice); voiceFile = cachedVoice; timings = r.timings;
    fs.writeFileSync(cachedTm, JSON.stringify(timings));
    fs.rmSync(work, { recursive: true, force: true });
  }

  // ---- режиссура: монтаж, эффекты, звуковые события ----
  direct(plan, { seed, style, timings, lead: LEAD });
  const sfxFile = path.join(dir, 'sfx.wav');
  const sfxStats = renderSfxBus(plan.sfx, plan.total, sfxFile);
  onStage?.('render', { scenes: plan.scenes.length, style });

  const res = await renderVideo(plan, out, { voice: voiceFile, voiceOffset: LEAD, sfx: sfxFile, onProgress });
  fs.rmSync(sfxFile, { force: true });

  if (!sameAsSaved) rememberStyle(style);
  fs.writeFileSync(path.join(dir, 'project.json'), JSON.stringify({
    id, script, seed, style, voiced: Boolean(voiceFile), created: prev?.created || new Date().toISOString(), updated: new Date().toISOString(),
    scenes: res.scenes.map(s => ({ type: s.type, transition: s.transition, camera: s.camera, level: s.level, start: +s.start.toFixed(2), dur: +s.dur.toFixed(2) })),
    sfx: sfxStats,
  }, null, 1));
  return { ...res, id, seed, style, sfx: sfxStats, voiced: Boolean(voiceFile) };
}

export function describeStyle(style) {
  const names = {
    edit: { kinetic: 'кинетичный', clean: 'чистый', digital: 'цифровой', cinematic: 'кинематографичный' },
    accent: { violet: 'фиолетовый', cyan: 'циан', mint: 'мятный', magenta: 'маджента', amber: 'янтарный', electric: 'электрик' },
  };
  return `${names.edit[style.edit] || style.edit} монтаж · акцент ${names.accent[style.accent] || style.accent}`;
}
