/* ============================================================================
 * «Подвал Разума» — лекция на ночь по психологии Юнга. Визуал полностью кодом (code-cartoon).
 * Стиль: тёплая ночь (палитра dusk), светящиеся золотые линии, силуэты с контровым светом,
 * плывущие частицы света, подписи шрифтом Lora. Каждая фраза диктора = своя картинка (lecture.js).
 * ==========================================================================*/
const { pen, shape, geo, ease, prog, lerp, clamp, rng, fx } = Sketch;
const LEC = window.LECTURE, TM = window.TM, PH = TM.PH;
const P = (x, y) => ({ x, y }), TAU = Math.PI * 2;
const SERIF = (px) => `600 ${px}px Lora`, ITAL = (px) => `italic 400 ${px}px Lora`, HAND = (px) => `700 ${px}px Caveat`, SANS = (px, w = 800) => `${w} ${px}px Inter`;
const ROSE = "#e58f98", NIGHT = "#140d0b", SKIN = "#1b1311";
const N = Math.min(LEC.beats.length, PH.length);
const bStart = (i) => (i >= N ? TM.END + 5 : PH[i].s - .3);
let A = 1; // прозрачность текущей картинки (для перехода между фразами)

/* ---------------------------------------------------------------- утилиты */
const circ = (x, y, r, n = 48) => shape.ellipse(x, y, r, r, { n });
function rrect(x, y, w, h, r, n = 8) { // скруглённый прямоугольник, (x, y) — центр
  const pts = [], cs = [[x + w / 2 - r, y - h / 2 + r, -Math.PI / 2], [x + w / 2 - r, y + h / 2 - r, 0], [x - w / 2 + r, y + h / 2 - r, Math.PI / 2], [x - w / 2 + r, y - h / 2 + r, Math.PI]];
  cs.forEach(([cx, cy, a0]) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push(P(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); } });
  return pts;
}
function smooth(pts, it = 2, closed = true) { // сглаживание Чайкина
  let p = pts;
  for (let k = 0; k < it; k++) { const q = []; const n = p.length; for (let i = 0; i < (closed ? n : n - 1); i++) { const a = p[i], b = p[(i + 1) % n]; q.push(P(a.x * .75 + b.x * .25, a.y * .75 + b.y * .25), P(a.x * .25 + b.x * .75, a.y * .25 + b.y * .75)); } p = q; }
  return p;
}
const mirror = (half, cx) => half.concat(half.slice().reverse().map((p) => P(2 * cx - p.x, p.y)));
const T = (c, d, s, x, y, font, color, o = {}) => pen.text(c, s, x, y, { k: d.k, font, color, align: o.align, progress: o.p ?? 1, alpha: (o.a ?? 1) * A, maxWidth: o.maxWidth, lineHeight: o.lh });
const S = (c, d, pts, seed, o = {}) => pen.stroke(c, pts, { k: d.k, seed, width: 3, color: "line", wobble: .9, alpha: (o.alpha ?? 1) * A, ...o, alpha: (o.alpha ?? 1) * A });
const F = (c, d, pts, seed, color, o = {}) => pen.flat(c, pts, { k: d.k, seed, color, outline: 0, ...o, alpha: (o.alpha ?? 1) * A, lineAlpha: (o.lineAlpha ?? 1) * A });
function glowDisc(g, x, y, r, color, a) { // мягкий свет
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, Sketch.rgba(color, a * A)); gr.addColorStop(1, Sketch.rgba(color, 0));
  g.save(); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
}

/* ---------------------------------------------------------------- силуэты */
// женщина сидит на подоконнике, вид со спины
function womanBack(cx, base, s = 1, tilt = 0) {
  const h = [P(0, 0), P(-132, 0), P(-142, -40), P(-138, -120), P(-104, -175), P(-98, -230), P(-118, -290), P(-120, -318), P(-96, -346), P(-52, -362), P(-28, -372), P(-26, -404)];
  const body = smooth(mirror(h.map((p) => P(cx + p.x * s, base + p.y * s)), cx), 2);
  const hx = cx + tilt * 8, hy = base - 430 * s;
  return { body, head: circ(hx, hy, 50 * s), bun: circ(hx + 6 * s, hy - 58 * s, 28 * s, 32), hx, hy };
}
// женщина стоит в профиль/три четверти: платье, волосы до плеч
function womanStand(cx, floor, s = 1, look = 1, lean = 0) {
  const X = (x) => cx + x * s * look, Y = (y) => floor + y * s;
  const dress = smooth([P(X(0), Y(-470)), P(X(46), Y(-462)), P(X(70), Y(-420)), P(X(58), Y(-330)), P(X(40), Y(-270)), P(X(66), Y(-160)), P(X(118), Y(-36)), P(X(-104), Y(-36)), P(X(-56), Y(-160)), P(X(-40), Y(-270)), P(X(-56), Y(-330)), P(X(-64), Y(-420)), P(X(-40), Y(-462))], 2);
  const legs = [[P(X(20), Y(-40)), P(X(24), Y(0))], [P(X(-22), Y(-40)), P(X(-30), Y(0))]];
  const hx = X(6 + lean * 20), hy = Y(-540);
  const hair = smooth([P(hx - 50 * s, hy - 10 * s), P(hx - 44 * s, hy - 52 * s), P(hx, hy - 66 * s), P(hx + 46 * s, hy - 50 * s), P(hx + 52 * s, hy), P(hx + 40 * look * s, hy + 72 * s), P(hx - 58 * look * s, hy + 80 * s)], 2);
  return { dress, legs, head: circ(hx, hy, 44 * s), hair, neck: [P(hx, hy + 40 * s), P(X(4), Y(-468))], shoulder: P(X(56), Y(-440)), hx, hy };
}
function manStand(cx, floor, s = 1, look = -1) {
  const X = (x) => cx + x * s * look, Y = (y) => floor + y * s;
  const body = smooth([P(X(0), Y(-500)), P(X(60), Y(-488)), P(X(96), Y(-450)), P(X(84), Y(-330)), P(X(64), Y(-250)), P(X(60), Y(-200)), P(X(46), Y(0)), P(X(8), Y(0)), P(X(2), Y(-170)), P(X(-6), Y(0)), P(X(-46), Y(0)), P(X(-60), Y(-200)), P(X(-64), Y(-250)), P(X(-84), Y(-330)), P(X(-96), Y(-450)), P(X(-60), Y(-488))], 1);
  const hx = X(4), hy = Y(-572);
  return { body, head: circ(hx, hy, 48 * s), hair: smooth([P(hx - 50 * s, hy - 6 * s), P(hx - 40 * s, hy - 48 * s), P(hx + 6 * s, hy - 60 * s), P(hx + 48 * s, hy - 40 * s), P(hx + 50 * s, hy - 4 * s), P(hx, hy - 30 * s)], 2), shoulder: P(X(84), Y(-450)), hx, hy };
}
function silhouette(c, g, d, parts, seed, rim = "a3", rimSide = 1) {
  parts.forEach((p, i) => { F(c, d, p, seed + "f" + i, "black"); S(c, d, p, seed + "o" + i, { width: 2.4, color: "soft", closed: true, alpha: .9 }); });
  // контровой свет: та же линия на слое свечения, только одна сторона
  parts.forEach((p, i) => { const bb = geo.bbox(p), side = p.filter((q) => (q.x - bb.cx) * rimSide > bb.w * .12); if (side.length > 3) S(g, d, side, seed + "r" + i, { width: 2.6, color: rim, alpha: .75, wobble: .5 }); });
}

/* ---------------------------------------------------------------- картинки */
const V = {};
// телефон с перепиской
V.phone = (c, g, d, o, X) => {
  const x = 1240, y = 540, w = 440, h = 830, t = d.t, inP = ease.out(X.in);
  // часы и луна слева
  T(c, d, o.clock, 560, 560, SERIF(190), "line", { p: prog(t, X.s, X.s + .9) });
  T(g, d, o.clock, 560, 560, SERIF(190), "a3", { a: .35 });
  const mx = 560, my = 250; F(c, d, circ(mx, my, 54), "moon", "a3"); F(c, d, circ(mx + 24, my - 14, 50), "moonc", "paper"); glowDisc(g, mx, my, 160, "#ffd27a", .25);
  // корпус
  const body = rrect(x, y, w, h, 58);
  F(c, d, body, "ph", "black", { alpha: inP }); S(c, d, body, "pho", { width: 4, closed: true, progress: inP }); S(g, d, body, "phg", { width: 3, closed: true, color: "a3", alpha: .35, progress: inP });
  F(c, d, rrect(x, y - h / 2 + 30, 120, 26, 13), "notch", "paper", { alpha: inP });
  if (inP < .5) return;
  // шапка чата
  const hy = y - h / 2 + 100;
  S(c, d, circ(x - 150, hy, 30), "ava", { width: 2.6, closed: true }); pen.hatch(c, circ(x - 150, hy, 28), { k: d.k, seed: "avh", color: "soft", spacing: 6, alpha: .6 * A });
  T(c, d, o.name || "Андрей", x - 104, hy - 2, SANS(32), "line", { align: "left" });
  T(c, d, o.status || "", x - 104, hy + 34, SANS(22, 400), "soft", { align: "left" });
  S(c, d, [P(x - w / 2 + 24, hy + 58), P(x + w / 2 - 24, hy + 58)], "sep", { width: 1.6, color: "guide" });
  // сообщения
  let my2 = hy + 110; const ctx = c; ctx.font = SANS(28, 400);
  o.msgs.forEach(([who, txt], j) => {
    const tj = X.s + .35 + j * .55, q = ease.pop(prog(t, tj, tj + .3)); if (q <= 0) return;
    const lines = wrap(ctx, txt, 300), bw = Math.min(330, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 44), bh = 28 + lines.length * 36;
    const me = who === "me", bx = me ? x + w / 2 - 30 - bw / 2 : x - w / 2 + 30 + bw / 2, by = my2 + bh / 2;
    const b = geo.transform(rrect(0, 0, bw, bh, 22), { x: bx, y: by, scale: .7 + .3 * q });
    F(c, d, b, "m" + j, me ? ROSE : "soft", { alpha: .92 });
    lines.forEach((l, li) => T(c, d, l, bx, by - bh / 2 + 44 + li * 36, SANS(28, 400), me ? "paper" : "paper", { a: clamp(q) }));
    if (me) { const rd = o.read && t > X.at(.25), col = rd ? "a3" : "paper"; [0, 9].forEach((dx, k2) => S(c, d, [P(bx + bw / 2 - 40 + dx, by + bh / 2 - 14), P(bx + bw / 2 - 34 + dx, by + bh / 2 - 8), P(bx + bw / 2 - 24 + dx, by + bh / 2 - 22)], "tk" + j + k2, { width: 2.4, color: col, wobble: .2, sketch: false })); }
    my2 += bh + 22;
  });
  if (o.typing) { const ta = X.pr(.3, .36); if (ta > 0) { const bx = x - w / 2 + 90, by = my2 + 40; F(c, d, rrect(bx, by, 110, 56, 28), "typ2", "soft", { alpha: .9 * ta }); for (let i = 0; i < 3; i++) F(c, d, circ(bx - 26 + i * 26, by - Math.max(0, Math.sin(t * 9 - i)) * 6, 7, 12), "tdd" + i, "paper", { alpha: ta }); } }
  if (o.side === "him" && !o.typing) { const hp = X.pr(.5, .8); if (hp > 0) { const hx = 560, hy = 800, hs = 3.2 * ease.pop(hp), heart = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU; heart.push(P(hx + hs * 16 * Math.pow(Math.sin(a), 3), hy - hs * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)))); } S(g, d, heart, "hh", { width: 3, color: ROSE, closed: true }); } }
  if (o.read) T(c, d, "Прочитано", x + w / 2 - 34, my2 + 6, SANS(22, 400), "a3", { align: "right", p: X.pr(.25, .32) });
  // «печатает…» появляется и исчезает — ложная надежда
  if (o.read) { const ta = X.pr(.42, .48) * (1 - X.pr(.66, .72)); if (ta > 0) { const bx = x - w / 2 + 90, by = my2 + 70; F(c, d, rrect(bx, by, 110, 56, 28), "typ", "soft", { alpha: .9 * ta }); for (let i = 0; i < 3; i++) F(c, d, circ(bx - 26 + i * 26, by - Math.max(0, Math.sin(t * 9 - i)) * 6, 7, 12), "td" + i, "paper", { alpha: ta }); } }
  if (o.read) { const q = o.thought || "что я сделала не так?"; T(c, d, q, 560, 800, HAND(68), "line", { p: X.pr(.74, .95) }); T(g, d, q, 560, 800, HAND(68), ROSE, { a: .25 * X.pr(.8, 1) }); }
};
function wrap(ctx, s, mw) { const out = []; let cur = ""; s.split(" ").forEach((w) => { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > mw && cur) { out.push(cur); cur = w; } else cur = t; }); out.push(cur); return out; }

