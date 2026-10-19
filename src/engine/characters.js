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
  address: { lSh: 12, lEl: 10, rSh: 60, rEl: 20, lLeg: 0, rLeg: 0, lean: -2, head: -3, lift: 0, hl: -40, hr: 80 },
  run: { lSh: 40, lEl: 60, rSh: 40, rEl: 60, lLeg: 0, rLeg: 0, lean: 12, head: -6, lift: 0, hl: 60, hr: 60 },
  sit: { lSh: 8, lEl: 6, rSh: 8, rEl: 6, lLeg: 0, rLeg: 0, lean: 4, head: 16, lift: 0, hl: -45, hr: -45 },
  point: { lSh: 10, lEl: 8, rSh: 88, rEl: 4, lLeg: 0, rLeg: 0, lean: 3, head: -4, lift: 0, hl: -40, hr: 96 },
  ride: { lSh: 150, lEl: 20, rSh: 60, rEl: 10, lLeg: -6, rLeg: 6, lean: -4, head: -8, lift: 0, hl: 150, hr: 40 },
  calc: { lSh: 10, lEl: 8, rSh: 22, rEl: -98, lLeg: 0, rLeg: 0, lean: 4, head: 10, lift: 0, hl: -38, hr: -38 },
  scratch: { lSh: 10, lEl: 8, rSh: 150, rEl: 60, lLeg: 0, rLeg: 0, lean: 2, head: 8, lift: 0, hl: -30, hr: 165 },
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
  cool: { smile: .7, open: 0, brow: .1, blush: .3, lx: 0, ly: 0, cheek: 0, shades: 1 },
  sleep: { smile: .35, open: 0, brow: -.15, blush: .5, lx: 0, ly: 0, cheek: 0, sleep: 1 },
  focus: { smile: .1, open: 0, brow: .35, blush: .2, lx: .6, ly: -.2, cheek: 0, glasses: 1 },
  puzzled: { smile: -.3, open: 0, brow: .8, blush: 0, lx: -.5, ly: -.6, cheek: 0 },
  determined: { smile: -.2, open: .4, brow: -.6, blush: 0, lx: .5, ly: 0, cheek: 0 },
  smug: { smile: .65, open: 0, brow: -.55, blush: 0, lx: .5, ly: 0, cheek: 0 },
};
for (const e of Object.values(EMOS)) { e.shades ??= 0; e.wink ??= 0; e.sleep ??= 0; e.glasses ??= 0; }
const EMO_KEYS = Object.keys(EMOS.neutral);
const blendEmo = (a, b, u) => { const o = {}; for (const k of EMO_KEYS) o[k] = a[k] + (b[k] - a[k]) * u; return o; };

// ---------- действия: поза + эмоция + когда эмоция включается ----------
const ACTS = {
  receive: { pose: ts => ts < .95 ? 'reach' : 'hold', emo: ts => ts < .8 ? 'neutral' : 'happy' },
  pay: { pose: ts => ts < .35 ? 'hold' : ts < 1.25 ? 'tap' : 'hold', emo: () => 'neutral' },
  spend: { pose: ts => ts < .7 ? 'shock' : 'sad', emo: ts => ts < .7 ? 'shock' : 'sad' },
  cashback: { pose: ts => ts < 1.1 ? 'catch' : 'proud', emo: ts => ts < .5 ? 'shock' : 'happy' },
  save: { pose: ts => ts < 1.6 ? 'drop' : 'proud', emo: ts => ts < 1.4 ? 'neutral' : 'proud' },
  grow: { pose: () => 'proud', emo: ts => ts < .9 ? 'proud' : 'cool' },
  compare: { pose: () => 'proud', emo: ts => ts < .9 ? 'proud' : 'cool' },
  address: { pose: () => 'address', emo: () => 'proud' },
  wink: { pose: () => 'neutral', emo: () => 'happy' },     // тренд: подмигнуть в камеру
  dance: { pose: () => 'celebrate', emo: () => 'happy' },  // тренд: танец руками
  think: { pose: () => 'think', emo: () => 'think' },
  happy: { pose: () => 'celebrate', emo: () => 'happy' },
  sad: { pose: () => 'sad', emo: () => 'sad' },
  talk: { pose: () => 'explain', emo: () => 'neutral' },
  hello: { pose: () => 'wave', emo: () => 'happy' },
  panic: { pose: () => 'panic', emo: () => 'shock' },
  wheel: { pose: () => 'run', emo: () => 'determined' },
  sleep: { pose: () => 'sit', emo: () => 'sleep' },
  chart: { pose: () => 'point', emo: () => 'focus' },
  rocket: { pose: () => 'ride', emo: () => 'happy' },
  calc: { pose: () => 'calc', emo: ts => ts < 1.4 ? 'focus' : 'proud' },
  scratch: { pose: () => 'scratch', emo: () => 'puzzled' },
  shades: { pose: ts => ts < .5 ? 'hold' : 'proud', emo: ts => ts < .25 ? 'neutral' : 'cool' },
  grab: { pose: ts => ts < .7 ? 'reach' : 'proud', emo: () => 'smug' },
  laugh: { pose: () => 'proud', emo: () => 'happy' },
  walk: { pose: () => 'neutral', emo: () => 'happy' },
  courier: { pose: ts => ts < 1.6 ? 'neutral' : ts < 2.2 ? 'catch' : 'proud', emo: ts => ts < 1.6 ? 'neutral' : 'happy' },
  cart: { pose: () => 'proud', emo: ts => ts < 1.8 ? 'happy' : 'shock' },
  laptop: { pose: () => 'point', emo: ts => ts < 1.2 ? 'focus' : 'happy' },
  phone: { pose: () => 'hold', emo: () => 'focus' },
};
const actEnd = k => ACTS[k] ? { pose: ACTS[k].pose(9), emo: ACTS[k].emo(9) } : { pose: 'neutral', emo: 'neutral' };

