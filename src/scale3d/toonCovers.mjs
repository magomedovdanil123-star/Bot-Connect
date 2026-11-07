// Обложки формата «стикмены» (COINORA «Что если…», Рентген привычек) — v2: каждая обложка придумана под тему.
// Слои: фон (локация из ролика или своя, лёгкое размытие) → эффекты (молнии, блёстки, скорость, сердечки…) → герой(и) крупно (прозрачный PNG, можно повернуть/увеличить)
// → предмет-символ (шкала, телефон, часы, штамп, табло, фото, записка, неон над головой) → надпись (позиция и шрифт меняются).
// Спецификация обложки (ep.covers[i] или DESIGNS из coverDesigns.mjs):
// { beat, text, sub?, loc?, time?, season?, o?, layout: 'right'|'left'|'center'|'duo', act, eyes?, mouth?, hold?, outfit?: {…костюм героя},
//   who?: 'hero'|'friend'|…, rot?, scale?, dx?, dy?, duo?: { who, act, eyes, mouth, …костюм }, fx?: ['lightning','sparkles','speed','hearts','glitch','zzz','fire','snow','rays','stars','bubbles','smoke'],
//   prop?: { kind: 'gauge'|'phone'|'clock'|'stamp'|'counter'|'tag'|'photo'|'note'|'big'|'remote'|'bolt', text, value?, x?, y?, rot?, color? },
//   pos?: 'tl'|'tr'|'bl'|'br'|'tc'|'bc', font?: 'rubik'|'russo'|'oswald'|'mont', tcol?: '#hex', tcol2?: '#hex', pal?, blur?, dark?, crowd?, arrow? }
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pageHtml } from './render.mjs';
import { guyTag } from './coverGuy.mjs';
import { chromium } from '../books/render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), JF = path.join(DIR, '..', 'jung', 'engine', 'fonts'), SF = path.join(DIR, 'fonts');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ff = (fam, file, w = 400, style = 'normal') => [['cyrillic', 'U+0400-045F,U+2116'], ['latin', 'U+0000-00FF,U+2000-206F,U+20BD,U+2248']].map(([sub, r]) => `@font-face{font-family:${fam};font-weight:${w};font-style:${style};src:url("file://${file(sub)}");unicode-range:${r}}`).join('');
const FONTS = ff('M', s => path.join(JF, `montserrat-${s}-900-normal.woff2`), 900) + ff('I', s => path.join(JF, `inter-${s}-800-normal.woff2`), 800) + ff('C', s => path.join(JF, `caveat-${s}-700-normal.woff2`), 700)
  + ff('R', s => path.join(SF, `rubik-${s}-900-italic.woff2`), 900, 'italic') + ff('RN', s => path.join(SF, `rubik-${s}-900-normal.woff2`), 900) + ff('O', s => path.join(SF, `oswald-${s}-700-normal.woff2`), 700) + ff('U', s => path.join(SF, `russo-one-${s}-400-normal.woff2`), 400);
const FAM = { rubik: "R", rubikn: 'RN', russo: 'U', oswald: 'O', mont: 'M' };
const GROUND = { mall: 960, vault: 930, pier: 920, secroom: 940, zoo: 990, stadium: 1000, cinema: 1000, playground: 980, game: 940, sky: 980, bathroom: 930, school: 960, elevator: 940, underground: 960, retro: 960, beach: 980, paper: 960, gas: 990, street: 1010, bedroom: 960, kitchen: 950, office: 950, rooftop: 940, shop: 975, park: 990, lab: 965, living: 960, hospital: 965, space: 930, tvstudio: 960 };

// контрастные пары цветового круга
export const WHEEL = [
  { wash: '#1f4dff', text: '#ffa21a', plate: '#ff5a1f', ray: 'rgba(255,170,40,.30)' },
  { wash: '#8e24d9', text: '#ffe21a', plate: '#ff2d8a', ray: 'rgba(255,230,60,.30)' },
  { wash: '#ff2d9a', text: '#8cff2e', plate: '#7a1fd1', ray: 'rgba(160,255,80,.28)' },
  { wash: '#ff6a00', text: '#2ed3ff', plate: '#1f4dff', ray: 'rgba(60,210,255,.30)' },
  { wash: '#e8202a', text: '#2effd0', plate: '#14161c', ray: 'rgba(60,255,210,.28)' },
  { wash: '#12a84a', text: '#ff3ba0', plate: '#ffd400', ray: 'rgba(255,80,170,.28)' },
];

