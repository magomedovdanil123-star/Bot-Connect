/* ============================================================================
 * «Сколько нужно?» — абсурдные проекты и честные цифры. Визуал кодом (движок code-cartoon, MIT, общий с «Подвалом Разума»):
 * яркое небо, дом, шарики, огромные счётчики, чек «ИТОГО». Каждая фраза диктора = своя картинка (window.LECTURE.beats), время — window.TM.
 * Герой — Толик, самоуверенный строитель: берётся за безумный проект, а цифры его раз за разом обламывают.
 * ==========================================================================*/
const { ease, prog, lerp, clamp, rng } = Sketch;
const LEC = window.LECTURE, TM = window.TM, PH = TM.PH, TAU = Math.PI * 2;
const N = Math.min(LEC.beats.length, PH.length);
const bStart = (i) => (i >= N ? TM.END + 5 : PH[i].s - .3);
const BRAND = LEC.brand || "СКОЛЬКО НУЖНО?";
Sketch.config.grain = 0; Sketch.config.paperJitter = 0;
window.SKETCH_PALETTES.sky = { label: "Sky", paper: "#5aa9f0", tooth: "#5aa9f0", line: "#ffffff", soft: "#e8f4ff", guide: "#9fd0ff", a1: "#ffd400", a2: "#ff4d6a", a3: "#3ee08f", warm: "#ffd400", glow: .5, shade: "light", kind: "plain" };

const C = { yellow: "#ffd400", red: "#ff4d6a", green: "#3ee08f", blue: "#38a6ff", navy: "#14233d", white: "#ffffff", soft: "#e8f4ff", ink: "#14233d", orange: "#ff8a00", violet: "#a98bff", pink: "#ff8fb1", grass: "#59c25a", grassD: "#3f9a45" };
const BAL = ["#ff4d6a", "#ffb02e", "#3ee08f", "#38a6ff", "#a98bff", "#ff8fb1", "#ffd400", "#ff6b3d"];
let A = 1, FLASH = 0, NOW = 0, SKY = 0;

/* ---------------------------------------------------------------- утилиты */
const rgba = (hex, a) => Sketch.rgba(hex, a);
const MONT = (px, w = 900) => `${w} ${px}px Montserrat`, INTER = (px, w = 800) => `${w} ${px}px Inter`;
const fmt = (n) => Math.round(n).toLocaleString("ru-RU").replace(/ /g, " ");
function wrap(c, s, maxW) {
  const out = [];
  for (const para of String(s).split("\n")) { let line = ""; for (const w of para.split(" ")) { const t = line ? line + " " + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; } out.push(line); }
  return out;
}
// текст с тёмной обводкой — читается на любом небе
function txt(c, s, x, y, o = {}) {
  s = String(s ?? ""); if (!s) return;
  const p = o.p ?? 1; if (p <= 0) return;
  c.save(); c.globalAlpha = A * (o.a ?? 1) * clamp(p * 3, 0, 1); c.font = o.font || INTER(48);
  c.textAlign = o.align || "center"; c.textBaseline = "alphabetic"; c.lineJoin = "round";
  if (o.pop) { const u = clamp(p * 1.4, 0, 1), k = 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2; c.translate(x, y); c.scale(k, k); c.translate(-x, -y); }
  if (o.rot) { c.translate(x, y); c.rotate(o.rot); c.translate(-x, -y); }
  if (o.fit) { let px = parseInt(c.font.match(/(\d+)px/)[1]); const wide = () => Math.max(...s.split("\n").map((l) => c.measureText(l).width)); while (wide() > o.fit && px > 20) c.font = c.font.replace(/\d+px/, (px -= 4) + "px"); }
  const lines = o.maxW ? wrap(c, s, o.maxW) : s.split("\n"), px = parseInt(c.font.match(/(\d+)px/)[1]), lh = o.lh || px * 1.15;
  lines.forEach((l, i) => {
    if (o.stroke !== false) { c.lineWidth = o.sw || Math.max(6, px * .16); c.strokeStyle = o.strokeCol || "rgba(10,20,40,0.92)"; c.strokeText(l, x, y + i * lh); }
    c.fillStyle = o.color || C.white; c.fillText(l, x, y + i * lh);
  });
  c.restore();
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.roundRect(x, y, w, h, r); }
function card(c, x, y, w, h, o = {}) { c.save(); c.globalAlpha = A * (o.a ?? 1); c.shadowColor = "rgba(10,20,40,0.35)"; c.shadowBlur = 30; c.shadowOffsetY = 12; rr(c, x, y, w, h, o.r ?? 34); c.fillStyle = o.fill || "#ffffff"; c.fill(); c.shadowColor = "transparent"; if (o.stroke) { c.lineWidth = o.lw || 6; c.strokeStyle = o.stroke; c.stroke(); } c.restore(); }
function softGlow(g, x, y, r, color, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(color, a * A)); gr.addColorStop(1, rgba(color, 0)); g.save(); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
function arrow(c, x0, y0, x1, y1, col, lw = 10, a = 1) {
  const ang = Math.atan2(y1 - y0, x1 - x0), hl = lw * 2.6; c.save(); c.globalAlpha = A * a; c.strokeStyle = col; c.fillStyle = col; c.lineWidth = lw; c.lineCap = "round";
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1 - Math.cos(ang) * hl * .6, y1 - Math.sin(ang) * hl * .6); c.stroke();
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - Math.cos(ang - .45) * hl, y1 - Math.sin(ang - .45) * hl); c.lineTo(x1 - Math.cos(ang + .45) * hl, y1 - Math.sin(ang + .45) * hl); c.closePath(); c.fill(); c.restore();
}

