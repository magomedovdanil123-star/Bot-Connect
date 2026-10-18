// Цифры фабрики: какие ролики набирают просмотры, сколько людей пришло в Telegram и по каким ссылкам.
// Отсюда недельный отчёт и «самообучение»: рубрики с лучшими просмотрами фабрика ставит чаще.
import fs from 'fs';
import path from 'path';
import { videoStats } from './youtube.js';

const file = dir => path.join(dir, 'stats.json');
export function loadStats(dir) { try { return { videos: [], views: {}, tg: [], joins: {}, links: {}, ...JSON.parse(fs.readFileSync(file(dir), 'utf8')) }; } catch { return { videos: [], views: {}, tg: [], joins: {}, links: {} }; } }
export function saveStats(dir, st) { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file(dir), JSON.stringify(st)); }

/** Опубликованный ролик: id на YouTube, канал, рубрика (для самообучения). */
export function recordVideo(dir, v) { const st = loadStats(dir); st.videos.push({ ...v, at: Date.now() }); saveStats(dir, st); }
/** Вступление в Telegram-канал по пригласительной ссылке (имя ссылки = YouTube-канал). */
export function recordJoin(dir, name) { const st = loadStats(dir), d = new Date().toISOString().slice(0, 10); (st.joins[name] ||= {})[d] = (st.joins[name][d] || 0) + 1; saveStats(dir, st); }

/** Свежие просмотры и лайки роликов за последние 60 дней + снимок числа подписчиков Telegram. */
export async function refreshStats(dir, { tgMembers = null } = {}) {
  const st = loadStats(dir), recent = st.videos.filter(v => Date.now() - v.at < 60 * 864e5), byConn = {};
  for (const v of recent) (byConn[v.conn] ||= []).push(v.id);
  const errors = [];
  for (const [conn, ids] of Object.entries(byConn)) {
    for (let i = 0; i < ids.length; i += 50) {
      try { Object.assign(st.views, await videoStats(Number(conn), ids.slice(i, i + 50))); } catch (e) { errors.push(e.message); }
    }
  }
  if (tgMembers != null) { const d = new Date().toISOString().slice(0, 10); st.tg = [...st.tg.filter(x => x.day !== d), { day: d, members: tgMembers }].slice(-120); }
  saveStats(dir, st);
  return { st, errors };
}

const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
/** Средние просмотры по рубрикам (ролики старше 2 суток — успели набрать, не старше 30). */
export function seriesViews(st) {
  const out = {};
  for (const v of st.videos) {
    const age = Date.now() - v.at; if (!v.series || age < 2 * 864e5 || age > 30 * 864e5 || !st.views[v.id]) continue;
    (out[v.series] ||= []).push(st.views[v.id].views);
  }
  return Object.fromEntries(Object.entries(out).map(([k, a]) => [k, { avg: Math.round(avg(a)), n: a.length }]));
}
/** Веса рубрик для фабрики: сильные чаще, слабые реже, но не до нуля (новые темы тоже нужно пробовать). */
export function seriesWeights(st) {
  const sv = seriesViews(st), known = Object.values(sv).filter(x => x.n >= 2);
  if (known.length < 3) return null;   // мало данных — обычная очередь
  const mean = avg(known.map(x => x.avg)) || 1;
  return Object.fromEntries(Object.entries(sv).filter(([, x]) => x.n >= 2).map(([k, x]) => [k, Math.max(.35, Math.min(3, x.avg / mean))]));
}

/** Текст отчёта (HTML для Telegram). names — человеческие названия рубрик. */
export function buildReport(st, names = {}, days = 7) {
  const since = Date.now() - days * 864e5, vids = st.videos.filter(v => v.at >= since);
  const esc = s => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const views = vids.reduce((a, v) => a + (st.views[v.id]?.views || 0), 0), likes = vids.reduce((a, v) => a + (st.views[v.id]?.likes || 0), 0);
  const top = [...vids].filter(v => st.views[v.id]).sort((a, b) => st.views[b.id].views - st.views[a.id].views).slice(0, 3);
  const sv = Object.entries(seriesViews(st)).sort((a, b) => b[1].avg - a[1].avg);
  const tg = st.tg.filter(x => new Date(x.day).getTime() >= since - 864e5), dTg = tg.length >= 2 ? tg[tg.length - 1].members - tg[0].members : null;
  const day0 = new Date(since).toISOString().slice(0, 10), joins = Object.entries(st.joins).map(([n, d]) => [n, Object.entries(d).filter(([k]) => k >= day0).reduce((a, [, c]) => a + c, 0)]).filter(([, c]) => c).sort((a, b) => b[1] - a[1]);
  const w = seriesWeights(st);
  return `📊 <b>Отчёт за ${days} дней</b>\n\n` +
    `🎬 Роликов: <b>${vids.length}</b> · 👁 просмотров: <b>${views.toLocaleString('ru')}</b> · 👍 ${likes.toLocaleString('ru')}\n` +
    (tg.length ? `📲 Telegram: <b>${tg[tg.length - 1].members}</b> подписчиков${dTg != null ? ` (${dTg >= 0 ? '+' : ''}${dTg} за период)` : ''}\n` : '') +
    (joins.length ? `\n<b>Пришли в Telegram по ссылкам:</b>\n${joins.map(([n, c]) => `▫️ ${esc(n)} — ${c}`).join('\n')}\n` : '') +
    (top.length ? `\n<b>Топ роликов:</b>\n${top.map((v, i) => `${i + 1}. ${esc(v.title || v.id)} — ${st.views[v.id].views.toLocaleString('ru')} 👁 (https://youtu.be/${v.id})`).join('\n')}\n` : '') +
    (sv.length ? `\n<b>Рубрики (средние просмотры):</b>\n${sv.map(([k, x]) => `▫️ ${esc(names[k] || k)} — ${x.avg.toLocaleString('ru')} (роликов: ${x.n})`).join('\n')}\n` : '') +
    (w ? `\n🧠 Фабрика подстроилась: лидеры выходят чаще, слабые реже.` : `\n🧠 Для самообучения нужно хотя бы по 2 ролика в 3 рубриках (старше 2 суток).`);
}
