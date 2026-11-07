// Общее для «цеховых» сцен CRUSH MOTION (пресс, шредер): цех, модели машин, деформация, обломки, HUD.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

export const W = 1080, H = 1920;
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const R = (seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
export function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }
export const noise = (rnd, g, w, h, n, cols, a = 1) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(rnd() * cols.length) | 0]; g.globalAlpha = a * (0.3 + rnd() * .7); const s = 1 + rnd() * 3; g.fillRect(rnd() * w, rnd() * h, s, s); } g.globalAlpha = 1; };
export const hazard = (g, x, y, w, h, s = 40) => { g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.fillStyle = '#f2c230'; g.fillRect(x, y, w, h); g.fillStyle = '#16161a'; for (let k = -h; k < w + h; k += s * 2) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + s, y + h); g.lineTo(x + k + s + h, y); g.lineTo(x + k + h, y); g.closePath(); g.fill(); } g.restore(); };

// ---------- цех: бетонный пол, стены, лампы под потолком ----------
export function buildHall(scene, renderer, rnd, o = {}) {
  scene.background = new THREE.Color('#0e1014'); scene.fog = new THREE.Fog('#0e1014', 28, 70);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  scene.add(new THREE.HemisphereLight('#cfd8e6', '#2a2620', .55));
  const key = new THREE.DirectionalLight('#fff1dc', 2.2); key.position.set(-9, 22, 14); key.castShadow = true; Object.assign(key.shadow.camera, { left: -16, right: 16, top: 18, bottom: -18, near: 1, far: 70 }); key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -.0004; key.shadow.normalBias = .02; key.target.position.set(0, 0, 0); scene.add(key, key.target);
  const rim = new THREE.PointLight('#9fc4ff', 30, 30, 1.6); rim.position.set(8, 9, -10); scene.add(rim);
  const concrete = canvasTex(1024, 1024, (g, w, h) => { g.fillStyle = '#6e6c68'; g.fillRect(0, 0, w, h); noise(rnd, g, w, h, 70000, ['#5f5d59', '#7a7873', '#66645f', '#85827c', '#55534f'], .8);
    for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(30,28,26,${.08 + rnd() * .15})`; g.lineWidth = 1 + rnd() * 3; g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - .5) * 120; y += (rnd() - .5) * 120; g.lineTo(x, y); } g.stroke(); }
    g.strokeStyle = 'rgba(25,25,25,.5)'; g.lineWidth = 3; for (let k = 0; k <= 4; k++) { g.beginPath(); g.moveTo(k * w / 4, 0); g.lineTo(k * w / 4, h); g.stroke(); g.beginPath(); g.moveTo(0, k * h / 4); g.lineTo(w, k * h / 4); g.stroke(); } }, [12, 12]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshStandardMaterial({ map: concrete, roughness: .85, envMapIntensity: .2 })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallTex = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#2b2f36'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { g.fillStyle = x % 64 ? '#272a31' : '#30343c'; g.fillRect(x, 0, 30, h); } }, [12, 2]);
  const wm = new THREE.MeshStandardMaterial({ map: wallTex, roughness: .7, metalness: .4 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(80, 22), wm); back.position.set(0, 11, -34); scene.add(back);
  for (const s of [-1, 1]) { const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 22), wm); wall.position.set(s * 24, 11, -4); wall.rotation.y = -s * Math.PI / 2; scene.add(wall); }
  for (let i = 0; i < 6; i++) { const lamp = new THREE.Mesh(new THREE.BoxGeometry(3, .2, .6), new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#fff1d0', emissiveIntensity: 2.5 })); lamp.position.set((i % 2 ? -1 : 1) * 7, 18, -26 + Math.floor(i / 2) * 12); scene.add(lamp); }
  const stripe = canvasTex(1024, 64, (g, w, h) => hazard(g, 0, 0, w, h, 32));
  return { stripe };
}

// ---------- машины (как на трассе, но без физики) ----------
export const TYPES = {
  sedan: { L: 4.5, Wd: 1.9, bh: .78, ch: .62, cl: 2.3, co: -.15, wr: .37 },
  hatch: { L: 3.9, Wd: 1.8, bh: .8, ch: .66, cl: 2.0, co: -.35, wr: .35 },
  muscle: { L: 4.8, Wd: 2.0, bh: .74, ch: .52, cl: 1.9, co: -.25, wr: .4, stripes: true },
  police: { L: 4.7, Wd: 1.95, bh: .8, ch: .62, cl: 2.3, co: -.1, wr: .38, police: true },
  pickup: { L: 5.4, Wd: 2.05, bh: .95, ch: .78, cl: 1.6, co: .9, wr: .44, bed: true },
  van: { L: 5.1, Wd: 2.05, bh: 1.0, ch: 1.15, cl: 3.9, co: -.4, wr: .42 },
  bus: { L: 10.5, Wd: 2.55, bh: 1.3, ch: 1.5, cl: 9.6, co: -.2, wr: .56, bus: true },
};
function boxGeo(w, h, d, sx, sy, sz) { const g = new THREE.BoxGeometry(w, h, d, sx, sy, sz); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i); const k = 1 - .12 * Math.max(0, y / (h / 2)); p.setX(i, x * k); p.setZ(i, z * (1 - .04 * Math.max(0, y / (h / 2)))); } g.computeVertexNormals(); return g; }
// машина носом к +z, колёса на y=0; parts — деформируемые детали (кузов, кабина, крыша…)
export function carMesh(type, color) {
  const T = TYPES[type], g = new THREE.Group(), parts = [];
  const paint = new THREE.MeshStandardMaterial({ color, metalness: .55, roughness: .32 });
  const body = new THREE.Mesh(boxGeo(T.Wd, T.bh, T.L, 12, 4, 24), paint); body.position.y = T.wr + T.bh / 2 - .08; g.add(body); parts.push(body);
  const glass = new THREE.MeshStandardMaterial({ color: '#1d2f45', metalness: .9, roughness: .08, transparent: true, opacity: .92 });
  const cab = new THREE.Mesh(boxGeo(T.Wd * .9, T.ch, T.cl, 10, 4, 16), glass); cab.position.set(0, body.position.y + T.bh / 2 + T.ch / 2 - .02, T.co); g.add(cab); parts.push(cab);
  if (T.bus || type === 'van') { const roof = new THREE.Mesh(boxGeo(T.Wd * .92, .22, T.cl * 1.01, 10, 1, 18), paint); roof.position.set(0, cab.position.y + T.ch / 2, T.co); g.add(roof); parts.push(roof);
    const lower = new THREE.Mesh(boxGeo(T.Wd * .91, T.ch * .45, T.cl * 1.005, 10, 2, 18), paint); lower.position.set(0, cab.position.y - T.ch * .3, T.co); g.add(lower); parts.push(lower); }
  else { const roof = new THREE.Mesh(boxGeo(T.Wd * .8, .08, T.cl * .78, 8, 1, 10), paint); roof.position.set(0, cab.position.y + T.ch / 2, T.co); g.add(roof); parts.push(roof); }
  if (T.stripes) for (const sx of [-.28, .28]) { const st = new THREE.Mesh(boxGeo(.28, .02, T.L * 1.002, 2, 1, 20), new THREE.MeshStandardMaterial({ color: '#c0262d', roughness: .4 })); st.position.set(sx, body.position.y + T.bh / 2 + .005, 0); g.add(st); parts.push(st); }
  if (T.police) { const doors = new THREE.Mesh(boxGeo(T.Wd * 1.004, T.bh * .62, T.L * .42, 8, 3, 8), new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: .4, roughness: .35 })); doors.position.set(0, body.position.y + .05, .05); g.add(doors); parts.push(doors); }
  if (T.bed) for (const [x, z, w, l] of [[-T.Wd / 2 + .05, -T.L * .3, .1, T.L * .38], [T.Wd / 2 - .05, -T.L * .3, .1, T.L * .38], [0, -T.L / 2 + .05, T.Wd, .1]]) { const wall = new THREE.Mesh(boxGeo(w, .45, l, 2, 2, 8), paint); wall.position.set(x, body.position.y + T.bh / 2 + .2, z); g.add(wall); parts.push(wall); }
  for (const s of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(.38, .14, .05), new THREE.MeshStandardMaterial({ color: '#fff8d8', emissive: '#fff3c0', emissiveIntensity: .6 })); hl.position.set(s * T.Wd * .32, body.position.y + .1, T.L / 2 + .01); g.add(hl); parts.push(hl); const tl = new THREE.Mesh(new THREE.BoxGeometry(.38, .12, .05), new THREE.MeshStandardMaterial({ color: '#c01822', emissive: '#a0101a', emissiveIntensity: .8 })); tl.position.set(s * T.Wd * .32, body.position.y + .12, -T.L / 2 - .01); g.add(tl); parts.push(tl); }
  const wheels = [], wg = new THREE.CylinderGeometry(T.wr, T.wr, .32, 18), wm = new THREE.MeshStandardMaterial({ color: '#141416', roughness: .85 }), hm = new THREE.MeshStandardMaterial({ color: '#9aa1aa', metalness: .8, roughness: .3 });
  const axles = T.bus ? [T.L / 2 - 1.7, -T.L / 2 + 2.2] : [T.L / 2 - .85, -T.L / 2 + .85];
  for (const z of axles) for (const s of [-1, 1]) { const wh = new THREE.Group(); const tyre = new THREE.Mesh(wg, wm); tyre.rotation.z = Math.PI / 2; tyre.castShadow = true; wh.add(tyre); const hub = new THREE.Mesh(new THREE.CylinderGeometry(T.wr * .55, T.wr * .55, .34, 12), hm); hub.rotation.z = Math.PI / 2; wh.add(hub); wh.position.set(s * (T.Wd / 2 - .12), T.wr, z); wh.userData.side = s; g.add(wh); wheels.push(wh); }
  g.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const top = (T.bus || type === 'van' ? T.wr + T.bh - .08 + T.ch + .22 : T.wr + T.bh - .08 + T.ch + .06);
  return { g, parts, glass, wheels, T, type, top, paint };
}
// снимок исходных вершин деталей в системе машины — для деформации «как пластилин»
export function snapCar(car) {
  car.g.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(car.g.matrixWorld).invert();
  car.snap = car.parts.map(m => { const toCar = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld), fromCar = new THREE.Matrix4().copy(toCar).invert(), pos = m.geometry.attributes.position, a = new Float32Array(pos.count * 3), v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(toCar); a[i * 3] = v.x; a[i * 3 + 1] = v.y; a[i * 3 + 2] = v.z; } return { m, a, fromCar }; });
}
// f(x, y, z) → [x, y, z] в системе машины (масштаб группы учитывать снаружи)
export function deformCar(car, f) {
  const v = new THREE.Vector3();
  for (const { m, a, fromCar } of car.snap) { const pos = m.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { const [x, y, z] = f(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]); v.set(x, y, z).applyMatrix4(fromCar); pos.setXYZ(i, v.x, v.y, v.z); }
    pos.needsUpdate = true; m.geometry.computeVertexNormals(); }
}
export const hash = (x, y, z) => { const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return s - Math.floor(s); };

// ---------- обломки: стекло, куски краски/металла, искры, пыль, колёса ----------
export class Fx {
  constructor(scene, rnd, ev) {
    this.rnd = rnd; this.ev = ev; this.list = []; this.sparks = []; this.puffs = [];
    const gm = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: .35, metalness: .5 });
    this.shard = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), new THREE.MeshStandardMaterial({ color: '#cfe8ff', metalness: .9, roughness: .05, transparent: true, opacity: .85 }), 4000);
    this.chunk = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .2, .7), gm, 3000);
    this.spark = new THREE.InstancedMesh(new THREE.BoxGeometry(.04, .04, .3), new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), 1500);
    const wg = new THREE.CylinderGeometry(1, 1, .32, 16); wg.rotateZ(Math.PI / 2); this.wheel = new THREE.InstancedMesh(wg, new THREE.MeshStandardMaterial({ color: '#141416', roughness: .85 }), 40);
    for (const m of [this.shard, this.chunk, this.spark, this.wheel]) { m.count = 0; m.frustumCulled = false; m.castShadow = m !== this.spark; scene.add(m); }
    const pt = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(200,195,185,.85)'); gr.addColorStop(1, 'rgba(200,195,185,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    for (let i = 0; i < 70; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pt, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; scene.add(sp); this.puffs.push({ sp, life: 0 }); }
  }
  add(kind, p, v, o = {}) { const r = this.rnd; this.list.push({ kind, p: p.clone(), v: v.clone(), r: v3(r() * 6, r() * 6, r() * 6), w: v3((r() - .5) * 30, (r() - .5) * 30, (r() - .5) * 30), s: o.s || (.6 + r() * 1.2), col: o.col ? new THREE.Color(o.col) : null, rest: false }); }
  burst(kind, p, n, spd, up, o = {}) { const r = this.rnd; for (let i = 0; i < n; i++) this.add(kind, p.clone().add(v3((r() - .5) * (o.spread || 1), (r() - .5) * .4, (r() - .5) * (o.spread || 1))), v3((r() - .5) * spd, up * (.4 + r()), (r() - .5) * spd).add(o.v || v3()), o); }
  sparksAt(p, n, spd = 10) { const r = this.rnd; for (let i = 0; i < n; i++) this.sparks.push({ p: p.clone(), v: v3((r() - .5) * spd, r() * spd * .7, (r() - .5) * spd), life: .2 + r() * .35 }); }
  puff(p, s0 = 1.2) { const r = this.rnd; for (let k = 0; k < 3; k++) { const f = this.puffs.find(x => x.life <= 0); if (!f) return; f.life = 1; f.max = 1.4 + r() * 1.4; f.p = p.clone().add(v3((r() - .5) * 2, .2, (r() - .5) * 2)); f.v = v3((r() - .5) * 1.4, .5 + r(), (r() - .5) * 1.4); f.s0 = s0; f.age = 0; f.sp.visible = true; } }
  step(dt, t, floorY = 0, extra = null) {
    const r = this.rnd;
    for (const d of this.list) { if (d.rest) continue; d.v.y -= 13 * dt; d.p.addScaledVector(d.v, dt); d.r.addScaledVector(d.w, dt);
      if (extra) extra(d);
      const fy = (typeof floorY === 'function' ? floorY(d.p) : floorY) + (d.kind === 'wheel' ? d.s * .3 : .03); if (d.p.y < fy) { d.p.y = fy; if (d.v.y < -3 && r() < (d.kind === 'shard' ? .05 : .2)) this.ev('tink', { x: +d.p.x.toFixed(1), z: +d.p.z.toFixed(1), mat: d.kind, v: +(-d.v.y).toFixed(1) }); d.v.y = -d.v.y * (d.kind === 'wheel' ? .45 : .25); d.v.x *= .7; d.v.z *= .7; d.w.multiplyScalar(.6); if (Math.abs(d.v.y) < .5 && Math.hypot(d.v.x, d.v.z) < .3) d.rest = true; } }
    for (const s of this.sparks) { s.v.y -= 13 * dt; s.p.addScaledVector(s.v, dt); s.life -= dt; const fy = typeof floorY === 'function' ? floorY(s.p) : floorY; if (s.p.y < fy) { s.p.y = fy; s.v.y *= -.3; } }
    this.sparks = this.sparks.filter(s => s.life > 0); if (this.list.length > 6000) this.list.splice(0, this.list.length - 6000);
    for (const f of this.puffs) { if (f.life <= 0) continue; f.age += dt; const k = f.age / f.max; if (k >= 1) { f.life = 0; f.sp.visible = false; continue; } f.p.addScaledVector(f.v, dt); f.sp.position.copy(f.p); const s = f.s0 * (1 + k * 3); f.sp.scale.set(s, s, s); f.sp.material.opacity = .45 * (1 - k); }
  }
  clear() { this.list = []; this.sparks = []; }
  sync() {
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(); let a = 0, b = 0, c = 0, w = 0;
    for (const d of this.list) { Q.setFromEuler(E.set(d.r.x, d.r.y, d.r.z));
      if (d.kind === 'shard' && a < 4000) { M.compose(d.p, Q, v3(.09 * d.s, .02 * d.s, .12 * d.s)); this.shard.setMatrixAt(a++, M); }
      else if (d.kind === 'wheel' && w < 40) { M.compose(d.p, Q, v3(d.s, d.s, d.s)); this.wheel.setMatrixAt(w++, M); }
      else if (d.kind === 'chunk' && b < 3000) { M.compose(d.p, Q, v3(.28 * d.s, .28 * d.s, .28 * d.s)); this.chunk.setMatrixAt(b, M); this.chunk.setColorAt(b++, d.col || new THREE.Color('#777')); } }
    for (const s of this.sparks) { if (c >= 1500) break; M.lookAt(s.p, s.p.clone().add(s.v), v3(0, 1, 0)); M.setPosition(s.p); this.spark.setMatrixAt(c++, M); }
    for (const [m, n] of [[this.shard, a], [this.chunk, b], [this.spark, c], [this.wheel, w]]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
}

// ---------- HUD на весь экран ----------
export class Hud {
  constructor() {
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(0, W, H, 0, -1, 1);
    const c = document.createElement('canvas'); c.width = W; c.height = H; this.g = c.getContext('2d'); this.tex = new THREE.CanvasTexture(c); this.tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest: false })); m.position.set(W / 2, H / 2, 0); this.scene.add(m); this.key = '';
  }
  txt(s, x, y, size, col) { const g = this.g; g.textAlign = 'center'; g.lineJoin = 'round'; g.font = `900 ${size}px Montserrat`; const sz = Math.min(size, Math.floor(size * 980 / g.measureText(s).width)); g.font = `900 ${sz}px Montserrat`; g.lineWidth = sz * .2; g.strokeStyle = '#000'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); }
  begin(key) { if (key === this.key) return false; this.key = key; this.g.clearRect(0, 0, W, H); return true; }
  end() { this.tex.needsUpdate = true; }
}