/* ---------------------------------------------------------------- герои и предметы */
// шарик: (x, y) — центр, r — радиус; нитка вниз на len
function balloon(c, x, y, r, col, a = 1, o = {}) {
  if (a <= 0) return; c.save(); c.globalAlpha = A * a;
  if (o.string !== false) { c.strokeStyle = "rgba(255,255,255,0.75)"; c.lineWidth = Math.max(1, r * .06); c.beginPath(); c.moveTo(x, y + r); c.quadraticCurveTo(x + r * .3, y + r + (o.len || r * 2.2) * .5, o.tx ?? x, o.ty ?? (y + r + (o.len || r * 2.2))); c.stroke(); }
  const gr = c.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r * 1.1); gr.addColorStop(0, "#ffffff"); gr.addColorStop(.18, col); gr.addColorStop(1, Sketch.rgba(col, 1));
  c.fillStyle = gr; c.beginPath(); c.ellipse(x, y, r * .86, r, 0, 0, TAU); c.fill();
  c.fillStyle = col; c.beginPath(); c.moveTo(x, y + r * .95); c.lineTo(x - r * .14, y + r * 1.13); c.lineTo(x + r * .14, y + r * 1.13); c.closePath(); c.fill();
  c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.ellipse(x - r * .32, y - r * .42, r * .14, r * .24, -.5, 0, TAU); c.fill();
  c.restore();
}
// облако шариков над точкой (ax, ay): n — сколько рисовать (до ~420), R — радиус облака
function cluster(c, ax, ay, R, n, a = 1, seed = "cl", t = 0, o = {}) {
  n = Math.min(n, 420); const r0 = o.r || Math.max(7, R / Math.sqrt(n) * 1.15), pts = [];
  for (let i = 0; i < n; i++) { const r = rng(seed, i), ang = r() * TAU, rad = Math.sqrt(r()) * R, x = ax + Math.cos(ang) * rad + Math.sin(t * .8 + i) * r0 * .12, y = ay - R * .9 + Math.sin(ang) * rad * .9 + Math.cos(t * .7 + i) * r0 * .1; pts.push([x, y, BAL[i % BAL.length], r]); }
  if (o.strings !== false) { c.save(); c.globalAlpha = A * a * .55; c.strokeStyle = "#ffffff"; c.lineWidth = 1.5; for (let i = 0; i < Math.min(n, 60); i++) { const [x, y] = pts[i]; c.beginPath(); c.moveTo(x, y); c.lineTo(ax + (rng(seed, i, 9)() - .5) * (o.base || 60), ay); c.stroke(); } c.restore(); }
  pts.sort((p, q) => p[1] - q[1]).forEach(([x, y, col]) => balloon(c, x, y, r0, col, a, { string: false }));
}
// дом в духе «Вверх»: (x, y) — середина низа, s — масштаб (s=1 → ширина ~360)
function house(c, x, y, s = 1, a = 1, o = {}) {
  c.save(); c.globalAlpha = A * a; c.translate(x, y); c.rotate(o.tilt || 0); c.scale(s, s);
  c.fillStyle = "#8a5a3c"; c.fillRect(-190, -16, 380, 16);                                          // фундамент/крыльцо
  c.fillStyle = "#f2c9a0"; c.fillRect(-170, -230, 340, 214);                                        // стены
  c.strokeStyle = "rgba(120,70,40,0.25)"; c.lineWidth = 3; for (let k = -200; k < -20; k += 26) { c.beginPath(); c.moveTo(-170, k); c.lineTo(170, k); c.stroke(); }
  c.fillStyle = "#4b7bd1"; c.beginPath(); c.moveTo(-205, -226); c.lineTo(0, -380); c.lineTo(205, -226); c.closePath(); c.fill();   // крыша
  c.fillStyle = "#3a62ad"; c.beginPath(); c.moveTo(-205, -226); c.lineTo(0, -380); c.lineTo(-10, -370); c.lineTo(-180, -240); c.closePath(); c.fill();
  c.fillStyle = "#b65a3a"; c.fillRect(70, -370, 44, 90);                                            // труба
  c.fillStyle = "#ffe08a"; c.beginPath(); c.arc(0, -282, 30, 0, TAU); c.fill(); c.strokeStyle = "#ffffff"; c.lineWidth = 6; c.stroke();   // круглое окно
  [[-118, -170], [62, -170]].forEach(([wx, wy]) => { c.fillStyle = "#9fd8ff"; c.fillRect(wx, wy, 56, 66); c.strokeStyle = "#ffffff"; c.lineWidth = 7; c.strokeRect(wx, wy, 56, 66); c.beginPath(); c.moveTo(wx + 28, wy); c.lineTo(wx + 28, wy + 66); c.stroke(); });
  c.fillStyle = "#6b3e2a"; c.fillRect(-26, -120, 52, 104); c.fillStyle = "#ffd400"; c.beginPath(); c.arc(14, -66, 5, 0, TAU); c.fill();   // дверь
  c.fillStyle = "#ff8fb1"; for (let k = 0; k < 7; k++) { c.beginPath(); c.arc(-160 + k * 50, -20, 12, 0, TAU); c.fill(); }        // клумба
  c.restore();
}
// Толик: (x, y) — ноги на земле, s — масштаб (s=1 → рост ~300); o.arm — поднятая рука, o.bal — цвет шарика в руке, o.face: happy | shock | sad
function tolik(c, x, y, s = 1, a = 1, o = {}, t = 0) {
  c.save(); c.globalAlpha = A * a; c.translate(x, y + Math.sin(t * 3) * 3 * (o.bounce ? 1 : 0)); c.scale(s, s);
  c.strokeStyle = C.ink; c.lineCap = "round"; c.lineJoin = "round";
  c.lineWidth = 16; c.beginPath(); c.moveTo(-26, -100); c.lineTo(-32, 0); c.moveTo(26, -100); c.lineTo(34, 0); c.stroke();          // ноги
  c.fillStyle = "#2d2d2d"; rr(c, -58, -10, 50, 20, 10); c.fill(); rr(c, 10, -10, 50, 20, 10); c.fill();
  c.fillStyle = "#2f6fd6"; rr(c, -62, -220, 124, 130, 30); c.fill();                                 // комбинезон
  c.fillStyle = "#ff8a00"; c.fillRect(-62, -200, 124, 14);
  const armUp = o.arm ?? 0; c.lineWidth = 16; c.strokeStyle = "#2f6fd6";
  c.beginPath(); c.moveTo(-58, -200); c.lineTo(-96, -140); c.stroke();
  c.beginPath(); c.moveTo(58, -200); c.lineTo(lerp(96, 92, armUp), lerp(-140, -300, armUp)); c.stroke();
  c.fillStyle = "#ffd2b0"; c.beginPath(); c.arc(-98, -136, 13, 0, TAU); c.fill(); c.beginPath(); c.arc(lerp(98, 92, armUp), lerp(-136, -308, armUp), 13, 0, TAU); c.fill();
  c.fillStyle = "#ffd2b0"; c.beginPath(); c.arc(0, -268, 52, 0, TAU); c.fill();                        // голова
  c.fillStyle = "#ffb000"; c.beginPath(); c.ellipse(0, -300, 66, 20, 0, 0, TAU); c.fill(); c.beginPath(); c.arc(0, -302, 50, Math.PI, 0); c.fill();   // каска
  c.fillStyle = C.ink; const f = o.face || "happy";
  if (f === "shock") { c.beginPath(); c.arc(-18, -270, 9, 0, TAU); c.arc(18, -270, 9, 0, TAU); c.fill(); c.beginPath(); c.ellipse(0, -238, 10, 14, 0, 0, TAU); c.fill(); }
  else { c.beginPath(); c.arc(-18, -272, 6, 0, TAU); c.arc(18, -272, 6, 0, TAU); c.fill(); c.lineWidth = 5; c.strokeStyle = C.ink; c.beginPath(); if (f === "sad") c.arc(0, -226, 18, Math.PI * 1.15, Math.PI * 1.85); else c.arc(0, -252, 20, .15 * Math.PI, .85 * Math.PI); c.stroke(); }
  c.restore();
  if (o.bal) balloon(c, x + lerp(98, 92, armUp) * s, y + (lerp(-308, -308, armUp) - 190) * s + Math.sin(t * 1.6) * 6, 46 * s, o.bal, a, { tx: x + 92 * s, ty: y - 300 * s, len: 140 * s });
}
function ground(c, y = 900, a = 1) {
  c.save(); c.globalAlpha = A * a; c.fillStyle = C.grass; c.beginPath(); c.moveTo(0, y); c.quadraticCurveTo(480, y - 40, 960, y - 10); c.quadraticCurveTo(1440, y + 20, 1920, y - 20); c.lineTo(1920, 1080); c.lineTo(0, 1080); c.closePath(); c.fill();
  c.fillStyle = C.grassD; c.fillRect(0, y + 70, 1920, 200); c.restore();
}
function people(c, x, y, s, col, a = 1) { c.save(); c.globalAlpha = A * a; c.fillStyle = col; c.beginPath(); c.arc(x, y - 30 * s, 10 * s, 0, TAU); c.fill(); rr(c, x - 11 * s, y - 18 * s, 22 * s, 30 * s, 8 * s); c.fill(); c.restore(); }
function cylinder(c, x, y, s, a = 1) { c.save(); c.globalAlpha = A * a; c.translate(x, y); c.scale(s, s); c.fillStyle = "#9aa6b8"; rr(c, -16, -90, 32, 90, 14); c.fill(); c.fillStyle = "#5b6b82"; c.fillRect(-6, -104, 12, 16); c.fillStyle = "#ffd400"; c.fillRect(-16, -60, 32, 10); c.restore(); }

