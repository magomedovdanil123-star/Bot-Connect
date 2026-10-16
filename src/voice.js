// Озвучка через Lumean + точные тайминги фраз и слов.
// Порядок источников таймингов: субтитры Lumean (если шаблон их отдаёт) -> выравнивание по паузам в аудио.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const BASE = 'https://api.lumean.app/api/public';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHUNK_CHARS = 9000;     // длинный сценарий озвучиваем несколькими заказами
const CHUNK_GAP = 0.7;        // пауза между частями при склейке, сек

async function api(key, method, p, body) {
  const r = await fetch(BASE + p, { method, headers: { 'X-API-KEY': key, Accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Lumean ${method} ${p} -> ${r.status}: ${j.message || ''} ${j.reason || ''}`.trim());
  return j.data;
}
async function download(key, p, out) {
  const { url } = await api(key, 'POST', '/storage/url', { path: p });
  fs.writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return out;
}
export function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let err = '';
    p.stderr.on('data', d => err += d); p.on('error', rej);
    p.on('close', c => c ? rej(new Error(`${cmd} ${c}: ${err.slice(-400)}`)) : res(err));
  });
}

// ---------- синтез ----------
const clean = s => s.replace(/[\[\]]/g, '');
function groupSentences(sentences) {
  const groups = []; let cur = [], len = 0;
  sentences.forEach((s, i) => { if (cur.length && len + s.length > CHUNK_CHARS) { groups.push(cur); cur = []; len = 0; } cur.push(i); len += s.length + 20; });
  if (cur.length) groups.push(cur);
  return groups;
}
async function synthOne(sentences, { key, template, dir, tag, onStatus }) {
  // бесплатные паузы {{pause}} между фразами облегчают поиск границ
  const text = sentences.map(clean).join(' {{pause=0.7}}\n\n');
  const order = await api(key, 'POST', '/orders', { template_id: template, input_text: text, name: `motion-bot ${tag}` });
  let d;
  for (;;) {
    d = await api(key, 'GET', `/orders/${order.id}`);
    onStatus?.(d.status, d.progress_percent);
    if (['completed', 'result_delivered', 'partially_completed', 'failed', 'cancelled', 'compensated'].includes(d.status)) break;
    await sleep(6000);
  }
  if (!d.result?.files?.length) throw new Error('Озвучка не удалась: статус ' + d.status);
  if (d.status === 'partially_completed') throw new Error('Lumean озвучил текст не полностью (часть фрагментов отклонена). Измените формулировки и попробуйте снова.');
  const audio = await download(key, d.result.files[0], path.join(dir, `voice_${tag}${path.extname(d.result.files[0]) || '.mp3'}`));
  let srt = null;
  const sub = (d.result.service_files || []).find(p => /\.srt$/i.test(p));
  if (sub) { try { srt = fs.readFileSync(await download(key, sub, path.join(dir, `sub_${tag}.srt`)), 'utf8'); } catch { srt = null; } }
  return { audio, srt };
}

/**
 * Озвучивает все фразы. Длинный сценарий режется на несколько заказов, части склеиваются.
 * Возвращает путь к общему WAV и тайминги каждой фразы [{start, dur, speak, words:[t...]}].
 */
export async function synthesize(sentences, { key, template, dir, onStatus }) {
  const groups = groupSentences(sentences);
  const parts = [];
  for (const [gi, idx] of groups.entries()) {
    const sub = idx.map(i => sentences[i]);
    const r = await synthOne(sub, { key, template, dir, tag: gi, onStatus: (st, pc) => onStatus?.(st, pc, gi + 1, groups.length) });
    const wav = path.join(dir, `part_${gi}.wav`);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', r.audio, '-ac', '1', '-ar', '48000', wav]);
    const tm = await alignSentences(wav, sub, r.srt);
    parts.push({ wav, tm, dur: tm.total });
  }
  // склейка частей с паузой, тайминги сдвигаем
  const out = path.join(dir, 'voice.wav');
  if (parts.length === 1) fs.copyFileSync(parts[0].wav, out);
  else {
    const list = path.join(dir, 'voice_list.txt'), gap = path.join(dir, 'gap.wav');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=mono`, '-t', String(CHUNK_GAP), gap]);
    fs.writeFileSync(list, parts.flatMap((p, i) => i ? [`file '${gap}'`, `file '${p.wav}'`] : [`file '${p.wav}'`]).join('\n'));
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'pcm_s16le', out]);
  }
  const timings = []; let offset = 0;
  parts.forEach((p, pi) => {
    p.tm.sentences.forEach((s, si) => {
      const last = si === p.tm.sentences.length - 1 && pi < parts.length - 1;
      timings.push({ ...s, start: s.start + offset, dur: s.dur + (last ? CHUNK_GAP : 0), words: s.words });
    });
    offset += p.dur + CHUNK_GAP;
  });
  return { file: out, timings, total: offset - CHUNK_GAP };
}

