// Shorts из готового обзора: 3 вертикальных ролика 9:16 по 20–58 с. Куски берём из уже собранного 16:9 (лист с рукой и голосом) —
// ничего не рисуем заново: сверху крючок, в центре лист, под ним крупные субтитры, внизу «полный обзор — на канале».
// Зона безопасности Shorts: важное — между y 150 и 1500 и левее кнопок справа.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { LEAD, chromium, subChunks, bookMeta, psyMeta, hashtag } from './render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), NM = path.join(DIR, '..', '..', 'node_modules');
const MAX = 58, MIN = 15;
export const FULL_MARK = '🔗 ссылка на полный обзор появится здесь при публикации';
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; p.stderr.on('data', d => e += d); p.on('close', c => c ? rej(new Error(cmd + ': ' + e.slice(-400))) : res()); });
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Какие куски резать: book.shorts [{ from: 'название главы' | номер листа, hook }] или первые идеи; не хватает до count — добираем следующими идеями. */
export function shortPlan(book, timings, count = 3) {
  const base = []; let li = 0; for (const sc of book.screens) { base.push(li); li += sc.lines.length; }
  const ideas = book.screens.map((s, i) => s.idea && s.ch ? { from: i, hook: s.ch.replace(/^(Идея|Часть) \d+\.\s*/, '') } : null).filter(Boolean);
  const specs = [...(book.shorts || [])].slice(0, count), at = sp => typeof sp.from === 'number' ? sp.from : book.screens.findIndex(s => s.ch === sp.from);
  for (const x of ideas) { if (specs.length >= count) break; if (!specs.some(sp => at(sp) === x.from)) specs.push(x); }
  specs.sort((a, b) => at(a) - at(b));
  const out = [];
  for (const sp of specs) {
    const si = typeof sp.from === 'number' ? sp.from : book.screens.findIndex(s => s.ch === sp.from); if (si < 0) continue;
    const start = Math.max(0, LEAD + timings[base[si]].start - .5); let end = 0, lines = [];
    for (let k = si; k < book.screens.length && (k === si || !book.screens[k].ch); k++)
      for (const [j, l] of book.screens[k].lines.entries()) { const t = timings[base[k] + j], e = LEAD + t.start + t.speak + .35; if (e - start > MAX) { k = 1e9; break; } end = e; lines.push({ text: l, i: base[k] + j }); }
    if (end - start >= MIN) out.push({ hook: sp.hook || book.screens[si].ch || book.title, start, dur: end - start, lines });
  }
  return out;
}

