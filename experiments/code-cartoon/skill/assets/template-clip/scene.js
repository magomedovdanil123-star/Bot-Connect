/* ============================================================================
 * CLIP STARTER — one world per part of the song. Works with any song after `cartoon song`
 * and in any format (the layout comes from the frame size). Replace the worlds, keep the structure:
 *   1. the parts come from cues.js "song" (Sketch.songScenes): verse, chorus, bridge, intro, outro, "*"
 *   2. the music drives the picture: d.beat / d.pulse() / d.energy, new things appear on bars
 *   3. the chorus is a motif that GROWS with every repeat (sec.n of sec.of; sec.last = the payoff)
 *   4. lyrics through Sketch.fx.lyric in the safe area (never in the bottom 15 % of 9:16)
 *   5. colours only by role, randomness keyed by object + d.k, timing only from cues.js
 * ==========================================================================*/
const PALETTE = "__PALETTE__";           // the chorus and the poster (the warm world)
const PENCIL = "graphite";               // verses and the intro (the cold world)
const NIGHT = "chalk";                   // bridge / instrumental (the third world)
const TITLE = "__TITLE__";
const { pen, shape, geo, ease, prog, lerp, rng, fx } = Sketch;
const TAU = Math.PI * 2;

// ---- layout from the frame size ----------------------------------------------
const ROOT = document.querySelector("[data-composition-id]");
const W = +ROOT.dataset.width, H = +ROOT.dataset.height;
const WIDE = W / H >= 1.2;
const s = WIDE ? H / 1080 : Math.min(W / 1080, (H / 1920) * 1.25);
const GROUND = H * (WIDE ? 0.6 : 0.5);              // the horizon of the landscape
const SUN = { x: W / 2, y: H * (WIDE ? 0.36 : 0.33), r: 150 * s };
const SP = W * (WIDE ? 0.3 : 0.42);                  // landscape: one object per bar, this far apart
const TITLE_FONT = `700 ${Math.round(Math.max(120, 150 * s))}px Caveat`;
const bars = () => (window.CUES.song && window.CUES.song.bars) || [0];
const barT = (b) => {                                // start of bar b, extended before and after the song
  const B = bars(), L = B.length > 1 ? B[1] - B[0] : 2;
  return b < 0 ? B[0] + b * L : b < B.length ? B[b] : B[B.length - 1] + (b - B.length + 1) * L;
};

// ---- lyrics (and the title at the end of a cut) --------------------------------
function words(d, style, layer) {
  const line = d.lyric();
  if (d.window.cut && d.window.left < 2.4) {          // a cut ends on its own poster
    d.screen(layer || d.ink, (c) => pen.text(c, TITLE, W / 2, Sketch.safe().y + Sketch.safe().h * 0.85, { k: d.k, font: TITLE_FONT, progress: prog(d.window.left, 2.4, 1.6) }));
    return;
  }
  d.screen(layer || d.ink, (c) => fx.lyric(c, line, { k: d.k, style }));
}

// ---- world 1: a landscape drawn bar by bar (verse, intro, "*") ---------------------
const OBJ = ["tree", "house", "pine", "lamp", "cloud"];
function object(kind, x, r) {
  const T = (pts) => geo.transform(pts, { x, y: GROUND, scale: s * r.range(0.85, 1.15) });
  if (kind === "tree") return { lines: [shape.line(0, 0, 0, -150), shape.line(0, -90, 34, -130)].map(T), fill: T(shape.ellipse(0, -215, 92, 86)) };
  if (kind === "pine") return { lines: [shape.line(0, 0, 0, -40)].map(T), fill: T([{ x: -80, y: -40 }, { x: 0, y: -280 }, { x: 80, y: -40 }]) };
  if (kind === "house") return { lines: [shape.rect(-90, -150, 180, 150), shape.rect(-55, -110, 40, 40), shape.rect(20, -80, 40, 80)].map(T), fill: T([{ x: -110, y: -150 }, { x: 0, y: -250 }, { x: 110, y: -150 }]) };
  if (kind === "lamp") return { lines: [shape.line(0, 0, 0, -260), shape.arc(26, -260, 26, Math.PI, TAU)].map(T), fill: T(shape.circle(52, -236, 16)) };
  return { lines: [shape.wave(-60, -470, 60, 8, 1.5)].map(T), fill: T(shape.ellipse(0, -400, 120, 46)) };
}
const landscape = {
  palette: PENCIL,
  // the camera travels one object per bar: a new one is drawn at 65 % of the width and drifts left
  camera: (t) => { const b = Sketch.beat(t); return { fx: (b.bar + b.barPhase) * SP - W * 0.15, fy: H / 2, zoom: 1 + 0.02 * Sketch.pulse(t, { grid: "bar", decay: 0.3 }) }; },
  draw(d, l) {
    const { t, k, ink } = d, b = d.beat;
    for (let i = b.bar - 4; i <= b.bar + 1; i++) {   // the ground, one stable piece per bar
      pen.stroke(ink, shape.wave(i * SP - SP / 2, GROUND, i * SP + SP / 2 + 6, 5 * s, 2), { k, seed: "ground" + i, width: 3 * s, progress: prog(t, barT(i) - 1, barT(i)) });
    }
    for (let i = b.bar - 3; i <= b.bar; i++) {       // an object on beat 1 and a smaller one on beat 3 of every bar
      for (let h = 0; h < 2; h++) {
        const r = rng("obj", i, h), kind = r.pick(h ? ["pine", "tree", "cloud"] : OBJ);
        const o = object(kind, (i + h * 0.5) * SP + r.range(-0.08, 0.08) * SP, r);
        const t0 = barT(i) + h * 2 * b.len, p = prog(t, t0, t0 + b.len * 1.5);
        if (p <= 0) continue;
        pen.strokes(ink, o.lines, { k, seed: "ol" + i + h, width: 4 * s, progress: ease.inOut(p) });
        pen.stroke(ink, o.fill, { k, seed: "of" + i + h, width: 4 * s, closed: true, progress: ease.inOut(p) });
        pen.hatch(ink, o.fill, { k, seed: "oh" + i + h, progress: prog(p, 0.5, 1), angle: -0.7, spacing: 10 * s, alpha: 0.6 });
      }
    }
    words(d, "write");
  },
};

