// Проверка сценария книги до озвучки: рисунки есть в OpenMoji, ссылки show верные, на листе ничего не теряется при раскладке,
// главы и Shorts на месте, SEO-поля заполнены, длина ~12–15 минут. Запуск: node src/books/check.mjs 2 3 4 (без номеров — все).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url)), SVG = path.join(DIR, '..', '..', 'node_modules/openmoji/color/svg');
const has = code => fs.existsSync(path.join(SVG, code + '.svg'));
const NEED = ['title', 'author', 'ytTitle', 'titles', 'about', 'comment', 'coverTitle', 'cover', 'shorts', 'description', 'tags', 'screens'];

export function checkBook(b) {
  const err = [], warn = [];
  for (const k of NEED) if (b[k] == null || (Array.isArray(b[k]) && !b[k].length)) err.push(`нет поля ${k}`);
  for (const e of b.cover?.emojis || []) if (!has(e)) err.push(`обложка: нет рисунка ${e}`);
  const chs = new Set();
  let lines = 0, chars = 0, ideaMax = 0;
  (b.screens || []).forEach((sc, i) => {
    const at = `лист ${i}${sc.ch ? ` «${sc.ch}»` : ''}`;
    if (!sc.lines?.length) return err.push(`${at}: нет фраз`);
    if (sc.ch) { if (chs.has(sc.ch)) err.push(`${at}: глава повторяется`); chs.add(sc.ch); }
    if (sc.idea) ideaMax = Math.max(ideaMax, sc.idea[1]);
    lines += sc.lines.length; chars += sc.lines.join(' ').length;
    for (const l of sc.lines) if (l.split(/\s+/).length > 26) warn.push(`${at}: длинная фраза «${l.slice(0, 40)}…»`);
    const show = sc.show || [], pics = show.filter(e => e.pic), texts = show.filter(e => e.text), q = show.filter(e => e.quote), bars = show.filter(e => e.bars);
    show.forEach((e, j) => {
      if (!Number.isInteger(e.l) || e.l < 0 || e.l >= sc.lines.length) err.push(`${at}: show[${j}] l=${e.l} вне фраз`);
      if (e.pic && !has(e.pic)) err.push(`${at}: нет рисунка ${e.pic}`);
      if (e.cap && e.cap.split('\n').some(x => x.length > 24)) warn.push(`${at}: длинная подпись «${e.cap}»`);
      if (e.mark != null && !show[e.mark]?.text) err.push(`${at}: маркер только поверх надписи`);
      for (const r of [e.cross, e.box, e.mark, ...(e.arrow || [])].filter(x => x != null)) if (!show[r] || !(show[r].pic || show[r].text)) err.push(`${at}: show[${j}] ссылается на ${r} — там нет картинки/надписи`);
      if (e.box != null && !show[e.box]?.text) err.push(`${at}: рамка только вокруг надписи`);
    });
    if (q.length > 1 || bars.length > 1) err.push(`${at}: больше одной цитаты/графика`);
    if (q.length && (pics.length > 3 || texts.length > 1)) warn.push(`${at}: с цитатой влезает ≤3 картинок и 1 надпись`);
    if (bars.length && pics.length > 1) warn.push(`${at}: с графиком влезает 1 картинка`);
    if (!q.length && !bars.length) { if (pics.length > 6) err.push(`${at}: больше 6 картинок`); if (pics.length > 3 && texts.length > 1) warn.push(`${at}: при 4–6 картинках видна только 1 надпись`); if (texts.length > 3) warn.push(`${at}: больше 3 надписей`); }
    if (!show.length) warn.push(`${at}: пустой лист`);
  });
  for (const s of b.shorts || []) if (typeof s.from === 'string' && !chs.has(s.from)) err.push(`Shorts: нет главы «${s.from}»`);
  const sec = chars / 14.5 + lines * .45;
  return { err, warn, lines, screens: b.screens?.length || 0, min: (sec / 60).toFixed(1), ideas: ideaMax };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.join(DIR, 'scripts'), ns = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).map(f => f.replace('.mjs', ''));
  let bad = 0;
  for (const n of ns) {
    const b = { ...(await import(path.join(dir, n + '.mjs'))) }, r = checkBook(b);
    console.log(`${r.err.length ? '❌' : '✅'} №${n} «${b.title}» — листов ${r.screens}, фраз ${r.lines}, ~${r.min} мин, идей ${r.ideas}`);
    for (const e of r.err) console.log('   ❌ ' + e);
    for (const w of r.warn) console.log('   ⚠️ ' + w);
    if (r.err.length) bad++;
  }
  process.exitCode = bad ? 1 : 0;
}
