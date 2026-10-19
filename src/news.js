// «Зверо-новости»: ведёт Сова, Крот-соведущий реагирует (он «слепой как котёнок»).
// Новости — свои (вписал текстом или прислал ссылку на статью) или из открытой ленты РБК (бот предлагает в радаре).
// Сценарий без нейросети: заголовок + суть + реакция Крота + вывод Совы «что это значит для тебя».
import fs from 'fs';
import path from 'path';

const pick = a => a[Math.floor(Math.random() * a.length)];
const words = s => s.trim().split(/\s+/).filter(Boolean);

// ---------- категория новости: от неё реакция Крота, вывод Совы, картинка на экране студии и теги ----------
const CATS = [
  ['people', /(стан(ет|ут)|станет) (отцом|мамой|папой|родител)|ждут (ребёнка|ребенка|малыша|пополнени)|беременн|родил(а|ся|ись|и)|свадьб|поженил|женил|вышла замуж|помолв|развод|развел|юбиле|день рождени|годовщин|блогер|певиц|певец|актёр|актер|актрис|рэпер|шоу-бизнес/i],
  ['ai', /нейросет|искусствен\S* интеллект|(^|[^а-яё])ии([^а-яё]|$)|chatgpt|gpt|claude|gemini|алиса|gigachat|гигачат|нейронк|чат-бот|робот/i],
  ['scam', /мошенн|развод|фишинг|обман|звонят|код из смс|кибер|утечк|взлом/i],
  ['rates', /ключев\S* ставк|центробанк|(^|\s)цб(\s|$)|банк россии|вклад|депозит|процент\S* по/i],
  ['realty', /ипотек|квартир|недвижим|аренд|жиль/i],
  ['tax', /налог|штраф|закон(?!ч)|госдум|с 1 (января|марта|июня|сентября)|вступ\S* в силу|правил[аео]|запрет/i],
  ['work', /зарплат|ваканс|работодат|самозанят|курьер|такси|увольн|пенси|рынок труда|безработ|подработ/i],
  ['shop', /маркетплейс|ozon|озон|wildberries|вайлдберриз|доставк|магазин|скидк|кэшбэк|покупател/i],
  ['prices', /цен[аыуе]|подорож|дешев|тариф|жкх|бензин|инфляц|стоимост/i],
  ['tech', /смартфон|iphone|android|приложени|telegram|телеграм|whatsapp|мессенджер|интернет|vpn|сбой|обновлени|гаджет/i],
];
export const newsCat = text => (CATS.find(([, re]) => re.test(text)) || ['money'])[0];

// ---------- рубрики выпуска: порядок как на ТВ — звёзды → технологии (нейросети, гаджеты, приложения) → новинки → главное → тренд дня → хорошая новость ----------
export const RUBRICS = {
  stars: { icon: '🌟', title: 'Звёзды', first: ['Начнём со звёзд!'], next: ['А теперь — звёзды!', 'Переходим к звёздам!'] },
  ai: { icon: '💻', title: 'Технологии', first: ['Начнём с технологий!'], next: ['А теперь — технологии!', 'Переходим к технологиям!'] },
  novelty: { icon: '🛒', title: 'Новинки', first: ['Начнём с новинок, которые все обсуждают!'], next: ['А теперь — к новинкам, которые все обсуждают!'] },
  main: { icon: '📰', title: 'Главное', first: ['Начнём с главного.'], next: ['А теперь — о главном.'] },
  trend: { icon: '😂', title: 'Тренд дня', first: ['Начнём с тренда дня!'], next: ['А теперь — тренд дня!'] },
  good: { icon: '🏆', title: 'Хорошие новости', first: ['Начнём с хорошей новости!'], next: ['И напоследок — хорошая новость!', 'И в конце — хорошая новость!'] },
};
export const RUB_ORDER = ['stars', 'ai', 'novelty', 'main', 'trend', 'good'];
const TREND_RE = /тренд|мем[аыу]?\b|завирус|вирусн|челлендж|все повторяют|тикток|tiktok|reels|рилс/i;
const GOOD_RE = /детёныш|детеныш|зоопарк|спас(ли|ла|л)|помог(ли|ла)|рекорд|изобр[её]л|победил|волонт|благотвор|подарил|вылечил|нашли дом|приют|добр(ое|ый|ая) дел/i;
export const rubricOf = (text, cat = newsCat(text)) => TREND_RE.test(text) ? 'trend' : GOOD_RE.test(text) && cat !== 'scam' ? 'good' : cat === 'people' ? 'stars' : cat === 'ai' || cat === 'tech' ? 'ai' : cat === 'shop' ? 'novelty' : 'main';
/** Строка-переход между рубриками («А теперь — технологии!») → ключ рубрики; иначе null. */
export function rubricOfLine(s) {
  if (!/^(начн[её]м с|сначала|а теперь|переходим к|и напоследок|и в конце|и наконец)/i.test(s.trim())) return null;
  return /зв[её]зд/i.test(s) ? 'stars' : /технолог|нейросет/i.test(s) ? 'ai' : /новинк/i.test(s) ? 'novelty' : /тренд/i.test(s) ? 'trend' : /хорош/i.test(s) ? 'good' : /главн/i.test(s) ? 'main' : null;
}
// реплики под рубрику (если для повода нет своих)
const RUB_K = { trend: ['Смотрите, у меня получается! Наверное.', 'Повторил! Сова, я теперь в тренде?'], novelty: ['Хочу! Хотя я даже не вижу, что это.', 'Беру два! А что это?'], good: ['Вот это я понимаю — хорошая новость!', 'Я аж прослезился. Ну, или это пыль.'] };
const RUB_O = { trend: ['Повторять тренды можно. Тратить на них последние деньги — нет.', 'Крот, это было… смело.'], novelty: ['Новинка — не повод покупать сразу. Подожди отзывы — и цена часто падает.'], good: ['Пусть таких новостей будет больше!', 'Вот бы каждый выпуск так заканчивался.'] };

