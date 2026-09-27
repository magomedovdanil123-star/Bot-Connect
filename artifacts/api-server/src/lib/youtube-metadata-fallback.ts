export type YoutubeMetadata = {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
};

export type YoutubeMetadataContentType = "story" | "finance" | "crypto";

export const REQUIRED_YOUTUBE_BRAND_MARKERS = [
  "@viberolebot",
  "#viberolebot",
  "#вайббот",
] as const;

export function ensureYoutubeBrandMarkers(description: string): string {
  const base = description.trim();
  const normalizedBase = base.toLocaleLowerCase();
  const missing = REQUIRED_YOUTUBE_BRAND_MARKERS.filter((marker) =>
    !normalizedBase.includes(marker.toLocaleLowerCase()),
  );
  if (!missing.length) return base.slice(0, 5000);
  const suffix = missing.join(" ");
  const baseLimit = Math.max(0, 5000 - suffix.length - 2);
  const trimmedBase = base.slice(0, baseLimit).trimEnd();
  return `${trimmedBase}${trimmedBase ? "\n\n" : ""}${suffix}`.slice(0, 5000);
}

export function readableYoutubeScriptText(scriptText?: string): string {
  const raw = scriptText?.trim() || "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return raw;
    if (typeof parsed.youtubeSourceScriptText === "string" && parsed.youtubeSourceScriptText.trim()) {
      return parsed.youtubeSourceScriptText.trim();
    }
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    const spokenScenes = scenes
      .filter((scene): scene is Record<string, unknown> => Boolean(scene) && typeof scene === "object" && !Array.isArray(scene))
      .map((scene) => typeof scene.voice_text === "string" ? scene.voice_text : "")
      .filter(Boolean);
    return [
      typeof parsed.title === "string" ? parsed.title : "",
      typeof parsed.hook === "string" ? parsed.hook : "",
      typeof parsed.description === "string" ? parsed.description : "",
      ...spokenScenes,
      typeof parsed.ending === "string" ? parsed.ending : "",
      typeof parsed.cta === "string" ? parsed.cta : "",
    ].filter(Boolean).join("\n\n").trim() || raw;
  } catch {
    return raw;
  }
}

function youtubeContext(input: {
  topic: string;
  description: string;
  scriptText?: string;
}): { city: string; profession: string; hero: string; plot: string } {
  const readableScript = readableYoutubeScriptText(input.scriptText);
  const sourceText = `${input.topic}\n${input.description}\n${readableScript}`;
  const city = input.topic.match(/город\s*:\s*([^.\n]+)/iu)?.[1]?.trim() || "";
  const profession = input.topic.match(/професс(?:ия|ию)\s*:\s*([^.\n]+)/iu)?.[1]?.trim()
    || (/\bкурьер\b/iu.test(sourceText) ? "курьер" : "герой");
  const hero = input.description.match(/\bя\s+([А-ЯЁ][а-яё-]+)/u)?.[1] || "герой";
  const plot = readableScript
    || input.description.match(/Сюжет:\s*([\s\S]*?)(?:\n\n|Что происходит|Финал:|$)/iu)?.[1]?.trim()
    || input.description.replace(/^(?:Название|Завязка|Сюжет|Что происходит в ролике|Финал):\s*/gim, "").trim();
  return { city, profession, hero, plot };
}

const DELIVERY_TERMS = /\b(?:заказ\p{L}*|курьер\p{L}*|достав\p{L}*|яндекс\s*ед\p{L}*)\b/iu;

export function sourceExplicitlyMentionsDelivery(input: {
  title: string;
  topic: string;
  description: string;
  scriptText?: string;
}): boolean {
  return DELIVERY_TERMS.test(`${input.title}\n${input.topic}\n${input.description}\n${input.scriptText || ""}`);
}

