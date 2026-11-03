/* «Сколько нужно?» 3D — мир выпуска «Дом на шариках». three.js (MIT, vendor), рендер кадр за кадром: window.grab(f) → jpeg.
 * Сцена одна на весь ролик: холмы, дом с открывающейся дверью и комнатой внутри, облако шариков, Толик, реквизит для сравнений.
 * Каждая фраза = «план»: функция SHOTS[shot](u, o, st) двигает камеру (облёт, пролёт в дверь, наезд на шарик) и меняет состояние мира.
 * Поверх — 2D-слой: крупные цифры, плашки, субтитры (window.EP.caps). */
import * as T from 'three';

const EP = window.EP, PH = EP.PH, FPS = EP.fps || 24, W = EP.w || 1920, H = EP.h || 1080;
const gl = document.getElementById('gl'), out = document.getElementById('out'), X = out.getContext('2d');
const R = new T.WebGLRenderer({ canvas: gl, antialias: true, preserveDrawingBuffer: true });
R.setSize(W, H, false); R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.05; R.outputColorSpace = T.SRGBColorSpace;
const scene = new T.Scene(), cam = new T.PerspectiveCamera(45, W / H, .1, 4000);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, sm = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const eo = (k) => 1 - (1 - clamp(k, 0, 1)) ** 3, ei = (k) => clamp(k, 0, 1) ** 3, prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
let seed = 1; const rnd = (s) => { if (s != null) { seed = ((s * 2654435761) >>> 0) % 2147483646 + 1; for (let k = 0; k < 4; k++) seed = (seed * 48271) % 2147483647; } seed = (seed * 48271) % 2147483647; return seed / 2147483647; };   // засев перемешан: соседние номера не дают «столбов»
const V3 = (x, y, z) => new T.Vector3(x, y, z);

/* ---------------- небо, свет, земля */
const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 512; const skyT = new T.CanvasTexture(skyC); skyT.colorSpace = T.SRGBColorSpace; scene.background = skyT;
function paintSky(k) { // k: 0 — день, 1 — высоко (тёмно-синий), n — ночь (таймлапс)
  const g = skyC.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512), top = new T.Color('#3d8ff0').lerp(new T.Color('#0a1840'), k), mid = new T.Color('#9fd3ff').lerp(new T.Color('#3a6fc0'), k), bot = new T.Color('#ffe7c4').lerp(new T.Color('#9cc4f0'), k);
  gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(.62, '#' + mid.getHexString()); gr.addColorStop(1, '#' + bot.getHexString()); g.fillStyle = gr; g.fillRect(0, 0, 4, 512); skyT.needsUpdate = true;
}
paintSky(0); scene.fog = new T.Fog(0xcfe8ff, 120, 900);
const hemi = new T.HemisphereLight(0xe6f3ff, 0x7cbf6a, 1.25); scene.add(hemi);
const sun = new T.DirectionalLight(0xfff0d8, 2.7); sun.position.set(30, 60, 25); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -40, near: 1, far: 200 }); sun.shadow.bias = -.0005; scene.add(sun, sun.target);
const M = (c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: .7, ...o });
const mesh = (geo, mat, x = 0, y = 0, z = 0, par = scene, sh = true) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; m.receiveShadow = true; par.add(m); return m; };

const world = new T.Group(); scene.add(world);                  // всё, что на земле
const ground = mesh(new T.CircleGeometry(700, 64), M('#7fcf6e', { roughness: 1 }), 0, 0, 0, world, false); ground.rotation.x = -Math.PI / 2;
for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + rnd(i + 5) * .3, r = 160 + rnd() * 200, h = mesh(new T.SphereGeometry(40 + rnd() * 50, 24, 12), M(i % 2 ? '#6bbf5e' : '#86d070', { roughness: 1 }), Math.cos(a) * r, -18, Math.sin(a) * r, world, false); h.scale.y = .45; }
const treeMat = M('#4caf50'), trunkMat = M('#8a5a3c');
for (let i = 0; i < 22; i++) { const a = rnd(i * 7 + 3) * Math.PI * 2, r = 24 + rnd() * 70; if (Math.abs(Math.cos(a) * r) < 14 && Math.sin(a) * r > -10 && Math.sin(a) * r < 40) continue;
  const g = new T.Group(); g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); world.add(g); mesh(new T.CylinderGeometry(.35, .45, 2.4, 8), trunkMat, 0, 1.2, 0, g); const s = 1 + rnd() * .8;
  mesh(new T.SphereGeometry(2.2 * s, 16, 12), treeMat, 0, 3.6 * s, 0, g); mesh(new T.SphereGeometry(1.6 * s, 16, 12), treeMat, .9 * s, 4.6 * s, .3, g); }
const fenceMat = M('#fff7ea'); for (let i = -6; i <= 6; i++) mesh(new T.BoxGeometry(.18, 1.1, .18), fenceMat, i * 1.3, .55, 9, world);
mesh(new T.BoxGeometry(16, .14, .1), fenceMat, 0, .8, 9, world); mesh(new T.BoxGeometry(16, .14, .1), fenceMat, 0, .35, 9, world);
const clouds = []; for (let i = 0; i < 16; i++) { const g = new T.Group(), s = 4 + rnd(i + 40) * 6; for (let k = 0; k < 5; k++) mesh(new T.SphereGeometry(s * (.6 + rnd() * .5), 16, 12), M('#ffffff', { roughness: 1 }), (k - 2) * s * .8, rnd() * s * .3, rnd() * s * .4, g, false);
  g.position.set((rnd() - .5) * 600, 60 + rnd() * 200, -150 - rnd() * 400); g.userData = { x: g.position.x, sp: 1 + rnd() * 2 }; scene.add(g); clouds.push(g); }
// облака «под ногами» для сцен высоты
const lowClouds = new T.Group(); scene.add(lowClouds); for (let i = 0; i < 26; i++) { const s = 6 + rnd(i + 90) * 10; mesh(new T.SphereGeometry(s, 16, 12), M('#ffffff', { roughness: 1 }), (rnd() - .5) * 260, 0, (rnd() - .5) * 260, lowClouds, false).scale.y = .45; }
lowClouds.visible = false;

