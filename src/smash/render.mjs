// «Молот против машин» — рендер залипалки 9:16 + звук из событий физики (ASMR-сведение).
// node src/smash/render.mjs OUT.mp4 [seed] [seconds]
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process'; import { fileURLToPath } from 'url';
const { chromium } = await import('../books/render.mjs');
const DIR = path.dirname(fileURLToPath(import.meta.url)), SFX = path.join(DIR, 'sfx'), V3 = path.join(DIR, '..', 'scale3d', 'vendor');
const FONT = path.join(DIR, '..', 'jung', 'engine', 'fonts', 'montserrat-cyrillic-900-normal.woff2');
const [OUT = '/tmp/smash.mp4', SEED = '7', SECS = '0'] = process.argv.slice(2), FPS = 30, SR = 48000;
const GL = ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
const WORK = OUT.replace(/\.mp4$/, '') + '_work'; fs.mkdirSync(WORK, { recursive: true });
const page_html = path.join(WORK, 'smash.html');
fs.writeFileSync(page_html, `<!doctype html><html><head><meta charset=utf-8><style>@font-face{font-family:Montserrat;font-weight:900;src:url("file://${FONT}")}html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"file://${path.join(V3, 'three.module.min.js')}"}}</script></head><body><div style="font:900 10px Montserrat;position:absolute;opacity:0">ё</div>
<script type="module">import 'file://${path.join(DIR, 'world.js')}'; window.READY = true;</script></body></html>`);

