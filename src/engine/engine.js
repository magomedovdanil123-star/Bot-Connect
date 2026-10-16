// ===== Motion engine: deterministic canvas renderer =====
const W = 1920, H = 1080, FPS = 30, CX = 960;
const VIO = '#8b5cff', VIO2 = '#b9a2ff', WHITE = '#f5f2ff', DIM = 'rgba(235,228,255,.5)', DIM2 = 'rgba(235,228,255,.28)';
const RED = '#ff4f6e', GOLD = '#f3c35a', SILVER = '#dfe5f2', BG = '#040208';
const SANS = '"Inter Display", "Inter", sans-serif', MONO = '"DejaVu Sans Mono", monospace';
const GL = 'ABCDEF0123456789#$%&*+=<>/\\|ЖЯЮФЩ';

const cvs = document.getElementById('c');
const X = cvs.getContext('2d');
const LAY = document.createElement('canvas'); LAY.width = W; LAY.height = H;
const LX = LAY.getContext('2d');
let g = LX;      // current drawing context for helpers
let FR = 0;      // current frame index (for flicker)

// ---------- math ----------
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a));
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const ex = t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
const eio = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const back = t => { t = clamp(t); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const pad = (n, k = 2) => String(n).padStart(k, '0');
const fmt = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// ---------- sprites ----------
function radialSprite(size, stops) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col)); x.fillStyle = gr; x.fillRect(0, 0, size, size); return c;
}
const BLOB = radialSprite(512, [[0, 'rgba(125,70,255,1)'], [.35, 'rgba(110,60,255,.45)'], [1, 'rgba(90,40,255,0)']]);
const BLOBR = radialSprite(512, [[0, 'rgba(255,60,100,1)'], [.35, 'rgba(255,60,100,.4)'], [1, 'rgba(255,60,100,0)']]);
const GRID = (() => {
  const c = document.createElement('canvas'); c.width = W + 240; c.height = H + 240; const x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,255,255,.13)'; x.lineWidth = 1.5;
  for (let i = 0; i <= c.width; i += 120) { x.beginPath(); x.moveTo(i + .5, 0); x.lineTo(i + .5, c.height); x.stroke(); }
  for (let j = 0; j <= c.height; j += 120) { x.beginPath(); x.moveTo(0, j + .5); x.lineTo(c.width, j + .5); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.22)';
  for (let i = 0; i <= c.width; i += 120) for (let j = 0; j <= c.height; j += 120) x.fillRect(i - 1.5, j - 1.5, 4, 4);
  return c;
})();
const VIGN = (() => {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const gr = x.createRadialGradient(CX, H / 2, H * .25, CX, H / 2, H * 1.05);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.85)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); return c;
})();
const GRAIN = [0, 1, 2, 3].map(k => {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270; const x = c.getContext('2d');
  const id = x.createImageData(480, 270);
  for (let i = 0; i < id.data.length; i += 4) { const v = rnd(i * .37 + k * 999) * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; }
  x.putImageData(id, 0, 0); return c;
});

