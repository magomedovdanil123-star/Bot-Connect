/* Сцены из данных: сценарий описывает постановку фразы (beat.scene), код сцены не нужен.
 * scene: { loc, time: 'day'|'night'|'sunset', weather: 'rain'|'snow', season: 'summer'|'autumn'|'winter'|'spring', o: {…опции локации},
 *          cast: [{ who, x, y, s, dir, act|acts, face, tag: ['ТЕКСТ', '#цвет'], walk: [x0, x1], hold, …костюм }],
 *          cam: 'wide'|'close'|'two'|'push'|'pull'|'pan'|'tilt' | [[u, x, y, z], …], focus: индекс героя для close,
 *          info: { kind: 'big'|'count'|'pie'|'bar'|'vs'|'people', … }, props: [{ kind: 'sign'|'tv'|'clock'|'arrow', … }] }
 * Кто говорит — beat.voice (по умолчанию hero): у него рот и жесты «talk», остальные слушают. */
const CAST = {
  hero: { top: '#1e8bff', garment: 'hoodie', sleeve: true, pants: '#2b2f3f', seed: 1 },          // фирменное ярко-синее худи
  mom: { top: '#d9577a', garment: 'dress', sleeve: true, hair: 'bun', hairCol: '#6b3a26', apron: true, pants: 'ink', seed: 3 },
  dad: { top: '#5b7a5a', garment: 'tee', sleeve: true, pants: '#3b4252', glasses: true, seed: 4 },
  woman: { top: '#9b59b6', garment: 'dress', sleeve: true, hair: 'long', hairCol: '#5a3524', pants: 'ink', seed: 5 },
  girl: { top: '#ff6fb5', garment: 'hoodie', sleeve: true, hair: 'long', hairCol: '#5a2e1a', bow: '#ff2d8a', pants: '#2b3a5a', seed: 6 },   // девочки — розовая кофта или платье и волосы
  nurse: { top: '#e8f4f2', garment: 'dress', sleeve: true, hair: 'bun', hairCol: '#3a2418', pants: 'ink', seed: 7 },
  doc: { top: '#f4f6f8', garment: 'coat', sleeve: true, hair: 'long', hairCol: '#c9a26b', glasses: true, pants: '#3b4252', seed: 8 },
  granny: { top: '#9b7bc9', garment: 'dress', sleeve: true, hair: 'bun', hairCol: '#d4d7de', glasses: true, pants: 'ink', seed: 9 },
  kid: { top: '#ff8fc8', garment: 'dress', sleeve: true, hair: 'long', hairCol: '#c97a3a', bow: '#ffd400', pants: 'ink', seed: 10 },
  news: { top: '#c0392b', garment: 'dress', sleeve: true, hair: 'long', hairCol: '#1d1410', pants: 'ink', seed: 11 },
  man: { top: '#8a8f99', garment: 'coat', sleeve: true, pants: '#2b2f3f', seed: 12 },
  teacher: { top: '#2f7f7a', garment: 'dress', sleeve: true, hair: 'bun', hairCol: '#6b3a26', glasses: true, pants: 'ink', seed: 16 },
  friend: { top: '#f39c12', garment: 'hoodie', sleeve: true, hair: 'spiky', pants: '#2b3a5a', seed: 17 },
  bully: { top: '#5d6d7e', garment: 'tee', sleeve: true, hat: 'cap', hatCol: '#c0392b', pants: '#1d2330', seed: 18 },
  stranger: { top: '#1b1d24', garment: 'hoodie', sleeve: true, hat: 'cap', hatCol: '#2a2d36', pants: '#14161c', seed: 14 },
  cashier: { top: '#2ecc71', garment: 'dress', sleeve: true, hair: 'long', hairCol: '#b0602a', apron: true, pants: 'ink', seed: 15 },
  guard: { top: '#2b3445', garment: 'coat', sleeve: true, hair: 'long', hairCol: '#1d1410', pants: '#1d2330', seed: 13 },
};
const GROUND = { bathroom: 930, school: 960, elevator: 940, underground: 960, retro: 960, beach: 980, paper: 960, gas: 990, street: 1010, bedroom: 960, kitchen: 950, office: 950, rooftop: 940, shop: 975, park: 990, lab: 965, living: 960, hospital: 965, space: 930, info: 980, tvstudio: 960 };
let BEAT_I = 0;

