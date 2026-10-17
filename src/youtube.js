// Публикация на YouTube через уже подключённые каналы проекта Bot-Connect (AI Content Factory).
// Каналы и зашифрованные refresh-токены берутся из той же базы (таблица youtube_connections),
// расшифровка и OAuth — тем же ключом и клиентом, что и в основном боте. Новое подключение не нужно.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const DATA_DIR = process.env.DATA_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const SECRETS_FILE = path.join(DATA_DIR, 'secrets.env');
// несекретные параметры базы — из .replit проекта Bot-Connect
const DB_DEFAULTS = { SUPABASE_DB_HOST: 'aws-1-eu-west-1.pooler.supabase.com', SUPABASE_DB_USER: 'postgres.idtgimgwvnbxtwjcjzev', SUPABASE_DB_PORT: '5432', SUPABASE_DB_NAME: 'postgres' };
export const SECRET_KEYS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_TOKEN_ENCRYPTION_KEY', 'SUPABASE_DB_PASSWORD', 'SUPABASE_DB_URL', 'DATABASE_URL', 'SUPABASE_DB_HOST', 'SUPABASE_DB_USER', 'SUPABASE_DB_PORT', 'SUPABASE_DB_NAME'];

// ---------- секреты: .env + data/secrets.env (то, что прислали через бота) ----------
function readSecrets() {
  const out = {};
  try { for (const l of fs.readFileSync(SECRETS_FILE, 'utf8').split('\n')) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m) out[m[1]] = m[2]; } } catch { /* нет файла */ }
  return out;
}
const env = k => process.env[k] || readSecrets()[k] || DB_DEFAULTS[k] || '';
export const secret = env;   // общий доступ к ключам из .env и data/secrets.env

/** Разбирает сообщение вида KEY=value (по строке) и сохраняет известные ключи. Возвращает список сохранённых ключей. */
export function saveSecretsFromText(text) {
  const cur = readSecrets(), saved = [];
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z_]+)\s*[=:]\s*["']?(.+?)["']?\s*$/.exec(line);
    if (m && SECRET_KEYS.includes(m[1])) { cur[m[1]] = m[2]; saved.push(m[1]); }
  }
  if (saved.length) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SECRETS_FILE, Object.entries(cur).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
    resetPool();
  }
  return saved;
}
export function missingSecrets() {
  const miss = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_TOKEN_ENCRYPTION_KEY'].filter(k => !env(k));
  if (!env('SUPABASE_DB_PASSWORD') && !env('SUPABASE_DB_URL') && !env('DATABASE_URL')) miss.push('SUPABASE_DB_PASSWORD');
  return miss;
}

// ---------- база (как getDatabaseUrl в lib/db) ----------
function databaseUrl() {
  if (env('SUPABASE_DB_PASSWORD') && env('SUPABASE_DB_HOST')) {
    const e = encodeURIComponent;
    return `postgresql://${e(env('SUPABASE_DB_USER') || 'postgres')}:${e(env('SUPABASE_DB_PASSWORD'))}@${env('SUPABASE_DB_HOST')}:${env('SUPABASE_DB_PORT') || '5432'}/${e(env('SUPABASE_DB_NAME') || 'postgres')}`;
  }
  const s = env('SUPABASE_DB_URL'); return s.startsWith('postgres') ? s : env('DATABASE_URL');
}
let pool = null;
function resetPool() { if (pool) pool.end().catch(() => {}); pool = null; }
async function query(sql, params = []) {
  const { Pool } = require('pg');
  if (!pool) pool = new Pool({ connectionString: databaseUrl(), max: 2, connectionTimeoutMillis: 15000 });
  try { return (await pool.query(sql, params)).rows; }
  catch (e) {
    if (/SSL|ssl|no pg_hba|encryption/.test(e.message) && !pool.options.ssl) { // база требует SSL — переподключаемся
      await pool.end().catch(() => {}); pool = new Pool({ connectionString: databaseUrl(), max: 2, ssl: { rejectUnauthorized: false } });
      return (await pool.query(sql, params)).rows;
    }
    throw e;
  }
}

