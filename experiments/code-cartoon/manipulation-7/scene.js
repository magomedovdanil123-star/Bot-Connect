/* ============================================================================
 * «7 приёмов манипуляции» — премиальная версия выпуска №1003 на движке code-cartoon.
 * Голос — готовая озвучка выпуска; все времена берутся из timing.js (фразы диктора), звук — из cues.js.
 * 11 миров (палитр): карандаш → тетрадь → чертёж → крафт → неон → коллаж → мел → ретро-печать → лубок → тушь → карандаш.
 * Сквозной образ — ниточки кукловода: каждый приём привязывает к Саше ещё одну, в главе «Как защититься» он их режет.
 * Внутри мира — две-три «площадки» (сцена и опыт), камера проезжает между ними; между мирами — ирис.
 * ==========================================================================*/
const { pen, shape, geo, ease, prog, lerp, clamp, rng, fx } = Sketch;
const ST = window.STORY, TM = window.TM, AREA = ST.area;
const P = (x, y) => ({ x, y }), TAU = Math.PI * 2, R = (a) => (a * Math.PI) / 180;
const circ = (x, y, r, n = 44) => shape.ellipse(x, y, r, r, { n });
const AT = (n, l = 0, f = 0) => { const p = TM.PH[TM.SI[n] + l]; return p.s + f * p.d; };
const GY = 880;                       // линия пола
const FONT = (px, w = 700) => `${w} ${px}px Caveat`;
const INTER = (px) => `800 ${px}px Inter`;

/* ------------------------------------------------------------ стили миров */
// fill: как закрашивать тела — hatch (штриховка), flat (печать), piece (рваная бумага), fill (маркер)
const STYLE = {
  intro: { fill: "hatch" }, w1: { fill: "fill" }, w2: { fill: "hatch", lw: .8 }, w3: { fill: "hatch" }, w4: { fill: "hatch", glow: true },
  w5: { fill: "piece" }, w6: { fill: "hatch", lw: 1.25 }, w7: { fill: "flat" }, w8: { fill: "flat" }, w9: { fill: "hatch" }, w10: { fill: "hatch" },
};
let W = null; // текущий мир (ставит draw мира)
// Саша во всех мирах одного цвета — синий; на синей и тёмной бумаге светлее
const HERO = { w2: "#9fd4ff", w4: "#5aa9ff", w6: "#9fd3f2" };

/* ---------------------------------------------------------------- позы */
// углы в градусах от «вниз»: 90 — вперёд (куда смотрит), 180 — вверх, отрицательные — назад
const POSES = {
  stand: { fa: [12, 6], ba: [-12, -6] }, wave: { fa: [145, 175], ba: [-12, -6], wave: 1 }, cross: { fa: [28, -78], ba: [-28, 78] },
  shrug: { fa: [42, 128], ba: [-42, -128] }, point: { fa: [86, 90], ba: [-12, -6] }, pointup: { fa: [55, 168], ba: [-12, -6] },
  talk: { fa: [48, 100], ba: [-14, -8] }, explain: { fa: [55, 108], ba: [-48, -104] }, facepalm: { fa: [28, 168], ba: [-12, -6], head: 12 },
  scared: { fa: [72, 162], ba: [-72, -162] }, cheer: { fa: [152, 168], ba: [-152, -168] }, think: { fa: [22, 152], ba: [-6, 70] },
  sad: { fa: [4, 0], ba: [-4, 0], head: 16 }, give: { fa: [72, 82], ba: [-12, -6] }, hold: { fa: [38, 92], ba: [-12, -6] },
  phone: { fa: [26, 168], ba: [-12, -6] }, angry: { fa: [38, -32], ba: [-38, 32] },
  sit: { fa: [40, 80], ba: [20, 70], sit: 1 }, sitphone: { fa: [32, 135], ba: [24, 80], sit: 1 }, sitwork: { fa: [62, 92], ba: [52, 88], sit: 1 },
};
const LEGS = { fl: [6, 0], bl: [-6, 0] }, SITLEGS = { fl: [88, 6], bl: [84, 2] };

/* ------------------------------------------------------------ состояние героя */
function beatsOf(n, id) {
  const sh = ST.sheets[n];
  return sh.beats.filter((b) => b.who === id).map((b) => ({ ...b, t: AT(n, b.l, b.f) })).sort((a, b) => a.t - b.t);
}
function figState(n, c, t) {
  const s = { x: c.x, pose: c.pose || "stand", prev: c.pose || "stand", pt: -99, face: c.face || "neutral", look: c.look || 1, hold: c.hold || null,
    fx: null, fxT: -99, walk: 0, wphase: 0 };
  for (const b of beatsOf(n, c.id)) {
    if (b.t > t) break;
    if (b.walk != null || b.run != null) {
      const to = b.walk ?? b.run, sp = b.run != null ? 950 : 430, dur = Math.abs(to - s.x) / sp;
      if (t < b.t + dur) { const u = (t - b.t) / dur; s.look = Math.sign(to - s.x) || s.look; s.walk = 1; s.wphase = (t - b.t) * (b.run != null ? 15 : 9); s.x = lerp(s.x, to, u); }
      else { s.look = c.look || Math.sign(to - s.x) || 1; s.x = to; }
    }
    if (b.pose) { s.prev = s.pose; s.pose = b.pose; s.pt = b.t; }
    if (b.face) s.face = b.face;
    if (b.look) s.look = b.look;
    if ("hold" in b) s.hold = b.hold;
    if (b.fx) { s.fx = b.fx; s.fxT = b.t; }
  }
  return s;
}

