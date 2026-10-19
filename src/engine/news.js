// «Зверо-новости»: студия (стена-экран с текущей новостью, ночной город в окнах, прожекторы), стол ведущих с табличками,
// поверх кадра — плашка «ЭФИР», бегущая строка, баннер «СРОЧНО», карточка «НОВОСТЬ №…» и заставка с глобусом.
let NEWS_NOW = null;   // новость текущей сцены: { n, head, cat, urgent } — выставляет T.story перед рисованием места
// настоящие фото и видео к новостям (plan.media): { n: [{ kind: 'photo', img } | { kind: 'video', imgs, fps }, credit] }
let NMEDIA = {}, NM_ALL = [];
function newsLoadMedia(media) {
  NMEDIA = {}; NM_ALL = [];
  const mk = src => { const i = new Image(); i.src = src; NM_ALL.push(i); return i; };
  for (const [n, list] of Object.entries(media || {})) NMEDIA[n] = list.map(m => m.kind === 'video' ? { kind: 'video', imgs: m.frames.map(mk), fps: m.fps || 12, credit: m.credit } : { kind: 'photo', img: mk(m.src), credit: m.credit });
}
window.newsMediaReady = () => Promise.all(NM_ALL.map(i => i.decode().catch(() => {})));
const mediaImg = (m, t) => m.kind === 'video' ? m.imgs[Math.floor(Math.max(0, t) * m.fps) % m.imgs.length] : m.img;
// картинка «под обрез» в прямоугольник, с лёгким наездом (zoom) и сдвигом (Кен Бёрнс)
function drawCover(img, x, y, w, h, zoom = 1, px = 0, py = 0) {
  if (!img?.naturalWidth) return; const k = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom, iw = img.naturalWidth * k, ih = img.naturalHeight * k;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.drawImage(img, x + (w - iw) / 2 + px * (iw - w) / 2, y + (h - ih) / 2 + py * (ih - h) / 2, iw, ih); g.restore();
}
// анонс выпуска: «СЕГОДНЯ В ВЫПУСКЕ» — мозаика из кадров всех новостей, дальше по фразе на новость — её фото на весь экран
const itemOf = n => (PLAN.news?.items || []).find(x => x.n === n);
function itemPic(it, t) { const m = it && NMEDIA[it.n]?.[0]; return m ? mediaImg(m, t) : null; }
function itemTile(it, x, y, w, h, t, zoom = 1) {
  const R = RUB[it?.rub] || RUB.main, img = itemPic(it, t);
  g.fillStyle = R.col; g.fillRect(x, y, w, h);
  if (img?.naturalWidth) drawCover(img, x, y, w, h, zoom); else newsIcon(it?.cat === 'people' || it?.cat === 'ai' ? it.cat : R.icon, x + w / 2, y + h / 2, Math.min(w, h) * .32, t);
}
function newsHookCard(t, s) {
  const h = s.p.hook; if (!h || !PLAN.news) return false;
  const fx = focusOf(s), items = PLAN.news.items || [];
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1a3d'); bg.addColorStop(1, '#163b80'); g.fillStyle = bg; g.fillRect(-200, -200, W + 400, H + 400);
  g.save(); g.translate(fx, 520); g.rotate(t * .2); g.fillStyle = 'rgba(255,255,255,.05)'; for (let i = 0; i < 14; i++) { g.rotate(Math.PI / 7); g.beginPath(); g.moveTo(0, 0); g.lineTo(1400, -100); g.lineTo(1400, 100); g.closePath(); g.fill(); } g.restore();
  if (h.head) {
    txt('СЕГОДНЯ', fx, 190, { size: 92, w: 900, color: '#fff', align: 'center' }); txt('В ВЫПУСКЕ', fx, 280, { size: 64, w: 900, color: NGOLD, align: 'center' });
    const n = Math.max(1, items.length), cols = n > 2 ? 2 : n, rows = Math.ceil(n / cols), tw2 = 320, th = 230, gx = 20;
    items.forEach((it, i) => { const c = i % cols, r = Math.floor(i / cols), q = back(seg(t, .15 + i * .12, .45 + i * .12)); if (q <= 0) return;
      const x = fx - (cols * tw2 + (cols - 1) * gx) / 2 + c * (tw2 + gx), y = 330 + r * (th + gx);
      g.save(); g.translate(x + tw2 / 2, y + th / 2); g.scale(q, q); g.rotate((i % 2 ? 1 : -1) * .03); g.fillStyle = '#fff'; g.fillRect(-tw2 / 2 - 8, -th / 2 - 8, tw2 + 16, th + 16); itemTile(it, -tw2 / 2, -th / 2, tw2, th, t); g.restore(); });
    return true;
  }
  const it = itemOf(h.item), R = RUB[it?.rub] || RUB.main, pop = back(seg(t, 0, .3)), cw = 680, ch = 620;
  g.save(); g.translate(fx, 120 + ch / 2); g.scale(pop, pop); g.rotate((h.item % 2 ? -1 : 1) * .02);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-cw / 2 + 4, -ch / 2 + 18, cw + 24, ch + 24); g.fillStyle = '#fff'; g.fillRect(-cw / 2 - 14, -ch / 2 - 14, cw + 28, ch + 28);
  itemTile(it, -cw / 2, -ch / 2, cw, ch, t, 1.02 + .06 * clamp(t / Math.max(1, s.dur)));
  const lw = tw(R.name, 36, 900) + 60; g.beginPath(); g.roundRect(-cw / 2 + 18, -ch / 2 + 18, lw, 58, 12); g.fillStyle = R.col; g.fill(); inkStroke(4); txt(R.name, -cw / 2 + 18 + lw / 2, -ch / 2 + 59, { size: 36, w: 900, color: '#fff', align: 'center' });
  g.restore();
  // точки-счётчик: какая по счёту новость
  const n = items.length || 1; for (let i = 0; i < n; i++) { g.beginPath(); g.arc(fx + (i - (n - 1) / 2) * 44, 120 + ch + 70, i + 1 === h.item ? 14 : 9, 0, 6.2832); g.fillStyle = i + 1 === h.item ? NGOLD : 'rgba(255,255,255,.5)'; g.fill(); }
  return true;
}
// вставка с настоящим кадром: размытая подложка, фото-«вырезка» на скотче (или экран с видео), газетная полоска с заголовком, подпись источника
function newsMediaInsert(t, s) {
  const p = s.p, N = p.news, list = N && NMEDIA[N.n]; if (!p.insert || !list?.length) return false;
  const m = list[(p.mi || 0) % list.length], img = mediaImg(m, t); if (!img) return false;
  const fx = focusOf(s), u = clamp(t / Math.max(1, s.dur)), video = m.kind === 'video';
  g.fillStyle = '#0b1020'; g.fillRect(-200, -200, W + 400, H + 400);
  g.save(); g.filter = 'blur(28px) brightness(.5)'; drawCover(img, -60, -60, W + 120, H + 120, 1.1); g.restore();
  const a = img.naturalWidth / img.naturalHeight, cw = 660, ch = clamp(cw / a, 360, 560), cy = 120 + (560 - ch) / 2, pop = back(seg(t, 0, .35));
  g.save(); g.translate(fx, cy + ch / 2); g.scale(pop, pop); g.rotate(video ? 0 : -.025);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-cw / 2 - 2, -ch / 2 + 14, cw + 28, ch + 28);
  g.fillStyle = video ? '#14151a' : '#fff'; g.fillRect(-cw / 2 - 16, -ch / 2 - 16, cw + 32, ch + 32);
  drawCover(img, -cw / 2, -ch / 2, cw, ch, 1.02 + .08 * u, video ? 0 : Math.sin(u * 2) * .4, -.2 + .4 * u);
  if (video) { g.beginPath(); g.roundRect(-cw / 2 + 14, -ch / 2 + 14, 150, 46, 10); g.fillStyle = NRED; g.fill(); txt('▶ ВИДЕО', -cw / 2 + 89, -ch / 2 + 46, { size: 28, w: 900, color: '#fff', align: 'center' }); }
  else for (const sd of [-1, 1]) { g.save(); g.translate(sd * (cw / 2 - 10), -ch / 2 - 6); g.rotate(sd * .6); g.fillStyle = 'rgba(245,230,180,.85)'; g.fillRect(-60, -18, 120, 36); g.restore(); }   // скотч
  g.restore();
  // газетная полоска с заголовком — «вырезка»
  const hl = newsWrap(N.head, 34, 600, 2), sy = cy + ch + 46, sh = hl.length * 42 + 30, sp = eo(seg(t, .25, .6));
  if (sp > 0) {
    g.save(); g.translate(fx + (1 - sp) * 300, sy); g.rotate(.015); g.globalAlpha = sp;
    g.beginPath(); g.moveTo(-340, 0); for (let x = -340; x <= 340; x += 20) g.lineTo(x, (x / 20) % 2 ? -4 : 3); g.lineTo(340, sh); for (let x = 340; x >= -340; x -= 20) g.lineTo(x, sh + ((x / 20) % 2 ? 4 : -3)); g.closePath();
    g.fillStyle = '#f4efe3'; g.fill(); g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2; g.stroke();
    hl.forEach((l, i) => txt(l, -310, 46 + i * 42, { size: 34, w: 900, color: INKC })); g.restore();
  }
  if (m.credit) { const cw2 = tw(m.credit, 22, 700) + 40; g.save(); g.globalAlpha = seg(t, .4, .7); g.beginPath(); g.roundRect(fx - cw2 / 2, sy + sh + 24, cw2, 40, 10); g.fillStyle = 'rgba(0,0,0,.55)'; g.fill(); txt(m.credit, fx, sy + sh + 52, { size: 22, w: 700, color: '#fff', align: 'center' }); g.restore(); }
  return true;
}
// рубрики выпуска: цвет плашки и перебивки, короткое имя (бегущая строка), значок на экране
const RUB = { stars: { col: '#f59f00', name: 'ЗВЁЗДЫ', icon: 'people' }, ai: { col: '#7048e8', name: 'ТЕХНОЛОГИИ', icon: 'ai' }, novelty: { col: '#2fbf71', name: 'НОВИНКИ', icon: 'shop' },
  main: { col: '#1b4596', name: 'ГЛАВНОЕ', icon: 'money' }, trend: { col: '#e64980', name: 'ТРЕНД ДНЯ', icon: 'trend' }, good: { col: '#1c7ed6', name: 'ХОРОШЕЕ', icon: 'good' } };