export function removeUnrequestedDeliveryMetadata(metadata: YoutubeMetadata): YoutubeMetadata {
  const cleanTitle = metadata.title
    .replace(DELIVERY_TERMS, "")
    .replace(/\s{2,}/gu, " ")
    .replace(/\s+([:—,-])/gu, "$1")
    .replace(/([:—,-])\s*([:—,-])/gu, "$1")
    .trim();
  const cleanDescription = metadata.description
    .split(/\n+|(?<=[.!?])\s+/u)
    .filter((part) => !DELIVERY_TERMS.test(part))
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return {
    ...metadata,
    title: cleanTitle || "Что произошло дальше?",
    description: cleanDescription || "История, которую стоит досмотреть до конца.",
    tags: metadata.tags.filter((tag) => !DELIVERY_TERMS.test(tag)),
  };
}

const SEO_STOP_WORDS = new Set([
  "когда", "который", "которая", "которые", "этот", "этого", "потом", "после",
  "перед", "между", "через", "только", "самый", "свой", "свою", "было", "стало",
  "один", "одна", "одном", "очень", "история", "ролик", "герой", "девушка",
  "мужчина", "женщина", "сегодня", "каждый", "начала", "конце", "просто",
]);

function storyKeywords(input: { topic: string; description: string; scriptText?: string }): string[] {
  const words = `${input.topic} ${input.description} ${readableYoutubeScriptText(input.scriptText)}`
    .toLocaleLowerCase()
    .match(/[а-яёa-z0-9]{5,}/gu) || [];
  return [...new Set(words)]
    .filter((word) => !SEO_STOP_WORDS.has(word))
    .filter((word) => !DELIVERY_TERMS.test(word))
    .slice(0, 8);
}

export function relevantYoutubeTags(input: {
  title: string;
  topic: string;
  description: string;
  scriptText?: string;
  contentType?: YoutubeMetadataContentType;
}): string[] {
  const context = youtubeContext(input);
  const deliveryContext = sourceExplicitlyMentionsDelivery(input);
  const keywords = storyKeywords(input);
  const contentType = input.contentType ?? "story";
  const topicTicker = input.topic.trim().match(/^\$?([A-Z0-9]{2,20})(?:USDT)?$/i)?.[1];
  const tags = contentType === "story"
    ? [
        "shorts",
        "история из жизни",
        deliveryContext ? "истории курьера" : "",
        deliveryContext ? "работа курьером" : "",
        deliveryContext ? "доставка" : "",
        deliveryContext ? context.profession : "",
        deliveryContext && context.city ? `${context.profession} ${context.city}` : "",
        deliveryContext && context.city ? `доставка ${context.city}` : "",
        deliveryContext && /яндекс\s*ед/iu.test(`${input.topic} ${input.description}`) ? "Яндекс Еда" : "",
        deliveryContext && /новосибирск/iu.test(`${input.topic} ${input.description}`) ? "курьер Новосибирск" : "",
        ...keywords,
      ]
    : [
        "shorts",
        contentType === "crypto" ? "криптовалюта" : "финансы",
        contentType === "crypto" ? "крипторынок" : "финансовое образование",
        topicTicker?.toLocaleUpperCase("en-US") || "",
        ...keywords,
      ];
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 30);
}

