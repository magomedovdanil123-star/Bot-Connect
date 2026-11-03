/* «Сколько нужно?» — движок плоского стиля (engine: 'flat' в сценарии). Та же связка, что у world.js: window.grab(f) → jpeg, window.READY, EP.beats[i].shot → S2[shot].
 * Плашки с цифрами, главы, субтитры и рамка — те же, что в 3D (блок UI скопирован из world.js). */
const EP = window.EP, PH = EP.PH, FPS = EP.fps || 24, W = EP.w || 1920, H = EP.h || 1080;
const out = document.getElementById('out'), X = out.getContext('2d');
/* «Сколько нужно?» — плоский стиль: живые человечки (чёрная голова, светлая обводка, цветная одежда), тёмные уютные локации, пыль в свете.
 * Персонажи свои: Толик — жёлтая каска, синий комбинезон; Друг — оранжевое худи. Рисуем Canvas 2D кадр за кадром (детерминированно по времени).
 * Этот файл — сцены и персонажи; плашки с цифрами и субтитры подклеиваются из world.js (engine/flat.js собирается рендером). */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, sm = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const eo = k => 1 - (1 - clamp(k, 0, 1)) ** 3, ei = k => clamp(k, 0, 1) ** 3, prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const hrand = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const INK = '#0b0b10', RIM = 'rgba(214,232,255,.9)', BAL = ['#ff4d6a', '#ffb02e', '#3ee08f', '#38a6ff', '#a98bff', '#ff8fb1', '#ffd400', '#ff6b3d'];

// ---------- камера: мир 1920×1080, cam = { x, y, z } — центр кадра и зум
const K = W / 1920; let PZ = 1;   // мир всегда 1920×1080, кадр любого размера; PZ — наезд на склейке
function camSet(c) { const z = c.z * K * PZ; X.setTransform(z, 0, 0, z, W / 2 - c.x * z, H / 2 - c.y * z); }
function camPath2(u, keys) { let i = 0; while (i < keys.length - 1 && u >= keys[i + 1][0]) i++; const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], k = b[0] > a[0] ? sm((u - a[0]) / (b[0] - a[0])) : 0;
  return { x: lerp(a[1], b[1], k), y: lerp(a[2], b[2], k), z: lerp(a[3], b[3], k) }; }

// ---------- примитивы
function rr(x, y, w, h, r, fill) { X.beginPath(); X.roundRect(x, y, w, h, r); X.fillStyle = fill; X.fill(); }
function circ(x, y, r, fill) { X.beginPath(); X.arc(x, y, r, 0, Math.PI * 2); X.fillStyle = fill; X.fill(); }
function grad(y0, y1, c0, c1) { const g = X.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); return g; }
function glow(x, y, r, col) { const g = X.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = g; X.fillRect(x - r, y - r, r * 2, r * 2); }
function dust(t, n = 70, col = 'rgba(255,255,255,.55)', box = [-200, -200, 2320, 1480]) {
  for (let i = 0; i < n; i++) { const x = box[0] + hrand(i) * (box[2] - box[0]) + Math.sin(t * .3 + i) * 30, y = box[1] + ((hrand(i + 50) * (box[3] - box[1]) - t * (8 + hrand(i + 9) * 14)) % (box[3] - box[1]) + (box[3] - box[1])) % (box[3] - box[1]);
    const a = .25 + .75 * Math.abs(Math.sin(t * .8 + i)); X.globalAlpha = a; circ(x, y, 1.5 + hrand(i + 3) * 2.5, col); } X.globalAlpha = 1; }

// ---------- человечек
// p: { x, y (ступни), s, dir 1|-1, cloth, pants, hat: 'helmet'|null, hood, pose, walk (скорость шага, 0 — стоит), mood, talk, look, bal (цвет шарика в руке) }
function limb(x0, y0, a1, l1, a2, l2, w) { const x1 = x0 + Math.sin(a1) * l1, y1 = y0 + Math.cos(a1) * l1, x2 = x1 + Math.sin(a1 + a2) * l2, y2 = y1 + Math.cos(a1 + a2) * l2;
  X.lineWidth = w; X.beginPath(); X.moveTo(x0, y0); X.lineTo(x1, y1); X.lineTo(x2, y2); X.stroke(); return [x2, y2]; }
