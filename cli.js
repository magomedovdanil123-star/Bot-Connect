#!/usr/bin/env node
// Локальный запуск: node cli.js сценарий.txt out.mp4 [--plan] [--voice] [--seed N] [--voice-file голос.wav] [--project ID] [--vertical]
//                   node cli.js --brand папка   — аватарка, шапка канала и стикеры с хомяком
import fs from 'fs';
import { buildPlan } from './src/planner.js';
import { makeVideo, describeStyle } from './src/make.js';
import { loadEnv } from './src/env.js';

loadEnv();
const argv = process.argv.slice(2);
const opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const pos = argv.filter((a, i) => !a.startsWith('--') && !['--seed', '--voice-file', '--project', '--brand'].includes(argv[i - 1]));
const [inp, out = 'out.mp4'] = pos;
const script = inp ? fs.readFileSync(inp, 'utf8') : '';
// фирменные материалы: node cli.js --brand папка  (аватарка, шапка канала, стикеры с хомяком)
if (argv.includes('--brand')) {
  const { renderBrand } = await import('./src/render.js'); const { direct } = await import('./src/director.js');
  const dir = opt('--brand') || 'brand'; fs.mkdirSync(dir, { recursive: true });
  const plan = buildPlan('Это Хомяк.'); direct(plan, { seed: 1 });
  console.log((await renderBrand(plan, dir)).join('\n')); process.exit(0);
}
if (argv.includes('--plan')) {
  buildPlan(script).scenes.forEach((s, i) => console.log(String(i + 1).padStart(2), s.type.padEnd(10), s.text.slice(0, 80)));
  process.exit(0);
}
const voice = argv.includes('--voice') ? { key: process.env.LUMEAN_KEY, template: process.env.LUMEAN_TEMPLATE } : null;
const t0 = Date.now();
const r = await makeVideo(script, {
  out, voice, seed: opt('--seed') ? Number(opt('--seed')) : null, localVoice: opt('--voice-file'), projectId: opt('--project'), vertical: argv.includes('--vertical'),
  onStage: (st, info) => console.log('stage', st, JSON.stringify(info || {}).slice(0, 200)),
  onProgress: p => process.stdout.write(`\r${Math.round(p * 100)}%`),
});
console.log(`\n${r.files.join(', ')}: ${r.duration.toFixed(1)} c, ${r.sizeMB.toFixed(1)} МБ, ${r.scenes.length} сцен, проект ${r.id}, seed ${r.seed}, ${describeStyle(r.style)}, SFX ${r.sfx.count}, ${((Date.now() - t0) / 1000).toFixed(0)} c`);
console.log('style', JSON.stringify(Object.fromEntries(Object.entries(r.style).filter(([k]) => !['recentTransitions', 'accentColors'].includes(k)))));
console.log('transitions', r.scenes.map(s => s.transition).join(','));
