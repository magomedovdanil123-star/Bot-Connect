import {
  cryptoF2WarningBoundaryIsSafe,
  findCryptoF2ProtectedWarnings,
} from "./crypto-f2-warning";

export const MAX_CRYPTO_CUSTOM_SCRIPT_CHARACTERS = 3_500;

const MIN_SCRIPT_WORDS = 30;
const MIN_SCENES = 6;
const MAX_SCENES = 12;
const MIN_WORDS_PER_SCENE = 4;

export type ParsedCryptoCustomScript = {
  topic: string;
  script: string;
};

export function parseCryptoCustomScriptMessage(
  input: string,
  maxTopicLength: number,
): ParsedCryptoCustomScript {
  const message = input.replace(/\r\n?/gu, "\n").trim();
  if (!message) throw new Error("Пришлите тему и сценарий одним сообщением.");
  if (message.length > MAX_CRYPTO_CUSTOM_SCRIPT_CHARACTERS) {
    throw new Error(`Сообщение слишком длинное. Лимит — ${MAX_CRYPTO_CUSTOM_SCRIPT_CHARACTERS} символов.`);
  }

  const lines = message.split("\n");
  const topicHeader = lines[0]?.match(/^тема\s*:\s*(.*)$/iu);
  let topic = "";
  let script = message;

  if (topicHeader) {
    topic = topicHeader[1]!.trim();
    script = lines.slice(1).join("\n").trim();
    script = script.replace(/^(?:сценарий|текст)\s*:\s*/iu, "").trim();
  } else {
    script = script.replace(/^(?:сценарий|текст)\s*:\s*/iu, "").trim();
    const firstLine = script.split("\n", 1)[0]?.trim() || script;
    const firstSentence = firstLine.match(/^.{1,180}?[.!?…](?=\s|$)/u)?.[0];
    topic = (firstSentence || firstLine).slice(0, maxTopicLength).trim();
  }

  if (!topic) {
    throw new Error("Укажите короткую тему первой строкой: «Тема: …». Или пришлите сценарий с понятной первой фразой.");
  }
  if (topic.length > maxTopicLength) {
    throw new Error(`Тема слишком длинная. Максимум ${maxTopicLength} символов.`);
  }
  if (!script) {
    throw new Error("После строки «Тема: …» добавьте текст сценария.");
  }
  if ((script.match(/[\p{L}\p{N}]+/gu) ?? []).length < MIN_SCRIPT_WORDS) {
    throw new Error(`Сценарий слишком короткий. Отправьте не менее ${MIN_SCRIPT_WORDS} слов, чтобы разделить его на сцены.`);
  }

  return {
    topic: topic.replace(/\s+/gu, " "),
    script: script.replace(/\s+/gu, " "),
  };
}

export function splitVerbatimCryptoScript(scriptInput: string): string[] {
  const tokens = scriptInput.trim().replace(/\s+/gu, " ").split(" ").filter(Boolean);
  const tokenWordCounts = tokens.map((token) =>
    token.match(/[\p{L}\p{N}]+/gu)?.length ?? 0);
  const tokenWordOffsets = [0];
  for (const wordCount of tokenWordCounts) {
    tokenWordOffsets.push(tokenWordOffsets.at(-1)! + wordCount);
  }
  const totalWordCount = tokenWordOffsets.at(-1)!;
  if (totalWordCount < MIN_SCRIPT_WORDS) {
    throw new Error(`Сценарий слишком короткий. Нужно не менее ${MIN_SCRIPT_WORDS} слов.`);
  }

  const sceneCount = Math.min(MAX_SCENES, Math.max(MIN_SCENES, Math.ceil(totalWordCount / 30)));
  const protectedWarnings = findCryptoF2ProtectedWarnings(tokens.join(" "));
  const isSafeBoundary = (boundary: number) =>
    cryptoF2WarningBoundaryIsSafe(protectedWarnings, boundary);
  const scenes: string[] = [];
  let startToken = 0;

  for (let sceneIndex = 0; sceneIndex < sceneCount; sceneIndex += 1) {
    const remainingScenes = sceneCount - sceneIndex - 1;
    const startWord = tokenWordOffsets[startToken]!;
    const minEndWord = startWord + MIN_WORDS_PER_SCENE;
    const maxEndWord = totalWordCount - remainingScenes * MIN_WORDS_PER_SCENE;
    const targetEndWord = Math.round((sceneIndex + 1) * totalWordCount / sceneCount);
    let endToken = tokens.length;

    if (remainingScenes > 0) {
      const maxBoundaryDistance = Math.max(5, Math.ceil(totalWordCount / sceneCount * 0.6));
      const sentenceBoundaries: number[] = [];
      const safeBoundaries: number[] = [];
      for (let boundary = startToken + 1; boundary < tokens.length; boundary += 1) {
        const wordBoundary = tokenWordOffsets[boundary]!;
        if (
          wordBoundary < minEndWord
          || wordBoundary > maxEndWord
          || tokenWordCounts[boundary - 1] === 0
          || tokenWordCounts[boundary] === 0
          || !isSafeBoundary(wordBoundary)
        ) {
          continue;
        }
        safeBoundaries.push(boundary);
        if (
          /[.!?…]["'»)\]]*$/u.test(tokens[boundary - 1] || "")
        ) {
          sentenceBoundaries.push(boundary);
        }
      }
      const nearbyBoundaries = sentenceBoundaries.filter(
        (boundary) => Math.abs(tokenWordOffsets[boundary]! - targetEndWord) <= maxBoundaryDistance,
      );
      const availableBoundaries = nearbyBoundaries.length ? nearbyBoundaries : safeBoundaries;
      if (availableBoundaries.length) {
        endToken = availableBoundaries.reduce((closest, candidate) =>
          Math.abs(tokenWordOffsets[candidate]! - targetEndWord)
            < Math.abs(tokenWordOffsets[closest]! - targetEndWord)
            ? candidate
            : closest,
        );
      } else {
        throw new Error(
          "Не удаётся разделить сценарий на сцены, не разрывая предупреждение. Добавьте текст или уточните формулировку.",
        );
      }
    }

    scenes.push(tokens.slice(startToken, endToken).join(" "));
    startToken = endToken;
  }

  return scenes;
}