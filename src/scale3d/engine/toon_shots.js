/* Сцены тестового выпуска «Что если бы ты видел, сколько кому осталось». Каждая фраза — своя постановка: локация, герои, действия, камера, инфографика. */
const HERO = { top: '#2f6fd6', sleeve: true, garment: 'hoodie', hat: 'helmet', pants: '#2b2f3f', seed: 1 };
const GIRL = { top: '#9b59b6', garment: 'coat', sleeve: true, hair: 'tail', hairCol: '#5a3524', hold: 'umbrella', umbCol: '#c0392b', pants: 'ink', seed: 3 };
const MAN = { top: '#8a8f99', garment: 'coat', sleeve: true, scarf: '#c0392b', hold: 'cup', pants: '#2b2f3f', seed: 5 };
const KID = { top: '#1f9e8f', garment: 'hoodie', sleeve: true, hat: 'cap', hatCol: '#2f5fb8', hold: 'phone', pants: '#26324a', seed: 7 };
const GRAN = { top: '#9b7bc9', garment: 'dress', sleeve: true, hair: 'bun', hairCol: '#d4d7de', glasses: true, apron: true, pants: 'ink', seed: 9 };
const YOUNG = { top: '#e0672e', garment: 'hoodie', sleeve: true, hold: 'phone', pants: '#2b2f3f', seed: 11 };
const WORKER = { top: '#e8eef5', garment: 'tee', sleeve: true, pants: '#3b4252', glasses: true, seed: 13 };
function chair(x, y, s = 1, col = '#8a5d40') { X.save(); X.translate(x, y); X.scale(s, s); rr(-50, -78, 100, 14, 5, col); X.fillStyle = shade(col, -.2); X.fillRect(-46, -64, 10, 64); X.fillRect(36, -64, 10, 64); X.fillRect(-50, -190, 12, 120); rr(-56, -196, 24, 70, 6, col); X.restore(); }
const T2 = {};
// 0. Утро: будильник, потягивается в кровати → идёт к зеркалу; в отражении над головой загораются цифры
T2.wake = (u, o, t, d) => { const tb = u * d, cut = d * .42;
  if (tb < cut) { camSet(cam(tb / cut, [[0, 560, 560, 1.0], [1, 520, 600, 1.12]])); bedroom(t, { ring: true });
    guy({ ...HERO, x: 330, y: 720, s: 1.05, acts: [[0, 'stretch'], [cut * .6, 'bedsit']], face: tb < cut * .6 ? { eyes: 'closed', mouth: 'o' } : null, noShadow: true }, t, tb);
    rr(110, 650, 760, 120, 40, '#4f7ad1'); return; }
  const k = (tb - cut) / (d - cut), x = lerp(900, 1440, sm(prog(k, 0, .6)));
  camSet(cam(k, [[0, 1180, 560, 1.05], [.6, 1400, 560, 1.15], [1, 1560, 560, 1.4]])); bedroom(t, {});
  X.save(); X.beginPath(); X.roundRect(1596, 276, 198, 588, 98); X.clip(); guy({ ...HERO, x: 1705, y: 880, s: .8, dir: -1, act: 'idle', noShadow: true }, t, tb);
  tag(1705, headTop({ y: 880, s: .8 }) + 30, '52 ГОДА', '#4dff9b', prog(k, .75, .95), 34); X.restore();
  guy({ ...HERO, x, y: 960, s: 1.2, act: k < .6 ? 'walk' : 'idle' }, t, tb); };
// 1. Крупно зеркало: цифры, секунды тикают, герой в шоке
T2.mirror = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 1695, 560, 1.75], [1, 1695, 540, 1.95]])); bedroom(t, {});
  X.save(); X.beginPath(); X.roundRect(1596, 276, 198, 588, 98); X.clip(); guy({ ...HERO, x: 1705, y: 880, s: .8, dir: -1, acts: [[0, 'idle'], [d * .35, 'shock']], noShadow: true }, t, tb); X.restore();
  tag(1695, headTop({ y: 880, s: .8 }) + 30, '52 г · 3 мес · 9 дн', '#4dff9b', 1, 24); SMALL(hms(86400 - (tb + 51720) % 86400).slice(0, 8), 1695, 300, 22, '#bfffd8'); };