// ---------- внешность по имени (детерминированно) ----------
const ANCHOR = () => ({ ...OWL, outfit: 'suit', suit: '#a61e2e', suitL: '#cc3344', suitD: '#6e1220', tie: '#ffd43b', tie2: '#ffe680' });   // Сова — ведущая «Зверо-новостей»
const hostLook = L => PLAN.lead === 'wolf' ? WOLF : PLAN.lead === 'owl' ? ANCHOR() : L;   // в формате «Енот и Волк» заставки и финал ведёт Волк
function lookFor(c, place) {
  const h = [...c.name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  if (c.kind === 'hamster') return { ham: true, ph: 1.3, outfit: typeof outfitFor === 'function' ? outfitFor(place) : PLAN.episode?.outfit || 'suit', hood: typeof HOODS !== 'undefined' ? HOODS[(PLAN.seed || 0) % HOODS.length] : undefined };
  if (c.kind === 'cat') return CAT;
  if (c.kind === 'mole') return place === 'newsroom' ? { ...MOLE, outfit: 'suit', tie: '#e5383b', tie2: '#ff6b6b', ...(PLAN.news?.look?.mole || {}) } : MOLE;   // в студии — наряд дня по плану сезона   // Крот — кореш Хомяка: слепой как котёнок, в очках прозревает
  if (c.kind === 'squirrel') return SQUIRREL;   // Белка — эксперт по запасам
  if (c.kind === 'hedgehog') return HOG;   // Ёж — кореш-транжира
  if (c.kind === 'lion') return LION;   // Лев — знает, как заработать на приглашениях
  if (c.kind === 'raccoon') return RACCOON;   // Енот — ищет подработку
  if (c.kind === 'wolf') return WOLF;   // Волк — уже работает и знает, как устроены бонусы за друзей
  if (c.kind === 'owl') return place === 'newsroom' ? { ...ANCHOR(), ...(PLAN.news?.look?.owl || {}) } : OWL;   // Сова — экономист, всё считает   // Кот-банкир — постоянный антагонист: инфляция, комиссии, кредиты
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
// комикс-вставка: звёздочка-взрыв со звукоподражанием («ОГО!», «УРА!») — короткая реакция поверх сцены
const STICKERS = { panic: ['ОГО!', 'ЧТО?!', 'АЙ!'], spend: ['ВЖУХ!', 'УПС!'], happy: ['УРА!', 'ЕСТЬ!', 'ВАУ!'], think: ['ХММ…'], calc: ['СЧИТАЕМ…', 'ТАК-ТАК…'], scratch: ['ЧЕГО?'], sad: ['ЭХ…'], rocket: ['ВЖУХ!', 'ПОЕХАЛИ!'], save: ['ДЗЫНЬ!'], grow: ['РАСТЁМ!'] };
function sticker(word, x, y, ts, seed) {
  if (ts < 0 || ts > 1.5) return;
  const p = settle(seg(ts, 0, .25)), a = 1 - seg(ts, 1.15, 1.5), wob = Math.sin(ts * 9 + seed) * .04, n = 12, w = tw(word, 64, 900);
  const R = Math.max(150, w * .62 + 40), col = ['#ffd43b', '#ff8fab', '#74c0fc', '#8ce99a'][seed % 4];
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.rotate(-.12 + (seed % 3) * .1 + wob); g.scale(p, p);
  g.beginPath(); for (let i = 0; i <= n * 2; i++) { const an = i / (n * 2) * 6.2832, r = i % 2 ? R * .72 : R + boil(1500 + seed, i, 6); g.lineTo(Math.cos(an) * r, Math.sin(an) * r * .62); }
  g.closePath(); g.fillStyle = col; g.fill(); inkStroke(7);
  txt(word, 0, 22, { size: 64, w: 900, color: INKC, align: 'center' });
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
// ---------- «конфетка»: плашка-знакомство, реплики, манга-линии ----------
const INTRO = { 'Хомяк': 'ЭТО Я', 'Крот': 'МОЙ КОРЕШ', 'Белка': 'ЗНАТОК ЗАПАСОВ', 'Ёж': 'КОРЕШ-ТРАНЖИРА', 'Сова': 'ЭКОНОМИСТ', 'Лев': 'ЗНАЕТ, ГДЕ ДЕНЬГИ', 'Енот': 'ИЩЕТ ПОДРАБОТКУ', 'Волк': 'УЖЕ РАБОТАЕТ', 'Кот': 'БАНКИР' };
function introTag(name, x, y, t) {
  const q = seg(t, .2, .55), o = seg(t, 2.5, 2.8); if (q <= 0 || o >= 1) return;
  const sub = (PLAN.news && { 'Сова': 'ВЕДУЩАЯ', 'Крот': 'СОВЕДУЩИЙ' }[name]) || INTRO[name] || '', w = Math.max(tw(name.toUpperCase(), 66, 900), tw(sub, 30, 800)) + 64, h = sub ? 128 : 92, ty = y - 150 - (1 - o) * 0 - o * 60;
  g.save(); g.globalAlpha *= 1 - o;
  // стрелка к голове
  g.beginPath(); g.moveTo(x, ty + h / 2 + 4); g.quadraticCurveTo(x + 40, ty + h / 2 + 60, x + 6, y + 20); g.strokeStyle = INKC; g.lineWidth = 7; g.lineCap = 'round'; g.stroke();
  g.beginPath(); g.moveTo(x - 14, y + 4); g.lineTo(x + 6, y + 24); g.lineTo(x + 24, y + 2); g.stroke();
  g.translate(x, ty); g.rotate(-.05 + boil(77, 0, .01)); const sc = back(q); g.scale(sc, sc);
  g.beginPath(); g.roundRect(-w / 2 + 8, -h / 2 + 10, w, h, 18); g.fillStyle = INKC; g.fill();
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 18); g.fillStyle = '#ffd43b'; g.fill(); g.strokeStyle = INKC; g.lineWidth = 6; g.stroke();
  txt(name.toUpperCase(), 0, sub ? -2 : 22, { size: 66, w: 900, color: INKC, align: 'center' });
  if (sub) txt(sub, 0, 44, { size: 30, w: 800, color: INKC, align: 'center', ls: 3 });
  g.restore();
}
function wrapLines(words, size, maxW) { g.font = `900 ${size}px ${SANS}`; const lines = []; let cur = ''; for (const w of words) { const tryL = cur ? cur + ' ' + w : w; if (cur && g.measureText(tryL).width > maxW) { lines.push(cur); cur = w; } else cur = tryL; } if (cur) lines.push(cur); return lines; }
function speech(say, s, t, sx, top) {
  const ws = say.text.split(/\s+/), base = say.wi || 0, t0 = s.words[base]?.t ?? 0; if (t < t0 - .15) return;
  const shown = ws.filter((_, j) => t >= (s.words[base + j]?.t ?? 0) - .1).length || 1;
  const size = 56, lines = wrapLines(ws, size, 760), lh = size * 1.15, all = wrapLines(ws.slice(0, shown), size, 760);
  const w = Math.max(...lines.map(l => tw(l, size, 900))) + 80, h = lines.length * lh + 56, p = back(seg(t, t0 - .15, t0 + .15));
  const bx = clamp(sx, w / 2 + 40, 1080 - w / 2 - 40), by = top + h / 2, tx = clamp(sx, bx - w / 2 + 60, bx + w / 2 - 60) - bx;
  g.save(); g.translate(bx, by); g.scale(p, p); g.rotate(boil(91, 0, .006));
  g.beginPath(); g.moveTo(tx - 30, h / 2 - 6); g.lineTo(tx + (sx > bx ? 40 : -40) * 0 + 10, h / 2 + 70); g.lineTo(tx + 30, h / 2 - 6); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = INKC; g.lineWidth = 7; g.lineJoin = 'round'; g.stroke();
  g.beginPath(); g.roundRect(-w / 2 + 8, -h / 2 + 10, w, h, 38); g.fillStyle = INKC; g.fill();
  g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 38); g.fillStyle = '#fff'; g.fill(); g.stroke();
  g.beginPath(); g.moveTo(tx - 26, h / 2 - 8); g.lineTo(tx + 26, h / 2 - 8); g.strokeStyle = '#fff'; g.lineWidth = 10; g.stroke();
  all.forEach((l, i) => txt(l, -w / 2 + 40, -h / 2 + 28 + lh * (i + .78), { size, w: 900, color: INKC }));
  g.restore();
}
function numStamp(val, x, y, ts) {
  if (ts <= -.1) return; const q = clamp(ts / .6), p = back(seg(ts, -.1, .25));
  const digits = val.replace(/[^\d]/g, ''), n = Math.round(+digits * eo(q)), shown = digits ? val.replace(/[\d][\d\s]*\d|\d/, String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) : val;
  const size = 104, w = Math.max(tw(val, size, 900), 200) + 90, h = size * 1.35;
  x = clamp(x, w / 2 + 30, W - w / 2 - 30);
  g.save(); g.translate(x, y); g.rotate(-.06 + Math.sin(ts * 3) * .01); g.scale(p, p);
  // «взрыв» за цифрой
  g.beginPath(); for (let i = 0; i < 24; i++) { const a = i / 24 * 6.2832, r = i % 2 ? w * .5 : w * .62; g.lineTo(Math.cos(a) * r, Math.sin(a) * r * .62); } g.closePath(); g.fillStyle = '#7be495'; g.fill(); g.strokeStyle = INKC; g.lineWidth = 7; g.lineJoin = 'round'; g.stroke();
  g.beginPath(); g.roundRect(-w / 2 + 30, -h / 2, w - 60, h, 24); g.fillStyle = '#fffaf0'; g.fill(); g.stroke();
  txt(shown, 0, size * .36, { size, w: 900, color: INKC, align: 'center' });
  g.restore();
}
function speedLines(x, y, ts) {
  if (ts <= 0 || ts > 1.6) return; const a = Math.min(1, ts * 6) * (1 - seg(ts, 1.2, 1.6));
  g.save(); g.globalAlpha *= a * .8; g.strokeStyle = INKC; g.lineCap = 'round';
  for (let i = 0; i < 46; i++) { const ang = i / 46 * 6.2832 + rnd(i * 7.1 + Math.floor(FR / 2)) * .08, r0 = 330 + rnd(i * 3.3 + Math.floor(FR / 2)) * 140, r1 = 1300;
    g.lineWidth = 3 + rnd(i * 1.7) * 9; g.beginPath(); g.moveTo(x + Math.cos(ang) * r0, y + Math.sin(ang) * r0); g.lineTo(x + Math.cos(ang) * r1, y + Math.sin(ang) * r1); g.stroke(); }
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
const HAM = { fur: '#f4a650', furL: '#ffcf8c', furD: '#d47d33', cream: '#fff4e2', creamD: '#f3dcc0', pink: '#ff9fb2', nose: '#ff7a92', LW: 6.5, suit: '#2b3a6e', suitL: '#40549a', suitD: '#18214a' };
const CAT = { ham: true, cat: true, ph: .7, outfit: 'banker', fur: '#9a9ca8', furL: '#c9cbd4', furD: '#6d6f7a', cream: '#eef0f5', creamD: '#d4d7e0', pink: '#f2a1b4', nose: '#e5869d',
  suit: '#26272f', suitL: '#3c3e4b', suitD: '#121217', tie: '#c2253a', tie2: '#ea4a5c' };
const MOLE = { ham: true, mole: true, ph: 2.3, outfit: 'hoodie', hood: '#4fae6e', fur: '#6a5a72', furL: '#9a89a3', furD: '#43364b', cream: '#d9cbd8', creamD: '#bfaebf', pink: '#ff9fb6', nose: '#ff7f9f' };
const SQUIRREL = { ham: true, squirrel: true, ph: 1.1, fur: '#e2662c', furL: '#ff9d5c', furD: '#a9461b', cream: '#fff1df', creamD: '#f2d9bd', pink: '#ffb0a0', nose: '#5a2a1a' };
const HOG = { ham: true, hog: true, ph: 1.7, outfit: 'hoodie', hood: '#e5484d', fur: '#c99a6e', furL: '#e8c29a', furD: '#9a6c45', cream: '#f6e3c8', creamD: '#e6caa5', pink: '#f3a3a3', nose: '#2a1d1a', spike: '#5b3f2c' };
const LION = { ham: true, lion: true, ph: 2.6, outfit: 'lion', velvet: '#1d5a49', fur: '#e9b55c', furL: '#f8d894', furD: '#c08a3a', cream: '#fff4de', creamD: '#f0dcb6', pink: '#f2a38a', nose: '#3b2219', mane: '#a3401a', maneM: '#c95f22', maneL: '#e8893a', maneH: '#f7b860' };
const RACCOON = { ham: true, raccoon: true, ph: 1.9, outfit: 'hoodie', hood: '#f08c00', fur: '#8d8f99', furL: '#c3c5cc', furD: '#5f616b', cream: '#eceef2', creamD: '#d2d5dc', pink: '#e9a3b0', nose: '#1b1a20' };
const WOLF = { ham: true, wolf: true, ph: 2.2, outfit: 'hoodie', hood: '#2b8a3e', fur: '#7b879c', furL: '#b3bccb', furD: '#4d5669', cream: '#e9edf3', creamD: '#cdd4de', pink: '#e9a3b0', nose: '#18171c' };
const OWL = { ham: true, owl: true, ph: .9, fur: '#8d6b4b', furL: '#b48d68', furD: '#5f4530', cream: '#f3e6cf', creamD: '#e0cba8', pink: '#f0b48a', nose: '#f29a2e' };
const mixHex = (a, b, u) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - u) + parseInt(b.substr(i, 2), 16) * u).toString(16).padStart(2, '0')).join('');
const HEAD = { cy: -330, rx: 160, ry: 134 };   // голова чуть крупнее тела — так персонаж милее и лучше читается на маленьком экране
// пушистый контур: эллипс с клочками шерсти в секторах [от°, до°, высота] (0° — вправо, 90° — вниз)
function furEllipse(cx, cy, rx, ry, seed, tufts = [], amp = 1.6) {
  const n = 64, pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.2832, deg = a / D2R; let r = 0;
    for (const [a0, a1, h] of tufts) if (deg >= a0 && deg <= a1) r += (i % 2 ? h : -h * .2) * Math.sin(Math.PI * (deg - a0) / (a1 - a0));
    const j = boil(seed, i, amp); pts.push([cx + (rx + r + j) * Math.cos(a), cy + (ry + r + j) * Math.sin(a)]);
  }
  g.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  g.closePath();
}
const headPath = (dx = 0, dy = 0) => furEllipse(dx, HEAD.cy + dy, HEAD.rx, HEAD.ry, 2, [[18, 62, 16], [118, 162, 16], [255, 285, 7]]);
const bodyPath = (dx = 0, dy = 0) => roughEllipse(dx, -185 + dy, 142, 152, 1);
// объёмная заливка шерсти: свет сверху-слева, тень к краям
function furGrad(cx, cy, r) {
  const gr = g.createRadialGradient(cx - r * .38, cy - r * .5, r * .08, cx, cy, r * 1.12);
  gr.addColorStop(0, HC.furL || HC.fur); gr.addColorStop(.55, HC.fur); gr.addColorStop(1, HC.furD); return gr;
}
// контровой свет: тонкий яркий серп по правому краю формы (свет из-за спины героя)
function rimLight(path, col = 'rgba(255,246,225,.75)', off = 9) {
  g.save(); g.beginPath(); path(); g.clip(); g.beginPath(); path(); path(-off, off * .55); g.fillStyle = col; g.fill('evenodd'); g.restore();
}
let HC = HAM;   // цвета текущего рисуемого хомяка (у толпы — свои окрасы)
function inkStroke(w = HAM.LW) { g.strokeStyle = INKC; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); }
// формы тела: рисуются дважды — сначала толстый контур всех частей, потом заливка (так контур объединения получается цельным)
function hamShapes(P, E, T, pass) {
  const cheek = E.cheek || 0, ear = Math.sin(T * 1.7) * 2;
  const fill = (col) => { if (pass === 'stroke') { g.strokeStyle = INKC; g.lineWidth = HC.LW * 2; g.lineJoin = 'round'; g.stroke(); } else { g.fillStyle = col; g.fill(); } };
  // тело
  g.beginPath(); bodyPath(); fill(furGrad(0, -185, 150));
  // голова (наклоняется отдельно)
  g.save(); g.translate(0, -262); g.rotate(P.head * D2R); g.translate(0, 262);
  for (const sd of [-1, 1]) {
    if (HC.mole) { if (pass === 'fill') { g.beginPath(); roughEllipse(sd * 128, -400, 16, 12, 3 + sd); g.fillStyle = HC.furD; g.fill(); } continue; }   // у крота ушки едва видно
    if (HC.wolf) { // высокие острые уши волка, внутри тёмные с пушком
      const e = sd > 0 ? ear : -ear; g.beginPath(); g.moveTo(sd * 40, -440); g.quadraticCurveTo(sd * 64, -548 + e, sd * 100, -592 + e); g.quadraticCurveTo(sd * 150, -508, sd * 154, -396); g.closePath(); fill(furGrad(sd * 100, -480, 70));
      if (pass === 'fill') { g.beginPath(); g.moveTo(sd * 66, -446); g.quadraticCurveTo(sd * 82, -520 + e, sd * 100, -552 + e); g.quadraticCurveTo(sd * 130, -490, sd * 134, -420); g.closePath(); g.fillStyle = '#3b4252'; g.fill();
        for (const k of [0, 1, 2]) { g.beginPath(); g.moveTo(sd * (90 + k * 12), -440 - k * 6); g.lineTo(sd * (102 + k * 8), -474 - k * 10); g.strokeStyle = HC.cream; g.lineWidth = 4; g.lineCap = 'round'; g.stroke(); } }
      continue;
    }
    if (HC.raccoon) { // острые уши енота со светлой каймой
      const e = sd > 0 ? ear : -ear; g.beginPath(); g.moveTo(sd * 50, -436); g.quadraticCurveTo(sd * 84, -510 + e, sd * 116, -536 + e); g.quadraticCurveTo(sd * 146, -470, sd * 150, -392); g.closePath(); fill(furGrad(sd * 110, -460, 60));
      if (pass === 'fill') { g.beginPath(); g.moveTo(sd * 74, -440); g.quadraticCurveTo(sd * 96, -490 + e, sd * 114, -508 + e); g.quadraticCurveTo(sd * 132, -460, sd * 134, -414); g.closePath(); g.fillStyle = '#f1f3f5'; g.fill(); }
      continue;
    }
    if (HC.lion) { // круглые уши с тёмной серединкой — сидят в гриве
      const e = sd > 0 ? ear : -ear; g.beginPath(); roughEllipse(sd * 116, -436 + e, 38, 36, 3 + sd); fill(furGrad(sd * 116, -436, 40));
      if (pass === 'fill') { g.beginPath(); roughEllipse(sd * 118, -432 + e, 22, 20, 31 + sd, 1); g.fillStyle = '#7a3a1c'; g.fill(); }
      continue;
    }
    if (HC.owl) { // перьевые «ушки» совы
      const e = sd > 0 ? ear : -ear; g.beginPath(); g.moveTo(sd * 60, -444); g.quadraticCurveTo(sd * 96, -500 + e, sd * 132, -530 + e); g.quadraticCurveTo(sd * 140, -470, sd * 150, -410); g.closePath(); fill(furGrad(sd * 110, -470, 60));
      continue;
    }
    if (HC.squirrel) { // беличьи уши — высокие, с кисточками
      const e = sd > 0 ? ear : -ear; g.beginPath(); g.moveTo(sd * 52, -440); g.quadraticCurveTo(sd * 70, -540 + e, sd * 96, -572 + e); g.quadraticCurveTo(sd * 132, -500, sd * 136, -410); g.closePath(); fill(furGrad(sd * 96, -490, 60));
      if (pass === 'fill') { g.beginPath(); g.moveTo(sd * 74, -440); g.quadraticCurveTo(sd * 84, -510 + e, sd * 98, -536 + e); g.quadraticCurveTo(sd * 118, -490, sd * 120, -430); g.closePath(); g.fillStyle = HC.pink; g.fill();
        for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(sd * 96, -568 + e); g.quadraticCurveTo(sd * (96 + k * 14), -600 + e, sd * (92 + k * 22), -618 + e - Math.abs(k) * 6); g.strokeStyle = HC.furD; g.lineWidth = 7; g.lineCap = 'round'; g.stroke(); } }
      continue;
    }
    if (HC.cat) { // кошачьи уши — треугольники, внутри розовые
      const e = sd > 0 ? ear : -ear; g.beginPath(); g.moveTo(sd * 46, -432); g.quadraticCurveTo(sd * 92, -500 + e, sd * 122, -530 + e); g.quadraticCurveTo(sd * 150, -470, sd * 156, -380); g.closePath(); fill(furGrad(sd * 110, -460, 60));
      if (pass === 'fill') { g.beginPath(); g.moveTo(sd * 72, -440); g.quadraticCurveTo(sd * 100, -480 + e, sd * 118, -500 + e); g.quadraticCurveTo(sd * 134, -455, sd * 138, -410); g.closePath(); g.fillStyle = HC.pink; g.fill(); }
      continue;
    }
    g.beginPath(); roughEllipse(sd * 106, -446 + (sd > 0 ? ear : -ear), 39, 39, 3 + sd); fill(furGrad(sd * 106, -446, 40));
    if (pass === 'fill') { g.beginPath(); roughEllipse(sd * 106, -448 + (sd > 0 ? ear : -ear), 23, 24, 31 + sd, 1); const eg = g.createRadialGradient(sd * 106, -444, 2, sd * 106, -448, 25); eg.addColorStop(0, '#ff7f9a'); eg.addColorStop(1, HC.pink); g.fillStyle = eg; g.fill(); }
  }
  g.beginPath(); headPath(); fill(furGrad(0, HEAD.cy, 160));
  // щёки-копилка: раздуваются от монет
  if (cheek > .03) for (const sd of [-1, 1]) { g.beginPath(); furEllipse(sd * (124 + cheek * 20), -298, 30 + cheek * 38, 26 + cheek * 32, 7 + sd, [[sd > 0 ? 300 : 120, sd > 0 ? 420 : 240, 6]]); fill(furGrad(sd * (124 + cheek * 20), -298, 40 + cheek * 38)); }
  g.restore();
}
function drawHamster(L, x, y, k, P, E, T, o = {}) {
  HC = { ...HAM, ...L }; if (L.fur && !L.furL) HC.furL = mixHex(L.fur, '#ffffff', .32);   // окрас толпы: свой блик, а не рыжий
  const f = o.flip || 1, blinkPh = (T + L.ph * 3) % 3.6, blink = blinkPh < .12 ? Math.abs(blinkPh - .06) / .06 : 1;
  const breath = Math.sin(T * 2.3 + L.ph) * .012, air = Math.max(0, -P.lift), tu = (o.turn || 0) * 34;   // tu — поворот на три четверти: мордочка смещается к собеседнику
  g.save(); g.translate(x, y); g.scale(k * f * (1 - Math.abs(tu) / 560), k);
  // тень (уменьшается в прыжке)
  g.save(); g.fillStyle = INK ? 'rgba(27,26,31,.16)' : 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(0, 4, 128 * (1 - air / 300), 18, 0, 0, 6.2832); g.fill(); g.restore();
  // лапки-ступни (шагают, если персонаж идёт)
  for (const sd of [-1, 1]) { const lift = Math.max(0, sd < 0 ? P.lLeg : P.rLeg) * .9 + air; g.beginPath(); roughEllipse(sd * 62, -16 - lift, 46, 21, 11 + sd); g.fillStyle = HC.cream; g.fill(); inkStroke(); g.fillStyle = HC.pink; for (const tx of [-17, 0, 17]) { g.beginPath(); g.ellipse(sd * 62 + tx, -24 - lift, 6, 4.5, 0, 0, 6.2832); g.fill(); } }
  // подъём, растяжение в прыжке, дыхание; наклон корпуса вокруг «талии»
  g.translate(0, -air); const sy = 1 + Math.min(.09, air / 260) + breath; g.scale(1 / Math.sqrt(sy), sy);
  g.translate(0, -150); g.rotate(P.lean * D2R); g.translate(0, 150);
  if (HC.lion) { // хвост с кисточкой-пламенем и пышная грива за головой
    const sw = Math.sin(T * 2 + L.ph) * 14; g.beginPath(); g.moveTo(-80, -60); g.bezierCurveTo(-250, -30, -300 + sw, -180, -236 + sw, -290); g.lineCap = 'round'; g.strokeStyle = INKC; g.lineWidth = 32; g.stroke(); g.strokeStyle = HC.fur; g.lineWidth = 20; g.stroke();
    g.beginPath(); for (const [a, l] of [[-2.2, 70], [-1.6, 84], [-1.0, 66], [-2.7, 50]]) lionLock(-236 + sw, -280, a + Math.sin(T * 3 + a) * .12, l, 20, 10); g.strokeStyle = INKC; g.lineWidth = 10; g.lineJoin = 'round'; g.stroke(); g.fillStyle = HC.mane; g.fill();
    g.save(); g.translate(0, -262); g.rotate(P.head * D2R); g.translate(0, 262); lionMane(T, L.ph); g.restore();
  }
  if (HC.wolf) { // пушистый хвост: тёмный сверху, светлый кончик, покачивается
    const sw = Math.sin(T * 1.6 + L.ph) * 12, path = () => { g.beginPath(); g.moveTo(-60, -70); g.bezierCurveTo(-200, -50, -270 + sw, -90, -290 + sw, -200); };
    path(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INKC; g.lineWidth = 96; g.stroke(); g.strokeStyle = HC.furD; g.lineWidth = 82; g.stroke(); g.strokeStyle = HC.fur; g.lineWidth = 56; g.stroke();
    g.beginPath(); g.moveTo(-287 + sw, -178); g.quadraticCurveTo(-290 + sw, -190, -290 + sw, -200); g.strokeStyle = HC.cream; g.lineWidth = 56; g.stroke();
  }
  if (HC.raccoon) { // полосатый хвост
    const sw = Math.sin(T * 1.7 + L.ph) * 14, path = () => { g.beginPath(); g.moveTo(-60, -70); g.bezierCurveTo(-240, -80, -300 + sw, -260, -200 + sw, -360); };
    path(); g.lineCap = 'round'; g.strokeStyle = INKC; g.lineWidth = 92; g.stroke(); g.strokeStyle = HC.fur; g.lineWidth = 78; g.stroke();
    g.save(); g.setLineDash([26, 30]); path(); g.strokeStyle = '#2b2d33'; g.lineWidth = 78; g.lineCap = 'butt'; g.stroke(); g.restore();
  }
  if (HC.hog) { // иголки ежа: зубчатый «ореол» вокруг головы и спины, чуть шевелятся
    g.beginPath(); const N = 34; g.moveTo(-150, -110);
    for (let i = 0; i <= N; i++) { const a = -Math.PI * 1.1 + Math.PI * 1.2 * i / N, r = i % 2 ? 1 : 1.24 + Math.sin(T * 3 + i) * .015; g.lineTo(Math.cos(a) * 205 * r, -300 + Math.sin(a) * 225 * r); }
    g.lineTo(150, -110); g.closePath(); g.fillStyle = HC.spike; g.fill(); g.strokeStyle = INKC; g.lineWidth = HC.LW * 1.6; g.lineJoin = 'round'; g.stroke();
    for (let i = 1; i < N; i += 2) { const a = -Math.PI * 1.1 + Math.PI * 1.2 * i / N; g.beginPath(); g.moveTo(Math.cos(a) * 150, -300 + Math.sin(a) * 170); g.lineTo(Math.cos(a) * 225, -300 + Math.sin(a) * 250); g.strokeStyle = 'rgba(255,230,200,.35)'; g.lineWidth = 4; g.stroke(); }
  }
  if (HC.squirrel) { // пушистый хвост-вопрос за спиной: покачивается и пружинит
    const sw = Math.sin(T * 1.8 + L.ph) * 16, path = () => { g.beginPath(); g.moveTo(-60, -70); g.bezierCurveTo(-260, -110, -330 + sw, -360, -190 + sw, -470); };
    path(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = INKC; g.lineWidth = 150; g.stroke(); g.strokeStyle = HC.furD; g.lineWidth = 136; g.stroke(); g.strokeStyle = HC.fur; g.lineWidth = 104; g.stroke(); g.strokeStyle = HC.furL; g.lineWidth = 40; g.stroke();
    for (let i = 0; i < 9; i++) { const a = i * .7 + T * .5; g.beginPath(); g.arc(-230 + Math.cos(a) * 60 + sw * .6, -260 + Math.sin(a * 1.3) * 160, 5, 0, 6.2832); g.fillStyle = 'rgba(255,240,220,.45)'; g.fill(); }
  }
  if (HC.cat) { // хвост за спиной, покачивается
    const sw = Math.sin(T * 2.1 + L.ph) * 18; g.beginPath(); g.moveTo(-90, -70); g.bezierCurveTo(-250, -40, -300 + sw, -250, -200 + sw, -350);
    g.lineCap = 'round'; g.strokeStyle = INKC; g.lineWidth = 54; g.stroke(); g.strokeStyle = HC.fur; g.lineWidth = 40; g.stroke();
    g.beginPath(); g.moveTo(-232 + sw, -300); g.lineTo(-200 + sw, -350); g.strokeStyle = HC.furD; g.lineWidth = 40; g.stroke();
  }
  hamShapes(P, E, T, 'stroke'); hamShapes(P, E, T, 'fill');
  const OF = OUTFITS[L.outfit];
  // всё «туловищное» обрезаем по телу без головы, чтобы ничего не залезало на мордочку
  // (клип задаётся в повёрнутой системе головы, затем поворот снимается — save/restore сбросил бы и сам клип)
  g.save(); g.beginPath(); bodyPath(); g.clip(); g.translate(0, -262); g.rotate(P.head * D2R); g.translate(0, 262); g.beginPath(); g.rect(-400, -700, 800, 800); headPath(); g.clip('evenodd'); g.translate(0, -262); g.rotate(-P.head * D2R); g.translate(0, 262);
  if (OF) OF.body();
  if (L.acc && typeof NEWS_ACC !== 'undefined') NEWS_ACC[L.acc]?.(L);   // «Зверо-новости»: бусы, бабочка, шарф — наряд дня
  else { g.beginPath(); roughEllipse(0, -158, 100, 108, 21, 1.2); const cg = g.createLinearGradient(0, -260, 0, -50); cg.addColorStop(0, HC.cream); cg.addColorStop(1, HC.creamD || HC.cream); g.fillStyle = cg; g.fill(); }
  if (!OF && HC.owl) for (let r = 0; r < 4; r++) for (let c = -2; c <= 2; c++) { const x = c * 34 + (r % 2) * 17, y = -220 + r * 36; if (Math.abs(x) > 80 - r * 6) continue; g.beginPath(); g.moveTo(x - 10, y); g.quadraticCurveTo(x, y + 12, x + 10, y); g.strokeStyle = HC.furD; g.lineWidth = 4; g.lineCap = 'round'; g.stroke(); }   // пёрышки на груди совы
  // светотень: тёплая (или холодная на пиджаке) тень по правому краю
  g.beginPath(); g.rect(-300, -400, 600, 420); g.ellipse(-34, -210, 150, 175, 0, 0, 6.2832); g.fillStyle = OF ? 'rgba(10,15,45,.26)' : 'rgba(170,85,20,.22)'; g.fill('evenodd');
  // голова отбрасывает мягкую тень на костюм
  g.save(); g.translate(0, -262); g.rotate(P.head * D2R); g.translate(0, 262); g.beginPath(); headPath(0, 14); g.fillStyle = OF ? 'rgba(5,8,30,.24)' : 'rgba(150,70,15,.2)'; g.fill();
  g.beginPath(); headPath(); inkStroke(HC.LW * 1.8); g.restore();
  g.restore();
  rimLight(() => bodyPath(), OF?.cool ? 'rgba(150,180,255,.55)' : 'rgba(255,240,210,.7)');
  if (HC.lion) { g.save(); g.translate(0, -262); g.rotate(P.head * D2R); g.translate(0, 262); lionBib(T, L.ph); g.restore(); }
  // голова: мордочка, уши, лицо
  g.save(); g.translate(0, -262); g.rotate(P.head * D2R); g.translate(0, 262);
  g.save(); g.beginPath(); headPath(); g.clip();
  g.beginPath(); g.rect(-300, -480, 600, 300); g.ellipse(-40, -350, 158, 146, 0, 0, 6.2832); g.fillStyle = HC.wolf ? 'rgba(25,35,70,.2)' : 'rgba(170,85,20,.2)'; g.fill('evenodd'); g.restore();
  rimLight(() => headPath());
  if (HC.lion || HC.wolf) g.beginPath();   // у льва и волка мордочка своя — в lionFace / wolfFace
  else if (HC.cat) g.beginPath(), furEllipse(tu * .8, -298, 84, 54, 22, [[15, 70, 5], [110, 165, 5]], 1.2); else g.beginPath(), furEllipse(tu * .8, -294, 104, 68, 22, [[15, 70, 6], [110, 165, 6]], 1.2);
  const mg = g.createRadialGradient(-20 + tu, -320, 10, tu, -294, 110); mg.addColorStop(0, '#fffaf0'); mg.addColorStop(1, HC.cream); g.fillStyle = mg; g.fill();
  // хохолок (три волоска, раскачиваются с запаздыванием)
  const sway = Math.sin(T * 2.6 + L.ph) * 5 + P.lean * 1.4 + P.head * .8;
  if (!HC.cat && !HC.mole && !HC.squirrel && !HC.hog && !HC.owl && !HC.lion && !HC.raccoon && !HC.wolf && !OF?.hat) for (const [dx, h] of [[-12, 30], [2, 40], [16, 28]]) { g.beginPath(); g.moveTo(dx, -455); g.quadraticCurveTo(dx + sway * .5 - 6, -455 - h * .6, dx + sway + 4, -455 - h); inkStroke(5); }
  if (HC.lion) lionForelock(T, sway);
  if (tu) { g.save(); g.translate(tu, 0); g.scale(1 - Math.abs(tu) / 300, 1); hamFace(E, blink, T); g.restore(); } else hamFace(E, blink, T);
  if (E.phones) headphones();
  OF?.hat?.(T, sway); if (OF?.helmet) helmet();
  if (L.hat && typeof NEWS_HATS !== 'undefined') NEWS_HATS[L.hat]?.(T, sway, L);   // берет, шляпа ведьмы, колпак Деда Мороза, тыква
  g.restore();
  // лапки: короткие «сосиски» с кремовыми ладошками; правая (рабочая) держит предмет
  for (const [sd, ang] of [[-1, P.hl], [1, P.hr]]) {
    g.save(); g.translate(sd * 104, -246); g.rotate(-sd * ang * D2R);
    g.beginPath(); roughEllipse(0, 36, 22, 46, 41 + sd, 1.2); g.fillStyle = OF ? OF.sleeve() : HC.fur; g.fill(); inkStroke();
    if (OF?.cuff) { g.beginPath(); roughEllipse(0, 70, 19, 9, 45 + sd, .8); g.fillStyle = OF.cuff; g.fill(); inkStroke(4); }
    if (HC.mole) { g.beginPath(); roughEllipse(0, 82, 26, 22, 51 + sd, 1); g.fillStyle = HC.pink; g.fill(); inkStroke(5); for (const cx of [-14, 0, 14]) { g.beginPath(); g.moveTo(cx - 5, 98); g.lineTo(cx, 116); g.lineTo(cx + 5, 98); g.fillStyle = '#fff6e8'; g.fill(); inkStroke(3); } }   // лапы-копалки с когтями
    else { g.beginPath(); roughEllipse(0, 80, 18, 17, 51 + sd, 1); g.fillStyle = HC.cream; g.fill(); inkStroke(5); }
    if (o.held && sd === 1) { g.translate(0, 88); o.held(f); }
    g.restore();
  }
  g.restore();
}
// костюм: приталенный пиджак с объёмом ткани, лацканы, рубашка с воротником, галстук с зажимом, значок-монета, платок
function hamSuit() {
  const sg = g.createLinearGradient(-160, -360, 150, 20); sg.addColorStop(0, HC.suitL); sg.addColorStop(.45, HC.suit); sg.addColorStop(1, HC.suitD);
  g.fillStyle = sg; g.fillRect(-170, -360, 340, 370);
  g.save(); g.translate(0, 16);   // вырез рубашки и галстук выглядывают из-под подбородка
  g.save(); g.globalAlpha *= .035; g.strokeStyle = '#fff'; g.lineWidth = 2; for (let i = -24; i < 24; i++) { g.beginPath(); g.moveTo(i * 16, -360); g.lineTo(i * 16 + 140, 10); g.stroke(); } g.restore();   // фактура ткани
  // рубашка и воротник
  const shg = g.createLinearGradient(0, -232, 0, -108); shg.addColorStop(0, '#fff'); shg.addColorStop(1, '#e4e8f2');
  g.beginPath(); g.moveTo(-58, -230); g.lineTo(58, -230); g.lineTo(0, -108); g.closePath(); g.fillStyle = shg; g.fill(); inkStroke(4);
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 4, -230); g.lineTo(sd * 46, -232); g.lineTo(sd * 22, -200); g.closePath(); g.fillStyle = '#fff'; g.fill(); inkStroke(3.5); }
  // галстук: узел и полотно с косыми полосками
  const tg = g.createLinearGradient(-15, -214, 15, -118); tg.addColorStop(0, HC.tie || VIO); tg.addColorStop(1, HC.tie2 || VIO2);
  g.beginPath(); g.moveTo(-12, -216); g.lineTo(12, -216); g.lineTo(8, -196); g.lineTo(-8, -196); g.closePath(); g.fillStyle = tg; g.fill(); inkStroke(3.5);
  g.beginPath(); g.moveTo(-8, -196); g.lineTo(8, -196); g.lineTo(16, -138); g.lineTo(0, -116); g.lineTo(-16, -138); g.closePath(); g.fillStyle = tg; g.fill(); inkStroke(3.5);
  g.save(); g.clip(); g.globalAlpha *= .3; g.strokeStyle = INKC; g.lineWidth = 3; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(-20, -200 + i * 16); g.lineTo(20, -184 + i * 16); g.stroke(); } g.restore();
  g.beginPath(); g.roundRect(-22, -164, 44, 7, 3); g.fillStyle = '#f2cf6b'; g.fill(); inkStroke(2.5);   // зажим
  // лацканы: отдельные плоскости ткани с бликом по краю
  for (const sd of [-1, 1]) {
    g.beginPath(); g.moveTo(sd * 58, -230); g.lineTo(sd * 2, -110); g.lineTo(sd * 8, -100); g.lineTo(sd * 70, -166); g.lineTo(sd * 50, -180); g.lineTo(sd * 80, -236); g.closePath();
    g.fillStyle = sd < 0 ? HC.suitL : HC.suit; g.fill(); inkStroke(4);
    g.beginPath(); g.moveTo(sd * 76, -232); g.lineTo(sd * 52, -182); g.strokeStyle = 'rgba(180,200,255,.45)'; g.lineWidth = 3; g.stroke();
  }
  // значок канала на лацкане — золотая монета
  g.restore();
  g.beginPath(); g.arc(-62, -190, 10, 0, 6.2832); const pg = g.createRadialGradient(-65, -194, 1, -62, -190, 11); pg.addColorStop(0, '#fff2b8'); pg.addColorStop(1, '#e0a92e'); g.fillStyle = pg; g.fill(); inkStroke(2.5);
  // пуговицы с золотым ободком
  for (const by of [-86, -56]) { g.beginPath(); g.arc(0, by, 7, 0, 6.2832); g.fillStyle = '#d9b14a'; g.fill(); g.beginPath(); g.arc(0, by, 4.5, 0, 6.2832); g.fillStyle = INKC; g.fill(); }
  // нагрудный карман с платком
  g.beginPath(); g.moveTo(-110, -168); g.lineTo(-100, -186); g.lineTo(-94, -170); g.lineTo(-84, -184); g.lineTo(-76, -168); g.closePath(); g.fillStyle = HC.tie || VIO; g.fill(); inkStroke(3);
  g.beginPath(); g.moveTo(-116, -166); g.lineTo(-70, -166); inkStroke(4.5);
}
// ---------- гардероб эпизода: каждый ролик хомяк может быть в своём образе ----------
const shade = (c, u) => mixHex(c, u > 0 ? '#ffffff' : '#000000', Math.abs(u));
function clothBase(c) { const gr = g.createLinearGradient(-160, -360, 150, 20); gr.addColorStop(0, shade(c, .22)); gr.addColorStop(.5, c); gr.addColorStop(1, shade(c, -.3)); g.fillStyle = gr; g.fillRect(-170, -360, 340, 370); }
function hamHoodie() {
  const c = HC.hood || VIO; clothBase(c);
  g.beginPath(); roughEllipse(0, -206, 156, 50, 601, 1.2); g.fillStyle = shade(c, -.18); g.fill(); inkStroke(5);   // капюшон лежит на плечах
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 26, -186); g.quadraticCurveTo(sd * 32, -150, sd * 22, -118); g.strokeStyle = INKC; g.lineWidth = 9; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); g.beginPath(); g.arc(sd * 22, -114, 7, 0, 6.2832); g.fillStyle = '#fff'; g.fill(); inkStroke(3); }
  g.beginPath(); g.moveTo(-86, -30); g.lineTo(-62, -96); g.lineTo(62, -96); g.lineTo(86, -30); g.fillStyle = shade(c, -.08); g.fill(); inkStroke(4.5);
  g.beginPath(); g.arc(0, -64, 20, 0, 6.2832); g.fillStyle = '#f2cf6b'; g.fill(); inkStroke(3.5); txt('₽', 0, -55, { size: 26, w: 900, color: INKC, align: 'center' });
}
function hamTrench() {
  const c = '#c9a46a'; clothBase(c);
  g.beginPath(); g.moveTo(-40, -230); g.lineTo(40, -230); g.lineTo(0, -150); g.closePath(); g.fillStyle = '#efe6d4'; g.fill(); inkStroke(3.5);
  g.beginPath(); g.moveTo(-8, -222); g.lineTo(8, -222); g.lineTo(12, -168); g.lineTo(0, -154); g.lineTo(-12, -168); g.closePath(); g.fillStyle = '#5a3a2a'; g.fill(); inkStroke(3);
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 40, -232); g.lineTo(sd * 2, -150); g.lineTo(sd * 30, -96); g.lineTo(sd * 110, -150); g.lineTo(sd * 86, -170); g.lineTo(sd * 104, -236); g.closePath(); g.fillStyle = shade(c, sd < 0 ? .1 : -.08); g.fill(); inkStroke(4); }
  g.fillStyle = '#8f6d3b'; g.fillRect(-170, -78, 340, 28); g.beginPath(); g.rect(-170, -78, 340, 28); inkStroke(3.5);
  g.beginPath(); g.roundRect(-16, -82, 32, 36, 5); g.strokeStyle = '#e0b04a'; g.lineWidth = 6; g.stroke();
  for (const [bx, by] of [[-38, -128], [38, -128], [-38, -20], [38, -20]]) { g.beginPath(); g.arc(bx, by, 7, 0, 6.2832); g.fillStyle = '#5a3a2a'; g.fill(); inkStroke(2.5); }
}
function hamSpacesuit() {
  const c = '#eef1f6'; clothBase(c);
  g.beginPath(); roughEllipse(0, -204, 150, 40, 611, 1); g.fillStyle = '#aab3c2'; g.fill(); inkStroke(5);   // кольцо шлема
  g.beginPath(); g.roundRect(-62, -150, 124, 82, 12); g.fillStyle = '#c7cfdb'; g.fill(); inkStroke(4);
  [['#e8394d', -36], ['#2fbf71', -6], [VIO, 24]].forEach(([col, bx]) => { g.beginPath(); g.arc(bx + 6, -126, 10, 0, 6.2832); g.fillStyle = col; g.fill(); inkStroke(2.5); });
  g.fillStyle = '#5b6372'; g.fillRect(-46, -98, 92, 12);
  g.beginPath(); g.roundRect(-128, -176, 52, 34, 5); g.fillStyle = VIO; g.fill(); inkStroke(3); txt('₽', -102, -150, { size: 24, w: 900, color: INKC, align: 'center' });
}
function hamTrack() {
  const c = HC.hood || VIO; clothBase(c);
  for (const sd of [-1, 1]) { g.fillStyle = '#fff'; g.fillRect(sd * 128 - 9, -330, 18, 340); g.fillRect(sd * 104 - 6, -330, 10, 340); }
  g.beginPath(); roughEllipse(0, -206, 120, 34, 621, 1); g.fillStyle = shade(c, -.2); g.fill(); inkStroke(4.5);
  g.beginPath(); g.moveTo(0, -180); g.lineTo(0, 10); inkStroke(5); g.beginPath(); g.roundRect(-7, -176, 14, 24, 3); g.fillStyle = '#d9dde4'; g.fill(); inkStroke(2.5);
}
// головные уборы рисуются в системе головы
function hatFedora() {
  g.beginPath(); g.ellipse(0, -452, 176, 30, 0, 0, 6.2832); g.fillStyle = '#7a5a33'; g.fill(); inkStroke(6);
  g.beginPath(); g.moveTo(-104, -458); g.bezierCurveTo(-108, -560, -40, -580, 0, -548); g.bezierCurveTo(40, -580, 108, -560, 104, -458); g.closePath(); g.fillStyle = '#8d6a3e'; g.fill(); inkStroke(6);
  g.fillStyle = '#3a2a1a'; g.beginPath(); g.moveTo(-106, -486); g.lineTo(106, -486); g.lineTo(104, -462); g.lineTo(-104, -462); g.closePath(); g.fill();
}
function headband() {
  g.save(); g.beginPath(); headPath(); g.clip();
  g.beginPath(); g.ellipse(0, HEAD.cy + 10, HEAD.rx + 6, HEAD.ry + 6, 0, Math.PI * 1.08, Math.PI * 1.92); g.strokeStyle = INKC; g.lineWidth = 40; g.stroke(); g.strokeStyle = HC.hood || VIO; g.lineWidth = 30; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 6; g.stroke();
  g.restore();
}
function topHat(T) {
  g.save(); g.rotate(-.08);
  g.beginPath(); g.ellipse(0, -458, 150, 26, 0, 0, 6.2832); g.fillStyle = '#1b1a20'; g.fill(); inkStroke(6);
  g.beginPath(); g.roundRect(-90, -640, 180, 185, [10, 10, 4, 4]); const hg = g.createLinearGradient(-90, 0, 90, 0); hg.addColorStop(0, '#3a3a44'); hg.addColorStop(.4, '#1b1a20'); hg.addColorStop(1, '#0d0d10'); g.fillStyle = hg; g.fill(); inkStroke(6);
  g.fillStyle = HC.tie || '#c2253a'; g.fillRect(-90, -512, 180, 30); g.beginPath(); g.rect(-90, -512, 180, 30); inkStroke(3.5);
  g.restore();
}
function helmet() {
  g.beginPath(); g.arc(0, -340, 222, 0, 6.2832); g.fillStyle = 'rgba(190,225,255,.07)'; g.fill(); inkStroke(7);
  g.beginPath(); g.arc(0, -340, 196, Math.PI * 1.1, Math.PI * 1.45); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 12; g.lineCap = 'round'; g.stroke();
  g.beginPath(); g.arc(0, -340, 196, Math.PI * 1.55, Math.PI * 1.62); g.stroke();
}
const OUTFITS = {
  suit: { body: () => hamSuit(), sleeve: () => HC.suit, cuff: '#fff', cool: true },
  banker: { body: () => hamSuit(), sleeve: () => HC.suit, cuff: '#fff', cool: true, hat: topHat },
  hoodie: { body: hamHoodie, sleeve: () => HC.hood || VIO },
  detective: { body: hamTrench, sleeve: () => '#c9a46a', hat: hatFedora },
  astronaut: { body: hamSpacesuit, sleeve: () => '#e3e8f0', cuff: '#aab3c2', helmet: true, cool: true },
  sport: { body: hamTrack, sleeve: () => HC.hood || VIO, hat: headband },
  lion: { body: () => lionBlazer(), sleeve: () => HC.velvet, cuff: '#e8b93a', cool: true },
};
// глаза кота: миндалевидные, вертикальный зрачок, ленивое веко — вид хитрый
function catEyes(E, blink) {
  const ex = E.lx * 6, ey = E.ly * 5, happy = E.smile > .7 && E.open > .3, shock = E.brow > .75 && E.open > .7;
  for (const sd of [-1, 1]) {
    const cx = sd * 62, cy = -350;
    if (E.sleep > .5 || happy) { g.beginPath(); g.moveTo(cx - 22, cy + 6); g.quadraticCurveTo(cx, cy - 18, cx + 22, cy + 6); inkStroke(8); continue; }
    const ry = Math.max(2, (shock ? 34 : 26) * blink);
    g.beginPath(); g.ellipse(cx, cy, 30, ry, 0, 0, 6.2832); const gr = g.createRadialGradient(cx, cy + 6, 2, cx, cy, 30); gr.addColorStop(0, '#f6f08a'); gr.addColorStop(1, '#9bc53d'); g.fillStyle = gr; g.fill(); inkStroke(4.5);
    if (blink > .5) {
      g.beginPath(); g.ellipse(cx + ex, cy + ey, shock ? 10 : 5.5, ry * .82, 0, 0, 6.2832); g.fillStyle = INKC; g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + ex + 7, cy - 9, 5, 0, 6.2832); g.fill();
      if (!shock) { // ленивое веко сверху
        const lid = E.brow < -.3 ? .5 : .32; g.save(); g.beginPath(); g.ellipse(cx, cy, 31, ry + 1, 0, 0, 6.2832); g.clip();
        g.fillStyle = HC.fur; g.fillRect(cx - 34, cy - ry - 2, 68, ry * 2 * lid + 2); g.restore();
        g.beginPath(); g.moveTo(cx - 30, cy - ry + ry * 2 * lid); g.lineTo(cx + 30, cy - ry + ry * 2 * lid - sd * 4); inkStroke(5);
      }
    }
  }
}
// реакция слушающего ведущего: по смыслу фразы (вопрос, восклицание, шутка Крота, поздравление) и немного случайности
function listenReact(s, t, c, P, E, T) {
  const txt0 = s.text, joke = /^Крот:/.test(txt0) && c.kind === 'owl', wow = /!|шок|рекорд|срочно|вау/i.test(txt0), q = /\?/.test(txt0), warm = /поздрав|счасть|любов|свадьб|родител|хорош/i.test(txt0);
  const kind = joke ? (s.idx % 2 ? 'eyeroll' : 'laugh') : warm ? 'smile' : wow ? 'wow' : q ? 'think' : ['nod', 'smile', 'nod', 'blink'][(s.idx + (c.kind === 'mole' ? 1 : 0)) % 4];
  const k = seg(t, .25, .6);   // реакция догоняет фразу, а не начинается вместе с ней
  if (kind === 'nod') { P.head += Math.sin(t * 7) * 6 * k; E.smile = Math.max(E.smile || 0, .4 * k); }
  if (kind === 'smile') { E.smile = .9 * k; E.blush = Math.max(E.blush || 0, .6 * k); P.head += Math.sin(t * 2.5) * 3; }
  if (kind === 'wow') { const w = Math.exp(-Math.max(0, t - .4) * 1.5) * k; E.brow = .9 * w; E.open = .5 * w; P.lift = -14 * Math.abs(Math.sin(t * 6)) * w; }
  if (kind === 'think') { E.brow = -.3 * k; E.lx = .5; E.ly = -.7 * k; P.head += -6 * k; }
  if (kind === 'laugh') { E.smile = 1 * k; E.open = (.4 + .3 * Math.abs(Math.sin(t * 13))) * k; P.head += Math.sin(t * 13) * 4 * k; P.lift = -Math.abs(Math.sin(t * 13)) * 8 * k; }
  if (kind === 'eyeroll') { E.ly = -.9 * k; E.lx = Math.sin(t * 3) * .6 * k; E.brow = -.4 * k; P.head += 5 * k; }
  if (kind === 'blink') { E.smile = .3; P.head += Math.sin(t * 1.5) * 4; }
}
// наушники: дуга через макушку и красные чашки по бокам головы
function headphones() {
  g.beginPath(); g.arc(0, -340, 178, Math.PI * 1.1, Math.PI * 1.9); g.lineCap = 'round'; g.strokeStyle = INKC; g.lineWidth = 30; g.stroke(); g.strokeStyle = '#2b2d42'; g.lineWidth = 18; g.stroke();
  for (const sd of [-1, 1]) { g.beginPath(); g.roundRect(sd * 168 - 30, -400, 60, 110, 24); g.fillStyle = '#e5383b'; g.fill(); inkStroke(5); g.beginPath(); g.roundRect(sd * 168 - 14, -380, 28, 70, 12); g.fillStyle = '#ff8787'; g.fill(); }
}
function monocle() {
  g.beginPath(); g.arc(62, -350, 42, 0, 6.2832); g.fillStyle = 'rgba(220,240,255,.18)'; g.fill(); g.strokeStyle = INKC; g.lineWidth = 10; g.stroke(); g.strokeStyle = '#e0b04a'; g.lineWidth = 5; g.stroke();
  g.beginPath(); g.moveTo(96, -326); g.quadraticCurveTo(130, -250, 96, -190); g.strokeStyle = '#e0b04a'; g.lineWidth = 3; g.stroke();
}
// мордочка крота: без очков — щёлочки (слепой как котёнок), в очках — огромные глаза за толстыми линзами; большой розовый нос
function moleFace(E, blink, T) {
  const gl = Math.max(E.glasses || 0, E.shades || 0), ex = E.lx * 7, ey = E.ly * 6, shock = E.brow > .75 && E.open > .7;
  for (const sd of [-1, 1]) {
    const cx = sd * 62, cy = -356;
    if (gl < .5) { // щёлочки и прищур
      g.beginPath(); g.moveTo(cx - 16, cy + 2); g.quadraticCurveTo(cx, cy + (shock ? -10 : 6), cx + 16, cy + 2); inkStroke(7);
      g.beginPath(); g.moveTo(cx - 22, cy - 18 - E.brow * 10); g.lineTo(cx + 18, cy - 24 - E.brow * 12 + sd * 2); inkStroke(6);
    }
  }
  if (gl > .01) {
    const oy = (1 - emph(clamp(gl))) * -170, r = 54;
    for (const sd of [-1, 1]) {
      const cx = sd * 62, cy = -356 + oy;
      g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.fillStyle = '#fff'; g.fill();
      const pr = shock ? 13 : 22; g.beginPath(); g.arc(cx + ex * 1.6, cy + ey * 1.6 + 4, pr, 0, 6.2832); g.fillStyle = INKC; g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + ex * 1.6 + 8, cy + ey * 1.6 - 5, 7, 0, 6.2832); g.fill();
      for (const rr of [r * .72, r * .86]) { g.beginPath(); g.arc(cx, cy, rr, 0, 6.2832); g.strokeStyle = 'rgba(120,170,220,.35)'; g.lineWidth = 3; g.stroke(); }
      g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.strokeStyle = INKC; g.lineWidth = 13; g.stroke(); g.strokeStyle = '#2b2f3a'; g.lineWidth = 7; g.stroke();
      g.beginPath(); g.ellipse(cx - 20, cy - 24, 14, 7, -.6, 0, 6.2832); g.fillStyle = 'rgba(255,255,255,.7)'; g.fill();
    }
    g.beginPath(); g.moveTo(-10, -360 + oy); g.quadraticCurveTo(0, -372 + oy, 10, -360 + oy); inkStroke(7);
  }
  if (E.blush > .05) for (const sd of [-1, 1]) { g.save(); g.globalAlpha *= .6 * E.blush; g.fillStyle = 'rgba(255,120,150,.9)'; g.beginPath(); g.ellipse(sd * 104, -300, 26, 16, 0, 0, 6.2832); g.fill(); g.restore(); }
  for (const sd of [-1, 1]) for (const dy of [-4, 10]) { g.save(); g.globalAlpha *= .7; g.beginPath(); g.moveTo(sd * 46, -298 + dy); g.lineTo(sd * 108, -302 + dy * 1.8); inkStroke(3); g.restore(); }
  // нос-пятачок: крупный, розовый, шевелится
  const wig = Math.sin(T * 9) * 2.5;
  // мордочка-хоботок светлее, нос-«звёздочка» на конце (как у настоящего крота)
  g.beginPath(); g.ellipse(0, -300, 70, 46, 0, 0, 6.2832); g.fillStyle = mixHex(HC.cream, '#ffffff', .25); g.fill();
  g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * 6.2832 - Math.PI / 2, r = i % 2 ? 26 : 38, a2 = a + Math.PI / 10; const px = wig + Math.cos(a) * r * 1.15, py = -326 + Math.sin(a) * r * .8; i ? g.quadraticCurveTo(wig + Math.cos(a - Math.PI / 10) * 44, -326 + Math.sin(a - Math.PI / 10) * 32, px, py) : g.moveTo(px, py); }
  g.closePath(); const ng = g.createRadialGradient(wig - 10, -336, 3, wig, -326, 44); ng.addColorStop(0, '#ffd0dc'); ng.addColorStop(1, HC.nose); g.fillStyle = ng; g.fill(); inkStroke(4.5);
  for (const sd of [-1, 1]) { g.beginPath(); g.arc(wig + sd * 9, -322, 3.5, 0, 6.2832); g.fillStyle = '#9b3a55'; g.fill(); }
  const sm = E.smile, cy2 = -276, mo = Math.max(E.open, E.talk || 0);
  if (mo > .15) { const bot = cy2 + 10 + mo * 26; g.beginPath(); g.moveTo(-22, cy2); g.quadraticCurveTo(0, cy2 + 6, 22, cy2); g.quadraticCurveTo(18, bot, 0, bot); g.quadraticCurveTo(-18, bot, -22, cy2); g.fillStyle = '#5a1a26'; g.fill(); inkStroke(4.5); }
  else { g.beginPath(); g.moveTo(-24, cy2 - sm * 6); g.quadraticCurveTo(0, cy2 + 8 + sm * 6, 24, cy2 - sm * 6); inkStroke(4.5); }
  for (const sd of [-1, 1]) { g.beginPath(); g.roundRect(sd > 0 ? 1 : -11, cy2 + 1, 10, 13, 3); g.fillStyle = '#fff'; g.fill(); inkStroke(3); }
}
// мордочка совы: огромные глаза-диски с оранжевым ободком, тонкие очки экономиста, клюв
function owlFace(E, blink, T) {
  const ex = E.lx * 8, ey = E.ly * 7, shock = E.brow > .75 && E.open > .7, happy = E.smile > .7 && E.open > .3;
  for (const sd of [-1, 1]) {
    const cx = sd * 64, cy = -350;
    g.beginPath(); g.arc(cx, cy, 58, 0, 6.2832); g.fillStyle = mixHex(HC.cream, '#ffffff', .4); g.fill(); inkStroke(5);
    if (E.sleep > .5 || happy) { g.beginPath(); g.moveTo(cx - 26, cy + 6); g.quadraticCurveTo(cx, cy - 22, cx + 26, cy + 6); inkStroke(8); }
    else {
      const ry = Math.max(3, 40 * blink); g.beginPath(); g.ellipse(cx, cy, 40, ry, 0, 0, 6.2832); g.fillStyle = '#f2a33a'; g.fill(); inkStroke(4);
      if (blink > .5) { g.beginPath(); g.arc(cx + ex, cy + ey, shock ? 12 : 24, 0, 6.2832); g.fillStyle = INKC; g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + ex + 9, cy + ey - 9, 7, 0, 6.2832); g.fill(); }
    }
    // брови-пёрышки
    g.beginPath(); g.moveTo(sd * 18, cy - 62 - E.brow * 10); g.lineTo(sd * 104, cy - 74 - (E.brow > 0 ? E.brow * 12 : -E.brow * 6)); inkStroke(8);
    // тонкие очки
    g.beginPath(); g.arc(cx, cy, 64, 0, 6.2832); g.strokeStyle = '#c9a040'; g.lineWidth = 5; g.stroke();
  }
  g.beginPath(); g.moveTo(-6, -352); g.lineTo(6, -352); g.strokeStyle = '#c9a040'; g.lineWidth = 5; g.stroke();
  // клюв: приоткрывается, когда сова говорит
  const mo = Math.max(E.open, E.talk || 0);
  g.beginPath(); g.moveTo(-20, -318); g.quadraticCurveTo(0, -330, 20, -318); g.lineTo(0, -282 + mo * 4); g.closePath(); g.fillStyle = HC.nose; g.fill(); inkStroke(4.5);
  if (mo > .2) { g.beginPath(); g.moveTo(-14, -300); g.lineTo(0, -286 + mo * 18); g.lineTo(14, -300); g.fillStyle = '#d97f1e'; g.fill(); inkStroke(3.5); }
  if (E.blush > .05) for (const sd of [-1, 1]) { g.save(); g.globalAlpha *= .55 * E.blush; g.fillStyle = 'rgba(255,120,150,.9)'; g.beginPath(); g.ellipse(sd * 112, -292, 22, 13, 0, 0, 6.2832); g.fill(); g.restore(); }
}
// ---------- Лев: солидный и милый ----------
// прядь гривы — вытянутый «язык пламени» от основания (x, y) в направлении a, с изгибом bend
function lionLock(x, y, a, len, w, bend) {
  // полное «тело» пряди и загнутый кончик (как запятая/язык пламени) — мягко, без пилы
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx, P = (u, v) => [x + dx * len * u + nx * v, y + dy * len * u + ny * v];
  const tip = P(1, bend), c1 = P(.35, w * 1.15), c2 = P(.8, w * .55 + bend), c3 = P(.75, bend * .9 - w * .25), c4 = P(.3, -w * 1.05), e = P(0, -w);
  g.moveTo(...P(0, w)); g.bezierCurveTo(...c1, ...c2, ...tip); g.bezierCurveTo(...c3, ...c4, ...e); g.closePath();
}
// грива за головой: сплошная масса без просветов — один замкнутый контур с зачёсанными прядями по краю, три тона слоями
// (тёмный снаружи, рыжий, золотой у морды) и прядки поверх; края чуть колышутся
function maneShape(rx, ry, N, phase, T, ph, ext) {
  const cy = -322, E = (a, k) => [Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k], st = 6.2832 / N;
  for (let i = 0; i < N; i++) {
    const a0 = (i + phase) * st - Math.PI / 2, a1 = a0 + st, am = a0 + st * .78, side = Math.abs(Math.cos(am)), down = Math.max(0, Math.sin(am));
    const e = (ext * (.75 + side * .45 - down * .3) + ((i * 37) % 11) * 1.5 + Math.sin(T * 2.3 + i * 1.7 + ph) * 5) / rx;
    if (!i) g.moveTo(...E(a0, 1));
    g.quadraticCurveTo(...E(a0 + st * .3, 1 + e * .95), ...E(am, 1 + e));
    g.quadraticCurveTo(...E(am + st * .05, 1 + e * .3), ...E(a1, 1));
  }
  g.closePath();
}
function lionMane(T, ph) {
  g.beginPath(); maneShape(196, 178, 16, 0, T, ph, 70); g.strokeStyle = INKC; g.lineWidth = HC.LW * 2; g.lineJoin = 'round'; g.stroke(); g.fillStyle = HC.mane; g.fill();
  g.beginPath(); maneShape(166, 150, 16, .45, T, ph + 1, 58); g.fillStyle = HC.maneM; g.fill();
  g.beginPath(); maneShape(138, 124, 16, .2, T, ph + 2, 46); g.fillStyle = HC.maneL; g.fill();
  g.save(); g.lineCap = 'round'; g.strokeStyle = HC.maneH; g.lineWidth = 6; g.globalAlpha *= .75;
  for (let i = 0; i < 16; i++) { const a = (i + .6) / 16 * 6.2832 - Math.PI / 2, r0 = 1.02, r1 = 1.22, k = Math.sin(T * 2.3 + i) * .02; g.beginPath(); g.moveTo(Math.cos(a) * 190 * r0, -322 + Math.sin(a) * 172 * r0); g.quadraticCurveTo(Math.cos(a + .12) * 190 * (r0 + r1) / 2, -322 + Math.sin(a + .12) * 172 * (r0 + r1) / 2, Math.cos(a + .26 + k) * 190 * r1, -322 + Math.sin(a + .26 + k) * 172 * r1); g.stroke(); }
  g.strokeStyle = shade(HC.mane, -.25); g.lineWidth = 4; g.globalAlpha = .45;
  for (let i = 0; i < 16; i++) { const a = (i + .1) / 16 * 6.2832 - Math.PI / 2; g.beginPath(); g.moveTo(Math.cos(a) * 166, -322 + Math.sin(a) * 150); g.quadraticCurveTo(Math.cos(a + .1) * 190, -322 + Math.sin(a + .1) * 172, Math.cos(a + .22) * 214, -322 + Math.sin(a + .22) * 194); g.stroke(); }
  g.restore();
}
// грива на груди: сплошной «воротник» из-под подбородка, пряди острыми кончиками вниз
function bibShape(w, y0, len, T, ph) {
  const n = 6, st = w * 2 / n; g.moveTo(-w, y0 - 40); g.lineTo(-w, y0);
  for (let i = 0; i < n; i++) {
    const x0 = -w + i * st, x1 = x0 + st, mid = Math.abs(x0 + st / 2) / w, l = len * (1 - mid * .45) + ((i * 29) % 9) + Math.sin(T * 2 + i + ph) * 4, tx = x0 + st * (x0 + st / 2 < 0 ? .3 : .7);
    g.quadraticCurveTo(x0 + st * .1, y0 + l * .8, tx, y0 + l); g.quadraticCurveTo(x1 - st * .1, y0 + l * .3, x1, y0);
  }
  g.lineTo(w, y0 - 40); g.quadraticCurveTo(0, y0 - 80, -w, y0 - 40); g.closePath();
}
function lionBib(T, ph) {
  g.beginPath(); bibShape(124, -236, 78, T, ph); g.strokeStyle = INKC; g.lineWidth = HC.LW * 1.6; g.lineJoin = 'round'; g.stroke(); g.fillStyle = HC.mane; g.fill();
  g.beginPath(); bibShape(92, -240, 52, T, ph + 1); g.fillStyle = HC.maneM; g.fill();
  g.save(); g.lineCap = 'round'; g.strokeStyle = HC.maneH; g.lineWidth = 5; g.globalAlpha *= .6; for (const x of [-70, -24, 24, 70]) { g.beginPath(); g.moveTo(x, -230); g.quadraticCurveTo(x + (x < 0 ? -6 : 6), -200, x + (x < 0 ? -12 : 12), -176); g.stroke(); } g.restore();
}
// хохолок: три пряди зачёсаны набок, одна падает на лоб
function lionForelock(T, sway) {
  const tufts = [[-40, -1.95, 58], [-6, -1.5, 72], [30, -1.05, 56]], s2 = sway * .006;
  g.beginPath(); for (const [x, a, l] of tufts) lionLock(x, -438, a + s2, l, 32, 30);
  g.strokeStyle = INKC; g.lineWidth = HC.LW * 1.6; g.lineJoin = 'round'; g.stroke(); g.fillStyle = HC.maneM; g.fill();
  g.beginPath(); for (const [x, a, l] of tufts) lionLock(x + 3, -440, a + s2, l * .6, 15, 16); g.fillStyle = HC.maneL; g.fill();
}
// бархатный пиджак (изумруд) с чёрными атласными лацканами, чёрная рубашка, золотая цепь с медальоном — не как у Хомяка
function lionBlazer() {
  const c = HC.velvet || '#1d5a49'; clothBase(c);
  g.save(); g.globalAlpha *= .14; g.strokeStyle = '#fff'; g.lineWidth = 12; g.lineCap = 'round'; for (const [x0, x1] of [[-128, -96], [112, 92]]) { g.beginPath(); g.moveTo(x0, -300); g.quadraticCurveTo(x0 + 28, -170, x1, -40); g.stroke(); } g.restore();   // бархатный отлив
  g.beginPath(); g.moveTo(-62, -244); g.lineTo(62, -244); g.lineTo(0, -92); g.closePath(); g.fillStyle = '#1b1a20'; g.fill(); inkStroke(4);
  g.beginPath(); g.moveTo(-36, -240); g.quadraticCurveTo(-20, -146, 0, -136); g.quadraticCurveTo(20, -146, 36, -240); g.strokeStyle = '#e8b93a'; g.lineWidth = 5; g.setLineDash([8, 4]); g.stroke(); g.setLineDash([]);
  g.beginPath(); g.arc(0, -120, 17, 0, 6.2832); const mg = g.createRadialGradient(-5, -126, 2, 0, -120, 18); mg.addColorStop(0, '#fff2b8'); mg.addColorStop(1, '#d99a22'); g.fillStyle = mg; g.fill(); inkStroke(3);
  g.beginPath(); g.moveTo(-9, -114); g.lineTo(-10, -128); g.lineTo(-4, -121); g.lineTo(0, -131); g.lineTo(4, -121); g.lineTo(10, -128); g.lineTo(9, -114); g.closePath(); g.fillStyle = '#a8701a'; g.fill();   // корона на медальоне
  for (const sd of [-1, 1]) {
    g.beginPath(); g.moveTo(sd * 62, -246); g.quadraticCurveTo(sd * 30, -160, sd * 4, -92); g.lineTo(sd * 30, -86); g.quadraticCurveTo(sd * 74, -160, sd * 102, -242); g.closePath(); g.fillStyle = '#18171c'; g.fill(); inkStroke(4);
    g.beginPath(); g.moveTo(sd * 88, -232); g.quadraticCurveTo(sd * 60, -160, sd * 24, -100); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 4; g.stroke();
  }
  for (const by of [-70, -38]) { g.beginPath(); g.arc(0, by, 8, 0, 6.2832); g.fillStyle = '#e8b93a'; g.fill(); inkStroke(2.5); }
  g.beginPath(); g.moveTo(-122, -168); g.lineTo(-112, -188); g.lineTo(-104, -172); g.lineTo(-94, -190); g.lineTo(-84, -168); g.closePath(); g.fillStyle = '#e8b93a'; g.fill(); inkStroke(3);
  g.beginPath(); g.moveTo(-128, -166); g.lineTo(-78, -166); inkStroke(4.5);
}
// морда льва: большие золотые глаза с подводкой, светлая переносица, мордочка-подушечки, бородка, тёмный нос; рот «ω», клыки — только когда говорит
function lionFace(E, blink, T) {
  const ex = E.lx * 6, ey = E.ly * 5, shock = E.brow > .75 && E.open > .7, happy = E.smile > .7 && E.open > .3;
  g.beginPath(); g.moveTo(-24, -436); g.quadraticCurveTo(0, -446, 24, -436); g.quadraticCurveTo(30, -380, 36, -330); g.lineTo(-36, -330); g.quadraticCurveTo(-30, -380, -24, -436); g.closePath(); g.fillStyle = HC.furL; g.fill();
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 68, -404, 28, 13, sd * .25, 0, 6.2832); g.fillStyle = mixHex(HC.furL, '#ffffff', .35); g.fill(); }
  for (const sd of [-1, 1]) {
    const cx = sd * 64, cy = -360;
    if (E.sleep > .5 || happy) { g.beginPath(); g.moveTo(cx - 24, cy + 6); g.quadraticCurveTo(cx, cy - 22, cx + 24, cy + 6); inkStroke(9); }
    else {
      const rx = shock ? 30 : 27, ry = Math.max(3, (shock ? 36 : 31) * blink);
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); const ig = g.createRadialGradient(cx + ex, cy + ey + 4, 3, cx, cy, rx + 4); ig.addColorStop(0, '#fff09a'); ig.addColorStop(.5, '#f2bd2e'); ig.addColorStop(1, '#b8731a'); g.fillStyle = ig; g.fill(); inkStroke(4.5);
      if (blink > .5) {
        g.beginPath(); g.ellipse(cx + ex, cy + ey + 2, shock ? 7 : 13, shock ? 10 : 19, 0, 0, 6.2832); g.fillStyle = INKC; g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + ex + 8, cy + ey - 10, 8, 0, 6.2832); g.fill(); g.beginPath(); g.arc(cx + ex - 8, cy + ey + 11, 4, 0, 6.2832); g.fill();
      }
      // плотное верхнее веко — взгляд солидный
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.02, Math.PI * 1.98); inkStroke(8);
    }
    const inner = cy - 46 - (E.brow < 0 ? E.brow * -8 : E.brow * 14), outer = cy - 50 - (E.brow > 0 ? E.brow * 10 : -E.brow * 10);
    g.beginPath(); g.moveTo(sd * 34, inner); g.quadraticCurveTo(sd * 62, outer - 8, sd * 90, outer); g.lineCap = 'round'; g.strokeStyle = HC.furD; g.lineWidth = 11; g.stroke();
  }
  // мордочка: две подушечки и бородка (сначала общий контур, потом заливка)
  const muzzle = () => { for (const sd of [-1, 1]) { g.moveTo(sd * 30 + 40, -292); g.ellipse(sd * 30, -292, 40, 28, 0, 0, 6.2832); } g.moveTo(32, -258); g.ellipse(0, -258, 32, 22, 0, 0, 6.2832); };
  g.beginPath(); muzzle(); g.strokeStyle = INKC; g.lineWidth = 8; g.lineJoin = 'round'; g.stroke(); g.fillStyle = HC.cream; g.fill();
  for (const sd of [-1, 1]) { for (const [dx, dy] of [[12, -8], [26, 2], [12, 10]]) { g.beginPath(); g.arc(sd * (22 + dx), -292 + dy, 3, 0, 6.2832); g.fillStyle = HC.furD; g.fill(); }
    for (const dy of [-8, 6]) { g.save(); g.globalAlpha *= .6; g.beginPath(); g.moveTo(sd * 70, -294 + dy); g.lineTo(sd * 134, -302 + dy * 1.8); inkStroke(2.5); g.restore(); } }
  // нос
  g.beginPath(); g.moveTo(-25, -336); g.quadraticCurveTo(0, -346, 25, -336); g.quadraticCurveTo(20, -318, 4, -308); g.quadraticCurveTo(0, -306, -4, -308); g.quadraticCurveTo(-20, -318, -25, -336); g.closePath(); g.fillStyle = HC.nose; g.fill(); inkStroke(4);
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-8, -334, 8, 3.5, -.2, 0, 6.2832); g.fill();
  // рот
  const mo = Math.max(E.open, E.talk || 0), sm = E.smile, cy2 = -296;
  g.beginPath(); g.moveTo(0, -308); g.lineTo(0, cy2); inkStroke(4);
  if (mo > .15) {
    const bot = cy2 + 12 + mo * 30; g.beginPath(); g.moveTo(-28, cy2); g.quadraticCurveTo(0, cy2 + 6, 28, cy2); g.quadraticCurveTo(22, bot, 0, bot); g.quadraticCurveTo(-22, bot, -28, cy2); g.fillStyle = '#5a1a26'; g.fill(); inkStroke(4.5);
    g.beginPath(); g.ellipse(0, bot - 7, 12, 5 * mo, 0, 0, 6.2832); g.fillStyle = '#ff7f95'; g.fill();
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 20, cy2 + 2); g.lineTo(sd * 15, cy2 + 13); g.lineTo(sd * 10, cy2 + 3); g.closePath(); g.fillStyle = '#fff'; g.fill(); inkStroke(2); }
  } else { g.beginPath(); g.moveTo(-28, cy2 - 2 - sm * 8); g.quadraticCurveTo(-14, cy2 + 12, 0, cy2); g.quadraticCurveTo(14, cy2 + 12, 28, cy2 - 2 - sm * 8); inkStroke(4.5); }
  if (E.blush > .05) for (const sd of [-1, 1]) { g.save(); g.globalAlpha *= .55 * E.blush; g.fillStyle = 'rgba(255,120,120,.9)'; g.beginPath(); g.ellipse(sd * 112, -318, 24, 14, 0, 0, 6.2832); g.fill(); g.restore(); }
  if (E.shades > .01) { const oy = (1 - emph(clamp(E.shades))) * -190; for (const sd of [-1, 1]) { g.beginPath(); g.roundRect(sd * 64 - 44, -388 + oy, 88, 54, [10, 10, 26, 26]); g.fillStyle = '#141218'; g.fill(); inkStroke(5); } g.beginPath(); g.moveTo(-20, -374 + oy); g.quadraticCurveTo(0, -384 + oy, 20, -374 + oy); inkStroke(6); }
}
// морда волка: тёмная «шапочка» на лбу, светлые пятна-брови, пушистые щёки, вытянутая светлая морда с крупным чёрным носом,
// голубые глаза с плотным веком — спокойный, уверенный; клыки — только когда говорит
function wolfFace(E, blink, T) {
  const ex = E.lx * 6, ey = E.ly * 5, shock = E.brow > .75 && E.open > .7, happy = E.smile > .7 && E.open > .3;
  g.save(); g.beginPath(); headPath(); g.clip();
  g.beginPath(); g.moveTo(-190, -480); g.lineTo(190, -480); g.lineTo(170, -392); g.quadraticCurveTo(60, -404, 0, -366); g.quadraticCurveTo(-60, -404, -170, -392); g.closePath(); g.fillStyle = HC.furD; g.fill();
  g.beginPath(); for (const sd of [-1, 1]) { g.moveTo(sd * 166, -330); g.ellipse(sd * 76, -300, 90, 52, 0, 0, 6.2832); } g.fillStyle = HC.cream; g.fill();
  g.restore();
  for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * 66, -410, 22, 11, sd * .3, 0, 6.2832); g.fillStyle = HC.cream; g.fill(); }
  // пушистые щёки торчат за контур головы
  for (const sd of [-1, 1]) {
    const zig = () => { g.moveTo(sd * 150, -336); g.lineTo(sd * 180, -318); g.lineTo(sd * 158, -304); g.lineTo(sd * 184, -288); g.lineTo(sd * 154, -276); g.lineTo(sd * 168, -252); g.lineTo(sd * 128, -246); };
    g.beginPath(); zig(); g.lineTo(sd * 110, -300); g.closePath(); g.fillStyle = HC.cream; g.fill();
    g.beginPath(); zig(); inkStroke(4.5);   // контур только по краю шерсти — без линии внутри морды
  }
  for (const sd of [-1, 1]) {
    const cx = sd * 62, cy = -362;
    if (E.sleep > .5 || happy) { g.beginPath(); g.moveTo(cx - 24, cy + 6); g.quadraticCurveTo(cx, cy - 22, cx + 24, cy + 6); inkStroke(9); }
    else {
      const rx = shock ? 30 : 27, ry = Math.max(3, (shock ? 34 : 28) * blink);
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 6.2832); const ig = g.createRadialGradient(cx + ex, cy + ey + 4, 3, cx, cy, rx + 4); ig.addColorStop(0, '#e6f6ff'); ig.addColorStop(.5, '#7cc4f2'); ig.addColorStop(1, '#2f74b5'); g.fillStyle = ig; g.fill(); inkStroke(4.5);
      if (blink > .5) {
        g.beginPath(); g.ellipse(cx + ex, cy + ey + 2, shock ? 7 : 13, shock ? 10 : 17, 0, 0, 6.2832); g.fillStyle = INKC; g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(cx + ex + 8, cy + ey - 9, 7.5, 0, 6.2832); g.fill(); g.beginPath(); g.arc(cx + ex - 8, cy + ey + 10, 3.5, 0, 6.2832); g.fill();
      }
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.02, Math.PI * 1.98); inkStroke(8);
    }
    // брови: внутренний край чуть ниже — уверенный взгляд
    const inner = cy - 40 - (E.brow < 0 ? E.brow * -8 : E.brow * 14), outer = cy - 50 - (E.brow > 0 ? E.brow * 10 : -E.brow * 10);
    g.beginPath(); g.moveTo(sd * 30, inner); g.quadraticCurveTo(sd * 60, outer - 6, sd * 92, outer); g.lineCap = 'round'; g.strokeStyle = shade(HC.furD, -.35); g.lineWidth = 10; g.stroke();
  }
  // морда: вытянутая светлая, с контуром
  g.beginPath(); g.moveTo(-40, -340); g.quadraticCurveTo(0, -352, 40, -340); g.quadraticCurveTo(70, -300, 52, -268); g.quadraticCurveTo(0, -240, -52, -268); g.quadraticCurveTo(-70, -300, -40, -340); g.closePath();
  g.fillStyle = mixHex(HC.cream, '#ffffff', .4); g.fill(); inkStroke(5);
  for (const sd of [-1, 1]) { for (const [dx, dy] of [[24, -2], [36, 8], [22, 14]]) { g.beginPath(); g.arc(sd * dx, -292 + dy, 2.8, 0, 6.2832); g.fillStyle = HC.furD; g.fill(); }
    for (const dy of [-6, 8]) { g.save(); g.globalAlpha *= .55; g.beginPath(); g.moveTo(sd * 56, -292 + dy); g.lineTo(sd * 126, -300 + dy * 1.8); inkStroke(2.5); g.restore(); } }
  // крупный чёрный нос
  g.beginPath(); g.moveTo(-26, -334); g.quadraticCurveTo(0, -348, 26, -334); g.quadraticCurveTo(28, -314, 0, -308); g.quadraticCurveTo(-28, -314, -26, -334); g.closePath(); g.fillStyle = HC.nose; g.fill(); inkStroke(4);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-8, -334, 9, 4, -.2, 0, 6.2832); g.fill();
  const mo = Math.max(E.open, E.talk || 0), sm = E.smile, cy2 = -292;
  g.beginPath(); g.moveTo(0, -308); g.lineTo(0, cy2); inkStroke(4);
  if (mo > .15) {
    const bot = cy2 + 12 + mo * 28; g.beginPath(); g.moveTo(-30, cy2); g.quadraticCurveTo(0, cy2 + 6, 30, cy2); g.quadraticCurveTo(24, bot, 0, bot); g.quadraticCurveTo(-24, bot, -30, cy2); g.fillStyle = '#5a1a26'; g.fill(); inkStroke(4.5);
    g.beginPath(); g.ellipse(0, bot - 7, 12, 5 * mo, 0, 0, 6.2832); g.fillStyle = '#ff7f95'; g.fill();
    for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 22, cy2 + 2); g.lineTo(sd * 16, cy2 + 14); g.lineTo(sd * 11, cy2 + 3); g.closePath(); g.fillStyle = '#fff'; g.fill(); inkStroke(2); }
  } else { g.beginPath(); g.moveTo(-30, cy2 - 2 - sm * 8); g.quadraticCurveTo(-15, cy2 + 12, 0, cy2); g.quadraticCurveTo(15, cy2 + 12, 30, cy2 - 2 - sm * 8); inkStroke(4.5); }
  if (E.blush > .05) for (const sd of [-1, 1]) { g.save(); g.globalAlpha *= .5 * E.blush; g.fillStyle = 'rgba(255,120,140,.9)'; g.beginPath(); g.ellipse(sd * 106, -312, 22, 13, 0, 0, 6.2832); g.fill(); g.restore(); }
  if (E.shades > .01) { const oy = (1 - emph(clamp(E.shades))) * -190; for (const sd of [-1, 1]) { g.beginPath(); g.roundRect(sd * 62 - 44, -390 + oy, 88, 54, [10, 10, 26, 26]); g.fillStyle = '#141218'; g.fill(); inkStroke(5); } g.beginPath(); g.moveTo(-20, -376 + oy); g.quadraticCurveTo(0, -386 + oy, 20, -376 + oy); inkStroke(6); }
}
function hamFace(E, blink, T) {
  if (HC.mole) return moleFace(E, blink, T);
  if (HC.owl) return owlFace(E, blink, T);
  if (HC.lion) return lionFace(E, blink, T);
  if (HC.wolf) return wolfFace(E, blink, T);
  if (HC.raccoon) { // маска енота: тёмная полоса через глаза, светлые круги вокруг глаз
    g.beginPath(); g.moveTo(-150, -370); g.quadraticCurveTo(0, -330, 150, -370); g.quadraticCurveTo(160, -320, 110, -305); g.quadraticCurveTo(0, -330, -110, -305); g.quadraticCurveTo(-160, -320, -150, -370); g.closePath(); g.fillStyle = '#2b2d33'; g.fill(); inkStroke(4);
    for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * 64, -352, 40, 0, 6.2832); g.fillStyle = '#ffffff'; g.fill(); inkStroke(3.5); }
  }
  const ex = E.lx * 7, ey = E.ly * 6, happyEyes = E.smile > .7 && E.open > .3, shock = E.brow > .75 && E.open > .7, sad = E.brow < -.5 && !HC.cat;
  if (HC.cat) catEyes(E, blink);
  for (const sd of [-1, 1]) {
    if (HC.cat) { const cy = -352, inner = cy - 46 - (E.brow < 0 ? E.brow * -4 : E.brow * 12), outer = cy - 54 - (E.brow > 0 ? E.brow * 10 : -E.brow * 14); g.beginPath(); g.moveTo(sd * 40, inner); g.lineTo(sd * 86, outer); inkStroke(7); continue; }
    const cx = sd * 64, cy = -352;
    if (E.sleep > .5) { g.beginPath(); g.moveTo(cx - 20, cy - 2); g.quadraticCurveTo(cx, cy + 16, cx + 20, cy - 2); inkStroke(7); }
    else if (happyEyes || (E.wink > .5 && sd > 0)) { g.beginPath(); g.moveTo(cx - 20, cy + 8); g.quadraticCurveTo(cx, cy - 26, cx + 20, cy + 8); inkStroke(9); }
    else if (shock) {
      g.beginPath(); roughEllipse(cx, cy - 4, 34, 40, 61 + sd, 1.2); g.fillStyle = '#fff'; g.fill(); inkStroke(5);
      g.beginPath(); g.arc(cx + ex * .6, cy + ey * .6, 8, 0, 6.2832); g.fillStyle = INKC; g.fill();
    } else {
      // глаза-бусины с глубиной: тёплая радужка, два блика и отражение снизу
      const ry = Math.max(2, 34 * blink), eg = g.createRadialGradient(cx + ex - 4, cy + ey + 6, 2, cx + ex, cy + ey, 32);
      eg.addColorStop(0, '#6b4127'); eg.addColorStop(.45, '#2b1810'); eg.addColorStop(1, INKC);
      g.beginPath(); g.ellipse(cx + ex, cy + ey, 27, ry, 0, 0, 6.2832); g.fillStyle = eg; g.fill();
      if (blink > .5) {
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx + ex + 9, cy + ey - 13, 10, 11, -.4, 0, 6.2832); g.fill(); g.beginPath(); g.arc(cx + ex - 9, cy + ey + 12, 4.5, 0, 6.2832); g.fill();
      }
      // веко-линия сверху: взгляд выразительнее
      g.beginPath(); g.ellipse(cx + ex * .3, cy + ey * .3 + 2, 31, Math.max(4, 37 * blink), 0, Math.PI * 1.18, Math.PI * 1.82); inkStroke(4.5);
      if (sad) { // веко опущено к внешнему краю
        g.beginPath(); g.moveTo(cx - 34, cy - 44); g.lineTo(cx + 34, cy - 44); g.lineTo(cx + 34, cy + (sd > 0 ? -2 : -22)); g.lineTo(cx - 34, cy + (sd > 0 ? -22 : -2)); g.closePath(); g.fillStyle = HC.fur; g.fill();
        g.beginPath(); g.moveTo(cx - 30, cy + (sd > 0 ? -20 : -4)); g.lineTo(cx + 30, cy + (sd > 0 ? -4 : -20)); inkStroke(5);
      }
    }
    // брови
    const inner = cy - 48 - (E.brow < 0 ? -E.brow * 14 : E.brow * 12), outer = cy - 50 - (E.brow > 0 ? E.brow * 12 : E.brow * 3);
    g.beginPath(); g.moveTo(sd * 46, inner); g.lineTo(sd * 84, outer); inkStroke(7);
  }
  if (E.glasses > .01) {
    const oy = (1 - emph(clamp(E.glasses))) * -160;
    for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * 64, -352 + oy, 38, 0, 6.2832); g.fillStyle = 'rgba(160,210,255,.18)'; g.fill(); inkStroke(5.5); }
    g.beginPath(); g.moveTo(-26, -356 + oy); g.quadraticCurveTo(0, -368 + oy, 26, -356 + oy); inkStroke(5);
  }
  if (E.shades > .01) {
    const oy = (1 - emph(clamp(E.shades))) * -190;
    for (const sd of [-1, 1]) { g.beginPath(); g.roundRect(sd * 64 - 44, -380 + oy, 88, 56, [10, 10, 26, 26]); g.fillStyle = '#141218'; g.fill(); inkStroke(5);
      g.beginPath(); g.moveTo(sd * 64 - 26, -366 + oy); g.lineTo(sd * 64 - 8, -348 + oy); g.moveTo(sd * 64 - 12, -370 + oy); g.lineTo(sd * 64 + 4, -354 + oy); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 4; g.stroke(); }
    g.beginPath(); g.moveTo(-20, -370 + oy); g.quadraticCurveTo(0, -380 + oy, 20, -370 + oy); inkStroke(6);
    g.beginPath(); g.moveTo(-108, -372 + oy); g.lineTo(-140, -384 + oy); g.moveTo(108, -372 + oy); g.lineTo(140, -384 + oy); inkStroke(6);
  }
  if (sad) { const q = (T * .8) % 1; g.fillStyle = '#7fc4ff'; g.beginPath(); g.ellipse(-82, -320 + q * 70, 8, 12, 0, 0, 6.2832); g.globalAlpha = 1 - q; g.fill(); g.globalAlpha = 1; }
  // румянец со штриховкой
  if (E.blush > .05) for (const sd of [-1, 1]) {
    g.save(); g.globalAlpha *= .75 * E.blush; const bg = g.createRadialGradient(sd * 106, -306, 2, sd * 106, -306, 30); bg.addColorStop(0, 'rgba(255,120,150,.9)'); bg.addColorStop(1, 'rgba(255,120,150,0)'); g.fillStyle = bg; g.beginPath(); g.ellipse(sd * 106, -306, 32, 20, 0, 0, 6.2832); g.fill(); g.restore();
    g.save(); g.globalAlpha *= .5 * E.blush; for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(sd * 104 + i * 11 - 5, -298); g.lineTo(sd * 104 + i * 11 + 5, -314); inkStroke(3); } g.restore();
  }
  if (HC.cat) { catMouth(E); monocle(); return; }
  // усы
  for (const sd of [-1, 1]) for (const dy of [-6, 8]) { g.save(); g.globalAlpha *= .7; g.beginPath(); g.moveTo(sd * 66, -300 + dy); g.lineTo(sd * 112, -306 + dy * 1.8); inkStroke(3); g.restore(); }
  // нос
  g.beginPath(); g.moveTo(-15, -324); g.quadraticCurveTo(0, -337, 15, -324); g.quadraticCurveTo(0, -299, -15, -324); g.fillStyle = HC.nose; g.fill(); inkStroke(4.5);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(-4, -327, 4.5, 2.6, -.2, 0, 6.2832); g.fill();
  // рот: «ω», при открытом — пасть с язычком; два передних зуба всегда
  const sm = E.smile, cy2 = -306, mo = Math.max(E.open, E.talk || 0);
  if (mo > .15) {
    const bot = cy2 + 14 + mo * 30;
    g.beginPath(); g.moveTo(-24, cy2 - sm * 4); g.quadraticCurveTo(0, cy2 + 6, 24, cy2 - sm * 4); g.quadraticCurveTo(20, bot, 0, bot); g.quadraticCurveTo(-20, bot, -24, cy2 - sm * 4); g.fillStyle = '#5a1a26'; g.fill(); inkStroke(5);
    g.beginPath(); g.ellipse(0, bot - 7, 11, 6 * mo, 0, 0, 6.2832); g.fillStyle = '#ff7f95'; g.fill();
  }
  for (const sd of [-1, 1]) { g.beginPath(); g.roundRect(sd > 0 ? 1 : -11, cy2 + 2, 10, 15, 3); g.fillStyle = '#fff'; g.fill(); inkStroke(3.5); }
  g.beginPath(); g.moveTo(0, -312); g.lineTo(0, cy2 + 1);
  g.moveTo(0, cy2 + 1); g.quadraticCurveTo(-12, cy2 + 10 - sm * 4, -26, cy2 - sm * 8);
  g.moveTo(0, cy2 + 1); g.quadraticCurveTo(12, cy2 + 10 - sm * 4, 26, cy2 - sm * 8); inkStroke(4.5);
}
function catMouth(E) {
  for (const sd of [-1, 1]) for (const dy of [-8, 6, 18]) { g.save(); g.globalAlpha *= .75; g.beginPath(); g.moveTo(sd * 58, -300 + dy); g.lineTo(sd * 150, -310 + dy * 2.2); inkStroke(3); g.restore(); }
  g.beginPath(); g.moveTo(-12, -322); g.lineTo(12, -322); g.lineTo(0, -308); g.closePath(); g.fillStyle = HC.nose; g.fill(); inkStroke(4);
  const sm = E.smile, cy2 = -300, mo = Math.max(E.open, E.talk || 0);
  if (mo > .15) { const bot = cy2 + 12 + mo * 30; g.beginPath(); g.moveTo(-22, cy2); g.quadraticCurveTo(0, cy2 + 6, 22, cy2); g.quadraticCurveTo(18, bot, 0, bot); g.quadraticCurveTo(-18, bot, -22, cy2); g.fillStyle = '#5a1a26'; g.fill(); inkStroke(4.5); }
  g.beginPath(); g.moveTo(0, -308); g.lineTo(0, cy2); g.moveTo(0, cy2); g.quadraticCurveTo(-12, cy2 + 10 - sm * 4, -24, cy2 - sm * 9); g.moveTo(0, cy2); g.quadraticCurveTo(12, cy2 + 10 - sm * 4, 24, cy2 - sm * 9); inkStroke(4.5);
  if (sm > .4) { g.beginPath(); g.moveTo(10, cy2 + 4); g.lineTo(15, cy2 + 16); g.lineTo(19, cy2 + 2); g.fillStyle = '#fff'; g.fill(); inkStroke(2.5); }   // клык — ухмылка злодея
}
// мировые координаты ладошки хомяка и его рта
function hamPaw(x, y, k, P, f) {
  const air = Math.max(0, -P.lift), a = -P.hr * D2R, ln = P.lean * D2R;
  let px = 104 - Math.sin(a) * 84, py = -246 + Math.cos(a) * 84;
  py += 150; [px, py] = [px * Math.cos(ln) - py * Math.sin(ln), px * Math.sin(ln) + py * Math.cos(ln)]; py -= 150;
  return [x + px * k * f, y + (py - air) * k];
}


