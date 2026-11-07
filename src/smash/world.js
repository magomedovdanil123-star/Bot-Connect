// «Молот против машин» — залипалка 9:16. Мир, физика и съёмка в браузере (three.js), детерминированно по seed.
// API: window.SMASH.init(cfg) → { simEnd }, .advance(simDt) (фиксированные шаги + интерполяция), .render(cam), .events, .frameAudio()
import * as THREE from 'three';

const R = (seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let rnd = R(7);
const W = 1080, H = 1920, G = -13.5, DT = 1 / 240;
const LANE = 1.95, HZ = -4;                  // полосы x = ±LANE; плоскость качания молота z = HZ
const PIV = new THREE.Vector3(0, 17.2, HZ), LEN = 15.6, AMP = 1.12, PER = 3.0;   // маятник: θ(t) = AMP·sin(2πt/PER)
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

let renderer, scene, cam, hud, hudCam, hudTex, hudCtx, hudMesh;
const S = { t: 0, cars: [], debris: [], sparks: [], puffs: [], events: [], hits: 0, schedule: [], shake: 0, trail: [] };

// ---------- текстуры ----------
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }
const noise = (g, w, h, n, cols, a = 1) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(rnd() * cols.length) | 0]; g.globalAlpha = a * (0.3 + rnd() * .7); const s = 1 + rnd() * 3; g.fillRect(rnd() * w, rnd() * h, s, s); } g.globalAlpha = 1; };

function buildWorld() {
  scene.background = new THREE.Color('#9fc7ea');
  scene.fog = new THREE.Fog('#b9d3ea', 70, 260);
  const hemi = new THREE.HemisphereLight('#e6f3ff', '#5d7d3a', 1.5); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff3df', 2.6); sun.position.set(-30, 60, 25); sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 34, bottom: -34, near: 1, far: 160 }); sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, -6); scene.add(sun, sun.target);
  // небо-купол с градиентом
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: {},
    vertexShader: 'varying vec3 p; void main(){ p = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'varying vec3 p; void main(){ float h = normalize(p).y; vec3 c = mix(vec3(.80,.88,.95), vec3(.38,.62,.92), smoothstep(0.,.45,h)); gl_FragColor = vec4(c,1.); }' }));
  scene.add(sky);
  // трава
  const grass = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#5f8f3a'; g.fillRect(0, 0, w, h); noise(g, w, h, 26000, ['#4f7d2e', '#6fa244', '#7cae4c', '#56862f', '#8bb85a'], .9); noise(g, w, h, 900, ['#c9c35a', '#e8e27a'], .5); }, [90, 90]);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  // обочины-гравий
  const grav = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b9b3a6'; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, ['#8f897d', '#d6d0c2', '#a49d90', '#e8e3d6'], 1); }, [1, 160]);
  for (const sx of [-1, 1]) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 700), new THREE.MeshStandardMaterial({ map: grav, roughness: 1 })); sh.rotation.x = -Math.PI / 2; sh.position.set(sx * 5.25, 0.006, 0); sh.receiveShadow = true; scene.add(sh); }
  // асфальт с разметкой
  const asph = canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#3d3f42'; g.fillRect(0, 0, w, h); noise(g, w, h, 60000, ['#323437', '#47494c', '#2b2d30', '#525458'], 1);
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(20,20,22,.35)'; g.lineWidth = 2 + rnd() * 4; g.beginPath(); const x = rnd() * w, y = rnd() * h; g.moveTo(x, y); g.lineTo(x + (rnd() - .5) * 120, y + rnd() * 200); g.stroke(); }
    g.fillStyle = '#eceae4'; g.fillRect(14, 0, 14, h); g.fillRect(w - 28, 0, 14, h);
    g.fillStyle = '#e8b91c'; g.fillRect(w / 2 - 16, 0, 10, h); g.fillRect(w / 2 + 6, 0, 10, h);
  }, [1, 26]);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(9, 700), new THREE.MeshStandardMaterial({ map: asph, roughness: .92 }));
  road.rotation.x = -Math.PI / 2; road.position.y = 0.012; road.receiveShadow = true; scene.add(road);
  // деревья: ели и лиственные (instanced)
  const N = 520, cone1 = new THREE.ConeGeometry(1, 1, 8), trunk = new THREE.CylinderGeometry(.18, .26, 1, 6), crown = new THREE.IcosahedronGeometry(1, 1);
  const mCone = new THREE.InstancedMesh(cone1, new THREE.MeshStandardMaterial({ color: '#2f5a2c', roughness: .9, flatShading: true }), N * 2);
  const mTrunk = new THREE.InstancedMesh(trunk, new THREE.MeshStandardMaterial({ color: '#5a4030', roughness: 1 }), N);
  const mCrown = new THREE.InstancedMesh(crown, new THREE.MeshStandardMaterial({ color: '#4c7d34', roughness: .9, flatShading: true }), N);
  const M4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color(); let ic = 0, ik = 0;
  for (let i = 0; i < N; i++) {
    const side = rnd() < .5 ? -1 : 1; let x = side * (7.5 + Math.pow(rnd(), 1.6) * 90), z = 40 - rnd() * 300; if (z > -2 && Math.abs(x) < 34) z -= 40; const s = .8 + rnd() * .9, h = 5 + rnd() * 6;
    M4.compose(v3(x, h * .25, z), q, v3(s, h * .5, s)); mTrunk.setMatrixAt(i, M4);
    if (rnd() < .55) { for (let k = 0; k < 2; k++) { M4.compose(v3(x, h * (.45 + k * .28), z), q.setFromAxisAngle(v3(0, 1, 0), rnd() * 6), v3(s * (2.4 - k * .7), h * (.55 - k * .1), s * (2.4 - k * .7))); mCone.setMatrixAt(ic, M4); mCone.setColorAt(ic++, col.set('#2f5a2c').offsetHSL((rnd() - .5) * .03, 0, (rnd() - .5) * .08)); } }
    else { M4.compose(v3(x, h * .62, z), q.setFromAxisAngle(v3(0, 1, 0), rnd() * 6), v3(s * 2.6, h * .42, s * 2.6)); mCrown.setMatrixAt(ik, M4); mCrown.setColorAt(ik++, col.set('#4c7d34').offsetHSL((rnd() - .5) * .05, (rnd() - .5) * .1, (rnd() - .5) * .1)); }
  }
  mCone.count = ic; mCrown.count = ik; for (const m of [mCone, mTrunk, mCrown]) { m.castShadow = true; m.receiveShadow = true; scene.add(m); }
  // холмы вдали
  for (let i = 0; i < 9; i++) { const hll = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshStandardMaterial({ color: new THREE.Color('#5e8c45').offsetHSL(0, 0, (rnd() - .5) * .1), roughness: 1, flatShading: true })); const sx = (i % 2 ? 1 : -1); hll.position.set(sx * (40 + rnd() * 120), -8, -150 - rnd() * 120); hll.scale.set(60 + rnd() * 60, 22 + rnd() * 18, 50 + rnd() * 30); scene.add(hll); }
}

