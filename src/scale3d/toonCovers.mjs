// Обложки формата «стикмены» (COINORA «Что если…»): крупное лицо героя с яркой эмоцией на сочном фоне локации,
// огромная жёлтая надпись с толстой чёрной обводкой под наклоном, красная стрелка, восклицательные знаки.
// ep.covers: [{ beat, text: '1–3 СЛОВА', sub?, face: 'shock'|'fear'|'joy'|'sad'|'think'|'laugh', loc?, time?, season?, arrow?: true, side?: 'left'|'right', o? }]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pageHtml } from './render.mjs';
import { chromium } from '../books/render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), FONTS = path.join(DIR, '..', 'jung', 'engine', 'fonts');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const font = (fam, w, b) => [['cyrillic', 'U+0400-045F,U+2116'], ['latin', 'U+0000-00FF,U+2000-206F,U+20BD,U+2248']].map(([sub, r]) => `@font-face{font-family:${fam};font-weight:${w};src:url("file://${path.join(FONTS, `${b}-${sub}-${w}-normal.woff2`)}");unicode-range:${r}}`).join('');
const GROUND = { school: 960, elevator: 940, underground: 960, retro: 960, beach: 980, paper: 960, gas: 990, street: 1010, bedroom: 960, kitchen: 950, office: 950, rooftop: 940, shop: 975, park: 990, lab: 965, living: 960, hospital: 965, space: 930, tvstudio: 960 };

// два слоя: фон (локация + второстепенные герои, потом размытие «глубина резкости») и герой огромным планом (прозрачный PNG, блики, румянец, капли пота)
function coverLayers(ep, c) {
  const src = ep.beats[c.beat]?.scene || {}, loc = c.loc || (src.loc === 'info' ? 'street' : src.loc) || 'street', g = GROUND[loc] ?? 990, right = c.side !== 'left';
  const extras = (src.cast || []).filter(x => x.who !== 'hero').slice(0, c.crowd ? 4 : 2).map((x, i) => ({ who: x.who, act: x.act || 'idle', face: x.face, x: right ? 300 + i * (c.crowd ? 250 : 330) : 1620 - i * (c.crowd ? 250 : 330), s: c.crowd ? 1.05 : 1.2, dir: right ? 1 : -1, gloss: true }));
  const bg = { loc, time: c.time || src.time, season: c.season || src.season, weather: null, o: { ...(src.o || {}), ...(c.o || {}) }, cast: extras, props: (src.props || []).filter(p => p.kind === 'car'), cam: [[0, 960, 560, 1.12], [1, 960, 560, 1.12]] };
  const hero = { ...(src.cast || []).find(x => x.who === 'hero'), who: 'hero', act: c.face || 'shock', x: right ? 1420 : 500, y: 1420, s: 3.35, dir: right ? -1 : 1, walk: null, tag: null, float: null, ghost: null, acts: null, hold: c.hold || null, gloss: true, sweat: c.sweat };
  return [bg, { loc: 'none', cast: [hero], cam: 'still' }];
}

