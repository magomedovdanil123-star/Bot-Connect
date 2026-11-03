// Набор «яма сквозь Землю»: лопата у Толика, яма и куча земли во дворе, шахта изнутри (с нагревом стен), буровая (Кольская сверхглубокая),
// Земля в разрезе со слоями, линия сквозь центр и падение Толика, гора вынутой земли. Выпуск 6006 (вместе с sets/earth.js — космос и Земля).
import { canvasTex, makeEarth, makeTruck } from './_lib.js';

export default function dig(ctx) {
  const { T, scene, M, mesh, rnd, S, camPath, orbitKeys, sm, ei, eo, prog, lerp, clamp, V3, tolik } = ctx;
  // лопата в правой руке Толика
  const shovel = new T.Group(); tolik.userData.armR.add(shovel); shovel.position.set(0, -.85, 0);
  mesh(new T.CylinderGeometry(.04, .04, 1.6, 8), M('#a06a44'), 0, -.3, 0, shovel); const blade = mesh(new T.BoxGeometry(.32, .42, .04), M('#9aa6b8', { metalness: .6, roughness: .35 }), 0, -1.25, 0, shovel); void blade;
  // яма и куча во дворе
  const yard = new T.Group(); scene.add(yard);
  const hole = mesh(new T.CircleGeometry(1.3, 40), M('#120a05', { roughness: 1 }), 0, .02, 0, yard, false); hole.rotation.x = -Math.PI / 2;
  const rim = mesh(new T.TorusGeometry(1.35, .18, 10, 40), M('#6b4a2e', { roughness: 1 }), 0, .05, 0, yard, false); rim.rotation.x = Math.PI / 2;
  const heap = mesh(new T.ConeGeometry(2.6, 1.6, 24), M('#7a5434', { roughness: 1 }), 4, .8, -1.5, yard); heap.scale.z = .8;
  const clods = new T.InstancedMesh(new T.DodecahedronGeometry(.12, 0), M('#6b4a2e', { roughness: 1 }), 24); clods.frustumCulled = false; yard.add(clods);
  // шахта изнутри
  const strata = canvasTex(ctx, 64, 1024, (x, w, h) => { const cols = ['#7a5434', '#8d6a48', '#6e6258', '#8c8178', '#5f5750', '#7d6a5a', '#4f4741']; let y = 0, k = 0; while (y < h) { const d = 20 + rnd(k + 81000) * 70; x.fillStyle = cols[k % cols.length]; x.fillRect(0, y, w, d); y += d; k++; }
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(0,0,0,${rnd() * .25})`; x.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 4, 2 + rnd() * 3); } });
  strata.wrapS = strata.wrapT = T.RepeatWrapping; strata.repeat.set(4, 6);
  const shaftMat = new T.MeshStandardMaterial({ map: strata, side: T.BackSide, roughness: 1, emissive: '#ff4a00', emissiveIntensity: 0 });
  const shaft = mesh(new T.CylinderGeometry(2.6, 2.6, 120, 32, 1, true), shaftMat, 0, -400, 0, scene, false);
  const shaftFloor = mesh(new T.CircleGeometry(2.6, 32), M('#3a2a1c', { roughness: 1 }), 0, -460, 0, scene, false); shaftFloor.rotation.x = -Math.PI / 2;
  const sky = mesh(new T.CircleGeometry(2.6, 32), new T.MeshBasicMaterial({ color: '#bfe3ff' }), 0, -340.05, 0, scene, false); sky.rotation.x = Math.PI / 2;
  const lamp = new T.PointLight(0xffd9a0, 40, 30, 1.6); scene.add(lamp);
  // буровая (Кольская сверхглубокая)
  const rig = new T.Group(); rig.position.set(-26, 0, -8); scene.add(rig); { const red = M('#d9342b'), wh = M('#f2f2f2'), st = M('#7d8796', { metalness: .5, roughness: .4 });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4, leg = mesh(new T.CylinderGeometry(.18, .25, 30, 8), st, Math.cos(a) * 2.6, 15, Math.sin(a) * 2.6, rig); leg.rotation.set(Math.sin(a) * .08, 0, -Math.cos(a) * .08); }
    for (let k = 0; k < 10; k++) mesh(new T.BoxGeometry(5.4 - k * .38, .5, 5.4 - k * .38), k % 2 ? red : wh, 0, 2 + k * 2.9, 0, rig);
    mesh(new T.BoxGeometry(12, 3, 9), M('#5b6470'), 0, 1.5, 7, rig); mesh(new T.BoxGeometry(12.2, .4, 9.2), red, 0, 3.1, 7, rig); }
  // Земля в разрезе: наружная половина + срез со слоями
  const CUT = V3(0, 60, 0), CR = 10, cut = new T.Group(); cut.position.copy(CUT); scene.add(cut);
  const half = makeEarth(ctx, CR); half.userData.earth.geometry = new T.SphereGeometry(CR, 64, 48, -Math.PI / 2, Math.PI); half.userData.clouds.visible = false; half.children[2].visible = false; cut.add(half);
  const layers = canvasTex(ctx, 1024, 1024, (x, w) => { const c = w / 2; for (const [r, col] of [[1, '#6b4a2e'], [.985, '#e0632a'], [.55, '#ffb21e'], [.19, '#fff2b0']]) { const g = x.createRadialGradient(c, c, 0, c, c, r * c); g.addColorStop(0, col); g.addColorStop(1, col); x.fillStyle = g; x.beginPath(); x.arc(c, c, r * c, 0, 6.28); x.fill(); }
    x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 3; for (const r of [.985, .55, .19]) { x.beginPath(); x.arc(c, c, r * c, 0, 6.28); x.stroke(); } });
  const face = mesh(new T.CircleGeometry(CR, 96), new T.MeshStandardMaterial({ map: layers, emissive: '#ff7a1a', emissiveMap: layers, emissiveIntensity: .5, roughness: .9 }), 0, 0, 0, cut, false);
  face.rotation.y = Math.PI / 2; face.position.x = .01;
  const fill = new T.DirectionalLight(0xfff4e0, 2.2); fill.position.set(CUT.x - 10, CUT.y + 20, CUT.z + 40); fill.target = cut; scene.add(fill); fill.visible = false;   // подсветка полушария сбоку, иначе оно тонет в чёрном космосе
  const tunnel = mesh(new T.CylinderGeometry(.09, .09, 1, 10), new T.MeshBasicMaterial({ color: '#111111' }), 0, 0, 0, cut, false);
  const hiL = mesh(new T.RingGeometry(0, 1, 96), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .0, side: T.DoubleSide }), .03, 0, 0, cut, false); hiL.rotation.y = Math.PI / 2;
  const faller = mesh(new T.SphereGeometry(.28, 16, 12), M('#2f6fd6', { emissive: '#2f6fd6', emissiveIntensity: .6 }), 0, 0, 0, cut, false);
  const pin = (col) => { const g = new T.Group(); mesh(new T.SphereGeometry(.35, 16, 12), M(col, { emissive: col, emissiveIntensity: .6 }), 0, .5, 0, g, false); mesh(new T.ConeGeometry(.18, .5, 12), M(col), 0, .1, 0, g, false).rotation.x = Math.PI; return g; };
  const pinA = pin('#ff3b5c'), pinB = pin('#ffd400'); cut.add(pinA, pinB); pinA.position.set(0, CR + .05, 0); pinB.position.set(0, -CR - .05, 0); pinB.rotation.z = Math.PI;
  // гора земли
  const mound = new T.Group(); mound.position.set(10, 0, -30); scene.add(mound); { const m = mesh(new T.ConeGeometry(40, 22, 48), M('#7a5434', { roughness: 1 }), 0, 11, 0, mound); m.scale.z = .85; }
  const trucks = []; for (let k = 0; k < 6; k++) { const t = makeTruck(ctx, '#ffb000'); t.rotation.y = Math.PI / 2; scene.add(t); trucks.push(t); }
  const o = new T.Object3D();

  ctx.base = { ...ctx.base, digging: 0, yard: false, holeR: 1, shaft: null, rig: false, cut: false, cutLayer: -1, tunnel: 0, fall: -1, mound: false, dtrucks: 0, pins: false };
  [yard, shaft, shaftFloor, sky, rig, cut, mound, ...trucks].forEach(m => (m.visible = false)); lamp.visible = false; shovel.visible = false;
  ctx.hooks.push((st, t) => {
    yard.visible = st.yard; hole.scale.setScalar(st.holeR); rim.scale.setScalar(st.holeR);
    const sh = st.shaft; shaft.visible = shaftFloor.visible = sky.visible = lamp.visible = !!sh; if (sh) { shaftMat.emissiveIntensity = sh.heat || 0; strata.offset.y = t * (sh.scroll || 0); lamp.position.set(0, -455, 0); }
    rig.visible = st.rig; cut.visible = fill.visible = st.cut; cut.rotation.y = -.5 + Math.sin(t * .2) * .05;
    hiL.visible = st.cutLayer >= 0; if (st.cutLayer >= 0) { const R = [[.985, 1], [.55, .985], [.19, .55], [0, .19]][st.cutLayer]; hiL.geometry.dispose(); hiL.geometry = new T.RingGeometry(R[0] * CR, R[1] * CR, 96); hiL.material.opacity = .25 + Math.sin(t * 5) * .15; }
    tunnel.visible = st.tunnel > 0; const L = 2 * CR * clamp(st.tunnel, 0, 1); tunnel.scale.set(1, Math.max(.01, L), 1); tunnel.position.set(.05, CR - L / 2, 0);
    faller.visible = st.fall >= 0; if (st.fall >= 0) faller.position.set(.12, CR * Math.cos(st.fall * Math.PI), 0);
    pinA.visible = pinB.visible = st.pins; mound.visible = st.mound;
    trucks.forEach((tr, k) => { tr.visible = k < Math.ceil(st.dtrucks * trucks.length); tr.position.set(-40 + k * 14 + (t * 4) % 14, 0, -4); });
  });
  ctx.post.push((st, t) => {
    shovel.visible = st.digging > 0 && !!st.tolik; if (!shovel.visible) return; const u = tolik.userData, ph = (t * 1.6 * st.digging) % 1, sw = Math.sin(ph * Math.PI * 2);
    u.armR.rotation.z = .6 + sw * .5; u.armR.rotation.x = -.6 - sw * .6; u.armL.rotation.z = -.5 - sw * .3; tolik.rotation.x = .12 + sw * .08;
    for (let i = 0; i < 24; i++) { const f = (ph + i / 24) % 1; o.position.set(.5 + f * 3, .3 + Math.sin(f * Math.PI) * 1.6, -.6 - f * 1.2 + (i % 3 - 1) * .2); o.rotation.set(i, i * 2, 0); o.scale.setScalar(ph > .45 ? 1 : 0); o.updateMatrix(); clods.setMatrixAt(i, o.matrix); }
    clods.instanceMatrix.needsUpdate = true;
  });

  const C = (x, y, z) => [CUT.x + x, CUT.y + y, CUT.z + z];
  const spaceCut = (s) => { s.space = true; s.cut = true; };
  S.digOpen = (u, o, s) => { s.yard = true; s.digging = 1; s.tolik = { at: [-1.8, 0, .4], ry: .9, mood: 'happy' }; return camPath(u, [[0, [14, 22, 26], [0, 0, 0], 42], [.55, [5, 4, 9], [0, 1, 0], 45], [1, [3.6, 2.6, 6.4], [-.6, 1.2, 0], 42]]); };
  S.digWork = (u, o, s) => { s.yard = true; s.digging = 1; s.sunA = o.time ? u * 6 : 0; s.tolik = { at: [-1.8, 0, .4], ry: .9, mood: o.mood || 'happy' }; return camPath(u, [[0, [-5, 2.4, 6], [-1, 1.2, 0], 44], [1, [-4.2, 2.2, 5.4], [-1, 1.2, 0], 42]]); };
  S.digTease = (u, o, s) => { s.yard = true; s.holeR = 1; return camPath(u, [[0, [0, 6, .6], [0, 0, 0], 50], [1, [0, 3, .3], [0, -20, 0], 60]]); };
  S.digChapter = (u, o, s) => { spaceCut(s); s.tunnel = o.tunnel || 0; return camPath(u, orbitKeys(36, 10, o.a0 ?? -.8, (o.a0 ?? -.8) + .6, [0, 0, 0], 40).map(k => [k[0], C(...k[1]), C(...k[2]), k[3]])); };
  S.cutaway = (u, o, s) => { spaceCut(s); s.cutLayer = o.layer ?? -1; s.tunnel = o.tunnel || 0; s.pins = !!o.pins; const r = o.r || 30, y = o.y || 0;
    return camPath(u, [[0, C(r * .18, y + 8, r * .95), C(0, y * .6, 0), 40], [1, C(r * .06, y + 5, r * .9), C(0, y * .6, 0), 40]]); };
  S.holeLine = (u, o, s) => { spaceCut(s); s.tunnel = eo(prog(u, .05, .8)); s.pins = true; return camPath(u, [[0, C(6, 8, 30), C(0, 0, 0), 40], [1, C(3, 6, 29), C(0, 0, 0), 40]]); };
  S.fall = (u, o, s) => { spaceCut(s); s.tunnel = 1; s.pins = true; s.fall = sm(u); return camPath(u, [[0, C(5, 5, 28), C(0, 0, 0), 42], [1, C(6, -4, 27), C(0, 0, 0), 42]]); };
  S.shaft = (u, o, s) => { s.shaft = { heat: o.heat || 0, scroll: o.scroll ?? .05 }; s.tolik = { at: [-.9, -460, -.6], ry: .7, mood: o.mood || 'shock', s: .8 }; s.digging = o.dig ? 1 : 0; s.ground = true;
    return camPath(u, [[0, [1.6, -459, 1.4], [-.6, -455, -.6], 72], [1, [1.5, -458.6, 1.5], [-.5, -450, -.6], 74]]); };
  S.rig = (u, o, s) => { s.rig = true; s.tolik = { at: [-20, 0, 2], ry: -.5, mood: 'happy', wave: true }; return camPath(u, [[0, [0, 3, 30], [-24, 6, -8], 45], [1, [-6, 30, 40], [-26, 22, -8], 45]]); };
  S.mound = (u, o, s) => { s.mound = true; s.dtrucks = 1; return camPath(u, [[0, [60, 10, 50], [10, 10, -30], 48], [1, [50, 30, 70], [10, 14, -30], 48]]); };
}