// ---------- молот ----------
let hammer, headMesh, ghosts = [];
function buildHammer() {
  hammer = new THREE.Group(); hammer.position.copy(PIV); scene.add(hammer);
  const wood = canvasTex(64, 512, (g, w, h) => { g.fillStyle = '#9a6a3c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 70; i++) { g.strokeStyle = rnd() < .5 ? 'rgba(90,55,25,.5)' : 'rgba(190,140,90,.35)'; g.lineWidth = 1 + rnd() * 2; g.beginPath(); const x = rnd() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 6, h * .3, x - 6, h * .6, x + 3, h); g.stroke(); } });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.3, .34, LEN, 14), new THREE.MeshStandardMaterial({ map: wood, roughness: .75 }));
  handle.position.y = -LEN / 2; handle.castShadow = true; hammer.add(handle);
  const steel = new THREE.MeshStandardMaterial({ color: '#2b2e33', metalness: .85, roughness: .38 });
  headMesh = new THREE.Group(); headMesh.position.y = -LEN;
  const hb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.75, 1.75), steel); hb.castShadow = true; headMesh.add(hb);
  for (const s of [-1, 1]) { const face = new THREE.Mesh(new THREE.BoxGeometry(.18, 1.95, 1.95), new THREE.MeshStandardMaterial({ color: '#4a4f57', metalness: .9, roughness: .25 })); face.position.x = s * 1.66; face.castShadow = true; headMesh.add(face); }
  const band = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.82, 1.82), new THREE.MeshStandardMaterial({ color: '#16181b', metalness: .6, roughness: .5 })); headMesh.add(band);
  hammer.add(headMesh);
  for (let i = 0; i < 4; i++) { const g = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.75, 1.75), new THREE.MeshBasicMaterial({ color: '#cfd6df', transparent: true, opacity: .1 - i * .02, depthWrite: false })); scene.add(g); ghosts.push(g); }
}
const theta = t => AMP * Math.sin(2 * Math.PI * t / PER);
const omega = t => AMP * (2 * Math.PI / PER) * Math.cos(2 * Math.PI * t / PER);
function headState(t) {   // центр бойка и его скорость (мир)
  const th = theta(t), w = omega(t), c = v3(PIV.x + LEN * Math.sin(th), PIV.y - LEN * Math.cos(th), PIV.z);
  const v = v3(LEN * Math.cos(th) * w, LEN * Math.sin(th) * w, 0), axis = v3(Math.cos(th), Math.sin(th), 0);
  return { c, v, axis, th };
}