/* ---------------------------------------------------------------- герой */
function limb(o, a1, a2, l1, l2, look) {
  const p1 = P(o.x + Math.sin(R(a1)) * l1 * look, o.y + Math.cos(R(a1)) * l1);
  const p2 = P(p1.x + Math.sin(R(a2)) * l2 * look, p1.y + Math.cos(R(a2)) * l2);
  return [o, p1, p2];
}
function fillBody(c, poly, k, seed, role) {
  const st = (W && STYLE[W.id]) || STYLE.intro;
  if (st.fill === "flat") pen.flat(c, poly, { k, seed, color: role, outline: 0 });
  else if (role === "paper") { // халат учёного: светлый на тёмной бумаге и наоборот
    if (Sketch.pal.shade === "dark") pen.hatch(c, poly, { k, seed, color: "line", spacing: 7, width: 2, alpha: .7, tint: .22, angle: -.9 });
    else { pen.flat(c, poly, { k, seed, color: "paper", outline: 0 }); pen.hatch(c, poly, { k, seed: seed + "s", color: "soft", spacing: 11, width: 1.6, alpha: .35, angle: -.9 }); } }
  else if (st.fill === "piece") fx.piece(c, poly, { color: role, shadow: 8 });
  else if (st.fill === "fill") pen.fill(c, poly, { k, seed, color: role, alpha: .85 });
  else pen.hatch(c, poly, { k, seed, color: role, spacing: 6.5, width: 2.4, alpha: .95, tint: role === "paper" ? .9 : .35, angle: -.9 });
}
/** рисует человечка. o: { x, s, look, pose, prev, pt, face, role, coat, glasses, tie, hold, seed, t, k, appear(0..1), walk, wphase, fx, fxT } */
function fig(c, d, o) {
  const k = d.k, t = d.t, S = o.s || 1.12, L = o.look || 1, sd = o.seed, lw = 5.2 * S * (((W && STYLE[W.id]) || {}).lw || 1);
  const ap = o.appear ?? 1; if (ap <= 0) return null;
  const A = POSES[o.pose] || POSES.stand, B = POSES[o.prev] || A, u = ease.out(prog(t, o.pt, o.pt + .3));
  const mixA = (key) => [lerp((B[key] || A[key])[0], A[key][0], u), lerp((B[key] || A[key])[1], A[key][1], u)];
  let fa = mixA("fa"), ba = mixA("ba");
  const sit = lerp(B.sit || 0, A.sit || 0, u), headDrop = lerp(B.head || 0, A.head || 0, u);
  if (A.wave) fa = [fa[0], fa[1] + Math.sin(t * 13) * 16];
  let lx = o.x, jy = 0;
  if (o.fx === "shake" && t - o.fxT < .55) lx += Math.sin(t * 70) * 7 * (1 - (t - o.fxT) / .55);
  if (o.fx === "jump" && t - o.fxT < .5) jy = -Math.sin(((t - o.fxT) / .5) * Math.PI) * 46 * S;
  const idle = Math.sin(t * 1.7 + (o.x % 7)) * 2.2 * S;                // дыхание
  const hip = P(lx, GY - lerp(150, 112, sit) * S + jy + idle * .3), neck = P(lx + L * 4 * S, hip.y - 132 * S + idle);
  const head = P(neck.x + L * 3 * S, neck.y - 50 * S + headDrop * .6 * S), hr = 45 * S, sh = P(neck.x, neck.y + 14 * S);
  // ноги
  let fl = [lerp(LEGS.fl[0], SITLEGS.fl[0], sit), lerp(LEGS.fl[1], SITLEGS.fl[1], sit)], bl = [lerp(LEGS.bl[0], SITLEGS.bl[0], sit), lerp(LEGS.bl[1], SITLEGS.bl[1], sit)];
  if (o.walk) { const w = Math.sin(o.wphase) * 26; fl = [w, w - 8]; bl = [-w, -w - 8]; fa = [fa[0] - w * .6, fa[1] - w * .6]; ba = [ba[0] + w * .6, ba[1] + w * .6]; }
  const LEGF = limb(P(hip.x + L * 8 * S, hip.y), fl[0], fl[1], 74 * S, 72 * S, L), LEGB = limb(P(hip.x - L * 8 * S, hip.y), bl[0], bl[1], 74 * S, 72 * S, L);
  const ARMF = limb(P(sh.x + L * 6 * S, sh.y), fa[0], fa[1], 66 * S, 62 * S, L), ARMB = limb(P(sh.x - L * 6 * S, sh.y), ba[0], ba[1], 66 * S, 62 * S, L);
  const pr = (a, b) => ease.inOut(clamp((ap - a) / (b - a)));
  const st = { k, seed: sd, width: lw, color: "line" };
  // задние конечности
  pen.stroke(c, LEGB, { ...st, seed: sd + "lb", progress: pr(.35, .6) });
  pen.stroke(c, ARMB, { ...st, seed: sd + "ab", progress: pr(.45, .7) });
  // туловище-капсула
  const tw = 34 * S, top = neck.y + 4 * S, bot = hip.y + 18 * S, tx = (neck.x + hip.x) / 2;
  const body = [];
  for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; body.push(P(tx + Math.cos(a) * tw, top + 28 * S + Math.sin(a) * 28 * S)); }
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI; body.push(P(tx + Math.cos(a) * tw, bot - 28 * S + Math.sin(a) * 28 * S)); }
  if (ap > .2) fillBody(c, body, k, sd + "bf", o.role || "a1");
  pen.stroke(c, body, { ...st, seed: sd + "b", closed: true, progress: pr(.05, .35) });
  if (o.coat && ap > .4) { // халат: лацканы и карман
    pen.stroke(c, [P(tx - L * 12 * S, top + 8 * S), P(tx, top + 52 * S), P(tx + L * 14 * S, top + 8 * S)], { ...st, width: lw * .7, seed: sd + "lap" });
    pen.stroke(c, [P(tx, top + 52 * S), P(tx, bot - 6 * S)], { ...st, width: lw * .55, seed: sd + "zip" });
    pen.stroke(c, shape.rect(tx + L * 8 * S, top + 70 * S, 18 * S * L, 16 * S), { ...st, width: lw * .5, seed: sd + "pk", closed: true });
  }
  if (o.tie && ap > .4) pen.flat(c, [P(tx, top + 6 * S), P(tx + 9 * S, top + 18 * S), P(tx + 4 * S, top + 70 * S), P(tx, top + 80 * S), P(tx - 4 * S, top + 70 * S), P(tx - 9 * S, top + 18 * S)], { k, seed: sd + "tie", color: "a2", outline: 2.2 });
  pen.stroke(c, LEGF, { ...st, seed: sd + "lf", progress: pr(.35, .6) });
  // голова
  const hp = pr(0, .3);
  if (hp > .5) pen.flat(c, circ(head.x, head.y, hr - 1), { color: "paper", outline: 0 });
  pen.stroke(c, circ(head.x, head.y, hr), { ...st, seed: sd + "h", closed: true, progress: hp });
  if (ap > .5) face(c, d, head, hr, L, o);
  pen.stroke(c, ARMF, { ...st, seed: sd + "af", progress: pr(.45, .75) });
  const hand = ARMF[2];
  if (o.hold && ap > .8) ICON[o.hold] && ICON[o.hold](c, d, hand.x + L * 10 * S, hand.y - 6 * S, S * .9, L, sd + o.hold);
  // реакция над головой
  if ((o.fx === "!" || o.fx === "?") && t - o.fxT < 1.1) {
    const q = ease.pop(clamp((t - o.fxT) / .3)), a = 1 - prog(t, o.fxT + .8, o.fxT + 1.1);
    pen.text(c, o.fx, head.x + L * 30 * S, head.y - hr - 22 * S, { k, font: FONT(Math.round(90 * q * S)), color: "a2", alpha: a });
  }
  return { head, hr, hand, handB: ARMB[2], hip, knee: LEGF[1], S, L };
}
function face(c, d, h, r, L, o) {
  const k = d.k, t = d.t, S = r / 45, ex = h.x + L * 9 * S, ey = h.y - 5 * S, st = { k, color: "line", sketch: false, taper: false, wobble: .5 };
  const f = o.face || "neutral";
  const blink = (Math.floor(t / 3.3 + (o.x % 5)) !== Math.floor((t - .12) / 3.3 + (o.x % 5))) && f !== "scared" && f !== "surprised";
  [-1, 1].forEach((s) => {
    const x = ex + s * 15 * S, y = ey;
    if (blink || f === "happy") pen.stroke(c, shape.arc(x, y + (f === "happy" ? 3 * S : 0), 7 * S, R(200), R(340), 8), { ...st, seed: o.seed + "eh" + s, width: 3.4 * S });
    else if (f === "surprised" || f === "scared") { pen.stroke(c, circ(x, y, 8 * S, 16), { ...st, seed: o.seed + "eo" + s, width: 2.6 * S, closed: true }); pen.flat(c, circ(x + L * 1.5 * S, y + 1, 3.2 * S, 10), { color: "line", outline: 0 }); }
    else if (f === "smug" && s === -1) pen.stroke(c, [P(x - 7 * S, y), P(x + 7 * S, y)], { ...st, seed: o.seed + "es", width: 3.4 * S });
    else pen.flat(c, circ(x, y, 4.6 * S, 12), { color: "line", outline: 0 });
    // брови
    const by = y - 15 * S;
    if (f === "angry") pen.stroke(c, [P(x - 9 * S * s * L * -1, by - 5 * S), P(x + 9 * S * s * L * -1, by + 4 * S)], { ...st, seed: o.seed + "br" + s, width: 3.2 * S });
    else if (f === "sad" || f === "scared") pen.stroke(c, [P(x - 9 * S * s, by + 4 * S), P(x + 9 * S * s, by - 4 * S)], { ...st, seed: o.seed + "br" + s, width: 3 * S });
    else if (f === "smug" && s === 1) pen.stroke(c, shape.arc(x, by + 6 * S, 10 * S, R(200), R(330), 8), { ...st, seed: o.seed + "br" + s, width: 3 * S });
    else if (f === "surprised") pen.stroke(c, shape.arc(x, by + 4 * S, 9 * S, R(210), R(330), 8), { ...st, seed: o.seed + "br" + s, width: 3 * S });
  });
  if (o.glasses) { [-1, 1].forEach((s) => pen.stroke(c, circ(ex + s * 15 * S, ey, 12.5 * S, 20), { ...st, seed: o.seed + "gl" + s, width: 2.6 * S, closed: true })); pen.stroke(c, [P(ex - 3 * S, ey), P(ex + 3 * S, ey)], { ...st, seed: o.seed + "glb", width: 2.4 * S }); }
  const mx = ex, my = h.y + 21 * S;
  if (f === "happy") pen.stroke(c, shape.arc(mx, my - 8 * S, 15 * S, R(25), R(155), 12), { ...st, seed: o.seed + "m", width: 3.6 * S });
  else if (f === "sad") pen.stroke(c, shape.arc(mx, my + 10 * S, 13 * S, R(205), R(335), 12), { ...st, seed: o.seed + "m", width: 3.4 * S });
  else if (f === "surprised") pen.stroke(c, shape.ellipse(mx, my, 7 * S, 9 * S, { n: 16 }), { ...st, seed: o.seed + "m", width: 3 * S, closed: true });
  else if (f === "scared") pen.stroke(c, shape.wave(mx - 13 * S, my, mx + 13 * S, 3 * S, 2), { ...st, seed: o.seed + "m", width: 3 * S });
  else if (f === "smug") pen.stroke(c, [P(mx - 12 * S, my + 2 * S), P(mx + 2 * S, my + 3 * S), P(mx + 13 * S, my - 5 * S)], { ...st, seed: o.seed + "m", width: 3.4 * S });
  else if (f === "angry") pen.stroke(c, [P(mx - 11 * S, my + 4 * S), P(mx + 11 * S, my + 2 * S)], { ...st, seed: o.seed + "m", width: 3.6 * S });
  else pen.stroke(c, [P(mx - 10 * S, my + 1 * S), P(mx + 10 * S, my + 1 * S)], { ...st, seed: o.seed + "m", width: 3.2 * S });
}

/* ---------------------------------------------------------------- предметы в руках и иконки */
const ln = (c, k, pts, seed, o = {}) => pen.stroke(c, pts, { k, seed, width: 4, color: "line", ...o });
const ICON = {
  clip(c, d, x, y, s, L, sd) { const r = shape.rect(x - 26 * s, y - 40 * s, 52 * s, 70 * s); pen.flat(c, r, { k: d.k, seed: sd, color: "paper", outline: 3 }); for (let i = 0; i < 3; i++) ln(c, d.k, [P(x - 16 * s, y - 18 * s + i * 16 * s), P(x + 16 * s, y - 18 * s + i * 16 * s)], sd + i, { width: 2.2, color: "soft" }); pen.flat(c, shape.rect(x - 12 * s, y - 46 * s, 24 * s, 10 * s), { color: "line", outline: 0 }); },
  pen(c, d, x, y, s, L, sd) { ln(c, d.k, [P(x - 4 * s, y + 18 * s), P(x + 16 * s * L, y - 26 * s)], sd, { width: 6 * s, color: "a3" }); },
  cup(c, d, x, y, s, L, sd) { const r = [P(x - 20 * s, y - 30 * s), P(x + 20 * s, y - 30 * s), P(x + 15 * s, y + 18 * s), P(x - 15 * s, y + 18 * s)]; pen.flat(c, r, { k: d.k, seed: sd, color: "warm", outline: 3 });
    for (let i = 0; i < 2; i++) { const pts = []; for (let j = 0; j < 6; j++) pts.push(P(x - 6 * s + i * 12 * s + Math.sin(d.t * 3 + j * 1.3 + i) * 5 * s, y - 36 * s - j * 7 * s)); ln(c, d.k, pts, sd + "st" + i, { width: 2.4, color: "soft" }); } },
  ticket(c, d, x, y, s, L, sd) { [0, 1].forEach((i) => { const r = geo.transform(shape.rect(-30 * s, -18 * s, 60 * s, 36 * s), { x: x + i * 10 * s, y: y - 10 * s - i * 8 * s, rot: -.2 + i * .25 }); pen.flat(c, r, { k: d.k, seed: sd + i, color: "a2", outline: 2.6 }); }); },
  phone(c, d, x, y, s, L, sd) { pen.flat(c, shape.rect(x - 15 * s, y - 32 * s, 30 * s, 56 * s), { k: d.k, seed: sd, color: "line", outline: 0 }); pen.flat(c, shape.rect(x - 11 * s, y - 27 * s, 22 * s, 42 * s), { color: "a3", alpha: .8, outline: 0 }); },
  cola(c, d, x, y, s, L, sd) { const b = [P(x - 6 * s, y - 52 * s), P(x + 6 * s, y - 52 * s), P(x + 8 * s, y - 32 * s), P(x + 16 * s, y - 18 * s), P(x + 16 * s, y + 24 * s), P(x - 16 * s, y + 24 * s), P(x - 16 * s, y - 18 * s), P(x - 8 * s, y - 32 * s)];
    pen.flat(c, b, { k: d.k, seed: sd, color: "line", outline: 2.6 }); pen.flat(c, shape.rect(x - 16 * s, y - 6 * s, 32 * s, 14 * s), { color: "a2", outline: 0 }); },
  cookie(c, d, x, y, s, L, sd) { pen.flat(c, circ(x, y - 4 * s, 22 * s, 20), { k: d.k, seed: sd, color: "warm", outline: 2.6 }); [[-7, -10], [8, -2], [-3, 6]].forEach(([a, b], i) => pen.flat(c, circ(x + a * s, y - 4 * s + b * s, 3.5 * s, 8), { color: "line", outline: 0 })); },
  money(c, d, x, y, s, L, sd) { [0, 1, 2].forEach((i) => { const r = geo.transform(shape.rect(-34 * s, -18 * s, 68 * s, 36 * s), { x: x + i * 6 * s, y: y - 8 * s - i * 6 * s, rot: -.15 + i * .12 }); pen.flat(c, r, { k: d.k, seed: sd + i, color: "a3", outline: 2.4 }); }); pen.text(c, "₽", x + 12 * s, y + 4 * s, { k: d.k, font: FONT(Math.round(34 * s)), color: "paper" }); },
  loupe(c, d, x, y, s, L, sd) { ln(c, d.k, [P(x, y + 10 * s), P(x + 22 * s * L, y - 22 * s)], sd + "h", { width: 8 * s, color: "line" }); pen.stroke(c, circ(x + 42 * s * L, y - 44 * s, 30 * s, 28), { k: d.k, seed: sd, width: 5 * s, closed: true, color: "line" }); pen.hatch(c, circ(x + 42 * s * L, y - 44 * s, 26 * s, 24), { k: d.k, seed: sd + "g", color: "a1", alpha: .4, spacing: 7, tint: .12 }); },
};

