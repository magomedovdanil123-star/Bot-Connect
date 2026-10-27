/* ============================================================================
 * EXAMPLE «lubok-sun-ship» — two worlds in one video with Sketch.sequence:
 *   "sketch"  palette graphite: construction lines, a boat on waves under the sun, pencil hatching
 *   "print"   palette lubok: the SAME layout re-made as a folk print — flat colours, bold contours,
 *             Bilibin wave curls, a sun with a face (winks), ornament frame, ribbon with the title
 * The twist is an iris that opens the print over the sketch (each world keeps its own paper).
 * ==========================================================================*/
const TITLE = "ЖИЛИ-БЫЛИ";
const { pen, shape, geo, ease, prog, lerp, rng, fx } = Sketch;
const P = (x, y) => ({ x, y }), TAU = Math.PI * 2, deg = (a) => (a * Math.PI) / 180;
const circ = (x, y, r, n = 64) => shape.ellipse(x, y, r, r, { n });
const C = (id) => Sketch.cue(id), CE = (id) => Sketch.cueEnd(id);

// one layout for both worlds (frame pixels, 1920x1080)
const SUN = { x: 1420, y: 300, r: 110 };
const HORIZON = 620, ROWS = 5;
const boatAt = (t) => ({ x: 760, y: 650 + Math.sin(t * 2.1) * 7, rot: Math.sin(t * 1.7) * 0.035 });
const hull = (b) => geo.transform([P(-200, 0), P(200, 0), P(140, 82), P(-130, 82)], { x: b.x, y: b.y, rot: b.rot });
const mast = (b) => geo.transform([P(10, 0), P(10, -250)], { x: b.x, y: b.y, rot: b.rot });
const sail = (b) => geo.transform([P(18, -235), P(18, -20), P(170, -36)], { x: b.x, y: b.y, rot: b.rot });
const flag = (b, t) => geo.transform([P(10, -250), P(70, -238 + Math.sin(t * 6) * 4), P(10, -226)], { x: b.x, y: b.y, rot: b.rot });
// a row of waves: scalloped top edge (Bilibin curls), flat bottom
function waveRow(i, t, closed = true) {
  const y0 = HORIZON + 30 + i * 92, R = 42, period = 118, off = (i % 2) * period / 2 + Math.sin(t * 0.9 + i) * 10;
  const top = [];
  for (let x = -140 + off; x < 2080; x += period) {
    for (let j = 0; j <= 10; j++) { const a = Math.PI + (j / 10) * Math.PI; top.push(P(x + R + Math.cos(a) * R, y0 + Math.sin(a) * R * 0.75)); }
    top.push(P(x + period, y0));
  }
  return closed ? top.concat([P(2080, y0 + 150), P(-140, y0 + 150)]) : top;
}

/* ---------------- world 1: the pencil sketch ---------------- */
function drawSketch(d) {
  const { t, k, ink } = d, b = boatAt(t);
  const g0 = C("guides"), gF = prog(t, g0 + 1.4, g0 + 2.4);
  pen.guide(ink, shape.line(-40, HORIZON, 1960, HORIZON), { k, seed: "gh", progress: prog(t, g0, g0 + 0.5), fade: gF });
  pen.guide(ink, circ(SUN.x, SUN.y, SUN.r + 6), { k, seed: "gs", progress: prog(t, g0 + 0.2, g0 + 0.8), fade: gF });
  pen.stroke(ink, shape.line(-40, HORIZON, 1960, HORIZON - 4), { k, seed: "hz", width: 3, progress: prog(t, C("horizon"), CE("horizon")) });
  const sp = prog(t, C("sun"), CE("sun"));
  pen.stroke(ink, circ(SUN.x, SUN.y, SUN.r), { k, seed: "sun", width: 4.5, closed: true, progress: ease.inOut(sp) });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, r0 = SUN.r + 22, r1 = SUN.r + (i % 2 ? 70 : 52);
    pen.stroke(ink, shape.line(SUN.x + Math.cos(a) * r0, SUN.y + Math.sin(a) * r0, SUN.x + Math.cos(a) * r1, SUN.y + Math.sin(a) * r1), { k, seed: "sr" + i, width: 3, progress: prog(sp, 0.5 + i * 0.03, 0.62 + i * 0.03) });
  }
  for (let i = 0; i < ROWS; i++) pen.stroke(ink, waveRow(i, t, false), { k, seed: "w" + i, width: 2.6, color: i % 2 ? "soft" : "line", progress: prog(t, C("waves") + i * 0.18, CE("waves") + i * 0.05) });
  const bp = prog(t, C("boat"), CE("boat"));
  pen.stroke(ink, hull(b), { k, seed: "hull", width: 4.5, closed: true, progress: ease.inOut(bp) });
  pen.stroke(ink, mast(b), { k, seed: "mast", width: 4, progress: prog(bp, 0.3, 0.6) });
  pen.stroke(ink, sail(b), { k, seed: "sail", width: 3.5, closed: true, progress: prog(bp, 0.5, 1) });
  const hp = prog(t, C("shade"), CE("shade"));
  pen.hatch(ink, hull(b), { k, seed: "hh", progress: hp, angle: -0.7, spacing: 9, alpha: 0.7 });
  pen.hatch(ink, sail(b), { k, seed: "sh", progress: prog(hp, 0.3, 1), angle: 0.9, spacing: 12, alpha: 0.45 });
}