// ---------- машины ----------
const TYPES = {
  sedan: { L: 4.5, Wd: 1.9, bh: .78, ch: .62, cl: 2.3, co: -.15, m: 1, wr: .37 },
  hatch: { L: 3.9, Wd: 1.8, bh: .8, ch: .66, cl: 2.0, co: -.35, m: .85, wr: .35 },
  muscle: { L: 4.8, Wd: 2.0, bh: .74, ch: .52, cl: 1.9, co: -.25, m: 1.1, wr: .4, stripes: true },
  police: { L: 4.7, Wd: 1.95, bh: .8, ch: .62, cl: 2.3, co: -.1, m: 1.1, wr: .38, police: true },
  pickup: { L: 5.4, Wd: 2.05, bh: .95, ch: .78, cl: 1.6, co: .9, m: 1.4, wr: .44, bed: true },
  van: { L: 5.1, Wd: 2.05, bh: 1.0, ch: 1.15, cl: 3.9, co: -.4, m: 1.5, wr: .42 },
  bus: { L: 10.5, Wd: 2.55, bh: 1.3, ch: 1.5, cl: 9.6, co: -.2, m: 4.5, wr: .56, bus: true },
};
function dentGeo(w, h, d, sx, sy, sz) { const g = new THREE.BoxGeometry(w, h, d, sx, sy, sz); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i), z = p.getZ(i); const k = 1 - .12 * Math.max(0, y / (h / 2)); p.setX(i, x * k); p.setZ(i, z * (1 - .04 * Math.max(0, y / (h / 2)))); } g.computeVertexNormals(); return g; }
function makeCar(type, color, lane, z0, speed, startT) {
  const T = TYPES[type], g = new THREE.Group(), parts = [];
  const paint = new THREE.MeshStandardMaterial({ color, metalness: .55, roughness: .32 });
  const body = new THREE.Mesh(dentGeo(T.Wd, T.bh, T.L, 10, 3, 16), paint); body.position.y = T.wr + T.bh / 2 - .08; body.castShadow = body.receiveShadow = true; g.add(body); parts.push(body);
  const glass = new THREE.MeshStandardMaterial({ color: '#1d2f45', metalness: .9, roughness: .08, transparent: true, opacity: .92 });
  const cab = new THREE.Mesh(dentGeo(T.Wd * .9, T.ch, T.cl, 8, 3, 10), T.bus || type === 'van' ? glass : glass); cab.position.set(0, body.position.y + T.bh / 2 + T.ch / 2 - .02, T.co); cab.castShadow = true; g.add(cab); parts.push(cab);
  if (T.bus || type === 'van') { const roof = new THREE.Mesh(dentGeo(T.Wd * .92, .22, T.cl * 1.01, 8, 1, 14), paint); roof.position.set(0, cab.position.y + T.ch / 2, T.co); roof.castShadow = true; g.add(roof); parts.push(roof);
    const lower = new THREE.Mesh(dentGeo(T.Wd * .91, T.ch * .45, T.cl * 1.005, 8, 2, 14), paint); lower.position.set(0, cab.position.y - T.ch * .3, T.co); g.add(lower); parts.push(lower); }
  else { const roof = new THREE.Mesh(dentGeo(T.Wd * .8, .08, T.cl * .78, 6, 1, 8), paint); roof.position.set(0, cab.position.y + T.ch / 2, T.co); roof.castShadow = true; g.add(roof); parts.push(roof); }
  if (T.stripes) for (const sx of [-.28, .28]) { const st = new THREE.Mesh(new THREE.BoxGeometry(.28, .02, T.L * 1.002), new THREE.MeshStandardMaterial({ color: '#c0262d', roughness: .4 })); st.position.set(sx, body.position.y + T.bh / 2 + .005, 0); g.add(st); parts.push(st); }
  if (T.police) { const doors = new THREE.Mesh(new THREE.BoxGeometry(T.Wd * 1.004, T.bh * .62, T.L * .42), new THREE.MeshStandardMaterial({ color: '#f2f2f2', metalness: .4, roughness: .35 })); doors.position.set(0, body.position.y + .05, .05); g.add(doors); parts.push(doors);
    for (const [x, c] of [[-.35, '#ff2030'], [.35, '#2060ff']]) { const lb = new THREE.Mesh(new THREE.BoxGeometry(.6, .18, .32), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6 })); lb.position.set(x, cab.position.y + T.ch / 2 + .13, T.co); g.add(lb); parts.push(lb); } }
  if (T.bed) for (const [x, z, w, l] of [[-T.Wd / 2 + .05, -T.L * .3, .1, T.L * .38], [T.Wd / 2 - .05, -T.L * .3, .1, T.L * .38], [0, -T.L / 2 + .05, T.Wd, .1]]) { const wall = new THREE.Mesh(new THREE.BoxGeometry(w, .45, l), paint); wall.position.set(x, body.position.y + T.bh / 2 + .2, z); wall.castShadow = true; g.add(wall); parts.push(wall); }
  for (const s of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(.38, .14, .05), new THREE.MeshStandardMaterial({ color: '#fff8d8', emissive: '#fff3c0', emissiveIntensity: .6 })); hl.position.set(s * T.Wd * .32, body.position.y + .1, T.L / 2 + .01); g.add(hl); const tl = new THREE.Mesh(new THREE.BoxGeometry(.38, .12, .05), new THREE.MeshStandardMaterial({ color: '#c01822', emissive: '#a0101a', emissiveIntensity: .8 })); tl.position.set(s * T.Wd * .32, body.position.y + .12, -T.L / 2 - .01); g.add(tl); }
  const wheels = [], wg = new THREE.CylinderGeometry(T.wr, T.wr, .32, 16), wm = new THREE.MeshStandardMaterial({ color: '#141416', roughness: .85 }), hm = new THREE.MeshStandardMaterial({ color: '#9aa1aa', metalness: .8, roughness: .3 });
  const axles = T.bus ? [T.L / 2 - 1.7, -T.L / 2 + 2.2] : [T.L / 2 - .85, -T.L / 2 + .85];
  for (const z of axles) for (const s of [-1, 1]) { const wh = new THREE.Group(); const tyre = new THREE.Mesh(wg, wm); tyre.rotation.z = Math.PI / 2; tyre.castShadow = true; wh.add(tyre); const hub = new THREE.Mesh(new THREE.CylinderGeometry(T.wr * .55, T.wr * .55, .34, 12), hm); hub.rotation.z = Math.PI / 2; wh.add(hub); wh.position.set(s * (T.Wd / 2 - .12), T.wr, z); g.add(wh); wheels.push(wh); }
  g.position.set(lane, 0, z0); const dir = lane > 0 ? 1 : -1; g.rotation.y = dir > 0 ? 0 : Math.PI; scene.add(g);
  const hy = (T.wr + T.bh + T.ch) / 2, he = v3(T.Wd / 2, hy, T.L / 2);
  const m = T.m, I = v3((m / 12) * ((2 * he.y) ** 2 + (2 * he.z) ** 2), (m / 12) * ((2 * he.x) ** 2 + (2 * he.z) ** 2), (m / 12) * ((2 * he.x) ** 2 + (2 * he.y) ** 2));
  const car = { type, T, g, parts, wheels, glass, dyn: false, dead: false, p: g.position.clone().add(v3(0, hy, 0)), q: g.quaternion.clone(), v: v3(0, 0, dir * speed), w: v3(), he, m, invI: v3(1 / I.x, 1 / I.y, 1 / I.z), offY: hy, start: startT, speed, dir, lastHit: -9, lastBounce: -9, hitCount: 0, scrape: 0, prev: null, wheelRot: 0, shattered: false };
  car.prev = { p: car.p.clone(), q: car.q.clone() }; g.visible = false;
  return car;
}
function syncCar(c, a) { const p = c.prev.p.clone().lerp(c.p, a), q = c.prev.q.clone().slerp(c.q, a); c.g.quaternion.copy(q); c.g.position.copy(p).sub(v3(0, c.offY, 0).applyQuaternion(q)); for (const wh of c.wheels) wh.children[0].rotation.x = c.wheelRot, wh.children[1].rotation.x = c.wheelRot; }

