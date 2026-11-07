// «Молот против машин» — рендер залипалки 9:16 + звук из событий физики (ASMR-сведение).
// node src/smash/render.mjs OUT.mp4 [seed] [seconds] ['{"env":"winter","trap":"ball","hook":"…"}']
// env: summer | autumn | winter | sunset | desert; trap: hammer | ball. scene: road (молот/шар на трассе, world.js) | bottles (боулинг по бутылкам, bottles.js).
// В конце печатает строку RESULT {json} — её читает бот.
import fs from 'fs'; import path from 'path'; import { spawn } from 'child_process'; import { fileURLToPath } from 'url';
const { chromium } = await import('../books/render.mjs');
const DIR = path.dirname(fileURLToPath(import.meta.url)), SFX = path.join(DIR, 'sfx'), V3 = path.join(DIR, '..', 'scale3d', 'vendor');
const FONT = path.join(DIR, '..', 'jung', 'engine', 'fonts', 'montserrat-cyrillic-900-normal.woff2');
const [OUT = '/tmp/smash.mp4', SEED = '7', SECS = '0', OPTS = '{}'] = process.argv.slice(2), FPS = 30, SR = 48000, CFG = { ...JSON.parse(OPTS), seed: +SEED };
const SCENES = { road: 'world.js', bottles: 'bottles.js', press: 'press.js', shredder: 'shredder.js' }, SCENE = SCENES[CFG.scene] ? CFG.scene : 'road';
const GL = ['--no-sandbox', '--allow-file-access-from-files', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'];
const WORK = OUT.replace(/\.mp4$/, '') + '_work'; fs.mkdirSync(WORK, { recursive: true });
const page_html = path.join(WORK, 'smash.html');
fs.writeFileSync(page_html, `<!doctype html><html><head><meta charset=utf-8><style>@font-face{font-family:Montserrat;font-weight:900;src:url("file://${FONT}")}html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}</style>
<script type="importmap">{"imports":{"three":"file://${path.join(V3, 'three.module.min.js')}","three/addons/":"file://${path.join(V3, 'addons')}/","cannon-es":"file://${path.join(DIR, 'vendor', 'cannon-es.js')}"}}</script></head><body><div style="font:900 10px Montserrat;position:absolute;opacity:0">ё</div>
<script type="module">import 'file://${path.join(DIR, SCENES[SCENE])}'; window.READY = true;</script></body></html>`);

const br = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: GL });
async function openPage() { const p = await br.newPage({ viewport: { width: 1080, height: 1920 } }); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('file://' + page_html); await p.waitForFunction(() => window.READY && window.SMASH, null, { timeout: 60000 }); await p.evaluate(() => document.fonts.ready);
  if (errs.length) console.log('page errors:', errs.slice(0, 3)); return p; }

// ---- проход 1: симуляция целиком, ищем лучшие удары для повторов
let p = await openPage();
const info = await p.evaluate(c => SMASH.init(c), CFG);
const simEnd = +SECS || info.simEnd;
await p.evaluate(t => SMASH.fastForward(t), simEnd);
const ev1 = await p.evaluate(() => SMASH.events);
const hits = ev1.filter(e => e.kind === 'hit');
const RW = await p.evaluate(() => SMASH.replayWin || null);   // у сцены свои повторы (бутылки — удар шара в каждом раунде)
console.log('объектов', info.cars, 'сим', simEnd.toFixed(1), 'c, ударов', hits.length);
let slows = []; if (RW) slows = await p.evaluate(() => SMASH.replays());
else for (const h of [...hits].sort((a, b) => b.power - a.power)) { if (h.t < 3.5 || h.t > simEnd - 3) continue; if (slows.some(s => Math.abs(s.t - h.t) < 9)) continue; slows.push(h); if (slows.length >= 3) break; }
slows.sort((a, b) => a.t - b.t);
const RATE = RW?.rate || .28, PRE = RW?.pre || .3, POST = RW?.post || .85;
const win = slows.map((h, i) => ({ s0: h.t - PRE, s1: h.t + POST, at: { x: h.x, z: h.z }, ang: [.7, 2.4, 4.0][i % 3], hit: h }));
// видео-время ↔ сим-время
const extra = w => (w.s1 - w.s0) * (1 / RATE - 1);
function simToVid(s) { let v = s; for (const w of win) { if (s >= w.s1) v += extra(w); else if (s > w.s0) v += (s - w.s0) * (1 / RATE - 1); } return v; }
function slowAt(s) { return win.find(w => s >= w.s0 && s < w.s1) || null; }
const vidEnd = simToVid(simEnd); console.log('повторы:', win.map(w => w.s0.toFixed(1)).join(', '), 'видео', vidEnd.toFixed(1), 'с');
await p.close();