// ---------- токены (как encryptionKey/decrypt в youtube.ts) ----------
function encryptionKey() {
  const raw = env('YOUTUBE_TOKEN_ENCRYPTION_KEY'); const key = Buffer.from(raw, 'base64');
  return key.length === 32 ? key : crypto.createHash('sha256').update(raw, 'utf8').digest();
}
function decrypt(value) {
  const [iv, tag, enc] = value.split('.'); if (!iv || !tag || !enc) throw new Error('Сохранённый токен YouTube повреждён');
  const d = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
}

export async function listChannels() {
  const rows = await query('select id, channel_id, channel_title from youtube_connections order by id');
  return rows.map(r => ({ id: Number(r.id), channelId: r.channel_id, title: r.channel_title || `Канал #${r.id}` }));
}

async function accessToken(connectionId) {
  const [row] = await query('select encrypted_refresh_token from youtube_connections where id = $1', [connectionId]);
  if (!row) throw new Error('Канал не найден');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decrypt(row.encrypted_refresh_token), client_id: env('YOUTUBE_CLIENT_ID'), client_secret: env('YOUTUBE_CLIENT_SECRET') }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (/invalid_grant/.test(JSON.stringify(j))) throw new Error('Доступ к каналу истёк или отозван — переподключите канал в основном боте.');
    throw new Error(`Google не выдал токен (${r.status}): ${j.error_description || j.error || ''}`);
  }
  return j.access_token;
}

/** Теги как в youtube.ts: без #, без повторов, не больше 500 байт и 30 штук. */
function normalizeTags(tags) {
  const out = [];
  for (const raw of tags) {
    const t = raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').trim();
    if (!t || out.includes(t) || Buffer.byteLength([...out, t].join(','), 'utf8') > 480) continue;
    out.push(t); if (out.length >= 30) break;
  }
  return out;
}

/** Загрузка (resumable upload, как uploadYoutube в youtube.ts). Возвращает id видео. */
export async function uploadVideo(connectionId, file, meta) {
  const token = await accessToken(connectionId);
  const size = fs.statSync(file).size;
  const body = {
    snippet: { title: meta.title.slice(0, 100), description: meta.description.slice(0, 5000), tags: normalizeTags(meta.tags || []), categoryId: '22', defaultLanguage: 'ru', defaultAudioLanguage: 'ru' },
    status: { privacyStatus: meta.privacy || 'public', selfDeclaredMadeForKids: false },
  };
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(size) }, body: JSON.stringify(body),
  });
  if (!init.ok) {
    const t = (await init.text()).replace(/\s+/g, ' ').slice(0, 400);
    let reason = t; try { const e = JSON.parse(t).error; reason = [e?.errors?.[0]?.reason, e?.message].filter(Boolean).join(': ') || t; } catch { /* не JSON */ }
    throw new Error(`YouTube не принял загрузку (${init.status}): ${reason}`);
  }
  const url = init.headers.get('location'); if (!url) throw new Error('YouTube не вернул адрес загрузки');
  const up = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'video/mp4', 'Content-Length': String(size) }, body: await fs.openAsBlob(file) });
  const j = await up.json().catch(() => ({}));
  if (!up.ok || !j.id) throw new Error(j.error?.message || `Загрузка на YouTube не удалась (${up.status})`);
  return { id: j.id, privacy: j.status?.privacyStatus || body.status.privacyStatus, url: `https://youtu.be/${j.id}` };
}

/** Своя обложка (нужен подтверждённый канал на YouTube; иначе вернётся ошибка — её показываем пользователю). */
export async function setThumbnail(connectionId, videoId, file) {
  const token = await accessToken(connectionId);
  const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' }, body: await fs.openAsBlob(file),
  });
  if (!r.ok) { const t = await r.text(); let msg = t.slice(0, 200); try { msg = JSON.parse(t).error?.message || msg; } catch { /* не JSON */ } throw new Error(msg); }
}
