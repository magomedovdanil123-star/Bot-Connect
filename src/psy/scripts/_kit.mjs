// Общие герои, декорации и типовые листы для сценок «Психологии» (выпуски с №1004).
// Саша — герой, в котором зритель узнаёт себя; учёный в халате объясняет опыты у доски.
export const SASHA = { id: 's', color: '#4a90d9' };
export const PROF = { id: 'p', coat: true, glasses: true, color: '#fff' };
export const C = { green: '#81b29a', orange: '#f4a261', red: '#e07a5f', navy: '#3d405b', purple: '#6d597a', pink: '#e5989b', yellow: '#e9c46a', dark: '#2b2d42', teal: '#2a9d8f' };

// доска с крупной красной надписью; две доски — «было» сверху, «стало» снизу
export const board = (text, l, d = 0, x = 1330, y = 640, h = 300) => ({ prop: 'board', x, y, w: 720, h, text, size: 88, red: true, l, d });
export const board2 = (a, la, da, b, lb, db, x = 1330) => [board(a, la, da, x, 440, 210), board(b, lb, db, x, 700, 210)];
// табличка поменьше — для сцен, где героев много и большая доска закрыла бы головы
export const sign = (text, l, d = 0, x = 1640, y = 640, w = 400, h = 280) => ({ prop: 'board', x, y, w, h, text, size: 72, red: true, l, d });
// рабочее место: герой сидит в x, стул сзади, стол с ноутбуком впереди
export const desk = x => [{ prop: 'chair', x: x - 118 }, { prop: 'table', x: x + 210, w: 300, front: true }, { pic: '1F4BB', x: x + 230, y: 670, s: 140, front: true }];

// лист «учёный у доски»: b1/b2 — [надпись, фраза, доля фразы]; say — реплика учёного в конце; text — вывод внизу
export function profSheet({ ch, idea, lines, b1, b2, say, text }) {
  const last = lines.length - 1, b = b2 || b1;
  const set = b2 ? board2(b1[0], b1[1], b1[2] ?? 0, b2[0], b2[1], b2[2] ?? 0) : [board(b1[0], b1[1], b1[2] ?? 0)];
  const beats = [{ l: 0, d: .25, who: 'p', pose: 'explain' }, { l: b[1], d: Math.min(.9, (b[2] ?? 0) + .35), who: 'p', pose: 'point', face: 'surprised', fx: '!' },
    { l: last, d: .3, who: 'p', pose: say ? 'talk' : 'shrug', face: 'smug', ...(say ? { say } : {}) }];
  if (beats[1].l === last && beats[1].d >= .3) beats[2].d = Math.min(.95, beats[1].d + .25);
  return { ...(ch ? { ch } : {}), ...(idea ? { idea } : {}), lines, scene: { cast: [{ ...PROF, x: 560 }], set, beats }, show: text ? [{ l: last, d: .6, text, red: true }] : [] };
}
// лист-пауза: Саша думает над вопросом зрителю, на доске — вопрос, внизу — призыв написать в комментариях
export function askSheet({ lines, q, think = 'ХМ…', text = 'НАПИШИ В КОММЕНТАРИЯХ' }) {
  const last = lines.length - 1;
  return { lines, scene: { cast: [{ ...SASHA, x: 620 }], set: [board(q, 0, .4)], beats: [{ l: 0, d: .2, who: 's', pose: 'think', think }, { l: last, d: .3, who: 's', pose: 'point', face: 'happy' }] },
    show: [{ l: last, d: .5, text, red: true }] };
}
// список листов: лист с b1 (доской учёного) сам превращается в profSheet — можно писать коротко
export const sheets = list => list.map(x => (x.b1 && !x.scene ? profSheet(x) : x));
