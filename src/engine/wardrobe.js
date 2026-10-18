// Гардероб Хомяка: образ зависит от места сцены. Кухня — шеф, спальня — пижама, пляж — гавайка и соломенная шляпа,
// зима и Новый год — свитер, шапка и шарф, нора — каска шахтёра с фонариком, лес и пикник — жилет туриста, игровая — наушники…
// Скафандр — только в космосе. Тело рисуется в клипе по туловищу, шапки — в системе головы (макушка ~ y −464).
function hamChef() {
  clothBase('#f7f6f2');
  g.beginPath(); roughEllipse(0, -206, 122, 30, 701, 1); g.fillStyle = '#e9ecef'; g.fill(); inkStroke(4.5);
  g.beginPath(); g.moveTo(-40, -212); g.lineTo(40, -212); g.lineTo(0, -168); g.closePath(); g.fillStyle = '#e8394d'; g.fill(); inkStroke(3.5);
  for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(sd * 34, -140 + k * 40, 7, 0, 6.2832); g.fillStyle = '#d9dde4'; g.fill(); inkStroke(2.5); }
}
function hatToque() {
  g.beginPath(); g.roundRect(-84, -520, 168, 70, 10); g.fillStyle = '#fff'; g.fill(); inkStroke(6);
  for (const [x, y, r] of [[-60, -560, 52], [0, -590, 62], [60, -560, 52]]) { g.beginPath(); roughEllipse(x, y, r, r * .9, 710 + x, 1.2); g.fillStyle = '#fff'; g.fill(); inkStroke(6); }
  g.fillStyle = '#fff'; g.fillRect(-80, -540, 160, 40);
}
function hamPajama() {
  clothBase('#9cc7ff');
  g.fillStyle = '#ffd43b'; for (let i = 0; i < 9; i++) { const x = -120 + (i % 3) * 110 + (Math.floor(i / 3) % 2) * 50, y = -300 + Math.floor(i / 3) * 100; g.save(); g.translate(x, y); g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 6 : 15, a = k / 10 * 6.2832 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore(); }
  g.beginPath(); roughEllipse(0, -206, 118, 28, 721, 1); g.fillStyle = '#fff'; g.fill(); inkStroke(4);
  for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(0, -150 + k * 42, 7, 0, 6.2832); g.fillStyle = '#fff'; g.fill(); inkStroke(2.5); }
}
function hatNightcap(T, sway = 0) {
  g.beginPath(); g.moveTo(-130, -452); g.quadraticCurveTo(-60, -620, 150 + sway * 2, -600); g.quadraticCurveTo(60, -540, 130, -452); g.closePath(); g.fillStyle = '#9cc7ff'; g.fill(); inkStroke(6);
  g.beginPath(); g.roundRect(-136, -472, 272, 34, 16); g.fillStyle = '#fff'; g.fill(); inkStroke(5);
  g.beginPath(); g.arc(150 + sway * 2, -600, 26, 0, 6.2832); g.fillStyle = '#fff'; g.fill(); inkStroke(5);
}
function hamHawaii() {
  clothBase('#ffd43b');
  for (let i = 0; i < 8; i++) { const x = -130 + (i % 4) * 85, y = -310 + Math.floor(i / 4) * 150 + (i % 2) * 40; g.save(); g.translate(x, y); g.rotate(i); g.beginPath(); roughEllipse(0, 0, 34, 14, 730 + i, 1); g.fillStyle = '#2f9e44'; g.fill(); g.restore();
    g.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * 6.2832; g.ellipse(x + 30 + Math.cos(a) * 10, y + 30 + Math.sin(a) * 10, 9, 9, 0, 0, 6.2832); } g.fillStyle = '#ff6b6b'; g.fill(); }
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 6, -220); g.lineTo(sd * 70, -236); g.lineTo(sd * 30, -150); g.closePath(); g.fillStyle = '#ffe066'; g.fill(); inkStroke(4); }
}
function hatStraw() {
  g.beginPath(); g.ellipse(0, -452, 200, 34, 0, 0, 6.2832); g.fillStyle = '#e9c46a'; g.fill(); inkStroke(6);
  g.beginPath(); g.moveTo(-104, -458); g.bezierCurveTo(-100, -560, 100, -560, 104, -458); g.closePath(); g.fillStyle = '#f2d17a'; g.fill(); inkStroke(6);
  g.fillStyle = '#e8394d'; g.fillRect(-102, -488, 204, 22); g.beginPath(); g.rect(-102, -488, 204, 22); inkStroke(3);
  g.save(); g.globalAlpha *= .3; for (let x = -180; x <= 180; x += 30) { g.beginPath(); g.moveTo(x, -440); g.lineTo(x * .6, -462); inkStroke(2); } g.restore();
}
function hamSweater() {
  clothBase('#c0392b');
  g.save(); g.fillStyle = '#fff'; for (const y of [-250, -110]) for (let x = -170; x < 170; x += 30) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 15, y - 18); g.lineTo(x + 30, y); g.lineTo(x + 15, y + 18); g.closePath(); g.fill(); } g.restore();
  g.beginPath(); roughEllipse(0, -212, 150, 40, 741, 1.2); g.fillStyle = '#ffd43b'; g.fill(); inkStroke(5);   // шарф
  g.beginPath(); g.roundRect(46, -210, 48, 140, 12); g.fillStyle = '#ffd43b'; g.fill(); inkStroke(4.5); for (let k = 0; k < 3; k++) { g.fillStyle = '#e8394d'; g.fillRect(46, -180 + k * 40, 48, 12); }
}
function hatBeanie() {
  g.beginPath(); g.moveTo(-150, -440); g.bezierCurveTo(-150, -590, 150, -590, 150, -440); g.closePath(); g.fillStyle = '#2e86de'; g.fill(); inkStroke(6);
  g.beginPath(); g.roundRect(-156, -470, 312, 46, 18); g.fillStyle = '#1c6dc0'; g.fill(); inkStroke(5); g.save(); g.globalAlpha *= .4; for (let x = -140; x < 150; x += 20) { g.beginPath(); g.moveTo(x, -466); g.lineTo(x, -430); inkStroke(2); } g.restore();
  g.beginPath(); roughEllipse(0, -600, 40, 38, 751, 2); g.fillStyle = '#fff'; g.fill(); inkStroke(5);
}
function hamOveralls() {
  clothBase('#f08c00');
  g.fillStyle = '#3d6fb6'; g.fillRect(-170, -150, 340, 170); g.beginPath(); g.roundRect(-80, -210, 160, 80, 8); g.fill(); g.beginPath(); g.roundRect(-80, -210, 160, 80, 8); inkStroke(4);
  for (const sd of [-1, 1]) { g.fillStyle = '#3d6fb6'; g.fillRect(sd * 70 - 14, -330, 28, 130); g.beginPath(); g.arc(sd * 70, -206, 9, 0, 6.2832); g.fillStyle = '#ffd43b'; g.fill(); inkStroke(2.5); }
  g.beginPath(); g.rect(-170, -150, 340, 2); inkStroke(4);
}
function hatMiner(T) {
  g.beginPath(); g.moveTo(-150, -440); g.bezierCurveTo(-150, -600, 150, -600, 150, -440); g.closePath(); g.fillStyle = '#ffd43b'; g.fill(); inkStroke(6);
  g.beginPath(); g.ellipse(0, -440, 180, 22, 0, 0, 6.2832); g.fillStyle = '#f2b800'; g.fill(); inkStroke(5);
  g.beginPath(); g.roundRect(-30, -540, 60, 50, 10); g.fillStyle = '#5b5f6b'; g.fill(); inkStroke(4); g.beginPath(); g.arc(0, -515, 18, 0, 6.2832); g.fillStyle = '#fff6c8'; g.fill(); inkStroke(3);
  g.save(); g.globalCompositeOperation = 'screen'; const lg = g.createRadialGradient(0, -515, 5, 0, -515, 260); lg.addColorStop(0, 'rgba(255,240,180,.55)'); lg.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = lg; g.beginPath(); g.arc(0, -515, 260, 0, 6.2832); g.fill(); g.restore();
}
function hamVest() {
  clothBase('#e9ecef');
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 20, -236); g.lineTo(sd * 170, -236); g.lineTo(sd * 170, 10); g.lineTo(sd * 20, 10); g.closePath(); g.fillStyle = '#6b8e4e'; g.fill(); inkStroke(4.5); for (const y of [-160, -80]) { g.beginPath(); g.roundRect(sd * 95 - 34, y, 68, 54, 6); g.fillStyle = '#5a7a40'; g.fill(); inkStroke(3); } }
}
function hatBucket() {
  g.beginPath(); g.moveTo(-190, -440); g.quadraticCurveTo(0, -470, 190, -440); g.lineTo(150, -470); g.quadraticCurveTo(0, -500, -150, -470); g.closePath(); g.fillStyle = '#c9b48a'; g.fill(); inkStroke(5);
  g.beginPath(); g.moveTo(-120, -470); g.bezierCurveTo(-110, -580, 110, -580, 120, -470); g.closePath(); g.fillStyle = '#d6c39a'; g.fill(); inkStroke(6);
}
function headphones(T) {
  g.beginPath(); g.arc(0, -350, 170, Math.PI * 1.05, Math.PI * 1.95); g.strokeStyle = INKC; g.lineWidth = 30; g.stroke(); g.strokeStyle = '#2b2d42'; g.lineWidth = 20; g.stroke();
  for (const sd of [-1, 1]) { g.beginPath(); g.roundRect(sd * 168 - 30, -400, 60, 100, 26); g.fillStyle = '#2b2d42'; g.fill(); inkStroke(5); g.beginPath(); g.roundRect(sd * 168 - 18, -385, 36, 70, 16); g.fillStyle = `hsl(${(T * 80) % 360},90%,60%)`; g.fill(); }
}
function hamCardigan() {
  clothBase('#8c6a4f');
  g.beginPath(); g.moveTo(-50, -232); g.lineTo(50, -232); g.lineTo(0, -120); g.closePath(); g.fillStyle = '#fff'; g.fill(); inkStroke(4);
  for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 4, -230); g.lineTo(sd * 44, -232); g.lineTo(sd * 22, -204); g.closePath(); g.fillStyle = '#fff'; g.fill(); inkStroke(3); }
  for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(14, -100 + k * 36, 7, 0, 6.2832); g.fillStyle = '#f2cf6b'; g.fill(); inkStroke(2.5); }
  g.beginPath(); g.moveTo(0, -120); g.lineTo(0, 10); inkStroke(4);
}
function smartGlasses() { for (const sd of [-1, 1]) { g.beginPath(); g.arc(sd * 64, -352, 40, 0, 6.2832); g.strokeStyle = INKC; g.lineWidth = 7; g.stroke(); } g.beginPath(); g.moveTo(-24, -356); g.quadraticCurveTo(0, -366, 24, -356); inkStroke(6); }
function hatGradCap() { smartGlasses(); g.beginPath(); g.moveTo(-200, -480); g.lineTo(0, -540); g.lineTo(200, -480); g.lineTo(0, -420); g.closePath(); g.fillStyle = '#1b1a20'; g.fill(); inkStroke(5); g.beginPath(); g.roundRect(-90, -470, 180, 40, 8); g.fill(); g.beginPath(); g.moveTo(0, -480); g.lineTo(150, -440); g.lineTo(150, -380); g.strokeStyle = '#ffd43b'; g.lineWidth = 6; g.stroke(); }
function neckPillow() { g.beginPath(); g.ellipse(0, -214, 150, 46, 0, Math.PI * .05, Math.PI * .95, true); g.strokeStyle = INKC; g.lineWidth = 64; g.lineCap = 'round'; g.stroke(); g.strokeStyle = '#ff8fab'; g.lineWidth = 52; g.stroke(); }
function hatCap() { g.beginPath(); g.moveTo(-150, -450); g.bezierCurveTo(-150, -590, 150, -590, 150, -450); g.closePath(); g.fillStyle = '#e8394d'; g.fill(); inkStroke(6); g.beginPath(); g.ellipse(90, -448, 130, 26, -.1, 0, 6.2832); g.fillStyle = '#c92a3a'; g.fill(); inkStroke(5); }
function glasses3d() { for (const [sd, c] of [[-1, 'rgba(255,60,60,.55)'], [1, 'rgba(60,140,255,.55)']]) { g.beginPath(); g.roundRect(sd * 64 - 46, -386, 92, 64, 10); g.fillStyle = c; g.fill(); inkStroke(6); } g.beginPath(); g.moveTo(-18, -360); g.lineTo(18, -360); inkStroke(7); g.beginPath(); g.moveTo(-110, -366); g.lineTo(-150, -380); g.moveTo(110, -366); g.lineTo(150, -380); inkStroke(7); }
function bowTie() { g.beginPath(); g.moveTo(0, -196); g.lineTo(-40, -220); g.lineTo(-40, -172); g.closePath(); g.moveTo(0, -196); g.lineTo(40, -220); g.lineTo(40, -172); g.closePath(); g.fillStyle = '#e8394d'; g.fill(); inkStroke(4); g.beginPath(); g.arc(0, -196, 10, 0, 6.2832); g.fillStyle = '#c92a3a'; g.fill(); inkStroke(3); }
function hamTux() { const keep = { s: HC.suit, l: HC.suitL, d: HC.suitD, t: HC.tie, t2: HC.tie2 }; Object.assign(HC, { suit: '#1b1a20', suitL: '#3a3a44', suitD: '#0d0d10', tie: '#1b1a20', tie2: '#1b1a20' }); hamSuit(); bowTie(); Object.assign(HC, { suit: keep.s, suitL: keep.l, suitD: keep.d, tie: keep.t, tie2: keep.t2 }); }
function hamApron() { hamHoodie(); g.beginPath(); g.roundRect(-110, -190, 220, 210, 20); g.fillStyle = '#fff4d6'; g.fill(); inkStroke(5); g.beginPath(); g.roundRect(-50, -110, 100, 60, 8); inkStroke(3.5); txt('₽', 0, -66, { size: 34, w: 900, color: INKC, align: 'center' }); }

