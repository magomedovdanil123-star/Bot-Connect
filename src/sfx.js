// Звуковой дизайн: собственный синтез SFX (без внешних файлов и лицензий) + сведение в стерео-дорожку.
// Каждый вид звука имеет вариации (v = 0..5): длительность, высота, фильтр, характер.
import fs from 'fs';

export const SR = 48000;

export function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1; }; }

// Биквадратный фильтр (RBJ) с изменяемой частотой
export function biquad(type) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0, b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
  return {
    set(f, q) {
      const w = 2 * Math.PI * Math.min(f, SR * .45) / SR, c = Math.cos(w), al = Math.sin(w) / (2 * q); let n0, n1, n2;
      if (type === 'lp') { n0 = (1 - c) / 2; n1 = 1 - c; n2 = (1 - c) / 2; }
      else if (type === 'hp') { n0 = (1 + c) / 2; n1 = -(1 + c); n2 = (1 + c) / 2; }
      else { n0 = al; n1 = 0; n2 = -al; }
      const a0 = 1 + al; b0 = n0 / a0; b1 = n1 / a0; b2 = n2 / a0; a1 = -2 * c / a0; a2 = (1 - al) / a0;
    },
    run(x) { const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; },
  };
}
// Простой реверб (Шрёдер): 4 гребенчатых + 2 всепропускающих фильтра
export function reverb(buf, wet = .3, size = 1) {
  const combs = [1557, 1617, 1491, 1422].map(d => ({ d: Math.round(d * size * SR / 44100), b: null, i: 0, fb: .8 }));
  combs.forEach(c => { c.b = new Float32Array(c.d); });
  const aps = [225, 556].map(d => ({ d: Math.round(d * SR / 44100), b: null, i: 0 })); aps.forEach(a => { a.b = new Float32Array(a.d); });
  const out = new Float32Array(buf.length + Math.round(SR * .9 * size));
  for (let n = 0; n < out.length; n++) {
    const x = n < buf.length ? buf[n] : 0; let s = 0;
    for (const c of combs) { const y = c.b[c.i]; c.b[c.i] = x + y * c.fb; c.i = (c.i + 1) % c.d; s += y; }
    s *= .25;
    for (const a of aps) { const y = a.b[a.i]; const v = -s + y; a.b[a.i] = s + y * .5; a.i = (a.i + 1) % a.d; s = v; }
    out[n] = x + s * wet;
  }
  return out;
}
const len = s => Math.round(s * SR);
function normalize(b, peak = .9) { let m = 0; for (const v of b) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < b.length; i++) b[i] *= peak / m; return b; }
function fadeEdges(b, inS = .003, outS = .02) { const a = len(inS), z = len(outS); for (let i = 0; i < a && i < b.length; i++) b[i] *= i / a; for (let i = 0; i < z && i < b.length; i++) b[b.length - 1 - i] *= i / z; return b; }

