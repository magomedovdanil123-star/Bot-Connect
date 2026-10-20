// «Зверо-новости»: студия (стена-экран с текущей новостью, ночной город в окнах, прожекторы), стол ведущих с табличками,
// поверх кадра — плашка «ЭФИР», бегущая строка, баннер «СРОЧНО», карточка «НОВОСТЬ №…» и заставка с глобусом.
let NEWS_NOW = null;   // новость текущей сцены: { n, head, cat, urgent } — выставляет T.story перед рисованием места
// настоящие фото и видео к новостям (plan.media): { n: [{ kind: 'photo', img } | { kind: 'video', imgs, fps }, credit] }
let NMEDIA = {}, NM_ALL = [];
let PROP = null, PROPC = null;
let USER_BG = [], PHOTO_NOW = 0;   // свои фото автора (улицы, кафе…) — фон сцен «photo»; PHOTO_NOW — номер фото текущей сцены   // товар из пожелания автора (фото банки и т. п.): Крот его пьёт или показывает
function newsLoadMedia(media) {
  NMEDIA = {}; NM_ALL = []; PROP = PROPC = null; USER_BG = [];
  const mk = src => { const i = new Image(); i.src = src; NM_ALL.push(i); return i; };
  if (media?.prop?.[0]?.src) PROP = mk(media.prop[0].src);
  USER_BG = (media?.bg || []).map(m => mk(m.src));
  for (const [n, list] of Object.entries(media || {})) if (n !== 'prop' && n !== 'bg') NMEDIA[n] = list.map(m => m.kind === 'video' ? { kind: 'video', imgs: m.frames.map(mk), fps: m.fps || 12, credit: m.credit } : { kind: 'photo', img: mk(m.src), credit: m.credit });
}
window.newsMediaReady = () => Promise.all(NM_ALL.map(i => i.decode().catch(() => {}))).then(() => { if (PROP?.naturalWidth) PROPC = cutout(PROP); });
// фото товара без прозрачности: фон (цвет углов) заливкой от краёв делаем прозрачным и обрезаем по товару
function cutout(img) {
  const w = Math.min(700, img.naturalWidth), h = Math.round(img.naturalHeight * w / img.naturalWidth), c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); const id = x.getImageData(0, 0, w, h), d = id.data, at = (i, j) => (j * w + i) * 4;
  const corners = [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]].map(([i, j]) => at(i, j));
  if (!corners.some(k => d[k + 3] < 200)) {   // уже есть прозрачность (PNG) — не трогаем
    const bg = [0, 1, 2].map(ch => corners.reduce((a, k) => a + d[k + ch], 0) / 4), near = k => Math.abs(d[k] - bg[0]) + Math.abs(d[k + 1] - bg[1]) + Math.abs(d[k + 2] - bg[2]) < 70;
    const seen = new Uint8Array(w * h), st = [];
    for (let i = 0; i < w; i++) st.push(i, 0, i, h - 1); for (let j = 0; j < h; j++) st.push(0, j, w - 1, j);
    while (st.length) { const j = st.pop(), i = st.pop(); if (i < 0 || j < 0 || i >= w || j >= h || seen[j * w + i]) continue; seen[j * w + i] = 1; const k = at(i, j); if (!near(k)) continue; d[k + 3] = 0; st.push(i + 1, j, i - 1, j, i, j + 1, i, j - 1); }
    x.putImageData(id, 0, 0);
  }
  let x0 = w, y0 = h, x1 = 0, y1 = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (d[at(i, j) + 3] > 40) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
  if (x1 <= x0 || y1 <= y0) return c; const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1; o.getContext('2d').drawImage(c, -x0, -y0); return o;
}
// размытая подложка из фото: картинка, ужатая до 40 px, при растягивании сама становится мягкой — в разы дешевле фильтра blur на каждом кадре
const SOFT = new WeakMap();
function softImg(img) { let c = SOFT.get(img); if (!c && img?.naturalWidth) { c = document.createElement('canvas'); c.width = 40; c.height = Math.max(8, Math.round(40 * img.naturalHeight / img.naturalWidth)); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height); SOFT.set(img, c); } return c; }
const mediaImg = (m, t) => m.kind === 'video' ? m.imgs[Math.floor(Math.max(0, t) * m.fps) % m.imgs.length] : m.img;
// картинка «под обрез» в прямоугольник, с лёгким наездом (zoom) и сдвигом (Кен Бёрнс)
function drawCover(img, x, y, w, h, zoom = 1, px = 0, py = 0) {
  const nw = img?.naturalWidth || img?.width, nh = img?.naturalHeight || img?.height; if (!nw) return; const k = Math.max(w / nw, h / nh) * zoom, iw = nw * k, ih = nh * k;
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
  g.save(); g.imageSmoothingQuality = 'high'; drawCover(softImg(img), -60, -60, W + 120, H + 120, 1.1); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(-60, -60, W + 120, H + 120); g.restore();
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
// студия красится в цвет рубрики текущей сцены (у «Хорошего» — бирюза, чтобы не сливаться с обычной синей); смена — плавно за 0,7 с
const STUDIO_TINT = { good: '#15aabf' };
const rubCol = s => STUDIO_TINT[s?.p?.rubric] || RUB[s?.p?.rubric]?.col || NAVY2;
function studioTint(T) {
  const s = CUR; if (!s) return NAVY2;
  const pv = SC[s.idx - 1]; return mixHex(rubCol(pv), rubCol(s), pv ? eio(seg(T - s.start, 0, .7)) : 1);
}
// стена-экран: середина (между ведущими) видна в вертикальном кадре — там «окно» с фото новости или большой значок темы
function newsScreen(T, N, sx, sy, sw, sh, TC) {
  const rub = CUR?.p?.rubric, R = RUB[rub] || RUB.main, nm = N && NMEDIA[N.n]?.[0], ni = nm && mediaImg(nm, T), cx = 960;
  const sc = g.createLinearGradient(sx, sy, sx + sw, sy + sh); sc.addColorStop(0, shade(TC, .15)); sc.addColorStop(1, shade(TC, -.5)); g.fillStyle = sc; g.fillRect(sx, sy, sw, sh);
  if (ni?.naturalWidth) { g.save(); g.imageSmoothingQuality = 'high'; drawCover(softImg(ni), sx - 40, sy - 40, sw + 80, sh + 80, 1.1); g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(sx, sy, sw, sh); g.restore(); g.fillStyle = TC + '55'; g.fillRect(sx, sy, sw, sh); }
  for (let y = sy + 20; y < sy + sh; y += 34) for (let x = sx + 20 + ((y / 34) % 2) * 17; x < sx + sw; x += 34) { const a = .1 + .08 * Math.sin(T * 2 + x * .01 + y * .02); g.fillStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(x, y, 3, 0, 6.2832); g.fill(); }
  for (let k = 0; k < 3; k++) { const x = sx + ((T * 160 + k * 420) % (sw + 400)) - 200; g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.moveTo(x, sy); g.lineTo(x + 120, sy); g.lineTo(x - 80, sy + sh); g.lineTo(x - 200, sy + sh); g.closePath(); g.fill(); }
  if (!N) {
    newsGlobe(cx - 190, 245, 125, T); txt('ЗВЕРО', cx + 120, 235, { size: 112, w: 900, color: '#fff', align: 'center' });
    g.beginPath(); g.roundRect(cx - 100, 262, 440, 88, 12); g.fillStyle = NRED; g.fill(); inkStroke(5); txt('НОВОСТИ', cx + 120, 333, { size: 74, w: 900, color: '#fff', align: 'center' });
    return;
  }
  if (ni?.naturalWidth) { // «окно»: резкое фото в белой рамке над головами ведущих, медленный наезд
    const a = ni.naturalWidth / ni.naturalHeight, h = 300, w = clamp(h * a, 300, 560), x = cx - w / 2, y = 96;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x + 10, y + 16, w + 16, h + 16); g.fillStyle = '#fff'; g.fillRect(x - 8, y - 8, w + 16, h + 16);
    drawCover(ni, x, y, w, h, 1.04 + .05 * Math.sin(T * .35), 0, -.4); g.fillStyle = TC; g.fillRect(x - 8, y + h + 2, w + 16, 8);
  } else {
    if (rub === 'ai') { g.save(); g.globalAlpha = .35; for (let i = 0; i < 9; i++) { const yy = sy + ((T * 60 + i * 60) % sh); g.fillStyle = '#9ff0ff'; g.fillRect(cx - 330, yy, 660, 2); } g.restore(); }   // голограмма
    g.save(); g.translate(cx, 250); g.rotate(T * .25); g.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 12; i++) { g.rotate(Math.PI / 6); g.beginPath(); g.moveTo(0, 0); g.lineTo(420, -40); g.lineTo(420, 40); g.closePath(); g.fill(); } g.restore();
    newsIcon(rub === 'good' || rub === 'stars' ? 'people' : N.cat === 'people' || N.cat === 'money' ? R.icon : N.cat, cx, 250, 130 + Math.sin(T * 2) * 5, T);
  }
  g.beginPath(); g.roundRect(cx - 420, 96, 210, 54, 10); g.fillStyle = N.urgent ? NRED : NGOLD; g.fill(); inkStroke(4);
  txt(N.urgent ? 'СРОЧНО' : `НОВОСТЬ ${N.n}`, cx - 315, 134, { size: 32, w: 900, color: N.urgent ? '#fff' : INKC, align: 'center' });
  if (rub === 'ai' && (T % 1.7) < .14) { g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 5; i++) { const yy = sy + rnd(Math.floor(T * 30) + i * 7.3) * sh; g.fillStyle = i % 2 ? 'rgba(255,60,200,.35)' : 'rgba(60,240,255,.35)'; g.fillRect(sx, yy, sw, 6 + rnd(i + T) * 26); } g.restore(); }   // глитч-полосы «Технологий»
}
Object.assign(LOCATIONS, {
  newsroom(T) {
    const TC = studioTint(T), TL = mixHex(TC, '#ffffff', .45);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, shade(TC, -.72)); bg.addColorStop(.55, shade(TC, -.38)); bg.addColorStop(1, shade(TC, -.75)); g.fillStyle = bg; g.fillRect(-200, -200, W + 400, H + 400);
    // ночной город в окнах по бокам
    for (const x0 of [0, 1590]) {
      g.save(); g.beginPath(); g.rect(x0 + 20, 60, 310, 640); g.clip();
      const sky = g.createLinearGradient(0, 60, 0, 700); sky.addColorStop(0, '#1b1f4b'); sky.addColorStop(1, shade(TC, -.3)); g.fillStyle = sky; g.fillRect(x0, 60, 330, 640);
      for (let i = 0; i < 7; i++) { const bx = x0 + 10 + i * 48, bh = 180 + rnd(i * 3.7 + x0) * 320; g.fillStyle = '#0d1230'; g.fillRect(bx, 700 - bh, 44, bh);
        for (let wy = 700 - bh + 14; wy < 690; wy += 26) for (let wx = 0; wx < 3; wx++) if (rnd(i * 13 + wy * .7 + wx + x0) > .5) { g.fillStyle = 'rgba(255,214,102,.85)'; g.fillRect(bx + 6 + wx * 13, wy, 8, 12); } }
      g.restore(); for (let k = 0; k <= 2; k++) rline(x0 + 20 + k * 155, 60, x0 + 20 + k * 155, 700, 7800 + k + x0, 6); rrect(x0 + 20, 60, 310, 640, 7810 + x0, null, 8, 4);
    }
    // прожекторы в цвет рубрики; у «Звёзд» качаются шире и быстрее — как на красной дорожке
    const st = CUR?.p?.rubric === 'stars', sp = st ? 1.6 : .6, [r, gg, b] = [1, 3, 5].map(i => parseInt(TL.substr(i, 2), 16));
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) { const x = 260 + i * 280, sw = Math.sin(T * sp + i) * (st ? 160 : 60); const lg = g.createLinearGradient(x, 0, x + sw, 700); lg.addColorStop(0, `rgba(${r},${gg},${b},.26)`); lg.addColorStop(1, `rgba(${r},${gg},${b},0)`); g.fillStyle = lg; g.beginPath(); g.moveTo(x - 20, 0); g.lineTo(x + 20, 0); g.lineTo(x + sw + 160, 760); g.lineTo(x + sw - 160, 760); g.closePath(); g.fill(); }
    g.restore();
    for (let i = 0; i < 6; i++) { g.beginPath(); g.roundRect(236 + i * 280, -10, 48, 34, 8); g.fillStyle = '#2b3a55'; g.fill(); inkStroke(4); g.beginPath(); g.ellipse(260 + i * 280, 24, 18, 6, 0, 0, 6.2832); g.fillStyle = TL; g.fill(); }
    // стена-экран: рамка светится цветом рубрики; на смене новости или рубрики — «переключение канала» (схлопывание в полоску и шум)
    const sx = 360, sy = 70, sw = 1200, sh = 480;
    g.save(); g.shadowColor = TL; g.shadowBlur = 40; g.beginPath(); g.roundRect(sx - 18, sy - 18, sw + 36, sh + 36, 26); g.fillStyle = '#050d22'; g.fill(); g.restore(); g.beginPath(); g.roundRect(sx - 18, sy - 18, sw + 36, sh + 36, 26); inkStroke(8);
    const s = CUR, sw0 = s && (s.p?.news?.start || s.p?.rubricStart) ? seg(T - s.start, 0, .45) : 1;
    g.save(); g.beginPath(); g.roundRect(sx, sy, sw, sh, 14); g.clip();
    if (sw0 < 1) { g.translate(0, sy + sh / 2); g.scale(1, Math.max(.02, eo(sw0))); g.translate(0, -(sy + sh / 2)); }
    newsScreen(T, NEWS_NOW, sx, sy, sw, sh, TC);
    if (sw0 < 1) for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(255,255,255,${rnd(i + FR * 1.7) * .5 * (1 - sw0)})`; g.fillRect(sx + rnd(i * 3.1 + FR) * sw, sy + rnd(i * 5.3 + FR) * sh, 30, 4); }
    g.restore();
    if (sw0 < 1) { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,255,255,${.8 * (1 - sw0)})`; g.fillRect(sx, sy + sh / 2 - 3, sw, 6); g.restore(); }
    newsDecorBack(T);   // праздничный декор: паутина и летучие мыши / гирлянда
    // пол: глянец и светящаяся дуга
    const fl = g.createLinearGradient(0, HZ, 0, H); fl.addColorStop(0, shade(TC, -.55)); fl.addColorStop(1, shade(TC, -.8)); g.fillStyle = fl; g.fillRect(-200, HZ, W + 400, H);
    g.save(); g.globalAlpha = .55; g.beginPath(); g.ellipse(CX, HZ + 160, 900, 110, 0, 0, 6.2832); g.strokeStyle = TL; g.lineWidth = 6; g.stroke(); g.globalAlpha = .2; g.lineWidth = 26; g.stroke(); g.restore();
    rline(-20, HZ, W + 20, HZ, 7820, 5);
  },
});
// стаканчик кофе навынос, как в кофейне: графитовый двухслойный, белый ободок снизу, крышка, красная лента «ЗВЕРО НОВОСТИ»; низ — в (0, 0)
function newsCup(steam = 0) {
  const h = 104, tw2 = 34, bw = 25;
  g.beginPath(); g.moveTo(-tw2, -h); g.lineTo(tw2, -h); g.lineTo(bw, 0); g.lineTo(-bw, 0); g.closePath();
  const cg = g.createLinearGradient(-tw2, 0, tw2, 0); cg.addColorStop(0, '#2a2d33'); cg.addColorStop(.35, '#4a4f58'); cg.addColorStop(1, '#25282d'); g.fillStyle = cg; g.fill(); inkStroke(4);
  g.beginPath(); g.moveTo(-bw - .5, -9); g.lineTo(bw + .5, -9); g.lineTo(bw, 0); g.lineTo(-bw, 0); g.closePath(); g.fillStyle = '#f1f3f5'; g.fill(); inkStroke(3);
  g.beginPath(); g.moveTo(-31, -70); g.lineTo(31, -70); g.lineTo(29, -46); g.lineTo(-29, -46); g.closePath(); g.fillStyle = NRED; g.fill();
  txt('ЗВЕРО', 0, -59, { size: 13, w: 900, color: '#fff', align: 'center' }); txt('НОВОСТИ', 0, -48.5, { size: 10, w: 900, color: '#fff', align: 'center' });
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(-22, -h + 6, 6, h - 18);
  g.beginPath(); g.roundRect(-tw2 - 6, -h - 8, (tw2 + 6) * 2, 12, 5); g.fillStyle = '#3a3e45'; g.fill(); inkStroke(3.5);
  g.beginPath(); g.roundRect(-tw2 + 2, -h - 18, (tw2 - 2) * 2, 11, [6, 6, 0, 0]); g.fillStyle = '#4a4f58'; g.fill(); inkStroke(3.5);
  g.beginPath(); g.ellipse(14, -h - 18, 7, 3, 0, 0, 6.2832); g.fillStyle = '#16181c'; g.fill();
  if (steam > 0) { g.save(); g.lineCap = 'round'; for (let i = 0; i < 3; i++) { const ph = (FR / FPS * .8 + i * .33) % 1; g.globalAlpha = steam * .55 * Math.sin(Math.PI * ph); g.beginPath(); g.moveTo(-12 + i * 12, -h - 24 - ph * 40); g.bezierCurveTo(-20 + i * 12, -h - 40 - ph * 40, -4 + i * 12, -h - 52 - ph * 40, -12 + i * 12, -h - 68 - ph * 40); g.strokeStyle = '#fff'; g.lineWidth = 5; g.stroke(); } g.restore(); }
}
// предмет в лапе Крота: товар с фото (p.prop) или стаканчик; низ — в (0, 0), рисуется высотой hh; возвращает высоту
function newsThing(p, steam = 0, hh = 122) {
  if (p?.propKind && NEWS_PROPS[p.propKind]) { NEWS_PROPS[p.propKind](hh); return hh; }   // нарисованный предмет («Крот показывает резюме»)
  if (p?.prop && PROPC) { const w = hh * PROPC.width / PROPC.height; g.drawImage(PROPC, -w / 2, -hh, w, hh); return hh; }
  newsCup(steam); return 122;
}
const cupInPaw = (p, t) => p.sip || p.show || (p.spit && t < 1.4);
// стол ведущих: столешница-дуга, фасад с логотипом и подсветкой в цвет рубрики, таблички, бумаги Совы, стаканчик Крота; над головами — реакции
function newsDesk(T, floorY, hosts) {
  const TC = studioTint(T), TL = mixHex(TC, '#ffffff', .45), y0 = floorY - 115, s = CUR, t = s ? T - s.start : 0;   // ведущих видно по грудь
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
    else if (!(s && cupInPaw(s.p, t))) { g.save(); g.translate(px, y0 + 12); newsThing({ prop: PROPC && SC.slice(0, (s?.idx ?? -1) + 1).some(x => x.p?.prop) }, 1); g.restore(); }   // после товара на столе стоит он, а не кофе
  });
  newsDecorDesk(T, floorY);   // тыквы / ёлка на столе
  // реакции над головами (p.pops): сердечки, капля пота, «ВАУ!» — сбоку от головы, со стороны середины кадра
  for (const pp of s?.p?.pops || []) {
    const h = hosts.find(x => x.name === pp.who), a = t - pp.at; if (!h || a < 0 || a > 2.2) continue;
    const q = back(seg(a, 0, .3)), hx = h.x + (h.x < CX ? 170 : -170), hy = floorY - 560;
    g.save(); g.globalAlpha = 1 - seg(a, 1.8, 2.2); g.translate(hx, hy - a * 20); g.scale(q, q);
    if (pp.kind === 'hearts') for (let i = 0; i < 3; i++) { const sc = .55 + i * .12; g.save(); g.translate((i - 1) * 60 + Math.sin(a * 4 + i) * 14, -i * 70 - a * 60); g.scale(sc, sc); g.beginPath(); g.moveTo(0, 50); g.bezierCurveTo(-90, -10, -55, -80, 0, -35); g.bezierCurveTo(55, -80, 90, -10, 0, 50); g.fillStyle = '#ff6b81'; g.fill(); inkStroke(6); g.restore(); }
    else if (pp.kind === 'sweat') { g.rotate(.2); g.beginPath(); g.moveTo(0, -60); g.quadraticCurveTo(40, 0, 0, 30); g.quadraticCurveTo(-40, 0, 0, -60); g.fillStyle = '#74c0fc'; g.fill(); inkStroke(5); }
    else { g.rotate(-.12); g.beginPath(); for (let i = 0; i < 18; i++) { const an = i / 18 * 6.2832, rr = i % 2 ? 70 : 104; g.lineTo(Math.cos(an) * rr * 1.25, Math.sin(an) * rr); } g.closePath(); g.fillStyle = '#7be495'; g.fill(); inkStroke(7); txt('ВАУ!', 0, 26, { size: 76, w: 900, color: INKC, align: 'center' }); }
    g.restore();
  }
}
// ---------- ведущие живые: поворот друг к другу в разговоре, кофе Крота ----------
// когда ведущие перекидываются репликами («Имя: «…»»), они за полсекунды разворачиваются друг к другу (на три четверти), потом обратно к камере
const newsTalk = s => !!(s && s.type === 'story' && s.p.place === 'newsroom' && s.p.say && !s.p.hook && !s.p.insert);
function newsTurn(s, t, c) {
  if (!PLAN.news || s.p.place !== 'newsroom' || !['owl', 'mole'].includes(c.kind)) return 0;
  let u = lerp(newsTalk(SC[s.idx - 1]) ? 1 : 0, newsTalk(s) ? 1 : 0, eio(seg(t, 0, .5)));
  if (s.p.crash && c.name === s.p.say?.who) u *= 1 - seg(t, 0, .12);   // «Сколько?!» — резко к камере
  return u;
}
// поза Крота с кофе: p.sip — берёт стаканчик, пьёт с открытым ртом (три глотка), «а-ах» с кофейными усами; p.spit — «Сколько?!» с брызгами
function newsCoffeePose(p, t, P, E, f) {
  if (p.show) { const u = back(seg(t, .1, .5)); P.hr = lerp(-30, 150, u); P.rSh = lerp(30, 130, u); E.smile = 1; E.open = .4; P.lift = -Math.abs(Math.sin(t * 7)) * 8 * u; return { show: true }; }
  if (p.sip) {
    const at = eio(seg(t, .15, .65)) * (1 - eio(seg(t, 2.25, 2.75))), gulp = t > .8 && t < 2.2 ? Math.pow(Math.sin(((t - .8) / .45) * Math.PI), 2) : 0;
    P.head += (-9 * at - 3 * gulp) * f; P.lean += -3 * at * f; P.hr = lerp(-30, 125, at); P.rSh = lerp(30, 95, at); P.rEl = lerp(P.rEl, 70, at);
    if (at > .55) { E.sleep = 1; E.smile = 0; }
    E.open = t > .45 && t < 2.3 ? .55 * seg(t, .45, .65) : t >= 2.3 ? .7 * (1 - seg(t, 2.9, 3.3)) : 0; E.talk = 0;
    if (t >= 2.4) { E.sleep = 0; E.smile = 1; E.blush = .6; }
    return { at, gulp, drink: seg(t, .7, 2.2) };
  }
  P.head += -18 * Math.exp(-t * 6) * Math.sin(t * 30); E.glasses = 1; E.brow = .95; if (t < .5) E.open = .9;
  const up = 1 - emph(seg(t, .5, 1.2)); P.hr = lerp(40, 120, up); P.rSh = lerp(40, 100, up);
  return null;
}
// глоток длится 3,4 с; если фраза короче — анимация ускоряется (но не быстрее, чем за 2 с)
const newsSipK = s => Math.max(1, 3.4 / Math.max(2, s.dur));
// стаканчик у рта (после того как Крот нарисован) и брызги «Сколько?!»
function newsCoffeeDraw(p, t, st, floorY) {
  const x = st.x, y = floorY + st.dy, k = st.k, f = st.c.flip, P = st.P;
  if (p.show) { const u = back(seg(t, .1, .5)); g.save(); g.translate(x + f * 175 * k, y - (300 + 90 * u) * k); g.rotate(f * .08 * Math.sin(t * 3)); g.scale(k * u, k * u); newsThing(p, 0, 190); g.restore(); return; }   // «Крот показывает …» — предмет в поднятой лапе, ровно
  if (p.sip && st.coffee) {
    const C = st.coffee, Lr = P.lean * D2R, mx = x + k * f * 112 * Math.sin(Lr) + f * 16 * k, my = y + k * (-150 - 112 * Math.cos(Lr)) + 4 * k;   // уголок рта
    const s2 = k * 1.15, el = (6 + 24 * C.drink) * D2R, th = Math.atan2(-f * Math.cos(el), -Math.sin(el)) * C.at;   // дно уходит вверх-вперёд
    const hh = p.prop && PROPC ? 128 : 122;
    g.save(); g.translate(lerp(x + (x < CX ? 190 : -190), mx, C.at), lerp(y - 103 - hh * s2, my, C.at) + C.gulp * 4 * k); g.rotate(th); g.scale(s2, s2); g.translate(0, hh - 10); newsThing(p, C.at < .1 ? 1 : 0, hh); g.restore();
    if (t > 2.4 && t < 3.4) { g.save(); g.globalAlpha = 1 - seg(t, 3.1, 3.4); g.translate(mx, my - 12 * k); g.scale(k, k); g.beginPath(); g.moveTo(-30, 0); g.quadraticCurveTo(-15, -12, 0, -4); g.quadraticCurveTo(15, -12, 30, 0); g.quadraticCurveTo(15, -4, 0, 3); g.quadraticCurveTo(-15, -4, -30, 0); g.fillStyle = '#6b3f1d'; g.fill(); g.restore(); }   // кофейные усы
  }
  if (p.spit && t < .9) { // фонтан кофе изо рта — в сторону Совы и на камеру
    const mx = x + f * 30 * k, my = y - 285 * k;
    g.save(); g.globalAlpha = 1 - seg(t, .6, .9);
    const cone = g.createRadialGradient(mx, my, 10, mx, my, 260); cone.addColorStop(0, 'rgba(140,90,45,.45)'); cone.addColorStop(1, 'rgba(140,90,45,0)'); g.fillStyle = cone; g.beginPath(); g.moveTo(mx, my); g.arc(mx, my, 260 * seg(t, 0, .25), f > 0 ? -.5 : Math.PI - .5, f > 0 ? .5 : Math.PI + .5); g.closePath(); g.fill();
    for (let i = 0; i < 46; i++) { const an = (rnd(i * 2.7) - .5) * 1.1, sp = 500 + rnd(i * 5.1) * 900, tt = Math.max(0, t - rnd(i * 1.3) * .12), dx = Math.cos(an) * sp * tt * f, dy = Math.sin(an) * sp * tt + 900 * tt * tt, r = (5 + rnd(i * 9.1) * 12) * (1 + tt * 1.5);
      g.beginPath(); g.arc(mx + dx, my + dy, r, 0, 6.2832); g.fillStyle = i % 3 ? '#7a4a22' : '#a8723f'; g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(mx + dx - r * .3, my + dy - r * .3, r * .3, 0, 6.2832); g.fill(); }
    g.restore();
  }
}
const newsCupHeld = fl => { g.save(); g.scale(fl, 1); g.rotate(-.2); g.translate(0, 40); newsCup(); g.restore(); };
// «Крот показывает …»: товар в поднятой лапе, крупно

