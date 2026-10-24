// Спрос на книгу: как часто её ищут на YouTube (подсказки поиска) и сколько смотрят обзоры, против того, сколько свежих сильных
// обзоров уже есть. Первыми снимаем книги с большим спросом и слабой конкуренцией.
const words = s => s.toLowerCase().replace(/[«»"',.:!?—-]/g, ' ').split(/\s+/).filter(w => w.length > 2);

/** Подсказки поиска YouTube (то, что люди начинают вводить). */
export async function suggestions(q) {
  const r = await fetch('https://suggestqueries.google.com/complete/search?' + new URLSearchParams({ client: 'firefox', ds: 'yt', hl: 'ru', gl: 'ru', q }));
  if (!r.ok) throw new Error(`подсказки: ${r.status}`);
  const j = JSON.parse(new TextDecoder('utf-8').decode(await r.arrayBuffer())); return Array.isArray(j[1]) ? j[1].map(String) : [];
}

/** { score, sug, median, fresh, best } для книги; search — функция поиска видео ({ views, publishedAt, title }). */
export async function bookDemand(book, search) {
  const key = words(book.title).slice(0, 2), match = t => key.every(w => t.toLowerCase().includes(w.slice(0, -1)));
  const sug = (await suggestions(book.title.toLowerCase()).catch(() => [])).filter(match).length;
  const vids = (await search(`${book.title} ${book.author.split(',')[0].split(' ').pop()} краткое содержание обзор`)).filter(v => match(v.title));
  const views = vids.map(v => v.views).sort((a, b) => a - b), median = views.length ? views[Math.floor(views.length / 2)] : 0;
  const fresh = vids.filter(v => Date.now() - Date.parse(v.publishedAt) < 540 * 864e5 && v.views > 30000).length;
  const score = Math.log10(median + 10) * (1 + sug / 10) / (1 + fresh * .25) * (vids.length ? 1 : .5);
  return { score: Math.round(score * 10) / 10, sug, median, fresh, found: vids.length, best: views.at(-1) || 0 };
}
