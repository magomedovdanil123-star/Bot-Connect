// Набор «монеты»: гора монет, стопка до космоса, монета крупно, колонна грузовиков, ряд монет до горизонта, копилка, счётная машинка, МКС.
// Выпуски: 6003 «Миллиард рублей монетами», 6004 «Каждый человек на Земле даёт тебе рубль».
import { envMap, canvasTex, makeTruck } from './_lib.js';

export default function coins(ctx) {
  const { T, scene, M, mesh, rnd, S, camPath, orbitKeys, sm, ei, eo, prog, lerp, clamp, V3 } = ctx, env = envMap(ctx);
  const metal = (o = {}) => new T.MeshStandardMaterial({ color: '#e4e8ee', metalness: .92, roughness: .28, envMap: env, envMapIntensity: 1.1, ...o });
  const face = canvasTex(ctx, 512, 512, (x, w) => {
    const g = x.createRadialGradient(w / 2, w / 2, 20, w / 2, w / 2, w / 2); g.addColorStop(0, '#f4f6f9'); g.addColorStop(1, '#b9c0ca'); x.fillStyle = g; x.fillRect(0, 0, w, w);
    x.strokeStyle = '#8f98a5'; x.lineWidth = 14; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 22, 0, 6.28); x.stroke();
    x.fillStyle = '#7d8693'; x.textAlign = 'center'; x.font = '900 250px Montserrat'; x.fillText('1', w / 2, w / 2 + 70); x.font = '900 64px Montserrat'; x.fillText('РУБЛЬ', w / 2, w / 2 + 160);
    for (let k = 0; k < 9; k++) { const a = -2.4 + k * .17; x.beginPath(); x.ellipse(w / 2 + Math.cos(a) * 170, w / 2 + Math.sin(a) * 170, 18, 8, a, 0, 6.28); x.fill(); }
  });
  const edge = canvasTex(ctx, 512, 16, (x, w, h) => { x.fillStyle = '#c9cfd8'; x.fillRect(0, 0, w, h); x.fillStyle = '#9aa2ad'; for (let i = 0; i < w; i += 4) x.fillRect(i, 0, 2, h); });
  const coinMats = [metal({ map: edge }), metal({ map: face }), metal({ map: face })];
  const coinGeo = new T.CylinderGeometry(1.025, 1.025, .15, 28);   // 20,5 мм × 1,5 мм — настоящие пропорции рубля
  const inst = (n, place, geo = coinGeo, mats = coinMats) => { const m = new T.InstancedMesh(geo, mats, n), o = new T.Object3D(); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    for (let i = 0; i < n; i++) { o.position.set(0, 0, 0); o.rotation.set(0, 0, 0); o.scale.set(1, 1, 1); place(i, o); o.updateMatrix(); m.setMatrixAt(i, o.matrix); } return m; };

  // гора монет
  const PR = 11, PHt = 6.5, pile = new T.Group(); pile.position.set(-14, 0, 4); scene.add(pile);
  mesh(new T.ConeGeometry(PR * .96, PHt * .96, 48), metal({ color: '#aab2bd', roughness: .45 }), 0, PHt * .48, 0, pile);
  pile.add(inst(2600, (i, o) => { const a = rnd(i * 7 + 5000) * 6.28, r = Math.sqrt(rnd()) * PR, y = PHt * (1 - r / PR); o.position.set(Math.cos(a) * r, Math.max(.08, y + (rnd() - .7) * .3), Math.sin(a) * r); o.rotation.set((rnd() - .5) * 1.6, rnd() * 6, (rnd() - .5) * 1.6); }));
  // стопка
  const NS = 1500, stack = new T.Group(); stack.position.set(6, 0, -2); scene.add(stack);
  const stackM = inst(NS, (i, o) => { o.position.set((rnd(i + 9000) - .5) * .06, .075 + i * .15, (rnd() - .5) * .06); o.rotation.y = rnd() * 6; }); stack.add(stackM);
  const sq = new T.Object3D();
  // монета крупно
  const hero = new T.Group(); scene.add(hero); const faceUp = face.clone(); faceUp.center.set(.5, .5); faceUp.rotation = Math.PI / 2; faceUp.needsUpdate = true;   // стоячая монета: надпись по горизонтали
  const heroC = new T.Mesh(coinGeo, [coinMats[0], metal({ map: faceUp }), metal({ map: faceUp })]); heroC.castShadow = true; heroC.rotation.x = Math.PI / 2; hero.add(heroC);   // стоит на ребре, лицом к камере
  // ряд монет до горизонта
  const line = inst(800, (i, o) => o.position.set(-3, .075, -2 - i * 2.06)); scene.add(line);
  // колонна грузовиков и дорога
  const road = mesh(new T.BoxGeometry(400, .05, 8), M('#5b6470', { roughness: .95 }), 0, .03, 24, scene, false); road.receiveShadow = true;
  const trucks = []; for (let k = 0; k < 9; k++) { const t = makeTruck(ctx, ['#ff5a3c', '#2f6fd6', '#ffb000'][k % 3]); t.rotation.y = Math.PI / 2; scene.add(t); trucks.push(t);
    const load = inst(30, (i, o) => { o.position.set((i % 3 - 1) * .8, 3.3 + Math.floor(i / 15) * .16, -2.6 + (Math.floor(i / 3) % 5) * 1.1); o.rotation.set((rnd(i + k * 50) - .5) * .4, rnd() * 6, 0); o.scale.setScalar(.38); }); t.add(load); }
  // копилка
  const piggy = new T.Group(); piggy.position.set(4, 0, 7); scene.add(piggy); { const pm = new T.MeshPhysicalMaterial({ color: '#ff8fb1', roughness: .3, clearcoat: .8 });
    const b = mesh(new T.SphereGeometry(1.6, 32, 24), pm, 0, 1.9, 0, piggy); b.scale.set(1.25, 1, 1); const sn = mesh(new T.CylinderGeometry(.5, .55, .5, 24), pm, 2.05, 1.9, 0, piggy); sn.rotation.z = Math.PI / 2;
    for (const z of [-.18, .18]) mesh(new T.SphereGeometry(.08, 10, 8), M('#b04a6a'), 2.32, 1.9, z, piggy); for (const z of [-.7, .7]) { mesh(new T.ConeGeometry(.35, .6, 16), pm, 1.1, 3.2, z, piggy).rotation.z = -.4; mesh(new T.SphereGeometry(.12, 10, 8), M('#1b1b1b'), 1.75, 2.5, z * .7, piggy); }
    for (const x of [-1, 1]) for (const z of [-.7, .7]) mesh(new T.CylinderGeometry(.3, .3, .7, 16), pm, x, .35, z, piggy); mesh(new T.BoxGeometry(.9, .1, .18), M('#3b2030'), 0, 2.92, 0, piggy); }
  const drop = new T.Mesh(coinGeo, coinMats); drop.scale.setScalar(.55); scene.add(drop);
  // счётная машинка
  const machine = new T.Group(); machine.position.set(-4, 0, 7); scene.add(machine); { const mm = M('#3a4a63', { roughness: .4 });
    mesh(new T.BoxGeometry(3, 1.2, 2.2), M('#c9d1db', { metalness: .3, roughness: .4 }), 0, .6, 0, machine); mesh(new T.BoxGeometry(2.6, 1.6, 1.8), mm, 0, 2, 0, machine);
    const hop = mesh(new T.CylinderGeometry(1.2, .5, 1, 24, 1, true), M('#c9d1db', { metalness: .4, roughness: .35, side: T.DoubleSide }), 0, 3.3, 0, machine); void hop;
    mesh(new T.BoxGeometry(1.4, .5, .05), M('#9cff9c', { emissive: '#3cff6a', emissiveIntensity: .8 }), 0, 2.2, .93, machine); }
  const flow = inst(40, () => {}, coinGeo, coinMats); scene.add(flow); flow.scale.setScalar(1);
  // МКС
  const iss = new T.Group(); scene.add(iss); { const sm2 = metal({ color: '#d6dbe2', roughness: .35 }), pan = M('#1d3f8f', { metalness: .4, roughness: .3, emissive: '#0a1d50', emissiveIntensity: .3 });
    mesh(new T.BoxGeometry(34, .6, .6), sm2, 0, 0, 0, iss); for (const x of [-15, -11, 11, 15]) for (const z of [-1, 1]) mesh(new T.BoxGeometry(2.6, .06, 7.5), pan, x, 0, z * 4.4, iss);
    for (const [x, l] of [[0, 9], [-3, 5]]) { const c = mesh(new T.CylinderGeometry(.9, .9, l, 20), sm2, x, 0, 0, iss); c.rotation.x = Math.PI / 2; } mesh(new T.BoxGeometry(5, .05, 2), M('#f2f2f2'), 3, 1.2, 0, iss); }
  // стол для счёта
  const desk = new T.Group(); desk.position.set(3, 0, 6.5); scene.add(desk); { const wd = M('#a06a44'); mesh(new T.BoxGeometry(3.6, .14, 1.8), wd, 0, 1.15, 0, desk); for (const x of [-1.6, 1.6]) for (const z of [-.7, .7]) mesh(new T.BoxGeometry(.14, 1.1, .14), wd, x, .55, z, desk); }
  const deskStacks = inst(60, (i, o) => { o.position.set(-1.3 + (i % 6) * .5, 1.3 + Math.floor(i / 6) * .06, -.3 + (i % 2) * .4); o.scale.setScalar(.22); }); desk.add(deskStacks);

  ctx.base = { ...ctx.base, coinPile: 0, coinN: 0, heroCoin: null, trucks: 0, coinLine: false, piggy: null, machine: false, iss: false, crush: 0, desk: 0 };
  const all = [pile, stack, hero, line, road, piggy, drop, machine, flow, iss, desk, ...trucks]; all.forEach(o => (o.visible = false));
  ctx.hooks.push((st, t) => {
    pile.visible = st.coinPile > 0; pile.scale.setScalar(Math.max(.01, st.coinPile));
    stack.visible = st.coinN > 0; stackM.count = Math.round(clamp(st.coinN, 0, NS));
    for (let i = 0; i < 4; i++) { const k = i === 0 ? st.crush : st.crush * (.5 - i * .12); sq.position.set(0, .075 + i * .15 - st.crush * .05 * (4 - i), 0); sq.rotation.set(0, i, 0); sq.scale.set(1 + k * .45, Math.max(.25, 1 - k * .7), 1 + k * .45); sq.updateMatrix(); stackM.setMatrixAt(i, sq.matrix); }
    stackM.instanceMatrix.needsUpdate = true;
    hero.visible = !!st.heroCoin; if (st.heroCoin) { const h = st.heroCoin; hero.position.set(...h.at); hero.scale.setScalar(h.s || 1); hero.rotation.set(0, h.spin ? t * .8 : h.flat ? 1.45 : -.3, 0); }
    line.visible = st.coinLine; road.visible = st.trucks > 0;
    trucks.forEach((tr, k) => { tr.visible = k < Math.ceil(st.trucks * trucks.length); tr.position.set(-70 + k * 15 + t * 4 % 15, 0, 24); });
    piggy.visible = drop.visible = !!st.piggy; if (st.piggy) { const f = (t * 1.3) % 1; drop.position.set(4, 3.1 + (1 - ei(f)) * 2.5, 7); drop.rotation.set(0, 0, Math.PI / 2); drop.visible = f < .95; piggy.rotation.y = -.5 + Math.sin(t * .6) * .05; piggy.position.y = f > .9 ? .05 : 0; }
    machine.visible = flow.visible = st.machine; if (st.machine) { const o = new T.Object3D(); for (let i = 0; i < 40; i++) { const f = (t * .9 + i / 40) % 1; o.position.set(-4 + Math.sin(i * 2.1) * .5 * (1 - f), 4.6 - f * 1.6, 7 + Math.cos(i * 1.7) * .5 * (1 - f)); o.rotation.set(i, t * 3 + i, 0); o.scale.setScalar(.3); o.updateMatrix(); flow.setMatrixAt(i, o.matrix); } flow.instanceMatrix.needsUpdate = true; }
    iss.visible = st.iss; if (st.iss) { iss.position.set(14, NS * .15 - 6, -10); iss.rotation.set(.3, .4 + t * .02, .15); }
    desk.visible = st.desk > 0; deskStacks.count = Math.round(lerp(6, 60, st.desk));
  });

  const top = n => n * .15, SP = V3(6, 0, -2);
  S.coinOpen = (u, o, s) => { s.coinPile = 1; s.tolik = { at: [-14, PHt - .2, 4], ry: .5, wave: true, mood: 'happy' };
    return camPath(u, [[0, [30, 40, 60], [-14, 4, 4], 40], [.6, [2, 12, 26], [-14, 5, 4], 42], [1, [-6, 9, 16], [-14, 7, 4], 40]]); };
  S.coinTease = (u, o, s) => { s.coinN = NS; return camPath(u, [[0, [9.2, .8, 1.6], [6, 60, -2], 72], [1, [8.8, .8, 1.2], [6, 160, -2], 74]]); };
  S.coinChapter = (u, o, s) => { s.coinPile = 1; return camPath(u, orbitKeys(30, 14, o.a0 ?? .4, (o.a0 ?? .4) + .9, [-14, 3, 4], 44).map(k => [k[0], [k[1][0] - 14, k[1][1], k[1][2] + 4], k[2], k[3]])); };
  S.coinMacro = (u, o, s) => { s.heroCoin = { at: [0, 2.8, 0], s: 2.6, spin: o.spin, flat: o.side }; return o.side
    ? camPath(u, [[0, [0, 3.2, 6], [0, 2.8, 0], 36], [1, [1.5, 3.1, 5.5], [0, 2.8, 0], 34]]) : camPath(u, [[0, [5, 4, 9], [0, 2.8, 0], 38], [1, [4, 3.6, 8.2], [0, 2.8, 0], 36]]); };
  S.coinPileGrow = (u, o, s) => { s.coinPile = lerp(.15, 1, eo(prog(u, 0, .8))); s.tolik = { at: [-2, 0, 14], ry: -.8, mood: 'shock' }; return camPath(u, [[0, [4, 4, 24], [-12, 2, 4], 45], [1, [14, 14, 40], [-14, 3, 4], 45]]); };
  S.coinPileHold = (u, o, s) => { s.coinPile = 1; s.tolik = { at: [-14, PHt - .2, 4], ry: .4, mood: 'happy', s: 1 }; return camPath(u, [[0, [12, 8, 30], [-14, 3.5, 4], 44], [1, [11.5, 8, 29.2], [-14, 3.5, 4], 44]]); };
  S.coinDive = (u, o, s) => { s.coinPile = 1; const f = prog(u, .1, .45), y = u < .45 ? PHt + 3 + Math.sin(f * Math.PI) * 3 - f * 3 : PHt - .1; s.shake = u > .44 && u < .55 ? .7 : 0;
    s.tolik = { at: [-14 + 3 * (1 - f), y, 4], ry: .6, mood: u > .45 ? 'shock' : 'happy', s: 1 }; return camPath(u, [[0, [-4, 9, 16], [-13, 7, 4], 44], [1, [-6, 8.5, 14], [-14, 6.6, 4], 42]]); };
  S.trucks = (u, o, s) => { s.trucks = 1; s.coinPile = 1; return camPath(u, [[0, [-30, 3, 36], [-10, 2, 24], 50], [.5, [-6, 2.2, 32], [10, 2, 24], 55], [.5, [40, 30, 70], [0, 2, 24], 45], [1, [36, 34, 72], [-20, 2, 24], 45]]); };
  S.coinCount = (u, o, s) => { s.desk = u; s.sunA = u * 6; s.tolik = { at: [3, 0, 5.2], ry: Math.PI + .2, mood: u > .6 ? 'sad' : 'happy', s: 1 };
    return camPath(u, [[0, [6.5, 3.4, 11], [3, 1.6, 6], 42], [1, [7, 3.6, 11.6], [3, 1.8, 6], 40]]); };
  S.coinMachine = (u, o, s) => { s.machine = true; s.tolik = { at: [-1.2, 0, 8.2], ry: -.9, mood: 'happy' }; return camPath(u, [[0, [1, 4, 15], [-3.5, 2.6, 7], 40], [1, [-.5, 4.6, 14], [-3.8, 3, 7], 38]]); };
  S.coinGrowFast = (u, o, s) => { const n = Math.round(lerp(10, NS, ei(prog(u, .05, .85)))), y = top(n); s.coinN = n; s.sky = clamp(y / 225 * .7, 0, .7); s.ground = y < 140; s.lowClouds = y > 80; s.cloudY = 70;
    return { p: V3(SP.x + 7, y + 3, SP.z + 10), l: V3(SP.x, y - 2, SP.z), fov: 50 }; };
  S.coinSkyscraper = (u, o, s) => { s.coinN = 700; s.tower = true; return camPath(u, [[0, [30, 30, 110], [-8, 40, -4], 50], [1, [24, 52, 104], [-8, 64, -4], 50]]); };
  S.coinSpace = (u, o, s) => { s.coinN = NS; const y = top(NS); s.sky = o.sky ?? .85; s.ground = false; s.lowClouds = true; s.cloudY = y - 70; s.tolik = { at: [SP.x, y, SP.z], ry: .3, mood: o.mood || 'happy', wave: true, s: .9 };
    return camPath(u, [[0, [SP.x + 8, y - 1, SP.z + 13], [SP.x, y + 1.2, SP.z], 48], [1, [SP.x + 11, y + 3, SP.z + 11], [SP.x, y + 1.5, SP.z], 48]]); };
  S.coinISS = (u, o, s) => { s.coinN = NS; const y = top(NS); s.iss = true; s.sky = 1; s.ground = false; s.lowClouds = true; s.cloudY = y - 90;
    return camPath(u, [[0, [-14, y - 2, 30], [8, y - 4, -6], 50], [1, [-18, y + 2, 34], [8, y - 3, -6], 50]]); };
  S.coinCrush = (u, o, s) => { s.coinN = NS; s.crush = ei(prog(u, .3, .8)); s.shake = u > .3 ? .3 : 0; return camPath(u, [[0, [SP.x + 3.2, .8, SP.z + 4.2], [SP.x, .4, SP.z], 40], [1, [SP.x + 2.6, .6, SP.z + 3.4], [SP.x, .3, SP.z], 38]]); };
  S.coinLine = (u, o, s) => { s.coinLine = true; return camPath(u, [[0, [-.4, 2.4, 3], [-3, 0, -30], 48], [.5, [-.6, 2.6, -40], [-3, 0, -80], 48], [.5, [30, 80, 60], [-3, 0, -300], 48], [1, [26, 120, 40], [-3, 0, -500], 48]]); };
  S.piggy = (u, o, s) => { s.piggy = {}; s.sunA = o.time ? u * 8 : 0; s.tolik = { at: [6.6, 0, 8.4], ry: -1.2, mood: o.mood || 'happy', s: 1 };
    return camPath(u, [[0, [7, 3, 15], [4.5, 2.2, 7], 40], [1, [6, 3.2, 14], [4.5, 2.4, 7], 38]]); };
  S.coinEverything = (u, o, s) => { s.coinPile = 1; s.coinN = 900; s.trucks = 1; s.money = 0; return camPath(u, [[0, [60, 40, 90], [-6, 14, 6], 45], [1, [56, 38, 86], [-6, 14, 6], 45]]); };
}
