// Темы «Гонки шаров»: локация (фон, декор, частицы), цвета трассы, вид шаров, палитра и звук. Суть гонки та же — меняется мир.
// Используется и в браузере (race.js — рисование), и в Node (racerender.mjs — звук, crush.mjs — упаковка). Рисующие функции получают контекст сами.

// палитры шаров: имя (для «ВПЕРЕДИ!» и «ПОБЕДИЛ»), цвет, род (f — «ПОБЕДИЛА»)
export const PALS = {
  classic: [['КРАСНЫЙ', '#ff3b3b'], ['СИНИЙ', '#3b8bff'], ['ЗЕЛЁНЫЙ', '#33e06a'], ['ЖЁЛТЫЙ', '#ffd23f']],
  bright: [['РОЗОВЫЙ', '#ff5cc8'], ['ГОЛУБОЙ', '#3fe0ff'], ['ОРАНЖЕВЫЙ', '#ff8a1f'], ['ФИОЛЕТОВЫЙ', '#a25cff']],
  metal: [['ЗОЛОТОЙ', '#ffc83d'], ['СЕРЕБРЯНЫЙ', '#d9e2ec'], ['МЕДНЫЙ', '#e07a43'], ['ИЗУМРУДНЫЙ', '#2fd38a']],
  planets: [['МАРС', '#e0512f'], ['НЕПТУН', '#3f6fff'], ['ЗЕМЛЯ', '#2fb5d6', 'f'], ['ЮПИТЕР', '#e0a96a']],
  berries: [['КЛУБНИКА', '#ff3b5c', 'f'], ['ЛАЙМ', '#9dff3b'], ['ЧЕРНИКА', '#6a5cff', 'f'], ['ЛИМОН', '#fff03b']],
  gems: [['РУБИН', '#ff2b4b'], ['САПФИР', '#2b6bff'], ['ИЗУМРУД', '#2bff8a'], ['ТОПАЗ', '#ffb02b']],
  fire: [['ОГОНЬ', '#ff4b1f'], ['ЛАВА', '#ff9a1f', 'f'], ['ПЕПЕЛ', '#b8b8c8'], ['ИСКРА', '#fff07a', 'f']],
  ice: [['ЛЁД', '#bff4ff'], ['ИНЕЙ', '#7fb8ff'], ['СНЕЖОК', '#ffffff'], ['АВРОРА', '#5cffb8', 'f']],
};
export const palette = id => (PALS[id] || PALS.classic).map(([name, c, g]) => ({ name, c, g: g || 'm' }));