/* ---------- новые локации ---------- */
function shop(t, o = {}) {
  X.fillStyle = lg(0, 0, 0, 900, [[0, '#eef3f7'], [1, '#dfe7ee']]); X.fillRect(-1500, -800, 5000, 2000);
  for (let k = 0; k < 9; k++) { rr(-300 + k * 300, 40, 180, 16, 8, 'rgba(255,255,255,.95)'); glow(-210 + k * 300, 60, 160, 'rgba(255,255,255,.25)'); }
  rr(-1500, 905, 5000, 600, 0, '#cfd6de'); X.strokeStyle = 'rgba(0,0,0,.06)'; X.lineWidth = 3; for (let k = 0; k < 40; k++) { X.beginPath(); X.moveTo(-1500 + k * 140, 905); X.lineTo(-1700 + k * 170, 1500); X.stroke(); }
  const cols = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#e67e22', '#9b59b6', '#ecf0f1', '#1abc9c'], empty = o.empty || 0;
  for (let s = 0; s < 3; s++) { const x0 = -260 + s * 640; rr(x0, 230, 560, 640, 8, '#7d8a99'); rr(x0 + 12, 242, 536, 620, 4, '#f5f7f9');
    for (let r = 0; r < 5; r++) { rr(x0 + 12, 352 + r * 118, 536, 12, 2, '#9aa6b3'); rr(x0 + 40 + r * 70, 362 + r * 118, 64, 20, 3, '#fff36b');
      for (let i = 0; i < 9; i++) { if (hr(s * 50 + r * 9 + i) < empty) continue; const h = 60 + hr(i + r + s) * 34; rr(x0 + 22 + i * 58, 352 + r * 118 - h, 48, h, 5, cols[(i + r * 3 + s) % cols.length]); rr(x0 + 26 + i * 58, 352 + r * 118 - h + 12, 40, 10, 2, 'rgba(255,255,255,.55)'); } } }
  rr(1700, 260, 380, 620, 14, '#cfe8f7'); for (let k = 0; k < 3; k++) { rr(1716 + k * 120, 276, 110, 588, 8, 'rgba(255,255,255,.55)'); glow(1770 + k * 120, 560, 160, 'rgba(160,220,255,.35)'); }
  if (o.sign !== false) { rr(400, 120, 680, 80, 14, '#e8443a'); X.fillStyle = '#fff'; X.font = '900 52px Montserrat'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(o.sign || 'ПРОДУКТЫ 24', 740, 162); }
  if (o.cart) { const cx = o.cart; X.strokeStyle = '#5d6672'; X.lineWidth = 6; X.strokeRect(cx - 80, 820, 160, 90); X.beginPath(); X.moveTo(cx - 80, 820); X.lineTo(cx - 110, 790); X.stroke(); circ(cx - 60, 930, 14, '#2b2f3a'); circ(cx + 60, 930, 14, '#2b2f3a'); }
}
function park(t, o = {}) {
  const se = o.season || 'summer', night = o.night, sky = night ? [[0, '#0d1433'], [1, '#2a3166']] : se === 'winter' ? [[0, '#b9cbe0'], [1, '#e8eef5']] : se === 'autumn' ? [[0, '#9fb3c8'], [1, '#e7d9c4']] : [[0, '#5fb3f5'], [1, '#bfe6ff']];
  X.fillStyle = lg(0, -300, 0, 900, sky); X.fillRect(-1500, -800, 5000, 2200);
  if (!night) { circ(1500, 180, 70, se === 'winter' ? '#f4f6fa' : '#fff3b0'); glow(1500, 180, 400, 'rgba(255,240,180,.35)'); } else { circ(1500, 170, 50, '#f3f0dc'); for (let i = 0; i < 60; i++) circ(hr(i) * 3000 - 500, hr(i + 7) * 500 - 100, 2, 'rgba(255,255,255,.7)'); }
  for (let i = 0; i < 10; i++) { const w = 120 + hr(i) * 120, h = 200 + hr(i + 3) * 260, x = -600 + i * 330; rr(x, 760 - h, w, h, 0, night ? '#1b2142' : 'rgba(140,155,180,.6)'); if (night) windows(x + 8, 776 - h, w - 16, h - 40, 3, 6, .4, i); }
  const grass = se === 'winter' ? '#f2f5fa' : se === 'autumn' ? '#8a9a4a' : night ? '#1f3a2a' : '#6cc04a';
  X.fillStyle = grass; X.fillRect(-1500, 740, 5000, 900); X.fillStyle = se === 'winter' ? '#dfe6ef' : '#c9b08a'; X.beginPath(); X.moveTo(-1500, 1100); X.quadraticCurveTo(960, 820, 3500, 1100); X.lineTo(3500, 1300); X.quadraticCurveTo(960, 1000, -1500, 1300); X.fill();
  const leaf = se === 'autumn' ? ['#f39c12', '#e67e22', '#d35400'] : se === 'spring' ? ['#ffb6d0', '#ffd1e3', '#9be27a'] : se === 'winter' ? ['#ffffff', '#e8eef5'] : ['#3fa34d', '#5cbf5a', '#2e8b45'];
  for (const [tx, ts] of [[-100, 1.3], [420, 1.0], [1350, 1.15], [1900, 1.35], [2400, 1]]) { X.fillStyle = '#5b4030'; X.fillRect(tx - 14 * ts, 560, 28 * ts, 220); for (let k = 0; k < 7; k++) circ(tx + (hr(k + tx) - .5) * 200 * ts, 520 - hr(k + 3 + tx) * 160 * ts, (70 + hr(k + 9) * 40) * ts, leaf[k % leaf.length]); }
  rr(820, 860, 300, 22, 8, '#8a5d40'); rr(820, 820, 300, 16, 8, '#8a5d40'); X.fillStyle = '#4b5361'; X.fillRect(840, 882, 12, 60); X.fillRect(1088, 882, 12, 60);
  X.fillStyle = '#3a404b'; X.fillRect(1600, 420, 16, 520); rr(1570, 400, 76, 34, 10, '#3a404b'); if (night) glow(1608, 450, 300, 'rgba(255,214,140,.5)');
  if (se === 'autumn') for (let i = 0; i < 26; i++) { const f = (t * .15 + hr(i)) % 1; X.save(); X.translate(hr(i + 4) * 2400 - 200 + Math.sin(t + i) * 40, f * 1100 - 60); X.rotate(t * 2 + i); ell(0, 0, 9, 5, leaf[i % 3]); X.restore(); }
}
function lab(t, o = {}) {
  X.fillStyle = lg(0, 0, 0, 900, [[0, '#dff1f7'], [1, '#c6e2ec']]); X.fillRect(-1500, -800, 5000, 2000); X.fillStyle = '#9fb8c4'; X.fillRect(-1500, 900, 5000, 600);
  for (let k = 0; k < 6; k++) rr(-400 + k * 420, 70, 300, 18, 9, '#ffffff');
  rr(1180, 160, 560, 360, 14, '#1b2433'); rr(1196, 176, 528, 328, 8, '#0f2a3c');
  X.strokeStyle = '#3fd0ff'; X.lineWidth = 6; X.shadowColor = '#3fd0ff'; X.shadowBlur = 16; for (const ph of [0, Math.PI]) { X.beginPath(); for (let k = 0; k <= 60; k++) { const y = 200 + k * 4.8, x = 1460 + Math.sin(k * .25 + t * 2 + ph) * 90; k ? X.lineTo(x, y) : X.moveTo(x, y); } X.stroke(); } X.shadowBlur = 0;
  for (let k = 0; k < 12; k++) { const y = 210 + k * 24, a = Math.sin(k * .6 + t * 2) * 90; X.strokeStyle = 'rgba(255,90,140,.8)'; X.lineWidth = 4; X.beginPath(); X.moveTo(1460 - a, y); X.lineTo(1460 + a, y); X.stroke(); }
  if (o.screen) { X.fillStyle = '#ffd400'; X.font = '900 44px Montserrat'; X.textAlign = 'center'; X.fillText(o.screen, 1460, 480); }
  rr(-100, 700, 980, 30, 6, '#e9eef2'); X.fillStyle = '#8a97a5'; X.fillRect(-80, 730, 20, 180); X.fillRect(840, 730, 20, 180);
  const fl = ['#3fd0ff', '#7dff6b', '#ff5a8a', '#ffd400']; for (let k = 0; k < 4; k++) { const x = 40 + k * 120; X.fillStyle = 'rgba(255,255,255,.6)'; X.beginPath(); X.moveTo(x - 14, 600); X.lineTo(x + 14, 600); X.lineTo(x + 14, 640); X.lineTo(x + 40, 700); X.lineTo(x - 40, 700); X.lineTo(x - 14, 640); X.fill();
    X.fillStyle = fl[k]; X.beginPath(); X.moveTo(x - 26, 670); X.lineTo(x + 26, 670); X.lineTo(x + 40, 700); X.lineTo(x - 40, 700); X.fill(); glow(x, 680, 70, fl[k] + '55'); for (let b = 0; b < 3; b++) { const f = (t * .7 + b / 3 + k * .2) % 1; circ(x + Math.sin(b * 3 + t) * 8, 660 - f * 90, 5 * (1 - f), fl[k]); } }
  X.fillStyle = '#2b3445'; X.fillRect(640, 560, 24, 140); rr(600, 690, 110, 14, 6, '#2b3445'); rr(620, 520, 70, 50, 10, '#4a5568'); rr(650, 600, 70, 16, 6, '#4a5568');
}
function living(t, o = {}) {
  const night = o.night; X.fillStyle = lg(0, 0, 0, 900, night ? [[0, '#2a2f4a'], [1, '#1f2338']] : [[0, '#e9e1f2'], [1, '#d8cbe6']]); X.fillRect(-1500, -800, 5000, 2000);
  X.fillStyle = night ? '#1a1d2e' : '#a77a5a'; X.fillRect(-1500, 880, 5000, 600);
  rr(1100, 200, 640, 380, 16, '#14161c'); rr(1116, 216, 608, 348, 8, night ? '#1f6fb8' : '#2b7fd0'); glow(1420, 390, 520, 'rgba(90,170,255,.25)');
  if (o.tv) { rr(1116, 470, 608, 70, 0, '#e8443a'); X.fillStyle = '#fff'; fitText(o.tv, 570, 34); X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(o.tv, 1420, 506); rr(1136, 236, 120, 40, 6, '#e8443a'); X.font = '900 26px Montserrat'; X.fillText('LIVE', 1196, 257); }
  rr(1360, 580, 120, 14, 4, '#2b2f3a'); rr(1180, 620, 480, 260, 10, '#6b4a36'); rr(1196, 640, 448, 10, 2, '#5a3d2c');
  rr(-60, 640, 820, 200, 50, night ? '#3d3a6a' : '#e0674f'); rr(-60, 560, 820, 140, 50, night ? '#4a4680' : '#ec7d63'); rr(-90, 600, 90, 240, 40, night ? '#3d3a6a' : '#d55c45'); rr(740, 600, 90, 240, 40, night ? '#3d3a6a' : '#d55c45');
  rr(160, 220, 300, 200, 8, '#6b4a36'); rr(172, 232, 276, 176, 4, '#f3d7a0'); circ(310, 320, 50, '#e8754f');
  if (o.lamp !== false) { X.fillStyle = '#2b2f3a'; X.fillRect(920, 420, 10, 460); X.beginPath(); X.moveTo(870, 420); X.lineTo(980, 420); X.lineTo(950, 340); X.lineTo(900, 340); X.fillStyle = '#f2d398'; X.fill(); if (night) glow(925, 420, 260, 'rgba(255,210,140,.4)'); }
}
function hospital(t, o = {}) {
  X.fillStyle = lg(0, 0, 0, 900, [[0, '#e6f2f0'], [1, '#d3e6e3']]); X.fillRect(-1500, -800, 5000, 2000); X.fillStyle = '#b7cfcc'; X.fillRect(-1500, 900, 5000, 600); rr(-1500, 560, 5000, 14, 0, '#7fb8b0');
  for (let k = 0; k < 5; k++) rr(-300 + k * 500, 60, 320, 18, 9, '#ffffff');
  // томограф
  if (o.mri !== false) { X.save(); X.translate(o.mri || 1350, 560); rr(-260, -260, 520, 520, 120, '#f4f7f9'); circ(0, 0, 150, '#c9d6de'); circ(0, 0, 118, '#2b3445'); rr(-60, -250, 120, 22, 8, '#3fb3ff');
    rr(-500, 120, 760, 56, 20, '#e9eef2'); rr(-480, 176, 40, 160, 6, '#9aa6b3'); X.restore(); }
  rr(80, 300, 360, 220, 10, '#7fb8b0'); rr(96, 316, 328, 188, 6, '#bfe6ff'); X.fillStyle = '#e8443a'; X.fillRect(250, 330, 20, 70); X.fillRect(225, 355, 70, 20);
  if (o.sign) { rr(520, 140, 520, 80, 12, '#2b7fd0'); X.fillStyle = '#fff'; fitText(o.sign, 490, 42); X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(o.sign, 780, 181); }
}
function space(t, o = {}) {
  X.fillStyle = '#05070f'; X.fillRect(-1500, -800, 5000, 2400); for (let i = 0; i < 260; i++) { X.globalAlpha = .4 + .6 * hr(i + 2) * (.7 + .3 * Math.sin(t * 2 + i)); circ(hr(i) * 3600 - 800, hr(i + 9) * 1900 - 500, 1 + hr(i + 4) * 2, '#fff'); } X.globalAlpha = 1;
  const R = 1400, cx = 960, cy = 980 + R; X.save(); X.beginPath(); X.arc(cx, cy, R, 0, Math.PI * 2); X.clip(); X.fillStyle = lg(0, 980, 0, 1600, [[0, '#2f7fe0'], [1, '#0b2a6a']]); X.fillRect(-1000, 900, 4000, 2000);
  for (let i = 0; i < 14; i++) ell(cx - 1100 + i * 180 + (t * 6 % 180), 1050 + hr(i) * 120, 120 + hr(i + 2) * 120, 40, i % 3 ? 'rgba(80,170,90,.9)' : 'rgba(255,255,255,.55)'); X.restore();
  X.strokeStyle = 'rgba(120,190,255,.6)'; X.lineWidth = 18; X.shadowColor = '#5ab0ff'; X.shadowBlur = 40; X.beginPath(); X.arc(cx, cy, R + 6, Math.PI * 1.25, Math.PI * 1.75); X.stroke(); X.shadowBlur = 0;
}
function tvstudio(t, o = {}) {
  X.fillStyle = lg(0, 0, 0, 1080, [[0, '#0d1f45'], [1, '#081430']]); X.fillRect(-1500, -800, 5000, 2400);
  for (let k = 0; k < 9; k++) { rr(-200 + k * 260, 120, 200, 520, 10, 'rgba(60,120,220,.18)'); }
  rr(200, 160, 1520, 420, 18, '#102a5c'); X.fillStyle = 'rgba(80,160,255,.35)'; for (let k = 0; k < 9; k++) X.fillRect(200, 180 + k * 44, 1520, 2);
  if (o.screen) { X.fillStyle = '#fff'; fitText(o.screen, 1440, 80); X.textAlign = 'center'; X.textBaseline = 'middle'; X.shadowColor = '#5ab0ff'; X.shadowBlur = 30; X.fillText(o.screen, 960, 370); X.shadowBlur = 0; }
  rr(-1500, 900, 5000, 600, 0, '#0a1530'); rr(560, 720, 800, 200, 20, '#1f4fa8'); rr(560, 720, 800, 24, 10, '#5ab0ff');
  rr(-1500, 990, 5000, 70, 0, '#e8443a'); X.fillStyle = '#fff'; X.font = '900 40px Montserrat'; X.textAlign = 'left'; X.textBaseline = 'middle'; X.fillText(o.ticker || 'СРОЧНО', -((t * 180) % 2400) + 1500, 1026);
}
function gas(t, o = {}) {   // ночная заправка на трассе: навес со светом, колонки, неон, магазинчик
  X.fillStyle = lg(0, -300, 0, 900, [[0, '#070a1c'], [.7, '#1b1f45'], [1, '#2c2a55']]); X.fillRect(-1500, -800, 5000, 2200);
  for (let i = 0; i < 90; i++) circ(hr(i) * 3400 - 700, hr(i + 7) * 600 - 300, 1 + hr(i + 2) * 1.6, `rgba(255,255,255,${.3 + .5 * hr(i + 4)})`); circ(1650, 60, 46, '#f3f0dc'); glow(1650, 60, 200, 'rgba(240,240,220,.2)');
  X.fillStyle = '#121528'; X.beginPath(); X.moveTo(-1500, 700); for (let k = 0; k <= 20; k++) X.lineTo(-1500 + k * 250, 640 - hr(k) * 120); X.lineTo(3500, 760); X.lineTo(-1500, 760); X.fill();
  X.fillStyle = '#23263a'; X.fillRect(-1500, 740, 5000, 900); X.fillStyle = '#2f3350'; X.fillRect(-1500, 1000, 5000, 140); X.fillStyle = 'rgba(255,220,120,.5)'; for (let k = 0; k < 30; k++) X.fillRect(-1500 + k * 180 - (t * 40 % 180), 1066, 90, 8);
  rr(1100, 420, 700, 330, 6, '#e9e6df'); rr(1130, 470, 400, 220, 4, '#ffe9a8'); glow(1330, 580, 360, 'rgba(255,220,140,.4)'); rr(1580, 520, 140, 230, 4, '#bfe6ff'); rr(1100, 400, 700, 40, 4, '#e8443a');
  const fl = o.flicker !== false && Math.sin(t * 23) > .92 ? .35 : 1;
  X.fillStyle = '#c9ccd6'; X.fillRect(120, 250, 26, 520); X.fillRect(960, 250, 26, 520); rr(-40, 200, 1180, 70, 8, '#f4f4f4'); rr(-40, 262, 1180, 18, 4, '#e8443a');
  X.save(); X.globalAlpha = fl; for (let k = 0; k < 5; k++) { rr(40 + k * 220, 282, 140, 10, 5, '#fffbe0'); } X.fillStyle = `rgba(255,250,220,${.16 * fl})`; X.beginPath(); X.moveTo(-40, 290); X.lineTo(1140, 290); X.lineTo(1300, 1000); X.lineTo(-200, 1000); X.fill(); X.restore();
  for (const px of [330, 760]) { rr(px - 50, 560, 100, 200, 10, '#e8443a'); rr(px - 36, 580, 72, 60, 6, '#14161c'); X.fillStyle = '#4dff9b'; X.font = '900 26px Montserrat'; X.textAlign = 'center'; X.fillText('92', px, 620); rr(px + 50, 600, 16, 80, 6, '#2b2f3a'); }
  X.save(); X.translate(-260, 140); rr(0, 0, 200, 340, 12, '#14161c'); X.fillStyle = o.neon || '#4dff9b'; X.shadowColor = X.fillStyle; X.shadowBlur = 24 * fl; X.font = '900 56px Montserrat'; X.textAlign = 'center'; X.fillText('АЗС', 100, 80); X.font = '900 44px Montserrat'; X.fillText('24', 100, 140); X.shadowBlur = 0; X.fillStyle = '#ffd400'; X.font = '800 34px Inter'; X.fillText('92 · 95 · ДТ', 100, 220); X.restore(); X.fillStyle = '#14161c'; X.fillRect(-180, 480, 24, 300);
}
function school(t, o = {}) {   // класс: доска с мелом, окна, парты, часы, карта
  X.fillStyle = lg(0, 0, 0, 900, [[0, '#dff0e3'], [1, '#cfe5d5']]); X.fillRect(-1500, -800, 5000, 2000); X.fillStyle = '#b07a52'; X.fillRect(-1500, 900, 5000, 600); X.strokeStyle = 'rgba(0,0,0,.1)'; X.lineWidth = 3; for (let k = 0; k < 40; k++) { X.beginPath(); X.moveTo(-1500 + k * 140, 900); X.lineTo(-1500 + k * 140, 1500); X.stroke(); }
  rr(240, 150, 1000, 470, 10, '#6b4a36'); rr(260, 170, 960, 430, 6, '#2f5b45'); X.fillStyle = 'rgba(255,255,255,.08)'; X.fillRect(260, 170, 960, 430);
  X.fillStyle = '#f4f4ea'; X.textAlign = 'center'; X.textBaseline = 'middle'; fitText(o.board || '2 + 2 = ?', 880, 64, 800); X.font = X.font.replace('Montserrat', 'Inter'); X.fillText(o.board || '2 + 2 = ?', 740, 330); rr(600, 580, 280, 16, 4, '#d9c9a8'); rr(640, 572, 40, 10, 3, '#fff');
  for (const wx of [1380, 1720]) { rr(wx, 160, 260, 400, 8, '#f1f1ea'); X.fillStyle = lg(0, 170, 0, 550, [[0, '#8fd0ff'], [1, '#d8f1ff']]); X.fillRect(wx + 14, 174, 232, 372); X.fillStyle = '#f1f1ea'; X.fillRect(wx + 124, 174, 12, 372); ell(wx + 80, 470, 90, 30, '#7cc46a'); }
  circ(140, 200, 52, '#fff'); X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.arc(140, 200, 52, 0, Math.PI * 2); X.moveTo(140, 200); X.lineTo(140, 168); X.moveTo(140, 200); X.lineTo(162, 210); X.stroke();
  rr(-260, 220, 300, 200, 6, '#f5e6b8'); X.fillStyle = '#7fb3d6'; ell(-150, 300, 70, 40, '#7fb3d6'); ell(-60, 350, 50, 30, '#9cc98a');
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) { const x = -200 + k * 560 + r * 120, y = 760 + r * 90; rr(x, y, 300, 24, 6, '#c98f5a'); X.fillStyle = '#6b7280'; X.fillRect(x + 20, y + 24, 12, 110); X.fillRect(x + 268, y + 24, 12, 110); }
}
function elevator(t, o = {}) {   // кабина лифта: стальные стены, двери, табло этажа, кнопки
  X.fillStyle = lg(0, 0, 1920, 0, [[0, '#8e98a5'], [.5, '#c7ced6'], [1, '#8e98a5']]); X.fillRect(-1500, -800, 5000, 2000); X.strokeStyle = 'rgba(255,255,255,.18)'; X.lineWidth = 2; for (let k = 0; k < 120; k++) { X.beginPath(); X.moveTo(-1500 + k * 42, -800); X.lineTo(-1500 + k * 42, 1200); X.stroke(); }
  X.fillStyle = '#5b6470'; X.fillRect(-1500, 940, 5000, 600); rr(-1500, 30, 5000, 40, 0, '#f6f7f9'); glow(960, 50, 600, 'rgba(255,255,240,.35)');
  const op = clamp(o.open ?? 0, 0, 1), dw = 420 * (1 - op); rr(540, 200, 840, 740, 6, '#2b2f3a'); if (op > 0) { X.fillStyle = o.beyond || '#1a0f2e'; X.fillRect(560, 210, 800, 730); if (o.beyondGlow) glow(960, 560, 500, o.beyondGlow); }
  rr(540, 200, dw, 740, 4, '#b8c0ca'); rr(1380 - dw, 200, dw, 740, 4, '#b8c0ca'); X.strokeStyle = '#7d8794'; X.lineWidth = 4; X.strokeRect(540, 200, dw, 740); X.strokeRect(1380 - dw, 200, dw, 740);
  rr(760, 90, 400, 90, 12, '#14161c'); X.fillStyle = '#ff3b3b'; X.shadowColor = '#ff3b3b'; X.shadowBlur = 18; X.font = '900 64px Montserrat'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(o.floor ?? '1', 960, 136); X.shadowBlur = 0;
  rr(1500, 380, 120, 360, 12, '#d6dbe1'); for (let k = 0; k < 8; k++) { circ(1535 + (k % 2) * 50, 420 + Math.floor(k / 2) * 70, 18, k === 7 && o.red ? '#ff3b3b' : '#f4f6f8'); X.strokeStyle = '#8e98a5'; X.lineWidth = 3; X.beginPath(); X.arc(1535 + (k % 2) * 50, 420 + Math.floor(k / 2) * 70, 18, 0, Math.PI * 2); X.stroke(); }
}
function underground(t, o = {}) {   // подземный город на минус сотом этаже: пещера, неоновые башни, грибы-фонари, туман
  X.fillStyle = lg(0, -300, 0, 1000, [[0, '#06040f'], [.6, '#1b0f3a'], [1, '#2a1250']]); X.fillRect(-1500, -800, 5000, 2200);
  X.fillStyle = '#0a0716'; for (let k = 0; k < 30; k++) { const x = -1400 + k * 170; X.beginPath(); X.moveTo(x, -300); X.lineTo(x + 60, -60 + hr(k) * 220); X.lineTo(x + 120, -300); X.fill(); }
  for (let i = 0; i < 16; i++) { const w = 90 + hr(i) * 90, h = 240 + hr(i + 4) * 420, x = -500 + i * 190, c = ['#3fd0ff', '#ff3ba0', '#9b6bff', '#4dff9b'][i % 4]; rr(x, 760 - h, w, h, 6, '#140c2c'); X.fillStyle = c; X.globalAlpha = .75; for (let r = 0; r < h / 40 - 1; r++) for (let q = 0; q < 3; q++) if (hr(i * 9 + r * 3 + q) < .45) X.fillRect(x + 12 + q * (w - 24) / 3, 780 - h + r * 40, (w - 40) / 3, 14); X.globalAlpha = 1; glow(x + w / 2, 760 - h, 120, c + '44'); }
  X.fillStyle = '#120a24'; X.fillRect(-1500, 760, 5000, 800); X.fillStyle = '#1e1238'; X.beginPath(); X.moveTo(-1500, 900); X.quadraticCurveTo(960, 820, 3500, 900); X.lineTo(3500, 1400); X.lineTo(-1500, 1400); X.fill();
  for (const [mx, ms, mc] of [[120, 1, '#4dff9b'], [380, .7, '#3fd0ff'], [1580, 1.2, '#ff3ba0'], [1800, .8, '#9b6bff']]) { X.fillStyle = '#d9d2f0'; X.fillRect(mx - 8 * ms, 880 - 90 * ms, 16 * ms, 90 * ms); X.beginPath(); X.ellipse(mx, 880 - 90 * ms, 60 * ms, 34 * ms, 0, Math.PI, 0); X.fillStyle = mc; X.fill(); glow(mx, 860 - 90 * ms, 160 * ms, mc + '55'); }
  for (let i = 0; i < 40; i++) { const f = (t * .1 + hr(i)) % 1; X.globalAlpha = .6 * Math.sin(f * Math.PI); circ(hr(i + 3) * 2200 - 100, 900 - f * 700, 3, '#c9b8ff'); } X.globalAlpha = 1; fogBand(740, 960, 'rgba(160,120,255,.22)');
  if (o.sign) { rr(700, 360, 520, 90, 14, '#140c2c'); X.strokeStyle = '#ff3ba0'; X.lineWidth = 5; X.shadowColor = '#ff3ba0'; X.shadowBlur = 20; X.strokeRect(700, 360, 520, 90); X.fillStyle = '#ff3ba0'; fitText(o.sign, 480, 52); X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(o.sign, 960, 406); X.shadowBlur = 0; }
}
function retro(t, o = {}) {   // квартира 1985: обои, ковёр на стене, стенка с хрусталём, телевизор-ящик, дисковый телефон, календарь
  X.fillStyle = '#e8d9a8'; X.fillRect(-1500, -800, 5000, 2000); X.fillStyle = 'rgba(160,110,60,.18)'; for (let k = 0; k < 60; k++) for (let r = 0; r < 14; r++) { X.beginPath(); X.arc(-1500 + k * 80 + (r % 2) * 40, -200 + r * 80, 10, 0, Math.PI * 2); X.fill(); }
  X.fillStyle = '#a0623a'; X.fillRect(-1500, 900, 5000, 600); X.strokeStyle = 'rgba(0,0,0,.15)'; X.lineWidth = 4; for (let k = 0; k < 50; k++) { X.beginPath(); X.moveTo(-1500 + k * 100, 900); X.lineTo(-1500 + k * 100, 1500); X.stroke(); }
  rr(-120, 150, 620, 440, 10, '#9b1c2a'); X.strokeStyle = '#e8b04a'; X.lineWidth = 8; X.strokeRect(-100, 170, 580, 400); for (let k = 0; k < 5; k++) { X.save(); X.translate(190, 370); X.rotate(Math.PI / 4); X.strokeStyle = ['#e8b04a', '#1f3a6a', '#f4e6c8', '#e8b04a', '#1f3a6a'][k]; X.lineWidth = 10; X.strokeRect(-40 - k * 26, -40 - k * 26, 80 + k * 52, 80 + k * 52); X.restore(); }
  rr(1100, 120, 760, 780, 8, '#5a3420'); for (let k = 0; k < 3; k++) { rr(1130 + k * 245, 150, 220, 330, 4, 'rgba(200,230,255,.35)'); for (let g = 0; g < 4; g++) { X.fillStyle = 'rgba(255,255,255,.75)'; X.beginPath(); X.moveTo(1160 + k * 245 + g * 48, 460); X.lineTo(1175 + k * 245 + g * 48, 400); X.lineTo(1190 + k * 245 + g * 48, 460); X.fill(); } } rr(1130, 520, 710, 340, 4, '#6b4028');
  rr(600, 560, 400, 330, 8, '#7a5236'); rr(620, 340, 360, 280, 24, '#3a3a3a'); rr(645, 365, 250, 210, 30, o.tvOn === false ? '#2b3a2e' : '#6fa39a'); X.fillStyle = 'rgba(255,255,255,.12)'; for (let k = 0; k < 20; k++) X.fillRect(645, 365 + k * 11 + (t * 30 % 11), 250, 3); circ(935, 400, 14, '#bbb'); circ(935, 450, 14, '#bbb');
  rr(420, 760, 140, 60, 10, '#d23a2a'); circ(490, 770, 34, '#f4f4f4'); circ(490, 770, 12, '#d23a2a'); rr(430, 730, 120, 24, 12, '#d23a2a');
  rr(-380, 260, 180, 230, 4, '#fff'); rr(-380, 260, 180, 56, 4, '#d23a2a'); X.fillStyle = '#fff'; X.font = '900 36px Montserrat'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(o.year || '1985', -290, 289); X.fillStyle = INK; X.font = '900 90px Montserrat'; X.fillText(o.day || '7', -290, 400);
}
function beach(t, o = {}) {   // пляж: море, солнце, пальма, зонтик
  X.fillStyle = lg(0, -300, 0, 600, [[0, '#2f9bff'], [1, '#bfe9ff']]); X.fillRect(-1500, -800, 5000, 1500); circ(1500, 180, 90, '#fff3a0'); glow(1500, 180, 500, 'rgba(255,240,170,.5)');
  X.fillStyle = '#1e7fd6'; X.fillRect(-1500, 560, 5000, 260); for (let k = 0; k < 30; k++) { X.strokeStyle = 'rgba(255,255,255,.6)'; X.lineWidth = 4; X.beginPath(); const y = 600 + (k % 5) * 40, x = -1400 + k * 180 + Math.sin(t + k) * 30; X.moveTo(x, y); X.quadraticCurveTo(x + 40, y - 12, x + 80, y); X.stroke(); }
  X.fillStyle = '#f2d59a'; X.beginPath(); X.moveTo(-1500, 820); for (let k = 0; k <= 40; k++) X.lineTo(-1500 + k * 125, 800 + Math.sin(k + t * 2) * 10); X.lineTo(3500, 1600); X.lineTo(-1500, 1600); X.fill();
  X.strokeStyle = '#7a4a2a'; X.lineWidth = 26; X.beginPath(); X.moveTo(1700, 980); X.quadraticCurveTo(1660, 600, 1760, 340); X.stroke(); for (let k = 0; k < 6; k++) { X.save(); X.translate(1760, 340); X.rotate(-2.6 + k * .9 + Math.sin(t * 1.5) * .05); ell(110, 0, 130, 26, '#3fa34d'); X.restore(); }
  X.strokeStyle = '#4a4a4a'; X.lineWidth = 8; X.beginPath(); X.moveTo(300, 960); X.lineTo(330, 560); X.stroke(); X.beginPath(); X.arc(330, 580, 200, Math.PI, 0); X.fillStyle = '#ff5a5a'; X.fill(); for (let k = 0; k < 4; k++) { X.beginPath(); X.moveTo(330, 380); X.lineTo(130 + k * 100, 580); X.lineTo(180 + k * 100, 580); X.fillStyle = k % 2 ? '#fff' : '#ff5a5a'; X.fill(); }
}
function paper(t, o = {}) {   // «мир-набросок»: лист в клетку, линии карандашом, огромный карандаш
  X.fillStyle = '#fbf6e9'; X.fillRect(-1500, -800, 5000, 2400); X.strokeStyle = 'rgba(80,140,220,.25)'; X.lineWidth = 2; for (let k = -40; k < 80; k++) { X.beginPath(); X.moveTo(-1500, k * 40); X.lineTo(3500, k * 40); X.stroke(); X.beginPath(); X.moveTo(-1500 + k * 40 + 1500, -800); X.lineTo(-1500 + k * 40 + 1500, 1600); X.stroke(); }
  X.strokeStyle = 'rgba(240,80,80,.5)'; X.lineWidth = 3; X.beginPath(); X.moveTo(140, -800); X.lineTo(140, 1600); X.stroke();
  X.strokeStyle = 'rgba(40,40,60,.55)'; X.lineWidth = 4; X.lineJoin = 'round'; const sk = (pts) => { X.beginPath(); pts.forEach(([x, y], i) => i ? X.lineTo(x + Math.sin(i * 7 + t * 3) * 2, y) : X.moveTo(x, y)); X.stroke(); };
  sk([[300, 900], [300, 560], [500, 420], [700, 560], [700, 900]]); sk([[420, 900], [420, 740], [520, 740], [520, 900]]); sk([[1300, 900], [1300, 380], [1500, 380], [1500, 900]]); sk([[1340, 440], [1400, 440], [1400, 500], [1340, 500], [1340, 440]]); sk([[-400, 960], [2400, 960]]);
  if (o.pencil !== false) { const py = 200 + Math.sin(t * 1.6) * 60, px = 1650 + Math.cos(t * 1.1) * 80; X.save(); X.translate(px, py); X.rotate(.6); rr(-24, -360, 48, 300, 4, '#ffcf3a'); rr(-24, -400, 48, 40, 6, '#ff8fa3'); rr(-24, -60, 48, 20, 2, '#c9c9c9'); X.fillStyle = '#e9c49a'; X.beginPath(); X.moveTo(-24, -40); X.lineTo(24, -40); X.lineTo(0, 30); X.fill(); X.fillStyle = '#333'; X.beginPath(); X.moveTo(-8, 6); X.lineTo(8, 6); X.lineTo(0, 30); X.fill(); X.restore(); }
}
function bathroom(t, o = {}) {   // ванная: плитка, душ с лейкой, вода (o.water), пар (o.hot), шторка, зеркало
  X.fillStyle = '#dcefff'; X.fillRect(-1500, -800, 5000, 2000); X.strokeStyle = 'rgba(80,140,190,.25)'; X.lineWidth = 3; for (let k = -30; k < 60; k++) { X.beginPath(); X.moveTo(-1500 + k * 90, -800); X.lineTo(-1500 + k * 90, 1200); X.stroke(); } for (let k = -10; k < 25; k++) { X.beginPath(); X.moveTo(-1500, k * 90); X.lineTo(3500, k * 90); X.stroke(); }
  X.fillStyle = '#b9d3e6'; X.fillRect(-1500, 900, 5000, 600);
  X.strokeStyle = '#9aa6b3'; X.lineWidth = 16; X.lineCap = 'round'; X.beginPath(); X.moveTo(1180, 900); X.lineTo(1180, 160); X.quadraticCurveTo(1180, 110, 1120, 110); X.lineTo(1010, 110); X.stroke();
  X.save(); X.translate(990, 130); X.rotate(.15); rr(-70, -10, 140, 40, 18, '#c9d2dc'); X.restore(); rr(1150, 560, 60, 50, 10, '#3fb3ff'); rr(1150, 620, 60, 50, 10, '#ff5a5a');
  if (o.water !== false) { X.strokeStyle = o.hot ? 'rgba(255,255,255,.6)' : 'rgba(120,200,255,.75)'; X.lineWidth = 4; for (let k = 0; k < 26; k++) { const x0 = 930 + (k % 13) * 10 - 60, f = (t * 3 + k / 26) % 1; X.beginPath(); X.moveTo(x0 + (x0 - 990) * f * .4, 160 + f * 760); X.lineTo(x0 + (x0 - 990) * (f + .06) * .4, 160 + (f + .06) * 760); X.stroke(); } }
  if (o.hot) for (let k = 0; k < 8; k++) { const f = (t * .3 + k / 8) % 1; X.fillStyle = `rgba(255,255,255,${.35 * (1 - f)})`; circ(900 + Math.sin(k + t) * 160, 800 - f * 600, 80 + f * 60, X.fillStyle); }
  rr(380, 860, 1200, 80, 30, '#ffffff'); rr(380, 860, 1200, 18, 9, '#e6edf3');
  X.fillStyle = 'rgba(255,140,170,.85)'; for (let k = 0; k < 6; k++) { X.beginPath(); X.moveTo(300 + k * 40, 80); X.quadraticCurveTo(320 + k * 40, 480, 290 + k * 40, 860); X.lineTo(330 + k * 40, 860); X.quadraticCurveTo(360 + k * 40, 480, 340 + k * 40, 80); X.fill(); } rr(260, 70, 1000, 12, 6, '#9aa6b3');
  rr(1450, 220, 260, 340, 20, '#9aa6b3'); rr(1466, 236, 228, 308, 14, o.hot ? '#e8eef3' : '#cfe8f7');
}
function fxDraw(fx, u, t) {   // эффекты поверх кадра (экранные координаты 1920×1080)
  for (const f of [].concat(fx)) {
    if (f === 'pause' || f === 'sepia' || f === 'gray') { X.globalCompositeOperation = 'saturation'; X.fillStyle = '#808080'; X.fillRect(0, 0, 1920, 1080); X.globalCompositeOperation = 'source-over'; }
    if (f === 'sepia') { X.globalCompositeOperation = 'color'; X.fillStyle = 'rgba(176,132,72,.75)'; X.fillRect(0, 0, 1920, 1080); X.globalCompositeOperation = 'source-over'; for (let i = 0; i < 300; i++) { X.fillStyle = `rgba(60,40,20,${hr(i + Math.floor(t * 12)) * .25})`; X.fillRect(hr(i * 3 + Math.floor(t * 12)) * 1920, hr(i * 7 + Math.floor(t * 12)) * 1080, 2, 2); } X.fillStyle = rg(960, 540, 1100, [[.5, 'rgba(0,0,0,0)'], [1, 'rgba(60,35,10,.55)']]); X.fillRect(0, 0, 1920, 1080); }
    if (f === 'pause') { X.fillStyle = 'rgba(20,24,40,.18)'; X.fillRect(0, 0, 1920, 1080); rr(1700, 70, 34, 110, 8, '#fff'); rr(1760, 70, 34, 110, 8, '#fff'); SMALL('ПАУЗА', 1747, 220, 40, '#fff'); }
    if (f === 'rewind') { X.fillStyle = 'rgba(40,80,200,.15)'; X.fillRect(0, 0, 1920, 1080); for (let k = 0; k < 6; k++) { const y = (hr(k + Math.floor(t * 20)) * 1080); X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(0, y, 1920, 6 + hr(k) * 14); } BIG('◀◀', 1740, 130, 110, '#fff'); }
    if (f === 'forward') { BIG('▶▶', 1740, 130, 110, '#fff'); }
    if (f === 'flash') { const a = 1 - prog(u, 0, .22); if (a > 0) { X.fillStyle = `rgba(255,255,255,${a})`; X.fillRect(0, 0, 1920, 1080); } }
    if (f === 'glitch') { if (Math.sin(t * 17) > .3) for (let k = 0; k < 7; k++) { const y = hr(k + Math.floor(t * 9)) * 1000, h = 20 + hr(k * 3) * 60, dx = (hr(k * 5 + Math.floor(t * 9)) - .5) * 80; X.drawImage(out, 0, y * K, W, h * K, dx, y, 1920, h); } }
    if (f === 'dream') { X.fillStyle = rg(960, 540, 1100, [[.3, 'rgba(0,0,0,0)'], [1, 'rgba(120,60,200,.55)']]); X.fillRect(0, 0, 1920, 1080); for (let i = 0; i < 30; i++) { X.globalAlpha = .4 + .4 * Math.sin(t * 2 + i); circ(hr(i) * 1920, hr(i + 5) * 1080, 3 + hr(i + 2) * 4, '#fff'); } X.globalAlpha = 1; }
    if (f === 'rec') { circ(90, 90, 18, Math.sin(t * 6) > 0 ? '#ff3b3b' : 'rgba(255,59,59,.3)'); SMALL('REC', 160, 92, 38, '#fff'); }
  }
}
function snow(t, n = 220) { X.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < n; i++) { const x = (hr(i) * 2600 - 300 + Math.sin(t + i) * 30 + t * 20) % 2600 - 300, y = (hr(i + 9) * 1400 + t * (80 + hr(i + 3) * 80)) % 1400 - 200; circ(x, y, 2 + hr(i + 5) * 3, 'rgba(255,255,255,.9)'); } }
const LOCS = { none: () => {}, bathroom, gas, school, elevator, underground, retro, beach, paper, street: (t, o) => street(t, o), bedroom: bedroom, kitchen: kitchen, office: office, rooftop: rooftop, shop, park, lab, living, hospital, space, tvstudio, info: (t, o) => infoBg(t, o.col) };

