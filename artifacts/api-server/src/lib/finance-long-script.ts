export const MAX_FINANCE_LONG_CUSTOM_SCRIPT_CHARACTERS = 30_000;

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