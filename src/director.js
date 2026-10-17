// Режиссёр ролика: стиль (визуальный почерк), монтаж по сценам и звуковые события.
// Всё детерминировано seed'ом: тот же проект + тот же seed = тот же ролик.
// История прошлых роликов (data/history.json) снижает шанс повторить их решения.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const HISTORY_DEPTH = 4; // сколько прошлых роликов учитываем

// ---------- детерминированный генератор ----------
export function rng(seed) {
  let a = seed >>> 0;
  const next = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const pickW = (items, weight = () => 1) => { const ws = items.map(weight); const sum = ws.reduce((x, y) => x + y, 0); let r = next() * sum; for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; } return items[items.length - 1]; };
  return { next, pickW, range: (a1, b1) => a1 + (b1 - a1) * next() };
}
export const newSeed = () => (Math.random() * 2 ** 31) >>> 0;

// ---------- стиль ролика ----------
// Акценты — только неоновые: стиль канала един, оттенок у каждого ролика свой
const ACCENTS = {
  violet: ['#8b5cff', '#b9a2ff'], cyan: ['#19c6ff', '#9be6ff'], mint: ['#1fe0a6', '#9ff5d6'],
  magenta: ['#ff3dbb', '#ff9fdc'], amber: ['#ffa31a', '#ffd38a'], electric: ['#4d6bff', '#a9b8ff'],
};
const DIMENSIONS = {
  accent: Object.keys(ACCENTS),
  grid: ['square', 'fine', 'dots', 'cross'],
  hero: ['drop', 'rise', 'stretch', 'split', 'zoom', 'scramble'],
  coin: ['spin', 'burst', 'sweep', 'flip'],
  caption: ['rise', 'blur', 'mask', 'pop', 'type'],
  hud: ['corners', 'minimal', 'ticker'],
  edit: ['kinetic', 'clean', 'digital', 'cinematic'],   // характер монтажа: какие переходы любит
  hook: ['flash', 'glitch', 'zoom', 'wipe'],
  ending: ['collapse', 'iris', 'glitchout', 'zoomout', 'lineout'],
  particles: ['dust', 'embers', 'data', 'none'],
};
const PREFERRED = { accent: { violet: 2.2 } };     // фирменный фиолетовый встречается чаще

function loadHistory() { try { return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8')); } catch { return []; } }
export function rememberStyle(style) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const h = loadHistory(); h.push({ at: new Date().toISOString(), seed: style.seed, ...Object.fromEntries(Object.keys(DIMENSIONS).map(k => [k, style[k]])), transitions: style.usedTransitions || [] });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(h.slice(-30), null, 1));
  } catch { /* история — не критично */ }
}

// акценты чернильной темы: [маркер/заливка, акцент текста]
const INK_ACCENTS = { yellow: ['#ffd23f', '#d9480f'], mint: ['#8ee6bd', '#0b7a4b'], pink: ['#ffb8cc', '#c2255c'], sky: ['#a5d4ff', '#1f5fbf'] };
export function chooseStyle(seed, { lockAccent, theme } = {}) {
  const R = rng(seed ^ 0x51ed);
  const recent = loadHistory().slice(-HISTORY_DEPTH);
  const style = { seed };
  for (const [dim, options] of Object.entries(DIMENSIONS)) {
    style[dim] = R.pickW(options, opt => {
      const used = recent.filter(h => h[dim] === opt).length;           // чем чаще было недавно, тем реже сейчас
      return (PREFERRED[dim]?.[opt] || 1) * Math.pow(.18, used);
    });
  }
  if (lockAccent && ACCENTS[lockAccent]) style.accent = lockAccent;
  style.accentColors = ACCENTS[style.accent];
  style.theme = theme || process.env.STYLE_THEME || 'neon';
  if (style.theme === 'ink') { style.accent = INK_ACCENTS[lockAccent] ? lockAccent : 'yellow'; style.accentColors = INK_ACCENTS[style.accent]; style.particles = 'none'; style.hud = 'minimal'; }   // фирменный цвет канала с талисманом постоянный
  style.intensity = +R.range(.85, 1.15).toFixed(2);
  style.recentTransitions = recent.flatMap(h => h.transitions || []);
  return style;
}

