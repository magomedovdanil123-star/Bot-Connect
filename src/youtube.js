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
export const SECRET_KEYS = ['LUMEAN_TEMPLATE_OWL', 'LUMEAN_TEMPLATE_MOLE', 'LUMEAN_TEMPLATE_HAMSTER', 'LUMEAN_TEMPLATE_RACCOON', 'LUMEAN_TEMPLATE_WOLF', 'ANTHROPIC_API_KEY', 'ANTHROPIC_BASE_URL', 'VOICESTUDIO_URL', 'VOICESTUDIO_TOKEN', 'VOICESTUDIO_VOICE', 'VOICESTUDIO_MODEL', 'VOICESTUDIO_SPEED', 'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_TOKEN_ENCRYPTION_KEY', 'SUPABASE_DB_PASSWORD', 'SUPABASE_DB_URL', 'DATABASE_URL', 'SUPABASE_DB_HOST', 'SUPABASE_DB_USER', 'SUPABASE_DB_PORT', 'SUPABASE_DB_NAME'];

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

// как канал называется в боте, если на YouTube он подключён под старым именем (переподключать не нужно)
const CHANNEL_ALIAS = { CRYPTONYX: '📚 Книжная лавка' };
export async function listChannels() {
  const rows = await query('select id, channel_id, channel_title from youtube_connections order by id');
  return rows.map(r => ({ id: Number(r.id), channelId: r.channel_id, title: CHANNEL_ALIAS[r.channel_title] || r.channel_title || `Канал #${r.id}` }));
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
    if (/invalid_grant/.test(JSON.stringify(j))) throw new Error('Доступ к каналу истёк или отозван — переподключите канал: /youtube.');
    throw new Error(`Google не выдал токен (${r.status}): ${j.error_description || j.error || ''}`);
  }
  return j.access_token;
}

