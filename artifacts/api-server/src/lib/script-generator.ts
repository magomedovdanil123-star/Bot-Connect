import { z } from "zod";
import { openRouterConfig } from "./openrouter-config";
import { CONTINUITY_EDITOR_RULES_RU } from "./story-rules";

const sceneSchema = z.object({
  scene_number: z.coerce.number().int().positive(),
  duration_seconds: z.coerce.number().int().positive(),
  voice_text: z.string().min(1),
  visual_description: z.string().min(1),
  image_prompt: z.string().min(1),
  scene_purpose: z.string().default(""),
  story_beat: z.string().default(""),
  cause: z.string().default(""),
  action: z.string().default(""),
  obstacle: z.string().default(""),
  change: z.string().default(""),
  continuity: z.string().default(""),
  transition: z.string().default(""),
});

export const videoScriptSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  description: z.string().min(1),
  duration_seconds: z.coerce.number().int().positive(),
  scenes: z.array(sceneSchema).min(1),
  ending: z.string(),
  cta: z.string(),
});

export type VideoScript = z.infer<typeof videoScriptSchema>;

export type ScriptRequest = {
  topic: string;
  format: string;
  duration: number;
  style: string;
  tone: string;
  instructions?: string | null;
  editorialProfile?: "coin-history-documentary";
  antiRepetition?: boolean;
  minimumScenes?: number;
  finalSceneMode?: "narrative" | "forecast";
  allowRecoverableValidationFallback?: boolean;
};

export type YoutubeMetadataVariant = {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
};

export const MAX_SCRIPT_DURATION_SECONDS = 180;

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
      reasoning?: string | null;
    };
    finish_reason?: string | null;
  }>;
  error?: {
    message?: string;
  };
  model?: string;
  usage?: {
    completion_tokens?: number;
  };
};

async function waitBeforeProviderRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
}

const systemPrompt = [
  "Ты профессиональный сценарист коротких вертикальных видео для Shorts, Reels и TikTok.",
  "Главная задача — удержание внимания зрителя от первой секунды до финала.",
  "Не используй скучные вступления вроде «Сегодня я расскажу вам историю». Не добавляй воду: каждая сцена должна двигать историю вперёд.",
  "Пиши разговорным естественным языком, который хорошо звучит при озвучке человеком или AI.",
  "Для жизненных историй выбирай конкретные действия и наблюдения вместо загадок, пафоса и трейлерных фраз. Не превращай обычную работу, поездку или разговор в триллер без прямой просьбы автора.",
  "Для сериалов оформляй содержание как полноценный киносценарий: заголовок серии, конкретные место и время, последовательные сцены, наблюдаемые действия, естественные реплики персонажей, паузы, кульминация и подготовленный финал. Не пиши набор рекламных кадров или случайных описаний.",
  "Стиль сериалов — как в бытовом киносценарии пользователя: короткие абзацы действий («Лера поворачивается.», «Телефон вибрирует.»), имя героя отдельной строкой перед репликой («Дима:»), реплика с длинным тире, естественные паузы через многоточие и простая живая речь.",
  "Не пересказывай историю в сокращённом виде и не заменяй последовательность событий общим описанием. Сначала покажи каждое важное действие, затем реакцию, затем реплику или следующий шаг. Сохраняй бытовую интонацию, неловкость, короткие ответы и конкретные детали.",
  "Финал сценария может содержать отдельные строки «КОНЕЦ СЕРИИ», «Текст на экране:» и «Продолжение следует…», если это соответствует структуре сериала. Не прячь их в кратком описании и не удаляй.",
  "Для серии длительностью до 3 минут пиши полный связный текст, рассчитанный на выбранную длительность вплоть до 180 секунд озвучки. Не делай сценарий короче только ради уменьшения количества сцен.",
  "Сцены должны читаться как связная история в стиле бытового сценария: сначала действие и место, затем реплики и реакция героя. Используй реальные улицы, районы, заведения и городские точки, если город задан.",
  "Сначала мысленно выстрой причинно-следственную историю: hook → герой и его цель → событие, которое запускает конфликт → нарастание препятствий → кульминация → последствие и логичный финал. Только после этого разбивай её на сцены.",
  "Каждая следующая сцена обязана быть следствием предыдущей. Не вводи внезапно новых героев, мест или фактов без объяснения.",
  "Не перескакивай между несвязанными образами. Сохраняй одного главного героя, время, место и мотивацию, пока история не завершится.",
  "В конце обязательно разреши главный вопрос, заданный hook. CTA не должен заменять финал истории.",
  "Сначала составь для себя невидимую карту: исходное состояние героя, его цель, препятствие, решение и новое состояние после каждой сцены. Не показывай карту как отдельный анализ, но отрази её в полях сцен.",
  "В каждой сцене должно произойти изменение: герой узнал факт, сделал выбор, столкнулся с препятствием, получил результат или изменил план. Если кадр можно удалить без потери истории, не включай его.",
  "Не пиши сцену как набор атмосферы. Сначала укажи, что герой делает и зачем, затем что ему мешает, затем чем сцена заканчивается и почему следующая сцена становится необходимой.",
  "Не добавляй в последней сцене новые заказы, предметы, людей, сообщения или решения, которых не было в предыдущих сценах. Финальный крючок обязан быть подготовлен конкретной деталью раньше.",
  "voice_text — это полноценная естественная реплика/закадровый текст, а не подпись к картинке. Не повторяй дословно visual_description и image_prompt.",
  "В voice_text помещай только то, что действительно произносится голосом: реплики персонажей и закадровый рассказ. Действия героя, мимику, движения, предметы, заголовки сцен, «КОНЕЦ СЕРИИ», «Текст на экране» и надписи оставляй в visual_description или ending, но не добавляй в voice_text.",
  "visual_description — действие и его наблюдаемое последствие. Image prompt — постановочное описание того же действия с continuity-деталями, а не новый сюжет.",
  "Верни только валидный JSON без markdown, комментариев и текста до или после JSON.",
  "Формат JSON строго такой:",
  JSON.stringify({
    title: "Название ролика",
    hook: "Сильный hook первых 1-3 секунд",
    description: "Краткое описание",
    duration_seconds: 60,
    scenes: [
      {
        scene_number: 1,
        duration_seconds: 5,
        voice_text: "Текст для озвучки",
        visual_description: "Что происходит в сцене",
        image_prompt: "Подробный prompt для будущей генерации изображения",
        scene_purpose: "Зачем эта сцена нужна истории",
        story_beat: "Этап истории: завязка, осложнение, поворот, кульминация, последствие или финальный крючок",
        cause: "Что в предыдущей сцене заставило героя действовать сейчас",
        action: "Конкретное действие героя в этой сцене",
        obstacle: "Что мешает герою или усложняет ситуацию",
        change: "Что изменилось к концу сцены",
        continuity: "Где герой, что у него с собой, время, погода и состояние после предыдущей сцены",
        transition: "Почему следующая сцена должна начаться именно после этой",
      },
    ],
    ending: "Финальная фраза",
    cta: "Призыв к действию или пустая строка",
  }),
  "Сцен должно быть столько, сколько нужно для выбранной длительности. Для 60 секунд ориентируйся на 7-12 сцен, для 90-180 секунд допускай 10-24 коротких сцен.",
  "Ориентиры по структуре: сцены 1-2 показывают героя, цель и запускающее событие; следующие сцены последовательно дают попытку, препятствие и реакцию; перед финалом обязателен поворот или выбор; последние 2 сцены дают кульминацию, последствие и подготовленный крючок.",
  "Каждая сцена обязательно должна содержать voice_text, visual_description, image_prompt, scene_purpose, story_beat, cause, action, obstacle, change, continuity и transition.",
  "Для естественной озвучки используй пунктуацию: запятые для коротких пауз, тире и многоточие для выразительных пауз.",
  "В неоднозначных русских словах можешь ставить знак ударения над гласной (например: зáмок/замóк), но не используй markdown или служебные теги.",
  "Если автор просит точную паузу, допускается маркер [пауза 0.5] в voice_text; он будет обработан перед отправкой в ElevenLabs.",
  "Редакторские правила сериала и continuity:",
  CONTINUITY_EDITOR_RULES_RU,
].join("\n");

const SCRIPT_REQUEST_TIMEOUT_MS = 180_000;

function parseJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Ответ не содержит JSON-объект");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function isScriptRequestTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function removeEmptyTrailingScenes(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.scenes)) return value;
  let lastMeaningfulIndex = candidate.scenes.length - 1;
  while (lastMeaningfulIndex >= 0) {
    const scene = candidate.scenes[lastMeaningfulIndex];
    if (!scene || typeof scene !== "object" || Array.isArray(scene)) break;
    const raw = scene as Record<string, unknown>;
    const duration = Number(raw.duration_seconds);
    const textFields = ["voice_text", "visual_description", "image_prompt"];
    const entirelyEmpty = textFields.every((field) =>
      typeof raw[field] !== "string" || !raw[field].trim(),
    );
    if (duration > 0 || !entirelyEmpty) break;
    lastMeaningfulIndex -= 1;
  }
  if (lastMeaningfulIndex === candidate.scenes.length - 1) return value;
  return { ...candidate, scenes: candidate.scenes.slice(0, lastMeaningfulIndex + 1) };
}

export function repairEmptySceneVoiceText(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.scenes)) return value;
  return {
    ...candidate,
    scenes: candidate.scenes.map((scene, index) => {
      if (!scene || typeof scene !== "object" || Array.isArray(scene)) return scene;
      const raw = scene as Record<string, unknown>;
      if (typeof raw.voice_text === "string" && raw.voice_text.trim()) return scene;
      const fallback = [raw.change, raw.action, raw.scene_purpose, raw.story_beat, raw.visual_description]
        .find((field): field is string => typeof field === "string" && field.trim().length > 0);
      return {
        ...raw,
        voice_text: fallback?.trim() || `Сцена ${index + 1} продолжается.`,
      };
    }),
  };
}

export function isRecoverableScriptValidationError(message: string): boolean {
  return message.startsWith("в озвучке повторяется одна и та же фраза")
    || message.startsWith("смысловое слово ");
}

function validateStoryStructure(
  script: VideoScript,
  duration: number,
  chatMode = false,
  minimumScenes = duration <= 30 ? 4 : 5,
  finalSceneMode: "narrative" | "forecast" = "narrative",
): string | null {
  const sceneNumbers = script.scenes.map((scene) => scene.scene_number);
  if (sceneNumbers.some((number, index) => number !== index + 1)) {
    return "scene_number должен идти последовательно от 1 без пропусков";
  }
  const totalDuration = script.scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0);
  if (totalDuration !== duration) {
    return `сумма duration_seconds сцен должна быть ровно ${duration}, сейчас ${totalDuration}`;
  }
  if (script.scenes.length < minimumScenes) {
    return `слишком мало сцен для связного ролика: нужно минимум ${minimumScenes}`;
  }
  if (chatMode) {
    const chatWordCount = script.scenes.reduce(
      (sum, scene) => sum + scene.voice_text.trim().split(/\s+/).filter(Boolean).length,
      0,
    );
    const maxChatWords = Math.floor(duration * 2.15);
    if (chatWordCount > maxChatWords) {
      return `для чат-переписки слишком много текста: ${chatWordCount} слов, максимум ${maxChatWords} слов для ${duration} секунд`;
    }
  }
  if (script.scenes[0].voice_text.split(/\s+/).filter(Boolean).length < 3) {
    return "первая сцена должна содержать понятный hook";
  }
  const missingEditorialField = script.scenes.find((scene) =>
    !scene.scene_purpose || !scene.story_beat || !scene.action || !scene.change || !scene.continuity || !scene.transition,
  );
  if (missingEditorialField) {
    return `сцена ${missingEditorialField.scene_number} не содержит полную редакторскую карту: нужны scene_purpose, story_beat, action, change, continuity и transition`;
  }
  const lastScene = script.scenes.at(-1);
  if (finalSceneMode === "narrative" && lastScene && !/финал|последств|кульминац|крючок|развязк|выбор|итог|совет|резюме|вывод/i.test(lastScene.story_beat)) {
    return "последняя сцена должна быть кульминацией, последствием, развязкой или подготовленным финальным крючком";
  }
  const previousVoice = new Set<string>();
  for (const scene of script.scenes) {
    const normalized = scene.voice_text.trim().toLocaleLowerCase();
    if (previousVoice.has(normalized)) return `повторяется дословный текст сцены ${scene.scene_number}`;
    previousVoice.add(normalized);
  }
  return null;
}

const HOROSCOPE_REPETITION_STOP_WORDS = new Set([
  "будет", "будут", "вас", "вам", "ваша", "ваше", "ваши", "ваш",
  "день", "дня", "днём", "знак", "знаки", "сегодня", "завтра",
  "может", "нужно", "стоит", "важно", "этот", "эта", "это",
  "когда", "если", "чтобы", "через", "для", "после", "перед",
  "луна", "луны", "вселенной",
  "овен", "телец", "близнецы", "рак", "лев", "дева",
  "весы", "скорпион", "стрелец", "козерог", "водолей", "рыбы",
]);

function validateHoroscopeSpeechRepetition(script: VideoScript): string | null {
  const sceneTokens = script.scenes.map((scene) =>
    (scene.voice_text.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").match(/[а-яa-z0-9]{3,}/g) || []),
  );
  const phraseOccurrences = new Map<string, number>();
  for (const tokens of sceneTokens) {
    const scenePhrases = new Set<string>();
    for (let index = 0; index <= tokens.length - 4; index += 1) {
      const phrase = tokens.slice(index, index + 4).join(" ");
      if (!phrase.split(" ").some((token) => !HOROSCOPE_REPETITION_STOP_WORDS.has(token))) continue;
      scenePhrases.add(phrase);
    }
    for (const phrase of scenePhrases) {
      const count = (phraseOccurrences.get(phrase) || 0) + 1;
      phraseOccurrences.set(phrase, count);
      if (count >= 2) return `в озвучке повторяется одна и та же фраза «${phrase}»; перефразируй прогноз`;
    }
  }

  const wordOccurrences = new Map<string, number>();
  for (const tokens of sceneTokens) {
    for (const token of new Set(tokens)) {
      if (token.length < 5 || HOROSCOPE_REPETITION_STOP_WORDS.has(token)) continue;
      const count = (wordOccurrences.get(token) || 0) + 1;
      wordOccurrences.set(token, count);
      if (count >= 4) return `смысловое слово «${token}» повторяется в озвучке слишком часто; замени часть повторов`;
    }
  }
  return null;
}

function normalizeSceneDurations(script: VideoScript, duration: number): VideoScript {
  const total = script.scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0);
  if (total === duration && script.duration_seconds === duration) return script;

  const scenes = script.scenes.map((scene) => ({ ...scene }));
  let difference = duration - total;
  if (difference > 0) {
    scenes[scenes.length - 1]!.duration_seconds += difference;
  } else if (difference < 0) {
    for (const scene of [...scenes].sort((a, b) => b.duration_seconds - a.duration_seconds)) {
      if (difference === 0) break;
      const reduction = Math.min(scene.duration_seconds - 1, Math.abs(difference));
      scene.duration_seconds -= reduction;
      difference += reduction;
    }
    if (difference !== 0) return script;
  }

  return { ...script, duration_seconds: duration, scenes };
}

function normalizeEditorialFields(script: VideoScript): VideoScript {
  const lastSceneIndex = script.scenes.length - 1;
  const scenes = script.scenes.map((scene, index) => {
    const visual = scene.visual_description.trim() || "Герой действует в рамках текущей сцены.";
    const isFirst = index === 0;
    const isLast = index === lastSceneIndex;
    return {
      ...scene,
      scene_purpose: scene.scene_purpose.trim()
        || (isFirst ? "Знакомит зрителя с героем и запускает историю." : "Продвигает историю через действие сцены."),
      story_beat: scene.story_beat.trim()
        || (isFirst ? "завязка" : isLast ? "финальная развязка и последствие" : "осложнение и развитие"),
      action: scene.action.trim() || visual,
      change: scene.change.trim() || "К концу сцены ситуация героя меняется и ведёт к следующему шагу.",
      continuity: scene.continuity.trim() || "Сохраняет героя, место и состояние истории по описанию этой сцены.",
      transition: scene.transition.trim() || "Следующая сцена продолжает результат текущего действия.",
    };
  });
  return { ...script, scenes };
}