// standalone — отдельный Shorts на свою тему (⚡ Психофакт Shorts): ролик целиком, сверху бренд, внизу призыв подписаться, без ссылки на «полный обзор»
export async function bookShorts(book, { video, work, outDir, signal, timings = null, kind = 'book', standalone = false, count = 3 } = {}) {
  const psy = kind === 'psy';
  const vo = timings ? { timings } : JSON.parse(fs.readFileSync(path.join(work, 'timings.json'), 'utf8')), plan = shortPlan(book, vo.timings, count);
  if (!plan.length) return [];
  fs.mkdirSync(outDir, { recursive: true });
  const font = f => fs.readFileSync(path.join(NM, '@fontsource/amatic-sc/files', f)).toString('base64');
  const css = `@font-face{font-family:A;src:url(data:font/woff2;base64,${font('amatic-sc-cyrillic-700-normal.woff2')})}@font-face{font-family:A;src:url(data:font/woff2;base64,${font('amatic-sc-latin-700-normal.woff2')})}
    *{margin:0;padding:0;box-sizing:border-box}html,body{background:transparent;font-family:A;font-weight:700;color:#151515}
    .paper{position:absolute;inset:0;background:#fffefb;background-image:radial-gradient(rgba(0,0,0,.04) 1.5px,transparent 1.5px);background-size:30px 30px}
    .a{position:absolute;left:0;width:1080px;text-align:center}`;
  const meta = psy ? psyMeta(book) : bookMeta(book), short = [];
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    const shot = async (html, w, h, file, transparent) => { await page.setViewportSize({ width: w, height: h }); await page.setContent(`<style>${css}</style>${html}`); await page.evaluate(() => document.fonts.ready); await page.screenshot({ path: file, omitBackground: transparent }); };
    for (const [k, sh] of plan.entries()) {
      if (signal?.aborted) throw Object.assign(new Error('STOPPED'), { stopped: true });
      const dir = path.join(outDir, `short${k + 1}`); fs.mkdirSync(dir, { recursive: true });
      const hook = sh.hook.toUpperCase(), hs = hook.length > 60 ? 86 : hook.length > 34 ? 100 : 118;
      await shot(`<div class=paper></div>
        <div class=a style="top:96px;font-size:52px;color:#d62828;letter-spacing:1px">${standalone ? 'ПСИХОФАКТ' : `${psy ? 'ПСИХОЛОГИЯ: ' : 'ОБЗОР КНИГИ «'}${esc(book.title.toUpperCase())}${psy ? '' : '»'}`}</div>
        <div class=a style="top:160px;height:320px;display:flex;align-items:center;justify-content:center"><div style="width:960px;font-size:${hs}px;line-height:1.02">${esc(hook)}</div></div>
        <div style="position:absolute;left:-6px;top:494px;width:1092px;height:799px;border-top:6px solid #151515;border-bottom:6px solid #151515"></div>
        <div class=a style="top:1560px;font-size:58px;color:#d62828">${standalone ? '▶ ПОДПИШИСЬ — НОВЫЙ ФАКТ КАЖДЫЙ ДЕНЬ' : psy ? '▶ ПОЛНЫЙ РАЗБОР — НА КАНАЛЕ' : '▶ ПОЛНЫЙ ОБЗОР — НА КАНАЛЕ'}</div>`, 1080, 1920, path.join(dir, 'base.png'));
      const caps = subChunks(sh.lines.map(l => l.text), sh.lines.map(l => vo.timings[l.i]), LEAD - sh.start, 46, 24);
      for (const [j, c] of caps.entries())
        await shot(`<div class=a style="top:0;height:230px;display:flex;align-items:center;justify-content:center"><div style="width:860px;margin-left:-80px;font-size:82px;line-height:1.05">${esc(c.text.toUpperCase()).replace(/\n/g, '<br>')}</div></div>`, 1080, 230, path.join(dir, `c${j}.png`), true);
      const file = path.join(outDir, `short${k + 1}.mp4`), ins = caps.flatMap((c, j) => ['-i', path.join(dir, `c${j}.png`)]);
      let f = `[1:v]scale=1400:-2,crop=1080:787,setsar=1[v];[0:v][v]overlay=0:500:shortest=1[b0]`;
      caps.forEach((c, j) => { f += `;[b${j}][${j + 2}:v]overlay=0:1305:enable='between(t,${Math.max(0, c.a).toFixed(2)},${Math.min(sh.dur, c.b + .08, caps[j + 1]?.a ?? 1e9).toFixed(2)})'[b${j + 1}]`; });
      await run('ffmpeg', ['-y', '-v', 'error', '-loop', '1', '-framerate', '25', '-i', path.join(dir, 'base.png'), '-ss', sh.start.toFixed(2), '-t', sh.dur.toFixed(2), '-i', video, ...ins,
        '-filter_complex', f, '-map', `[b${caps.length}]`, '-map', '1:a', '-af', `afade=t=in:d=0.15,afade=t=out:st=${(sh.dur - .5).toFixed(2)}:d=0.5`, '-t', sh.dur.toFixed(2), '-r', '25',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', file]);
      fs.rmSync(dir, { recursive: true, force: true });
      const title = `${sh.hook} | «${book.title}»`.slice(0, 100);
      short.push({ file, hook: sh.hook, dur: sh.dur, title,
        description: [sh.hook, '', psy ? `Полный разбор «${book.title}» — простыми словами за 7 минут:` : `Полный обзор книги «${book.title}» (${book.author}) — главные идеи за 15 минут:`, FULL_MARK, '', ['#shorts', psy ? '#психология' : '#обзоркниги', hashtag(book.title)].join(' ')].join('\n'),
        tags: [...meta.tags.slice(0, 12), 'shorts', psy ? 'психология shorts' : 'книги shorts'] });
    }
  } finally { await browser.close().catch(() => {}); }
  return short;
}
