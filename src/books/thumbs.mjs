// Обложки обзоров и разборов в тёмном кликбейт-стиле (thumbs.html): 3 варианта для «Теста и сравнения» в YouTube Studio.
// В сценарии: thumbs — 3 обложки, look — как выглядит книга. Пример (Богатый папа):
//   look: { pal: 0, top: 'Чему учат богатые своих детей', title: ['БОГАТЫЙ', 'ПАПА,', 'БЕДНЫЙ', 'ПАПА'], deco: 'frame' }
//   thumbs: [{ layout: 'ask', lines: ['ПОЧЕМУ', 'ТЫ', 'БЕДНЫЙ?'], note: 'ответ — в этой книге', art: 'coins' },
//            { layout: 'vs', left: 'ЗАРПЛАТА', right: 'АКТИВЫ' },
//            { layout: 'say', lines: ['ЗАРПЛАТА —', 'ЛОВУШКА'], note: 'и как из неё выбраться', art: 'trap' }]
// Раскладки: ask (вопрос-боль), vs (сравнение), say (утверждение + предмет), num (цифра), streak (календарь), formula (две линии).
// Нет thumbs — собираем из старых полей cover/covers, чтобы любой сценарий (и от нейросети) получил обложки в новом стиле.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url)), SVG = path.join(DIR, '..', '..', 'node_modules/openmoji/color/svg');
const hasArt = c => c && fs.existsSync(path.join(SVG, c + '.svg'));
const up = s => String(s || '').toUpperCase().trim();
// фраза → строки по ~12 знаков (крупный текст на обложке)
export function lines(s, max = 12, n = 3) {
  const out = []; let cur = '';
  for (const w of up(s).split(/\s+/).filter(Boolean)) { if (cur && (cur + ' ' + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }
  if (cur) out.push(cur);
  while (out.length > n) { const a = out.pop(); out[out.length - 1] += ' ' + a; }
  return out;
}
const hash = s => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

export function thumbSpecs(book, kind = 'book') {
  const isBook = kind === 'book', icons = [...new Set([...(book.cover?.emojis || []), ...(book.covers || []).flatMap(c => c.emojis || [])])].filter(hasArt);
  const look = isBook ? { pal: hash(book.title) % 10, deco: 'frame', title: lines(String(book.coverTitle || book.title).replace(/\n/g, ' '), 11, 4), author: book.author || '', ...(book.look || {}) } : null;
  const hooks = [book.cover?.hook, ...(book.covers || []).map(c => c.hook)].filter(Boolean), word = book.cover?.word || book.covers?.find(c => c.word)?.word;
  const auto = [
    { layout: 'ask', lines: lines(hooks[0] || (isBook ? 'О чём эта книга?' : book.title), 11, 3), note: isBook ? 'ответ — в этой книге' : 'разбираю простыми словами', art: null },
    { layout: 'say', lines: word ? lines(word, 12, 2) : lines(hooks[1] || book.title, 12, 2), note: hooks[1] && word ? hooks[1] : '' },
    { layout: 'ask', lines: lines(hooks[1] || hooks[0] || book.title, 11, 3), accent: 'r', note: '' },
  ];
  const specs = (book.thumbs?.length ? book.thumbs : auto).slice(0, 3);
  return specs.map((t, i) => ({ seed: 7 + i, ...t, icons: (t.icons?.length ? t.icons : icons).filter(hasArt), look: t.look === false ? null : look, label: t.label || (isBook ? 'ОБЗОР КНИГИ' : 'ПСИХОЛОГИЯ') }));
}

/** 3 обложки 1280×720 в work/cover.jpg, cover_2.jpg, cover_3.jpg. browser — уже запущенный Chromium (Playwright). */
export async function renderThumbs(browser, book, kind, work) {
  const specs = thumbSpecs(book, kind), p = await browser.newPage({ viewport: { width: 1280, height: 720 } }), out = [];
  try {
    await p.goto('file://' + path.join(DIR, 'thumbs.html')); await p.waitForFunction(() => document.title === 'ready');
    for (const [i, s] of specs.entries()) {
      const codes = [...new Set([...(s.icons || []), s.leftIcon, s.rightIcon].filter(hasArt))], arts = Object.fromEntries(codes.map(c => [c, fs.readFileSync(path.join(SVG, c + '.svg'), 'utf8')]));
      const url = await p.evaluate(([spec, a]) => window.thumb(spec, a), [s, arts]);
      const f = path.join(work, i ? `cover_${i + 1}.jpg` : 'cover.jpg'); fs.writeFileSync(f, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')); out.push(f);
    }
  } finally { await p.close().catch(() => {}); }
  return out;
}

// обложки от нейросети: только известные раскладки, короткие строки, существующие рисунки
const LAYOUTS = ['ask', 'vs', 'say', 'num', 'streak'], cut = (x, n) => up(x).slice(0, n);
export function cleanThumbs(list, look) {
  const t = (Array.isArray(list) ? list : []).filter(x => x && LAYOUTS.includes(x.layout)).slice(0, 3).map(x => ({
    layout: x.layout, ...(x.lines ? { lines: [].concat(x.lines).map(l => cut(l, 16)).filter(Boolean).slice(0, 3) } : {}),
    ...(x.note ? { note: String(x.note).slice(0, 40) } : {}), ...(x.left ? { left: cut(x.left, 14), right: cut(x.right, 14) } : {}),
    ...(x.top ? { top: cut(x.top, 12), result: cut(x.result, 14) } : {}), ...(x.accent && 'yrgw'.includes(x.accent) ? { accent: x.accent } : {}),
    ...(x.layout === 'streak' ? { cal: cut(x.cal || 'ПРИВЫЧКА', 20), day: Math.min(20, Math.max(3, +x.day || 14)) } : {}),
    icons: [].concat(x.icons || []).filter(hasArt).slice(0, 2) }))
    .filter(x => x.layout === 'vs' ? x.left && x.right : x.layout === 'num' ? x.top && x.result : x.lines?.length);
  const l = look && typeof look === 'object' ? { pal: Math.min(9, Math.max(0, Math.round(+look.pal || 0))), ...(Array.isArray(look.title) ? { title: look.title.map(x => cut(x, 12)).slice(0, 4) } : {}), ...(look.top ? { top: String(look.top).slice(0, 40) } : {}) } : undefined;
  return { thumbs: t.length === 3 ? t : undefined, look: l };
}

