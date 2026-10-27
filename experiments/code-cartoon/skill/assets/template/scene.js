/* ============================================================================
 * STARTER SCENE — "a sketch becomes light". Works in any format (9:16, 16:9, 1:1, 4:5):
 * the layout is computed from the frame size. Replace the story, keep the structure:
 *   1. timing only through d.cue("id")  (cues.js is shared with the sound)
 *   2. colours only through roles       (d.col / color: "a1")
 *   3. every random value keyed by object id + d.k
 *   4. phases: cold & small  ->  TWIST at ~38% (cue "twist")  ->  warm & big  ->  poster (last 3 s)
 * ==========================================================================*/
const PALETTE = "__PALETTE__";          // <- recolour the whole video here (see engine/palettes.js)
const TITLE = "__TITLE__";
const CAPTION_1 = "first, a sketch";
const CAPTION_2 = "then — light!";
const { pen, shape, geo, ease, prog, lerp, rng } = Sketch;

// ---- layout from the frame size ---------------------------------------------
const ROOT = document.querySelector("[data-composition-id]");
const W = +ROOT.dataset.width, H = +ROOT.dataset.height;
const WIDE = W / H >= 1.2;
const L = WIDE
  ? { s: H / 1080, cx: W * 0.32, cy: H * 0.47, capX: W * 0.68, capY: H * 0.3, titleX: W * 0.68, titleY: H * 0.66, textW: W * 0.5 }
  : (() => { const s = Math.min(W / 1080, (H / 1920) * 1.25); return { s, cx: W / 2, cy: H * 0.445, capX: W / 2, capY: H * 0.172, titleX: W / 2, titleY: H * 0.77, textW: W * 0.9 }; })();
const CAP_FONT = `700 ${Math.round(Math.max(84, 96 * L.s))}px Caveat`;
const TITLE_FONT = `700 ${Math.round(Math.max(110, 150 * L.s))}px Caveat`;

// ---- geometry: drawn around (0,0) in a 1080-wide design space, placed by L --------
const R = 230, deg = (a) => (a * Math.PI) / 180;
const T = (pts) => geo.transform(pts, { x: L.cx, y: L.cy, scale: L.s });
const glass = T([{ x: -70, y: 300 }, { x: -92, y: 250 }]
  .concat(shape.ellipse(0, 0, R, R, { a0: deg(118), sweep: deg(304), n: 90 }))
  .concat([{ x: 92, y: 250 }, { x: 70, y: 300 }]));
const base = [shape.line(-78, 300, 78, 300), shape.line(-72, 328, 72, 320), shape.line(-70, 354, 70, 346),
  shape.line(-66, 380, 66, 372), shape.arc(0, 384, 46, deg(10), deg(170))].map(T);
const filament = [shape.line(-40, 290, -34, 70), shape.zigzag(-34, 70, 34, 70, 4, 16), shape.line(34, 70, 40, 290)].map(T);
// shading crescent: shadow side on light paper, highlight side on dark paper
const crescent = (dark) => {
  const a0 = dark ? deg(190) : deg(-20), a1 = dark ? deg(280) : deg(110);
  const outer = shape.arc(0, 0, R - 14, a0, a1, 40);
  const ic = dark ? { x: 46, y: 40 } : { x: -46, y: -30 };
  return T(outer.concat(shape.arc(ic.x, ic.y, R - 30, a1, a0, 40)));
};
// rays everywhere except straight down (they would cross the screw base)
const rays = Array.from({ length: 12 }, (_, i) => deg(-90 + i * 30 + 15)).filter((a) => Math.abs(a - deg(90)) > deg(40))
  .map((a) => T(shape.line(Math.cos(a) * 285, Math.sin(a) * 285, Math.cos(a) * 385, Math.sin(a) * 385)));
const guides = [T(shape.circle(0, 0, R + 4)), T(shape.line(0, -R - 90, 0, 440)), T(shape.line(-R - 80, 0, R + 80, 0))];
const baseShade = T(shape.rect(-74, 302, 148, 78));
const bulbCore = T(shape.circle(0, 0, R - 40));

