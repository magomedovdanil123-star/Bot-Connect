// Индивидуальные обложки под каждую тему (COINORA «Что если…» и Рентген привычек). Каждая — своя идея:
// композиция (right/left/center/duo), поза и эмоция, эффект (молнии, блёстки, скорость, дым…), предмет-символ, место и шрифт надписи.
// Принцип (как у топовых «Что если»-каналов): одна понятная картинка-вопрос, герой крупно с яркой эмоцией, 1–3 слова.
const MOM = { who: 'mom' }, GIRL = { who: 'girl' };
export const DESIGNS = {
  // ===== COINORA «Что если…» =====
  6101: [
    { beat: 0, text: 'ВСЕ СМОТРЯТ', crowd: true, act: 'fear', sweat: true, fx: ['rays', 'hearts'], pos: 'tl', font: 'rubik', sub: 'а я не понимаю почему' },
    { beat: 8, loc: 'street', time: 'night', layout: 'center', act: 'shock', eyes: 'wide', mouth: 'scream', text: 'ПОСЛЕДНИЙ', pos: 'bc', font: 'russo', fx: ['speed'], prop: { kind: 'counter', text: '1 из 4 000 000 000', x: 640, y: 92, color: '#ff3b4a', s: .6 } },
    { beat: 73, loc: 'gas', time: 'night', layout: 'duo', act: 'shock', duo: { who: 'stranger', act: 'idle', eyes: 'smug', mouth: 'smirk' }, text: 'КТО ЭТО?!', pos: 'bc', font: 'oswald', fx: ['smoke'], tcol: '#ff3b4a' },
  ],
  6102: [
    { beat: 0, loc: 'school', layout: 'center', act: 'fear', mouth: 'wavy', sweat: true, text: 'ВЕСЬ КЛАСС ВИДИТ', pos: 'bc', font: 'oswald', prop: { kind: 'tag', text: 'ЛОЖЬ', x: 640, y: 112, color: '#ff3b4a' } },
    { beat: 30, loc: 'park', season: 'autumn', layout: 'duo', act: 'fear', sweat: true, duo: { ...GIRL, act: 'talk', eyes: 'smug', mouth: 'smirk' }, text: 'ТОЛЬКО ЧЕСТНО', pos: 'bc', font: 'rubik', fx: ['hearts'], prop: { kind: 'tag', text: 'ПРАВДА', x: 930, y: 120, color: '#4dff9b' } },
    { beat: 62, loc: 'kitchen', time: 'night', layout: 'duo', act: 'shock', duo: { ...MOM, act: 'idle', mouth: 'line' }, text: 'МАМА?!', pos: 'bc', font: 'russo', tcol: '#ffffff', prop: { kind: 'tag', text: 'ЛОЖЬ', x: 370, y: 112, color: '#ff3b4a' }, dark: .1 },
  ],
  6103: [
    { beat: 0, loc: 'kitchen', layout: 'duo', act: 'shock', duo: { who: 'hero', top: '#d9577a', garment: 'dress', apron: true, act: 'point', eyes: 'angry', mouth: 'frown' }, text: 'ЭТО Я?!', pos: 'bc', font: 'rubik', sub: 'в мамином фартуке' },
    { beat: 3, loc: 'street', season: 'autumn', layout: 'center', act: 'idle', eyes: 'smug', mouth: 'smirk', text: 'ВСЕ ЛЮДИ — Я', pos: 'tc', font: 'russo', fx: ['rays', 'sparkles'], prop: { kind: 'counter', text: '× 8 000 000 000', x: 1010, y: 560, color: '#ffd400', s: .55, rot: -6 } },
    { beat: 52, loc: 'bedroom', time: 'night', layout: 'left', act: 'fear', sweat: true, text: 'Я — КОПИЯ?!', pos: 'tr', font: 'oswald', fx: ['glitch'], tcol: '#ff3ba0' },
  ],
  6104: [
    { beat: 1, loc: 'sky', layout: 'center', act: 'float', eyes: 'wide', mouth: 'scream', rot: -24, dx: 40, text: 'Я ЛЕЧУ!', pos: 'bl', font: 'rubik', fx: ['speed'], prop: { kind: 'clock', text: '12:00', x: 1110, y: 150, s: .55 } },
    { beat: 16, loc: 'street', season: 'autumn', act: 'fear', sweat: true, text: 'ДЕРЖИСЬ!', pos: 'tl', font: 'russo', tcol: '#ff3b4a', prop: { kind: 'counter', text: '11:59', x: 300, y: 470, color: '#ffd400', s: .9 } },
    { beat: 45, loc: 'sky', layout: 'duo', act: 'joy', rot: -8, duo: { ...GIRL, act: 'float', eyes: 'heart', mouth: 'grin' }, text: 'НАВСЕГДА?', pos: 'bc', font: 'oswald', fx: ['sparkles'] },
  ],
  6105: [
    { beat: 0, loc: 'street', season: 'autumn', layout: 'duo', act: 'shock', duo: { who: 'friend', act: 'wave', eyes: 'open', mouth: 'smile' }, text: '«ТЫ КТО?»', pos: 'bc', font: 'rubik', sub: 'мой лучший друг' },
    { beat: 33, loc: 'park', season: 'autumn', layout: 'center', act: 'sad', eyes: 'teary', mouth: 'frown', text: 'ОНА МЕНЯ НЕ ПОМНИТ', pos: 'tc', font: 'oswald', prop: { kind: 'counter', text: 'ДЕНЬ 47', x: 1040, y: 560, color: '#ff3ba0', s: .7, rot: 6 } },
    { beat: 50, loc: 'street', time: 'night', season: 'autumn', layout: 'left', act: 'fear', text: 'НАС БЫЛО ДВОЕ', pos: 'tr', font: 'russo', fx: ['stars'], prop: { kind: 'note', text: 'НЕ ВЕРЬ КАЛЕНДАРЮ', x: 930, y: 470, rot: 6, s: .8 } },
  ],
  6106: [
    { beat: 1, loc: 'beach', act: 'sneezeOut', eyes: 'closed', mouth: 'scream', text: 'АПЧХИ!', pos: 'tl', font: 'russo', fx: ['speed', 'smoke'], sub: 'и я на пляже' },
    { beat: 25, loc: 'shop', layout: 'duo', act: 'sneezeIn', eyes: 'closed', mouth: 'o', duo: { ...GIRL, act: 'joy', eyes: 'heart', mouth: 'grin' }, text: 'ПЕРЕЦ НА СВИДАНИИ', pos: 'bc', font: 'oswald', fx: ['hearts'] },
    { beat: 46, loc: 'bedroom', time: 'night', layout: 'center', act: 'shock', eyes: 'wide', mouth: 'scream', text: 'ДВА МЕНЯ?!', pos: 'bc', font: 'rubik', fx: ['glitch', 'stars'] },
  ],
  6107: [
    { beat: 11, loc: 'elevator', o: { floor: '', open: .85, beyond: '#1a0f2e', beyondGlow: 'rgba(160,120,255,.6)' }, layout: 'center', act: 'shock', mouth: 'scream', text: 'НАЖАЛ 7-3-9-1', pos: 'bc', font: 'oswald', prop: { kind: 'counter', text: '−100', x: 640, y: 92, color: '#ff3b3b', s: .8 } },
    { beat: 12, loc: 'underground', o: { sign: '' }, layout: 'left', act: 'shock', eyes: 'wide', text: 'ГОРОД ПОД ДОМОМ', pos: 'tr', font: 'rubik', tcol: '#3fd0ff', fx: ['stars', 'bubbles'] },
    { beat: 46, loc: 'elevator', time: 'night', layout: 'duo', act: 'fear', sweat: true, duo: { who: 'friend', top: '#1fbf8f', s: 2.6, act: 'idle', eyes: 'glow', mouth: 'smirk', glowCol: '#3fd0ff' }, text: 'ОН ОТТУДА', pos: 'bc', font: 'russo', fx: ['glitch'], dark: .25 },
  ],
  6108: [
    { beat: 0, loc: 'retro', act: 'shock', mouth: 'scream', text: 'ВЫШЕЛ ИЗ ШКАФА В…', pos: 'tl', font: 'oswald', prop: { kind: 'big', text: '1985', x: 360, y: 470, color: '#ffd400', s: .9, rot: -6 } },
    { beat: 21, loc: 'street', season: 'autumn', weather: 'rain', layout: 'duo', act: 'fear', eyes: 'teary', duo: { who: 'girl', top: '#4aa3df', garment: 'dress', hairCol: '#8a4a22', act: 'idle', eyes: 'open', mouth: 'line' }, text: 'Я ИСЧЕЗАЮ', pos: 'bc', font: 'rubik', fx: ['glitch'], sub: 'бабушке 19 лет' },
    { beat: 42, loc: 'kitchen', time: 'night', layout: 'duo', act: 'shock', duo: { who: 'granny', act: 'idle', eyes: 'smug', mouth: 'smirk' }, text: 'БАБУШКА ЗНАЛА', pos: 'bc', font: 'russo', fx: ['sparkles'] },
  ],
  6109: [
    { beat: 0, loc: 'school', act: 'remote', hold: 'remote', eyes: 'smug', mouth: 'smirk', text: 'УЧИЛКА ЗАМЕРЛА', pos: 'tl', font: 'rubik', fx: ['rays'], prop: { kind: 'stamp', text: '⏸ ПАУЗА', x: 340, y: 520, rot: -10, color: '#ffffff', s: .8 } },
    { beat: 18, loc: 'shop', layout: 'duo', act: 'remote', hold: 'remote', eyes: 'wide', mouth: 'o', duo: { ...GIRL, top: '#f4f6f8', act: 'shock', mouth: 'scream' }, text: '◀◀ ПЕРЕМОТАЛ', pos: 'bc', font: 'oswald', fx: ['glitch'] },
    { beat: 38, loc: 'street', season: 'autumn', layout: 'center', act: 'idle', eyes: 'wide', mouth: 'line', text: 'ПУЛЬТ №2', pos: 'bc', font: 'russo', fx: ['smoke'], prop: { kind: 'stamp', text: '● ЗАПИСЬ', x: 1050, y: 150, rot: 8, color: '#ff3b3b', s: .6 }, dark: .15 },
  ],
  6110: [
    { beat: 0, loc: 'kitchen', layout: 'duo', act: 'wave', eyes: 'teary', mouth: 'scream', duo: { ...MOM, act: 'idle', eyes: 'meh', mouth: 'line' }, text: 'МАМ, Я ТУТ!', pos: 'bc', font: 'rubik' },
    { beat: 15, loc: 'living', time: 'night', layout: 'center', act: 'joy', eyes: 'smug', mouth: 'grin', text: 'МЕНЯ НЕ ВИДЯТ', pos: 'bc', font: 'oswald', fx: ['sparkles'] },
    { beat: 45, loc: 'bedroom', time: 'night', layout: 'duo', act: 'shock', duo: { ...MOM, act: 'idle', eyes: 'glow', mouth: 'line', glowCol: '#ffe08a' }, text: 'ОНА ВИДИТ', pos: 'bc', font: 'russo', fx: ['stars'], dark: .2, sub: 'всегда видела' },
  ],
  6111: [
    { beat: 0, loc: 'street', season: 'autumn', act: 'shock', mouth: 'scream', text: 'КРЫША ПОЕХАЛА', pos: 'tl', font: 'rubik', prop: { kind: 'stamp', text: 'БУКВАЛЬНО', x: 330, y: 560, rot: -12, s: .75 } },
    { beat: 14, loc: 'street', season: 'autumn', weather: 'rain', layout: 'center', act: 'fear', eyes: 'wide', mouth: 'wavy', text: 'ВЁДРА С НЕБА', pos: 'bc', font: 'russo', fx: ['speed'] },
    { beat: 33, loc: 'school', layout: 'left', act: 'point', eyes: 'angry', mouth: 'frown', text: '«ЧТОБ ТЫ ПРОВАЛИЛСЯ»', pos: 'tr', font: 'oswald', fx: ['smoke'], tcol: '#ff3b4a' },
  ],
  6112: [
    { beat: 0, loc: 'paper', layout: 'center', act: 'shock', mouth: 'scream', text: 'Я НАРИСОВАН?!', pos: 'bc', font: 'rubik', fx: ['rays'] },
    { beat: 20, loc: 'paper', act: 'point', eyes: 'angry', mouth: 'smirk', text: 'Я ВИЖУ ТЕБЯ', pos: 'tl', font: 'russo', sub: 'да, тебя' },
    { beat: 32, loc: 'paper', layout: 'left', act: 'fear', eyes: 'teary', mouth: 'wavy', text: 'СПАСИ МЕНЯ', pos: 'tr', font: 'oswald', prop: { kind: 'stamp', text: 'СТЕРЕТЬ', x: 950, y: 520, rot: -8, s: .8 } },
  ],
  6113: [
    { beat: 0, loc: 'beach', act: 'shock', mouth: 'scream', text: 'ЗАШЁЛ В ФОТО', pos: 'tl', font: 'rubik', prop: { kind: 'counter', text: '60', x: 300, y: 520, color: '#ffd400', s: .85 } },
    { beat: 28, loc: 'park', season: 'summer', layout: 'duo', act: 'sad', eyes: 'teary', duo: { who: 'dad', top: '#d9c27a', glasses: true, act: 'wave', eyes: 'happy', mouth: 'smile' }, text: 'ДЕДУШКА?!', pos: 'bc', font: 'russo', fx: ['sparkles'] },
    { beat: 37, loc: 'bedroom', time: 'night', layout: 'left', act: 'fear', sweat: true, text: 'КТО СНЯЛ?', pos: 'tr', font: 'oswald', fx: ['stars'], dark: .2, prop: { kind: 'photo', text: 'завтра, 03:12', x: 940, y: 470, rot: 6, s: .85, bg: 'linear-gradient(#1b2142,#3a2a55)' } },
  ],

  6114: [
    { beat: 0, loc: 'mall', o: { sale: '24 ЧАСА' }, layout: 'center', act: 'joy', eyes: 'wide', mouth: 'grin', text: '24 ЧАСА', pos: 'tc', font: 'russo', fx: ['rays', 'sparkles'], tcol: '#ffd400', prop: { kind: 'counter', text: '1 000 000 000', x: 1010, y: 560, color: '#4dff9b', s: .55, rot: -5 } },
    { beat: 21, loc: 'vault', layout: 'left', act: 'joy', eyes: 'heart', mouth: 'grin', text: 'ВСЁ МОЁ?!', pos: 'tr', font: 'rubik', fx: ['sparkles'], tcol: '#4dff9b', prop: { kind: 'stamp', text: 'ОДОБРЕНО', x: 960, y: 480, color: '#4dff9b', rot: -10 } },
    { beat: 36, loc: 'mall', o: { sale: 'ЗАКРЫТО' }, layout: 'right', act: 'fear', eyes: 'teary', mouth: 'wavy', sweat: true, text: '1 РУБЛЬ', pos: 'tl', font: 'oswald', tcol: '#ff3b4a', dark: .15, prop: { kind: 'clock', text: '23:59', x: 330, y: 470, s: .6 } },
  ],
  6115: [
    { beat: 0, loc: 'bedroom', layout: 'center', act: 'shock', eyes: 'wide', mouth: 'scream', text: 'МЕНЯ НЕТ', pos: 'bc', font: 'rubik', fx: ['lightning'], prop: { kind: 'phone', text: 'ПУСТОЙ КАДР', sub: 'селфи', x: 1060, y: 220, rot: 8, s: .6 } },
    { beat: 20, loc: 'secroom', layout: 'left', act: 'idle', eyes: 'smug', mouth: 'smirk', text: 'КАМЕРЫ СЛЕПЫ', pos: 'tr', font: 'oswald', fx: ['glitch'], tcol: '#3fe0ff', dark: .2, glowCol: '#3fe0ff' },
    { beat: 35, loc: 'retro', layout: 'right', act: 'fear', sweat: true, text: '1999?!', pos: 'tl', font: 'russo', fx: ['glitch'], tcol: '#ff9f1a', prop: { kind: 'photo', text: 'Я В 1999', x: 330, y: 480, rot: -7, s: .8 } },
  ],
  6116: [
    { beat: 0, loc: 'kitchen', layout: 'left', act: 'shock', eyes: 'wide', mouth: 'scream', bg: [{ kind: 'animal', type: 'cat', x: 1350, y: 1040, s: 4.2, dir: -1, mood: 'angry', col: '#a0522d' }], text: 'КОТ ДУМАЕТ', pos: 'tr', font: 'rubik', tcol: '#ffd400', sub: 'и мне это не нравится' },
    { beat: 18, loc: 'street', season: 'autumn', layout: 'right', act: 'think', eyes: 'wide', mouth: 'o', bg: [{ kind: 'animal', type: 'pigeon', x: 520, y: 1000, s: 3, hat: true }], text: 'ГОЛУБИ ЗНАЮТ', pos: 'tl', font: 'russo', fx: ['bubbles'] },
    { beat: 33, loc: 'street', time: 'night', season: 'autumn', layout: 'center', act: 'fear', eyes: 'teary', mouth: 'wavy', text: 'НАДО УХОДИТЬ', pos: 'tc', font: 'oswald', fx: ['stars'], tcol: '#c58bff', dark: .2 },
  ],
  6117: [
    { beat: 0, loc: 'school', o: { board: 'ДОБРОЕ УТРО' }, layout: 'center', act: 'shock', eyes: 'wide', mouth: 'o', text: 'НИ ЗВУКА', pos: 'bc', font: 'russo', fx: ['rays'], tcol: '#3fb3ff' },
    { beat: 14, loc: 'stadium', o: { board: '0 : 0' }, layout: 'left', act: 'joy', eyes: 'happy', mouth: 'scream', text: 'ТИШИНА', pos: 'tr', font: 'rubik', fx: ['speed'], tcol: '#ffffff', prop: { kind: 'tag', text: '0 ДЕЦИБЕЛ', x: 930, y: 480, color: '#ff3ba0' } },
    { beat: 36, loc: 'bedroom', time: 'night', layout: 'right', act: 'fear', sweat: true, eyes: 'wide', mouth: 'line', text: 'НЕ МОЙ ГОЛОС', pos: 'tl', font: 'oswald', fx: ['smoke'], tcol: '#ff3b4a', dark: .2 },
  ],
  6118: [
    { beat: 0, loc: 'street', season: 'autumn', layout: 'center', act: 'shock', eyes: 'wide', mouth: 'scream', text: 'ВСЕ СПЯТ', pos: 'tc', font: 'rubik', fx: ['zzz'], tcol: '#bfe9ff', prop: { kind: 'clock', text: '12:00', x: 1080, y: 520, s: .55 } },
    { beat: 10, loc: 'mall', o: { sale: 'ВСЁ ОТКРЫТО' }, layout: 'left', act: 'joy', eyes: 'happy', mouth: 'grin', rot: -10, text: 'ВЕСЬ ЦЕНТР МОЙ', pos: 'tr', font: 'russo', fx: ['speed', 'sparkles'], tcol: '#ffd400' },
    { beat: 23, loc: 'rooftop', time: 'night', layout: 'right', act: 'shock', eyes: 'wide', mouth: 'o', text: 'НЕ ОДИН?', pos: 'tl', font: 'oswald', fx: ['stars'], tcol: '#ffe14d', glowCol: '#ffe14d', dark: .1 },
  ],
  6119: [
    { beat: 0, loc: 'game', o: { lives: 3, score: 0, level: 'МИР 1-1' }, layout: 'center', act: 'shock', eyes: 'wide', mouth: 'scream', text: '3 ЖИЗНИ', pos: 'bc', font: 'russo', fx: ['sparkles'], tcol: '#ff2d4a' },
    { beat: 23, loc: 'game', o: { lives: 1, score: 99999, level: 'МИР 4-1', theme: 'castle' }, layout: 'left', act: 'fear', eyes: 'teary', mouth: 'wavy', sweat: true, text: 'ОСТАЛАСЬ 1', pos: 'tr', font: 'rubik', fx: ['fire'], tcol: '#ffd400', prop: { kind: 'counter', text: 'ЖИЗНИ: 1', x: 960, y: 560, color: '#ff2d4a', s: .6, rot: 5 } },
    { beat: 27, loc: 'game', o: { lives: 1, score: 99999, level: 'ЗАМОК', theme: 'castle' }, layout: 'duo', act: 'shock', duo: { ...GIRL, act: 'sad', eyes: 'teary', mouth: 'frown' }, text: 'ИГРОК 2?', pos: 'bc', font: 'oswald', fx: ['glitch'], tcol: '#ff3ba0' },
  ],
  6120: [
    { beat: 0, loc: 'bedroom', time: 'night', layout: 'right', act: 'shock', eyes: 'wide', mouth: 'o', text: '1 БИЛЕТ', pos: 'tl', font: 'russo', fx: ['rays'], tcol: '#ffd400', prop: { kind: 'tag', text: 'ОДИН ДЕНЬ', x: 380, y: 520, color: '#ffd400' } },
    { beat: 14, loc: 'playground', season: 'summer', layout: 'duo', act: 'joy', eyes: 'happy', mouth: 'grin', duo: { who: 'dad', jacket: '#c0392b', act: 'laugh', eyes: 'happy', mouth: 'grin' }, text: 'МНЕ СНОВА 6', pos: 'bc', font: 'rubik', fx: ['sparkles'], tcol: '#4dff9b' },
    { beat: 32, loc: 'playground', season: 'autumn', layout: 'center', act: 'fear', eyes: 'teary', mouth: 'wavy', text: 'ОН ЗНАЛ?', pos: 'tc', font: 'oswald', fx: ['smoke'], tcol: '#ff9f1a', dark: .15, prop: { kind: 'note', text: 'СЫНУ', x: 1040, y: 560, rot: 6, s: .75 } },
  ],
  // ===== 🩻 Рентген привычек =====
  5007: [
    { beat: 0, loc: 'bathroom', layout: 'center', act: 'cold', outfit: { top: '#5ad0ff', garment: 'tee' }, eyes: 'wide', mouth: 'scream', text: 'ЛЕДЯНОЙ ДУШ', pos: 'bc', font: 'russo', tcol: '#7fe3ff', fx: ['snow'], prop: { kind: 'counter', text: '+5 °C', x: 1080, y: 130, color: '#7fe3ff', s: .65 } },
    { beat: 11, loc: 'bathroom', act: 'cold', outfit: { top: '#5ad0ff', garment: 'tee' }, eyes: 'teary', mouth: 'wavy', text: 'ДЕНЬ 1', pos: 'tl', font: 'rubik', prop: { kind: 'clock', text: '07:00', x: 330, y: 470, s: .8 } },
    { beat: 37, loc: 'park', season: 'autumn', layout: 'left', act: 'joy', eyes: 'smug', mouth: 'grin', text: 'ДЕНЬ 30', pos: 'tr', font: 'oswald', fx: ['sparkles'], prop: { kind: 'stamp', text: 'ЛЕДЯНОЙ КОРОЛЬ', x: 900, y: 600, rot: -8, color: '#2ed3ff', s: .6 } },
  ],
  5104: [
    { beat: 1, loc: 'kitchen', layout: 'duo', who: 'man', outfit: { top: '#c0392b', garment: 'tee', glasses: true }, act: 'sad', eyes: 'meh', mouth: 'wavy', duo: { who: 'dad', top: '#5b7a5a', act: 'joy', eyes: 'happy', mouth: 'grin' }, text: 'ОДИН ПЬЁТ', pos: 'bc', font: 'rubik', sub: 'гены одинаковые' },
    { beat: 21, loc: 'hospital', o: { mri: false, sign: '' }, who: 'man', outfit: { top: '#c0392b', garment: 'tee', glasses: true }, act: 'fear', sweat: true, text: 'ПЕЧЕНЬ', pos: 'tl', font: 'russo', tcol: '#ff3b4a', prop: { kind: 'gauge', text: 'ЖИР', value: 1.08, x: 330, y: 470, s: .8 } },
    { beat: 26, loc: 'kitchen', layout: 'center', act: 'shock', mouth: 'scream', text: 'ЭТО БЛИЗНЕЦЫ?!', pos: 'bc', font: 'oswald', props: [{ kind: 'photo', text: '20 лет', x: 230, y: 290, rot: -8, s: .7 }, { kind: 'photo', text: '40 лет', x: 1050, y: 290, rot: 7, s: .7, bg: 'linear-gradient(#8a8f99,#5d6672)' }] },
  ],
  5204: [
    { beat: 3, loc: 'street', season: 'autumn', who: 'friend', outfit: { top: '#2b3445', hair: 'spiky' }, act: 'idle', eyes: 'smug', mouth: 'smirk', text: '«ПРОСТО ПАР»', pos: 'tl', font: 'rubik', fx: ['smoke'], sub: 'так говорит брат' },
    { beat: 24, loc: 'hospital', o: { mri: false, sign: '' }, layout: 'center', who: 'friend', outfit: { top: '#4a4f5c', garment: 'coat', hair: 'spiky' }, act: 'hunch', eyes: 'teary', mouth: 'wavy', text: 'ЛЁГКИЕ В 29', pos: 'tc', font: 'russo', tcol: '#ff3b4a', prop: { kind: 'gauge', text: 'ДЫХАНИЕ', value: .15, x: 1070, y: 480, s: .65 } },
    { beat: 11, loc: 'street', season: 'autumn', layout: 'duo', act: 'shock', duo: { who: 'friend', top: '#4a4f5c', garment: 'coat', hair: 'spiky', act: 'hunch', eyes: 'meh', mouth: 'frown' }, text: 'ЭТО МАКС?!', pos: 'bc', font: 'oswald', fx: ['smoke'], sub: 'через 10 лет вейпа' },
  ],
  5005: [
    { beat: 1, loc: 'kitchen', layout: 'duo', who: 'dad', outfit: { top: '#5b7a5a' }, act: 'shock', mouth: 'scream', duo: { who: 'hero', act: 'point', eyes: 'smug', mouth: 'smirk' }, text: 'НИ КАПЛИ', pos: 'bc', font: 'russo', tcol: '#ff3b4a', sub: 'тренер — сын', prop: { kind: 'stamp', text: '30 ДНЕЙ', x: 640, y: 70, rot: -6, s: .5 } },
    { beat: 13, loc: 'shop', o: { sign: '' }, who: 'dad', outfit: { top: '#2b2f3f', garment: 'coat' }, act: 'fear', sweat: true, text: 'СВАДЬБА', pos: 'tl', font: 'rubik', fx: ['sparkles'], prop: { kind: 'counter', text: 'ДЕНЬ 7', x: 300, y: 500, color: '#ffd400', s: .85 } },
    { beat: 29, loc: 'kitchen', layout: 'center', who: 'dad', outfit: { top: '#5b7a5a' }, act: 'joy', eyes: 'happy', mouth: 'grin', text: 'ДЕНЬ 30', pos: 'tc', font: 'oswald', fx: ['rays', 'sparkles'], prop: { kind: 'counter', text: '−3,5 КГ', x: 1040, y: 560, color: '#4dff9b', s: .7, rot: 6 } },
  ],
  5105: [
    { beat: 0, loc: 'bedroom', time: 'night', layout: 'center', act: 'hunch', hold: 'phone', eyes: 'glow', mouth: 'line', glowCol: '#8fd3ff', text: 'ЕЩЁ 5 МИНУТ…', pos: 'bc', font: 'oswald', dark: .2, prop: { kind: 'clock', text: '02:00', x: 1080, y: 170, s: .55 } },
    { beat: 12, loc: 'lab', act: 'shock', mouth: 'scream', text: 'МОЗГ НОЧЬЮ', pos: 'tl', font: 'russo', prop: { kind: 'phone', text: 'МЕЛАТОНИН ↓', sub: 'экран у лица', x: 330, y: 470, rot: -10, s: .75 } },
    { beat: 30, loc: 'school', layout: 'duo', act: 'sitsad', eyes: 'closed', mouth: 'wavy', duo: { who: 'friend', act: 'joy', eyes: 'smug', mouth: 'smirk' }, text: 'КТО ВЫИГРАЛ?', pos: 'bc', font: 'rubik', fx: ['zzz'] },
  ],
  5205: [
    { beat: 0, loc: 'elevator', o: { floor: '7' }, layout: 'duo', act: 'shock', mouth: 'scream', duo: { who: 'hero', top: '#1e5bb8', garment: 'coat', glasses: true, act: 'hunch', eyes: 'meh', mouth: 'wavy', s: 3.2 }, text: 'Я ЧЕРЕЗ 10 ЛЕТ?!', pos: 'bc', font: 'oswald' },
    { beat: 11, loc: 'street', season: 'autumn', layout: 'center', act: 'hunch', hold: 'phone', eyes: 'meh', mouth: 'wavy', text: '27 КГ', pos: 'tc', font: 'russo', tcol: '#ff3b4a', sub: 'на твоей шее', arrow: true, arrowX: 30, arrowY: 50, arrowRot: 20 },
    { beat: 34, loc: 'bedroom', time: 'night', layout: 'left', act: 'fear', sweat: true, text: 'ЗАПИСКА ОТ СЕБЯ', pos: 'tr', font: 'rubik', dark: .15, prop: { kind: 'note', text: 'НЕ САДИСЬ В СИНЮЮ МАШИНУ', x: 920, y: 470, rot: 5, s: .75 } },
  ],
};

