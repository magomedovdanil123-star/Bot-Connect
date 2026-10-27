/* «7 приёмов манипуляции» — данные ролика (без функций: их читает и сцена, и build.mjs для звука).
 * Время всегда задаётся фразой диктора: { l: номер фразы в листе, f: доля фразы 0..1 }.
 * Листы = листы сценария src/psy/scripts/1003.mjs (20 листов) + концовка (лист 20, фразы 55–57).
 * Миры = палитры code-cartoon; между мирами — ирис, внутри мира — проезд камеры между «площадками» (area). */
window.STORY = {
  lead: 0.8,            // голос начинается через 0.8 с: первый кадр уже нарисован (обложка)
  area: 2600,           // расстояние между площадками внутри мира (мировые пиксели)
  worlds: [
    { id: "intro", pal: "graphite", sheets: [0, 1] },
    { id: "w1", pal: "notebook", sheets: [2, 3], ch: [1, "НОГА В ДВЕРИ"] },
    { id: "w2", pal: "blueprint", sheets: [4, 5], ch: [2, "ДВЕРЬ ПЕРЕД НОСОМ"] },
    { id: "w3", pal: "kraft", sheets: [6, 7], ch: [3, "ПОДАРОК"] },
    { id: "w4", pal: "neon", sheets: [8, 9, 10], ch: [4, "ДЕФИЦИТ"] },
    { id: "w5", pal: "collage", sheets: [11, 12], ch: [5, "ВСЕ ТАК ДЕЛАЮТ"] },
    { id: "w6", pal: "chalk", sheets: [13, 14], ch: [6, "ЯКОРЬ"] },
    { id: "w7", pal: "retro", sheets: [15, 16], ch: [7, "«ПОТОМУ ЧТО»"] },
    { id: "w8", pal: "lubok", sheets: [17], ch: [0, "КАК ЗАЩИТИТЬСЯ"] },
    { id: "w9", pal: "ink", sheets: [18], ch: [0, "ГДЕ НАУКА СПОРИТ"] },
    { id: "w10", pal: "graphite", sheets: [19, 20], ch: [0, "ЗАДАНИЕ"] },
  ],
  // число фраз в каждом листе (как в сценарии) — по ним считаются времена
  lines: [3, 2, 3, 3, 3, 3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 2, 3, 2, 2, 3],
  // момент, когда Саша «попался» на приём n (ниточка падает): лист, фраза, доля
  caught: [null, [2, 2, .45], [4, 2, .25], [6, 2, .55], [8, 2, .25], [11, 2, .35], [13, 1, .75], [15, 1, .45]],
  // перерезание ниточек в главе «Как защититься»
  cut: [17, 1, .55],
  sheets: [
    /* 0 — вступление */
    { cast: [{ id: "s", x: 960, role: "a1" }],
      beats: [{ l: 0, f: .15, who: "s", pose: "wave", face: "happy" }, { l: 0, f: .55, who: "s", pose: "cross", face: "smug", say: "Я САМ РЕШАЮ!" },
        { l: 1, f: .05, who: "s", pose: "stand", face: "surprised", fx: "!" }, { l: 1, f: .55, who: "s", pose: "scared", face: "scared", fx: "shake" },
        { l: 2, f: .1, who: "s", pose: "shrug", face: "neutral", fx: "?" }],
      show: { l: 2, f: .3, text: "СКОЛЬКО ИЗ 7 СРАБОТАЮТ НА ТЕБЕ?" },
      sfx: [{ l: 1, f: .2, type: "swell", dur: 1.4, gain: -8 }] },
    /* 1 — седьмой самый коварный */
    { area: 1, cast: [{ id: "p", x: 430, role: "paper", coat: true, glasses: true }],
      beats: [{ l: 0, f: .4, who: "p", pose: "point", face: "smug" }, { l: 1, f: .1, who: "p", pose: "explain", face: "neutral", say: "ВСЁ — ИЗ ЭКСПЕРИМЕНТОВ" }],
      show: { l: 1, f: .6, text: "ДОСМОТРИ ДО №7" },
      sfx: [{ l: 0, f: .05, type: "write", dur: 1.1, gain: -8 }, { l: 0, f: .45, type: "thump", gain: -8 }, { l: 1, f: .35, type: "chime", gain: -10 }] },

    /* 2 — нога в двери: сцена */
    { cast: [{ id: "s", x: 1360, look: -1, role: "a1" }, { id: "a", x: 160, role: "a2", tie: true, hold: "clip" }],
      beats: [{ l: 0, f: .05, who: "a", walk: 800 }, { l: 0, f: .45, who: "a", pose: "talk", face: "happy", say: "ВСЕГО ОДИН ВОПРОС!" },
        { l: 1, f: .05, who: "s", pose: "shrug", face: "neutral", say: "НУ ДАВАЙТЕ" }, { l: 1, f: .55, who: "a", pose: "explain", face: "happy", say: "А ПРОВЕРКА ВОДЫ?" },
        { l: 2, f: 0, who: "a", pose: "give", face: "smug", say: "ПОДПИШИТЕ ТУТ" }, { l: 2, f: .35, who: "s", pose: "hold", face: "sad", hold: "pen" }],
      show: { l: 2, f: .65, text: "ФИЛЬТР ЗА 40 000 ₽" },
      sfx: [{ l: 0, f: 0, type: "click", gain: -8 }] },
    /* 3 — нога в двери: опыт */
    { area: 1, cast: [{ id: "p", x: 380, role: "paper", coat: true, glasses: true }],
      beats: [{ l: 0, f: .3, who: "p", pose: "explain" }, { l: 1, f: .45, who: "p", pose: "point", face: "surprised", fx: "!" }, { l: 2, f: .2, who: "p", pose: "shrug", face: "smug", say: "«Я ЖЕ ПОМОГАЮ…»" }],
      show: { l: 2, f: .55, text: "МЕЛОЧЬ → БОЛЬШОЕ" },
      sfx: [{ l: 0, f: .55, type: "hatch", dur: 1.2, gain: -9 }, { l: 1, f: .35, type: "hatch", dur: 1.2, gain: -9 }, { l: 1, f: .8, type: "chime", gain: -9 }] },

    /* 4 — дверь перед носом: сцена */
    { cast: [{ id: "b", x: 540, role: "a3", glasses: true, tie: true }, { id: "s", x: 1330, look: -1, role: "a1", pose: "sit" }],
      beats: [{ l: 0, f: .3, who: "b", pose: "explain", face: "happy", say: "ПРОЕКТ ЗА ВЫХОДНЫЕ!" },
        { l: 1, f: 0, who: "s", pose: "angry", face: "angry", fx: "shake", say: "НЕВОЗМОЖНО!" }, { l: 1, f: .5, who: "b", pose: "shrug", face: "sad", say: "НУ ХОТЬ ПРЕЗЕНТАЦИЮ?" },
        { l: 2, f: .1, who: "s", pose: "sit", face: "happy", say: "ФУХ… ЛАДНО!" }, { l: 2, f: .5, who: "b", pose: "cross", face: "smug" }],
      show: { l: 2, f: .7, text: "ПРОЕКТ НЕ СДАЛИ — ПРЕЗЕНТАЦИЮ СДАЛИ" },
      sfx: [{ l: 0, f: .4, type: "scribble", dur: 1.2, gain: -9 }, { l: 1, f: .55, type: "whoosh", dur: .6, gain: -8 }] },
    /* 5 — дверь перед носом: опыт */
    { area: 1, cast: [{ id: "p", x: 380, role: "paper", coat: true, glasses: true }],
      beats: [{ l: 0, f: .3, who: "p", pose: "explain" }, { l: 1, f: .5, who: "p", pose: "pointup", face: "surprised", fx: "!" }, { l: 2, f: .3, who: "p", pose: "talk", face: "smug", say: "ОН ЖЕ УСТУПИЛ…" }],
      show: { l: 2, f: .55, text: "БОЛЬШОЕ «НЕТ» → МАЛЕНЬКОЕ «ДА»" },
      sfx: [{ l: 1, f: .1, type: "erase", dur: .7, gain: -8 }, { l: 1, f: .55, type: "chime", gain: -9 }] },

    /* 6 — подарок: сцена */
    { cast: [{ id: "j", x: 180, role: "warm", hold: "cup" }, { id: "s", x: 1360, look: -1, role: "a1" }],
      beats: [{ l: 0, f: .05, who: "j", walk: 880 }, { l: 0, f: .5, who: "j", pose: "give", face: "happy", say: "ДЕРЖИ, ЭТО ТЕБЕ!" },
        { l: 0, f: .85, who: "s", pose: "hold", face: "happy", hold: "cup" }, { l: 0, f: .85, who: "j", hold: null, pose: "stand" },
        { l: 1, f: .1, who: "j", hold: "ticket", pose: "explain", face: "smug", say: "КУПИШЬ БИЛЕТЫ?" },
        { l: 2, f: 0, who: "s", face: "sad", think: "ОН ЖЕ КОФЕ ПРИНЁС…" }, { l: 2, f: .6, who: "s", pose: "shrug", say: "ДАВАЙ…" }],
      show: { l: 2, f: .8, text: "КОФЕ: 200 ₽ · БИЛЕТЫ: 5000 ₽" },
      sfx: [{ l: 2, f: .75, type: "paper", gain: -6 }, { l: 2, f: .85, type: "paper", gain: -6 }] },
    /* 7 — подарок: опыт */
    { area: 1, cast: [{ id: "p", x: 380, role: "paper", coat: true, glasses: true }],
      beats: [{ l: 0, f: .3, who: "p", pose: "hold", hold: "cola" }, { l: 1, f: .5, who: "p", pose: "point", hold: null, face: "surprised", fx: "!" }, { l: 2, f: .3, who: "p", pose: "explain", face: "smug", say: "ЭТО КРЮЧОК" }],
      show: { l: 2, f: .6, text: "ПОДАРОК = КРЮЧОК" },
      sfx: [{ l: 1, f: .2, type: "paper", gain: -6 }, { l: 1, f: .45, type: "thump", gain: -5 }, { l: 2, f: .45, type: "scribble", dur: 1, gain: -9 }] },

    /* 8 — дефицит: сцена */
    { cast: [{ id: "s", x: 640, role: "a1", pose: "sitphone", hold: "phone" }],
      beats: [{ l: 0, f: .2, who: "s", face: "neutral" }, { l: 0, f: .6, who: "s", face: "surprised", fx: "!", think: "9 МИНУТ?!" },
        { l: 1, f: .3, who: "s", face: "happy", think: "МНЕ НУЖНО!" }, { l: 2, f: .15, who: "s", pose: "cheer", face: "happy", fx: "jump", say: "КУПЛЕНО!" }],
      show: { l: 2, f: .55, text: "ЗАВТРА ТАЙМЕР — СНОВА 9 МИНУТ" },
      sfx: [{ l: 0, f: .3, type: "click", gain: -8 }, { l: 2, f: .05, type: "click", gain: -3 }, { l: 2, f: .7, type: "sparkle", gain: -8 }] },
    /* 9 — дефицит: опыт */
    { area: 1, cast: [{ id: "p", x: 380, role: "paper", coat: true, glasses: true }],
      beats: [{ l: 0, f: .3, who: "p", pose: "point", say: "10 ШТУК ИЛИ 2?" }, { l: 1, f: .1, who: "p", pose: "hold", hold: "cookie", face: "happy", say: "ИЗ ПУСТОЙ — ВКУСНЕЕ!" }, { l: 2, f: .2, who: "p", pose: "pointup", hold: null, face: "smug" }],
      show: { l: 2, f: .4, text: "МАЛО = ЦЕННО" },
      sfx: [{ l: 1, f: .5, type: "sparkle", gain: -8 }] },
    /* 10 — пауза: сколько из четырёх */
    { area: 2, cast: [{ id: "s", x: 520, role: "a1" }],
      beats: [{ l: 0, f: .1, who: "s", pose: "think", face: "neutral", think: "ХМ…" }, { l: 1, f: .1, who: "s", pose: "point", face: "happy" }],
      show: { l: 1, f: .3, text: "НАПИШИ ЦИФРУ В КОММЕНТАРИЯХ" },
      sfx: [{ l: 0, f: .3, type: "tick" }, { l: 0, f: .45, type: "tick" }, { l: 0, f: .6, type: "tick" }, { l: 0, f: .75, type: "tick" }] },

    /* 11 — все так делают: сцена */
    { cast: [{ id: "s", x: 420, role: "a1", hold: "phone", pose: "hold" }, { id: "f1", x: 1260, look: -1, role: "a3" }, { id: "f2", x: 1520, look: -1, role: "a2" }, { id: "f3", x: 1760, look: -1, role: "warm", s: .85 }],
      beats: [{ l: 0, f: .2, who: "f1", pose: "cheer", face: "happy", say: "МЫ ВСЕ УЖЕ ВЛОЖИЛИСЬ!" }, { l: 0, f: .4, who: "f2", pose: "cheer", face: "happy" }, { l: 0, f: .55, who: "f3", pose: "cheer", face: "happy" },
        { l: 1, f: .1, who: "s", face: "scared", fx: "!", think: "Я ЧТО, ОДИН?" }, { l: 2, f: .25, who: "s", pose: "give", face: "neutral", hold: "money" }],
      show: { l: 2, f: .6, text: "«ВСЕ» — НЕ ЗНАЧИТ «ПРАВЫ»" },
      sfx: [{ l: 0, f: .05, type: "paper", gain: -5 }, { l: 2, f: .45, type: "paper", gain: -6 }, { l: 2, f: .6, type: "paper", gain: -6 }, { l: 2, f: .75, type: "paper", gain: -6 }] },
    /* 12 — все так делают: опыт */
    { area: 1, cast: [{ id: "p", x: 360, role: "paper", coat: true, glasses: true }],
      beats: [{ l: 0, f: .3, who: "p", pose: "explain" }, { l: 1, f: .55, who: "p", pose: "point", face: "surprised", fx: "!" }, { l: 2, f: .3, who: "p", pose: "talk", face: "smug", say: "«В ЭТОМ НОМЕРЕ» — ЕЩЁ БОЛЬШЕ" }],
      show: { l: 2, f: .7, text: "ЧЕМ БЛИЖЕ «ВСЕ» — ТЕМ СИЛЬНЕЕ" },
      sfx: [{ l: 0, f: .2, type: "paper", gain: -5 }, { l: 1, f: .1, type: "paper", gain: -5 }, { l: 2, f: .2, type: "paper", gain: -5 }] },

    /* 13 — якорь: сцена */
    { cast: [{ id: "s", x: 520, role: "a1" }, { id: "r", x: 1420, look: -1, role: "a2", glasses: true, pose: "sit" }],
      beats: [{ l: 0, f: .1, who: "r", say: "СКОЛЬКО ХОТИТЕ?" }, { l: 0, f: .55, who: "s", pose: "shrug", face: "neutral", say: "100 000?" },
        { l: 1, f: 0, who: "r", face: "angry", say: "ОБЫЧНО — 70 000" }, { l: 1, f: .5, who: "s", pose: "talk", face: "happy", say: "ДАВАЙТЕ 80!" },
        { l: 2, f: .2, who: "r", face: "smug" }, { l: 2, f: .3, who: "s", pose: "cheer", face: "happy" }],
      show: { l: 2, f: .6, text: "МИНУС 20 000 — И ЕЩЁ РАД" },
      sfx: [{ l: 0, f: .6, type: "write", dur: .6, gain: -8 }, { l: 1, f: .05, type: "thump", gain: -3 }, { l: 1, f: .55, type: "write", dur: .6, gain: -8 }] },
    /* 14 — якорь: опыт */
    { area: 1, cast: [{ id: "p", x: 330, role: "paper", coat: true, glasses: true }],
      beats: [{ l: 0, f: .2, who: "p", pose: "point" }, { l: 1, f: .6, who: "p", pose: "explain", face: "surprised", fx: "!" }, { l: 2, f: .3, who: "p", pose: "pointup", face: "smug", say: "ПЕРВАЯ ЦИФРА ТЯНЕТ" }],
      show: { l: 2, f: .6, text: "НАЗОВИ СВОЮ ЦИФРУ ПЕРВЫМ" },
      sfx: [{ l: 0, f: .25, type: "whoosh", dur: 1.2, gain: -8 }, { l: 0, f: .8, type: "click", gain: -6 }, { l: 1, f: .5, type: "write", dur: .8, gain: -8 }, { l: 1, f: .85, type: "write", dur: .8, gain: -8 }] },

    /* 15 — «потому что»: сцена */
    { cast: [{ id: "s", x: 520, role: "a1", hold: "phone", pose: "phone" }, { id: "m", x: 1420, look: -1, role: "line", hold: "phone", pose: "phone" }],
      beats: [{ l: 0, f: .3, who: "m", face: "smug", say: "ПОТОМУ ЧТО ВЗЛОМАН!" }, { l: 0, f: .7, who: "s", face: "scared", fx: "shake" },
        { l: 1, f: .2, who: "s", face: "neutral", think: "ЕСТЬ ПРИЧИНА — ЗНАЧИТ, ПРАВДА" }, { l: 2, f: .05, who: "m", face: "happy" }],
      show: { l: 2, f: .15, text: "«ПОТОМУ ЧТО» ОТКЛЮЧАЕТ ПРОВЕРКУ" },
      sfx: [{ l: 0, f: .05, type: "rumble", dur: .8, gain: -10 }, { l: 2, f: .4, type: "rumble", dur: 1.4, gain: -12 }] },
    /* 16 — «потому что»: опыт */
    { area: 1, cast: [{ id: "p", x: 330, role: "paper", coat: true, glasses: true }],
      beats: [{ l: 0, f: .5, who: "p", pose: "point", face: "surprised", fx: "!" }, { l: 1, f: .3, who: "p", pose: "shrug", face: "smug", say: "В СПЕШКЕ — НЕ ПРОВЕРЯЕМ" }],
      show: { l: 1, f: .6, text: "УСЛЫШАЛ «ПОТОМУ ЧТО» — ПРОВЕРЬ" },
      sfx: [{ l: 0, f: .1, type: "paper", gain: -6 }, { l: 0, f: .6, type: "thump", gain: -4 }] },

    /* 17 — как защититься */
    { cast: [{ id: "s", x: 640, role: "a1" }, { id: "v", x: 1420, look: -1, role: "a2", tie: true }],
      beats: [{ l: 0, f: .1, who: "v", pose: "explain", face: "happy", say: "ТОЛЬКО СЕГОДНЯ!" }, { l: 0, f: .55, who: "v", fx: "jump", pose: "cheer" },
        { l: 1, f: 0, who: "s", pose: "think", think: "ХМ…" }, { l: 1, f: .4, who: "s", pose: "pointup", face: "smug", say: "ОТВЕЧУ ЗАВТРА" },
        { l: 2, f: .2, who: "v", pose: "sad", face: "sad" }, { l: 2, f: .45, who: "s", pose: "cheer", face: "happy", fx: "jump" }],
      show: { l: 2, f: .5, text: "ПАУЗА ЛОМАЕТ ЛЮБОЙ ПРИЁМ" },
      sfx: [{ l: 1, f: .45, type: "pop", gain: -4 }] },
    /* 18 — где наука спорит */
    { cast: [{ id: "p", x: 430, role: "paper", coat: true, glasses: true }],
      beats: [{ l: 0, f: .2, who: "p", pose: "shrug", face: "neutral" }, { l: 1, f: .2, who: "p", pose: "explain", face: "happy", say: "НО РАБОТАЮТ" }],
      show: { l: 1, f: .6, text: "НЕ ВОЛШЕБНАЯ КНОПКА" },
      sfx: [{ l: 0, f: .45, type: "tick" }, { l: 1, f: .3, type: "thump", gain: -6 }, { l: 1, f: .45, type: "thump", gain: -6 }] },
    /* 19 — задание */
    { cast: [{ id: "s", x: 260, role: "a1", hold: "loupe" }],
      beats: [{ l: 0, f: .1, who: "s", walk: 820 }, { l: 0, f: .6, who: "s", pose: "hold", face: "smug", say: "ПРИЁМ №4!" }, { l: 1, f: .2, who: "s", pose: "wave", face: "happy", hold: null }],
      show: { l: 1, f: .3, text: "СКОЛЬКО ИЗ 7? ПИШИ В КОММЕНТАРИЯХ" },
      sfx: [{ l: 0, f: .62, type: "chime", gain: -8 }] },
    /* 20 — концовка: весь разбор на одном листе */
    { area: 1, cast: [],
      beats: [],
      show: null,
      sfx: [{ l: 0, f: 0, type: "page", gain: -4 }, { l: 1, f: .3, type: "pop", gain: -4 }, { l: 1, f: .5, type: "chime", gain: -6 }, { l: 2, f: .4, type: "sparkle", gain: -6 }] },
  ],
};
