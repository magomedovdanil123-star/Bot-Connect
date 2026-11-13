// «Вырвется или взорвётся?» — шар в 6 вращающихся неоновых кольцах, 9:16, canvas 2D + неоновое свечение.
// Физика — ringsim.js (детерминированно по seed). Кадр задаёт Node (ringrender.mjs): фаза intro → play → fin → cta.
import { makeSim, R } from './ringsim.js';
import { drawCta, CTA_LEN, CTA_TAP } from './hudcta.js';

const W = 1080, H = 1920, CX = W / 2, CY = 990, THICK = .07;
const COLS = ['#ff2bd6', '#a25cff', '#3d8bff', '#21e6ff', '#3dff8f', '#ffd23f'];
let cv, g, nc, n, gl1, g1, gl2, g2, sim, rnd, SC = 150, evI = 0;
const V = { sparks: [], shards: [], waves: [], pops: [], trail: [], dust: [], shake: 0, flash: 0, flashCol: '#fff', spin: 0, squash: 0, sqA: 0, lastPop: -9, punch: 0, bounces: 0, layer: 0, nearT: -9, boom: null };
const clamp = x => Math.max(0, Math.min(1, x)), ease = x => 1 - (1 - clamp(x)) ** 3;
const rgba = (hex, a) => { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`; };
const sx = x => CX + x * SC, sy = y => CY - y * SC;

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }

// ---------- события физики → эффекты ----------
function onEvent(e) {
  const rings = sim.rings;
  if (e.kind === 'bounce') {
    const r = rings[e.ring], col = COLS[e.ring], p = e.power; r.flash = 1; V.bounces = e.n;
    const nx = Math.cos(e.a), ny = Math.sin(e.a);
    for (let i = 0; i < 10 + p * 22; i++) { const a = e.a + Math.PI + (rnd() - .5) * 2.2, sp = (1.5 + rnd() * 4) * (.6 + p); V.sparks.push({ x: e.x + nx * e.r, y: e.y + ny * e.r, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .35 + rnd() * .45, age: 0, col: rnd() < .35 ? '#ffffff' : col, w: 2 + rnd() * 3 }); }
    V.waves.push({ x: e.x + nx * e.r, y: e.y + ny * e.r, r0: .05, r1: .5 + p * .4, age: 0, life: .4, col, w: 5 });
    V.shake = Math.min(1.2, V.shake + .12 + p * .25); V.squash = 1; V.sqA = e.a;
  }
  if (e.kind === 'escape') {
    const r = rings[e.ring], col = COLS[e.ring], pieces = 34; V.layer = e.ring + 1;
    for (let i = 0; i < pieces; i++) {
      const a0 = r.ang + r.gap / 2 + (Math.PI * 2 - r.gap) * i / pieces, a1 = a0 + (Math.PI * 2 - r.gap) / pieces, am = (a0 + a1) / 2, rr = r.rad + THICK / 2;
      const px = Math.cos(am) * rr, py = Math.sin(am) * rr, dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1, kick = 2.2 + 3.5 / (1 + d);
      V.shards.push({ x: px, y: py, vx: Math.cos(am) * 1.2 + dx / d * kick + (rnd() - .5) * 1.5, vy: Math.sin(am) * 1.2 + dy / d * kick + (rnd() - .5) * 1.5 + 1.2, rot: 0, vr: (rnd() - .5) * 14, len: (a1 - a0) * rr * .92, ang: am + Math.PI / 2, age: 0, life: 1.6 + rnd() * .8, col });
    }
    for (let i = 0; i < 90; i++) { const a = rnd() * Math.PI * 2, sp = 2 + rnd() * 7; V.sparks.push({ x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .5 + rnd() * .8, age: 0, col: rnd() < .4 ? '#ffffff' : col, w: 3 + rnd() * 4 }); }
    V.waves.push({ x: 0, y: 0, r0: r.rad, r1: r.rad + 2.2, age: 0, life: .7, col, w: 14 }, { x: e.x, y: e.y, r0: .1, r1: 1.4, age: 0, life: .45, col: '#ffffff', w: 8 });
    V.shake = 2.2; V.flash = .55; V.flashCol = col; V.punch = 1;
    const left = sim.N - e.ring - 1, words = ['ЕСТЬ!', 'ПРОБИЛ!', 'ЕЩЁ ОДИН!', 'ВОТ ЭТО ДА!', 'ПОСЛЕДНИЙ!'];
    if (left > 0) V.pops = [], V.pops.push({ t: 0, life: 1.1, txt: words[Math.min(words.length - 1, e.ring)], sub: left === 1 ? 'ОСТАЛСЯ 1 СЛОЙ' : `ОСТАЛОСЬ ${left}`, col });
  }
  if (e.kind === 'gap') { const esc = sim.S.events.some(x => x.kind === 'escape' && x.t > e.t && x.t - e.t < .6) || sim.S.done; if (!esc && e.t - V.nearT > 2 && e.ring < sim.N - 1 && !V.pops.length) { V.nearT = e.t; V.pops.push({ t: 0, life: .9, txt: 'ЧУТЬ НЕ!', col: '#ffffff', small: true }); } }
}

// ---------- рисование ----------
function bg(vt) {
  const gr = g.createRadialGradient(CX, CY, 60, CX, CY, 1250); gr.addColorStop(0, '#1a0f33'); gr.addColorStop(.5, '#0a0718'); gr.addColorStop(1, '#020205'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // медленная звёздная пыль
  for (const d of V.dust) { const y = (d.y + vt * d.v * 30) % H, tw = .35 + .65 * Math.abs(Math.sin(vt * d.f + d.p)); g.fillStyle = `rgba(200,210,255,${d.a * tw})`; g.fillRect(d.x, y, d.s, d.s); }
  // мягкое свечение текущего кольца в центре
  const k = Math.min(sim.N - 1, sim.S.cur), cg = g.createRadialGradient(CX, CY, 0, CX, CY, 700); cg.addColorStop(0, rgba(COLS[k], .16)); cg.addColorStop(1, rgba(COLS[k], 0)); g.fillStyle = cg; g.fillRect(0, 0, W, H);
}
function drawRings(x) {
  for (const r of sim.rings) {
    if (!r.alive) continue; const col = COLS[r.k], f = r.flash || 0, cur = r.k === sim.S.cur, R0 = (r.rad + THICK / 2) * SC;
    const a1 = r.ang + r.gap / 2, a2 = r.ang + Math.PI * 2 - r.gap / 2;
    x.lineCap = 'round';
    x.strokeStyle = rgba(col, cur ? .95 : .55); x.lineWidth = THICK * SC * (1 + f * .5); x.beginPath(); x.arc(CX, CY, R0, -a1, -a2, true); x.stroke();
    x.strokeStyle = `rgba(255,255,255,${(cur ? .55 : .2) + f * .45})`; x.lineWidth = THICK * SC * .32; x.beginPath(); x.arc(CX, CY, R0, -a1, -a2, true); x.stroke();
    // яркие края щели
    for (const a of [a1, a2]) { x.fillStyle = '#ffffff'; x.beginPath(); x.arc(CX + Math.cos(a) * R0, CY - Math.sin(a) * R0, THICK * SC * (cur ? .75 : .55), 0, 7); x.fill(); }
  }
}
function drawBall(x, bx, by, r, k) {
  const X = sx(bx), Y = sy(by), rr = r * SC, col = COLS[Math.min(sim.N - 1, k)];
  // хвост
  const T = V.trail; for (let i = 1; i < T.length; i++) { const a = i / T.length; x.strokeStyle = rgba(col, a * .55); x.lineWidth = rr * 1.6 * a; x.lineCap = 'round'; x.beginPath(); x.moveTo(sx(T[i - 1][0]), sy(T[i - 1][1])); x.lineTo(sx(T[i][0]), sy(T[i][1])); x.stroke(); }
  // ореол
  const halo = x.createRadialGradient(X, Y, rr * .6, X, Y, rr * 3.2); halo.addColorStop(0, rgba(col, .55)); halo.addColorStop(1, rgba(col, 0)); x.fillStyle = halo; x.beginPath(); x.arc(X, Y, rr * 3.2, 0, 7); x.fill();
  x.save(); x.translate(X, Y);
  const sq = V.squash * .22; x.rotate(-V.sqA); x.scale(1 - sq, 1 + sq * .6); x.rotate(V.sqA);
  x.beginPath(); x.arc(0, 0, rr, 0, 7); x.save(); x.clip();
  // стеклянный шарик: тёмное стекло + цветной завиток, который крутится при качении
  const base = x.createRadialGradient(-rr * .3, -rr * .35, rr * .1, 0, 0, rr * 1.05); base.addColorStop(0, '#ffffff'); base.addColorStop(.35, '#e8ecff'); base.addColorStop(1, '#7d86b8'); x.fillStyle = base; x.fillRect(-rr, -rr, rr * 2, rr * 2);
  x.rotate(V.spin); x.globalAlpha = .9;
  for (const [c, o] of [[col, 0], ['#ffd23f', Math.PI]]) { x.fillStyle = c; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(rr * .9, -rr * .2 + o, rr * .4, rr * .9, -rr * .2, rr * 1.1); x.bezierCurveTo(rr * .1, rr * .5, rr * .3, rr * .1, 0, 0); x.rotate(o); x.fill(); }
  x.globalAlpha = 1; x.restore();
  const sh = x.createRadialGradient(-rr * .35, -rr * .4, 0, -rr * .35, -rr * .4, rr * .55); sh.addColorStop(0, 'rgba(255,255,255,.95)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = sh; x.beginPath(); x.arc(0, 0, rr, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 2; x.stroke();
  x.restore();
}
function drawFx(x) {
  x.globalCompositeOperation = 'lighter';
  for (const s of V.sparks) { const a = 1 - s.age / s.life; x.strokeStyle = rgba(s.col === '#ffffff' ? '#ffffff' : s.col, a); x.lineWidth = s.w * a + .5; x.lineCap = 'round'; x.beginPath(); x.moveTo(sx(s.x), sy(s.y)); x.lineTo(sx(s.x - s.vx * .03), sy(s.y - s.vy * .03)); x.stroke(); }
  for (const w of V.waves) { const k = w.age / w.life, r = w.r0 + (w.r1 - w.r0) * ease(k); x.strokeStyle = rgba(w.col, (1 - k) * .8); x.lineWidth = w.w * (1 - k) + 1; x.beginPath(); x.arc(sx(w.x), sy(w.y), r * SC, 0, 7); x.stroke(); }
  for (const s of V.shards) { const a = Math.min(1, (1 - s.age / s.life) * 2); x.save(); x.translate(sx(s.x), sy(s.y)); x.rotate(-(s.ang + s.rot)); x.strokeStyle = rgba(s.col, a); x.lineWidth = THICK * SC; x.lineCap = 'round'; x.beginPath(); x.moveTo(-s.len * SC / 2, 0); x.quadraticCurveTo(0, -s.len * SC * .08, s.len * SC / 2, 0); x.stroke(); x.strokeStyle = `rgba(255,255,255,${a * .6})`; x.lineWidth = THICK * SC * .3; x.stroke(); x.restore(); }
  x.globalCompositeOperation = 'source-over';
}
function stepFx(dt) {
  for (const s of V.sparks) { s.age += dt; s.vy -= 6 * dt; s.vx *= 1 - 1.5 * dt; s.vy *= 1 - 1.5 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
  for (const s of V.shards) { s.age += dt; s.vy -= 5 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; }
  for (const w of V.waves) w.age += dt;
  V.sparks = V.sparks.filter(s => s.age < s.life); V.shards = V.shards.filter(s => s.age < s.life); V.waves = V.waves.filter(w => w.age < w.life);
  for (const r of sim.rings) r.flash = Math.max(0, (r.flash || 0) - dt * 3.5);
  V.squash = Math.max(0, V.squash - dt * 7); V.flash = Math.max(0, V.flash - dt * 2.2); V.punch = Math.max(0, V.punch - dt * 3);
}
function txt(s, x, y, size, col, maxW = 980, a = 1) {
  g.globalAlpha = a; g.font = `900 ${size}px Montserrat`; const sz = Math.min(size, Math.floor(size * maxW / g.measureText(s).width)); g.font = `900 ${sz}px Montserrat`;
  g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = sz * .2; g.strokeStyle = '#000'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); g.globalAlpha = 1;
}
function hud(ph, vt, pk) {
  if (ph === 'intro') {
    const a = ease(vt / .35); txt('ВЫРВЕТСЯ', CX, 250, 150 * (2 - a), '#ffffff', 980, a); txt('ИЛИ ВЗОРВЁТСЯ?', CX, 400, 128 * (2 - a), '#ff3b4a', 980, a);
    const c = 3 - Math.floor(vt - .3); if (vt >= .3 && c >= 1) { const f = (vt - .3) % 1, s = 1 + .6 * (1 - ease(f / .25)); txt(String(c), CX, 1730, 330 * s, ['#ffd23f', '#ff8a1f', '#ff2b2b'][3 - c], 980, 1 - clamp((f - .8) / .2) * .6); }
    txt('ДОСМОТРИ ДО КОНЦА', CX, 1500, 58, '#cfd6ff', 980, clamp((vt - .6) / .3));
    return;
  }
  if (ph === 'play' || ph === 'fin') {
    txt('ВЫРВЕТСЯ ИЛИ ВЗОРВЁТСЯ?', CX, 180, 74, '#ffffff');
    const k = Math.min(sim.N, V.layer + 1), col = COLS[Math.min(sim.N - 1, V.layer)];
    if (ph === 'play') { txt(`СЛОЙ ${k} / ${sim.N}`, CX, 300, 96, col); txt(`ОТСКОКОВ: ${V.bounces}`, CX, 1760, 70, '#ffffff'); }
    if (pk.go < .9) { const a = 1 - clamp((pk.go - .55) / .35), s = 1 + .5 * (1 - ease(pk.go / .2)); txt('ПОЕХАЛИ!', CX, 1620, 170 * s, '#ffd23f', 980, a); }
    for (const p of V.pops) { const k2 = p.t / p.life, s = 1 + .4 * (1 - ease(k2 / .18)), a = 1 - clamp((k2 - .7) / .3); txt(p.txt, CX, p.small ? 1560 : 1590, (p.small ? 110 : 150) * s, p.col, 980, a); if (p.sub) txt(p.sub, CX, 1680, 62, '#ffffff', 980, a); }
    if (pk.lastChance) txt('ПОСЛЕДНИЙ ШАНС…', CX, 1600, 100, '#ff3b4a', 980, Math.min(1, pk.lastChance * 4));
    if (ph === 'fin') {
      const f = pk.fin; if (f > .05) { const s = 1 + .5 * (1 - ease((f - .05) / .2)); txt('ВЫРВАЛСЯ!', CX, 1600, 170 * s, '#3dff8f'); }
      if (V.boom && pk.fin - V.boom.t > .1) { const b = pk.fin - V.boom.t - .1, s = 1 + .6 * (1 - ease(b / .2)); txt('…И ВЗОРВАЛСЯ!', CX, 1760, 120 * s, '#ff3b4a'); }
    }
  }
}

window.SMASH = {
  init(cfg) {
    [cv, g] = mk(W, H); document.body.appendChild(cv); [nc, n] = mk(W, H); [gl1, g1] = mk(W / 4, H / 4); [gl2, g2] = mk(W / 10, H / 10);
    sim = makeSim(cfg.seed, cfg.sim); rnd = R(cfg.seed * 7 + 1);
    const outer = sim.rings[sim.N - 1].rad + THICK; SC = 500 / outer;
    for (let i = 0; i < 140; i++) V.dust.push({ x: rnd() * W, y: rnd() * H, s: 1 + rnd() * 2.5, a: .2 + rnd() * .5, v: .2 + rnd() * .8, f: .5 + rnd() * 2, p: rnd() * 6 });
    // прогон до конца, чтобы знать события и длину — потом заново
    const probe = makeSim(cfg.seed, cfg.sim); while (!probe.S.done && probe.S.t < 80) probe.step();
    return { T: probe.S.t, done: probe.S.done, events: probe.S.events };
  },
  // pk: { ph, vt, simT, dt (сим-время кадра), dtv, go, fin, cta, lastChance }
  frame(pk) {
    const S = sim.S, ph = pk.ph;
    if (ph === 'intro') { for (const r of sim.rings) r.vis = r.ang - r.w * (3.6 - pk.vt); }   // кольца крутятся и до старта
    else { while (S.t < pk.simT - 1e-9 && !S.done) { sim.step(); while (evI < S.events.length) onEvent(S.events[evI++]); } }
    while (evI < S.events.length) onEvent(S.events[evI++]);
    stepFx(ph === 'intro' ? pk.dtv : pk.dt);
    // мяч: в финале летит по инерции, раздувается и лопается
    let bx = S.p[0], by = S.p[1], br = S.r;
    if (ph === 'intro') { const amp = .004 + .03 * clamp(pk.vt / 3.4) ** 2; bx = (rnd() - .5) * amp * 2; by = (rnd() - .5) * amp * 2; }
    if (ph === 'fin' || ph === 'cta') {
      const f = pk.fin; if (!V.fin0) V.fin0 = { x: S.p[0], y: S.p[1], vx: S.v[0], vy: S.v[1] };
      const F = V.fin0, tt = Math.min(f, .95), damp = (1 - Math.exp(-3 * tt)) / 3, fx = F.x + F.vx * damp, fy = F.y + F.vy * damp, m = ease(clamp((f - .1) / .75));
      bx = fx * (1 - m); by = fy * (1 - m) + .6 * m;   // по инерции, потом выплывает в центр кадра
      const inf = clamp((f - .3) / .7); br = S.r * (1 + inf * inf * 3.2); bx += (rnd() - .5) * .05 * inf; by += (rnd() - .5) * .05 * inf;
      if (f >= 1 && !V.boom) {
        V.boom = { t: f, x: bx, y: by }; V.shake = 3; V.flash = 1; V.flashCol = '#ffffff';
        for (let i = 0; i < 260; i++) { const a = rnd() * Math.PI * 2, sp = 2 + rnd() * 11; V.sparks.push({ x: bx, y: by, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .8 + rnd() * 1.4, age: 0, col: COLS[i % COLS.length], w: 3 + rnd() * 5 }); }
        for (let i = 0; i < 4; i++) V.waves.push({ x: bx, y: by, r0: .1, r1: 2.5 + i * 1.6, age: -i * .07, life: .9 + i * .2, col: [ '#ffffff', '#ffd23f', '#ff2bd6', '#21e6ff'][i], w: 18 - i * 3 });
      }
    }
    // хвост и вращение шарика
    if (ph === 'play' || (ph === 'fin' && !V.boom)) { V.trail.push([bx, by]); if (V.trail.length > 14) V.trail.shift(); V.spin += Math.hypot(S.v[0], S.v[1]) / Math.max(.05, S.r) * (pk.dt || pk.dtv) * (S.contact > 0 ? 1 : .35); }
    else if (V.boom) V.trail.length = 0;
    // искры при качении
    if (ph === 'play' && S.contact > 0 && rnd() < .7) { const a = Math.atan2(S.p[1], S.p[0]), rr = Math.hypot(S.p[0], S.p[1]) + S.r; V.sparks.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr, vx: -S.v[0] * .3 + (rnd() - .5), vy: -S.v[1] * .3 + (rnd() - .5), life: .25 + rnd() * .2, age: 0, col: COLS[S.cur] || '#fff', w: 2 }); }
    for (const p of V.pops) p.t += pk.dtv; V.pops = V.pops.filter(p => p.t < p.life);

    // --- кадр ---
    const shk = V.shake * 9; V.shake = Math.max(0, V.shake - pk.dtv * 5);
    const z = 1 + V.punch * .035 + (pk.zoom || 0);
    g.setTransform(1, 0, 0, 1, 0, 0); bg(pk.vt);
    n.setTransform(1, 0, 0, 1, 0, 0); n.clearRect(0, 0, W, H);
    n.setTransform(z, 0, 0, z, CX * (1 - z) + (rnd() - .5) * shk, CY * (1 - z) + (rnd() - .5) * shk);
    if (ph === 'intro') { for (const r of sim.rings) { r._a = r.ang; r.ang = r.vis; } drawRings(n); for (const r of sim.rings) r.ang = r._a; } else drawRings(n);
    drawFx(n);
    if (!V.boom) drawBall(n, bx, by, br, S.cur);
    g.drawImage(nc, 0, 0);
    // неоновое свечение: уменьшенная копия, размытие, сложение
    g1.clearRect(0, 0, gl1.width, gl1.height); g1.filter = 'blur(5px)'; g1.drawImage(nc, 0, 0, gl1.width, gl1.height); g1.filter = 'none';
    g2.clearRect(0, 0, gl2.width, gl2.height); g2.filter = 'blur(4px)'; g2.drawImage(nc, 0, 0, gl2.width, gl2.height); g2.filter = 'none';
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = .9; g.drawImage(gl1, 0, 0, W, H); g.globalAlpha = .7; g.drawImage(gl2, 0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (V.flash > 0) { g.fillStyle = rgba(V.flashCol, V.flash * .45); g.fillRect(0, 0, W, H); }
    // виньетка
    const vg = g.createRadialGradient(CX, CY, 500, CX, CY, 1200); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (ph !== 'cta') hud(ph, pk.vt, pk);
    else { hud('fin', pk.vt, pk); drawCta(g, W, H, pk.cta); }
    const rollV = S.contact > 0 && ph === 'play' ? Math.hypot(S.v[0], S.v[1]) : 0;
    return { url: cv.toDataURL('image/jpeg', .9), roll: +rollV.toFixed(3), ring: S.cur, x: +bx.toFixed(3), boom: !!V.boom };
  },
};
export { CTA_LEN, CTA_TAP };
