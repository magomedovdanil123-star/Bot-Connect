/* ============================================================================
 * pencil3d.js — a small 3D for the Sketch engine: meshes seen through a camera and drawn in pencil.
 * No WebGL: every face is projected and filled on the 2D canvas (painter's order), shaded by the sun,
 * hatched where it is dark, and outlined with boiling pencil lines along silhouettes and creases.
 * Deterministic like the rest of the engine (everything is a function of the inputs).
 *
 *   const M = P3.mesh(); M.loft(stations, 12, "a1"); M.slab(planform, y, thick, "a1"); M.fin(profile, 0.08, "a1");
 *   M.decal(partName, polygon3d, "red");  M.done();
 *   const cam = P3.camera(eye, target, fovDeg);
 *   P3.draw(d, cam, [P3.object(M, pos, P3.attitude(fwd, up, roll), scale, opts), P3.puff(pos, r, opts), ...], world)
 *   P3.flight(path, t) -> { pos, vel, att } of a path(t) -> [x, y, z] (banked by its sideways acceleration;
 *     its time window stops where the path jumps: P3.span);  P3.lag(fn, t, span, from) -> a camera aim that lags
 *   P3.horizon(cam, above, below) -> a sky gradient line that tilts with the camera
 *   P3.track(t0, dt, rows) -> a path from simulated samples, with .flight(t) (see references/pencil3d.md)
 *   P3.cumulus(base, w, h, seed, o) -> puffs of a cumulus cloud;  P3.line(c, d, cam, pts, o) -> trails, tracers
 * World: Y is up, metres. world = { sun: unit vector toward the sun, shadow: hex, ink: role, hatch: role, ambient,
 *   keep: [points the shot is about: puffs between them and the camera fade] }.
 * Load after engine/sketch.js; build meshes and clouds that need colours AFTER Sketch.mount (the palette is set there).
 * ==========================================================================*/
