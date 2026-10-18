// Миры «Хомяк и Крот»: ещё 16 мест + вариации. Каждое место в каждом ролике выглядит по-своему:
// цвет стен и пола, узор обоев, гирлянды/флажки, сезон (снег, листопад, лепестки) и погода — от seed ролика и даты.
// Центр кадра (x 500–1300, низ) свободнее — там стоят герои.
Object.assign(LOCATIONS, {
  burrow(T) { // нора Крота: земляные стены, корни, круглые ходы, фонарь, полка с банками
    const bg = g.createRadialGradient(CX, 380, 80, CX, 420, 1150); bg.addColorStop(0, '#a7774f'); bg.addColorStop(1, '#4b3222'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(40,24,14,.25)'; g.beginPath(); roughEllipse(rnd(i * 3.1) * W, rnd(i * 7.3) * HZ, 8 + rnd(i) * 14, 6 + rnd(i * 2) * 8, 3000 + i, 1); g.fill(); }
    for (const [x, len] of [[180, 220], [520, 140], [1380, 260], [1760, 170], [960, 90]]) { g.beginPath(); g.moveTo(x, -10); g.bezierCurveTo(x + 40, len * .4, x - 30, len * .7, x + 10 + Math.sin(T + x) * 6, len); inkStroke(6); g.strokeStyle = '#7a5236'; g.lineWidth = 4; g.stroke(); }
    for (const [x, y, r] of [[230, 430, 150], [1700, 400, 130]]) { g.beginPath(); roughEllipse(x, y, r, r * .8, 3050 + x, 1.5); g.fillStyle = '#2a1a10'; g.fill(); inkStroke(6); g.beginPath(); roughEllipse(x, y + 10, r * .7, r * .5, 3060 + x, 1); g.fillStyle = '#1a0f08'; g.fill(); }
    g.fillStyle = '#6b4a32'; g.fillRect(0, HZ, W, H - HZ); rline(-20, HZ, W + 20, HZ, 3070, 5); for (let i = 0; i < 18; i++) rcircle(rnd(i * 4.4) * W, HZ + 30 + rnd(i * 1.7) * 300, 8 + rnd(i) * 10, 3080 + i, '#8d6a4e', 3);
    rrect(1240, 170, 330, 26, 3090, '#a8754a', 4, 6); for (let i = 0; i < 4; i++) { rrect(1265 + i * 75, 100, 52, 70, 3091 + i, ['#ffd43b', '#8ce99a', '#ff8fab', '#74c0fc'][i], 3, 10); rrect(1270 + i * 75, 92, 42, 14, 3095 + i, '#c98b5a', 3, 4); }
    rrect(600, 120, 300, 70, 3100, '#c98b5a', 5, 10); txt('НОРА КРОТА', 750, 168, { size: 36, w: 900, color: INKC, align: 'center' });
    const fl = .75 + .25 * Math.sin(T * 7) * Math.sin(T * 3.1); rline(1080, 0, 1080, 230, 3110, 4); rrect(1050, 230, 60, 80, 3111, '#2e3440', 4, 10);
    g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createRadialGradient(1080, 270, 10, 1080, 270, 420); lg.addColorStop(0, `rgba(255,200,110,${.55 * fl})`); lg.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = lg; g.fillRect(600, -100, 1000, 900); g.restore();
    rcircle(1080, 270, 18, 3112, '#ffd27a', 3);
  },
  forest(T) { // лес Белки: деревья, большое дерево с дуплом и орехами, грибы, листья
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#b6e3c8'); sky.addColorStop(1, '#eef8e6'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    for (let i = 0; i < 9; i++) { const x = i * 230 + 40, s = .6 + rnd(i * 2.2) * .4; rrect(x, HZ - 380 * s, 34 * s, 380 * s, 3200 + i, '#9a7a5c', 3); rcircle(x + 17 * s, HZ - 400 * s, 110 * s, 3210 + i, i % 2 ? '#7cc48c' : '#6ab57d', 3); }
    g.fillStyle = '#7dbf6e'; g.fillRect(0, HZ - 30, W, H); rline(-20, HZ - 30, W + 20, HZ - 30, 3220, 5);
    const bx = 1560; rrect(bx - 90, 40, 180, HZ - 10, 3230, '#8a5f3c', 6, 30); for (let k = 0; k < 6; k++) rline(bx - 60 + k * 22, 80 + k * 60, bx - 50 + k * 22, 200 + k * 60, 3231 + k, 2.5, .4);
    g.beginPath(); roughEllipse(bx, 330, 56, 72, 3240, 1.2); g.fillStyle = '#2e1d10'; g.fill(); inkStroke(6); for (let k = 0; k < 5; k++) { g.beginPath(); roughEllipse(bx - 26 + (k % 3) * 24, 370 - Math.floor(k / 3) * 22, 15, 12, 3241 + k, 1); g.fillStyle = '#c98b3a'; g.fill(); inkStroke(3); }
    for (const [cx, r] of [[bx - 200, 160], [bx + 120, 180], [bx - 40, 210]]) rcircle(cx, 60, r, 3250 + cx, '#4fa35f', 5);
    for (const [x, c] of [[300, '#e8394d'], [430, '#e8394d'], [1200, '#f2a900']]) { rrect(x - 8, 820, 16, 40, 3260 + x, '#fff1e0', 3); g.beginPath(); g.arc(x, 822, 34, Math.PI, 0); g.closePath(); g.fillStyle = c; g.fill(); inkStroke(4); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 12, 806, 6, 0, 6.2832); g.arc(x + 10, 800, 5, 0, 6.2832); g.fill(); }
  },
  library(T) { // библиотека Совы: шкафы с книгами, круглое окно с луной, глобус, свечи
    wallFloor('#5b4636', '#7a5a40', 3301);
    for (const x0 of [0, 1500]) { rrect(x0 + 10, 60, 410, HZ - 40, 3302 + x0, '#6b4a2f', 6, 6); for (let r = 0; r < 5; r++) { rline(x0 + 20, 180 + r * 120, x0 + 410, 180 + r * 120, 3310 + r + x0, 5); let x = x0 + 30; for (let k = 0; x < x0 + 395; k++) { const bw = 18 + rnd(k * 3.3 + r + x0) * 22, bh = 70 + rnd(k * 1.1 + r) * 30; rrect(x, 178 + r * 120 - bh, bw, bh, 3320 + k + r * 40 + x0, ['#c0392b', '#2e86de', '#27ae60', '#f39c12', '#8e44ad', '#e8e2d0'][k % 6], 2.5); x += bw + 3; } } }
    rcircle(CX, 230, 150, 3400, '#1f2a4d', 7); for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(255,255,230,${.4 + .6 * Math.abs(Math.sin(T + i))})`; g.fillRect(CX - 110 + rnd(i * 5.1) * 220, 120 + rnd(i * 3.3) * 200, 3, 3); } rcircle(CX + 50, 190, 40, 3401, '#fff3c4', 3);
    rline(CX - 150, 230, CX + 150, 230, 3402, 6); rline(CX, 80, CX, 380, 3403, 6);
    txt('БИБЛИОТЕКА СОВЫ', CX, 450, { size: 40, w: 900, color: '#f3e6cf', align: 'center' });
    rcircle(1340, 560, 70, 3410, '#74c0fc', 5); g.beginPath(); roughEllipse(1320, 545, 30, 22, 3411, 1); g.fillStyle = '#8ce99a'; g.fill(); rline(1340, 630, 1340, 700, 3412, 6); rrect(1290, 700, 100, 20, 3413, '#c98b5a', 4, 6);
    for (const x of [560, 620]) { rrect(x - 10, 640, 20, 70, 3420 + x, '#fff6e0', 3, 4); const f = Math.sin(T * 9 + x) * 3; g.beginPath(); g.moveTo(x - 8, 638); g.quadraticCurveTo(x + f, 590, x + 8, 638); g.fillStyle = '#ffb02e'; g.fill(); inkStroke(3); }
  },
  gym(T) { // спортзал: зеркала, стойка с гантелями, гири, плакат
    wallFloor('#cfd9e3', '#3f4652', 3501);
    rrect(80, 80, 760, 520, 3502, '#e6f0f7', 6, 6); for (let k = 0; k < 3; k++) rline(160 + k * 220, 120, 260 + k * 220, 560, 3503 + k, 6, .25);
    rrect(1300, 120, 420, 120, 3510, '#e8394d', 6, 12); txt('КАЧАЙ КОПИЛКУ', 1510, 198, { size: 46, w: 900, color: '#fff', align: 'center' });
    rrect(1250, 470, 600, 26, 3520, '#2e3440', 5, 6); rrect(1250, 600, 600, 26, 3521, '#2e3440', 5, 6); rline(1270, 496, 1270, 720, 3522, 7); rline(1830, 496, 1830, 720, 3523, 7);
    for (let i = 0; i < 5; i++) { const x = 1310 + i * 115; for (const y of [470, 600]) { rrect(x - 40, y - 34, 18, 34, 3530 + i + y, '#1d2330', 3, 4); rrect(x + 22, y - 34, 18, 34, 3540 + i + y, '#1d2330', 3, 4); rline(x - 22, y - 17, x + 22, y - 17, 3550 + i + y, 6); } }
    for (const [x, c] of [[300, '#ffd43b'], [430, '#74c0fc']]) { g.beginPath(); g.arc(x, 880, 55, 0, 6.2832); g.fillStyle = c; g.fill(); inkStroke(5); g.beginPath(); g.arc(x, 815, 30, Math.PI, 0); inkStroke(10); }
    for (let x = 0; x < W; x += 160) rline(x, HZ, x - 120, H, 3560 + x, 2.5, .3);
  },
  pizzeria(T) { // пиццерия: шахматная плитка, печь с огнём, пицца на стойке, вывеска
    wallFloor('#f6efe3', '#c95a4a', 3601);
    for (let x = 0; x < W; x += 60) for (let y = HZ - 180; y < HZ; y += 60) { if (((x + y) / 60) % 2 < 1) { g.fillStyle = '#e8394d'; g.fillRect(x, y, 60, 60); } }
    rline(-20, HZ - 180, W + 20, HZ - 180, 3602, 5);
    rrect(1260, 140, 560, 420, 3610, '#b85c3c', 7, 30); g.beginPath(); g.arc(1540, 470, 170, Math.PI, 0); g.closePath(); g.fillStyle = '#2a1a12'; g.fill(); inkStroke(6);
    for (let i = 0; i < 5; i++) { const h = 70 + 50 * Math.abs(Math.sin(T * 6 + i * 1.3)); g.beginPath(); g.moveTo(1440 + i * 50, 470); g.quadraticCurveTo(1450 + i * 50 + Math.sin(T * 8 + i) * 10, 470 - h, 1470 + i * 50, 470); g.fillStyle = i % 2 ? '#ffb02e' : '#ff6b35'; g.fill(); }
    g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createRadialGradient(1540, 430, 20, 1540, 430, 500); lg.addColorStop(0, 'rgba(255,150,60,.35)'); lg.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = lg; g.fillRect(900, 0, 1020, 1000); g.restore();
    rrect(120, 90, 640, 110, 3620, '#2e7d4f', 6, 16); txt('ПИЦЦА 24/7', 440, 168, { size: 60, w: 900, color: '#fff', align: 'center' });
    rrect(100, 470, 620, 40, 3630, '#d9b48a', 5, 8); g.beginPath(); roughEllipse(400, 455, 150, 40, 3631, 1.2); g.fillStyle = '#f2c14e'; g.fill(); inkStroke(5); for (let k = 0; k < 7; k++) rcircle(300 + rnd(k * 2.3) * 200, 445 + rnd(k * 5.1) * 25, 13, 3640 + k, '#d6453d', 2.5);
  },
  airport(T) { // аэропорт: панорамные окна с самолётом, табло вылетов, чемодан
    wallFloor('#e9eef3', '#b9c2cc', 3701);
    rrect(40, 60, 1840, 420, 3702, null, 0); const sky = g.createLinearGradient(0, 60, 0, 480); sky.addColorStop(0, '#8ec9ff'); sky.addColorStop(1, '#e8f4ff'); g.fillStyle = sky; g.fillRect(40, 60, 1840, 420);
    const px = ((T * 220) % 2600) - 400; g.save(); g.translate(px, 230 - ((T * 220) % 2600) * .05); g.rotate(-.08); rrect(0, 0, 260, 46, 3703, '#fff', 4, 23); g.beginPath(); g.moveTo(90, 23); g.lineTo(150, 23); g.lineTo(100, 100); g.closePath(); g.fillStyle = '#dfe7ef'; g.fill(); inkStroke(4); g.beginPath(); g.moveTo(20, 10); g.lineTo(0, -40); g.lineTo(40, 6); g.closePath(); g.fill(); inkStroke(4); g.restore();
    for (let x = 40; x <= 1880; x += 307) rline(x, 60, x, 480, 3704 + x, 8); rline(40, 480, 1880, 480, 3705, 8);
    rrect(600, 520, 720, 180, 3710, '#1d2330', 6, 10); [['СОЧИ', '10:40', 'ПОСАДКА', '#8ce99a'], ['МОРЕ', '12:15', 'ПО ГРАФИКУ', '#ffd43b'], ['МЕЧТА', '—', 'КОПИМ…', '#ff8fab']].forEach(([a, b, c, col], i) => { mono(a, 640, 570 + i * 50, 30, '#fff', { w: 800 }); mono(b, 900, 570 + i * 50, 30, '#fff', { w: 800 }); mono(c, 1290, 570 + i * 50, 30, col, { align: 'right', w: 800 }); });
    rrect(1640, 760, 150, 200, 3720, '#e8394d', 5, 18); rrect(1680, 720, 70, 44, 3721, null, 6, 10); for (const x of [1665, 1765]) rcircle(x, 965, 14, 3722 + x, '#2e3440', 3);
  },
  school(T) { // школа: доска с примером в рублях, парты, глобус, часы
    wallFloor('#f2e9c9', '#b48a5f', 3801);
    rrect(420, 90, 1080, 420, 3802, '#2f5d4a', 10, 10); rrect(400, 500, 1120, 28, 3803, '#a86c3f', 5, 6);
    g.save(); g.globalAlpha = .9; txt('500 × 12 = 6 000 ₽', CX, 250, { size: 80, w: 800, color: '#f6f1e6', align: 'center' }); txt('Копилка = привычка', CX, 380, { size: 56, w: 700, color: '#f6f1e6', align: 'center' }); g.restore();
    rrect(1600, 100, 160, 160, 3810, '#fff', 5, 80); g.beginPath(); g.moveTo(1680, 180); g.lineTo(1680, 120); g.moveTo(1680, 180); g.lineTo(1680 + Math.cos(T * .4) * 50, 180 + Math.sin(T * .4) * 50); inkStroke(5);
    for (const x of [100, 1650]) { rrect(x, 760, 260, 30, 3820 + x, '#c98b5a', 5, 6); rline(x + 20, 790, x + 20, 900, 3821 + x, 7); rline(x + 240, 790, x + 240, 900, 3822 + x, 7); rrect(x + 60, 730, 90, 30, 3823 + x, '#74c0fc', 3, 4); }
    rcircle(200, 420, 70, 3830, '#74c0fc', 5); g.beginPath(); roughEllipse(185, 405, 28, 22, 3831, 1); g.fillStyle = '#8ce99a'; g.fill(); rline(200, 490, 200, 560, 3832, 6);
  },
  clinic(T) { // клиника: кресло стоматолога, лампа, плакат с зубом, чек
    wallFloor('#dff3ee', '#cfd8dc', 3901);
    rrect(150, 100, 360, 420, 3902, '#ffffff', 5, 14); g.beginPath(); g.moveTo(270, 200); g.quadraticCurveTo(330, 160, 390, 200); g.quadraticCurveTo(400, 330, 360, 400); g.lineTo(340, 330); g.lineTo(320, 400); g.quadraticCurveTo(260, 330, 270, 200); g.fillStyle = '#fff'; g.fill(); inkStroke(5); txt('ЧИСТИ ЗУБЫ', 330, 470, { size: 34, w: 900, color: '#2e86de', align: 'center' });
    g.beginPath(); g.moveTo(1300, 760); g.quadraticCurveTo(1480, 560, 1700, 600); g.lineTo(1760, 720); g.quadraticCurveTo(1520, 700, 1400, 820); g.closePath(); g.fillStyle = '#3fb6a8'; g.fill(); inkStroke(6); rline(1520, 760, 1520, 900, 3910, 10);
    rline(1650, 120, 1650, 300, 3911, 6); rline(1650, 300, 1540, 360, 3912, 6); rrect(1470, 340, 140, 70, 3913, '#e9eef2', 5, 30);
    g.save(); g.translate(1100, 220); g.rotate(.06); rrect(-110, -70, 220, 150, 3920, '#fffdf3', 4, 6); mono('ЧЕК', 0, -30, 26, INKC, { align: 'center', w: 800 }); mono('50 000 ₽', 0, 20, 34, '#e8394d', { align: 'center', w: 800 }); g.restore();
  },
  cinema(T) { // кино: экран со светом, ряды кресел, попкорн
    g.fillStyle = '#1b1530'; g.fillRect(0, 0, W, H);
    const fl = .8 + .2 * Math.sin(T * 11) * Math.sin(T * 4.3); rrect(260, 60, 1400, 520, 4001, '#fdf6e3', 8, 10); g.save(); g.globalAlpha = fl; txt('₽', CX, 420, { size: 300, w: 900, color: '#f2a900', align: 'center' }); g.restore();
    g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createLinearGradient(0, 580, 0, H); lg.addColorStop(0, `rgba(255,240,200,${.25 * fl})`); lg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = lg; g.fillRect(0, 580, W, 500); g.restore();
    for (const [y, n, s] of [[700, 9, .8], [860, 7, 1.05]]) for (let i = 0; i < n; i++) { const x = (i + .5) * W / n; if (x > 560 && x < 1360 && y > 800) continue; rrect(x - 80 * s, y, 160 * s, 130 * s, 4010 + i + y, '#c0392b', 5, 22); }
    rrect(1720, 820, 110, 140, 4030, '#fff', 5, 8); for (let k = 0; k < 4; k++) rline(1735 + k * 26, 822, 1735 + k * 26, 958, 4031 + k, 7, .9); for (let k = 0; k < 6; k++) rcircle(1735 + rnd(k * 3.1) * 90, 810 - rnd(k * 1.7) * 30, 20, 4040 + k, '#fff3c4', 3);
  },
  gameroom(T) { // игровая: RGB-подсветка, два монитора, кресло, кнопка DONATE
    wallFloor('#2a1f45', '#1d1733', 4101);
    const hue = (T * 60) % 360; g.save(); g.globalAlpha = .9; for (let x = 0; x < W; x += 40) { g.fillStyle = `hsl(${(hue + x / 6) % 360},90%,60%)`; g.fillRect(x, 40, 40, 10); g.fillRect(x, HZ - 12, 40, 8); } g.restore();
    for (const [x, c] of [[1180, '#74c0fc'], [1560, '#ff8fab']]) { rrect(x - 170, 260, 340, 210, 4110 + x, '#11131a', 6, 10); rrect(x - 152, 276, 304, 176, 4111 + x, c, 2, 6); for (let k = 0; k < 4; k++) rcircle(x - 100 + k * 60, 380 + Math.sin(T * 3 + k) * 20, 16, 4112 + k + x, '#fff', 3); rline(x, 470, x, 520, 4115 + x, 8); }
    rrect(950, 520, 820, 30, 4120, '#3b2f63', 5, 8);
    rrect(140, 120, 260, 360, 4130, '#e8394d', 5, 12); txt('GAME', 270, 220, { size: 60, w: 900, color: '#fff', align: 'center' }); txt('OVER', 270, 300, { size: 60, w: 900, color: '#fff', align: 'center' });
    const pulse = 1 + .06 * Math.sin(T * 5); g.save(); g.translate(560, 300); g.scale(pulse, pulse); rrect(-120, -45, 240, 90, 4140, '#ffd43b', 6, 45); txt('DONATE', 0, 16, { size: 44, w: 900, color: INKC, align: 'center' }); g.restore();
  },
  newyear(T) { // новогодняя площадь: ёлка с мигающими огнями, снег, подарки
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#16224a'); sky.addColorStop(1, '#3b4b8a'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    g.fillStyle = '#eef4fb'; g.fillRect(0, HZ - 30, W, H); rline(-20, HZ - 30, W + 20, HZ - 30, 4201, 5);
    const tx = 1560; for (let k = 0; k < 4; k++) { const w = 380 - k * 80, y = HZ - 60 - k * 140; g.beginPath(); g.moveTo(tx - w / 2, y); g.lineTo(tx, y - 220); g.lineTo(tx + w / 2, y); g.closePath(); g.fillStyle = k % 2 ? '#2f8f5b' : '#37a067'; g.fill(); inkStroke(5); }
    rrect(tx - 30, HZ - 60, 60, 50, 4210, '#8a5f3c', 4); g.save(); g.translate(tx, HZ - 680); g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 18 : 42, a = k / 10 * 6.2832 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = '#ffd43b'; g.fill(); inkStroke(4); g.restore();
    for (let i = 0; i < 22; i++) { const u = rnd(i * 3.7), v = rnd(i * 1.9), y = HZ - 80 - v * 520, w = (HZ - 60 - y) * .8, x = tx + (u - .5) * w; const on = Math.sin(T * 4 + i * 1.7) > 0; rcircle(x, y, 9, 4220 + i, on ? ['#ff6b6b', '#ffd43b', '#74c0fc'][i % 3] : '#2b3a4a', 2); }
    for (const [x, c, s] of [[1380, '#e8394d', 1], [1720, '#3a7bd5', .8], [300, '#ffd43b', .9]]) { rrect(x - 50 * s, HZ - 120 * s, 100 * s, 90 * s, 4240 + x, c, 4, 6); rline(x, HZ - 120 * s, x, HZ - 30 * s, 4241 + x, 6); }
    for (let i = 0; i < 70; i++) { const y = (rnd(i * 2.1) * H + T * (40 + rnd(i) * 50)) % H, x = rnd(i * 5.3) * W + Math.sin(T + i) * 20; g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x, y, 3 + rnd(i * 7) * 4, 0, 6.2832); g.fill(); }
  },
  bazaar(T) { // рынок: палатки с полосатыми тентами, ящики с фруктами, ценники
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#9fd3ff'); sky.addColorStop(1, '#fff3dc'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    g.fillStyle = '#d9c7a8'; g.fillRect(0, HZ, W, H); rline(-20, HZ, W + 20, HZ, 4301, 5);
    for (const [x, c, sign] of [[40, '#e8394d', 'ДЁШЕВО!'], [1380, '#2e86de', 'СВЕЖЕЕ']]) {
      for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(x + k * 85, 140); g.lineTo(x + (k + 1) * 85, 140); g.lineTo(x + (k + 1) * 85, 230); g.quadraticCurveTo(x + k * 85 + 42, 260, x + k * 85, 230); g.closePath(); g.fillStyle = k % 2 ? '#fff' : c; g.fill(); inkStroke(4); }
      rline(x + 10, 230, x + 10, HZ, 4310 + x, 7); rline(x + 500, 230, x + 500, HZ, 4311 + x, 7); rrect(x, 520, 510, 200, 4312 + x, '#c98b5a', 5, 6);
      for (let k = 0; k < 8; k++) rcircle(x + 50 + (k % 4) * 120, 490 - Math.floor(k / 4) * 50, 34, 4320 + k + x, ['#ff6b35', '#8ce99a', '#ffd43b', '#e8394d'][k % 4], 3);
      g.save(); g.translate(x + 255, 300); g.rotate(-.05); rrect(-110, -36, 220, 72, 4330 + x, '#fffdf3', 4, 6); txt(sign, 0, 14, { size: 38, w: 900, color: c, align: 'center' }); g.restore();
    }
  },
  balcony(T) { // балкон с хламом: окно с видом, коробки, велосипед, старый телевизор, лыжи
    wallFloor('#e4e0d6', '#a99d8a', 4401);
    rrect(560, 60, 800, 420, 4402, null, 0); const sky = g.createLinearGradient(0, 60, 0, 480); sky.addColorStop(0, '#a9d8ff'); sky.addColorStop(1, '#fff1d6'); g.fillStyle = sky; g.fillRect(560, 60, 800, 420); skyline(560, 260, 800, 220, 4403, ['#a9c4d6', '#b8cfdd']); for (let x = 560; x <= 1360; x += 200) rline(x, 60, x, 480, 4404 + x, 8); rline(560, 480, 1360, 480, 4405, 8); rline(560, 60, 1360, 60, 4406, 8);
    for (const [x, y, w, h] of [[60, 560, 220, 160], [80, 420, 180, 140], [300, 600, 160, 120], [1560, 580, 240, 140], [1600, 460, 170, 120]]) { rrect(x, y, w, h, 4410 + x + y, '#c9a274', 4, 4); rline(x, y + h * .35, x + w, y + h * .35, 4411 + x + y, 3, .5); }
    rrect(1420, 360, 160, 130, 4420, '#5b5f6b', 5, 14); rrect(1440, 378, 120, 90, 4421, '#9fb3c8', 3, 10); rline(1460, 360, 1430, 320, 4422, 4); rline(1540, 360, 1570, 320, 4423, 4);
    for (const x of [1850, 1880]) rline(x, 120, x - 30, 720, 4430 + x, 9);
    for (const x of [380, 560]) { g.beginPath(); g.arc(x, 680, 60, 0, 6.2832); inkStroke(7); } rline(380, 680, 470, 600, 4440, 7); rline(470, 600, 560, 680, 4441, 7); rline(470, 600, 450, 560, 4442, 7);
  },
  pvz(T) { // пункт выдачи: стеллажи с коробками, стойка со сканером, вывеска
    wallFloor('#ece6fb', '#cfc8dc', 4501);
    rrect(-10, 40, W + 20, 90, 4502, '#7048e8', 5); txt('ПУНКТ ВЫДАЧИ', CX, 106, { size: 56, w: 900, color: '#fff', align: 'center' });
    for (const x0 of [40, 1420]) { for (let r = 0; r < 4; r++) { rline(x0, 260 + r * 130, x0 + 460, 260 + r * 130, 4510 + r + x0, 6); for (let k = 0; k < 4; k++) { const bw = 80 + rnd(k * 2.7 + r + x0) * 30, bh = 60 + rnd(k * 1.3 + r) * 50; rrect(x0 + 10 + k * 112, 258 + r * 130 - bh, bw, bh, 4520 + k + r * 10 + x0, ['#d9b07a', '#c99a62', '#e3c08f'][k % 3], 3, 3); rline(x0 + 22 + k * 112, 240 + r * 130 - bh * .3, x0 + 10 + k * 112 + bw - 12, 240 + r * 130 - bh * .3, 4560 + k + r + x0, 2, .5); } } rline(x0, 130, x0, HZ, 4570 + x0, 6); rline(x0 + 460, 130, x0 + 460, HZ, 4571 + x0, 6); }
    rrect(700, 560, 520, 160, 4580, '#ffffff', 5, 10); rrect(1090, 500, 70, 60, 4581, '#2e3440', 4, 8); g.save(); g.globalAlpha = .6 + .4 * Math.sin(T * 8); g.fillStyle = '#e8394d'; g.fillRect(1098, 520, 54, 6); g.restore();
  },
  tvshow(T) { // студия ТВ-шоу «Миф или правда»: прожекторы, экран, лампочки по краю
    g.fillStyle = '#20123a'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 5; i++) { const x = 200 + i * 380, a = Math.sin(T * 1.3 + i * 1.7) * .35; g.save(); g.translate(x, -20); g.rotate(a); const lg = g.createLinearGradient(0, 0, 0, 1100); lg.addColorStop(0, 'rgba(255,240,180,.35)'); lg.addColorStop(1, 'rgba(255,240,180,0)'); g.beginPath(); g.moveTo(-30, 0); g.lineTo(30, 0); g.lineTo(220, 1100); g.lineTo(-220, 1100); g.closePath(); g.fillStyle = lg; g.fill(); g.restore(); }
    rrect(560, 80, 800, 330, 4601, '#0f0a1f', 8, 16); txt('МИФ', 760, 290, { size: 110, w: 900, color: '#ff6b6b', align: 'center' }); txt('ИЛИ', CX, 200, { size: 40, w: 900, color: '#fff', align: 'center' }); txt('ПРАВДА', 1160, 290, { size: 90, w: 900, color: '#8ce99a', align: 'center' });
    for (let k = 0; k < 28; k++) { const u = k / 28, on = Math.sin(T * 6 - k * .7) > 0; const x = u < .5 ? 560 + u * 2 * 800 : 1360 - (u - .5) * 2 * 800, y = u < .5 ? 80 : 410; rcircle(x, y, 10, 4610 + k, on ? '#ffd43b' : '#5c4a2a', 2); }
    g.fillStyle = '#3b2363'; g.fillRect(0, HZ, W, H - HZ); rline(-20, HZ, W + 20, HZ, 4620, 6); g.beginPath(); roughEllipse(CX, HZ + 120, 760, 90, 4621, 2); g.fillStyle = '#5a3a8a'; g.fill(); inkStroke(5);
  },
  picnic(T) { // пикник на природе: мангал с дымом, палатка, плед, корзина
    const sky = g.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, '#8fd0ff'); sky.addColorStop(1, '#f2fbe6'); g.fillStyle = sky; g.fillRect(0, 0, W, HZ);
    for (const [x, r] of [[300, 260], [900, 200], [1500, 300]]) rcircle(x, HZ - 20, r, 4701 + x, '#a8d5a0', 4);
    g.fillStyle = '#86c97a'; g.fillRect(0, HZ - 20, W, H); rline(-20, HZ - 20, W + 20, HZ - 20, 4702, 5);
    g.beginPath(); g.moveTo(80, HZ + 60); g.lineTo(330, HZ - 300); g.lineTo(580, HZ + 60); g.closePath(); g.fillStyle = '#ff8f3a'; g.fill(); inkStroke(6); g.beginPath(); g.moveTo(330, HZ - 300); g.lineTo(290, HZ + 60); g.lineTo(370, HZ + 60); g.closePath(); g.fillStyle = '#4a2c18'; g.fill(); inkStroke(4);
    rrect(1450, 640, 320, 70, 4710, '#3b3f4a', 5, 6); rline(1480, 710, 1470, 820, 4711, 7); rline(1740, 710, 1750, 820, 4712, 7); for (let k = 0; k < 4; k++) rrect(1480 + k * 75, 620, 60, 20, 4713 + k, '#8a4b2a', 3, 6);
    for (let i = 0; i < 6; i++) { const q = (T * .4 + i / 6) % 1; g.save(); g.globalAlpha = (1 - q) * .55; g.beginPath(); roughEllipse(1610 + Math.sin(q * 6 + i) * 40, 600 - q * 380, 30 + q * 50, 22 + q * 30, 4720 + i, 1); g.fillStyle = '#e9ecef'; g.fill(); g.restore(); }
    g.beginPath(); g.moveTo(700, 900); g.lineTo(1180, 880); g.lineTo(1260, 1000); g.lineTo(640, 1020); g.closePath(); g.fillStyle = '#e8394d'; g.fill(); inkStroke(5); for (let k = 1; k < 4; k++) rline(680 + k * 140, 890, 660 + k * 150, 1015, 4730 + k, 3, .5);
  },
});

// ---------- вариации: одно и то же место в разных роликах выглядит по-разному ----------
// интерьеры: цвет стен и пола + узор обоев; везде: гирлянда/флажки сверху; сезон по дате; погода на улице
const INTERIOR = new Set(['home', 'office', 'kitchen', 'bedroom', 'cowork', 'gym', 'school', 'clinic', 'balcony', 'pvz', 'mall', 'shop']);
const OUTDOOR = new Set(['street', 'park', 'beach', 'roof', 'forest', 'bazaar', 'picnic', 'newyear', 'dacha', 'courier', 'stadium', 'yacht']);
const WALLS = ['#dce5e9', '#f3e1d3', '#e3f0dc', '#e9e0f5', '#fbe7b5', '#d4e7f2', '#f6d5d9', '#e6e2d6', '#cfe3e0', '#f1dcc4', '#dfe7c8', '#e2d9ef', '#ffe3c9', '#d9e8ff'];
const FLOORS = ['#ebcfa3', '#c9a27a', '#b9b4a8', '#d6c2a1', '#a88466', '#cfd3d6', '#bfa58a', '#9c8f84'];
const PATTERNS = ['none', 'stripes', 'dots', 'diamonds', 'wainscot', 'plaid', 'waves', 'none'];
const TOPS = ['none', 'bunting', 'lights', 'lanterns', 'none', 'plants'];
let LV = null;   // вариант текущего места (выставляет drawLocation)
const hashStr = s => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
function variantOf(place) {
  const sd = ((PLAN?.seed || 1) ^ hashStr(place)) >>> 0, r = k => rnd(sd * .001 + k * 7.13);
  const m = new Date().getMonth() + 1, season = m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn';
  return { place, inside: INTERIOR.has(place), out: OUTDOOR.has(place), wall: WALLS[Math.floor(r(1) * WALLS.length)], floor: FLOORS[Math.floor(r(2) * FLOORS.length)],
    pattern: PATTERNS[Math.floor(r(3) * PATTERNS.length)], top: m === 12 || (m === 1 && new Date().getDate() < 15) ? 'garland' : TOPS[Math.floor(r(4) * TOPS.length)], hue: r(5) * 360, season, weather: PLAN?.episode?.weather || 'clear' };
}
// обои поверх стены (стена 0…HZ), полупрозрачно — рисуется из wallFloor
function wallPattern(v) {
  g.save(); g.beginPath(); g.rect(0, 0, W, HZ); g.clip(); g.globalAlpha = .16; g.strokeStyle = g.fillStyle = INKC; g.lineWidth = 3;
  if (v.pattern === 'stripes') for (let x = 0; x < W; x += 70) g.fillRect(x, 0, 22, HZ);
  else if (v.pattern === 'dots') for (let y = 30; y < HZ; y += 70) for (let x = (y / 70 % 2) * 35; x < W; x += 70) { g.beginPath(); g.arc(x, y, 6, 0, 6.2832); g.fill(); }
  else if (v.pattern === 'diamonds') for (let y = 0; y < HZ; y += 80) for (let x = (y / 80 % 2) * 40; x < W; x += 80) { g.beginPath(); g.moveTo(x, y - 18); g.lineTo(x + 14, y); g.lineTo(x, y + 18); g.lineTo(x - 14, y); g.closePath(); g.stroke(); }
  else if (v.pattern === 'wainscot') { g.globalAlpha = .22; g.fillStyle = shade(v.wall, -.25); g.fillRect(0, HZ - 230, W, 230); g.globalAlpha = .35; for (let x = 30; x < W; x += 150) g.strokeRect(x, HZ - 200, 110, 170); }
  else if (v.pattern === 'plaid') { for (let x = 0; x < W; x += 120) g.fillRect(x, 0, 30, HZ); g.globalAlpha = .1; for (let y = 0; y < HZ; y += 120) g.fillRect(0, y, W, 30); }
  else if (v.pattern === 'waves') for (let y = 40; y < HZ; y += 60) { g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x * .02) * 10); g.stroke(); }
  g.restore();
}
// верхний декор: флажки, гирлянда-лампочки, фонарики, свисающие растения; зимой — новогодняя гирлянда
function topDecor(v, T) {
  if (v.top === 'none' || !(v.inside || ['cafe', 'pizzeria', 'bakery', 'flowers', 'petshop', 'library', 'gameroom', 'studio', 'garage', 'salon', 'train'].includes(v.place))) return;   // только в помещениях
  const cols = v.top === 'garland' ? ['#ff6b6b', '#ffd43b', '#74c0fc', '#8ce99a'] : [`hsl(${v.hue},75%,62%)`, `hsl(${(v.hue + 90) % 360},75%,62%)`, `hsl(${(v.hue + 200) % 360},75%,62%)`];
  for (const [x0, x1] of [[-20, 760], [1160, 1940]]) {
    g.beginPath(); g.moveTo(x0, 30); g.quadraticCurveTo((x0 + x1) / 2, 130, x1, 30); inkStroke(3);
    for (let i = 1; i < 10; i++) { const u = i / 10, x = x0 + (x1 - x0) * u, y = 30 + 4 * u * (1 - u) * 100 * .98;
      if (v.top === 'bunting') { g.beginPath(); g.moveTo(x - 22, y); g.lineTo(x + 22, y); g.lineTo(x, y + 44); g.closePath(); g.fillStyle = cols[i % 3]; g.fill(); inkStroke(3); }
      else if (v.top === 'lanterns') { g.beginPath(); roughEllipse(x, y + 30, 20, 26, 5000 + i, 1); g.fillStyle = cols[i % 3]; g.fill(); inkStroke(3); }
      else if (v.top === 'plants') { if (i % 3) continue; rline(x, y, x, y + 60, 5010 + i, 3); for (let k = 0; k < 4; k++) { g.beginPath(); roughEllipse(x + (k % 2 ? 14 : -14), y + 70 + k * 22, 16, 9, 5020 + i + k, 1); g.fillStyle = '#4fa35f'; g.fill(); inkStroke(2.5); } }
      else { const on = v.top === 'lights' || Math.sin(T * 5 + i * 1.3) > -.2; rcircle(x, y + 12, 10, 5030 + i, on ? cols[i % cols.length] : '#5b5f6b', 2); }
    }
  }
}
// сезон и погода: снег, листопад, лепестки на улице; дождь — косыми штрихами
function seasonFx(v, T) {
  if (!v.out || v.place === 'newyear') return;
  const kind = v.weather === 'rain' ? 'rain' : v.weather === 'snow' || v.season === 'winter' ? 'snow' : v.season === 'autumn' ? 'leaves' : v.season === 'spring' ? 'petals' : null; if (!kind) return;
  g.save();
  for (let i = 0; i < (kind === 'rain' ? 90 : 40); i++) {
    const sp = kind === 'rain' ? 900 : kind === 'snow' ? 60 : 90, y = (rnd(i * 2.3) * H + T * sp * (.7 + rnd(i) * .6)) % (H + 40) - 20, x = (rnd(i * 5.9) * W + Math.sin(T * 1.3 + i) * 30 + (kind === 'rain' ? -y * .2 : 0) + W) % W;
    if (kind === 'rain') { g.strokeStyle = 'rgba(120,160,210,.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 10, y + 34); g.stroke(); }
    else if (kind === 'snow') { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(x, y, 3 + rnd(i * 7) * 5, 0, 6.2832); g.fill(); }
    else { g.save(); g.translate(x, y); g.rotate(T * 2 + i); g.beginPath(); roughEllipse(0, 0, 12, 7, 5100 + i, .6); g.fillStyle = kind === 'leaves' ? ['#e8590c', '#f2a900', '#d6453d'][i % 3] : ['#ffc9de', '#fff0f6'][i % 2]; g.fill(); g.restore(); }
  }
  g.restore();
}
// обёртки: стены/пол из варианта места, обои; после места — декор и сезон
const _wallFloor = wallFloor;
wallFloor = function (wall, floor, seed) { if (LV?.inside) { _wallFloor(LV.wall, LV.floor, seed); wallPattern(LV); } else _wallFloor(wall, floor, seed); };
drawLocation = function (place, T) { LV = variantOf(LOCATIONS[place] ? place : 'home'); (LOCATIONS[place] || LOCATIONS.home)(T); topDecor(LV, T); seasonFx(LV, T); LV = null; };
