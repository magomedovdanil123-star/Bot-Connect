// «🔑 Подвал Разума»: лекции на ночь по психологии Юнга. Визуал рисуется кодом (движок code-cartoon, MIT):
// тёплая ночная палитра, светящиеся силуэты, частицы света, подписи Lora. Сценарий = список фраз (beats), у каждой — своя картинка.
// Кадры рисуются в Chromium по 12 в секунду (в этом стиле картинка и так меняется 12 раз в секунду) — вдвое быстрее, чем 24.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { synthesize } from '../voice.js';
import { synthesizeVoiceStudio } from '../voicestudio.js';
import { bookMusic, chromium, toSrt, subChunks } from '../books/render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), ENG = path.join(DIR, 'engine');
const FPS = 12, LEAD = .8;
export const JUNG_LIST = JSON.parse(fs.readFileSync(path.join(DIR, 'list.json'), 'utf8'));
export const ALL_JUNG_PLAYLIST = 'Психология Юнга — лекции на ночь';
const JUNG_PLAYLISTS = { 'Отношения': 'Психология отношений по Юнгу', 'Женская сила': 'Женская сила и архетипы', 'Тень и исцеление': 'Тень, травмы и исцеление', 'Путь к себе': 'Путь к себе: индивидуация', 'Истории Юнга': 'Жизнь Карла Юнга: истории' };

const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; p.stderr.on('data', d => (err += d)); p.on('close', c => (c ? rej(new Error(`${cmd}: ${err.slice(-400)}`)) : res(err))); });
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hashtag = s => '#' + String(s).toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '').slice(0, 30);

// страница с движком: шрифты, палитры, движок, сцена; данные ролика — в window.* до загрузки сцены
function pageHtml(lecture, tm) {
  const f = n => 'file://' + path.join(ENG, 'fonts', n);
  const ff = (fam, w, st, file, range) => `@font-face{font-family:"${fam}";font-weight:${w};font-style:${st};src:url("${f(file)}") format("woff2");unicode-range:${range}}`;
  const CY = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', LA = 'U+0000-00FF,U+2000-206F,U+2190-21FF,U+2713';
  const fonts = [['Caveat', 700, 'normal', 'caveat'], ['Inter', 800, 'normal', 'inter'], ['Inter', 400, 'normal', 'inter'], ['Lora', 600, 'normal', 'lora'], ['Lora', 400, 'italic', 'lora']]
    .flatMap(([fam, w, st, base]) => [ff(fam, w, st, `${base}-cyrillic-${w}-${st}.woff2`, CY), ff(fam, w, st, `${base}-latin-${w}-${st}.woff2`, LA)]).join('\n');
  const cues = { duration: tm.DUR, fps_draw: FPS, events: [], music: { enabled: false } };
  return `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
html,body{margin:0;background:#000}.w{position:absolute;left:-9999px;font:700 20px Caveat}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="${tm.DUR}"><canvas id="stage" width="1920" height="1080"></canvas></div>
<div class="w">Аа<b style="font:800 20px Inter">Аа</b><i style="font:italic 400 20px Lora">Аа</i><span style="font:600 20px Lora">Аа</span><span style="font:400 20px Inter">Аа</span></div>
<script>window.gsap={timeline:()=>({to(){return this}})};window.CUES=${JSON.stringify(cues)};window.LECTURE=${JSON.stringify(lecture)};window.TM=${JSON.stringify(tm)};</script>
<script src="file://${path.join(ENG, 'palettes.js')}"></script><script src="file://${path.join(ENG, 'sketch.js')}"></script><script src="file://${path.join(ENG, 'scene.js')}"></script>
<script>window.grab=(f,q)=>{Sketch.render(f/${FPS});return document.getElementById('stage').toDataURL('image/jpeg',q)};</script></body></html>`;
}