// ---------- синтезаторы ----------
const SYNTH = {
  // Пролёт: шум через полосовой фильтр с плавающей частотой, пик ближе к концу
  whoosh(v) {
    const r = prng(101 + v), d = .42 + (v % 3) * .14, n = len(d), b = new Float32Array(n), f = biquad('bp'), lo = biquad('lp');
    const f0 = 280 * (1 + (v % 2)), f1 = 2600 + v * 500, peak = .58 + (v % 3) * .08;
    for (let i = 0; i < n; i++) {
      const u = i / n; if (i % 16 === 0) { f.set(f0 * Math.pow(f1 / f0, Math.sin(u * Math.PI * .5)), .9 + (v % 2) * .6); lo.set(400, .7); }
      const env = u < peak ? Math.pow(u / peak, 2.2) : Math.pow(1 - (u - peak) / (1 - peak), 1.6);
      const nz = r(); b[i] = (f.run(nz) * .9 + lo.run(nz) * .25) * env;
    }
    return fadeEdges(normalize(b));
  },
  // Разрыв бумаги: шум с треском (короткие всплески) через полосовой фильтр
  tear(v) {
    const r = prng(1101 + v), d = .38 + (v % 3) * .06, n = len(d), b = new Float32Array(n), f = biquad('bp');
    for (let i = 0; i < n; i++) { const u = i / n; if (i % 16 === 0) f.set(1800 + 2500 * u, 1.2); const crack = r() > .93 ? 2.2 : 1; b[i] = f.run(r()) * crack * Math.sin(Math.PI * Math.pow(u, .5)); }
    return fadeEdges(normalize(b, .8));
  },
  // Перелистывание страницы: мягкий «флип» — шум с быстрым спадом и лёгким свистом
  flip(v) {
    const r = prng(1202 + v), d = .22, n = len(d), b = new Float32Array(n), f = biquad('hp');
    for (let i = 0; i < n; i++) { const u = i / n; if (i % 16 === 0) f.set(900 + 3000 * u, .8); b[i] = f.run(r()) * Math.pow(1 - u, 1.5) * Math.min(1, u * 30); }
    return fadeEdges(normalize(b, .7));
  },
  // Короткий свист: высокочастотный шум, быстрый
  swoosh(v) {
    const r = prng(202 + v), d = .24 + (v % 3) * .05, n = len(d), b = new Float32Array(n), f = biquad('hp');
    for (let i = 0; i < n; i++) { const u = i / n; if (i % 16 === 0) f.set(1500 + 6000 * u * (1 + v * .1), .7); const env = Math.sin(Math.PI * Math.pow(u, .7)); b[i] = f.run(r()) * env; }
    return fadeEdges(normalize(b, .85));
  },
  // Свип смены сцены: синус с глиссандо + немного шума
  sweep(v) {
    const r = prng(303 + v), d = .55 + (v % 3) * .1, n = len(d), b = new Float32Array(n), up = v % 2 === 0, f = biquad('bp'); let ph = 0;
    for (let i = 0; i < n; i++) { const u = i / n, fr = up ? 220 * Math.pow(6, u) : 1300 * Math.pow(1 / 6, u); ph += 2 * Math.PI * fr / SR; if (i % 16 === 0) f.set(fr * 2, 2); const env = Math.sin(Math.PI * u); b[i] = (Math.sin(ph) * .5 + f.run(r()) * .6) * env; }
    return fadeEdges(normalize(reverb(b, .25), .8));
  },
  // Удар: суб с падением высоты + щелчок + тело
  impact(v) {
    const r = prng(404 + v), d = .75, n = len(d), b = new Float32Array(n), lp = biquad('lp'); lp.set(2600 - v * 200, .7); let ph = 0;
    const fa = 58 + v * 4, fb = 32;
    for (let i = 0; i < n; i++) { const t = i / SR; const fr = fb + (fa - fb) * Math.exp(-t * 9); ph += 2 * Math.PI * fr / SR; const sub = Math.sin(ph) * Math.exp(-t * (4.5 + v * .3)); const click = lp.run(r()) * Math.exp(-t * 70); const body = r() * Math.exp(-t * 18) * .25; b[i] = Math.tanh((sub * 1.1 + click * .8 + body) * 1.6); }
    return fadeEdges(normalize(b, .95), .001);
  },
  // Кинематографичный удар: удар + металлические обертоны + реверб
  hit(v) {
    const base = SYNTH.impact(v), n = len(1.6), b = new Float32Array(n), parts = [180, 271, 413, 622, 911].map(p => p * (1 + v * .03));
    for (let i = 0; i < n; i++) { const t = i / SR; let s = i < base.length ? base[i] : 0; parts.forEach((p, k) => { s += Math.sin(2 * Math.PI * p * t + k) * Math.exp(-t * (2.2 + k * .8)) * .12; }); b[i] = s; }
    return fadeEdges(normalize(reverb(b, .35, 1.2), .95), .001, .2);
  },
  // Бас-дроп
  sub(v) { const n = len(.8), b = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (40 + 85 * Math.exp(-t * (5 + v))) / SR; b[i] = Math.sin(ph) * Math.min(1, t * 60) * Math.exp(-t * 3.2); } return fadeEdges(normalize(b, .9)); },
  // Интерфейсный щелчок
  click(v) { const r = prng(505 + v), n = len(.05), b = new Float32Array(n), f = biquad('hp'); f.set(2000 + v * 400, .8); const tone = 2600 + v * 380; for (let i = 0; i < n; i++) { const t = i / SR; b[i] = f.run(r()) * Math.exp(-t * 900) + Math.sin(2 * Math.PI * tone * t) * Math.exp(-t * 300) * .6; } return fadeEdges(normalize(b, .7), .0005, .005); },
  // Тик счётчика
  tick(v) { const n = len(.03), b = new Float32Array(n), fr = 1800 + (v % 3) * 350; for (let i = 0; i < n; i++) { const t = i / SR; b[i] = Math.sin(2 * Math.PI * fr * t) * Math.exp(-t * 400); } return fadeEdges(normalize(b, .6), .0005, .004); },
  // Цифровой блип
  blip(v) { const n = len(.12), b = new Float32Array(n), f0 = [880, 988, 1175, 1319, 1480, 1760][v % 6]; let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * f0 * (1 + .5 * Math.exp(-t * 60)) / SR; b[i] = (Math.sin(ph) + Math.sin(ph * 2) * .25) * Math.exp(-t * 28); } return fadeEdges(normalize(b, .7)); },
  // Звонкий акцент (появление цифры/тикера)
  ding(v) { const n = len(.7), b = new Float32Array(n), f0 = 1046 + v * 60; for (let i = 0; i < n; i++) { const t = i / SR; b[i] = (Math.sin(2 * Math.PI * f0 * t) + Math.sin(2 * Math.PI * f0 * 1.5 * t) * .5 + Math.sin(2 * Math.PI * f0 * 2.01 * t) * .25) * Math.exp(-t * 6); } return fadeEdges(normalize(reverb(b, .3), .7)); },
  // Нарастание перед акцентом
  riser(v) {
    const r = prng(606 + v), d = 1 + (v % 3) * .2, n = len(d), b = new Float32Array(n), f = biquad('bp'); let ph = 0;
    for (let i = 0; i < n; i++) { const u = i / n; if (i % 16 === 0) f.set(400 * Math.pow(18, u), 1.2); ph += 2 * Math.PI * (180 * Math.pow(4, u)) / SR; b[i] = (f.run(r()) * .8 + Math.sin(ph) * .25) * Math.pow(u, 2.4); }
    return fadeEdges(normalize(b, .85), .01, .006);
  },
  // Цифровой глитч: обрывки квадратных волн и «битого» шума
  glitch(v) {
    const r = prng(707 + v), d = .26 + (v % 3) * .06, n = len(d), b = new Float32Array(n); let i = 0;
    while (i < n) { const segN = len(.008 + Math.abs(r()) * .025), mode = Math.floor(Math.abs(r()) * 3), fr = 120 + Math.abs(r()) * 2400, hold = 1 + Math.floor(Math.abs(r()) * 30); let held = 0;
      for (let k = 0; k < segN && i < n; k++, i++) { const t = i / SR; if (mode === 0) b[i] = Math.sign(Math.sin(2 * Math.PI * fr * t)) * .6; else if (mode === 1) { if (k % hold === 0) held = r(); b[i] = held * .8; } else b[i] = 0; } }
    return fadeEdges(normalize(b, .7));
  },
  // Мерцание (монеты, логотипы)
  shimmer(v) { const r = prng(808 + v), n = len(.9), b = new Float32Array(n), ps = Array.from({ length: 6 }, () => 1400 + Math.abs(r()) * 3600); for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; ps.forEach((p, k) => { s += Math.sin(2 * Math.PI * p * t + k) * (.5 + .5 * Math.sin(t * (14 + k * 3))); }); b[i] = s * Math.min(1, t * 30) * Math.exp(-t * 4.5) / ps.length; } return fadeEdges(normalize(reverb(b, .45), .6)); },
  // Поп (появление элемента)
  pop(v) { const n = len(.09), b = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR; ph += 2 * Math.PI * (380 + 700 * (1 - Math.exp(-t * 50)) + v * 40) / SR; b[i] = Math.sin(ph) * Math.exp(-t * 40); } return fadeEdges(normalize(b, .75)); },
  // «Остановка ленты» — тон, падающий вниз
  stop(v) { const n = len(.6), b = new Float32Array(n), f = biquad('lp'); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n; ph += 2 * Math.PI * (240 - 205 * Math.pow(u, .6)) / SR; if (i % 16 === 0) f.set(3000 * (1 - u) + 200, .8); const saw = ((ph / (2 * Math.PI)) % 1) * 2 - 1; b[i] = f.run(saw) * (1 - u); } return fadeEdges(normalize(b, .7)); },
  // Обратная волна перед финалом
  reverse(v) { const r = prng(909 + v), n = len(.8), b = new Float32Array(n), f = biquad('lp'); for (let i = 0; i < n; i++) { const u = i / n; if (i % 16 === 0) f.set(300 + 5000 * u, .7); b[i] = f.run(r()) * Math.pow(u, 3); } return fadeEdges(normalize(b, .8), .01, .004); },
  // Мягкий воздух (для плавных переходов)
  // Писк хомяка: короткий восходящий «чирик» с вибрато (испуг, удивление)
  squeak(v) { const n = len(.16 + (v % 2) * .1), b = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n, t = i / SR, f = (1500 + 1300 * Math.pow(u, .6) + v * 60) * (1 + .04 * Math.sin(t * 2 * Math.PI * 38)); ph += 2 * Math.PI * f / SR; b[i] = (Math.sin(ph) + .25 * Math.sin(ph * 2)) * Math.sin(Math.PI * Math.min(1, u * 1.3)); } return fadeEdges(normalize(b, .55), .004, .02); },
  // Хихиканье: серия коротких чириков, понижающихся по высоте
  giggle(v) { const n = len(.5), b = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, k = Math.floor(t / .085), lt = t - k * .085; if (k > 4) break; const f = (2300 - k * 160 + v * 50) * (1 + .5 * Math.exp(-lt * 60)); ph += 2 * Math.PI * f / SR; b[i] = Math.sin(ph) * Math.exp(-lt * 34) * (1 - k * .12); } return fadeEdges(normalize(b, .5)); },
  // Прыжок: «боинг» с падающим тоном
  boing(v) { const n = len(.35), b = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR, f = 220 + 520 * Math.exp(-t * 9) * (1 + .15 * Math.sin(t * 2 * Math.PI * 22)); ph += 2 * Math.PI * f / SR; b[i] = Math.sin(ph) * Math.exp(-t * 7); } return fadeEdges(normalize(b, .7)); },
  // Звуковой логотип канала: одинаковый в каждом ролике (маримба До–Ми–Соль–До + искра)
  jingle() {
    const n = len(1.6), b = new Float32Array(n), notes = [[0, 523.25], [.12, 659.25], [.24, 783.99], [.42, 1046.5]];
    for (const [t0, f] of notes) { const a = Math.round(t0 * SR); let p1 = 0, p2 = 0; for (let i = 0; a + i < n; i++) { const t = i / SR; p1 += 2 * Math.PI * f / SR; p2 += 2 * Math.PI * f * 4 / SR; b[a + i] += (Math.sin(p1) * Math.exp(-t * 4.5) + .35 * Math.sin(p2) * Math.exp(-t * 22)) * (t0 > .4 ? 1.2 : .9); } }
    const r = prng(77), hp = biquad('hp'); hp.set(6000, .7); const a = Math.round(.42 * SR); for (let i = 0; a + i < n; i++) { const t = i / SR; b[a + i] += hp.run(r()) * .25 * Math.exp(-t * 6) * (.5 + .5 * Math.sin(t * 90)); }
    return fadeEdges(normalize(reverb(b, .35, 1.1).slice(0, n), .85), .002, .2);
  },
  // «Зверо-новости»: заставка как у телевизионных новостей — удар литавры, три «медных» аккорда вверх и длинный аккорд
  newsSting() {
    const n = len(2.2), b = new Float32Array(n), r = prng(4242), lp = biquad('lp');
    for (let i = 0; i < len(.9); i++) { const t = i / SR; b[i] += (Math.sin(2 * Math.PI * (62 + 40 * Math.exp(-t * 12)) * t) * .9 + r() * .25 * Math.exp(-t * 30)) * Math.exp(-t * 4); }
    const chords = [[0, .16, [261.6, 329.6, 392]], [.18, .16, [293.7, 370, 440]], [.36, .16, [329.6, 415.3, 493.9]], [.56, 1.5, [392, 493.9, 587.3, 784]]];
    for (const [t0, d, fs] of chords) { const a0 = len(t0); lp.set(1800, .7); for (let i = 0; i < len(d + .3) && a0 + i < n; i++) { const t = i / SR, env = Math.min(1, t * 60) * (t < d ? 1 : Math.exp(-(t - d) * 9)) * (d > 1 ? .85 + .15 * Math.sin(2 * Math.PI * 6 * t) : 1); let x = 0; for (const f of fs) x += ((t * f) % 1) * 2 - 1 + .5 * Math.sin(2 * Math.PI * f * 2 * t); b[a0 + i] += lp.run(x / fs.length) * env * .7; } }
    return fadeEdges(normalize(reverb(b, .3, 1.2).slice(0, n), .9), .002, .3);
  },
  // музыка «из наушников» и под танец: свой бит (бочка, хэт, бас) — без чужих треков и авторских прав
  beat() {
    const n = len(3), b = new Float32Array(n), r = prng(5150), lp = biquad('lp'); lp.set(1400, .7);
    for (let k = 0; k < 6; k++) { const a0 = len(k * .5); for (let i = 0; i < len(.35) && a0 + i < n; i++) { const t = i / SR; b[a0 + i] += Math.sin(2 * Math.PI * (50 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9); } }
    for (let k = 0; k < 12; k++) { const a0 = len(k * .25 + .125); for (let i = 0; i < len(.05) && a0 + i < n; i++) b[a0 + i] += (r() * 2 - 1) * .25 * Math.exp(-i / SR * 80); }
    const bass = [55, 55, 65.4, 49]; for (let k = 0; k < 6; k++) { const a0 = len(k * .5), f = bass[k % 4]; for (let i = 0; i < len(.45) && a0 + i < n; i++) { const t = i / SR; b[a0 + i] += Math.sin(2 * Math.PI * f * 2 * t) * .35 * Math.exp(-t * 4); } }
    for (let i = 0; i < n; i++) b[i] = lp.run(b[i]);
    return fadeEdges(normalize(b, .7), .01, .1);
  },
  // «СРОЧНО»: тревожный двухтональный сигнал и удар
  breaking() {
    const n = len(1.1), b = new Float32Array(n);
    for (let k = 0; k < 4; k++) { const a0 = len(k * .14), f = k % 2 ? 660 : 880; for (let i = 0; i < len(.12) && a0 + i < n; i++) { const t = i / SR; b[a0 + i] += (Math.sin(2 * Math.PI * f * t) + .3 * Math.sin(2 * Math.PI * f * 3 * t)) * Math.min(1, t * 200) * Math.exp(-t * 8) * .6; } }
    const a0 = len(.58); for (let i = 0; a0 + i < n; i++) { const t = i / SR; b[a0 + i] += Math.sin(2 * Math.PI * (55 + 50 * Math.exp(-t * 15)) * t) * Math.exp(-t * 5); }
    return fadeEdges(normalize(b, .85));
  },
  air(v) { const r = prng(111 + v), n = len(.5), b = new Float32Array(n), f = biquad('hp'); f.set(3000, .6); for (let i = 0; i < n; i++) { const u = i / n; b[i] = f.run(r()) * Math.sin(Math.PI * u); } return fadeEdges(normalize(b, .4)); },
  // ---------- звуки-мемы и голоса героев ----------
  badum(v) { // «ба-дум-тсс»: два тома и тарелка — после шутки
    const r = prng(1201 + v), n = len(1.4), b = new Float32Array(n), hp = biquad('hp'); hp.set(6000, .7);
    const tom = (at, f0) => { const a = len(at); for (let i = 0; i < len(.35) && a + i < n; i++) { const t = i / SR; b[a + i] += Math.sin(2 * Math.PI * (f0 + 60 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14) * .9 + r() * Math.exp(-t * 60) * .25; } };
    tom(0, 190 + v * 6); tom(.17, 140 + v * 5);
    const c = len(.36); for (let i = 0; c + i < n; i++) { const t = i / SR; b[c + i] += hp.run(r()) * Math.exp(-t * 3.2) * .8 + r() * Math.exp(-t * 40) * .4; }
    return fadeEdges(normalize(b, .8));
  },
  plop(v) { // «бульк» — деньги утекли
    const n = len(.35), b = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, k = t < .16 ? 0 : 1, lt = t - k * .16, f = (k ? 520 : 380) + (k ? 900 : 1100) * (1 - Math.exp(-lt * 45)) + v * 20; ph += 2 * Math.PI * f / SR; b[i] = Math.sin(ph) * Math.exp(-lt * 22) * (k ? .55 : 1); }
    return fadeEdges(normalize(b, .7));
  },
  sniff(v) { // Крот шмыгает носом
    const r = prng(1301 + v), n = len(.45), b = new Float32Array(n), f = biquad('bp');
    for (let i = 0; i < n; i++) { const t = i / SR, k = Math.floor(t / .14); if (k > 2) break; const lt = t - k * .14; if (i % 32 === 0) f.set(1800 + 900 * lt / .14 + v * 80, 3); b[i] = f.run(r()) * Math.sin(Math.PI * Math.min(1, lt / .1)); }
    return fadeEdges(normalize(b, .55));
  },
  hoot(v) { // Сова: «у-ху»
    const n = len(.75), b = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, second = t > .32, lt = second ? t - .32 : t, f = (second ? 360 : 420) + v * 8 + 6 * Math.sin(2 * Math.PI * 6 * t); ph += 2 * Math.PI * f / SR; const env = Math.min(1, lt * 18) * Math.exp(-lt * (second ? 4 : 9)); b[i] = (Math.sin(ph) + .3 * Math.sin(ph * 2)) * env; }
    return fadeEdges(normalize(reverb(b, .25), .55));
  },
  huff(v) { // Ёж фыркает: «пф-ф»
    const r = prng(1401 + v), n = len(.4), b = new Float32Array(n), f = biquad('lp');
    for (let i = 0; i < n; i++) { const t = i / SR; if (i % 32 === 0) f.set(900 + 2500 * Math.exp(-t * 8), .9); b[i] = f.run(r()) * Math.min(1, t * 80) * Math.exp(-t * 7); }
    return fadeEdges(normalize(b, .6));
  },
  roar(v) { // Лев: короткий добродушный «р-р-р»
    const r = prng(1501 + v), n = len(.7), b = new Float32Array(n), f = biquad('lp'); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, u = t / .7; ph += 2 * Math.PI * (95 + 40 * Math.sin(Math.PI * u) + v * 4) / SR; if (i % 32 === 0) f.set(700 + 900 * Math.sin(Math.PI * u), .9); const saw = ((ph / (2 * Math.PI)) % 1) * 2 - 1, trem = .6 + .4 * Math.sin(2 * Math.PI * 28 * t); b[i] = f.run(saw * .7 + r() * .5) * trem * Math.sin(Math.PI * Math.min(1, u * 1.2)); }
    return fadeEdges(normalize(b, .65));
  },
  howl(v) { // Волк: короткое дружелюбное «ау-у»
    const n = len(.8), b = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, u = t / .8, f = 420 + 260 * Math.sin(Math.PI * Math.min(1, u * 1.4)) + v * 10 + 6 * Math.sin(2 * Math.PI * 6 * t); ph += 2 * Math.PI * f / SR; b[i] = (Math.sin(ph) + .25 * Math.sin(ph * 2) + .1 * Math.sin(ph * 3)) * Math.sin(Math.PI * Math.min(1, u * 1.1)) * Math.min(1, t * 20); }
    return fadeEdges(normalize(b, .5));
  },
  chitter(v) { // Енот стрекочет
    const n = len(.45), b = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, k = Math.floor(t / .055); if (k > 6) break; const lt = t - k * .055, f = 1700 + (k % 2) * 400 + v * 60 - lt * 6000; ph += 2 * Math.PI * Math.max(900, f) / SR; b[i] = (Math.sin(ph) + .3 * Math.sin(ph * 2.01)) * Math.exp(-lt * 70); }
    return fadeEdges(normalize(b, .45));
  },
  chirp(v) { // Белка цокает
    const n = len(.4), b = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / SR, k = Math.floor(t / .09); if (k > 3) break; const lt = t - k * .09, f = 3200 + v * 90 - lt * 9000; ph += 2 * Math.PI * Math.max(1500, f) / SR; b[i] = Math.sin(ph) * Math.exp(-lt * 55); }
    return fadeEdges(normalize(b, .5));
  },
};
export const SFX_KINDS = Object.keys(SYNTH);

