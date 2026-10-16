#!/usr/bin/env node
// Локальная проверка: node cli.js сценарий.txt out.mp4 [--plan] [--voice]
import fs from 'fs';
import { buildPlan } from './src/planner.js';
import { makeVideo } from './src/make.js';
import { loadEnv } from './src/env.js';

loadEnv();
const [inp, out = 'out.mp4'] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const script = fs.readFileSync(inp, 'utf8');
if (process.argv.includes('--plan')) {
  buildPlan(script).scenes.forEach((s, i) => console.log(String(i + 1).padStart(2), s.type.padEnd(10), s.text.slice(0, 80)));
  process.exit(0);
}
const voice = process.argv.includes('--voice') ? { key: process.env.LUMEAN_KEY, template: process.env.LUMEAN_TEMPLATE } : null;
const t0 = Date.now();
const r = await makeVideo(script, { out, voice, onStage: (...a) => console.log('stage', ...a), onProgress: p => process.stdout.write(`\r${Math.round(p * 100)}%`) });
console.log(`\n${r.file}: ${r.duration.toFixed(1)} c, ${r.sizeMB.toFixed(1)} МБ, ${r.scenes.length} сцен, ${((Date.now() - t0) / 1000).toFixed(0)} c рендера`);
