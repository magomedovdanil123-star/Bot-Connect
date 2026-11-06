/* Стикмены «как в мультфильме»: риг на костях с плавными переходами поз, свечение контура, детальные локации, неоновые плашки и инфографика.
 * Мир всегда 1920×1080; камера cam = { x, y, z }. Сцена = T2[shot](u, o, t, d) — u 0..1 по фразе, d — длина фразы в секундах. */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, sm = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const eo = k => 1 - (1 - clamp(k, 0, 1)) ** 3, ei = k => clamp(k, 0, 1) ** 3, prog = (t, a, b) => clamp((t - a) / (b - a), 0, 1);
const hr = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const INK = '#0c0c12', GLOW = 'rgba(140,200,255,.95)';
const K = W / 1920; let PZ = 1, SHX = 0, SHY = 0;
function camSet(c) { const z = c.z * K * PZ; X.setTransform(z, 0, 0, z, W / 2 - (c.x + SHX) * z, H / 2 - (c.y + SHY) * z); }
function cam(u, keys) { let i = 0; while (i < keys.length - 1 && u >= keys[i + 1][0]) i++; const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)], k = b[0] > a[0] ? sm((u - a[0]) / (b[0] - a[0])) : 0;
  return { x: lerp(a[1], b[1], k), y: lerp(a[2], b[2], k), z: lerp(a[3], b[3], k) }; }
