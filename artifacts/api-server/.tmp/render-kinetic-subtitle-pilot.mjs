// scripts/render-kinetic-subtitle-pilot.ts
import { execFile as execFile2 } from "node:child_process";
import { access as access2, mkdtemp as mkdtemp2, readFile as readFile2, rm as rm2, stat, writeFile as writeFile2 } from "node:fs/promises";
import { tmpdir as tmpdir2 } from "node:os";
import { join as join2, resolve as resolve2 } from "node:path";
import { promisify as promisify2 } from "node:util";

// src/lib/audio-generation/elevenlabs-client.ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
var ElevenLabsNotConfiguredError = class extends Error {
  constructor() {
    super("ElevenLabs API key is not configured");
    this.name = "ElevenLabsNotConfiguredError";
  }
};
function getClient() {
  const apiKey = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey) throw new ElevenLabsNotConfiguredError();
  return new ElevenLabsClient({ apiKey });
}
async function transcribeSpeechWithTimestamps(audio, filename = "voice.mp3") {
  const response = await getClient().speechToText.convert({
    file: { data: audio, filename, contentType: "audio/mpeg" },
    modelId: "scribe_v2",
    timestampsGranularity: "word"
  });
  const result = response;
  const words = (result.words || []).filter(
    (word) => word.type === "word" && typeof word.start === "number" && typeof word.end === "number"
  );
  if (!result.text || !words.length) {
    throw new Error("ElevenLabs Scribe did not return a transcript with word timestamps");
  }
  return { text: result.text, words };
}

// src/lib/video-pipeline/longform-kinetic-subtitles.ts
var MIN_MATCH_COVERAGE = 0.88;
var MAX_WORDS_PER_PHRASE = 3;
var MAX_PHRASE_DURATION_MS = 1450;
function normalizedWord(value) {
  return value.toLocaleLowerCase("ru-RU").replaceAll("\u0451", "\u0435").replace(/[^\p{L}\p{N}]/gu, "");
}
function wordsFromText(value) {
  return value.trim().split(/\s+/u).map((word) => word.trim()).filter((word) => normalizedWord(word).length > 0 && !/^[—–-]+$/u.test(word));
}
function mergeHyphenatedTranscriptWords(observed, expectedCompounds) {
  if (!expectedCompounds.size) return observed;
  const merged = [];
  for (let index = 0; index < observed.length; index += 1) {
    const first = observed[index];
    let combined = first.normalized;
    let matchedThrough = -1;
    for (let nextIndex = index + 1; nextIndex < observed.length && nextIndex <= index + 2; nextIndex += 1) {
      const next = observed[nextIndex];
      if (next.startMs - observed[nextIndex - 1].endMs > 450) break;
      combined += next.normalized;
      if (expectedCompounds.has(combined)) {
        matchedThrough = nextIndex;
        merged.push({
          text: observed.slice(index, nextIndex + 1).map((word) => word.text).join(" "),
          normalized: combined,
          startMs: first.startMs,
          endMs: next.endMs
        });
        break;
      }
    }
    if (matchedThrough >= 0) index = matchedThrough;
    else merged.push(first);
  }
  return merged;
}
function alignKineticSubtitleWords(input) {
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) {
    throw new Error("Kinetic subtitle alignment requires a positive duration");
  }
  const durationMs = Math.round(input.durationMs);
  const voices = input.voices.filter(
    (voice) => !voice.isFullVoice && voice.text.trim() && Number.isFinite(voice.startTime) && Number.isFinite(voice.endTime) && voice.endTime > voice.startTime
  ).sort((left, right) => left.startTime - right.startTime);
  const expected = voices.flatMap((voice) => {
    const voiceStartMs = Math.max(0, Math.round(voice.startTime));
    const originalVoiceEndMs = Math.round(voice.endTime);
    const voiceEndMs = Math.min(durationMs, originalVoiceEndMs);
    const tokens = wordsFromText(voice.text);
    const weights = tokens.map((text) => Math.max(1, normalizedWord(text).length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let accumulatedWeight = 0;
    const visible = [];
    tokens.forEach((text, index) => {
      const estimatedStartMs = voiceStartMs + Math.max(0, originalVoiceEndMs - voiceStartMs) * accumulatedWeight / Math.max(1, totalWeight);
      accumulatedWeight += weights[index];
      if (estimatedStartMs >= durationMs) return;
      visible.push({
        text,
        normalized: normalizedWord(text),
        startMs: 0,
        endMs: 0,
        voiceStartMs,
        voiceEndMs
      });
    });
    return visible;
  });
  const observed = input.transcriptWords.filter(
    (word) => word.type === void 0 || word.type === "word"
  ).filter(
    (word) => typeof word.text === "string" && Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start
  ).map((word) => ({
    text: word.text,
    normalized: normalizedWord(word.text),
    startMs: Math.max(0, Math.round(word.start * 1e3)),
    endMs: Math.min(durationMs, Math.round(word.end * 1e3))
  })).filter((word) => word.normalized && word.endMs > word.startMs).sort((left, right) => left.startMs - right.startMs);
  if (!expected.length) throw new Error("Kinetic subtitle alignment found no approved narration words");
  if (!observed.length) throw new Error("Kinetic subtitle alignment found no timestamped speech words");
  const expectedCompounds = new Set(
    expected.filter((word) => /[\u002d\u2010-\u2015]/u.test(word.text)).map((word) => word.normalized)
  );
  const alignedObserved = mergeHyphenatedTranscriptWords(observed, expectedCompounds);
  const table = Array.from(
    { length: expected.length + 1 },
    () => new Uint16Array(alignedObserved.length + 1)
  );
  for (let expectedIndex2 = expected.length - 1; expectedIndex2 >= 0; expectedIndex2 -= 1) {
    for (let observedIndex2 = alignedObserved.length - 1; observedIndex2 >= 0; observedIndex2 -= 1) {
      table[expectedIndex2][observedIndex2] = expected[expectedIndex2].normalized === alignedObserved[observedIndex2].normalized ? table[expectedIndex2 + 1][observedIndex2 + 1] + 1 : Math.max(
        table[expectedIndex2 + 1][observedIndex2],
        table[expectedIndex2][observedIndex2 + 1]
      );
    }
  }
  const matchedObservedByExpected = /* @__PURE__ */ new Map();
  let expectedIndex = 0;
  let observedIndex = 0;
  while (expectedIndex < expected.length && observedIndex < alignedObserved.length) {
    if (expected[expectedIndex].normalized === alignedObserved[observedIndex].normalized) {
      matchedObservedByExpected.set(expectedIndex, observedIndex);
      expectedIndex += 1;
      observedIndex += 1;
    } else if (table[expectedIndex + 1][observedIndex] >= table[expectedIndex][observedIndex + 1]) {
      expectedIndex += 1;
    } else {
      observedIndex += 1;
    }
  }
  const matchedWordCount = matchedObservedByExpected.size;
  const matchCoverage = matchedWordCount / expected.length;
  const minimumMatchCoverage = input.minimumMatchCoverage ?? MIN_MATCH_COVERAGE;
  if (matchCoverage < minimumMatchCoverage) {
    throw new Error(
      `Kinetic subtitle transcript matched only ${(matchCoverage * 100).toFixed(1)}% of approved narration; minimum is ${(minimumMatchCoverage * 100).toFixed(1)}%`
    );
  }
  const aligned = /* @__PURE__ */ new Map();
  for (const [approvedIndex, transcriptIndex] of matchedObservedByExpected) {
    const transcriptWord = alignedObserved[transcriptIndex];
    aligned.set(approvedIndex, {
      text: expected[approvedIndex].text,
      startMs: transcriptWord.startMs,
      endMs: transcriptWord.endMs
    });
  }
  let interpolatedWordCount = 0;
  expectedIndex = 0;
  while (expectedIndex < expected.length) {
    if (aligned.has(expectedIndex)) {
      expectedIndex += 1;
      continue;
    }
    const runStart = expectedIndex;
    while (expectedIndex < expected.length && !aligned.has(expectedIndex)) expectedIndex += 1;
    const runEnd = expectedIndex - 1;
    const leftExpectedIndex = runStart - 1;
    const rightExpectedIndex = expectedIndex;
    const leftObservedIndex = matchedObservedByExpected.get(leftExpectedIndex);
    const rightObservedIndex = matchedObservedByExpected.get(rightExpectedIndex);
    const leftWord = leftExpectedIndex >= 0 ? aligned.get(leftExpectedIndex) : void 0;
    const rightWord = rightExpectedIndex < expected.length ? aligned.get(rightExpectedIndex) : void 0;
    const unmatchedTranscript = alignedObserved.slice(
      leftObservedIndex === void 0 ? 0 : leftObservedIndex + 1,
      rightObservedIndex === void 0 ? observed.length : rightObservedIndex
    );
    const transcriptStart = unmatchedTranscript[0]?.startMs;
    const transcriptEnd = unmatchedTranscript.at(-1)?.endMs;
    const voiceStart = expected[runStart].voiceStartMs;
    const voiceEnd = expected[runEnd].voiceEndMs;
    const startMs = transcriptStart ?? leftWord?.endMs ?? voiceStart;
    const endMs = transcriptEnd ?? rightWord?.startMs ?? voiceEnd;
    const missingCount = runEnd - runStart + 1;
    const spanMs = endMs - startMs;
    if (spanMs < missingCount * 35) {
      throw new Error(
        `Kinetic subtitle alignment cannot place ${missingCount} unmatched approved word(s) in a ${Math.max(0, spanMs)} ms speech interval`
      );
    }
    const weights = expected.slice(runStart, runEnd + 1).map((word) => Math.max(1, normalizedWord(word.text).length));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let elapsedWeight = 0;
    for (let index = runStart; index <= runEnd; index += 1) {
      const wordWeight = weights[index - runStart];
      const wordStartMs = Math.round(startMs + spanMs * elapsedWeight / totalWeight);
      elapsedWeight += wordWeight;
      const wordEndMs = Math.round(startMs + spanMs * elapsedWeight / totalWeight);
      aligned.set(index, {
        text: expected[index].text,
        startMs: wordStartMs,
        endMs: wordEndMs
      });
      interpolatedWordCount += 1;
    }
  }
  const words = expected.map((word, index) => {
    const timing = aligned.get(index);
    const startMs = Math.max(0, Math.min(durationMs - 1, timing.startMs));
    const endMs = Math.max(startMs + 1, Math.min(durationMs, timing.endMs));
    if (endMs <= startMs) {
      throw new Error(`Kinetic subtitle word has invalid timing: ${word.text}`);
    }
    return { text: word.text, startMs, endMs };
  });
  return {
    words,
    expectedWordCount: expected.length,
    matchedWordCount,
    interpolatedWordCount,
    matchCoverage
  };
}
var RUSSIAN_NUMBERS = /* @__PURE__ */ new Set([
  "\u043D\u043E\u043B\u044C",
  "\u043E\u0434\u0438\u043D",
  "\u043E\u0434\u043D\u0430",
  "\u043E\u0434\u043D\u043E",
  "\u043E\u0434\u043D\u0438",
  "\u0434\u0432\u0435",
  "\u0434\u0432\u0430",
  "\u0442\u0440\u0438",
  "\u0447\u0435\u0442\u044B\u0440\u0435",
  "\u043F\u044F\u0442\u044C",
  "\u0448\u0435\u0441\u0442\u044C",
  "\u0441\u0435\u043C\u044C",
  "\u0432\u043E\u0441\u0435\u043C\u044C",
  "\u0434\u0435\u0432\u044F\u0442\u044C",
  "\u0434\u0435\u0441\u044F\u0442\u044C",
  "\u043E\u0434\u0438\u043D\u043D\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0434\u0432\u0435\u043D\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0442\u0440\u0438\u043D\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0447\u0435\u0442\u044B\u0440\u043D\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u043F\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0448\u0435\u0441\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0432\u043E\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0434\u0435\u0432\u044F\u0442\u043D\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0442\u0440\u0438\u0434\u0446\u0430\u0442\u044C",
  "\u0441\u043E\u0440\u043E\u043A",
  "\u043F\u044F\u0442\u044C\u0434\u0435\u0441\u044F\u0442",
  "\u0448\u0435\u0441\u0442\u044C\u0434\u0435\u0441\u044F\u0442",
  "\u0441\u0435\u043C\u044C\u0434\u0435\u0441\u044F\u0442",
  "\u0432\u043E\u0441\u0435\u043C\u044C\u0434\u0435\u0441\u044F\u0442",
  "\u0434\u0435\u0432\u044F\u043D\u043E\u0441\u0442\u043E",
  "\u0441\u0442\u043E",
  "\u0442\u044B\u0441\u044F\u0447\u0430",
  "\u0442\u044B\u0441\u044F\u0447\u0438",
  "\u0442\u044B\u0441\u044F\u0447",
  "\u043C\u0438\u043B\u043B\u0438\u043E\u043D",
  "\u043C\u0438\u043B\u043B\u0438\u043E\u043D\u0430",
  "\u043C\u0438\u043B\u043B\u0438\u043E\u043D\u043E\u0432",
  "\u043C\u0438\u043B\u043B\u0438\u0430\u0440\u0434",
  "\u043C\u0438\u043B\u043B\u0438\u0430\u0440\u0434\u0430",
  "\u043C\u0438\u043B\u043B\u0438\u0430\u0440\u0434\u043E\u0432"
]);
var POSITIVE_STEMS = [
  "\u0432\u044B\u0440\u043E\u0441",
  "\u0440\u043E\u0441\u0442",
  "\u043F\u0440\u0438\u0431\u0430\u0432",
  "\u043F\u043E\u0432\u044B\u0441",
  "\u043F\u043E\u0434\u0434\u0435\u0440\u0436",
  "\u0441\u0438\u043B\u044C\u043D",
  "\u0443\u0432\u0435\u043B\u0438\u0447",
  "\u0434\u043E\u0445\u043E\u0434",
  "\u043F\u0440\u0438\u0431\u044B\u043B",
  "\u0443\u043A\u0440\u0435\u043F",
  "\u0432\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432",
  "\u043F\u043E\u043B\u043E\u0436\u0438\u0442\u0435\u043B\u044C\u043D"
];
var NEGATIVE_STEMS = [
  "\u043F\u0430\u0434",
  "\u0441\u043D\u0438\u0436\u0435\u043D",
  "\u0441\u043D\u0438\u0437",
  "\u0441\u043E\u043A\u0440\u0430\u0442",
  "\u043F\u0440\u043E\u0441\u0430\u0434",
  "\u0443\u0431\u044B\u0442",
  "\u0440\u0438\u0441\u043A",
  "\u0441\u043B\u0430\u0431",
  "\u043F\u043E\u0442\u0435\u0440",
  "\u043D\u0435\u0433\u0430\u0442\u0438\u0432",
  "\u0432\u043E\u043B\u0430\u0442\u0438\u043B",
  "\u0434\u0435\u0444\u0438\u0446\u0438\u0442",
  "\u0443\u0433\u0440\u043E\u0437",
  "\u0443\u0445\u0443\u0434\u0448",
  "\u043A\u043E\u0440\u0440\u0435\u043A\u0446"
];
var DOMAIN_STEMS = [
  "hype",
  "hyperliquid",
  "\u043C\u043E\u043D\u0435\u0442",
  "\u0442\u043E\u043A\u0435\u043D",
  "\u043B\u0438\u043A\u0432\u0438\u0434",
  "\u0431\u0438\u0440\u0436",
  "\u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B",
  "\u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D",
  "\u0434\u0435\u0440\u0438\u0432\u0430\u0442\u0438\u0432",
  "\u043F\u0435\u0440\u043F\u0435\u0442\u0443",
  "\u0444\u044C\u044E\u0447\u0435\u0440\u0441",
  "\u0434\u0435\u0446\u0435\u043D\u0442\u0440\u0430\u043B\u0438\u0437",
  "\u043E\u043D\u0447\u0435\u0438\u043D",
  "\u043E\u043D\u0447\u0435\u0439\u043D",
  "\u043A\u0440\u0438\u043F\u0442\u043E\u0432\u0430\u043B\u044E\u0442",
  "\u043A\u0430\u043F\u0438\u0442\u0430\u043B\u0438\u0437\u0430\u0446"
];
var STOP_WORDS = /* @__PURE__ */ new Set([
  "\u0430",
  "\u0431\u0435\u0437",
  "\u0431\u044B",
  "\u0432",
  "\u0432\u043E",
  "\u0434\u043B\u044F",
  "\u0434\u043E",
  "\u0435\u0451",
  "\u0435\u0435",
  "\u0435\u0441\u043B\u0438",
  "\u0436\u0435",
  "\u0437\u0430",
  "\u0438",
  "\u0438\u0437",
  "\u0438\u043B\u0438",
  "\u043A",
  "\u043A\u0430\u043A",
  "\u043A\u043E",
  "\u043B\u0438",
  "\u043D\u0430",
  "\u043D\u0430\u0434",
  "\u043D\u0435",
  "\u043D\u043E",
  "\u043E",
  "\u043E\u0431",
  "\u043E\u0442",
  "\u043F\u043E",
  "\u043F\u043E\u0434",
  "\u043F\u0440\u0438",
  "\u0441",
  "\u0441\u043E",
  "\u0443",
  "\u0447\u0442\u043E",
  "\u044D\u0442\u043E"
]);
function startsWithStem(value, stems) {
  return stems.some((stem) => value.startsWith(stem));
}
function classifyKineticSubtitleTone(value) {
  const normalized = normalizedWord(value);
  if (/\d/u.test(value) || /[%‰]/u.test(value) || RUSSIAN_NUMBERS.has(normalized) || normalized.startsWith("\u043F\u0440\u043E\u0446\u0435\u043D\u0442")) {
    return "gold";
  }
  if (startsWithStem(normalized, NEGATIVE_STEMS)) return "red";
  if (startsWithStem(normalized, POSITIVE_STEMS)) return "green";
  if (startsWithStem(normalized, DOMAIN_STEMS)) return "accent";
  return "white";
}
function isImpactWord(value) {
  const tone = classifyKineticSubtitleTone(value);
  return tone === "gold" || tone === "red" || tone === "green";
}
function splitIntoPhrases(words) {
  const sorted = [...words].sort((left, right) => left.startMs - right.startMs);
  const phrases = [];
  let current = [];
  const flush = () => {
    if (current.length) phrases.push(current);
    current = [];
  };
  for (const word of sorted) {
    const previous = current.at(-1);
    if (previous && (word.startMs - previous.endMs > 260 || word.startMs - current[0].startMs > MAX_PHRASE_DURATION_MS || current.length >= MAX_WORDS_PER_PHRASE || /[.!?…]$/u.test(previous.text) || isImpactWord(word.text) && current.length >= 2)) {
      flush();
    }
    current.push(word);
    if (isImpactWord(word.text) || /[.!?…]$/u.test(word.text) && current.length >= 2) {
      flush();
    }
  }
  flush();
  return phrases;
}
function assTime(milliseconds) {
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const seconds = Math.floor(centiseconds / 100);
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}
function assText(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", " ");
}
function assColor(hex) {
  const rgb = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/iu.test(rgb)) throw new Error(`Invalid kinetic subtitle color: ${hex}`);
  return `&H00${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}&`;
}
var TONE_COLORS = {
  white: "#F5F7FA",
  green: "#55FF74",
  gold: "#FFD166",
  red: "#FF5964",
  accent: "#59CEFF"
};
var LAYOUTS = [
  { kind: "center", y: 0.75 },
  { kind: "left", y: 0.67 },
  { kind: "right", y: 0.81 },
  { kind: "center", y: 0.86 }
];
function focusWordIndex(phrase) {
  const domainIndex = phrase.findIndex((word) => classifyKineticSubtitleTone(word.text) === "accent");
  if (domainIndex >= 0) return domainIndex;
  return phrase.reduce((bestIndex, word, index) => {
    const normalized = normalizedWord(word.text);
    const best = bestIndex >= 0 ? normalizedWord(phrase[bestIndex].text) : "";
    if (STOP_WORDS.has(normalized) || classifyKineticSubtitleTone(word.text) !== "white") return bestIndex;
    if (normalized.length < 4) return bestIndex;
    return normalized.length > best.length ? index : bestIndex;
  }, -1);
}
function animationOverride(preset, x, y, durationMs) {
  const animationEnd = Math.max(75, Math.min(180, durationMs));
  let entrance;
  switch (preset % 5) {
    case 1:
      entrance = `\\move(${x},${y + 24},${x},${y},0,${animationEnd})`;
      break;
    case 2:
      entrance = `\\move(${x - 30},${y + 4},${x},${y},0,${animationEnd})`;
      break;
    case 3:
      entrance = `\\move(${x + 28},${y - 5},${x},${y},0,${animationEnd})`;
      break;
    case 4:
      entrance = `\\move(${x},${y - 17},${x},${y},0,${animationEnd})`;
      break;
    default:
      entrance = `\\pos(${x},${y})`;
  }
  return `${entrance}\\fscx42\\fscy42\\alpha&HFF&\\blur4\\t(0,${animationEnd},\\fscx108\\fscy108\\alpha&H00&\\blur0.35)\\t(${animationEnd},${animationEnd + 65},\\fscx100\\fscy100)`;
}
function buildLongformKineticSubtitleAss(input) {
  if (!input.words.length) throw new Error("Kinetic subtitle render requires timestamped words");
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0 || !Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width <= 0 || input.height <= 0) {
    throw new Error("Kinetic subtitle render requires valid video dimensions and duration");
  }
  const words = input.words.filter((word) => word.text.trim() && word.endMs > word.startMs).map((word) => ({
    text: word.text,
    startMs: Math.max(0, Math.min(input.durationMs, word.startMs)),
    endMs: Math.max(0, Math.min(input.durationMs, word.endMs))
  })).filter((word) => word.endMs > word.startMs);
  if (!words.length) throw new Error("Kinetic subtitle render has no valid visible words");
  const phrases = splitIntoPhrases(words);
  const dialogues = [];
  phrases.forEach((phrase, phraseIndex) => {
    const layout = LAYOUTS[phraseIndex % LAYOUTS.length];
    const focusIndex = focusWordIndex(phrase);
    const units = phrase.reduce(
      (sum, word, index) => sum + Math.max(1, word.text.toLocaleUpperCase("ru-RU").length) * 0.7 + (index ? 0.8 : 0),
      0
    );
    const safeWidth = input.width * 0.84;
    const fontSize = Math.max(70, Math.min(132, Math.floor(safeWidth / Math.max(1, units))));
    const totalWidth = units * fontSize;
    const left = layout.kind === "left" ? input.width * 0.11 : layout.kind === "right" ? input.width * 0.89 - totalWidth : (input.width - totalWidth) / 2;
    const y = Math.round(input.height * layout.y);
    let cursorX = left;
    const phraseEndMs = phrase.at(-1).endMs;
    phrase.forEach((word, wordIndex) => {
      const upperWord = word.text.toLocaleUpperCase("ru-RU");
      const wordWidth = Math.max(1, upperWord.length) * fontSize * 0.7;
      const x = Math.round(cursorX + wordWidth / 2);
      const tone = classifyKineticSubtitleTone(word.text);
      const chosenTone = tone !== "white" ? tone : wordIndex === focusIndex ? "accent" : "white";
      const color = assColor(TONE_COLORS[chosenTone]);
      const animation = animationOverride(phraseIndex, x, y, word.endMs - word.startMs);
      const overrides = `{\\an5\\fs${fontSize}\\b1\\1c${color}\\3c&H00101822&\\bord5\\shad2\\blur4${animation}\\fad(0,75)}`;
      const visibleEndMs = Math.max(word.startMs + 1, phraseEndMs);
      dialogues.push(
        `Dialogue: 1,${assTime(word.startMs)},${assTime(visibleEndMs)},Kinetic,,0,0,0,,${overrides}${assText(upperWord)}`
      );
      cursorX += wordWidth + fontSize * 0.8;
    });
  });
  return {
    ass: [
      "[Script Info]",
      "ScriptType: v4.00+",
      `PlayResX: ${input.width}`,
      `PlayResY: ${input.height}`,
      "WrapStyle: 2",
      "ScaledBorderAndShadow: yes",
      "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      "Style: Kinetic,DejaVu Sans,96,&H00F5F7FA,&H00F5F7FA,&H00101822,&H00000000,-1,0,1,5,2,5,96,96,0,1",
      "",
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      ...dialogues,
      ""
    ].join("\n"),
    phraseCount: phrases.length,
    wordCount: words.length,
    maxWordsPerPhrase: Math.max(...phrases.map((phrase) => phrase.length))
  };
}

