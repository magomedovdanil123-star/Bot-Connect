/* ============================================================================
 * kit3d — building blocks for the "photo + 3D" template (Three.js, deterministic).
 * Everything is a pure function of time; randomness is seeded; colours come from palette roles.
 *
 *   time      clamp prog lerp ease rng hash cueTimes
 *   render    mkRenderer envMap cv tex glowTex sparkTex dotTex camKeys
 *   space     starfield nebula bandedTexture planet ring earth atmosphere goldStar burst
 *   faces     faceSprite (a face on a glowing ball that never gets clipped) + drawSunFace
 *   paper     woodSurface paperSheet popupCutouts (a pop-up book from ANY picture)
 *   overlay   leavesOverlay (falling leaves / snow over the photo)
 *   DOM       photoLayer (Ken Burns over a real photo), fade, captions
 * Pitfalls this file already handles: alpha masks on cut-outs need the WHOLE-sheet mask and a
 * customDepthMaterial (shadows); a face sprite is screen-aligned, so it floats 1.7 R in front of
 * its ball and is rescaled; fresnel pow() bases are clamped; one PMREM per renderer.
 * ==========================================================================*/
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";

export const PI = Math.PI, TAU = Math.PI * 2;
export const V = (x, y, z) => new THREE.Vector3(x, y, z);

/* ---------------------------------------------------------------- time */
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const lerp = (a, b, k) => a + (b - a) * k;
export const ease = {
  linear: (x) => x,
  out: (x) => 1 - Math.pow(1 - x, 3), in: (x) => x * x * x,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  smooth: (x) => x * x * (3 - 2 * x),
};
export function hash(...keys) {
  let h = 2166136261 >>> 0;
  for (const k of keys) { const s = String(k); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); }
  return h >>> 0;
}
/** seeded generator keyed by object identity: rng("star", i) */
export function rng(...keys) {
  let a = hash(...keys);
  const r = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  r.range = (x, y) => x + (y - x) * r();
  return r;
}
/** C(id) = cue time, CE(id) = cue end, from window.CUES (the same file the sound reads) */
export function cueTimes() {
  const ev = (window.CUES && window.CUES.events) || [];
  const get = (id) => { const e = ev.find((x) => x.id === id); if (!e) throw new Error("cue not found: " + id); return e; };
  return { C: (id) => get(id).t, CE: (id) => get(id).t + (get(id).dur || 0), events: ev };
}

