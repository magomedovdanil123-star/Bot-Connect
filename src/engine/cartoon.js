// «Живой Хомяк»: мини-мультики. Сцена cartoon — короткий фильм из нескольких планов (улица → магазин → касса → дом):
// герой ходит (шаг привязан к пройденному пути — лапки не «скользят»), камера ведёт его, предметы переходят в лапы,
// второстепенные персонажи отвечают репликами в облачках, рот двигается, пока персонаж говорит.
// Мультик описывается списком планов (CARTOONS); каждый план рисует свою локацию, героев и события по времени плана.

const FLOOR = 975;
// шаг: фаза зависит от пройденного расстояния; покачивание, подпрыгивание, взмахи лапок, наклон вперёд
function walkPose(dist, moving, base = POSES.neutral) {
  if (!moving) return { ...base };
  const w = Math.sin(dist / 42), P = { ...base };
  P.lLeg = Math.max(0, w) * 24; P.rLeg = Math.max(0, -w) * 24; P.lift = -Math.abs(w) * 9;
  P.hl = -18 + w * 28; P.hr = -18 - w * 28; P.lean = 5; P.head = -2 + Math.sin(dist / 21) * 2;
  return P;
}
// путь по ключам [[t, x], ...] с плавным разгоном/торможением между ключами
function track(keys, t) {
  if (t <= keys[0][0]) return { x: keys[0][1], v: 0 };
  for (let i = 1; i < keys.length; i++) {
    const [t0, x0] = keys[i - 1], [t1, x1] = keys[i];
    if (t <= t1) { const u = (t - t0) / Math.max(1e-6, t1 - t0), e = eio(u); const v = (x1 - x0) / Math.max(1e-6, t1 - t0) * (6 * u * (1 - u)); return { x: lerp(x0, x1, e), v }; }
  }
  return { x: keys[keys.length - 1][1], v: 0 };
}
// пройденный путь к моменту t (для фазы шага)
function distAt(keys, t) { let d = 0, prev = track(keys, 0).x; for (let s = .05; s <= t; s += .05) { const x = track(keys, s).x; d += Math.abs(x - prev); prev = x; } return d; }
// говорит ли персонаж: рот «болтает» в окнах реплик
const talking = (lines, t) => lines.some(([a, b]) => t >= a && t <= b) ? .35 + .4 * Math.abs(Math.sin(t * 17)) : 0;

// реквизит
function productBox(x, y, s = 1, col = '#f2c14e') { g.save(); g.translate(x, y); g.scale(s, s); rrect(-34, -60, 68, 60, 901, col, 4, 8); rrect(-24, -44, 48, 18, 902, '#fff', 2.5, 4); g.restore(); }
function counter(x0, x1) { rrect(x0, 760, x1 - x0, 230, 910, '#c98b5a', 6, 10); rrect(x0 - 20, 740, x1 - x0 + 40, 34, 911, '#a86c3f', 5, 8); rline(x0 + 30, 830, x1 - 30, 830, 912, 3, .4); }
function storefront(x) { // фасад магазина на улице: козырёк, вывеска, дверь
  rrect(x, 330, 620, 390, 920, '#fff7e8', 6); rrect(x - 20, 300, 660, 70, 921, '#e8394d', 6, 10);
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#e8394d'; g.fillRect(x - 20 + i * 110, 370, 110, 40); } rline(x - 20, 410, x + 640, 410, 922, 4);
  txt('МАГАЗИН', x + 310, 350, { size: 44, w: 900, color: '#fff', align: 'center' });
  rrect(x + 230, 470, 160, 250, 923, '#8ad1f0', 5, 6); rline(x + 310, 470, x + 310, 720, 924, 4); rrect(x + 40, 470, 150, 150, 925, '#bfe6f7', 4); rrect(x + 430, 470, 150, 150, 926, '#bfe6f7', 4);
}
function laptop(x, y, screenFn) { // ноутбук сбоку-спереди: экран повёрнут к зрителю наполовину
  g.save(); g.translate(x, y);
  g.beginPath(); g.moveTo(-170, 0); g.lineTo(170, 0); g.lineTo(150, -22); g.lineTo(-150, -22); g.closePath(); g.fillStyle = '#c9ced6'; g.fill(); inkStroke(5);
  g.beginPath(); g.moveTo(-150, -22); g.lineTo(-170, -250); g.lineTo(170, -250); g.lineTo(150, -22); g.closePath(); g.fillStyle = '#2e3440'; g.fill(); inkStroke(5);
  g.save(); g.beginPath(); g.moveTo(-138, -34); g.lineTo(-155, -238); g.lineTo(155, -238); g.lineTo(138, -34); g.closePath(); g.clip(); g.fillStyle = '#f7f9fc'; g.fillRect(-170, -250, 340, 230); screenFn?.(); g.restore();
  g.restore();
}
function toast(x, y, p, title, sub) { // уведомление-плашка: выезжает и пружинит
  if (p <= 0) return; const s = settle(clamp(p)); g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-.03);
  rrect(-260, -70, 520, 140, 930, '#fff', 6, 22); g.beginPath(); g.arc(-190, 0, 40, 0, 6.2832); g.fillStyle = '#2fbf71'; g.fill(); inkStroke(4);
  txt('₽', -190, 16, { size: 46, w: 900, color: '#fff', align: 'center' }); txt(title, -130, -6, { size: 46, w: 900, color: '#2fbf71' }); mono(sub, -130, 36, 22, INKC, { w: 700 });
  g.restore();
}
// персонаж в мультике: поза/эмоция/предмет в лапе, рот по репликам
function actor(L, x, k, P, E, Tabs, flip, held) { drawHamster(L, x, FLOOR, k, P, E, Tabs, { flip, held }); }
const HERO = () => ({ ham: true, ph: 1.3, outfit: PLAN.episode?.outfit || 'hoodie' });
const CASHIER = { ham: true, ph: 2.7, fur: '#cfc6bb', furD: '#a99e90', outfit: 'sport' };
const PASSER = { ham: true, ph: .4, fur: '#a8754a', furD: '#8a5d37' };

