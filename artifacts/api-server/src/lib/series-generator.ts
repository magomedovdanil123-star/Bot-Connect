import { z } from "zod";
import { openRouterConfig } from "./openrouter-config";

const characterSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  age: z.string().min(1),
  appearance: z.string().min(1),
  clothing: z.string().min(1),
  personality: z.string().min(1),
  motivation: z.string().min(1),
  secret: z.string().min(1),
});

const episodePlanSchema = z.object({
  episode_number: z.coerce.number().int().positive(),
  title: z.string().min(1),
  synopsis: z.string().min(1),
  hook: z.string().min(1),
  local_location: z.string().min(1),
  cliffhanger: z.string().min(1),
});

export const seriesConceptSchema = z.object({
  title: z.string().min(1),
  premise: z.string().min(1),
  logline: z.string().min(1),
  genre: z.string().min(1),
  audience: z.string().min(1),
  main_conflict: z.string().min(1),
  season_arc: z.string().min(1),
  world_rules: z.array(z.string().min(1)).min(3),
  characters: z.array(characterSchema).min(1),
  locations: z.array(z.string().min(1)).min(1),
  visual_style: z.string().min(1),
  episodes: z.array(episodePlanSchema).min(3),
});

export type SeriesConcept = z.infer<typeof seriesConceptSchema>;

export function extractSeriesDirectives(prompt: string): {
  city?: string;
  profession?: string;
  episodeDuration?: number;
  episodeCount?: number;
  locations?: string[];
  ctaText?: string;
  ctaPlacement?: "opening" | "middle" | "ending";
} {
  const value = (pattern: RegExp) => prompt.match(pattern)?.[1]?.trim();
  const duration = Number.parseInt(value(/(?:длительность|серии по)\s*[:=-]?\s*(\d+)\s*(?:сек|с)/iu) || "", 10);
  const count = Number.parseInt(value(/(?:количество серий|серий|эпизодов)\s*[:=-]?\s*(\d+)/iu) || "", 10);
  const locations = value(/(?:локации|места)\s*[:=-]\s*([^\n]+)/iu)
    ?.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
  const ctaPlacement = /(?:cta|призыв)[^\n]*(?:начал|вступлен)/iu.test(prompt)
    ? "opening"
    : /(?:cta|призыв)[^\n]*(?:внутри|середин)/iu.test(prompt) ? "middle" : "ending";
  return {
    city: value(/(?:город|city)\s*[:=-]\s*([^\n,.;]+)/iu),
    profession: value(/(?:профессия|направление)\s*[:=-]\s*([^\n,.;]+)/iu),
    episodeDuration: Number.isFinite(duration) && duration >= 30 && duration <= 600 ? duration : undefined,
    episodeCount: Number.isFinite(count) && count >= 3 && count <= 24 ? count : undefined,
    locations: locations?.length ? locations : undefined,
    ctaText: value(/(?:cta|призыв)\s*[:=-]\s*([^\n]+)/iu),
    ctaPlacement,
  };
}

function parseJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Ответ AI не содержит JSON сериала");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

