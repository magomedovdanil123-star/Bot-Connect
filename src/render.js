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
  const workers = opts.workers || Math.max(1, Math.min(6, os.cpus().length));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--disable-gpu', '--no-sandbox', '--force-color-profile=srgb'] });
  try {
    const { page: p0, info } = await openPage(browser, plan); await p0.close();
    const N = info.frames, per = Math.ceil(N / workers), dur = N / 30;
    const maxMB = opts.maxMB || Number(process.env.MAX_VIDEO_MB) || 48, audioK = 160;
    // качество важнее размера: если в один файл влезает только «мыло», режем ролик на части
    const fitK = Math.floor((maxMB * 8 * 1024 * .92) / dur - audioK);
    const split = fitK < 1800;
    const vk = split ? 2400 : Math.min(5000, fitK);
    let done = 0;
    await Promise.all([...Array(workers).keys()].map(async w => {
      const a = w * per, b = Math.min(N, a + per); if (a >= b) return;
      const { page } = await openPage(browser, plan);
      const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-b:v', vk + 'k', '-maxrate', Math.round(vk * 1.5) + 'k', '-bufsize', vk * 3 + 'k',
        '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-tune', 'animation', '-pix_fmt', 'yuv420p', path.join(tmp, `p${w}.mp4`)], { stdio: ['pipe', 'ignore', 'inherit'] });
      for (let f = a; f < b; f++) {
        const url = await page.evaluate(f => window.grab(f, .92), f);
        if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
        if (++done % 60 === 0 && opts.onProgress) opts.onProgress(done / N);
      }
      ff.stdin.end(); await new Promise(r => ff.on('close', r)); await page.close();
    }));
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
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