/* ---------------- дом: снаружи и комната внутри (дверь спереди, z = +3) */
const lift = new T.Group(); scene.add(lift);                     // дом + шарики (поднимаются вместе)
const house = new T.Group(); lift.add(house);
const wallM = M('#f4cfa6'), wallIn = M('#f6e3c8'), trimM = M('#ffffff'), roofM = M('#4b7bd1'), glassM = M('#bfe6ff', { emissive: '#8fd0ff', emissiveIntensity: .25, roughness: .1 });
mesh(new T.BoxGeometry(9, .4, 7), M('#8a5a3c'), 0, .2, 0, house);                                        // основание
mesh(new T.BoxGeometry(8.4, .1, 6.4), M('#c9935e', { roughness: .8 }), 0, .45, 0, house);                  // пол (паркет)
const wall = (w, h, d, x, y, z) => { const m = mesh(new T.BoxGeometry(w, h, d), [wallM, wallM, wallM, wallM, wallM, wallM], x, y, z, house); return m; };
wall(.3, 5, 6.4, -4.2, 2.9, 0); wall(.3, 5, 6.4, 4.2, 2.9, 0); wall(8.7, 5, .3, 0, 2.9, -3.2);               // бока и зад
wall(3.4, 5, .3, -2.65, 2.9, 3.2); wall(3.4, 5, .3, 2.65, 2.9, 3.2); wall(1.9, 2, .3, 0, 4.4, 3.2);         // перед с проёмом двери 1,9 × 3
for (const x of [-2.6, 2.6]) { mesh(new T.BoxGeometry(1.4, 1.4, .34), glassM, x, 3, 3.22, house); mesh(new T.BoxGeometry(1.6, .16, .4), trimM, x, 2.22, 3.3, house); }
for (const z of [-1.4, 1.4]) mesh(new T.BoxGeometry(.34, 1.3, 1.2), glassM, 4.22, 3, z, house);
const roof = mesh(new T.CylinderGeometry(.01, 6.6, 3.6, 4, 1), roofM, 0, 7.2, 0, house); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, .82);
mesh(new T.BoxGeometry(1, 2.6, 1), M('#b65a3a'), 2, 8.2, -.8, house);                                      // труба — сюда привязаны шарики
const round = mesh(new T.CylinderGeometry(.75, .75, .2, 24), glassM, 0, 6.6, 2.55, house); round.rotation.x = Math.PI / 2 - .5;
const doorPivot = new T.Group(); doorPivot.position.set(-.95, .5, 3.25); house.add(doorPivot);
const door = mesh(new T.BoxGeometry(1.9, 3, .14), M('#6b3e2a'), .95, 1.5, 0, doorPivot); mesh(new T.SphereGeometry(.09, 12, 8), M('#ffd400', { metalness: .6, roughness: .3 }), 1.6, 1.5, .1, doorPivot);
mesh(new T.BoxGeometry(2.8, .25, 1.4), M('#a06a44'), 0, .12, 4.1, house);                                  // крыльцо
for (let k = 0; k < 9; k++) mesh(new T.SphereGeometry(.28, 10, 8), M(['#ff8fb1', '#ffd400', '#ff6b3d'][k % 3]), -4 + k * (k < 4 ? .4 : .4) + (k >= 4 ? 4.6 : 0), .35, 3.9, house);
// комната
const room = new T.Group(); house.add(room);
const rug = mesh(new T.CylinderGeometry(1.8, 1.8, .04, 32), M('#c84b5a'), 0, .52, .3, room); void rug;
const chairM = M('#d98a6a'); const chair = new T.Group(); chair.position.set(-2.2, .5, -1); chair.rotation.y = .6; room.add(chair);
mesh(new T.BoxGeometry(1.4, .5, 1.3), chairM, 0, .5, 0, chair); mesh(new T.BoxGeometry(1.4, 1.4, .3), chairM, 0, 1.2, -.55, chair); mesh(new T.BoxGeometry(.25, .7, 1.3), chairM, -.7, .8, 0, chair); mesh(new T.BoxGeometry(.25, .7, 1.3), chairM, .7, .8, 0, chair);
const sofa = new T.Group(); sofa.position.set(2.2, .5, -2.3); room.add(sofa); const sofaM = M('#5c86c9');
mesh(new T.BoxGeometry(3, .55, 1.2), sofaM, 0, .45, 0, sofa); mesh(new T.BoxGeometry(3, 1.1, .3), sofaM, 0, .9, -.5, sofa);
mesh(new T.CylinderGeometry(.6, .6, .08, 24), M('#8a5a3c'), 0, 1.1, -.2, room); mesh(new T.CylinderGeometry(.08, .08, .6, 8), M('#8a5a3c'), 0, .8, -.2, room);
mesh(new T.CylinderGeometry(.18, .25, .5, 12), M('#ffe7a8', { emissive: '#ffcf6a', emissiveIntensity: .8 }), 0, 1.4, -.2, room);
const fire = new T.Group(); fire.position.set(-1.6, .5, -3); room.add(fire); mesh(new T.BoxGeometry(2, 2, .5), M('#a85a42'), 0, 1, 0, fire); mesh(new T.BoxGeometry(1, .9, .52), M('#2a1a12'), 0, .6, 0, fire);
mesh(new T.SphereGeometry(.3, 12, 8), M('#ff8a00', { emissive: '#ff6a00', emissiveIntensity: 2 }), 0, .45, .1, fire);
for (const [x, c] of [[1.4, '#ffd400'], [2.6, '#38a6ff'], [3.6, '#ff4d6a']]) { mesh(new T.BoxGeometry(.9, .7, .06), M('#ffffff'), x, 3.2, -3.03, room); mesh(new T.BoxGeometry(.7, .5, .07), M(c), x, 3.2, -3.0, room); }
const shelf = new T.Group(); shelf.position.set(-3.9, .5, 1.6); room.add(shelf); mesh(new T.BoxGeometry(.5, 2.6, 1.6), M('#8a5a3c'), 0, 1.3, 0, shelf);
for (let k = 0; k < 9; k++) mesh(new T.BoxGeometry(.3, .5, .14), M(['#ff4d6a', '#38a6ff', '#3ee08f', '#ffd400'][k % 4]), .1, .55 + Math.floor(k / 3) * .8, -.55 + (k % 3) * .4, shelf);
const lamp = new T.PointLight(0xffd59a, 30, 14, 2); lamp.position.set(0, 4, 0); room.add(lamp);
const deflated = new T.Group(); room.add(deflated); for (let k = 0; k < 14; k++) { const b = mesh(new T.SphereGeometry(.35, 14, 10), M(['#ff4d6a', '#ffb02e', '#3ee08f', '#38a6ff', '#a98bff'][k % 5], { roughness: .4 }), (rnd(k + 300) - .5) * 6, .7, (rnd() - .5) * 4, deflated); b.scale.set(1, .45, .8); } deflated.visible = false;

/* ---------------- облако шариков (InstancedMesh) над трубой */
const anchor = V3(2, 9.5, -.8), COLS = ['#ff4d6a', '#ffb02e', '#3ee08f', '#38a6ff', '#a98bff', '#ff8fb1', '#ffd400', '#ff6b3d'].map(c => new T.Color(c));
const NB = 520, balGeo = new T.SphereGeometry(.62, 22, 16), balMat = new T.MeshPhysicalMaterial({ roughness: .16, clearcoat: 1, clearcoatRoughness: .06 });
const balloons = new T.InstancedMesh(balGeo, balMat, NB); balloons.castShadow = true; lift.add(balloons);
const BP = []; for (let i = 0; i < NB; i++) { const u = rnd(i * 13 + 7), v = rnd(), w = rnd(), th = u * Math.PI * 2, ph = Math.acos(2 * v - 1), rr = Math.cbrt(w);
  BP.push({ x: Math.sin(ph) * Math.cos(th) * rr, y: Math.cos(ph) * rr, z: Math.sin(ph) * Math.sin(th) * rr, s: .9 + rnd() * .25, ph: rnd() * 6.28 }); balloons.setColorAt(i, COLS[i % COLS.length]); }