// ---- world 2: the sun of the chorus — grows with every chorus ---------------------
function sun(d, sec, calm) {
  const { t, k, ink, glow } = d, n = sec ? sec.n : 0, of = sec ? sec.of : 1, last = !sec || sec.last;
  const R = SUN.r * (1 + 0.18 * n), rays = 10 + 4 * n, hit = calm ? 0.1 : d.pulse();
  const born = sec ? prog(sec.t, 0, d.beat.len * 2) : 1;
  pen.stroke(glow, shape.circle(SUN.x, SUN.y, R), { k, seed: "sun", width: 6 * s, color: "warm", closed: true, progress: ease.inOut(born) });
  pen.hatch(glow, shape.circle(SUN.x, SUN.y, R * 0.9), { k, seed: "sunh", color: "warm", alpha: 0.25 + 0.2 * (n / Math.max(1, of - 1)), spacing: 14 * s, angle: 0.5, progress: prog(born, 0.5, 1) });
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * TAU + t * 0.08, r0 = R + 26 * s, r1 = R + (60 + 50 * hit + (i % 2) * 30) * s;
    pen.stroke(i % 3 ? glow : ink, shape.line(SUN.x + Math.cos(a) * r0, SUN.y + Math.sin(a) * r0, SUN.x + Math.cos(a) * r1, SUN.y + Math.sin(a) * r1),
      { k, seed: "ray" + i, width: 5 * s, color: i % 3 ? "warm" : "a1", progress: prog(born, 0.3 + (i / rays) * 0.5, 0.5 + (i / rays) * 0.5) });
  }
  if (last && !calm) {                               // the payoff: a second ring
    pen.stroke(glow, shape.circle(SUN.x, SUN.y, R + 150 * s), { k, seed: "ring", width: 3 * s, color: "a2", closed: true, progress: prog(sec.t, d.beat.len * 2, d.beat.len * 6) });
  }
  if (calm) return;
  const b = d.beat;
  for (let i = b.i - 2; i <= b.i; i++) {             // a sparkle on every beat
    const r = rng("spark", i), bt = b.t0 - (b.i - i) * b.len, sp = prog(t, bt, bt + 0.25), out = prog(t, bt + 0.6, bt + 1.2);
    if (sp <= 0 || out >= 1) continue;
    const a = r.range(0, TAU), dist = R + r.range(180, 320) * s, size = 24 * s * ease.pop(sp) * (1 - out);
    pen.stroke(glow, shape.star(SUN.x + Math.cos(a) * dist, SUN.y + Math.sin(a) * dist * 0.8, size, size * 0.4, 4), { k, seed: "st" + i, width: 3.5 * s, color: "a2", closed: true });
  }
}
const chorus = {
  palette: PALETTE,
  camera: (t, l) => Sketch.cam.kick({ fx: W / 2, fy: H / 2, zoom: 1 + 0.03 * l.sec.n }, Sketch.pulse(t, { grid: "bar", decay: 0.35 }), 0.03),
  draw(d, l) { sun(d, l.sec, false); words(d, "karaoke", d.glow); },
};