// вмятина: вершины деталей у точки удара проваливаются внутрь
function dent(c, worldP, dirW, depth, rad) {
  c.g.updateMatrixWorld(true);
  for (const m of c.parts) { const inv = new THREE.Matrix4().copy(m.matrixWorld).invert(), lp = worldP.clone().applyMatrix4(inv), ld = dirW.clone().transformDirection(inv).normalize(), pos = m.geometry.attributes.position; let any = false;
    for (let i = 0; i < pos.count; i++) { const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i), d = Math.hypot(vx - lp.x, vy - lp.y, vz - lp.z); if (d < rad) { const k = depth * (1 - d / rad) ** 2 * (.8 + .4 * Math.sin(i * 12.9898)); pos.setXYZ(i, vx + ld.x * k, vy + ld.y * k, vz + ld.z * k); any = true; } }
    if (any) { pos.needsUpdate = true; m.geometry.computeVertexNormals(); } }
}

// ---------- обломки, искры, пыль ----------
let shardMesh, chunkMesh, sparkMesh, puffSprites = [];
const MAXS = 900, MAXK = 260, MAXSP = 400;
function buildFx() {
  const sg = new THREE.TetrahedronGeometry(.11); shardMesh = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: '#bfe4ff', metalness: .9, roughness: .05, transparent: true, opacity: .85 }), MAXS); shardMesh.count = 0; shardMesh.castShadow = false; scene.add(shardMesh);
  const kg = new THREE.BoxGeometry(.32, .06, .22); chunkMesh = new THREE.InstancedMesh(kg, new THREE.MeshStandardMaterial({ metalness: .5, roughness: .45 }), MAXK); chunkMesh.count = 0; chunkMesh.castShadow = true; scene.add(chunkMesh);
  sparkMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(.05, .05, .32), new THREE.MeshBasicMaterial({ color: '#ffcf6a' }), MAXSP); sparkMesh.count = 0; scene.add(sparkMesh);
  const pt = canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(225,215,195,.9)'); gr.addColorStop(1, 'rgba(225,215,195,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  for (let i = 0; i < 60; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pt, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; scene.add(sp); puffSprites.push({ sp, life: 0 }); }
}
function spawnShards(p, v0, n, kind, color) {
  for (let i = 0; i < n; i++) { const d = { kind, p: p.clone().add(v3((rnd() - .5) * 1.4, (rnd() - .2) * 1, (rnd() - .5) * 1.4)), v: v0.clone().multiplyScalar(.4 + rnd() * .7).add(v3((rnd() - .5) * 9, 2 + rnd() * 8, (rnd() - .5) * 9)), r: v3(rnd() * 6, rnd() * 6, rnd() * 6), w: v3((rnd() - .5) * 30, (rnd() - .5) * 30, (rnd() - .5) * 30), s: .6 + rnd() * 1.4, color: color ? new THREE.Color(color) : null, rest: false };
    d.prev = d.p.clone(); S.debris.push(d); }
}
function spawnSparks(p, v0, n) { for (let i = 0; i < n; i++) S.sparks.push({ p: p.clone(), v: v0.clone().multiplyScalar(.2).add(v3((rnd() - .5) * 16, rnd() * 9, (rnd() - .5) * 16)), life: .25 + rnd() * .35 }); }
function spawnPuff(p, big) { for (let k = 0; k < (big ? 6 : 2); k++) { const f = puffSprites.find(x => x.life <= 0); if (!f) return; f.life = 1; f.max = 1.2 + rnd() * 1.4; f.p = p.clone().add(v3((rnd() - .5) * 2, .3, (rnd() - .5) * 2)); f.v = v3((rnd() - .5) * 1.5, .6 + rnd(), (rnd() - .5) * 1.5); f.s0 = big ? 1.6 : .9; f.age = 0; f.sp.visible = true; } }