export async function requestScript(messages: ChatMessage[], maxTokens = 8192, preferFallbackModel = false): Promise<string> {
  const apiKey = openRouterConfig.apiKey;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const models = Array.from(new Set(preferFallbackModel
    ? [openRouterConfig.fallbackModel, openRouterConfig.model]
    : [openRouterConfig.model, openRouterConfig.fallbackModel]));
  let lastEmptyResponse = "";

  for (const model of models) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      let response: Response;
      let data: OpenRouterResponse;
      try {
        response = await fetch(openRouterConfig.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://replit.com",
            "X-Title": "AI Content Factory",
          },
          body: JSON.stringify({
            model,
            messages,
            max_completion_tokens: maxTokens,
            response_format: { type: "json_object" },
            ...(model.startsWith("openai/gpt-5")
              ? { reasoning: { effort: "minimal" } }
              : {}),
          }),
          signal: AbortSignal.timeout(SCRIPT_REQUEST_TIMEOUT_MS),
        });
        // Reading the JSON body can time out after fetch has already received
        // response headers. Keep it inside the same retry boundary.
        data = (await response.json()) as OpenRouterResponse;
      } catch (error) {
        const message = error instanceof Error ? error.message : "ошибка соединения";
        if (isScriptRequestTimeout(error)) {
          lastEmptyResponse = `модель ${model}: таймаут — ${message}`;
          if (model !== models.at(-1)) break;
          throw new Error(`OpenRouter script request timed out: ${lastEmptyResponse}`);
        }
        if (attempt < 3) {
          await waitBeforeProviderRetry(attempt);
          continue;
        }
        if (model !== models.at(-1)) {
          lastEmptyResponse = `модель ${model}: ${message}`;
          break;
        }
        throw new Error(`OpenRouter connection failed: ${message}`);
      }

      if (!response.ok) {
        const transient = response.status === 408 || response.status === 429 || response.status >= 500;
        if (transient && attempt < 3) {
          await waitBeforeProviderRetry(attempt);
          continue;
        }
        if ((response.status === 400 || response.status === 404) && model !== models.at(-1)) {
          lastEmptyResponse = `модель ${model}: ${data.error?.message ?? `OpenRouter API error (${response.status})`}`;
          break;
        }
        if (response.status === 429) {
          throw new Error("OpenRouter rate limit exceeded after 3 attempts");
        }
        throw new Error(data.error?.message ?? `OpenRouter API error (${response.status})`);
      }

      const choice = data.choices?.[0];
      const content = choice?.message?.content?.trim();
      if (!content) {
        const finishReason = choice?.finish_reason || "unknown";
        const completionTokens = data.usage?.completion_tokens ?? "unknown";
        lastEmptyResponse = `модель ${model}: finish_reason=${finishReason}, completion_tokens=${completionTokens}`;
        if (attempt < 3) {
          await waitBeforeProviderRetry(attempt);
          continue;
        }
        if (model !== models.at(-1)) break;
        throw new Error(`OpenRouter returned an empty response after 3 attempts (${lastEmptyResponse})`);
      }
      return content;
    }
  }

  throw new Error(`OpenRouter script request failed: ${lastEmptyResponse || "all configured models failed"}`);
}

export function estimateSpokenDurationSeconds(text: string): number {
  const words = text.match(/\S+/gu)?.length ?? 0;
  return Math.ceil(words / 2.35);
}

export async function shortenAuthorScriptToLimit(
  text: string,
  maxDurationSeconds = MAX_SCRIPT_DURATION_SECONDS,
): Promise<string> {
  if (estimateSpokenDurationSeconds(text) <= maxDurationSeconds) return text;

  const targetWords = Math.floor(maxDurationSeconds * 2.35);
  const system = [
    "Ты профессиональный редактор русских сценариев.",
    `Сократи авторский сценарий до озвучки максимум ${maxDurationSeconds} секунд (примерно ${targetWords} слов).`,
    "Это редактура исходного текста, а не написание новой истории.",
    "Сохрани главных героев, их имена, место и время, причинно-следственную цепочку, ключевые реплики, кульминацию, финал и фразу «Продолжение следует…», если она есть.",
    "Удали повторы, второстепенные действия, лишние переходы, атмосферные детали и эпизоды, без которых сюжет остаётся понятным.",
    "Не добавляй новых событий, героев, реплик или рекламных фраз. Не меняй смысл ключевых реплик.",
    "Действия, заголовки сцен и надписи на экране сохраняй как короткие сценарные строки, но не превращай их в закадровый текст.",
    "Верни только JSON в формате {\"text\":\"сокращённый сценарий\"}.",
  ].join("\n");
  const user = [
    `Оценка исходной длительности: примерно ${estimateSpokenDurationSeconds(text)} секунд.`,
    "Исходный авторский сценарий:",
    text,
  ].join("\n\n");
  const raw = await requestScript([
    { role: "system", content: system },
    { role: "user", content: user },
  ], 12000);
  const parsed = z.object({ text: z.string().min(1) }).parse(parseJson(raw));
  if (estimateSpokenDurationSeconds(parsed.text) > maxDurationSeconds) {
    throw new Error(`AI не смог сократить авторский сценарий до ${maxDurationSeconds} секунд`);
  }
  return parsed.text.trim();
}

export async function generateVideoScript(input: ScriptRequest): Promise<VideoScript> {
  const chatMode = input.format.toLowerCase().includes("chat");
  const maxTokens = chatMode || input.duration <= 90 ? 8192 : 24000;
  const chatRules = chatMode
    ? [
      "СПЕЦИАЛЬНЫЙ РЕЖИМ: ЧАТ-ПЕРЕПИСКА.",
      "Сценарий будет показан как настоящая переписка в мобильном чате, а не как обычное видео с картинками.",
      "Сделай 6–10 коротких последовательных сообщений двух собеседников с чередованием реплик.",
      `Весь диалог должен занимать не больше ${Math.floor(input.duration * 2.15)} слов, чтобы озвучка уложилась в ${input.duration} секунд.`,
      "Обычно одна реплика занимает 5–12 слов; не превращай диалог в пересказ длинной истории.",
      "Каждый voice_text — только текст одного сообщения без имени говорящего, слова «сообщение», кавычек и пояснений.",
      "Реплики должны звучать как живой русский чат: коротко, с паузами, реакциями, недосказанностью и естественной пунктуацией.",
      "В visual_description укажи, кто пишет: «Аноним» или «Собеседник», и что меняется в переписке.",
      "Начни с сообщения, которое сразу создаёт интерес, а закончи понятным поворотом или сильной последней репликой.",
      "Не добавляй закадровый текст, описания действий или рекламный CTA внутрь сообщений.",
    ].join("\n")
    : "";
  const activeSystemPrompt = chatRules ? `${systemPrompt}\n${chatRules}` : systemPrompt;
  const selectedSystemPrompt = input.editorialProfile === "coin-history-documentary"
    ? `${activeSystemPrompt}\n\nСПЕЦИАЛЬНЫЙ РЕЖИМ: «ИСТОРИЯ МОНЕТЫ (LONG)». Это документальное видео 16:9 примерно на 10 минут, а не вертикальный Shorts. Для этого профиля переопредели любые короткоформатные допущения выше: создай полноценную историю на указанную длительность, сохрани обязательную JSON-схему и не добавляй неподтверждённые факты.`
    : activeSystemPrompt;
  const userPrompt = [
    `Тема ролика: ${input.topic}`,
    `Платформа: ${input.format}`,
    `Длительность: ${input.duration} секунд`,
    `Стиль: ${input.style}`,
    `Тон: ${input.tone}`,
    `Верхнеуровневое поле duration_seconds должно быть ровно ${input.duration}.`,
    input.instructions
      ? `Пожелания автора (учти их в содержании, но не меняй JSON-формат и обязательные поля):\n${input.instructions}`
      : null,
  ].filter(Boolean).join("\n");

  let raw = await requestScript([
    { role: "system", content: selectedSystemPrompt },
    { role: "user", content: userPrompt },
  ], maxTokens);

  let lastValidationError = "неизвестная ошибка структуры";
  let lastParsedScript: VideoScript | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsed = normalizeEditorialFields(
        normalizeSceneDurations(
          videoScriptSchema.parse(repairEmptySceneVoiceText(removeEmptyTrailingScenes(parseJson(raw)))),
          input.duration,
        ),
      );
      lastParsedScript = parsed;
      const structureError = validateStoryStructure(
        parsed,
        input.duration,
        chatMode,
        input.minimumScenes,
        input.finalSceneMode,
      );
      if (structureError) throw new Error(structureError);
      if (input.antiRepetition) {
        const repetitionError = validateHoroscopeSpeechRepetition(parsed);
        if (repetitionError) throw new Error(repetitionError);
      }
      return parsed;
    } catch (error) {
      lastValidationError = error instanceof Error ? error.message : "неизвестная ошибка структуры";
      if (attempt === 2) {
        if (
          input.allowRecoverableValidationFallback
          && lastParsedScript
          && isRecoverableScriptValidationError(lastValidationError)
        ) {
          return lastParsedScript;
        }
        throw new Error(`AI returned an invalid script JSON: ${lastValidationError}`);
      }
      raw = await requestScript([
        { role: "system", content: selectedSystemPrompt },
        {
          role: "user",
          content: `${userPrompt}\n\nТы работаешь как строгий сценарный редактор и continuity-editor. Исправь ответ с учётом ошибки валидации: ${lastValidationError}. Сцены должны быть причинно связаны, scene_number последовательны, сумма длительностей сцен должна быть ровно ${input.duration}, каждая сцена должна менять ситуацию, а финал должен быть подготовлен предыдущими деталями и разрешать главный конфликт. Верни только валидный JSON с обязательными полями и полной редакторской картой каждой сцены:\n${raw}`,
        },
      ], maxTokens, true);
    }
  }

  throw new Error("Script generation failed");
}