/* ---------- инфографика ---------- */
const fitText = (txt, maxW, size, weight = 900) => { let px = size; X.font = `${weight} ${px}px Montserrat`; while (px > 14 && X.measureText(txt).width > maxW) { px -= 2; X.font = `${weight} ${px}px Montserrat`; } return px; };
const nf = n => Math.round(n).toLocaleString('ru-RU').replace(/\s/g, ' ');
function info(I, u, t) {
  if (I.kind === 'xray') return xray(I, u, t);
  const col = I.col || '#ffd400', k = eo(prog(u, .05, .55));
  if (I.over) { X.fillStyle = `rgba(8,12,28,${.7 * prog(u, 0, .12)})`; X.fillRect(-2000, -1200, 6000, 3600); }
  if (I.kind === 'big') { BIG(I.text, 960, I.sub ? 470 : 540, I.size || 150, col, prog(u, 0, .15)); if (I.sub) SMALL(I.sub, 960, 640, 48, '#fff', prog(u, .2, .35)); }
  if (I.kind === 'count') { BIG(nf(lerp(I.from || 0, I.to, k)) + (I.suffix || ''), 960, 470, I.size || 140, col, prog(u, 0, .1)); if (I.sub) SMALL(I.sub, 960, 640, 48, '#fff', prog(u, .3, .45)); }
  if (I.kind === 'pie') { const cx = 960, cy = 470, r = 230; circ(cx, cy, r, 'rgba(255,255,255,.1)'); X.beginPath(); X.moveTo(cx, cy); X.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * I.pct / 100 * k); X.closePath(); X.fillStyle = col; X.shadowColor = col; X.shadowBlur = 30; X.fill(); X.shadowBlur = 0;
    BIG(Math.round(I.pct * k) + '%', cx, cy, 120, '#fff', prog(u, .05, .2)); if (I.sub) SMALL(I.sub, 960, 790, 48, '#fff', prog(u, .35, .5)); }
  if (I.kind === 'bar') { rr(260, 560, 1400, 70, 35, 'rgba(255,255,255,.12)'); rr(260, 560, 1400 * I.pct / 100 * k, 70, 35, col); BIG(I.big || Math.round(I.pct * k) + '%', 960, 400, 140, col, prog(u, .05, .2)); if (I.sub) SMALL(I.sub, 960, 730, 48, '#fff', prog(u, .3, .45)); }
  if (I.kind === 'vs') { const m = Math.max(I.a[1], I.b[1]); [[I.a, '#3fb3ff', 420], [I.b, col, 640]].forEach(([[lab, v, txt], c, y], j) => { SMALL(lab, 420, y - 50, 44, '#fff', prog(u, j * .15, j * .15 + .15)); rr(420, y, 1100 * v / m * eo(prog(u, .1 + j * .15, .6 + j * .15)), 80, 16, c); SMALL(txt || nf(v), 420 + 1100 * v / m * eo(prog(u, .1 + j * .15, .6 + j * .15)) + 120, y + 40, 46, c, prog(u, .3 + j * .15, .5 + j * .15)); });
    X.textAlign = 'left'; if (I.title) BIG(I.title, 960, 230, 90, '#fff', prog(u, 0, .1)); }
  if (I.kind === 'people') { const n = I.n || 100, on = I.on, cols = 20, sz = 62; for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols), x = 960 - cols * sz / 2 + c * sz + sz / 2, y = 330 + r * 80, lit = i < on * k;
      X.globalAlpha = prog(u, i / n * .4, i / n * .4 + .05); circ(x, y - 18, 14, lit ? col : 'rgba(255,255,255,.25)'); rr(x - 13, y - 2, 26, 34, 8, lit ? col : 'rgba(255,255,255,.25)'); } X.globalAlpha = 1;
    BIG(I.big || `${I.on} из ${n}`, 960, 190, 110, col, prog(u, .1, .25)); if (I.sub) SMALL(I.sub, 960, 330 + Math.ceil(n / cols) * 80 + 40, 46, '#fff', prog(u, .4, .55)); }
}
// «рентген»: светящийся силуэт героя, внутри — органы; state: good (зелёный) / warn (жёлтый) / bad (красный, пульсирует)
const ORGANS = {
  brain: (c) => { ell(0, -470, 70, 52, c); X.strokeStyle = 'rgba(0,0,0,.35)'; X.lineWidth = 4; for (let k = -2; k <= 2; k++) { X.beginPath(); X.arc(k * 22, -470, 30, .5, 2.6); X.stroke(); } },
  eyes: (c) => { ell(-30, -430, 18, 12, c); ell(30, -430, 18, 12, c); },
  teeth: (c) => { for (let k = -3; k <= 3; k++) rr(k * 13 - 5, -398, 11, 16, 3, c); },
  heart: (c, t) => { const p = 1 + Math.sin(t * 7) * .08; X.save(); X.translate(-22, -250); X.scale(p, p); X.fillStyle = c; X.beginPath(); X.moveTo(0, 40); X.bezierCurveTo(-60, 0, -40, -50, 0, -22); X.bezierCurveTo(40, -50, 60, 0, 0, 40); X.fill(); X.restore(); },
  lungs: (c) => { ell(-58, -250, 38, 70, c, .1); ell(58, -250, 38, 70, c, -.1); },
  stomach: (c) => { ell(-30, -150, 50, 36, c, -.4); },
  liver: (c) => { ell(40, -170, 60, 30, c, .2); },
  spine: (c) => { for (let k = 0; k < 11; k++) rr(-10, -360 + k * 30, 20, 22, 6, c); },
  muscles: (c) => { ell(-95, -200, 22, 60, c); ell(95, -200, 22, 60, c); ell(-45, 40, 26, 80, c); ell(45, 40, 26, 80, c); },
  blood: (c, t) => { for (let k = 0; k < 14; k++) { const f = (t * .6 + k / 14) % 1; circ(Math.sin(k * 2.1) * 60, -330 + f * 420, 7, c); } },
  skin: (c) => { X.strokeStyle = c; X.lineWidth = 10; X.beginPath(); X.arc(0, -440, 66, 0, Math.PI * 2); X.stroke(); },
};
function xray(I, u, t) {
  X.fillStyle = lg(0, 0, 0, 1080, [[0, '#04142a'], [1, '#020a16']]); X.fillRect(-1500, -800, 5000, 2400);
  X.strokeStyle = 'rgba(80,200,255,.08)'; X.lineWidth = 2; for (let k = -10; k < 40; k++) { X.beginPath(); X.moveTo(k * 60, -800); X.lineTo(k * 60, 1600); X.stroke(); X.beginPath(); X.moveTo(-1500, k * 60); X.lineTo(3500, k * 60); X.stroke(); }
  const sx = I.x ?? 620, sy = 860, sc = I.s ?? 1.25, scan = (t * .35) % 1;
  X.save(); X.translate(sx, sy); X.scale(sc, sc);
  X.strokeStyle = 'rgba(120,220,255,.9)'; X.shadowColor = '#5ad0ff'; X.shadowBlur = 24; X.lineWidth = 6; X.lineCap = 'round';
  const ta = (I.tilt || 0) * Math.PI / 180 * eo(prog(u, .1, .4)), hx = Math.sin(ta) * 120, hy = (1 - Math.cos(ta)) * 120;   // наклон головы вперёд
  X.beginPath(); X.arc(hx, -440 + hy, 66, 0, Math.PI * 2); X.stroke(); X.beginPath(); X.moveTo(0, -362); X.lineTo(hx * .75, -374 + hy * .8); X.stroke();
  X.beginPath(); X.moveTo(-70, -360); X.lineTo(70, -360); X.lineTo(80, -90); X.lineTo(-80, -90); X.closePath(); X.stroke();
  for (const sgn of [-1, 1]) { X.beginPath(); X.moveTo(sgn * 70, -350); X.lineTo(sgn * 120, -220); X.lineTo(sgn * 130, -90); X.stroke(); X.beginPath(); X.moveTo(sgn * 40, -90); X.lineTo(sgn * 50, 60); X.lineTo(sgn * 52, 200); X.stroke(); }
  X.shadowBlur = 0;
  const col = { good: '#4dff9b', warn: '#ffd400', bad: '#ff3b4a' }[I.state || 'bad'], pulse = .55 + .45 * Math.abs(Math.sin(t * (I.state === 'good' ? 2 : 5)));
  X.globalAlpha = (I.state === 'good' ? .9 : pulse) * prog(u, .05, .25); X.shadowColor = col; X.shadowBlur = 40;
  for (const o of [].concat(I.organs || 'heart')) { const head = ['brain', 'eyes', 'teeth', 'skin'].includes(o); if (head) { X.save(); X.translate(hx, hy); } (ORGANS[o] || ORGANS.heart)(col, t); if (head) X.restore(); }
  if (I.tilt) { X.save(); X.rotate(0); BIG(`${I.tilt}°`, hx + 150, -520 + hy, 60, col, prog(u, .2, .35)); X.restore(); }
  X.shadowBlur = 0; X.globalAlpha = 1;
  X.fillStyle = 'rgba(120,220,255,.18)'; X.fillRect(-200, -560 + scan * 820, 400, 10);
  X.restore();
  if (I.text) BIG(I.text, 1320, I.sub ? 440 : 520, I.size || 110, col, prog(u, .15, .3));
  if (I.sub) SMALL(I.sub, 1320, 600, 44, '#fff', prog(u, .3, .45));
  SMALL('РЕНТГЕН', 160, 70, 34, '#5ad0ff');
}
function propDraw(p, u, t) {
  if (p.kind === 'sign') { X.save(); X.translate(p.x, p.y); X.rotate(p.rot || 0); X.font = `900 ${p.size || 46}px Montserrat`; const w = X.measureText(p.text).width + 50; rr(-w / 2, -40, w, 80, 12, p.bg || '#fff'); X.strokeStyle = INK; X.lineWidth = 5; X.beginPath(); X.roundRect(-w / 2, -40, w, 80, 12); X.stroke(); X.fillStyle = p.col || INK; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(p.text, 0, 2); X.restore(); }
  if (p.kind === 'arrow') { const k = eo(prog(u, p.at || .2, (p.at || .2) + .2)); if (k <= 0) return; X.save(); X.translate(p.x, p.y); X.rotate(p.rot || 0); X.scale(k, k); X.fillStyle = p.col || '#ff2d4a'; X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.moveTo(-120, -18); X.lineTo(30, -18); X.lineTo(30, -50); X.lineTo(110, 0); X.lineTo(30, 50); X.lineTo(30, 18); X.lineTo(-120, 18); X.closePath(); X.fill(); X.stroke(); X.restore(); }
  if (p.kind === 'clock') { const a = t * (p.fast || 1); circ(p.x, p.y, 80, '#fff'); X.strokeStyle = INK; X.lineWidth = 7; X.beginPath(); X.arc(p.x, p.y, 80, 0, Math.PI * 2); X.moveTo(p.x, p.y); X.lineTo(p.x + Math.sin(a / 12) * 42, p.y - Math.cos(a / 12) * 42); X.moveTo(p.x, p.y); X.lineTo(p.x + Math.sin(a) * 64, p.y - Math.cos(a) * 64); X.stroke(); }
  if (p.kind === 'text') SMALL(p.text, p.x, p.y, p.size || 44, p.col || '#fff', prog(u, p.at || 0, (p.at || 0) + .15));
  if (p.kind === 'stack') { for (let i = 0; i < (p.n || 6); i++) rr(p.x - 60 + (hr(i) - .5) * 10, p.y - i * 26, 120, 22, 4, p.col || '#5fbf5a'); }
  if (p.kind === 'poof') { const k = prog(u, p.at || 0, (p.at || 0) + .3); if (k > 0 && k < 1) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; circ(p.x + Math.cos(a) * 140 * eo(k), p.y + Math.sin(a) * 100 * eo(k), 46 * (1 - k) + 6, `rgba(255,255,255,${.9 * (1 - k)})`); } if (k > 0 && k < .5) glow(p.x, p.y, 260, 'rgba(160,220,255,.6)'); }
  if (p.kind === 'portal') { X.save(); X.translate(p.x, p.y); const r = (p.r || 180) * eo(prog(u, p.at || 0, (p.at || 0) + .3)); for (let k = 0; k < 6; k++) { X.rotate(t * 1.5); X.strokeStyle = ['#9b6bff', '#3fd0ff', '#ff3ba0'][k % 3]; X.lineWidth = 14; X.beginPath(); X.ellipse(0, 0, r * (1 - k * .12), r * 1.3 * (1 - k * .12), 0, k, k + 4.2); X.stroke(); } glow(0, 0, r * 1.6, 'rgba(160,120,255,.5)'); X.restore(); }
  if (p.kind === 'photo') { X.save(); X.translate(p.x, p.y); X.rotate(p.rot || 0); const w = p.w || 360, h = p.h || 260; rr(-w / 2 - 16, -h / 2 - 16, w + 32, h + 60, 6, '#fbfbf6'); X.save(); X.beginPath(); X.rect(-w / 2, -h / 2, w, h); X.clip();
    const sc = p.scene || 'beach'; if (sc === 'beach') { X.fillStyle = '#5fb3f5'; X.fillRect(-w / 2, -h / 2, w, h); X.fillStyle = '#1e7fd6'; X.fillRect(-w / 2, 0, w, h / 4); X.fillStyle = '#f2d59a'; X.fillRect(-w / 2, h / 4, w, h / 4); circ(w / 3, -h / 4, 26, '#fff3a0'); } else if (sc === 'old') { X.fillStyle = '#b89a6a'; X.fillRect(-w / 2, -h / 2, w, h); X.fillStyle = '#8a6e45'; X.fillRect(-w / 2, h / 6, w, h); circ(-w / 5, -10, 22, '#3a2a18'); rr(-w / 5 - 18, 12, 36, 60, 8, '#5a4428'); circ(w / 6, -4, 20, '#3a2a18'); rr(w / 6 - 16, 16, 32, 56, 8, '#6b5030'); } else { X.fillStyle = '#ffd1e3'; X.fillRect(-w / 2, -h / 2, w, h); circ(0, 0, 40, INK); }
    X.restore(); if (p.label) { X.fillStyle = '#333'; X.font = '700 26px Inter'; X.textAlign = 'center'; X.fillText(p.label, 0, h / 2 + 30); } X.restore(); }
  if (p.kind === 'car') { const x = p.x + (p.v || 0) * u; X.save(); X.translate(x, p.y); X.scale(p.dir || 1, 1); rr(-170, -120, 340, 80, 26, p.col || '#e8443a'); rr(-100, -175, 200, 70, 22, p.col || '#e8443a'); rr(-84, -162, 76, 50, 8, '#bfe6ff'); rr(8, -162, 76, 50, 8, '#bfe6ff'); circ(-100, -36, 34, '#14161c'); circ(100, -36, 34, '#14161c'); circ(-100, -36, 13, '#8a939f'); circ(100, -36, 13, '#8a939f'); X.restore(); }
}

