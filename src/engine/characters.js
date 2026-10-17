// Персонажи для историй: плоские векторные человечки с ригом (кости рук/ног), мимикой и предметами.
// Всё рисуется кодом — стиль всегда одинаковый, без нейросетевых картинок.
// Позы смешиваются на пружинах, руки догоняют корпус с запаздыванием (follow-through), лица моргают и следят за действием.
const D2R = Math.PI / 180;
const SKINS = ['#f2c6a0', '#e6b08a', '#d29a72', '#f6d5bb', '#b8805a'];
const HAIRS = ['#2b1d16', '#5a3522', '#b9783e', '#17151f', '#7a3f22', '#d9b067'];
const CLOTH2 = ['#ffb347', '#ff6b8b', '#f3c35a', '#ff8a5b'];   // тёплые — всегда контрастны неоновому акценту первого героя

// ---------- позы (градусы): плечо/локоть каждой руки, бёдра, наклон корпуса и головы, подъём тела ----------
// hl/hr — углы коротких лапок хомяка (0 — вниз, + наружу/вверх, − внутрь к животику)
const POSES = {
  neutral: { lSh: 8, lEl: 6, rSh: 8, rEl: 6, lLeg: 0, rLeg: 0, lean: 0, head: 0, lift: 0, hl: -20, hr: -20 },
  reach: { lSh: 10, lEl: 8, rSh: 72, rEl: 18, lLeg: 0, rLeg: 0, lean: 3, head: 4, lift: 0, hl: -15, hr: 85 },
  hold: { lSh: 10, lEl: 8, rSh: 22, rEl: -98, lLeg: 0, rLeg: 0, lean: 0, head: 6, lift: 0, hl: -42, hr: -42 },
  tap: { lSh: 12, lEl: 10, rSh: 84, rEl: 6, lLeg: 0, rLeg: 0, lean: 6, head: 2, lift: 0, hl: -20, hr: 92 },
  catch: { lSh: 30, lEl: 40, rSh: 128, rEl: 14, lLeg: 0, rLeg: 0, lean: -2, head: -8, lift: 0, hl: 125, hr: 140 },
  drop: { lSh: 10, lEl: 8, rSh: 58, rEl: -40, lLeg: 0, rLeg: 0, lean: 6, head: 10, lift: 0, hl: -20, hr: 40 },
  proud: { lSh: 36, lEl: -96, rSh: 36, rEl: -96, lLeg: -4, rLeg: 4, lean: -3, head: -4, lift: 0, hl: -55, hr: -55 },
  think: { lSh: 22, lEl: -100, rSh: 60, rEl: -192, lLeg: 0, rLeg: 0, lean: 2, head: -9, lift: 0, hl: -40, hr: -150 },
  celebrate: { lSh: 158, lEl: 12, rSh: 158, rEl: 12, lLeg: -6, rLeg: 6, lean: 0, head: -6, lift: 0, hl: 150, hr: 150 },
  sad: { lSh: 3, lEl: 2, rSh: 3, rEl: 2, lLeg: 0, rLeg: 0, lean: 7, head: 14, lift: 6, hl: 2, hr: 2 },
  shock: { lSh: 46, lEl: 72, rSh: 46, rEl: 72, lLeg: -5, rLeg: 5, lean: -4, head: -5, lift: 0, hl: 115, hr: 115 },
  explain: { lSh: 12, lEl: 10, rSh: 44, rEl: 58, lLeg: 0, rLeg: 0, lean: 2, head: 3, lift: 0, hl: -20, hr: 65 },
  wave: { lSh: 10, lEl: 8, rSh: 150, rEl: 20, lLeg: 0, rLeg: 0, lean: -2, head: -6, lift: 0, hl: -30, hr: 155 },
  panic: { lSh: 140, lEl: 30, rSh: 140, rEl: 30, lLeg: -8, rLeg: 8, lean: -3, head: -4, lift: 0, hl: 135, hr: 135 },
};
const POSE_KEYS = Object.keys(POSES.neutral);
const blendPose = (a, b, u) => { const o = {}; for (const k of POSE_KEYS) o[k] = a[k] + (b[k] - a[k]) * u; return o; };
// ---------- мимика: улыбка (-1..1), открытый рот, брови (-1 грусть .. 1 удивление), румянец, взгляд ----------
const EMOS = {
  neutral: { smile: .2, open: 0, brow: 0, blush: .3, lx: 0, ly: 0, cheek: 0 },
  happy: { smile: 1, open: .6, brow: .35, blush: 1, lx: 0, ly: 0, cheek: 0 },
  proud: { smile: .85, open: 0, brow: .15, blush: .6, lx: 0, ly: 0, cheek: 0 },
  sad: { smile: -.85, open: 0, brow: -1, blush: 0, lx: 0, ly: .5, cheek: 0 },
  shock: { smile: 0, open: 1, brow: 1, blush: 0, lx: 0, ly: 0, cheek: 0 },
  think: { smile: -.15, open: 0, brow: .7, blush: .2, lx: .7, ly: -.8, cheek: 0 },
};
const EMO_KEYS = Object.keys(EMOS.neutral);
const blendEmo = (a, b, u) => { const o = {}; for (const k of EMO_KEYS) o[k] = a[k] + (b[k] - a[k]) * u; return o; };