// ---------- толпа хомяков ----------
const CROWD_FUR = [['#b9b4ad', '#9c968e'], ['#f4efe6', '#d9d2c5'], ['#e9b35f', '#cf9443'], ['#a8754a', '#8a5d37'], ['#d8c3a5', '#bba383'], ['#c7a07a', '#a98360']];
function drawCrowd(t, Tabs, mood, mainX, floorY, front) {
  const rows = front ? [{ y: floorY + 40, k: .5, xs: [150, 420, 1430, 1760] }] : [{ y: floorY - 175, k: .27, n: 12 }, { y: floorY - 95, k: .36, n: 9 }];
  rows.forEach((r, ri) => {
    const xs = r.xs || Array.from({ length: r.n }, (_, i) => 100 + (i + .5) * (W - 200) / r.n + (rnd(i * 7 + ri) - .5) * 70);
    xs.forEach((x, i) => {
      const seed = (front ? 50 : ri * 20) + i, [fur, furD] = CROWD_FUR[seed % CROWD_FUR.length];
      const appear = seg(t, .05 + rnd(seed) * .5, .45 + rnd(seed) * .5); if (appear <= 0) return;
      const ph = Tabs * (mood === 'panic' ? 10 : mood === 'happy' ? 7 : 2) + seed * 1.7;
      const P = { ...POSES[mood === 'panic' ? 'panic' : mood === 'happy' ? 'celebrate' : 'neutral'] };
      if (mood === 'panic') { P.hl = 130 + Math.sin(ph) * 32; P.hr = 130 + Math.sin(ph + 2) * 32; P.lift = -Math.abs(Math.sin(ph * .6)) * 26; }
      else if (mood === 'happy') P.lift = -Math.abs(Math.sin(ph * .5)) * 30;
      else P.lift = -Math.abs(Math.sin(ph)) * 5;
      const E = { ...EMOS[mood === 'panic' ? 'shock' : mood === 'happy' ? 'happy' : 'neutral'] }; E.lx = Math.sign(mainX - x) * .8;
      drawHamster({ fur, furD, ham: true, ph: rnd(seed) * 6, outfit: null }, x, r.y + (1 - emph(appear)) * 60, r.k, P, E, Tabs + seed, { flip: x < mainX ? 1 : -1 });
    });
    // воздушная перспектива: дальние ряды светлее
    if (!front && ri === 0) { g.save(); g.fillStyle = PAPER; g.globalAlpha = .3; g.fillRect(0, 0, W, H); g.restore(); }
  });
}