// ===== v3 (08.11, владелец: «руки вверх у всех одинаково, эмоций не видно») =====
// Крупный план: персонаж-«бюст» (coverGuy.mjs) — голова на пол-кадра, огромные глаза с веками и бровями, руки у лица.
// В одной серии позы не повторяются; у соседних серий — разные. Второй план — c.duo / c.cast2 (меньше, иногда размыт).
const G2 = { who: 'girl' };
const V3 = {
  6101: [
    { pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.7, 0], sweat: true, cast2: [{ ...G2, pose: 'cheeks', eyes: 'heart', mouth: 'grin', x: 170, y: 500, r: 78 }, { who: 'news', pose: 'chin', eyes: 'heart', mouth: 'smile', x: 400, y: 520, r: 74 }, { ...G2, outfit: { top: '#9b59b6', hairCol: '#1d1410', bow: '#ffd400' }, pose: 'reach', eyes: 'heart', mouth: 'laugh', x: 620, y: 540, r: 70 }] },
    { pose: 'grabhead', eyes: 'worried', mouth: 'wavy', sweat: true },
    { pose: 'cheeks', eyes: 'shock', mouth: 'scream', duo: { who: 'stranger', pose: 'down', eyes: 'glow', glowCol: '#ff3b4a', mouth: 'smirk', x: 300, y: 380, r: 150 } },
  ],
  6102: [
    { pose: 'facepalm', eyes: 'worried', mouth: 'wavy', sweat: true },
    { pose: 'chin', eyes: 'sly', mouth: 'smirk', look: [-.6, 0], duo: { ...G2, pose: 'cross', eyes: 'smug', mouth: 'smirk', look: [.5, 0] } },
    { pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0], duo: { who: 'mom', pose: 'point', eyes: 'angry', mouth: 'frown', look: [.6, 0] } },
  ],
  6103: [
    { pose: 'point', flip: true, eyes: 'shock', mouth: 'scream', duo: { outfit: { top: '#d9577a', garment: 'dress' }, pose: 'cross', eyes: 'angry', mouth: 'frown', look: [.5, 0] } },
    { pose: 'shrug', eyes: 'smug', mouth: 'grin', cast2: [{ pose: 'wave', eyes: 'happy', mouth: 'smile', x: 190, y: 470, r: 80, blur: 1.5 }, { pose: 'cross', eyes: 'smug', mouth: 'smirk', x: 1090, y: 470, r: 80, blur: 1.5 }, { pose: 'thumb', eyes: 'wide', mouth: 'grin', x: 360, y: 560, r: 64, blur: 2.5 }, { pose: 'peace', eyes: 'happy', mouth: 'laugh', x: 920, y: 560, r: 64, blur: 2.5 }] },
    { pose: 'cheeks', eyes: 'teary', mouth: 'wavy' },
  ],
  6104: [
    { pose: 'up', eyes: 'wide', mouth: 'laugh', tilt: -22, gy: 370 },
    { pose: 'reach', eyes: 'worried', mouth: 'scream', tilt: 8, sweat: true },
    { pose: 'peace', eyes: 'happy', mouth: 'laugh', duo: { ...G2, pose: 'chin', eyes: 'heart', mouth: 'smile', look: [.5, 0] } },
  ],
  6105: [
    { pose: 'cheeks', eyes: 'shock', mouth: 'o', duo: { who: 'friend', pose: 'wave', eyes: 'happy', mouth: 'smile' } },
    { pose: 'down', eyes: 'teary', mouth: 'wavy', headTilt: 10 },
    { pose: 'think', eyes: 'worried', mouth: 'line', look: [.6, -.3] },
  ],
  6106: [
    { pose: 'shrug', eyes: 'closed', mouth: 'scream', tilt: -10, headTilt: -14 },
    { pose: 'mouth', eyes: 'teary', mouth: 'o', look: [-.5, 0], duo: { ...G2, pose: 'chin', eyes: 'heart', mouth: 'smile', look: [.5, 0] } },
    { pose: 'pointnear', flip: true, eyes: 'shock', mouth: 'o', gx: 900, gy: 400, gr: 160, pos: 'bc', cast2: [{ pose: 'pointnear', eyes: 'shock', mouth: 'o', look: [.5, 0], x: 380, y: 400, r: 160 }] },
  ],
  6107: [
    { pose: 'pointup', eyes: 'wide', mouth: 'teeth', look: [.5, -.6] },
    { pose: 'reach', eyes: 'star', mouth: 'o' },
    { pose: 'cover', eyes: 'wide', mouth: 'wavy', duo: { who: 'friend', pose: 'down', eyes: 'glow', glowCol: '#4dff9b', mouth: 'smirk' } },
  ],
  6108: [
    { pose: 'grabhead', eyes: 'shock', mouth: 'scream' },
    { pose: 'shrug', eyes: 'worried', mouth: 'wavy', duo: { ...G2, pose: 'cheeks', eyes: 'teary', mouth: 'scream' } },
    { pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0], duo: { who: 'granny', pose: 'shh', eyes: 'sly', mouth: 'smirk' } },
  ],
  6109: [
    { pose: 'hold', flip: true, eyes: 'smug', mouth: 'smirk', look: [-.5, 0], prop: { kind: 'remote', x: 520, y: 470, rot: -20, s: .8 }, cast2: [{ who: 'teacher', pose: 'pointup', eyes: 'meh', mouth: 'o', x: 230, y: 430, r: 100, blur: 1 }] },
    { pose: 'thumb', eyes: 'sly', mouth: 'grin', duo: { ...G2, pose: 'shrug', eyes: 'dizzy', mouth: 'wavy' } },
    { who: 'stranger', pose: 'hold', eyes: 'glow', glowCol: '#ff3b4a', mouth: 'smirk', rim: '#ff3b4a' },
  ],
  6110: [
    { pose: 'wave', eyes: 'worried', mouth: 'scream', duo: { who: 'mom', pose: 'down', eyes: 'meh', mouth: 'line', look: [-.8, 0] } },
    { pose: 'peace', eyes: 'happy', mouth: 'laugh' },
    { pose: 'cheeks', eyes: 'shock', mouth: 'o', duo: { who: 'mom', pose: 'down', eyes: 'wide', mouth: 'smile', look: [.7, 0] } },
  ],
  6111: [
    { pose: 'grabhead', eyes: 'dizzy', mouth: 'wavy' },
    { pose: 'cheeks', eyes: 'worried', mouth: 'scream', tilt: 6 },
    { pose: 'mouth', eyes: 'wide', mouth: 'o', look: [.7, 0], cast2: [{ who: 'bully', pose: 'up', eyes: 'shock', mouth: 'scream', tilt: 28, x: 1010, y: 500, r: 110 }] },
  ],
  6112: [
    { pose: 'reach', eyes: 'shock', mouth: 'o', look: [0, .6] },
    { pose: 'point', flip: true, eyes: 'sly', mouth: 'smirk', look: [-.3, 0] },
    { pose: 'cheeks', eyes: 'teary', mouth: 'scream' },
  ],
  6113: [
    { pose: 'thumb', eyes: 'wide', mouth: 'grin' },
    { pose: 'mouth', eyes: 'teary', mouth: 'o', look: [-.5, 0], duo: { who: 'dad', outfit: { top: '#7a6a5a' }, pose: 'wave', eyes: 'happy', mouth: 'smile' } },
    { pose: 'hold', flip: true, eyes: 'worried', mouth: 'wavy', look: [.4, 0] },
  ],
  6114: [
    { pose: 'shrug', eyes: 'dollar', mouth: 'laugh' },
    { pose: 'cross', eyes: 'smug', mouth: 'smirk', look: [.4, 0] },
    { pose: 'grabhead', eyes: 'teary', mouth: 'scream' },
  ],
  6115: [
    { pose: 'hold', eyes: 'shock', mouth: 'o', look: [.6, 0], prop: { kind: 'phone', text: 'ПУСТОЙ КАДР', sub: 'селфи', x: 1080, y: 400, rot: 8, s: .6 } },
    { pose: 'shh', eyes: 'sly', mouth: 'smirk', look: [.4, 0] },
    { pose: 'cheeks', eyes: 'shock', mouth: 'scream' },
  ],
  6116: [
    { pose: 'think', eyes: 'worried', mouth: 'o', look: [.8, .2] },
    { pose: 'cover', eyes: 'wide', mouth: 'wavy' },
    { pose: 'down', eyes: 'teary', mouth: 'frown', headTilt: -10 },
  ],
  6117: [
    { pose: 'mouth', eyes: 'shock', mouth: 'o' },
    { pose: 'shh', eyes: 'happy', mouth: 'smile' },
    { pose: 'down', eyes: 'glow', glowCol: '#c58bff', mouth: 'teeth', rim: '#c58bff' },
  ],
  6118: [
    { pose: 'reach', eyes: 'shock', mouth: 'scream' },
    { pose: 'thumb', eyes: 'happy', mouth: 'laugh', tilt: -8 },
    { pose: 'hold', flip: true, eyes: 'worried', mouth: 'o', look: [-.6, -.2], rim: '#ffe14d' },
  ],
  6119: [
    { pose: 'grabhead', eyes: 'shock', mouth: 'scream' },
    { pose: 'pointup', eyes: 'teary', mouth: 'wavy', look: [.5, -.6], pos: 'br', prop: { kind: 'counter', text: 'ЖИЗНИ: 1', x: 860, y: 150, color: '#ff2d4a', s: .6, rot: 5 } },
    { pose: 'cheeks', eyes: 'shock', mouth: 'o', duo: { ...G2, pose: 'reach', eyes: 'teary', mouth: 'scream' } },
  ],
  6120: [
    { pose: 'hold', flip: true, eyes: 'wide', mouth: 'grin', look: [-.5, 0], prop: { kind: 'tag', text: 'ОДИН ДЕНЬ', x: 470, y: 470, color: '#ffd400', rot: -8 } },
    { pose: 'peace', eyes: 'happy', mouth: 'laugh', gr: 150, gy: 420, duo: { who: 'dad', outfit: { top: '#c0392b' }, pose: 'cross', eyes: 'happy', mouth: 'smile', x: 330, y: 330, r: 172 } },
    { pose: 'chin', eyes: 'worried', mouth: 'o', look: [.3, -.5] },
  ],
  5005: [
    { pose: 'fist', eyes: 'angry', mouth: 'teeth', duo: { who: 'friend', pose: 'hold', eyes: 'smug', mouth: 'grin' } },
    { pose: 'cover', eyes: 'worried', mouth: 'wavy' },
    { pose: 'thumb', eyes: 'star', mouth: 'grin' },
  ],
  5007: [
    { pose: 'grabhead', eyes: 'shock', mouth: 'scream', rim: '#8fe9ff' },
    { pose: 'cross', eyes: 'worried', mouth: 'teeth', rim: '#8fe9ff', sweat: true },
    { pose: 'peace', eyes: 'smug', mouth: 'grin' },
  ],
  5104: [
    { pose: 'cross', eyes: 'meh', mouth: 'line', look: [-.6, 0], duo: { who: 'dad', pose: 'hold', eyes: 'dizzy', mouth: 'smile' } },
    { pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0] },
    { pose: 'pointnear', flip: true, eyes: 'shock', mouth: 'scream', gx: 900, gy: 430, props: [], cast2: [{ outfit: { top: '#7f8c8d' }, pose: 'down', eyes: 'meh', mouth: 'wavy', headTilt: 12, x: 360, y: 430, r: 150 }] },
  ],
  5105: [
    { pose: 'phone', eyes: 'glow', glowCol: '#8fd3ff', mouth: 'line', rim: '#8fd3ff' },
    { pose: 'grabhead', eyes: 'dizzy', mouth: 'wavy' },
    { pose: 'facepalm', eyes: 'closed', mouth: 'wavy', duo: { who: 'friend', pose: 'thumb', eyes: 'smug', mouth: 'grin' } },
  ],
  5204: [
    { pose: 'chin', eyes: 'smug', mouth: 'smirk', look: [-.4, 0] },
    { pose: 'hold', eyes: 'teary', mouth: 'wavy' },
    { pose: 'mouth', eyes: 'shock', mouth: 'o', look: [-.6, 0], duo: { who: 'friend', outfit: { top: '#8a7a6a' }, pose: 'down', eyes: 'meh', mouth: 'frown' } },
  ],
  5205: [
    { pose: 'cheeks', eyes: 'shock', mouth: 'scream', duo: { outfit: { top: '#1e5bb8', garment: 'coat', glasses: true }, pose: 'down', eyes: 'meh', mouth: 'wavy', headTilt: 22 } },
    { pose: 'phone', eyes: 'meh', mouth: 'wavy', headTilt: 26, look: [0, .7] },
    { pose: 'hold', flip: true, eyes: 'worried', mouth: 'o', look: [.5, 0] },
  ],
};
for (const [n, a] of Object.entries(V3)) if (DESIGNS[n]) a.forEach((o, i) => { if (DESIGNS[n][i]) DESIGNS[n][i] = { ...DESIGNS[n][i], ...o, ...(o.duo ? { duo: o.duo, layout: 'duo' } : {}) }; });
// предметы, которые после переноса надписи наверх оказались под ней
const MOVE = { 6101: { 1: { x: 640, y: 660 } }, 6102: { 0: { x: 640, y: 345, s: .8 }, 1: { x: 1090, y: 640 }, 2: { x: 965, y: 318, s: .7 } }, 6109: { 2: { x: 1040, y: 610 } } };
for (const [n, m] of Object.entries(MOVE)) for (const [i, p] of Object.entries(m)) if (DESIGNS[n]?.[i]?.prop) DESIGNS[n][i] = { ...DESIGNS[n][i], prop: { ...DESIGNS[n][i].prop, ...p } };

