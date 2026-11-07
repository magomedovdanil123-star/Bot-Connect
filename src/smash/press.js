// «Гидропресс против машин: от малютки до гиганта» — залипалка 9:16. Машина заезжает под пресс, плита давит её в лепёшку.
// Деформация процедурная (вершины «как пластилин»), стекло, колёса и обломки — простая физика. API как у world.js: window.SMASH
import * as THREE from 'three';
import { W, H, v3, R, canvasTex, hazard, buildHall, carMesh, snapCar, deformCar, hash, Fx, Hud } from './industry.js';
import { drawCta, CTA_LEN, CTA_TAP } from './hudcta.js';

let rnd = R(7);
const DT = 1 / 240, BED = .6, RAM_UP = 11.5, BX = 3.1, BZ = 7.2;
const ROUNDS = [
  { type: 'hatch', s: .5, name: 'МАЛЮТКА', col: '#ff4fa3' }, { type: 'hatch', s: .75, name: 'КОМПАКТ', col: '#3fa05a' }, { type: 'sedan', s: 1, name: 'СЕДАН', col: '#2e7bd6' },
  { type: 'pickup', s: 1.2, name: 'ПИКАП', col: '#e0662b' }, { type: 'van', s: 1.4, name: 'ФУРГОН', col: '#e9e9ee' }, { type: 'bus', s: 1, name: 'АВТОБУС', col: '#f4c20d' }, { type: 'muscle', s: 2.1, name: 'ГИГАНТ', col: '#d83a34' },
];
const LEN = 6.2, SUMMARY = 1.6, T_IN = 1.1, T_FAST = 1.55, T_CRUSH = 4.5, T_HOLD = 4.9, T_UP = 5.6, T_OUT = 5.35;
const total = () => ROUNDS.length * LEN + SUMMARY + CTA_LEN;
let renderer, scene, cam, hud, fx, ram, rods = [], car = null;
const S = { t: 0, acc: 0, round: -1, events: [], crushed: 0, shake: 0, yRam: RAM_UP, force: 0, ramV: 0, drive: 0, cta: 0 };
const ev = (kind, d = {}) => S.events.push({ t: +S.t.toFixed(4), kind, ...d });
const ease = x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2, clamp = x => Math.max(0, Math.min(1, x));
const onBed = p => Math.abs(p.x) < BX && Math.abs(p.z) < BZ;

function buildPress() {
  const steel = new THREE.MeshStandardMaterial({ color: '#2c3036', metalness: .8, roughness: .4 }), yellow = new THREE.MeshStandardMaterial({ color: '#e8b21c', metalness: .3, roughness: .45 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#dfe4ea', metalness: 1, roughness: .12 });
  const stripe = canvasTex(1024, 64, (g, w, h) => hazard(g, 0, 0, w, h, 26));
  const bed = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + .4, BED, BZ * 2 + .4), steel); bed.position.y = BED / 2; bed.receiveShadow = true; bed.castShadow = true; scene.add(bed);
  const bedTop = new THREE.Mesh(new THREE.PlaneGeometry(BX * 2, BZ * 2), new THREE.MeshStandardMaterial({ color: '#3b3f46', metalness: .7, roughness: .55 })); bedTop.rotation.x = -Math.PI / 2; bedTop.position.y = BED + .002; bedTop.receiveShadow = true; scene.add(bedTop);
  const band = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + .42, .16, BZ * 2 + .42), new THREE.MeshStandardMaterial({ map: stripe })); band.position.y = BED - .1; scene.add(band);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(.48, .55, 15.5, 20), yellow); col.position.set(sx * (BX + .9), 7.75, sz * (BZ + .6)); col.castShadow = true; scene.add(col); }
  const head = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + 3, 1.8, BZ * 2 + 2.4), yellow); head.position.y = 15.5; head.castShadow = true; scene.add(head);
  ram = new THREE.Group(); scene.add(ram);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(BX * 2, 1.3, BZ * 2), steel); plate.position.y = .65; plate.castShadow = true; ram.add(plate);
  const face = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + .05, .3, BZ * 2 + .05), new THREE.MeshStandardMaterial({ map: canvasTex(2048, 64, (g, w, h) => hazard(g, 0, 0, w, h, 30)) })); face.position.y = .15; ram.add(face);
  for (const sz of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 1, 24), chrome); rod.position.set(0, 0, sz * BZ * .5); rod.castShadow = true; scene.add(rod); rods.push(rod);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 2.4, 24), steel); sleeve.position.set(0, 13.6, sz * BZ * .5); scene.add(sleeve); }
}
function placeRam() { ram.position.y = S.yRam; for (const r of rods) { const top = 14.6, bot = S.yRam + 1.3; r.scale.y = Math.max(.01, top - bot); r.position.y = (top + bot) / 2; } }

