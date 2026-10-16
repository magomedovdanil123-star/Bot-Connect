// Библиотека шаблонов сцен. draw(t, d, s): t — время внутри сцены, d — длительность,
// s.p — параметры из planner.js, s.kt(i) — момент, когда диктор произносит слово с индексом i.

function tw(str, size, w = 800, fam = SANS) { g.save(); g.font = `${w} ${size}px ${fam}`; const m = g.measureText(str).width; g.restore(); return m; }
function fitSize(str, maxW, size, w = 900, fam = SANS) { while (size > 24 && tw(str, size, w, fam) > maxW) size -= 4; return size; }
function wrap(str, maxW, size, w = 900) {
  const ws = str.split(/\s+/); const lines = []; let cur = '';
  for (const x of ws) { const n = cur ? cur + ' ' + x : x; if (tw(n, size, w) > maxW && cur) { lines.push(cur); cur = x; } else cur = n; }
  if (cur) lines.push(cur); return lines;
}
// крупная типографика: последняя строка — акцентная
function heroText(text, t, o = {}) {
  const clean = text.replace(/[«»"]/g, '').trim();
  let size = o.size || 170; let lines = wrap(clean.toUpperCase(), 1600, size);
  while ((lines.length > 3 || lines.some(l => tw(l, size) > 1640)) && size > 60) { size -= 10; lines = wrap(clean.toUpperCase(), 1600, size); }
  return hero(lines.map((s, i) => ({ s, size, c: i === lines.length - 1 && lines.length > 1 ? VIO2 : WHITE, start: (o.start || .1) + i * .3 })), t, { cy: o.cy || 580, kicker: o.kicker, x: o.x, align: o.align });
}
const fmtNum = (v, raw) => { if (raw && /[.,]/.test(raw)) { const dec = raw.split(/[.,]/)[1].length; return v.toFixed(dec).replace('.', ','); } return fmt(v); };

const T = {
  hero(t, d, s) { blob(CX, 560, 520, .3 * seg(t, 0, .6)); heroText(s.p.text, t); },

  heroQ(t, d, s) {
    const L = heroText(s.p.text, t, { cy: 560 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283 + t * .4; txt('?', CX + Math.cos(a) * 820, 560 + Math.sin(a) * 380, { size: 60, w: 900, color: i % 2 ? DIM2 : VIO2, align: 'center', alpha: seg(t, .5 + i * .1, 1 + i * .1) * .7 }); }
  },

  stop(t, d, s) {
    const sh = (1 - seg(t, 0, .4)) * 12; g.save(); g.translate((rnd(FR) - .5) * sh, (rnd(FR + 5) - .5) * sh);
    const p = back(seg(t, 0, .35)); g.save(); g.translate(CX, 400); g.scale(p, p); g.fillStyle = WHITE; g.shadowColor = VIO; g.shadowBlur = 40;
    g.fillRect(-70, -90, 46, 180); g.fillRect(24, -90, 46, 180); g.restore();
    heroText(s.p.text, t, { cy: 720, size: 180 }); g.restore();
    mono('|| ПАУЗА', CX, 920, 26, VIO2, { align: 'center', w: 700, alpha: Math.sin(t * 10) > 0 ? 1 : .3 });
  },

  strike(t, d, s) {
    const size = fitSize(s.p.word, 1600, 190);
    const L = hero([{ s: s.p.word, size }], t, { cy: 580, kicker: s.p.kick.toLowerCase(), start: .15 });
    strike(L[0], seg(t, .9, 1.3), RED);
    mono(scr('НЕТ ГАРАНТИЙ', seg(t, 1.3, 1.9)), CX, 830, 34, RED, { align: 'center', w: 700 });
  },

  chapter(t, d, s) {
    // подбираем кегль так, чтобы заголовок влез справа от номера (ширина ~1020px)
    let size = 150, lines = wrap(s.p.title, 1020, size);
    while (size > 64 && (lines.length > 2 || lines.some(l => tw(l, size, 900) > 1020))) { size -= 8; lines = wrap(s.p.title, 1020, size); }
    chapter(s.p.num, lines, t, { kick: s.p.kick, sub: '', size });
  },

  questions(t, d, s) {
    const qs = s.p.qs, x = 300, y = 360, w = 1320, rowH = qs.length > 2 ? 110 : 130, h = 120 + qs.length * rowH, p = seg(t, 0, .6);
    g.save(); g.globalAlpha *= eo(p); g.fillStyle = WHITE; g.fillRect(x, y, w * eo(p), 80); g.restore();
    if (p > .5) { txt('ВОПРОСЫ', x + 28, y + 56, { size: 42, w: 900, color: '#0a0612' }); mono(`${qs.length} ${qs.length === 1 ? 'ВОПРОС' : 'ВОПРОСА'} · РАЗБОР`, x + 280, y + 50, 20, '#3a2d5a', { w: 700 }); }
    box(x + w / 2, y + 80 + h / 2 - 40, w, h - 80 + 40, seg(t, .2, .8), { lw: 2 });
    let wi = 0;
    qs.forEach((q, i) => {
      const tq = s.kt(wi) - .2; wi += q.split(/\s+/).length;
      const qq = seg(t, tq, tq + .5), yy = y + 170 + i * rowH, size = fitSize(q, w - 200, 40, 700);
      checkbox(x + 70, yy - 14, 46, qq, 3, t);
      txt(scr(`${pad(i + 1)}  ${q}`, seg(t, tq, tq + .9)), x + 130, yy, { size, w: 700, alpha: qq });
    });
  },

  counter(t, d, s) {
    const p = s.p, tk = Math.max(.2, s.kt(s.numWi) - .4), q = seg(t, tk, tk + 1.4);
    blob(CX, 620, 520, .35 * seg(t, tk, tk + .5));
    for (let k = 0; k < 3; k++) { const r = (t * .5 + k / 3) % 1; ring(CX, 620, 200 + r * 480, (1 - r) * .4 * seg(t, tk, tk + .5)); }
    const val = (p.dollar ? '$' : '') + fmtNum(p.value * eo(q), p.raw);
    const size = fitSize(val, 1500, 280);
    txt(val, CX, 690, { size, w: 900, align: 'center', glow: 30, alpha: seg(t, tk, tk + .3) });
    if (p.unit) txt(p.unit.toUpperCase(), CX, 800, { size: 64, w: 900, color: VIO2, align: 'center', glow: 20, alpha: seg(t, tk + .6, tk + 1) });
    if (p.label) mono(scr(p.label.toUpperCase(), seg(t, tk + .8, tk + 1.6)), CX, 880, 26, DIM, { align: 'center', w: 700 });
  },

  fromTo(t, d, s) {
    const p = s.p, t1 = .4, t2 = Math.max(1.2, d * .45);
    const v = lerp(p.from, p.to, eo(seg(t, t2, t2 + .6)));
    const shown = t < t2 ? fmtNum(p.from, p.rawFrom) : t > t2 + .6 ? fmtNum(p.to, p.rawTo) : fmtNum(v, p.rawTo);
    txt(shown + (p.unit ? ' ' + p.unit.toUpperCase() : ''), CX, 470, { size: 120, w: 900, align: 'center', glow: 30, color: t > t2 ? VIO2 : WHITE, alpha: seg(t, t1, t1 + .4) });
    const x = 460, y = 560, w = 1000, h = 150, ap = seg(t, t1, t1 + .6), fall = eio(seg(t, t2 + .2, t2 + 1.2)), ratio = clamp(p.to / (p.from || 1), .05, 3);
    const W1 = w * Math.min(1, 1 / Math.max(1, ratio)), W2 = W1 * ratio;
    g.save(); g.globalAlpha *= ap; g.fillStyle = 'rgba(185,162,255,.9)'; g.shadowColor = VIO; g.shadowBlur = 30; g.fillRect(x, y, lerp(W1, W2, eo(seg(t, t2, t2 + .8))) * eo(ap), h); g.restore();
    if (ratio < 1 && fall > 0 && fall < 1) { g.save(); g.globalAlpha *= 1 - fall; g.fillStyle = 'rgba(185,162,255,.6)'; g.fillRect(x + W2, y + fall * 260, W1 - W2, h); g.restore(); }
    if (t > t2 - .2) sparks(x + W2, y + h / 2, t - t2, 4, { n: 34, spd: 460 });
    mono('БЫЛО: ' + fmtNum(p.from, p.rawFrom), x, y - 20, 22, DIM, { w: 700, alpha: ap });
    mono('СТАЛО: ' + fmtNum(p.to, p.rawTo), x + w, y - 20, 22, VIO2, { w: 700, align: 'right', alpha: seg(t, t2, t2 + .4) });
    if (p.label) mono(scr(p.label.toUpperCase(), seg(t, t2 + .5, t2 + 1.2)), CX, 860, 28, WHITE, { align: 'center', w: 700 });
  },

  compare(t, d, s) {
    const { a, b } = s.p, mx = Math.max(a.value, b.value) || 1;
    [a, b].forEach((it, i) => {
      const tk = Math.max(.2, s.kt(i ? s.numWi2 : s.numWi) - .3), q = seg(t, tk, tk + 1.2), y = 470 + i * 230, col = i ? VIO2 : WHITE;
      mono((it.label || '').toUpperCase(), 220, y, 26, i ? VIO2 : GOLD, { w: 700, alpha: seg(t, tk, tk + .3) });
      txt(fmtNum(it.value * eo(q), it.raw) + (it.unit ? ' ' + it.unit : ''), 220, y + 70, { size: 60, w: 900, color: col, glow: i ? 20 : 0, alpha: seg(t, tk, tk + .3) });
      const bw = 1000 * it.value / mx;
      g.save(); g.globalAlpha *= seg(t, tk, tk + .3); g.strokeStyle = DIM2; g.lineWidth = 1.5; g.strokeRect(700, y - 10, 1000, 70);
      g.fillStyle = i ? VIO2 : GOLD; g.shadowColor = i ? VIO : GOLD; g.shadowBlur = 18; g.fillRect(704, y - 6, (bw - 8) * eo(q), 62); g.restore();
    });
    const ratio = Math.max(a.value, b.value) / (Math.min(a.value, b.value) || 1);
    const tr = Math.max(s.kt(s.numWi2) + 1.2, 1.5), rp = seg(t, tr, tr + .4);
    if (rp > 0 && ratio >= 1.5 && ratio < 1000) { txt('×' + (Number.isInteger(ratio) ? ratio : ratio.toFixed(1).replace('.', ',')), 1700, 920, { size: 140, w: 900, align: 'right', glow: 40, alpha: rp }); sparks(1600, 880, t - tr, 12); }
  },

  timeline(t, d, s) {
    const yr = s.p.year, x0 = 230, x1 = 1690, y = 680, years = [yr - 15, yr - 10, yr - 5, yr].filter(v => v > 1900);
    const tk = Math.max(.3, s.kt(s.numWi) - .5);
    ln(x0, y, x1, y, eo(seg(t, 0, 1)), { lw: 2 });
    years.forEach((v, i) => {
      const x = lerp(x0 + 80, x1 - 160, i / (years.length - 1)), last = i === years.length - 1, q = seg(t, .3 + i * .2, .7 + i * .2);
      if (last) {
        const lp = seg(t, tk, tk + .6);
        box(x, y, 260, 130, lp, { title: String(yr), sub: s.p.label ? s.p.label.toLowerCase() : '', ts: 50, color: VIO2, glow: 30 });
        if (lp > 0) { blob(x, y, 320, .4 * lp); for (let k = 0; k < 2; k++) { const r = (t * .7 + k / 2) % 1; ring(x, y, 100 + r * 180, (1 - r) * .7 * lp); } }
      } else {
        g.save(); g.globalAlpha *= q; g.fillStyle = BG; g.strokeStyle = WHITE; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 14, 0, 6.28); g.fill(); g.stroke(); g.restore();
        mono(String(v), x, y - 44, 26, DIM, { align: 'center', w: 700, alpha: q });
      }
    });
    const pp = eio(seg(t, tk - .6, tk)); if (pp > 0 && pp < 1) glowDot(lerp(x0, x1 - 160, pp), y, 9);
    txt(String(Math.round(lerp(yr - 15, yr, eo(seg(t, tk - .6, tk + .3))))), 230, 520, { size: 150, w: 900, glow: 24, alpha: seg(t, tk - .6, tk - .3) * .9 });
  },

  versus(t, d, s) {
    const { a, b } = s.p, ta = Math.max(.2, s.kt(s.entWi[0] ?? 0) - .3), tb = Math.max(ta + .5, s.kt(s.entWi[1] ?? 0) - .3);
    const colA = a.sym === 'BTC' ? GOLD : WHITE;
    blob(560, 640, 420, .25 * seg(t, ta, ta + .5));
    coin(560, 620, 160, a.sym, seg(t, ta, ta + .8), { color: colA, spin: Math.sin(t * 1.3) * .5 });
    coin(1360, 620, 160, b.sym, seg(t, tb, tb + .8), { color: VIO2, spin: Math.sin(t * 1.3 + 1) * .5 });
    txt(a.name.toUpperCase(), 560, 860, { size: fitSize(a.name.toUpperCase(), 600, 54), w: 900, align: 'center', color: colA, alpha: seg(t, ta + .3, ta + .7) });
    txt(b.name.toUpperCase(), 1360, 860, { size: fitSize(b.name.toUpperCase(), 600, 54), w: 900, align: 'center', color: VIO2, glow: 20, alpha: seg(t, tb + .3, tb + .7) });
    if (a.desc) mono(scr(a.desc.toUpperCase(), seg(t, ta + .5, ta + 1.2)), 560, 920, 24, DIM, { align: 'center', w: 700 });
    if (b.desc) mono(scr(b.desc.toUpperCase(), seg(t, tb + .5, tb + 1.2)), 1360, 920, 24, DIM, { align: 'center', w: 700 });
    txt('VS', CX, 650, { size: 90, w: 900, color: DIM, align: 'center', alpha: seg(t, tb, tb + .4) });
  },

  chartUp(t, d, s) {
    const x0 = 380, y0 = 380, w = 1160, h = 560, ap = seg(t, 0, .5);
    axes(x0, y0, w, h, ap, { yl: ['x1', 'x10', 'x50', 'x100'], xl: ['', '', '', '', ''] });
    const pts = []; for (let k = 0; k <= 80; k++) { const u = k / 80; const v = (Math.exp(4 * u) - 1) / (Math.exp(4) - 1); pts.push([x0 + u * w, y0 + h - v * h * .92 + (rnd(k + s.idx) - .5) * 16 * (1 - u)]); }
    const lp = eo(seg(t, .3, Math.min(d - .3, 2.6))); const [hx, hy] = poly(pts, lp, { color: VIO2, lw: 5, glow: 26, head: true });
    blob(hx, hy, 300, .5 * lp); sparks(hx, hy, (t * 3) % .8, Math.floor(t * 3.75) * 31, { n: 10, spd: 180, life: .8 });
    if (lp > .55) txt(s.p.tag, hx - 30, hy - 40, { size: 110, w: 900, align: 'right', glow: 40, alpha: seg(lp, .55, .8) });
    if (s.p.label) mono(s.p.label + ' ↗', x0 + 20, y0 + 30, 22, VIO2, { w: 700, alpha: ap });
  },

  chartDown(t, d, s) {
    const x0 = 300, y0 = 400, w = 1320, h = 520;
    axes(x0, y0, w, h, seg(t, 0, .6), { yl: ['', '', '', ''], xl: ['', '', '', '', ''] });
    const line = (f, seed) => { const pts = []; for (let k = 0; k <= 60; k++) { const u = k / 60; pts.push([x0 + u * w, y0 + h - f(u) * h + (rnd(k + seed) - .5) * 14]); } return pts; };
    const c1 = poly(line(u => .1 + .75 * u * u, 1), eo(seg(t, .4, 2.8)), { color: WHITE, lw: 3, head: true });
    const c3 = poly(line(u => .55 - .4 * u + .04 * Math.sin(u * 9), 3 + s.idx), eo(seg(t, .6, 3)), { color: RED, lw: 4, head: true, headC: '255,79,110' });
    mono('РЫНОК', c1[0] + 12, c1[1] - 10, 20, WHITE, { w: 700, alpha: seg(t, 2.2, 2.6) });
    mono(s.p.label || 'ЦЕНА', c3[0] + 12, c3[1] + 6, 22, RED, { w: 700, alpha: seg(t, 1.2, 1.6) });
    const gp = seg(t, 2.8, 3.3); if (gp > 0) { arrow(x0 + w - 60, c3[1] - 16, x0 + w - 60, lerp(c3[1] - 16, c1[1] + 20, eo(gp)), 1, { color: RED, lw: 3 }); mono('ОТСТАВАНИЕ', x0 + w - 80, (c1[1] + c3[1]) / 2, 22, RED, { w: 700, align: 'right', alpha: gp }); }
  },

  privacy(t, d, s) {
    const x = 260, y = 400, w = 1400, ts = .8;
    box(x + w / 2, y + 230, w, 460, seg(t, 0, .6), { lw: 2 });
    ['ОТ', 'КОМУ', 'СУММА'].forEach((h, j) => mono(h, x + 40 + j * 540, y + 50, 20, DIM, { w: 700, alpha: seg(t, .3, .6) }));
    const sx = lerp(x - 40, x + w + 60, eio(seg(t, ts, d - .3)));
    for (let i = 0; i < 6; i++) {
      const yy = y + 110 + i * 60, q = seg(t, .3 + i * .1, .8 + i * .1);
      const row = ['0x' + (rnd(i) * 1e9 | 0).toString(16) + '…' + (rnd(i + 4) * 1e4 | 0), '0x' + (rnd(i + 7) * 1e9 | 0).toString(16) + '…' + (rnd(i + 9) * 1e4 | 0), (rnd(i + 2) * 40).toFixed(3)];
      row.forEach((str, j) => { const cx = x + 40 + j * 540, hidden = cx < sx; mono(hidden ? str.split('').map((c, k) => GL[Math.floor(rnd(k + i * 9 + j * 3 + FR * .5) * GL.length)]).join('') : str, cx, yy, 26, hidden ? VIO2 : WHITE, { alpha: q * (hidden ? .8 : 1), w: hidden ? 400 : 700 }); });
    }
    if (t > ts) { ln(sx, y - 20, sx, y + 480, 1, { color: VIO2, lw: 3, glow: 20 }); mono(s.p.tag, sx, y - 34, 22, VIO2, { w: 700, align: 'center' }); }
    lockIcon(CX, 960, 60, seg(t, d * .5, d * .5 + .4));
  },

  transfer(t, d, s) {
    const y = 640, sym = s.p.coin || '◆';
    box(380, y, 300, 140, seg(t, 0, .6), { title: 'ОТПРАВИТЕЛЬ', ts: 26 });
    box(1540, y, 300, 140, seg(t, .2, .8), { title: 'ПОЛУЧАТЕЛЬ', ts: 26 });
    ln(530, y, 1390, y, seg(t, .4, 1), { lw: 3, color: VIO2, glow: 14, dash: [10, 8] });
    const vp = ((t - .9) * .45) % 1; if (t > .9) { coin(lerp(530, 1390, eio(vp)), y, 34, sym, 1, { glow: 10 }); }
    if (s.p.bank) {
      const bq = seg(t, .6, 1.2); box(CX, 400, 320, 110, bq, { title: 'БАНК', sub: 'посредник', ts: 32, dashed: true, alpha: t > d * .6 ? .5 : 1 });
      cross(CX, 400, 140, seg(t, d * .6, d * .6 + .6));
    }
    const bp = eo(seg(t, 1, Math.min(d - .3, 3)));
    g.save(); g.globalAlpha *= seg(t, .8, 1.2); g.strokeStyle = WHITE; g.lineWidth = 2; g.strokeRect(CX - 300, 860, 600, 30); g.fillStyle = VIO2; g.shadowColor = VIO; g.shadowBlur = 20; g.fillRect(CX - 296, 864, 592 * bp, 22); g.restore();
    mono(bp >= 1 ? 'ПОДТВЕРЖДЕНО ✓' : 'ПОДТВЕРЖДЕНИЕ ' + Math.round(bp * 100) + '%', CX, 930, 22, VIO2, { align: 'center', w: 700, alpha: seg(t, .8, 1.2) });
  },

  checklist(t, d, s) {
    const items = s.p.items.slice(0, 5), n = items.length, y0 = 640 - (n - 1) * 60;
    items.forEach((it, i) => { const tq = .3 + i * (d * .7 / n), q = seg(t, tq, tq + .5), yy = y0 + i * 120; box(CX, yy, 1200, 96, q, { lw: 2 }); checkbox(470, yy, 46, q, 1, t); txt(scr(it, q), 530, yy + 16, { size: fitSize(it, 1000, 42, 800), w: 800 }); });
  },

  chain(t, d, s) {
    const items = s.p.items.slice(0, 4), n = items.length, gap = 1640 / n, y = 660;
    items.forEach((it, i) => {
      const x = 140 + gap * (i + .5), tq = .3 + i * (d * .65 / n), q = seg(t, tq, tq + .6), w = Math.min(gap - 70, Math.max(220, tw(it, 26, 700, MONO) + 60)), last = i === n - 1;
      box(x, y, w, 130, q, { title: it, ts: 26, color: last ? VIO2 : WHITE, glow: last ? 26 : 0 });
      if (i > 0) { const px = 140 + gap * (i - .5), ap = eo(seg(t, tq - .4, tq)); arrow(px + gap / 2 - 25, y, x - w / 2 - 10, y, ap, { lw: 3, color: VIO2, glow: 12 }); }
      if (last && q > 0) blob(x, y, 320, .35 * q);
    });
    if (s.p.hub) mono(s.p.hub, 140, 470, 24, VIO2, { w: 700, alpha: seg(t, .2, .6) });
  },

  network(t, d, s) {
    const items = s.p.items.slice(0, 6), cx = CX, cy = 660, n = items.length;
    glowDot(cx, cy, 14, seg(t, .2, .6)); if (s.p.hub) box(cx, cy, Math.max(260, tw(s.p.hub, 30, 700, MONO) + 60), 90, seg(t, 0, .6), { title: s.p.hub, ts: 30, glow: 24 });
    items.forEach((it, i) => {
      const a = -Math.PI / 2 + (i + .5) / n * 6.283, x = cx + Math.cos(a) * 560, y = cy + Math.sin(a) * 250, tq = .4 + i * (d * .6 / n), q = seg(t, tq, tq + .6);
      ln(cx, cy, x, y, eo(q), { lw: 2, color: VIO2, glow: 10 });
      box(x, y, Math.max(160, tw(it, 22, 700, MONO) + 50), 64, seg(t, tq + .2, tq + .8), { title: it, ts: 22 });
    });
  },

  status(t, d, s) {
    const x = 460, y = 360, w = 1000, rows = s.p.rows; box(x + w / 2, y + 290, w, 580, seg(t, 0, .6), { lw: 2 });
    mono((s.p.title || 'СТАТУС') + ' · СТАТУС', x + 40, y + 60, 24, WHITE, { w: 700, alpha: seg(t, .2, .5) }); ln(x, y + 90, x + w, y + 90, seg(t, .2, .6), { lw: 1.5, color: DIM2 });
    rows.forEach((r, i) => { const tq = .4 + i * (d * .6 / rows.length), q = seg(t, tq, tq + .6), yy = y + 180 + i * 100; mono(r + ' ' + '.'.repeat(Math.max(3, 26 - r.length)), x + 40, yy, 28, WHITE, { w: 700, alpha: q }); txt(scr('АКТИВНО', q), x + w - 90, yy + 4, { size: 36, w: 900, color: VIO2, align: 'right', glow: 20 }); if (q >= 1) glowDot(x + w - 50, yy - 10, 8, .6 + .4 * Math.sin(t * 6 + i)); });
    const pts = []; for (let k = 0; k <= 200; k++) { const u = k / 200, ph = ((u * 6 - t * .8) % 1 + 1) % 1; pts.push([x + 40 + u * (w - 80), y + 520 - (ph > .5 && ph < .6 ? Math.sin((ph - .5) / .1 * 6.28) * 30 : 0)]); }
    poly(pts, seg(t, .5, 1.5), { color: VIO2, lw: 2.5, glow: 12 });
  },

  worlds(t, d, s) {
    const Lx = 470, Rx = 1450, Y = 680, r = 220, p = eo(seg(t, 0, .9));
    g.save(); g.lineWidth = 2.5; g.setLineDash([10, 10]); g.strokeStyle = WHITE; g.globalAlpha *= .6;
    g.beginPath(); g.arc(Lx, Y, r * p, 0, 6.2832); g.stroke(); g.beginPath(); g.arc(Rx, Y, r * p, 0, 6.2832); g.stroke(); g.restore();
    mono(scr('МИР 01', seg(t, .5, 1)), Lx, Y + 8, 30, WHITE, { align: 'center', w: 700 }); mono(scr('МИР 02', seg(t, .7, 1.2)), Rx, Y + 8, 30, WHITE, { align: 'center', w: 700 });
    const sq = Math.sin(t * 18) * 3 * seg(t, 1, 1.5);
    box(CX + sq, Y, Math.max(200, tw(s.p.mid || '?', 30, 700, MONO) + 60), 110, seg(t, .3, 1.1), { title: s.p.mid || '?', ts: 30, glow: 20 });
    const ap = eo(seg(t, 1, 1.6)); arrow(Lx + r + 10, Y, Lx + r + 10 + 110 * ap, Y, ap, { lw: 3, color: RED }); arrow(Rx - r - 10, Y, Rx - r - 10 - 110 * ap, Y, ap, { lw: 3, color: RED });
  },

  waves(t, d, s) {
    const wp = seg(t, .3, 1.3);
    for (let k = 0; k < 4; k++) { const r = (t * .6 + k / 4) % 1; ring(CX, 640, 150 + r * 700, (1 - r) * .7 * wp, 3); }
    for (let i = 0; i < 3; i++) waveLine(160, 640 + (i - 1) * 40, 1600, 40 + 120 * eo(wp), t + i * .3, seg(t, .3, 1.3), { color: i === 1 ? VIO2 : DIM2, lw: i === 1 ? 4 : 2, glow: i === 1 ? 20 : 0, freq: 14, spd: 3 });
    coin(CX, 640, 130, s.p.sym, seg(t, 0, .6), { color: VIO2 });
    mono(scr(s.p.label, wp), CX, 900, 30, VIO2, { align: 'center', w: 700 });
  },

  clock(t, d, s) {
    const cx = 480, cy = 600, r = 220, p = seg(t, 0, .6);
    g.save(); g.globalAlpha *= p; g.strokeStyle = WHITE; g.lineWidth = 4; g.shadowColor = VIO; g.shadowBlur = 24; g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke(); g.shadowBlur = 0;
    for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283, l = i % 5 ? 10 : 26; g.lineWidth = i % 5 ? 2 : 4; g.beginPath(); g.moveTo(cx + Math.cos(a) * (r - 20), cy + Math.sin(a) * (r - 20)); g.lineTo(cx + Math.cos(a) * (r - 20 - l), cy + Math.sin(a) * (r - 20 - l)); g.stroke(); }
    g.restore();
    const a = -Math.PI / 2 + t * 2.2; ln(cx, cy, cx + Math.cos(a) * (r - 50), cy + Math.sin(a) * (r - 50), p, { color: VIO2, lw: 5, glow: 20 }); glowDot(cx, cy, 8, p);
    const words = s.p.text.toUpperCase().replace(/[.!…]+$/, '');
    const size = fitSize(words.split(' ').reduce((a, b) => a.length > b.length ? a : b, ''), 960, 140);
    const lines = wrap(words, 980, size);
    hero(lines.map((l, i) => ({ s: l, size, c: i === lines.length - 1 ? VIO2 : WHITE, start: .1 + i * .3 })), t, { cy: 600, x: 820, align: 'left' });
  },

  cards(t, d, s) {
    const ks = s.p.keys; if (!ks.length) return T.focus(t, d, s);
    const n = ks.length, w = Math.min(520, 1600 / n - 40);
    ks.forEach((k, i) => {
      const tq = Math.max(.2 + i * .25, s.kt(k.wi) - .3), q = eo(seg(t, tq, tq + .6)), x = CX + (i - (n - 1) / 2) * (w + 40), y = 660 + (1 - q) * 80;
      box(x, y, w, 300, q, { lw: 2.5, glow: i === n - 1 ? 18 : 0, color: i === n - 1 ? VIO2 : WHITE });
      mono(pad(i + 1), x - w / 2 + 24, y - 110, 20, DIM, { w: 700, alpha: q });
      const word = k.text.toUpperCase(), size = fitSize(word, w - 50, 54);
      txt(scr(word, seg(t, tq + .1, tq + .8)), x, y + 18, { size, w: 900, align: 'center', color: i === n - 1 ? VIO2 : WHITE, glow: i === n - 1 ? 22 : 0 });
      ln(x - w / 2 + 24, y + 90, x - w / 2 + 24 + (w - 48) * q, y + 90, 1, { lw: 2, color: DIM2 });
    });
  },

  focus(t, d, s) {
    coin(CX, 640, 150, s.p.sym, seg(t, 0, .6), { color: VIO2, spin: Math.sin(t) * .4 });
    for (let k = 0; k < 3; k++) { const r = (t * .4 + k / 3) % 1; ring(CX, 640, 180 + r * 380, (1 - r) * .5, 2); }
    (s.p.keys || []).forEach((k, i) => {
      const tq = Math.max(.3, s.kt(k.wi) - .3), q = seg(t, tq, tq + .5), a = [-2.5, -.6, 1.6][i % 3], x = CX + Math.cos(a) * 560, y = 640 + Math.sin(a) * 260;
      ln(CX + Math.cos(a) * 170, 640 + Math.sin(a) * 170, x, y, eo(q), { lw: 2, color: VIO2 });
      const word = k.text.toUpperCase(); box(x, y, Math.max(200, tw(word, 26, 700, MONO) + 50), 70, q, { title: word, ts: 26 });
    });
  },

  diagram(t, d, s) {
    const ks = s.p.keys.length ? s.p.keys : [{ text: s.p.name || 'ИДЕЯ', wi: 0 }];
    const n = ks.length, y = 660;
    ks.forEach((k, i) => {
      const x = CX + (i - (n - 1) / 2) * 560, tq = Math.max(.2 + i * .3, s.kt(k.wi) - .3), q = seg(t, tq, tq + .6), word = k.text.toUpperCase();
      box(x, y, Math.min(480, Math.max(260, tw(word, 30, 700, MONO) + 60)), 150, q, { title: word, sub: 'шаг ' + pad(i + 1), ts: 30, glow: i === n - 1 ? 24 : 0, color: i === n - 1 ? VIO2 : WHITE });
      if (i > 0) { const ap = eo(seg(t, tq - .4, tq)), px = CX + (i - 1 - (n - 1) / 2) * 560; ln(px + 250, y, x - 250, y, ap, { lw: 2.5, color: VIO2, dash: [8, 8] }); if (ap > 0 && ap < 1) glowDot(lerp(px + 250, x - 250, ap), y, 8); }
    });
  },

  subscribe(t, d, s) {
    const tc = Math.max(.6, d * .55), bx = CX, by = 700;
    const clicked = t > tc + .9, bp = seg(t, .3, .9), press = 1 - .06 * Math.sin(seg(t, tc + .8, tc + 1) * 3.14);
    g.save(); g.translate(bx, by); g.scale(press, press); g.globalAlpha *= bp; g.fillStyle = clicked ? 'rgba(0,0,0,0)' : VIO; g.strokeStyle = clicked ? VIO2 : VIO; g.lineWidth = 4; g.shadowColor = VIO; g.shadowBlur = 50;
    g.beginPath(); g.roundRect(-330, -70, 660, 140, 70); g.fill(); g.stroke(); g.restore();
    txt(clicked ? 'ВЫ ПОДПИСАНЫ ✓' : 'ПОДПИСАТЬСЯ', bx, by + 22, { size: 60, w: 900, align: 'center', alpha: bp, color: clicked ? VIO2 : WHITE });
    const cp = eio(seg(t, tc, tc + .8)); if (t > tc - .2) cursorIcon(lerp(1700, bx + 140, cp), lerp(1020, by + 20, cp), 1.4, seg(t, tc - .2, tc));
    if (clicked) { for (let k = 0; k < 2; k++) { const r = seg(t, tc + .9 + k * .2, tc + 1.7 + k * .2); ring(bx, by, 340 + r * 200, (1 - r) * (r > 0)); } sparks(bx, by, t - tc - .9, 8, { n: 40, spd: 600 }); }
  },

  link(t, d, s) {
    const x = CX, y = 680, p = seg(t, 0, .6);
    box(x, y, 900, 460, p, { lw: 2.5 });
    g.save(); g.globalAlpha *= p; g.strokeStyle = WHITE; g.lineWidth = 3; g.beginPath(); g.arc(x - 300, y - 110, 70, 0, 6.28); g.stroke(); g.restore();
    coin(x - 300, y - 110, 56, s.mainSym || '◆', seg(t, .3, .8), { color: VIO2, glow: 10 });
    [[0, 320], [1, 220]].forEach(([i, w]) => ln(x - 190, y - 140 + i * 50, x - 190 + w, y - 140 + i * 50, seg(t, .4 + i * .1, .9 + i * .1), { lw: 14, color: i ? DIM2 : WHITE }));
    const lp = seg(t, .8, 1.3);
    g.save(); g.globalAlpha *= lp; g.strokeStyle = VIO2; g.lineWidth = 3; g.shadowColor = VIO; g.shadowBlur = 30; g.strokeRect(x - 380, y + 20, 760, 90); g.fillStyle = 'rgba(139,92,255,.15)'; g.fillRect(x - 380, y + 20, 760, 90); g.restore();
    const lbl = '↗ ' + s.p.label; txt(scr(lbl, lp), x - 350, y + 80, { size: fitSize(lbl, 700, 44), w: 900, color: VIO2, glow: 20 });
    const bob = Math.sin(t * 6) * 16; arrow(x + 600 + bob, y + 65, x + 410 + bob, y + 65, seg(t, 1, 1.4), { lw: 6, color: WHITE, hs: 28, glow: 16 });
  },

  warning(t, d, s) {
    const p = seg(t, 0, .6);
    g.save(); g.globalAlpha *= p; g.strokeStyle = RED; g.lineWidth = 8; g.lineJoin = 'round'; g.shadowColor = RED; g.shadowBlur = 30; g.beginPath(); g.moveTo(330, 420); g.lineTo(420, 580); g.lineTo(240, 580); g.closePath(); g.stroke(); g.restore();
    txt('!', 330, 565, { size: 110, w: 900, color: RED, align: 'center', alpha: p });
    txt('НЕ ФИНАНСОВАЯ', 500, 510, { size: 76, w: 900, alpha: seg(t, .3, .7) });
    txt('РЕКОМЕНДАЦИЯ', 500, 590, { size: 76, w: 900, color: RED, glow: 20, glowColor: RED, alpha: seg(t, .4, .8) });
    s.p.items.slice(0, 3).forEach((it, i) => { const q = seg(t, .8 + i * .5, 1.3 + i * .5), yy = 720 + i * 90, str = it.toUpperCase().replace(/[.!]+$/, ''); checkbox(280, yy - 14, 50, q, 1, t); txt(scr(str, q), 340, yy, { size: fitSize(str, 1300, 44, 800), w: 800 }); });
  },
};
