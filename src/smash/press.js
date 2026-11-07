// «Гидропресс против машин: от крошки до ГИГАНТА (последняя сопротивлялась)» — залипалка 9:16 по раскадровке с ожиданием:
// хук — плита висит в 1 см над крошкой; эскалация; пикап трескается ДО касания; автобус держит и лопается окнами по очереди;
// гигант стопорит пресс → тишина → рвётся шланг → плита проваливается в замедлении; колпак катится в камеру. API: window.SMASH
import * as THREE from 'three';
import { W, H, v3, R, canvasTex, hazard, buildHall, carMesh, snapCar, deformCar, hash, Fx, Hud } from './industry.js';
import { drawCta, CTA_LEN, CTA_TAP } from './hudcta.js';

let rnd = R(7);
const DT = 1 / 240, BED = .6, RAM_UP = 11.5, BX = 3.1, BZ = 7.2;
const CARS = [
  { type: 'hatch', s: .5, name: 'КРОШКА', col: '#ff4fa3', mode: 'hover', len: 3.0 },
  { type: 'sedan', s: 1, name: 'СЕДАН', col: '#2e7bd6', mode: 'quick', len: 3.9, tin: .6 },
  { type: 'pickup', s: 1.2, name: 'ПИКАП', col: '#e0662b', mode: 'stop', len: 4.7, tin: .6 },
  { type: 'bus', s: 1, name: 'АВТОБУС', col: '#f4c20d', mode: 'stall', len: 6.6, tin: .9 },
  { type: 'muscle', s: 2.3, name: 'ГИГАНТ', col: '#d83a34', mode: 'strain', len: 10.2, tin: 1.1 },
];
const START = []; { let t = 0; for (const c of CARS) { START.push(t); t += c.len; } }
const ROUNDS_END = START.at(-1) + CARS.at(-1).len, CTA_T0 = ROUNDS_END + .2;
// гигант: вход 1.1 → касание 1.6 → стоп и вибрация до 4.0 → тишина до 4.4 → шланг рвётся, плита проваливается до 6.0 → вверх 6.6–7.6 → колпак 7.7–9.7
const G = { contact: 1.6, strainEnd: 4.0, hose: 4.4, flat: 6.0, upAt: 6.6, upEnd: 7.6, cap: 7.7 };
const HOSE_T = START[4] + G.hose;
let renderer, scene, cam, hud, fx, ram, rods = [], cols = [], hose, cap, car = null, crackTex = [];
const S = { t: 0, acc: 0, i: -1, events: [], crushed: 0, shake: 0, yRam: RAM_UP, force: 0, ramV: 0, drive: 0, cta: 0, strain: 0, silence: 0, capRoll: 0 };
const ev = (kind, d = {}) => S.events.push({ t: +S.t.toFixed(4), kind, ...d });
const ease = x => x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2, clamp = x => Math.max(0, Math.min(1, x)), inQ = x => x * x, outQ = x => 1 - (1 - x) ** 2;
const onBed = p => Math.abs(p.x) < BX && Math.abs(p.z) < BZ;
const at = (lt, t) => lt >= t && lt - DT < t;   // событие ровно в момент t

