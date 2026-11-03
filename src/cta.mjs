// Финал-призыв для Shorts всех каналов: ~4 с в конце ролика — карточка канала, нажатие «Подписаться» → «Вы подписаны ✓», колокольчик,
// «Полный ролик — на канале» и голос. Фон — размытый последний кадр самого Shorts, чтобы финал продолжал ролик, а не обрывал его.
// Голосовая фраза канала озвучивается один раз и кэшируется (cacheDir/cta_<канал>_<хэш>.wav), дальше только подклеивается.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { synthesize } from './voice.js';
import { chromium } from './books/render.mjs';
import { renderSfxBus } from './sfx.js';

const DIR = path.dirname(fileURLToPath(import.meta.url)), FONTS = path.join(DIR, 'jung', 'engine', 'fonts'), FPS = 24, W = 1080, H = 1920;
const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; p.stderr.on('data', d => (e += d)); p.on('close', c => (c ? rej(new Error(`${cmd}: ${e.slice(-300)}`)) : res())); });

// канал: имя, буквы на аватарке, цвета, надпись про полный ролик и голосовая фраза
export const CTA = {
  scale: { name: 'Сколько нужно?', mark: '?', c1: '#ffd400', c2: '#ff3b5c', full: 'ПОЛНЫЙ РАСЧЁТ — НА КАНАЛЕ', say: 'Полный расчёт — у меня на канале. Подпишись, тут каждую неделю безумные цифры!' },
  body: { name: 'Рентген привычек', mark: 'РП', c1: '#38d6ff', c2: '#ff4d6a', full: 'ПОЛНЫЙ ВЫПУСК — НА КАНАЛЕ', say: 'Полный выпуск — на канале. Подпишись, чтобы узнать, что ещё творится с телом!' },
  psy: { name: 'Психофакт', mark: 'ПФ', c1: '#a98bff', c2: '#ff6b9a', full: 'ПОЛНЫЙ РАЗБОР — НА КАНАЛЕ', say: 'Полный разбор — на канале. Подпишись, тут каждый день психология простыми словами!' },
  jung: { name: 'Подвал Разума', mark: 'ПР', c1: '#e8c27a', c2: '#b0452c', full: 'ПОЛНАЯ ЛЕКЦИЯ — НА КАНАЛЕ', say: 'Полная лекция — на канале. Подпишись, чтобы не пропустить новую.' },
  book: { name: 'Книжная лавка', mark: 'КЛ', c1: '#ffb02e', c2: '#2f6fd6', full: 'ПОЛНЫЙ ОБЗОР — НА КАНАЛЕ', say: 'Полный обзор книги — на канале. Подпишись, чтобы читать больше за меньшее время!' },
};

