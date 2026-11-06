// Общие помощники для сценариев COINORA «Что если…» (стикмены, engine: 'toon'). Формат сцены — docs/toon-style.md §13.
export const hero = (act, x, extra = {}) => ({ who: 'hero', act, x, ...extra });
export const heroOut = (act, x, extra = {}) => ({ who: 'hero', act, x, jacket: '#3b4252', ...extra });   // на улице осенью — куртка поверх худи
export const at = (who, act, x, extra = {}) => ({ who, act, x, ...extra });
export const run = (who, from, to, extra = {}) => ({ who, act: null, x: 0, walk: [from, to], run: true, ...extra });
export const walk = (who, from, to, extra = {}) => ({ who, act: null, x: 0, walk: [from, to], ...extra });
export const B = (text, scene, extra = {}) => ({ text, scene, ...extra });
export const V = (voice, text, scene, extra = {}) => ({ voice, text, scene, ...extra });
export const AUT = { season: 'autumn' }, LOVE = { face: { eyes: 'heart', mouth: 'smile' } };
export const big = (text, col = '#ffd400', sub) => ({ loc: 'info', info: { kind: 'big', text, col, ...(sub ? { sub } : {}) } });
// главы для описания: { номер фразы: 'Название' }
export const chapters = (beats, map) => { Object.entries(map).forEach(([i, c]) => { if (beats[i]) beats[i].chapter = c; }); return beats; };
