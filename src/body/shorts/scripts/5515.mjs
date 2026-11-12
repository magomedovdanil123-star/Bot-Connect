// 🩻 Рентген привычек — свой Shorts (не нарезка из выпуска): «Через 10 лет после отказа». Стикмены, ~50 с, в конце — «подпишись».
// Курят и парят только взрослые герои, без романтизации; факты — с источниками, в конце описания «это не медицинский совет».
import { hero, heroOut, at, walk, B, V, big } from '../../../scale3d/scripts/_toon.mjs';
export const n = 5515;
export const engine = 'toon';
export const standalone = true;
export const category = 'Shorts';
export const title = "Через 10 лет после отказа";
export const ytTitle = "Бросил КУРИТЬ 10 лет назад — вот что внутри";
export const hook = "Что внутри через 10 лет без сигарет";
export const titles = ["10 лет без сигарет: риск рака лёгких вдвое ниже", "Сравнили двух братьев через 10 лет"];
export const tags = ["10 лет без сигарет", "риск рака лёгких бросил курить", "польза отказа от курения", "бросить курить", "курение", "сигареты", "никотин", "рентген привычек", "здоровье", "shorts"];
export const about = "Что происходит с риском болезней через 5, 10 и 15 лет после отказа от курения — по данным American Cancer Society.";
export const comment = "Сколько лет без сигарет у тебя или у близких? 👇";
export const sources = ["American Cancer Society — Benefits of Quitting Smoking Over Time", "U.S. Surgeon General, 2020 — Smoking Cessation"];
export const brand = 'РЕНТГЕН ПРИВЫЧЕК';
export const brandSub = 'ЗА МИНУТУ';
export const hashtags = '#shorts #бросатькурить #курение #рентгенпривычек #здоровье';
const S = (loc, cast, cam, extra = {}) => ({ loc, cast, cam, ...extra });
const X_ = (organs, state, text, sub) => ({ loc: 'info', info: { kind: 'xray', organs, state, text, sub } });
const DAD = (act, x, e = {}) => at('dad', act, x, e);
const UNC = (act, x, e = {}) => at('man', act, x, { top: '#5a6b7a', ...e });
const SIGN = (text, bg = '#12a84a') => ({ kind: 'sign', text, x: 1650, y: 120, bg, col: '#fff' });

export const beats = [
  B("Мой дядя бросил курить десять лет назад, а его брат курит до сих пор. Мы сравнили, что происходило с ними на рентгене.", S('living', [UNC('joy', 760), at('man', 'idle', 1250, { face: { eyes: 'meh', mouth: 'line' } })], 'two')),
  B("Через год после отказа риск болезней сердца у дяди стал заметно ниже, чем у брата.", X_(['heart'], 'good', '1 ГОД', 'сердце в меньшем риске')),
  B("Через пять–десять лет заметно снижается риск рака рта, горла и гортани. Риск инсульта со временем тоже уменьшается.", X_(['brain'], 'good', '5–10 ЛЕТ', 'риски ниже')),
  B("А через десять лет риск умереть от рака лёгких становится примерно вдвое ниже, чем у того, кто продолжает курить.", big('×0,5', '#4dff9b', 'риск рака лёгких через 10 лет')),
  B("Брат дяди за эти годы стал задыхаться на лестнице и сменил третий размер ремня на пятый. Не от еды — от того, что двигаться стало тяжело.", S('elevator', [at('man', 'fear', 960, { face: { eyes: 'teary', mouth: 'o' } })], 'close', { o: { floor: '3' } })),
  B("А дядя в свои пятьдесят пробежал первый полумарафон. Медленно, но до финиша.", S('stadium', [UNC('joy', 760), hero('joy', 1250)], 'two', { o: { board: '21 КМ', cheer: true } })),
  B("Это история, а не диагноз: у каждого свой путь и свои риски. Но тренд один: чем раньше бросаешь, тем больше выигрываешь.", S('street', [UNC('talk', 760), heroOut('point', 1250)], 'two')),
  B("Сколько лет без сигарет у тебя или у близких? Напиши в комментариях, поздравим.", S('street', [hero('point', 960)], 'close'))
];
