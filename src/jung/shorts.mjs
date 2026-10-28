// Shorts из готовой лекции «Подвала Разума»: 3 вертикальных ролика 9:16 по 15–58 с. Куски берём из уже собранного 16:9 —
// ничего не рисуем заново: тёмный фон канала, сверху тема и крючок, в центре кадр лекции, под ним крупные субтитры, внизу «полная лекция — на канале».
// Зона безопасности Shorts: важное — между y 150 и 1500 и левее кнопок справа.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium, subChunks } from '../books/render.mjs';
import { FULL_MARK } from '../books/shorts.mjs';
import { jungMeta } from './render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), FONTS = path.join(DIR, 'engine', 'fonts');
const LEAD = .8, MAX = 58, MIN = 15;
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; p.stderr.on('data', d => e += d); p.on('close', c => c ? rej(new Error(cmd + ': ' + e.slice(-400))) : res()); });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const cap = s => s.replace(/^./, c => c.toUpperCase());

/** Какие куски резать: ep.shorts [{ from: номер фразы | название главы, hook }] или вступление + первые две главы. */
export function lecturePlan(ep, timings) {
  const ch = ep.beats.map((b, i) => b.v === 'chapter' ? i : -1).filter(i => i >= 0);
  const chHook = i => { const o = ep.beats[i].o || {}; return o.n ? `${cap(o.word || 'шаг')} ${o.n}: ${o.title || ''}` : o.title || ep.title; };
  const specs = ep.shorts?.length ? ep.shorts : [{ from: 0, hook: ep.title }, ...ch.slice(0, 2).map(i => ({ from: i + 1, hook: chHook(i) }))];
  const out = [];
  for (const sp of specs) {
    const si = typeof sp.from === 'number' ? sp.from : ep.beats.findIndex(b => b.v === 'chapter' && b.o?.title === sp.from) + 1; if (si < 1 && typeof sp.from !== 'number' || !timings[si]) continue;
    const start = Math.max(0, LEAD + timings[si].start - .3); let end = 0; const lines = [];
    for (let k = si; k < ep.beats.length && ep.beats[k].v !== 'chapter' && ep.beats[k].v !== 'mandala'; k++) {
      const t = timings[k], e = LEAD + t.start + t.speak + .35; if (e - start > MAX) break;
      end = e; lines.push({ text: ep.beats[k].text, i: k });
    }
    if (end - start >= MIN) out.push({ hook: sp.hook || ep.title, start, dur: end - start, lines });
  }
  return out;
}