/* ---------------------------------------------------------------- облачка */
function bubbles(c, d, n, figs) {
  const sh = ST.sheets[n], t = d.t, end = TM.sheetEnd[n] - .25, list = [];
  sh.beats.forEach((b) => { if (b.say || b.think) list.push({ who: b.who, text: b.say || b.think, think: !!b.think, t0: AT(n, b.l, b.f) }); });
  list.sort((a, b) => a.t0 - b.t0);
  const shown = list.filter((b) => b.t0 <= t);
  shown.forEach((b, i) => {
    const f = figs[b.who]; if (!f) return;
    let t1 = end;
    for (const nb of list) if (nb.t0 > b.t0 && nb.t0 <= t1 && (nb.who === b.who || Math.abs(figs[nb.who] ? figs[nb.who].head.x - f.head.x : 0) < 1150)) { t1 = nb.t0; break; }
    if (t > t1 + .25) return;
    const a = 1 - prog(t, t1, t1 + .25), q = ease.pop(prog(t, b.t0, b.t0 + .28));
    const ctx = c, font = FONT(48), m = (ctx.font = font, ctx.measureText(b.text).width);
    const w = Math.min(760, m + 56), h = 82, side = f.head.x < 960 ? 1 : -1;
    let cx = f.head.x + side * Math.min(140, w / 2 - 40); const cy = f.head.y - f.hr - 92;
    cx = clamp(cx, w / 2 + 30, 1920 - w / 2 - 30);
    const sc = .6 + .4 * q, bw = w * sc, bh = h * sc;
    const box = []; const rr = 30 * sc;
    for (let j = 0; j <= 40; j++) { const u = j / 40, a2 = u * TAU; box.push(P(cx + Math.cos(a2) * (bw / 2) * (1 + .08 * Math.cos(a2 * 2)), cy + Math.sin(a2) * (bh / 2) * (1 + .1 * Math.sin(a2 * 3)))); }
    void rr;
    pen.flat(ctx, box, { k: d.k, seed: "bb" + n + i, color: "paper", outline: 3.2, alpha: a, lineAlpha: a });
    if (b.think) [[.55, 13], [.8, 8]].forEach(([u, r], j) => { const x = lerp(cx, f.head.x, u), y = lerp(cy + bh / 2, f.head.y - f.hr, u); pen.flat(ctx, circ(x, y, r * sc, 14), { k: d.k, seed: "bt" + n + i + j, color: "paper", outline: 2.6, alpha: a, lineAlpha: a }); });
    else { const tx = lerp(cx, f.head.x, .35); pen.flat(ctx, [P(tx - 16, cy + bh / 2 - 6), P(tx + 16, cy + bh / 2 - 6), P(lerp(tx, f.head.x, .6), f.head.y - f.hr - 10)], { k: d.k, seed: "btl" + n + i, color: "paper", outline: 3, alpha: a, lineAlpha: a });
      pen.flat(ctx, shape.rect(tx - 15, cy + bh / 2 - 12, 30, 9), { color: "paper", outline: 0, alpha: a }); }
    if (q > .5) pen.text(ctx, b.text, cx, cy + 16, { k: d.k, font, color: b.think ? "soft" : "line", alpha: a, progress: prog(t, b.t0 + .1, b.t0 + .1 + Math.min(.7, b.text.length * .03)) });
  });
}

/* ---------------------------------------------------------------- ниточки кукловода */
// сколько ниточек уже висит на Саше к моменту t (до перерезания)
const caughtN = (t) => TM.caught.filter((x) => x && x <= t).length;
function strings(c, d, f, opts = {}) {
  if (!f) return;
  const t = d.t, list = [];
  const pts = [f.hand, f.handB, P(f.head.x, f.head.y - f.hr), f.hand, f.handB, f.knee, P(f.head.x + 8, f.head.y - f.hr)];
  for (let i = 1; i <= 7; i++) {
    const tc = opts.preview ? opts.preview[i - 1] : TM.caught[i];
    if (tc == null || t < tc) continue;
    const drop = ease.out(prog(t, tc, tc + .5)), a = pts[i - 1], topX = a.x + (i - 4) * 14 + Math.sin(t * .9 + i) * 6;
    let lift = 0, fall = 0, cutX = null;
    if (opts.cutAt != null) { const tcut = opts.cutAt + .25 + (i - 1) * .2; if (t >= tcut) { cutX = 1; fall = ease.in(prog(t, tcut, tcut + .7)); lift = ease.out(prog(t, tcut, tcut + .5)); } }
    if (opts.lift != null) lift = ease.inOut(prog(t, opts.lift, opts.lift + .8));
    const y0 = -200, yEnd = lerp(y0, a.y, drop);
    const fresh = t - tc < 1.6 && opts.cutAt == null;
    const role = fresh ? "warm" : "soft", ctx = fresh && W && STYLE[W.id] && STYLE[W.id].glow ? d.glow : c;
    if (cutX == null) {
      ln(ctx, d.k, [P(topX, y0 - lift * 900), P(lerp(topX, a.x, .5) + Math.sin(t * 2 + i) * 4, lerp(y0, yEnd, .5) - lift * 900), P(a.x, yEnd - lift * 900)], "str" + i, { width: fresh ? 3.4 : 2.2, color: role, wobble: .8, sketch: false });
    } else {
      const cy = 200;
      ln(c, d.k, [P(topX, y0 - lift * 700), P(topX, cy - lift * 700)], "stru" + i, { width: 2.2, color: "soft", alpha: 1 - lift, sketch: false });
      ln(c, d.k, [P(topX, cy + fall * 300), P(a.x, a.y)], "strd" + i, { width: 2.2, color: "soft", alpha: 1 - fall, sketch: false });
    }
    if (fresh && drop > .9) { const q = ease.pop(prog(t, tc + .45, tc + .75)); pen.flat(c, circ(topX, 120, 26 * q, 20), { k: d.k, seed: "tag" + i, color: "warm", outline: 3 }); pen.text(c, String(i), topX, 134, { k: d.k, font: INTER(Math.round(30 * q)), color: "paper" }); }
    list.push(i);
  }
  return list;
}