// декор: g — контекст фона, cam — { y (верх кадра в метрах), sc (px/м) }, t — время видео, W/H — кадр
const H = 1920, W = 1080;
const hash = i => { let x = Math.sin(i * 127.1) * 43758.5453; return x - Math.floor(x); };
const wrap = (v, m) => ((v % m) + m) % m;
const par = (cam, k) => cam.y * cam.sc * k;   // смещение параллакса в пикселях
function stars(g, cam, t, n = 160, k = .15, col = '255,255,255') { for (let i = 0; i < n; i++) { const x = hash(i) * W, y = wrap(hash(i + 999) * H * 2 - par(cam, k * (1 + hash(i + 7))), H), a = .3 + .7 * Math.abs(Math.sin(t * (1 + hash(i + 3) * 3) + i)); g.fillStyle = `rgba(${col},${a * (.4 + hash(i + 5) * .6)})`; const s = 1 + hash(i + 11) * 2.5; g.fillRect(x, y, s, s); } }
function blob(g, x, y, r, c0, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c0.replace('A', a)); gr.addColorStop(1, c0.replace('A', 0)); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
function sideSil(g, cam, k, step, draw) { const off = par(cam, k); for (let i = -1; i < H / step + 2; i++) { const j = Math.floor(off / step) + i, y = j * step - off; draw(y, j); } }
function particles(g, cam, t, kind) {
  const N = { snow: 140, bubbles: 60, embers: 90, fireflies: 40, dust: 70, petals: 50 }[kind] || 0;
  for (let i = 0; i < N; i++) {
    const h1 = hash(i + 31), h2 = hash(i + 77), h3 = hash(i + 151), sp = .4 + h3;
    let x = h1 * W, y;
    if (kind === 'snow') { y = wrap(h2 * H + t * 90 * sp - par(cam, .45), H); x += Math.sin(t * .8 + i) * 25; g.fillStyle = `rgba(255,255,255,${.5 + h3 * .4})`; g.beginPath(); g.arc(x, y, 2 + h3 * 4, 0, 7); g.fill(); }
    else if (kind === 'bubbles') { y = wrap(h2 * H - t * 120 * sp - par(cam, .45), H); x += Math.sin(t * 1.5 + i) * 18; g.strokeStyle = `rgba(190,240,255,${.35 + h3 * .4})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 4 + h3 * 12, 0, 7); g.stroke(); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - 3, y - 4, 3, 3); }
    else if (kind === 'embers') { y = wrap(h2 * H - t * 150 * sp - par(cam, .45), H); x += Math.sin(t * 2 + i) * 30; g.fillStyle = `rgba(255,${120 + h3 * 120 | 0},40,${.5 + .5 * Math.sin(t * 6 + i)})`; g.fillRect(x, y, 3 + h3 * 3, 3 + h3 * 3); }
    else if (kind === 'fireflies') { y = wrap(h2 * H + Math.sin(t * .7 + i) * 40 - par(cam, .3), H); x += Math.cos(t * .5 + i * 2) * 40; const a = .3 + .7 * Math.max(0, Math.sin(t * 2.5 + i * 1.7)); blob(g, x, y, 22, 'rgba(220,255,120,A)', a * .6); g.fillStyle = `rgba(240,255,170,${a})`; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
    else if (kind === 'dust') { y = wrap(h2 * H - par(cam, .35), H); x = wrap(x + t * 40 * sp, W); g.fillStyle = `rgba(255,220,170,${.2 + h3 * .3})`; g.fillRect(x, y, 2 + h3 * 3, 2); }
    else if (kind === 'petals') { y = wrap(h2 * H + t * 70 * sp - par(cam, .4), H); x += Math.sin(t + i) * 40; g.save(); g.translate(x, y); g.rotate(t * 2 + i); g.fillStyle = ['#ff9ad5', '#ffffff', '#9ae8ff', '#fff07a'][i % 4]; g.fillRect(-6, -3, 12, 6); g.restore(); }
  }
}

export const THEMES = {
  neon: { ru: 'НЕОН', title: 'КТО ПРИДЁТ ПЕРВЫМ?', bg: ['#0d0a24', '#040814'], glow: 1, skin: 'marble', pal: 'classic',
    col: { track: '#7fe8ff', core: 'rgba(255,255,255,.75)', wall: '#3a4a7a', peg: '#ffffff', bump: '#ff2bd6', spin: '#ff8a1f', funnel: '#21e6ff', gate: '#ffd23f', tray: '#7fe8ff' },
    decor(g, cam) { g.strokeStyle = 'rgba(120,140,255,.07)'; g.lineWidth = 2; const step = 1.2 * cam.sc, off = -((cam.y * cam.sc * .5) % step); for (let y = off; y < H; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (let x = (W / 2) % step; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } },
    sound: { bpm: 150, key: 0, amb: null } },
  space: { ru: 'КОСМОС', title: 'ГОНКА В КОСМОСЕ', bg: ['#05010f', '#0b0626'], glow: 1, skin: 'planet', pal: 'planets',
    col: { track: '#b58cff', core: 'rgba(255,255,255,.8)', wall: '#2a2350', peg: '#fff6c8', bump: '#ff5cc8', spin: '#3fe0ff', funnel: '#8c7bff', gate: '#ffd23f', tray: '#b58cff' },
    decor(g, cam, t) { blob(g, 250, wrap(500 - par(cam, .08), H + 600) - 300, 520, 'rgba(160,60,255,A)', .22); blob(g, 850, wrap(1400 - par(cam, .06), H + 600) - 300, 600, 'rgba(40,120,255,A)', .2); stars(g, cam, t, 220, .1);
      const py = wrap(1300 - par(cam, .05), H + 900) - 450; const pg = g.createRadialGradient(780, py - 60, 20, 840, py, 260); pg.addColorStop(0, '#ffb98a'); pg.addColorStop(1, '#5a2340'); g.globalAlpha = .55; g.fillStyle = pg; g.beginPath(); g.arc(840, py, 250, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,220,180,.5)'; g.lineWidth = 10; g.beginPath(); g.ellipse(840, py, 420, 70, -.3, 0, 7); g.stroke(); g.globalAlpha = 1; },
    sound: { bpm: 140, key: -3, amb: 'pad' } },
  ocean: { ru: 'ПОД ВОДОЙ', title: 'ГОНКА ПОД ВОДОЙ', bg: ['#063a6b', '#011226'], glow: .7, skin: 'glass', pal: 'bright', fx: 'bubbles',
    col: { track: '#ff8ab0', core: 'rgba(255,240,245,.8)', wall: '#0d4a7a', peg: '#ffe9a8', bump: '#ffb02b', spin: '#5cffd2', funnel: '#ff8ab0', gate: '#ffd23f', tray: '#5cffd2' },
    decor(g, cam, t) { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const x = 120 + i * 180 + Math.sin(t * .3 + i) * 40; const gr = g.createLinearGradient(x, 0, x + 260, H); gr.addColorStop(0, 'rgba(150,230,255,.13)'); gr.addColorStop(1, 'rgba(150,230,255,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 70, 0); g.lineTo(x + 380, H); g.lineTo(x + 180, H); g.fill(); } g.globalCompositeOperation = 'source-over';
      sideSil(g, cam, .35, 260, (y, j) => { for (const side of [0, 1]) { const bx = side ? W - 20 - hash(j * 3 + side) * 40 : 20 + hash(j * 3) * 40; g.strokeStyle = 'rgba(20,110,80,.55)'; g.lineWidth = 16; g.beginPath(); g.moveTo(bx, y + 260); for (let k = 0; k < 6; k++) g.lineTo(bx + Math.sin(t * 1.2 + k + j) * 18 * (side ? -1 : 1), y + 260 - k * 45); g.stroke(); } }); },
    sound: { bpm: 132, key: 2, amb: 'water' } },
  lava: { ru: 'ВУЛКАН', title: 'ГОНКА В ВУЛКАНЕ', bg: ['#1a0503', '#3a0a02'], glow: 1, skin: 'metal', pal: 'fire', fx: 'embers',
    col: { track: '#ff7a1f', core: 'rgba(255,240,160,.85)', wall: '#4a1a0a', peg: '#ffd27a', bump: '#ff2b2b', spin: '#fff07a', funnel: '#ff4b1f', gate: '#ffd23f', tray: '#ff7a1f' },
    decor(g, cam, t) { blob(g, W / 2, H + 200, 1100, 'rgba(255,80,10,A)', .35 + .08 * Math.sin(t * 2));
      sideSil(g, cam, .3, 300, (y, j) => { g.strokeStyle = `rgba(255,${90 + hash(j) * 80 | 0},20,${.25 + .15 * Math.sin(t * 2 + j)})`; g.lineWidth = 5; g.beginPath(); let x = hash(j + 5) * W; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (hash(j * 7 + k) - .5) * 160; g.lineTo(x, y + k * 60); } g.stroke(); }); },
    sound: { bpm: 156, key: -2, amb: 'rumble' } },
  ice: { ru: 'ЛЕДЯНАЯ ГОРКА', title: 'ГОНКА НА ЛЬДУ', bg: ['#071a3a', '#0d2f5a'], glow: .8, skin: 'glass', pal: 'ice', fx: 'snow',
    col: { track: '#d8f6ff', core: 'rgba(255,255,255,.9)', wall: '#3a6a9a', peg: '#ffffff', bump: '#7fe8ff', spin: '#a2c8ff', funnel: '#9be8ff', gate: '#ffd23f', tray: '#d8f6ff' },
    decor(g, cam, t) { g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const y0 = 200 + i * 120 - par(cam, .03) % 400; g.strokeStyle = `rgba(${[90, 60, 160][i]},255,${[180, 220, 255][i]},.12)`; g.lineWidth = 90; g.beginPath(); for (let x = -50; x <= W + 50; x += 40) g.lineTo(x, y0 + Math.sin(x / 180 + t * .6 + i) * 60); g.stroke(); } g.globalCompositeOperation = 'source-over'; stars(g, cam, t, 80, .08);
      sideSil(g, cam, .3, 380, (y, j) => { g.fillStyle = 'rgba(200,240,255,.12)'; for (const side of [0, 1]) { const x = side ? W - 60 : 60; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (side ? -40 : 40), y + 200); g.lineTo(x + (side ? 40 : -40), y + 200); g.fill(); } }); },
    sound: { bpm: 144, key: 5, amb: 'wind' } },
  candy: { ru: 'КОНФЕТНАЯ СТРАНА', title: 'СЛАДКАЯ ГОНКА', bg: ['#ffd1ec', '#c9b6ff'], glow: .2, skin: 'face', pal: 'berries', fx: 'petals', light: true,
    col: { track: '#ff3b7a', core: '#ffffff', stripe: true, wall: '#ff9ad5', peg: '#7a3bff', bump: '#3bc8ff', spin: '#ff8a1f', funnel: '#ff3b7a', gate: '#7a3bff', tray: '#ff3b7a' },
    decor(g, cam) { const step = 140, off = par(cam, .3) % step; for (let y = -step; y < H + step; y += step) for (let x = 0; x < W + step; x += step) { const j = Math.floor((y + off) / step); g.fillStyle = ['rgba(255,255,255,.35)', 'rgba(255,140,200,.25)', 'rgba(140,200,255,.25)'][(x / step + j) % 3 | 0]; g.beginPath(); g.arc(x + (j % 2) * 70, y - off, 22, 0, 7); g.fill(); } },
    sound: { bpm: 160, key: 7, amb: null } },
  city: { ru: 'НОЧНОЙ ГОРОД', title: 'ГОНКА ПО ГОРОДУ', bg: ['#0a0618', '#1a0b2e'], glow: 1, skin: 'metal', pal: 'bright',
    col: { track: '#ff3bd0', core: 'rgba(255,255,255,.8)', wall: '#2a1a4a', peg: '#3fe0ff', bump: '#ffd23f', spin: '#3fe0ff', funnel: '#ff3bd0', gate: '#ffd23f', tray: '#ff3bd0' },
    decor(g, cam, t) { blob(g, 820, 260, 160, 'rgba(255,250,220,A)', .6); g.fillStyle = '#fffbe6'; g.beginPath(); g.arc(820, 260, 70, 0, 7); g.fill();
      for (const [k, a] of [[.12, .55], [.25, .9]]) sideSil(g, cam, k, 230, (y, j) => { for (let i = 0; i < 7; i++) { const bw = 110 + hash(j * 9 + i) * 70, x = i * 160 - 30 + (k > .2 ? 60 : 0), h = 200 + hash(j * 13 + i) * 160; g.fillStyle = `rgba(${k > .2 ? '14,8,30' : '30,18,60'},${a})`; g.fillRect(x, y, bw, 230); for (let wy = y + 20; wy < y + 210; wy += 34) for (let wx = x + 14; wx < x + bw - 14; wx += 26) if (hash(wx * 3 + wy + j) > .55) { g.fillStyle = `rgba(255,${200 + hash(wx + wy) * 50 | 0},120,${k > .2 ? .55 : .3})`; g.fillRect(wx, wy, 12, 16); } if (h < 0) g.fill(); } }); },
    sound: { bpm: 150, key: -5, amb: 'night' } },
  jungle: { ru: 'ДЖУНГЛИ', title: 'ГОНКА В ДЖУНГЛЯХ', bg: ['#04200f', '#0b3a1a'], glow: .7, skin: 'face', pal: 'gems', fx: 'fireflies',
    col: { track: '#c88a4a', core: 'rgba(255,230,180,.75)', wall: '#3a2a12', peg: '#e8ff7a', bump: '#ff5c3b', spin: '#ffd23f', funnel: '#8ad04a', gate: '#ffd23f', tray: '#c88a4a' },
    decor(g, cam, t) { for (const [k, a] of [[.15, .35], [.32, .6]]) sideSil(g, cam, k, 210, (y, j) => { for (const side of [0, 1]) for (let i = 0; i < 3; i++) { const x = side ? W - 40 - i * 70 : 40 + i * 70; g.save(); g.translate(x, y + i * 60); g.rotate((side ? -1 : 1) * (.6 + hash(j + i) * .6) + Math.sin(t + j) * .05); g.fillStyle = `rgba(${20 + k * 80 | 0},${90 + k * 150 | 0},40,${a})`; g.beginPath(); g.ellipse(0, 0, 110, 34, 0, 0, 7); g.fill(); g.restore(); } }); },
    sound: { bpm: 138, key: 3, amb: 'night' } },
  desert: { ru: 'ЗАКАТ В ПУСТЫНЕ', title: 'ГОНКА НА ЗАКАТЕ', bg: ['#ff8a4a', '#5a2a6a'], glow: .35, skin: 'metal', pal: 'metal', fx: 'dust', light: true,
    col: { track: '#fff0c8', core: '#ffffff', wall: '#7a3a2a', peg: '#ffffff', bump: '#ff3b5c', spin: '#3fe0ff', funnel: '#ffd23f', gate: '#ffffff', tray: '#fff0c8' },
    decor(g, cam) { const sy0 = 520 - par(cam, .02) % 200; blob(g, W / 2, sy0, 420, 'rgba(255,240,150,A)', .7); g.fillStyle = '#ffe48a'; g.beginPath(); g.arc(W / 2, sy0, 170, 0, 7); g.fill();
      sideSil(g, cam, .25, 340, (y, j) => { g.fillStyle = 'rgba(70,25,60,.55)'; for (const side of [0, 1]) { const x = side ? W - 90 : 90, h = 140 + hash(j) * 80; g.fillRect(x - 14, y + 300 - h, 28, h); g.fillRect(x - 50, y + 300 - h * .7, 16, h * .35); g.fillRect(x - 50, y + 300 - h * .7, 40, 14); g.fillRect(x + 34, y + 300 - h * .55, 16, h * .3); g.fillRect(x + 10, y + 300 - h * .55, 40, 14); } }); },
    sound: { bpm: 128, key: -4, amb: 'wind' } },
  retro: { ru: 'РЕТРО 8-БИТ', title: 'ПИКСЕЛЬНАЯ ГОНКА', bg: ['#000000', '#0a0a14'], glow: .9, skin: 'pixel', pal: 'classic', scan: true,
    col: { track: '#3dff6a', core: 'rgba(200,255,200,.9)', butt: true, wall: '#1a5a2a', peg: '#ffffff', bump: '#ff3bd0', spin: '#ffd23f', funnel: '#3fe0ff', gate: '#ff3b3b', tray: '#3dff6a' },
    decor(g, cam) { g.fillStyle = 'rgba(61,255,106,.06)'; const step = 48, off = par(cam, .4) % step; for (let y = -off; y < H; y += step) for (let x = 0; x < W; x += step) if ((x / step + Math.floor((y + off + par(cam, .4)) / step)) % 2) g.fillRect(x, y, step, step); },
    sound: { bpm: 160, key: 0, amb: null, chip: true } },
};
export { particles };