/* ---------- камера ---------- */
function headPoint(c) { const s = c.s || 1.15; return [c.x, c.y - 300 * s]; }
function camFor(S, u, cast, spk) {
  if (Array.isArray(S.cam)) return cam(u, S.cam);
  const auto = ['wide', 'close', 'push', 'two', 'pan', 'close', 'pull'], m = S.cam || (S.loc === 'info' ? 'still' : auto[BEAT_I % auto.length]);
  const f = cast[S.focus ?? Math.max(0, spk)] || cast[0], [hx, hy] = f ? headPoint(f) : [960, 540];
  const two = cast.length > 1 ? [(cast[0].x + cast[1].x) / 2, Math.min(headPoint(cast[0])[1], headPoint(cast[1])[1]) + 150] : [hx, hy + 120];
  switch (cast.length < 2 && m === 'two' ? 'push' : m) {
    case 'still': return cam(u, [[0, 960, 540, 1.0], [1, 960, 540, 1.04]]);
    case 'close': return cam(u, [[0, hx, hy + 170, 1.5], [1, hx, hy + 160, 1.62]]);
    case 'two': return cam(u, [[0, two[0], two[1], 1.4], [1, two[0], two[1] - 10, 1.48]]);
    case 'push': return cam(u, [[0, lerp(960, hx, .4), 560, 1.05], [1, hx, hy + 140, 1.45]]);
    case 'pull': return cam(u, [[0, hx, hy + 100, 1.6], [1, 960, 560, 1.02]]);
    case 'pan': return cam(u, [[0, 760, 560, 1.12], [1, 1160, 560, 1.12]]);
    case 'tilt': return cam(u, [[0, 960, 260, 1.15], [1, 960, 600, 1.05]]);
    default: return cam(u, [[0, 960, 560, 1.0], [1, 960, 550, 1.07]]);
  }
}

