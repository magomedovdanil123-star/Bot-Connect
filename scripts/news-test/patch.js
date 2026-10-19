// ТЕСТ «Зверо-новости 2.0» (в код проекта не входит): студия в цвет рубрики, окно с фото за ведущими,
// плашка-заголовок, фишки рубрик (папарацци, глитч, конфетти), камера (наезд, резкий зум), реакции и «плевок кофе».
(() => {
const FX = PLAN.fx || {};
const TINT = { good: '#15aabf' };   // студия «Хорошего» — бирюзовая, чтобы не сливалась с обычной синей
const RCOL = s => TINT[s?.p?.rubric] || RUB[s?.p?.rubric]?.col || '#1b4596';
// цвет студии: рубрика текущей сцены, плавный переход от прошлой за 0,7 с
function studioTint(T) {
  const s = CUR; if (!s) return '#1b4596';
  const pv = SC[s.idx - 1], t = T - s.start;
  return mixHex(RCOL(pv), RCOL(s), pv ? eio(seg(t, 0, .7)) : 1);
}
const rubNow = () => CUR?.p?.rubric;

// ---------- окно за ведущими ----------
function screenContent(T, N, sx, sy, sw, sh, TC) {
  const nm = N && NMEDIA[N.n]?.[0], ni = nm && mediaImg(nm, T), R = RUB[rubNow()] || RUB.main;
  // фон экрана: градиент рубрики, точки, бегущие блики
  const sc = g.createLinearGradient(sx, sy, sx + sw, sy + sh); sc.addColorStop(0, shade(TC, .15)); sc.addColorStop(1, shade(TC, -.5)); g.fillStyle = sc; g.fillRect(sx, sy, sw, sh);
  if (ni?.naturalWidth) { g.save(); g.filter = 'blur(18px) brightness(.55)'; drawCover(ni, sx - 40, sy - 40, sw + 80, sh + 80, 1.1); g.restore(); g.fillStyle = TC + '55'; g.fillRect(sx, sy, sw, sh); }
  for (let y = sy + 20; y < sy + sh; y += 34) for (let x = sx + 20 + ((y / 34) % 2) * 17; x < sx + sw; x += 34) { const a = .1 + .08 * Math.sin(T * 2 + x * .01 + y * .02); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, 3, 0, 6.2832); g.fill(); }
  for (let k = 0; k < 3; k++) { const x = sx + ((T * 160 + k * 420) % (sw + 400)) - 200; g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(x, sy); g.lineTo(x + 120, sy); g.lineTo(x - 80, sy + sh); g.lineTo(x - 200, sy + sh); g.closePath(); g.fill(); }
  const cx = 960;   // середина между ведущими — её видно в вертикальном кадре
  if (!N) {
    newsGlobe(cx - 190, 245, 125, T); txt('ЗВЕРО', cx + 120, 235, { size: 112, w: 900, color: '#fff', align: 'center' });
    g.beginPath(); g.roundRect(cx - 100, 262, 440, 88, 12); g.fillStyle = NRED; g.fill(); inkStroke(5); txt('НОВОСТИ', cx + 120, 333, { size: 74, w: 900, color: '#fff', align: 'center' });
    return;
  }
  if (ni?.naturalWidth) {
    // «окно»: резкое фото в рамке над головами ведущих, медленный наезд
    const a = ni.naturalWidth / ni.naturalHeight, h = 300, w = clamp(h * a, 300, 560), x = cx - w / 2, y = 96;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 10, y + 16, w + 16, h + 16);
    g.fillStyle = '#fff'; g.fillRect(x - 8, y - 8, w + 16, h + 16);
    drawCover(ni, x, y, w, h, 1.04 + .05 * Math.sin(T * .35), 0, -.4);
    g.fillStyle = TC; g.fillRect(x - 8, y + h + 2, w + 16, 8);
  } else {
    // нет фото — большой значок темы на фоне рубрики
    if (rubNow() === 'ai') { g.save(); g.globalAlpha = .35; for (let i = 0; i < 9; i++) { const yy = sy + ((T * 60 + i * 60) % sh); g.fillStyle = '#9ff0ff'; g.fillRect(cx - 330, yy, 660, 2); } g.restore(); }
    g.save(); g.translate(cx, 250); g.rotate(T * .25); g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(420, -40); g.lineTo(420, 40); g.closePath(); g.fill(); } g.restore();
    newsIcon(rubNow() === 'good' ? 'people' : R.icon === 'people' ? 'people' : N.cat === 'people' ? R.icon : N.cat, cx, 250, 130 + Math.sin(T * 2) * 5, T);
  }
  // чип «НОВОСТЬ №» в углу окна
  g.beginPath(); g.roundRect(cx - 420, 96, 210, 54, 10); g.fillStyle = N.urgent ? NRED : NGOLD; g.fill(); inkStroke(4);
  txt(N.urgent ? 'СРОЧНО' : `НОВОСТЬ ${N.n}`, cx - 315, 134, { size: 32, w: 900, color: N.urgent ? '#fff' : INKC, align: 'center' });
  // глитч-полосы на экране в рубрике нейросетей
  if (rubNow() === 'ai' && (T % 1.7) < .14) { g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const yy = sy + rnd(Math.floor(T * 30) + i * 7.3) * sh; g.fillStyle = i % 2 ? 'rgba(255,60,200,.35)' : 'rgba(60,240,255,.35)'; g.fillRect(sx, yy, sw, 6 + rnd(i + T) * 26); } g.restore(); }
}

