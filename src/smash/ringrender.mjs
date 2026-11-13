// Рендер «Вырвется или взорвётся?» (ring.js) + звук: отсчёт, ноты на каждый отскок («В пещере горного короля», Григ — общественное достояние),
// качение шарика по кольцу, звон разбитых колец, замедление, взрыв, кнопка подписки.
// node src/smash/ringrender.mjs OUT.mp4 SEED '{"sim":{...}}'
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process'; import { fileURLToPath } from 'url';
const { chromium } = await import('../books/render.mjs');
const DIR = path.dirname(fileURLToPath(import.meta.url)), SFX = path.join(DIR, 'sfx');
const FD = path.join(DIR, '..', 'jung', 'engine', 'fonts'), CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const FACES = [['cyrillic', CYR], ['latin', LAT]].map(([n, r]) => `@font-face{font-family:Montserrat;font-weight:900;src:url("file://${path.join(FD, `montserrat-${n}-900-normal.woff2`)}");unicode-range:${r}}`).join('');
const [OUT = '/tmp/ring.mp4', SEED = '3281', OPTS = '{}', LIMIT = '0'] = process.argv.slice(2), FPS = 30, SR = 48000;
const CFG = { sim: { e: .9, vmin: 5, roll: 0, gapArc: .9, grow: 1.008, vroll: 2.6, sp: .45, r0: .15 }, ...JSON.parse(OPTS), seed: +SEED };
const INTRO = 3.6, RATE = .3, PRE = 1.2, FIN = 2.6, BOOM = 1.0, CTA_LEN = 3.2, CTA_TAP = .42;
const WORK = OUT.replace(/\.mp4$/, '') + '_work'; fs.mkdirSync(WORK, { recursive: true });
const html = path.join(WORK, 'ring.html');
fs.writeFileSync(html, `<!doctype html><html><head><meta charset=utf-8><style>${FACES}html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}</style></head>
<body><div style="font:900 10px Montserrat;position:absolute;opacity:0">ё 0123456789?!…/</div><script type="module">import 'file://${path.join(DIR, 'ring.js')}'; window.READY = true;</script></body></html>`);