// окно с дождём и женщина на подоконнике
V.window = (c, g, d, o, X) => {
  const cx = 760, top = 150, w = 600, hgt = 720, sill = top + hgt, t = d.t, inP = ease.out(X.in);
  const frame = []; for (let i = 0; i <= 30; i++) { const a = Math.PI + (i / 30) * Math.PI; frame.push(P(cx + Math.cos(a) * w / 2, top + w / 2 + Math.sin(a) * w / 2)); }
  frame.push(P(cx + w / 2, sill), P(cx - w / 2, sill));
  F(c, d, frame, "sky", o.dawn ? "#3b2419" : NIGHT, { alpha: .85 * inP });
  if (o.dawn) glowDisc(c, cx, sill - 40, 520, "#ff9a5a", .35 * inP);
  // луна и облака внутри окна
  const mx = cx + 150, my = top + 230; glowDisc(g, mx, my, 260, "#ffe2a8", .32 * inP); F(c, d, circ(mx, my, 62), "wm", "a3", { alpha: inP });
  c.save(); c.beginPath(); frame.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.clip();
  for (let i = 0; i < 2; i++) { const ox = ((t * 10 + i * 380) % 900) - 450, cy2 = top + 250 + i * 120; glowDisc(c, cx + ox, cy2, 160, "#3a2a26", .7 * inP); }
  c.restore();
  // дождь — на слое свечения, только внутри окна
  if (o.rain) { g.save(); g.beginPath(); frame.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.clip();
    for (let i = 0; i < 70; i++) { const r = rng("rain", i), x = cx - w / 2 + r() * w, sp = 700 + r() * 500, y = ((r() * hgt + t * sp) % (hgt + 80)) + top - 60; g.strokeStyle = Sketch.rgba("#b9c3cc", .35 * A * inP); g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 6, y + 34); g.stroke(); }
    g.restore(); }
  // рама и перекладины
  S(c, d, frame, "fr", { width: 7, closed: true, progress: inP }); S(c, d, [P(cx, top + 30), P(cx, sill)], "fr2", { width: 5, progress: inP }); S(c, d, [P(cx - w / 2, top + w / 2 + 40), P(cx + w / 2, top + w / 2 + 40)], "fr3", { width: 5, progress: inP });
  S(c, d, [P(cx - w / 2 - 70, sill + 6), P(cx + w / 2 + 70, sill + 6)], "sill", { width: 9, progress: inP }); F(c, d, rrect(cx, sill + 30, w + 160, 40, 8), "sillb", "black", { alpha: inP });
  // женщина на подоконнике
  if (o.figure && inP > .3) { const tilt = Math.sin(t * .6) * .6, W = womanBack(cx - 40, sill, o.memory ? .5 : .78, tilt); silhouette(c, g, d, o.memory ? [W.body, W.head] : [W.body, W.head, W.bun], "wb", o.dawn ? "warm" : "a3", 1);
    if (o.memory) T(c, d, "папа приедет в воскресенье…", cx + 560, 420, HAND(56), "soft", { p: X.pr(.4, .8) }); }
  // свеча-огонёк в углу комнаты и тёплые отблески на полу
  glowDisc(g, cx, sill + 60, 420, "#ffb547", .08 * inP);
};

// нить между двумя людьми
V.thread = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), floor = 880, back = (o.state === "taut" ? 1 : 0) * ease.inOut(X.pr(.2, .9)) * 70 - (o.step > 0 ? 1 : 0) * ease.inOut(X.pr(.2, .8)) * 180;
  const W = womanStand(560, floor, 1, 1, .5), M = manStand(1360 + back, floor, 1, -1);
  [W.dress, W.head, W.hair].forEach(() => {});
  if (inP > .1) { silhouette(c, g, d, [W.hair, W.dress, W.head], "ws", "a3", -1); W.legs.forEach((l, i) => S(c, d, l, "wl" + i, { width: 6, color: "soft" })); silhouette(c, g, d, [M.body, M.hair, M.head], "ms", "a3", 1); }
  // руки: она тянется, он держит руку низко
  const wh = P(lerp(W.shoulder.x + 40, 800, ease.out(X.in)), 560), mh = P(M.shoulder.x - 50, 640);
  S(c, d, [W.shoulder, P((W.shoulder.x + wh.x) / 2, 520), wh], "wa", { width: 7, color: "soft" });
  S(c, d, [M.shoulder, P(M.shoulder.x - 30, 560), mh], "ma", { width: 7, color: "soft" });
  // нить: натянутая дрожит
  const tp = X.pr(.05, .35), pts = [];
  for (let i = 0; i <= 40; i++) { const u = i / 40, vib = o.state === "taut" ? Math.sin(u * Math.PI) * Math.sin(t * 38 + u * 9) * 3 : Math.sin(u * Math.PI) * 60; pts.push(P(lerp(wh.x, mh.x, u), lerp(wh.y, mh.y, u) + vib)); }
  S(g, d, pts, "thr", { width: o.state === "golden" ? 5 : 3.5, color: o.state === "taut" ? ROSE : "a3", progress: tp, wobble: .2, sketch: false });
  if (o.state === "golden" && tp > .5) for (let i = 0; i < 8; i++) { const u = ((t * .15 + i / 8) % 1), p = pts[Math.round(u * 40)]; F(g, d, shape.star(p.x, p.y - 6, 9, 3.5, 4), "gs" + i, "a3", { alpha: Math.sin(u * Math.PI) }); }
  S(c, d, pts, "thr2", { width: 1.6, color: o.state === "taut" ? ROSE : "a3", progress: tp, wobble: .2, sketch: false });
  if (o.state === "taut" && tp > .9) for (let i = 0; i < 4; i++) { const u = .3 + i * .13, p = pts[Math.round(u * 40)]; S(g, d, [P(p.x - 8, p.y - 22), P(p.x + 4, p.y - 34)], "tm" + i, { width: 2.4, color: ROSE, alpha: .5 + .5 * Math.sin(t * 6 + i) }); }
};

// мандала — фирменный знак канала, в центре ключ
V.mandala = (c, g, d, o, X) => {
  const cx = 960, cy = 440, t = d.t, rot = t * .06, dp = X.pr(0, .55);
  glowDisc(g, cx, cy, 420, "#ffd27a", .18 * X.in);
  [300, 262, 196, 120].forEach((r, i) => S(g, d, circ(cx, cy, r, 90), "mr" + i, { width: i ? 2 : 3, color: "a3", closed: true, progress: prog(dp, i * .12, .4 + i * .12) }));
  for (let i = 0; i < 12; i++) { const a = rot + (i / 12) * TAU, p = geo.transform(shape.ellipse(0, -231, 22, 44, { n: 20 }), { x: cx, y: cy, rot: a, ox: 0, oy: 0 }); const pp = prog(dp, .3 + i * .03, .55 + i * .03); if (pp > 0) S(c, d, geo.transform(shape.ellipse(0, 0, 22, 44, { n: 20 }), { x: cx + Math.sin(a) * 230, y: cy - Math.cos(a) * 230, rot: a }), "pt" + i, { width: 2.4, color: "line", closed: true, progress: pp }); void p; }
  for (let i = 0; i < 24; i++) { const a = -rot * 1.5 + (i / 24) * TAU, q = prog(dp, .5 + i * .01, .6 + i * .01); if (q > 0) F(g, d, circ(cx + Math.cos(a) * 282, cy + Math.sin(a) * 282, 5 * q, 10), "dt" + i, "a3"); }
  for (let i = 0; i < 8; i++) { const a = rot * 2 + (i / 8) * TAU; S(c, d, [P(cx + Math.cos(a) * 128, cy + Math.sin(a) * 128), P(cx + Math.cos(a + .39) * 186, cy + Math.sin(a + .39) * 186), P(cx + Math.cos(a + .78) * 128, cy + Math.sin(a + .78) * 128)], "st" + i, { width: 2, color: "soft", progress: prog(dp, .55, .8) }); }
  // ключ
  const kp = X.pr(.4, .7); if (kp > 0) { const kc = "a3", kx = cx, ky = cy - 30, sc = .6 + .4 * ease.pop(kp);
    c.save(); c.translate(kx, ky); c.scale(sc, sc); F(c, d, circ(0, -40, 40, 30), "kb", kc); F(c, d, circ(0, -40, 18, 20), "kbh", "paper"); F(c, d, rrect(0, 50, 16, 140, 6), "ks", kc); F(c, d, rrect(18, 100, 30, 14, 4), "kt1", kc); F(c, d, rrect(16, 80, 24, 12, 4), "kt2", kc); c.restore(); glowDisc(g, kx, ky, 180, "#ffd27a", .3 * kp); }
  if (o.self) T(c, d, "целостность", cx, 880, ITAL(56), "a3", { p: X.pr(.3, .6) });
  if (o.title) { T(c, d, o.title, cx, 870, SERIF(92), "line", { p: X.pr(.15, .5) }); T(g, d, o.title, cx, 870, SERIF(92), "a3", { a: .3 * X.pr(.4, .6) }); T(c, d, o.sub, cx, 940, ITAL(42), "soft", { p: X.pr(.4, .7) }); }
};