const cache = new Map();
export function sound(kind, v = 0) {
  const key = `${kind}:${v % 6}`;
  if (!cache.has(key)) cache.set(key, SYNTH[kind](v % 6));
  return cache.get(key);
}

/**
 * Сводит звуковые события в стерео-дорожку.
 * cues: [{t, kind, gain, pan, v}] — время в секундах от начала ролика.
 * Возвращает статистику (сколько звуков, пик).
 */
export function renderSfxBus(cues, totalSec, outFile) {
  const n = Math.ceil(totalSec * SR) + SR, L = new Float32Array(n), R = new Float32Array(n);
  let lastVar = {};
  for (const c of cues) {
    if (!SYNTH[c.kind]) continue;
    let v = c.v ?? 0; if (lastVar[c.kind] === v % 6) v++; lastVar[c.kind] = v % 6;   // одинаковые звуки подряд не повторяем
    const b = sound(c.kind, v), at = Math.round(c.t * SR), pan = Math.max(-1, Math.min(1, c.pan || 0));
    const gl = Math.cos((pan + 1) * Math.PI / 4) * c.gain, gr = Math.sin((pan + 1) * Math.PI / 4) * c.gain;
    for (let i = 0; i < b.length && at + i < n; i++) { if (at + i < 0) continue; L[at + i] += b[i] * gl; R[at + i] += b[i] * gr; }
  }
  // мягкое ограничение шины, чтобы наложения не клиппировали
  let peak = 0; for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i] * .9) ; R[i] = Math.tanh(R[i] * .9); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
  writeStereoWav(L, R, outFile, .8);
  return { count: cues.length, peak: +(peak * .8).toFixed(3) };
}

/** Записывает стерео 16 бит 48 кГц. */
export function writeStereoWav(L, R, outFile, gain = 1) {
  const n = L.length, data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) { data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), i * 4); data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), i * 4 + 2); }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
  fs.writeFileSync(outFile, Buffer.concat([hdr, data]));
}