// ---------- синхрон губ ----------
// С озвучкой — огибающая громкости по кадрам (PLAN.mouth); без неё — по таймингам слов: слог = одно «открытие» рта
// ---------- жесты рассказчика: пока Хомяк говорит, лапки «играют» по смыслу фразы и в ритм слов ----------
// Лапка хомяка — одна «сосиска» с углом: -20 опущена, ~90 в сторону/вперёд, ~150 вверх, ~175 к мордочке.
const GESTURE_RULES = [
  ['count', /(перв|втор|трет|шаг|во-первых|раз,|1\.|2\.|3\.)/i], ['shrug', /не знаю|может быть|вдруг|почему|зачем|кто знает/i],
  ['facepalm', /серь[её]зно|ну вс[её]|опять|зря|ошибк|сливаешь|переплачива/i], ['thumbs', /круто|отлично|работает|супер|класс|легко|просто|выгодно/i],
  ['cheer', /ура|получилось|готово|заработал|бам!/i], ['point', /смотри|вот |видишь|здесь|сюда|внимание/i],
];
function gestureOf(s) { if (s._gest) return s._gest; const tx = s.text || ''; return (s._gest = (GESTURE_RULES.find(([, re]) => re.test(tx)) || ['explain'])[0]); }
// ритм речи: импульс на каждом слове (затухает за ~0.3 с), сильнее на числах и названиях
function speechBeat(s, t) {
  let b = 0; const strong = new Set([...(s.numWis || []), ...(s.entWis || [])]);
  (s.words || []).forEach((w, i) => { const d = t - w; if (d >= 0 && d < .35) b = Math.max(b, (1 - d / .35) * (strong.has(i) ? 1 : .45)); });
  return b;
}
function applyGesture(s, t, P, Pa, Tabs) {
  const g0 = gestureOf(s), b = speechBeat(s, t), w = Math.sin(Tabs * 5.2);
  P.head += b * 5 - 1; P.lift = Math.min(P.lift, -b * 7);   // кивок и лёгкий подскок на ударных словах
  switch (g0) {
    case 'count': Pa.hr = 140 + Math.sin(Tabs * 9) * 8 + b * 12; Pa.hl = -10; break;   // лапка вверх, «отсчитывает» на словах
    case 'shrug': Pa.hl = 100 + b * 15; Pa.hr = 100 + b * 15; P.head += 8 * Math.sin(Tabs * 1.3); break;
    case 'facepalm': Pa.hr = 172; P.head += 9; Pa.hl = -25; break;
    case 'thumbs': Pa.hr = 118 + b * 18 + Math.sin(Tabs * 7) * 4; Pa.hl = -15; break;
    case 'cheer': Pa.hl = 150 + Math.sin(Tabs * 11) * 18; Pa.hr = 150 + Math.sin(Tabs * 11 + 2) * 18; P.lift = Math.min(P.lift, -Math.abs(Math.sin(Tabs * 8)) * 16); break;
    case 'point': Pa.hr = 92 + b * 10; Pa.hl = -18; break;
    default: Pa.hr = 45 + w * 22 + b * 30; Pa.hl = -10 - w * 14 + b * 18;   // «объясняет»: лапки в ритм речи
  }
}
// жизнь в паузах: переминается с лапки на лапку, чуть покачивается
function idleLife(P, Tabs, ph) { const q = Math.sin(Tabs * .9 + ph); P.lean += q * 1.6; if (Math.sin(Tabs * .45 + ph) > .97) P.lLeg = Math.max(P.lLeg, 10); if (Math.sin(Tabs * .45 + ph + 3) > .97) P.rLeg = Math.max(P.rLeg, 10); }