(function (global) {
  "use strict";
  const S = global.Sketch;
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  /** rotate v around the unit axis by angle (Rodrigues) */
  const rot = (v, axis, a) => { const c = Math.cos(a), s = Math.sin(a); return add(add(mul(v, c), mul(cross(axis, v), s)), mul(axis, dot(axis, v) * (1 - c))); };
  const P3 = { add, sub, mul, dot, cross, len, norm, lerp3, rot };
  const X3 = { add, lerp: lerp3 };

  /* ---------------------------------------------------------------- meshes */
  /** model space: x = forward (nose), y = up, z = right wing; metres */
  P3.mesh = function () {
    const M = { verts: [], faces: [], parts: {} };
    const face = (idx, role, part, ref) => {
      // orient the face outward once, against a reference point inside the part
      const [a, b, c] = idx.map((i) => M.verts[i]);
      const n = cross(sub(b, a), sub(c, a)), cen = idx.reduce((s, i) => add(s, mul(M.verts[i], 1 / idx.length)), [0, 0, 0]);
      if (dot(n, sub(cen, ref)) < 0) idx = idx.slice().reverse();
      M.faces.push({ v: idx, role, part, decals: [] });
      (M.parts[part] = M.parts[part] || []).push(M.faces.length - 1);
    };
    /** a body of revolution-like loft: stations [{x, ry, rz, y}] (half height, half width, centre height) */
    M.loft = function (st, n, role, part = "body") {
      const rings = st.map((q) => {
        const ring = [];
        for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; M.verts.push([q.x, (q.y || 0) + q.ry * Math.cos(a), q.rz * Math.sin(a)]); ring.push(M.verts.length - 1); }
        return ring;
      });
      for (let j = 0; j < st.length - 1; j++) for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n, ref = [(st[j].x + st[j + 1].x) / 2, ((st[j].y || 0) + (st[j + 1].y || 0)) / 2, 0];
        face([rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]], role, part, ref);
      }
      [[0, 1], [st.length - 1, -1]].forEach(([j, dir]) => {        // caps: a fan to a point just beyond the end
        M.verts.push([st[j].x + dir * 0.02, st[j].y || 0, 0]);
        const c = M.verts.length - 1;
        for (let i = 0; i < n; i++) face([rings[j][i], rings[j][(i + 1) % n], c], role, part, [st[j].x - dir * 0.3, st[j].y || 0, 0]);
      });
      return M;
    };
    /** a real wing: sections along the span [{z, x (leading edge), c (chord), t (thickness), y}] — each an
     *  airfoil-like oval (round leading edge), so the wing has a soft silhouette and tapers to its tip */
    M.wing = function (sec, n, role, part = "wing") {
      const rings = sec.map((q) => {
        const ring = [];
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          // a fuller nose and a thin trailing edge: x from the leading edge back along the chord
          const u = 0.5 - 0.5 * ca, th = (q.t * (sa > 0 ? 0.62 : 0.38) * Math.sqrt(u) * (1 - u)) / 0.385;   // round nose, thin tail
          M.verts.push([q.x - q.c * u, (q.y || 0) + Math.sign(sa) * th, q.z]); ring.push(M.verts.length - 1);
        }
        return ring;
      });
      const mid = (q) => [q.x - q.c / 2, q.y || 0, q.z];
      for (let j = 0; j < sec.length - 1; j++) for (let i = 0; i < n; i++) {
        const i2 = (i + 1) % n, ref = X3.lerp(mid(sec[j]), mid(sec[j + 1]), 0.5);
        face([rings[j][i], rings[j][i2], rings[j + 1][i2], rings[j + 1][i]], role, part, ref);
      }
      [[0, -1], [sec.length - 1, 1]].forEach(([j, dir]) => {         // close both ends
        const dz = Math.sign(sec[j].z - sec[sec.length - 1 - j].z) || dir;
        M.verts.push(mid(sec[j]).map((v, k) => (k === 2 ? v + dz * 0.01 : v)));
        const c = M.verts.length - 1;
        for (let i = 0; i < n; i++) face([rings[j][i], rings[j][(i + 1) % n], c], role, part, X3.add(mid(sec[j]), [0, 0, -dz * 0.3]));
      });
      return M;
    };
    /** a flat plate: planform [[x, z], ...] at height y with a thickness (wings, tailplanes) */
    M.slab = function (pl, y, th, role, part = "wing", tilt = 0) {
      const top = [], bot = [], cx = pl.reduce((s, p) => s + p[0], 0) / pl.length;
      pl.forEach(([x, z]) => { const dy = Math.abs(z) * tilt; M.verts.push([x, y + dy + th / 2, z]); top.push(M.verts.length - 1); M.verts.push([x, y + dy - th / 2, z]); bot.push(M.verts.length - 1); });
      const cz = pl.reduce((s, p) => s + p[1], 0) / pl.length, ref = [cx, y + Math.abs(cz) * tilt, cz];
      face(top, role, part, add(ref, [0, -1, 0])); face(bot, role, part, add(ref, [0, 1, 0]));
      for (let i = 0; i < pl.length; i++) { const j = (i + 1) % pl.length; face([top[i], top[j], bot[j], bot[i]], role, part, ref); }
      return M;
    };
    /** a vertical plate: profile [[x, y], ...] at z = 0 (fins) */
    M.fin = function (pr, th, role, part = "fin") {
      const l = [], r = [], cx = pr.reduce((s, p) => s + p[0], 0) / pr.length, cy = pr.reduce((s, p) => s + p[1], 0) / pr.length;
      pr.forEach(([x, y]) => { M.verts.push([x, y, -th / 2]); l.push(M.verts.length - 1); M.verts.push([x, y, th / 2]); r.push(M.verts.length - 1); });
      face(l, role, part, [cx, cy, 1]); face(r, role, part, [cx, cy, -1]);
      for (let i = 0; i < pr.length; i++) { const j = (i + 1) % pr.length; face([l[i], l[j], r[j], r[i]], role, part, [cx, cy, 0]); }
      return M;
    };
    /** a decal (insignia) painted on the faces of a part: a flat polygon of model points, a little off the skin */
    M.decal = function (part, poly, role, dmg = false) { (M.decals = M.decals || []).push({ part, poly, role, dmg }); return M; };
    /** struts and other thin rods: model segments drawn as pencil lines */
    M.rod = function (a, b, role = "line") { (M.rods = M.rods || []).push({ a, b, role }); return M; };
    M.done = function () {
      M.normals = M.faces.map((f) => { const [a, b, c] = f.v.map((i) => M.verts[i]); return norm(cross(sub(b, a), sub(c, a))); });
      M.centers = M.faces.map((f) => f.v.reduce((s, i) => add(s, mul(M.verts[i], 1 / f.v.length)), [0, 0, 0]));
      // edges for outlines: who shares each edge
      const E = new Map();
      M.faces.forEach((f, fi) => f.v.forEach((a, i) => { const b = f.v[(i + 1) % f.v.length], key = a < b ? a + "_" + b : b + "_" + a; (E.get(key) || E.set(key, { a: Math.min(a, b), b: Math.max(a, b), f: [] }).get(key)).f.push(fi); }));
      M.edges = [...E.values()];
      (M.decals || []).forEach((dc) => {               // the face a decal sits on: the nearest face of its part, facing the same way
        const c = dc.poly.reduce((s, p) => add(s, mul(p, 1 / dc.poly.length)), [0, 0, 0]);
        const n = norm(cross(sub(dc.poly[1], dc.poly[0]), sub(dc.poly[2], dc.poly[0])));
        let best = -1, bd = 1e9;
        (M.parts[dc.part] || []).forEach((fi) => { const dd = len(sub(M.centers[fi], c)) - 2 * Math.abs(dot(M.normals[fi], n)); if (dd < bd) { bd = dd; best = fi; } });
        if (best >= 0) { if (dot(M.normals[best], n) < 0) dc.poly = dc.poly.slice().reverse(); M.faces[best].decals.push(dc); }
      });
      return M;
    };
    return M;
  };

  /* ---------------------------------------------------------------- attitude and camera */
  /** a basis for a flying object: forward from the path, up tilted by the bank, then an extra roll */
  P3.attitude = function (fwd, up = [0, 1, 0], roll = 0) {
    const f = norm(fwd);
    let r = cross(f, up);
    if (len(r) < 1e-6) r = cross(f, [0, 0, 1]);
    r = norm(r);
    let u = cross(r, f);
    if (roll) { u = rot(u, f, roll); r = rot(r, f, roll); }
    return { f, u, r };
  };
  /** the stretch of time around t where the path is continuous: [lo, hi] within t +- reach. A path that jumps
   *  (a new shot, a new pass, a teleport) is not a turn: whatever looks at a window of time (speed, bank, a camera
   *  that lags) must stop at the jump, or the plane turns sideways and the camera swings for a few drawings around
   *  every cut. o.from / o.to: the shot's own bounds, if known. */
  P3.span = function (path, t, reach, o = {}) {
    const d = 0.002, ref = Math.min(len(sub(path(t), path(t - d))), len(sub(path(t + d), path(t)))) / d;
    const n = 8;
    let lo = t - reach, hi = t + reach;
    for (const s of [-1, 1]) {                       // walk out from t; stop before a step 4x faster than any so far
      let prev = t, pp = path(t), vmax = ref;          // (so a plane that speeds up from rest is not a jump)
      for (let i = 1; i <= n; i++) {
        const tt = t + (s * reach * i) / n, q = path(tt), v = len(sub(q, pp)) / Math.abs(tt - prev);
        if (v > 4 * vmax + 5) { if (s < 0) lo = prev; else hi = prev; break; }
        vmax = Math.max(vmax, v); prev = tt; pp = q;
      }
    }
    if (o.from !== undefined) lo = Math.max(lo, Math.min(t, o.from));
    if (o.to !== undefined) hi = Math.min(hi, Math.max(t, o.to));
    return [lo, hi];
  };
  /** bank from the path: the lift (up) leans into the turn; path(t) -> [x, y, z] */
  P3.flight = function (path, t, o = {}) {
    const e = o.dt ?? 0.05, g = o.g ?? 3, win = o.win ?? 0.25;
    const [lo, hi] = P3.span(path, t, win + e, o), at = (tt) => path(Math.min(hi, Math.max(lo, tt)));
    const ta = Math.max(lo, t - e), tc = Math.min(hi, t + e), b = path(t);
    let v;
    if (tc - ta > 1e-4) v = mul(sub(at(tc), at(ta)), 1 / (tc - ta));
    else {                                           // the window collapsed to t: the one-sided difference without the jump
      const d = 0.001, fw = mul(sub(path(t + d), b), 1 / d), bw = mul(sub(b, path(t - d)), 1 / d);
      v = len(fw) <= len(bw) ? fw : bw;
    }
    const f = norm(v);
    // the lift, averaged over a short window: where it passes through zero (the slow top of a loop) the plane
    // rolls over smoothly instead of flipping in one drawing; gravity counts weakly (cartoon physics).
    // Only samples inside the continuous stretch count.
    let lift = [0, 0, 0], wsum = 0;
    for (let j = -3; j <= 3; j++) {
      const tt = t + (j * win) / 3, w = 1 - Math.abs(j) / 4;
      if (tt - e < lo - 1e-9 || tt + e > hi + 1e-9) continue;
      const p0 = path(tt - e), p1 = path(tt), p2 = path(tt + e);
      lift = add(lift, mul(add(mul(add(sub(p2, p1), sub(p0, p1)), 1 / (e * e)), [0, g, 0]), w));
      wsum += w;
    }
    lift = wsum > 0 ? mul(lift, 4 / wsum) : [0, 4 * g, 0];
    // the bank comes from the sideways part of the turn only, limited to +-80 degrees: a plane never goes upside
    // down by itself (a pull or a push only pitches it), so it cannot flip over; a roll is added on purpose (o.roll)
    let r0 = cross(f, [0, 1, 0]);
    r0 = len(r0) > 1e-6 ? norm(r0) : [0, 0, 1];
    const u0 = cross(r0, f), lat = dot(lift, r0) / 4;    // lift is a weighted sum (weights add up to 4)
    const bank = 1.35 * Math.tanh(lat / (o.bankK ?? 35));    // smooth in the sideways acceleration, at most ~77 degrees
    const up = add(mul(u0, Math.cos(bank)), mul(r0, Math.sin(bank)));
    return { pos: b, vel: v, att: P3.attitude(f, norm(up), o.roll || 0) };
  };
  /** a camera that lags: the mean of fn(t) -> [x, y, z] (an aim point, a direction) over the last `span` seconds,
   *  never before `from` (the start of the shot); n samples (n = 1: no lag). A chase camera aims at P3.lag(...) so a target that crosses close in
   *  front does not swing the frame in one drawing. Pure function of t. */
  P3.lag = function (fn, t, span = 0.4, from = -Infinity, n = 8) {
    let acc = [0, 0, 0];
    n = Math.max(1, Math.round(n));
    const step = n > 1 ? span / (n - 1) : 0;
    for (let i = 0; i < n; i++) acc = add(acc, fn(Math.max(from, t - step * i)));
    return mul(acc, 1 / n);
  };
  P3.camera = function (eye, target, fov = 40, o = {}) {
    const f = norm(sub(target, eye));
    let r = cross(f, o.up || [0, 1, 0]);
    if (len(r) < 1e-6) r = [1, 0, 0];
    r = norm(r);
    let u = cross(r, f);
    if (o.roll) { u = rot(u, f, o.roll); r = rot(r, f, o.roll); }
    const W = S.W, H = S.H, focal = H / 2 / Math.tan((fov * Math.PI) / 360);
    return {
      eye, f, r, u, focal,
      /** world point -> { x, y (frame pixels), z (depth), k (pixels per metre) } or null behind the camera */
      project(p) {
        const d = sub(p, eye), z = dot(d, f);
        if (z < (o.near ?? 0.5)) return null;
        return { x: W / 2 + (focal * dot(d, r)) / z, y: H / 2 - (focal * dot(d, u)) / z, z, k: focal / z };
      },
    };
  };

  /** the sky gradient line for a camera: [x0, y0, x1, y1] from `above` (px over the horizon, the sky colour) to
   *  `below` (px under it). It runs along world "up" as the frame sees it, so it tilts with a rolling camera, and the
   *  horizon sits focal * tan(elevation) from the centre. c.createLinearGradient(...P3.horizon(cam, H * 1.1, H * 0.5)) */
  P3.horizon = function (cam, above, below) {
    let ux = cam.r[1], uy = -cam.u[1];                // world up (0, 1, 0) seen in the frame (screen y goes down)
    const ul = Math.hypot(ux, uy);
    if (ul < 1e-3) { ux = 0; uy = -1; } else { ux /= ul; uy /= ul; }
    const el = Math.asin(Math.max(-1, Math.min(1, cam.f[1]))), off = Math.max(-2 * S.H, Math.min(2 * S.H, cam.focal * Math.tan(Math.max(-1.4, Math.min(1.4, el)))));
    const hx = S.W / 2 - ux * off, hy = S.H / 2 - uy * off;
    return [hx + ux * above, hy + uy * above, hx - ux * below, hy - uy * below];
  };

  /* ---------------------------------------------------------------- drawables */
  P3.object = (mesh, pos, att, scale = 1, o = {}) => Object.assign({ kind: "mesh", mesh, pos, att, scale }, o);
  P3.puff = (pos, r, o = {}) => Object.assign({ kind: "puff", pos, r }, o);
  P3.custom = (pos, draw) => ({ kind: "custom", pos, draw });

  const toWorld = (ob, p) => add(ob.pos, add(add(mul(ob.att.f, p[0] * ob.scale), mul(ob.att.u, p[1] * ob.scale)), mul(ob.att.r, p[2] * ob.scale)));
  const toWorldDir = (ob, n) => add(add(mul(ob.att.f, n[0]), mul(ob.att.u, n[1])), mul(ob.att.r, n[2]));
  function poly(c, pts) { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); }
  const roleHex = (role) => (role[0] === "#" ? role : S.pal[role]);
  /** the darkest ink of the palette: "black" if it has one, else paper on dark palettes and line on light ones */
  const darkRole = () => (S.has("black") ? "black" : S.pal.shade === "dark" ? "paper" : "line");
  function hatchFace(c, pts, tone, k, seed, spacing, angle, color, alpha, width = 1.4) {
    if (alpha <= 0.02) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach((p) => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    if (x1 - x0 < 3 || y1 - y0 < 3) return;
    c.save(); poly(c, pts); c.clip();
    const ca = Math.cos(angle), sa = Math.sin(angle), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, R = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
    const r = S.rng("h3", seed, k);
    c.strokeStyle = S.rgba(roleHex(color), alpha); c.lineWidth = width; c.lineCap = "round";
    c.beginPath();
    for (let u = -R + r.range(0, spacing); u < R; u += spacing) {
      const j = r.range(-0.8, 0.8);
      c.moveTo(cx + ca * u - sa * R + j, cy + sa * u + ca * R); c.lineTo(cx + ca * u + sa * R - j, cy + sa * u - ca * R);
    }
    c.stroke(); c.restore();
  }

  /** draw a mesh object part by part, far part first: each part is filled (faces far to near, decals,
   *  coloured-pencil strokes) and then outlined, so a nearer part covers the lines of a farther one */
  function drawMesh(c, d, cam, ob, world) {
    const M = ob.mesh, k = d.k, seed = ob.seed || "m";
    const P = M.verts.map((v) => { const w = toWorld(ob, v); return { w, s: cam.project(w) }; });
    if (P.some((p) => !p.s)) return;
    const sun = world.sun || [0.4, 0.8, 0.3];
    const vis = M.faces.map((f, i) => { const n = toWorldDir(ob, M.normals[i]), cw = toWorld(ob, M.centers[i]); return { i, n, front: dot(n, sub(cam.eye, cw)) > 0, z: dot(sub(cw, cam.eye), cam.f) }; });
    const tint = ob.tint || 1, dark = world.shadow || "#1b1f2a", al = ob.alpha ?? 1;
    const kpx = cam.project(ob.pos), w = Math.max(0.8, Math.min(3.2, (ob.line ?? 0.09) * kpx.k));
    const ink = ob.lineColor || world.ink || darkRole();
    const parts = Object.keys(M.parts).map((name) => {
      const fs = M.parts[name];
      return { name, fs, z: fs.reduce((sum, fi) => sum + vis[fi].z, 0) / fs.length };
    }).sort((x, y) => y.z - x.z);
    parts.forEach((pt) => {
      const decals = [];                               // painted after all faces of the part (a curved skin would cover them)
      pt.fs.filter((fi) => vis[fi].front).sort((x, y) => vis[y].z - vis[x].z).forEach((fi) => {
        const v = vis[fi], f = M.faces[fi], pts = f.v.map((j) => P[j].s);
        const lam = Math.max(0, dot(v.n, sun)), skyFill = 0.5 + 0.5 * v.n[1];      // sun + light from the sky above
        const tone = Math.min(1, ((world.ambient ?? 0.5) + 0.12 * skyFill + 0.42 * lam * (world.light ?? 1)) * tint);
        const base = roleHex(f.role);
        poly(c, pts);
        c.fillStyle = S.rgba(S.mix(dark, base, tone), al); c.fill();
        c.strokeStyle = c.fillStyle; c.lineWidth = 0.8; c.stroke();                 // seal hairline seams
        f.decals.forEach((dc) => { if (!dc.dmg || (ob.damage || 0) > 0) decals.push([dc, tone]); });
        let area = 0;
        for (let q = 0; q < pts.length; q++) { const p1 = pts[q], p2 = pts[(q + 1) % pts.length]; area += p1.x * p2.y - p2.x * p1.y; }
        if (ob.pencil !== false && Math.abs(area) > 140) {   // coloured pencil (not on faces too small to show it)
          const hs = (ob.hatchScale || 1) * Math.max(0.6, Math.min(1.3, kpx.k / 60));
          hatchFace(c, pts, tone, k, seed + fi, 6 * hs, -0.75, S.mix(dark, base, Math.max(0, tone - 0.3)), (0.3 + 0.45 * Math.max(0, 0.9 - tone)) * al, 1.6);
          if (tone < 0.66) hatchFace(c, pts, tone, k, seed + "x" + fi, 7 * hs, 0.7, world.hatch || darkRole(), 0.45 * ((0.66 - tone) / 0.66) * al, 1.4);
          if (tone > 0.8) hatchFace(c, pts, tone, k, seed + "l" + fi, 9 * hs, -0.75, "#ffffff", 0.18 * al, 1.2);
        }
      });
      decals.forEach(([dc, tone]) => { const q = dc.poly.map((p) => cam.project(toWorld(ob, p))); if (q.every(Boolean)) { poly(c, q); c.fillStyle = S.rgba(S.mix(dark, roleHex(dc.role), Math.min(1, 0.45 + tone * 0.6)), al); c.fill(); } });
      // outlines of this part: silhouette (front meets back or nothing) and sharp creases
      const segs = [], thin = [];
      M.edges.forEach((e) => {
        if (M.faces[e.f[0]].part !== pt.name) return;
        const fr = e.f.filter((fi) => vis[fi].front).length;
        if (!fr) return;
        if (fr < e.f.length || e.f.length === 1) segs.push(e);
        else if (e.f.length === 2 && dot(vis[e.f[0]].n, vis[e.f[1]].n) < (ob.crease ?? 0.55)) thin.push(e);
      });
      const stroke = (list, width, alpha, tag) => chains(list).forEach((ch, ci) => {
        S.pen.stroke(c, ch.map((i) => P[i].s), { k, seed: seed + pt.name + tag + ci, width, color: ink, alpha: alpha * al, wobble: 0.5, breaks: 0, taper: false, zoomComp: false });
      });
      stroke(segs, w, 0.9, "s"); stroke(thin, w * 0.55, 0.55, "c");
    });
    (M.rods || []).forEach((rd, i) => {
      const a = cam.project(toWorld(ob, rd.a)), b = cam.project(toWorld(ob, rd.b));
      if (a && b) S.pen.stroke(c, [a, b], { k, seed: seed + "rod" + i, width: w * 0.9, color: rd.role === "line" ? ink : rd.role, alpha: 0.9 * al, wobble: 0.3, breaks: 0, taper: false, zoomComp: false });
    });
    if (ob.after) ob.after(c, cam, (p) => cam.project(toWorld(ob, p)), kpx);
  }
  /** join edges into polylines (so a silhouette is one boiling line, not a hundred dashes) */
  function chains(list) {
    const adj = new Map(), used = new Set(), out = [];
    list.forEach((e, i) => { [e.a, e.b].forEach((v) => (adj.get(v) || adj.set(v, []).get(v)).push(i)); });
    list.forEach((e, i) => {
      if (used.has(i)) return;
      used.add(i);
      const ch = [e.a, e.b];
      for (const end of [1, 0]) {
        for (;;) {
          const v = end ? ch[ch.length - 1] : ch[0], nx = (adj.get(v) || []).find((j) => !used.has(j));
          if (nx === undefined) break;
          used.add(nx);
          const o = list[nx].a === v ? list[nx].b : list[nx].a;
          end ? ch.push(o) : ch.unshift(o);
        }
      }
      out.push(ch);
    });
    return out;
  }
  /** world.keep = [points]: what the shot is about (the planes). A puff between the camera and one of them fades to
   *  a veil, so a cloud never hides the subject (it fades smoothly as the puff moves off the line of sight) */
  function keepFade(cam, ob, world) {
    let k = 1;
    (world.keep || []).forEach((q) => {
      const dq = sub(q, cam.eye), L = len(dq), dp = sub(ob.pos, cam.eye), along = dot(dp, dq) / (L || 1);
      if (along <= 0 || along >= L + ob.r * 0.3) return;
      const perp = len(sub(dp, mul(dq, along / (L || 1))));
      k = Math.min(k, 0.15 + 0.85 * Math.max(0, Math.min(1, (perp - 0.6 * ob.r) / (0.9 * ob.r))));
    });
    return k;
  }
  function drawPuff(c, d, cam, ob, world) {
    const p = cam.project(ob.pos);
    if (!p) return;
    const R = ob.r * p.k;
    if (R < 1.5 || p.x + R < -50 || p.x - R > S.W + 50 || p.y + R < -50 || p.y - R > S.H + 50) return;
    // the side toward the sun on screen
    const sp = cam.project(add(ob.pos, mul(world.sun, ob.r * 4))) || { x: p.x, y: p.y - R };
    let lx = sp.x - p.x, ly = sp.y - p.y; const ll = Math.hypot(lx, ly) || 1; lx /= ll; ly /= ll;
    // not a ball: a puff is wider than tall and its edge is bumpy (a cauliflower), so a cloud reads as cloud
    const flat = ob.flat ?? 0.78, rs = S.rng("puffshape", ob.seed || "p"), ph1 = rs.range(0, 6.3), ph2 = rs.range(0, 6.3);
    const nb = rs.int(5, 7), RX = R * 1.12, RY = R * flat;
    const edge = (th) => 1 + 0.09 * Math.sin(nb * th + ph1) + 0.05 * Math.sin((nb * 2 + 1) * th + ph2);
    const g = c.createRadialGradient(p.x + lx * R * 0.45, p.y + ly * R * 0.4, R * 0.1, p.x, p.y + R * 0.1, R * 1.32);   // fades out at the bumpy edge
    const lit = roleHex(ob.lit || "line"), sh = roleHex(ob.shade || "soft"), a = (ob.alpha ?? 1) * Math.max(0, Math.min(1, (p.z - ob.r * 1.2) / (ob.r * 3 + 6))) * keepFade(cam, ob, world);
    if (a <= 0.01) return;
    g.addColorStop(0, S.rgba(lit, a)); g.addColorStop(0.42, S.rgba(S.mix(sh, lit, 0.72), a)); g.addColorStop(0.7, S.rgba(S.mix(sh, lit, 0.35), a * 0.92)); g.addColorStop(0.88, S.rgba(sh, a * 0.5)); g.addColorStop(1, S.rgba(sh, 0));
    c.beginPath();
    for (let i = 0; i <= 56; i++) { const th = (i / 56) * Math.PI * 2, e = edge(th); const x = p.x + Math.cos(th) * RX * e, y = p.y + Math.sin(th) * RY * e; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.closePath(); c.fillStyle = g; c.fill();
    if (R > 25 && ob.rim) {                               // a short, broken pencil rim on the sunlit top only
      const a0 = Math.atan2(ly, lx), pts = [];
      for (let i = 0; i <= 10; i++) { const t = a0 - 0.6 + (1.2 * i) / 10, e = edge(t); pts.push({ x: p.x + Math.cos(t) * RX * e * 0.97, y: p.y + Math.sin(t) * RY * e * 0.97 }); }
      S.pen.stroke(c, pts, { k: d.k, seed: ob.seed || "pf", width: Math.min(2.6, 0.6 + R / 110), color: ob.rimColor || "line", alpha: (ob.rimAlpha ?? 0.45) * a, taper: [0.3, 0.3], breaks: 1, zoomComp: false });
    }
  }
  /** draw everything far to near; objects carry their own seed for the boiling lines */
  P3.draw = function (d, cam, list, world = {}) {
    const c = world.ctx || d.ink;
    d.screen(c, () => {
      list.map((ob) => ({ ob, z: dot(sub(ob.pos, cam.eye), cam.f) + (ob.zBias || 0) }))
        .filter((e) => e.z > 0.5).sort((a, b) => b.z - a.z)
        .forEach(({ ob }) => (ob.kind === "mesh" ? drawMesh(c, d, cam, ob, world) : ob.kind === "puff" ? drawPuff(c, d, cam, ob, world) : ob.draw(c, cam)));
    });
  };
  /** a cumulus cloud: puffs piled into a dome on a flat base. base = [x, y, z] (centre of the bottom),
   *  w = width, h = height (metres). The top outer puffs get a pencil rim. o: { lit, shade, alpha, seed, rimColor } */
  P3.cumulus = function (base, w, h, seed, o = {}) {
    // o.lod < 1 draws a far cloud with fewer, bigger puffs; the lower a puff sits, the more it is in the cloud's own shade
    const r = S.rng("cumulus", seed), out = [], lod = o.lod ?? 1, tiers = Math.max(3, Math.round((h / (w * 0.18)) * Math.sqrt(lod)));
    const litHex = roleHex(o.lit || "line"), shHex = roleHex(o.shade || "soft"), baseHex = roleHex(o.base || o.shade || "soft");
    for (let t = 0; t < tiers; t++) {
      const u = t / (tiers - 1), rw = (w / 2) * (1 - 0.75 * Math.pow(u, 1.3)), y = base[1] + u * h * 0.8;
      const n = Math.max(3, Math.round(((rw * 2) / (w * 0.13)) * lod));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r.range(-0.3, 0.3), rad = rw * r.range(0.55, 1.0);
        const pr = (w * r.range(0.15, 0.24) * (1 - 0.3 * u)) / Math.sqrt(lod);    // big, overlapping puffs: no gaps
        out.push(P3.puff([base[0] + Math.cos(a) * rad, y + r.range(0, pr * 0.4), base[2] + Math.sin(a) * rad], pr,
          Object.assign({ seed: seed + "_" + t + "_" + i, rim: lod >= 1 && (t >= tiers - 2 || (t > 0 && rad > rw * 0.85)),
            lit: S.mix(shHex, litHex, 0.35 + 0.65 * u), shade: S.mix(baseHex, shHex, 0.4 + 0.6 * u) }, o, { lit: undefined, shade: undefined, base: undefined },
          { lit: S.mix(shHex, litHex, 0.35 + 0.65 * u), shade: S.mix(baseHex, shHex, 0.4 + 0.6 * u) })));
      }
    }
    return out;
  };
  /** a path from samples, e.g. a flight simulation run once at load (deterministic, then interpolated):
   *  rows = [[x, y, z, fx, fy, fz, ux, uy, uz, speed], ...] every dt seconds from t0. fn(t) -> position (straight
   *  on beyond the ends); fn.flight(t, roll) -> { pos, vel, att } with the simulated attitude */
  P3.track = function (t0, dt, S) {
    const at = (t) => { const x = (t - t0) / dt, i = Math.max(0, Math.min(S.length - 2, Math.floor(x))); return [S[i], S[i + 1], Math.max(0, Math.min(1, x - i)), x]; };
    const L = (a, b, k, j) => a[j] + (b[j] - a[j]) * k;
    const fn = (t) => {
      const [a, b, k, x] = at(t), p = [L(a, b, k, 0), L(a, b, k, 1), L(a, b, k, 2)];
      const over = x > S.length - 1 ? (x - (S.length - 1)) * dt : x < 0 ? x * dt : 0;
      return over ? add(p, mul([a[3], a[4], a[5]], a[9] * over)) : p;
    };
    fn.flight = (t, roll = 0) => {
      const [a, b, k] = at(t), f = norm([L(a, b, k, 3), L(a, b, k, 4), L(a, b, k, 5)]), u = norm([L(a, b, k, 6), L(a, b, k, 7), L(a, b, k, 8)]);
      return { pos: fn(t), vel: mul(f, L(a, b, k, 9)), att: P3.attitude(f, u, roll) };
    };
    return fn;
  };
  /** a polyline through world points (trails, tracers) — drawn over what is already there */
  P3.line = function (c, d, cam, pts, o) {
    const q = pts.map((p) => cam.project(p)).filter(Boolean);
    if (q.length < 2) return;
    S.pen.stroke(c, q, Object.assign({ k: d.k, wobble: 0.4, breaks: 0, taper: false, zoomComp: false }, o));
  };
  global.P3 = P3;
})(window);