// ---------- физика ----------
const ev = (kind, data) => S.events.push({ t: +S.t.toFixed(4), kind, ...data });
function carSpheres(c) { const out = [], n = c.T.bus ? 4 : 2, r = Math.min(c.he.x, c.he.y) + .25; for (let i = 0; i <= n; i++) { const z = -c.he.z + r * .8 + (i / n) * (2 * c.he.z - r * 1.6); out.push({ p: v3(0, -.05, z).applyQuaternion(c.q).add(c.p), r }); } return out; }
function applyImpulse(c, at, J) { c.v.addScaledVector(J, 1 / c.m); const r = at.clone().sub(c.p), tq = r.cross(J); c.w.add(worldInvI(c, tq)); }
function worldInvI(c, vec) { const qi = c.q.clone().invert(), l = vec.clone().applyQuaternion(qi); l.set(l.x * c.invI.x, l.y * c.invI.y, l.z * c.invI.z); return l.applyQuaternion(c.q); }
function wake(c) { if (!c.dyn) { c.dyn = true; } }

function hitByHammer(c, hs, sphere) {
  if (S.t - c.lastHit < .7) return;
  c.lastHit = S.t; c.hitCount++; wake(c);
  const n = sphere.p.clone().sub(hs.c).setY(0).normalize(), speed = hs.v.length(), power = Math.min(1.6, speed / 30) * (c.T.bus ? .75 : 1);
  const J = hs.v.clone().multiplyScalar(c.m * (c.T.bus ? .22 : .45)).add(n.clone().multiplyScalar(c.m * 3)).add(v3(0, c.m * (5 + rnd() * 5) * (c.T.bus ? .6 : 1), 0));
  const at = sphere.p.clone().add(v3(0, .35, 0)); applyImpulse(c, at, J);
  c.w.add(v3((rnd() - .5) * 6, (rnd() - .5) * 5, (rnd() - .5) * 6).multiplyScalar(c.T.bus ? .3 : 1));
  dent(c, at, hs.v.clone().normalize(), .55 * power + .2, 1.9);
  const glassBreak = !c.shattered; if (glassBreak) { c.shattered = true; c.glass.color.set('#6f8ea8'); c.glass.opacity = .55; c.glass.roughness = .6; }
  spawnShards(at, hs.v, Math.round(80 * power + 40), 'glass'); spawnShards(at, hs.v, Math.round(14 * power + 6), 'chunk', c.parts[0].material.color.getHexString ? '#' + c.parts[0].material.color.getHexString() : null);
  spawnSparks(at, hs.v, Math.round(40 * power)); spawnPuff(c.p.clone().setY(.4), true);
  if (power > .7 && c.wheels.length && rnd() < .7) { const wh = c.wheels.splice((rnd() * c.wheels.length) | 0, 1)[0]; c.g.remove(wh); spawnShards(at, hs.v, 1, 'wheel'); }
  S.shake = Math.min(1, S.shake + .55 * power);
  if (c.hitCount === 1) S.hits++;
  ev('hit', { car: S.cars.indexOf(c), power: +power.toFixed(3), x: +at.x.toFixed(2), z: +at.z.toFixed(2), y: +at.y.toFixed(2), glass: glassBreak, bus: !!c.T.bus });
}

