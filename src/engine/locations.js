// Локации для историй в чернильной теме: дом, офис, магазин, банк, биржа, улица, Луна.
// Нарисованы кодом «от руки»: контуры слегка дрожат (boil), заливки плоские, акцент — фирменный цвет темы.
const HZ = 720;   // линия стены и пола
function rline(x1, y1, x2, y2, seed, w = 4, a = 1) {
  g.save(); g.globalAlpha *= a; g.beginPath(); g.moveTo(x1 + boil(seed, 0, 1.2), y1 + boil(seed, 1, 1.2));
  g.quadraticCurveTo((x1 + x2) / 2 + boil(seed, 2, 2), (y1 + y2) / 2 + boil(seed, 3, 2), x2 + boil(seed, 4, 1.2), y2 + boil(seed, 5, 1.2)); inkStroke(w); g.restore();
}
function rrect(x, y, w, h, seed, fill, lw = 4, r = 0) {
  g.beginPath();
  if (r) g.roundRect(x + boil(seed, 0, 1), y + boil(seed, 1, 1), w, h, r);
  else { const j = i => boil(seed, i, 1.3); g.moveTo(x + j(0), y + j(1)); g.lineTo(x + w + j(2), y + j(3)); g.lineTo(x + w + j(4), y + h + j(5)); g.lineTo(x + j(6), y + h + j(7)); g.closePath(); }
  if (fill) { g.fillStyle = fill; g.fill(); } if (lw) inkStroke(lw);
}
function rcircle(x, y, r, seed, fill, lw = 4) { g.beginPath(); roughEllipse(x, y, r, r, seed, 1.2); if (fill) { g.fillStyle = fill; g.fill(); } if (lw) inkStroke(lw); }
function wallFloor(wall, floor, seed) {
  g.fillStyle = wall; g.fillRect(0, 0, W, HZ);
  g.fillStyle = floor; g.fillRect(0, HZ, W, H - HZ);
  const gr = g.createLinearGradient(0, HZ, 0, H); gr.addColorStop(0, 'rgba(0,0,0,.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, HZ, W, H - HZ);
  rline(-20, HZ, W + 20, HZ, seed, 5);
}
function perspLines(seed, n = 7, step = 240, a = .3) { for (let i = -n; i <= n; i++) rline(CX + i * step * .5, HZ, CX + i * step, H + 20, seed + i, 2.5, a); }
function skyline(x0, y0, w, h, seed, cols) {
  let x = x0;
  for (let i = 0; x < x0 + w; i++) {
    const bw = 70 + rnd(seed + i) * 90, bh = h * (.35 + rnd(seed + i * 3) * .65), col = cols[i % cols.length];
    rrect(x, y0 + h - bh, Math.min(bw, x0 + w - x), bh, seed + i * 7, col, 2.5);
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let wy = y0 + h - bh + 14; wy < y0 + h - 16; wy += 26) for (let wx = x + 10; wx < x + Math.min(bw, x0 + w - x) - 14; wx += 22) g.fillRect(wx, wy, 10, 13);
    x += bw;
  }
}
function curtain(x, y, w, h, side, seed) {
  g.beginPath(); g.moveTo(x, y);
  g.lineTo(x + w, y);
  for (let i = 0; i <= 8; i++) { const yy = y + h * i / 8; g.lineTo(x + (side < 0 ? w : 0) + side * (-1) * (Math.sin(i * 1.3 + boil(seed, i, .3)) * 14 + (side < 0 ? -i * 7 : i * 7)), yy); }
  g.lineTo(side < 0 ? x : x + w, y + h); g.closePath(); g.fillStyle = VIO; g.fill(); inkStroke(5);
  for (let k = 1; k < 4; k++) rline(x + w * k / 4, y + 10, x + w * k / 4 + side * k * 8, y + h - 20, seed + k * 5, 2.5, .45);
}