// 7 перемен — семь кругов на дуге
const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"], NAMES = ["Проекция", "Тревога", "Тень", "Анимус", "К себе", "Пространство", "Тишина"];
V.list7 = (c, g, d, o, X) => {
  const head = o.head || "7 перемен", names = o.names || NAMES; T(c, d, head, 960, 250, SERIF(120), "line", { p: X.pr(0, .2) }); T(g, d, head, 960, 250, SERIF(120), "a3", { a: .3 });
  const pts = ROMAN.map((_, i) => P(360 + i * 200, 600 - Math.sin((i / 6) * Math.PI) * 140));
  S(g, d, smooth(pts, 3, false), "path7", { width: 2, color: "a3", progress: X.pr(.05, .6), alpha: .6 });
  pts.forEach((p, i) => { const q = X.pr(.12 + i * .09, .2 + i * .09); if (q <= 0) return; const on = ease.pop(q);
    F(c, d, circ(p.x, p.y, 62 * on), "c7" + i, "black"); S(c, d, circ(p.x, p.y, 62 * on), "c7o" + i, { width: 3, closed: true, color: "a3" }); glowDisc(g, p.x, p.y, 120, "#ffd27a", .2 * q);
    T(c, d, ROMAN[i], p.x, p.y + 18, SERIF(50), "a3");
    T(c, d, o.reveal === 2 ? names[i] : "?", p.x, p.y + 130, o.reveal === 2 ? SERIF(34) : HAND(70), o.reveal === 2 ? "line" : "soft", { p: q }); });
};

// свеча
V.candle = (c, g, d, o, X) => {
  const cx = 960, base = 820, t = d.t, inP = ease.out(X.in), fl = 1 + Sketch.noise1(t * 3, 1) * .25 - .1, sw = (Sketch.noise1(t * 2, 7) - .5) * 10;
  glowDisc(g, cx, base - 300, 520, "#ffb547", .22 * inP * fl);
  F(c, d, shape.ellipse(cx, base + 8, 190, 30, { n: 40 }), "plate", "black", { alpha: inP }); S(c, d, shape.ellipse(cx, base + 8, 190, 30, { n: 40 }), "plo", { width: 3, closed: true, progress: inP });
  const body = rrect(cx, base - 130, 110, 260, 10); F(c, d, body, "cb", "#efe1c8", { alpha: inP }); S(c, d, body, "cbo", { width: 3, closed: true, progress: inP });
  F(c, d, smooth([P(cx - 55, base - 255), P(cx - 30, base - 236), P(cx - 34, base - 200), P(cx - 24, base - 236), P(cx + 55, base - 255)], 1, false).concat([P(cx + 55, base - 262), P(cx - 55, base - 262)]), "drip", "#f7ecd8", { alpha: inP });
  S(c, d, [P(cx, base - 262), P(cx + 2, base - 292)], "wick", { width: 3 });
  const fh = 90 * fl, flame = smooth([P(cx + sw * .3, base - 290), P(cx + 24, base - 320), P(cx + sw, base - 290 - fh), P(cx - 24, base - 320)], 3);
  if (inP > .4) { F(g, d, flame, "fl", "warm"); F(g, d, geo.transform(flame, { scale: .55, ox: cx, oy: base - 300 }), "fl2", "a3"); glowDisc(g, cx, base - 330, 140, "#ffd27a", .5 * fl); }
  if (o.ritual) for (let i = 0; i < 3; i++) { const u = ((t * .25 + i / 3) % 1), x = cx + Math.sin(u * 9 + i) * 26 * u, y = base - 380 - u * 260; S(c, d, circ(x, y, 10 + u * 22, 16), "sm" + i, { width: 2, color: "soft", alpha: (1 - u) * .5, closed: true }); }
};

// карточка «напиши в комментариях»
V.affirm = (c, g, d, o, X) => {
  const cx = 960, cy = 470, w = 1180, h = 440, inP = ease.out(X.in);
  const card = rrect(cx, cy, w, h, 26); F(c, d, card, "card", "black", { alpha: .9 * inP }); S(g, d, card, "cardg", { width: 2.4, color: "a3", closed: true, progress: inP, alpha: .8 });
  S(c, d, rrect(cx, cy, w - 40, h - 40, 18), "card2", { width: 1.4, color: "soft", closed: true, progress: inP });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy], i) => S(g, d, shape.arc(cx + sx * (w / 2 - 20), cy + sy * (h / 2 - 20), 34, sx > 0 ? (sy > 0 ? Math.PI : Math.PI / 2) : (sy > 0 ? -Math.PI / 2 : 0), sx > 0 ? (sy > 0 ? 1.5 * Math.PI : Math.PI) : (sy > 0 ? 0 : Math.PI / 2), 12), "co" + i, { width: 2.4, color: "a3", progress: inP }));
  T(c, d, "Напиши в комментариях:", cx, cy - 110, ITAL(46), "soft", { p: X.pr(0, .15) });
  const wp = X.pr(.2, .55); T(c, d, o.text, cx, cy + 50, HAND(116), "line", { p: wp }); T(g, d, o.text, cx, cy + 50, HAND(116), "a3", { a: .35 * wp });
  const hp = X.pr(.55, .7); if (hp > 0) { const hx = cx, hy = cy + 150, hs = 22 * ease.pop(hp), heart = []; for (let i = 0; i <= 40; i++) { const a = (i / 40) * TAU; heart.push(P(hx + hs * 16 * Math.pow(Math.sin(a), 3) / 16, hy - hs * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 16)); } F(g, d, heart, "hrt", ROSE); }
};


