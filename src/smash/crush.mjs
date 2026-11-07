// 💥 CRUSH MOTION — залипалки-разрушения для автопилота: вариант сцены по номеру ролика и упаковка (названия, описание, теги, комментарий).
// Каждый номер — своя комбинация окружения, ловушки, машин и надписи, чтобы серия не была копиями одного ролика (правило YouTube о неаутентичном контенте).
export const ENVS = ['summer', 'winter', 'autumn', 'sunset', 'desert'];
const ENV_RU = { summer: 'лето', winter: 'зима', autumn: 'осень', sunset: 'закат', desert: 'пустыня' };
const ENV_TAG = { summer: '', winter: ' на ЗИМНЕЙ трассе ❄️', autumn: ' в осеннем лесу 🍂', sunset: ' на закате 🌅', desert: ' в пустыне 🏜' };
const HOOKS = { hammer: ['КТО ПРОЕДЕТ?', 'ПРОСКОЧИШЬ?', 'МОЛОТ НЕ ЖДЁТ', 'РИСКНЁШЬ?', 'УСПЕЕТ ХОТЬ ОДНА?'], ball: ['ПРОСКОЧИТ ХОТЬ ОДНА?', 'ШАР НЕ ПРОМАХНЁТСЯ', 'КТО УЦЕЛЕЕТ?', 'УСПЕЕШЬ?'] };

// вариант сцены по номеру: окружения идут по кругу без повторов подряд (лето → осень → пустыня → зима → закат), каждый 3-й — шар, seed у каждого свой
export function crushVariant(n) {
  const env = ENVS[(n * 2 + 3) % ENVS.length], trap = n % 3 === 0 ? 'ball' : 'hammer', hooks = HOOKS[trap];
  return { n, env, trap, seed: 1000 + n * 17, hook: hooks[Math.floor(n / 2) % hooks.length], envRu: ENV_RU[env] };
}

// упаковка после рендера: знаем, сколько машин разбито и попал ли автобус
export function crushPack(v, r = {}) {
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