function buildPress() {
  const steel = new THREE.MeshStandardMaterial({ color: '#2c3036', metalness: .8, roughness: .4 }), yellow = new THREE.MeshStandardMaterial({ color: '#e8b21c', metalness: .3, roughness: .45 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#dfe4ea', metalness: 1, roughness: .12 });
  const stripe = canvasTex(1024, 64, (g, w, h) => hazard(g, 0, 0, w, h, 26));
  const bed = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + .4, BED, BZ * 2 + .4), steel); bed.position.y = BED / 2; bed.receiveShadow = bed.castShadow = true; scene.add(bed);
  const bedTop = new THREE.Mesh(new THREE.PlaneGeometry(BX * 2, BZ * 2), new THREE.MeshStandardMaterial({ color: '#3b3f46', metalness: .7, roughness: .55 })); bedTop.rotation.x = -Math.PI / 2; bedTop.position.y = BED + .002; bedTop.receiveShadow = true; scene.add(bedTop);
  const band = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + .42, .16, BZ * 2 + .42), new THREE.MeshStandardMaterial({ map: stripe })); band.position.y = BED - .1; scene.add(band);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const col = new THREE.Mesh(new THREE.CylinderGeometry(.48, .55, 15.5, 20), yellow); col.position.set(sx * (BX + .9), 7.75, sz * (BZ + .6)); col.castShadow = true; col.userData.x0 = col.position.x; scene.add(col); cols.push(col); }
  const head = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + 3, 1.8, BZ * 2 + 2.4), yellow); head.position.y = 15.5; head.castShadow = true; scene.add(head);
  ram = new THREE.Group(); scene.add(ram);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(BX * 2, 1.3, BZ * 2), steel); plate.position.y = .65; plate.castShadow = true; ram.add(plate);
  const face = new THREE.Mesh(new THREE.BoxGeometry(BX * 2 + .05, .3, BZ * 2 + .05), new THREE.MeshStandardMaterial({ map: canvasTex(2048, 64, (g, w, h) => hazard(g, 0, 0, w, h, 30)) })); face.position.y = .15; ram.add(face);
  for (const sz of [-1, 1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, 1, 24), chrome); rod.position.set(0, 0, sz * BZ * .5); rod.castShadow = true; scene.add(rod); rods.push(rod);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.7, .7, 2.4, 24), steel); sleeve.position.set(0, 13.6, sz * BZ * .5); scene.add(sleeve); }
  hose = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, 1, 10), new THREE.MeshStandardMaterial({ color: '#111', roughness: .6 })); hose.position.x = BX + .2; scene.add(hose);
  for (const n of [7, 22]) crackTex.push(canvasTex(512, 256, (g, w, h) => { g.fillStyle = '#9fb7c8'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2; const cx = w * .45, cy = h * .45;
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + rnd() * .3; let x = cx, y = cy; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += Math.cos(a + (rnd() - .5) * .5) * (20 + rnd() * 40); y += Math.sin(a + (rnd() - .5) * .5) * (14 + rnd() * 26); g.lineTo(x, y); } g.stroke(); }
    for (let r = 18; r < 140; r += 26 + rnd() * 16) { g.beginPath(); g.ellipse(cx, cy, r * 1.4, r, 0, 0, 7); g.globalAlpha = .55; g.stroke(); g.globalAlpha = 1; } }));
  cap = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, .1, 28), new THREE.MeshStandardMaterial({ color: '#d7dce2', metalness: 1, roughness: .18 })); cap.visible = false; cap.castShadow = true; scene.add(cap);
}
function placeRam() {
  ram.position.y = S.yRam; for (const r of rods) { const top = 14.6, bot = S.yRam + 1.3; r.scale.y = Math.max(.01, top - bot); r.position.y = (top + bot) / 2; }
  if (!hose.userData.burst) { const top = 14.6, bot = S.yRam + 1.1; hose.scale.y = Math.max(.01, top - bot); hose.position.y = (top + bot) / 2; hose.rotation.z = 0; hose.position.x = BX + .2; }
  else { const k = clamp((S.t - hose.userData.burst) * 2); hose.scale.y = 2.8; hose.position.y = 12.4; hose.rotation.z = -.9 * k + Math.sin(S.t * 18) * .25 * (1 - k * .6); hose.position.x = BX + .2 + 1.2 * k; }
  const vib = S.strain * .05; for (const c of cols) c.position.x = c.userData.x0 + Math.sin(S.t * 90 + c.userData.x0) * vib;
}
function startCar(i) {
  if (car) { scene.remove(car.g); car = null; } fx.clear(); S.i = i;
  const C = CARS[i]; car = carMesh(C.type, C.col); car.g.scale.setScalar(C.s); car.g.position.set(0, BED, C.mode === 'hover' ? 0 : -28); scene.add(car.g);
  Object.assign(car, { s: C.s, C, c: 0, popped: 0, glassBroken: false, lastCreak: 0, crunch: 0, done: false, contact: false, panes: 0 });
  snapCar(car); ev('round', { i, name: C.name, s: C.s });
}
function crushTo(hL) {
  const top = car.top, c = clamp(1 - hL / top); if (c <= car.c + .002) return; car.c = c;
  deformCar(car, (x, y, z) => { if (y <= hL) return [x * (1 + .1 * c * y / top), y, z]; const k = y / top, y1 = y * hL / top, y2 = Math.min(y, hL); let ny = y1 * .45 + y2 * .55 - hash(x, y, z) * .1 * c * k; ny = Math.max(.02, Math.min(hL - .01, ny)); return [x * (1 + .24 * c * k) + (hash(z, x, y) - .5) * .06 * c, ny, z * (1 + .05 * c * k)]; });
  for (const wh of car.wheels) { wh.scale.y = 1 - .45 * c; wh.position.x = wh.userData.side * (car.T.Wd / 2 - .12 + .25 * c); wh.position.y = car.T.wr * (1 - .45 * c); }
}
function shatter(n = 80) { const s = car.s; car.glassBroken = true; car.glass.map = null; car.glass.color.set('#9fb9cc'); car.glass.opacity = .5; car.glass.roughness = .5; car.glass.needsUpdate = true; ev('glass', { s });
  S.shake = Math.min(1, S.shake + .4); for (const sd of [-1, 1]) fx.burst('shard', v3(sd * car.T.Wd * s * .45, BED + car.top * s * .8, car.T.co * s), Math.round(n * Math.sqrt(s)), 8 * s, 3, { spread: car.T.cl * s, v: v3(sd * 4 * s, 0, 0) }); }
