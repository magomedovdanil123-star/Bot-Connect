import { z } from "zod";
import { openRouterConfig } from "./openrouter-config";

const sceneSchema = z.object({
  scene_number: z.number().int().positive(),
  duration_seconds: z.number().int().positive(),
  voice_text: z.string().min(1),
  visual_description: z.string().min(1),
  image_prompt: z.string().min(1),
});

export const videoScriptSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  description: z.string().min(1),
  duration_seconds: z.number().int().positive(),
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
  "Сначала мысленно выстрой причинно-следственную историю: hook → герой и его цель → событие, которое запускает конфликт → нарастание препятствий → кульминация → последствие и логичный финал.",
  "Каждая следующая сцена обязана быть следствием предыдущей. Не вводи внезапно новых героев, мест или фактов без объяснения.",
  "Не перескакивай между несвязанными образами. Сохраняй одного главного героя, время, место и мотивацию, пока история не завершится.",
  "В конце обязательно разреши главный вопрос, заданный hook. CTA не должен заменять финал истории.",
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
      },
    ],
    ending: "Финальная фраза",
    cta: "Призыв к действию или пустая строка",
  }),
  "Сцен должно быть столько, сколько нужно для выбранной длительности. Для 60 секунд ориентируйся на 7-12 сцен.",
  "Ориентиры по структуре: сцены 1-2 знакомят с ситуацией и героем, середина усложняет проблему, последние 2 сцены дают кульминацию и последствие.",
  "Каждая сцена обязательно должна содержать voice_text, visual_description и image_prompt.",
  "Для естественной озвучки используй пунктуацию: запятые для коротких пауз, тире и многоточие для выразительных пауз.",
  "В неоднозначных русских словах можешь ставить знак ударения над гласной (например: зáмок/замóк), но не используй markdown или служебные теги.",
  "Если автор просит точную паузу, допускается маркер [пауза 0.5] в voice_text; он будет обработан перед отправкой в ElevenLabs.",
].join("\n");

function parseJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(cleaned);
}

function validateStoryStructure(script: VideoScript, duration: number): string | null {
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
  if (script.scenes[0].voice_text.split(/\s+/).filter(Boolean).length < 3) {
    return "первая сцена должна содержать понятный hook";
  }
  return null;
}

async function requestScript(messages: ChatMessage[]): Promise<string> {
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
          max_tokens: 8192,
          temperature: 0.8,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(90_000),
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

export async function generateVideoScript(input: ScriptRequest): Promise<VideoScript> {
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
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const parsed = videoScriptSchema.parse(parseJson(raw));
      if (parsed.duration_seconds !== input.duration) {
        throw new Error("duration_seconds does not match requested duration");
      }
      const structureError = validateStoryStructure(parsed, input.duration);
      if (structureError) throw new Error(structureError);
      return parsed;
    } catch (error) {
      if (attempt === 1) {
        throw new Error("AI returned an invalid script JSON");
      }
      raw = await requestScript([
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `${userPrompt}\n\nТы работаешь как строгий редактор. Исправь ответ: сцены должны быть причинно связаны, scene_number последовательны, сумма длительностей сцен должна быть ровно ${input.duration}, а финал должен разрешать конфликт. Верни только валидный JSON с обязательными полями:\n${raw}`,
        },
      ]);
    }
  }

  throw new Error("Script generation failed");
}

export function formatScriptForTelegram(script: VideoScript): string {
  const scenes = script.scenes
    .map(
      (scene) =>
        `СЦЕНА ${scene.scene_number} · ${scene.duration_seconds} сек\n` +
        `Текст: ${scene.voice_text}\n` +
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