// ---------- действия: поза + эмоция + когда эмоция включается ----------
const ACTS = {
  receive: { pose: ts => ts < .95 ? 'reach' : 'hold', emo: ts => ts < .8 ? 'neutral' : 'happy' },
  pay: { pose: ts => ts < .35 ? 'hold' : ts < 1.25 ? 'tap' : 'hold', emo: () => 'neutral' },
  spend: { pose: ts => ts < .7 ? 'shock' : 'sad', emo: ts => ts < .7 ? 'shock' : 'sad' },
  cashback: { pose: ts => ts < 1.1 ? 'catch' : 'proud', emo: ts => ts < .5 ? 'shock' : 'happy' },
  save: { pose: ts => ts < 1.6 ? 'drop' : 'proud', emo: ts => ts < 1.4 ? 'neutral' : 'proud' },
  grow: { pose: () => 'proud', emo: () => 'proud' },
  compare: { pose: () => 'proud', emo: () => 'proud' },
  think: { pose: () => 'think', emo: () => 'think' },
  happy: { pose: () => 'celebrate', emo: () => 'happy' },
  sad: { pose: () => 'sad', emo: () => 'sad' },
  talk: { pose: () => 'explain', emo: () => 'neutral' },
  hello: { pose: () => 'wave', emo: () => 'happy' },
  panic: { pose: () => 'panic', emo: () => 'shock' },
};
const actEnd = k => ACTS[k] ? { pose: ACTS[k].pose(9), emo: ACTS[k].emo(9) } : { pose: 'neutral', emo: 'neutral' };

// ---------- внешность по имени (детерминированно) ----------
function lookFor(c) {
  const h = [...c.name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  if (c.kind === 'hamster') return { ham: true, ph: 1.3 };
  return {
    skin: SKINS[h % SKINS.length], hair: HAIRS[(h >> 3) % HAIRS.length],
    style: c.female ? ['long', 'bun', 'bob'][(h >> 5) % 3] : ['short', 'quiff'][(h >> 5) % 2],
    top: c.idx === 0 ? VIO : CLOTH2[(h >> 7) % CLOTH2.length], bottom: ['#262b45', '#2f2a3a', '#1f3346'][(h >> 9) % 3], ph: (h % 100) / 16,
  };
}

// ---------- рисование человечка (локально: ноги в (0,0), рост ~490) ----------
const capsule = (x1, y1, x2, y2, w, col) => { if (INK) { g.strokeStyle = INKC; g.lineWidth = w + 11; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); } g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
function drawHair(L, front) {
  g.fillStyle = L.hair;
  if (!front) {
    if (L.style === 'long') { g.beginPath(); g.roundRect(-78, -270, 156, 175, [60, 60, 26, 26]); g.fill(); }
    if (L.style === 'bob') { g.beginPath(); g.roundRect(-76, -270, 152, 112, [56, 56, 22, 22]); g.fill(); }
    if (L.style === 'bun') { g.beginPath(); g.arc(0, -288, 30, 0, 6.2832); g.fill(); g.beginPath(); g.roundRect(-66, -262, 132, 80, 40); g.fill(); }
    return;
  }
  g.beginPath(); g.arc(0, -212, 64, Math.PI * 1.02, Math.PI * 1.98);
  if (L.style === 'quiff') { g.lineTo(58, -238); g.quadraticCurveTo(20, -300, -40, -262); g.quadraticCurveTo(-56, -248, -63, -222); }
  else if (L.style === 'short') { g.lineTo(56, -236); g.quadraticCurveTo(0, -262, -56, -236); }
  else { g.lineTo(60, -222); g.quadraticCurveTo(30, -250, -6, -236); g.quadraticCurveTo(-40, -224, -62, -205); }
  g.closePath(); g.fill();
}
function drawFace(E, blink) {
  const ex = E.lx * 5, ey = E.ly * 4;
  // глаза
  for (const s of [-1, 1]) {
    g.fillStyle = '#1b1426'; g.beginPath(); g.ellipse(s * 22 + ex, -214 + ey, 7.5, Math.max(1, 10.5 * blink), 0, 0, 6.2832); g.fill();
    if (blink > .5) { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(s * 22 + ex + 2.5, -218 + ey, 2.4, 0, 6.2832); g.fill(); }
    // брови: грусть — внутренний край вверх, удивление — обе вверх
    const inner = -236 - (E.brow < 0 ? -E.brow * 8 : E.brow * 7), outer = -238 - (E.brow > 0 ? E.brow * 7 : E.brow * 2);
    capsule(s * 12, inner, s * 32, outer, 5, '#2a1c18');
  }
  // румянец
  if (E.blush > .02) { g.fillStyle = `rgba(255,110,140,${.45 * E.blush})`; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 36, -194, 11, 7, 0, 0, 6.2832); g.fill(); } }
  // рот: улыбка/грусть кривой, открытый — заливкой
  const my = -184;
  if (E.open > .15) {
    const w = 15 + E.smile * 4, top = my - 3 - E.smile * 3, bot = my + 4 + E.open * 15 + E.smile * 5;
    g.fillStyle = '#3a1020'; g.beginPath(); g.moveTo(-w, top); g.quadraticCurveTo(0, top + E.smile * 6, w, top); g.quadraticCurveTo(w * .8, bot, 0, bot); g.quadraticCurveTo(-w * .8, bot, -w, top); g.fill();
    g.fillStyle = '#ff7a8e'; g.beginPath(); g.ellipse(0, bot - 5, w * .45, 4 * E.open, 0, 0, 6.2832); g.fill();
  } else {
    g.strokeStyle = '#3a1020'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-14, my - E.smile * 4); g.quadraticCurveTo(0, my + E.smile * 11, 14, my - E.smile * 4); g.stroke();
  }
}
/** Рисует персонажа. P — поза, E — эмоция, o.flip — смотрит влево (-1)/вправо (1), o.held(side) — предмет в руке. */
function drawPerson(L, x, y, k, P, E, T, o = {}) {
  const f = o.flip || 1, blinkPh = (T + L.ph * 3) % 3.4, blink = blinkPh < .12 ? Math.abs(blinkPh - .06) / .06 : 1;
  const breath = Math.sin(T * 2.1 + L.ph) * 1.6;
  g.save(); g.translate(x, y); g.scale(k * f, k);
  // тень на полу
  g.save(); g.globalAlpha *= .5; g.fillStyle = '#000'; g.beginPath(); g.ellipse(0, 6, 92 + P.lift * .4, 15, 0, 0, 6.2832); g.fill(); g.restore();
  g.translate(0, -Math.max(0, -P.lift) + Math.max(0, P.lift) * .3);
  // ноги
  for (const [s, a] of [[-1, P.lLeg], [1, P.rLeg]]) {
    g.save(); g.translate(s * 24, -196); g.rotate(-a * D2R); capsule(0, 0, 0, 176, 34, L.bottom);
    g.fillStyle = '#14111b'; g.beginPath(); g.roundRect(-20 + s * 6, 168, 42, 24, 11); g.fill(); g.restore();
  }
  // корпус (всё выше бёдер наклоняется вместе)
  g.save(); g.translate(0, -200); g.rotate(P.lean * D2R); g.translate(0, breath * .4);
  g.save(); g.translate(0, -150); g.rotate(P.head * D2R); g.translate(0, 150); drawHair(L, false); g.restore();
  g.fillStyle = L.top; g.beginPath(); g.moveTo(-48, 6); g.lineTo(48, 6); g.lineTo(56, -112); g.quadraticCurveTo(56, -142, 26, -144); g.lineTo(-26, -144); g.quadraticCurveTo(-56, -142, -56, -112); g.closePath();
  if (INK) { g.strokeStyle = INKC; g.lineWidth = 11; g.lineJoin = 'round'; g.stroke(); } g.fill();
  g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(-16, -144); g.lineTo(0, -122); g.lineTo(16, -144); g.fill();   // вырез
  g.fillStyle = L.bottom; g.beginPath(); g.roundRect(-50, -6, 100, 22, 8); g.fill();
  // голова
  g.save(); g.translate(0, -150); g.rotate(P.head * D2R); g.translate(0, 150);
  g.fillStyle = L.skin; g.beginPath(); g.roundRect(-13, -164, 26, 26, 6); g.fill();
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 61, -210, 12, 0, 6.2832); g.fill(); }
  g.beginPath(); g.arc(0, -212, 62, 0, 6.2832); if (INK) { g.strokeStyle = INKC; g.lineWidth = 10; g.stroke(); } g.fill();
  drawFace(E, blink);
  drawHair(L, true);
  g.restore();
  // руки: верх — рукав, низ — кожа; side=1 — «рабочая» рука (смотрит туда же, куда персонаж)
  for (const [s, sh, el] of [[-1, P.lSh, P.lEl], [1, P.rSh, P.rEl]]) {
    g.save(); g.translate(s * 50, -126); g.rotate(-s * sh * D2R);
    capsule(0, 0, 0, 74, 30, L.top);
    g.translate(0, 74); g.rotate(-s * el * D2R);
    capsule(0, 0, 0, 64, 24, L.skin);
    g.fillStyle = L.skin; g.beginPath(); g.arc(0, 70, 15, 0, 6.2832); g.fill();
    if (o.held && s === 1) { g.translate(0, 74); o.held(f); }
    g.restore();
  }
  g.restore();
  g.restore();
}
// мировые координаты кисти рабочей руки (для эффектов «деньги в руку»)
function handWorld(x, y, k, P, f) {
  const lift = -Math.max(0, -P.lift) + Math.max(0, P.lift) * .3, ln = P.lean * D2R;
  const rot = (px, py, a) => [px * Math.cos(a) - py * Math.sin(a), px * Math.sin(a) + py * Math.cos(a)];
  const a1 = -P.rSh * D2R, a2 = a1 - P.rEl * D2R;
  let px = 50 + rot(0, 74, a1)[0] + rot(0, 74, a2)[0], py = -126 + rot(0, 74, a1)[1] + rot(0, 74, a2)[1];
  [px, py] = rot(px, py, ln); py += -200 + lift;
  return [x + px * k * f, y + py * k];
}