function person(p, t) {
  const s = p.s || 1, d = p.dir || 1, ph = t * (p.walk || 0) * 6.5, walking = !!p.walk, sit = p.pose === 'sit' || p.pose === 'popcorn';
  const bob = walking ? Math.abs(Math.sin(ph)) * 6 : Math.sin(t * 2.1 + (p.seed || 0)) * 1.5;
  X.save(); X.translate(p.x, p.y); X.scale(s * d, s);
  const hipY = sit ? -95 : -120 - bob, shY = hipY - 92, headY = shY - 52;
  // позы рук: [плечо, локоть] для левой (задней) и правой (передней) руки — углы от вертикали вниз, + вперёд
  let L = [-.25, .25], Rr = [.25, -.2]; const sw = walking ? Math.sin(ph) * .7 : 0;
  if (walking) { L = [-sw, -.3]; Rr = [sw, -.3]; }
  const tk = p.talk ? Math.sin(t * 7) : 0;
  switch (p.pose) {
    case 'wave': Rr = [2.7 + Math.sin(t * 9) * .25, .35]; break;
    case 'point': Rr = [1.45, .05]; L = [-.15, .2]; break;
    case 'shock': L = [-2.5, -.4]; Rr = [2.5, .4]; break;
    case 'hold': Rr = [2.3, .35]; break;
    case 'push': L = [1.35, .15]; Rr = [1.55, .1]; break;
    case 'saw': L = [1.3 + Math.sin(t * 14) * .15, .5]; Rr = [1.1 + Math.sin(t * 14) * .25, .7]; break;
    case 'talk': Rr = [.9 + tk * .25, -.9]; L = [-.3, .3]; break;
    case 'shrug': L = [-1.0, 1.6]; Rr = [1.0, -1.6]; break;
    case 'popcorn': Rr = [.6 + (Math.sin(t * 2.4) > .7 ? 1.2 : .4), -1.9]; L = [.5, -1]; break;
    case 'sit': L = [.4, -.9]; Rr = [.4, -.9]; break;
  }
  const legs = sit ? [[1.45, -1.5], [1.35, -1.45]] : walking ? [[sw * .8, Math.max(0, -sw) * .9], [-sw * .8, Math.max(0, sw) * .9]] : [[.08, 0], [-.08, 0]];
  for (const pass of [0, 1]) {   // 0 — светлая обводка, 1 — заливка
    X.lineCap = 'round'; X.lineJoin = 'round'; X.strokeStyle = pass ? INK : RIM; const ex = pass ? 0 : 7;
    // ноги
    for (const [a1, a2] of legs) limb(0, hipY, a1, 62, a2 - (sit ? 0 : 0), 62, 15 + ex);
    // задняя рука
    limb(-6, shY + 10, L[0], 46, L[1], 44, 13 + ex);
    // туловище (одежда)
    if (!pass) rr(-34 - 4, shY - 6, 68 + 8, hipY - shY + 18, 22, RIM);
    else { rr(-34, shY - 2, 68, hipY - shY + 10, 20, p.cloth || '#2f6fd6'); rr(-34, hipY - 18, 68, 26, 10, p.pants || INK);
      if (p.overalls) { rr(-20, shY + 22, 40, 30, 6, p.overalls); X.fillStyle = '#ffd400'; X.fillRect(-14, shY - 2, 6, 26); X.fillRect(8, shY - 2, 6, 26); }
      if (p.hood) { X.fillStyle = p.hood; X.beginPath(); X.ellipse(-10, shY + 4, 30, 14, -.2, 0, Math.PI * 2); X.fill(); } }
    // голова
    X.save(); X.translate(4, headY + (walking ? -bob * .3 : 0)); X.rotate(Math.sin(t * 1.3 + (p.seed || 0)) * .04 + (p.mood === 'sad' ? .12 : 0));
    circ(0, 0, 42 + ex * .6, pass ? INK : RIM);
    if (pass) face(p, t);
    if (p.hat === 'helmet') { if (!pass) { X.beginPath(); X.arc(0, -14, 46, Math.PI, 0); X.fillStyle = RIM; X.fill(); } else {
      X.beginPath(); X.arc(0, -14, 42, Math.PI, 0); X.fillStyle = '#ffc21a'; X.fill(); rr(-54, -20, 108, 12, 6, '#ffb000'); X.fillStyle = '#ffe27a'; X.fillRect(-4, -54, 8, 36); } }
    X.restore();
    // передняя рука
    const [hx, hy] = limb(6, shY + 10, Rr[0], 46, Rr[1], 44, 13 + ex);
    if (pass && p.bal && p.pose === 'hold') { X.strokeStyle = 'rgba(255,255,255,.8)'; X.lineWidth = 2; X.beginPath(); X.moveTo(hx, hy); X.quadraticCurveTo(hx + 10, hy - 60, hx + 4, hy - 110); X.stroke(); balloon(hx + 4, hy - 150, 40, p.bal, t); }
    if (pass && p.pose === 'popcorn') popcorn(36, hipY - 30);
    if (pass && p.prop === 'saw') { X.save(); X.translate(hx, hy); X.rotate(.15); rr(0, -8, 90, 22, 4, '#c9d1db'); X.fillStyle = '#7d8796'; for (let k = 0; k < 9; k++) { X.beginPath(); X.moveTo(6 + k * 9, 14); X.lineTo(10 + k * 9, 22); X.lineTo(14 + k * 9, 14); X.fill(); } rr(-26, -12, 30, 30, 8, '#8a5a3c'); X.restore(); }
    if (pass && p.prop === 'pointer') { X.strokeStyle = '#e9d3b0'; X.lineWidth = 5; X.beginPath(); X.moveTo(hx, hy); X.lineTo(hx + Math.sin(Rr[0]) * 120, hy - Math.cos(Rr[0]) * -120 * 0 - 30); X.stroke(); }
  }
  X.restore();
}
function face(p, t) {
  const m = p.mood || 'happy', blink = (t + (p.seed || 0)) % 3.3 < .1, lx = (p.look || 0) * 4;
  X.fillStyle = '#fff';
  const eye = (x, r) => { if (blink && m !== 'shock') { X.fillRect(x - r, -6, r * 2, 3); return; } circ(x, -6, r, '#fff'); circ(x + lx, -6, r * .45, INK); };
  if (m === 'shock') { eye(-13, 11); eye(15, 11); X.strokeStyle = '#fff'; X.lineWidth = 3; X.beginPath(); X.ellipse(2, 18, 7, 9, 0, 0, Math.PI * 2); X.stroke(); circ(30, -30, 5, 'rgba(160,210,255,.9)'); return; }
  eye(-12, 7); eye(14, 7);
  X.strokeStyle = '#fff'; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath();
  const open = p.talk ? Math.abs(Math.sin(t * 11)) : 0;
  if (m === 'sad') { X.arc(2, 24, 10, Math.PI * 1.15, Math.PI * 1.85); X.stroke(); X.beginPath(); X.moveTo(-20, -18); X.lineTo(-6, -14); X.moveTo(22, -18); X.lineTo(8, -14); X.stroke(); }
  else if (open > .3) { X.stroke(); X.beginPath(); X.ellipse(2, 15, 9, 3 + open * 6, 0, 0, Math.PI * 2); X.fillStyle = '#fff'; X.fill(); }
  else { X.arc(2, 8, 12, Math.PI * .2, Math.PI * .8); X.stroke(); }
}
function popcorn(x, y) { rr(x - 26, y - 4, 52, 46, 6, '#fff'); X.fillStyle = '#e3263b'; for (let k = 0; k < 4; k++) X.fillRect(x - 24 + k * 13, y - 4, 6, 46); for (let k = 0; k < 9; k++) circ(x - 22 + (k % 5) * 11, y - 8 - (k > 4 ? 10 : 0), 8, '#fff3c4'); }
function balloon(x, y, r, col, t, seed = 0) {
  const sx = x + Math.sin(t * 1.2 + seed) * 3; X.fillStyle = 'rgba(0,0,0,.25)'; X.beginPath(); X.ellipse(sx + 3, y + 4, r, r * 1.15, 0, 0, Math.PI * 2); X.fill();
  X.fillStyle = col; X.beginPath(); X.ellipse(sx, y, r, r * 1.15, 0, 0, Math.PI * 2); X.fill();
  X.fillStyle = 'rgba(255,255,255,.55)'; X.beginPath(); X.ellipse(sx - r * .35, y - r * .45, r * .22, r * .32, -.5, 0, Math.PI * 2); X.fill();
  X.fillStyle = col; X.beginPath(); X.moveTo(sx - 5, y + r * 1.15); X.lineTo(sx + 5, y + r * 1.15); X.lineTo(sx, y + r * 1.15 + 9); X.fill();
}
// облако шариков: n шариков в круге радиуса R над точкой привязки (ax, ay)
function cluster(cx, cy, R, n, t, ax, ay, r = 22) {
  X.strokeStyle = 'rgba(255,255,255,.55)'; X.lineWidth = 1.5;
  for (let i = 0; i < Math.min(n, 40); i++) { const a = hrand(i) * 6.28, d = Math.sqrt(hrand(i + 7)) * R; X.beginPath(); X.moveTo(ax, ay); X.lineTo(cx + Math.cos(a) * d * .6, cy + R * .6); X.stroke(); }
  const pts = []; for (let i = 0; i < n; i++) { const a = hrand(i + 11) * 6.28, d = Math.sqrt(hrand(i + 23)) * R; pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * .9, BAL[i % 8], i]); }
  pts.sort((p, q) => p[1] - q[1]).forEach(([x, y, c, i]) => balloon(x, y, r * (.85 + hrand(i + 5) * .3), c, t, i));
}

