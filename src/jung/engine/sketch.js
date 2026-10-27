/* ============================================================================
 * Sketch engine — deterministic hand-drawn animation for HyperFrames
 * ----------------------------------------------------------------------------
 * Everything is a pure function of time t. No Math.random, no Date.now,
 * no requestAnimationFrame. Same input -> same video, pixel for pixel.
 *
 *   Sketch.mount({ palette, camera(t), draw(d) })      -> boots the composition
 *   d.t      held time (on twos: changes 12x per second)
 *   d.raw    real time
 *   d.k      drawing index (integer, changes 12x/s) — seed for line boil
 *   d.ink    2D context of the ink layer (world coords = frame pixels)
 *   d.glow   2D context of the glow layer (drawn on top of ink + bloomed)
 *   d.col(role, alpha)  colour from the palette by role
 *   d.cue(id)           time constant from cues.js (the same one the sound uses)
 *
 * Several worlds in one video (since 1.1):
 *   mount({ palettes: [...] }), d.setPalette(name), Sketch.withPalette(name, fn)
 *   d.useCamera(ctx, cam), Sketch.cam.keys(...), d.screen(ctx, fn)
 *   Sketch.sequence(scenes) — scenes with "cut" | "iris" | "flash" transitions
 *   Line widths follow the camera zoom (Sketch.config.zoomComp), so a 5x push-in
 *   does not turn pencil lines into ropes.
 *
 * Clips to a song (since 1.2, cues.js "song" from `cartoon song`):
 *   Sketch.songScenes({ verse, chorus, ... }) — one world per part of the song
 *   d.beat, d.pulse(), d.energy, d.sec, d.lyric() + Sketch.fx.lyric(), Sketch.safe()
 *   beatLock: on twos, a new drawing starts on every beat; cues "window" = a cut of the clip
 *
 * API reference: references/engine-api.md
 * ==========================================================================*/