const rr = (x, y, w, h, r, fill) => { X.beginPath(); X.roundRect(x, y, w, h, r); X.fillStyle = fill; X.fill(); };
const circ = (x, y, r, fill) => { X.beginPath(); X.arc(x, y, r, 0, Math.PI * 2); X.fillStyle = fill; X.fill(); };
const ell = (x, y, rx, ry, fill, rot = 0) => { X.beginPath(); X.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); X.fillStyle = fill; X.fill(); };
const lg = (x0, y0, x1, y1, stops) => { const g = X.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
const rg = (x, y, r, stops) => { const g = X.createRadialGradient(x, y, 0, x, y, r); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
function glow(x, y, r, col) { X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = rg(x, y, r, [[0, col], [1, 'rgba(0,0,0,0)']]); X.fillRect(x - r, y - r, r * 2, r * 2); X.restore(); }
function shadow(x, y, w) { ell(x, y + 4, w, w * .16, 'rgba(0,0,0,.28)'); }

/* ================= ЧЕЛОВЕЧЕК =================
 p: { x, y (ступни), s, dir 1|-1, top (цвет кофты), sleeve: true — рукава цвета кофты, pants, garment: 'tee'|'hoodie'|'coat'|'dress',
      hat: 'cap'|'helmet'|'beanie'|null, hatCol, hair: 'tail'|'bun'|'spiky'|null, scarf, glasses, hold: 'phone'|'cup'|'umbrella'|'pin'|null,
      acts: [[время с начала фразы, 'действие'], …] или act, face: { eyes: 'open'|'meh'|'wide'|'closed'|'happy', mouth: 'line'|'smile'|'o'|'frown'|'grin'|'talk' }, look: -1..1, seed } */
const ARM = 50, FORE = 48, THIGH = 66, SHIN = 64, HEAD = 48;
function pose(act, t, p) {   // углы от вертикали вниз, «+» — в сторону взгляда (dir); L — дальняя рука/нога, R — ближняя
  const A = { lean: 0, bob: 0, tilt: 0, nod: 0, dx: 0, L: [-.14, .12], R: [.14, -.12], LL: [-.05, .02], RL: [.05, .02], sit: 0, lie: 0 };
  const seed = p.seed || 0, br = Math.sin(t * 2.2 + seed);
  A.bob = br * 1.6; A.L[0] -= br * .02; A.R[0] += br * .02; A.tilt = Math.sin(t * 1.1 + seed) * .03;
  const ph = t * 5.4 * (p.speed || 1) + seed;
  switch (act) {
    case 'walk': { const s = Math.sin(ph); A.LL = [.42 * s, -(.05 + .7 * Math.max(0, Math.cos(ph)))]; A.RL = [-.42 * s, -(.05 + .7 * Math.max(0, -Math.cos(ph)))];
      A.L = [-.38 * s, .3]; A.R = [.38 * s, .3]; A.bob = -Math.abs(Math.cos(ph)) * 7 + 4; A.lean = .05; A.tilt = Math.sin(ph) * .03; break; }
    case 'run': { const q = t * 8.5 * (p.speed || 1) + seed, s = Math.sin(q); A.LL = [.65 * s + .1, -(.35 + 1.25 * Math.max(0, Math.cos(q)))]; A.RL = [-.65 * s + .1, -(.35 + 1.25 * Math.max(0, -Math.cos(q)))];
      A.L = [-.8 * s, 1.5]; A.R = [.8 * s, 1.5]; A.bob = -Math.abs(Math.cos(q)) * 14 + 6; A.lean = .22; break; }
    case 'talk': { const g = Math.sin(t * 3.1 + seed), g2 = Math.sin(t * 4.7 + seed); A.R = [.55 + .35 * g, -1.2 + .45 * g2]; A.L = [-.3 + .15 * g2, -.3]; A.tilt = .07 * g; A.nod = .05 * Math.sin(t * 5); break; }
    case 'think': A.R = [.75, -2.55]; A.L = [.35, -1.45]; A.tilt = .14 + Math.sin(t * .9) * .03; A.nod = .06; break;
    case 'shock': A.L = [-2.35, -.35]; A.R = [2.35, .35]; A.lean = -.12; A.dx = -6; break;
    case 'fear': A.L = [.75, -1.95]; A.R = [.85, -2.0]; A.lean = -.1; A.dx = Math.sin(t * 45) * 2.5; A.LL = [-.1, -.3]; A.RL = [.15, -.35]; A.bob -= 6; break;
    case 'joy': { const j = Math.abs(Math.sin(t * 6)); A.L = [-2.7, -.2]; A.R = [2.7, .2]; A.bob = -j * 26; A.LL = [-.15 + j * .35, -j * .7]; A.RL = [.15 + j * .35, -j * .7]; break; }
    case 'sad': A.L = [-.04, .05]; A.R = [.04, -.05]; A.tilt = .05; A.nod = .32; A.bob = -4 + br; A.lean = .05; break;
    case 'point': A.R = [1.5, -.05]; A.L = [-.18, .2]; A.tilt = .05; break;
    case 'phone': A.R = [.55, -1.75]; A.L = [.3, -1.6]; A.nod = .22; break;
    case 'watch': A.L = [.85, -1.9]; A.R = [.2, -.3]; A.nod = .2; break;
    case 'wave': A.R = [2.6 + Math.sin(t * 9) * .3, .45]; break;
    case 'pull': A.L = [1.35, -.15]; A.R = [1.5, -.05]; A.lean = -.2; A.LL = [.35, -.15]; A.RL = [-.3, -.35]; break;
    case 'reach': A.R = [1.65, 0]; A.L = [1.1, -.4]; A.lean = .18; break;
    case 'bake': { const r = Math.sin(t * 5); A.L = [1.05 + r * .12, -.9]; A.R = [1.15 + r * .12, -.85]; A.nod = .18; A.lean = .1; break; }
    case 'laugh': { const l = Math.abs(Math.sin(t * 9)); A.L = [.2, -.2]; A.R = [.7, -2.3]; A.tilt = -.1 - l * .05; A.bob = -l * 4; break; }
    case 'float': { const w = Math.sin(t * 2.4 + seed); A.L = [-1.9 + w * .25, -.35]; A.R = [1.9 - w * .25, .35]; A.LL = [-.25 + w * .15, -.5]; A.RL = [.3 - w * .15, -.7]; A.lean = -.06 + w * .04; A.tilt = w * .08; break; }
    case 'sneezeIn': A.L = [.9, -2.1]; A.R = [1.0, -2.2]; A.lean = -.22; A.tilt = -.18; break;
    case 'sneezeOut': A.L = [1.2, -.8]; A.R = [1.3, -.7]; A.lean = .32; A.tilt = .15; A.nod = .2; break;
    case 'dance': { const q = Math.sin(t * 7 + seed); A.L = [-2.2 * (q > 0 ? 1 : .3), -.4]; A.R = [2.2 * (q < 0 ? 1 : .3), .4]; A.LL = [.25 * q, -.3 - .3 * Math.max(0, q)]; A.RL = [-.25 * q, -.3 - .3 * Math.max(0, -q)]; A.bob = -Math.abs(q) * 14; A.tilt = q * .12; break; }
    case 'remote': A.R = [1.45, -.6]; A.L = [-.2, .2]; A.tilt = .04; break;
    case 'sit': A.sit = 1; A.LL = [1.5, -1.5]; A.RL = [1.42, -1.45]; A.L = [.45, -.9]; A.R = [.5, -.95]; break;
    case 'sitphone': A.sit = 1; A.LL = [1.5, -1.5]; A.RL = [1.42, -1.45]; A.R = [.6, -1.8]; A.L = [.4, -1.6]; A.nod = .3; break;
    case 'sitsad': A.sit = 1; A.LL = [1.5, -1.5]; A.RL = [1.42, -1.45]; A.L = [.3, -.6]; A.R = [.35, -.6]; A.nod = .35; A.lean = .1; break;
    case 'bedsit': A.sit = 1; A.LL = [1.57, 0]; A.RL = [1.57, 0]; A.L = [-.2, .3]; A.R = [.25, -.2]; A.lean = -.05; break;
    case 'stretch': A.sit = 1; A.LL = [1.57, 0]; A.RL = [1.57, 0]; A.L = [-2.8, .1]; A.R = [2.8, -.1]; A.lean = -.08; break;
  }
  return A;
}
function blendPose(a, b, k) { const o = {}; for (const key in a) o[key] = Array.isArray(a[key]) ? a[key].map((v, i) => lerp(v, b[key][i], k)) : lerp(a[key], b[key], k); return o; }
function curPose(p, t, tb) {   // tb — время от начала фразы; переход между действиями 0,3 с
  const acts = p.acts || [[0, p.act || 'idle']]; let i = 0; while (i < acts.length - 1 && tb >= acts[i + 1][0]) i++;
  const cur = pose(acts[i][1], t, p); if (i === 0) return { A: cur, act: acts[i][1] };
  const k = sm((tb - acts[i][0]) / .3); return { A: k >= 1 ? cur : blendPose(pose(acts[i - 1][1], t, p), cur, k), act: acts[i][1] };
}
function bone(x0, y0, a1, l1, a2, l2) { const x1 = x0 + Math.sin(a1) * l1, y1 = y0 + Math.cos(a1) * l1, x2 = x1 + Math.sin(a1 + a2) * l2, y2 = y1 + Math.cos(a1 + a2) * l2; return [x1, y1, x2, y2]; }
function line(pts, w, col) { X.strokeStyle = col; X.lineWidth = w; X.beginPath(); X.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) X.lineTo(pts[i], pts[i + 1]); X.stroke(); }
function guy(p, t, tb = 0) {
  const { A, act } = curPose(p, t, tb), s = p.s || 1, d = p.dir || 1, sit = A.sit, top = p.top || '#e0672e', pants = p.pants || '#2b2f3f';
  X.save(); X.translate(p.x + A.dx * d, p.y); X.scale(s * d, s);
  if (!p.noShadow && !sit) shadow(0, 0, 58);
  const legLen = THIGH + SHIN, hipY = -(sit ? SHIN + 10 : legLen) + A.bob * (sit ? .3 : 1), shY = hipY - (p.garment === 'dress' ? 112 : 118), neckY = shY - 6;
  X.save(); X.translate(0, hipY); X.rotate(A.lean); X.translate(0, -hipY);
  const headX = Math.sin(A.lean) * -40, headY = neckY - HEAD + 6;
  X.lineCap = 'round'; X.lineJoin = 'round';
  for (const pass of [0, 1]) {
    const ex = pass ? 0 : 7; if (!pass) { X.shadowColor = GLOW; X.shadowBlur = 16; } else X.shadowBlur = 0;
    const C = c => pass ? c : 'rgba(170,215,255,.95)';
    // дальние рука и нога
    const ll = bone(-12, hipY, A.LL[0], THIGH, A.LL[1], SHIN); line([-12, hipY, ...ll], 13 + ex, C(pants === 'ink' ? INK : pants)); ell(ll[2] + 9, ll[3] + 2, 15 + ex * .5, 8 + ex * .5, C(INK));
    const la = bone(-26, shY + 12, A.L[0], ARM, A.L[1], FORE);   // дальняя рука
    line([-26, shY + 12, la[0], la[1]], 12 + ex, C(p.sleeve ? shade(p.jacket || top, -.12) : INK)); line([la[0], la[1], la[2], la[3]], 10 + ex, C(p.sleeve ? shade(p.jacket || top, -.12) : INK)); circ(la[2], la[3], 9 + ex * .5, C(INK));
    if (p.hair === 'long') { ell(headX, headY + 34, HEAD + 16 + ex * .4, HEAD + 46 + ex * .4, C(p.hairCol || '#4a2c1e')); }
    if (p.hair === 'tail') { ell(headX - 40, headY + 14, 16 + ex * .4, 34 + ex * .4, C(p.hairCol || '#4a2c1e'), .5); }
    // ближняя нога
    const rl = bone(12, hipY, A.RL[0], THIGH, A.RL[1], SHIN); line([12, hipY, ...rl], 13 + ex, C(pants === 'ink' ? INK : pants)); ell(rl[2] + 9, rl[3] + 2, 15 + ex * .5, 8 + ex * .5, C(INK));
    // туловище
    const tw = 66, bw = p.garment === 'dress' ? 112 : p.garment === 'coat' ? 92 : 82, bot = p.garment === 'coat' ? hipY + 44 : p.garment === 'dress' ? hipY + 58 : hipY + 8;
    X.beginPath(); X.moveTo(-tw / 2 - ex, shY - ex); X.lineTo(tw / 2 + ex, shY - ex); X.lineTo(bw / 2 + ex, bot + ex); X.lineTo(-bw / 2 - ex, bot + ex); X.closePath(); X.fillStyle = C(top); X.fill();
    if (pass) { X.fillStyle = 'rgba(0,0,0,.12)'; X.beginPath(); X.moveTo(-tw / 2, shY); X.lineTo(-tw / 2 + 14, shY); X.lineTo(-bw / 2 + 16, bot); X.lineTo(-bw / 2, bot); X.fill();
      if (p.garment === 'hoodie') { rr(-24, hipY - 46, 48, 26, 8, shade(top, -.15)); line([-8, shY + 2, -10, shY + 40], 3, '#f2f2f2'); line([8, shY + 2, 10, shY + 40], 3, '#f2f2f2'); ell(-4, shY + 2, 38, 12, shade(top, -.2)); }
      if (p.garment === 'coat') { line([0, shY + 6, 0, bot], 3, shade(top, -.25)); for (const by of [shY + 30, shY + 60, shY + 90]) circ(6, by, 4, shade(top, -.35)); }
      if (p.jacket) { X.fillStyle = p.jacket; X.beginPath(); X.moveTo(-tw / 2, shY); X.lineTo(-10, shY); X.lineTo(-14, bot); X.lineTo(-bw / 2, bot); X.fill(); X.beginPath(); X.moveTo(tw / 2, shY); X.lineTo(10, shY); X.lineTo(14, bot); X.lineTo(bw / 2, bot); X.fill();
        line([-10, shY + 2, -14, bot], 3, shade(p.jacket, -.3)); line([10, shY + 2, 14, bot], 3, shade(p.jacket, -.3)); }
      if (p.apron) { rr(-30, shY + 40, 60, bot - shY - 40, 8, '#f6f1e7'); }
      if (p.scarf) { rr(-30, shY - 8, 60, 16, 6, p.scarf); rr(10, shY + 2, 14, 60, 5, p.scarf); } }
    // шея и голова
    line([0, shY, headX * .6, neckY + 2], 9 + ex, C(INK));
    X.save(); X.translate(headX, headY); X.rotate(A.tilt * d + A.nod * .4); X.translate(0, A.nod * 16);
    circ(0, 0, HEAD + ex * .6, C(INK));
    if (pass && p.gloss) { X.fillStyle = rg(-18, -24, 46, [[0, 'rgba(255,255,255,.42)'], [.5, 'rgba(255,255,255,.08)'], [1, 'rgba(255,255,255,0)']]); X.beginPath(); X.arc(0, 0, HEAD, 0, Math.PI * 2); X.fill();
      X.strokeStyle = p.rim || 'rgba(255,190,90,.9)'; X.lineWidth = 3; X.beginPath(); X.arc(0, 0, HEAD - 2, -.3, 1.3); X.stroke(); }
    if (pass) faceDraw(p, act, t, A);
    if (p.hat === 'cap') { if (pass) { X.beginPath(); X.arc(0, -26, HEAD - 4, Math.PI * 1.02, -0.02); X.fillStyle = p.hatCol || '#2f5fb8'; X.fill(); rr(10, -36, 56, 11, 6, shade(p.hatCol || '#2f5fb8', -.15)); } else { X.beginPath(); X.arc(0, -26, HEAD + 3, Math.PI, 0); X.fillStyle = C(); X.fill(); } }
    if (p.hat === 'helmet') { if (pass) { X.beginPath(); X.arc(0, -30, HEAD - 2, Math.PI, 0); X.fillStyle = '#ffc21a'; X.fill(); rr(-HEAD - 10, -36, HEAD * 2 + 20, 11, 6, '#f0a800'); rr(-5, -HEAD - 26, 10, 36, 4, '#ffe27a'); } else { X.beginPath(); X.arc(0, -30, HEAD + 5, Math.PI, 0); X.fillStyle = C(); X.fill(); } }
    if (p.hat === 'beanie' && pass) { X.beginPath(); X.arc(0, -26, HEAD - 2, Math.PI, 0); X.fillStyle = p.hatCol || '#ffc21a'; X.fill(); rr(-HEAD, -36, HEAD * 2, 13, 6, shade(p.hatCol || '#ffc21a', -.12)); circ(0, -HEAD - 26, 10, p.hatCol || '#ffc21a'); }
    if (p.hair === 'bun' && pass) { circ(0, -HEAD - 6, 18, p.hairCol || '#c9cdd6'); X.beginPath(); X.arc(0, -16, HEAD + 1, Math.PI * 1.1, -0.1); X.fillStyle = p.hairCol || '#c9cdd6'; X.fill(); }   // чёлка выше глаз — лицо открыто
    if (p.hair === 'long' && pass) { X.beginPath(); X.arc(0, -18, HEAD + 2, Math.PI * 1.08, -0.08); X.fillStyle = p.hairCol || '#4a2c1e'; X.fill(); if (p.bow) { ell(-30, -52, 14, 9, p.bow, -.5); ell(-12, -60, 14, 9, p.bow, .5); circ(-21, -56, 6, shade(p.bow, -.2)); } }
    if (p.hair === 'spiky' && pass) { X.fillStyle = INK; for (let k = 0; k < 7; k++) { const a = -2.6 + k * .35; X.beginPath(); X.moveTo(Math.cos(a) * (HEAD - 6), Math.sin(a) * (HEAD - 6)); X.lineTo(Math.cos(a + .1) * (HEAD + 22), Math.sin(a + .1) * (HEAD + 22)); X.lineTo(Math.cos(a + .25) * (HEAD - 6), Math.sin(a + .25) * (HEAD - 6)); X.fill(); } }
    X.restore();
    // ближняя рука
    const ra = bone(26, shY + 12, A.R[0], ARM, A.R[1], FORE);
    line([26, shY + 12, ra[0], ra[1]], 12 + ex, C(p.sleeve ? p.jacket || top : INK)); line([ra[0], ra[1], ra[2], ra[3]], 10 + ex, C(p.sleeve ? p.jacket || top : INK)); circ(ra[2], ra[3], 9 + ex * .5, C(INK));
    if (pass) prop(p, ra, act, t, headY + A.nod * 16);
  }
  X.restore(); X.restore();
}
function shade(hex, k) { const n = parseInt(hex.slice(1), 16), f = c => clamp(Math.round(c + (k > 0 ? (255 - c) * k : c * k)), 0, 255); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function faceDraw(p, act, t, A) {
  const f = p.face || {}, emo = { shock: ['wide', 'o'], fear: ['wide', 'frown'], joy: ['happy', 'grin'], laugh: ['happy', 'grin'], sad: ['meh', 'frown'], sitsad: ['meh', 'frown'], think: ['meh', 'line'], talk: ['open', 'talk'], phone: ['meh', 'line'], sitphone: ['meh', 'line'], sneezeIn: ['closed', 'o'], sneezeOut: ['closed', 'grin'], float: ['wide', 'o'], dance: ['happy', 'grin'] }[act] || [];
  const eyes = f.eyes || emo[0] || 'open', mouth = f.mouth || emo[1] || 'smile', lx = 6 + (p.look || 0) * 4, ly = (act === 'phone' || act === 'sitphone' || act === 'watch') ? 4 : 0;
  const blink = (t + (p.seed || 0) * .7) % 3.6 < .11 && eyes !== 'wide' && eyes !== 'closed';
  for (const ex of [-17, 17]) {
    const cx = ex + 6, cy = -8;
    if (eyes === 'closed' || blink) { X.strokeStyle = '#fff'; X.lineWidth = 4; X.beginPath(); X.arc(cx, cy - 2, 9, .2, Math.PI - .2); X.stroke(); continue; }
    if (eyes === 'heart') { const pu = 1 + Math.sin(t * 8) * .12; X.save(); X.translate(cx, cy); X.scale(pu, pu); X.fillStyle = '#ff2d6a'; X.beginPath(); X.moveTo(0, 9); X.bezierCurveTo(-16, -2, -9, -16, 0, -7); X.bezierCurveTo(9, -16, 16, -2, 0, 9); X.fill(); X.restore(); continue; }
    if (eyes === 'happy') { X.strokeStyle = '#fff'; X.lineWidth = 5; X.beginPath(); X.arc(cx, cy + 4, 10, Math.PI + .3, -.3); X.stroke(); continue; }
    const r = eyes === 'wide' ? 15 : 12; circ(cx, cy, r, '#fff'); circ(cx + lx * .5, cy + ly, eyes === 'wide' ? 5 : 6, INK);
    if (eyes === 'meh') { X.fillStyle = INK; X.fillRect(cx - r - 1, cy - r - 1, r * 2 + 2, r + 1); }   // полуприкрытые — верхнее веко
    if (p.gloss) { circ(cx + lx * .5 - 2.5, cy + ly - 3, eyes === 'wide' ? 2.6 : 2.2, '#fff'); circ(cx + lx * .5 + 2, cy + ly + 2, 1.2, 'rgba(255,255,255,.8)'); }
  }
  X.strokeStyle = '#fff'; X.lineWidth = 4.5; X.lineCap = 'round'; X.beginPath();
  const mx = 6, my = 22;
  if (mouth === 'line') { X.moveTo(mx - 10, my); X.lineTo(mx + 10, my); X.stroke(); }
  else if (mouth === 'smile') { X.arc(mx, my - 8, 13, .45, Math.PI - .45); X.stroke(); }
  else if (mouth === 'frown') { X.arc(mx, my + 10, 12, Math.PI + .5, -.5); X.stroke(); }
  else if (mouth === 'o') { X.ellipse(mx, my + 2, 8, 11, 0, 0, Math.PI * 2); X.fillStyle = '#fff'; X.fill(); }
  else if (mouth === 'grin') { X.moveTo(mx - 16, my - 4); X.quadraticCurveTo(mx, my + 22, mx + 16, my - 4); X.closePath(); X.fillStyle = '#fff'; X.fill(); }
  else if (mouth === 'talk') { const o = Math.abs(Math.sin(t * 11 + (p.seed || 0))); X.ellipse(mx, my, 9, 2 + o * 8, 0, 0, Math.PI * 2); X.fillStyle = '#fff'; X.fill(); }
  if (p.gloss) { ell(-18, 12, 9, 5, 'rgba(255,90,130,.6)'); ell(30, 12, 9, 5, 'rgba(255,90,130,.6)');
    if (act === 'fear' || act === 'shock' || p.sweat) { X.fillStyle = '#7fd6ff'; X.strokeStyle = '#fff'; X.lineWidth = 1.5; for (const [dx, dy, k] of [[-44, -30, 1], [-52, -6, .7]]) { X.beginPath(); X.moveTo(dx, dy - 10 * k); X.quadraticCurveTo(dx + 7 * k, dy + 2 * k, dx, dy + 6 * k); X.quadraticCurveTo(dx - 7 * k, dy + 2 * k, dx, dy - 10 * k); X.fill(); X.stroke(); } } }
  if (act === 'fear' || act === 'shock') { X.strokeStyle = '#fff'; X.lineWidth = 4; X.beginPath(); X.moveTo(-14, -30); X.lineTo(-4, -26); X.moveTo(26, -26); X.lineTo(16, -30); X.stroke(); }
  if (p.glasses) { X.strokeStyle = '#d9dee6'; X.lineWidth = 3; X.beginPath(); X.arc(-11, -8, 15, 0, Math.PI * 2); X.moveTo(38, -8); X.arc(23, -8, 15, 0, Math.PI * 2); X.moveTo(4, -8); X.lineTo(8, -8); X.stroke(); }
}
function prop(p, ra, act, t, hy0 = -400) {   // hy0 — центр головы: зонт и всё, что над головой, держим выше лица
  const [, , hx, hy] = ra;
  if (p.hold === 'phone') { X.save(); X.translate(hx, hy - 6); X.rotate(-.2); rr(-12, -34, 26, 44, 5, '#1d2230'); rr(-9, -30, 20, 34, 3, '#8fd3ff'); glow(1, -14, 40, 'rgba(120,200,255,.25)'); X.restore(); }
  if (p.hold === 'cup') { rr(hx - 12, hy - 34, 24, 30, 4, '#f4ede2'); rr(hx - 13, hy - 38, 26, 7, 3, '#7a4a32'); }
  if (p.hold === 'umbrella') { const cy = Math.min(hy - 150, hy0 - HEAD - 34), cx = hx - 20;   // купол всегда над головой, лицо открыто
    X.strokeStyle = '#2a2a2a'; X.lineWidth = 4; X.beginPath(); X.moveTo(hx, hy); X.lineTo(cx, cy); X.lineTo(cx, cy - 92); X.stroke();
    X.beginPath(); X.arc(cx, cy, 104, Math.PI, 0); X.fillStyle = p.umbCol || '#c0392b'; X.fill(); X.fillStyle = 'rgba(0,0,0,.18)';
    for (let k = 0; k < 4; k++) { X.beginPath(); X.moveTo(cx, cy - 104); X.lineTo(cx - 104 + k * 52, cy); X.lineTo(cx - 78 + k * 52, cy); X.fill(); }
    X.strokeStyle = shade(p.umbCol || '#c0392b', -.3); X.lineWidth = 3; X.beginPath(); for (let k = 0; k <= 4; k++) { const a = Math.PI + k * Math.PI / 4; X.moveTo(cx + Math.cos(a) * 104, cy); } X.stroke(); }
  if (p.hold === 'remote') { X.save(); X.translate(hx, hy); X.rotate(-.5); rr(-10, -46, 22, 56, 6, '#1d2230'); circ(1, -32, 5, '#ff3b4a'); rr(-5, -20, 12, 6, 2, '#8fd3ff'); rr(-5, -10, 12, 6, 2, '#8fd3ff'); X.restore(); }
  if (p.hold === 'pin') { rr(hx - 40, hy - 10, 80, 18, 9, '#d9b48a'); }
}

/* ================= НЕОНОВАЯ ПЛАШКА над головой ================= */
function tag(x, y, txt, col, k = 1, size = 44) {
  if (k <= 0) return; X.save(); X.translate(x, y); const sc = .6 + .4 * eo(k) + Math.sin(clamp(k, 0, 1) * Math.PI) * .08; X.scale(sc, sc); X.globalAlpha = clamp(k * 3, 0, 1);
  X.font = `900 ${size}px Montserrat`; const w = X.measureText(txt).width + 44, h = size + 30;
  X.shadowColor = col; X.shadowBlur = 26; rr(-w / 2, -h, w, h, 14, 'rgba(14,16,24,.94)'); X.shadowBlur = 0;
  X.strokeStyle = col; X.lineWidth = 4; X.beginPath(); X.roundRect(-w / 2, -h, w, h, 14); X.stroke();
  X.fillStyle = 'rgba(14,16,24,.94)'; X.beginPath(); X.moveTo(-12, -2); X.lineTo(12, -2); X.lineTo(0, 14); X.fill(); X.strokeStyle = col; X.beginPath(); X.moveTo(-12, 0); X.lineTo(0, 14); X.lineTo(12, 0); X.stroke();
  X.shadowColor = col; X.shadowBlur = 14; X.fillStyle = col; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(txt, 0, -h / 2 + 2); X.restore();
}
const yrs = n => { const a = Math.abs(Math.floor(n)) % 100, b = a % 10; return a > 10 && a < 20 ? 'ЛЕТ' : b === 1 ? 'ГОД' : b > 1 && b < 5 ? 'ГОДА' : 'ЛЕТ'; };
const hms = s => { s = Math.max(0, s); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, c = Math.floor(s % 60), f = Math.floor((s % 1) * 100); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(c).padStart(2, '0')}:${String(f).padStart(2, '0')}`; };
const headTop = (p) => p.y - (THIGH + SHIN + 118 + HEAD * 2 + 62) * (p.s || 1);   // с запасом на головной убор: плашка не закрывает лицо

/* ================= ЛОКАЦИИ ================= */
function rain(t, n = 260, a = .35) { X.strokeStyle = `rgba(210,225,240,${a})`; X.lineWidth = 2; X.beginPath();
  for (let i = 0; i < n; i++) { const x = (hr(i) * 2600 - 300 + t * 260) % 2600 - 300, y = (hr(i + 9) * 1400 + t * 1300 * (0.8 + hr(i + 3) * .4)) % 1400 - 200; X.moveTo(x, y); X.lineTo(x - 14, y + 46); } X.stroke(); }
function fogBand(y0, y1, col) { X.fillStyle = lg(0, y0, 0, y1, [[0, 'rgba(0,0,0,0)'], [.5, col], [1, 'rgba(0,0,0,0)']]); X.fillRect(-1500, y0, 5000, y1 - y0); }
function windows(x, y, w, h, cols, rows, lit, seed) { const cw = w / cols, ch = h / rows; for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) { const on = hr(seed + a * 13 + b * 7) < lit;
  rr(x + b * cw + cw * .22, y + a * ch + ch * .2, cw * .56, ch * .6, 3, on ? 'rgba(255,214,140,.92)' : 'rgba(40,52,70,.55)'); } }
function tree(x, y, s, col) { X.strokeStyle = col; X.lineCap = 'round'; const br = (x0, y0, a, l, w, dpt) => { if (dpt > 5) return; const x1 = x0 + Math.sin(a) * l, y1 = y0 - Math.cos(a) * l; X.lineWidth = w; X.beginPath(); X.moveTo(x0, y0); X.lineTo(x1, y1); X.stroke();
  br(x1, y1, a - .45 + hr(dpt * 7 + x) * .2, l * .72, w * .66, dpt + 1); br(x1, y1, a + .4 - hr(dpt * 5 + y) * .2, l * .7, w * .66, dpt + 1); }; br(x, y, 0, 110 * s, 12 * s, 0); }
function street(t, o = {}) {
  X.fillStyle = lg(0, -300, 0, 900, [[0, '#7d8ea3'], [.6, '#a9b6c4'], [1, '#c3ccd5']]); X.fillRect(-1500, -800, 5000, 2200);
  for (let i = 0; i < 14; i++) { const w = 140 + hr(i) * 140, h = 380 + hr(i + 4) * 420, x = -700 + i * 230; rr(x, 640 - h, w, h + 300, 0, 'rgba(120,138,160,.75)'); windows(x + 10, 660 - h, w - 20, h - 80, 4, 9, .12, i * 3); }
  fogBand(300, 760, 'rgba(200,210,222,.55)');
  const mids = [['#8a7466', 0], ['#6f7d8e', 1], ['#9a8576', 2], ['#7a6a62', 3], ['#68778a', 4], ['#8c7a6c', 5]];
  mids.forEach(([c, i]) => { const x = -500 + i * 470, w = 380, h = 470 + hr(i + 20) * 160; rr(x, 690 - h, w, h, 4, c); windows(x + 18, 710 - h, w - 36, h - 140, 5, 7, .3, i * 11); rr(x - 8, 690 - h, w + 16, 22, 2, shade(c, -.25)); });
  for (const tx of [300, 1380, 2100]) tree(tx, 700, 1.25, 'rgba(70,74,84,.85)');
  rr(1240, 520, 260, 160, 6, '#3d4250'); rr(1258, 540, 224, 100, 4, '#f3c26a'); X.fillStyle = '#2b2f3a'; X.font = '900 40px Montserrat'; X.textAlign = 'center'; X.fillText('КАФЕ', 1370, 607); glow(1370, 590, 220, 'rgba(255,200,110,.25)');
  X.fillStyle = '#8e97a3'; X.fillRect(-1500, 690, 5000, 260); X.strokeStyle = 'rgba(255,255,255,.12)'; X.lineWidth = 2; for (let k = 0; k < 40; k++) { X.beginPath(); X.moveTo(-900 + k * 120, 690); X.lineTo(-1100 + k * 140, 950); X.stroke(); }
  X.fillStyle = '#5d6672'; X.fillRect(-1500, 940, 5000, 18); X.fillStyle = '#3f4651'; X.fillRect(-1500, 958, 5000, 600);
  X.fillStyle = 'rgba(235,240,245,.75)'; for (let k = 0; k < 7; k++) { X.beginPath(); X.moveTo(1500 + k * 70, 965); X.lineTo(1556 + k * 70, 965); X.lineTo(1610 + k * 110, 1150); X.lineTo(1530 + k * 110, 1150); X.fill(); }
  // лужи с отражениями
  for (const [px, py, w] of [[520, 1020, 260], [1180, 1060, 180], [-200, 1080, 220]]) { ell(px, py, w, w * .14, 'rgba(160,180,200,.35)'); for (let k = 0; k < 3; k++) { const f = ((t * .8 + k / 3 + px * .001) % 1 + 1) % 1; X.strokeStyle = `rgba(230,240,250,${.5 * (1 - f)})`; X.lineWidth = 2; X.beginPath(); X.ellipse(px + (k - 1) * 60, py, 10 + f * 40, (10 + f * 40) * .25, 0, 0, Math.PI * 2); X.stroke(); } }
  // остановка
  X.fillStyle = '#4b5361'; X.fillRect(-40, 360, 26, 500); X.fillRect(560, 360, 26, 500); rr(-80, 330, 700, 40, 6, '#5a6372');
  X.fillStyle = 'rgba(200,225,240,.22)'; X.fillRect(-14, 370, 574, 400); X.strokeStyle = 'rgba(230,240,250,.4)'; X.lineWidth = 3; X.strokeRect(-14, 370, 574, 400);
  rr(20, 690, 380, 24, 6, '#8a6a4f'); X.fillStyle = '#4b5361'; X.fillRect(40, 714, 14, 120); X.fillRect(366, 714, 14, 120);
  rr(700, 640, 90, 220, 12, '#5b6572'); X.fillStyle = 'rgba(0,0,0,.18)'; for (let k = 0; k < 6; k++) X.fillRect(708 + k * 14, 650, 5, 200);
  // светофор
  X.fillStyle = '#3a404b'; X.fillRect(1700, 330, 22, 560); rr(1652, 230, 118, 260, 20, '#2b3039'); const red = o.green ? 0 : 1;
  circ(1711, 290, 34, red ? '#ff3b3b' : '#4a1f22'); circ(1711, 360, 34, '#4a4222'); circ(1711, 430, 34, red ? '#1f3a26' : '#3bff7a'); glow(1711, red ? 290 : 430, 230, red ? 'rgba(255,60,60,.45)' : 'rgba(60,255,120,.4)');
  X.fillStyle = red ? 'rgba(255,70,70,.25)' : 'rgba(60,255,120,.2)'; ell(1711, 990, 120, 20, X.fillStyle);
  if (o.truck != null) { const tx = o.truck; X.save(); X.translate(tx, 1010); rr(0, -280, 560, 230, 14, '#e8edf2'); rr(0, -90, 560, 30, 4, '#c0392b'); rr(560, -230, 200, 180, 22, '#c0392b'); rr(620, -210, 110, 70, 10, '#bfe6ff'); for (const wx of [90, 420, 640]) { circ(wx, -40, 48, '#14161c'); circ(wx, -40, 20, '#8a939f'); }
    X.restore(); X.fillStyle = 'rgba(255,255,255,.25)'; for (let k = 0; k < 8; k++) X.fillRect(tx - 260 - k * 40, 820 + k * 22, 220, 4); }
}
function bedroom(t, o = {}) {
  const night = o.night;
  X.fillStyle = lg(0, 0, 0, 900, night ? [[0, '#2a2f4a'], [1, '#1f2338']] : [[0, '#f1dcc6'], [1, '#e2c4a8']]); X.fillRect(-1500, -800, 5000, 2000);
  X.fillStyle = night ? '#1a1d2e' : '#c99b72'; X.fillRect(-1500, 880, 5000, 600); X.strokeStyle = 'rgba(0,0,0,.12)'; X.lineWidth = 3; for (let k = 0; k < 30; k++) { X.beginPath(); X.moveTo(-1000 + k * 140, 880); X.lineTo(-1300 + k * 180, 1300); X.stroke(); }
  rr(-1500, 860, 5000, 24, 0, night ? '#151826' : '#b78560');
  // окно со шторами
  rr(1020, 120, 420, 380, 8, night ? '#141a36' : '#fbe7c6'); X.fillStyle = night ? lg(0, 130, 0, 500, [[0, '#0b1230'], [1, '#2c3270']]) : lg(0, 130, 0, 500, [[0, '#ffd59a'], [1, '#ffb27a']]); X.fillRect(1036, 136, 388, 348);
  if (night) { circ(1330, 210, 30, '#f3f0dc'); } else { circ(1230, 400, 60, '#fff3c4'); glow(1230, 400, 260, 'rgba(255,220,150,.5)'); }
  X.fillStyle = night ? '#141a36' : '#fbe7c6'; X.fillRect(1224, 136, 12, 348); X.fillRect(1036, 300, 388, 10);
  X.fillStyle = night ? '#3a3355' : '#d8644f'; X.beginPath(); X.moveTo(980, 100); X.lineTo(1080, 100); X.quadraticCurveTo(1040, 340, 1060, 560); X.lineTo(980, 560); X.fill(); X.beginPath(); X.moveTo(1480, 100); X.lineTo(1380, 100); X.quadraticCurveTo(1420, 340, 1400, 560); X.lineTo(1480, 560); X.fill(); rr(960, 92, 540, 12, 6, '#6b4a36');
  if (!night) { X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = 'rgba(255,220,160,.12)'; X.beginPath(); X.moveTo(1040, 140); X.lineTo(1420, 140); X.lineTo(900, 1000); X.lineTo(300, 1000); X.fill(); X.restore(); }
  // картины
  rr(160, 180, 210, 150, 6, '#6b4a36'); rr(172, 192, 186, 126, 3, night ? '#3a4a6a' : '#8fb3c9'); X.fillStyle = night ? '#2a3a2e' : '#6a9a5e'; X.beginPath(); X.moveTo(172, 318); X.lineTo(240, 250); X.lineTo(300, 300); X.lineTo(358, 240); X.lineTo(358, 318); X.fill();
  // кровать
  rr(80, 520, 40, 380, 8, '#7a5238'); rr(80, 500, 640, 60, 18, '#8a5d40'); rr(110, 690, 760, 120, 18, '#f3ece2'); rr(110, 650, 760, 90, 30, night ? '#3d4f8a' : '#4f7ad1');
  rr(130, 610, 200, 80, 40, '#ffffff'); rr(330, 620, 180, 70, 35, '#f1ece6'); X.fillStyle = '#6b4a36'; X.fillRect(110, 800, 18, 100); X.fillRect(852, 800, 18, 100);
  // тумба, будильник, лампа
  rr(890, 690, 150, 200, 8, '#8a5d40'); rr(900, 760, 130, 6, 2, '#6b4a36'); circ(965, 828, 7, '#d9b48a');
  const ring = o.ring ? Math.sin(t * 40) * 5 : 0; X.save(); X.translate(940 + ring, 650); circ(0, 0, 34, '#e3263b'); circ(0, 0, 26, '#fff'); X.strokeStyle = INK; X.lineWidth = 4; X.beginPath(); X.moveTo(0, 0); X.lineTo(0, -16); X.moveTo(0, 0); X.lineTo(12, 4); X.stroke(); circ(-22, -30, 10, '#e3263b'); circ(22, -30, 10, '#e3263b'); X.restore();
  rr(1000, 560, 18, 130, 4, '#c9b49a'); X.beginPath(); X.moveTo(970, 560); X.lineTo(1050, 560); X.lineTo(1035, 500); X.lineTo(985, 500); X.fillStyle = '#f2d398'; X.fill(); if (night) glow(1010, 540, 200, 'rgba(255,210,140,.35)');
  // зеркало
  if (o.mirror !== false) { rr(1580, 260, 230, 620, 110, '#6b4a36'); rr(1596, 276, 198, 588, 98, night ? '#4a5878' : '#bcd6e4'); X.fillStyle = 'rgba(255,255,255,.35)'; X.beginPath(); X.moveTo(1620, 360); X.lineTo(1660, 320); X.lineTo(1640, 600); X.lineTo(1610, 640); X.fill(); }
  rr(400, 900, 600, 60, 30, night ? '#2b2f4a' : '#c45d4c');
}
function office(t) {
  X.fillStyle = lg(0, 0, 0, 900, [[0, '#cfd8e2'], [1, '#b9c6d3']]); X.fillRect(-1500, -800, 5000, 2000); X.fillStyle = '#8b97a5'; X.fillRect(-1500, 880, 5000, 600);
  rr(-200, 100, 1000, 520, 6, '#6d7a8a'); X.fillStyle = lg(0, 110, 0, 610, [[0, '#9fc1e0'], [1, '#e8eef5']]); X.fillRect(-186, 114, 972, 492); for (let i = 0; i < 9; i++) { const w = 90 + hr(i) * 60, h = 160 + hr(i + 3) * 260; rr(-180 + i * 110, 606 - h, w, h, 0, 'rgba(110,130,160,.7)'); windows(-176 + i * 110, 616 - h, w - 8, h - 30, 3, 6, .2, i); }
  X.fillStyle = '#6d7a8a'; for (const x of [140, 470]) X.fillRect(x, 114, 12, 492);
  // часы — время летит
  const a = t * 8; circ(1300, 230, 92, '#fff'); X.strokeStyle = INK; X.lineWidth = 8; X.beginPath(); X.arc(1300, 230, 92, 0, Math.PI * 2); X.stroke();
  X.lineWidth = 7; X.beginPath(); X.moveTo(1300, 230); X.lineTo(1300 + Math.sin(a / 12) * 50, 230 - Math.cos(a / 12) * 50); X.moveTo(1300, 230); X.lineTo(1300 + Math.sin(a) * 76, 230 - Math.cos(a) * 76); X.stroke();
  // столы и мониторы
  for (const [dx, sc] of [[880, 1], [1460, .8]]) { X.save(); X.translate(dx, 700); X.scale(sc, sc); rr(-260, 0, 520, 30, 6, '#d9cbb8'); X.fillStyle = '#6b6f7a'; X.fillRect(-240, 30, 16, 190); X.fillRect(224, 30, 16, 190);
    rr(-110, -180, 220, 150, 10, '#23272f'); rr(-100, -170, 200, 128, 6, '#4f8fd6'); X.fillStyle = 'rgba(255,255,255,.55)'; for (let k = 0; k < 5; k++) X.fillRect(-84, -156 + k * 22, 80 + hr(k + dx) * 80, 8); rr(-12, -30, 24, 30, 2, '#23272f');
    rr(150, -46, 34, 46, 5, '#f4ede2'); X.restore(); }
  rr(1700, 560, 90, 120, 10, '#c45d4c'); X.fillStyle = '#4f7d4c'; for (let k = 0; k < 7; k++) ell(1745 + (k - 3) * 14, 520 - Math.abs(k - 3) * 10, 18, 50, '#4f9a5c', (k - 3) * .3);
}
function kitchen(t) {
  X.fillStyle = lg(0, 0, 0, 900, [[0, '#f6e7c9'], [1, '#efd8b0']]); X.fillRect(-1500, -800, 5000, 2000); X.fillStyle = '#b0794e'; X.fillRect(-1500, 880, 5000, 600);
  for (let i = 0; i < 4; i++) { rr(60 + i * 200, 120, 180, 220, 10, '#7fa9a6'); rr(75 + i * 200, 135, 150, 190, 8, '#8fbab6'); rr(140 + i * 200, 300, 30, 8, 4, '#5b6f6d'); }
  X.fillStyle = '#fbf6ee'; X.fillRect(40, 360, 820, 210); X.strokeStyle = 'rgba(150,140,120,.35)'; X.lineWidth = 2; for (let k = 0; k < 9; k++) { X.beginPath(); X.moveTo(40, 360 + k * 26); X.lineTo(860, 360 + k * 26); X.stroke(); } for (let k = 0; k < 21; k++) { X.beginPath(); X.moveTo(40 + k * 40, 360); X.lineTo(40 + k * 40, 570); X.stroke(); }
  rr(30, 560, 840, 36, 6, '#8a5d40'); for (let i = 0; i < 4; i++) { rr(50 + i * 205, 596, 190, 284, 10, '#7fa9a6'); rr(130 + i * 205, 640, 30, 8, 4, '#5b6f6d'); }
  rr(520, 470, 140, 90, 10, '#c9cfd8'); rr(540, 440, 100, 36, 8, '#e3263b');
  rr(1000, 140, 520, 380, 8, '#e8754f'); X.fillStyle = lg(0, 150, 0, 510, [[0, '#a7d8f5'], [1, '#e9f6fd']]); X.fillRect(1016, 156, 488, 348); circ(1400, 240, 44, '#fff7d0'); X.save(); X.beginPath(); X.rect(1016, 156, 488, 348); X.clip(); ell(1150, 520, 260, 90, '#6fa86a'); ell(1400, 530, 220, 70, '#5e9a5c'); X.restore(); X.fillStyle = '#e8754f'; X.fillRect(1254, 156, 12, 348); X.fillRect(1016, 330, 488, 10);
  circ(840, 210, 64, '#fff'); X.strokeStyle = INK; X.lineWidth = 6; X.beginPath(); X.arc(840, 210, 64, 0, Math.PI * 2); X.moveTo(840, 210); X.lineTo(840, 170); X.moveTo(840, 210); X.lineTo(872, 220); X.stroke();
  rr(1580, 300, 260, 580, 18, '#eef1f4'); rr(1600, 520, 14, 90, 6, '#b9c0ca'); rr(1600, 340, 14, 120, 6, '#b9c0ca'); rr(1660, 400, 26, 26, 4, '#e3a62b'); rr(1700, 430, 26, 26, 4, '#3b82f6');
  rr(980, 700, 520, 26, 6, '#8a5d40'); X.fillStyle = '#6b4a36'; X.fillRect(1000, 726, 18, 160); X.fillRect(1462, 726, 18, 160);
  ell(1120, 692, 70, 18, '#f0c27a'); ell(1120, 684, 62, 14, '#d99a4e'); for (let k = 0; k < 3; k++) { const f = (t * .5 + k / 3) % 1; X.strokeStyle = `rgba(255,255,255,${.5 * (1 - f)})`; X.lineWidth = 4; X.beginPath(); X.moveTo(1100 + k * 20, 670 - f * 80); X.quadraticCurveTo(1115 + k * 20, 640 - f * 80, 1100 + k * 20, 620 - f * 80); X.stroke(); }
  rr(1330, 610, 60, 90, 10, '#4f8fd6');
}
function rooftop(t) {
  X.fillStyle = lg(0, -200, 0, 800, [[0, '#2a2a5a'], [.45, '#c4577a'], [.75, '#f59a5b'], [1, '#ffd08a']]); X.fillRect(-1500, -800, 5000, 2000);
  circ(1180, 640, 120, '#ffe2a6'); glow(1180, 640, 600, 'rgba(255,190,120,.45)');
  for (let i = 0; i < 20; i++) { const w = 90 + hr(i) * 120, h = 160 + hr(i + 8) * 380, x = -600 + i * 170; rr(x, 760 - h, w, h + 100, 0, '#3b2a4a'); windows(x + 6, 776 - h, w - 12, h - 40, 3, 8, .25, i * 5); }
  X.fillStyle = '#2a2033'; X.fillRect(-1500, 820, 5000, 700); X.fillStyle = '#4a3a55'; X.fillRect(-1500, 820, 5000, 14);
  X.strokeStyle = '#1d1726'; X.lineWidth = 8; X.beginPath(); X.moveTo(-1500, 760); X.lineTo(3500, 760); X.stroke(); X.lineWidth = 6; for (let k = 0; k < 40; k++) { X.beginPath(); X.moveTo(-1500 + k * 130, 760); X.lineTo(-1500 + k * 130, 830); X.stroke(); }
  for (let i = 0; i < 40; i++) { const x = hr(i) * 2200 - 100, y = (hr(i + 3) * 700 - t * 10 * (1 + hr(i))) % 700; X.globalAlpha = .35 + .3 * Math.sin(t + i); circ(x, (y + 700) % 700, 2, '#fff2d6'); } X.globalAlpha = 1;
}
function infoBg(t, col = '#141a33') { X.fillStyle = lg(0, 0, 0, 1080, [[0, col], [1, '#0a0d1c']]); X.fillRect(-1500, -800, 5000, 2400);
  X.strokeStyle = 'rgba(120,150,255,.07)'; X.lineWidth = 2; for (let k = -10; k < 40; k++) { X.beginPath(); X.moveTo(k * 80, -800); X.lineTo(k * 80, 1600); X.stroke(); X.beginPath(); X.moveTo(-1500, k * 80); X.lineTo(3500, k * 80); X.stroke(); }
  for (let i = 0; i < 30; i++) { X.globalAlpha = .15 + .15 * Math.sin(t * .7 + i); circ(hr(i) * 1920, hr(i + 5) * 1080, 30 + hr(i + 2) * 80, ['#3b5bdb', '#9b59b6', '#1abc9c'][i % 3]); } X.globalAlpha = 1; }
const BIG = (txt, x, y, size, col, k = 1) => { if (k <= 0) return; X.save(); X.translate(x, y); const sc = .7 + .3 * eo(k); X.scale(sc, sc); X.globalAlpha = clamp(k * 3, 0, 1); X.font = `900 ${size}px Montserrat`; X.textAlign = 'center'; X.textBaseline = 'middle';
  X.lineWidth = size * .14; X.strokeStyle = 'rgba(8,10,20,.9)'; X.lineJoin = 'round'; X.strokeText(txt, 0, 0); X.shadowColor = col; X.shadowBlur = 30; X.fillStyle = col; X.fillText(txt, 0, 0); X.restore(); };
const SMALL = (txt, x, y, size, col = '#fff', k = 1) => { if (k <= 0) return; X.save(); X.globalAlpha = clamp(k * 3, 0, 1); X.font = `800 ${size}px Inter`; X.textAlign = 'center'; X.textBaseline = 'middle'; X.lineWidth = 8; X.strokeStyle = 'rgba(8,10,20,.85)'; X.strokeText(txt, x, y); X.fillStyle = col; X.fillText(txt, x, y); X.restore(); };
