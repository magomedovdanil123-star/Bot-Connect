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
import { renderSfxBus } from '../sfx.js';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ENG = path.join(DIR, 'engine'), JENG = path.join(DIR, '..', 'jung', 'engine');
const FPS = 24, LEAD = .6;
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; p.stderr.on('data', d => (err += d)); p.on('close', c => (c ? rej(new Error(`${cmd}: ${err.slice(-400)}`)) : res(err))); });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// монтаж: какой переход у фразы. Главы (день, год, заголовок) — наезд со вспышкой, остальные — через одну «вжух» и мягкая смена
const BIG = ['title', 'day'];
export const withTransitions = ep => ({ ...ep, beats: ep.beats.map((b, i) => ({ ...b, tr: b.tr || (BIG.includes(b.v) ? 'zoom' : i % 2 ? 'whip' : 'fade') })) });
// звуки монтажа по тем же временам, что и картинка (сцена считает время появления как s + доля × min(длительность, 5))
function sfxCues(beats, PH) {
  const out = [], at = (i, f) => PH[i].s + f * Math.min(PH[i].d, 5);
  beats.forEach((b, i) => {
    const t0 = PH[i].s - .3;
    if (i && b.tr === 'whip') out.push({ t: t0 - .05, kind: 'whoosh', gain: .32, pan: .3, v: i });
    if (i && b.tr === 'zoom') out.push({ t: t0 - 1.1, kind: 'riser', gain: .16, v: i }, { t: t0 + .05, kind: 'sub', gain: .55, v: i }, { t: t0 + .05, kind: 'impact', gain: .3, v: i });
    if (['stat', 'study'].includes(b.v)) out.push({ t: at(i, b.v === 'study' ? .38 : .05), kind: 'impact', gain: .35, v: i });
    if (b.v === 'timeline') out.push({ t: at(i, .05), kind: 'sweep', gain: .25, v: i }, { t: at(i, .5), kind: 'ding', gain: .22, v: i });
    if (['myth', 'weekend'].includes(b.v)) out.push({ t: at(i, b.v === 'myth' ? .47 : .62), kind: 'hit', gain: .4, v: i });
    if (b.v === 'board') (b.o?.rows || []).forEach((_, k) => out.push({ t: at(i, .14 + k * .1), kind: 'blip', gain: .22, v: k }));
    if (b.v === 'twins') (b.o?.metrics || []).forEach((_, k) => out.push({ t: at(i, .32 + k * .12), kind: 'tick', gain: .2, v: k }));
    if (['debt', 'steps'].includes(b.v)) out.push({ t: at(i, .05), kind: 'riser', gain: .14, v: i });
    if (b.v === 'wow') out.push({ t: at(i, 0), kind: 'shimmer', gain: .3, v: i }, { t: at(i, .12), kind: 'ding', gain: .25, v: i });
    if (b.v === 'tease') out.push({ t: at(i, .02), kind: 'riser', gain: .2, v: i }, { t: at(i, .5), kind: 'click', gain: .3, v: i });
  });
  return out;
}
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
      let src = page, tPH = PH, idx = at;   // c.scene — своя сцена-фон без надписей (картинка справа)
      if (c.scene) { src = path.join(work, `cover_page${i}.html`); tPH = [{ s: .6, d: 4 }]; idx = 0; fs.writeFileSync(src, pageHtml({ title: ep.title, beats: [{ ...c.scene, tr: 'fade' }], brand: ep.brand }, { PH: tPH, LEAD, END: 4.6, DUR: 6 })); }
      const pg = await openPage(browser, src); const url = await pg.evaluate(([f]) => { window.NOHUD = true; return window.grab(f, .92); }, [Math.round(((tPH[Math.max(0, idx)]?.s || 1) + (tPH[Math.max(0, idx)]?.d || 4) * .85) * FPS)]); await pg.close();
      fs.writeFileSync(frame, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'));
      const html = path.join(work, `cover${i}.html`);
      fs.writeFileSync(html, `<!doctype html><meta charset=utf-8><style>${fontCss()}*{margin:0}body{width:1280px;height:720px;overflow:hidden;background:#050a14;font-family:Montserrat}
#bg{position:absolute;right:-${c.shift ?? (c.scene ? 0 : 420)}px;top:0;height:720px;width:1280px;background:url("file://${frame}") center/cover;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 30%)}
#t{position:absolute;left:52px;top:0;height:720px;width:700px;display:flex;flex-direction:column;justify-content:center;font-weight:900;line-height:.98;font-size:120px}
#t div{width:max-content;white-space:nowrap;-webkit-text-stroke:3px #000;paint-order:stroke fill;text-shadow:0 8px 26px rgba(0,0,0,.95)}
.tag{display:inline-block;font-size:40px!important;background:#ff2d4a;color:#fff;padding:6px 18px 8px;border-radius:12px;margin-bottom:22px;-webkit-text-stroke:0!important;text-shadow:none!important;transform:rotate(-2deg)}
.a{color:#fff}.b{color:#ffd400}.c{font-size:46px;color:#fff;margin-top:14px;font-weight:800}</style>
<div id=bg></div><div id=t>${c.tag ? `<div class=tag>${esc(c.tag)}</div>` : ''}${(c.lines || [[c.big, 'w'], [c.line, 'y']]).map(([t2, k]) => `<div class=${k === 'y' ? 'b' : 'a'}>${esc(t2)}</div>`).join('')}${c.accent ? `<div class=c>${esc(c.accent)}</div>` : ''}</div>
<script>document.fonts.ready.then(() => { const t = document.getElementById('t'), big = [...t.querySelectorAll('.a,.b')]; let px = 150; big.forEach(d => (d.style.fontSize = px + 'px'));
  while (px > 60 && (big.some(d => d.offsetWidth > 660) || big.reduce((h, d) => h + d.offsetHeight, 0) > 470)) { px -= 4; big.forEach(d => (d.style.fontSize = px + 'px')); } document.title = 'ready'; });</script>`);
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
  fs.mkdirSync(work, { recursive: true }); ep = withTransitions(ep);
  const texts = ep.beats.map(b => b.text), tmFile = path.join(work, 'timings.json');
  let vo = fs.existsSync(tmFile) ? JSON.parse(fs.readFileSync(tmFile, 'utf8')) : null;
  if (vo && (vo.timings.length !== texts.length || !fs.existsSync(vo.file))) vo = null;
  if (!vo) { onStage?.('voice'); vo = await synthesize(texts, { ...voice, dir: work, onStatus: (st, pc, part, parts) => onStage?.('voice', { status: st, percent: pc, part, parts }) }); fs.writeFileSync(tmFile, JSON.stringify(vo)); }
  const PH = vo.timings.map(t => ({ s: +(LEAD + t.start).toFixed(3), d: +t.speak.toFixed(3) })), END = LEAD + vo.total;
  const total = seconds ? Math.min(seconds, END + 3) : Math.ceil(END + 3), DUR = Math.ceil(END + 3);
  const caps = subChunks(texts, vo.timings, LEAD, 30, 30).map(c => ({ a: +c.a.toFixed(2), b: +c.b.toFixed(2), text: c.text.replace(/\n/g, ' ') }));   // крупные субтитры в кадре
  const page = path.join(work, 'page.html'); fs.writeFileSync(page, pageHtml({ title: ep.title, beats: ep.beats, brand: ep.brand, caps }, { PH, LEAD, END, DUR }));
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const cap = t => String(t).toLowerCase().replace(/^./, ch => ch.toUpperCase());   // «ДВА ПУТИ» → «Два пути» для оглавления
  const chapters = ['0:00 Вступление', ...ep.beats.map((b, i) => {
    const at = mmss(PH[i].s - .3);
    if (b.v === 'day') return `${at} ${cap(b.o.word || 'день')} ${b.o.n}${b.o.text ? ' — ' + b.o.text : ''}`;
    if (b.v === 'timeline' && b.o.marks?.[b.o.at]) return `${at} ${cap(b.o.marks[b.o.at])}${b.o.sub ? ' — ' + b.o.sub : ''}`;
    if (b.v === 'title' && i > 5) return `${at} ${b.o.text === 'ДЕНЬ 31' ? 'Что будет, если бросить' : cap(b.o.text)}`;
    return null; }).filter(Boolean)];
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
    const sfxFile = path.join(work, 'sfx.wav'); renderSfxBus(sfxCues(ep.beats, PH), total, sfxFile);
    const ms = Math.round(LEAD * 1000);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', vo.file, '-i', musicFile, '-i', sfxFile, '-filter_complex',
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},loudnorm=I=-15:TP=-2:LRA=11,aresample=48000,apad=whole_dur=${total.toFixed(2)},asplit=2[v][vk];[2:a]volume=-17dB[m0];[m0][vk]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=600[m];[3:a]aresample=48000,volume=-9dB[fx];[v][m][fx]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.89:level=false[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(2), '-movflags', '+faststart', out]);
    fs.rmSync(musicFile, { force: true });
    return { file: out, subs, cover: cv[0], covers: cv, chapters, duration: total, ...meta };
  } finally { await browser.close().catch(() => {}); }
}

