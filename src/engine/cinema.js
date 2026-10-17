// Кинематограф для сцен-историй: планы камеры (общий/средний/крупный/голландский угол/наезд-удар/проезд),
// глубина (фон и передний план размыты и движутся с разной скоростью), свет (время суток, лучи, настроение)
// и мультяшная игра (вспышка «!», двойной взгляд, линии скорости).

// ---------- камера ----------
// Возвращает точку фокуса F (в координатах сцены), куда она встаёт на экране S, увеличение z, наклон rot и тряску ox/oy.
function shotCam(s, t, hero, floorY) {
  const sh = s.dir.shot || 'wide', u = eio(clamp(t / s.dur)), hx = hero ? hero.x : CX, f = hero ? hero.flip : 1;
  const face = [hx, floorY - 400], chest = [hx, floorY - 300];
  let z = 1, m = 0, F = [CX, 540], S = [CX, 540], rot = 0, ox = 0, oy = 0;
  if (sh === 'wide') z = 1 + .045 * u;
  else if (sh === 'medium') { z = 1.3 + .06 * u; m = .6; F = chest; S = [CX, 565]; }
  else if (sh === 'close') { z = 1.68 + .07 * u; m = 1; F = face; S = [CX - f * 240, 560]; }
  else if (sh === 'dutch') { z = 1.36 + .05 * u; m = .7; F = chest; S = [CX, 565]; rot = (s.dir.dutch || 1) * .055; }
  else if (sh === 'truck') { z = 1.16; m = .3; F = chest; S = [CX, 560]; ox = (u - .5) * 150 * (s.dir.dirX || 1); }
  else if (sh === 'crash') { // наезд-удар в лицо в момент эмоции + затухающая тряска
    const hit = s.dir.crashT ?? .6, q = emph(seg(t, hit, hit + .2)); z = 1.12 + .66 * q; m = .45 + .55 * q; F = q > 0 ? face : chest; S = [CX - f * 200 * q, 560];
    const a = t - hit; if (a > 0 && a < .5) { const e = Math.exp(-a * 10); ox += (rnd(FR * 3.3) - .5) * 34 * e; oy += (rnd(FR * 7.1) - .5) * 26 * e; }
  }
  return { z, F: [lerp(CX, F[0], m), lerp(540, F[1], m)], S: [lerp(CX, S[0], m), lerp(540, S[1], m)], rot, ox, oy };
}
// par — коэффициент параллакса слоя: фон < 1, герои = 1, передний план > 1
function applyCam(c, par = 1) {
  const z = 1 + (c.z - 1) * par;
  g.translate(c.S[0] + c.ox * par, c.S[1] + c.oy * par); g.rotate(c.rot * par); g.scale(z, z); g.translate(-c.F[0], -c.F[1]);
}

// ---------- слои с размытием (глубина резкости) ----------
// Слой рисуется в буфер половинного размера и кладётся с размытием одной операцией — быстро и мягко.
const DOF = document.createElement('canvas'); DOF.width = W / 2; DOF.height = H / 2; const DOFX = DOF.getContext('2d');
function drawLayer(blur, fn) {
  if (blur < .6) { g.save(); fn(); g.restore(); return; }
  const prev = g; g = DOFX; g.setTransform(.5, 0, 0, .5, 0, 0); g.clearRect(0, 0, W, H); g.save(); fn(); g.restore(); g = prev;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.filter = `blur(${(blur / 2).toFixed(1)}px)`; g.drawImage(DOF, 0, 0, W, H); g.filter = 'none'; g.restore();
}

