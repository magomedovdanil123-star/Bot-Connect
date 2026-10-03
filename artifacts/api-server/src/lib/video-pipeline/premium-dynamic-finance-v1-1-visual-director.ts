import type { LongformVoice } from "./longform-visual-director";

export const PREMIUM_DYNAMIC_FINANCE_V1_1_VERSION =
  "PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_DIVERSITY" as const;

export const PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES = [
  "COIN_INTRO",
  "MARKET_DATA",
  "PRICE_CHART",
  "STAT_CARD",
  "TIMELINE",
  "COMPARISON",
  "NEWS_CARD",
  "UI_TERMINAL",
  "ILLUSTRATION",
  "ICON_CLUSTER",
  "QUOTE",
  "FULLSCREEN_IMPACT",
] as const;

export type PremiumDynamicFinanceV1_1VisualType =
  typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES[number];

export const PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TAGS = [
  "COIN_MENTION",
  "PRICE",
  "PRICE_GROWTH",
  "PRICE_DROP",
  "MARKET_CAP",
  "VOLUME",
  "ATH",
  "ATL",
  "PERCENTAGE",
  "STATISTIC",
  "HISTORY",
  "YEAR",
  "FOUNDER",
  "PERSON",
  "NEWS",
  "COMMUNITY",
  "BLOCKCHAIN",
  "TECHNOLOGY",
  "EXCHANGE",
  "TRADING",
  "RISK",
  "WARNING",
  "COMPARISON",
  "TIMELINE",
  "QUOTE",
  "CONCLUSION",
  "HYPE",
  "GROWTH",
  "COLLAPSE",
  "FUTURE",
  "LIST",
  "EXPLANATION",
] as const;

export type PremiumDynamicFinanceV1_1SemanticTag =
  typeof PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TAGS[number];

export type PremiumDynamicFinanceV1_1Layout =
  | "left"
  | "right"
  | "wide"
  | "centered"
  | "fullscreen";

export type PremiumDynamicFinanceV1_1VisualEvent = {
  sceneId: number;
  startMs: number;
  endMs: number;
  text: string;
  visualType: PremiumDynamicFinanceV1_1VisualType;
  semanticTags: PremiumDynamicFinanceV1_1SemanticTag[];
  layout: PremiumDynamicFinanceV1_1Layout;
  backgroundKey: string;
  assetKeys: string[];
  decorative: boolean;
  fallbackReason?: string;
  diversityAdjusted: boolean;
};

export type PremiumDynamicFinanceV1_1VisualPlan = {
  version: typeof PREMIUM_DYNAMIC_FINANCE_V1_1_VERSION;
  events: PremiumDynamicFinanceV1_1VisualEvent[];
  visualTypeCounts: Record<PremiumDynamicFinanceV1_1VisualType, number>;
  repeatedVisualTypes: number;
  repeatedAssets: string[];
  fallbackScenes: number;
  diagnostics: {
    recentVisualTypes: PremiumDynamicFinanceV1_1VisualType[];
    recentAssets: string[];
    recentLayouts: PremiumDynamicFinanceV1_1Layout[];
    recentBackgrounds: string[];
    adjustedSceneIds: number[];
  };
};

export type PremiumDynamicFinanceV1_1Entity = {
  id: string;
  name: string;
  symbol: string;
};

const RECENT_WINDOW = 4;
const BACKGROUND_MOTIFS = [
  "orbital-glow",
  "terminal-grid",
  "diagonal-rails",
  "soft-particles",
  "signal-wave",
] as const;

function normalize(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

function contains(text: string, expression: RegExp): boolean {
  return expression.test(text);
}

function entityIsMentioned(text: string, entity: PremiumDynamicFinanceV1_1Entity): boolean {
  const normalized = normalize(text);
  const candidates = [entity.name, entity.symbol, entity.id]
    .map(normalize)
    .filter((candidate) => candidate.length >= 3);
  return candidates.some((candidate) => {
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, "iu").test(normalized);
  });
}