BP.sort((a, b) => (a.x * a.x + a.y * a.y + a.z * a.z) - (b.x * b.x + b.y * b.y + b.z * b.z));   // ближние к центру первыми: при малом count облако растёт от центра
const strGeo = new T.BufferGeometry(); strGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(90 * 6), 3)); const strings = new T.LineSegments(strGeo, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .75 })); lift.add(strings);
const dm = new T.Object3D();
function layoutBalloons(st, t) {
  const n = Math.round(clamp(st.count, 0, NB)), Rc = st.radius, cy = anchor.y + 2.4 + Rc * .95; balloons.count = n;
  for (let i = 0; i < n; i++) { const p = BP[i], sw = Math.sin(t * .9 + p.ph) * .12; dm.position.set(anchor.x + p.x * Rc + sw, cy + p.y * Rc * .9, anchor.z + p.z * Rc + Math.cos(t * .8 + p.ph) * .1);
    const s = p.s * st.bscale * (st.popAt != null && i >= n - st.popN ? 0 : 1); dm.scale.set(s, s * 1.15, s); dm.updateMatrix(); balloons.setMatrixAt(i, dm.matrix); }
  balloons.instanceMatrix.needsUpdate = true; if (balloons.instanceColor) balloons.instanceColor.needsUpdate = true;
  const a = strGeo.attributes.position.array, m = Math.min(90, n); for (let i = 0; i < 90; i++) { const p = BP[i % Math.max(1, n)], ok = i < m;
    a.set(ok ? [anchor.x + p.x * Rc, cy + p.y * Rc * .9 - .7, anchor.z + p.z * Rc, anchor.x, anchor.y, anchor.z] : [0, 0, 0, 0, 0, 0], i * 6); }
  strGeo.attributes.position.needsUpdate = true; strings.visible = n > 0;
}

/* ---------------- крупный шарик для наездов + стрелки сил */
const hero = new T.Group(); scene.add(hero);
const heroBall = mesh(new T.SphereGeometry(1, 48, 32), new T.MeshPhysicalMaterial({ color: '#ff4d6a', roughness: .12, clearcoat: 1, clearcoatRoughness: .05 }), 0, 0, 0, hero); heroBall.scale.set(1, 1.16, 1);
mesh(new T.ConeGeometry(.16, .25, 16), M('#ff4d6a'), 0, -1.22, 0, hero).rotation.x = Math.PI;
const heroStr = new T.Line(new T.BufferGeometry().setFromPoints([V3(0, -1.3, 0), V3(.25, -2.6, 0), V3(-.1, -4.5, 0)]), new T.LineBasicMaterial({ color: 0xffffff })); hero.add(heroStr);
const arrow = (col) => { const g = new T.Group(); mesh(new T.CylinderGeometry(.06, .06, 1.6, 12), M(col, { emissive: col, emissiveIntensity: .3 }), 0, .8, 0, g, false); mesh(new T.ConeGeometry(.18, .4, 16), M(col, { emissive: col, emissiveIntensity: .3 }), 0, 1.8, 0, g, false); return g; };
const arUp = arrow('#3ee08f'), arD1 = arrow('#ff4d6a'), arD2 = arrow('#ff4d6a'); arUp.position.set(1.6, .2, 0); arD1.position.set(-1.5, -.2, 0); arD1.rotation.z = Math.PI; arD2.position.set(-2.1, -.2, 0); arD2.rotation.z = Math.PI; arD2.scale.setScalar(.6); hero.add(arUp, arD1, arD2);
hero.visible = false;