function layers(ep, c) {
  const src = ep.beats[c.beat]?.scene || {}, loc = c.loc || (src.loc === 'info' ? 'street' : src.loc) || 'street', lay = c.layout || 'right', right = lay !== 'left';
  const extras = c.noExtras ? [] : (src.cast || []).filter(x => x.who !== 'hero' && x.who !== c.duo?.who).slice(0, c.crowd ? 4 : 2).map((x, i) => ({ who: x.who, act: x.act || 'idle', face: x.face, top: x.top, garment: x.garment, hair: x.hair, hairCol: x.hairCol, x: right ? 300 + i * (c.crowd ? 250 : 330) : 1620 - i * (c.crowd ? 250 : 330), s: c.crowd ? 1.05 : 1.2, dir: right ? 1 : -1, gloss: true }));
  const bg = { loc, time: c.time || src.time, season: c.season || src.season, weather: c.weather || null, o: { ...(src.o || {}), ...(c.o || {}), hud: false }, cast: lay === 'duo' || lay === 'center' ? [] : extras, props: [...(src.props || []).filter(p => ['car', 'animal', 'cctv', 'monitor'].includes(p.kind)), ...(c.bg || [])], cam: [[0, 960, 560, 1.12], [1, 960, 560, 1.12]] };
  const srcHero = (src.cast || []).find(x => x.who === (c.who || 'hero')) || {};
  const face = c.eyes || c.mouth ? { eyes: c.eyes || 'open', mouth: c.mouth || 'o' } : undefined;
  const hx = lay === 'center' ? 960 : lay === 'duo' ? 1380 : right ? 1420 : 500, hs = lay === 'center' ? 3.7 : lay === 'duo' ? 3.0 : 3.35, hy = lay === 'center' ? 1500 : lay === 'duo' ? 1330 : 1420;
  const hero = { ...srcHero, who: c.who || 'hero', ...(c.outfit || {}), act: c.act || c.face || 'shock', face, x: hx, y: hy, s: hs, dir: lay === 'center' ? 1 : right ? -1 : 1, walk: null, tag: null, float: null, ghost: null, acts: null, hold: c.hold || null, gloss: true, sweat: c.sweat, glowCol: c.glowCol };
  const cast = [hero];
  if (lay === 'duo' && c.duo) { const d = c.duo; cast.unshift({ who: d.who || 'girl', ...d, face: d.eyes || d.mouth ? { eyes: d.eyes || 'open', mouth: d.mouth || 'smile' } : undefined, x: 560, y: 1330, s: d.s || 3.0, dir: 1, gloss: true, walk: null, tag: null, acts: null }); }
  return [bg, { loc: 'none', cast, cam: 'still' }];
}


// крупный план (v3): персонаж-«бюст» из coverGuy.mjs — голова и плечи, руки у лица; второй план — c.duo / c.cast2
const GUY_KEYS = ['who', 'pose', 'eyes', 'mouth', 'look', 'tilt', 'headTilt', 'rim', 'outfit', 'sweat', 'blush', 'glowCol', 'flip', 'hood', 'handScale'];
const pick = (o) => Object.fromEntries(GUY_KEYS.filter(k => o[k] !== undefined).map(k => [k, o[k]]));
function bust(c, lay, down = 0) {
  const def = { right: [930, 345, 182], left: [350, 345, 182], center: [640, 390, 170], duo: [965, 360, 168] }[lay] || [930, 345, 182];
  let h = guyTag(pick(c), { x: c.gx ?? def[0], y: c.gy ?? def[1] + down, r: c.gr ?? def[2], z: 3, glow: c.glowCol });
  const second = [...(c.duo && lay === 'duo' ? [{ x: 320, y: 400 + down, r: 140, ...c.duo }] : []), ...(c.cast2 || [])];
  for (const d of second) h += guyTag({ rim: c.rim, ...pick(d) }, { x: d.x, y: d.y, r: d.r || 120, z: d.z ?? 2, blur: d.blur || 0, glow: d.glowCol });
  return h;
}