export type HoroscopeMetadata = {
  idea: string;
  format: string;
  title_variants: [string, string, string];
  selected_title: string;
  description: string;
  keywords: string[];
  tags: string[];
  hashtags: string[];
  visual_mode: "AUTO" | "STOCK" | "AI_IMAGE";
  visual_search_queries: string[];
  visual_prompt: string;
};

export type HoroscopePlannerMode = "daily" | "manual" | "weekly";

export type HoroscopeCurrentContext = {
  current_date: string;
  current_day: string;
  current_month: string;
  current_year: string;
  current_time: string;
  current_timezone: string;
  forecast_date: string;
};

export type HoroscopePlanningHistoryItem = {
  connection_id: number | null;
  channel_name: string;
  zodiac_sign: string | null;
  topic: string;
  idea: string;
  format: string;
  hook: string;
  title: string;
  created_at: string;
};

export function createHoroscopeCurrentContext(
  now = new Date(),
  timeZone = process.env["HOROSCOPE_TIMEZONE"]?.trim() || "Asia/Novosibirsk",
): HoroscopeCurrentContext {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value || "";
  return {
    current_date: new Intl.DateTimeFormat("ru-RU", { dateStyle: "full", timeZone }).format(now),
    current_day: part("weekday"),
    current_month: part("month"),
    current_year: part("year"),
    current_time: `${part("hour")}:${part("minute")}`,
    current_timezone: timeZone,
    forecast_date: new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone,
    }).format(now),
  };
}

export type HoroscopeContentPlanItem = {
  connection_id: number;
  channel_name: string;
  forecast_date?: string;
  forecast_text?: string;
  second_forecast_text?: string;
  zodiac_sign: string;
  topic: string;
  subtopic: string;
  format: string;
  angle: string;
  hook: string;
  story_outline: string;
  emotional_tone: string;
};

export type HoroscopeContentPlan = {
  locked_parameters: string[];
  flexible_parameters: string[];
  expandable_parameters: string[];
  items: HoroscopeContentPlanItem[];
};

const horoscopePlanItemSchema = z.object({
  connection_id: z.coerce.number().int().positive(),
  channel_name: z.string().default(""),
  forecast_date: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/),
  forecast_text: z.string().min(1).max(300),
  second_forecast_text: z.string().min(1).max(300),
  zodiac_sign: z.string().min(1),
  topic: z.string().min(1),
  subtopic: z.string().min(1),
  format: z.string().min(1),
  angle: z.string().min(1),
  hook: z.string().min(1),
  story_outline: z.string().min(1).optional(),
  emotional_tone: z.string().min(1),
}).transform((item) => ({
  ...item,
  story_outline: item.story_outline?.trim()
    || `${item.forecast_text} → ${item.second_forecast_text}`,
}));

const horoscopeContentPlanSchema = z.object({
  locked_parameters: z.array(z.string().min(1)),
  flexible_parameters: z.array(z.string().min(1)),
  expandable_parameters: z.array(z.string().min(1)),
  items: z.array(horoscopePlanItemSchema).min(1),
});

const horoscopeContentPlanEnvelopeSchema = horoscopeContentPlanSchema.extend({
  items: z.array(z.unknown()),
});

export const HOROSCOPE_ZODIAC_SIGNS = [
  "Овен",
  "Телец",
  "Близнецы",
  "Рак",
  "Лев",
  "Дева",
  "Весы",
  "Скорпион",
  "Стрелец",
  "Козерог",
  "Водолей",
  "Рыбы",
] as const;

const HOROSCOPE_PLANNER_STOP_WORDS = new Set([
  "этот", "эта", "это", "того", "тебя", "тебе", "вас", "вам", "ваш", "для", "или", "как",
  "что", "который", "сегодня", "завтра", "знак", "знака", "день", "видео", "главный", "важный",
  "новый", "может", "нужно", "будет", "ждет", "ждёт", "если", "уже", "один", "одна", "после",
  "перед", "через", "свой", "свою", "прогноз", "короткий", "основной", "дополнительный",
  "двумя", "двух", "между", "момент", "мгновенный", "мгновенно", "условиях", "неопределенности",
  "крупный", "прямой", "конкретный", "главный", "реальный", "сейчас", "здесь",
]);

function horoscopePlannerTokens(value: string): Set<string> {
  return new Set(
    (value.toLocaleLowerCase("ru-RU").replace(/ё/g, "е").match(/[а-яa-z0-9]{3,}/g) || [])
      .filter((token) => !HOROSCOPE_PLANNER_STOP_WORDS.has(token)),
  );
}

function horoscopePlannerSimilarity(left: string, right: string): number {
  const leftTokens = horoscopePlannerTokens(left);
  const rightTokens = horoscopePlannerTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) intersection += 1;
  return intersection / (leftTokens.size + rightTokens.size - intersection);
}

function horoscopeBlockedRecentSign(
  connectionId: number,
  history: HoroscopePlanningHistoryItem[],
): string | null {
  const recentSigns = history
    .filter((entry) => entry.connection_id === connectionId)
    .slice(0, 3)
    .map((entry) => entry.zodiac_sign)
    .filter((sign): sign is string => Boolean(sign));
  return recentSigns.length === 3 && recentSigns.every((sign) => sign === recentSigns[0])
    ? recentSigns[0]!
    : null;
}

function horoscopeBlockedCycleSigns(
  connectionId: number,
  history: HoroscopePlanningHistoryItem[],
): Set<string> {
  const seen = new Set<string>();
  for (const entry of history) {
    if (entry.connection_id !== connectionId || !entry.zodiac_sign) continue;
    if (HOROSCOPE_ZODIAC_SIGNS.includes(entry.zodiac_sign as typeof HOROSCOPE_ZODIAC_SIGNS[number])) {
      seen.add(entry.zodiac_sign);
    }
    if (seen.size === HOROSCOPE_ZODIAC_SIGNS.length) break;
  }
  return seen.size === HOROSCOPE_ZODIAC_SIGNS.length ? new Set<string>() : seen;
}

function horoscopeReplacementSign(blockedSigns: Set<string>, excludedSign?: string): string {
  return HOROSCOPE_ZODIAC_SIGNS.find((sign) =>
    !blockedSigns.has(sign) && sign !== excludedSign,
  ) || HOROSCOPE_ZODIAC_SIGNS.find((sign) => !blockedSigns.has(sign))
    || HOROSCOPE_ZODIAC_SIGNS[0];
}

function replaceHoroscopeSignText(value: string | undefined, from: string, to: string): string | undefined {
  return value?.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"), to);
}

const HOROSCOPE_PLANNER_LANGUAGE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\b(?:hook|hook_style)\b/giu, "зацепка"],
  [/\bangle\b/giu, "угол"],
  [/\b(?:topic|subtopic)\b/giu, "тема"],
  [/\bstory(?:_outline)?\b/giu, "структура"],
  [/\b(?:forecast|forecast_text|second_forecast_text)\b/giu, "прогноз"],
  [/\bwarning\b/giu, "предупреждение"],
  [/\bchance\b/giu, "шанс"],
  [/\bmoney\b/giu, "деньги"],
  [/\blove\b/giu, "любовь"],
  [/\bcareer\b/giu, "карьера"],
  [/\btoday\b/giu, "сегодня"],
  [/\btomorrow\b/giu, "завтра"],
  [/\b(?:mystical|mystic)\b/giu, "мистический"],
  [/\bemotional\b/giu, "эмоциональный"],
  [/\b(?:calm|calming)\b/giu, "спокойный"],
  [/\bdynamic\b/giu, "динамичный"],
  [/\bfocus\b/giu, "фокус"],
  [/\bsignal\b/giu, "сигнал"],
  [/\bunexpected\b/giu, "неожиданный"],
  [/\bopportunity\b/giu, "возможность"],
  [/\bimportant\b/giu, "важный"],
  [/\bmain\b/giu, "главный"],
  [/\bextra\b/giu, "дополнительный"],
  [/\benergy\b/giu, "энергия"],
  [/\bdecision\b/giu, "решение"],
  [/\bchange\b/giu, "перемена"],
  [/\bsecret\b/giu, "тайна"],
];