// ---------- поверх кадра (экранные координаты 1080×1920) ----------
// ---------- наряды по дням сезона (plan.news.look) и праздники (plan.news.holiday) ----------
// аксессуары на костюм (рисуются в клипе туловища) и шапки (в системе головы, макушка ~ y −464)
const NEWS_ACC = {
  pearls(L) { for (let i = 0; i <= 12; i++) { const a = Math.PI * (.12 + .76 * i / 12), x = Math.cos(a) * 78, y = -232 + Math.sin(a) * 36; g.beginPath(); g.arc(x, y, 9, 0, 6.2832); const pg = g.createRadialGradient(x - 3, y - 3, 1, x, y, 9); pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#e3dccd'); g.fillStyle = pg; g.fill(); inkStroke(2.5); } },
  bowtie(L) { const c = L.bow || '#e8394d'; g.beginPath(); g.moveTo(0, -200); g.lineTo(-44, -224); g.lineTo(-44, -174); g.closePath(); g.moveTo(0, -200); g.lineTo(44, -224); g.lineTo(44, -174); g.closePath(); g.fillStyle = c; g.fill(); inkStroke(4); g.beginPath(); g.arc(0, -200, 11, 0, 6.2832); g.fillStyle = shade(c, -.2); g.fill(); inkStroke(3); },
  scarf(L) { const c = L.scarf || '#ffd43b'; g.beginPath(); g.ellipse(0, -224, 120, 34, 0, 0, 6.2832); g.fillStyle = c; g.fill(); inkStroke(5); g.beginPath(); g.moveTo(40, -214); g.lineTo(84, -214); g.lineTo(96, -100); g.lineTo(52, -104); g.closePath(); g.fill(); inkStroke(5); for (const y of [-130, -116]) { g.beginPath(); g.moveTo(54, y); g.lineTo(94, y - 2); g.strokeStyle = shade(c, -.25); g.lineWidth = 5; g.stroke(); } },
};
const NEWS_HATS = {
  beret(T, sway, L) { g.save(); g.translate(30, -458); g.rotate(-.18); g.beginPath(); g.ellipse(0, -10, 150, 46, 0, 0, 6.2832); g.fillStyle = L.beret || '#1b1a20'; g.fill(); inkStroke(6); g.beginPath(); g.moveTo(-4, -54); g.lineTo(4, -78); inkStroke(7); g.restore(); },
  witch(T, sway) { g.beginPath(); g.ellipse(0, -450, 205, 34, 0, 0, 6.2832); g.fillStyle = '#2b2140'; g.fill(); inkStroke(6); g.beginPath(); g.moveTo(-100, -462); g.quadraticCurveTo(-30, -620, 60 + sway * 2, -730); g.quadraticCurveTo(40, -600, 100, -462); g.closePath(); g.fillStyle = '#3b2d5c'; g.fill(); inkStroke(6); g.beginPath(); g.moveTo(-96, -484); g.quadraticCurveTo(0, -470, 98, -484); g.lineTo(96, -508); g.quadraticCurveTo(0, -496, -92, -508); g.closePath(); g.fillStyle = '#f76707'; g.fill(); inkStroke(4); },
  santa(T, sway) { g.beginPath(); g.moveTo(-140, -452); g.quadraticCurveTo(-40, -640, 140 + sway * 2, -590); g.quadraticCurveTo(70, -540, 140, -452); g.closePath(); g.fillStyle = '#e5383b'; g.fill(); inkStroke(6); g.beginPath(); g.roundRect(-150, -476, 300, 40, 20); g.fillStyle = '#fff'; g.fill(); inkStroke(5); g.beginPath(); g.arc(140 + sway * 2, -590, 30, 0, 6.2832); g.fillStyle = '#fff'; g.fill(); inkStroke(5); },
  cap() { hatCap(); },
  pumpkin(T, sway) { g.save(); g.translate(0, -470); for (const [x, w] of [[-62, 58], [62, 58], [0, 64]]) { g.beginPath(); g.ellipse(x, 0, w, 62, 0, 0, 6.2832); g.fillStyle = x ? '#e8590c' : '#fd7e14'; g.fill(); inkStroke(5); }
    g.beginPath(); g.moveTo(-6, -58); g.quadraticCurveTo(0, -96, 20, -104); inkStroke(9); g.strokeStyle = '#2f9e44'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#1b1a20'; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 30, -14); g.lineTo(sd * 46, 10); g.lineTo(sd * 14, 10); g.closePath(); g.fill(); } g.beginPath(); g.moveTo(-34, 26); g.lineTo(-16, 36); g.lineTo(0, 26); g.lineTo(16, 36); g.lineTo(34, 26); g.lineTo(20, 44); g.lineTo(-20, 44); g.closePath(); g.fill(); g.restore(); },
};
const newsLook = c => PLAN.news?.look?.[c.kind] || {};
// праздничный декор студии: Хэллоуин — тыквы, паутина и летучие мыши; Новый год — гирлянда, ёлка и снег
function newsDecorBack(T) {
  const h = PLAN.news?.holiday; if (!h) return;
  if (h === 'halloween') {
    for (const [cx, cy, sx] of [[360, 70, 1], [1560, 70, -1]]) { g.save(); g.translate(cx, cy); g.scale(sx, 1); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; for (let i = 0; i < 6; i++) { const a = i / 5 * Math.PI / 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 200, Math.sin(a) * 200); g.stroke(); } for (let r = 40; r <= 200; r += 40) { g.beginPath(); for (let i = 0; i <= 5; i++) { const a = i / 5 * Math.PI / 2, rr = r * (i % 2 ? .9 : 1); i ? g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } g.stroke(); } g.restore(); }
    for (let i = 0; i < 4; i++) { const x = ((T * 120 + i * 520) % 2400) - 240, y = 140 + Math.sin(T * 3 + i * 2) * 50 + i * 40, w = Math.sin(T * 18 + i) * 22; g.save(); g.translate(x, y); g.fillStyle = '#1b1a20'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-30, -20 - w, -60, -4); g.quadraticCurveTo(-36, -2, -30, 10); g.quadraticCurveTo(-14, 2, 0, 10); g.quadraticCurveTo(14, 2, 30, 10); g.quadraticCurveTo(36, -2, 60, -4); g.quadraticCurveTo(30, -20 - w, 0, 0); g.fill(); g.restore(); }
  }
  if (h === 'newyear') {
    for (let i = 0; i < 26; i++) { const x = 360 + i * 48, y = 62 + Math.sin(i * .9) * 10; g.beginPath(); g.ellipse(x, y + 14, 9, 13, 0, 0, 6.2832); const on = (Math.floor(T * 3) + i) % 3; g.fillStyle = ['#ff6b6b', '#ffd43b', '#69db7c', '#74c0fc'][i % 4]; g.globalAlpha = on ? 1 : .45; g.fill(); g.globalAlpha = 1; inkStroke(2.5); }
    g.beginPath(); for (let i = 0; i <= 26; i++) { const x = 360 + i * 48, y = 62 + Math.sin(i * .9) * 10; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = '#2f9e44'; g.lineWidth = 4; g.stroke();
  }
}
function newsDecorDesk(T, floorY) {
  const h = PLAN.news?.holiday, y0 = floorY - 115; if (!h) return;
  if (h === 'halloween') for (const [x, s] of [[560, 1], [1380, .85]]) { g.save(); g.translate(x, y0 + 4); g.scale(s, s);
    for (const [px, w] of [[-34, 40], [34, 40], [0, 44]]) { g.beginPath(); g.ellipse(px, -46, w, 48, 0, 0, 6.2832); g.fillStyle = px ? '#e8590c' : '#fd7e14'; g.fill(); inkStroke(4); }
    const fl = .7 + .3 * Math.sin(T * 9 + x); g.fillStyle = `rgba(255,212,59,${fl})`; for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 24, -60); g.lineTo(sd * 36, -40); g.lineTo(sd * 12, -40); g.closePath(); g.fill(); } g.beginPath(); g.moveTo(-26, -24); g.lineTo(-12, -16); g.lineTo(0, -24); g.lineTo(12, -16); g.lineTo(26, -24); g.lineTo(16, -10); g.lineTo(-16, -10); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(0, -92); g.lineTo(6, -112); inkStroke(7); g.restore(); }
  if (h === 'newyear') { g.save(); g.translate(500, y0 + 6); for (let k = 0; k < 3; k++) { const w = 90 - k * 22, yy = -k * 50; g.beginPath(); g.moveTo(-w, yy); g.lineTo(0, yy - 90); g.lineTo(w, yy); g.closePath(); g.fillStyle = k % 2 ? '#2b8a3e' : '#2f9e44'; g.fill(); inkStroke(4); }
    for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(-50 + rnd(i * 3.3) * 100, -20 - rnd(i * 5.1) * 120, 7, 0, 6.2832); g.fillStyle = ['#ff6b6b', '#ffd43b', '#74c0fc'][i % 3]; g.fill(); } txt('★', 0, -170, { size: 54, w: 900, color: NGOLD, align: 'center' }); g.restore(); }
}
function newsDecorFront(T0) {   // поверх кадра (экранные координаты): снег под Новый год
  if (PLAN.news?.holiday !== 'newyear') return;
  g.save(); g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 60; i++) { const x = (rnd(i * 2.1) * 1080 + Math.sin(T0 * .8 + i) * 30) % 1080, y = (rnd(i * 4.7) * 1920 + T0 * (60 + rnd(i) * 80)) % 1920, r = 2 + rnd(i * 7.7) * 5; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill(); } g.restore();
}
// ---------- предметы, которые Крот показывает: нарисованные (резюме, табличка, печенье, морковка, микрофон); низ — в (0, 0) ----------
const NEWS_PROPS = {
  resume(h) { const w = h * .74; g.save(); g.rotate(-.05); g.beginPath(); g.rect(-w / 2, -h, w, h); g.fillStyle = '#fff'; g.fill(); inkStroke(4); txt('РЕЗЮМЕ', 0, -h + 34, { size: 24, w: 900, color: NAVY, align: 'center' }); for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-w / 2 + 16, -h + 62 + i * 22); g.lineTo(w / 2 - 16 - (i % 2) * 30, -h + 62 + i * 22); g.strokeStyle = 'rgba(27,26,31,.18)'; g.lineWidth = 4; g.stroke(); } g.restore(); },
  sign(h) { const w = h * 1.5; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.lineTo(w / 2 - 14, -h * .62); g.lineTo(-w / 2 + 14, -h * .62); g.closePath(); g.fillStyle = '#fff'; g.fill(); inkStroke(4); txt('ГЛАВНЫЙ', 0, -h * .38, { size: 26, w: 900, color: NAVY, align: 'center' }); txt('ВЕДУЩИЙ', 0, -h * .1, { size: 26, w: 900, color: NRED, align: 'center' }); },
  cookie(h) { const r = h * .38; g.beginPath(); g.arc(0, -r, r, 0, 6.2832); g.fillStyle = '#d9a35b'; g.fill(); inkStroke(4); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(Math.cos(i * 1.1) * r * .55, -r + Math.sin(i * 1.7) * r * .55, r * .1, 0, 6.2832); g.fillStyle = '#5a3a1d'; g.fill(); } },
  carrot(h) { g.beginPath(); g.moveTo(-h * .14, -h * .7); g.quadraticCurveTo(0, -h * .74, h * .14, -h * .7); g.lineTo(0, 0); g.closePath(); g.fillStyle = '#f76707'; g.fill(); inkStroke(4); for (const a of [-.4, 0, .4]) { g.save(); g.translate(0, -h * .72); g.rotate(a); g.beginPath(); g.ellipse(0, -h * .14, h * .05, h * .15, 0, 0, 6.2832); g.fillStyle = '#2f9e44'; g.fill(); inkStroke(3); g.restore(); } for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-h * .1 + i * 4, -h * .6 + i * h * .14); g.lineTo(h * .02 + i * 2, -h * .62 + i * h * .14); g.strokeStyle = '#c2410c'; g.lineWidth = 3; g.stroke(); } },
  mic(h) { g.beginPath(); g.roundRect(-10, -h * .6, 20, h * .6, 6); g.fillStyle = '#2b2d42'; g.fill(); inkStroke(4); g.beginPath(); g.arc(0, -h * .7, h * .14, 0, 6.2832); g.fillStyle = '#adb5bd'; g.fill(); inkStroke(4); },
};
// ---------- происшествия в эфире (p.gag) и фирменное прощание (p.pawsUp): поза героя + что дорисовать поверх ----------
function newsGagPose(s, t, c, P, E) {
  const p = s.p, f = c.flip, mole = c.kind === 'mole', fx = {};
  if (p.pawsUp) { const u = back(seg(t, .05, .4)); for (const [k, v] of [['lSh', 158], ['lEl', 12], ['rSh', 158], ['rEl', 12], ['hl', 150], ['hr', 150]]) P[k] = lerp(P[k], v, u); E.smile = 1; E.open = Math.max(E.open || 0, .35); P.lift = -Math.abs(Math.sin(t * 7)) * 12 * u; return fx; }
  if (p.gag === 'popper' && !mole && t > .5) { const k = Math.exp(-(t - .5) * 3); E.brow = .9 * k; E.open = .5 * k; P.head += -8 * k * f; return fx; }   // Сова отшатывается от конфетти
  if (!mole) return null;
  if (p.wake && t < .9) { const k = Math.exp(-t * 4); P.lift = -60 * k * Math.abs(Math.cos(t * 9)); E.brow = .9; E.open = .7 * (1 - seg(t, .4, .8)); fx.after = st => exclaim(st.x + f * 40 * st.k, st.y - 520 * st.k, t); return fx; }
  switch (p.gag) {
    case 'sleep': { const u = eio(seg(t, .15, .7)); E.sleep = 1; E.smile = 0; E.open = .12 + .1 * Math.sin(t * 3); P.head += 16 * u; P.lean += 4 * u * f; fx.dy = 26 * u;
      fx.after = st => { for (let k = 0; k < 3; k++) { const ph = (t * .7 + k / 3) % 1; if (t < .5) continue; txt('Z', st.x + f * (90 + ph * 80) * st.k, st.y - (470 + ph * 160) * st.k, { size: (34 + ph * 30) * st.k, w: 900, color: '#fff', align: 'center', alpha: Math.sin(Math.PI * ph) }); } }; return fx; }
    case 'glasses': { const u = seg(t, .1, .7); E.glasses = eio(seg(t, .25, .8)); P.hr = lerp(P.hr, 150, Math.sin(Math.PI * u)); P.rSh = lerp(P.rSh, 120, Math.sin(Math.PI * u)); E.smile = t > .8 ? 1 : E.smile;
      fx.after = st => { const a = seg(t, .8, 1.3); if (a > 0 && a < 1) for (const sd of [-1, 1]) txt('✦', st.x + sd * 62 * st.k + 30, st.y - 400 * st.k, { size: 50 * st.k * Math.sin(Math.PI * a), w: 900, color: '#fff', align: 'center' }); }; return fx; }
    case 'hide': { const u = eio(seg(t, .1, .45)), peek = eio(seg(t, Math.max(.9, s.dur - 1.2), Math.max(1.3, s.dur - .5))); fx.dy = 330 * u - 120 * peek; E.brow = .8; E.ly = -.6; E.open = .3; return fx; }
    case 'carrot': { const u = eio(seg(t, .1, .45)); P.hr = lerp(P.hr, 125, u); P.rSh = lerp(P.rSh, 95, u); P.rEl = lerp(P.rEl, 70, u); E.sleep = .6; E.open = .55 * Math.max(0, Math.sin(t * 13)) * u; P.head += Math.sin(t * 13) * 3 * u;
      fx.after = st => { const Lr = st.P.lean * D2R, mx = st.x + st.k * f * 112 * Math.sin(Lr) + f * 30 * st.k, my = st.y + st.k * (-150 - 112 * Math.cos(Lr)) + 10 * st.k, bites = Math.min(3, Math.floor(Math.max(0, t - .5) / .5));
        const a = 35 * D2R; g.save(); g.translate(lerp(st.x + f * 150 * st.k, mx, u), lerp(st.y - 230 * st.k, my, u)); g.rotate(Math.atan2(f * Math.cos(a), Math.sin(a)) * u); g.scale(st.k, st.k); g.beginPath(); g.rect(-60, -220, 120, 220 - bites * 22); g.clip(); NEWS_PROPS.carrot(150); g.restore();
        for (let i = 0; i < 18; i++) { const tt = ((t - .5) % .5) - rnd(i) * .1; if (t < .5 || tt < 0) continue; const vx = -f * (200 + rnd(i * 3.1) * 500), vy = -150 - rnd(i * 5.3) * 300; g.fillStyle = '#f76707'; g.fillRect(mx + vx * tt, my + vy * tt + 900 * tt * tt, 7, 5); } }; return fx; }
    case 'phone': { const u = eio(seg(t, .3, .6)); P.hr = lerp(P.hr, 165, u); P.rSh = lerp(P.rSh, 150, u); P.rEl = lerp(P.rEl, 60, u); E.brow = .5; E.lx = -f * .6;
      fx.after = st => { const vib = t < .4 ? Math.sin(t * 90) * 4 : 0, px = lerp(st.x + f * 200 * st.k, st.x + f * 150 * st.k, u), py = lerp(st.y - 150 * st.k, st.y - 360 * st.k, u);
        g.save(); g.translate(px + vib, py); g.rotate(f * .25); g.scale(st.k, st.k); g.beginPath(); g.roundRect(-26, -56, 52, 112, 10); g.fillStyle = '#1b1a20'; g.fill(); inkStroke(4); g.beginPath(); g.roundRect(-20, -46, 40, 86, 5); g.fillStyle = '#74c0fc'; g.fill(); g.restore();
        if (t < .5) for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(px, py, 60 * k * st.k * (.6 + (t * 3) % 1 * .4), -.6, .6); g.strokeStyle = `rgba(255,255,255,${.8 - k * .2})`; g.lineWidth = 5; g.stroke(); g.beginPath(); g.arc(px, py, 60 * k * st.k * (.6 + (t * 3) % 1 * .4), Math.PI - .6, Math.PI + .6); g.stroke(); } }; return fx; }
    case 'popper': { const u = back(seg(t, .05, .4)); P.hr = lerp(P.hr, 120, u); P.rSh = lerp(P.rSh, 110, u); E.smile = 1; E.open = t > .5 ? .5 : .2;
      fx.after = st => { const tipX = st.x + f * 170 * st.k, tipY = st.y - 470 * st.k; g.save(); g.translate(tipX, tipY); g.rotate(f * -.9); g.beginPath(); g.moveTo(-26, 0); g.lineTo(26, 0); g.lineTo(0, 110); g.closePath(); g.fillStyle = '#7048e8'; g.fill(); inkStroke(4); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-20 + i * 6, 20 + i * 26); g.lineTo(20 - i * 6, 20 + i * 26); g.strokeStyle = NGOLD; g.lineWidth = 5; g.stroke(); } g.restore();
        const ct = t - .5; if (ct > 0 && ct < 2.5) { const cols = ['#ffd43b', '#ff6b81', '#7be495', '#74c0fc', '#b197fc']; for (let i = 0; i < 60; i++) { const vx = (-f * (500 + rnd(i * 2.3) * 700)), vy = -500 - rnd(i * 4.4) * 600, x = tipX + vx * ct * .8, y = tipY + vy * ct + 900 * ct * ct; g.save(); g.translate(x, y); g.rotate(ct * 8 + i); g.scale(1, Math.sin(ct * 9 + i)); g.fillStyle = cols[i % 5]; g.fillRect(-10, -6, 20, 12); g.restore(); } } }; return fx; }
  }
  return null;
}
function newsHUDCore(s, t, T0, hide) {
  const a = 1 - hide;
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
// поверх кадра: фишки рубрик (папарацци у «Звёзд», глитч и цифры у «Технологий», конфетти у «Хорошего»),
// затем базовый HUD, плашка-заголовок новости (как на ТВ) и капли кофе на «объективе» после «Сколько?!»
const GLC = document.createElement('canvas'); GLC.width = 1080; GLC.height = 1920; const GLX = GLC.getContext('2d');
function newsGlitch(a, seed) { // RGB-сдвиг полосами по всему кадру
  GLX.clearRect(0, 0, 1080, 1920); GLX.drawImage(g.canvas, 0, 0);
  for (let i = 0; i < 9; i++) { const y = rnd(seed + i * 3.3) * 1800, h = 20 + rnd(seed + i * 7.7) * 110, off = (rnd(seed + i * 1.9) - .5) * 240 * a; g.drawImage(GLC, 0, y, 1080, h, off, y, 1080, h); }
  g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = .5 * a; g.drawImage(GLC, 14 * a, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(255,0,200,.15)'; g.fillRect(0, 0, 1080, 1920); g.restore();
  g.save(); g.globalAlpha = .25 * a; g.fillStyle = '#000'; for (let y = 0; y < 1920; y += 6) g.fillRect(0, y, 1080, 2); g.restore();
}
const heart = (c) => { g.beginPath(); g.moveTo(0, 50); g.bezierCurveTo(-90, -10, -55, -80, 0, -35); g.bezierCurveTo(55, -80, 90, -10, 0, 50); g.fillStyle = c; g.fill(); };
function newsHUD(s, t, T0, hide) {
  if (!PLAN.news) return;
  const studio = s && s.type === 'story' && !s.p.insert && !s.p.hook, rub = s?.p?.rubric;
  if (studio) newsDecorFront(T0);   // снег под Новый год
  if (hide < .5 && s) {
    if (rub === 'stars' && studio) { // вспышки фотокамер по краям (время — в plan.news.flashes, под них щелчки затвора) и золотые искры
      for (const fl of PLAN.news.flashes || []) { const a = T0 - fl.t; if (a < 0 || a > .16) continue; const q = (1 - a / .16) * .55;
        g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(fl.x, fl.y, 0, fl.x, fl.y, 160); gr.addColorStop(0, `rgba(255,255,255,${q})`); gr.addColorStop(.3, `rgba(255,250,220,${.45 * q})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(fl.x - 160, fl.y - 160, 320, 320);
        g.strokeStyle = `rgba(255,255,255,${q})`; g.lineWidth = 4; g.beginPath(); g.moveTo(fl.x - 90, fl.y); g.lineTo(fl.x + 90, fl.y); g.moveTo(fl.x, fl.y - 90); g.lineTo(fl.x, fl.y + 90); g.stroke(); g.restore(); }
      for (let i = 0; i < 14; i++) { const x = rnd(i * 4.1) * 1080, y = 1500 - ((T0 * (40 + rnd(i) * 50) + rnd(i * 2.2) * 1400) % 1400); txt('✦', x, y, { size: 26 + rnd(i * 6.6) * 30, w: 900, color: NGOLD, align: 'center', alpha: .4 + .4 * Math.sin(T0 * 5 + i) }); }
    }
    if (rub === 'ai') { // глитч на входе в рубрику и в начале новости, цифры-голограмма по краям
      const gt = s.p.rubricStart ? t - 1.05 : s.p.news?.start ? t : -1; if (gt >= 0 && gt < .35) newsGlitch(1 - gt / .35, Math.floor(T0 * 30));
      if (studio) for (let i = 0; i < 26; i++) { const x = i % 2 ? 960 + rnd(i * 3.7) * 100 : 20 + rnd(i * 3.7) * 100, y = 1450 - ((T0 * (60 + rnd(i) * 60) + rnd(i * 8.1) * 1100) % 1100); txt(rnd(i * 5 + Math.floor(T0 * 4)) > .5 ? '1' : '0', x, y, { size: 34, w: 800, color: '#7ef0ff', align: 'center', alpha: .45 }); }
    }
    if (rub === 'good' && studio) { // залп конфетти на старте новости, сердечки снизу
      const ct = s.p.news?.start ? t - .35 : 99, cols = ['#ffd43b', '#ff6b81', '#7be495', '#74c0fc', '#b197fc', '#fff'];
      if (ct >= 0 && ct < 4) for (let i = 0; i < 90; i++) { const vx = (rnd(i * 2.3) - .5) * 1300, vy = -900 - rnd(i * 4.4) * 900, x = 540 + vx * ct * .6, y = 1300 + vy * ct + 990 * ct * ct; if (y > 1950) continue;
        g.save(); g.translate(x, y); g.rotate(ct * 6 + i); g.scale(1, Math.sin(ct * 9 + i)); g.fillStyle = cols[i % cols.length]; g.fillRect(-12, -7, 24, 14); g.restore(); }
      for (let i = 0; i < 8; i++) { const y = 1560 - ((T0 * 90 + rnd(i * 3.3) * 900) % 900), sc = .3 + rnd(i) * .25; g.save(); g.globalAlpha = .55 * Math.min(1, (1560 - y) / 200); g.translate(80 + rnd(i * 9.2) * 920 + Math.sin(T0 * 2 + i) * 20, y); g.scale(sc, sc); heart('#ff8fa3'); g.restore(); }
    }
  }
  newsHUDCore(s, t, T0, hide);
  // плашка-заголовок: метка «РУБРИКА · 1 / 3» и белая плашка с заголовком; въезжает слева, когда в студии идёт новость
  const N = s?.p?.news, R = RUB[rub];
  if (N && studio && hide < .5 && !(N.start && t < 2) && !s.p.crash && !s.p.rubricStart) {
    const pv = SC[s.idx - 1], q = N.start ? eo(seg(t - 2, 0, .35)) : pv?.p?.insert || pv?.p?.rubricStart || pv?.p?.news?.n !== N.n ? eo(seg(t, 0, .35)) : 1;
    const lines = newsWrap(N.head.charAt(0).toUpperCase() + N.head.slice(1), 44, 900, 2), y = 1360, bh = lines.length * 54 + 30, lab = `${R ? R.name : 'НОВОСТИ'}  ·  ${N.n} / ${(PLAN.news.items || []).length}`, lw = tw(lab, 30, 900) + 50;
    g.save(); g.translate(-1100 * (1 - q), 0);
    g.beginPath(); g.roundRect(36, y - 52, lw, 48, [10, 10, 0, 0]); g.fillStyle = R ? R.col : NAVY2; g.fill(); inkStroke(4); txt(lab, 61, y - 16, { size: 30, w: 900, color: '#fff' });
    g.beginPath(); g.roundRect(36, y, 1008, bh, [0, 12, 12, 12]); g.fillStyle = '#fff'; g.fill(); inkStroke(5); g.fillStyle = R ? R.col : NAVY2; g.fillRect(38, y + 2, 14, bh - 4);
    lines.forEach((l, i) => txt(l, 74, y + 58 + i * 54, { size: 44, w: 900, color: NAVY }));
    g.restore();
  }
  if (s?.p?.spit) { const a = t - .16; if (a > 0 && a < 2.4) for (let i = 0; i < 9; i++) { // кофе на «объективе»: капли сползают и тают
    const x = 140 + rnd(i * 3.9) * 800, r = 26 + rnd(i * 2.2) * 50, y = 380 + rnd(i * 6.1) * 900 + a * a * 60 * (1 + rnd(i));
    g.save(); g.globalAlpha = (1 - seg(a, 1.7, 2.4)) * Math.min(1, a * 12); const dg = g.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r); dg.addColorStop(0, 'rgba(170,110,60,.35)'); dg.addColorStop(.8, 'rgba(110,65,30,.6)'); dg.addColorStop(1, 'rgba(70,40,20,.75)'); g.fillStyle = dg; g.beginPath(); g.ellipse(x, y, r, r * 1.12, 0, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(x - r * .35, y - r * .4, r * .22, r * .14, -.6, 0, 6.2832); g.fill(); g.fillStyle = 'rgba(110,65,30,.5)'; g.fillRect(x - r * .12, y, r * .24, a * 90); g.restore(); } }
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

// фон-фото автора: размытая подложка на весь мир + резкое фото по центру, низ темнее — герои стоят «на улице»
LOCATIONS.photo = function (T) {
  const img = USER_BG[PHOTO_NOW % Math.max(1, USER_BG.length)]; if (!img?.naturalWidth) return LOCATIONS.street(T);
  drawCover(softImg(img), -500, -500, W + 1000, H + 1000, 1.05);
  const z = 1.04 + .03 * Math.sin(T * .2); drawCover(img, CX - 660, -60, 1320, H + 120, z, Math.sin(T * .13) * .3, 0);
  const sh = g.createLinearGradient(0, 640, 0, H); sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,0,0,.42)'); g.fillStyle = sh; g.fillRect(-500, 640, W + 1000, H);
  g.fillStyle = 'rgba(243,239,230,.08)'; g.fillRect(-500, -500, W + 1000, H + 1000);
};