// ---------- эффекты и предметы (HTML/SVG поверх) ----------
const rnd = (k) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
function fxHtml(list, P, side) {
  let h = '';
  for (const f of list) {
    if (f === 'lightning') h += `<svg class=full viewBox="0 0 1280 720">${[0, 1, 2, 3].map(k => { const x0 = 560 + k * 160 + rnd(k) * 60, pts = [[x0, -20]]; for (let j = 1; j < 9; j++) pts.push([x0 + (rnd(k * 9 + j) - .5) * 160, j * 95]); const d = 'M' + pts.map(p => p.join(' ')).join(' L'); return `<path d="${d}" stroke="#7fe3ff" stroke-width="16" fill="none" opacity=".45" filter="url(#gl)"/><path d="${d}" stroke="#fff" stroke-width="5" fill="none" filter="url(#gl)"/>`; }).join('')}<defs><filter id=gl><feGaussianBlur stdDeviation="6" result=b /><feMerge><feMergeNode in=b /><feMergeNode in=SourceGraphic /></feMerge></filter></defs></svg>`;
    if (f === 'sparkles') h += `<svg class=full viewBox="0 0 1280 720">${[...Array(26)].map((_, k) => { const x = (side === 'left' ? 120 : 520) + rnd(k) * 680, y = 60 + rnd(k + 40) * 600, s = 8 + rnd(k + 80) * 22; return `<path d="M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s}Z" fill="${k % 3 ? '#ffe46b' : '#fff'}" style="filter:drop-shadow(0 0 8px #ffd400)"/>`; }).join('')}</svg>`;
    if (f === 'speed') h += `<svg class=full viewBox="0 0 1280 720">${[...Array(34)].map((_, k) => { const a = rnd(k) * Math.PI * 2, r0 = 330 + rnd(k + 5) * 120; return `<line x1="${640 + Math.cos(a) * r0}" y1="${360 + Math.sin(a) * r0}" x2="${640 + Math.cos(a) * 900}" y2="${360 + Math.sin(a) * 900}" stroke="rgba(255,255,255,.75)" stroke-width="${3 + rnd(k + 9) * 7}"/>`; }).join('')}</svg>`;
    if (f === 'hearts') h += `<svg class=full viewBox="0 0 1280 720">${[...Array(12)].map((_, k) => { const x = 80 + rnd(k) * 1100, y = 60 + rnd(k + 3) * 580, s = 16 + rnd(k + 6) * 26; return `<path transform="translate(${x} ${y}) scale(${s / 20})" d="M0 8 C-14 -4 -8 -16 0 -8 C8 -16 14 -4 0 8Z" fill="#ff3b8a" stroke="#fff" stroke-width="2" style="filter:drop-shadow(0 0 8px #ff3b8a)"/>`; }).join('')}</svg>`;
    if (f === 'zzz') h += `<div class=zzz>Z<span>Z</span><i>Z</i></div>`;
    if (f === 'fire') h += `<div class=fire></div>`;
    if (f === 'glitch') h += `<div class=glitch>${[...Array(8)].map((_, k) => `<i style="top:${rnd(k) * 680}px;height:${8 + rnd(k + 2) * 30}px;background:${['rgba(255,0,90,.35)', 'rgba(0,220,255,.35)'][k % 2]};left:${(rnd(k + 5) - .5) * 60}px"></i>`).join('')}</div>`;
    if (f === 'snow') h += `<svg class=full viewBox="0 0 1280 720">${[...Array(60)].map((_, k) => `<circle cx="${rnd(k) * 1280}" cy="${rnd(k + 9) * 720}" r="${2 + rnd(k + 3) * 5}" fill="#fff" opacity=".9"/>`).join('')}</svg>`;
    if (f === 'stars') h += `<svg class=full viewBox="0 0 1280 720">${[...Array(40)].map((_, k) => `<circle cx="${rnd(k) * 1280}" cy="${rnd(k + 9) * 400}" r="${1 + rnd(k + 3) * 3}" fill="#fff" opacity="${.5 + rnd(k) * .5}"/>`).join('')}</svg>`;
    if (f === 'bubbles') h += `<svg class=full viewBox="0 0 1280 720">${[...Array(18)].map((_, k) => `<circle cx="${rnd(k) * 1280}" cy="${rnd(k + 9) * 720}" r="${10 + rnd(k + 3) * 30}" fill="rgba(160,230,255,.25)" stroke="#fff" stroke-width="3"/>`).join('')}</svg>`;
    if (f === 'smoke') h += `<div class=smoke>${[...Array(7)].map((_, k) => `<i style="left:${300 + rnd(k) * 700}px;top:${200 + rnd(k + 4) * 380}px;width:${180 + rnd(k + 2) * 200}px;height:${120 + rnd(k + 7) * 120}px"></i>`).join('')}</div>`;
  }
  return h;
}
function propHtml(p, P) {
  if (!p) return '';
  const st = `left:${p.x ?? 640}px;top:${p.y ?? 360}px;transform:translate(-50%,-50%) rotate(${p.rot ?? 0}deg) scale(${p.s ?? 1})`, col = p.color || P.text;
  if (p.kind === 'gauge') { const v = Math.max(0, Math.min(1.15, p.value ?? 1)), a = -180 + v * 180;
    return `<div class=prop style="${st}"><svg width="420" height="250" viewBox="-210 -210 420 250"><path d="M-180 0 A180 180 0 0 1 180 0" fill="#fff" stroke="#000" stroke-width="10"/>${[['#3ccf4e', -180, -120], ['#ffd400', -120, -60], ['#ff3b3b', -60, 0]].map(([c, a0, a1]) => { const r = 150, p0 = [Math.cos(a0 * Math.PI / 180) * r, Math.sin(a0 * Math.PI / 180) * r], p1 = [Math.cos(a1 * Math.PI / 180) * r, Math.sin(a1 * Math.PI / 180) * r]; return `<path d="M${p0} A${r} ${r} 0 0 1 ${p1}" stroke="${c}" stroke-width="36" fill="none"/>`; }).join('')}<text x="0" y="-60" text-anchor="middle" font-family="RN" font-weight="900" font-size="54">${esc(p.text || '')}</text><line x1="0" y1="0" x2="${Math.cos(a * Math.PI / 180) * 170}" y2="${Math.sin(a * Math.PI / 180) * 170}" stroke="#e8202a" stroke-width="12" stroke-linecap="round"/><circle r="22" fill="#222"/>${v > 1 ? '<path d="M150 -60 l40 -30 M160 -40 l50 -10 M150 -80 l20 -45" stroke="#e8202a" stroke-width="6"/>' : ''}</svg></div>`; }
  if (p.kind === 'phone') return `<div class="prop phone" style="${st}"><div class=scr style="background:${p.screen || 'linear-gradient(160deg,#2f8cff,#9b6bff)'}"><b>${esc(p.text || '')}</b>${p.sub ? `<small>${esc(p.sub)}</small>` : ''}</div></div>`;
  if (p.kind === 'clock') return `<div class="prop clock" style="${st}"><b>${esc(p.text || '03:00')}</b></div>`;
  if (p.kind === 'stamp') return `<div class="prop stamp" style="${st};color:${p.color || '#e8202a'};border-color:${p.color || '#e8202a'}">${esc(p.text)}</div>`;
  if (p.kind === 'counter') return `<div class="prop counter" style="${st};color:${p.color || '#ff3b3b'}">${esc(p.text)}</div>`;
  if (p.kind === 'tag') return `<div class="prop tagn" style="${st};color:${col};border-color:${col};box-shadow:0 0 26px ${col},inset 0 0 18px ${col}55">${esc(p.text)}</div>`;
  if (p.kind === 'photo') return `<div class="prop photo" style="${st}"><div style="background:${p.bg || 'linear-gradient(#b89a6a,#8a6e45)'}"></div><span>${esc(p.text || '')}</span></div>`;
  if (p.kind === 'note') return `<div class="prop note" style="${st}">${esc(p.text)}</div>`;
  if (p.kind === 'big') return `<div class="prop bigt" style="${st};color:${col}">${esc(p.text)}</div>`;
  if (p.kind === 'remote') return `<div class="prop remote" style="${st}"><i style="background:#ff3b3b"></i><b>⏸</b><b>◀◀</b><b>▶▶</b></div>`;
  return '';
}