const LOCATIONS = {
  home(T) {
    wallFloor('#dce5e9', '#ebcfa3', 11);
    g.save(); g.globalAlpha = .35; g.fillStyle = '#cbd8de'; for (let x = 0; x < W; x += 90) g.fillRect(x, 0, 36, HZ); g.restore();
    perspLines(30, 8, 230, .28);
    rrect(-10, HZ - 26, W + 20, 26, 12, '#f7f4ee', 4);
    // окно с городом
    const wx = 1000, wy = 120, ww = 620, wh = 430;
    const sky = g.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, '#bfe0ff'); sky.addColorStop(1, '#fff0d4'); g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
    rcircle(wx + 470, wy + 120, 46, 13, '#ffe38a', 3);
    skyline(wx, wy + 170, ww, wh - 170, 40, ['#a9c4d6', '#b8cfdd', '#9fbbcf']);
    g.save(); g.strokeStyle = '#fbfaf7'; g.lineWidth = 24; g.strokeRect(wx, wy, ww, wh); g.restore();
    rrect(wx - 12, wy - 12, ww + 24, wh + 24, 14, null, 5); rrect(wx + 12, wy + 12, ww - 24, wh - 24, 15, null, 3.5);
    rline(wx + ww / 2, wy + 12, wx + ww / 2, wy + wh - 12, 16, 10, 1); rline(wx + 12, wy + wh * .45, wx + ww - 12, wy + wh * .45, 17, 8, 1);
    rrect(wx - 40, wy + wh + 10, ww + 80, 26, 18, '#fbfaf7', 4);
    rline(wx - 110, wy - 40, wx + ww + 110, wy - 40, 19, 7); rcircle(wx - 110, wy - 40, 12, 20, INKC, 0); rcircle(wx + ww + 110, wy - 40, 12, 21, INKC, 0);
    curtain(wx - 110, wy - 40, 150, wh + 90, -1, 22); curtain(wx + ww - 40, wy - 40, 150, wh + 90, 1, 23);
    // картина и диван
    rrect(170, 160, 270, 190, 24, '#fff8e8', 5); rrect(186, 176, 238, 158, 25, null, 2.5);
    poly([[210, 300], [260, 270], [300, 285], [350, 220], [400, 200]], 1, { color: VIO2, lw: 6 }); txt('₽', 395, 250, { size: 40, w: 900, color: INKC });
    rrect(80, 560, 490, 160, 26, '#7fb3ad', 5, 34); rrect(60, 690, 530, 110, 27, '#8fc2bc', 5, 28);
    rrect(40, 620, 86, 200, 28, '#79aaa4', 5, 32); rrect(524, 620, 86, 200, 29, '#79aaa4', 5, 32);
    rrect(150, 600, 120, 90, 31, VIO, 4, 22); for (const lx of [90, 560]) rrect(lx, 818, 18, 36, 32 + lx, INKC, 0);
    // торшер и растение
    rline(1760, 860, 1760, 420, 33, 7); rrect(1700, 330, 120, 100, 34, '#fff1c2', 5, 10); g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = .12; g.fillStyle = VIO; g.beginPath(); g.moveTo(1700, 430); g.lineTo(1820, 430); g.lineTo(1900, 860); g.lineTo(1620, 860); g.fill(); g.restore();
    rrect(1560, 780, 120, 110, 35, '#d9774f', 5);
    for (let i = 0; i < 7; i++) { const a = -1.9 + i * .45 + Math.sin(T * 1.3 + i) * .04; g.beginPath(); roughEllipse(1620 + Math.cos(a) * 70, 760 + Math.sin(a) * 90, 22, 64, 36 + i, 1, a + Math.PI / 2); g.fillStyle = '#7cc47f'; g.fill(); inkStroke(4); }
    g.beginPath(); roughEllipse(760, 975, 400, 64, 37, 2); g.fillStyle = '#f2b8a8'; g.fill(); inkStroke(5);
    g.beginPath(); roughEllipse(760, 975, 330, 44, 38, 2); g.setLineDash([14, 12]); inkStroke(3); g.setLineDash([]);
  },

  office(T) {
    wallFloor('#ebe8e1', '#c9ccd2', 51);
    perspLines(52, 8, 230, .2);
    const wx = 860, wy = 100, ww = 1000, wh = 520;
    const sky = g.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, '#a8d0f5'); sky.addColorStop(1, '#e9f3fb'); g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
    skyline(wx, wy + 120, ww, wh - 120, 53, ['#8fb0cc', '#9dbdd8', '#7fa3c2', '#b2c9dc']);
    for (let i = 0; i <= 4; i++) rline(wx + ww * i / 4, wy, wx + ww * i / 4, wy + wh, 54 + i, i % 4 ? 9 : 6);
    rline(wx, wy, wx + ww, wy, 59, 6); rline(wx, wy + wh, wx + ww, wy + wh, 60, 6);
    // часы с идущими стрелками
    rcircle(330, 240, 92, 61, '#fff', 6); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; rline(330 + Math.cos(a) * 72, 240 + Math.sin(a) * 72, 330 + Math.cos(a) * 82, 240 + Math.sin(a) * 82, 62 + i, 3); }
    rline(330, 240, 330 + Math.cos(T * .5 - 1.6) * 44, 240 + Math.sin(T * .5 - 1.6) * 44, 75, 6); rline(330, 240, 330 + Math.cos(T * 3 - 1.6) * 66, 240 + Math.sin(T * 3 - 1.6) * 66, 76, 4);
    for (let i = 0; i < 3; i++) { g.save(); g.translate(520 + i * 95, 170 + (i % 2) * 40); g.rotate((i - 1) * .08); rrect(-38, -38, 76, 76, 77 + i, VIO, 3.5); g.restore(); }
    // стол с монитором
    rrect(1080, 750, 760, 34, 80, '#c58f5c', 5); rrect(1110, 784, 700, 150, 81, '#b07b4c', 5); rrect(1140, 934, 30, 40, 82, INKC, 0); rrect(1740, 934, 30, 40, 83, INKC, 0);
    rrect(1410, 690, 60, 60, 84, '#5b5f69', 4); rrect(1250, 470, 380, 230, 85, '#22252c', 6, 14);
    g.save(); g.beginPath(); g.rect(1270, 490, 340, 190); g.clip(); g.fillStyle = '#1a1d23'; g.fillRect(1270, 490, 340, 190);
    poly(Array.from({ length: 30 }, (_, i) => [1280 + i * 11.5, 650 - i * 4 - Math.sin(i * 1.3) * 14]), 1, { color: '#2fbf71', lw: 5 }); g.restore();
    rrect(1680, 700, 50, 54, 86, '#fff', 4, 8); rrect(1150, 728, 120, 22, 87, '#fff', 3);
    // растение
    rrect(110, 800, 130, 120, 88, '#e0e0e0', 5); for (let i = 0; i < 6; i++) { const a = -2.1 + i * .5 + Math.sin(T + i) * .05; g.beginPath(); roughEllipse(175 + Math.cos(a) * 80, 780 + Math.sin(a) * 120, 20, 78, 89 + i, 1, a + Math.PI / 2); g.fillStyle = '#5fae6a'; g.fill(); inkStroke(4); }
  },

  shop(T) {
    wallFloor('#f6f3ec', '#e6e9ec', 101);
    for (let i = -10; i <= 10; i++) rline(CX + i * 150, HZ, CX + i * 330, H + 20, 102 + i, 2, .25);
    for (const yy of [770, 840, 940]) rline(0, yy, W, yy, 130 + yy, 2, .25);
    rrect(-10, 30, W + 20, 96, 103, '#e8394d', 5);
    txt('СКИДКИ', 520, 100, { size: 64, w: 900, color: '#fff', align: 'center' }); txt('−50%', CX + 420, 100, { size: 64, w: 900, color: VIO, align: 'center' });
    rrect(0, 170, W, 530, 104, '#ece6da', 0);
    const cols = ['#e85d4a', '#4a90d9', '#f2c14e', '#5cb85c', '#9b6bd6', '#ff8fb1', '#f08a3c'];
    [330, 500, 670].forEach((by, si) => {
      let x = 20;
      for (let i = 0; x < W - 60; i++) {
        const sd = 200 + si * 50 + i, kind = Math.floor(rnd(sd) * 3), col = cols[Math.floor(rnd(sd * 1.7) * cols.length)];
        if (kind === 0) { const w = 60 + rnd(sd * 2) * 30, h = 90 + rnd(sd * 3) * 40; rrect(x, by - h, w, h, sd, col, 3.5); rrect(x + 8, by - h * .6, w - 16, h * .25, sd + 1, '#fff', 2); x += w + 10; }
        else if (kind === 1) { rrect(x, by - 80, 50, 80, sd, col, 3.5, 10); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x + 6, by - 54, 38, 20); x += 60; }
        else { rrect(x + 10, by - 130, 16, 30, sd, col, 3); rrect(x, by - 104, 36, 104, sd + 2, col, 3.5, 10); x += 48; }
      }
      rrect(-10, by, W + 20, 20, 300 + si, '#cfc6b8', 4);
      for (let k = 0; k < 9; k++) { const tx = 100 + k * 210 + (si % 2) * 60; rrect(tx, by + 22, 70, 30, 310 + si * 10 + k, VIO, 2.5); mono(['49₽', '99₽', '129₽', '79₽'][(k + si) % 4], tx + 35, by + 44, 16, INKC, { align: 'center', w: 700 }); }
    });
    // тележка
    const cx = 1420, cy = 960;
    g.beginPath(); g.moveTo(cx, cy - 250); g.lineTo(cx + 300, cy - 250); g.lineTo(cx + 260, cy - 90); g.lineTo(cx + 40, cy - 90); g.closePath(); g.fillStyle = 'rgba(200,210,220,.35)'; g.fill(); inkStroke(6);
    for (let i = 1; i < 6; i++) rline(cx + i * 50, cy - 250, cx + 40 + i * 37, cy - 90, 400 + i, 2.5, .7);
    for (let i = 1; i < 3; i++) rline(cx + i * 13, cy - 250 + i * 53, cx + 300 - i * 13, cy - 250 + i * 53, 410 + i, 2.5, .7);
    rline(cx + 300, cy - 250, cx + 360, cy - 300, 420, 6); rline(cx + 40, cy - 90, cx + 60, cy - 30, 421, 6); rline(cx + 60, cy - 30, cx + 270, cy - 30, 422, 6); rline(cx + 260, cy - 90, cx + 270, cy - 30, 423, 6);
    for (const wx of [cx + 80, cx + 250]) rcircle(wx, cy - 10, 18, 424 + wx, '#5b5f69', 4);
  },

  bank(T) {
    wallFloor('#efe9dd', '#e3dccd', 151);
    for (let i = -8; i <= 8; i++) { rline(CX + i * 140, HZ, CX + i * 300, H + 20, 152 + i, 2, .25); }
    for (const yy of [780, 870, 990]) rline(0, yy, W, yy, 170 + yy, 2, .25);
    rrect(-10, 0, W + 20, 60, 153, '#e2d8c4', 4);
    rrect(175, 360, 250, 90, 154, VIO, 6, 12); txt('БАНК', 300, 425, { size: 64, w: 900, color: INKC, align: 'center', ls: 6 });
    for (const cx of [120, 480, 1440, 1800]) {
      rrect(cx - 50, 230, 100, HZ - 260, 160 + cx, '#f8f5ee', 5); for (let k = -1; k <= 1; k++) rline(cx + k * 22, 250, cx + k * 22, HZ - 40, 161 + cx + k, 2.5, .6);
      rrect(cx - 70, 200, 140, 34, 162 + cx, '#f1ebdf', 5); rrect(cx - 70, HZ - 34, 140, 34, 163 + cx, '#f1ebdf', 5);
    }
    // сейф
    const vx = 1150, vy = 440; rcircle(vx, vy, 210, 180, '#b8bcc4', 7); rcircle(vx, vy, 168, 181, '#cdd1d8', 5);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; rcircle(vx + Math.cos(a) * 188, vy + Math.sin(a) * 188, 9, 182 + i, '#8d929c', 3); }
    const ra = T * .4; for (let i = 0; i < 3; i++) { const a = ra + i * 2.094; rline(vx, vy, vx + Math.cos(a) * 120, vy + Math.sin(a) * 120, 195 + i, 12); rcircle(vx + Math.cos(a) * 120, vy + Math.sin(a) * 120, 16, 198 + i, VIO, 4); }
    rcircle(vx, vy, 40, 201, '#9ea3ad', 5);
    // ограждение
    for (const px of [300, 620]) { rline(px, 980, px, 820, 210 + px, 7); rcircle(px, 815, 14, 211 + px, VIO, 4); }
    g.beginPath(); g.moveTo(300, 830); g.quadraticCurveTo(460, 900, 620, 830); g.strokeStyle = '#c0392b'; g.lineWidth = 12; g.stroke(); inkStroke(3);
  },

  exchange(T) {
    wallFloor('#e4e7ec', '#cfd4dc', 251);
    perspLines(252, 8, 240, .2);
    rrect(-10, 40, W + 20, 70, 253, '#1f2430', 5);
    g.save(); g.beginPath(); g.rect(0, 40, W, 70); g.clip();
    const tape = ['BTC ▲', 'ETH ▼', 'TON ▲', 'SOL ▲', 'USD ▼', 'GOLD ▲', 'SBER ▲', 'GAZP ▼'], step = 240, off = -((T * 80) % (step * tape.length));
    for (let r = 0; r < 2; r++) tape.forEach((s, i) => mono(s, off + (i + r * tape.length) * step, 88, 28, s.includes('▲') ? '#2fbf71' : '#ff5a6e', { w: 700 }));
    g.restore();
    [[200, 700], [760, 1260], [1320, 1820]].forEach(([x0, x1], si) => {
      rrect(x0, 170, x1 - x0, 360, 260 + si, '#1a1d23', 7, 12);
      g.save(); g.beginPath(); g.rect(x0 + 16, 186, x1 - x0 - 32, 328); g.clip();
      g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 1; for (let y = 210; y < 514; y += 40) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
      let pr = .5; const n = 22, cw = (x1 - x0 - 40) / n;
      for (let i = 0; i < n; i++) { const o = pr, c = clamp(pr + (rnd(si * 50 + i) - .45 + (si === 1 ? .08 : 0)) * .16, .1, .9); pr = c; const up = c >= o, xx = x0 + 24 + i * cw, yy = v => 500 - v * 290;
        g.fillStyle = up ? '#2fbf71' : '#ff5a6e'; g.fillRect(xx, Math.min(yy(o), yy(c)), cw * .6, Math.max(3, Math.abs(yy(o) - yy(c)))); g.fillRect(xx + cw * .27, Math.min(yy(o), yy(c)) - 10, 2, Math.abs(yy(o) - yy(c)) + 20); }
      g.restore();
    });
    for (const x0 of [80, 1250]) { rrect(x0, 640, 560, 30, 280 + x0, '#9aa3b0', 5); for (let i = 0; i < 3; i++) rrect(x0 + 40 + i * 180, 560, 130, 80, 281 + x0 + i, '#2a2f38', 4, 6); }
  },

  street(T) {
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#b9defc'); sky.addColorStop(1, '#eef7ff'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    for (let i = 0; i < 4; i++) { const cx = ((i * 520 + T * 14) % (W + 400)) - 200, cy = 110 + (i % 2) * 70; for (const [dx, dy, r] of [[-50, 10, 40], [0, -10, 55], [55, 8, 42]]) rcircle(cx + dx, cy + dy, r, 500 + i * 3 + dx, '#fff', 0); g.beginPath(); roughEllipse(cx, cy + 4, 110, 42, 510 + i, 1); inkStroke(3.5); }
    const cols = ['#f2c9a0', '#cfe0c3', '#f5e6a8', '#d7c8ee', '#f3b8b0', '#bcd9e8'];
    let x = -20;
    for (let i = 0; x < W; i++) {
      const bw = 220 + rnd(520 + i) * 140, bh = 330 + rnd(530 + i) * 250, y0 = HZ - bh;
      rrect(x, y0, bw, bh, 540 + i, cols[i % cols.length], 5);
      for (let wy = y0 + 40; wy < HZ - 140; wy += 80) for (let wx = x + 30; wx < x + bw - 60; wx += 70) rrect(wx, wy, 40, 52, 560 + wx + wy, '#fffdf6', 3);
      if (i % 3 === 1) { rrect(x + bw / 2 - 90, HZ - 200, 180, 50, 570 + i, VIO, 4); txt(['КАФЕ', 'БАНК', 'МАГАЗИН'][i % 3 === 1 ? (i % 2) : 2], x + bw / 2, HZ - 162, { size: 34, w: 900, color: INKC, align: 'center' }); }
      rrect(x + bw / 2 - 40, HZ - 130, 80, 130, 580 + i, '#8a6a4f', 4);
      x += bw;
    }
    g.fillStyle = '#dcd8d0'; g.fillRect(0, HZ, W, H - HZ); rline(-20, HZ, W + 20, HZ, 590, 6); rline(-20, HZ + 30, W + 20, HZ + 30, 591, 3, .5);
    for (let i = -8; i <= 8; i++) rline(CX + i * 160, HZ + 30, CX + i * 320, H + 20, 600 + i, 2, .3);
    rline(1650, 960, 1650, 460, 620, 9); rline(1650, 470, 1740, 470, 621, 7); rrect(1710, 470, 70, 40, 622, '#fff1c2', 4, 8);
    rrect(250, 860, 110, 100, 623, '#d9774f', 5); rcircle(305, 760, 110, 624, '#7cc47f', 5);
  },

  // студия блогера: неоновая вывеска канала, кольцевая лампа, полки с наградами, микрофон на стойке
  studio(T) {
    // четыре варианта студии: тёмно-синяя с панелями, кирпичный лофт, светлая мятная, фиолетовый неон
    const v = (PLAN.episode?.studio ?? 0) % 4, PAL = [['#2b2f4a', '#3a3350', '#3b4166'], ['#7a4234', '#3e2c28', '#8c4c3c'], ['#dcebe5', '#c9b28f', '#cfe2da'], ['#2a1f3d', '#1f1830', '#3a2a55']][v];
    wallFloor(PAL[0], PAL[1], 1101);
    if (v === 1) { g.save(); g.globalAlpha = .5; for (let y = 0; y < HZ; y += 46) for (let x = (y / 46) % 2 ? -60 : 0; x < W; x += 120) { g.fillStyle = (x + y) % 3 ? PAL[2] : '#6d3a2e'; g.fillRect(x + 3, y + 3, 114, 40); } g.restore(); }   // кирпич
    else if (v === 2) { g.save(); g.globalAlpha = .9; for (const [x, y, w, h, c] of [[140, 430, 220, 150, '#f3b8b0'], [400, 470, 160, 110, '#bcd9e8']]) rrect(x, y, w, h, 1130 + x, c, 4, 6); g.restore(); }   // постеры
    else { g.save(); g.globalAlpha = .18; for (let x = 0; x < W; x += 120) { g.fillStyle = x % 240 ? PAL[2] : PAL[0]; g.fillRect(x, 0, 120, HZ); } g.restore(); }   // акустические панели
    // неоновая вывеска с именем канала: трубка с ореолом
    const name = PLAN.lead === 'lion' ? 'ЛЕВ И ЕНОТ' : PLAN.brand?.name || 'ХОМЯК', fl = .85 + .15 * Math.sin(T * 9) * (Math.sin(T * 1.3) > .96 ? 1 : 0);
    g.save(); g.translate(720, 330); g.rotate(-.04);
    g.globalAlpha = .35 * fl; const fz = name.length > 6 ? 80 : 116; txt(name, 0, 0, { size: fz * 1.14, w: 900, color: VIO, align: 'center' }); g.globalAlpha = 1;
    g.font = `900 ${fz}px ${SANS}`; g.textAlign = 'center'; g.lineWidth = 14; g.strokeStyle = VIO; g.globalAlpha = fl; g.strokeText(name, 0, -6); g.lineWidth = 4; g.strokeStyle = '#fffbe6'; g.strokeText(name, 0, -6); g.restore();
    // полка с наградами и растением
    rrect(1150, 300, 520, 22, 1102, '#8a6a4f', 4);
    rrect(1190, 190, 90, 110, 1103, '#e8e2d4', 4, 10); g.beginPath(); g.moveTo(1222, 222); g.lineTo(1222, 268); g.lineTo(1258, 245); g.closePath(); g.fillStyle = '#e8394d'; g.fill();   // «кнопка» за подписчиков
    rrect(1310, 160, 90, 140, 1104, '#f2cf6b', 4, 10); g.beginPath(); g.moveTo(1342, 205); g.lineTo(1342, 255); g.lineTo(1382, 230); g.closePath(); g.fillStyle = '#fff'; g.fill();
    rrect(1440, 230, 80, 70, 1105, '#c9774a', 4, 8); for (let i = 0; i < 5; i++) { g.save(); g.translate(1480, 232); g.rotate(-1.2 + i * .6); g.beginPath(); roughEllipse(0, -50, 16, 50, 1106 + i, 1.2); g.fillStyle = i % 2 ? '#3f9d63' : '#57b87a'; g.fill(); inkStroke(3.5); g.restore(); }
    rrect(1560, 200, 70, 100, 1107, '#8b5cff', 4, 6); rrect(1575, 215, 40, 70, 1108, '#b9a2ff', 3, 4);
    // кольцевая лампа на стойке
    rline(1760, HZ + 170, 1760, 470, 1109, 8); g.beginPath(); g.arc(1760, 380, 120, 0, 6.2832); g.strokeStyle = INKC; g.lineWidth = 34; g.stroke(); g.strokeStyle = '#fffaf0'; g.lineWidth = 24; g.stroke();
    g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createRadialGradient(1760, 380, 60, 1760, 380, 520); lg.addColorStop(0, 'rgba(255,248,225,.35)'); lg.addColorStop(1, 'rgba(255,248,225,0)'); g.fillStyle = lg; g.fillRect(1200, 0, 720, H); g.restore();
    // ковёр и стол со светом
    g.beginPath(); roughEllipse(760, HZ + 230, 520, 70, 1110, 2); g.fillStyle = '#5a4b7a'; g.fill(); inkStroke(4);
  },

  space(T) {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0e1a30'); sky.addColorStop(1, '#253a63'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 140; i++) { const x = rnd(i * 3.3) * W, y = rnd(i * 7.1) * HZ, a = .4 + .6 * Math.abs(Math.sin(T * 1.5 + i)); g.fillStyle = `rgba(255,255,240,${a})`; g.fillRect(x, y, 3, 3); }
    for (let i = 0; i < 8; i++) { const x = rnd(i * 13.3 + 1) * W, y = rnd(i * 5.9 + 2) * 600, s = 10 + 8 * Math.abs(Math.sin(T * 2 + i)); g.save(); g.translate(x, y); g.fillStyle = '#fff6c8'; g.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? s * .25 : s, a = k / 8 * 6.283; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.fill(); g.restore(); }
    rcircle(300, 210, 64, 700, '#5aa9e6', 4); g.beginPath(); roughEllipse(285, 195, 26, 18, 701, 1); g.fillStyle = '#7cc47f'; g.fill();
    rcircle(1260, 400, 300, 702, '#f3ead2', 7);
    for (const [cx, cy, r] of [[1160, 320, 50], [1360, 470, 70], [1250, 560, 34], [1400, 280, 28]]) { g.beginPath(); roughEllipse(cx, cy, r, r * .8, 710 + cx, 1); g.fillStyle = '#e3d7b7'; g.fill(); inkStroke(4); }
    g.beginPath(); g.moveTo(0, HZ + 40); g.quadraticCurveTo(CX, HZ - 30, W, HZ + 40); g.lineTo(W, H); g.lineTo(0, H); g.closePath(); g.fillStyle = '#d8d2c2'; g.fill(); inkStroke(6);
    for (const [cx, cy, rx] of [[300, 900, 120], [1300, 820, 90], [1700, 1000, 140], [900, 1040, 80]]) { g.beginPath(); roughEllipse(cx, cy, rx, rx * .28, 730 + cx, 1.2); g.fillStyle = '#c9c2b0'; g.fill(); inkStroke(4); }
  },
};
function drawLocation(place, T) { (LOCATIONS[place] || LOCATIONS.home)(T); }