function normalizeHoroscopePlannerText(value: string): string {
  return HOROSCOPE_PLANNER_LANGUAGE_REPLACEMENTS.reduce(
    (normalized, [pattern, replacement]) => normalized.replace(pattern, replacement),
    value,
  ).replace(/\s{2,}/g, " ").trim();
}

function normalizeHoroscopePlannerItem(item: HoroscopeContentPlanItem): HoroscopeContentPlanItem {
  return {
    ...item,
    topic: normalizeHoroscopePlannerText(item.topic),
    subtopic: normalizeHoroscopePlannerText(item.subtopic),
    angle: normalizeHoroscopePlannerText(item.angle),
    hook: normalizeHoroscopePlannerText(item.hook),
    story_outline: normalizeHoroscopePlannerText(item.story_outline),
    emotional_tone: normalizeHoroscopePlannerText(item.emotional_tone),
    forecast_text: item.forecast_text ? normalizeHoroscopePlannerText(item.forecast_text) : item.forecast_text,
    second_forecast_text: item.second_forecast_text
      ? normalizeHoroscopePlannerText(item.second_forecast_text)
      : item.second_forecast_text,
  };
}

function horoscopeFormatKey(value: string | undefined): string {
  return (value || "")
    .split(/\s+—\s+«/u, 1)[0]
    .trim()
    .toLocaleLowerCase("ru-RU");
}