/* ---------------------------------------------------------------- фон: небо (o.sky: 0 — день, 1 — высоко, почти космос) */
function backdrop(d) {
  d.screen(d.ink, (c) => {
    const k = SKY;
    const gr = c.createLinearGradient(0, 0, 0, 1080);
    gr.addColorStop(0, k > .5 ? "#0b1a3a" : "#2d7fe0"); gr.addColorStop(.6, k > .5 ? "#24508f" : "#7cc4ff"); gr.addColorStop(1, k > .5 ? "#6aa8e8" : "#c9ecff");
    c.fillStyle = gr; c.fillRect(0, 0, 1920, 1080);
    if (k <= .5) { c.fillStyle = "rgba(255,240,170,0.9)"; c.beginPath(); c.arc(1660, 170, 70, 0, TAU); c.fill(); c.fillStyle = "rgba(255,240,170,0.18)"; c.beginPath(); c.arc(1660, 170, 130, 0, TAU); c.fill(); }
    else for (let i = 0; i < 70; i++) { const r = rng("st", i); c.fillStyle = `rgba(255,255,255,${.3 + r() * .6})`; c.fillRect(r() * 1920, r() * 600, 2.5, 2.5); }
    for (let i = 0; i < 6; i++) { const r = rng("cloud", i), x = ((r() * 2400 + d.t * (10 + r() * 14)) % 2500) - 300, y = 120 + r() * 380, s = .7 + r() * .8;
      c.fillStyle = `rgba(255,255,255,${k > .5 ? .18 : .85})`; [[0, 0, 60], [55, -20, 70], [120, 0, 58], [60, 18, 60]].forEach(([dx, dy, rad]) => { c.beginPath(); c.arc(x + dx * s, y + dy * s, rad * s, 0, TAU); c.fill(); }); }
  });
}

