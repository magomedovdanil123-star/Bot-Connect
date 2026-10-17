// SEO для YouTube без нейросетей: название, описание с таймкодами глав, теги и хэштеги — из сценария и монтажа.
// Ничего не выдумывает: все факты берутся из текста сценария.

const STOP = new Set('и в во не на но что как это его её их он она они мы вы ты я к ко с со у о об от до за из по для при без над под про же ли бы то так там тут уже ещё еще всё все весь вся этот эта эти тот та те который которая которые которое может могут было быть будет есть нет да или а если чтобы когда тогда чем также тоже очень более менее самый самое самая сам себя себе свой давай вот здесь теперь просто почему сегодня завтра'.split(' '));
const VERBISH = /(ться|тся|(?<!с)ть|ет|ют|ит|ят|ал|ала|али|ило|ила|или|ешь|ишь|ем|им|ете|ите)$/;
const TICKERS = { bitcoin: 'BTC', биткоин: 'BTC', litecoin: 'LTC', лайткоин: 'LTC', ethereum: 'ETH', эфириум: 'ETH', solana: 'SOL', солана: 'SOL', ripple: 'XRP', dogecoin: 'DOGE', toncoin: 'TON', ton: 'TON', tether: 'USDT', cardano: 'ADA', polkadot: 'DOT', avalanche: 'AVAX', chainlink: 'LINK', tron: 'TRX', binance: 'BNB', shiba: 'SHIB', pepe: 'PEPE', sui: 'SUI', aptos: 'APT', near: 'NEAR' };
// криптотермины: в ключевые слова попадают в первую очередь
const DOMAIN = ['халвинг', 'майнинг', 'майнер', 'etf', 'defi', 'nft', 'смарт-контракт', 'блокчейн', 'комисси', 'транзакци', 'кошел', 'приватност', 'капитализац', 'волатильност', 'стейкинг', 'альткоин', 'мемкоин', 'ликвидност', 'биржа', 'токен', 'эмисси', 'регулятор', 'листинг', 'памп', 'дамп', 'тренд', 'бычий', 'медвежий', 'сеть', 'обновлени', 'партнёрств', 'инвестор', 'трейдер', 'прогноз', 'рост', 'падени'];
const GENERIC = new Set('долларов доллара цента центов причина причины проект проекта сценарий история истории внимание внимания вокруг другой другие другого подписывайся ссылка шапке профиля рекомендация финансовая покупкой изучай оценивай последние деньги многие тогда несколько вообще наверное именно сейчас время ролик видео сегодня завтра каждый каждые больше меньше примерно около первая вторая третья'.split(' '));
const LEADIN = /^(но|и|а|так|теперь|итак|вот|ну|однако|при этом)\s+/i;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const trimTo = (s, n) => { if (s.length <= n) return s; const cut = s.slice(0, n + 1); return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,:;—-]+$/, '') + '…'; };
const ts = sec => { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`; };
const hashtag = s => '#' + s.replace(/[^A-Za-zА-Яа-яЁё0-9]/g, '');

export function keywords(text, n = 8, exclude = []) {
  const freq = new Map(), ex = exclude.map(x => x.toLowerCase());
  for (const raw of text.split(/\s+/)) {
    const w = raw.replace(/[^A-Za-zА-Яа-яЁё0-9-]/g, ''); const l = w.toLowerCase();
    if (w.length < 4 || STOP.has(l) || GENERIC.has(l) || VERBISH.test(l) || /^\d+$/.test(w) || ex.includes(l) || /^[A-Z]/.test(w)) continue;
    const stem = l.slice(0, 6), cur = freq.get(stem);
    const domain = DOMAIN.some(d => l.startsWith(d)) ? 5 : 0;
    if (cur) cur.n += 1; else freq.set(stem, { w: l, n: 1 + domain });
  }
  return [...freq.values()].sort((a, b) => b.n - a.n || b.w.length - a.w.length).slice(0, n).map(x => x.w);
}

/**
 * @param script  исходный сценарий
 * @param plan    план после режиссуры (scenes со start, type, p; main, tickers)
 */
export function buildSeo(script, plan) {
  const year = new Date().getFullYear();
  // тематика: крипта или личные финансы (теги и хэштеги под нишу)
  const crypto = /крипт|биткоин|bitcoin|блокчейн|токен|альткоин|\bbtc\b|\beth\b|эфириум|майнинг|nft|defi/i.test(script);
  const niche = crypto ? { word: 'Крипта', tags: ['криптовалюта', 'крипта', 'криптовалюта для начинающих', 'инвестиции в криптовалюту', 'новости криптовалют', `крипта ${year}`], hash: ['криптовалюта', 'крипта'] }
    : { word: 'Деньги', tags: ['финансовая грамотность', 'личные финансы', 'деньги', 'как накопить деньги', 'экономия', `финансы ${year}`], hash: ['финансы', 'деньги'] };
  if (plan.hasMascot) niche.tags.unshift('хомяк');
  const sentences = plan.scenes.map(s => s.text);
  const main = plan.main || (plan.tickers || [])[0] || '';
  const known = TICKERS[main.toLowerCase()];
  const ticker = known && new RegExp(`\\b${known}\\b`).test(script) ? known
    : (plan.tickers || []).find(t => /^[A-Z]{2,6}$/.test(t) && t !== main && main && t[0] === main[0].toUpperCase()) || '';
  const subject = main ? `${main}${ticker ? ` (${ticker})` : ''}` : '';

  // ---- название: монета + главный вопрос / тезис ----
  const question = sentences.slice(0, 8).flatMap(s => s.split(/(?<=\?)/)).map(s => s.trim().replace(LEADIN, '')).find(s => s.endsWith('?') && s.length >= 15 && s.length <= 80);
  const claim = sentences.slice(0, 4).map(s => s.replace(LEADIN, '')).find(s => s.length >= 25 && s.length <= 75 && !/подпис|ссылк/i.test(s));
  let title;
  if (question) title = subject && !question.toLowerCase().includes(main.toLowerCase()) ? `${subject}: ${question}` : question;
  else if (claim) title = `${subject ? subject + ': ' : ''}${claim.replace(/[.!…]+$/, '')}`;
  else title = `${subject || niche.word} — разбор ${year}`;
  if (title.length < 60 && !new RegExp(String(year)).test(title)) title += ` | Разбор ${year}`;
  title = trimTo(cap(title.replace(/\s+/g, ' ')), 95);

  // ---- главы (таймкоды): заставки глав, вопросы, крупные заголовки; ≥ 10 с между ними ----
  const chapters = [{ t: 0, name: 'Вступление' }];
  for (const s of plan.scenes.slice(1)) {
    let name = null;
    if (s.type === 'chapter') name = cap(s.p.title.toLowerCase());
    else if (s.type === 'heroQ' || s.type === 'questions') name = s.text.split(/(?<=\?)/)[0];
    else if (s.type === 'hero' && s.text.length > 12) name = s.text;
    else if (s.type === 'warning' || s.type === 'subscribe') name = s.type === 'warning' ? 'Риски и выводы' : null;
    if (!name) continue;
    const t = Math.max(0, s.start - .6), total = plan.total || 60;
    if (t - chapters[chapters.length - 1].t < Math.max(10, total / 12)) continue;   // не больше ~12 глав
    chapters.push({ t, name: trimTo(name.replace(/[.!…]+$/, ''), 60) });
  }
  const chapterBlock = chapters.length >= 3 ? `\n\n⏱ Таймкоды:\n${chapters.map(c => `${ts(c.t)} ${c.name}`).join('\n')}` : '';

  // ---- описание ----
  const kw = keywords(script, 10, [main, ticker]);
  const hook = trimTo(sentences.slice(0, 3).join(' '), 300);
  const entities = [...new Set([main, ...(plan.tickers || [])].filter(Boolean))].slice(0, 6);
  const about = `В этом видео разбираем ${subject || (crypto ? 'рынок криптовалют' : 'личные финансы')}${kw.length ? ': ' + kw.slice(0, 6).join(', ') : ''}.`;
  const link = /ссылк/i.test(script) ? '\n\n🔗 Ссылка на биржу — в шапке профиля.' : '';
  const tags0 = [main, ticker, ...niche.hash].filter(Boolean);
  const hashtags = [...new Set(tags0.map(hashtag))].slice(0, 3);
  const description = trimTo(
    `${hook}\n\n${about}${chapterBlock}${link}\n\n⚠️ Не является финансовой рекомендацией. Перед покупкой изучайте проект и оценивайте риски.\n\n${hashtags.join(' ')}`,
    4900);

  // ---- теги (YouTube: до 500 символов суммарно) ----
  const cand = [
    ...entities, ...(main ? [`${main} прогноз`, `${main} новости`, `${main} разбор`, `${main} ${year}`, `${main} цена`] : []),
    ...(ticker ? [`${ticker} криптовалюта`] : []),
    ...niche.tags,
    ...kw,
  ];
  const tags = []; let total = 0;
  for (const t of cand) {
    const v = t.trim(); if (!v || tags.some(x => x.toLowerCase() === v.toLowerCase())) continue;
    if (total + v.length + 2 > 450) break; tags.push(v); total += v.length + 2;
  }
  return { title, description, tags, hashtags };
}