/* ---------------- Толик */
function makeTolik() {
  const g = new T.Group(), skin = M('#ffd2b0'), suit = M('#2f6fd6'), dark = M('#2d2d2d');
  const legL = mesh(new T.CapsuleGeometry(.16, .7, 6, 12), dark, -.22, .5, 0, g), legR = mesh(new T.CapsuleGeometry(.16, .7, 6, 12), dark, .22, .5, 0, g);
  const body = mesh(new T.CapsuleGeometry(.45, .7, 8, 16), suit, 0, 1.55, 0, g); mesh(new T.BoxGeometry(.92, .12, .5), M('#ff8a00'), 0, 1.75, .12, g); void body;
  const armL = new T.Group(), armR = new T.Group(); armL.position.set(-.5, 1.95, 0); armR.position.set(.5, 1.95, 0); g.add(armL, armR);
  mesh(new T.CapsuleGeometry(.12, .6, 6, 10), suit, 0, -.4, 0, armL); mesh(new T.SphereGeometry(.14, 12, 8), skin, 0, -.8, 0, armL); mesh(new T.CapsuleGeometry(.12, .6, 6, 10), suit, 0, -.4, 0, armR); mesh(new T.SphereGeometry(.14, 12, 8), skin, 0, -.8, 0, armR);
  const head = new T.Group(); head.position.set(0, 2.55, 0); g.add(head); mesh(new T.SphereGeometry(.48, 24, 18), skin, 0, 0, 0, head);
  mesh(new T.SphereGeometry(.52, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M('#ffb000', { roughness: .4 }), 0, .12, 0, head); mesh(new T.CylinderGeometry(.68, .68, .06, 24), M('#ffb000', { roughness: .4 }), 0, .14, .08, head);
  const eye = M('#1b1b1b'), eL = mesh(new T.SphereGeometry(.06, 10, 8), eye, -.17, .02, .44, head), eR = mesh(new T.SphereGeometry(.06, 10, 8), eye, .17, .02, .44, head);
  const mouth = mesh(new T.TorusGeometry(.13, .035, 8, 16, Math.PI), eye, 0, -.18, .43, head); mouth.rotation.z = Math.PI;
  const mouthO = mesh(new T.SphereGeometry(.11, 14, 10), eye, 0, -.2, .42, head); mouthO.scale.set(.8, 1, .4);
  const bal = new T.Group(); g.add(bal); mesh(new T.SphereGeometry(.5, 20, 14), new T.MeshPhysicalMaterial({ color: '#ffd400', roughness: .15, clearcoat: 1 }), 0, 0, 0, bal).scale.y = 1.15;
  bal.add(new T.Line(new T.BufferGeometry().setFromPoints([V3(0, -.6, 0), V3(0, -2.2, 0)]), new T.LineBasicMaterial({ color: 0xffffff })));
  g.userData = { legL, legR, armL, armR, head, eL, eR, mouth, mouthO, bal }; return g;
}
const tolik = makeTolik(); scene.add(tolik);
function poseTolik(st, t) {
  const p = st.tolik; tolik.visible = !!p; if (!p) return; const u = tolik.userData, mood = p.mood || 'happy';
  tolik.position.set(...(p.at || [5, 0, 6])); tolik.rotation.y = p.ry ?? -.5; tolik.scale.setScalar(p.s || 1);
  const bob = Math.abs(Math.sin(t * 4)) * (p.jump ? .35 : .04); tolik.position.y += bob;
  u.armR.rotation.z = mood === 'shock' ? 2.6 : p.wave ? 2.4 + Math.sin(t * 9) * .35 : p.hold ? 2.9 : .15; u.armL.rotation.z = mood === 'shock' ? -2.6 : mood === 'sad' ? -.05 : -.15;
  u.head.rotation.x = mood === 'sad' ? .35 : mood === 'shock' ? -.15 : Math.sin(t * 1.5) * .05; u.head.rotation.z = Math.sin(t * 1.2) * .06;
  u.mouth.rotation.z = mood === 'sad' ? 0 : Math.PI; u.mouth.position.y = mood === 'sad' ? -.25 : -.18; u.mouth.visible = mood !== 'shock'; u.mouthO.visible = mood === 'shock';
  const blink = (t % 3.1) < .12 ? .15 : 1; u.eL.scale.y = u.eR.scale.y = mood === 'shock' ? 1.6 : blink;
  u.bal.visible = !!p.bal; if (p.bal) { const s = p.bal === 'grow' ? .3 + ((t * 1.1) % 1) * .9 : 1; u.bal.scale.setScalar(s); u.bal.position.set(.62, 3.6 + Math.sin(t * 1.4) * .08 + (p.hold ? .4 : 0), .1); }
}

/* ---------------- реквизит */
const tanks = new T.InstancedMesh(new T.CylinderGeometry(.32, .32, 1.8, 14), M('#9aa6b8', { metalness: .5, roughness: .35 }), 240); tanks.castShadow = true; scene.add(tanks);
{ const o = new T.Object3D(); let k = 0; for (let r = 0; r < 12; r++) for (let c = 0; c < 20; c++) { o.position.set(-19 + c * 2, .9, 14 + r * 2.2); o.updateMatrix(); tanks.setMatrixAt(k++, o.matrix); } }
const capsT = new T.InstancedMesh(new T.CylinderGeometry(.2, .2, .35, 12), M('#ffd400'), 240); scene.add(capsT);
{ const o = new T.Object3D(); let k = 0; for (let r = 0; r < 12; r++) for (let c = 0; c < 20; c++) { o.position.set(-19 + c * 2, 1.95, 14 + r * 2.2); o.updateMatrix(); capsT.setMatrixAt(k++, o.matrix); } }
const crowd = new T.InstancedMesh(new T.CapsuleGeometry(.28, .7, 4, 8), M('#ffffff'), 845); crowd.castShadow = true; scene.add(crowd);
{ const o = new T.Object3D(); for (let i = 0; i < 845; i++) { const a = rnd(i + 900) * Math.PI * 2, r = 9 + Math.sqrt(rnd()) * 26; o.position.set(Math.cos(a) * r, .65, Math.sin(a) * r + 4); o.updateMatrix(); crowd.setMatrixAt(i, o.matrix); crowd.setColorAt(i, COLS[i % 8]); } }
const money = new T.InstancedMesh(new T.BoxGeometry(1.6, .5, .8), M('#4fae5f'), 400); money.castShadow = true; scene.add(money);
{ const o = new T.Object3D(); let k = 0; for (let x = 0; x < 10; x++) for (let z = 0; z < 8; z++) for (let y = 0; y < 5; y++) { o.position.set(-24 + x * 1.75, .25 + y * .52, -4 + z * .9); o.rotation.y = (rnd(k + 2000) - .5) * .1; o.updateMatrix(); money.setMatrixAt(k++, o.matrix); } }
const tower = new T.Group(); tower.position.set(-24, 0, -6); scene.add(tower);
{ const tc = document.createElement('canvas'); tc.width = 64; tc.height = 512; const g = tc.getContext('2d'); g.fillStyle = '#c7d3e3'; g.fillRect(0, 0, 64, 512); g.fillStyle = '#7fb6e6'; for (let f = 0; f < 17; f++) for (let w = 0; w < 3; w++) g.fillRect(6 + w * 20, 8 + f * 30, 14, 18);
  const tx = new T.CanvasTexture(tc); tx.colorSpace = T.SRGBColorSpace; mesh(new T.BoxGeometry(14, 54, 14), M('#ffffff', { map: tx }), 0, 27, 0, tower); }
const chairLarry = new T.Group(); scene.add(chairLarry);
{ const cm = M('#2e8b57'); mesh(new T.BoxGeometry(1.4, .12, 1.3), cm, 0, 0, 0, chairLarry); mesh(new T.BoxGeometry(1.4, 1.4, .12), cm, 0, .7, -.6, chairLarry); for (const x of [-.6, .6]) for (const z of [-.5, .5]) mesh(new T.CylinderGeometry(.05, .05, 1, 8), M('#cfd6df'), x, -.5, z, chairLarry);
  for (let i = 0; i < 45; i++) { const a = rnd(i + 700) * Math.PI * 2, r = Math.sqrt(rnd()) * 3.4, b = mesh(new T.SphereGeometry(.85, 18, 14), new T.MeshPhysicalMaterial({ color: '#f5f5f5', roughness: .25, clearcoat: .6 }), Math.cos(a) * r, 7 + rnd() * 3, Math.sin(a) * r, chairLarry); b.userData.k = i; } }
const tiny = new T.Group(); scene.add(tiny); for (let i = 0; i < 40; i++) { const a = rnd(i + 1500) * 6.28, r = Math.sqrt(rnd()) * 1.4; const b = mesh(new T.SphereGeometry(.28, 12, 10), new T.MeshPhysicalMaterial({ color: COLS[i % 8], roughness: .15, clearcoat: 1 }), Math.cos(a) * r, 4 + (rnd() - .5) * 1.6, Math.sin(a) * r, tiny); b.scale.y = 1.15; }
const bricks = new T.InstancedMesh(new T.BoxGeometry(2, .8, 1), M('#ffffff', { roughness: .35 }), 60); scene.add(bricks);
{ const o = new T.Object3D(); for (let i = 0; i < 60; i++) { o.position.set(0, .4 + i * .82, 0); o.rotation.y = (i % 2) * .05; o.updateMatrix(); bricks.setMatrixAt(i, o.matrix); bricks.setColorAt(i, COLS[i % 8]); } }
const ribbon = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([V3(2, 9.5, -.8), V3(10, 3, -30), V3(-20, 1, -150), V3(40, 1, -400), V3(-30, 1, -800)]), 200, .3, 8), M('#ff4d6a', { emissive: '#ff4d6a', emissiveIntensity: .4 })); scene.add(ribbon);
const chute = new T.Group(); scene.add(chute); { const c = mesh(new T.SphereGeometry(2.2, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M('#ff4d6a', { side: T.DoubleSide }), 0, 4.6, 0, chute, false); c.scale.y = .6; }

/* ---------------- камера: ключи [доля, [x,y,z] позиция, [x,y,z] куда смотрит, fov]; одинаковая доля у двух ключей = склейка (резкий монтаж) */
function camPath(u, keys, off = V3(0, 0, 0)) {
  let i = 0; while (i < keys.length - 1 && u >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], k = b[0] > a[0] ? sm((u - a[0]) / (b[0] - a[0])) : 0;
  const p = V3(...a[1]).lerp(V3(...b[1]), k).add(off), l = V3(...a[2]).lerp(V3(...b[2]), k).add(off); return { p, l, fov: lerp(a[3] || 45, b[3] || 45, k) };
}
const orbit = (u, r, h, a0, a1, look = [0, 4, 0], fov = 45) => { const a = lerp(a0, a1, u); return [[0, [Math.cos(a) * r, h, Math.sin(a) * r], look, fov], [1, [Math.cos(a) * r, h, Math.sin(a) * r], look, fov]]; };
const orbitKeys = (r, h, a0, a1, look = [0, 4, 0], fov = 45, n = 8) => [...Array(n + 1)].map((_, k) => { const a = lerp(a0, a1, k / n); return [k / n, [Math.cos(a) * r, h, Math.sin(a) * r], look, fov]; });
void orbit;

/* ---------------- состояние мира по умолчанию для каждого кадра */
const base = () => ({ count: 420, radius: 6, bscale: 1, liftY: 0, tilt: 0, driftX: 0, door: 0, room: true, sky: 0, ground: true, lowClouds: false, deflated: false, popN: 0, popAt: null,
  hero: null, tolik: null, tanks: 0, crowd: 0, money: 0, tower: false, larry: null, tiny: null, bricks: 0, ribbon: false, chute: null, house: true, shake: 0, sunA: 0 });

/* ---------------- планы (по фразам). u — 0..1 по фразе, d — длина фразы, o — параметры */
const S = {};
S.opening = (u, o, s) => { s.liftY = lerp(0, 2.5, sm(prog(u, .55, 1))); return camPath(u, [[0, [80, 40, 110], [0, 14, 0], 38], [.55, [34, 16, 46], [0, 14, 0], 42], [1, [26, 8, 36], [0, 14, 0], 45]]); };
S.tolikIntro = (u, o, s) => { s.count = 22; s.radius = 1.6; s.tolik = { at: [3.2, 0, 6.5], ry: -.4, wave: true, mood: 'happy', bal: true };
  return camPath(u, [[0, [5.5, 2.2, 11.5], [3, 2.2, 6.5], 38], [.5, [6.2, 2.4, 10.8], [3, 2.4, 6.5], 34], [.5, [9, 3.4, 16], [1.5, 3.2, 3], 45], [1, [10, 4.4, 17], [1.5, 4, 3], 45]]); };
S.teaseUp = (u, o, s) => camPath(u, [[0, [6, 3, 12], [2, 9, 0], 50], [.35, [6, 14, 18], [2, 16, -.8], 46], [1, [5, 34, 16], [2, 16, -.8], 44]]);
S.chapter = (u, o, s) => { s.liftY = o.liftY || 0; return camPath(u, orbitKeys(o.r || 22, o.h || 26, o.a0 ?? .4, (o.a0 ?? .4) + .9, [0, 6 + (o.liftY || 0), 0], 42)); };
S.doorApproach = (u, o, s) => { s.door = sm(prog(u, .7, 1)); return camPath(u, [[0, [9, 4, 20], [0, 3, 3], 42], [.45, [3, 2.6, 11], [0, 2.4, 3], 45], [.45, [-6, 3, 9], [0, 2.5, 3], 50], [1, [0, 2.3, 6.4], [0, 2.1, 3], 55]]); };
S.interior = (u, o, s) => { s.door = 1; return camPath(u, [[0, [0, 2.3, 5.6], [0, 2, 2], 58], [.3, [0, 2.1, 2.2], [-1.5, 1.5, -2], 64], [.65, [1.6, 2.4, .8], [-2, 1.2, -1.2], 64], [1, [2.4, 2.8, -1.2], [-1.6, 1.2, -3], 60]]); };
S.exitRise = (u, o, s) => { s.door = 1; s.liftY = o.liftY || 0; return camPath(u, [[0, [0, 2.2, 1], [0, 2.2, 8], 60], [.35, [0, 2.4, 7], [0, 3, 14], 55], [.35, [0, 4, 16], [0, 6, 0], 45], [1, [6, 22, 18], [2, 13, 0], 42]]); };
S.heroBalloon = (u, o, s) => { s.hero = { at: [2, 14, 10], s: 1.6, arrows: true, deflate: 0 }; return camPath(u, [[0, [2, 14.2, 20], [2, 14, 10], 35], [1, [5, 14.5, 16.5], [2, 14, 10], 35]]); };
S.heroHold = (u, o, s) => { s.hero = { at: [2, 14, 10], s: 1.6, spin: 1 }; return camPath(u, [[0, [1.2, 15.5, 21], [2, 13.2, 10], 34], [1, [1.3, 15.4, 20.3], [2, 13.2, 10], 34]]); };
S.pullBack = (u, o, s) => { s.count = lerp(1, 520, ei(prog(u, .05, .8))); s.radius = lerp(.6, 7.5, eo(prog(u, 0, .8))); return camPath(u, [[0, [2.5, 13, 4.5], [2, 12.5, -.8], 40], [.3, [6, 15, 14], [2, 13, -.8], 45], [1, [40, 22, 60], [0, 10, 0], 45]]); };
S.compare = (u, o, s) => { s.count = 520; s.radius = 7.5; s.tiny = { at: [-14, 0, 6] };
  return camPath(u, [[0, [-14, 4, 13], [-14, 3.5, 6], 40], [.45, [-14, 4.5, 14], [-14, 4, 6], 36], [.45, [10, 8, 46], [-4, 11, 0], 48], [1, [14, 10, 52], [-4, 12, 0], 48]]); };
S.chairFloat = (u, o, s) => { s.tiny = { at: [-5.6, 0, 10], rise: .6 + sm(u) * 2.2 }; s.tolik = { at: [-6, .6 + sm(u) * 2.2, 10], ry: .3, mood: 'happy', s: .8, hold: true };
  return camPath(u, [[0, [-1, 3, 18], [-6, 2.4, 10], 40], [1, [-2, 5, 17], [-6, 4, 10], 40]]); };
S.punch = (u, o, s) => { s.tolik = { at: [4, 0, 7], ry: -.35, mood: o.mood || 'shock' }; const z = u < .12 ? 1 : 0; void z;
  return camPath(u, [[0, [6, 2.6, 13], [4, 2.4, 7], 40], [.15, [5.4, 2.7, 11.2], [4, 2.5, 7], 34], [1, [5.3, 2.7, 10.9], [4, 2.5, 7], 33]]); };
S.tanksSweep = (u, o, s) => { s.tanks = prog(u, 0, .6); return camPath(u, [[0, [-24, 3, 44], [-4, 1, 18], 45], [1, [16, 6, 42], [-2, 1, 20], 45]]); };
S.tanksDolly = (u, o, s) => { s.tanks = 1; return camPath(u, [[0, [-24, 2.2, 46], [-6, 1.2, 24], 55], [1, [12, 2.4, 46], [2, 1.2, 24], 55]]); };
S.money = (u, o, s) => { s.money = prog(u, 0, .7); return camPath(u, [[0, [-16, 2, 10], [-16, 1, -2], 48], [1, [-6, 18, 30], [-12, 2, -2], 44]]); };
S.moneyHold = (u, o, s) => { s.money = 1; return camPath(u, [[0, [-4, 10, 34], [-8, 3, 0], 45], [1, [-4, 10, 32.5], [-8, 3, 0], 45]]); };
S.timelapse = (u, o, s) => { s.tolik = { at: [3, 0, 6.5], ry: -.5, mood: u > .6 ? 'sad' : 'happy', bal: 'grow' }; s.sunA = u * 6; s.count = 0;
  return camPath(u, [[0, [6.5, 2.6, 12], [3, 2.8, 6.5], 40], [1, [7, 3, 12.6], [3, 2.8, 6.5], 38]]); };
S.deflate = (u, o, s) => { s.hero = { at: [2, 14 - sm(u) * 3, 10], s: 1.6 * (1 - .45 * sm(u)) }; return camPath(u, [[0, [1, 14.5, 21], [2, 12.5, 10], 34], [1, [1, 13.5, 20.5], [2, 11.5, 10], 34]]); };
S.deflated = (u, o, s) => { s.door = 1; s.deflated = true; s.tolik = { at: [.6, .5, 1.2], ry: .4, mood: 'shock', s: .85 }; return camPath(u, [[0, [0, 2.4, 5.8], [.4, 1.6, 0], 56], [1, [1.2, 2.6, 4.6], [.4, 1.6, 0], 56]]); };
S.crowd = (u, o, s) => { s.crowd = prog(u, 0, .7); return camPath(u, [[0, [0, 3, 30], [0, 3, 0], 48], [1, [26, 30, 46], [0, 4, 0], 45]]); };
S.ribbon = (u, o, s) => { s.ribbon = true; const k = sm(u), p = [lerp(4, 30, k), lerp(8, 18, k), lerp(4, -300, k)]; return camPath(0, [[0, p, [p[0] - 10, 1, p[2] - 60], 55]]); };
S.lowAngle = (u, o, s) => { s.count = 520; s.radius = 7.5; return camPath(u, [[0, [9, 1.2, 20], [2, 12, -1], 58], [1, [12, 1.2, 19], [2, 13, -1], 56]]); };
S.skyscraper = (u, o, s) => { s.count = 520; s.radius = 7.5; s.tower = true; return camPath(u, [[0, [-8, 20, 70], [-8, 20, 0], 48], [1, [-6, 24, 76], [-8, 22, 0], 48]]); };
S.liftoff = (u, o, s) => { s.count = 520; s.radius = 7.8; s.liftY = ei(prog(u, .2, 1)) * 14;
  return camPath(u, [[0, [4, .6, 13], [0, 3, 0], 55], [.5, [5, .7, 13], [0, 6, 0], 55], [.5, [24, 8, 30], [0, 12, 0], 45], [1, [24, 12, 30], [0, 18, 0], 45]]); };
S.wind = (u, o, s) => { s.count = 520; s.radius = 7.8; s.liftY = 18; s.driftX = sm(u) * 22; s.tilt = sm(u) * .16; s.shake = .25;
  return camPath(u, [[0, [-10, 26, 30], [0, 24, 0], 45], [1, [12, 27, 32], [22, 25, 0], 45]]); };
S.altitude = (u, o, s) => { s.count = 520; s.radius = 7.8 * (1 + (o.swell ? sm(u) * .25 : 0)); s.liftY = 30; s.ground = false; s.lowClouds = true; s.sky = lerp(o.sky0 || 0, o.sky1 || .3, u);
  return camPath(u, [[0, [26, 30, 34], [0, 36, 0], 45], [1, [30, 46, 30], [0, 40, 0], 42]]); };
S.pop = (u, o, s) => { s.count = 520; s.radius = 9.5; s.liftY = 30 - ei(prog(u, .35, 1)) * 40; s.ground = false; s.lowClouds = true; s.sky = .8; s.popN = Math.round(eo(prog(u, 0, .7)) * 500); s.popAt = 1; s.shake = .6;
  return camPath(u, [[0, [24, 36, 30], [0, 38, 0], 45], [.5, [30, 32, 36], [0, 30, 0], 50], [1, [34, 12, 40], [0, 0, 0], 55]]); };
S.chute = (u, o, s) => { s.house = false; s.count = 0; s.chute = { y: 22 - sm(u) * 6 }; s.tolik = { at: [0, 22 - sm(u) * 6, 0], ry: 0, mood: o.mood || 'sad' };
  return camPath(u, [[0, [0, 23 - sm(u) * 6, 13], [0, 24.5 - sm(u) * 6, 0], 42], [1, [2, 19, 13], [0, 20, 0], 42]]); };
S.larry = (u, o, s) => { s.house = false; s.count = 0; s.larry = { y: 2 + sm(u) * 10, pop: o.pop ? u : 0 }; s.tolik = { at: [0, 2.1 + sm(u) * 10, .1], ry: 0, mood: 'happy', s: .5 }; s.sky = o.pop ? .2 : 0;
  return camPath(u, [[0, [-6, 4 + sm(u) * 10, 11], [1.5, 6 + sm(u) * 10, 0], 50], [1, [-7, 5 + sm(u) * 10, 10.5], [1.5, 7 + sm(u) * 10, 0], 50]]); };
S.smallHouse = (u, o, s) => { s.count = 300; s.radius = 5; s.liftY = sm(u) * 20; return camPath(u, orbitKeys(26, 14 + sm(u) * 18, 2, 3.2, [0, 12 + sm(u) * 18, 0], 45)); };
S.everything = (u, o, s) => { s.count = 520; s.radius = 7.5; s.tanks = 1; s.crowd = 1; s.money = 1; return camPath(u, [[0, [50, 40, 70], [-4, 6, 6], 45], [1, [48, 38, 66], [-4, 6, 6], 45]]); };
S.tolikAsk = (u, o, s) => { s.count = 0; s.tolik = { at: [-2, 0, 7], ry: .2, mood: 'happy', bal: true, hold: true, jump: true }; return camPath(u, [[0, [1.5, 3, 16], [1.5, 2.9, 7], 40], [1, [1.6, 3.1, 15.4], [1.5, 3, 7], 40]]); };
S.lego = (u, o, s) => { s.house = false; s.count = 0; s.bricks = Math.round(lerp(1, 60, eo(u))); s.tolik = { at: [2.5, 0, 2], ry: -.4, mood: 'happy', wave: true };
  return camPath(u, [[0, [6, 2, 10], [0, 2, 0], 45], [1, [10, 26, 22], [0, 24, 0], 50]]); };

/* ---------------- применить состояние */
function apply(st, t) {
  lift.position.set(st.driftX, st.liftY, 0); lift.rotation.z = st.tilt + Math.sin(t * .8) * (st.liftY > 1 ? .015 : 0); house.visible = st.house;
  doorPivot.rotation.y = -st.door * 1.6; room.visible = st.room; deflated.visible = st.deflated; layoutBalloons(st, t);
  world.visible = st.ground; lowClouds.visible = st.lowClouds; lowClouds.position.y = st.liftY - 30 + 5;
  paintSky(st.sky); scene.fog.color.set(new T.Color('#cfe8ff').lerp(new T.Color('#3a5f9a'), st.sky)); hemi.intensity = 1.25 - st.sky * .4;
  if (st.sunA) { const k = (Math.cos(st.sunA * Math.PI * 2) + 1) / 2; paintSky(k * .9); sun.intensity = 2.7 * (1 - k * .8); } else sun.intensity = 2.7;
  hero.visible = !!st.hero; if (st.hero) { hero.position.set(...st.hero.at); hero.scale.setScalar(st.hero.s || 1); hero.rotation.y = (st.hero.spin ? t * .3 : Math.sin(t * .7) * .25); arUp.visible = arD1.visible = arD2.visible = !!st.hero.arrows; }
  poseTolik(st, t);
  tanks.count = capsT.count = Math.round(240 * st.tanks); tanks.visible = capsT.visible = st.tanks > 0; tanks.instanceMatrix.needsUpdate = true;
  crowd.count = Math.round(845 * st.crowd); crowd.visible = st.crowd > 0; money.count = Math.round(400 * st.money); money.visible = st.money > 0;
  tower.visible = st.tower; ribbon.visible = st.ribbon; bricks.count = st.bricks; bricks.visible = st.bricks > 0;
  chairLarry.visible = !!st.larry; if (st.larry) { chairLarry.position.set(0, st.larry.y, 0); chairLarry.children.forEach(c => { if (c.userData.k != null) c.visible = c.userData.k >= Math.floor(st.larry.pop * 30); }); }
  tiny.visible = !!st.tiny; if (st.tiny) { tiny.position.set(st.tiny.at[0], st.tiny.at[1] + (st.tiny.rise || 0), st.tiny.at[2]); }
  chute.visible = !!st.chute; if (st.chute) chute.position.set(0, st.chute.y, 0);
  for (const c of clouds) c.position.x = c.userData.x + t * c.userData.sp;
}

/* ---------------- 2D-слой: цифры, плашки, субтитры */
const MONT = (px) => `900 ${px}px Montserrat`, INTER = (px, w = 800) => `${w} ${px}px Inter`;
const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/ /g, ' ');
function text(s, x, y, o = {}) {
  if (!s) return; const p = o.p ?? 1; if (p <= 0) return; X.save(); X.globalAlpha = (o.a ?? 1) * clamp(p * 3, 0, 1); X.font = o.font || INTER(48); X.textAlign = o.align || 'center'; X.lineJoin = 'round';
  if (o.pop) { const k = clamp(p * 1.4, 0, 1), sc = 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2; X.translate(x, y); X.scale(sc, sc); X.translate(-x, -y); }
  if (o.rot) { X.translate(x, y); X.rotate(o.rot); X.translate(-x, -y); }
  if (o.fit) { let px = parseInt(X.font.match(/(\d+)px/)[1]); while (X.measureText(s).width > o.fit && px > 20) X.font = X.font.replace(/\d+px/, (px -= 4) + 'px'); }
  const px = parseInt(X.font.match(/(\d+)px/)[1]);
  if (o.stroke !== false) { X.lineWidth = Math.max(8, px * .17); X.strokeStyle = 'rgba(8,16,36,.9)'; X.strokeText(s, x, y); }
  if (o.shadow) { X.shadowColor = o.shadow; X.shadowOffsetY = Math.max(4, px * .07); X.shadowBlur = 0; }
  X.fillStyle = o.color || '#fff'; X.fillText(s, x, y); X.restore();
}
function pill(x, y, w, h, col, p = 1, rot = 0) { if (p <= 0) return; X.save(); X.globalAlpha = clamp(p * 3, 0, 1); X.translate(x, y); X.rotate(rot); X.shadowColor = 'rgba(0,0,0,.3)'; X.shadowBlur = 24; X.shadowOffsetY = 10; X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, h / 2.6); X.fillStyle = col; X.fill(); X.restore(); }
const UI = {};
UI.big = (o, q, t) => { const n = o.to != null ? fmt(lerp(o.from || 0, o.to, eo(prog(q, .05, .7)))) + (o.unit ? ' ' + o.unit : '') : o.big;
  if (o.top) { pill(W / 2, H * .17, Math.min(1200, o.top.length * 30 + 120), 76, '#ff3b5c', prog(q, 0, .08)); text(o.top, W / 2, H * .17 + 16, { font: INTER(44), color: '#fff', stroke: false, p: prog(q, 0, .1) }); }
  const Y = H * (o.y || .36); text(n, W / 2, Y, { font: MONT(o.size || 180), color: o.col || '#fff', shadow: '#d9480f', p: prog(q, .02, .14), pop: true, fit: W - 160 });
  if (o.sub) text(o.sub, W / 2, Y + 84, { font: INTER(48), p: prog(q, .15, .3), fit: W - 200 }); };
