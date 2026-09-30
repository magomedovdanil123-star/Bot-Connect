import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { transcribeSpeechWithTimestamps } from "../../src/lib/audio-generation/elevenlabs-client";

const root = resolve(process.cwd(), "../..");
const outputDir = resolve(root, "attached_assets/generated_audio/pump-film-2026-09-30");
const voicePath = resolve(outputDir, "pump-film-voice.mp3");
const scriptPath = resolve(root, "research/pump-film-script.json");
const alignmentPath = resolve(outputDir, "alignment.json");

type Scene = {
  scene_number: number;
  voice_text: string;
};

type Script = {
  scenes: Scene[];
};

type ScriptToken = {
  value: string;
  normalized: string;
  scene_number: number;
  sentence_number: number;
};

type SentenceTiming = {
  scene_number: number;
  sentence_number: number;
  text: string;
  start: number;
  end: number;
  matched_words: number;
};

function normalizeToken(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/ё/gu, "е").replace(/[^\p{L}\p{N}]/gu, "");
}

function levenshteinDistance(left: string, right: string): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0]!;
    previous[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j]!;
      previous[j] = Math.min(
        previous[j]! + 1,
        previous[j - 1]! + 1,
        diagonal + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[right.length]!;
}

function substitutionCost(left: string, right: string): number {
  if (left === right) return 0;
  if (!left || !right) return 1;
  if ((left.includes(right) || right.includes(left)) && Math.min(left.length, right.length) >= 4) return 0.25;
  if (left[0] !== right[0] || Math.abs(left.length - right.length) > 2) return 1;
  const ratio = levenshteinDistance(left, right) / Math.max(left.length, right.length);
  return ratio <= 0.28 ? 0.25 + ratio : 1;
}

function scriptTokenize(script: Script): { tokens: ScriptToken[]; sentences: Array<Omit<SentenceTiming, "start" | "end" | "matched_words"> & { startToken: number; endToken: number }> } {
  const tokens: ScriptToken[] = [];
  const sentences: Array<Omit<SentenceTiming, "start" | "end" | "matched_words"> & { startToken: number; endToken: number }> = [];
  for (const scene of script.scenes) {
    const sentenceParts: string[] = [];
    let sentenceStart = 0;
    for (let index = 0; index < scene.voice_text.length; index += 1) {
      const character = scene.voice_text[index]!;
      if (character !== "." && character !== "!" && character !== "?") continue;
      const previous = scene.voice_text[index - 1] || "";
      const next = scene.voice_text[index + 1] || "";
      const periodInsideWord = character === "."
        && /[\p{L}\p{N}]/u.test(previous)
        && /[\p{L}\p{N}]/u.test(next);
      const decimalPoint = character === "." && /\d/u.test(previous) && /\d/u.test(next);
      if (periodInsideWord || decimalPoint) continue;

      let afterPunctuation = index + 1;
      while (afterPunctuation < scene.voice_text.length && /["'»”’)\]]/u.test(scene.voice_text[afterPunctuation]!)) {
        afterPunctuation += 1;
      }
      if (afterPunctuation < scene.voice_text.length && !/\s/u.test(scene.voice_text[afterPunctuation]!)) {
        continue;
      }
      sentenceParts.push(scene.voice_text.slice(sentenceStart, afterPunctuation));
      sentenceStart = afterPunctuation;
      index = afterPunctuation - 1;
    }
    if (sentenceStart < scene.voice_text.length) {
      sentenceParts.push(scene.voice_text.slice(sentenceStart));
    }
    for (const [sentenceIndex, part] of sentenceParts.entries()) {
      const sentenceText = part.trim();
      const firstToken = tokens.length;
      const matches = sentenceText.match(/[\p{L}\p{N}]+/gu) || [];
      for (const value of matches) {
        tokens.push({
          value,
          normalized: normalizeToken(value),
          scene_number: scene.scene_number,
          sentence_number: sentenceIndex + 1,
        });
      }
      if (tokens.length > firstToken) {
        sentences.push({
          scene_number: scene.scene_number,
          sentence_number: sentenceIndex + 1,
          text: sentenceText,
          startToken: firstToken,
          endToken: tokens.length - 1,
        });
      }
    }
  }
  return { tokens, sentences };
}

function alignScriptToRecognizedWords(
  scriptTokens: ScriptToken[],
  recognizedWords: Array<{ text: string; start: number; end: number }>,
): { mapping: Array<number | null>; matchedCount: number } {
  const n = scriptTokens.length;
  const m = recognizedWords.length;
  const width = m + 1;
  const costs = new Float32Array((n + 1) * width);
  const operations = new Uint8Array((n + 1) * width);
  for (let i = 1; i <= n; i += 1) {
    costs[i * width] = i;
    operations[i * width] = 2;
  }
  for (let j = 1; j <= m; j += 1) {
    costs[j] = j;
    operations[j] = 3;
  }

  const recognizedTokens = recognizedWords.map((word) => normalizeToken(word.text));
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const position = i * width + j;
      const diagonalCost = costs[(i - 1) * width + j - 1]!
        + substitutionCost(scriptTokens[i - 1]!.normalized, recognizedTokens[j - 1]!);
      const deletionCost = costs[(i - 1) * width + j]! + 1;
      const insertionCost = costs[i * width + j - 1]! + 1;
      if (diagonalCost <= deletionCost && diagonalCost <= insertionCost) {
        costs[position] = diagonalCost;
        operations[position] = 1;
      } else if (deletionCost <= insertionCost) {
        costs[position] = deletionCost;
        operations[position] = 2;
      } else {
        costs[position] = insertionCost;
        operations[position] = 3;
      }
    }
  }

  const mapping: Array<number | null> = Array.from({ length: n }, () => null);
  let matchedCount = 0;
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const operation = operations[i * width + j];
    if (operation === 1 && i > 0 && j > 0) {
      const cost = substitutionCost(scriptTokens[i - 1]!.normalized, recognizedTokens[j - 1]!);
      if (cost <= 0.65) {
        mapping[i - 1] = j - 1;
        matchedCount += 1;
      }
      i -= 1;
      j -= 1;
    } else if (operation === 2 && i > 0) {
      i -= 1;
    } else if (operation === 3 && j > 0) {
      j -= 1;
    } else {
      break;
    }
  }
  return { mapping, matchedCount };
}

