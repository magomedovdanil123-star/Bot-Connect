// Плеер: план (уже размеченный режиссёром) -> кадр. Переходы, камера, параллакс, удары, подписи, HUD, концовка.
let PLAN = null, SC = [], TOTAL = 0, NFRAMES = 0;
const LAYB = document.createElement('canvas'); LAYB.width = W; LAYB.height = H;   // слой предыдущей сцены для переходов
const LBX = LAYB.getContext('2d');
const TMP = document.createElement('canvas'); TMP.width = W; TMP.height = H; const TX = TMP.getContext('2d');
let PARTS = [];

function loadPlan(plan) {
  PLAN = plan; setStyle({ ...(plan.style || {}), accent: plan.style?.accentColors || ['#8b5cff', '#b9a2ff'] });
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
function layoutCaption(s) {
  if (s._lay) return s._lay;
  let best;
  for (const size of [52, 47, 42, 38]) {
    LX.font = `800 ${size}px ${SANS}`; const sp = LX.measureText(' ').width; const lh = size * 1.22;
    let x = 0, line = 0; const out = [];
    for (const w of s.words) { const ww = LX.measureText(w.s).width; if (x + ww > 1640 && x > 0) { x = 0; line++; } out.push({ ...w, x, line, ww }); x += ww + sp; }
    best = { size, lh, words: out, lines: line + 1 };
    if (line < 3) break;
  }
  // время начала каждой строки — для прокрутки длинных фраз (видно не больше 3 строк)
  best.lineT = []; best.words.forEach(w => { if (best.lineT[w.line] === undefined) best.lineT[w.line] = w.t; });
  return (s._lay = best);
}
function drawCaption(s, t) {
  const L = layoutCaption(s), x0 = 140, y0 = 150, kind = PLAN.style?.caption || 'rise';
  let scroll = 0; for (let k = 3; k < L.lines; k++) scroll += eo(seg(t, L.lineT[k] - .1, L.lineT[k] + .25)) * L.lh;
  g.save(); g.beginPath(); g.rect(0, y0 - L.size * 1.1, W, L.lh * 3 + 6); g.clip();
  for (const w of L.words) {
    const p = seg(t, w.t - .06, w.t + .26); if (p <= 0) continue;
    let x = x0 + w.x, y = y0 + w.line * L.lh - scroll, a = p, glow = w.acc ? 12 : 0, col = w.acc ? VIO2 : WHITE;
    if (y < y0 - L.lh * .9) continue;
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
function drawBG(T, cam) {
  X.fillStyle = BG; X.fillRect(0, 0, W, H);
  X.save(); X.globalCompositeOperation = 'lighter';
  X.globalAlpha = .16; X.drawImage(BLOB, 1300 + Math.sin(T * .13) * 300 - 700, 500 + Math.cos(T * .1) * 200 - 700, 1400, 1400);
  X.globalAlpha = .11; X.drawImage(BLOB, 500 + Math.cos(T * .09) * 300 - 600, 400 + Math.sin(T * .12) * 200 - 600, 1200, 1200);
  X.restore();
  // сетка двигается слабее сцены — эффект глубины
  X.save(); X.translate(CX, 540); X.scale(1 + (cam.sc - 1) * .35, 1 + (cam.sc - 1) * .35); X.translate(-CX, -540);
  X.drawImage(GRID, -180 + Math.sin(T * .05) * 30 + cam.tx * .3, -180 + Math.cos(T * .04) * 20 + cam.ty * .3); X.restore();
}
function drawParticles(T, cam, front) {
  const kind = PLAN.style?.particles; if (!PARTS.length) return;
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
  if (s.cap !== false) drawCaption(s, t);
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
    drawHUD(T, si);
    if (si === SC.length - 1) ending(PLAN.style?.ending, seg(t, s.dur + .05, s.dur + 1.1));
  }
  bloom(PLAN.style?.bloom ?? 1);
  X.drawImage(VIGN, 0, 0);
  X.save(); X.globalAlpha = .03; X.globalCompositeOperation = 'lighter'; X.drawImage(GRAIN[f % 4], 0, 0, W, H); X.restore();
  if (T < .5) { X.fillStyle = `rgba(0,0,0,${1 - T / .5})`; X.fillRect(0, 0, W, H); }
}
const T_ = T;
window.loadPlan = loadPlan;
window.grab = (f, q = .93) => { renderFrame(f); return cvs.toDataURL('image/jpeg', q); };
