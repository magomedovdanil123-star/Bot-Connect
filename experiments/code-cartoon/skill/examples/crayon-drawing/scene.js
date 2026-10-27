/* ============================================================================
 * EXAMPLE — a child's space drawing in wax crayons (palette "crayon", 1200x900).
 * It shows the crayon pens (pen.crayon fills, pen.marker outlines) and is also the
 * sample "drawing" that the photo3d template folds into a pop-up book.
 * The page is drawn once; lines boil slowly like a scanned sheet coming alive.
 * Object positions match assets/template-photo3d/popups.json.
 * ==========================================================================*/
const PALETTE = "crayon";
const { pen, shape, geo, rng } = Sketch;
const P = (x, y) => ({ x, y }), TAU = Math.PI * 2, deg = (a) => (a * Math.PI) / 180;
const circ = (x, y, r, n = 64) => shape.ellipse(x, y, r, r, { n });
const W = 1200, H = 900;

// crayon fill + marker outline
const shp = (c, poly, role, k, seed, o = {}) => {
  pen.crayon(c, poly, Object.assign({ k, seed: seed + "f", color: role }, o));
  pen.marker(c, poly, { k, seed: seed + "o", color: "black", closed: true, width: o.line ?? 2.6 });
};
const mark = (c, pts, k, seed, o = {}) => pen.marker(c, pts, Object.assign({ k, seed, color: "black" }, o));

// objects: [x, y, r] — the white paper halos around them stay unscribbled
const SUN = [980, 170, 104], MOON = [560, 240, 40], RINGED = [720, 565, 78], STRIPED = [1010, 705, 54], EARTH = [185, 760, 72];
const ROCKET = { x: 330, y: 470, rot: -0.45, s: 0.8 };
const HALOS = [[980, 170, 190, 182, 0], [560, 240, 58, 58, 0], [720, 565, 160, 84, -0.2], [1010, 705, 70, 70, 0], [185, 760, 90, 90, 0],
  [330, 470, 150, 270, -0.45], [440, 700, 100, 72, -0.45]];

// the scribbled night sky: drawn once into a cached canvas with the crayon palette pinned
function sky(c) {
  c.fillStyle = Sketch.col("sheet"); c.fillRect(0, 0, W, H);
  c.save(); c.beginPath(); c.rect(-10, -10, W + 20, H + 20);
  HALOS.forEach(([x, y, rx, ry, r]) => { c.moveTo(x + rx * Math.cos(r), y + rx * Math.sin(r)); c.ellipse(x, y, rx, ry, r, 0, TAU); });
  c.clip("evenodd"); c.lineCap = c.lineJoin = "round";
  const scribble = (n, role, seed, bx, by, bw, bh, inside) => {
    for (let i = 0; i < n; i++) {
      const r = rng("scr", seed, i), sx = r.range(bx, bx + bw), sy = r.range(by, by + bh);
      if (inside && !inside(sx, sy)) continue;
      const a = r.range(-1.0, -0.35), len = r.range(50, 150), zig = Math.floor(r.range(6, 14)), step = r.range(4, 8);
      const ca = Math.cos(a), sa = Math.sin(a);
      c.beginPath();
      for (let j = 0; j <= zig; j++) { const side = j % 2 ? 0.5 : -0.5, q = r.range(0.75, 1.1), x = sx - sa * j * step + ca * len * side * q, y = sy + ca * j * step + sa * len * side * q; if (j) c.lineTo(x, y); else c.moveTo(x, y); }
      c.strokeStyle = Sketch.col(r() < 0.1 ? "black" : role, r.range(0.55, 0.9)); c.lineWidth = r.range(2.4, 4.4); c.stroke();
    }
  };
  scribble(470, "navy", "n", -60, -60, W + 60, H + 60);
  // a violet streak across the sky: strokes start inside a tilted ellipse, so the edge stays ragged
  scribble(260, "violet", "v", 40, 0, 860, 420, (x, y) => { const u = (x - 450) * Math.cos(0.2) + (y - 200) * Math.sin(0.2), v = -(x - 450) * Math.sin(0.2) + (y - 200) * Math.cos(0.2); return (u / 380) ** 2 + (v / 95) ** 2 < 1; });
  c.restore();
}

