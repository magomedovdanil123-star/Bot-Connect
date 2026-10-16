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
  for (const p of paras) {
    const parts = p.match(/[^.!?…]+(?:[.!?…]+["»”]?|$)/g) || [p];
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

function classify(s, ctx) {
  const ws = words(s), L = s.toLowerCase(), nWords = ws.length;
  const ents = entities(s), nums = numbers(s);
  const main = ents[0]?.text || ctx.main;
  const acc = new Set();
  const mark = (...idx) => idx.forEach(i => { if (i >= 0) acc.add(i); });
  ents.forEach(e => { for (let i = e.wi; i <= e.end; i++) acc.add(i); });
  nums.forEach(n => { for (let i = n.wi; i <= n.end; i++) acc.add(i); mark(n.unitWi); });
  const R = (type, p = {}, cap = true) => ({ type, p, cap, acc: [...acc], numWis: nums.map(n => n.wi), entWis: ents.map(e => e.wi) });

  if (has(L, /подпис/) && has(L, /подпис\S*сь|подпиши|подписывай/)) { mark(wiOf(s, stemRe(/подпис/))); return R('subscribe', { items: keywords(s, 3).map(k => k.text) }); }
  if (has(L, /ссылк/) && has(L, /профил|шапк|описани|био|закреп/)) { mark(wiOf(s, stemRe(/ссылк/))); return R('link', { label: short(s.split(/—|-/)[0], 4).toUpperCase() }); }
  if (has(L, /финансов\S* (совет|рекомендац)|не является|не рекомендац|на свой риск|оценивай риск/)) {
    const items = (s.split(/[.:]/).slice(1).join('.').split(/,\s*|\s+и\s+/).map(x => x.trim()).filter(x => x.length > 3)).slice(0, 3);
    return R('warning', { items: items.length ? items : ['ИЗУЧАЙ ПРОЕКТ', 'ОЦЕНИВАЙ РИСКИ'] });
  }
  const ch = /^(?:(?:и|а|итак|ну)\s+)?(перв|втор|трет|четв|пят|шест|седьм|восьм|девят|десят)\S*\s*(история|причина|пункт|фактор|шаг|момент|совет|правило|ошибка)?(?:\s+[а-яё]+)?\s*[—:-]\s*(.+)$/i.exec(s.trim());
  if (ch && nWords <= 10) { const num = ORD[ch[1].toLowerCase()]; return R('chapter', { num: String(num).padStart(2, '0'), kick: (ch[2] || 'часть').toUpperCase() + ' ' + String(num).padStart(2, '0'), title: ch[3].replace(/[.!…]+$/, '').toUpperCase() }, false); }
  if (/^(но\s+)?(подожди|стоп|постой|секунду|внимание)[.!…]*$/i.test(s.trim())) return R('stop', { text: s.trim().toUpperCase() }, false);
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
  const ctx = { main, mainSym: symbolFor(main), ticker, k: 0, flip: () => (f = !f) };
  const scenes = [];
  for (const s of sents) {
    let sc = classify(s, ctx);
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
  return { title: (opts.title || main || 'РАЗБОР').toUpperCase(), main, mainSym: ctx.mainSym, cps: opts.cps || 14.5, scenes };
}