function startRound(r) {
  if (car) { scene.remove(car.g); car = null; } fx.clear(); S.round = r; S.force = 0;
  const R0 = ROUNDS[r]; car = carMesh(R0.type, R0.col); car.g.scale.setScalar(R0.s); car.g.position.set(0, BED, -28); scene.add(car.g);
  car.s = R0.s; car.popped = 0; car.glassBroken = false; car.c = 0; car.lastCreak = 0; car.done = false; car.crunch = 0;
  snapCar(car); ev('round', { round: r, name: R0.name, s: R0.s });
}
// давим: ram снизу на высоте hL (в единицах машины)
function crushTo(hL) {
  const top = car.top, c = clamp(1 - hL / top); if (c <= car.c + .002) return; car.c = c;
  deformCar(car, (x, y, z) => { if (y <= hL) return [x * (1 + .1 * c * y / top), y, z]; const k = y / top, y1 = y * hL / top, y2 = Math.min(y, hL); let ny = y1 * .45 + y2 * .55 - hash(x, y, z) * .1 * c * k; ny = Math.max(.02, Math.min(hL - .01, ny)); return [x * (1 + .24 * c * k) + (hash(z, x, y) - .5) * .06 * c, ny, z * (1 + .05 * c * k)]; });
  for (const wh of car.wheels) { wh.scale.y = 1 - .45 * c; wh.position.x = wh.userData.side * (car.T.Wd / 2 - .12 + .25 * c); wh.position.y = car.T.wr * (1 - .45 * c); }
}
function stepRound(lt) {
  const R0 = ROUNDS[S.round], s = R0.s, topW = BED + car.top * s, final = BED + Math.max(.32, car.top * s * .2);
  // въезд
  if (lt < T_IN) { const k = 1 - (1 - lt / T_IN) ** 3; car.g.position.z = -28 + 28 * k; S.drive = (1 - k) * 1.2; for (const w of car.wheels) w.children.forEach(m => { m.rotation.x += (1 - k) * .45; }); }
  else { car.g.position.z = lt > T_OUT ? -38 * ease(clamp((lt - T_OUT) / (LEN - T_OUT))) : 0; S.drive = 0; }
  // плита: быстро вниз → касание → медленно давит → пауза → вверх
  let y;
  if (lt < T_IN) y = RAM_UP;
  else if (lt < T_FAST) y = RAM_UP + (topW + .25 - RAM_UP) * (1 - (1 - (lt - T_IN) / (T_FAST - T_IN)) ** 2);
  else if (lt < T_CRUSH) { const k = (lt - T_FAST) / (T_CRUSH - T_FAST); y = topW + .25 - (topW + .25 - final) * (k < .08 ? k * k / .16 : (k - .04) / .96); }
  else if (lt < T_HOLD) y = final;
  else if (lt < T_UP) y = final + (RAM_UP - final) * ease((lt - T_HOLD) / (T_UP - T_HOLD));
  else y = RAM_UP;
  S.ramV = (y - S.yRam) / DT; S.yRam = y;
  if (S.yRam < topW && !car.done) {
    if (!car.contact) { car.contact = true; ev('contact', { s }); S.shake = Math.min(1, S.shake + .5); fx.puff(v3(0, topW, 0), 1.2 * s); }
    crushTo((S.yRam - BED) / s);
    const c = car.c; S.force = Math.round(20 + c * 480 * Math.sqrt(s));
    if (!car.glassBroken && c > .14) { car.glassBroken = true; car.glass.color.set('#9fb9cc'); car.glass.opacity = .55; car.glass.roughness = .5; ev('glass', { s }); S.shake = Math.min(1, S.shake + .4);
      for (const sd of [-1, 1]) fx.burst('shard', v3(sd * car.T.Wd * s * .45, S.yRam - .2, 0), Math.round(70 * Math.sqrt(s)), 8 * s, 3, { spread: car.T.L * s * .6, v: v3(sd * 4 * s, 0, 0) }); }
    if (car.popped < 2 && c > .42 + car.popped * .12) { const wh = car.wheels.find(w => w.parent && !w.userData.pop && (car.popped === 0 ? w.position.z > 0 && w.userData.side < 0 : w.position.z < 0 && w.userData.side > 0)); if (wh) { wh.userData.pop = true; car.g.remove(wh); const p = wh.position.clone().multiplyScalar(s).add(car.g.position); fx.add('wheel', p, v3(wh.userData.side * (6 + rnd() * 3), 3 + rnd() * 2, (rnd() - .5) * 3), { s: car.T.wr * s }); ev('pop', { side: wh.userData.side, s }); S.shake = Math.min(1, S.shake + .35); } car.popped++; }
    if (lt - car.lastCreak > .28 + rnd() * .2) { car.lastCreak = lt; ev('creak', { c: +c.toFixed(2), s }); }
    if (car.crunch < 3 && c > [.3, .55, .75][car.crunch]) { car.crunch++; ev('crunch', { c: +c.toFixed(2), s }); fx.burst('chunk', v3(0, S.yRam - .2, 0), 10, 7 * s, 3, { spread: car.T.L * s * .7, col: R0.col }); S.shake = Math.min(1, S.shake + .3); }
    if (rnd() < .5) { const sd = rnd() < .5 ? -1 : 1; fx.sparksAt(v3(sd * car.T.Wd * s * (.5 + .2 * car.c), S.yRam, (rnd() - .5) * car.T.L * s), 2, 9); }
    if (lt >= T_CRUSH - .02) { car.done = true; S.crushed++; ev('bottom', { s }); S.shake = Math.min(1, S.shake + .6); fx.puff(v3(0, BED + .3, 0), 1.6 * s); }
  } else S.force = car.done ? S.force : 0;
  if (lt >= T_HOLD && lt - DT < T_HOLD) ev('ramUp', {});
  if (lt >= T_IN && lt - DT < T_IN) ev('ramDown', {});
  if (lt >= T_OUT && lt - DT < T_OUT) ev('drag', { s });
}
function step() {
  S.t += DT; const r = Math.floor(S.t / LEN), lt = S.t - r * LEN;
  if (r < ROUNDS.length) { if (r !== S.round) startRound(r); stepRound(lt); }
  else if (car && S.round < ROUNDS.length) { S.round = ROUNDS.length; ev('outro', { total: S.crushed }); }
  const ctaT0 = ROUNDS.length * LEN + SUMMARY;
  if (!S.cta && S.t >= ctaT0) { S.cta = 1; ev('cta'); } if (S.cta === 1 && S.t >= ctaT0 + CTA_TAP * CTA_LEN) { S.cta = 2; ev('ctaTap'); }
  fx.step(DT, S.t, p => onBed(p) ? BED : 0); S.shake *= Math.pow(.02, DT);
}