function sun(c, k) {
  const [x, y, r] = SUN;
  for (let ring = 0; ring < 2; ring++) {
    const pts = [], R0 = r + 6 + ring * 12, n = 58;
    for (let i = 0; i <= n; i++) { const a = (i / n) * TAU + ring * 0.05, rr = i % 2 ? R0 + 38 + rng("sr", ring, i)() * 28 : R0; pts.push(P(x + Math.cos(a) * rr, y + Math.sin(a) * rr)); }
    pen.stroke(c, pts, { k, seed: "ray" + ring, width: 2.6, color: "orange", wobble: 1.2, taper: false });
  }
  shp(c, circ(x, y, r, 90), "sun", k, "sun", { angle: -0.5 });
  [[-36, -10], [34, -10]].forEach(([dx, dy]) => { c.fillStyle = Sketch.col("black"); c.beginPath(); c.arc(x + dx, y + dy, 7, 0, TAU); c.fill(); });
  [[-60, 24], [58, 24]].forEach(([dx, dy], i) => pen.crayon(c, circ(x + dx, y + dy, 13, 20), { k, seed: "ck" + i, color: "orange" }));
  mark(c, shape.arc(x, y + 2, 44, deg(38), deg(142), 22), k, "smile", { width: 3.2 });
}

function ringed(c, k) {
  const [x, y, r] = RINGED, tilt = -0.2, rx = 140, ry = 36;
  const half = (a0, a1, sc) => geo.transform(shape.ellipse(x, y, rx * sc, ry * sc, { a0, sweep: a1 - a0, n: 30 }), { rot: tilt, ox: x, oy: y });
  const band = (a0, a1, id) => { pen.stroke(c, half(a0, a1, 0.93), { k, seed: id + "k", width: 6, color: "orange", wobble: 0.9, taper: false }); mark(c, half(a0, a1, 1), k, id + "a"); mark(c, half(a0, a1, 0.86), k, id + "b"); };
  band(Math.PI, TAU, "back");
  shp(c, circ(x, y, r), "violet", k, "ringed", { angle: -0.6 });
  band(0, Math.PI, "front");
}

function striped(c, k) {
  const [x, y, r] = STRIPED, body = circ(x, y, r);
  pen.crayon(c, body, { k, seed: "stb", color: "sun" });
  c.save(); c.beginPath(); body.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.clip();
  [-2, 0, 2].forEach((j) => { const yy = y + j * r * 0.3, top = [], bot = []; for (let i = 0; i <= 16; i++) { const xx = x - r + (2 * r * i) / 16, w = Math.sin(i * 0.8 + j) * r * 0.06; top.push(P(xx, yy - r * 0.13 + w)); bot.push(P(xx, yy + r * 0.13 + w)); } pen.crayon(c, top.concat(bot.reverse()), { k, seed: "sts" + j, color: j ? "red" : "orange" }); });
  c.restore();
  mark(c, body, k, "sto", { closed: true });
}

function moon(c, k) {
  const [x, y, r] = MOON;
  shp(c, circ(x, y, r), "grey", k, "moon");
  [[-12, -10, 7], [10, -4, 5], [-2, 14, 6]].forEach(([u, v, rr], i) => mark(c, circ(x + u, y + v, rr, 16), k, "cr" + i, { closed: true, width: 1.8 }));
}

function earth(c, k) {
  const [x, y, r] = EARTH, body = circ(x, y, r, 80);
  pen.crayon(c, body, { k, seed: "eb", color: "sky", angle: -0.4 });
  c.save(); c.beginPath(); body.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.clip();
  [[[-0.7, -0.4], [-0.3, -0.6], [-0.1, -0.3], [-0.4, 0.1], [-0.3, 0.5], [-0.65, 0.3]], [[0.15, -0.55], [0.6, -0.4], [0.7, 0.05], [0.35, 0.2], [0.2, -0.1]], [[0.1, 0.4], [0.5, 0.45], [0.3, 0.8], [0.05, 0.7]]]
    .forEach((cn, i) => { const pts = cn.map(([u, v]) => P(x + u * r, y + v * r)); pts.push(pts[0]); shp(c, geo.resampleN(pts, 50, true), "green", k, "ct" + i, { angle: 0.7, line: 2 }); });
  c.restore();
  mark(c, body, k, "eo", { closed: true });
}