async function main(): Promise<void> {
  const reuseTranscript = process.argv.includes("--reuse");
  const previousAlignment = reuseTranscript
    ? JSON.parse(await readFile(alignmentPath, "utf8")) as {
        audio_duration_seconds: number;
        transcript: string;
        words: Array<{ text: string; start?: number; end?: number; type?: string }>;
      }
    : undefined;
  const result = previousAlignment
    ? { text: previousAlignment.transcript, words: previousAlignment.words }
    : await transcribeSpeechWithTimestamps(await readFile(voicePath), "pump-film-voice.mp3");
  const manifest = previousAlignment
    ? { duration_seconds: previousAlignment.audio_duration_seconds }
    : JSON.parse(await readFile(resolve(outputDir, "voice.json"), "utf8")) as { duration_seconds: number };
  const script = JSON.parse(await readFile(scriptPath, "utf8")) as Script;
  const timedWords = result.words.filter(
    (word) => typeof word.start === "number" && typeof word.end === "number",
  );
  const lastWordEnd = timedWords.reduce((latest, word) => Math.max(latest, word.end || 0), 0);
  if (!timedWords.length || lastWordEnd <= 0) {
    throw new Error("Speech recognition returned no usable word-level timestamps");
  }
  const { tokens, sentences: sentenceRanges } = scriptTokenize(script);
  const { mapping, matchedCount } = alignScriptToRecognizedWords(tokens, timedWords);
  const sentences: SentenceTiming[] = sentenceRanges.map((sentence) => {
    const matched = mapping
      .slice(sentence.startToken, sentence.endToken + 1)
      .flatMap((wordIndex) => wordIndex === null ? [] : [timedWords[wordIndex]!]);
    if (!matched.length) {
      throw new Error(`Could not align scene ${sentence.scene_number}, sentence ${sentence.sentence_number}`);
    }
    return {
      scene_number: sentence.scene_number,
      sentence_number: sentence.sentence_number,
      text: sentence.text,
      start: matched[0]!.start!,
      end: matched[matched.length - 1]!.end!,
      matched_words: matched.length,
    };
  });

  await writeFile(alignmentPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    provider: "elevenlabs-scribe-v2",
    granularity: "word",
    audio_duration_seconds: manifest.duration_seconds,
    transcript_duration_seconds: lastWordEnd,
    transcript: result.text,
    script_alignment: {
      script_word_count: tokens.length,
      matched_script_words: matchedCount,
      match_ratio: Number((matchedCount / tokens.length).toFixed(4)),
    },
    sentences,
    words: timedWords,
  }, null, 2), "utf8");
  console.log(JSON.stringify({
    alignment: alignmentPath,
    words: timedWords.length,
    sentences: sentences.length,
    scriptMatch: `${matchedCount}/${tokens.length}`,
    matchRatio: Number((matchedCount / tokens.length).toFixed(4)),
    transcriptMinutes: Number((lastWordEnd / 60).toFixed(2)),
    audioMinutes: Number((manifest.duration_seconds / 60).toFixed(2)),
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown speech alignment error");
  process.exitCode = 1;
});