// src/lib/video-pipeline/coin-overview-long-edit.ts
var MOTIFS = [
  "asset",
  "market",
  "record",
  "network",
  "timeline",
  "access",
  "risk"
];
function normalizeDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error("Coin overview render duration must be a positive number");
  }
  return Math.max(1, Math.round(durationMs));
}
function classifyMotif(text, index) {
  const normalized = text.toLocaleLowerCase("ru-RU");
  if (/риск|угроз|уязв|ограничен|проблем|конкурен|неопредел|осторож|безопасн/.test(normalized)) return "risk";
  if (/истори|основан|создан|запуск|появил|начал|этап|год|раньше|сначала/.test(normalized)) return "timeline";
  if (/сеть|блокчейн|транзакц|валидат|протокол|инфраструктур|узл/.test(normalized)) return "network";
  if (/цен|курс|рынок|динамик|капитализац|объём|ликвид|волатил|торг|спрос|предложен/.test(normalized)) return "market";
  if (/смарт.?контракт|экосистем|приложен|разработ|кошел|токен|актив|монет/.test(normalized)) return "asset";
  if (/запис|реестр|данн|учёт|подпис|перевод/.test(normalized)) return "record";
  if (/ключ|доступ|хранен|владен|адрес/.test(normalized)) return "access";
  return MOTIFS[index % MOTIFS.length];
}
function wordTimings(voice, durationMs) {
  const words = voice.text.trim().split(/\s+/).filter(Boolean);
  const startMs = Math.max(0, Math.round(voice.startTime ?? 0));
  const endMs = Math.min(durationMs, Math.round(voice.endTime ?? durationMs));
  const availableMs = Math.max(0, endMs - startMs);
  if (!words.length || availableMs <= 0) return [];
  const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let previousWeight = 0;
  return words.map((text, index) => {
    const nextWeight = previousWeight + weights[index];
    const timing = {
      text,
      startMs: Math.round(startMs + availableMs * previousWeight / totalWeight),
      endMs: Math.round(startMs + availableMs * nextWeight / totalWeight)
    };
    previousWeight = nextWeight;
    return timing;
  });
}
function splitVoiceIntoPhrases(words) {
  const phrases = [];
  let current = [];
  const flush = () => {
    if (current.length) phrases.push(current);
    current = [];
  };
  for (const word of words) {
    if (current.length && (word.endMs - current[0].startMs > 4400 || `${current.map((item) => item.text).join(" ")} ${word.text}`.length > 56)) {
      flush();
    }
    current.push(word);
    if (/[.!?…;:]$/u.test(word.text) || /[,…]$/u.test(word.text) && current.length >= 2) {
      flush();
    }
  }
  flush();
  return phrases;
}
function appendIdleBeats(beats, startMs, endMs, motif, sceneId) {
  let cursor = startMs;
  let offset = 0;
  while (cursor < endMs) {
    const next = Math.min(endMs, cursor + 4e3);
    const motifIndex = MOTIFS.indexOf(motif);
    beats.push({
      sceneId,
      beatIndex: beats.length,
      startMs: cursor,
      endMs: next,
      text: "",
      motif: MOTIFS[(motifIndex + offset) % MOTIFS.length]
    });
    cursor = next;
    offset += 1;
  }
}
function buildCoinOverviewLongPhraseBeats(input) {
  const durationMs = normalizeDuration(input.durationMs);
  const rawBeats = [];
  const voices = input.voices.filter((voice) => !voice.isFullVoice && voice.text.trim()).sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0));
  for (const voice of voices) {
    const words = wordTimings(voice, durationMs);
    for (const phrase of splitVoiceIntoPhrases(words)) {
      const startMs = phrase[0].startMs;
      const endMs = phrase.at(-1).endMs;
      if (endMs <= startMs) continue;
      const text = phrase.map((word) => word.text).join(" ");
      rawBeats.push({
        sceneId: voice.sceneId,
        beatIndex: rawBeats.length,
        startMs,
        endMs,
        text,
        motif: classifyMotif(text, rawBeats.length)
      });
    }
  }
  rawBeats.sort((a, b) => a.startMs - b.startMs || a.sceneId - b.sceneId);
  const groupedRawBeats = [];
  for (const beat of rawBeats) {
    const previous = groupedRawBeats.at(-1);
    const mergedEnd = previous ? Math.max(previous.endMs, beat.endMs) : beat.endMs;
    if (previous && previous.sceneId === beat.sceneId && beat.startMs <= previous.endMs + 180 && previous.endMs - previous.startMs < 2800 && mergedEnd - previous.startMs <= 5200) {
      previous.endMs = mergedEnd;
      previous.text = [previous.text, beat.text].filter(Boolean).join(" ");
      previous.motif = classifyMotif(previous.text, previous.beatIndex);
    } else {
      groupedRawBeats.push({
        ...beat,
        beatIndex: groupedRawBeats.length
      });
    }
  }
  const beats = [];
  let cursor = 0;
  let lastMotif = groupedRawBeats[0]?.motif ?? "asset";
  const fallbackSceneId = voices[0]?.sceneId ?? 0;
  for (const beat of groupedRawBeats) {
    if (beat.startMs > cursor + 180) {
      appendIdleBeats(beats, cursor, beat.startMs, lastMotif, beat.sceneId);
    }
    const startMs = Math.max(cursor, beat.startMs);
    const endMs = Math.min(durationMs, beat.endMs);
    if (endMs <= startMs) continue;
    beats.push({
      ...beat,
      beatIndex: beats.length,
      startMs,
      endMs
    });
    cursor = endMs;
    lastMotif = beat.motif;
  }
  if (cursor < durationMs) {
    appendIdleBeats(beats, cursor, durationMs, lastMotif, fallbackSceneId);
  }
  return beats;
}
var MOTION_PALETTES = [
  { background: "0x111820", primary: "0x8db7a4", secondary: "0xc7a775", contrast: "0xe6e0d6", title: "0xf2eee5", darkBackground: true },
  { background: "0x121920", primary: "0xc7a775", secondary: "0x8db7a4", contrast: "0xe6e0d6", title: "0xf2eee5", darkBackground: true },
  { background: "0x141b22", primary: "0x91b9a7", secondary: "0xaaa99c", contrast: "0xe4ded2", title: "0xf2eee5", darkBackground: true },
  { background: "0x111920", primary: "0xbca574", secondary: "0x85aa98", contrast: "0xe3ddd2", title: "0xf2eee5", darkBackground: true },
  { background: "0x151c23", primary: "0x8caf9f", secondary: "0xb69c72", contrast: "0xe8e2d8", title: "0xf2eee5", darkBackground: true },
  { background: "0x121a21", primary: "0xc2a879", secondary: "0x8aaf9d", contrast: "0xe8e2d8", title: "0xf2eee5", darkBackground: true },
  { background: "0x141b22", primary: "0x8db7a4", secondary: "0xb9a276", contrast: "0xe6e0d6", title: "0xf2eee5", darkBackground: true },
  { background: "0x111820", primary: "0xbca574", secondary: "0x91b9a7", contrast: "0xe6e0d6", title: "0xf2eee5", darkBackground: true },
  { background: "0x131a22", primary: "0x8caf9f", secondary: "0xc2a879", contrast: "0xe3ddd2", title: "0xf2eee5", darkBackground: true }
];
var PUMP_DYNAMIC_PALETTES = [
  { background: "0x10131b", primary: "0xeaff00", secondary: "0x14d8f0", contrast: "0xff526f", title: "0xf7f7f2", darkBackground: true },
  { background: "0xeaff00", primary: "0x11131a", secondary: "0xff526f", contrast: "0x11131a", title: "0x11131a", darkBackground: false },
  { background: "0x14d8f0", primary: "0x11131a", secondary: "0xff526f", contrast: "0xeaff00", title: "0x11131a", darkBackground: false },
  { background: "0xff526f", primary: "0x11131a", secondary: "0x14d8f0", contrast: "0xeaff00", title: "0x11131a", darkBackground: false },
  { background: "0xf4f2e8", primary: "0x11131a", secondary: "0xff526f", contrast: "0xeaff00", title: "0x11131a", darkBackground: false },
  { background: "0x101827", primary: "0xeaff00", secondary: "0xff526f", contrast: "0x14d8f0", title: "0xf7f7f2", darkBackground: true }
];
function getCoinOverviewLongMotionPalette(beat, _layout, paletteMode = "default") {
  const palettes = paletteMode === "pump-dynamic" ? PUMP_DYNAMIC_PALETTES : MOTION_PALETTES;
  return palettes[beat.beatIndex % palettes.length];
}

