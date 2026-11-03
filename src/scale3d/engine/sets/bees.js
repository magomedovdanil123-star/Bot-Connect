// Набор «пчёлы»: пчела крупно (машет крыльями), рой, поле цветов, банка мёда, ложка с каплей, соты, улей, путь пчёл вокруг Земли (с sets/earth.js). Выпуск 6008.
import { canvasTex } from './_lib.js';

export default function bees(ctx) {
  const { T, scene, M, mesh, rnd, S, camPath, orbitKeys, sm, ei, eo, prog, lerp, clamp, V3, COLS } = ctx;
  const stripes = canvasTex(ctx, 256, 64, (x, w, h) => { x.fillStyle = '#ffc21a'; x.fillRect(0, 0, w, h); x.fillStyle = '#2a1c0c'; for (let i = 0; i < 4; i++) x.fillRect(40 + i * 50, 0, 24, h); });
  const makeBee = () => { const g = new T.Group(), fur = new T.MeshPhysicalMaterial({ map: stripes, roughness: .6, sheen: 1, sheenColor: '#fff2b0' }), dark = M('#2a1c0c');
    const body = mesh(new T.SphereGeometry(.5, 24, 18), fur, -.25, 0, 0, g); body.scale.set(1.4, 1, 1); body.rotation.z = Math.PI / 2;
    mesh(new T.SphereGeometry(.33, 18, 14), dark, .5, .05, 0, g); mesh(new T.ConeGeometry(.06, .25, 8), dark, -.98, 0, 0, g).rotation.z = Math.PI / 2;
    for (const z of [-.16, .16]) { mesh(new T.SphereGeometry(.12, 12, 10), M('#111', { roughness: .2 }), .66, .12, z, g); const a = mesh(new T.CylinderGeometry(.015, .015, .45, 6), dark, .66, .4, z * 1.4, g); a.rotation.z = -.5; a.rotation.x = z * 2; }
    const wm = new T.MeshPhysicalMaterial({ color: '#e8f6ff', transparent: true, opacity: .45, roughness: .1, side: T.DoubleSide, depthWrite: false }), wings = [];
    for (const s of [-1, 1]) { const piv = new T.Group(); piv.position.set(-.05, .38, s * .12); g.add(piv); const w = mesh(new T.CircleGeometry(.5, 20), wm, -.2, 0, s * .35, piv, false); w.scale.set(1.2, .55, 1); w.rotation.x = Math.PI / 2; wings.push([piv, s]); }
    g.userData.wings = wings; return g; };
  const hero = makeBee(); scene.add(hero);
  // рой
  const NSw = 600, swB = new T.InstancedMesh(new T.SphereGeometry(.09, 8, 6), M('#ffc21a'), NSw); swB.frustumCulled = false; scene.add(swB);
  const SW = [...Array(NSw)].map((_, i) => ({ r: 2 + rnd(i + 91000) * 7, a: rnd() * 6.28, y: rnd() * 6, sp: .4 + rnd() * .9, ph: rnd() * 6 }));
  // поле цветов
  const NF = 2400, petals = new T.InstancedMesh(new T.CylinderGeometry(.32, .32, .06, 10), M('#ffffff'), NF), cores = new T.InstancedMesh(new T.SphereGeometry(.12, 8, 6), M('#ffb000'), NF), stems = new T.InstancedMesh(new T.CylinderGeometry(.03, .03, 1, 5), M('#3e9b3a'), NF);
  const field = new T.Group(); field.position.set(0, 0, -6); scene.add(field); [petals, cores, stems].forEach(m => { m.frustumCulled = false; field.add(m); });
  const PC = ['#ff8fb1', '#ffffff', '#a98bff', '#ffd400', '#ff6b3d', '#38a6ff'].map(c => new T.Color(c));
  { const o = new T.Object3D(); for (let i = 0; i < NF; i++) { const x = (rnd(i * 3 + 92000) - .5) * 80, z = (rnd() - .5) * 60, h = .6 + rnd() * .5; o.position.set(x, h, z); o.rotation.set((rnd() - .5) * .3, 0, (rnd() - .5) * .3); o.scale.setScalar(1); o.updateMatrix(); petals.setMatrixAt(i, o.matrix); petals.setColorAt(i, PC[i % PC.length]);
    o.position.y = h + .05; o.updateMatrix(); cores.setMatrixAt(i, o.matrix); o.position.y = h / 2; o.rotation.set(0, 0, 0); o.scale.set(1, h, 1); o.updateMatrix(); stems.setMatrixAt(i, o.matrix); } }
  const bigFlower = new T.Group(); bigFlower.position.set(0, 0, 0); scene.add(bigFlower); { mesh(new T.CylinderGeometry(.08, .1, 3, 8), M('#3e9b3a'), 0, 1.5, 0, bigFlower);
    for (let k = 0; k < 10; k++) { const p = mesh(new T.SphereGeometry(.5, 14, 10), M('#ff8fb1', { roughness: .5 }), Math.cos(k / 10 * 6.28) * .75, 3.05, Math.sin(k / 10 * 6.28) * .75, bigFlower); p.scale.set(1, .18, .55); p.rotation.y = -k / 10 * 6.28; }
    mesh(new T.SphereGeometry(.42, 18, 12), M('#ffb000', { roughness: .8 }), 0, 3.12, 0, bigFlower).scale.y = .5; }
  // банка мёда
  const jar = new T.Group(); jar.position.set(0, 0, 0); scene.add(jar);
  const honeyM = new T.MeshPhysicalMaterial({ color: '#e89a12', roughness: .15, clearcoat: 1, transmission: .25, thickness: 1, emissive: '#7a3d00', emissiveIntensity: .25 });
  const honey = mesh(new T.CylinderGeometry(.95, .95, 1, 40), honeyM, 0, .5, 0, jar);
  mesh(new T.CylinderGeometry(1.05, 1.05, 2.4, 40, 1, true), new T.MeshPhysicalMaterial({ color: '#ffffff', transparent: true, opacity: .2, roughness: .05, side: T.DoubleSide, depthWrite: false }), 0, 1.25, 0, jar, false);
  mesh(new T.CylinderGeometry(1.12, 1.12, .32, 40), M('#d9342b'), 0, 2.6, 0, jar); const lab = canvasTex(ctx, 512, 128, (x, w, h) => { x.fillStyle = '#fff7e0'; x.fillRect(0, 0, w, h); x.fillStyle = '#7a3d00'; x.font = '900 70px Montserrat'; x.textAlign = 'center'; x.fillText('МЁД · 500 г', w / 2, 90); });
  mesh(new T.CylinderGeometry(1.06, 1.06, .7, 40, 1, true, -.9, 1.8), new T.MeshStandardMaterial({ map: lab }), 0, 1.1, 0, jar, false);
  // ложка с каплей
  const spoon = new T.Group(); scene.add(spoon); { const sm2 = M('#d9dde3', { metalness: .8, roughness: .25 }); const bowl = mesh(new T.SphereGeometry(.6, 24, 12, 0, 6.28, Math.PI / 2, Math.PI / 2), sm2, 0, .3, 0, spoon); bowl.scale.set(1, .35, .7);
    const h = mesh(new T.CylinderGeometry(.06, .08, 3, 10), sm2, 1.9, .42, 0, spoon); h.rotation.z = Math.PI / 2 - .1; }
  const drop = mesh(new T.SphereGeometry(.12, 16, 12), honeyM, 0, .2, 0, spoon); drop.scale.set(1, .55, 1);
  // соты
  const NH = 220, comb = new T.InstancedMesh(new T.CylinderGeometry(.5, .5, .6, 6), M('#f2c14e', { roughness: .5 }), NH), combH = new T.InstancedMesh(new T.CylinderGeometry(.42, .42, .62, 6), honeyM, NH);
  const combG = new T.Group(); combG.position.set(0, 4, 0); combG.rotation.x = Math.PI / 2; scene.add(combG); [comb, combH].forEach(m => { m.frustumCulled = false; combG.add(m); });
  { const o = new T.Object3D(); let k = 0; for (let r = 0; r < 14 && k < NH; r++) for (let c = 0; c < 16 && k < NH; c++, k++) { o.position.set((c - 8) * .87 + (r % 2) * .435, 0, (r - 7) * .75); o.rotation.set(0, Math.PI / 6, 0); o.updateMatrix(); comb.setMatrixAt(k, o.matrix); combH.setMatrixAt(k, o.matrix); } }
  // улей
  const hive = new T.Group(); hive.position.set(-6, 0, 2); scene.add(hive); { for (let k = 0; k < 3; k++) mesh(new T.BoxGeometry(2.4, .9, 2), M(['#f6dccb', '#ffd98a', '#f2e6d8'][k]), 0, .5 + k * .95, 0, hive); mesh(new T.BoxGeometry(2.8, .2, 2.4), M('#2f6fd6'), 0, 3.4, 0, hive); mesh(new T.BoxGeometry(.8, .12, .1), M('#2a1c0c'), 0, .2, 1.01, hive); }
  // путь пчёл вокруг Земли
  const EC = V3(0, 60, 0), ring = new T.Mesh(new T.TorusGeometry(10.9, .08, 8, 200, Math.PI * 2), M('#ffd400', { emissive: '#ffb000', emissiveIntensity: 1 })), ring2 = ring.clone(); ring.position.copy(EC); ring2.position.copy(EC); ring.rotation.x = Math.PI / 2; ring2.rotation.set(Math.PI / 2 + .25, .1, 0); ring2.scale.setScalar(1.04); scene.add(ring, ring2);
  const orbBee = makeBee(); orbBee.scale.setScalar(.9); scene.add(orbBee);
  const o = new T.Object3D();

  ctx.base = { ...ctx.base, bee: null, swarm: 0, field: false, bigFlower: false, jar: null, spoon: null, comb: 0, hive: false, beeRing: 0 };
  [hero, swB, field, bigFlower, jar, spoon, combG, hive, ring, ring2, orbBee].forEach(m => (m.visible = false));
  const flap = (b, t, k = 1) => b.userData.wings.forEach(([p, s]) => { p.rotation.x = s * (Math.sin(t * 60) * .7 * k + .2); });
  ctx.hooks.push((st, t) => {
    hero.visible = !!st.bee; if (st.bee) { const b = st.bee; hero.position.set(b.at[0], b.at[1] + Math.sin(t * 3) * .06, b.at[2]); hero.scale.setScalar(b.s || 1); hero.rotation.set(0, b.ry ?? -.6, Math.sin(t * 2) * .05); flap(hero, t, b.still ? 0 : 1); }
    swB.visible = st.swarm > 0; if (st.swarm > 0) { const n = Math.round(NSw * clamp(st.swarm, 0, 1)); swB.count = n; for (let i = 0; i < n; i++) { const p = SW[i], a = p.a + t * p.sp; o.position.set(-6 + Math.cos(a) * p.r, 1 + p.y + Math.sin(t * 2 + p.ph) * .3, 2 + Math.sin(a) * p.r); o.rotation.set(0, 0, 0); o.scale.set(1.4, 1, 1); o.updateMatrix(); swB.setMatrixAt(i, o.matrix); } swB.instanceMatrix.needsUpdate = true; }
    field.visible = st.field; bigFlower.visible = st.bigFlower;
    jar.visible = !!st.jar; if (st.jar) { jar.position.set(...st.jar.at); jar.scale.setScalar(st.jar.s || 1); const f = clamp(st.jar.fill ?? 1, .01, 1); honey.scale.y = f * 2.3; honey.position.y = .05 + f * 1.15; jar.rotation.y = .3 + Math.sin(t * .4) * .12; }
    spoon.visible = !!st.spoon; if (st.spoon) { spoon.position.set(...st.spoon.at); spoon.scale.setScalar(st.spoon.s || 1); spoon.rotation.y = -.4; drop.scale.setScalar(st.spoon.drop ?? 1); drop.scale.y *= .55; }
    combG.visible = st.comb > 0; combH.count = Math.round(NH * clamp(st.comb, 0, 1)); hive.visible = st.hive;
    ring.visible = st.beeRing > 0; ring2.visible = st.beeRing > 1.2; orbBee.visible = st.beeRing > 0;
    if (st.beeRing > 0) { const a = t * .9; orbBee.position.set(EC.x + Math.cos(a) * 10.9, EC.y, EC.z - Math.sin(a) * 10.9); orbBee.rotation.set(0, a + Math.PI, 0); flap(orbBee, t); }
  });
  void COLS; void sm; void ei;

  const E = (x, y, z) => [EC.x + x, EC.y + y, EC.z + z];
  S.beesOpen = (u, o, s) => { s.field = true; s.jar = { at: [1.4, 0, 3], s: .8 }; s.swarm = .5; s.hive = true; s.tolik = { at: [-1.4, 0, 3.4], ry: .5, wave: true, mood: 'happy' };
    return camPath(u, [[0, [20, 16, 30], [0, 1, 0], 44], [.55, [4, 3.4, 12], [0, 1.6, 2], 45], [1, [2.6, 2.6, 9.4], [0, 1.8, 3], 42]]); };
  S.beeMacro = (u, o, s) => { s.bee = { at: [0, 3, 0], s: 1.6, ry: o.ry ?? -.6, still: o.still }; s.field = true; return camPath(u, [[0, [3.4, 4, 7.4], [0, 3, 0], 38], [1, [2.8, 3.8, 6.6], [0, 3, 0], 36]]); };
  S.beeFlight = (u, o, s) => { s.field = true; const x = lerp(-14, 14, u), y = 2.4 + Math.sin(u * 9) * .4; s.bee = { at: [x, y, 0], s: 1, ry: 0 }; return { p: V3(x - 4.6, 3.2, 6), l: V3(x, y, 0), fov: 45 }; };
  S.nectar = (u, o, s) => { s.bigFlower = true; s.field = true; s.bee = { at: [.1, 3.55, .1], s: .7, ry: -.9, still: u > .3 }; return camPath(u, [[0, [3, 4.4, 4.2], [0, 3.2, 0], 36], [1, [2.4, 4, 3.4], [0, 3.3, 0], 34]]); };
  S.spoon = (u, o, s) => { s.spoon = { at: [0, 2, 0], s: 1.6, drop: o.drop ?? lerp(.2, 1, eo(prog(u, .1, .5))) }; return camPath(u, [[0, [1.8, 3.6, 3.2], [0, 2.3, 0], 36], [1, [1.4, 3.2, 2.6], [0, 2.3, 0], 34]]); };
  S.jar = (u, o, s) => { s.jar = { at: [0, 0, 0], s: 1.4, fill: o.fill ?? 1 }; s.field = true; s.tolik = o.tolik ? { at: [-3.4, 0, 1.4], ry: .5, mood: o.mood || 'happy' } : null;
    return camPath(u, [[0, [4.4, 3.4, 7], [0, 1.9, 0], 40], [1, [3.4, 3, 6.4], [0, 1.9, 0], 38]]); };
  S.swarm = (u, o, s) => { s.hive = true; s.field = true; s.swarm = lerp(.15, 1, eo(prog(u, 0, .7))); return camPath(u, [[0, [2, 3, 12], [-6, 3, 2], 45], [1, [6, 8, 18], [-6, 3.4, 2], 46]]); };
  S.flowers = (u, o, s) => { s.field = true; s.swarm = .6; s.hive = true; return camPath(u, [[0, [-30, 2, 20], [0, 1, -10], 50], [1, [30, 26, 30], [0, 0, -6], 48]]); };
  S.globeRing = (u, o, s) => { s.space = true; s.globe = true; s.beeRing = o.rings || 1; return camPath(u, orbitKeys(30, 12, o.a0 ?? 1, (o.a0 ?? 1) + .7, [0, 0, 0], 42).map(k => [k[0], E(...k[1]), E(...k[2]), k[3]])); };
  S.comb = (u, o, s) => { s.comb = lerp(.1, 1, sm(u)); s.bee = { at: [1, 4.2, 1.2], s: .8, ry: -.9 }; return camPath(u, [[0, [3, 6, 8], [0, 4, 0], 42], [1, [2.2, 5.4, 7], [0, 4, 0], 40]]); };
  S.hive = (u, o, s) => { s.hive = true; s.field = true; s.swarm = 1; s.tolik = o.tolik ? { at: [-2.4, 0, 4], ry: -.3, mood: o.mood || 'shock' } : null; return camPath(u, [[0, [-2, 3.4, 12], [-6, 2, 2], 42], [1, [-1, 3, 10.4], [-6, 2, 2], 40]]); };
  S.beeWalk = (u, o, s) => { s.field = true; s.sunA = u * 8; const x = lerp(-12, 12, u); s.tolik = { at: [x, 0, 4], ry: Math.PI / 2, mood: u > .5 ? 'sad' : 'happy', jump: true }; return camPath(u, [[0, [x, 3, 14], [x, 1.6, 4], 44], [1, [x, 3, 14], [x, 1.6, 4], 44]]); };
  S.beesEverything = (u, o, s) => { s.field = true; s.hive = true; s.swarm = 1; s.jar = { at: [1.4, 0, 3], s: .8 }; return camPath(u, [[0, [24, 18, 34], [-2, 1, 0], 44], [1, [22, 16, 31], [-2, 1, 0], 44]]); };
}
