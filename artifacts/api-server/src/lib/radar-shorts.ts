import { ensureYoutubeBrandMarkers, type YoutubeMetadata } from "./youtube-metadata-fallback";

export type RadarShortsPeriod = "24h" | "7d" | "30d";

export function radarShortsPeriodKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "⏱ За 24 часа — топ-10", callback_data: "crypto:radar_shorts:24h" }],
      [{ text: "📅 За 7 дней — топ-10", callback_data: "crypto:radar_shorts:7d" }],
      [{ text: "🗓 За 30 дней — топ-10", callback_data: "crypto:radar_shorts:30d" }],
      [{ text: "⬅️ Финансы", callback_data: "menu:finance" }],
    ],
  };
}

export function applyRadarShortsYoutubeSeo(
  metadata: YoutubeMetadata,
  input: {
    coinName: string;
    symbol: string;
    periodLabel: string;
    changePercent: number;
  },
): YoutubeMetadata {
  const coinName = input.coinName.trim();
  const symbol = input.symbol.trim().replace(/^\$/u, "").toLocaleUpperCase("en-US");
  const movement = input.changePercent > 0
    ? "рост"
    : input.changePercent < 0 ? "снижение" : "изменение";
  const percent = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(input.changePercent));
  const factLine = `Криптовалюта ${coinName} (${symbol}) — динамика за ${input.periodLabel}: ${movement} на ${percent}%.`;
  const descriptionWithoutHashtags = metadata.description
    .replace(/(?:^|\s)#\S+/gu, "")
    .trim();
  const hashtagSymbol = symbol.replace(/[^а-яёa-z0-9]/giu, "").toLocaleLowerCase("ru-RU") || "крипто";
  const hashtags = ["#shorts", "#криптовалюта", `#${hashtagSymbol}`];
  const description = ensureYoutubeBrandMarkers([
    factLine,
    descriptionWithoutHashtags,
    hashtags.join(" "),
  ].filter(Boolean).join("\n\n"));

  const tags = [
    "shorts",
    "криптовалюта",
    "крипторынок",
    "крипто",
    symbol,
    coinName,
    `${symbol} ${input.periodLabel}`,
    `${coinName} ${input.periodLabel}`,
    `цена ${symbol}`,
    `динамика ${symbol}`,
    `${movement} ${symbol}`,
    ...metadata.tags,
  ];
  const uniqueTags: string[] = [];
  const seenTags = new Set<string>();
  for (const rawTag of tags) {
    const tag = rawTag.trim().replace(/\s+/gu, " ");
    const normalized = tag.toLocaleLowerCase("ru-RU");
    if (!tag || seenTags.has(normalized)) continue;
    if (Buffer.byteLength([...uniqueTags, tag].join(","), "utf8") > 500) continue;
    uniqueTags.push(tag);
    seenTags.add(normalized);
    if (uniqueTags.length >= 30) break;
  }

  return { ...metadata, description, tags: uniqueTags, hashtags };
}