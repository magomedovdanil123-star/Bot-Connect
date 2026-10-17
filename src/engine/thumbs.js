// Обложки (превью) и фирменные материалы канала: всё рисуется тем же движком, что и ролики.
// Обложка: крупная эмоция героя + 1–2 строки огромного текста + фирменный цвет. Три варианта для выбора.

function thumbText(lines, x, y, maxW, rot = -.04) {
  // огромный текст на маркерной плашке с толстым контуром; вторая строка — акцентная
  g.save(); g.translate(x, y); g.rotate(rot);
  let yy = 0;
  lines.forEach((s, i) => {
    let size = 210; while (size > 70 && tw(s, size, 900) > maxW) size -= 6;
    const w = tw(s, size, 900) + 60, h = size * 1.08;
    if (INK) {
      g.beginPath(); g.roundRect(-30, yy - h * .82, w, h, 22); g.fillStyle = i === 0 ? VIO : '#fff'; g.fill(); g.strokeStyle = INKC; g.lineWidth = 12; g.stroke();
      txt(s, 0, yy, { size, w: 900, color: i === 0 ? INKC : '#e8394d' });
    } else {
      g.save(); g.font = `900 ${size}px ${SANS}`; g.lineWidth = 18; g.strokeStyle = '#000'; g.lineJoin = 'round'; g.strokeText(s, 0, yy); g.restore();
      txt(s, 0, yy, { size, w: 900, color: i === 0 ? WHITE : VIO2, glow: 30 });
    }
    yy += h + 26;
  });
  g.restore();
}

/** Рисует обложку в основной холст. o = {variant, lines, place, emo} */
function drawThumb(o) {
  g = X; X.setTransform(1, 0, 0, 1, 0, 0); FR = 0;
  X.fillStyle = BG; X.fillRect(0, 0, W, H);
  const v = o.variant || 0;
  if (INK && PLAN.hasMascot) {
    drawLocation(o.place || 'home', 1);
    X.save(); X.fillStyle = PAPER; X.globalAlpha = .35; X.fillRect(0, 0, W, H); X.restore();   // фон тише, герой и текст громче
    // лучи за героем
    X.save(); X.translate(560, 560); X.globalAlpha = .9; for (let i = 0; i < 20; i++) { X.rotate(Math.PI / 10); X.beginPath(); X.moveTo(0, -40); X.lineTo(900, -70); X.lineTo(900, 70); X.closePath(); X.fillStyle = i % 2 ? VIO : 'rgba(255,255,255,.0)'; X.fill(); } X.restore();
    const emo = ['shock', 'cool', 'happy'][v % 3], E = { ...EMOS[emo] }, P = { ...POSES[['shock', 'proud', 'celebrate'][v % 3]] };
    if (v % 3 === 2) E.cheek = .8;
    // летящие купюры и монеты вокруг
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + v, r = 430 + rnd(i * 3 + v) * 120; if (i % 2) banknote(560 + Math.cos(a) * r, 560 + Math.sin(a) * r * .8, a, 1.6); else rubCoin(560 + Math.cos(a) * r, 560 + Math.sin(a) * r * .8, 44, a); }
    drawHamster({ ham: true, ph: 1, outfit: 'suit' }, 560, 1480, 2.25, P, E, 2.2, { flip: 1 });
    thumbText(o.lines, 1010, o.lines.length > 1 ? 330 : 470, 820);
    // «стрелка от руки» к герою
    g.beginPath(); g.moveTo(1180, 900); g.quadraticCurveTo(1000, 1000, 880, 860); g.strokeStyle = '#e8394d'; g.lineWidth = 14; g.lineCap = 'round'; g.stroke();
    g.beginPath(); g.moveTo(880, 860); g.lineTo(920, 930); g.moveTo(880, 860); g.lineTo(955, 850); g.stroke();
  } else {
    X.save(); X.globalCompositeOperation = 'lighter'; X.globalAlpha = .5; X.drawImage(BLOB, -200, -100, 1400, 1400); X.globalAlpha = .3; X.drawImage(BLOB, 900, 100, 1200, 1200); X.restore();
    X.drawImage(GRID, -180, -180);
    coin(520, 560, 300, PLAN.mainSym || '◆', 1, { color: VIO2, glow: 60 });
    thumbText(o.lines, 960, o.lines.length > 1 ? 380 : 560, 880);
  }
  X.save(); X.globalAlpha = INK ? .3 : 1; X.drawImage(VIGN, 0, 0); X.restore();
}
window.thumb = (o) => { drawThumb(o); const c = document.createElement('canvas'); c.width = 1280; c.height = 720; c.getContext('2d').drawImage(cvs, 0, 0, 1280, 720); return c.toDataURL('image/jpeg', .9); };

// ---------- фирменные материалы: аватарка, шапка канала, стикеры ----------
window.brandAsset = (kind) => {
  const sizes = { avatar: [800, 800], banner: [2560, 1440], sticker: [512, 512] };
  const [cw, chh] = sizes[kind.split(':')[0]]; const c = document.createElement('canvas'); c.width = cw; c.height = chh; const x = c.getContext('2d');
  const prev = g; g = x; FR = 0;
  const L = { ham: true, ph: 1, outfit: 'suit' };
  if (kind === 'avatar') {
    x.fillStyle = VIO; x.fillRect(0, 0, cw, chh);
    x.save(); x.translate(400, 400); for (let i = 0; i < 16; i++) { x.rotate(Math.PI / 8); x.beginPath(); x.moveTo(0, -20); x.lineTo(600, -50); x.lineTo(600, 50); x.closePath(); x.fillStyle = 'rgba(255,255,255,.22)'; x.fill(); } x.restore();
    drawHamster(L, 400, 1080, 1.7, { ...POSES.neutral }, { ...EMOS.happy }, 1, { flip: 1 });
  } else if (kind === 'banner') {
    x.fillStyle = PAPER; x.fillRect(0, 0, cw, chh);
    x.save(); x.globalCompositeOperation = 'multiply'; x.globalAlpha = .18; x.drawImage(PAPERTEX, 0, 0, cw, chh); x.restore();
    // безопасная зона YouTube: 1546×423 по центру
    x.save(); x.translate(1280, 720); x.beginPath(); roughEllipse(-430, 0, 260, 260, 5, 2); x.fillStyle = VIO; x.fill(); inkStroke(8); x.restore();
    drawHamster(L, 850, 910, .78, { ...POSES.wave }, { ...EMOS.happy }, 1, { flip: 1 });
    const name = PLAN.brand?.name || 'ХОМЯК';
    x.save(); x.translate(1040, 700); x.rotate(-.03); const w = tw(name, 150, 900) + 90; x.beginPath(); x.roundRect(-20, -120, w, 170, 26); x.fillStyle = '#fff'; x.fill(); inkStroke(10); txt(name, 25, 15, { size: 150, w: 900, color: INKC }); x.restore();
    if (PLAN.brand?.tagline) mono(PLAN.brand.tagline, 1060, 820, 44, INKC, { w: 700, ls: 10 });
  } else { // sticker:<эмоция> — прозрачный фон
    const emo = kind.split(':')[1] || 'happy', map = { happy: ['celebrate', 'happy'], shock: ['shock', 'shock'], cool: ['proud', 'cool'], panic: ['panic', 'shock'], sleep: ['sit', 'sleep'], think: ['think', 'think'], wave: ['wave', 'happy'] }[emo] || ['neutral', 'happy'];
    drawHamster(L, 256, 500, .9, { ...POSES[map[0]] }, { ...EMOS[map[1]] }, 1, { flip: 1 });
  }
  g = prev; return c.toDataURL('image/png');
};
