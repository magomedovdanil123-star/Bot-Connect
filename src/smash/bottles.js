// «Шар для боулинга против стеклянных бутылок» — залипалка 9:16. Физика — cannon-es, картинка — three.js, всё детерминированно по seed.
// Три раунда по нарастающей (10 → 28 → 105 бутылок), у каждого — замедленный повтор удара. API как у world.js: window.SMASH
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';
import { drawCta, CTA_LEN, CTA_TAP } from './hudcta.js';

const R = (seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
let rnd = R(7);
const W = 1080, H = 1920, DT = 1 / 240, BH = .30, BR = .036, BALL_R = .109;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ROUNDS = [{ n: 10, rows: 4, sp: .15, len: 5.0 }, { n: 28, rows: 7, sp: .12, len: 5.4 }, { n: 105, rows: 14, sp: .1, len: 6.6 }];
const BANNER = 1.3, LAUNCH = .35, SPEED = 8.2, Z0 = 6.5, SUMMARY = 1.9, OUTRO = SUMMARY + CTA_LEN;

let renderer, scene, cam, world, hud, hudCam, hudTex, hudCtx;
let mLane, mGlass, mBall, ballBody, ballMesh, glassMats = {}, bottleGeo, labelGeo, capGeo;
const S = { t: 0, round: -1, roundT0: 0, bottles: [], debris: [], puffs: [], events: [], broken: 0, roundBroken: 0, shake: 0, impact: null, impacts: [], strike: -9, plan: [], queue: new Set(), acc: 0 };
const ev = (kind, d = {}) => S.events.push({ t: +S.t.toFixed(4), kind, ...d });

function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }

