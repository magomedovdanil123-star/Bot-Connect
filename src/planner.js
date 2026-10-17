// Сценарий -> план ролика. Без нейросетей: правила разбора русского текста.
// Каждая фраза получает тип анимации (type), параметры (p) и индексы слов-акцентов (acc).

const STOP = new Set(('и в во не на но что как это его её их он она они мы вы ты я к ко с со у о об от до за из по для при без над под про же ли бы то так там тут уже ещё еще всё все весь вся этот эта эти тот та те который которая которые которое может могут было быть будет есть нет да или а если чтобы когда тогда чем также тоже очень более менее самый самое самая сам себя себе свой своего своей'
  ).split(' '));
const ORD = { перв: 1, втор: 2, трет: 3, четв: 4, пят: 5, шест: 6, седьм: 7, восьм: 8, девят: 9, десят: 10 };
const SYMBOLS = { bitcoin: 'BTC', btc: 'BTC', биткоин: 'BTC', litecoin: 'Ł', ltc: 'Ł', лайткоин: 'Ł', ethereum: 'Ξ', eth: 'Ξ', эфириум: 'Ξ', solana: 'S', sol: 'S', ton: 'T', tether: '₮', usdt: '₮', dogecoin: 'Ð', doge: 'Ð', xrp: 'X', ripple: 'X' };

// глаголы, причастия на -ющий и служебные слова в карточки не берём
const VERBISH = /(ться|тся|(?<!с)ть|ет|ют|ит|ят|ал|ала|али|ало|ил|ило|ила|или|лись|лась|лось|лся|сла|сло|сли|шла|шло|шли|ешь|ишь|ем|им|ете|ите|ющ\S*|вш\S*)$/;
const junk = w => { const l = w.toLowerCase(); return STOP.has(l) || l.startsWith('котор') || /^(того|этого|своего|которых|такого|также|потому|поэтому|сейчас|здесь|теперь|именно|просто|примерно|около|вообще|скорее|прежде|насколько|несколько)$/.test(l) || VERBISH.test(l); };
const clean = w => w.replace(/^[«"“(\[]+|[»"”)\].,!?:;…]+$/g, '');
const low = w => clean(w).toLowerCase();
const words = s => s.split(/\s+/).filter(Boolean);
const isLatinEntity = w => /^[A-Z][A-Za-z0-9-]{1,}$|^[A-Z0-9]{2,6}$/.test(clean(w)) && !/^\d+$/.test(clean(w));
const NUM_RE = /(\d[\d\s]*(?:[.,]\d+)?)\s*(%|млрд|млн|тыс|миллиард\S*|миллион\S*|тысяч\S*|лет|год\S*|минут\S*|секунд\S*|час\S*|дн\S*|раз\S*|монет\S*|долл\S*|\$|₽|руб\S*)?/i;