// ---------- анализ аудио ----------
async function loudness(file) {
  const err = await run('ffmpeg', ['-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const m = /mean_volume: (-?[\d.]+) dB/.exec(err);
  return m ? +m[1] : -20;
}
async function silences(file, noiseDb, minDur) {
  const err = await run('ffmpeg', ['-i', file, '-af', `silencedetect=n=${noiseDb}dB:d=${minDur}`, '-f', 'null', '-']);
  const out = []; let st = null;
  for (const l of err.split('\n')) {
    let m = /silence_start: (-?[\d.]+)/.exec(l); if (m) st = Math.max(0, +m[1]);
    m = /silence_end: ([\d.]+)/.exec(l); if (m && st != null) { out.push({ s: st, e: +m[1] }); st = null; }
  }
  const dm = /Duration: (\d+):(\d+):([\d.]+)/.exec(err);
  const total = dm ? +dm[1] * 3600 + +dm[2] * 60 + +dm[3] : 0;
  if (st != null) out.push({ s: st, e: total });
  return { sil: out, total };
}

// вес фразы ~ длительность речи: буквы + цифры (цифры читаются длиннее) + паузы на знаках
const speechWeight = s => (s.match(/[a-zа-яё]/gi) || []).length + (s.match(/\d/g) || []).length * 2.5 + (s.match(/[,;:—-]/g) || []).length * 4 + 6;

/**
 * Границы фраз: выбираем по одной паузе на каждую границу так, чтобы паузы шли по порядку,
 * были близко к ожидаемым позициям (по длине текста) и были как можно длиннее.
 * Это устойчиво к драматическим паузам внутри фраз (eleven_v3 и т.п.).
 */
function pickBoundaries(cands, expected, total) {
  const n = expected.length, m = cands.length;
  if (!n) return [];
  if (m < n) return null;
  const cost = (b, c) => { const mid = (cands[c].s + cands[c].e) / 2, d = cands[c].e - cands[c].s; return Math.abs(mid - expected[b]) / Math.max(1, total * .04) - Math.min(1.6, d) * 1.4; };
  const INF = 1e18, dp = Array.from({ length: n }, () => new Float64Array(m).fill(INF)), from = Array.from({ length: n }, () => new Int32Array(m).fill(-1));
  for (let c = 0; c < m; c++) dp[0][c] = cost(0, c);
  for (let b = 1; b < n; b++) {
    let best = INF, bi = -1;
    for (let c = 0; c < m; c++) {
      if (c > 0 && dp[b - 1][c - 1] < best) { best = dp[b - 1][c - 1]; bi = c - 1; }
      if (bi >= 0) { dp[b][c] = best + cost(b, c); from[b][c] = bi; }
    }
  }
  let end = -1, bestV = INF; for (let c = 0; c < m; c++) if (dp[n - 1][c] < bestV) { bestV = dp[n - 1][c]; end = c; }
  if (end < 0) return null;
  const pick = new Array(n); for (let b = n - 1; b >= 0; b--) { pick[b] = cands[end]; end = from[b][end]; }
  return pick;
}

// SRT -> якоря «позиция символа -> время». Работает, если субтитры совпадают с текстом.
const norm = s => s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');
function srtAnchors(srt, fullNorm) {
  const cues = [];
  for (const block of srt.replace(/\r/g, '').split(/\n\s*\n/)) {
    const m = /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/.exec(block); if (!m) continue;
    const t = (h, mi, s, ms) => +h * 3600 + +mi * 60 + +s + +ms / 1000;
    const text = block.split('\n').slice(block.split('\n').findIndex(l => l.includes('-->')) + 1).join(' ');
    cues.push({ a: t(m[1], m[2], m[3], m[4]), b: t(m[5], m[6], m[7], m[8]), n: norm(text) });
  }
  const totalChars = cues.reduce((a, c) => a + c.n.length, 0);
  if (!cues.length || Math.abs(totalChars - fullNorm.length) > fullNorm.length * .12) return null;
  const anchors = [[0, cues[0].a]]; let pos = 0;
  for (const c of cues) { anchors.push([pos, c.a]); pos += c.n.length; anchors.push([pos, c.b]); }
  return anchors.map(([p, t]) => [p * fullNorm.length / totalChars, t]);
}
const interp = (anchors, x) => {
  if (x <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) if (x <= anchors[i][0]) { const [x0, y0] = anchors[i - 1], [x1, y1] = anchors[i]; return x1 === x0 ? y1 : y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  return anchors[anchors.length - 1][1];
};

/** Тайминги слов внутри фразы: внутренние паузы привязываем к знакам препинания. */
function wordTimes(sentence, t0, t1, innerSil) {
  const words = sentence.split(/\s+/).filter(Boolean);
  const w = words.map(x => speechWeight(x) - 6 + 1.5);
  const sumW = w.reduce((a, b) => a + b, 0) || 1;
  // кандидаты: слова с запятой/тире на конце
  const punct = words.map((x, i) => (/[,;:—–-]$/.test(x) || words[i + 1] === '—') ? i : -1).filter(i => i >= 0);
  const anchors = [[0, t0]];
  let acc = 0; const cum = w.map(v => (acc += v));
  const sil = innerSil.filter(s => s.e - s.s >= .16 && s.s > t0 + .2 && s.e < t1 - .2);
  let si = 0;
  for (const pi of punct) {
    const exp = t0 + (t1 - t0) * cum[pi] / sumW;
    let best = -1, bd = 1e9;
    for (let k = si; k < sil.length; k++) { const d = Math.abs(sil[k].s - exp); if (d < bd) { bd = d; best = k; } }
    if (best >= 0 && bd < (t1 - t0) * .25) { anchors.push([cum[pi], sil[best].s]); anchors.push([cum[pi] + .001, sil[best].e]); si = best + 1; }
  }
  anchors.push([sumW, t1]);
  let c = 0; return w.map(v => { const t = interp(anchors, c); c += v; return t; });
}

/** Тайминги фраз в одном аудиофайле. */
export async function alignSentences(file, sentences, srt = null) {
  const n = sentences.length;
  const mean = await loudness(file);
  const noise = Math.min(-28, Math.round(mean - 22));
  const { sil, total } = await silences(file, noise, .12);
  const lead = sil.find(x => x.s < .05)?.e || 0;
  const tailSil = sil.find(x => x.e >= total - .05 && x.s > lead);
  const speechEnd = tailSil ? tailSil.s : total;
  const weights = sentences.map(speechWeight);
  const sumW = weights.reduce((a, b) => a + b, 0);
  let acc = 0; const cumW = weights.map(w => (acc += w));

  let bounds = null, source = 'pauses';
  if (srt) {
    const full = sentences.map(norm), fullNorm = full.join('');
    const anchors = srtAnchors(srt, fullNorm);
    if (anchors) {
      let p = 0; const ends = full.map(x => (p += x.length));
      bounds = ends.slice(0, -1).map(e => { const t = interp(anchors, e); return { s: t - .05, e: t + .05 }; });
      source = 'subtitles';
    }
  }
  if (!bounds) {
    const expected = cumW.slice(0, -1).map(c => lead + (speechEnd - lead) * c / sumW);
    const cands = sil.filter(x => x.s > lead + .2 && x.e < speechEnd - .1 && x.e - x.s >= .18);
    bounds = pickBoundaries(cands, expected, speechEnd - lead);
    if (!bounds) { bounds = expected.map(t => ({ s: t - .15, e: t + .15 })); source = 'proportional'; }
  }
  const res = [];
  for (let i = 0; i < n; i++) {
    const speakStart = i === 0 ? lead : bounds[i - 1].e;
    const speakEnd = i < n - 1 ? bounds[i].s : speechEnd;
    const start = Math.max(0, speakStart - .18);        // сцена чуть раньше голоса
    const end = i < n - 1 ? bounds[i].e - .18 : total + .5;
    const inner = sil.filter(x => x.s > speakStart && x.e < speakEnd);
    const words = wordTimes(sentences[i], speakStart, speakEnd, inner).map(t => t - start);
    res.push({ start, dur: end - start, speak: Math.max(.5, speakEnd - start), words });
  }
  return { sentences: res, total, source };
}
