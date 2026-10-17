// Сцены-объяснения для блога. «Рефералы»: герой делится ссылкой, друзья по одному регистрируются,
// от каждого к герою по линиям возвращаются монеты с процентом. В комиксе — хомяки, в неоне — узлы.
T.referral = function (t, d, s) {
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