/* ---------------------------------------------------------------- общие рисовалки */
const T = (c, d, s, x, y, px, o = {}) => pen.text(c, s, x, y, { k: d.k, font: o.inter ? INTER(px) : FONT(px), color: o.color || "line", align: o.align, progress: o.p ?? 1, alpha: o.a ?? 1, maxWidth: o.maxWidth });
const rectPts = (x, y, w, h) => shape.rect(x, y, w, h);
function bar(c, d, x, base, w, hMax, val, t0, label, o = {}) {
  const t = d.t, g = ease.out(prog(t, t0, t0 + 1.1)), h = hMax * val / 100 * g; if (prog(t, t0 - .4, t0) <= 0) return;
  pen.stroke(c, [P(x - w / 2 - 20, base), P(x + w / 2 + 20, base)], { k: d.k, seed: "bb" + label, width: 3.4, progress: prog(t, t0 - .4, t0) });
  if (h > 2) { const r = rectPts(x - w / 2, base - h, w, h);
    if (o.flat) pen.flat(c, r, { k: d.k, seed: "bf" + label, color: o.color || "a1", outline: 3 });
    else { pen.fill(c, r, { k: d.k, seed: "bf" + label, color: o.color || "a1", style: o.zig ? "zigzag" : undefined }); pen.stroke(c, r, { k: d.k, seed: "bo" + label, width: 3.4, closed: true }); } }
  if (g > 0) T(c, d, Math.round(val * g) + "%", x, base - h - 22, 84, { inter: true, color: o.numColor || "line" });
  T(c, d, label, x, base + 62, 46, { p: prog(t, t0 - .2, t0 + .4), color: "soft" });
}
function chapterCard(d, w) {
  if (!w.ch) return;
  const t = d.t, t0 = w.from + .35, [n, name] = w.ch, mv = ease.inOut(prog(t, t0 + 2.4, t0 + 3.1));
  d.screen(d.ink, (c) => {
    c.font = FONT(44); const wn = c.measureText(name).width;
    const fr = w.id === "w8" ? 56 : 0, big = 1 - mv, x = lerp(960, 60 + fr + wn / 2, mv), y = lerp(150, 70 + fr, mv), al = lerp(1, .9, mv) * (1 - prog(t, TM.sheetStart[20], TM.sheetStart[20] + .4));
    if (n) T(c, d, "ПРИЁМ " + n + " ИЗ 7", x, y - lerp(82, 26, mv), Math.round(lerp(40, 22, mv)), { inter: true, color: "soft", p: prog(t, t0, t0 + .4), a: al });
    T(c, d, name, x, y + lerp(20, 8, mv), Math.round(lerp(104, 44, mv)), { color: "line", p: prog(t, t0 + .2, t0 + 1.1), a: al });
    if (big > .05) pen.stroke(c, shape.wave(960 - 300, y + 50, 960 + 300, 6, 5), { k: d.k, seed: "chu" + w.id, width: 4, color: "warm", progress: prog(t, t0 + .7, t0 + 1.3), alpha: big });
  });
}
function hud(d, w) {
  const t = d.t; if (w.id === "intro" || t > TM.sheetStart[20]) return;
  const fr = w.id === "w8" ? 56 : 0;
  d.screen(d.ink, (c) => {
    const n = caughtN(t), x0 = 1590 - fr;
    T(c, d, "НИТОЧКИ", x0 + 132, 46 + fr, 26, { inter: true, color: "soft" });
    for (let i = 1; i <= 7; i++) {
      const x = x0 + (i - 1) * 44, y = 84 + fr, on = i <= n, cutT = TM.cut + .25 + (i - 1) * .2, freed = t >= cutT;
      pen.stroke(c, circ(x, y, 15, 18), { k: d.k, seed: "hd" + i, width: 2.6, closed: true, color: freed ? "a3" : "soft" });
      if (freed) pen.stroke(c, [P(x - 8, y), P(x - 2, y + 7), P(x + 9, y - 8)], { k: d.k, seed: "hk" + i, width: 3.4, color: "a3" });
      else if (on) { const q = ease.pop(prog(t, TM.caught[i] + .5, TM.caught[i] + .8)); pen.flat(c, circ(x, y, 11 * q, 14), { color: "warm", outline: 0 }); }
    }
  });
}
function bottomText(d, n) {
  const sh = ST.sheets[n]; if (!sh.show) return;
  const t = d.t, t0 = AT(n, sh.show.l, sh.show.f), t1 = TM.sheetEnd[n] - .3; if (t < t0 || t > t1 + .3) return;
  const a = 1 - prog(t, t1, t1 + .3);
  d.screen(d.ink, (c) => {
    c.font = FONT(64); const w = c.measureText(sh.show.text).width;
    const plate = rectPts(960 - w / 2 - 40, 965, w + 80, 92);
    pen.flat(c, plate, { k: d.k, seed: "pl" + n, color: "paper", outline: 0, alpha: .82 * a });
    T(c, d, sh.show.text, 960, 1032, 64, { color: "a2", p: prog(t, t0, t0 + .7), a });
    pen.stroke(c, shape.wave(960 - w / 2, 1048, 960 + w / 2, 4, Math.max(3, Math.round(w / 120))), { k: d.k, seed: "plw" + n, width: 3.2, color: "warm", progress: prog(t, t0 + .5, t0 + 1), alpha: a });
  });
}

/* ---------------------------------------------------------------- декорации */
const door = (c, d, x, s = 1) => { const r = rectPts(x - 110, GY - 430, 220, 430); pen.hatch(c, r, { k: d.k, seed: "dr" + x, color: "soft", spacing: 14, alpha: .5 }); pen.stroke(c, r, { k: d.k, seed: "do" + x, width: 5, closed: true }); pen.flat(c, circ(x - 70, GY - 210, 10), { color: "line", outline: 0 }); };
const windowF = (c, d, x, y) => { const r = rectPts(x - 120, y - 110, 240, 220); pen.stroke(c, r, { k: d.k, seed: "wn" + x, width: 4.5, closed: true }); ln(c, d.k, [P(x, y - 110), P(x, y + 110)], "wn1" + x, { width: 3 }); ln(c, d.k, [P(x - 120, y), P(x + 120, y)], "wn2" + x, { width: 3 }); };
const floor = (c, d, x0, x1, seed) => ln(c, d.k, [P(x0, GY + 2), P(x1, GY - 2)], "fl" + seed, { width: 3.2, color: "soft" });
const table = (c, d, x, w = 320, y = GY - 150) => { pen.flat(c, rectPts(x - w / 2, y - 14, w, 22), { k: d.k, seed: "tb" + x, color: "warm", outline: 3.6 }); ln(c, d.k, [P(x - w / 2 + 24, y + 8), P(x - w / 2 + 24, GY)], "tl1" + x, { width: 5 }); ln(c, d.k, [P(x + w / 2 - 24, y + 8), P(x + w / 2 - 24, GY)], "tl2" + x, { width: 5 }); };
const chair = (c, d, x, L = 1) => { ln(c, d.k, [P(x, GY - 300), P(x, GY)], "ch1" + x, { width: 5 }); ln(c, d.k, [P(x, GY - 118), P(x - L * 110, GY - 118), P(x - L * 110, GY)], "ch2" + x, { width: 5 }); };
const laptop = (c, d, x, y) => { pen.flat(c, [P(x - 70, y), P(x + 70, y), P(x + 84, y + 12), P(x - 84, y + 12)], { k: d.k, seed: "lp" + x, color: "soft", outline: 3 }); pen.flat(c, [P(x - 62, y), P(x - 76, y - 92), P(x + 56, y - 92), P(x + 62, y)], { k: d.k, seed: "ls" + x, color: "a1", outline: 3, alpha: .8 }); };
const sofa = (c, d, x) => { const b = [P(x - 230, GY - 120), P(x + 230, GY - 120), P(x + 230, GY - 40), P(x - 230, GY - 40)]; pen.flat(c, rectPts(x - 250, GY - 250, 500, 140), { k: d.k, seed: "sb" + x, color: "a3", outline: 4, alpha: .55 }); pen.flat(c, b, { k: d.k, seed: "ss" + x, color: "a3", outline: 4, alpha: .75 }); ln(c, d.k, [P(x - 220, GY - 40), P(x - 220, GY)], "sl1", { width: 6 }); ln(c, d.k, [P(x + 220, GY - 40), P(x + 220, GY)], "sl2", { width: 6 }); };
function box3(c, d, x, y, w, h, seed, p = 1, role = "a1") { // ящик в изометрии (чертёж)
  const dx = w * .22, dy = -h * .22, f = rectPts(x - w / 2, y - h / 2, w, h);
  pen.stroke(c, f, { k: d.k, seed: seed + "f", width: 3, closed: true, progress: p, color: "line" });
  pen.stroke(c, [P(x - w / 2, y - h / 2), P(x - w / 2 + dx, y - h / 2 + dy), P(x + w / 2 + dx, y - h / 2 + dy), P(x + w / 2 + dx, y + h / 2 + dy), P(x + w / 2, y + h / 2)], { k: d.k, seed: seed + "t", width: 3, progress: prog(p, .4, 1), color: "line" });
  ln(c, d.k, [P(x + w / 2, y - h / 2), P(x + w / 2 + dx, y - h / 2 + dy)], seed + "e", { width: 3, progress: prog(p, .6, 1) });
  pen.hatch(c, f, { k: d.k, seed: seed + "h", color: role, spacing: 12, angle: .78, alpha: .5, jitter: 1, progress: prog(p, .5, 1) });
}
function dim(c, d, x0, y0, x1, y1, label, p, seed) { // размерная линия чертежа
  if (p <= 0) return; const a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * 14, ny = Math.cos(a) * 14;
  ln(c, d.k, [P(x0, y0), P(x1, y1)], seed, { width: 2, progress: p, wobble: .4, color: "a2" });
  [[x0, y0, 1], [x1, y1, -1]].forEach(([x, y, s], i) => ln(c, d.k, [P(x + Math.cos(a) * 18 * s + nx * .6, y + Math.sin(a) * 18 * s + ny * .6), P(x, y), P(x + Math.cos(a) * 18 * s - nx * .6, y + Math.sin(a) * 18 * s - ny * .6)], seed + "a" + i, { width: 2, progress: p, wobble: .3, color: "a2" }));
  T(c, d, label, (x0 + x1) / 2 + nx * 2.4, (y0 + y1) / 2 + ny * 2.4 + 10, 30, { inter: true, color: "a2", p });
}
const tornCard = (c, d, x, y, w, h, seed, role, rot = 0) => { const jit = rng("tc", seed, Math.floor(d.k / 2)); const r = jit.range(-.012, .012); fx.piece(c, geo.transform(shape.torn(-w / 2, -h / 2, w, h, seed, 9), { x, y, rot: rot + r }), { color: role, shadow: 12 }); };

/* ---------------------------------------------------------------- рисование листа */
function drawSheet(d, n, extra = {}) {
  const sh = ST.sheets[n], ox = (sh.area || 0) * AREA, t = d.t, c = d.ink;
  const vis = t > TM.sheetStart[n] - 1.6 && t < TM.sheetEnd[n] + 1.6; if (!vis) return null;
  const X = { n, ox, t, k: d.k, at: (l, f) => AT(n, l, f), pr: (l0, f0, l1, f1) => prog(t, AT(n, l0, f0), AT(n, l1, f1)), c, g: d.glow };
  c.save(); d.glow.save(); c.translate(ox, 0); d.glow.translate(ox, 0);
  try {
    if (PROPS[n]) PROPS[n](c, d, X);
    const figs = {};
    sh.cast.forEach((cc, j) => {
      const st = figState(n, cc, t), t0 = cc.l != null ? AT(n, cc.l, cc.f || 0) : Math.max(TM.sheetStart[n], -.9) + .1 + j * .25;
      const role = cc.id === "s" ? (HERO[W.id] || "#3f86d6") : cc.role;
      figs[cc.id] = fig(c, d, { ...cc, ...st, role, s: (cc.s || 1) * 1.12, seed: "f" + n + cc.id, appear: n === 0 ? prog(t, -.9, .4) : prog(t, t0, t0 + 1.0) });
    });
    if (FRONT[n]) FRONT[n](c, d, X, figs);
    if (figs.s && extra.strings !== false) strings(c, d, figs.s, extra.strOpts || {});
    bubbles(c, d, n, Object.fromEntries(Object.entries(figs).filter(([, v]) => v)));
    return figs;
  } finally { c.restore(); d.glow.restore(); }
}