// ---------- зал: тёмная дорожка из клёна, неон по бокам, свет над пирамидой ----------
const STYLES = {
  neon: { bg: '#0b0d16', l1: '#ff2bd6', l2: '#21e6ff', wood: ['#d9b27c', '#cfa56d', '#e1bd88', '#c99c63'], spot: '#fff4e6', ball: ['#1b1b2e', '#7a2cff', '#ff3bd0'] },
  classic: { bg: '#120d0a', l1: '#ffb347', l2: '#ffb347', wood: ['#d8ad74', '#c79b60', '#e2bb84', '#b98a52'], spot: '#ffe8c8', ball: ['#0d0d10', '#3a3a44', '#8c8c99'] },
  ice: { bg: '#0a1218', l1: '#7fe8ff', l2: '#ffffff', wood: ['#e6d3b6', '#dcc6a4', '#efe0c8', '#d2b996'], spot: '#eef6ff', ball: ['#0e2a4a', '#2f7fd6', '#bfe8ff'] },
  fire: { bg: '#140a08', l1: '#ff4b1f', l2: '#ffb21f', wood: ['#c99a62', '#bb8b54', '#d6a970', '#a87a46'], spot: '#ffe0c0', ball: ['#3a0606', '#d62a14', '#ffb21f'] },
};
let ST = STYLES.neon;
function buildHall() {
  scene.background = new THREE.Color(ST.bg); scene.fog = new THREE.Fog(ST.bg, 7, 24);
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), .04).texture;
  scene.add(new THREE.HemisphereLight('#c9d6ff', '#20140c', .22));
  const spot = new THREE.SpotLight(ST.spot, 21, 11, .3, .6, 1.3); spot.position.set(.5, 3.6, -4.2); spot.target.position.set(0, 0, -.4); spot.castShadow = true; spot.shadow.mapSize.set(2048, 2048); spot.shadow.bias = -.0003; spot.shadow.normalBias = .01; scene.add(spot, spot.target);
  const fill = new THREE.PointLight('#bcd0ff', 1.6, 6, 1.6); fill.position.set(-.8, 2.2, -2.6); scene.add(fill);
  const far = new THREE.PointLight('#ffd9a8', 4, 7, 1.6); far.position.set(0, 1.6, 6.5); scene.add(far);
  const wood = canvasTex(1024, 2048, (g, w, h) => {
    const n = 32, bw = w / n; for (let i = 0; i < n; i++) { g.fillStyle = ST.wood[(i * 7 + (rnd() * 2 | 0)) % ST.wood.length]; g.fillRect(i * bw, 0, bw, h);
      for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(110,70,30,${.05 + rnd() * .1})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); const x = i * bw + rnd() * bw; g.moveTo(x, 0); g.bezierCurveTo(x + 4, h * .3, x - 4, h * .7, x + 2, h); g.stroke(); }
      g.fillStyle = 'rgba(60,35,15,.55)'; g.fillRect(i * bw, 0, 1.5, h); }
    g.fillStyle = 'rgba(40,24,10,.7)'; for (let i = 0; i < 7; i++) { const x = w * (.2 + i * .1), y = h * .35; g.beginPath(); g.moveTo(x, y - 60); g.lineTo(x - 14, y + 20); g.lineTo(x + 14, y + 20); g.closePath(); g.fill(); }
  }, [1, 3]);
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 30), new THREE.MeshStandardMaterial({ map: wood, color: '#927a64', roughness: .45, metalness: 0, envMapIntensity: .04 }));
  lane.rotation.x = -Math.PI / 2; lane.position.z = 6; lane.receiveShadow = true; scene.add(lane);
  const dark = new THREE.MeshStandardMaterial({ color: '#15151c', roughness: .6, metalness: .3 });
  for (const s of [-1, 1]) {
    const gut = new THREE.Mesh(new THREE.BoxGeometry(.32, .06, 30), dark); gut.position.set(s * 1.46, -.02, 6); gut.receiveShadow = true; scene.add(gut);
    const neon = new THREE.Mesh(new THREE.BoxGeometry(.035, .035, 30), new THREE.MeshStandardMaterial({ color: s < 0 ? ST.l1 : ST.l2, emissive: s < 0 ? ST.l1 : ST.l2, emissiveIntensity: 3.2 })); neon.position.set(s * 1.64, .03, 6); scene.add(neon);
    const glow = new THREE.PointLight(s < 0 ? ST.l1 : ST.l2, 2.2, 3.5, 1.8); glow.position.set(s * 1.55, .25, -1); scene.add(glow);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(.1, 2.2, 30), new THREE.MeshStandardMaterial({ color: '#101018', roughness: .8 })); wall.position.set(s * 1.9, 1.1, 6); scene.add(wall);
    for (let i = 0; i < 9; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(.03, .5, .03), new THREE.MeshStandardMaterial({ color: ST.l1, emissive: i % 2 ? ST.l1 : ST.l2, emissiveIntensity: 2 })); st.position.set(s * 1.84, .9, -2 + i * 2.2); scene.add(st); }
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshStandardMaterial({ color: '#0f0f16', roughness: .9 })); back.position.set(0, 1.4, 20); back.rotation.y = Math.PI; scene.add(back);
}