function stepCar(c) {
  if (S.t < c.start) return;
  if (!c.g.visible) c.g.visible = true;
  c.prev.p.copy(c.p); c.prev.q.copy(c.q);
  if (!c.dyn) { c.p.z += c.v.z * DT; c.wheelRot += c.speed * DT / c.T.wr * c.dir; if (Math.abs(c.p.z) > 140) c.dead = true; return; }
  c.v.y += G * DT; c.p.addScaledVector(c.v, DT);
  const wq = new THREE.Quaternion(c.w.x, c.w.y, c.w.z, 0).multiply(c.q); c.q.x += wq.x * DT * .5; c.q.y += wq.y * DT * .5; c.q.z += wq.z * DT * .5; c.q.w += wq.w * DT * .5; c.q.normalize();
  // контакт с землёй по 8 углам
  let pen = 0, contact = false, scrape = 0;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const r = v3(sx * c.he.x, sy * c.he.y, sz * c.he.z).applyQuaternion(c.q), wp = r.clone().add(c.p);
    if (wp.y >= 0) continue; contact = true; pen = Math.max(pen, -wp.y);
    const vr = c.v.clone().add(c.w.clone().cross(r)), vn = vr.y; if (vn >= 0) continue;
    const rn = r.clone().cross(v3(0, 1, 0)), den = 1 / c.m + v3(0, 1, 0).dot(worldInvI(c, rn).cross(r)), j = -(1 + .28) * vn / den / 4;
    applyImpulse(c, wp, v3(0, j, 0));
    const vt = vr.clone().setY(0), vtl = vt.length(); if (vtl > .01) { const jt = Math.min(.55 * j, vtl * c.m / 4); applyImpulse(c, wp, vt.multiplyScalar(-jt / vtl)); scrape += vtl; }
    if (-vn > 3.2 && S.t - c.lastBounce > .09) { c.lastBounce = S.t; ev('bounce', { car: S.cars.indexOf(c), v: +(-vn).toFixed(2), x: +wp.x.toFixed(2), z: +wp.z.toFixed(2) }); if (-vn > 6) { spawnShards(wp, v3(), 8, 'glass'); spawnSparks(wp, c.v, 10); spawnPuff(wp, false); } }
  }
  if (pen) c.p.y += pen * .8;
  if (contact) { c.w.multiplyScalar(.985); c.v.x *= .996; c.v.z *= .996; }
  c.w.multiplyScalar(.999); c.scrape = scrape;
  if (c.p.length() > 160) c.dead = true;
}

function collideCars() {
  const act = S.cars.filter(c => !c.dead && S.t >= c.start);
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j]; if (!a.dyn && !b.dyn) continue; if (a.p.distanceTo(b.p) > a.he.z + b.he.z + 2) continue;
    for (const sa of carSpheres(a)) for (const sb of carSpheres(b)) { const d = sb.p.clone().sub(sa.p), L = d.length(), ov = sa.r + sb.r - L; if (ov <= 0) continue;
      const n = d.multiplyScalar(1 / (L || 1)), rv = b.v.clone().sub(a.v).dot(n); if (rv > 0) continue;
      wake(a); wake(b); const jn = -(1.3) * rv / (1 / a.m + 1 / b.m), J = n.clone().multiplyScalar(jn), at = sa.p.clone().add(sb.p).multiplyScalar(.5);
      applyImpulse(a, at, J.clone().negate()); applyImpulse(b, at, J); a.p.addScaledVector(n, -ov * .5); b.p.addScaledVector(n, ov * .5);
      if (-rv > 4) { const pw = Math.min(1, -rv / 18); dent(a, at, n, .3 * pw, 1.4); dent(b, at, n.clone().negate(), .3 * pw, 1.4); spawnShards(at, v3(), (20 * pw) | 0, 'glass'); spawnSparks(at, v3(), (16 * pw) | 0); if (S.t - (a.lastCC || -9) > .2) { a.lastCC = S.t; ev('carcar', { power: +pw.toFixed(2), x: +at.x.toFixed(2), z: +at.z.toFixed(2) }); } }
    }
  }
}

function stepDebris() {
  for (const d of S.debris) { if (d.rest) continue; d.prev.copy(d.p); d.v.y += G * DT; d.p.addScaledVector(d.v, DT); d.r.addScaledVector(d.w, DT);
    if (d.p.y < .04) { d.p.y = .04; if (d.v.y < -2.5 && d.kind !== 'glass' && rnd() < .15) ev('tink', { x: +d.p.x.toFixed(1), z: +d.p.z.toFixed(1), kind: d.kind }); d.v.y = -d.v.y * .25; d.v.x *= .7; d.v.z *= .7; d.w.multiplyScalar(.6); if (Math.abs(d.v.y) < .4 && Math.hypot(d.v.x, d.v.z) < .3) d.rest = true; } }
  for (const s of S.sparks) { s.v.y += G * DT; s.p.addScaledVector(s.v, DT); s.life -= DT; if (s.p.y < 0) { s.p.y = 0; s.v.y *= -.3; } }
  S.sparks = S.sparks.filter(s => s.life > 0); if (S.debris.length > 1100) S.debris.splice(0, S.debris.length - 1100);
}