/* ---------------------------------------------------------------- реквизит по листам */
const PROPS = {}, FRONT = {};
// 0 — вступление: Саша рисуется по конструкции, сверху крестовина кукловода и 7 ниточек
PROPS[0] = (c, d, X) => {
  const g = prog(d.t, -1, .3), fade = prog(d.t, .6, 1.6);
  pen.guide(c, circ(960, 438, 52), { k: d.k, seed: "g0", progress: g, fade }); pen.guide(c, shape.line(960, 380, 960, GY), { k: d.k, seed: "g1", progress: g, fade });
  pen.guide(c, shape.line(760, GY, 1160, GY), { k: d.k, seed: "g2", progress: g, fade });
  floor(c, d, 500, 1420, "0");
  const cp = prog(d.t, X.at(1, .3), X.at(1, .55)), lift = ease.inOut(prog(d.t, X.at(2, .75), X.at(2, 1) + .6));
  if (cp > 0) { const y = 70 - lift * 400; ln(c, d.k, [P(820, y), P(1100, y)], "cr1", { width: 8, progress: cp }); ln(c, d.k, [P(960, y - 50), P(960, y + 60)], "cr2", { width: 8, progress: cp }); }
};
FRONT[0] = (c, d, X, f) => {
  const s0 = X.at(1, .55), pv = [0, 1, 2, 3, 4, 5, 6].map((i) => s0 + i * .16);
  if (f.s) strings(c, d, f.s, { preview: pv, lift: X.at(2, .75) });
  T(c, d, "7", 1300, 380, 220, { inter: true, color: "a2", p: X.pr(1, .55, 1, .9), a: 1 - X.pr(2, .7, 2, 1) });
  T(c, d, "раз за день", 1300, 450, 56, { color: "soft", p: X.pr(1, .7, 1, 1), a: 1 - X.pr(2, .7, 2, 1) });
};
// 1 — 7 приёмов, седьмой под замком
PROPS[1] = (c, d, X) => {
  T(c, d, "7 ПРИЁМОВ МАНИПУЛЯЦИИ", 1080, 150, 108, { p: X.pr(0, 0, 0, .35) });
  pen.stroke(c, shape.wave(640, 178, 1520, 7, 7), { k: d.k, seed: "t1u", width: 5, color: "warm", progress: X.pr(0, .3, 0, .45) });
  const p = X.pr(0, .35, 0, .7), x = 1300, y = 520;
  box3(c, d, x, y, 380, 290, "safe", p, "soft");
  T(c, d, "№7", x, y + 30, 150, { inter: true, color: "a2", p: X.pr(0, .5, 0, .8) });
  const sh = Math.sin(d.t * 40) * 6 * (1 - X.pr(0, .45, 0, .6)) * X.pr(0, .43, 0, .45);
  pen.stroke(c, shape.arc(x + sh, y - 175, 46, R(180), R(360), 18), { k: d.k, seed: "lk", width: 9, progress: X.pr(0, .6, 0, .8) });
  pen.flat(c, rectPts(x - 64 + sh, y - 182, 128, 96), { k: d.k, seed: "lkb", color: "warm", outline: 4, alpha: X.pr(0, .65, 0, .7) });
  for (let i = 0; i < 3; i++) T(c, d, "?", x - 250 + i * 250, y - 230 + (i % 2) * 40 + Math.sin(d.t * 2 + i) * 8, 90, { color: "soft", p: X.pr(0, .7 + i * .05, 0, .8 + i * .05) });
  const ip = X.pr(1, .2, 1, .6);
  if (ip > 0) { // колба и график — «всё из экспериментов»
    const fx0 = 760, fy = 330;
    pen.stroke(c, [P(fx0 - 14, fy - 60), P(fx0 - 14, fy - 10), P(fx0 - 50, fy + 50), P(fx0 + 50, fy + 50), P(fx0 + 14, fy - 10), P(fx0 + 14, fy - 60)], { k: d.k, seed: "fl", width: 4, progress: ip });
    pen.fill(c, [P(fx0 - 32, fy + 22), P(fx0 + 32, fy + 22), P(fx0 + 50, fy + 50), P(fx0 - 50, fy + 50)], { k: d.k, seed: "flf", color: "a3", progress: ip });
    pen.stroke(c, [P(820, 520), P(820, 640), P(1000, 640)], { k: d.k, seed: "ax", width: 3.6, progress: ip });
    pen.stroke(c, [P(830, 620), P(880, 590), P(930, 600), P(990, 530)], { k: d.k, seed: "gr", width: 4, color: "a2", progress: prog(ip, .4, 1) });
  }
};
// 2 — нога в двери
PROPS[2] = (c, d, X) => { floor(c, d, -40, 1960, "2"); door(c, d, 1680); windowF(c, d, 1110, 360); };
FRONT[2] = (c, d, X) => {
  const p = X.pr(2, 0, 2, .25); if (p <= 0) return;
  const x = 1090, y = 470; pen.flat(c, geo.transform(rectPts(-110, -150, 220, 300), { x, y, rot: .05 }), { k: d.k, seed: "ctr", color: "paper", outline: 3.6, alpha: p });
  T(c, d, "ДОГОВОР", x, y - 92, 38, { inter: true, p }); for (let i = 0; i < 4; i++) ln(c, d.k, [P(x - 80, y - 50 + i * 30), P(x + 80, y - 50 + i * 30)], "ctl" + i, { width: 2, color: "soft", progress: p });
  T(c, d, "40 000 ₽", x, y + 112, 52, { color: "a2", p: X.pr(2, .4, 2, .6) });
  pen.stroke(c, shape.ellipse(x, y + 96, 118, 46, { n: 40 }), { k: d.k, seed: "cir", width: 4, color: "warm", closed: true, progress: X.pr(2, .6, 2, .8) });
};
// 3 — нога в двери: опыт (тетрадь — маркер, зигзаг)
PROPS[3] = (c, d, X) => {
  floor(c, d, 100, 700, "3");
  bar(c, d, 1060, 760, 190, 520, 17, X.at(0, .6), "ЩИТ", { color: "soft", zig: true });
  bar(c, d, 1500, 760, 190, 520, 76, X.at(1, .35), "НАКЛЕЙКА → ЩИТ", { color: "a1", zig: true });
  const bp = X.pr(0, .15, 0, .45); // огромный щит
  if (bp > 0) { pen.flat(c, rectPts(900, 120, 330, 150), { k: d.k, seed: "bill", color: "paper", outline: 4, alpha: bp }); T(c, d, "ВОДИТЕ\nОСТОРОЖНО", 1065, 180, 40, { inter: true, color: "a2", p: bp }); ln(c, d.k, [P(960, 270), P(960, 330)], "bl1", { width: 5, progress: bp }); ln(c, d.k, [P(1170, 270), P(1170, 330)], "bl2", { width: 5, progress: bp }); }
  const sp = X.pr(1, .1, 1, .3); // наклейка
  if (sp > 0) { pen.flat(c, geo.transform(rectPts(-60, -26, 120, 52), { x: 1300, y: 600, rot: -.15 }), { k: d.k, seed: "stk", color: "a2", outline: 3, alpha: sp }); T(c, d, "ВОДИТЕ ОСТОРОЖНО", 1300, 606, 16, { inter: true, color: "paper", a: sp }); }
  pen.stroke(c, shape.ellipse(1500, 312, 130, 66, { n: 40 }), { k: d.k, seed: "c76", width: 5, color: "warm", closed: true, progress: X.pr(1, .8, 2, .1) });
  // лесенка «да → да → ДА»
  const lp = X.pr(2, 0, 2, .4); if (lp > 0) { pen.stroke(c, [P(700, 600), P(760, 600), P(760, 540), P(830, 540), P(830, 460), P(910, 460), P(910, 360)], { k: d.k, seed: "lad", width: 4, progress: lp }); ["да", "да", "ДА!"].forEach((s, i) => T(c, d, s, 730 + i * 75, 588 - i * 70, 34 + i * 10, { color: "a1", p: prog(lp, .3 + i * .2, .5 + i * .2) })); }
};
// 4 — дверь перед носом (чертёж)
PROPS[4] = (c, d, X) => {
  floor(c, d, -40, 1960, "4"); chair(c, d, 1450, -1); table(c, d, 1560, 300); laptop(c, d, 1580, GY - 164);
  const bp = X.pr(0, .3, 0, .8), sm = ease.inOut(X.pr(1, .5, 1, .8));
  const w = lerp(520, 220, sm), h = lerp(220, 100, sm), x = 960, y = lerp(200, 220, sm);
  if (bp > 0) { box3(c, d, x, y, w, h, "pj", bp, sm > .5 ? "a2" : "a1"); T(c, d, sm > .5 ? "ПРЕЗЕНТАЦИЯ" : "ПРОЕКТ", x, y + 14, sm > .5 ? 34 : 64, { inter: true, p: bp }); }
  dim(c, d, x - w / 2, y - h / 2 - 70, x + w / 2, y - h / 2 - 70, sm > .5 ? "2 ЧАСА" : "48 ЧАСОВ", prog(bp, .6, 1), "dm1");
  if (sm < .5) dim(c, d, x - w / 2 - 34, y + h / 2, x - w / 2 - 34, y - h / 2, "∞", prog(bp, .7, 1) * (1 - sm * 2), "dm2");
};
// 5 — дверь перед носом: опыт
PROPS[5] = (c, d, X) => {
  floor(c, d, 100, 700, "5");
  const zp = X.pr(0, .2, 0, .4); if (zp > 0) { tornCard(c, d, 1360, 200, 300, 96, "zoo", "a1", -.05); T(c, d, "ЗООПАРК: 1 ДЕНЬ", 1360, 214, 32, { inter: true, color: "paper" }); }
  const a = X.pr(1, .15, 1, .3); box3(c, d, 980, 300, 300, 180, "2y", X.pr(1, 0, 1, .25), "a1"); T(c, d, "2 ГОДА", 980, 290, 44, { inter: true, p: a }); T(c, d, "НАСТАВНИКОМ", 980, 330, 24, { inter: true, p: a });
  const xp = X.pr(1, .35, 1, .5); ln(c, d.k, [P(820, 200), P(1140, 400)], "x1", { width: 7, color: "a3", progress: xp }); ln(c, d.k, [P(1140, 200), P(820, 400)], "x2", { width: 7, color: "a3", progress: prog(xp, .5, 1) });
  T(c, d, "«НЕТ»", 980, 470, 56, { color: "a3", p: X.pr(1, .48, 1, .6) });
  bar(c, d, 1360, 760, 160, 440, 17, X.at(0, .6), "ЗООПАРК", { color: "soft" });
  bar(c, d, 1680, 760, 160, 440, 50, X.at(1, .7), "ПОСЛЕ «НЕТ»", { color: "a2" });
};
// 6 — подарок (крафт)
PROPS[6] = (c, d, X) => floor(c, d, -40, 1960, "6");
FRONT[6] = (c, d, X) => {
  if (X.pr(2, .75, 2, .8) > 0) tornCard(c, d, 960, 300, 210, 96, "pr1", "a1", -.08), T(c, d, "200 ₽", 960, 318, 56, { color: "line" });
  if (X.pr(2, .85, 2, .9) > 0) tornCard(c, d, 1200, 420, 260, 110, "pr2", "a2", .07), T(c, d, "5000 ₽", 1200, 440, 66, { color: "a1" });
};
// 7 — подарок: опыт (кола и лотерея, штамп ×2, крючок)
PROPS[7] = (c, d, X) => {
  floor(c, d, 100, 700, "7");
  const cb = X.pr(0, .2, 0, .5); if (cb > 0) { c.save(); c.globalAlpha = 1 - X.pr(1, .1, 1, .3); ICON.cola(c, d, 1260, 360, 4.2 * ease.pop(cb), 1, "bigcola"); c.restore(); T(c, d, "БЕСПЛАТНО", 1260, 520, 48, { color: "a2", p: X.pr(0, .45, 0, .7), a: 1 - X.pr(1, .1, 1, .3) }); }
  if (X.pr(1, .2, 1, .25) > 0) { tornCard(c, d, 1050, 620, 200, 120, "lt1", "a1", -.05); T(c, d, "БЕЗ КОЛЫ", 1050, 600, 32, { inter: true }); T(c, d, "1 билет", 1050, 650, 40, {}); }
  if (X.pr(1, .3, 1, .35) > 0) { tornCard(c, d, 1460, 640, 230, 140, "lt2", "a1", .04); tornCard(c, d, 1475, 600, 230, 140, "lt3", "a1", -.03); T(c, d, "С КОЛОЙ", 1475, 585, 32, { inter: true }); T(c, d, "2 билета", 1475, 640, 40, {}); }
  const sp = X.pr(1, .45, 1, .55); if (sp > 0) { const s = lerp(2.2, 1, ease.out(sp)); c.save(); c.translate(1600, 430); c.rotate(-.25); c.scale(s, s); pen.stroke(c, rectPts(-90, -55, 180, 110), { k: d.k, seed: "stp", width: 6, color: "a2", closed: true, sketch: false }); T(c, d, "×2", 0, 32, 92, { inter: true, color: "a2" }); c.restore(); }
  const hp = X.pr(2, .45, 2, .75); if (hp > 0) { const sw = Math.sin(d.t * 1.6) * 20; ln(c, d.k, [P(1100, -100), P(1100 + sw * .5, 220)], "hl", { width: 2.6, progress: hp }); pen.stroke(c, shape.arc(1100 + sw * .5 - 18, 250, 30, R(-90), R(160), 18), { k: d.k, seed: "hk", width: 6, progress: prog(hp, .4, 1) });
    if (hp > .6) { const gx = 1080 + sw * .5, gy = 330; pen.flat(c, rectPts(gx - 50, gy - 20, 100, 76), { k: d.k, seed: "gf", color: "a2", outline: 3.6 }); ln(c, d.k, [P(gx, gy - 20), P(gx, gy + 56)], "gr1", { width: 5, color: "warm" }); ln(c, d.k, [P(gx - 50, gy + 14), P(gx + 50, gy + 14)], "gr2", { width: 5, color: "warm" }); } }
};
// 8 — дефицит (неон): экран телефона с таймером
PROPS[8] = (c, d, X) => {
  floor(c, d, -40, 1960, "8"); sofa(c, d, 700);
  const x = 1360, y = 500, sp = X.pr(0, 0, 0, .25), g = d.glow; if (sp <= 0) return;
  pen.stroke(g, rectPts(x - 230, y - 380, 460, 760), { k: d.k, seed: "scr", width: 5, closed: true, color: "a2", progress: sp });
  // кроссовок
  const sh = [P(x - 150, y - 60), P(x - 60, y - 70), P(x - 10, y - 130), P(x + 40, y - 120), P(x + 30, y - 70), P(x + 150, y - 40), P(x + 160, y + 10), P(x - 160, y + 10)];
  pen.stroke(g, sh, { k: d.k, seed: "snk", width: 4.5, closed: true, color: "line", progress: prog(sp, .3, 1) });
  pen.stroke(g, [P(x - 160, y + 10), P(x + 160, y + 10)], { k: d.k, seed: "sol", width: 7, color: "a1", progress: prog(sp, .5, 1) });
  const blink = (Math.floor(d.t * 2.2) % 2) ? 1 : .35;
  T(g, d, "ОСТАЛОСЬ 2!", x, y - 190, 52, { inter: true, color: "warm", a: blink * prog(d.t, X.at(0, .2), X.at(0, .3)) });
  const t0 = X.at(0, .3), reset = X.at(2, .6); let left = 540 - Math.max(0, d.t - t0) * 1;
  if (d.t > reset) left = 540 - (d.t - reset);
  const mm = Math.floor(left / 60), ss = Math.floor(left % 60), str = `0${mm}:${String(ss).padStart(2, "0")}`;
  if (d.t > t0) T(g, d, str, x, y + 150, 96, { inter: true, color: "a2" });
  const bp = X.at(2, .05), pressed = d.t > bp, q = pressed ? ease.pop(prog(d.t, bp, bp + .3)) : 1;
  const btn = rectPts(x - 150 * q, y + 210, 300 * q, 90 * q);
  if (d.t > X.at(1, 0)) { pen.flat(g, btn, { k: d.k, seed: "btn", color: pressed ? "a1" : "warm", outline: 3, alpha: .9 }); T(g, d, pressed && d.t < reset ? "КУПЛЕНО" : "КУПИТЬ", x, y + 272, 50, { inter: true, color: "paper" }); }
  if (d.t > reset) T(g, d, "снова 9 минут ;)", x, y - 290, 40, { color: "a3", p: prog(d.t, reset, reset + .6) });
};
// 9 — дефицит: опыт с печеньем
PROPS[9] = (c, d, X) => {
  floor(c, d, 100, 1900, "9"); table(c, d, 1300, 760);
  [[1080, 10, "10 ШТУК"], [1520, 2, "2 ШТУКИ"]].forEach(([x, n, lab], j) => {
    const jp = X.pr(0, .1 + j * .2, 0, .4 + j * .2); if (jp <= 0) return;
    const jar = [P(x - 90, GY - 470), P(x + 90, GY - 470), P(x + 110, GY - 420), P(x + 110, GY - 170), P(x - 110, GY - 170), P(x - 110, GY - 420)];
    pen.stroke(c, jar, { k: d.k, seed: "jar" + j, width: 4.5, closed: true, progress: jp });
    pen.flat(c, rectPts(x - 100, GY - 500, 200, 32), { k: d.k, seed: "lid" + j, color: "a3", outline: 3, alpha: jp });
    for (let i = 0; i < n; i++) { const r = rng("ck", j, i), cx = x - 70 + (i % 4) * 46 + r.range(-6, 6), cy = GY - 200 - Math.floor(i / 4) * 44; ICON.cookie(c, d, cx, cy + 14, .95, 1, "ck" + j + i); }
    T(c, d, lab, x, GY - 100, 40, { inter: true, color: "soft", p: jp });
  });
  const gp = X.pr(1, .5, 1, .8); if (gp > 0) { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + d.t * .5, x = 1520 + Math.cos(a) * 170, y = GY - 330 + Math.sin(a) * 170; pen.flat(d.glow, shape.star(x, y, 18, 7, 4), { color: "warm", outline: 0, alpha: gp }); } T(d.glow, d, "ВКУСНЕЕ!", 1520, GY - 560, 64, { color: "warm", p: gp }); }
};
// 10 — пауза: сколько из четырёх
PROPS[10] = (c, d, X) => {
  floor(c, d, 100, 1900, "10");
  const names = ["НОГА В ДВЕРИ", "ДВЕРЬ ПЕРЕД НОСОМ", "ПОДАРОК", "ДЕФИЦИТ"];
  names.forEach((s, i) => { const p = X.pr(0, .2 + i * .15, 0, .35 + i * .15); if (p <= 0) return; const x = 900 + i * 260, y = 330;
    pen.stroke(d.glow, rectPts(x - 115, y - 140, 230, 280), { k: d.k, seed: "cd" + i, width: 4, closed: true, color: ["a1", "a2", "a3", "warm"][i], progress: p });
    T(d.glow, d, String(i + 1), x, y + 10, 120, { inter: true, color: ["a1", "a2", "a3", "warm"][i], p }); T(c, d, s, x, y + 110, 26, { inter: true, color: "soft", p, maxWidth: 210 }); });
  const q = X.pr(0, .8, 1, 0); if (q > 0) { const n = Math.floor((d.t * 3) % 5); T(d.glow, d, (q < 1 ? n : "?") + " ИЗ 4", 1290, 720, 150, { inter: true, color: "warm" }); }
};
// 11 — все так делают (коллаж): чат из рваной бумаги
PROPS[11] = (c, d, X) => {
  floor(c, d, -40, 1960, "11");
  const msgs = [["Все наши уже вложились!", .1, 0, 1620, 150, "a3"], ["Ты один остался", .55, 0, 1660, 250, "paper"], ["+3 вложились", .2, 1, 1700, 350, "a3"]];
  msgs.forEach(([s, f, l, x, y, role], i) => { if (X.pr(l, f, l, f + .05) <= 0) return; c.font = FONT(44); const w = c.measureText(s).width + 70; tornCard(c, d, x, y, w, 84, "msg" + i, role, (i % 2 ? .03 : -.03)); T(c, d, s, x, y + 16, 44, { color: "line" }); });
};
FRONT[11] = (c, d, X) => {
  ["ХИТ ПРОДАЖ", "23 СМОТРЯТ", "★★★★★"].forEach((s, i) => { const f = .4 + i * .15; if (X.pr(2, f, 2, f + .05) <= 0) return; const x = 640 + i * 290, y = 150 + (i % 2) * 60;
    tornCard(c, d, x, y, 250, 80, "tag" + i, i === 1 ? "a1" : "a3", (i - 1) * .06); T(c, d, s, x, y + 14, i === 2 ? 40 : 34, { inter: true, color: "paper" }); });
};
// 12 — все так делают: опыт с полотенцами
PROPS[12] = (c, d, X) => {
  floor(c, d, 100, 700, "12");
  const cards = [["БЕРЕГИТЕ\nПРИРОДУ", "35%", 0, .3], ["БОЛЬШИНСТВО\nГОСТЕЙ", "44%", 1, .1], ["ГОСТИ ЭТОГО\nНОМЕРА", "ЕЩЁ\nБОЛЬШЕ", 2, .1]];
  cards.forEach(([s, v, l, f], i) => { if (X.pr(l, f, l, f + .05) <= 0) return; const x = 1020 + i * 350, y = 360;
    tornCard(c, d, x, y, 310, 230, "ht" + i, i === 2 ? "a3" : "paper", (i - 1) * .04);
    T(c, d, s, x, y - 30, 40, { inter: true, color: "line" });
    pen.stroke(c, [P(x - 60, y + 50), P(x + 60, y + 50), P(x + 50, y + 90), P(x - 50, y + 90)], { k: d.k, seed: "tw" + i, width: 3.4, closed: true }); // полотенце
    const np = X.pr(l, f + .1, l, Math.min(1, f + .5)); if (np > 0) { tornCard(c, d, x, y + 250, 240, i === 2 ? 170 : 130, "hv" + i, i === 0 ? "soft" : "a1", 0); T(c, d, v, x, y + (i === 2 ? 240 : 280), i === 2 ? 50 : 92, { inter: true, color: "paper" }); } });
};
// 13 — якорь (мел)
PROPS[13] = (c, d, X) => {
  floor(c, d, -40, 1960, "13"); chair(c, d, 1530, -1); table(c, d, 1180, 300);
  const NX = (v) => 640 + (v - 60) / 50 * 880, ly = 150, lp = X.pr(0, .5, 0, .65);
  ln(c, d.k, [P(600, ly), P(1560, ly)], "nl", { width: 4, progress: lp });
  [60, 70, 80, 90, 100, 110].forEach((v, i) => { ln(c, d.k, [P(NX(v), ly - 12), P(NX(v), ly + 12)], "nt" + i, { width: 3, progress: lp }); T(c, d, String(v), NX(v), ly - 24, 30, { color: "soft", p: lp }); });
  const hp = X.pr(0, .6, 0, .8); if (hp > 0) { pen.flat(c, circ(NX(100), ly, 16 * ease.pop(hp)), { color: "a1", outline: 0 }); T(c, d, "хочу 100", NX(100), ly + 62, 44, { color: "a1", p: hp }); }
  const ad = ease.out(X.pr(1, 0, 1, .2)), ay = lerp(-150, ly + 70, ad), ax = NX(70);
  if (ad > 0) { ln(c, d.k, [P(ax, -150), P(ax, ay - 40)], "chn", { width: 3, color: "soft" });
    pen.stroke(c, circ(ax, ay - 26, 12, 16), { k: d.k, seed: "an0", width: 5, closed: true });
    ln(c, d.k, [P(ax, ay - 14), P(ax, ay + 60)], "an1", { width: 7 }); ln(c, d.k, [P(ax - 34, ay + 4), P(ax + 34, ay + 4)], "an2", { width: 6 });
    pen.stroke(c, shape.arc(ax, ay + 20, 46, R(20), R(160), 18), { k: d.k, seed: "an3", width: 7 }); }
  const np = X.pr(1, .55, 1, .8); if (np > 0) { pen.stroke(c, shape.arc((NX(100) + NX(80)) / 2, ly + 10, (NX(100) - NX(80)) / 2, R(200), R(340), 16), { k: d.k, seed: "pull", width: 5, color: "a3", progress: np });
    pen.flat(c, circ(NX(80), ly, 16 * ease.pop(np)), { color: "a3", outline: 0 }); T(c, d, "договорились 80", NX(80) + 30, ly + 62, 40, { color: "a3", p: np }); }
};
// 14 — якорь: колесо фортуны
PROPS[14] = (c, d, X) => {
  floor(c, d, 100, 700, "14");
  const x = 960, y = 420, r = 230, wp = X.pr(0, 0, 0, .25); if (wp <= 0) return;
  const spin = ease.out(X.pr(0, .25, 0, .8)), ang = spin * 9.3 * TAU;
  pen.stroke(c, circ(x, y, r, 60), { k: d.k, seed: "wh", width: 6, closed: true, progress: wp });
  for (let i = 0; i < 12; i++) { const a = ang + i / 12 * TAU; ln(c, d.k, [P(x, y), P(x + Math.cos(a) * r, y + Math.sin(a) * r)], "sp" + i, { width: 2.6, color: "soft", progress: wp });
    const lab = i % 6 === 0 ? "10" : i % 6 === 3 ? "65" : ""; if (lab) T(c, d, lab, x + Math.cos(a + .26) * r * .66, y + Math.sin(a + .26) * r * .66 + 18, 54, { color: lab === "10" ? "a1" : "a2" }); }
  pen.flat(c, [P(x - 22, y - r - 36), P(x + 22, y - r - 36), P(x, y - r + 6)], { k: d.k, seed: "ptr", color: "warm", outline: 3 });
  ln(c, d.k, [P(x, y + r), P(x, GY)], "whs", { width: 6 });
  T(c, d, "10 → 25%", 1500, 330, 92, { color: "a1", p: X.pr(1, .5, 1, .7) });
  T(c, d, "65 → 45%", 1500, 500, 92, { color: "a2", p: X.pr(1, .85, 2, .05) });
  T(c, d, "% стран ООН в Африке", 1500, 600, 40, { color: "soft", p: X.pr(1, .2, 1, .45) });
};
// 15 — «потому что» (ретро-печать): полутоновые буквы с двойной печатью, ксерокс
const halftoneText = (s, px, role) => Sketch.cache("ht" + s + px + role + (Sketch.pal && Sketch.pal.name), Math.ceil(px * s.length * .72) + 80, Math.ceil(px * 1.5), (cx, w, h) => {
  const src = document.createElement("canvas"); src.width = w; src.height = h; const s2 = src.getContext("2d");
  s2.font = INTER(px); s2.textAlign = "center"; s2.fillStyle = "#000"; s2.fillText(s, w / 2, h * .78);
  fx.halftone(cx, src, { cell: Math.max(8, px / 14), color: role, useAlpha: true, gain: 1.2 });
});
function stampHT(c, d, s, x, y, px, role, p, mis = true) {
  if (p <= 0) return; const cv = halftoneText(s, px, role), sc = lerp(1.25, 1, ease.out(p));
  c.save(); c.globalAlpha = clamp(p * 2); c.translate(x, y); c.scale(sc, sc);
  if (mis) { c.globalAlpha *= .75; const cv2 = halftoneText(s, px, "a3"); c.drawImage(cv2, -cv2.width / 2 + 7, -cv2.height / 2 + 5); c.globalAlpha = clamp(p * 2); }
  c.drawImage(cv, -cv.width / 2, -cv.height / 2); c.restore();
}
PROPS[15] = (c, d, X) => {
  floor(c, d, -40, 1960, "15");
  stampHT(c, d, "ПОТОМУ ЧТО", 960, 170, 130, "a1", X.pr(0, .35, 0, .5));
  const cp = X.pr(2, .3, 2, .55); if (cp > 0) { const x = 960, y = GY - 150;
    pen.flat(c, rectPts(x - 150, y - 110, 300, 220), { k: d.k, seed: "cpy", color: "a2", outline: 4, alpha: cp }); pen.flat(c, rectPts(x - 170, y - 140, 340, 34), { k: d.k, seed: "cpt", color: "soft", outline: 3, alpha: cp });
    T(c, d, "КСЕРОКС", x, y + 20, 40, { inter: true, color: "line", a: cp });
    const sw = (d.t * 1.2) % 1; ln(c, d.k, [P(x - 140 + sw * 280, y - 140), P(x - 140 + sw * 280, y - 106)], "lgt", { width: 6, color: "warm" });
    for (let i = 0; i < 3; i++) { const u = ((d.t * .7 + i / 3) % 1); pen.flat(c, geo.transform(rectPts(-40, -52, 80, 104), { x: x - 60 + u * 120, y: y - 160 - u * 160, rot: u * .8 }), { k: d.k, seed: "sht" + i, color: "paper", outline: 2.4, alpha: 1 - u }); } }
};
// 16 — «потому что»: опыт Лангер
PROPS[16] = (c, d, X) => {
  floor(c, d, 100, 700, "16");
  stampHT(c, d, "60%", 1060, 400, 200, "soft", X.pr(0, .05, 0, .2), false); T(c, d, "без причины", 1060, 560, 56, { color: "soft", p: X.pr(0, .1, 0, .3) });
  stampHT(c, d, "93%", 1580, 400, 230, "a1", X.pr(0, .5, 0, .65)); T(c, d, "«потому что мне нужно\nсделать копии»", 1580, 580, 48, { color: "line", p: X.pr(0, .6, 0, .85) });
};
// 17 — как защититься (лубок): рамка, лента «ПАУЗА», ножницы режут ниточки
PROPS[17] = (c, d, X) => {
  floor(c, d, -40, 1960, "17");
  // солнце-часы: пауза
  const sx = 1020, sy = 250, sp = X.pr(1, .45, 1, .7); if (sp > 0) { pen.flat(c, circ(sx, sy, 70 * ease.pop(sp), 40), { k: d.k, seed: "sun", color: "sun", outline: 3.6 }); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU + d.t * .1; ln(c, d.k, [P(sx + Math.cos(a) * 84, sy + Math.sin(a) * 84), P(sx + Math.cos(a) * (100 + (i % 2) * 18), sy + Math.sin(a) * (100 + (i % 2) * 18))], "sr" + i, { width: 5, color: "orange", sketch: false, progress: sp }); }
    ln(c, d.k, [P(sx, sy), P(sx, sy - 44)], "hh", { width: 6, sketch: false }); ln(c, d.k, [P(sx, sy), P(sx + 30, sy + 10)], "mh", { width: 6, sketch: false }); }
};
FRONT[17] = (c, d, X, f) => {
  const ct = TM.cut, sc = prog(d.t, ct, ct + 1.8); if (sc <= 0 || sc >= 1 || !f.s) return;
  const x = lerp(f.s.head.x - 300, f.s.head.x + 300, ease.inOut(sc)), y = 200, open = Math.abs(Math.sin(d.t * 22)) * .5;
  [-1, 1].forEach((s) => { const a = s * open; pen.flat(c, geo.transform([P(0, -6), P(120, -2), P(120, 2), P(0, 6)], { x, y, rot: a }), { k: d.k, seed: "bl" + s, color: "grey", outline: 3 }); pen.stroke(c, circ(x - 40 * Math.cos(a), y + s * 24, 20, 16), { k: d.k, seed: "ring" + s, width: 5, closed: true, color: "red", sketch: false }); });
};
// 18 — где наука спорит (тушь): весы
PROPS[18] = (c, d, X) => {
  floor(c, d, 100, 1900, "18");
  const x = 1260, y = 400, tilt = lerp(0, -.18, ease.inOut(X.pr(0, .4, 0, .7))) + lerp(0, .12, ease.inOut(X.pr(1, .3, 1, .6))), p = X.pr(0, 0, 0, .3);
  if (p <= 0) return;
  ln(c, d.k, [P(x, y), P(x, GY)], "pst", { width: 7, progress: p }); pen.flat(c, [P(x - 90, GY), P(x + 90, GY), P(x + 40, GY - 40), P(x - 40, GY - 40)], { k: d.k, seed: "bs", color: "soft", outline: 3, alpha: p });
  const bx = Math.cos(tilt) * 340, by = Math.sin(tilt) * 340;
  ln(c, d.k, [P(x - bx, y - by), P(x + bx, y + by)], "beam", { width: 7, progress: p });
  [[-1, "ПЕРВЫЕ\nОПЫТЫ", "a1"], [1, "ПОВТОРЫ", "a2"]].forEach(([s, lab, role]) => { const px = x + s * bx, py = y + s * by;
    ln(c, d.k, [P(px, py), P(px - 70, py + 150)], "ch1" + s, { width: 2.6 }); ln(c, d.k, [P(px, py), P(px + 70, py + 150)], "ch2" + s, { width: 2.6 });
    pen.flat(c, shape.ellipse(px, py + 160, 110, 22, { n: 30 }), { k: d.k, seed: "pan" + s, color: role, outline: 3.4 });
    T(c, d, lab, px, py + 230, 38, { inter: true, color: role, p }); });
  [["ЯКОРЬ ✓", .3, 1100, 170], ["«ВСЕ ТАК ДЕЛАЮТ» ✓", .45, 1420, 230]].forEach(([s, f, sx, sy], i) => { const q = X.pr(1, f, 1, f + .1); if (q <= 0) return; const z = lerp(1.6, 1, ease.out(q));
    c.save(); c.translate(sx, sy); c.rotate(-.08 + i * .1); c.scale(z, z); pen.stroke(c, rectPts(-(s.length * 14 + 30), -40, s.length * 28 + 60, 80), { k: d.k, seed: "stmp" + i, width: 5, color: "warm", closed: true, sketch: false }); T(c, d, s, 0, 18, 44, { inter: true, color: "warm" }); c.restore(); });
};
// 19 — задание: Саша с лупой ловит приём №4
PROPS[19] = (c, d, X) => {
  floor(c, d, -40, 1960, "19");
  const p = X.pr(0, .3, 0, .5); if (p <= 0) return;
  tag(c, d, 1330, 380, "ТОЛЬКО СЕГОДНЯ!\n−50%", p);
  const q = X.pr(0, .6, 0, .75); if (q > 0) { pen.stroke(c, shape.ellipse(1330, 380, 230, 140, { n: 40 }), { k: d.k, seed: "c4", width: 6, color: "a2", closed: true, progress: q }); T(c, d, "№4", 1600, 260, 110, { inter: true, color: "a2", p: q }); }
};
function tag(c, d, x, y, s, p) { const r = [P(x - 190, y - 100), P(x + 150, y - 100), P(x + 200, y), P(x + 150, y + 100), P(x - 190, y + 100)]; pen.flat(c, r, { k: d.k, seed: "tg" + x, color: "warm", outline: 4, alpha: p }); pen.stroke(c, circ(x + 130, y, 14, 14), { k: d.k, seed: "tgh" + x, width: 4, closed: true }); T(c, d, s, x - 20, y - 10, 52, { inter: true, color: "line", a: p }); }
// 20 — весь разбор на одном листе
const SUM = [["НОГА В ДВЕРИ", "мелочь → большое"], ["ДВЕРЬ ПЕРЕД НОСОМ", "огромное → «уступка»"], ["ПОДАРОК", "долг за кофе"], ["ДЕФИЦИТ", "«осталось 2!»"],
  ["ВСЕ ТАК ДЕЛАЮТ", "«все уже вложились»"], ["ЯКОРЬ", "первая цифра тянет"], ["«ПОТОМУ ЧТО»", "причина без причины"]];
