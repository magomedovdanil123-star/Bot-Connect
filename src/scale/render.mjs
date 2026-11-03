// «Сколько нужно?» — абсурдные проекты и честные цифры. Пайплайн общий с «Рентгеном привычек» (src/body/render.mjs):
// озвучка по фразам → кадры в Chromium → голос + музыка + звуки → обложки. Отличается только движок сцен (src/scale/engine) и SEO.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderBody, bodyStills } from '../body/render.mjs';
import { bodyShorts } from '../body/shorts.mjs';

const DIR = path.dirname(fileURLToPath(import.meta.url));
export const SCALE_ENGINE = path.join(DIR, 'engine'), SCALE_BRAND = 'СКОЛЬКО НУЖНО?';
export const SCALE_LIST = JSON.parse(fs.readFileSync(path.join(DIR, 'list.json'), 'utf8'));
export const ALL_SCALE_PLAYLIST = 'Сколько нужно? — все выпуски';
const withEngine = ep => ({ ...ep, beats: [...ep.beats], eng: SCALE_ENGINE, brand: SCALE_BRAND });

export function scaleMeta(ep, chapters = []) {
  const title = (ep.ytTitle || ep.title).slice(0, 100), seen = new Set();
  const tags = [...(ep.tags || []), 'сколько нужно', 'а что если', 'безумная математика', 'научпоп', 'физика', 'цифры']
    .map(t => t.replace(/[,<>"«»]/g, ' ').replace(/\s+/g, ' ').trim()).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 25);
  const description = [ep.about || ep.title, '', ...(chapters.length >= 3 ? ['Содержание:', ...chapters, ''] : []), ...(ep.comment ? [`💬 ${ep.comment}`, ''] : []),
    ...(ep.sources?.length ? ['Расчёты и источники:', ...ep.sources.map(s => '• ' + s), ''] : []),
    '🎈 «Сколько нужно?» — берём безумный проект и честно считаем, сколько чего понадобится. Подпишись: каждый день новый абсурдный расчёт.'].join('\n');
  return { title, titles: [title, ...(ep.titles || [])].map(t => t.slice(0, 100)), tags, description, comment: ep.comment || null, playlist: ALL_SCALE_PLAYLIST };
}

/** Ролик целиком (с озвучкой — voice: { key, template }). Возвращает то же, что renderBody, но с SEO канала. */
export async function renderScale(ep, opts = {}) {
  const r = await renderBody(withEngine(ep), opts);
  return { ...r, ...scaleMeta(ep, r.chapters) };
}
export const scaleStills = (ep, work, idx, at) => bodyStills(withEngine(ep), work, idx, at);
/** Shorts 9:16 из готового выпуска: куски по ep.shorts [{ from: номер фразы, hook }], метка и хэштеги канала. */
export const scaleShorts = (ep, opts) => bodyShorts({ ...withEngine(ep), meta: scaleMeta(ep), brandSub: 'ЧЕСТНЫЕ ЦИФРЫ',
  hashtags: '#shorts #скольконужно #аесли #физика #научпоп', shortTags: ['а что если shorts', 'научпоп shorts', 'физика shorts'] }, opts);