// обложка в стиле хитов канала: портрет «Юнга» с неоновой подсветкой справа (engine/portraits), слева 2–3 строки жирного КАПСА.
// Ключевая строка ('r'|'y') — на яркой плашке цвета напротив подсветки по цветовому кругу. spec: { lines: [['он изменил.'], ['не ты виновата', 'r']],
//   color?: 'purple'|'red'|'blue'|'amber'|'teal', sub?: 'подпись-интрига', icon?: 'код OpenMoji', msg?: { name, text } — уведомление «от него» }
// Текст обложки — незакрытый вопрос: обрыв («ОН ХОЧЕТ НАПИСАТЬ, НО…»), «это» вместо ответа, опровержение («ТЕБЯ БУДИТ НЕ ТРЕВОГА»),
// факт-шок, «он/ты». Не повторять заголовок ролика и не выдавать ответ. 2–3 короткие строки, ключевая — на плашке.
export const PORTRAITS = ['purple', 'red', 'blue', 'amber', 'teal'];
// «Ночной» стиль (по умолчанию с 04.11 — владелец: «тёмное, как было круто»): тёмный фон, Юнг в цветной подсветке справа (portraits/<цвет>.jpg),
// крупный белый текст с чёрной обводкой, выделенная строка — на яркой плашке, подпись жёлтым. Старые варианты — c.style: 'cut' или c.bg.
function nightHtml(c, color) {
  const f = n => 'file://' + path.join(ENG, 'fonts', n), ff = (fam, w, file, r) => `@font-face{font-family:${fam};font-weight:${w};src:url("${f(file)}") format("woff2");unicode-range:${r}}`;
  const CY = 'U+0400-045F,U+2116', LA = 'U+0000-00FF,U+2000-206F';
  const PLATE = { purple: '#ffd400', red: '#ff2d2d', blue: '#ff2d2d', amber: '#ff2d2d', teal: '#ffd400' }[color] || '#ff2d2d', ink = PLATE === '#ffd400' ? '#111' : '#fff';
  const RIM = { purple: 'rgba(180,77,255,.55)', red: 'rgba(255,48,64,.5)', blue: 'rgba(255,70,50,.5)', amber: 'rgba(255,164,0,.5)', teal: 'rgba(20,214,180,.5)' }[color] || 'rgba(255,60,40,.5)';
  const lines = c.lines.map(([t, k]) => `<div class="ln${k ? ' pl' : ''}">${esc(t)}</div>`).join('');
  return `<!doctype html><meta charset=utf-8><style>${ff('M', 900, 'montserrat-cyrillic-900-normal.woff2', CY)}${ff('M', 900, 'montserrat-latin-900-normal.woff2', LA)}${ff('I', 800, 'inter-cyrillic-800-normal.woff2', CY)}${ff('I', 800, 'inter-latin-800-normal.woff2', LA)}
*{margin:0;padding:0}body{width:1280px;height:720px;overflow:hidden;position:relative;background:#03040a;font-family:M}
#bg{position:absolute;inset:0;background:url("file://${path.join(ENG, 'portraits', color + '.jpg')}") 100% 50%/cover;filter:brightness(1.15) contrast(1.05)}
#rl{position:absolute;inset:0;background:radial-gradient(ellipse 20% 30% at 72% 50%,${RIM} 0,transparent 75%);mix-blend-mode:screen}
#sh{position:absolute;inset:0;background:linear-gradient(90deg,rgba(3,4,12,.96) 0,rgba(3,4,12,.86) 40%,rgba(3,4,12,0) 60%)}
#t{position:absolute;left:52px;top:0;height:720px;width:680px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
.ln{width:max-content;white-space:nowrap;text-transform:uppercase;color:#fff;line-height:1;letter-spacing:-1px;-webkit-text-stroke:.06em #000;paint-order:stroke fill;text-shadow:0 .06em 0 #000,0 10px 30px rgba(0,0,0,.9);margin:.03em 0}
.pl{background:${PLATE};color:${ink};-webkit-text-stroke:0;text-shadow:0 .05em 0 rgba(0,0,0,.35);padding:.04em .22em .1em;border-radius:.14em;transform:rotate(-2deg);margin:.12em 0 .1em -.1em;box-shadow:0 0 40px ${PLATE}99,0 12px 26px rgba(0,0,0,.7)}
#sub{font:800 46px I;color:#ffd400;text-transform:uppercase;margin-top:18px;white-space:nowrap;text-shadow:0 4px 14px #000}</style>
<div id=bg></div><div id=rl></div><div id=sh></div><div id=t>${lines}${c.sub ? `<div id=sub>${esc(c.sub)}</div>` : ''}</div>
<script>document.fonts.ready.then(()=>{const ds=[...document.querySelectorAll('.ln')];ds.forEach(d=>{let z=150;d.style.fontSize=z+'px';while(d.getBoundingClientRect().width>640&&z>40)d.style.fontSize=(z-=3)+'px'});
const H=()=>ds.reduce((h,d)=>h+d.getBoundingClientRect().height,0);while(H()>460){ds.forEach(d=>d.style.fontSize=parseFloat(d.style.fontSize)*.95+'px')}
const sb=document.getElementById('sub');let z=46;while(sb&&sb.getBoundingClientRect().right>700&&z>22)sb.style.fontSize=(z-=2)+'px';document.title='ready'})</script>`;
}
function portraitHtml(c, color) {
  const f = n => 'file://' + path.join(ENG, 'fonts', n), M = path.join(DIR, '..', '..', 'node_modules/openmoji/color/svg');
  const ff = (fam, w, st, r, file) => `@font-face{font-family:${fam};font-weight:${w};font-style:${st};src:url("${f(file)}") format("woff2");unicode-range:${r}}`;
  const CY = 'U+0400-045F,U+2116', LA = 'U+0000-00FF,U+2000-206F';
  // «цветовой круг»: плашка и полоса — цвет напротив подсветки портрета (фиолетовый↔жёлтый, синий↔оранжевый, красный↔зелёный…)
  const COMP = { purple: '#ffd400', red: '#2ee86f', blue: '#ff8a00', amber: '#38a6ff', teal: '#ff5a3c' }, cc = COMP[color] || '#ffd400';
  const RIM = { purple: '#b44dff', red: '#ff3040', blue: '#2f7bff', amber: '#ffa400', teal: '#14d6b4' }[color] || '#b44dff';
  // цветной фон вместо чёрного: в тёмной теме YouTube чёрная обложка сливается с лентой; глубокий тон подсветки + свечение за портретом
  const DEEP = { purple: ['#4a1478', '#16052a'], red: ['#7a0d1c', '#25040a'], blue: ['#0f3a8a', '#050f2c'], amber: ['#8a4a00', '#2a1300'], teal: ['#056b5c', '#011f1b'] }[color] || ['#4a1478', '#16052a'];
  // «вырезанный» Юнг (engine/portraits/cut, фон удалён) на чистом фоне цвета напротив подсветки — без тумана; c.bg: 'black'|'haze' — старые варианты
  const CUT = path.join(ENG, 'portraits', 'cut', color + '.png'), cut = !c.bg && fs.existsSync(CUT);
  const icon = c.icon && fs.existsSync(path.join(M, c.icon + '.svg')) ? `<img id=ic src="file://${path.join(M, c.icon + '.svg')}">` : '';
  const msg = c.msg ? `<div id=msg><b class=av>${esc((c.msg.name || '?')[0])}</b><div><div class=nm>${esc(c.msg.name || '')}<span>сейчас</span></div><div class=tx>${esc(c.msg.text || '')}</div></div></div>` : '';
  return `<!doctype html><meta charset=utf-8><style>${ff('M', 900, 'normal', CY, 'montserrat-cyrillic-900-normal.woff2')}${ff('M', 900, 'normal', LA, 'montserrat-latin-900-normal.woff2')}
${ff('L', 400, 'italic', CY, 'lora-cyrillic-400-italic.woff2')}${ff('I', 800, 'normal', CY, 'inter-cyrillic-800-normal.woff2')}${ff('IR', 400, 'normal', CY, 'inter-cyrillic-400-normal.woff2')}
*{margin:0;padding:0}body{width:1280px;height:720px;overflow:hidden;font:900 120px M;color:#fff;${cut
  ? `background:radial-gradient(circle at 74% 40%,color-mix(in oklab,${cc} 70%,#fff) 0,${cc} 34%,color-mix(in oklab,${cc} 72%,#000) 100%)`
  : c.bg === 'black'
  ? `background:#000 url("file://${path.join(ENG, 'portraits', color + '.jpg')}") 70% center/cover`
  : `background:url("file://${path.join(ENG, 'portraits', color + '.jpg')}") 70% center/cover,radial-gradient(ellipse 46% 62% at 72% 46%,${DEEP[1]} 0,${DEEP[1]} 45%,${DEEP[0]} 78%,${RIM} 135%);background-blend-mode:lighten`}}
#sh{position:absolute;inset:0;${cut ? 'display:none;' : ''}background:${c.bg === 'black' ? 'linear-gradient(90deg,rgba(0,0,0,.88) 0,rgba(0,0,0,.6) 40%,rgba(0,0,0,0) 62%)' : `linear-gradient(90deg,${DEEP[1]}d9 0,${DEEP[1]}80 40%,${DEEP[1]}00 60%)`}}
#t{position:absolute;left:58px;top:0;height:720px;width:720px;display:flex;flex-direction:column;justify-content:center;align-items:flex-start;line-height:1;letter-spacing:-1px;text-transform:uppercase}
#t .ln{white-space:nowrap;width:max-content;text-shadow:0 6px 22px rgba(0,0,0,.95),0 0 4px #000;margin:.02em 0}
#t .pl{background:${cc};color:#0b0b0b;text-shadow:none;padding:.06em .2em .1em;margin:.12em 0 .06em -.2em;border-radius:.12em;transform:rotate(-1.5deg);box-shadow:0 0 34px ${cc}88,0 10px 26px rgba(0,0,0,.6)}
#sub{font:italic 400 40px L;color:#ffe9cf;text-transform:none;letter-spacing:0;margin-top:22px;text-shadow:0 3px 12px #000}
#ic{position:absolute;right:452px;bottom:70px;width:150px;filter:drop-shadow(0 0 22px ${RIM}) drop-shadow(0 10px 18px #000);transform:rotate(-8deg)}
#bar{position:absolute;left:24px;top:140px;width:14px;height:440px;border-radius:7px;background:${cc};box-shadow:0 0 28px ${cc}}
#msg{position:absolute;left:58px;bottom:40px;width:560px;display:flex;gap:18px;align-items:center;background:rgba(245,240,234,.96);border-radius:26px;padding:18px 22px;box-shadow:0 0 40px ${RIM}aa,0 14px 30px rgba(0,0,0,.7)}
#msg .av{width:62px;height:62px;flex:none;border-radius:50%;background:${RIM};color:#fff;font:800 32px I;display:flex;align-items:center;justify-content:center}
#msg .nm{font:800 27px I;color:#1a1412;display:flex;justify-content:space-between;width:440px}#msg .nm span{font:400 21px IR;color:#8a7d74}
#msg .tx{font:400 26px IR;color:#3a2e29;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:440px}${cut ? `
#halo{position:absolute;left:640px;top:-200px;width:900px;height:900px;border-radius:50%;background:repeating-radial-gradient(circle,rgba(255,255,255,.16) 0 2px,transparent 2px 70px);mask:radial-gradient(circle,#000 30%,transparent 70%)}
#fig{position:absolute;right:0;top:0;height:720px;filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 2px #fff) drop-shadow(0 0 1px #fff) drop-shadow(-14px 20px 30px rgba(0,0,0,.5))}
#t .ln{color:#fff;-webkit-text-stroke:.07em #111;paint-order:stroke fill;text-shadow:0 .07em 0 #111,0 .1em .25em rgba(0,0,0,.35)}
#t .pl{background:${RIM};color:#fff;-webkit-text-stroke:0;text-shadow:0 .05em 0 rgba(0,0,0,.45);box-shadow:.09em .09em 0 #111}
#sub{font:800 40px I;text-transform:uppercase;letter-spacing:.5px;color:#111;text-shadow:none;margin-top:26px}
#bar{background:${RIM};box-shadow:none}#sub{display:flex;align-items:center;gap:16px}#ici{height:1.9em;filter:drop-shadow(0 6px 10px rgba(0,0,0,.4))}` : ''}</style>
<div id=sh></div>${cut ? `<div id=halo></div><img id=fig src="file://${CUT}">` : ''}<div id=bar></div>${cut ? '' : icon}
<div id=t>${c.lines.map(([t, k]) => `<div class="ln${k ? ' pl' : ''}">${esc(t)}</div>`).join('')}${c.sub || (cut && icon) ? `<div id=sub>${esc(c.sub || '')}${cut ? icon.replace('id=ic', 'id=ici') : ''}</div>` : ''}</div>${msg}
<script>document.fonts.ready.then(() => { const t = document.getElementById('t'), ds = [...t.querySelectorAll('.ln')], room = ${c.msg ? 470 : 600}; let s = 150;
  const fit = () => ds.every(d => d.getBoundingClientRect().width <= 690) && t.scrollHeight <= 720 && [...t.children].reduce((h, d) => h + d.getBoundingClientRect().height, 0) <= room;
  t.style.fontSize = s + 'px'; while (!fit() && s > 50) t.style.fontSize = (s -= 4) + 'px';
  if (${cut ? 1 : 0}) {   // каждая строка — свой размер на всю ширину колонки (короткое слово крупнее), потом общий масштаб по высоте
    const W = 640, H = () => ds.reduce((h, d) => h + d.getBoundingClientRect().height, 0) + (document.getElementById('sub')?.getBoundingClientRect().height || 0);
    ds.forEach(d => { let z = 190; d.style.fontSize = z + 'px'; while (d.getBoundingClientRect().width > W && z > 50) d.style.fontSize = (z -= 3) + 'px'; });
    let k = 1; while (H() > room + 40 && k > .4) { k -= .04; ds.forEach(d => (d.style.fontSize = parseFloat(d.style.fontSize) * .96 + 'px')); }
  }
  const sb = document.getElementById('sub'); let z = parseFloat(getComputedStyle(sb || document.body).fontSize) || 40; while (sb && sb.getBoundingClientRect().right > ${cut ? 640 : 760} && z > 22) sb.style.fontSize = (z -= 2) + 'px';
  if (${c.msg ? 1 : 0}) t.style.justifyContent = 'flex-start', t.style.paddingTop = '48px';
  document.title = 'ready'; });</script>`;
}

// обложки: три варианта для «Теста и сравнения» (портрет в стиле хитов; старые сценарии — крупный текст, уведомление «от него», силуэты)
// Подвал Разума: на КАЖДОЙ обложке — лицо Юнга (шаблон-портрет). Обложки без надписи-портрета достраиваются из названия, всегда ровно 3.
function portraitCovers(ep) {
  const list = (ep.covers || []).filter(c => c.lines).slice(0, 3), w = String(ep.title || '').replace(/[«»"?!.]/g, '').split(/\s+/).filter(Boolean);
  const auto = k => { const a = w.slice(0, Math.ceil(w.length / 2)).join(' '), b = w.slice(Math.ceil(w.length / 2)).join(' ');   // 2 строки, вторая — плашкой
    return { lines: k === 1 ? [[b || a, 'r']] : [[a], [b, 'r']].filter(([t]) => t), sub: 'Юнг объяснил' }; };
  while (list.length < 3) list.push(auto(list.length));
  return list;
}
async function covers(browser, ep, work) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }), out = [];
  try {
    const html = fs.readFileSync(path.join(ENG, 'thumb.html'), 'utf8').replace(/url\(([a-z0-9-]+\.woff2)\)/g, (_, n) => `url(file://${path.join(ENG, 'fonts', n)})`);
    const file = path.join(work, 'thumb.html'); fs.writeFileSync(file, html);
    for (const [i, c] of portraitCovers(ep).entries()) {
      const f = path.join(work, i ? `cover_${i + 1}.jpg` : 'cover.jpg');
      if (c.lines) {   // портрет: цвет подсветки свой у каждой обложки и сдвигается от лекции к лекции
        const pf = path.join(work, `thumb_p${i}.html`); const col = c.color || PORTRAITS[((ep.n || 0) + i) % PORTRAITS.length]; fs.writeFileSync(pf, c.style === 'cut' || c.bg ? portraitHtml(c, col) : nightHtml(c, col));
        await p.goto('file://' + pf); await p.waitForFunction(() => document.title === 'ready', null, { timeout: 30000 });
        fs.writeFileSync(f, await p.screenshot({ type: 'jpeg', quality: 92 })); out.push(f); continue;
      }
      await p.goto('file://' + file + '?' + new URLSearchParams({ v: c.v || i + 1, ...(c.spec ? { spec: JSON.stringify(c.spec) } : {}) }));
      await p.waitForFunction(() => document.title === 'ready', null, { timeout: 30000 });
      const png = await p.locator('#c').screenshot({ type: 'jpeg', quality: 92 }); fs.writeFileSync(f, png); out.push(f);
    }
  } finally { await p.close().catch(() => {}); }
  return out;
}