PROPS[20] = (c, d, X) => {
  T(c, d, "7 ПРИЁМОВ МАНИПУЛЯЦИИ — НА ОДНОМ ЛИСТЕ", 960, 110, 72, { p: X.pr(0, 0, 0, .3) });
  pen.stroke(c, shape.wave(380, 132, 1540, 6, 9), { k: d.k, seed: "sumu", width: 4.5, color: "warm", progress: X.pr(0, .25, 0, .4) });
  SUM.forEach(([a, b], i) => { const p = X.pr(0, .3 + i * .08, 0, .4 + i * .08); if (p <= 0) return;
    const col = i < 4 ? i : i - 4, row = i < 4 ? 0 : 1, x = (row ? 450 : 270) + col * (row ? 510 : 460), y = row ? 560 : 300, w = 420, h = 210;
    pen.stroke(c, rectPts(x - w / 2, y - h / 2, w, h), { k: d.k, seed: "sc" + i, width: 4, closed: true, progress: p });
    pen.flat(c, circ(x - w / 2 + 44, y - h / 2 + 44, 30, 20), { k: d.k, seed: "sn" + i, color: "a1", outline: 3, alpha: p });
    T(c, d, String(i + 1), x - w / 2 + 44, y - h / 2 + 58, 40, { inter: true, color: "paper", a: p });
    T(c, d, a, x + 24, y - 30, 34, { inter: true, p, maxWidth: 330 }); T(c, d, b, x, y + 50, 44, { color: "soft", p: prog(p, .4, 1) }); });
  const zp = X.pr(0, .95, 1, .2); if (zp > 0) { pen.flat(c, rectPts(420, 700, 1080, 110), { k: d.k, seed: "zash", color: "a3", outline: 4, alpha: zp }); T(c, d, "ЗАЩИТА ОТ ВСЕХ: «ОТВЕЧУ ЗАВТРА»", 960, 774, 50, { inter: true, color: "paper", p: zp }); }
  const sp = X.pr(1, .3, 1, .55); if (sp > 0) { const q = ease.pop(sp), sw = Math.sin(d.t * 5) * .25 * (1 - X.pr(1, .6, 2, .2));
    d.screen(c, (cc) => { fx.ribbon(cc, "ПОДПИШИСЬ", 860, 930, 560, sp, { k: d.k, font: INTER(44), height: 92, baseline: 16 });
      cc.save(); cc.translate(1320, 900); cc.rotate(sw); cc.scale(q, q); pen.flat(cc, [P(-40, 30), P(-34, -20), P(0, -46), P(34, -20), P(40, 30)], { k: d.k, seed: "bell", color: "warm", outline: 4 }); pen.flat(cc, circ(0, 42, 11, 12), { color: "line", outline: 0 }); cc.restore(); }); }
};