function mouthAt(s, t, Tabs) {
  if (PLAN.mouth) return PLAN.mouth[Math.round(Tabs * FPS)] || 0;
  const ws = s.words; if (!ws || !ws.length) return 0;
  for (let k = ws.length - 1; k >= 0; k--) {
    if (t < ws[k].t) continue;
    const next = k + 1 < ws.length ? ws[k + 1].t : Math.min(ws[k].t + .5, s.speak ?? s.dur);
    const dur = Math.min(.7, next - ws[k].t); if (t > ws[k].t + dur) return 0;
    const syl = Math.max(1, (ws[k].s.match(/[аеёиоуыэюяaeiouy]/gi) || []).length);
    return Math.abs(Math.sin(Math.PI * (t - ws[k].t) / dur * syl)) * (.65 + .35 * rnd(k * 3.7 + s.idx));
  }
  return 0;
}

// ---------- сцена-история ----------
// s.p.cast: [{name, female, idx, x, flip, enter, fromAct}], s.p.acts: [{who, kind, wi, value}], s.p.bubble
T.story = function (t, d, s) {
  if (s.p.insert && newsMediaInsert(t, s)) return;   // «Зверо-новости»: вставка с настоящим фото/видео
  if (s.p.hook && newsHookCard(t, s)) return;   // «Зверо-новости»: анонс выпуска со сменой фото
  const p = s.p, Tabs = s.start + t, floorY = 975, kOf = c => c.kind === 'hamster' || c.kind === 'cat' ? 1.05 : c.kind === 'mole' ? 1 : c.kind === 'squirrel' ? .98 : c.kind === 'hedgehog' ? .97 : c.kind === 'owl' ? 1 : c.kind === 'lion' ? 1.1 : c.kind === 'raccoon' ? .97 : c.kind === 'wolf' ? 1.03 : .95;
  const acts = (p.acts || []).map(a => ({ ...a, ta: Math.max(.15, s.kt(a.wi) - .1) })).sort((a, b) => a.ta - b.ta);
  const actorNow = (() => { let a = null; for (const x of acts) if (x.ta <= t) a = x; return a || acts[0]; })();
  // обращение к зрителю: камера наезжает на героя (фон — слабее, для глубины)
  const leadKind = PLAN.lead || 'hamster', hero = p.cast.find(c => c.kind === leadKind) || p.cast[0];
  const addr = !p.subscribe && acts.find(a => a.kind === 'address');
  const zu = addr ? emph(seg(t, addr.ta - .35, addr.ta + .5)) : 0;
  // кинокамера: план выбирает режиссёр (s.dir.shot); обращение к зрителю — наезд на героя поверх плана
  const cam = shotCam(s, t, p.cast.find(c => c.name === s.dir.focus) || hero, floorY);
  if (zu > 0) { const fx = hero ? hero.x : CX, fy = floorY - 330 * (hero ? kOf(hero) : 1); cam.z = lerp(cam.z, 1.85, zu); cam.F = [lerp(cam.F[0], fx, zu), lerp(cam.F[1], fy, zu)]; cam.S = [lerp(cam.S[0], CX, zu), lerp(cam.S[1], 600, zu)]; cam.rot *= 1 - zu; }
  // толпа хомяков повторяет настроение героя
  const heroAct = hero && (() => { let a = null; for (const x of acts) if (x.who === hero.name && x.ta <= t) a = x; return a; })();
  const mood = heroAct ? (heroAct.kind === 'panic' ? 'panic' : ['happy', 'grow', 'compare', 'cashback', 'receive'].includes(heroAct.kind) ? 'happy' : 'neutral') : 'neutral';
  // фон: движется медленнее героев и размывается на средних/крупных планах (глубина резкости)
  const bgZ = 1 + (cam.z - 1) * .55;
  drawLayer(INK && !PLAN.news ? Math.min(9, (bgZ - 1) * 22) : 0, () => {   // в студии новостей фон резкий — картинка сочнее
    applyCam(cam, .55); g.translate(Math.sin(Tabs * .23) * 14, 0);   // лёгкая «дышащая» панорама фона
    // сцена: локация по теме фразы; без неё — линия пола (комикс) или светящийся пол (неон)
    NEWS_NOW = p.news || null;
    if (INK && p.place) { g.fillStyle = PAPER; g.fillRect(-500, -500, W + 1000, H + 1000); drawLocation(p.place, Tabs); godRays(p.place, Tabs); }
    else if (INK) { g.beginPath(); g.moveTo(80, floorY + boil(91, 0, 2)); g.quadraticCurveTo(CX, floorY + 5 + boil(91, 1, 2), W - 80, floorY + boil(91, 2, 2)); inkStroke(5); }
    else {
      g.save(); const fg = g.createLinearGradient(0, floorY - 4, 0, floorY + 80); fg.addColorStop(0, `rgba(${ACC},.35)`); fg.addColorStop(1, `rgba(${ACC},0)`);
      g.fillStyle = fg; g.fillRect(0, floorY - 2, W, 80); g.restore();
      ln(0, floorY, W, floorY, 1, { lw: 2, color: `rgba(${ACC2},.5)` });
    }
    if (p.crowd) drawCrowd(t, Tabs, mood, hero ? hero.x : CX, floorY, false);
  });
  g.save(); applyCam(cam, 1);
  if (p.crowd) drawCrowd(t, Tabs, mood, hero ? hero.x : CX, floorY, true);
  const state = {};
  for (const c of p.cast) {
    const L = (c._look ||= lookFor(c, p.place));
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
      if (a.kind === 'wheel') { const w = Math.sin(ts * 20); P.lLeg = Math.max(0, w) * 26; P.rLeg = Math.max(0, -w) * 26; Pa.hl = 60 + w * 40; Pa.hr = 60 - w * 40; }
      if (a.kind === 'scratch') Pa.hr = 165 + Math.sin(ts * 18) * 9;
      if (a.kind === 'laugh') { P.lift = -Math.abs(Math.sin(ts * 13)) * 9; P.head += Math.sin(ts * 13) * 4; E.open = .55 + .3 * Math.abs(Math.sin(ts * 13)); }
      if (a.kind === 'shades' && ts < .5) { Pa.hr = 160; Pa.hl = 160; }
      if (a.kind === 'calc') Pa.hl = -38 + Math.max(0, Math.sin(ts * 14)) * 14;
      if (a.kind === 'hello') { Pa.rEl = 20 + Math.sin(ts * 11) * 26; Pa.hr = 155 + Math.sin(ts * 11) * 22; }
      if (a.kind === 'wink') { E.wink = ts > .15 && ts < 1.3 ? 1 : 0; P.head += 8 * Math.sin(Math.PI * clamp(ts / 1.3)); E.smile = 1; E.open = 0; }
      if (a.kind === 'dance') { const w = Math.sin(ts * 9); Pa.hl = 110 + w * 55; Pa.hr = 110 - w * 55; Pa.lSh = 120 + w * 30; Pa.rSh = 120 - w * 30; P.lean = w * 7; P.head += w * 6; P.lift = -Math.abs(Math.sin(ts * 9)) * 14; }
      if (a.kind === 'panic') { Pa.hl = 135 + Math.sin(ts * 19) * 25; Pa.hr = 135 + Math.sin(ts * 19 + 2) * 25; Pa.lSh = 140 + Math.sin(ts * 19) * 20; Pa.rSh = 140 + Math.sin(ts * 19 + 2) * 20; P.lLeg = Math.max(0, Math.sin(ts * 22)) * 20; P.rLeg = Math.max(0, -Math.sin(ts * 22)) * 20; }
      // хомяк копит: монеты летят в рот, щёки раздуваются
      // двойной взгляд: голова дёргается в момент шока
      if (['spend', 'panic', 'cashback'].includes(a.kind) && ts < .7) P.head += -16 * Math.exp(-ts * 5) * Math.sin(ts * 24);
      if (a.kind === 'save' && c.kind === 'hamster') E.cheek = Math.min(1, [0, 1, 2, 3].reduce((m, i) => m + spring(ts - .75 - i * .3, 2.6, .45) * .26, 0));
    }
    // говорит за кадром (рассказчик) и не занят действием — жестикулирует по смыслу фразы
    const busy = acts.some(a => a.who === c.name && a.ta <= t && t - a.ta < 1.5 && !['talk', 'address', 'hello'].includes(a.kind));
    if (INK && c.kind === leadKind && c === hero && !busy && !p.subscribe && t < s.speak + .2) applyGesture(s, t, P, Pa, Tabs);
    if (c.kind === leadKind) idleLife(P, Tabs, L.ph || 0);
    for (const key of ['hl', 'hr']) P[key] = Pa[key];
    if ((c.kind === leadKind || p.say?.who === c.name) && (p.speak || p.say?.who === c.name || acts.some(a => a.who === c.name && ['address', 'hello', 'talk'].includes(a.kind) && a.ta - .3 <= t))) {
      const m = mouthAt(s, t, Tabs); E.talk = m * .8; P.head += m * 3.5 - 1.5;
    }
    for (const key of ['lSh', 'lEl', 'rSh', 'rEl']) P[key] = Pa[key];
    // остальные смотрят на того, кто сейчас действует
    if (actorNow && actorNow.who !== c.name) { const other = p.cast.find(o => o.name === actorNow.who); if (other) E.lx = Math.sign(other.x - c.x) * c.flip * .8; }
    // «Зверо-новости»: тот, кто слушает, живой — кивает, улыбается, удивляется, смеётся над шуткой, закатывает глаза
    if (PLAN.news && actorNow && actorNow.who !== c.name && !acts.some(a => a.who === c.name && a.ta <= t && t - a.ta < 2)) listenReact(s, t, c, P, E, Tabs);
    // выход на сцену: шаг из-за края кадра, с покачиванием и «приземлением»
    let x = c.x, enterU = 1;
    if (c.enter && !(VERT && s.idx === 0)) {   // в Shorts герой уже в кадре на первом кадре
      const u = seg(t, 0, .95), from = c.x < CX ? -260 : W + 260; x = lerp(from, c.x, emph(u)); enterU = u;
      if (u < 1) { const w = Math.sin(t * 14); P.lLeg = w * 18; P.rLeg = -w * 18; P.lift = -Math.abs(w) * 10; }
    }
    if (acts.some(a => a.who === c.name && a.kind === 'panic' && a.ta <= t)) x += Math.sin(t * 40) * 4;
    let dy = 0, kk = kOf(c);
    const cur = acts.filter(a => a.who === c.name && a.ta <= t).pop();
    if (cur?.kind === 'sleep') dy = -96 * emph(seg(t - cur.ta, 0, .5));
    if (cur?.kind === 'rocket') { const ts = t - cur.ta, q = Math.pow(seg(ts, .7, 2.4), 2); kk *= .86; dy = -150 * emph(seg(ts, 0, .4)) - 950 * q; x += c.flip * 700 * q + Math.sin(t * 50) * 3 * seg(ts, .4, .8); }
    if (cur?.kind === 'wheel') { kk *= .78; dy = -32; }
    if (cur?.kind === 'walk') { const ts = t - cur.ta, u = seg(ts, 0, 1.5), from = c.x - c.flip * 760; x = lerp(from, c.x, eio(u)); if (u < 1) Object.assign(P, walkPose(Math.abs(x - from), true, P)); }
    if (p.phones?.includes(c.name)) { E.phones = 1; P.head += Math.sin(Tabs * 7.5) * 6; }   // в наушниках: качает головой в такт
    // «Зверо-новости»: в разговоре ведущие поворачиваются друг к другу (корпус наклонён, взгляд на собеседника); Крот пьёт кофе
    let turn = 0, coffee = null, gfx = null;
    if (PLAN.news && p.place === 'newsroom') {
      const u = newsTurn(s, t, c), other = p.cast.find(o => o !== c);
      if (u > .002 && other) { const d = Math.sign(other.x - c.x), l = d * c.flip; turn = l * u; P.lean += l * 6 * u; P.head += l * 4 * u; E.lx = lerp(E.lx || 0, l * .95, u); E.ly = (E.ly || 0) * (1 - u); x += d * 14 * u; }
      if (c.kind === 'mole' && (p.sip || p.spit || p.show)) coffee = newsCoffeePose(p, p.sip ? t * newsSipK(s) : t, P, E, c.flip) || {};
      gfx = newsGagPose(s, t, c, P, E); if (gfx?.dy) dy += gfx.dy;   // происшествие в эфире / «лапки вверх»
    }
    state[c.name] = { c, L, P, E, x, k: kk, dy, cur, enterU, turn, coffee, gfx };
  }
  // реквизит за героем: колесо, гора купюр, ракета, доска с графиком
  for (const name in state) {
    const st = state[name], a = st.cur; if (!a) continue; const ts = t - a.ta, f = st.c.flip, x = st.x;
    if (a.kind === 'wheel') { const cy = floorY - 300, r = 318, p = settle(seg(ts, 0, .4)); g.save(); g.translate(x, cy); g.scale(p, p);
      rline(-200, 290, 0, 40, 951, 9); rline(200, 290, 0, 40, 952, 9);
      g.beginPath(); roughEllipse(0, 0, r, r, 953, 2); g.fillStyle = 'rgba(255,255,255,.55)'; g.fill(); inkStroke(8); g.beginPath(); roughEllipse(0, 0, r - 26, r - 26, 954, 2); inkStroke(4);
      for (let i = 0; i < 24; i++) { const aa = i / 24 * 6.283 - ts * 7; g.beginPath(); g.moveTo(Math.cos(aa) * (r - 26), Math.sin(aa) * (r - 26)); g.lineTo(Math.cos(aa) * r, Math.sin(aa) * r); inkStroke(3); }
      g.restore(); }
    if (a.kind === 'sleep') { const p = settle(seg(ts, 0, .45)); g.save(); g.translate(x, floorY); g.scale(p, p);
      for (let i = 0; i < 9; i++) { const yy = -i * 11, w = 360 - i * 18; g.beginPath(); g.roundRect(-w / 2 + (rnd(i * 3.3) - .5) * 20, yy - 12, w, 13, 4); g.fillStyle = i % 2 ? '#41c47f' : '#36a96c'; g.fill(); inkStroke(3); }
      g.restore(); }
    if (a.kind === 'chart') { const bx = x + f * 470, by = floorY - 430, p = settle(seg(ts, 0, .45)); g.save(); g.translate(bx, by); g.scale(p, p);
      rline(-200, 160, -240, 430, 970, 7); rline(200, 160, 240, 430, 971, 7);
      g.beginPath(); g.roundRect(-270, -180, 540, 350, 12); g.fillStyle = '#fff'; g.fill(); inkStroke(7);
      rline(-220, 120, 230, 120, 972, 3, .6); rline(-220, 120, -220, -150, 973, 3, .6);
      poly([[-210, 100], [-130, 60], [-70, 80], [10, 0], [80, 20], [170, -110]], eo(seg(ts, .3, 1.6)), { color: '#2fbf71', lw: 9 });
      if (ts > 1.5) txt('↗', 190, -100, { size: 70, w: 900, color: '#2fbf71', alpha: seg(ts, 1.5, 1.8) });
      g.restore(); }
  }
  // предметы в руках (карта при оплате/кэшбэке, купюры после получения)
  const heldFor = name => {
    const mine = acts.filter(a => a.who === name && a.ta <= t), last = mine[mine.length - 1];
    if (!last) return null;
    if ((last.kind === 'pay' || last.kind === 'cashback') && p.card) return fl => { g.scale(fl, 1); g.rotate(Math.PI / 2 * fl); bankCard(120, last.kind === 'cashback' ? VIO2 : VIO); };
    if (last.kind === 'calc') return () => { g.rotate(-.2); g.beginPath(); g.roundRect(-34, -96, 68, 96, 10); g.fillStyle = '#5b5f69'; g.fill(); inkStroke(4); g.fillStyle = '#c8f7c5'; g.fillRect(-24, -86, 48, 22); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { g.fillStyle = (i + j) % 3 ? '#e9ecef' : VIO; g.fillRect(-24 + i * 17, -56 + j * 17, 13, 13); } };
    if (last.kind === 'chart') return () => { g.rotate(-1.2); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -150); inkStroke(7); g.strokeStyle = '#c58f5c'; g.lineWidth = 4; g.stroke(); };
    if (last.kind === 'receive' && t - last.ta > .9) return () => { for (let i = 0; i < 3; i++) { g.save(); g.rotate((i - 1) * .25); banknote(0, -22, 0, .8); g.restore(); } };
    return null;
  };
  // студия: микрофон на штанге у рта ведущего
  if (INK && p.place === 'studio' && hero && state[hero.name]) {
    const st = state[hero.name], f = st.c.flip, mx = st.x + f * 205 * st.k, my = floorY + st.dy - 330 * st.k;
    g.beginPath(); g.moveTo(st.x + f * 620, 120); g.lineTo(mx + f * 70, my - 90); g.strokeStyle = INKC; g.lineWidth = 16; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#4c566a'; g.lineWidth = 9; g.stroke();
    g.save(); g.translate(mx, my); g.rotate(f * -.5); g.beginPath(); g.roundRect(-34, -70, 68, 120, 34); const mg = g.createLinearGradient(-34, 0, 34, 0); mg.addColorStop(0, '#5b6372'); mg.addColorStop(.5, '#9aa3b2'); mg.addColorStop(1, '#3b4252'); g.fillStyle = mg; g.fill(); inkStroke(5);
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-28, -40 + i * 14); g.lineTo(28, -40 + i * 14); g.strokeStyle = 'rgba(27,26,31,.35)'; g.lineWidth = 3; g.stroke(); } g.restore();
  }
  for (const name in state) { const st = state[name]; if (st.enterU < 1) speedLines(st.x, floorY + st.dy, st.x < CX ? 1 : -1, st.k, 1 - seg(st.enterU, .6, 1)); }
  for (const name in state) {
    const st = state[name], held = st.coffee ? (p.spit && t < 1.4 ? newsCupHeld : null) : heldFor(name);   // Крот с кофе: стаканчик в лапе (у рта его рисует newsCoffeeDraw)
    (st.L.ham ? drawHamster : drawPerson)(st.L, st.x, floorY + st.dy, st.k, st.P, st.E, Tabs, { flip: st.c.flip, held, turn: st.turn });
    if (st.coffee) newsCoffeeDraw(p, p.sip ? t * newsSipK(s) : t, st, floorY);
    st.gfx?.after?.({ ...st, y: floorY + st.dy });
  }
  if (INK && p.place === 'newsroom') newsDesk(Tabs, floorY, Object.values(state).map(st => ({ x: st.x, name: st.c.name })));
  // поверх героев: нотки из наушников, искорка подмигивания
  for (const name in state) {
    const st = state[name], f = st.c.flip, hx = st.x, hy = floorY + st.dy - 400 * st.k;
    if (st.E.phones) for (let i = 0; i < 3; i++) { const q = (Tabs * .55 + i / 3) % 1, sd = i % 2 ? 1 : -1; txt(i % 2 ? '♪' : '♫', hx + sd * (190 + q * 40) * st.k, hy - q * 220 * st.k, { size: 70 * st.k, w: 900, color: ['#7048e8', '#e5383b', '#2fbf71'][i], align: 'center', alpha: Math.sin(Math.PI * q) }); }
    if (st.cur?.kind === 'wink') { const ts = t - st.cur.ta, q = Math.sin(Math.PI * clamp((ts - .15) / 1)); if (q > 0) { g.save(); g.translate(hx + f * 120 * st.k, hy + 30 * st.k); g.rotate(ts * 2); g.scale(q * st.k, q * st.k); g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 14 : 46, a = i / 8 * 6.2832; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = '#ffd43b'; g.fill(); inkStroke(4); g.restore(); } }
  }
  // имена под героями
  if (!PLAN.candy) for (const name in state) { const st = state[name]; mono(name.toUpperCase(), st.x, floorY + 46, 24, VIO2, { align: 'center', w: 700, ls: 4, alpha: seg(t, .3, .8) }); }
  if (PLAN.candy) {
    // шок — манга-линии по краям кадра вокруг героя
    const pn = acts.find(a => a.kind === 'panic' && t >= a.ta && state[a.who]); if (pn) { const st = state[pn.who]; speedLines(st.x, floorY - 330 * st.k, t - pn.ta); }
    // знакомство: при первом появлении героя — плашка с именем и стрелкой
    for (const name in state) { const st = state[name]; if (st.c.intro) introTag(name, st.x, floorY - 560 * st.k, VERT && s.idx === 0 && PLAN.hook ? t - 2 : t); }   // в первой сцене Shorts — после крючка
    // реплики героев рисует вертикальная раскладка (player.composeCandy) — в экранных координатах, чтобы крупный план их не обрезал
  }
  // эффекты действий
  for (const a of acts) {
    const st = state[a.who]; if (!st) continue; const ts = t - a.ta; if (ts <= 0) continue;
    const k = st.k, f = st.c.flip, hx = st.x, head = floorY - 520 * k, [hwx, hwy] = st.L.ham ? hamPaw(st.x, floorY, k, st.P, f) : handWorld(st.x, floorY, k, st.P, f), side = st.x + f * (st.L.ham ? 330 : 270);
    const val = a.value || '';
    if (INK && ['spend', 'panic', 'cashback'].includes(a.kind)) exclaim(hx + f * 150 * k, head - 10, ts);
    if (INK && STICKERS[a.kind] && !p.subscribe) { const sd = (a.wi || 0) + (s.idx || 0) * 7, ws = STICKERS[a.kind]; sticker(ws[sd % ws.length], clamp(hx + 360 * k, 260, W - 260), Math.max(190, head - 90), ts - .12, sd); }   // справа от героя — попадает и в квадратный кадр Shorts
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
      case 'courier': miniCourier(st, ts, floorY, val); break;
      case 'cart': miniCart(st, ts, floorY, val); break;
      case 'laptop': miniLaptop(st, ts, floorY, val, p.news?.cat); break;
      case 'phone': miniPhone(st, ts, floorY, val, s.text, p.news?.cat); break;
      case 'think': bubble(hx + f * 150, head - 40, ts - .1, p.bubble || '?'); break;
      case 'happy': confetti(hx, head - 80, ts); break;
      case 'sad': rainCloud(hx, head - 60, ts); break;
      case 'panic': for (let i = 0; i < 6; i++) { const q = ((ts * 1.4 + i / 6) % 1), sd = i % 2 ? 1 : -1; g.save(); g.globalAlpha *= 1 - q; g.fillStyle = '#7fc4ff'; g.beginPath(); g.ellipse(hx + sd * (140 + q * 120), head + 40 - q * 60 + q * q * 160, 9, 13, sd * .5, 0, 6.2832); g.fill(); if (INK) inkStroke(3); g.restore(); } break;
      case 'sleep': for (let i = 0; i < 3; i++) { const q = ((ts * .45 + i / 3) % 1); txt('z', hx + f * (90 + q * 120), floorY + st.dy - 470 * k - q * 120, { size: 46 + q * 30, w: 900, color: INKC, alpha: Math.sin(Math.PI * q) }); } break;
      case 'calc': for (let i = 0; i < 4; i++) { const q = seg(ts, .3 + i * .3, 1.1 + i * .3); if (q > 0 && q < 1) txt(['+%', '₽', '×2', '='][i], hwx + (i - 1.5) * 40, hwy - 90 - q * 160, { size: 44, w: 900, color: '#2fbf71', align: 'center', alpha: Math.sin(Math.PI * q) }); } break;
      case 'scratch': for (let i = 0; i < 3; i++) { const q = seg(ts, .2 + i * .25, .6 + i * .25); txt('?', hx + (i - 1) * 110 + f * 30, head - 20 - i * 18 + Math.sin(t * 4 + i) * 8, { size: 70 - i * 10, w: 900, color: INKC, align: 'center', alpha: q }); } break;
      case 'wheel': { g.save(); g.translate(hx, floorY - 300); for (let i = 0; i < 6; i++) { const aa = i / 6 * 6.283 - ts * 7; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(aa) * 290, Math.sin(aa) * 290); g.globalAlpha = .35; inkStroke(3); } g.restore(); for (let i = 0; i < 4; i++) { const q = ((ts * 2 + i / 4) % 1); g.save(); g.globalAlpha *= 1 - q; g.fillStyle = '#7fc4ff'; g.beginPath(); g.ellipse(hx - f * (60 + q * 90), floorY - 480 * k + q * 60, 7, 10, 0, 0, 6.2832); g.fill(); g.restore(); } break; }
      case 'rocket': {
        const rx = st.x, ry = floorY + st.dy - 90 * k, p = settle(seg(ts, 0, .35));
        for (let i = 0; i < 10; i++) { const q = ((ts * 1.5 + i / 10) % 1); if (ts < .3) break; const sx = rx - f * (220 + q * 360) + (rnd(i * 4.1) - .5) * 120 * q, sy = ry + 60 + q * 120; g.save(); g.globalAlpha *= (1 - q) * .9; g.beginPath(); roughEllipse(sx, sy, 34 + q * 70, 24 + q * 44, 960 + i, 1.5); g.fillStyle = '#fff'; g.fill(); inkStroke(4); g.restore(); }
        g.save(); g.translate(rx, ry); g.scale(f * p, p); g.rotate(-.32);
        const fl = 70 + Math.sin(t * 40) * 20 + 70 * seg(ts, .5, .9);
        g.beginPath(); g.moveTo(-250, -30); g.quadraticCurveTo(-250 - fl * 2.2, 0, -250, 30); g.fillStyle = '#ff9f1c'; g.fill(); inkStroke(5);
        g.beginPath(); g.moveTo(-250, -16); g.quadraticCurveTo(-250 - fl * 1.2, 0, -250, 16); g.fillStyle = '#ffe066'; g.fill();
        g.beginPath(); g.moveTo(-260, -52); g.lineTo(150, -60); g.quadraticCurveTo(330, 0, 150, 60); g.lineTo(-260, 52); g.closePath(); g.fillStyle = '#fbfaf7'; g.fill(); inkStroke(7);
        g.beginPath(); g.moveTo(150, -60); g.quadraticCurveTo(330, 0, 150, 60); g.quadraticCurveTo(190, 0, 150, -60); g.fillStyle = '#e8394d'; g.fill(); inkStroke(5);
        for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(-180, sd * 50); g.lineTo(-280, sd * 120); g.lineTo(-250, sd * 48); g.closePath(); g.fillStyle = '#e8394d'; g.fill(); inkStroke(5); }
        g.beginPath(); g.arc(40, 0, 24, 0, 6.2832); g.fillStyle = '#9cd6ff'; g.fill(); inkStroke(5);
        g.restore();
      }
      if (ts > .8) for (let i = 0; i < 8; i++) { const yy = ((ts * 900 + i * 160) % 1100) - 50; rline(hx - 380 + i * 105, yy, hx - 380 + i * 105, yy + 120, 990 + i, 4, .5); } break;
      case 'hello': if (ts < 2.6) bubble(hx + f * 230, head - 30, ts - .2, 'Привет!', false); break;
      case 'grab': { // кот утаскивает деньги у героя
        const other = Object.values(state).find(o => o.c.name !== a.who), ox = other ? other.x : hx + f * 600;
        flyMoney(ox, floorY - 300, hwx, hwy, ts - .2, 7, false, .7); if (val) floatLabel('−' + val, hwx + f * 230, hwy - 40, ts - .9, RED); break; }
      case 'laugh': for (let i = 0; i < 3; i++) { const q = ((ts * .9 + i / 3) % 1); txt(['ХА', 'ХА', 'ХА!'][i], hx + f * (150 + i * 60), head - 40 - q * 90, { size: 52, w: 900, color: INKC, align: 'center', alpha: Math.sin(Math.PI * q) }); } break;
      default: break;
    }
  }
  // подписка: хомяк показывает на кнопку и нажимает её
  if (p.subscribe && hero) {
    const bx = hero.x + 600, by = 640, tc = Math.max(1.1, d * .5), bp = settle(seg(t, .3, .8)), clicked = t > tc + .25, press = 1 - .08 * Math.sin(seg(t, tc, tc + .25) * Math.PI);
    if (bp > 0) { g.save(); g.translate(bx, by); g.scale(bp * press, bp * press); g.rotate(-.03); g.beginPath(); g.roundRect(-300, -70, 600, 140, 70); g.fillStyle = clicked ? '#fff' : VIO; g.fill(); inkStroke(7);
      txt(clicked ? 'ВЫ ПОДПИСАНЫ ✓' : 'ПОДПИСАТЬСЯ', 0, 22, { size: 58, w: 900, color: INKC, align: 'center' }); g.restore(); }
    const cp = eio(seg(t, tc - .7, tc)); if (t > tc - .9) { g.save(); g.translate(lerp(W + 80, bx + 120, cp), lerp(H + 80, by + 30, cp)); g.rotate(-.4); g.beginPath(); roughEllipse(0, 0, 22, 34, 991, 1); g.fillStyle = HAM.cream; g.fill(); inkStroke(5); g.restore(); }
    if (clicked) { confetti(bx, by - 120, t - tc - .25); for (let k = 0; k < 2; k++) { const r = seg(t, tc + .25 + k * .15, tc + 1 + k * .15); if (r > 0 && r < 1) { g.save(); g.globalAlpha *= 1 - r; g.beginPath(); g.roundRect(bx - 300 - r * 80, by - 70 - r * 40, 600 + r * 160, 140 + r * 80, 90); inkStroke(5); g.restore(); } } }
  }
  g.restore();
  if (!INK) return;
  // передний план: ближе камеры, быстрее и сильнее размыт
  if (p.place && !p.subscribe && FOREGROUND[p.place]) drawLayer(7 + (cam.z - 1) * 6, () => { applyCam(cam, 1.35); drawForeground(p.place); });   // нет переднего плана — не размываем пустой слой (это дорого)
  // свет: время суток эпизода и настроение момента
  const hs = hero && state[hero.name], warm = ['happy', 'grow', 'compare', 'cashback', 'receive', 'rocket', 'save'], cold = ['spend', 'sad', 'panic'];
  const md = heroAct && (warm.includes(heroAct.kind) ? 'warm' : cold.includes(heroAct.kind) ? 'cold' : null);
  const sx = hs ? cam.S[0] + (hs.x - cam.F[0]) * cam.z : CX, sy = hs ? cam.S[1] + (floorY - 330 * hs.k - cam.F[1]) * cam.z : 540;
  grade(p.place === 'newsroom' ? 'day' : PLAN.episode?.tod || 'day', md, md ? seg(t - heroAct.ta, .1, .7) : 0, sx, sy);   // студия новостей освещена сама — без «ночной» пелены
  if (p.place === 'studio') vlogHud(Tabs);
};
// интерфейс камеры блогера: рамка видоискателя, мигающий REC, таймкод
function vlogHud(T) {
  g.save(); g.setTransform(SS, 0, 0, SS, 0, 0); g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5; g.lineCap = 'round';
  for (const [x, y, sx, sy] of [[60, 120, 1, 1], [W - 60, 120, -1, 1], [60, H - 60, 1, -1], [W - 60, H - 60, -1, -1]]) { g.beginPath(); g.moveTo(x, y + sy * 60); g.lineTo(x, y); g.lineTo(x + sx * 60, y); g.stroke(); }
  if (Math.floor(T * 1.6) % 2 === 0) { g.beginPath(); g.arc(W - 220, 160, 13, 0, 6.2832); g.fillStyle = '#e8394d'; g.fill(); }
  mono('REC', W - 196, 170, 30, '#fff', { w: 700 });
  const tc = Math.floor(T), fr = Math.floor((T % 1) * 30); mono(`00:${String(Math.floor(tc / 60)).padStart(2, '0')}:${String(tc % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`, W - 340, H - 80, 26, 'rgba(255,255,255,.9)', { w: 700 });
  g.restore();
}

