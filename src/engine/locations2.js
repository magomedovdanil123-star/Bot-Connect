// Ещё 10 мест для историй (комикс-стиль, как locations.js): у каждой темы ролика — свой мир.
// Центр кадра (x 500–1300, низ) оставлен свободнее — там стоит Хомяк.
Object.assign(LOCATIONS, {
  kitchen(T) { // кухня: плитка, шкафчики, холодильник, плита с кастрюлей и паром
    wallFloor('#f3efe2', '#d9c7a8', 2001);
    for (let y = 300; y < HZ; y += 60) for (let x = (y / 60) % 2 ? 0 : 30; x < W; x += 60) { g.fillStyle = 'rgba(160,190,200,.18)'; g.fillRect(x, y, 56, 56); }
    rrect(0, 60, 760, 200, 2002, '#9fc7b8', 5, 10); for (let i = 0; i < 4; i++) { rrect(10 + i * 186, 72, 176, 176, 2003 + i, '#b4d6c9', 3, 8); rcircle(150 + i * 186, 160, 8, 2010 + i, INKC, 0); }
    rrect(0, 520, 700, 200, 2020, '#9fc7b8', 5, 8); rrect(-10, 500, 720, 32, 2021, '#e9e2d4', 4, 6);
    rrect(380, 430, 220, 70, 2022, '#3b4252', 4, 8); rcircle(440, 470, 18, 2023, '#e8394d', 3); rcircle(540, 470, 18, 2024, '#e8394d', 3);
    rrect(410, 360, 160, 80, 2025, '#c0c6cf', 4, 10); for (let i = 0; i < 3; i++) { const q = (T * .5 + i / 3) % 1; g.save(); g.globalAlpha = (1 - q) * .7; g.beginPath(); roughEllipse(450 + i * 40, 340 - q * 140, 18 + q * 20, 14 + q * 16, 2030 + i, 1); g.fillStyle = '#fff'; g.fill(); inkStroke(3); g.restore(); }
    rrect(1480, 140, 300, 600, 2040, '#e9eef2', 6, 18); rline(1480, 400, 1780, 400, 2041, 5); rline(1740, 220, 1740, 340, 2042, 8); rline(1740, 450, 1740, 600, 2043, 8);
    for (const [x, y, c] of [[1520, 190, '#f2c14e'], [1580, 200, '#e85d4a'], [1640, 186, '#5cb85c']]) rrect(x, y, 40, 44, 2050 + x, c, 3, 6);
    rrect(1180, 180, 180, 180, 2060, '#fff8e8', 5, 90); g.beginPath(); g.moveTo(1270, 270); g.lineTo(1270, 210); g.moveTo(1270, 270); g.lineTo(1270 + Math.cos(T) * 50, 270 + Math.sin(T) * 50); inkStroke(5);
  },
  bedroom(T) { // спальня: кровать, тумбочка с будильником, ночник, звёзды за окном
    wallFloor('#d9d3ee', '#b9a58c', 2101);
    g.save(); g.globalAlpha = .25; for (let x = 40; x < W; x += 140) for (let y = 40; y < HZ - 40; y += 140) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x + (y % 280 ? 70 : 0), y, 6, 0, 6.2832); g.fill(); } g.restore();
    rrect(1220, 120, 420, 320, 2102, '#2c3560', 6, 8); for (let i = 0; i < 18; i++) { const a = .4 + .6 * Math.abs(Math.sin(T * 1.7 + i)); g.fillStyle = `rgba(255,250,220,${a})`; g.fillRect(1240 + rnd(i * 3.1) * 380, 140 + rnd(i * 5.7) * 280, 4, 4); } rcircle(1560, 200, 40, 2103, '#fff3c4', 3);
    rrect(1200, 100, 460, 360, 2104, null, 6, 10); rline(1430, 110, 1430, 450, 2105, 8);
    rrect(60, 560, 120, 330, 2110, '#8a6a4f', 5, 10); rrect(40, 700, 640, 130, 2111, '#f4f0e8', 5, 26); rrect(40, 650, 230, 90, 2112, '#ffffff', 4, 30); rrect(250, 690, 440, 160, 2113, '#8b5cff', 5, 24);
    for (let i = 0; i < 4; i++) rline(290 + i * 100, 700, 270 + i * 100, 840, 2114 + i, 3, .35); rrect(40, 840, 660, 40, 2118, '#8a6a4f', 5, 8);
    rrect(720, 660, 150, 160, 2120, '#c98b5a', 5, 8); rrect(740, 590, 110, 76, 2121, '#e8394d', 4, 18); mono('07:00', 795, 638, 26, '#fff', { align: 'center', w: 800 });
    const sh = Math.sin(T * 30) * (Math.sin(T * 1.3) > .6 ? 4 : 0); rcircle(770 + sh, 585, 14, 2122, GOLD, 3); rcircle(820 + sh, 585, 14, 2123, GOLD, 3);
  },
  cafe(T) { // кафе: кирпич, меню на доске, стойка с кофемашиной, лампы, чашка с паром
    wallFloor('#c9744f', '#7a5440', 2201);
    g.save(); g.globalAlpha = .28; for (let y = 0; y < HZ; y += 44) for (let x = (y / 44) % 2 ? -50 : 0; x < W; x += 100) { g.strokeStyle = '#5a2e1d'; g.lineWidth = 3; g.strokeRect(x, y, 100, 44); } g.restore();
    rrect(120, 110, 520, 360, 2202, '#2e3a32', 8, 10); txt('МЕНЮ', 380, 180, { size: 52, w: 900, color: '#f6f1e6', align: 'center' });
    [['Латте', '250'], ['Капучино', '230'], ['Круассан', '180']].forEach(([n, p], i) => { mono(n, 170, 250 + i * 60, 28, '#f6f1e6', { w: 700 }); mono(p + ' ₽', 590, 250 + i * 60, 28, GOLD, { align: 'right', w: 800 }); });
    for (const x of [820, 1180, 1540]) { rline(x, 0, x, 160, 2210 + x, 4); g.beginPath(); g.moveTo(x - 70, 230); g.quadraticCurveTo(x, 130, x + 70, 230); g.closePath(); g.fillStyle = '#2e3440'; g.fill(); inkStroke(5); g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createRadialGradient(x, 240, 10, x, 260, 260); lg.addColorStop(0, 'rgba(255,220,150,.45)'); lg.addColorStop(1, 'rgba(255,220,150,0)'); g.fillStyle = lg; g.fillRect(x - 260, 220, 520, 400); g.restore(); }
    rrect(1300, 500, 620, 260, 2220, '#5a3a2a', 6, 10); rrect(1280, 480, 660, 36, 2221, '#d9b48a', 5, 8);
    rrect(1440, 330, 200, 160, 2222, '#c0c6cf', 5, 16); rrect(1470, 360, 140, 50, 2223, '#2e3440', 3, 8); rcircle(1540, 455, 22, 2224, '#2e3440', 3);
    rrect(1720, 430, 70, 56, 2225, '#fff', 4, 10); for (let i = 0; i < 2; i++) { const q = (T * .7 + i / 2) % 1; g.save(); g.globalAlpha = (1 - q) * .8; g.beginPath(); g.moveTo(1745 + i * 20, 420 - q * 90); g.quadraticCurveTo(1730 + i * 20 + Math.sin(q * 6) * 14, 380 - q * 90, 1750 + i * 20, 350 - q * 90); inkStroke(4); g.restore(); }
  },
  metro(T) { // вагон метро: окна с пролетающим тоннелем, поручни, сиденья
    wallFloor('#e8ecef', '#9aa3ad', 2301);
    rrect(-10, 60, W + 20, 70, 2302, '#d64545', 5); mono('ЛИНИЯ 1  ·  СЛЕДУЮЩАЯ: «ЗАРПЛАТНАЯ»', CX, 106, 30, '#fff', { align: 'center', w: 800 });
    for (let i = 0; i < 4; i++) { const x = 60 + i * 470; rrect(x, 180, 400, 260, 2310 + i, '#1d2330', 6, 30); g.save(); g.beginPath(); g.roundRect(x + 6, 186, 388, 248, 26); g.clip(); for (let k = 0; k < 6; k++) { const lx = ((k * 140 - T * 900) % 840 + 840) % 840 - 220 + x; g.fillStyle = 'rgba(255,214,120,.8)'; g.fillRect(lx, 300, 90, 8); } g.restore(); }
    rline(0, 520, W, 520, 2320, 9); for (let x = 100; x < W; x += 260) { rline(x, 520, x, 600, 2321 + x, 4); g.beginPath(); roughEllipse(x, 620, 18, 26, 2330 + x, 1); inkStroke(5); }
    rrect(-10, 660, 520, 70, 2340, '#3a7bd5', 5, 16); rrect(1420, 660, 520, 70, 2341, '#3a7bd5', 5, 16);
    g.save(); g.translate(Math.sin(T * 9) * 1.5, 0); rline(0, 905, W, 905, 2350, 3, .35); g.restore();
  },
  park(T) { // парк: небо, деревья, скамейка, фонарь, дорожка
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#9fd3ff'); sky.addColorStop(1, '#e8f6ff'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    g.fillStyle = '#8ccf7e'; g.fillRect(0, HZ - 40, W, H); rline(-20, HZ - 40, W + 20, HZ - 40, 2401, 5);
    g.beginPath(); g.moveTo(CX - 200, H); g.quadraticCurveTo(CX - 40, HZ + 40, CX + 60, HZ - 40); g.lineTo(CX + 160, HZ - 40); g.quadraticCurveTo(CX + 120, HZ + 60, CX + 400, H); g.closePath(); g.fillStyle = '#e6d6b8'; g.fill(); inkStroke(5);
    for (const [x, s] of [[160, 1.2], [420, .9], [1500, 1.1], [1780, 1.3]]) { rrect(x - 22 * s, HZ - 260 * s, 44 * s, 260 * s, 2410 + x, '#8a6a4f', 5); const sw = Math.sin(T * 1.2 + x) * 6; for (const [dx, dy, r] of [[0, -320, 130], [-90, -250, 100], [90, -250, 100], [0, -200, 110]]) rcircle(x + dx * s + sw, HZ + dy * s, r * s, 2420 + x + dx, '#4fa35f', 5); }
    rrect(1180, 780, 300, 40, 2440, '#c98b5a', 5, 8); rrect(1180, 730, 300, 26, 2441, '#c98b5a', 4, 8); rline(1200, 820, 1200, 880, 2442, 6); rline(1460, 820, 1460, 880, 2443, 6);
    rline(1650, HZ + 20, 1650, 330, 2450, 8); rrect(1615, 290, 70, 50, 2451, '#fff1c2', 4, 10);
    for (let i = 0; i < 3; i++) { const bx = ((i * 700 + T * 60) % (W + 200)) - 100, by = 160 + i * 50 + Math.sin(T * 4 + i) * 10; g.beginPath(); g.moveTo(bx - 16, by); g.quadraticCurveTo(bx - 8, by - 10, bx, by); g.quadraticCurveTo(bx + 8, by - 10, bx + 16, by); inkStroke(3.5); }
  },
  mall(T) { // торговый центр: витрины, вывески брендов, пакеты, эскалатор
    wallFloor('#f4f1fa', '#dcd6e6', 2501);
    rrect(-10, 40, W + 20, 90, 2502, '#ffffff', 4); txt('ТЦ «ГАЛЕРЕЯ»', CX, 104, { size: 54, w: 900, color: VIO, align: 'center' });
    [['SALE', '#e8394d', 60], ['ОБУВЬ', '#3a7bd5', 560], ['ТЕХНИКА', '#2fbf71', 1360]].forEach(([n, c, x]) => { rrect(x, 170, 460, 70, 2510 + x, c, 5, 10); txt(n, x + 230, 222, { size: 44, w: 900, color: '#fff', align: 'center' }); rrect(x, 240, 460, 440, 2520 + x, '#e8f4fb', 5); for (let k = 0; k < 3; k++) rrect(x + 40 + k * 140, 520 - k * 40, 100, 120 + k * 40, 2530 + x + k, ['#ffd43b', '#ff8fab', '#9b6bd6'][k], 4, 8); });
    g.beginPath(); g.moveTo(1100, HZ); g.lineTo(1300, 300); g.lineTo(1360, 300); g.lineTo(1160, HZ); g.closePath(); g.fillStyle = '#b8c2cc'; g.fill(); inkStroke(5);
    for (let k = 0; k < 8; k++) { const q = (k / 8 + T * .15) % 1; rline(1110 + q * 200, HZ - q * 420, 1170 + q * 200, HZ - q * 420, 2540 + k, 3, .6); }
    for (const [x, c] of [[300, '#ff8fab'], [1600, '#ffd43b']]) { rrect(x, 850, 90, 110, 2550 + x, c, 5, 8); g.beginPath(); g.arc(x + 45, 850, 26, Math.PI, 0); inkStroke(5); }
  },
  cowork(T) { // коворкинг: ноутбуки, стикеры на стене, неоновая надпись, растения
    wallFloor('#e9efe8', '#c9b28f', 2601);
    txt('РАБОТАЙ НА СЕБЯ', CX, 150, { size: 64, w: 900, color: '#2fbf71', align: 'center', glow: 18 });
    for (let i = 0; i < 9; i++) { const x = 160 + (i % 3) * 120, y = 240 + Math.floor(i / 3) * 110; g.save(); g.translate(x, y); g.rotate((rnd(i * 3.3) - .5) * .2); rrect(-45, -40, 90, 80, 2610 + i, ['#ffd43b', '#ff8fab', '#8ce99a', '#74c0fc'][i % 4], 3); rline(-30, -10, 30, -10, 2620 + i, 2, .5); rline(-30, 10, 20, 10, 2630 + i, 2, .5); g.restore(); }
    rrect(1250, 520, 680, 30, 2640, '#c98b5a', 5, 8); rrect(1290, 550, 26, 170, 2641, '#a86c3f', 4); rrect(1860, 550, 26, 170, 2642, '#a86c3f', 4);
    for (const x of [1400, 1700]) { rrect(x - 110, 380, 220, 140, 2650 + x, '#2e3440', 5, 10); rrect(x - 96, 394, 192, 112, 2660 + x, '#e9f5ff', 2, 6); poly([[x - 80, 480], [x - 40, 450], [x, 466], [x + 70, 410]], 1, { color: '#2fbf71', lw: 5 }); }
    rrect(1000, 360, 70, 70, 2670, '#c9774a', 4, 8); for (let i = 0; i < 5; i++) { g.save(); g.translate(1035, 362); g.rotate(-1.2 + i * .6 + Math.sin(T + i) * .05); g.beginPath(); roughEllipse(0, -60, 18, 60, 2680 + i, 1.2); g.fillStyle = i % 2 ? '#3f9d63' : '#57b87a'; g.fill(); inkStroke(3.5); g.restore(); }
  },
  beach(T) { // пляж мечты: солнце, море с волнами, пальма, шезлонг, зонтик
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#7cc8ff'); sky.addColorStop(1, '#fff1cf'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    rcircle(1500, 200, 110, 2701, '#ffd43b', 5); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832 + T * .2; rline(1500 + Math.cos(a) * 140, 200 + Math.sin(a) * 140, 1500 + Math.cos(a) * 190, 200 + Math.sin(a) * 190, 2710 + i, 5); }
    g.fillStyle = '#3aa6d9'; g.fillRect(0, 460, W, 200); for (let k = 0; k < 4; k++) { g.beginPath(); for (let x = 0; x <= W; x += 40) g.lineTo(x, 490 + k * 44 + Math.sin(x * .02 + T * 2 + k) * 8); inkStroke(3); }
    g.fillStyle = '#f2d9a6'; g.fillRect(0, 640, W, H); g.beginPath(); for (let x = 0; x <= W; x += 40) g.lineTo(x, 650 + Math.sin(x * .015 + T * 1.5) * 10); inkStroke(5);
    g.beginPath(); g.moveTo(240, H); g.quadraticCurveTo(300, 600, 230, 260); inkStroke(30); g.beginPath(); g.moveTo(240, H); g.quadraticCurveTo(300, 600, 230, 260); g.strokeStyle = '#a8754a'; g.lineWidth = 20; g.stroke();
    for (let i = 0; i < 6; i++) { const a = -2.8 + i * .55 + Math.sin(T * 1.4 + i) * .05; g.save(); g.translate(230, 260); g.rotate(a); g.beginPath(); roughEllipse(110, 0, 120, 26, 2720 + i, 1.4); g.fillStyle = '#3f9d63'; g.fill(); inkStroke(4); g.restore(); }
    g.beginPath(); g.moveTo(1500, 700); g.quadraticCurveTo(1640, 560, 1780, 700); g.closePath(); g.fillStyle = '#e8394d'; g.fill(); inkStroke(5); rline(1640, 600, 1640, 900, 2730, 6);
    rrect(1320, 830, 280, 30, 2731, '#ffffff', 4, 8); rline(1330, 860, 1360, 930, 2732, 5); rline(1590, 860, 1560, 930, 2733, 5);
  },
  treasury(T) { // сокровищница: горы монет, сундук, слитки, блеск
    const bg = g.createRadialGradient(CX, 400, 100, CX, 400, 1200); bg.addColorStop(0, '#4a3a2a'); bg.addColorStop(1, '#1f1712'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let x = 0; x < W; x += 160) rline(x, 0, x, HZ, 2801 + x, 3, .25); rline(-20, HZ, W + 20, HZ, 2802, 5);
    for (const [cx, w, h] of [[220, 480, 300], [1720, 520, 340], [980, 380, 160]]) { g.beginPath(); g.moveTo(cx - w / 2, H); g.quadraticCurveTo(cx, H - h * 2.2, cx + w / 2, H); g.closePath(); g.fillStyle = '#e0a82e'; g.fill(); inkStroke(6); for (let k = 0; k < 14; k++) { const x = cx + (rnd(k * 3.7 + cx) - .5) * w * .8, y = H - rnd(k * 1.9 + cx) * h * .9; rubCoin(x, y, 18, k + T * .5); } }
    rrect(1380, 560, 300, 200, 2810, '#8a5a2b', 6, 14); rrect(1370, 500, 320, 90, 2811, '#a86c3f', 6, 40); rrect(1505, 560, 50, 60, 2812, GOLD, 4, 6);
    for (let k = 0; k < 3; k++) rrect(420 + k * 70, 640 - k * 30, 120, 50, 2820 + k, '#ffd43b', 4, 6);
    for (let i = 0; i < 10; i++) { const a = Math.abs(Math.sin(T * 2.3 + i * 1.7)), x = rnd(i * 5.1) * W, y = 300 + rnd(i * 2.3) * 600; g.save(); g.globalAlpha = a; g.translate(x, y); g.fillStyle = '#fff6c8'; g.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? 4 : 16, an = k / 8 * 6.2832; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.fill(); g.restore(); }
  },
  roof(T) { // ночная крыша: огни города, луна, антенна, гирлянда
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#141c3a'); sky.addColorStop(1, '#3b3a6b'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    for (let i = 0; i < 60; i++) { const a = .3 + .7 * Math.abs(Math.sin(T * 1.3 + i)); g.fillStyle = `rgba(255,255,230,${a})`; g.fillRect(rnd(i * 4.3) * W, rnd(i * 2.9) * 380, 3, 3); }
    rcircle(1560, 170, 70, 2901, '#fff3c4', 4); g.beginPath(); roughEllipse(1585, 150, 16, 12, 2902, 1); g.fillStyle = '#efe0a8'; g.fill();
    let x = -20; for (let i = 0; x < W; i++) { const bw = 120 + rnd(2910 + i) * 140, bh = 160 + rnd(2920 + i) * 300; rrect(x, HZ - bh, bw, bh, 2930 + i, '#232a4d', 4); for (let wy = HZ - bh + 20; wy < HZ - 20; wy += 34) for (let wx = x + 14; wx < x + bw - 20; wx += 28) if (rnd(wx * 1.3 + wy) > .45) { g.fillStyle = `rgba(255,214,120,${.6 + .4 * Math.sin(T + wx)})`; g.fillRect(wx, wy, 12, 16); } x += bw; }
    g.fillStyle = '#4a4f63'; g.fillRect(0, HZ, W, H - HZ); rline(-20, HZ, W + 20, HZ, 2940, 6); rrect(-10, HZ - 40, W + 20, 40, 2941, '#5d6378', 5);
    rline(300, HZ - 40, 300, 380, 2950, 7); rline(250, 420, 350, 420, 2951, 5); rline(270, 460, 330, 460, 2952, 5);
    g.beginPath(); g.moveTo(0, 250); g.quadraticCurveTo(CX, 380, W, 250); inkStroke(3); for (let i = 0; i < 16; i++) { const u = i / 15, lx = u * W, ly = 250 + Math.sin(u * Math.PI) * 130 * .97; rcircle(lx, ly + 14, 10, 2960 + i, ['#ffd43b', '#ff8fab', '#74c0fc', '#8ce99a'][i % 4], 2); }
  },
});