/* ---------------------------------------------------------------- миры и камеры */
function worldCamera(w) {
  return (t) => {
    let n = w.sheets[0]; for (const s of w.sheets) if (t >= TM.sheetStart[s] - .2) n = s;
    const i = w.sheets.indexOf(n), prev = i ? w.sheets[i - 1] : n, a1 = (ST.sheets[n].area || 0) * AREA, a0 = (ST.sheets[prev].area || 0) * AREA;
    const u = ease.inOut(prog(t, TM.sheetStart[n] - .2, TM.sheetStart[n] + .7));
    const fxx = lerp(a0, a1, u) + 960, settle = 1 - ease.out(prog(t, w.from, w.from + 1.4));
    const breathe = 1 + .035 * ease.inOut(prog(t, TM.sheetStart[n], TM.sheetEnd[n]));
    const whip = Math.sin(u * Math.PI) * (a1 !== a0 ? .06 : 0);
    return { fx: fxx + Math.sin(t * .23) * 6, fy: 540 + Math.sin(t * .31) * 4, zoom: breathe + settle * .1 - whip, rot: Math.sin(t * .17) * .004, shake: .35 };
  };
}
function worldDraw(w) {
  return (d) => {
    W = w;
    let figsMain = null;
    for (const n of w.sheets) {
      const opts = {};
      if (n === 17) opts.strOpts = { cutAt: TM.cut };
      if (n === 0 || n === 19 || n === 20) opts.strings = false;
      const f = drawSheet(d, n, opts); if (n === 0) figsMain = f;
    }
    void figsMain;
    // лубочная рамка в главе «Как защититься»
    if (w.id === "w8") d.screen(d.ink, (c) => { fx.ornamentFrame(c, prog(d.t, w.from + .6, w.from + 2.2), { k: d.k }); fx.ribbon(c, "ПАУЗА", 960, 132, 420, prog(d.t, AT(17, 1, .45), AT(17, 1, .75)), { k: d.k }); });
    chapterCard(d, w); hud(d, w);
    for (const n of w.sheets) if (d.t > TM.sheetStart[n] - .5 && d.t < TM.sheetEnd[n] + .3) bottomText(d, n);
  };
}
const SCENES = TM.worlds.map((w, i) => ({ id: w.id, from: w.from, to: w.to, palette: w.pal, camera: worldCamera(w), draw: worldDraw(w), in: i ? { type: "iris", dur: .9 } : undefined }));

Sketch.mount({
  palette: "graphite",
  palettes: [...new Set(TM.worlds.map((w) => w.pal))],
  fonts: ["700 80px Caveat", "400 80px Caveat", "800 80px Inter", "400 80px Inter", "400 80px 'Ruslan Display'"],
  scenes: SCENES,
});
