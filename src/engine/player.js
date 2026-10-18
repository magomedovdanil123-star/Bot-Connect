// Плеер: план (уже размеченный режиссёром) -> кадр. Переходы, камера, параллакс, удары, подписи, HUD, концовка.
let PLAN = null, SC = [], TOTAL = 0, NFRAMES = 0;
const LAYB = document.createElement('canvas'); LAYB.width = W; LAYB.height = H;   // слой предыдущей сцены для переходов
const LBX = LAYB.getContext('2d');
const TMP = document.createElement('canvas'); TMP.width = W; TMP.height = H; const TX = TMP.getContext('2d');
let PARTS = [];

function loadPlan(plan) {
  PLAN = plan; VERT = !!plan.vertical; setStyle({ ...(plan.style || {}), accent: plan.style?.accentColors || ['#8b5cff', '#b9a2ff'] });
  SC = plan.scenes.map((src, i) => {
    const s = { ...src, idx: i, mainSym: plan.mainSym };
    s.words = s.text.split(/\s+/).filter(Boolean).map((w, k) => ({ s: w, t: (src.words || [])[k] ?? 0 }));
    const acc = new Set(s.acc || []); s.words.forEach((w, k) => w.acc = acc.has(k));
    // упреждение: анимация «садится» к моменту слова, а не начинается в нём
    s.kt = k => Math.max(0, ((s.words[Math.max(0, Math.min(s.words.length - 1, k ?? 0))] || { t: 0 }).t) - .12);
    s.numWi = (s.numWis || [])[0] ?? 0; s.numWi2 = (s.numWis || [])[1] ?? s.numWi; s.entWi = s.entWis || [];
    s.dir = s.dir || { level: 0, transition: 'fade', tw: .3, camera: 'static', impacts: [], speedRamp: .4, dirX: 1 };
    return s;
  });
  TOTAL = plan.total || (SC.length ? SC[SC.length - 1].start + SC[SC.length - 1].dur + 1.3 : 2);
  NFRAMES = Math.ceil(TOTAL * FPS);
  // частицы с глубиной (параллакс): z — дальность, ближние крупнее и быстрее
  let seed = (plan.seed || 1) % 9973; const pr = () => rnd(seed++);
  const kind = plan.style?.particles || 'dust', count = { dust: 70, embers: 45, data: 40, none: 0 }[kind];
  PARTS = Array.from({ length: count }, () => ({ x: pr() * W, y: pr() * H, z: .25 + pr() * .75, v: pr(), ph: pr() * 6.28 }));
  window.TOTAL = TOTAL; window.NFRAMES = NFRAMES;
  return { total: TOTAL, frames: NFRAMES, scenes: SC.map(s => ({ type: s.type, start: s.start, dur: s.dur, text: s.text, transition: s.dir.transition, camera: s.dir.camera, level: s.dir.level })) };
}