(function (global) {
  "use strict";
  const S = {};
  S.version = "1.2.0";
  /* zoomComp: line width, wobble and hatch spacing are multiplied by zoom^-zoomComp
     (0 = off). Keeps strokes readable when the camera pushes in or pulls out. */
  S.config = { fpsDraw: 12, onTwos: true, boil: 1, paperJitter: 0.8, grain: 0.35, zoomComp: 0.75 };
  S.zoom = 1; S.zoomK = 1;
  S.setZoom = function (z) {
    S.zoom = z || 1;
    S.zoomK = S.config.zoomComp ? Math.min(1.6, Math.max(0.25, Math.pow(Math.max(1e-3, S.zoom), -S.config.zoomComp))) : 1;
  };
  const zk = (o) => (o && o.zoomComp === false ? 1 : S.zoomK);

  /* ------------------------------------------------------------------ random */
  function strHash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  S.hash = function () {
    let h = 0x811c9dc5 >>> 0;
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      const n = typeof v === "string" ? strHash(v) : (Math.round(v * 1000) | 0);
      h ^= n + 0x9e3779b9 + (h << 6) + (h >>> 2);
      h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
      h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
      h ^= h >>> 16;
    }
    return h >>> 0;
  };
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** Seeded generator. Key it by OBJECT identity (id, index), never share one
   *  stream across objects whose visibility changes — see pitfalls #1. */
  S.rng = function () {
    const r = mulberry32(S.hash.apply(null, arguments));
    r.range = (a, b) => a + (b - a) * r();
    r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.sign = () => (r() < 0.5 ? -1 : 1);
    r.gauss = () => { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return r;
  };
  /** Smooth 1D value noise in [0,1]. */
  S.noise1 = function (x, seed) {
    const i = Math.floor(x), f = x - i;
    const a = (S.hash(seed, i) & 0xffff) / 0xffff, b = (S.hash(seed, i + 1) & 0xffff) / 0xffff;
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  };

  /* -------------------------------------------------------------- time/ease */
  S.frame = (t) => Math.floor(t * S.config.fpsDraw + 1e-6);
  S.held = (t) => S.frame(t) / S.config.fpsDraw;
  /** time constant from cues.js — usable anywhere (camera(), setup). A part of the song ("chorus2") works too. */
  const findCue = (id) => {
    const e = ((global.CUES && global.CUES.events) || []).find((c) => c.id === id);
    if (e) return [e.t, e.t + (e.dur || 0)];
    const s = ((global.CUES && global.CUES.song && global.CUES.song.sections) || []).find((c) => c.id === id);
    if (s) return [s.t, s.end];
    throw new Error("cue not found: " + id);
  };
  S.cue = (id) => findCue(id)[0];
  S.cueEnd = (id) => findCue(id)[1];
  S.clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  S.lerp = (a, b, k) => a + (b - a) * k;
  /** progress of t inside [t0,t1] -> 0..1 */
  S.prog = (t, t0, t1) => S.clamp((t - t0) / (t1 - t0));
  S.ease = {
    linear: (x) => x,
    in: (x) => x * x * x,
    out: (x) => 1 - Math.pow(1 - x, 3),
    inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
    outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
    outElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
    /** squash-and-stretch friendly pop: 0 -> 1.12 -> 1 */
    pop: (x) => (x < 0.6 ? S.ease.out(x / 0.6) * 1.12 : 1.12 - 0.12 * S.ease.inOut((x - 0.6) / 0.4)),
  };

  /* ---------------------------------------------------------------- colour */
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  S.rgba = function (hex, a = 1) { const c = hexToRgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  S.mix = function (h1, h2, k) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * k));
    return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  };
  S.pal = null;
  S.usePalette = function (name) {
    const p = (global.SKETCH_PALETTES || {})[name];
    if (!p) throw new Error("Unknown palette: " + name + ". See engine/palettes.js");
    S.pal = Object.assign({ name }, p);
    return S.pal;
  };
  /** colour by role: col("line"), col("a1", .5). A raw hex also works but don't. */
  S.col = function (role, a = 1) {
    const hex = role[0] === "#" ? role : S.pal[role];
    if (!hex) throw new Error("Palette '" + S.pal.name + "' has no role: " + role);
    return S.rgba(hex, a);
  };
  /** does the current palette define this role? (crayon / lubok palettes have extra roles) */
  S.has = (role) => !!(S.pal && S.pal[role]);
  /** run fn with another palette's roles, then switch back (paper is not changed) */
  S.withPalette = function (name, fn) {
    const prev = S.pal && S.pal.name;
    if (!name || name === prev) return fn();
    S.usePalette(name);
    try { return fn(); } finally { if (prev) S.usePalette(prev); }
  };

  /* -------------------------------------------------------------- geometry */
  const G = (S.geo = {});
  G.dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  G.length = function (pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += G.dist(pts[i - 1], pts[i]); return L; };
  /** resample polyline at ~step px; returns points with .s (arc length) */
  G.resample = function (pts, step) {
    const out = [];
    if (!pts.length) return out;
    out.push({ x: pts[0].x, y: pts[0].y, s: 0 });
    let s = 0, carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const d = G.dist(a, b);
      if (d === 0) continue;
      let pos = step - carry;
      while (pos <= d) {
        const k = pos / d;
        out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, s: s + pos });
        pos += step;
      }
      carry = d - (pos - step);
      s += d;
    }
    const last = pts[pts.length - 1];
    if (G.dist(out[out.length - 1], last) > 0.5) out.push({ x: last.x, y: last.y, s });
    return out;
  };
  G.resampleN = function (pts, n, closed) {
    const P = closed ? pts.concat([pts[0]]) : pts;
    const L = G.length(P);
    const r = G.resample(P, Math.max(L / (n - (closed ? 0 : 1)), 0.001));
    while (r.length < n) r.push(Object.assign({}, r[r.length - 1]));
    return r.slice(0, n);
  };
  G.bbox = function (pts) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  G.transform = function (pts, { x = 0, y = 0, scale = 1, rot = 0, ox = 0, oy = 0 } = {}) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return pts.map((p) => { const px = (p.x - ox) * scale, py = (p.y - oy) * scale; return { x: px * c - py * s + ox + x, y: px * s + py * c + oy + y }; });
  };
  /** shape morph: A and B resampled to the same count, start points aligned for closed shapes */
  G.morph = function (A, B, k, { n = 160, closed = true } = {}) {
    const a = G.resampleN(A, n, closed);
    let b = G.resampleN(B, n, closed);
    if (closed) {
      let best = 0, bestD = Infinity;
      for (let off = 0; off < n; off += 2) { let d = 0; for (let i = 0; i < n; i += 8) d += G.dist(a[i], b[(i + off) % n]); if (d < bestD) { bestD = d; best = off; } }
      b = b.map((_, i) => b[(i + best) % n]);
    }
    return a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * k, y: p.y + (b[i].y - p.y) * k }));
  };

  /* ----------------------------------------------------------------- shapes */
  const SH = (S.shape = {});
  SH.line = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y1 }];
  SH.ellipse = function (cx, cy, rx, ry, { n = 72, a0 = -Math.PI / 2, sweep = Math.PI * 2 } = {}) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (sweep * i) / n; pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }); }
    return pts;
  };
  SH.circle = (cx, cy, r, o) => SH.ellipse(cx, cy, r, r, o);
  SH.arc = (cx, cy, r, a0, a1, n = 48) => SH.ellipse(cx, cy, r, r, { n, a0, sweep: a1 - a0 });
  SH.rect = (x, y, w, h) => [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y }];
  SH.poly = function (cx, cy, r, sides, rot = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i <= sides; i++) { const a = rot + (i * 2 * Math.PI) / sides; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
    return pts;
  };
  SH.star = function (cx, cy, r1, r2, spikes = 5, rot = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i <= spikes * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / spikes; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
    return pts;
  };
  SH.wave = function (x0, y, x1, amp, waves, n = 80) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const k = i / n; pts.push({ x: x0 + (x1 - x0) * k, y: y + Math.sin(k * waves * Math.PI * 2) * amp }); }
    return pts;
  };
  SH.zigzag = function (x0, y0, x1, y1, teeth, amp) {
    const pts = [], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    for (let i = 0; i <= teeth * 2; i++) { const k = i / (teeth * 2), o = i === 0 || i === teeth * 2 ? 0 : (i % 2 ? amp : -amp); pts.push({ x: x0 + dx * k + nx * o, y: y0 + dy * k + ny * o }); }
    return pts;
  };
  /** Torn-paper polygon for collage pieces */
  SH.torn = function (x, y, w, h, seed, rough = 6) {
    const r = S.rng("torn", seed), pts = [];
    const edge = (ax, ay, bx, by) => {
      const L = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.floor(L / 7)), nx = -(by - ay) / L, ny = (bx - ax) / L;
      let off = 0;
      for (let i = 0; i < n; i++) { off = off * 0.55 + r.range(-rough, rough) * 0.6; const k = i / n; pts.push({ x: ax + (bx - ax) * k + nx * off, y: ay + (by - ay) * k + ny * off }); }
    };
    edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
    pts.push(Object.assign({}, pts[0]));
    return pts;
  };
  /** Sample an SVG path "d" into point arrays (one per sub-path). Lets you draw any icon. */
  const svgCache = new Map();
  SH.svg = function (d, { x = 0, y = 0, scale = 1, step = 3 } = {}) {
    let base = svgCache.get(d + "|" + step);
    if (!base) {
      const ns = "http://www.w3.org/2000/svg";
      let host = document.getElementById("__sketch_svg_host");
      if (!host) { host = document.createElementNS(ns, "svg"); host.id = "__sketch_svg_host"; host.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden"); document.body.appendChild(host); }
      const p = document.createElementNS(ns, "path"); p.setAttribute("d", d); host.appendChild(p);
      const L = p.getTotalLength(), subs = [];
      let cur = [], prev = null;
      for (let s = 0; s <= L; s += step) {
        const q = p.getPointAtLength(s), pt = { x: q.x, y: q.y };
        if (prev && Math.hypot(pt.x - prev.x, pt.y - prev.y) > step * 2.5) { if (cur.length > 1) subs.push(cur); cur = []; }
        cur.push(pt); prev = pt;
      }
      if (cur.length > 1) subs.push(cur);
      host.removeChild(p);
      base = subs; svgCache.set(d + "|" + step, base);
    }
    return base.map((sp) => sp.map((p) => ({ x: x + p.x * scale, y: y + p.y * scale })));
  };

  /* -------------------------------------------------------------------- pen */
  const Pen = (S.pen = {});
  function taper(u, t0, t1) {
    if (u < t0) return 0.25 + 0.75 * Math.sin((u / t0) * Math.PI * 0.5);
    if (u > 1 - t1) return 0.25 + 0.75 * Math.sin(((1 - u) / t1) * Math.PI * 0.5);
    return 1;
  }
  function tracePath(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }
  /**
   * Pencil stroke along a polyline.
   * o: { k (drawing index, required for boil), seed, width=4, color="line", alpha=1,
   *      progress=1, closed=false, wobble=1.6, breaks=1, taper=[.12,.18], sketch=true,
   *      overshoot=.05, pressure=.25, step=4 }
   * returns pen-tip {x,y} at `progress` (use it to place a pencil or trigger sparkles)
   */
  Pen.stroke = function (ctx, pts, o = {}) {
    if (!pts || pts.length < 2) return null;
    const k = o.k | 0, seed = o.seed ?? "s", z = zk(o);
    const width = (o.width ?? 4) * z, alpha = o.alpha ?? 1, wob = (o.wobble ?? 1.6) * S.config.boil * z;
    const color = o.color ?? "line", prog = S.clamp(o.progress ?? 1);
    if (prog <= 0) return null;
    const step = (o.step ?? 4) * z;
    let P = pts;
    if (o.closed) {
      const R = G.resample(pts.concat([pts[0]]), step), over = Math.floor(R.length * (o.overshoot ?? 0.05));
      P = R.concat(R.slice(1, over + 1));
    }
    const R = G.resample(P, step);
    const L = R[R.length - 1].s || 1, Lv = L * prog;
    const nseed = S.hash(seed, "n", k), gr = S.rng(seed, "gap", k);
    // pencil lifts: a few short gaps, re-rolled every drawing
    const gaps = [], nG = Math.round((L / (260 * z)) * (o.breaks ?? 1));
    for (let i = 0; i < nG; i++) { const at = gr.range(0.08, 0.92) * L; gaps.push([at, at + gr.range(3, 9) * z]); }
    const inGap = (s) => { for (const g of gaps) if (s > g[0] && s < g[1]) return true; return false; };
    const freq = 1 / 70, gx = (S.noise1(k * 0.37, seed + "gx") - 0.5) * wob, gy = (S.noise1(k * 0.41, seed + "gy") - 0.5) * wob;
    const off = (p, i, n2) => {
      const a = i > 0 ? R[i - 1] : R[i], b = i < R.length - 1 ? R[i + 1] : R[i];
      let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const d = (S.noise1(p.s * freq, nseed + n2) - 0.5) * 2 * wob;
      return { x: p.x + nx * d + gx, y: p.y + ny * d + gy };
    };
    const tp = o.taper || [0.12, 0.18], pr = o.pressure ?? 0.25;
    ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
    const pass = (wMul, aMul, n2, s0, s1) => {
      let prev = null;
      for (let i = 0; i < R.length; i++) {
        const p = R[i];
        if (p.s > Lv || p.s > s1) break;
        const q = off(p, i, n2);
        if (prev && p.s >= s0 && !inGap(p.s)) {
          const u = p.s / L, pn = S.noise1(p.s / 40, nseed + n2 + 7);
          ctx.strokeStyle = S.col(color, alpha * aMul * (0.7 + 0.3 * pn));
          ctx.lineWidth = Math.max(0.4, width * wMul * (o.taper === false ? 1 : taper(u, tp[0], tp[1])) * (1 - pr + pr * 2 * pn));
          ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        }
        prev = q;
      }
    };
    pass(1, 1, 0, 0, Infinity);
    if (o.sketch !== false) pass(0.42, 0.5, 13, L * 0.03, L * 0.97);
    ctx.restore();
    // pen tip
    for (let i = 0; i < R.length; i++) if (R[i].s >= Lv) return { x: R[i].x, y: R[i].y };
    return { x: R[R.length - 1].x, y: R[R.length - 1].y };
  };
  /** several polylines drawn one after another as `progress` goes 0..1 */
  Pen.strokes = function (ctx, list, o = {}) {
    const lens = list.map((p) => G.length(p)), total = lens.reduce((a, b) => a + b, 0) || 1;
    let acc = 0, tip = null;
    const prog = S.clamp(o.progress ?? 1);
    list.forEach((p, i) => {
      const a = acc / total, b = (acc + lens[i]) / total; acc += lens[i];
      const lp = S.clamp((prog - a) / (b - a || 1));
      if (lp > 0) tip = Pen.stroke(ctx, p, Object.assign({}, o, { seed: (o.seed ?? "m") + ":" + i, progress: lp })) || tip;
    });
    return tip;
  };
  /** faint construction lines: drawn fast, fade out. o.fade = 0..1 (1 = gone) */
  Pen.guide = function (ctx, pts, o = {}) {
    const a = (o.alpha ?? 0.55) * (1 - S.clamp(o.fade ?? 0));
    if (a <= 0.01) return;
    Pen.stroke(ctx, pts, Object.assign({ width: 1.6, color: "guide", wobble: 0.8, sketch: false, breaks: 2, taper: false }, o, { alpha: a }));
  };
  /**
   * Hatching inside a closed polygon (instead of fills).
   * o: { k, seed, angle=-0.7, spacing=9, width=1.6, color="soft", alpha=.85,
   *      progress=1, jitter=3, cross=false, style="hatch"|"zigzag",
   *      tint=0 (0..1: a flat wash of the same colour under the strokes, "coloured pencil") }
   * Light paper -> hatch the SHADOW. Dark paper -> hatch the LIGHT.
   */
  Pen.hatch = function (ctx, poly, o = {}) {
    const prog = S.clamp(o.progress ?? 1);
    if (prog <= 0 || !poly || poly.length < 3) return;
    const k = o.k | 0, seed = o.seed ?? "h", z = zk(o);
    const bb = G.bbox(poly), ang = o.angle ?? -0.7, sp = (o.spacing ?? 9) * z, jit = (o.jitter ?? 3) * S.config.boil * z;
    const diag = Math.hypot(bb.w, bb.h) / 2 + 4, c = Math.cos(ang), s = Math.sin(ang);
    ctx.save();
    tracePath(ctx, poly); ctx.closePath();
    if (o.tint) { ctx.fillStyle = S.col(o.color ?? "soft", o.tint * prog); ctx.fill(); }
    ctx.clip();
    ctx.lineCap = "round";
    const sets = o.cross ? [[ang, 1], [ang + 1.15, 0.6]] : [[ang, 1]];
    sets.forEach(([an, dens], si) => {
      const ca = Math.cos(an), sa = Math.sin(an), n = Math.floor((diag * 2) / (sp / dens));
      const shown = Math.floor(n * prog);
      for (let i = 0; i < shown; i++) {
        const base = S.rng(seed, si, i), r = S.rng(seed, si, i, k);
        const d = -diag + (i + 0.5) * (sp / dens) + base.range(-1, 1) * sp * 0.25;
        const half = diag * base.range(0.75, 1);
        const cx = bb.cx - sa * d, cy = bb.cy + ca * d;
        const x0 = cx - ca * half + r.range(-jit, jit), y0 = cy - sa * half + r.range(-jit, jit);
        const x1 = cx + ca * half + r.range(-jit, jit), y1 = cy + sa * half + r.range(-jit, jit);
        ctx.strokeStyle = S.col(o.color ?? "soft", (o.alpha ?? 0.85) * base.range(0.55, 1));
        ctx.lineWidth = (o.width ?? 1.6) * z * base.range(0.7, 1.25);
        ctx.beginPath();
        if (o.style === "zigzag") {
          const steps = 6; ctx.moveTo(x0, y0);
          for (let z = 1; z <= steps; z++) { const kk = z / steps, w = (z % 2 ? 1 : -1) * sp * 0.6; ctx.lineTo(x0 + (x1 - x0) * kk - sa * w, y0 + (y1 - y0) * kk + ca * w); }
        } else {
          ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2 + r.range(-2, 2), (y0 + y1) / 2 + r.range(-2, 2), x1, y1);
        }
        ctx.stroke();
      }
    });
    ctx.restore();
    void c; void s;
  };
  /** solid-ish crayon/marker fill (for accents): dense hatch + soft base */
  Pen.fill = function (ctx, poly, o = {}) {
    ctx.save(); tracePath(ctx, poly); ctx.closePath();
    ctx.fillStyle = S.col(o.color ?? "a1", (o.alpha ?? 1) * 0.35 * S.clamp(o.progress ?? 1)); ctx.fill(); ctx.restore();
    Pen.hatch(ctx, poly, Object.assign({ spacing: 5, width: 3, jitter: 2, alpha: 0.9 }, o, { color: o.color ?? "a1" }));
  };
  /** child's wax crayon: soft base + zigzag strokes. Pair with pen.marker outlines. */
  Pen.crayon = function (ctx, poly, o = {}) {
    const role = o.color ?? "a1", prog = S.clamp(o.progress ?? 1);
    if (prog <= 0) return;
    ctx.save(); tracePath(ctx, poly); ctx.closePath();
    ctx.fillStyle = S.col(role, (o.alpha ?? 1) * (o.base ?? 0.42) * prog); ctx.fill(); ctx.restore();
    Pen.hatch(ctx, poly, Object.assign({ style: "zigzag", spacing: 4.5, width: 2.3, alpha: 0.85, angle: -0.8, jitter: 1.5 }, o, { color: role, tint: 0 }));
  };
  /** felt-tip marker: even width, no taper, almost no pencil lifts, no second pass */
  Pen.marker = function (ctx, pts, o = {}) {
    return Pen.stroke(ctx, pts, Object.assign({ width: 2.4, color: "line", wobble: 0.7, sketch: false, taper: false, breaks: 0.15, pressure: 0.15, overshoot: 0.02 }, o));
  };
  /** flat print colour (lubok, poster, cut paper): solid fill + bold contour. o.outline = contour width (0 = none) */
  Pen.flat = function (ctx, poly, o = {}) {
    if (!poly || poly.length < 3) return;
    ctx.save(); tracePath(ctx, poly); ctx.closePath();
    ctx.fillStyle = S.col(o.color ?? "a1", o.alpha ?? 1); ctx.fill(); ctx.restore();
    const ow = o.outline ?? 3.6;
    if (ow > 0) Pen.stroke(ctx, poly, { k: o.k, seed: (o.seed ?? "flat") + ":o", width: ow, color: o.lineColor ?? "line", alpha: o.lineAlpha ?? 1,
      wobble: o.wobble ?? 0.45, sketch: false, taper: false, breaks: 0, pressure: 0.1, overshoot: 0, closed: true, zoomComp: o.zoomComp, progress: o.progress });
  };

  /* ------------------------------------------------------------------- text */
  const textCache = new Map();
  /**
   * Hand text. o: { k, font="700 110px Caveat", color="line", align="center",
   *   progress=1 (write-on), lineHeight=1.05, maxWidth, alpha=1, outline=0 (px) }
   * Captions: cap height >= 48px on a 1080-wide frame (Caveat >= ~80px, Inter >= ~66px).
   */
  Pen.text = function (ctx, str, x, y, o = {}) {
    const prog = S.clamp(o.progress ?? 1);
    if (prog <= 0 || !str) return;
    const font = o.font ?? "700 110px Caveat", lh = o.lineHeight ?? 1.05, k = o.k | 0;
    const key = str + "|" + font + "|" + (o.maxWidth || 0) + "|" + (o.color ?? "line") + "|" + (S.pal && S.pal.name) + "|" + (o.outline || 0);
    let T = textCache.get(key);
    if (!T) {
      const m = document.createElement("canvas").getContext("2d"); m.font = font;
      const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)[1]);
      let lines = String(str).split("\n");
      if (o.maxWidth) {
        const out = [];
        lines.forEach((ln) => { let cur = ""; ln.split(" ").forEach((w) => { const t = cur ? cur + " " + w : w; if (m.measureText(t).width > o.maxWidth && cur) { out.push(cur); cur = w; } else cur = t; }); out.push(cur); });
        lines = out;
      }
      const W = Math.ceil(Math.max(...lines.map((l) => m.measureText(l).width))) + size, H = Math.ceil(lines.length * size * lh + size * 0.6);
      const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
      const c = cv.getContext("2d"); c.font = font; c.textBaseline = "alphabetic"; c.textAlign = "left";
      c.fillStyle = S.col(o.color ?? "line", 1);
      const widths = lines.map((l) => m.measureText(l).width);
      lines.forEach((l, i) => {
        const lx = size / 2 + (o.align === "left" ? 0 : o.align === "right" ? W - size - widths[i] : (W - size - widths[i]) / 2);
        const ly = size * 0.95 + i * size * lh;
        if (o.outline) { c.lineWidth = o.outline; c.strokeStyle = c.fillStyle; c.lineJoin = "round"; c.strokeText(l, lx, ly); }
        c.fillText(l, lx, ly);
      });
      T = { cv, W, H, size, lines: lines.length };
      textCache.set(key, T);
    }
    const ax = o.align === "left" ? 0 : o.align === "right" ? T.W : T.W / 2;
    const r = S.rng("txt", str, k), j = S.config.boil;
    ctx.save();
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.translate(x - ax + r.range(-0.8, 0.8) * j, y - T.size * 0.95 + r.range(-0.8, 0.8) * j);
    ctx.rotate(r.range(-0.003, 0.003) * j);
    if (prog < 1) {
      // write-on: reveal line by line, left to right, with a ragged edge
      const per = 1 / T.lines, lineH = T.H / T.lines;
      ctx.beginPath();
      for (let i = 0; i < T.lines; i++) {
        const lp = S.clamp((prog - i * per) / per);
        if (lp <= 0) continue;
        ctx.rect(0, i * lineH, T.W * lp, lineH + 2);
      }
      ctx.clip();
    }
    ctx.drawImage(T.cv, 0, 0);
    ctx.globalAlpha *= 0.35; ctx.drawImage(T.cv, r.range(-1.2, 1.2), r.range(-1.2, 1.2)); // second pass = pencil re-trace
    ctx.restore();
  };

  /* ------------------------------------------------------------------ paper */
  const Paper = (S.paper = {});
  Paper.render = function (W, H, pal, seed = "paper") {
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const c = cv.getContext("2d"), r = S.rng(seed, pal.name);
    c.fillStyle = pal.paper; c.fillRect(0, 0, W, H);
    // large soft tone variation
    for (let i = 0; i < 7; i++) {
      const x = r.range(0, W), y = r.range(0, H), rad = r.range(W * 0.2, W * 0.6);
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, S.rgba(pal.tooth, r.range(0.04, 0.1))); g.addColorStop(1, S.rgba(pal.tooth, 0));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
    }
    // patterns
    const grid = (cell, a, color, major) => {
      c.lineWidth = 1.2;
      for (let x = (W % cell) / 2; x < W; x += cell) { c.strokeStyle = S.rgba(color, major && Math.round(x / cell) % major === 0 ? a * 1.8 : a); c.beginPath(); c.moveTo(x + r.range(-0.4, 0.4), 0); c.lineTo(x + r.range(-0.4, 0.4), H); c.stroke(); }
      for (let y = (H % cell) / 2; y < H; y += cell) { c.strokeStyle = S.rgba(color, major && Math.round(y / cell) % major === 0 ? a * 1.8 : a); c.beginPath(); c.moveTo(0, y + r.range(-0.4, 0.4)); c.lineTo(W, y + r.range(-0.4, 0.4)); c.stroke(); }
    };
    if (pal.kind === "grid" || pal.kind === "notebook") grid(Math.round(W / 20), 0.45, pal.guide);
    if (pal.kind === "notebook") { c.strokeStyle = S.rgba("#e0443a", 0.55); c.lineWidth = 2.5; c.beginPath(); c.moveTo(W * 0.12, 0); c.lineTo(W * 0.12, H); c.stroke(); }
    if (pal.kind === "blueprint") grid(Math.round(W / 36), 0.35, pal.guide, 5);
    if (pal.kind === "dots") { c.fillStyle = S.rgba(pal.guide, 0.6); const cell = Math.round(W / 24); for (let x = cell / 2; x < W; x += cell) for (let y = cell / 2; y < H; y += cell) { c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); } }
    if (pal.kind === "chalk") { // old chalk smudges
      for (let i = 0; i < 26; i++) { const x = r.range(0, W), y = r.range(0, H), rad = r.range(60, 260); const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, S.rgba(pal.soft, r.range(0.02, 0.06))); g.addColorStop(1, S.rgba(pal.soft, 0)); c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rad, rad * r.range(0.3, 0.8), r.range(0, 3), 0, 7); c.fill(); }
    }
    // grain (tooth)
    const nDots = Math.floor((W * H) / (pal.kind === "kraft" ? 40 : 70));
    for (let i = 0; i < nDots; i++) { c.fillStyle = S.rgba(r() < 0.5 ? pal.tooth : pal.paper, r.range(0.05, 0.22)); c.fillRect(r.range(0, W), r.range(0, H), r.range(0.6, 1.8), r.range(0.6, 1.8)); }
    // fibres
    const nF = pal.kind === "kraft" ? 1600 : pal.kind === "newsprint" ? 900 : 500;
    c.lineWidth = 0.8;
    for (let i = 0; i < nF; i++) { const x = r.range(0, W), y = r.range(0, H), a = r.range(0, 6.3), l = r.range(4, pal.kind === "kraft" ? 26 : 14); c.strokeStyle = S.rgba(pal.tooth, r.range(0.06, 0.2)); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + 0.6) * l * 0.5, y + Math.sin(a + 0.6) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    // stains
    for (let i = 0; i < 4; i++) { const x = r.range(0, W), y = r.range(0, H), rad = r.range(40, 160); c.strokeStyle = S.rgba(pal.tooth, r.range(0.05, 0.1)); c.lineWidth = r.range(1, 3); c.beginPath(); c.ellipse(x, y, rad, rad * r.range(0.7, 1), r.range(0, 3), 0, 7); c.stroke(); }
    // eraser ghosts: half-erased old lines
    for (let i = 0; i < 9; i++) {
      const x = r.range(0, W), y = r.range(0, H), a = r.range(0, 6.3), l = r.range(80, 380);
      Pen.stroke(c, [{ x, y }, { x: x + Math.cos(a) * l * 0.5 + r.range(-30, 30), y: y + Math.sin(a) * l * 0.5 + r.range(-30, 30) }, { x: x + Math.cos(a) * l, y: y + Math.sin(a) * l }], { k: 0, seed: "ghost" + i, width: r.range(2, 5), color: "line", alpha: r.range(0.03, 0.07), sketch: false });
    }
    // eraser smudge patches
    for (let i = 0; i < 3; i++) { const x = r.range(0, W), y = r.range(0, H); c.fillStyle = S.rgba(pal.tooth, 0.05); c.beginPath(); c.ellipse(x, y, r.range(60, 140), r.range(20, 50), r.range(0, 3), 0, 7); c.fill(); }
    // vignette
    const v = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, pal.shade === "dark" ? "rgba(0,0,0,0.35)" : "rgba(60,40,10,0.12)");
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    return cv;
  };
  /** tileable grain texture used to knock tooth out of the ink */
  Paper.grain = function (size = 256, seed = "grain") {
    const cv = document.createElement("canvas"); cv.width = cv.height = size;
    const c = cv.getContext("2d"), img = c.createImageData(size, size), r = S.rng(seed);
    for (let i = 0; i < size * size; i++) { const v = r(); const a = v > 0.72 ? (v - 0.72) / 0.28 : 0; img.data[i * 4 + 3] = Math.floor(a * 255); }
    c.putImageData(img, 0, 0);
    return cv;
  };

  /* --------------------------------------------------------------------- FX */
  const FX = (S.fx = {});
  /** Halftone: re-draws `src` canvas as print dots. o: { cell=10, angle=.26, color="line", gain=1 } */
  FX.halftone = function (ctx, src, o = {}) {
    const cell = o.cell ?? 10, ang = o.angle ?? 0.26, W = src.width, H = src.height;
    const data = src.getContext("2d").getImageData(0, 0, W, H).data;
    const ca = Math.cos(ang), sa = Math.sin(ang), R = Math.hypot(W, H);
    ctx.save(); ctx.fillStyle = S.col(o.color ?? "line", o.alpha ?? 1);
    for (let u = -R; u < R; u += cell) for (let v = -R; v < R; v += cell) {
      const x = W / 2 + u * ca - v * sa, y = H / 2 + u * sa + v * ca;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = ((y | 0) * W + (x | 0)) * 4, a = data[i + 3] / 255;
      if (a < 0.02) continue;
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const dark = o.useAlpha ? a : a * (1 - lum);
      const rad = (cell / 2) * Math.sqrt(S.clamp(dark * (o.gain ?? 1))) * 1.15;
      if (rad < 0.3) continue;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  };
  /** Misregistered print: draws a layer twice with an offset in two colours */
  FX.misregister = function (ctx, layer, dx, dy, color, alpha = 0.8) {
    const tmp = document.createElement("canvas"); tmp.width = layer.width; tmp.height = layer.height;
    const t = tmp.getContext("2d"); t.drawImage(layer, 0, 0); t.globalCompositeOperation = "source-in"; t.fillStyle = S.col(color, 1); t.fillRect(0, 0, tmp.width, tmp.height);
    ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = "multiply"; ctx.drawImage(tmp, dx, dy); ctx.restore();
  };
  /** Collage piece: torn polygon with drop shadow, filled with an image or a colour */
  FX.piece = function (ctx, poly, o = {}) {
    const bb = G.bbox(poly);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = o.shadow ?? 14; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 6;
    tracePath(ctx, poly); ctx.closePath(); ctx.fillStyle = o.edge ?? "#f7f4ec"; ctx.fill();
    ctx.restore();
    const inner = G.transform(poly, { scale: 0.975, ox: bb.cx, oy: bb.cy });
    ctx.save(); tracePath(ctx, inner); ctx.closePath(); ctx.clip();
    if (o.img) {
      const im = o.img, sc = Math.max(bb.w / im.width, bb.h / im.height) * (o.zoom ?? 1);
      ctx.drawImage(im, bb.cx - (im.width * sc) / 2 + (o.ix ?? 0), bb.cy - (im.height * sc) / 2 + (o.iy ?? 0), im.width * sc, im.height * sc);
      if (o.tint) { ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = S.col(o.tint, 0.85); ctx.fillRect(bb.x, bb.y, bb.w, bb.h); }
    } else { ctx.fillStyle = S.col(o.color ?? "a1", 1); ctx.fillRect(bb.x - 5, bb.y - 5, bb.w + 10, bb.h + 10); }
    ctx.restore();
  };
  /** radius that covers the whole frame from its centre */
  FX.fullRadius = () => Math.hypot(S.W, S.H) / 2 + 4;
  /** Circle reveal: fn draws only inside a screen-space circle of radius r.
   *  ctxs: one context or [ink, glow]. fn may set any camera transform — the clip stays. */
  FX.iris = function (ctxs, r, fn, o = {}) {
    const list = Array.isArray(ctxs) ? ctxs : [ctxs], cx = o.cx ?? S.W / 2, cy = o.cy ?? S.H / 2;
    list.forEach((c) => { c.save(); const m = c.getTransform(); c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); c.arc(cx, cy, Math.max(0.01, r), 0, Math.PI * 2); c.clip(); c.setTransform(m); });
    try { return fn(); } finally { list.forEach((c) => c.restore()); }
  };
  /** the glowing ring on the edge of an iris (screen space) */
  FX.irisRing = function (ctx, r, o = {}) {
    const a = o.alpha ?? 0.9; if (a <= 0 || r <= 0) return;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.lineWidth = o.width ?? 10; ctx.strokeStyle = S.col(o.color ?? "warm", a);
    ctx.beginPath(); ctx.arc(o.cx ?? S.W / 2, o.cy ?? S.H / 2, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  };
  /** soft radial flash (screen space). a = 0..1. Keep it on the glow layer, peak <= 0.6 (pitfall: global wash) */
  FX.flash = function (ctx, a, o = {}) {
    if (a <= 0) return;
    const cx = o.cx ?? S.W / 2, cy = o.cy ?? S.H / 2, r = o.radius ?? FX.fullRadius();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, S.col(o.color ?? "warm", a)); g.addColorStop(1, S.col(o.color ?? "warm", 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H); ctx.restore();
  };
  /** Lubok / Bilibin ornamental border, screen space. p = 0..1 draws it on around the frame.
   *  o: { k, band=54, step=58, roles: { band:"paper", line:"line", accent:"a1", dot:"warm", leaf:"a2" } } */
  FX.ornamentFrame = function (ctx, p, o = {}) {
    if (p <= 0) return;
    const W = S.W, H = S.H, B = o.band ?? 54, k = o.k | 0, mid = B * 0.66;
    const R = Object.assign({ band: "paper", line: "line", accent: "a1", dot: "warm", leaf: "a2" }, o.roles || {});
    const zprev = S.zoomK; S.zoomK = 1;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = S.clamp(p * 3);
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.rect(B, B, W - 2 * B, H - 2 * B); ctx.fillStyle = S.col(R.band); ctx.fill("evenodd");
    ctx.globalAlpha = 1;
    const ins = (d) => [{ x: d, y: d }, { x: W - d, y: d }, { x: W - d, y: H - d }, { x: d, y: H - d }, { x: d, y: d }];
    const line = { k, sketch: false, taper: false, wobble: 0.5, breaks: 0, progress: p };
    Pen.stroke(ctx, ins(8), Object.assign({ seed: "orn1", width: 3, color: R.line }, line));
    Pen.stroke(ctx, ins(17), Object.assign({ seed: "orn2", width: 7, color: R.accent }, line));
    Pen.stroke(ctx, ins(B), Object.assign({ seed: "orn3", width: 3.5, color: R.line }, line));
    const total = 2 * (W + H), step = o.step ?? 58;
    for (let s = 40, i = 0; s < total - 20; s += step, i++) {
      if (s / total > p) continue;
      const q = s < W ? { x: s, y: mid } : s < W + H ? { x: W - mid, y: s - W } : s < 2 * W + H ? { x: W - (s - W - H), y: H - mid } : { x: mid, y: H - (s - 2 * W - H) };
      if ((q.x < 90 || q.x > W - 90) && (q.y < 90 || q.y > H - 90)) continue; // corners get rosettes
      if (i % 2) { Pen.flat(ctx, SH.circle(q.x, q.y, 7, 14), { k, seed: "ornd" + i, color: R.dot, outline: 2.2 }); continue; }
      const horiz = s < W || (s > W + H && s < 2 * W + H), dm = horiz ? [[-10, 0], [0, -8], [10, 0], [0, 8]] : [[0, -10], [8, 0], [0, 10], [-8, 0]];
      Pen.flat(ctx, dm.map(([a, b]) => ({ x: q.x + a, y: q.y + b })), { k, seed: "ornl" + i, color: R.leaf, outline: 2.2 });
    }
    [[mid, mid], [W - mid, mid], [W - mid, H - mid], [mid, H - mid]].forEach(([x, y], j) => {
      if (p < j / 4) return;
      Pen.flat(ctx, SH.circle(x, y, 26, 30), { k, seed: "ornc" + j, color: R.accent, outline: 3 });
      Pen.flat(ctx, G.transform(SH.star(x, y, 17, 17 * 0.34, 4), { rot: Math.PI / 4, ox: x, oy: y }), { k, seed: "orns" + j, color: R.dot, outline: 2.2 });
    });
    ctx.restore(); S.zoomK = zprev;
  };
  /** Banner ribbon with text (lubok). Draws in the current transform — wrap in d.screen() for screen space.
   *  p = 0..1 appears (pop) and writes the text; o.out = 0..1 fades the whole ribbon (never "un-write" text).
   *  o: { k, font="400 58px 'Ruslan Display'", height=92, baseline=22, roles: { band:"a1", edge:"warm", text:"paper" } } */
  FX.ribbon = function (ctx, text, cx, cy, w, p, o = {}) {
    const out = o.out ?? 0; if (p <= 0 || out >= 1) return;
    const R = Object.assign({ band: "a1", edge: "warm", text: "paper" }, o.roles || {}), k = o.k | 0;
    const h = o.height ?? 92, x0 = cx - w / 2, x1 = cx + w / 2, sc = S.ease.outBack(S.clamp(p * 1.6)), al = 1 - out;
    const P = (x, y) => ({ x, y });
    ctx.save(); ctx.globalAlpha = al; ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
    [[x0 - 70, x0 + 10, -1], [x1 + 70, x1 - 10, 1]].forEach(([xa, xb, sd], i) =>
      Pen.flat(ctx, [P(xb, cy - h / 2 + 18), P(xa, cy - h / 2 + 18), P(xa + sd * 26, cy + 9), P(xa, cy + h / 2 + 18), P(xb, cy + h / 2 + 18)], { k, seed: "rbe" + i, color: R.band }));
    Pen.flat(ctx, [P(x0, cy - h / 2), P(x1, cy - h / 2), P(x1, cy + h / 2), P(x0, cy + h / 2)], { k, seed: "rbb", color: R.band });
    [cy - h / 2 + 9, cy + h / 2 - 9].forEach((y, i) => Pen.stroke(ctx, [P(x0 + 8, y), P(x1 - 8, y)], { k, seed: "rbl" + i, width: 2.5, color: R.edge, sketch: false, taper: false, wobble: 0.45, breaks: 0 }));
    Pen.text(ctx, text, cx, cy + (o.baseline ?? 22), { k, font: o.font ?? "400 58px 'Ruslan Display'", color: R.text, alpha: al, progress: S.prog(p, 0.35, 1) });
    ctx.restore();
  };

  /* ------------------------------------------------- cameras (world -> screen) */
  /** A camera is { fx, fy, zoom, rot, shake }: the world point (fx, fy) sits at the centre of the frame.
   *  The legacy form { x, y, zoom } (offset from the frame centre) is still accepted. */
  const CAM = (S.cam = {});
  CAM.norm = function (c) {
    c = Object.assign({ zoom: 1, rot: 0, shake: 0 }, c || {});
    if (c.fx === undefined) { c.fx = S.W / 2 + (c.x || 0); c.fy = S.H / 2 + (c.y || 0); }
    return c;
  };
  /** zoom interpolated in log space: a push-in from 1x to 5x feels even */
  CAM.zlerp = (a, b, u) => Math.exp(S.lerp(Math.log(a), Math.log(b), u));
  /** camera that keeps world point `world` at screen point `screen` with this zoom */
  CAM.anchor = (world, screen, zoom) => ({ fx: world.x - (screen.x - S.W / 2) / zoom, fy: world.y - (screen.y - S.H / 2) / zoom, zoom });
  /** keyframed camera: keys = [[t, {fx, fy, zoom, rot, shake}, ease?], ...] -> (t) => camera.
   *  ease of a key applies to the segment that ENDS at it ("inOut" by default; a name or a function). */
  CAM.keys = function (keys) {
    return function (t) {
      if (t <= keys[0][0]) return CAM.norm(keys[0][1]);
      for (let i = 0; i < keys.length - 1; i++) {
        const [t0, a] = keys[i], [t1, b, e] = keys[i + 1];
        if (t > t1) continue;
        const f = typeof e === "function" ? e : S.ease[e || "inOut"], u = f(S.prog(t, t0, t1)), A = CAM.norm(a), B = CAM.norm(b);
        return { fx: S.lerp(A.fx, B.fx, u), fy: S.lerp(A.fy, B.fy, u), zoom: CAM.zlerp(A.zoom, B.zoom, u), rot: S.lerp(A.rot, B.rot, u), shake: S.lerp(A.shake, B.shake, u) };
      }
      return CAM.norm(keys[keys.length - 1][1]);
    };
  };
  /** apply a camera to a context. extraScale: the world is drawn in other units (e.g. a 1200-px drawing shown 1.6x) */
  CAM.apply = function (ctx, cam, extraScale = 1, k = 0) {
    const c = CAM.norm(cam), r = S.rng("cam", k), sx = c.shake * r.range(-1, 1), sy = c.shake * r.range(-1, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(S.W / 2 + sx, S.H / 2 + sy); ctx.rotate(c.rot); ctx.scale(c.zoom, c.zoom); ctx.translate(-c.fx, -c.fy);
    if (extraScale !== 1) ctx.scale(extraScale, extraScale);
    return c;
  };

  /* ------------------------------------------------------- offscreen caches */
  const caches = new Map();
  /** S.cache(key, w, h, (ctx, w, h) => {...}, { palette }) — draw once, reuse. The key must describe
   *  everything the picture depends on (add k if it boils). The palette is pinned inside, so a cache
   *  miss never repaints it in another world's colours (pitfall). Line widths are not zoom-compensated. */
  S.cache = function (key, w, h, fn, o = {}) {
    const hit = caches.get(key); if (hit) return hit;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const zprev = S.zoomK; S.zoomK = 1;
    try { S.withPalette(o.palette, () => fn(cv.getContext("2d"), w, h)); } finally { S.zoomK = zprev; }
    caches.set(key, cv);
    if (caches.size > (o.max ?? 48)) caches.delete(caches.keys().next().value);
    return cv;
  };

  /* ---------------------------------------------------------------- captions */
  /** Caption for a cue that carries text (types "voice" and "caption"): { text, p, alpha } or null.
   *  Shows from cue.t, holds `hold` s after cue end, fades in/out. Voice cues get their dur from voice.py --fit. */
  S.caption = function (t, id, o = {}) {
    const e = ((global.CUES && global.CUES.events) || []).find((c) => c.id === id);
    if (!e || !e.text) return null;
    const t0 = e.t, t1 = e.t + (e.dur || 2), fi = o.fadeIn ?? 0.2, fo = o.fadeOut ?? 0.3, hold = o.hold ?? 0.35;
    if (t < t0 || t > t1 + hold + fo) return null;
    return { id, text: e.text, p: S.prog(t, t0, t1), alpha: S.clamp((t - t0) / fi) * (1 - S.clamp((t - t1 - hold) / fo)) };
  };
  /** every caption visible at t (for subtitles) */
  S.captionsAt = (t, o) => ((global.CUES && global.CUES.events) || []).filter((e) => e.text && (e.type === "voice" || e.type === "caption")).map((e) => S.caption(t, e.id, o)).filter((c) => c && c.alpha > 0);

  /* ---------------------------------------------------------------- sequence */
  /**
   * Scenes in one video, each with its own palette (paper) and camera:
   *   Sketch.mount({ palette: "graphite", palettes: ["lubok"], scenes: [
   *     { id: "yard",  from: -1, to: 15, palette: "graphite", camera: (t) => cam, draw(d, s) {...} },
   *     { id: "print", from: 15, to: 40, palette: "lubok", scale: 1.6, in: { type: "iris", dur: 0.7 }, camera, draw },
   *   ]})
   * s = { t (seconds since the scene started), p (0..1 through the scene), scene }.
   * Transitions (`in` of the incoming scene): "cut" (default), "iris" (circle opens from the centre, gold ring),
   * "flash" (cut under a soft flash). During an iris both scenes are drawn; the incoming one gets its own paper.
   */
  S.sequence = function (scenes) {
    return function (d) {
      const t = d.t;
      let i = scenes.findIndex((s) => t >= s.from && t < s.to);
      if (i < 0) i = t < scenes[0].from ? 0 : scenes.length - 1;
      const cur = scenes[i], prev = scenes[i - 1], tr = cur.in || { type: "cut" }, dur = tr.dur ?? 0.7;
      const u = S.prog(t, cur.from, cur.from + dur);
      const run = (s) => {
        const local = { t: t - s.from, p: S.prog(t, s.from, s.to), scene: s };
        const cam = s.camera ? s.camera(t, local) : {};
        [d.ink, d.glow].forEach((c) => d.useCamera(c, cam, s.scale || 1));
        s.draw(d, local);
      };
      if (prev && tr.type === "iris" && u < 1) {
        d.setPalette(prev.palette || d.basePalette); run(prev);
        const r = S.ease.out(u) * FX.fullRadius(), pal = cur.palette || d.basePalette;
        FX.iris([d.ink, d.glow], r, () => S.withPalette(pal, () => {
          d.screen(d.ink, (c) => c.drawImage(d.paper(pal), -(S.OV - 1) * S.W / 2, -(S.OV - 1) * S.H / 2));
          d.screen(d.glow, (c) => c.clearRect(0, 0, S.W, S.H));  // the old world's glow does not shine through the circle
          run(cur);
        }));
        FX.irisRing(d.glow, r, { color: tr.ring ?? "warm", alpha: 0.9 * (1 - u) });
        return;
      }
      d.setPalette(cur.palette || d.basePalette);
      run(cur);
      if (tr.type === "flash" && u < 1) FX.flash(d.glow, (tr.peak ?? 0.6) * (1 - u), { color: tr.color ?? "warm" });
    };
  };

  /* ---------------------------------------------------------------- assets */
  const assets = {}, pending = [];
  /** S.load({ photo: "refs/photo.jpg" }) — call at top level of scene.js, before mount */
  S.load = function (map) {
    Object.entries(map).forEach(([key, src]) => {
      pending.push(new Promise((res, rej) => { const im = new Image(); im.onload = () => { assets[key] = im; res(); }; im.onerror = () => rej(new Error("asset failed: " + src)); im.src = src; }));
    });
  };
  S.asset = (key) => assets[key];

  /* ------------------------------------------------------------------ roto */
  /** Hybrid: frames traced from a reference / generated video by scripts/roto_extract.py */
  const Roto = (S.roto = { clips: {} });
  Roto.load = function (name, manifest) {
    const clip = { m: manifest, edges: [], shadow: [] };
    Roto.clips[name] = clip;
    manifest.frames.forEach((f, i) => {
      pending.push(new Promise((res) => { const im = new Image(); im.onload = res; im.onerror = res; im.src = manifest.base + f.edges; clip.edges[i] = im; }));
      if (f.shadow) pending.push(new Promise((res) => { const im = new Image(); im.onload = res; im.onerror = res; im.src = manifest.base + f.shadow; clip.shadow[i] = im; }));
    });
  };
  let tintCv = null;
  function tinted(img, color, W, H) {
    if (!tintCv) tintCv = document.createElement("canvas");
    tintCv.width = W; tintCv.height = H;
    const c = tintCv.getContext("2d"); c.clearRect(0, 0, W, H); c.drawImage(img, 0, 0, W, H);
    c.globalCompositeOperation = "source-in"; c.fillStyle = color; c.fillRect(0, 0, W, H); c.globalCompositeOperation = "source-over";
    return tintCv;
  }
  /**
   * Draw a roto clip. o: { k, t (seconds since clip start), x, y, w, h, color="line",
   *   hatch=true, hatchColor="soft", loop=false }
   */
  Roto.draw = function (ctx, name, o = {}) {
    const clip = Roto.clips[name]; if (!clip) return;
    const n = clip.m.frames.length, fps = clip.m.fps || 12;
    let i = Math.floor((o.t ?? 0) * fps + 1e-6); i = o.loop ? ((i % n) + n) % n : S.clamp(i, 0, n - 1);
    const W = o.w ?? clip.m.width, H = o.h ?? clip.m.height, x = o.x ?? 0, y = o.y ?? 0, r = S.rng("roto", name, o.k | 0);
    if (o.hatch !== false && clip.shadow[i] && clip.shadow[i].width) {
      const hc = document.createElement("canvas"); hc.width = W; hc.height = H;
      const h = hc.getContext("2d");
      Pen.hatch(h, SH.rect(0, 0, W, H), { k: o.k, seed: "rh" + name, color: o.hatchColor ?? "soft", spacing: 8, width: 1.5 });
      h.globalCompositeOperation = "destination-in"; h.drawImage(clip.shadow[i], 0, 0, W, H);
      ctx.drawImage(hc, x, y);
    }
    const col = S.col(o.color ?? "line", 1), tc = tinted(clip.edges[i], col, W, H);
    ctx.save(); ctx.globalAlpha = 0.95; ctx.drawImage(tc, x + r.range(-1, 1), y + r.range(-1, 1));
    ctx.globalAlpha = 0.4; ctx.drawImage(tc, x + r.range(-2, 2), y + r.range(-2, 2)); ctx.restore();
  };

  /* ------------------------------------------------------------------ song */
  /* A clip to a song: cues.js "song" (written by `cartoon song`) holds the beat grid, the bar lines,
   * the parts of the song and an energy curve; "lyric" cues hold the lines. Everything is in SONG time:
   * in a cut (cues "window") the engine shifts the frame time, so d.t, d.cue() and the parts still match. */
  const songInfo = () => (global.CUES && global.CUES.song) || null;
  const lastLE = (arr, t) => { let lo = 0, hi = arr.length - 1; if (!arr.length || t < arr[0]) return -1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= t) lo = m; else hi = m - 1; } return lo; };
  /** where t sits on the beat grid: { i (beat index), t0 (its start), len, phase 0..1, bar, beatInBar 0..3, barPhase 0..1, bpm }.
   *  Before and after the song the grid is extended; without a song it is music.bpm from cues.js. */
  S.beat = function (t) {
    const s = songInfo(), G = s && s.beats;
    let i, t0, len;
    if (!G || G.length < 2) {
      len = 60 / ((global.CUES && global.CUES.music && global.CUES.music.bpm) || 120); i = Math.floor(t / len); t0 = i * len;
    } else {
      const n = G.length, j = lastLE(G, t);
      if (j < 0) { len = G[1] - G[0]; i = Math.floor((t - G[0]) / len); t0 = G[0] + i * len; }
      else if (j >= n - 1) { len = G[n - 1] - G[n - 2]; const e = Math.floor((t - G[n - 1]) / len); i = n - 1 + e; t0 = G[n - 1] + e * len; }
      else { i = j; t0 = G[j]; len = G[j + 1] - G[j]; }
    }
    const beatInBar = ((i % 4) + 4) % 4, phase = S.clamp((t - t0) / len);
    return { i, t0, len, phase, bar: Math.floor(i / 4), beatInBar, barPhase: (beatInBar + phase) / 4, bpm: 60 / len };
  };
  /** 1 on a hit, then decays: o = { grid: "beat" | "bar" | "half", decay: 0.22 (s), accent: [1, .55, .8, .55] (per beat of the bar) } */
  S.pulse = function (t, o = {}) {
    const b = S.beat(t), grid = o.grid || "beat", decay = o.decay ?? 0.22;
    let since = t - b.t0, acc = 1;
    if (grid === "bar") since = t - (b.t0 - b.beatInBar * b.len);
    else if (grid === "half") since = (t - b.t0) % (b.len / 2);
    else acc = (o.accent || [1, 0.55, 0.8, 0.55])[b.beatInBar];
    return since < 0 ? 0 : acc * Math.exp(-since / decay);
  };
  /** loudness of the song at t, 0..1 (0.5 s steps, interpolated); 0.5 without a song */
  S.energy = function (t) {
    const s = songInfo(), e = s && s.energy;
    if (!e || !e.v || !e.v.length) return 0.5;
    const u = (t - e.t0) / e.hop, i = Math.floor(u);
    return i < 0 ? e.v[0] : i >= e.v.length - 1 ? e.v[e.v.length - 1] : S.lerp(e.v[i], e.v[i + 1], u - i);
  };
  function secInfo(i, t) {
    const L = songInfo().sections, x = L[i], of = L.filter((y) => y.label === x.label).length;
    return { id: x.id, label: x.label, n: x.n, of, last: x.n === of - 1, i, from: x.t, to: x.end, bars: x.bars, t: t - x.t, p: S.prog(t, x.t, x.end) };
  }
  /** the part of the song at t: { id: "chorus2", label: "chorus", n (0 = first of its kind), of (how many of its kind),
   *  last (the last of its kind), i, from, to, bars, t (seconds since it began), p (0..1) } or null without a song */
  S.section = function (t) {
    const L = (songInfo() || {}).sections || [];
    if (!L.length) return null;
    const i = L.findIndex((x) => t < x.end);
    return secInfo(i < 0 ? L.length - 1 : i, t);
  };
  S.sections = () => ((songInfo() || {}).sections || []).map((x, i) => secInfo(i, x.t));
  /**
   * Scenes for Sketch.mount({ scenes }) from the parts of the song — one world per kind of part:
   *   Sketch.songScenes({ verse: { palette, camera, draw }, chorus: {...}, "*": {...} })
   * def: { palette: "name" | (sec) => "name", camera: (t, local) => cam, draw: (d, local) => {}, scale,
   *        in: { type: "cut" | "iris" | "flash", dur } | (sec, prev) => transition }
   * local = { t (since the part began), p, scene, sec } — sec.n grows with every repeat of the chorus.
   * Default transitions: into a chorus a soft "flash" (1 beat), into another kind "iris" (2 beats), the same kind again "cut".
   */
  S.songScenes = function (defs) {
    const L = (songInfo() || {}).sections || [];
    const pal = (def, sec) => (typeof def.palette === "function" ? def.palette(sec) : def.palette);
    if (!L.length) {
      const d0 = defs["*"] || defs[Object.keys(defs)[0]];
      return [{ id: "all", from: 0, to: 1e9, palette: pal(d0, null), camera: d0.camera, scale: d0.scale, draw: (d, l) => d0.draw(d, Object.assign(l, { sec: null })) }];
    }
    return L.map((x, i) => {
      const def = defs[x.label] || defs["*"];
      if (!def) throw new Error("songScenes: no scene for '" + x.label + "' (add it or a \"*\" fallback)");
      const sec = secInfo(i, x.t), prev = i ? secInfo(i - 1, L[i - 1].t) : null, beat = S.beat(x.t).len;
      let tin = typeof def.in === "function" ? def.in(sec, prev) : def.in;
      if (tin === undefined) tin = !prev || prev.label === x.label ? { type: "cut" } : x.label === "chorus" ? { type: "flash", dur: beat, peak: 0.22 } : { type: "iris", dur: 2 * beat };
      const live = (t) => Object.assign({}, sec, { t: t - x.t, p: S.prog(t, x.t, x.end) });
      return {
        id: x.id, from: x.t, to: x.end, palette: pal(def, sec), scale: def.scale, in: tin,
        camera: def.camera ? (t, l) => def.camera(t, Object.assign(l, { sec: live(t) })) : undefined,
        draw: (d, l) => def.draw(d, Object.assign(l, { sec: live(d.t) })),
      };
    });
  };
  let lyrCache = null;
  /** lyric lines ("lyric" cues). at(t) -> the line on screen or null:
   *  { id, i, text, words: [{ w, t0, t1, p }], sung (index of the word being sung, -1 before), p (0..1 through the
   *    sung line), alpha, next (the next line's text), backing, section, t0, t1 }
   *  o = { lead: 0.12 (s on screen before it is sung), hold: 0.6 (s after), fade: 0.18 } */
  S.lyrics = {
    all() { return lyrCache || (lyrCache = ((global.CUES && global.CUES.events) || []).filter((e) => e.type === "lyric").sort((a, b) => a.t - b.t)); },
    at(t, o = {}) {
      const all = S.lyrics.all(), lead = o.lead ?? 0.12, hold = o.hold ?? 0.6, fade = o.fade ?? 0.18;
      for (let i = all.length - 1; i >= 0; i--) {
        const e = all[i];
        if (t < e.t - lead) continue;
        const next = all[i + 1], end = e.t + (e.dur || 2), until = next ? Math.min(next.t - lead, end + hold) : end + hold;
        if (t > until) return null;
        const src = e.words && e.words.length ? e.words : [[e.t, e.text]];
        const words = src.map((w, j) => { const t1 = j + 1 < src.length ? src[j + 1][0] : end; return { w: w[1], t0: w[0], t1, p: S.prog(t, w[0], Math.max(w[0] + 0.05, t1)) }; });
        return {
          id: e.id, i, text: e.text, words, sung: words.reduce((a, w, j) => (t >= w.t0 ? j : a), -1), p: S.prog(t, e.t, end),
          alpha: S.clamp((t - (e.t - lead)) / fade) * (1 - S.clamp((t - (until - fade)) / fade)),
          next: next ? next.text : null, backing: e.backing || null, section: e.section, t0: e.t, t1: end,
        };
      }
      return null;
    },
  };
  /** the area that platform interfaces do not cover, frame pixels { x, y, w, h }:
   *  9:16 — top 8 %, bottom 15 %, right 12 %, left 6 %; 16:9 — 5 % around; 1:1 / 4:5 — 6 %, bottom 10 % */
  S.safe = function () {
    const W = S.W, H = S.H, r = H / W;
    const m = r > 1.5 ? [0.06, 0.12, 0.08, 0.15] : r < 0.8 ? [0.05, 0.05, 0.05, 0.05] : [0.06, 0.06, 0.06, 0.1];
    return { x: W * m[0], y: H * m[2], w: W * (1 - m[0] - m[1]), h: H * (1 - m[2] - m[3]) };
  };
  /** layout scale of the starters: 1 = a 1080-wide vertical frame or a 1080-high wide one */
  S.layoutScale = () => (S.W / S.H >= 1.2 ? S.H / 1080 : Math.min(S.W / 1080, (S.H / 1920) * 1.25));
  const meas = () => meas.c || (meas.c = document.createElement("canvas").getContext("2d"));
  function wrapWords(words, font, maxW) {
    const m = meas(); m.font = font;
    const sp = m.measureText(" ").width, rows = [[]];
    let w = 0;
    words.forEach((x, j) => {
      const ww = m.measureText(x.w).width;
      if (rows[rows.length - 1].length && w + sp + ww > maxW) { rows.push([]); w = 0; }
      const row = rows[rows.length - 1];
      row.push({ j, w: x.w, x: row.length ? w + sp : 0, width: ww }); w = row.length > 1 ? w + sp + ww : ww;
    });
    return rows.map((r) => ({ items: r, width: r.length ? r[r.length - 1].x + r[r.length - 1].width : 0 }));
  }
  /**
   * Draw a lyric line from Sketch.lyrics.at() / d.lyric(). Frame pixels: call it inside d.screen().
   * o: { k, style: "write" | "karaoke" | "stamp" | "ribbon", x, y (baseline of the last row; default: low in the
   *      safe area), font (default Caveat sized by the frame), color: "line", sungColor: "warm", restColor: "soft",
   *      maxWidth (default 92 % of the safe area; long lines wrap into 2 rows), backing: true }
   *   write   — the words are written by hand as they are sung (pencil, chalk, notebook)
   *   karaoke — the whole line stands, the sung part changes colour (any style)
   *   stamp   — every word pops in when it is sung (neon, halftone, collage)
   *   ribbon  — the line on a lubok ribbon
   */
  FX.lyric = function (ctx, line, o = {}) {
    if (!line || line.alpha <= 0) return;
    const sa = S.safe(), ls = S.layoutScale(), k = o.k | 0, style = o.style || "write";
    const size = o.size ?? Math.round(Math.max(88, 104 * ls));
    const font = o.font ?? `700 ${size}px Caveat`, px = parseFloat(/(\d+(?:\.\d+)?)px/.exec(font)[1]);
    const maxW = o.maxWidth ?? sa.w * 0.92, x = o.x ?? sa.x + sa.w / 2;
    const y = o.y ?? sa.y + sa.h * (S.H / S.W > 1.5 ? 0.8 : 0.9);
    const rows = wrapWords(line.words, font, maxW), lh = px * 1.08, top = y - (rows.length - 1) * lh;
    const chars = line.words.map((w) => w.w.length + 1), total = chars.reduce((a, b) => a + b, 0) || 1;
    const sungChars = line.words.reduce((a, w, j) => a + (j < line.sung ? chars[j] : j === line.sung ? chars[j] * w.p : 0), 0);
    const frac = S.clamp(sungChars / total), text = rows.map((r) => r.items.map((it) => it.w).join(" ")).join("\n");
    const alpha = line.alpha * (o.alpha ?? 1);
    if (style === "ribbon") {
      const m = meas(); m.font = font;
      FX.ribbon(ctx, line.text, x, y - px * 0.3, Math.min(sa.w, m.measureText(line.text).width + 120 * ls), 0.35 + 0.65 * frac, { k, font, out: 1 - line.alpha, height: px * 1.25, baseline: px * 0.32 });
    } else if (style === "stamp") {
      rows.forEach((r, ri) => r.items.forEach((it) => {
        const w = line.words[it.j]; if (line.sung < it.j) return;
        const sc = S.ease.pop(S.clamp((w.p * (w.t1 - w.t0)) / 0.18));
        const cx = x - r.width / 2 + it.x + it.width / 2, cy = top + ri * lh;
        ctx.save(); ctx.translate(cx, cy - px * 0.3); ctx.scale(sc, sc);
        Pen.text(ctx, it.w, 0, px * 0.3, { k, font, color: it.j === line.sung ? o.sungColor ?? "warm" : o.color ?? "line", alpha });
        ctx.restore();
      }));
    } else if (style === "karaoke") {
      Pen.text(ctx, text, x, top, { k, font, color: o.restColor ?? "soft", alpha: alpha * 0.85 });
      Pen.text(ctx, text, x, top, { k, font, color: o.sungColor ?? "warm", alpha, progress: frac });
    } else {
      Pen.text(ctx, text, x, top, { k, font, color: o.color ?? "line", alpha, progress: frac });
    }
    if (line.backing && o.backing !== false) {
      Pen.text(ctx, line.backing, x, y + px * 0.75, { k, font: font.replace(/\d+(?:\.\d+)?px/, Math.round(px * 0.6) + "px"), color: o.restColor ?? "soft", alpha: alpha * 0.9, progress: S.clamp(frac * 1.5) });
    }
  };
  /** Sketch.cam.kick(cam, pulse, 0.03): the camera punches in on a hit (zoom x (1 + amount * pulse)) */
  CAM.kick = (c, pulse, amount = 0.03) => Object.assign({}, CAM.norm(c), { zoom: CAM.norm(c).zoom * (1 + amount * pulse) });

  /* ----------------------------------------------------------------- mount */
  /**
   * Sketch.mount({ palette, draw(d), camera(t) -> {x,y,zoom,rot,shake}, fonts:[...], onTwos })
   * Creates the layers inside the composition root, registers the paused GSAP
   * timeline that HyperFrames seeks, and renders every frame from time only.
   */
  S.OV = 1.3; // paper overscan for camera moves
  S.mount = function (opts) {
    const root = document.querySelector("[data-composition-id]");
    const W = +root.dataset.width, H = +root.dataset.height, DUR = +root.dataset.duration, id = root.dataset.compositionId;
    S.W = W; S.H = H; S.DUR = DUR;
    if (global.CUES && global.CUES.fps_draw) S.config.fpsDraw = global.CUES.fps_draw;
    if (opts.onTwos === false) S.config.onTwos = false;
    if (opts.fpsDraw) S.config.fpsDraw = opts.fpsDraw;
    const basePal = opts.palette;
    S.usePalette(basePal);
    const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
    const main = root.querySelector("canvas#stage") || (() => { const c = mk(); c.id = "stage"; root.appendChild(c); return c; })();
    main.width = W; main.height = H;
    const M = main.getContext("2d"), ink = mk(), glow = mk(), I = ink.getContext("2d"), Gl = glow.getContext("2d");
    const cue = S.cue, cueEnd = S.cueEnd, OV = S.OV;
    let grainPat = null, ready = false;
    // one paper per palette, rendered on first use (with that palette's roles, zoom compensation off)
    const papers = {};
    const paperFor = (name) => papers[name] || (papers[name] = S.withPalette(name, () => {
      const z = S.zoomK; S.zoomK = 1;
      try { return Paper.render(Math.ceil(W * OV), Math.ceil(H * OV), S.pal); } finally { S.zoomK = z; }
    }));
    const drawFn = opts.scenes ? S.sequence(opts.scenes) : opts.draw;
    // a cut of a longer clip (cues "window", written by `cartoon cut`): frame time -> song time
    const win = (global.CUES && global.CUES.window) || null, OFF = win ? +win.from || 0 : 0;
    // beatLock: on twos, a new drawing starts exactly on every beat (the drawings of a beat share it evenly)
    const lock = S.config.onTwos && opts.beatLock !== false && !!(songInfo() && songInfo().beats);
    const hold = (raw) => {
      if (!lock) return [S.held(raw), S.frame(raw)];
      const b = S.beat(raw), m = Math.max(1, Math.round(b.len * S.config.fpsDraw));
      const t = b.t0 + (Math.floor(b.phase * m + 1e-6) / m) * b.len;
      return [t, Math.round(t * 1000)];
    };

    function render(time) {
      const raw = time + OFF, [ht, k] = hold(raw), t = S.config.onTwos ? ht : raw;
      // every frame starts from the same state, whatever the previous frame switched (determinism)
      S.usePalette(basePal);
      let framePal = null; // set by d.setPalette; legacy scenes that call Sketch.usePalette keep the old behaviour
      const cam = CAM.norm(opts.camera ? opts.camera(t) : {});
      S.setZoom(cam.zoom);
      [I, Gl].forEach((c) => { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); CAM.apply(c, cam, 1, k); });
      const d = {
        t, raw, k, W, H, ink: I, glow: Gl, col: S.col, cue, cueEnd, cam, S, basePalette: basePal,
        get pal() { return S.pal; },
        get zoom() { return S.zoom; },
        /** switch this frame's world: roles AND the paper under the ink */
        setPalette(name) { S.usePalette(name); framePal = name; },
        /** the paper canvas of a palette (W*OV x H*OV), e.g. to paint it inside an iris */
        paper: (name) => paperFor(name || S.pal.name),
        /** draw a world with its own camera; line widths follow its zoom */
        useCamera(ctx, c, extraScale = 1) { const n = CAM.apply(ctx, c, extraScale, k); S.setZoom(n.zoom); return n; },
        /** draw in frame pixels (captions, frames, flashes); restores transform and zoom afterwards */
        screen(ctx, fn) { const z = S.zoom; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); S.setZoom(1); try { return fn(ctx); } finally { ctx.restore(); S.setZoom(z); } },
        caption: (cid, o) => S.caption(t, cid, o),
        /** song clips: the lyric line on screen, the beat grid, the part of the song, a hit pulse, the loudness */
        lyric: (o) => S.lyrics.at(t, o),
        get beat() { return S.beat(t); },
        get sec() { return S.section(t); },
        pulse: (o) => S.pulse(t, o),
        get energy() { return S.energy(t); },
        /** { from, to, cut } — in a cut, from/to are the song times it covers; left = seconds to its end */
        window: { from: OFF, to: OFF + DUR, cut: !!win, left: OFF + DUR - raw },
      };
      drawFn(d);
      // tooth: knock paper grain out of the ink (pencil skips over the paper's pits)
      if (S.config.grain > 0) {
        I.setTransform(1, 0, 0, 1, 0, 0); I.globalCompositeOperation = "destination-out"; I.globalAlpha = S.config.grain;
        I.fillStyle = grainPat; I.fillRect(0, 0, W, H); I.globalAlpha = 1; I.globalCompositeOperation = "source-over";
      }
      // composite: paper (follows the main camera) -> ink -> bloomed glow
      const fp = framePal ? Object.assign({ name: framePal }, global.SKETCH_PALETTES[framePal]) : S.pal;
      M.setTransform(1, 0, 0, 1, 0, 0); M.clearRect(0, 0, W, H);
      M.save(); CAM.apply(M, cam, 1, k);
      const pj = S.config.paperJitter, pr = S.rng("pj", k);
      M.drawImage(paperFor(framePal || basePal), -(OV - 1) * W / 2 + pr.range(-pj, pj), -(OV - 1) * H / 2 + pr.range(-pj, pj));
      M.restore();
      M.drawImage(ink, 0, 0);
      if (fp.glow > 0) {
        M.save(); M.globalCompositeOperation = fp.shade === "dark" ? "lighter" : "source-over";
        M.globalAlpha = fp.glow * 0.9; M.filter = "blur(26px)"; M.drawImage(glow, 0, 0);
        M.globalAlpha = fp.glow; M.filter = "blur(7px)"; M.drawImage(glow, 0, 0);
        M.restore();
      }
      M.drawImage(glow, 0, 0);
      if (opts.post) opts.post(M, d);
      S.usePalette(basePal); S.setZoom(1);
    }
    S.render = render;

    const fontList = opts.fonts || ["700 80px Caveat", "400 80px Caveat", "800 80px Inter", "400 80px Inter", "400 80px 'Ruslan Display'"];
    const build = (async () => {
      await Promise.all(fontList.map((f) => document.fonts.load(f, "АБВabc").catch(() => null)));
      await Promise.all(pending);
      [basePal].concat(opts.palettes || [], (opts.scenes || []).map((s) => s.palette).filter(Boolean)).forEach(paperFor);
      grainPat = I.createPattern(Paper.grain(), "repeat");
      if (opts.setup) await opts.setup(S);
      ready = true;
    })();
    global.__hf = global.__hf || {};
    global.__hf.buildReady = global.__hf.buildReady || {};
    global.__hf.buildReady["sketch-" + id] = build;

    build.then(() => {
      const tl = gsap.timeline({ paused: true });
      const proxy = { t: 0 };
      tl.to(proxy, { t: DUR, duration: DUR, ease: "none", onUpdate: () => render(tl.time()) }, 0);
      global.__timelines = global.__timelines || {};
      global.__timelines[id] = tl;
      render(0);
      if (global.__hfForceTimelineRebind) global.__hfForceTimelineRebind();
      // plain-browser preview helper: index.html?t=3.5
      const q = new URLSearchParams(location.search).get("t");
      if (q !== null) render(parseFloat(q));
    }).catch((e) => { console.error(e); document.body.setAttribute("data-sketch-error", String(e)); });
    global.addEventListener("hf-seek", (e) => { if (ready) render(e.detail.time); });
  };

  global.Sketch = S;
})(window);
