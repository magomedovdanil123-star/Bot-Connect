// Плеер: план -> таймлайн, подписи по словам, фон, HUD, переходы. renderFrame(f) рисует кадр f.
let PLAN = null, SC = [], TOTAL = 0, NFRAMES = 0;

function loadPlan(plan) {
  PLAN = plan; SC = []; let T0 = .6;
  plan.scenes.forEach((src, i) => {
    const s = { ...src, idx: i, mainSym: plan.mainSym };
    s.words = s.text.split(/\s+/).filter(Boolean).map(w => ({ s: w }));
    const acc = new Set(s.acc || []); s.words.forEach((w, k) => w.acc = acc.has(k));
    const chars = s.words.reduce((a, w) => a + w.s.length + 1, 0);
    if (src.start != null) { s.start = src.start; s.dur = src.dur; s.speak = src.speak ?? src.dur * .9; }
    else { s.dur = Math.max(2.4, s.text.length / (plan.cps || 14.5) + .8); s.speak = s.dur * .86; s.start = T0; }
    T0 = s.start + s.dur;
    let c = 0; s.words.forEach(w => { w.t = (src.start != null ? 0 : .15) + (c / chars) * s.speak; c += w.s.length + 1; });
    s.kt = k => (s.words[Math.max(0, Math.min(s.words.length - 1, k ?? 0))] || { t: 0 }).t;
    s.numWi = (s.numWis || [])[0] ?? 0; s.numWi2 = (s.numWis || [])[1] ?? s.numWi; s.entWi = s.entWis || [];
    SC.push(s);
  });
  TOTAL = T0 + 1.2; NFRAMES = Math.ceil(TOTAL * FPS);
  window.TOTAL = TOTAL; window.NFRAMES = NFRAMES;
  return { total: TOTAL, frames: NFRAMES, scenes: SC.map(s => ({ type: s.type, start: s.start, dur: s.dur, text: s.text })) };
}

function layoutCaption(s) {
  if (s._lay) return s._lay;
  for (const size of [52, 47, 42, 38, 34]) {
    LX.font = `800 ${size}px ${SANS}`; const sp = LX.measureText(' ').width; const lh = size * 1.22;
    let x = 0, line = 0; const out = [];
    for (const w of s.words) { const ww = LX.measureText(w.s).width; if (x + ww > 1640 && x > 0) { x = 0; line++; } out.push({ ...w, x, line }); x += ww + sp; }
    if (line < 3 || size === 34) return (s._lay = { size, lh, words: out });
  }
}
function drawCaption(s, t) {
  const L = layoutCaption(s);
  for (const w of L.words) {
    const p = seg(t, w.t - .05, w.t + .25); if (p <= 0) continue;
    txt(w.s, 140 + w.x, 150 + w.line * L.lh + (1 - eo(p)) * 18, { size: L.size, w: 800, color: w.acc ? VIO2 : WHITE, alpha: p, glow: w.acc ? 12 : 0 });
  }
}
function drawBG(T) {
  X.fillStyle = BG; X.fillRect(0, 0, W, H);
  X.save(); X.globalCompositeOperation = 'lighter';
  X.globalAlpha = .16; X.drawImage(BLOB, 1300 + Math.sin(T * .13) * 300 - 700, 500 + Math.cos(T * .1) * 200 - 700, 1400, 1400);
  X.globalAlpha = .11; X.drawImage(BLOB, 500 + Math.cos(T * .09) * 300 - 600, 400 + Math.sin(T * .12) * 200 - 600, 1200, 1200);
  X.restore();
  X.drawImage(GRID, -180 + Math.sin(T * .05) * 30, -180 + Math.cos(T * .04) * 20);
}
function drawHUD(T, si) {
  const prev = g; g = X;
  mono(`${PLAN.title} // РАЗБОР`, 60, 52, 18, DIM, { w: 700 });
  g.fillStyle = Math.floor(T * 2) % 2 ? VIO2 : 'rgba(185,162,255,.25)'; g.fillRect(40, 39, 10, 10);
  mono(`СЦЕНА ${pad(si + 1)}/${pad(SC.length)}`, 60, H - 40, 18, DIM, { w: 700 });
  g.strokeStyle = DIM2; g.lineWidth = 2; g.strokeRect(240, H - 52, 240, 10); g.fillStyle = VIO2; g.fillRect(242, H - 50, 236 * clamp(T / TOTAL), 6);
  mono(`REC ${pad(Math.floor(T / 60))}:${pad(Math.floor(T % 60))}:${pad(Math.floor(T * FPS) % FPS)}`, W - 60, H - 40, 18, DIM, { align: 'right', w: 700 });
  g = prev;
}
function renderFrame(f) {
  FR = f; const T = f / FPS;
  drawBG(T);
  let si = -1; for (let i = SC.length - 1; i >= 0; i--) if (T >= SC[i].start) { si = i; break; }
  if (si >= 0) {
    const s = SC[si], t = T - s.start, d = s.dur;
    LX.setTransform(1, 0, 0, 1, 0, 0); LX.clearRect(0, 0, W, H); g = LX;
    LX.save();
    try { (T_[s.type] || T_.hero)(t, d, s); } catch (e) { console.error('scene', si + 1, s.type, e.message); }
    LX.restore(); g = LX;
    if (s.cap !== false) drawCaption(s, t);
    const last = si === SC.length - 1;
    const fin = eo(seg(t, 0, .22)), fout = last ? 1 - seg(t, d + .2, d + 1.1) : 1 - seg(t, d - .16, d);
    const sc = 1 + .03 * eio(t / d) + .025 * (1 - eo(seg(t, 0, .4)));
    X.save(); X.globalAlpha = fin * fout; X.translate(CX, 600); X.scale(sc, sc); X.translate(-CX, -600); X.drawImage(LAY, 0, 0); X.restore();
    if (si > 0 && t < .14) {
      for (let k = 0; k < 7; k++) { const y = Math.floor(rnd(f * 13 + k) * H), h = 10 + rnd(f * 7 + k) * 70, dx = (rnd(f * 3 + k) - .5) * 90; X.drawImage(cvs, 0, y, W, h, dx, y, W, h); }
      X.save(); X.globalCompositeOperation = 'lighter'; X.fillStyle = `rgba(120,70,255,${.18 * (1 - t / .14)})`; X.fillRect(0, 0, W, H); X.restore();
    }
    drawHUD(T, si);
  }
  X.drawImage(VIGN, 0, 0);
  X.save(); X.globalAlpha = .03; X.globalCompositeOperation = 'lighter'; X.drawImage(GRAIN[f % 4], 0, 0, W, H); X.restore();
  if (T < .6) { X.fillStyle = `rgba(0,0,0,${1 - T / .6})`; X.fillRect(0, 0, W, H); }
}
const T_ = T;
window.loadPlan = loadPlan;
window.grab = (f, q = .93) => { renderFrame(f); return cvs.toDataURL('image/jpeg', q); };