LOCATIONS.newsroom = function (T) {
  const TC = studioTint(T), TL = mixHex(TC, '#ffffff', .45);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, shade(TC, -.72)); bg.addColorStop(.55, shade(TC, -.38)); bg.addColorStop(1, shade(TC, -.75)); g.fillStyle = bg; g.fillRect(-200, -200, W + 400, H + 400);
  for (const x0 of [0, 1590]) {
    g.save(); g.beginPath(); g.rect(x0 + 20, 60, 310, 640); g.clip();
    const sky = g.createLinearGradient(0, 60, 0, 700); sky.addColorStop(0, '#1b1f4b'); sky.addColorStop(1, shade(TC, -.3)); g.fillStyle = sky; g.fillRect(x0, 60, 330, 640);
    for (let i = 0; i < 7; i++) { const bx = x0 + 10 + i * 48, bh = 180 + rnd(i * 3.7 + x0) * 320; g.fillStyle = '#0d1230'; g.fillRect(bx, 700 - bh, 44, bh);
      for (let wy = 700 - bh + 14; wy < 690; wy += 26) for (let wx = 0; wx < 3; wx++) if (rnd(i * 13 + wy * .7 + wx + x0) > .5) { g.fillStyle = 'rgba(255,214,102,.85)'; g.fillRect(bx + 6 + wx * 13, wy, 8, 12); } }
    g.restore(); for (let k = 0; k <= 2; k++) rline(x0 + 20 + k * 155, 60, x0 + 20 + k * 155, 700, 7800 + k + x0, 6); rrect(x0 + 20, 60, 310, 640, 7810 + x0, null, 8, 4);
  }
  // прожекторы в цвет рубрики; у «Звёзд» — шире и быстрее, как на красной дорожке
  const st = rubNow() === 'stars', sp = st ? 1.6 : .6, [r, gg, b] = [1, 3, 5].map(i => parseInt(TL.substr(i, 2), 16));
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) { const x = 260 + i * 280, sw = Math.sin(T * sp + i) * (st ? 160 : 60); const lg = g.createLinearGradient(x, 0, x + sw, 700); lg.addColorStop(0, `rgba(${r},${gg},${b},.26)`); lg.addColorStop(1, `rgba(${r},${gg},${b},0)`); g.fillStyle = lg; g.beginPath(); g.moveTo(x - 20, 0); g.lineTo(x + 20, 0); g.lineTo(x + sw + 160, 760); g.lineTo(x + sw - 160, 760); g.closePath(); g.fill(); }
  g.restore();
  for (let i = 0; i < 6; i++) { g.beginPath(); g.roundRect(236 + i * 280, -10, 48, 34, 8); g.fillStyle = '#2b3a55'; g.fill(); inkStroke(4); g.beginPath(); g.ellipse(260 + i * 280, 24, 18, 6, 0, 0, 6.2832); g.fillStyle = TL; g.fill(); }
  // стена-экран: рамка светится цветом рубрики
  const sx = 360, sy = 70, sw = 1200, sh = 480;
  g.save(); g.shadowColor = TL; g.shadowBlur = 40; g.beginPath(); g.roundRect(sx - 18, sy - 18, sw + 36, sh + 36, 26); g.fillStyle = '#050d22'; g.fill(); g.restore(); g.beginPath(); g.roundRect(sx - 18, sy - 18, sw + 36, sh + 36, 26); inkStroke(8);
  g.save(); g.beginPath(); g.roundRect(sx, sy, sw, sh, 14); g.clip();
  // смена новости — экран «переключается»: картинка схлопывается в полоску и раскрывается, шум
  const s = CUR, t = s ? T - s.start : 9, sw0 = s?.p?.news?.start || s?.p?.rubricStart ? seg(t, 0, .45) : 1;
  if (sw0 < 1) { const q = eo(sw0); g.translate(0, sy + sh / 2); g.scale(1, Math.max(.02, q)); g.translate(0, -(sy + sh / 2)); }
  screenContent(T, NEWS_NOW, sx, sy, sw, sh, TC);
  if (sw0 < 1) { for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${rnd(i + FR * 1.7) * .5 * (1 - sw0)})`; g.fillRect(sx + rnd(i * 3.1 + FR) * sw, sy + rnd(i * 5.3 + FR) * sh, 30, 4); } }
  g.restore();
  if (sw0 < 1) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,255,255,${.8 * (1 - sw0)})`; g.fillRect(sx, sy + sh / 2 - 3, sw, 6); g.restore(); }
  const fl = g.createLinearGradient(0, HZ, 0, H); fl.addColorStop(0, shade(TC, -.55)); fl.addColorStop(1, shade(TC, -.8)); g.fillStyle = fl; g.fillRect(-200, HZ, W + 400, H);
  g.save(); g.globalAlpha = .55; g.beginPath(); g.ellipse(CX, HZ + 160, 900, 110, 0, 0, 6.2832); g.strokeStyle = TL; g.lineWidth = 6; g.stroke(); g.globalAlpha = .2; g.lineWidth = 26; g.stroke(); g.restore();
  rline(-20, HZ, W + 20, HZ, 7820, 5);
};