export async function lectureShorts(ep, { video, work, outDir, signal, timings = null } = {}) {
  const vo = timings ? { timings } : JSON.parse(fs.readFileSync(path.join(work, 'timings.json'), 'utf8')), plan = lecturePlan(ep, vo.timings);
  if (!plan.length) return [];
  fs.mkdirSync(outDir, { recursive: true });
  const font = f => fs.readFileSync(path.join(FONTS, f)).toString('base64');
  const ff = (fam, w, st, file) => `@font-face{font-family:${fam};font-weight:${w};font-style:${st};src:url(data:font/woff2;base64,${font(file)})}`;
  const css = [ff('L', 600, 'normal', 'lora-cyrillic-600-normal.woff2'), ff('L', 600, 'normal', 'lora-latin-600-normal.woff2'), ff('I', 800, 'normal', 'inter-cyrillic-800-normal.woff2'), ff('I', 800, 'normal', 'inter-latin-800-normal.woff2')].join('') + `
    *{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;font-family:L;font-weight:600;color:#f3e6cf}
    .bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,#33241c 0%,#1d1411 55%,#0f0a08 100%)}
    .a{position:absolute;left:0;width:1080px;text-align:center}.k{font-family:I;font-weight:800;color:#e8b86a;letter-spacing:4px}`;
  const meta = jungMeta(ep), short = [];
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const shot = async (html, w, h, file, transparent) => { await page.setViewportSize({ width: w, height: h }); await page.setContent(`<style>${css}</style>${html}`); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: file, omitBackground: transparent }); };
    for (const [k, sh] of plan.entries()) {
      if (signal?.aborted) throw Object.assign(new Error('STOPPED'), { stopped: true });
      const dir = path.join(outDir, `short${k + 1}`); fs.mkdirSync(dir, { recursive: true });
      const own = sh.hook === ep.title, hs = sh.hook.length > 60 ? 70 : sh.hook.length > 34 ? 82 : 96;
      await shot(`<div class=bg></div>
        <div class="a k" style="top:150px;font-size:34px">КАРЛ ЮНГ · ЛЕКЦИЯ НА НОЧЬ</div>
        ${own ? '' : `<div class=a style="top:206px;font-size:40px;color:#c9a27a;font-style:normal">«${esc(ep.title)}»</div>`}
        <div class=a style="top:${own ? 200 : 258}px;height:${own ? 280 : 222}px;display:flex;align-items:center;justify-content:center"><div style="width:960px;font-size:${hs}px;line-height:1.08">${esc(sh.hook)}</div></div>
        <div style="position:absolute;left:0;top:497px;width:1080px;height:793px;border-top:3px solid #e8b86a;border-bottom:3px solid #e8b86a;box-shadow:0 0 40px rgba(232,184,106,.35)"></div>
        <div class="a k" style="top:1590px;font-size:40px">▶ ПОЛНАЯ ЛЕКЦИЯ — НА КАНАЛЕ</div>`, 1080, 1920, path.join(dir, 'base.png'));
      const caps = subChunks(sh.lines.map(l => l.text), sh.lines.map(l => vo.timings[l.i]), LEAD - sh.start, 46, 24);
      for (const [j, c] of caps.entries())
        await shot(`<div class=a style="top:0;height:250px;display:flex;align-items:center;justify-content:center"><div style="width:860px;margin-left:-80px;font-size:64px;line-height:1.12;text-shadow:0 3px 12px #000">${esc(c.text).replace(/\n/g, '<br>')}</div></div>`, 1080, 250, path.join(dir, `c${j}.png`), true);
      const file = path.join(outDir, `short${k + 1}.mp4`), ins = caps.flatMap((c, j) => ['-i', path.join(dir, `c${j}.png`)]);
      let f = `[1:v]scale=1400:-2,crop=1080:787,setsar=1[v];[0:v][v]overlay=0:500:shortest=1[b0]`;
      caps.forEach((c, j) => { f += `;[b${j}][${j + 2}:v]overlay=0:1310:enable='between(t,${Math.max(0, c.a).toFixed(2)},${Math.min(sh.dur, c.b + .08).toFixed(2)})'[b${j + 1}]`; });
      await run('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-framerate', '24', '-i', path.join(dir, 'base.png'), '-ss', sh.start.toFixed(2), '-t', sh.dur.toFixed(2), '-i', video, ...ins,
        '-filter_complex', f, '-map', `[b${caps.length}]`, '-map', '1:a', '-af', `afade=t=in:d=0.15,afade=t=out:st=${(sh.dur - .5).toFixed(2)}:d=0.5`, '-t', sh.dur.toFixed(2), '-r', '24',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', file]);
      fs.rmSync(dir, { recursive: true, force: true });
      const title = (own ? `${ep.title} | Карл Юнг` : `${sh.hook} | ${ep.title}`).slice(0, 100);
      short.push({ file, hook: sh.hook, dur: sh.dur, title,
        description: [sh.hook, '', `Полная лекция на ночь «${ep.title}» — психология Карла Юнга:`, FULL_MARK, '', '#shorts #карлюнг #психологияотношений #женскаяпсихология'].join('\n'),
        tags: [...meta.tags.slice(0, 12), 'shorts', 'юнг shorts', 'психология shorts'] });
    }
  } finally { await browser.close().catch(() => {}); }
  return short;
}