// ---------- фирменная заставка (2 с): вспышка цвета канала, хомяк выпрыгивает, машет, подмигивает, штамп логотипа ----------
T.ident = function (t, d, s) {
  const cx = CX, cy = 540, floorY = 880, k = 1.15, Tabs = s.start + t;
  const cr = emph(seg(t, 0, .55)) * 640;
  if (cr > 2) {
    g.save(); g.translate(cx, cy); g.rotate(t * .35); g.globalAlpha *= .5 * seg(t, .15, .6);
    for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.beginPath(); g.moveTo(cr * .62, 0); g.lineTo(cr * .95 + 40, 0); inkStroke(7); }
    g.restore();
    g.beginPath(); roughEllipse(cx, cy, cr * .62, cr * .62, 901, 2); g.fillStyle = VIO; g.fill(); inkStroke(7);
  }
  const look = hostLook({ ham: true, ph: 1.3, outfit: 'suit' });
  const P = { ...POSES.neutral }, E = { ...EMOS.happy }, jt = t - .15;
  const jy = jt > 0 ? (1 - Math.min(1.1, spring(jt, 1.7, .5))) * 760 : 900;
  if (jt > 0 && jt < .5) P.lift = 0;
  const wv = seg(t, .85, 1.05); const W2 = blendPose(P, POSES.wave, wv); W2.hr = 155 + Math.sin(t * 12) * 22 * wv;
  if (t > 1.15 && t < 1.65) { E.wink = 1; E.open = .2; }
  drawHamster(look, cx, floorY + jy, k, W2, E, Tabs, { flip: 1 });
  const lp = settle(seg(t, 1.0, 1.4));
  if (lp > 0) {
    const name = PLAN.brand?.name || 'ХОМЯК', w = tw(name, 104, 900) + 100;
    g.save(); g.translate(cx, 930); g.rotate(-.035); g.scale(lp, lp);
    g.beginPath(); g.roundRect(-w / 2, -66, w, 118, 22); g.fillStyle = '#fff'; g.fill(); inkStroke(8);
    txt(name, 0, 30, { size: 104, w: 900, color: INKC, align: 'center', ls: 4 });
    g.restore();
    if (PLAN.brand?.tagline) mono(PLAN.brand.tagline, cx, 1030, 26, INKC, { align: 'center', w: 700, ls: 6, alpha: seg(t, 1.35, 1.7) });
  }
};