// ---------- локации
function skyDay(t, k = 0) { X.fillStyle = grad(0, 1080, k ? '#1b2346' : '#3f6fb8', k ? '#4a3a5c' : '#f2b48a'); X.fillRect(-2000, -2000, 6000, 5000); }
function city(y, col, seed = 0, lit = true) { for (let i = 0; i < 30; i++) { const w = 70 + hrand(i + seed) * 90, h = 120 + hrand(i + seed + 40) * 300, x = -600 + i * 110; rr(x, y - h, w, h + 400, 0, col);
  if (lit) { X.fillStyle = 'rgba(255,214,120,.75)'; for (let a = 0; a < 6; a++) for (let b = 0; b < 3; b++) if (hrand(i * 31 + a * 7 + b) > .55) X.fillRect(x + 12 + b * (w - 30) / 2.4, y - h + 18 + a * 40, 8, 12); } } }
function house(x, y, s = 1, door = 0) {
  X.save(); X.translate(x, y); X.scale(s, s);
  rr(-190, -250, 380, 250, 6, '#c98e64'); X.fillStyle = '#a4704c'; for (let k = 0; k < 8; k++) X.fillRect(-190, -250 + k * 32, 380, 3);
  X.fillStyle = '#3d5fa8'; X.beginPath(); X.moveTo(-225, -245); X.lineTo(0, -410); X.lineTo(225, -245); X.fill();
  rr(70, -400, 46, 110, 4, '#9b4a3a');
  rr(-40, -160, 80, 160, 6, '#5b3424'); circ(25, -80, 6, '#ffd400');
  for (const wx of [-140, 100]) { rr(wx, -190, 70, 70, 6, '#ffd98a'); X.fillStyle = '#c98e64'; X.fillRect(wx + 33, -190, 4, 70); X.fillRect(wx, -157, 70, 4); }
  X.restore();
}
function yard(t, o = {}) {
  skyDay(t, o.night ? 1 : 0); if (!o.night) glow(1500, 260, 380, 'rgba(255,220,160,.55)'); else circ(1550, 220, 60, '#f3f0dc');
  city(760, o.night ? '#1d2140' : '#5b6fa6', 3); X.fillStyle = o.night ? '#252a3e' : '#4f7d4c'; X.beginPath(); X.ellipse(960, 1150, 1700, 420, 0, Math.PI, 0); X.fill();
  X.fillStyle = o.night ? '#1c2030' : '#3f6a3e'; X.fillRect(-2000, 900, 6000, 1000);
  const lift = o.lift || 0; X.save(); X.translate(0, -lift);
  if (o.bal) cluster(1072, 300 - (o.balR || 160) * .2, o.balR || 160, o.bal, t, 1072, 520, o.balr || 22);
  house(960, 900, 1.1); X.restore();
}
function room(t) {
  X.fillStyle = grad(0, 1080, '#262b45', '#1c2036'); X.fillRect(-1000, -600, 4000, 2400);
  rr(1240, 120, 640, 470, 4, '#0f1430'); X.fillStyle = grad(130, 580, '#0a1033', '#2a2f6a'); X.fillRect(1255, 135, 610, 440);
  circ(1720, 250, 34, '#f3f0dc'); for (let i = 0; i < 40; i++) circ(1270 + hrand(i) * 590, 140 + hrand(i + 5) * 200, 1.4, 'rgba(255,255,255,.8)');
  X.save(); X.beginPath(); X.rect(1255, 135, 610, 440); X.clip(); city(600, '#151a3a', 9); X.restore();
  X.fillStyle = '#0f1430'; X.fillRect(1555, 120, 12, 470); X.fillRect(1240, 350, 640, 12); rr(1100, 70, 150, 560, 6, '#1a1f3a');
  rr(80, 220, 220, 160, 6, '#151a33'); rr(96, 236, 188, 128, 2, '#4a5788'); rr(360, 300, 150, 200, 6, '#151a33'); rr(376, 316, 118, 168, 2, '#4a5788');
  X.fillStyle = '#171b2f'; X.fillRect(-1000, 990, 4000, 600);
  rr(290, 560, 1320, 300, 50, '#4a4560'); rr(230, 760, 160, 260, 40, '#57516f'); rr(1510, 760, 160, 260, 40, '#57516f'); rr(330, 760, 1240, 200, 30, '#57516f');
  dust(t, 60);
}
function stage(t, o = {}) {
  X.fillStyle = '#3a0d14'; X.fillRect(-1000, -600, 4000, 2400); X.fillStyle = grad(0, 700, '#7a1f2a', '#4a1018'); X.fillRect(0, 0, 1920, 760);
  for (let k = 0; k < 12; k++) { X.fillStyle = k % 2 ? '#8e2433' : '#7a1d2a'; X.fillRect(k * 30, 0, 30, 760); X.fillRect(1560 + k * 30, 0, 30, 760); }
  X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = 'rgba(255,240,220,.16)'; const sx = o.spot ?? 760; X.beginPath(); X.moveTo(sx - 60, 0); X.lineTo(sx + 60, 0); X.lineTo(sx + 260, 700); X.lineTo(sx - 260, 700); X.fill(); X.restore();
  X.fillStyle = '#2c2a33'; X.fillRect(-200, 700, 2400, 40); X.fillStyle = '#1b1a21'; X.fillRect(-200, 740, 2400, 500);
  X.save(); X.globalAlpha = .5; X.fillStyle = '#fff3e0'; X.beginPath(); X.ellipse(sx, 705, 240, 22, 0, 0, Math.PI * 2); X.fill(); X.restore();
  if (o.screen) { rr(1060, 120, 520, 360, 10, '#0f1220'); rr(1072, 132, 496, 336, 6, '#1b2340'); o.screen(1320, 300); }
  for (let i = 0; i < 16; i++) circ(-60 + i * 132 + (i % 2) * 40, 1020 + (i % 2) * 24, 70, '#0e0d12');
  dust(t, 80, 'rgba(255,235,210,.6)');
}
function scaleProp(x, y, k, t) {   // огромные весы с домом и стрелкой
  rr(x - 380, y - 40, 760, 40, 8, '#7d8796'); rr(x - 300, y, 600, 120, 12, '#4a5363'); circ(x, y + 220, 150, '#e9eef4'); circ(x, y + 220, 136, '#fff');
  X.strokeStyle = '#111'; X.lineWidth = 3; for (let i = 0; i <= 10; i++) { const a = Math.PI * (.75 + i * .15); X.beginPath(); X.moveTo(x + Math.cos(a) * 120, y + 220 + Math.sin(a) * 120); X.lineTo(x + Math.cos(a) * 134, y + 220 + Math.sin(a) * 134); X.stroke(); }
  const a = Math.PI * (.75 + 1.5 * k) + Math.sin(t * 20) * .02 * (1 - k); X.strokeStyle = '#e3263b'; X.lineWidth = 7; X.beginPath(); X.moveTo(x, y + 220); X.lineTo(x + Math.cos(a) * 118, y + 220 + Math.sin(a) * 118); X.stroke(); circ(x, y + 220, 12, '#111');
}
function cylinders(t, n, ox = 0) { for (let r = 0; r < 4; r++) for (let c = 0; c < 18; c++) { if (r * 18 + c >= n) return; const x = ox + c * 110 + (r % 2) * 55, y = 520 + r * 120, s = .7 + r * .12;
  X.save(); X.translate(x, y); X.scale(s, s); rr(-30, -150, 60, 170, 26, '#9aa6b8'); rr(-30, -150, 18, 170, 10, 'rgba(255,255,255,.35)'); rr(-16, -178, 32, 34, 8, '#ffd400'); X.restore(); } }