// ---------- подписи ----------
function layoutCaption(s, V = false) {
  if (V ? s._layV : s._lay) return V ? s._layV : s._lay;
  let best; const maxW = V ? 940 : 1640;
  for (const size of V ? [74, 68, 62, 56] : [52, 47, 42, 38]) {
    LX.font = `800 ${size}px ${SANS}`; const sp = LX.measureText(' ').width; const lh = size * 1.22;
    let x = 0, line = 0; const out = [];
    for (const w of s.words) { const ww = LX.measureText(w.s).width; if (x + ww > maxW && x > 0) { x = 0; line++; } out.push({ ...w, x, line, ww }); x += ww + sp; }
    best = { size, lh, words: out, lines: line + 1 };
    if (line < 3) break;
  }
  // время начала каждой строки — для прокрутки длинных фраз (видно не больше 3 строк)
  best.lineT = []; best.words.forEach(w => { if (best.lineT[w.line] === undefined) best.lineT[w.line] = w.t; });
  return V ? (s._layV = best) : (s._lay = best);
}
function drawCaption(s, t, V = false) {
  const L = layoutCaption(s, V), x0 = V ? 70 : 140, y0 = V ? 210 : 150, kind = PLAN.style?.caption || 'rise';
  let scroll = 0; for (let k = 3; k < L.lines; k++) scroll += eo(seg(t, L.lineT[k] - .1, L.lineT[k] + .25)) * L.lh;
  // комикс: подпись на бумажной плашке с контуром — читается поверх любой локации
  if (INK) {
    let right = 0, lines = 0; for (const w of L.words) { if (t < w.t - .06) continue; right = Math.max(right, w.x + w.ww); lines = Math.max(lines, w.line + 1); }
    if (right > 0) { const nl = Math.min(3, lines), pw = right + 56, ph = (nl - 1) * L.lh + L.size * 1.55;
      g.save(); g.beginPath(); g.roundRect(x0 - 28 + boil(801, 0, 1), y0 - L.size * 1.05 + boil(801, 1, 1), pw, ph, 18); g.fillStyle = 'rgba(250,248,242,.94)'; g.fill(); inkStroke(4); g.restore(); }
  }
  g.save(); g.beginPath(); g.rect(0, y0 - L.size * 1.1, W, L.lh * 3 + 6); g.clip();
  for (const w of L.words) {
    const p = seg(t, w.t - .06, w.t + .26); if (p <= 0) continue;
    let x = x0 + w.x, y = y0 + w.line * L.lh - scroll, a = p, glow = w.acc ? 12 : 0, col = w.acc ? VIO2 : WHITE;
    if (y < y0 - L.lh * .9) continue;
    // чернильная тема: ключевые слова выделены маркером, как в журнале
    if (INK && w.acc) { const mp = eo(seg(t, w.t - .02, w.t + .3)); g.save(); g.fillStyle = VIO; g.globalAlpha *= .9; g.beginPath(); g.roundRect(x - 6, y - L.size * .78, (w.ww + 12) * mp, L.size * .98, 6); g.fill(); g.restore(); col = WHITE; glow = 0; }
    if (kind === 'rise') y += (1 - eo(p)) * 18;
    else if (kind === 'blur') { glow = 40 * (1 - p) + glow; a = eo(p); }
    else if (kind === 'mask') { g.save(); g.beginPath(); g.rect(x - 2, y - L.size, (w.ww + 6) * eo(p), L.size * 1.35); g.clip(); txt(w.s, x, y, { size: L.size, w: 800, color: col, glow }); g.restore(); continue; }
    else if (kind === 'pop') { const sc = 1 + (1 - back(p)) * .6; g.save(); g.translate(x + w.ww / 2, y - L.size * .35); g.scale(sc, sc); txt(w.s, -w.ww / 2, L.size * .35, { size: L.size, w: 800, color: col, alpha: a, glow }); g.restore(); continue; }
    else if (kind === 'type') { const n = Math.ceil([...w.s].length * clamp(p * 1.4)); txt([...w.s].slice(0, n).join(''), x, y, { size: L.size, w: 800, color: col, glow }); continue; }
    txt(w.s, x, y, { size: L.size, w: 800, color: col, alpha: a, glow });
  }
  g.restore();
}

// ---------- фон, частицы, HUD ----------
// бумажная фактура для чернильной темы
const PAPERTEX = (() => { const c = document.createElement('canvas'); c.width = 640; c.height = 360; const x = c.getContext('2d'); const id = x.createImageData(640, 360);
  for (let i = 0; i < id.data.length; i += 4) { const v = 200 + rnd(i * .13 + 7) * 55; id.data[i] = v; id.data[i + 1] = v * .985; id.data[i + 2] = v * .96; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); return c; })();