// ---- проход 2: рендер кадров
p = await openPage(); await p.evaluate(c => SMASH.init(c), CFG);
const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-maxrate', '7M', '-bufsize', '14M', '-pix_fmt', 'yuv420p', path.join(WORK, 'video.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
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
// стеклянный «дзынь»: несколько затухающих высоких призвуков — для осколков
function tinkle(t, gain, pan, rf = 1) { const st = Math.round(t * SR); for (let k = 0; k < 3; k++) { const f = (2600 + rnd() * 5200) * rf, dec = .02 + rnd() * .05, n = Math.round(dec * 5 * SR), ph0 = rnd() * 6, g = gain * (1 - k * .25);
  for (let i = 0; i < n; i++) { const o = st + i; if (o < 0 || o >= N) continue; const s = Math.sin(ph0 + 2 * Math.PI * f * i / SR) * Math.exp(-i / (dec * SR)) * g; L[o] += s * Math.cos((pan + 1) * Math.PI / 4); Rr[o] += s * Math.sin((pan + 1) * Math.PI / 4); sendL[o] += s * .3; sendR[o] += s * .3; } } }
function chime(t, gain) { const st = Math.round(t * SR), n = Math.round(1.6 * SR); for (let i = 0; i < n; i++) { const o = st + i; if (o >= N) break; const e = Math.exp(-i / (.45 * SR)), s = (Math.sin(2 * Math.PI * 880 * i / SR) + .6 * Math.sin(2 * Math.PI * 1320 * i / SR) + .3 * Math.sin(2 * Math.PI * 1760 * i / SR)) * e * gain * Math.min(1, i / 120); L[o] += s; Rr[o] += s; sendL[o] += s * .5; sendR[o] += s * .5; } }
// шипение гидравлики / воздуха: шум в верхней полосе с огибающей
function hiss(t, dur, gain, att = .05) { const st = Math.round(t * SR), n = Math.round(dur * SR); let a = 0; for (let i = 0; i < n; i++) { const o = st + i; if (o < 0 || o >= N) continue; const w = rnd() * 2 - 1, hp = w - a; a = a * .6 + w * .4; const e = Math.min(1, i / (att * SR)) * Math.exp(-i / (dur * .45 * SR)), x = hp * gain * e; L[o] += x * (.85 + rnd() * .3); Rr[o] += x * (.85 + rnd() * .3); sendL[o] += x * .3; sendR[o] += x * .3; } }
function glassBurst(vt, g = 1, rf = 1) { put(S_('m_GLASBrk_WindowPaneSmallBreak_OS_01'), vt, { gain: .8 * g, rate: .95 * rf, send: .5 }); put(S_(pick('k_glass_heavy', 5, Math.round(vt * 100))), vt + .01, { gain: .7 * g, rate: rf, send: .4 }); put(S_('m_GLASBrk_GlassBottleBreak_OS_01'), vt + .03, { gain: .45 * g, rate: 1.15 * rf, send: .5 }); for (let i = 0; i < 8; i++) tinkle(vt + .05 + rnd() * 1.2, .05 * g, (rnd() - .5) * 1.2, rf); }
function tirePop(vt, g = 1) { put(S_(pick('k_punch_heavy', 5, Math.round(vt * 10))), vt, { gain: .9 * g, rate: .6, send: .4 }); put(S_('m_FGHTImpt_PunchHardest_OS_01'), vt, { gain: .8 * g, rate: .55, send: .4 }); sub(vt, 48, .6, .8 * g); hiss(vt + .02, .7, .22 * g, .005); }
function metalGroan(vt, g, rate) { put(S_(`m_WOODFric_CreaksCreepy_OS_0${1 + (Math.round(vt * 7) % 2)}`), vt, { gain: g, rate, send: .45 }); }
// 🗜 пресс: гидравлика, дрожь, трещины стекла ДО касания, скрип и хруст металла, хлопки шин, тишина перед кульминацией, рвущийся шланг, колпак
function mixPress() {
  for (const e of events) { const vt = simToVid(e.t), k = Math.round(e.t * 100), sz = Math.min(1.5, e.s || 1), rf = slowAt(e.t) ? .6 : 1, g = slowAt(e.t) ? 1.15 : 1;
    if (e.kind === 'tremble') { hiss(vt, 1.2, .07, .2); for (let i = 0; i < 9; i++) put(S_(pick('k_metal_light', 5, k + i)), vt + i * .13 + rnd() * .03, { gain: .12, rate: 1.4 + rnd() * .3, send: .3 }); }
    if (e.kind === 'ramDown') { hiss(vt, .55, .28); airWhoosh(vt + .3, .5, .7); }
    if (e.kind === 'contact') { put(S_(pick('k_metal_heavy', 5, k)), vt, { gain: .9 * g, rate: .45 * rf, send: .5 }); put(S_('m_METLImpt_HammerAnvil_OS_01'), vt, { gain: .5 * g, rate: .5 * rf, send: .5 }); sub(vt, 45 * rf, .8, .7 * sz); }
    if (e.kind === 'creak') { metalGroan(vt, (.35 + .35 * e.c) * g, (.38 + rnd() * .15) * rf); put(S_(pick('k_plate_medium', 5, k)), vt + rnd() * .1, { gain: .3 + .3 * e.c, rate: (.45 + rnd() * .1) * rf, send: .4 }); if (rnd() < .5) put(S_(`m_METLImpt_MetalHitSurface_OS_0${1 + (k % 5)}`), vt + .05, { gain: .3, rate: .5 * rf, send: .4 }); }
    if (e.kind === 'crack') { const n = e.n; put(S_(pick('k_glass_light', 5, k)), vt, { gain: .35 + .2 * n, rate: .75, send: .5 }); put(S_('m_GLASImpt_GlassBottleDrop_OS_01'), vt + .01, { gain: .25 * n, rate: 1.7, send: .5 }); for (let i = 0; i < 4 * n; i++) tinkle(vt + rnd() * .35, .05, (rnd() - .5) * .6, .9); }
    if (e.kind === 'pane') { glassBurst(vt, .5, 1.1 - e.k * .04); sub(vt, 70, .2, .25); }
    if (e.kind === 'crunch') { put(S_(pick('k_metal_heavy', 5, k + 2)), vt, { gain: .9 * g, rate: .42 * rf, send: .5 }); put(S_(pick('k_plate_heavy', 5, k)), vt + .01, { gain: .8 * g, rate: .5 * rf, send: .5 }); put(S_('m_WOODFric_LargeWoodMetalDrag_OS_01'), vt, { gain: .4, rate: .6 * rf, send: .4 }); sub(vt, 42 * rf, .5, .5); }
    if (e.kind === 'glass') glassBurst(vt, 1 * g, .9 * rf);
    if (e.kind === 'pop') { put(S_(pick('k_punch_heavy', 5, k)), vt, { gain: .9 * g, rate: .6 * rf, send: .4 }); put(S_('m_FGHTImpt_PunchHardest_OS_01'), vt, { gain: .8 * g, rate: .55 * rf, send: .4 }); sub(vt, 48 * rf, .6, .8); hiss(vt + .02, .7 / rf, .22, .005); }
    if (e.kind === 'bottom') { put(S_('m_METLImpt_HammerAnvil_OS_01'), vt, { gain: .9 * g, rate: .4 * rf, send: .6 }); put(S_(pick('k_metal_heavy', 5, k + 4)), vt, { gain: .8 * g, rate: .38 * rf, send: .6 }); sub(vt, 38 * rf, 1, .95); }
    if (e.kind === 'hose') { hiss(vt, 3.2, .55, .002); put(S_('m_FGHTImpt_PunchHardest_OS_01'), vt, { gain: 1, rate: .45, send: .6 }); put(S_(pick('k_metal_heavy', 5, k)), vt, { gain: .9, rate: .5, send: .6 }); sub(vt, 40, 1.2, 1); airWhoosh(vt + .1, .6, .55); }
    if (e.kind === 'ramUp') { hiss(vt, 1.3, .3, .02); }
    if (e.kind === 'drag') put(S_('m_WOODFric_LargeWoodMetalDrag_OS_01'), vt, { gain: .55, rate: .8, send: .4 });
    if (e.kind === 'round') put(S_('m_METLImpt_BucketDrop_OS_01'), vt + .05, { gain: .2, rate: .7 });
    if (e.kind === 'capRoll') { let t = vt; for (let i = 0; i < 12; i++) { put(S_(pick('k_metal_light', 5, k + i)), t, { gain: .18, rate: 1.3 + rnd() * .2, send: .25 }); t += .13; } let d = .1; for (let i = 0; i < 16; i++) { put(S_(pick('k_metal_light', 5, k + 20 + i)), t, { gain: .14 + i * .012, rate: 1.6 + i * .03, send: .25 }); t += d; d *= .82; } }
    if (e.kind === 'capFlat') put(S_(pick('k_metal_light', 5, k)), vt, { gain: .45, rate: 1.1, send: .35 });
    if (e.kind === 'tink') put(S_(e.mat === 'shard' ? pick('k_glass_light', 5, k) : pick('k_metal_light', 5, k)), vt, { gain: .18, pan: Math.max(-.8, Math.min(.8, e.x / 6)), rate: (.9 + rnd() * .3) * rf });
    if (e.kind === 'outro') { sub(vt, 40, 1, .5); }
  }
  // гидростанция: гудит, когда плита едет; под нагрузкой гигант — низкий нарастающий гул; тишина перед кульминацией глушит всё
  const ENGH = S_('m_VEHCar_CarEngineHigh_LOOP_01'); let ph = 0, a = 0, eph = 0, mute = 1;
  for (const fr of audio) { const st = Math.round(fr.vt * SR), mv = Math.min(1, Math.abs(fr.ramV) / 12), cr = fr.crushing ? 1 : 0, sn = fr.strain || 0;
    for (let i = 0; i < SR / FPS; i++) { const o = st + i; if (o >= N) break; mute += ((fr.silence ? .03 : 1) - mute) * .002; ph += 2 * Math.PI * (58 + 30 * mv - 18 * sn) / SR; const w = rnd() * 2 - 1; a += (w - a) * .03;
      let x = (Math.sin(ph) * .25 + Math.sin(ph * 2) * .12 + Math.sin(ph * 3) * .06) * (.15 + .5 * mv + .35 * cr + .9 * sn) + a * 2.4 * (cr * .5 + sn * .9);
      if (fr.drive > .02) { eph += .8 + fr.drive * .4; x += ENGH[(eph | 0) % ENGH.length] * .35 * Math.min(1, fr.drive); }
      x *= mute; L[o] += x; Rr[o] += x; sendL[o] += x * .2; sendR[o] += x * .2; } }
  const AMB = S_('m_AMBInd_RoomToneMachineRoom_LOOP_01'); let m2 = 1; const fr0 = audio;
  for (let i = 0; i < N; i++) { const f = fr0[Math.min(fr0.length - 1, Math.floor(i / (SR / FPS)))]; m2 += ((f && f.silence ? .15 : 1) - m2) * .0005; L[i] += AMB[i % AMB.length] * .45 * m2; Rr[i] += AMB[(i + 30000) % AMB.length] * .45 * m2; }
}
// ⚙️ шредер: мотор и лязг зубьев, скрип троса, гудение и мигание магнита, хруст зеркала, стон заклинившего мотора,
// тишина, щелчок реверса, рёв полной мощности, взрыв стекла, последняя фара — и тишина
function buzz(t, dur, gain) { const st = Math.round(t * SR), n = Math.round(dur * SR); for (let i = 0; i < n; i++) { const o = st + i; if (o < 0 || o >= N) continue; const ph = (i / SR) * 100, sq = (ph % 1 < .5 ? 1 : -1) * .5 + Math.sin(2 * Math.PI * 300 * i / SR) * .3, cr = rnd() < .002 ? (rnd() - .5) * 4 : 0, x = (sq + cr) * gain * Math.min(1, i / 300) * Math.min(1, (n - i) / 300); L[o] += x; Rr[o] += x; } }
function mixShred() {
  for (const e of events) { const vt = simToVid(e.t), k = Math.round(e.t * 100), rf = slowAt(e.t) ? .6 : 1, g = slowAt(e.t) ? 1.15 : 1;
    if (e.kind === 'sway') for (let i = 0; i < 5; i++) put(S_(`m_WOODFric_CreaksCreepy_OS_0${1 + (i % 2)}`), vt + i * 1.3, { gain: .12, rate: 1.1 + i * .05, send: .4 });
    if (e.kind === 'flicker') { buzz(vt, .3, .16); put(S_(pick('k_metal_light', 5, k)), vt, { gain: .2, rate: 2 }); }
    if (e.kind === 'slip') { put(S_(pick('k_metal_heavy', 5, k)), vt, { gain: .7, rate: 1.0, send: .5 }); metalGroan(vt + .05, .4, .9); sub(vt, 60, .3, .4); }
    if (e.kind === 'mirrorOff') put(S_(pick('k_plate_medium', 5, k)), vt, { gain: .3, rate: 1.4, send: .3 });
    if (e.kind === 'mirror') { put(S_(pick('k_plate_heavy', 5, k)), vt, { gain: .7, rate: 1.1, send: .4 }); put(S_('m_GLASBrk_GlassBottleBreak_OS_01'), vt + .02, { gain: .4, rate: 1.5 }); for (let i = 0; i < 5; i++) put(S_(pick('k_metal_light', 5, k + i)), vt + .05 + i * .06, { gain: .25, rate: 1.2 + rnd() * .3 }); }
    if (e.kind === 'lower') hiss(vt, 1.4, .06, .3);
    if (e.kind === 'touch') { put(S_(pick('k_metal_heavy', 5, k)), vt, { gain: .8, rate: .55, send: .5 }); sub(vt, 50, .5, .6); }
    if (e.kind === 'chew') { put(S_(pick(e.big ? 'k_metal_heavy' : 'k_plate_heavy', 5, k)), vt, { gain: (e.big ? .85 : .55) * g, rate: (.5 + rnd() * .2) * rf, pan: (rnd() - .5) * .6, send: .4 }); put(S_(pick('k_metal_light', 5, k + 1)), vt + rnd() * .05, { gain: .35, rate: (.7 + rnd() * .3) * rf, pan: (rnd() - .5) * .8, send: .3 }); if (e.big) { metalGroan(vt, .45, .5 * rf); sub(vt, 50 * rf, .35, .45); } }
    if (e.kind === 'pop') tirePop(vt, .9);
    if (e.kind === 'jam') { metalGroan(vt, .8, .35); put(S_(pick('k_metal_heavy', 5, k)), vt + .3, { gain: .9, rate: .4, send: .6 }); }
    if (e.kind === 'stall') { put(S_('m_METLImpt_HammerAnvil_OS_01'), vt, { gain: .6, rate: .45, send: .6 }); sub(vt, 35, .8, .6); hiss(vt + .1, 1.6, .1, .05); }
    if (e.kind === 'settle') { metalGroan(vt, .18, .3 + rnd() * .1); put(S_(pick('k_metal_light', 5, k)), vt + .3, { gain: .12, rate: .8 }); }
    if (e.kind === 'reverse') { put(S_(pick('k_metal_heavy', 5, k)), vt, { gain: .6, rate: 1.3 }); buzz(vt, .12, .12); }
    if (e.kind === 'spit') { put(S_(pick('k_plate_medium', 5, k)), vt + .2, { gain: .35, rate: .8 + rnd() * .3, pan: (rnd() - .5) * .8 }); put(S_(pick('k_metal_light', 5, k + 2)), vt + .5 + rnd() * .3, { gain: .25, rate: 1 + rnd() * .3 }); }
    if (e.kind === 'power') { put(S_(pick('k_metal_heavy', 5, k)), vt, { gain: .7, rate: 1.2 }); buzz(vt, .15, .15); sub(vt + .05, 70, .5, .4); }
    if (e.kind === 'jerk') { put(S_(pick('k_metal_heavy', 5, k)), vt, { gain: 1, rate: .45, send: .6 }); put(S_('m_FGHTImpt_PunchHardest_OS_01'), vt, { gain: .8, rate: .5 }); sub(vt, 42, .8, .9); }
    if (e.kind === 'glass') glassBurst(vt, 1.3 * g, rf);
    if (e.kind === 'roof') { put(S_('m_WOODFric_LargeWoodMetalDrag_OS_01'), vt, { gain: .6, rate: .55 * rf, send: .5 }); metalGroan(vt, .6, .45); }
    if (e.kind === 'lastLight') buzz(vt + .9, .9, .06);
    if (e.kind === 'lightOff') { put(S_('m_GLASImpt_GlassBottleDrop_OS_01'), vt, { gain: .5, rate: 1.4 }); put(S_(pick('k_plate_medium', 5, k)), vt, { gain: .4, rate: .9 }); }
    if (e.kind === 'tink') put(S_(pick('k_metal_light', 5, k)), vt, { gain: .15, pan: Math.max(-.8, Math.min(.8, e.x / 4)), rate: (.9 + rnd() * .4) * rf });
  }
  // мотор: гул по оборотам (реверс — тот же гул), зубья лязгают, скрежет пока жуёт; заклинивание — гул проседает до тишины
  let ph = 0, a = 0, b = 0, tp = 0, mute = 1;
  for (const fr of audio) { const st = Math.round(fr.vt * SR), rpm = Math.abs(fr.rpm), eat = fr.eat, sl = fr.slow ? .6 : 1;
    for (let i = 0; i < SR / FPS; i++) { const o = st + i; if (o >= N) break; mute += ((fr.silence ? .02 : 1) - mute) * .003; ph += 2 * Math.PI * 46 * Math.max(.05, rpm) * sl / SR; tp += 18 * rpm * sl / SR; const w = rnd() * 2 - 1; a += (w - a) * .08; b += (a - b) * .1;
      const teeth = Math.pow(Math.max(0, Math.sin(tp * 2 * Math.PI)), 18) * (w * .6) * (.15 + .9 * eat) * Math.min(1, rpm);
      const x = ((Math.sin(ph) * .3 + Math.sin(ph * 2) * .15 + Math.sin(ph * 3.01) * .08) * .45 * Math.min(1.3, rpm) + (a - b) * 3.2 * eat + teeth) * mute;
      L[o] += x; Rr[o] += x; sendL[o] += x * .25; sendR[o] += x * .25; } }
  const AMB = S_('m_AMBInd_RoomToneMachineRoom_LOOP_01'); for (let i = 0; i < N; i++) { L[i] += AMB[i % AMB.length] * .35; Rr[i] += AMB[(i + 30000) % AMB.length] * .35; }
}
// ASMR боулинга по бутылкам: перекат шара, бой стекла слоями, звон, осколки по дорожке, гул зала
function mixBottles() {
  const camXb = 0, pn = x => Math.max(-.8, Math.min(.8, (x - camXb) * 1.1));
  const breaks = events.filter(e => e.kind === 'break');
  for (const e of events) {
    const vt = simToVid(e.t), sl = slowAt(e.t), rf = sl ? .55 : 1, g = sl ? 1.1 : 1, k = Math.round(e.t * 1000);
    if (e.kind === 'break') {   // одновременных разбитий много — каждому тише, чтобы не было каши
      const crowd = breaks.filter(b => Math.abs(b.t - e.t) < .05).length, cg = g / Math.sqrt(crowd), pw = Math.min(1.3, .55 + e.power), pan = pn(e.x), r0 = (.85 + rnd() * .4) * rf;
      put(S_('m_GLASBrk_GlassBottleBreak_OS_01'), vt, { gain: .9 * pw * cg, pan, rate: r0, send: .45 });
      put(S_(pick('k_glass_heavy', 5, k)), vt + .004, { gain: .7 * pw * cg, pan, rate: (.9 + rnd() * .35) * rf, send: .4 });
      if (e.power > .6 || rnd() < .3) put(S_('m_GLASBrk_WindowPaneSmallBreak_OS_01'), vt + .01, { gain: .35 * cg, pan, rate: (1.15 + rnd() * .3) * rf, send: .5 });
      if (e.by === 'ball') { put(S_('m_GLASImpt_GlassBottleDrop_OS_01'), vt, { gain: .5 * cg, pan, rate: .8 * rf }); sub(vt, 70 * rf, .25 / rf, .35 * pw * cg); }
      for (let i = 0; i < 6; i++) tinkle(vt + (.05 + rnd() * .9) / rf, .05 * cg, Math.max(-1, Math.min(1, pan + (rnd() - .5) * .6)), rf);
      for (let i = 0; i < 3; i++) put(S_(pick('k_glass_light', 5, k + i)), vt + (.1 + rnd() * 1.1) / rf, { gain: .22 * cg, pan: pan + (rnd() - .5) * .5, rate: (1 + rnd() * .5) * rf, send: .35 });
    }
    if (e.kind === 'clink') put(S_(rnd() < .5 ? pick('k_glass_light', 5, k) : 'm_CERMImpt_CeramicSmallImpact_OS_01'), vt, { gain: Math.min(.5, .15 + e.v * .12) * g, pan: pn(e.x), rate: (1.2 + rnd() * .5) * rf, send: .4 });
    if (e.kind === 'thunk') put(S_('m_GLASImpt_GlassBottleDrop_OS_01'), vt, { gain: Math.min(.6, .2 + e.v * .15) * g, pan: pn(e.x), rate: (.95 + rnd() * .2) * rf, send: .35 });
    if (e.kind === 'tink') { if (e.big) put(S_(pick('k_glass_light', 5, k)), vt, { gain: Math.min(.35, .1 + e.v * .08) * g, pan: pn(e.x), rate: (.9 + rnd() * .3) * rf, send: .3 }); else tinkle(vt, Math.min(.06, .015 + e.v * .01) * g, pn(e.x), rf); }
    if (e.kind === 'launch') { put(S_('m_WOODImpt_LargeWoodDrop_OS_01'), vt, { gain: .55, pan: 0, rate: .7, send: .5 }); sub(vt, 48, .4, .4); }
    if (e.kind === 'impact') { sub(vt, 55 * rf, .5 / rf, .7); airWhoosh(vt - .02, .35, rf); }
    if (e.kind === 'strike') chime(vt + .05, .22);
    if (e.kind === 'round' && e.round > 0) airWhoosh(vt + .1, .5, 1);
    if (e.kind === 'outro') { sub(vt, 45, .9, .5); chime(vt + .1, .18); }
  }
  for (const w of win) sub(simToVid(w.s0), 90, .9, .3);   // «вдох» перед повтором
  // перекат шара: низкий гул и шорох по дереву, громче с близостью и скоростью
  let a1 = 0, a2 = 0, ph = 0;
  for (const fr of audio) { const b = fr.ball; if (!b || !b.ground || b.v < .3) continue; const st = Math.round(fr.vt * SR), rate = fr.slow ? .55 : 1, gn = Math.min(.55, b.v / 9 * (2.2 / Math.max(1.2, b.dist))) * (fr.slow ? .8 : 1), f0 = (34 + b.v * 2.5) * rate;
    for (let i = 0; i < SR / FPS; i++) { const o = st + i; if (o >= N) break; const w = rnd() * 2 - 1; a1 += (w - a1) * .02 * rate; a2 += (a1 - a2) * .05; ph += 2 * Math.PI * f0 / SR; const s = (a2 * 7 + Math.sin(ph) * .35 + Math.sin(ph * 2.03) * .12) * gn; L[o] += s; Rr[o] += s; sendL[o] += s * .15; sendR[o] += s * .15; } }
  // осколки скользят по лаку дорожки — тихое «шшш»
  let h1 = 0; for (const fr of audio) { if (fr.slide < .5) continue; const st = Math.round(fr.vt * SR), gn = Math.min(.18, fr.slide / 260) * (fr.slow ? .7 : 1);
    for (let i = 0; i < SR / FPS; i++) { const o = st + i; if (o >= N) break; const w = rnd() * 2 - 1, hp = w - h1; h1 = w * .3 + h1 * .7; const s = hp * gn; L[o] += s * (.8 + rnd() * .4); Rr[o] += s * (.8 + rnd() * .4); } }
  // гул зала
  const AMB = S_('m_AMBHome_RoomTone_LOOP_01'); for (let i = 0; i < N; i++) { L[i] += AMB[i % AMB.length] * .5; Rr[i] += AMB[(i + 30000) % AMB.length] * .5; }
}
function sub(t, f0, dur, gain) { const st = Math.round(t * SR), n = Math.round(dur * SR); let ph = 0; for (let i = 0; i < n; i++) { const o = st + i; if (o < 0 || o >= N) continue; const k = i / n, f = f0 * (1 - .45 * k); ph += 2 * Math.PI * f / SR; const s = Math.sin(ph) * Math.exp(-k * 5) * Math.min(1, i / 200) * gain; L[o] += s; Rr[o] += s; } }
function airWhoosh(t, gain, rate) { const st = Math.round((t - .45 / rate) * SR), n = Math.round(.9 / rate * SR); let a = 0, b = 0; for (let i = 0; i < n; i++) { const o = st + i; if (o < 0 || o >= N) continue; const k = i / n, env = Math.exp(-((k - .5) ** 2) / .02); const w = rnd() * 2 - 1; a += (w - a) * .02; b += (a - b) * .05; const s = b * 9 * env * gain; L[o] += s; Rr[o] += s; } }
if (SCENE === 'bottles') mixBottles(); else if (SCENE === 'press') mixPress(); else if (SCENE === 'shredder') mixShred(); else {
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
}
// финал «Подпишись»: вжух на появлении, щелчок кнопки и колокольчик
for (const e of events) { const vt = simToVid(e.t);
  if (e.kind === 'cta') { airWhoosh(vt + .25, .45, 1.2); sub(vt + .35, 60, .5, .35); }
  if (e.kind === 'ctaTap') { const st = Math.round(vt * SR); for (let i = 0; i < 260; i++) { const o = st + i; if (o >= N) break; const c = (rnd() * 2 - 1) * Math.exp(-i / 40) * .9; L[o] += c; Rr[o] += c; }
    put(S_('k_metal_light_0'), vt, { gain: .35, rate: 1.8, send: .2 }); chime(vt + .12, .2); chime(vt + .32, .12); } }
