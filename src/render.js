// План -> MP4. Кадры рисует Chromium (Playwright), кодирует ffmpeg, параллельно в несколько потоков.
// Звук: голос (громкость выравнивается) + шина SFX, которая автоматически приглушается под голос, + лимитер.
import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; p.stderr.on('data', d => err += d); p.on('close', c => c ? rej(new Error(cmd + ' ' + c + ': ' + err.slice(-600))) : res(err)); });

async function openPage(browser, plan) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('PAGE:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
  await page.goto('file://' + path.join(DIR, 'engine', 'index.html'));
  await page.evaluate(() => window.fontsReady());
  const info = await page.evaluate(p => window.loadPlan(p), plan);
  await page.evaluate(() => window.imagesReady?.());   // снимки сайтов для сцен «Экран»
  return { page, info };
}

/**
 * @param plan        план, размеченный режиссёром (director.direct)
 * @param out         путь к итоговому mp4 (при разбиении на части: out_part1.mp4, …)
 * @param opts.voice  WAV голоса (начинается в момент 0 аудио), opts.voiceOffset — сдвиг голоса в ролике, сек
 * @param opts.sfx    WAV шины звуковых эффектов (уже в абсолютном времени ролика)
 * @param opts.maxMB  лимит размера одного файла (Telegram — 50 МБ)
 */
