// Общие детали для наборов выпусков: отражения для металла, текстуры с надписями, Земля, грузовик.
import { RoomEnvironment } from '../../vendor/addons/RoomEnvironment.js';

let ENV = null;
export function envMap(ctx) {   // отражения для металла (монеты, станция, машинка) — только у тех материалов, кому их дали
  if (!ENV) { const pm = new ctx.T.PMREMGenerator(ctx.R); ENV = pm.fromScene(new RoomEnvironment(), .04).texture; }
  return ENV;
}
export function canvasTex(ctx, w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new ctx.T.CanvasTexture(c); t.colorSpace = ctx.T.SRGBColorSpace; t.anisotropy = 4; return t;
}
// Земля: шар с материками (процедурно, без карт) + облака + свечение атмосферы
export function makeEarth(ctx, r = 10) {
  const { T, rnd } = ctx, g = new T.Group();
  const tex = canvasTex(ctx, 1024, 512, (x, w, h) => {
    x.fillStyle = '#1d5fb8'; x.fillRect(0, 0, w, h);
    const blobs = [[.18, .3, .1], [.24, .62, .07], [.5, .28, .09], [.53, .55, .08], [.7, .3, .14], [.78, .62, .05], [.86, .72, .05], [.33, .2, .05]];
    for (const [cx, cy, rr] of blobs) for (let k = 0; k < 26; k++) { const a = rnd(k * 31 + cx * 999) * 6.28, d = rnd() * rr * w * .9;
      x.fillStyle = k % 3 ? '#4caf50' : '#8bc34a'; x.beginPath(); x.ellipse(cx * w + Math.cos(a) * d, cy * h + Math.sin(a) * d * .7, rr * w * (.25 + rnd() * .3), rr * h * (.3 + rnd() * .3), rnd() * 3, 0, 6.28); x.fill(); }
    x.fillStyle = '#f2f6fa'; x.fillRect(0, 0, w, h * .05); x.fillRect(0, h * .94, w, h * .06);
  });
  const earth = new T.Mesh(new T.SphereGeometry(r, 64, 48), new T.MeshStandardMaterial({ map: tex, roughness: .8 })); g.add(earth);
  const cl = canvasTex(ctx, 512, 256, (x, w, h) => { x.clearRect(0, 0, w, h); for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(255,255,255,${.35 + rnd(k + 77) * .4})`; x.beginPath(); x.ellipse(rnd() * w, h * (.1 + rnd() * .8), 8 + rnd() * 30, 3 + rnd() * 6, 0, 0, 6.28); x.fill(); } });
  const clouds = new T.Mesh(new T.SphereGeometry(r * 1.015, 48, 32), new T.MeshStandardMaterial({ map: cl, transparent: true, depthWrite: false })); g.add(clouds);
  const atm = new T.Mesh(new T.SphereGeometry(r * 1.08, 48, 32), new T.MeshBasicMaterial({ color: '#7fc4ff', transparent: true, opacity: .18, side: T.BackSide })); g.add(atm);
  g.userData = { earth, clouds, r }; return g;
}
export function makeTruck(ctx, col = '#ff5a3c') {
  const { T, M, mesh } = ctx, g = new T.Group();
  mesh(new T.BoxGeometry(2.4, 2.2, 2.2), M(col), 0, 1.6, 4.2, g); mesh(new T.BoxGeometry(2.2, .8, .1), M('#bfe6ff', { emissive: '#8fd0ff', emissiveIntensity: .2 }), 0, 2.1, 5.32, g);
  mesh(new T.BoxGeometry(2.6, 2.6, 6.4), M('#e9eef4'), 0, 1.9, -.4, g); mesh(new T.BoxGeometry(2.62, .5, 6.42), M(col), 0, .75, -.4, g);
  for (const z of [3.8, .6, -2.6]) for (const x of [-1.2, 1.2]) { const w = mesh(new T.CylinderGeometry(.55, .55, .4, 20), M('#222'), x, .55, z, g); w.rotation.z = Math.PI / 2; }
  return g;
}
