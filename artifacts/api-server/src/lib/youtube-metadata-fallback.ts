export type YoutubeMetadata = {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
};

export type YoutubeMetadataContentType = "story" | "finance" | "crypto";
export type YoutubeVideoKind = "short" | "long";

export const REQUIRED_YOUTUBE_BRAND_MARKERS = [
  "@viberolebot",
  "#viberolebot",
  "#вайббот",
] as const;

const VIBE_BOT_PROMOTION = /(?:@|#)?viberolebot\b|#?вайб[\s._-]*бот|сервис\s+поиска\s+в\s+профиле/iu;
const VIBE_BOT_PROMOTION_GLOBAL = /(?:@|#)?viberolebot\b|#?вайб[\s._-]*бот|сервис\s+поиска\s+в\s+профиле/giu;

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

export function containsYoutubeBrandPromotion(text: string): boolean {
  return VIBE_BOT_PROMOTION.test(text);
}

function removeYoutubeBrandPromotionText(text: string): string {
  return text
    .replace(VIBE_BOT_PROMOTION_GLOBAL, "")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/[ \t]*\n[ \t]*/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .trim();
}

export function removeYoutubeBrandPromotion(metadata: YoutubeMetadata): YoutubeMetadata {
  return {
    ...metadata,
    title: removeYoutubeBrandPromotionText(metadata.title),
    description: removeYoutubeBrandPromotionText(metadata.description),
    tags: metadata.tags.filter((tag) => !containsYoutubeBrandPromotion(tag)),
    hashtags: metadata.hashtags.filter((hashtag) => !containsYoutubeBrandPromotion(hashtag)),
  };
}

export function isYoutubeFinancialContentType(
  contentType: YoutubeMetadataContentType | undefined,
): contentType is "finance" | "crypto" {
  return contentType === "finance" || contentType === "crypto";
}

export function inferYoutubeMetadataContentType(text: string): YoutubeMetadataContentType {
  if (/\b(?:crypto|bitcoin|ethereum|btc|eth|usdt|altcoin)\b|крипто|биткоин|эфириум|альткоин/iu.test(text)) {
    return "crypto";
  }
  if (/\bfinance\b|финанс|облигац|акци|дивиденд|бюджет|инвестиц|кредит|налог/iu.test(text)) {
    return "finance";
  }
  return "story";
}

export function shouldPostYoutubeComment(
  contentType: YoutubeMetadataContentType | undefined,
  commentText?: string,
): boolean {
  if (!isYoutubeFinancialContentType(contentType)) return true;
  return Boolean(commentText?.trim()) && !containsYoutubeBrandPromotion(commentText || "");
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
  videoKind?: YoutubeVideoKind;
}): string[] {
  const context = youtubeContext(input);
  const deliveryContext = sourceExplicitlyMentionsDelivery(input);
  const keywords = storyKeywords(input);
  const contentType = input.contentType ?? "story";
  const topicTicker = input.topic.trim().match(/^\$?([A-Z0-9]{2,20})(?:USDT)?$/i)?.[1];
  const tags = contentType === "story"
    ? [
        ...(input.videoKind === "long" ? [] : ["shorts"]),
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
        ...(input.videoKind === "long" ? [] : ["shorts"]),
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
  videoKind?: YoutubeVideoKind;
}): YoutubeMetadata {
  const context = youtubeContext(input);
  const keywords = storyKeywords(input);
  const source = context.plot.replace(/\s+/gu, " ").trim();
  const contentType = input.contentType ?? "story";
  const videoKind = input.videoKind ?? "short";
  if (contentType !== "story") {
    const topic = (input.topic || input.title).replace(/\s+/gu, " ").trim().slice(0, 80);
    const hashtagTopic = (
      input.topic.match(/^\$?([A-Z0-9]{2,20})(?:USDT)?$/i)?.[1]
      || keywords[0]
      || "разбор"
    ).replace(/[^а-яёa-z0-9]/giu, "").toLocaleLowerCase();
    const hashtags = videoKind === "long"
      ? [
          contentType === "crypto" ? "#криптовалюта" : "#финансы",
          contentType === "crypto" ? "#крипторынок" : "#финансовоеобразование",
          `#${hashtagTopic || (contentType === "crypto" ? "крипто" : "разбор")}`,
        ]
      : [
          "#shorts",
          contentType === "crypto" ? "#криптовалюта" : "#финансы",
          `#${hashtagTopic || (contentType === "crypto" ? "крипто" : "разбор")}`,
        ];
    const titleSuffix = videoKind === "long" ? " — подробный разбор" : ": главное за минуту";
    const titleLimit = videoKind === "long" ? 100 : 60;
    const titleLeadLimit = titleLimit - titleSuffix.length;
    const titleLead = (input.title || topic).replace(/\s+/gu, " ").trim().slice(0, titleLeadLimit);
    const title = `${titleLead || topic.slice(0, titleLeadLimit)}${titleSuffix}`.slice(0, titleLimit).trim();
    const subject = topic || "тема ролика";
    const description = contentType === "crypto"
      ? `${videoKind === "long" ? "Подробный" : "Краткий"} разбор «${subject}»: ключевые факты и контекст, приведённые в ролике.\n\nКриптовалютный рынок волатилен. Видео носит информационный характер и не является индивидуальной инвестиционной рекомендацией.\n\n${hashtags.join(" ")}`
      : `${videoKind === "long" ? "Подробный" : "Краткий"} разбор «${subject}»: основные факты и понятия из ролика простым языком.\n\nМатериал носит образовательный характер и не является индивидуальной инвестиционной рекомендацией.\n\n${hashtags.join(" ")}`;
    return {
      title,
      description,
      tags: relevantYoutubeTags({ ...input, contentType, videoKind }),
      hashtags,
    };
  }
  if (videoKind === "long") {
    const titleSeed = source.slice(0, 75).replace(/[,:;—-]+$/u, "").trim();
    const titleLead = (titleSeed || input.title.trim().slice(0, 75) || "Подробный разбор").slice(0, 77);
    const title = `${titleLead} — полный разбор`.slice(0, 100).trim();
    const topicHashtag = (keywords[0] || "разбор").replace(/[^а-яёa-z0-9]/giu, "").toLocaleLowerCase();
    const hashtags = [`#${topicHashtag || "разбор"}`, "#объяснение", "#разбор"];
    const subject = (input.topic || input.title).replace(/\s+/gu, " ").trim().slice(0, 100) || "тема видео";
    const description = [
      `Полноформатный разбор «${subject}»: основные идеи и контекст, раскрытые в видео.`,
      source.slice(0, 1_200),
      hashtags.join(" "),
    ].filter(Boolean).join("\n\n");
    return {
      title,
      description,
      tags: relevantYoutubeTags({ ...input, contentType, videoKind }),
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
  videoKind?: YoutubeVideoKind,
): YoutubeMetadata {
  if (!contentType || contentType === "story") {
    if (videoKind !== "long") return metadata;
    const safeTags = metadata.tags.filter((tag) => !/^shorts$/iu.test(tag.trim()));
    const safeHashtags = metadata.hashtags.filter((tag) => !/^#?shorts$/iu.test(tag.trim()));
    const hashtags = safeHashtags.length === 3 ? safeHashtags : fallback.hashtags;
    const descriptionBase = metadata.description.replace(/(?:^|\s)#shorts\b/giu, "").trim();
    const withoutHashtags = descriptionBase.replace(/(?:^|\s)#\S+/gu, "").trim();
    return {
      ...metadata,
      description: ensureYoutubeBrandMarkers(`${withoutHashtags}\n\n${hashtags.join(" ")}`),
      tags: safeTags.length ? safeTags : fallback.tags,
      hashtags,
    };
  }

  const unrelatedTagTerms = /(?:истори|сюжет|курьер|достав|заказ|переписк|герой)/iu;
  const safeTags = metadata.tags.filter((tag) =>
    !unrelatedTagTerms.test(tag) && !(videoKind === "long" && /^shorts$/iu.test(tag.trim())),
  );
  const safeHashtags = metadata.hashtags.filter((tag) =>
    !unrelatedTagTerms.test(tag) && !(videoKind === "long" && /^#?shorts$/iu.test(tag.trim())),
  );
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

  return removeYoutubeBrandPromotion({
    ...metadata,
    title: unrelatedDescriptionTerms.test(metadata.title) ? fallback.title : metadata.title,
    description,
    tags: safeTags.length ? safeTags : fallback.tags,
    hashtags,
  });
}