// Тест «Зверо-новости 2.0»: node run.mjs <out_dir> [times] — без times рендерит весь ролик в mp4
import fs from 'fs'; import path from 'path'; import { createRequire } from 'module'; import { spawnSync } from 'child_process';
const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..');
const { buildPlan } = await import(ROOT + '/src/planner.js'); const { direct, chooseStyle } = await import(ROOT + '/src/director.js'); const { renderSfxBus } = await import(ROOT + '/src/sfx.js');
const { chromium } = createRequire(ROOT + '/src/render.js')('playwright');
const [,, outDir, times] = process.argv;
const plan = buildPlan(fs.readFileSync(path.join(HERE, 'script.txt'), 'utf8'), { mascot: true, candy: true }); plan.candy = true; plan.vertical = true; plan.hook = null;
if (process.env.MEDIA) plan.media = JSON.parse(fs.readFileSync(process.env.MEDIA, 'utf8'));
const S = plan.scenes, at = re => S.find(s => re.test(s.text));
// «Подписка…» — не вставка, а студия: Крот прихлёбывает кофе, пока Сова называет цену
const price = at(/Подписка/), n2 = at(/Новость вторая/);
price.p = { ...n2.p, news: { ...n2.p.news, start: false }, insert: false, mi: undefined, place: 'newsroom', acts: [{ who: 'Сова', kind: 'talk', wi: 0, value: '' }], sip: true };
const spit = at(/Сколько/); spit.p.spit = true; spit.p.crash = true; 
at(/три дня/).p.pops = [{ who: 'Крот', kind: 'sweat', at: 1.2 }];
at(/Поздравляем/).p.pops = [{ who: 'Сова', kind: 'hearts', at: .3 }, { who: 'Крот', kind: 'hearts', at: .6 }];
at(/потискать/).p.pops = [{ who: 'Сова', kind: 'wow', at: .4 }];
direct(plan, { seed: 5, style: chooseStyle(5, { theme: 'ink' }), lead: 0 });
// вспышки папарацци: по краям кадра, 2–3 в секунду, только в студии рубрики «Звёзды»
const flashes = []; let k = 0;
for (const s of plan.scenes) if (s.p?.rubric === 'stars' && !s.p.insert && !s.p.hook) for (let t = s.start + (s.p.rubricStart ? 1.3 : .2); t < s.start + s.dur - .2; t += .3 + ((k * 37) % 10) / 20) { k++; flashes.push({ t, x: k % 2 ? 90 + (k * 53) % 180 : 830 + (k * 71) % 170, y: 520 + (k * 131) % 700 }); }
plan.fx = { flashes };
const b = await chromium.launch({ args: ['--no-sandbox', '--force-color-profile=srgb'] });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', e => console.error('PAGE:', e.message)); page.on('console', m => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
await page.goto('file://' + ROOT + '/src/engine/index.html'); await page.evaluate(() => window.fontsReady());
const info = await page.evaluate(p => window.loadPlan(p), plan); await page.evaluate(() => window.newsMediaReady?.());
await page.addScriptTag({ content: fs.readFileSync(path.join(HERE, 'patch.js'), 'utf8') });
fs.mkdirSync(outDir, { recursive: true });
const frames = times ? times.split(',').map(t => Math.round(+t * 30)) : [...Array(info.frames).keys()];
for (const f of frames) { const u = await page.evaluate(f => window.grab(f, .9), f); fs.writeFileSync(path.join(outDir, `f_${String(f).padStart(5, '0')}.jpg`), Buffer.from(u.split(',')[1], 'base64')); }
await b.close();
plan.scenes.forEach((s, i) => console.log(i, s.start.toFixed(1), s.dur.toFixed(1), s.p?.rubric || '', s.p?.insert ? 'INS' : '', '|', s.text.slice(0, 40)));
if (!times) {
  const st = s => s.start, cues = [...(plan.sfx || [])];
  for (const f of flashes) cues.push({ t: f.t, kind: 'click', gain: .55 }, { t: f.t + .02, kind: 'air', gain: .25 });
  for (const s of plan.scenes) {
    if (s.p?.rubric === 'ai' && (s.p.rubricStart || s.p.news?.start)) cues.push({ t: st(s) + (s.p.rubricStart ? 1.05 : 0), kind: 'glitch', gain: .7 });
    if (s.p?.rubric === 'good' && s.p.news?.start) cues.push(...[0, .08, .15, .22].map((d, i) => ({ t: st(s) + .35 + d, kind: 'pop', gain: .6, v: i })), { t: st(s) + .4, kind: 'shimmer', gain: .6 });
    if (s.p?.sip) cues.push(...[.9, 1.6, 2.3].map(d => ({ t: st(s) + d, kind: 'plop', gain: .45 })));
    if (s.p?.spit) cues.push({ t: st(s), kind: 'huff', gain: 1 }, { t: st(s) + .02, kind: 'impact', gain: .6 }, { t: st(s) + .25, kind: 'boing', gain: .5 });
    for (const pp of s.p?.pops || []) cues.push({ t: st(s) + pp.at, kind: pp.kind === 'hearts' ? 'ding' : pp.kind === 'sweat' ? 'squeak' : 'pop', gain: .5 });
    if (/три дня/.test(s.text)) cues.push({ t: st(s) + s.dur - .9, kind: 'badum', gain: .7 });
  }
  renderSfxBus(cues, info.total, path.join(outDir, 'sfx.wav'));
  const audio = process.env.VOICE ? ['-i', process.env.VOICE] : [];
  spawnSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', path.join(outDir, 'f_%05d.jpg'), '-i', path.join(outDir, 'sfx.wav'), ...audio, ...(audio.length ? ['-filter_complex', '[1:a][2:a]amix=inputs=2:normalize=0[a]', '-map', '0:v', '-map', '[a]'] : []), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-shortest', path.join(outDir, 'zveronews_test.mp4')], { stdio: 'inherit' });
}
