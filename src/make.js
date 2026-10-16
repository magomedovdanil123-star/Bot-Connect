// Сценарий -> (озвучка) -> план -> MP4. Общая точка входа для бота и CLI.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildPlan } from './planner.js';
import { renderVideo } from './render.js';
import { synthesize, timingsFromAudio } from './voice.js';

const LEAD = .6; // секунд затемнения в начале ролика

export async function makeVideo(script, { out, voice = null, onStage, onProgress } = {}) {
  const plan = buildPlan(script);
  if (!plan.scenes.length) throw new Error('Пустой сценарий');
  let audio = null;
  if (voice) {
    onStage?.('voice');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
    audio = await synthesize(plan.scenes.map(s => s.text), { ...voice, dir, onStatus: (st, pc) => onStage?.('voice', st, pc) });
    const { timings } = await timingsFromAudio(audio, plan.scenes.map(s => s.text));
    plan.scenes.forEach((s, i) => { s.start = LEAD + timings[i].start; s.dur = timings[i].dur; s.speak = timings[i].speak; });
  }
  onStage?.('render', plan.scenes.length);
  return renderVideo(plan, out, { audio, audioOffset: LEAD, onProgress });
}