// ---------- стол: подсветка в цвет рубрики, кружка уходит в лапу Крота; реакции над головами ----------
function mug() { g.beginPath(); g.roundRect(-30, -70, 60, 70, 8); g.fillStyle = NRED; g.fill(); inkStroke(4); g.beginPath(); g.arc(32, -36, 16, -1.3, 1.3); inkStroke(5); txt('₽', 0, -22, { size: 30, w: 900, color: '#fff', align: 'center' }); }
const mugInHand = T => CUR?.p?.sip || (CUR?.p?.spit && T - CUR.start < 1.4);
newsDesk = function (T, floorY, hosts) {
  const TC = studioTint(T), TL = mixHex(TC, '#ffffff', .45), y0 = floorY - 115;
  g.beginPath(); g.moveTo(80, y0 + 60); g.quadraticCurveTo(CX, y0 + 10, 1840, y0 + 60); g.lineTo(1800, H + 40); g.lineTo(120, H + 40); g.closePath();
  const fg = g.createLinearGradient(0, y0, 0, H); fg.addColorStop(0, shade(TC, -.1)); fg.addColorStop(1, shade(TC, -.6)); g.fillStyle = fg; g.fill(); inkStroke(7);
  g.save(); g.beginPath(); g.moveTo(110, y0 + 150); g.quadraticCurveTo(CX, y0 + 100, 1810, y0 + 150); g.strokeStyle = TL; g.lineWidth = 10; g.shadowColor = TL; g.shadowBlur = 24; g.stroke(); g.restore();
  g.beginPath(); g.moveTo(60, y0 + 30); g.quadraticCurveTo(CX, y0 - 30, 1860, y0 + 30); g.lineTo(1850, y0 + 62); g.quadraticCurveTo(CX, y0 + 8, 70, y0 + 62); g.closePath();
  const tg = g.createLinearGradient(0, y0 - 30, 0, y0 + 60); tg.addColorStop(0, '#f4f7fd'); tg.addColorStop(1, '#c9d3e6'); g.fillStyle = tg; g.fill(); inkStroke(6);
  newsGlobe(CX - 130, y0 + 92, 30, T, 2.5); txt('ЗВЕРО-НОВОСТИ', CX + 30, y0 + 105, { size: 38, w: 900, color: '#fff', align: 'center' });
  hosts.forEach((h, i) => {
    g.beginPath(); g.moveTo(h.x - 110, y0 + 14); g.lineTo(h.x + 110, y0 + 14); g.lineTo(h.x + 96, y0 - 46); g.lineTo(h.x - 96, y0 - 46); g.closePath(); g.fillStyle = '#fff'; g.fill(); inkStroke(5);
    txt(h.name.toUpperCase(), h.x, y0 - 2, { size: 38, w: 900, color: NAVY, align: 'center' });
    const px = h.x + (h.x < CX ? 190 : -190);
    if (i === 0) { for (let k = 0; k < 3; k++) { g.save(); g.translate(px, y0 + 6 - k * 6); g.rotate(-.08 + k * .05); g.beginPath(); g.rect(-60, -10, 120, 16); g.fillStyle = k % 2 ? '#fff' : '#eef2f8'; g.fill(); inkStroke(3); g.restore(); } }
    else if (!mugInHand(T)) { g.save(); g.translate(px, y0 + 10); mug(); g.restore(); }
  });
  // реакции над головами (p.pops): сердечки, «?!», «ВАУ», капля пота
  const s = CUR, t = s ? T - s.start : 0;
  for (const pp of s?.p?.pops || []) {
    const h = hosts.find(x => x.name === pp.who); if (!h) continue; const a = t - pp.at; if (a < 0 || a > 2.2) continue;
    const q = back(seg(a, 0, .3)), o = 1 - seg(a, 1.8, 2.2), hx = h.x + (h.x < CX ? 170 : -170), hy = floorY - 560;
    g.save(); g.globalAlpha = o; g.translate(hx, hy - a * 20); g.scale(q, q);
    if (pp.kind === 'hearts') for (let i = 0; i < 3; i++) { const yy = -i * 70 - a * 60, xx = (i - 1) * 60 + Math.sin(a * 4 + i) * 14, sc = .55 + i * .12; g.save(); g.translate(xx, yy); g.scale(sc, sc); g.beginPath(); g.moveTo(0, 50); g.bezierCurveTo(-90, -10, -55, -80, 0, -35); g.bezierCurveTo(55, -80, 90, -10, 0, 50); g.fillStyle = '#ff6b81'; g.fill(); inkStroke(6); g.restore(); }
    else if (pp.kind === 'sweat') { g.rotate(.2); g.beginPath(); g.moveTo(0, -60); g.quadraticCurveTo(40, 0, 0, 30); g.quadraticCurveTo(-40, 0, 0, -60); g.fillStyle = '#74c0fc'; g.fill(); inkStroke(5); }
    else { const word = pp.kind === 'wow' ? 'ВАУ!' : '?!'; g.rotate(-.12 + Math.sin(a * 20) * .04 * (1 - seg(a, 0, .6)));
      g.beginPath(); for (let i = 0; i < 18; i++) { const an = i / 18 * 6.2832, rr = i % 2 ? 70 : 104; g.lineTo(Math.cos(an) * rr * 1.25, Math.sin(an) * rr); } g.closePath(); g.fillStyle = pp.kind === 'wow' ? '#7be495' : NGOLD; g.fill(); inkStroke(7);
      txt(word, 0, 26, { size: 76, w: 900, color: INKC, align: 'center' }); }
    g.restore();
  }
};