export function fallbackYoutubeMetadata(input: {
  title: string;
  topic: string;
  description: string;
  scriptText?: string;
  channelTitle?: string;
  contentType?: YoutubeMetadataContentType;
}): YoutubeMetadata {
  const context = youtubeContext(input);
  const keywords = storyKeywords(input);
  const source = context.plot.replace(/\s+/gu, " ").trim();
  const contentType = input.contentType ?? "story";
  if (contentType !== "story") {
    const topic = (input.topic || input.title).replace(/\s+/gu, " ").trim().slice(0, 80);
    const hashtagTopic = (
      input.topic.match(/^\$?([A-Z0-9]{2,20})(?:USDT)?$/i)?.[1]
      || keywords[0]
      || "разбор"
    ).replace(/[^а-яёa-z0-9]/giu, "").toLocaleLowerCase();
    const hashtags = [
      "#shorts",
      contentType === "crypto" ? "#криптовалюта" : "#финансы",
      `#${hashtagTopic || (contentType === "crypto" ? "крипто" : "разбор")}`,
    ];
    const titleLead = (input.title || topic).replace(/\s+/gu, " ").trim().slice(0, 34);
    const title = `${titleLead || topic}: главное за минуту`.slice(0, 60).trim();
    const subject = topic || "тема ролика";
    const description = contentType === "crypto"
      ? `Краткий разбор «${subject}»: ключевые факты и контекст, приведённые в ролике.\n\nКриптовалютный рынок волатилен. Видео носит информационный характер и не является индивидуальной инвестиционной рекомендацией.\n\n${hashtags.join(" ")}`
      : `Краткий разбор «${subject}»: основные факты и понятия из ролика простым языком.\n\nМатериал носит образовательный характер и не является индивидуальной инвестиционной рекомендацией.\n\n${hashtags.join(" ")}`;
    return {
      title,
      description: ensureYoutubeBrandMarkers(description),
      tags: relevantYoutubeTags({ ...input, contentType }),
      hashtags,
    };
  }
  const titleSeed = source.slice(0, 38).replace(/[,:;—-]+$/u, "").trim();
  const uniqueSeed = `${input.scriptText || source}\n${input.channelTitle || ""}`;
  const seedHash = [...uniqueSeed].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7);
  const titleEndings = [
    "… но дальше всё изменилось",
    "… финал никто не ожидал",
    "— и вот что было дальше",
  ];
  const generatedTitle = `${titleSeed || input.title.trim().slice(0, 38) || "Что произошло дальше?"} ${titleEndings[seedHash % titleEndings.length]}`;
  const safeTitle = generatedTitle.slice(0, 60).trim();
  const hashtags = [
    "#shorts",
    `#${(keywords[0] || "история").replace(/[^а-яёa-z0-9]/giu, "")}`,
    `#${(keywords[1] || keywords[0] || "сюжет").replace(/[^а-яёa-z0-9]/giu, "")}`,
  ];
  const location = context.city ? ` из города ${context.city}` : "";
  const description = [
    `История о том, как ${context.profession}${location} оказался в ситуации, которую невозможно забыть.`,
    source.slice(0, 900) || "Иногда один неожиданный момент меняет весь привычный день.",
  ].join("\n\n").trim();
  return {
    title: safeTitle,
    description: ensureYoutubeBrandMarkers(`${description}\n\n${hashtags.join(" ")}`),
    tags: relevantYoutubeTags(input),
    hashtags,
  };
}

export function sanitizeSpecializedYoutubeMetadata(
  metadata: YoutubeMetadata,
  fallback: YoutubeMetadata,
  contentType: YoutubeMetadataContentType | undefined,
): YoutubeMetadata {
  if (!contentType || contentType === "story") return metadata;

  const unrelatedTagTerms = /(?:истори|сюжет|курьер|достав|заказ|переписк|герой)/iu;
  const safeTags = metadata.tags.filter((tag) => !unrelatedTagTerms.test(tag));
  const safeHashtags = metadata.hashtags.filter((tag) => !unrelatedTagTerms.test(tag));
  const hashtags = safeHashtags.length === 3
    && safeHashtags.some((tag) => !["#shorts", "#финансы", "#криптовалюта"].includes(tag.toLocaleLowerCase()))
    ? safeHashtags
    : fallback.hashtags;

  const unrelatedDescriptionTerms = /(?:история из жизни|переписк|курьер|достав|заказ|герой)/iu;
  const descriptionBase = unrelatedDescriptionTerms.test(metadata.description)
    ? fallback.description
    : metadata.description;
  const withoutHashtags = descriptionBase
    .replace(/(?:^|\s)#\S+/gu, "")
    .trim();
  const disclosure = contentType === "crypto"
    ? "Криптовалютный рынок волатилен. Видео носит информационный характер и не является индивидуальной инвестиционной рекомендацией."
    : "Материал носит образовательный характер и не является индивидуальной инвестиционной рекомендацией.";
  const hasDisclosure = /не является индивидуальной инвестиционной рекомендацией/iu.test(withoutHashtags);
  const description = [
    withoutHashtags,
    ...(!hasDisclosure ? [disclosure] : []),
    hashtags.join(" "),
  ].filter(Boolean).join("\n\n");

  return {
    ...metadata,
    title: unrelatedDescriptionTerms.test(metadata.title) ? fallback.title : metadata.title,
    description: ensureYoutubeBrandMarkers(description),
    tags: safeTags.length ? safeTags : fallback.tags,
    hashtags,
  };
}