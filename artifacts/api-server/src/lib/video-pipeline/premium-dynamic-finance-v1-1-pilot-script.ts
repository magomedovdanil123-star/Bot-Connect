import type { LongformVoice } from "./longform-visual-director";

export const PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS = 120_000;

export const PREMIUM_DYNAMIC_FINANCE_V1_1_DOGECOIN_PILOT_LINES = [
  "Dogecoin, тикер DOGE. За две минуты посмотрим на историю и текущий рыночный срез, без прогнозов.",
  "Срез CoinGecko: текущая цена, рыночная капитализация и суточный объём. Значения относятся к моменту обновления источника.",
  "Семидневный график цены Dogecoin построен по точкам CoinGecko. Историческая линия показывает прошлые наблюдения, не прогноз.",
  "Один факт: год и дата запуска Dogecoin берутся из поля генезиса CoinGecko, если источник их предоставляет.",
  "На временной шкале сопоставим подтверждённую дату запуска и момент текущего среза, не заполняя пробелы догадками.",
  "Сравним недельное изменение DOGE, Bitcoin и Ethereum на одинаковом семидневном интервале, только по данным CoinGecko.",
  "Новостная карточка в этой сцене редакционная и иллюстративная: она не сообщает о реальном событии или заявлении.",
  "Биржевой торговый терминал ниже вымышленный: это дизайн-пример, не стакан заявок и не исполняемые котировки.",
  "Технологическая схема блокчейна иллюстративная. Она не показывает транзакции или внутреннее состояние сети в реальном времени.",
  "Список для проверки: цена, недельная динамика и риск. Каждое рыночное число должно иметь источник и дату.",
  "«Прошлая недельная динамика не гарантирует будущего результата» — это ограничение, а не инвестиционный совет.",
  "Итог: рынок меняется, волатильность несёт риск потерь. Данные в этом ролике не являются прогнозом доходности.",
] as const;

export function buildPremiumDynamicFinanceV1_1PilotVoices(): LongformVoice[] {
  const sceneDurationMs = PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS
    / PREMIUM_DYNAMIC_FINANCE_V1_1_DOGECOIN_PILOT_LINES.length;
  return PREMIUM_DYNAMIC_FINANCE_V1_1_DOGECOIN_PILOT_LINES.map((text, index) => ({
    sceneId: index + 1,
    startTime: Math.round(index * sceneDurationMs),
    endTime: Math.round((index + 1) * sceneDurationMs),
    text,
  }));
}