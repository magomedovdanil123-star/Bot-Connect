// Персонаж для обложек крупным планом (как у топовых «Что если»-каналов): голова и плечи, огромные глаза с веками и бровями,
// руки у лица (хватается за голову, ладони на щеках, рука у подбородка, скрещённые руки, кулак в камеру…), контровой свет по краю.
// Единицы: радиус головы = 100, центр головы (0,0). Возвращает <g>…</g> для SVG.
// spec: { who, pose, eyes, mouth, brows?, look?: [-1..1, -1..1], tilt?, headTilt?, rim?, outfit?: {top, hair, hairCol, bow, glasses, hat, hatCol, garment, skin}, sweat?, tears?, blush?, flip? }
const LOOKS = {
  hero: { top: '#1e8bff', garment: 'hoodie' },
  girl: { top: '#ff6fb5', garment: 'sweater', hair: 'long', hairCol: '#6b3420', bow: '#ff2d8a' },
  mom: { top: '#d9577a', garment: 'dress', hair: 'bun', hairCol: '#6b3a26' },
  dad: { top: '#5b7a5a', garment: 'tee', glasses: true },
  granny: { top: '#9b7bc9', garment: 'dress', hair: 'bun', hairCol: '#d4d7de', glasses: true },
  teacher: { top: '#2f7f7a', garment: 'dress', hair: 'bun', hairCol: '#6b3a26', glasses: true },
  friend: { top: '#f39c12', garment: 'hoodie', hair: 'spiky' },
  bully: { top: '#5d6d7e', garment: 'tee', hat: 'cap', hatCol: '#c0392b' },
  stranger: { top: '#1b1d24', garment: 'hoodie', hood: true },
  doc: { top: '#f4f6f8', garment: 'coat', hair: 'long', hairCol: '#c9a26b', glasses: true },
  man: { top: '#8a8f99', garment: 'coat' },
  news: { top: '#c0392b', garment: 'dress', hair: 'long', hairCol: '#1d1410' },
  kid: { top: '#ff8fc8', garment: 'sweater', hair: 'long', hairCol: '#c97a3a', bow: '#ffd400' },
};
const OUT = '#0a0a0e';
let UID = 0;
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), f = c => Math.max(0, Math.min(255, Math.round(c * k))); return '#' + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, '0')).join(''); };

// позы: s — плечо, e — локоть, h — кисть, f — кисть поверх лица, k — форма кисти, hr — поворот кисти, hs — размер кисти
const POSES = {
  down: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [150, 330], h: [150, 470], k: 'fist' }],
  up: [{ s: [-108, 165], e: [-250, 60], h: [-270, -150], k: 'open', hr: -15 }, { s: [108, 165], e: [250, 60], h: [270, -150], k: 'open', hr: 15 }],
  cheeks: [{ s: [-108, 165], e: [-200, 270], h: [-96, 40], k: 'open', f: 1, hr: 20 }, { s: [108, 165], e: [200, 270], h: [96, 40], k: 'open', f: 1, hr: -20 }],
  grabhead: [{ s: [-108, 165], e: [-250, 30], h: [-82, -82], k: 'open', f: 1, hr: 35 }, { s: [108, 165], e: [250, 30], h: [82, -82], k: 'open', f: 1, hr: -35 }],
  chin: [{ s: [-108, 165], e: [-150, 330], h: [95, 300], k: 'fist', f: 1 }, { s: [108, 165], e: [160, 330], h: [40, 112], k: 'fist', f: 1, hr: -10 }],
  cross: [{ s: [-108, 165], e: [-160, 300], h: [120, 268], k: 'fist', f: 1 }, { s: [108, 165], e: [160, 300], h: [-120, 262], k: 'fist', f: 1 }],
  point: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [235, 150], h: [345, 40], k: 'point', f: 1, hr: -100 }],
  pointnear: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [200, 190], h: [250, 70], k: 'point', f: 1, hr: -100 }],
  pointup: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [250, 110], h: [255, -80], k: 'point', f: 1, hr: 0 }],
  mouth: [{ s: [-108, 165], e: [-190, 300], h: [-24, 64], k: 'open', f: 1, hr: 70 }, { s: [108, 165], e: [190, 300], h: [28, 56], k: 'open', f: 1, hr: -70 }],
  shh: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [170, 320], h: [12, 70], k: 'point', f: 1, hr: 0 }],
  facepalm: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [210, 210], h: [36, -38], k: 'open', f: 1, hr: -60 }],
  fist: [{ s: [-108, 165], e: [-230, 250], h: [-215, 110], k: 'fist', f: 1 }, { s: [108, 165], e: [210, 290], h: [175, 215], k: 'fist', f: 1, hs: 1.7 }],
  thumb: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [230, 270], h: [240, 120], k: 'thumb', f: 1 }],
  shrug: [{ s: [-108, 165], e: [-215, 260], h: [-310, 170], k: 'open', f: 1, hr: 100 }, { s: [108, 165], e: [215, 260], h: [310, 170], k: 'open', f: 1, hr: -100 }],
  hold: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [240, 260], h: [255, 70], k: 'fist', f: 1 }],
  think: [{ s: [-108, 165], e: [-150, 330], h: [95, 300], k: 'fist', f: 1 }, { s: [108, 165], e: [215, 170], h: [98, -62], k: 'point', f: 1, hr: -40 }],
  wave: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [250, 90], h: [270, -110], k: 'open', f: 1, hr: 10 }],
  peace: [{ s: [-108, 165], e: [-150, 330], h: [-150, 470], k: 'fist' }, { s: [108, 165], e: [215, 190], h: [200, 10], k: 'peace', f: 1 }],
  reach: [{ s: [-108, 165], e: [-200, 250], h: [-130, 210], k: 'open', f: 1, hs: 1.5, hr: 10 }, { s: [108, 165], e: [200, 250], h: [130, 210], k: 'open', f: 1, hs: 1.5, hr: -10 }],
  phone: [{ s: [-108, 165], e: [-150, 330], h: [-60, 260], k: 'fist', f: 1 }, { s: [108, 165], e: [160, 330], h: [60, 250], k: 'fist', f: 1 }],
  cover: [{ s: [-108, 165], e: [-210, 250], h: [-40, -10], k: 'open', f: 1, hr: 80 }, { s: [108, 165], e: [210, 250], h: [40, -10], k: 'open', f: 1, hr: -80 }],   // закрыл глаза руками (подглядывает)
};