// 2. Инфографика: огромный обратный отсчёт и кольцо
T2.countdown = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 960, 540, 1.0], [1, 960, 540, 1.12]])); infoBg(t);
  const k = 1 - (tb % 1); X.strokeStyle = 'rgba(77,255,155,.18)'; X.lineWidth = 28; X.beginPath(); X.arc(960, 520, 300, 0, Math.PI * 2); X.stroke();
  X.strokeStyle = '#4dff9b'; X.shadowColor = '#4dff9b'; X.shadowBlur = 30; X.beginPath(); X.arc(960, 520, 300, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); X.stroke(); X.shadowBlur = 0;
  BIG('52 г · 3 мес · 9 дн', 960, 450, 78, '#4dff9b', prog(u, 0, .15)); BIG(hms(86400 - (tb + 51726) % 86400).slice(0, 8), 960, 560, 96, '#ffffff', prog(u, .05, .2)); SMALL('−1 секунда каждую секунду', 960, 900, 44, '#fff', prog(u, .3, .45)); };
// 3. Дождливая улица: герой выходит, над прохожими загораются цифры
T2.street = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 760, 560, 1.0], [1, 1020, 560, 1.06]])); street(t);
  guy({ ...GIRL, x: 300, y: 930, s: 1.05, act: 'idle', face: { eyes: 'meh', mouth: 'line' } }, t, tb); guy({ ...MAN, x: 820, y: 960, s: 1.1, dir: -1, act: 'idle', face: { eyes: 'meh', mouth: 'line' } }, t, tb);
  guy({ ...KID, x: 1480, y: 950, s: 1.08, act: 'phone' }, t, tb); guy({ ...HERO, x: lerp(-200, 520, sm(prog(u, 0, .7))), y: 1010, s: 1.2, act: u < .7 ? 'walk' : 'idle' }, t, tb);
  tag(300, headTop({ y: 930, s: 1.05 }) - 140, '61 ГОД', '#4dff9b', prog(u, .35, .5)); tag(820, headTop({ y: 960, s: 1.1 }), '28 ЛЕТ', '#ffb347', prog(u, .5, .65)); tag(1480, headTop({ y: 950, s: 1.08 }), '00:00:11:00', '#ff3b4a', prog(u, .65, .8));
  rain(t); fogBand(980, 1200, 'rgba(180,195,210,.25)'); };
// 4. Средние планы: девушка с зонтом → мужчина с кофе
T2.people = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 330, 520, 1.55], [.5, 360, 520, 1.6], [.5, 820, 560, 1.55], [1, 840, 560, 1.6]])); street(t);
  guy({ ...GIRL, x: 300, y: 930, s: 1.05, act: u < .5 ? 'talk' : 'idle', face: u < .5 ? null : { eyes: 'meh', mouth: 'line' } }, t, tb); guy({ ...MAN, x: 820, y: 960, s: 1.1, dir: -1, act: u >= .5 ? 'talk' : 'idle' }, t, tb);
  tag(300, headTop({ y: 930, s: 1.05 }) - 140, '61 ГОД', '#4dff9b', 1); tag(820, headTop({ y: 960, s: 1.1 }), '28 ЛЕТ', '#ffb347', 1); rain(t); };
// 5. Парень в кепке: красные 11 секунд — тикают
const kidTimer = (t) => Math.max(.4, 11 - (t - (PH[5]?.s || 0)) * .8);
T2.kid = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 1400, 600, 1.2], [.2, 1480, 560, 2.0], [1, 1480, 550, 2.1]])); street(t);
  guy({ ...KID, x: 1480, y: 950, s: 1.08, act: 'phone' }, t, tb); tag(1480, headTop({ y: 950, s: 1.08 }), hms(kidTimer(t)), '#ff3b4a', 1); rain(t, 200); };
// 6. Герой: шок → страх → срывается с места
T2.heroShock = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 560, 600, 1.7], [.75, 560, 600, 1.85], [1, 700, 620, 1.5]])); street(t);
  guy({ ...HERO, x: 560, y: 1010, s: 1.2, acts: [[0, 'shock'], [d * .4, 'fear'], [d * .78, 'run']] }, t, tb); BIG(String(Math.ceil(kidTimer(t))), 800, 420, 200, '#ff3b4a', prog(u, .1, .2)); rain(t); };
// 7. Рывок: бежит, хватает за руку, мимо проносится грузовик
T2.save = (u, o, t, d) => { const tb = u * d, hx = lerp(500, 1300, sm(prog(u, 0, .35))), pulled = u > .38, kx = pulled ? lerp(1480, 1360, eo(prog(u, .38, .5))) : 1480;
  SHX = u > .5 && u < .8 ? Math.sin(t * 60) * 8 : 0; camSet(cam(u, [[0, 1000, 600, 1.1], [.35, 1300, 600, 1.25], [1, 1320, 590, 1.2]]));
  street(t, { truck: u > .45 ? lerp(-900, 2600, prog(u, .45, .8)) : null });
  guy({ ...KID, x: kx, y: 1010, s: 1.08, dir: pulled ? -1 : 1, act: pulled ? 'shock' : 'phone' }, t, tb); tag(kx, headTop({ y: 1010, s: 1.08 }), hms(kidTimer(t)), '#ff3b4a', 1);
  guy({ ...HERO, x: hx, y: 1020, s: 1.2, act: u < .35 ? 'run' : 'pull' }, t, tb); rain(t); };
