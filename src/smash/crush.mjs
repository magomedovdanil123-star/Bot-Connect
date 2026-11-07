// 💥 CRUSH MOTION — залипалки-разрушения для автопилота: вариант сцены по номеру ролика и упаковка (названия, описание, теги, комментарий).
// Каждый номер — своя комбинация окружения, ловушки, машин и надписи, чтобы серия не была копиями одного ролика (правило YouTube о неаутентичном контенте).
const BOTTLES = false;   // включится, когда тестовый ролик с бутылками пройдёт проверку
export const ENVS = ['summer', 'winter', 'autumn', 'sunset', 'desert'];
const ENV_RU = { summer: 'лето', winter: 'зима', autumn: 'осень', sunset: 'закат', desert: 'пустыня' };
const ENV_TAG = { summer: '', winter: ' на ЗИМНЕЙ трассе ❄️', autumn: ' в осеннем лесу 🍂', sunset: ' на закате 🌅', desert: ' в пустыне 🏜' };
const STYLE_RU = { neon: 'неон', classic: 'классика', ice: 'лёд', fire: 'огонь' };
const HOOKS = { bottles: ['СКОЛЬКО РАЗОБЬЁТ?', 'СТРАЙК ИЛИ НЕТ?', 'ВСЕ В ДРЕБЕЗГИ?', 'ВКЛЮЧИ ЗВУК'], hammer: ['КТО ПРОЕДЕТ?', 'ПРОСКОЧИШЬ?', 'МОЛОТ НЕ ЖДЁТ', 'РИСКНЁШЬ?', 'УСПЕЕТ ХОТЬ ОДНА?'], ball: ['ПРОСКОЧИТ ХОТЬ ОДНА?', 'ШАР НЕ ПРОМАХНЁТСЯ', 'КТО УЦЕЛЕЕТ?', 'УСПЕЕШЬ?'] };

// вариант сцены по номеру: каждый 4-й — боулинг по бутылкам (стиль зала по кругу), остальные — трасса:
// окружения идут по кругу без повторов подряд (лето → осень → пустыня → зима → закат), каждый 3-й — шар, seed у каждого свой
export function crushVariant(n) {
  if (BOTTLES && n % 4 === 2) { const k = (n - 2) / 4, style = ['neon', 'fire', 'ice', 'classic'][k % 4];
    return { n, scene: 'bottles', style, seed: 2000 + n * 13, hook: HOOKS.bottles[k % HOOKS.bottles.length], envRu: 'боулинг, ' + STYLE_RU[style] }; }
  const env = ENVS[(n * 2 + 3) % ENVS.length], trap = n % 3 === 0 ? 'ball' : 'hammer', hooks = HOOKS[trap];
  return { n, scene: 'road', env, trap, seed: 1000 + n * 17, hook: hooks[Math.floor(n / 2) % hooks.length], envRu: ENV_RU[env] };
}

