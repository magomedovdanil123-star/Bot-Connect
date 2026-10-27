// Строит timing.js (времена фраз, листов, миров) и cues.js (все звуки) из озвучки и story.js.
// node build.mjs <timings.json> <voice.wav>
import fs from 'fs';
import vm from 'vm';
import { execFileSync } from 'child_process';

const [tmFile, voiceFile] = process.argv.slice(2);
const vo = JSON.parse(fs.readFileSync(tmFile, 'utf8'));
const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(fs.readFileSync('story.js', 'utf8'), ctx);
const ST = ctx.window.STORY, LEAD = ST.lead;

const PH = vo.timings.map(p => ({ s: +(LEAD + p.start).toFixed(3), d: +p.speak.toFixed(3) }));
const SI = []; ST.lines.reduce((a, n, i) => (SI[i] = a, a + n), 0);
if (SI.at(-1) + ST.lines.at(-1) !== PH.length) throw new Error(`фраз в озвучке ${PH.length}, в story ${SI.at(-1) + ST.lines.at(-1)}`);
const T = (n, l = 0, f = 0) => { const p = PH[SI[n] + l]; return +(p.s + f * p.d).toFixed(3); };
const END = PH.at(-1).s + PH.at(-1).d, DUR = Math.ceil(END + 4.5);

// листы: начало = чуть раньше первой фразы (камера успевает приехать), конец = начало следующего
const sheetStart = ST.sheets.map((_, n) => n === 0 ? -1 : +(T(n) - .45).toFixed(3));
const sheetEnd = sheetStart.map((_, n) => n + 1 < sheetStart.length ? sheetStart[n + 1] : DUR + 1);
const worlds = ST.worlds.map((w, i) => ({ ...w, from: i === 0 ? -1 : +(T(w.sheets[0]) - .7).toFixed(3) }));
worlds.forEach((w, i) => { w.to = i + 1 < worlds.length ? worlds[i + 1].from : DUR + 1; });
const caught = ST.caught.map(c => c && T(...c));
const cut = T(...ST.cut);

const ev = [];
const add = (id, t, type, o = {}) => { if (t < DUR - .05) ev.push({ id, t: +t.toFixed(3), type, ...o }); };
worlds.forEach((w, i) => {
  if (i) add(`iris_${w.id}`, w.from, 'magic', { dur: 1.0, gain: -7 });
  if (w.ch) { add(`card_${w.id}`, w.from + .35, 'page', { gain: -8 }); add(`cardw_${w.id}`, w.from + .55, 'write', { dur: 1.0, gain: -11 }); }
});
ST.sheets.forEach((sh, n) => {
  const t0 = Math.max(sheetStart[n], -.6), at = (l, f) => T(n, l, f);
  const prevArea = n ? (ST.sheets[n - 1].area || 0) : 0, sameWorld = worlds.some(w => w.sheets.includes(n) && w.sheets[0] !== n);
  if (sameWorld && (sh.area || 0) !== prevArea) add(`pan_${n}`, t0 - .15, 'whoosh', { dur: .7, gain: -10 });
  sh.cast.forEach((c, j) => add(`fig_${n}_${c.id}`, c.l != null ? at(c.l, c.f || 0) : t0 + .1 + j * .25, 'scribble', { dur: 1.0, gain: -13 }));
  sh.beats.forEach((b, j) => {
    const t = at(b.l, b.f);
    if (b.say || b.think) add(`b_${n}_${j}`, t, 'pop', { gain: -11 });
    if (b.fx === '!' || b.fx === '?') add(`fx_${n}_${j}`, t + .05, 'tick', { gain: -7 });
    if (b.fx === 'shake') add(`fx_${n}_${j}`, t, 'thump', { gain: -9 });
    if (b.fx === 'jump') add(`fx_${n}_${j}`, t, 'pop', { gain: -9 });
  });
  if (sh.show) add(`show_${n}`, at(sh.show.l, sh.show.f), 'write', { dur: .9, gain: -11 });
  (sh.sfx || []).forEach((s, j) => add(`sfx_${n}_${j}`, at(s.l, s.f), s.type, { ...(s.dur ? { dur: s.dur } : {}), ...(s.gain != null ? { gain: s.gain } : {}) }));
});
caught.forEach((t, i) => { if (t) { add(`drop_${i}`, t, 'whoosh', { dur: .45, gain: -12 }); add(`land_${i}`, t + .5, 'thump', { gain: -5 }); } });
for (let i = 0; i < 7; i++) add(`snip_${i}`, cut + .25 + i * .2, 'click', { gain: -6, pan: -.6 + i * .2 });
add('freed', cut + 1.7, 'sparkle', { gain: -6 });
add('twist', worlds.find(w => w.id === 'w8').from, 'none');
add('final', END + .6, 'chime', { gain: -8 });
ev.sort((a, b) => a.t - b.t);

const cues = {
  duration: DUR, fps_draw: 12, output: 'audio/mix.wav',
  music: { enabled: true, mood: 'musicbox', bpm: 84, root: 'D', twist: 'twist', gain: -9 },
  voice: { engine: 'files' },
  tracks: [{ file: 'audio/voice.wav', t: LEAD, gain: 0, duck: true }],
  events: ev,
};
fs.writeFileSync('cues.js', `/* сгенерировано build.mjs — не править руками */\nwindow.CUES = /*JSON-START*/${JSON.stringify(cues, null, 1)}/*JSON-END*/;\n`);
fs.writeFileSync('timing.js', `/* сгенерировано build.mjs */\nwindow.TM = ${JSON.stringify({ PH, SI, DUR, END, sheetStart, sheetEnd, worlds, caught, cut })};\n`);
fs.mkdirSync('audio', { recursive: true });
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', voiceFile, '-ar', '48000', '-ac', '1', 'audio/voice.wav']);
// длительность в index.html
let html = fs.readFileSync('index.html', 'utf8').replace(/data-duration="[\d.]+"/g, `data-duration="${DUR}"`);
if (!html.includes('timing.js')) html = html.replace('<script src="cues.js"></script>', '<script src="cues.js"></script>\n    <script src="story.js"></script>\n    <script src="timing.js"></script>');
fs.writeFileSync('index.html', html);
console.log('DUR', DUR, 'events', ev.length, 'worlds', worlds.map(w => `${w.id}@${w.from}`).join(' '));
