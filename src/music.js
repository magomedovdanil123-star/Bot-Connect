// Музыкальная подложка: собственный синтез (без сэмплов и лицензий), аранжировка следует за монтажом.
// Энергия такта = «громкость» сцены (director: level 0/1/2): 0 — пэд, 1 — + бочка в полтемпа, бас, хэты,
// 2 — прямая бочка, хлопки, арпеджио, тарелка на входе. Сайдчейн-«качка» под бочку, реверб, пинг-понг дилей.
// Детерминировано: тот же план (seed) — та же музыка.
import { SR, biquad, prng, reverb, writeStereoWav } from './sfx.js';

const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const MINOR_DEG = new Set([0, 5]);   // i и iv — минорные, остальные ступени — мажорные

// пилообразная волна без алиасинга (polyBLEP)
function saw(freq, phase = 0) {
  let ph = phase; const dt = freq / SR;
  const blep = t => t < dt ? (t /= dt, t + t - t * t - 1) : t > 1 - dt ? (t = (t - 1) / dt, t * t + t + t + 1) : 0;
  return () => { ph += dt; if (ph >= 1) ph -= 1; return 2 * ph - 1 - blep(ph); };
}
const add = (buf, at, i, v) => { const k = at + i; if (k >= 0 && k < buf.length) buf[k] += v; };