// ---------- бутылки ----------
const COLS = { green: { c: '#2f9a55', o: .62 }, amber: { c: '#a8621f', o: .78 }, clear: { c: '#d5ecf2', o: .34 }, blue: { c: '#2f74c0', o: .6 } };
function buildAssets() {
  const pts = [[0, 0], [.033, 0], [.036, .006], [.036, .18], [.034, .2], [.026, .225], [.017, .245], [.0135, .26], [.0135, .284], [.0158, .287], [.0158, .296], [.012, .3], [0, .3]].map(([x, y]) => new THREE.Vector2(x, y - BH / 2));
  bottleGeo = new THREE.LatheGeometry(pts, 22);
  labelGeo = new THREE.CylinderGeometry(.0366, .0366, .075, 22, 1, true); capGeo = new THREE.CylinderGeometry(.016, .016, .009, 14);
  for (const [k, c] of Object.entries(COLS)) glassMats[k] = new THREE.MeshPhysicalMaterial({ color: c.c, transparent: true, opacity: c.o, roughness: .04, metalness: 0, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 2.4, depthWrite: false });
}
function makeBottle(x, z, col, labelCol) {
  const g = new THREE.Group(), body = new THREE.Mesh(bottleGeo, glassMats[col]); body.castShadow = true; g.add(body);
  if (labelCol) { const lb = new THREE.Mesh(labelGeo, new THREE.MeshStandardMaterial({ color: labelCol, roughness: .55 })); lb.position.y = -.025; g.add(lb); }
  const cap = new THREE.Mesh(capGeo, new THREE.MeshStandardMaterial({ color: rnd() < .5 ? '#d9b54a' : '#c8ccd2', metalness: .9, roughness: .3 })); cap.position.y = BH / 2 - .002; g.add(cap);
  scene.add(g);
  const b = new CANNON.Body({ mass: .38, material: mGlass, shape: new CANNON.Box(new CANNON.Vec3(.033, BH / 2, .033)), position: new CANNON.Vec3(x, BH / 2 + .0005, z), allowSleep: true, sleepSpeedLimit: .05, sleepTimeLimit: .3 });
  b.angularDamping = .05; world.addBody(b);
  const bt = { b, g, col, alive: true, lastClink: -9, lastThunk: -9, id: S.bottles.length };
  b.addEventListener('collide', e => onCollide(bt, e)); S.bottles.push(bt); g.position.set(x, BH / 2, z); return bt;
}
function onCollide(bt, e) {
  if (!bt.alive || S.queue.has(bt)) return;
  const other = e.body, v = Math.abs(e.contact.getImpactVelocityAlongNormal());
  const p = bt.b.position;
  if (other === ballBody) {
    if (!S.impact) { S.impact = { t: S.t, x: p.x, z: p.z, power: v }; S.impacts.push({ ...S.impact, round: S.round }); ev('impact', { x: +p.x.toFixed(2), z: +p.z.toFixed(2), power: +v.toFixed(2) }); S.shake = Math.min(1, S.shake + .7); }
    if (v > .55 && (v > 3.5 || rnd() < .7)) return breakIt(bt, v, 'ball', other.velocity);
    return;
  }
  const ob = S.bottles.find(o => o.b === other);
  if (ob) {   // бутылка о бутылку
    if (v > 1.5 && rnd() < .72) return breakIt(bt, v * .8, 'bottle', other.velocity);
    if (v > .35 && S.t - bt.lastClink > .12 && bt.id < ob.id) { bt.lastClink = S.t; ev('clink', { x: +p.x.toFixed(2), z: +p.z.toFixed(2), v: +v.toFixed(2) }); }
    return;
  }
  // об пол
  if (v > 2.1 && rnd() < .62) return breakIt(bt, v * .7, 'floor', null);
  if (v > .5 && S.t - bt.lastThunk > .15) { bt.lastThunk = S.t; ev('thunk', { x: +p.x.toFixed(2), z: +p.z.toFixed(2), v: +v.toFixed(2) }); }
}
function breakIt(bt, power, by, push) { bt.pending = { power: Math.min(2, power / 4), by, push: push ? new THREE.Vector3(push.x, push.y, push.z) : null }; S.queue.add(bt); }
function doBreaks() {
  for (const bt of S.queue) {
    if (!bt.alive) continue; bt.alive = false; world.removeBody(bt.b); scene.remove(bt.g);
    const { power, by, push } = bt.pending, p = v3(bt.b.position.x, bt.b.position.y, bt.b.position.z), q = new THREE.Quaternion(bt.b.quaternion.x, bt.b.quaternion.y, bt.b.quaternion.z, bt.b.quaternion.w), vb = v3(bt.b.velocity.x, bt.b.velocity.y, bt.b.velocity.z);
    const col = new THREE.Color(COLS[bt.col].c), n = Math.round(55 + 45 * Math.min(1, power));
    for (let i = 0; i < n; i++) {
      const ly = (rnd() - .5) * BH, rr = ly > .08 ? .015 : BR, ang = rnd() * Math.PI * 2, loc = v3(Math.cos(ang) * rr, ly, Math.sin(ang) * rr).applyQuaternion(q);
      const out = loc.clone().setY(0).normalize().multiplyScalar(.4 + rnd() * 1.5 * (.5 + power));
      const vel = vb.clone().multiplyScalar(.6).add(out).add(v3(0, .3 + rnd() * 1.5 * (.4 + power), 0)); if (push) vel.addScaledVector(push, .1 + rnd() * .22);
      S.debris.push({ kind: 'shard', p: p.clone().add(loc), v: vel, r: v3(rnd() * 6, rnd() * 6, rnd() * 6), w: v3((rnd() - .5) * 60, (rnd() - .5) * 60, (rnd() - .5) * 60), s: .5 + rnd() * 1.3, col, rest: false, slide: 0 });
    }
    for (const [kind, ly] of [['base', -.12], ['neck', .1]]) if (rnd() < .8) { const loc = v3(0, ly, 0).applyQuaternion(q), vel = vb.clone().add(v3((rnd() - .5) * 1.5, .5 + rnd() * 1.4, (rnd() - .5) * 1.5)); if (push) vel.addScaledVector(push, .15); S.debris.push({ kind, p: p.clone().add(loc), v: vel, r: v3(rnd() * 6, rnd() * 6, rnd() * 6), w: v3((rnd() - .5) * 20, (rnd() - .5) * 20, (rnd() - .5) * 20), s: 1, col, rest: false, slide: 0 }); }
    if (rnd() < .25) spawnPuff(p, power * .5);
    // осколки и масса бутылки бьют соседей — так идёт цепная реакция
    const dir = push ? push.clone().setY(0).normalize() : null;
    for (const o of S.bottles) { if (!o.alive || S.queue.has(o)) continue; const op = o.b.position, dx = op.x - p.x, dz = op.z - p.z, dist = Math.hypot(dx, dz); if (dist > .24 || dist < 1e-4) continue;
      const k = 1 - dist / .24, J = v3(dx / dist, .15, dz / dist); if (dir) J.lerp(dir, .45).normalize(); J.multiplyScalar(.38 * (1 + 2.4 * power) * k * (.7 + rnd() * .6));
      o.b.wakeUp(); o.b.applyImpulse(new CANNON.Vec3(J.x, J.y, J.z), new CANNON.Vec3(op.x, op.y + .09, op.z)); }
    S.broken++; S.roundBroken++;
    ev('break', { x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +p.y.toFixed(2), power: +power.toFixed(2), by, col: bt.col });
  }
  S.queue.clear();
}