// ---------- сцена предложения (партнёрская интеграция) ----------
// Хомяк показывает на карту, выгоды появляются галочками, наклейка «ссылка в описании», внизу — маркировка рекламы (38-ФЗ).
// PLAN.offer = { title, cardText, perks[], advertiser, erid, color } — задаётся в боте; без него сцена остаётся «ссылка в описании».
T.offer = function (t, d, s) {
  const o = PLAN.offer || {}, floorY = 975, Tabs = s.start + t, hx = 470;
  // фон — место, где хомяк был в последней сцене истории (в блоге — студия), иначе банк
  const bg = SC.slice(0, s.idx).reverse().find(x => x.type === 'story')?.p?.place || 'bank';
  drawLayer(INK ? 8 : 0, () => { g.fillStyle = PAPER; g.fillRect(-200, -200, W + 400, H + 400); if (INK) drawLocation(bg, Tabs); });
  if (INK) { g.save(); g.fillStyle = PAPER; g.globalAlpha = .35; g.fillRect(0, 0, W, H); g.restore(); }
  // лучи за картой
  const cx = 1200, cy = 420, cp = settle(seg(t, .15, .7));
  g.save(); g.translate(cx, cy); g.rotate(Tabs * .15); g.globalAlpha *= .5 * cp;
  for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, -30); g.lineTo(760, -60); g.lineTo(760, 60); g.closePath(); g.fillStyle = i % 2 ? VIO : 'rgba(255,255,255,0)'; g.fill(); }
  g.restore();
  // карта: влетает с поворотом, покачивается, по ней пробегает блик
  if (cp > 0) {
    const w = 600, h = w * .63, flip = Math.cos((1 - cp) * Math.PI * .9), tilt = Math.sin(Tabs * 1.3) * .04;
    g.save(); g.translate(cx + (1 - cp) * 500, cy + Math.sin(Tabs * 1.6) * 8); g.rotate(-.1 + tilt); g.scale(Math.max(.05, Math.abs(flip)) * cp, cp);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.roundRect(-w / 2 + 18, -h / 2 + 22, w, h, 34); g.fill();
    const base = o.color || VIO, gr = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); gr.addColorStop(0, mixHex(base, '#ffffff', .15)); gr.addColorStop(.55, base); gr.addColorStop(1, mixHex(base, '#000000', .45));
    g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 34); g.fillStyle = gr; g.fill(); if (INK) inkStroke(9);
    g.save(); g.clip(); const sx = ((Tabs * .6) % 2) * (w * 1.6) - w * 1.1; const sg = g.createLinearGradient(sx, 0, sx + 180, 0); sg.addColorStop(0, 'rgba(255,255,255,0)'); sg.addColorStop(.5, 'rgba(255,255,255,.45)'); sg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sg; g.rotate(-.35); g.fillRect(-w, -h * 2, w * 3, h * 4); g.restore();
    g.beginPath(); g.roundRect(-w * .38, -h * .16, w * .16, h * .24, 10); const cg = g.createLinearGradient(0, -h * .16, 0, h * .08); cg.addColorStop(0, '#fff0b3'); cg.addColorStop(1, '#d9a93a'); g.fillStyle = cg; g.fill(); if (INK) inkStroke(4);
    txt((o.cardText || SC.find(x => x.type === 'screen')?.p?.domain || 'КЭШБЭК').toUpperCase(), -w * .38, -h * .27, { size: 46, w: 900, color: '#fff' });
    mono('•••• 2048', -w * .38, h * .36, 30, 'rgba(255,255,255,.85)', { w: 700, ls: 4 });
    for (const [dx, col] of [[.27, '#ff5f6d'], [.37, '#ffb347']]) { g.beginPath(); g.arc(w * dx, h * .3, w * .065, 0, 6.2832); g.fillStyle = col; g.globalAlpha = .9; g.fill(); g.globalAlpha = 1; }
    g.restore();
  }
  // выгоды — по одной, с галочкой
  (o.perks || []).slice(0, 3).forEach((pk, i) => {
    const q = settle(seg(t, .9 + i * .35, 1.25 + i * .35)); if (q <= 0) return;
    const y = 700 + i * 82, x = 900, tw0 = tw(pk, 44, 800) + 110;
    g.save(); g.translate(x, y); g.scale(q, q); g.rotate(-.01 * (i - 1));
    g.beginPath(); g.roundRect(-20, -48, tw0, 70, 18); g.fillStyle = '#fff'; g.fill(); if (INK) inkStroke(5);
    g.beginPath(); g.arc(22, -13, 22, 0, 6.2832); g.fillStyle = '#2fbf71'; g.fill(); if (INK) inkStroke(4);
    g.beginPath(); g.moveTo(11, -13); g.lineTo(19, -4); g.lineTo(34, -22); g.strokeStyle = '#fff'; g.lineWidth = 6; g.lineCap = 'round'; g.stroke();
    txt(pk, 62, 2, { size: 44, w: 800, color: INKC }); g.restore();
  });
  // хомяк показывает на карту и говорит
  const P = blendPose(POSES.wave, POSES.point, settle(seg(t, .3, .8))), E = { ...EMOS[t > 1.2 ? 'happy' : 'proud'] };
  E.open = 0; E.talk = mouthAt(s, t, Tabs) * .8;
  drawHamster(hostLook({ ham: true, ph: 1.3, outfit: PLAN.episode?.outfit || 'suit' }), hx, floorY + (1 - emph(seg(t, 0, .45))) * 500, 1.15, P, E, Tabs, { flip: 1 });
  // наклейка «ссылка в описании ↓»
  const lp = settle(seg(t, 1.4, 1.8));
  if (lp > 0) {
    const label = /закреп/i.test(s.text) ? 'ССЫЛКА В ЗАКРЕПЕ' : 'ССЫЛКА В ОПИСАНИИ', w = tw(label, 50, 900) + 120, pul = 1 + .04 * Math.sin(Tabs * 6);
    g.save(); g.translate(1440, 975); g.rotate(-.05); g.scale(lp * pul, lp * pul);
    g.beginPath(); g.roundRect(-w / 2, -50, w, 96, 48); g.fillStyle = '#e8394d'; g.fill(); if (INK) inkStroke(7);
    txt(label + ' ↓', 0, 18, { size: 50, w: 900, color: '#fff', align: 'center' }); g.restore();
  }
  // маркировка рекламы — весь кадр сцены
  if (o.advertiser || o.erid) {
    const m = `Реклама. ${o.advertiser || ''}${o.erid ? `. erid: ${o.erid}` : ''}`.replace(/\.\s*\./g, '.');
    g.save(); g.globalAlpha = .92; g.fillStyle = 'rgba(255,255,255,.85)'; const mw = tw(m, 24, 600) + 40; g.fillRect(24, H - 64, mw, 40); mono(m, 44, H - 36, 24, INKC, { w: 600 }); g.restore();
  }
};