Object.assign(OUTFITS, {
  chef: { body: hamChef, sleeve: () => '#f7f6f2', cuff: '#e9ecef', hat: hatToque },
  pajama: { body: hamPajama, sleeve: () => '#9cc7ff', hat: hatNightcap },
  beach: { body: hamHawaii, sleeve: () => '#ffd43b', hat: hatStraw },
  winter: { body: hamSweater, sleeve: () => '#c0392b', hat: hatBeanie },
  miner: { body: hamOveralls, sleeve: () => '#f08c00', hat: hatMiner },
  hiker: { body: hamVest, sleeve: () => '#e9ecef', hat: hatBucket },
  gamer: { body: () => { const h = HC.hood; HC.hood = '#2b2d42'; hamHoodie(); HC.hood = h; }, sleeve: () => '#2b2d42', hat: headphones },
  student: { body: hamCardigan, sleeve: () => '#8c6a4f', hat: smartGlasses },
  grad: { body: hamCardigan, sleeve: () => '#8c6a4f', hat: hatGradCap },
  traveler: { body: () => { hamHoodie(); neckPillow(); }, sleeve: () => HC.hood || VIO, hat: hatCap },
  tuxedo: { body: hamTux, sleeve: () => '#1b1a20', cuff: '#fff', cool: true },
  cinema: { body: hamHoodie, sleeve: () => HC.hood || VIO, hat: glasses3d },
  apron: { body: hamApron, sleeve: () => HC.hood || VIO },
});
// место → образ (без места — образ выпуска); зимой на улице — свитер и шапка
const PLACE_OUTFIT = { kitchen: 'chef', pizzeria: 'chef', bakery: 'chef', bedroom: 'pajama', beach: 'beach', yacht: 'beach', newyear: 'winter', ski: 'winter', burrow: 'miner', treasury: 'miner', garage: 'miner',
  forest: 'hiker', picnic: 'hiker', dacha: 'hiker', gameroom: 'gamer', library: 'student', school: 'grad', airport: 'traveler', train: 'traveler', tvshow: 'tuxedo', concert: 'cinema', cinema: 'cinema',
  bazaar: 'apron', pvz: 'apron', flowers: 'apron', petshop: 'apron', office: 'suit', bank: 'suit', exchange: 'suit', salon: 'suit', gym: 'sport', stadium: 'sport', space: 'astronaut', courier: 'traveler' };
const HOODS = ['#7048e8', '#e8394d', '#2f9e44', '#1c7ed6', '#f08c00', '#d6336c', '#0ca678', '#5c7cfa'];
function outfitFor(place) {
  const m = new Date().getMonth() + 1, winter = m === 12 || m <= 2;
  if (PLACE_OUTFIT[place]) return PLACE_OUTFIT[place];
  if (winter && ['street', 'park', 'roof', 'bazaar'].includes(place)) return 'winter';
  const ep = PLAN.episode?.outfit || 'hoodie'; return ep === 'astronaut' ? 'hoodie' : ep;
}