// ---------- осколки и пыль ----------
let shardMesh, chunkMesh, neckMesh, puffSprites = [];
const MAXS = 9000, MAXC = 260;
function buildFx() {
  const gm = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: .82, roughness: .03, metalness: .15, envMapIntensity: 3.2 });
  shardMesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), gm, MAXS); shardMesh.count = 0; scene.add(shardMesh);
  chunkMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.034, .036, .05, 16), gm, MAXC); chunkMesh.count = 0; chunkMesh.castShadow = true; scene.add(chunkMesh);
  neckMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(.0135, .02, .09, 12), gm, MAXC); neckMesh.count = 0; neckMesh.castShadow = true; scene.add(neckMesh);
  for (const m of [shardMesh, chunkMesh, neckMesh]) m.frustumCulled = false;   // счётчик в первом кадре 0 — иначе three отсечёт их навсегда
  const pt = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, 'rgba(235,245,255,.85)'); gr.addColorStop(1, 'rgba(235,245,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  for (let i = 0; i < 80; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pt, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; scene.add(sp); puffSprites.push({ sp, life: 0 }); }
}
function spawnPuff(p, power) { for (let k = 0; k < 2; k++) { const f = puffSprites.find(x => x.life <= 0); if (!f) return; f.life = 1; f.max = .7 + rnd() * .7; f.p = p.clone().add(v3((rnd() - .5) * .1, .05, (rnd() - .5) * .1)); f.v = v3((rnd() - .5) * .4, .25 + rnd() * .3, (rnd() - .5) * .4); f.s0 = .05 + .04 * power; f.age = 0; f.sp.visible = true; } }
function stepDebris() {
  for (const d of S.debris) {
    if (d.rest) continue; const half = d.kind === 'shard' ? .004 * d.s : d.kind === 'base' ? .02 : .015;
    d.v.y -= 9.82 * DT; d.p.addScaledVector(d.v, DT); d.r.addScaledVector(d.w, DT); d.slide = 0;
    if (d.p.y < half) { d.p.y = half;
      if (d.v.y < -1) { if (d.kind !== 'shard' || rnd() < .06) ev('tink', { x: +d.p.x.toFixed(2), z: +d.p.z.toFixed(2), v: +(-d.v.y).toFixed(2), big: d.kind !== 'shard' }); }
      d.v.y = -d.v.y * (d.kind === 'shard' ? .22 : .3); d.w.multiplyScalar(.55); d.v.x *= .82; d.v.z *= .82;
      const hv = Math.hypot(d.v.x, d.v.z); d.slide = hv; const f = Math.max(0, 1 - 3.2 * DT / Math.max(hv, .001)); d.v.x *= f; d.v.z *= f;
      if (Math.abs(d.v.y) < .25 && hv < .05) { d.rest = true; d.r.x = d.kind === 'shard' ? Math.round(d.r.x / Math.PI) * Math.PI + .3 : Math.PI / 2; } }
  }
  if (S.debris.length > MAXS + 400) S.debris.splice(0, S.debris.length - MAXS - 400);
}
function stepPuffs(dt) { for (const f of puffSprites) { if (f.life <= 0) continue; f.age += dt; const k = f.age / f.max; if (k >= 1) { f.life = 0; f.sp.visible = false; continue; } f.p.addScaledVector(f.v, dt); f.sp.position.copy(f.p); const s = f.s0 * (1 + k * 2); f.sp.scale.set(s, s, s); f.sp.material.opacity = .22 * (1 - k); } }

