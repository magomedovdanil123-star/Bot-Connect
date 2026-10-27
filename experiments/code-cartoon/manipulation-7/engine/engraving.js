/* ============================================================================
 * ENGRAVINGS — pictures turned into white engraver's lines on black (scripts/engrave.py), drawn with light.
 * Loaded by the template after sketch.js; adds Sketch.engraving (unused until you load something).
 *
 *   const E = Sketch.engraving;
 *   E.load(["zeus", "temple"]);                    // top level, before mount: assets/eng/zeus-0.png ..-2.png
 *   Sketch.mount({ setup: E.decode, draw(d) {
 *     const Z = E.draw(d.ink, "zeus", { t: d.t, x: 960, y: 560, h: 1100,
 *       tint: [{ x: 600, y: 400, r: 700, color: "#9a6bff", a: 0.6 }],   // coloured light (view coords)
 *       dark: { x: 1400, y: 300, r0: 300, r1: 1400, min: 0.1 },         // only what a light reaches is seen
 *       reveal: 0.7, glitch: 30 * hit, flip: false, alpha: 1 });
 *     const eye = Z.P(390, 400);                    // a point of the engraving (its own pixels) in view coords
 *   }});
 *
 * The variants swap `rate` times a second (default 6): the lines boil like a hand-pulled print. Time can be
 * negative on the first drawing (beatLock starts it before 0): the variant is wrapped, never -1.
 * ==========================================================================*/
(function (S) {
  if (!S) return;
  const E = (S.engraving = { dir: "assets/eng", variants: 3, rate: 6, names: [] });
  const scratch = {};

  /** E.load(names, dir?, variants?) — call at top level, before Sketch.mount */
  E.load = function (names, dir = E.dir, variants = E.variants) {
    E.dir = dir; E.variants = variants;
    const map = {};
    names.forEach((n) => { E.names.push(n); for (let v = 0; v < variants; v++) map[`eng:${n}${v}`] = `${dir}/${n}-${v}.png`; });
    S.load(map);
  };
  /** the variant of the drawing at time t (wrapped: t < 0 before the first beat is fine) */
  E.variant = (t, rate = E.rate) => ((Math.floor(t * rate + 1e-6) % E.variants) + E.variants) % E.variants;
  E.image = (name, v = 0) => S.asset(`eng:${name}${v}`);
  /** decode every loaded engraving (use as mount({ setup: E.decode }) or await it inside your setup) */
  E.decode = async function () {
    for (const n of E.names) for (let v = 0; v < E.variants; v++) {
      const im = E.image(n, v);
      if (im && im.decode) await im.decode().catch(() => null);
    }
  };

  const rgba = (c, a) => S.rgba(c, a);
  /** draw an engraving. o: t (or v), x, y (anchor in the current view), h (height), ax/ay (anchor 0..1, default
   *  centre), alpha, flip, color + colorA (a flat tint), tint: [{x, y, r, color, a}], dark: {x, y, r0, r1, min},
   *  reveal 0..1 (printed from the top), glitch (px of horizontal tearing), seed.
   *  Returns { x0, y0, w, h, k, P(px, py) } — P maps a pixel of the engraving to view coords. */
  E.draw = function (c, name, o) {
    const v = o.v !== undefined ? ((o.v % E.variants) + E.variants) % E.variants : E.variant(o.t || 0, o.rate);
    const im = E.image(name, v);
    if (!im) return null;
    const h = o.h, w = (h * im.width) / im.height, x0 = o.x - w * (o.ax ?? 0.5), y0 = o.y - h * (o.ay ?? 0.5);
    const k = im.width / w;
    const cv = scratch[name] || (scratch[name] = Object.assign(document.createElement("canvas"), { width: im.width, height: im.height }));
    if (cv.width !== im.width || cv.height !== im.height) { cv.width = im.width; cv.height = im.height; }
    const s = cv.getContext("2d");
    s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = "source-over"; s.globalAlpha = 1;
    s.clearRect(0, 0, cv.width, cv.height);
    if (o.flip) { s.setTransform(-1, 0, 0, 1, cv.width, 0); s.drawImage(im, 0, 0); s.setTransform(1, 0, 0, 1, 0, 0); } else s.drawImage(im, 0, 0);
    const IX = (x) => (x - x0) * k, IY = (y) => (y - y0) * k;
    if (o.reveal !== undefined && o.reveal < 1) {
      s.globalCompositeOperation = "destination-in";
      const yy = cv.height * o.reveal, f = cv.height * 0.06, g = s.createLinearGradient(0, yy - f, 0, yy + 1);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, "rgba(0,0,0,0)");
      s.fillStyle = g; s.fillRect(0, 0, cv.width, cv.height);
    }
    if (o.dark) {
      s.globalCompositeOperation = "destination-in";
      const D = o.dark, g = s.createRadialGradient(IX(D.x), IY(D.y), D.r0 * k, IX(D.x), IY(D.y), D.r1 * k);
      g.addColorStop(0, "rgba(0,0,0,1)"); g.addColorStop(1, `rgba(0,0,0,${D.min ?? 0})`);
      s.fillStyle = g; s.fillRect(0, 0, cv.width, cv.height);
    }
    s.globalCompositeOperation = "source-atop";
    if (o.color) { s.globalAlpha = o.colorA ?? 0.8; s.fillStyle = o.color; s.fillRect(0, 0, cv.width, cv.height); s.globalAlpha = 1; }
    (o.tint || []).forEach((L) => {
      if (!(L.r > 0)) return;
      const g = s.createRadialGradient(IX(L.x), IY(L.y), 0, IX(L.x), IY(L.y), L.r * k);
      g.addColorStop(0, rgba(L.color, L.a ?? 0.9)); g.addColorStop(1, rgba(L.color, 0));
      s.fillStyle = g; s.fillRect(0, 0, cv.width, cv.height);
    });
    c.save();
    c.globalAlpha = o.alpha ?? 1;
    if (o.glitch > 0.5) {                             // CRT tearing: bands slide sideways, new bands every drawing
      const r = S.rng("tear", name, o.seed || 0, Math.floor((o.t || 0) * 12)), n = 14;
      for (let i = 0; i < n; i++) {
        const sy = (cv.height * i) / n, sh = cv.height / n, dx = r() < 0.35 ? r.range(-1, 1) * o.glitch : 0;
        c.drawImage(cv, 0, sy, cv.width, sh, x0 + dx, y0 + sy / k, w, sh / k);
      }
    } else c.drawImage(cv, x0, y0, w, h);
    c.restore();
    return { x0, y0, w, h, k, P: (px, py) => ({ x: x0 + (o.flip ? im.width - px : px) / k, y: y0 + py / k }) };
  };

  /** a piece of an engraving fitted into a box (an eye in a window): crop = [name, sx, sy, sw, sh] */
  E.crop = function (c, crop, x, y, w, h, o = {}) {
    const [name, sx, sy, sw, sh] = crop, im = E.image(name, E.variant(o.t || 0));
    if (!im) return;
    const k = Math.max(w / sw, h / sh);
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    c.drawImage(im, sx, sy, sw, sh, x + (w - sw * k) / 2, y + (h - sh * k) / 2, sw * k, sh * k);
    if (o.tint) { c.globalCompositeOperation = "source-atop"; c.fillStyle = rgba(o.tint, o.tintA ?? 0.35); c.fillRect(x, y, w, h); }
    c.restore();
  };
})(window.Sketch);