function drawBG(T, cam) {
  X.fillStyle = BG; X.fillRect(0, 0, W, H);
  if (INK) {
    X.save(); X.globalCompositeOperation = 'multiply'; X.globalAlpha = .18; X.drawImage(PAPERTEX, 0, 0, W, H); X.restore();
    X.save(); X.translate(CX, 540); X.scale(1 + (cam.sc - 1) * .35, 1 + (cam.sc - 1) * .35); X.translate(-CX, -540); X.drawImage(GRID, -180 + cam.tx * .3, -180 + cam.ty * .3); X.restore();
    return;
  }
  X.save(); X.globalCompositeOperation = 'lighter';
  X.globalAlpha = .16; X.drawImage(BLOB, 1300 + Math.sin(T * .13) * 300 - 700, 500 + Math.cos(T * .1) * 200 - 700, 1400, 1400);
  X.globalAlpha = .11; X.drawImage(BLOB, 500 + Math.cos(T * .09) * 300 - 600, 400 + Math.sin(T * .12) * 200 - 600, 1200, 1200);
  X.restore();
  // сетка двигается слабее сцены — эффект глубины
  X.save(); X.translate(CX, 540); X.scale(1 + (cam.sc - 1) * .35, 1 + (cam.sc - 1) * .35); X.translate(-CX, -540);
  X.drawImage(GRID, -180 + Math.sin(T * .05) * 30 + cam.tx * .3, -180 + Math.cos(T * .04) * 20 + cam.ty * .3); X.restore();
}
function drawParticles(T, cam, front) {
  const kind = PLAN.style?.particles; if (!PARTS.length || INK) return;
  X.save(); X.globalCompositeOperation = 'lighter';
  for (const p of PARTS) {
    if ((p.z > .8) !== front) continue;
    const sp = kind === 'embers' ? -18 : kind === 'data' ? 0 : -6;
    let x = (p.x + cam.tx * p.z * .8 + Math.sin(T * .3 + p.ph) * 20 * p.z) % W, y = (p.y + T * sp * p.z + cam.ty * p.z * .8) % H;
    if (x < 0) x += W; if (y < 0) y += H;
    const a = (.15 + .5 * p.z) * (.6 + .4 * Math.sin(T * 1.5 + p.ph));
    if (kind === 'data') { X.globalAlpha = a * .5; X.fillStyle = VIO2; X.font = `400 ${Math.round(10 + 10 * p.z)}px ${MONO}`; X.fillText(GL[Math.floor((p.v * 99 + Math.floor(T * 2)) % GL.length)], x, y); continue; }
    const r = (kind === 'embers' ? 1.5 : 1) * (1 + p.z * 2.4);
    X.globalAlpha = a; X.fillStyle = kind === 'embers' ? VIO2 : 'rgba(255,255,255,.9)'; X.beginPath(); X.arc(x, y, r, 0, 6.28); X.fill();
  }
  X.restore();
}
function drawHUD(T, si) {
  const prev = g; g = X; const kind = PLAN.style?.hud || 'corners';
  const prog = clamp(T / TOTAL);
  if (kind !== 'minimal') {
    mono(`${PLAN.title} // РАЗБОР`, 60, 52, 18, DIM, { w: 700 });
    g.fillStyle = Math.floor(T * 2) % 2 ? VIO2 : `rgba(${ACC2},.25)`; g.fillRect(40, 39, 10, 10);
  }
  if (kind === 'corners') {
    mono(`СЦЕНА ${pad(si + 1)}/${pad(SC.length)}`, 60, H - 40, 18, DIM, { w: 700 });
    g.strokeStyle = DIM2; g.lineWidth = 2; g.strokeRect(240, H - 52, 240, 10); g.fillStyle = VIO2; g.fillRect(242, H - 50, 236 * prog, 6);
    mono(`REC ${pad(Math.floor(T / 60))}:${pad(Math.floor(T % 60))}:${pad(Math.floor(T * FPS) % FPS)}`, W - 60, H - 40, 18, DIM, { align: 'right', w: 700 });
  } else if (kind === 'minimal') {
    g.fillStyle = `rgba(${ACC2},.8)`; g.fillRect(0, H - 4, W * prog, 4);
  } else if (kind === 'ticker' && PLAN.tickers?.length) {
    // бегущая строка только из названий, упомянутых в сценарии (без цен — ничего не выдумываем)
    g.fillStyle = 'rgba(5,3,10,.7)'; g.fillRect(0, H - 54, W, 54); g.fillStyle = `rgba(${ACC2},.6)`; g.fillRect(0, H - 54, W * prog, 2);
    const str = PLAN.tickers.map(x => `◆ ${x.toUpperCase()}`).join('     ') + '     '; g.font = `700 18px ${MONO}`; const sw = g.measureText(str).width;
    const off = -((T * 60) % sw); for (let x = off; x < W; x += sw) mono(str, x, H - 22, 18, DIM, { w: 700 });
  }
  g = prev;
}

