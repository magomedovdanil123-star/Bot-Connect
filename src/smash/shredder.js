// «Промышленный шредер против машины — её заклинило» — залипалка 9:16 по раскадровке с ожиданием:
// вид сверху в пасть → кран несёт седан, магнит мигает, машина проседает и ловится → зеркало падает и исчезает за полсекунды →
// задние колёса касаются зубьев → шредер ЗАКЛИНИЛО, тишина → реверс выплёвывает бампер → полная мощность: машину рывком втягивает,
// стекло взрывается в замедлении → последней уходит горящая фара → пустые валы (петля к первому кадру). API: window.SMASH
import * as THREE from 'three';
import { W, H, v3, R, canvasTex, hazard, buildHall, carMesh, snapCar, deformCar, hash, Fx, Hud } from './industry.js';
import { drawCta, CTA_LEN, CTA_TAP } from './hudcta.js';

let rnd = R(7);
const DT = 1 / 240, RIM = 2.2, SHAFT_Y = 1.15, GAP = .35, PIT_W = 3.4, PIT_L = 13, HANG = 6.6;
// таймлайн (с)
const T = { hook: 2, flick1: 3.5, flick2: 4.1, slip: 4.3, mirror: 7.0, lower: 9.4, rest: 11.0, touch: 11.6, jam: 14.0, stall: 14.6, rev: 19.2, revEnd: 20.6, power: 21.6, jerk: 22.2, glass: 24.6, eaten: 31.0, lightOff: 32.8, end: 35.6 };
const CTA_T0 = T.end, TH = -.18;
let renderer, scene, cam, hud, fx, shafts = [], crane, ring, cable, car = null, mirror, light;
const S = { t: 0, acc: 0, events: [], shake: 0, eat: 0, rpm: 1, cta: 0, silence: 0, c0: -9, th: 0, status: '' };
const ev = (kind, d = {}) => S.events.push({ t: +S.t.toFixed(4), kind, ...d });
const clamp = x => Math.max(0, Math.min(1, x)), ease = x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2, outQ = x => 1 - (1 - x) ** 2, inQ = x => x * x;
const at = t => S.t >= t && S.t - DT < t, k = (a, b, f = ease) => f(clamp((S.t - a) / (b - a)));