// ---------- переподключение каналов прямо из бота ----------
// Google после входа перенаправляет на страницу-визитку (cloudflare/site-worker.js, /oauth): она показывает код с кнопкой «Скопировать».
// Этот адрес должен быть в redirect URI OAuth-клиента в Google Cloud. YOUTUBE_REDIRECT_URI=http://localhost — запасной вариант (код из адресной строки).
const REDIRECT = () => env('YOUTUBE_REDIRECT_URI') || 'https://homyak.magomedov-danil123.workers.dev/oauth';
// force-ssl — чтобы оставлять комментарий автора под роликом (каналы, подключённые раньше, нужно переподключить один раз)
// yt-analytics.readonly — отчёт по кликам и досмотрам; каналы, подключённые раньше, нужно переподключить, чтобы он заработал
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/youtube.force-ssl', 'https://www.googleapis.com/auth/yt-analytics.readonly'];
function encrypt(value) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const enc = Buffer.concat([c.update(value, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map(b => b.toString('base64url')).join('.');
}
export function authUrl() {
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({ client_id: env('YOUTUBE_CLIENT_ID'), redirect_uri: REDIRECT(), response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account' });
}
/** Ссылка из адресной строки (или сам код) -> новый refresh-токен канала в базе. Возвращает { title, created }. */
export async function connectFromRedirect(text) {
  const m = /[?&]code=([^&\s]+)/.exec(text), code = m ? decodeURIComponent(m[1]) : text.trim();
  if (!/^[\w/.-]{20,}$/.test(code)) throw new Error('Не нашёл код в сообщении — пришлите код со страницы «Почти готово» (или адрес целиком с code=…)');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: /localhost/.test(text) ? 'http://localhost' : REDIRECT(), client_id: env('YOUTUBE_CLIENT_ID'), client_secret: env('YOUTUBE_CLIENT_SECRET') }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(/redirect_uri_mismatch/.test(JSON.stringify(j)) ? `В Google Cloud у OAuth-клиента не добавлен адрес ${REDIRECT()} (Credentials → клиент → Authorized redirect URIs).` : `Google не принял код (${j.error_description || j.error || r.status}). Коды одноразовые и живут пару минут — получите новый.`);
  if (!j.refresh_token) throw new Error('Google не выдал постоянный доступ — откройте ссылку ещё раз и подтвердите все разрешения.');
  const ch = await (await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', { headers: { Authorization: `Bearer ${j.access_token}` } })).json().catch(() => ({}));
  const c = ch.items?.[0]; if (!c) throw new Error('У этого аккаунта Google нет YouTube-канала (или выбран не тот аккаунт).');
  const token = encrypt(j.refresh_token), title = c.snippet?.title || c.id;
  // в окне Google галочки можно снять — тогда загрузка работает, а субтитры, плейлисты, комментарии и аналитика нет
  const missing = SCOPES.filter(x => !String(j.scope || '').split(' ').includes(x)).map(x => x.split('/').pop());
  const upd = await query('update youtube_connections set encrypted_refresh_token = $1, channel_title = $2 where channel_id = $3 returning id', [token, title, c.id]);
  if (upd.length) return { title, created: false, missing };
  // новый канал: обязательные поля, которых мы не знаем (владелец и т.п.), копируем из уже подключённого канала,
  // а первичный ключ создаём новый (иначе «duplicate key … youtube_connections_pkey»)
  const pk = await query(`select a.attname as name, format_type(a.atttypid, a.atttypmod) as type, coalesce(pg_get_expr(d.adbin, d.adrelid), nullif(a.attidentity, '')::text) as def
    from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where i.indrelid = 'youtube_connections'::regclass and i.indisprimary`);
  const pkNames = pk.map(x => x.name), q = n => '"' + n.replace(/"/g, '') + '"';
  const cols = (await query(`select column_name from information_schema.columns where table_name = 'youtube_connections' and is_nullable = 'NO' and column_default is null and is_identity = 'NO' and is_generated = 'NEVER'`)).map(x => x.column_name)
    .filter(k => !['channel_id', 'channel_title', 'encrypted_refresh_token', ...pkNames].includes(k));
  // числовой ключ задаём сами (max+1): счётчик в базе мог отстать от записей Bot-Connect — тогда автонумерация
  // выдаёт уже занятый номер («duplicate key»). После вставки подтягиваем счётчик, чтобы и Bot-Connect не споткнулся.
  // uuid/текст без значения по умолчанию — случайный; uuid с default база заполнит сама.
  const numPk = pk.filter(x => /int|numeric/.test(x.type)), pkManual = [...numPk, ...pk.filter(x => !numPk.includes(x) && !x.def)];
  const params = [c.id, title, token], pkVals = pkManual.map(x => {
    if (numPk.includes(x)) return `(select coalesce(max(${q(x.name)}), 0) + 1 from youtube_connections)`;
    params.push(crypto.randomUUID()); return `$${params.length}::${/uuid/.test(x.type) ? 'uuid' : 'text'}`;
  });
  const override = pk.some(x => x.def === 'a') ? ' overriding system value' : '';   // identity «generated always» иначе не даст задать ключ
  const names = ['channel_id', 'channel_title', 'encrypted_refresh_token', ...pkManual.map(x => x.name), ...cols].map(q).join(', ');
  const vals = ['$1', '$2', '$3', ...pkVals, ...cols.map(q)].join(', ');
  if (cols.length) await query(`insert into youtube_connections (${names})${override} select ${vals} from youtube_connections limit 1`, params);
  else await query(`insert into youtube_connections (${names})${override} values (${vals})`, params);
  for (const x of numPk) await query(`select setval(pg_get_serial_sequence('youtube_connections', '${x.name.replace(/'/g, '')}'), (select max(${q(x.name)}) from youtube_connections))`).catch(() => {});
  return { title, created: true, missing };
}
/** Проверка всех каналов: живой ли доступ. */
export async function checkChannels() {
  const out = [];
  for (const c of await listChannels()) { try { await accessToken(c.id); out.push({ ...c, ok: true }); } catch (e) { out.push({ ...c, ok: false, error: e.message }); } }
  return out;
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
    snippet: { title: meta.title.slice(0, 100), description: meta.description.slice(0, 5000), tags: normalizeTags(meta.tags || []), categoryId: meta.categoryId || '22', defaultLanguage: 'ru', defaultAudioLanguage: 'ru' },
    // publishAt — отложенный выход: до этого времени ролик приватный, потом YouTube сам открывает его
    status: meta.publishAt ? { privacyStatus: 'private', publishAt: meta.publishAt, selfDeclaredMadeForKids: false } : { privacyStatus: meta.privacy || 'public', selfDeclaredMadeForKids: false },
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

/** Просмотры и лайки роликов канала: { id: { views, likes, comments } }. */
export async function videoStats(connectionId, ids) {
  if (!ids.length) return {};
  const token = await accessToken(connectionId);
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.map(encodeURIComponent).join(',')}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `YouTube статистика: ${r.status}`);
  return Object.fromEntries((j.items || []).map(v => [v.id, { views: +v.statistics?.viewCount || 0, likes: +v.statistics?.likeCount || 0, comments: +v.statistics?.commentCount || 0, at: Date.now() }]));
}

/** Своя обложка (нужен подтверждённый канал на YouTube; иначе вернётся ошибка — её показываем пользователю). */
export async function setThumbnail(connectionId, videoId, file) {
  const token = await accessToken(connectionId);
  const r = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'image/jpeg' }, body: await fs.openAsBlob(file),
  });
  if (!r.ok) { const t = await r.text(); let msg = t.slice(0, 200); try { msg = JSON.parse(t).error?.message || msg; } catch { /* не JSON */ } throw new Error(msg); }
}

// ---------- тренды ниши: самые просматриваемые свежие Shorts по запросам (для радара тем) ----------
const unhtml = s => String(s).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
export async function nicheTrends(queries = ['как накопить деньги', 'заработок в интернете', 'как экономить деньги', 'подработка'], { days = 7, per = 8 } = {}) {
  const conns = await listChannels(); let token = null;
  for (const c of conns) { try { token = await accessToken(c.id); break; } catch { /* следующий канал */ } }
  if (!token) throw new Error('нет доступа ни к одному каналу YouTube');
  const H = { Authorization: `Bearer ${token}` }, after = new Date(Date.now() - days * 864e5).toISOString(), found = new Map();
  for (const q of queries) {
    const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({ part: 'snippet', type: 'video', q, order: 'viewCount', publishedAfter: after, regionCode: 'RU', relevanceLanguage: 'ru', videoDuration: 'short', maxResults: String(per) }), { headers: H });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `YouTube поиск: ${r.status}`);
    for (const it of j.items || []) if (it.id?.videoId) found.set(it.id.videoId, { id: it.id.videoId, title: unhtml(it.snippet.title).replace(/#\S+/g, '').trim(), query: q });
  }
  if (!found.size) return [];
  const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${[...found.keys()].slice(0, 50).join(',')}`, { headers: H });
  const j = await r.json().catch(() => ({}));
  for (const v of j.items || []) found.get(v.id).views = +v.statistics?.viewCount || 0;
  return [...found.values()].filter(x => x.title.length > 8).sort((a, b) => (b.views || 0) - (a.views || 0));
}

/** Названия последних роликов канала (до 200, включая запланированные и выложенные вручную) — чтобы не выложить тему второй раз.
 *  Список «Загрузки» канала: 1 единица квоты на 50 роликов. */
export async function channelTitles(connectionId) {
  const [c] = await query('select channel_id from youtube_connections where id = $1', [connectionId]); if (!c?.channel_id) return [];
  const token = await accessToken(connectionId), out = [];
  for (let page = '', i = 0; i < 4; i++) {
    const r = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?' + new URLSearchParams({ part: 'snippet', playlistId: 'UU' + c.channel_id.slice(2), maxResults: '50', ...(page ? { pageToken: page } : {}) }), { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `YouTube загрузки: ${r.status}`);
    for (const it of j.items || []) out.push({ id: it.snippet?.resourceId?.videoId, title: unhtml(it.snippet?.title || '') });
    page = j.nextPageToken; if (!page) break;
  }
  return out;
}

/** Ролики канала с настоящим временем выхода (сверка автопилота с YouTube: что удалено, перенесено, выложено вручную).
 *  Загрузки канала + статусы: ~2 единицы квоты на 50 роликов. → [{ id, title, publishAt (запланирован), publishedAt, privacy }] */
export async function channelVideos(connectionId) {
  const list = await channelTitles(connectionId); if (!list.length) return [];
  const token = await accessToken(connectionId), out = [];
  for (let i = 0; i < list.length; i += 50) {
    const ids = list.slice(i, i + 50).map(v => v.id).filter(Boolean);
    const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=status,snippet&id=${ids.join(',')}`, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `YouTube ролики: ${r.status}`);
    for (const v of j.items || []) out.push({ id: v.id, title: unhtml(v.snippet?.title || ''), publishAt: v.status?.publishAt || null, publishedAt: v.snippet?.publishedAt || null, privacy: v.status?.privacyStatus });
  }
  return out;
}

