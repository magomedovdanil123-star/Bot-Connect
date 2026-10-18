// Озвучка через Lumean + точные тайминги фраз и слов.
// Порядок источников таймингов: субтитры Lumean (если шаблон их отдаёт) -> выравнивание по паузам в аудио.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const BASE = 'https://api.lumean.app/api/public';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CHUNK_CHARS = 9000;     // длинный сценарий озвучиваем несколькими заказами
const CHUNK_GAP = 0.7;        // пауза между частями при склейке, сек
const CHUNK_SENT = 6;         // фраз в одном заказе

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
const clean = s => voiceText(s.replace(/[\[\]]/g, ''));
// текст для голоса: русский синтез спотыкается на латинице и значках — пишем так, как произносится
// (на экране и в субтитрах остаётся исходный текст)
const SAY = [[/telegram/gi, 'Телеграм'], [/youtube/gi, 'Ютуб'], [/shorts/gi, 'шортс'], [/pampadu/gi, 'Пампаду'], [/\bCPA\b/g, 'си-пи-эй'],
  [/(\d)\s?₽/g, '$1 рублей'], [/₽/g, 'рублей'], [/(\d)\s?%/g, '$1 процентов'], [/[«»"“”]/g, '']];
export const voiceText = s => SAY.reduce((t, [re, to]) => t.replace(re, to), s);
function groupSentences(sentences) {
  const groups = []; let cur = [], len = 0;
  // короткие заказы по ~6 фраз: сервис реже «проглатывает» конец, а потерю легко заметить по длительности
  sentences.forEach((s, i) => { if (cur.length && (len + s.length > CHUNK_CHARS || cur.length >= CHUNK_SENT)) { groups.push(cur); cur = []; len = 0; } cur.push(i); len += s.length + 20; });
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
  // длинный текст сервис может отдать несколькими аудиофайлами — раньше брался только первый, и конец ролика пропадал
  const aud = d.result.files.filter(p => /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(p)), files = aud.length ? aud : d.result.files.slice(0, 1);
  const got = [];
  for (const [k, f] of files.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).entries()) got.push(await download(key, f, path.join(dir, `voice_${tag}_${k}${path.extname(f) || '.mp3'}`)));
  let audio = got[0];
  if (got.length > 1) {
    console.log(`озвучка: сервис отдал ${got.length} аудиофайла — склеиваю`);
    audio = path.join(dir, `voice_${tag}.wav`);
    await run('ffmpeg', ['-y', '-v', 'error', ...got.flatMap(f => ['-i', f]), '-filter_complex', got.map((_, k) => `[${k}:a]aresample=48000,aformat=channel_layouts=mono[a${k}]`).join(';') + ';' + got.map((_, k) => `[a${k}]`).join('') + `concat=n=${got.length}:v=0:a=1[o]`, '-map', '[o]', audio]);
  }
  let srt = null;
  const sub = (d.result.service_files || []).find(p => /\.srt$/i.test(p));
  if (sub) { try { srt = fs.readFileSync(await download(key, sub, path.join(dir, `sub_${tag}.srt`)), 'utf8'); } catch { srt = null; } }
  return { audio, srt };
}

// Сервис иногда отдаёт аудио, где озвучена только часть текста (конец «проглочен»). Проверяем полноту
// по субтитрам (сколько текста в них) или по длительности речи; неполную часть делим пополам и заказываем заново.
const SPEECH_CPS = 15;   // примерная скорость речи: букв в секунду
async function synthChecked(sub, { key, template, dir, tag, onStatus }, depth = 0) {
  const r = await synthOne(sub, { key, template, dir, tag, onStatus });
  const wav = path.join(dir, `part_${tag}.wav`);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', r.audio, '-ac', '1', '-ar', '48000', wav]);
  const chars = sub.map(x => norm(voiceText(x))).join('').length;
  let cover;
  if (r.srt) cover = srtChars(r.srt) / Math.max(1, chars);
  else { const { sil, total } = await silences(wav, Math.min(-28, Math.round(await loudness(wav) - 22)), .12); const lead = sil.find(x => x.s < .05)?.e || 0, tail = sil.find(x => x.e >= total - .05 && x.s > lead); cover = ((tail ? tail.s : total) - lead) * SPEECH_CPS / Math.max(1, chars); }
  // конец текста обязан прозвучать: последние слова последней фразы должны быть в субтитрах (раньше «проглатывался» именно призыв в конце)
  const tailOk = !r.srt || (() => { const sn = norm(r.srt.replace(/^\d+$|.*-->.*$/gm, '')), last = norm(voiceText(sub[sub.length - 1])); return sn.includes(last.slice(-Math.min(14, last.length))) || sn.includes(last.slice(0, Math.min(14, last.length))); })();
  // субтитры сервис строит по тексту, а не по звуку: если они «говорят» дольше, чем звучит речь, — конец аудио потерян
  const { sil: sl, total: tot } = await silences(wav, Math.min(-28, Math.round(await loudness(wav) - 22)), .12);
  const ld = sl.find(x => x.s < .05)?.e || 0, tl = sl.find(x => x.e >= tot - .05 && x.s > ld), speechEnd = tl ? tl.s : tot;
  const srtEnd = r.srt ? Math.max(0, ...[...r.srt.matchAll(/-->\s*(\d+):(\d+):(\d+)[,.](\d+)/g)].map(m => +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000)) : 0;
  const audioCover = (speechEnd - ld) * SPEECH_CPS / Math.max(1, chars), lost = srtEnd > speechEnd + 1.2;
  const short = r.srt ? cover < .93 || !tailOk || lost || audioCover < .65 : cover < .7;
  if (lost) console.warn(`озвучка: субтитры до ${srtEnd.toFixed(1)} с, а речь кончается на ${speechEnd.toFixed(1)} с — конец аудио потерян`);
  if (short && sub.length > 1 && depth < 3) {
    console.warn(`озвучка: озвучено ~${Math.round(cover * 100)}% текста части ${tag}${tailOk ? '' : ', конец не прозвучал'} — заказываю заново двумя половинами`);
    const h = Math.ceil(sub.length / 2);
    return [...await synthChecked(sub.slice(0, h), { key, template, dir, tag: tag + 'a', onStatus }, depth + 1), ...await synthChecked(sub.slice(h), { key, template, dir, tag: tag + 'b', onStatus }, depth + 1)];
  }
  if (short) throw new Error(`Lumean озвучил не весь текст (~${Math.round(cover * 100)}%) даже после повтора. Попробуйте ещё раз или упростите фразу: «${sub[0].slice(0, 60)}»`);
  const tm = await alignSentences(wav, sub, r.srt); console.log(`озвучка: часть ${tag}, тайминги по ${tm.source}, полнота ~${Math.round(cover * 100)}%`);
  // последняя фраза должна звучать примерно столько, сколько в ней букв; «огрызок» — конец потерян, перезаказываем
  const lastS = tm.sentences[tm.sentences.length - 1], lastExp = norm(voiceText(sub[sub.length - 1])).length / SPEECH_CPS;
  if (lastS && lastS.speak < lastExp * .45 && depth < 3) {
    console.warn(`озвучка: последняя фраза части ${tag} звучит ${lastS.speak.toFixed(1)} с вместо ~${lastExp.toFixed(1)} с — перезаказываю`);
    if (sub.length > 1) { const h = Math.ceil(sub.length / 2); return [...await synthChecked(sub.slice(0, h), { key, template, dir, tag: tag + 'a', onStatus }, depth + 1), ...await synthChecked(sub.slice(h), { key, template, dir, tag: tag + 'b', onStatus }, depth + 1)]; }
    return synthChecked(sub, { key, template, dir, tag: tag + 'r', onStatus }, depth + 1);
  }
  return [{ wav, tm, dur: tm.total }];
}
const srtChars = srt => srt.replace(/\r/g, '').split(/\n\s*\n/).reduce((a, b) => { const L = b.split('\n'), i = L.findIndex(l => l.includes('-->')); return a + (i >= 0 ? norm(L.slice(i + 1).join(' ')).length : 0); }, 0);

/**
 * Озвучивает все фразы. Длинный сценарий режется на несколько заказов, части склеиваются.
 * Возвращает путь к общему WAV и тайминги каждой фразы [{start, dur, speak, words:[t...]}].
 */
export async function synthesize(sentences, { key, template, dir, onStatus }) {
  const groups = groupSentences(sentences);
  const parts = [];
  // части заказываем параллельно (по 3 сразу), порядок склейки — исходный
  const res = new Array(groups.length); let next = 0;
  await Promise.all([...Array(Math.min(3, groups.length))].map(async () => { for (let gi; (gi = next++) < groups.length;) res[gi] = await synthChecked(groups[gi].map(i => sentences[i]), { key, template, dir, tag: String(gi), onStatus: (st, pc) => onStatus?.(st, pc, gi + 1, groups.length) }); }));
  for (const r of res) parts.push(...r);
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
    const full = sentences.map(x => norm(voiceText(x))), fullNorm = full.join('');
    const anchors = srtAnchors(srt, fullNorm);
    if (anchors) {
      let p = 0; const ends = full.map(x => (p += x.length));
      bounds = ends.slice(0, -1).map(e => { const t = interp(anchors, e); return { s: t - .05, e: t + .05 }; });
      source = 'subtitles';
      // субтитры сервиса бывают сдвинуты относительно звука — проверяем по реальным паузам; если расходятся, берём паузы
      const gaps = sil.filter(x => x.s > lead + .2 && x.e < speechEnd - .1 && x.e - x.s >= .18);
      const dev = bounds.map(b => { const mid = (b.s + b.e) / 2; return gaps.reduce((m, x) => Math.min(m, Math.abs((x.s + x.e) / 2 - mid)), 9); }).sort((a, b) => a - b);
      if (dev.length && dev[Math.floor(dev.length / 2)] > .3) { bounds = null; source = 'pauses'; }
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

/**
 * Огибающая речи по кадрам (30 к/с) для синхрона губ: 0 — рот закрыт, 1 — максимально открыт.
 * lead — сдвиг голоса в ролике (голос начинается позже на lead секунд).
 */
export function mouthEnvelope(file, lead = 0, fps = 30) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', '8000', '-f', 's16le', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = []; p.stdout.on('data', d => chunks.push(d)); p.on('error', rej);
    p.on('close', c => {
      if (c) return rej(new Error('ffmpeg envelope ' + c));
      const buf = Buffer.concat(chunks), n = buf.length >> 1, per = 8000 / fps, frames = Math.ceil(n / per);
      const rms = new Float32Array(frames);
      for (let f = 0; f < frames; f++) { let s = 0, k = 0; for (let i = Math.floor(f * per); i < Math.min(n, Math.floor((f + 1) * per)); i++, k++) { const v = buf.readInt16LE(i * 2) / 32768; s += v * v; } rms[f] = k ? Math.sqrt(s / k) : 0; }
      const sorted = [...rms].sort((a, b) => a - b), ref = sorted[Math.floor(sorted.length * .95)] || .1, gate = ref * .12;
      // быстрое открытие, плавное закрытие — так рот не «дребезжит»
      const out = new Array(Math.round(lead * fps)).fill(0); let cur = 0;
      for (const v of rms) { const tgt = Math.min(1, Math.max(0, (v - gate) / (ref - gate))); cur = tgt > cur ? cur + (tgt - cur) * .7 : cur + (tgt - cur) * .35; out.push(+cur.toFixed(2)); }
      res(out);
    });
  });
}
