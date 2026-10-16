// Озвучка через Lumean по шаблону пользователя + тайминги фраз по паузам в аудио.
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const BASE = 'https://api.lumean.app/api/public';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function api(key, method, p, body) {
  const r = await fetch(BASE + p, { method, headers: { 'X-API-KEY': key, Accept: 'application/json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Lumean ${method} ${p} -> ${r.status}: ${j.message || ''} ${j.reason || ''}`.trim());
  return j.data;
}

/** Озвучивает фразы одним заказом. Между фразами — бесплатные паузы {{pause=0.8}}, по ним потом режем тайминги. */
export async function synthesize(sentences, { key, template, dir, onStatus }) {
  const text = sentences.map(s => s.replace(/[\[\]]/g, '')).join(' {{pause=0.8}}\n\n');
  const order = await api(key, 'POST', '/orders', { template_id: template, input_text: text, name: 'motion-bot voiceover' });
  let d;
  for (;;) {
    d = await api(key, 'GET', `/orders/${order.id}`);
    onStatus?.(d.status, d.progress_percent);
    if (['completed', 'result_delivered', 'partially_completed', 'failed', 'cancelled', 'compensated'].includes(d.status)) break;
    await sleep(8000);
  }
  if (!d.result?.files?.length) throw new Error('Озвучка не удалась: статус ' + d.status);
  const { url } = await api(key, 'POST', '/storage/url', { path: d.result.files[0] });
  const file = path.join(dir, 'voice' + (path.extname(d.result.files[0]) || '.mp3'));
  fs.writeFileSync(file, Buffer.from(await (await fetch(url)).arrayBuffer()));
  return file;
}

function silences(file) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-i', file, '-af', 'silencedetect=n=-38dB:d=0.35', '-f', 'null', '-']);
    let err = ''; p.stderr.on('data', x => err += x);
    p.on('close', () => {
      const out = []; let st = null;
      for (const l of err.split('\n')) {
        let m = /silence_start: ([\d.]+)/.exec(l); if (m) st = +m[1];
        m = /silence_end: ([\d.]+)/.exec(l); if (m && st != null) { out.push({ s: st, e: +m[1] }); st = null; }
      }
      const dm = /Duration: (\d+):(\d+):([\d.]+)/.exec(err);
      res({ sil: out, total: dm ? +dm[1] * 3600 + +dm[2] * 60 + +dm[3] : 0 });
    });
    p.on('error', rej);
  });
}

/** Возвращает [{start, dur, speak}] для каждой фразы (секунды от начала аудио). */
export async function timingsFromAudio(file, sentences) {
  const { sil, total } = await silences(file);
  const n = sentences.length;
  const lead = sil.find(x => x.s < .05)?.e || 0;
  const inner = sil.filter(x => x.s > lead + .3 && x.e < total - .2);
  // N-1 самых длинных пауз = границы фраз
  let cuts = [...inner].sort((a, b) => (b.e - b.s) - (a.e - a.s)).slice(0, n - 1).sort((a, b) => a.s - b.s);
  if (cuts.length < n - 1) { // запасной вариант: делим пропорционально длине текста
    const chars = sentences.map(s => s.length), sum = chars.reduce((a, b) => a + b, 0); let acc = 0;
    cuts = chars.slice(0, -1).map(c => { acc += c; const tt = lead + (total - lead) * acc / sum; return { s: tt - .2, e: tt + .2 }; });
  }
  const res = [];
  for (let i = 0; i < n; i++) {
    const start = i === 0 ? Math.max(0, lead - .15) : cuts[i - 1].e - .15;
    const end = i < n - 1 ? cuts[i].e - .15 : total + .4;
    const speakEnd = i < n - 1 ? cuts[i].s : total;
    res.push({ start, dur: end - start, speak: Math.max(.5, speakEnd - start) });
  }
  return { timings: res, total };
}
