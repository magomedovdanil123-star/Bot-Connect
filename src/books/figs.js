// Рисованные человечки и предметы для «сценок» (психология): скелет с позами, лицо с эмоциями, ходьба, реплики в облачках.
// Всё рисуется линиями «от руки»: сначала рука обводит контур (голова → тело → ноги → руки), потом проявляется цвет,
// а дальше человечек живёт сам: дышит, моргает, меняет позу по фразам диктора, ходит, говорит.
// Углы рук и ног — от «вниз» (0) вперёд по взгляду (+); π/2 — вперёд горизонтально, π — вверх. Локоть/колено — сгиб относительно плеча/бедра.
const FIG = { thigh: 92, shin: 88, torso: 150, upper: 74, fore: 72, headR: 52, neck: 54 }, SCALE = 1.28;
const POSES = {
  stand: t => ({ lean: 0, head: 0, la: [-.12, .15], ra: [.12, .15], ll: [.06, 0], rl: [-.06, 0] }),
  wave: t => ({ lean: -.03, head: -.06, la: [-.12, .15], ra: [2.55, .45 + .5 * Math.sin(t * 9)], ll: [.06, 0], rl: [-.06, 0] }),
  point: t => ({ lean: .05, head: 0, la: [-.15, .2], ra: [1.6, -.05], ll: [.12, 0], rl: [-.08, 0] }),
  pointup: t => ({ lean: 0, head: -.12, la: [-.1, .2], ra: [2.95, .05], ll: [.06, 0], rl: [-.06, 0] }),
  talk: t => ({ lean: .04, head: .03 * Math.sin(t * 3), la: [-.1, .25], ra: [.75 + .22 * Math.sin(t * 4.3), 1.15 + .35 * Math.sin(t * 6.1)], ll: [.06, 0], rl: [-.06, 0] }),
  explain: t => ({ lean: .04, head: .03 * Math.sin(t * 2.6), la: [.55 + .15 * Math.sin(t * 3.7 + 1), 1.1], ra: [.85 + .2 * Math.sin(t * 4.1), .95 + .3 * Math.sin(t * 5.3)], ll: [.06, 0], rl: [-.06, 0] }),
  shrug: t => ({ lean: 0, head: .18, la: [-.75, -1.5], ra: [.75, 1.5], ll: [.06, 0], rl: [-.06, 0] }),
  cheer: t => ({ lean: -.05, head: -.15, la: [2.6 + .12 * Math.sin(t * 8), .2], ra: [2.9 + .12 * Math.sin(t * 8 + 1), .15], ll: [.1, 0], rl: [-.1, 0] }),
  think: t => ({ lean: .02, head: .12, la: [.45, 1.65], ra: [.55, 2.45], ll: [.06, 0], rl: [-.06, 0] }),
  cross: t => ({ lean: -.03, head: -.05, la: [.45, 1.85], ra: [.35, 1.95], ll: [.08, 0], rl: [-.08, 0] }),
  scared: t => ({ lean: -.16, head: -.08, la: [1.05, 1.75], ra: [1.25, 1.7], ll: [.22, -.25], rl: [-.12, -.2] }),
  press: t => ({ lean: .16, head: .12, la: [-.1, .3], ra: [1.05, .3], ll: [.1, 0], rl: [-.1, 0] }),
  phone: t => ({ lean: 0, head: .1, la: [.3, 1.5], ra: [.45, 2.75], ll: [.06, 0], rl: [-.06, 0] }),
  hold: t => ({ lean: .03, head: .05, la: [1.15, .45], ra: [1.25, .4], ll: [.06, 0], rl: [-.06, 0] }),
  give: t => ({ lean: .12, head: .05, la: [-.1, .25], ra: [1.35, .15], ll: [.14, 0], rl: [-.08, 0] }),
  sad: t => ({ lean: .22, head: .38, la: [.05, .05], ra: [.08, .05], ll: [.05, 0], rl: [-.05, 0] }),
  facepalm: t => ({ lean: .1, head: .3, la: [.05, .1], ra: [.85, 2.55], ll: [.06, 0], rl: [-.06, 0] }),
  angry: t => ({ lean: .12, head: .05, la: [-.4, 1.35], ra: [.4 + .2 * Math.sin(t * 7), 1.35], ll: [.18, 0], rl: [-.14, 0] }),
  sit: t => ({ lean: -.04, head: 0, la: [.35, .9], ra: [.45, .85], ll: [1.5, -1.5], rl: [1.62, -1.55] }),
  sitwork: t => ({ lean: .1, head: .15, la: [.95, .5 + .15 * Math.sin(t * 11)], ra: [1.0, .45 + .15 * Math.sin(t * 13 + 1)], ll: [1.5, -1.5], rl: [1.62, -1.55] }),
  bow: t => ({ lean: .55, head: .2, la: [.3, .1], ra: [.4, .1], ll: [.04, 0], rl: [-.04, 0] }),
  run: t => ({ lean: .2, head: 0, la: [-.12, .15], ra: [.12, .15], ll: [.06, 0], rl: [-.06, 0] }),
};
const BLEND = ['lean', 'head'], mix = (a, b, u) => a + (b - a) * u;
function blendPose(A, B, u) {
  const P = {}; for (const k of BLEND) P[k] = mix(A[k], B[k], u);
  for (const k of ['la', 'ra', 'll', 'rl']) P[k] = [mix(A[k][0], B[k][0], u), mix(A[k][1], B[k][1], u)];
  return P;
}
const V = (a, f) => [Math.sin(a) * f, Math.cos(a)];
// скелет: точки суставов в координатах человечка (0,0 — между ступнями на полу), f — куда смотрит (+1 вправо, −1 влево)
function rig(P, f) {
  const hip = [0, -(FIG.thigh + FIG.shin)], up = [Math.sin(P.lean) * f, -Math.cos(P.lean)];
  const sh = [hip[0] + up[0] * (FIG.torso - 18), hip[1] + up[1] * (FIG.torso - 18)], neck = [hip[0] + up[0] * FIG.torso, hip[1] + up[1] * FIG.torso];
  const hd = [Math.sin(P.lean + P.head) * f, -Math.cos(P.lean + P.head)], head = [neck[0] + hd[0] * FIG.neck, neck[1] + hd[1] * FIG.neck];
  const limb = (o, [a, b], l1, l2) => { const v1 = V(a, f), m = [o[0] + v1[0] * l1, o[1] + v1[1] * l1], v2 = V(a + b, f); return [o, m, [m[0] + v2[0] * l2, m[1] + v2[1] * l2]]; };
  const J = { hip, sh, neck, head, la: limb(sh, P.la, FIG.upper, FIG.fore), ra: limb(sh, P.ra, FIG.upper, FIG.fore), ll: limb(hip, P.ll, FIG.thigh, FIG.shin), rl: limb(hip, P.rl, FIG.thigh, FIG.shin) };
  const low = Math.max(J.ll[2][1], J.rl[2][1]), dy = -low;   // ступни — на полу (сидя/присев бёдра опускаются сами)
  for (const k of ['hip', 'sh', 'neck', 'head']) J[k] = [J[k][0], J[k][1] + dy];
  for (const k of ['la', 'ra', 'll', 'rl']) J[k] = J[k].map(p => [p[0], p[1] + dy]);
  return J;
}
const circ = (cx, cy, r, n = 28, a0 = -Math.PI / 2) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos(a0 + i / n * 6.2832) * r, cy + Math.sin(a0 + i / n * 6.2832) * r]);
// части человечка: { pts, w, color, fill, late, ord } — ord: порядок, в котором их обводит рука; порядок в массиве — кто кого закрывает
function figParts(J, f, s) {
  const c = s.color || '#4a90d9', parts = [], foot = l => [l[2], [l[2][0] + f * 22, l[2][1]]];
  const limb = (l, ord) => parts.push({ pts: l, w: 13, color: INK, ord }, { pts: foot(l), w: 14, color: INK, ord });
  const arm = (l, ord) => parts.push({ pts: l, w: 13, color: INK, ord }, { pts: circ(l[2][0], l[2][1], 8, 8), w: 6, color: INK, fill: INK, ord });
  if (s.coat) parts.push({ pts: [[J.hip[0] + (J.sh[0] - J.hip[0]) * -.45, J.hip[1] + 60], J.sh], w: 96, color: INK, ord: 2 }, { pts: [[J.hip[0] + (J.sh[0] - J.hip[0]) * -.45, J.hip[1] + 60], J.sh], w: 82, color: '#fff', late: true, ord: 2 });
  arm(J.la, 6); limb(J.ll, 4); limb(J.rl, 5);
  parts.push({ pts: [J.hip, J.sh], w: 94, color: INK, ord: 1 }, { pts: [J.hip, J.sh], w: 78, color: s.coat ? '#fff' : c, late: true, ord: 1 });
  if (s.coat) parts.push({ pts: [[J.hip[0], J.hip[1] + 8], [J.sh[0] + f * 6, J.sh[1]]], w: 4, color: INK, late: true, ord: 1 });
  if (s.tie) parts.push({ pts: [[J.sh[0] + f * 10, J.sh[1] - 2], [J.sh[0] + f * 14 + (J.hip[0] - J.sh[0]) * .45, J.sh[1] + (J.hip[1] - J.sh[1]) * .45]], w: 12, color: RED, late: true, ord: 1 });
  parts.push({ pts: circ(J.head[0], J.head[1], FIG.headR), w: 8, color: INK, fill: s.skin || '#fff', ord: 0 });
  arm(J.ra, 7);
  return parts;
}
function polyLen(p) { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; }
// общий «рисовальщик» линий: p — доля обводки (0..1), fillA — проявление цвета; возвращает кончик маркера
function strokeParts(parts, p, fillA = 1) {
  const order = parts.map((x, i) => i).filter(i => !parts[i].late).sort((a, b) => (parts[a].ord || 0) - (parts[b].ord || 0) || a - b);
  let tot = 0; const c0 = {}; for (const i of order) { parts[i].len = Math.max(1, polyLen(parts[i].pts)); c0[i] = tot; tot += parts[i].len; }
  const L = p * tot; let tip = null;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  parts.forEach((o, i) => {
    if (o.late) { if (p < 1 || fillA <= 0) return; g.globalAlpha = fillA; g.strokeStyle = o.color; g.lineWidth = o.w; g.beginPath(); o.pts.forEach((q, k) => k ? g.lineTo(...q) : g.moveTo(...q)); g.stroke(); g.globalAlpha = 1; return; }
    const fr = clamp((L - c0[i]) / o.len); if (fr <= 0) return;
    if (o.fill && fr >= 1) { g.globalAlpha = o.fill === '#fff' || o.fill === INK ? 1 : fillA; g.fillStyle = o.fill; g.beginPath(); o.pts.forEach((q, k) => k ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.fill(); g.globalAlpha = 1; }
    g.strokeStyle = o.color; g.lineWidth = o.w; g.beginPath(); let left = fr * o.len, last = o.pts[0]; g.moveTo(...last);
    for (let k = 1; k < o.pts.length && left > 0; k++) { const a = o.pts[k - 1], b = o.pts[k], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-6, u = Math.min(1, left / d); last = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; g.lineTo(...last); left -= d; }
    g.stroke(); if (fr < 1 && !tip) tip = last;
  });
  g.restore(); return p < 1 ? tip : null;
}
// лицо: глаза (моргают), брови и рот по эмоции; talk — рот открывается в такт
function drawFace(J, f, face, t, talk, seed, s) {
  const [hx, hy] = J.head, tilt = 0; g.save(); g.strokeStyle = g.fillStyle = INK; g.lineCap = 'round'; g.lineWidth = 6;
  const ex = [hx + f * 2, hx + f * 24], ey = hy - 8, blink = ((t + seed) % 3.7) < .13;
  const big = face === 'scared' || face === 'surprised';
  for (const x of ex) { if (blink) { g.beginPath(); g.moveTo(x - 6, ey); g.lineTo(x + 6, ey); g.stroke(); } else { g.beginPath(); g.arc(x, ey, big ? 7 : 5.5, 0, 6.283); g.fill(); } }
  const brow = (dy1, dy2) => { for (const x of ex) { g.beginPath(); g.moveTo(x - 9, ey - 16 + (f > 0 === x === ex[0] ? dy1 : dy2)); g.lineTo(x + 9, ey - 16 + (f > 0 === x === ex[0] ? dy2 : dy1)); g.stroke(); } };
  if (face === 'angry') { g.beginPath(); g.moveTo(ex[0] - 9, ey - 22); g.lineTo(ex[0] + 8, ey - 13); g.moveTo(ex[1] + 9 * f * f, ey - 22); g.lineTo(ex[1] - 8 * f * f, ey - 13); g.stroke(); }
  if (face === 'sad' || face === 'scared') { g.beginPath(); for (const x of ex) { g.moveTo(x - 9, ey - 14); g.lineTo(x + 9, ey - 21); } g.stroke(); }
  if (face === 'surprised') { g.beginPath(); for (const x of ex) { g.moveTo(x - 8, ey - 22); g.quadraticCurveTo(x, ey - 28, x + 8, ey - 22); } g.stroke(); }
  const mx = hx + f * 14, my = hy + 22;
  g.beginPath();
  if (talk > 0) { const o = 3 + 9 * Math.abs(Math.sin(t * 13 + seed)) * talk; g.ellipse(mx, my, 9, o, 0, 0, 6.283); g.fill(); }
  else if (face === 'happy') { g.moveTo(mx - 15, my - 6); g.quadraticCurveTo(mx, my + 14, mx + 15, my - 6); g.stroke(); }
  else if (face === 'smug') { g.moveTo(mx - 12, my); g.quadraticCurveTo(mx + 4, my + 6, mx + 15 * f * f, my - 8); g.stroke(); }
  else if (face === 'sad' || face === 'angry') { g.moveTo(mx - 13, my + 6); g.quadraticCurveTo(mx, my - 8, mx + 13, my + 6); g.stroke(); }
  else if (big) { g.ellipse(mx, my + 2, 8, 11, 0, 0, 6.283); g.fill(); }
  else { g.moveTo(mx - 11, my); g.lineTo(mx + 11, my); g.stroke(); }
  if (s.glasses) { g.lineWidth = 4; g.beginPath(); for (const x of ex) { g.moveTo(x + 13, ey); g.arc(x, ey, 13, 0, 6.283); } g.moveTo(ex[0] + 13 * Math.sign(ex[1] - ex[0]), ey); g.lineTo(ex[1] - 13 * Math.sign(ex[1] - ex[0]), ey); g.stroke(); }
  if (face === 'scared' || face === 'sweat') { g.fillStyle = '#5aa9e6'; g.beginPath(); const dx = hx - f * 40, dy = hy - 20 + ((t * 40) % 30); g.moveTo(dx, dy - 14); g.quadraticCurveTo(dx + 9, dy, dx, dy + 6); g.quadraticCurveTo(dx - 9, dy, dx, dy - 14); g.fill(); }
  if (face === 'blush' || face === 'happy') { g.fillStyle = 'rgba(232,93,117,.35)'; g.beginPath(); g.ellipse(hx + f * 34, hy + 10, 9, 6, 0, 0, 6.283); g.fill(); }
  g.restore();
}
// причёска и головные уборы — поверх головы (после обводки)
function drawHair(J, f, s) {
  const [hx, hy] = J.head, r = FIG.headR, col = s.hairColor || '#3b2a20', h = s.hair || 'short'; if (h === 'bald') return;
  g.save(); g.fillStyle = col; g.strokeStyle = INK; g.lineWidth = 6; g.lineJoin = 'round';
  if (h === 'long') { g.beginPath(); g.moveTo(hx - f * 20, hy - r + 4); g.quadraticCurveTo(hx - f * (r + 26), hy, hx - f * (r + 4), hy + r + 30); g.lineTo(hx - f * 6, hy + r - 4); g.quadraticCurveTo(hx - f * (r - 8), hy, hx - f * 2, hy - r + 8); g.closePath(); g.fill(); g.stroke(); }
  if (h === 'bun') { g.beginPath(); g.arc(hx - f * 26, hy - r - 6, 20, 0, 6.283); g.fill(); g.stroke(); }
  if (h === 'cap') {
    g.fillStyle = s.capColor || RED; g.beginPath(); g.arc(hx, hy - 6, r + 3, Math.PI * 1.03, Math.PI * 1.97); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(hx + f * (r - 4), hy - 10); g.lineTo(hx + f * (r + 34), hy - 4); g.lineTo(hx + f * (r - 4), hy - 2); g.closePath(); g.fill(); g.stroke();
  } else if (h === 'spiky') {
    g.beginPath(); for (let k = 0; k <= 10; k++) { const a = Math.PI * (1.0 + k * .1), rr = r + (k % 2 ? 20 : 0); g.lineTo(hx + Math.cos(a) * rr, hy + Math.sin(a) * rr); } g.quadraticCurveTo(hx, hy - r * .45, hx - r, hy); g.closePath(); g.fill(); g.stroke();
  } else {   // short / long / bun — волосы сверху головы, чёлка сдвинута к лицу
    g.beginPath(); const a0 = Math.PI * 1.08, a1 = Math.PI * 1.92; g.arc(hx, hy, r + 4, a0, a1);
    g.quadraticCurveTo(hx + f * r * .55, hy - r * .2, hx + f * r * .1, hy - r * .55); g.quadraticCurveTo(hx - f * r * .4, hy - r * .35, hx + Math.cos(f > 0 ? a0 : a1) * (r + 4), hy + Math.sin(a0) * (r + 4) + 6);
    g.closePath(); g.fill(); g.stroke();
  }
  g.restore();
}
// состояние актёра в момент T: где стоит, куда смотрит, поза (плавный переход), идёт ли, эффекты
function actorState(it, T) {
  const s = it.fig; let x = s.x, f = s.look || 1, pose = s.pose || 'stand', face = s.face || 'neutral', prev = pose, poseT = -99, walk = null, hold = s.hold || null, holdT = -9; const fx = [];
  for (const b of it.beats || []) {
    if (b.t > T) break;
    if (b.look) f = b.look;
    if (b.face) face = b.face;
    if (b.pose && b.pose !== pose) { prev = pose; pose = b.pose; poseT = b.t; }
    if (b.walk != null) { const x0 = x, dur = Math.max(.6, Math.abs(b.walk - x0) / (b.run ? 620 : 360)); f = Math.sign(b.walk - x0) || f; if (T < b.t + dur) { const u = (T - b.t) / dur, e = u < .1 ? u * u * 5 : u > .9 ? 1 - (1 - u) ** 2 * 5 : u - .05; x = x0 + (b.walk - x0) * clamp(e); walk = { d: Math.abs(x - x0), run: b.run }; } else x = b.walk; }
    if (b.fx) fx.push({ k: b.fx, t: b.t });
    if (b.hold !== undefined) { hold = b.hold; holdT = b.t; }
  }
  const tl = T + (s.seed || 0);
  let P = blendPose(POSES[prev]?.(tl) || POSES.stand(tl), POSES[pose]?.(tl) || POSES.stand(tl), eio(clamp((T - poseT) / .4)));
  if (walk) {   // шаг: ноги и руки ходят «ножницами», корпус чуть вперёд
    const ph = walk.d / (walk.run ? 75 : 62), a = walk.run ? .7 : .48;
    P = { ...P, lean: walk.run ? .22 : .06, ll: [a * Math.sin(ph), -Math.max(0, .9 * Math.sin(ph + 1.2))], rl: [-a * Math.sin(ph), -Math.max(0, .9 * Math.sin(ph + 1.2 + Math.PI))], la: [-.5 * Math.sin(ph), .3], ra: [.5 * Math.sin(ph), .3] };
  }
  P.head += .025 * Math.sin(tl * 1.3); let dy = 2.5 * Math.sin(tl * 2.2), dx = 0;
  for (const e of fx) { const u = T - e.t; if (e.k === 'jump' && u < .8) dy -= 70 * Math.abs(Math.sin(u / .8 * Math.PI * 2)) * (1 - u / .8 * .5); if (e.k === 'shake' && u < 1.4) dx += 5 * Math.sin(u * 70); }
  return { x: x + dx, dy, f, P, face, fx, walk, hold, holdT };
}
function drawFig(it, t, T) {
  const s = it.fig, st = actorState(it, T), k = s.scale || SCALE, gy = s.y;
  const J = rig(st.P, st.f), D = it.dur, p = clamp(t / D), fillA = clamp((t - D) / .45);
  g.save(); g.translate(st.x, gy + st.dy); g.scale(k, k);
  // тень на полу
  g.save(); g.globalAlpha = .12 * clamp(t / D * 2); g.fillStyle = INK; g.beginPath(); g.ellipse(0, -st.dy / k, 70, 11, 0, 0, 6.283); g.fill(); g.restore();
  const parts = figParts(J, st.f, s);
  let tip = strokeParts(parts, p, fillA);
  if (p >= 1) {
    drawHair(J, st.f, s);
    const talk = (it.talk || []).some(([a, b]) => T >= a && T <= b) ? 1 : 0;
    drawFace(J, st.f, st.face, T, talk, s.seed || 0, s);
    if (st.hold && ART[st.hold]) { const hd = J.ra[2], sc = eo(clamp((T - st.holdT) / .3)); g.save(); g.translate(hd[0] + st.f * 18, hd[1] - 30); g.scale(sc, sc); drawPic({ emoji: st.hold, x: 0, y: 0, s: 105, dur: .01 }, 9, 0); g.restore(); }
    for (const e of st.fx) { const u = T - e.t; if ((e.k === '!' || e.k === '?') && u < 1.8) { g.save(); g.font = '700 110px Amatic'; g.textAlign = 'center'; g.fillStyle = e.k === '!' ? RED : INK; const sc = eo(clamp(u / .25)) * (1 + .15 * Math.sin(u * 10) * (u < .6)); g.translate(J.head[0] + st.f * 40, J.head[1] - 70); g.scale(sc, sc); g.globalAlpha = clamp((1.8 - u) / .3); g.fillText(e.k, 0, 0); g.restore(); } }
  }
  g.restore();
  return tip ? [st.x + tip[0] * k, gy + st.dy + tip[1] * k] : null;
}
// голова актёра в координатах листа (для облачка реплики)
function headAt(it, T) { const st = actorState(it, T), J = rig(st.P, st.f), k = it.fig.scale || SCALE; return { x: st.x + J.head[0] * k, y: it.fig.y + J.head[1] * k, f: st.f }; }

// облачко реплики (say) или мысли (think): контур от руки, белая заливка, потом рука пишет текст
function bubbleBox(it) {
  if (it._box) return it._box;
  const A = ITEMS[it.actor], h = headAt(A, it.t0), size = it.size || 64; g.save(); g.font = `700 ${size}px Amatic`;
  const lines = it.bubble.split('\n'), w = Math.max(...lines.map(l => g.measureText(l).width)) + 90, hh = lines.length * size * 1.05 + 56; g.restore();
  const side = it.side || (h.x < W / 2 ? -1 : 1);   // облачко — к ближнему краю, чтобы реплики двух героев не наезжали
  let cx = h.x + side * (w / 2 - 30), cy = h.y - FIG.headR * SCALE - 60 - hh / 2;
  cx = clamp(cx, w / 2 + 50, W - w / 2 - 50); cy = Math.max(hh / 2 + 40, cy);
  return (it._box = { cx, cy, w, h: hh, size, hx: h.x, hy: h.y - FIG.headR * SCALE - 8, lines });
}
function drawBubble(it, t, T) {
  const b = bubbleBox(it), out = it.until != null ? clamp((T - it.until) / .3) : 0; if (out >= 1) return null;
  const pb = clamp(t / .4); let tip = null;
  g.save(); g.globalAlpha = 1 - out;
  const { cx, cy, w, h } = b, pts = [];
  if (it.think) { for (let i = 0; i <= 60; i++) { const a = i / 60 * 6.2832, r = 1 + .07 * Math.abs(Math.sin(a * 5)); pts.push([cx + Math.cos(a) * w * .58 * r, cy + Math.sin(a) * h * .62 * r]); } }
  else {   // скруглённый прямоугольник с хвостиком к голове
    const r = 34, x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2, tx = clamp(b.hx, x0 + 60, x1 - 60), dir = Math.sign(b.hx - cx) || 1;
    const arc = (ax, ay, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + i / 6 * Math.PI / 2; pts.push([ax + Math.cos(a) * r, ay + Math.sin(a) * r]); } };
    arc(x0 + r, y0 + r, Math.PI); arc(x1 - r, y0 + r, -Math.PI / 2); arc(x1 - r, y1 - r, 0);
    pts.push([tx + dir * 22, y1], [b.hx + dir * 6, Math.min(b.hy, y1 + 70)], [tx - dir * 22, y1]);
    arc(x0 + r, y1 - r, Math.PI / 2); pts.push(pts[0]);
  }
  if (pb >= 1) { g.fillStyle = '#fff'; g.beginPath(); pts.forEach((q, k) => k ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.fill(); }
  tip = strokeParts([{ pts, w: 6, color: INK }], pb);
  if (it.think && pb >= 1) { g.fillStyle = '#fff'; g.strokeStyle = INK; g.lineWidth = 5; for (const [k, rr] of [[.35, 16], [.7, 10]]) { const x = cx + (b.hx - cx) * (.45 + k * .5), y = cy + h * .62 + (b.hy - cy - h * .62) * k; g.beginPath(); g.arc(x, y, rr, 0, 6.283); g.fill(); g.stroke(); } }
  g.restore();
  if (pb >= 1) { const y0 = cy - (b.lines.length - 1) * b.size * 1.05 / 2 + b.size * .35; g.save(); g.globalAlpha = 1 - out; tip = drawText({ text: it.bubble, x: cx, y: y0, size: b.size, color: it.color || INK, dur: it.dur - .4 }, t - .4, 0); g.restore(); }
  return out > 0 ? null : tip;
}

// предметы сценки: пол, стол, стул, дверь, стена, пульт, доска, прилавок, диван — линиями, потом цвет
function propParts(p) {
  const x = p.x, y = p.y, P = [];
  const rect = (x0, y0, w, h, fill, w2 = 8, ord = 0) => P.push({ pts: [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]], w: w2, color: INK, fill, ord });
  switch (p.prop) {
    case 'backdrop': break;
    case 'floor': P.push({ pts: Array.from({ length: 25 }, (_, i) => [140 + i * 68, y + 4 * Math.sin(i * 1.7)]), w: 6, color: INK }); break;
    case 'table': { const w = p.w || 340, h = p.h || 150; rect(x - w / 2, y - h, w, 18, p.color || '#c98b4f'); P.push({ pts: [[x - w / 2 + 26, y - h + 18], [x - w / 2 + 26, y]], w: 9, color: INK }, { pts: [[x + w / 2 - 26, y - h + 18], [x + w / 2 - 26, y]], w: 9, color: INK }); break; }
    case 'chair': { const fl = p.flip ? -1 : 1; P.push({ pts: [[x - 48, y - 98], [x + 48, y - 98]], w: 10, color: INK }, { pts: [[x - 40 * fl, y - 98], [x - 40 * fl, y]], w: 9, color: INK }, { pts: [[x + 40 * fl, y - 98], [x + 40 * fl, y]], w: 9, color: INK }, { pts: [[x - 48 * fl, y - 98], [x - 52 * fl, y - 230]], w: 10, color: INK }); break; }
    case 'door': { rect(x - 85, y - 360, 170, 360, p.color || '#b9773e'); P.push({ pts: circ(x + 52, y - 180, 9, 10), w: 6, color: INK, fill: '#f2c14e' }); break; }
    case 'wall': { rect(x - 16, y - (p.h || 640), 32, p.h || 640, '#d9d9d9'); break; }
    case 'console': {   // пульт с переключателями (Милгрэм): стол и коробка на нём
      const w = 300; rect(x - w / 2 - 20, y - 150, w + 40, 18, '#c98b4f'); P.push({ pts: [[x - w / 2, y - 132], [x - w / 2, y]], w: 9, color: INK }, { pts: [[x + w / 2, y - 132], [x + w / 2, y]], w: 9, color: INK });
      rect(x - w / 2, y - 260, w, 110, '#9aa5b1'); for (let i = 0; i < 6; i++) P.push({ pts: [[x - w / 2 + 34 + i * 46, y - 222], [x - w / 2 + 34 + i * 46, y - 190]], w: 7, color: i > 3 ? RED : INK });
      P.push({ pts: circ(x + w / 2 - 34, y - 238, 10, 10), w: 5, color: INK, fill: RED }); break; }
    case 'board': { const w = p.w || 520, h = p.h || 320; rect(x - w / 2, y - h, w, h, '#fff', 9); break; }
    case 'counter': { const w = p.w || 420, h = p.h || 170; rect(x - w / 2, y - h, w, h, p.color || '#e8c07a'); P.push({ pts: [[x - w / 2, y - h + 34], [x + w / 2, y - h + 34]], w: 6, color: INK }); break; }
    case 'sofa': { const w = p.w || 380; rect(x - w / 2, y - 120, w, 80, p.color || '#8e7cc3'); rect(x - w / 2, y - 210, w, 90, p.color || '#8e7cc3'); P.push({ pts: [[x - w / 2 + 20, y - 40], [x - w / 2 + 20, y]], w: 9, color: INK }, { pts: [[x + w / 2 - 20, y - 40], [x + w / 2 - 20, y]], w: 9, color: INK }); break; }
    case 'window': { const w = p.w || 260, h = p.h || 220, y0 = y - (p.at || 560); rect(x - w / 2, y0, w, h, '#cfe8ff'); P.push({ pts: [[x, y0], [x, y0 + h]], w: 6, color: INK }, { pts: [[x - w / 2, y0 + h / 2], [x + w / 2, y0 + h / 2]], w: 6, color: INK }); break; }
  }
  return P;
}
const BG = ['#fdf0e1', '#e6f1fa', '#eaf5e4', '#fbe8ee', '#f0ebfa', '#fff4d1'];
function drawProp(it, t) {
  if (it.prop.prop === 'backdrop') {   // пастельный «задник» сценки: проявляется косой шторкой, без руки
    const u = eo(clamp(t / .6)), x0 = 120, x1 = 1800, y0 = 70, y1 = it.prop.y, c = it.prop.color || BG[it.page % BG.length];
    g.save(); g.beginPath(); const r = x0 + (x1 - x0 + 400) * u; g.moveTo(x0 - 10, y0 - 10); g.lineTo(r, y0 - 10); g.lineTo(r - 400, y1 + 10); g.lineTo(x0 - 10, y1 + 10); g.closePath(); g.clip();
    g.fillStyle = c; g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 40); g.fill(); g.restore(); return null;
  }
  const parts = it._parts || (it._parts = propParts(it.prop)), p = clamp(t / it.dur), fillA = clamp((t - it.dur) / .4);
  const order = parts.filter(o => o.fill && o.fill !== INK);
  // цвет: заливки проявляются после обводки (white/ink — сразу), поэтому сначала рисуем заливки, потом линии
  if (p >= 1) { g.save(); for (const o of order) { g.globalAlpha = fillA; g.fillStyle = o.fill; g.beginPath(); o.pts.forEach((q, k) => k ? g.lineTo(...q) : g.moveTo(...q)); g.closePath(); g.fill(); } g.restore(); }
  const tip = strokeParts(parts.map(o => ({ ...o, fill: o.fill === INK || o.fill === '#fff' ? o.fill : null })), p);
  if (it.prop.prop === 'board' && it.prop.text && p >= 1) drawText({ text: it.prop.text, x: it.prop.x, y: it.prop.y - (it.prop.h || 320) / 2 + 30, size: it.prop.size || 80, color: it.prop.red ? RED : INK, dur: .8 }, t - it.dur, 0);
  return tip;
}