// ---------- камера и удары ----------
function camera(s, t) {
  const d = s.dir, u = eio(clamp(t / s.dur)), k = PLAN.style?.intensity || 1;
  let sc = 1, tx = 0, ty = 0, rot = 0;
  switch (d.camera) {
    case 'push': sc = 1 + .055 * k * u; break;
    case 'punch': sc = 1 + .04 * u + .05 * (1 - eo(seg(t, 0, .45))); break;
    case 'pull': sc = 1.07 - .06 * u; break;
    case 'panL': sc = 1.05; tx = 45 - 90 * u; break;
    case 'panR': sc = 1.05; tx = -45 + 90 * u; break;
    case 'drift': sc = 1.03 + .01 * Math.sin(t * .5); rot = Math.sin(t * .4) * .006; ty = Math.sin(t * .3) * 8; break;
    default: break;
  }
  // удары: тряска + вспышка в момент ключевого слова
  let flash = 0;
  for (const im of d.impacts) {
    const a = t - im.t; if (a < 0 || a > .45) continue;
    const e = Math.exp(-a * 14) * (d.level === 2 ? 1 : .6) * k;
    tx += (rnd(FR * 3.1) - .5) * 26 * e; ty += (rnd(FR * 5.7) - .5) * 20 * e; sc += .02 * e; flash = Math.max(flash, e * (im.kind === 'name' ? .12 : .22));
  }
  return { sc, tx, ty, rot, flash };
}
function speedRamp(s, t) { const a = s.dir.speedRamp || 0, R = .28; return t + a * R * (1 - Math.exp(-t / R)); }

// ---------- рендер сцены в слой ----------
function renderScene(s, t, layerCtx) {
  layerCtx.setTransform(1, 0, 0, 1, 0, 0); layerCtx.clearRect(0, 0, W, H); g = layerCtx; CUR = s;
  layerCtx.save();
  try { (T_[s.type] || T_.hero)(speedRamp(s, t), s.dur, s); } catch (e) { console.error('scene', s.idx + 1, s.type, e.message); }
  layerCtx.restore(); g = layerCtx;
  if (s.cap !== false && !VERT) drawCaption(s, t);
  for (const im of s.dir.impacts) { // энергетический всплеск на ударе
    const a = t - im.t; if (a < 0 || a > .7) continue;
    ring(CX, 620, 120 + a * 900, (1 - a / .7) * .5, 3); sparks(CX, 620, a, Math.round(im.t * 100) + s.idx, { n: s.dir.level === 2 ? 34 : 16, spd: 700, life: .7 });
    if (!s.dir.ownFlare) flare(CX, 620, (s.dir.level === 2 ? 1 : .6) * Math.exp(-a * 5), 1000);
  }
  CUR = null;
}
function blit(src, o = {}) {
  const { alpha = 1, sc = 1, tx = 0, ty = 0, rot = 0, blurX = 0, blurY = 0 } = o;
  if (alpha <= 0) return;
  const n = (blurX || blurY) ? 5 : 1;
  for (let k = 0; k < n; k++) {
    const f = n > 1 ? (k / (n - 1) - .5) : 0;
    X.save(); X.globalAlpha = alpha * (n > 1 ? .32 : 1);
    X.translate(CX + tx + blurX * f, 600 + ty + blurY * f); X.rotate(rot); X.scale(sc, sc); X.translate(-CX, -600);
    X.drawImage(src, 0, 0); X.restore();
  }
}

