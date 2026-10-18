// Кадры Shorts как в боте (вертикаль, хомяк, комикс): node scripts/vprev.mjs <script> <seed> <outdir> [t1,t2,...|auto]
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { buildPlan } = await import(ROOT + '/src/planner.js'); const { direct, chooseStyle } = await import(ROOT + '/src/director.js');
const require = createRequire(ROOT + '/src/render.js'); let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }
const [,, scriptFile, seed, outDir, times = 'auto'] = process.argv;
const plan = buildPlan(fs.readFileSync(scriptFile, 'utf8'), { mascot: true, candy: process.env.CANDY !== '0' }); if (process.env.CANDY !== '0') plan.candy = true;
plan.tg = { username: 'traffichomyak', title: 'Хомяк на Трафике', promise: 'Таблица «сначала себе»' };
for (const s of plan.scenes) if (s.type === 'tgcta') s.p.where = 'profile';
plan.vertical = true; plan.hook = plan.scenes[0].text;
direct(plan, { seed: +seed, style: chooseStyle(+seed, { theme: 'ink' }), lead: 0 });
const b = await chromium.launch({ args: ['--no-sandbox', '--force-color-profile=srgb'] });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('PAGE:', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
await page.goto('file://' + ROOT + '/src/engine/index.html'); await page.evaluate(() => window.fontsReady()); await page.evaluate(p => window.loadPlan(p), plan);
fs.mkdirSync(outDir, { recursive: true });
const ts = times === 'auto' ? plan.scenes.map(s => s.start + Math.min(s.dur * .6, s.dur - .2)) : times.split(',').map(Number);
for (const t of ts) { const u = await page.evaluate(f => window.grab(f, .85), Math.round(t * 30)); fs.writeFileSync(path.join(outDir, `f_${t.toFixed(2).padStart(6, '0')}.jpg`), Buffer.from(u.split(',')[1], 'base64')); }
plan.scenes.forEach((s, i) => console.log(i, s.start.toFixed(1), s.type, s.p?.place || '', (s.p?.cast || []).map(c => c.name).join('+'), (s.p?.acts || []).map(a => a.who + ':' + a.kind).join(','), '|', s.text.slice(0, 50)));
await b.close();