Sketch.mount({
  palette: PALETTE,

  // camera is a pure function of time: small & cold, then a punch-in on the twist (the bulb stays put)
  camera: (t) => {
    const tw = Sketch.cue("twist");
    const z = t < tw ? lerp(0.9, 0.93, prog(t, 0, tw)) : lerp(0.93, 1.03, ease.outBack(prog(t, tw, tw + 0.6)));
    const c = Sketch.cam.anchor({ x: L.cx, y: L.cy }, { x: L.cx, y: L.cy - 40 * L.s }, z);
    return Object.assign(c, { shake: t >= tw && t < tw + 0.35 ? 6 : 0.6 });
  },

  draw(d) {
    const { t, k, ink, glow } = d;
    const dark = d.pal.shade === "dark";
    const tw = d.cue("twist"), lit = t >= tw, s = L.s;

    // 1) construction lines: fast, faint, then fade
    const g0 = d.cue("guides"), gF = prog(t, g0 + 1.6, g0 + 2.6);
    guides.forEach((g, i) => pen.guide(ink, g, { k, seed: "g" + i, progress: prog(t, g0 + i * 0.2, g0 + 0.5 + i * 0.2), fade: gF }));

    // 2) the bulb, drawn in real time
    const o = d.cue("outline");
    pen.stroke(ink, glass, { k, seed: "glass", width: 5.5 * s, progress: ease.inOut(prog(t, o, d.cueEnd("outline"))) });
    pen.strokes(ink, base, { k, seed: "base", width: 4 * s, progress: prog(t, d.cue("base"), d.cueEnd("base")) });

    // 3) shading (hatch, never a flat fill)
    pen.hatch(ink, crescent(dark), { k, seed: "shade", progress: prog(t, d.cue("shade"), d.cueEnd("shade")), angle: -0.75, spacing: 10 * s, alpha: 0.7 });
    pen.hatch(ink, baseShade, { k, seed: "bshade", progress: prog(t, d.cue("shade") + 0.4, d.cueEnd("shade")), angle: 0.9, spacing: 7 * s, alpha: 0.6 });

    // 4) filament: cold ink before the twist, warm + glowing after it
    const fp = prog(t, d.cue("filament"), d.cueEnd("filament"));
    pen.strokes(lit ? glow : ink, filament, { k, seed: "fil", width: (lit ? 5 : 3.5) * s, color: lit ? "warm" : "soft", progress: fp });

    // 5) THE TWIST: a local flash, rays pop out, sparkles
    if (lit) {
      const p = prog(t, tw, tw + 0.5), flash = 1 - prog(t, tw, tw + 0.35);
      if (flash > 0) Sketch.fx.flash(glow, 0.35 * flash, { cx: L.cx, cy: L.cy - 40 * s, radius: R * 1.8 * s });
      rays.forEach((r, i) => {
        const rp = ease.outBack(prog(t, tw + 0.08 + i * 0.025, tw + 0.4 + i * 0.025));
        pen.stroke(glow, geo.transform(r, { scale: 0.75 + 0.25 * rp, ox: L.cx, oy: L.cy }), { k, seed: "ray" + i, width: 7 * s, color: i % 3 ? "warm" : "a1", progress: rp });
      });
      ["spark1", "spark2", "spark3"].forEach((id, i) => {
        const st = d.cue(id), sp = prog(t, st, st + 0.25);
        if (sp <= 0) return;
        const r = rng("spark", i), x = L.cx + r.range(-330, 330) * s, y = L.cy + r.range(-380, 260) * s, size = 26 * s * ease.pop(sp);
        pen.stroke(glow, shape.star(x, y, size, size * 0.4, 4), { k, seed: "st" + i, width: 3.5 * s, color: "a2", closed: true });
      });
      // the glass gets a warm inner hatch: the light "fills" the bulb
      pen.hatch(glow, bulbCore, { k, seed: "light", color: "warm", alpha: 0.35, spacing: 14 * s, angle: 0.5, progress: ease.out(p) });
    }

    // 6) text — caption, then the poster title (out of the bottom 15% in vertical formats)
    const w1 = d.cue("write1"), e1 = prog(t, d.cue("erase1"), d.cueEnd("erase1"));
    if (e1 < 1) pen.text(ink, CAPTION_1, L.capX, L.capY, { k, font: CAP_FONT, maxWidth: L.textW, progress: prog(t, w1, d.cueEnd("write1")), alpha: 1 - e1 });
    pen.text(lit ? glow : ink, CAPTION_2, L.capX, L.capY, { k, font: CAP_FONT, maxWidth: L.textW, color: "warm", progress: prog(t, d.cue("write2"), d.cueEnd("write2")) });
    const tp = prog(t, d.cue("title"), d.cueEnd("title"));
    pen.text(ink, TITLE, L.titleX, L.titleY, { k, font: TITLE_FONT, maxWidth: L.textW, progress: tp });
    if (tp >= 1) pen.stroke(ink, shape.wave(L.titleX - 230 * s, L.titleY + 35 * s, L.titleX + 230 * s, 6 * s, 2.5), { k, seed: "underline", width: 5 * s, color: "a1", progress: prog(t, d.cue("titlepop"), d.cue("titlepop") + 0.3) });
  },
});