// ---------- переходы ----------
function transition(kind, p, prevCanvas, curCanvas, camCur, s) {
  const e = eio(p), dir = s.dir.dirX || 1, base = { sc: camCur.sc, tx: camCur.tx, ty: camCur.ty, rot: camCur.rot };
  switch (kind) {
    case 'fade': if (prevCanvas) blit(prevCanvas, { alpha: 1 - e }); blit(curCanvas, { ...base, alpha: e }); break;
    case 'whip': { // быстрый проброс с размытием по направлению движения
      const v = Math.sin(p * Math.PI) * 220;
      if (prevCanvas) blit(prevCanvas, { tx: -dir * W * e, blurX: v });
      blit(curCanvas, { ...base, tx: base.tx + dir * W * (1 - e), blurX: v }); break;
    }
    case 'slide': if (prevCanvas) blit(prevCanvas, { ty: -H * e, blurY: Math.sin(p * Math.PI) * 120 }); blit(curCanvas, { ...base, ty: base.ty + H * (1 - e), blurY: Math.sin(p * Math.PI) * 120 }); break;
    case 'zoom': if (prevCanvas) blit(prevCanvas, { sc: 1 + 2.2 * e, alpha: 1 - e }); blit(curCanvas, { ...base, sc: base.sc * (.72 + .28 * eo(p)), alpha: e }); break;
    case 'match': if (prevCanvas) blit(prevCanvas, { sc: 1 + .3 * e, alpha: 1 - e }); blit(curCanvas, { ...base, sc: base.sc * (1.3 - .3 * eo(p)), alpha: e }); break;
    case 'wipe': case 'iris': {
      if (prevCanvas) blit(prevCanvas, {});
      TX.setTransform(1, 0, 0, 1, 0, 0); TX.clearRect(0, 0, W, H); TX.save(); TX.beginPath();
      let edge;
      if (kind === 'wipe') { const x = -300 + (W + 600) * e; TX.moveTo(x - 260, -10); TX.lineTo(x + 260, H + 10); TX.lineTo(-400, H + 10); TX.lineTo(-400, -10); edge = () => { X.save(); X.strokeStyle = VIO2; X.lineWidth = 5; X.shadowColor = VIO; X.shadowBlur = 30; X.beginPath(); X.moveTo(x - 260, -10); X.lineTo(x + 260, H + 10); X.stroke(); X.restore(); }; }
      else { // форма «перетекает» из квадрата в круг, раскрывая следующую сцену
        const r = 1250 * e, rad = r * clamp(p * 1.6); TX.roundRect(CX - r, 540 - r, r * 2, r * 2, rad);
        edge = () => { X.save(); X.strokeStyle = VIO2; X.lineWidth = 4; X.shadowColor = VIO; X.shadowBlur = 30; X.beginPath(); X.roundRect(CX - r, 540 - r, r * 2, r * 2, rad); X.stroke(); X.restore(); };
      }
      TX.clip(); TX.drawImage(curCanvas, 0, 0); TX.restore();
      blit(TMP, { ...base }); if (p < .98) edge(); break;
    }
    case 'flash': {
      if (p < .35 && prevCanvas) blit(prevCanvas, { sc: 1 + .08 * p }); else blit(curCanvas, { ...base, sc: base.sc * (1 + .06 * (1 - eo(seg(p, .35, 1)))) });
      const f = p < .35 ? p / .35 : 1 - seg(p, .35, 1);
      X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = `rgba(255,255,255,${.85 * f})`; X.fillRect(0, 0, W, H); X.restore(); break;
    }
    case 'glitch': {
      if (p < .4 && prevCanvas) blit(prevCanvas, {}); else blit(curCanvas, { ...base });
      for (let k = 0; k < 9; k++) { const y = Math.floor(rnd(FR * 13 + k) * H), h = 10 + rnd(FR * 7 + k) * 80, dx = (rnd(FR * 3 + k) - .5) * 140 * (1 - p); X.drawImage(cvs, 0, y, W, h, dx, y, W, h); }
      X.save(); X.globalCompositeOperation = 'lighter'; X.globalAlpha = .35 * (1 - p); X.drawImage(cvs, 10 * (1 - p), 0); X.restore(); break;
    }
    default: blit(curCanvas, base);
  }
}