export async function toonCovers(ep, outDir, { w = 1280, h = 720 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  let specs = ep.covers || [];
  try { const D = (await import('./coverDesigns.mjs')).DESIGNS; if (D[ep.n]) specs = D[ep.n]; } catch { /* нет дизайнов — берём из сценария */ }
  const beats = specs.flatMap(c => layers(ep, c).map(scene => ({ text: '', voice: null, scene })));
  const PH = beats.map((_, i) => ({ s: i * 4 + .3, d: 3.5 })), END = beats.length * 4 + 1, W2 = w * 2, H2 = h * 2;
  const page = path.join(outDir, 'covers_page.html'); fs.writeFileSync(page, pageHtml({ ...ep, beats }, { PH, END, caps: [] }, { w: W2, h: H2 }));
  const br = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] }), out = [];
  try {
    const p = await br.newPage({ viewport: { width: w, height: h } });
    await p.goto('file://' + page); await p.waitForFunction(() => window.READY === true, null, { timeout: 60000 }); await p.evaluate(() => { window.NOHUD = true; });
    const frames = [];
    for (let i = 0; i < beats.length; i++) { const png = i % 2 === 1;
      const url = await p.evaluate(([f, png]) => { window.NOVIG = png; window.renderAt(f / 24); return document.getElementById('out').toDataURL(png ? 'image/png' : 'image/jpeg', .95); }, [Math.round((PH[i].s + 1.4) * 24), png]);
      const f = path.join(outDir, `cover_l${i}.${png ? 'png' : 'jpg'}`); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); frames.push(f); }
    for (const [i, c] of specs.entries()) {
      const P = WHEEL[c.pal ?? ((ep.n || 0) + i) % WHEEL.length], lay = c.layout || 'right', side = lay === 'left' ? 'left' : 'right';
      let pos = c.pos || (lay === 'left' ? 'tr' : lay === 'duo' ? (c.pose ? 'tc' : 'bc') : lay === 'center' ? 'tc' : 'tl'); if (c.pose && pos === 'bc') pos = 'tc';   /* крупный план: надпись не на лице */
      const fam = FAM[c.font || 'rubik'], tcol = c.tcol || P.text, tcol2 = c.tcol2 || '#ffffff';
      const words = String(c.text).split(' '), lines = c.lines || (words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : words.length === 2 && c.text.length > 10 ? words : [c.text]);
      const maxW = pos === 'tc' || pos === 'bc' ? w * .9 : w * .55, maxH = h * (pos === 'tc' || pos === 'bc' ? (c.pose ? .27 : .34) : .5);
      const tPos = { tl: 'left:34px;top:40px;align-items:flex-start', tr: 'right:34px;top:40px;align-items:flex-end', bl: 'left:34px;bottom:40px;align-items:flex-start', br: 'right:34px;bottom:40px;align-items:flex-end', tc: 'left:0;right:0;top:26px;align-items:center', bc: 'left:0;right:0;bottom:26px;align-items:center' }[pos];
      const rotT = pos === 'tc' || pos === 'bc' ? -2 : pos[1] === 'l' ? -4 : 4, heroT = `transform:translate(${c.dx || 0}px,${c.dy ?? (lay === 'center' && pos[0] === 't' ? 120 : 0)}px) rotate(${c.rot || 0}deg) scale(${c.scale || 1});transform-origin:${lay === 'left' ? '30%' : lay === 'center' || lay === 'duo' ? '50%' : '72%'} 45%`;
      const blur = c.blur ?? 2.5, fx = c.fx || ['rays'];
      const html = `<!doctype html><meta charset=utf-8><style>${FONTS}*{margin:0;box-sizing:border-box}body{width:${w}px;height:${h}px;overflow:hidden;background:#000;font-family:M;position:relative}
.full{position:absolute;inset:0;width:100%;height:100%}
#bg{position:absolute;inset:-14px;background:url("file://${frames[i * 2]}") center/cover;filter:blur(${blur}px) saturate(1.6) contrast(1.12) brightness(${1.06 - (c.dark || 0)})}
#gold{position:absolute;inset:0;background:linear-gradient(${side === 'right' ? 215 : 145}deg,rgba(255,190,90,.45) 0,rgba(255,140,60,.12) 40%,rgba(60,30,120,.3) 100%);mix-blend-mode:overlay}
#tint{position:absolute;inset:0;background:${P.wash};mix-blend-mode:soft-light;opacity:.3}
#wash{position:absolute;inset:0;background:radial-gradient(ellipse 70% 60% at ${pos[1] === 'r' ? '100%' : pos[1] === 'c' ? '50%' : '0%'} ${pos[0] === 'b' ? '100%' : '0%'},${P.wash}d0 0,${P.wash}80 45%,${P.wash}00 100%)}
#burst{position:absolute;left:${lay === 'center' ? '50%' : lay === 'left' ? '25%' : '72%'};top:42%;width:1100px;height:1100px;transform:translate(-50%,-50%);background:repeating-conic-gradient(${P.ray} 0 6deg,rgba(255,255,255,0) 6deg 18deg);-webkit-mask-image:radial-gradient(circle,#000 18%,transparent 62%);mix-blend-mode:screen}
#hero{position:absolute;inset:0;background:url("file://${frames[i * 2 + 1]}") center/cover;filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 22px 26px rgba(0,0,0,.55));${heroT}}
#shade{position:absolute;inset:0;background:linear-gradient(200deg,rgba(255,236,200,.45) 0,rgba(255,255,255,0) 38%,rgba(20,10,60,.38) 100%);mix-blend-mode:overlay;-webkit-mask:url("file://${frames[i * 2 + 1]}") center/cover;${heroT}}
#vg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 40%,rgba(0,0,0,.42) 100%)}
#t{position:absolute;${tPos};display:flex;flex-direction:column;transform:rotate(${rotT}deg);z-index:5}
.l{white-space:nowrap;font-family:${fam};font-weight:${fam === 'U' ? 400 : 900};${fam === 'R' ? 'font-style:italic;' : ''}line-height:${fam === 'O' ? 1 : .95};color:${tcol};-webkit-text-stroke:${fam === 'O' ? 10 : 13}px #000;paint-order:stroke fill;text-shadow:0 9px 0 #000,0 16px 26px rgba(0,0,0,.55);letter-spacing:${fam === 'O' ? '1px' : '-1px'};${fam === 'O' ? 'text-transform:uppercase;' : ''}}
.l.w{color:${tcol2}}.sub{margin-top:12px;font:800 34px I;color:#fff;background:${P.plate};padding:5px 16px 8px;border-radius:12px;border:4px solid #000;transform:rotate(-2deg)}
.prop{position:absolute;z-index:4}
.phone{width:250px;height:440px;border-radius:38px;background:#14161c;border:6px solid #000;padding:14px;box-shadow:0 20px 40px rgba(0,0,0,.6)}.phone .scr{width:100%;height:100%;border-radius:26px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:14px}.phone b{font:900 46px RN;color:#fff;-webkit-text-stroke:6px #000;paint-order:stroke fill;line-height:1}.phone small{font:800 22px I;color:#fff;margin-top:10px}
.clock{width:300px;height:300px;border-radius:50%;background:#fff;border:12px solid #e8202a;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 8px #000,0 20px 40px rgba(0,0,0,.5)}.clock b{font:900 74px RN;color:#14161c}
.stamp{font:900 96px RN;white-space:nowrap;border:10px solid;border-radius:16px;padding:4px 26px;background:rgba(255,255,255,.12);text-shadow:0 0 2px #000;letter-spacing:2px}
.counter{font:400 92px U;white-space:nowrap;background:#0b0d14;border:8px solid #000;border-radius:18px;padding:6px 30px;text-shadow:0 0 18px currentColor;box-shadow:0 14px 30px rgba(0,0,0,.6)}
.tagn{font:900 64px RN;white-space:nowrap;background:rgba(12,14,22,.92);border:6px solid;border-radius:18px;padding:4px 26px}
.photo{background:#fbfbf6;padding:16px 16px 54px;box-shadow:0 16px 34px rgba(0,0,0,.55)}.photo div{width:300px;height:220px}.photo span{position:absolute;left:0;right:0;bottom:12px;text-align:center;font:700 34px C;color:#333}
.note{font:700 54px C;color:#1d2230;background:#fff6a8;padding:22px 30px;box-shadow:0 14px 30px rgba(0,0,0,.45);max-width:520px;line-height:1.05}
.bigt{font:900 210px RN;-webkit-text-stroke:16px #000;paint-order:stroke fill;text-shadow:0 14px 0 #000,0 0 40px currentColor}
.remote{width:150px;height:360px;background:#1d2230;border:6px solid #000;border-radius:40px;display:flex;flex-direction:column;align-items:center;gap:18px;padding-top:30px}.remote i{width:56px;height:56px;border-radius:50%;border:4px solid #000}.remote b{font:900 40px RN;color:#8fd3ff}
.zzz{position:absolute;right:120px;top:60px;font:900 120px RN;color:#bfe9ff;-webkit-text-stroke:8px #000;paint-order:stroke fill;transform:rotate(-12deg)}.zzz span{font-size:90px;margin-left:10px}.zzz i{font-size:64px;font-style:normal}
.fire{position:absolute;left:0;right:0;bottom:0;height:60%;background:radial-gradient(ellipse at 50% 120%,rgba(255,120,0,.85),rgba(255,40,0,.35) 40%,rgba(0,0,0,0) 70%);mix-blend-mode:screen}
.glitch i{position:absolute;width:110%;mix-blend-mode:screen}
.smoke i{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(230,235,245,.7),rgba(230,235,245,0) 70%)}
#arrow{position:absolute;left:${c.arrowX ?? (side === 'right' ? 43 : 50)}%;top:${c.arrowY ?? 48}%;width:200px;height:120px;transform:rotate(${c.arrowRot ?? (side === 'right' ? 18 : 162)}deg);z-index:6}
</style>
<div id=bg></div><div id=gold></div><div id=tint></div><div id=wash></div>${fx.includes('rays') ? '<div id=burst></div>' : ''}${fxHtml(fx.filter(f => !['rays', 'fire', 'glitch'].includes(f)), P, side)}${fx.includes('fire') ? fxHtml(['fire'], P, side) : ''}
${c.pose ? bust(c, lay, pos[0] === 't' && (lay === 'center' || lay === 'duo') ? 80 : 0) : '<div id=hero></div><div id=shade></div>'}${fx.includes('glitch') ? fxHtml(['glitch'], P, side) : ''}<div id=vg></div>${propHtml(c.prop, P)}${(c.props || []).map(q => propHtml(q, P)).join('')}
<div id=t>${lines.map((s, k) => `<div class="l${k && lines.length > 1 && !/\d/.test(s) ? ' w' : ''}">${esc(s)}</div>`).join('')}${c.sub ? `<div class=sub>${esc(c.sub)}</div>` : ''}</div>
${c.arrow ? `<svg id=arrow viewBox="0 0 200 120"><path d="M8 60 Q 90 10 150 52" fill="none" stroke="#000" stroke-width="30" stroke-linecap="round"/><path d="M8 60 Q 90 10 150 52" fill="none" stroke="${c.arrowCol || '#ff2d4a'}" stroke-width="18" stroke-linecap="round"/><path d="M128 20 L192 66 L118 90 Z" fill="${c.arrowCol || '#ff2d4a'}" stroke="#000" stroke-width="8" stroke-linejoin="round"/></svg>` : ''}
<script>document.fonts.ready.then(()=>{const L=[...document.querySelectorAll('.l')];let px=${c.size || 160};const f=()=>L.forEach(d=>d.style.fontSize=px+'px');f();while(px>50&&(L.some(d=>d.offsetWidth>${Math.round(maxW)})||L.reduce((s,d)=>s+d.offsetHeight,0)>${Math.round(maxH)})){px-=4;f();}document.title='ready'})</script>`;
      const hf = path.join(outDir, `cover${i}.html`); fs.writeFileSync(hf, html); await p.goto('file://' + hf); await p.waitForFunction(() => document.title === 'ready');
      const f = path.join(outDir, `cover_${i + 1}.jpg`); await p.screenshot({ path: f, type: 'jpeg', quality: 92 }); out.push(f); fs.rmSync(hf);
    }
    frames.forEach(f => fs.rmSync(f, { force: true })); fs.rmSync(page, { force: true });
  } finally { await br.close().catch(() => {}); }
  return out;
}
