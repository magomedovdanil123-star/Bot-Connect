/* ============================================================================
 * «Что будет с телом, если…» — научпоп про организм. Визуал полностью кодом (движок code-cartoon, MIT):
 * тёмно-синий «сканер», органы — светящиеся векторные формы, частицы (сахар, инсулин, кровь),
 * графики и счётчики. Каждая фраза диктора = своя картинка (window.LECTURE.beats), время — window.TM.
 * ==========================================================================*/
const { ease, prog, lerp, clamp, rng } = Sketch;
const LEC = window.LECTURE, TM = window.TM, PH = TM.PH, TAU = Math.PI * 2;
const N = Math.min(LEC.beats.length, PH.length);
const bStart = (i) => (i >= N ? TM.END + 5 : PH[i].s - .3);
const BRAND = LEC.brand || "ТЕЛО ИЗНУТРИ";
Sketch.config.grain = 0; Sketch.config.paperJitter = 0;
window.SKETCH_PALETTES.lab = { label: "Lab", paper: "#07101f", tooth: "#0b1830", line: "#eaf6ff", soft: "#8fb3cc", guide: "#1b3354", a1: "#38d6ff", a2: "#ff4d6a", a3: "#ffb02e", warm: "#3ee08f", glow: .85, shade: "dark", kind: "plain" };

// цвета ролей
const C = { cyan: "#38d6ff", red: "#ff4d6a", amber: "#ffb02e", green: "#3ee08f", white: "#eaf6ff", soft: "#8fb3cc", dim: "#2a4566", cola: "#6b2d12", colaHi: "#a4471d", violet: "#a98bff", pink: "#ff8fb1" };
let A = 1; // прозрачность текущей картинки (переход между фразами)

/* ---------------------------------------------------------------- утилиты */
const rgba = (hex, a) => Sketch.rgba(hex, a);
const MONT = (px, w = 900) => `${w} ${px}px Montserrat`, INTER = (px, w = 800) => `${w} ${px}px Inter`;
function txt(c, s, x, y, o = {}) {
  s = String(s ?? ""); if (!s) return;
  const p = o.p ?? 1; if (p <= 0) return;
  c.save(); c.globalAlpha = A * (o.a ?? 1) * clamp(p * 3, 0, 1); c.font = o.font || INTER(48); c.fillStyle = o.color || C.white;
  c.textAlign = o.align || "center"; c.textBaseline = "alphabetic";
  if (o.fit) { let px = parseInt(c.font.match(/(\d+)px/)[1]); const wide = () => Math.max(...s.split("\n").map((l) => c.measureText(l).width)); while (wide() > o.fit && px > 20) c.font = c.font.replace(/\d+px/, (px -= 4) + "px"); }
  const lines = o.maxW ? wrap(c, s, o.maxW) : s.split("\n"), lh = o.lh || parseInt(c.font.match(/(\d+)px/)[1]) * 1.18;
  const shown = Math.round(s.length * clamp(p, 0, 1)); let used = 0;
  lines.forEach((l, i) => { const k = Math.max(0, Math.min(l.length, shown - used)); used += l.length + 1; if (k > 0) c.fillText(o.type === false ? l : l.slice(0, k), x, y + i * lh); });
  c.restore();
}
function wrap(c, s, maxW) {
  const out = [];
  for (const para of String(s).split("\n")) { let line = ""; for (const w of para.split(" ")) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } out.push(line); }
  return out;
}
function glowCircle(g, x, y, r, color, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(color, a * A)); gr.addColorStop(1, rgba(color, 0)); g.save(); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
// путь SVG в коробке 0..bw × 0..bh → рисуем в центре (cx, cy) с масштабом s
function withBox(c, cx, cy, s, bw, bh, fn) { c.save(); c.translate(cx - bw * s / 2, cy - bh * s / 2); c.scale(s, s); try { fn(); } finally { c.restore(); } }
const PATH = {};
const path = (k) => PATH[k] || (PATH[k] = new Path2D(SVG[k]));
// контур органа: заливка-градиент, светящаяся обводка (на слое свечения — тоже)
function organ(c, g, k, cx, cy, s, col, o = {}) {
  const [bw, bh] = BOX[k], p = path(k), a = (o.a ?? 1) * A;
  withBox(c, cx, cy, s, bw, bh, () => {
    const gr = c.createLinearGradient(0, 0, bw, bh); gr.addColorStop(0, rgba(o.fill || col, .55 * a * (o.fillA ?? 1))); gr.addColorStop(1, rgba(o.fill || col, .18 * a * (o.fillA ?? 1)));
    c.fillStyle = gr; c.fill(p); c.lineWidth = (o.lw || 4) / s; c.strokeStyle = rgba(col, .95 * a); c.lineJoin = "round"; c.stroke(p);
    if (o.inner) o.inner(c, bw, bh);
  });
  if (o.glow !== false) withBox(g, cx, cy, s, bw, bh, () => { g.lineWidth = (o.lw || 4) * 1.6 / s; g.strokeStyle = rgba(col, .8 * a * (o.glowA ?? 1)); g.stroke(p); });
}
// подпись-выноска: линия от точки к тексту справа
function callout(c, g, x0, y0, x1, y1, title, sub, p, col = C.cyan) {
  if (p <= 0) return; const q = ease.out(clamp(p * 1.6, 0, 1));
  c.save(); c.globalAlpha = A; c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0); const mx = lerp(x0, x1, q), my = lerp(y0, y1, q); c.lineTo(mx, my); if (q >= 1) c.lineTo(x1 + 40, y1); c.stroke();
  c.fillStyle = col; c.beginPath(); c.arc(x0, y0, 8, 0, TAU); c.fill(); c.restore(); glowCircle(g, x0, y0, 40, col, .6);
  txt(c, title, x1 + 60, y1 + 18, { font: MONT(64), align: "left", p: prog(p, .4, 1), color: C.white });
  if (sub) txt(c, sub, x1 + 60, y1 + 78, { font: INTER(38, 400), align: "left", p: prog(p, .55, 1), color: C.soft, maxW: 640 });
}
function panelTitle(c, s, y = 140, col = C.white) { txt(c, s, 960, y, { font: MONT(66), color: col, type: false }); }
const hexPts = (x, y, r, n = 6, rot = 0) => { const pts = []; for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } return pts; };
function poly(c, pts, fill, stroke, lw = 3) { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); } }
// частицы сахара: глюкоза — шестиугольник, фруктоза — пятиугольник
const glucose = (c, x, y, r, a = 1) => poly(c, hexPts(x, y, r, 6, Math.PI / 6), rgba(C.cyan, .35 * a * A), rgba(C.cyan, a * A), 2.5);
const fructose = (c, x, y, r, a = 1) => poly(c, hexPts(x, y, r, 5, -Math.PI / 2), rgba(C.amber, .35 * a * A), rgba(C.amber, a * A), 2.5);
function key(c, x, y, s, col = C.green, a = 1, rot = 0) { // ключ-инсулин
  c.save(); c.translate(x, y); c.rotate(rot); c.scale(s, s); c.globalAlpha = a * A; c.strokeStyle = col; c.fillStyle = rgba(col, .25); c.lineWidth = 4;
  c.beginPath(); c.arc(-14, 0, 12, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.moveTo(-2, 0); c.lineTo(26, 0); c.moveTo(16, 0); c.lineTo(16, 9); c.moveTo(24, 0); c.lineTo(24, 7); c.stroke(); c.restore();
}
function cube(c, x, y, s, a = 1) { // кубик сахара в изометрии
  c.save(); c.globalAlpha = a * A; c.translate(x, y); c.scale(s, s);
  poly(c, [[0, -20], [22, -9], [0, 2], [-22, -9]], "#ffffff", "#c9d6e3", 1.5); poly(c, [[-22, -9], [0, 2], [0, 26], [-22, 15]], "#dfe8f1", "#c9d6e3", 1.5); poly(c, [[22, -9], [0, 2], [0, 26], [22, 15]], "#c3d1df", "#b6c4d2", 1.5);
  c.restore();
}
function can(c, g, x, y, s = 1, a = 1) { // банка газировки без бренда: красная, белая волна, надпись КОЛА
  c.save(); c.globalAlpha = a * A; c.translate(x, y); c.scale(s, s);
  const w = 150, h = 280; const gr = c.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, "#8c0f1d"); gr.addColorStop(.35, "#e3263b"); gr.addColorStop(.6, "#ff5a6b"); gr.addColorStop(1, "#7a0c18");
  rr(c, -w / 2, -h / 2, w, h, 26); c.fillStyle = gr; c.fill();
  c.fillStyle = "#c9d3dc"; rr(c, -w / 2 + 8, -h / 2 - 14, w - 16, 26, 10); c.fill(); rr(c, -w / 2 + 10, h / 2 - 12, w - 20, 22, 9); c.fill();
  c.strokeStyle = "#ffffff"; c.lineWidth = 7; c.beginPath(); c.moveTo(-w / 2, 30); c.bezierCurveTo(-20, -10, 20, 70, w / 2, 20); c.stroke();
  c.fillStyle = "#ffffff"; c.font = MONT(40); c.textAlign = "center"; c.save(); c.translate(0, -30); c.fillText("КОЛА", 0, 0); c.restore();
  c.globalAlpha = .25 * a * A; c.fillStyle = "#fff"; rr(c, -w / 2 + 22, -h / 2 + 10, 16, h - 20, 8); c.fill();
  c.restore(); glowCircle(g, x, y, 260 * s, C.red, .25 * a);
}
// фон: сетка сканера, плывущие клетки, виньетка
function backdrop(d) {
  d.screen(d.ink, (c) => {
    const gr = c.createRadialGradient(960, 520, 100, 960, 540, 1150); gr.addColorStop(0, "#0d1d36"); gr.addColorStop(1, "#050a14"); c.fillStyle = gr; c.fillRect(0, 0, 1920, 1080);
    c.strokeStyle = "rgba(56,214,255,0.05)"; c.lineWidth = 1; for (let x = 0; x <= 1920; x += 80) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 1080); c.stroke(); } for (let y = 0; y <= 1080; y += 80) { c.beginPath(); c.moveTo(0, y); c.lineTo(1920, y); c.stroke(); }
    for (let i = 0; i < 28; i++) { const r = rng("cell", i), x = (r() * 2200 + d.t * (6 + r() * 10)) % 2100 - 90, y = r() * 1080 + Math.sin(d.t * .3 + i) * 20, rad = 6 + r() * 16;
      c.strokeStyle = `rgba(56,214,255,${.06 + r() * .08})`; c.lineWidth = 2; c.beginPath(); c.arc(x, y, rad, 0, TAU); c.stroke(); }
  });
}