function truck(x, y, col) { rr(x, y - 150, 300, 130, 10, '#e9eef4'); X.fillStyle = col; X.fillRect(x, y - 60, 300, 20); rr(x + 300, y - 120, 110, 100, 14, col); rr(x + 340, y - 108, 56, 40, 6, '#bfe6ff'); for (const wx of [60, 230, 360]) { circ(x + wx, y - 12, 30, '#16161c'); circ(x + wx, y - 12, 12, '#7d8796'); } }
function moneyPile(x, y, k, t) { const n = Math.round(lerp(4, 70, k)); for (let i = 0; i < n; i++) { const r = Math.floor(Math.sqrt(i)), c = i - r * r, w = 130; const px = x + (c - r) * w * .55, py = y - r * 0 - (Math.floor(i / 10)) * 34;
  X.save(); X.translate(px + (hrand(i) - .5) * 40, y - (i % 9) * 30 - Math.floor(i / 9) * 6); X.rotate((hrand(i + 3) - .5) * .12); rr(-64, -16, 128, 32, 4, '#4fae5f'); rr(-58, -11, 116, 22, 3, '#7fd18b'); circ(0, 0, 9, '#4fae5f'); X.restore(); } }

// ---------- планы (S2[shot](u, o, t) рисует весь кадр)
const TOLIK = { cloth: '#2f6fd6', overalls: '#24539f', hat: 'helmet', seed: 1 }, DRUG = { cloth: '#ff6b2c', hood: '#d94f16', seed: 4 };
const S2 = {};
S2.fOpen = (u, o, t) => { camSet(camPath2(u, [[0, 960, 420, 1.0], [1, 980, 520, 1.12]])); yard(t, { bal: 120, balR: 150, lift: sm(prog(u, .6, 1)) * 40 });
  person({ ...TOLIK, x: lerp(-100, 600, sm(prog(u, 0, .7))), y: 990, s: 1.45, walk: u < .7 ? 1 : 0, pose: u >= .7 ? 'wave' : null, mood: 'happy' }, t); dust(t, 30); };
S2.fIntro = (u, o, t) => { camSet(camPath2(u, [[0, 820, 600, 1.1], [.5, 760, 640, 1.22], [.5, 980, 600, 1.0], [1, 980, 600, 1.05]])); room(t);
  person({ ...DRUG, x: 1180, y: 1000, s: 1.55, pose: 'popcorn', mood: 'happy', look: -1, dir: -1 }, t); person({ ...TOLIK, x: 620, y: 1040, s: 1.6, pose: 'hold', bal: '#ffd400', mood: 'happy', talk: true }, t); };