function popWheel(k) { const s = car.s, list = car.wheels.filter(w => w.parent === car.g); if (!list.length) return; const wh = list[k % list.length]; car.g.remove(wh);
  fx.add('wheel', wh.position.clone().multiplyScalar(s).add(car.g.position), v3(wh.userData.side * (5 + rnd() * 3), 3 + rnd() * 2, (rnd() - .5) * 3), { s: car.T.wr * s }); ev('pop', { s }); S.shake = Math.min(1, S.shake + .35); }
function crunchFx() { const s = car.s; car.crunch++; ev('crunch', { c: +car.c.toFixed(2), s }); fx.burst('chunk', v3(0, S.yRam - .2, 0), 10, 7 * s, 3, { spread: car.T.L * s * .7, col: car.C.col }); S.shake = Math.min(1, S.shake + .3); }

// путь плиты: ct — касание крыши, final — лепёшка
function ramPath(C, lt, top, final) {
  const U = RAM_UP, ct = top + .004, k = (a, b, f = ease) => f(clamp((lt - a) / (b - a)));
  if (C.mode === 'hover') { if (lt < 1.5) return ct + .01 * C.s + Math.sin(lt * 40) * .003; if (lt < 2.3) return ct - (ct - final) * k(1.5, 2.3, inQ); if (lt < 2.5) return final; return final + (U - final) * k(2.5, 3.0); }
  if (C.mode === 'quick') { const a = C.tin, crush = 1.9; if (lt < a) return U; if (lt < a + .35) return U + (ct + .15 - U) * k(a, a + .35, outQ); if (lt < a + .45) return ct + .15 - .15 * k(a + .35, a + .45); if (lt < a + .45 + crush) return ct - (ct - final) * k(a + .45, a + .45 + crush, inQ); if (lt < a + .6 + crush) return final; return final + (U - final) * k(a + .6 + crush, a + 1.0 + crush); }
  if (C.mode === 'stop') { const a = C.tin; if (lt < a) return U; if (lt < a + .4) return U + (ct + .001 - U) * k(a, a + .4, outQ); if (lt < a + 2.0) return ct + .001 + Math.sin(lt * 50) * .0015; if (lt < a + 3.1) return ct - (ct - final) * k(a + 2.0, a + 3.1, inQ); if (lt < a + 3.3) return final; return final + (U - final) * k(a + 3.3, a + 3.8); }
  if (C.mode === 'stall') { const a = C.tin, h = ct - final, st = [[a + .6, 0], [a + 1.2, .1], [a + 1.9, .1], [a + 2.4, .22], [a + 3.6, .22], [a + 3.95, 1]];
    if (lt < a) return U; if (lt < a + .6) return U + (ct - U) * k(a, a + .6, outQ);
    for (let j = 1; j < st.length; j++) if (lt < st[j][0]) return ct - h * (st[j - 1][1] + (st[j][1] - st[j - 1][1]) * k(st[j - 1][0], st[j][0], j === st.length - 1 ? inQ : ease));
    if (lt < a + 4.3) return final; return final + (U - final) * k(a + 4.3, a + 4.9); }
  if (lt < C.tin) return U; if (lt < G.contact) return U + (ct - U) * k(C.tin, G.contact, outQ);
  if (lt < G.hose) return ct - .04 * k(G.contact, G.strainEnd) + Math.sin(lt * 70) * .004 * k(G.contact, G.strainEnd);
  if (lt < G.flat) return ct - .04 - (ct - .04 - final) * k(G.hose, G.flat, inQ); if (lt < G.upAt) return final; if (lt < G.upEnd) return final + (U - final) * k(G.upAt, G.upEnd); return U;
}
function stepCar(lt) {
  const C = CARS[S.i], s = C.s, top = BED + car.top * s, final = BED + Math.max(.3, car.top * s * .18);
  if (C.mode !== 'hover' && lt < C.tin) { const k = 1 - (1 - lt / C.tin) ** 3; car.g.position.z = -28 + 28 * k; S.drive = (1 - k) * 1.2; for (const w of car.wheels) w.children.forEach(m => { m.rotation.x += (1 - k) * .45; }); if (at(lt, .02)) ev('drive', { s }); }
  else S.drive = 0;
  const outAt = C.mode === 'strain' ? 99 : C.len - .45; if (lt > outAt) car.g.position.z = -34 * inQ(clamp((lt - outAt) / .45));
  if (at(lt, outAt)) ev('drag', { s });
  const y = ramPath(C, lt, top, final); S.ramV = (y - S.yRam) / DT; S.yRam = y;
  if (C.mode !== 'hover' && at(lt, C.tin)) ev('ramDown', {});
  if (C.mode === 'hover' && at(lt, .3)) ev('tremble', {});
  if (C.mode === 'stop') { const a = C.tin; if (at(lt, a + .5)) ev('creak', { c: .2, s });
    if (at(lt, a + .8)) { car.glass.map = crackTex[0]; car.glass.color.set('#ffffff'); car.glass.needsUpdate = true; ev('crack', { n: 1 }); S.shake += .1; }
    if (at(lt, a + 1.3)) { car.glass.map = crackTex[1]; car.glass.needsUpdate = true; ev('crack', { n: 2 }); S.shake += .15; }
    if (at(lt, a + 1.55)) ev('creak', { c: .4, s }); S.silence = lt > a + 1.75 && lt < a + 2.0 ? 1 : 0; }
  if (C.mode === 'strain') { S.strain = lt > G.contact && lt < G.hose ? .3 + .7 * clamp((lt - G.contact) / (G.strainEnd - G.contact)) : 0; S.silence = lt > G.strainEnd && lt < G.hose ? 1 : 0;
    if (at(lt, G.contact + .05)) ev('strain', {}); if (at(lt, G.strainEnd)) ev('silence', {});
    if (at(lt, G.hose)) { hose.userData.burst = S.t; ev('hose', {}); S.shake = 1; fx.burst('chunk', v3(BX + .3, 9.5, 0), 90, 6, 6, { spread: .4, col: '#20160a', s: .25, v: v3(3, 2, 0) }); fx.puff(v3(BX + .3, 9.5, 0), 1.4); }
    if (lt > G.contact + .4 && lt < G.strainEnd && rnd() < .25) fx.sparksAt(v3((rnd() < .5 ? -1 : 1) * car.T.Wd * s * .5, S.yRam, (rnd() - .5) * car.T.L * s), 2, 6);
    if (lt > G.contact + .3 && lt < G.strainEnd && lt - (car.lastStrainCreak || 0) > .45) { car.lastStrainCreak = lt; ev('creak', { c: .3 + S.strain * .5, s }); }
  }
  if (S.yRam < top - .001 && !car.done) {
    if (!car.contact) { car.contact = true; ev('contact', { s }); S.shake = Math.min(1, S.shake + .4); fx.puff(v3(0, top, 0), 1.1 * s); }
    crushTo((S.yRam - BED) / s); const c = car.c;
    S.force = Math.round((C.mode === 'strain' ? 300 : 30) + c * 520 * Math.sqrt(s) + S.strain * 900);
    if (!car.glassBroken && c > (C.mode === 'stop' ? .02 : C.mode === 'strain' ? .06 : .14)) shatter(C.mode === 'strain' ? 160 : 80);
    if (C.mode === 'stall' && car.panes < 6 && lt > C.tin + 1.2 + car.panes * .38) { const z = (car.T.L / 2 - 1 - car.panes * (car.T.L - 2) / 5) * s, sd = car.panes % 2 ? -1 : 1; fx.burst('shard', v3(sd * car.T.Wd * .5, BED + car.top * .75, z), 50, 6, 3, { spread: 1.2, v: v3(sd * 4, 0, 0) }); fx.sparksAt(v3(car.T.Wd * .5, BED + car.top * .9, z), 8, 8); ev('pane', { k: car.panes }); car.panes++; }
    const pops = C.mode === 'strain' ? 4 : C.mode === 'quick' && C.type === 'hatch' ? 0 : 1, popAt = C.mode === 'strain' ? [.2, .32, .44, .56] : [.45];
    if (car.popped < pops && c > popAt[car.popped]) popWheel(car.popped++);
    if (lt - car.lastCreak > (C.mode === 'strain' ? .22 : .3) + rnd() * .2 && C.mode !== 'hover' && c > .02) { car.lastCreak = lt; ev('creak', { c: +c.toFixed(2), s }); }
    const cr = C.mode === 'stall' ? [.08, .2, .6] : C.mode === 'strain' ? [.15, .4, .7] : [.4]; if (car.crunch < cr.length && c > cr[car.crunch]) crunchFx();
    if (rnd() < .45 && c > .03) { const sd = rnd() < .5 ? -1 : 1; fx.sparksAt(v3(sd * car.T.Wd * s * (.5 + .2 * c), S.yRam, (rnd() - .5) * car.T.L * s), 2, 9); }
    if (S.yRam <= final + .002) { car.done = true; S.crushed++; ev('bottom', { s }); S.shake = Math.min(1, S.shake + .6); fx.puff(v3(0, BED + .3, 0), 1.5 * s); }
  } else if (!car.done) S.force = 0;
  if (C.mode !== 'strain' && at(lt, C.len - .9)) ev('ramUp', {});
  if (C.mode === 'strain') { if (at(lt, G.upAt)) ev('ramUp', {});
    if (lt >= G.cap) { const u = clamp((lt - G.cap) / 2.0); if (!cap.visible) { cap.visible = true; ev('capRoll', {}); }
      const z = 3.8 + 5.4 * outQ(Math.min(1, u * 1.15)), fall = clamp((u - .78) / .22), base = z < BZ ? BED : 0;
      cap.position.set(.6 + Math.sin(u * 9) * .15 * (1 - u), base + .5 * (1 - fall) + .05, z); cap.rotation.set(Math.PI / 2 * (1 - fall), 0, Math.sin(u * 20) * .2 * (1 - u));
      S.capRoll = u < 1 ? 1 - u : 0; if (at(lt, G.cap + 1.95)) ev('capFlat', {}); }
  }
}
function step() {
  S.t += DT; let i = 0; while (i < CARS.length && S.t >= START[i] + CARS[i].len) i++;
  if (i < CARS.length) { if (i !== S.i) startCar(i); stepCar(S.t - START[i]); }
  else if (S.i < CARS.length) { S.i = CARS.length; S.force = 0; S.strain = 0; S.capRoll = 0; ev('outro', { total: S.crushed }); }
  if (!S.cta && S.t >= CTA_T0) { S.cta = 1; ev('cta'); } if (S.cta === 1 && S.t >= CTA_T0 + CTA_TAP * CTA_LEN) { S.cta = 2; ev('ctaTap'); }
  fx.step(DT, S.t, p => onBed(p) ? BED : 0); S.shake *= Math.pow(.03, DT);
}