export function renderMusic(plan, outFile) {
  const m = plan.music; if (!m) return null;
  const total = plan.total + 1, n = Math.ceil(total * SR);
  const beat = 60 / m.bpm, bar = beat * 4, org = m.origin || 0;
  const rnd = prng(m.bpm * 131 + m.root * 7 + 3);
  // шины
  const padL = new Float32Array(n), padR = new Float32Array(n), bass = new Float32Array(n), drums = new Float32Array(n);
  const arpL = new Float32Array(n), arpR = new Float32Array(n), send = new Float32Array(n);
  const kicks = [];

  // ---- энергия по тактам из монтажа ----
  const scenes = plan.scenes, last = scenes[scenes.length - 1], end = last ? last.start + last.dur : total;
  const nBars = Math.ceil((end - org) / bar) + 1;
  const energy = [];
  for (let b = 0; b < nBars; b++) {
    const tb = org + b * bar + bar * .25; let lv = 0;
    for (const s of scenes) if (s.start <= tb && tb < s.start + s.dur) lv = s.dir?.level ?? 0;
    if (tb >= end) lv = -1;                       // после последней сцены — только хвост пэда
    if (b === 0) lv = Math.min(lv, 1);            // вступление: сначала устанавливаем настроение
    energy.push(lv);
  }
  // кульминация не дольше 4 тактов подряд, затем «вдох» — так у трека есть форма
  for (let b = 0, run = 0; b < nBars; b++) { run = energy[b] === 2 ? run + 1 : 0; if (run > 4) { energy[b] = 1; run = 0; } }

  const chordAt = b => { const deg = m.prog[((b % 4) + 4) % 4], root = 45 + m.root % 12 + deg - (m.root + deg > 11 ? 12 : 0); return { root, third: MINOR_DEG.has(deg) ? 3 : 4 }; };

  // ---- пэд: 3 ноты аккорда × 2 расстроенные пилы на канал ----
  for (let b = -1; b < nBars; b++) {
    const t0 = org + b * bar, len = bar + .5, { root, third } = chordAt(Math.max(0, b));
    const notes = [root + 12, root + 12 + third, root + 19, root + 24];
    if (b === -1 && org < .05) continue;
    notes.forEach((nm, j) => {
      const oscs = [saw(hz(nm) * Math.pow(2, 7 / 1200), rnd() * .5 + .5), saw(hz(nm) * Math.pow(2, -9 / 1200), rnd() * .5 + .5), saw(hz(nm) * Math.pow(2, 3 / 1200), rnd() * .5 + .5), saw(hz(nm) * Math.pow(2, -4 / 1200), rnd() * .5 + .5)];
      const at = Math.round(Math.max(0, t0) * SR), N = Math.round((b === -1 ? org : len) * SR), atk = .35 * SR, rel = .5 * SR, g = .055 * (j === 3 ? .6 : 1);
      for (let i = 0; i < N; i++) {
        const env = Math.min(1, i / atk) * Math.min(1, (N - i) / rel) * (b === -1 ? i / N : 1);
        const l = (oscs[0]() + oscs[1]()) * g * env, r = (oscs[2]() + oscs[3]()) * g * env;
        add(padL, at, i, l); add(padR, at, i, r);
      }
    });
    // хвост в конце ролика: последний аккорд звучит и затихает
    if (energy[Math.max(0, b)] < 0) break;
  }

  // ---- ударные, бас, арпеджио по долям ----
  const kick = at => { kicks.push(at / SR); const N = .5 * SR; let ph = 0; for (let i = 0; i < N; i++) { const t = i / SR, f = 46 + 120 * Math.exp(-t / .03); ph += 6.2832 * f / SR; add(drums, at, i, Math.tanh(Math.sin(ph) * Math.exp(-t / .26) * 1.6) * .9 + (i < 200 ? rnd() * .25 * (1 - i / 200) : 0)); } };
  const clap = (at, gain = 1) => { const f = biquad('bp'); f.set(1300, .9); const N = .3 * SR; for (let i = 0; i < N; i++) { const t = i / SR, e = (t < .03 ? (Math.exp(-((t % .011) / .003))) : Math.exp(-(t - .03) / .09)); const v = f.run(rnd()) * e * .9 * gain; add(drums, at, i, v); add(send, at, i, v * .5); } };
  const hat = (at, gain) => { const f = biquad('hp'); f.set(7500, .7); const N = .06 * SR; for (let i = 0; i < N; i++) add(drums, at, i, f.run(rnd()) * Math.exp(-i / SR / .018) * gain); };
  const crash = at => { const f = biquad('hp'); f.set(4200, .6); const N = 1.8 * SR; for (let i = 0; i < N; i++) { const v = f.run(rnd()) * Math.exp(-i / SR / .55) * .32; add(drums, at, i, v); add(send, at, i, v * .6); } };
  const bassNote = (at, nm, dur, gain = 1) => {
    const N = Math.round(dur * SR), o = saw(hz(nm)), lp = biquad('lp'); lp.set(240, .9); let ph = 0;
    for (let i = 0; i < N; i++) { const e = Math.min(1, i / 120) * Math.min(1, (N - i) / 600); ph += 6.2832 * hz(nm) / SR; add(bass, at, i, (Math.sin(ph) * .75 + lp.run(o()) * .45) * e * .55 * gain); }
  };
  const pluck = (at, nm, gain, pan) => {
    const N = Math.round(.32 * SR), o1 = saw(hz(nm)), o2 = saw(hz(nm) * 1.004), lp = biquad('lp');
    for (let i = 0; i < N; i++) { if (i % 32 === 0) lp.set(500 + 3800 * Math.exp(-i / SR / .07), 1.4); const v = lp.run(o1() + o2()) * Math.exp(-i / SR / .13) * gain; add(arpL, at, i, v * (1 - pan)); add(arpR, at, i, v * (1 + pan)); add(send, at, i, v * .25); }
  };

  for (let b = 0; b < nBars; b++) {
    const e = energy[b]; if (e < 0) { if (energy[b - 1] >= 1) crash(Math.round((org + b * bar) * SR)); break; }
    const t0 = org + b * bar, { root, third } = chordAt(b), at = x => Math.round((t0 + x * beat) * SR);
    if (e === 2 && (b === 0 || energy[b - 1] < 2)) crash(at(0));
    if (e >= 1) {
      for (let q = 0; q < 4; q++) if (e === 2 || q % 2 === 0) kick(at(q));
      for (let q = 0; q < 8; q++) { if (q % 2) hat(at(q / 2), e === 2 ? .3 : .22); else if (e === 2) hat(at(q / 2), .1); }
      if (e === 2) { clap(at(1)); clap(at(3)); for (let q = 0; q < 16; q += 2) hat(at(q / 4 + .25), .07); }
      // бас: в кульминации — восьмые со смещением (качает), иначе — длинная нота на такт
      if (e === 2) for (let q = 0; q < 8; q++) bassNote(at(q / 2 + .02), root - 12 + (q === 7 ? 7 : 0), beat * .45, q % 2 ? 1 : .8);
      else bassNote(at(0), root - 12, bar * .96, .9);
    }
    // арпеджио: шестнадцатые по нотам аккорда в кульминации, восьмые — в развитии
    if (e >= 1) {
      const tones = [0, third, 7, 12, 7 + 12, third + 12], pat = [0, 2, 3, 1, 4, 2, 5, 3];
      const step = e === 2 ? .25 : .5;
      for (let q = 0, k = 0; q < 4; q += step, k++) pluck(at(q), root + 12 + tones[pat[k % pat.length]], e === 2 ? .16 : .1, k % 2 ? .35 : -.35);
    }
    // сбивка малым перед входом в кульминацию
    if (energy[b + 1] === 2 && e < 2) for (let q = 0; q < 4; q++) clap(at(3 + q / 4), .25 + q * .2);
  }

  // ---- сайдчейн-качка под бочку ----
  kicks.sort((a, b) => a - b);
  let ki = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; while (ki + 1 < kicks.length && kicks[ki + 1] <= t) ki++;
    const dk = kicks.length && kicks[ki] <= t ? t - kicks[ki] : 9, pump = 1 - .6 * Math.exp(-dk / .1);
    padL[i] *= pump; padR[i] *= pump; bass[i] *= .35 + .65 * pump; arpL[i] *= .5 + .5 * pump; arpR[i] *= .5 + .5 * pump;
  }
  // ---- фильтр пэда открывается с энергией ----
  const fL = biquad('lp'), fR = biquad('lp');
  for (let i = 0; i < n; i++) {
    if (i % 64 === 0) { const t = i / SR, b = Math.floor((t - org) / bar), e = Math.max(0, energy[Math.max(0, Math.min(nBars - 1, b))] ?? 0); const c = 650 + 900 * e + 250 * Math.sin(t * .7); fL.set(c, .8); fR.set(c * 1.04, .8); }
    padL[i] = fL.run(padL[i]); padR[i] = fR.run(padR[i]);
    send[i] += (padL[i] + padR[i]) * .25;
  }
  // ---- пинг-понг дилей для арпеджио (3/16) ----
  const dl = Math.round(beat * .75 * SR);
  for (let i = dl; i < n; i++) { arpL[i] += arpR[i - dl] * .38; arpR[i] += arpL[i - dl] * .38; }
  // ---- реверб (стерео: два размера) ----
  const wl = reverb(send, 1, 1.35), wr = reverb(send, 1, 1.5);
  const L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const rl = (wl[i] - send[i]) * .32, rr = (wr[i] - send[i]) * .32;
    L[i] = Math.tanh((padL[i] + bass[i] + drums[i] + arpL[i] + rl) * .9);
    R[i] = Math.tanh((padR[i] + bass[i] + drums[i] + arpR[i] + rr) * .9);
  }
  // финальное затухание и нормализация по громким участкам (RMS -15 дБFS)
  const fadeN = Math.round(1.2 * SR), endI = Math.min(n, Math.round((plan.total) * SR));
  for (let i = endI - fadeN; i < n; i++) { const k = i < endI ? (endI - i) / fadeN : 0; L[i] *= k; R[i] *= k; }
  const win = SR / 2, rms = [];
  for (let i = 0; i + win < n; i += win) { let s = 0; for (let j = i; j < i + win; j++) s += L[j] * L[j] + R[j] * R[j]; rms.push(Math.sqrt(s / win / 2)); }
  rms.sort((a, b) => b - a); const ref = rms[Math.floor(rms.length * .3)] || .1, gain = Math.min(4, Math.pow(10, -15 / 20) / ref);
  writeStereoWav(L, R, outFile, gain);
  return { bpm: m.bpm, bars: nBars, energy };
}
