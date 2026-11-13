// Физика «Гонка шаров — выбери цвет»: 2D, детерминированно по seed. Ось y — вниз (как на экране).
// Трасса из секций: горки-зигзаги, поле штырьков, вертушки, воронки, отбойники; 4 шара толкаются, обгоняют, финиш внизу.
export const R = (seed => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; });
export const DT = 1 / 480, CW = 6.4, BR = .19;
export const BALLS = [
  { name: 'КРАСНЫЙ', c: '#ff3b3b' }, { name: 'СИНИЙ', c: '#3b8bff' }, { name: 'ЗЕЛЁНЫЙ', c: '#33e06a' }, { name: 'ЖЁЛТЫЙ', c: '#ffd23f' },
];

// ---------- трасса ----------
export function buildCourse(layout = 1) {
  const rnd = R(layout * 977 + 3), segs = [], marks = [];
  const seg = (ax, ay, bx, by, o = {}) => segs.push({ ax, ay, bx, by, t: .05, e: .35, f: .25, kind: 'track', ...o });
  const peg = (x, y, o = {}) => seg(x, y, x, y, { t: .07, e: .55, kind: 'peg', ...o });
  let y = 0;
  // старт: коробка, ворота, наклонный пол
  seg(0, -1.2, 0, 0, { kind: 'wall' }); seg(CW, -1.2, CW, 0, { kind: 'wall' });
  seg(0, .55, CW, .55, { kind: 'gate', t: .06 });
  y = .9;
  const zig = (n, slope = .26) => {   // горки от стены к стене, внизу щель 1.05
    marks.push({ y, label: 'zig' });
    for (let i = 0; i < n; i++) { const L = CW - 1.05, dy = L * slope; if (i % 2 === 0) seg(0, y, L, y + dy); else seg(CW, y, CW - L, y + dy); y += 1.85; }
    y += .4;
  };
  const pegs = (rows, gap = .82) => {
    marks.push({ y, label: 'pegs' });
    for (let r = 0; r < rows; r++) { const off = r % 2 ? gap / 2 : 0; for (let x = .64 + off; x < CW - .6; x += gap) peg(x + (rnd() - .5) * .06, y); y += .74; }
    y += .3;
  };
  const funnel = (open = .62) => {
    marks.push({ y, label: 'funnel' });
    const c = CW / 2 + (rnd() - .5) * 1.4; seg(0, y, c - open / 2, y + 1.5, { kind: 'funnel' }); seg(CW, y, c + open / 2, y + 1.5, { kind: 'funnel' }); y += 2.1;
  };
  const spinners = () => {
    marks.push({ y, label: 'spin' });
    const w = 2.1 + rnd() * .8;
    for (const [cx, dir] of [[1.65, 1], [CW - 1.65, -1]]) segs.push({ kind: 'spin', cx, cy: y + 1, len: 2.4, w: w * dir, ang0: rnd() * 3, t: .07, e: .45, f: .2 });
    peg(CW / 2, y + .2, { kind: 'bump', t: .2, e: 1.15 }); y += 2.6;
  };
  const bumpers = (rows = 3) => {
    marks.push({ y, label: 'bump' });
    for (let r = 0; r < rows; r++) { const n = r % 2 ? 3 : 2; for (let i = 0; i < n; i++) peg(CW * (i + 1) / (n + 1) + (rnd() - .5) * .3, y + .5, { kind: 'bump', t: .26, e: 1.15 }); y += 1.25; }
    y += .3;
  };
  let plan = [[zig, 3], [pegs, 6], [funnel], [spinners], [zig, 2], [bumpers, 3], [funnel], [pegs, 5], [spinners], [zig, 2], [pegs, 4]];
  if (layout % 2 === 0) [plan[3], plan[5]] = [plan[5], plan[3]];
  if (layout >= 3) {   // своя трасса: секции перемешаны, их размер свой; две воронки подряд не ставим
    const mid = [[pegs, 4 + Math.floor(rnd() * 4)], [funnel], [spinners], [zig, 2 + Math.floor(rnd() * 2)], [bumpers, 2 + Math.floor(rnd() * 2)], [funnel], [pegs, 4 + Math.floor(rnd() * 3)], [spinners], [zig, 2]];
    for (let i = mid.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [mid[i], mid[j]] = [mid[j], mid[i]]; }
    for (let i = 1; i < mid.length; i++) if (mid[i][0] === funnel && mid[i - 1][0] === funnel) [mid[i], mid[(i + 2) % mid.length]] = [mid[(i + 2) % mid.length], mid[i]];
    if (mid[0][0] === funnel) [mid[0], mid[1]] = [mid[1], mid[0]];
    plan = [[zig, 2 + Math.floor(rnd() * 2)], ...mid, [pegs, 3 + Math.floor(rnd() * 2)]];
  }
  for (const [fn, a] of plan) fn(a);
  const finish = y + .8; y = finish;
  seg(0, -1.2, 0, finish + 3.2, { kind: 'wall', e: .3 }); seg(CW, -1.2, CW, finish + 3.2, { kind: 'wall', e: .3 });
  seg(0, finish + 2.6, CW, finish + 3.0, { kind: 'tray', e: .2, f: .8 });
  for (const s of segs) { s.y0 = s.kind === 'spin' ? s.cy - s.len / 2 - .3 : Math.min(s.ay, s.by) - s.t - .3; s.y1 = s.kind === 'spin' ? s.cy + s.len / 2 + .3 : Math.max(s.ay, s.by) + s.t + .3; }
  return { segs, marks, finish, len: finish + 3.2 };
}
export function spinEnds(s, t) { const a = s.ang0 + s.w * t, c = Math.cos(a) * s.len / 2, d = Math.sin(a) * s.len / 2; return [s.cx - c, s.cy - d, s.cx + c, s.cy + d]; }

