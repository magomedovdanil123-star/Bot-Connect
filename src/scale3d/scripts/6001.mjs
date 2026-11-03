// «Дом на шариках» в 3D: тот же текст и озвучка, что у src/scale/scripts/6001.mjs, но свои планы камеры (engine/world.js → S.*) и 2D-графика (UI.*).
// shot — план камеры и состояние мира; ui — что поверх кадра. Паузы «как у больших шоу»: heroHold, moneyHold, everything — камера почти стоит, цифра держится.
import * as base from '../../scale/scripts/6001.mjs';
export const { n, title, ytTitle, titles, tags, about, comment, sources } = base;

export const covers3d = [
  { beat: 26, tag: 'КАК В «ВВЕРХ»', lines: [['3 650 000', 'y'], ['ШАРИКОВ', 'w'], ['НА ДОМ', 'w']], accent: 'я посчитал' },
  { beat: 30, tag: 'ДОМ НА ШАРИКАХ', lines: [['ВЗЛЕТЕЛ', 'w'], ['И УПАЛ', 'y']], accent: 'вот почему' },
  { beat: 9, tag: 'В МУЛЬТИКЕ', lines: [['ВРАЛИ', 'y'], ['В 354 РАЗА', 'w']] },
];
const plan = [
  ['opening', {}, { kind: 'big', big: 'ДОМ НА ШАРИКАХ', sub: 'как в мультфильме «Вверх»', size: 150, y: .74 }],
  ['tolikIntro', {}, { kind: 'say', say: 'Изи! Пару тысяч шариков — и полетели!' }],
  ['teaseUp', {}, { kind: 'tease', hidden: 'на какую высоту улетит дом' }],
  ['chapter', { a0: .2 }, { kind: 'chapter', n: 1, text: 'СКОЛЬКО ВЕСИТ ДОМ' }],
  ['doorApproach', {}, { kind: 'big', to: 40000, unit: 'кг', sub: 'как 27 легковых машин', size: 170 }],
  ['interior', {}, { kind: 'say', say: 'Фундамент оставлю на земле!', x: 1300, y: 180 }],
  ['exitRise', {}, { kind: 'chapter', n: 2, text: 'СКОЛЬКО ТЯНЕТ ОДИН ШАРИК' }],
  ['heroBalloon', {}, { kind: 'rows', rows: [['тянет вверх', '+14,6 г', '#1fae5b'], ['резина', '−3 г', '#e0314f'], ['ленточка', '−0,6 г', '#e0314f']], total: '≈ 11 г' }],
  ['heroHold', {}, { kind: 'big', big: '≈ 11 г', sub: 'как два листа бумаги', size: 200 }],
  ['pullBack', {}, { kind: 'big', top: '40 000 кг ÷ 11 г', to: 3650000, sub: 'шариков — только чтобы оторваться от земли', col: '#ffd400' }],
  ['compare', {}, { kind: 'big', top: 'в мультфильме — 10 297', big: 'в 354 раза больше', size: 120 }],
  ['chairFloat', {}, { kind: 'big', big: '113 кг', sub: 'поднимут 10 297 шариков — Толика, но не дом' }],
  ['punch', {}, { kind: 'say', say: 'Ладно… возьму четыре миллиона!', x: 700 }],
  ['chapter', { a0: 1.4 }, { kind: 'chapter', n: 3, text: 'ГЕЛИЙ И ДЕНЬГИ' }],
  ['tanksSweep', {}, { kind: 'big', top: 'гелия нужно', to: 51600, unit: 'м³', sub: '≈ 20 олимпийских бассейнов газа' }],
  ['tanksDolly', {}, { kind: 'big', to: 8600, sub: 'больших баллонов · больше сотни грузовиков', size: 170 }],
  ['money', {}, { kind: 'big', to: 365000000, unit: '₽', sub: 'если шарик с гелием ≈ 100 ₽', col: '#ffd400' }],
  ['moneyHold', {}, { kind: 'banner', top: 'ПОДУМАЙ', big: 'ДОРОЖЕ ДОМА', text: 'шарики стоят в десятки раз больше самого дома' }],
  ['chapter', { a0: 2.6 }, { kind: 'chapter', n: 4, text: 'КТО ЭТО НАДУЕТ' }],
  ['timelapse', {}, { kind: 'big', top: 'один Толик, без сна', to: 422, unit: 'дня', size: 190 }],
  ['deflate', {}, { kind: 'big', top: 'НО ЕСТЬ ПРОБЛЕМА', big: '12 ЧАСОВ', sub: 'столько шарик держит гелий' }],
  ['deflated', {}, { kind: 'say', say: 'Первые сдуются, пока я надую последние?!', x: 960, y: 160 }],
  ['crowd', {}, { kind: 'big', to: 845, unit: 'человек', sub: 'чтобы успеть за 12 часов', size: 170 }],
  ['ribbon', {}, { kind: 'big', to: 5474, unit: 'км', sub: 'ленточек — больше, чем от Москвы до Новосибирска', size: 160 }],
  ['lowAngle', {}, { kind: 'chapter', n: 5, text: 'ВЗЛЁТ' }],
  ['skyscraper', {}, { kind: 'big', big: '≈ 54 м', sub: 'облако шариков — как 17-этажный дом', size: 170 }],
  ['liftoff', {}, { kind: 'big', top: '+10% — и полетели', big: '4 000 000', sub: 'шариков', col: '#ffd400' }],
  ['wind', {}, { kind: 'big', top: 'ветер 10 м/с', big: '≈ 7 ТОНН', sub: 'тянет облако вбок' }],
  ['altitude', { sky0: 0, sky1: .3 }, { kind: 'alt', from: 0, to: 3, t0: 15, t1: -5 }],
  ['altitude', { sky0: .3, sky1: .8, swell: true }, { kind: 'alt', from: 3, to: 5, t0: -5, t1: -18 }],
  ['pop', {}, { kind: 'pop' }],
  ['chute', {}, { kind: 'say', say: 'Я передумал. Давайте на автобусе', x: 960, y: 170 }],
  ['chapter', { a0: 3.4 }, { kind: 'chapter', n: '★', text: 'ЭТО БЫЛО НА САМОМ ДЕЛЕ' }],
  ['larry', {}, { kind: 'card', year: '1982', name: 'Ларри Уолтерс, США', lines: ['садовое кресло', '+ 45 метеозондов', '= почти 5 км вверх'] }],
  ['larry', { pop: true }, { kind: 'banner', top: 'ЧЕМ ВСЁ КОНЧИЛОСЬ', text: 'стрелял по шарикам, чтобы спуститься — и получил штраф' }],
  ['smallHouse', {}, { kind: 'card', year: '2011', name: 'Шоу на National Geographic', lines: ['лёгкий домик', '+ 300 метеозондов', '= примерно 3 км'] }],
  ['everything', {}, { kind: 'receipt', title: 'ЧЕК: ДОМ НА ШАРИКАХ', rows: [['Шарики', '3 650 000'], ['Гелий', '51 600 м³'], ['Баллоны', '8 600'], ['Люди', '845'], ['Ленточки', '5 474 км'], ['ИТОГО', '365 млн ₽']], stamp: 'ДОМ УПАЛ' }],
  ['heroHold', {}, { kind: 'big', top: 'И ЕЩЁ', big: 'ГЕЛИЙ', sub: 'не возобновляется — им охлаждают аппараты МРТ', size: 190 }],
  ['tolikAsk', {}, { kind: 'ask', q: 'Сколько шариков, чтобы поднять тебя?', formula: 'твой вес в кг ÷ 0,011', sub: 'например, 70 кг → 6 364 шарика' }],
  ['lego', {}, { kind: 'next', text: 'БАШНЯ ИЗ LEGO ДО КОСМОСА', sub: 'сколько кирпичиков нужно — и почему она сломается' }],
];
if (plan.length !== base.beats.length) throw new Error(`раскадровка: ${plan.length} планов на ${base.beats.length} фраз`);
export const beats = base.beats.map((b, i) => ({ text: b.text, badge: b.badge, sfx: b.sfx, shot: plan[i][0], o: plan[i][1], ui: plan[i][2] }));