// ---------- передний план: крупные предметы у края кадра, не в фокусе ----------
const FOREGROUND = {
  shop() { rrect(-80, 700, 330, 460, 701, '#efe9dd', 7); for (let r = 0; r < 3; r++) { rline(-80, 790 + r * 120, 250, 790 + r * 120, 702 + r, 6); for (let i = 0; i < 4; i++) rrect(-60 + i * 74, 724 + r * 120, 58, 62, 710 + r * 9 + i, ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c'][(i + r) % 4], 4, 6); } },
  home() { rrect(1720, 930, 170, 200, 720, '#c9774a', 6, 10); for (let i = 0; i < 6; i++) { const a = -1.9 + i * .38; g.save(); g.translate(1805, 940); g.rotate(a); g.beginPath(); roughEllipse(0, -150, 46, 150, 721 + i, 2); g.fillStyle = i % 2 ? '#3f9d63' : '#57b87a'; g.fill(); inkStroke(6); g.restore(); } },
  bank() { rrect(-20, 640, 54, 460, 730, '#e0b04a', 6, 8); rcircle(7, 630, 40, 731, '#f2cf6b', 6); g.beginPath(); g.moveTo(34, 700); g.quadraticCurveTo(170, 840, 330, 760); g.strokeStyle = INKC; g.lineWidth = 34; g.stroke(); g.strokeStyle = '#c2253a'; g.lineWidth = 24; g.stroke(); },
  office() { rrect(-60, 760, 420, 320, 740, '#2e3440', 7, 14); rrect(-30, 790, 360, 250, 741, '#4c566a', 4, 8); rrect(1720, 890, 150, 190, 742, '#fff', 6, 20); g.beginPath(); g.arc(1880, 960, 46, -1.3, 1.3); inkStroke(14); },
  street() { rrect(1800, -60, 70, 1200, 750, '#3b4252', 7); rrect(1730, 120, 210, 60, 751, '#3b4252', 6, 10); for (let i = 0; i < 5; i++) rcircle(60 + i * 90, 1030 - (i % 2) * 40, 110, 752 + i, i % 2 ? '#3f9d63' : '#57b87a', 6); },
  exchange() { rrect(1640, 700, 420, 420, 760, '#1f2430', 7, 16); for (let i = 0; i < 7; i++) { const up = rnd(i * 5.3) > .4, h = 40 + rnd(i * 2.7) * 120; g.fillStyle = up ? '#2fbf71' : '#e8394d'; g.fillRect(1680 + i * 46, 900 - h / 2 - i * 14, 22, h); } },
  space() { g.beginPath(); roughEllipse(90, 1040, 300, 220, 770, 3); g.fillStyle = '#8b8f9c'; g.fill(); inkStroke(7); for (const [x, y, r] of [[40, 960, 40], [190, 1010, 28], [90, 1090, 34]]) rcircle(x, y, r, 771 + x, '#6c707c', 4); },
};
function drawForeground(place) { (FOREGROUND[place] || (() => {}))(); }

// ---------- свет ----------
// лучи из окна: мягкие тёплые полосы, медленно «дышат»
function godRays(place, T) {
  if (!['bank', 'home', 'office', 'shop'].includes(place)) return;
  g.save(); g.globalCompositeOperation = 'screen';
  for (let i = 0; i < 4; i++) {
    const x0 = 120 + i * 260 + Math.sin(T * .3 + i) * 30, a = .16 + .06 * Math.sin(T * .7 + i * 1.7);
    const gr = g.createLinearGradient(x0, 0, x0 + 520, 1000); gr.addColorStop(0, `rgba(255,236,190,${a})`); gr.addColorStop(1, 'rgba(255,236,190,0)');
    g.beginPath(); g.moveTo(x0, -20); g.lineTo(x0 + 120, -20); g.lineTo(x0 + 700, 1100); g.lineTo(x0 + 420, 1100); g.closePath(); g.fillStyle = gr; g.fill();
  }
  g.restore();
}
// цветокоррекция: время суток эпизода + настроение момента (тепло — выигрыш, холод — потеря)
function grade(tod, mood, k, hx, hy) {
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const TOD = { morning: ['#ffd29a', .16], evening: ['#ff8f6b', .22], night: ['#26316a', .46] }[tod];
  if (TOD) { g.globalCompositeOperation = 'multiply'; g.globalAlpha = TOD[1]; g.fillStyle = TOD[0]; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  if (tod === 'night' || tod === 'evening') { // тёплое пятно света на герое — как от лампы или заката
    g.globalCompositeOperation = 'screen'; const gr = g.createRadialGradient(hx, hy, 40, hx, hy, 700);
    gr.addColorStop(0, tod === 'night' ? 'rgba(255,214,140,.38)' : 'rgba(255,190,120,.25)'); gr.addColorStop(1, 'rgba(255,214,140,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  if (mood && k > 0) { g.globalCompositeOperation = 'soft-light'; g.globalAlpha = k * (mood === 'warm' ? .32 : .42); g.fillStyle = mood === 'warm' ? '#ffb347' : '#4f6fb3'; g.fillRect(0, 0, W, H); }
  g.restore();
}

// ---------- мультяшная игра ----------
// «!» с лучами над головой в момент шока
function exclaim(x, y, ts) {
  if (ts < 0 || ts > .9) return;
  const p = settle(seg(ts, 0, .22)), a = 1 - seg(ts, .6, .9);
  g.save(); g.globalAlpha *= a; g.translate(x, y); g.scale(p, p);
  for (let i = 0; i < 7; i++) { const an = -Math.PI / 2 + (i - 3) * .42, r0 = 70, r1 = 110 + (i % 2) * 22; g.beginPath(); g.moveTo(Math.cos(an) * r0, Math.sin(an) * r0); g.lineTo(Math.cos(an) * r1, Math.sin(an) * r1); inkStroke(7); }
  g.save(); g.rotate(.12); g.font = `900 120px ${SANS}`; g.textAlign = 'center'; g.lineWidth = 16; g.strokeStyle = INKC; g.lineJoin = 'round'; g.strokeText('!', 0, 40); g.fillStyle = '#e8394d'; g.fillText('!', 0, 40); g.restore();
  g.restore();
}
// линии скорости за бегущим героем
function speedLines(x, y, dir, k, a) {
  if (a <= 0) return;
  g.save(); g.globalAlpha *= a;
  for (let i = 0; i < 6; i++) { const yy = y - 60 - i * 70 * k + Math.sin(FR + i) * 6, len = (120 + rnd(i * 3.7 + Math.floor(FR / 2)) * 160) * k, x0 = x - dir * (190 * k + rnd(i * 1.3) * 40); rline(x0, yy, x0 - dir * len, yy, 780 + i, 5, .8); }
  g.restore();
}