// ---------- шар ----------
function buildBall() {
  const [c0, c1, c2] = ST.ball;
  const tex = canvasTex(1024, 512, (g, w, h) => { g.fillStyle = c0; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = [c1, c2, c0][i % 3]; g.globalAlpha = .25 + rnd() * .5; g.lineWidth = 6 + rnd() * 26; g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - .5) * 260; y += (rnd() - .5) * 140; g.quadraticCurveTo(x + (rnd() - .5) * 120, y + (rnd() - .5) * 120, x, y); } g.stroke(); }
    g.globalAlpha = 1; g.fillStyle = '#050507'; for (const [x, y, r] of [[w * .22, h * .2, 24], [w * .28, h * .2, 24], [w * .25, h * .33, 30]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } });
  ballMesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), new THREE.MeshPhysicalMaterial({ map: tex, roughness: .12, metalness: .05, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.3 }));
  ballMesh.castShadow = true; scene.add(ballMesh); ballMesh.visible = false;
}
function launchBall() {
  if (ballBody) world.removeBody(ballBody);
  ballBody = new CANNON.Body({ mass: 7, material: mBall, shape: new CANNON.Sphere(BALL_R), position: new CANNON.Vec3((rnd() - .5) * .04, BALL_R, Z0), linearDamping: .01, angularDamping: .01 });
  const sp = SPEED * (.95 + rnd() * .1); ballBody.velocity.set((rnd() - .5) * .06, 0, -sp); ballBody.angularVelocity.set(-sp / BALL_R, 0, 0);
  world.addBody(ballBody); ballMesh.visible = true; ev('launch', { x: +ballBody.position.x.toFixed(2) });
}

