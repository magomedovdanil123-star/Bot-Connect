// «🔑 Подвал Разума»: лекции на ночь по психологии Юнга. Визуал рисуется кодом (движок code-cartoon, MIT):
// тёплая ночная палитра, светящиеся силуэты, частицы света, подписи Lora. Сценарий = список фраз (beats), у каждой — своя картинка.
// Кадры рисуются в Chromium по 12 в секунду (в этом стиле картинка и так меняется 12 раз в секунду) — вдвое быстрее, чем 24.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { synthesize } from '../voice.js';
import { synthesizeVoiceStudio } from '../voicestudio.js';
import { bookMusic, chromium, toSrt, subChunks } from '../books/render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ENG = path.join(DIR, 'engine');
const FPS = 12, LEAD = .8;
export const JUNG_LIST = JSON.parse(fs.readFileSync(path.join(DIR, 'list.json'), 'utf8'));
export const ALL_JUNG_PLAYLIST = 'Психология Юнга — лекции на ночь';
const JUNG_PLAYLISTS = { 'Отношения': 'Психология отношений по Юнгу', 'Женская сила': 'Женская сила и архетипы', 'Тень и исцеление': 'Тень, травмы и исцеление', 'Путь к себе': 'Путь к себе: индивидуация', 'Истории Юнга': 'Жизнь Карла Юнга: истории' };

const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; p.stderr.on('data', d => (err += d)); p.on('close', c => (c ? rej(new Error(`${cmd}: ${err.slice(-400)}`)) : res(err))); });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hashtag = s => '#' + String(s).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '').slice(0, 30);

