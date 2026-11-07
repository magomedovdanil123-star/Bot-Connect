// «Шредер против машин» — залипалка 9:16. Кран опускает машину на два зубчатых вала, её затягивает вниз и рвёт:
// всё, что ниже кромки валов, сминается в щель, сверху летят куски краски, стекло, искры. 4 машины, последним — автобус.
import * as THREE from 'three';
import { W, H, v3, R, canvasTex, hazard, buildHall, carMesh, snapCar, deformCar, hash, Fx, Hud } from './industry.js';
import { drawCta, CTA_LEN, CTA_TAP } from './hudcta.js';

let rnd = R(7);
const DT = 1 / 240, RIM = 2.2, SHAFT_Y = 1.15, GAP = .35, PIT_W = 3.4, PIT_L = 13;
const ROUNDS = [
  { type: 'hatch', col: '#2e7bd6', name: 'ХЭТЧБЕК' }, { type: 'sedan', col: '#d83a34', name: 'СЕДАН' }, { type: 'pickup', col: '#3fa05a', name: 'ПИКАП' }, { type: 'bus', col: '#f4c20d', name: 'АВТОБУС' },
];
const T_LOWER = 1.6, SUMMARY = 1.6;
const lenOf = r => ROUNDS[r].type === 'bus' ? 11 : 8.4;
const total = () => ROUNDS.reduce((a, _, i) => a + lenOf(i), 0) + SUMMARY + CTA_LEN;
let renderer, scene, cam, hud, fx, shafts = [], crane, cable, car = null;
const S = { t: 0, acc: 0, round: -1, r0: 0, events: [], eaten: 0, shake: 0, eat: 0, rpm: 1, cta: 0 };
const ev = (kind, d = {}) => S.events.push({ t: +S.t.toFixed(4), kind, ...d });
const clamp = x => Math.max(0, Math.min(1, x)), ease = x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;