// ---------- камера: свой ракурс на каждый этап, смена каждые 2–4 с ----------
function shot(pos, look, fov) { cam.position.copy(pos); cam.lookAt(look); cam.fov = fov; }
function placeCamera(vt) {
  const i = Math.min(S.i, CARS.length - 1), C = CARS[i], lt = S.t - START[i], s = C.s, h = car ? car.top * s : 2, w = vt * .2;
  const under = y => Math.min(y, S.yRam - .08);
  if (C.mode === 'hover') { if (lt < 1.6) shot(v3(1.5 + lt * .05, under(BED + h * .92), 2.3), v3(0, BED + h * .85, 0), 36); else shot(v3(.6, under(BED + .55), 3.6), v3(0, BED + .3, 0), 40); }
  else if (C.mode === 'quick' && false) shot(v3(3.8 + Math.sin(w) * .5, under(BED + 1.3), 4.6), v3(0, BED + .35, 0), 44);
  else if (C.mode === 'quick') shot(v3(BX + 3.2, under(BED + 1.0), 2.6), v3(0, BED + .5, 0), 46);
  else if (C.mode === 'stop') { const a = C.tin; if (lt < a + 2.0) shot(v3(BX + 4.4, under(BED + h * .8), 5.2), v3(0, BED + h * .7, .8), 46); else shot(v3(1.0, under(BED + .9), BZ + 5.5), v3(0, BED + .6, 0), 36); }
  else if (C.mode === 'stall') { const a = C.tin, u = clamp((lt - a - .6) / 3.3); if (lt < a + .6) shot(v3(5.5, under(BED + 2.4), 11), v3(0, BED + 1.4, 0), 46); else if (lt < a + 3.9) shot(v3(BX + 4.8, under(BED + h * .6), 6 - 11 * u), v3(0, BED + h * .5, 2.5 - 9 * u), 50); else shot(v3(7.5, under(BED + 1.8), 10), v3(0, BED + .6, 0), 48); }
  else {
    if (lt < G.contact) shot(v3(1.2 + Math.sin(w) * .3, 4.8, 18.5), v3(0, 5, 0), 52);
    else if (lt < G.hose) { const u = clamp((lt - G.contact) / (G.hose - G.contact)); shot(v3(1.2 - .2 * u, 4.8 - 1.2 * u, 18.5 - 4 * u), v3(0, 5 - .8 * u, 0), 52 - 8 * u); }
    else if (lt < G.hose + .45) shot(v3(BX + 2.2, 9.0, 5), v3(BX + .2, 9.6, 0), 42);
    else if (lt < G.hose + 1.0) shot(v3(BX + 2.6, under(BED + h * .7), 3.6), v3(0, BED + h * .65, 1.2), 40);
    else if (lt < G.flat) shot(v3(BX + 4.2, under(BED + 1.6), 8), v3(0, BED + .6, 0), 46);
    else if (lt < G.cap) shot(v3(1.2, BED + .9, BZ + 6), v3(0, BED + .3, 0), 42);
    else shot(v3(1.4, .7, BZ + 7), v3(.6, .3, BZ + 1), 40);
  }
  if (S.shake > .01) { cam.position.x += (rnd() - .5) * S.shake * .1; cam.position.y += (rnd() - .5) * S.shake * .08; }
  cam.updateProjectionMatrix();
}
let HOOK = 'ВЫДЕРЖИТ?';
function drawHud(vt) {
  const ck = S.t >= CTA_T0 ? Math.min(1, (S.t - CTA_T0) / CTA_LEN) : -1, i = Math.min(S.i, CARS.length);
  const key = [i, Math.round(S.force / 20), vt < 2, ck < 0 ? -1 : Math.round(ck * 200), S.crushed].join('|'); if (!hud.begin(key)) return;
  if (ck >= 0) { hud.txt(`РАЗДАВЛЕНО: ${S.crushed}`, W / 2, 170, 80, '#ffffff'); drawCta(hud.g, W, H, ck); return hud.end(); }
  if (i >= CARS.length) return hud.end();
  const C = CARS[i];
  if (vt < 2) hud.txt(HOOK, W / 2, 200, 130, '#ffd400'); else { hud.txt(`РАЗДАВЛЕНО: ${S.crushed} / ${CARS.length}`, W / 2, 160, 70, '#ffffff'); hud.txt(`${C.name} ×${String(C.s).replace('.', ',')}`, W / 2, 270, 92, '#ffd400'); }
  if (S.force > 0) hud.txt(`СИЛА: ${S.force} т`, W / 2, 1760, 84, S.force > 1000 ? '#ff2a2a' : '#ffb21f');
  hud.end();
}
window.SMASH = {
  init(cfg = {}) {
    rnd = R(cfg.seed || 7); if (cfg.hook) HOOK = cfg.hook;
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.autoClear = false;
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(50, W / H, .05, 200);
    buildHall(scene, renderer, rnd); buildPress(); placeRam(); fx = new Fx(scene, rnd, ev); hud = new Hud();
    return { simEnd: CTA_T0 + CTA_LEN, cars: CARS.length };
  },
  // замедление — живое slow-mo кульминации гиганта (шланг → провал плиты), без надписи «повтор»
  replayWin: { pre: .05, post: 1.7, rate: .3 }, replays() { return [{ t: HOSE_T, x: 0, z: 0, car: -1 }]; },
  advance(simDt) { S.acc += simDt; while (S.acc >= DT) { step(); S.acc -= DT; } return S.t; },
  fastForward(t) { while (S.t < t) step(); },
  render(vt) { placeRam(); fx.sync(); placeCamera(vt); drawHud(vt); renderer.clear(); renderer.render(scene, cam); renderer.clearDepth(); renderer.render(hud.scene, hud.cam); },
  frameAudio() { return { ramV: +S.ramV.toFixed(2), force: S.force, crushing: !!(car && car.contact && !car.done), drive: +S.drive.toFixed(2), s: car ? car.s : 1, strain: +S.strain.toFixed(2), silence: S.silence, cap: +S.capRoll.toFixed(2) }; },
  get events() { return S.events; }, get t() { return S.t; }, get hits() { return S.crushed; },
};