/* ---------------------------------------------------------------- органы: SVG-пути в своих коробках */
const BOX = { liver: [300, 190], stomach: [210, 200], pancreas: [270, 115], brain: [260, 170], heart: [120, 130], tooth: [220, 230], kidney: [70, 110], tongue: [200, 260], lungL: [110, 190], lungR: [110, 190], gut: [200, 150] };
const SVG = {
  liver: "M18,62 C38,20 140,6 222,18 C272,25 298,44 288,72 C277,103 232,122 190,142 C148,162 106,178 76,162 C46,147 26,120 18,100 C12,86 10,74 18,62 Z",
  stomach: "M62,8 C62,40 52,62 40,92 C24,140 58,192 120,188 C176,184 204,142 194,104 C186,78 162,72 142,88 C126,100 110,96 104,80 C98,56 100,30 96,8 Z",
  pancreas: "M10,70 C20,40 60,34 92,44 C132,56 172,48 212,38 C242,31 264,39 264,54 C264,70 242,75 212,78 C172,82 132,90 96,100 C56,110 14,100 10,70 Z",
  brain: "M40,122 C10,112 4,72 30,52 C34,22 80,6 110,16 C132,0 176,0 196,20 C230,20 256,50 246,82 C266,106 246,142 210,140 C200,162 164,166 144,150 C120,166 84,162 74,142 C56,146 40,136 40,122 Z",
  heart: "M60,124 C40,104 6,84 6,48 C6,22 26,6 46,6 C58,6 60,18 60,26 C60,18 64,6 76,6 C96,6 114,22 114,48 C114,84 80,104 60,124 Z",
  tooth: "M40,22 C70,2 100,16 120,10 C150,0 186,10 190,46 C194,80 180,100 176,122 C170,162 166,212 150,216 C134,220 130,170 116,150 C100,170 96,222 76,216 C60,212 56,160 50,122 C46,102 26,82 28,52 C30,36 33,28 40,22 Z",
  kidney: "M38,4 C62,4 68,30 62,46 C56,58 50,56 50,66 C50,76 60,80 60,94 C58,106 44,108 32,106 C10,102 4,78 4,56 C4,26 16,4 38,4 Z",
  tongue: "M30,20 C70,0 130,0 170,20 C196,34 198,90 190,140 C180,210 140,256 100,256 C60,256 20,210 10,140 C2,90 4,34 30,20 Z",
  lungL: "M70,10 C40,20 14,70 8,120 C4,160 20,186 50,184 C80,182 96,170 100,150 L100,40 C100,20 88,6 70,10 Z",
  lungR: "M40,10 C70,20 96,70 102,120 C106,160 90,186 60,184 C30,182 14,170 10,150 L10,40 C10,20 22,6 40,10 Z",
  gut: "M20,20 C80,0 130,0 180,20 C200,30 200,60 180,70 C130,80 80,60 40,80 C10,95 10,125 40,135 C90,150 140,140 180,130",
};
// силуэт человека спереди (рентген): полуконтур, зеркалится
function bodyPath() {
  const half = [[0, 150], [24, 152], [30, 172], [96, 190], [124, 214], [138, 300], [146, 420], [140, 520], [132, 572], [124, 606], [104, 606], [100, 560], [104, 470], [100, 330], [90, 280], [84, 360], [78, 430], [96, 520], [94, 620], [86, 760], [80, 900], [84, 960], [98, 990], [34, 990], [34, 900], [30, 760], [22, 620], [0, 560]];
  const p = new Path2D(); const pts = half.concat(half.slice().reverse().map(([x, y]) => [-x, y]));
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); p.ellipse(0, 82, 56, 70, 0, 0, TAU); return p;
}
let BODY = null;
// где органы внутри силуэта (координаты силуэта: центр по x = 0, макушка ≈ 12, ступни ≈ 990)
const ORG = { brain: [0, 70, .34], teeth: [0, 128, 0], heart: [18, 300, .5], lungL: [-46, 300, .55], lungR: [46, 300, .55], liver: [-24, 400, .42], stomach: [34, 404, .36], pancreas: [10, 446, .3], kidneyL: [-40, 470, .36], kidneyR: [40, 470, .36], gut: [0, 520, .5], belly: [0, 480, 0] };
function drawBody(c, g, d, o, X, cx, cy, sc) {
  BODY = BODY || bodyPath();
  const focus = o.focus || "all", inP = ease.out(X.in);
  c.save(); c.translate(cx, cy); c.scale(sc, sc); c.translate(0, -500);
  const gr = c.createLinearGradient(0, 0, 0, 1000); gr.addColorStop(0, rgba(C.cyan, .10 * A)); gr.addColorStop(1, rgba(C.cyan, .03 * A));
  c.fillStyle = gr; c.fill(BODY); c.lineWidth = 3 / sc; c.strokeStyle = rgba(C.cyan, .8 * A * inP); c.stroke(BODY);
  // органы: фокус — ярко, остальные — тускло
  const on = (k) => focus === "all" || focus === k || (focus === "belly" && (k === "stomach" || k === "gut" || k === "liver"));
  const draw = (k, sk, col) => { const [x, y, s] = ORG[k]; if (!s) return; c.save(); organ(c, g, sk || k, x, y, s, col, { a: on(k) ? 1 : .22, glow: false, lw: 3 }); c.restore(); };
  draw("lungL", null, C.pink); draw("lungR", null, C.pink); draw("heart", null, C.red); draw("liver", null, "#e0624a"); draw("stomach", null, C.amber); draw("pancreas", null, "#ffd27a");
  draw("kidneyL", "kidney", C.violet); draw("kidneyR", "kidney", C.violet); draw("brain", null, C.pink);
  if (focus === "belly") { // висцеральный жир: жёлтые капли вокруг органов
    for (let i = 0; i < 26; i++) { const r = rng("vf", i), a = r() * TAU, rad = 40 + r() * 70, x = Math.cos(a) * rad, y = 470 + Math.sin(a) * rad * .8, q = prog(d.t, X.at(.1 + i * .02), X.at(.25 + i * .02));
      c.fillStyle = rgba("#ffd84a", .7 * q * A); c.beginPath(); c.arc(x, y, (6 + r() * 8) * q, 0, TAU); c.fill(); } }
  if (o.flow) { // глоток: капли по пищеводу в желудок
    for (let i = 0; i < 6; i++) { const u = ((d.t * .7 + i / 6) % 1), y = lerp(130, 390, u), x = lerp(0, 30, Math.max(0, (u - .7) / .3)); c.fillStyle = rgba(C.colaHi, .9 * A); c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill(); } }
  c.restore();
  if (o.scan) { // сканирующая линия сверху вниз
    const y = cy - 500 * sc + ((d.t - X.s) * 260 % (1000 * sc)); d.screen(d.glow, (gg) => { gg.fillStyle = rgba(C.cyan, .5 * A); gg.fillRect(cx - 200 * sc, y, 400 * sc, 3); });
  }
  if (focus !== "all" && ORG[focus]) { const [x, y] = ORG[focus], px = cx + x * sc, py = cy + (y - 500) * sc; glowCircle(g, px, py, 160 * sc, focus === "liver" ? "#e0624a" : C.amber, .5);
    callout(c, g, px, py, cx + 330, cy - 160, o.label || "", o.sub || "", X.pr(.15, .6), focus === "belly" ? "#ffd84a" : C.cyan); }
}