// ===== 🩻 Рентген — новые серии в стикмен-формате (крупный план v3) =====
const PUG = (x = 400, y = 1010, s = 3.4) => ({ kind: 'animal', type: 'dog', x, y, s, col: '#d9b38c' });
Object.assign(DESIGNS, {
  5001: [
    { beat: 0, loc: 'kitchen', pose: 'cheeks', eyes: 'shock', mouth: 'scream', text: '30 БАНОК', pos: 'tl', font: 'rubik', tcol: '#ff3b4a', fx: ['rays'], prop: { kind: 'tag', text: 'КОЛА × 30', x: 330, y: 560, color: '#ff3b4a', rot: -6 } },
    { beat: 24, loc: 'hospital', layout: 'duo', pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0], duo: { who: 'doc', outfit: { top: '#e8f4f2', hairCol: '#5a2e1a' }, pose: 'point', eyes: 'worried', mouth: 'o', look: [.5, 0] }, text: 'ПЕЧЕНЬ?!', font: 'russo', tcol: '#ffd400' },
    { beat: 35, loc: 'shop', pose: 'cover', eyes: 'wide', mouth: 'wavy', text: 'АВТОМАТ ЗНАЕТ', pos: 'tl', font: 'oswald', tcol: '#ff3b4a', fx: ['glitch'], dark: .15, prop: { kind: 'phone', text: 'СКУЧАЛ?', sub: 'автомат', screen: 'linear-gradient(160deg,#e8202a,#5a0a14)', x: 560, y: 520, rot: -8, s: .62 } },
  ],
  5101: [
    { beat: 0, loc: 'park', season: 'winter', pose: 'hold', eyes: 'meh', mouth: 'wavy', tilt: 10, bg: [PUG(380, 1010, 3.6)], text: '365 ДНЕЙ', pos: 'tl', font: 'russo', tcol: '#8fe9ff', fx: ['snow'], rim: '#8fe9ff' },
    { beat: 20, loc: 'living', layout: 'duo', pose: 'chin', eyes: 'sly', mouth: 'smirk', look: [-.6, 0], duo: { who: 'friend', pose: 'phone', eyes: 'glow', glowCol: '#8fd3ff', mouth: 'smile' }, text: 'ОН ИЛИ Я?', font: 'rubik', tcol: '#4dff9b' },
    { beat: 31, loc: 'street', time: 'night', season: 'autumn', pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0], bg: [PUG(640, 1010, 2.6)], cast2: [{ who: 'man', outfit: { top: '#2b2f3f' }, pose: 'cross', eyes: 'smug', mouth: 'smirk', x: 300, y: 420, r: 130 }], text: 'ЧЕЙ МОПС?', pos: 'tr', font: 'oswald', tcol: '#ffd400', fx: ['stars'] },
  ],
  5201: [
    { beat: 0, loc: 'bedroom', time: 'night', pose: 'cheeks', eyes: 'teary', mouth: 'wavy', text: '6 ЧАСОВ', pos: 'tl', font: 'russo', tcol: '#c58bff', dark: .15, prop: { kind: 'clock', text: '06:00', x: 330, y: 500, s: .6 } },
    { beat: 12, loc: 'kitchen', time: 'night', layout: 'left', pose: 'hold', flip: true, eyes: 'star', mouth: 'tongue', text: 'ГОЛОДНЫЙ НОЧЬЮ', pos: 'tr', font: 'rubik', tcol: '#ff9f1a', fx: ['sparkles'] },
    { beat: 31, loc: 'bedroom', time: 'night', layout: 'duo', pose: 'pointnear', flip: true, eyes: 'shock', mouth: 'scream', duo: { who: 'dad', pose: 'down', eyes: 'meh', mouth: 'line', headTilt: -8 }, text: 'ПАПА — СЛЕДУЮЩИЙ', font: 'oswald', tcol: '#ff3ba0', fx: ['glitch'] },
  ],
  5002: [
    { beat: 0, loc: 'kitchen', who: 'dad', pose: 'fist', eyes: 'angry', mouth: 'teeth', text: 'ПОСЛЕДНЯЯ', pos: 'tl', font: 'russo', tcol: '#4dff9b', fx: ['speed'], prop: { kind: 'tag', text: 'ДЕНЬ 0', x: 330, y: 540, color: '#4dff9b', rot: -5 } },
    { beat: 14, loc: 'living', layout: 'left', who: 'dad', pose: 'grabhead', eyes: 'angry', mouth: 'scream', rim: '#ff3b4a', glowCol: '#ff3b4a', text: 'ДЕНЬ 3', pos: 'tr', font: 'rubik', tcol: '#ff3b4a', fx: ['fire'], prop: { kind: 'counter', text: '72 ЧАСА', x: 960, y: 560, color: '#ffd400', s: .6, rot: 5 } },
    { beat: 31, loc: 'street', time: 'night', season: 'autumn', layout: 'duo', pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0], duo: { who: 'man', outfit: { top: '#7a6a5a', glasses: true }, pose: 'chin', eyes: 'worried', mouth: 'o', look: [.4, -.2] }, text: 'ДЕДУШКА ТОЖЕ?', font: 'oswald', tcol: '#ffd400', fx: ['stars'] },
  ],
});
const LEO = { who: 'man', outfit: { top: '#8e5a3a', garment: 'tee' } };
Object.assign(DESIGNS, {
  5102: [
    { beat: 0, loc: 'living', layout: 'duo', who: 'dad', pose: 'thumb', eyes: 'happy', mouth: 'grin', duo: { ...LEO, pose: 'down', eyes: 'meh', mouth: 'wavy', headTilt: 10 }, text: 'ДВА БРАТА', font: 'russo', tcol: '#ffd400' },
    { beat: 26, loc: 'stadium', layout: 'left', ...LEO, pose: 'facepalm', eyes: 'worried', mouth: 'o', sweat: true, text: 'ДЯДЯ НЕ МОЖЕТ', pos: 'tr', font: 'oswald', tcol: '#ff3b4a', o: { board: '1 : 0' } },
    { beat: 32, loc: 'street', time: 'night', season: 'autumn', pose: 'think', eyes: 'worried', mouth: 'line', look: [-.6, 0], cast2: [{ ...LEO, pose: 'thumb', eyes: 'happy', mouth: 'grin', x: 300, y: 430, r: 125 }], text: 'ПО-СВОЕМУ?', pos: 'tr', font: 'rubik', tcol: '#c58bff', fx: ['smoke'] },
  ],
  5202: [
    { beat: 0, loc: 'bedroom', outfit: { top: '#2f5fa8', garment: 'coat' }, pose: 'shrug', eyes: 'shock', mouth: 'scream', text: '29 000 ЧАСОВ', pos: 'tl', font: 'russo', tcol: '#ff9f1a', prop: { kind: 'phone', text: 'ВСТАНЬ!', sub: 'кресло', x: 300, y: 520, rot: -8, s: .55 } },
    { beat: 11, loc: 'office', layout: 'left', pose: 'grabhead', eyes: 'teary', mouth: 'scream', rim: '#ff3b4a', text: 'НОГИ СПЯТ', pos: 'tr', font: 'rubik', tcol: '#8fe9ff', fx: ['lightning'] },
    { beat: 31, loc: 'bedroom', time: 'night', layout: 'duo', pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0], duo: { who: 'dad', pose: 'down', eyes: 'meh', mouth: 'wavy', headTilt: 18 }, text: 'КРЕСЛО ПАПЫ', font: 'oswald', tcol: '#ff3ba0', fx: ['glitch'] },
  ],
  5003: [
    { beat: 0, loc: 'kitchen', pose: 'cross', eyes: 'angry', mouth: 'teeth', cast2: [{ who: 'granny', pose: 'hold', eyes: 'sly', mouth: 'smirk', x: 290, y: 450, r: 120 }], text: 'НИ ЛОЖКИ', pos: 'tl', font: 'rubik', tcol: '#ff3ba0' },
    { beat: 10, loc: 'school', layout: 'left', pose: 'chin', eyes: 'angry', mouth: 'teeth', look: [.5, 0], text: 'ДЕНЬ 3', pos: 'tr', font: 'russo', tcol: '#ff3b4a', fx: ['fire'] },
    { beat: 29, loc: 'kitchen', pose: 'reach', eyes: 'shock', mouth: 'tongue', cast2: [{ who: 'kid', pose: 'point', eyes: 'happy', mouth: 'laugh', x: 280, y: 470, r: 105 }], text: 'СЛИШКОМ СЛАДКО', pos: 'tl', font: 'oswald', tcol: '#ffd400', fx: ['sparkles'] },
  ],
  5103: [
    { beat: 0, loc: 'bedroom', time: 'night', layout: 'duo', pose: 'peace', eyes: 'happy', mouth: 'smile', duo: { who: 'friend', pose: 'phone', eyes: 'glow', glowCol: '#8fd3ff', mouth: 'line' }, text: '8 ПРОТИВ 5', lines: ['8 ПРОТИВ 5'], font: 'russo', tcol: '#c58bff', fx: ['stars'] },
    { beat: 23, loc: 'street', season: 'autumn', pose: 'cheeks', eyes: 'shock', mouth: 'scream', cast2: [{ who: 'friend', pose: 'down', eyes: 'closed', mouth: 'o', headTilt: -14, x: 320, y: 440, r: 135 }], text: 'МИКРОСОН', pos: 'tl', font: 'rubik', tcol: '#ff3b4a', fx: ['speed'] },
    { beat: 32, loc: 'bedroom', time: 'night', layout: 'left', pose: 'hold', eyes: 'wide', mouth: 'o', look: [.6, 0], text: 'ЗВОНОК В 3:00', lines: ['ЗВОНОК', 'В 3:00'], pos: 'tr', font: 'oswald', tcol: '#ffd400', dark: .15, prop: { kind: 'phone', text: 'КИРИЛЛ', sub: '03:00', screen: 'linear-gradient(160deg,#7a1fd1,#1f4dff)', x: 830, y: 430, rot: 8, s: .6 } },
  ],
});
const LENA = { who: 'woman', outfit: { top: '#c0392b', hairCol: '#7a2e1a' } }, ADULT = { outfit: { top: '#2f5fa8', garment: 'coat' } };
Object.assign(DESIGNS, {
  5203: [
    { beat: 0, loc: 'living', pose: 'thumb', eyes: 'star', mouth: 'grin', text: '730 БАНОК', pos: 'tl', font: 'russo', tcol: '#4dff9b', fx: ['rays', 'sparkles'], prop: { kind: 'counter', text: '× 730', x: 330, y: 540, color: '#4dff9b', s: .6, rot: -5 } },
    { beat: 18, loc: 'hospital', ...ADULT, pose: 'cheeks', eyes: 'teary', mouth: 'wavy', rim: '#ff3b4a', text: 'СЕРДЦЕ СКАЧЕТ', pos: 'tl', font: 'oswald', tcol: '#ff3b4a', fx: ['lightning'], prop: { kind: 'counter', text: 'ПУЛЬС 118', x: 330, y: 560, color: '#ff3b4a', s: .55, rot: -4 } },
    { beat: 31, loc: 'kitchen', layout: 'duo', ...ADULT, outfit: { top: '#2f5fa8', garment: 'coat', glasses: true }, pose: 'reach', eyes: 'shock', mouth: 'scream', duo: { outfit: { top: '#ff8a1e' }, pose: 'hold', eyes: 'happy', mouth: 'grin', r: 125, y: 470 }, text: 'БРАТ, НЕТ!', font: 'rubik', tcol: '#ffd400' },
  ],
  5006: [
    { beat: 0, loc: 'school', pose: 'facepalm', eyes: 'teary', mouth: 'wavy', cast2: [{ who: 'bully', pose: 'cross', eyes: 'smug', mouth: 'smirk', x: 300, y: 440, r: 130 }], text: '3 РАЗА?!', pos: 'tr', font: 'russo', tcol: '#ff6a00' },
    { beat: 10, loc: 'bathroom', layout: 'left', pose: 'down', eyes: 'teary', mouth: 'scream', sweat: true, headTilt: -8, text: 'ВСЁ БОЛИТ', pos: 'tr', font: 'rubik', tcol: '#ff3b4a', fx: ['lightning'] },
    { beat: 28, loc: 'school', pose: 'fist', eyes: 'angry', mouth: 'teeth', rim: '#ff6a00', glowCol: '#ff6a00', cast2: [{ who: 'bully', pose: 'cheeks', eyes: 'shock', mouth: 'scream', x: 290, y: 470, r: 115 }], text: 'РЕВАНШ', pos: 'tl', font: 'oswald', tcol: '#ffd400', fx: ['speed'] },
  ],
  5106: [
    { beat: 0, loc: 'kitchen', time: 'night', who: 'dad', pose: 'hold', eyes: 'wide', mouth: 'o', look: [-.4, 0], bg: [{ kind: 'animal', type: 'cat', x: 420, y: 1000, s: 3 }], text: '00:40', pos: 'tl', font: 'russo', tcol: '#8fd3ff', rim: '#e8f4ff' },
    { beat: 13, loc: 'bedroom', time: 'night', layout: 'left', who: 'dad', pose: 'mouth', eyes: 'teary', mouth: 'o', rim: '#ff3b4a', text: 'ИЗЖОГА', pos: 'tr', font: 'rubik', tcol: '#ff6a00', fx: ['fire'] },
    { beat: 31, loc: 'kitchen', time: 'night', pose: 'cheeks', eyes: 'shock', mouth: 'scream', text: 'КТО ЭТО?!', pos: 'tl', font: 'oswald', tcol: '#ff3b4a', fx: ['glitch'], prop: { kind: 'phone', text: 'REC 00:40', sub: 'холодильник', screen: 'linear-gradient(160deg,#14161c,#5a0a14)', x: 340, y: 520, rot: -8, s: .55 } },
  ],
  5206: [
    { beat: 0, loc: 'living', pose: 'phone', eyes: 'wide', mouth: 'o', look: [0, .5], text: '10 СЕЛФИ', pos: 'tl', font: 'russo', tcol: '#c58bff', props: [{ kind: 'photo', text: 'НГ 1', x: 260, y: 470, rot: -8, s: .55 }, { kind: 'photo', text: 'НГ 10', x: 470, y: 520, rot: 6, s: .55 }] },
    { beat: 18, loc: 'hospital', layout: 'left', ...LENA, pose: 'chin', eyes: 'worried', mouth: 'o', look: [.5, -.2], text: 'ДЛЯ СЕРДЦА?', pos: 'tr', font: 'oswald', tcol: '#ff3b4a', prop: { kind: 'counter', text: '140 / 90', x: 960, y: 560, color: '#ff3b4a', s: .55, rot: 4 } },
    { beat: 31, loc: 'kitchen', time: 'night', layout: 'duo', pose: 'think', eyes: 'sly', mouth: 'smirk', look: [-.5, 0], duo: { ...LENA, pose: 'phone', eyes: 'smug', mouth: 'smirk' }, text: 'ДЯДЯ БОРЯ?', font: 'rubik', tcol: '#ffd400' },
  ],
});
const SER = { who: 'man', outfit: { top: '#e8202a', garment: 'tee' } }, BARISTA = { who: 'girl', outfit: { top: '#7a4a2a' } };
Object.assign(DESIGNS, {
  5004: [
    { beat: 0, loc: 'bedroom', time: 'night', pose: 'hold', eyes: 'wide', mouth: 'wavy', rim: '#4dff9b', text: 'СЕССИЯ НА БАНКАХ', pos: 'tl', font: 'russo', tcol: '#4dff9b', fx: ['lightning'], prop: { kind: 'clock', text: '04:00', x: 330, y: 520, s: .55 } },
    { beat: 18, loc: 'bedroom', time: 'night', layout: 'left', pose: 'cover', eyes: 'wide', mouth: 'wavy', rim: '#ff3b4a', text: 'СЕРДЦЕ В 4 УТРА', pos: 'tr', font: 'oswald', tcol: '#ff3b4a', prop: { kind: 'counter', text: 'ПУЛЬС 112', x: 960, y: 560, color: '#ff3b4a', s: .55, rot: 4 } },
    { beat: 22, loc: 'school', pose: 'down', eyes: 'closed', mouth: 'o', headTilt: 22, cast2: [{ who: 'man', outfit: { top: '#3b4252', glasses: true }, pose: 'point', eyes: 'angry', mouth: 'frown', x: 300, y: 430, r: 125 }], text: 'УСНУЛ НА ЭКЗАМЕНЕ', pos: 'tr', font: 'rubik', tcol: '#ffd400', fx: ['zzz'] },
  ],
  5107: [
    { beat: 0, loc: 'school', layout: 'duo', who: 'dad', pose: 'facepalm', eyes: 'worried', mouth: 'wavy', sweat: true, duo: { ...SER, pose: 'cross', eyes: 'smug', mouth: 'smile' }, text: 'ОБОИМ ПО 50', lines: ['ОБОИМ ПО 50'], font: 'russo', tcol: '#ffd400' },
    { beat: 22, loc: 'school', pose: 'cheeks', eyes: 'shock', mouth: 'scream', cast2: [{ who: 'dad', pose: 'fist', eyes: 'teary', mouth: 'teeth', x: 310, y: 440, r: 130 }], text: 'ПАПА, ДЕРЖИСЬ!', pos: 'tl', font: 'oswald', tcol: '#ff3b4a', fx: ['speed'] },
    { beat: 30, loc: 'playground', time: 'night', season: 'autumn', who: 'dad', pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0], cast2: [{ who: 'man', outfit: { top: '#12a84a', glasses: true }, pose: 'thumb', eyes: 'happy', mouth: 'grin', x: 300, y: 430, r: 125 }], text: 'ЕМУ 80?!', pos: 'tr', font: 'rubik', tcol: '#4dff9b', fx: ['stars'] },
  ],
  5207: [
    { beat: 0, loc: 'office', time: 'night', outfit: { top: '#2f5fa8', garment: 'coat' }, pose: 'facepalm', eyes: 'angry', mouth: 'teeth', rim: '#ff3b4a', text: 'СТРЕСС 100', pos: 'tl', font: 'russo', tcol: '#ff3b4a', fx: ['lightning'], prop: { kind: 'phone', text: 'СТРЕСС 100', sub: 'браслет', screen: 'linear-gradient(160deg,#e8202a,#5a0a14)', x: 320, y: 520, rot: -8, s: .55 } },
    { beat: 21, loc: 'bathroom', layout: 'left', outfit: { top: '#2f5fa8', garment: 'coat' }, pose: 'hold', eyes: 'shock', mouth: 'scream', text: 'ВОЛОСЫ?!', pos: 'tr', font: 'oswald', tcol: '#ffd400' },
    { beat: 32, loc: 'bedroom', time: 'night', pose: 'phone', eyes: 'shock', mouth: 'o', look: [0, .5], cast2: [{ who: 'friend', pose: 'down', eyes: 'closed', mouth: 'wavy', headTilt: -12, x: 300, y: 450, r: 125 }], text: 'ДАЖЕ ВО СНЕ', pos: 'tl', font: 'rubik', tcol: '#c58bff', fx: ['glitch'] },
  ],
  5008: [
    { beat: 0, loc: 'mall', o: { sale: 'КОФЕЙНЯ' }, pose: 'shrug', eyes: 'worried', mouth: 'wavy', cast2: [{ ...BARISTA, pose: 'hold', eyes: 'sly', mouth: 'smirk', x: 300, y: 450, r: 125 }], text: 'НИ ГЛОТКА', pos: 'tr', font: 'russo', tcol: '#ff9f1a' },
    { beat: 10, loc: 'school', layout: 'left', pose: 'grabhead', eyes: 'teary', mouth: 'scream', rim: '#ff3b4a', text: 'ДЕНЬ 2', pos: 'tr', font: 'rubik', tcol: '#ff3b4a', fx: ['lightning'] },
    { beat: 32, loc: 'mall', o: { sale: 'КОФЕЙНЯ' }, layout: 'duo', pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0], duo: { ...BARISTA, pose: 'shh', eyes: 'smug', mouth: 'smirk' }, text: 'А ЧАЙ?', font: 'oswald', tcol: '#4dff9b' },
  ],
});
const COACH = { who: 'man', outfit: { top: '#12a84a', garment: 'tee', hat: 'cap', hatCol: '#12a84a' } }, GALYA = { who: 'granny', outfit: { top: '#e67e22', hairCol: '#c0703a' } }, MASHA = { who: 'girl', outfit: { top: '#c58bff', bow: '#7a1fd1' } }, OFFICE = { outfit: { top: '#2f5fa8', garment: 'coat' } };
Object.assign(DESIGNS, {
  5108: [
    { beat: 0, loc: 'school', pose: 'hold', flip: true, eyes: 'worried', mouth: 'wavy', sweat: true, rim: '#3fb3ff', text: '2 ЛИТРА?', pos: 'tl', font: 'russo', tcol: '#3fb3ff', prop: { kind: 'tag', text: 'ВОДА 2 Л', x: 500, y: 500, color: '#3fb3ff', rot: -6 } },
    { beat: 12, loc: 'school', layout: 'left', pose: 'shrug', eyes: 'teary', mouth: 'scream', text: 'ТУАЛЕТ × 12', lines: ['ТУАЛЕТ', '× 12'], pos: 'tr', font: 'rubik', tcol: '#ffd400', fx: ['speed'] },
    { beat: 28, loc: 'stadium', time: 'sunset', layout: 'duo', pose: 'chin', eyes: 'sly', mouth: 'o', look: [-.6, 0], duo: { ...COACH, pose: 'hold', eyes: 'happy', mouth: 'grin' }, text: 'А ЭТО ЧТО?', lines: ['А ЭТО ЧТО?'], font: 'oswald', tcol: '#3fb3ff' },
  ],
  5208: [
    { beat: 0, loc: 'office', ...OFFICE, pose: 'hold', flip: true, eyes: 'heart', mouth: 'tongue', look: [-.4, 0], cast2: [{ ...GALYA, pose: 'thumb', eyes: 'happy', mouth: 'grin', x: 270, y: 470, r: 115 }], text: 'ВАЗОЧКА', pos: 'tl', font: 'rubik', tcol: '#ff3ba0', fx: ['sparkles'] },
    { beat: 20, loc: 'hospital', layout: 'left', ...OFFICE, outfit: { top: '#2f5fa8', garment: 'coat', glasses: true }, pose: 'facepalm', eyes: 'teary', mouth: 'o', text: 'ПРЕДДИАБЕТ?', pos: 'tr', font: 'oswald', tcol: '#ff3b4a', prop: { kind: 'counter', text: 'ГЛЮКОЗА 6,3', x: 960, y: 560, color: '#ff3b4a', s: .55, rot: 4 } },
    { beat: 31, loc: 'office', layout: 'duo', ...OFFICE, outfit: { top: '#2f5fa8', garment: 'coat', glasses: true }, pose: 'cheeks', eyes: 'shock', mouth: 'scream', duo: { ...GALYA, pose: 'point', eyes: 'smug', mouth: 'smile' }, text: 'ТЕПЕРЬ ТЫ', font: 'russo', tcol: '#ffd400' },
  ],
  5009: [
    { beat: 0, loc: 'kitchen', season: 'summer', pose: 'reach', eyes: 'shock', mouth: 'o', cast2: [{ who: 'granny', pose: 'hold', eyes: 'happy', mouth: 'grin', x: 280, y: 460, r: 120 }], text: '90 ЯИЦ', pos: 'tl', font: 'russo', tcol: '#ffd400', fx: ['rays'] },
    { beat: 22, loc: 'hospital', layout: 'left', who: 'dad', pose: 'grabhead', eyes: 'worried', mouth: 'scream', text: 'ХОЛЕСТЕРИН?!', pos: 'tr', font: 'oswald', tcol: '#ff3b4a', prop: { kind: 'counter', text: 'ЛПНП ↑', x: 960, y: 560, color: '#ff3b4a', s: .6, rot: 4 } },
    { beat: 31, loc: 'kitchen', time: 'sunset', layout: 'duo', pose: 'mouth', eyes: 'wide', mouth: 'o', look: [-.6, 0], duo: { who: 'man', outfit: { top: '#7a6a5a', glasses: true }, pose: 'cross', eyes: 'smug', mouth: 'smirk' }, text: 'А САЛО?', font: 'rubik', tcol: '#ff9f1a' },
  ],
  5109: [
    { beat: 0, loc: 'school', layout: 'duo', who: 'girl', pose: 'peace', eyes: 'happy', mouth: 'smile', duo: { ...MASHA, pose: 'down', eyes: 'meh', mouth: 'line' }, text: 'НАЙДИ ОТЛИЧИЯ', font: 'oswald', tcol: '#ff3ba0' },
    { beat: 17, loc: 'bathroom', layout: 'left', ...MASHA, pose: 'cheeks', eyes: 'teary', mouth: 'wavy', text: 'КОЖА', pos: 'tr', font: 'russo', tcol: '#c58bff' },
    { beat: 30, loc: 'shop', layout: 'duo', who: 'girl', pose: 'mouth', eyes: 'shock', mouth: 'o', look: [-.6, 0], duo: { ...MASHA, pose: 'hold', eyes: 'happy', mouth: 'grin' }, text: '«БЕЗ САХАРА»?', font: 'rubik', tcol: '#4dff9b' },
  ],
});
const NEPHEW = { outfit: { top: '#ff8a1e' } };
Object.assign(DESIGNS, {
  5209: [
    { beat: 0, loc: 'street', season: 'autumn', who: 'mom', pose: 'thumb', eyes: 'happy', mouth: 'grin', text: '9000 КМ', pos: 'tl', font: 'russo', tcol: '#4dff9b', fx: ['speed'], prop: { kind: 'tag', text: '30 МИН В ДЕНЬ', x: 340, y: 520, color: '#4dff9b', rot: -5 } },
    { beat: 15, loc: 'street', season: 'autumn', weather: 'rain', layout: 'left', who: 'mom', pose: 'shrug', eyes: 'happy', mouth: 'laugh', rim: '#8fd3ff', text: 'МАМА В ДОЖДЬ', pos: 'tr', font: 'rubik', tcol: '#8fd3ff', fx: ['bubbles'] },
    { beat: 29, loc: 'hospital', layout: 'duo', pose: 'cheeks', eyes: 'shock', mouth: 'scream', duo: { who: 'dad', pose: 'facepalm', eyes: 'teary', mouth: 'o' }, text: 'ПАПА?!', font: 'oswald', tcol: '#ff3b4a' },
  ],
  5010: [
    { beat: 0, loc: 'bedroom', time: 'night', pose: 'phone', eyes: 'glow', glowCol: '#8fd3ff', mouth: 'line', rim: '#8fd3ff', text: '7 ЧАСОВ В ДЕНЬ', pos: 'tl', font: 'russo', tcol: '#8fd3ff', prop: { kind: 'counter', text: '7:12', x: 320, y: 540, color: '#8fd3ff', s: .6, rot: -5 } },
    { beat: 12, loc: 'kitchen', time: 'night', layout: 'left', pose: 'reach', eyes: 'teary', mouth: 'scream', text: 'ДЕНЬ 7', pos: 'tr', font: 'rubik', tcol: '#c58bff', fx: ['glitch'], prop: { kind: 'tag', text: 'СЕЙФ', x: 960, y: 560, color: '#ffd400', rot: 5 } },
    { beat: 27, loc: 'bedroom', time: 'night', layout: 'left', pose: 'hold', eyes: 'shock', mouth: 'scream', text: 'КТО ЭТО ПИСАЛ?', pos: 'tr', font: 'oswald', tcol: '#ff3b4a', fx: ['glitch'], prop: { kind: 'phone', text: 'СКУЧАЕШЬ?', sub: 'мой аккаунт', screen: 'linear-gradient(160deg,#ff3ba0,#7a1fd1)', x: 830, y: 430, rot: 8, s: .6 } },
  ],
  5110: [
    { beat: 0, loc: 'retro', pose: 'hold', flip: true, eyes: 'star', mouth: 'grin', cast2: [{ who: 'friend', pose: 'phone', eyes: 'glow', glowCol: '#8fd3ff', mouth: 'line', x: 280, y: 470, r: 115, blur: 1 }], text: '20 МИНУТ', pos: 'tl', font: 'russo', tcol: '#ffd400', fx: ['sparkles'], prop: { kind: 'photo', text: 'КНИГА', x: 560, y: 500, rot: -10, s: .5 } },
    { beat: 24, loc: 'office', layout: 'duo', pose: 'thumb', eyes: 'smug', mouth: 'grin', duo: { who: 'friend', pose: 'facepalm', eyes: 'teary', mouth: 'wavy' }, text: 'СОБЕСЕДОВАНИЕ', font: 'oswald', tcol: '#4dff9b' },
    { beat: 29, loc: 'retro', time: 'night', who: 'friend', pose: 'mouth', eyes: 'shock', mouth: 'o', text: 'СТРАНИЦА 47', pos: 'tl', font: 'rubik', tcol: '#ff9f1a', fx: ['stars'], prop: { kind: 'note', text: 'СТР. 47', x: 330, y: 520, rot: -6, s: .8 } },
  ],
  5210: [
    { beat: 0, loc: 'school', pose: 'hold', flip: true, eyes: 'smug', mouth: 'smirk', look: [-.4, 0], text: 'СПРАВКА НА 10 ЛЕТ', pos: 'tl', font: 'russo', tcol: '#ff3b4a', prop: { kind: 'note', text: 'ОСВОБОЖДЁН', x: 520, y: 520, rot: -8, s: .75 } },
    { beat: 15, loc: 'office', layout: 'left', outfit: { top: '#2f5fa8', garment: 'coat' }, pose: 'facepalm', eyes: 'teary', mouth: 'scream', rim: '#ff3b4a', text: 'СПИНА В 21', lines: ['СПИНА', 'В 21'], pos: 'tr', font: 'oswald', tcol: '#ff3b4a', fx: ['lightning'] },
    { beat: 22, loc: 'playground', season: 'summer', outfit: { top: '#2f5fa8', garment: 'coat' }, pose: 'down', eyes: 'teary', mouth: 'scream', sweat: true, headTilt: 10, cast2: [{ ...NEPHEW, pose: 'peace', eyes: 'happy', mouth: 'laugh', x: 300, y: 480, r: 105 }], text: 'НЕ ДОГНАЛ', pos: 'tr', font: 'rubik', tcol: '#ffd400', fx: ['speed'] },
  ],
});