/* ---------------------------------------------------------------- новые сцены полной лекции */
// заставка главы: римская цифра в кольце, название
V.chapter = (c, g, d, o, X) => {
  const cx = 960, t = d.t, rot = t * .1, p = X.in;
  glowDisc(g, cx, 380, 360, "#ffd27a", .14 * p);
  S(g, d, circ(cx, 380, 170, 80), "chr", { width: 2.4, color: "a3", closed: true, progress: ease.out(p) });
  for (let i = 0; i < 16; i++) { const a = rot + (i / 16) * TAU; S(c, d, [P(cx + Math.cos(a) * 190, 380 + Math.sin(a) * 190), P(cx + Math.cos(a) * (206 + (i % 2) * 14), 380 + Math.sin(a) * (206 + (i % 2) * 14))], "chs" + i, { width: 2, color: "soft", progress: prog(p, .3, .8) }); }
  if (o.n) { T(c, d, o.word || "перемена", cx, 300, ITAL(40), "soft", { p: prog(p, .1, .5) }); T(c, d, ROMAN[o.n - 1], cx, 450, SERIF(150), "line", { p: prog(p, .2, .7) }); T(g, d, ROMAN[o.n - 1], cx, 450, SERIF(150), "a3", { a: .4 * p }); }
  else { F(g, d, shape.star(cx, 380, 70, 22, 8), "chst", "a3", { alpha: p }); }
  T(c, d, o.title, cx, 720, SERIF(86), "line", { p: X.pr(.05, .6) }); T(g, d, o.title, cx, 720, SERIF(86), "a3", { a: .22 * X.pr(.3, .7) });
  c.font = SERIF(86); const w = c.measureText(o.title).width;
  [-1, 1].forEach((sd) => { S(g, d, [P(cx + sd * (w / 2 + 30), 692), P(cx + sd * (w / 2 + 230), 692)], "chl" + sd, { width: 2, color: "a3", progress: X.pr(.3, .7) }); F(g, d, shape.poly(cx + sd * (w / 2 + 240), 692, 9, 4), "chd" + sd, "a3", { alpha: X.pr(.6, .7) }); });
};
// часы ожидания и женщина рядом
V.clock = (c, g, d, o, X) => {
  const cx = 720, cy = 470, r = 250, t = d.t, inP = ease.out(X.in);
  F(c, d, circ(cx, cy, r, 80), "cf", "black", { alpha: .9 * inP }); S(c, d, circ(cx, cy, r, 80), "co", { width: 5, closed: true, progress: inP }); S(g, d, circ(cx, cy, r + 14, 80), "cg", { width: 2, color: "a3", closed: true, progress: inP, alpha: .6 });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; S(c, d, [P(cx + Math.cos(a) * (r - 30), cy + Math.sin(a) * (r - 30)), P(cx + Math.cos(a) * (r - (i % 3 ? 14 : 4)), cy + Math.sin(a) * (r - (i % 3 ? 14 : 4)))], "ct" + i, { width: i % 3 ? 2.4 : 5, progress: inP }); }
  const sp = o.spin === 2 ? 1.2 : 3.2, ma = t * sp - Math.PI / 2, ha = t * sp / 12 - Math.PI / 2 + 1.4;
  S(c, d, [P(cx, cy), P(cx + Math.cos(ha) * 130, cy + Math.sin(ha) * 130)], "hh", { width: 9, sketch: false });
  S(g, d, [P(cx, cy), P(cx + Math.cos(ma) * 200, cy + Math.sin(ma) * 200)], "mh", { width: 5, color: "a3", sketch: false });
  F(c, d, circ(cx, cy, 14), "cc", "a3");
  if (inP > .3) { const W = womanStand(1380, 900, .95, -1, -.6); silhouette(c, g, d, [W.hair, W.dress, W.head], "cw", "a3", -1); W.legs.forEach((l, i) => S(c, d, l, "cwl" + i, { width: 6, color: "soft" })); }
};
// проекция: луч света от неё к нему, на нём — её радость
V.projection = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), W = womanStand(480, 900, 1, 1, .2), M = manStand(1420, 900, 1, -1);
  silhouette(c, g, d, [W.hair, W.dress, W.head], "pw", "a3", 1); W.legs.forEach((l, i) => S(c, d, l, "pwl" + i, { width: 6, color: "soft" }));
  silhouette(c, g, d, [M.body, M.hair, M.head], "pm", "a3", -1);
  const src = P(530, 470), bp = X.pr(.05, .4), tx = lerp(src.x, 1340, ease.out(bp));
  if (bp > 0) { g.save(); const gr = g.createLinearGradient(src.x, 0, 1420, 0); gr.addColorStop(0, Sketch.rgba("#ffd27a", .5 * A)); gr.addColorStop(1, Sketch.rgba("#ffd27a", .12 * A)); g.fillStyle = gr; g.beginPath(); g.moveTo(src.x, src.y - 8); g.lineTo(tx, 300); g.lineTo(tx, 760); g.lineTo(src.x, src.y + 8); g.closePath(); g.fill(); g.restore(); glowDisc(g, src.x, src.y, 60, "#ffd27a", .6 * bp); }
  const words = ["радость", "ценность", "покой", "счастье"];
  if (o.beams) words.forEach((w, i) => { const q = X.pr(.15 + i * .17, .3 + i * .17); if (q <= 0) return; const x = lerp(src.x + 60, 1420, ease.inOut(q)), y = 380 + i * 90; T(c, d, w, x, y, HAND(54), "a3", { a: Math.min(1, q * 3) }); T(g, d, w, x, y, HAND(54), "a3", { a: .4 * q }); });
  else T(c, d, "белая стена", 1420, 250, ITAL(40), "soft", { p: X.pr(.45, .75) });
};
// цитата Юнга
V.quote = (c, g, d, o, X) => {
  const t = d.t, p = X.pr(0, .55), lines = o.text.split("\n"), y0 = 520 - (lines.length - 1) * 42;
  T(g, d, "«", 300, 380, SERIF(220), "a3", { a: .6 * X.in }); T(g, d, "»", 1620, 760, SERIF(220), "a3", { a: .6 * X.in });
  lines.forEach((l, i) => T(c, d, l, 960, y0 + i * 84, ITAL(60), "line", { p: prog(p, i / lines.length, (i + 1) / lines.length) }));
  T(c, d, "— Карл Густав Юнг", 960, y0 + lines.length * 84 + 60, SERIF(36), "a3", { p: X.pr(.5, .7) });
  S(g, d, [P(660, y0 - 110), P(1260, y0 - 110)], "ql1", { width: 1.6, color: "a3", progress: X.in }); S(g, d, [P(660, y0 + lines.length * 84 + 110), P(1260, y0 + lines.length * 84 + 110)], "ql2", { width: 1.6, color: "a3", progress: X.in });
};
// зеркало: отражение / анимус / анима
V.mirror = (c, g, d, o, X) => {
  const mx = 1230, my = 480, rx = 230, ry = 330, inP = ease.out(X.in), t = d.t;
  const oval = shape.ellipse(mx, my, rx, ry, { n: 70 }), oval2 = shape.ellipse(mx, my, rx + 26, ry + 26, { n: 70 });
  F(c, d, oval2, "mf", "black", { alpha: inP }); F(c, d, oval, "mi", "#24171a", { alpha: inP });
  S(c, d, oval2, "mo", { width: 4, closed: true, progress: inP }); S(g, d, oval, "mg", { width: 2.4, color: "a3", closed: true, progress: inP, alpha: .7 });
  for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU; F(g, d, circ(mx + Math.cos(a) * (rx + 40), my + Math.sin(a) * (ry + 40), 4, 8), "md" + i, "a3", { alpha: inP * .8 }); }
  const lead = o.anima ? manStand(560, 900, 1, 1) : womanStand(560, 900, 1, 1, .2);
  if (o.anima) silhouette(c, g, d, [lead.body, lead.hair, lead.head], "ml", "a3", 1); else { silhouette(c, g, d, [lead.hair, lead.dress, lead.head], "ml", "a3", 1); lead.legs.forEach((l, i) => S(c, d, l, "mll" + i, { width: 6, color: "soft" })); }
  // отражение внутри овала
  c.save(); c.beginPath(); oval.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.clip();
  g.save(); g.beginPath(); oval.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.closePath(); g.clip();
  const rp = X.pr(.1, .5), sv = A; A = A * rp;
  if (o.animus) { const R = manStand(mx, my + 360, .72, -1); silhouette(c, g, d, [R.body, R.hair, R.head], "mr", o.glow ? "warm" : "a3", -1); if (o.glow) glowDisc(g, mx, my, 260, "#ffd27a", .3); }
  else if (o.anima) { const R = womanStand(mx, my + 360, .72, -1, 0); silhouette(c, g, d, [R.hair, R.dress, R.head], "mr", "a3", -1); }
  else { const R = womanStand(mx, my + 360, .72, -1, .2); silhouette(c, g, d, [R.hair, R.dress, R.head], "mr", "a3", -1); glowDisc(g, mx, my - 60, 120, "#ffd27a", .4); F(g, d, rrect(mx, my - 60, 14, 50, 4), "key", "a3"); F(g, d, circ(mx, my - 98, 16, 16), "keyb", "a3"); }
  A = sv; c.restore(); g.restore();
  T(c, d, o.animus ? "Анимус" : o.anima ? "Анима" : "", mx, my + ry + 90, ITAL(44), "a3", { p: X.pr(.4, .7) });
};
// двое: роли зависят от настроения
V.pair = (c, g, d, o, X) => {
  const t = d.t, m = o.mood || "equal", inP = ease.out(X.in);
  const wx = m === "pressure" ? 700 + ease.inOut(X.pr(.1, .8)) * 60 : 660, mx2 = m === "pressure" ? 1300 + ease.inOut(X.pr(.1, .8)) * 120 : m === "equal" ? 1200 : 1280;
  const W = womanStand(wx, 900, 1, m === "notice" ? -1 : 1, m === "pressure" ? 1 : m === "search" ? -.6 : .2), M = manStand(mx2, 900, m === "search" ? .98 : 1, -1);
  silhouette(c, g, d, [W.hair, W.dress, W.head], "aw", m === "equal" || m === "notice" ? "warm" : "a3", m === "notice" ? 1 : -1); W.legs.forEach((l, i) => S(c, d, l, "awl" + i, { width: 6, color: "soft" }));
  silhouette(c, g, d, [M.body, M.hair, M.head], "am", "a3", 1);
  if (m === "search") { for (let i = 0; i < 14; i++) { const a = (i / 14) * TAU + t * .2; S(g, d, [P(M.hx + Math.cos(a) * 80, M.hy + Math.sin(a) * 80), P(M.hx + Math.cos(a) * (120 + (i % 2) * 30), M.hy + Math.sin(a) * (120 + (i % 2) * 30))], "ray" + i, { width: 2.4, color: "a3", progress: inP, alpha: .8 }); } T(c, d, "спаси меня", (wx + mx2) / 2, 300, HAND(56), "soft", { p: X.pr(.3, .6) }); }
  if (m === "pressure") for (let i = 0; i < 4; i++) { const u = ((t * .7 + i / 4) % 1), x = lerp(wx + 120, mx2 - 120, u); S(g, d, shape.arc(x, 520, 60 + u * 40, -.9, .9, 14), "pw" + i, { width: 3, color: ROSE, alpha: (1 - u) * .9 }); }
  if (m === "equal") { const hx = (wx + mx2) / 2, hy = 500; glowDisc(g, hx, hy, 160 * (1 + .08 * Math.sin(t * 2)), "#ffb547", .35 * inP); if (o.warm) S(g, d, smooth([P(wx + 70, 560), P(hx, 640), P(mx2 - 80, 580)], 2, false), "wt", { width: 4, color: "a3", progress: X.pr(.1, .5) }); }
  if (m === "notice") { const q = X.pr(.3, .5); T(c, d, "?", M.hx + 70, M.hy - 70, SERIF(80), "a3", { a: q }); for (let i = 0; i < 5; i++) { const fxp = wx - 160 - i * 70; S(g, d, smooth([P(fxp, 900), P(fxp + 10, 820), P(fxp - 6, 760)], 2, false), "fs" + i, { width: 2.4, color: "a3", progress: X.pr(.1 + i * .05, .4 + i * .05) }); F(g, d, shape.star(fxp - 6, 750, 16, 7, 5), "ff" + i, i % 2 ? ROSE : "a3", { alpha: X.pr(.35 + i * .05, .5 + i * .05) }); } }
};
// Тень: свет лампы, её тень на стене ведёт себя иначе
V.shadow = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), lampX = 300, lampY = 260;
  glowDisc(g, lampX, lampY, 520, "#ffd27a", .22 * inP); F(g, d, circ(lampX, lampY, 26), "lamp", "a3", { alpha: inP }); S(c, d, [P(lampX, lampY - 26), P(lampX, 0)], "lampw", { width: 2, color: "soft" });
  S(c, d, [P(-50, 900), P(1980, 900)], "floor", { width: 2, color: "guide" });
  if (o.embrace) { // взрослая и маленькая девочка рядом, тёплый свет
    const W = womanStand(820, 900, 1, 1, .4), G = womanStand(1080, 900, .55, -1, 0);
    silhouette(c, g, d, [W.hair, W.dress, W.head], "ew", "warm", 1); W.legs.forEach((l, i) => S(c, d, l, "ewl" + i, { width: 6, color: "soft" }));
    silhouette(c, g, d, [G.hair, G.dress, G.head], "eg", "warm", -1); G.legs.forEach((l, i) => S(c, d, l, "egl" + i, { width: 4, color: "soft" }));
    S(c, d, [W.shoulder, P(990, 600), P(1050, 640)], "ea", { width: 7, color: "soft" }); glowDisc(g, 960, 560, 280 * (1 + .06 * Math.sin(t * 2)), "#ffb547", .35 * X.pr(.2, .6));
    return;
  }
  const W = womanStand(760, 900, 1, 1, 0); silhouette(c, g, d, [W.hair, W.dress, W.head], "sw", "a3", -1); W.legs.forEach((l, i) => S(c, d, l, "swl" + i, { width: 6, color: "soft" }));
  // тень на стене справа — большая, тёмная; при «kneel» она сидит, обняв колени
  const sp = X.pr(.05, .5); c.save(); c.globalAlpha = .55 * A * sp;
  if (o.kneel) { const K = womanBack(1380, 900, 1.1, 0); [K.body, K.head].forEach((p, i) => { c.fillStyle = "#050303"; c.beginPath(); p.forEach((q, j) => (j ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fill(); }); T(c, d, "я не нужна…", 1380, 300, HAND(60), ROSE, { a: 1 }); }
  else { const Sh = womanStand(1360, 900, 1.35, 1, Math.sin(t * .5) * .5); [Sh.hair, Sh.dress, Sh.head].forEach((p) => { c.fillStyle = "#050303"; c.beginPath(); p.forEach((q, j) => (j ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath(); c.fill(); }); }
  c.restore(); T(c, d, "Тень", 1360, 200, ITAL(56), "soft", { p: X.pr(.2, .5) });
};
// сад, который распускается: возвращение к себе
V.bloom = (c, g, d, o, X) => {
  const t = d.t, n = [0, 6, 10, 15][o.grow || 1];
  const W = womanStand(960, 900, 1, 1, Math.sin(t * .4) * .5); silhouette(c, g, d, [W.hair, W.dress, W.head], "bw", "warm", 1); W.legs.forEach((l, i) => S(c, d, l, "bwl" + i, { width: 6, color: "soft" }));
  for (let i = 0; i < n; i++) {
    const r = rng("fl", i), x = i % 2 ? 960 + 220 + r() * 680 : 960 - 220 - r() * 680, hgt = 160 + r() * 280, gp = X.pr(.03 * i, .03 * i + .45); if (gp <= 0) continue;
    const sway = Math.sin(t * .8 + i) * 10, stem = smooth([P(x, 900), P(x + sway * .3 + (r() - .5) * 40, 900 - hgt * .5), P(x + sway, 900 - hgt)], 2, false);
    S(c, d, stem, "st" + i, { width: 3, color: "a2", progress: gp });
    if (gp > .4) { const lf = geo.transform(shape.ellipse(0, 0, 26, 10, { n: 16 }), { x: x + (i % 2 ? 22 : -22), y: 900 - hgt * .45, rot: i % 2 ? -.6 : .6 }); F(c, d, lf, "lf" + i, "a2", { alpha: .7 * prog(gp, .4, .7) }); }
    const bp = ease.out(prog(gp, .7, 1)); if (bp > 0) { const fx2 = x + sway, fy = 900 - hgt, col = [ROSE, "a3", "warm"][i % 3];
      for (let k2 = 0; k2 < 6; k2++) { const a = (k2 / 6) * TAU + t * .05; F(g, d, geo.transform(shape.ellipse(0, -18 * bp, 10 * bp, 18 * bp, { n: 14 }), { x: fx2, y: fy, rot: a }), "pt" + i + k2, col, { alpha: .9 }); }
      F(g, d, circ(fx2, fy, 7 * bp, 10), "pc" + i, "a3"); }
  }
};

/* ---------------------------------------------------------------- сцены для серии лекций (разнообразие видеоряда) */
// женщина сидит в профиль (за столом, на кровати): look 1 — смотрит вправо
function womanSit(cx, seat, s = 1, look = 1) {
  const X = (x) => cx + x * s * look, Y = (y) => seat + y * s;
  const body = smooth([P(X(-40), Y(-300)), P(X(10), Y(-306)), P(X(40), Y(-260)), P(X(46), Y(-150)), P(X(30), Y(-40)), P(X(150), Y(-30)), P(X(170), Y(0)), P(X(160), Y(10)), P(X(-50), Y(10)), P(X(-62), Y(-120)), P(X(-60), Y(-240))], 2);
  const leg = [P(X(160), Y(4)), P(X(170), Y(170))];
  const hx = X(-6), hy = Y(-372);
  const hair = smooth([P(hx - 50 * s * look, hy - 8 * s), P(hx - 40 * s * look, hy - 50 * s), P(hx + 4 * s * look, hy - 64 * s), P(hx + 44 * s * look, hy - 44 * s), P(hx + 30 * s * look, hy - 6 * s), P(hx - 30 * s * look, hy + 60 * s), P(hx - 62 * s * look, hy + 40 * s)], 2);
  return { body, leg, head: circ(hx, hy, 42 * s), hair, hand: P(X(70), Y(-150)), hx, hy };
}
const heartPts = (hx, hy, k) => { const pts = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * TAU; pts.push(P(hx + k * 16 * Math.pow(Math.sin(a), 3), hy - k * (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)))); } return pts; };
function figStand(c, g, d, W, seed, rim = "a3", side = 1) { silhouette(c, g, d, [W.hair, W.dress, W.head], seed, rim, side); W.legs.forEach((l, i) => S(c, d, l, seed + "l" + i, { width: 6, color: "soft" })); }

// Юнг: портрет-силуэт — круглые очки, седина по бокам, усы, трубка с дымом. o.year / o.place — подпись
V.jung = (c, g, d, o, X) => {
  const cx = o.left ? 620 : 960, cy = 470, t = d.t, inP = ease.out(X.in);
  glowDisc(g, cx, cy - 40, 460, "#ffd27a", .16 * inP);
  const sh = smooth([P(cx - 330, 1080), P(cx - 300, 820), P(cx - 180, 740), P(cx - 70, 700), P(cx + 70, 700), P(cx + 180, 740), P(cx + 300, 820), P(cx + 330, 1080)], 2, false);
  F(c, d, sh.concat([P(cx + 330, 1100), P(cx - 330, 1100)]), "jsh", "black", { alpha: inP }); S(c, d, sh, "jsho", { width: 3, color: "soft", progress: inP });
  S(c, d, [P(cx - 70, 700), P(cx, 800), P(cx + 70, 700)], "jcol", { width: 2.6, color: "soft", progress: inP });
  const head = shape.ellipse(cx, cy, 150, 190, { n: 60 }); F(c, d, head, "jh", "black", { alpha: inP }); S(c, d, head, "jho", { width: 3, closed: true, color: "soft", progress: inP });
  S(g, d, head.filter((p) => p.x > cx + 60), "jrim", { width: 3, color: "a3", alpha: .8 * inP });
  // седые волосы по бокам
  [-1, 1].forEach((sd) => { for (let i = 0; i < 6; i++) S(c, d, smooth([P(cx + sd * (120 + i * 6), cy - 120 + i * 18), P(cx + sd * (165 + i * 4), cy - 90 + i * 22), P(cx + sd * (150 + i * 3), cy - 40 + i * 20)], 2, false), "jhr" + sd + i, { width: 2.2, color: "line", alpha: .8, progress: X.pr(.05 + i * .03, .3 + i * .03) }); });
  // очки
  [-1, 1].forEach((sd) => { S(c, d, circ(cx + sd * 62, cy - 10, 44, 36), "jg" + sd, { width: 3.4, closed: true, color: "line", progress: X.pr(.1, .35) }); glowDisc(g, cx + sd * 62, cy - 10, 50, "#ffd27a", .18 * X.pr(.2, .4)); });
  S(c, d, [P(cx - 18, cy - 14), P(cx, cy - 22), P(cx + 18, cy - 14)], "jgb", { width: 3, color: "line", progress: X.pr(.2, .35) });
  S(c, d, smooth([P(cx - 70, cy + 70), P(cx - 30, cy + 58), P(cx, cy + 66), P(cx + 30, cy + 58), P(cx + 70, cy + 70)], 2, false), "jmu", { width: 6, color: "line", progress: X.pr(.25, .4) });
  // трубка и дым
  const px = cx + 40, py = cy + 100; S(c, d, [P(px, py), P(px + 110, py + 30)], "jp", { width: 9, color: "soft", progress: X.pr(.3, .45) }); F(c, d, rrect(px + 130, py + 10, 46, 60, 10), "jpb", "soft", { alpha: X.pr(.4, .5) });
  for (let i = 0; i < 4; i++) { const u = ((t * .18 + i / 4) % 1), x = px + 130 + Math.sin(u * 7 + i) * 30 * u, y = py - 30 - u * 340; S(g, d, circ(x, y, 12 + u * 30, 16), "jsm" + i, { width: 2, color: "a3", closed: true, alpha: (1 - u) * .45 * X.pr(.45, .6) }); }
  if (o.year) { T(c, d, o.year, o.left ? 1380 : 1560, 420, SERIF(120), "line", { p: X.pr(.2, .5) }); T(g, d, o.year, o.left ? 1380 : 1560, 420, SERIF(120), "a3", { a: .3 * X.pr(.3, .6) }); }
  if (o.place) T(c, d, o.place, o.left ? 1380 : 1560, 500, ITAL(44), "soft", { p: X.pr(.35, .65) });
  if (o.name !== false) T(c, d, o.name || "Карл Густав Юнг", cx, 1010, SERIF(40), "a3", { p: X.pr(.4, .7) });
};

// кухня ночью: чашка с паром, лампа, второй стул пустой (o.two — две чашки)
V.tea = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), tableY = 700;
  glowDisc(g, 960, 300, 560, "#ffb547", .2 * inP); S(c, d, [P(960, 0), P(960, 210)], "lc", { width: 2, color: "soft" });
  const lamp = smooth([P(860, 290), P(900, 220), P(1020, 220), P(1060, 290)], 1, false).concat([P(860, 290)]); F(c, d, lamp, "lp", "black", { alpha: inP }); S(g, d, lamp, "lpo", { width: 2.6, closed: true, color: "a3", progress: inP });
  F(g, d, shape.ellipse(960, 292, 90, 10, { n: 30 }), "lpl", "a3", { alpha: .8 * inP });
  S(c, d, [P(420, tableY), P(1500, tableY)], "tb", { width: 6, progress: inP }); S(c, d, [P(500, tableY), P(500, 1080)], "tl1", { width: 5, progress: inP }); S(c, d, [P(1420, tableY), P(1420, 1080)], "tl2", { width: 5, progress: inP });
  const cup = (x, k, seed, steam) => { const body = smooth([P(x - 46, tableY - 90), P(x + 46, tableY - 90), P(x + 40, tableY - 20), P(x + 28, tableY), P(x - 28, tableY), P(x - 40, tableY - 20)], 1); F(c, d, body, seed, "#efe1c8", { alpha: inP * k }); S(c, d, body, seed + "o", { width: 2.6, closed: true, alpha: k }); S(c, d, shape.arc(x + 54, tableY - 56, 22, -1.4, 1.4, 14), seed + "h", { width: 4, alpha: k });
    if (steam) for (let i = 0; i < 3; i++) { const u = ((t * .3 + i / 3) % 1), sx = x - 16 + i * 16 + Math.sin(u * 8 + i) * 12; S(g, d, smooth([P(sx, tableY - 100), P(sx + 12, tableY - 140 - u * 40), P(sx - 6, tableY - 190 - u * 80)], 2, false), seed + "st" + i, { width: 2.4, color: "soft", alpha: (1 - u) * .7 }); } };
  cup(1080, 1, "cup1", true); if (o.two) cup(1300, .8, "cup2", false);
  const W = womanSit(760, tableY + 20, .95, 1); silhouette(c, g, d, [W.hair, W.body, W.head], "tw", "warm", 1); S(c, d, W.leg, "twl", { width: 6, color: "soft" }); S(c, d, [P(W.hand.x - 40, W.hand.y), P(1030, tableY - 60)], "twh", { width: 7, color: "soft" });
  if (o.two) { S(c, d, [P(1400, tableY - 260), P(1400, tableY + 200)], "ch1", { width: 4, color: "soft", alpha: .7 }); S(c, d, [P(1400, tableY - 260), P(1480, tableY - 260)], "ch2", { width: 4, color: "soft", alpha: .7 }); }
  if (o.text) T(c, d, o.text, 1500, 250, HAND(60), "soft", { p: X.pr(.3, .7) });
};

