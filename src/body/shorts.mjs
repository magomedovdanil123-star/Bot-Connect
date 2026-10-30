// Shorts из готового выпуска «Тела изнутри»: 3 вертикальных ролика 9:16 по 15–58 с, куски уже собранного 16:9 — ничего не рисуем заново.
// Сверху метка канала и крючок, в центре кадр выпуска (без вшитых субтитров — их обрезаем), под ним крупные субтитры, внизу «полное видео».
// Какие куски: ep.shorts [{ from: номер фразы, hook }] или начало выпуска + две вставки «А ТЫ ЗНАЛ?» (они понятны без контекста).
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium, subChunks } from '../books/render.mjs';
import { FULL_MARK } from '../books/shorts.mjs';
import { bodyMeta } from './render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), FONTS = path.join(DIR, '..', 'jung', 'engine', 'fonts');
const LEAD = .6, MAX = 58, MIN = 15, STOP = ['day', 'timeline', 'title', 'wow', 'tease', 'ask', 'next'];
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; p.stderr.on('data', d => e += d); p.on('close', c => c ? rej(new Error(cmd + ': ' + e.slice(-400))) : res()); });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function bodyPlan(ep, timings) {
  const wows = ep.beats.map((b, i) => (b.v === 'wow' ? i : -1)).filter(i => i >= 0);
  const specs = ep.shorts?.length ? ep.shorts : [{ from: 0, hook: ep.ytTitle || ep.title }, ...wows.slice(0, 2).map(i => ({ from: i, hook: `А ты знал? ${ep.beats[i].o?.big ? ep.beats[i].o.big + ' — ' : ''}${ep.beats[i].o?.text || ''}`.slice(0, 90) }))];
  const out = [];
  for (const sp of specs) {
    const si = sp.from; if (!timings[si]) continue;
    const start = Math.max(0, LEAD + timings[si].start - .3); let end = 0; const lines = [];
    for (let k = si; k < ep.beats.length && (k === si || !STOP.includes(ep.beats[k].v)); k++) {
      const t = timings[k], e = LEAD + t.start + t.speak + .35; if (e - start > MAX) break;
      end = e; lines.push({ text: ep.beats[k].text, i: k });
    }
    if (end - start < MIN && lines.length) { // короткая вставка — добираем следующую фразу, даже если она начинает новую сцену
      const k = lines.at(-1).i + 1, t = timings[k]; if (t && LEAD + t.start + t.speak + .35 - start <= MAX) { end = LEAD + t.start + t.speak + .35; lines.push({ text: ep.beats[k].text, i: k }); }
    }
    if (end - start >= MIN) out.push({ hook: sp.hook || ep.title, start, dur: end - start, lines });
  }
  // меньше трёх — добираем кусками глав (после заставки «день / этап»), крючок — подпись главы
  if (!ep.shorts?.length) for (const [i, b] of ep.beats.entries()) {
    if (out.length >= 3) break; if (!['day', 'timeline'].includes(b.v) || !timings[i + 1] || out.some(x => x.lines.some(l => l.i === i + 1))) continue;
    const start = Math.max(0, LEAD + timings[i + 1].start - .3); let end = 0; const lines = [];
    for (let k = i + 1; k < ep.beats.length && (k === i + 1 || !STOP.includes(ep.beats[k].v)); k++) { const t = timings[k], e = LEAD + t.start + t.speak + .35; if (e - start > MAX) break; end = e; lines.push({ text: ep.beats[k].text, i: k }); }
    const lab = b.v === 'day' ? `${b.o.word || 'День'} ${b.o.n}` : b.o.marks?.[b.o.at] || '';
    if (end - start >= MIN) out.push({ hook: `${(ep.ytTitle || ep.title).replace(/[?.]$/, '')}: ${lab.toLowerCase()}${b.o.sub ? ' — ' + b.o.sub : ''}`.slice(0, 90), start, dur: end - start, lines });
  }
  return out;
}