// 8. Таймер замер и сменился: 46 лет; радость
T2.relief = (u, o, t, d) => { const tb = u * d, flip = u > .35; camSet(cam(u, [[0, 1330, 560, 1.4], [1, 1330, 540, 1.5]])); street(t, { green: flip });
  guy({ ...KID, x: 1400, y: 1010, s: 1.08, dir: -1, acts: [[0, 'shock'], [d * .5, 'joy']] }, t, tb); guy({ ...HERO, x: 1180, y: 1020, s: 1.2, acts: [[0, 'idle'], [d * .5, 'joy']] }, t, tb);
  const fl = u > .25 && u < .35 ? (Math.sin(t * 60) > 0) : flip; tag(1400, headTop({ y: 1010, s: 1.08 }), fl ? '46 ЛЕТ' : hms(kidTimer(PH[5].s + 10.2)), fl ? '#4dff9b' : '#ff3b4a', 1); rain(t, 160, .25); };
// 9. Вывод: не приговор (плашка UI поверх общего плана)
T2.verdict = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 960, 600, 1.0], [1, 960, 600, .95]])); street(t, { green: true });
  guy({ ...KID, x: 1400, y: 1010, s: 1.08, dir: -1, act: 'talk' }, t, tb); guy({ ...HERO, x: 1180, y: 1020, s: 1.2, act: 'talk' }, t, tb); tag(1400, headTop({ y: 1010, s: 1.08 }), '46 ЛЕТ', '#4dff9b', 1); rain(t, 120, .2); };
// 10. Инфографика: вся жизнь — 73 года клеточками
T2.calendar = (u, o, t, d) => { camSet(cam(u, [[0, 960, 540, 1.05], [1, 960, 540, 1.0]])); infoBg(t, '#14213a'); const fill = Math.floor(eo(prog(u, .05, .8)) * 876);
  for (let i = 0; i < 876; i++) { const c = i % 73, r = Math.floor(i / 73), on = i < fill; rr(250 + c * 19.6, 300 + r * 30, 15, 24, 3, on ? (r < 4 ? '#4dff9b' : '#3fb3ff') : 'rgba(255,255,255,.08)'); }
  BIG(Math.round(26700 * eo(prog(u, .05, .8))).toLocaleString('ru-RU').replace(/\s/g, ' ') + ' ДНЕЙ', 960, 190, 110, '#ffd400', prog(u, 0, .1)); SMALL('≈ 73 года — средняя продолжительность жизни в России', 960, 720, 42, '#fff', prog(u, .3, .45)); };
// 11. Треть жизни — сон: спальня ночью + круговая диаграмма
T2.sleep = (u, o, t, d) => { camSet(cam(u, [[0, 620, 560, 1.15], [1, 760, 540, 1.0]])); bedroom(t, { night: true, mirror: false });
  circ(240, 640, 46, INK); X.strokeStyle = '#fff'; X.lineWidth = 4; for (const ex of [-14, 14]) { X.beginPath(); X.arc(240 + ex, 636, 8, .2, Math.PI - .2); X.stroke(); } rr(110, 650, 760, 120, 40, '#3d4f8a');
  for (let k = 0; k < 3; k++) { const f = (t * .5 + k / 3) % 1; SMALL('z', 300 + f * 60 + k * 10, 580 - f * 120, 30 + k * 8, `rgba(255,255,255,${1 - f})`); }
  const k = eo(prog(u, .15, .6)), cx = 1380, cy = 520; circ(cx, cy, 210, 'rgba(255,255,255,.08)'); X.beginPath(); X.moveTo(cx, cy); X.arc(cx, cy, 210, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 / 3 * k); X.closePath(); X.fillStyle = '#7b6cff'; X.shadowColor = '#7b6cff'; X.shadowBlur = 30; X.fill(); X.shadowBlur = 0;
  BIG(Math.round(33 * k) + '%', cx, cy, 120, '#fff', prog(u, .15, .25)); SMALL('жизни — во сне', cx, cy + 270, 44, '#fff', prog(u, .4, .55)); };