/* ---------------------------------------------------------------- картинки */
const V = {};
V.body = (c, g, d, o, X) => {   // общий план — весь силуэт; с фокусом — наезд, нужный орган в центре кадра по высоте
  const f = o.focus && o.focus !== "all" && ORG[o.focus], sc = f ? .9 * (1.25 + .1 * ease.inOut(X.pr(0, 1))) : .9;
  drawBody(c, g, d, o, X, f ? 640 : 960, f ? 540 - (ORG[o.focus][1] - 500) * sc : 560, sc); };

V.can = (c, g, d, o, X) => {
  const inP = ease.out(X.in); can(c, g, o.calm ? 960 : 700, 560 + (1 - inP) * 60, 1.5, inP);
  const n = o.cubes || 0; for (let i = 0; i < n; i++) { const q = ease.out(X.pr(.2 + i * .06, .35 + i * .06)); const col = i % 3, row = Math.floor(i / 3); cube(c, 1060 + col * 70 + row * 35, 700 - row * 60 - (1 - q) * 120, 1.4, q); }
  if (!o.calm) txt(c, n ? `${n} кубиков сахара` : "", 1230, 860, { font: INTER(40, 400), color: C.soft, p: X.pr(.7, .95) });
  txt(c, o.text, 960, 200, { font: MONT(80), p: X.pr(0, .3) });
};
V.pile = (c, g, d, o, X) => {
  const q = ease.out(X.pr(0, .75)), W0 = 16, total = W0 * (W0 + 1) / 2, shown = Math.round(total * q);
  for (let i = 0, row = 0, k = 0; i < shown; i++, k++) { if (k >= W0 - row) { row++; k = 0; } const r = rng("pile", i), w = W0 - row, x = 960 + (k - (w - 1) / 2) * 44 + (r() - .5) * 6, y = 900 - row * 36 + (r() - .5) * 4; cube(c, x, y, 1.1, 1); }
  glowCircle(g, 960, 760, 520, "#ffffff", .12 * q);
  can(c, g, 1500, 800, .55, ease.out(X.in));
  const grams = Math.round((o.grams || 1000) * q); txt(c, `${grams.toLocaleString("ru-RU")} г`, 960, 230, { font: MONT(150), color: C.white });
  txt(c, o.text, 960, 320, { font: INTER(46, 400), color: C.soft, p: X.pr(.2, .5) });
};
V.cubes = (c, g, d, o, X) => { // чайные ложки с сахаром
  const n = o.n || 7; panelTitle(c, o.text || "", 200, C.amber);
  for (let i = 0; i < n; i++) { const q = ease.out(X.pr(.05 + i * .08, .2 + i * .08)), x = 960 + (i - (n - 1) / 2) * 210, y = 600 - (1 - q) * 80;
    c.save(); c.globalAlpha = q * A; c.translate(x, y); c.rotate(-.5); c.strokeStyle = "#c9d6e3"; c.lineWidth = 10; c.lineCap = "round"; c.beginPath(); c.moveTo(0, 30); c.lineTo(0, 190); c.stroke();
    c.fillStyle = "#c9d6e3"; c.beginPath(); c.ellipse(0, 0, 42, 56, 0, 0, TAU); c.fill(); c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(0, -8, 34, 40, 0, 0, TAU); c.fill(); c.restore();
    glowCircle(g, x, y, 90, "#ffffff", .2 * q); }
  txt(c, `${n} чайных ложек`, 960, 900, { font: MONT(64), p: X.pr(.7, .95) });
};
V.title = (c, g, d, o, X) => {
  const p = X.pr(0, .3); glowCircle(g, 960, 520, 600, C.cyan, .18 * X.in);
  txt(c, o.text, 960, 560, { font: MONT(150), p, color: C.white }); txt(g, o.text, 960, 560, { font: MONT(150), p, color: C.cyan, a: .4 });
  txt(c, o.sub, 960, 660, { font: INTER(52, 400), color: C.soft, p: X.pr(.25, .5) });
  c.save(); c.globalAlpha = A; c.strokeStyle = C.cyan; c.lineWidth = 3; const w = 700 * ease.out(X.pr(.1, .5)); c.beginPath(); c.moveTo(960 - w, 600); c.lineTo(960 + w, 600); c.stroke(); c.restore();
};
V.rules = (c, g, d, o, X) => { can(c, g, 520, 560, 1.3, ease.out(X.in)); panelTitle(c, "ПРАВИЛА", 200, C.cyan);
  (o.items || []).forEach((it, i) => { const q = X.pr(.1 + i * .18, .3 + i * .18), y = 420 + i * 150; c.save(); c.globalAlpha = A * q; c.strokeStyle = C.green; c.lineWidth = 6; c.beginPath(); c.moveTo(820, y - 20); c.lineTo(842, y + 2); c.lineTo(880, y - 42); c.stroke(); c.restore(); txt(c, it, 920, y, { font: INTER(54), align: "left", p: q }); }); };