function fontCss() {
  const f = n => 'file://' + path.join(FONTS, n), CY = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', LA = 'U+0000-00FF,U+2000-206F,U+2190-21FF,U+2713';
  return [['Montserrat', 900, 'montserrat'], ['Inter', 800, 'inter']].flatMap(([fam, w, b]) => [[`${b}-cyrillic-${w}-normal.woff2`, CY], [`${b}-latin-${w}-normal.woff2`, LA]].map(([file, r]) => `@font-face{font-family:"${fam}";font-weight:${w};src:url("${f(file)}") format("woff2");unicode-range:${r}}`)).join('');
}
// анимация кадра по времени t (сек): карточка выезжает, курсор жмёт кнопку на PRESS, колокольчик качается, шарики-конфетти
const PAGE = (b, bg, dur) => `<!doctype html><meta charset=utf-8><style>${fontCss()}html,body{margin:0;background:#000}</style><canvas id=c width=${W} height=${H}></canvas><img id=bg src="${bg}" style="display:none">
<script>
const B=${JSON.stringify(b)}, DUR=${dur}, PRESS=1.45, X=document.getElementById('c').getContext('2d'), img=document.getElementById('bg');
const cl=(v,a,b)=>Math.max(a,Math.min(b,v)), pr=(t,a,b)=>cl((t-a)/(b-a),0,1), eo=k=>1-(1-k)**3, back=k=>{const s=1.7;k-=1;return k*k*((s+1)*k+s)+1};
function rr(x,y,w,h,r){X.beginPath();X.roundRect(x,y,w,h,r);}
function txt(s,x,y,f,c,a=1){X.save();X.globalAlpha=a;X.font=f;X.textAlign='center';X.fillStyle=c;X.fillText(s,x,y);X.restore();}
window.draw=t=>{
  X.save();X.filter='blur(26px) brightness(.45) saturate(1.2)';X.drawImage(img,-60,-60,${W}+120,${H}+120);X.restore();
  const g=X.createLinearGradient(0,0,0,${H});g.addColorStop(0,'rgba(5,10,24,.35)');g.addColorStop(1,'rgba(5,10,24,.85)');X.fillStyle=g;X.fillRect(0,0,${W},${H});
  for(let i=0;i<26;i++){const r1=Math.sin(i*12.9898)*43758.5453%1, r2=Math.sin(i*78.233)*12345.678%1, u=(t*.18+Math.abs(r1))%1, x=Math.abs(r2)*${W}, y=${H}+80-u*(${H}+200);
    X.save();X.globalAlpha=.35*pr(t,0,.5);X.fillStyle=i%2?B.c1:B.c2;X.beginPath();X.ellipse(x,y,22,27,0,0,6.283);X.fill();X.restore();}
  const k=back(pr(t,0,.45)), cy=${H}*.42+(1-k)*420, a=pr(t,0,.25);
  X.save();X.globalAlpha=a;X.shadowColor='rgba(0,0,0,.5)';X.shadowBlur=60;X.shadowOffsetY=24;rr(110,cy-330,860,760,64);X.fillStyle='#ffffff';X.fill();X.restore();
  X.save();X.globalAlpha=a;const ag=X.createLinearGradient(380,cy-260,700,cy-60);ag.addColorStop(0,B.c1);ag.addColorStop(1,B.c2);X.fillStyle=ag;X.beginPath();X.arc(540,cy-150,120,0,6.283);X.fill();
  X.lineWidth=10;X.strokeStyle='#fff';X.stroke();X.restore();
  txt(B.mark,540,cy-112,'900 '+(B.mark.length>1?96:130)+'px Montserrat','#fff',a);
  txt(B.name,540,cy+60,'900 74px Montserrat','#101a30',a);
  txt(B.full,540,cy+130,'800 36px Inter','#6b7894',a*pr(t,.25,.6));
  const pressed=t>=PRESS, sq=1-.08*Math.sin(Math.PI*pr(t,PRESS-.08,PRESS+.12)), bw=640, bh=130, bx=540, by=cy+270;
  X.save();X.globalAlpha=a;X.translate(bx,by);X.scale(sq,sq);rr(-bw/2,-bh/2,bw,bh,65);X.fillStyle=pressed?'#e9edf3':'#ff0033';X.fill();
  X.font='900 52px Montserrat';X.textAlign='center';X.fillStyle=pressed?'#4a5672':'#fff';X.fillText(pressed?'ВЫ ПОДПИСАНЫ ✓':'ПОДПИСАТЬСЯ',0,18);X.restore();
  if(t>=PRESS){const r=pr(t,PRESS,PRESS+.45);X.save();X.globalAlpha=(1-r)*.8;X.strokeStyle=B.c1;X.lineWidth=8;rr(bx-bw/2-r*60,by-bh/2-r*60,bw+r*120,bh+r*120,65+r*60);X.stroke();X.restore();}
  const bell=pr(t,PRESS+.15,PRESS+.3), sw=t>PRESS+.15?Math.sin((t-PRESS)*28)*Math.exp(-(t-PRESS-.15)*3)*.5:0;
  if(bell>0){X.save();X.globalAlpha=bell;X.translate(bx+bw/2+40,by-70);X.rotate(sw);X.fillStyle=B.c1;X.beginPath();X.moveTo(-34,30);X.quadraticCurveTo(-34,-40,0,-44);X.quadraticCurveTo(34,-40,34,30);X.lineTo(46,44);X.lineTo(-46,44);X.closePath();X.fill();
    X.beginPath();X.arc(0,52,11,0,6.283);X.fill();X.restore();}
  const cx=cl(900-eo(pr(t,.55,PRESS-.05))*(900-bx-90),0,2000), cyy=by+260-eo(pr(t,.55,PRESS-.05))*220, cs=t>PRESS-.08&&t<PRESS+.15?.85:1;
  if(t>.45&&t<PRESS+.9){X.save();X.globalAlpha=pr(t,.45,.6)*(1-pr(t,PRESS+.5,PRESS+.9));X.translate(cx,cyy);X.scale(cs,cs);X.fillStyle='#fff';X.strokeStyle='#101a30';X.lineWidth=6;
    X.beginPath();X.moveTo(0,0);X.lineTo(0,74);X.lineTo(20,56);X.lineTo(36,90);X.lineTo(50,83);X.lineTo(34,50);X.lineTo(60,50);X.closePath();X.fill();X.stroke();X.restore();}
  const up=pr(t,PRESS+.4,PRESS+.8);txt('▲  '+B.full.replace(' — НА КАНАЛЕ',''),540,cy+560,'900 46px Montserrat',B.c1,up);txt('смотри на канале',540,cy+620,'800 38px Inter','#ffffff',up*.9);
  return document.getElementById('c').toDataURL('image/jpeg',.9);
};
img.decode().then(()=>document.fonts.load('900 60px Montserrat','АаЯя')).then(()=>document.fonts.load('800 40px Inter','АаЯя')).then(()=>{window.READY=true});
</script>`;