// спальня ночью: кровать, электронные часы (o.time), она сидит на краю
V.night = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in);
  const bed = rrect(1100, 780, 900, 120, 20); F(c, d, bed, "bed", "black", { alpha: inP }); S(c, d, bed, "bedo", { width: 3, closed: true, progress: inP });
  S(c, d, [P(650, 840), P(650, 560)], "bh", { width: 6, progress: inP }); F(c, d, rrect(780, 700, 180, 50, 24), "pil", "soft", { alpha: .5 * inP });
  const tm = o.time || "03:00"; F(c, d, rrect(420, 700, 260, 120, 14), "clk", "black", { alpha: inP }); S(g, d, rrect(420, 700, 260, 120, 14), "clko", { width: 2, closed: true, color: "a3", progress: inP });
  const blink = Math.sin(t * 3) > 0 ? 1 : .35; T(g, d, tm, 420, 735, SANS(80), ROSE, { a: blink * inP }); glowDisc(g, 420, 700, 200, "#e58f98", .2 * inP);
  const W = womanSit(1050, 720, .9, -1); silhouette(c, g, d, [W.hair, W.body, W.head], "nw", "a3", -1); S(c, d, W.leg, "nwl", { width: 6, color: "soft" });
  glowDisc(g, 1500, 220, 200, "#ffe2a8", .25 * inP); F(c, d, circ(1500, 220, 50), "nm", "a3", { alpha: inP }); F(c, d, circ(1522, 206, 46), "nmc", "paper", { alpha: inP });
  if (o.text) { T(c, d, o.text, 1100, 300, HAND(60), "soft", { p: X.pr(.3, .75) }); T(g, d, o.text, 1100, 300, HAND(60), ROSE, { a: .2 * X.pr(.5, .8) }); }
};

