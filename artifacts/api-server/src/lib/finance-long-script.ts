export const MAX_FINANCE_LONG_CUSTOM_SCRIPT_CHARACTERS = 30_000;

export type FinanceLongCoinScript = {
  coinQuery: string;
  narration: string;
};

/**
 * Treat a short leading "Монета: ..." line as metadata, not narration.
 * Keeping this explicit avoids guessing between a video's subject and coins
 * mentioned for comparison later in the script.
 */
export function extractFinanceLongCoinHeader(text: string): FinanceLongCoinScript | null {
  const lines = text.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line, index) => (
    index < 12 && /^\s*(?:монета|актив|тикер|coin|asset|ticker)\s*[:—–-]\s*.+\s*$/iu.test(line)
  ));
  if (headerIndex < 0) return null;

  const match = lines[headerIndex]!.match(/^\s*(?:монета|актив|тикер|coin|asset|ticker)\s*[:—–-]\s*(.+?)\s*$/iu);
  const coinQuery = match?.[1]?.trim().replace(/^[$#]\s*/u, "");
  if (!coinQuery || coinQuery.length > 80) return null;

  const narration = lines.filter((_, index) => index !== headerIndex).join("\n").trim();
  if (!narration) return null;
  return { coinQuery, narration };
}

/**
 * Editorial guidance for AI-generated finance Long videos.
 *
 * Kept separate from the global script-generator prompt so the livelier
 * financial-host voice cannot leak into stories, Shorts, or author scripts.
 * This is deliberately about delivery and structure: factual claims still
 * remain governed by the finance guardrails in telegram-bot.ts.
 */
export const FINANCE_LONG_GENERATED_SCRIPT_GUIDANCE = [
  "Подавай материал как живой разговор спокойного, внимательного ведущего с умным новичком, а не как сухой отчёт или набор карточек.",
  "Начни с конкретного факта, вопроса или наблюдения по теме и сразу объясни, почему зрителю важно разобраться именно в этом.",
  "Строй каждую главу по понятной дуге: вопрос или тезис, подтверждённые данные, простое объяснение их смысла, ограничение или альтернативное толкование, затем естественный переход к следующей главе.",
  "Соединяй главы устными мостиками: напомни, к какому вопросу мы пришли, и объясни, почему следующий факт помогает на него ответить. Не начинай каждую сцену заново и не перечисляй сцены.",
  "Объясняй финансовые термины, цифры, период и единицы простыми словами прямо в реплике ведущего. Добавляй глубину через контекст, сравнение и последствия уже подтверждённых фактов, а не через новые сведения.",
  "Сохраняй естественный ритм длинного видео: чередуй короткие ясные фразы с подробным разбором, задавай уместные вопросы зрителю и отвечай на них в следующих сценах. Не используй кликбейт, пафос и пустые приветствия.",
  "В каждой главе явно отделяй то, что известно из источника, от допущения или интерпретации. Если данных недостаточно, скажи это по-человечески и не закрывай пробел выдуманным объяснением.",
  "Финал свяжи с исходным вопросом: кратко собери проверенные выводы, напомни о главном риске и обозначь, что остаётся неизвестным. Не превращай вывод в прогноз или призыв к сделке.",
] as const;

function endsSentence(word: string): boolean {
  return /[.!?…]["'»”)\]}]*$/u.test(word);
}

export function splitFinanceLongAuthorScript(text: string, maximumScenes: number): string[] {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  if (!words.length) return [];

  const sceneCount = Math.max(1, Math.min(Math.floor(maximumScenes) || 1, words.length));
  const segments: string[] = [];
  let start = 0;

  for (let sceneIndex = 0; sceneIndex < sceneCount; sceneIndex += 1) {
    const remainingScenes = sceneCount - sceneIndex;
    if (remainingScenes === 1) {
      segments.push(words.slice(start).join(" "));
      break;
    }

    const idealEnd = Math.round((sceneIndex + 1) * words.length / sceneCount);
    const minimumEnd = start + 1;
    const maximumEnd = words.length - (remainingScenes - 1);
    const searchStart = Math.max(minimumEnd, idealEnd - 8);
    const searchEnd = Math.min(maximumEnd, idealEnd + 8);
    let end = Math.min(maximumEnd, Math.max(minimumEnd, idealEnd));
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let candidate = searchStart; candidate <= searchEnd; candidate += 1) {
      if (!endsSentence(words[candidate - 1] || "")) continue;
      const distance = Math.abs(candidate - idealEnd);
      if (distance < bestDistance) {
        end = candidate;
        bestDistance = distance;
      }
    }

    segments.push(words.slice(start, end).join(" "));
    start = end;
  }

  const normalizedOriginal = words.join(" ");
  const normalizedSegments = segments.join(" ").replace(/\s+/gu, " ").trim();
  if (normalizedSegments !== normalizedOriginal) {
    throw new Error("Не удалось сохранить исходный текст сценария при разбиении на сцены");
  }
  return segments;
}