function face(c, k, cx, cy, R, kind) {
  const head = shape.ellipse(cx, cy, R * 0.92, R, { n: 32 });
  if (kind === "cat") {
    [-1, 1].forEach((s) => shp(c, [P(cx + s * R * 0.85, cy - R * 0.3), P(cx + s * R * 0.6, cy - R * 1.05), P(cx + s * R * 0.2, cy - R * 0.62)], "grey", k, "ear" + s, { line: 2 }));
    shp(c, head, "grey", k, "cat", { line: 2 });
  } else {
    shp(c, head, "skin", k, "kid", { line: 2 });
    shp(c, shape.ellipse(cx, cy - R * 0.1, R, R, { a0: deg(190), sweep: deg(160), n: 18 }).concat([P(cx + R * 0.5, cy - R * 0.4), P(cx, cy - R * 0.55), P(cx - R * 0.5, cy - R * 0.4)]), "brown", k, "hair", { line: 2 });
  }
  [-1, 1].forEach((s) => { c.fillStyle = Sketch.col("black"); c.beginPath(); c.arc(cx + s * R * 0.33, cy, Math.max(2, R * 0.1), 0, TAU); c.fill(); });
  mark(c, shape.arc(cx, cy + R * 0.12, R * 0.4, deg(30), deg(150), 10), k, kind + "m", { width: 2 });
}

function rocket(c, k) {
  const { x, y, rot, s } = ROCKET, tf = (pts) => geo.transform(pts, { x, y, scale: s, rot });
  for (let i = 0; i < 14; i++) {
    const g = rng("flame", i), x0 = g.range(-70, 70), len = g.range(90, 170), pts = [];
    for (let j = 0; j <= 7; j++) pts.push(P(x0 * (1 + j * 0.06) + (j % 2 ? 10 : -10), 265 + (len * j) / 7));
    pen.stroke(c, tf(pts), { k, seed: "fl" + i, width: 3, color: i % 3 ? "red" : "orange", wobble: 1.2, taper: false });
  }
  shp(c, tf([P(-110, 70), P(-205, 236), P(-196, 262), P(-110, 206)]), "violet", k, "finL");
  shp(c, tf([P(110, 70), P(205, 236), P(196, 262), P(110, 206)]), "violet", k, "finR");
  shp(c, tf([P(-72, 200), P(72, 200), P(88, 262), P(-88, 262)]), "brown", k, "noz");
  shp(c, tf([P(-110, -150), P(110, -150), P(110, 200), P(-110, 200)]), "sky", k, "body", { angle: -0.3 });
  shp(c, tf([P(-110, -150), P(0, -335), P(110, -150)]), "red", k, "nose", { angle: 0.6 });
  [[-40, 52, "kid"], [95, 40, "cat"]].forEach(([py, pr, kind], i) => {
    const pc = tf([P(0, py)])[0], rr = pr * s;
    shp(c, circ(pc.x, pc.y, rr + 8 * s, 40), "violet", k, "rim" + i);
    c.fillStyle = Sketch.col("sheet"); c.beginPath(); c.arc(pc.x, pc.y, rr, 0, TAU); c.fill();
    face(c, k, pc.x, pc.y + rr * 0.1, rr * 0.68, kind);
    mark(c, circ(pc.x, pc.y, rr, 40), k, "gl" + i, { closed: true, width: 2 });
  });
}

function stars(c, k) {
  for (let i = 0; i < 34; i++) {
    const r = rng("star", i), x = r.range(40, W - 40), y = r.range(40, H - 40);
    if (HALOS.some(([hx, hy, rx, ry]) => ((x - hx) / rx) ** 2 + ((y - hy) / ry) ** 2 < 1.15)) continue;
    const a = r() < 0.5 ? 0 : Math.PI / 4, L = r.range(10, 15), role = r() < 0.6 ? "sun" : "orange";
    for (let j = 0; j < 2; j++) { const an = a + (j * Math.PI) / 2; pen.stroke(c, [P(x - Math.cos(an) * L, y - Math.sin(an) * L), P(x + Math.cos(an) * L, y + Math.sin(an) * L)], { k, seed: "s" + i + j, width: 4, color: role, wobble: 0.8, taper: false, sketch: false }); }
  }
}

Sketch.mount({
  palette: PALETTE,
  draw(d) {
    const { ink } = d, k = Math.floor(d.k / 3); // the sheet boils slowly
    d.screen(ink, () => ink.drawImage(Sketch.cache("sky", W, H, sky, { palette: "crayon" }), 0, 0));
    stars(ink, k); moon(ink, k); earth(ink, k); striped(ink, k); ringed(ink, k); sun(ink, k); rocket(ink, k);
  },
});