const br = await chromium.launch({ args: GL });
async function openPage() { const p = await br.newPage({ viewport: { width: 1080, height: 1920 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + page_html); await p.waitForFunction(() => window.READY && window.SMASH, null, { timeout: 60000 }); await p.evaluate(() => document.fonts.ready);
  if (errs.length) console.log('page errors:', errs.slice(0, 3)); return p; }

// ---- проход 1: симуляция целиком, ищем лучшие удары для повторов
let p = await openPage();
const info = await p.evaluate(s => SMASH.init({ seed: +s }), SEED);
const simEnd = +SECS || info.simEnd;
await p.evaluate(t => SMASH.fastForward(t), simEnd);
const ev1 = await p.evaluate(() => SMASH.events);
const hits = ev1.filter(e => e.kind === 'hit');
console.log('машин', info.cars, 'сим', simEnd.toFixed(1), 'c, ударов', hits.length);
const slows = []; for (const h of [...hits].sort((a, b) => b.power - a.power)) { if (h.t < 3.5 || h.t > simEnd - 3) continue; if (slows.some(s => Math.abs(s.t - h.t) < 9)) continue; slows.push(h); if (slows.length >= 3) break; }
slows.sort((a, b) => a.t - b.t);
const RATE = .28, PRE = .3, POST = .85;
const win = slows.map((h, i) => ({ s0: h.t - PRE, s1: h.t + POST, at: { x: h.x, z: h.z }, ang: [.7, 2.4, 4.0][i % 3], hit: h }));
// видео-время ↔ сим-время
const extra = w => (w.s1 - w.s0) * (1 / RATE - 1);
function simToVid(s) { let v = s; for (const w of win) { if (s >= w.s1) v += extra(w); else if (s > w.s0) v += (s - w.s0) * (1 / RATE - 1); } return v; }
function slowAt(s) { return win.find(w => s >= w.s0 && s < w.s1) || null; }
const vidEnd = simToVid(simEnd); console.log('повторы:', win.map(w => w.s0.toFixed(1)).join(', '), 'видео', vidEnd.toFixed(1), 'с');
await p.close();

// ---- проход 2: рендер кадров
p = await openPage(); await p.evaluate(s => SMASH.init({ seed: +s }), SEED);
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', path.join(WORK, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.ceil(vidEnd * FPS), audio = []; let simT = 0; const t0 = Date.now();
for (let f = 0; f < frames; f++) {
  const vt = f / FPS, sl = slowAt(simT), dsim = (1 / FPS) * (sl ? RATE : 1);
  const slow = sl ? { t0: sl.s0, at: sl.at, ang: sl.ang, car: sl.hit.car } : null;
  const url = await p.evaluate(([d, vt, slow]) => { SMASH.advance(d); SMASH.render(vt, slow, 1 / 30); return document.querySelector('canvas').toDataURL('image/jpeg', .9); }, [dsim, vt, slow]);
  simT += dsim;
  const fa = await p.evaluate(() => SMASH.frameAudio()); audio.push({ vt, slow: !!sl, ...fa });
  if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  if (f % 60 === 0) console.log(`кадр ${f}/${frames} · ${((Date.now() - t0) / 1000 / (f + 1)).toFixed(2)} с/кадр`);
}
const events = await p.evaluate(() => SMASH.events);
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await br.close();
fs.writeFileSync(path.join(WORK, 'events.json'), JSON.stringify({ events, win, audio: audio.length }));

// ---- звук
const wav = f => { const b = fs.readFileSync(path.join(SFX, f + '.wav')); let o = 12; while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4); if (id === 'data') { const n = sz / 2, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return a; } o += 8 + sz; } throw new Error('wav ' + f); };
const cache = {}; const S_ = f => cache[f] || (cache[f] = wav(f));
const pick = (pre, n, k) => `${pre}_${Math.abs(k) % n}`;
const N = Math.ceil((vidEnd + 2.5) * SR), L = new Float32Array(N), Rr = new Float32Array(N), sendL = new Float32Array(N), sendR = new Float32Array(N);
let seed = 99; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function put(buf, t, { gain = 1, pan = 0, rate = 1, send = .25, peakAlign = false } = {}) {
  let start = Math.round(t * SR);
  if (peakAlign) { let mi = 0, mv = 0; for (let i = 0; i < buf.length; i++) if (Math.abs(buf[i]) > mv) { mv = Math.abs(buf[i]); mi = i; } start -= Math.round(mi / rate); }
  const gl = Math.cos((pan + 1) * Math.PI / 4) * gain, gr = Math.sin((pan + 1) * Math.PI / 4) * gain, len = Math.floor(buf.length / rate);
  for (let i = 0; i < len; i++) { const o = start + i; if (o < 0 || o >= N) continue; const x = i * rate, k = x | 0, fr = x - k, s = buf[k] * (1 - fr) + (buf[k + 1] || 0) * fr; L[o] += s * gl; Rr[o] += s * gr; sendL[o] += s * gl * send; sendR[o] += s * gr * send; }
}
const panX = x => Math.max(-.85, Math.min(.85, x / 14));
function sub(t, f0, dur, gain) { const st = Math.round(t * SR), n = Math.round(dur * SR); let ph = 0; for (let i = 0; i < n; i++) { const o = st + i; if (o < 0 || o >= N) continue; const k = i / n, f = f0 * (1 - .45 * k); ph += 2 * Math.PI * f / SR; const s = Math.sin(ph) * Math.exp(-k * 5) * Math.min(1, i / 200) * gain; L[o] += s; Rr[o] += s; } }
function airWhoosh(t, gain, rate) { const st = Math.round((t - .45 / rate) * SR), n = Math.round(.9 / rate * SR); let a = 0, b = 0; for (let i = 0; i < n; i++) { const o = st + i; if (o < 0 || o >= N) continue; const k = i / n, env = Math.exp(-((k - .5) ** 2) / .02); const w = rnd() * 2 - 1; a += (w - a) * .02; b += (a - b) * .05; const s = b * 9 * env * gain; L[o] += s; Rr[o] += s; } }
const camX = 3.5;
for (const e of events) {
  const vt = simToVid(e.t), sl = slowAt(e.t), rf = sl ? .55 : 1, g = sl ? 1.15 : 1;
  if (e.kind === 'hit') {
    const pw = Math.min(1.4, e.power), pan = panX(e.x - camX), k = Math.round(e.t * 100), bus = e.bus ? .82 : 1;
    put(S_(pick('k_metal_heavy', 5, k)), vt, { gain: .95 * pw * g, pan, rate: .6 * rf * bus, send: .45 });
    put(S_(pick('k_plate_heavy', 5, k + 1)), vt + .004, { gain: .8 * pw * g, pan, rate: .68 * rf * bus, send: .45 });
    put(S_(`m_METLImpt_MetalHitSurface_OS_0${1 + (k % 5)}`), vt + .008, { gain: .85 * pw * g, pan, rate: .78 * rf * bus, send: .5 });
    put(S_('m_FGHTImpt_PunchHardest_OS_01'), vt, { gain: .9 * pw * g, pan, rate: .62 * rf, send: .3 });
    sub(vt, (e.bus ? 42 : 55) * rf, .55 / rf, .75 * pw);
    if (e.glass) { put(S_('m_GLASBrk_WindowPaneSmallBreak_OS_01'), vt + .015, { gain: .85 * g, pan, rate: .95 * rf, send: .5 }); put(S_(pick('k_glass_heavy', 5, k)), vt + .02, { gain: .55 * g, pan, rate: .9 * rf }); put(S_('m_GLASBrk_GlassBottleBreak_OS_01'), vt + .06, { gain: .4 * g, pan, rate: 1.1 * rf, send: .5 }); }
    for (let i = 0; i < 10; i++) { const dt = (.12 + rnd() * 1.4) / rf; put(S_(pick('k_glass_light', 5, k + i)), vt + dt, { gain: (.35 - i * .025) * g, pan: Math.max(-1, Math.min(1, pan + (rnd() - .5) * .8)), rate: (.9 + rnd() * .5) * rf, send: .35 }); }
    for (let i = 0; i < 3; i++) put(S_(`m_METLImpt_MetalObjDrop_OS_0${1 + ((k + i) % 4)}`), vt + (.35 + rnd() * .9) / rf, { gain: .3 * g, pan: pan + (rnd() - .5) * .5, rate: (.8 + rnd() * .3) * rf, send: .3 });
  }
  if (e.kind === 'bounce') { const gn = Math.min(1, e.v / 14), k = Math.round(e.t * 100), pan = panX(e.x - camX); put(S_(pick('k_plate_medium', 5, k)), vt, { gain: .7 * gn * g, pan, rate: .75 * rf, send: .35 }); put(S_(`m_METLImpt_MetalObjDrop_OS_0${1 + (k % 4)}`), vt + .01, { gain: .55 * gn * g, pan, rate: .7 * rf }); if (gn > .45) { put(S_(pick('k_glass_light', 5, k)), vt + .03, { gain: .3 * g, pan, rate: rf }); sub(vt, 60 * rf, .3, .35 * gn); } }
  if (e.kind === 'carcar') { const k = Math.round(e.t * 100), pan = panX(e.x - camX); put(S_(pick('k_metal_heavy', 5, k + 3)), vt, { gain: .6 * e.power * g, pan, rate: .8 * rf, send: .4 }); put(S_(pick('k_plate_heavy', 5, k)), vt, { gain: .5 * e.power * g, pan, rate: .85 * rf }); }
  if (e.kind === 'tink') { const k = Math.round(e.t * 1000); put(S_(e.kind === 'chunk' ? pick('k_metal_light', 5, k) : pick('k_glass_light', 5, k)), vt, { gain: .12, pan: panX(e.x - camX), rate: (1 + rnd() * .4) * rf }); }
  if (e.kind === 'swing') { const k = Math.round(e.t * 10); put(S_(`m_SWSH_Swoosh_OS_0${1 + (k % 6)}`), vt, { gain: .9 * g, pan: e.dir * .25, rate: .4 * rf, send: .3, peakAlign: true }); airWhoosh(vt, .55 * g, rf); }
  if (e.kind === 'turn') put(S_(`m_WOODFric_CreaksCreepy_OS_0${1 + (Math.round(e.t) % 2)}`), vt - .2, { gain: .07, pan: e.side * .4, rate: 1.25 * rf, send: .2 });
}
// замедление: «вдох» перед повтором
for (const w of win) { const v = simToVid(w.s0); sub(v, 90, .9, .35); }
// моторы проезжающих машин (петля, доплер, громкость от расстояния)
const ENG = S_('m_VEHCar_CarEngineSlow_LOOP_01'), ENGH = S_('m_VEHCar_CarEngineHigh_LOOP_01'), phase = {}, spf = SR / FPS;
for (const fr of audio) { const st = Math.round(fr.vt * SR); for (const c of fr.cars) { if (c.dyn) continue; const g0 = Math.min(.55, 6 / Math.max(6, c.dist)) * (c.bus ? 1.3 : 1), dop = 343 / (343 + c.vr), rate = (c.bus ? .62 : .95) * dop * (fr.slow ? .55 : 1), src = c.bus ? ENG : ENGH, pan = panX(c.x);
  let ph = phase[c.i] ?? (c.i * 7919) % src.length; for (let i = 0; i < spf; i++) { const o = st + i; if (o >= N) break; const k = ph | 0, s = src[k % src.length]; L[o] += s * g0 * .5 * Math.cos((pan + 1) * Math.PI / 4); Rr[o] += s * g0 * .5 * Math.sin((pan + 1) * Math.PI / 4); ph += rate; } phase[c.i] = ph % src.length; } }