// сторис: телефон с полосками историй и «глазом» — кто посмотрел
V.stories = (c, g, d, o, X) => {
  const x = 1240, y = 540, w = 440, h = 830, inP = ease.out(X.in), t = d.t;
  const body = rrect(x, y, w, h, 58); F(c, d, body, "sph", "black", { alpha: inP }); S(c, d, body, "spho", { width: 4, closed: true, progress: inP });
  for (let i = 0; i < 4; i++) { const bx = x - w / 2 + 30 + i * ((w - 60) / 4); S(c, d, [P(bx + 4, y - h / 2 + 40), P(bx + (w - 60) / 4 - 4, y - h / 2 + 40)], "spb" + i, { width: 4, color: i < 2 ? "line" : "guide", sketch: false }); }
  glowDisc(g, x, y - 60, 220, "#ffb547", .25 * inP); F(c, d, circ(x, y - 60, 90), "sps", "a3", { alpha: .7 * inP });
  T(c, d, o.post || "мой вечер ✨", x, y + 120, HAND(54), "line", { p: X.pr(.1, .4) });
  const ep = X.pr(.3, .5); if (ep > 0) { const ex = x - w / 2 + 70, ey = y + h / 2 - 80; S(c, d, shape.ellipse(ex, ey, 26, 15, { n: 24 }), "eye", { width: 2.6, closed: true }); F(c, d, circ(ex, ey, 7), "eyep", "line");
    T(c, d, o.viewer ? `${o.viewer} просмотрел` : "просмотрели: 47", ex + 44, ey + 10, SANS(26, 400), "a3", { align: "left", a: ep }); }
  T(c, d, o.clock || "00:14", 560, 560, SERIF(170), "line", { p: prog(t, X.s, X.s + .9) });
  if (o.text) T(c, d, o.text, 560, 760, HAND(60), "soft", { p: X.pr(.5, .9) });
};

// море ночью: лунная дорожка, волны, фигура на берегу (o.two — двое)
V.sea = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), hor = 520;
  glowDisc(g, 1300, 260, 300, "#ffe2a8", .3 * inP); F(c, d, circ(1300, 260, 70), "sm", "a3", { alpha: inP });
  S(c, d, [P(0, hor), P(1920, hor)], "hor", { width: 2, color: "soft", progress: inP });
  for (let i = 0; i < 14; i++) { const y = hor + 20 + i * i * 2.6, wd = 40 + i * 14, sh = Math.sin(t * 1.4 + i) * 20; S(g, d, [P(1300 - wd + sh, y), P(1300 + wd + sh, y)], "mp" + i, { width: 3, color: "a3", alpha: (1 - i / 14) * .8 * inP, sketch: false }); }
  for (let k = 0; k < 5; k++) { const y = hor + 60 + k * 70, pts = []; for (let i = 0; i <= 40; i++) { const x = i * 48; pts.push(P(x, y + Math.sin(x * .01 + t * 1.2 + k) * 8)); } S(c, d, pts, "wv" + k, { width: 2, color: "soft", alpha: .5, sketch: false }); }
  S(c, d, smooth([P(0, 880), P(600, 860), P(1200, 900), P(1920, 870)], 2, false), "shore", { width: 3, progress: inP });
  const W = womanStand(o.two ? 560 : 700, 890, .75, 1, .3); figStand(c, g, d, W, "sw", "a3", 1);
  if (o.two) { const M = manStand(800, 890, .78, -1); silhouette(c, g, d, [M.body, M.hair, M.head], "sm2", "a3", 1); }
  if (o.text) T(c, d, o.text, 960, 160, ITAL(54), "soft", { p: X.pr(.3, .7) });
};

// дорога к горизонту: она уходит к свету (o.toward) или стоит на развилке (o.fork)
V.road = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), hor = 460;
  glowDisc(g, 960, hor, 520, o.dawn ? "#ff9a5a" : "#ffd27a", .3 * inP);
  S(c, d, [P(0, hor), P(1920, hor)], "rh", { width: 2, color: "soft", progress: inP });
  if (o.fork) { S(c, d, [P(760, 1080), P(940, 640), P(700, hor)], "rf1", { width: 4, progress: inP }); S(c, d, [P(1160, 1080), P(980, 640), P(1220, hor)], "rf2", { width: 4, progress: inP }); S(c, d, [P(940, 640), P(980, 640)], "rf3", { width: 4, progress: inP });
    T(c, d, o.left || "как раньше", 560, 420, HAND(54), "soft", { p: X.pr(.3, .6) }); T(c, d, o.right || "к себе", 1360, 420, HAND(54), "a3", { p: X.pr(.4, .7) }); }
  else { S(c, d, [P(640, 1080), P(940, hor)], "r1", { width: 4, progress: inP }); S(c, d, [P(1280, 1080), P(980, hor)], "r2", { width: 4, progress: inP });
    for (let i = 0; i < 6; i++) { const u = ((i / 6 + t * .05) % 1), y = lerp(1080, hor, Math.pow(u, .6)); S(c, d, [P(960, y), P(960, y + 30 * (1 - u))], "rd" + i, { width: 4, color: "a3", alpha: 1 - u, sketch: false }); } }
  const walk = o.fork ? 0 : X.pr(.1, 1), sc = lerp(.9, .45, walk), y = lerp(1000, 640, walk), W = womanStand(960, y, sc, 1, Math.sin(t * 3) * .3); figStand(c, g, d, W, "rw", "warm", 1);
  if (o.text) T(c, d, o.text, 960, 180, ITAL(56), "soft", { p: X.pr(.3, .7) });
};

// лестница вверх: o.step — сколько ступеней уже светится
V.stairs = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), n = 7, lit = o.step ?? 3;
  for (let i = 0; i < n; i++) { const x = 400 + i * 170, y = 940 - i * 90, on = i < lit; const st = [P(x, y), P(x + 170, y), P(x + 170, y - 90)];
    S(c, d, st, "stp" + i, { width: 4, color: on ? "a3" : "soft", progress: prog(inP, i * .08, .3 + i * .08) }); if (on) { S(g, d, [P(x, y), P(x + 170, y)], "stg" + i, { width: 4, color: "a3", alpha: .7 }); glowDisc(g, x + 85, y - 10, 90, "#ffd27a", .2); } }
  const k = Math.min(lit, n - 1), W = womanStand(400 + k * 170 + 60, 940 - k * 90, .7, 1, .4); figStand(c, g, d, W, "sw", "warm", 1);
  if (o.labels) o.labels.forEach((l, i) => T(c, d, l, 480 + i * 170, 1000 - i * 90, HAND(40), i < lit ? "a3" : "soft", { p: X.pr(.1 + i * .06, .3 + i * .06) }));
  glowDisc(g, 1640, 280, 260, "#ffd27a", .3 * inP); F(g, d, shape.star(1640, 280, 40, 14, 8), "sst", "a3", { alpha: inP });
  if (o.text) T(c, d, o.text, 640, 240, ITAL(56), "soft", { p: X.pr(.3, .7) });
};

// письмо: конверт раскрывается, рукописные строки (o.text — строки через \n, o.from — подпись)
V.letter = (c, g, d, o, X) => {
  const inP = ease.out(X.in), cx = 960, cy = 520, w = 1000, h = 640;
  const paper = rrect(cx, cy, w, h, 10); F(c, d, paper, "lp", "#efe1c8", { alpha: .95 * inP }); S(c, d, paper, "lpo", { width: 2.4, closed: true, progress: inP }); glowDisc(g, cx, cy, 600, "#ffd27a", .12 * inP);
  const lines = (o.text || "").split("\n"); lines.forEach((l, i) => { const p = X.pr(.1 + i * (.6 / lines.length), .1 + (i + 1) * (.6 / lines.length)); T(c, d, l, cx - w / 2 + 80, cy - h / 2 + 130 + i * 76, HAND(56), "#2a1c16", { align: "left", p }); });
  if (o.from) T(c, d, o.from, cx + w / 2 - 80, cy + h / 2 - 60, ITAL(40), "#5a4032", { align: "right", p: X.pr(.75, .9) });
};

// дверь: приоткрыта, из неё свет; o.leave — она уходит в свет, o.close — дверь закрывается
V.door = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), dx = 1000, top = 200, bot = 900, open = o.close ? 1 - X.pr(.2, .7) : .3 + .7 * X.pr(.1, .5);
  const lightW = 360 * open; g.save(); const gr = g.createLinearGradient(dx, 0, dx + lightW + 200, 0); gr.addColorStop(0, Sketch.rgba("#ffd27a", .7 * A)); gr.addColorStop(1, Sketch.rgba("#ffd27a", 0)); g.fillStyle = gr; g.fillRect(dx, top, lightW, bot - top); g.restore();
  g.save(); g.fillStyle = Sketch.rgba("#ffd27a", .12 * A * open); g.beginPath(); g.moveTo(dx, bot); g.lineTo(dx + lightW, bot); g.lineTo(dx + lightW + 500, 1080); g.lineTo(dx - 200, 1080); g.closePath(); g.fill(); g.restore();
  S(c, d, [P(dx, bot), P(dx, top), P(dx + 360, top), P(dx + 360, bot)], "dfr", { width: 6, progress: inP });
  const leaf = [P(dx, top), P(dx - 260 * open, top + 40 * open), P(dx - 260 * open, bot + 30 * open), P(dx, bot)]; F(c, d, leaf, "dlf", "black", { alpha: inP }); S(c, d, leaf, "dlo", { width: 3, closed: true, progress: inP });
  const walk = o.leave ? X.pr(.3, 1) : 0, W = womanStand(lerp(620, dx + 180, walk), bot, lerp(.95, .7, walk), 1, .2); figStand(c, g, d, W, "dw", "warm", 1);
  if (o.text) T(c, d, o.text, 520, 260, ITAL(54), "soft", { p: X.pr(.3, .7) });
};

// скамейка в парке: двое, между ними расстояние (o.gap) или рядом (o.close); листья падают
V.bench = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), by = 800, gap = o.close ? 0 : (o.gap ?? 1);
  S(c, d, [P(560, by), P(1360, by)], "bs", { width: 8, progress: inP }); S(c, d, [P(560, by - 120), P(1360, by - 120)], "bb", { width: 6, progress: inP }); [600, 1320].forEach((x, i) => S(c, d, [P(x, by), P(x, by + 120)], "bl" + i, { width: 6, progress: inP }));
  S(c, d, [P(1600, 960), P(1600, 300)], "lpp", { width: 5 }); glowDisc(g, 1600, 290, 260, "#ffd27a", .3 * inP); F(g, d, circ(1600, 290, 26), "lpb", "a3", { alpha: inP });
  const W = womanSit(760 - gap * 60, by - 6, .8, 1), M = womanSit(1180 + gap * 60, by - 6, .85, -1);
  silhouette(c, g, d, [W.hair, W.body, W.head], "bw", "a3", 1); S(c, d, W.leg, "bwl", { width: 6, color: "soft" });
  silhouette(c, g, d, [M.body, circ(M.hx, M.hy, 40)], "bm", "a3", -1); S(c, d, M.leg, "bml", { width: 6, color: "soft" });
  if (o.close) glowDisc(g, 960, 560, 200 * (1 + .06 * Math.sin(t * 2)), "#ffb547", .35 * inP);
  for (let i = 0; i < 10; i++) { const r = rng("lf", i), u = ((t * (.05 + r() * .05) + r()) % 1), x = 200 + r() * 1500 + Math.sin(u * 12 + i) * 40, y = -40 + u * 1120; F(g, d, geo.transform(shape.ellipse(0, 0, 12, 6, { n: 12 }), { x, y, rot: u * 9 + i }), "lf" + i, i % 3 ? "warm" : ROSE, { alpha: .8 }); }
  if (o.text) T(c, d, o.text, 960, 260, HAND(60), "soft", { p: X.pr(.3, .7) });
};