// ---------- предметы и эффекты ----------
function bankCard(w = 150, accent = VIO) {
  const h = w * .63; g.save();
  const gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gr.addColorStop(0, accent); gr.addColorStop(1, '#1d1430');
  g.fillStyle = gr; g.shadowColor = accent; g.shadowBlur = 18; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, w * .08); g.fill(); g.shadowBlur = 0;
  g.fillStyle = GOLD; g.beginPath(); g.roundRect(-w * .38, -h * .18, w * .17, h * .26, 3); g.fill();
  g.fillStyle = 'rgba(255,255,255,.75)'; g.font = `700 ${Math.round(w * .085)}px ${MONO}`; g.fillText('•••• 2048', -w * .38, h * .32);
  g.globalAlpha *= .85; g.fillStyle = '#ff5f6d'; g.beginPath(); g.arc(w * .25, h * .26, w * .08, 0, 6.2832); g.fill(); g.fillStyle = '#ffb347'; g.beginPath(); g.arc(w * .34, h * .26, w * .08, 0, 6.2832); g.fill();
  g.restore();
}
function banknote(x, y, rot, s = 1, a = 1) {
  if (a <= 0) return; g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.fillStyle = '#41c47f'; g.beginPath(); g.roundRect(-38, -20, 76, 40, 4); g.fill();
  g.strokeStyle = 'rgba(10,60,30,.55)'; g.lineWidth = 2; g.strokeRect(-32, -14, 64, 28);
  g.fillStyle = 'rgba(10,60,30,.6)'; g.beginPath(); g.arc(0, 0, 9, 0, 6.2832); g.fill(); g.restore();
}
function rubCoin(x, y, r, spin = 0, a = 1) {
  if (a <= 0) return; g.save(); g.globalAlpha *= a; g.translate(x, y); g.scale(Math.max(.15, Math.abs(Math.cos(spin))), 1);
  g.fillStyle = GOLD; g.shadowColor = GOLD; g.shadowBlur = 14; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill(); g.shadowBlur = 0;
  g.strokeStyle = 'rgba(120,70,0,.5)'; g.lineWidth = r * .12; g.beginPath(); g.arc(0, 0, r * .74, 0, 6.2832); g.stroke();
  txt('₽', 0, r * .36, { size: r * 1.05, w: 900, color: '#8a5a00', align: 'center' }); g.restore();
}
function terminal(x, y, p, ok) {
  if (p <= 0) return; const s = settle(clamp(p)); g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#20202b'; g.shadowColor = VIO; g.shadowBlur = 20; g.beginPath(); g.roundRect(-52, -88, 104, 176, 16); g.fill(); g.shadowBlur = 0;
  g.fillStyle = ok ? 'rgba(126,224,129,.95)' : `rgba(${ACC2},.85)`; g.beginPath(); g.roundRect(-38, -72, 76, 52, 6); g.fill();
  txt(ok ? '✓' : '₽', 0, -34, { size: 34, w: 900, color: '#0c0a14', align: 'center' });
  g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(-24 + i * 24, 2 + j * 22, 6, 0, 6.2832); g.fill(); }
  g.restore();
}
function piggy(x, y, p, bump = 0) {
  if (p <= 0) return; const s = settle(clamp(p)); g.save(); g.translate(x, y); g.scale(s * (1 + bump * .08), s * (1 - bump * .1));
  const pink = '#ff8fb1';
  g.fillStyle = pink; for (const lx of [-40, -14, 18, 42]) { g.beginPath(); g.roundRect(lx - 9, -14, 18, 26, 6); g.fill(); }
  g.beginPath(); g.ellipse(0, -60, 84, 60, 0, 0, 6.2832); g.fill();
  g.beginPath(); g.moveTo(40, -108); g.lineTo(62, -138); g.lineTo(70, -100); g.fill();
  g.fillStyle = '#ff6f9c'; g.beginPath(); g.ellipse(84, -60, 18, 22, 0, 0, 6.2832); g.fill();
  g.fillStyle = '#c94a75'; for (const ny of [-66, -54]) { g.beginPath(); g.arc(86, ny, 3.5, 0, 6.2832); g.fill(); }
  g.fillStyle = '#1b1426'; g.beginPath(); g.arc(52, -78, 6, 0, 6.2832); g.fill();
  g.fillStyle = '#c94a75'; g.beginPath(); g.roundRect(-22, -122, 44, 8, 4); g.fill();
  g.restore();
}
function moneyStack(x, yBase, h, a = 1, col = '#41c47f') {
  if (h <= 0 || a <= 0) return; g.save(); g.globalAlpha *= a;
  const n = Math.max(1, Math.floor(h / 12));
  for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? col : '#36a96c'; g.beginPath(); g.roundRect(x - 60 + (rnd(i * 3.1 + x) - .5) * 8, yBase - (i + 1) * 12, 120, 11, 3); g.fill(); }
  g.restore();
}
function floatLabel(s, x, y, ts, col = WHITE) {
  if (ts <= 0) return; const a = clamp(ts * 5) * (1 - seg(ts, 2.2, 2.8)); if (a <= 0) return;
  const sc = spring(ts, 2.6, .5), yy = y - 40 * emph(seg(ts, 0, .8));
  g.save(); g.translate(x, yy); g.scale(sc, sc);
  if (INK) { const w = tw(s, 60, 900) + 44; g.globalAlpha *= a; g.rotate(-.04); g.fillStyle = col === RED ? '#ffb3bd' : VIO; g.strokeStyle = INKC; g.lineWidth = 6; g.beginPath(); g.roundRect(-w / 2, -58, w, 78, 14); g.fill(); g.stroke(); txt(s, 0, 0, { size: 60, w: 900, color: INKC, align: 'center' }); }
  else txt(s, 0, 0, { size: 64, w: 900, color: col, align: 'center', glow: 26, glowColor: col === RED ? RED : VIO, alpha: a });
  g.restore();
}
function bubble(x, y, ts, content, think = true) {
  if (ts <= 0) return; const p = settle(seg(ts, 0, .45)), w = Math.max(150, tw(content, 54, 900) + 70), h = 112;
  g.save(); g.globalAlpha *= clamp(ts * 4);
  if (think) for (let i = 0; i < 3; i++) { const q = seg(ts, i * .08, i * .08 + .3); g.fillStyle = INK ? '#fff' : WHITE; g.strokeStyle = INKC; g.lineWidth = 4; g.beginPath(); g.arc(x - 30 - i * 22, y + h / 2 + 18 + i * 22, (12 - i * 3) * q, 0, 6.2832); g.fill(); if (INK) g.stroke(); }
  g.translate(x, y); g.scale(p, p); g.fillStyle = INK ? '#ffffff' : WHITE; g.shadowColor = VIO; g.shadowBlur = 26; g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 50); g.fill(); g.shadowBlur = 0; if (INK) { g.strokeStyle = INKC; g.lineWidth = 6; g.stroke(); }
  txt(content, 0, 20, { size: 54, w: 900, color: '#140c22', align: 'center' });
  g.restore();
}
// деньги/монеты летят по дугам из A в B со ступенчатым стартом
function flyMoney(ax, ay, bx, by, ts, n = 7, coins = false, dur = .7) {
  for (let i = 0; i < n; i++) {
    const q = seg(ts, i * .09, i * .09 + dur); if (q <= 0 || q >= 1) continue;
    const e = eio(q), arc = Math.sin(Math.PI * e) * (120 + rnd(i * 5.3) * 80), x = lerp(ax, bx, e) + (rnd(i * 2.7) - .5) * 60 * Math.sin(Math.PI * e), y = lerp(ay, by, e) - arc;
    if (coins) rubCoin(x, y, 22, ts * 9 + i, 1); else banknote(x, y, (rnd(i) - .5) * 2 + ts * 4 * (i % 2 ? 1 : -1), .9, 1);
  }
}
function confetti(cx, top, ts) {
  if (ts <= 0 || ts > 2.4) return;
  const cols = [VIO2, GOLD, '#3ad1c5', '#ff6b8b', WHITE];
  for (let i = 0; i < 60; i++) {
    const vx = (rnd(i * 1.3) - .5) * 900, vy = -300 - rnd(i * 2.1) * 500, x = cx + vx * ts, y = top + vy * ts + 900 * ts * ts;
    g.save(); g.globalAlpha *= 1 - ts / 2.4; g.translate(x, y); g.rotate(ts * 8 * (rnd(i) - .5)); g.fillStyle = cols[i % cols.length]; g.fillRect(-6, -3, 12, 6); g.restore();
  }
}
function rainCloud(x, y, ts) {
  if (ts <= 0) return; const p = settle(seg(ts, 0, .5)); g.save(); g.globalAlpha *= clamp(ts * 3) * .9; g.translate(x, y); g.scale(p, p);
  g.fillStyle = '#6b6f86'; for (const [cx, cy, r] of [[-40, 0, 34], [0, -16, 44], [44, 2, 32], [10, 12, 36]]) { g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fill(); }
  g.strokeStyle = '#7fb2ff'; g.lineWidth = 4; g.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const ph = ((ts * 1.6 + i / 6) % 1); g.globalAlpha = (1 - ph) * .8; g.beginPath(); g.moveTo(-50 + i * 20, 44 + ph * 90); g.lineTo(-54 + i * 20, 60 + ph * 90); g.stroke(); }
  g.restore();
}


