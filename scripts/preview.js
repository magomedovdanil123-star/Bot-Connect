// Быстрое превью: по кадру из каждой сцены -> контакт-лист. node scripts/preview.js сценарий.txt preview.jpg
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { buildPlan } from '../src/planner.js';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }
const DIR = path.dirname(fileURLToPath(import.meta.url));
const [inp, out = 'preview.jpg', at = '0.8'] = process.argv.slice(2);
const plan = buildPlan(fs.readFileSync(inp, 'utf8'));
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--disable-gpu', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('PAGE:', e.message)); page.on('console', m => m.type() === 'error' && console.error('ERR:', m.text()));
await page.goto('file://' + path.join(DIR, '..', 'src', 'engine', 'index.html'));
await page.evaluate(() => window.fontsReady());
const info = await page.evaluate(p => window.loadPlan(p), plan);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prev-'));
for (const [i, s] of info.scenes.entries()) {
  const url = await page.evaluate(f => window.grab(f, .85), Math.round((s.start + s.dur * +at) * 30));
  fs.writeFileSync(path.join(tmp, `f${String(i).padStart(3, '0')}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
}
await b.close();
spawnSync('ffmpeg', ['-v', 'error', '-y', '-pattern_type', 'glob', '-i', path.join(tmp, '*.jpg'), '-vf', 'scale=640:-1,tile=3x4', out.replace(/\.jpg$/, '_%d.jpg')]);
console.log(info.scenes.map((s, i) => `${i + 1} ${s.type}`).join(' | '));
console.log('total', info.total.toFixed(1), 's');