function buildShredder() {
  const steel = new THREE.MeshStandardMaterial({ color: '#30353c', metalness: .8, roughness: .45 }), dark = new THREE.MeshStandardMaterial({ color: '#15171b', metalness: .6, roughness: .6 });
  const yellow = new THREE.MeshStandardMaterial({ color: '#e8b21c', metalness: .3, roughness: .45 }), stripe = new THREE.MeshStandardMaterial({ map: canvasTex(1024, 64, (g, w, h) => hazard(g, 0, 0, w, h, 26)) });
  const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), yellow); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; scene.add(m); };
  for (const s of [-1, 1]) wall(.5, RIM, PIT_L + 1, s * (PIT_W / 2 + .25), RIM / 2, 0);
  wall(PIT_W + 1, RIM, .5, 0, RIM / 2, -(PIT_L / 2 + .25)); wall(PIT_W + 1, RIM, .5, 0, RIM / 2, PIT_L / 2 + .25);
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.52, .2, PIT_L + 1.02), stripe); b.position.set(s * (PIT_W / 2 + .25), RIM - .1, 0); scene.add(b); }
  const fb = new THREE.Mesh(new THREE.BoxGeometry(PIT_W + 1.02, .2, .52), stripe); fb.position.set(0, RIM - .1, PIT_L / 2 + .25); scene.add(fb);
  const hole = new THREE.Mesh(new THREE.BoxGeometry(PIT_W, .1, PIT_L), new THREE.MeshBasicMaterial({ color: '#050506' })); hole.position.y = .3; scene.add(hole);
  const discGeo = new THREE.CylinderGeometry(.62, .62, .22, 14), toothGeo = new THREE.BoxGeometry(.22, .3, .26);
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * (.62 + GAP / 2), SHAFT_Y - .62, 0); scene.add(sh);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, PIT_L, 16), dark); core.rotation.x = Math.PI / 2; sh.add(core);
    for (let i = 0; i < 26; i++) { const z = -PIT_L / 2 + .25 + i * (PIT_L - .5) / 25, d = new THREE.Group(); d.position.z = z + (s > 0 ? .12 : 0); d.rotation.z = i * .7;
      const disc = new THREE.Mesh(discGeo, steel); disc.rotation.x = Math.PI / 2; d.add(disc);
      for (let q = 0; q < 6; q++) { const t = new THREE.Mesh(toothGeo, steel); const a = q / 6 * Math.PI * 2; t.position.set(Math.cos(a) * .7, Math.sin(a) * .7, 0); t.rotation.z = a + .5; d.add(t); }
      sh.add(d); }
    sh.traverse(m => { if (m.isMesh) m.castShadow = true; }); sh.userData.dir = s; shafts.push(sh);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 30), yellow); beam.position.set(0, 16, -4); scene.add(beam);
  crane = new THREE.Group(); scene.add(crane);
  const mag = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .45, 24), dark); mag.castShadow = true; crane.add(mag);
  ring = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.12, .12, 24), new THREE.MeshStandardMaterial({ color: '#ff3b2f', emissive: '#ff2a1a', emissiveIntensity: 1.2 })); ring.position.y = -.2; crane.add(ring);
  cable = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 1, 8), new THREE.MeshStandardMaterial({ color: '#222', metalness: .8, roughness: .4 })); scene.add(cable);
}
function buildCar() {
  car = carMesh('sedan', '#c8241f'); scene.add(car.g); snapCar(car); car.popped = new Set(); car.glassBroken = false; car.lastChew = 0;
  // боковое зеркало — отдельная деталь, отвалится первой
  mirror = new THREE.Group(); const arm = new THREE.Mesh(new THREE.BoxGeometry(.18, .05, .06), car.paint), m = new THREE.Mesh(new THREE.BoxGeometry(.08, .16, .24), car.paint); arm.position.x = .09; m.position.x = .2; mirror.add(arm, m);
  mirror.position.set(car.T.Wd / 2 - .04, car.T.wr + car.T.bh - .02, car.T.co + car.T.cl / 2 - .1); car.g.add(mirror);
  // фара, которая уйдёт последней
  light = new THREE.Group(); const lb = new THREE.Mesh(new THREE.BoxGeometry(.5, .22, .35), car.paint), lens = new THREE.Mesh(new THREE.BoxGeometry(.42, .16, .04), new THREE.MeshStandardMaterial({ color: '#fff8d8', emissive: '#fff1c0', emissiveIntensity: 2.4 }));
  lens.position.z = .19; light.add(lb, lens); light.userData.lens = lens; light.visible = false; scene.add(light);
  const glow = new THREE.PointLight('#ffeec0', 0, 4, 2); glow.position.z = .5; light.add(glow); light.userData.glow = glow;
}
// всё, что ниже линии валов (плоскость в системе машины с учётом наклона th), затягивается в щель и сминается
function chew() {
  const c0 = S.c0, cs = Math.cos(S.th), sn = Math.sin(S.th);
  deformCar(car, (x, y, z) => { const d = c0 - (y * cs - z * sn);
    if (d <= 0) { const q = clamp(1 + d / .6); return [x * (1 - .25 * q) + (hash(x, z, y) - .5) * .12 * q, y - .06 * q * hash(z, y, x), z]; }
    return [x * Math.max(.05, .3 - d * .3) + (hash(x, y, z) - .5) * .25, y - (d * 1.35 + hash(y, z, x) * .15) / cs, z + (hash(z, x, y) - .5) * .2]; });
  for (const wh of car.wheels) { const ye = -wh.position.z * sn; if (ye < c0 && !car.popped.has(wh)) { const fly = car.popped.size < 1; car.popped.add(wh); wh.visible = false; if (!fly) continue; ev('pop', {}); S.shake = Math.min(1, S.shake + .4);
    fx.add('wheel', v3(wh.userData.side * 1.2, RIM + .2, car.g.position.z + wh.position.z), v3(wh.userData.side * (2 + rnd() * 2), 5 + rnd() * 3, (rnd() - .5) * 2), { s: car.T.wr }); } }
}
function c0At() {   // глубина «съеденного» во времени
  if (S.t < T.touch) return -9;
  if (S.t < T.jam) return -.25 + .7 * k(T.touch, T.jam, outQ);
  if (S.t < T.jerk) return .45;
  if (S.t < T.glass) return .45 + .48 * k(T.jerk, T.glass, outQ);
  if (S.t < T.eaten) return .93 + 1.25 * k(T.glass, T.eaten, x => x);
  return 9;
}
function rpmAt() {
  if (S.t < T.jam) return 1; if (S.t < T.stall) return 1 - k(T.jam, T.stall, inQ); if (S.t < T.rev) return 0;
  if (S.t < T.revEnd) return -.9 * Math.sin(Math.PI * clamp((S.t - T.rev) / (T.revEnd - T.rev))); if (S.t < T.power) return 0; if (S.t < T.power + .4) return 1.4 * k(T.power, T.power + .4); return S.t < T.eaten ? 1.4 : 1;
}
function step() {
  S.t += DT;
  const prevC0 = S.c0; S.c0 = c0At(); S.rpm = rpmAt();
  for (const sh of shafts) sh.rotation.z -= sh.userData.dir * DT * 5.5 * S.rpm;
  // машина: висит на магните (качается) → опускается → лежит на валах, наклоняется задом → тонет по мере «съедания»
  let cy, th = 0, sway = 0;
  if (S.t < T.lower) { sway = Math.sin(S.t * 2.1) * .06 * (1 - k(5, T.lower)); cy = HANG + (S.t > T.slip ? -.22 + .06 * Math.exp(-(S.t - T.slip) * 6) * Math.cos((S.t - T.slip) * 30) : 0); th = sway * .5; }
  else if (S.t < T.rest) cy = HANG - .22 - (HANG - .22 - (SHAFT_Y + .02)) * k(T.lower, T.rest);
  else { th = TH * k(T.rest, T.touch + .6); cy = Math.min(SHAFT_Y + .02, SHAFT_Y - .1 - S.c0); }
  if (S.t >= T.jam && S.t < T.power) { cy += (rnd() - .5) * .02 * (S.t < T.stall ? 1 : .3); }
  if (S.t >= T.jerk && S.t < T.eaten) { cy += (rnd() - .5) * .05; th += (rnd() - .5) * .02; }
  S.th = th;
  if (S.t < T.eaten) { car.g.position.set(sway * 2, cy, 0); car.g.rotation.x = th; car.g.rotation.z = sway * .3; }
  if (S.c0 > -2 && Math.abs(S.c0 - (car.lastC0 ?? -9)) > .012) { car.lastC0 = S.c0; chew(); }
  S.eat = S.t > T.touch && S.t < T.eaten ? clamp((S.c0 - prevC0) / DT / .5) : 0;
  // кран
  const magY = S.t < T.rest ? car.g.position.y + car.top + .25 : Math.min(15, SHAFT_Y + car.top + .25 + (S.t - T.rest) * 6);
  crane.position.set(car.g.position.x * (S.t < T.rest ? 1 : 0), magY, 0); cable.scale.y = Math.max(.01, 16 - magY - .2); cable.position.set(crane.position.x, (16 + magY) / 2, 0);
  const flick = (S.t > T.flick1 && S.t < T.flick1 + .25) || (S.t > T.flick2 && S.t < T.slip + .1); ring.material.emissiveIntensity = flick ? (Math.sin(S.t * 90) > 0 ? 2 : .05) : 1.2;
  if (at(T.flick1) || at(T.flick2)) ev('flicker', {}); if (at(T.slip)) { ev('slip', {}); S.shake = Math.min(1, S.shake + .35); }
  if (at(.6)) ev('sway', {});
  // зеркало: отваливается от вибрации, падает в валы и исчезает
  if (at(T.mirror)) { car.g.updateMatrixWorld(true); const p = mirror.getWorldPosition(v3()); car.g.remove(mirror); mirror.position.copy(p); scene.add(mirror); mirror.userData.v = v3(.3, 0, 0); ev('mirrorOff', {}); }
  if (mirror.userData.v && mirror.visible) { mirror.userData.v.y -= 13 * DT; mirror.position.addScaledVector(mirror.userData.v, DT); mirror.rotation.z += DT * 6;
    if (mirror.position.y < SHAFT_Y + .25) { mirror.position.x *= .9; if (!mirror.userData.hit) { mirror.userData.hit = S.t; ev('mirror', {}); fx.burst('chunk', mirror.position.clone(), 18, 4, 4, { spread: .3, col: '#c8241f', s: .25 }); fx.sparksAt(mirror.position.clone(), 10, 7); } if (S.t - mirror.userData.hit > .45) mirror.visible = false; else mirror.position.y -= DT * 1.2; } }
  if (at(T.lower)) ev('lower', {}); if (at(T.touch)) { ev('touch', {}); S.shake = Math.min(1, S.shake + .3); }
  // заклинило
  if (at(T.jam)) { S.status = 'ЗАКЛИНИЛО!'; ev('jam', {}); } if (at(T.stall)) { ev('stall', {}); fx.puff(v3(0, SHAFT_Y + .4, -1.5), 1.6); } S.silence = S.t > T.stall + .2 && S.t < T.rev ? 1 : S.t > T.revEnd && S.t < T.power ? 1 : 0;
  if (S.t > T.stall + .5 && S.t < T.rev && S.t - (S.lastJ || 0) > .9) { S.lastJ = S.t; ev('settle', {}); }
  if (at(T.rev)) { S.status = 'РЕВЕРС'; ev('reverse', {}); } if (S.t > T.rev + .2 && S.t < T.revEnd - .2 && rnd() < .3) fx.add('chunk', v3((rnd() - .5) * .3, SHAFT_Y + .1, -1.2 + (rnd() - .5) * 2), v3((rnd() - .5) * 3, 5 + rnd() * 4, (rnd() - .5) * 3), { col: rnd() < .5 ? '#c8241f' : '#1d1d20', s: .5 + rnd() * .6 });
  if (S.t > T.rev + .2 && S.t < T.revEnd - .2 && S.t - (S.lastSpit || 0) > .2) { S.lastSpit = S.t; ev('spit', {}); }
  if (at(T.power)) { S.status = 'ПОЛНАЯ МОЩНОСТЬ'; ev('power', {}); } if (at(T.jerk)) { ev('jerk', {}); S.shake = 1; } if (at(T.jerk + 1.6)) S.status = '';
  // жуём
  if (S.t > T.touch && S.t < T.eaten && (S.t < T.jam || S.t > T.jerk)) {
    const r = S.t > T.jerk ? 1 : .35;
    if (rnd() < .55 * r) fx.add('chunk', v3((rnd() - .5) * .4, SHAFT_Y + .1, (rnd() - .5) * car.T.L * .9), v3((rnd() - .5) * 5, 3 + rnd() * 6, (rnd() - .5) * 4), { col: rnd() < .6 ? '#c8241f' : rnd() < .5 ? '#2a2c30' : '#b8bec6', s: .4 + rnd() });
    if (rnd() < .35 * r) fx.sparksAt(v3((rnd() - .5) * GAP, SHAFT_Y, (rnd() - .5) * car.T.L * .9), 3, 9);
    if (S.t - car.lastChew > (S.t > T.jerk ? .1 : .2) + rnd() * .14) { car.lastChew = S.t; ev('chew', { big: rnd() < .25 }); S.shake = Math.min(1, S.shake + .08); }
  }
  if (at(T.glass)) { car.glassBroken = true; car.glass.color.set('#9fb9cc'); car.glass.opacity = .45; ev('glass', {}); S.shake = 1; fx.burst('shard', v3(0, SHAFT_Y + .6, .4), 260, 9, 6, { spread: car.T.cl }); }
  if (at(T.glass + .8)) ev('roof', {});
  // фара — последней
  if (at(T.eaten)) { car.g.visible = false; light.visible = true; light.position.set(.05, SHAFT_Y + .14, 0); light.rotation.set(-.4, .3, .15); ev('lastLight', {}); }
  if (light.visible) { const u = clamp((S.t - T.eaten) / (T.lightOff - T.eaten)); light.position.y = SHAFT_Y + .14 - .5 * inQ(u); light.position.x = (rnd() - .5) * .04; light.rotation.z = .15 + (rnd() - .5) * .1;
    const on = u < .55 ? 1 : (Math.sin(S.t * 47) > .2 ? 1 : 0) * (1 - u); light.userData.lens.material.emissiveIntensity = 2.4 * on; light.userData.glow.intensity = 6 * on;
    if (u > .3 && rnd() < .2) fx.sparksAt(light.position.clone(), 2, 5); if (at(T.lightOff)) { light.visible = false; ev('lightOff', {}); } }
  if (!S.cta && S.t >= CTA_T0) { S.cta = 1; ev('cta'); } if (S.cta === 1 && S.t >= CTA_T0 + CTA_TAP * CTA_LEN) { S.cta = 2; ev('ctaTap'); }
  fx.step(DT, S.t, p => Math.abs(p.x) < PIT_W / 2 && Math.abs(p.z) < PIT_L / 2 ? -5 : 0); S.shake *= Math.pow(.03, DT);
}
// ---------- камера: смена ракурса каждые 2–4 с ----------
function shot(pos, look, fov) { cam.position.copy(pos); cam.lookAt(look); cam.fov = fov; }
function placeCamera(vt) {
  const t = S.t, w = vt * .2;
  if (t < T.hook) shot(v3(.15, 5.0, .9), v3(0, 0, -.3), 62);                                         // вид сверху в пасть
  else if (t < T.mirror - .4) { const u = k(T.hook, T.hook + 1.2); shot(v3(.15 + 3.4 * u, 5.0 + 2.5 * u, .9 + 8.3 * u), v3(0, HANG - 3 * (1 - u), 0), 62 - 12 * u); }   // подъём к магниту
  else if (t < T.lower) shot(v3(2.6, 3.6, 4.4), v3(.6, 1.6, .8), 46);                                    // макро у валов: зеркало
  else if (t < T.rest) shot(v3(4.6, 1.6, 6), v3(0, 3.6, 0), 50);                                      // снизу на опускающуюся машину
  else if (t < T.jam) shot(v3(3.8, 3.8, 1.6), v3(0, 1.2, -1.6), 50);                                  // зад касается зубьев
  else if (t < T.rev) shot(v3(2.6 + Math.sin(w) * .2, 3.6, 4.2), v3(0, 1.2, -1), 46);                  // заклинило
  else if (t < T.power) shot(v3(1.6, 3.4, 4.8), v3(0, 1.2, -.6), 46);                                 // реверс
  else if (t < T.glass - .3) shot(v3(3.2, 6.6, 7.4), v3(0, 1.1, 0), 50);                              // рывок
  else if (t < T.glass + 1.0) shot(v3(2.4, 3.3, 3.6), v3(0, 1.5, .3), 46);                            // стекло — slow-mo
  else if (t < T.glass + 3.5) shot(v3(4.6, 3.8, 5.6), v3(0, 1.1, 0), 50);                             // сбоку низко
  else if (t < T.eaten) shot(v3(.3, 8.6, 2.2), v3(0, 0, -.1), 52);                                    // сверху
  else if (t < T.lightOff + .3) shot(v3(1.2, 2.6, 2.0), v3(0, SHAFT_Y, 0), 44);                       // фара
  else shot(v3(.15, 5.0, .9), v3(0, 0, -.3), 62);                                                      // петля — тот же кадр, что в начале
  if (S.shake > .01) { cam.position.x += (rnd() - .5) * S.shake * .12; cam.position.y += (rnd() - .5) * S.shake * .1; }
  cam.updateProjectionMatrix();
}
let HOOK = 'ЗАКЛИНИТ?';
function drawHud(vt) {
  const ck = S.t >= CTA_T0 ? Math.min(1, (S.t - CTA_T0) / CTA_LEN) : -1, pw = Math.round(Math.abs(S.rpm) * 100);
  const key = [vt < 2, S.status, ck < 0 ? -1 : Math.round(ck * 200), Math.round(pw / 5)].join('|'); if (!hud.begin(key)) return;
  if (ck >= 0) { drawCta(hud.g, W, H, ck); return hud.end(); }
  if (vt < 2) hud.txt(HOOK, W / 2, 200, 130, '#ffd400');
  if (S.status) hud.txt(S.status, W / 2, 330, S.status.length > 10 ? 86 : 110, S.status === 'ЗАКЛИНИЛО!' ? '#ff2a2a' : '#ffd400');
  if (S.t > T.hook && S.t < T.eaten) hud.txt(`МОЩНОСТЬ: ${S.rpm < 0 ? '−' : ''}${pw}%`, W / 2, 1760, 78, pw === 0 ? '#ff2a2a' : pw > 100 ? '#ffb21f' : '#ffffff');
  hud.end();
}
window.SMASH = {
  init(cfg = {}) {
    rnd = R(cfg.seed || 7); if (cfg.hook) HOOK = cfg.hook;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(50, W / H, .05, 200);
    buildHall(scene, renderer, rnd); buildShredder(); buildCar(); fx = new Fx(scene, rnd, ev); hud = new Hud(); car.g.position.set(0, HANG, 0);
    return { simEnd: CTA_T0 + CTA_LEN, cars: 1 };
  },
  replayWin: { pre: .15, post: 1.1, rate: .3 }, replays() { return [{ t: T.glass, x: 0, z: 0, car: -1 }]; },   // живое slow-mo на взрыве стекла
  advance(simDt) { S.acc += simDt; while (S.acc >= DT) { step(); S.acc -= DT; } return S.t; },
  fastForward(t) { while (S.t < t) step(); },
  render(vt) { fx.sync(); placeCamera(vt); drawHud(vt); renderer.clear(); renderer.render(scene, cam); renderer.clearDepth(); renderer.render(hud.scene, hud.cam); },
  frameAudio() { return { eat: +S.eat.toFixed(2), rpm: +S.rpm.toFixed(2), silence: S.silence }; },
  get events() { return S.events; }, get t() { return S.t; }, get hits() { return S.t > T.eaten ? 1 : 0; },
};