export async function bodyShorts(ep, { video, work, outDir, signal, timings = null } = {}) {
  const vo = timings ? { timings } : JSON.parse(fs.readFileSync(path.join(work, 'timings.json'), 'utf8')), plan = bodyPlan(ep, vo.timings);
  if (!plan.length) return [];
  fs.mkdirSync(outDir, { recursive: true });
  const font = f => fs.readFileSync(path.join(FONTS, f)).toString('base64');
  const ff = (fam, w, file) => `@font-face{font-family:${fam};font-weight:${w};src:url(data:font/woff2;base64,${font(file)})}`;
  const css = [ff('M', 900, 'montserrat-cyrillic-900-normal.woff2'), ff('M', 900, 'montserrat-latin-900-normal.woff2'), ff('I', 800, 'inter-cyrillic-800-normal.woff2'), ff('I', 800, 'inter-latin-800-normal.woff2')].join('') + `
    *{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;font-family:M;font-weight:900;color:#fff}
    .bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,#123056 0%,#08142a 55%,#040912 100%)}
    .a{position:absolute;left:0;width:1080px;text-align:center}.k{font-family:I;font-weight:800;color:#38d6ff;letter-spacing:4px}`;
  const meta = bodyMeta(ep), short = [];
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const shot = async (html, w, h, file, transparent) => { await page.setViewportSize({ width: w, height: h }); await page.setContent(`<style>${css}</style>${html}`); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: file, omitBackground: transparent }); };
    for (const [k, sh] of plan.entries()) {
      if (signal?.aborted) throw Object.assign(new Error('STOPPED'), { stopped: true });
      const dir = path.join(outDir, `short${k + 1}`); fs.mkdirSync(dir, { recursive: true });
      const hs = sh.hook.length > 60 ? 64 : sh.hook.length > 34 ? 76 : 92;
      await shot(`<div class=bg></div>
        <div class="a k" style="top:150px;font-size:34px">${esc((ep.brand || 'РЕНТГЕН ПРИВЫЧЕК').toUpperCase())} · НАУКА</div>
        <div class=a style="top:205px;height:300px;display:flex;align-items:center;justify-content:center"><div style="width:960px;font-size:${hs}px;line-height:1.06">${esc(sh.hook).replace(/(\d[\d\s,.–%×+−-]*)/g, '<span style="color:#ffd400">$1</span>')}</div></div>
        <div style="position:absolute;left:0;top:527px;width:1080px;height:696px;border-top:4px solid #38d6ff;border-bottom:4px solid #38d6ff;box-shadow:0 0 44px rgba(56,214,255,.4)"></div>
        <div class="a k" style="top:1590px;font-size:40px;color:#ffd400">▶ ПОЛНОЕ ВИДЕО — НА КАНАЛЕ</div>`, 1080, 1920, path.join(dir, 'base.png'));
      const caps = subChunks(sh.lines.map(l => l.text), sh.lines.map(l => vo.timings[l.i]), LEAD - sh.start, 30, 18);
      for (const [j, c] of caps.entries())
        await shot(`<div class=a style="top:0;height:250px;display:flex;align-items:center;justify-content:center"><div style="width:860px;margin-left:-80px;font-size:70px;line-height:1.1;-webkit-text-stroke:3px #000;paint-order:stroke fill;text-shadow:0 4px 14px #000">${esc(c.text).replace(/\n/g, '<br>').replace(/(\d[\d\s,.–%]*)/g, '<span style="color:#ffd400">$1</span>')}</div></div>`, 1080, 250, path.join(dir, `c${j}.png`), true);
      const file = path.join(outDir, `short${k + 1}.mp4`), ins = caps.flatMap((c, j) => ['-i', path.join(dir, `c${j}.png`)]);
      // кадр выпуска: 1400 по ширине, сверху вниз до вшитых субтитров (они ниже ~690 px) — свои крупные субтитры идут под кадром
      let f = `[1:v]scale=1400:-2,crop=1080:690:160:0,setsar=1[v];[0:v][v]overlay=0:530:shortest=1[b0]`;
      caps.forEach((c, j) => { f += `;[b${j}][${j + 2}:v]overlay=0:1290:enable='between(t,${Math.max(0, c.a).toFixed(2)},${Math.min(sh.dur, c.b + .08, caps[j + 1]?.a ?? 1e9).toFixed(2)})'[b${j + 1}]`; });
      await run('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-framerate', '24', '-i', path.join(dir, 'base.png'), '-ss', sh.start.toFixed(2), '-t', sh.dur.toFixed(2), '-i', video, ...ins,
        '-filter_complex', f, '-map', `[b${caps.length}]`, '-map', '1:a', '-af', `afade=t=in:d=0.15,afade=t=out:st=${(sh.dur - .5).toFixed(2)}:d=0.5`, '-t', sh.dur.toFixed(2), '-r', '24',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', file]);
      fs.rmSync(dir, { recursive: true, force: true });
      const own = k === 0, title = (own ? `${ep.ytTitle || ep.title}` : `${sh.hook}`).slice(0, 100);
      short.push({ file, hook: sh.hook, dur: sh.dur, title,
        description: [sh.hook, '', `Полное видео «${ep.ytTitle || ep.title}»:`, FULL_MARK, '', '#shorts #рентгенпривычек #здоровье #организм #научпоп'].join('\n'),
        tags: [...meta.tags.slice(0, 12), 'shorts', 'научпоп shorts', 'организм человека shorts'] });
    }
  } finally { await browser.close().catch(() => {}); }
  return short;
}