/** Голосовая фраза канала: озвучивается один раз (Lumean) и кэшируется. voice: { key, template }. */
export async function ctaVoice(kind, { voice, cacheDir, say } = {}) {
  const b = CTA[kind], text = say || b.say, h = crypto.createHash('sha1').update(kind + '|' + text + '|' + (voice?.template || '')).digest('hex').slice(0, 10);
  const file = path.join(cacheDir, `cta_${kind}_${h}.wav`); if (fs.existsSync(file)) return file;
  if (!voice?.key) return null;   // нет голоса — финал без слов, только звук и анимация
  const tmp = path.join(cacheDir, `cta_tmp_${h}`); fs.mkdirSync(tmp, { recursive: true });
  const vo = await synthesize([text], { ...voice, dir: tmp }); fs.copyFileSync(vo.file, file); fs.rmSync(tmp, { recursive: true, force: true }); return file;
}

/** Приклеить финал-призыв к Shorts (файл заменяется на месте). opts: { kind, voice, cacheDir, say, name } */
export async function appendCta(shortFile, { kind = 'scale', voice = null, cacheDir, say, name } = {}) {
  const b = { ...CTA[kind], ...(name ? { name } : {}) }; cacheDir = cacheDir || path.join(path.dirname(shortFile), '.cta'); fs.mkdirSync(cacheDir, { recursive: true });
  const work = fs.mkdtempSync(path.join(cacheDir, 'w')), last = path.join(work, 'last.jpg');
  try {
    const durShort = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', shortFile]).toString().trim();
    await run('ffmpeg', ['-y', '-v', 'error', '-sseof', '-0.3', '-i', shortFile, '-frames:v', '1', '-q:v', '3', last]);
    const vfile = await ctaVoice(kind, { voice, cacheDir, say }).catch(() => null);
    const vdur = vfile ? +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', vfile]).toString().trim() : 0;
    const dur = Math.max(4, vdur + .9), N = Math.ceil(dur * FPS), page = path.join(work, 'cta.html');
    fs.writeFileSync(page, PAGE(b, 'data:image/jpeg;base64,' + fs.readFileSync(last).toString('base64'), dur));
    const clip = path.join(work, 'cta.mp4'), br = await chromium.launch({ args: ['--no-sandbox', '--allow-file-access-from-files'] });
    try { const p = await br.newPage({ viewport: { width: W, height: H } }); await p.goto('file://' + page); await p.waitForFunction(() => window.READY === true);
      const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', clip], { stdio: ['pipe', 'ignore', 'pipe'] });
      const closed = new Promise(r => ff.on('close', r));
      for (let f = 0; f < N; f++) { const url = await p.evaluate(t => window.draw(t), f / FPS); ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); }
      ff.stdin.end(); if (await closed) throw new Error('ffmpeg: финал не собрался');
    } finally { await br.close().catch(() => {}); }
    const sfx = path.join(work, 'sfx.wav'); renderSfxBus([{ t: 0, kind: 'whoosh', gain: .35, v: 1 }, { t: 1.45, kind: 'click', gain: .5, v: 1 }, { t: 1.62, kind: 'ding', gain: .35, v: 2 }, { t: .1, kind: 'pop', gain: .3, v: 3 }], dur, sfx);
    const out = path.join(work, 'out.mp4'), vin = vfile ? ['-i', vfile] : ['-f', 'lavfi', '-t', String(dur), '-i', 'anullsrc=r=48000:cl=stereo'];
    await run('ffmpeg', ['-y', '-v', 'error', '-i', shortFile, '-i', clip, ...vin, '-i', sfx, '-filter_complex',
      `[0:v]fps=${FPS},scale=${W}:${H},setsar=1[v0];[1:v]fps=${FPS},scale=${W}:${H},setsar=1[v1];[0:a]aresample=48000,aformat=channel_layouts=stereo[a0];` +
      `[2:a]aresample=48000,aformat=channel_layouts=stereo,adelay=250|250,loudnorm=I=-15:TP=-2,apad=whole_dur=${dur.toFixed(2)}[vo];[3:a]aresample=48000,volume=-6dB[fx];[vo][fx]amix=inputs=2:normalize=0:duration=first[a1];` +
      `[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]`, '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out]);
    fs.renameSync(out, shortFile); return { file: shortFile, added: dur, total: durShort + dur };
  } finally { fs.rmSync(work, { recursive: true, force: true }); }
}
