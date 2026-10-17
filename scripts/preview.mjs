// Предпросмотр кадров без рендера видео: node scripts/preview.mjs <script> <seed> <outdir> <t1,t2,...>
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module';
const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const { buildPlan } = await import(ROOT + '/src/planner.js'); const { direct } = await import(ROOT + '/src/director.js');
const require = createRequire(ROOT + '/src/render.js'); let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }
const [,, scriptFile, seed, outDir, times] = process.argv;
const plan = buildPlan(fs.readFileSync(scriptFile, 'utf8')); direct(plan, { seed: +seed }); if (process.env.VERT) plan.vertical = true;
const b = await chromium.launch({ args: ['--no-sandbox', '--force-color-profile=srgb'] });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('PAGE:', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
await page.goto('file://' + ROOT + '/src/engine/index.html'); await page.evaluate(() => window.fontsReady()); await page.evaluate(p => window.loadPlan(p), plan);
fs.mkdirSync(outDir, { recursive: true });
for (const t of times.split(',')) { const u = await page.evaluate(f => window.grab(f, .9), Math.round(+t * 30)); fs.writeFileSync(path.join(outDir, `f_${(+t).toFixed(2).padStart(6, '0')}.jpg`), Buffer.from(u.split(',')[1], 'base64')); }
await b.close();