// скрежет металла по асфальту
let sa = 0, sb = 0; for (const fr of audio) { const sc = fr.cars.reduce((m, c) => m + (c.dyn ? c.scrape : 0), 0); if (sc < .8) continue; const st = Math.round(fr.vt * SR), gn = Math.min(.5, sc / 40) * (fr.slow ? .7 : 1); for (let i = 0; i < spf; i++) { const o = st + i; if (o >= N) break; const w = rnd() * 2 - 1; sa += (w - sa) * .35; sb += (sa - sb) * .12; const s = (sa - sb) * gn * 2.2; L[o] += s; Rr[o] += s; } }
// окружение: ветер в деревьях и птицы, с «приседанием» на ударах
const AMB = S_('m_WINDVege_LightWindTreesBirds_LOOP_01'), hitsV = events.filter(e => e.kind === 'hit').map(e => simToVid(e.t));
for (let i = 0; i < N; i++) { const t = i / SR; let duck = 1; for (const h of hitsV) { const d = t - h; if (d > -.02 && d < 1.2) duck = Math.min(duck, .35 + .65 * (d / 1.2)); } const s = AMB[i % AMB.length] * .32 * duck, s2 = AMB[(i + 24000) % AMB.length] * .32 * duck; L[i] += s; Rr[i] += s2; }
// реверберация (Шрёдер) для объёма ударов
function reverb(inp) { const out = new Float32Array(N), combs = [1557, 1617, 1491, 1422].map(d => ({ d: Math.round(d * SR / 44100), b: new Float32Array(Math.round(d * SR / 44100)), i: 0, f: .8 })); const aps = [225, 556].map(d => ({ b: new Float32Array(Math.round(d * SR / 44100)), i: 0 }));
  for (let n = 0; n < N; n++) { let s = 0; for (const c of combs) { const y = c.b[c.i]; c.b[c.i] = inp[n] + y * c.f; c.i = (c.i + 1) % c.d; s += y; } s *= .25; for (const a of aps) { const y = a.b[a.i], x = s + y * .5; a.b[a.i] = x; a.i = (a.i + 1) % a.b.length; s = y - x * .5; } out[n] = s; } return out; }
const rvL = reverb(sendL), rvR = reverb(sendR); for (let i = 0; i < N; i++) { L[i] += rvL[i] * .5; Rr[i] += rvR[i] * .5; }
let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i]));
const gn = 1.25 / Math.max(.3, pk), data = Buffer.alloc(N * 4); for (let i = 0; i < N; i++) { data.writeInt16LE(Math.round(Math.tanh(L[i] * gn) * .92 * 32767), i * 4); data.writeInt16LE(Math.round(Math.tanh(Rr[i] * gn) * .92 * 32767), i * 4 + 2); }
const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(WORK, 'audio.wav'), Buffer.concat([hdr, data]));
await new Promise((res, rej) => { const m = spawn('ffmpeg', ['-y', '-v', 'error', '-i', path.join(WORK, 'video.mp4'), '-i', path.join(WORK, 'audio.wav'), '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT]); m.on('close', c => c ? rej(new Error('mux ' + c)) : res()); });
console.log('готово:', OUT, 'видео', vidEnd.toFixed(1), 'с, ударов', events.filter(e => e.kind === 'hit').length);