// ---------- монтаж ----------
const IMPACT = new Set(['hero', 'heroQ', 'stop', 'chapter', 'strike', 'reveal', 'warp']);
const DATA = new Set(['counter', 'fromTo', 'compare', 'timeline', 'chartUp', 'chartDown', 'candles', 'status', 'privacy']);
const COIN = new Set(['focus', 'versus', 'waves', 'link', 'orbit']);
// собственный «удар» шаблона (время внутри сцены в шкале шаблона): сборка монеты, пик гиперпрыжка
const OWN_HIT = { reveal: 1.25, warp: .9 };
// время шаблона -> реальное время (обратное к speedRamp в плеере)
const RAMP_R = .28;
function realTime(x, a) { let t = x; for (let i = 0; i < 6; i++) t -= (t + a * RAMP_R * (1 - Math.exp(-t / RAMP_R)) - x) / (1 + a * Math.exp(-t / RAMP_R)); return Math.max(0, t); }
// музыка: тональность (минор) и гармония выбираются seed'ом
const PROGS = [[0, 8, 3, 10], [0, 10, 8, 10], [0, 5, 8, 7], [0, 8, 5, 10], [0, 3, 10, 8]];
const BASE_INTENSITY = {
  hero: 2, heroQ: 2, stop: 2, chapter: 2, strike: 2, fromTo: 2, compare: 2, chartUp: 2, subscribe: 2, reveal: 2, warp: 2, orbit: 1,
  counter: 1, story: 1, timeline: 1, versus: 1, candles: 1, chartDown: 1, waves: 1, questions: 1, worlds: 1, transfer: 1, privacy: 1,
};
const EDIT_BIAS = {
  kinetic: { whip: 3, zoom: 2, slide: 2, flash: 1, wipe: 1, iris: .5, glitch: .5, fade: .5, match: 1 },
  clean: { wipe: 3, fade: 2, slide: 2, iris: 1.5, whip: 1, zoom: .5, glitch: .2, flash: .5, match: 1.5 },
  digital: { glitch: 2.5, iris: 2, wipe: 2, whip: 1, zoom: 1, flash: 1, slide: 1, fade: .5, match: 1 },
  cinematic: { zoom: 2.5, fade: 2, iris: 2, match: 2, flash: 1.5, wipe: 1, whip: .7, slide: .7, glitch: .3 },
};
const TW = { cut: 0, fade: .4, whip: .32, zoom: .45, wipe: .5, iris: .5, slide: .4, flash: .32, glitch: .26, match: .5 };

// Тайминг без озвучки: по длине текста (скорость диктора ~14.5 симв/с)
function textTimings(scenes, cps) {
  let T0 = .6;
  return scenes.map(s => {
    const dur = Math.max(2.4, s.text.length / cps + .8), speak = dur * .86;
    const ws = s.text.split(/\s+/).filter(Boolean); const chars = ws.reduce((a, w) => a + w.length + 1, 0); let c = 0;
    const words = ws.map(w => { const t = .15 + (c / chars) * speak; c += w.length + 1; return t; });
    const r = { start: T0, dur, speak, words }; T0 += dur; return r;
  });
}

/**
 * Дополняет план: стиль, тайминги, и для каждой сцены dir = {intensity, transition, tw, camera, heroFx, impacts}.
 * timings — из озвучки ([{start,dur,speak,words}] относительно начала аудио) или null.
 */