/* ---------------------------------------------------------------- palette */
export function palette(name) {
  const pal = window.SKETCH_PALETTES[name];
  if (!pal) throw new Error("unknown palette " + name);
  const hex = (role) => { if (!pal[role]) throw new Error(`palette ${name} has no role ${role}`); return pal[role]; };
  const col = (role) => new THREE.Color(hex(role));
  const rgba = (role, a) => { const c = col(role); return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`; };
  return { pal, hex, col, rgba };
}

/* ---------------------------------------------------------------- render */
export function mkRenderer(canvas, W, H, { alpha = false, shadows = false } = {}) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha, preserveDrawingBuffer: true });
  r.setSize(W, H, false); r.setPixelRatio(1); // fixed: output must not depend on the machine's DPR
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  if (alpha) r.setClearColor(0x000000, 0);
  if (shadows) { r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; }
  return r;
}
/** studio reflections; one per renderer (a PMREM texture belongs to its own WebGL context) */
export const envMap = (renderer) => new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
export function cv(w, h, fn) { const c = document.createElement("canvas"); c.width = w; c.height = h; fn(c.getContext("2d"), w, h); return c; }
export function tex(canvas, srgb = true) { const t = new THREE.CanvasTexture(canvas); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
export function glowTex(P, role, core = 1) {
  return tex(cv(256, 256, (c) => { const g = c.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, P.rgba(role, core)); g.addColorStop(0.25, P.rgba(role, core * 0.45)); g.addColorStop(1, P.rgba(role, 0)); c.fillStyle = g; c.fillRect(0, 0, 256, 256); }));
}
export function sparkTex() {
  return tex(cv(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 40); g.addColorStop(0, "rgba(255,248,220,1)"); g.addColorStop(1, "rgba(255,200,90,0)"); c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = "rgba(255,244,210,0.95)"; c.lineCap = "round";
    [[64, 4, 64, 124, 4], [4, 64, 124, 64, 4], [30, 30, 98, 98, 2], [98, 30, 30, 98, 2]].forEach(([a, b, d, e, w]) => { c.lineWidth = w; c.beginPath(); c.moveTo(a, b); c.lineTo(d, e); c.stroke(); });
  }));
}
export function dotTex() {
  return tex(cv(64, 64, (c) => { const g = c.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.3, "rgba(255,255,255,0.6)"); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); }));
}
const additive = (o) => Object.assign({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }, o);
export const glowSprite = (map, scale) => { const s = new THREE.Sprite(new THREE.SpriteMaterial(additive({ map }))); s.scale.setScalar(scale); return s; };

/** keyframed camera: keys = [[t, position, target, ease?], ...] -> (t) => { pos, tgt } */
export function camKeys(keys) {
  return (t) => {
    if (t <= keys[0][0]) return { pos: keys[0][1].clone(), tgt: keys[0][2].clone() };
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, p0, l0] = keys[i], [t1, p1, l1, e] = keys[i + 1];
      if (t > t1) continue;
      const u = (typeof e === "function" ? e : ease[e || "inOut"])(prog(t, t0, t1));
      return { pos: p0.clone().lerp(p1, u), tgt: l0.clone().lerp(l1, u) };
    }
    const k = keys[keys.length - 1];
    return { pos: k[1].clone(), tgt: k[2].clone() };
  };
}

/* ---------------------------------------------------------------- space */
export function starfield(scene, P, { counts = [[2600, 0.5], [800, 0.9], [160, 1.7]], radius = [90, 150] } = {}) {
  const dot = dotTex();
  counts.forEach(([n, size], g) => {
    const pos = new Float32Array(n * 3), cl = new Float32Array(n * 3), r = rng("stars", g);
    for (let i = 0; i < n; i++) {
      const th = r() * TAU, ph = Math.acos(2 * r() - 1), rr = r.range(radius[0], radius[1]);
      pos.set([rr * Math.sin(ph) * Math.cos(th), rr * Math.sin(ph) * Math.sin(th), rr * Math.cos(ph)], i * 3);
      const tint = r(), c = tint < 0.15 ? P.col("warm") : tint < 0.3 ? P.col("a1") : new THREE.Color(1, 1, 1);
      c.multiplyScalar(r.range(0.5, 1)); cl.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); geo.setAttribute("color", new THREE.BufferAttribute(cl, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial(additive({ size, map: dot, vertexColors: true }))));
  });
}
export function nebula(scene, P, { roles = ["nebula1", "nebula2"], count = 9, from = V(-70, 55, -105), to = V(60, -45, -105) } = {}) {
  for (let i = 0; i < count; i++) {
    const map = tex(cv(512, 512, (c) => { const r = rng("neb", i); for (let j = 0; j < 70; j++) { const x = r.range(80, 432), y = r.range(80, 432), rad = r.range(40, 170), g = c.createRadialGradient(x, y, 0, x, y, rad), role = roles[(j + i) % roles.length]; g.addColorStop(0, P.rgba(role, r.range(0.05, 0.16))); g.addColorStop(1, P.rgba(role, 0)); c.fillStyle = g; c.fillRect(0, 0, 512, 512); } }));
    const s = new THREE.Sprite(new THREE.SpriteMaterial(additive({ map, opacity: 0.9, toneMapped: true })));
    const u = i / Math.max(1, count - 1); s.position.copy(from.clone().lerp(to, u)).add(V((i % 2) * 10, 0, (i % 3) * 8)); s.scale.setScalar(60 + (i % 3) * 18); s.material.rotation = i;
    scene.add(s);
  }
}
/** wavy horizontal bands (gas giants) from palette roles */
export function bandedTexture(P, seed, roles) {
  return tex(cv(1024, 512, (c, w, h) => {
    const img = c.createImageData(w, h), cols = roles.map((r) => P.col(r)), r = rng("bands", seed), ph = r() * 10;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const yy = y + 10 * Math.sin(x * 0.012 + y * 0.03 + ph) + 4 * Math.sin(x * 0.05 + ph * 2);
      const b = ((Math.floor(yy / 38) % cols.length) + cols.length) % cols.length, cc = cols[b], f = 0.85 + 0.15 * Math.sin(yy * 0.4);
      const i = (y * w + x) * 4; img.data[i] = cc.r * 255 * f; img.data[i + 1] = cc.g * 255 * f; img.data[i + 2] = cc.b * 255 * f; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
  }));
}
export function planet(scene, pos, r, material) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 32), material); m.position.copy(pos); scene.add(m); return m; }
export function ring(scene, P, pos, rIn, rOut, roles, rot = [-1.2, 0.15, 0.3]) {
  const mat = new THREE.MeshStandardMaterial({ transparent: true, side: THREE.DoubleSide, roughness: 0.7, depthWrite: false, map: tex(cv(1024, 1024, (c) => {
    const r = rng("ring", roles.join());
    for (let rad = rIn / rOut; rad < 1.0; rad += 0.004) { c.strokeStyle = P.rgba(roles[Math.floor(r() * roles.length)], r.range(0.25, 0.85)); c.lineWidth = 3.2; c.beginPath(); c.arc(512, 512, rad * 510, 0, TAU); c.stroke(); }
  })) });
  const m = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 160), mat); m.position.copy(pos); m.rotation.set(...rot); scene.add(m); return m;
}
/** soft blue rim around a planet (fresnel; the pow base is clamped — pitfall) */
export function atmosphere(r, color = 0x6fb4ff, intensity = 0.85, power = 3.4) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 96, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { glowColor: { value: new THREE.Color(color) }, k: { value: intensity }, pw: { value: power } },
    vertexShader: "varying vec3 vN; varying vec3 vV; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - wp.xyz); gl_Position = projectionMatrix * viewMatrix * wp; }",
    fragmentShader: "uniform vec3 glowColor; uniform float k; uniform float pw; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), pw); gl_FragColor = vec4(glowColor * f * k, f); }",
  }));
}
/* seamless value noise on the sphere, for Earth-like textures */
function vhash(x, y, z, sd) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177) ^ Math.imul(sd, 144665); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) & 0xffff) / 65535; }
function vnoise(x, y, z, sd) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf), L = (a, b, k) => a + (b - a) * k, hh = (dx, dy, dz) => vhash(xi + dx, yi + dy, zi + dz, sd);
  return L(L(L(hh(0, 0, 0), hh(1, 0, 0), u), L(hh(0, 1, 0), hh(1, 1, 0), u), v), L(L(hh(0, 0, 1), hh(1, 0, 1), u), L(hh(0, 1, 1), hh(1, 1, 1), u), v), w);
}
export function fbm(x, y, z, sd, oct = 5) { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, z * f, sd + i); f *= 2.03; a *= 0.5; } return s; }
/**
 * Earth with coastlines grown around YOUR continents: continents = [[[u, v], ...], ...] in -1..1 units,
 * drawn on the side that faces +Z (texture u = 0.25). Returns { earth, clouds, atmo, dirFromUV(u, v) }.
 */
export function earth(scene, pos, r, { continents = [], seed = 11, size = [2048, 1024] } = {}) {
  const [EW, EH] = size;
  const mask = cv(EW, EH, (c) => {
    c.fillStyle = "#000"; c.fillRect(0, 0, EW, EH); c.filter = "blur(16px)"; c.fillStyle = "#fff";
    const land = (pts, cx, cy, sx, sy) => { c.beginPath(); pts.forEach(([u, v], i) => (i ? c.lineTo(cx + u * sx, cy + v * sy) : c.moveTo(cx + u * sx, cy + v * sy))); c.closePath(); c.fill(); };
    continents.forEach((p) => land(p, EW * 0.25, EH * 0.46, EW * 0.16, EH * 0.29));
    continents.forEach((p) => land(p.map(([u, v]) => [-v * 0.8, u]), EW * 0.71, EH * 0.46, EW * 0.137, EH * 0.25));
  }).getContext("2d").getImageData(0, 0, EW, EH).data;
  const mk = () => { const c = document.createElement("canvas"); c.width = EW; c.height = EH; return c; };
  const colC = mk(), rouC = mk(), cloC = mk();
  const ci = colC.getContext("2d").createImageData(EW, EH), ri = rouC.getContext("2d").createImageData(EW, EH), ki = cloC.getContext("2d").createImageData(EW, EH);
  const deep = [10, 38, 86], shallow = [34, 110, 170], grass = [62, 120, 52], forest = [36, 84, 40], desert = [186, 160, 106], rock = [118, 98, 74], ice = [236, 242, 248];
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  for (let j = 0; j < EH; j++) {
    const th = ((j + 0.5) / EH) * PI, st = Math.sin(th), y = Math.cos(th), lat = Math.abs(90 - (th * 180) / PI);
    for (let i = 0; i < EW; i++) {
      const ph = ((i + 0.5) / EW) * TAU, x = -Math.cos(ph) * st, z = Math.sin(ph) * st, o = (j * EW + i) * 4;
      const m = mask[o] / 255 + (fbm(x * 3, y * 3, z * 3, seed) - 0.5) * 0.7 + (fbm(x * 9, y * 9, z * 9, seed + 12, 3) - 0.5) * 0.18;
      let colr, rough;
      if (m > 0.5) {
        const e = clamp((m - 0.5) * 2.2), dry = clamp((fbm(x * 4, y * 4, z * 4, seed + 20) - 0.42) * 3) * clamp(1 - Math.abs(lat - 24) / 18);
        colr = mix(mix(grass, forest, clamp(fbm(x * 6, y * 6, z * 6, seed + 30) * 1.6 - 0.5)), desert, dry);
        colr = mix(colr, rock, clamp((e - 0.55) * 1.6) * 0.7); rough = 230;
      } else { colr = mix(shallow, deep, clamp((0.5 - m) * 3.2)); rough = 135; } // ocean roughness >= 0.5: no "glass ball" (pitfall)
      if (lat > 70 + (fbm(x * 5, y * 5, z * 5, seed + 40) - 0.5) * 14) { colr = ice; rough = 200; }
      ci.data.set([colr[0], colr[1], colr[2], 255], o); ri.data.set([rough, rough, rough, 255], o);
      const ca = clamp((fbm(x * 4 + 7, y * 7, z * 4, seed + 50) - 0.52) * 3.2) * 0.9;
      ki.data.set([255, 255, 255, ca * 255], o);
    }
  }
  colC.getContext("2d").putImageData(ci, 0, 0); rouC.getContext("2d").putImageData(ri, 0, 0); cloC.getContext("2d").putImageData(ki, 0, 0);
  const earthM = planet(scene, pos, r, new THREE.MeshStandardMaterial({ map: tex(colC), roughnessMap: tex(rouC, false), roughness: 1, metalness: 0.02, envMapIntensity: 0.12 }));
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(r * 1.012, 96, 48), new THREE.MeshStandardMaterial({ map: tex(cloC), transparent: true, depthWrite: false, roughness: 1, envMapIntensity: 0.1 }));
  clouds.position.copy(pos); scene.add(clouds);
  const atmo = atmosphere(r * 1.06, 0x6fb4ff, 0.6, 3.6); atmo.position.copy(pos); scene.add(atmo);
  /** world direction of texture point (u, v) when the earth is turned by rotY */
  const dirFromUV = (u, v, rotY = 0) => { const ph = u * TAU, th = v * PI; return V(-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)).applyAxisAngle(V(0, 1, 0), rotY).normalize(); };
  return { earth: earthM, clouds, atmo, dirFromUV };
}
export function starGeometry(R1 = 0.3, R2 = 0.13) {
  const s = new THREE.Shape();
  for (let i = 0; i <= 10; i++) { const a = -PI / 2 + (i * PI) / 5, r = i % 2 ? R2 : R1; if (i) s.lineTo(Math.cos(a) * r, -Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, -Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3 }); g.center(); return g;
}
/** a golden extruded star with a glow; returns the mesh (glow is its child) */
export function goldStar(scene, P, { size = 0.3, glow = 1.2 } = {}) {
  const m = new THREE.Mesh(starGeometry(size, size * 0.43), new THREE.MeshStandardMaterial({ color: P.col("gold"), metalness: 1, roughness: 0.22, emissive: P.col("orange"), emissiveIntensity: 0.35 }));
  m.add(glowSprite(glowTex(P, "warm", 0.9), glow * size / 0.3));
  scene.add(m); return m;
}
/** sparkle bursts: const b = burst(scene, 10); b.update(at, p, size, spread) each frame (p outside 0..1 hides) */
export function burst(scene, n = 10) {
  const map = sparkTex(), list = [];
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial(additive({ map }))); s.visible = false; scene.add(s); list.push(s); }
  return {
    update(at, p, size = 0.5, spread = 1) {
      list.forEach((s, i) => {
        s.visible = p > 0 && p < 1; if (!s.visible) return;
        const a = (i / list.length) * TAU + 0.4, d = spread * (0.2 + ease.out(p));
        s.position.set(at.x + Math.cos(a) * d, at.y + Math.sin(a) * d, at.z + 0.1); s.scale.setScalar(size * (1 - p) + size * 0.15);
      });
    },
  };
}

/* ---------------------------------------------------------------- faces */
/** default painter: two eyes (clipped to the white, eyelid wink), brows, cheeks, nose, smile / talking mouth */
export function drawSunFace(c, s) {
  const brown = "#5a2a0c";
  c.save(); c.translate(256, 256); c.rotate(-0.18); c.lineCap = "round";
  const eye = (x, y, lid) => {
    c.save(); c.beginPath(); c.ellipse(x, y, 30, 24, 0, 0, TAU); c.fillStyle = "#fffaf0"; c.fill(); c.clip();
    const px = x + s.look.x * 8, py = y + s.look.y * 5;
    c.fillStyle = "#7a3a12"; c.beginPath(); c.arc(px, py, 15, 0, TAU); c.fill();
    c.fillStyle = "#2a1206"; c.beginPath(); c.arc(px, py, 8, 0, TAU); c.fill();
    c.fillStyle = "#fff"; c.beginPath(); c.arc(px + 5, py - 6, 4.5, 0, TAU); c.fill();
    if (lid > 0) { c.fillStyle = s.skin || "#f6b62a"; c.fillRect(x - 32, y - 26, 64, 50 * lid); }
    c.restore();
    c.strokeStyle = brown; c.lineWidth = 4; c.beginPath(); c.ellipse(x, y, 30, 24, 0, 0, TAU); c.stroke();
    if (lid > 0.02) { const ly = y - 24 + 48 * lid; c.lineWidth = 7; c.beginPath(); c.moveTo(x - 30, Math.min(ly, y + 2)); c.quadraticCurveTo(x, ly + 10 * lid, x + 30, Math.min(ly, y + 2)); c.stroke(); }
  };
  [[-82, -30, s.blink || 0], [78, -30, Math.max(s.blink || 0, s.wink || 0)]].forEach(([x, y, lid]) => {
    c.strokeStyle = brown; c.lineWidth = 9; c.beginPath(); c.arc(x, y - 30 + 6 * lid, 40, PI * 1.15, PI * 1.85); c.stroke();
    eye(x, y, lid);
  });
  [[-128, 52], [124, 52]].forEach(([x, y]) => { const g = c.createRadialGradient(x, y, 0, x, y, 48); g.addColorStop(0, "rgba(240,90,50,0.75)"); g.addColorStop(1, "rgba(240,90,50,0)"); c.fillStyle = g; c.fillRect(x - 50, y - 50, 100, 100); });
  c.strokeStyle = brown; c.lineWidth = 6; c.beginPath(); c.moveTo(-4, -4); c.quadraticCurveTo(-18, 40, 4, 44); c.stroke();
  if ((s.talk || 0) > 0.05) { c.fillStyle = "#7a1f12"; c.beginPath(); c.ellipse(0, 92, 46, 10 + 30 * s.talk, 0, 0, TAU); c.fill(); c.fillStyle = "#e0606a"; c.beginPath(); c.ellipse(0, 100 + 18 * s.talk, 26, 9 * s.talk + 2, 0, 0, TAU); c.fill(); }
  else { c.lineWidth = 11; c.beginPath(); c.arc(0, 30, 82, PI * 0.2, PI * 0.8); c.stroke(); }
  c.restore();
}
/**
 * A face on a ball (sun, moon, planet). Screen-aligned sprites tilt into an off-centre ball, so the face
 * floats `float` radii in front of it and is rescaled to the same on-screen size (pitfall).
 * face.update(cameraPos, state) every frame; state = { look:{x,y}, talk 0..1, wink 0..1, blink 0..1 }.
 */
export function faceSprite(scene, center, radius, { size = 1.75, float = 1.7, draw = drawSunFace } = {}) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = 512;
  const t = tex(canvas);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  scene.add(sprite);
  return {
    sprite,
    update(camPos, state) {
      const c = canvas.getContext("2d"); c.clearRect(0, 0, 512, 512); draw(c, state); t.needsUpdate = true;
      const d = camPos.distanceTo(center), off = radius * float, toCam = camPos.clone().sub(center).normalize();
      sprite.position.copy(center).add(toCam.multiplyScalar(off));
      sprite.scale.setScalar((size * radius * (d - off)) / Math.max(1e-3, d - radius * 1.02));
    },
  };
}

/* ---------------------------------------------------------------- paper */
export function woodSurface(scene, P, { size = [16, 10], repeat = 2 } = {}) {
  const woodCv = cv(2048, 1024, (c, w, h) => {
    c.fillStyle = P.hex("wood"); c.fillRect(0, 0, w, h);
    const r = rng("wood");
    for (let i = 0; i < 2200; i++) { const y = r() * h, x = r() * w, L = r.range(80, 600); c.strokeStyle = r() < 0.55 ? `rgba(40,30,20,${r.range(0.05, 0.22)})` : `rgba(200,190,160,${r.range(0.04, 0.16)})`; c.lineWidth = r.range(0.8, 3); c.beginPath(); c.moveTo(x, y); c.bezierCurveTo(x + L * 0.3, y + r.range(-4, 4), x + L * 0.7, y + r.range(-4, 4), x + L, y + r.range(-3, 3)); c.stroke(); }
    for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h, g = c.createRadialGradient(x, y, 0, x, y, r.range(60, 220)); g.addColorStop(0, P.rgba("green", r.range(0.05, 0.12))); g.addColorStop(1, P.rgba("green", 0)); c.fillStyle = g; c.fillRect(0, 0, w, h); }
    for (let y = 0; y < h; y += 256) { c.fillStyle = P.hex("woodgap"); c.fillRect(0, y, w, 12); c.fillStyle = "rgba(220,210,180,0.18)"; c.fillRect(0, y + 12, w, 3); }
  });
  const map = tex(woodCv), bump = tex(woodCv, false);
  [map, bump].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.4, roughness: 0.88 }));
  m.rotation.x = -PI / 2; m.receiveShadow = true; scene.add(m); return m;
}
/** height of a sheet with lifted corners at (x, z) */
export const sheetCurl = (PW, PH) => (x, z) => { const dx = Math.abs(x) / (PW / 2), dz = Math.abs(z) / (PH / 2); return 0.012 + 0.035 * Math.pow(Math.max(dx, dz), 8) + 0.03 * Math.pow(dx * dz, 6) + 0.003 * Math.sin(x * 2.3) * Math.cos(z * 1.7); };
/** a sheet of paper lying on y = 0 showing a picture; PW = width in world units */
export function paperSheet(scene, map, PW, PH) {
  const curl = sheetCurl(PW, PH);
  const g = new THREE.PlaneGeometry(PW, PH, 80, 60); g.rotateX(-PI / 2);
  const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, curl(p.getX(i), p.getZ(i))); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, roughness: 0.92 })); m.receiveShadow = true; scene.add(m);
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(PW * 1.12, PH * 1.16), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, map: tex(cv(256, 256, (c) => { c.filter = "blur(14px)"; c.fillStyle = "rgba(0,0,0,0.55)"; c.fillRect(30, 30, 196, 196); })) }));
  contact.rotation.x = -PI / 2; contact.position.set(0.04, 0.002, 0.05); scene.add(contact);
  return { mesh: m, curl };
}
/**
 * Pop-up book from ANY picture: each ellipse { id, cx, cy, rx, ry, rot, at (seconds), d (delay) } in IMAGE
 * pixels becomes a card hinged on the sheet that stands up at time `at`. Draw ellipses a little bigger than the
 * object so the white paper halo is cut out too. update(t) animates; centerOf(id) gives the standing card centre.
 */
export function popupCutouts(scene, map, image, sheet, PW, ellipses, { lean = 0.12, sheetColor = 0xfbfaf4 } = {}) {
  const IW = image.width, IH = image.height, RS = PW / IW, refX = (x) => (x - IW / 2) * RS, refZ = (y) => (y - IH / 2) * RS;
  const cards = ellipses.map((ct) => {
    const rt = ct.rot || 0, hw = Math.hypot(ct.rx * Math.cos(rt), ct.ry * Math.sin(rt)), hh = Math.hypot(ct.rx * Math.sin(rt), ct.ry * Math.cos(rt));
    const x0 = Math.max(0, ct.cx - hw), x1 = Math.min(IW, ct.cx + hw), y0 = Math.max(0, ct.cy - hh), y1 = Math.min(IH, ct.cy + hh);
    const wW = (x1 - x0) * RS, hW = (y1 - y0) * RS;
    const g = new THREE.PlaneGeometry(wW, hW, 1, 1); g.translate(0, hW / 2, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, (x0 + u * (x1 - x0)) / IW, 1 - (y1 - v * (y1 - y0)) / IH); }
    // the mask covers the WHOLE sheet because alphaMap reads the same UVs as map (pitfall)
    const alpha = tex(cv(512, Math.round((512 * IH) / IW), (c, w, h) => { c.fillStyle = "#000"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff"; c.beginPath(); c.ellipse((ct.cx * w) / IW, (ct.cy * h) / IH, (ct.rx * w) / IW, (ct.ry * h) / IH, rt, 0, TAU); c.fill(); }), false);
    const front = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, alphaMap: alpha, alphaTest: 0.5, roughness: 0.9 }));
    const back = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: sheetColor, alphaMap: alpha, alphaTest: 0.5, roughness: 0.95, side: THREE.BackSide }));
    [front, back].forEach((m) => { m.castShadow = m.receiveShadow = true; m.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaMap: alpha, alphaTest: 0.5 }); });
    const hinge = new THREE.Group(); hinge.add(front, back);
    const hx = refX((x0 + x1) / 2), hz = refZ(y1);
    hinge.position.set(hx, sheet.curl(hx, hz) + 0.006, hz); hinge.rotation.x = -PI / 2;
    scene.add(hinge);
    return { ct, hinge, hW, hx, hz };
  });
  return {
    cards,
    update(t) { cards.forEach((o) => { const t0 = (o.ct.at ?? 0) + (o.ct.d || 0); o.hinge.rotation.x = lerp(-PI / 2, -lean, ease.outBack(prog(t, t0, t0 + 0.6))); }); },
    centerOf(id) { const o = cards.find((c) => c.ct.id === id); return V(o.hx, o.hinge.position.y + (o.hW / 2) * Math.cos(lean), o.hz - (o.hW / 2) * Math.sin(lean)); },
  };
}

/* ---------------------------------------------------------------- overlay */
function leafCanvas(P, role, blur) {
  return cv(256, 256, (c) => {
    if (blur) c.filter = `blur(${blur}px)`;
    c.translate(128, 128); c.rotate(-0.5);
    const g = c.createLinearGradient(-90, 0, 90, 0); g.addColorStop(0, P.hex(role)); g.addColorStop(1, "#8a5a1a");
    c.beginPath(); c.moveTo(-95, 0);
    for (let i = 0; i <= 24; i++) { const u = i / 24, w = Math.sin(u * PI) * 62 * (1 - 0.35 * u) + (i % 2 ? 4 : 0); c.lineTo(-95 + 190 * u, -w); }
    for (let i = 24; i >= 0; i--) { const u = i / 24, w = Math.sin(u * PI) * 62 * (1 - 0.35 * u) + (i % 2 ? 4 : 0); c.lineTo(-95 + 190 * u, w); }
    c.closePath(); c.fillStyle = g; c.fill();
    c.strokeStyle = "rgba(90,55,15,0.55)"; c.lineWidth = 3; c.beginPath(); c.moveTo(-110, 0); c.lineTo(92, 0); c.stroke();
    c.lineWidth = 1.5; for (let i = 1; i < 7; i++) { const x = -80 + i * 24, s = 34 * Math.sin((i / 7) * PI); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 22, -s); c.moveTo(x, 0); c.lineTo(x + 22, s); c.stroke(); }
  });
}
/**
 * Falling leaves in front of a photo (near ones blurred = depth of field). kind: "leaves" | "snow".
 * update(t, visible, avoid) — avoid = { x0, x1 } in -1..1 screen units: no leaf crosses it (keep faces clear).
 */
export function leavesOverlay(scene, P, W, H, { count = 30, kind = "leaves", fov = 40 } = {}) {
  const roles = ["leaf1", "leaf2", "leaf3"], maps = {};
  if (kind === "snow") { maps.s = dotTex(); }
  else roles.forEach((r) => { maps[r] = tex(leafCanvas(P, r, 0)); maps[r + "b"] = tex(leafCanvas(P, r, 7)); });
  const list = [];
  for (let i = 0; i < count; i++) {
    const r = rng(kind, i), z = -r.range(1.6, 11), near = z > -2.6, far = z < -8;
    const map = kind === "snow" ? maps.s : maps[roles[i % 3] + (near ? "b" : "")];
    const m = new THREE.Mesh(new THREE.PlaneGeometry(kind === "snow" ? 0.06 : 0.22, kind === "snow" ? 0.06 : 0.22),
      new THREE.MeshBasicMaterial({ map, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: far ? 0.75 : 1, color: far ? 0xbfb6a8 : 0xffffff }));
    const hh = Math.tan(((fov / 2) * PI) / 180) * -z, hw = hh * (W / H);
    list.push({ m, z, x0: r.range(-hw, hw), hh, hw, sp: r.range(0.12, 0.3) * -z * (kind === "snow" ? 0.12 : 0.25), ph: r() * 10, sw: r.range(0.1, 0.35) * -z * 0.1, rr: r.range(0.6, 1.6), off: r() });
    scene.add(m);
  }
  return {
    update(t, visible = true, avoid = null) {
      list.forEach((L) => {
        L.m.visible = visible && !(avoid && L.x0 / L.hw > avoid.x0 && L.x0 / L.hw < avoid.x1);
        const tt = t + L.off * 40, span = L.hh * 2 + 0.6, y = L.hh + 0.3 - ((tt * L.sp) % span);
        L.m.position.set(L.x0 + Math.sin(tt * 0.9 + L.ph) * L.sw, y, L.z);
        L.m.rotation.set(Math.sin(tt * L.rr + L.ph) * 1.1, Math.cos(tt * L.rr * 0.7) * 1.2, tt * 0.6 + L.ph);
      });
    },
  };
}
/** world point at screen pixel (sx, sy) and depth d in front of a camera at the origin looking down -Z */
export function screenToWorld(sx, sy, d, W, H, fov = 40) {
  const hh = Math.tan(((fov / 2) * PI) / 180) * d, hw = hh * (W / H);
  return V(((sx / W) * 2 - 1) * hw, (1 - (sy / H) * 2) * hh, -d);
}

/* ---------------------------------------------------------------- DOM */
/** Ken Burns on a real photo <img> (width = frame width): set(scale, imageX, imageY) puts that image point at the frame centre */
export function photoLayer(img, W, H) {
  return {
    set(s, cx, cy, sx = W / 2, sy = H / 2) { img.style.transform = `translate(${(sx - cx * s).toFixed(2)}px, ${(sy - cy * s).toFixed(2)}px) scale(${s.toFixed(4)})`; },
  };
}
/** fade an element in (inA..inB) and out (outA..outB) with a small rise */
export function fade(el, t, inA, inB, outA = 1e9, outB = 1e9, dy = 24) {
  const v = prog(t, inA, inB) * (1 - prog(t, outA, outB));
  el.style.opacity = v.toFixed(3);
  el.style.transform = `translateY(${((1 - ease.out(prog(t, inA, inB))) * dy).toFixed(1)}px)`;
  return v;
}
/** subtitles from "voice" / "caption" cues into one element (shown from t to t + dur + hold) */
export function captions(el, events, { hold = 0.35, fadeIn = 0.2, fadeOut = 0.3 } = {}) {
  const lines = events.filter((e) => e.text && (e.type === "voice" || e.type === "caption"));
  return {
    update(t) {
      const cur = lines.find((e) => t >= e.t && t <= e.t + (e.dur || 2) + hold + fadeOut);
      if (!cur) { el.style.opacity = "0"; return; }
      if (el.textContent !== cur.text) el.textContent = cur.text;
      const t1 = cur.t + (cur.dur || 2);
      el.style.opacity = (prog(t, cur.t, cur.t + fadeIn) * (1 - prog(t, t1 + hold, t1 + hold + fadeOut))).toFixed(3);
    },
  };
}