/* ---------------------------------------------------------------- сцены */
const V = {};
// крючок: дом взлетает на облаке шариков
V.hook = (c, g, d, o, X) => {
  ground(c, 940); const up = ease.inOut(X.pr(.1, 1)) * (o.rise ?? 200), hx = 1330, hy = 925 - up, s = .75, roof = hy - 380 * s;
  cluster(c, hx, roof + 10, 195, 340, ease.out(X.pr(0, .3)), "hook", d.t, { base: 100 });
  house(c, hx, hy, s, 1, { tilt: Math.sin(d.t * .9) * .02 });
  txt(c, o.text, 560, 480, { font: MONT(100), color: C.yellow, p: X.pr(.05, .3), fit: 860 });
  txt(c, o.sub, 560, 590, { font: INTER(50), p: X.pr(.3, .5), maxW: 820 });
};
// глава
V.title = (c, g, d, o, X) => {
  const p = ease.out(X.pr(0, .3)); card(c, 260, 330, 1400, 360, { a: p, fill: C.yellow, r: 50 });
  txt(c, o.text, 960, 545, { font: MONT(120), color: C.ink, stroke: false, p, pop: true, fit: 1300 });
  txt(c, o.sub, 960, 790, { font: INTER(52), p: X.pr(.25, .5) });
  if (o.n) txt(c, `ЭТАП ${o.n}`, 960, 300, { font: MONT(56), color: C.white, p });
};
// Толик говорит
V.tolik = (c, g, d, o, X) => {
  ground(c, 920); if (o.house) house(c, 1450, 905, .9, 1);
  tolik(c, o.house ? 640 : 820, 920, 1.5, ease.out(X.in), { arm: o.arm ?? 0, face: o.face, bal: o.bal ? C.red : null, bounce: true }, d.t);
  if (o.say) { const q = ease.out(X.pr(.05, .25)), bx = o.house ? 820 : 1060, by = 220; card(c, bx, by, 760, 230, { a: q, r: 40 });
    c.save(); c.globalAlpha = A * q; c.fillStyle = "#ffffff"; c.beginPath(); c.moveTo(bx + 120, by + 220); c.lineTo(bx + 60, by + 310); c.lineTo(bx + 200, by + 220); c.fill(); c.restore();
    txt(c, o.say, bx + 380, by + 105, { font: MONT(54), color: C.ink, stroke: false, p: q, maxW: 680, lh: 64 }); }
};
// дом и его вес
V.house = (c, g, d, o, X) => {
  ground(c, 920); house(c, 760, 905, 1.25, ease.out(X.in));
  const kg = (o.kg || 40000) * ease.out(X.pr(.1, .6)); card(c, 1230, 330, 560, 300, { a: ease.out(X.pr(.05, .2)), r: 40 });
  txt(c, `${fmt(kg)} кг`, 1510, 480, { font: MONT(92), color: C.red, stroke: false, fit: 500, p: X.pr(.1, .2) });
  txt(c, o.label || "вес дома", 1510, 560, { font: INTER(40), color: C.ink, stroke: false, p: X.pr(.1, .3) });
  txt(c, o.text, 1510, 720, { font: INTER(46), p: X.pr(.5, .75), maxW: 640 });
};
// один шарик: силы
V.balloon = (c, g, d, o, X) => {
  const bx = 640, by = 470 + Math.sin(d.t * 1.5) * 8; balloon(c, bx, by, 170, C.red, ease.out(X.in), { len: 260 });
  txt(c, o.text || "один шарик 30 см", 640, 150, { font: MONT(60), p: X.pr(0, .2) });
  const rows = o.rows || [["тянет вверх", "+14,6 г", C.green], ["резина", "−3 г", C.red], ["ленточка", "−0,6 г", C.red]];
  arrow(c, bx + 230, 520, bx + 230, 270, C.green, 14, X.pr(.1, .25));
  rows.forEach(([l, v, col], i) => { const q = ease.out(X.pr(.15 + i * .15, .3 + i * .15)), y = 330 + i * 120; card(c, 1060, y - 70, 720, 100, { a: q, r: 26 });
    txt(c, l, 1100, y, { font: INTER(42), color: C.ink, stroke: false, align: "left", p: q }); txt(c, v, 1740, y, { font: MONT(52), color: col, stroke: false, align: "right", p: q }); });
  const q = ease.out(X.pr(.65, .8)); card(c, 1060, 700, 720, 130, { a: q, fill: C.yellow, r: 30 });
  txt(c, "ИТОГО", 1100, 785, { font: MONT(48), color: C.ink, stroke: false, align: "left", p: q }); txt(c, o.net || "≈ 11 г", 1740, 790, { font: MONT(72), color: C.ink, stroke: false, align: "right", p: q, pop: true });
  if (o.sub) txt(c, o.sub, 1420, 920, { font: INTER(40), p: X.pr(.8, .95), maxW: 760 });
};
// огромный счётчик, вокруг падают шарики
V.counter = (c, g, d, o, X) => {
  const q = ease.inOut(X.pr(.05, .8)), v = lerp(o.from || 0, o.to, q);
  for (let i = 0; i < 70; i++) { const r = rng("rain", i), u = ((d.t * (.08 + r() * .06) + r()) % 1); balloon(c, r() * 1920, lerp(1150, -120, u), 16 + r() * 18, BAL[i % BAL.length], .55, { string: false }); }
  if (o.top) txt(c, o.top, 960, 330, { font: MONT(60), color: C.white, p: X.pr(0, .2) });
  txt(c, (o.prefix || "") + fmt(v) + (o.unit ? " " + o.unit : ""), 960, 560, { font: MONT(190), color: o.col || C.yellow, fit: 1760, p: X.pr(0, .1) });
  txt(c, o.sub, 960, 690, { font: INTER(52), p: X.pr(.6, .85), maxW: 1500 });
};
// сравнение двух «облаков»: мало против много
V.vs = (c, g, d, o, X) => {
  ground(c, 960);
  [[o.left, 520, .22], [o.right, 1400, 1]].forEach(([L, x, k], i) => { if (!L) return; const q = ease.out(X.pr(.05 + i * .3, .35 + i * .3));
    if (L.house) { house(c, x, 950, .55, q); cluster(c, x, 950 - 220, 60 + 260 * k, Math.round(40 + 340 * k), q, "vs" + i, d.t, { base: 50 }); }
    else { tolik(c, x, 960, .8, q, { arm: 1 }, d.t); cluster(c, x + 74, 960 - 250 - 120 * k, 50 + 230 * k, Math.round(30 + 340 * k), q, "vs" + i, d.t, { base: 10 }); }
    txt(c, L.n, x, 170, { font: MONT(84), color: i ? C.yellow : C.white, p: q, fit: 760 }); txt(c, L.cap, x, 240, { font: INTER(40), p: q, maxW: 760 }); });
  txt(c, o.text, 960, 1010, { font: MONT(56), color: C.white, p: X.pr(.75, .95) });
};
// деньги: пачки растут, сумма бежит
V.money = (c, g, d, o, X) => {
  const q = ease.inOut(X.pr(.05, .8)), n = Math.round(30 * q);
  for (let i = 0; i < n; i++) { const col = i % 6, row = Math.floor(i / 6), x = 520 + col * 150, y = 860 - row * 60; c.save(); c.globalAlpha = A; c.fillStyle = "#3d9b5a"; rr(c, x - 64, y - 40, 128, 54, 8); c.fill(); c.fillStyle = "#62c27d"; rr(c, x - 64, y - 48, 128, 54, 8); c.fill(); c.fillStyle = "#e7f7ea"; c.fillRect(x - 10, y - 48, 20, 54); c.restore(); }
  txt(c, `${fmt(lerp(0, o.to, q))} ₽`, 960, 330, { font: MONT(150), color: C.yellow, fit: 1700 });
  txt(c, o.sub, 960, 420, { font: INTER(48), p: X.pr(.5, .8), maxW: 1500 });
};
// таймер: один Толик надувает шарики, дни бегут
V.timer = (c, g, d, o, X) => {
  ground(c, 920); const cyc = (d.t * 1.2) % 1; tolik(c, 560, 920, 1.3, 1, { arm: 0, face: X.pr(.5, .7) > 0 ? "sad" : "happy" }, d.t);
  balloon(c, 700, 640 - cyc * 40, 20 + 70 * cyc, BAL[Math.floor(d.t * 1.2) % BAL.length], 1, { string: false });
  cylinder(c, 420, 920, 1.4); const q = ease.inOut(X.pr(.05, .75));
  card(c, 1080, 280, 640, 420, { r: 40 }); c.save(); c.globalAlpha = A; c.fillStyle = C.red; rr(c, 1080, 280, 640, 110, 40); c.fill(); c.fillRect(1080, 340, 640, 50); c.restore();
  txt(c, o.head || "без перерывов", 1400, 352, { font: MONT(44), color: C.white, stroke: false });
  txt(c, fmt(lerp(0, o.days, q)), 1400, 580, { font: MONT(170), color: C.ink, stroke: false, fit: 600 });
  txt(c, o.unit || "дней", 1400, 660, { font: INTER(48), color: C.ink, stroke: false });
  txt(c, o.sub, 1400, 800, { font: INTER(44), p: X.pr(.6, .85), maxW: 760 });
};
// толпа: o.n человек (каждая точка — человек, рисуем до 900)
V.crowd = (c, g, d, o, X) => {
  ground(c, 980); const n = Math.min(900, o.n || 850), q = ease.out(X.pr(.05, .7)), shown = Math.round(n * q), cols = 45;
  for (let i = 0; i < shown; i++) { const r = rng("pp", i), col = i % cols, row = Math.floor(i / cols), x = 300 + col * 30 + (row % 2) * 15, y = 960 - row * 30; people(c, x, y, .9, BAL[Math.floor(r() * BAL.length)]); }
  txt(c, fmt(o.n * q), 960, 200, { font: MONT(140), color: C.yellow }); txt(c, o.unit || "человек", 960, 270, { font: INTER(48) });
  txt(c, o.sub, 960, 360, { font: INTER(46), p: X.pr(.6, .85), maxW: 1500 });
};
// баллоны с гелием
V.tanks = (c, g, d, o, X) => {
  ground(c, 960); const q = ease.out(X.pr(.05, .7)), shown = Math.round(110 * q);
  for (let i = 0; i < shown; i++) { const col = i % 22, row = Math.floor(i / 22), x = 300 + col * 62 + (row % 2) * 31, y = 960 - row * 80; cylinder(c, x, y, .8); }
  txt(c, fmt(lerp(0, o.n, q)), 960, 220, { font: MONT(140), color: C.yellow }); txt(c, o.unit || "больших баллонов с гелием", 960, 290, { font: INTER(48) });
  txt(c, o.sub, 960, 380, { font: INTER(44), p: X.pr(.6, .85), maxW: 1500 });
};
// лента: путь между двумя городами
V.route = (c, g, d, o, X) => {
  const q = ease.inOut(X.pr(.1, .8)), a = [380, 620], b = [1560, 560];
  card(c, 180, 360, 1560, 480, { fill: "rgba(255,255,255,0.18)", r: 50 });
  c.save(); c.globalAlpha = A; c.strokeStyle = C.red; c.lineWidth = 12; c.lineCap = "round"; c.beginPath();
  for (let k = 0; k <= 80 * q; k++) { const u = k / 80, x = lerp(a[0], b[0], u), y = lerp(a[1], b[1], u) - Math.sin(u * Math.PI) * 140 + Math.sin(u * 30) * 10; k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore();
  [[a, o.from || "Москва"], [b, o.to || "Новосибирск"]].forEach(([[x, y], l], i) => { c.save(); c.globalAlpha = A; c.fillStyle = i ? C.yellow : C.white; c.beginPath(); c.arc(x, y, 20, 0, TAU); c.fill(); c.restore(); txt(c, l, x, y + 80, { font: MONT(52) }); });
  txt(c, `${fmt(lerp(0, o.km, q))} км`, 960, 240, { font: MONT(130), color: C.yellow }); txt(c, o.text, 960, 960, { font: INTER(48), p: X.pr(.6, .85), maxW: 1500 });
};
// облако шариков рядом с многоэтажкой
V.cloud = (c, g, d, o, X) => {
  ground(c, 960); const q = ease.out(X.pr(.05, .6)), R = 300 * q;
  c.save(); c.globalAlpha = A; c.fillStyle = "#c7d3e3"; c.fillRect(1350, 960 - 620, 260, 620); c.fillStyle = "#9fd8ff"; for (let f = 0; f < 17; f++) for (let w = 0; w < 4; w++) c.fillRect(1370 + w * 60, 960 - 600 + f * 35, 40, 22); c.restore();
  txt(c, o.floors || "17 этажей", 1480, 320, { font: MONT(46), p: X.pr(.4, .6) });
  if (R > 5) cluster(c, 760, 900, R, 420, 1, "big", d.t, { base: 160 }); house(c, 760, 960, .5, 1);
  c.save(); c.globalAlpha = A * X.pr(.5, .7); c.strokeStyle = C.white; c.lineWidth = 4; c.beginPath(); c.moveTo(380, 900 - 600); c.lineTo(380, 900); c.stroke(); c.restore();
  txt(c, o.size || "≈ 54 м", 330, 620, { font: MONT(64), color: C.yellow, p: X.pr(.5, .7), rot: -Math.PI / 2 });
  txt(c, o.text, 960, 140, { font: MONT(64), p: X.pr(.1, .3), maxW: 1600 });
};
// ветер сносит облако
V.wind = (c, g, d, o, X) => {
  ground(c, 980); const q = ease.inOut(X.pr(.1, .9)), x = 700 + 420 * q, tilt = .18 * q;
  for (let i = 0; i < 16; i++) { const r = rng("wind", i), u = (d.t * .9 + r()) % 1, y = 160 + r() * 700; c.save(); c.globalAlpha = A * .7 * Math.sin(u * Math.PI); c.strokeStyle = "#ffffff"; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(u * 2200 - 300, y); c.lineTo(u * 2200 - 80, y); c.stroke(); c.restore(); }
  cluster(c, x + 60, 640, 260, 360, 1, "wind", d.t, { base: 100 }); house(c, x, 900 - 120 * q, .7, 1, { tilt });
  arrow(c, 240, 260, 640, 260, C.red, 18, X.pr(.2, .4)); txt(c, o.force || "≈ 7 тонн", 440, 220, { font: MONT(70), color: C.yellow, p: X.pr(.25, .45) });
  txt(c, o.text, 960, 1010, { font: MONT(50), p: X.pr(.5, .8) });
};
// высотомер: дом поднимается, холодает, шарики раздуваются и лопаются
V.alt = (c, g, d, o, X) => {
  const q = ease.inOut(X.pr(.05, .9)), km = lerp(o.from || 0, o.to || 5, q), y = 880 - q * 160;
  c.save(); c.globalAlpha = A; c.strokeStyle = "#ffffff"; c.lineWidth = 6; c.beginPath(); c.moveTo(190, 160); c.lineTo(190, 940); c.stroke();
  const TO = o.to || 5; for (let k = 0; k <= TO; k++) { const yy = 940 - k / TO * 780; c.beginPath(); c.moveTo(190, yy); c.lineTo(230, yy); c.stroke(); } c.restore();
  for (let k = 0; k <= TO; k++) txt(c, `${k} км`, 170, 954 - k / TO * 780, { font: INTER(34), align: "right" });
  c.save(); c.globalAlpha = A; c.fillStyle = C.yellow; c.beginPath(); c.moveTo(232, 940 - km / (o.to || 5) * 780); c.lineTo(270, 925 - km / (o.to || 5) * 780); c.lineTo(270, 955 - km / (o.to || 5) * 780); c.fill(); c.restore();
  cluster(c, 960, y - 228, 160 * (1 + (o.swell ? q * .3 : 0)), 300, 1, "alt", d.t, { base: 70 }); house(c, 960, y, .6, 1);
  if (o.pop) for (let i = 0; i < 18; i++) { const r = rng("pop", i), t0 = .45 + r() * .5; if (q > t0 && q < t0 + .06) { const px = 960 + (r() - .5) * 360, py = y - 420 + (r() - .5) * 240; txt(c, "ПОП!", px, py, { font: MONT(40), color: C.yellow }); } }
  card(c, 1380, 300, 420, 300, { r: 36 }); txt(c, `${km.toFixed(1).replace(".", ",")} км`, 1590, 410, { font: MONT(80), color: C.ink, stroke: false });
  txt(c, `${Math.round(lerp(o.t0 ?? 15, o.t1 ?? -18, q))} °C`, 1590, 520, { font: MONT(64), color: C.blue, stroke: false });
  txt(c, o.text, 960, 1010, { font: MONT(50), p: X.pr(.4, .7), maxW: 1700 });
};
// шарики лопаются — дом падает
V.pop = (c, g, d, o, X) => {
  const q = X.pr(.2, 1), fall = ease.in(q) * 700, n = Math.round(360 * (1 - ease.out(X.pr(0, .6))));
  if (n > 0) cluster(c, 960, 520 + fall - 200, 240, n, 1, "popc", d.t, { base: 80 }); house(c, 960, 560 + fall, .7, 1, { tilt: Math.sin(d.t * 6) * .12 * q });
  for (let i = 0; i < 24; i++) { const r = rng("pp2", i), t0 = r() * .55, u = (X.pr(t0, t0 + .08)); if (u > 0 && u < 1) txt(c, "ПОП!", 960 + (r() - .5) * 900, 260 + r() * 500, { font: MONT(46 + r() * 30), color: BAL[i % BAL.length], rot: (r() - .5) * .6 }); }
  txt(c, o.text, 960, 150, { font: MONT(80), color: C.yellow, p: X.pr(0, .2) });
};
// историческая карточка: o.icon = chair | house | film
V.card = (c, g, d, o, X) => {
  const q = ease.out(X.pr(0, .25)); card(c, 160, 200, 1600, 680, { a: q, r: 50 });
  if (o.icon === "chair") { c.save(); c.globalAlpha = A * q; c.strokeStyle = "#7a5a3a"; c.lineWidth = 14; c.beginPath(); c.moveTo(420, 760); c.lineTo(470, 640); c.lineTo(640, 640); c.lineTo(690, 760); c.moveTo(470, 640); c.lineTo(450, 520); c.stroke(); c.restore(); cluster(c, 560, 560, 170, 45, q, "chair", d.t, { r: 34, base: 120 }); }
  else if (o.icon === "film") { c.save(); c.globalAlpha = A * q; c.fillStyle = C.ink; rr(c, 380, 480, 360, 260, 20); c.fill(); c.fillStyle = "#ffffff"; for (let k = 0; k < 5; k++) c.fillRect(400 + k * 70, 440, 40, 34); c.restore(); cluster(c, 560, 470, 130, 120, q, "film", d.t, { base: 40 }); }
  else { house(c, 560, 780, .55, q); cluster(c, 560, 780 - 210, 150, 60, q, "nh", d.t, { r: 30, base: 60 }); }
  txt(c, o.year, 1260, 380, { font: MONT(110), color: C.red, stroke: false, p: q });
  txt(c, o.name, 1260, 470, { font: MONT(54), color: C.ink, stroke: false, p: X.pr(.15, .35), maxW: 820 });
  txt(c, o.text, 1260, 590, { font: INTER(42, 800), color: "#3b4b66", stroke: false, p: X.pr(.3, .55), maxW: 820, lh: 54 });
};
// крупная цифра
V.stat = (c, g, d, o, X) => {
  const p = X.pr(0, .3); txt(c, o.big, 960, 560, { font: MONT(210), color: o.col || C.yellow, p, pop: true, fit: 1700 });
  txt(c, o.sub, 960, 700, { font: INTER(52), p: X.pr(.3, .6), maxW: 1500 });
  if (o.top) txt(c, o.top, 960, 320, { font: MONT(60), p });
};
// «А ТЫ ЗНАЛ?»
V.wow = (c, g, d, o, X) => {
  const q = ease.out(X.pr(0, .15)); c.save(); c.globalAlpha = A * q; c.translate(960, 230); c.rotate(-.04 + Math.sin(d.t * 3) * .02); rr(c, -320, -64, 640, 128, 64); c.fillStyle = C.red; c.fill(); c.fillStyle = "#ffffff"; c.font = MONT(64); c.textAlign = "center"; c.fillText(o.top || "А ТЫ ЗНАЛ?", 0, 22); c.restore();
  if (o.big) txt(c, o.big, 960, 560, { font: MONT(190), color: C.yellow, p: X.pr(.1, .3), pop: true, fit: 1600 });
  txt(c, o.text, 960, o.big ? 720 : 560, { font: o.big ? INTER(52) : MONT(76), p: X.pr(.2, .5), maxW: 1500 });
};
// «досмотри до конца»
V.tease = (c, g, d, o, X) => {
  const q = ease.out(X.pr(0, .2)); txt(c, o.top || "В КОНЦЕ ВИДЕО", 960, 250, { font: MONT(64), color: C.yellow, p: q });
  card(c, 360, 330, 1200, 300, { a: q, fill: "rgba(255,255,255,0.25)", stroke: C.yellow, r: 40 });
  c.save(); c.globalAlpha = A * q; c.filter = "blur(14px)"; c.fillStyle = C.white; c.font = MONT(56); c.textAlign = "center"; c.fillText(o.hidden || "██████ ███ ████████", 960, 505); c.restore();
  const sh = Math.sin(d.t * 9) * 4 * (1 - X.pr(.5, .7)); c.save(); c.globalAlpha = A * q; c.translate(960 + sh, 470); rr(c, -60, -20, 120, 100, 18); c.fillStyle = C.yellow; c.fill(); c.strokeStyle = C.yellow; c.lineWidth = 14; c.beginPath(); c.arc(0, -20, 38, Math.PI, 0); c.stroke(); c.restore();
  txt(c, o.text, 960, 760, { font: INTER(50), p: X.pr(.3, .6), maxW: 1500 });
};
// чек: итог проекта
V.receipt = (c, g, d, o, X) => {
  const rows = o.rows || [], h = 200 + rows.length * 86, y0 = 540 - h / 2 - 20; card(c, 560, y0, 800, h, { r: 16 });
  c.save(); c.globalAlpha = A; c.fillStyle = "#ffffff"; for (let k = 0; k < 20; k++) { c.beginPath(); c.moveTo(560 + k * 40, y0 + h); c.lineTo(580 + k * 40, y0 + h + 22); c.lineTo(600 + k * 40, y0 + h); c.fill(); } c.restore();
  txt(c, o.title || "ЧЕК: ДОМ НА ШАРИКАХ", 960, y0 + 80, { font: MONT(46), color: C.ink, stroke: false });
  rows.forEach(([l, v], i) => { const q = X.pr(.08 + i * .1, .2 + i * .1), y = y0 + 170 + i * 86; txt(c, l, 610, y, { font: INTER(40), color: "#3b4b66", stroke: false, align: "left", p: q }); txt(c, v, 1310, y, { font: MONT(44), color: i === rows.length - 1 ? C.red : C.ink, stroke: false, align: "right", p: q }); });
  if (o.stamp) { const q = ease.out(X.pr(.8, .9)); txt(c, o.stamp, 1300, y0 + h - 30, { font: MONT(78), color: C.red, stroke: false, rot: -.18, p: q, pop: true, a: .9 }); }
};
// вопрос зрителю
V.ask = (c, g, d, o, X) => {
  ground(c, 940); tolik(c, 440, 940, 1.2, 1, { arm: 1, bal: C.yellow, bounce: true }, d.t);
  const q = ease.out(X.pr(0, .3)); card(c, 760, 220, 1000, 520, { a: q, r: 44 });
  txt(c, o.q, 1260, 320, { font: MONT(54), color: C.ink, stroke: false, p: q, maxW: 900, lh: 62 });
  if (o.formula) { card(c, 830, 470, 860, 140, { a: X.pr(.3, .45), fill: C.yellow, r: 30 }); txt(c, o.formula, 1260, 562, { font: MONT(60), color: C.ink, stroke: false, p: X.pr(.3, .5), fit: 820 }); }
  txt(c, o.sub, 1260, 690, { font: INTER(40), color: "#3b4b66", stroke: false, p: X.pr(.5, .7), maxW: 900 });
};
// следующий выпуск
V.next = (c, g, d, o, X) => {
  txt(c, "В СЛЕДУЮЩЕМ ВЫПУСКЕ", 960, 230, { font: MONT(56), color: C.yellow, p: X.pr(0, .2) });
  const q = ease.out(X.pr(.1, .4)); for (let k = 0; k < 9; k++) { c.save(); c.globalAlpha = A * q; c.fillStyle = BAL[k % BAL.length]; rr(c, 900, 930 - k * 46 * q, 120, 42, 8); c.fill(); for (let s = 0; s < 3; s++) { c.beginPath(); c.arc(925 + s * 35, 930 - k * 46 * q - 5, 10, 0, TAU); c.fill(); } c.restore(); }
  txt(c, o.text, 960, 360, { font: MONT(88), p: X.pr(.15, .4), maxW: 1700 }); txt(c, o.sub, 960, 450, { font: INTER(48), p: X.pr(.3, .55), maxW: 1500 });
};

/* ---------------------------------------------------------------- субтитры: крупно, по 3–5 слов, цифры жёлтым */
function captions(d) {
  const caps = LEC.caps; if (!caps || !caps.length || window.NOHUD) return;
  let k = -1; for (let i = 0; i < caps.length; i++) if (d.t >= caps[i].a && d.t < caps[i].b + .05) { k = i; break; } if (k < 0) return;
  const cp = caps[k], pop = 1 + .14 * (1 - ease.out(prog(d.t, cp.a, cp.a + .16))), words = cp.text.replace(/\n/g, " ").split(" ");
  d.screen(d.ink, (c) => { c.save(); c.font = MONT(58); const sp = c.measureText(" ").width, ws = words.map((w) => c.measureText(w).width), W = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    c.translate(960, 1030); c.scale(pop, pop); let x = -W / 2; c.textAlign = "left"; c.lineJoin = "round";
    words.forEach((w, i) => { const hot = /[0-9%]/.test(w); c.lineWidth = 12; c.strokeStyle = "rgba(0,0,0,0.9)"; c.strokeText(w, x, 0); c.fillStyle = hot ? "#ffd400" : "#ffffff"; c.fillText(w, x, 0); x += ws[i] + sp; }); c.restore(); });
}
const SHAKE = { stat: 0, wow: .1, pop: .2, title: .05 };
function shakeAt(d, i) {
  const b = LEC.beats[i]; if (!b || SHAKE[b.v] == null) return [0, 0]; const t0 = PH[i].s + SHAKE[b.v] * Math.min(PH[i].d, 5), u = (d.t - t0) / .35; if (u < 0 || u > 1) return [0, 0];
  const r = rng("sh", i, Math.floor(d.t * 24)), a = 18 * (1 - u) ** 2; return [(r() - .5) * 2 * a, (r() - .5) * 2 * a];
}
function progressBar(d) {
  if (window.NOHUD) return; const W = 1920, f = clamp(d.t / TM.END, 0, 1);
  d.screen(d.ink, (c) => { c.save(); c.fillStyle = "rgba(255,255,255,0.25)"; c.fillRect(0, 0, W, 8); c.fillStyle = C.yellow; c.fillRect(0, 0, W * f, 8);
    LEC.beats.forEach((b, i) => { if (i < N && b.v === "title" && i > 2) { c.fillStyle = C.ink; c.fillRect(W * (PH[i].s / TM.END) - 2, 0, 4, 8); } }); c.restore(); });
}
// рамка: бренд и бегущий счётчик проекта (badge)
function hud(d, i, a) {
  if (window.NOHUD) return;
  const b = LEC.beats[i] || {}; let badge = b.badge; for (let k = i; badge === undefined && k >= 0; k--) badge = LEC.beats[k].badge;
  d.screen(d.ink, (c) => { const sv = A; A = .9; txt(c, BRAND, 60, 74, { font: MONT(30, 900), align: "left", color: C.white, sw: 6 }); A = sv;
    if (badge && b.v !== "title") { A = a; card(c, 1480, 36, 400, 76, { r: 38, fill: "rgba(20,35,61,0.75)" }); txt(c, badge, 1680, 88, { font: MONT(32, 800), color: C.yellow, stroke: false, fit: 360 }); A = 1; } });
}
function drawBeat(d, i, a, T = {}) {
  if (i < 0 || i >= N) return;
  const b = LEC.beats[i], s = PH[i].s, du = Math.min(PH[i].d, 5), X = { s, at: (f) => s + f * du, pr: (f0, f1) => prog(d.t, s + f0 * du, s + f1 * du), in: prog(d.t, s - .3, s + .7) };
  A = a; d.screen(d.ink, (c) => d.screen(d.glow, (g) => { const z = (1 + .03 * ease.inOut(prog(d.t, s - .3, s + du))) * (T.sc || 1) * (LEC.caps && !window.NOHUD ? .91 : 1), [sx, sy] = shakeAt(d, i); c.save(); g.save(); [c, g].forEach((x) => { x.translate(960 + (T.dx || 0) + sx, (LEC.caps && !window.NOHUD ? 505 : 540) + sy); x.scale(z, z); x.translate(-960, -540); });
    try { (V[b.v] || (() => {}))(c, g, d, b.o || {}, X); } finally { c.restore(); g.restore(); } }));
  A = 1;
}
Sketch.mount({
  palette: "sky", onTwos: false,
  fonts: ["900 80px Montserrat", "800 80px Montserrat", "800 80px Inter", "400 80px Inter"],
  camera: () => ({ x: 960, y: 540, zoom: 1, rot: 0, shake: 0 }),
  draw(d) {
    NOW = d.t;
    let i = 0; while (i + 1 < N && d.t >= bStart(i + 1)) i++;
    SKY = (LEC.beats[i]?.o?.sky) || 0; backdrop(d);
    const tr = (i > 0 && LEC.beats[i].tr) || "fade", D = { whip: .32, zoom: .42, fade: .45 }[tr] || .45, u = prog(d.t, bStart(i), bStart(i) + D); FLASH = 0;
    if (i > 0 && u < 1) {
      if (tr === "whip") { const e = ease.inOut(u); drawBeat(d, i - 1, 1, { dx: -1920 * e }); drawBeat(d, i, 1, { dx: 1920 * (1 - e) }); }
      else if (tr === "zoom") { drawBeat(d, i - 1, 1 - u, { sc: 1 + .5 * u }); drawBeat(d, i, u, { sc: .82 + .18 * ease.out(u) }); FLASH = Math.max(0, 1 - Math.abs(u - .12) / .3) * .5; }
      else { drawBeat(d, i - 1, 1 - u); drawBeat(d, i, u); }
    } else drawBeat(d, i, 1);
    hud(d, i, 1); captions(d); progressBar(d);
  },
  post(M) { if (FLASH > 0) { M.fillStyle = `rgba(255,255,255,${FLASH})`; M.fillRect(0, 0, 1920, 1080); } },
});
