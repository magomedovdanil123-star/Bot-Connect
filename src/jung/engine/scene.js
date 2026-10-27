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
  T(c, d, o.side === "him" || o.side === "mix" ? "Андрей" : "Андрей", x - 104, hy - 2, SANS(32), "line", { align: "left" });
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
  if (o.read) { T(c, d, "что я сделала не так?", 560, 800, HAND(68), "line", { p: X.pr(.74, .95) }); T(g, d, "что я сделала не так?", 560, 800, HAND(68), ROSE, { a: .25 * X.pr(.8, 1) }); }
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
  T(c, d, "7 перемен", 960, 250, SERIF(120), "line", { p: X.pr(0, .2) }); T(g, d, "7 перемен", 960, 250, SERIF(120), "a3", { a: .3 });
  const pts = ROMAN.map((_, i) => P(360 + i * 200, 600 - Math.sin((i / 6) * Math.PI) * 140));
  S(g, d, smooth(pts, 3, false), "path7", { width: 2, color: "a3", progress: X.pr(.05, .6), alpha: .6 });
  pts.forEach((p, i) => { const q = X.pr(.12 + i * .09, .2 + i * .09); if (q <= 0) return; const on = ease.pop(q);
    F(c, d, circ(p.x, p.y, 62 * on), "c7" + i, "black"); S(c, d, circ(p.x, p.y, 62 * on), "c7o" + i, { width: 3, closed: true, color: "a3" }); glowDisc(g, p.x, p.y, 120, "#ffd27a", .2 * q);
    T(c, d, ROMAN[i], p.x, p.y + 18, SERIF(50), "a3");
    T(c, d, o.reveal === 2 ? NAMES[i] : "?", p.x, p.y + 130, o.reveal === 2 ? SERIF(34) : HAND(70), o.reveal === 2 ? "line" : "soft", { p: q }); });
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
  if (o.n) { T(c, d, "перемена", cx, 300, ITAL(40), "soft", { p: prog(p, .1, .5) }); T(c, d, ROMAN[o.n - 1], cx, 450, SERIF(150), "line", { p: prog(p, .2, .7) }); T(g, d, ROMAN[o.n - 1], cx, 450, SERIF(150), "a3", { a: .4 * p }); }
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