export function jungMeta(ep, chapters = [], total = 0) {
  const mins = Math.max(1, Math.round(total / 60)), entry = JUNG_LIST.find(x => x.n === ep.n || x.title === ep.title), category = ep.category || entry?.category;
  const title = (ep.ytTitle || ep.title).slice(0, 100), own = ep.tags || [], seen = new Set();
  const tags = [...own, 'карл юнг', 'психология юнга', 'психология отношений', 'женская психология', 'лекция на ночь', 'архетипы юнга', 'психология', 'отношения', 'саморазвитие для женщин']
    .map(t => t.replace(/[,<>"«»]/g, ' ').replace(/\s+/g, ' ').trim()).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 25);
  const description = [ep.hook || `${ep.title}. Лекция на ночь по психологии Карла Юнга — ${mins} минут.`, '', ...(ep.about ? [ep.about, ''] : []),
    ...(chapters.length >= 3 ? ['Содержание:', ...chapters, ''] : []),
    ...(ep.comment ? [`💬 ${ep.comment}`, ''] : []),
    '🔑 Подвал Разума — ключи к подсознанию: психология Юнга, отношения и путь к себе. Подпишись, чтобы не пропустить следующую лекцию.', '',
    'Это психологическая лекция, а не консультация психолога или врача.', '',
    ['#карлюнг', '#психологияотношений', '#женскаяпсихология', hashtag(ep.title.split(/[—:]/)[0])].join(' ')].join('\n');
  return { title, titles: [title, ...(ep.titles || [])].map(t => t.slice(0, 100)), tags, description, playlist: JUNG_PLAYLISTS[category] || null, comment: ep.comment || null };
}

/**
 * Лекция «Подвала Разума» целиком: озвучка → кадры → музыка → обложки → SEO.
 * @param ep   { n, title, ytTitle, titles, about, hook, comment, tags, category, covers, beats: [{ v, o, cap, text }] }
 * @param opts { out, work, voice: { key, template }, onStage, onProgress, signal, seconds }  seconds — для пробы: только начало ролика
 */
export async function renderLecture(ep, { out, work, voice, onStage, onProgress, signal, seconds = null } = {}) {
  const stop = () => { if (signal?.aborted) throw Object.assign(new Error('STOPPED'), { stopped: true }); };
  fs.mkdirSync(work, { recursive: true });
  const texts = ep.beats.map(b => b.text), tmFile = path.join(work, 'timings.json');
  let vo = fs.existsSync(tmFile) ? JSON.parse(fs.readFileSync(tmFile, 'utf8')) : null;
  if (vo && (vo.timings.length !== texts.length || !fs.existsSync(vo.file))) vo = null;
  if (!vo) {
    if (!voice) throw new Error('Озвучка выключена — включи голос (🎙 Голос)');
    onStage?.('voice', { parts: 1 });
    const synth = voice.provider === 'voicestudio' ? synthesizeVoiceStudio : synthesize;
    vo = await synth(texts, { ...voice, dir: work, onStatus: (st, pc, part, parts) => onStage?.('voice', { status: st, percent: pc, part, parts }) });
    fs.writeFileSync(tmFile, JSON.stringify(vo));
  }
  stop();
  const PH = vo.timings.map(t => ({ s: +(LEAD + t.start).toFixed(3), d: +t.speak.toFixed(3) })), END = LEAD + vo.total;
  const total = seconds ? Math.min(seconds, END + 4) : Math.ceil(END + 4), DUR = Math.ceil(END + 4);
  const page = path.join(work, 'page.html'); fs.writeFileSync(page, pageHtml({ title: ep.title, beats: ep.beats }, { PH, LEAD, END, DUR }));
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const chapters = ['0:00 Вступление', ...ep.beats.map((b, i) => b.v === 'chapter' && `${mmss(PH[i].s - .5)} ${b.o?.n ? `${(b.o.word || 'перемена').replace(/^./, ch => ch.toUpperCase())} ${b.o.n}. ` : ''}${b.o?.title || ''}`).filter(Boolean)];
  const meta = jungMeta(ep, chapters, END);
  const subs = path.join(work, 'subs.srt'); fs.writeFileSync(subs, toSrt(subChunks(texts, vo.timings, LEAD)));

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-gpu', '--force-color-profile=srgb', '--disable-dev-shm-usage', '--allow-file-access-from-files'] });
  try {
    const cv = await covers(browser, ep, work); stop();
    const open = async () => { const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto('file://' + page); await p.waitForFunction(() => window.__hf?.buildReady?.['sketch-main'] && window.Sketch?.render, null, { timeout: 60000 }); await p.evaluate(() => window.__hf.buildReady['sketch-main']); return p; };
    const N = Math.ceil(total * FPS), SEG = 240, segs = []; for (let a = 0; a < N; a += SEG) segs.push([a, Math.min(N, a + SEG)]);
    const segFile = a => path.join(work, `s${String(a).padStart(6, '0')}.mp4`), key = JSON.stringify({ N, b: ep.beats.length, v: 1 });
    if ((() => { try { return fs.readFileSync(path.join(work, 'key.json'), 'utf8'); } catch { return ''; } })() !== key) { for (const f of fs.readdirSync(work)) if (/^s\d+\.mp4/.test(f)) fs.rmSync(path.join(work, f)); fs.writeFileSync(path.join(work, 'key.json'), key); }
    const todo = segs.filter(([a]) => !fs.existsSync(segFile(a))); let done = N - todo.reduce((s, [a, b]) => s + b - a, 0);
    const memW = Math.floor((os.freemem() - 400 * 2 ** 20) / (500 * 2 ** 20)), workers = Math.max(1, Math.min(4, os.cpus().length, memW, todo.length));
    onStage?.('render', { frames: N, workers });
    const worker = async () => {
      const p = await open();
      try {
        for (let job; (job = todo.shift());) {
          const [a, b] = job, part = segFile(a) + '.part.mp4';
          const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-r', '24', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-g', '48', part], { stdio: ['pipe', 'ignore', 'inherit'] });
          const closed = new Promise(r => ff.on('close', r));
          try {
            for (let f = a; f < b; f++) {
              stop();
              const url = await p.evaluate(([f, q]) => window.grab(f, q), [f, .9]);
              if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
              if (++done % 60 === 0) onProgress?.(Math.min(1, done / N));
            }
            ff.stdin.end(); if (await closed) throw new Error('ffmpeg упал на куске ' + a);
          } catch (e) { ff.kill('SIGKILL'); fs.rmSync(part, { force: true }); throw e; }
          fs.renameSync(part, segFile(a));
        }
      } finally { await p.close().catch(() => {}); }
    };
    await Promise.all([...Array(workers)].map(worker));
    onProgress?.(1);
    const list = path.join(work, 'list.txt'); fs.writeFileSync(list, segs.map(([a]) => `file '${segFile(a)}'`).join('\n'));
    const video = path.join(work, 'video.mp4'); await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
    stop();
    // звук: голос + тихая спокойная музыка, которая уходит под голос
    const musicFile = path.join(work, 'music.wav'); await bookMusic(total, total + 10, musicFile, work);
    const ms = Math.round(LEAD * 1000);
    await run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-i', vo.file, '-i', musicFile, '-filter_complex',
      `[1:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},loudnorm=I=-16:TP=-2:LRA=11,aresample=48000,apad=whole_dur=${total.toFixed(2)},asplit=2[v][vk];[2:a]volume=-19dB[m0];[m0][vk]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=600[m];[v][m]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.89:level=false[a]`,
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-t', total.toFixed(2), '-movflags', '+faststart', out]);
    fs.rmSync(musicFile, { force: true });
    return { file: out, timings: vo.timings, subs, cover: cv[0], covers: cv, description: meta.description, chapters, title: meta.title, tags: meta.tags, playlist: meta.playlist, comment: meta.comment, titles: meta.titles, duration: total };
  } finally { await browser.close().catch(() => {}); }
}
export { esc, covers as lectureCovers };

/** Предпросмотр без озвучки: по кадру из выбранных фраз (по 4 с на фразу) → work/still_<i>.jpg. Для проверки сцен и новых сценариев. */
export async function lectureStills(ep, work, idx = null) {
  fs.mkdirSync(work, { recursive: true });
  const n = ep.beats.length, PH = ep.beats.map((_, i) => ({ s: +(LEAD + i * 4).toFixed(3), d: 3.5 })), END = LEAD + n * 4, DUR = Math.ceil(END + 2);
  const page = path.join(work, 'page.html'); fs.writeFileSync(page, pageHtml({ title: ep.title, beats: ep.beats }, { PH, LEAD, END, DUR }));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files'] }), out = [];
  try {
    const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto('file://' + page); await p.waitForFunction(() => window.__hf?.buildReady?.['sketch-main'] && window.Sketch?.render, null, { timeout: 60000 }); await p.evaluate(() => window.__hf.buildReady['sketch-main']);
    for (const i of idx || ep.beats.map((_, k) => k)) {
      const url = await p.evaluate(f => window.grab(f, .85), Math.round((PH[i].s + 2.6) * FPS)), f = path.join(work, `still_${String(i).padStart(3, '0')}.jpg`);
      fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); out.push(f);
    }
  } finally { await browser.close(); }
  return out;
}