/* ---------- универсальная сцена ---------- */
T2.scene = (u, S, t, d) => {
  const tb = u * d, b = EP.beats[BEAT_I] || {}, spkWho = b.voice || 'hero', g = GROUND[S.loc] ?? 980, n = (S.cast || []).length;
  const xs = n === 1 ? [960] : n === 2 ? [720, 1200] : n === 3 ? [520, 960, 1400] : [...Array(n)].map((_, i) => 360 + i * 1200 / Math.max(1, n - 1));
  const cast = (S.cast || []).map((c, i) => { const base = CAST[c.who] || CAST.man, s = c.s ?? (S.loc === 'info' ? 1.1 : 1.15); let x = c.x ?? xs[i];
    if (c.walk) x = lerp(c.walk[0], c.walk[1], sm(prog(u, c.walkAt?.[0] ?? 0, c.walkAt?.[1] ?? .75)));
    const dir = c.dir ?? (c.walk ? Math.sign(c.walk[1] - c.walk[0]) || 1 : x < 960 ? 1 : -1);
    const p = { ...base, ...c, x, y: c.y ?? g, s, dir };
    if (S.season === 'winter' && !p.hat && p.hat !== false) { p.hat = 'beanie'; p.hatCol = p.hatCol || shade(p.top, -.1).replace('rgb', 'rgb'); p.scarf = p.scarf || '#e8443a'; }
    if (S.weather === 'rain' && c.umbrella) p.hold = 'umbrella';
    if ((c.act === 'bedsit' || c.act === 'stretch') && S.loc === 'bedroom' && c.y == null) { p.y = 800; if (c.x == null) p.x = 420; p.noShadow = true; }   // сидит на кровати, а не на полу
    if (c.float) { const fa = c.floatAt ?? 0; p.y -= (c.float === true ? 220 : c.float) * sm(prog(u, fa, fa + .35)) - Math.sin(t * 2 + i) * 12 * prog(u, fa, fa + .35); if (!c.act && !c.acts) p.act = 'float'; }
    const moving = c.walk && u > (c.walkAt?.[0] ?? 0) && u < (c.walkAt?.[1] ?? .75);
    if (moving) p.act = c.run ? 'run' : 'walk', p.acts = null;
    else if (!c.act && !c.acts) p.act = c.who === spkWho ? 'talk' : 'idle';
    return p; });
  const spk = cast.findIndex(c => c.who === spkWho);
  camSet(camFor(S, u, cast, spk));
  (LOCS[S.loc] || LOCS.info)(t, { ...(S.o || {}), night: S.time === 'night' || S.o?.night, season: S.season });
  if (S.time === 'night' && !['bedroom', 'living', 'park', 'space', 'info', 'tvstudio', 'gas', 'underground', 'elevator', 'paper'].includes(S.loc)) { X.fillStyle = 'rgba(10,16,48,.55)'; X.fillRect(-2000, -1200, 6000, 3600); }
  if (S.time === 'sunset') { X.fillStyle = 'rgba(255,120,60,.14)'; X.fillRect(-2000, -1200, 6000, 3600); }
  (S.props || []).filter(p => !p.front).forEach(p => propDraw(p, u, t));
  const order = cast.map((c, i) => i).sort((a, b2) => cast[a].y - cast[b2].y);
  for (const i of order) { const c = cast[i]; if (c.ghost) X.globalAlpha = c.ghost; guy(c, t, tb); X.globalAlpha = 1; if (c.tag) tag(c.x, headTop(c), c.tag[0], c.tag[1] || '#4dff9b', prog(u, c.tagAt ?? .1, (c.tagAt ?? .1) + .2), c.tag[2] || 44); }
  if (S.weather === 'rain') rain(t); if (S.weather === 'snow') snow(t);
  (S.props || []).filter(p => p.front).forEach(p => propDraw(p, u, t));
  if (S.fx) { X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.scale(K, K); fxDraw(S.fx, u, t); X.restore(); }
  if (S.info) { if (S.info.over) X.setTransform(1, 0, 0, 1, 0, 0), X.scale(K, K); info(S.info, S.info.over ? prog(u, S.info.at ?? .3, 1) : u, t); }
};