export function detectPremiumDynamicFinanceV1_1SemanticTags(
  text: string,
  entity: PremiumDynamicFinanceV1_1Entity,
): PremiumDynamicFinanceV1_1SemanticTag[] {
  const normalized = normalize(text);
  const tags = new Set<PremiumDynamicFinanceV1_1SemanticTag>();
  const add = (
    tag: PremiumDynamicFinanceV1_1SemanticTag,
    expression: RegExp,
  ) => {
    if (contains(normalized, expression)) tags.add(tag);
  };

  if (entityIsMentioned(normalized, entity)) tags.add("COIN_MENTION");
  add("PRICE", /(?:цен\p{L}*|курс|стоимост\p{L}*|price)/iu);
  add("PRICE_GROWTH", /(?:вырос|рост|поднял|увеличил|пробил|роста)/iu);
  add("PRICE_DROP", /(?:упал|снизил|падени|просад|обвал|коррекци)/iu);
  add("MARKET_CAP", /(?:капитализац|market\s*cap)/iu);
  add("VOLUME", /(?:объ[её]м|оборот|volume)/iu);
  add("ATH", /(?:\bath\b|историческ.{0,12}максим|максимум)/iu);
  add("ATL", /(?:\batl\b|историческ.{0,12}миним|минимум)/iu);
  add("PERCENTAGE", /(?:%|процент|процента|процентов|изменени.{0,12}за семь дней)/iu);
  add("STATISTIC", /(?:\d|статистик|показател|ранг|рейтинг|срез|данные|факт)/iu);
  add("HISTORY", /(?:истори|раньше|происхожд|запуск|появил|генезис)/iu);
  add("YEAR", /(?:^|\D)(?:19|20)\d{2}(?:\D|$)|(?:год|года|генезис)/iu);
  add("FOUNDER", /(?:основател|создател|founder)/iu);
  add("PERSON", /(?:\b[A-ZА-ЯЁ][a-zа-яё]+ [A-ZА-ЯЁ][a-zа-яё]+\b|человек|автор)/u);
  add("NEWS", /(?:новост|событи|заголов|пресс-релиз|редакционн.{0,12}карточк)/iu);
  add("COMMUNITY", /(?:сообществ|участник|комьюнити|community)/iu);
  add("BLOCKCHAIN", /(?:блокчейн|ончейн|узел|транзакци|blockchain)/iu);
  add("TECHNOLOGY", /(?:технолог|протокол|сеть|код|open.source)/iu);
  add("EXCHANGE", /(?:бирж|обменник|exchange|стакан заявок)/iu);
  add("TRADING", /(?:торг|сделк|заявк|кошел[её]к|trading)/iu);
  add("RISK", /(?:риск|волатил|убыт|потер|гаранти|обещани)/iu);
  add("WARNING", /(?:не смешивать|отделим|предупреж|не прогноз|не является обещанием)/iu);
  add("COMPARISON", /(?:сравн|по сравнению|напротив|против|vs\.?)/iu);
  add("TIMELINE", /(?:временн.{0,12}шкал|этап|затем|по порядку|сначала.{0,30}затем)/iu);
  add("QUOTE", /(?:[«»“”"]|цитат|редакционн.{0,12}вывод)/u);
  add("CONCLUSION", /(?:итог|вывод|главн.{0,12}мысл|заключени|поэтому)/iu);
  add("HYPE", /(?:хайп|ажиотаж|внимани|знаменит|шум)/iu);
  add("GROWTH", /(?:рост|вырос|увелич|раст[её]т)/iu);
  add("COLLAPSE", /(?:обвал|крах|схлоп|коллапс)/iu);
  add("FUTURE", /(?:будущ|прогноз|дальше|завтра)/iu);
  add("LIST", /(?:список|перечислим|три темы|несколько пунктов|во-первых|во-вторых)/iu);
  add("EXPLANATION", /(?:объясн|представим|схема|разбер[её]м|показывает)/iu);

  return PREMIUM_DYNAMIC_FINANCE_V1_1_SEMANTIC_TAGS.filter((tag) => tags.has(tag));
}

function hasAny(
  tags: ReadonlySet<PremiumDynamicFinanceV1_1SemanticTag>,
  ...values: PremiumDynamicFinanceV1_1SemanticTag[]
): boolean {
  return values.some((value) => tags.has(value));
}

function candidateVisualTypes(
  tags: ReadonlySet<PremiumDynamicFinanceV1_1SemanticTag>,
  firstEntityMention: boolean,
  text: string,
): PremiumDynamicFinanceV1_1VisualType[] {
  if (firstEntityMention) return ["COIN_INTRO", "ILLUSTRATION"];
  if (tags.has("COMPARISON")) return ["COMPARISON", "MARKET_DATA", "ILLUSTRATION"];
  if (tags.has("NEWS")) return ["NEWS_CARD", "TIMELINE", "QUOTE"];
  if (hasAny(tags, "EXCHANGE", "TRADING")) return ["UI_TERMINAL", "ILLUSTRATION", "ICON_CLUSTER"];
  if (
    tags.has("PRICE")
    && /(?:график|chart|боковик|линия цены|свечн|движени цены)/iu.test(text)
  ) {
    return ["PRICE_CHART", "MARKET_DATA", "ILLUSTRATION"];
  }
  if (tags.has("STATISTIC") && /(?:один факт|отдельно|выделить крупно|крупная цифра)/iu.test(text)) {
    return ["STAT_CARD", "TIMELINE", "MARKET_DATA"];
  }
  if (
    tags.has("MARKET_CAP")
    || tags.has("VOLUME")
    || (tags.has("PRICE") && (tags.has("PERCENTAGE") || tags.has("STATISTIC")))
  ) {
    return ["MARKET_DATA", "STAT_CARD", "PRICE_CHART"];
  }
  if (
    tags.has("PRICE")
    && (tags.has("PRICE_GROWTH") || tags.has("PRICE_DROP"))
  ) {
    return ["PRICE_CHART", "MARKET_DATA", "ILLUSTRATION"];
  }
  if (tags.has("TIMELINE") || (tags.has("HISTORY") && tags.has("YEAR"))) {
    return ["TIMELINE", "STAT_CARD", "NEWS_CARD"];
  }
  if (tags.has("LIST")) return ["ICON_CLUSTER", "ILLUSTRATION", "NEWS_CARD"];
  if (tags.has("QUOTE")) return ["QUOTE", "FULLSCREEN_IMPACT", "ILLUSTRATION"];
  if (hasAny(tags, "RISK", "WARNING", "CONCLUSION", "HYPE", "COLLAPSE")) {
    return ["FULLSCREEN_IMPACT", "QUOTE", "ILLUSTRATION"];
  }
  if (hasAny(tags, "BLOCKCHAIN", "TECHNOLOGY", "EXPLANATION", "COMMUNITY")) {
    return ["ILLUSTRATION", "ICON_CLUSTER", "UI_TERMINAL"];
  }
  if (hasAny(tags, "YEAR", "STATISTIC", "PERCENTAGE", "ATH", "ATL")) {
    return ["STAT_CARD", "TIMELINE", "MARKET_DATA"];
  }
  return ["ILLUSTRATION", "QUOTE", "FULLSCREEN_IMPACT"];
}

function defaultLayout(
  visualType: PremiumDynamicFinanceV1_1VisualType,
  index: number,
): PremiumDynamicFinanceV1_1Layout {
  if (visualType === "FULLSCREEN_IMPACT") return "fullscreen";
  if (visualType === "TIMELINE" || visualType === "COMPARISON") return "wide";
  if (visualType === "QUOTE") return "centered";
  return index % 2 === 0 ? "left" : "right";
}

function sceneAssetKeys(
  visualType: PremiumDynamicFinanceV1_1VisualType,
  entity: PremiumDynamicFinanceV1_1Entity,
  dataAsOf: string,
  sceneId: number,
): string[] {
  switch (visualType) {
    case "COIN_INTRO":
      return [`coingecko:${entity.id}:logo`];
    case "MARKET_DATA":
      return [`coingecko:${entity.id}:snapshot:${dataAsOf}`];
    case "PRICE_CHART":
      return [`coingecko:${entity.id}:price-history:${dataAsOf}`];
    case "STAT_CARD":
      return [`coingecko:${entity.id}:genesis-date`];
    case "COMPARISON":
      return [`coingecko:${entity.id}:same-period-comparison:${dataAsOf}`];
    default:
      return [`editorial:${visualType.toLocaleLowerCase("en-US")}:${sceneId}`];
  }
}

export function buildPremiumDynamicFinanceV1_1VisualPlan(input: {
  voices: LongformVoice[];
  entity: PremiumDynamicFinanceV1_1Entity;
  dataAsOf: string;
}): PremiumDynamicFinanceV1_1VisualPlan {
  const grouped = new Map<number, LongformVoice[]>();
  for (const voice of input.voices
    .filter((item) => !item.isFullVoice && item.text.trim())
    .filter((item) => item.startTime !== null && item.endTime !== null)
    .sort((left, right) => (left.startTime ?? 0) - (right.startTime ?? 0))) {
    const voices = grouped.get(voice.sceneId) ?? [];
    voices.push(voice);
    grouped.set(voice.sceneId, voices);
  }

  const scenes = [...grouped.entries()]
    .map(([sceneId, voices]) => ({
      sceneId,
      startMs: Math.min(...voices.map((voice) => Math.max(0, Math.round(voice.startTime ?? 0)))),
      endMs: Math.max(...voices.map((voice) => Math.round(voice.endTime ?? 0))),
      text: voices.map((voice) => voice.text.trim()).join(" ").trim(),
    }))
    .filter((scene) => scene.endMs > scene.startMs)
    .sort((left, right) => left.startMs - right.startMs);
  if (!scenes.length) {
    throw new Error("Premium Dynamic V1.1 visual director requires timed script scenes");
  }
  if (!input.entity.id.trim() || !input.entity.name.trim() || !input.entity.symbol.trim()) {
    throw new Error("Premium Dynamic V1.1 visual director requires a resolved coin entity");
  }
  if (!Number.isFinite(Date.parse(input.dataAsOf))) {
    throw new Error("Premium Dynamic V1.1 visual director requires a valid market-data timestamp");
  }

  let entityIntroduced = false;
  const recentVisualTypes: PremiumDynamicFinanceV1_1VisualType[] = [];
  const recentAssets: string[] = [];
  const recentLayouts: PremiumDynamicFinanceV1_1Layout[] = [];
  const recentBackgrounds: string[] = [];
  const assetUseCounts = new Map<string, number>();
  const adjustedSceneIds: number[] = [];
  let previousVisualType: PremiumDynamicFinanceV1_1VisualType | undefined;
  let previousLayout: PremiumDynamicFinanceV1_1Layout | undefined;

  const events = scenes.map((scene, index): PremiumDynamicFinanceV1_1VisualEvent => {
    const semanticTags = detectPremiumDynamicFinanceV1_1SemanticTags(scene.text, input.entity);
    const entityMentioned = semanticTags.includes("COIN_MENTION");
    const firstEntityMention = entityMentioned && !entityIntroduced;
    if (entityMentioned) entityIntroduced = true;
    const candidates = candidateVisualTypes(new Set(semanticTags), firstEntityMention, scene.text);
    const semanticFallback = semanticTags.length === 0;
    let visualType = candidates[0]!;
    let diversityAdjusted = false;
    if (
      visualType === previousVisualType
      || recentVisualTypes.slice(-2).includes(visualType)
    ) {
      const alternative = candidates.find((candidate) =>
        candidate !== previousVisualType
        && !recentVisualTypes.slice(-2).includes(candidate),
      );
      if (alternative) {
        visualType = alternative;
        diversityAdjusted = true;
        adjustedSceneIds.push(scene.sceneId);
      }
    }

    let layout = defaultLayout(visualType, index);
    if (layout === previousLayout && layout !== "wide" && layout !== "fullscreen") {
      layout = layout === "left" ? "right" : layout === "right" ? "left" : "wide";
    }
    let backgroundIndex = index % BACKGROUND_MOTIFS.length;
    while (
      recentBackgrounds.slice(-2).includes(BACKGROUND_MOTIFS[backgroundIndex]!)
      && backgroundIndex < BACKGROUND_MOTIFS.length - 1
    ) {
      backgroundIndex += 1;
    }
    const backgroundKey = BACKGROUND_MOTIFS[backgroundIndex]!;
    const assetKeys = sceneAssetKeys(visualType, input.entity, input.dataAsOf, scene.sceneId);
    assetKeys.forEach((assetKey) => assetUseCounts.set(assetKey, (assetUseCounts.get(assetKey) ?? 0) + 1));
    const decorative = visualType === "NEWS_CARD" || visualType === "UI_TERMINAL" || visualType === "ILLUSTRATION";
    recentVisualTypes.push(visualType);
    recentAssets.push(...assetKeys);
    recentLayouts.push(layout);
    recentBackgrounds.push(backgroundKey);
    previousVisualType = visualType;
    previousLayout = layout;
    return {
      sceneId: scene.sceneId,
      startMs: scene.startMs,
      endMs: scene.endMs,
      text: scene.text,
      visualType,
      semanticTags,
      layout,
      backgroundKey,
      assetKeys,
      decorative,
      ...(semanticFallback
        ? { fallbackReason: "No semantic tags matched; use an editorial illustration." }
        : {}),
      diversityAdjusted,
    };
  });

  const visualTypeCounts = Object.fromEntries(
    PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES.map((visualType) => [
      visualType,
      events.filter((event) => event.visualType === visualType).length,
    ]),
  ) as Record<PremiumDynamicFinanceV1_1VisualType, number>;
  return {
    version: PREMIUM_DYNAMIC_FINANCE_V1_1_VERSION,
    events,
    visualTypeCounts,
    repeatedVisualTypes: events.slice(1).filter((event, index) =>
      event.visualType === events[index]!.visualType,
    ).length,
    repeatedAssets: [...assetUseCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([assetKey]) => assetKey),
    fallbackScenes: events.filter((event) => Boolean(event.fallbackReason)).length,
    diagnostics: {
      recentVisualTypes: recentVisualTypes.slice(-RECENT_WINDOW),
      recentAssets: recentAssets.slice(-RECENT_WINDOW),
      recentLayouts: recentLayouts.slice(-RECENT_WINDOW),
      recentBackgrounds: recentBackgrounds.slice(-RECENT_WINDOW),
      adjustedSceneIds,
    },
  };
}

const coinLogoCache = new Map<string, Promise<string | null>>();

export function resolvePremiumDynamicFinanceV1_1CachedLogo(
  coinId: string,
  loader: () => Promise<string | null>,
): Promise<string | null> {
  const key = coinId.trim().toLowerCase();
  if (!key) return Promise.reject(new Error("Coin logo cache requires a coin ID"));
  const cached = coinLogoCache.get(key);
  if (cached) return cached;
  const pending = loader().catch((error: unknown) => {
    coinLogoCache.delete(key);
    throw error;
  });
  coinLogoCache.set(key, pending);
  return pending;
}

export function clearPremiumDynamicFinanceV1_1LogoCacheForTests(): void {
  coinLogoCache.clear();
}