function buildShredder() {
  const steel = new THREE.MeshStandardMaterial({ color: '#30353c', metalness: .8, roughness: .45 }), dark = new THREE.MeshStandardMaterial({ color: '#15171b', metalness: .6, roughness: .6 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#e8b21c', metalness: .3, roughness: .45 }), stripe = new THREE.MeshStandardMaterial({ map: canvasTex(1024, 64, (g, w, h) => hazard(g, 0, 0, w, h, 26)) });
  // короб: четыре стенки над полом, внутри — тёмная шахта
  const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), yellow); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); };
  for (const s of [-1, 1]) { wall(.5, RIM, PIT_L + 1, s * (PIT_W / 2 + .25), RIM / 2, 0); }
  wall(PIT_W + 1, RIM, .5, 0, RIM / 2, -(PIT_L / 2 + .25)); wall(PIT_W + 1, RIM, .5, 0, RIM / 2, PIT_L / 2 + .25);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.52, .2, PIT_L + 1.02), stripe); b.position.set(s * (PIT_W / 2 + .25), RIM - .1, 0); scene.add(b); }
  const fb = new THREE.Mesh(new THREE.BoxGeometry(PIT_W + 1.02, .2, .52), stripe); fb.position.set(0, RIM - .1, PIT_L / 2 + .25); scene.add(fb);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(PIT_W, .1, PIT_L), new THREE.MeshBasicMaterial({ color: '#050506' })); hole.position.y = .3; scene.add(hole);
  // два вала с зубчатыми дисками, крутятся навстречу
  const discGeo = new THREE.CylinderGeometry(.62, .62, .22, 14), toothGeo = new THREE.BoxGeometry(.22, .3, .26);
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * (.62 + GAP / 2), SHAFT_Y - .62, 0); scene.add(sh);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, PIT_L, 16), dark); core.rotation.x = Math.PI / 2; sh.add(core);
    for (let i = 0; i < 26; i++) { const z = -PIT_L / 2 + .25 + i * (PIT_L - .5) / 25, d = new THREE.Group(); d.position.z = z + (s > 0 ? .12 : 0); d.rotation.z = i * .7;
      const disc = new THREE.Mesh(discGeo, steel); disc.rotation.x = Math.PI / 2; d.add(disc);
      for (let k = 0; k < 6; k++) { const t = new THREE.Mesh(toothGeo, steel); const a = k / 6 * Math.PI * 2; t.position.set(Math.cos(a) * .7, Math.sin(a) * .7, 0); t.rotation.z = a + .5; d.add(t); }
      sh.add(d); }
    sh.traverse(m => { if (m.isMesh) m.castShadow = true; }); sh.userData.dir = s; shafts.push(sh);
  }
  // кран: балка сверху и трос с магнитом
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 30), yellow); beam.position.set(0, 16, -4); scene.add(beam);
  crane = new THREE.Group(); scene.add(crane);
  const mag = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .45, 24), dark); mag.castShadow = true; crane.add(mag);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, .12, 24), new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#ff2a1a', emissiveIntensity: .8 })); ring.position.y = -.2; crane.add(ring);
  cable = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1, 8), new THREE.MeshStandardMaterial({ color: '#222', metalness: .8, roughness: .4 })); scene.add(cable);
}
function startRound(r) {
  if (car) scene.remove(car.g); fx.clear(); S.round = r; S.r0 = S.t;
  const R0 = ROUNDS[r]; car = carMesh(R0.type, R0.col); car.g.position.set(0, 12, 0); scene.add(car.g); snapCar(car);
  car.sink = 0; car.glassBroken = false; car.popped = new Set(); car.lastChew = 0; car.released = false; car.done = false; car.minY = 99;
  ev('round', { round: r, name: R0.name });
}
// всё, что ниже кромки валов (в системе машины yCut), затягивается в щель и сминается
function chew(yCut) {
  deformCar(car, (x, y, z) => { if (y >= yCut) { const k = clamp(1 - (y - yCut) / .6); return [x * (1 - .25 * k) + (hash(x, z, y) - .5) * .12 * k, y - .06 * k * hash(z, y, x), z]; }
    const d = yCut - y; return [x * Math.max(.05, .3 - d * .3) + (hash(x, y, z) - .5) * .25, yCut - .05 - d * .35 - hash(y, z, x) * .15, z + (hash(z, x, y) - .5) * .2]; });
  for (const wh of car.wheels) { const wy = wh.position.y - car.T.wr; if (wy < yCut && !car.popped.has(wh)) { const fly = car.popped.size < 2; car.popped.add(wh); wh.visible = false; if (!fly) continue; ev('pop', {}); const p = wh.position.clone().add(car.g.position); fx.add('wheel', p.setY(RIM + .2), v3(wh.userData.side * (2 + rnd() * 2), 5 + rnd() * 3, (rnd() - .5) * 3), { s: car.T.wr }); } }
}
function stepRound(lt, len) {
  const R0 = ROUNDS[S.round], hCar = car.top;
  if (lt < T_LOWER) { const k = ease(lt / T_LOWER); car.g.position.y = 12 - (12 - (SHAFT_Y + .02)) * k; S.eat = 0; }
  else {
    if (!car.released) { car.released = true; ev('drop', {}); S.shake = Math.min(1, S.shake + .5); fx.puff(v3(0, RIM, 0), 1.4); }
    // скорость затягивания: высокие машины жуёт дольше; валы «проседают» под нагрузкой
    const eatEnd = len - 1.6, k = clamp((lt - T_LOWER) / (eatEnd - T_LOWER)), sink = (hCar + .35) * (k * k * .35 + k * .65);
    const prev = car.sink; car.sink = sink; S.eat = Math.min(1, (sink - prev) / DT / ((hCar + .35) / (eatEnd - T_LOWER)) * (k < 1 ? 1 : 0));
    const jit = k < 1 ? .05 : 0; car.g.position.set((rnd() - .5) * jit, SHAFT_Y + .02 - sink + (rnd() - .5) * jit, (rnd() - .5) * jit); car.g.rotation.z = (rnd() - .5) * jit * .3;
    if (sink - (car.lastCut || 0) > .015) { car.lastCut = sink; chew(sink); }
    if (k < 1) {
      if (rnd() < .5) fx.add('chunk', v3((rnd() - .5) * .4, SHAFT_Y + .1, (rnd() - .5) * car.T.L * .9), v3((rnd() - .5) * 5, 3 + rnd() * 6, (rnd() - .5) * 4), { col: rnd() < .6 ? R0.col : rnd() < .5 ? '#2a2c30' : '#b8bec6', s: .4 + rnd() });
      if (rnd() < .35) fx.sparksAt(v3((rnd() - .5) * GAP, SHAFT_Y, (rnd() - .5) * car.T.L * .9), 3, 9);
      if (lt - car.lastChew > .11 + rnd() * .16) { car.lastChew = lt; ev('chew', { k: +k.toFixed(2), big: rnd() < .25 }); S.shake = Math.min(1, S.shake + .08); }
      const cabBottom = car.T.wr + car.T.bh - .1; if (!car.glassBroken && sink > cabBottom - .1) { car.glassBroken = true; car.glass.color.set('#9fb9cc'); car.glass.opacity = .5; ev('glass', {}); S.shake = Math.min(1, S.shake + .35); fx.burst('shard', v3(0, SHAFT_Y + .3, 0), 120, 7, 5, { spread: car.T.L * .8 }); }
    } else if (!car.done) { car.done = true; S.eaten++; car.g.visible = false; ev('gone', {}); }
  }
  // кран: магнит держит машину, после сброса уходит вверх
  const cy = lt < T_LOWER ? car.g.position.y + hCar + .25 : Math.min(15, SHAFT_Y + hCar + .25 + (lt - T_LOWER) * 9);
  crane.position.set(0, cy, 0); cable.scale.y = Math.max(.01, 16 - cy - .2); cable.position.set(0, (16 + cy) / 2, 0);
}
function step() {
  S.t += DT; let t0 = 0, r = 0; while (r < ROUNDS.length && S.t >= t0 + lenOf(r)) { t0 += lenOf(r); r++; }
  S.rpm = 1 - .35 * S.eat;
  for (const sh of shafts) sh.rotation.z += sh.userData.dir * DT * 5.5 * S.rpm * -1;
  if (r < ROUNDS.length) { if (r !== S.round) startRound(r); stepRound(S.t - t0, lenOf(r)); }
  else if (S.round < ROUNDS.length) { S.round = ROUNDS.length; S.eat = 0; if (car) car.g.visible = false; crane.position.y = 15; ev('outro', { total: S.eaten }); }
  const ctaT0 = ROUNDS.reduce((a, _, i) => a + lenOf(i), 0) + SUMMARY;
  if (!S.cta && S.t >= ctaT0) { S.cta = 1; ev('cta'); } if (S.cta === 1 && S.t >= ctaT0 + CTA_TAP * CTA_LEN) { S.cta = 2; ev('ctaTap'); }
  fx.step(DT, S.t, p => Math.abs(p.x) < PIT_W / 2 && Math.abs(p.z) < PIT_L / 2 ? -5 : 0); S.shake *= Math.pow(.03, DT);
}
function placeCamera(vt) {
  const r = Math.min(S.round, ROUNDS.length - 1), bus = ROUNDS[r].type === 'bus', k = vt * .1;
  const d = bus ? 15 : 10.5;
  cam.position.set(2.4 + Math.sin(k) * .6, RIM + (bus ? 7 : 5.2), d); cam.lookAt(0, SHAFT_Y + (bus ? 1.2 : 1), -.6); cam.fov = 50;
  if (S.shake > .01) { cam.position.x += (rnd() - .5) * S.shake * .25; cam.position.y += (rnd() - .5) * S.shake * .2; }
  cam.updateProjectionMatrix();
}
let HOOK = 'ШРЕДЕР ПРОТИВ МАШИН';
function drawHud(vt) {
  const ctaT0 = ROUNDS.reduce((a, _, i) => a + lenOf(i), 0) + SUMMARY, ck = S.t >= ctaT0 ? Math.min(1, (S.t - ctaT0) / CTA_LEN) : -1, r = Math.min(S.round, ROUNDS.length);
  const key = [r, vt < 2, S.eaten, ck < 0 ? -1 : Math.round(ck * 200)].join('|'); if (!hud.begin(key)) return;
  if (ck >= 0) { hud.txt(`ПЕРЕМОЛОТО: ${S.eaten}`, W / 2, 170, 80, '#ffffff'); drawCta(hud.g, W, H, ck); return hud.end(); }
  if (r >= ROUNDS.length) { hud.txt(`ВСЕ ${ROUNDS.length}`, W / 2, 780, 150, '#ffd400'); hud.txt('В ФАРШ', W / 2, 930, 140, '#ffffff'); return hud.end(); }
  if (vt < 2) hud.txt(HOOK, W / 2, 190, 100, '#ffd400'); else hud.txt(`ПЕРЕМОЛОТО: ${S.eaten} / ${ROUNDS.length}`, W / 2, 160, 72, '#ffffff');
  hud.txt(ROUNDS[r].name, W / 2, vt < 2 ? 320 : 280, 96, '#ffd400');
  hud.end();
}
window.SMASH = {
  init(cfg = {}) {
    rnd = R(cfg.seed || 7); if (cfg.hook) HOOK = cfg.hook;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(50, W / H, .1, 200);
    buildHall(scene, renderer, rnd); buildShredder(); fx = new Fx(scene, rnd, ev); hud = new Hud(); crane.position.y = 15;
    return { simEnd: total(), cars: ROUNDS.length };
  },
  replayWin: { pre: .1, post: .5, rate: 1 }, replays() { return []; },
  advance(simDt) { S.acc += simDt; while (S.acc >= DT) { step(); S.acc -= DT; } return S.t; },
  fastForward(t) { while (S.t < t) step(); },
  render(vt) { fx.sync(); placeCamera(vt); drawHud(vt); renderer.clear(); renderer.render(scene, cam); renderer.clearDepth(); renderer.render(hud.scene, hud.cam); },
  frameAudio() { return { eat: +S.eat.toFixed(2), rpm: +S.rpm.toFixed(2) }; },
  get events() { return S.events; }, get t() { return S.t; }, get hits() { return S.eaten; },
};
