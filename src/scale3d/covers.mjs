// Обложки для 3D-выпусков «Сколько нужно?»: кадр из готового ролика (момент t) справа + крупная надпись слева.
// covers: [{ img: чистый кадр (stills3d clean) или t: секунда кадра из ролика, tag: 'красная плашка', lines: [['ТЕКСТ', 'y'|'w'], …], accent: 'мелкая строка' }]
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { chromium } from '../books/render.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url)), FONTS = path.join(DIR, '..', 'jung', 'engine', 'fonts');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const font = (fam, w, b) => [['cyrillic', 'U+0400-045F,U+2116'], ['latin', 'U+0000-00FF,U+2000-206F,U+20BD,U+2248']].map(([sub, r]) => `@font-face{font-family:${fam};font-weight:${w};src:url("file://${path.join(FONTS, `${b}-${sub}-${w}-normal.woff2`)}");unicode-range:${r}}`).join('');

export async function covers3d(video, covers, outDir) {
  fs.mkdirSync(outDir, { recursive: true }); const out = [], br = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
  try {
    const p = await br.newPage({ viewport: { width: 1280, height: 720 } });
    for (const [i, c] of covers.entries()) {
      const frame = path.join(outDir, `cover_bg${i}.jpg`); if (c.img) fs.copyFileSync(c.img, frame); else execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(c.t), '-i', video, '-frames:v', '1', '-q:v', '2', frame]);   // c.img — чистый кадр без надписей
      const html = `<!doctype html><meta charset=utf-8><style>${font('M', 900, 'montserrat')}${font('I', 800, 'inter')}*{margin:0}body{width:1280px;height:720px;overflow:hidden;background:#0b1a3a;font-family:M}
#bg{position:absolute;inset:0;background:url("file://${frame}") ${c.pos || '70% 50%'}/cover;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 42%)}
#sh{position:absolute;inset:0;background:linear-gradient(90deg,rgba(6,14,34,.96) 0,rgba(6,14,34,.75) 38%,rgba(6,14,34,0) 62%)}
#t{position:absolute;left:52px;top:0;height:720px;width:690px;display:flex;flex-direction:column;justify-content:center;font-weight:900;line-height:.98}
#t .l{width:max-content;white-space:nowrap;-webkit-text-stroke:3px #000;paint-order:stroke fill;text-shadow:0 8px 0 rgba(0,0,0,.35),0 14px 30px rgba(0,0,0,.6)}
.w{color:#fff}.y{color:#ffd400}.tag{display:inline-block;width:max-content;font:900 40px M;background:#ff2d4a;color:#fff;padding:6px 20px 8px;border-radius:12px;margin-bottom:22px;transform:rotate(-2deg)}
.acc{font:800 44px I;color:#fff;margin-top:16px;-webkit-text-stroke:0;text-shadow:0 4px 14px #000}</style>
<div id=bg></div><div id=sh></div><div id=t>${c.tag ? `<div class=tag>${esc(c.tag)}</div>` : ''}${c.lines.map(([s, k]) => `<div class="l ${k === 'y' ? 'y' : 'w'}">${esc(s)}</div>`).join('')}${c.accent ? `<div class=acc>${esc(c.accent)}</div>` : ''}</div>
<script>document.fonts.ready.then(()=>{const L=[...document.querySelectorAll('.l')];let px=150;const f=()=>L.forEach(d=>d.style.fontSize=px+'px');f();while(px>60&&(L.some(d=>d.offsetWidth>660)||L.reduce((h,d)=>h+d.offsetHeight,0)>450)){px-=4;f();}document.title='ready'})</script>`;
      const hf = path.join(outDir, `cover${i}.html`); fs.writeFileSync(hf, html); await p.goto('file://' + hf); await p.waitForFunction(() => document.title === 'ready');
      const f = path.join(outDir, `cover_${i + 1}.jpg`); await p.screenshot({ path: f, type: 'jpeg', quality: 92 }); out.push(f); fs.rmSync(hf); fs.rmSync(frame);
    }
  } finally { await br.close().catch(() => {}); }
  return out;
}
