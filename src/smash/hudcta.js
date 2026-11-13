// Финал каждого ролика CRUSH MOTION: затемнение, кнопка «ПОДПИСАТЬСЯ», курсор нажимает — «ВЫ ПОДПИСАНЫ» и колокольчик.
// k — доля финала 0..1 (длина CTA_LEN). Нажатие — на CTA_TAP, колокольчик качается после него: в эти моменты сцена шлёт события 'cta' и 'ctaTap' для звука.
export const CTA_LEN = 3.2, CTA_TAP = .42;
const clamp = x => Math.max(0, Math.min(1, x));
const backOut = x => { const c = 1.7; x = clamp(x); return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function bell(g, x, y, s, ang) {
  g.save(); g.translate(x, y); g.rotate(ang); g.scale(s, s); g.fillStyle = '#ffd400'; g.strokeStyle = '#000'; g.lineWidth = 7;
  g.beginPath(); g.moveTo(-40, 30); g.quadraticCurveTo(-36, -40, 0, -46); g.quadraticCurveTo(36, -40, 40, 30); g.lineTo(50, 42); g.lineTo(-50, 42); g.closePath(); g.stroke(); g.fill();
  g.beginPath(); g.arc(0, 52, 11, 0, 7); g.stroke(); g.fill(); g.beginPath(); g.arc(0, -50, 8, 0, 7); g.stroke(); g.fill(); g.restore();
}
function cursor(g, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 92); g.lineTo(24, 70); g.lineTo(42, 110); g.lineTo(60, 102); g.lineTo(42, 63); g.lineTo(74, 60); g.closePath();
  g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 7; g.lineJoin = 'round'; g.stroke(); g.fill(); g.restore();
}
export function drawCta(g, W, H, k) {
  const txt = (s, x, y, size, col) => { g.font = `900 ${size}px Montserrat`; const sz = Math.min(size, Math.floor(size * 960 / g.measureText(s).width)); g.font = `900 ${sz}px Montserrat`; g.lineWidth = sz * .2; g.strokeStyle = '#000'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); };
  g.textAlign = 'center'; g.lineJoin = 'round';
  g.fillStyle = `rgba(0,0,0,${.6 * clamp(k * 5)})`; g.fillRect(0, 0, W, H);
  const a1 = clamp((k - .04) / .1); if (a1 > 0) { g.globalAlpha = a1; txt('ПОНРАВИЛСЯ РАЗНОС?', W / 2, 700, 92, '#ffd400'); g.globalAlpha = 1; }
  const done = k >= CTA_TAP + .03, press = k >= CTA_TAP && k < CTA_TAP + .06 ? .92 : 1, s = backOut((k - .1) / .14) * press, bw = 700, bh = 170, cx = W / 2, cy = 960;
  if (s > 0) {
    g.save(); g.translate(cx, cy); g.scale(s, s);
    g.fillStyle = 'rgba(0,0,0,.45)'; rr(g, -bw / 2 + 10, -bh / 2 + 14, bw, bh, 40); g.fill();
    g.fillStyle = done ? '#3d3d44' : '#ff1f2d'; rr(g, -bw / 2, -bh / 2, bw, bh, 40); g.fill(); g.lineWidth = 8; g.strokeStyle = '#000'; g.stroke();
    g.font = '900 78px Montserrat'; g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(done ? 'ВЫ ПОДПИСАНЫ' : 'ПОДПИСАТЬСЯ', 0, 4); g.textBaseline = 'alphabetic';
    g.restore();
  }
  if (done) { const t = (k - CTA_TAP - .03) / .3, ang = t < 1 ? Math.sin(t * 22) * .5 * (1 - t) : 0; bell(g, cx + bw / 2 + 20, cy - bh / 2 - 10, 1.15 * backOut(t * 3), ang); }
  if (k > .2 && k < CTA_TAP + .25) { const m = clamp((k - .2) / (CTA_TAP - .2)), e = 1 - (1 - m) ** 3, x = W * .86 + (cx + 120 - W * .86) * e, y = H * .78 + (cy + 10 - H * .78) * e; cursor(g, x, y, k >= CTA_TAP && k < CTA_TAP + .06 ? 1.15 : 1.3); }
  const a2 = clamp((k - .55) / .12); if (a2 > 0) { g.globalAlpha = a2; txt('НОВЫЙ РАЗНОС', W / 2, 1230, 84, '#ffffff'); txt('КАЖДЫЙ ДЕНЬ', W / 2, 1330, 84, '#ffffff'); g.globalAlpha = 1; }
}