function sameHoroscopeFormat(left: string | undefined, right: string | undefined): boolean {
  const leftKey = horoscopeFormatKey(left);
  const rightKey = horoscopeFormatKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

function validateHoroscopeContentPlan(
  plan: HoroscopeContentPlan,
  expectedIds: Set<number>,
  expectedCount: number,
  expectedDate: string,
  channels: Array<{ connectionId: number; formats: string[] }>,
  history: HoroscopePlanningHistoryItem[],
  requiredZodiacSign?: string,
): string | null {
  const actualIds = plan.items.map((item) => item.connection_id);
  if (plan.items.length !== expectedCount || actualIds.some((id) => !expectedIds.has(id)) || new Set(actualIds).size !== actualIds.length) {
    return `план должен содержать ровно ${expectedCount} пунктов — по одному на каждый переданный connection_id (${[...expectedIds].join(", ")}); получено ${plan.items.length} пунктов с id: ${actualIds.join(", ")}`;
  }
  if (plan.items.some((item) => item.forecast_date !== expectedDate)) {
    return `forecast_date каждого пункта должен быть ровно ${expectedDate}`;
  }
  const channelMap = new Map(channels.map((channel) => [channel.connectionId, channel]));
  for (const item of plan.items) {
    const channel = channelMap.get(item.connection_id);
    if (!channel) return `в плане найден неизвестный connection_id=${item.connection_id}`;
    const formatMatchesChannel = channel.formats.some((configuredFormat) =>
      item.format === configuredFormat || item.format === configuredFormat.split(" — «")[0],
    );
    if (!formatMatchesChannel) {
      return `пункт для connection_id=${item.connection_id} выбрал недопустимый format «${item.format}»; выбери дословно один из: ${channel.formats.join(" | ")}`;
    }
    if (!HOROSCOPE_ZODIAC_SIGNS.includes(item.zodiac_sign as typeof HOROSCOPE_ZODIAC_SIGNS[number])) {
      return `неизвестный знак зодиака в пункте connection_id=${item.connection_id}`;
    }
    const russianPlanFields = [
      item.topic,
      item.subtopic,
      item.angle,
      item.hook,
      item.story_outline,
      item.emotional_tone,
      item.forecast_text || "",
      item.second_forecast_text || "",
    ];
    if (russianPlanFields.some((value) => /[a-z]{3,}/iu.test(value))) {
      return `пункт для ${item.channel_name} содержит случайный иноязычный текст; перепиши тему, прогноз и hook естественно по-русски`;
    }
    const recentForChannel = history
      .filter((entry) => entry.connection_id === item.connection_id)
      .slice(0, 8);
    if (sameHoroscopeFormat(recentForChannel[0]?.format, item.format) && channel.formats.length > 1) {
      return `канал ${item.channel_name} повторяет формат из последней публикации; выбери один из двух других форматов`;
    }
    if (!requiredZodiacSign) {
      const blockedRecentSign = horoscopeBlockedRecentSign(item.connection_id, history);
      if (blockedRecentSign === item.zodiac_sign) {
        return `канал ${item.channel_name} снова повторяет знак ${item.zodiac_sign} после трёх публикаций подряд`;
      }
      const blockedCycleSigns = horoscopeBlockedCycleSigns(item.connection_id, history);
      if (blockedCycleSigns.has(item.zodiac_sign)) {
        return `канал ${item.channel_name} уже использовал знак ${item.zodiac_sign} в текущем цикле из 12 знаков; выбери ещё не использованный знак`;
      }
    } else if (item.zodiac_sign !== requiredZodiacSign) {
      return `для последовательной очереди нужен знак ${requiredZodiacSign}, получен ${item.zodiac_sign}`;
    }
    const currentConcept = [item.topic, item.subtopic, item.angle, item.hook, item.story_outline].join(" ");
    const repeated = recentForChannel.find((entry) =>
      horoscopePlannerSimilarity(currentConcept, [entry.topic, entry.idea, entry.hook, entry.title].join(" ")) >= 0.9,
    );
    if (repeated) {
      return `идея для канала ${item.channel_name} слишком похожа на его недавнюю публикацию; измени тему, подтему, угол и hook`;
    }
  }
  const concepts = plan.items.map((item) => [
    item.topic,
    item.subtopic,
    item.format,
    item.angle,
    item.hook,
    item.story_outline,
  ].join(" "));
  for (let left = 0; left < concepts.length; left += 1) {
    for (let right = left + 1; right < concepts.length; right += 1) {
      const leftItem = plan.items[left]!;
      const rightItem = plan.items[right]!;
      const identicalCoreFieldCount = [
        ["topic", leftItem.topic, rightItem.topic],
        ["subtopic", leftItem.subtopic, rightItem.subtopic],
        ["angle", leftItem.angle, rightItem.angle],
        ["hook", leftItem.hook, rightItem.hook],
        ["story_outline", leftItem.story_outline, rightItem.story_outline],
      ].filter(([, leftValue, rightValue]) =>
        leftValue.trim().toLocaleLowerCase("ru-RU") === rightValue.trim().toLocaleLowerCase("ru-RU"),
      ).length;
      if (identicalCoreFieldCount >= 3) {
        return `пункты ${left + 1} и ${right + 1} копируют три или больше ключевых поля; измени саму комбинацию темы, подтемы, угла и hook`;
      }
      if (concepts[left] === concepts[right] || horoscopePlannerSimilarity(concepts[left]!, concepts[right]!) >= 0.88) {
        return `пункты ${left + 1} и ${right + 1} являются почти дословными копиями; измени комбинацию подтемы, угла, hook и структуры`;
      }
    }
  }
  return null;
}

export async function generateHoroscopeContentPlan(input: {
  mode: HoroscopePlannerMode;
  parentTopic?: string | null;
  requiredZodiacSign?: string;
  currentContext: HoroscopeCurrentContext;
  channels: Array<{
    connectionId: number;
    channelName: string;
    niche: string;
    tone: string;
    topics: string[];
    formats: string[];
    hookStyle: string;
    targetAudience: string;
  }>;
  history: HoroscopePlanningHistoryItem[];
}, plannerRequester: typeof requestScript = requestScript): Promise<HoroscopeContentPlan> {
  if (!input.channels.length) {
    throw new Error("Content Plan requires at least one selected channel");
  }
  const requiredZodiacSign = input.requiredZodiacSign
    && HOROSCOPE_ZODIAC_SIGNS.includes(input.requiredZodiacSign as typeof HOROSCOPE_ZODIAC_SIGNS[number])
    ? input.requiredZodiacSign
    : undefined;
  const selectedConnectionIds = new Set(input.channels.map((channel) => channel.connectionId));
  const selectedHistory = input.history.filter((entry) =>
    entry.connection_id === null || selectedConnectionIds.has(entry.connection_id),
  );
  const channelBrief = input.channels.map((channel) => ({
    connection_id: channel.connectionId,
    channel_name: channel.channelName,
    niche: channel.niche,
    tone_of_voice: channel.tone,
    target_audience: channel.targetAudience,
    hook_style: channel.hookStyle,
    available_topics: channel.topics,
    available_formats: channel.formats,
  }));
  const isManual = input.mode === "manual";
  const modeLabel = input.mode === "weekly"
    ? "ГОРОСКОП НА НЕДЕЛЮ"
    : isManual ? "СОЗДАТЬ ПО ТЕМЕ" : "ГОРОСКОП НА СЕГОДНЯ";
  const parentTopic = input.parentTopic?.trim() || null;
  const dateLabel = input.currentContext.forecast_date;
  const plannerMessages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "Ты — AI Content Planner для сети русскоязычных YouTube Shorts о гороскопах.",
        "Твоя задача — сначала составить единый CONTENT PLAN для всех каналов, а не писать сценарии.",
         `Режим: ${modeLabel}.`,
        "Верни только JSON без markdown.",
        "В items должен быть ровно один пункт на каждый переданный connection_id, без пропусков и дублей.",
        "Сначала мысленно распредели CHANNEL + FORMAT + ZODIAC + TOPIC + SUBTOPIC + ANGLE + HOOK + EMOTIONAL_TONE по всей сетке, затем верни единый план.",
        "Для каждого канала выбери format ДОСЛОВНО из его available_formats. У каждого канала свои три формата: не подменяй их общим шаблоном.",
        "Учитывай tone_of_voice, target_audience и hook_style конкретного канала. Любовный, денежный, ежедневный и мистический каналы должны звучать по-разному.",
         "Каждый пункт обязан быть коротким прогнозом: дата, знак, тема «что ждёт знак сегодня», первая прогнозная фраза, вторая короткая прогнозная фраза, hook и эмоциональная подача.",
         "Это НЕ сторителлинг и НЕ история с героем. Не придумывай персонажей, заказы, поездки, расследования, конфликт, кульминацию или сюжетный поворот.",
         "Не делай длинный общий текст. Для каждого знака нужны две короткие конкретные мысли: основная и дополнительная.",
        "Учитывай историю всех каналов и избегай повторов тем, связок знак+тема, форматов, углов, hooks и похожих сценариев.",
        "Не используй недавно выбранный формат канала снова, если доступны два других. Не повторяй постоянно один знак на одном канале.",
         "Для каждого канала веди отдельный цикл из 12 знаков: сначала используй все знаки, которых ещё не было в текущем цикле, и только после появления всех 12 начинай новый цикл. Повтор знака допустим только в новом цикле, при этом тема, текст, hook и формат должны быть другими.",
         requiredZodiacSign
           ? `Это последовательная очередь одного канала. Для текущего пункта используй только знак «${requiredZodiacSign}». Не заменяй его другим знаком и упоминай его в прогнозных полях естественно.`
           : "",
        "Перед ответом глобально сравни все пункты. Родственные темы и похожие мотивы допустимы, но нельзя копировать один ролик с простой заменой знака.",
        "Исправляй только дословные и почти дословные дубли, где совпадают тема, подтема, angle, hook и структура. Не запрещай естественное тематическое сходство между каналами.",
        "Все прогнозные поля пиши естественно по-русски, без случайных английских или иных иностранных слов.",
         "Знаки и темы нельзя навсегда закреплять за каналами: распределяй их заново с учётом истории.",
         `forecast_date всегда должен быть ровно "${dateLabel}".`,
        isManual
          ? [
            "Пользовательская тема — это PARENT TOPIC, а не готовый промпт для всех роликов.",
            "Определи locked_parameters: только то, что пользователь явно зафиксировал.",
            "Определи flexible_parameters: знак, подтема, формат, hook, угол, сюжет и эмоциональная подача, если они не зафиксированы.",
            "Определи expandable_parameters: дополнительные релевантные подтемы и события, которые можно придумать.",
            "Если пользователь указал конкретный знак или связку вроде «Дева и деньги», не меняй зафиксированные параметры.",
          ].join("\n")
           : input.mode === "weekly"
             ? [
             "Составь короткий прогноз на неделю для одного канала.",
             "Учитывай развитие темы на горизонте недели, но не превращай прогноз в историю.",
               "Не обещай гарантированных событий и не выдавай астрологию за медицинскую, финансовую или юридическую гарантию.",
             ].join("\n")
             : [
             "Пользовательскую тему не запрашивали: самостоятельно выбери разнообразные темы и знаки на сегодня.",
            "locked_parameters обычно должен быть пустым или содержать только дату/режим.",
            "Используй дату и историю, чтобы план был свежим и не повторял прошлые публикации.",
          ].join("\n"),
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `CURRENT_DATE: ${input.currentContext.current_date}`,
        `CURRENT_DAY: ${input.currentContext.current_day}`,
        `CURRENT_MONTH: ${input.currentContext.current_month}`,
        `CURRENT_YEAR: ${input.currentContext.current_year}`,
        `CURRENT_TIME: ${input.currentContext.current_time}`,
        `CURRENT_TIMEZONE: ${input.currentContext.current_timezone}`,
        `Дата для заголовка и прогноза: ${dateLabel}`,
        `Родительская тема: ${parentTopic || "не задана — придумай план самостоятельно"}`,
         requiredZodiacSign ? `Обязательный знак текущего выпуска: ${requiredZodiacSign}` : "",
        `Каналы:\n${JSON.stringify(channelBrief)}`,
        selectedHistory.length
          ? `Структурированная история выбранных horoscope-каналов (от новых к старым). Не создавай пункты для каналов из истории — используй только connection_id из списка «Каналы»:\n${JSON.stringify(selectedHistory)}`
          : "История пуста: создай разнообразный первый план.",
        [
          "Формат ответа:",
          JSON.stringify({
            locked_parameters: ["пример зафиксированного параметра"],
            flexible_parameters: ["sign", "subtopic", "format", "angle", "hook", "story"],
            expandable_parameters: ["пример возможной подтемы"],
            items: [{
              connection_id: 123,
              channel_name: "Название канала",
               forecast_date: dateLabel,
               forecast_text: "Овен, 21 сентября: сегодня вас ждёт важный разговор, который поможет принять решение.",
               second_forecast_text: "Во второй половине дня не спешите соглашаться на первое предложение.",
              zodiac_sign: "Дева",
              topic: "деньги",
              subtopic: "неожиданная финансовая возможность",
              format: "предупреждение",
              angle: "ошибка, которую нельзя совершать сегодня",
              hook: "Если ты Дева — не игнорируй этот сигнал о деньгах",
               story_outline: "Основной прогноз → короткое дополнительное предупреждение.",
              emotional_tone: "напряжённый, но обнадёживающий",
            }],
          }),
        ].join("\n"),
      ].join("\n\n"),
    },
  ];
  const expectedIds = new Set(input.channels.map((channel) => channel.connectionId));
  const expectedChannelNames = new Map(
    input.channels.map((channel) => [channel.connectionId, channel.channelName]),
  );
  const plannerMaxTokens = Math.min(24_000, Math.max(10_000, input.channels.length * 1_800));
  let raw = await plannerRequester(plannerMessages, plannerMaxTokens);
  let lastValidationError = "неизвестная ошибка Content Plan";
  const candidateItems: HoroscopeContentPlanItem[] = [];
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const envelope = horoscopeContentPlanEnvelopeSchema.parse(parseJson(raw));
      const itemResults = envelope.items.map((item) => {
        const parsed = horoscopePlanItemSchema.safeParse(item);
        return { item, parsed };
      });
      const validItems = itemResults.flatMap(({ parsed }) => parsed.success ? [parsed.data] : []);
      if (process.env["HOROSCOPE_PLANNER_DEBUG"] === "1") {
        console.error(JSON.stringify({
          event: "horoscope_planner_item_validation",
          raw_item_count: envelope.items.length,
          valid_item_count: validItems.length,
          item_shapes: itemResults.slice(0, 3).map(({ item, parsed }) => ({
            type: Array.isArray(item) ? "array" : item === null ? "null" : typeof item,
            keys: item && typeof item === "object" && !Array.isArray(item) ? Object.keys(item).sort() : [],
            issues: parsed.success ? [] : parsed.error.issues.map((issue) => ({
              path: issue.path.join("."),
              code: issue.code,
              expected: "expected" in issue ? issue.expected : undefined,
              received: "received" in issue ? issue.received : undefined,
            })),
          })),
        }));
      }
      if (!validItems.length) {
        const firstInvalid = itemResults.find(({ parsed }) => !parsed.success);
        const issuePaths = firstInvalid && !firstInvalid.parsed.success
          ? firstInvalid.parsed.error.issues.slice(0, 8).map((issue) =>
            `${issue.path.join(".") || "<item>"}:${issue.code}`,
          ).join(", ")
          : "items пуст";
        throw new Error(
          `items не содержит ни одного валидного пункта из ${envelope.items.length}; первый набор ошибок: ${issuePaths}; нужен полный план для ${input.channels.length} выбранных каналов`,
        );
      }
      candidateItems.push(...validItems.map(normalizeHoroscopePlannerItem));
      const parsedPlan = horoscopeContentPlanSchema.parse({ ...envelope, items: candidateItems });
      const signCounts = new Map<string, number>();
      const normalizedItems: HoroscopeContentPlanItem[] = [];
      for (const channel of input.channels) {
        const latestFormat = selectedHistory.find((entry) =>
          entry.connection_id === channel.connectionId,
        )?.format;
        const blockedRecentSign = horoscopeBlockedRecentSign(channel.connectionId, selectedHistory);
        const blockedCycleSigns = horoscopeBlockedCycleSigns(channel.connectionId, selectedHistory);
        const candidates = parsedPlan.items
          .filter((item) => item.connection_id === channel.connectionId)
          .sort((left, right) => {
            const similarityToSelected = (item: HoroscopeContentPlanItem): number => {
              const concept = [item.subtopic, item.angle, item.hook].join(" ");
              return normalizedItems.reduce((maximum, existing) => Math.max(
                maximum,
                horoscopePlannerSimilarity(concept, [existing.subtopic, existing.angle, existing.hook].join(" ")),
              ), 0);
            };
            const score = (item: HoroscopeContentPlanItem): number =>
              similarityToSelected(item)
              + (signCounts.get(item.zodiac_sign) || 0)
               + (sameHoroscopeFormat(latestFormat, item.format) && channel.formats.length > 1 ? 0.5 : 0);
            return score(left) - score(right);
          });
        const usableCandidates = candidates.filter((item) =>
          item.forecast_date === dateLabel
          && HOROSCOPE_ZODIAC_SIGNS.includes(item.zodiac_sign as typeof HOROSCOPE_ZODIAC_SIGNS[number])
          && channel.formats.some((format) =>
            item.format === format || item.format === format.split(" — «")[0],
          ),
        );
        const cycleCandidates = requiredZodiacSign
          ? usableCandidates.filter((item) => item.zodiac_sign === requiredZodiacSign)
          : usableCandidates.filter((item) => !blockedCycleSigns.has(item.zodiac_sign));
        const selectedCandidate = cycleCandidates.find((item) =>
           !sameHoroscopeFormat(latestFormat, item.format),
         ) || cycleCandidates[0] || usableCandidates.find((item) =>
           !sameHoroscopeFormat(latestFormat, item.format),
         ) || usableCandidates[0] || candidates[0];
         if (!selectedCandidate) continue;
         const alternativeFormat = channel.formats.find((format) =>
           !sameHoroscopeFormat(latestFormat, format),
         );
         const selected = sameHoroscopeFormat(latestFormat, selectedCandidate.format) && alternativeFormat
           ? { ...selectedCandidate, format: alternativeFormat }
           : selectedCandidate;
        const replacementSign = !requiredZodiacSign && (
          blockedCycleSigns.has(selected.zodiac_sign)
          || (blockedRecentSign && selected.zodiac_sign === blockedRecentSign)
        )
          ? horoscopeReplacementSign(blockedCycleSigns)
          : selected.zodiac_sign;
        const normalizedSelected = replacementSign !== selected.zodiac_sign
          ? {
            ...selected,
            zodiac_sign: replacementSign,
            forecast_text: replaceHoroscopeSignText(selected.forecast_text, selected.zodiac_sign, replacementSign),
            second_forecast_text: replaceHoroscopeSignText(selected.second_forecast_text, selected.zodiac_sign, replacementSign),
            topic: replaceHoroscopeSignText(selected.topic, selected.zodiac_sign, replacementSign) || selected.topic,
            subtopic: replaceHoroscopeSignText(selected.subtopic, selected.zodiac_sign, replacementSign) || selected.subtopic,
            angle: replaceHoroscopeSignText(selected.angle, selected.zodiac_sign, replacementSign) || selected.angle,
            hook: replaceHoroscopeSignText(selected.hook, selected.zodiac_sign, replacementSign) || selected.hook,
            story_outline: replaceHoroscopeSignText(selected.story_outline, selected.zodiac_sign, replacementSign) || selected.story_outline,
            emotional_tone: replaceHoroscopeSignText(selected.emotional_tone, selected.zodiac_sign, replacementSign) || selected.emotional_tone,
          }
          : selected;
        signCounts.set(normalizedSelected.zodiac_sign, (signCounts.get(normalizedSelected.zodiac_sign) || 0) + 1);
        normalizedItems.push({
          ...normalizedSelected,
          channel_name: normalizedSelected.channel_name || expectedChannelNames.get(normalizedSelected.connection_id) || "",
        });
      }
      const plan: HoroscopeContentPlan = {
        ...parsedPlan,
        items: normalizedItems,
      };
        const validationError = validateHoroscopeContentPlan(
          plan,
          expectedIds,
          input.channels.length,
          dateLabel,
          input.channels,
          selectedHistory,
           requiredZodiacSign,
        );
      if (validationError) throw new Error(validationError);
      return plan;
    } catch (error) {
      lastValidationError = error instanceof Error ? error.message : "неизвестная ошибка Content Plan";
      if (process.env["HOROSCOPE_PLANNER_DEBUG"] === "1") {
        console.error(JSON.stringify({
          event: "horoscope_planner_attempt_rejected",
          attempt: attempt + 1,
          reason: lastValidationError,
        }));
      }
      if (attempt === 4) throw new Error(`AI Content Planner returned an invalid plan: ${lastValidationError}`);
      const repairIds = input.channels.filter((channel) => {
        const latestFormat = selectedHistory.find((entry) =>
          entry.connection_id === channel.connectionId,
        )?.format;
        return !candidateItems.some((item) =>
          item.connection_id === channel.connectionId
          && item.forecast_date === dateLabel
          && HOROSCOPE_ZODIAC_SIGNS.includes(item.zodiac_sign as typeof HOROSCOPE_ZODIAC_SIGNS[number])
           && (!requiredZodiacSign || item.zodiac_sign === requiredZodiacSign)
           && !(sameHoroscopeFormat(latestFormat, item.format) && channel.formats.length > 1)
          && channel.formats.some((format) =>
            item.format === format || item.format === format.split(" — «")[0],
          ),
        );
      }).map((channel) => channel.connectionId);
      const repairScope = repairIds.length
        ? [
          `Это продолжение общего плана. Предыдущие валидные пункты уже сохранены.`,
          `Верни items только для отсутствующих или невалидных connection_id: ${repairIds.join(", ")}.`,
          `Описание этих каналов с ДОПУСТИМЫМИ форматами: ${JSON.stringify(channelBrief.filter((channel) => repairIds.includes(channel.connection_id)))}`,
          "Не повторяй уже готовые connection_id. Обязательно заполни все поля каждого пункта.",
        ].join("\n")
        : `Верни исправленные альтернативы для пунктов, вызвавших ошибку, сохраняя охват всех ${input.channels.length} каналов.`;
      raw = await plannerRequester([
        ...plannerMessages,
        {
          role: "user",
          content: `Проверь предыдущий Content Plan и исправь ошибку: ${lastValidationError}.\n${repairScope}\nВерни JSON в той же схеме верхнего уровня. Не возвращай пустой items.\nПредыдущий ответ:\n${raw}`,
        },
      ], plannerMaxTokens, true);
    }
  }
  throw new Error(`AI Content Planner failed: ${lastValidationError}`);
}