UI.chapter = (o, q) => { const p = eo(prog(q, 0, .2)); pill(W / 2, H * .42, 1180, 220, '#ffd400', p, -.02); text(`ЭТАП ${o.n}`, W / 2, H * .42 - 140, { font: MONT(56), p }); text(o.text, W / 2, H * .42 + 26, { font: MONT(96), color: '#14233d', stroke: false, p, pop: true, fit: 1080 }); };
UI.say = (o, q) => { const p = eo(prog(q, .05, .2)); X.save(); X.globalAlpha = p; X.font = MONT(50); const w = Math.min(1100, X.measureText(o.say).width + 100); X.restore(); pill(o.x || W * .62, o.y || H * .2, w, 120, '#ffffff', p); text(o.say, o.x || W * .62, (o.y || H * .2) + 18, { font: MONT(50), color: '#14233d', stroke: false, p, fit: w - 60 }); };
UI.rows = (o, q) => { (o.rows || []).forEach(([l, v, c], i) => { const p = eo(prog(q, .1 + i * .14, .25 + i * .14)), y = H * .2 + i * 110; pill(W * .78, y, 600, 90, 'rgba(255,255,255,.95)', p); text(l, W * .78 - 270, y + 16, { font: INTER(40), color: '#14233d', stroke: false, align: 'left', p }); text(v, W * .78 + 270, y + 18, { font: MONT(50), color: c, stroke: false, align: 'right', p }); });
  if (o.total) { const p = eo(prog(q, .62, .76)), y = H * .2 + 3 * 110 + 20; pill(W * .78, y, 600, 110, '#ffd400', p); text('ИТОГО', W * .78 - 270, y + 18, { font: MONT(46), color: '#14233d', stroke: false, align: 'left', p }); text(o.total, W * .78 + 270, y + 24, { font: MONT(72), color: '#14233d', stroke: false, align: 'right', p, pop: true }); } };