let lastTh = 0;
function step() {
  S.t += DT;
  const hs = headState(S.t);
  if ((lastTh < 0) !== (hs.th < 0)) ev('swing', { dir: hs.th > lastTh ? 1 : -1 });
  if (Math.abs(omega(S.t)) < .06 && Math.abs(omega(S.t - DT)) >= .06) ev('turn', { side: Math.sign(hs.th) });
  lastTh = hs.th;
  for (const c of S.cars) if (!c.dead) stepCar(c);
  collideCars();
  // молот против машин: 3 сферы бойка
  const heads = [-1, 0, 1].map(k => ({ p: hs.c.clone().addScaledVector(hs.axis, k * 1.05), r: .95 }));
  for (const c of S.cars) { if (c.dead || S.t < c.start || c.p.distanceTo(hs.c) > c.he.z + 4) continue;
    for (const s of carSpheres(c)) for (const h of heads) if (s.p.distanceTo(h.p) < s.r + h.r) { hitByHammer(c, hs, s); break; } }
  stepDebris();
  S.shake *= Math.pow(.02, DT);
}

// ---------- расписание машин ----------
function planCars(cfg) {
  const types = ['sedan', 'police', 'muscle', 'hatch', 'pickup', 'sedan', 'van', 'muscle', 'bus', 'hatch', 'police', 'sedan', 'pickup', 'van', 'sedan', 'muscle', 'hatch', 'police'];
  const colors = ['#d83a34', '#141418', '#eeeeee', '#2e7bd6', '#f2b51b', '#3fa05a', '#8a4fd1', '#e0662b', '#f4c20d', '#1fb3a8', '#141418', '#c9ccd2', '#7a1f1f', '#ffffff', '#2a3f88', '#ff8a1e', '#e94b9a', '#141418'];
  let t = 1.2; const plan = cfg.plan || [];
  for (let i = 0; i < types.length; i++) {
    const ty = types[i], lane = i % 2 ? -LANE : LANE, dir = lane > 0 ? 1 : -1, speed = ty === 'bus' ? 9 : 11 + rnd() * 6, T = TYPES[ty];
    // хотим: машина у плоскости молота в момент прохода бойка внизу (удар) или чуть мимо (страшно, но мимо)
    const k = Math.max(1, Math.round((t + .5) / (PER / 2))), tc = k * PER / 2, hit = plan[i] ?? (rnd() < .72);
    const offs = hit ? (rnd() - .5) * .12 : (rnd() < .5 ? -1 : 1) * (T.L / speed / 2 + .35 + rnd() * .2);
    const arrive = tc + offs, z0 = HZ - dir * (speed * (arrive - 0)) ;   // позиция в t=0, если бы ехала с начала
    const start = Math.max(0, arrive - 70 / speed), zs = HZ - dir * speed * (arrive - start);
    const c = makeCar(ty, colors[i], lane, zs, speed, start); c.planned = hit; S.cars.push(c);
    t = arrive + .9 + rnd() * 1.1;
  }
  return t + 3.5;
}

// ---------- камера ----------
const slowCam = v3(0, 0, 0);
const camBase = { p: v3(3.5, 23, 21), look: v3(0, 3.5, -9) };
function placeCamera(vt, simT, slow) {
  if (slow) { const c = S.cars[slow.car], H0 = v3(slow.at.x, .8, slow.at.z), P = c ? H0.clone().lerp(c.g.position.clone().setY(.8), .55) : H0, k = Math.min(1, (simT - slow.t0) / .25);
    const dir = camBase.p.clone().sub(camBase.look).normalize(), far = camBase.p.clone(), near = P.clone().addScaledVector(dir, 23);
    P.x = Math.max(-5, Math.min(5, P.x)); near.x = Math.max(-4, Math.min(4, near.x)) + 2;
    cam.position.copy(far.lerp(near, .35 + .65 * k)); cam.lookAt(P.x, P.y + .6, P.z); cam.fov = 50; }
  else { slowCam.set(0, 0, 0); const k = vt * .12; cam.position.set(camBase.p.x + Math.sin(k) * 1.5, camBase.p.y + Math.sin(k * .7) * .8, camBase.p.z); cam.lookAt(camBase.look.x, camBase.look.y, camBase.look.z); cam.fov = 52; }
  if (S.shake > .01) { cam.position.x += (rnd() - .5) * S.shake * .9; cam.position.y += (rnd() - .5) * S.shake * .6; }
  cam.updateProjectionMatrix();
}

