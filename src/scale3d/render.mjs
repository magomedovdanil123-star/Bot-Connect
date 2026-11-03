// «Сколько нужно?» 3D: озвучка по фразам (Lumean) → кадры three.js в Chromium (engine/world.js) → голос + музыка + звуки.
// Тайминги и голос можно взять готовые (work/timings.json + voice.wav) — тогда Lumean не трогаем.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { synthesize } from '../voice.js';
import { bookMusic, chromium, toSrt, subChunks } from '../books/render.mjs';
import { renderSfxBus } from '../sfx.js';

const DIR = path.dirname(fileURLToPath(import.meta.url)), FONTS = path.join(DIR, '..', 'jung', 'engine', 'fonts');
const FPS = 24, LEAD = .6;
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; p.stderr.on('data', d => (e += d)); p.on('close', c => (c ? rej(new Error(`${cmd}: ${e.slice(-400)}`)) : res())); });
const GL_ARGS = ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];

function fontCss() {
  const f = n => 'file://' + path.join(FONTS, n), CY = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', LA = 'U+0000-00FF,U+2000-206F,U+2190-21FF,U+2248,U+2264,U+2212,U+2713';
  return [['Montserrat', 900, 'montserrat'], ['Inter', 800, 'inter'], ['Inter', 400, 'inter']]
    .flatMap(([fam, w, b]) => [[`${b}-cyrillic-${w}-normal.woff2`, CY], [`${b}-latin-${w}-normal.woff2`, LA]].map(([file, r]) => `@font-face{font-family:"${fam}";font-weight:${w};src:url("${f(file)}") format("woff2");unicode-range:${r}}`)).join('\n');
}
export function pageHtml(ep, tm, { w = 1920, h = 1080 } = {}) {
  const data = { beats: ep.beats.map(b => ({ shot: b.shot, o: b.o || {}, ui: b.ui || null, badge: b.badge })), defaults: ep.defaults || {}, PH: tm.PH, END: tm.END, caps: tm.caps || [], fps: FPS, w, h, brand: ep.brand || 'СКОЛЬКО НУЖНО?', sets: ep.sets || [] };
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fontCss()}html,body{margin:0;background:#000}#gl{display:none}</style>
<script type="importmap">{"imports":{"three":"file://${path.join(DIR, 'vendor', 'three.module.min.js')}"}}</script></head><body>
<canvas id="gl" width="${w}" height="${h}"></canvas><canvas id="out" width="${w}" height="${h}"></canvas>
<script>window.EP=${JSON.stringify(data)};</script><script type="module" src="file://${path.join(DIR, 'engine', (['flat', 'toon'].includes(ep.engine) ? ep.engine : 'world') + '.js')}"></script></body></html>`;
}
const openPage = async (browser, file, w, h) => { const p = await browser.newPage({ viewport: { width: w, height: h } }); p.on('pageerror', e => console.error('page:', e.message)); await p.goto('file://' + file); await p.waitForFunction(() => window.READY === true, null, { timeout: 120000 }); return p; };

// звуки монтажа: склейка — «вжух», глава — нарастание + удар, крупная цифра — удар, счётчик — тики, лопающиеся шарики — хлопки
function sfxCues(beats, PH) {
  const out = [], at = (i, f) => PH[i].s + f * Math.min(PH[i].d, 5);
  beats.forEach((b, i) => {
    const t0 = PH[i].s - .3, k = b.ui?.kind;
    if (i) out.push(k === 'chapter' ? { t: t0 - 1, kind: 'riser', gain: .16, v: i } : { t: t0 - .05, kind: 'whoosh', gain: .3, pan: i % 2 ? .3 : -.3, v: i });
    if (k === 'chapter') out.push({ t: t0 + .05, kind: 'sub', gain: .5, v: i }, { t: t0 + .05, kind: 'impact', gain: .3, v: i });
    if (k === 'big') out.push({ t: at(i, b.ui.to != null ? .7 : .05), kind: 'impact', gain: .35, v: i });
    if (k === 'big' && b.ui.to != null) for (let j = 0; j < 8; j++) out.push({ t: at(i, .05 + j * .08), kind: 'tick', gain: .14, v: j });
    if (k === 'banner') out.push({ t: at(i, 0), kind: 'shimmer', gain: .3, v: i }, { t: at(i, .12), kind: 'ding', gain: .25, v: i });
    if (k === 'tease') out.push({ t: at(i, .02), kind: 'riser', gain: .2, v: i }, { t: at(i, .5), kind: 'click', gain: .3, v: i });
    if (k === 'rows') [0, 1, 2, 3].forEach(j => out.push({ t: at(i, .1 + j * .14), kind: 'blip', gain: .22, v: j }));
    if (k === 'receipt') b.ui.rows.forEach((_, j) => out.push({ t: at(i, .08 + j * .09), kind: 'blip', gain: .2, v: j }));
    if (k === 'pop') for (let j = 0; j < 14; j++) out.push({ t: at(i, .03 + j * .05), kind: 'hit', gain: .28, pan: (j % 3 - 1) * .5, v: j });
    if (b.shot === 'doorApproach') out.push({ t: at(i, .78), kind: 'click', gain: .35, v: i });
    (b.sfx || []).forEach(([f, kind, gain]) => out.push({ t: at(i, f), kind, gain: gain ?? .3, v: i }));
  });
  return out;
}

/** Ролик целиком. voice: { key, template } — если в work нет готовых timings.json + voice.wav. */
export async function renderScale3d(ep, { out, work, voice, onStage, w = 1920, h = 1080, seconds = null } = {}) {
  fs.mkdirSync(work, { recursive: true });
  const texts = ep.beats.map(b => b.text), tmFile = path.join(work, 'timings.json');
  let vo = fs.existsSync(tmFile) ? JSON.parse(fs.readFileSync(tmFile, 'utf8')) : null;
  if (vo && (vo.timings.length !== texts.length || !fs.existsSync(vo.file))) vo = null;
  if (!vo) { onStage?.('voice'); vo = await synthesize(texts, { ...voice, dir: work, onStatus: (st, pc, part, parts) => onStage?.('voice', { status: st, percent: pc, part, parts }) }); fs.writeFileSync(tmFile, JSON.stringify(vo)); }
  const PH = vo.timings.map(t => ({ s: +(LEAD + t.start).toFixed(3), d: +t.speak.toFixed(3) })), END = LEAD + vo.total, DUR = Math.ceil(END + 2.5), total = seconds ? Math.min(seconds, DUR) : DUR;
  const caps = subChunks(texts, vo.timings, LEAD, 30, 30).map(c => ({ a: +c.a.toFixed(2), b: +c.b.toFixed(2), text: c.text.replace(/\n/g, ' ') }));
  const page = path.join(work, 'page3d.html'); fs.writeFileSync(page, pageHtml(ep, { PH, END, caps }, { w, h }));
  fs.writeFileSync(path.join(work, 'subs.srt'), toSrt(subChunks(texts, vo.timings, LEAD)));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: GL_ARGS });
  try {
    const N = Math.ceil(total * FPS), SEG = 240, segs = []; for (let a = 0; a < N; a += SEG) segs.push([a, Math.min(N, a + SEG)]);
    const segFile = a => path.join(work, `g${String(a).padStart(6, '0')}.mp4`), todo = segs.filter(([a]) => !fs.existsSync(segFile(a)));
    const workers = Math.max(1, Math.min(+(process.env.R3D_WORKERS || 3), os.cpus().length, todo.length)); let done = N - todo.reduce((s, [a, b]) => s + b - a, 0);
    onStage?.('render', { frames: N, workers });
    const worker = async () => {
      const p = await openPage(browser, page, w, h);
      try { for (let job; (job = todo.shift());) {
        const [a, b] = job, part = segFile(a) + '.part.mp4';
        const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', '-g', '48', part], { stdio: ['pipe', 'ignore', 'pipe'] });
        const closed = new Promise(r => ff.on('close', r));
        for (let f = a; f < b; f++) { const url = await p.evaluate(([f2]) => window.grab(f2, .9), [f]); if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r)); done++; if (done % 48 === 0) onStage?.('progress', { done, frames: N }); }
        ff.stdin.end(); if (await closed) throw new Error('ffmpeg упал на куске ' + a); fs.renameSync(part, segFile(a));
      } } finally { await p.close().catch(() => {}); }
    };
    await Promise.all([...Array(workers)].map(worker));
    const list = path.join(work, 'glist.txt'); fs.writeFileSync(list, segs.map(([a]) => `file '${segFile(a)}'`).join('\n'));
    const video = path.join(work, 'video3d.mp4'); await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
    onStage?.('mix');
    const musicFile = path.join(work, 'music3d.wav'); await bookMusic(total, total + 10, musicFile, work);
    const sfxFile = path.join(work, 'sfx3d.wav'); renderSfxBus(sfxCues(ep.beats, PH), total, sfxFile);
    const ms = Math.round(LEAD * 1000);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', vo.file, '-i', musicFile, '-i', sfxFile, '-filter_complex',
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},loudnorm=I=-15:TP=-2:LRA=11,aresample=48000,apad=whole_dur=${total.toFixed(2)},asplit=2[v][vk];[2:a]volume=-16dB[m0];[m0][vk]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=600[m];[3:a]aresample=48000,volume=-7dB[fx];[v][m][fx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.89:level=false[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(2), '-movflags', '+faststart', out]);
    return { file: out, duration: total };
  } finally { await browser.close().catch(() => {}); }
}

/** Пробные кадры без звука: середина каждой выбранной фразы → work/s3d_<i>.jpg (время — из готовых таймингов или по 5 с на фразу). */
export async function stills3d(ep, work, idx = null, at = .6, { w = 1920, h = 1080, clean = false, prefix = 's3d_' } = {}) {   // clean — без надписей и рамки (для обложек)
  fs.mkdirSync(work, { recursive: true });
  const tmf = path.join(work, 'timings.json'), vo = fs.existsSync(tmf) ? JSON.parse(fs.readFileSync(tmf, 'utf8')) : null;
  const PH = vo ? vo.timings.map(t => ({ s: LEAD + t.start, d: t.speak })) : ep.beats.map((_, i) => ({ s: LEAD + i * 5, d: 4.6 })), END = PH.at(-1).s + PH.at(-1).d;
  const page = path.join(work, 'page3d.html'); fs.writeFileSync(page, pageHtml(clean ? { ...ep, beats: ep.beats.map(b => ({ ...b, ui: null })) } : ep, { PH, END, caps: [] }, { w, h }));
  const browser = await chromium.launch({ args: GL_ARGS }), outF = [];
  try { const p = await openPage(browser, page, w, h); if (clean) await p.evaluate(() => { window.NOHUD = true; });
    for (const i of idx || ep.beats.map((_, k) => k)) { const t0 = Date.now(), url = await p.evaluate(f => window.grab(f, .85), Math.round((PH[i].s + (PH[i + 1] ? PH[i + 1].s - PH[i].s : PH[i].d) * at) * FPS)), f = path.join(work, `${prefix}${String(i).padStart(3, '0')}.jpg`);
      fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); outF.push(f); console.log(i, ep.beats[i].shot, Date.now() - t0, 'мс'); }
  } finally { await browser.close(); }
  return outF;
}

/** Выпуск целиком для бота: 3D-ролик + главы + обложки из чистых кадров (ep.covers3d) + SEO канала. Тот же результат, что у renderBody. */
export async function renderEpisode3d(ep, opts = {}) {
  const { scaleMeta } = await import('../scale/render.mjs'), { covers3d } = await import('./covers.mjs');
  const r = await renderScale3d(ep, opts), work = opts.work;
  const vo = JSON.parse(fs.readFileSync(path.join(work, 'timings.json'), 'utf8')), PH = vo.timings.map(t => ({ s: LEAD + t.start }));
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, cap = t => String(t).toLowerCase().replace(/^./, c => c.toUpperCase());
  const chapters = ['0:00 Вступление', ...ep.beats.map((b, i) => (b.ui?.kind === 'chapter' && i > 2 ? `${mmss(Math.max(0, PH[i].s - .3))} ${cap(b.ui.text)}` : null)).filter(Boolean)];
  const specs = ep.covers3d || [{ beat: 0, tag: 'СКОЛЬКО НУЖНО?', lines: [[ep.title.toUpperCase(), 'w']] }];
  const stills = await stills3d(ep, work, specs.map(c => c.beat), .6, { clean: true, prefix: 'cov_' });
  const covers = await covers3d(null, specs.map((c, k) => ({ ...c, img: stills[k] })), path.join(work, 'covers'));
  return { ...r, ...scaleMeta(ep, chapters), chapters, cover: covers[0], covers, subs: path.join(work, 'subs.srt'), timings: vo.timings };
}