UI.tease = (o, q) => { const p = eo(prog(q, 0, .2)); text('В КОНЦЕ ВИДЕО', W / 2, H * .2, { font: MONT(64), color: '#ffd400', p }); pill(W / 2, H * .36, 1100, 150, 'rgba(255,255,255,.3)', p);
  X.save(); X.globalAlpha = p; X.filter = 'blur(14px)'; X.font = MONT(56); X.textAlign = 'center'; X.fillStyle = '#fff'; X.fillText(o.hidden || '███████ ███ ████████', W / 2, H * .36 + 20); X.restore(); text('🔒', W / 2, H * .36 + 26, { font: MONT(80), stroke: false, p }); };
UI.banner = (o, q, t) => { const p = eo(prog(q, 0, .12)); pill(W / 2, H * .16, 640, 110, '#ff3b5c', p, -.04 + Math.sin(t * 3) * .015); text(o.top || 'А ТЫ ЗНАЛ?', W / 2, H * .16 + 20, { font: MONT(58), stroke: false, p, rot: -.04 });
  if (o.big) text(o.big, W / 2, H * .38, { font: MONT(150), color: '#ffd400', p: prog(q, .08, .22), pop: true, fit: W - 160 }); text(o.text, W / 2, H * (o.big ? .38 : .32) + 90, { font: INTER(50), p: prog(q, .2, .4), fit: W - 200 }); };