export async function generateHoroscopeMetadata(input: {
  topic: string;
  channelName: string;
  niche: string;
  targetAudience: string;
  tone: string;
  format: string;
  hook: string;
  script: VideoScript;
  planItem?: HoroscopeContentPlanItem | null;
  currentContext: HoroscopeCurrentContext;
  recentContent?: string[];
}): Promise<HoroscopeMetadata> {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: [
        "Ты SEO-редактор и visual planner для русскоязычных Shorts о гороскопах.",
        "Создавай самостоятельный контент-пакет только по текущему сценарию.",
        "Не копируй прошлые идеи, hooks, названия или формулировки.",
        "Сначала создай минимум 3 разных SEO-названия, затем выбери один наиболее подходящий из них.",
        "Создай отдельное естественное SEO-описание, которое точно отражает сценарий и не копирует описания других каналов.",
        "SEO должно учитывать канал, аудиторию, знак, тему, подтему, формат, hook, angle, tone of voice, полный сценарий и актуальную дату.",
         "Весь title, description, keywords, tags и hashtags пиши только на русском языке кириллицей. Не используй английские слова, латиницу и #shorts.",
        "Заголовки должны быть конкретными и кликабельными, но не обещать того, чего нет в сценарии. Не используй постоянный шаблон «Гороскоп [знака] на сегодня».",
        "keywords — 5–12 релевантных ключевых слов.",
        "tags — 5–15 тегов без #.",
        "hashtags — 2–8 хэштегов с #.",
        "visual_search_queries — 3–6 коротких поисковых запросов для STOCK на английском языке.",
        "visual_prompt — уникальный prompt для вертикального 9:16 изображения без лишнего текста, максимум 120 слов.",
        "visual_mode укажи STOCK. AI_IMAGE и автоматическую генерацию изображений не используй.",
        "format должен быть конкретным форматом ролика, а idea — краткой новой идеей.",
        "Не добавляй длинных объяснений: все строки должны быть короткими, чтобы JSON полностью поместился в ответ.",
        "Верни только JSON без markdown.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Канал: ${input.channelName}`,
        `Ниша: ${input.niche}`,
        `Аудитория: ${input.targetAudience}`,
        `Tone of voice: ${input.tone}`,
        `Формат канала: ${input.format}`,
        `Тема запуска: ${input.topic}`,
        `Hook: ${input.hook}`,
        `CURRENT_DATE: ${input.currentContext.current_date}`,
        `CURRENT_TIME: ${input.currentContext.current_time}`,
        `CURRENT_TIMEZONE: ${input.currentContext.current_timezone}`,
        input.planItem ? `Полный пункт общего Content Plan: ${JSON.stringify(input.planItem)}` : "",
        `Сценарий: ${JSON.stringify(input.script)}`,
        input.recentContent?.length
          ? `Недавние темы, которых нужно избегать:\n- ${input.recentContent.join("\n- ")}`
          : "Недавних материалов нет.",
        'Формат JSON: {"idea":"","format":"","title_variants":["","",""],"selected_title":"","description":"","keywords":[],"tags":[],"hashtags":[],"visual_mode":"STOCK","visual_search_queries":[],"visual_prompt":""}',
      ].join("\n\n"),
    },
  ];
  const metadataSchema = z.object({
    idea: z.string().min(1),
    format: z.string().min(1),
    title_variants: z.array(z.string().min(1)).min(3).max(5).transform((items) => items.slice(0, 3) as [string, string, string]),
    selected_title: z.string().min(1),
    description: z.string().min(40),
    keywords: z.array(z.string().min(1)).min(5),
    tags: z.array(z.string().min(1)).min(5),
    hashtags: z.array(z.string().min(1)).min(2),
    visual_mode: z.enum(["AUTO", "STOCK", "AI_IMAGE"]),
    visual_search_queries: z.array(z.string().min(1)).min(2),
    visual_prompt: z.string().min(1),
  });
  let raw = await requestScript(messages, 8000);
  let lastError = "неизвестная ошибка SEO metadata";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsed = metadataSchema.parse(parseJson(raw));
      if ([parsed.description, ...parsed.title_variants].some((value) =>
        /[\p{Script=Han}\p{Script=Hangul}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(value),
      )) {
        throw new Error("SEO должно быть полностью на русском языке без случайных иноязычных символов");
      }
      const selectedTitle = parsed.title_variants.includes(parsed.selected_title)
        ? parsed.selected_title
        : parsed.title_variants[0];
      const hashtags = Array.from(new Set(
        parsed.hashtags
          .map((value) => value.trim().replace(/^#+/, "").replace(/[^\p{L}\p{N}_-]+/gu, ""))
          .filter(Boolean)
          .map((value) => `#${value}`),
      ));
      for (const fallback of ["#гороскоп", "#астрология", "#знакизодиака"]) {
        if (hashtags.length >= 2) break;
        if (!hashtags.includes(fallback)) hashtags.push(fallback);
      }
      return { ...parsed, selected_title: selectedTitle, hashtags: hashtags.slice(0, 8) };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "неизвестная ошибка SEO metadata";
      if (attempt === 2) {
        throw new Error(`AI returned invalid horoscope metadata JSON after 3 attempts: ${lastError}`);
      }
      raw = await requestScript([
        ...messages,
        {
          role: "user",
          content: [
            `Предыдущий ответ повреждён или не прошёл проверку: ${lastError}.`,
            "Сгенерируй полный JSON заново. Не обрезай строки, не добавляй markdown, комментарии или пояснения.",
             "Сделай description содержательным, visual_prompt коротким (до 120 слов), keywords/tags/hashtags компактными. Все SEO-поля должны быть только на русском языке.",
            `Предыдущий ответ:\n${raw}`,
          ].join("\n\n"),
        },
      ], 8000);
    }
  }
  throw new Error(`AI returned invalid horoscope metadata JSON: ${lastError}`);
}

