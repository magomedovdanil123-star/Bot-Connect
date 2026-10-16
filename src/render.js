// План -> MP4. Кадры рисует Chromium (Playwright), кодирует ffmpeg, параллельно в несколько потоков.
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

const run = (cmd, args) => new Promise((res, rej) => { const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let err = ''; p.stderr.on('data', d => err += d); p.on('close', c => c ? rej(new Error(cmd + ' ' + c + ': ' + err.slice(-500))) : res(err)); });

async function openPage(browser, plan) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('PAGE:', e.message));
  await page.goto('file://' + path.join(DIR, 'engine', 'index.html'));
  await page.evaluate(() => window.fontsReady());
  const info = await page.evaluate(p => window.loadPlan(p), plan);
  return { page, info };
}

/**
 * @param plan      результат buildPlan (+ опционально тайминги из озвучки)
 * @param out       путь к итоговому mp4
 * @param opts.audio путь к аудио (необязательно), opts.audioOffset — сдвиг в секундах
 * @param opts.maxMB лимит размера файла (Telegram — 50 МБ)
 * @param opts.onProgress(0..1)
 */
export async function renderVideo(plan, out, opts = {}) {
  const workers = opts.workers || Math.max(1, Math.min(6, os.cpus().length));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--disable-gpu', '--no-sandbox', '--force-color-profile=srgb'] });
  try {
    const { page: p0, info } = await openPage(browser, plan); await p0.close();
    const N = info.frames, per = Math.ceil(N / workers), dur = N / 30;
    const maxMB = opts.maxMB || 48, audioK = opts.audio ? 128 : 0;
    const vk = Math.max(400, Math.min(6000, Math.floor((maxMB * 8 * 1024 * .94) / dur - audioK)));
    let done = 0;
    await Promise.all([...Array(workers).keys()].map(async w => {
      const a = w * per, b = Math.min(N, a + per); if (a >= b) return;
      const { page } = await openPage(browser, plan);
      const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-',
        '-c:v', 'libx264', '-preset', 'medium', '-b:v', vk + 'k', '-maxrate', Math.round(vk * 1.5) + 'k', '-bufsize', vk * 3 + 'k',
        '-tune', 'animation', '-pix_fmt', 'yuv420p', path.join(tmp, `p${w}.mp4`)], { stdio: ['pipe', 'ignore', 'inherit'] });
      for (let f = a; f < b; f++) {
        const url = await page.evaluate(f => window.grab(f, .92), f);
        if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
        if (++done % 60 === 0 && opts.onProgress) opts.onProgress(done / N);
      }
      ff.stdin.end(); await new Promise(r => ff.on('close', r)); await page.close();
    }));
    const list = path.join(tmp, 'list.txt');
    fs.writeFileSync(list, [...Array(workers).keys()].filter(w => fs.existsSync(path.join(tmp, `p${w}.mp4`))).map(w => `file 'p${w}.mp4'`).join('\n'));
    const args = ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list];
    if (opts.audio) args.push('-itsoffset', String(opts.audioOffset || 0), '-i', opts.audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', audioK + 'k', '-shortest');
    args.push('-c:v', 'copy', '-movflags', '+faststart', out);
    await run('ffmpeg', args);
    if (opts.onProgress) opts.onProgress(1);
    return { file: out, duration: dur, sizeMB: fs.statSync(out).size / 1048576, scenes: info.scenes };
  } finally {
    await browser.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