export function direct(plan, { seed, style, timings = null, lead = .6 }) {
  style = style || chooseStyle(seed, { theme: plan.hasMascot ? 'ink' : undefined });
  const R = rng(seed);
  const MR = rng(seed ^ 0xbea7);   // отдельный поток для музыки, чтобы не сдвигать остальные решения
  plan.music = { bpm: Math.round(MR.range(timings ? 92 : 100, timings ? 104 : 116)), root: Math.floor(MR.next() * 12), prog: MR.pickW(PROGS), origin: lead };
  let tm = timings ? timings.map(t => ({ ...t, start: t.start + lead })) : textTimings(plan.scenes, plan.cps || 14.5);
  // без голоса склейки ставим в бит музыки (beat-sync): длительность сцены — целое число тактовых долей (по 2)
  if (!timings) {
    const beat = 60 / plan.music.bpm; let T0 = lead;
    tm = tm.map((x, i) => {
      const minB = plan.scenes[i].type === 'reveal' || plan.scenes[i].type === 'warp' ? 6 : 4;
      const dur = Math.max(minB, Math.round(x.dur / beat / 2) * 2) * beat, k = dur / x.dur;
      const r = { start: T0, dur, speak: x.speak * k, words: x.words.map(w => w * k) }; T0 += dur; return r;
    });
  }
  const used = []; const recentT = style.recentTransitions || [];
  let highRun = 0, lastCam = '';
  plan.scenes.forEach((s, i) => {
    Object.assign(s, { start: tm[i].start, dur: tm[i].dur, speak: tm[i].speak, words: tm[i].words });
    // разнообразие внутри одного семейства: рост/падение иногда показываем свечами
    if ((s.type === 'chartUp' || s.type === 'chartDown') && R.next() < .5) { s.p = { ...s.p, down: s.type === 'chartDown' }; s.type = 'candles'; }
    let level = i === 0 ? 2 : (BASE_INTENSITY[s.type] ?? 0);
    if (level === 2) { highRun++; if (highRun > 2) { level = 1; highRun = 0; } } else highRun = 0;   // не больше двух «громких» подряд
    const prev = plan.scenes[i - 1];
    // переход: по смыслу соседних сцен + характер монтажа ролика, без повторов подряд
    let cands;
    if (i === 0) cands = [style.hook];
    else if (IMPACT.has(s.type)) cands = ['flash', 'zoom', 'glitch', 'whip'];
    else if (DATA.has(s.type)) cands = ['wipe', 'whip', 'slide', 'iris'];
    else if (prev && COIN.has(prev.type) && COIN.has(s.type)) cands = ['match', 'zoom'];
    else if (prev?.dir?.level === 2) cands = ['fade', 'slide', 'wipe', 'cut'];
    else cands = ['whip', 'wipe', 'slide', 'zoom', 'iris', 'fade', 'match'];
    const bias = EDIT_BIAS[style.edit];
    const transition = R.pickW(cands, c => (bias[c] ?? 1) * (used.slice(-2).includes(c) ? .08 : 1) * (used.slice(-5).filter(x => x === c).length > 1 ? .3 : 1) * (recentT.includes(c) ? .8 : 1));
    used.push(transition);
    const dirX = R.next() < .5 ? -1 : 1;
    // камера: громкие сцены — наезд, средние — панорама, спокойные — дрейф/отъезд/статика
    const camOpts = level === 2 ? ['push', 'push', 'punch'] : level === 1 ? ['panL', 'panR', 'push', 'pull'] : ['drift', 'pull', 'static', 'panL', 'panR'];
    const camera = R.pickW(camOpts, c => (c === lastCam ? .1 : 1)); lastCam = camera;
    // акценты: числа и названия в момент произнесения, не чаще раза в 1.4 с
    const impacts = [];
    if (level >= 1) {
      const max = level === 2 ? 2 : 1, accSet = new Set(s.acc || []);
      const nums = new Set(s.numWis || []);
      for (const wi of [...(s.numWis || []), ...(s.entWis || [])]) {
        if (impacts.length >= max || !accSet.has(wi)) continue;
        const t = s.words[wi] ?? 0;
        if (impacts.some(x => Math.abs(x.t - t) < 1.4) || t < .35 || t > s.dur - .3) continue;
        impacts.push({ t, kind: nums.has(wi) ? 'number' : 'name' });
      }
      if (!impacts.length && IMPACT.has(s.type) && !OWN_HIT[s.type]) impacts.push({ t: .32, kind: 'hit' });
    }
    const speedRampA = level === 2 ? 1 : level === 1 ? .6 : .35;
    if (OWN_HIT[s.type]) { const t = realTime(OWN_HIT[s.type], speedRampA); impacts.length = 0; if (t < s.dur - .2) impacts.push({ t, kind: 'hit' }); }
    s.dir = { level, transition, tw: i === 0 ? .55 : TW[transition], dirX, camera, impacts, ownFlare: Boolean(OWN_HIT[s.type]),
      heroFx: R.next() < .7 ? style.hero : R.pickW(DIMENSIONS.hero), speedRamp: speedRampA };
    // история: статичная камера, без ускорения времени и чужих ударов; подряд идущие сцены — склейка без перехода (герои продолжают действие)
    if (s.type === 'story') { Object.assign(s.dir, { camera: 'static', speedRamp: 0, impacts: [] }); if (prev?.type === 'story') Object.assign(s.dir, { transition: 'cut', tw: 0 }); }
  });
  style.usedTransitions = [...new Set(used)];
  plan.style = style;
  plan.seed = seed;
  plan.tickers = [...new Set(plan.scenes.flatMap(s => (s.text.match(/\b[A-Z][A-Za-z0-9]{1,}\b|\b[A-Z]{2,6}\b/g) || [])))].slice(0, 12);
  plan.total = plan.scenes.length ? plan.scenes[plan.scenes.length - 1].start + plan.scenes[plan.scenes.length - 1].dur + 1.3 : 2;
  plan.sfx = sfxCues(plan, R);
  return plan;
}

