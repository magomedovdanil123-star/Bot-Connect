// Ещё 12 мест: дача, гараж, поезд, горнолыжка, концерт, зоомагазин, цветочный, пекарня, курьеры, яхта мечты, барбершоп, стадион.
Object.assign(LOCATIONS, {
  dacha(T) { // дача: домик, грядки, теплица, лейка, подсолнухи
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#9fd3ff'); sky.addColorStop(1, '#fff3d6'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    rrect(80, 260, 420, 300, 6001, '#e9c46a', 6, 6); g.beginPath(); g.moveTo(50, 270); g.lineTo(290, 110); g.lineTo(530, 270); g.closePath(); g.fillStyle = '#c0392b'; g.fill(); inkStroke(6); rrect(240, 400, 100, 160, 6002, '#8a5f3c', 5, 6); rrect(370, 330, 90, 80, 6003, '#bfe0ff', 4, 4);
    g.fillStyle = '#8ccf7e'; g.fillRect(0, HZ - 160, W, H); rline(-20, HZ - 160, W + 20, HZ - 160, 6004, 5);
    for (let r = 0; r < 3; r++) { rrect(1250, 640 + r * 110, 620, 70, 6010 + r, '#7a5440', 4, 30); for (let k = 0; k < 7; k++) { const x = 1290 + k * 85, y = 640 + r * 110; g.beginPath(); g.moveTo(x, y + 10); g.quadraticCurveTo(x - 20 + Math.sin(T + k) * 4, y - 30, x - 10, y - 46); g.moveTo(x, y + 10); g.quadraticCurveTo(x + 20, y - 30, x + 12, y - 46); g.strokeStyle = '#2f9e44'; g.lineWidth = 7; g.stroke(); } }
    rrect(1350, 260, 420, 260, 6020, 'rgba(210,240,255,.6)', 5, 10); for (let k = 1; k < 4; k++) rline(1350 + k * 105, 260, 1350 + k * 105, 520, 6021 + k, 3, .6);
    for (const x of [620, 700]) { rline(x, HZ - 160, x, 240, 6030 + x, 7); for (let k = 0; k < 10; k++) { const a = k / 10 * 6.2832 + T * .3; g.beginPath(); roughEllipse(x + Math.cos(a) * 46, 230 + Math.sin(a) * 46, 22, 12, 6031 + k, 1); g.fillStyle = '#ffd43b'; g.fill(); inkStroke(2.5); } rcircle(x, 230, 30, 6040 + x, '#6b4a32', 4); }
  },
  garage(T) { // гараж: машина, инструменты на стене, канистра, лампа
    wallFloor('#b9bfc8', '#6c727c', 6101);
    rrect(80, 120, 520, 280, 6102, '#8a6a4f', 5, 6); for (let k = 0; k < 6; k++) { const x = 130 + k * 80; rline(x, 160, x, 320 - (k % 3) * 30, 6103 + k, 7); rcircle(x, 160, 12, 6110 + k, '#5b5f6b', 3); }
    g.beginPath(); g.moveTo(1050, 720); g.lineTo(1080, 560); g.quadraticCurveTo(1200, 440, 1450, 440); g.quadraticCurveTo(1650, 440, 1760, 560); g.lineTo(1840, 600); g.lineTo(1850, 720); g.closePath(); g.fillStyle = '#1c7ed6'; g.fill(); inkStroke(6);
    rrect(1200, 470, 260, 90, 6120, '#bfe0ff', 4, 14); for (const x of [1170, 1700]) { rcircle(x, 720, 70, 6121 + x, '#2b2d42', 6); rcircle(x, 720, 30, 6122 + x, '#adb5bd', 3); }
    rrect(700, 760, 90, 120, 6130, '#e8394d', 5, 10); txt('⛽', 745, 840, { size: 50, w: 900, color: '#fff', align: 'center' });
    rline(CX, 0, CX, 90, 6131, 4); g.beginPath(); g.moveTo(CX - 70, 150); g.quadraticCurveTo(CX, 70, CX + 70, 150); g.closePath(); g.fillStyle = '#2e3440'; g.fill(); inkStroke(5);
  },
  train(T) { // купе поезда: окно с пролетающим пейзажем, полки, чай в подстаканнике
    wallFloor('#d8c7a6', '#8a6a4f', 6201);
    rrect(560, 90, 800, 420, 6202, '#1d2330', 8, 20); g.save(); g.beginPath(); g.roundRect(572, 102, 776, 396, 14); g.clip();
    const sky = g.createLinearGradient(0, 100, 0, 500); sky.addColorStop(0, '#9fd3ff'); sky.addColorStop(1, '#fff3d6'); g.fillStyle = sky; g.fillRect(560, 90, 800, 420);
    for (let k = 0; k < 8; k++) { const x = ((k * 160 - T * 500) % 1000 + 1000) % 1000 + 460; rcircle(x, 420, 60, 6210 + k, '#6ab57d', 3); rline(x, 480, x, 420, 6220 + k, 6); } for (let k = 0; k < 14; k++) { const x = ((k * 70 - T * 1200) % 900 + 900) % 900 + 520; rline(x, 498, x, 470, 6230 + k, 4); }
    g.restore(); rrect(560, 520, 800, 30, 6240, '#a86c3f', 5, 6);
    rrect(40, 180, 440, 60, 6250, '#7a5440', 5, 10); rrect(1440, 180, 440, 60, 6251, '#7a5440', 5, 10); rrect(40, 600, 440, 120, 6252, '#c0392b', 5, 16); rrect(1440, 600, 440, 120, 6253, '#c0392b', 5, 16);
    rrect(880, 460, 60, 60, 6260, '#d9dde4', 4, 6); g.beginPath(); g.arc(940, 490, 16, -1.4, 1.4); inkStroke(4); for (let i = 0; i < 2; i++) { const q = (T * .7 + i / 2) % 1; g.save(); g.globalAlpha = (1 - q) * .7; g.beginPath(); g.moveTo(900 + i * 20, 450 - q * 80); g.quadraticCurveTo(890 + i * 20 + Math.sin(q * 6) * 10, 430 - q * 80, 905 + i * 20, 410 - q * 80); inkStroke(3); g.restore(); }
  },
  ski(T) { // горнолыжка: горы, подъёмник, ёлки в снегу, снегопад
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#74c0fc'); sky.addColorStop(1, '#e7f5ff'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    for (const [x, w, h] of [[300, 700, 480], [1100, 900, 560], [1750, 600, 420]]) { g.beginPath(); g.moveTo(x - w / 2, HZ); g.lineTo(x, HZ - h); g.lineTo(x + w / 2, HZ); g.closePath(); g.fillStyle = '#a5b4c8'; g.fill(); inkStroke(5); g.beginPath(); g.moveTo(x - w * .14, HZ - h * .72); g.lineTo(x, HZ - h); g.lineTo(x + w * .14, HZ - h * .72); g.quadraticCurveTo(x, HZ - h * .66, x - w * .14, HZ - h * .72); g.fillStyle = '#fff'; g.fill(); inkStroke(4); }
    g.fillStyle = '#f8f9fa'; g.fillRect(0, HZ, W, H); rline(-20, HZ, W + 20, HZ, 6301, 5);
    rline(-20, 120, W + 20, 380, 6302, 4); for (let k = 0; k < 3; k++) { const u = ((k / 3 + T * .05) % 1), x = u * W, y = 120 + u * 260; rline(x, y, x, y + 70, 6303 + k, 4); rrect(x - 40, y + 70, 80, 50, 6310 + k, '#e8394d', 4, 8); }
    for (const x of [140, 1500, 1800]) for (let k = 0; k < 3; k++) { const w = 160 - k * 40, y = HZ + 120 - k * 80; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x, y - 110); g.lineTo(x + w / 2, y); g.closePath(); g.fillStyle = '#2f8f5b'; g.fill(); inkStroke(4); g.beginPath(); g.moveTo(x - w / 4, y - 55); g.lineTo(x, y - 110); g.lineTo(x + w / 4, y - 55); g.closePath(); g.fillStyle = '#fff'; g.fill(); }
    for (let i = 0; i < 50; i++) { const y = (rnd(i * 2.1) * H + T * (50 + rnd(i) * 40)) % H, x = rnd(i * 5.3) * W + Math.sin(T + i) * 20; g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 3 + rnd(i * 7) * 3, 0, 6.2832); g.fill(); }
  },
  concert(T) { // концерт: сцена, прожекторы, колонки, толпа рук
    g.fillStyle = '#140d26'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) { const x = 160 + i * 320, a = Math.sin(T * 2 + i) * .4, hue = (T * 90 + i * 60) % 360; g.save(); g.translate(x, -10); g.rotate(a); const lg = g.createLinearGradient(0, 0, 0, 1000); lg.addColorStop(0, `hsla(${hue},90%,65%,.45)`); lg.addColorStop(1, `hsla(${hue},90%,65%,0)`); g.beginPath(); g.moveTo(-20, 0); g.lineTo(20, 0); g.lineTo(200, 1000); g.lineTo(-200, 1000); g.closePath(); g.fillStyle = lg; g.fill(); g.restore(); }
    rrect(-10, 520, W + 20, 60, 6401, '#2b2350', 5); for (const x of [60, 1720]) { rrect(x, 220, 140, 300, 6402 + x, '#1b1a20', 5, 8); for (const y of [300, 430]) { rcircle(x + 70, y, 44, 6403 + x + y, '#3b3f4a', 4); rcircle(x + 70, y, 16 + Math.abs(Math.sin(T * 8)) * 6, 6404 + x + y, '#1b1a20', 3); } }
    txt('ФЕСТИВАЛЬ', CX, 200, { size: 90, w: 900, color: '#ffd43b', align: 'center', glow: 30, glowColor: '#ff6b6b' });
    for (let k = 0; k < 16; k++) { const x = 60 + k * 120, up = Math.abs(Math.sin(T * 3 + k)) * 40; if (x > 560 && x < 1360) continue; g.beginPath(); roughEllipse(x, H - 40, 70, 90, 6420 + k, 1.5); g.fillStyle = '#0b0718'; g.fill(); rline(x + 20, H - 110, x + 40, H - 230 - up, 6430 + k, 14); }
  },
  petshop(T) { // зоомагазин: аквариум с рыбками, корм, клетки, кость-вывеска
    wallFloor('#e3f5e8', '#d6c2a1', 6501);
    rrect(80, 160, 560, 320, 6502, '#a5d8ff', 6, 10); g.save(); g.beginPath(); g.rect(86, 166, 548, 308); g.clip(); for (let k = 0; k < 5; k++) { const x = 120 + ((k * 130 + T * 60 * (k % 2 ? 1 : -1)) % 500 + 500) % 500, y = 240 + k * 45; g.beginPath(); g.ellipse(x, y, 30, 16, 0, 0, 6.2832); g.moveTo(x - 28, y); g.lineTo(x - 50, y - 14); g.lineTo(x - 50, y + 14); g.closePath(); g.fillStyle = ['#ff922b', '#ffd43b', '#ff6b6b'][k % 3]; g.fill(); inkStroke(3); } for (let k = 0; k < 6; k++) { const q = (T * .5 + k / 6) % 1; rcircle(500 + (k % 2) * 30, 460 - q * 280, 6, 6510 + k, '#e7f5ff', 2); } g.restore(); rrect(60, 480, 600, 40, 6511, '#8a6a4f', 5, 6);
    for (let k = 0; k < 4; k++) rrect(1300 + k * 150, 560, 120, 160, 6520 + k, ['#ffd43b', '#ff8fab', '#74c0fc', '#8ce99a'][k], 4, 10);
    g.save(); g.translate(1550, 200); rrect(-200, -60, 400, 120, 6530, '#fff', 6, 60); txt('ЗООМАГАЗИН', 0, 18, { size: 50, w: 900, color: '#2f9e44', align: 'center' }); g.restore();
  },
  flowers(T) { // цветочный: вёдра с букетами, вывеска, витрина
    wallFloor('#fdeef4', '#e6d3c3', 6601);
    rrect(-10, 50, W + 20, 100, 6602, '#d6336c', 5); txt('ЦВЕТЫ 24/7', CX, 122, { size: 60, w: 900, color: '#fff', align: 'center' });
    for (let k = 0; k < 7; k++) { if (k === 3) continue; const x = 140 + k * 270, y = 640; rrect(x - 70, y, 140, 120, 6610 + k, '#adb5bd', 4, 10); for (let f = 0; f < 7; f++) { const fx = x - 60 + f * 20, fy = y - 120 - rnd(f * 3 + k) * 120 + Math.sin(T * 2 + f + k) * 3; rline(fx, y, fx, fy, 6620 + f + k * 10, 4); g.beginPath(); for (let p = 0; p < 5; p++) { const a = p / 5 * 6.2832; g.ellipse(fx + Math.cos(a) * 12, fy + Math.sin(a) * 12, 10, 10, 0, 0, 6.2832); } g.fillStyle = ['#ff6b6b', '#ffd43b', '#f783ac', '#ffffff', '#be4bdb'][(f + k) % 5]; g.fill(); rcircle(fx, fy, 6, 6630 + f + k * 10, '#f08c00', 2); } }
  },
  bakery(T) { // пекарня: витрина с круассанами и тортом, печь, мука
    wallFloor('#fff4e0', '#c9a27a', 6701);
    rrect(80, 400, 760, 320, 6702, '#f1dcc4', 6, 10); rrect(100, 420, 720, 140, 6703, 'rgba(210,240,255,.6)', 4, 8);
    for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(140 + k * 140, 540); g.quadraticCurveTo(180 + k * 140, 470, 220 + k * 140, 540); g.closePath(); g.fillStyle = '#e8a33d'; g.fill(); inkStroke(4); }
    g.beginPath(); g.roundRect(1350, 420, 280, 160, 14); g.fillStyle = '#f783ac'; g.fill(); inkStroke(5); g.beginPath(); g.roundRect(1390, 330, 200, 100, 14); g.fillStyle = '#fff'; g.fill(); inkStroke(5); rcircle(1490, 315, 22, 6710, '#e8394d', 3);
    rrect(1320, 580, 340, 30, 6711, '#a86c3f', 5, 6); rrect(1200, 120, 600, 110, 6712, '#a86c3f', 6, 16); txt('ПЕКАРНЯ', 1500, 198, { size: 60, w: 900, color: '#fff4e0', align: 'center' });
  },
  courier(T) { // вечерняя улица курьеров: самокаты, жёлтые рюкзаки-кубы, фонари
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#2b3a6b'); sky.addColorStop(1, '#f2a07b'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    skyline(0, 260, W, 460, 6801, ['#3b4a7a', '#33406b', '#45558a']);
    g.fillStyle = '#5b5f6b'; g.fillRect(0, HZ, W, H); rline(-20, HZ, W + 20, HZ, 6802, 5); for (let x = 0; x < W; x += 200) rrect(x + ((-T * 300) % 200), 880, 100, 14, 6803 + x, '#f1f3f5', 0);
    for (const x of [160, 1760]) { rline(x, HZ, x, 300, 6810 + x, 8); g.beginPath(); g.arc(x, 300, 30, 0, 6.2832); g.fillStyle = '#fff3bf'; g.fill(); inkStroke(4); g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createRadialGradient(x, 300, 10, x, 300, 300); lg.addColorStop(0, 'rgba(255,230,150,.45)'); lg.addColorStop(1, 'rgba(255,230,150,0)'); g.fillStyle = lg; g.fillRect(x - 300, 0, 600, 700); g.restore(); }
    for (const [x, d] of [[1350, 1], [420, -1]]) { const xx = x + Math.sin(T * .8 + x) * 30; rline(xx - 60, 800, xx + 60, 800, 6820 + x, 8); rcircle(xx - 60, 810, 18, 6821 + x, '#2b2d42', 3); rcircle(xx + 60, 810, 18, 6822 + x, '#2b2d42', 3); rline(xx + 50 * d, 800, xx + 40 * d, 680, 6823 + x, 7); rrect(xx - 50, 690, 100, 90, 6824 + x, '#ffd43b', 5, 8); }
  },
  yacht(T) { // яхта мечты: палуба, море, чайки, флажок «МЕЧТА»
    const sky = g.createLinearGradient(0, 0, 0, 500); sky.addColorStop(0, '#66b8ff'); sky.addColorStop(1, '#e3f4ff'); g.fillStyle = sky; g.fillRect(0, 0, W, 500);
    g.fillStyle = '#1c7ed6'; g.fillRect(0, 480, W, 300); for (let k = 0; k < 5; k++) { g.beginPath(); for (let x = 0; x <= W; x += 40) g.lineTo(x, 510 + k * 50 + Math.sin(x * .02 + T * 2 + k) * 8); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.stroke(); }
    g.fillStyle = '#f1dcc4'; g.fillRect(0, HZ - 20, W, H); for (let x = 0; x < W; x += 120) rline(x, HZ - 20, x - 60, H, 6901 + x, 2.5, .35); rline(-20, HZ - 20, W + 20, HZ - 20, 6902, 6);
    for (let x = 40; x < W; x += 140) rline(x, HZ - 20, x, HZ - 130, 6903 + x, 6); rline(-20, HZ - 130, W + 20, HZ - 130, 6904, 6);
    rline(1620, HZ - 20, 1620, 60, 6910, 12); g.beginPath(); g.moveTo(1620, 80); g.quadraticCurveTo(1760 + Math.sin(T * 3) * 10, 110, 1800, 160); g.lineTo(1620, 200); g.closePath(); g.fillStyle = '#e8394d'; g.fill(); inkStroke(5); txt('МЕЧТА', 1690, 160, { size: 30, w: 900, color: '#fff', align: 'center' });
    for (let i = 0; i < 3; i++) { const bx = ((i * 600 + T * 80) % (W + 200)) - 100, by = 140 + i * 60 + Math.sin(T * 4 + i) * 10; g.beginPath(); g.moveTo(bx - 20, by); g.quadraticCurveTo(bx - 10, by - 12, bx, by); g.quadraticCurveTo(bx + 10, by - 12, bx + 20, by); inkStroke(4); }
  },
  salon(T) { // барбершоп: зеркала с лампами, кресло, полосатый столб
    wallFloor('#2f3b45', '#b08968', 7001);
    for (const x of [140, 1500]) { rrect(x, 120, 300, 380, 7002 + x, '#dbe4ff', 6, 150); for (let k = 0; k < 8; k++) { const a = Math.PI + k / 7 * Math.PI; rcircle(x + 150 + Math.cos(a) * 170, 300 + Math.sin(a) * 200, 12, 7003 + k + x, '#fff3bf', 2); } }
    g.save(); g.beginPath(); g.roundRect(1200, 160, 60, 360, 30); g.clip(); g.fillStyle = '#fff'; g.fillRect(1200, 160, 60, 360); for (let k = -4; k < 12; k++) { const y = 160 + k * 50 + (T * 60) % 50; g.beginPath(); g.moveTo(1200, y); g.lineTo(1260, y - 30); g.lineTo(1260, y - 10); g.lineTo(1200, y + 20); g.closePath(); g.fillStyle = k % 2 ? '#e8394d' : '#1c7ed6'; g.fill(); } g.restore(); g.beginPath(); g.roundRect(1200, 160, 60, 360, 30); inkStroke(5);
    txt('BARBER', 960, 110, { size: 64, w: 900, color: '#ffd43b', align: 'center', glow: 16 });
  },
  stadium(T) { // стадион: трибуны с болельщиками, табло, газон в полоску
    const sky = g.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, '#74c0fc'); sky.addColorStop(1, '#e7f5ff'); g.fillStyle = sky; g.fillRect(0, 0, W, 300);
    g.fillStyle = '#495057'; g.fillRect(0, 220, W, 420); for (let r = 0; r < 6; r++) for (let k = 0; k < 40; k++) { const x = k * 50 + (r % 2) * 25, y = 250 + r * 60, up = Math.sin(T * 6 + k * .7 + r) > .6 ? 10 : 0; rcircle(x, y - up, 14, 7101 + r * 50 + k, ['#e8394d', '#ffd43b', '#1c7ed6', '#fff'][(k + r) % 4], 0); }
    for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#51cf66' : '#40c057'; g.fillRect(k * W / 10, 640, W / 10, H); } rline(-20, 640, W + 20, 640, 7102, 6);
    rrect(760, 40, 400, 150, 7103, '#1b1a20', 6, 10); mono('ХОМЯК 3 : 0 КРОТ', CX, 130, 40, '#ffd43b', { align: 'center', w: 800 });
  },
});