// ---------- концовка ----------
function ending(kind, q) { // q: 0..1
  if (q <= 0) return;
  switch (kind) {
    case 'collapse': { const sy = q < .6 ? 1 - .98 * eio(q / .6) : .02, sx = q < .6 ? 1 : 1 - eio(seg(q, .6, 1));
      TX.setTransform(1, 0, 0, 1, 0, 0); TX.clearRect(0, 0, W, H); TX.drawImage(cvs, 0, 0); X.fillStyle = BG; X.fillRect(0, 0, W, H);
      X.save(); X.translate(CX, 540); X.scale(sx, sy); X.drawImage(TMP, -CX, -540); X.restore();
      X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = `rgba(255,255,255,${.6 * q})`; X.fillRect(CX - W * sx / 2, 540 - 2, W * sx, 4); X.restore(); break; }
    case 'iris': { const r = 1250 * (1 - eio(q)); X.save(); X.fillStyle = BG; X.beginPath(); X.rect(0, 0, W, H); X.arc(CX, 540, Math.max(1, r), 0, 6.3, true); X.fill(); X.strokeStyle = VIO2; X.lineWidth = 4; X.beginPath(); X.arc(CX, 540, Math.max(1, r), 0, 6.3); X.stroke(); X.restore(); break; }
    case 'glitchout': for (let k = 0; k < 14; k++) { const y = Math.floor(rnd(FR * 11 + k) * H), h = 8 + rnd(FR * 5 + k) * 90; X.drawImage(cvs, 0, y, W, h, (rnd(FR + k) - .5) * 300 * q, y, W, h); } X.fillStyle = `rgba(0,0,0,${eio(q)})`; X.fillRect(0, 0, W, H); break;
    case 'zoomout': TX.setTransform(1, 0, 0, 1, 0, 0); TX.clearRect(0, 0, W, H); TX.drawImage(cvs, 0, 0); X.fillStyle = BG; X.fillRect(0, 0, W, H); X.save(); X.globalAlpha = 1 - eio(q); X.translate(CX, 540); X.scale(1 - .4 * eio(q), 1 - .4 * eio(q)); X.drawImage(TMP, -CX, -540); X.restore(); break;
    case 'lineout': { const x = W * eio(q); X.fillStyle = BG; X.fillRect(0, 0, x, H); X.save(); X.fillStyle = VIO2; X.shadowColor = VIO; X.shadowBlur = 30; X.fillRect(x - 3, 0, 6, H); X.restore(); break; }
    default: X.fillStyle = `rgba(0,0,0,${q})`; X.fillRect(0, 0, W, H);
  }
}

// ---------- свечение (bloom): яркие части кадра мягко светятся, как неон ----------
const BL1 = document.createElement('canvas'); BL1.width = 480; BL1.height = 270; const B1 = BL1.getContext('2d');
const BL2 = document.createElement('canvas'); BL2.width = 240; BL2.height = 135; const B2 = BL2.getContext('2d');
function bloom(k) {
  if (k <= 0) return;
  B1.clearRect(0, 0, 480, 270); B1.filter = 'brightness(1.05) contrast(2.1) blur(3px)'; B1.drawImage(cvs, 0, 0, 480, 270); B1.filter = 'none';
  B2.clearRect(0, 0, 240, 135); B2.filter = 'blur(6px)'; B2.drawImage(BL1, 0, 0, 240, 135); B2.filter = 'none';
  X.save(); X.globalCompositeOperation = 'lighter'; X.globalAlpha = .3 * k; X.drawImage(BL1, 0, 0, W, H); X.globalAlpha = .28 * k; X.drawImage(BL2, 0, 0, W, H); X.restore();
}