UI.alt = (o, q) => { const km = lerp(o.from, o.to, sm(q)), x = 150, y0 = H * .82, h = H * .62; X.save(); X.strokeStyle = '#fff'; X.lineWidth = 6; X.beginPath(); X.moveTo(x, y0); X.lineTo(x, y0 - h); X.stroke();
  for (let k = 0; k <= 5; k++) { const y = y0 - k / 5 * h; X.beginPath(); X.moveTo(x, y); X.lineTo(x + 30, y); X.stroke(); text(`${k} км`, x - 16, y + 12, { font: INTER(30), align: 'right' }); } X.fillStyle = '#ffd400'; const ym = y0 - km / 5 * h; X.beginPath(); X.moveTo(x + 34, ym); X.lineTo(x + 74, ym - 16); X.lineTo(x + 74, ym + 16); X.fill(); X.restore();
  pill(W - 300, H * .22, 420, 230, 'rgba(255,255,255,.95)'); text(`${km.toFixed(1).replace('.', ',')} км`, W - 300, H * .22 - 10, { font: MONT(76), color: '#14233d', stroke: false }); text(`${Math.round(lerp(o.t0, o.t1, sm(q)))} °C`, W - 300, H * .22 + 76, { font: MONT(58), color: '#2d7fe0', stroke: false }); };
