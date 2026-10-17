// Озвучка через VoiceStudio (программа на компьютере пользователя; OpenAI-совместимый POST /v1/audio/speech).
// Каждая фраза — отдельный запрос: границы фраз известны точно (длина каждого куска), слова — по паузам внутри фразы.
// Сервер достаёт до компьютера по адресу VOICESTUDIO_URL (например, через Tailscale: http://100.x.y.z:порт).
import fs from 'fs';
import path from 'path';
import { alignSentences, run } from './voice.js';

const GAP = .45;   // пауза между фразами, сек

function headers(token) { return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }; }
const base = url => url.replace(/\/+$/, '');

/** Проверка, что программа доступна: true/false за 6 секунд. */
export async function voiceStudioAlive({ url, token }) {
  try { const r = await fetch(`${base(url)}/health`, { headers: headers(token), signal: AbortSignal.timeout(6000) }); return r.ok; } catch { return false; }
}
/** Список голосов (профилей) для выбора. */
export async function voiceStudioVoices({ url, token }) {
  const r = await fetch(`${base(url)}/v1/audio/voices`, { headers: headers(token), signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`VoiceStudio: список голосов недоступен (${r.status})`);
  const j = await r.json(); const list = Array.isArray(j) ? j : j.voices || j.data || [];
  return list.map(v => typeof v === 'string' ? { id: v, name: v } : { id: v.id || v.voice_id || v.name, name: v.name || v.id || '' });
}

async function speak(text, { url, token, voice, model, speed }) {
  const body = { model: model || 'omnivoice', input: text, voice: voice || 'default', response_format: 'wav', language: 'ru', speed: speed || 1, seed: 42 };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${base(url)}/v1/audio/speech`, { method: 'POST', headers: headers(token), body: JSON.stringify(body), signal: AbortSignal.timeout(300000) });
      if (!r.ok) { const t = (await r.text()).slice(0, 300); throw new Error(`VoiceStudio ${r.status}: ${t}`); }
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { if (attempt === 2) throw e; await new Promise(res => setTimeout(res, 2000 * (attempt + 1))); }
  }
}

/** Тот же контракт, что synthesize() у Lumean: { file, timings:[{start,dur,speak,words}], total } */
export async function synthesizeVoiceStudio(sentences, { url, token, voice, model, speed, dir, onStatus }) {
  const clips = [];
  for (const [i, s] of sentences.entries()) {
    onStatus?.('VoiceStudio', Math.round(i / sentences.length * 100), 1, 1);
    const raw = path.join(dir, `vs_${i}.raw.wav`), wav = path.join(dir, `vs_${i}.wav`);
    fs.writeFileSync(raw, await speak(s.replace(/\s+/g, ' ').trim(), { url, token, voice, model, speed }));
    await run('ffmpeg', ['-y', '-v', 'error', '-i', raw, '-ac', '1', '-ar', '48000', wav]);
    const a = await alignSentences(wav, [s]);
    clips.push({ wav, a: a.sentences[0], total: a.total });
  }
  onStatus?.('VoiceStudio', 100, 1, 1);
  // склейка: фразы подряд с паузой; тайминги сдвигаем на начало каждого куска
  const out = path.join(dir, 'voice.wav'), gap = path.join(dir, 'vs_gap.wav'), list = path.join(dir, 'vs_list.txt');
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', String(GAP), gap]);
  fs.writeFileSync(list, clips.flatMap((c, i) => i ? [`file '${gap}'`, `file '${c.wav}'`] : [`file '${c.wav}'`]).join('\n'));
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'pcm_s16le', out]);
  const timings = []; let offset = 0;
  clips.forEach((c, i) => {
    const start = offset + c.a.start;
    timings.push({ start, speak: c.a.speak, words: c.a.words, dur: 0 });
    offset += c.total + (i < clips.length - 1 ? GAP : 0);
  });
  timings.forEach((t, i) => { t.dur = i < timings.length - 1 ? timings[i + 1].start - t.start : offset - t.start + .5; });
  return { file: out, timings, total: offset };
}