/** Ролик в плейлист канала по названию (нет такого — создаём публичный). Плейлисты серий держат зрителя дольше и сами находятся в поиске. */
const playlistIds = new Map();
export async function addToPlaylist(connectionId, videoId, title, description = '') {
  const token = await accessToken(connectionId), H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, key = connectionId + '\n' + title;
  const api = async (url, body) => { const r = await fetch('https://www.googleapis.com/youtube/v3/' + url, body ? { method: 'POST', headers: H, body: JSON.stringify(body) } : { headers: H }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `YouTube плейлист: ${r.status}`); return j; };
  let id = playlistIds.get(key);
  for (let page = '', i = 0; !id && i < 5; i++) {
    const j = await api('playlists?' + new URLSearchParams({ part: 'snippet', mine: 'true', maxResults: '50', ...(page ? { pageToken: page } : {}) }));
    id = (j.items || []).find(x => x.snippet?.title === title)?.id; page = j.nextPageToken; if (!page) break;
  }
  if (!id) id = (await api('playlists?part=snippet,status', { snippet: { title: title.slice(0, 150), description, defaultLanguage: 'ru' }, status: { privacyStatus: 'public' } })).id;
  playlistIds.set(key, id);
  await api('playlistItems?part=snippet', { snippet: { playlistId: id, resourceId: { kind: 'youtube#video', videoId } } });
  return id;
}