// ---------- раунды ----------
function rackSize(r) { const R0 = ROUNDS[r]; return { w: (R0.rows - 1) * R0.sp + .08, d: (R0.rows - 1) * R0.sp * .866 + .08 }; }
function startRound(r) {
  for (const bt of S.bottles) { if (bt.alive) { world.removeBody(bt.b); scene.remove(bt.g); } }
  S.bottles = []; S.debris = []; S.impact = null; S.roundBroken = 0; S.round = r; S.roundT0 = S.t;
  if (ballBody) { world.removeBody(ballBody); ballBody = null; } ballMesh.visible = false;
  const R0 = ROUNDS[r], cols = Object.keys(COLS), pal = [cols[(rnd() * 4) | 0], cols[(rnd() * 4) | 0]], labels = ['#d8222c', '#f2c230', '#ffffff', '#1d5fbf', '#1f1f1f', null];
  for (let row = 0; row < R0.rows; row++) for (let i = 0; i <= row; i++) {
    const x = (i - row / 2) * R0.sp, z = -row * R0.sp * .866, col = rnd() < .75 ? pal[(row + i) % 2] : cols[(rnd() * 4) | 0];
    makeBottle(x, z, col, labels[(rnd() * labels.length) | 0]);
  }
  ev('round', { round: r, n: S.bottles.length });
}
function roundAt(t) { let t0 = 0; for (let r = 0; r < ROUNDS.length; r++) { if (t < t0 + ROUNDS[r].len) return { r, t0 }; t0 += ROUNDS[r].len; } return { r: ROUNDS.length, t0 }; }
const totalLen = () => ROUNDS.reduce((a, r) => a + r.len, 0) + OUTRO;

function step() {
  const { r, t0 } = roundAt(S.t);
  if (r < ROUNDS.length && r !== S.round) startRound(r);
  if (r < ROUNDS.length && !ballBody && S.t - t0 >= LAUNCH) launchBall();
  if (r < ROUNDS.length && S.round === r && S.t - t0 >= ROUNDS[r].len - 1.25 && S.strike < t0) {   // в конце раунда: все сбиты — «СТРАЙК!»
    const standing = S.bottles.filter(b => b.alive && new CANNON.Vec3(0, 1, 0).dot(b.b.quaternion.vmult(new CANNON.Vec3(0, 1, 0))) > .9).length;
    if (!standing) { S.strike = S.t; ev('strike', { round: r }); } else S.strike = t0 + .001;
  }
  const ctaT0 = ROUNDS.reduce((a, x) => a + x.len, 0) + SUMMARY;
  if (!S.cta && S.t >= ctaT0) { S.cta = 1; ev('cta'); }
  if (S.cta === 1 && S.t >= ctaT0 + CTA_TAP * CTA_LEN) { S.cta = 2; ev('ctaTap'); }
  if (r === ROUNDS.length && S.round !== r) { S.round = r; for (const bt of S.bottles) if (bt.alive) bt.alive = bt.alive; ev('outro', { total: S.broken }); }
  world.step(DT); doBreaks(); stepDebris();
  S.shake *= Math.pow(.03, DT); S.t += DT;
}

// ---------- камера ----------
function placeCamera(vt, slow) {
  const r = Math.min(S.round, ROUNDS.length - 1), { w, d } = rackSize(r);
  if (slow) {
    const k = Math.min(1, (S.t - slow.t0) / 1.6), side = r % 2 ? -1 : 1;
    cam.position.set(side * (w / 2 + .55 - .15 * k), .26 + .08 * k, -d * .3 + .75 - .25 * k); cam.lookAt(0, .1, -d * .42); cam.fov = 46;
  } else {
    const dist = .7 + w * 1.05, k = vt * .15;
    cam.position.set(.14 + Math.sin(k) * .05, .3 + w * .42, -d - dist); cam.lookAt(0, .12, 2.6); cam.fov = 50;
  }
  if (S.shake > .01) { cam.position.x += (rnd() - .5) * S.shake * .02; cam.position.y += (rnd() - .5) * S.shake * .015; }
  cam.updateProjectionMatrix();
}

