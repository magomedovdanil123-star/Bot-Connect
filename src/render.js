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
  await page.evaluate(() => window.newsMediaReady?.());   // фото и видео к новостям
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
    // ролик режется на куски по 10 с; готовые куски лежат в opts.cacheDir (папка проекта) и переживают перезапуск бота —
    // «продолжить сборку» дорисовывает только недостающие. Каждый поток берёт следующий кусок из очереди.
    const SEG = 300, segDir = opts.cacheDir || path.join(tmp, 'seg'), key = JSON.stringify({ N, vk, seed: plan.seed, total: plan.total, sc: plan.scenes.length });
    fs.mkdirSync(segDir, { recursive: true });
    if ((() => { try { return fs.readFileSync(path.join(segDir, 'key.json'), 'utf8'); } catch { return ''; } })() !== key) { for (const f of fs.readdirSync(segDir)) fs.rmSync(path.join(segDir, f), { force: true }); fs.writeFileSync(path.join(segDir, 'key.json'), key); }
    const segs = []; for (let a = 0; a < N; a += SEG) segs.push([a, Math.min(N, a + SEG)]);
    const segFile = a => path.join(segDir, `s${String(a).padStart(6, '0')}.mp4`);
    let done = segs.filter(([a]) => fs.existsSync(segFile(a))).reduce((x, [a, b]) => x + b - a, 0);
    if (done) console.log(`render: продолжаю с места сбоя — готово ${Math.round(done / N * 100)}%`);
    const tick = () => { if (++done % 60 === 0 && opts.onProgress) opts.onProgress(Math.min(1, done / N)); };
    const renderSeg = async (page, a, b) => {
      // упавшая вкладка или ffmpeg не отвечают вечно — ловим события и ставим предел на кадр
      let fail; const failed = new Promise((_, rej) => { fail = rej; }); failed.catch(() => {});
      const onCrash = () => fail(new Error('вкладка Chromium упала (нехватка памяти)')); page.once('crash', onCrash); page.once('close', () => fail(new Error('вкладка закрыта')));
      const part = segFile(a) + '.part.mp4';
      const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-threads', '2', '-rc-lookahead', '20', '-b:v', vk + 'k', '-maxrate', Math.round(vk * 1.5) + 'k', '-bufsize', vk * 3 + 'k',
        '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-tune', 'animation', '-pix_fmt', 'yuv420p', part], { stdio: ['pipe', 'ignore', 'inherit'] });
      ff.on('error', e => fail(e)); ff.stdin.on('error', e => fail(new Error('ffmpeg: ' + e.message)));
      const closed = new Promise(r => ff.on('close', r)); closed.then(c => { if (c) fail(new Error('ffmpeg завершился с кодом ' + c)); });
      try {
        for (let f = a; f < b; f++) {
          if (opts.signal?.aborted) throw Object.assign(new Error('STOPPED'), { stopped: true });   // сборку остановили из бота
          let to; const url = await Promise.race([page.evaluate(f => window.grab(f, .92), f), failed, new Promise((_, rej) => { to = setTimeout(() => rej(new Error('кадр не отрисовался за 60 с')), 60000); })]).finally(() => clearTimeout(to));
          if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await Promise.race([new Promise(r => ff.stdin.once('drain', r)), failed]);
          tick();
        }
        ff.stdin.end(); const code = await closed; if (code) throw new Error('ffmpeg ' + code);
        fs.renameSync(part, segFile(a));
      } catch (e) { ff.kill('SIGKILL'); fs.rmSync(part, { force: true }); throw e; }
      finally { page.off('crash', onCrash); }
    };
    const todo = segs.filter(([a]) => !fs.existsSync(segFile(a)));
    workers = Math.max(1, Math.min(workers, todo.length));
    const worker = async () => {
      let page = null;
      try {
        for (let job; (job = todo.shift());) {
          for (let attempt = 0; ; attempt++) {
            try { if (!page || page.isClosed()) { if (!browser.isConnected()) browser = await launch(); page = (await openPage(browser, plan)).page; } await renderSeg(page, ...job); break; }
            catch (e) {
              if (e.stopped) throw e;
              console.error(`render: кусок ${job[0] / SEG + 1}/${segs.length} упал (${String(e.message).slice(0, 120)}) — попытка ${attempt + 2}`);
              await page?.close().catch(() => {}); page = null;
              if (attempt >= 2) throw e;
              if (attempt === 1) { await browser.close().catch(() => {}); browser = await launch(); }   // вторая неудача — свежий браузер (почти всегда нехватка памяти)
            }
          }
        }
      } finally { await page?.close().catch(() => {}); }
    };
    await Promise.all([...Array(workers)].map(worker));
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, segs.map(([a]) => `file '${segFile(a)}'`).join('\n'));
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
    if (opts.cacheDir) fs.rmSync(opts.cacheDir, { recursive: true, force: true });   // ролик собран — куски больше не нужны
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
