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