// ---------- drawing primitives ----------
function txt(s, x, y, o = {}) {
  const { size = 40, w = 800, fam = SANS, color = WHITE, align = 'left', base = 'alphabetic', glow = 0, glowColor = VIO, alpha = 1, ls = 0 } = o;
  if (alpha <= 0) return;
  g.save(); g.globalAlpha *= alpha; g.font = `${w} ${size}px ${fam}`; g.textAlign = align; g.textBaseline = base;
  g.letterSpacing = ls + 'px'; g.fillStyle = color;
  if (glow) { g.shadowColor = glowColor; g.shadowBlur = glow; g.fillText(s, x, y); g.shadowBlur = glow * .35; g.fillText(s, x, y); g.shadowBlur = 0; }
  g.fillText(s, x, y); g.restore();
}
const mono = (s, x, y, size = 22, color = DIM, o = {}) => txt(s, x, y, { size, w: o.w || 400, fam: MONO, color, ...o });
function scr(s, p, seed = 0) { // decode/scramble reveal
  const n = Math.floor(p * s.length); let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i < n || s[i] === ' ') out += s[i];
    else if (i < n + 4 && p > 0) out += GL[Math.floor(rnd(i * 3.7 + FR * 1.3 + seed) * GL.length)];
  }
  return p >= 1 ? s : out;
}
function blob(x, y, r, a = .5, spr = BLOB) { if (a <= 0) return; g.save(); g.globalAlpha *= a; g.globalCompositeOperation = 'lighter'; g.drawImage(spr, x - r, y - r, r * 2, r * 2); g.restore(); }
function glowDot(x, y, r = 8, a = 1, c = '150,100,255') {
  if (a <= 0) return; const gr = g.createRadialGradient(x, y, 0, x, y, r * 5);
  gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(.18, `rgba(${c},${a * .95})`); gr.addColorStop(1, `rgba(${c},0)`);
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * 5, 0, 7); g.fill(); g.restore();
}
function rectPath(x, y, w, h, p) {
  let L = 2 * (w + h) * clamp(p); g.beginPath(); g.moveTo(x, y);
  let cx = x, cy = y;
  for (const [nx, ny] of [[x + w, y], [x + w, y + h], [x, y + h], [x, y]]) {
    const len = Math.hypot(nx - cx, ny - cy);
    if (L >= len) { g.lineTo(nx, ny); L -= len; cx = nx; cy = ny; } else { const r = L / len; g.lineTo(cx + (nx - cx) * r, cy + (ny - cy) * r); break; }
  }
  g.stroke();
}
function poly(pts, p, o = {}) {
  const { color = WHITE, lw = 3, glow = 0, dash = null, alpha = 1, head = false, headC } = o;
  if (p <= 0 || pts.length < 2) return pts[0];
  let total = 0; const ls = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); ls.push(l); total += l; }
  let rem = total * clamp(p); let hx = pts[0][0], hy = pts[0][1];
  g.save(); g.globalAlpha *= alpha; g.strokeStyle = color; g.lineWidth = lw; g.lineJoin = 'round'; g.lineCap = 'round';
  if (dash) g.setLineDash(dash); if (glow) { g.shadowColor = VIO; g.shadowBlur = glow; }
  g.beginPath(); g.moveTo(hx, hy);
  for (let i = 1; i < pts.length; i++) {
    if (rem >= ls[i - 1]) { hx = pts[i][0]; hy = pts[i][1]; g.lineTo(hx, hy); rem -= ls[i - 1]; }
    else { const r = rem / ls[i - 1]; hx = lerp(pts[i - 1][0], pts[i][0], r); hy = lerp(pts[i - 1][1], pts[i][1], r); g.lineTo(hx, hy); break; }
  }
  g.stroke(); g.restore();
  if (head && p < 1) glowDot(hx, hy, 7, alpha, headC);
  return [hx, hy];
}
const ln = (x1, y1, x2, y2, p, o) => poly([[x1, y1], [x2, y2]], p, o);
function arrow(x1, y1, x2, y2, p, o = {}) {
  const [hx, hy] = ln(x1, y1, x2, y2, p, o); if (p < .95) return;
  const a = Math.atan2(y2 - y1, x2 - x1), s = o.hs || 16;
  poly([[x2 - Math.cos(a - .5) * s, y2 - Math.sin(a - .5) * s], [x2, y2], [x2 - Math.cos(a + .5) * s, y2 - Math.sin(a + .5) * s]], 1, o);
}
function box(cx, cy, w, h, p, o = {}) {
  if (p <= 0) return;
  const { title = '', sub = '', color = WHITE, glow = 0, lw = 2.5, ts = 24, fill = 'rgba(6,4,12,.92)', dashed = false, tcolor = WHITE, alpha = 1, scol = DIM } = o;
  const x = cx - w / 2, y = cy - h / 2;
  g.save(); g.globalAlpha *= alpha;
  const fp = seg(p, .3, .8); if (fp > 0) { g.save(); g.globalAlpha *= fp; g.fillStyle = fill; g.fillRect(x, y, w, h); g.restore(); }
  g.strokeStyle = color; g.lineWidth = lw; if (dashed) g.setLineDash([10, 8]);
  if (glow) { g.shadowColor = VIO; g.shadowBlur = glow; }
  rectPath(x, y, w, h, eo(seg(p, 0, .55))); g.setLineDash([]); g.shadowBlur = 0;
  const cp = seg(p, .45, .7);
  if (cp > 0) { g.fillStyle = color; for (const [qx, qy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) g.fillRect(qx - 4 * cp, qy - 4 * cp, 8 * cp, 8 * cp); }
  const tp = seg(p, .45, 1);
  if (title && tp > 0) mono(scr(title, tp), cx, sub ? cy - 2 : cy + ts * .36, ts, tcolor, { w: 700, align: 'center' });
  if (sub && tp > 0) mono(scr(sub, tp, 5), cx, cy + ts * 1.15, Math.round(ts * .66), scol, { align: 'center' });
  g.restore();
}
function check(x, y, s, p, color = VIO2) { poly([[x - s * .45, y], [x - s * .12, y + s * .33], [x + s * .5, y - s * .38]], eo(p), { color, lw: Math.max(3, s * .13), glow: 16 }); }
function cross(x, y, s, p, color = RED) { ln(x - s / 2, y - s / 2, x + s / 2, y + s / 2, eo(seg(p, 0, .5)), { color, lw: s * .13 }); ln(x + s / 2, y - s / 2, x - s / 2, y + s / 2, eo(seg(p, .4, 1)), { color, lw: s * .13 }); }
function checkbox(x, y, s, p, state, t = 0) { // state: 0 empty, 1 check, 2 cross, 3 question
  if (p <= 0) return; g.save(); g.globalAlpha *= p; g.strokeStyle = WHITE; g.lineWidth = 2.5; g.strokeRect(x - s / 2, y - s / 2, s, s); g.restore();
  if (state === 1) check(x, y, s * .8, seg(p, .3, 1));
  if (state === 2) cross(x, y, s * .6, seg(p, .3, 1));
  if (state === 3) txt('?', x, y + s * .32, { size: s * .85, w: 900, color: VIO2, align: 'center', glow: 18, alpha: p * (.55 + .45 * Math.sin(t * 8)) });
}
function sparks(x, y, t, seed, o = {}) {
  const { n = 26, spd = 300, life = .8, color = '200,175,255' } = o;
  if (t < 0 || t > life) return;
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const a = rnd(seed + i) * 6.283, v = spd * (.25 + rnd(seed + i * 3.1) * .9), r = v * t * (1 - t / life * .5);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r + 80 * t * t, al = 1 - t / life;
    g.strokeStyle = `rgba(${color},${al})`; g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.cos(a) * 12, py - Math.sin(a) * 12); g.stroke();
  }
  g.restore();
}
function ring(x, y, r, a, lw = 2, color = '150,110,255') { if (a <= 0) return; g.save(); g.strokeStyle = `rgba(${color},${a})`; g.lineWidth = lw; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.stroke(); g.restore(); }
function coin(cx, cy, r, sym, p, o = {}) {
  if (p <= 0) return;
  const { color = VIO2, glow = 34, spin = 0, label } = o; const s = back(p);
  g.save(); g.translate(cx, cy); g.scale(s * Math.max(.08, Math.abs(Math.cos(spin))), s);
  g.fillStyle = 'rgba(10,6,20,.95)'; g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fill();
  g.strokeStyle = color; g.lineWidth = r * .05; g.shadowColor = color; g.shadowBlur = glow; g.stroke(); g.shadowBlur = 0;
  g.lineWidth = 2; g.setLineDash([6, 7]); g.beginPath(); g.arc(0, 0, r * .8, 0, 6.2832); g.stroke(); g.setLineDash([]);
  if (sym === 'BTC') {
    txt('B', 6, r * .36, { size: r * 1.02, w: 900, color, align: 'center', glow: 20, glowColor: color });
    g.fillStyle = color; for (const dx of [-r * .1, r * .14]) { g.fillRect(dx - r * .035, -r * .58, r * .07, r * .16); g.fillRect(dx - r * .035, r * .42, r * .07, r * .16); }
  } else txt(sym, 0, r * .36, { size: r * 1.02, w: 900, color, align: 'center', glow: 20, glowColor: color });
  g.restore();
  if (label) mono(label, cx, cy + r + 46, 24, WHITE, { align: 'center', w: 700, alpha: seg(p, .5, 1) });
}
function lockIcon(x, y, s, p, color = VIO2) {
  if (p <= 0) return; g.save(); g.globalAlpha *= p; g.strokeStyle = color; g.lineWidth = s * .09; g.shadowColor = VIO; g.shadowBlur = 20;
  g.strokeRect(x - s * .45, y - s * .05, s * .9, s * .7);
  g.beginPath(); g.arc(x, y - s * .05, s * .3, Math.PI, 0); g.stroke(); g.fillStyle = color; g.fillRect(x - s * .05, y + s * .15, s * .1, s * .25); g.restore();
}
function eyeIcon(x, y, s, p, look = 0) {
  if (p <= 0) return; g.save(); g.globalAlpha *= p; g.strokeStyle = WHITE; g.lineWidth = 3;
  g.beginPath(); g.moveTo(x - s, y); g.quadraticCurveTo(x, y - s * .9, x + s, y); g.quadraticCurveTo(x, y + s * .9, x - s, y); g.stroke(); g.restore();
  glowDot(x + look * s * .35, y, s * .16, p);
}
function cursorIcon(x, y, s = 1, a = 1) {
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.scale(s, s); g.fillStyle = WHITE; g.strokeStyle = '#000'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 46); g.lineTo(12, 35); g.lineTo(21, 54); g.lineTo(29, 50); g.lineTo(20, 32); g.lineTo(36, 32); g.closePath(); g.fill(); g.stroke(); g.restore();
}
function waveLine(x, y, w, amp, t, p, o = {}) {
  const pts = []; const n = 120;
  for (let i = 0; i <= n; i++) { const u = i / n; const a = (o.ampF ? o.ampF(u) : 1) * amp; pts.push([x + u * w, y + Math.sin(u * (o.freq || 18) + t * (o.spd || 4)) * a * Math.sin(u * 3.14)]); }
  return poly(pts, p, o);
}
function axes(x, y, w, h, p, o = {}) {
  const { yl = [], xl = [] } = o;
  ln(x, y + h, x + w, y + h, eo(p), { lw: 2 }); ln(x, y + h, x, y, eo(p), { lw: 2 });
  yl.forEach((l, i) => { const yy = y + h - (i / (yl.length - 1)) * h; mono(l, x - 16, yy + 7, 18, DIM, { align: 'right', alpha: seg(p, .3 + i * .05, .7 + i * .05) }); ln(x - 6, yy, x + 6, yy, seg(p, .3, .8), { lw: 2 }); });
  xl.forEach((l, i) => { const xx = x + (i / (xl.length - 1)) * w; mono(l, xx, y + h + 34, 18, DIM, { align: 'center', alpha: seg(p, .3 + i * .05, .7 + i * .05) }); ln(xx, y + h - 6, xx, y + h + 6, seg(p, .3, .8), { lw: 2 }); });
}
// ---------- kinetic hero type ----------
function hero(lines, t, o = {}) {
  const { cy = 560, x = CX, align = 'center', stagger = .03, start = 0, glitch = true, kicker = null, kt = 0 } = o;
  let tot = 0; lines.forEach(l => tot += (l.size || 180) * (l.lh || 1.02)); let y = cy - tot / 2;
  if (kicker) mono(scr(kicker, seg(t, kt, kt + .5)), align === 'center' ? x : x + 6, y - 24, 30, VIO2, { align, w: 700 });
  let k = 0;
  lines.forEach((l, li) => {
    const size = l.size || 180, col = l.c || WHITE, wgt = l.w || 900, ls = l.ls ?? -size * .03, st = l.start ?? start;
    y += size * (l.lh || 1.02);
    g.font = `${wgt} ${size}px ${SANS}`; g.letterSpacing = '0px';
    const chars = [...l.s]; const ws = chars.map(c => g.measureText(c).width + ls); const tw = ws.reduce((a, b) => a + b, 0) - ls;
    let xx = align === 'center' ? x - tw / 2 : x;
    chars.forEach((c, i) => {
      const t0 = st + k * stagger, p = seg(t, t0, t0 + .5); k++;
      if (p > 0) {
        const dy = (1 - ex(p)) * size * .45, gl = (col !== WHITE ? 22 : 0) + 34 * (1 - p);
        if (glitch && t - t0 < .35) {
          const off = (1 - (t - t0) / .35) * 14 * (rnd(i + FR) > .5 ? 1 : -1);
          g.save(); g.globalCompositeOperation = 'lighter';
          txt(c, xx + off, y + dy, { size, w: wgt, color: 'rgba(255,40,90,.55)', alpha: p });
          txt(c, xx - off, y + dy, { size, w: wgt, color: 'rgba(40,190,255,.55)', alpha: p }); g.restore();
        }
        txt(c, xx, y + dy, { size, w: wgt, color: col, alpha: p, glow: gl, glowColor: col === RED ? RED : VIO });
      }
      xx += ws[i];
    });
    l._end = xx; l._y = y; l._x0 = align === 'center' ? x - tw / 2 : x; l._w = tw;
  });
  return lines;
}
function strike(l, p, color = VIO, h = 0) { // strike through a hero line
  if (p <= 0) return; const y = l._y - (l.size || 180) * .33 + h;
  ln(l._x0 - 20, y, l._x0 - 20 + (l._w + 40) * eo(p), y, 1, { color, lw: (l.size || 180) * .07, glow: 26 });
}
function chapter(num, title, t, o = {}) {
  const { kick = '', acc = VIO, sub = '' } = o;
  const p = seg(t, 0, .8);
  g.save(); g.globalAlpha *= eo(p); g.font = `900 460px ${SANS}`; g.letterSpacing = '-20px';
  g.strokeStyle = acc === RED ? RED : VIO2; g.lineWidth = 3; g.shadowColor = acc; g.shadowBlur = 30;
  g.save(); g.beginPath(); g.rect(0, 700 - 460 * eo(p) - 40, W, 520); g.clip(); g.strokeText(num, 170, 760); g.restore(); g.restore();
  mono(scr(kick, seg(t, .2, .9)), 800, 430, 30, acc === RED ? RED : VIO2, { w: 700 });
  const ts = o.size || Math.min(...title.map(s => s.length > 12 ? 110 : 150));
  hero(title.map(s => ({ s, size: ts })), t, { x: 800, align: 'left', cy: 590, start: .25 });
  const lp = eo(seg(t, .3, 1.3)); ln(800, 760, 800 + 960 * lp, 760, 1, { lw: 2 }); if (lp < 1) glowDot(800 + 960 * lp, 760, 8);
  if (sub) mono(scr(sub, seg(t, .8, 1.6)), 800, 810, 24, DIM);
}