S2.fTease = (u, o, t) => { const c = camPath2(u, [[0, 960, 600, 1.0], [1, 960, -500, .9]]); camSet(c); yard(t, { bal: 120, balR: 150, lift: 20 });
  X.fillStyle = grad(-1400, 200, '#0d1430', 'rgba(13,20,48,0)'); X.fillRect(-1000, -1600, 4000, 1800); for (let i = 0; i < 60; i++) circ(-200 + hrand(i) * 2300, -1400 + hrand(i + 8) * 1300, 2, 'rgba(255,255,255,.7)'); };
S2.fChapter = (u, o, t) => { camSet(camPath2(u, [[0, 960, 540, 1.08], [1, 960, 540, 1.0]])); stage(t, { spot: 960 }); person({ ...TOLIK, x: 960, y: 705, s: 1.25, pose: 'wave' }, t); };
S2.fScale = (u, o, t) => { camSet(camPath2(u, [[0, 960, 520, 1.0], [.55, 960, 560, 1.0], [.55, 960, 760, 1.6], [1, 960, 770, 1.7]])); room(t);
  X.fillStyle = 'rgba(10,12,24,.55)'; X.fillRect(-1000, -600, 4000, 2400); scaleProp(960, 640, eo(prog(u, .1, .5)) * .82, t); house(960, 600, .55);
  person({ ...TOLIK, x: lerp(280, 470, sm(prog(u, 0, .4))), y: 1030, s: 1.4, walk: u < .4 ? 1 : 0, pose: u >= .4 ? 'push' : null, mood: u > .5 ? 'shock' : 'happy' }, t); };
S2.fSaw = (u, o, t) => { camSet(camPath2(u, [[0, 900, 760, 1.4], [1, 920, 760, 1.5]])); yard(t, {}); X.fillStyle = '#7a5434'; X.fillRect(760, 900, 400, 40);
  for (let i = 0; i < 18; i++) { const a = (t * 3 + i * .7) % 1; circ(770 + i * 8 + a * 60, 905 - a * 120 + a * a * 140, 4, '#e8c08a'); }
  person({ ...TOLIK, x: 640, y: 1000, s: 1.35, pose: 'saw', prop: 'saw', mood: 'happy', talk: true }, t); };
S2.fLecture = (u, o, t) => { camSet(camPath2(u, [[0, 900, 480, 1.0], [1, 980, 420, 1.15]])); const k = eo(prog(u, .1, .5));
  stage(t, { spot: 760, screen: (cx, cy) => { balloon(cx, cy - 10, 70, '#ff4d6a', t); X.strokeStyle = '#3ee08f'; X.lineWidth = 10; X.beginPath(); X.moveTo(cx + 120, cy + 40); X.lineTo(cx + 120, cy + 40 - 120 * k); X.stroke();
    X.fillStyle = '#3ee08f'; X.beginPath(); X.moveTo(cx + 100, cy + 40 - 120 * k); X.lineTo(cx + 140, cy + 40 - 120 * k); X.lineTo(cx + 120, cy + 10 - 120 * k); X.fill();
    X.strokeStyle = '#ff4d6a'; for (const [dx, l] of [[-120, 70], [-150, 40]]) { X.beginPath(); X.moveTo(cx + dx, cy - 20); X.lineTo(cx + dx, cy - 20 + l * k); X.stroke(); } } });
  rr(560, 520, 100, 180, 4, '#26242c'); rr(545, 505, 130, 22, 4, '#3a3742');
  person({ ...TOLIK, x: 800, y: 705, s: 1.25, pose: 'point', mood: 'happy', talk: true }, t); };
S2.fPaper = (u, o, t) => { camSet(camPath2(u, [[0, 960, 500, 1.2], [1, 960, 480, 1.25]])); room(t); X.fillStyle = 'rgba(10,12,24,.45)'; X.fillRect(-1000, -600, 4000, 2400);
  const y = 520 - Math.sin(t * 1.4) * 14; balloon(960, y - 170, 90, '#ff4d6a', t); X.strokeStyle = '#fff'; X.lineWidth = 2; X.beginPath(); X.moveTo(960, y - 60); X.lineTo(960, y); X.stroke();
  for (const k of [0, 1]) { X.save(); X.translate(960 + (k - .5) * 30, y + 40 + k * 14); X.rotate((k - .5) * .2 + Math.sin(t * 2 + k) * .05); rr(-70, -48, 140, 96, 3, '#f7f7f2'); X.strokeStyle = '#c9cfd8'; X.lineWidth = 2; for (let l = 0; l < 6; l++) { X.beginPath(); X.moveTo(-54, -30 + l * 14); X.lineTo(54, -30 + l * 14); X.stroke(); } X.restore(); }
  dust(t, 40); };
S2.fMultiply = (u, o, t) => { const k = ei(prog(u, .05, .85)); camSet({ x: 960, y: lerp(560, 300, k), z: lerp(1.6, .55, eo(prog(u, 0, .9))) }); yard(t, { bal: Math.round(lerp(1, 900, k)), balR: lerp(30, 900, k), balr: lerp(26, 18, k) }); };
S2.fCompare = (u, o, t) => { camSet(camPath2(u, [[0, 560, 560, 1.2], [.45, 560, 560, 1.25], [.45, 1100, 300, .62], [1, 1100, 240, .58]]));
  yard(t, { bal: 600, balR: 700, balr: 18 }); X.save(); X.translate(-560, 0); house(960, 900, .7); cluster(1010, 520, 70, 40, t, 1010, 640, 14); X.restore();
  if (u < .45) person({ ...TOLIK, x: 240, y: 990, s: 1.2, pose: 'point', mood: 'happy' }, t); };
