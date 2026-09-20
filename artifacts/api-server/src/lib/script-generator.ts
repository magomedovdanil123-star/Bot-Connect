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
      content?: string;
    };
  }>;
  error?: {
    message?: string;
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

function validateStoryStructure(script: VideoScript, duration: number, chatMode = false): string | null {
  const sceneNumbers = script.scenes.map((scene) => scene.scene_number);
  if (sceneNumbers.some((number, index) => number !== index + 1)) {
    return "scene_number должен идти последовательно от 1 без пропусков";
  }
  const totalDuration = script.scenes.reduce((sum, scene) => sum + scene.duration_seconds, 0);
  if (totalDuration !== duration) {
    return `сумма duration_seconds сцен должна быть ровно ${duration}, сейчас ${totalDuration}`;
  }
  if (script.scenes.length < 5) {
    return "слишком мало сцен для связной истории";
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
  if (lastScene && !/финал|последств|кульминац|крючок|развязк|выбор/i.test(lastScene.story_beat)) {
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

async function requestScript(messages: ChatMessage[], maxTokens = 8192): Promise<string> {
  const apiKey = openRouterConfig.apiKey;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let response: Response;
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
          model: openRouterConfig.model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.8,
          response_format: { type: "json_object" },
        }),
         signal: AbortSignal.timeout(SCRIPT_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      if (attempt < 3) {
        await waitBeforeProviderRetry(attempt);
        continue;
      }
      throw new Error(`OpenRouter connection failed: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    const data = (await response.json()) as OpenRouterResponse;
    if (!response.ok) {
      const transient = response.status === 408 || response.status === 429 || response.status >= 500;
      if (transient && attempt < 3) {
        await waitBeforeProviderRetry(attempt);
        continue;
      }
      if (response.status === 429) {
        throw new Error("OpenRouter rate limit exceeded after 3 attempts");
      }
      throw new Error(data.error?.message ?? `OpenRouter API error (${response.status})`);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      if (attempt < 3) {
        await waitBeforeProviderRetry(attempt);
        continue;
      }
      throw new Error("OpenRouter returned an empty response after 3 attempts");
    }
    return content;
  }

  throw new Error("OpenRouter script request failed");
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
    { role: "system", content: activeSystemPrompt },
    { role: "user", content: userPrompt },
  ], maxTokens);

  let lastValidationError = "неизвестная ошибка структуры";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsed = normalizeSceneDurations(videoScriptSchema.parse(parseJson(raw)), input.duration);
      const structureError = validateStoryStructure(parsed, input.duration, chatMode);
      if (structureError) throw new Error(structureError);
      return parsed;
    } catch (error) {
      lastValidationError = error instanceof Error ? error.message : "неизвестная ошибка структуры";
      if (attempt === 2) {
        throw new Error(`AI returned an invalid script JSON: ${lastValidationError}`);
      }
      raw = await requestScript([
        { role: "system", content: activeSystemPrompt },
        {
          role: "user",
          content: `${userPrompt}\n\nТы работаешь как строгий сценарный редактор и continuity-editor. Исправь ответ с учётом ошибки валидации: ${lastValidationError}. Сцены должны быть причинно связаны, scene_number последовательны, сумма длительностей сцен должна быть ровно ${input.duration}, каждая сцена должна менять ситуацию, а финал должен быть подготовлен предыдущими деталями и разрешать главный конфликт. Верни только валидный JSON с обязательными полями и полной редакторской картой каждой сцены:\n${raw}`,
        },
      ], maxTokens);
    }
  }

  throw new Error("Script generation failed");
}

export type HoroscopeMetadata = {
  idea: string;
  format: string;
  title_variants: [string, string, string];
  selected_title: string;
  keywords: string[];
  tags: string[];
  hashtags: string[];
  visual_mode: "AUTO" | "STOCK" | "AI_IMAGE";
  visual_search_queries: string[];
  visual_prompt: string;
};

export async function generateHoroscopeMetadata(input: {
  topic: string;
  channelName: string;
  niche: string;
  targetAudience: string;
  hook: string;
  script: VideoScript;
  recentContent?: string[];
}): Promise<HoroscopeMetadata> {
  const raw = await requestScript([
    {
      role: "system",
      content: [
        "Ты SEO-редактор и visual planner для русскоязычных Shorts о гороскопах.",
        "Создавай самостоятельный контент-пакет только по текущему сценарию.",
        "Не копируй прошлые идеи, hooks, названия или формулировки.",
        "Сначала создай ровно 3 варианта SEO-названия, затем выбери один наиболее подходящий.",
        "keywords — 5–12 релевантных ключевых слов.",
        "tags — 5–15 тегов без #.",
        "hashtags — 2–8 хэштегов с #.",
        "visual_search_queries — 3–6 коротких поисковых запросов для STOCK на английском языке.",
        "visual_prompt — подробный уникальный prompt для вертикального 9:16 изображения без лишнего текста.",
        "visual_mode выбирай из AUTO, STOCK, AI_IMAGE.",
        "format должен быть конкретным форматом ролика, а idea — краткой новой идеей.",
        "Верни только JSON без markdown.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Канал: ${input.channelName}`,
        `Ниша: ${input.niche}`,
        `Аудитория: ${input.targetAudience}`,
        `Тема запуска: ${input.topic}`,
        `Hook: ${input.hook}`,
        `Сценарий: ${JSON.stringify(input.script)}`,
        input.recentContent?.length
          ? `Недавние темы, которых нужно избегать:\n- ${input.recentContent.join("\n- ")}`
          : "Недавних материалов нет.",
        'Формат JSON: {"idea":"","format":"","title_variants":["","",""],"selected_title":"","keywords":[],"tags":[],"hashtags":[],"visual_mode":"AUTO","visual_search_queries":[],"visual_prompt":""}',
      ].join("\n\n"),
    },
  ], 6000);

  return z.object({
    idea: z.string().min(1),
    format: z.string().min(1),
    title_variants: z.array(z.string().min(1)).length(3).transform((items) => items as [string, string, string]),
    selected_title: z.string().min(1),
    keywords: z.array(z.string().min(1)).min(3),
    tags: z.array(z.string().min(1)).min(3),
    hashtags: z.array(z.string().regex(/^#/)).min(2),
    visual_mode: z.enum(["AUTO", "STOCK", "AI_IMAGE"]),
    visual_search_queries: z.array(z.string().min(1)).min(2),
    visual_prompt: z.string().min(1),
  }).parse(parseJson(raw));
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