function hand(k, x, y, rot, sc, gid) {
  const g = (inner) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${sc})">${inner}</g>`, F = `url(#${gid})`, st = `stroke="#3a3a48" stroke-width="3"`;
  if (k === 'fist') return g(`<ellipse rx="40" ry="36" fill="${F}" ${st}/><path d="M-26 -14 Q-10 -22 4 -14 M-28 4 Q-12 -4 2 4" stroke="#44444f" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="26" cy="-10" rx="14" ry="20" fill="${F}" ${st}/>`);
  if (k === 'open') return g(`<ellipse rx="38" ry="44" fill="${F}" ${st}/><ellipse cx="-34" cy="10" rx="13" ry="24" transform="rotate(-30 -34 10)" fill="${F}" ${st}/><path d="M-14 -38 L-14 -20 M2 -42 L2 -22 M18 -38 L18 -20" stroke="#44444f" stroke-width="4" stroke-linecap="round"/>`);
  if (k === 'point') return g(`<rect x="-10" y="-112" width="22" height="80" rx="11" fill="${F}" ${st}/><ellipse rx="36" ry="34" fill="${F}" ${st}/><ellipse cx="28" cy="-6" rx="13" ry="18" fill="${F}" ${st}/>`);
  if (k === 'thumb') return g(`<rect x="-12" y="-104" width="26" height="74" rx="13" fill="${F}" ${st}/><ellipse rx="40" ry="34" fill="${F}" ${st}/><path d="M-30 -2 L26 -2 M-30 14 L26 14" stroke="#44444f" stroke-width="4" stroke-linecap="round"/>`);
  if (k === 'peace') return g(`<rect x="-26" y="-110" width="20" height="80" rx="10" transform="rotate(-12 -16 -30)" fill="${F}" ${st}/><rect x="6" y="-110" width="20" height="80" rx="10" transform="rotate(12 16 -30)" fill="${F}" ${st}/><ellipse rx="36" ry="34" fill="${F}" ${st}/>`);
  return '';
}