const PRICE_RE = /\d[\d\s]*\s*(₽|руб|тыс|млн|миллион|доллар|\$)|\d+\s*%|стоит|стоимост/i;
const PRICE_K = ['Сколько?! Я столько и за год не накопаю!', 'Сколько?! Это же сорок мешков морковки!', 'Сколько?! Я лучше сам научусь!', 'Сколько?! Сова, держи меня!'];
const PRICE_O = ['Крот, у тебя в копилке три жёлудя и пуговица.', 'Крот, спокойно. Сначала посчитай, потом кричи.', 'Крот, ты так кричишь, будто тебе это кто-то продаёт.'];
const KROT = {
  people: ['Поздравляем! Я им даже носочки свяжу. На ощупь.', 'Ой, как мило! Я, правда, не вижу, но чувствую — мило.', 'Ура! Можно я тоже приду? Я принесу салат. Наверное, свой.'],
  ai: ['Нейросеть? А она может найти мои очки?', 'Она теперь умнее меня? Хотя это несложно.', 'Подожди, а она за меня копать будет?'],
  scam: ['Мне вчера звонили из банка… Ой.', 'А если просят код из СМС — это нормально? Шучу. Шучу же?'],
  rates: ['Ставка… это что-то про скачки?', 'Так мне теперь копить или тратить? Я запутался.'],
  realty: ['Квартира? Я в норе живу, мне не страшно.', 'Звучит как очень много нулей.'],
  tax: ['Новые правила? Я и старые-то не видел.', 'Подожди, мне теперь надо что-то платить?'],
  work: ['О, а меня возьмут? Я хорошо копаю.', 'Работа — это хорошо. Главное, чтобы не под землёй. Хотя…'],
  shop: ['Я как раз собирался купить очки. Третьи.', 'Скидки? Где? Я не вижу!'],
  prices: ['Опять?! Я только привык к старым ценам!', 'Я не вижу ценники. Может, и к лучшему.'],
  tech: ['Опять обновление? Я ещё прошлое не нашёл.', 'Звучит круто. Я ничего не понял, но звучит круто.'],
  money: ['Я ничего не вижу, но звучит дорого!', 'Так, а мне-то что с этого?', 'Это хорошая новость или плохая? Я не вижу!'],
};
const OWL = {
  people: ['От всей студии — поздравляем! А зрителям совет: подарки к празднику выгоднее покупать заранее.', 'Счастья им! А тебе совет: на радостях не трать всё сразу.'],
  ai: ['Нейросети не заберут работу у тех, кто ими пользуется. Попробуй одну уже на этой неделе.', 'Новые нейросети выходят каждую неделю. Выигрывает тот, кто пробует первым.'],
  scam: ['Никому не называй код из СМС. Даже если звонит «банк».', 'Звонят и торопят — клади трубку и перезванивай сам по номеру с карты.'],
  rates: ['Ставка меняется — проверь свой вклад и кредит: условия могут поменяться.', 'Когда меняется ставка, меняются проценты по вкладам и кредитам. Проверь свои.'],
  realty: ['Ипотека — это надолго. Считай платёж с запасом.', 'Прежде чем решать про жильё — посчитай, сколько останется после платежа.'],
  tax: ['Новые правила — проверь заранее, касается ли это тебя.', 'Лучше узнать о правилах сейчас, чем о штрафе потом.'],
  work: ['Хочешь зарабатывать больше — узнай, сколько платят за твою работу в других местах.', 'Рынок меняется — держи резюме обновлённым.'],
  shop: ['Перед покупкой сравни цену в двух местах — разница бывает приятной.', 'Скидка — не повод покупать то, что не планировал.'],
  prices: ['Цены растут — значит, считаем расходы заранее и ищем, где сэкономить.', 'Запиши траты за неделю — сразу видно, где утекают деньги.'],
  tech: ['Проверь подписки в телефоне — часть из них списывает деньги зря.', 'Обновляйся только из официального магазина приложений.'],
  money: ['Главное — не паниковать и проверять новости в официальных источниках.', 'Новости меняются каждый день, а правило одно: сначала думай, потом трать.'],
};
const TAGS = { people: ['новости шоу-бизнеса', 'блогеры', 'звёзды'], ai: ['нейросети', 'искусственный интеллект', 'новости ии'], scam: ['мошенники', 'как не попасться мошенникам'], rates: ['ключевая ставка', 'вклады'], realty: ['ипотека', 'недвижимость'],
  tax: ['новые законы', 'налоги'], work: ['работа', 'зарплаты'], shop: ['маркетплейсы', 'покупки'], prices: ['цены', 'подорожание'], tech: ['технологии', 'смартфоны'], money: ['деньги', 'экономика'] };

