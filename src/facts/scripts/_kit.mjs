// «⚡ Психофакт Shorts»: отдельные Shorts 40–55 с на свои темы (не нарезка из разборов) — для привлечения на канал «Психофакт».
// Собираются движком психологии (сценки с Сашей и учёным), потом раскладываются в 9:16 (src/books/shorts.mjs, standalone).
// Скелет: крючок (узнаваемая ситуация) → факт или опыт учёных → что с этим делать → вопрос в комментарии + призыв подписаться.
// Весь текст диктора — до ~640 знаков, иначе Shorts вылезет за 58 с и концовка с подпиской обрежется.
import { SASHA, PROF, board, profSheet } from '../../psy/scripts/_kit.mjs';

// призыв подписаться — по кругу, чтобы ролики не звучали одинаково
const CTA = [
  'Подпишись на Психофакт — завтра будет ещё неожиданнее.',
  'Если было интересно — подпишись: здесь каждый день новый факт о том, как устроена наша голова.',
  'Подпишись, чтобы не пропустить следующий факт — он ещё страннее.',
  'Подписывайся на Психофакт: каждый день одна вещь о мозге, которую мало кто знает.',
  'Жми «подписаться» — завтра разберём ещё одну странность нашего мозга.',
];

/**
 * @param f { n, title, hook (крупно сверху Shorts), yt (название на YouTube), desc, tags, ask (вопрос зрителю — звучит и закрепляется),
 *            a: { lines, pic?, say?|think?, face?, pose?, text? }   — крючок
 *            b: { lines, board, at?, say?, text? }                  — учёный у доски: факт или опыт
 *            c?: { lines, pic?, face?, pose?, text? }               — что с этим делать }
 */
export function fact(f) {
  const scene = (x, def) => {
    const last = x.lines.length - 1;
    return { lines: x.lines,
      scene: { cast: [{ ...SASHA, x: x.pic ? 640 : 820 }], set: x.pic ? [{ pic: x.pic, x: 1280, y: 560, s: 300 }] : [],
        beats: [{ l: 0, d: .1, who: 's', pose: x.pose || def.pose, face: x.face || def.face, ...(x.say ? { say: x.say } : {}), ...(x.think ? { think: x.think } : {}) },
          ...(last ? [{ l: last, d: .2, who: 's', pose: def.pose2, face: def.face2, fx: def.fx }] : [])] },
      show: x.text ? [{ l: last, d: .5, text: x.text, red: true }] : [] };
  };
  const cta = CTA[f.n % CTA.length];
  const screens = [
    { ch: 'Факт', ...scene(f.a, { pose: 'think', face: 'surprised', pose2: 'shrug', face2: 'neutral', fx: '?' }) },
    // доска ближе к центру: в вертикальном Shorts края кадра обрезаются
    { ...profSheet({ lines: f.b.lines, b1: [f.b.board, f.b.at ?? 0, .3], say: f.b.say, text: f.b.text }), scene: { cast: [{ ...PROF, x: 560 }], set: [board(f.b.board, f.b.at ?? 0, .3, 1200)], beats: profSheet({ lines: f.b.lines, b1: [f.b.board, f.b.at ?? 0, .3], say: f.b.say }).scene.beats } },
    ...(f.c ? [scene(f.c, { pose: 'point', face: 'happy', pose2: 'cheer', face2: 'happy', fx: '!' })] : []),
    { lines: [f.ask, cta], scene: { cast: [{ ...SASHA, x: 620 }], set: [board('ПОДПИШИСЬ', 1, 0, 1200)],
        beats: [{ l: 0, d: .1, who: 's', pose: 'think', face: 'happy', think: 'А У ТЕБЯ?' }, { l: 1, d: .1, who: 's', pose: 'wave', face: 'happy', fx: 'jump' }] },
      show: [{ l: 0, d: .5, text: 'ПИШИ В КОММЕНТАРИЯХ', red: true }] },
  ];
  const description = [f.desc, '', `💬 ${f.ask}`, '', '🔔 Подпишись на ПСИХОФАКТ — каждый день новый факт о психологии человека.', '', ['#shorts', '#психология', '#психофакт', '#факты'].join(' ')].join('\n');
  return { n: f.n, title: f.title, author: '', category: 'Shorts', hook: f.hook, ytTitle: f.yt, description, comment: f.ask, tags: [...f.tags, 'психология', 'психофакт', 'факты о психологии', 'shorts'],
    shorts: [{ from: 0, hook: f.hook }], screens };
}
export { PROF };