/** Предпросмотр без озвучки: кадр из каждой выбранной фразы (по 4 с на фразу) → work/still_<i>.jpg */
export async function bodyStills(ep, work, idx = null, at = .75) {
  fs.mkdirSync(work, { recursive: true }); ep = withTransitions(ep);
  const n = ep.beats.length, PH = ep.beats.map((_, i) => ({ s: +(LEAD + i * 4).toFixed(3), d: 3.6 })), END = LEAD + n * 4, DUR = Math.ceil(END + 2);
  const caps = ep.beats.map((b, i) => ({ a: PH[i].s, b: PH[i].s + PH[i].d, text: b.text.split(' ').slice(0, 5).join(' ') }));
  const page = path.join(work, 'page.html'); fs.writeFileSync(page, pageHtml({ title: ep.title, beats: ep.beats, brand: ep.brand, caps }, { PH, LEAD, END, DUR }));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] }), out = [];
  try {
    const p = await openPage(browser, page);
    for (const i of idx || ep.beats.map((_, k) => k)) { const url = await p.evaluate(f => window.grab(f, .85), Math.round((PH[i].s + PH[i].d * at) * FPS)), f = path.join(work, `still_${String(i).padStart(3, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); out.push(f); }
  } finally { await browser.close(); }
  return out;
}