// упаковка после рендера: знаем, сколько машин разбито и попал ли автобус
export function crushPack(v, r = {}) {
  if (v.scene === 'bottles') return bottlesPack(v, r);
  const hits = r.hits || 0, cars = r.cars || 14, where = ENV_TAG[v.env], ball = v.trap === 'ball';
  const T = ball ? [
    `ШАР-РАЗРУШИТЕЛЬ против ${cars} машин${where} 💥`,
    `Проскочит хоть одна? ШАР-РАЗРУШИТЕЛЬ${where} ⚫💥`,
    `${hits} машин в хлам: ШАР-РАЗРУШИТЕЛЬ${where}`,
    r.buses ? `Шар-разрушитель против АВТОБУСА 🚌💥${where}` : `Огромный ШАР сносит машины${where} 💥`,
  ] : [
    `КТО ПРОЕДЕТ под МОЛОТОМ?${where} 🔨💥`,
    `${cars} машин против МОЛОТА${where} — проскочит хоть одна? 🔨`,
    `Гигантский МОЛОТ разносит машины${where} 💥`,
    r.buses ? `МОЛОТ против АВТОБУСА 🔨🚌${where}` : `МОЛОТ разбил ${hits} машин${where} 💥`,
  ];
  const k = Math.floor(v.n / 3) % T.length, titles = [0, 1, 2].map(i => (T[(k + i) % T.length] + ' #shorts').replace(/\s+/g, ' ').slice(0, 100));
  const what = ball ? 'Огромный шар-разрушитель раскачивается над трассой' : 'Гигантский маятник-молот качается над трассой';
  const description = `${what}${where ? where.replace(/ [^ ]+$/, '') : ''}. Машины пытаются проскочить… получится ли хоть у одной? 💥
Итог: разбито ${hits} из ${cars}. Досмотри до повтора — какой удар самый жёсткий? Пиши в комментах 👇

🔔 Подпишись на CRUSH MOTION — каждый день новые разрушения, краш-тесты и залипательный разнос.

#shorts #разрушения #краштест #${ball ? 'шарразрушитель' : 'молот'} #залипалка #асмр #crash #carcrash #satisfying #destruction

Sounds: Oculus Audio Pack (Meta), CC BY 4.0`;
  const tags = [ball ? 'шар разрушитель' : 'молот', ball ? 'wrecking ball' : 'hammer', 'разрушения', 'краш тест', 'машины', 'авария', 'залипалка', 'асмр', 'кто проедет', 'crash test', 'car crash', 'destruction', 'satisfying', 'физика', 'симулятор', 'shorts', 'crush motion', ...(v.env === 'winter' ? ['зима'] : v.env === 'desert' ? ['пустыня'] : [])];
  const comments = ['На каком ударе ты бы зажмурился? 😅 1, 2 или 3 повтор?', 'Какую ловушку поставить следующей: пресс, шредер или пила? 👇', 'Сколько машин проскочит в следующий раз? Пиши число 👇', 'Какая машина отлетела красивее всех? 👇'];
  return { title: titles[0], titles, description, tags, comment: comments[v.n % comments.length] };
}

// упаковка боулинга по бутылкам: 3 раунда (10 → 28 → 105), r.hits — сколько разбито всего, r.strikes — сколько страйков
function bottlesPack(v, r = {}) {
  const total = r.cars || 143, hits = r.hits || 0;
  const T = [
    `Шар для БОУЛИНГА против ${total} бутылок 🎳💥`,
    `10, 28 или 105 бутылок — сколько РАЗОБЬЁТ шар? 🎳`,
    `Боулинг по 105 СТЕКЛЯННЫМ бутылкам 🍾💥`,
    `${hits} бутылок в ДРЕБЕЗГИ одним шаром 🎳`,
    r.strikes ? `СТРАЙК из стеклянных бутылок 🎳🍾` : `Звук разбитого СТЕКЛА 🔊 боулинг по бутылкам`,
  ];
  const k = Math.floor(v.n / 4) % T.length, titles = [0, 1, 2].map(i => (T[(k + i) % T.length] + ' #shorts').replace(/\s+/g, ' ').slice(0, 100));
  const description = `Шар для боулинга против стеклянных бутылок: три раунда — 10, 28 и 105 бутылок. Включи звук 🔊 — один удар, и всё в дребезги 🍾💥
Итог: разбито ${hits} из ${total}${r.strikes ? `, страйков: ${r.strikes}` : ''}. Какой раунд самый залипательный? Пиши в комментах 👇

🔔 Подпишись на CRUSH MOTION — каждый день новые разрушения, краш-тесты и залипательный разнос.

#shorts #боулинг #бутылки #стекло #залипалка #асмр #asmr #glassbreaking #satisfying #destruction

Sounds: Oculus Audio Pack (Meta), CC BY 4.0`;
  const tags = ['боулинг', 'бутылки', 'стекло', 'разбить стекло', 'звук стекла', 'страйк', 'залипалка', 'асмр', 'asmr', 'glass breaking', 'bowling', 'bottles', 'satisfying', 'destruction', 'shorts', 'crush motion'];
  const comments = ['Какой раунд залип сильнее: 10, 28 или 105? 👇', 'Сколько бутылок поставить в следующий раз? Пиши число 👇', 'Звук стекла на 10 из 10? 🔊👇', 'Что разбить шаром следующим: бокалы, лампочки или аквариум? 👇'];
  return { title: titles[0], titles, description, tags, comment: comments[v.n % comments.length] };
}