// весы: что ты отдаёшь и что получаешь (o.left, o.right, o.tilt: -1 — перевес влево)
V.scale = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), cx = 960, py = 300, tilt = (o.tilt ?? 1) * .22 * ease.inOut(X.pr(.2, .7)) + Math.sin(t * 1.5) * .01;
  S(c, d, [P(cx, 900), P(cx, py)], "spl", { width: 6, progress: inP }); S(c, d, [P(cx - 160, 900), P(cx + 160, 900)], "spb", { width: 6, progress: inP });
  const L = P(cx - Math.cos(tilt) * 420, py - Math.sin(tilt) * 420), R = P(cx + Math.cos(tilt) * 420, py + Math.sin(tilt) * 420);
  S(c, d, [L, R], "beam", { width: 5 }); F(g, d, circ(cx, py, 14), "pv", "a3");
  [[L, o.left || "я", "sl"], [R, o.right || "он", "sr"]].forEach(([p, lab, sd]) => { S(c, d, [p, P(p.x - 120, p.y + 220)], sd + "1", { width: 2, color: "soft" }); S(c, d, [p, P(p.x + 120, p.y + 220)], sd + "2", { width: 2, color: "soft" });
    const pan = shape.arc(p.x, p.y + 220, 130, 0, Math.PI, 20); S(c, d, pan, sd + "p", { width: 4 }); T(c, d, lab, p.x, p.y + 330, HAND(64), sd === "sl" ? "a3" : "line", { p: X.pr(.2, .5) }); });
  if (o.text) T(c, d, o.text, 960, 180, ITAL(52), "soft", { p: X.pr(.4, .8) });
};

// сердце: o.crack — трещина, o.mend — золотые швы (кинцуги), o.text — подпись
V.heart = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), k = 18 * (1 + .03 * Math.sin(t * 2.4)), hp = heartPts(960, 520, k);
  glowDisc(g, 960, 480, 420, o.crack && !o.mend ? "#e58f98" : "#ffb547", .25 * inP);
  F(c, d, hp, "ht", "black", { alpha: inP }); S(c, d, hp, "hto", { width: 4, closed: true, progress: inP }); S(g, d, hp, "htg", { width: 3, closed: true, color: o.mend ? "a3" : ROSE, alpha: .6, progress: inP });
  if (o.crack || o.mend) { const cr = [P(960, 330), P(920, 420), P(990, 500), P(930, 590), P(980, 700), P(960, 760)]; S(o.mend ? g : c, d, cr, "hcr", { width: o.mend ? 6 : 4, color: o.mend ? "a3" : ROSE, progress: X.pr(.1, .5), wobble: .3 }); if (o.mend) cr.forEach((p, i) => glowDisc(g, p.x, p.y, 40, "#ffd27a", .4 * X.pr(.3 + i * .05, .5 + i * .05))); }
  if (o.text) T(c, d, o.text, 960, 940, ITAL(58), "line", { p: X.pr(.3, .7) });
};

// дом из сна Юнга: этажи — чердак, гостиная, подвал, пещера (o.level — подсвеченный этаж 0..3)
V.house = (c, g, d, o, X) => {
  const inP = ease.out(X.in), cx = 960, fl = [[200, "чердак"], [380, "гостиная"], [560, "подвал"], [760, "пещера"]], lv = o.level ?? 2;
  S(c, d, [P(cx - 360, 200), P(cx, 60), P(cx + 360, 200)], "roof", { width: 5, progress: inP });
  fl.forEach(([y, name], i) => { const h = i === 3 ? 200 : 180, box = i === 3 ? smooth([P(cx - 300, y), P(cx + 300, y), P(cx + 260, y + h), P(cx - 260, y + h)], 2) : rrect(cx, y + h / 2, 720, h, 4);
    F(c, d, box, "fl" + i, i === lv ? "#2a1c16" : "black", { alpha: inP }); S(c, d, box, "flo" + i, { width: 3, closed: true, color: i === lv ? "a3" : "soft", progress: prog(inP, i * .15, .4 + i * .15) });
    if (i === lv) glowDisc(g, cx, y + h / 2, 300, "#ffd27a", .3 * X.pr(.2, .5)); T(c, d, name, cx + 470, y + h / 2 + 14, ITAL(44), i === lv ? "a3" : "soft", { align: "left", p: X.pr(.1 + i * .1, .3 + i * .1) }); });
  if (lv === 3) for (let i = 0; i < 2; i++) S(g, d, circ(cx - 60 + i * 120, 860, 34, 24), "sk" + i, { width: 3, color: "line", closed: true, alpha: X.pr(.4, .6) });
  const sx = cx - 200, sy0 = 200; for (let i = 0; i < 4; i++) S(c, d, [P(sx + i * 30, sy0 + 180 * i + 160), P(sx + i * 30 + 30, sy0 + 180 * i + 160)], "sts" + i, { width: 3, color: "soft", alpha: .7 });
  if (o.text) T(c, d, o.text, 960, 1010, HAND(56), "soft", { p: X.pr(.4, .8) });
};

// треугольник: в центре мужчина, по бокам две женщины, светящиеся нити (o.names — подписи)
V.triangle = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), nm = o.names || ["жена", "он", "другая"];
  const W1 = womanStand(480, 920, .9, 1, .2), M = manStand(960, 900, .95, 1), W2 = womanStand(1440, 920, .9, -1, -.2);
  figStand(c, g, d, W1, "t1", "a3", 1); silhouette(c, g, d, [M.body, M.hair, M.head], "tm", "a3", 1); figStand(c, g, d, W2, "t2", ROSE, -1);
  const a = P(W1.hx + 40, W1.hy + 140), b = P(M.hx, M.hy - 120), e = P(W2.hx - 40, W2.hy + 140);
  [[a, b, "ab"], [b, e, "be"], [a, e, "ae"]].forEach(([p, q, sd], i) => S(g, d, smooth([p, P((p.x + q.x) / 2, (p.y + q.y) / 2 - 40 + Math.sin(t * 2 + i) * 10), q], 2, false), "tl" + sd, { width: 2.6, color: i === 2 ? "soft" : "a3", progress: X.pr(.1 + i * .1, .4 + i * .1), alpha: i === 2 ? .5 : .9 }));
  [[W1.hx, nm[0]], [M.hx, nm[1]], [W2.hx, nm[2]]].forEach(([x, s2], i) => T(c, d, s2, x, 1010, ITAL(44), i === 2 ? ROSE : "a3", { p: X.pr(.3 + i * .1, .5 + i * .1) }));
};

// богиня-архетип: силуэт и её символ (o.kind: artemis, athena, hera, demeter, persephone, aphrodite, hestia)
const GODDESS = { artemis: "Артемида", athena: "Афина", hera: "Гера", demeter: "Деметра", persephone: "Персефона", aphrodite: "Афродита", hestia: "Гестия" };
V.goddess = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), k = o.kind || "aphrodite", W = womanStand(760, 920, 1.05, 1, .2), sx = 1300, sy = 480, sp = X.pr(.15, .5);
  glowDisc(g, sx, sy, 300, k === "persephone" ? "#e58f98" : "#ffd27a", .25 * inP); figStand(c, g, d, W, "gw", k === "aphrodite" || k === "persephone" ? "warm" : "a3", 1);
  if (k === "artemis") { S(c, d, shape.arc(sx, sy, 160, -1.2, 1.2, 30), "bow", { width: 5, color: "a3", progress: sp }); S(c, d, [P(sx + 56, sy - 150), P(sx + 56, sy + 150)], "bs", { width: 2, color: "line", progress: sp }); S(c, d, [P(sx - 120, sy), P(sx + 160, sy)], "ar", { width: 3, color: "line", progress: sp }); F(c, d, circ(sx - 40, sy - 230, 40), "moon", "a3", { alpha: sp }); }
  if (k === "athena") { F(c, d, shape.ellipse(sx, sy, 90, 120, { n: 40 }), "owl", "black", { alpha: sp }); S(c, d, shape.ellipse(sx, sy, 90, 120, { n: 40 }), "owlo", { width: 3, closed: true, color: "a3", progress: sp }); [-1, 1].forEach((s2) => { S(g, d, circ(sx + s2 * 36, sy - 30, 26, 24), "oe" + s2, { width: 3, closed: true, color: "a3", progress: sp }); F(g, d, circ(sx + s2 * 36, sy - 30, 8), "oep" + s2, "a3", { alpha: sp }); }); S(c, d, [P(sx - 50, sy - 120), P(sx - 70, sy - 160)], "oh1", { width: 3, color: "a3" }); S(c, d, [P(sx + 50, sy - 120), P(sx + 70, sy - 160)], "oh2", { width: 3, color: "a3" }); }
  if (k === "hera") { const cr = [P(sx - 140, sy + 60), P(sx - 140, sy - 60), P(sx - 70, sy), P(sx, sy - 100), P(sx + 70, sy), P(sx + 140, sy - 60), P(sx + 140, sy + 60)]; F(g, d, cr, "crown", "a3", { alpha: sp }); S(c, d, cr, "crowno", { width: 3, closed: true, progress: sp }); }
  if (k === "demeter") for (let i = 0; i < 5; i++) { const x = sx - 120 + i * 60; S(c, d, [P(x, sy + 200), P(x + 10, sy - 120)], "wh" + i, { width: 3, color: "a3", progress: sp }); for (let j = 0; j < 5; j++) F(g, d, geo.transform(shape.ellipse(0, 0, 8, 18, { n: 12 }), { x: x + 10 + (j % 2 ? 10 : -10), y: sy - 110 + j * 26, rot: j % 2 ? .5 : -.5 }), "gr" + i + j, "a3", { alpha: sp }); }
  if (k === "persephone") { const pm = circ(sx, sy, 120, 40); F(c, d, pm, "pom", "#7a1f2b", { alpha: sp }); S(g, d, pm, "pomo", { width: 3, closed: true, color: ROSE, progress: sp }); for (let i = 0; i < 12; i++) { const r = rng("sd", i); F(g, d, circ(sx - 60 + r() * 120, sy - 40 + r() * 100, 8, 10), "sd" + i, ROSE, { alpha: sp }); } }
  if (k === "aphrodite") { const hp = heartPts(sx, sy, 9 * (1 + .04 * Math.sin(t * 3))); F(g, d, hp, "ah", ROSE, { alpha: sp }); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * .1; F(g, d, geo.transform(shape.ellipse(0, -30, 14, 30, { n: 14 }), { x: sx + Math.cos(a) * 200, y: sy + Math.sin(a) * 200, rot: a + Math.PI / 2 }), "ap" + i, "warm", { alpha: sp * .8 }); } }
  if (k === "hestia") { for (let i = 0; i < 6; i++) S(c, d, [P(sx - 140 + i * 56, sy + 180), P(sx - 110 + i * 46, sy + 130)], "hl" + i, { width: 6, color: "soft", progress: sp }); const fl = 1 + Sketch.noise1(t * 3, 2) * .3; F(g, d, smooth([P(sx - 80, sy + 130), P(sx - 30, sy - 40 * fl), P(sx, sy - 160 * fl), P(sx + 40, sy - 40 * fl), P(sx + 80, sy + 130)], 2), "hf", "warm", { alpha: sp }); glowDisc(g, sx, sy, 260, "#ffb547", .4 * sp); }
  T(c, d, GODDESS[k], sx, 840, SERIF(76), "line", { p: X.pr(.2, .5) }); T(g, d, GODDESS[k], sx, 840, SERIF(76), "a3", { a: .3 * X.pr(.3, .6) });
  if (o.text) T(c, d, o.text, sx, 920, ITAL(42), "soft", { p: X.pr(.35, .7) });
};