// ---------- Крот: глоток кофе и «плевок» от цены ----------
const _dh = drawHamster;
drawHamster = function (L, x, y, k, P, E, T, o = {}) {
  const s = CUR; if (!L.mole || !s || !(s.p.sip || s.p.spit)) return _dh(L, x, y, k, P, E, T, o);
  P = { ...P }; E = { ...E }; const t = T - s.start, f = o.flip || 1, ch = 70;
  let up = 0, sip = false;
  if (s.p.sip) { // берёт кружку и прихлёбывает, глаза закрыты от удовольствия
    const lift = seg(t, .2, .7); up = emph(lift); sip = up > .5;
    P.hr = lerp(-30, 150, up); P.rSh = lerp(30, 120, up); P.head += -10 * up + Math.sin(t * 6) * 2 * up;
    if (sip) { E.sleep = 1; E.open = 0; E.smile = .5; }
  } else { // «Сколько?!»: брызги, глаза в очках-лупах, кружка опускается
    const a = t; P.head += -18 * Math.exp(-a * 6) * Math.sin(a * 30); E.glasses = 1; E.brow = .95; E.open = a < .5 ? .9 : E.open; E.shock = 1;
    up = 1 - emph(seg(a, .5, 1.2)); P.hr = lerp(40, 120, up); P.rSh = lerp(40, 100, up);
  }
  const held = fl => { if (sip) return; g.save(); g.scale(fl, 1); g.rotate(-.2); g.translate(0, 20); mug(); g.restore(); };
  _dh(L, x, y, k, P, E, T, { ...o, held: s.p.sip || t < 1.4 ? held : o.held });
  if (sip) { const ang = f * -1.1; g.save(); g.translate(x + f * 48 * k, y - 312 * k + Math.sin(t * 6) * 3 * k); g.rotate(ang); g.scale(k * 1.1, k * 1.1); g.translate(0, 64); mug(); g.restore(); }
  if (s.p.spit && t < .9) { // фонтан кофе изо рта — в сторону Совы и на камеру
    const mx = x + f * 30 * k, my = y - 285 * k;
    g.save(); g.globalAlpha = 1 - seg(t, .6, .9);
    const cone = g.createRadialGradient(mx, my, 10, mx, my, 260); cone.addColorStop(0, 'rgba(140,90,45,.45)'); cone.addColorStop(1, 'rgba(140,90,45,0)'); g.fillStyle = cone; g.beginPath(); g.moveTo(mx, my); g.arc(mx, my, 260 * seg(t, 0, .25), f > 0 ? -.5 : Math.PI - .5, f > 0 ? .5 : Math.PI + .5); g.closePath(); g.fill();
    for (let i = 0; i < 46; i++) { const an = (rnd(i * 2.7) - .5) * 1.1, sp = 500 + rnd(i * 5.1) * 900, tt = Math.max(0, t - rnd(i * 1.3) * .12), dx = Math.cos(an) * sp * tt * f, dy = Math.sin(an) * sp * tt + 900 * tt * tt, r = (5 + rnd(i * 9.1) * 12) * (1 + tt * 1.5);
      g.beginPath(); g.arc(mx + dx, my + dy, r, 0, 6.2832); g.fillStyle = i % 3 ? '#7a4a22' : '#a8723f'; g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(mx + dx - r * .3, my + dy - r * .3, r * .3, 0, 6.2832); g.fill(); }
    g.restore();
  }
};

