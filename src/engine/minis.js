// Мини-мультики внутри сцен-историй: короткие действия на 2–4 с, привязанные к словам фразы (голос не сбивается).
// Курьер приносит коробку, корзина наполняется товарами, ноутбук с графиком и уведомлением о доходе, телефон крупно со списанием/зачислением.
const COURIER = { ham: true, ph: 3.1, fur: '#cfc6bb', furD: '#a99e90', outfit: 'hoodie', hood: '#ffd43b' };
function miniCourier(st, ts, floorY, val) {
  const f = st.c.flip, stopX = st.x + f * 330, from = st.x + f * 1300, k = st.k * .92;
  const inU = seg(ts, 0, 1.3), outU = seg(ts, 2.9, 4.1), x = outU > 0 ? lerp(stopX, from, eio(outU)) : lerp(from, stopX, eio(inU)), moving = inU < 1 || (outU > 0 && outU < 1);
  const P = walkPose(Math.abs(x - from), moving, POSES[ts > 1.3 && ts < 2.9 ? (ts < 2 ? 'hold' : 'wave') : 'neutral']), E = { ...EMOS[ts > 1.6 ? 'happy' : 'neutral'] };
  // жёлтый короб-рюкзак за спиной
  g.save(); g.translate(x - f * -1 * 0, floorY); g.scale(k, k); rrect(f > 0 ? 60 : -210, -430, 150, 170, 7301, '#ffd43b', 6, 12); txt('₽', f > 0 ? 135 : -135, -330, { size: 60, w: 900, color: INKC, align: 'center' }); g.restore();
  drawHamster(COURIER, x, floorY, k, P, E, ts * 1.3, { flip: -f });
  // коробка: у курьера → летит герою → у героя
  const give = seg(ts, 1.6, 2.2), bx = lerp(x - f * 120 * k, st.x + f * 150 * st.k, eio(give)), by = lerp(floorY - 300 * k, floorY - 300 * st.k, give) - Math.sin(Math.PI * give) * 80;
  if (ts > .2) { g.save(); g.translate(bx, by); g.rotate(Math.sin(give * 6) * .15); rrect(-70, -60, 140, 110, 7310, '#d9a86c', 6, 6); rline(-70, -20, 70, -20, 7311, 4); rline(0, -60, 0, 50, 7312, 4); g.restore(); }
  if (val && ts > 2.2) floatLabel(val, st.x, floorY - 640 * st.k, ts - 2.2, RED);
}
function miniCart(st, ts, floorY, val) {
  const f = st.c.flip, cx = st.x + f * 300 * st.k, cy = floorY - 40, s = settle(seg(ts, 0, .4)) * st.k;
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.beginPath(); g.moveTo(-150, -260); g.lineTo(150, -260); g.lineTo(120, -80); g.lineTo(-120, -80); g.closePath(); g.fillStyle = 'rgba(200,215,230,.5)'; g.fill(); inkStroke(7);
  for (let k = 1; k < 4; k++) rline(-150 + k * 75, -258, -120 + k * 60, -82, 7320 + k, 3, .6);
  rline(-150, -260, -220, -330, 7330, 8); rcircle(-90, -20, 26, 7331, '#2b2d42', 4); rcircle(90, -20, 26, 7332, '#2b2d42', 4); rline(-120, -80, -110, -40, 7333, 6); rline(120, -80, 110, -40, 7334, 6);
  const items = [['#e8394d', 70, 60], ['#ffd43b', 60, 80], ['#74c0fc', 80, 50], ['#8ce99a', 50, 70], ['#ff8fab', 66, 66], ['#f08c00', 60, 90], ['#be4bdb', 72, 56]];
  items.forEach(([c, w, h], i) => { const q = seg(ts, .3 + i * .22, .7 + i * .22); if (q <= 0) return; const tx = -100 + (i % 4) * 60, ty = -260 - Math.floor(i / 4) * 70; const x = lerp(tx + 260 * (i % 2 ? 1 : -1), tx, eio(q)), y = lerp(ty - 420, ty, eio(q)) - Math.sin(Math.PI * q) * 60; rrect(x - w / 2, y - h, w, h, 7340 + i, c, 4, 8); });
  g.restore();
  if (val) floatLabel('−' + val.replace(/^[−+-]/, ''), cx, floorY - 520 * st.k, ts - 1.9, RED);
}
// плашка-уведомление с иконкой-надписью (для вставок новостей: «AI», «!»)
function newsToast(x, y, p, icon, col, title, sub) {
  if (p <= 0) return; const s = settle(clamp(p)); g.save(); g.translate(x, y); g.scale(s, s); g.rotate(-.03);
  rrect(-260, -70, 520, 140, 931, '#fff', 6, 22); g.beginPath(); g.arc(-190, 0, 40, 0, 6.2832); g.fillStyle = col; g.fill(); inkStroke(4);
  txt(icon, -190, 14, { size: icon.length > 1 ? 34 : 46, w: 900, color: '#fff', align: 'center' }); txt(title, -130, -6, { size: 40, w: 900, color: col }); mono(sub, -130, 36, 22, INKC, { w: 700 });
  g.restore();
}
function miniLaptop(st, ts, floorY, val, cat) {
  const f = st.c.flip, x = st.x + f * 330 * st.k, s = settle(seg(ts, 0, .4)) * st.k;
  g.save(); g.translate(x, floorY); g.scale(s, s);
  rrect(-220, -330, 440, 30, 7401, '#c98b5a', 5, 8); rline(-190, -300, -190, 0, 7402, 8); rline(190, -300, 190, 0, 7403, 8);
  // новость про нейросети: на экране — чат с ИИ, реплики появляются по очереди
  if (cat === 'ai') { laptop(0, -330, () => { for (let k = 0; k < 4; k++) { const q = seg(ts, .3 + k * .45, .6 + k * .45); if (q <= 0) continue; const me = k % 2 === 0, w = [170, 210, 150, 230][k]; g.save(); g.globalAlpha = q; rrect(me ? 140 - w : -140, -228 + k * 46, w, 36, 7420 + k, me ? '#d0ebff' : '#e9ecef', 2, 14); if (!me) { g.beginPath(); g.arc(-150, -210 + k * 46, 12, 0, 6.2832); g.fillStyle = '#7048e8'; g.fill(); } g.restore(); } }); g.restore();
    return newsToast(st.x, floorY - 760 * st.k, seg(ts, 1.6, 2.1), 'AI', '#7048e8', 'Готово!', 'Нейросеть ответила за 1 секунду'); }
  laptop(0, -330, () => { const p = emph(seg(ts, .3, 1.6)); poly([[-120, -70], [-60, -100], [0, -90], [60, -150], [120, -200]].map(([a, b], i, A) => i / (A.length - 1) <= p ? [a, b] : null).filter(Boolean), 1, { color: '#2fbf71', lw: 8 }); });
  g.restore();
  toast(st.x, floorY - 760 * st.k, seg(ts, 1.4, 1.9), val ? '+' + val.replace(/^[+−-]/, '') : '+500 ₽', 'Пришла выплата');
}
function miniPhone(st, ts, floorY, val, text, cat) {
  // новость про мошенников: входящий звонок «Служба безопасности банка» — экран пульсирует
  if (cat === 'scam' || cat === 'tech') {
    const f = st.c.flip, x = st.x + f * 300 * st.k, y = floorY - 470 * st.k, p = settle(seg(ts, 0, .45)), s = p * st.k * 1.15, ring = Math.sin(ts * 18) * (cat === 'scam' && ts < 2.5 ? .05 : 0);
    g.save(); g.translate(x, y); g.rotate(-f * .08 + ring); g.scale(s, s);
    rrect(-130, -240, 260, 480, 7501, '#1b1a20', 7, 36); rrect(-112, -214, 224, 420, 7502, cat === 'scam' ? '#2b2d42' : '#f8f9fa', 3, 22);
    if (cat === 'scam') {
      mono('Входящий звонок', 0, -150, 22, '#adb5bd', { align: 'center', w: 700 }); txt('БАНК', 0, -90, { size: 52, w: 900, color: '#fff', align: 'center' }); mono('служба безопасности', 0, -55, 20, '#ff8787', { align: 'center', w: 700 });
      for (let k = 0; k < 3; k++) { const q = (ts * .9 + k / 3) % 1; g.beginPath(); g.arc(0, 40, 40 + q * 60, 0, 6.2832); g.strokeStyle = `rgba(255,255,255,${.4 * (1 - q)})`; g.lineWidth = 4; g.stroke(); }
      g.beginPath(); g.arc(0, 40, 38, 0, 6.2832); g.fillStyle = '#495057'; g.fill(); txt('?', 0, 58, { size: 50, w: 900, color: '#fff', align: 'center' });
      for (const [bx, c] of [[-60, '#e03131'], [60, '#2fbf71']]) { g.beginPath(); g.arc(bx, 150, 30, 0, 6.2832); g.fillStyle = c; g.fill(); inkStroke(3); }
    } else {
      txt('Обновление', 0, -120, { size: 34, w: 900, color: INKC, align: 'center' }); const q = clamp(ts / 3); rrect(-90, -70, 180, 24, 7520, '#e9ecef', 3, 12); g.fillStyle = '#4dabf7'; g.fillRect(-88, -68, 176 * q, 20); mono(Math.round(q * 100) + '%', 0, -10, 26, INKC, { align: 'center', w: 800 });
    }
    g.restore(); return;
  }
  const minus = /спис|трат|минус|подписк|оплат/i.test(text), f = st.c.flip, x = st.x + f * 300 * st.k, y = floorY - 470 * st.k, p = settle(seg(ts, 0, .45)), s = p * st.k * 1.15;
  g.save(); g.translate(x, y); g.rotate(-f * .08); g.scale(s, s);
  rrect(-130, -240, 260, 480, 7501, '#1b1a20', 7, 36); rrect(-112, -214, 224, 420, 7502, '#f8f9fa', 3, 22);
  rrect(-40, -230, 80, 14, 7503, '#1b1a20', 0, 7);
  const n = seg(ts, .5, .9); if (n > 0) { g.save(); g.globalAlpha = n; rrect(-100, -190 + (1 - n) * -40, 200, 96, 7504, minus ? '#ffe3e3' : '#d3f9d8', 3, 16); txt(minus ? '−' + (val || '299 ₽').replace(/^[+−-]/, '') : '+' + (val || '500 ₽').replace(/^[+−-]/, ''), 0, -140 + (1 - n) * -40, { size: 40, w: 900, color: minus ? '#e03131' : '#2f9e44', align: 'center' }); mono(minus ? 'Списание' : 'Зачисление', 0, -110 + (1 - n) * -40, 18, INKC, { align: 'center', w: 700 }); g.restore(); }
  for (let k = 0; k < 4; k++) { const q = seg(ts, .8 + k * .15, 1.1 + k * .15); if (q <= 0) continue; g.save(); g.globalAlpha = q; rrect(-100, -60 + k * 64, 200, 50, 7510 + k, '#e9ecef', 2, 10); mono(minus ? ['Кофе', 'Доставка', 'Подписка', 'Такси'][k] : ['Выплата', 'Кэш', 'Продажа', 'Бонус'][k], -84, -28 + k * 64, 18, INKC, { w: 700 }); mono((minus ? '−' : '+') + [250, 700, 299, 450][k], 84, -28 + k * 64, 18, minus ? '#e03131' : '#2f9e44', { align: 'right', w: 800 }); g.restore(); }
  g.restore();
}
