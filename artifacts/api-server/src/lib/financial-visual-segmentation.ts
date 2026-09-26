export const ESTIMATED_SPEECH_WORDS_PER_SECOND = 2.4;

const MAX_VISUAL_MOMENTS_PER_SCENE = 16;
const MIN_VISUAL_MOMENT_SECONDS = 1;
const MAX_VISUAL_MOMENT_SECONDS = 3;

export function wordsIn(value: string): string[] {
  return value.toLocaleLowerCase("ru-RU").match(/[\p{L}\p{N}]+/gu) ?? [];
}

export function wordExcerpt(value: string, startWord: number, endWord: number): string {
  const matches = [...value.matchAll(/[\p{L}\p{N}]+/gu)];
  const start = matches[startWord]?.index;
  const last = matches[endWord - 1];
  if (start === undefined || last?.index === undefined) return "";
  const end = endWord === matches.length
    ? value.length
    : last.index + last[0].length;
  return value.slice(start, end).trim();
}

export function semanticVoiceExcerpts(value: string): string[] {
  const source = value.trim();
  const segments = source
    .split(/(?<=[,;:—–])\s+|(?<=[.!?…])\s+|\r?\n+/u)
    .map((segment) => segment.trim())
    .filter((segment) => wordsIn(segment).length > 0);
  if (!segments.length) return [];

  const cappedSegments = segments.length <= MAX_VISUAL_MOMENTS_PER_SCENE
    ? segments
    : Array.from({ length: MAX_VISUAL_MOMENTS_PER_SCENE }, (_, index) => {
        const start = Math.floor(index * segments.length / MAX_VISUAL_MOMENTS_PER_SCENE);
        const end = Math.floor((index + 1) * segments.length / MAX_VISUAL_MOMENTS_PER_SCENE);
        return segments.slice(start, end).join(" ");
      });

  const totalWords = wordsIn(source).length;
  if (totalWords === 0) return [];

  const minWords = Math.ceil(MIN_VISUAL_MOMENT_SECONDS * ESTIMATED_SPEECH_WORDS_PER_SECOND);
  const maxWords = Math.floor(MAX_VISUAL_MOMENT_SECONDS * ESTIMATED_SPEECH_WORDS_PER_SECOND);
  const minimumMomentCount = Math.ceil(totalWords / maxWords);
  const maximumMomentCount = Math.min(
    MAX_VISUAL_MOMENTS_PER_SCENE,
    Math.max(1, Math.floor(totalWords / minWords)),
  );

  // Very long source scenes cannot fit the configured moment cap and duration bounds.
  // Leave those unchanged so the existing plan validator can report the overlong moment.
  if (minimumMomentCount > maximumMomentCount) return cappedSegments;

  const momentCount = Math.max(
    minimumMomentCount,
    Math.min(cappedSegments.length, maximumMomentCount),
  );
  const segmentWordCounts = cappedSegments.map((segment) => wordsIn(segment).length);
  if (
    cappedSegments.length === momentCount
    && segmentWordCounts.every((count) => count >= minWords && count <= maxWords)
  ) {
    return cappedSegments;
  }

  if (momentCount === 1) return [source];

  const preferredCuts: number[] = [];
  let cumulativeWords = 0;
  for (const segmentWordCount of segmentWordCounts) {
    cumulativeWords += segmentWordCount;
    preferredCuts.push(cumulativeWords);
  }

  const excerpts: string[] = [];
  let startWord = 0;
  for (let momentIndex = 0; momentIndex < momentCount - 1; momentIndex += 1) {
    const remainingMoments = momentCount - momentIndex - 1;
    const minimumEnd = Math.max(
      startWord + minWords,
      totalWords - remainingMoments * maxWords,
    );
    const maximumEnd = Math.min(
      startWord + maxWords,
      totalWords - remainingMoments * minWords,
    );
    const targetEnd = Math.round(((momentIndex + 1) * totalWords) / momentCount);
    const preferredEnd = preferredCuts
      .filter((cut) => cut >= minimumEnd && cut <= maximumEnd)
      .sort((left, right) =>
        Math.abs(left - targetEnd) - Math.abs(right - targetEnd))[0];
    const endWord = preferredEnd
      ?? Math.max(minimumEnd, Math.min(maximumEnd, targetEnd));
    excerpts.push(wordExcerpt(source, startWord, endWord));
    startWord = endWord;
  }
  excerpts.push(wordExcerpt(source, startWord, totalWords));
  return excerpts;
}

export function semanticVoiceExcerptRanges(
  value: string,
): Array<{ excerpt: string; start: number; end: number }> {
  let start = 0;
  return semanticVoiceExcerpts(value).map((excerpt) => {
    const end = start + wordsIn(excerpt).length;
    const range = { excerpt, start, end };
    start = end;
    return range;
  });
}