async function requestSeries(messages: Array<{ role: "system" | "user"; content: string }>): Promise<string> {
  if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(openRouterConfig.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openRouterConfig.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://replit.com",
          "X-Title": "AI Content Factory Series",
        },
        body: JSON.stringify({
          model: openRouterConfig.model,
          messages,
          max_tokens: 12000,
          temperature: 0.85,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (response.ok) {
        const content = data.choices?.[0]?.message?.content?.trim();
        if (content) return content;
      } else if (attempt === 3) {
        throw new Error(data.error?.message || `OpenRouter API error (${response.status})`);
      }
    } catch (error) {
      if (attempt === 3) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }
  throw new Error("Series concept generation failed");
}

export async function generateSeriesConcept(input: {
  prompt: string;
  city?: string;
  profession?: string;
  episodeDuration?: number;
  episodeCount?: number;
  locations?: string[];
  ctaText?: string;
}): Promise<SeriesConcept> {
  const city = input.city || "Новосибирск";
  const profession = input.profession || "курьер";
  const episodeCount = input.episodeCount || 8;
  const duration = input.episodeDuration || 90;
  const locations = input.locations?.length
    ? input.locations
    : ["Новосибирский оперный театр", "площадь Ленина", "СГУПС", "Красный проспект", "Академгородок"];
  const userPrompt = [
    `Авторский промт: ${input.prompt}`,
    `Город: ${city}`,
    `Профессия/направление: ${profession}`,
    `Количество серий первого сезона: ${episodeCount}`,
    `Длительность каждой серии: ${duration} секунд`,
    `Реальные локации для контекста: ${locations.join(", ")}`,
    `CTA: ${input.ctaText || `Хочешь стать ${profession}ом в ${city}? Переходи в мой Telegram.`}`,
  ].join("\n");
  const systemPrompt = [
    "Ты шоураннер локального сериала для коротких видео и рекрутингового контента.",
    "Создай связный первый сезон с одной сквозной интригой и самостоятельным событием в каждой серии.",
    "Главный герой и его identity anchor должны сохраняться: лицо, возраст, волосы, одежда и ключевые аксессуары.",
    "Используй только реальные названия мест как локационный контекст. Не придумывай факты, вывески, обвинения или события о реальных организациях.",
    "В каждой серии обязателен hook первых секунд и cliffhanger, который мотивирует ждать следующую серию.",
    "CTA должен быть мягким и нативным, не заменять финал истории.",
    `Верни ровно ${episodeCount} серий. Верни только JSON без markdown.`,
    JSON.stringify({
      title: "Название сериала",
      premise: "Концепция",
      logline: "Одно предложение",
      genre: "Жанр",
      audience: "Аудитория",
      main_conflict: "Главный конфликт",
      season_arc: "Сквозная арка сезона",
      world_rules: ["Правило мира"],
      characters: [{
        name: "Имя",
        role: "Роль",
        age: "Возраст",
        appearance: "Внешность",
        clothing: "Одежда",
        personality: "Характер",
        motivation: "Мотивация",
        secret: "Секрет",
      }],
      locations,
      visual_style: "Визуальный стиль",
      episodes: [{
        episode_number: 1,
        title: "Название серии",
        synopsis: "Событие",
        hook: "Hook",
        local_location: locations[0],
        cliffhanger: "Cliffhanger",
      }],
    }),
  ].join("\n");
  let raw = await requestSeries([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ]);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const parsed = seriesConceptSchema.parse(parseJson(raw));
      const numbers = parsed.episodes.map((episode) => episode.episode_number);
      if (numbers.some((number, index) => number !== index + 1)) throw new Error("Номера серий должны идти последовательно");
      if (parsed.episodes.length !== episodeCount) throw new Error(`Должно быть ровно ${episodeCount} серий`);
      return parsed;
    } catch (error) {
      if (attempt === 2) throw new Error(`AI вернул некорректную библию сериала: ${error instanceof Error ? error.message : "ошибка структуры"}`);
      raw = await requestSeries([
        { role: "system", content: systemPrompt },
        { role: "user", content: `${userPrompt}\nИсправь JSON по ошибке: ${error instanceof Error ? error.message : "ошибка"}\nПредыдущий ответ:\n${raw}` },
      ]);
    }
  }
  throw new Error("Series concept generation failed");
}

export function formatSeriesConcept(concept: SeriesConcept, ctaText: string): string {
  const characters = concept.characters.map((character) =>
    `• ${character.name} — ${character.role}; ${character.appearance}; одежда: ${character.clothing}; мотивация: ${character.motivation}`,
  ).join("\n");
  const episodes = concept.episodes.map((episode) =>
    `${episode.episode_number}. ${episode.title}\nСобытие: ${episode.synopsis}\nЛокация: ${episode.local_location}\nHook: ${episode.hook}\nФинальный крючок: ${episode.cliffhanger}`,
  ).join("\n\n");
  return [
    `🎞 СЕРИАЛ: ${concept.title}`,
    "",
    `Концепция: ${concept.premise}`,
    `Жанр: ${concept.genre}`,
    `Аудитория: ${concept.audience}`,
    `Главный конфликт: ${concept.main_conflict}`,
    `Арка сезона: ${concept.season_arc}`,
    "",
    "👥 ГЕРОИ",
    characters,
    "",
    `📍 ЛОКАЦИИ: ${concept.locations.join(", ")}`,
    `🎨 ВИЗУАЛ: ${concept.visual_style}`,
    `📣 CTA: ${ctaText}`,
    "",
    "📺 ПЛАН ПЕРВОГО СЕЗОНА",
    episodes,
  ].join("\n");
}