/* ---------------- world 2: the lubok print ---------------- */
function lubSun(c, k, t) {
  const { x, y, r } = SUN, rr = t * 0.05;
  for (let i = 0; i < 16; i++) {
    const a = rr + (i / 16) * TAU, ca = Math.cos(a), sa = Math.sin(a), nx = -sa, ny = ca;
    if (i % 2 === 0) pen.flat(c, [P(x + ca * (r + 4) + nx * 17, y + sa * (r + 4) + ny * 17), P(x + ca * (r + 82), y + sa * (r + 82)), P(x + ca * (r + 4) - nx * 17, y + sa * (r + 4) - ny * 17)], { k, seed: "ray" + i, color: "orange" });
    else {
      const L = [], R = [];
      for (let j = 0; j <= 10; j++) { const u = j / 10, dd = r + 4 + u * 60, w = 11 * (1 - u) + 1, sw = Math.sin(u * Math.PI * 2) * 7; L.push(P(x + ca * dd + nx * (sw + w), y + sa * dd + ny * (sw + w))); R.push(P(x + ca * dd + nx * (sw - w), y + sa * dd + ny * (sw - w))); }
      pen.flat(c, L.concat(R.reverse()), { k, seed: "ray" + i, color: "sun" });
    }
  }
  pen.flat(c, circ(x, y, r, 90), { k, seed: "disc", color: "sun" });
  pen.stroke(c, circ(x, y, r - 13, 90), { k, seed: "in", width: 2, color: "orange", closed: true, sketch: false, taper: false, wobble: 0.4 });
  for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; pen.flat(c, circ(x + Math.cos(a) * (r - 6.5), y + Math.sin(a) * (r - 6.5), 2.8, 10), { color: "red", outline: 0 }); }
  // face
  const w0 = C("wink"), wink = prog(t, w0, w0 + 0.1) * (1 - prog(t, w0 + 0.3, w0 + 0.45));
  [[x - 38, y - 10, 0], [x + 36, y - 10, wink]].forEach(([ex, ey, lid], i) => {
    const eye = shape.ellipse(ex, ey, 17, 11, { n: 24 });
    if (lid > 0.5) { pen.stroke(c, shape.arc(ex, ey - 4, 14, deg(30), deg(150), 12), { k, seed: "lid" + i, width: 3.4, sketch: false, taper: false }); return; }
    pen.flat(c, eye, { k, seed: "eye" + i, color: "sheet", outline: 2.4 });
    pen.flat(c, circ(ex + 3, ey, 6.5, 16), { color: "line", outline: 0 });
    pen.stroke(c, shape.arc(ex, ey - 18, 22, deg(-150), deg(-30), 14), { k, seed: "brow" + i, width: 3, sketch: false, taper: false });
  });
  pen.stroke(c, [P(x - 2, y - 2), P(x - 7, y + 17), P(x + 3, y + 19)], { k, seed: "nose", width: 2.6, sketch: false, taper: false });
  [[x - 64, y + 26], [x + 60, y + 26]].forEach(([cx, cy]) => pen.flat(c, circ(cx, cy, 15, 24), { color: "red", alpha: 0.85, outline: 0 }));
  pen.stroke(c, shape.arc(x - 2, y + 4, 46, deg(38), deg(142), 22), { k, seed: "smile", width: 3.4, sketch: false, taper: false });
}
function drawPrint(d) {
  const { t, k, ink, glow } = d, b = boatAt(t);
  // sky band and a few lubok clouds
  pen.flat(ink, [P(-100, -100), P(2020, -100), P(2020, HORIZON), P(-100, HORIZON)], { color: "sheet", outline: 0 });
  [[300, 180], [820, 120], [1780, 520]].forEach(([cx, cy], i) => {
    const puffs = [];
    for (let j = 0; j <= 18; j++) { const a = Math.PI + (j / 18) * Math.PI, bump = 1 + 0.25 * Math.sin(j * 1.9); puffs.push(P(cx + Math.cos(a) * 150 * bump, cy + Math.sin(a) * 50 * bump)); }
    pen.flat(ink, puffs.concat([P(cx + 150, cy + 14), P(cx - 150, cy + 14)]), { k, seed: "cl" + i, color: "paper", outline: 2.6 });
  });
  lubSun(ink, k, t);
  // waves back to front; a white curl on every crest
  for (let i = 0; i < ROWS; i++) {
    const row = waveRow(i, t);
    pen.flat(ink, row, { k, seed: "wr" + i, color: i % 2 ? "sky" : "navy", outline: 3 });
    const y0 = HORIZON + 30 + i * 92, off = (i % 2) * 59 + Math.sin(t * 0.9 + i) * 10;
    for (let x = -140 + off; x < 2080; x += 118) pen.stroke(ink, shape.arc(x + 42, y0 - 6, 16, deg(200), deg(330), 10), { k, seed: "cu" + i + "_" + Math.round(x), width: 3, color: "sheet", sketch: false, taper: false, wobble: 0.4 });
    if (i === 1) { // the boat sits between the second and third rows
      pen.flat(ink, hull(b), { k, seed: "hull", color: "brown" });
      const hp = hull(b);
      for (let j = 1; j < 9; j++) { const u = j / 9, q = P(lerp(hp[0].x, hp[1].x, u), lerp(hp[0].y, hp[1].y, u) + 22); pen.flat(ink, circ(q.x, q.y, 6, 12), { color: "warm", outline: 1.6 }); }
      pen.stroke(ink, mast(b), { k, seed: "mast", width: 6, sketch: false, taper: false, wobble: 0.4 });
      pen.flat(ink, sail(b), { k, seed: "sail", color: "a1" });
      const s = sail(b);
      pen.stroke(ink, shape.zigzag(s[0].x + 14, (s[0].y + s[1].y) / 2, s[2].x - 30, (s[0].y + s[1].y) / 2 + 6, 4, 10), { k, seed: "zz", width: 4, color: "warm", sketch: false, taper: false });
      pen.flat(ink, flag(b, t), { k, seed: "flag", color: "a2", outline: 2.2 });
    }
  }
  // frame and ribbon, in frame pixels
  d.screen(ink, () => {
    fx.ornamentFrame(ink, prog(t, C("frame"), CE("frame")), { k });
    fx.ribbon(ink, TITLE, 760, 150, 640, prog(t, C("ribbon"), CE("ribbon")), { k });
  });
  // a little warm sparkle on the sun when it winks
  const sp = prog(t, C("wink"), C("wink") + 0.6);
  if (sp > 0 && sp < 1) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU, rr = 150 + 60 * ease.out(sp), x = SUN.x + Math.cos(a) * rr, y = SUN.y + Math.sin(a) * rr; pen.flat(glow, geo.transform(shape.star(x, y, 14 * (1 - sp) + 4, 5, 4), { rot: a, ox: x, oy: y }), { color: "warm", outline: 0 }); }
}

const SKETCH_CAM = Sketch.cam.keys([[0, { fx: 960, fy: 540, zoom: 1.0 }], [3.2, { fx: 1240, fy: 420, zoom: 1.22 }, "in"]]);
const PRINT_CAM = Sketch.cam.keys([[3.2, { fx: 1240, fy: 420, zoom: 1.22 }], [4.6, { fx: 960, fy: 540, zoom: 1.0 }, "out"]]);

Sketch.mount({
  palette: "graphite",
  palettes: ["lubok"],
  scenes: [
    { id: "sketch", from: -1, to: C("twist"), palette: "graphite", camera: SKETCH_CAM, draw: drawSketch },
    { id: "print", from: C("twist"), to: 99, palette: "lubok", camera: PRINT_CAM, in: { type: "iris", dur: 0.8 }, draw: drawPrint },
  ],
});
