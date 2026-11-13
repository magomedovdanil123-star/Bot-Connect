// Рендер «Гонка шаров — выбери цвет» (race.js) + звук: старт как в F1 (3 низких «пип» и высокий), ворота, барабанный бит гонки,
// качение каждого шара, щелчки о штырьки, стук шаров друг о друга, «бойнг» отбойников, фотофиниш в замедлении, фанфары, подписка.
// node src/smash/racerender.mjs OUT.mp4 SEED '{"layout":1}'   (want: true — подобрать seed с плотным финишем)
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process'; import { fileURLToPath } from 'url';
const { chromium } = await import('../books/render.mjs');
const DIR = path.dirname(fileURLToPath(import.meta.url)), SFX = path.join(DIR, 'sfx');
const FD = path.join(DIR, '..', 'jung', 'engine', 'fonts'), CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const FACES = [['cyrillic', CYR], ['latin', LAT]].map(([n, r]) => `@font-face{font-family:Montserrat;font-weight:900;src:url("file://${path.join(FD, `montserrat-${n}-900-normal.woff2`)}");unicode-range:${r}}`).join('');
const [OUT = '/tmp/race.mp4', SEED = '154', OPTS = '{}', LIMIT = '0'] = process.argv.slice(2), FPS = 30, SR = 48000, O = JSON.parse(OPTS);
const CFG = { layout: 1, ...O, seed: +SEED };
const { THEMES, palette } = await import('./racethemes.js'), TH = THEMES[CFG.theme] || THEMES.neon, SND = TH.sound, PAL = palette(CFG.pal || TH.pal);
const INTRO = 3.6, RATE = .3, PRE = .9, POST = .25, FIN = 2.6, CTA_LEN = 3.2, CTA_TAP = .42;
// подбор seed: победитель на 22–30 с, второй отстал меньше чем на 0.6 с, лидер сменился 5+ раз
if (O.want) {
  const { simulateRace } = await import('./racesim.js');
  const good = r => { const ev = r.S.events, f = ev.filter(e => e.kind === 'finish'), l = ev.filter(e => e.kind === 'lead'); return f.length >= 2 && f[0].t >= 22 && f[0].t <= 30 && f[1].t - f[0].t < .6 && l.length >= 5 && !ev.some(e => e.kind === 'nudge'); };
  const ok2 = r => { const ev = r.S.events, f = ev.filter(e => e.kind === 'finish'), l = ev.filter(e => e.kind === 'lead'); return f.length >= 2 && f[0].t >= 20 && f[0].t <= 34 && f[1].t - f[0].t < 1.2 && l.length >= 3 && !ev.some(e => e.kind === 'nudge'); };
  let s = CFG.seed, i = 0; for (; i < 1500 && !good(simulateRace(s, CFG.layout, {}, 40)); i++) s++;
  if (i >= 1500) { s = CFG.seed; for (let j = 0; j < 1500 && !ok2(simulateRace(s, CFG.layout, {}, 40)); j++) s++; }   // такая трасса редко даёт плотный финиш — берём чуть свободнее
  console.log('seed', CFG.seed, '→', s); CFG.seed = s;
}
const WORK = OUT.replace(/\.mp4$/, '') + '_work'; fs.mkdirSync(WORK, { recursive: true });
const html = path.join(WORK, 'race.html');
fs.writeFileSync(html, `<!doctype html><html><head><meta charset=utf-8><style>${FACES}html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}</style></head>
<body><div style="font:900 10px Montserrat;position:absolute;opacity:0">ё 0123456789?!…/</div><script type="module">import 'file://${path.join(DIR, 'race.js')}'; window.READY = true;</script></body></html>`);

