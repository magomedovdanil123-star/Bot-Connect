// Набор «бассейн из колы»: олимпийский бассейн 50 × 25 × 2 м (1 ед. = 1 м), кола с пузырями, вышка, гора банок, банка крупно, стопка банок в небо,
// гора сахара, облако углекислого газа, аквариум «тонет / плавает», цистерны, брызги. Выпуск 6005.
import { canvasTex, makeTruck, envMap } from './_lib.js';

export default function cola(ctx) {
  const { T, scene, M, mesh, rnd, S, camPath, orbitKeys, sm, ei, eo, prog, lerp, clamp, V3 } = ctx, env = envMap(ctx);
  const PC = V3(0, 0, -16), PL = 50, PW = 25, PD = 2.2;   // бассейн стоит на земле: борта 2,2 м
  const pool = new T.Group(); pool.position.copy(PC); scene.add(pool);
  const tile = canvasTex(ctx, 256, 256, (x, w) => { x.fillStyle = '#e8f4fb'; x.fillRect(0, 0, w, w); x.strokeStyle = '#b8d4e4'; x.lineWidth = 3; for (let i = 0; i <= w; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, w); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } });
  tile.wrapS = tile.wrapT = T.RepeatWrapping; tile.repeat.set(12, 1);
  const wallM = M('#ffffff', { map: tile, roughness: .5 });
  mesh(new T.BoxGeometry(PL + 2, .3, PW + 2), M('#d9e6ee'), 0, .15, 0, pool);
  for (const [w, d, x, z] of [[PL + 2, .8, 0, PW / 2 + .6], [PL + 2, .8, 0, -PW / 2 - .6], [.8, PW + 2, PL / 2 + .6, 0], [.8, PW + 2, -PL / 2 - .6, 0]]) mesh(new T.BoxGeometry(w, PD, d), wallM, x, PD / 2, z, pool);
  for (const [w, d, x, z] of [[PL + 6, 2.4, 0, PW / 2 + 2.2], [PL + 6, 2.4, 0, -PW / 2 - 2.2], [2.4, PW + 6.8, PL / 2 + 2.2, 0], [2.4, PW + 6.8, -PL / 2 - 2.2, 0]]) mesh(new T.BoxGeometry(w, .2, d), M('#c9d6de'), x, PD + .1, z, pool);
  for (let k = 1; k < 8; k++) { const r = mesh(new T.CylinderGeometry(.07, .07, PL, 8), M(k % 2 ? '#ff4d6a' : '#ffd400'), 0, 0, -PW / 2 + k * PW / 8, pool, false); r.rotation.z = Math.PI / 2; r.userData.rope = 1; }
  const liqTex = canvasTex(ctx, 256, 256, (x, w) => { const g = x.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w * .7); g.addColorStop(0, '#5a2a12'); g.addColorStop(1, '#2a0f05'); x.fillStyle = g; x.fillRect(0, 0, w, w); for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(255,220,180,${.05 + rnd(i + 70000) * .12})`; x.beginPath(); x.arc(rnd() * w, rnd() * w, 1 + rnd() * 2, 0, 6.28); x.fill(); } });
  liqTex.wrapS = liqTex.wrapT = T.RepeatWrapping; liqTex.repeat.set(6, 3);
  const liquid = mesh(new T.BoxGeometry(PL, 1, PW), new T.MeshPhysicalMaterial({ color: '#7a2c0c', map: liqTex, roughness: .05, metalness: 0, clearcoat: 1, clearcoatRoughness: .05, envMap: env, envMapIntensity: .45 }), 0, 0, 0, pool, false);
  const foam = mesh(new T.PlaneGeometry(PL, PW), new T.MeshStandardMaterial({ color: '#e8cfb0', transparent: true, opacity: .35, roughness: 1 }), 0, 0, 0, pool, false); foam.rotation.x = -Math.PI / 2;
  const NBb = 500, bub = new T.InstancedMesh(new T.SphereGeometry(.11, 8, 6), new T.MeshStandardMaterial({ color: '#fff1dc', transparent: true, opacity: .9 }), NBb); bub.frustumCulled = false; pool.add(bub);
  const BB = [...Array(NBb)].map((_, i) => ({ x: (rnd(i + 71000) - .5) * PL * .95, z: (rnd() - .5) * PW * .95, ph: rnd(), s: .6 + rnd() * 1.4, sp: .3 + rnd() * .6 }));
  // вышка
  const tower = new T.Group(); tower.position.set(-PL / 2 - 1.2, 0, 0); pool.add(tower); { const tm = M('#c9d1db', { metalness: .4, roughness: .4 }); for (const z of [-1, 1]) mesh(new T.BoxGeometry(.4, 6, .4), tm, 0, 3, z, tower);
    mesh(new T.BoxGeometry(5, .25, 1.2), M('#2f6fd6'), 2.6, 6, 0, tower); for (let k = 0; k < 8; k++) mesh(new T.BoxGeometry(.2, .1, 2), tm, -.4, .5 + k * .7, 0, tower); }
  // банка
  const label = canvasTex(ctx, 512, 256, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#e3182d'); g.addColorStop(1, '#a50f20'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.font = '900 92px Montserrat'; x.textAlign = 'center'; x.fillText('КОЛА', w * .3, h * .62); x.fillText('КОЛА', w * .8, h * .62); x.fillRect(0, h * .78, w, 10); x.fillStyle = '#ffd400'; x.fillRect(0, h * .84, w, 8); });
  const canMats = [new T.MeshStandardMaterial({ map: label, metalness: .55, roughness: .3, envMap: env }), new T.MeshStandardMaterial({ color: '#d9dde3', metalness: .9, roughness: .25, envMap: env }), new T.MeshStandardMaterial({ color: '#d9dde3', metalness: .9, roughness: .25, envMap: env })];
  const canGeo = new T.CylinderGeometry(.033, .033, .115, 20);   // 330 мл: Ø 6,6 см × 11,5 см
  const heroCan = new T.Group(); scene.add(heroCan); { const c = new T.Mesh(canGeo, canMats); c.castShadow = true; heroCan.add(c); const tab = mesh(new T.TorusGeometry(.009, .002, 6, 12), canMats[1], .008, .0585, 0, heroCan); tab.rotation.x = Math.PI / 2; }
  const inst = (n, geo, mats, place) => { const m = new T.InstancedMesh(geo, mats, n), o = new T.Object3D(); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; for (let i = 0; i < n; i++) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); place(i, o); o.updateMatrix(); m.setMatrixAt(i, o.matrix); } return m; };
  const CS = 9;   // банки в горе и стопке увеличены в 9 раз, чтобы их было видно рядом с Толиком
  const canPile = inst(1800, canGeo, canMats, (i, o) => { const a = rnd(i * 5 + 72000) * 6.28, r = Math.sqrt(rnd()) * 7, y = 3.6 * (1 - r / 7); o.position.set(Math.cos(a) * r, Math.max(.3, y + (rnd() - .7) * .4), Math.sin(a) * r); o.rotation.set(rnd() * 6, rnd() * 6, rnd() * 6); o.scale.setScalar(CS); });
  const pileG = new T.Group(); pileG.position.set(14, 0, 12); pileG.add(canPile); mesh(new T.ConeGeometry(6.7, 3.4, 40), M('#9a1222'), 0, 1.7, 0, pileG, false); scene.add(pileG);
  const canStack = inst(1600, canGeo, canMats, (i, o) => { o.position.set(0, .115 * CS * (i + .5), 0); o.rotation.y = rnd(i + 73000) * 6; o.scale.setScalar(CS); }); const stackG = new T.Group(); stackG.position.set(-8, 0, 8); stackG.add(canStack); scene.add(stackG);
  // сахар
  const sugar = new T.Group(); sugar.position.set(-14, 0, 10); scene.add(sugar);
  sugar.add(inst(1600, new T.BoxGeometry(.45, .45, .45), M('#ffffff', { roughness: .9 }), (i, o) => { const a = rnd(i * 3 + 74000) * 6.28, r = Math.sqrt(rnd()) * 7.5, y = 4.5 * (1 - r / 7.5); o.position.set(Math.cos(a) * r, Math.max(.22, y + (rnd() - .7) * .3), Math.sin(a) * r); o.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); }));
  mesh(new T.ConeGeometry(7.2, 4.3, 40), M('#f4f4f4', { roughness: 1 }), 0, 2.15, 0, sugar, false);
  // облако CO₂
  const co2 = new T.Group(); co2.position.copy(PC); scene.add(co2); for (let i = 0; i < 26; i++) { const c = mesh(new T.SphereGeometry(5 + rnd(i + 75000) * 4, 16, 12), new T.MeshStandardMaterial({ color: '#eef1f5', transparent: true, opacity: .5, depthWrite: false }), (rnd() - .5) * 46, PD + .8, (rnd() - .5) * 22, co2, false); c.scale.y = .3; }
  // аквариум: обычная кола тонет, «без сахара» плавает
  const tank = new T.Group(); tank.position.set(4, 0, 9); scene.add(tank); { mesh(new T.BoxGeometry(3.2, 1, 1.6), M('#3a4a63'), 0, .5, 0, tank);
    mesh(new T.BoxGeometry(3, 2.4, 1.4), new T.MeshPhysicalMaterial({ color: '#bfe6ff', transparent: true, opacity: .25, roughness: .05, depthWrite: false }), 0, 2.2, 0, tank, false);
    mesh(new T.BoxGeometry(2.9, 2, 1.3), new T.MeshStandardMaterial({ color: '#6fc3ff', transparent: true, opacity: .22, depthWrite: false }), 0, 2.02, 0, tank, false); }
  const dietMats = [new T.MeshStandardMaterial({ map: canvasTex(ctx, 512, 256, (x, w, h) => { x.fillStyle = '#c9cfd8'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.font = '900 70px Montserrat'; x.textAlign = 'center'; x.fillText('БЕЗ САХАРА', w / 2, h * .6); }), metalness: .5, roughness: .3, envMap: env }), canMats[1], canMats[2]];
  const canA = new T.Mesh(canGeo, canMats), canB = new T.Mesh(canGeo, dietMats); [canA, canB].forEach(c => { c.scale.setScalar(6); c.castShadow = true; tank.add(c); });
  // цистерны
  const trucks = []; for (let k = 0; k < 7; k++) { const t = makeTruck(ctx, '#ffb000'); t.rotation.y = Math.PI / 2; scene.add(t); trucks.push(t); }
  // брызги
  const NS = 160, splash = new T.InstancedMesh(new T.SphereGeometry(.18, 8, 6), M('#6a2f12', { roughness: .2 }), NS); splash.frustumCulled = false; scene.add(splash);
  const SPd = [...Array(NS)].map((_, i) => ({ a: rnd(i + 76000) * 6.28, v: 3 + rnd() * 6, up: 6 + rnd() * 7 }));
  const o = new T.Object3D();

  ctx.base = { ...ctx.base, pool: false, fill: 1, heroCan: null, canPile: false, canStack: 0, sugar: false, co2: 0, tank: 0, tankers: 0, splash: -1, fizz: 1 };
  const all = [pool, heroCan, pileG, stackG, sugar, co2, tank, splash, ...trucks]; all.forEach(m => (m.visible = false));
  ctx.hooks.push((st, t) => {
    pool.visible = st.pool; if (st.pool) { const lv = .3 + (PD - .45) * clamp(st.fill, 0, 1); liquid.visible = foam.visible = bub.visible = st.fill > .01; liquid.scale.y = Math.max(.01, lv - .3); liquid.position.y = .3 + (lv - .3) / 2; foam.position.y = lv + .01;
      foam.material.opacity = .35 * st.fizz; pool.children.forEach(c => { if (c.userData.rope) { c.visible = st.fill > .9; c.position.y = lv + .03; } }); liqTex.offset.set(t * .01, t * .006);
      for (let i = 0; i < NBb; i++) { const b = BB[i], f = (t * b.sp + b.ph) % 1, y = .35 + f * (lv - .35); o.position.set(b.x, y, b.z); o.rotation.set(0, 0, 0); o.scale.setScalar(b.s * (i < NBb * st.fizz ? 1 : 0)); o.updateMatrix(); bub.setMatrixAt(i, o.matrix); } bub.instanceMatrix.needsUpdate = true; }
    heroCan.visible = !!st.heroCan; if (st.heroCan) { heroCan.position.set(...st.heroCan.at); heroCan.scale.setScalar(st.heroCan.s || 30); heroCan.rotation.set(0, t * .6, .12); }
    pileG.visible = st.canPile; stackG.visible = st.canStack > 0; canStack.count = Math.round(clamp(st.canStack, 0, 1600)); sugar.visible = st.sugar;
    co2.visible = st.co2 > 0; co2.children.forEach((c, i) => { c.material.opacity = .5 * st.co2; c.position.x += Math.sin(t * .3 + i) * .002; });
    tank.visible = st.tank > 0; if (st.tank > 0) { const k = clamp(st.tank, 0, 1); canA.position.set(-.6, lerp(3.6, 1.38, ei(prog(k, .15, .8))), 0); canA.rotation.set(0, t * .4, k * .2); canB.position.set(.6, lerp(3.6, 2.9, eo(prog(k, .15, .5))) + Math.sin(t * 2) * .03, 0); canB.rotation.set(0, -t * .4, 0); }
    trucks.forEach((tr, k) => { tr.visible = k < Math.ceil(st.tankers * trucks.length); tr.position.set(-40 + k * 14 + (t * 4) % 14, 0, 14); });
    splash.visible = st.splash >= 0; if (st.splash >= 0) { const f = st.splash; for (let i = 0; i < NS; i++) { const p = SPd[i], r = p.v * f, y = PD - .2 + p.up * f - 9.8 * f * f * .9; o.position.set(PC.x - 10 + Math.cos(p.a) * r, Math.max(PD - .3, y), PC.z + Math.sin(p.a) * r); o.scale.setScalar(y < PD - .25 ? 0 : 1); o.updateMatrix(); splash.setMatrixAt(i, o.matrix); } splash.instanceMatrix.needsUpdate = true; }
  });
  void sm;

  const P = (x, y, z) => [PC.x + x, PC.y + y, PC.z + z], top = PD + .2;
  S.colaOpen = (u, o, s) => { s.pool = true; s.tolik = { at: P(-PL / 2 + 2.6, 6.1, 0), ry: Math.PI / 2, wave: true, mood: 'happy', s: 1 };
    return camPath(u, [[0, P(40, 30, 50), P(0, 0, 0), 42], [.55, P(-6, 9, 14), P(-PL / 2 + 2, 6, 0), 45], [1, P(-15, 8.5, 8), P(-PL / 2 + 2.4, 7.4, 0), 42]]); };
  S.colaTease = (u, o, s) => { s.pool = true; return camPath(u, [[0, P(8, top + 4, 12), P(0, top, -4), 48], [1, P(6, top + 3, 9), P(0, top, -4), 46]]); };
  S.colaChapter = (u, o, s) => { s.pool = true; s.fill = o.fill ?? 1; return camPath(u, orbitKeys(48, 22, o.a0 ?? .4, (o.a0 ?? .4) + .8, [0, 0, 0], 44).map(k => [k[0], P(...k[1]), P(...k[2]), k[3]])); };
  S.poolEmpty = (u, o, s) => { s.pool = true; s.fill = 0; s.tolik = { at: P(0, .3, 0), ry: .3, mood: 'happy', wave: true }; return camPath(u, [[0, P(10, 30, 36), P(0, 0, 0), 45], [1, P(-6, 22, 30), P(0, 0, 0), 45]]); };
  S.canMacro = (u, o, s) => { s.heroCan = { at: [0, 1.75, 0], s: 30 }; return camPath(u, [[0, [3.2, 2.6, 6.5], [0, 1.8, 0], 38], [1, [2.4, 2.3, 5.8], [0, 1.8, 0], 36]]); };
  S.canPile = (u, o, s) => { s.canPile = true; s.tolik = { at: [14, 3.3, 12], ry: .4, mood: o.mood || 'shock' }; return camPath(u, [[0, [26, 6, 30], [14, 2.4, 12], 45], [1, [22, 9, 32], [14, 2.6, 12], 45]]); };
  S.canStack = (u, o, s) => { const n = Math.round(lerp(20, 1600, ei(prog(u, .05, .9)))), y = n * .115 * CS; s.canStack = n; s.sky = clamp(y / 1650 * .6, 0, .6); s.ground = y < 700; s.lowClouds = y > 300; s.cloudY = 260;
    return { p: V3(-8 + 6, y + 2.5, 8 + 9), l: V3(-8, y - 2, 8), fov: 50 }; };
  S.tankers = (u, o, s) => { s.pool = true; s.fill = lerp(.1, .5, u); s.tankers = 1; return camPath(u, [[0, [-30, 4, 34], [-6, 2, 14], 50], [1, [10, 12, 40], [0, 2, 6], 48]]); };
  S.colaFill = (u, o, s) => { s.pool = true; s.fill = lerp(o.f0 ?? 0, o.f1 ?? 1, sm(u)); s.sunA = o.time ? u * 6 : 0; s.tolik = { at: P(-4, top, PW / 2 + 1.6), ry: Math.PI + .3, mood: 'happy' };
    return camPath(u, [[0, P(14, 9, 26), P(0, 0, 0), 46], [1, P(10, 11, 24), P(0, 0, 0), 46]]); };
  S.sugarPile = (u, o, s) => { s.sugar = true; s.tolik = { at: [-14, 4.5, 10], ry: .5, mood: o.mood || 'happy', wave: true }; return camPath(u, [[0, [-2, 7, 30], [-14, 3, 10], 44], [1, [-4, 10, 28], [-14, 3.4, 10], 44]]); };
  S.co2 = (u, o, s) => { s.pool = true; s.co2 = eo(prog(u, 0, .6)); s.fizz = 1; s.tolik = { at: P(-6, top - .1, PW / 2 + 1.4), ry: .3, mood: 'shock' }; return camPath(u, [[0, P(-24, 12, 34), P(-2, 2, 0), 46], [1, P(-16, 9, 28), P(-4, 2.4, 4), 46]]); };
  S.tankTest = (u, o, s) => { s.tank = u; return camPath(u, [[0, [4.6, 2.7, 17], [4, 2.3, 9], 30], [1, [4.3, 2.6, 16.2], [4, 2.3, 9], 29]]); };
  S.colaDive = (u, o, s) => { s.pool = true; const f = prog(u, .12, .5), x = -PL / 2 + 2.6 + f * 6, y = 6.1 + Math.sin(f * Math.PI) * 2.4 - f * (6.1 - PD + .5);
    s.tolik = u < .5 ? { at: P(x, y, 0), ry: Math.PI / 2, mood: 'happy', s: 1 } : null; s.splash = u >= .48 ? (u - .48) * 1.4 : -1;
    return camPath(u, [[0, P(-12, 6, 16), P(-PL / 2 + 6, 5, 0), 45], [1, P(-14, 5, 18), P(-PL / 2 + 9, 3, 0), 45]]); };
  S.colaFlat = (u, o, s) => { s.pool = true; s.fizz = lerp(1, 0, sm(u)); s.sunA = u * 3; return camPath(u, [[0, P(6, top + 2, 10), P(0, top, -6), 48], [1, P(4, top + 1.4, 8), P(0, top, -6), 46]]); };
  S.colaSad = (u, o, s) => { s.pool = true; s.tolik = { at: P(-6, top - .1, PW / 2 + 1.4), ry: .3, mood: o.mood || 'sad' }; return camPath(u, [[0, P(-1.5, top + 2.4, PW / 2 + 9), P(-6, top + 2, PW / 2 + 1.4), 40], [1, P(-1.8, top + 2.4, PW / 2 + 8.4), P(-6, top + 2, PW / 2 + 1.4), 38]]); };
  S.colaEverything = (u, o, s) => { s.pool = true; s.canPile = true; s.sugar = true; s.tankers = 1; return camPath(u, [[0, [60, 40, 70], [0, 2, 0], 46], [1, [56, 38, 66], [0, 2, 0], 46]]); };
}