V.day = (c, g, d, o, X) => {
  const n = o.n || 1, p = ease.out(X.pr(0, .3));
  txt(c, "ДЕНЬ", 960, 400, { font: MONT(80, 800), color: C.soft, p }); txt(c, String(n), 960, 640, { font: MONT(280), color: C.white, p });
  txt(g, String(n), 960, 640, { font: MONT(280), color: C.cyan, a: .45, p });
  for (let i = 0; i < 30; i++) { const x = 960 + (i - 14.5) * 44, y = 760, done = i < n, q = X.pr(.1 + i * .01, .2 + i * .01); c.save(); c.globalAlpha = A * q; c.fillStyle = done ? (i === n - 1 ? C.amber : C.cyan) : C.dim; c.beginPath(); c.arc(x, y, i === n - 1 ? 13 : 9, 0, TAU); c.fill(); c.restore(); if (i === n - 1) glowCircle(g, x, y, 50, C.amber, .7 * q); }
  txt(c, o.text, 960, 880, { font: INTER(54, 400), color: C.amber, p: X.pr(.3, .6) });
};
V.tooth = (c, g, d, o, X) => {
  const er = (o.erode || 0) * ease.inOut(X.pr(.1, .8)), cx = 720, cy = 560, s = 2.3;
  organ(c, g, "tooth", cx, cy, s, "#e8f1f8", { fill: "#cfe3f2", inner: (cc, bw) => { // эмаль: толстая светлая кромка коронки, с выщерблинами при эрозии
    cc.save(); cc.clip(path("tooth")); cc.strokeStyle = rgba("#ffffff", .9 * A); cc.lineWidth = 16; cc.stroke(path("tooth")); cc.restore();
    for (let i = 0; i < Math.round(er * 22); i++) { const r = rng("pit", i), x = 40 + r() * 150, y = 8 + r() * 40; cc.fillStyle = rgba("#0b1a30", .85 * A); cc.beginPath(); cc.ellipse(x, y, 4 + r() * 6, 3 + r() * 4, 0, 0, TAU); cc.fill(); }
  } });
  if (o.acid) for (let i = 0; i < 10; i++) { const r = rng("drop", i), u = ((d.t * .45 + r()) % 1), x = cx - 180 + r() * 360, y = lerp(120, cy - 220, u); c.fillStyle = rgba(C.colaHi, .9 * A * (1 - u * .3)); c.beginPath(); c.arc(x, y, 10, 0, TAU); c.fill(); c.beginPath(); c.moveTo(x - 10, y); c.lineTo(x, y - 22); c.lineTo(x + 10, y); c.fill(); }
  // шкала кислотности
  const bx = 1220, by = 300, bw = 520, bh = 46, gr = c.createLinearGradient(bx, 0, bx + bw, 0); [["#ff3b3b", 0], ["#ffb02e", .3], ["#3ee08f", .5], ["#38d6ff", .75], ["#a98bff", 1]].forEach(([col, s2]) => gr.addColorStop(s2, col));
  c.save(); c.globalAlpha = A; rr(c, bx, by, bw, bh, 23); c.fillStyle = gr; c.fill(); c.restore();
  txt(c, "кислотность (pH)", bx + bw / 2, by - 30, { font: INTER(38, 400), color: C.soft });
  [["лимон", 2], ["кола", o.ph || 2.5], ["вода", 7]].forEach(([l, v], i) => { const x = bx + bw * v / 14, y = by + bh + 70 + (i === 1 ? 70 : 0), q = X.pr(.15 + i * .1, .35 + i * .1); c.save(); c.globalAlpha = A * q; c.strokeStyle = i === 1 ? C.white : C.soft; c.lineWidth = 3; c.beginPath(); c.moveTo(x, by + bh); c.lineTo(x, y - 46); c.stroke(); c.restore();
    txt(c, `${l} ${String(v).replace(".", ",")}`, x, y, { font: i === 1 ? MONT(48) : INTER(36, 400), color: i === 1 ? C.amber : C.soft, p: q }); });
  txt(c, o.text || "", 1480, 800, { font: MONT(58), color: er > .4 ? C.red : C.white, p: X.pr(.4, .7) });
};
V.sugarmask = (c, g, d, o, X) => { // весы: кислота против сахара
  const tilt = .12 * Math.sin(Math.min(1, X.pr(0, .5)) * Math.PI) * 0, cx = 960, cy = 560; panelTitle(c, "КИСЛОТА + САХАР", 200, C.amber);
  c.save(); c.globalAlpha = A; c.strokeStyle = C.white; c.lineWidth = 6; c.beginPath(); c.moveTo(cx, cy + 300); c.lineTo(cx, cy - 80); c.stroke(); c.save(); c.translate(cx, cy - 80); c.rotate(tilt); c.beginPath(); c.moveTo(-360, 0); c.lineTo(360, 0); c.stroke(); c.restore(); c.restore();
  [[-360, "кислота", C.colaHi], [360, "сахар", "#ffffff"]].forEach(([dx, l, col], i) => { const x = cx + dx, y = cy + 40, q = X.pr(.1 + i * .2, .35 + i * .2);
    c.save(); c.globalAlpha = A; c.strokeStyle = C.white; c.lineWidth = 3; c.beginPath(); c.moveTo(x, cy - 80); c.lineTo(x - 120, y); c.moveTo(x, cy - 80); c.lineTo(x + 120, y); c.stroke(); c.beginPath(); c.ellipse(x, y, 140, 26, 0, 0, Math.PI); c.stroke(); c.restore();
    for (let k = 0; k < 6; k++) { const xx = x - 70 + (k % 3) * 70, yy = y - 10 - Math.floor(k / 3) * 46; if (i) cube(c, xx, yy, 1, q); else { c.fillStyle = rgba(col, q * A); c.beginPath(); c.arc(xx, yy, 18, 0, TAU); c.fill(); } }
    txt(c, l, x, y + 110, { font: MONT(52), color: i ? C.white : C.amber, p: q }); });
  txt(c, "сахар прячет кислоту", 960, 960, { font: INTER(48, 400), color: C.soft, p: X.pr(.6, .9) });
};
V.vs = (c, g, d, o, X) => {
  [[o.left, 520, "left"], [o.right, 1400, "right"]].forEach(([L, x, side], i) => { if (!L) return; const q = ease.out(X.pr(.05 + i * .25, .3 + i * .25)), warn = o.warn === side, col = warn ? C.red : C.cyan;
    c.save(); c.globalAlpha = A * q; rr(c, x - 330, 260, 660, 560, 34); c.fillStyle = rgba(col, .08); c.fill(); c.strokeStyle = col; c.lineWidth = warn ? 6 : 3; c.stroke(); c.restore(); if (warn) glowCircle(g, x, 540, 380, C.red, .25 * q);
    txt(c, L[0], x, 360, { font: INTER(44, 400), color: C.soft, p: q, fit: 600 }); txt(c, L[1], x, 560, { font: MONT(120), color: warn ? C.red : C.white, p: q, fit: 600 }); txt(c, L[2], x, 680, { font: INTER(40, 400), color: C.soft, p: q, maxW: 560 }); });
  txt(c, "VS", 960, 580, { font: MONT(80), color: C.amber, p: X.pr(.2, .4) });
};
V.blood = (c, g, d, o, X) => {
  const y0 = 330, y1 = 610, L = o.level ?? .5, ins = !!o.insulin;
  // стенки сосуда
  [y0, y1].forEach((y, k) => { c.save(); c.globalAlpha = A; c.strokeStyle = "#ff8fa0"; c.lineWidth = 8; c.beginPath(); for (let x = 0; x <= 1920; x += 20) { const yy = y + Math.sin(x * .01 + d.t * 1.5 + k) * 6; x ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); c.restore(); });
  c.save(); c.globalAlpha = A * .5; c.fillStyle = "#3a0e1a"; c.fillRect(0, y0, 1920, y1 - y0); c.restore();
  // эритроциты
  for (let i = 0; i < 22; i++) { const r = rng("rbc", i), x = ((r() * 2000 + d.t * (120 + r() * 60)) % 2100) - 90, y = y0 + 40 + r() * (y1 - y0 - 80); c.save(); c.globalAlpha = A; c.fillStyle = "#d63a4a"; c.beginPath(); c.ellipse(x, y, 34, 22, r() * 3, 0, TAU); c.fill(); c.fillStyle = "#a82432"; c.beginPath(); c.ellipse(x, y, 16, 9, r() * 3, 0, TAU); c.fill(); c.restore(); }
  // глюкоза — сколько её, зависит от уровня; с инсулином частицы уходят вниз в клетки
  const n = Math.round(46 * L * ease.out(X.pr(0, .4)));
  for (let i = 0; i < n; i++) { const r = rng("glu", i), x = ((r() * 2000 + d.t * (150 + r() * 50)) % 2100) - 90; let y = y0 + 30 + r() * (y1 - y0 - 60);
    if (ins && r() < .7) { const u = clamp((X.pr(.25, .9) * 1.4 - r() * .4), 0, 1); y = lerp(y, y1 + 120, ease.inOut(u)); }
    glucose(c, x, y, 13); }
  // клетки ниже сосуда с «замками»
  for (let k = 0; k < 5; k++) { const x = 220 + k * 370, y = 800; c.save(); c.globalAlpha = A; rr(c, x - 140, y - 90, 280, 180, 60); c.fillStyle = rgba(C.violet, .14); c.fill(); c.strokeStyle = C.violet; c.lineWidth = 3; c.stroke(); c.restore();
    const open = ins ? X.pr(.15 + k * .05, .35 + k * .05) : 0; c.save(); c.globalAlpha = A; c.strokeStyle = open > .5 ? C.green : C.soft; c.lineWidth = 6; c.beginPath(); c.arc(x, y - 90, 26, Math.PI, Math.PI * (2 - open * .6)); c.stroke(); c.restore();
    if (ins) key(c, x - 70 + 70 * ease.out(open), y - 150 + 40 * open, 1.1, C.green, 1, Math.PI / 2 * open); }
  // шкала глюкозы
  const gx = 1540, gy = 210; c.save(); c.globalAlpha = A; rr(c, gx, gy, 300, 34, 17); c.fillStyle = C.dim; c.fill(); const lv = L * ease.out(X.pr(0, .5)) * (ins ? 1 - .45 * X.pr(.3, .9) : 1); rr(c, gx, gy, 300 * lv, 34, 17); c.fillStyle = lv > .6 ? C.red : C.amber; c.fill(); c.restore();
  txt(c, "глюкоза", gx + 150, gy - 16, { font: INTER(34, 400), color: C.soft });
  txt(c, o.text, 560, 200, { font: MONT(66), p: X.pr(.05, .3) });
};
V.pancreas = (c, g, d, o, X) => {
  const tired = !!o.tired, col = tired ? "#a08f6a" : "#ffd27a", cx = 900, cy = 560, s = 3; organ(c, g, "pancreas", cx, cy, s, col);
  const rate = tired ? 10 : 30; for (let i = 0; i < rate; i++) { const r = rng("ins", i), u = ((d.t * (tired ? .25 : .55) + r()) % 1), a = -Math.PI / 2 + (r() - .5) * 2.4, dist = 120 + u * 520;
    key(c, cx + Math.cos(a) * dist * 1.3, cy + Math.sin(a) * dist * .9, 1.2, tired ? C.soft : C.green, (1 - u) * (tired ? .6 : 1), a); }
  txt(c, "ПОДЖЕЛУДОЧНАЯ", 900, 900, { font: MONT(62), color: col }); txt(c, tired ? "работает на пределе" : "выброс инсулина", 900, 970, { font: INTER(42, 400), color: tired ? C.red : C.green, p: X.pr(.3, .6) });
  if (tired) { const q = X.pr(.4, .7); txt(c, "!", 1340, 470, { font: MONT(200), color: C.red, p: q }); glowCircle(g, 1340, 400, 160, C.red, .4 * q); }
};
V.split = (c, g, d, o, X) => {
  const q = ease.inOut(X.pr(.15, .55)); cube(c, 960, 520, 3.2 * (1 - q * .9), 1 - q);
  const gx = lerp(960, 600, q), fx = lerp(960, 1320, q);
  if (q > .1) { glucose(c, gx, 520, 110 * q, q); fructose(c, fx, 520, 110 * q, q); glowCircle(g, gx, 520, 260, C.cyan, .3 * q); glowCircle(g, fx, 520, 260, C.amber, .3 * q); }
  txt(c, "ГЛЮКОЗА", 600, 760, { font: MONT(64), color: C.cyan, p: X.pr(.5, .7) }); txt(c, "ФРУКТОЗА", 1320, 760, { font: MONT(64), color: C.amber, p: X.pr(.55, .75) });
  txt(c, "50 %", 600, 840, { font: INTER(46, 400), color: C.soft, p: X.pr(.6, .8) }); txt(c, "50 %", 1320, 840, { font: INTER(46, 400), color: C.soft, p: X.pr(.65, .85) });
  txt(c, "сахар", 960, 230, { font: MONT(72), p: X.pr(0, .2) });
};
V.liver = (c, g, d, o, X) => {
  const cx = 820, cy = 560, s = 3.4, fat = (o.fat || 0) * (o.heal ? 1 - .7 * ease.inOut(X.pr(.1, .9)) : ease.out(X.pr(.1, .8))), col = o.heal ? C.green : "#e0624a";
  organ(c, g, "liver", cx, cy, s, col, { inner: (cc, bw, bh) => { cc.save(); cc.clip(path("liver"));
    const nf = Math.round(fat * 120); for (let i = 0; i < nf; i++) { const r = rng("lf", i), x = 20 + r() * (bw - 30), y = 20 + r() * (bh - 30), rad = 4 + r() * 7; cc.fillStyle = rgba("#ffd84a", .85 * A); cc.beginPath(); cc.arc(x, y, rad, 0, TAU); cc.fill(); cc.fillStyle = rgba("#ffffff", .6 * A); cc.beginPath(); cc.arc(x - rad * .3, y - rad * .3, rad * .3, 0, TAU); cc.fill(); }
    cc.restore(); } });
  if (o.arrows || o.gate) for (let i = 0; i < 9; i++) { const r = rng("fr", i), u = ((d.t * .35 + i / 9) % 1), x = lerp(120, 640, u), y = 560 + Math.sin(u * 6 + i) * 40;
    if (o.gate && i % 2) { const gx = Math.min(x, 440); glucose(c, gx, y - 40, 16, 1); } else fructose(c, x, y + (o.gate ? 40 : 0), 16, 1 - Math.max(0, u - .85) * 6); }
  if (o.gate) { c.save(); c.globalAlpha = A; c.strokeStyle = C.red; c.lineWidth = 10; c.beginPath(); c.moveTo(470, 470); c.lineTo(470, 545); c.stroke(); c.restore(); txt(c, "регулятор", 470, 440, { font: INTER(34, 400), color: C.soft }); }
  // шкала «жир в печени»
  const gx = 1420, gy = 380; txt(c, "ЖИР В ПЕЧЕНИ", gx + 170, gy - 30, { font: MONT(40), color: C.soft });
  c.save(); c.globalAlpha = A; rr(c, gx, gy, 340, 40, 20); c.fillStyle = C.dim; c.fill(); rr(c, gx, gy, 340 * clamp(fat * 2.2, .03, 1), 40, 20); c.fillStyle = o.heal ? C.green : "#ffd84a"; c.fill(); c.restore();
  txt(c, o.heal ? "уходит" : "фруктоза → жир", gx + 170, gy + 110, { font: INTER(44, 400), color: o.heal ? C.green : C.amber, p: X.pr(.2, .5) });
  if (o.gate) txt(c, "фруктоза проезжает без остановки", 960, 960, { font: INTER(46, 400), color: C.amber, p: X.pr(.4, .7) });
};
V.chart = (c, g, d, o, X) => {
  const x0 = 300, x1 = 1640, y0 = 820, y1 = 300, k = o.kind, p = ease.inOut(X.pr(.05, .85));
  const F = { caffeine: (u) => Math.min(1, u / .12) * Math.exp(-Math.max(0, u - .12) * 1.6), crash: (u) => .45 + .5 * Math.exp(-((u - .25) ** 2) / .012) - .22 * Math.exp(-((u - .55) ** 2) / .02), halflife: (u) => Math.pow(.5, u * 1.8),
    withdrawal: (u) => .9 * Math.exp(-((u - .15) ** 2) / .02) + .05, stable: (u) => .5 + .03 * Math.sin(u * 20) }[k] || ((u) => u);
  const lab = { caffeine: ["0", "30 мин", "1 ч", "2 ч", "3 ч"], crash: ["0", "20 мин", "1 ч", "1,5 ч", "2 ч"], halflife: ["17:00", "19:30", "22:00", "00:30", "03:00"], withdrawal: ["день 1", "день 2", "день 3", "день 5", "день 7"], stable: ["утро", "", "день", "", "вечер"] }[k] || [];
  c.save(); c.globalAlpha = A; c.strokeStyle = C.dim; c.lineWidth = 2; for (let i = 0; i <= 4; i++) { const y = lerp(y0, y1, i / 4); c.beginPath(); c.moveTo(x0, y); c.lineTo(x1, y); c.stroke(); } c.restore();
  lab.forEach((l, i) => txt(c, l, lerp(x0, x1, i / 4), y0 + 60, { font: INTER(34, 400), color: C.soft }));
  const col = { caffeine: C.amber, crash: C.red, halflife: C.amber, withdrawal: C.violet, stable: C.green }[k] || C.cyan;
  if (k === "stable") { c.save(); c.globalAlpha = A * .5; c.strokeStyle = C.red; c.lineWidth = 4; c.setLineDash([12, 12]); c.beginPath(); for (let i = 0; i <= 200; i++) { const u = i / 200, v = .5 + .35 * Math.sin(u * 14); const x = lerp(x0, x1, u), y = lerp(y0, y1, v); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); txt(c, "на сахаре", 1500, 300, { font: INTER(36, 400), color: C.red }); }
  [c, g].forEach((ctx, li) => { ctx.save(); ctx.globalAlpha = A * (li ? .8 : 1); ctx.strokeStyle = col; ctx.lineWidth = li ? 10 : 7; ctx.lineJoin = "round"; ctx.beginPath(); const m = Math.round(240 * p); for (let i = 0; i <= m; i++) { const u = i / 240, x = lerp(x0, x1, u), y = lerp(y0, y1, F(u)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke(); ctx.restore(); });
  const u = p, hx = lerp(x0, x1, u), hy = lerp(y0, y1, F(u)); c.save(); c.globalAlpha = A; c.fillStyle = C.white; c.beginPath(); c.arc(hx, hy, 12, 0, TAU); c.fill(); c.restore(); glowCircle(g, hx, hy, 70, col, .8);
  if (k === "halflife") { const q = X.pr(.6, .8), x = lerp(x0, x1, .5), y = lerp(y0, y1, F(.5)); c.save(); c.globalAlpha = A * q; c.setLineDash([10, 10]); c.strokeStyle = C.white; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y0); c.lineTo(x, y); c.lineTo(x0, y); c.stroke(); c.restore(); txt(c, "≈ половина", x + 30, y - 30, { font: MONT(52), align: "left", color: C.white, p: q }); }
  if (k === "crash") txt(c, "хочется ещё", lerp(x0, x1, .58), lerp(y0, y1, .2) + 120, { font: MONT(56), color: C.red, p: X.pr(.65, .85) });
  txt(c, o.text, 960, 190, { font: MONT(72), color: col, p: X.pr(0, .2) });
};
V.brain = (c, g, d, o, X) => {
  const cx = 820, cy = 520, s = 3.2, dim = o.tired ? .55 : 1; organ(c, g, "brain", cx, cy, s, C.pink, { a: dim, inner: (cc, bw, bh) => { cc.save(); cc.strokeStyle = rgba(C.pink, .5 * A * dim); cc.lineWidth = 2.5; for (let i = 0; i < 9; i++) { const r = rng("gy", i); cc.beginPath(); const x = 30 + r() * 200, y = 30 + r() * 100; cc.moveTo(x, y); cc.bezierCurveTo(x + 20, y - 20, x + 30, y + 20, x + 50, y - 5); cc.stroke(); } cc.restore(); } });
  if (o.burst) for (let i = 0; i < 40; i++) { const r = rng("dop", i), u = ((d.t * .5 + r()) % 1), a = r() * TAU, dist = 60 + u * 420, x = cx + Math.cos(a) * dist, y = cy + Math.sin(a) * dist * .7;
    c.save(); c.globalAlpha = A * (1 - u); c.fillStyle = C.amber; c.beginPath(); c.arc(x, y, 6, 0, TAU); c.fill(); c.restore(); glowCircle(g, x, y, 26, C.amber, .6 * (1 - u)); }
  if (o.burst) { txt(c, "ДОФАМИН", 1480, 470, { font: MONT(76), color: C.amber, p: X.pr(.2, .45) }); txt(c, "«это приятно — повтори»", 1480, 550, { font: INTER(42, 400), color: C.soft, p: X.pr(.35, .6) }); }
  if (o.crave && !o.fade) { const q = X.pr(.2, .45), pulse = 1 + .05 * Math.sin(d.t * 6); c.save(); c.globalAlpha = A * q; rr(c, 1240, 330, 520, 170, 80); c.fillStyle = rgba(C.red, .15); c.fill(); c.strokeStyle = C.red; c.lineWidth = 4; c.stroke(); c.restore();
    txt(c, "ХОЧУ КОЛУ", 1500, 440 + 0 * pulse, { font: MONT(66 * pulse), color: C.red, p: q }); }
  if (o.clock) txt(c, o.clock, 1500, 640, { font: MONT(90, 800), color: C.white, p: X.pr(.3, .5) });
  if (o.tired) txt(c, "z z z", 1080, 300, { font: MONT(70), color: C.soft, p: X.pr(.2, .5) });
  if (o.fade) { const gx = 1260, gy = 420; txt(c, "тяга", 1490, 380, { font: MONT(56), color: C.soft }); for (let i = 0; i < 7; i++) { const v = 1 - i / 7, q = X.pr(.1 + i * .08, .2 + i * .08); c.save(); c.globalAlpha = A * q; c.fillStyle = v > .5 ? C.red : C.amber; rr(c, gx + i * 70, gy + 300 - 280 * v, 50, 280 * v, 10); c.fill(); c.restore(); txt(c, String(i + 1), gx + 25 + i * 70, gy + 350, { font: INTER(30, 400), color: C.soft, p: q }); }
    txt(c, "день", 1490, 830, { font: INTER(36, 400), color: C.soft }); }
};
V.myth = (c, g, d, o, X) => {
  const q = ease.out(X.pr(0, .25)); c.save(); c.globalAlpha = A * q; rr(c, 360, 260, 1200, 520, 36); c.fillStyle = rgba(C.cyan, .06); c.fill(); c.strokeStyle = C.dim; c.lineWidth = 3; c.stroke(); c.restore();
  txt(c, "В ИНТЕРНЕТЕ ПИШУТ:", 960, 380, { font: INTER(40, 400), color: C.soft, p: q }); txt(c, o.claim, 960, 520, { font: MONT(72), color: C.white, p: X.pr(.1, .35), maxW: 1100 });
  const sp = ease.out(X.pr(.45, .6)), sc2 = lerp(2.2, 1, sp); if (sp > 0) { c.save(); c.globalAlpha = A * sp; c.translate(1240, 720); c.rotate(-.12); c.scale(sc2, sc2); c.strokeStyle = C.red; c.lineWidth = 8; c.font = MONT(70); const w = c.measureText(o.verdict).width + 70; rr(c, -w / 2, -60, w, 110, 18); c.stroke(); c.fillStyle = C.red; c.textAlign = "center"; c.fillText(o.verdict, 0, 22); c.restore(); glowCircle(g, 1240, 720, 260, C.red, .3 * sp); }
};
V.stomach = (c, g, d, o, X) => {
  const cx = 760, cy = 560, s = 3.2; organ(c, g, "stomach", cx, cy, s, C.amber, { inner: (cc, bw, bh) => { cc.save(); cc.clip(path("stomach")); const lv = bh * (1 - .55 * ease.out(X.pr(0, .5))); cc.fillStyle = rgba(C.colaHi, .75 * A); cc.fillRect(0, lv + Math.sin(d.t * 2) * 3, bw, bh);
    if (o.gas) for (let i = 0; i < 26; i++) { const r = rng("bub", i), u = ((d.t * .4 + r()) % 1), x = 40 + r() * 140, y = lerp(bh, lv - 40, u); cc.strokeStyle = rgba("#ffffff", .8 * A * (1 - u)); cc.lineWidth = 1.5; cc.beginPath(); cc.arc(x, y, 3 + r() * 5, 0, TAU); cc.stroke(); }
    cc.restore(); } });
  const gx = 1340, gy = 330, full = (o.full || 0) * ease.out(X.pr(.2, .6)); txt(c, "СЫТОСТЬ", gx + 180, gy - 30, { font: MONT(48), color: C.soft });
  c.save(); c.globalAlpha = A; rr(c, gx, gy, 360, 46, 23); c.fillStyle = C.dim; c.fill(); rr(c, gx, gy, 360 * Math.max(.04, full), 46, 23); c.fillStyle = C.green; c.fill(); c.restore();
  txt(c, o.gas ? "пузырьки растягивают желудок" : "калории есть — сытости нет", gx + 180, gy + 140, { font: INTER(42, 400), color: o.gas ? C.soft : C.red, p: X.pr(.35, .6), maxW: 560 });
};
V.scale = (c, g, d, o, X) => {
  const cx = 960, cy = 600, q = ease.out(X.pr(0, .6)); c.save(); c.globalAlpha = A; rr(c, cx - 300, cy - 260, 600, 520, 70); c.fillStyle = "#132744"; c.fill(); c.strokeStyle = C.cyan; c.lineWidth = 4; c.stroke();
  rr(c, cx - 170, cy - 200, 340, 130, 24); c.fillStyle = "#06101e"; c.fill(); c.restore();
  txt(c, `+${(o.kg * q).toFixed(1).replace(".", ",")} кг`, cx, cy - 105, { font: MONT(84), color: C.amber }); glowCircle(g, cx, cy - 135, 200, C.amber, .25);
  [-1, 1].forEach((sd) => { c.save(); c.globalAlpha = A * .6; c.fillStyle = "#1e3a5f"; rr(c, cx + sd * 130 - 70, cy + 20, 140, 200, 50); c.fill(); c.restore(); });
  txt(c, o.text, 960, 960, { font: INTER(46, 400), color: C.soft, p: X.pr(.4, .7) });
};
V.tips = (c, g, d, o, X) => { panelTitle(c, "КАК ЗАЩИТИТЬ ЗУБЫ", 190, C.green);
  const ic = [(x, y) => { c.strokeStyle = C.cyan; c.lineWidth = 12; c.lineCap = "round"; c.beginPath(); c.moveTo(x - 20, y + 60); c.lineTo(x + 10, y - 60); c.lineTo(x + 40, y - 60); c.stroke(); },
    (x, y) => { c.fillStyle = C.cyan; c.beginPath(); c.moveTo(x, y - 60); c.bezierCurveTo(x + 50, y, x + 40, y + 50, x, y + 50); c.bezierCurveTo(x - 40, y + 50, x - 50, y, x, y - 60); c.fill(); },
    (x, y) => { c.strokeStyle = C.cyan; c.lineWidth = 6; c.beginPath(); c.arc(x, y, 50, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 34); c.moveTo(x, y); c.lineTo(x + 26, y + 10); c.stroke(); }];
  (o.items || []).forEach((it, i) => { const q = ease.out(X.pr(.1 + i * .22, .3 + i * .22)), x = 400 + i * 560, y = 520; c.save(); c.globalAlpha = A * q; rr(c, x - 240, y - 200, 480, 480, 40); c.fillStyle = rgba(C.cyan, .06); c.fill(); c.strokeStyle = C.dim; c.lineWidth = 3; c.stroke(); ic[i % 3](x, y - 60); c.restore();
    txt(c, it, x, y + 120, { font: INTER(42), p: q, maxW: 420 }); }); };
V.sleep = (c, g, d, o, X) => {
  c.save(); c.globalAlpha = A; c.fillStyle = "#ffd27a"; c.beginPath(); c.arc(400, 280, 80, 0, TAU); c.fill(); c.fillStyle = "#0d1d36"; c.beginPath(); c.arc(440, 250, 76, 0, TAU); c.fill(); c.restore(); glowCircle(g, 400, 280, 220, "#ffd27a", .3);
  txt(c, o.clock, 400, 520, { font: MONT(120, 800), color: C.white, p: X.pr(0, .2) }); txt(c, "кофеина в крови ≈ 50 %", 400, 600, { font: INTER(40, 400), color: C.amber, p: X.pr(.2, .4) });
  // гипнограмма: глубокий сон (норма) против поверхностного
  const x0 = 900, x1 = 1760; txt(c, "глубина сна", 1330, 260, { font: INTER(38, 400), color: C.soft });
  [[C.dim, 1, "обычно"], [C.amber, .55, "с кофеином"]].forEach(([col, depth, l], k) => { const p = X.pr(.15 + k * .3, .5 + k * .3); c.save(); c.globalAlpha = A; c.strokeStyle = col; c.lineWidth = k ? 6 : 4; c.beginPath();
    const m = Math.round(160 * p); for (let i = 0; i <= m; i++) { const u = i / 160, v = Math.abs(Math.sin(u * Math.PI * 3)) * depth; const x = lerp(x0, x1, u), y = 340 + v * 360; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore();
    txt(c, l, x1 - 100, k ? 560 : 760, { font: INTER(36, 400), color: col === C.dim ? C.soft : col, p }); });
};
V.study = (c, g, d, o, X) => {
  const q = ease.out(X.pr(0, .2)); c.save(); c.globalAlpha = A * q; rr(c, 240, 200, 1440, 680, 40); c.fillStyle = rgba(C.cyan, .05); c.fill(); c.strokeStyle = C.dim; c.lineWidth = 3; c.stroke(); c.restore();
  txt(c, "ИССЛЕДОВАНИЕ · ДАНИЯ, 2012", 960, 290, { font: INTER(40), color: C.soft, p: q });
  [[o.dose, 520], [o.time, 520 + 420]].forEach(([s, x], i) => { const p = X.pr(.1 + i * .12, .3 + i * .12); c.save(); c.globalAlpha = A * p; rr(c, x - 190, 360, 380, 100, 50); c.fillStyle = rgba(C.amber, .15); c.fill(); c.strokeStyle = C.amber; c.lineWidth = 3; c.stroke(); c.restore(); txt(c, s, x, 425, { font: MONT(44), color: C.amber, p }); });
  organ(c, g, "liver", 1400, 430, 1.1, "#e0624a", { a: q });
  txt(c, o.pct, 960, 700, { font: MONT(190), color: C.red, p: X.pr(.35, .6) }); glowCircle(g, 960, 640, 300, C.red, .3 * X.pr(.35, .6));
  txt(c, o.text, 960, 800, { font: INTER(48, 400), color: C.white, p: X.pr(.45, .7) });
};
V.stat = (c, g, d, o, X) => { const p = X.pr(0, .3); glowCircle(g, 960, 470, 520, C.amber, .18 * X.in);
  txt(c, o.big, 960, 580, { font: MONT(220), color: C.white, p }); txt(g, o.big, 960, 580, { font: MONT(220), color: C.amber, a: .35, p });
  txt(c, o.sub, 960, 720, { font: INTER(48, 400), color: C.soft, p: X.pr(.3, .6), maxW: 1300 }); };
V.tongue = (c, g, d, o, X) => {
  organ(c, g, "tongue", 640, 560, 2.4, C.pink, { inner: (cc) => { for (let i = 0; i < 40; i++) { const r = rng("tb", i); cc.fillStyle = rgba("#ffffff", .35 * A); cc.beginPath(); cc.arc(30 + r() * 140, 30 + r() * 190, 4, 0, TAU); cc.fill(); } } });
  const v = ease.inOut(X.pr(.2, .8)), cx = 1340, cy = 600; txt(c, "чувствительность к сладкому", cx, 300, { font: INTER(40, 400), color: C.soft, maxW: 600 });
  c.save(); c.globalAlpha = A; c.lineWidth = 26; c.lineCap = "round"; c.strokeStyle = C.dim; c.beginPath(); c.arc(cx, cy, 200, Math.PI, 2 * Math.PI); c.stroke(); c.strokeStyle = C.green; c.beginPath(); c.arc(cx, cy, 200, Math.PI, Math.PI * (1 + .25 + .65 * v)); c.stroke(); c.restore();
  txt(c, "до", cx - 220, cy + 70, { font: INTER(36, 400), color: C.soft }); txt(c, "через пару месяцев", cx + 120, cy + 70, { font: INTER(36, 400), color: C.green, p: X.pr(.6, .9) });
  txt(c, "обычное кажется слаще", 960, 960, { font: MONT(56), color: C.white, p: X.pr(.5, .8) });
};
V.summary = (c, g, d, o, X) => { panelTitle(c, "ЗА 30 ДНЕЙ", 170, C.amber);
  const icons = ["tooth", null, "liver", null, "stomach"], cols = [C.white, C.red, "#e0624a", C.amber, C.amber];
  (o.items || []).forEach((it, i) => { const q = ease.out(X.pr(.05 + i * .14, .2 + i * .14)), y = 300 + i * 140; c.save(); c.globalAlpha = A * q; rr(c, 380, y - 50, 1160, 110, 26); c.fillStyle = rgba(cols[i], .08); c.fill(); c.strokeStyle = rgba(cols[i], .6); c.lineWidth = 3; c.stroke(); c.restore();
    if (icons[i]) organ(c, g, icons[i], 470, y + 5, .38, cols[i], { a: q }); else if (i === 1) glucose(c, 470, y + 5, 30, q); else { c.save(); c.globalAlpha = A * q; c.fillStyle = "#ffd27a"; c.beginPath(); c.arc(470, y + 5, 30, 0, TAU); c.fill(); c.fillStyle = "#132744"; c.beginPath(); c.arc(484, y - 4, 28, 0, TAU); c.fill(); c.restore(); }
    txt(c, it, 560, y + 20, { font: INTER(48), align: "left", p: q }); }); };
V.quote = (c, g, d, o, X) => { const q = ease.out(X.pr(0, .25)); c.save(); c.globalAlpha = A * q; rr(c, 360, 300, 1200, 420, 60); c.fillStyle = rgba(C.white, .06); c.fill(); c.strokeStyle = C.soft; c.lineWidth = 3; c.stroke(); c.beginPath(); c.moveTo(560, 720); c.lineTo(520, 820); c.lineTo(660, 720); c.fill(); c.restore();
  txt(c, o.text, 960, 480, { font: MONT(72), color: C.white, p: X.pr(.05, .45) }); txt(c, "сахар в стакане — тоже сахар", 960, 930, { font: INTER(46, 400), color: C.amber, p: X.pr(.55, .8) }); };
V.ask = (c, g, d, o, X) => { const p = X.pr(0, .4); glowCircle(g, 960, 480, 520, C.cyan, .16);
  txt(c, o.q, 960, 500, { font: MONT(92), color: C.white, p, maxW: 1500 }); txt(c, "напиши в комментариях", 960, 760, { font: INTER(52, 400), color: C.amber, p: X.pr(.4, .7) });
  const q = X.pr(.5, .8); c.save(); c.globalAlpha = A * q; c.fillStyle = C.amber; rr(c, 920, 800, 80, 60, 14); c.fill(); c.beginPath(); c.moveTo(940, 860); c.lineTo(930, 885); c.lineTo(965, 860); c.fill(); c.restore(); };
V.next = (c, g, d, o, X) => { txt(c, "В СЛЕДУЮЩЕМ ВЫПУСКЕ", 960, 300, { font: INTER(44), color: C.soft, p: X.pr(0, .2) });
  txt(c, o.text, 960, 480, { font: MONT(80), color: C.white, p: X.pr(.1, .45), maxW: 1500 });
  const q = ease.out(X.pr(.45, .65)), pr = .5 + .5 * Math.sin(d.t * 4); c.save(); c.globalAlpha = A * q; rr(c, 760, 700, 400, 110, 55); c.fillStyle = C.red; c.fill(); c.restore(); glowCircle(g, 960, 755, 260, C.red, .25 * q * (.6 + .4 * pr));
  txt(c, "ПОДПИСАТЬСЯ", 960, 772, { font: MONT(46), color: "#ffffff", p: q }); };

/* ---------------------------------------------------------------- рамка: бренд и счётчик дней */
function hud(d, i, a) {
  if (window.NOHUD) return;   // кадр для обложки — без рамки
  const day = LEC.beats[i]?.day ?? null;   // счётчик горит, пока идёт раздел этого дня
  d.screen(d.ink, (c) => { const sv = A; A = .7; txt(c, BRAND, 60, 72, { font: MONT(28, 800), align: "left", color: C.soft }); A = sv;
    if (day != null && LEC.beats[i].v !== "day") { A = a; c.save(); c.globalAlpha = A; rr(c, 1600, 40, 260, 70, 35); c.fillStyle = "rgba(255,176,46,0.14)"; c.fill(); c.strokeStyle = C.amber; c.lineWidth = 3; c.stroke(); c.restore();
      txt(c, `ДЕНЬ ${day} / 30`, 1730, 88, { font: MONT(32, 800), color: C.amber }); A = 1; } });
}
function drawBeat(d, i, a) {
  if (i < 0 || i >= N) return;
  const b = LEC.beats[i], s = PH[i].s, du = Math.min(PH[i].d, 5), X = { s, at: (f) => s + f * du, pr: (f0, f1) => prog(d.t, s + f0 * du, s + f1 * du), in: prog(d.t, s - .3, s + .7) };   // всё появляется за первые ≤5 с фразы
  A = a; d.screen(d.ink, (c) => d.screen(d.glow, (g) => { const z = 1 + .03 * ease.inOut(prog(d.t, s - .3, s + du)); c.save(); g.save(); [c, g].forEach((x) => { x.translate(960, 540); x.scale(z, z); x.translate(-960, -540); });
    try { (V[b.v] || (() => {}))(c, g, d, b.o || {}, X); } finally { c.restore(); g.restore(); } }));
  A = 1;
}
Sketch.mount({
  palette: "lab", onTwos: false,
  fonts: ["900 80px Montserrat", "800 80px Montserrat", "800 80px Inter", "400 80px Inter"],
  camera: () => ({ x: 960, y: 540, zoom: 1, rot: 0, shake: 0 }),
  draw(d) {
    backdrop(d);
    let i = 0; while (i + 1 < N && d.t >= bStart(i + 1)) i++;
    const fade = prog(d.t, bStart(i), bStart(i) + .45);
    if (i > 0 && fade < 1) drawBeat(d, i - 1, 1 - fade);
    drawBeat(d, i, i > 0 ? fade : 1);
    hud(d, i, 1);
  },
  post(M) { const g = M.createRadialGradient(960, 540, 500, 960, 540, 1150); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.45)"); M.fillStyle = g; M.fillRect(0, 0, 1920, 1080); },
});