// ---------- HUD ----------
let hudKey = '', HOOK = '';
function buildHud() {
  hud = new THREE.Scene(); hudCam = new THREE.OrthographicCamera(0, W, H, 0, -1, 1);
  const c = document.createElement('canvas'); c.width = W; c.height = H; hudCtx = c.getContext('2d'); hudTex = new THREE.CanvasTexture(c); hudTex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: hudTex, transparent: true, depthTest: false })); m.position.set(W / 2, H / 2, 0); hud.add(m);
}
function drawHud(vt, slow) {
  const { r, t0 } = roundAt(S.t), lt = S.t - t0, banner = r < ROUNDS.length && lt < BANNER && !slow, strike = S.t - S.strike < 1.15 && S.strike > 0 && S.strike >= t0, outro = r >= ROUNDS.length;
  const ctaT0 = ROUNDS.reduce((a, x) => a + x.len, 0) + SUMMARY, ck = S.t >= ctaT0 ? Math.min(1, (S.t - ctaT0) / CTA_LEN) : -1;
  const key = [r, banner, S.roundBroken, !!slow, strike, outro, vt < 2.2, ck < 0 ? -1 : Math.round(ck * 200)].join('|'); if (key === hudKey) return; hudKey = key;
  const g = hudCtx; g.clearRect(0, 0, W, H); g.textAlign = 'center'; g.lineJoin = 'round';
  const txt = (s, x, y, size, col) => { g.font = `900 ${size}px Montserrat`; const sz = Math.min(size, Math.floor(size * 980 / g.measureText(s).width)); g.font = `900 ${sz}px Montserrat`; g.lineWidth = sz * .2; g.strokeStyle = '#000'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
  if (ck >= 0) { txt(`РАЗБИТО: ${S.broken}`, W / 2, 170, 80, '#ffffff'); drawCta(g, W, H, ck); hudTex.needsUpdate = true; return; }
  if (outro) { txt('ИТОГО', W / 2, 760, 110, '#ffd400'); txt(`${S.broken} БУТЫЛОК`, W / 2, 900, 120, '#ffffff'); txt('В ДРЕБЕЗГИ', W / 2, 1030, 100, '#ff3b4a'); }
  else if (banner) { if (vt < 2.2 && HOOK) txt(HOOK, W / 2, 200, 104, '#ffd400'); txt(`РАУНД ${r + 1}`, W / 2, vt < 2.2 && HOOK ? 330 : 200, 96, vt < 2.2 && HOOK ? '#ffffff' : '#ffd400'); txt(`${ROUNDS[r].n} БУТЫЛОК`, W / 2, vt < 2.2 && HOOK ? 440 : 320, 84, '#ffffff'); }
  else txt(`РАЗБИТО: ${S.roundBroken} / ${ROUNDS[Math.min(r, ROUNDS.length - 1)].n}`, W / 2, 170, 80, '#ffffff');
  if (slow) txt('ПОВТОР', W / 2, 290, 64, '#ff3b4a');
  if (strike && !slow && !outro) txt('СТРАЙК!', W / 2, 820, 170, '#ffd400');
  hudTex.needsUpdate = true;
}

// ---------- кадр ----------
function syncAll(alpha) {
  for (const bt of S.bottles) if (bt.alive) { const b = bt.b; bt.g.position.set(b.position.x, b.position.y, b.position.z); bt.g.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w); }
  if (ballBody) { ballMesh.position.set(ballBody.position.x, ballBody.position.y, ballBody.position.z); ballMesh.quaternion.set(ballBody.quaternion.x, ballBody.quaternion.y, ballBody.quaternion.z, ballBody.quaternion.w); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(); let ns = 0, nc = 0, nn = 0;
  for (const d of S.debris) { Q.setFromEuler(E.set(d.r.x, d.r.y, d.r.z));
    if (d.kind === 'shard' && ns < MAXS) { M.compose(d.p, Q, v3(.015 * d.s, .004 * d.s, .021 * d.s)); shardMesh.setMatrixAt(ns, M); shardMesh.setColorAt(ns++, d.col); }
    else if (d.kind === 'base' && nc < MAXC) { M.compose(d.p, Q, v3(1, 1, 1)); chunkMesh.setMatrixAt(nc, M); chunkMesh.setColorAt(nc++, d.col); }
    else if (d.kind === 'neck' && nn < MAXC) { M.compose(d.p, Q, v3(1, 1, 1)); neckMesh.setMatrixAt(nn, M); neckMesh.setColorAt(nn++, d.col); } }
  for (const [m, n] of [[shardMesh, ns], [chunkMesh, nc], [neckMesh, nn]]) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}

window.SMASH = {
  init(cfg = {}) {
    rnd = R(cfg.seed || 7); ST = STYLES[cfg.style] || STYLES[['neon', 'classic', 'ice', 'fire'][(cfg.seed || 7) % 4]]; HOOK = cfg.hook || 'СКОЛЬКО РАЗОБЬЁТ?';
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(50, W / H, .02, 80);
    world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) }); world.broadphase = new CANNON.SAPBroadphase(world); world.allowSleep = true; world.solver.iterations = 12;
    mLane = new CANNON.Material('lane'); mGlass = new CANNON.Material('glass'); mBall = new CANNON.Material('ball');
    world.addContactMaterial(new CANNON.ContactMaterial(mLane, mGlass, { friction: .35, restitution: .12 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mLane, mBall, { friction: .06, restitution: .05 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mBall, mGlass, { friction: .1, restitution: .2 }));
    world.addContactMaterial(new CANNON.ContactMaterial(mGlass, mGlass, { friction: .2, restitution: .25 }));
    const ground = new CANNON.Body({ mass: 0, material: mLane, shape: new CANNON.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); world.addBody(ground);
    buildHall(); buildAssets(); buildFx(); buildBall(); buildHud();
    rnd = R((cfg.seed || 7) * 31 + 5);
    return { simEnd: totalLen(), cars: ROUNDS.reduce((a, r) => a + r.n, 0) };
  },
  replayWin: { pre: .12, post: 1.45, rate: .25, gap: 2 },
  replays() { return S.impacts.map(i => ({ t: i.t, x: i.x, z: i.z, power: i.power, car: -1 })); },
  advance(simDt) { S.acc += simDt; while (S.acc >= DT) { step(); S.acc -= DT; } return S.t; },
  fastForward(t) { while (S.t < t) step(); },
  render(vt, slow, dtv) { stepPuffs(dtv * (slow ? .3 : 1)); syncAll(); placeCamera(vt, slow); drawHud(vt, slow); renderer.clear(); renderer.render(scene, cam); renderer.clearDepth(); renderer.render(hud, hudCam); },
  frameAudio() {
    let slide = 0, n = 0; for (const d of S.debris) if (!d.rest && d.slide > .05) { slide += d.slide * (d.kind === 'shard' ? 1 : 4); n++; }
    const b = ballBody ? { v: +Math.hypot(ballBody.velocity.x, ballBody.velocity.z).toFixed(2), ground: ballBody.position.y < BALL_R + .01, x: +(ballBody.position.x - cam.position.x).toFixed(2), dist: +ballBody.position.distanceTo(new CANNON.Vec3(cam.position.x, cam.position.y, cam.position.z)).toFixed(2) } : null;
    return { ball: b, slide: +slide.toFixed(2), moving: n };
  },
  get events() { return S.events; }, get t() { return S.t; }, get hits() { return S.broken; },
};
