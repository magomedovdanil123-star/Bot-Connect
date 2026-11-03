// Упаковка роликов (docs/packaging.md): правила для нейросети + автопроверка сценария (название, обложки, первая фраза).
// Проверка не меняет сценарий — только подсказывает. Запуск: node src/packaging.mjs [путь к сценарию …] (без аргументов — все сценарии всех каналов).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// коротко — для подсказки нейросети (system prompt). Полная версия с примерами — docs/packaging.md
export const PACKAGING_RULES = `УПАКОВКА (обязательно):
— Название: до 50 символов, суть в первых 40; обращение на «ты»; одно слово КАПСОМ (максимум одно-два); боль, тайна или конфликт сильнее позитива («Ты просыпаешься в 3 ночи не просто так», «Это не лень. Это защита», «Ошибка, которую делают все»). Цифра в названии — только если сама по себе шок. Поисковый запрос (название книги, имя автора) — в начале, если ролик ищут.
— 3 названия для теста: разные обещания (тайна / ошибка / последствие), а не перестановка слов.
— Обложка: 1–3 слова крупно (максимум 4), одна точка внимания, сильная эмоция или предмет-символ, визуальный вопрос, на который отвечает ролик. Текст обложки НЕ повторяет название, а дополняет его. 3 обложки — 3 разные идеи: символ без лица / персонаж с эмоцией / вопрос крупно.
— Кликбейт можно, обман нельзя: каждое громкое слово названия и обложки раскрыто в ролике (YouTube сравнивает обещание с содержанием).
— Первые 5 секунд подтверждают обещание обложки (тот же образ + шок-факт или вопрос), без «привет», «сегодня», «в этом видео». К 15-й секунде — что зритель получит и почему это про него. К 30-й — открытая петля («последний пункт — самый опасный», «в конце покажу…»).
— Ролики одного канала не должны быть копиями по шаблону: меняй открытие, структуру и идею обложек (правило YouTube о неаутентичном контенте).`;

const words = s => String(s || '').replace(/[«»"!?.,:;…—–-]/g, ' ').split(/\s+/).filter(Boolean);
const norm = s => String(s || '').toLowerCase().replace(/[^а-яёa-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
// большой текст каждой обложки — у каналов разные поля: lines [[t,k]] (Подвал, Рентген, 3D), thumbs.lines / top+result (книги, Психофакт)
export function coverTexts(ep) {
  const out = [], line = l => (Array.isArray(l) ? l[0] : l);
  for (const c of ep.covers3d || []) out.push((c.lines || []).map(line).join(' '));
  for (const c of ep.thumbs || []) out.push([c.top, ...(c.lines || []).map(line), c.result].filter(Boolean).join(' '));
  if (!ep.thumbs) for (const c of ep.covers || []) if (c.lines) out.push(c.lines.map(line).join(' '));
  return out.filter(Boolean);
}
export function firstLine(ep) {
  if (ep.beats?.length) return ep.beats[0].text || '';
  if (ep.screens?.length) return ep.screens[0].lines?.[0] || '';
  return '';
}

export function checkPackaging(ep) {
  const err = [], warn = [], t = ep.ytTitle || '', search = !!ep.author;   // книги и разборы: в начале названия — поисковый запрос, лимит мягче
  if (!t) err.push('нет названия ytTitle');
  else {
    if (t.length > 100) err.push(`название ${t.length} символов — YouTube обрежет до 100`);
    else if (t.length > (search ? 75 : 55)) warn.push(`название ${t.length} символов — на телефоне хвост обрежется (цель ≤ ${search ? 70 : 50})`);
    const caps = words(t).filter(w => w.length >= 3 && w === w.toUpperCase() && /[А-ЯЁA-Z]/.test(w));
    if (caps.length > 2) warn.push(`в названии ${caps.length} слов КАПСОМ — оставь одно`);
  }
  if ((ep.titles || []).length < 2) warn.push('нужно ещё 2 названия для теста (titles)');
  const cv = coverTexts(ep);
  if (cv.length && cv.length < 3) warn.push(`обложек ${cv.length} — для теста нужно 3 разные идеи`);
  cv.forEach((c, i) => { const n = words(c).length;
    if (n > 6) err.push(`обложка ${i + 1}: ${n} слов («${c}») — на телефоне не прочитают, нужно 1–3`);
    else if (n > 4) warn.push(`обложка ${i + 1}: ${n} слов («${c}») — лучше 1–3`);
    if (norm(c).length > 6 && norm(t).includes(norm(c))) warn.push(`обложка ${i + 1} повторяет название — пусть дополняет`); });
  const f = firstLine(ep);
  if (/^(привет|здравствуй|всем|сегодня|в этом видео|добро пожаловать)/i.test(f.trim())) warn.push(`первая фраза начинается с «${f.slice(0, 30)}…» — сразу крючок, без приветствия`);
  return { err, warn };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const SRC = path.dirname(fileURLToPath(import.meta.url));
  const dirs = ['books', 'psy', 'facts', 'jung', 'body', 'scale3d'].map(d => path.join(SRC, d, 'scripts'));
  const files = process.argv.slice(2).length ? process.argv.slice(2).map(f => path.resolve(f)) : dirs.flatMap(d => fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith('.mjs')).map(f => path.join(d, f)) : []);
  let bad = 0, warned = 0;
  for (const f of files) {
    const r = checkPackaging(await import(f)); if (!r.err.length && !r.warn.length) continue;
    console.log(`${r.err.length ? '❌' : '⚠️'} ${path.relative(SRC, f)}`); r.err.forEach(e => console.log('   ❌ ' + e)); r.warn.forEach(w => console.log('   ⚠️ ' + w));
    if (r.err.length) bad++; else warned++;
  }
  console.log(`\nПроверено ${files.length}: ошибок ${bad}, с подсказками ${warned}, чисто ${files.length - bad - warned}`);
}
