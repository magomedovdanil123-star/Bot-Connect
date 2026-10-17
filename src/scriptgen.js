// Генератор сценариев: тема -> готовый сценарий под движок (хомяк, локации, действия), через Claude API.
// Ключ: ANTHROPIC_API_KEY. Из регионов, где API недоступен напрямую, — адрес посредника в ANTHROPIC_BASE_URL.
import Anthropic from '@anthropic-ai/sdk';
import { secret } from './youtube.js';

const MODEL = process.env.SCRIPT_MODEL || 'claude-opus-5-5';

// Словарь, который движок умеет «оживлять»: чем точнее сценарий в него попадает, тем богаче анимация
const SYSTEM = `Ты — автор сценариев русскоязычного YouTube-канала о личных финансах. Ведущий и главный герой — мультяшный Хомяк в деловом костюме (на сленге «хомяк» — обычный человек, который учится обращаться с деньгами). Тон: дружелюбный, живой, с юмором, без нравоучений.

Ролик собирается автоматически: каждая строка сценария — отдельная сцена, анимация подбирается по словам. Поэтому:
- Одна короткая фраза на строку (6–14 слов), 14–22 строки. Без нумерации, заголовков, ремарок, эмодзи и пустых строк.
- Героя называй «Хомяк» (можно «он»). Действия, которые умеет анимация: получает (зарплату), платит картой, тратит, кэшбэк, откладывает, копит, паникует, думает, радуется, грустит, бежит в колесе, спит на горе купюр, изучает график, считает, не понимает, летит на ракете, машет «привет».
- Места меняются по словам: дома, в офисе, в магазине, в банке, на бирже, на улице, на Луне. Меняй место 3–5 раз за ролик.
- «Все хомяки вокруг…» показывает толпу хомяков. Обращение «ты/вы» — Хомяк говорит прямо в камеру.
- Суммы пиши цифрами с «рублей» (например, 3 000 рублей) — они превращаются в анимированные плашки.

Структура: 1) крючок в первой строке — неожиданный факт или боль зрителя; 2) проблема глазами Хомяка; 3) история: что Хомяк делает и что из этого выходит; 4) простое решение в 2–4 шагах; 5) вывод одной фразой; 6) последняя строка — призыв подписаться.

Правила честности: не выдумывай реальную статистику, проценты конкретных банков и гарантии дохода; суммы — только как условный пример («например»). Не называй конкретные банки и компании. Не обещай заработок. Не давай индивидуальных инвестиционных рекомендаций.

Выведи только сам сценарий — строки текста, ничего больше.`;

export const scriptGenReady = () => Boolean(secret('ANTHROPIC_API_KEY') || process.env.ANTHROPIC_AUTH_TOKEN);

/** Тема (и пожелания) -> текст сценария. */
export async function generateScript(topic, { variant = 0 } = {}) {
  // ключ и адрес посредника могут лежать в data/secrets.env (присланы через бота)
  const client = new Anthropic({ timeout: 180_000, ...(secret('ANTHROPIC_API_KEY') ? { apiKey: secret('ANTHROPIC_API_KEY') } : {}), ...(secret('ANTHROPIC_BASE_URL') ? { baseURL: secret('ANTHROPIC_BASE_URL') } : {}) });
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'high' },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Тема ролика: ${topic}${variant ? `\n\nНужен другой вариант: другой крючок и другая история, чем в прошлый раз (вариант ${variant + 1}).` : ''}` }],
    });
    if (res.stop_reason === 'refusal') throw new Error('Нейросеть отказалась писать сценарий на эту тему — переформулируйте тему.');
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    return text.split('\n').map(l => l.replace(/^\s*(\d+[.)]|[-•*])\s*/, '').trim()).filter(Boolean).join('\n');
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('Ключ API нейросети не подошёл (ANTHROPIC_API_KEY).');
    if (e instanceof Anthropic.PermissionDeniedError) throw new Error('Доступ к API запрещён — из этого региона нужен адрес посредника в ANTHROPIC_BASE_URL.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Слишком много запросов к нейросети — попробуйте через минуту.');
    if (e instanceof Anthropic.APIConnectionError) throw new Error('Нет связи с API нейросети — проверьте ANTHROPIC_BASE_URL или сеть сервера.');
    if (e instanceof Anthropic.APIError) throw new Error(`Ошибка API нейросети (${e.status}): ${e.message}`);
    throw e;
  }
}