S2.fChair = (u, o, t) => { const y = 900 - eo(prog(u, .15, 1)) * 380; camSet({ x: 960, y: lerp(620, 420, sm(u)), z: 1.1 }); yard(t, {});
  cluster(990, y - 470, 120, 70, t, 990, y - 230, 16); rr(880, y - 140, 200, 30, 8, '#d98a6a'); rr(880, y - 230, 26, 110, 8, '#d98a6a'); rr(1054, y - 230, 26, 110, 8, '#d98a6a'); rr(900, y - 300, 160, 160, 12, '#c4775a');
  person({ ...TOLIK, x: 980, y: y - 20, s: .85, pose: 'sit', mood: 'happy' }, t); };
S2.fShock = (u, o, t) => { camSet(camPath2(u, [[0, 760, 640, 1.1], [.15, 770, 640, 1.55], [1, 770, 630, 1.62]])); room(t); person({ ...TOLIK, x: 760, y: 1040, s: 1.6, pose: u < .5 ? 'shock' : 'shrug', mood: u < .5 ? 'shock' : 'sad', talk: u > .5 }, t); };
S2.fTanks = (u, o, t) => { camSet(camPath2(u, [[0, 500, 520, 1.15], [1, 1500, 520, 1.15]])); X.fillStyle = grad(0, 1080, '#20263a', '#12141f'); X.fillRect(-1000, -600, 5000, 2400);
  for (let i = 0; i < 8; i++) { X.save(); X.globalCompositeOperation = 'lighter'; glow(200 + i * 300, 80, 220, 'rgba(255,230,180,.12)'); X.restore(); } cylinders(t, Math.round(lerp(10, 72, eo(prog(u, 0, .6))))); dust(t, 50); };
S2.fTrucks = (u, o, t) => { camSet(camPath2(u, [[0, 960, 600, 1.0], [1, 1060, 600, 1.0]])); skyDay(t, 1); city(760, '#1d2140', 5); X.fillStyle = '#2b2f40'; X.fillRect(-1000, 860, 4000, 600); X.fillStyle = '#e9d3b0'; for (let i = 0; i < 30; i++) X.fillRect(-400 + i * 120 - (t * 200) % 120, 950, 60, 8);
  for (let i = 0; i < 6; i++) truck(-600 + i * 520 + (t * 160) % 520, 930, ['#ff5a3c', '#2f6fd6', '#ffb000'][i % 3]); };
S2.fMoney = (u, o, t) => { camSet(camPath2(u, [[0, 960, 640, 1.3], [1, 960, 520, 0.95]])); room(t); X.fillStyle = 'rgba(10,12,24,.35)'; X.fillRect(-1000, -600, 4000, 2400); moneyPile(960, 980, eo(prog(u, 0, .8)), t);
  person({ ...TOLIK, x: 400, y: 1040, s: 1.5, pose: 'shock', mood: 'shock' }, t); };
S2.fLaugh = (u, o, t) => { camSet(camPath2(u, [[0, 960, 620, 1.05], [1, 980, 640, 1.12]])); room(t); person({ ...DRUG, x: 1180, y: 1000, s: 1.55, pose: 'popcorn', mood: 'happy', talk: true, dir: -1, look: -1 }, t); person({ ...TOLIK, x: 640, y: 1040, s: 1.6, pose: 'hold', bal: '#ffd400', mood: 'sad' }, t); };

/* ---------------- 2D-слой: цифры, плашки, субтитры */
const MONT = (px) => `900 ${px}px Montserrat`, INTER = (px, w = 800) => `${w} ${px}px Inter`;
const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
function text(s, x, y, o = {}) {
  if (!s) return; const p = o.p ?? 1; if (p <= 0) return; X.save(); X.globalAlpha = (o.a ?? 1) * clamp(p * 3, 0, 1); X.font = o.font || INTER(48); X.textAlign = o.align || 'center'; X.lineJoin = 'round';
  if (o.pop) { const k = clamp(p * 1.4, 0, 1), sc = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2; X.translate(x, y); X.scale(sc, sc); X.translate(-x, -y); }
  if (o.rot) { X.translate(x, y); X.rotate(o.rot); X.translate(-x, -y); }
  if (o.fit) { let px = parseFloat(X.font.match(/([\d.]+)px/)[1]); while (X.measureText(s).width > o.fit && px > 20) X.font = X.font.replace(/[\d.]+px/, (px -= 4) + 'px'); }
  const px = parseFloat(X.font.match(/([\d.]+)px/)[1]);
  if (o.stroke !== false) { X.lineWidth = Math.max(8, px * .17); X.strokeStyle = 'rgba(8,16,36,.9)'; X.strokeText(s, x, y); }
  if (o.shadow) { X.shadowColor = o.shadow; X.shadowOffsetY = Math.max(4, px * .07); X.shadowBlur = 0; }
  X.fillStyle = o.color || '#fff'; X.fillText(s, x, y); X.restore();
}
function pill(x, y, w, h, col, p = 1, rot = 0) { if (p <= 0) return; X.save(); X.globalAlpha = clamp(p * 3, 0, 1); X.translate(x, y); X.rotate(rot); X.shadowColor = 'rgba(0,0,0,.3)'; X.shadowBlur = 24; X.shadowOffsetY = 10; X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, h / 2.6); X.fillStyle = col; X.fill(); X.restore(); }
const UI = {};
UI.big = (o, q, t) => { const n = o.to != null ? fmt(lerp(o.from || 0, o.to, eo(prog(q, .05, .7)))) + (o.unit ? ' ' + o.unit : '') : o.big;
  if (o.top) { pill(W / 2, H * .17, Math.min(1200, o.top.length * 30 + 120), 76, '#ff3b5c', prog(q, 0, .08)); text(o.top, W / 2, H * .17 + 16, { font: INTER(44), color: '#fff', stroke: false, p: prog(q, 0, .1) }); }
  const Y = H * (o.y || .36); text(n, W / 2, Y, { font: MONT(o.size || 180), color: o.col || '#fff', shadow: '#d9480f', p: prog(q, .02, .14), pop: true, fit: W - 160 });
  if (o.sub) text(o.sub, W / 2, Y + 84, { font: INTER(48), p: prog(q, .15, .3), fit: W - 200 }); };
