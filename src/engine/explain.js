// Сцены-объяснения для блога. «Рефералы»: герой делится ссылкой, друзья по одному регистрируются,
// от каждого к герою по линиям возвращаются монеты с процентом. В комиксе — хомяки, в неоне — узлы.
T.referral = function (t, d, s) {
  if ((PLAN.episode?.ref ?? 0) % 2 === 1) return referralTree(t, d, s);
  const Tabs = s.start + t, pct = s.p?.pct || '%', mascot = INK && PLAN.hasMascot;
  const hx = 520, hy = mascot ? 980 : 560, paw = [hx + 150, 620];
  const friends = [[1150, 430], [1440, 690], [1150, 960]];
  if (INK) { g.save(); g.globalAlpha = .35; g.beginPath(); roughEllipse(1250, 690, 560, 420, 1400, 3); g.fillStyle = mixHex(VIO, '#ffffff', .6); g.fill(); g.restore(); }
  // герой
  if (mascot) {
    const P = blendPose(POSES.wave, POSES.point, settle(seg(t, .2, .7))), E = { ...EMOS[t > 2.2 ? 'happy' : 'proud'] };
    E.open = 0; E.talk = mouthAt(s, t, Tabs) * .8;
    drawHamster({ ham: true, ph: 1.3, outfit: PLAN.episode?.outfit || 'suit' }, hx, hy, .95, P, E, Tabs, { flip: 1, held: fl => { g.rotate(-.3); g.beginPath(); g.roundRect(-26, -96, 52, 92, 10); g.fillStyle = '#1b1a1f'; g.fill(); g.fillStyle = VIO; g.fillRect(-20, -88, 40, 72); } });
  } else { ring(hx, hy, 120, 1, 4); txt('ТЫ', hx, hy + 22, { size: 64, w: 900, color: WHITE, align: 'center' }); }
  // линии-ссылки, друзья и монеты
  friends.forEach(([fx, fy], i) => {
    const t0 = .5 + i * .45, q = eo(seg(t, t0, t0 + .45)); if (q <= 0) return;
    const ax = mascot ? paw[0] : hx + 120, ay = mascot ? paw[1] : hy, cx = fx - (mascot ? 120 : 110), cy = mascot ? fy - 120 : fy;
    g.save(); g.setLineDash([16, 14]); g.lineDashOffset = -Tabs * 40; g.beginPath(); g.moveTo(ax, ay); g.lineTo(lerp(ax, cx, q), lerp(ay, cy, q));
    g.strokeStyle = INK ? INKC : VIO2; g.lineWidth = 5; g.stroke(); g.restore();
    const pop = settle(seg(t, t0 + .35, t0 + .75)); if (pop <= 0) return;
    if (mascot) { const [fur, furD] = CROWD_FUR[(i * 2 + 1) % CROWD_FUR.length]; const E = { ...EMOS.happy }; E.lx = -.8; drawHamster({ fur, furD, ham: true, ph: i * 2.1, outfit: null }, fx, fy + (1 - pop) * 80, .42 * pop, { ...POSES[t > t0 + 1 ? 'celebrate' : 'wave'] }, E, Tabs + i, { flip: -1 }); }
    else { ring(fx, fy, 70 * pop, 1, 3); txt('ДРУГ', fx, fy + 12, { size: 34, w: 900, color: WHITE, align: 'center', alpha: pop }); }
    // плашка «+ регистрация»
    const lp = seg(t, t0 + .6, t0 + .9);
    if (lp > 0) { g.save(); g.globalAlpha *= lp; const lx = fx + 120, ly = (mascot ? fy - 150 : fy) - 20; g.beginPath(); g.roundRect(lx - 10, ly - 34, 210, 50, 25); g.fillStyle = '#2fbf71'; g.fill(); if (INK) inkStroke(4); txt('+ регистрация', lx + 95, ly + 2, { size: 26, w: 800, color: '#fff', align: 'center' }); g.restore(); }
    // монеты возвращаются к герою — бесконечный поток, пока идёт сцена
    for (let k = 0; k < 3; k++) {
      const cq = ((t - t0 - 1.1) * .7 + k / 3) % 1; if (t - t0 - 1.1 < 0) break;
      rubCoin(lerp(cx, ax, eio(cq)), lerp(cy, ay, eio(cq)) - Math.sin(Math.PI * cq) * 50, 22, Tabs * 6 + k);
    }
  });
  // итог: процент герою
  const fp = settle(seg(t, 2.4, 2.8));
  if (fp > 0) { g.save(); g.translate(mascot ? hx : hx, mascot ? 330 : hy - 200); g.scale(fp, fp); g.rotate(-.05); const lbl = '+' + pct + ' ТЕБЕ', w = tw(lbl, 70, 900) + 80;
    g.beginPath(); g.roundRect(-w / 2, -60, w, 100, 24); g.fillStyle = '#f2cf6b'; g.fill(); if (INK) inkStroke(7); txt(lbl, 0, 16, { size: 70, w: 900, color: INKC, align: 'center' }); g.restore(); }
};

