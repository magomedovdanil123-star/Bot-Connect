// Физика «Шар в кольцах»: 2D, детерминированно по seed. Без three.js — тот же модуль крутится в Node (подбор seed) и в браузере (рендер).
// Шар внутри N вращающихся колец со щелями. Каждый отскок: шар чуть растёт, звучит нота. Пролетел в щель и вышел за кольцо — кольцо разлетается.
// Если шар вырос так, что больше не пролезает в щель текущего кольца, — «взрыв».
export const R = (seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
export const DT = 1 / 480;
export function makeSim(seed, cfg = {}) {
  const rnd = R(seed);
  const N = cfg.rings || 6, G = cfg.g ?? 6.2, GROW = cfg.grow ?? 1.012, THICK = .07;
  const rings = [...Array(N)].map((_, k) => {
    const rad = (cfg.rad0 ?? .95) + k * (cfg.sp ?? .5), gapArc = (cfg.gapArc ?? .62) + k * (cfg.gapStep ?? .02);   // ширина щели по дуге (м) — почти постоянная, у внешних чуть шире
    return { k, rad, gap: gapArc / rad, ang: rnd() * Math.PI * 2, w: (k % 2 ? -1 : 1) * (.55 + rnd() * .45) * (1 - k * .06), alive: true, broke: -1 };
  });
  const S = { t: 0, p: [0, 0], v: [(rnd() - .5) * 2.4, 1.6 + rnd()], r: cfg.r0 ?? .1, cur: 0, bounces: 0, events: [], done: null, contact: 0, slide: 0, lastBounce: -1, near: -9 };
  const ev = (kind, d = {}) => S.events.push({ t: +S.t.toFixed(4), kind, ...d });
  const wrap = a => { a %= Math.PI * 2; return a < 0 ? a + Math.PI * 2 : a; };
  function inGap(ring, a, r) {   // угол a (мир) внутри щели кольца, с запасом под радиус шара
    const rel = wrap(a - ring.ang), half = ring.gap / 2 - r / ring.rad;
    return half > 0 && (rel < half || rel > Math.PI * 2 - half);
  }
  function step() {
    if (S.done) { S.t += DT; return; }
    S.t += DT;
    for (const g of rings) g.ang = wrap(g.ang + g.w * DT);
    S.v[1] -= G * DT; S.p[0] += S.v[0] * DT; S.p[1] += S.v[1] * DT;
    const ring = rings[S.cur]; if (!ring) return;
    const d = Math.hypot(S.p[0], S.p[1]), a = Math.atan2(S.p[1], S.p[0]);
    S.contact = Math.max(0, S.contact - DT);
    // шар целиком снаружи кольца — вырвался
    if (d - S.r > ring.rad + THICK) {
      ring.alive = false; ring.broke = S.t; ev('escape', { ring: S.cur, x: +S.p[0].toFixed(3), y: +S.p[1].toFixed(3), a: +a.toFixed(3) });
      S.cur++; if (S.cur >= N) { S.done = 'escaped'; ev('final', { outcome: 'escaped' }); }
      return;
    }
    if (d + S.r > ring.rad) {
      if (inGap(ring, a, S.r)) { if (S.near < S.t - .5 && d + S.r > ring.rad + .02) { S.near = S.t; ev('gap', { ring: S.cur }); } return; }   // проходит щель
      // удар о внутреннюю стенку: отражение по нормали, стенка вращается — тангенциальная скорость немного увлекается
      const nx = S.p[0] / d, ny = S.p[1] / d, vn = S.v[0] * nx + S.v[1] * ny;
      S.p[0] -= nx * (d + S.r - ring.rad); S.p[1] -= ny * (d + S.r - ring.rad);
      if (vn > 0) {
        const tx = -ny, ty = nx, vt = S.v[0] * tx + S.v[1] * ty, wallT = ring.w * ring.rad;
        const big = vn > (cfg.vroll ?? .9), nvt = vt + (wallT - vt) * (big ? .08 : (cfg.roll ?? 1.2) * DT), nvn = big ? -vn * (cfg.e ?? 1.0) : -vn * .2;
        S.v[0] = tx * nvt + nx * nvn; S.v[1] = ty * nvt + ny * nvn;
        const sp = Math.hypot(S.v[0], S.v[1]), vmin = cfg.vmin ?? 3.4; if (big && sp < vmin) { S.v[0] *= vmin / sp; S.v[1] *= vmin / sp; }
        if (big) {   // настоящий отскок: нота, рост
          S.bounces++; S.lastBounce = S.t; S.r *= GROW; ev('bounce', { ring: S.cur, power: +Math.min(1.5, vn / 6).toFixed(3), a: +a.toFixed(3), x: +S.p[0].toFixed(3), y: +S.p[1].toFixed(3), r: +S.r.toFixed(4), n: S.bounces });
          if (cfg.maxB && S.bounces >= cfg.maxB) { S.done = 'exploded'; ev('final', { outcome: 'exploded', ring: S.cur }); return; }   // критический размер: взрыв
        }
        else { S.contact = .05; S.rollT = (S.rollT || 0) + DT; }   // катится по стенке
      }
      S.slide = Math.abs(S.v[0] * -ny + S.v[1] * nx);
      // шар вырос и больше не пролезает в щель этого кольца — взрыв
      if (ring.gap / 2 - S.r / ring.rad <= .002) { S.done = 'exploded'; ev('final', { outcome: 'exploded', ring: S.cur }); }
    }
  }
  return { S, rings, step, N, cfg };
}
// прогнать без рендера — для подбора seed
export function simulate(seed, cfg = {}, tMax = 90) { const sim = makeSim(seed, cfg); while (!sim.S.done && sim.S.t < tMax) sim.step(); return sim; }