// контрастные пары цветового круга: фон-подсветка ↔ цвет надписи (у каждой из 3 обложек своя пара)
export const WHEEL = [
  { name: 'синий ↔ оранжевый', wash: '#1f4dff', text: '#ffa21a', plate: '#ff5a1f', ray: 'rgba(255,170,40,.30)' },
  { name: 'фиолетовый ↔ жёлтый', wash: '#8e24d9', text: '#ffe21a', plate: '#ff2d8a', ray: 'rgba(255,230,60,.30)' },
  { name: 'розовый ↔ зелёный', wash: '#ff2d9a', text: '#8cff2e', plate: '#7a1fd1', ray: 'rgba(160,255,80,.28)' },
  { name: 'оранжевый ↔ голубой', wash: '#ff6a00', text: '#2ed3ff', plate: '#1f4dff', ray: 'rgba(60,210,255,.30)' },
  { name: 'красный ↔ бирюзовый', wash: '#e8202a', text: '#2effd0', plate: '#14161c', ray: 'rgba(60,255,210,.28)' },
  { name: 'зелёный ↔ малиновый', wash: '#12a84a', text: '#ff3ba0', plate: '#ffd400', ray: 'rgba(255,80,170,.28)' },
];
export async function toonCovers(ep, outDir, { w = 1280, h = 720 } = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const specs = ep.covers || [], beats = specs.flatMap(c => coverLayers(ep, c).map(scene => ({ text: '', voice: null, scene })));
  const PH = beats.map((_, i) => ({ s: i * 4 + .3, d: 3.5 })), END = beats.length * 4 + 1, W2 = w * 2, H2 = h * 2;   // рисуем в 2× — чётче после сжатия
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
      const P = WHEEL[c.pal ?? ((ep.n || 0) + i) % WHEEL.length];
      const right = c.side !== 'left', words = String(c.text).split(' '), lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : words.length === 2 && c.text.length > 11 ? words : [c.text];
      const html = `<!doctype html><meta charset=utf-8><style>${font('M', 900, 'montserrat')}${font('I', 800, 'inter')}*{margin:0}body{width:${w}px;height:${h}px;overflow:hidden;background:#000;font-family:M}
#bg{position:absolute;inset:-14px;background:url("file://${frames[i * 2]}") center/cover;filter:blur(4px) saturate(1.55) contrast(1.1) brightness(1.06)}
#gold{position:absolute;inset:0;background:linear-gradient(${right ? 215 : 145}deg,rgba(255,190,90,.55) 0,rgba(255,140,60,.18) 40%,rgba(80,40,140,.25) 100%);mix-blend-mode:overlay}
#bok{position:absolute;inset:0}#bok i{position:absolute;border-radius:50%;background:radial-gradient(circle,rgba(255,236,190,.55),rgba(255,236,190,0) 70%)}
#shade{position:absolute;inset:0;background:linear-gradient(${right ? 200 : 160}deg,rgba(255,236,200,.45) 0,rgba(255,255,255,0) 38%,rgba(20,10,60,.38) 100%);mix-blend-mode:overlay;-webkit-mask:url("file://${frames[i * 2 + 1]}") center/cover}
#hero{position:absolute;inset:0;background:url("file://${frames[i * 2 + 1]}") center/cover;filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 22px 26px rgba(0,0,0,.55))}
#vg{position:absolute;inset:0;background:radial-gradient(ellipse at ${right ? '72%' : '28%'} 45%,rgba(0,0,0,0) 35%,rgba(0,0,0,.4) 100%)}
#wash{position:absolute;inset:0;background:radial-gradient(ellipse 75% 62% at ${right ? '0%' : '100%'} 0%,${P.wash}f0 0,${P.wash}b0 45%,${P.wash}00 100%);mix-blend-mode:normal}
#tint{position:absolute;inset:0;background:${P.wash};mix-blend-mode:soft-light;opacity:.32}
#burst{position:absolute;${right ? 'right:-120px' : 'left:-120px'};top:-60px;width:760px;height:760px;background:repeating-conic-gradient(${P.ray} 0 6deg,rgba(255,255,255,0) 6deg 18deg);-webkit-mask-image:radial-gradient(circle,#000 20%,transparent 68%);mix-blend-mode:screen}
#t{position:absolute;${right ? 'left:34px' : 'right:34px'};top:64px;width:${Math.round(w * .56)}px;display:flex;flex-direction:column;align-items:${right ? 'flex-start' : 'flex-end'};transform:rotate(${right ? -4 : 4}deg) skewX(-6deg);transform-origin:${right ? 'left' : 'right'} top}
.l{white-space:nowrap;font-weight:900;line-height:.92;color:${P.text};-webkit-text-stroke:14px #000;paint-order:stroke fill;text-shadow:0 10px 0 #000,0 16px 26px rgba(0,0,0,.55);letter-spacing:-1px}
.l.w{color:#fff}.sub{margin-top:14px;font:800 38px I;color:#fff;background:${P.plate};padding:6px 18px 9px;border-radius:12px;border:4px solid #000;transform:rotate(-2deg)}
#ex{position:absolute;${right ? 'left:18px' : 'right:18px'};bottom:30px;font:900 120px M;color:${P.text};-webkit-text-stroke:8px #000;paint-order:stroke fill;transform:rotate(-12deg)}
svg{position:absolute;${right ? 'left:43%' : 'right:43%'};top:46%;width:200px;height:120px;transform:rotate(${right ? 18 : 162}deg)}</style>
<div id=bg></div><div id=gold></div><div id=tint></div><div id=bok>${[...Array(14)].map((_, k) => { const r = 30 + (k * 37 % 70); return `<i style="left:${(k * 211) % 1280}px;top:${(k * 97) % 520}px;width:${r}px;height:${r}px"></i>`; }).join('')}</div><div id=wash></div><div id=burst></div><div id=hero></div><div id=shade></div><div id=vg></div>
<div id=t>${lines.map((s, k) => `<div class="l${k && lines.length > 1 && !/\d/.test(s) ? ' w' : ''}">${esc(s)}</div>`).join('')}${c.sub ? `<div class=sub>${esc(c.sub)}</div>` : ''}</div>
${c.arrow ? `<svg viewBox="0 0 200 120"><path d="M8 60 Q 90 10 150 52" fill="none" stroke="#000" stroke-width="30" stroke-linecap="round"/><path d="M8 60 Q 90 10 150 52" fill="none" stroke="${P.text}" stroke-width="18" stroke-linecap="round"/><path d="M128 20 L192 66 L118 90 Z" fill="${P.text}" stroke="#000" stroke-width="8" stroke-linejoin="round"/></svg>` : ''}
${c.bang !== false ? '<div id=ex>!!</div>' : ''}
<script>document.fonts.ready.then(()=>{const L=[...document.querySelectorAll('.l')];let px=170;const f=()=>L.forEach(d=>d.style.fontSize=px+'px');f();while(px>54&&(L.some(d=>d.offsetWidth>${Math.round(w * .56)})||L.reduce((s,d)=>s+d.offsetHeight,0)>${Math.round(h * .52)})){px-=4;f();}document.title='ready'})</script>`;
      const hf = path.join(outDir, `cover${i}.html`); fs.writeFileSync(hf, html); await p.goto('file://' + hf); await p.waitForFunction(() => document.title === 'ready');
      const f = path.join(outDir, `cover_${i + 1}.jpg`); await p.screenshot({ path: f, type: 'jpeg', quality: 92 }); out.push(f); fs.rmSync(hf);
    }
    frames.forEach(f => fs.rmSync(f, { force: true })); fs.rmSync(page, { force: true });
  } finally { await br.close().catch(() => {}); }
  return out;
}