// реверберация (Шрёдер) для объёма ударов
function reverb(inp) { const out = new Float32Array(N), combs = [1557, 1617, 1491, 1422].map(d => ({ d: Math.round(d * SR / 44100), b: new Float32Array(Math.round(d * SR / 44100)), i: 0, f: .8 })); const aps = [225, 556].map(d => ({ b: new Float32Array(Math.round(d * SR / 44100)), i: 0 }));
  for (let n = 0; n < N; n++) { let s = 0; for (const c of combs) { const y = c.b[c.i]; c.b[c.i] = inp[n] + y * c.f; c.i = (c.i + 1) % c.d; s += y; } s *= .25; for (const a of aps) { const y = a.b[a.i], x = s + y * .5; a.b[a.i] = x; a.i = (a.i + 1) % a.b.length; s = y - x * .5; } out[n] = s; } return out; }
const rvL = reverb(sendL), rvR = reverb(sendR), wet = SCENE === 'road' ? .5 : .7; for (let i = 0; i < N; i++) { L[i] += rvL[i] * wet; Rr[i] += rvR[i] * wet; }
let pk = 0; for (let i = 0; i < N; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(Rr[i]));
const gn = 1.25 / Math.max(.3, pk), data = Buffer.alloc(N * 4); for (let i = 0; i < N; i++) { data.writeInt16LE(Math.round(Math.tanh(L[i] * gn) * .92 * 32767), i * 4); data.writeInt16LE(Math.round(Math.tanh(Rr[i] * gn) * .92 * 32767), i * 4 + 2); }
const hdr = Buffer.alloc(44); hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVEfmt ', 8); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
fs.writeFileSync(path.join(WORK, 'audio.wav'), Buffer.concat([hdr, data]));
await new Promise((res, rej) => { const m = spawn('ffmpeg', ['-y', '-v', 'error', '-i', path.join(WORK, 'video.mp4'), '-i', path.join(WORK, 'audio.wav'), '-c:v', 'copy', '-af', 'loudnorm=I=-14:TP=-1.2:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', OUT]); m.on('close', c => c ? rej(new Error('mux ' + c)) : res()); });
console.log('RESULT ' + JSON.stringify({ out: OUT, dur: +vidEnd.toFixed(2), hits: SCENE === 'press' ? events.filter(e => e.kind === 'bottom').length : SCENE === 'shredder' ? events.filter(e => e.kind === 'gone').length : events.filter(e => e.kind === (SCENE === 'bottles' ? 'break' : 'hit')).length, strikes: events.filter(e => e.kind === 'strike').length, cars: info.cars, buses: events.filter(e => e.kind === 'hit' && e.bus).length, replays: win.length }));
console.log('готово:', OUT, 'видео', vidEnd.toFixed(1), 'с, ударов', events.filter(e => e.kind === 'hit').length);