// календарь: дни зачёркиваются (o.days — сколько прошло, o.title — подпись)
V.calendar = (c, g, d, o, X) => {
  const inP = ease.out(X.in), cx = 960, cy = 520, n = o.days ?? 7, cols = 7;
  const card = rrect(cx, cy, 900, 600, 20); F(c, d, card, "cal", "black", { alpha: .9 * inP }); S(g, d, card, "calo", { width: 2.4, closed: true, color: "a3", progress: inP });
  T(c, d, o.title || "без него", cx, cy - 220, SERIF(56), "line", { p: X.pr(0, .2) });
  for (let i = 0; i < 28; i++) { const x = cx - 360 + (i % cols) * 120, y = cy - 120 + Math.floor(i / cols) * 100, q = X.pr(.1 + i * .02, .16 + i * .02);
    T(c, d, String(i + 1), x, y + 14, SANS(34, 400), i < n ? "soft" : "line", {});
    if (i < n && q > 0) S(g, d, [P(x - 30, y - 24), P(x + 30, y + 26)], "cx" + i, { width: 4, color: i === n - 1 ? "a3" : ROSE, progress: q }); }
  if (o.text) T(c, d, o.text, cx, cy + 360, HAND(56), "a3", { p: X.pr(.6, .9) });
};

// маска (Персона): лицо-маска в руке, за ней — настоящее лицо (o.off — маска снимается)
V.mask = (c, g, d, o, X) => {
  const t = d.t, inP = ease.out(X.in), W = womanStand(720, 920, 1.05, 1, 0), off = o.off ? ease.inOut(X.pr(.2, .7)) : 0;
  figStand(c, g, d, W, "mw", off > .5 ? "warm" : "a3", 1);
  const mx = lerp(W.hx + 10, W.hx + 360, off), my = lerp(W.hy, W.hy + 160, off), mk = shape.ellipse(mx, my, 54, 70, { n: 40 });
  F(c, d, mk, "mk", "#efe1c8", { alpha: inP }); S(c, d, mk, "mko", { width: 3, closed: true, progress: inP });
  [-1, 1].forEach((s2) => F(c, d, shape.ellipse(mx + s2 * 20, my - 12, 12, 7, { n: 14 }), "me" + s2, "black", { alpha: inP }));
  S(c, d, shape.arc(mx, my + 22, 22, .3, Math.PI - .3, 12), "mm", { width: 3, color: "black" });
  if (off > .5) glowDisc(g, W.hx, W.hy, 120, "#ffb547", .4 * (off - .5) * 2);
  T(c, d, o.text || "Персона", 1300, 360, ITAL(60), "a3", { p: X.pr(.2, .5) });
};

// фото в рамке: двое на снимке, o.torn — снимок разорван пополам
V.photo = (c, g, d, o, X) => {
  const inP = ease.out(X.in), cx = 960, cy = 500, tear = o.torn ? ease.inOut(X.pr(.3, .7)) * 60 : 0;
  [[-1, "pl"], [1, "pr"]].forEach(([sd, seed]) => { c.save(); c.translate(sd * tear, sd * tear * .3); c.rotate(sd * tear * .002);
    const half = sd < 0 ? [P(cx - 380, cy - 280), P(cx + 10, cy - 280), P(cx - 10, cy - 100), P(cx + 15, cy + 60), P(cx - 5, cy + 280), P(cx - 380, cy + 280)] : [P(cx + 10, cy - 280), P(cx + 380, cy - 280), P(cx + 380, cy + 280), P(cx - 5, cy + 280), P(cx + 15, cy + 60), P(cx - 10, cy - 100)];
    F(c, d, half, seed, "#efe1c8", { alpha: inP }); S(c, d, half, seed + "o", { width: 3, closed: true, progress: inP }); c.restore(); });
  const W = womanStand(cx - 120 - tear, cy + 250, .55, 1, .3), M = manStand(cx + 120 + tear, cy + 250, .55, -1);
  [W.hair, W.dress, W.head].forEach((p, i) => F(c, d, p, "pw" + i, "#3a2a26", { alpha: inP })); [M.body, M.hair, M.head].forEach((p, i) => F(c, d, p, "pm" + i, "#3a2a26", { alpha: inP }));
  if (o.text) T(c, d, o.text, cx, 900, HAND(60), "soft", { p: X.pr(.4, .8) });
};

// список: заголовок и до 7 пунктов, пункты проявляются, текущий (o.at) горит
V.list = (c, g, d, o, X) => {
  const items = o.items || [], at = o.at ?? items.length, y0 = 300, step = Math.min(96, 560 / Math.max(1, items.length));
  T(c, d, o.title || "", 960, 200, SERIF(84), "line", { p: X.pr(0, .2) }); T(g, d, o.title || "", 960, 200, SERIF(84), "a3", { a: .25 });
  items.forEach((it, i) => { const y = y0 + i * step + 40, q = o.at != null ? 1 : X.pr(.1 + i * .08, .2 + i * .08), on = i === at - 1 || (o.at == null);
    if (q <= 0) return; F(g, d, circ(520, y - 14, 10, 12), "ld" + i, i < at ? "a3" : "guide", { alpha: q });
    T(c, d, it, 560, y, i === at - 1 ? SERIF(52) : SERIF(44), i === at - 1 ? "line" : i < at ? "soft" : "guide", { align: "left", p: q }); if (i === at - 1) T(g, d, it, 560, y, SERIF(52), "a3", { align: "left", a: .3 }); void on; });
};

// своя мысль крупно (не цитата Юнга): рукописная фраза по центру, строки через \n
V.phrase = (c, g, d, o, X) => {
  const lines = String(o.text || '').split('\n'), y0 = 520 - (lines.length - 1) * 55; glowDisc(g, 960, 500, 460, o.rose ? "#e58f98" : "#ffd27a", .14 * X.in);
  lines.forEach((l, i) => { const p = X.pr(i * .15, .3 + i * .15); T(c, d, l, 960, y0 + i * 110, HAND(96), "line", { p }); T(g, d, l, 960, y0 + i * 110, HAND(96), o.rose ? ROSE : "a3", { a: .3 * p }); });
  c.font = HAND(96); const w = Math.max(...lines.map((l) => c.measureText(l).width)); S(g, d, shape.wave(960 - w / 2, y0 + lines.length * 110 - 50, 960 + w / 2, 4, Math.max(3, Math.round(w / 120))), "phw", { width: 2.4, color: "a3", progress: X.pr(.4, .8) });
};
// крупная цифра или слово с подписью: «65%», «3 ночи», «40»
V.big = (c, g, d, o, X) => {
  const p = X.pr(0, .4), cx = 960; glowDisc(g, cx, 460, 420, o.rose ? "#e58f98" : "#ffd27a", .2 * X.in);
  T(c, d, o.text, cx, 560, SERIF(o.size || 260), "line", { p }); T(g, d, o.text, cx, 560, SERIF(o.size || 260), o.rose ? ROSE : "a3", { a: .35 * p });
  if (o.sub) T(c, d, o.sub, cx, 700, ITAL(56), "soft", { p: X.pr(.3, .7) });
};

/* ---------------------------------------------------------------- подписи, частицы, кадр */
function caption(d, i, a) {
  const b = LEC.beats[i]; if (!b.cap) return; const t0 = PH[i].s + .2, p = prog(d.t, t0, t0 + .8);
  d.screen(d.ink, (c) => { const sv = A; A = a; T(c, d, b.cap, 960, 1000, SERIF(58), "line", { p }); c.font = SERIF(58); const w = c.measureText(b.cap).width; S(c, d, shape.wave(960 - w / 2, 1024, 960 + w / 2, 4, Math.max(3, Math.round(w / 110))), "cw" + i, { width: 2.2, color: "a3", progress: prog(d.t, t0 + .5, t0 + 1.1) }); A = sv; });
}
function particles(d) {
  d.screen(d.glow, (g) => { for (let i = 0; i < 46; i++) { const r = rng("bok", i), sp = 8 + r() * 22, x = (r() * 2100 + Math.sin(d.t * .2 + i) * 30) - 90, y = 1100 - ((r() * 1200 + d.t * sp) % 1250), rad = 2 + r() * 5, tw = .35 + .65 * (0.5 + 0.5 * Math.sin(d.t * (.6 + r()) + i));
    g.fillStyle = Sketch.rgba(i % 5 ? "#ffd27a" : "#e58f98", .5 * tw); g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); } });
}
function brand(d) { d.screen(d.ink, (c) => { const sv = A; A = .55; T(c, d, "ПОДВАЛ РАЗУМА", 60, 70, SERIF(26), "soft", { align: "left" }); T(c, d, "психология Юнга", 60, 104, ITAL(22), "soft", { align: "left" }); A = sv; }); }

function drawBeat(d, i, a) {
  if (i < 0 || i >= N) return;
  const b = LEC.beats[i], s = PH[i].s, du = PH[i].d, X = { s, at: (f) => s + f * du, pr: (f0, f1) => prog(d.t, s + f0 * du, s + f1 * du), in: prog(d.t, s - .3, s + .9) };
  A = a; (V[b.v] || (() => {}))(d.ink, d.glow, d, b.o || {}, X); caption(d, i, a); A = 1;
}

Sketch.mount({
  palette: "dusk",
  fonts: ["600 80px Lora", "italic 400 80px Lora", "700 80px Caveat", "800 80px Inter", "400 80px Inter"],
  camera: (t) => { let i = 0; while (i + 1 < N && t >= bStart(i + 1)) i++; const u = prog(t, bStart(i), bStart(i + 1)); return { fx: 960 + Math.sin(t * .13) * 14, fy: 540 + Math.sin(t * .17) * 8, zoom: 1.0 + .045 * ease.inOut(u), rot: Math.sin(t * .09) * .003, shake: .2 }; },
  draw(d) {
    let i = 0; while (i + 1 < N && d.t >= bStart(i + 1)) i++;
    const fade = prog(d.t, bStart(i), bStart(i) + .55);
    if (i > 0 && fade < 1) drawBeat(d, i - 1, 1 - fade);
    drawBeat(d, i, 1);
    particles(d); brand(d);
  },
  post(M) { // виньетка
    const g = M.createRadialGradient(960, 540, 420, 960, 540, 1150); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.55)"); M.fillStyle = g; M.fillRect(0, 0, 1920, 1080);
  },
});
