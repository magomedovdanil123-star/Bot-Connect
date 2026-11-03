// Набор «Земля и очередь»: Земля в космосе со звёздами, Луна, очередь людей (на земле — до горизонта; в космосе — спираль вокруг планеты и линия до Луны),
// касса Толика, ряд касс. Выпуски: 6004 (рубль от каждого), а Землю в космосе берут 6006 (яма) и 6008 (пчёлы).
import { makeEarth } from './_lib.js';

export default function earth(ctx) {
  const { T, scene, M, mesh, rnd, COLS, S, camPath, orbitKeys, sm, ei, eo, prog, lerp, clamp, V3, clouds, paintSky } = ctx;
  const EC = V3(0, 60, 0), ER = 10;                          // Земля висит над сценой: на земле в этот момент ничего не видно
  const globe = makeEarth(ctx, ER); globe.position.copy(EC); scene.add(globe);
  const moon = mesh(new T.SphereGeometry(ER * .6, 48, 32), M('#c9c9c4', { roughness: 1 }), EC.x + 170, EC.y + 12, EC.z - 30, scene, false);
  const starG = new T.BufferGeometry(), sp = []; for (let i = 0; i < 2500; i++) { const a = rnd(i + 31000) * 6.28, b = Math.acos(2 * rnd() - 1), r = 1800; sp.push(Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r); }
  starG.setAttribute('position', new T.Float32BufferAttribute(sp, 3)); const stars = new T.Points(starG, new T.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false })); scene.add(stars);
  // очередь-спираль вокруг Земли (≈100 витков) и линия до Луны
  const turns = 26, pts = []; for (let i = 0; i <= 2600; i++) { const k = i / 2600, th = k * turns * Math.PI * 2, ph = Math.acos(1 - 2 * (.04 + k * .92)); pts.push(V3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th)).multiplyScalar(ER * 1.03)); }
  const spiralGeo = new T.TubeGeometry(new T.CatmullRomCurve3(pts), 2600, .07, 5), spiral = new T.Mesh(spiralGeo, M('#ffd400', { emissive: '#ffb000', emissiveIntensity: .9 })); spiral.position.copy(EC); scene.add(spiral);
  const toMoon = new T.Mesh(new T.CylinderGeometry(.25, .25, 1, 8), M('#ffd400', { emissive: '#ffb000', emissiveIntensity: 1 })); scene.add(toMoon);
  // очередь на земле
  const NQ = 1400, bodyG = new T.CapsuleGeometry(.22, .62, 4, 8), headG = new T.SphereGeometry(.2, 12, 10);
  const qBody = new T.InstancedMesh(bodyG, M('#ffffff'), NQ), qHead = new T.InstancedMesh(headG, M('#ffd2b0'), NQ); [qBody, qHead].forEach(m => { m.frustumCulled = false; m.castShadow = true; scene.add(m); });
  const QP = []; for (let i = 0; i < NQ; i++) { QP.push({ x: Math.sin(i * .35) * .12 + (rnd(i + 40000) - .5) * .12, z: 1.2 - i * .55, ph: rnd() * 6, s: .9 + rnd() * .22 }); qBody.setColorAt(i, COLS[(i * 3) % COLS.length]); }
  const o = new T.Object3D();
  // касса Толика
  const desk = new T.Group(); desk.position.set(0, 0, 3); scene.add(desk); { const wd = M('#a06a44'); mesh(new T.BoxGeometry(2.4, .12, 1.2), wd, 0, 1.1, 0, desk); for (const x of [-1, 1]) mesh(new T.BoxGeometry(.12, 1.1, 1), wd, x, .55, 0, desk);
    mesh(new T.BoxGeometry(.8, .45, .6), M('#2f6fd6'), .5, 1.4, 0, desk); mesh(new T.BoxGeometry(.6, .05, .1), M('#1b1b1b'), .5, 1.63, 0, desk); mesh(new T.CylinderGeometry(.3, .26, .55, 20), M('#cfe9ff', { transparent: true, opacity: .55, roughness: .1 }), -.5, 1.44, 0, desk); }
  // ряд касс (1000 кассиров — показываем 40)
  const NC = 40, cDesk = new T.InstancedMesh(new T.BoxGeometry(2, 1.1, 1), M('#a06a44'), NC), cLine = new T.InstancedMesh(bodyG, M('#ffffff'), NC * 14);
  [cDesk, cLine].forEach(m => { m.frustumCulled = false; m.castShadow = true; scene.add(m); });
  for (let c = 0; c < NC; c++) { o.position.set(-60 + c * 3, .55, 3); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); o.updateMatrix(); cDesk.setMatrixAt(c, o.matrix);
    for (let k = 0; k < 14; k++) { o.position.set(-60 + c * 3 + (rnd(c * 20 + k) - .5) * .2, .55, 1.6 - k * .6); o.updateMatrix(); cLine.setMatrixAt(c * 14 + k, o.matrix); cLine.setColorAt(c * 14 + k, COLS[(c + k) % COLS.length]); } }

  const spaceBg = new T.Color('#02040c'), skyBg = scene.background;
  ctx.base = { ...ctx.base, space: false, globe: false, spiral: 0, moonLine: 0, queue: 0, cashDesk: false, cashiers: false, globeSpin: 0 };
  [globe, moon, stars, spiral, toMoon, qBody, qHead, desk, cDesk, cLine].forEach(m => (m.visible = false));
  ctx.hooks.push((st, t) => {
    const sp = st.space; scene.background = sp ? spaceBg : skyBg; scene.fog.near = sp ? 5000 : 120; scene.fog.far = sp ? 9000 : 900; stars.visible = sp; clouds.forEach(c => (c.visible = !sp));
    if (sp) st.ground = false;
    globe.visible = st.globe; globe.rotation.y = st.globeSpin + t * .05; globe.userData.clouds.rotation.y = t * .02;
    spiral.visible = st.spiral > 0; spiral.rotation.y = globe.rotation.y; spiralGeo.setDrawRange(0, Math.floor(spiralGeo.index.count * clamp(st.spiral, 0, 1) / 3) * 3);
    moon.visible = st.moonLine > 0 || st.moon; toMoon.visible = st.moonLine > 0;
    if (st.moonLine > 0) { const a = V3(EC.x + ER, EC.y, EC.z), b = moon.position.clone(), k = clamp(st.moonLine, 0, 1), e = a.clone().lerp(b, k); toMoon.position.copy(a).lerp(e, .5); toMoon.scale.set(1, a.distanceTo(e), 1); toMoon.lookAt(e); toMoon.rotateX(Math.PI / 2); }
    const nq = Math.round(NQ * clamp(st.queue, 0, 1)); qBody.count = qHead.count = nq; qBody.visible = qHead.visible = nq > 0;
    for (let i = 0; i < nq; i++) { const p = QP[i], bob = Math.abs(Math.sin(t * 3 + p.ph)) * .04; o.position.set(p.x, .53 * p.s + bob, p.z); o.rotation.set(0, 0, 0); o.scale.setScalar(p.s); o.updateMatrix(); qBody.setMatrixAt(i, o.matrix);
      o.position.y = 1.05 * p.s + bob + .1; o.updateMatrix(); qHead.setMatrixAt(i, o.matrix); }
    qBody.instanceMatrix.needsUpdate = qHead.instanceMatrix.needsUpdate = true;
    desk.visible = st.cashDesk; cDesk.visible = cLine.visible = st.cashiers;
  });
  void paintSky; void ei;

  const E = (x, y, z) => [EC.x + x, EC.y + y, EC.z + z];
  S.queueOpen = (u, o, s) => { s.queue = 1; s.cashDesk = true; s.tolik = { at: [0, 0, 4.4], ry: Math.PI, mood: 'happy', wave: u < .5 };
    return camPath(u, [[0, [18, 40, -120], [0, 0, -40], 45], [.55, [6, 6, 12], [0, 1.5, -6], 45], [1, [3.4, 2.6, 8.5], [0, 1.8, 2], 42]]); };
  S.queueDolly = (u, o, s) => { s.queue = 1; s.cashDesk = true; s.tolik = { at: [0, 0, 4.4], ry: Math.PI, mood: o.mood || 'happy' }; const z = lerp(4, -90, sm(u));
    return camPath(0, [[0, [1.6, 1.5, z], [-.4, 1.4, z - 12], 50]]); };
  S.queueHigh = (u, o, s) => { s.queue = 1; s.cashDesk = true; return camPath(u, [[0, [10, 6, 10], [0, 0, -60], 50], [1, [12, 16, 14], [0, 0, -120], 50]]); };
  S.queueTimelapse = (u, o, s) => { s.queue = 1; s.cashDesk = true; s.sunA = u * 8; s.tolik = { at: [0, 0, 4.4], ry: Math.PI, mood: u > .5 ? 'sad' : 'happy' };
    return camPath(u, [[0, [4, 2.8, 9], [0, 1.5, 1], 42], [1, [4.4, 3, 9.6], [0, 1.6, 1], 40]]); };
  S.cashiers = (u, o, s) => { s.cashiers = true; return camPath(u, [[0, [-50, 3, 14], [-30, 1, 0], 48], [1, [30, 26, 40], [0, 0, -6], 46]]); };
  S.globe = (u, o, s) => { s.space = true; s.globe = true; s.globeSpin = o.spin || 0; s.spiral = o.spiral ?? 0; s.moon = o.moon;
    return camPath(u, orbitKeys(o.r || 34, o.h ?? 8, o.a0 ?? 1.2, (o.a0 ?? 1.2) + (o.da ?? .6), [0, 0, 0], o.fov || 40).map(k => [k[0], E(...k[1]), E(...k[2]), k[3]])); };
  S.globeQueue = (u, o, s) => { s.space = true; s.globe = true; s.spiral = eo(prog(u, .05, .9)); return camPath(u, orbitKeys(32, 10, 1, 2.2, [0, 0, 0], 42).map(k => [k[0], E(...k[1]), E(...k[2]), k[3]])); };
  S.globeMoon = (u, o, s) => { s.space = true; s.globe = true; s.spiral = 1; s.moonLine = eo(prog(u, .1, .85));
    return camPath(u, [[0, E(-30, 18, 60), E(60, 0, 0), 40], [.5, E(-30, 30, 120), E(90, 6, -15), 50], [1, E(85, 60, 175), E(85, 4, -15), 56]]); };
  S.globeHold = (u, o, s) => { s.space = true; s.globe = true; s.spiral = o.spiral ?? 1; return camPath(u, [[0, E(0, 6, 30), E(0, 0, 0), 40], [1, E(1, 6, 29), E(0, 0, 0), 40]]); };
}