// ---------- звуковые события ----------
const TRANSITION_SFX = { whip: ['whoosh'], zoom: ['swoosh', 'sub'], wipe: ['sweep'], iris: ['shimmer'], slide: ['swoosh'], flash: ['impact'], glitch: ['glitch'], match: ['shimmer'], fade: ['air'], cut: [] };
const GAIN = { whoosh: .8, swoosh: .7, sweep: .45, shimmer: .45, impact: .95, hit: 1, sub: .7, glitch: .5, air: .3, click: .35, tick: .25, blip: .4, ding: .4, riser: .55, pop: .5, stop: .7, reverse: .55 };

function sfxCues(plan, R) {
  const cues = [];
  const add = (t, kind, o = {}) => { if (t >= 0 && t < plan.total) cues.push({ t: +t.toFixed(3), kind, gain: (o.gain ?? 1) * GAIN[kind], pan: o.pan ?? 0, v: o.v ?? Math.floor(R.next() * 6) }); };
  plan.scenes.forEach((s, i) => {
    const d = s.dur, T = s.start, n = s.dir;
    // переход
    for (const k of TRANSITION_SFX[n.transition] || []) add(T - (k === 'whoosh' || k === 'swoosh' ? .08 : 0), k, { pan: n.transition === 'whip' ? n.dirX * .5 : 0, gain: k === 'sub' ? .7 : 1 });
    // нарастание перед громкой сценой после спокойной
    const prev = plan.scenes[i - 1];
    if (prev && n.level === 2 && prev.dir.level === 0 && prev.dur > 2.2) add(T - 1.1, 'riser', { gain: .8 });
    // удары на ключевых словах
    for (const im of n.impacts) add(T + im.t - .03, im.kind === 'number' ? 'impact' : im.kind === 'hit' ? 'hit' : 'pop', { gain: n.level === 2 ? 1 : .7 });
    // звуки интерфейса по типу сцены
    const kt = wi => s.words[wi ?? 0] ?? 0;
    switch (s.type) {
      case 'counter': { const t0 = T + Math.max(.2, kt(s.numWis?.[0]) - .4); for (let k = 0; k < 7; k++) add(t0 + k * .18, 'tick', { gain: .8 - k * .06 }); add(t0 + 1.35, 'ding'); break; }
      case 'fromTo': { const t2 = T + Math.max(1.2, d * .45); add(t2 - .9, 'riser', { gain: .5 }); add(t2, 'impact', { gain: .8 }); break; }
      case 'compare': [0, 1].forEach(k => add(T + Math.max(.2, kt(s.numWis?.[k]) - .3), 'blip', { pan: k ? .3 : -.3 })); break;
      case 'timeline': add(T + Math.max(.3, kt(s.numWis?.[0]) - .5), 'blip'); break;
      case 'questions': (s.p.qs || []).forEach((q, k) => add(T + .3 + k * 1.1, 'blip', { gain: .6 })); break;
      case 'checklist': case 'warning': (s.p.items || []).slice(0, 4).forEach((x, k) => add(T + .35 + k * (s.type === 'warning' ? .5 : d * .7 / Math.max(1, s.p.items.length)), 'click')); break;
      case 'chain': case 'network': case 'status': { const nItems = (s.p.items || s.p.rows || []).length || 3; for (let k = 0; k < Math.min(nItems, 4); k++) add(T + .35 + k * (d * .62 / nItems), 'click', { pan: (k / Math.max(1, nItems - 1) - .5) * .6 }); break; }
      case 'cards': case 'focus': case 'diagram': (s.p.keys || []).slice(0, 3).forEach((k, j) => add(T + Math.max(.2 + j * .25, kt(k.wi) - .3), 'click', { pan: (j - 1) * .3 })); if (s.type === 'focus') add(T + .05, 'shimmer', { gain: .6 }); break;
      case 'versus': add(T + .1, 'shimmer', { gain: .6 }); break;
      case 'chartUp': add(T + .3, 'riser', { gain: .55 }); add(T + Math.min(d - .3, 2.6) * .8, 'impact', { gain: .6 }); break;
      case 'candles': if (s.p.down) add(T + .4, 'stop', { gain: .5 }); else add(T + .3, 'riser', { gain: .45 }); break;
      case 'chartDown': add(T + .5, 'stop', { gain: .6 }); break;
      case 'stop': add(T + .02, 'stop'); break;
      case 'privacy': add(T + d * .5, 'glitch', { gain: .6 }); break;
      case 'subscribe': { const tc = Math.max(.6, d * .55); add(T + tc + .9, 'click', { gain: 1.3 }); add(T + tc + .95, 'pop'); break; }
      case 'chapter': add(T + .25, 'sub', { gain: .8 }); break;
      case 'story': for (const a of s.p.acts || []) {
        const t0 = T + Math.max(.15, kt(a.wi) - .1);
        const seq = { receive: [[0, 'swoosh'], [.7, 'blip'], [.85, 'pop']], pay: [[0, 'pop'], [.6, 'click'], [1, 'ding']], spend: [[0, 'whoosh'], [.45, 'reverse', .5]],
          cashback: [[0, 'shimmer'], [.35, 'tick'], [.55, 'tick'], [.75, 'tick'], [.95, 'ding']], save: [[0, 'pop'], [.7, 'tick'], [.98, 'tick'], [1.26, 'tick'], [1.54, 'tick'], [1.6, 'ding']],
          grow: [[.2, 'sweep'], [1.2, 'impact', .6]], compare: [[.2, 'sweep'], [1.2, 'impact', .6]], think: [[.1, 'blip']], happy: [[0, 'shimmer'], [.1, 'pop']], sad: [[0, 'reverse', .5]] }[a.kind] || [];
        for (const [dt, kind, gn] of seq) add(t0 + dt, kind, { gain: gn ?? .8 });
      } break;
      case 'reveal': { const h = n.impacts[0]?.t ?? 1; add(T + Math.max(0, h - 1.05), 'riser', { gain: .75 }); add(T + h + .5, 'shimmer', { gain: .55 }); break; }
      case 'warp': { const h = n.impacts[0]?.t ?? .7; add(T + Math.max(0, h - 1), 'riser', { gain: .6 }); add(T + h - .35, 'whoosh', { gain: .9 }); add(T + h, 'sub', { gain: .8 }); break; }
      case 'orbit': add(T + .1, 'shimmer', { gain: .55 }); (s.p.items || []).slice(0, 5).forEach((it, k) => add(T + Math.max(.12 + k * .09, kt(it.wi) - .3), 'blip', { gain: .45, pan: (k / Math.max(1, s.p.items.length - 1) - .5) * .8 })); break;
      default: break;
    }
  });
  const last = plan.scenes[plan.scenes.length - 1];
  if (last) { add(last.start + last.dur - .6, 'reverse', { gain: .7 }); add(last.start + last.dur + .05, 'hit', { gain: .9 }); }
  // плотность: не больше одного звука одного вида за 0.22 с и не больше 4 звуков в секунду
  cues.sort((a, b) => a.t - b.t);
  const out = [];
  for (const c of cues) {
    const gap = c.kind === 'tick' ? .1 : c.kind === 'click' ? .15 : .22;
    if (out.some(o => o.kind === c.kind && c.t - o.t < gap)) continue;
    if (out.filter(o => c.t - o.t < 1).length >= 4) continue;
    out.push(c);
  }
  return out;
}