// src/lib/video-pipeline/coin-overview-long-captions.ts
var ACCENTS = [
  { style: "KineticYellow", color: "&H0000FFE8" },
  { style: "KineticCyan", color: "&H00F7D810" },
  { style: "KineticPink", color: "&H007655FF" }
];
function assTime2(milliseconds) {
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const seconds = Math.floor(centiseconds / 100);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}
function assText2(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", " ");
}
var CAPTION_STOP_WORDS = /* @__PURE__ */ new Set([
  "\u0430",
  "\u0431\u0435\u0437",
  "\u0431\u044B",
  "\u0432",
  "\u0432\u043E",
  "\u0434\u043B\u044F",
  "\u0434\u043E",
  "\u0435\u0441\u043B\u0438",
  "\u0436\u0435",
  "\u0437\u0430",
  "\u0438",
  "\u0438\u0437",
  "\u0438\u043B\u0438",
  "\u043A",
  "\u043A\u043E",
  "\u043B\u0438",
  "\u043D\u0430",
  "\u043D\u0430\u0434",
  "\u043D\u0435",
  "\u043D\u043E",
  "\u043E",
  "\u043E\u0431",
  "\u043E\u0442",
  "\u043F\u043E",
  "\u043F\u043E\u0434",
  "\u043F\u0440\u0438",
  "\u0441",
  "\u0441\u043E",
  "\u0443",
  "\u0447\u0442\u043E",
  "\u044D\u0442\u043E"
]);
function assColor2(color) {
  const rgb = color.match(/^0x([0-9a-f]{6})$/iu)?.[1];
  if (!rgb) throw new Error(`Invalid infographic caption color: ${color}`);
  return `&H00${rgb.slice(4, 6)}${rgb.slice(2, 4)}${rgb.slice(0, 2)}&`;
}
function headlineWordIndex(phrase) {
  const contentWord = phrase.findIndex((word) => {
    const normalized = word.text.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
    return normalized.length > 2 && !CAPTION_STOP_WORDS.has(normalized);
  });
  return contentWord >= 0 ? contentWord : 0;
}
function fontSizeForWord(word, width, height, heightRatio, widthRatio = 0.76, glyphWidthRatio = 0.67) {
  const letters = Math.max(1, word.text.replace(/[^\p{L}\p{N}]/gu, "").length);
  return Math.max(
    26,
    Math.min(
      Math.round(height * heightRatio),
      Math.floor(width * widthRatio / (letters * glyphWidthRatio))
    )
  );
}
function karaokeText(phrase, input) {
  const wordDurations = phrase.map((word, index) => {
    const nextWord = phrase[index + 1];
    return Math.max(1, nextWord ? nextWord.startMs - word.startMs : word.endMs - word.startMs);
  });
  const totalWeight = wordDurations.reduce((sum, duration) => sum + duration, 0);
  const totalCentiseconds = Math.max(
    phrase.length,
    Math.round((phrase.at(-1).endMs - phrase[0].startMs) / 10)
  );
  let cumulativeWeight = 0;
  let previousCentiseconds = 0;
  return phrase.map((word, index) => {
    cumulativeWeight += wordDurations[index];
    const cumulativeCentiseconds = index === phrase.length - 1 ? totalCentiseconds : Math.round(totalCentiseconds * cumulativeWeight / totalWeight);
    const wordCentiseconds = Math.max(1, cumulativeCentiseconds - previousCentiseconds);
    previousCentiseconds = cumulativeCentiseconds;
    const upperWord = word.text.toLocaleUpperCase("ru-RU");
    const fontSize = index === input.headlineIndex ? input.headlineSize : phrase.length === 1 ? input.headlineSize : Math.min(
      input.supportSize,
      fontSizeForWord(word, input.width, input.height, 0.09)
    );
    return `${index > 0 ? "\\N" : ""}{\\kf${wordCentiseconds}\\fs${fontSize}}${assText2(upperWord)}`;
  }).join("");
}
function splitScribePhrases(words) {
  const phrases = [];
  let current = [];
  const flush = () => {
    if (current.length) phrases.push(current);
    current = [];
  };
  for (const word of words) {
    const previous = current.at(-1);
    if (previous && (current.length >= 2 || word.startMs - previous.endMs > 220 || /[,;:.!?…]$/u.test(previous.text))) {
      flush();
    }
    current.push(word);
    if (current.length >= 2 || /[.!?…]$/u.test(word.text)) flush();
  }
  flush();
  return phrases;
}
function buildCoinOverviewLongScribeCaptions(input) {
  const chunkStartMs = Math.max(0, input.chunkStartMs ?? 0);
  const chunkEndMs = Math.min(input.durationMs, input.chunkEndMs ?? input.durationMs);
  const words = input.words.filter(
    (word) => word.text.trim() && Number.isFinite(word.startMs) && Number.isFinite(word.endMs) && word.endMs > word.startMs && word.startMs < chunkEndMs && word.endMs > chunkStartMs
  ).map((word) => ({
    text: word.text,
    startMs: Math.max(0, Math.round(word.startMs)),
    endMs: Math.min(input.durationMs, Math.round(word.endMs))
  })).sort((left, right) => left.startMs - right.startMs);
  const phrases = splitScribePhrases(words);
  const dialogues = [];
  phrases.forEach((phrase, phraseIndex) => {
    const phraseStartMs = phrase[0].startMs;
    const phraseEndMs = phrase.at(-1).endMs;
    const visibleStartMs = Math.max(chunkStartMs, phraseStartMs);
    const nextPhraseStartMs = phrases[phraseIndex + 1]?.[0]?.startMs ?? phraseEndMs;
    const pumpDynamic = input.paletteMode === "pump-dynamic";
    const captionHoldMs = pumpDynamic ? Math.min(650, Math.max(0, nextPhraseStartMs - phraseEndMs)) : 0;
    const visibleEndMs = Math.min(chunkEndMs, phraseEndMs + captionHoldMs);
    if (visibleEndMs <= visibleStartMs) return;
    const phraseText = phrase.map((word) => word.text).join(" ");
    const headlineIndex = headlineWordIndex(phrase);
    const headlineSize = fontSizeForWord(
      phrase[headlineIndex],
      input.width,
      input.height,
      0.12,
      0.88,
      0.78
    );
    const supportSize = Math.round(input.height * 0.065);
    const layoutIndex = phraseIndex % 3;
    const accent = ACCENTS[phraseIndex % ACCENTS.length];
    const visualBeat = input.beats?.find(
      (beat) => phraseStartMs >= beat.startMs && phraseStartMs < beat.endMs
    );
    const paletteBeat = {
      ...visualBeat ?? {
        sceneId: 0,
        startMs: phraseStartMs,
        endMs: phraseEndMs,
        text: phraseText,
        motif: "asset"
      },
      beatIndex: Math.floor(phraseStartMs / 1650)
    };
    const palette = getCoinOverviewLongMotionPalette(
      paletteBeat,
      layoutIndex,
      input.paletteMode ?? "default"
    );
    const primaryColor = assColor2(pumpDynamic ? "0xf7f7f2" : palette.title);
    const accentColor = assColor2(pumpDynamic ? "0xeaff00" : palette.primary);
    const outlineColor = pumpDynamic ? "&H00101012&" : palette.darkBackground ? "&H00101012&" : "&H00F7F4EC&";
    const y = pumpDynamic ? Math.round(input.height * 0.69) : Math.round(input.height * [0.58, 0.72, 0.63][layoutIndex]);
    const alignment = pumpDynamic ? 4 : layoutIndex === 0 ? 4 : layoutIndex === 1 ? 2 : 6;
    const x = pumpDynamic ? Math.round(input.width * 0.055) : layoutIndex === 0 ? Math.round(input.width * 0.085) : layoutIndex === 1 ? Math.round(input.width / 2) : Math.round(input.width * 0.915);
    const override = `{\\an${alignment}\\pos(${x},${y})\\fs${headlineSize}\\1c${primaryColor}\\2c${accentColor}\\3c${outlineColor}\\fad(70,90)\\fscx86\\fscy86\\bord3\\shad2\\blur0.1\\fsp0\\t(0,150,\\fscx108\\fscy108)\\t(150,260,\\fscx100\\fscy100)}`;
    const text = `${override}${karaokeText(phrase, {
      width: input.width,
      height: input.height,
      headlineIndex,
      headlineSize,
      supportSize
    })}`;
    dialogues.push({
      startMs: visibleStartMs,
      text: `Dialogue: 0,${assTime2(visibleStartMs - chunkStartMs)},${assTime2(visibleEndMs - chunkStartMs)},${accent.style},,0,0,0,,${text}`
    });
  });
  const ass = [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${input.width}`,
    `PlayResY: ${input.height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...ACCENTS.map(
      ({ style, color }) => `Style: ${style},DejaVu Sans,96,&H00FFFFFF,${color},&H00000000,&HAA101018,-1,0,1,5,3,5,96,96,0,1`
    ),
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogues.sort((a, b) => a.startMs - b.startMs).map((dialogue) => dialogue.text),
    ""
  ].join("\n");
  return {
    ass,
    phraseCount: phrases.length,
    maxWordsPerPhrase: Math.max(0, ...phrases.map((phrase) => phrase.length))
  };
}

// src/lib/video-pipeline/longform-visual-director.ts
var LONGFORM_VISUAL_FORMS = [
  "hero-object",
  "kinetic-type",
  "cinematic-interface",
  "data-chart",
  "network-map",
  "timeline",
  "split-screen",
  "process-flow",
  "abstract-field"
];
var LONGFORM_COMPOSITIONS = [
  "left-heavy",
  "right-heavy",
  "centered",
  "diagonal",
  "split",
  "high",
  "low"
];
var LONGFORM_ENTRIES = [
  "impact",
  "sweep-left",
  "sweep-right",
  "rise",
  "unmask",
  "shatter",
  "zoom",
  "particle-burst"
];
var LONGFORM_MOVEMENTS = [
  "punch-in",
  "pull-back",
  "whip-left",
  "whip-right",
  "orbit",
  "parallax",
  "overshoot",
  "micro-shake",
  "rotate",
  "drift-up"
];
var LONGFORM_EXITS = [
  "whip-left",
  "whip-right",
  "collapse",
  "scatter",
  "fade",
  "flash",
  "fold"
];
var LONGFORM_TRANSITIONS = [
  "whip-left",
  "whip-right",
  "flash-cut",
  "glitch-cut",
  "swipe",
  "snap-cut",
  "mask-reveal"
];
var LONGFORM_FOCAL_POINTS = [
  "left",
  "center",
  "right",
  "upper",
  "lower"
];
var IDEAL_BEAT_MS = 1550;
var MIN_BEAT_MS = 850;
var MAX_BEAT_MS = 2e3;
function normalizedText(value) {
  return value.toLocaleLowerCase("ru-RU").replaceAll("\u0451", "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
}
function allocateWordTimes(voice, durationMs) {
  const words = voice.text.trim().split(/\s+/u).filter(Boolean);
  const startMs = Math.max(0, Math.round(voice.startTime ?? 0));
  const endMs = Math.min(durationMs, Math.round(voice.endTime ?? durationMs));
  const availableMs = Math.max(0, endMs - startMs);
  if (!words.length || availableMs <= 0) return [];
  const weights = words.map(
    (word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length)
  );
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let accumulatedWeight = 0;
  return words.map((text, index) => {
    const wordStart = startMs + availableMs * accumulatedWeight / weightTotal;
    accumulatedWeight += weights[index];
    const wordEnd = startMs + availableMs * accumulatedWeight / weightTotal;
    return {
      text,
      startMs: Math.round(wordStart),
      endMs: Math.round(wordEnd)
    };
  });
}
function splitVoiceWords(words) {
  const groups = [];
  let group = [];
  const flush = () => {
    if (group.length) groups.push(group);
    group = [];
  };
  for (const word of words) {
    const currentStart = group[0]?.startMs ?? word.startMs;
    const wouldEnd = word.endMs;
    const punctuationBreak = /[.!?…;:]$/u.test(word.text) || /[,:]$/u.test(word.text) && group.length >= 3;
    if (group.length && (wouldEnd - currentStart > MAX_BEAT_MS || group.length >= 6)) {
      flush();
    }
    group.push(word);
    const elapsed = word.endMs - group[0].startMs;
    if (elapsed >= IDEAL_BEAT_MS || punctuationBreak) flush();
  }
  flush();
  for (let index = groups.length - 1; index > 0; index -= 1) {
    const current = groups[index];
    const previous = groups[index - 1];
    const currentDuration = current.at(-1).endMs - current[0].startMs;
    const combinedDuration = current.at(-1).endMs - previous[0].startMs;
    if (currentDuration < MIN_BEAT_MS && combinedDuration <= MAX_BEAT_MS) {
      previous.push(...current);
      groups.splice(index, 1);
    }
  }
  return groups;
}
function appendPauseBeats(beats, startMs, endMs, sceneId) {
  const duration = endMs - startMs;
  if (duration < 300) return;
  const count = Math.max(1, Math.ceil(duration / IDEAL_BEAT_MS));
  const segmentDuration = duration / count;
  for (let index = 0; index < count; index += 1) {
    beats.push({
      index: -1,
      sceneId,
      startMs: Math.round(startMs + segmentDuration * index),
      endMs: Math.round(startMs + segmentDuration * (index + 1)),
      voiceExcerpt: ""
    });
  }
}
function buildLongformMicroBeats(input) {
  if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) {
    throw new Error("Long-form visual duration must be a positive number");
  }
  const durationMs = Math.round(input.durationMs);
  const voices = input.voices.filter((voice) => !voice.isFullVoice && voice.text.trim()).filter((voice) => voice.startTime !== null && voice.endTime !== null).filter((voice) => Number.isFinite(voice.startTime) && Number.isFinite(voice.endTime)).sort((left, right) => (left.startTime ?? 0) - (right.startTime ?? 0));
  if (!voices.length) throw new Error("Long-form visual director requires timed narration");
  const beats = [];
  let cursorMs = 0;
  for (const voice of voices) {
    const voiceStartMs = Math.max(0, Math.min(durationMs, Math.round(voice.startTime)));
    const voiceEndMs = Math.max(voiceStartMs, Math.min(durationMs, Math.round(voice.endTime)));
    if (voiceStartMs > cursorMs + 300) appendPauseBeats(beats, cursorMs, voiceStartMs, voice.sceneId);
    const words = allocateWordTimes(voice, durationMs);
    for (const group of splitVoiceWords(words)) {
      const startMs = Math.max(cursorMs, group[0].startMs);
      const endMs = Math.min(durationMs, group.at(-1).endMs);
      if (endMs <= startMs) continue;
      beats.push({
        index: -1,
        sceneId: voice.sceneId,
        startMs,
        endMs,
        voiceExcerpt: group.map((word) => word.text).join(" ")
      });
      cursorMs = endMs;
    }
    cursorMs = Math.max(cursorMs, voiceEndMs);
  }
  if (cursorMs < durationMs - 300) {
    appendPauseBeats(beats, cursorMs, durationMs, voices.at(-1).sceneId);
  }
  const ordered = beats.filter((beat) => beat.endMs > beat.startMs).sort((left, right) => left.startMs - right.startMs);
  let previousEnd = 0;
  return ordered.map((beat, index) => {
    const startMs = Math.max(previousEnd, beat.startMs);
    const endMs = Math.max(startMs, beat.endMs);
    previousEnd = endMs;
    return { ...beat, index, startMs, endMs };
  }).filter((beat) => beat.endMs > beat.startMs);
}
function enumValue(value, values, label) {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new Error(`Long-form visual plan has invalid ${label}`);
  }
  return value;
}
function boundedString(value, label, maxLength) {
  if (typeof value !== "string") {
    throw new Error(`Long-form visual plan is missing string field ${label}`);
  }
  const cleaned = value.trim();
  if (!cleaned) throw new Error(`Long-form visual plan has an empty ${label}`);
  if (cleaned.length > maxLength) {
    throw new Error(`Long-form visual plan ${label} exceeds ${maxLength} characters`);
  }
  return cleaned;
}
function distinctAdjacentValue(value, previous, allowed, field2, beatIndex) {
  if (value !== previous) return value;
  const currentIndex = allowed.indexOf(value);
  const replacement = allowed[(currentIndex + 1) % allowed.length];
  if (!replacement) throw new Error(`No fallback ${field2} is available`);
  console.warn(JSON.stringify({
    event: "longform-visual-plan-adjusted-repeated-style",
    beat: beatIndex + 1,
    field: field2,
    from: value,
    to: replacement
  }));
  return replacement;
}
function validateLongformVisualPlan(microBeats, rawPlan) {
  if (!rawPlan || typeof rawPlan !== "object" || !Array.isArray(rawPlan.beats)) {
    throw new Error("Long-form visual director did not return a beats array");
  }
  const rawBeats = rawPlan.beats;
  if (rawBeats.length !== microBeats.length) {
    throw new Error(`Long-form visual plan expected ${microBeats.length} beats, received ${rawBeats.length}`);
  }
  const result = rawBeats.map((rawBeat, index) => {
    if (!rawBeat || typeof rawBeat !== "object") {
      throw new Error(`Long-form visual plan beat ${index + 1} is invalid`);
    }
    const candidate = rawBeat;
    const source = microBeats[index];
    if (candidate["index"] !== source.index) {
      throw new Error(`Long-form visual plan beat ${source.index + 1} is out of order`);
    }
    let kineticText = typeof candidate["kineticText"] === "string" ? candidate["kineticText"].trim() : "";
    if (kineticText && !normalizedText(source.voiceExcerpt).includes(normalizedText(kineticText))) {
      console.warn(JSON.stringify({
        event: "longform-visual-plan-dropped-nonverbatim-text",
        beat: source.index + 1
      }));
      kineticText = "";
    }
    return {
      ...source,
      mainIdea: boundedString(candidate["mainIdea"], "mainIdea", 80),
      visualConcept: boundedString(candidate["visualConcept"], "visualConcept", 180),
      assetDescription: boundedString(candidate["assetDescription"], "assetDescription", 160),
      visualForm: enumValue(candidate["visualForm"], LONGFORM_VISUAL_FORMS, "visualForm"),
      composition: enumValue(candidate["composition"], LONGFORM_COMPOSITIONS, "composition"),
      entry: enumValue(candidate["entry"], LONGFORM_ENTRIES, "entry"),
      movement: enumValue(candidate["movement"], LONGFORM_MOVEMENTS, "movement"),
      exit: enumValue(candidate["exit"], LONGFORM_EXITS, "exit"),
      transition: enumValue(candidate["transition"], LONGFORM_TRANSITIONS, "transition"),
      kineticText,
      focalPoint: enumValue(candidate["focalPoint"], LONGFORM_FOCAL_POINTS, "focalPoint")
    };
  });
  for (let index = 1; index < result.length; index += 1) {
    const previous = result[index - 1];
    const current = result[index];
    current.transition = distinctAdjacentValue(
      current.transition,
      previous.transition,
      LONGFORM_TRANSITIONS,
      "transition",
      current.index
    );
    current.composition = distinctAdjacentValue(
      current.composition,
      previous.composition,
      LONGFORM_COMPOSITIONS,
      "composition",
      current.index
    );
    current.movement = distinctAdjacentValue(
      current.movement,
      previous.movement,
      LONGFORM_MOVEMENTS,
      "movement",
      current.index
    );
    current.visualForm = distinctAdjacentValue(
      current.visualForm,
      previous.visualForm,
      LONGFORM_VISUAL_FORMS,
      "visualForm",
      current.index
    );
  }
  return result;
}