const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
const p = await br.newPage({ viewport: { width: 1080, height: 1920 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + html); await p.waitForFunction(() => window.READY && window.SMASH, null, { timeout: 60000 }); await p.evaluate(() => document.fonts.ready);
const info = await p.evaluate(c => SMASH.init(c), CFG); if (errs.length) console.log('page errors:', errs);
const T = info.T, s0 = T - PRE, events = info.events;
const simToVid = t => INTRO + (t < s0 ? t : s0 + (t - s0) / RATE), finV = simToVid(T), boomV = finV + BOOM, ctaV = finV + FIN, END = ctaV + CTA_LEN;
console.log('исход', info.done, 'сим', T.toFixed(1), 'с, видео', END.toFixed(1), 'с');

const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '9M', '-bufsize', '18M', '-pix_fmt', 'yuv420p', path.join(WORK, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.ceil(END * FPS), lim = +LIMIT || frames, audio = []; let simT = 0; const t0 = Date.now();
for (let f = 0; f < Math.min(frames, lim); f++) {
  const vt = f / FPS, dtv = 1 / FPS; let pk;
  if (vt < INTRO) pk = { ph: 'intro', vt, dtv, dt: 0, simT: 0 };
  else if (vt < finV) { const rate = simT >= s0 ? RATE : 1, dt = dtv * rate; simT = Math.min(T, simT + dt); pk = { ph: 'play', vt, dtv, dt, simT, go: vt - INTRO, lastChance: simT >= s0 ? (simT - s0) / PRE : 0 }; }
  else if (vt < ctaV) pk = { ph: 'fin', vt, dtv, dt: dtv, simT: T + 1, go: 9, fin: vt - finV };
  else pk = { ph: 'cta', vt, dtv, dt: dtv, simT: T + 1, go: 9, fin: vt - finV, cta: Math.min(1, (vt - ctaV) / CTA_LEN) };
  const r = await p.evaluate(pk => SMASH.frame(pk), pk);
  audio.push({ vt, roll: r.roll, slow: pk.ph === 'play' && simT > s0, x: r.x });
  if (!ff.stdin.write(Buffer.from(r.url.split(',')[1], 'base64'))) await new Promise(res => ff.stdin.once('drain', res));
  if (f % 90 === 0) console.log(`кадр ${f}/${frames} · ${((Date.now() - t0) / 1000 / (f + 1)).toFixed(2)} с/кадр`);
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await br.close();

// ================= звук =================
const wav = f => { const b = fs.readFileSync(path.join(SFX, f + '.wav')); let o = 12; while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4); if (id === 'data') { const n = sz / 2, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return a; } o += 8 + sz; } throw new Error('wav ' + f); };
const cache = {}, S_ = f => cache[f] || (cache[f] = wav(f)), pick = (pre, n, k) => `${pre}_${Math.abs(k) % n}`;
const VEND = Math.min(END, lim / FPS), N = Math.ceil((VEND + 2) * SR), L = new Float32Array(N), Rr = new Float32Array(N), sL = new Float32Array(N), sR = new Float32Array(N);
let seed = 77; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pg = pan => [Math.cos((pan + 1) * Math.PI / 4), Math.sin((pan + 1) * Math.PI / 4)];
function add(o, s, pan = 0, send = .25) { if (o < 0 || o >= N) return; const [a, b] = pg(pan); L[o] += s * a; Rr[o] += s * b; sL[o] += s * a * send; sR[o] += s * b * send; }
function put(buf, t, { gain = 1, pan = 0, rate = 1, send = .25 } = {}) { const st = Math.round(t * SR), len = Math.floor(buf.length / rate); for (let i = 0; i < len; i++) { const x = i * rate, k = x | 0, fr = x - k; add(st + i, (buf[k] * (1 - fr) + (buf[k + 1] || 0) * fr) * gain, pan, send); } }
function sub(t, f0, dur, gain, drop = .45) { const st = Math.round(t * SR), n = Math.round(dur * SR); let ph = 0; for (let i = 0; i < n; i++) { const k = i / n; ph += 2 * Math.PI * f0 * (1 - drop * k) / SR; add(st + i, Math.sin(ph) * Math.exp(-k * 5) * Math.min(1, i / 200) * gain, 0, .05); } }
function whoosh(t, gain, dur = .8, send = .3) { const st = Math.round((t - dur / 2) * SR), n = Math.round(dur * SR); let a = 0, b = 0; for (let i = 0; i < n; i++) { const k = i / n, env = Math.exp(-((k - .5) ** 2) / .025), w = rnd() * 2 - 1; a += (w - a) * (.02 + .1 * k); b += (a - b) * .08; add(st + i, b * 7 * env * gain, (k - .5) * .8, send); } }
function tinkle(t, gain, pan, rf = 1) { const st = Math.round(t * SR); for (let k = 0; k < 3; k++) { const f = (2600 + rnd() * 5200) * rf, dec = .02 + rnd() * .05, n = Math.round(dec * 5 * SR), ph0 = rnd() * 6; for (let i = 0; i < n; i++) add(st + i, Math.sin(ph0 + 2 * Math.PI * f * i / SR) * Math.exp(-i / (dec * SR)) * gain * (1 - k * .25), pan, .35); } }
function chime(t, gain) { const st = Math.round(t * SR), n = Math.round(1.6 * SR); for (let i = 0; i < n; i++) { const e = Math.exp(-i / (.45 * SR)); add(st + i, (Math.sin(2 * Math.PI * 880 * i / SR) + .6 * Math.sin(2 * Math.PI * 1320 * i / SR) + .3 * Math.sin(2 * Math.PI * 1760 * i / SR)) * e * gain * Math.min(1, i / 120), 0, .5); } }
// фортепиано: гармоники с лёгкой негармоничностью, верхние гаснут быстрее, удар молоточка
function piano(t, f, gain, pan = 0, dur = 1.8) {
  const st = Math.round(t * SR), n = Math.round(dur * SR), B = .00035;
  const parts = [1, 2, 3, 4, 5, 6, 7, 8].map(h => ({ f: h * f * Math.sqrt(1 + B * h * h), a: 1 / h ** 1.1 * (h === 1 ? 1 : .7), d: 1.6 + h * .9, ph: rnd() * 6 }));
  for (let i = 0; i < n; i++) { const tt = i / SR, att = Math.min(1, i / (.003 * SR)); let s = 0; for (const q of parts) s += Math.sin(q.ph + 2 * Math.PI * q.f * tt) * q.a * Math.exp(-tt * q.d) * (1 + .15 * Math.sin(2 * Math.PI * .9 * tt));
    if (i < .012 * SR) s += (rnd() * 2 - 1) * .35 * (1 - i / (.012 * SR));   // стук молоточка
    add(st + i, s * att * gain * .32, pan, .45); }
}
const midi = st => 493.88 * 2 ** (st / 12);   // 0 = си первой октавы
// «В пещере горного короля»: си-минор, полутона от си
const MEL = [0, 2, 3, 5, 7, 3, 7, 6, 2, 6, 5, 1, 5, 0, 2, 3, 5, 7, 3, 7, 12, 10, 7, 3, 7, 10];

// --- отсчёт: тики, сердце, нарастающий гул, «ПОЕХАЛИ»
for (let i = 0; i < 3; i++) {
  const t = .3 + i; put(S_(pick('k_metal_light', 5, i)), t, { gain: .55, rate: 1.7, send: .3 }); add(Math.round(t * SR), 0);
  const st = Math.round(t * SR); for (let j = 0; j < .14 * SR; j++) add(st + j, Math.sin(2 * Math.PI * 1046.5 * j / SR) * Math.exp(-j / (.05 * SR)) * .28, 0, .3);   // «пип»
  for (const d of [.0, .2]) sub(t + .45 + d, 52, .28, .55 + i * .15, .2);   // тук-тук
}
{ const st = Math.round(.3 * SR), n = Math.round((INTRO - .3) * SR); let a = 0, b = 0, ph = 0;
  for (let i = 0; i < n; i++) { const k = i / n, w = rnd() * 2 - 1, fc = .01 + .2 * k * k; a += (w - a) * fc; b += (a - b) * fc; ph += 2 * Math.PI * (110 * 2 ** (k * 2)) / SR; add(st + i, (b * 2.2 + Math.sin(ph) * .18) * k * k * .6, 0, .3); } }
sub(INTRO, 44, .9, 1.1, .5); put(S_('m_FGHTImpt_PunchHardest_OS_01'), INTRO, { gain: .8, rate: .7, send: .4 }); whoosh(INTRO + .05, .5, .6);
for (const st of [0, 7, 12, 15]) piano(INTRO, midi(st - 12), .5, 0, 2.2);

// --- события физики
let lay = 0;
for (const e of events) {
  const vt = simToVid(e.t); if (vt > VEND) continue; const slow = e.t > s0, rf = slow ? .6 : 1, pan = Math.max(-.7, Math.min(.7, (e.x || 0) / 3.4));
  if (e.kind === 'bounce') {
    const loop = Math.floor((e.n - 1) / MEL.length), st = MEL[(e.n - 1) % MEL.length] + loop * 5, pw = Math.min(1, .45 + e.power * .9);
    piano(vt, midi(st), .75 * pw, pan * .5); piano(vt, midi(st - 12), .28 * pw, pan * .5, 1.2);
    put(S_(pick('k_glass_light', 5, e.n)), vt, { gain: .32 * pw, pan, rate: 1.5 * rf, send: .3 });   // стеклянный «клац» шарика
    put(S_(pick('k_metal_light', 5, e.n + 2)), vt, { gain: .16 * pw, pan, rate: (1.25 + e.ring * .06) * rf, send: .4 });   // кольцо звенит
  }
  if (e.kind === 'gap') whoosh(vt, .22 * (slow ? 1.4 : 1), .5);
  if (e.kind === 'escape') {
    lay++; const k = Math.round(e.t * 100);
    put(S_('m_GLASBrk_WindowPaneSmallBreak_OS_01'), vt, { gain: 1, pan, rate: .95 * rf, send: .5 });
    put(S_(pick('k_glass_heavy', 5, k)), vt + .01, { gain: .8, pan, rate: .9 * rf, send: .45 });
    put(S_('m_GLASBrk_GlassBottleBreak_OS_01'), vt + .03, { gain: .45, pan: -pan, rate: 1.1 * rf, send: .5 });
    sub(vt, 62 * rf, .6 / rf, .8);
    for (let i = 0; i < 12; i++) tinkle(vt + (.06 + rnd() * 1.1) / rf, .06, Math.max(-1, Math.min(1, pan + (rnd() - .5))), rf);
    for (let i = 0; i < 4; i++) put(S_(pick('k_glass_light', 5, k + i)), vt + (.15 + rnd() * .9) / rf, { gain: .25, pan: (rnd() - .5) * 1.2, rate: (1.1 + rnd() * .4) * rf, send: .4 });
    for (const st of [0, 7, 12]) piano(vt + .02, midi(st - 12 + lay * 2), .32, 0, 2.4);   // аккорд-ступенька: каждый слой выше
  }
}
// --- качение шарика по кольцу: резонансный шорох стекла + низкий гул + мелкие щелчки
{ const bp = (f, q) => { const w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al; return { b0: al / a0, b2: -al / a0, a1: -2 * Math.cos(w) / a0, a2: (1 - al) / a0 }; };
  const z1 = [0, 0, 0, 0], z2 = [0, 0, 0, 0], spf = SR / FPS; let env = 0, lp = 0, last = 0;
  for (const fr of audio) {
    const st = Math.round(fr.vt * SR), rf = fr.slow ? .6 : 1, v = fr.roll, target = v > 0 ? Math.min(1, .35 + v / 8) : 0;
    const F1 = bp((650 + v * 90) * rf, 4), F2 = bp((2300 + v * 160) * rf, 3);
    for (let i = 0; i < spf; i++) { const o = st + i; if (o >= N) break;
      env += (target - env) * (target > env ? .004 : .0012); if (env < 1e-4 && target === 0) continue;
      const w = rnd() * 2 - 1;
      const y1 = F1.b0 * w + z1[0]; z1[0] = F1.a1 * -y1 + z1[1]; z1[1] = F1.b2 * w - F1.a2 * y1;
      const y2 = F2.b0 * w + z2[0]; z2[0] = F2.a1 * -y2 + z2[1]; z2[1] = F2.b2 * w - F2.a2 * y2;
      lp += (w - lp) * .006 * rf;
      let s = (y1 * .9 + y2 * .45 + lp * 3.2) * env;
      if (rnd() < v * 25 / SR) s += (rnd() - .5) * .5 * env;   // крупинки
      last = s; add(o, s * .55, Math.max(-.6, Math.min(.6, fr.x / 3.4)), .15); }
  } }
// --- замедление: вдох, сердце; финал: надувается, взрыв, искры
sub(simToVid(s0), 90, 1.1, .45, .6);
for (let t = simToVid(s0) + .2; t < finV; t += .55) for (const d of [0, .17]) sub(t + d, 50, .3, .7, .2);
{ const st = Math.round((finV + .25) * SR), n = Math.round((BOOM - .25) * SR); let ph = 0; for (let i = 0; i < n; i++) { const k = i / n; ph += 2 * Math.PI * (180 * 2 ** (k * 2.6)) / SR; add(st + i, (Math.sin(ph) + .3 * Math.sin(ph * 2.01)) * k * k * .22 * (1 + .3 * Math.sin(i / SR * 2 * Math.PI * 18)), 0, .3); } }
put(S_('m_WOODFric_CreaksCreepy_OS_01'), finV + .3, { gain: .35, rate: 1.4, send: .3 });
if (boomV < VEND) {
  sub(boomV, 38, 1.6, 1.4, .5); put(S_('m_FGHTImpt_PunchHardest_OS_01'), boomV, { gain: 1, rate: .5, send: .5 }); put(S_(pick('k_metal_heavy', 5, 3)), boomV, { gain: .6, rate: .55, send: .5 });
  put(S_('m_GLASBrk_GlassBottleBreak_OS_01'), boomV + .01, { gain: .7, rate: .7, send: .6 }); put(S_('m_GLASBrk_WindowPaneSmallBreak_OS_01'), boomV + .02, { gain: .7, rate: .8, send: .6 }); whoosh(boomV + .1, .7, 1.2, .5);
  for (let i = 0; i < 70; i++) { const t = boomV + .15 + rnd() ** 1.6 * 1.6, st = Math.round(t * SR); for (let j = 0; j < 160; j++) add(st + j, (rnd() * 2 - 1) * Math.exp(-j / 30) * .3, (rnd() - .5) * 1.6, .4); }   // треск салюта
  for (const st of [0, 4, 7, 12]) piano(boomV + .45, midi(st), .42, 0, 2.6);   // си-мажор — победа
}
if (ctaV < VEND) { whoosh(ctaV + .15, .5, .5); const tap = ctaV + CTA_TAP * CTA_LEN; put(S_(pick('k_metal_light', 5, 1)), tap, { gain: .5, rate: 2.2 }); chime(tap + .05, .3); }
// --- фон: низкий бурдон си-минор, растёт со слоями; тишина в отсчёте и после взрыва
{ let ph1 = 0, ph2 = 0; const st = Math.round(INTRO * SR), end = Math.round(Math.min(boomV, VEND) * SR), esc = events.filter(e => e.kind === 'escape').map(e => simToVid(e.t));
  for (let o = st; o < end; o++) { const t = o / SR, l = esc.filter(x => x < t).length, g0 = (.05 + l * .018) * Math.min(1, (t - INTRO) / 1.5) * Math.min(1, (boomV - t) / .3); ph1 += 2 * Math.PI * 61.74 / SR; ph2 += 2 * Math.PI * 92.5 / SR; add(o, (Math.sin(ph1) + .5 * Math.sin(ph2) + .2 * Math.sin(ph1 * 3)) * g0 * (1 + .2 * Math.sin(t * 1.3)), 0, .1); } }

function reverb(inp) { const out = new Float32Array(N), combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ d: Math.round(d * SR / 44100), b: new Float32Array(Math.round(d * SR / 44100)), i: 0, f: .84 })); const aps = [225, 556, 441].map(d => ({ b: new Float32Array(Math.round(d * SR / 44100)), i: 0 }));
  for (let n = 0; n < N; n++) { let s = 0; for (const c of combs) { const y = c.b[c.i]; c.b[c.i] = inp[n] + y * c.f; c.i = (c.i + 1) % c.d; s += y; } s /= combs.length; for (const a of aps) { const y = a.b[a.i], x = s + y * .5; a.b[a.i] = x; a.i = (a.i + 1) % a.b.length; s = y - x * .5; } out[n] = s; } return out; }
const rvL = reverb(sL), rvR = reverb(sR); for (let i = 0; i < N; i++) { L[i] += rvL[i] * .8; Rr[i] += rvR[i] * .8; }
let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i]));
const gn = 1.2 / Math.max(.3, pk), data = Buffer.alloc(N * 4); for (let i = 0; i < N; i++) { data.writeInt16LE(Math.round(Math.tanh(L[i] * gn) * .92 * 32767), i * 4); data.writeInt16LE(Math.round(Math.tanh(Rr[i] * gn) * .92 * 32767), i * 4 + 2); }
const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(WORK, 'audio.wav'), Buffer.concat([hdr, data]));
await new Promise((res, rej) => { const m = spawn('ffmpeg', ['-y', '-v', 'error', '-i', path.join(WORK, 'video.mp4'), '-i', path.join(WORK, 'audio.wav'), '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT]); m.on('close', c => c ? rej(new Error('mux ' + c)) : res()); });
console.log('RESULT ' + JSON.stringify({ out: OUT, dur: +VEND.toFixed(2), outcome: info.done, bounces: events.filter(e => e.kind === 'bounce').length, layers: lay }));