function eyes(st, look, id, glow) {
  const [lx, ly] = look, out = [];
  for (const side of [-1, 1]) {
    const cx = side * 43 + lx * 10, cy = -4 + ly * 6, inner = -side;   // inner — направление к переносице
    const ix = cx + inner * 30, ox = cx - inner * 30;
    let clip = null, brow = null;   // верхнее веко — линия от внешнего угла к внутреннему (y ниже = прикрыто)
    if (st === 'angry' || st === 'glow') { clip = [ox, cy - 34, ix, cy - 6]; brow = [ox - side * -4, cy - 54, ix, cy - 22]; }
    if (st === 'worried' || st === 'teary') { clip = [ox, cy - 12, ix, cy - 32]; brow = [ox, cy - 32, ix, cy - 56]; }
    if (st === 'smug' || st === 'meh') { clip = [ox, cy - 4, ix, cy - 2]; brow = st === 'smug' ? [ox, cy - 34, ix, cy - 26] : null; }
    if (st === 'sly') { clip = [ox, cy - 2, ix, cy + 6]; brow = [ox, cy - 22, ix, cy - 34]; }
    if (st === 'wide' || st === 'shock') brow = [ox, cy - 52, ix, cy - 58];
    const cid = `ec${id}_${side}`, rx = st === 'shock' ? 33 : st === 'wide' ? 32 : 30, ry = st === 'shock' ? 42 : st === 'wide' ? 40 : 37;
    if (st === 'happy') { out.push(`<path d="M${cx - 24} ${cy + 8} Q${cx} ${cy - 26} ${cx + 24} ${cy + 8}" stroke="#fff" stroke-width="11" fill="none" stroke-linecap="round"/>`); continue; }
    if (st === 'closed') { out.push(`<path d="M${cx - 24} ${cy - 2} Q${cx} ${cy + 22} ${cx + 24} ${cy - 2}" stroke="#fff" stroke-width="10" fill="none" stroke-linecap="round"/>`); continue; }
    if (st === 'heart') { out.push(`<path transform="translate(${cx} ${cy}) scale(2.3)" d="M0 10 C-18 -4 -10 -18 0 -8 C10 -18 18 -4 0 10Z" fill="#ff3b8a" stroke="#fff" stroke-width="2.5" style="filter:drop-shadow(0 0 6px #ff3b8a)"/>`); continue; }
    if (st === 'dollar') { out.push(`<ellipse cx="${cx}" cy="${cy}" rx="27" ry="34" fill="#fff"/><text x="${cx}" y="${cy + 17}" text-anchor="middle" font-family="RN" font-weight="900" font-size="50" fill="#18a84a">$</text>`); continue; }
    if (st === 'star') { out.push(`<path transform="translate(${cx} ${cy}) scale(1.5)" d="M0 -22 L6 -7 L22 -6 L10 4 L14 20 L0 11 L-14 20 L-10 4 L-22 -6 L-6 -7Z" fill="#ffd400" stroke="#fff" stroke-width="3" style="filter:drop-shadow(0 0 6px #ffd400)"/>`); continue; }
    if (st === 'dizzy') { out.push(`<path d="M${cx} ${cy} m0 -4 a4 4 0 1 1 -4 4 a9 9 0 1 1 9 9 a15 15 0 1 1 -15 -15 a22 22 0 1 1 22 22" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>`); continue; }
    const col = glow ? (typeof glow === 'string' ? glow : '#8fe9ff') : '#fff';
    out.push(`<defs><clipPath id="${cid}"><path d="${clip ? `M${ox - inner * 20} ${clip[1] + (clip[1] - clip[3]) * .6} L${clip[0]} ${clip[1]} L${clip[2]} ${clip[3]} L${ix + inner * 20} ${clip[3] + (clip[3] - clip[1]) * .6} L${ix + inner * 20} ${cy + 60} L${ox - inner * 20} ${cy + 60}Z` : `M${cx - 60} ${cy - 60} h120 v120 h-120Z`}"/></clipPath></defs>`);
    out.push(`<g clip-path="url(#${cid})"${glow ? ` style="filter:drop-shadow(0 0 10px ${col}) drop-shadow(0 0 22px ${col})"` : ''}><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${col}"/>`);
    if (!glow) {
      const pr = st === 'shock' ? 8 : st === 'teary' ? 17 : st === 'smug' || st === 'meh' || st === 'sly' ? 13 : 14, px = cx + lx * (rx - pr - 4), py = cy + ly * (ry - pr - 6) + (st === 'smug' || st === 'meh' || st === 'sly' ? 10 : 2);
      out.push(`<circle cx="${px}" cy="${py}" r="${pr}" fill="#0a0a0e"/><circle cx="${px - pr * .35}" cy="${py - pr * .4}" r="${Math.max(2.5, pr * .32)}" fill="#fff"/>${st === 'teary' ? `<circle cx="${px + pr * .35}" cy="${py + pr * .35}" r="3" fill="#fff"/>` : ''}`);
    }
    out.push('</g>');
    if (st === 'teary') out.push(`<path d="M${cx - 6} ${cy + 30} Q${cx - 14} ${cy + 70} ${cx - 4} ${cy + 104}" stroke="#7fd3ff" stroke-width="12" fill="none" stroke-linecap="round" opacity=".9"/>`);
    if (brow) out.push(`<path d="M${brow[0]} ${brow[1]} Q${(brow[0] + brow[2]) / 2} ${Math.min(brow[1], brow[3]) - 6} ${brow[2]} ${brow[3]}" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/>`);
  }
  return out.join('');
}