const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--allow-file-access-from-files', '--disable-dev-shm-usage'] });
const p = await br.newPage({ viewport: { width: 1080, height: 1920 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + html); await p.waitForFunction(() => window.READY && window.SMASH, null, { timeout: 60000 }); await p.evaluate(() => document.fonts.ready);
const info = await p.evaluate(c => SMASH.init(c), CFG); if (errs.length) console.log('page errors:', errs);
const events = info.events, fins = events.filter(e => e.kind === 'finish'), Tw = fins[0].t, s0 = Tw - PRE, s1 = Tw + POST;
const simToVid = t => INTRO + (t < s0 ? t : t < s1 ? s0 + (t - s0) / RATE : s0 + (s1 - s0) / RATE + (t - s1));
const winV = simToVid(Tw), finV = simToVid(s1), ctaV = finV + FIN, END = ctaV + CTA_LEN;
console.log('победил', fins[0].b, 'на', Tw.toFixed(1), 'с, отрыв', (fins[1].t - Tw).toFixed(2), 'с, видео', END.toFixed(1), 'с');

const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-maxrate', '9M', '-bufsize', '18M', '-pix_fmt', 'yuv420p', path.join(WORK, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
const frames = Math.ceil(END * FPS), lim = +LIMIT || frames, audio = []; let simT = 0; const t0 = Date.now();
for (let f = 0; f < Math.min(frames, lim); f++) {
  const vt = f / FPS, dtv = 1 / FPS; let pk;
  if (vt < INTRO) pk = { ph: 'intro', vt, dtv, dt: 0, simT: 0 };
  else { const rate = simT >= s0 && simT < s1 ? RATE : 1, dt = dtv * rate; simT += dt;
    const ph = vt < finV ? 'race' : vt < ctaV ? 'fin' : 'cta';
    pk = { ph, vt, dtv, dt, simT, go: vt - INTRO, photo: simT >= s0 && simT < Tw ? (simT - s0) / PRE : 0, photoTxt: fins[1].t - Tw < .6, fin: vt - finV, cta: Math.min(1, (vt - ctaV) / CTA_LEN) }; }
  const r = await p.evaluate(pk => SMASH.frame(pk), pk);
  audio.push({ vt, slow: pk.dt && pk.dt < dtv * .9, balls: r.balls, camY: r.camY, sc: r.sc });
  if (!ff.stdin.write(Buffer.from(r.url.split(',')[1], 'base64'))) await new Promise(res => ff.stdin.once('drain', res));
  if (f % 90 === 0) console.log(`кадр ${f}/${frames} · ${((Date.now() - t0) / 1000 / (f + 1)).toFixed(2)} с/кадр`);
}
ff.stdin.end(); await new Promise(r => ff.on('close', r)); await br.close();

// ================= звук =================
const wav = f => { const b = fs.readFileSync(path.join(SFX, f + '.wav')); let o = 12; while (o < b.length) { const id = b.toString('ascii', o, o + 4), sz = b.readUInt32LE(o + 4); if (id === 'data') { const n = sz / 2, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = b.readInt16LE(o + 8 + i * 2) / 32768; return a; } o += 8 + sz; } throw new Error('wav ' + f); };
const cache = {}, S_ = f => cache[f] || (cache[f] = wav(f)), pick = (pre, n, k) => `${pre}_${Math.abs(k) % n}`;
const VEND = Math.min(END, lim / FPS), N = Math.ceil((VEND + 2) * SR), L = new Float32Array(N), Rr = new Float32Array(N), sL = new Float32Array(N), sR = new Float32Array(N);
let seed = 91; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const pg = pan => [Math.cos((pan + 1) * Math.PI / 4), Math.sin((pan + 1) * Math.PI / 4)];
function add(o, s, pan = 0, send = .25) { if (o < 0 || o >= N) return; const [a, b] = pg(pan); L[o] += s * a; Rr[o] += s * b; sL[o] += s * a * send; sR[o] += s * b * send; }
function put(buf, t, { gain = 1, pan = 0, rate = 1, send = .25 } = {}) { const st = Math.round(t * SR), len = Math.floor(buf.length / rate); for (let i = 0; i < len; i++) { const x = i * rate, k = x | 0, fr = x - k; add(st + i, (buf[k] * (1 - fr) + (buf[k + 1] || 0) * fr) * gain, pan, send); } }
function sub(t, f0, dur, gain, drop = .45) { const st = Math.round(t * SR), n = Math.round(dur * SR); let ph = 0; for (let i = 0; i < n; i++) { const k = i / n; ph += 2 * Math.PI * f0 * (1 - drop * k) / SR; add(st + i, Math.sin(ph) * Math.exp(-k * 5) * Math.min(1, i / 200) * gain, 0, .05); } }
function whoosh(t, gain, dur = .8, send = .3) { const st = Math.round((t - dur / 2) * SR), n = Math.round(dur * SR); let a = 0, b = 0; for (let i = 0; i < n; i++) { const k = i / n, env = Math.exp(-((k - .5) ** 2) / .025), w = rnd() * 2 - 1; a += (w - a) * (.02 + .1 * k); b += (a - b) * .08; add(st + i, b * 7 * env * gain, (k - .5) * .8, send); } }
function tone(t, f, dur, gain, pan = 0, send = .3, decay = 8) { const st = Math.round(t * SR), n = Math.round(dur * SR); for (let i = 0; i < n; i++) add(st + i, Math.sin(2 * Math.PI * f * i / SR) * Math.exp(-i / SR * decay) * Math.min(1, i / 60) * gain, pan, send); }
function piano(t, f, gain, pan = 0, dur = 1.8) { const st = Math.round(t * SR), n = Math.round(dur * SR), B = .00035; const parts = [1, 2, 3, 4, 5, 6].map(h => ({ f: h * f * Math.sqrt(1 + B * h * h), a: 1 / h ** 1.1, d: 1.6 + h * .9, ph: rnd() * 6 }));
  for (let i = 0; i < n; i++) { const tt = i / SR; let s = 0; for (const q of parts) s += Math.sin(q.ph + 2 * Math.PI * q.f * tt) * q.a * Math.exp(-tt * q.d); add(st + i, s * Math.min(1, i / 150) * gain * .32, pan, .45); } }
function chime(t, gain) { tone(t, 880, 1.6, gain, 0, .5, 2.2); tone(t, 1320, 1.6, gain * .6, 0, .5, 2.2); tone(t, 1760, 1.6, gain * .3, 0, .5, 2.2); }
const midi = st => 329.63 * 2 ** (st / 12);   // 0 = ми первой октавы

// где в кадре был шар в момент события: за кадром — тише
const camAt = vt => audio[Math.max(0, Math.min(audio.length - 1, Math.round(vt * FPS)))] || { camY: 0, sc: 165 };
const visG = (vt, y) => { const c = camAt(vt); return y > c.camY - .4 && y < c.camY + 1920 / c.sc + .4 ? 1 : .35; };
const panOf = x => Math.max(-.75, Math.min(.75, (x - 3.2) / 3.2 * .75));

// --- старт: три низких «пип», высокий «пиииип», ворота
for (let i = 0; i < 3; i++) { const t = .3 + i; tone(t, 660, .22, .35, 0, .3, 6); put(S_(pick('k_metal_light', 5, i)), t, { gain: .25, rate: 1.8 }); }
tone(INTRO, 1320, .6, .45, 0, .35, 2.5); put(S_(pick('k_metal_heavy', 5, 2)), INTRO + .02, { gain: .7, rate: 1.3, send: .4 }); put(S_('m_WOODImpt_LargeWoodDrop_OS_01'), INTRO + .05, { gain: .5, rate: 1.4 }); whoosh(INTRO + .15, .5, .5); sub(INTRO, 55, .5, .7);
{ const st = Math.round(.3 * SR), n = Math.round((INTRO - .3) * SR); let a = 0, b = 0; for (let i = 0; i < n; i++) { const k = i / n, w = rnd() * 2 - 1; a += (w - a) * (.01 + .15 * k * k); b += (a - b) * .1; add(st + i, b * 1.6 * k * k * .5, 0, .3); } }   // нарастающий шум толпы-ветра

// --- бит гонки: 150 BPM, бочка/малый/хэт + бас в ми-миноре; к финишной прямой — плотнее; на фотофинише — «стоп плёнки»
{ const bpm = SND.bpm || 150, beat = 60 / bpm, start = INTRO, stopV = simToVid(s0), BASS = [0, 0, 3, 0, 5, 0, 7, 5];
  let ph = 0;
  for (let k = 0; start + k * beat / 2 < stopV; k++) {
    const t = start + k * beat / 2, late = t > stopV - 6, g0 = Math.min(1, (t - start) / 2) * .9;
    if (k % 2 === 0) { const st = Math.round(t * SR), n = Math.round(.18 * SR); let q = 0; for (let i = 0; i < n; i++) { q += 2 * Math.PI * (52 + 90 * Math.exp(-i / (.02 * SR))) / SR; add(st + i, Math.sin(q) * Math.exp(-i / (.07 * SR)) * .8 * g0, 0, .05); } }   // бочка
    if (k % 4 === 2) { const st = Math.round(t * SR), n = Math.round(.16 * SR); let lp = 0; for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1; lp += (w - lp) * .5; add(st + i, (w - lp * .6) * Math.exp(-i / (.05 * SR)) * .33 * g0 + Math.sin(2 * Math.PI * 190 * i / SR) * Math.exp(-i / (.03 * SR)) * .25 * g0, 0, .2); } }   // малый
    for (const sub16 of late ? [0, .5] : [0]) { const st = Math.round((t + sub16 * beat / 2) * SR), n = Math.round(.04 * SR); let lp = 0; for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1; lp += (w - lp) * .3; add(st + i, (w - lp) * Math.exp(-i / (.012 * SR)) * .16 * g0, .2, .1); } }   // хэт
    const f = midi(BASS[k % 8] - 24 + (SND.key || 0)), st = Math.round(t * SR), n = Math.round(beat / 2 * .9 * SR); for (let i = 0; i < n; i++) { ph += 2 * Math.PI * f / SR; const saw = (ph / Math.PI % 2) - 1, sq = Math.sin(ph) > 0 ? .5 : -.5; add(st + i, (SND.chip ? sq * .55 : Math.sin(ph) * .6 + saw * .15) * Math.exp(-i / (.25 * SR)) * .42 * g0, 0, .05); }
    if (SND.chip && k % 2 === 0) { const ar = [0, 7, 12, 7][(k / 2) % 4], fl = midi(ar + 12 + (SND.key || 0)), st2 = Math.round(t * SR), n2 = Math.round(beat * .4 * SR); for (let i = 0; i < n2; i++) add(st2 + i, (Math.sin(2 * Math.PI * fl * i / SR) > 0 ? .1 : -.1) * Math.exp(-i / (.12 * SR)) * g0, .15, .2); }   // 8-бит арпеджио
  }
  // «стоп плёнки»: опускающийся гул
  { const st = Math.round(stopV * SR), n = Math.round(.5 * SR); let q = 0; for (let i = 0; i < n; i++) { const k = i / n; q += 2 * Math.PI * 82 * (1 - k * .8) / SR; add(st + i, Math.sin(q) * (1 - k) * .5, 0, .1); } }
  for (let t = stopV + .15; t < winV; t += .5) for (const d of [0, .16]) sub(t + d, 50, .28, .7, .2);   // сердце на фотофинише
}