// ---------- камера: медленный наезд на чтении, резкий зум на шутке ----------
window.cwOf2 = (sc, t) => {
  if (sc?.p?.crash) return 600;
  let w = cwOf(sc, t);
  if (PLAN.news && sc?.type === 'story' && w === 960 && !sc.p.say && !sc.p.hook && !sc.p.insert) w = 960 - 110 * eio(clamp(t / Math.max(1, sc.dur)));
  return w;
};
window.fxOf2 = (sc, t) => {
  if (sc?.p?.crash) { const c = (sc.p.cast || []).find(x => x.name === sc.p.say?.who); if (c) return c.x + (c.x < CX ? 40 : -40); }
  return fxOf(sc, t);
};
let src = composeCandy.toString()
  .replace('const k = eio(seg(t, 0, .45))', 'const k = s?.p?.crash ? eo(seg(t, 0, .14)) : eio(seg(t, 0, .45))')
  .replace(/cwOf\(/g, 'cwOf2(').replace(/fxOf\(/g, 'fxOf2(')
  .replace('const sc = 1080 / cw', 'const shk = s?.p?.crash ? Math.exp(-t * 7) : 0; const sc = 1080 / cw')
  .replace('CRX.drawImage(cvs, (fx - cw / 2) * SS, 0, cw * SS, 1080 * SS, 0, dy, 1080, dh);', 'CRX.drawImage(cvs, (fx - cw / 2 + Math.sin(t * 95) * 16 * shk) * SS, Math.abs(Math.cos(t * 80)) * 10 * shk * SS, cw * SS, 1080 * SS, 0, dy, 1080, dh);');
if (!/shk\) \* SS/.test(src) || !/cwOf2/.test(src)) throw new Error('patch composeCandy: замена не применилась');
composeCandy = eval('(' + src + ')');

// ---------- поверх кадра: фишки рубрик, заголовок-плашка, капли кофе на «объективе» ----------
const TMPC = document.createElement('canvas'); TMPC.width = 1080; TMPC.height = 1920; const TMPX = TMPC.getContext('2d');
function glitch(a, seed) { // RGB-сдвиг полосами по всему кадру
  TMPX.clearRect(0, 0, 1080, 1920); TMPX.drawImage(VC, 0, 0);
  for (let i = 0; i < 9; i++) { const y = rnd(seed + i * 3.3) * 1800, h = 20 + rnd(seed + i * 7.7) * 110, off = (rnd(seed + i * 1.9) - .5) * 240 * a; g.drawImage(TMPC, 0, y, 1080, h, off, y, 1080, h); }
  g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .5 * a; g.drawImage(TMPC, 14 * a, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(255,0,200,.15)'; g.fillRect(0, 0, 1080, 1920); g.restore();
  g.save(); g.globalAlpha = .25 * a; g.fillStyle = '#000'; for (let y = 0; y < 1920; y += 6) g.fillRect(0, y, 1080, 2); g.restore();
}
const _hud = newsHUD;
newsHUD = function (s, t, T0, hide) {
  const studio = s && s.type === 'story' && !s.p.insert && !s.p.hook, rub = s?.p?.rubric;
  if (hide < .5 && s) {
    // Звёзды: вспышки фотокамер папарацци по краям кадра + золотые искры
    if (rub === 'stars' && studio) {
      for (const fl of FX.flashes || []) { const a = T0 - fl.t; if (a < 0 || a > .16) continue; const q = (1 - a / .16) * .55;
        g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, 160); gr.addColorStop(0, `rgba(255,255,255,${q})`); gr.addColorStop(.3, `rgba(255,250,220,${.45 * q})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(fl.x - 160, fl.y - 160, 320, 320);
        g.strokeStyle = `rgba(255,255,255,${q})`; g.lineWidth = 4; g.beginPath(); g.moveTo(fl.x - 90, fl.y); g.lineTo(fl.x + 90, fl.y); g.moveTo(fl.x, fl.y - 90); g.lineTo(fl.x, fl.y + 90); g.stroke(); g.restore(); }
      for (let i = 0; i < 14; i++) { const x = rnd(i * 4.1) * 1080, y = 1500 - ((T0 * (40 + rnd(i) * 50) + rnd(i * 2.2) * 1400) % 1400), a = .4 + .4 * Math.sin(T0 * 5 + i); txt('✦', x, y, { size: 26 + rnd(i * 6.6) * 30, w: 900, color: NGOLD, align: 'center', alpha: a }); }
    }
    // Нейросети: глитч на входе в рубрику и в начале новости, цифры-голограмма по краям
    if (rub === 'ai') {
      const gt = s.p.rubricStart ? t - 1.05 : s.p.news?.start ? t : -1; if (gt >= 0 && gt < .35) glitch(1 - gt / .35, Math.floor(T0 * 30));
      if (studio) { g.save(); for (let i = 0; i < 26; i++) { const side = i % 2, x = side ? 960 + rnd(i * 3.7) * 100 : 20 + rnd(i * 3.7) * 100, y = 1450 - ((T0 * (60 + rnd(i) * 60) + rnd(i * 8.1) * 1100) % 1100); txt(rnd(i * 5 + Math.floor(T0 * 4)) > .5 ? '1' : '0', x, y, { size: 34, w: 800, color: '#7ef0ff', align: 'center', alpha: .45 }); } g.restore(); }
    }
    // Хорошие новости: залп конфетти на старте новости и сердечки снизу
    if (rub === 'good' && studio) {
      const ct = s.p.news?.start ? t - .35 : s.p.rubricStart ? -1 : 99, cols = ['#ffd43b', '#ff6b81', '#7be495', '#74c0fc', '#b197fc', '#fff'];
      if (ct >= 0 && ct < 4) for (let i = 0; i < 90; i++) { const vx = (rnd(i * 2.3) - .5) * 1300, vy = -900 - rnd(i * 4.4) * 900, x = 540 + vx * ct * .6, y = 1300 + vy * ct + 1100 * ct * ct * .9, r = ct * 6 + i; if (y > 1950) continue;
        g.save(); g.translate(x, y); g.rotate(r); g.scale(1, Math.sin(ct * 9 + i)); g.fillStyle = cols[i % cols.length]; g.fillRect(-12, -7, 24, 14); g.restore(); }
      for (let i = 0; i < 8; i++) { const x = 80 + rnd(i * 9.2) * 920, y = 1560 - ((T0 * 90 + rnd(i * 3.3) * 900) % 900), sc2 = .3 + rnd(i) * .25; g.save(); g.globalAlpha = .55 * Math.min(1, (1560 - y) / 200); g.translate(x + Math.sin(T0 * 2 + i) * 20, y); g.scale(sc2, sc2); g.beginPath(); g.moveTo(0, 50); g.bezierCurveTo(-90, -10, -55, -80, 0, -35); g.bezierCurveTo(55, -80, 90, -10, 0, 50); g.fillStyle = '#ff8fa3'; g.fill(); g.restore(); }
    }
  }
  _hud(s, t, T0, hide);
  // плашка-заголовок новости (как на ТВ): цветная метка рубрики + белая плашка с заголовком
  const N = s?.p?.news, R = RUB[rub];
  if (N && studio && hide < .5 && !(N.start && t < 2.0) && !s.p.crash && !s.p.rubricStart) {
    const t0 = N.start ? t - 2.0 : t, q = s.p.news.start || SC[s.idx - 1]?.p?.insert || SC[s.idx - 1]?.p?.news?.n !== N.n ? eo(seg(t0, 0, .35)) : 1;
    const lines = newsWrap(N.head.charAt(0).toUpperCase() + N.head.slice(1), 44, 900, 2), y = 1360, bh = lines.length * 54 + 30, total = (PLAN.news.items || []).length;
    g.save(); g.translate(-1100 * (1 - q), 0);
    const lab = `${R ? R.name : 'НОВОСТИ'}  ·  ${N.n} / ${total}`, lw = tw(lab, 30, 900) + 50;
    g.beginPath(); g.roundRect(36, y - 52, lw, 48, [10, 10, 0, 0]); g.fillStyle = R ? R.col : NAVY2; g.fill(); inkStroke(4); txt(lab, 61, y - 16, { size: 30, w: 900, color: '#fff' });
    g.beginPath(); g.roundRect(36, y, 1008, bh, [0, 12, 12, 12]); g.fillStyle = '#fff'; g.fill(); inkStroke(5);
    g.fillStyle = R ? R.col : NAVY2; g.fillRect(38, y + 2, 14, bh - 4);
    lines.forEach((l, i) => txt(l, 74, y + 58 + i * 54, { size: 44, w: 900, color: NAVY }));
    g.restore();
  }
  // кофе на «объективе»: капли сползают и тают
  if (s?.p?.spit) { const a = t - .16; if (a > 0 && a < 2.4) for (let i = 0; i < 9; i++) { const x = 140 + rnd(i * 3.9) * 800, y0 = 380 + rnd(i * 6.1) * 900, r = 26 + rnd(i * 2.2) * 50, y = y0 + a * a * 60 * (1 + rnd(i)), al = (1 - seg(a, 1.7, 2.4)) * Math.min(1, a * 12);
      g.save(); g.globalAlpha = al; const dg = g.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r); dg.addColorStop(0, 'rgba(170,110,60,.35)'); dg.addColorStop(.8, 'rgba(110,65,30,.6)'); dg.addColorStop(1, 'rgba(70,40,20,.75)'); g.fillStyle = dg; g.beginPath(); g.ellipse(x, y, r, r * 1.12, 0, 0, 6.2832); g.fill();
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(x - r * .35, y - r * .4, r * .22, r * .14, -.6, 0, 6.2832); g.fill(); g.fillStyle = 'rgba(110,65,30,.5)'; g.fillRect(x - r * .12, y, r * .24, a * 90); g.restore(); } }
};
// субтитры без подписи говорящего: «Крот: «Сколько?!»» → «Сколько?!»
const _cu = candyUnits;
candyUnits = function (sc) { if (sc._cu2) return sc._cu2; const u = _cu(sc).map(w => ({ ...w })); if (u.length > 1 && /^[А-ЯЁ][а-яё]+:$/.test(u[0].s)) u.shift(); for (const w of u) w.s = w.s.replace(/[«»"]/g, ''); return (sc._cu = sc._cu2 = u.filter(w => w.s)); };
})();