// страница с движком: шрифты, палитры, движок, сцена; данные ролика — в window.* до загрузки сцены
function pageHtml(lecture, tm) {
  const f = n => 'file://' + path.join(ENG, 'fonts', n);
  const ff = (fam, w, st, file, range) => `@font-face{font-family:"${fam}";font-weight:${w};font-style:${st};src:url("${f(file)}") format("woff2");unicode-range:${range}}`;
  const CY = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', LA = 'U+0000-00FF,U+2000-206F,U+2190-21FF,U+2713';
  const fonts = [['Caveat', 700, 'normal', 'caveat'], ['Inter', 800, 'normal', 'inter'], ['Inter', 400, 'normal', 'inter'], ['Lora', 600, 'normal', 'lora'], ['Lora', 400, 'italic', 'lora']]
    .flatMap(([fam, w, st, base]) => [ff(fam, w, st, `${base}-cyrillic-${w}-${st}.woff2`, CY), ff(fam, w, st, `${base}-latin-${w}-${st}.woff2`, LA)]).join('\n');
  const cues = { duration: tm.DUR, fps_draw: FPS, events: [], music: { enabled: false } };
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
html,body{margin:0;background:#000}.w{position:absolute;left:-9999px;font:700 20px Caveat}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="${tm.DUR}"><canvas id="stage" width="1920" height="1080"></canvas></div>
<div class="w">Аа<b style="font:800 20px Inter">Аа</b><i style="font:italic 400 20px Lora">Аа</i><span style="font:600 20px Lora">Аа</span><span style="font:400 20px Inter">Аа</span></div>
<script>window.gsap={timeline:()=>({to(){return this}})};window.CUES=${JSON.stringify(cues)};window.LECTURE=${JSON.stringify(lecture)};window.TM=${JSON.stringify(tm)};</script>
<script src="file://${path.join(ENG, 'palettes.js')}"></script><script src="file://${path.join(ENG, 'sketch.js')}"></script><script src="file://${path.join(ENG, 'scene.js')}"></script>
<script>window.grab=(f,q)=>{Sketch.render(f/${FPS});return document.getElementById('stage').toDataURL('image/jpeg',q)};</script></body></html>`;
}

// обложка в стиле хитов канала: портрет «Юнга» с неоновой подсветкой справа (engine/portraits), слева 2–3 строки жирного текста,
// одна строка — красным или жёлтым. spec: { lines: [['это не'], ['равнодушие', 'r']], color?: 'purple'|'red'|'blue'|'amber'|'teal', icon?: 'код OpenMoji' }
export const PORTRAITS = ['purple', 'red', 'blue', 'amber', 'teal'];
function portraitHtml(c, color) {
  const f = n => 'file://' + path.join(ENG, 'fonts', n), M = path.join(DIR, '..', '..', 'node_modules/openmoji/color/svg');
  const ff = (w, r, file) => `@font-face{font-family:M;font-weight:${w};src:url("${f(file)}") format("woff2");unicode-range:${r}}`;
  const CY = 'U+0400-045F,U+2116', LA = 'U+0000-00FF,U+2000-206F';
  const col = { r: '#ff2a2a', y: '#ffd400' };
  return `<!doctype html><meta charset=utf-8><style>${ff(900, CY, 'montserrat-cyrillic-900-normal.woff2')}${ff(900, LA, 'montserrat-latin-900-normal.woff2')}
*{margin:0;padding:0}body{width:1280px;height:720px;overflow:hidden;background:#000 url("file://${path.join(ENG, 'portraits', color + '.jpg')}") center/cover;font:900 120px M;color:#fff}
#t{position:absolute;left:54px;top:0;height:720px;width:720px;display:flex;flex-direction:column;justify-content:center;line-height:1.02;letter-spacing:-1px;text-shadow:0 6px 22px rgba(0,0,0,.95),0 0 4px #000}
#t div{white-space:nowrap;width:max-content}</style>
<div id=t>${c.lines.map(([t, k]) => `<div style="color:${col[k] || '#fff'}">${esc(t)}</div>`).join('')}${c.icon && fs.existsSync(path.join(M, c.icon + '.svg')) ? `<img src="file://${path.join(M, c.icon + '.svg')}" style="width:110px;margin-top:22px;filter:drop-shadow(0 8px 16px #000)">` : ''}</div>
<script>document.fonts.ready.then(() => { const t = document.getElementById('t'), ds = [...t.querySelectorAll('div')]; let s = 132;
  const fit = () => ds.every(d => d.offsetWidth <= 700) && [...t.children].reduce((h, d) => h + d.offsetHeight, 0) <= 620; t.style.fontSize = s + 'px'; while (!fit() && s > 50) t.style.fontSize = (s -= 4) + 'px';
  document.title = 'ready'; });</script>`;
}

// обложки: три варианта для «Теста и сравнения» (портрет в стиле хитов; старые сценарии — крупный текст, уведомление «от него», силуэты)
async function covers(browser, ep, work) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }), out = [];
  try {
    const html = fs.readFileSync(path.join(ENG, 'thumb.html'), 'utf8').replace(/url\(([a-z0-9-]+\.woff2)\)/g, (_, n) => `url(file://${path.join(ENG, 'fonts', n)})`);
    const file = path.join(work, 'thumb.html'); fs.writeFileSync(file, html);
    for (const [i, c] of (ep.covers || [{ v: 1 }, { v: 2 }, { v: 3 }]).slice(0, 3).entries()) {
      const f = path.join(work, i ? `cover_${i + 1}.jpg` : 'cover.jpg');
      if (c.lines) {   // портрет: цвет подсветки свой у каждой обложки и сдвигается от лекции к лекции
        const pf = path.join(work, `thumb_p${i}.html`); fs.writeFileSync(pf, portraitHtml(c, c.color || PORTRAITS[((ep.n || 0) + i) % PORTRAITS.length]));
        await p.goto('file://' + pf); await p.waitForFunction(() => document.title === 'ready', null, { timeout: 30000 });
        fs.writeFileSync(f, await p.screenshot({ type: 'jpeg', quality: 92 })); out.push(f); continue;
      }
      await p.goto('file://' + file + '?' + new URLSearchParams({ v: c.v || i + 1, ...(c.spec ? { spec: JSON.stringify(c.spec) } : {}) }));
      await p.waitForFunction(() => document.title === 'ready', null, { timeout: 30000 });
      const png = await p.locator('#c').screenshot({ type: 'jpeg', quality: 92 }); fs.writeFileSync(f, png); out.push(f);
    }
  } finally { await p.close().catch(() => {}); }
  return out;
}

export function jungMeta(ep, chapters = [], total = 0) {
  const mins = Math.max(1, Math.round(total / 60)), entry = JUNG_LIST.find(x => x.n === ep.n || x.title === ep.title), category = ep.category || entry?.category;
  const title = (ep.ytTitle || ep.title).slice(0, 100), own = ep.tags || [], seen = new Set();
  const tags = [...own, 'карл юнг', 'психология юнга', 'психология отношений', 'женская психология', 'лекция на ночь', 'архетипы юнга', 'психология', 'отношения', 'саморазвитие для женщин']
    .map(t => t.replace(/[,<>"«»]/g, ' ').replace(/\s+/g, ' ').trim()).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 25);
  const description = [ep.hook || `${ep.title}. Лекция на ночь по психологии Карла Юнга — ${mins} минут.`, '', ...(ep.about ? [ep.about, ''] : []),
    ...(chapters.length >= 3 ? ['Содержание:', ...chapters, ''] : []),
    ...(ep.comment ? [`💬 ${ep.comment}`, ''] : []),
    '🔑 Подвал Разума — ключи к подсознанию: психология Юнга, отношения и путь к себе. Подпишись, чтобы не пропустить следующую лекцию.', '',
    'Это психологическая лекция, а не консультация психолога или врача.', '',
    ['#карлюнг', '#психологияотношений', '#женскаяпсихология', hashtag(ep.title.split(/[—:]/)[0])].join(' ')].join('\n');
  return { title, titles: [title, ...(ep.titles || [])].map(t => t.slice(0, 100)), tags, description, playlist: JUNG_PLAYLISTS[category] || null, comment: ep.comment || null };
}

/**
 * Лекция «Подвала Разума» целиком: озвучка → кадры → музыка → обложки → SEO.
 * @param ep   { n, title, ytTitle, titles, about, hook, comment, tags, category, covers, beats: [{ v, o, cap, text }] }
 * @param opts { out, work, voice: { key, template }, onStage, onProgress, signal, seconds }  seconds — для пробы: только начало ролика
 */
export async function renderLecture(ep, { out, work, voice, onStage, onProgress, signal, seconds = null } = {}) {
  const stop = () => { if (signal?.aborted) throw Object.assign(new Error('STOPPED'), { stopped: true }); };
  fs.mkdirSync(work, { recursive: true });
  const texts = ep.beats.map(b => b.text), tmFile = path.join(work, 'timings.json');
  let vo = fs.existsSync(tmFile) ? JSON.parse(fs.readFileSync(tmFile, 'utf8')) : null;
  if (vo && (vo.timings.length !== texts.length || !fs.existsSync(vo.file))) vo = null;
  if (!vo) {
    if (!voice) throw new Error('Озвучка выключена — включи голос (🎙 Голос)');
    onStage?.('voice', { parts: 1 });
    const synth = voice.provider === 'voicestudio' ? synthesizeVoiceStudio : synthesize;
    vo = await synth(texts, { ...voice, dir: work, onStatus: (st, pc, part, parts) => onStage?.('voice', { status: st, percent: pc, part, parts }) });
    fs.writeFileSync(tmFile, JSON.stringify(vo));
  }
  stop();
  const PH = vo.timings.map(t => ({ s: +(LEAD + t.start).toFixed(3), d: +t.speak.toFixed(3) })), END = LEAD + vo.total;
  const total = seconds ? Math.min(seconds, END + 4) : Math.ceil(END + 4), DUR = Math.ceil(END + 4);
  const page = path.join(work, 'page.html'); fs.writeFileSync(page, pageHtml({ title: ep.title, beats: ep.beats }, { PH, LEAD, END, DUR }));
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const chapters = ['0:00 Вступление', ...ep.beats.map((b, i) => b.v === 'chapter' && `${mmss(PH[i].s - .5)} ${b.o?.n ? `${(b.o.word || 'перемена').replace(/^./, ch => ch.toUpperCase())} ${b.o.n}. ` : ''}${b.o?.title || ''}`).filter(Boolean)];
  const meta = jungMeta(ep, chapters, END);
  const subs = path.join(work, 'subs.srt'); fs.writeFileSync(subs, toSrt(subChunks(texts, vo.timings, LEAD)));

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--disable-dev-shm-usage', '--allow-file-access-from-files'] });
  try {
    const cv = await covers(browser, ep, work); stop();
    const open = async () => { const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto('file://' + page); await p.waitForFunction(() => window.__hf?.buildReady?.['sketch-main'] && window.Sketch?.render, null, { timeout: 60000 }); await p.evaluate(() => window.__hf.buildReady['sketch-main']); return p; };
    const N = Math.ceil(total * FPS), SEG = 240, segs = []; for (let a = 0; a < N; a += SEG) segs.push([a, Math.min(N, a + SEG)]);
    const segFile = a => path.join(work, `s${String(a).padStart(6, '0')}.mp4`), key = JSON.stringify({ N, b: ep.beats.length, v: 1 });
    if ((() => { try { return fs.readFileSync(path.join(work, 'key.json'), 'utf8'); } catch { return ''; } })() !== key) { for (const f of fs.readdirSync(work)) if (/^s\d+\.mp4/.test(f)) fs.rmSync(path.join(work, f)); fs.writeFileSync(path.join(work, 'key.json'), key); }
    const todo = segs.filter(([a]) => !fs.existsSync(segFile(a))); let done = N - todo.reduce((s, [a, b]) => s + b - a, 0);
    const memW = Math.floor((os.freemem() - 400 * 2 ** 20) / (500 * 2 ** 20)), workers = Math.max(1, Math.min(4, os.cpus().length, memW, todo.length));
    onStage?.('render', { frames: N, workers });
    const worker = async () => {
      const p = await open();
      try {
        for (let job; (job = todo.shift());) {
          const [a, b] = job, part = segFile(a) + '.part.mp4';
          const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-r', '24', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-g', '48', part], { stdio: ['pipe', 'ignore', 'inherit'] });
          const closed = new Promise(r => ff.on('close', r));
          try {
            for (let f = a; f < b; f++) {
              stop();
              const url = await p.evaluate(([f, q]) => window.grab(f, q), [f, .9]);
              if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
              if (++done % 60 === 0) onProgress?.(Math.min(1, done / N));
            }
            ff.stdin.end(); if (await closed) throw new Error('ffmpeg упал на куске ' + a);
          } catch (e) { ff.kill('SIGKILL'); fs.rmSync(part, { force: true }); throw e; }
          fs.renameSync(part, segFile(a));
        }
      } finally { await p.close().catch(() => {}); }
    };
    await Promise.all([...Array(workers)].map(worker));
    onProgress?.(1);
    const list = path.join(work, 'list.txt'); fs.writeFileSync(list, segs.map(([a]) => `file '${segFile(a)}'`).join('\n'));
    const video = path.join(work, 'video.mp4'); await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
    stop();
    // звук: голос + тихая спокойная музыка, которая уходит под голос
    const musicFile = path.join(work, 'music.wav'); await bookMusic(total, total + 10, musicFile, work);
    const ms = Math.round(LEAD * 1000);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', vo.file, '-i', musicFile, '-filter_complex',
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},loudnorm=I=-16:TP=-2:LRA=11,aresample=48000,apad=whole_dur=${total.toFixed(2)},asplit=2[v][vk];[2:a]volume=-19dB[m0];[m0][vk]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=600[m];[v][m]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.89:level=false[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(2), '-movflags', '+faststart', out]);
    fs.rmSync(musicFile, { force: true });
    return { file: out, timings: vo.timings, subs, cover: cv[0], covers: cv, description: meta.description, chapters, title: meta.title, tags: meta.tags, playlist: meta.playlist, comment: meta.comment, titles: meta.titles, duration: total };
  } finally { await browser.close().catch(() => {}); }
}
export { esc, covers as lectureCovers };

/** Предпросмотр без озвучки: по кадру из выбранных фраз (по 4 с на фразу) → work/still_<i>.jpg. Для проверки сцен и новых сценариев. */
export async function lectureStills(ep, work, idx = null) {
  fs.mkdirSync(work, { recursive: true });
  const n = ep.beats.length, PH = ep.beats.map((_, i) => ({ s: +(LEAD + i * 4).toFixed(3), d: 3.5 })), END = LEAD + n * 4, DUR = Math.ceil(END + 2);
  const page = path.join(work, 'page.html'); fs.writeFileSync(page, pageHtml({ title: ep.title, beats: ep.beats }, { PH, LEAD, END, DUR }));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] }), out = [];
  try {
    const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto('file://' + page); await p.waitForFunction(() => window.__hf?.buildReady?.['sketch-main'] && window.Sketch?.render, null, { timeout: 60000 }); await p.evaluate(() => window.__hf.buildReady['sketch-main']);
    for (const i of idx || ep.beats.map((_, k) => k)) {
      const url = await p.evaluate(f => window.grab(f, .85), Math.round((PH[i].s + 2.6) * FPS)), f = path.join(work, `still_${String(i).padStart(3, '0')}.jpg`);
      fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); out.push(f);
    }
  } finally { await browser.close(); }
  return out;
}