// --- звук локации: пэд космоса, вода, гул вулкана, ветер, сверчки ночи
if (SND.amb) { const st = Math.round(.2 * SR), end = Math.round(Math.min(VEND, ctaV) * SR); let a = 0, b = 0, ph1 = 0, ph2 = 0;
  for (let o = st; o < end; o++) { const t = o / SR, w = rnd() * 2 - 1, fade = Math.min(1, (t - .2) / 1.5, (ctaV - t) / .8); let v = 0;
    if (SND.amb === 'pad') { ph1 += 2 * Math.PI * midi(-12 + (SND.key || 0)) / SR; ph2 += 2 * Math.PI * midi(-5 + (SND.key || 0)) * 1.003 / SR; v = (Math.sin(ph1) + Math.sin(ph2) * .7) * .05 * (1 + .3 * Math.sin(t * .7)); }
    else if (SND.amb === 'water') { a += (w - a) * .02; b += (a - b) * .02; v = b * .9 * (1 + .4 * Math.sin(t * .5)); }
    else if (SND.amb === 'rumble') { a += (w - a) * .004; v = a * 2.4 + (rnd() < .0004 ? (rnd() - .5) * .3 : 0); }
    else if (SND.amb === 'wind') { a += (w - a) * (.03 + .02 * Math.sin(t * .4)); b += (a - b) * .1; v = (a - b) * 1.2 * (.6 + .4 * Math.sin(t * .37)); }
    else if (SND.amb === 'night') { const c = (t * 3.1) % 1, chirp = c < .25 ? Math.sin(2 * Math.PI * 4600 * t) * Math.sin(Math.PI * (c * 16 % 1)) : 0; v = chirp * .025; }
    add(o, v * fade, Math.sin(t * .3) * .3, .2); }
  if (SND.amb === 'water') for (let t = 1; t < ctaV; t += .4 + rnd() * 1.2) { const st2 = Math.round(t * SR), n = Math.round(.08 * SR), f0 = 300 + rnd() * 500; let q = 0; for (let i = 0; i < n; i++) { q += 2 * Math.PI * f0 * (1 + i / n * 1.5) / SR; add(st2 + i, Math.sin(q) * Math.exp(-i / (.03 * SR)) * .08, (rnd() - .5), .3); } }   // пузыри
}
// --- события физики
let lastPeg = {};
for (const e of events) {
  const vt = simToVid(e.t); if (vt > VEND || vt < INTRO) continue; const slow = e.t >= s0 && e.t < s1, rf = slow ? .6 : 1, x = e.x ?? 3.2, pan = panOf(x), vis = e.y != null ? visG(vt, e.y) : 1;
  if (e.kind === 'peg') { if (vt - (lastPeg[e.b] || 0) < .03) continue; lastPeg[e.b] = vt; const g0 = Math.min(.5, .12 + e.v * .06) * vis; put(S_(pick('k_glass_light', 5, Math.round(e.t * 997))), vt, { gain: g0, pan, rate: (1.5 + e.b * .12 + rnd() * .2) * rf, send: .35 }); tone(vt, (2400 + e.b * 260) * rf, .09, g0 * .5, pan, .3, 40); }
  if (e.kind === 'land') { const g0 = Math.min(.55, .1 + e.v * .07) * vis; put(S_('m_WOODImpt_LargeWoodDrop_OS_01'), vt, { gain: g0 * .6, pan, rate: 2.1 * rf, send: .25 }); put(S_(pick('k_plate_medium', 5, Math.round(e.t * 101))), vt, { gain: g0 * .4, pan, rate: 1.7 * rf }); }
  if (e.kind === 'clack') { const g0 = Math.min(.6, .2 + e.v * .08); put(S_(pick('k_glass_light', 5, Math.round(e.t * 331))), vt, { gain: g0, pan, rate: 1.15 * rf, send: .35 }); tone(vt, 3300 * rf, .06, g0 * .5, pan, .3, 60); }
  if (e.kind === 'bump') { const st = Math.round(vt * SR), n = Math.round(.22 / rf * SR); let q = 0; for (let i = 0; i < n; i++) { const k = i / n; q += 2 * Math.PI * (720 - 470 * k) * rf / SR; add(st + i, Math.sin(q) * (1 - k) * .4 * vis, pan, .35); } put(S_(pick('k_metal_light', 5, Math.round(e.t * 77))), vt, { gain: .3 * vis, pan, rate: 1.4 * rf }); }
  if (e.kind === 'spinhit') put(S_(pick('k_plate_medium', 5, Math.round(e.t * 53))), vt, { gain: Math.min(.5, .15 + e.v * .06) * vis, pan, rate: 1.3 * rf, send: .3 });
  if (e.kind === 'lead') whoosh(vt, .25, .4);
  if (e.kind === 'finish') {
    if (e.rank === 1) { sub(vt, 45, 1, 1.1); put(S_('m_FGHTImpt_PunchHardest_OS_01'), vt, { gain: .7, rate: .8, send: .4 });
      { const st = Math.round(vt * SR), n = Math.round(1.8 * SR); let lp = 0; for (let i = 0; i < n; i++) { const w = rnd() * 2 - 1; lp += (w - lp) * .25; add(st + i, (w - lp) * Math.exp(-i / (.5 * SR)) * .35, (rnd() - .5) * .4, .5); } }   // тарелка
      for (let i = 0; i < 60; i++) { const t = vt + .1 + rnd() ** 1.5 * 1.8, st = Math.round(t * SR); for (let j = 0; j < 150; j++) add(st + j, (rnd() * 2 - 1) * Math.exp(-j / 28) * .25, (rnd() - .5) * 1.6, .4); }   // хлопушки
      [0, 4, 7, 12, 16].forEach((st, i) => piano(vt + .35 + i * .09, midi(st), .45, 0, 2.4)); }
    else tone(vt, [0, 1320, 1175, 990][e.rank] || 990, .5, .2, pan, .4, 4);
  }
}
// --- качение каждого шара: резонансный шорох по треку + гул
{ const bp = (f, q) => { const w = 2 * Math.PI * f / SR, al = Math.sin(w) / (2 * q), a0 = 1 + al; return { b0: al / a0, b2: -al / a0, a1: -2 * Math.cos(w) / a0, a2: (1 - al) / a0 }; };
  const spf = SR / FPS;
  for (let bi = 0; bi < 4; bi++) { const z = [0, 0], z2 = [0, 0]; let env = 0, lp = 0;
    for (const fr of audio) { const b = fr.balls?.[bi]; if (!b) continue; const st = Math.round(fr.vt * SR), rf = fr.slow ? .6 : 1, v = b.roll, target = v > .2 ? Math.min(1, .3 + v / 7) * b.vis : 0;
      const F1 = bp((520 + bi * 60 + v * 80) * rf, 3.5), F2 = bp((1900 + bi * 150 + v * 140) * rf, 2.5), pan = Math.max(-.7, Math.min(.7, b.x * .7));
      for (let i = 0; i < spf; i++) { const o = st + i; if (o >= N) break; env += (target - env) * (target > env ? .004 : .0015); if (env < 1e-4 && !target) continue;
        const w = rnd() * 2 - 1, y1 = F1.b0 * w + z[0]; z[0] = -F1.a1 * y1 + z[1]; z[1] = F1.b2 * w - F1.a2 * y1; const y2 = F2.b0 * w + z2[0]; z2[0] = -F2.a1 * y2 + z2[1]; z2[1] = F2.b2 * w - F2.a2 * y2;
        lp += (w - lp) * .006 * rf; let s = (y1 * .8 + y2 * .4 + lp * 2.6) * env; if (rnd() < v * 20 / SR) s += (rnd() - .5) * .4 * env; add(o, s * .38, pan, .12); } } } }