const NAVY = '#0f2a5c', NAVY2 = '#1b4596', NRED = '#e5383b', NGOLD = '#ffd43b', NSKY = '#4dabf7';
// перенос по словам под ширину (шрифт задаётся здесь же)
function newsWrap(text, size, maxW, maxLines = 3) {
  g.font = `900 ${size}px ${SANS}`; const out = []; let cur = '';
  for (const w of text.split(/\s+/)) { const t = cur ? cur + ' ' + w : w; if (cur && g.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur); if (out.length > maxLines) { out.length = maxLines; out[maxLines - 1] = out[maxLines - 1].replace(/\s*\S*$/, '') + '…'; } return out;
}
// картинка темы на экране студии
function newsIcon(cat, x, y, r, T) {
  g.save(); g.translate(x, y); const s = r / 100; g.scale(s, s);
  const glow = g.createRadialGradient(0, 0, 10, 0, 0, 150); glow.addColorStop(0, 'rgba(120,200,255,.45)'); glow.addColorStop(1, 'rgba(120,200,255,0)'); g.fillStyle = glow; g.beginPath(); g.arc(0, 0, 150, 0, 6.2832); g.fill();
  g.lineJoin = 'round'; g.lineCap = 'round';
  const W8 = c => { g.fillStyle = c; g.fill(); inkStroke(6); };
  if (cat === 'trend') { g.beginPath(); g.moveTo(20, -110); g.lineTo(-60, 15); g.lineTo(-5, 15); g.lineTo(-25, 110); g.lineTo(65, -20); g.lineTo(10, -20); g.closePath(); W8('#ff8cc6'); }
  else if (cat === 'good') { g.beginPath(); g.moveTo(-70, -90); g.lineTo(70, -90); g.quadraticCurveTo(70, 20, 0, 30); g.quadraticCurveTo(-70, 20, -70, -90); W8(NGOLD); g.beginPath(); g.roundRect(-14, 28, 28, 40, 4); W8(NGOLD); g.beginPath(); g.roundRect(-55, 66, 110, 26, 8); W8('#c98b2e'); txt('1', 0, -10, { size: 70, w: 900, color: INKC, align: 'center' }); }
  else if (cat === 'people') { g.save(); g.scale(1 + Math.sin(T * 5) * .05, 1 + Math.sin(T * 5) * .05); g.beginPath(); g.moveTo(0, 80); g.bezierCurveTo(-130, -10, -80, -110, 0, -50); g.bezierCurveTo(80, -110, 130, -10, 0, 80); W8('#ff6b81'); g.restore(); for (let i = 0; i < 5; i++) { const a = i * 1.26 + T; txt('✦', Math.cos(a) * 120, Math.sin(a) * 110, { size: 34, w: 900, color: NGOLD, align: 'center' }); } }
  else if (cat === 'ai') { // чип нейросети с «дорожками»
    for (let i = -2; i <= 2; i++) for (const sd of [-1, 1]) { rline(sd * 70, i * 24, sd * 112, i * 24, 7700 + i * 3 + sd, 6); rline(i * 24, sd * 70, i * 24, sd * 112, 7710 + i * 3 + sd, 6); }
    g.beginPath(); g.roundRect(-72, -72, 144, 144, 18); W8('#2b3a55'); g.beginPath(); g.roundRect(-50, -50, 100, 100, 10); g.fillStyle = `hsl(${200 + Math.sin(T * 3) * 20},90%,60%)`; g.fill();
    txt('AI', 0, 22, { size: 64, w: 900, color: '#fff', align: 'center' });
  } else if (cat === 'scam') { g.beginPath(); g.moveTo(0, -100); g.quadraticCurveTo(70, -80, 90, -70); g.quadraticCurveTo(90, 40, 0, 100); g.quadraticCurveTo(-90, 40, -90, -70); g.quadraticCurveTo(-70, -80, 0, -100); W8(NRED); txt('!', 0, 40, { size: 120, w: 900, color: '#fff', align: 'center' }); }
  else if (cat === 'rates') { g.beginPath(); g.arc(0, 0, 92, 0, 6.2832); W8('#2fbf71'); txt('%', 0, 40, { size: 120, w: 900, color: '#fff', align: 'center' }); }
  else if (cat === 'realty') { g.beginPath(); g.moveTo(-90, -10); g.lineTo(0, -95); g.lineTo(90, -10); g.lineTo(70, -10); g.lineTo(70, 90); g.lineTo(-70, 90); g.lineTo(-70, -10); g.closePath(); W8('#f2c94c'); g.beginPath(); g.roundRect(-20, 30, 40, 60, 4); W8('#8a5a2b'); }
  else if (cat === 'tax') { g.beginPath(); g.roundRect(-70, -95, 140, 190, 12); W8('#fff'); for (let i = 0; i < 4; i++) rline(-45, -55 + i * 30, 45, -55 + i * 30, 7720 + i, 5); g.beginPath(); g.arc(40, 60, 34, 0, 6.2832); W8(NRED); }
  else if (cat === 'work') { g.beginPath(); g.roundRect(-95, -50, 190, 130, 14); W8('#8a5a2b'); g.beginPath(); g.roundRect(-35, -80, 70, 34, 8); g.lineWidth = 12; g.strokeStyle = INKC; g.stroke(); rline(-95, 0, 95, 0, 7730, 6); }
  else if (cat === 'shop') { g.beginPath(); g.moveTo(-80, -40); g.lineTo(80, -40); g.lineTo(65, 95); g.lineTo(-65, 95); g.closePath(); W8('#a855f7'); g.beginPath(); g.arc(0, -40, 40, Math.PI, 0); g.lineWidth = 12; g.strokeStyle = INKC; g.stroke(); }
  else if (cat === 'prices') { g.save(); g.rotate(-.3); g.beginPath(); g.moveTo(-90, -50); g.lineTo(50, -50); g.lineTo(100, 0); g.lineTo(50, 50); g.lineTo(-90, 50); g.closePath(); W8(NGOLD); txt('₽', -20, 30, { size: 80, w: 900, color: INKC, align: 'center' }); g.restore(); g.beginPath(); g.moveTo(70, 90); g.lineTo(70, -10); g.moveTo(40, 20); g.lineTo(70, -12); g.lineTo(100, 20); g.lineWidth = 14; g.strokeStyle = NRED; g.stroke(); }
  else if (cat === 'tech') { g.beginPath(); g.roundRect(-55, -100, 110, 200, 18); W8('#1b1a20'); g.beginPath(); g.roundRect(-44, -82, 88, 160, 8); g.fillStyle = `hsl(${210 + Math.sin(T * 2) * 30},80%,62%)`; g.fill(); }
  else { for (let i = 3; i >= 0; i--) { g.beginPath(); g.ellipse(0, 40 - i * 32, 80, 24, 0, 0, 6.2832); W8(NGOLD); } txt('₽', 0, -52, { size: 46, w: 900, color: INKC, align: 'center' }); }
  g.restore();
}
// глобус: меридианы крутятся
function newsGlobe(x, y, r, T, lw = 5) {
  g.save(); g.translate(x, y);
  const gr = g.createRadialGradient(-r * .3, -r * .4, r * .1, 0, 0, r); gr.addColorStop(0, '#6cc4ff'); gr.addColorStop(1, '#1550b8'); g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.fillStyle = gr; g.fill();
  g.save(); g.clip(); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = lw;
  for (let i = 0; i < 6; i++) { const ph = (i / 6 + T * .12) % 1, rx = Math.abs(Math.cos(ph * Math.PI)) * r; g.beginPath(); g.ellipse(0, 0, rx, r, 0, 0, 6.2832); g.stroke(); }
  for (const k of [-.6, -.3, 0, .3, .6]) { g.beginPath(); g.ellipse(0, k * r, r * Math.sqrt(1 - k * k), r * .12 * Math.sqrt(1 - k * k), 0, 0, 6.2832); g.stroke(); }
  g.restore(); g.beginPath(); g.arc(0, 0, r, 0, 6.2832); g.strokeStyle = '#fff'; g.lineWidth = lw * 1.6; g.stroke(); g.restore();
}
Object.assign(LOCATIONS, {
  newsroom(T) {
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#08163a'); bg.addColorStop(.55, '#123072'); bg.addColorStop(1, '#08163a'); g.fillStyle = bg; g.fillRect(-200, -200, W + 400, H + 400);
    // ночной город в окнах по бокам
    for (const x0 of [0, 1590]) {
      g.save(); g.beginPath(); g.rect(x0 + 20, 60, 310, 640); g.clip();
      const sky = g.createLinearGradient(0, 60, 0, 700); sky.addColorStop(0, '#1b1f4b'); sky.addColorStop(1, '#5a3d8a'); g.fillStyle = sky; g.fillRect(x0, 60, 330, 640);
      for (let i = 0; i < 7; i++) { const bx = x0 + 10 + i * 48, bh = 180 + rnd(i * 3.7 + x0) * 320; g.fillStyle = '#0d1230'; g.fillRect(bx, 700 - bh, 44, bh);
        for (let wy = 700 - bh + 14; wy < 690; wy += 26) for (let wx = 0; wx < 3; wx++) if (rnd(i * 13 + wy * .7 + wx + x0) > .45 + .3 * Math.sin(T * .5 + i + wy) * .3) { g.fillStyle = 'rgba(255,214,102,.85)'; g.fillRect(bx + 6 + wx * 13, wy, 8, 12); } }
      g.restore(); for (let k = 0; k <= 2; k++) rline(x0 + 20 + k * 155, 60, x0 + 20 + k * 155, 700, 7800 + k + x0, 6); rrect(x0 + 20, 60, 310, 640, 7810 + x0, null, 8, 4);
    }
    // прожекторы и лучи
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const x = 260 + i * 280, sw = Math.sin(T * .6 + i) * 60; const lg = g.createLinearGradient(x, 0, x + sw, 700); lg.addColorStop(0, 'rgba(120,180,255,.22)'); lg.addColorStop(1, 'rgba(120,180,255,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(x - 20, 0); g.lineTo(x + 20, 0); g.lineTo(x + sw + 160, 760); g.lineTo(x + sw - 160, 760); g.closePath(); g.fill(); }
    g.restore();
    for (let i = 0; i < 6; i++) { g.beginPath(); g.roundRect(236 + i * 280, -10, 48, 34, 8); g.fillStyle = '#2b3a55'; g.fill(); inkStroke(4); }
    // стена-экран
    const sx = 360, sy = 70, sw = 1200, sh = 480;
    g.beginPath(); g.roundRect(sx - 18, sy - 18, sw + 36, sh + 36, 26); g.fillStyle = '#050d22'; g.fill(); inkStroke(8);
    g.save(); g.beginPath(); g.roundRect(sx, sy, sw, sh, 14); g.clip();
    const sc = g.createLinearGradient(sx, sy, sx + sw, sy + sh); sc.addColorStop(0, '#1e5cc8'); sc.addColorStop(1, '#0c2c78'); g.fillStyle = sc; g.fillRect(sx, sy, sw, sh);
    for (let y = sy + 20; y < sy + sh; y += 34) for (let x = sx + 20 + ((y / 34) % 2) * 17; x < sx + sw; x += 34) { const a = .12 + .1 * Math.sin(T * 2 + x * .01 + y * .02); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, 3, 0, 6.2832); g.fill(); }
    for (let k = 0; k < 3; k++) { const x = sx + ((T * 160 + k * 420) % (sw + 400)) - 200; g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(x, sy); g.lineTo(x + 120, sy); g.lineTo(x - 80, sy + sh); g.lineTo(x - 200, sy + sh); g.closePath(); g.fill(); }
    const N = NEWS_NOW;
    if (N) {
      // картинка темы — слева (её видно за ведущей), заголовок — справа (за соведущим)
      const nm = NMEDIA[N.n]?.[0], ni = nm && mediaImg(nm, T);
      if (ni?.naturalWidth) { g.fillStyle = '#fff'; g.fillRect(424, 180, 392, 330); drawCover(ni, 434, 190, 372, 310, 1.04 + Math.sin(T * .5) * .03); }
      else newsIcon(N.cat, 620, 330, 125 + Math.sin(T * 2) * 4, T);
      g.beginPath(); g.roundRect(440, 100, 330, 64, 10); g.fillStyle = N.urgent ? NRED : NGOLD; g.fill(); inkStroke(5);
      txt(N.urgent ? 'СРОЧНО' : `НОВОСТЬ №${N.n}`, 605, 147, { size: 40, w: 900, color: N.urgent ? '#fff' : INKC, align: 'center' });
      const lines = newsWrap(N.head.toUpperCase(), 50, 640, 4); lines.forEach((l, i) => txt(l, 860, 190 + i * 66 + (4 - lines.length) * 33, { size: 50, w: 900, color: '#fff' }));
      g.fillStyle = NGOLD; g.fillRect(860, 190 + lines.length * 66 + (4 - lines.length) * 33 - 30, 180, 8);
    } else {
      newsGlobe(700, 310, 150, T); txt('ЗВЕРО', 1140, 290, { size: 120, w: 900, color: '#fff', align: 'center' });
      g.beginPath(); g.roundRect(900, 320, 480, 96, 12); g.fillStyle = NRED; g.fill(); inkStroke(5); txt('НОВОСТИ', 1140, 395, { size: 80, w: 900, color: '#fff', align: 'center' });
    }
    g.restore();
    // пол: глянец и светящаяся дуга
    const fl = g.createLinearGradient(0, HZ, 0, H); fl.addColorStop(0, '#0d2453'); fl.addColorStop(1, '#06112c'); g.fillStyle = fl; g.fillRect(-200, HZ, W + 400, H);
    g.save(); g.globalAlpha = .5; g.beginPath(); g.ellipse(CX, HZ + 160, 900, 110, 0, 0, 6.2832); g.strokeStyle = NSKY; g.lineWidth = 6; g.stroke(); g.globalAlpha = .18; g.lineWidth = 26; g.stroke(); g.restore();
    rline(-20, HZ, W + 20, HZ, 7820, 5);
  },
});
// стол ведущих: столешница-дуга, фасад с логотипом и светящейся полосой, таблички с именами, бумаги и кружка
function newsDesk(T, floorY, hosts) {
  const y0 = floorY - 115;   // ведущих видно по грудь
  g.beginPath(); g.moveTo(80, y0 + 60); g.quadraticCurveTo(CX, y0 + 10, 1840, y0 + 60); g.lineTo(1800, H + 40); g.lineTo(120, H + 40); g.closePath();
  const fg = g.createLinearGradient(0, y0, 0, H); fg.addColorStop(0, NAVY2); fg.addColorStop(1, NAVY); g.fillStyle = fg; g.fill(); inkStroke(7);
  g.save(); g.beginPath(); g.moveTo(110, y0 + 150); g.quadraticCurveTo(CX, y0 + 100, 1810, y0 + 150); g.strokeStyle = NSKY; g.lineWidth = 10; g.shadowColor = NSKY; g.shadowBlur = 24; g.stroke(); g.restore();
  g.beginPath(); g.moveTo(60, y0 + 30); g.quadraticCurveTo(CX, y0 - 30, 1860, y0 + 30); g.lineTo(1850, y0 + 62); g.quadraticCurveTo(CX, y0 + 8, 70, y0 + 62); g.closePath();
  const tg = g.createLinearGradient(0, y0 - 30, 0, y0 + 60); tg.addColorStop(0, '#f4f7fd'); tg.addColorStop(1, '#c9d3e6'); g.fillStyle = tg; g.fill(); inkStroke(6);
  // логотип по центру фасада
  newsGlobe(CX - 130, y0 + 92, 30, T, 2.5); txt('ЗВЕРО-НОВОСТИ', CX + 30, y0 + 105, { size: 38, w: 900, color: '#fff', align: 'center' });
  // таблички с именами и мелочи на столе
  hosts.forEach((h, i) => {
    g.beginPath(); g.moveTo(h.x - 110, y0 + 14); g.lineTo(h.x + 110, y0 + 14); g.lineTo(h.x + 96, y0 - 46); g.lineTo(h.x - 96, y0 - 46); g.closePath(); g.fillStyle = '#fff'; g.fill(); inkStroke(5);
    txt(h.name.toUpperCase(), h.x, y0 - 2, { size: 38, w: 900, color: NAVY, align: 'center' });
    const px = h.x + (h.x < CX ? 190 : -190);
    if (i === 0) { for (let k = 0; k < 3; k++) { g.save(); g.translate(px, y0 + 6 - k * 6); g.rotate(-.08 + k * .05); g.beginPath(); g.rect(-60, -10, 120, 16); g.fillStyle = k % 2 ? '#fff' : '#eef2f8'; g.fill(); inkStroke(3); g.restore(); } }
    else { g.beginPath(); g.roundRect(px - 30, y0 - 60, 60, 70, 8); g.fillStyle = NRED; g.fill(); inkStroke(4); g.beginPath(); g.arc(px + 32, y0 - 26, 16, -1.3, 1.3); inkStroke(5); txt('₽', px, y0 - 12, { size: 30, w: 900, color: '#fff', align: 'center' }); }
  });
}
// ---------- поверх кадра (экранные координаты 1080×1920) ----------
function newsHUD(s, t, T0, hide) {
  if (!PLAN.news) return; const a = 1 - hide;
  if (a > 0) {
    g.save(); g.globalAlpha = a;
    // «● ЭФИР» + логотип + часы
    g.beginPath(); g.roundRect(36, 34, 178, 64, 14); g.fillStyle = NRED; g.fill(); inkStroke(4);
    g.beginPath(); g.arc(72, 66, 12, 0, 6.2832); g.fillStyle = `rgba(255,255,255,${.55 + .45 * Math.sin(T0 * 6)})`; g.fill(); txt('ЭФИР', 142, 80, { size: 36, w: 900, color: '#fff', align: 'center' });
    g.beginPath(); g.roundRect(226, 34, 360, 64, 14); g.fillStyle = NAVY; g.fill(); inkStroke(4); txt('ЗВЕРО-НОВОСТИ', 406, 79, { size: 36, w: 900, color: '#fff', align: 'center' });
    if (PLAN.news.clock) { g.beginPath(); g.roundRect(598, 34, 130, 64, 14); g.fillStyle = '#fff'; g.fill(); inkStroke(4); txt(PLAN.news.clock, 663, 79, { size: 34, w: 900, color: NAVY, align: 'center' }); }
    // бегущая строка
    const y = 1688, h = 72, urgent = s?.p?.news?.urgent, R = RUB[s?.p?.rubric], label = urgent ? 'СРОЧНО' : R ? R.name : 'НОВОСТИ';
    g.fillStyle = NAVY; g.fillRect(0, y, 1080, h); g.fillStyle = NSKY; g.fillRect(0, y, 1080, 5);
    const items = (PLAN.news.ticker || []).length ? PLAN.news.ticker : ['ГЛАВНОЕ ПРО ДЕНЬГИ, РАБОТУ И ТЕХНОЛОГИИ'], line = items.map(x => x.toUpperCase()).join('   ●   ') + '   ●   ';
    g.font = `800 34px ${SANS}`; const lw = Math.max(400, g.measureText(line).width);
    g.save(); g.beginPath(); g.rect(230, y, 850, h); g.clip(); let x = 250 - (T0 * 150) % lw; for (; x < 1080; x += lw) txt(line, x, y + 50, { size: 34, w: 800, color: '#fff' }); g.restore();
    g.beginPath(); g.moveTo(0, y); g.lineTo(230, y); g.lineTo(212, y + h); g.lineTo(0, y + h); g.closePath(); g.fillStyle = urgent ? NRED : R ? R.col : NGOLD; g.fill();
    txt(label, 106, y + 50, { size: label.length > 7 ? 28 : 36, w: 900, color: urgent || R ? '#fff' : INKC, align: 'center' });
    g.restore();
  }
  // вставка-репортаж: рамка видоискателя, плашка «РЕПОРТАЖ · ТЕМА», вспышка на склейке
  if (s?.p?.insert && hide < .5) {
    if (t < .18) { g.fillStyle = `rgba(255,255,255,${.5 * (1 - t / .18)})`; g.fillRect(0, 0, 1080, 1920); }
    g.save(); g.strokeStyle = '#fff'; g.lineWidth = 8; g.lineCap = 'round';
    for (const [x, y, dx, dy] of [[60, 190, 1, 1], [1020, 190, -1, 1], [60, 1560, 1, -1], [1020, 1560, -1, -1]]) { g.beginPath(); g.moveTo(x, y + dy * 70); g.lineTo(x, y); g.lineTo(x + dx * 70, y); g.stroke(); }
    const topic = { people: 'ЗВЁЗДЫ', ai: 'ТЕХНОЛОГИИ', scam: 'МОШЕННИКИ', rates: 'СТАВКИ', realty: 'ЖИЛЬЁ', tax: 'ЗАКОНЫ', work: 'РАБОТА', shop: 'ПОКУПКИ', prices: 'ЦЕНЫ', tech: 'ТЕХНОЛОГИИ', money: 'ДЕНЬГИ' }[s.p.news?.cat] || 'ДЕНЬГИ';
    const label = 'РЕПОРТАЖ · ' + (RUB[s.p.rubric]?.name || topic), w = tw(label, 34, 900) + 70, q = eo(seg(t, 0, .3));
    g.translate(-w * (1 - q), 0); g.beginPath(); g.roundRect(36, 116, w, 60, 12); g.fillStyle = '#fff'; g.fill(); inkStroke(4);
    g.beginPath(); g.moveTo(66, 132); g.lineTo(66, 160); g.lineTo(90, 146); g.closePath(); g.fillStyle = NRED; g.fill();
    txt(label, 104, 159, { size: 34, w: 900, color: NAVY }); g.restore();
  }
  // плашка рубрики под «ЭФИР» (в студии)
  const R = RUB[s?.p?.rubric];
  if (R && !s.p.insert && !s.p.hook && hide < .5) { const w = tw(R.name, 34, 900) + 70; g.save(); g.beginPath(); g.roundRect(36, 116, w, 60, 12); g.fillStyle = R.col; g.fill(); inkStroke(4); g.beginPath(); g.arc(64, 146, 10, 0, 6.2832); g.fillStyle = '#fff'; g.fill(); txt(R.name, 88, 159, { size: 34, w: 900, color: '#fff' }); g.restore(); }
  // смена рубрики: перебивка на весь экран — цветная волна, значок и название
  if (s?.p?.rubricStart && R && t < 1.25 && hide < .5) {
    const inn = eio(seg(t, 0, .3)), out = eio(seg(t, .95, 1.25));
    g.save(); g.beginPath(); g.moveTo(-200 + 2400 * out, 0); g.lineTo(-200 + 2400 * inn + 600, 0); g.lineTo(-200 + 2400 * inn - 200, 1920); g.lineTo(-200 + 2400 * out - 800, 1920); g.closePath(); g.fillStyle = R.col; g.fill();
    g.clip(); g.globalAlpha = .12; g.fillStyle = '#fff'; for (let k = 0; k < 12; k++) { g.beginPath(); g.arc(540, 820, 120 + k * 90 + (t * 300) % 90, 0, 6.2832); g.lineWidth = 30; g.strokeStyle = '#fff'; g.stroke(); } g.globalAlpha = 1;
    const p = back(seg(t, .12, .45)); g.translate(540, 820); g.scale(p, p); newsIcon(R.icon, 0, -40, 170, T0); txt(R.name, 0, 260, { size: 110, w: 900, color: '#fff', align: 'center' }); g.restore();
  }
  // начало новости: «СРОЧНО» или карточка «НОВОСТЬ №…»
  const N = s?.p?.news; if (!N?.start || hide > .5) return;
  if (N.urgent) {
    const q = eo(seg(t, 0, .3)), o = eio(seg(t, 2.1, 2.5)); if (o >= 1) return;
    g.fillStyle = `rgba(229,56,59,${.28 * (1 - seg(t, 0, .45))})`; g.fillRect(0, 0, 1080, 1920);
    g.save(); g.translate(540 + (1 - q) * -1200 + o * 1200, 330); g.rotate(-.04);
    g.beginPath(); g.rect(-600, -84, 1200, 168); g.fillStyle = NRED; g.fill(); inkStroke(7);
    g.save(); g.clip(); g.globalAlpha = .18; g.fillStyle = '#fff'; for (let k = -12; k < 14; k++) { const xx = k * 90 + (t * 240) % 90; g.beginPath(); g.moveTo(xx, -90); g.lineTo(xx + 40, -90); g.lineTo(xx - 20, 90); g.lineTo(xx - 60, 90); g.closePath(); g.fill(); } g.restore();
    const flash = Math.sin(t * 14) > 0; g.strokeStyle = flash ? NGOLD : '#fff'; g.lineWidth = 8; g.strokeRect(-560, -64, 1120, 128);
    txt('СРОЧНО!', 0, 42, { size: 120, w: 900, color: '#fff', align: 'center' }); g.restore();
  } else {
    const q = back(seg(t, 0, .35)), o = eio(seg(t, 1.7, 2.05)); if (o >= 1) return;
    g.save(); g.translate(540 + o * 1300, 330); g.rotate(.03); g.scale(q, q);
    g.beginPath(); g.roundRect(-300, -96, 600, 192, 26); g.fillStyle = NAVY; g.fill(); inkStroke(7);
    txt('НОВОСТЬ', -60, 30, { size: 80, w: 900, color: '#fff', align: 'center' });
    g.beginPath(); g.arc(196, 0, 70, 0, 6.2832); g.fillStyle = NGOLD; g.fill(); inkStroke(6); txt('№' + N.n, 196, 26, { size: 64, w: 900, color: INKC, align: 'center' });
    g.restore();
  }
}
// заставка: глобус, лучи, «ЗВЕРО / НОВОСТИ»; через 1,3 с уезжает вверх и открывает студию
function newsSting(T0) {
  if (!PLAN.news || T0 > 1.75) return;
  const out = eio(seg(T0, 1.3, 1.7)), pop = back(seg(T0, 0, .4));
  g.save(); g.translate(0, -1920 * out);
  const bg = g.createRadialGradient(540, 820, 50, 540, 900, 1200); bg.addColorStop(0, '#1e5cc8'); bg.addColorStop(1, '#06122e'); g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
  g.save(); g.translate(540, 820); g.rotate(T0 * .6); g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(1400, -120); g.lineTo(1400, 120); g.closePath(); g.fill(); } g.restore();
  g.save(); g.translate(540, 820); g.scale(pop, pop); g.translate(-540, -820); newsGlobe(540, 820, 250, T0 * 3, 7); g.restore();
  const l1 = eo(seg(T0, .2, .55)), l2 = eo(seg(T0, .35, .7));
  g.save(); g.translate(-700 * (1 - l1), 0); txt('ЗВЕРО', 540, 1250, { size: 190, w: 900, color: '#fff', align: 'center' }); g.restore();
  g.save(); g.translate(700 * (1 - l2), 0); g.rotate(-.03); g.beginPath(); g.roundRect(150, 1300, 780, 160, 18); g.fillStyle = NRED; g.fill(); inkStroke(8); txt('НОВОСТИ', 540, 1420, { size: 130, w: 900, color: '#fff', align: 'center' }); g.restore();
  if (PLAN.news.date) txt('ВЫПУСК · ' + PLAN.news.date, 540, 1540, { size: 40, w: 800, color: NGOLD, align: 'center', alpha: seg(T0, .6, .9) });
  // блик по логотипу
  const sx = -300 + seg(T0, .7, 1.2) * 1700; g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,255,255,.25)'; g.beginPath(); g.moveTo(sx, 1150); g.lineTo(sx + 120, 1150); g.lineTo(sx - 40, 1480); g.lineTo(sx - 160, 1480); g.closePath(); g.fill(); g.restore();
  g.restore();
}