export function splitSentences(script) {
  const out = [];
  const paras = script.replace(/\r/g, '').split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean);
  for (const p0 of paras) {
    // точки внутри адресов сайтов (pampadu.ru) не конец фразы: прячем их на время разбивки
    const p = p0.replace(/([a-z0-9-])\.(?=[a-z]{2,}\b)/gi, '$1\u2024');
    const parts = (p.match(/[^.!?…]+(?:[.!?…]+["»”]?|$)/g) || [p]).map(x => x.replace(/\u2024/g, '.'));
    let buf = [];
    const flush = () => { if (buf.length) out.push(buf.join(' ').trim()); buf = []; };
    for (let s of parts.map(x => x.trim()).filter(Boolean)) {
      // склеиваем подряд идущие вопросы одного абзаца и очень короткие хвосты
      const isQ = s.endsWith('?');
      if (buf.length && isQ && buf[buf.length - 1].endsWith('?')) { buf.push(s); continue; }
      if (buf.length && words(s).length <= 2 && !isQ) { buf.push(s); continue; }
      flush(); buf.push(s);
    }
    flush();
  }
  return out;
}

function entities(sentence) {
  const ws = words(sentence); const out = [];
  ws.forEach((w, i) => {
    const c = clean(w);
    if (isLatinEntity(w)) out.push({ text: c, wi: i });
    else if (i > 0 && /^[А-ЯЁ][а-яё]{2,}$/.test(c) && !/[.!?…:]$/.test(ws[i - 1])) out.push({ text: c, wi: i });
  });
  // склеиваем соседние (Litecoin Trust, Чарли Ли)
  const merged = [];
  for (const e of out) { const last = merged[merged.length - 1]; if (last && last.end === e.wi - 1 && !/[,.;:!?—]$/.test(ws[e.wi - 1])) { last.text += ' ' + e.text; last.end = e.wi; } else merged.push({ ...e, end: e.wi }); }
  return merged;
}
function numbers(sentence) {
  const ws = words(sentence); const res = [];
  ws.forEach((w, i) => {
    const c = clean(w).replace(/^[$₽]/, '');
    if (/^\d+([.,]\d+)?$/.test(c)) {
      // число может быть разбито пробелами: "21 000 000"
      let j = i, val = c; while (j + 1 < ws.length && /^\d{3}[.,]?$/.test(clean(ws[j + 1])) && /^\d{1,3}$/.test(clean(ws[j]))) { j++; val += clean(ws[j]); }
      if (res.length && res[res.length - 1].end >= i) return;
      const unit = j + 1 < ws.length ? clean(ws[j + 1]) : '';
      const isUnit = NUM_RE.test('1 ' + unit) && (NUM_RE.exec('1 ' + unit)[2] || '').length > 0;
      res.push({ raw: val, value: parseFloat(val.replace(',', '.')), wi: i, end: j, unit: isUnit ? unit : '', unitWi: isUnit ? j + 1 : -1, dollar: /^\$/.test(clean(w)) });
    }
  });
  return res;
}
function keywords(sentence, n = 3, exclude = new Set()) {
  const ws = words(sentence); const ents = entities(sentence);
  const picked = [];
  for (const e of ents) if (!exclude.has(e.wi) && picked.length < n) picked.push({ text: e.text, wi: e.wi });
  const cand = ws.map((w, i) => ({ text: clean(w), wi: i })).filter(x => x.text.length >= 5 && !junk(x.text) && !/\d/.test(x.text) && !exclude.has(x.wi) && !picked.some(p => p.wi === x.wi));
  cand.sort((a, b) => b.text.length - a.text.length);
  for (const c of cand) { if (picked.length >= n) break; picked.push(c); }
  return picked.sort((a, b) => a.wi - b.wi);
}
function listItems(sentence) {
  // перечисление: части после двоеточия/тире, разделённые запятыми и "и"
  let body = sentence.replace(/[.!?…]+$/, '');
  let head = null; const colon = body.search(/[:—]\s/);
  if (colon > 0 && colon < body.length * .8) { if (body[colon] === ':') head = words(body.slice(0, colon)).map(clean).filter(x => !junk(x)).slice(-1).join(' ') || null; body = body.slice(colon + 1); }
  const parts = body.split(/,\s*|\s+и\s+|\s+а\s+также\s+/).map(s => s.trim()).filter(s => s.length > 1);
  const avg = parts.reduce((a, p) => a + words(p).length, 0) / parts.length;
  return parts.length >= 3 && avg <= 3.6 ? Object.assign(parts.slice(0, 6).map(p => words(p).map(clean).filter(x => !junk(x)).slice(-2).join(' ')).filter(Boolean), { head }) : null;
}
const short = (s, n = 4) => { const w = words(s.replace(/[.,!?…:;—«»"]/g, ' ')); return w.slice(0, n).join(' ') + (w.length > n ? '…' : ''); };
const symbolFor = name => { if (!name) return '◆'; const k = name.toLowerCase().split(' ')[0]; return SYMBOLS[k] || name[0].toUpperCase(); };
function wiOf(sentence, re) { const ws = words(sentence); const i = ws.findIndex(w => re.test(low(w))); return i; }
// поиск по НАЧАЛУ слова: «рост» не должен находиться в «скорость»
const has = (L, re) => new RegExp('(^|[^а-яёa-z0-9])(' + re.source + ')', 'i').test(L);
const stemRe = re => new RegExp('^(' + re.source + ')', 'i');


// ---------- истории с персонажами ----------
// Имена (с падежами) -> герои; глаголы -> действия: получает, платит, тратит, кэшбэк, копит, растёт, думает, радуется, грустит
const FEMALE_N = 'Маша Мария Катя Аня Анна Оля Ольга Лена Елена Таня Татьяна Наташа Наталья Света Светлана Юля Юлия Даша Дарья Настя Анастасия Ира Ирина Вика Виктория Алиса Полина Соня Софья Ксюша Ксения Марина Вера Надя Кристина Алёна Алена Лиза'.split(' ');
const MALE_N = 'Дима Миша Иван Ваня Петя Андрей Алексей Лёша Сергей Серёжа Коля Артём Артем Максим Макс Игорь Олег Паша Павел Антон Илья Денис Егор Кирилл Никита Рома Роман Влад Вова Тимур Руслан Саша Женя Костя Степан Глеб Марк'.split(' ');
const NAME_RES = [...FEMALE_N.map(n => [n, true]), ...MALE_N.map(n => [n, false])].map(([n, female]) => {
  let re;
  if (/[ая]$/.test(n)) re = new RegExp('^' + n.slice(0, -1) + '(а|я|и|ы|е|у|ю|ей|ой|ою|ею)$');
  else if (/[йь]$/.test(n)) re = new RegExp('^' + n.slice(0, -1) + '(й|ь|я|ю|ем|е|ём)$');
  else re = new RegExp('^' + n + '(а|у|ом|е)?$');
  return { name: n, female, re };
});
const nameOf = w => { const c = clean(w); if (/^хомя(к|ка|ку|ком|ке|чок|чка|чку)$/i.test(c)) return { name: 'Хомяк', female: false, kind: 'hamster' }; if (/^кот(а|у|ом|е)?(-банкир\S*)?$/i.test(c)) return { name: 'Кот', female: false, kind: 'cat' }; if (!/^[А-ЯЁ]/.test(c)) return null; const r = NAME_RES.find(x => x.re.test(c)); return r ? { name: r.name, female: r.female } : null; };
const ACTION_RULES = [
  ['shades', /^(очк|очки)/], ['grab', /^(забира|забрал|отбира|отобрал|ворует|своровал|украл|съеда|съел|комисси)/], ['laugh', /^(смеёт|смеет|хохоч|ухмыл)/],
  ['hello', /^(привет|знакомьтесь|знакомься)/], ['panic', /^(паник|испуг|ужас|шок)/], ['rocket', /^(ракет|лети|летит|улета|взлета|взлетел)/],
  ['wheel', /^(колес|кругу|беличь)/], ['sleep', /^(спит|спят|сон|сна|отдыха|дремл|пассивн)/], ['chart', /^(анализ|изуча|график|разбира|прогноз)/],
  ['calc', /^(счита|посчита|подсчита|калькул)/], ['scratch', /^(запута|непонят|странн|хм+)/],
  ['think', /^(дума|задума|подума|гадает|интересно)/], ['cashback', /^(кэшб|кешб|возвращ|вернул|верну)/],
  ['save', /^(отклад|отлож|копит|копят|копил|копила|сбереж|сберег|сэконом|эконом)/], ['spend', /^(трат|потрат|растрат|спуска|спустил)/],
  ['pay', /^(плат|оплач|оплат|покупа|купил|купит)/], ['receive', /^(получ|заработ|зарабат)/],
  ['grow', /^(вырос|растёт|растет|приумнож|умнож)/], ['happy', /^(рад|радует|довол|счастл|ура)/], ['sad', /^(груст|расстро|плач|переживает|долг)/],
];
// место действия по смыслу фразы (локации чернильной темы)
const PLACES = [['space', /(^|\s)(лун[аеуыой]|космос|ракет)/], ['exchange', /бирж|акци[ийя]|трейд|инвест|брокер|портфел/], ['bank', /банк|вклад|кредит|ипотек|накопительн/],
  ['shop', /магазин|супермаркет|покупк|продукт|скидк|касс[аеуы]|цен[ыау]/], ['office', /офис|на работ[еу]|с работы|зарплат|начальник|коллег/], ['street', /город|улиц|прогулк/], ['home', /(^|\s)дом(а|ой|у)?(\s|$|[,.!?])|квартир|диван|кроват/],
  // студия блогера: хомяк ведёт выпуск и говорит со зрителями
  ['studio', /(^|[\s,])(ребят|ребята|друзья|всем привет|привет всем|на канале|в этом видео|в этом выпуске|сегодня (я |мы )?(разбер|расскаж|покаж|хочу|попробу|проверю|провер)|покажу|расскажу|разберём|разберу|честно скажу)/]];
const CROWD_RE = /хомяки|хомяков|толп|миллион\S* (людей|хомяк|человек)|все вокруг/;
const YOU_RE = /(^|[\s,])(ты|тебе|тебя|твой|твоя|твои|твоих|твоего|вы|вам|вас|ваш|ваши|смотри|запомни|представь)([\s,.!?]|$)/i;
function storyScene(s, ctx, mark, R, opts = {}) {
  // слова в «кавычках» — цитата (например, с сайта): по ним не выбираем место и действие
  const st = ctx.story, ws = words(s.replace(/«[^»]*»/g, m => m.replace(/[^\s]+/g, '…'))), L0 = s.toLowerCase().replace(/«[^»]*»/g, '');
  const named = []; ws.forEach((w, i) => { const n = nameOf(w); if (n && !named.some(x => x.name === n.name)) named.push({ ...n, wi: i }); });
  const pron = ws.some(w => /^(она|он|они|её|его|ей|ему|им|их|обе|оба)$/i.test(clean(w)));
  const mascot = st.order.some(o => o.kind === 'hamster');
  // с талисманом история продолжается и на «толпе», и на обращении к зрителю
  // режим «Хомяк-история»: хомяк сам проживает фразы с действием или местом, даже если его не назвали
  const forced = st.forced && (ws.some(w => ACTION_RULES.some(([, re]) => re.test(low(w)))) || (PLACES.some(([, re]) => re.test(L0)) && !numbers(s).length));
  if (!named.length && !(pron && st.prev) && !forced && !(mascot && (CROWD_RE.test(L0) || YOU_RE.test(s) || opts.subscribe))) return null;
  for (const n of named) if (!st.order.some(o => o.name === n.name)) st.order.push({ name: n.name, female: n.female, kind: n.kind });
  // кто на сцене: те, кто был, плюс названные (не больше двух)
  let cast = st.prev ? [...st.last] : [];
  for (const n of named) if (!cast.includes(n.name)) cast.push(n.name);
  cast = cast.slice(-2); if (!cast.length) cast = st.last.slice(); if (!cast.length && mascot) cast = [st.order.find(o => o.kind === 'hamster').name];
  // действия по глаголам
  const L = L0; let acts = [];
  ws.forEach((w, i) => { const lw = low(w); for (const [kind, re] of ACTION_RULES) if (re.test(lw) && !acts.some(a => a.kind === kind)) { acts.push({ kind, wi: i, plural: /(ют|ут|ат|ят|ли)$/.test(lw) }); break; } });
  if (/до копейки|всё ушло|все ушло/.test(L) && !acts.some(a => a.kind === 'spend')) acts.push({ kind: 'spend', wi: ws.length - 1 });
  if (acts.some(a => a.kind === 'cashback')) acts = acts.filter(a => a.kind !== 'receive');
  if (/(^|\s)(больше|меньше|разница)/.test(L)) { const wi = ws.findIndex(w => /^(больше|меньше|разница)/.test(low(w))); acts = acts.filter(a => a.kind !== 'grow'); const nw = numbers(s)[0]?.wi; acts.push({ kind: cast.length > 1 ? 'compare' : 'grow', wi: nw != null ? Math.min(nw, wi) : wi }); }
  // «отбирать деньги» — роль Кота-банкира; без него глагол ничего не значит
  if (!cast.some(n => (st.order.find(o => o.name === n) || {}).kind === 'cat') && !named.some(n => n.kind === 'cat')) acts = acts.filter(a => a.kind !== 'grab');
  if (!acts.length && /^(а\s+)?(это|знакомьтесь|встречайте)\s/i.test(s.trim()) && named.length) acts.push({ kind: 'hello', wi: named[named.length - 1].wi });
  // вопрос зрителю («А ты…?») — хомяк обращается в камеру, а не разыгрывает действие
  if (YOU_RE.test(s) && /\?\s*$/.test(s.trim()) && mascot) acts = acts.filter(a => !['pay', 'spend', 'grab', 'cashback', 'receive', 'save'].includes(a.kind));
  if ((YOU_RE.test(s) || opts.subscribe) && mascot && !acts.some(a => a.kind !== 'talk' && a.kind !== 'think')) { acts = acts.filter(a => a.kind !== 'think'); acts.push({ kind: 'address', wi: Math.max(0, ws.findIndex(w => YOU_RE.test(' ' + clean(w) + ' '))) }); }
  if (/не понима/.test(L) && !acts.length) acts.push({ kind: 'scratch', wi: ws.findIndex(w => /^понима/.test(low(w))) });
  if (!acts.length && /инфляц/.test(L)) acts.push({ kind: 'wheel', wi: ws.findIndex(w => /^инфляц/.test(low(w))) });
  if (!acts.length && s.includes('?')) acts.push({ kind: 'think', wi: 0 });
  if (!acts.length && /зарплат|доход/.test(L)) acts.push({ kind: 'receive', wi: ws.findIndex(w => /зарплат|доход/.test(low(w))) });
  if (!acts.length) acts.push({ kind: 'talk', wi: Math.min(1, ws.length - 1) });
  acts.sort((a, b) => a.wi - b.wi); acts = acts.slice(0, 2);
  // сумма: число + валюта, достаётся последнему «денежному» действию
  const nums = numbers(s); let value = '';
  if (nums.length) { const n = nums[0], u = (clean(ws[n.end + 1] || '')).toLowerCase(); value = n.raw.replace(/(\d)(?=(\d{3})+$)/g, '$1 ') + (/^(руб|₽)/.test(u) ? ' ₽' : /^(долл|\$)/.test(u) || n.dollar ? ' $' : n.unit ? ' ' + n.unit : ''); mark(n.wi); }
  const money = acts.filter(a => a.kind !== 'pay' && a.kind !== 'think' && a.kind !== 'talk');
  // исполнители: множественное число или «обе/оба» — все на сцене, иначе ближайший названный (или последний действовавший)
  const out = [];
  for (const a of acts) {
    const before = named.filter(n => n.wi <= a.wi), who = a.kind === 'address' ? [st.order.find(o => o.kind === 'hamster').name] : a.plural || /(^|\s)(обе|оба|они|вместе)(\s|$)/.test(L) ? cast : [(before[before.length - 1] || named[0])?.name || st.lastActors[0] || cast[0]];
    for (const w of who) out.push({ who: w, kind: a.kind, wi: a.wi, value: money.length && a === money[money.length - 1] ? value : '' });
    mark(a.wi);
  }
  named.forEach(n => mark(n.wi));
  // пузырь мыслей: «Как?», «Почему?» — первое вопросительное слово
  const q = (s.split(':')[1] || s).trim(), qw = /^(как|что|почему|где|сколько|зачем|когда|откуда)/i.exec(q);
  const bubble = qw ? qw[1][0].toUpperCase() + qw[1].slice(1).toLowerCase() + '?' : '?';
  // место: по ключевым словам, иначе по действию (оплата — магазин, зарплата — офис), иначе прежнее
  let place = PLACES.find(([, re]) => re.test(L))?.[0];
  if (!place && !st.place) place = out.some(a => a.kind === 'pay' || a.kind === 'cashback') ? 'shop' : out.some(a => a.kind === 'receive') ? 'office' : null;
  place = place || st.place || 'home'; st.place = place;
  const moved = st.prevPlace && st.prevPlace !== place; st.prevPlace = place;
  // второстепенный герой (например, Кот) не ходит за хомяком в новое место и не стоит рядом в финале — остаются названные и действующие
  if (moved || opts.subscribe) { const keep = new Set([...named.map(n => n.name), ...out.map(a => a.who)]); const ham = st.order.find(o => o.kind === 'hamster')?.name; if (ham) keep.add(ham); cast = opts.subscribe && ham ? [ham] : cast.filter(n => keep.has(n)); if (!cast.length && ham) cast = [ham]; }
  const scene = R('story', { cast: cast.map(n => ({ name: n, enter: !st.prev || !st.last.includes(n) || moved, fromAct: st.fromAct[n] || null })), acts: out, card: /карт/.test(L), bubble,
    place, crowd: mascot && CROWD_RE.test(L), subscribe: !!opts.subscribe, speak: mascot && /(^|[\s,])(я|мы|мне|меня|мой|моя|мои|наш|наши|нам)([\s,.!?]|$)/i.test(s) });
  for (const a of out) st.fromAct[a.who] = a.kind;
  st.last = cast; st.lastActors = [...new Set(out.map(a => a.who))];
  return scene;
}

function classify(s, ctx) {
  const ws = words(s), L = s.toLowerCase(), nWords = ws.length;
  const ents = entities(s), nums = numbers(s);
  const main = ents[0]?.text || ctx.main;
  const acc = new Set();
  const mark = (...idx) => idx.forEach(i => { if (i >= 0) acc.add(i); });
  ents.forEach(e => { for (let i = e.wi; i <= e.end; i++) acc.add(i); });
  nums.forEach(n => { for (let i = n.wi; i <= n.end; i++) acc.add(i); mark(n.unitWi); });
  const R = (type, p = {}, cap = true) => ({ type, p, cap, acc: [...acc], numWis: nums.map(n => n.wi), entWis: ents.map(e => e.wi) });

  // зовём в Telegram: телефон с каналом и подсказка, где ссылка (в профиле — для Shorts, в описании — для роликов)
  if (/телеграм|telegram|тг-канал/i.test(s)) { mark(wiOf(s, /телеграм|telegram/i)); ctx.story.prev = false; return R('tgcta', { where: /профил|шапк/i.test(s) ? 'profile' : 'desc' }); }
  if (has(L, /подпис/) && has(L, /подпис\S*сь|подпиши|подписывай/) && ctx.story.order.some(o => o.kind === 'hamster')) { const sc = storyScene(s, ctx, mark, R, { subscribe: true }); if (sc) return sc; }
  if (has(L, /подпис/) && has(L, /подпис\S*сь|подпиши|подписывай/)) { mark(wiOf(s, stemRe(/подпис/))); return R('subscribe', { items: keywords(s, 3).map(k => k.text) }); }
  // как работают рефералы: друзья по ссылке → процент герою
  if (/приглаша|по (твоей|своей|моей|личной|реферальной) ссылк|партн[её]рск\S* (программ|ссылк)/i.test(s) && !/ссылк\S*.*(описани|закреп)/i.test(s) && !ctx.refDone) {
    const m = /(\d+(?:[.,]\d+)?)\s?%/.exec(s); ctx.story.prev = false; ctx.refDone = true; return R('referral', { pct: m ? m[1] + '%' : '' });
  }
  // адрес сайта в тексте («заходим на pampadu.ru») — бот откроет сайт и покажет его в окне браузера
  const site = /(?:https?:\/\/)?((?:[a-z0-9-]+\.)+(?:ru|com|рф|net|org|io|app|pro|online|site|me|biz|info|su))(\/[^\s,»"]*)?/i.exec(s);
  // «текст в кавычках» в такой строке — что подсветить на странице (кнопка, раздел, цифра)
  const quote = (/[«"“]([^»"”]{2,60})[»"”]/.exec(s) || [])[1]?.trim();
  if (site && !/@/.test(s.slice(Math.max(0, site.index - 1), site.index))) {
    mark(wiOf(s, new RegExp(site[1].split('.')[0], 'i'))); ctx.story.prev = false;
    ctx.lastScreen = { url: 'https://' + site[1].toLowerCase() + (site[2] || '').replace(/[.!?]+$/, ''), domain: site[1].toLowerCase() };
    return R('screen', { ...ctx.lastScreen, highlight: quote || '' });
  }
  // следом за сайтом строка с «кавычками» — тот же сайт, подсвечиваем указанное
  if (quote && ctx.lastScreen && ctx.sinceScreen <= 2) { ctx.story.prev = false; return R('screen', { ...ctx.lastScreen, highlight: quote }); }
  // с талисманом ссылка — это сцена предложения: хомяк показывает карту, выгоды и маркировку рекламы
  if (has(L, /ссылк/) && has(L, /описани|закреп/) && ctx.story.order.some(o => o.kind === 'hamster')) { mark(wiOf(s, stemRe(/ссылк/))); ctx.story.prev = false; return R('offer', {}); }
  if (has(L, /ссылк/) && has(L, /профил|шапк|описани|био|закреп/)) { mark(wiOf(s, stemRe(/ссылк/))); return R('link', { label: short(s.split(/—|-/)[0], 4).toUpperCase() }); }
  if (has(L, /финансов\S* (совет|рекомендац)|не является|не рекомендац|на свой риск|оценивай риск/)) {
    const items = (s.split(/[.:]/).slice(1).join('.').split(/,\s*|\s+и\s+/).map(x => x.trim()).filter(x => x.length > 3)).slice(0, 3);
    return R('warning', { items: items.length ? items : ['ИЗУЧАЙ ПРОЕКТ', 'ОЦЕНИВАЙ РИСКИ'] });
  }
  const ch = /^(?:(?:и|а|итак|ну)\s+)?(перв|втор|трет|четв|пят|шест|седьм|восьм|девят|десят)\S*\s*(история|причина|пункт|фактор|шаг|момент|совет|правило|ошибка)?(?:\s+[а-яё]+)?\s*[—:-]\s*(.+)$/i.exec(s.trim());
  if (ch && nWords <= 10) { const num = ORD[ch[1].toLowerCase()]; return R('chapter', { num: String(num).padStart(2, '0'), kick: (ch[2] || 'часть').toUpperCase() + ' ' + String(num).padStart(2, '0'), title: ch[3].replace(/[.!…]+$/, '').toUpperCase() }, false); }
  if (/^(но\s+)?(подожди|стоп|постой|секунду|внимание)[.!…]*$/i.test(s.trim())) return R('stop', { text: s.trim().toUpperCase() }, false);
  const story = storyScene(s, ctx, mark, R); if (story) return story;
  if (s.includes('?')) {
    const qs = s.split(/(?<=\?)/).map(x => x.trim()).filter(x => x.endsWith('?'));
    if (qs.length >= 2) return R('questions', { qs: qs.slice(0, 4) });
    if (nWords <= 9) return R('heroQ', { text: s.trim() }, false);
    return R('questions', { qs });
  }
  if (nWords <= 5 && !nums.length) return R('hero', { text: s.trim() }, false);
  const strikeM = /это не (?:история )?про\s+(.+?)[.!]*$/i.exec(s) || /^(?:но\s+)?это не означает,? что (.+?)[.!]*$/i.exec(s);
  if (strikeM && nWords <= 12) return R('strike', { kick: s.slice(0, s.toLowerCase().indexOf(strikeM[1].toLowerCase())).trim(), word: strikeM[1].toUpperCase() }, false);
  // два числа + сравнение
  if (nums.length >= 2 && /(^|\s)с\s+\$?\d/.test(L) && /\sдо\s+\$?\d/.test(L)) {
    const a = nums[0], b = nums[1];
    return R('fromTo', { from: a.value, to: b.value, rawFrom: a.raw, rawTo: b.raw, unit: b.unit || clean(words(s)[b.end + 1] || ''), label: keywords(s, 2, new Set([a.wi, b.wi])).map(k => k.text).join(' · ') });
  }
  if (nums.length >= 2 && has(L, /то |тогда как|против|а у|в то время|vs/)) {
    const a = nums[0], b = nums[1];
    const nameNear = n => { let best = null; for (const e of ents) if (e.wi < n.wi && (!best || e.wi > best.wi)) best = e; return best?.text || ''; };
    return R('compare', { a: { label: nameNear(a) || 'A', value: a.value, raw: a.raw, unit: a.unit }, b: { label: nameNear(b) || 'B', value: b.value, raw: b.raw, unit: b.unit } });
  }
  const yrs = nums.filter(n => n.value >= 1990 && n.value <= 2100 && Number.isInteger(n.value));
  if (yrs.length) return R('timeline', { year: yrs[0].value, years: yrs.map(y => y.value), label: keywords(s, 1, new Set([yrs[0].wi]))[0]?.text || '' });
  if (nums.length) { const n = nums[0]; return R('counter', { value: n.value, raw: n.raw, unit: n.unit, label: keywords(s, 2, new Set([n.wi, n.unitWi])).map(k => k.text).join(' · '), dollar: n.dollar }); }
  // три и больше монет/проектов в одной фразе -> 3D-карусель
  const latin = ents.filter(e => /^[A-Z]/.test(e.text));
  if (latin.length >= 3) {
    const tail = s.split(/\s[—:-]\s|:\s/)[1] || '';
    const hub = words(tail).map(clean).find(w => w.length >= 4 && !junk(w) && !isLatinEntity(w)) || ctx.main || 'РЫНОК';
    return R('orbit', { items: latin.slice(0, 6).map(e => ({ name: e.text, sym: symbolFor(e.text), wi: e.wi })), hub: hub.toUpperCase() });
  }
  if (ents.length >= 2 && has(L, /то|тогда как|в отличие|против|vs/) && ents[0].text !== ents[1].text) {
    const CMP = /^(против|vs|то|тогда|как|отличие|или)$/i;
    const desc = e => { const w = words(s).slice(e.end + 1, e.end + 7).map(clean).filter(x => x && /[а-яё]/i.test(x) && !junk(x) && !isLatinEntity(x) && !CMP.test(x)); return w.slice(0, 2).join(' '); };
    // «X против Y: цифровое золото против платформы» — описания из второй половины фразы
    const tail = s.split(/:\s|\s[—-]\s/)[1], halves = tail && tail.replace(/[.!…]+$/, '').split(/\s+(?:против|vs|или)\s+/i);
    const da = halves?.length === 2 ? words(halves[0]).slice(0, 3).join(' ') : desc(ents[0]), db = halves?.length === 2 ? words(halves[1]).slice(0, 3).join(' ') : desc(ents[1]);
    return R('versus', { a: { name: ents[0].text, sym: symbolFor(ents[0].text), desc: da }, b: { name: ents[1].text, sym: symbolFor(ents[1].text), desc: db } });
  }
  const items = listItems(s);
  if (items) {
    if (/^(изучай|оценивай|не |проверяй|смотри|следи|делай|покупай|продавай)/i.test(items[1] || '')) return R('checklist', { items: items.map(x => x.toUpperCase()) });
    const net = ctx.flip(), hubFirst = net && !items.head && items.length >= 4;
    return R(net ? 'network' : 'chain', { items: (hubFirst ? items.slice(1) : items).map(x => x.toUpperCase()), hub: (items.head || (hubFirst ? items[0] : main) || '').toUpperCase() });
  }
  if (has(L, /скорост|мгновенн|быстр|молниенос|разгон|гиперзвук|сверхзвук/)) { mark(wiOf(s, stemRe(/скорост|мгновенн|быстр|молниенос|разгон/))); const clause = s.split(/,\s*|\s+(?:а|но|и)\s+/).map(x => x.trim()).find(x => has(x.toLowerCase(), /скорост|мгновенн|быстр|молниенос|разгон|гиперзвук|сверхзвук/)) || s; const cw = words(clause.replace(/^(а|но|и)\s+/i, '').replace(/[.!…]+$/, '')); return R('warp', { text: nWords <= 6 ? s.trim() : cw.length <= 6 ? cw.join(' ') : keywords(s, 2).map(k => k.text).join(' ') }); }
  if (has(L, /рост|вырас|растут|ракет|иксы|\bx\d|памп|взлет|взлёт|бычий|удвои/)) { mark(wiOf(s, stemRe(/рост|вырас|растут|ракет|иксы|памп|взл|бычий/))); return R('chartUp', { label: (ents.find(e => /^[A-Z]/.test(e.text))?.text || ctx.main || '').toUpperCase(), tag: /ракет|иксы/.test(L) ? 'x100?' : 'РОСТ ↑' }); }
  if (has(L, /пад|отстава|слаб|медвеж|дамп|обвал|убыт|минус|крах/)) { mark(wiOf(s, stemRe(/пад|отстава|слаб|медвеж|дамп|обвал|убыт|крах/))); return R('chartDown', { label: (ctx.main || 'ЦЕНА').toUpperCase() }); }
  if (has(L, /приват|конфиденц|анонимн|скрыт|шифр/)) { mark(wiOf(s, stemRe(/приват|конфиденц|анонимн|скрыт|шифр/))); return R('privacy', { tag: (ents.find(e => /^[A-Z]{2,}$/.test(e.text))?.text || 'PRIVATE') }); }
  if (has(L, /перевод|переда|отправ|платеж|платёж|оплат/)) { mark(wiOf(s, stemRe(/перевод|переда|отправ|платеж|платёж|оплат/))); return R('transfer', { coin: ctx.mainSym, ticker: ctx.ticker, bank: has(L, /банк|посредник/) }); }
  if (has(L, /продолжает|работает|поддерживает|используется|функционир/)) {
    const rows = s.replace(/[.!]$/, '').split(/,\s*|\s+и\s+/).slice(0, 4).map(x => short(x.replace(new RegExp('^' + (main || '###'), 'i'), '').trim(), 2).toUpperCase());
    return R('status', { title: (main || 'СЕТЬ').toUpperCase(), rows });
  }
  if (has(L, /между|с одной стороны|с другой/)) return R('worlds', { mid: (main || '').toUpperCase() });
  if (has(L, /внимани|волн|хайп|интерес|популяр/)) { mark(wiOf(s, stemRe(/внимани|волн|хайп|интерес|популяр/))); return R('waves', { sym: symbolFor(main || ctx.main), label: 'ВНИМАНИЕ ↑' }); }
  if (has(L, /время|покажет|скоро(?![а-яё])|завтра|сегодня/) && nWords <= 8) return R('clock', { text: s.trim() }, false);
  if (nWords <= 8) return R('hero', { text: s.trim() }, false);
  return fallback(s, ctx, R, acc, main);
}
// по умолчанию: чередуем карточки ключевых слов, фокус на монете и схему
function fallback(s, ctx, R, acc, main) {
  const kws = keywords(s, 3); kws.forEach(k => acc.add(k.wi));
  const t = ['cards', 'focus', 'diagram'][ctx.k++ % 3];
  return R(t, { keys: kws.map(k => ({ text: k.text, wi: k.wi })), sym: symbolFor(main || ctx.main), name: (main || ctx.main || '').toUpperCase() });
}
const SOFT = new Set(['warp', 'orbit', 'transfer', 'waves', 'privacy', 'chartUp', 'chartDown', 'status', 'worlds', 'clock', 'versus', 'network', 'chain', 'hero']);

export function buildPlan(script, opts = {}) {
  const sents = splitSentences(script);
  const freq = {};
  sents.forEach(s => entities(s).forEach(e => { if (/^[A-Z]/.test(e.text)) freq[e.text] = (freq[e.text] || 0) + 1; }));
  const main = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  const ticker = Object.keys(freq).find(k => /^[A-Z]{2,5}$/.test(k)) || '';
  let f = false;
  const ctx = { main, mainSym: symbolFor(main), ticker, k: 0, flip: () => (f = !f), story: { order: opts.mascot ? [{ name: 'Хомяк', female: false, kind: 'hamster' }] : [], last: [], lastActors: [], fromAct: {}, prev: false, forced: !!opts.mascot } };
  const scenes = [];
  for (const s of sents) {
    let sc = classify(s, ctx);
    ctx.sinceScreen = sc.type === 'screen' ? 0 : (ctx.sinceScreen ?? 9) + 1;
    const prev = scenes[scenes.length - 1];
    // одна тема подряд (предупреждение, подписка) -> одна сцена
    if (prev && prev.type === sc.type && ['warning', 'subscribe', 'link'].includes(sc.type)) {
      prev.text += ' ' + s; if (sc.type === 'warning' && sc.p.items.length > prev.p.items.length) prev.p.items = sc.p.items; continue;
    }
    // «мягкие» типы не чаще раза в 4 сцены, чтобы ролик не повторялся
    const recent = scenes.slice(-4).map(x => x.type);
    if (SOFT.has(sc.type) && recent.includes(sc.type) && sc.cap !== false) {
      const acc = new Set(sc.acc); const ents = entities(s);
      sc = fallback(s, ctx, (type, p) => ({ type, p, cap: true, acc: [...acc], numWis: sc.numWis, entWis: sc.entWis }), acc, ents[0]?.text || ctx.main);
    }
    scenes.push({ text: s, ...sc });
    ctx.story.prev = sc.type === 'story';
  }
  // расстановка героев: первый — слева (смотрит вправо), второй — справа (смотрит влево); один герой — левее центра
  const ord = ctx.story.order.slice(0, 2);
  for (const sc of scenes) if (sc.type === 'story') {
    sc.p.cast = sc.p.cast.filter(c => ord.some(o => o.name === c.name)).map(c => { const i = ord.findIndex(o => o.name === c.name); return { ...c, idx: i, female: ord[i].female, kind: ord[i].kind, x: sc.p.cast.length > 1 ? (i ? 1320 : 600) : 760, flip: sc.p.cast.length > 1 && i ? -1 : 1 }; });
    sc.p.acts = sc.p.acts.filter(a => sc.p.cast.some(c => c.name === a.who));
  }
  // вход ролика: если в одной из первых двух фраз звучит главная монета — она собирается из частиц
  const REVEALABLE = new Set(['hero', 'cards', 'focus', 'diagram', 'waves', 'status', 'clock', 'chain', 'network']);
  const ri = scenes.slice(0, 2).findIndex(x => REVEALABLE.has(x.type) && main && x.text.includes(main));
  if (ri >= 0) {
    const sc = scenes[ri], ex = new Set(entities(sc.text).flatMap(e => Array.from({ length: e.end - e.wi + 1 }, (_, k) => e.wi + k)));
    sc.type = 'reveal'; sc.cap = true;
    const rest = sc.text.replace(main, '').replace(/[.!…]+$/, '').replace(/\s+/g, ' ').replace(/^[\s,—-]+/, '').trim();
    sc.p = { word: main.toUpperCase(), sub: rest.length <= 40 ? rest.toUpperCase() : keywords(sc.text, 2, ex).map(k => k.text.toUpperCase()).join(' · ') };
  }
  return { title: (opts.title || main || 'РАЗБОР').toUpperCase(), main, mainSym: ctx.mainSym, cps: opts.cps || 14.5, scenes, hasMascot: ord.some(o => o.kind === 'hamster') };
}