function mouth(m, look) {
  const x = look[0] * 10, y = 56 + look[1] * 4, W = '#fff', D = '#3b0b16';
  if (m === 'smile') return `<path d="M${x - 30} ${y - 8} Q${x} ${y + 20} ${x + 30} ${y - 8}" stroke="${W}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  if (m === 'grin') return `<path d="M${x - 38} ${y - 12} Q${x} ${y + 44} ${x + 38} ${y - 12}Z" fill="${W}"/><path d="M${x - 30} ${y + 2} Q${x} ${y + 10} ${x + 30} ${y + 2}" stroke="#ccc" stroke-width="3" fill="none"/>`;
  if (m === 'laugh') return `<path d="M${x - 38} ${y - 14} Q${x} ${y + 56} ${x + 38} ${y - 14}Z" fill="${D}" stroke="${W}" stroke-width="6" stroke-linejoin="round"/><ellipse cx="${x}" cy="${y + 20}" rx="16" ry="9" fill="#ff7a96"/><path d="M${x - 30} ${y - 10} L${x + 30} ${y - 10}" stroke="${W}" stroke-width="10"/>`;
  if (m === 'smirk') return `<path d="M${x - 24} ${y + 2} Q${x + 6} ${y + 12} ${x + 30} ${y - 12}" stroke="${W}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  if (m === 'frown') return `<path d="M${x - 24} ${y + 12} Q${x} ${y - 10} ${x + 24} ${y + 12}" stroke="${W}" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  if (m === 'line') return `<path d="M${x - 16} ${y + 2} L${x + 16} ${y + 2}" stroke="${W}" stroke-width="9" stroke-linecap="round"/>`;
  if (m === 'o') return `<ellipse cx="${x}" cy="${y + 4}" rx="15" ry="18" fill="${D}" stroke="${W}" stroke-width="6"/>`;
  if (m === 'scream') return `<ellipse cx="${x}" cy="${y + 12}" rx="30" ry="38" fill="${D}" stroke="${W}" stroke-width="6"/><path d="M${x - 22} ${y - 10} Q${x} ${y - 2} ${x + 22} ${y - 10}" stroke="${W}" stroke-width="9" fill="none"/><ellipse cx="${x}" cy="${y + 34}" rx="15" ry="9" fill="#ff7a96"/>`;
  if (m === 'wavy') return `<path d="M${x - 34} ${y + 4} q8.5 -12 17 0 t17 0 t17 0 t17 0" stroke="${W}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (m === 'teeth') return `<rect x="${x - 34}" y="${y - 8}" width="68" height="30" rx="10" fill="${W}"/><path d="M${x - 34} ${y + 7} H${x + 34} M${x - 17} ${y - 8} V${y + 22} M${x} ${y - 8} V${y + 22} M${x + 17} ${y - 8} V${y + 22}" stroke="#9aa" stroke-width="3"/>`;
  if (m === 'tongue') return `<path d="M${x - 28} ${y - 6} Q${x} ${y + 18} ${x + 28} ${y - 6}" stroke="${W}" stroke-width="8" fill="none" stroke-linecap="round"/><path d="M${x + 2} ${y + 4} q4 26 18 22 q10 -4 4 -26" fill="#ff7a96" stroke="${W}" stroke-width="4"/>`;
  return '';
}

export function guySvg(spec = {}) {
  const id = ++UID, L = { ...(LOOKS[spec.who || 'hero'] || LOOKS.hero), ...(spec.outfit || {}) }, top = L.top, dk = shade(top, .72), lt = shade(top, 1.18);
  const look = spec.look || [0, 0], rim = spec.rim || '#ffb648', ey = spec.eyes || 'wide', mo = spec.mouth || 'o', pose = POSES[spec.pose || 'down'] || POSES.down, fl = spec.flip ? -1 : 1;
  const arms = pose.map(a => ({ ...a, s: [a.s[0] * fl, a.s[1]], e: [a.e[0] * fl, a.e[1]], h: [a.h[0] * fl, a.h[1]], hr: (a.hr || 0) * fl }));
  const gid = `hg${id}`, hd = `hd${id}`, bd = `bd${id}`, rg = `rg${id}`;
  const defs = `<defs><radialGradient id="${gid}" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#3a3a46"/><stop offset=".55" stop-color="#121218"/><stop offset="1" stop-color="#050507"/></radialGradient>
<radialGradient id="${hd}" cx="34%" cy="28%" r="78%"><stop offset="0" stop-color="#34343f"/><stop offset=".5" stop-color="#101016"/><stop offset="1" stop-color="#000"/></radialGradient>
<linearGradient id="${bd}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${lt}"/><stop offset=".55" stop-color="${top}"/><stop offset="1" stop-color="${dk}"/></linearGradient>
<filter id="${rg}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>`;
  const sleeve = (a) => { const d = `M${a.s[0]} ${a.s[1]} Q${a.e[0]} ${a.e[1]} ${a.h[0]} ${a.h[1]}`; return `<path d="${d}" stroke="${OUT}" stroke-width="72" fill="none" stroke-linecap="round"/><path d="${d}" stroke="url(#${bd})" stroke-width="58" fill="none" stroke-linecap="round"/>`; };
  const handOf = (a) => hand(a.k || 'fist', a.h[0], a.h[1], (a.hr || 0) + (a.k === 'point' && fl < 0 ? 0 : 0), (a.hs || 1) * (spec.handScale || 1), gid);
  // туловище
  let body = '';
  if (L.hood || spec.hood) body += `<path d="M-150 40 Q-160 -150 0 -158 Q160 -150 150 40 L150 150 L-150 150Z" fill="${dk}" stroke="${OUT}" stroke-width="8"/>`;
  body += `<path d="M-158 700 L-150 220 Q-146 140 -90 126 L90 126 Q146 140 150 220 L158 700Z" fill="url(#${bd})" stroke="${OUT}" stroke-width="8" stroke-linejoin="round"/>`;
  if (L.garment === 'hoodie') body += `<path d="M-112 128 Q0 196 112 128 Q86 104 0 104 Q-86 104 -112 128Z" fill="${dk}" stroke="${OUT}" stroke-width="6"/><path d="M-30 150 Q-36 210 -40 262 M30 150 Q36 210 40 262" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/><rect x="-48" y="258" width="16" height="22" rx="5" fill="#ddd"/><rect x="32" y="258" width="16" height="22" rx="5" fill="#ddd"/><path d="M-100 470 Q0 450 100 470 L120 640 L-120 640Z" fill="${dk}" opacity=".55"/>`;
  if (L.garment === 'sweater' || L.garment === 'dress') body += `<path d="M-70 122 Q0 170 70 122" stroke="${shade(top, .6)}" stroke-width="16" fill="none" stroke-linecap="round"/>${L.garment === 'sweater' ? `<path d="M-150 600 H150" stroke="${shade(top, .8)}" stroke-width="20"/>` : ''}`;
  if (L.garment === 'tee') body += `<path d="M-60 124 Q0 158 60 124" stroke="${shade(top, .55)}" stroke-width="12" fill="none"/>`;
  if (L.garment === 'coat') body += `<path d="M-40 128 L0 260 L40 128" fill="#fff" stroke="${OUT}" stroke-width="5"/><path d="M0 260 V700" stroke="${OUT}" stroke-width="5"/>`;
  // волосы за головой
  let hairB = '', hairF = '';
  if (L.hair === 'long') { hairB = `<path d="M-118 -10 Q-140 -140 0 -130 Q140 -140 118 -10 Q150 120 128 230 Q60 250 0 200 Q-60 250 -128 230 Q-150 120 -118 -10Z" fill="${L.hairCol}" stroke="${OUT}" stroke-width="7"/>`;
    hairF = `<path d="M-98 -36 Q-90 -108 0 -112 Q92 -108 100 -36 Q60 -78 18 -62 Q-30 -92 -98 -36Z" fill="${L.hairCol}" stroke="${OUT}" stroke-width="6"/><path d="M-60 -92 Q-20 -104 20 -96" stroke="${shade(L.hairCol, 1.5)}" stroke-width="7" fill="none" stroke-linecap="round" opacity=".7"/>`; }
  if (L.hair === 'bun') hairF = `<circle cx="0" cy="-118" r="38" fill="${L.hairCol}" stroke="${OUT}" stroke-width="6"/><path d="M-96 -40 Q-80 -106 0 -106 Q80 -106 96 -40 Q40 -76 0 -70 Q-40 -76 -96 -40Z" fill="${L.hairCol}" stroke="${OUT}" stroke-width="6"/>`;
  if (L.hair === 'spiky') hairF = `<path d="M-90 -50 L-96 -110 L-56 -84 L-40 -134 L-10 -94 L14 -140 L34 -92 L68 -126 L70 -80 L104 -96 L92 -44 Q0 -84 -90 -50Z" fill="#3a2414" stroke="${OUT}" stroke-width="6" stroke-linejoin="round"/>`;
  if (L.hat === 'cap') hairF += `<path d="M-100 -30 Q-96 -112 0 -114 Q96 -112 100 -30Z" fill="${L.hatCol}" stroke="${OUT}" stroke-width="6"/><path d="M40 -40 Q140 -48 176 -24 Q120 -14 40 -22Z" fill="${shade(L.hatCol, .7)}" stroke="${OUT}" stroke-width="6"/>`;
  if (L.bow) hairF += `<g transform="translate(70 -96) rotate(20)"><path d="M0 0 L-34 -22 L-34 22Z M0 0 L34 -22 L34 22Z" fill="${L.bow}" stroke="${OUT}" stroke-width="5" stroke-linejoin="round"/><circle r="10" fill="${shade(L.bow, .75)}" stroke="${OUT}" stroke-width="4"/></g>`;
  // голова
  const skin = L.skin || `url(#${hd})`;
  const head = `<circle r="104" fill="${OUT}"/><circle r="100" fill="${skin}"/>
<path d="M-74 -60 A96 96 0 0 1 40 -94" stroke="rgba(255,255,255,.22)" stroke-width="10" fill="none" stroke-linecap="round"/>
<path d="M78 -66 A102 102 0 0 1 88 58" stroke="${rim}" stroke-width="9" fill="none" stroke-linecap="round" filter="url(#${rg})" opacity=".9"/><path d="M80 -62 A101 101 0 0 1 90 50" stroke="${rim}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  const face = eyes(ey, look, id, spec.glow || (ey === 'glow' ? (spec.glowCol || '#8fe9ff') : null)) + mouth(mo, look)
    + (spec.blush ? `<ellipse cx="-62" cy="34" rx="18" ry="10" fill="#ff5a8a" opacity=".45"/><ellipse cx="62" cy="34" rx="18" ry="10" fill="#ff5a8a" opacity=".45"/>` : '')
    + (L.glasses ? `<circle cx="${-40 + look[0] * 10}" cy="-2" r="40" fill="none" stroke="#e8e8e8" stroke-width="7"/><circle cx="${40 + look[0] * 10}" cy="-2" r="40" fill="none" stroke="#e8e8e8" stroke-width="7"/><path d="M${look[0] * 10 - 2} -4 h4" stroke="#e8e8e8" stroke-width="7"/>` : '')
    + (spec.sweat ? `<path d="M${fl * 84} -86 q14 22 0 34 q-14 -12 0 -34Z" fill="#9fdcff" stroke="#fff" stroke-width="3"/>` : '');
  const back = arms.filter(a => !a.f), front = arms.filter(a => a.f);
  const ht = spec.headTilt || 0;
  return `${defs}<g transform="rotate(${spec.tilt || 0} 0 300)">${back.map(sleeve).join('')}${back.map(handOf).join('')}${hairB}${body}<g transform="rotate(${ht} 0 100)">${head}${face}${hairF}</g>${front.map(sleeve).join('')}${front.map(handOf).join('')}</g>`;
}

// SVG-элемент для HTML-обложки: x,y — центр головы в px, r — радиус головы в px
export function guyTag(spec, { x, y, r, z = 3, blur = 0, glow } = {}) {
  const k = r / 100, W = 900 * k, H = 1100 * k;
  return `<svg class=guy viewBox="-450 -300 900 1100" style="position:absolute;left:${x - W / 2}px;top:${y - 300 * k}px;width:${W}px;height:${H}px;z-index:${z};overflow:visible;filter:drop-shadow(0 0 2px rgba(255,255,255,.75)) drop-shadow(0 0 18px ${glow || spec.rim || '#ffb648'}88) drop-shadow(0 26px 30px rgba(0,0,0,.55))${blur ? ` blur(${blur}px)` : ''}">${guySvg(spec)}</svg>`;
}