export async function renderVideo(plan, out, opts = {}) {
  // потоков столько, сколько тянет память: каждый — страница Chromium (~350 МБ) + кодировщик x264 (~150 МБ).
  // На маленьком сервере (2 ГБ) это 1–2 потока; иначе система убивает браузер посреди ролика.
  const memWorkers = Math.floor((os.freemem() - 300 * 2 ** 20) / (500 * 2 ** 20));
  let workers = opts.workers || Math.max(1, Math.min(6, os.cpus().length, memWorkers));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'));
  const launch = () => chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--disable-gpu', '--no-sandbox', '--force-color-profile=srgb', '--disable-dev-shm-usage'] });
  let browser = await launch();
  try {
    const { page: p0, info } = await openPage(browser, plan); await p0.close();
    const N = info.frames, dur = N / 30;
    const maxMB = opts.maxMB || Number(process.env.MAX_VIDEO_MB) || 48, audioK = 160;
    // качество важнее размера: если в один файл влезает только «мыло», режем ролик на части
    const fitK = Math.floor((maxMB * 8 * 1024 * .92) / dur - audioK);
    const split = fitK < 1800;
    const vk = split ? 2400 : Math.min(5000, fitK);
    // кусок ролика [a, b) → файл p<i>.mp4; при падении браузера кусок перерисовывается целиком
    const chunk = async (i, a, b, onFrame) => {
      const { page } = await openPage(browser, plan);
      // упавшая вкладка не отвечает вечно — ловим событие crash и ставим предел на кадр
      let crashed; const crash = new Promise((_, rej) => { crashed = rej; }); crash.catch(() => {});
      page.on('crash', () => crashed(new Error('вкладка Chromium упала (нехватка памяти)'))); page.on('close', () => crashed(new Error('вкладка закрыта')));
      const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-threads', '2', '-rc-lookahead', '20', '-b:v', vk + 'k', '-maxrate', Math.round(vk * 1.5) + 'k', '-bufsize', vk * 3 + 'k',
        '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-tune', 'animation', '-pix_fmt', 'yuv420p', path.join(tmp, `p${i}.mp4`)], { stdio: ['pipe', 'ignore', 'inherit'] });
      try {
        for (let f = a; f < b; f++) {
          let to; const url = await Promise.race([page.evaluate(f => window.grab(f, .92), f), crash, new Promise((_, rej) => { to = setTimeout(() => rej(new Error('кадр не отрисовался за 60 с')), 60000); })]).finally(() => clearTimeout(to));
          if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
          onFrame();
        }
        ff.stdin.end(); await new Promise(r => ff.on('close', r));
      } catch (e) { ff.kill('SIGKILL'); throw e; }
      finally { await page.close().catch(() => {}); }
    };
    const per = Math.ceil(N / workers), chunks = [...Array(workers).keys()].map(i => [i, i * per, Math.min(N, (i + 1) * per)]).filter(([, a, b]) => a < b);
    let done = 0; const tick = () => { if (++done % 60 === 0 && opts.onProgress) opts.onProgress(Math.min(1, done / N)); };
    const res = await Promise.allSettled(chunks.map(([i, a, b]) => chunk(i, a, b, tick)));
    // упавшие куски — заново, по одному и в свежем браузере (это почти всегда нехватка памяти)
    for (const [k, r] of res.entries()) {
      if (r.status === 'fulfilled') continue;
      console.error(`render: кусок ${k + 1}/${chunks.length} упал (${r.reason?.message?.slice(0, 120)}) — перерисовываю`);
      if (!browser.isConnected()) browser = await launch();
      const [i, a, b] = chunks[k];
      try { await chunk(i, a, b, () => {}); }
      catch { await browser.close().catch(() => {}); browser = await launch(); await chunk(i, a, b, () => {}); }
    }
    workers = chunks.length;
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, [...Array(workers).keys()].filter(w => fs.existsSync(path.join(tmp, `p${w}.mp4`))).map(w => `file 'p${w}.mp4'`).join('\n'));
    const video = path.join(tmp, 'video.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);

    // ---- звук ----
    const args = ['-y', '-v', 'error', '-i', video];
    // входы: голос (выравнивается по громкости), SFX и музыка (обе приседают под голос), общий лимитер
    const ix = {}; let k = 1;
    for (const key of ['voice', 'sfx', 'music']) if (opts[key]) { args.push('-i', opts[key]); ix[key] = k++; }
    const ms = Math.round((opts.voiceOffset || 0) * 1000), parts = [], mix = [];
    if (ix.voice) {
      const outs = ['[v0]', ix.sfx && '[vs]', ix.music && '[vm]'].filter(Boolean);
      parts.push(`[${ix.voice}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},loudnorm=I=-16:TP=-2:LRA=11${outs.length > 1 ? `,asplit=${outs.length}${outs.join('')}` : '[v0]'}`);
      mix.push('[v0]');
    }
    if (ix.sfx) {
      parts.push(`[${ix.sfx}:a]volume=${ix.voice ? -7 : -3}dB[s0]`);
      if (ix.voice) { parts.push('[s0][vs]sidechaincompress=threshold=0.035:ratio=7:attack=8:release=280[sd]'); mix.push('[sd]'); } else mix.push('[s0]');
    }
    if (ix.music) {
      parts.push(`[${ix.music}:a]volume=${ix.voice ? (opts.musicDb ?? -14) : -2}dB[m0]`);
      if (ix.voice) { parts.push('[m0][vm]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=450[md]'); mix.push('[md]'); } else mix.push('[m0]');
    }
    const hasAudio = mix.length > 0;
    const filter = parts.join(';') + `;${mix.join('')}amix=inputs=${mix.length}:normalize=0:duration=longest,alimiter=limit=0.89:level=false[a]`;
    if (hasAudio) args.push('-filter_complex', filter, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', audioK + 'k', '-ar', '48000', '-t', dur.toFixed(2));
    args.push('-c:v', 'copy', '-movflags', '+faststart', out);
    await run('ffmpeg', args);
    if (opts.onProgress) opts.onProgress(1);

    // ---- части для Telegram ----
    let files = [out];
    if (split) {
      const partSec = Math.floor((maxMB * 8 * 1024 * .9) / (vk * 1.15 + audioK) / 2) * 2;
      const base = out.replace(/\.mp4$/, '');
      await run('ffmpeg', ['-y', '-v', 'error', '-i', out, '-c', 'copy', '-map', '0', '-f', 'segment', '-segment_time', String(partSec), '-reset_timestamps', '1', '-movflags', '+faststart', `${base}_part%02d.mp4`]);
      files = fs.readdirSync(path.dirname(out)).filter(f => f.startsWith(path.basename(base) + '_part')).sort().map(f => path.join(path.dirname(out), f));
    }
    return { file: out, files, duration: dur, sizeMB: fs.statSync(out).size / 1048576, scenes: info.scenes, split };
  } finally {
    await browser.close().catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** Обложки 1280×720: variants = [{variant, lines, place}] -> пути к JPEG */
export async function renderThumbs(plan, dir, variants) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--disable-gpu', '--no-sandbox', '--force-color-profile=srgb'] });
  try {
    const { page } = await openPage(browser, plan), files = [];
    for (const [i, v] of variants.entries()) { const url = await page.evaluate(o => window.thumb(o), v); const f = path.join(dir, `thumb_${i + 1}.jpg`); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); files.push(f); }
    return files;
  } finally { await browser.close(); }
}
/** Фирменные материалы: аватарка, шапка, стикеры (PNG) */
export async function renderBrand(plan, dir, kinds = ['avatar', 'banner', 'sticker:happy', 'sticker:shock', 'sticker:cool', 'sticker:panic', 'sticker:sleep', 'sticker:think', 'sticker:wave']) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--disable-gpu', '--no-sandbox', '--force-color-profile=srgb'] });
  try {
    const { page } = await openPage(browser, plan), files = [];
    for (const k of kinds) { const url = await page.evaluate(x => window.brandAsset(x), k); const f = path.join(dir, k.replace(':', '_') + '.png'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); files.push(f); }
    return files;
  } finally { await browser.close(); }
}