// вариант 2: дерево — герой сверху, под ним три друга, у каждого ещё по двое; монеты поднимаются по веткам вверх
function referralTree(t, d, s) {
  const Tabs = s.start + t, pct = s.p?.pct || '%', mascot = INK && PLAN.hasMascot, top = [CX, mascot ? 545 : 260];
  if (mascot) { const E = { ...EMOS[t > 2.4 ? 'happy' : 'proud'] }; E.open = 0; E.talk = mouthAt(s, t, Tabs) * .8; drawHamster({ ham: true, ph: 1.3, outfit: PLAN.episode?.outfit || 'suit' }, CX, 545, .55, { ...POSES[t > 2.4 ? 'celebrate' : 'wave'] }, E, Tabs, { flip: 1 }); }
  else { ring(CX, 260, 90, 1, 4); txt('ТЫ', CX, 280, { size: 52, w: 900, color: WHITE, align: 'center' }); }
  const L1 = [[CX - 520, 800], [CX, 800], [CX + 520, 800]];
  L1.forEach(([x, y], i) => {
    const t0 = .4 + i * .3, q = eo(seg(t, t0, t0 + .4)); if (q <= 0) return;
    rline(top[0], top[1] + 10, lerp(top[0], x, q), lerp(top[1] + 10, y - 190, q), 1500 + i, 5);
    const pop = settle(seg(t, t0 + .3, t0 + .65));
    const [fur, furD] = CROWD_FUR[(i * 2 + 1) % CROWD_FUR.length];
    if (pop > 0) { if (mascot) drawHamster({ fur, furD, ham: true, ph: i, outfit: null }, x, y + (1 - pop) * 60, .36 * pop, { ...POSES.wave }, { ...EMOS.happy }, Tabs + i, { flip: x < CX ? 1 : -1 }); else { ring(x, y - 60, 60 * pop, 1, 3); txt('ДРУГ', x, y - 48, { size: 28, w: 900, color: WHITE, align: 'center', alpha: pop }); } }
    for (let k = 0; k < 2; k++) {   // второй уровень
      const t1 = t0 + 1 + k * .2, q2 = eo(seg(t, t1, t1 + .35)); if (q2 <= 0) continue;
      const sx = x + (k ? 170 : -170), sy = 1030;
      rline(x, y + 10, lerp(x, sx, q2), lerp(y + 10, sy - 120, q2), 1520 + i * 3 + k, 3.5, .8);
      const p2 = settle(seg(t, t1 + .25, t1 + .55)); if (p2 > 0) { if (mascot) drawHamster({ fur: CROWD_FUR[(i + k) % CROWD_FUR.length][0], furD: CROWD_FUR[(i + k) % CROWD_FUR.length][1], ham: true, ph: k, outfit: null }, sx, sy, .24 * p2, { ...POSES.neutral }, { ...EMOS.happy }, Tabs + k, { flip: 1 }); else ring(sx, sy - 40, 40 * p2, 1, 2); }
    }
    for (let k = 0; k < 2; k++) { const cq = ((t - t0 - 1) * .6 + k / 2) % 1; if (t - t0 - 1 < 0) break; rubCoin(lerp(x, top[0], eio(cq)), lerp(y - 190, top[1] + 10, eio(cq)), 20, Tabs * 6 + k); }
  });
  const fp = settle(seg(t, 2.6, 3)); if (fp > 0) { g.save(); g.translate(CX + 330, 330); g.scale(fp, fp); g.rotate(-.05); const lbl = '+' + pct + ' ТЕБЕ', w = tw(lbl, 60, 900) + 70; g.beginPath(); g.roundRect(-w / 2, -54, w, 90, 22); g.fillStyle = '#f2cf6b'; g.fill(); if (INK) inkStroke(6); txt(lbl, 0, 14, { size: 60, w: 900, color: INKC, align: 'center' }); g.restore(); }
}
