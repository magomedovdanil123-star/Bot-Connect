// Набор «паутина против поезда»: рельсы, поезд метро из 6 вагонов на открытом участке, дома вдоль путей, нити паутины от Толика и от домов к поезду,
// паук на круглой паутине, клубок шёлка, толпа пауков, сравнение стального троса и нити. Выпуск 6007. Толик — сам по себе, без чужих костюмов.
import { canvasTex, envMap } from './_lib.js';

export default function web(ctx) {
  const { T, scene, M, mesh, rnd, S, camPath, orbitKeys, sm, ei, eo, prog, lerp, clamp, V3, tolik } = ctx, env = envMap(ctx);
  // пути
  const rails = new T.Group(); scene.add(rails); const steel = M('#9aa6b8', { metalness: .7, roughness: .3, envMap: env });
  for (const z of [-.75, .75]) mesh(new T.BoxGeometry(800, .18, .12), steel, 0, .25, z, rails, false);
  const sl = new T.InstancedMesh(new T.BoxGeometry(.3, .16, 2.6), M('#6b4a2e'), 1000); sl.frustumCulled = false; rails.add(sl); { const o = new T.Object3D(); for (let i = 0; i < 1000; i++) { o.position.set(-400 + i * .8, .1, 0); o.updateMatrix(); sl.setMatrixAt(i, o.matrix); } }
  mesh(new T.BoxGeometry(800, .1, 5), M('#8d8f94', { roughness: 1 }), 0, .03, 0, rails, false);
  // поезд
  const winTex = canvasTex(ctx, 512, 128, (x, w, h) => { x.fillStyle = '#d9dee6'; x.fillRect(0, 0, w, h); x.fillStyle = '#2b4a7a'; for (let i = 0; i < 6; i++) x.fillRect(20 + i * 82, 26, 62, 44); x.fillStyle = '#e3263b'; x.fillRect(0, 86, w, 16); x.fillStyle = '#3a3f48'; x.fillRect(0, 118, w, 10); });
  const train = new T.Group(); scene.add(train); const carM = [M('#d9dee6'), M('#d9dee6'), M('#d9dee6'), M('#c8ced8'), M('#ffffff', { map: winTex }), M('#ffffff', { map: winTex })];
  for (let k = 0; k < 6; k++) { const c = new T.Group(); c.position.x = -k * 19.8 - 9.5; train.add(c); mesh(new T.BoxGeometry(19, 3.4, 2.8), carM, 0, 2.2, 0, c);
    for (const x of [-7, 7]) for (const z of [-.75, .75]) { const wh = mesh(new T.CylinderGeometry(.45, .45, .2, 16), M('#222'), x, .55, z, c); wh.rotation.x = Math.PI / 2; } }
  const nose = mesh(new T.BoxGeometry(.6, 3.2, 2.7), M('#e3263b'), .1, 2.2, 0, train); void nose;
  mesh(new T.BoxGeometry(.1, 1.2, 2.2), M('#2b4a7a', { emissive: '#1a3060', emissiveIntensity: .4 }), .42, 2.9, 0, train);
  for (const z of [-.9, .9]) mesh(new T.SphereGeometry(.18, 12, 8), M('#fff6c0', { emissive: '#fff2a0', emissiveIntensity: 2 }), .45, 1.3, z, train, false);
  // дома вдоль путей
  const city = new T.Group(); scene.add(city); const winB = canvasTex(ctx, 128, 256, (x, w, h) => { x.fillStyle = '#c7d3e3'; x.fillRect(0, 0, w, h); x.fillStyle = '#7fb6e6'; for (let f = 0; f < 14; f++) for (let c = 0; c < 4; c++) x.fillRect(8 + c * 30, 8 + f * 18, 20, 11); });
  for (const side of [-1, 1]) for (let i = 0; i < 26; i++) { const hgt = 16 + rnd(i * 2 + (side + 3) * 100 + 82000) * 30, b = mesh(new T.BoxGeometry(10, hgt, 8), M(['#f2e6d8', '#e8eef5', '#f6dccb'][i % 3], { map: winB }), -150 + i * 12, hgt / 2, side * 17, city); void b; }
  // нити паутины
  const NW = 8, strands = [...Array(NW)].map(() => { const m = new T.Mesh(new T.CylinderGeometry(.09, .09, 1, 8), M('#ffffff', { emissive: '#ffffff', emissiveIntensity: .35, roughness: .4 })); m.castShadow = true; scene.add(m); return m; });
  const anchors = [...Array(NW)].map((_, k) => V3(-14 + (k >> 1) * 9, 12 + (k % 3) * 4, (k % 2 ? 1 : -1) * 13));
  const between = (m, a, b) => { m.position.copy(a).lerp(b, .5); m.scale.set(1, Math.max(.01, a.distanceTo(b)), 1); m.lookAt(b); m.rotateX(Math.PI / 2); };
  // паук на паутине
  const spider = new T.Group(); spider.position.set(0, 3, 0); scene.add(spider);
  { const lines = []; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28; lines.push(0, 0, 0, Math.cos(a) * 3, Math.sin(a) * 3, 0); } for (let r = .35; r < 3; r += .28) for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28, b = (k + 1) / 16 * 6.28; lines.push(Math.cos(a) * r, Math.sin(a) * r, 0, Math.cos(b) * (r + .02), Math.sin(b) * (r + .02), 0); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(lines, 3)); spider.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8 }))); }
  const bug = new T.Group(); bug.position.set(.2, .3, .15); spider.add(bug); { const bm = new T.MeshPhysicalMaterial({ color: '#5a4636', roughness: .4, clearcoat: .5 });
    mesh(new T.SphereGeometry(.42, 20, 14), bm, 0, -.35, 0, bug).scale.set(1, 1.25, .8); mesh(new T.SphereGeometry(.26, 16, 12), bm, 0, .22, 0, bug);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const leg = new T.Group(); leg.position.set(s * .15, .2 - k * .12, 0); leg.rotation.z = s * (1.1 - k * .35); bug.add(leg); mesh(new T.CylinderGeometry(.03, .025, .9, 6), bm, 0, .45, .04, leg); }
    for (const x of [-.08, .08]) mesh(new T.SphereGeometry(.05, 8, 6), M('#111'), x, .32, .2, bug); }
  // клубок шёлка, толпа пауков, трос и нить
  const silkTex = canvasTex(ctx, 256, 256, (x, w) => { x.fillStyle = '#f7f3ea'; x.fillRect(0, 0, w, w); x.strokeStyle = 'rgba(180,170,150,.5)'; for (let i = 0; i < 60; i++) { x.beginPath(); x.moveTo(0, rnd(i + 83000) * w); x.bezierCurveTo(w * .3, rnd() * w, w * .7, rnd() * w, w, rnd() * w); x.stroke(); } });
  const ball = mesh(new T.SphereGeometry(1.6, 40, 30), new T.MeshPhysicalMaterial({ map: silkTex, roughness: .35, sheen: 1, sheenColor: '#ffffff' }), 2.4, 1.6, 6, scene);
  const crowdG = new T.Group(); scene.add(crowdG); const NSp = 900, sp = new T.InstancedMesh(new T.SphereGeometry(.12, 8, 6), M('#5a4636'), NSp); sp.frustumCulled = false; crowdG.add(sp);
  const spl = new T.InstancedMesh(new T.BoxGeometry(.36, .02, .02), M('#3a2d22'), NSp * 2); spl.frustumCulled = false; crowdG.add(spl);
  { const o = new T.Object3D(); for (let i = 0; i < NSp; i++) { const x = (i % 30 - 15) * .55 + (rnd(i + 84000) - .5) * .2, z = (Math.floor(i / 30) - 15) * .55 + (rnd() - .5) * .2, r = rnd() * 6; o.position.set(x, .1, z + 4); o.rotation.set(0, r, 0); o.scale.set(1, .7, 1.3); o.updateMatrix(); sp.setMatrixAt(i, o.matrix);
    for (let k = 0; k < 2; k++) { o.scale.set(1, 1, 1); o.rotation.set(0, r + (k ? .5 : -.5), 0); o.position.y = .06; o.updateMatrix(); spl.setMatrixAt(i * 2 + k, o.matrix); } } }
  const compare = new T.Group(); compare.position.set(-3, 0, 6); scene.add(compare); { mesh(new T.BoxGeometry(6, .2, .2), M('#7d8796'), 0, 5, 0, compare);
    const cable = mesh(new T.CylinderGeometry(.14, .14, 3.6, 16), steel, -1.6, 3.2, 0, compare); void cable; const thread = mesh(new T.CylinderGeometry(.06, .06, 3.6, 12), M('#ffffff', { emissive: '#ffffff', emissiveIntensity: .3 }), 1.6, 3.2, 0, compare); void thread;
    for (const [x, s] of [[-1.6, 1], [1.6, 1]]) mesh(new T.BoxGeometry(1.2 * s, 1, 1.2 * s), M('#3a4a63'), x, .9, 0, compare); }

  ctx.base = { ...ctx.base, rails: false, trainX: null, city: false, webs: 0, webFrom: null, spider: false, silkBall: false, spiders: false, compare: false };
  [rails, train, city, spider, ball, crowdG, compare, ...strands].forEach(m => (m.visible = false));
  ctx.hooks.push((st, t) => {
    rails.visible = st.rails; city.visible = st.city; train.visible = st.trainX != null; if (st.trainX != null) train.position.set(st.trainX, 0, 0);
    spider.visible = st.spider; bug.rotation.z = Math.sin(t * 1.3) * .05; ball.visible = st.silkBall; ball.rotation.y = t * .3; crowdG.visible = st.spiders; compare.visible = st.compare;
  });
  ctx.post.push((st, t) => {
    const n = Math.round(NW * clamp(st.webs, 0, 1)), front = V3((st.trainX ?? 0) + .5, 2.6, 0);
    strands.forEach((m, k) => { m.visible = k < n; if (!m.visible) return; let a;
      if (st.webFrom === 'tolik' && st.tolik) { a = V3(...st.tolik.at).add(V3(.6, 2.6, 0)); m.scale.x = m.scale.z = 1; } else a = anchors[k].clone().add(V3(front.x, 0, 0));
      const shoot = clamp((st.webs * NW - k), 0, 1), b = a.clone().lerp(front.clone().add(V3(0, (k % 3 - 1) * .5, (k % 2 ? 1 : -1) * .6)), eo(shoot)); between(m, a, b); });
    if (st.webFrom === 'tolik' && st.tolik) { const u = tolik.userData; u.armR.rotation.z = 1.6; u.armR.rotation.x = 0; }
  });

  const TX = (u, x0, x1, brake = 0) => lerp(x0, x1, brake ? eo(u) : u);
  S.webOpen = (u, o, s) => { s.rails = true; s.city = true; s.trainX = TX(u, -160, -10); s.tolik = { at: [12, .3, 0], ry: -Math.PI / 2, mood: u > .5 ? 'shock' : 'happy', wave: u < .5 };
    return camPath(u, [[0, [40, 30, 40], [-40, 2, 0], 45], [.5, [20, 4, 10], [-20, 2, 0], 50], [1, [16, 3.6, 6], [6, 2.4, 0], 45]]); };
  S.webTease = (u, o, s) => { s.rails = true; s.city = true; s.trainX = TX(u, -30, -6, 1); s.webs = .5 + u * .5; return camPath(u, [[0, [6, 3, 8], [-12, 6, 0], 52], [1, [4, 3.4, 7], [-10, 6, 0], 50]]); };
  S.webChapter = (u, o, s) => { s.rails = true; s.city = true; s.trainX = o.stop ? -4 : TX(u, -80, 20); s.webs = o.webs || 0;
    return camPath(u, orbitKeys(36, 64, o.a0 ?? .5, (o.a0 ?? .5) + .7, [-20, 2, 0], 44)); };
  S.trainSide = (u, o, s) => { s.rails = true; s.city = true; const x = TX(u, -60, 40); s.trainX = x; return camPath(u, [[0, [x - 40, 2.5, 9], [x - 40, 2.4, 0], 50], [1, [x - 36, 2.6, 9.5], [x - 30, 2.4, 0], 50]]); };
  S.trainFront = (u, o, s) => { s.rails = true; s.city = true; s.trainX = TX(u, -70, -6); return camPath(u, [[0, [8, 1.2, 2.4], [-30, 2.4, 0], 42], [1, [8, 1.1, 2.8], [-6, 2.6, 0], 50]]); };
  S.spiderMacro = (u, o, s) => { s.spider = true; return camPath(u, [[0, [2.2, 3.8, 7.6], [.2, 3, 0], 40], [1, [1.6, 3.6, 6.8], [.2, 3, 0], 38]]); };
  S.silkBall = (u, o, s) => { s.silkBall = true; s.tolik = { at: [-.4, 0, 6.6], ry: .4, mood: o.mood || 'shock' }; return camPath(u, [[0, [3, 2.8, 15], [1, 1.8, 6], 40], [1, [2.4, 2.6, 13.8], [1, 1.8, 6], 38]]); };
  S.webShoot = (u, o, s) => { s.rails = true; s.city = true; s.trainX = TX(prog(u, 0, .9), -40, -8, 1); s.webs = eo(prog(u, .05, .5)); s.webFrom = o.tolik ? 'tolik' : null; if (o.tolik) s.tolik = { at: [6, .3, 0], ry: -Math.PI / 2, mood: 'happy' };
    return camPath(u, [[0, [12, 3, 8], [-14, 4, 0], 50], [1, [9, 5, 9], [-10, 6, 0], 52]]); };
  S.webHold = (u, o, s) => { s.rails = true; s.city = true; s.trainX = -8; s.webs = 1; return camPath(u, [[0, [8, 4, 9], [-10, 7, 0], 52], [1, [7.6, 4, 8.6], [-10, 7, 0], 52]]); };
  S.tolikPulled = (u, o, s) => { s.rails = true; s.city = true; const x = TX(u, -26, 30); s.trainX = x; s.webs = 1; s.webFrom = 'tolik'; const k = ei(prog(u, .25, 1));
    s.tolik = { at: [lerp(6, 46, k), .3 + Math.sin(k * Math.PI) * 6, lerp(0, 2, k)], ry: -Math.PI / 2, mood: 'shock' }; return camPath(u, [[0, [16, 4, 9], [0, 3, 0], 50], [1, [44, 9, 10], [38, 4, 0], 52]]); };
  S.spiders = (u, o, s) => { s.spiders = true; s.tolik = { at: [-5.4, 0, 2], ry: .6, mood: 'shock' }; return camPath(u, [[0, [2, 3, 16], [0, 0, 4], 42], [1, [8, 14, 20], [0, 0, 4], 46]]); };
  S.cableCompare = (u, o, s) => { s.compare = true; return camPath(u, [[0, [-3, 3.4, 13], [-3, 3, 6], 38], [1, [-2.4, 3.2, 12.2], [-3, 3, 6], 36]]); };
  S.webEverything = (u, o, s) => { s.rails = true; s.city = true; s.trainX = -8; s.webs = 1; s.silkBall = true; return camPath(u, [[0, [36, 70, 24], [-10, 2, 0], 46], [1, [32, 66, 22], [-10, 2, 0], 46]]); };
  void rnd; void sm;
}