/** Комментарий автора под роликом («Отметь своего Крота…»). Нужен доступ youtube.force-ssl — иначе ошибка с подсказкой переподключить. */
export async function postComment(connectionId, videoId, text) {
  const token = await accessToken(connectionId);
  const r = await fetch('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ snippet: { videoId, topLevelComment: { snippet: { textOriginal: text.slice(0, 9000) } } } }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const why = j.error?.errors?.[0]?.reason || ''; throw new Error(/insufficient|forbidden|scope/i.test(why + (j.error?.message || '')) && r.status === 403 ? 'нет разрешения на комментарии — переподключите канал: /youtube' : j.error?.message || `YouTube комментарий: ${r.status}`); }
  return j.id;
}

/** Свои субтитры (SRT) к ролику — точный текст диктора вместо автоматических. */
export async function uploadCaptions(connectionId, videoId, srtFile, { language = 'ru', name = 'Русский' } = {}) {
  const token = await accessToken(connectionId), B = 'cap' + Date.now();
  const body = Buffer.concat([Buffer.from(`--${B}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ snippet: { videoId, language, name, isDraft: false } })}\r\n--${B}\r\nContent-Type: application/octet-stream\r\n\r\n`), fs.readFileSync(srtFile), Buffer.from(`\r\n--${B}--`)]);
  const r = await fetch('https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&uploadType=multipart', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${B}` }, body });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `YouTube субтитры: ${r.status}`); return j.id;
}

// ---------- аналитика: клики по обложке (Reporting API, отчёт channel_reach_basic_a1) и досмотры (Analytics API) ----------
const REACH = 'channel_reach_basic_a1';
async function rapi(token, url, body) {
  const r = await fetch('https://youtubereporting.googleapis.com/v1/' + url, body ? { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(/insufficient|scope/i.test(j.error?.message || '') ? 'нет доступа к аналитике — переподключите канал: /youtube' : j.error?.message || `YouTube Reporting: ${r.status}`); return j;
}
/** Заказываем ежедневный отчёт о показах обложек (один раз на канал; данные идут с момента заказа, первый отчёт — через 1–2 дня). */
export async function ensureReachJob(connectionId) {
  const token = await accessToken(connectionId), jobs = (await rapi(token, 'jobs')).jobs || [];
  return jobs.find(j => j.reportTypeId === REACH)?.id || (await rapi(token, 'jobs', { reportTypeId: REACH, name: 'motion-bot reach' })).id;
}
/** Показы обложки и CTR по роликам: { videoId: { impressions, ctr } } за всё, что накопилось в отчётах. */
export async function reachStats(connectionId, videoIds) {
  const token = await accessToken(connectionId), job = await ensureReachJob(connectionId), want = new Set(videoIds), acc = {};
  const reps = (await rapi(token, `jobs/${job}/reports`)).reports || [];
  for (const rep of reps.slice(0, 30)) {
    const r = await fetch(rep.downloadUrl, { headers: { Authorization: `Bearer ${token}` } }); if (!r.ok) continue;
    const [head, ...rows] = (await r.text()).trim().split('\n'), cols = head.split(','), iv = cols.indexOf('video_id'), ii = cols.indexOf('video_thumbnail_impressions'), ic = cols.indexOf('video_thumbnail_impressions_ctr');
    for (const row of rows) { const c = row.split(','); if (!want.has(c[iv])) continue; const a = acc[c[iv]] ||= { impressions: 0, clicks: 0 }, n = +c[ii] || 0; a.impressions += n; a.clicks += n * (+c[ic] || 0); }
  }
  return Object.fromEntries(Object.entries(acc).map(([id, a]) => [id, { impressions: a.impressions, ctr: a.impressions ? a.clicks / a.impressions : 0 }]));
}
/** Досмотры ролика: средний процент и время, подписки и кривая удержания (100 точек: доля длины → доля зрителей). */
export async function retentionStats(connectionId, videoId, startDate) {
  const token = await accessToken(connectionId), end = new Date().toISOString().slice(0, 10);
  const q = async params => { const r = await fetch('https://youtubeanalytics.googleapis.com/v2/reports?' + new URLSearchParams({ ids: 'channel==MINE', startDate, endDate: end, filters: `video==${videoId}`, ...params }), { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(/insufficient|scope|forbidden/i.test(j.error?.message || '') ? 'нет доступа к аналитике — переподключите канал: /youtube' : j.error?.message || `YouTube Analytics: ${r.status}`); return j.rows || []; };
  const [tot] = await q({ metrics: 'views,averageViewDuration,averageViewPercentage,subscribersGained,likes,comments' });
  const curve = await q({ metrics: 'audienceWatchRatio', dimensions: 'elapsedVideoTimeRatio' }).catch(() => []);
  return tot ? { views: tot[0], avgSec: tot[1], avgPct: tot[2], subs: tot[3], likes: tot[4], comments: tot[5], curve: curve.map(r => [r[0], r[1]]) } : null;
}

/** Поиск видео с просмотрами и датой (для оценки спроса на книгу). Стоит ~101 единицы квоты из 10 000 в сутки. */
export async function searchVideos(q, { max = 10 } = {}) {
  let token = null; for (const c of await listChannels()) { try { token = await accessToken(c.id); break; } catch { /* следующий канал */ } }
  if (!token) throw new Error('нет доступа ни к одному каналу YouTube');
  const H = { Authorization: `Bearer ${token}` };
  const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + new URLSearchParams({ part: 'snippet', type: 'video', q, regionCode: 'RU', relevanceLanguage: 'ru', maxResults: String(max) }), { headers: H });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error?.message || `YouTube поиск: ${r.status}`);
  const ids = (j.items || []).map(it => it.id?.videoId).filter(Boolean); if (!ids.length) return [];
  const v = await (await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids.join(',')}`, { headers: H })).json().catch(() => ({}));
  return (v.items || []).map(x => ({ id: x.id, title: unhtml(x.snippet.title), views: +x.statistics?.viewCount || 0, publishedAt: x.snippet.publishedAt }));
}