// ---------- свои новости: текст (заголовок первой строкой, ниже суть) или ссылка на статью ----------
// предложения: не длиннее ~24 слов (диктор читает, титры успевают), без ссылок, эмодзи и разметки
const tidy = s => s.replace(/https?:\/\/\S+/g, '').replace(/[*_#>`]+/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
const quoteOk = x => (x.match(/«/g) || []).length === (x.match(/»/g) || []).length && !/^[«"—]/.test(x);
const sentences = s => tidy(s).split(/(?<=[.!?…])\s+(?=[А-ЯЁA-Z«"0-9])/).map(x => x.trim()).filter(x => x.length > 3 && quoteOk(x));
function shorten(s, max = 24) {
  const w = words(s); if (w.length <= max) return s;
  const cut = w.slice(0, max).join(' '), at = Math.max(cut.lastIndexOf(','), cut.lastIndexOf(' — '));
  return (at > cut.length * .5 ? cut.slice(0, at) : cut).replace(/[,;:—\s]+$/, '') + '.';
}
const end = s => /[.!?…»]$/.test(s) ? s : s + '.';
function itemOf(title, body, extra = {}) {
  title = shorten(tidy(title).replace(/^\d+[.)]\s*/, '').replace(/[.:]+$/, ''), 18).replace(/\.$/, '');
  const b = body.flatMap(sentences).filter(x => x.replace(/[.!?…]$/, '') !== title).slice(0, 3).map(x => end(shorten(x)));
  const cat = newsCat(title + ' ' + b.join(' '));
  return { id: 'news:' + Buffer.from(title).toString('base64').slice(0, 24), title, body: b, cat, rub: rubricOf(title + ' ' + b.join(' '), cat), ...extra };
}
/** Текст от пользователя → новости. Несколько новостей — через пустую строку (или «---»); строка-ссылка — статья по ссылке.
 *  Абзац, который не похож на заголовок (длинный, из нескольких предложений), — продолжение предыдущей новости, а не новая. */
const isHeadline = l => l.length <= 150 && sentences(l).length <= 1;
export async function parseNewsInput(text) {
  const blocks = text.split(/\n\s*(?:-{3,}|—{2,})?\s*\n/).map(b => b.trim()).filter(Boolean), raw = [], out = [];
  for (const b of blocks) {
    const url = /^https?:\/\/\S+$/.exec(b.trim())?.[0];
    if (url) { raw.push({ url }); continue; }
    const ls = b.split('\n').map(tidy).filter(Boolean); if (!ls.length) continue;
    const prev = raw[raw.length - 1];
    if (prev?.lines && !isHeadline(ls[0])) prev.lines.push(...ls); else raw.push({ lines: ls });
  }
  for (const r of raw) {
    if (r.url) { const a = await fetchArticle(r.url).catch(() => null); if (a) out.push(a); continue; }
    if (r.lines.length === 1) { const ss = sentences(r.lines[0]); out.push(itemOf(ss[0] || r.lines[0], ss.slice(1))); }
    else out.push(itemOf(r.lines[0], r.lines.slice(1)));
  }
  return out;
}
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36', 'accept-language': 'ru-RU,ru;q=0.9' };
/** Статья по ссылке: заголовок (og:title) и первые абзацы. */
export async function fetchArticle(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error('HTTP ' + r.status);
  const html = await r.text(), meta = n => decode(new RegExp(`<meta[^>]+(?:property|name)=["']${n}["'][^>]*content=["']([^"']+)`, 'i').exec(html)?.[1] || new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${n}["']`, 'i').exec(html)?.[1] || '');
  const title = meta('og:title') || decode(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').split(/ [|—–-] /)[0];
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map(m => decode(m[1])).filter(p => p.length > 60 && !/cookie|подпис|©|реклам/i.test(p)).slice(0, 3);
  if (!title) throw new Error('нет заголовка');
  const img = meta('og:image'), abs = img && new URL(img, url).href;
  return itemOf(title, [meta('og:description') || meta('description'), ...paras].filter(Boolean), { link: url, source: url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''), imageUrl: abs || null });
}

// ---------- бот предлагает сам: открытые ленты (экономика, финансы, технологии, нейросети), без политики, спорта и трагедий ----------
// РБК — основная; остальные — если доступны с сервера (недоступная лента просто пропускается)
const FEEDS = ['https://rssexport.rbc.ru/rbcnews/news/30/full.rss', 'https://lenta.ru/rss/news', 'https://3dnews.ru/news/rss/', 'https://habr.com/ru/rss/news/?fl=ru'];
const KEEP_CAT = /экономик|финанс|технолог|бизнес|недвижим|медиа/i;
const BAD = /матч|турнир|чемпионат|сборн|регби|футбол|хоккей|теннис|олимпи|погиб|убит|удар[аыу]? по|атак|дрон|беспилот|ракет|войн|всу|обстрел|теракт|взрыв|санкци|выбор|протест|задержа|арест|тюрьм|суд |эбол|катастроф|крушени|умер|скончал|пожар|зеленск|трамп|минобороны|нато|киев/i;
const GOOD = /нейросет|искусствен|chatgpt|робот|смартфон|приложени|telegram|телеграм|whatsapp|мессенджер|маркетплейс|ozon|wildberries|доставк|цен[аыу]|подорож|тариф|жкх|зарплат|пенси|налог|вклад|ставк|кредит|ипотек|карт[аыу]|банк|кэшбэк|мошенн|штраф|закон(?!ч)|самозанят|курьер|такси|ваканс|бензин|аренд|квартир|рубл|рынок труда|подработ/i;
const cacheFile = dir => path.join(dir, 'news_cache.json');
/** До 10 свежих новостей «про деньги, работу и технологии» — для радара. Кэш на 2 часа; сеть недоступна — пустой список. */
export async function fetchNews(dir) {
  try { const c = JSON.parse(fs.readFileSync(cacheFile(dir), 'utf8')); if (Date.now() - c.at < 2 * 36e5) return c.items; } catch { /* кэша нет */ }
  const items = [];
  for (const url of FEEDS) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) }); if (!r.ok) continue;
      for (const m of (await r.text()).matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const x = m[1], tag = n => decode(new RegExp(`<${n}>([\\s\\S]*?)</${n}>`).exec(x)?.[1] || '');
        const title = tag('title'), cat = tag('category'), anons = tag('rbc_news:anons') || tag('description'), full = tag('rbc_news:full-text');
        if (!title || BAD.test(title + ' ' + anons) || !GOOD.test(title) || !(KEEP_CAT.test(cat) || newsCat(title) !== 'money')) continue;
        const it = itemOf(title, [anons, ...sentences(full).slice(1, 3)], { link: tag('link'), source: url.includes('rbc') ? 'РБК' : url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''), at: Date.parse(tag('pubDate')) || Date.now() });
        if (!items.some(y => y.id === it.id)) items.push(it);
      }
    } catch (e) { console.error('news feed', e.message); }
  }
  // сначала про нейросети и кошелёк, потом остальное; свежие выше
  const score = it => (it.cat === 'ai' ? 3 : ['prices', 'rates', 'scam', 'work', 'tax'].includes(it.cat) ? 2 : 1) + (it.at || 0) / 1e13;
  const top = items.sort((a, b) => score(b) - score(a)).slice(0, 10);
  if (top.length) fs.writeFileSync(cacheFile(dir), JSON.stringify({ at: Date.now(), items: top }));
  return top;
}

// ---------- юмор ведущих: Крот «слепой как котёнок» и всё понимает буквально, Сова — спокойная и ироничная ----------
// подколки после вывода Совы (по теме новости и общие)
const PEOPLE = [
  [/родител|отцом|мамой|папой|ребёнк|ребенк|малыш|беремен|родил/i, { k: ['Поздравляем будущих родителей! Я им даже носочки свяжу. На ощупь.', 'Ура! А можно я буду крёстным? Я хорошо копаю песочницы.'],
    o: ['Поздравляем! И совет будущим родителям: коляску и кроватку выгоднее брать заранее — без спешки и со скидкой.', 'Счастья семье! А мы напомним: детские вещи часто дешевле на распродажах — следите заранее.'],
    j: [['Крот: «Поздравляем молодых!»', 'Сова: «Крот, они станут родителями, а не молодожёнами.»', 'Крот: «Тогда поздравляем дважды!»']] }],
  [/свадьб|поженил|женил|замуж|помолв/i, { k: ['Горько! Ой, это же новости. Но всё равно — горько!'], o: ['Поздравляем! Совет от Совы: свадьбу считают заранее — иначе медовый месяц будет в кредит.'],
    j: [['Сова: «Крот, сядь, это не наша свадьба.»', 'Крот: «Я просто встал похлопать!»']] }],
  [/развод|развел|расстал/i, { k: ['Это грустно. Я бы обнял их обоих. Если бы нашёл.'], o: ['Бывает. Главное — расходиться спокойно и всё общее делить по договору.'], j: [] }],
];
const ANIMALS = /зоопарк|детёныш|детеныш|животн|котён|котят|щен|питомц|панд|тигр|медвед|пингвин/i;
const peopleOf = it => ANIMALS.test(it.title + ' ' + it.body.join(' ')) ? null : (PEOPLE.find(([re]) => re.test(it.title + ' ' + it.body.join(' '))) || [])[1];   // детёныши в зоопарке — не светская хроника
const COMEBACK = {
  people: [['Сова: «Крот, сядь, это не церемония награждения.»', 'Крот: «Я просто встал похлопать!»']],
  ai: [['Крот: «Я попросил нейросеть найти мои очки. Она нарисовала мне новые.»'], ['Крот: «А она может вести новости вместо меня?»', 'Сова: «Крот, она уже пишет тебе шпаргалки.»']],
  scam: [['Крот: «Всё, теперь кладу трубку всем!»', 'Сова: «Крот, это пульт, а не телефон.»'], ['Крот: «А если звонит мама?»', 'Сова: «Маме — можно. Кодов мама не просит.»']],
  rates: [['Сова: «Крот, ставка — это не про скачки.»', 'Крот: «Жаль. Я уже поставил на Ежа.»']],
  realty: [['Крот: «А нору в ипотеку можно?»', 'Сова: «Можно. Если копать самому — даже без первого взноса.»']],
  tax: [['Крот: «Я бы прочитал этот закон, но он мелким шрифтом.»'], ['Сова: «Крот, ты держишь документ вверх ногами.»', 'Крот: «Так он быстрее читается!»']],
  work: [['Крот: «Курьером? Да я под землёй быстрее любого самоката!»'], ['Крот: «Возьмите меня! Опыт работы — копаю с рождения.»']],
  shop: [['Крот: «Купил очки на распродаже. Три пары. Все — от солнца.»'], ['Сова: «Крот, положи корзину. Ты в студии.»']],
  prices: [['Крот: «Перехожу на корни. Они бесплатные.»'], ['Сова: «Крот, не плачь в эфире.»', 'Крот: «Это не слёзы. Это ценники отражаются.»']],
  tech: [['Крот: «Я выключил телефон, чтобы он не обновлялся. Работает!»'], ['Крот: «А обновление для меня есть? Версия Крот 2.0, с очками.»']],
  money: [['Крот: «Понял. Ничего не понял, но понял.»'], ['Крот: «Записал. Ну, то есть запомнил. Я же не вижу.»']],
};
export const SKITS = [
  ['А Сова ещё в наушниках.', 'Сова: «Я — экспонат…»', 'Крот: «Сова, выключи! А иначе я ещё и оглохну.»', 'Сова: «Ой. Мы уже в эфире?»'],
  ['Сова слушает музыку в наушниках.', 'Крот: «Сова! Сделай потише!»', 'Сова: «Что?! Я не слышу!»', 'Крот: «Говорю — мы в эфире!»'],
  ['Крот: «Сова, смотри, новый тренд!»', 'Крот подмигивает и двигает руками.', 'Сова: «Крот, ты подмигиваешь стене.»', 'Крот: «Без очков все стены — зрители!»'],
  ['Крот танцует прямо за столом.', 'Сова: «Крот, что ты делаешь?»', 'Крот: «Тренд! Все так делают.»', 'Сова: «Все — в ТикТоке. А мы — в эфире.»'],
];
const HANDOFF = ['Сова: «Крот, что думаешь?»', 'Сова: «Крот, твоё мнение?»', 'Сова: «Крот, а ты что скажешь?»'];
const HELLO = [
  ['Со мной, как всегда, Крот.', 'Крот: «Я здесь! Кажется. Где камера?»', 'Сова: «Крот, камера с другой стороны.»'],
  ['А рядом со мной Крот — сегодня он снова без очков.', 'Крот: «Зато с хорошим настроением!»'],
  ['Со мной в студии Крот.', 'Крот: «Всем привет! Я тоже в эфире!»', 'Сова: «Крот, ты машешь в стену.»'],
];
// фирменное прощание — в конце каждого выпуска одно и то же: ведущие поднимают лапки
export const FAREWELL = ['Это были Зверо-новости!', 'Сова: «Новости коротко —»', 'Крот: «Лапки вверх!»'];
const BYE = [['Крот: «А в следующий раз я приду в очках!»'], ['Крот: «Уже всё? Я только нашёл свой стул.»'], []];
// новость о трагедии, болезни, войне — без шуток: Крот спрашивает серьёзно, Сова — только факты и где проверять
const SERIOUS = /погиб|умер|скончал|жертв|катастроф|теракт|войн|обстрел|пострадав|авари|пожар|эпидеми|болезн|трагед|похорон/i;
const SERIOUS_K = ['Крот: «Это серьёзно. Что делать, если это коснулось тебя или близких?»'], SERIOUS_O = ['Сова: «Проверяй информацию только в официальных источниках и не верь слухам.»'];

const ORD = ['первая', 'вторая', 'третья', 'четвёртая', 'пятая'];
// первая фраза выпуска — всегда одна и та же, как у настоящих новостей (под неё — заставка с логотипом)
export const OPEN = 'Всем привет! В эфире Зверо-новости.';
/** 1 новость — «срочный выпуск»; 2–3 — дайджест. Ведущие шутят, если новость не трагическая. Последняя строка — вопрос зрителю. */
// анонс: заголовок (длинный — первые 9 слов, без висящего предлога) — для «Сегодня в выпуске»
const teaser = (it, last) => { const w = it.title.split(' '); let t = (w.length <= 12 ? w : w.slice(0, 9)).join(' ').replace(/[,:;—-]+$/, '').replace(/\s+(и|в|на|с|что|по|для|от|к|о|а|но|из|за)$/i, ''); if (last) t = 'И ' + (/^[А-ЯЁ](?:[а-яё]|\s)/.test(t) && !personNames(it.title).some(n => t.startsWith(n)) ? t[0].toLowerCase() + t.slice(1) : t); return t + '.'; };
/** 1 новость — «срочный выпуск»; 2–5 — выпуск по рубрикам: анонс со сменой фото, сценка, рубрики с переходами. */
export function newsScript(items, { skit: ownSkit = null } = {}) {
  items = items.slice(0, 5); const L = [], used = new Set(), uniq = a => { const f = a.filter(x => !used.has(x)), v = pick(f.length ? f : a); used.add(v); return v; };
  const serious = items.some(it => SERIOUS.test(it.title + ' ' + it.body.join(' ')));
  // ведущие общаются: Сова передаёт слово Кроту, он реагирует, она подытоживает; светская хроника — поздравления
  const many = items.length >= 4;   // 4–5 новостей: по одной фразе сути, меньше реплик — выпуск укладывается в ~90 с
  // новость с ценой: Крот (как раз пьёт кофе) — «Сколько?!», Сова подкалывает; один раз за выпуск
  let priced = false;
  const react = it => serious ? [SERIOUS_K[0]] : !priced && PRICE_RE.test(it.body.slice(0, items.length >= 3 ? 1 : 2).join(' ')) && (priced = true) ? [`Крот: «${uniq(PRICE_K)}»`, `Сова: «${uniq(PRICE_O)}»`]
    : [...(!many && Math.random() < .5 ? [uniq(HANDOFF)] : []), `Крот: «${uniq(peopleOf(it)?.k || RUB_K[it.rub] || KROT[it.cat] || KROT.money)}»`];
  const advise = it => serious ? SERIOUS_O[0] : `Сова: «${uniq(peopleOf(it)?.o || RUB_O[it.rub] || OWL[it.cat] || OWL.money)}»`;
  const joke = it => { if (serious || Math.random() < .3) return []; const own = peopleOf(it)?.j; const pool = own?.length ? own : [...(COMEBACK[it.cat] || []), ...COMEBACK.money]; return uniq(pool.map(x => x.join('\n'))).split('\n'); };
  // сценка: если в выпуске есть тренд дня (Крот его повторяет) — без танцев в заставке; при 4–5 новостях — покороче
  const trendIn = items.some(it => (it.rub || rubricOf(it.title, it.cat)) === 'trend'), skits = SKITS.filter(k => !trendIn || !k.some(l => /подмигива|танцу/.test(l)));
  const skit = ownSkit?.length ? ownSkit : serious ? ['Со мной в студии Крот.'] : (x => many ? x.slice(0, 3) : x)(pick([...skits, ...skits, ...HELLO]));
  L.push(OPEN);
  if (items.length === 1) {
    const it = items[0];
    L.push(...skit, 'У нас срочная новость.', `Срочно: ${it.title}.`, ...it.body, ...react(it), advise(it), ...joke(it));
    L.push(pick(['Как думаешь, это хорошая новость или плохая? Пиши в комментариях!', 'Что думаешь об этом? Пиши в комментариях!', 'Перешли тому, кого это касается!']), ...FAREWELL);
    return L.join('\n');
  }
  const sorted = sortNews(items);
  // анонс: каждая новость — своя фраза (на экране сменяются их фото)
  L.push('Сегодня в выпуске:', ...sorted.map((it, i) => teaser(it, i === sorted.length - 1 && i > 0)));
  L.push(...skit);
  let prev = null;
  sorted.forEach((it, k) => {
    if (it.rub !== prev) L.push(pick(prev ? RUBRICS[it.rub].next : RUBRICS[it.rub].first)); prev = it.rub;
    L.push(`Новость ${ORD[k]}: ${it.title}.`, ...it.body.slice(0, items.length >= 3 ? 1 : 2));
    if (it.rub === 'trend' && !serious) L.push('Крот повторяет тренд.');
    L.push(...react(it));
    if (k === sorted.length - 1 || (many ? k % 2 === 1 : it.cat !== 'money' || RUB_O[it.rub])) L.push(advise(it));
    if (sorted.length === 2 ? k < 2 : sorted.length === 3 && k === 0) L.push(...joke(it));   // шутки — не после каждой новости, чтобы выпуск не затягивался
  });
  L.push(pick(['Какая новость удивила больше всего? Пиши в комментариях!', 'Какую новость разобрать подробнее? Пиши в комментариях!']), ...FAREWELL);
  return L.join('\n');
}
// ---------- особые пожелания автора: «в начале Крот пьёт Lit Energy и говорит: вот это заряд!» (+ фото товара) ----------
const VERB_DRINK = /(пь[её]т|выпива\S*|выпил\S*|попил\S*|попива\S*|пить|глот\S*)/i, VERB_EAT = /(\bест\b|съел\S*|куша\S*|пробу\S*|жу[её]т)/i, VERB_SHOW = /(показыва\S*|держит|доста[её]т|рекламиру\S*)/i;
const IMPERATIVE = /^(расскажи|скажи|сделай|упомяни|поговор|обсуд|подчеркни|акцент|не говори|добавь|покажи)/i;
/** Строки сценария по пожеланию: Крот пьёт/пробует/показывает товар и говорит фразу. where — 'start' (вместо сценки в начале) или 'end' (перед «Это были…»).
 *  ok=false — пожелание не разобрано (его учтёт только нейросеть или автор поправит текст сам). */
export function wishLines(wish = '') {
  const w = wish.trim(); if (!w) return { lines: [], where: 'start', ok: true };
  const where = /в конце|в финале|напоследок|в самом конце/i.test(w) ? 'end' : 'start';
  const say = (/«([^»]+)»/.exec(w)?.[1] || /(?:говорит|скажет|сказал|скажи|произносит)\s*[:—–-]?\s*["“]?([^\n"”]+)/i.exec(w)?.[1] || '').replace(/[.\s]+$/, '').trim();
  const sayLine = who => say ? `${who}: «${say.charAt(0).toUpperCase() + say.slice(1)}${/[!?…]$/.test(say) ? '' : '!'}»` : null;
  const obj = /(?:пь[её]т|выпива\S*|выпил\S*|попил\S*|попива\S*|ест|съел\S*|пробу\S*|показыва\S*|держит|доста[её]т|рекламиру\S*)\s+(?:банку|баночку|бутылку|стакан|стаканчик|пачку|упаковку)?\s*([^,.:;!?\n«]+?)(?=\s+и\s+|\s+говорит|[,.:;!?\n«]|$)/i.exec(w)?.[1]?.trim();
  if (obj && (VERB_DRINK.test(w) || VERB_EAT.test(w))) return { where, ok: true, lines: [...(where === 'start' ? ['Крот: «Сова, я совсем не выспался.»'] : []), `Крот ${VERB_DRINK.test(w) ? 'пьёт' : 'пробует'} ${obj}.`, sayLine('Крот') || 'Крот: «Вот это заряд! Я даже вижу!»', 'Сова: «Крот, мы вообще-то в эфире!»'] };
  if (obj && VERB_SHOW.test(w)) return { where, ok: true, lines: [`Крот показывает ${obj}.`, sayLine('Крот') || 'Крот: «Смотрите, что у меня есть!»'] };
  if (say) return { where, ok: true, lines: [sayLine(/сова/i.test(w.split(/говорит|скажет|сказал|скажи|произносит|«/i)[0]) ? 'Сова' : 'Крот')] };
  return { where, ok: false, lines: [] };
}
/** Вставляет строки пожелания в готовый сценарий: в начале — перед первой рубрикой/новостью, в конце — перед «Это были Зверо-новости». */
export function insertWish(script, { lines, where }) {
  if (!lines?.length) return script; const L = script.split('\n');
  let i = where === 'end' ? L.findIndex(l => /это были зверо-новост/i.test(l)) : L.findIndex(l => rubricOfLine(l) || /^(новость\s+\S+|срочно)\s*:/i.test(l.trim()) || /^у нас срочная/i.test(l.trim()));
  if (i < 0) i = where === 'end' ? L.length : Math.min(L.length, 2);
  L.splice(i, 0, ...lines); return L.join('\n');
}
/** Одевает выпуск по плану сезона: серия сюжета в начале, пожелание автора, происшествие в эфире, фирменное прощание в конце. */
export function dressEpisode(script, { beat = [], gagLines = [], gag = null, wish = null } = {}) {
  let L = script.split('\n').map(l => l.trim()).filter(Boolean);
  // прощание: всё после «Это были…» (кроме вопроса зрителям) убираем, в конце — фирменное
  const bi = L.findIndex(l => /это были зверо-новост/i.test(l));
  if (bi >= 0) { const q = L.slice(bi + 1).filter(l => /коммент|перешли|пиши/i.test(l) && !/^(Сова|Крот):/.test(l)); L = [...L.slice(0, bi), ...q]; }
  L.push(...FAREWELL);
  const firstNews = () => L.findIndex(l => rubricOfLine(l) || /^(новость\s+\S+|срочно)\s*:/i.test(l) || /^у нас срочная/i.test(l));
  const has = re => L.some(l => re.test(l));
  // серия сюжета — сразу перед первой рубрикой (если её ещё нет в тексте)
  if (beat.length && !has(new RegExp(beat[beat.length - 1].replace(/[.*+?^${}()|[\]\\«»]/g, '.')))) { const i = firstNews(); L.splice(i < 0 ? Math.min(2, L.length) : i, 0, ...beat); }
  if (wish?.lines?.length) L = insertWish(L.join('\n'), wish).split('\n');
  // происшествие: хлопушка — перед прощанием, остальное — после первой новости (до следующей рубрики или новости)
  if (gagLines.length && !has(new RegExp(gagLines[0].replace(/[.*+?^${}()|[\]\\]/g, '.')))) {
    const end = L.findIndex(l => /это были зверо-новост/i.test(l)), q = L.findIndex((l, i) => i < end && /коммент|перешли/i.test(l) && !/^(Сова|Крот):/.test(l));
    let i = gag === 'popper' ? (q >= 0 ? q : end) : -1;
    if (i < 0) { const f = firstNews(), next = L.findIndex((l, j) => j > f + 1 && (rubricOfLine(l) || /^новость\s+\S+\s*:/i.test(l))); i = next > 0 ? next : (q >= 0 ? q : end); }
    L.splice(i, 0, ...gagLines);
  }
  return L.join('\n');
}
/** Заметка автора к новости («главное: …») — первой строкой сути; просьба («расскажи про цену») — только для нейросети. */
export function applyNote(it, note) {
  note = (note || '').trim(); if (!note) return it; it.note = note;
  if (!IMPERATIVE.test(note)) it.body = [note.replace(/^(важно|главное|суть)\s*[:—–-]\s*/i, '').replace(/^./, c => c.toUpperCase()).replace(/([^.!?…])$/, '$1.'), ...it.body].slice(0, 3);
  return it;
}
/** Порядок выпуска: по рубрикам (звёзды → технологии → новинки → главное → тренд → хорошее), внутри рубрики — как прислали. */
export const sortNews = items => items.map((it, i) => ({ ...it, rub: it.rub || rubricOf(it.title, it.cat), i })).sort((a, b) => RUB_ORDER.indexOf(a.rub) - RUB_ORDER.indexOf(b.rub) || a.i - b.i);
/** Примерная длина выпуска в секундах (речь ~15 знаков/с + паузы между фразами). */
export const newsDuration = script => Math.round(script.split('\n').reduce((a, l) => a + l.length / 15 + .45, 0));
export function newsSeo(items) {
  const t = items[0].title, cut = (s, n) => s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)) + '…';
  const titles = items.length === 1 ? [`${cut(t, 60)} — что это значит для тебя`, `Срочно: ${cut(t, 70)}`, `${cut(t, 60)} | Зверо-новости`] : [`Зверо-новости: ${cut(t, 50)} и ещё ${items.length - 1}`, `${items.length} новости дня за минуту: ${cut(t, 45)}`];
  const cats = [...new Set(items.map(i => i.cat))], src = items.filter(i => i.link);
  const about = `${items.map((it, i) => `${items.length > 1 ? `${i + 1}) ` : ''}${it.title}. ${it.body[0] || ''}`).join('\n')}\n\nЗверо-новости: Сова коротко рассказывает главное про деньги, работу и технологии, а Крот задаёт глупые вопросы.${src.length ? `\n\nИсточники: ${src.map(i => `${i.source || ''} ${i.link}`.trim()).join(' · ')}` : ''}`;
  return { series: 'news', topic: cut(t, 40), title: pick([titles[0], ...titles]), tags: ['новости', 'зверо-новости', 'новости дня', ...cats.flatMap(c => TAGS[c] || [])].slice(0, 12), about, hash: ['новости', cats.includes('ai') ? 'нейросети' : 'деньги'], promise: NEWS_GIFT.promise };
}
export const NEWS_GIFT = { series: 'news', promise: 'Главные новости про деньги и технологии — коротко, каждый день',
  say: 'Ещё больше новостей — коротко и по делу — каждый день в нашем Telegram.',
  post: 'Зверо-новости: главное про деньги, работу и технологии — коротко и без паники. Сова объясняет, что это значит для тебя, а Крот задаёт вопросы, которые стесняешься задать ты 🦉' };

