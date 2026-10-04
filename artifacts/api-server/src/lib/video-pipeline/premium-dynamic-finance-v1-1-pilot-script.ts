import type { LongformVoice } from "./longform-visual-director";

export const PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS = 120_000;
export const PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_SCENE_COUNT = 10;
export const PREMIUM_DYNAMIC_FINANCE_V1_1_GENESIS_SOURCE_URL =
  "https://github.com/dogecoin/dogecoin/blob/master/src/chainparams.cpp";

export const PREMIUM_DYNAMIC_FINANCE_V1_1_DOGECOIN_PILOT_LINES = [
  "Начнём с происхождения Dogecoin: это история интернет-мема, а не график котировки.",
  "Теперь сама цена Dogecoin за семь дней: линия показывает прошлые наблюдения, а не следующий шаг.",
  "На графике цены выделим фактический восходящий отрезок. Рост прошлого не обещает продолжения.",
  "Здесь — фактическое падение цены внутри того же ряда. Не добавляем процент, которого нет в данных.",
  "Отдельный факт — рыночная капитализация на момент среза. Это размер рынка, а не цена одной монеты.",
  "Сравним Dogecoin, Bitcoin и Ethereum за одинаковые семь дней. Это рыночный контекст, не объяснение причин.",
  "Новостной формат здесь — редакционный макет, а не настоящая публикация или неподтверждённое событие.",
  "Сообщество покажем через сообщения и связи, без придуманного числа участников и фальшивых постов.",
  "Блокчейн покажем как схему узлов и потоков; это не карта транзакций в реальном времени.",
  "График показывает, что было, но не говорит, что будет. Проверяйте риск, источник и временной горизонт.",
] as const;

export function buildPremiumDynamicFinanceV1_1PilotVoices(input: {
  genesisDate?: string | null;
  sceneTimings?: Array<{ startTime: number; endTime: number }>;
} = {}): LongformVoice[] {
  const lines: string[] = [...PREMIUM_DYNAMIC_FINANCE_V1_1_DOGECOIN_PILOT_LINES];
  if (input.genesisDate) {
    const year = input.genesisDate.match(/(?:19|20)\d{2}/u)?.[0];
    if (year) {
      lines[0] = `В ${year} началась история Dogecoin как интернет-мема; дату берём только из подтверждённого источника.`;
    }
  }

  const sceneDurationMs =
    PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS
    / PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_SCENE_COUNT;
  if (input.sceneTimings && input.sceneTimings.length !== lines.length) {
    throw new Error("Pilot voice scene timings must match the script line count");
  }
  return lines.map((text, index) => ({
    sceneId: index + 1,
    startTime: input.sceneTimings?.[index]?.startTime
      ?? Math.round(index * sceneDurationMs),
    endTime: input.sceneTimings?.[index]?.endTime
      ?? Math.round((index + 1) * sceneDurationMs),
    text,
  }));
}