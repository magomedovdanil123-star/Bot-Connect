// Рисованный обзор книги: сценарий → озвучка → кадры (рука с маркером рисует OpenMoji и пишет от руки) → звук → обложка, главы, описание.
// Кадры рисует Chromium (engine.html) в несколько потоков кусками по 250 кадров; готовые куски и озвучка лежат в work/ и переживают сбой.
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { synthesize } from '../voice.js';
import { synthesizeVoiceStudio } from '../voicestudio.js';
import { renderThumbs } from './thumbs.mjs';
import { renderMusic } from '../music.js';
import { layoutScreen } from './layout.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.join(DIR, '..', '..');
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; p.stderr.on('data', d => e += d); p.on('close', c => c ? rej(new Error(cmd + ': ' + e.slice(-400))) : res()); });
const LEAD = .8, FPS = 25, SVG = path.join(ROOT, 'node_modules/openmoji/color/svg');
export const artExists = code => fs.existsSync(path.join(SVG, code + '.svg'));
const probeDur = f => new Promise((res, rej) => { const p = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]); let o = ''; p.stdout.on('data', d => o += d); p.on('close', c => c ? rej(new Error('ffprobe ' + f)) : res(+o.trim())); });

// ---- концовка одна на все обзоры: озвучивается один раз (кэш на голос) и звучит поверх карты всей книги ----
export const OUTRO = ['А вот вся книга на одном листе — сделай скриншот, чтобы не потерять.',
  'Если обзор был полезен — подпишись и нажми колокольчик: каждые два дня здесь новая книга за пятнадцать минут.',
  'Следующий обзор уже ждёт — он появится на экране прямо сейчас.'];
export const OUTRO_PSY = ['А вот весь разбор на одном листе — сделай скриншот, чтобы не потерять.',
  'Если было полезно — подпишись и нажми колокольчик: каждые два дня здесь новый разбор того, как устроена наша голова.',
  'Следующее видео уже ждёт — оно появится на экране прямо сейчас.'];
const OUTROS = { book: OUTRO, psy: OUTRO_PSY };
const CTA = /скриншот|одном листе|подпиш|следующий обзор|следующая книга/i, OUTRO_GAP = .8;
// своя концовка сценария (скриншот, подписка, следующий обзор) уступает место общей; вопрос зрителю на том же листе остаётся
export function stripOutro(screens) {
  const last = screens.at(-1); if (!last?.lines.some(l => CTA.test(l))) return screens;
  const keep = last.lines.map((l, i) => CTA.test(l) ? -1 : i).filter(i => i >= 0);
  if (!keep.length) return screens.slice(0, -1);
  if (!last.show) return screens;
  const show = last.show.filter(e => keep.includes(e.l || 0) && !('mark' in e || 'cross' in e || 'arrow' in e)).map(e => ({ ...e, l: keep.indexOf(e.l || 0) }));
  return [...screens.slice(0, -1), { ...last, lines: keep.map(i => last.lines[i]), show }];
}
const outroPending = new Map();   // пакетная сборка идёт параллельно — концовку одним голосом озвучиваем один раз, остальные ждут
async function outroVoice(voice, synth, dir, onStage, lines = OUTRO) {
  const { key, token, ...cfg } = voice, d = path.join(dir, crypto.createHash('sha1').update(JSON.stringify([cfg, lines])).digest('hex').slice(0, 12)), f = path.join(d, 'outro.json');
  if (fs.existsSync(f)) { const o = JSON.parse(fs.readFileSync(f, 'utf8')); if (fs.existsSync(o.file)) return o; }
  if (outroPending.has(d)) return outroPending.get(d);
  const job = (async () => {
    fs.mkdirSync(d, { recursive: true }); onStage?.('voice', { status: 'outro', percent: 99 });
    const r = await synth(lines, { ...voice, dir: d }), o = { file: r.file, timings: r.timings, total: r.total };
    fs.writeFileSync(f, JSON.stringify(o)); return o;
  })().finally(() => outroPending.delete(d));
  outroPending.set(d, job); return job;
}

