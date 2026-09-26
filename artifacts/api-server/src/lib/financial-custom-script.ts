export const MAX_CRYPTO_CUSTOM_SCRIPT_CHARACTERS = 3_500;

const MIN_SCRIPT_WORDS = 30;
const MIN_SCENES = 6;
const MAX_SCENES = 12;
const MIN_WORDS_PER_SCENE = 5;

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
  const words = scriptInput.trim().replace(/\s+/gu, " ").split(" ").filter(Boolean);
  if (words.length < MIN_SCENES * MIN_WORDS_PER_SCENE) {
    throw new Error(`Сценарий слишком короткий. Нужно не менее ${MIN_SCENES * MIN_WORDS_PER_SCENE} слов.`);
  }

  const sceneCount = Math.min(MAX_SCENES, Math.max(MIN_SCENES, Math.ceil(words.length / 30)));
  const scenes: string[] = [];
  let start = 0;

  for (let sceneIndex = 0; sceneIndex < sceneCount; sceneIndex += 1) {
    const remainingScenes = sceneCount - sceneIndex - 1;
    const minEnd = start + MIN_WORDS_PER_SCENE;
    const maxEnd = words.length - remainingScenes * MIN_WORDS_PER_SCENE;
    const targetEnd = Math.round((sceneIndex + 1) * words.length / sceneCount);
    let end = Math.max(minEnd, Math.min(maxEnd, targetEnd));

    if (remainingScenes > 0) {
      const maxBoundaryDistance = Math.max(5, Math.ceil(words.length / sceneCount * 0.6));
      const sentenceBoundaries: number[] = [];
      for (let boundary = minEnd; boundary <= maxEnd; boundary += 1) {
        if (/[.!?…]["'»)\]]*$/u.test(words[boundary - 1] || "")) {
          sentenceBoundaries.push(boundary);
        }
      }
      const nearbyBoundaries = sentenceBoundaries.filter(
        (boundary) => Math.abs(boundary - targetEnd) <= maxBoundaryDistance,
      );
      if (nearbyBoundaries.length) {
        end = nearbyBoundaries.reduce((closest, candidate) =>
          Math.abs(candidate - targetEnd) < Math.abs(closest - targetEnd) ? candidate : closest,
        );
      }
    }

    scenes.push(words.slice(start, end).join(" "));
    start = end;
  }

  return scenes;
}