// ---------- ХОМЯК — талисман канала ----------
// «Живая» линия: точки контура слегка смещаются 7.5 раз в секунду, как у рисованной покадровой анимации
const boil = (seed, i, amp) => (rnd(seed * 13.7 + i * 3.1 + Math.floor(FR / 4) * 17.3) - .5) * 2 * amp;
function roughEllipse(cx, cy, rx, ry, seed, amp = 1.6, rot = 0) {
  const n = 28, pts = [];
  for (let i = 0; i < n; i++) { const a = i / n * 6.2832, j = boil(seed, i, amp), x = (rx + j) * Math.cos(a), y = (ry + j) * Math.sin(a); pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); }
  g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  g.closePath();
}
const HAM = { fur: '#f2a654', furD: '#d9843a', cream: '#fff3df', pink: '#ff9fb2', nose: '#ff8098', LW: 6.5 };
function inkStroke(w = HAM.LW) { g.strokeStyle = INKC; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
// формы тела: рисуются дважды — сначала толстый контур всех частей, потом заливка (так контур объединения получается цельным)
function hamShapes(P, E, T, pass) {
  const cheek = E.cheek || 0, ear = Math.sin(T * 1.7) * 2;
  const fill = (col) => { if (pass === 'stroke') { g.strokeStyle = INKC; g.lineWidth = HAM.LW * 2; g.lineJoin = 'round'; g.stroke(); } else { g.fillStyle = col; g.fill(); } };
  // тело
  g.beginPath(); roughEllipse(0, -185, 142, 152, 1); fill(HAM.fur);
  // голова (наклоняется отдельно)
  g.save(); g.translate(0, -262); g.rotate(P.head * D2R); g.translate(0, 262);
  for (const sd of [-1, 1]) { g.beginPath(); roughEllipse(sd * 100, -438 + (sd > 0 ? ear : -ear), 37, 37, 3 + sd); fill(HAM.fur); }
  g.beginPath(); roughEllipse(0, -330, 152, 128, 2); fill(HAM.fur);
  if (cheek > .03) for (const sd of [-1, 1]) { g.beginPath(); roughEllipse(sd * (118 + cheek * 18), -298, 30 + cheek * 34, 26 + cheek * 30, 7 + sd); fill(HAM.fur); }
  g.restore();
}
function drawHamster(L, x, y, k, P, E, T, o = {}) {
  const f = o.flip || 1, blinkPh = (T + L.ph * 3) % 3.6, blink = blinkPh < .12 ? Math.abs(blinkPh - .06) / .06 : 1;
  const breath = Math.sin(T * 2.3 + L.ph) * .012, air = Math.max(0, -P.lift);
  g.save(); g.translate(x, y); g.scale(k * f, k);
  // тень (уменьшается в прыжке)
  g.save(); g.fillStyle = INK ? 'rgba(27,26,31,.16)' : 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(0, 4, 128 * (1 - air / 300), 18, 0, 0, 6.2832); g.fill(); g.restore();
  // лапки-ступни (шагают, если персонаж идёт)
  for (const sd of [-1, 1]) { const lift = Math.max(0, sd < 0 ? P.lLeg : P.rLeg) * .9 + air; g.beginPath(); roughEllipse(sd * 62, -16 - lift, 46, 21, 11 + sd); g.fillStyle = HAM.cream; g.fill(); inkStroke(); for (const tx of [-14, 0, 14]) { g.beginPath(); g.moveTo(sd * 62 + tx, -4 - lift); g.lineTo(sd * 62 + tx, -14 - lift); inkStroke(3.5); } }
  // подъём, растяжение в прыжке, дыхание; наклон корпуса вокруг «талии»
  g.translate(0, -air); const sy = 1 + Math.min(.09, air / 260) + breath; g.scale(1 / Math.sqrt(sy), sy);
  g.translate(0, -150); g.rotate(P.lean * D2R); g.translate(0, 150);
  hamShapes(P, E, T, 'stroke'); hamShapes(P, E, T, 'fill');
  // светотень: тёплая тень по правому краю (заливка вне смещённого эллипса, обрезанная по силуэту)
  g.save(); g.beginPath(); roughEllipse(0, -185, 142, 152, 1); g.clip();
  g.beginPath(); g.rect(-300, -400, 600, 420); g.ellipse(-34, -210, 150, 175, 0, 0, 6.2832); g.fillStyle = 'rgba(170,85,20,.22)'; g.fill('evenodd'); g.restore();
  // животик
  g.beginPath(); roughEllipse(0, -158, 100, 108, 21, 1.2); g.fillStyle = HAM.cream; g.fill();
  // голова: мордочка, уши, лицо
  g.save(); g.translate(0, -262); g.rotate(P.head * D2R); g.translate(0, 262);
  for (const sd of [-1, 1]) { g.beginPath(); roughEllipse(sd * 100, -436, 20, 21, 31 + sd, 1); g.fillStyle = HAM.pink; g.fill(); }
  g.save(); g.beginPath(); roughEllipse(0, -330, 152, 128, 2); g.clip();
  g.beginPath(); g.rect(-300, -480, 600, 300); g.ellipse(-40, -350, 150, 140, 0, 0, 6.2832); g.fillStyle = 'rgba(170,85,20,.2)'; g.fill('evenodd'); g.restore();
  g.beginPath(); roughEllipse(0, -296, 100, 66, 22, 1.2); g.fillStyle = HAM.cream; g.fill();
  // хохолок (три волоска, раскачиваются с запаздыванием)
  const sway = Math.sin(T * 2.6 + L.ph) * 5 + P.lean * 1.4 + P.head * .8;
  for (const [dx, h] of [[-12, 30], [2, 40], [16, 28]]) { g.beginPath(); g.moveTo(dx, -455); g.quadraticCurveTo(dx + sway * .5 - 6, -455 - h * .6, dx + sway + 4, -455 - h); inkStroke(5); }
  hamFace(E, blink, T);
  g.restore();
  // лапки: короткие «сосиски» с кремовыми ладошками; правая (рабочая) держит предмет
  for (const [sd, ang] of [[-1, P.hl], [1, P.hr]]) {
    g.save(); g.translate(sd * 104, -246); g.rotate(-sd * ang * D2R);
    g.beginPath(); roughEllipse(0, 36, 22, 46, 41 + sd, 1.2); g.fillStyle = HAM.fur; g.fill(); inkStroke();
    g.beginPath(); roughEllipse(0, 78, 18, 17, 51 + sd, 1); g.fillStyle = HAM.cream; g.fill(); inkStroke(5);
    if (o.held && sd === 1) { g.translate(0, 88); o.held(f); }
    g.restore();
  }
  g.restore();
}
function hamFace(E, blink, T) {
  const ex = E.lx * 7, ey = E.ly * 6, happyEyes = E.smile > .7 && E.open > .3, shock = E.brow > .75 && E.open > .7, sad = E.brow < -.5;
  for (const sd of [-1, 1]) {
    const cx = sd * 64, cy = -352;
    if (happyEyes) { g.beginPath(); g.moveTo(cx - 20, cy + 8); g.quadraticCurveTo(cx, cy - 26, cx + 20, cy + 8); inkStroke(9); }
    else if (shock) {
      g.beginPath(); roughEllipse(cx, cy - 4, 34, 40, 61 + sd, 1.2); g.fillStyle = '#fff'; g.fill(); inkStroke(5);
      g.beginPath(); g.arc(cx + ex * .6, cy + ey * .6, 8, 0, 6.2832); g.fillStyle = INKC; g.fill();
    } else {
      g.beginPath(); g.ellipse(cx + ex, cy + ey, 25, Math.max(2, 31 * blink), 0, 0, 6.2832); g.fillStyle = INKC; g.fill();
      if (blink > .5) { g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + ex + 9, cy + ey - 12, 9, 0, 6.2832); g.fill(); g.beginPath(); g.arc(cx + ex - 8, cy + ey + 11, 4.5, 0, 6.2832); g.fill(); }
      if (sad) { // веко опущено к внешнему краю
        g.beginPath(); g.moveTo(cx - 34, cy - 44); g.lineTo(cx + 34, cy - 44); g.lineTo(cx + 34, cy + (sd > 0 ? -2 : -22)); g.lineTo(cx - 34, cy + (sd > 0 ? -22 : -2)); g.closePath(); g.fillStyle = HAM.fur; g.fill();
        g.beginPath(); g.moveTo(cx - 30, cy + (sd > 0 ? -20 : -4)); g.lineTo(cx + 30, cy + (sd > 0 ? -4 : -20)); inkStroke(5);
      }
    }
    // брови
    const inner = cy - 48 - (E.brow < 0 ? -E.brow * 14 : E.brow * 12), outer = cy - 50 - (E.brow > 0 ? E.brow * 12 : E.brow * 3);
    g.beginPath(); g.moveTo(sd * 46, inner); g.lineTo(sd * 84, outer); inkStroke(7);
  }
  if (sad) { const q = (T * .8) % 1; g.fillStyle = '#7fc4ff'; g.beginPath(); g.ellipse(-82, -320 + q * 70, 8, 12, 0, 0, 6.2832); g.globalAlpha = 1 - q; g.fill(); g.globalAlpha = 1; }
  // румянец со штриховкой
  if (E.blush > .05) for (const sd of [-1, 1]) {
    g.save(); g.globalAlpha *= .6 * E.blush; g.fillStyle = HAM.pink; g.beginPath(); g.ellipse(sd * 104, -306, 26, 15, 0, 0, 6.2832); g.fill(); g.restore();
    g.save(); g.globalAlpha *= .5 * E.blush; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(sd * 104 + i * 11 - 5, -298); g.lineTo(sd * 104 + i * 11 + 5, -314); inkStroke(3); } g.restore();
  }
  // усы
  for (const sd of [-1, 1]) for (const dy of [-6, 8]) { g.save(); g.globalAlpha *= .7; g.beginPath(); g.moveTo(sd * 66, -300 + dy); g.lineTo(sd * 112, -306 + dy * 1.8); inkStroke(3); g.restore(); }
  // нос
  g.beginPath(); g.moveTo(-14, -324); g.quadraticCurveTo(0, -336, 14, -324); g.quadraticCurveTo(0, -300, -14, -324); g.fillStyle = HAM.nose; g.fill(); inkStroke(4.5);
  // рот: «ω», при открытом — пасть с язычком; два передних зуба всегда
  const sm = E.smile, cy2 = -306;
  if (E.open > .15) {
    const bot = cy2 + 14 + E.open * 30;
    g.beginPath(); g.moveTo(-24, cy2 - sm * 4); g.quadraticCurveTo(0, cy2 + 6, 24, cy2 - sm * 4); g.quadraticCurveTo(20, bot, 0, bot); g.quadraticCurveTo(-20, bot, -24, cy2 - sm * 4); g.fillStyle = '#5a1a26'; g.fill(); inkStroke(5);
    g.beginPath(); g.ellipse(0, bot - 7, 11, 6 * E.open, 0, 0, 6.2832); g.fillStyle = '#ff7f95'; g.fill();
  }
  for (const sd of [-1, 1]) { g.beginPath(); g.roundRect(sd > 0 ? 1 : -11, cy2 + 2, 10, 15, 3); g.fillStyle = '#fff'; g.fill(); inkStroke(3.5); }
  g.beginPath(); g.moveTo(0, -312); g.lineTo(0, cy2 + 1);
  g.moveTo(0, cy2 + 1); g.quadraticCurveTo(-12, cy2 + 10 - sm * 4, -26, cy2 - sm * 8);
  g.moveTo(0, cy2 + 1); g.quadraticCurveTo(12, cy2 + 10 - sm * 4, 26, cy2 - sm * 8); inkStroke(4.5);
}
// мировые координаты ладошки хомяка и его рта
function hamPaw(x, y, k, P, f) {
  const air = Math.max(0, -P.lift), a = -P.hr * D2R, ln = P.lean * D2R;
  let px = 104 - Math.sin(a) * 84, py = -246 + Math.cos(a) * 84;
  py += 150; [px, py] = [px * Math.cos(ln) - py * Math.sin(ln), px * Math.sin(ln) + py * Math.cos(ln)]; py -= 150;
  return [x + px * k * f, y + (py - air) * k];
}

