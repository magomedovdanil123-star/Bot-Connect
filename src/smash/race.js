// «Гонка шаров — выбери цвет»: 4 шара на вертикальной трассе, камера летит за лидером. canvas 2D + неоновое свечение.
// Физика — racesim.js; кадр задаёт Node (racerender.mjs): intro → race → fin → cta.
import { makeRace, spinEnds, BALLS, BR, CW } from './racesim.js';
import { drawCta } from './hudcta.js';

const W = 1080, H = 1920;
let cv, g, nc, n, gl1, g1, gl2, g2, race, rnd, evI = 0;
let SC = 165, camY = -3, camX = CW / 2, intro = true;
const V = { sparks: [], waves: [], pops: [], confetti: [], trails: BALLS.map(() => []), flash: {}, lastLead: -9, lastSec: '', shake: 0, gateT: -1, win: -1, winT: 0, finalStretch: false };
const clamp = x => Math.max(0, Math.min(1, x)), ease = x => 1 - (1 - clamp(x)) ** 3;
const rgba = (hex, a) => { const v = parseInt(hex.slice(1), 16); return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`; };
const sx = x => W / 2 + (x - camX) * SC, sy = y => (y - camY) * SC;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; };
const SEC = { funnel: ['ВОРОНКА!', '#21e6ff'], spin: ['ВЕРТУШКИ!', '#ff8a1f'], bump: ['ОТБОЙНИКИ!', '#ff2bd6'] };
const KCOL = { track: '#7fe8ff', wall: '#3a4a7a', peg: '#ffffff', bump: '#ff2bd6', spin: '#ff8a1f', funnel: '#21e6ff', gate: '#ffd23f', tray: '#7fe8ff' };

function onEvent(e) {
  const B = race.balls;
  if (e.kind === 'peg' || e.kind === 'bump' || e.kind === 'spinhit' || e.kind === 'land') {
    const col = e.kind === 'bump' ? '#ff2bd6' : B[e.b].c, k = Math.min(1, e.v / 6);
    for (let i = 0; i < (e.kind === 'bump' ? 18 : 4 + k * 8); i++) { const a = rnd() * Math.PI * 2, sp = 1 + rnd() * 3.5; V.sparks.push({ x: e.x, y: e.y + BR * .6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 1, life: .3 + rnd() * .35, age: 0, col: rnd() < .4 ? '#ffffff' : col, w: 2 + rnd() * 2 }); }
    if (e.kind === 'bump') { for (const sg of race.C.segs) if (sg.kind === 'bump' && Math.hypot(sg.ax - e.x, sg.ay - e.y) < .6) V.flash[sg.ax + ',' + sg.ay] = 1; V.waves.push({ x: e.x, y: e.y, r0: .2, r1: .9, age: 0, life: .35, col: '#ff2bd6', w: 8 }); V.shake = Math.min(1, V.shake + .35); }
  }
  if (e.kind === 'clack') V.waves.push({ x: e.x, y: (B[e.a].y + B[e.b].y) / 2, r0: .05, r1: .45, age: 0, life: .25, col: '#ffffff', w: 4 });
  if (e.kind === 'lead' && e.t - V.lastLead > 1.6 && V.win < 0 && !V.photo) { V.lastLead = e.t; V.pops = V.pops.filter(p => !p.lead); V.pops.push({ t: 0, life: 1.2, txt: `${B[e.b].name} ВПЕРЕДИ!`, col: B[e.b].c, lead: true }); }
  if (e.kind === 'finish' && e.rank === 1) { V.win = e.b; V.winT = e.t; V.pops = []; for (let i = 0; i < 80; i++) { const a = rnd() * Math.PI * 2, sp = 2 + rnd() * 6; V.sparks.push({ x: e.x, y: race.C.finish, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: .6 + rnd() * .8, age: 0, col: rnd() < .5 ? B[e.b].c : '#ffffff', w: 3 + rnd() * 3 }); } V.waves.push({ x: e.x, y: race.C.finish, r0: .2, r1: 3, age: 0, life: .7, col: B[e.b].c, w: 14 }); V.shake = 1.5; }
}
function stepFx(dt) {
  for (const s of V.sparks) { s.age += dt; s.vy += 6 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
  for (const w of V.waves) w.age += dt;
  for (const c of V.confetti) { c.age += dt; c.vy += 2.5 * dt; c.vx *= 1 - dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; }
  V.sparks = V.sparks.filter(s => s.age < s.life); V.waves = V.waves.filter(w => w.age < w.life); V.confetti = V.confetti.filter(c => c.age < c.life);
}

// ---------- рисование ----------
function bg(vt) {
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d0a24'); gr.addColorStop(1, '#040814'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // параллакс-сетка: ощущение спуска
  g.strokeStyle = 'rgba(120,140,255,.07)'; g.lineWidth = 2; const step = 1.2 * SC, off = -((camY * SC * .5) % step);
  for (let y = off; y < H; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let x = (W / 2) % step; x < W; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
}
function drawTrack(x, t) {
  const top = camY - 1, bot = camY + H / SC + 1;
  // финишная лента
  const fy = race.C.finish; if (fy > top && fy < bot) { const Y = sy(fy), sq = 30; for (let i = 0; i * sq < W; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? '#ffffff' : '#111111'; x.fillRect(i * sq, Y - sq + j * sq, sq, sq); }
    x.save(); x.font = '900 70px Montserrat'; x.textAlign = 'center'; x.lineWidth = 12; x.strokeStyle = '#000'; x.strokeText('ФИНИШ', W / 2, Y - 50); x.fillStyle = '#ffd23f'; x.fillText('ФИНИШ', W / 2, Y - 50); x.restore(); }
  x.lineCap = 'round';
  for (const s of race.C.segs) {
    if (s.y1 < top || s.y0 > bot) continue; if (s.kind === 'gate' && !intro && V.gateT < 0) continue;
    const col = KCOL[s.kind] || '#ffffff', f = V.flash[s.ax + ',' + s.ay] || 0;
    if (s.kind === 'peg' || s.kind === 'bump') { const X = sx(s.ax), Y = sy(s.ay), r = s.t * SC * (1 + f * .4);
      x.fillStyle = rgba(col, .25 + f * .5); x.beginPath(); x.arc(X, Y, r * 1.9, 0, 7); x.fill(); x.fillStyle = col; x.beginPath(); x.arc(X, Y, r, 0, 7); x.fill();
      if (s.kind === 'bump') { x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.stroke(); } continue; }
    let [ax, ay, bx, by] = s.kind === 'spin' ? spinEnds(s, race.S.t) : [s.ax, s.ay, s.bx, s.by];
    if (s.kind === 'gate' && V.gateT >= 0) { const k = clamp(V.gateT / .35); ay += k * 2; by += k * 2; x.globalAlpha = 1 - k; }
    x.strokeStyle = rgba(col, s.kind === 'wall' ? .6 : .9); x.lineWidth = s.t * 2 * SC + 4; x.beginPath(); x.moveTo(sx(ax), sy(ay)); x.lineTo(sx(bx), sy(by)); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = Math.max(2, s.t * SC * .6); x.beginPath(); x.moveTo(sx(ax), sy(ay)); x.lineTo(sx(bx), sy(by)); x.stroke();
    if (s.kind === 'spin') { x.fillStyle = '#ffffff'; x.beginPath(); x.arc(sx(s.cx), sy(s.cy), 12, 0, 7); x.fill(); }
    x.globalAlpha = 1;
  }
}
function drawBall(x, b, scale = 1) {
  const X = sx(b.x), Y = sy(b.y), r = BR * SC * scale;
  const T = V.trails[b.i]; for (let i = 1; i < T.length; i++) { const a = i / T.length; x.strokeStyle = rgba(b.c, a * .5); x.lineWidth = r * 1.5 * a; x.lineCap = 'round'; x.beginPath(); x.moveTo(sx(T[i - 1][0]), sy(T[i - 1][1])); x.lineTo(sx(T[i][0]), sy(T[i][1])); x.stroke(); }
  const halo = x.createRadialGradient(X, Y, r * .5, X, Y, r * 2.6); halo.addColorStop(0, rgba(b.c, .5)); halo.addColorStop(1, rgba(b.c, 0)); x.fillStyle = halo; x.beginPath(); x.arc(X, Y, r * 2.6, 0, 7); x.fill();
  x.save(); x.translate(X, Y); x.beginPath(); x.arc(0, 0, r, 0, 7); x.clip();
  const base = x.createRadialGradient(-r * .3, -r * .35, r * .1, 0, 0, r); base.addColorStop(0, '#ffffff'); base.addColorStop(.3, b.c); base.addColorStop(1, rgba(b.c, 1)); x.fillStyle = base; x.fillRect(-r, -r, 2 * r, 2 * r);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(r * .25, r * .3, r, 0, 7); x.fill();
  x.rotate(b.spin); x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(-r, -r * .12, r * 2, r * .24);   // полоска — видно, как шар катится
  x.restore();
  const sh = x.createRadialGradient(X - r * .35, Y - r * .4, 0, X - r * .35, Y - r * .4, r * .5); sh.addColorStop(0, 'rgba(255,255,255,.95)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = sh; x.beginPath(); x.arc(X, Y, r, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.85)'; x.lineWidth = 2.5; x.beginPath(); x.arc(X, Y, r, 0, 7); x.stroke();
}
function drawFx(x) {
  x.globalCompositeOperation = 'lighter';
  for (const s of V.sparks) { const a = 1 - s.age / s.life; x.strokeStyle = rgba(s.col, a); x.lineWidth = s.w * a + .5; x.beginPath(); x.moveTo(sx(s.x), sy(s.y)); x.lineTo(sx(s.x - s.vx * .03), sy(s.y - s.vy * .03)); x.stroke(); }
  for (const w of V.waves) { if (w.age < 0) continue; const k = w.age / w.life, r = w.r0 + (w.r1 - w.r0) * ease(k); x.strokeStyle = rgba(w.col, (1 - k) * .8); x.lineWidth = w.w * (1 - k) + 1; x.beginPath(); x.arc(sx(w.x), sy(w.y), r * SC, 0, 7); x.stroke(); }
  x.globalCompositeOperation = 'source-over';
}
function txt(s, x, y, size, col, maxW = 980, a = 1) {
  if (a <= 0) return; g.globalAlpha = a; g.font = `900 ${size}px Montserrat`; const sz = Math.min(size, Math.floor(size * maxW / g.measureText(s).width)); g.font = `900 ${sz}px Montserrat`;
  g.textAlign = 'center'; g.lineJoin = 'round'; g.lineWidth = sz * .2; g.strokeStyle = '#000'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); g.globalAlpha = 1;
}
function ballIcon(x, y, r, c, label) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.lineWidth = 5; g.strokeStyle = '#fff'; g.stroke(); if (label) { g.font = `900 ${r * 1.1}px Montserrat`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000'; g.fillText(label, x, y + 2); g.textBaseline = 'alphabetic'; } }
function hud(ph, vt, pk) {
  const B = race.balls;
  if (ph === 'intro') {
    const a = ease(vt / .35); txt('ВЫБЕРИ ЦВЕТ!', W / 2, 230, 150 * (2 - a), '#ffffff', 980, a); txt('КТО ПРИДЁТ ПЕРВЫМ?', W / 2, 345, 84, '#ffd23f', 980, a);
    for (const b of B) { const X = Math.max(125, Math.min(W - 125, sx(b.x))), Y = sy(b.y) - BR * SC - 40; txt(b.name, X, Y, 44, b.c, 230, clamp((vt - .3) / .3)); }
    const c = 3 - Math.floor(vt - .3); if (vt >= .3 && c >= 1) { const f = (vt - .3) % 1, s = 1 + .6 * (1 - ease(f / .25)); txt(String(c), W / 2, 1700, 330 * s, ['#ffd23f', '#ff8a1f', '#ff2b2b'][3 - c], 980, 1 - clamp((f - .8) / .2) * .6); }
    txt('ПИШИ СВОЙ ЦВЕТ В КОММЕНТАХ', W / 2, 1450, 56, '#cfd6ff', 980, clamp((vt - .8) / .3));
    return;
  }
  // табло мест
  const ord = race.S.order; g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(150, 70, 780, 150);
  ord.forEach((bi, k) => { const X = 250 + k * 195; ballIcon(X, 145, k === 0 ? 52 : 42, B[bi].c, String(k + 1)); });
  // карта трассы справа: где кто
  const mx = 1040, m0 = 330, m1 = 1550; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 8; g.lineCap = 'round'; g.beginPath(); g.moveTo(mx, m0); g.lineTo(mx, m1); g.stroke();
  g.fillStyle = '#ffd23f'; g.fillRect(mx - 22, m1 - 4, 44, 8);
  for (const b of B) { const k = clamp(b.y / race.C.finish); g.fillStyle = b.c; g.beginPath(); g.arc(mx, m0 + (m1 - m0) * k, 15, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); }
  if (pk.go < .9) { const a = 1 - clamp((pk.go - .55) / .35), s = 1 + .5 * (1 - ease(pk.go / .2)); txt('СТАРТ!', W / 2, 1650, 190 * s, '#3dff8f', 980, a); }
  for (const p of V.pops) { const k2 = p.t / p.life, s = 1 + .35 * (1 - ease(k2 / .18)), a = 1 - clamp((k2 - .7) / .3); txt(p.txt, W / 2, p.y || 1680, (p.size || 110) * s, p.col, 980, a); }
  if (pk.photo) txt('ФОТОФИНИШ!', W / 2, 360, 130, '#ffffff', 980, Math.min(1, pk.photo * 3));
  if (ph === 'fin' && V.win >= 0) { const f = pk.fin, b = B[V.win], s = 1 + .5 * (1 - ease(f / .2)); txt('ПОБЕДИЛ', W / 2, 1540, 110 * s, '#ffffff'); txt(`${b.name}!`, W / 2, 1700, 170 * s, b.c); }
}

window.SMASH = {
  init(cfg) {
    [cv, g] = mk(W, H); document.body.appendChild(cv); [nc, n] = mk(W, H); [gl1, g1] = mk(W / 4, H / 4); [gl2, g2] = mk(W / 10, H / 10);
    race = makeRace(cfg.seed, cfg.layout || 1); rnd = (s => () => { s = (s * 16807) % 2147483647; return s / 2147483647; })(cfg.seed * 13 + 7);
    const probe = makeRace(cfg.seed, cfg.layout || 1); while (!probe.S.done && probe.S.t < 60) probe.step();
    return { events: probe.S.events, T: probe.S.t, finish: probe.C.finish };
  },
  frame(pk) {
    const S = race.S, ph = pk.ph, B = race.balls; intro = ph === 'intro'; V.photo = pk.photo > 0 || (V.win >= 0 && ph === 'race');
    if (V.photo) V.pops = V.pops.filter(p => !p.lead);
    if (!intro) { if (V.gateT < 0) V.gateT = 0; V.gateT += pk.dt; while (S.t < pk.simT - 1e-9) { race.step(); while (evI < S.events.length) onEvent(S.events[evI++]); } }
    stepFx(intro ? pk.dtv : pk.dt);
    for (const p of V.pops) p.t += pk.dtv; V.pops = V.pops.filter(p => p.t < p.life);
    for (const k in V.flash) V.flash[k] = Math.max(0, V.flash[k] - pk.dtv * 4);
    // всплывашки секций, когда лидер до них доезжает; финишная прямая
    if (!intro && V.win < 0) { const ly = B[S.order[0]].y; for (const m of race.C.marks) if (SEC[m.label] && ly > m.y - 1.5 && !m.shown) { m.shown = 1; if (!V.pops.some(p => p.lead)) V.pops.push({ t: 0, life: 1, txt: SEC[m.label][0], col: SEC[m.label][1], y: 1560, size: 90 }); }
      if (!V.finalStretch && ly > race.C.finish - 5) { V.finalStretch = true; V.pops = V.pops.filter(p => p.lead); V.pops.push({ t: 0, life: 1.4, txt: 'ФИНИШНАЯ ПРЯМАЯ!', col: '#ffd23f', y: 1560, size: 100 }); } }
    if (ph === 'fin' && !V.conf) { V.conf = 1; const c = B[V.win].c; for (let i = 0; i < 160; i++) V.confetti.push({ x: rnd() * CW, y: camY - rnd() * 2, vx: (rnd() - .5) * 2, vy: rnd() * 2, r: rnd() * 6, vr: (rnd() - .5) * 12, age: 0, life: 4, col: i % 3 ? c : ['#ffffff', '#ffd23f', '#ff2bd6'][i % 3], w: 10 + rnd() * 10 }); }
    // камера: лидер в нижней части кадра (видно, что впереди), зум отдаляется, если второй сильно отстал
    if (intro) { SC = 230; camX = CW / 2; camY = -1.0 - (H / SC) * .3; }
    else {
      const ly = Math.max(...B.filter(b => !b.done || b.done === 1).map(b => b.y)), second = B[S.order[1]].y, want = Math.max(118, Math.min(165, H / (Math.max(0, ly - second) + 7.5)));
      const k = Math.min(1, (pk.dtv) * 3);
      if (V.photo) {   // фотофиниш: крупно на двух лидерах
        const a = B[V.win >= 0 ? V.win : S.order[0]], b2 = B[S.order[1]], fx = (a.x + b2.x) / 2, fy = Math.max(a.y, b2.y) * .6 + race.C.finish * .4;
        SC += (215 - SC) * k * 1.5; const half = W / 2 / SC; camX += (Math.max(half, Math.min(CW - half, fx)) - camX) * k * 1.5; camY += (fy - H / SC * .5 - camY) * Math.min(1, pk.dtv * 5);
      } else {
        const fin = ph !== 'race', ws = fin ? 165 : want; SC += (ws - SC) * k; camX += (CW / 2 - camX) * k;
        const target = fin ? race.C.finish - H / SC * .45 : Math.min(race.C.finish + 3.4 - H / SC, ly - H / SC * .6); camY += (target - camY) * Math.min(1, pk.dtv * (pk.go < 1 ? 2 : 4));
      }
    }
    for (const b of B) { const T = V.trails[b.i]; T.push([b.x, b.y]); if (T.length > 10) T.shift(); }
    // кадр
    const shk = V.shake * 8; V.shake = Math.max(0, V.shake - pk.dtv * 4);
    g.setTransform(1, 0, 0, 1, 0, 0); bg(pk.vt);
    n.setTransform(1, 0, 0, 1, 0, 0); n.clearRect(0, 0, W, H); n.setTransform(1, 0, 0, 1, (rnd() - .5) * shk, (rnd() - .5) * shk);
    drawTrack(n, S.t); drawFx(n);
    for (const b of B) { if (intro) { const j = .006 + .02 * clamp(pk.vt / 3.4) ** 2; const ox = b.x, oy = b.y; b.x += (rnd() - .5) * j; b.y += (rnd() - .5) * j; drawBall(n, b); b.x = ox; b.y = oy; } else drawBall(n, b, ph !== 'race' && b.i === V.win ? 1.25 : 1); }
    // конфетти
    for (const c of V.confetti) { n.save(); n.translate(sx(c.x), sy(c.y)); n.rotate(c.r); n.fillStyle = c.col; n.fillRect(-c.w / 2, -c.w / 4, c.w, c.w / 2); n.restore(); }
    g.drawImage(nc, 0, 0);
    g1.clearRect(0, 0, gl1.width, gl1.height); g1.filter = 'blur(5px)'; g1.drawImage(nc, 0, 0, gl1.width, gl1.height); g1.filter = 'none';
    g2.clearRect(0, 0, gl2.width, gl2.height); g2.filter = 'blur(4px)'; g2.drawImage(nc, 0, 0, gl2.width, gl2.height); g2.filter = 'none';
    g.globalCompositeOperation = 'lighter'; g.globalAlpha = .75; g.drawImage(gl1, 0, 0, W, H); g.globalAlpha = .55; g.drawImage(gl2, 0, 0, W, H); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(W / 2, H / 2, 600, W / 2, H / 2, 1250); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    if (ph === 'cta') { hud('fin', pk.vt, pk); drawCta(g, W, H, pk.cta, 'ТВОЙ ЦВЕТ ПОБЕДИЛ?'); } else hud(ph, pk.vt, pk);
    const fa = B.map(b => ({ x: +((b.x - camX) / (CW / 2)).toFixed(2), roll: b.contact > 0 && !intro ? +b.roll.toFixed(2) : 0, vis: b.y > camY - .5 && b.y < camY + H / SC + .5 ? 1 : .4 }));
    return { url: cv.toDataURL('image/jpeg', .9), balls: fa, camY: +camY.toFixed(2), sc: +SC.toFixed(1) };
  },
};
