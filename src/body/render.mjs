// «Тело изнутри»: научпоп «что будет с организмом, если…». Визуал рисуется кодом (движок code-cartoon, MIT, общий с «Подвалом Разума»):
// тёмный «сканер», светящиеся органы, частицы сахара и инсулина, графики. Сценарий = список фраз (beats), у каждой — своя картинка.
// Пайплайн тот же, что у лекций Юнга: озвучка по фразам → кадры в Chromium → голос + музыка → обложки и SEO.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { synthesize } from '../voice.js';
import { bookMusic, chromium, toSrt, subChunks } from '../books/render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ENG = path.join(DIR, 'engine'), JENG = path.join(DIR, '..', 'jung', 'engine');
const FPS = 24, LEAD = .6;
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; p.stderr.on('data', d => (err += d)); p.on('close', c => (c ? rej(new Error(`${cmd}: ${err.slice(-400)}`)) : res(err))); });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const fontCss = () => {
  const f = n => 'file://' + path.join(JENG, 'fonts', n), CY = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', LA = 'U+0000-00FF,U+2000-206F,U+2190-21FF,U+2248,U+2264,U+2713';
  return [['Montserrat', 900, 'montserrat'], ['Montserrat', 800, 'montserrat'], ['Inter', 800, 'inter'], ['Inter', 400, 'inter']]
    .flatMap(([fam, w, base]) => [[`${base}-cyrillic-${w}-normal.woff2`, CY], [`${base}-latin-${w}-normal.woff2`, LA]].map(([file, r]) => `@font-face{font-family:"${fam}";font-weight:${w};src:url("${f(file)}") format("woff2");unicode-range:${r}}`)).join('\n');
};
function pageHtml(lecture, tm) {
  const cues = { duration: tm.DUR, fps_draw: FPS, events: [], music: { enabled: false } };
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}
html,body{margin:0;background:#000}.w{position:absolute;left:-9999px;font:900 20px Montserrat}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="${tm.DUR}"><canvas id="stage" width="1920" height="1080"></canvas></div>
<div class="w">Аа<b style="font:800 20px Inter">Аа</b><span style="font:400 20px Inter">Аа</span><span style="font:800 20px Montserrat">Аа</span></div>
<script>window.gsap={timeline:()=>({to(){return this}})};window.CUES=${JSON.stringify(cues)};window.LECTURE=${JSON.stringify(lecture)};window.TM=${JSON.stringify(tm)};</script>
<script src="file://${path.join(JENG, 'palettes.js')}"></script><script src="file://${path.join(JENG, 'sketch.js')}"></script><script src="file://${path.join(ENG, 'scene.js')}"></script>
<script>window.grab=(f,q)=>{Sketch.render(f/${FPS});return document.getElementById('stage').toDataURL('image/jpeg',q)};</script></body></html>`;
}
const openPage = async (browser, page) => { const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto('file://' + page); await p.waitForFunction(() => window.__hf?.buildReady?.['sketch-main'] && window.Sketch?.render, null, { timeout: 60000 }); await p.evaluate(() => window.__hf.buildReady['sketch-main']); return p; };

// обложка: крупная цифра/слово, вторая строка, акцент жёлтым, справа — кадр с органом из самого ролика
export async function bodyCovers(browser, ep, work, page, PH) {
  const out = [], p = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  try {
    for (const [i, c] of (ep.covers || []).slice(0, 3).entries()) {
      const at = c.beat ?? ep.beats.findIndex(b => b.v === (c.organ === 'can' ? 'pile' : c.organ)), frame = path.join(work, `cover_bg${i}.jpg`);
      const pg = await openPage(browser, page); const url = await pg.evaluate(([f]) => { window.NOHUD = true; return window.grab(f, .92); }, [Math.round(((PH[Math.max(0, at)]?.s || 1) + (PH[Math.max(0, at)]?.d || 4) * .85) * FPS)]); await pg.close();
      fs.writeFileSync(frame, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      const html = path.join(work, `cover${i}.html`);
      fs.writeFileSync(html, `<!doctype html><meta charset=utf-8><style>${fontCss()}*{margin:0}body{width:1280px;height:720px;overflow:hidden;background:#050a14;font-family:Montserrat}
#bg{position:absolute;right:-${c.shift ?? 420}px;top:0;height:720px;width:1280px;background:url("file://${frame}") center/cover;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 30%)}
#t{position:absolute;left:56px;top:0;height:720px;display:flex;flex-direction:column;justify-content:center;font-weight:900;color:#fff;line-height:.98;text-shadow:0 6px 24px #000}
.a{font-size:150px}.b{font-size:120px;color:#ff4d6a}.c{font-size:58px;color:#ffb02e;margin-top:16px;font-weight:800}</style>
<div id=bg></div><div id=t><div class=a>${esc(c.big)}</div><div class=b>${esc(c.line)}</div>${c.accent ? `<div class=c>${esc(c.accent)}</div>` : ''}</div>
<script>document.fonts.ready.then(()=>document.title='ready')</script>`);
      await p.goto('file://' + html); await p.waitForFunction(() => document.title === 'ready');
      const f = path.join(work, i ? `cover_${i + 1}.jpg` : 'cover.jpg'); fs.writeFileSync(f, await p.screenshot({ type: 'jpeg', quality: 92 })); out.push(f);
    }
  } finally { await p.close().catch(() => {}); }
  return out;
}

export function bodyMeta(ep, chapters = [], total = 0) {
  const title = (ep.ytTitle || ep.title).slice(0, 100), seen = new Set();
  const tags = [...(ep.tags || []), 'организм человека', 'научпоп', 'здоровье', 'что будет если', 'анатомия', 'тело человека']
    .map(t => t.replace(/[,<>"«»]/g, ' ').replace(/\s+/g, ' ').trim()).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 25);
  const description = [ep.about || ep.title, '', ...(chapters.length >= 3 ? ['Содержание:', ...chapters, ''] : []), ...(ep.comment ? [`💬 ${ep.comment}`, ''] : []),
    ...(ep.sources?.length ? ['Источники:', ...ep.sources.map(s => '• ' + s), ''] : []),
    'Это научно-популярный ролик, а не медицинская консультация.', '', '#здоровье #организм #научпоп'].join('\n');
  return { title, titles: [title, ...(ep.titles || [])].map(t => t.slice(0, 100)), tags, description, comment: ep.comment || null };
}

/** Ролик целиком: озвучка → кадры → музыка → обложки → SEO. ep: { title, beats: [{ v, o, text, day? }], covers, … } */
export async function renderBody(ep, { out, work, voice, onStage, onProgress, seconds = null } = {}) {
  fs.mkdirSync(work, { recursive: true });
  const texts = ep.beats.map(b => b.text), tmFile = path.join(work, 'timings.json');
  let vo = fs.existsSync(tmFile) ? JSON.parse(fs.readFileSync(tmFile, 'utf8')) : null;
  if (vo && (vo.timings.length !== texts.length || !fs.existsSync(vo.file))) vo = null;
  if (!vo) { onStage?.('voice'); vo = await synthesize(texts, { ...voice, dir: work, onStatus: (st, pc, part, parts) => onStage?.('voice', { status: st, percent: pc, part, parts }) }); fs.writeFileSync(tmFile, JSON.stringify(vo)); }
  const PH = vo.timings.map(t => ({ s: +(LEAD + t.start).toFixed(3), d: +t.speak.toFixed(3) })), END = LEAD + vo.total;
  const total = seconds ? Math.min(seconds, END + 3) : Math.ceil(END + 3), DUR = Math.ceil(END + 3);
  const page = path.join(work, 'page.html'); fs.writeFileSync(page, pageHtml({ title: ep.title, beats: ep.beats, brand: ep.brand }, { PH, LEAD, END, DUR }));
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const chapters = ['0:00 Вступление', ...ep.beats.map((b, i) => (b.v === 'day' ? `${mmss(PH[i].s - .3)} День ${b.o.n}${b.o.text ? ' — ' + b.o.text : ''}` : b.v === 'title' && i > 5 ? `${mmss(PH[i].s - .3)} ${b.o.text === 'ДЕНЬ 31' ? 'Что будет, если бросить' : b.o.text}` : null)).filter(Boolean)];
  const meta = bodyMeta(ep, chapters, END);
  const subs = path.join(work, 'subs.srt'); fs.writeFileSync(subs, toSrt(subChunks(texts, vo.timings, LEAD)));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--disable-dev-shm-usage', '--allow-file-access-from-files'] });
  try {
    const cv = await bodyCovers(browser, ep, work, page, PH);
    const N = Math.ceil(total * FPS), SEG = 480, segs = []; for (let a = 0; a < N; a += SEG) segs.push([a, Math.min(N, a + SEG)]);
    const segFile = a => path.join(work, `s${String(a).padStart(6, '0')}.mp4`), key = JSON.stringify({ N, b: ep.beats.length, v: 1 });
    if ((() => { try { return fs.readFileSync(path.join(work, 'key.json'), 'utf8'); } catch { return ''; } })() !== key) { for (const f of fs.readdirSync(work)) if (/^s\d+\.mp4/.test(f)) fs.rmSync(path.join(work, f)); fs.writeFileSync(path.join(work, 'key.json'), key); }
    const todo = segs.filter(([a]) => !fs.existsSync(segFile(a))); let done = N - todo.reduce((s, [a, b]) => s + b - a, 0);
    const memW = Math.floor((os.freemem() - 400 * 2 ** 20) / (500 * 2 ** 20)), workers = Math.max(1, Math.min(6, os.cpus().length, memW, todo.length));
    onStage?.('render', { frames: N, workers });
    const worker = async () => {
      const p = await openPage(browser, page);
      try {
        for (let job; (job = todo.shift());) {
          const [a, b] = job, part = segFile(a) + '.part.mp4';
          const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-g', '48', part], { stdio: ['pipe', 'ignore', 'inherit'] });
          const closed = new Promise(r => ff.on('close', r));
          for (let f = a; f < b; f++) { const url = await p.evaluate(([f, q]) => window.grab(f, q), [f, .9]); if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r)); if (++done % 120 === 0) onProgress?.(done / N); }
          ff.stdin.end(); if (await closed) throw new Error('ffmpeg упал на куске ' + a);
          fs.renameSync(part, segFile(a));
        }
      } finally { await p.close().catch(() => {}); }
    };
    await Promise.all([...Array(workers)].map(worker));
    const list = path.join(work, 'list.txt'); fs.writeFileSync(list, segs.map(([a]) => `file '${segFile(a)}'`).join('\n'));
    const video = path.join(work, 'video.mp4'); await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
    const musicFile = path.join(work, 'music.wav'); await bookMusic(total, total + 10, musicFile, work);
    const ms = Math.round(LEAD * 1000);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', vo.file, '-i', musicFile, '-filter_complex',
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},loudnorm=I=-15:TP=-2:LRA=11,aresample=48000,apad=whole_dur=${total.toFixed(2)},asplit=2[v][vk];[2:a]volume=-17dB[m0];[m0][vk]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=600[m];[v][m]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.89:level=false[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(2), '-movflags', '+faststart', out]);
    fs.rmSync(musicFile, { force: true });
    return { file: out, subs, cover: cv[0], covers: cv, chapters, duration: total, ...meta };
  } finally { await browser.close().catch(() => {}); }
}

/** Предпросмотр без озвучки: кадр из каждой выбранной фразы (по 4 с на фразу) → work/still_<i>.jpg */
export async function bodyStills(ep, work, idx = null, at = .75) {
  fs.mkdirSync(work, { recursive: true });
  const n = ep.beats.length, PH = ep.beats.map((_, i) => ({ s: +(LEAD + i * 4).toFixed(3), d: 3.6 })), END = LEAD + n * 4, DUR = Math.ceil(END + 2);
  const page = path.join(work, 'page.html'); fs.writeFileSync(page, pageHtml({ title: ep.title, beats: ep.beats, brand: ep.brand }, { PH, LEAD, END, DUR }));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] }), out = [];
  try {
    const p = await openPage(browser, page);
    for (const i of idx || ep.beats.map((_, k) => k)) { const url = await p.evaluate(f => window.grab(f, .85), Math.round((PH[i].s + PH[i].d * at) * FPS)), f = path.join(work, `still_${String(i).padStart(3, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); out.push(f); }
  } finally { await browser.close(); }
  return out;
}
