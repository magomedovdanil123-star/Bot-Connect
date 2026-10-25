// Разметка листа рисованного обзора. Сценарий говорит только «что нарисовать на какой фразе» (show), место на листе 1920×1080
// подбирается здесь: картинки — сеткой по 1–6, крупные надписи — строками под ними, цитата — на весь лист, график — справа.
// Старый формат с явными координатами (items) тоже поддерживается.
//
// show: [{ l: номер фразы, d?: доля фразы, pic?: 'код OpenMoji', cap?: 'ПОДПИСЬ', text?: 'КРУПНО', red?: true,
//          quote?: 'цитата', bars?: [{ label, v, vtext }], cross?: номер записи show, arrow?: [номер, номер], box?: номер записи-текста,
//          mark?: номер записи-текста — жёлтый маркер-выделитель поверх }]
const RED = '#d62828';
const ROW = n => n === 1 ? [960] : n === 2 ? [640, 1280] : [400, 960, 1520];

export function layoutScreen(sc) {
  if (sc.items) return sc.items;   // явные координаты (ранние книги)
  const show = sc.show || [], items = [], idOf = {};
  const pics = show.map((e, i) => [e, i]).filter(([e]) => e.pic), texts = show.map((e, i) => [e, i]).filter(([e]) => e.text), quote = show.find(e => e.quote), bars = show.find(e => e.bars);
  const id = i => 'e' + i;
  // цитата: на весь лист, картинки (если есть) — маленькие сверху
  if (quote) {
    const lines = quote.quote.split('\n').length, longest = Math.max(...quote.quote.split('\n').map(x => x.length)), size = lines > 2 ? 86 : longest < 24 ? 130 : 104;
    pics.slice(0, 3).forEach(([e, i], k, a) => { items.push({ kind: 'pic', emoji: e.pic, at: [ROW(a.length)[k], 190], cap: null, l: e.l, d: e.d || 0, s: 200, id: id(i) }); idOf[i] = id(i); });
    items.push({ kind: 'quote', text: quote.quote, x: 960, y: (pics.length ? 520 : 470) - (lines - 1) * size * .5, size, l: quote.l, d: quote.d || 0, w: 760 });
    texts.slice(0, 1).forEach(([e, i]) => { items.push({ kind: 'text', text: e.text, x: 960, y: 985, size: 84, maxW: 1780, l: e.l, d: e.d || 0, color: e.red ? RED : undefined, id: id(i) }); idOf[i] = id(i); });
  } else if (bars) {
    // график справа, надписи и картинка — слева столбиком
    items.push({ kind: 'bars', bars: bars.bars, x: 1100, y: 880, w: 680, h: 520, l: bars.l, d: bars.d || 0 });
    let y = 260;
    pics.slice(0, 1).forEach(([e, i]) => { items.push({ kind: 'pic', emoji: e.pic, at: [520, 230], cap: e.cap || null, capW: 760, l: e.l, d: e.d || 0, s: 220, id: id(i) }); idOf[i] = id(i); y = 520; });
    texts.forEach(([e, i]) => { items.push({ kind: 'text', text: e.text, x: 540, y, size: e.text.length > 18 ? 84 : 100, maxW: 860, l: e.l, d: e.d || 0, color: e.red ? RED : undefined, id: id(i) }); idOf[i] = id(i); y += 170; });
  } else {
    // сетка картинок; при 4–6 картинках — два ряда и без крупных надписей (их роль играют подписи)
    const n = Math.min(6, pics.length), two = n > 3, tx = texts.length && !two;
    const s = two ? 230 : n === 1 ? (tx ? 300 : 380) : tx ? 260 : 300;
    const rows = two ? [pics.slice(0, Math.ceil(n / 2)), pics.slice(Math.ceil(n / 2), n)] : [pics.slice(0, n)];
    const ys = two ? (texts.length ? [250, 690] : [290, 730]) : [tx ? 300 : 450];   // без надписей — ближе к центру листа
    rows.forEach((row, r) => row.forEach(([e, i], k) => { items.push({ kind: 'pic', emoji: e.pic, at: [ROW(row.length)[k], ys[r]], cap: e.cap || null, capW: [1500, 600, 530][row.length - 1], capColor: e.red ? RED : undefined, l: e.l, d: e.d || 0, s, id: id(i) }); idOf[i] = id(i); }));
    const tl = two ? texts.slice(0, 1) : texts.slice(0, 3);
    let y = n ? (two ? 1010 : 690) : 330;
    if (!n && tl.length === 1) y = 560;
    tl.forEach(([e, i]) => { const multi = e.text.includes('\n'), size = !n ? 140 : multi || e.text.length > 26 ? 88 : 110;
      items.push({ kind: 'text', text: e.text, x: 960, y, size: two ? 76 : size, maxW: 1780, l: e.l, d: e.d || 0, color: e.red ? RED : undefined, id: id(i) }); idOf[i] = id(i); y += size * (multi ? 2.2 : 1.35); });
    // один ряд картинок с надписями: весь блок — по центру листа по вертикали, чтобы низ не пустовал
    if (n && !two && tl.length) { const last = items.filter(x => x.kind === 'text').at(-1), top = ys[0] - s / 2, bottom = last.y + last.size * .3, dy = Math.max(0, Math.round((1080 - top - bottom) / 2));
      for (const x of items) { if (x.kind === 'pic') x.at = [x.at[0], x.at[1] + dy]; else x.y += dy; } }
  }
  // крест, стрелка, рамка — по номерам записей show
  for (const e of show) {
    if (e.cross != null && idOf[e.cross]) items.push({ kind: 'cross', id: idOf[e.cross], l: e.l, d: e.d || 0 });
    if (e.arrow && idOf[e.arrow[0]] && idOf[e.arrow[1]]) items.push({ kind: 'arrow', from: idOf[e.arrow[0]], to: idOf[e.arrow[1]], l: e.l, d: e.d || 0 });
    if (e.box != null) { const t = items.find(x => x.id === idOf[e.box] && x.kind === 'text'); if (t) { const w = Math.min(860, t.text.split('\n').reduce((m, l) => Math.max(m, l.length), 0) * t.size * .23 + 60), h = t.text.split('\n').length * t.size * 1.05; items.push({ kind: 'box', box: [t.x - w, t.y - t.size * .95, t.x + w, t.y - t.size * .95 + h + 30], l: e.l, d: e.d || 0 }); } }
    if (e.mark != null) { const t = items.find(x => x.id === idOf[e.mark] && x.kind === 'text'); if (t) { const ls = t.text.split('\n'), w = Math.min(880, ls.reduce((m, l) => Math.max(m, l.length), 0) * t.size * .22 + 30), top = t.y - t.size * .8; items.push({ kind: 'mark', box: [t.x - w, top, t.x + w, top + (ls.length - 1) * t.size * 1.05 + t.size * .95], l: e.l, d: e.d || 0 }); } }
  }
  return items;
}