// ---------- сцена-история ----------
// s.p.cast: [{name, female, idx, x, flip, enter, fromAct}], s.p.acts: [{who, kind, wi, value}], s.p.bubble
T.story = function (t, d, s) {
  const p = s.p, Tabs = s.start + t, floorY = 975, kOf = c => c.kind === 'hamster' ? 1.05 : .95;
  // сцена: в неоне — светящийся пол, в комиксе — «нарисованная от руки» линия пола
  if (INK) { g.beginPath(); g.moveTo(80, floorY + boil(91, 0, 2)); g.quadraticCurveTo(CX, floorY + 5 + boil(91, 1, 2), W - 80, floorY + boil(91, 2, 2)); inkStroke(5); }
  else {
    g.save(); const fg = g.createLinearGradient(0, floorY - 4, 0, floorY + 80); fg.addColorStop(0, `rgba(${ACC},.35)`); fg.addColorStop(1, `rgba(${ACC},0)`);
    g.fillStyle = fg; g.fillRect(0, floorY - 2, W, 80); g.restore();
    ln(0, floorY, W, floorY, 1, { lw: 2, color: `rgba(${ACC2},.5)` });
  }
  const acts = (p.acts || []).map(a => ({ ...a, ta: Math.max(.15, s.kt(a.wi) - .1) })).sort((a, b) => a.ta - b.ta);
  const actorNow = (() => { let a = null; for (const x of acts) if (x.ta <= t) a = x; return a || acts[0]; })();
  const state = {};
  for (const c of p.cast) {
    const L = (c._look ||= lookFor(c));
    if (!INK) blob(c.x, floorY - 260, 330, .16);
    // поза и эмоция: цепочка действий персонажа, каждое смешивается на пружине (руки — с запаздыванием)
    const start = actEnd(c.fromAct);
    let P = { ...POSES[start.pose] }, Pa = { ...P }, E = { ...EMOS[start.emo] };
    for (const a of acts.filter(a => a.who === c.name && a.ta <= t)) {
      const ts = t - a.ta, A = ACTS[a.kind] || ACTS.talk, tgt = POSES[A.pose(ts)];
      P = blendPose(P, tgt, Math.min(1.08, spring(ts, 2.2, .62)));
      Pa = blendPose(Pa, tgt, Math.min(1.12, spring(ts - .07, 1.9, .55)));
      E = blendEmo(E, EMOS[A.emo(ts)], clamp(ts * 5));
      if (a.kind === 'happy') P.lift = -Math.abs(Math.sin(ts * 8)) * 34 * Math.exp(-ts * .9);
      if (a.kind === 'talk') { Pa.rEl = 58 + Math.sin(ts * 7) * 22; Pa.hr = 65 + Math.sin(ts * 7) * 20; }
      if (a.kind === 'hello') { Pa.rEl = 20 + Math.sin(ts * 11) * 26; Pa.hr = 155 + Math.sin(ts * 11) * 22; }
      if (a.kind === 'panic') { Pa.hl = 135 + Math.sin(ts * 19) * 25; Pa.hr = 135 + Math.sin(ts * 19 + 2) * 25; Pa.lSh = 140 + Math.sin(ts * 19) * 20; Pa.rSh = 140 + Math.sin(ts * 19 + 2) * 20; P.lLeg = Math.max(0, Math.sin(ts * 22)) * 20; P.rLeg = Math.max(0, -Math.sin(ts * 22)) * 20; }
      // хомяк копит: монеты летят в рот, щёки раздуваются
      if (a.kind === 'save' && c.kind === 'hamster') E.cheek = Math.min(1, [0, 1, 2, 3].reduce((m, i) => m + spring(ts - .75 - i * .3, 2.6, .45) * .26, 0));
    }
    for (const key of ['hl', 'hr']) P[key] = Pa[key];
    for (const key of ['lSh', 'lEl', 'rSh', 'rEl']) P[key] = Pa[key];
    // остальные смотрят на того, кто сейчас действует
    if (actorNow && actorNow.who !== c.name) { const other = p.cast.find(o => o.name === actorNow.who); if (other) E.lx = Math.sign(other.x - c.x) * c.flip * .8; }
    // выход на сцену: шаг из-за края кадра, с покачиванием и «приземлением»
    let x = c.x;
    if (c.enter) {
      const u = seg(t, 0, .95), from = c.x < CX ? -260 : W + 260; x = lerp(from, c.x, emph(u));
      if (u < 1) { const w = Math.sin(t * 14); P.lLeg = w * 18; P.rLeg = -w * 18; P.lift = -Math.abs(w) * 10; }
    }
    if (acts.some(a => a.who === c.name && a.kind === 'panic' && a.ta <= t)) x += Math.sin(t * 40) * 4;
    state[c.name] = { c, L, P, E, x, k: kOf(c) };
  }
  // предметы в руках (карта при оплате/кэшбэке, купюры после получения)
  const heldFor = name => {
    const mine = acts.filter(a => a.who === name && a.ta <= t), last = mine[mine.length - 1];
    if (!last) return null;
    if ((last.kind === 'pay' || last.kind === 'cashback') && p.card) return fl => { g.scale(fl, 1); g.rotate(Math.PI / 2 * fl); bankCard(120, last.kind === 'cashback' ? VIO2 : VIO); };
    if (last.kind === 'receive' && t - last.ta > .9) return () => { for (let i = 0; i < 3; i++) { g.save(); g.rotate((i - 1) * .25); banknote(0, -22, 0, .8); g.restore(); } };
    return null;
  };
  for (const name in state) { const st = state[name]; (st.L.ham ? drawHamster : drawPerson)(st.L, st.x, floorY, st.k, st.P, st.E, Tabs, { flip: st.c.flip, held: heldFor(name) }); }
  // имена под героями
  for (const name in state) { const st = state[name]; mono(name.toUpperCase(), st.x, floorY + 46, 24, VIO2, { align: 'center', w: 700, ls: 4, alpha: seg(t, .3, .8) }); }
  // эффекты действий
  for (const a of acts) {
    const st = state[a.who]; if (!st) continue; const ts = t - a.ta; if (ts <= 0) continue;
    const k = st.k, f = st.c.flip, hx = st.x, head = floorY - 520 * k, [hwx, hwy] = st.L.ham ? hamPaw(st.x, floorY, k, st.P, f) : handWorld(st.x, floorY, k, st.P, f), side = st.x + f * (st.L.ham ? 330 : 270);
    const val = a.value || '';
    switch (a.kind) {
      case 'receive': flyMoney(st.x + f * 700, 200, hwx, hwy, ts, 7); if (val) floatLabel('+' + val, hx, head - 30, ts - .8, VIO2); break;
      case 'pay': { terminal(side, floorY - 330, seg(ts, 0, .4), ts > 1); if (ts > .6 && ts < 1.4) for (let r = 0; r < 3; r++) { const q = ((ts - .6) * 1.6 + r / 3) % 1; ring(side - f * 60, floorY - 330, 30 + q * 70, (1 - q) * .7, 3); } if (val) floatLabel('−' + val, side, floorY - 470, ts - 1.05, WHITE); break; }
      case 'spend': flyMoney(st.x, floorY - 300, st.x + f * 1100, 120, ts, 9); if (val) floatLabel('−' + val, hx, head - 30, ts - .5, RED); rainCloud(hx, head - 70, ts - 1); break;
      case 'cashback': { const src = acts.find(b => b.kind === 'pay' && b.who === a.who); const sx = src ? side : st.x + f * 600, sy = src ? floorY - 330 : 200; flyMoney(sx, sy, hwx, hwy, ts, 6, true, .8); if (val) floatLabel('+' + val, hx, head - 30, ts - .9, GOLD); break; }
      case 'save': if (st.L.ham) { // монеты одна за другой влетают хомяку в рот
          for (let i = 0; i < 4; i++) { const q = seg(ts, .3 + i * .3, .75 + i * .3); if (q > 0 && q < 1) rubCoin(lerp(st.x + f * 520, st.x, eio(q)), lerp(220, floorY - 300 * k, eio(q)) - Math.sin(Math.PI * q) * 90, 24, ts * 9 + i); }
          if (val) floatLabel('+' + val, hx + f * 260, head + 20, ts - 1.7, VIO2); break; }
        { const px = st.x + f * 250, bump = [0, 1, 2, 3].reduce((m, i) => Math.max(m, Math.exp(-Math.max(0, ts - .7 - i * .28) * 14) * (ts > .7 + i * .28 ? 1 : 0)), 0);
        piggy(px, floorY, seg(ts, 0, .45), bump);
        for (let i = 0; i < 4; i++) { const q = seg(ts, .35 + i * .28, .7 + i * .28); if (q > 0 && q < 1) rubCoin(lerp(hwx, px - 2, q), lerp(hwy, floorY - 125, eio(q)) - Math.sin(Math.PI * q) * 60, 20, ts * 8); }
        if (val) floatLabel(val, px, floorY - 230, ts - 1.5, VIO2); break; }
      case 'grow': { const h = 40 + 200 * emph(seg(ts, .2, 1.4)); moneyStack(side, floorY, h); if (val) floatLabel('+' + val, side, floorY - h - 50, ts - 1.2, VIO2); break; }
      case 'compare': {
        for (const name in state) { const o = state[name], mine = name === a.who, h = mine ? 60 + 260 * emph(seg(ts, .2, 1.4)) : 60 + 70 * emph(seg(ts, .2, 1.0)), sx = o.x + o.c.flip * 230; moneyStack(sx, floorY, h); if (mine && val) floatLabel('+' + val, sx, floorY - h - 50, ts - 1.2, VIO2); }
        break;
      }
      case 'think': bubble(hx + f * 150, head - 40, ts - .1, p.bubble || '?'); break;
      case 'happy': confetti(hx, head - 80, ts); break;
      case 'sad': rainCloud(hx, head - 60, ts); break;
      case 'panic': for (let i = 0; i < 6; i++) { const q = ((ts * 1.4 + i / 6) % 1), sd = i % 2 ? 1 : -1; g.save(); g.globalAlpha *= 1 - q; g.fillStyle = '#7fc4ff'; g.beginPath(); g.ellipse(hx + sd * (140 + q * 120), head + 40 - q * 60 + q * q * 160, 9, 13, sd * .5, 0, 6.2832); g.fill(); if (INK) inkStroke(3); g.restore(); } break;
      case 'hello': if (ts < 2.6) bubble(hx + f * 230, head - 30, ts - .2, 'Привет!', false); break;
      default: break;
    }
  }
};
