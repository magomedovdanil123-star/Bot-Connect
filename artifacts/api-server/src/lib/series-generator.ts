import { z } from "zod";
import { openRouterConfig } from "./openrouter-config";
import { CONTINUITY_EDITOR_RULES_RU } from "./story-rules";

const characterSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  age: z.string().min(1),
  appearance: z.string().min(1),
  clothing: z.string().min(1),
  personality: z.string().min(1),
  motivation: z.string().min(1),
  secret: z.string().default(""),
});

const episodePlanSchema = z.object({
  episode_number: z.coerce.number().int().positive(),
  title: z.string().min(1),
  synopsis: z.string().min(1),
  hook: z.string().min(1),
  local_location: z.string().min(1),
  cliffhanger: z.string().min(1),
  dramatic_goal: z.string().default(""),
  episode_conflict: z.string().default(""),
  turning_point: z.string().default(""),
  entry_state: z.string().default(""),
  exit_state: z.string().default(""),
  next_episode_bridge: z.string().default(""),
});

export const seriesConceptSchema = z.object({
  author_prompt: z.string().optional(),
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
  visualStyle?: string;
  ctaPlacement?: "opening" | "middle" | "ending";
} {
  const value = (pattern: RegExp) => prompt.match(pattern)?.[1]?.trim();
  const duration = Number.parseInt(value(/(?:длительность|серии по)\s*[:=-]?\s*(\d+)\s*(?:сек|с)/iu) || "", 10);
  const count = Number.parseInt(value(/(?:количество серий|серий|эпизодов)\s*[:=-]?\s*(\d+)/iu) || "", 10);
  const explicitLocations = value(/(?:локации|места)\s*[:=-]\s*([^\n]+)/iu)
    ?.split(/[,;]+/).map((item) => item.trim()).filter(Boolean);
  const explicitCity = value(/(?:город|city)\s*[:=-]\s*([^\n,.;]+)/iu);
  const naturalCity = value(/\b(?:из города|из)\s+([^,.;!?]+)/iu)
    ?.replace(/\s+(?:и|где|который|которая|про|о|на)\b.*$/iu, "")
    .trim();
  const ctaPlacement = /(?:cta|призыв)[^\n]*(?:начал|вступлен)/iu.test(prompt)
    ? "opening"
    : /(?:cta|призыв)[^\n]*(?:внутри|середин)/iu.test(prompt) ? "middle" : "ending";
  return {
    city: explicitCity || naturalCity,
    profession: value(/(?:профессия|направление)\s*[:=-]\s*([^\n,.;]+)/iu),
    episodeDuration: Number.isFinite(duration) && duration >= 30 && duration <= 180 ? duration : undefined,
    episodeCount: Number.isFinite(count) && count >= 3 && count <= 24 ? count : undefined,
    locations: explicitLocations?.length ? explicitLocations : undefined,
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
  visualStyle?: string;
}): Promise<SeriesConcept> {
  const city = input.city || "Новосибирск";
  const profession = input.profession || "курьер";
  const episodeCount = input.episodeCount || 8;
  const duration = input.episodeDuration || 120;
  const locations = input.locations?.length ? input.locations : [];
  const userPrompt = [
    `Авторский промт: ${input.prompt}`,
    `Город: ${city}`,
    `Профессия/направление: ${profession}`,
    `Количество серий первого сезона: ${episodeCount}`,
    `Длительность каждой серии: ${duration} секунд`,
    locations.length
      ? `Реальные локации для контекста (используй именно их): ${locations.join(", ")}`
      : `Список локаций не задан. Сам подбери 5–8 реально существующих узнаваемых мест, районов, улиц или транспортных узлов города ${city}. Не используй места другого города и не выдумывай несуществующие адреса.`,
    `Выбранный визуальный стиль: ${input.visualStyle || "realistic cinematic"}. Используй именно его во всей библии и всех сериях.`,
    `CTA: ${input.ctaText || `Хочешь стать ${profession}ом в ${city}? Переходи в мой Telegram.`}`,
  ].join("\n");
  const systemPrompt = [
    "Ты сценарист жизненного локального сериала для коротких видео, а не автор фантастического триллера.",
    "Основа сериала — узнаваемая бытовая история: конкретный человек, его район, работа, деньги, усталость, отношения и маленькие решения, которые постепенно меняют его жизнь.",
    "Если автор дал завязку, имя героя, адрес, профессию, локацию или последовательность событий, считай это каноном и развивай именно это. Не заменяй авторскую историю своей абстрактной концепцией.",
    "Перед написанием мысленно выпиши факты из авторского промта: кто герой, где живёт, где работает, что делает сначала, что происходит потом, чего он хочет и что меняется. Каждый факт должен попасть в библию или план серий.",
    "Создай связный первый сезон с понятной причинно-следственной линией и самостоятельным бытовым событием в каждой серии.",
    "Сначала спроектируй сезонную цепочку состояний героя: что он знает и имеет в начале каждой серии, чего хочет, что мешает, какое решение принимает и в каком новом состоянии заканчивает. Только потом формулируй синопсисы.",
    "Каждая серия должна быть следствием предыдущей: её hook или entry_state обязан продолжать exit_state прошлой серии. Не начинай каждую серию с новой случайной проблемы.",
    "У каждой серии должны быть dramatic_goal, episode_conflict, turning_point, entry_state, exit_state и next_episode_bridge. Это рабочая карта сценариста, а не общие рекламные описания.",
    "Не добавляй в cliffhanger событие, которое не было подготовлено действием серии. Cliffhanger должен быть естественным последствием выбора героя или конкретной детали, которую зритель уже видел.",
    "По умолчанию не используй тайные организации, загадочные алгоритмы, невозможные адреса, шпионские проверки, мистику, заговоры и пафосные формулировки. Добавляй такое только если автор прямо попросил.",
    "Каждая серия должна быть понятна без расшифровки: зритель сразу понимает, где герой, что он делает, чего хочет и что ему мешает.",
    "Пример нужной логики: герой живёт в своём районе, устраивается курьером, планирует выполнить пару заказов, берёт первый, потом второй и третий, втягивается, сталкивается с реальными трудностями и принимает решение идти дальше.",
    "Главный герой и его identity anchor должны сохраняться: лицо, возраст, волосы, одежда и ключевые аксессуары.",
    "Используй только реальные названия мест как локационный контекст. Не придумывай факты, вывески, обвинения или события о реальных организациях.",
    "Hook должен быть простым наблюдением или конкретным действием из жизни героя, а cliffhanger — естественным следующим шагом или решением, а не искусственной тайной.",
    "Пиши живым разговорным русским языком. Не используй рекламный, трейлерный и псевдокинематографичный стиль вроде «система активирована», «цепь поставок», «она видит ошибку» или «готов принять правила».",
    "CTA должен быть мягким и нативным, не заменять финал истории.",
    "Применяй следующие обязательные правила шоураннера и continuity-editor:",
    CONTINUITY_EDITOR_RULES_RU,
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
        secret: "Личная уязвимость или привычка героя, без детективной тайны",
      }],
      locations: locations.length ? locations : ["Реальные места выбранного города"],
       visual_style: "Реалистичный документальный стиль повседневной жизни",
      episodes: [{
        episode_number: 1,
        title: "Название серии",
        synopsis: "Событие",
        hook: "Hook",
        local_location: locations.length ? locations[0] : "Реальная локация выбранного города",
        cliffhanger: "Cliffhanger",
        dramatic_goal: "Чего герой пытается добиться в серии",
        episode_conflict: "Конкретное препятствие",
        turning_point: "Решение или поворот, меняющий ситуацию",
        entry_state: "Состояние героя и незакрытый вопрос на входе",
        exit_state: "Новое состояние героя после серии",
        next_episode_bridge: "Как действие этой серии запускает следующую",
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
      const missingEpisodeMap = parsed.episodes.find((episode) =>
        !episode.dramatic_goal ||
        !episode.episode_conflict ||
        !episode.turning_point ||
        !episode.entry_state ||
        !episode.exit_state ||
        !episode.next_episode_bridge,
      );
      if (missingEpisodeMap) {
        throw new Error(`Серия ${missingEpisodeMap.episode_number} не содержит полную карту цели, конфликта, поворота и перехода`);
      }
      const resolvedLocations = locations.length ? locations : parsed.locations;
      const normalizedEpisodes = parsed.episodes.map((episode, index) => ({
        ...episode,
        local_location: resolvedLocations.includes(episode.local_location)
          ? episode.local_location
          : resolvedLocations[index % resolvedLocations.length],
      }));
      return {
        ...parsed,
        author_prompt: input.prompt,
        visual_style: input.visualStyle || parsed.visual_style,
        locations: resolvedLocations,
        episodes: normalizedEpisodes,
      };
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
    `${episode.episode_number}. ${episode.title}\nСобытие: ${episode.synopsis}\nЦель героя: ${episode.dramatic_goal}\nКонфликт: ${episode.episode_conflict}\nПоворот: ${episode.turning_point}\nНа входе: ${episode.entry_state}\nНа выходе: ${episode.exit_state}\nСвязь со следующей: ${episode.next_episode_bridge}\nЛокация: ${episode.local_location}\nHook: ${episode.hook}\nФинальный крючок: ${episode.cliffhanger}`,
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