// ---------- симуляция ----------
export function makeRace(seed, layout = 1, cfg = {}) {
  const rnd = R(seed), C = buildCourse(layout), G = cfg.g ?? 7.5;
  const balls = BALLS.map((b, i) => ({ i, ...b, x: 1.25 + i * 1.3 + (rnd() - .5) * .25, y: .2 + (rnd() - .5) * .1, vx: (rnd() - .5) * .3, vy: 0, spin: 0, contact: 0, roll: 0, still: 0, done: 0, ft: 0 }));
  const order = balls.map((_, i) => i), S = { t: 0, open: false, events: [], leader: -1, leadT: 0, finished: 0, done: false, balls, C, order };
  const ev = (kind, d = {}) => S.events.push({ t: +S.t.toFixed(4), kind, ...d });
  // перемешиваем стартовые места — у каждого seed свой порядок
  for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [balls[i].x, balls[j].x] = [balls[j].x, balls[i].x]; }
  function hit(b, s) {
    let ax = s.ax, ay = s.ay, bx = s.bx, by = s.by;
    if (s.kind === 'spin') [ax, ay, bx, by] = spinEnds(s, S.t);
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; let u = L2 ? ((b.x - ax) * dx + (b.y - ay) * dy) / L2 : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const px = ax + dx * u, py = ay + dy * u; let nx = b.x - px, ny = b.y - py; const d = Math.hypot(nx, ny), Rr = BR + s.t;
    if (d >= Rr || d === 0) return;
    nx /= d; ny /= d; b.x += nx * (Rr - d); b.y += ny * (Rr - d);
    let wx = 0, wy = 0; if (s.kind === 'spin') { wx = -s.w * (py - s.cy); wy = s.w * (px - s.cx); }
    const rvx = b.vx - wx, rvy = b.vy - wy, vn = rvx * nx + rvy * ny; if (vn >= 0) return;
    const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty, big = -vn > .7;
    let nvn = big ? -vn * s.e : 0; if (s.kind === 'bump') nvn = Math.max(nvn, 4.2);
    const nvt = vt * (1 - s.f * DT * (big ? 30 : 1));
    b.vx = wx + nx * nvn + tx * nvt; b.vy = wy + ny * nvn + ty * nvt;
    if (big) ev(s.kind === 'bump' ? 'bump' : s.kind === 'peg' ? 'peg' : s.kind === 'spin' ? 'spinhit' : 'land', { b: b.i, x: +b.x.toFixed(2), y: +b.y.toFixed(2), v: +(-vn).toFixed(2) });
    else { b.contact = .05; b.roll = Math.abs(nvt); }
  }
  function step() {
    S.t += DT;
    if (!S.open && S.t >= (cfg.gateAt ?? 0)) { S.open = true; C.segs = C.segs.filter(s => s.kind !== 'gate'); ev('gate'); }
    for (const b of balls) {
      b.vy += G * DT; b.vx *= 1 - .1 * DT; b.vy *= 1 - .1 * DT;
      const sp = Math.hypot(b.vx, b.vy); if (sp > 12) { b.vx *= 12 / sp; b.vy *= 12 / sp; }
      b.x += b.vx * DT; b.y += b.vy * DT; b.contact = Math.max(0, b.contact - DT);
      for (const s of C.segs) if (b.y > s.y0 - BR && b.y < s.y1 + BR) hit(b, s);
      b.spin += (b.vx >= 0 ? 1 : -1) * Math.hypot(b.vx, b.vy) / BR * DT;
      // застрял (лёг на штырёк, заклинило в воронке) — лёгкий толчок
      if (S.open && !b.done && Math.hypot(b.vx, b.vy) < .12) { b.still += DT; if (b.still > .7) { b.vx += (rnd() - .5) * 2.2; b.vy -= .6; b.still = 0; ev('nudge', { b: b.i }); } } else b.still = 0;
      if (!b.done && b.y > C.finish) { b.done = ++S.finished; b.ft = S.t; ev('finish', { b: b.i, rank: b.done, x: +b.x.toFixed(2) }); if (S.finished === 4) { S.done = true; ev('final'); } }
    }
    // шары толкаются
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const a = balls[i], b = balls[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d >= 2 * BR || d === 0) continue;
      const nx = dx / d, ny = dy / d, o = (2 * BR - d) / 2; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o;
      const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (vn >= 0) continue;
      const jn = -(1 + .85) * vn / 2; a.vx -= jn * nx; a.vy -= jn * ny; b.vx += jn * nx; b.vy += jn * ny;
      if (-vn > .6) ev('clack', { a: i, b: j, x: +((a.x + b.x) / 2).toFixed(2), v: +(-vn).toFixed(2) });
    }
    // порядок и лидер (смена лидера — только если держится 0.35 с)
    order.sort((p, q) => (balls[p].done && balls[q].done) ? balls[p].done - balls[q].done : balls[p].done ? -1 : balls[q].done ? 1 : balls[q].y - balls[p].y);
    if (S.open && order[0] !== S.leader) { if (S.leadT === 0) S.leadT = S.t; else if (S.t - S.leadT > .35) { if (S.leader >= 0 && !balls[order[0]].done) ev('lead', { b: order[0] }); S.leader = order[0]; S.leadT = 0; } } else S.leadT = 0;
  }
  return { S, step, C, balls };
}
export function simulateRace(seed, layout, cfg = {}, tMax = 60) { const r = makeRace(seed, layout, cfg); while (!r.S.done && r.S.t < tMax) r.step(); return r; }