UI.chapter = (o, q) => { const p = eo(prog(q, 0, .2)); pill(W / 2, H * .42, 1180, 220, '#ffd400', p, -.02); text(`ЭТАП ${o.n}`, W / 2, H * .42 - 140, { font: MONT(56), p }); text(o.text, W / 2, H * .42 + 26, { font: MONT(96), color: '#14233d', stroke: false, p, pop: true, fit: 1080 }); };
UI.say = (o, q) => { const p = eo(prog(q, .05, .2)); X.save(); X.globalAlpha = p; X.font = MONT(50); const w = Math.min(1100, X.measureText(o.say).width + 100); X.restore(); pill(o.x || W * .62, o.y || H * .2, w, 120, '#ffffff', p); text(o.say, o.x || W * .62, (o.y || H * .2) + 18, { font: MONT(50), color: '#14233d', stroke: false, p, fit: w - 60 }); };
UI.rows = (o, q) => { (o.rows || []).forEach(([l, v, c], i) => { const p = eo(prog(q, .1 + i * .14, .25 + i * .14)), y = H * .2 + i * 110; pill(W * .78, y, 600, 90, 'rgba(255,255,255,.95)', p); text(l, W * .78 - 270, y + 16, { font: INTER(40), color: '#14233d', stroke: false, align: 'left', p }); text(v, W * .78 + 270, y + 18, { font: MONT(50), color: c, stroke: false, align: 'right', p }); });
  if (o.total) { const p = eo(prog(q, .62, .76)), y = H * .2 + 3 * 110 + 20; pill(W * .78, y, 600, 110, '#ffd400', p); text('ИТОГО', W * .78 - 270, y + 18, { font: MONT(46), color: '#14233d', stroke: false, align: 'left', p }); text(o.total, W * .78 + 270, y + 24, { font: MONT(72), color: '#14233d', stroke: false, align: 'right', p, pop: true }); } };
UI.tease = (o, q) => { const p = eo(prog(q, 0, .2)); text('В КОНЦЕ ВИДЕО', W / 2, H * .2, { font: MONT(64), color: '#ffd400', p }); pill(W / 2, H * .36, 1100, 150, 'rgba(255,255,255,.3)', p);
  X.save(); X.globalAlpha = p; X.filter = 'blur(14px)'; X.font = MONT(56); X.textAlign = 'center'; X.fillStyle = '#fff'; X.fillText(o.hidden || '███████ ███ ████████', W / 2, H * .36 + 20); X.restore(); text('🔒', W / 2, H * .36 + 26, { font: MONT(80), stroke: false, p }); };
UI.banner = (o, q, t) => { const p = eo(prog(q, 0, .12)); pill(W / 2, H * .16, 640, 110, '#ff3b5c', p, -.04 + Math.sin(t * 3) * .015); text(o.top || 'А ТЫ ЗНАЛ?', W / 2, H * .16 + 20, { font: MONT(58), stroke: false, p, rot: -.04 });
  if (o.big) text(o.big, W / 2, H * .38, { font: MONT(150), color: '#ffd400', p: prog(q, .08, .22), pop: true, fit: W - 160 }); text(o.text, W / 2, H * (o.big ? .38 : .32) + 90, { font: INTER(50), p: prog(q, .2, .4), fit: W - 200 }); };
UI.alt = (o, q) => { const km = lerp(o.from, o.to, sm(q)), x = 150, y0 = H * .82, h = H * .62; X.save(); X.strokeStyle = '#fff'; X.lineWidth = 6; X.beginPath(); X.moveTo(x, y0); X.lineTo(x, y0 - h); X.stroke();
  for (let k = 0; k <= 5; k++) { const y = y0 - k / 5 * h; X.beginPath(); X.moveTo(x, y); X.lineTo(x + 30, y); X.stroke(); text(`${k} км`, x - 16, y + 12, { font: INTER(30), align: 'right' }); } X.fillStyle = '#ffd400'; const ym = y0 - km / 5 * h; X.beginPath(); X.moveTo(x + 34, ym); X.lineTo(x + 74, ym - 16); X.lineTo(x + 74, ym + 16); X.fill(); X.restore();
  pill(W - 300, H * .22, 420, 230, 'rgba(255,255,255,.95)'); text(`${km.toFixed(1).replace('.', ',')} км`, W - 300, H * .22 - 10, { font: MONT(76), color: '#14233d', stroke: false }); text(`${Math.round(lerp(o.t0, o.t1, sm(q)))} °C`, W - 300, H * .22 + 76, { font: MONT(58), color: '#2d7fe0', stroke: false }); };
UI.pop = (o, q, t) => { for (let i = 0; i < 26; i++) { const r1 = Math.sin(i * 91.7) * .5 + .5, r2 = Math.sin(i * 37.3) * .5 + .5, t0 = r1 * .7, p = prog(q, t0, t0 + .06); if (p > 0 && p < 1) text(o.word || 'ПОП!', 200 + r2 * (W - 400), 160 + r1 * (H * .55), { font: MONT(50 + r2 * 40), color: ['#ffd400', '#ff4d6a', '#3ee08f', '#38a6ff'][i % 4], pop: true, p, rot: (r2 - .5) * .6 }); } };
UI.card = (o, q) => { const p = eo(prog(q, 0, .2)); X.save(); X.globalAlpha = p; X.shadowColor = 'rgba(0,0,0,.35)'; X.shadowBlur = 30; X.fillStyle = 'rgba(255,255,255,.96)'; X.beginPath(); X.roundRect(W * .52, H * .14, W * .42, H * .5, 40); X.fill(); X.restore();
  text(o.year, W * .73, H * .26, { font: MONT(120), color: '#ff3b5c', stroke: false, p }); text(o.name, W * .73, H * .34, { font: MONT(50), color: '#14233d', stroke: false, p: prog(q, .1, .3), fit: W * .38 });
  (o.lines || []).forEach((l, i) => text(l, W * .73, H * .42 + i * 58, { font: INTER(40), color: '#3b4b66', stroke: false, p: prog(q, .25 + i * .08, .45 + i * .08), fit: W * .38 })); };
