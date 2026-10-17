// Озвучка через VoiceStudio (свой клон голоса; OpenAI-совместимый POST /v1/audio/speech).
// Каждая фраза — отдельный запрос: границы фраз известны точно (длина каждого куска), слова — по паузам внутри фразы.
// Адрес VOICESTUDIO_URL: сервис на этом же сервере (voice-server.sh → http://voicestudio:3900) или компьютер через Tailscale.
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
      const r = await fetch(`${base(url)}/v1/audio/speech`, { method: 'POST', headers: headers(token), body: JSON.stringify(body), signal: AbortSignal.timeout(900000) });
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

/**
 * Готовит образец для клона: лучший фрагмент 12–25 с, обрезанный по естественной паузе, громкость выровнена.
 * Клонирующие движки лучше работают на коротком чистом фрагменте, чем на длинной записи.
 */
export async function prepareReference(inFile, outFile) {
  const { spawn } = await import('child_process');
  const log = await new Promise((res, rej) => { const p = spawn('ffmpeg', ['-hide_banner', '-i', inFile, '-af', 'silencedetect=n=-38dB:d=0.25', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }); let e = ''; p.stderr.on('data', d => e += d); p.on('close', () => res(e)); p.on('error', rej); });
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => +m[1]), ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => +m[1]);
  const total = +(/Duration: (\d+):(\d+):([\d.]+)/.exec(log) || []).slice(1).reduce((a, v, i) => a + v * [3600, 60, 1][i], 0) || 25;
  const begin = ends.length && ends[0] < 1.5 && starts[0] < .2 ? ends[0] : 0;     // тишина в начале
  const cut = starts.filter(s => s - begin >= 12 && s - begin <= 25).pop() ?? Math.min(total, begin + 25);
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.max(0, begin - .05)), '-to', String(cut + .05), '-i', inFile, '-ac', '1', '-ar', '44100', '-af', 'loudnorm=I=-18:TP=-2:LRA=11', outFile]);
  return { begin, end: cut, seconds: +(cut - begin).toFixed(1) };
}

/** Создаёт профиль-клон в VoiceStudio из образца; возвращает id профиля. */
export async function createCloneProfile({ url, token }, file, name = 'Голос канала') {
  const fd = new FormData();
  fd.append('name', name); fd.append('kind', 'clone'); fd.append('language', 'Auto');
  fd.append('ref_audio', await fs.openAsBlob(file, { type: 'audio/wav' }), path.basename(file));
  const r = await fetch(`${base(url)}/profiles`, { method: 'POST', headers: token ? { Authorization: `Bearer ${token}` } : {}, body: fd, signal: AbortSignal.timeout(300000) });
  const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch { /* не JSON */ }
  if (!r.ok) throw new Error(`VoiceStudio не создал клон (${r.status}): ${(j.detail ? JSON.stringify(j.detail) : t).slice(0, 300)}`);
  const id = j.id || j.profile_id || j.profile?.id || j.data?.id;
  if (!id) throw new Error('VoiceStudio создал профиль, но не вернул его id — выберите голос вручную через /voicestudio');
  return String(id);
}

/** Пробная фраза голосом (для проверки клона). */
export async function voiceSample(cfg, text) { return speak(text, cfg); }