UI.pop = (o, q, t) => { for (let i = 0; i < 26; i++) { const r1 = Math.sin(i * 91.7) * .5 + .5, r2 = Math.sin(i * 37.3) * .5 + .5, t0 = r1 * .7, p = prog(q, t0, t0 + .06); if (p > 0 && p < 1) text('ПОП!', 200 + r2 * (W - 400), 160 + r1 * (H * .55), { font: MONT(50 + r2 * 40), color: ['#ffd400', '#ff4d6a', '#3ee08f', '#38a6ff'][i % 4], pop: true, p, rot: (r2 - .5) * .6 }); } };
UI.card = (o, q) => { const p = eo(prog(q, 0, .2)); X.save(); X.globalAlpha = p; X.shadowColor = 'rgba(0,0,0,.35)'; X.shadowBlur = 30; X.fillStyle = 'rgba(255,255,255,.96)'; X.beginPath(); X.roundRect(W * .52, H * .14, W * .42, H * .5, 40); X.fill(); X.restore();
  text(o.year, W * .73, H * .26, { font: MONT(120), color: '#ff3b5c', stroke: false, p }); text(o.name, W * .73, H * .34, { font: MONT(50), color: '#14233d', stroke: false, p: prog(q, .1, .3), fit: W * .38 });
  (o.lines || []).forEach((l, i) => text(l, W * .73, H * .42 + i * 58, { font: INTER(40), color: '#3b4b66', stroke: false, p: prog(q, .25 + i * .08, .45 + i * .08), fit: W * .38 })); };
UI.receipt = (o, q) => { const rows = o.rows, w = 760, h = 160 + rows.length * 84, x0 = W / 2 - w / 2, y0 = H * .44 - h / 2; X.save(); X.shadowColor = 'rgba(0,0,0,.35)'; X.shadowBlur = 30; X.fillStyle = '#fff'; X.fillRect(x0, y0, w, h); X.restore();
  text(o.title, W / 2, y0 + 72, { font: MONT(44), color: '#14233d', stroke: false }); rows.forEach(([l, v], i) => { const p = prog(q, .08 + i * .09, .18 + i * .09), y = y0 + 150 + i * 84; text(l, x0 + 46, y, { font: INTER(40), color: '#3b4b66', stroke: false, align: 'left', p }); text(v, x0 + w - 46, y, { font: MONT(44), color: i === rows.length - 1 ? '#ff3b5c' : '#14233d', stroke: false, align: 'right', p }); });
  if (o.stamp) text(o.stamp, x0 + w - 150, y0 + h - 20, { font: MONT(86), color: '#ff3b5c', stroke: false, rot: -.18, pop: true, p: prog(q, .82, .92) }); };
UI.ask = (o, q) => { const p = eo(prog(q, 0, .2)); pill(W * .66, H * .26, 1000, 130, '#ffffff', p); text(o.q, W * .66, H * .26 + 18, { font: MONT(50), color: '#14233d', stroke: false, p, fit: 940 });
  pill(W * .66, H * .42, 860, 130, '#ffd400', prog(q, .25, .4)); text(o.formula, W * .66, H * .42 + 22, { font: MONT(62), color: '#14233d', stroke: false, p: prog(q, .25, .45), fit: 800 }); text(o.sub, W * .66, H * .52, { font: INTER(42), p: prog(q, .45, .6) }); };
UI.next = (o, q) => { text('В СЛЕДУЮЩЕМ ВЫПУСКЕ', W / 2, H * .14, { font: MONT(56), color: '#ffd400', p: prog(q, 0, .15) }); text(o.text, W / 2, H * .25, { font: MONT(92), p: prog(q, .1, .3), pop: true, fit: W - 200 }); text(o.sub, W / 2, H * .25 + 80, { font: INTER(46), p: prog(q, .25, .45), fit: W - 240 }); };

function captions(t) {
  const caps = EP.caps; let k = -1; for (let i = 0; i < caps.length; i++) if (t >= caps[i].a && t < caps[i].b + .05) { k = i; break; } if (k < 0) return;
  const cp = caps[k], pop = 1 + .14 * (1 - eo(prog(t, cp.a, cp.a + .16))), words = cp.text.split(' ');
  X.save(); X.font = MONT(58); const sp = X.measureText(' ').width, ws = words.map(w => X.measureText(w).width), Wt = ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  X.translate(W / 2, H - 70); X.scale(pop, pop); let x = -Wt / 2; X.textAlign = 'left'; X.lineJoin = 'round';
  words.forEach((w, i) => { const hot = /[0-9%]/.test(w); X.lineWidth = 12; X.strokeStyle = 'rgba(0,0,0,.9)'; X.strokeText(w, x, 0); X.fillStyle = hot ? '#ffd400' : '#fff'; X.fillText(w, x, 0); x += ws[i] + sp; }); X.restore();
}
function hud(t, i) {
  text(EP.brand || 'СКОЛЬКО НУЖНО?', 54, 70, { font: MONT(30), align: 'left', a: .9 });
  let badge; for (let k = i; k >= 0 && badge === undefined; k--) badge = EP.beats[k].badge; const b = EP.beats[i];
  if (badge && b.ui?.kind !== 'chapter') { pill(W - 230, 64, 400, 70, 'rgba(14,26,52,.72)'); text(badge, W - 230, 76, { font: MONT(30), color: '#ffd400', stroke: false, fit: 360 }); }
  X.fillStyle = 'rgba(255,255,255,.25)'; X.fillRect(0, 0, W, 8); X.fillStyle = '#ffd400'; X.fillRect(0, 0, W * clamp(t / EP.END, 0, 1), 8);
}

/* ---------------- кадр */
const beatAt = (t) => { let i = 0; while (i + 1 < PH.length && t >= PH[i + 1].s - .25) i++; return i; };
let FLASH = 0;
function render(t) {
  const i = beatAt(t), b = EP.beats[i], s0 = PH[i].s - .25, dur = Math.max(1.2, (PH[i + 1]?.s ?? EP.END) - .25 - s0), u = clamp((t - s0) / dur, 0, 1), st = base();
  const c = (S[b.shot] || S.chapter)(u, b.o || {}, st); apply(st, t);
  const sh = st.shake ? V3(Math.sin(t * 37) * st.shake * .15, Math.sin(t * 53) * st.shake * .12, 0) : V3(0, 0, 0), hand = V3(Math.sin(t * .9) * .05, Math.sin(t * 1.3) * .04, 0);
  const lead = st.liftY && !['opening', 'chapter', 'exitRise'].includes(b.shot) ? 0 : 0; void lead;
  cam.position.copy(c.p).add(sh).add(hand); cam.lookAt(c.l); cam.fov = c.fov; cam.updateProjectionMatrix();
  const punch = prog(t, s0, s0 + .22); if (punch < 1 && i > 0) { cam.fov *= 1 + .08 * (1 - eo(punch)); cam.updateProjectionMatrix(); }
  R.render(scene, cam);
  X.clearRect(0, 0, W, H); X.drawImage(gl, 0, 0, W, H);
  const v = X.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.35)'); X.fillStyle = v; X.fillRect(0, 0, W, H);
  if (b.ui) { const q = clamp((t - PH[i].s) / Math.min(PH[i].d, 5), 0, 1); (UI[b.ui.kind] || (() => {}))(b.ui, q, t); }
  if (!window.NOHUD) { hud(t, i); captions(t); }
  FLASH = b.ui?.kind === 'chapter' ? Math.max(0, 1 - (t - s0) / .3) * .7 : 0; if (FLASH > 0) { X.fillStyle = `rgba(255,255,255,${FLASH})`; X.fillRect(0, 0, W, H); }
}
window.grab = (f, q = .9) => { render(f / FPS); return out.toDataURL('image/jpeg', q); };
window.renderAt = render;
Promise.all([MONT(80), INTER(40), INTER(40, 400)].flatMap(f => [document.fonts.load(f, 'Аа Яя 0'), document.fonts.load(f, 'Aa 0 «»—')])).then(() => { render(.01); window.READY = true; });