UI.receipt = (o, q) => { const rows = o.rows, w = 760, h = 160 + rows.length * 84, x0 = W / 2 - w / 2, y0 = H * .44 - h / 2; X.save(); X.shadowColor = 'rgba(0,0,0,.35)'; X.shadowBlur = 30; X.fillStyle = '#fff'; X.fillRect(x0, y0, w, h); X.restore();
  text(o.title, W / 2, y0 + 72, { font: MONT(44), color: '#14233d', stroke: false }); rows.forEach(([l, v], i) => { const p = prog(q, .08 + i * .09, .18 + i * .09), y = y0 + 150 + i * 84; text(l, x0 + 46, y, { font: INTER(40), color: '#3b4b66', stroke: false, align: 'left', p }); text(v, x0 + w - 46, y, { font: MONT(44), color: i === rows.length - 1 ? '#ff3b5c' : '#14233d', stroke: false, align: 'right', p }); });
  if (o.stamp) text(o.stamp, x0 + w - 150, y0 + h - 20, { font: MONT(86), color: '#ff3b5c', stroke: false, rot: -.18, pop: true, p: prog(q, .82, .92) }); };
UI.ask = (o, q) => { const p = eo(prog(q, 0, .2)); pill(W * .66, H * .26, 1000, 130, '#ffffff', p); text(o.q, W * .66, H * .26 + 18, { font: MONT(50), color: '#14233d', stroke: false, p, fit: 940 });
  pill(W * .66, H * .42, 860, 130, '#ffd400', prog(q, .25, .4)); text(o.formula, W * .66, H * .42 + 22, { font: MONT(62), color: '#14233d', stroke: false, p: prog(q, .25, .45), fit: 800 }); text(o.sub, W * .66, H * .52, { font: INTER(42), p: prog(q, .45, .6) }); };
UI.next = (o, q) => { text('В СЛЕДУЮЩЕМ ВЫПУСКЕ', W / 2, H * .14, { font: MONT(56), color: '#ffd400', p: prog(q, 0, .15) }); text(o.text, W / 2, H * .25, { font: MONT(92), p: prog(q, .1, .3), pop: true, fit: W - 200 }); text(o.sub, W / 2, H * .25 + 80, { font: INTER(46), p: prog(q, .25, .45), fit: W - 240 }); };

function captions(t) {
  const caps = EP.caps; let k = -1; for (let i = 0; i < caps.length; i++) if (t >= caps[i].a && t < caps[i].b + .05) { k = i; break; } if (k < 0) return;
  const cp = caps[k], pop = 1 + .14 * (1 - eo(prog(t, cp.a, cp.a + .16))), words = cp.text.split(' ');
  X.save(); X.font = MONT(58); const sp = X.measureText(' ').width, ws = words.map(w => X.measureText(w).width), Wt = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  X.translate(W / 2, H - 70); X.scale(pop, pop); let x = -Wt / 2; X.textAlign = 'left'; X.lineJoin = 'round';
  words.forEach((w, i) => { const hot = /[0-9%]/.test(w); X.lineWidth = 12; X.strokeStyle = 'rgba(0,0,0,.9)'; X.strokeText(w, x, 0); X.fillStyle = hot ? '#ffd400' : '#fff'; X.fillText(w, x, 0); x += ws[i] + sp; }); X.restore();
}
function hud(t, i) {
  text(EP.brand || 'СКОЛЬКО НУЖНО?', 54, 70, { font: MONT(30), align: 'left', a: .9 });
  let badge; for (let k = i; k >= 0 && badge === undefined; k--) badge = EP.beats[k].badge; const b = EP.beats[i];
  if (badge && b.ui?.kind !== 'chapter') { pill(W - 230, 64, 400, 70, 'rgba(14,26,52,.72)'); text(badge, W - 230, 76, { font: MONT(30), color: '#ffd400', stroke: false, fit: 360 }); }
  X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(0, 0, W, 8); X.fillStyle = '#ffd400'; X.fillRect(0, 0, W * clamp(t / EP.END, 0, 1), 8);
}


/* ---------------- кадр */
const beatAt = (t) => { let i = 0; while (i + 1 < PH.length && t >= PH[i + 1].s - .25) i++; return i; };
function render(t) {
  const i = beatAt(t), b = EP.beats[i], s0 = PH[i].s - .25, dur = Math.max(1.2, (PH[i + 1]?.s ?? EP.END) - .25 - s0), u = clamp((t - s0) / dur, 0, 1);
  X.setTransform(1, 0, 0, 1, 0, 0); X.clearRect(0, 0, W, H);
  const punch = prog(t, s0, s0 + .22); PZ = i > 0 && punch < 1 ? 1 + .06 * (1 - eo(punch)) : 1;
  X.save(); (S2[b.shot] || S2.fChapter)(u, b.o || {}, t); X.restore(); X.setTransform(1, 0, 0, 1, 0, 0);
  const v = X.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.4)'); X.fillStyle = v; X.fillRect(0, 0, W, H);
  if (b.ui) { const q = clamp((t - PH[i].s) / Math.min(PH[i].d, 5), 0, 1); (UI[b.ui.kind] || (() => {}))(b.ui, q, t); }
  if (!window.NOHUD) { hud(t, i); captions(t); }
  const fl = b.ui?.kind === 'chapter' ? Math.max(0, 1 - (t - s0) / .3) * .7 : 0; if (fl > 0) { X.fillStyle = `rgba(255,255,255,${fl})`; X.fillRect(0, 0, W, H); }
}
window.grab = (f, q = .9) => { render(f / FPS); return out.toDataURL('image/jpeg', q); };
window.renderAt = render;
Promise.all([MONT(80), INTER(40), INTER(40, 400)].flatMap(f => [document.fonts.load(f, 'Аа Яя 0'), document.fonts.load(f, 'Aa 0 «»—')])).then(() => { render(.01); window.READY = true; });