// камера плана: увеличение z вокруг точки F (в координатах сцены), ставится в точку экрана S
function shotCamera(z, F, S = [CX, 540]) { g.translate(S[0], S[1]); g.scale(z, z); g.translate(-F[0], -F[1]); }
const onScreen = (x, z, F, S = [CX, 540]) => S[0] + (x - F[0]) * z;   // мировая x → экранная (для кадра Shorts)
// Shorts вырезают из кадра полосу ~900 px: двухгеройные планы ставим теснее, чтобы оба героя помещались целиком
const V = (h, v) => VERT ? v : h;

// ---------- мультик «Поход в магазин»: улица → полка → касса → дом, ноутбук и первый доход ----------
const CARTOONS = {
  shop: [
    { dur: 5.5, draw(t, T) { // улица: идёт к магазину, камера едет следом; навстречу проходит прохожий
      const keys = [[0, 260], [4.6, 2340]], { x, v } = track(keys, t), camX = clamp(x - 760, 0, 1920);
      g.save(); g.translate(-camX, 0);
      drawLocation('street', T); g.save(); g.translate(1920, 0); drawLocation('street', T); g.restore(); storefront(2160);
      const px = 2900 - t * 300, pd = t * 300; actor(PASSER, px, .62, walkPose(pd, true), { ...EMOS.neutral }, T, -1);
      const P = walkPose(distAt(keys, t), Math.abs(v) > 30), E = { ...EMOS[t > 3.8 ? 'happy' : 'neutral'] };
      actor(HERO(), x, .8, P, E, T, 1); this.fx = x - camX;
      if (t > 3.6) bubble(x + 120, FLOOR - 470, t - 3.6, 'Магазин!', false);
      g.restore();
    } },
    { dur: 6, draw(t, T) { // полка: подходит, думает, тянется — товар в лапе, радуется и идёт к кассе
      const keys = [[0, -200], [1.6, V(820, 900)], [4.4, V(820, 900)], [6, 2200]], { x, v } = track(keys, t), moving = Math.abs(v) > 30;
      const z = 1 + .18 * eio(seg(t, 1.8, 2.6)) - .18 * eio(seg(t, 4.2, 4.8));
      g.save(); shotCamera(z, [900, 620]);
      drawLocation('shop', T); rrect(980, 640, 200, 16, 940, '#cfc6b8', 4);
      const got = t > 3.25, fly = seg(t, 2.95, 3.25);
      if (!got) { productBox(lerp(1080, 1000, eio(fly)), lerp(640, 560, eio(fly)), 1.35); if (t > 1.6) { const r = (t * 1.6) % 1; g.save(); g.globalAlpha *= (1 - r) * .8; g.beginPath(); g.arc(1080, 600, 50 + r * 60, 0, 6.2832); g.strokeStyle = '#f2c14e'; g.lineWidth = 6; g.stroke(); g.restore(); } }   // товар мерцает — взгляд зрителя на нём
      let P = walkPose(distAt(keys, t), moving), E = { ...EMOS.neutral };
      if (!moving && t < 2.5) { P = blendPose(POSES.neutral, POSES.think, eio(seg(t, 1.7, 2.1))); E = { ...EMOS.think }; }
      if (!moving && t >= 2.5) { P = blendPose(POSES.think, POSES.reach, eio(seg(t, 2.5, 2.95))); if (got) P = blendPose(POSES.reach, POSES.proud, eio(seg(t, 3.3, 3.8))); E = { ...EMOS[got ? 'happy' : 'focus'] }; }
      if (moving && t > 4) P.hr = 40;   // несёт покупку перед собой
      actor(HERO(), x, 1, P, E, T, 1, got ? () => productBox(0, 30, 1) : null); this.fx = onScreen(lerp(x, (x + 1080) / 2, eio(seg(t, 1.2, 1.8) - seg(t, 4.4, 5))), z, [900, 620]);   // плавно: идёт — за героем, стоит — на героя и товар
      if (t > 1.8 && t < 2.6) bubble(x + 140, FLOOR - 560, t - 1.8, 'Хмм…');
      if (got && t < 4.4) sticker('ЕСТЬ!', x + V(330, 250), FLOOR - 600, t - 3.3, 3);
      g.restore();
    } },
    { dur: 7, draw(t, T) { // касса: диалог с кассиром, оплата картой, деньги улетают, «Спасибо!»
      const HX = V(760, 930), CXs = V(1360, 1320), keys = [[0, -200], [1.3, HX], [5.6, HX], [7, -300]], { x, v } = track(keys, t), moving = Math.abs(v) > 30;
      const z = 1 + .12 * eio(seg(t, 1.3, 2)), back = t > 5.6;
      g.save(); shotCamera(z, [1000, 640]);
      drawLocation('shop', T);
      const cTalk = talking([[1.9, 2.9], [5.0, 5.8]], t), hTalk = talking([[1.3, 1.85]], t);
      actor(CASHIER, CXs, 1.05, blendPose(POSES.neutral, POSES.explain, cTalk ? 1 : 0), { ...EMOS[t > 4.6 ? 'happy' : 'neutral'], talk: cTalk, lx: -.6 }, T, -1);
      counter(V(1000, 1080), 1700);
      const onCounter = seg(t, 1.5, 1.8); if (t > 1.5) productBox(lerp(x + 120, V(1200, 1230), eio(onCounter)), lerp(FLOOR - 300, 742, eio(onCounter)), 1);
      const TX = V(1080, 1130), tp = seg(t, 2.9, 3.3), paid = t > 3.9; terminal(TX, 680, tp, paid);
      let P = walkPose(distAt(keys, t), moving), E = { ...EMOS.neutral, talk: hTalk };
      if (!moving && !back) { P = t < 3.1 ? blendPose(POSES.neutral, POSES.hold, eio(seg(t, 2.6, 3))) : t < 4.2 ? blendPose(POSES.hold, POSES.tap, eio(seg(t, 3.1, 3.5))) : blendPose(POSES.tap, POSES.wave, eio(seg(t, 4.9, 5.3))); E = { ...EMOS[paid ? 'happy' : 'focus'], talk: hTalk }; }
      const card = !moving && t > 2.6 && t < 4.4;
      actor(HERO(), x, 1, P, E, T, back ? -1 : 1, card ? () => bankCard(120) : null); this.fx = onScreen(lerp(x, (HX + CXs) / 2, eio(seg(t, .9, 1.5) - seg(t, 5.6, 6.2))), z, [1000, 640]);
      if (t > 1.3 && t < 1.95) bubble(x + 150, FLOOR - 560, t - 1.3, 'Картой можно?', false);
      if (t > 1.9 && t < 2.9) bubble(CXs - 140, FLOOR - 560, t - 1.9, '350 ₽', false);
      if (paid) { flyMoney(TX, 640, CXs, 520, t - 3.9, 6); floatLabel('−350 ₽', TX, 520, t - 4.1, RED); sticker('ВЖУХ!', V(900, 1000), 380, t - 3.9, 1); }
      if (t > 5.0 && t < 5.8) bubble(CXs - 140, FLOOR - 560, t - 5.0, 'Спасибо!', false);
      g.restore();
    } },
    { dur: 7.5, draw(t, T) { // дом: ноутбук, отправил ссылку другу — уведомление «+5 000 ₽», прыжок радости
      const z = 1.05 + .2 * eio(seg(t, 2.6, 3.4)) - .2 * eio(seg(t, 4.2, 4.8));
      g.save(); shotCamera(z, [930, 640]);
      drawLocation('home', T);
      rrect(1000, 760, 560, 26, 950, '#c98b5a', 5, 8); rrect(1040, 786, 26, 200, 951, '#a86c3f', 4); rrect(1490, 786, 26, 200, 952, '#a86c3f', 4);
      const sent = t > 2.6, money = t > 4.0;
      laptop(1280, 760, () => {
        rrect(-140, -232, 280, 30, 953, '#e8eef6', 0); mono('партнёрка · моя ссылка', 0, -212, 16, INKC, { align: 'center', w: 700 });
        rrect(-110, -180, 220, 44, 954, sent ? '#2fbf71' : VIO, 3, 10); txt(sent ? 'ОТПРАВЛЕНО ✓' : 'ПОДЕЛИТЬСЯ', 0, -150, { size: 22, w: 900, color: '#fff', align: 'center' });
        for (let i = 0; i < 3; i++) rrect(-110, -120 + i * 26, 220 - i * 50, 12, 955 + i, '#dfe5ee', 0);
      });
      const jump = money ? Math.max(0, Math.sin(seg(t, 4.4, 5.3) * Math.PI)) * 120 : 0;
      let P = blendPose(POSES.neutral, POSES.tap, eio(seg(t, .4, .8))), E = { ...EMOS.focus };
      if (t > .8 && t < 2.6) { P.hr = 88 + Math.sin(t * 22) * 8; P.rEl = 6 + Math.sin(t * 22) * 6; }   // печатает
      if (money) { P = blendPose(POSES.shock, POSES.celebrate, eio(seg(t, 4.3, 4.6))); P.lift = -jump; E = { ...EMOS[t < 4.4 ? 'shock' : 'happy'] }; }
      actor(HERO(), V(820, 880), 1, P, E, T, 1); this.fx = onScreen(1060, z, [930, 640]);
      if (sent && !money) bubble(V(1000, 1060), FLOOR - 600, t - 2.6, 'Скинул другу ссылку…', false);
      toast(V(1280, 1080), 330, seg(t, 4.0, 4.4), '+5 000 ₽', 'друг зарегистрировался');
      if (money) { confetti(V(820, 880), FLOOR - 640, t - 4.4); sticker('УРА!', V(520, 1330), V(360, 560), t - 4.4, 2); }
      g.restore();
    } },
  ],
};
const cartoonDur = name => (CARTOONS[name] || CARTOONS.shop).reduce((a, s) => a + s.dur, 0);

T.cartoon = function (t, d, s) {
  const shots = CARTOONS[s.p?.name] || CARTOONS.shop, Tabs = s.start + t;
  let t0 = 0, i = 0; while (i < shots.length - 1 && t >= t0 + shots[i].dur) t0 += shots[i++].dur;
  const sh = shots[i], lt = t - t0;
  sh.draw(lt, Tabs);
  s._fx = sh.fx ?? CX;   // куда смотреть в вертикальном кадре Shorts
  // склейка планов: короткая шторка-затемнение
  const edge = Math.min(lt, sh.dur - lt);
  if (i > 0 && lt < .25) { g.save(); g.fillStyle = `rgba(27,26,31,${1 - lt / .25})`; g.fillRect(0, 0, W, H); g.restore(); }
  if (i < shots.length - 1 && sh.dur - lt < .2) { g.save(); g.fillStyle = `rgba(27,26,31,${1 - edge / .2})`; g.fillRect(0, 0, W, H); g.restore(); }
};
