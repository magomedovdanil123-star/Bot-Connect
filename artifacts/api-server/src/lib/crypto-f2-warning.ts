export type CryptoF2ProtectedWarning = {
  excerpt: string;
  label: string;
  startWord: number;
  endWord: number;
};

const PROTECTED_WARNING_PATTERNS = [
  /(?<![\p{L}\p{N}])не\s+(?:(?:является|может\s+быть)\s+)?гарантир\p{L}*(?:\s+(?:заработ\p{L}*|доход\p{L}*|прибыл\p{L}*|доходност\p{L}*|рост\p{L}*))?/iu,
  /(?<![\p{L}\p{N}])без\s+гаранти\p{L}*(?:\s+(?:заработ\p{L}*|доход\p{L}*|прибыл\p{L}*|доходност\p{L}*|рост\p{L}*))?/iu,
  /(?<![\p{L}\p{N}])(?:заработ\p{L}*|доход\p{L}*|прибыл\p{L}*|доходност\p{L}*|рост\p{L}*)\s+не\s+гарантир\p{L}*/iu,
  /(?<![\p{L}\p{N}])не\s+(?:гарантир|обеща)\p{L}*\s+(?:\p{L}+\s+){0,2}(?:заработ\p{L}*|доход\p{L}*|прибыл\p{L}*|доходност\p{L}*|рост\p{L}*)/iu,
];

function shortWarningLabel(value: string): string {
  const words = [...value.matchAll(/[\p{L}\p{N}]+/gu)];
  let end = value.length;
  while (end > 32 && words.length > 2) {
    words.pop();
    const lastWord = words.at(-1);
    end = lastWord ? (lastWord.index ?? 0) + lastWord[0].length : value.length;
  }
  return value.slice(0, end).trim();
}

export function findCryptoF2ProtectedWarnings(value: string): CryptoF2ProtectedWarning[] {
  if (!value.trim()) return [];

  const wordMatches = [...value.matchAll(/[\p{L}\p{N}]+/gu)];
  const found: CryptoF2ProtectedWarning[] = [];
  for (const pattern of PROTECTED_WARNING_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, "giu");
    for (const match of value.matchAll(globalPattern)) {
      const startChar = match.index ?? 0;
      const endChar = startChar + match[0].length;
      const startWord = wordMatches.filter((word) => (word.index ?? -1) < startChar).length;
      const endWord = wordMatches.filter((word) => (word.index ?? -1) < endChar).length;
      const excerpt = match[0].trim();
      if (endWord <= startWord || !excerpt) continue;
      found.push({
        excerpt,
        label: shortWarningLabel(excerpt),
        startWord,
        endWord,
      });
    }
  }

  const ordered = found.sort((left, right) =>
    left.startWord - right.startWord || right.endWord - left.endWord);
  const unique: CryptoF2ProtectedWarning[] = [];
  for (const warning of ordered) {
    const overlappingIndex = unique.findIndex((current) =>
      warning.startWord < current.endWord && current.startWord < warning.endWord);
    if (overlappingIndex < 0) {
      unique.push(warning);
      continue;
    }
    const current = unique[overlappingIndex]!;
    if (warning.endWord - warning.startWord > current.endWord - current.startWord) {
      unique[overlappingIndex] = warning;
    }
  }
  return unique.sort((left, right) => left.startWord - right.startWord);
}

export function cryptoF2WarningBoundaryIsSafe(
  warnings: readonly CryptoF2ProtectedWarning[],
  boundary: number,
): boolean {
  return warnings.every((warning) =>
    boundary <= warning.startWord || boundary >= warning.endWord);
}