if (ctaV < VEND) { whoosh(ctaV + .15, .5, .5); const tap = ctaV + CTA_TAP * CTA_LEN; put(S_(pick('k_metal_light', 5, 1)), tap, { gain: .5, rate: 2.2 }); chime(tap + .05, .3); }

function reverb(inp) { const out = new Float32Array(N), combs = [1557, 1617, 1491, 1422, 1277, 1356].map(d => ({ d: Math.round(d * SR / 44100), b: new Float32Array(Math.round(d * SR / 44100)), i: 0, f: .8 })); const aps = [225, 556, 441].map(d => ({ b: new Float32Array(Math.round(d * SR / 44100)), i: 0 }));
  for (let n = 0; n < N; n++) { let s = 0; for (const c of combs) { const y = c.b[c.i]; c.b[c.i] = inp[n] + y * c.f; c.i = (c.i + 1) % c.d; s += y; } s /= combs.length; for (const a of aps) { const y = a.b[a.i], x = s + y * .5; a.b[a.i] = x; a.i = (a.i + 1) % a.b.length; s = y - x * .5; } out[n] = s; } return out; }
const rvL = reverb(sL), rvR = reverb(sR); for (let i = 0; i < N; i++) { L[i] += rvL[i] * .6; Rr[i] += rvR[i] * .6; }
let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i]));
const gn = 1.2 / Math.max(.3, pk), data = Buffer.alloc(N * 4); for (let i = 0; i < N; i++) { data.writeInt16LE(Math.round(Math.tanh(L[i] * gn) * .92 * 32767), i * 4); data.writeInt16LE(Math.round(Math.tanh(Rr[i] * gn) * .92 * 32767), i * 4 + 2); }
const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(WORK, 'audio.wav'), Buffer.concat([hdr, data]));
await new Promise((res, rej) => { const m = spawn('ffmpeg', ['-y', '-v', 'error', '-i', path.join(WORK, 'video.mp4'), '-i', path.join(WORK, 'audio.wav'), '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT]); m.on('close', c => c ? rej(new Error('mux ' + c)) : res()); });
console.log('RESULT ' + JSON.stringify({ out: OUT, dur: +VEND.toFixed(2), seed: CFG.seed, layout: CFG.layout, winner: fins[0].b, winnerName: PAL[fins[0].b].name, theme: CFG.theme || 'neon', margin: +(fins[1].t - Tw).toFixed(2), leads: events.filter(e => e.kind === 'lead').length }));
