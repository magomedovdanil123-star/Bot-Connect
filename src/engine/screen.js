// Сцена «Экран»: настоящий снимок сайта в окне браузера. Окно влетает, страница прокручивается к кнопке-призыву,
// камера наезжает, маркер обводит кнопку, хомяк показывает на неё лапкой. Снимок делает бот (src/screens.js).
const SCREEN_IMG = {};
window.imagesReady = async () => {
  for (const s of SC) if (s.type === 'screen' && s.p?.img && !SCREEN_IMG[s.idx]) {
    const im = new Image(); im.src = s.p.img; try { await im.decode(); SCREEN_IMG[s.idx] = im; } catch { /* без снимка — заглушка */ }
  }
};

T.screen = function (t, d, s) {
  const p = s.p || {}, im = SCREEN_IMG[s.idx], Tabs = s.start + t;
  const X0 = 120, Y0 = 185, WW = 1320, WH = 770, BAR = 60, k = WW / 1440, viewH = (WH - BAR) / k;
  const mark = (p.marks || [])[0], imgH = p.imgH || 900;
  // прокрутка к подсвеченному месту (или просто вниз по странице); тот же сайт подряд — продолжаем с прошлого места без влёта окна
  const targetOf = sc => { const m = (sc.p?.marks || [])[0], ih = sc.p?.imgH || 900; return m ? clamp(m.y + m.h / 2 - viewH * .45, 0, Math.max(0, ih - viewH)) : clamp(Math.min(ih - viewH, 650), 0, 1e9); };
  const prev = SC[s.idx - 1], same = prev?.type === 'screen' && prev.p?.url === p.url, t0 = same ? .1 : .55;
  const target = targetOf(s), from = same ? targetOf(prev) : 0;
  const scroll = lerp(from, target, eio(seg(t, t0, t0 + Math.min(1.6, d * .35))));
  const tm = Math.min(d * .5, t0 + Math.min(1.6, d * .35) + .15);   // момент, когда кнопка найдена
  const mx = mark ? X0 + (mark.x + mark.w / 2) * k : X0 + WW / 2, my = mark ? Y0 + BAR + (mark.y + mark.h / 2 - scroll) * k : Y0 + WH / 2;
  // фон: бумага с лёгкой сеткой (комикс) или фирменная сетка (неон)
  if (INK) { g.save(); g.globalAlpha = .5; for (let x = 0; x < W; x += 60) rline(x, 0, x, H, 1200 + x, 1.5, .25); g.restore(); }
  // камера: наезд на кнопку
  const z = 1 + (mark ? .3 : .05) * emph(seg(t, tm, tm + .6));
  g.save(); g.translate(mx, my); g.scale(z, z); g.translate(-mx, -my);
  // окно влетает
  const e = same ? 1 : settle(seg(t, 0, .5));
  g.save(); g.translate(X0 + WW / 2, Y0 + WH / 2 + (1 - e) * 120); g.scale(.92 + .08 * e, .92 + .08 * e); g.rotate((1 - e) * -.03); g.translate(-(X0 + WW / 2), -(Y0 + WH / 2));
  g.globalAlpha *= clamp(e * 1.6);
  g.fillStyle = INK ? 'rgba(27,26,31,.18)' : 'rgba(0,0,0,.5)'; g.beginPath(); g.roundRect(X0 + 18, Y0 + 24, WW, WH, 22); g.fill();
  g.beginPath(); g.roundRect(X0, Y0, WW, WH, 22); g.fillStyle = INK ? '#fff' : '#0f0c18'; g.fill();
  // страница
  g.save(); g.beginPath(); g.rect(X0, Y0 + BAR, WW, WH - BAR); g.clip();
  if (im) g.drawImage(im, 0, scroll, 1440, Math.min(viewH, im.height - scroll), X0, Y0 + BAR, WW, Math.min(viewH, im.height - scroll) * k);
  else { // сайт не открылся — аккуратная заглушка с адресом
    g.fillStyle = INK ? '#f6f3ec' : '#17122a'; g.fillRect(X0, Y0 + BAR, WW, WH - BAR);
    txt(p.domain || 'сайт', X0 + WW / 2, Y0 + WH / 2, { size: 96, w: 900, color: INK ? INKC : WHITE, align: 'center' });
    for (let i = 0; i < 3; i++) { g.fillStyle = INK ? 'rgba(27,26,31,.08)' : 'rgba(255,255,255,.07)'; g.beginPath(); g.roundRect(X0 + 140 + i * 360, Y0 + WH / 2 + 80, 300, 150, 16); g.fill(); }
  }
  g.restore();
  // верхняя панель браузера: точки, вкладка, адресная строка с замком
  g.save(); g.beginPath(); g.roundRect(X0, Y0, WW, BAR, [22, 22, 0, 0]); g.fillStyle = INK ? '#ece8df' : '#1d1730'; g.fill();
  ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { g.beginPath(); g.arc(X0 + 30 + i * 26, Y0 + BAR / 2, 8, 0, 6.2832); g.fillStyle = c; g.fill(); });
  g.beginPath(); g.roundRect(X0 + 130, Y0 + 12, 700, BAR - 24, 18); g.fillStyle = INK ? '#fff' : '#120e20'; g.fill();
  g.beginPath(); g.roundRect(X0 + 150, Y0 + 23, 14, 12, 3); g.fillStyle = '#2fbf71'; g.fill(); g.beginPath(); g.arc(X0 + 157, Y0 + 23, 5, Math.PI, 0); g.strokeStyle = '#2fbf71'; g.lineWidth = 2.5; g.stroke();
  mono(p.domain || '', X0 + 176, Y0 + 38, 22, INK ? INKC : WHITE, { w: 600 });
  g.restore();
  g.beginPath(); g.roundRect(X0, Y0, WW, WH, 22); if (INK) inkStroke(7); else { g.strokeStyle = VIO2; g.lineWidth = 3; g.stroke(); }
  g.restore();
  // маркер вокруг кнопки: рисуется «от руки», с небольшим перебором
  if (mark && t > tm) {
    const q = eo(seg(t, tm + .2, tm + .75)), rx = mark.w * k / 2 + 34, ry = mark.h * k / 2 + 24, n = 48;
    g.save(); g.beginPath();
    for (let i = 0; i <= n * q * 1.12; i++) { const a = -2.4 + i / n * 6.2832, j = boil(1300, i, 2.4); const x = mx + (rx + j) * Math.cos(a), y = my + (ry + j) * Math.sin(a); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.strokeStyle = '#e8394d'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(); g.restore();
  }
  g.restore();
  // хомяк справа показывает на кнопку
  if (INK && PLAN.hasMascot) {
    const hx = 1700, fy = 1075, pe = same ? 1 : settle(seg(t, .25, .75));
    const P = blendPose(POSES.wave, POSES.point, settle(seg(t, tm - .3, tm + .2))), E = { ...EMOS[t > tm + .4 ? 'happy' : 'proud'] };
    E.open = 0; E.talk = mouthAt(s, t, Tabs) * .8; E.lx = -.8;
    drawHamster(hostLook({ ham: true, ph: 1.3, outfit: PLAN.episode?.outfit || 'suit' }), hx + (1 - pe) * 400, fy, .7, P, E, Tabs, { flip: -1 });
  }
  // подпись найденной кнопки
  if (mark && t > tm + .5) {
    const a = seg(t, tm + .5, tm + .8), lbl = (mark.label.length > 28 ? mark.label.slice(0, 27).replace(/\s+\S*$/, '') + '…' : mark.label).toUpperCase(), wl = tw(lbl, 40, 900) + 60;
    g.save(); g.globalAlpha *= a; g.translate(clamp(mx, 260 + wl / 2, W - 380 - wl / 2), Math.min(H - 70, my + 150)); g.rotate(-.03);
    g.beginPath(); g.roundRect(-wl / 2, -40, wl, 74, 37); g.fillStyle = '#e8394d'; g.fill(); if (INK) inkStroke(5);
    txt(lbl, 0, 12, { size: 40, w: 900, color: '#fff', align: 'center' }); g.restore();
  }
};