// src/lib/video-pipeline/longform-visual-renderer.ts
import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var WIDTH = 1920;
var HEIGHT = 1080;
var FPS = 30;
function escapeFilterExpression(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll(":", "\\:").replaceAll(",", "\\,");
}
function pumpDynamicDot(input) {
  const enable = `gte(t,${input.start.toFixed(3)})*lt(t,${input.end.toFixed(3)})`;
  return `drawtext=font='DejaVu Sans':text='\u25CF':x='${escapeFilterExpression(input.x)}':y='${escapeFilterExpression(input.y)}':fontsize=${input.size}:fontcolor=${input.color}:borderw=0:shadowcolor=${input.color}@0.9:shadowx=0:shadowy=0:enable='${enable}'`;
}
function pathCoordinateExpression(points, progress, axis) {
  const lengths = points.slice(1).map(
    (point, index) => Math.hypot(point[0] - points[index][0], point[1] - points[index][1])
  );
  const totalLength = lengths.reduce((total, length) => total + length, 0);
  const fractions = [0];
  lengths.forEach((length) => fractions.push(fractions.at(-1) + length / totalLength));
  let expression = String(points.at(-1)[axis]);
  for (let index = points.length - 2; index >= 0; index -= 1) {
    const start = fractions[index];
    const end = fractions[index + 1];
    const from = points[index][axis];
    const to = points[index + 1][axis];
    const segmentProgress = `((${progress}-${start.toFixed(5)})/${(end - start).toFixed(5)})`;
    const position = `${from}+(${to}-${from})*${segmentProgress}`;
    expression = `if(lt(${progress},${end.toFixed(5)}),${position},${expression})`;
  }
  return expression;
}
function buildPumpDynamicMotionFilters(sceneBoundaries) {
  if (sceneBoundaries.length !== 7) {
    throw new Error("Pump-dynamic motion requires six scene boundary intervals");
  }
  const start = (index) => sceneBoundaries[index];
  const end = (index) => sceneBoundaries[index + 1];
  const length = (index) => end(index) - start(index);
  const filters = [];
  const introStart = start(0);
  const introEnd = end(0);
  filters.push(
    pumpDynamicDot({
      x: `1510+340*cos((t-${introStart.toFixed(3)})*1.25)-32`,
      y: `492+340*sin((t-${introStart.toFixed(3)})*1.25)-32`,
      size: 64,
      color: "0xeaff00",
      start: introStart,
      end: introEnd
    }),
    pumpDynamicDot({
      x: `1510+340*cos((t-${introStart.toFixed(3)})*1.25+2.4)-22`,
      y: `492+340*sin((t-${introStart.toFixed(3)})*1.25+2.4)-22`,
      size: 46,
      color: "0x14d8f0",
      start: introStart,
      end: introEnd
    })
  );
  const marketStart = start(1);
  const marketEnd = end(1);
  const marketSeconds = length(1);
  const marketProgress = `(t-${marketStart.toFixed(3)})/${marketSeconds.toFixed(3)}`;
  const marketPoints = [
    [510, 530],
    [790, 390],
    [1080, 540],
    [1380, 420],
    [1690, 490],
    [1870, 450]
  ];
  const marketX = pathCoordinateExpression(marketPoints, marketProgress, 0);
  const marketY = pathCoordinateExpression(marketPoints, marketProgress, 1);
  filters.push(
    pumpDynamicDot({
      x: `${marketX}-34`,
      y: `${marketY}-34`,
      size: 68,
      color: "0xeaff00",
      start: marketStart,
      end: marketEnd
    }),
    pumpDynamicDot({
      x: `${pathCoordinateExpression(marketPoints, `(${marketProgress}-0.24)`, 0)}-22`,
      y: `${pathCoordinateExpression(marketPoints, `(${marketProgress}-0.24)`, 1)}-22`,
      size: 44,
      color: "0xff526f",
      start: marketStart + marketSeconds * 0.24,
      end: marketEnd
    })
  );
  const hypeStart = start(2);
  const hypeEnd = end(2);
  filters.push(
    pumpDynamicDot({
      x: `1432+305*cos((t-${hypeStart.toFixed(3)})*1.3)-28`,
      y: `488+305*sin((t-${hypeStart.toFixed(3)})*1.3)-28`,
      size: 56,
      color: "0xeaff00",
      start: hypeStart,
      end: hypeEnd
    }),
    pumpDynamicDot({
      x: `1432+305*cos((t-${hypeStart.toFixed(3)})*1.3+3.14)-20`,
      y: `488+305*sin((t-${hypeStart.toFixed(3)})*1.3+3.14)-20`,
      size: 40,
      color: "0x14d8f0",
      start: hypeStart,
      end: hypeEnd
    })
  );
  const riskStart = start(3);
  const riskEnd = end(3);
  const riskSeconds = length(3);
  filters.push(
    pumpDynamicDot({
      x: `1480+112*cos((t-${riskStart.toFixed(3)})*2.2)-24`,
      y: `360+112*sin((t-${riskStart.toFixed(3)})*2.2)-24`,
      size: 48,
      color: "0xff526f",
      start: riskStart,
      end: riskEnd
    }),
    pumpDynamicDot({
      x: `430+${((1480 - 430) / riskSeconds).toFixed(4)}*(t-${riskStart.toFixed(3)})-18`,
      y: `610+38*sin((t-${riskStart.toFixed(3)})*2.7)-18`,
      size: 36,
      color: "0xeaff00",
      start: riskStart,
      end: riskEnd
    })
  );
  const exchangeStart = start(4);
  const exchangeEnd = end(4);
  const exchangeProgress = `(t-${exchangeStart.toFixed(3)})/${length(4).toFixed(3)}`;
  const exchangePoints = [
    [1080, 235],
    [1330, 390],
    [1570, 260],
    [1750, 465],
    [1510, 650],
    [1285, 790],
    [1050, 620],
    [1230, 485],
    [1510, 650]
  ];
  filters.push(
    pumpDynamicDot({
      x: `${pathCoordinateExpression(exchangePoints, exchangeProgress, 0)}-30`,
      y: `${pathCoordinateExpression(exchangePoints, exchangeProgress, 1)}-30`,
      size: 60,
      color: "0x14d8f0",
      start: exchangeStart,
      end: exchangeEnd
    })
  );
  const contractStart = start(5);
  const contractEnd = end(5);
  filters.push(
    pumpDynamicDot({
      x: `1325+325*cos((t-${contractStart.toFixed(3)})*2.3)-32`,
      y: `505+245*sin((t-${contractStart.toFixed(3)})*2.3)-32`,
      size: 64,
      color: "0xeaff00",
      start: contractStart,
      end: contractEnd
    })
  );
  return filters;
}
var PALETTES = [
  { accent: "#72E6D3", second: "#53A5FF", glow: "#0A6A79" },
  { accent: "#FFD27A", second: "#72E6D3", glow: "#85512A" },
  { accent: "#8DA8FF", second: "#FF806F", glow: "#314F9F" },
  { accent: "#FF806F", second: "#FFD27A", glow: "#7B3038" }
];
function xml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function assTime3(milliseconds) {
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const totalSeconds = Math.floor(centiseconds / 100);
  return `${Math.floor(totalSeconds / 3600)}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}
function assText3(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", " ");
}
function wrapText(value, maxCharacters) {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}
function comparableText(value) {
  return value.toLocaleLowerCase("ru-RU").replaceAll("\u0451", "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
}
function pointForComposition(beat) {
  const focalX = beat.focalPoint === "left" ? 0.31 : beat.focalPoint === "right" ? 0.69 : 0.5;
  const focalY = beat.focalPoint === "upper" ? 0.36 : beat.focalPoint === "lower" ? 0.64 : 0.5;
  switch (beat.composition) {
    case "left-heavy":
      return { x: 1370, y: Math.round(HEIGHT * focalY), textX: 235, anchor: "start" };
    case "right-heavy":
      return { x: 550, y: Math.round(HEIGHT * focalY), textX: 1685, anchor: "end" };
    case "high":
      return { x: Math.round(WIDTH * focalX), y: 340, textX: WIDTH / 2, anchor: "middle" };
    case "low":
      return { x: Math.round(WIDTH * focalX), y: 720, textX: WIDTH / 2, anchor: "middle" };
    case "split":
      return { x: 1430, y: Math.round(HEIGHT * focalY), textX: 260, anchor: "start" };
    case "diagonal":
      return {
        x: beat.index % 2 === 0 ? 1430 : 500,
        y: beat.index % 2 === 0 ? 370 : 710,
        textX: beat.index % 2 === 0 ? 260 : 1670,
        anchor: beat.index % 2 === 0 ? "start" : "end"
      };
    default:
      return { x: WIDTH / 2, y: Math.round(HEIGHT * focalY), textX: WIDTH / 2, anchor: "middle" };
  }
}
function renderNetwork(x, y, size, accent, second, seed) {
  const points = Array.from({ length: 8 }, (_, index) => {
    const angle = Math.PI * 2 * index / 8 + seed * 0.13;
    const radius = size * (index % 3 === 0 ? 0.38 : 0.49);
    return {
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
      r: index === 0 ? 14 : 8
    };
  });
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 4], [1, 5], [2, 6]];
  const lines = edges.map(([from, to], index) => {
    const start = points[from];
    const end = points[to];
    return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${index % 3 === 0 ? second : accent}" stroke-opacity="${index % 3 === 0 ? 0.62 : 0.34}" stroke-width="${index % 3 === 0 ? 3 : 2}"/>`;
  }).join("");
  const nodes = points.map(
    (point, index) => `<circle cx="${point.x}" cy="${point.y}" r="${point.r + 10}" fill="none" stroke="${index === 0 ? second : accent}" stroke-opacity=".22" stroke-width="2"/><circle cx="${point.x}" cy="${point.y}" r="${point.r}" fill="${index === 0 ? second : accent}" filter="url(#glow)"/>`
  ).join("");
  return `<g transform="translate(${x} ${y})">${lines}${nodes}<circle r="${size * 0.27}" fill="url(#core)" opacity=".8"/></g>`;
}
function renderChart(x, y, size, accent, second, seed) {
  const points = Array.from({ length: 8 }, (_, index) => {
    const px = -size * 0.47 + size * 0.94 * index / 7;
    const wave = Math.sin(index * 1.7 + seed) * size * 0.095 + Math.cos(index * 0.8 + seed * 0.6) * size * 0.055;
    return `${px.toFixed(1)},${wave.toFixed(1)}`;
  });
  return `<g transform="translate(${x} ${y})">
    <rect x="${-size * 0.52}" y="${-size * 0.32}" width="${size * 1.04}" height="${size * 0.64}" rx="28" fill="#121A27" fill-opacity=".75" stroke="#DCE7F4" stroke-opacity=".18"/>
    ${[1, 2, 3].map((row) => `<line x1="${-size * 0.45}" y1="${-size * 0.22 + row * size * 0.11}" x2="${size * 0.45}" y2="${-size * 0.22 + row * size * 0.11}" stroke="#DCE7F4" stroke-opacity=".09" stroke-width="2"/>`).join("")}
    <polyline points="${points.join(" ")}" transform="translate(0 0)" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
    <circle cx="${size * 0.47}" cy="${Number(points.at(-1)?.split(",")[1] || 0)}" r="12" fill="${second}"/>
  </g>`;
}
function renderTimeline(x, y, size, accent, second, seed) {
  return `<g transform="translate(${x} ${y}) rotate(${seed % 2 ? 8 : -8})">
    <path d="M ${-size * 0.48} 0 C ${-size * 0.22} ${-size * 0.23}, ${size * 0.18} ${size * 0.23}, ${size * 0.48} 0" fill="none" stroke="${accent}" stroke-width="5" stroke-opacity=".8"/>
    ${[-0.42, -0.14, 0.15, 0.43].map((fraction, index) => `<g transform="translate(${size * fraction} ${Math.sin(index * 2.1 + seed) * size * 0.11})"><circle r="${index === 3 ? 24 : 16}" fill="${index === 3 ? second : accent}" fill-opacity=".18" stroke="${index === 3 ? second : accent}" stroke-width="4"/><circle r="5" fill="#F5F7FA"/></g>`).join("")}
    <circle r="${size * 0.24}" fill="none" stroke="${second}" stroke-opacity=".22" stroke-width="2"/>
  </g>`;
}
function renderInterface(x, y, size, accent, second, seed) {
  const width = size * 0.98;
  const height = size * 0.64;
  return `<g transform="translate(${x} ${y}) rotate(${seed % 2 ? -7 : 7})">
    <rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" rx="26" fill="#111A28" fill-opacity=".88" stroke="#E8F0FA" stroke-opacity=".28" stroke-width="2"/>
    <path d="M ${-width / 2} ${-height / 2 + 58} H ${width / 2}" stroke="#E8F0FA" stroke-opacity=".16" stroke-width="2"/>
    <circle cx="${-width / 2 + 28}" cy="${-height / 2 + 28}" r="6" fill="${second}"/>
    <circle cx="${-width / 2 + 50}" cy="${-height / 2 + 28}" r="6" fill="${accent}" opacity=".7"/>
    <rect x="${-width / 2 + 28}" y="${-height / 2 + 82}" width="${width * 0.33}" height="${height * 0.62}" rx="14" fill="#1B293A" stroke="${accent}" stroke-opacity=".36"/>
    <rect x="${-width / 2 + width * 0.4}" y="${-height / 2 + 82}" width="${width * 0.53}" height="${height * 0.24}" rx="12" fill="#1B293A" stroke="${second}" stroke-opacity=".3"/>
    <rect x="${-width / 2 + width * 0.4}" y="${-height / 2 + height * 0.47}" width="${width * 0.53}" height="${height * 0.31}" rx="12" fill="#1B293A" stroke="#E8F0FA" stroke-opacity=".18"/>
    ${Array.from({ length: 5 }, (_, index) => `<rect x="${-width / 2 + 48}" y="${-height / 2 + 108 + index * 29}" width="${width * (0.2 + index % 3 * 0.025)}" height="5" rx="2.5" fill="${index === seed % 5 ? second : accent}" fill-opacity="${index === seed % 5 ? 0.8 : 0.3}"/>`).join("")}
  </g>`;
}
function renderHeroObject(x, y, size, accent, second, seed) {
  const rotation = seed % 2 === 0 ? -11 : 11;
  return `<g transform="translate(${x} ${y}) rotate(${rotation})">
    <ellipse cx="0" cy="${size * 0.39}" rx="${size * 0.43}" ry="${size * 0.12}" fill="${accent}" opacity=".14" filter="url(#softGlow)"/>
    <path d="M 0 ${-size * 0.48} L ${size * 0.32} ${-size * 0.24} L ${size * 0.38} ${size * 0.2} L 0 ${size * 0.48} L ${-size * 0.36} ${size * 0.18} L ${-size * 0.3} ${-size * 0.24} Z" fill="url(#objectFill)" stroke="${accent}" stroke-width="3"/>
    <path d="M 0 ${-size * 0.48} L ${size * 0.32} ${-size * 0.24} L 0 ${-size * 0.08} L ${-size * 0.3} ${-size * 0.24} Z" fill="${second}" fill-opacity=".48"/>
    <path d="M 0 ${-size * 0.08} L ${size * 0.32} ${-size * 0.24} L ${size * 0.38} ${size * 0.2} L 0 ${size * 0.48} Z" fill="${accent}" fill-opacity=".3"/>
    <path d="M 0 ${-size * 0.08} L ${-size * 0.3} ${-size * 0.24} L ${-size * 0.36} ${size * 0.18} L 0 ${size * 0.48} Z" fill="#EAF5FF" fill-opacity=".08"/>
    <path d="M ${-size * 0.22} ${-size * 0.03} L 0 ${-size * 0.18} L ${size * 0.21} ${-size * 0.02}" fill="none" stroke="#F6F7FA" stroke-opacity=".72" stroke-width="3"/>
    <path d="M ${-size * 0.12} ${size * 0.15} L 0 ${size * 0.23} L ${size * 0.13} ${size * 0.14}" fill="none" stroke="${second}" stroke-width="4"/>
  </g>`;
}
function renderProcess(x, y, size, accent, second, seed) {
  const nodes = Array.from({ length: 4 }, (_, index) => ({
    x: -size * 0.4 + index * size * 0.265,
    y: Math.sin(index * 1.4 + seed) * size * 0.15
  }));
  const lines = nodes.slice(0, -1).map((point, index) => {
    const next = nodes[index + 1];
    return `<path d="M ${point.x} ${point.y} C ${point.x + size * 0.1} ${point.y - size * 0.25}, ${next.x - size * 0.1} ${next.y + size * 0.25}, ${next.x} ${next.y}" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" marker-end="url(#arrow)"/>`;
  }).join("");
  const circles = nodes.map(
    (point, index) => `<g transform="translate(${point.x} ${point.y})"><circle r="${size * 0.1}" fill="#111A28" stroke="${index === 3 ? second : accent}" stroke-width="4"/><circle r="${size * 0.035}" fill="${index === 3 ? second : accent}"/></g>`
  ).join("");
  return `<g transform="translate(${x} ${y})">${lines}${circles}</g>`;
}
function renderSplit(x, y, size, accent, second, seed) {
  const gap = size * 0.075;
  const cardWidth = size * 0.43;
  const cardHeight = size * 0.55;
  return `<g transform="translate(${x} ${y}) rotate(${seed % 2 ? 5 : -5})">
    <rect x="${-gap / 2 - cardWidth}" y="${-cardHeight / 2}" width="${cardWidth}" height="${cardHeight}" rx="24" fill="#111A28" stroke="${accent}" stroke-width="3"/>
    <rect x="${gap / 2}" y="${-cardHeight / 2}" width="${cardWidth}" height="${cardHeight}" rx="24" fill="#111A28" stroke="${second}" stroke-width="3"/>
    <path d="M ${-cardWidth + 20} 0 H ${-gap / 2 - 28}" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
    <path d="M ${gap / 2 + 28} 0 H ${cardWidth - 20}" stroke="${second}" stroke-width="8" stroke-linecap="round"/>
    <circle r="${size * 0.07}" fill="#09101A" stroke="#F5F7FA" stroke-width="3"/>
    <path d="M -12 -18 L 10 0 L -12 18" fill="none" stroke="#F5F7FA" stroke-width="4"/>
    ${Array.from({ length: 3 }, (_, row) => `<rect x="${-cardWidth + 28}" y="${-cardHeight / 2 + 50 + row * 35}" width="${cardWidth * (0.45 + row % 2 * 0.15)}" height="6" rx="3" fill="${accent}" fill-opacity=".6"/>`).join("")}
    ${Array.from({ length: 3 }, (_, row) => `<rect x="${gap / 2 + 28}" y="${-cardHeight / 2 + 50 + row * 35}" width="${cardWidth * (0.43 + (row + 1) % 2 * 0.18)}" height="6" rx="3" fill="${second}" fill-opacity=".6"/>`).join("")}
  </g>`;
}
function renderForm(beat, x, y, size, accent, second) {
  const seed = beat.index + beat.sceneId * 3;
  switch (beat.visualForm) {
    case "network-map":
      return renderNetwork(x, y, size, accent, second, seed);
    case "data-chart":
      return renderChart(x, y, size, accent, second, seed);
    case "timeline":
      return renderTimeline(x, y, size, accent, second, seed);
    case "cinematic-interface":
      return renderInterface(x, y, size, accent, second, seed);
    case "split-screen":
      return renderSplit(x, y, size, accent, second, seed);
    case "process-flow":
      return renderProcess(x, y, size, accent, second, seed);
    case "kinetic-type":
      return `<g transform="translate(${x} ${y})"><circle r="${size * 0.36}" fill="url(#halo)" opacity=".9"/><path d="M ${-size * 0.45} 0 H ${size * 0.45}" stroke="${accent}" stroke-width="3" stroke-opacity=".5"/></g>`;
    case "abstract-field":
      return `<g transform="translate(${x} ${y})">${Array.from({ length: 9 }, (_, index) => {
        const angle = Math.PI * 2 * index / 9 + seed;
        const radius = size * (0.18 + index % 3 * 0.1);
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        return `<path d="M ${px} ${py - size * 0.12} L ${px + size * 0.11} ${py} L ${px} ${py + size * 0.12} L ${px - size * 0.11} ${py} Z" fill="${index % 2 ? second : accent}" fill-opacity="${0.18 + index % 3 * 0.1}" stroke="${index % 2 ? second : accent}" stroke-width="2"/>`;
      }).join("")}</g>`;
    default:
      return renderHeroObject(x, y, size, accent, second, seed);
  }
}
function buildLongformVisualSvg(beat) {
  const palette = PALETTES[beat.index % PALETTES.length];
  const composition = pointForComposition(beat);
  const size = beat.visualForm === "cinematic-interface" ? 600 : beat.visualForm === "kinetic-type" ? 510 : 470;
  const titleLines = wrapText(beat.kineticText, 22);
  const titleFontSize = Math.min(220, Math.max(78, Math.floor(980 / Math.max(1, ...titleLines.map((line) => line.length)) * 1.26)));
  const lineHeight = Math.round(titleFontSize * 1.03);
  const titleY = titleLines.length === 1 ? 570 : 520 - Math.round((titleLines.length - 1) * lineHeight / 2);
  const textSvg = titleLines.length ? `<g text-anchor="${composition.anchor}" font-family="DejaVu Sans,Arial,sans-serif" font-weight="800" letter-spacing="-7">
        <text x="${composition.textX + 7}" y="${titleY + 9}" fill="${palette.accent}" opacity=".28" font-size="${titleFontSize}">${titleLines.map((line, index) => `<tspan x="${composition.textX + 7}" dy="${index === 0 ? 0 : lineHeight}">${xml(line.toLocaleUpperCase("ru-RU"))}</tspan>`).join("")}</text>
        <text x="${composition.textX}" y="${titleY}" fill="#F3F6FA" stroke="#F3F6FA" stroke-opacity=".15" stroke-width="1" font-size="${titleFontSize}">${titleLines.map((line, index) => `<tspan x="${composition.textX}" dy="${index === 0 ? 0 : lineHeight}">${xml(line.toLocaleUpperCase("ru-RU"))}</tspan>`).join("")}</text>
        <rect x="${composition.anchor === "start" ? composition.textX : composition.anchor === "end" ? composition.textX - 400 : composition.textX - 200}" y="${titleY + lineHeight * titleLines.length + 18}" width="400" height="6" rx="3" fill="url(#accent)"/>
      </g>` : "";
  const objectSize = size * (beat.composition === "split" ? 0.84 : 1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <title>${xml(beat.visualConcept)}</title>
    <desc>${xml(beat.assetDescription)}</desc>
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#05070D"/>
        <stop offset=".47" stop-color="#0D1422"/>
        <stop offset="1" stop-color="#080B12"/>
      </linearGradient>
      <radialGradient id="halo">
        <stop offset="0" stop-color="${palette.glow}" stop-opacity=".72"/>
        <stop offset=".52" stop-color="${palette.glow}" stop-opacity=".2"/>
        <stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${palette.accent}" stop-opacity=".25"/>
        <stop offset=".48" stop-color="${palette.accent}"/>
        <stop offset="1" stop-color="${palette.second}" stop-opacity=".8"/>
      </linearGradient>
      <linearGradient id="objectFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F3F8FF" stop-opacity=".34"/>
        <stop offset=".42" stop-color="${palette.accent}" stop-opacity=".56"/>
        <stop offset="1" stop-color="#121A28" stop-opacity=".92"/>
      </linearGradient>
      <radialGradient id="core">
        <stop offset="0" stop-color="#F3F8FF" stop-opacity=".36"/>
        <stop offset="1" stop-color="${palette.accent}" stop-opacity=".04"/>
      </radialGradient>
      <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#C9D8EE" stroke-opacity=".055" stroke-width="1"/>
      </pattern>
      <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="8" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="26"/>
      </filter>
      <marker id="arrow" markerWidth="11" markerHeight="11" refX="8" refY="5" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 Z" fill="${palette.accent}"/>
      </marker>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
    <ellipse cx="${composition.x}" cy="${composition.y}" rx="780" ry="570" fill="url(#halo)" opacity=".92"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" opacity=".56"/>
    <path d="M -80 850 C 360 620 680 1000 1120 735 S 1620 510 2050 760" fill="none" stroke="${palette.accent}" stroke-opacity=".1" stroke-width="2"/>
    <path d="M -120 930 C 280 740 660 1030 1010 840 S 1610 610 2050 850" fill="none" stroke="${palette.second}" stroke-opacity=".08" stroke-width="1"/>
    <g opacity=".75">
      <path d="M 105 114 H 430" stroke="${palette.accent}" stroke-opacity=".72" stroke-width="4"/>
      <circle cx="105" cy="114" r="7" fill="${palette.accent}"/>
      <path d="M 1490 976 H 1815" stroke="#EAF2FE" stroke-opacity=".25" stroke-width="2"/>
    </g>
    <g>${renderForm(beat, composition.x, composition.y, objectSize, palette.accent, palette.second)}</g>
    ${textSvg}
    <path d="M 0 1036 C 380 986 740 1080 1120 1020 S 1590 980 1920 1030" fill="none" stroke="${palette.accent}" stroke-opacity=".24" stroke-width="2"/>
  </svg>`;
}
function buildLongformCaptionsAss(beats, durationMs) {
  const dialogues = beats.filter(
    (beat) => beat.voiceExcerpt.trim() && beat.endMs > beat.startMs && comparableText(beat.voiceExcerpt) !== comparableText(beat.kineticText)
  ).map((beat) => {
    const captionLines = wrapText(beat.voiceExcerpt, 54).slice(0, 2);
    return `Dialogue: 0,${assTime3(beat.startMs)},${assTime3(Math.min(durationMs, beat.endMs))},Caption,,0,0,0,,{\\fad(50,70)}${captionLines.map(assText3).join("\\N")}`;
  });
  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${WIDTH}`,
    `PlayResY: ${HEIGHT}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Caption,DejaVu Sans,38,&H00F5F7FA,&H00F5F7FA,&H00101620,&HBE07101A,0,0,3,13,1,2,170,170,54,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogues,
    ""
  ].join("\n");
}
function transitionFilters(beat, durationSeconds) {
  const filters = [];
  const accent = PALETTES[beat.index % PALETTES.length].accent.replace("#", "0x");
  if (beat.transition === "flash-cut") {
    filters.push("drawbox=x=0:y=0:w=iw:h=ih:color=white@0.42:t=fill:enable='lt(t,0.055)'");
  } else if (beat.transition === "glitch-cut") {
    filters.push(
      `drawbox=x='mod(t*30*174+${beat.index * 73},iw)':y=0:w=120:h=ih:color=0xff527a@0.38:t=fill:enable='lt(t,0.14)'`,
      `drawbox=x='mod(t*30*131+${beat.index * 109},iw)':y=0:w=64:h=ih:color=0x56e8ff@0.34:t=fill:enable='lt(t,0.12)'`
    );
  } else if (beat.transition === "swipe" || beat.transition === "mask-reveal") {
    const direction = beat.index % 2 === 0 ? 1 : -1;
    filters.push(
      `drawbox=x='${direction > 0 ? "-iw+iw*min(t/0.18,1)" : "iw*min(t/0.18,1)"}':y=0:w=iw:h=ih:color=${accent}@0.22:t=fill:enable='lt(t,0.18)'`
    );
  } else if (beat.transition === "whip-left" || beat.transition === "whip-right") {
    const reverse = beat.transition === "whip-left";
    filters.push(
      `drawbox=x='${reverse ? "iw-iw*min(t/0.16,1)" : "-iw+iw*min(t/0.16,1)"}':y=0:w=iw*0.28:h=ih:color=${accent}@0.20:t=fill:enable='lt(t,0.16)'`,
      `drawbox=x='${reverse ? "iw-iw*min(t/0.16,1)" : "-iw+iw*min(t/0.16,1)"}':y=0:w=7:h=ih:color=0xf1f7ff@0.58:t=fill:enable='lt(t,0.16)'`
    );
  } else if (beat.transition === "snap-cut") {
    filters.push("drawbox=x=0:y=0:w=iw:h=ih:color=white@0.18:t=fill:enable='lt(t,0.035)'");
  }
  const entryAccent = accent;
  if (beat.entry === "sweep-left" || beat.entry === "sweep-right") {
    const reverse = beat.entry === "sweep-left";
    filters.push(
      `drawbox=x='${reverse ? "iw-iw*min(t/0.24,1)" : "-iw+iw*min(t/0.24,1)"}':y='ih*0.18':w='iw*0.62':h=4:color=${entryAccent}@0.8:t=fill:enable='lt(t,0.24)'`
    );
  } else if (beat.entry === "rise") {
    filters.push(
      `drawbox=x=0:y='ih-ih*min(t/0.2,1)':w=iw:h=5:color=${entryAccent}@0.72:t=fill:enable='lt(t,0.2)'`
    );
  } else if (beat.entry === "impact" || beat.entry === "shatter") {
    filters.push(
      `drawbox=x=0:y='ih*0.5+sin(t*30*0.8)*ih*0.02':w=iw:h=3:color=${entryAccent}@0.8:t=fill:enable='lt(t,0.12)'`,
      `drawbox=x='iw*0.5+cos(t*30*1.1)*iw*0.14':y=0:w=3:h=ih:color=0xf2f6ff@0.48:t=fill:enable='lt(t,0.08)'`
    );
  } else if (beat.entry === "particle-burst") {
    filters.push(
      `drawbox=x='iw*0.5+sin(t*30*1.6)*iw*0.22':y='ih*0.5+cos(t*30*1.2)*ih*0.2':w=8:h=8:color=${entryAccent}@0.88:t=fill:enable='lt(t,0.4)'`,
      `drawbox=x='iw*0.5+cos(t*30*1.4)*iw*0.28':y='ih*0.5+sin(t*30*1.7)*ih*0.22':w=5:h=5:color=0xf2f6ff@0.75:t=fill:enable='lt(t,0.35)'`
    );
  } else if (beat.entry === "unmask") {
    filters.push(
      `drawbox=x='iw*min(t/0.2,1)':y=0:w='iw*(1-min(t/0.2,1))':h=ih:color=0x080b12@0.9:t=fill:enable='lt(t,0.2)'`
    );
  }
  const exitStart = Math.max(0, durationSeconds - 0.1).toFixed(3);
  if (beat.exit === "fade") {
    filters.push(`fade=t=out:st=${exitStart}:d=0.1`);
  } else if (beat.exit === "flash") {
    filters.push(`drawbox=x=0:y=0:w=iw:h=ih:color=white@0.28:t=fill:enable='gte(t,${exitStart})'`);
  } else if (beat.exit === "whip-left" || beat.exit === "whip-right") {
    const reverse = beat.exit === "whip-left";
    filters.push(
      `drawbox=x='${reverse ? "iw*min((t-" + exitStart + ")/0.1,1)" : "-iw*min((t-" + exitStart + ")/0.1,1)"}':y=0:w=iw:h=ih:color=${accent}@0.24:t=fill:enable='gte(t,${exitStart})'`
    );
  } else if (beat.exit === "collapse" || beat.exit === "fold" || beat.exit === "scatter") {
    filters.push(
      `drawbox=x=0:y='ih*min((t-${exitStart})/0.1,1)':w=iw:h='ih*min((t-${exitStart})/0.1,1)':color=0x070A10@0.92:t=fill:enable='gte(t,${exitStart})'`
    );
  }
  return filters;
}
function movementZoom(beat, frames) {
  const progress = `min(on/${Math.max(1, frames - 1)},1)`;
  const centeredX = "iw/2-iw/zoom/2";
  const centeredY = "ih/2-ih/zoom/2";
  switch (beat.movement) {
    case "punch-in":
      return { zoom: `1+0.095*${progress}`, x: centeredX, y: centeredY };
    case "pull-back":
      return { zoom: `1.105-0.085*${progress}`, x: centeredX, y: centeredY };
    case "whip-left":
      return { zoom: "1.11", x: `(iw-iw/zoom)*(1-min(on/8,1))`, y: centeredY };
    case "whip-right":
      return { zoom: "1.11", x: `(iw-iw/zoom)*min(on/8,1)`, y: centeredY };
    case "orbit":
      return {
        zoom: "1.075",
        x: `${centeredX}+sin(on/17)*iw*0.018`,
        y: `${centeredY}+cos(on/23)*ih*0.015`
      };
    case "parallax":
      return {
        zoom: `1.025+0.045*${progress}`,
        x: `${centeredX}+${progress}*iw*0.014`,
        y: `${centeredY}-${progress}*ih*0.012`
      };
    case "overshoot":
      return {
        zoom: `if(lte(on,7),1+0.14*on/7,if(lte(on,17),1.14-0.06*(on-7)/10,1.08))`,
        x: centeredX,
        y: centeredY
      };
    case "micro-shake":
      return {
        zoom: "1.08",
        x: `${centeredX}+if(lt(on,7),sin(on*2)*iw*0.018,0)`,
        y: `${centeredY}+if(lt(on,7),cos(on*2.7)*ih*0.014,0)`
      };
    case "rotate":
      return {
        zoom: "1.08+0.015*sin(on/12)",
        x: `${centeredX}+sin(on/15)*iw*0.01`,
        y: `${centeredY}+cos(on/17)*ih*0.01`
      };
    default:
      return {
        zoom: `1.04+0.045*${progress}`,
        x: centeredX,
        y: `${centeredY}-${progress}*ih*0.025`
      };
  }
}
async function renderBeatClip(input) {
  const { beat, tempDir, frameCount, index } = input;
  const svgPath = join(tempDir, `beat-${String(index).padStart(3, "0")}.svg`);
  const pngPath = join(tempDir, `beat-${String(index).padStart(3, "0")}.png`);
  const videoPath = join(tempDir, `beat-${String(index).padStart(3, "0")}.mp4`);
  await writeFile(svgPath, buildLongformVisualSvg(beat), "utf8");
  await execFileAsync("magick", [
    "-background",
    "#080b12",
    "-density",
    "96",
    svgPath,
    "-resize",
    `${WIDTH}x${HEIGHT}!`,
    pngPath
  ], { maxBuffer: 10 * 1024 * 1024 });
  const seconds = (frameCount / FPS).toFixed(3);
  const movement = movementZoom(beat, frameCount);
  const filters = [
    `zoompan=z='${movement.zoom}':x='${movement.x}':y='${movement.y}':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
    `drawbox=x='mod(t*30*47+${index * 131},${WIDTH + 360})-180':y='${Math.round(HEIGHT * (0.13 + index % 5 * 0.12))}':w=260:h=2:color=${PALETTES[index % PALETTES.length].accent.replace("#", "0x")}@0.22:t=fill`,
    `drawbox=x='mod(t*30*23+${index * 89},${WIDTH + 140})-70':y='mod(t*30*11+${index * 47},${HEIGHT})':w=5:h=5:color=0xf2f6ff@0.38:t=fill`,
    ...transitionFilters(beat, Number(seconds)),
    "format=yuv420p"
  ].join(",");
  await execFileAsync("ffmpeg", [
    "-y",
    "-loop",
    "1",
    "-framerate",
    String(FPS),
    "-i",
    pngPath,
    "-vf",
    filters,
    "-frames:v",
    String(frameCount),
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-r",
    String(FPS),
    "-g",
    String(FPS),
    "-keyint_min",
    String(FPS),
    "-sc_threshold",
    "0",
    "-movflags",
    "+faststart",
    videoPath
  ], { maxBuffer: 15 * 1024 * 1024 });
  return videoPath;
}
async function probeVideo(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration:stream=codec_name,codec_type,width,height,r_frame_rate",
    "-of",
    "json",
    filePath
  ]);
  const probe = JSON.parse(stdout);
  return {
    durationSeconds: Number(probe.format?.duration || 0),
    streams: probe.streams ?? []
  };
}
async function renderLongformVisualVideo(input) {
  if (!input.beats.length) throw new Error("Long-form visual render requires at least one planned beat");
  const durationMs = Math.round(input.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < 1e3) {
    throw new Error("Long-form visual render duration must be at least one second");
  }
  const sourceVideoPath = resolve(input.sourceVideoPath);
  await access(sourceVideoPath);
  const sourceProbe = await probeVideo(sourceVideoPath);
  if (!sourceProbe.streams.some((stream) => stream.codec_type === "audio")) {
    throw new Error("Long-form pilot source does not contain an audio stream");
  }
  if (sourceProbe.durationSeconds * 1e3 < durationMs) {
    throw new Error("Long-form pilot source is shorter than the requested duration");
  }
  const outputPath = resolve(input.outputPath);
  try {
    await access(outputPath);
    throw new Error(`Refusing to overwrite an existing long-form pilot: ${outputPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "longform-visual-engine-"));
  try {
    const targetFrames = Math.round(durationMs * FPS / 1e3);
    const sortedBeats = [...input.beats].sort((left, right) => left.startMs - right.startMs);
    const beatFrameCounts = sortedBeats.map((beat, index) => {
      const startFrame = Math.round(beat.startMs * FPS / 1e3);
      const endFrame = index === sortedBeats.length - 1 ? targetFrames : Math.round(beat.endMs * FPS / 1e3);
      return Math.max(1, Math.min(targetFrames - startFrame, endFrame - startFrame));
    });
    const totalFrames = beatFrameCounts.reduce((sum, count) => sum + count, 0);
    if (totalFrames !== targetFrames) {
      const delta = targetFrames - totalFrames;
      beatFrameCounts[beatFrameCounts.length - 1] = Math.max(1, beatFrameCounts.at(-1) + delta);
    }
    const clipPaths = [];
    for (const [index, beat] of sortedBeats.entries()) {
      const videoPath = await renderBeatClip({
        beat,
        tempDir,
        frameCount: beatFrameCounts[index],
        index
      });
      clipPaths.push(videoPath);
      console.log(JSON.stringify({
        render: "longform-visual-pilot",
        beat: index + 1,
        beats: sortedBeats.length,
        startMs: beat.startMs,
        endMs: beat.endMs,
        visualForm: beat.visualForm,
        transition: beat.transition
      }));
    }
    const concatPath = join(tempDir, "video-parts.txt");
    const videoOnlyPath = join(tempDir, "visual-only.mp4");
    const renderedOutputPath = join(tempDir, "rendered-output.mp4");
    await writeFile(
      concatPath,
      clipPaths.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"),
      "utf8"
    );
    await execFileAsync("ffmpeg", [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-an",
      "-c",
      "copy",
      "-movflags",
      "+faststart",
      videoOnlyPath
    ], { maxBuffer: 15 * 1024 * 1024 });
    const captionsPath = join(tempDir, "captions.ass");
    const captions = input.kineticSubtitleWords ? buildLongformKineticSubtitleAss({
      words: input.kineticSubtitleWords,
      durationMs,
      width: WIDTH,
      height: HEIGHT
    }).ass : buildLongformCaptionsAss(sortedBeats, durationMs);
    await writeFile(captionsPath, captions, "utf8");
    const captionFilterPath = captionsPath.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      videoOnlyPath,
      "-i",
      sourceVideoPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-vf",
      `subtitles='${captionFilterPath}'`,
      "-t",
      (targetFrames / FPS).toFixed(3),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "17",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(FPS),
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      renderedOutputPath
    ], { maxBuffer: 15 * 1024 * 1024 });
    const outputProbe = await probeVideo(renderedOutputPath);
    const video = outputProbe.streams.find((stream) => stream.codec_type === "video");
    const sourceAudio = sourceProbe.streams.find((stream) => stream.codec_type === "audio");
    const outputAudio = outputProbe.streams.find((stream) => stream.codec_type === "audio");
    if (video?.codec_name !== "h264" || video.width !== WIDTH || video.height !== HEIGHT || video.r_frame_rate !== `${FPS}/1`) {
      throw new Error("Long-form pilot failed 1920x1080 30 FPS H.264 validation");
    }
    if (!sourceAudio || outputAudio?.codec_name !== sourceAudio.codec_name) {
      throw new Error("Long-form pilot did not preserve the source audio codec");
    }
    const output = await readFile(renderedOutputPath);
    await copyFile(renderedOutputPath, outputPath, constants.COPYFILE_EXCL);
    return {
      outputPath,
      durationMs: Math.round(outputProbe.durationSeconds * 1e3),
      beatCount: sortedBeats.length,
      bytes: output.length
    };
  } catch (error) {
    throw new Error(`Long-form visual render failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
async function renderCoinOverviewLongPumpDynamicVideo(input) {
  if (!input.beats.length) throw new Error("Pump-dynamic render requires at least one voice-timed visual beat");
  const durationMs = Math.round(input.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < 1e3) {
    throw new Error("Pump-dynamic render duration must be at least one second");
  }
  const sourceVideoPath = resolve(input.sourceVideoPath);
  await access(sourceVideoPath);
  const sourceProbe = await probeVideo(sourceVideoPath);
  if (!sourceProbe.streams.some((stream) => stream.codec_type === "audio")) {
    throw new Error("Pump-dynamic pilot source does not contain an audio stream");
  }
  if (sourceProbe.durationSeconds * 1e3 < durationMs) {
    throw new Error("Pump-dynamic pilot source is shorter than the requested duration");
  }
  const visualAssets = Object.fromEntries(
    Object.entries(input.visualAssets).map(([name, path]) => [name, resolve(path)])
  );
  await Promise.all(Object.values(visualAssets).map((path) => access(path)));
  const outputPath = resolve(input.outputPath);
  if (sourceVideoPath === outputPath) {
    throw new Error("Pump-dynamic pilot output must not overwrite its source video");
  }
  try {
    await access(outputPath);
    throw new Error(`Refusing to overwrite an existing pump-dynamic pilot: ${outputPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "pump-dynamic-pilot-"));
  try {
    const targetFrames = Math.round(durationMs * FPS / 1e3);
    const renderedDuration = (targetFrames / FPS).toFixed(3);
    const renderedDurationSeconds = Number(renderedDuration);
    const sortedBeats = [...input.beats].sort((left, right) => left.startMs - right.startMs);
    const captions = buildCoinOverviewLongScribeCaptions({
      words: input.kineticSubtitleWords,
      beats: sortedBeats,
      durationMs,
      width: WIDTH,
      height: HEIGHT,
      paletteMode: "pump-dynamic"
    });
    const captionsPath = join(tempDir, "pump-dynamic-captions.ass");
    const graphPath = join(tempDir, "pump-dynamic-filter.txt");
    const videoOnlyPath = join(tempDir, "pump-dynamic-video.mp4");
    const renderedOutputPath = join(tempDir, "pump-dynamic-output.mp4");
    const captionFilterPath = captionsPath.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
    await writeFile(captionsPath, captions.ass, "utf8");
    const sceneRatios = [0, 5 / 30, 10 / 30, 15 / 30, 20 / 30, 27 / 30, 1];
    const sceneBoundaries = sceneRatios.map((ratio) => renderedDurationSeconds * ratio);
    const overlayInputs = [
      { inputIndex: 1, label: "phone", start: sceneBoundaries[0], end: sceneBoundaries[1] },
      { inputIndex: 2, label: "intro", start: sceneBoundaries[0], end: sceneBoundaries[1] },
      { inputIndex: 3, label: "market", start: sceneBoundaries[1], end: sceneBoundaries[2] },
      { inputIndex: 4, label: "hype", start: sceneBoundaries[2], end: sceneBoundaries[3] },
      { inputIndex: 5, label: "risk", start: sceneBoundaries[3], end: sceneBoundaries[4] },
      { inputIndex: 6, label: "exchange", start: sceneBoundaries[4], end: sceneBoundaries[5] },
      { inputIndex: 7, label: "contract", start: sceneBoundaries[5], end: sceneBoundaries[6] }
    ];
    const filterGraph = [
      `[1:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},zoompan=z='min(zoom+0.00032,1.08)':x='iw/2-iw/zoom/2+9*sin(on/90)':y='ih/2-ih/zoom/2+6*sin(on/105)':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS},setsar=1[phone]`,
      `[0:v][phone]overlay=0:0:enable='gte(t,${sceneBoundaries[0].toFixed(3)})*lt(t,${sceneBoundaries[1].toFixed(3)})'[bg0]`,
      `[bg0][2:v]overlay=0:0:format=auto:enable='gte(t,${sceneBoundaries[0].toFixed(3)})*lt(t,${sceneBoundaries[1].toFixed(3)})'[bg1]`,
      ...overlayInputs.slice(2).map((scene, index) => {
        const sourceLabel = `bg${index + 1}`;
        const outputLabel = `bg${index + 2}`;
        return `[${sourceLabel}][${scene.inputIndex}:v]overlay=0:0:enable='gte(t,${scene.start.toFixed(3)})*lt(t,${scene.end.toFixed(3)})'[${outputLabel}]`;
      }),
      `[bg6]${buildPumpDynamicMotionFilters(sceneBoundaries).join(",")},subtitles='${captionFilterPath}'[pump_dynamic]`
    ];
    await writeFile(graphPath, filterGraph.join(";\n"), "utf8");
    const visualInputPaths = [
      visualAssets.photoBackgroundPath,
      visualAssets.introOverlayPath,
      visualAssets.marketBackgroundPath,
      visualAssets.hypeBackgroundPath,
      visualAssets.riskBackgroundPath,
      visualAssets.exchangeBackgroundPath,
      visualAssets.contractBackgroundPath
    ];
    const renderArgs = [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x10131b:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${renderedDuration}`,
      ...visualInputPaths.flatMap((path) => [
        "-loop",
        "1",
        "-framerate",
        String(FPS),
        "-i",
        path
      ]),
      "-filter_complex_script",
      graphPath,
      "-map",
      "[pump_dynamic]",
      "-t",
      renderedDuration,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "17",
      "-pix_fmt",
      "yuv420p",
      "-r",
      String(FPS),
      "-movflags",
      "+faststart",
      videoOnlyPath
    ];
    await execFileAsync("ffmpeg", renderArgs, { maxBuffer: 20 * 1024 * 1024 });
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      videoOnlyPath,
      "-i",
      sourceVideoPath,
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-t",
      renderedDuration,
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      renderedOutputPath
    ], { maxBuffer: 20 * 1024 * 1024 });
    const outputProbe = await probeVideo(renderedOutputPath);
    const video = outputProbe.streams.find((stream) => stream.codec_type === "video");
    const sourceAudio = sourceProbe.streams.find((stream) => stream.codec_type === "audio");
    const outputAudio = outputProbe.streams.find((stream) => stream.codec_type === "audio");
    if (video?.codec_name !== "h264" || video.width !== WIDTH || video.height !== HEIGHT || video.r_frame_rate !== `${FPS}/1`) {
      throw new Error("Pump-dynamic pilot failed 1920x1080 30 FPS H.264 validation");
    }
    if (!sourceAudio || outputAudio?.codec_name !== sourceAudio.codec_name) {
      throw new Error("Pump-dynamic pilot did not preserve the source audio codec");
    }
    if (Math.abs(outputProbe.durationSeconds - renderedDurationSeconds) > 0.1) {
      throw new Error("Pump-dynamic pilot duration does not match the requested render length");
    }
    const output = await readFile(renderedOutputPath);
    await copyFile(renderedOutputPath, outputPath, constants.COPYFILE_EXCL);
    return {
      outputPath,
      durationMs: Math.round(outputProbe.durationSeconds * 1e3),
      beatCount: sortedBeats.length,
      bytes: output.length
    };
  } catch (error) {
    throw new Error(`Pump-dynamic render failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

// scripts/render-kinetic-subtitle-pilot.ts
var execFileAsync2 = promisify2(execFile2);
function field(row, camelCase, snakeCase) {
  return row[camelCase] ?? row[snakeCase];
}
function isAvailable(path) {
  return access2(path).then(() => true, () => false);
}
async function main() {
  const projectId = Number(process.argv[2] ?? 85);
  const durationMs = Number(process.argv[3] ?? 45e3);
  const sourceVideoPath = resolve2(
    process.argv[4] ?? "../../attached_assets/generated_video/coin-overview-long/hype-overview-final.mp4"
  );
  const outputPath = resolve2(
    process.argv[5] ?? "../../attached_assets/generated_video/coin-overview-long/hype-overview-kinetic-subtitles-45s-test.mp4"
  );
  const apiBase = process.argv[6] ?? "http://127.0.0.1:8080";
  const planPath = resolve2(
    process.argv[7] ?? "../../attached_assets/generated_video/coin-overview-long/hype-overview-final-new-visual-45s.mp4.plan.json"
  );
  const reusableAlignmentPath = process.argv[8] ? resolve2(process.argv[8]) : void 0;
  const pumpDynamic = process.argv[9] === "pump-dynamic";
  const pumpDynamicAssetsDir = resolve2(
    process.argv[10] ?? "../../attached_assets/generated_images/hype-pump-style-storyboard-v1/backgrounds"
  );
  const alignmentPath = `${outputPath}.alignment.json`;
  if (projectId !== 85) throw new Error("This isolated kinetic subtitle pilot is scoped to HYPE project 85.");
  if (!Number.isInteger(durationMs) || durationMs < 3e4 || durationMs > 6e4) {
    throw new Error("Kinetic subtitle pilot duration must be between 30 and 60 seconds.");
  }
  if (sourceVideoPath === outputPath) {
    throw new Error("Kinetic subtitle pilot output must not overwrite its source video.");
  }
  if (await isAvailable(outputPath)) {
    throw new Error(`Refusing to overwrite existing kinetic subtitle pilot: ${outputPath}`);
  }
  if (await isAvailable(alignmentPath)) {
    throw new Error(`Refusing to overwrite existing subtitle alignment report: ${alignmentPath}`);
  }
  const sourceInfo = await stat(sourceVideoPath);
  if (!sourceInfo.isFile()) throw new Error(`Source video is not a regular file: ${sourceVideoPath}`);
  const voiceResponse = await fetch(new URL(`/api/projects/${projectId}/voice`, apiBase));
  if (!voiceResponse.ok) throw new Error(`Could not load project ${projectId} narration (${voiceResponse.status}).`);
  const rows = await voiceResponse.json();
  if (!Array.isArray(rows)) throw new Error("Project voice endpoint returned an invalid response.");
  const voices = rows.filter(
    (row) => row.status === "completed" && field(row, "isActive", "is_active") === true && field(row, "isFullVoice", "is_full_voice") !== true && typeof row.text === "string" && Number.isFinite(field(row, "startTime", "start_time")) && Number.isFinite(field(row, "endTime", "end_time"))
  ).map((row) => ({
    sceneId: Number(field(row, "sceneId", "scene_id")),
    text: String(row.text),
    startTime: Number(field(row, "startTime", "start_time")),
    endTime: Number(field(row, "endTime", "end_time")),
    isFullVoice: false
  })).filter((voice) => voice.startTime < durationMs && voice.endTime > voice.startTime).sort((left, right) => left.startTime - right.startTime);
  if (!voices.length) throw new Error(`Project ${projectId} has no completed timed narration in the pilot range.`);
  const tempDir = await mkdtemp2(resolve2(tmpdir2(), "kinetic-subtitle-pilot-"));
  try {
    let alignment;
    if (reusableAlignmentPath) {
      const savedAlignment = JSON.parse(await readFile2(reusableAlignmentPath, "utf8"));
      if (savedAlignment.projectId !== projectId || savedAlignment.durationMs !== durationMs || savedAlignment.sourceVideoPath !== sourceVideoPath || !Array.isArray(savedAlignment.words) || !savedAlignment.words.length) {
        throw new Error(`Saved subtitle alignment does not match this pilot: ${reusableAlignmentPath}`);
      }
      alignment = {
        words: savedAlignment.words,
        expectedWordCount: Number(savedAlignment.expectedWordCount),
        matchedWordCount: Number(savedAlignment.matchedWordCount),
        interpolatedWordCount: Number(savedAlignment.interpolatedWordCount),
        matchCoverage: Number(savedAlignment.matchCoverage)
      };
      console.log(JSON.stringify({
        event: "longform-kinetic-subtitle-alignment-resumed",
        reusableAlignmentPath,
        words: alignment.words.length,
        matchCoverage: alignment.matchCoverage
      }));
    } else {
      const speechPath = resolve2(tempDir, "speech-for-alignment.mp3");
      await execFileAsync2("ffmpeg", [
        "-y",
        "-i",
        sourceVideoPath,
        "-t",
        (durationMs / 1e3).toFixed(3),
        "-map",
        "0:a:0",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-c:a",
        "libmp3lame",
        "-b:a",
        "64k",
        speechPath
      ], { maxBuffer: 10 * 1024 * 1024 });
      const transcription = await transcribeSpeechWithTimestamps(
        await readFile2(speechPath),
        "hype-kinetic-subtitle-pilot.mp3"
      );
      alignment = alignKineticSubtitleWords({
        voices,
        transcriptWords: transcription.words,
        durationMs
      });
    }
    const subtitlePlan = pumpDynamic ? buildCoinOverviewLongScribeCaptions({
      words: alignment.words,
      durationMs,
      width: 1920,
      height: 1080,
      paletteMode: "pump-dynamic"
    }) : buildLongformKineticSubtitleAss({
      words: alignment.words,
      durationMs,
      width: 1920,
      height: 1080
    });
    if (subtitlePlan.maxWordsPerPhrase > 5) {
      throw new Error("Kinetic subtitle phrase exceeded the five-word limit.");
    }
    const result = pumpDynamic ? await renderCoinOverviewLongPumpDynamicVideo({
      beats: buildCoinOverviewLongPhraseBeats({
        voices: voices.map((voice, index) => ({
          sceneId: voice.sceneId ?? index + 1,
          startTime: voice.startTime,
          endTime: voice.endTime,
          text: voice.text,
          isFullVoice: false
        })),
        durationMs
      }),
      durationMs,
      sourceVideoPath,
      outputPath,
      kineticSubtitleWords: alignment.words,
      visualAssets: {
        photoBackgroundPath: join2(pumpDynamicAssetsDir, "intro-phone-16x9.png"),
        introOverlayPath: join2(pumpDynamicAssetsDir, "intro-orbit-overlay.png"),
        marketBackgroundPath: join2(pumpDynamicAssetsDir, "market-diagonal.png"),
        hypeBackgroundPath: join2(pumpDynamicAssetsDir, "hype-token-focus.png"),
        riskBackgroundPath: join2(pumpDynamicAssetsDir, "risk-icon-selection.png"),
        exchangeBackgroundPath: join2(pumpDynamicAssetsDir, "exchange-network.png"),
        contractBackgroundPath: join2(pumpDynamicAssetsDir, "contract-loop.png")
      }
    }) : await (async () => {
      const savedPlan = JSON.parse(await readFile2(planPath, "utf8"));
      if (savedPlan.projectId !== projectId || savedPlan.durationMs !== durationMs || savedPlan.sourceVideoPath !== sourceVideoPath) {
        throw new Error(`Existing visual plan does not match this pilot's source and duration: ${planPath}`);
      }
      const beats = validateLongformVisualPlan(
        buildLongformMicroBeats({ voices, durationMs }),
        { beats: savedPlan.beats }
      );
      return renderLongformVisualVideo({
        beats,
        durationMs,
        sourceVideoPath,
        outputPath,
        kineticSubtitleWords: alignment.words
      });
    })();
    await writeFile2(alignmentPath, JSON.stringify({
      projectId,
      durationMs,
      sourceVideoPath,
      outputPath,
      timingSource: "ElevenLabs Scribe word timestamps aligned to approved project narration",
      renderStyle: pumpDynamic ? "pump-dynamic-approved-storyboard-v1" : "longform-kinetic-subtitles",
      expectedWordCount: alignment.expectedWordCount,
      matchedWordCount: alignment.matchedWordCount,
      interpolatedWordCount: alignment.interpolatedWordCount,
      matchCoverage: alignment.matchCoverage,
      phraseCount: subtitlePlan.phraseCount,
      maxWordsPerPhrase: subtitlePlan.maxWordsPerPhrase,
      words: alignment.words
    }, null, 2), { encoding: "utf8", flag: "wx" });
    console.log(JSON.stringify({
      ...result,
      pilot: pumpDynamic ? "pump-dynamic-approved-storyboard-v1" : "longform-kinetic-subtitles",
      projectId,
      planPath,
      alignmentPath,
      subtitleAlignment: {
        expectedWordCount: alignment.expectedWordCount,
        matchedWordCount: alignment.matchedWordCount,
        interpolatedWordCount: alignment.interpolatedWordCount,
        matchCoverage: Number(alignment.matchCoverage.toFixed(4)),
        phraseCount: subtitlePlan.phraseCount,
        maxWordsPerPhrase: subtitlePlan.maxWordsPerPhrase,
        animationPresets: pumpDynamic ? 6 : 5
      },
      sourceAudioPolicy: "Copied from source MP4 with -c:a copy"
    }, null, 2));
  } finally {
    await rm2(tempDir, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});
