import type { LongformVoice } from "./longform-visual-director";

export const PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TEST_LINES = [
  "В 2013 году датирован генезис-блок сети. Это историческая точка, а не дата рыночного среза.",
  "Цена монеты относится только к зафиксированному моменту. Смотрим на значение вместе с источником и временем обновления.",
  "В недельном ряду покажем измеренный восходящий фрагмент по реальным точкам, не продолжая линию в будущее.",
  "В том же ряду есть нисходящий участок. Он описывает прошлое снижение, а не сигнал для сделки.",
  "Рыночная капитализация оценивает весь обращающийся рынок, а не цену одной монеты и не деньги на счёте.",
  "Сравним монету с биткоином за одинаковые семь дней. Один временной интервал даёт контекст, но не объясняет причины.",
  "Мемы и заголовки создают информационный шум. Эта сцена — абстрактная реконструкция, а не настоящая новость.",
  "У монеты есть сообщество и проекты. Не будем подменять их выдуманными числами аудитории, постами или цитатами.",
  "Блокчейн — последовательность блоков и узлов. Эта схема объясняет принцип и не показывает живые транзакции.",
  "История и график описывают прошлое, а не будущую цену. Проверяйте источник, временной горизонт и риск.",
] as const;

export function buildPremiumDynamicFinanceV1_1SemanticTestVoices(input: {
  sceneTimings?: Array<{ startTime: number; endTime: number }>;
} = {}): LongformVoice[] {
  if (
    input.sceneTimings
    && input.sceneTimings.length !== PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TEST_LINES.length
  ) {
    throw new Error("Semantic test voice timings must match the script line count");
  }
  const sceneDurationMs = 120_000 / PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TEST_LINES.length;
  return PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TEST_LINES.map((text, index) => ({
    sceneId: index + 1,
    startTime: input.sceneTimings?.[index]?.startTime ?? Math.round(index * sceneDurationMs),
    endTime: input.sceneTimings?.[index]?.endTime ?? Math.round((index + 1) * sceneDurationMs),
    text,
  }));
}