function placeCamera(vt) {
  const r = Math.min(S.round, ROUNDS.length - 1), R0 = ROUNDS[r], lt = S.t - r * LEN, h = car ? car.top * R0.s : 2, size = car ? Math.max(car.T.L * R0.s / 4.5, h / 1.6) : 1;
  const push = lt > T_FAST && lt < T_HOLD ? .12 * ease(clamp((lt - T_FAST) / (T_HOLD - T_FAST))) : 0, k = vt * .15;
  const z = BZ + 2.4 + 2.2 * size, fov = Math.max(26, Math.min(54, (22 + 15 * size) * (1 - push)));
  // камера всегда ниже кромки плиты — иначе плита закрывает машину
  const cy = Math.max(BED + .14, Math.min(BED + .35 + .75 * h, S.yRam - .1)), ly = BED + Math.max(.08, Math.min(h * .62, (S.yRam - BED) * .45));
  cam.position.set(.9 + Math.sin(k) * .35, cy, z); cam.lookAt(0, ly, 0); cam.fov = fov;
  if (S.shake > .01) { cam.position.x += (rnd() - .5) * S.shake * .12; cam.position.y += (rnd() - .5) * S.shake * .1; }
  cam.updateProjectionMatrix();
}
let HOOK = 'КТО ВЫДЕРЖИТ ПРЕСС?';
function drawHud(vt) {
  const r = Math.floor(S.t / LEN), ctaT0 = ROUNDS.length * LEN + SUMMARY, ck = S.t >= ctaT0 ? Math.min(1, (S.t - ctaT0) / CTA_LEN) : -1, lt = S.t - r * LEN;
  const key = [r, Math.round(S.force / 10), vt < 2, ck < 0 ? -1 : Math.round(ck * 200), S.crushed, lt < 1.6].join('|'); if (!hud.begin(key)) return;
  const g = hud.g;
  if (ck >= 0) { hud.txt(`РАЗДАВЛЕНО: ${S.crushed}`, W / 2, 170, 80, '#ffffff'); drawCta(g, W, H, ck); return hud.end(); }
  if (r >= ROUNDS.length) { hud.txt('ВСЕ 7', W / 2, 780, 150, '#ffd400'); hud.txt('В ЛЕПЁШКУ', W / 2, 930, 130, '#ffffff'); return hud.end(); }
  const R0 = ROUNDS[r];
  if (vt < 2) hud.txt(HOOK, W / 2, 190, 100, '#ffd400');
  else hud.txt(`РАЗДАВЛЕНО: ${S.crushed} / ${ROUNDS.length}`, W / 2, 160, 72, '#ffffff');
  hud.txt(`${R0.name} ×${String(R0.s).replace('.', ',')}`, W / 2, vt < 2 ? 320 : 280, 96, R0.col === '#e9e9ee' ? '#ffffff' : '#ffd400');
  if (S.force > 0) hud.txt(`СИЛА: ${S.force} т`, W / 2, 1760, 84, '#ff3b4a');
  hud.end();
}

window.SMASH = {
  init(cfg = {}) {
    rnd = R(cfg.seed || 7); if (cfg.hook) HOOK = cfg.hook;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(50, W / H, .1, 200);
    buildHall(scene, renderer, rnd); buildPress(); placeRam(); fx = new Fx(scene, rnd, ev); hud = new Hud();
    return { simEnd: total(), cars: ROUNDS.length };
  },
  replayWin: { pre: .1, post: .5, rate: 1 }, replays() { return []; },
  advance(simDt) { S.acc += simDt; while (S.acc >= DT) { step(); S.acc -= DT; } return S.t; },
  fastForward(t) { while (S.t < t) step(); },
  render(vt, slow, dtv) { placeRam(); fx.sync(); placeCamera(vt); drawHud(vt); renderer.clear(); renderer.render(scene, cam); renderer.clearDepth(); renderer.render(hud.scene, hud.cam); },
  frameAudio() { return { ramV: +S.ramV.toFixed(2), force: S.force, crushing: !!(car && car.contact && !car.done), drive: +S.drive.toFixed(2), s: car ? car.s : 1 }; },
  get events() { return S.events; }, get t() { return S.t; }, get hits() { return S.crushed; },
};