export async function generateYoutubeMetadataVariants(input: {
  scripts: string[];
  example?: Partial<YoutubeMetadataVariant> | null;
}): Promise<YoutubeMetadataVariant[]> {
  if (input.scripts.length !== 5) {
    throw new Error("Для SEO-вариантов нужны пять сценариев.");
  }
  const example = input.example && JSON.stringify(input.example);
  const raw = await requestScript([
    {
      role: "system",
      content: [
        "Ты редактор YouTube Shorts на русском языке.",
        "По пяти готовым сценариям создай ровно пять SEO-вариантов публикации.",
        "Для каждого варианта верни короткий цепляющий заголовок с улучшенным hook, описание, 5–15 тегов без # и 2–8 хэштегов с #.",
        "Заголовок варианта 1 должен быть основан на первом сценарии.",
        "Варианты 2–5 должны быть самостоятельными, но сохранять смысл соответствующего сценария.",
        "Если пользователь дал пример SEO, слегка модернизируй его: сохрани тему, ключевые слова и тон, но не копируй дословно.",
        "Не добавляй факты, которых нет в сценариях. Верни только JSON формата {\"variants\":[{\"title\":\"\",\"description\":\"\",\"tags\":[],\"hashtags\":[]}, ...]}.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        example ? `Пример SEO от пользователя:\n${example}` : "Примера SEO нет — придумай всё самостоятельно по сценариям.",
        "",
        "Пять сценариев:",
        ...input.scripts.map((script, index) => `СЦЕНАРИЙ ${index + 1}:\n${script}`),
      ].join("\n\n"),
    },
  ], 6000);
  const parsed = z.object({
    variants: z.array(z.object({
      title: z.string().min(1),
      description: z.string().min(1),
      tags: z.array(z.string()).default([]),
      hashtags: z.array(z.string()).default([]),
    })).length(5),
  }).parse(parseJson(raw));
  return parsed.variants.map((variant) => ({
    title: variant.title.slice(0, 100),
    description: variant.description,
    tags: variant.tags.map((tag) => tag.replace(/^#/, "").trim()).filter(Boolean).slice(0, 30),
    hashtags: variant.hashtags
      .map((tag) => tag.startsWith("#") ? tag : `#${tag}`)
      .filter((tag) => tag.length > 1)
      .slice(0, 20),
  }));
}

export function formatScriptForTelegram(script: VideoScript): string {
  const scenes = script.scenes
    .map(
      (scene) =>
        `СЦЕНА ${scene.scene_number} · ${scene.duration_seconds} сек\n` +
        `Текст: ${scene.voice_text}\n` +
        `Зачем сцена: ${scene.scene_purpose}\n` +
        `Ход истории: ${scene.story_beat}\n` +
        `Причина: ${scene.cause}\n` +
        `Действие: ${scene.action}\n` +
        `Препятствие: ${scene.obstacle}\n` +
        `Изменение: ${scene.change}\n` +
        `Связность: ${scene.continuity}\n` +
        `Переход: ${scene.transition}\n` +
        `Визуал: ${scene.visual_description}\n` +
        `Image Prompt: ${scene.image_prompt}`,
    )
    .join("\n\n");

  return [
    `НАЗВАНИЕ\n${script.title}`,
    `HOOK\n${script.hook}`,
    `ОПИСАНИЕ\n${script.description}`,
    `СЦЕНЫ\n${scenes}`,
    `ФИНАЛ\n${script.ending}`,
    `CTA\n${script.cta || "—"}`,
  ].join("\n\n");
}