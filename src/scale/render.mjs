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
export const WHATIF_PLAYLIST = 'Что если… — все выпуски';   // COINORA, формат «стикмены» (engine: 'toon')
const withEngine = ep => ({ ...ep, beats: [...ep.beats], eng: SCALE_ENGINE, brand: SCALE_BRAND });

export function scaleMeta(ep, chapters = []) {
  const title = (ep.ytTitle || ep.title).slice(0, 100), seen = new Set();
  const toon = ep.engine === 'toon', tags = [...(ep.tags || []), ...(toon ? ['что если', 'а что если', 'анимация', 'стикмены', 'мультик', 'научпоп'] : ['сколько нужно', 'а что если', 'безумная математика', 'научпоп', 'физика', 'цифры'])]
    .map(t => t.replace(/[,<>"«»]/g, ' ').replace(/\s+/g, ' ').trim()).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())).slice(0, 25);
  const description = [ep.about || ep.title, '', ...(chapters.length >= 3 ? ['Содержание:', ...chapters, ''] : []), ...(ep.comment ? [`💬 ${ep.comment}`, ''] : []),
    ...(ep.sources?.length ? [toon ? 'Факты и источники:' : 'Расчёты и источники:', ...ep.sources.map(s => '• ' + s), ''] : []),
    toon ? '🎬 COINORA · «Что если…» — проживаем самые безумные «а что если» вместе с героем: с живыми диалогами, цифрами и настоящими фактами. Подпишись, чтобы не пропустить новую историю.'
      : '🎈 «Сколько нужно?» — берём безумный проект и честно считаем, сколько чего понадобится. Подпишись: каждый день новый абсурдный расчёт.'].join('\n');
  return { title, titles: [title, ...(ep.titles || [])].map(t => t.slice(0, 100)), tags, description, comment: ep.comment || null, playlist: toon ? WHATIF_PLAYLIST : ALL_SCALE_PLAYLIST };
}

/** Ролик целиком (с озвучкой — voice: { key, template }). Возвращает то же, что renderBody, но с SEO канала. */
export async function renderScale(ep, opts = {}) {
  const r = await renderBody(withEngine(ep), opts);
  return { ...r, ...scaleMeta(ep, r.chapters) };
}
export const scaleStills = (ep, work, idx, at) => bodyStills(withEngine(ep), work, idx, at);
/** Shorts 9:16 из готового выпуска: куски по ep.shorts [{ from: номер фразы, hook }], метка и хэштеги канала. */
export const scaleShorts = (ep, opts) => bodyShorts({ ...withEngine(ep), ...(ep.engine === 'toon' ? { brand: 'ЧТО ЕСЛИ…' } : {}), meta: scaleMeta(ep), brandSub: ep.engine === 'toon' ? 'COINORA' : 'ЧЕСТНЫЕ ЦИФРЫ',
  hashtags: ep.engine === 'toon' ? '#shorts #чтоесли #аесли #анимация #стикмены' : '#shorts #скольконужно #аесли #физика #научпоп', shortTags: ep.engine === 'toon' ? ['что если shorts', 'анимация shorts', 'стикмены shorts'] : ['а что если shorts', 'научпоп shorts', 'физика shorts'] }, opts);