// ---------- HUD ----------
function buildHud() {
  hud = new THREE.Scene(); hudCam = new THREE.OrthographicCamera(0, W, H, 0, -1, 1);
  const c = document.createElement('canvas'); c.width = W; c.height = 420; hudCtx = c.getContext('2d'); hudTex = new THREE.CanvasTexture(c); hudTex.colorSpace = THREE.SRGBColorSpace;
  hudMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, 420), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false })); hudMesh.position.set(W / 2, H - 210, 0); hud.add(hudMesh);
}
let hudKey = '';
function drawHud(vt, slow) {
  const key = S.hits + '|' + (vt < 3) + '|' + !!slow; if (key === hudKey) return; hudKey = key;
  const g = hudCtx; g.clearRect(0, 0, W, 420); g.textAlign = 'center'; g.lineJoin = 'round';
  const txt = (s, x, y, size, col) => { g.font = `900 ${size}px Montserrat`; g.lineWidth = size * .2; g.strokeStyle = '#000'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
  if (vt < 3) txt('КТО ПРОЕДЕТ?', W / 2, 190, 112, '#ffd400');
  else { txt(`РАЗБИТО: ${S.hits}`, W / 2, 170, 84, '#ffffff'); }
  if (slow) txt('ПОВТОР', W / 2, 300, 64, '#ff3b4a');
  hudTex.needsUpdate = true;
}

// ---------- кадр ----------
let alpha = 1;
function syncAll() {
  for (const c of S.cars) if (!c.dead && c.g.visible) syncCar(c, alpha);
  const hs = headState(S.t - (1 - alpha) * DT); hammer.rotation.z = hs.th;
  S.trail.unshift(hs.th); S.trail.length = 12; ghosts.forEach((gm, i) => { const th = S.trail[(i + 1) * 2] ?? hs.th; gm.position.set(PIV.x + LEN * Math.sin(th), PIV.y - LEN * Math.cos(th), PIV.z); gm.rotation.z = th; gm.visible = Math.abs(omega(S.t)) > 1; });
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(); let ns = 0, nk = 0;
  for (const d of S.debris) { const p = d.prev.clone().lerp(d.p, alpha); Q.setFromEuler(E.set(d.r.x, d.r.y, d.r.z));
    if (d.kind === 'glass' && ns < MAXS) { M.compose(p, Q, v3(d.s, d.s, d.s)); shardMesh.setMatrixAt(ns++, M); }
    else if (nk < MAXK) { const sc = d.kind === 'wheel' ? v3(2.4, 9, 3.4) : v3(d.s, d.s, d.s); M.compose(p, Q, sc); chunkMesh.setMatrixAt(nk, M); chunkMesh.setColorAt(nk++, d.kind === 'wheel' ? new THREE.Color('#141416') : (d.color || new THREE.Color('#888'))); } }
  shardMesh.count = ns; chunkMesh.count = nk; shardMesh.instanceMatrix.needsUpdate = true; chunkMesh.instanceMatrix.needsUpdate = true; if (chunkMesh.instanceColor) chunkMesh.instanceColor.needsUpdate = true;
  let nsp = 0; for (const s of S.sparks) { if (nsp >= MAXSP) break; M.lookAt(s.p, s.p.clone().add(s.v), v3(0, 1, 0)); M.setPosition(s.p); sparkMesh.setMatrixAt(nsp++, M); } sparkMesh.count = nsp; sparkMesh.instanceMatrix.needsUpdate = true;
}
function stepPuffs(dt) { for (const f of puffSprites) { if (f.life <= 0) continue; f.age += dt; const k = f.age / f.max; if (k >= 1) { f.life = 0; f.sp.visible = false; continue; } f.p.addScaledVector(f.v, dt); f.sp.position.copy(f.p); const s = f.s0 * (1 + k * 3.5); f.sp.scale.set(s, s, s); f.sp.material.opacity = .55 * (1 - k); } }

window.SMASH = {
  init(cfg = {}) {
    rnd = R(cfg.seed || 7);
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(52, W / H, .1, 900);
    buildWorld(); buildHammer(); buildFx(); buildHud();
    rnd = R((cfg.seed || 7) * 31 + 5);
    const end = planCars(cfg); return { simEnd: end, cars: S.cars.length };
  },
  // продвинуть симуляцию на simDt (фиксированный шаг DT + интерполяция)
  advance(simDt) { S.acc = (S.acc || 0) + simDt; while (S.acc >= DT) { step(); S.acc -= DT; } alpha = S.acc / DT; return S.t; },
  fastForward(t) { while (S.t < t) step(); },
  render(vt, slow, dtv) { stepPuffs(dtv * (slow ? .3 : 1)); syncAll(); placeCamera(vt, S.t, slow); drawHud(vt, slow); renderer.clear(); renderer.render(scene, cam); renderer.clearDepth(); renderer.render(hud, hudCam); },
  // звук на кадр: моторы (дистанция и радиальная скорость к камере), скрежет
  frameAudio() {
    const out = [];
    for (const [i, c] of S.cars.entries()) { if (c.dead || S.t < c.start) continue; const d = c.p.clone().sub(cam.position), dist = d.length(), vr = c.v.dot(d) / (dist || 1);
      out.push({ i, dist: +dist.toFixed(2), vr: +vr.toFixed(2), x: +(c.p.x - cam.position.x).toFixed(2), dyn: c.dyn, scrape: +c.scrape.toFixed(2), bus: !!c.T.bus }); }
    return { cars: out, th: +headState(S.t).th.toFixed(3), om: +omega(S.t).toFixed(3) };
  },
  get events() { return S.events; }, get t() { return S.t; }, get hits() { return S.hits; },
  hitPoint(i) { const c = S.cars[i]; return c ? { x: c.p.x, z: c.p.z } : null; },
};