// ---- world 3: night — a star on every beat (bridge, instrumental) ---------------
const night = {
  palette: NIGHT,
  camera: (t, l) => ({ fx: W / 2, fy: H / 2, zoom: lerp(1, 1.08, ease.inOut(l.p)) }),
  draw(d, l) {
    const { t, k, ink, glow } = d, b = d.beat, first = Sketch.beat(l.sec.from).i;
    const moon = shape.arc(W * 0.78, H * 0.2, 70 * s, -1.2, 2.2, 40).concat(shape.arc(W * 0.78 + 28 * s, H * 0.2 - 10 * s, 58 * s, 2.0, -1.0, 40).reverse());
    pen.stroke(ink, moon, { k, seed: "moon", width: 4 * s, closed: true, progress: prog(l.t, 0, b.len * 2) });
    let prev = null;
    for (let i = Math.max(first, b.i - 24); i <= b.i; i++) {
      const r = rng("star", i), x = W * r.range(0.08, 0.92), y = H * r.range(0.08, WIDE ? 0.55 : 0.6), bt = Sketch.beat(l.sec.from).t0 + (i - first) * b.len;
      const p = prog(t, bt, bt + 0.3), size = (14 + 10 * r()) * s * ease.pop(p);
      if (p <= 0) break;
      pen.stroke(glow, shape.star(x, y, size, size * 0.42, 5), { k, seed: "nst" + i, width: 3 * s, color: i % 4 ? "line" : "warm", closed: true });
      if (prev && (i - first) % 4) pen.stroke(ink, shape.line(prev.x, prev.y, x, y), { k, seed: "cl" + i, width: 2 * s, color: "soft", progress: p });
      prev = { x, y };
    }
    words(d, "write");
  },
};

// ---- intro and outro ----------------------------------------------------------
const intro = {
  palette: PENCIL,
  camera: () => ({ fx: W / 2, fy: H / 2, zoom: 0.96 }),
  draw(d, l) {
    // already half drawn on frame 0 (the cover in the feed): everything starts before 0
    const { t, k, ink } = d, gF = prog(t, 1.6, 2.6), end = Math.max(2, l.sec.to);
    pen.guide(ink, shape.circle(SUN.x, SUN.y, SUN.r + 6 * s), { k, seed: "g1", progress: prog(t, -1.6, -0.4), fade: gF });
    pen.guide(ink, shape.line(0, GROUND, W, GROUND), { k, seed: "g2", progress: prog(t, -1.4, -0.2), fade: gF });
    pen.stroke(ink, shape.circle(SUN.x, SUN.y, SUN.r), { k, seed: "isun", width: 4.5 * s, closed: true, progress: ease.inOut(prog(t, -1.2, Math.min(1.2, end * 0.4))) });
    pen.text(ink, TITLE, W / 2, GROUND + 160 * s, { k, font: TITLE_FONT, maxWidth: W * 0.84, progress: prog(t, -1.0, Math.min(1.8, end * 0.6)) });
    const b = d.beat;                                  // a pencil ray on every beat of the intro
    for (let i = 0; i < 12; i++) {
      const bt = b.t0 - (b.i - i) * b.len, a = (i / 12) * TAU - Math.PI / 2, r0 = SUN.r + 24 * s, r1 = SUN.r + (i % 2 ? 80 : 58) * s;
      if (i > b.i) break;
      pen.stroke(ink, shape.line(SUN.x + Math.cos(a) * r0, SUN.y + Math.sin(a) * r0, SUN.x + Math.cos(a) * r1, SUN.y + Math.sin(a) * r1), { k, seed: "ir" + i, width: 3 * s, progress: prog(t, bt, bt + b.len * 0.6) });
    }
    words(d, "write");
  },
};
const outro = {
  palette: PALETTE,
  camera: () => ({ fx: W / 2, fy: H / 2, zoom: 1 }),
  draw(d, l) {
    sun(d, null, true);                                // the poster: the full sun, nothing fast moves
    if (d.lyric()) return words(d, "karaoke", d.glow);
    d.screen(d.glow, (c) => pen.text(c, TITLE, W / 2, Sketch.safe().y + Sketch.safe().h * 0.85, { k: d.k, font: TITLE_FONT, color: "warm", maxWidth: W * 0.84, progress: prog(l.t, 0.2, 1.6) }));
  },
};

Sketch.mount({
  palette: PALETTE,
  scenes: Sketch.songScenes({ intro, verse: landscape, prechorus: landscape, chorus, bridge: night, instrumental: night, outro, "*": landscape }),
});