function sceneAt(T) { for (let i = SC.length - 1; i >= 0; i--) if (T >= SC[i].start) return i; return -1; }
function renderFrame(f) {
  FR = f; const T = f / FPS;
  const si = sceneAt(T);
  const s = si >= 0 ? SC[si] : null, t = s ? T - s.start : 0;
  const cam = s ? camera(s, t) : { sc: 1, tx: 0, ty: 0, rot: 0, flash: 0 };
  drawBG(T, cam); drawParticles(T, cam, false);
  if (s) {
    renderScene(s, t, LX);
    const tw = s.dir.tw || 0;
    if (t < tw) {
      const prev = SC[si - 1];
      if (prev) renderScene(prev, prev.dur + t, LBX);
      transition(s.dir.transition, clamp(t / tw), prev ? LAYB : null, LAY, cam, s);
    } else blit(LAY, cam);
    if (cam.flash > 0) { X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = `rgba(${ACC2},${cam.flash})`; X.fillRect(0, 0, W, H); X.restore(); }
    drawParticles(T, cam, true);
    if (!VERT) drawHUD(T, si);
    if (si === SC.length - 1) ending(PLAN.style?.ending, seg(t, s.dur + .05, s.dur + 1.1));
  }
  if (INK) { X.save(); X.globalAlpha = .22; X.drawImage(VIGN, 0, 0); X.restore(); X.save(); X.globalAlpha = .035; X.globalCompositeOperation = 'multiply'; X.drawImage(GRAIN[f % 4], 0, 0, W, H); X.restore(); }
  else { bloom(PLAN.style?.bloom ?? 1); X.drawImage(VIGN, 0, 0); X.save(); X.globalAlpha = .03; X.globalCompositeOperation = 'lighter'; X.drawImage(GRAIN[f % 4], 0, 0, W, H); X.restore(); }
  if (T < .5 && !VERT) { X.fillStyle = INK ? `rgba(243,239,230,${1 - T / .5})` : `rgba(0,0,0,${1 - T / .5})`; X.fillRect(0, 0, W, H); }
}
// ---------- вертикальная версия (Shorts 9:16) ----------
// Сверху крупные подписи, в центре — квадратный кадр вокруг героя (или широкий кадр для инфографики), снизу фирменная плашка.
let VERT = false; const VC = document.createElement('canvas'); VC.width = 1080; VC.height = 1920; const VX = VC.getContext('2d');
function focusOf(sc) {
  if (!sc) return CX;
  if (sc.type === 'cartoon') return sc._fx ?? CX;   // мультик сам говорит, где главное в кадре
  if (sc.type === 'story') { const cast = sc.p.cast || [], h = cast.find(c => c.kind === 'hamster') || cast[0]; return cast.length > 1 || !h ? CX : h.x + 160; }
  return CX;
}
// крючок Shorts: крупная фраза на первых секундах (зритель решает, смотреть ли, за 1–2 с) и снова в самом конце — ролик «закольцован»
const HOOK_T = 2.2;
function hookCard(a, T0) {
  if (!PLAN.hook || a <= 0) return;
  const size = PLAN.hook.length > 42 ? 70 : 84, lines = []; let cur = '';
  VX.font = `900 ${size}px ${SANS}`;
  for (const w of PLAN.hook.split(' ')) { const tryL = cur ? cur + ' ' + w : w; if (cur && VX.measureText(tryL).width > 900) { lines.push(cur); cur = w; } else cur = tryL; }
  if (cur) lines.push(cur); lines.length = Math.min(lines.length, 4);
  const lh = size * 1.12, h = lines.length * lh + 70, y = 40, pulse = 1 + .012 * Math.sin(T0 * 6);
  VX.save(); VX.globalAlpha = a; VX.translate(540, y + h / 2); VX.rotate(-.02); VX.scale(pulse, pulse); VX.translate(-540, -(y + h / 2));
  VX.beginPath(); VX.roundRect(50, y, 980, h, 26); VX.fillStyle = INK ? '#fffaf0' : 'rgba(15,12,24,.92)'; VX.fill(); if (INK) inkStroke(7); else { VX.strokeStyle = VIO2; VX.lineWidth = 4; VX.stroke(); }
  lines.forEach((l, i) => { const yy = y + 35 + lh * (i + .8);
    // числа и суммы — жёлтым маркером
    if (INK) for (const m of l.matchAll(/[\d][\d\s]*\d*\s?(₽|%|руб\S*)?/g)) { const x0 = 540 - VX.measureText(l).width / 2 + VX.measureText(l.slice(0, m.index)).width, ww = VX.measureText(m[0].trim()).width; VX.fillStyle = '#ffd43b'; VX.fillRect(x0 - 6, yy - size * .78, ww + 12, size * .95); }
    txt(l, 540, yy, { size, w: 900, color: INK ? INKC : WHITE, align: 'center' }); });
  VX.restore();
}
function composeVertical(f) {
  const T0 = f / FPS, si = sceneAt(T0), s = SC[si], t = s ? T0 - s.start : 0, ch = s && (s.type === 'story' || s.type === 'ident' || s.type === 'cartoon');
  const fx = clamp(lerp(focusOf(SC[si - 1] || s), focusOf(s), eio(seg(t, 0, .45))), 450, W - 450);
  VX.setTransform(1, 0, 0, 1, 0, 0); VX.fillStyle = BG; VX.fillRect(0, 0, 1080, 1920);
  if (INK) { VX.save(); VX.globalCompositeOperation = 'multiply'; VX.globalAlpha = .18; VX.drawImage(PAPERTEX, 0, 0, 1080, 1920); VX.restore(); }
  // кадр крупнее: сцены с героем — 900×1080 из центра вокруг героя, увеличены до 1080×1296 (почти весь экран); инфографика — шире
  // рамка кадра одна для всех сцен (не прыгает); инфографика 16:9 — по центру рамки
  const top = 380, bot = 1676;
  if (ch) VX.drawImage(cvs, fx - 450, 0, 900, 1080, 0, top, 1080, 1296);
  else VX.drawImage(cvs, CX - 760, 0, 1520, 1080, 0, (top + bot - 767) / 2, 1080, 767);
  const prev = g; g = VX;
  if (INK) { rline(0, top, 1080, top, 811, 6); rline(0, bot, 1080, bot, 812, 6); } else { VX.fillStyle = `rgba(${ACC2},.5)`; VX.fillRect(0, top - 2, 1080, 3); VX.fillRect(0, bot - 1, 1080, 3); }
  const hookA = PLAN.hook ? Math.max(T0 < HOOK_T ? 1 - seg(T0, HOOK_T - .3, HOOK_T) : 0, seg(T0, TOTAL - .45, TOTAL - .05)) : 0;
  if (s && s.cap !== false && hookA < .5) drawCaption(s, t, true);
  hookCard(hookA, T0);
  // фирменная плашка снизу и полоса прогресса
  const by = (bot + 1920) / 2 - 10;
  if (PLAN.brand && INK) {
    const name = PLAN.brand.name, w = tw(name, 60, 900) + 56; VX.save(); VX.translate(540, by); VX.rotate(-.03); VX.beginPath(); VX.roundRect(-w / 2, -44, w, 74, 16); VX.fillStyle = VIO; VX.fill(); inkStroke(5); txt(name, 0, 18, { size: 60, w: 900, color: INKC, align: 'center' }); VX.restore();
    if (PLAN.brand.tagline) mono(PLAN.brand.tagline, 540, by + 66, 22, INKC, { align: 'center', w: 700, ls: 6 });
  } else mono(PLAN.title, 540, by, 30, DIM, { align: 'center', w: 700, ls: 4 });
  VX.fillStyle = INK ? 'rgba(27,26,31,.15)' : 'rgba(255,255,255,.15)'; VX.fillRect(80, 1888, 920, 8); VX.fillStyle = INK ? INKC : VIO2; VX.fillRect(80, 1888, 920 * clamp(T0 / TOTAL), 8);
  g = prev;
}

const T_ = T;
window.loadPlan = loadPlan;
window.grab = (f, q = .93) => { renderFrame(f); if (VERT) { composeVertical(f); return VC.toDataURL('image/jpeg', q); } return cvs.toDataURL('image/jpeg', q); };