// ---------- настоящие фото и видео к новостям ----------
// 1) то, что прислал автор (фото/видео в Telegram) — главное; 2) картинка статьи по ссылке (og:image, с подписью источника);
// 3) фото людей из заголовка — главное фото статьи в Википедии (свободная лицензия, автор и лицензия — в подписи)
const WUA = { 'user-agent': 'ZveroNewsBot/1.0 (motion-studio; news shorts)' };
const nameRe = /([А-ЯЁ][а-яё]{2,})\s+([А-ЯЁ][а-яё]{2,}(?:-[А-ЯЁ][а-яё]+)?)/g, NOT_NAME = /^(Новость|Срочно|Компания|Банк|Минфин|Госдума|Центробанк|Россия|Москва|Санкт|Сбер|Яндекс|Озон)$/;
export const personNames = text => [...text.matchAll(nameRe)].filter(m => !NOT_NAME.test(m[1])).map(m => m[1] + ' ' + m[2]).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2);
async function download(url, file, headers = UA) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error('HTTP ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer()); if (buf.length < 3000) throw new Error('маленький файл'); fs.writeFileSync(file, buf); return file;
}
const stripHtml = s => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
/** Фото человека: статья Википедии по имени → её главное фото; подпись — автор и лицензия с Wikimedia Commons. */
export async function findPersonPhoto(name, dir) {
  const q = await (await fetch(`https://ru.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&srsearch=${encodeURIComponent(name)}`, { headers: WUA, signal: AbortSignal.timeout(15000) })).json();
  const last = name.split(' ').pop().slice(0, 5).toLowerCase(), hit = (q.query?.search || []).find(x => x.title.toLowerCase().includes(last)); if (!hit) return null;
  const sum = await (await fetch(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`, { headers: WUA, signal: AbortSignal.timeout(15000) })).json();
  const src = sum.thumbnail?.source?.replace(/\/\d+px-/, '/800px-') || sum.originalimage?.source; if (!src) return null;
  let credit = 'Фото: Wikimedia Commons';
  try {
    const fileName = decodeURIComponent(src.split('/').filter(x => !/^\d+px-/.test(x)).pop()).replace(/^\d+px-/, '');
    const meta = await (await fetch(`https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=extmetadata&format=json&titles=File:${encodeURIComponent(fileName)}`, { headers: WUA, signal: AbortSignal.timeout(15000) })).json();
    const em = Object.values(meta.query?.pages || {})[0]?.imageinfo?.[0]?.extmetadata || {};
    credit = `Фото: ${stripHtml(em.Artist?.value).slice(0, 60) || 'Wikimedia Commons'}${em.LicenseShortName?.value ? ' / ' + em.LicenseShortName.value : ''}`;
  } catch { /* подпись по умолчанию */ }
  const file = path.join(dir, 'wiki_' + Buffer.from(name).toString('hex').slice(0, 24) + '.jpg');
  await download(src, file, WUA); return { kind: 'photo', file, credit, who: name };
}
/** К каждой новости — до двух кадров: свои → картинка статьи → фото людей из заголовка. Ничего не нашлось — во вставке будет мультик. */
export async function collectMedia(items, dir) {
  fs.mkdirSync(dir, { recursive: true });
  for (const it of items) {
    it.media = [...(it.media || [])];
    if (it.media.length < 2 && it.imageUrl) { try { it.media.push({ kind: 'photo', file: await download(it.imageUrl, path.join(dir, 'og_' + it.id.replace(/\W/g, '') + '.jpg')), credit: `Фото: ${it.source || 'источник новости'}` }); } catch (e) { console.error('og:image', e.message); } }
    for (const name of personNames(it.title)) { if (it.media.length >= 2) break; try { const ph = await findPersonPhoto(name, dir); if (ph) it.media.push(ph); } catch (e) { console.error('wiki photo', name, e.message); } }
  }
  return items;
}