// 12. Телефон: 7 лет жизни в экране
T2.phone = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 560, 620, 1.6], [.45, 560, 620, 1.7], [.45, 960, 560, 1.0], [1, 960, 560, 1.03]])); bedroom(t, { night: true, mirror: false });
  chair(560, 960, 1.1, '#5b4a6a'); guy({ ...HERO, x: 560, y: 960, s: 1.2, act: 'sitphone', hold: 'phone', noShadow: true }, t, tb); glow(600, 640, 260, 'rgba(120,200,255,.22)');
  if (u > .45) { X.fillStyle = 'rgba(10,12,24,.55)'; X.fillRect(-1000, -600, 4000, 2400); const k = eo(prog(u, .5, .85)); rr(260, 640, 1400, 60, 30, 'rgba(255,255,255,.12)'); rr(260, 640, 1400 * k, 60, 30, '#3fb3ff'); rr(260 + 1400 * k * (66 / 73), 640, 1400 * k * (7 / 73), 60, 0, '#ff3b4a');
    BIG('7+ ЛЕТ', 960, 430, 170, '#ff3b4a', prog(u, .5, .6)); SMALL('в телефоне — если 3 часа в день', 960, 790, 46, '#fff', prog(u, .6, .75)); } };
// 13. Офис: цифра большая, а жизнь откладывается — часы летят
T2.office = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 900, 560, 1.1], [1, 960, 520, 1.25]])); office(t * 6);
  chair(880, 950, 1.1, '#3b4252'); guy({ ...WORKER, x: 880, y: 950, s: 1.15, acts: [[0, 'sitphone'], [d * .55, 'sitsad']], hold: null, noShadow: true }, t, tb);
  const yrsLeft = Math.floor(lerp(41, 34, prog(u, .1, .95))); tag(880, headTop({ y: 950 + 110, s: 1.15 }), `${yrsLeft} ${yrs(yrsLeft)}`, '#ffb347', 1); SMALL('потом… потом… потом…', 1320, 420, 40, '#2b3140', prog(u, .3, .45)); };
// 14. Кухня: бабушка с «2 года» печёт и смеётся, парень с «50 лет» грустит в телефоне
T2.kitchen = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 420, 560, 1.35], [.5, 460, 560, 1.4], [.5, 1260, 600, 1.35], [1, 1280, 600, 1.4]])); kitchen(t);
  guy({ ...GRAN, x: 420, y: 950, s: 1.0, acts: [[0, 'bake'], [d * .3, 'laugh']] }, t, tb); tag(420, headTop({ y: 950, s: 1 }) - 10, '2 ГОДА', '#ffb347', 1);
  chair(1300, 960, 1.05); guy({ ...YOUNG, x: 1300, y: 960, s: 1.1, act: 'sitphone', noShadow: true }, t, tb); tag(1300, headTop({ y: 960 + 104, s: 1.1 }), '50 ЛЕТ', '#4dff9b', 1); };
// 15. Крыша на закате: дело не в длине цифры
T2.roof = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 900, 560, 1.25], [1, 960, 520, 1.0]])); rooftop(t);
  guy({ ...HERO, x: 820, y: 940, s: 1.2, dir: 1, acts: [[0, 'think'], [d * .55, 'joy']] }, t, tb); };
// 16. Снова зеркало: цифры гаснут
T2.mirrorEnd = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 1500, 560, 1.35], [1, 1660, 520, 1.9]])); bedroom(t, {});
  X.save(); X.beginPath(); X.roundRect(1596, 276, 198, 588, 98); X.clip(); guy({ ...HERO, x: 1705, y: 880, s: .8, dir: -1, acts: [[0, 'idle'], [d * .5, 'wave']], noShadow: true }, t, tb);
  const k = 1 - prog(u, .35, .7); tag(1695, headTop({ y: 880, s: .8 }) + 30, '52 г · 3 мес · 9 дн', '#4dff9b', k, 24);
  for (let i = 0; i < 18; i++) { const f = prog(u, .35, .8); if (f > 0 && f < 1) circ(1700 + Math.cos(i) * f * 110, 400 + Math.sin(i * 1.7) * f * 70, 4 * (1 - f), '#bfffd8'); } X.restore();
  guy({ ...HERO, x: 1440, y: 960, s: 1.2, act: 'idle', face: { eyes: 'open', mouth: 'smile' } }, t, tb); };
// 17. Вопрос зрителю
T2.ask = (u, o, t, d) => { const tb = u * d; camSet(cam(u, [[0, 700, 560, 1.15], [1, 680, 560, 1.2]])); rooftop(t); guy({ ...HERO, x: 600, y: 940, s: 1.25, act: 'wave' }, t, tb); };