// ---- SEO. YouTube понимает тему ролика по названию, описанию, главам и речи; теги почти не влияют — в них только варианты
// написания (Киосаки/Кийосаки, английское название), по которым ищут. Хиты делают обложка + название (CTR) и удержание, поэтому
// название — поисковый запрос в начале + интрига, а обложек три — для «Теста и сравнения» в YouTube Studio. ----
const LIST = JSON.parse(fs.readFileSync(path.join(DIR, 'list.json'), 'utf8'));
const PLAYLISTS = { 'Деньги': 'Книги про деньги', 'Привычки и продуктивность': 'Книги про привычки и продуктивность', 'Общение и отношения': 'Книги про общение и отношения', 'Психология и мышление': 'Книги по психологии',
  'Биографии': 'Биографии великих людей', 'Бизнес и маркетинг': 'Книги про бизнес и маркетинг', 'Здоровье и энергия': 'Книги про здоровье', 'Саморазвитие': 'Книги по саморазвитию' };
// ---- субтитры: фраза диктора → куски до max знаков (по строкам до line), время делится пропорционально длине ----
export function subChunks(sentences, timings, offset = LEAD, max = 84, line = 42) {
  const out = [];
  sentences.forEach((s, i) => {
    const t = timings[i]; if (!t) return;
    const pieces = []; let cur = '';
    for (const w of s.split(/\s+/)) {
      if (cur && (cur + ' ' + w).length > max) { const ws = cur.split(' '), tail = ws.length > 2 && ws.at(-1).length <= 2 ? ws.pop() : null; pieces.push(ws.join(' ')); cur = tail ? tail + ' ' + w : w; }   // предлог не висит в конце куска
      else cur = cur ? cur + ' ' + w : w;
    }
    if (cur) pieces.push(cur);
    const total = pieces.reduce((a, x) => a + x.length, 0); let at = offset + t.start;
    for (const pc of pieces) {
      const d = (t.speak || t.dur) * pc.length / total, lines = []; let l = '';
      for (const w of pc.split(' ')) { if (l && (l + ' ' + w).length > line) { lines.push(l); l = w; } else l = l ? l + ' ' + w : w; }
      lines.push(l); out.push({ a: at, b: at + d, text: lines.join('\n') }); at += d;
    }
  });
  return out;
}
const srtTime = t => { const ms = Math.max(0, Math.round(t * 1000)); return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
export const toSrt = chunks => chunks.map((c, i) => `${i + 1}\n${srtTime(c.a)} --> ${srtTime(c.b)}\n${c.text}\n`).join('\n');

export const ALL_BOOKS_PLAYLIST = 'Все обзоры книг — за 15 минут';
export const hashtag = t => '#' + t.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
// ---- психология: свои плейлисты по рубрикам, описание и теги без «книги/автора» ----
const PSY_LIST = (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, '..', 'psy', 'list.json'), 'utf8')); } catch { return []; } })();
const PSY_PLAYLISTS = { 'Почему мы так делаем': 'Почему мы так делаем — психология поведения', 'Эксперименты': 'Знаменитые психологические эксперименты', 'Манипуляции и влияние': 'Манипуляции и влияние: как не попасться', 'Отношения': 'Психология отношений', 'Мышление': 'Ловушки мышления' };
export const ALL_PSY_PLAYLIST = 'Психология простыми словами — все разборы';
export function psyMeta(ep, chapters = [], total = 0) {
  const mins = Math.max(1, Math.round(total ? total / 60 : ep.screens.flatMap(s => s.lines).join(' ').length / 1000));
  const category = ep.category || PSY_LIST.find(x => x.title === ep.title)?.category, playlist = PSY_PLAYLISTS[category] || null;
  const title = (ep.ytTitle || `${ep.title} — психология простыми словами`).slice(0, 100), lc = ep.title.toLowerCase().replace(/[«»"]/g, '');
  const own = ep.tags || [], seen = new Set(), tags = [lc, ...own, ...(ep.alt || []), 'психология', 'психология простыми словами', ...(own.length < 10 ? ['саморазвитие', 'как работает мозг', ...(category ? [category.toLowerCase()] : [])] : [])]
    .map(t => t.replace(/[,<>"«»]/g, ' ').replace(/\s+/g, ' ').trim()).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 25);
  const description = [`${ep.title}: разбираем, как это работает, простыми словами за ${mins} минут.`, ep.description || '', '', ...(ep.about ? [ep.about, ''] : []),
    ...(chapters.length >= 3 && chapters[0].startsWith('0:00') ? ['Содержание:', ...chapters, ''] : []),
    ...(ep.comment ? [`💬 ${ep.comment}`, ''] : []),
    'Это научно-популярный разбор, а не консультация психолога или врача.', '',
    [hashtag(ep.title), '#психология', '#саморазвитие', '#психологияпростымисловами'].join(' ')].join('\n');
  return { title, titles: [title, ...(ep.titles || [])].map(t => t.slice(0, 100)), tags, description, playlist, comment: ep.comment || null };
}
export function bookMeta(book, chapters = [], total = 0) {
  const mins = Math.max(1, Math.round(total ? total / 60 : book.screens.flatMap(s => s.lines).join(' ').length / 1000)), surname = book.author.split(',')[0].trim().split(' ').pop();
  const category = book.category || LIST.find(b => b.title === book.title)?.category, playlist = PLAYLISTS[category] || null;
  const title = (book.ytTitle || `«${book.title}» — главные идеи за ${mins} минут | обзор книги`).slice(0, 100);
  const lc = book.title.toLowerCase().replace(/[«»"]/g, '');
  // свои теги книги (под её запросы) — первыми; общие добавляем, только если своих мало
  const own = book.tags || [], seen = new Set(), tags = [lc, ...own, `${lc} краткое содержание`, `${lc} обзор`, ...(book.en ? [book.en.toLowerCase()] : []), book.author, `${surname} ${lc}`, ...(book.alt || []),
    'краткое содержание книги', 'обзор книги', ...(own.length < 10 ? ['саммари книги', 'что почитать', ...(category ? [category.toLowerCase()] : [])] : [])]
    .map(t => t.replace(/[,<>"«»]/g, ' ').replace(/\s+/g, ' ').trim()).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 25);
  // описание: первые ~150 знаков видны в поиске — там запрос и обещание; дальше крючок, главы, вопрос, ссылки
  const description = [`${book.title} — ${book.author}: краткое содержание и главные идеи книги за ${mins} минут.`, book.description || '', '', ...(book.about ? [book.about, ''] : []),
    ...(chapters.length >= 3 && chapters[0].startsWith('0:00') ? ['Содержание:', ...chapters, ''] : []),
    ...(book.comment ? [`💬 ${book.comment}`, ''] : []),
    ...(book.buyLink ? [`Купить книгу: ${book.buyLink}`, ''] : []),     [hashtag(book.title), '#обзоркниги', hashtag(surname), '#краткоесодержание'].join(' ')].join('\n');
  return { title, titles: [title, ...(book.titles || [])].map(t => t.slice(0, 100)), tags, description, playlist, comment: book.comment || null };
}

/**
 * @param book  { title, author, en, alt, coverTitle, cover: { word, hook, emojis }, covers: [{ style, word, hook, emojis }], description, comment, tags, buyLink, screens: [{ ch, idea, lines, show | items }] }
 * @param opts  { out, work, voice (конфиг бота: Lumean { key, template } или VoiceStudio), onStage, onProgress, signal }
 */
export async function renderBook(book, { out, work, voice = null, onStage, onProgress, signal, stills = null, outroDir = null, kind = 'book' } = {}) {
  const outro = OUTROS[kind] || OUTRO;
  const stop = () => { if (signal?.aborted) throw Object.assign(new Error('STOPPED'), { stopped: true }); };
  fs.mkdirSync(work, { recursive: true });
  // ---- озвучка (по фразе на строку); готовая лежит в work/ ----
  const pages = stripOutro(book.screens), body = pages.flatMap(s => s.lines), sentences = [...body, ...outro], tmFile = path.join(work, 'timings.json');
  let vo = fs.existsSync(tmFile) ? JSON.parse(fs.readFileSync(tmFile, 'utf8')) : null;
  if (vo && vo.timings.length !== sentences.length) vo = null;   // озвучка от старой версии сценария
  if (!vo && voice) {
    onStage?.('voice', { parts: 1 });
    const synth = voice.provider === 'voicestudio' ? synthesizeVoiceStudio : synthesize;
    const r = await synth(body, { ...voice, dir: work, onStatus: (st, pc, part, parts) => onStage?.('voice', { status: st, percent: pc, part, parts }) });
    const o = await outroVoice(voice, synth, outroDir || path.join(work, 'outro'), onStage, outro), off = await probeDur(r.file) + OUTRO_GAP, file = path.join(work, 'voice_full.wav');
    await run('ffmpeg', ['-y', '-v', 'error', '-i', r.file, '-i', o.file, '-filter_complex', `[0:a]aresample=48000,aformat=channel_layouts=mono,apad=pad_dur=${OUTRO_GAP}[a];[1:a]aresample=48000,aformat=channel_layouts=mono[b];[a][b]concat=n=2:v=0:a=1`, '-c:a', 'pcm_s16le', file]);
    vo = { file, timings: [...r.timings, ...o.timings.map(t => ({ ...t, start: t.start + off }))], total: off + o.total }; fs.writeFileSync(tmFile, JSON.stringify(vo));
  }
  if (!vo) { let t = 0; vo = { file: null, total: 0, timings: sentences.map(x => { const d = x.length / 15 + .4, r = { start: t, dur: d, speak: d - .4 }; t += d; return r; }) }; vo.total = t; }
  // точные субтитры для YouTube (вместо автоматических): текст диктора с его таймингами
  const subs = path.join(work, 'subs.srt'); if (vo.file) fs.writeFileSync(subs, toSrt(subChunks(sentences, vo.timings)));
  stop();

  // ---- план: предметы с моментом начала; подписи — сразу после своей картинки ----
  const items = [], screens = []; let li = 0;
  pages.forEach((sc, page) => {
    const base = li, T = i => vo.timings[base + Math.min(i, sc.lines.length - 1)], ids = {};
    screens.push({ t0: LEAD + T(0).start, idea: sc.idea || null, ch: sc.ch || null });
    for (const it of layoutScreen(sc)) {
      const tm = T(it.l || 0), t0 = it.pre ? LEAD + T(0).start - .75 : LEAD + tm.start + (it.d || 0) * (tm.speak || tm.dur), pre = it.pre ? { dur: .01 } : {};
      if (it.kind === 'pic') {
        if (!artExists(it.emoji)) continue;   // неизвестный рисунок (опечатка нейросети) — пропускаем
        const idx = items.push({ emoji: it.emoji, x: it.at[0], y: it.at[1], s: it.s, t0, page, ...pre }) - 1; if (it.id) ids[it.id] = idx;
        if (it.cap) items.push({ text: it.cap, x: it.at[0], y: it.at[1] + it.s / 2 + (it.cap.includes('\n') ? 70 : 80), size: it.cap.includes('\n') ? 62 : 70, maxW: it.capW, color: it.capColor, after: idx, page });
      } else if (it.kind === 'text') { const idx = items.push({ text: it.text, x: it.x, y: it.y, size: it.size, maxW: it.maxW, color: it.color, t0, page }) - 1; if (it.id) ids[it.id] = idx; }
      else if (it.kind === 'cross' && ids[it.id] != null) items.push({ cross: ids[it.id], t0, page });
      else if (it.kind === 'arrow' && ids[it.from] != null && ids[it.to] != null) items.push({ arrow: [ids[it.from], ids[it.to]], t0, page });
      else if (it.kind === 'under') items.push({ under: 1, x1: it.x1, x2: it.x2, y: it.y, color: it.color, t0, page });
      else if (it.kind === 'quote') items.push({ quote: it.text, x: it.x, y: it.y, size: it.size, w: it.w, t0, page });
      else if (it.kind === 'bars') items.push({ bars: it.bars, x: it.x, y: it.y, w: it.w, h: it.h, t0, page });
      else if (it.kind === 'box') items.push({ box: it.box, color: it.color, t0, page });
      else if (it.kind === 'mark') items.push({ mark: it.box, t0, page });
      else if (it.kind === 'prop') items.push({ prop: it.prop, x: it.prop.x, y: it.prop.y - 120, t0, page, ...pre });
      else if (it.kind === 'fig') { const idx = items.push({ fig: it.fig, x: it.fig.x, y: it.fig.y - 330, t0, page,
          beats: it.beats.map(b => { const tb = T(b.l || 0); return { ...b, t: LEAD + tb.start + (b.d || 0) * (tb.speak || tb.dur) }; }).sort((a, b) => a.t - b.t) }) - 1; ids[it.id] = idx; }
      else if (it.kind === 'bubble' && ids[it.actor] != null) items.push({ bubble: it.text, actor: ids[it.actor], think: it.think, side: it.side, color: it.red ? '#d62828' : undefined, x: items[ids[it.actor]].x, y: 300, t0, page });
    }
    li += sc.lines.length;
  });
  // финал: на общей концовке камера отъезжает и показывает весь конспект книги на одном экране; после неё 5 с музыки под конечную заставку
  const map = LEAD + vo.timings[body.length].start - .3, total = Math.max(map + 6, LEAD + vo.total + 5), plan = { total, items, screens, map, fx: kind === 'psy' ? 'whip' : null };
  const arts = {}; for (const it of items) if (it.emoji && !arts[it.emoji]) arts[it.emoji] = fs.readFileSync(path.join(SVG, it.emoji + '.svg'), 'utf8');
  for (const it of items) for (const b of [it.fig || {}, ...(it.beats || [])]) if (b.hold && artExists(b.hold) && !arts[b.hold]) arts[b.hold] = fs.readFileSync(path.join(SVG, b.hold + '.svg'), 'utf8');   // что герои держат в руках
  for (const e of [...(book.cover?.emojis || []), ...(book.covers || []).flatMap(c => c.emojis || [])]) if (artExists(e)) arts[e] = fs.readFileSync(path.join(SVG, e + '.svg'), 'utf8');
  const handSvg = fs.readFileSync(path.join(SVG, '270D-1F3FB.svg'), 'utf8');

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--disable-dev-shm-usage'] });
  try {
    const open = async () => { const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto('file://' + path.join(DIR, 'engine.html')); const info = await p.evaluate(([pl, a, h]) => window.load(pl, a, h), [plan, arts, handSvg]); return { p, info }; };
    // обложка, главы, описание
    const { p: p0, info } = await open();
    // три обложки в тёмном кликбейт-стиле (thumbs.mjs) — для «Теста и сравнения»; первая — cover.jpg
    const covers = await renderThumbs(browser, book, kind, work);
    const cover = covers[0]; await p0.close();
    const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
    const chapters = screens.map((s, i) => s.ch && `${mmss(i ? s.t0 - .8 : 0)} ${s.ch}`).filter(Boolean);
    const meta = kind === 'psy' ? psyMeta(book, chapters, total) : bookMeta(book, chapters, total), description = meta.description;
    stop();

    if (stills) {   // предпросмотр: отдельные кадры (секунды) в jpg, без ролика
      const { p } = await open(), files = [];
      for (const sec of stills) { const url = await p.evaluate(f => window.grab(f, .88), Math.round(sec * FPS)), f = path.join(work, `still_${sec}.jpg`); fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); files.push(f); }
      await p.close(); return { stills: files, screens, cover, covers, description, total, map, meta, subs: vo.file ? subs : null };
    }
    // ---- кадры: куски по 250, потоков — сколько тянут память и процессор ----
    const N = info.frames, SEG = 250, segs = []; for (let a = 0; a < N; a += SEG) segs.push([a, Math.min(N, a + SEG)]);
    const segFile = a => path.join(work, `s${String(a).padStart(6, '0')}.mp4`), key = JSON.stringify({ N, n: items.length });
    if ((() => { try { return fs.readFileSync(path.join(work, 'key.json'), 'utf8'); } catch { return ''; } })() !== key) { for (const f of fs.readdirSync(work)) if (/^s\d+\.mp4/.test(f)) fs.rmSync(path.join(work, f)); fs.writeFileSync(path.join(work, 'key.json'), key); }
    const todo = segs.filter(([a]) => !fs.existsSync(segFile(a))); let done = N - todo.reduce((s, [a, b]) => s + b - a, 0);
    const memW = Math.floor((os.freemem() - 300 * 2 ** 20) / (450 * 2 ** 20)), workers = Math.max(1, Math.min(4, os.cpus().length, memW, todo.length));
    onStage?.('render', { frames: N, workers });
    const worker = async () => {
      const { p } = await open();
      try {
        for (let job; (job = todo.shift());) {
          const [a, b] = job, part = segFile(a) + '.part.mp4';
          const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-g', '50', part], { stdio: ['pipe', 'ignore', 'inherit'] });
          const closed = new Promise(r => ff.on('close', r));
          try {
            for (let f = a; f < b; f++) {
              stop();
              const url = await p.evaluate(f => window.grab(f, .92), f);
              if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
              if (++done % 125 === 0) onProgress?.(Math.min(1, done / N));
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

    // ---- звук: голос + тихий скрип маркера на каждый рисунок + спокойная музыка (на финальной карте ярче) ----
    // скрип маркера — тихий шум: 24 кГц хватает и вдвое меньше памяти
    const SR = 24000, n = Math.ceil(total * SR), scr = new Float32Array(n); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const it of info.items) {
      const a = Math.round(it.t0 * SR), len = Math.round(it.dur * SR); let lp = 0, hp = 0, prev = 0;
      for (let i = 0; i < len && a + i < n; i++) {
        const w = rnd() * 2 - 1; lp += .35 * (w - lp); hp = .9 * (hp + lp - prev); prev = lp;
        scr[a + i] += hp * Math.min(1, i / (SR * .04)) * Math.min(1, (len - i) / (SR * .06)) * (.55 + .45 * Math.sin(i / SR * 2 * Math.PI * (9 + 4 * Math.sin(i / SR * 3)))) * .12;
      }
    }
    if (plan.fx === 'whip') for (const sc of screens.slice(1)) {   // «вжух» на каждом перелёте камеры: шум, у которого яркость растёт к середине и спадает
      const a = Math.round((sc.t0 - .55) * SR), len = Math.round(.55 * SR); let lp = 0, lp2 = 0;
      for (let i = 0; i < len && a + i < n; i++) { if (a + i < 0) continue; const u = i / len, env = Math.sin(Math.PI * u) ** 2, k = .04 + .5 * env, w = rnd() * 2 - 1; lp += k * (w - lp); lp2 += k * (lp - lp2); scr[a + i] += lp2 * env * 1.1; }
    }
    const pcm = Buffer.alloc(n * 2); for (let i = 0; i < n; i++) pcm.writeInt16LE(Math.max(-1, Math.min(1, scr[i])) * 32767 | 0, i * 2);
    const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(1, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 2, 28); hdr.writeUInt16LE(2, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
    const scrFile = path.join(work, 'marker.wav'); fs.writeFileSync(scrFile, Buffer.concat([hdr, pcm]));
    const musicFile = path.join(work, 'music.wav');
    await bookMusic(total, map, musicFile, work);
    const ms = Math.round(LEAD * 1000), voiceIn = vo.file && fs.existsSync(vo.file) ? ['-i', vo.file] : ['-f', 'lavfi', '-t', '1', '-i', 'anullsrc=r=48000:cl=mono'];
    await run('ffmpeg', ['-y', '-v', 'error', '-i', video, ...voiceIn, '-i', scrFile, '-i', musicFile, '-filter_complex',
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},loudnorm=I=-16:TP=-2:LRA=11,aresample=48000,apad=whole_dur=${total.toFixed(2)},asplit=2[v][vk];[3:a]volume=-17dB[m0];[m0][vk]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=450[m];[2:a]volume=-6dB,aformat=channel_layouts=stereo[s];[v][m][s]amix=inputs=3:normalize=0:duration=longest,alimiter=limit=0.89:level=false[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(2), '-movflags', '+faststart', out]);
    fs.rmSync(scrFile, { force: true }); fs.rmSync(musicFile, { force: true });
    return { file: out, timings: vo.timings, subs: vo.file ? subs : null, cover, covers, description, chapters, title: meta.title, tags: meta.tags, playlist: meta.playlist, comment: meta.comment, titles: meta.titles, duration: total };
  } finally { await browser.close().catch(() => {}); }
}

// Музыка на весь обзор одним куском держит в памяти ~10 дорожек длиной в ролик (1,5+ ГБ на 14 минут — сервер убивает бота).
// Поэтому — кусками по минуте с общей сеткой тактов и плавной склейкой; на финальной карте музыка ярче.
export async function bookMusic(total, map, out, work) {
  const P = 60, music = { bpm: 84, root: 2, prog: [0, 9, 5, 7] }, bar = 240 / music.bpm, X = bar, starts = [];
  const onBar = t => LEAD + Math.floor((t - LEAD) / bar) * bar, mapAt = onBar(map);   // куски начинаются ровно с такта — стык без провала
  for (let s = 0; s < mapAt - 15; s = onBar(s + P)) starts.push(s);
  if (mapAt < total - 4 && mapAt > 0) starts.push(mapAt);   // финальная карта — свой кусок: громкость каждого куска выравнивается отдельно
  const parts = starts.map((s, i) => {
    const lastPart = i === starts.length - 1, len = lastPart ? total - s : starts[i + 1] - s + X, m = mapAt - s, f = path.join(work, `music_${i}.wav`);
    // кусок начинается с целого такта общей сетки, аккорды продолжают последовательность с того же места
    const k = Math.max(0, Math.ceil((s - LEAD) / bar - 1e-9)), origin = LEAD + k * bar - s, prog = music.prog.map((_, j) => music.prog[(j + k) % 4]);
    const span = lastPart ? len : len + 3;   // у не последних — запас, чтобы затухание в конце генератора ушло за обрезку
    const scenes = [{ start: 0, dur: span, dir: { level: m <= 0 ? 1 : 0 } }];   // до карты — спокойный пэд, кусок карты — ярче
    renderMusic({ total: span, music: { ...music, prog, origin }, scenes }, f); return { f, len };
  });
  if (parts.length === 1) { fs.renameSync(parts[0].f, out); return; }
  const trims = parts.map((p, i) => `[${i}:a]atrim=0:${p.len.toFixed(3)},asetpts=PTS-STARTPTS[p${i}]`).join(';');
  const fc = trims + ';' + parts.slice(1).map((_, i) => `${i ? `[x${i}]` : '[p0]'}[p${i + 1}]acrossfade=d=${X.toFixed(3)}:c1=qsin:c2=qsin${i + 2 < parts.length ? `[x${i + 1}]` : '[m]'}`).join(';');
  await run('ffmpeg', ['-y', '-v', 'error', ...parts.flatMap(p => ['-i', p.f]), '-filter_complex', fc, '-map', '[m]', '-c:a', 'pcm_s16le', out]);
  for (const p of parts) fs.rmSync(p.f, { force: true });
}

/** Превью для Telegram (лимит ботов 50 МБ): 960×540 с битрейтом под 45 МБ. */
export async function telegramPreview(file, out, duration) {
  const kb = Math.max(250, Math.floor(40 * 8 * 1024 / duration) - 70);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vf', 'scale=960:-2', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'stillimage', '-b:v', kb + 'k', '-maxrate', Math.round(kb * 1.4) + 'k', '-bufsize', kb * 2 + 'k', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', out]);
  return out;
}
export { LEAD, chromium };
