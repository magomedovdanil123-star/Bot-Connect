const BINANCE_API = "https://api.binance.com";
const COINGECKO_API = "https://api.coingecko.com/api/v3";
const MINUTE_MS = 60 * 1_000;
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const REQUEST_TIMEOUT_MS = 12_000;
const NEWS_MAX_AGE_MS = 7 * DAY_MS;

export const MARKET_FOCUS_SCENE_DURATIONS_SECONDS = [
  12,
  12,
  10,
  8,
  9,
  7,
  8,
] as const;
export const MARKET_FOCUS_HYPOTHETICAL_STAKE_USD = 1_000;

export type MarketFocusCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  quoteVolume: number;
};

export type MarketFocusNewsItem = {
  title: string;
  url: string;
  sourceName: string;
  sourceDomain: string;
  publishedAt: string;
  verificationMethod: "publisher_rss";
};

export type MarketFocusPeriodBenchmark = {
  symbol: "BTC" | "ETH";
  changePercent: number;
};

export type MarketFocusMarketData = {
  coin: {
    name: string;
    symbol: string;
    pair: string;
    sourceUrl: string;
    logoDataUri?: string;
  };
  currency: "USDT";
  periodStartUtc: string;
  periodEndUtc: string;
  periodKind?: "rolling" | "closed_hourly" | "rolling_30d";
  hourlyCandles: MarketFocusCandle[];
  periodCandles?: MarketFocusCandle[];
  periodChangePercent?: number;
  periodHighPrice?: number;
  periodLowPrice?: number;
  periodDrawdownFromHighPercent?: number;
  periodQuoteVolume?: number;
  periodAverageDailyQuoteVolume?: number;
  periodVolumeVsAverage?: number;
  periodBenchmarks?: [MarketFocusPeriodBenchmark, MarketFocusPeriodBenchmark];
  dailyQuoteVolumes: Array<{
    dayUtc: string;
    quoteVolume: number;
  }>;
  currentPrice: number;
  changePercent24h: number;
  highPrice24h: number;
  lowPrice24h: number;
  drawdownFromHighPercent: number;
  quoteVolume24h: number;
  averageDailyQuoteVolume7d: number;
  volumeVs7dAverage: number;
  benchmarks: [
    { symbol: "BTC"; changePercent24h: number },
    { symbol: "ETH"; changePercent24h: number },
  ];
  news: MarketFocusNewsItem | null;
  retrievedAt: string;
};

export type MarketFocusStoryScene = {
  key: "impulse" | "candles" | "investment" | "volume" | "news" | "benchmarks" | "risk";
  title: string;
  subtitle: string;
  voiceText: string;
  visualHint: string;
  visualAction: string;
  soundEffect?: "cash_register" | "none";
};

type BinanceSymbolResponse = {
  symbols?: Array<{
    symbol?: unknown;
    status?: unknown;
    baseAsset?: unknown;
    quoteAsset?: unknown;
  }>;
};

type Binance24HourTicker = {
  symbol?: unknown;
  openTime?: unknown;
  closeTime?: unknown;
  openPrice?: unknown;
  highPrice?: unknown;
  lowPrice?: unknown;
  priceChangePercent?: unknown;
  quoteVolume?: unknown;
  lastPrice?: unknown;
};

type CoinGeckoSearchResponse = {
  coins?: Array<{
    id?: unknown;
    name?: unknown;
    symbol?: unknown;
    market_cap_rank?: unknown;
    large?: unknown;
    thumb?: unknown;
  }>;
};

type CoinPaprikaSearchResponse = {
  currencies?: Array<{
    id?: unknown;
    name?: unknown;
    symbol?: unknown;
    rank?: unknown;
    is_active?: unknown;
  }>;
};

type NewsFeed = {
  name: string;
  url: string;
  domain: string;
  officialSymbol?: string;
};

const GENERAL_NEWS_FEEDS: NewsFeed[] = [
  {
    name: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    domain: "coindesk.com",
  },
  {
    name: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
    domain: "cointelegraph.com",
  },
  {
    name: "Decrypt",
    url: "https://decrypt.co/feed",
    domain: "decrypt.co",
  },
  {
    name: "The Block",
    url: "https://www.theblock.co/rss.xml",
    domain: "theblock.co",
  },
  {
    name: "CryptoSlate",
    url: "https://cryptoslate.com/feed/",
    domain: "cryptoslate.com",
  },
  {
    name: "CoinJournal",
    url: "https://coinjournal.net/feed/",
    domain: "coinjournal.net",
  },
  {
    name: "Crypto.news",
    url: "https://crypto.news/feed/",
    domain: "crypto.news",
  },
  {
    name: "NewsBTC",
    url: "https://www.newsbtc.com/feed/",
    domain: "newsbtc.com",
  },
  {
    name: "Bitcoinist",
    url: "https://bitcoinist.com/feed/",
    domain: "bitcoinist.com",
  },
];

const PROJECT_NEWS_FEEDS: NewsFeed[] = [
  {
    name: "Quant Network",
    url: "https://quant.network/feed/",
    domain: "quant.network",
    officialSymbol: "QNT",
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function finitePositive(value: unknown): number | null {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) && result > 0 ? result : null;
}

function finiteNonNegative(value: unknown): number | null {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
}

function normalizePair(input: string): { symbol: string; pair: string } {
  const cleaned = input.trim().replace(/^\$/, "").replace(/\s+/g, "").toLocaleUpperCase("en-US");
  const compact = cleaned.replace("/", "").replace("-", "");
  if (!/^[A-Z0-9]{2,20}$/.test(compact)) {
    throw new Error("Введите тикер Binance Spot, например QNT, BTC или ETH.");
  }
  const pair = compact.endsWith("USDT") ? compact : `${compact}USDT`;
  const symbol = pair.slice(0, -"USDT".length);
  if (!symbol || symbol.length > 15) {
    throw new Error("Укажите базовый тикер пары USDT, например QNT или BTC.");
  }
  return { symbol, pair };
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, digits: string) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function rssTag(item: string, name: string): string {
  const match = item.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}\\s*>`, "i"));
  return match ? decodeXml(match[1]!) : "";
}

function parsePublisherRss(xml: string, feed: NewsFeed): MarketFocusNewsItem[] {
  const items = xml.match(/<item\b[^>]*>[\s\S]*?<\/item\s*>/gi) ?? [];
  const stories: MarketFocusNewsItem[] = [];
  for (const item of items) {
    const title = rssTag(item, "title").slice(0, 300);
    const urlValue = rssTag(item, "link");
    const publishedAt = rssTag(item, "pubDate");
    if (!title || !urlValue || !publishedAt) continue;
    let url: URL;
    let publishedDate: Date;
    try {
      url = new URL(urlValue);
      publishedDate = new Date(publishedAt);
    } catch {
      continue;
    }
    const hostname = url.hostname.toLocaleLowerCase("en-US");
    if (
      url.protocol !== "https:"
      || !(hostname === feed.domain || hostname.endsWith(`.${feed.domain}`))
      || !Number.isFinite(publishedDate.getTime())
    ) {
      continue;
    }
    stories.push({
      title,
      url: url.toString(),
      sourceName: feed.name,
      sourceDomain: hostname,
      publishedAt: publishedDate.toISOString(),
      verificationMethod: "publisher_rss",
    });
  }
  return stories;
}

function matchesCoinNews(
  item: MarketFocusNewsItem,
  symbol: string,
  coinName: string,
  feed: NewsFeed,
): boolean {
  const tickerMatch = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(item.title);
  if (tickerMatch) return true;
  if (!coinName || coinName.toLocaleUpperCase("en-US") === symbol) return false;
  const normalizedName = coinName.trim().replace(/\s+/g, " ");
  const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const nameMatch = new RegExp(`\\b${escapedName}\\b`, "i").test(item.title);
  if (!nameMatch) return false;
  if (normalizedName.split(" ").length > 1) return true;
  // A single-word project name can collide with unrelated coverage; only its own
  // publisher feed is authoritative enough to resolve that ambiguity.
  return feed.domain === "quant.network" && feed.officialSymbol === symbol;
}

async function requestJson<T>(
  url: string,
  provider: string,
  fetcher: typeof fetch,
): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { accept: "application/json", "user-agent": "ReplitCryptoMarketFocus/1.0" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    throw new Error(`${provider} вернул HTTP ${response.status}.`);
  }
  return response.json() as Promise<T>;
}

async function requestText(
  url: string,
  provider: string,
  fetcher: typeof fetch,
): Promise<string> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: { accept: "application/rss+xml, application/xml, text/xml", "user-agent": "ReplitCryptoMarketFocus/1.0" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!response.ok) {
    throw new Error(`${provider} вернул HTTP ${response.status}.`);
  }
  return response.text();
}

export async function resolveCoinLogoDataUri(
  imageUrl: unknown,
  symbol: string,
  provider: string,
  fetcher: typeof fetch,
): Promise<string> {
  if (typeof imageUrl !== "string" || !imageUrl.trim()) {
    throw new Error(`${provider} не вернул логотип для ${symbol}.`);
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(imageUrl);
  } catch {
    throw new Error(`${provider} вернул некорректную ссылку на логотип ${symbol}.`);
  }
  if (
    parsedUrl.protocol !== "https:"
    || ![
      "assets.coingecko.com",
      "coin-images.coingecko.com",
      "static.coinpaprika.com",
    ].includes(parsedUrl.hostname)
  ) {
    throw new Error(`${provider} вернул неподдерживаемый источник логотипа ${symbol}.`);
  }

  const response = await fetcher(parsedUrl, {
    headers: {
      accept: "image/png,image/jpeg,image/webp",
      "user-agent": "ReplitCryptoMarketFocus/1.0",
      ...(parsedUrl.hostname === "static.coinpaprika.com"
        ? { referer: "https://coinpaprika.com/" }
        : {}),
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить логотип ${symbol}: HTTP ${response.status}.`);
  }
  const mediaType = response.headers.get("content-type")?.split(";")[0]?.trim().toLocaleLowerCase("en-US");
  const mediaTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  if (!mediaType || !mediaTypes.has(mediaType)) {
    throw new Error(`${provider} вернул неподдерживаемый формат логотипа ${symbol}.`);
  }
  const imageBytes = Buffer.from(await response.arrayBuffer());
  if (!imageBytes.length || imageBytes.length > 512 * 1_024) {
    throw new Error(`Размер логотипа ${symbol} выходит за допустимый предел.`);
  }
  const validSignature = mediaType === "image/png"
    ? imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mediaType === "image/jpeg"
      ? imageBytes[0] === 0xff && imageBytes[1] === 0xd8 && imageBytes[2] === 0xff
      : imageBytes.subarray(0, 4).toString("ascii") === "RIFF"
        && imageBytes.subarray(8, 12).toString("ascii") === "WEBP";
  if (!validSignature) {
    throw new Error(`${provider} вернул повреждённое изображение логотипа ${symbol}.`);
  }
  return `data:${mediaType};base64,${imageBytes.toString("base64")}`;
}

function chooseBestRankedMatch<T>(matches: T[], getRank: (match: T) => unknown): T | undefined {
  if (matches.length === 1) return matches[0];
  const rankedMatches = matches
    .map((match) => ({ match, rank: Number(getRank(match)) }))
    .filter((candidate) => Number.isFinite(candidate.rank) && candidate.rank > 0)
    .sort((left, right) => left.rank - right.rank);
  const best = rankedMatches[0];
  if (!best) return undefined;
  if (rankedMatches[1]?.rank === best.rank) return undefined;
  return best.match;
}

type MarketFocusCoinIdentity = {
  name: string;
  logoDataUri: string;
};

async function resolveCoinGeckoIdentity(
  symbol: string,
  fetcher: typeof fetch,
): Promise<MarketFocusCoinIdentity> {
  const url = `${COINGECKO_API}/search?query=${encodeURIComponent(symbol)}`;
  const response = await requestJson<CoinGeckoSearchResponse>(url, "CoinGecko", fetcher);
  const matches = (Array.isArray(response?.coins) ? response.coins : [])
    .filter((coin) => (
      typeof coin?.symbol === "string"
      && coin.symbol.toLocaleUpperCase("en-US") === symbol
      && typeof coin.name === "string"
      && coin.name.trim()
    ));
  const match = chooseBestRankedMatch(matches, (coin) => coin.market_cap_rank);
  if (!match) {
    throw new Error(`Не удалось выбрать основную монету ${symbol} среди совпадений CoinGecko.`);
  }
  const logoUrl = typeof match.large === "string" ? match.large : match.thumb;
  return {
    name: (match.name as string).trim(),
    logoDataUri: await resolveCoinLogoDataUri(logoUrl, symbol, "CoinGecko", fetcher),
  };
}

async function resolveCoinPaprikaIdentity(
  symbol: string,
  fetcher: typeof fetch,
): Promise<MarketFocusCoinIdentity> {
  const url = `https://api.coinpaprika.com/v1/search/?q=${encodeURIComponent(symbol)}&c=currencies`;
  const response = await requestJson<CoinPaprikaSearchResponse>(url, "CoinPaprika", fetcher);
  const matches = (Array.isArray(response?.currencies) ? response.currencies : [])
    .filter((coin) => (
      coin.is_active !== false
      && typeof coin.symbol === "string"
      && coin.symbol.toLocaleUpperCase("en-US") === symbol
      && typeof coin.name === "string"
      && coin.name.trim()
      && typeof coin.id === "string"
      && /^[a-z0-9-]+$/iu.test(coin.id)
    ));
  const match = chooseBestRankedMatch(matches, (coin) => coin.rank);
  if (!match) {
    throw new Error(`Не удалось выбрать основную монету ${symbol} среди совпадений CoinPaprika.`);
  }
  return {
    name: (match.name as string).trim(),
    logoDataUri: await resolveCoinLogoDataUri(
      `https://static.coinpaprika.com/coin/${match.id as string}/logo.png`,
      symbol,
      "CoinPaprika",
      fetcher,
    ),
  };
}

async function resolveCoinIdentity(symbol: string, fetcher: typeof fetch): Promise<MarketFocusCoinIdentity> {
  const providers = [
    { name: "CoinGecko", resolve: resolveCoinGeckoIdentity },
    { name: "CoinPaprika", resolve: resolveCoinPaprikaIdentity },
  ] as const;
  const errors: string[] = [];
  for (const provider of providers) {
    try {
      return await provider.resolve(symbol, fetcher);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[market-focus] ${provider.name} identity/logo lookup failed for ${symbol}: ${reason}`);
      errors.push(`${provider.name}: ${reason}`);
    }
  }
  throw new Error(
    `Не удалось подтвердить логотип монеты ${symbol} ни в CoinGecko, ни в CoinPaprika. ${errors.join(" | ")}`,
  );
}

export async function resolveMarketFocusCoinLogo(
  symbolInput: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<string> {
  const symbol = symbolInput.trim().toLocaleUpperCase("en-US");
  if (!symbol) throw new Error("Для поиска логотипа не указан тикер монеты.");
  return (await resolveCoinIdentity(symbol, fetcher)).logoDataUri;
}

async function findVerifiedRecentNews(
  symbol: string,
  coinName: string,
  nowMs: number,
  fetcher: typeof fetch,
): Promise<MarketFocusNewsItem | null> {
  const feeds = [
    ...GENERAL_NEWS_FEEDS,
    ...PROJECT_NEWS_FEEDS.filter((feed) => feed.officialSymbol === symbol),
  ];
  const responses = await Promise.allSettled(
    feeds.map(async (feed) => ({
      feed,
      items: parsePublisherRss(
        await requestText(feed.url, feed.name, fetcher),
        feed,
      ),
    })),
  );
  const recentStories: MarketFocusNewsItem[] = [];
  let checkedFeedCount = 0;
  for (const result of responses) {
    if (result.status === "rejected") {
      console.warn(
        `[market-focus] Publisher RSS unavailable: ${
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        }`,
      );
      continue;
    }
    checkedFeedCount += 1;
    const { feed, items } = result.value;
    recentStories.push(...items.filter((item) => {
      const publishedMs = Date.parse(item.publishedAt);
      return publishedMs <= nowMs + 5 * 60_000
        && publishedMs >= nowMs - NEWS_MAX_AGE_MS
        && matchesCoinNews(item, symbol, coinName, feed);
    }));
  }
  if (checkedFeedCount === 0) {
    throw new Error("Не удалось проверить ни одну новостную ленту. Попробуйте позже; ролик без проверки источников не создан.");
  }
  recentStories.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return recentStories[0] ?? null;
}

function parseKlineRows(
  value: unknown,
  expectedCount: number,
  intervalMs: number,
  expectedStart: number,
  nowMs: number,
  label: string,
): MarketFocusCandle[] {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error(`Binance Spot не вернул ${expectedCount} завершённых свечей для ${label}.`);
  }
  return value.map((row, index) => {
    if (!Array.isArray(row) || row.length < 8) {
      throw new Error(`Binance Spot вернул неполную свечу для ${label}.`);
    }
    const openTime = Number(row[0]);
    const open = finitePositive(row[1]);
    const high = finitePositive(row[2]);
    const low = finitePositive(row[3]);
    const close = finitePositive(row[4]);
    const quoteVolume = finiteNonNegative(row[7]);
    const closeTime = Number(row[6]);
    if (
      !Number.isFinite(openTime)
      || !Number.isFinite(closeTime)
      || openTime !== expectedStart + index * intervalMs
      || closeTime < openTime
      || closeTime >= nowMs
      || open === null
      || high === null
      || low === null
      || close === null
      || quoteVolume === null
      || high < Math.max(open, close, low)
      || low > Math.min(open, close, high)
    ) {
      throw new Error(`Binance Spot вернул неполные, открытые или несогласованные свечи для ${label}.`);
    }
    return { openTime, closeTime, open, high, low, close, quoteVolume };
  });
}

function parseSparseKlineRows(
  value: unknown,
  intervalMs: number,
  expectedStart: number,
  expectedLastStart: number,
  nowMs: number,
  label: string,
): MarketFocusCandle[] {
  if (!Array.isArray(value)) {
    throw new Error(`Binance Spot не вернул список свечей для ${label}.`);
  }
  const candles: MarketFocusCandle[] = [];
  let previousOpenTime = Number.NEGATIVE_INFINITY;
  for (const row of value) {
    if (!Array.isArray(row) || row.length < 8) {
      throw new Error(`Binance Spot вернул неполную свечу для ${label}.`);
    }
    const openTime = Number(row[0]);
    const open = finitePositive(row[1]);
    const high = finitePositive(row[2]);
    const low = finitePositive(row[3]);
    const close = finitePositive(row[4]);
    const quoteVolume = finiteNonNegative(row[7]);
    const closeTime = Number(row[6]);
    if (
      !Number.isSafeInteger(openTime)
      || !Number.isFinite(closeTime)
      || openTime < expectedStart
      || openTime > expectedLastStart
      || (openTime - expectedStart) % intervalMs !== 0
      || openTime <= previousOpenTime
      || closeTime < openTime
      || closeTime >= nowMs
      || open === null
      || high === null
      || low === null
      || close === null
      || quoteVolume === null
      || high < Math.max(open, close, low)
      || low > Math.min(open, close, high)
    ) {
      throw new Error(`Binance Spot вернул несогласованные завершённые свечи для ${label}.`);
    }
    candles.push({ openTime, closeTime, open, high, low, close, quoteVolume });
    previousOpenTime = openTime;
  }
  return candles;
}

async function fetchKlines(
  pair: string,
  interval: "1m" | "1h" | "1d",
  startTime: number,
  endTime: number,
  limit: number,
  fetcher: typeof fetch,
): Promise<unknown> {
  const url = new URL("/api/v3/klines", BINANCE_API);
  url.searchParams.set("symbol", pair);
  url.searchParams.set("interval", interval);
  url.searchParams.set("startTime", String(startTime));
  url.searchParams.set("endTime", String(endTime));
  url.searchParams.set("limit", String(limit));
  return requestJson<unknown>(url.toString(), "Binance Spot", fetcher);
}

async function fetchRollingHourlyCandles(
  pair: string,
  windowStartMs: number,
  windowEndMs: number,
  openPrice: number,
  lastPrice: number,
  fetcher: typeof fetch,
): Promise<MarketFocusCandle[]> {
  const firstMinuteStart = Math.floor(windowStartMs / MINUTE_MS) * MINUTE_MS;
  const lastCompleteMinuteStart = Math.floor(windowEndMs / MINUTE_MS) * MINUTE_MS - MINUTE_MS;
  if (lastCompleteMinuteStart < firstMinuteStart) {
    throw new Error(`Не удалось построить скользящее окно 24 часов для ${pair}.`);
  }

  const minuteCandles: MarketFocusCandle[] = [];
  for (let batchStart = firstMinuteStart; batchStart <= lastCompleteMinuteStart;) {
    const remainingCount = Math.floor((lastCompleteMinuteStart - batchStart) / MINUTE_MS) + 1;
    const count = Math.min(1_000, remainingCount);
    const batchEnd = batchStart + (count - 1) * MINUTE_MS;
    const payload = await fetchKlines(
      pair,
      "1m",
      batchStart,
      batchEnd + MINUTE_MS - 1,
      count,
      fetcher,
    );
    minuteCandles.push(...parseKlineRows(
      payload,
      count,
      MINUTE_MS,
      batchStart,
      windowEndMs,
      `${pair}, скользящие минутные данные`,
    ));
    batchStart = batchEnd + MINUTE_MS;
  }

  const groupedCandles: MarketFocusCandle[][] = Array.from({ length: 24 }, () => []);
  for (const candle of minuteCandles) {
    if (candle.closeTime < windowStartMs || candle.openTime >= windowEndMs) continue;
    const bucket = Math.max(
      0,
      Math.min(23, Math.floor((candle.openTime - windowStartMs) / HOUR_MS)),
    );
    groupedCandles[bucket]!.push(candle);
  }

  return groupedCandles.map((candles, index) => {
    if (candles.length === 0) {
      throw new Error(`Binance Spot не вернул минутные данные для ${pair} в части скользящего окна 24 часов.`);
    }
    const bucketStart = windowStartMs + index * HOUR_MS;
    const bucketEnd = Math.min(windowEndMs, bucketStart + HOUR_MS);
    const first = candles[0]!;
    const last = candles.at(-1)!;
    const open = index === 0 ? openPrice : first.open;
    const close = index === 23 ? lastPrice : last.close;
    return {
      openTime: bucketStart,
      closeTime: bucketEnd - 1,
      open,
      high: Math.max(open, close, ...candles.map((candle) => candle.high)),
      low: Math.min(open, close, ...candles.map((candle) => candle.low)),
      close,
      quoteVolume: candles.reduce((sum, candle) => sum + candle.quoteVolume, 0),
    };
  });
}

async function validateSpotPair(
  pair: string,
  symbol: string,
  fetcher: typeof fetch,
): Promise<void> {
  const url = new URL("/api/v3/exchangeInfo", BINANCE_API);
  url.searchParams.set("symbol", pair);
  let response: BinanceSymbolResponse;
  try {
    response = await requestJson<BinanceSymbolResponse>(url.toString(), "Binance Spot", fetcher);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (/HTTP (400|404)/.test(reason)) {
      throw new Error(`На Binance Spot не найден торгуемый рынок ${pair}. Введите тикер монеты, например QNT.`);
    }
    throw new Error(`Не удалось проверить рынок Binance Spot ${pair}: ${reason}`);
  }
  const market = response.symbols?.find((item) => item.symbol === pair);
  if (
    !market
    || market.status !== "TRADING"
    || market.baseAsset !== symbol
    || market.quoteAsset !== "USDT"
  ) {
    throw new Error(`Рынок ${pair} не доступен как активная спотовая пара Binance.`);
  }
}

function periodChange(candles: MarketFocusCandle[]): number {
  const first = candles[0]!;
  const last = candles.at(-1)!;
  return (last.close / first.open - 1) * 100;
}

const AUTO_SCAN_MIN_QUOTE_VOLUME = 1_000_000;
const AUTO_SCAN_MAX_NEWS_CANDIDATES = 12;
const AUTO_SCAN_STABLECOINS = new Set([
  "USDC", "BUSD", "FDUSD", "TUSD", "USDP", "DAI", "USDE", "USDS", "USD1", "EURI", "AEUR",
]);

export type MarketFocusAutoSelection = {
  data: MarketFocusMarketData;
  rank: number;
  rankingChangePercent: number;
  rankingQuoteVolume: number;
  checkedSymbols: string[];
};

export type MarketFocusRankingSnapshot = {
  changePercent24h: number;
  lastPriceUsdt: number;
  quoteVolume24h: number;
  windowStartMs?: number;
  windowEndMs?: number;
  openPriceUsdt?: number;
  highPrice24h?: number;
  lowPrice24h?: number;
  benchmarks?: MarketFocusMarketData["benchmarks"];
};

export type MarketFocusTopGainer = MarketFocusRankingSnapshot & {
  rank: number;
  symbol: string;
  pair: string;
};

export type MarketFocus30dRankingSnapshot = {
  changePercent30d: number;
  changePercent24h: number;
  lastPriceUsdt: number;
  quoteVolume24h: number;
  windowStartMs: number;
  windowEndMs: number;
  openPriceUsdt: number;
  highPrice24h: number;
  lowPrice24h: number;
  benchmarks: MarketFocusMarketData["benchmarks"];
  periodBenchmarks: [MarketFocusPeriodBenchmark, MarketFocusPeriodBenchmark];
};

export type MarketFocus30dTopGainer = MarketFocus30dRankingSnapshot & {
  rank: number;
  symbol: string;
  pair: string;
};

function normalizeExcludedMarketFocusSymbol(value: string): string {
  const normalized = value.trim().replace(/^\$/, "").replace(/[\/-\s]/g, "").toLocaleUpperCase("en-US");
  return normalized.endsWith("USDT") ? normalized.slice(0, -"USDT".length) : normalized;
}

async function fetchMarketFocusGainerCandidates(
  fetcher: typeof fetch,
): Promise<Array<{
  symbol: string;
  changePercent: number;
  quoteVolume: number;
  lastPrice: number | null;
  windowStartMs?: number;
  windowEndMs?: number;
  openPrice?: number;
  highPrice?: number;
  lowPrice?: number;
  benchmarks?: MarketFocusMarketData["benchmarks"];
}>> {
  const exchangeInfoUrl = new URL("/api/v3/exchangeInfo", BINANCE_API);
  const tickerUrl = new URL("/api/v3/ticker/24hr", BINANCE_API);
  const [exchangeInfo, tickerPayload] = await Promise.all([
    requestJson<BinanceSymbolResponse>(exchangeInfoUrl.toString(), "Binance Spot", fetcher),
    requestJson<unknown>(tickerUrl.toString(), "Binance Spot", fetcher),
  ]);
  if (!Array.isArray(exchangeInfo.symbols) || !Array.isArray(tickerPayload)) {
    throw new Error("Binance Spot вернул неполный список рынков для автопоиска.");
  }

  const activeUsdtBases = new Set<string>();
  for (const market of exchangeInfo.symbols) {
    if (
      market.status === "TRADING"
      && market.quoteAsset === "USDT"
      && typeof market.baseAsset === "string"
      && typeof market.symbol === "string"
      && market.symbol === `${market.baseAsset}USDT`
    ) {
      activeUsdtBases.add(market.baseAsset.toLocaleUpperCase("en-US"));
    }
  }

  const tickerItems = tickerPayload as Binance24HourTicker[];
  const benchmarkChange = (symbol: "BTCUSDT" | "ETHUSDT"): number | null => {
    const ticker = tickerItems.find((item) => item.symbol === symbol);
    const value = Number(ticker?.priceChangePercent);
    return Number.isFinite(value) ? value : null;
  };
  const btcChange = benchmarkChange("BTCUSDT");
  const ethChange = benchmarkChange("ETHUSDT");
  const benchmarks: MarketFocusMarketData["benchmarks"] | undefined = btcChange === null || ethChange === null
    ? undefined
    : [
        { symbol: "BTC", changePercent24h: btcChange },
        { symbol: "ETH", changePercent24h: ethChange },
      ];

  const candidates: Array<{
    symbol: string;
    changePercent: number;
    quoteVolume: number;
    lastPrice: number | null;
    windowStartMs?: number;
    windowEndMs?: number;
    openPrice?: number;
    highPrice?: number;
    lowPrice?: number;
    benchmarks?: MarketFocusMarketData["benchmarks"];
  }> = [];
  for (const item of tickerItems) {
    if (typeof item.symbol !== "string" || !item.symbol.endsWith("USDT")) continue;
    const symbol = item.symbol.slice(0, -"USDT".length).toLocaleUpperCase("en-US");
    const changePercent = Number(item.priceChangePercent);
    const quoteVolume = finitePositive(item.quoteVolume);
    const lastPrice = finitePositive(item.lastPrice);
    const windowStartMs = Number(item.openTime);
    const windowEndMs = Number(item.closeTime);
    const openPrice = finitePositive(item.openPrice);
    const highPrice = finitePositive(item.highPrice);
    const lowPrice = finitePositive(item.lowPrice);
    if (
      !activeUsdtBases.has(symbol)
      || AUTO_SCAN_STABLECOINS.has(symbol)
      || /(?:UP|DOWN|BULL|BEAR|[235][LS])$/.test(symbol)
      || !Number.isFinite(changePercent)
      || changePercent <= 0
      || quoteVolume === null
      || quoteVolume < AUTO_SCAN_MIN_QUOTE_VOLUME
    ) {
      continue;
    }
    candidates.push({
      symbol,
      changePercent,
      quoteVolume,
      lastPrice,
      ...(Number.isSafeInteger(windowStartMs) && windowStartMs > 0 ? { windowStartMs } : {}),
      ...(Number.isSafeInteger(windowEndMs) && windowEndMs > 0 ? { windowEndMs } : {}),
      ...(openPrice !== null ? { openPrice } : {}),
      ...(highPrice !== null ? { highPrice } : {}),
      ...(lowPrice !== null ? { lowPrice } : {}),
      ...(benchmarks ? { benchmarks } : {}),
    });
  }
  return candidates.sort((left, right) => (
    right.changePercent - left.changePercent
    || right.quoteVolume - left.quoteVolume
    || left.symbol.localeCompare(right.symbol, "en-US")
  ));
}

export async function listMarketFocusTopGainers(
  limit = 10,
  options: { fetcher?: typeof fetch } = {},
): Promise<MarketFocusTopGainer[]> {
  const requestedLimit = Math.floor(limit);
  if (!Number.isFinite(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
    throw new Error("Количество лидеров роста должно быть от 1 до 50.");
  }
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("Сетевой клиент для проверки рынка недоступен.");
  const candidates = await fetchMarketFocusGainerCandidates(fetcher);
  return candidates
    .filter((candidate): candidate is typeof candidate & { lastPrice: number } => candidate.lastPrice !== null)
    .slice(0, requestedLimit)
    .map((candidate, index) => ({
      rank: index + 1,
      symbol: candidate.symbol,
      pair: `${candidate.symbol}USDT`,
      changePercent24h: candidate.changePercent,
      lastPriceUsdt: candidate.lastPrice,
      quoteVolume24h: candidate.quoteVolume,
      ...(candidate.windowStartMs !== undefined ? { windowStartMs: candidate.windowStartMs } : {}),
      ...(candidate.windowEndMs !== undefined ? { windowEndMs: candidate.windowEndMs } : {}),
      ...(candidate.openPrice !== undefined ? { openPriceUsdt: candidate.openPrice } : {}),
      ...(candidate.highPrice !== undefined ? { highPrice24h: candidate.highPrice } : {}),
      ...(candidate.lowPrice !== undefined ? { lowPrice24h: candidate.lowPrice } : {}),
      ...(candidate.benchmarks ? { benchmarks: candidate.benchmarks } : {}),
    }));
}

export async function listMarketFocusTopGainers30d(
  limit = 10,
  options: {
    fetcher?: typeof fetch;
    now?: () => number;
  } = {},
): Promise<MarketFocus30dTopGainer[]> {
  const requestedLimit = Math.floor(limit);
  if (!Number.isFinite(requestedLimit) || requestedLimit < 1 || requestedLimit > 50) {
    throw new Error("Количество месячных лидеров роста должно быть от 1 до 50.");
  }
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("Сетевой клиент для проверки рынка недоступен.");

  const exchangeInfoUrl = new URL("/api/v3/exchangeInfo", BINANCE_API);
  const tickerUrl = new URL("/api/v3/ticker/24hr", BINANCE_API);
  const [exchangeInfo, tickerPayload] = await Promise.all([
    requestJson<BinanceSymbolResponse>(exchangeInfoUrl.toString(), "Binance Spot", fetcher),
    requestJson<unknown>(tickerUrl.toString(), "Binance Spot", fetcher),
  ]);
  if (!Array.isArray(exchangeInfo.symbols) || !Array.isArray(tickerPayload)) {
    throw new Error("Binance Spot вернул неполный список рынков для месячного рейтинга.");
  }

  const activeUsdtBases = new Set(
    exchangeInfo.symbols
      .filter((market) => (
        market.status === "TRADING"
        && market.quoteAsset === "USDT"
        && typeof market.baseAsset === "string"
        && typeof market.symbol === "string"
        && market.symbol === `${market.baseAsset}USDT`
      ))
      .map((market) => (market.baseAsset as string).toLocaleUpperCase("en-US")),
  );
  const tickerItems = tickerPayload as Binance24HourTicker[];
  const benchmark24h = (symbol: "BTCUSDT" | "ETHUSDT"): number | null => {
    const value = Number(tickerItems.find((item) => item.symbol === symbol)?.priceChangePercent);
    return Number.isFinite(value) ? value : null;
  };
  const btcChange24h = benchmark24h("BTCUSDT");
  const ethChange24h = benchmark24h("ETHUSDT");
  if (btcChange24h === null || ethChange24h === null) {
    throw new Error("Binance Spot не вернул BTC и ETH для месячного сравнения.");
  }
  const benchmarks: MarketFocusMarketData["benchmarks"] = [
    { symbol: "BTC", changePercent24h: btcChange24h },
    { symbol: "ETH", changePercent24h: ethChange24h },
  ];
  const lastPriceBySymbol = new Map<string, number>();
  for (const item of tickerItems) {
    if (typeof item.symbol !== "string" || !item.symbol.endsWith("USDT")) continue;
    const symbol = item.symbol.slice(0, -"USDT".length).toLocaleUpperCase("en-US");
    const lastPrice = finitePositive(item.lastPrice);
    const quoteVolume24h = finitePositive(item.quoteVolume);
    if (
      !activeUsdtBases.has(symbol)
      || AUTO_SCAN_STABLECOINS.has(symbol)
      || /(?:UP|DOWN|BULL|BEAR|[235][LS])$/.test(symbol)
      || lastPrice === null
      || quoteVolume24h === null
      || quoteVolume24h < AUTO_SCAN_MIN_QUOTE_VOLUME
    ) {
      continue;
    }
    lastPriceBySymbol.set(symbol, lastPrice);
  }

  const nowMs = Math.floor((options.now?.() ?? Date.now()) / MINUTE_MS) * MINUTE_MS;
  const windowStartMs = nowMs - 30 * DAY_MS;
  const candidates = [...lastPriceBySymbol.entries()]
    .map(([symbol, lastPrice]) => ({ symbol, lastPrice }))
    .sort((left, right) => left.symbol.localeCompare(right.symbol, "en-US"));
  const startPrices = new Map<string, number>();
  let cursor = 0;
  const workerCount = Math.min(8, candidates.length);
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++]!;
      const rows = await fetchKlines(
        `${candidate.symbol}USDT`,
        "1m",
        windowStartMs,
        windowStartMs + MINUTE_MS - 1,
        1,
        fetcher,
      );
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const [candle] = parseKlineRows(
        rows,
        1,
        MINUTE_MS,
        windowStartMs,
        nowMs,
        `${candidate.symbol}USDT, цена 30 дней назад`,
      );
      startPrices.set(candidate.symbol, candle!.open);
    }
  }));

  const periodChangeBySymbol = new Map<string, number>();
  const ranked = candidates.flatMap((candidate) => {
    const openPrice = startPrices.get(candidate.symbol);
    if (openPrice === undefined) return [];
    const changePercent30d = (candidate.lastPrice / openPrice - 1) * 100;
    periodChangeBySymbol.set(candidate.symbol, changePercent30d);
    if (!Number.isFinite(changePercent30d) || changePercent30d <= 0) return [];
    const ticker = tickerItems.find((item) => item.symbol === `${candidate.symbol}USDT`)!;
    return [{
      symbol: candidate.symbol,
      pair: `${candidate.symbol}USDT`,
      changePercent30d,
      changePercent24h: Number(tickerItems.find((item) => item.symbol === `${candidate.symbol}USDT`)?.priceChangePercent),
      lastPriceUsdt: candidate.lastPrice,
      quoteVolume24h: finitePositive(ticker.quoteVolume)!,
      windowStartMs,
      windowEndMs: nowMs,
      openPriceUsdt: openPrice,
      highPrice24h: finitePositive(ticker.highPrice) ?? candidate.lastPrice,
      lowPrice24h: finitePositive(ticker.lowPrice) ?? candidate.lastPrice,
      benchmarks,
      periodBenchmarks: [
        { symbol: "BTC" as const, changePercent: periodChangeBySymbol.get("BTC") ?? Number.NaN },
        { symbol: "ETH" as const, changePercent: periodChangeBySymbol.get("ETH") ?? Number.NaN },
      ] as [MarketFocusPeriodBenchmark, MarketFocusPeriodBenchmark],
    }];
  }).sort((left, right) => (
    right.changePercent30d - left.changePercent30d
    || right.quoteVolume24h - left.quoteVolume24h
    || left.symbol.localeCompare(right.symbol, "en-US")
  ));
  const btcMonthlyChange = periodChangeBySymbol.get("BTC");
  const ethMonthlyChange = periodChangeBySymbol.get("ETH");
  if (btcMonthlyChange === undefined || ethMonthlyChange === undefined) {
    throw new Error("Binance Spot не вернул стартовые цены BTC и ETH за последние 30 дней.");
  }

  return ranked.slice(0, requestedLimit).map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    periodBenchmarks: [
      { symbol: "BTC", changePercent: btcMonthlyChange },
      { symbol: "ETH", changePercent: ethMonthlyChange },
    ],
  }));
}

export async function resolveNextMarketFocusTopGainer(
  excludedSymbols: Iterable<string>,
  options: {
    fetcher?: typeof fetch;
    now?: () => number;
  } = {},
): Promise<MarketFocusAutoSelection> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("Сетевой клиент для проверки рынка недоступен.");
  const excluded = new Set([...excludedSymbols].map(normalizeExcludedMarketFocusSymbol));
  const candidates = await fetchMarketFocusGainerCandidates(fetcher);
  const available = candidates
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }))
    .filter((candidate) => !excluded.has(candidate.symbol));
  if (!available.length) {
    throw new Error(
      "На Binance Spot нет новых растущих USDT-монет с достаточным оборотом: лидеры роста за сегодня уже использованы или сейчас нет подходящих рынков.",
    );
  }

  const checkedSymbols: string[] = [];
  const failures: Array<{ symbol: string; reason: string }> = [];
  for (const candidate of available.slice(0, AUTO_SCAN_MAX_NEWS_CANDIDATES)) {
    checkedSymbols.push(candidate.symbol);
    try {
      const data = await resolveMarketFocusMarketData(candidate.symbol, {
        fetcher,
        now: options.now,
        rankingSnapshot: candidate.lastPrice === null
          ? undefined
          : {
              changePercent24h: candidate.changePercent,
              lastPriceUsdt: candidate.lastPrice,
              quoteVolume24h: candidate.quoteVolume,
              windowStartMs: candidate.windowStartMs,
              windowEndMs: candidate.windowEndMs,
              openPriceUsdt: candidate.openPrice,
              highPrice24h: candidate.highPrice,
              lowPrice24h: candidate.lowPrice,
              benchmarks: candidate.benchmarks,
            },
      });
      return {
        data,
        rank: candidate.rank,
        rankingChangePercent: candidate.changePercent,
        rankingQuoteVolume: candidate.quoteVolume,
        checkedSymbols,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push({ symbol: candidate.symbol, reason });
      console.warn(
        `[market-focus:auto] Skipping ${candidate.symbol} at rank ${candidate.rank}: ${reason}`,
      );
    }
  }

  const operationalFailure = failures.find(({ reason }) => !/не нашёл свежую новость/i.test(reason));
  if (operationalFailure) {
    throw new Error(
      `Не удалось проверить лидеров роста Binance Spot (например, ${operationalFailure.symbol}): ${operationalFailure.reason.slice(0, 240)}. Ролик не создан; попробуйте позже или введите тикер вручную.`,
    );
  }
  throw new Error(
    `Проверил ${checkedSymbols.length} лидеров роста Binance Spot, но не нашёл для них свежую подтверждённую новость. Монеты не будут повторяться; попробуйте позже или введите тикер вручную.`,
  );
}

export function buildMarketFocusCta(): string {
  return "Хочешь сам посмотреть, что сейчас происходит с этой монетой? Ссылка на биржу — в описании и шапке профиля.";
}

export const MARKET_FOCUS_CHANNEL_SUBSCRIBE_CTA =
  "Хочешь каждый день знать, какая монета сейчас начинает расти и почему? Подписывайся. Здесь каждый день разбираем самые горячие движения крипторынка — пока о них ещё все не заговорили.";

export function buildMarketFocusCtaParts(
  referralCta: string,
  visualTheme: "market_focus_24h" | "market_focus_30d",
  radarShorts = false,
): Array<{ kind: "exchange_referral" | "channel_subscribe"; voiceText: string }> {
  const parts: Array<{ kind: "exchange_referral" | "channel_subscribe"; voiceText: string }> = [];
  const normalizedReferralCta = referralCta.trim().replace(/\s+/g, " ");
  if (normalizedReferralCta) {
    parts.push({ kind: "exchange_referral", voiceText: normalizedReferralCta });
  }
  if (visualTheme === "market_focus_24h" && !radarShorts) {
    parts.push({ kind: "channel_subscribe", voiceText: MARKET_FOCUS_CHANNEL_SUBSCRIBE_CTA });
  }
  return parts;
}

export async function resolveMarketFocusMarketData(
  topicInput: string,
  options: {
    fetcher?: typeof fetch;
    now?: () => number;
    rankingSnapshot?: MarketFocusRankingSnapshot;
  } = {},
): Promise<MarketFocusMarketData> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  const requestedNowMs = options.now?.() ?? Date.now();
  const rankingSnapshot = options.rankingSnapshot;
  const snapshotEndMs = rankingSnapshot?.windowEndMs;
  const nowMs = Number.isSafeInteger(snapshotEndMs) && snapshotEndMs! > 0
    ? snapshotEndMs!
    : requestedNowMs;
  if (typeof fetcher !== "function") throw new Error("Сетевой клиент для проверки рынка недоступен.");
  const { symbol, pair } = normalizePair(topicInput);
  await validateSpotPair(pair, symbol, fetcher);

  let rankingWindow: { startMs: number; endMs: number; openPrice: number } | null = null;
  if (rankingSnapshot) {
    const startMs = Number.isSafeInteger(rankingSnapshot.windowStartMs)
      ? rankingSnapshot.windowStartMs!
      : nowMs - DAY_MS;
    const endMs = Number.isSafeInteger(rankingSnapshot.windowEndMs)
      ? rankingSnapshot.windowEndMs!
      : nowMs;
    const openPrice = rankingSnapshot.openPriceUsdt
      ?? rankingSnapshot.lastPriceUsdt / (1 + rankingSnapshot.changePercent24h / 100);
    if (
      !Number.isFinite(rankingSnapshot.changePercent24h)
      || !Number.isFinite(rankingSnapshot.lastPriceUsdt)
      || rankingSnapshot.lastPriceUsdt <= 0
      || !Number.isFinite(rankingSnapshot.quoteVolume24h)
      || rankingSnapshot.quoteVolume24h <= 0
      || !Number.isFinite(openPrice)
      || openPrice <= 0
      || !Number.isSafeInteger(startMs)
      || !Number.isSafeInteger(endMs)
      || endMs <= startMs
      || Math.abs(endMs - startMs - DAY_MS) > MINUTE_MS
    ) {
      throw new Error(`Список лидеров не содержит корректный 24-часовой снимок для ${pair}. Обновите список и выберите монету снова.`);
    }
    rankingWindow = { startMs, endMs, openPrice };
  }

  const currentHourStart = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  const hourEndTime = currentHourStart - 1;
  const hourStartTime = currentHourStart - 24 * HOUR_MS;
  const currentDayStart = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const dailyEndTime = currentDayStart - 1;
  const dailyStartTime = currentDayStart - 7 * DAY_MS;

  const [hourlyCandles, bitcoinCandles, ethereumCandles, dailyRows, coinIdentity] = await Promise.all([
    rankingWindow
      ? fetchRollingHourlyCandles(
          pair,
          rankingWindow.startMs,
          rankingWindow.endMs,
          rankingWindow.openPrice,
          rankingSnapshot!.lastPriceUsdt,
          fetcher,
        )
      : fetchKlines(pair, "1h", hourStartTime, hourEndTime, 24, fetcher)
        .then((rows) => parseKlineRows(rows, 24, HOUR_MS, hourStartTime, nowMs, pair)),
    rankingSnapshot?.benchmarks
      ? Promise.resolve(null)
      : fetchKlines("BTCUSDT", "1h", hourStartTime, hourEndTime, 24, fetcher)
        .then((rows) => parseKlineRows(rows, 24, HOUR_MS, hourStartTime, nowMs, "BTCUSDT")),
    rankingSnapshot?.benchmarks
      ? Promise.resolve(null)
      : fetchKlines("ETHUSDT", "1h", hourStartTime, hourEndTime, 24, fetcher)
        .then((rows) => parseKlineRows(rows, 24, HOUR_MS, hourStartTime, nowMs, "ETHUSDT")),
    fetchKlines(pair, "1d", dailyStartTime, dailyEndTime, 7, fetcher),
    resolveCoinIdentity(symbol, fetcher),
  ]);
  const dailyCandles = parseKlineRows(
    dailyRows,
    7,
    DAY_MS,
    dailyStartTime,
    nowMs,
    `${pair}, дневные`,
  );
  const news = await findVerifiedRecentNews(symbol, coinIdentity.name, nowMs, fetcher);

  const candleHigh = Math.max(...hourlyCandles.map((candle) => candle.high));
  const candleLow = Math.min(...hourlyCandles.map((candle) => candle.low));
  const highPrice24h = finitePositive(rankingSnapshot?.highPrice24h) ?? candleHigh;
  const lowPrice24h = finitePositive(rankingSnapshot?.lowPrice24h) ?? candleLow;
  const currentPrice = rankingSnapshot?.lastPriceUsdt ?? hourlyCandles.at(-1)!.close;
  const quoteVolume24h = rankingSnapshot?.quoteVolume24h
    ?? hourlyCandles.reduce((sum, candle) => sum + candle.quoteVolume, 0);
  const dailyQuoteVolumes = dailyCandles.map((candle) => ({
    dayUtc: new Date(candle.openTime).toISOString().slice(0, 10),
    quoteVolume: candle.quoteVolume,
  }));
  const averageDailyQuoteVolume7d = dailyQuoteVolumes.reduce(
    (sum, candle) => sum + candle.quoteVolume,
    0,
  ) / 7;
  if (
    !Number.isFinite(quoteVolume24h)
    || quoteVolume24h <= 0
    || !Number.isFinite(averageDailyQuoteVolume7d)
    || averageDailyQuoteVolume7d <= 0
  ) {
    throw new Error(`Binance Spot не вернул достаточный объём торгов для ${pair}.`);
  }
  const firstCandle = hourlyCandles[0]!;
  const lastCandle = hourlyCandles.at(-1)!;
  return {
    coin: {
      name: coinIdentity.name,
      symbol,
      pair,
      sourceUrl: `https://www.binance.com/en/trade/${symbol}_USDT?type=spot`,
      logoDataUri: coinIdentity.logoDataUri,
    },
    currency: "USDT",
    periodStartUtc: new Date(rankingWindow?.startMs ?? firstCandle.openTime).toISOString(),
    periodEndUtc: new Date(rankingWindow?.endMs ?? lastCandle.closeTime + 1).toISOString(),
    ...(rankingWindow ? { periodKind: "rolling" as const } : { periodKind: "closed_hourly" as const }),
    hourlyCandles,
    dailyQuoteVolumes,
    currentPrice,
    changePercent24h: rankingSnapshot?.changePercent24h ?? periodChange(hourlyCandles),
    highPrice24h,
    lowPrice24h,
    drawdownFromHighPercent: Math.max(0, (1 - currentPrice / highPrice24h) * 100),
    quoteVolume24h,
    averageDailyQuoteVolume7d,
    volumeVs7dAverage: quoteVolume24h / averageDailyQuoteVolume7d,
    benchmarks: rankingSnapshot?.benchmarks ?? [
      { symbol: "BTC", changePercent24h: periodChange(bitcoinCandles!) },
      { symbol: "ETH", changePercent24h: periodChange(ethereumCandles!) },
    ],
    news,
    retrievedAt: new Date(nowMs).toISOString(),
  };
}

async function fetchRollingDailyCandles30d(
  pair: string,
  windowStartMs: number,
  windowEndMs: number,
  openPrice: number,
  lastPrice: number,
  fetcher: typeof fetch,
): Promise<MarketFocusCandle[]> {
  const firstMinuteStart = Math.floor(windowStartMs / MINUTE_MS) * MINUTE_MS;
  const lastCompleteMinuteStart = Math.floor(windowEndMs / MINUTE_MS) * MINUTE_MS - MINUTE_MS;
  if (lastCompleteMinuteStart < firstMinuteStart) {
    throw new Error(`Не удалось построить скользящее окно 30 дней для ${pair}.`);
  }

  const minuteCandles: MarketFocusCandle[] = [];
  for (let batchStart = firstMinuteStart; batchStart <= lastCompleteMinuteStart;) {
    const remainingCount = Math.floor((lastCompleteMinuteStart - batchStart) / MINUTE_MS) + 1;
    const count = Math.min(1_000, remainingCount);
    const batchEnd = batchStart + (count - 1) * MINUTE_MS;
    const payload = await fetchKlines(
      pair,
      "1m",
      batchStart,
      batchEnd + MINUTE_MS - 1,
      count,
      fetcher,
    );
    minuteCandles.push(...parseSparseKlineRows(
      payload,
      MINUTE_MS,
      batchStart,
      batchEnd,
      windowEndMs,
      `${pair}, скользящие минутные данные за 30 дней`,
    ));
    batchStart = batchEnd + MINUTE_MS;
  }

  const dailyGroups: MarketFocusCandle[][] = Array.from({ length: 30 }, () => []);
  for (const candle of minuteCandles) {
    if (candle.closeTime < windowStartMs || candle.openTime >= windowEndMs) continue;
    const bucket = Math.max(
      0,
      Math.min(29, Math.floor((candle.openTime - windowStartMs) / DAY_MS)),
    );
    dailyGroups[bucket]!.push(candle);
  }

  let previousClose = openPrice;
  return dailyGroups.map((candles, index) => {
    const bucketStart = windowStartMs + index * DAY_MS;
    const bucketEnd = Math.min(windowEndMs, bucketStart + DAY_MS);
    const open = previousClose;
    const last = candles.at(-1);
    const close = index === 29 ? lastPrice : last?.close ?? previousClose;
    previousClose = close;
    return {
      openTime: bucketStart,
      closeTime: bucketEnd - 1,
      open,
      high: Math.max(open, close, ...candles.map((candle) => candle.high)),
      low: Math.min(open, close, ...candles.map((candle) => candle.low)),
      close,
      quoteVolume: candles.reduce((sum, candle) => sum + candle.quoteVolume, 0),
    };
  });
}

export async function resolveMarketFocus30dMarketData(
  topicInput: string,
  options: {
    fetcher?: typeof fetch;
    rankingSnapshot: MarketFocus30dRankingSnapshot;
  },
): Promise<MarketFocusMarketData> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("Сетевой клиент для проверки рынка недоступен.");
  const snapshot = options.rankingSnapshot;
  const { symbol, pair } = normalizePair(topicInput);
  const expectedWindowMs = 30 * DAY_MS;
  if (
    !Number.isFinite(snapshot.changePercent30d)
    || !Number.isFinite(snapshot.changePercent24h)
    || !Number.isFinite(snapshot.lastPriceUsdt)
    || snapshot.lastPriceUsdt <= 0
    || !Number.isFinite(snapshot.quoteVolume24h)
    || snapshot.quoteVolume24h <= 0
    || !Number.isFinite(snapshot.openPriceUsdt)
    || snapshot.openPriceUsdt <= 0
    || !Number.isSafeInteger(snapshot.windowStartMs)
    || !Number.isSafeInteger(snapshot.windowEndMs)
    || snapshot.windowEndMs <= snapshot.windowStartMs
    || Math.abs(snapshot.windowEndMs - snapshot.windowStartMs - expectedWindowMs) >= MINUTE_MS
    || snapshot.periodBenchmarks.some((item) => !Number.isFinite(item.changePercent))
  ) {
    throw new Error(`Список лидеров не содержит корректный снимок Binance за 30 дней для ${pair}. Обновите список и выберите монету снова.`);
  }
  const nowMs = snapshot.windowEndMs;
  await validateSpotPair(pair, symbol, fetcher);

  const [periodCandles, coinIdentity] = await Promise.all([
    fetchRollingDailyCandles30d(
      pair,
      snapshot.windowStartMs,
      snapshot.windowEndMs,
      snapshot.openPriceUsdt,
      snapshot.lastPriceUsdt,
      fetcher,
    ),
    resolveCoinIdentity(symbol, fetcher),
  ]);
  const news = await findVerifiedRecentNews(symbol, coinIdentity.name, nowMs, fetcher);
  const periodHighPrice = Math.max(...periodCandles.map((candle) => candle.high));
  const periodLowPrice = Math.min(...periodCandles.map((candle) => candle.low));
  const periodQuoteVolume = periodCandles.reduce((sum, candle) => sum + candle.quoteVolume, 0);
  const periodAverageDailyQuoteVolume = periodQuoteVolume / periodCandles.length;
  const dailyQuoteVolumes = periodCandles.map((candle) => ({
    dayUtc: new Date(candle.openTime).toISOString().slice(0, 10),
    quoteVolume: candle.quoteVolume,
  }));
  const averageDailyQuoteVolume7d = dailyQuoteVolumes
    .slice(-7)
    .reduce((sum, candle) => sum + candle.quoteVolume, 0) / Math.min(7, dailyQuoteVolumes.length);
  if (
    !Number.isFinite(periodQuoteVolume)
    || periodQuoteVolume <= 0
    || !Number.isFinite(periodAverageDailyQuoteVolume)
    || periodAverageDailyQuoteVolume <= 0
    || !Number.isFinite(averageDailyQuoteVolume7d)
    || averageDailyQuoteVolume7d <= 0
  ) {
    throw new Error(`Binance Spot не вернул достаточный оборот за последние 30 дней для ${pair}.`);
  }
  return {
    coin: {
      name: coinIdentity.name,
      symbol,
      pair,
      sourceUrl: `https://www.binance.com/en/trade/${symbol}_USDT?type=spot`,
      logoDataUri: coinIdentity.logoDataUri,
    },
    currency: "USDT",
    periodStartUtc: new Date(snapshot.windowStartMs).toISOString(),
    periodEndUtc: new Date(snapshot.windowEndMs).toISOString(),
    periodKind: "rolling_30d",
    hourlyCandles: [],
    periodCandles,
    periodChangePercent: snapshot.changePercent30d,
    periodHighPrice,
    periodLowPrice,
    periodDrawdownFromHighPercent: Math.max(0, (1 - snapshot.lastPriceUsdt / periodHighPrice) * 100),
    periodQuoteVolume,
    periodAverageDailyQuoteVolume,
    periodVolumeVsAverage: snapshot.quoteVolume24h / periodAverageDailyQuoteVolume,
    periodBenchmarks: snapshot.periodBenchmarks,
    dailyQuoteVolumes,
    currentPrice: snapshot.lastPriceUsdt,
    changePercent24h: snapshot.changePercent24h,
    highPrice24h: snapshot.highPrice24h,
    lowPrice24h: snapshot.lowPrice24h,
    drawdownFromHighPercent: Math.max(0, (1 - snapshot.lastPriceUsdt / snapshot.highPrice24h) * 100),
    quoteVolume24h: snapshot.quoteVolume24h,
    averageDailyQuoteVolume7d,
    volumeVs7dAverage: snapshot.quoteVolume24h / averageDailyQuoteVolume7d,
    benchmarks: snapshot.benchmarks,
    news,
    retrievedAt: new Date(nowMs).toISOString(),
  };
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: value >= 1_000 ? 0 : 2,
    maximumFractionDigits: value >= 1_000 ? 0 : value >= 1 ? 2 : 6,
  }).format(value);
}

function formatPercent(value: number): string {
  const direction = value > 0 ? "плюс" : value < 0 ? "минус" : "около нуля";
  const amount = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return value === 0 ? "около нуля процентов" : `${direction} ${amount} процента`;
}

function formatPriceChangeForVoice(value: number): string {
  if (value === 0) return "почти не изменился";
  const amount = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value));
  return `${value > 0 ? "вырос" : "снизился"} на ${amount} процента`;
}

type MarketFocusChangeData = {
  changePercent24h: number;
  periodKind?: MarketFocusMarketData["periodKind"];
  periodChangePercent?: number;
};

export function getMarketFocusPeriodLabel(data: Pick<MarketFocusMarketData, "periodKind">): string {
  return data.periodKind === "rolling_30d" ? "30 дней" : "24 часа";
}

export function getMarketFocusPeriodChangePercent(data: MarketFocusChangeData): number {
  if (data.periodKind === "rolling_30d") {
    if (typeof data.periodChangePercent !== "number" || !Number.isFinite(data.periodChangePercent)) {
      throw new Error("В снимке месячного обзора отсутствует точное изменение цены за 30 дней.");
    }
    return data.periodChangePercent;
  }
  return data.changePercent24h;
}

export function getMarketFocusPeriodCandles(data: Pick<
  MarketFocusMarketData,
  "periodKind" | "periodCandles" | "hourlyCandles"
>): MarketFocusCandle[] {
  if (data.periodKind === "rolling_30d") {
    if (!data.periodCandles?.length) {
      throw new Error("В снимке месячного обзора отсутствуют свечи за 30 дней.");
    }
    return data.periodCandles;
  }
  return data.hourlyCandles;
}

export function calculateMarketFocusHypotheticalPnlUsd(
  data: MarketFocusChangeData,
): number {
  return MARKET_FOCUS_HYPOTHETICAL_STAKE_USD * getMarketFocusPeriodChangePercent(data) / 100;
}

export function calculateMarketFocusHypotheticalExitValueUsdt(
  data: MarketFocusChangeData,
): number {
  return MARKET_FOCUS_HYPOTHETICAL_STAKE_USD + calculateMarketFocusHypotheticalPnlUsd(data);
}

export function formatMarketFocusHypotheticalPnlForVoice(
  data: MarketFocusChangeData,
): string {
  const result = calculateMarketFocusHypotheticalPnlUsd(data);
  if (Math.abs(result) < 0.5) return "около нуля долларов США";
  const amount = new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "name",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(Math.abs(result));
  return `${result > 0 ? "плюс" : "минус"} ${amount}`;
}

function formatMarketFocusUsdtForVoice(value: number): string {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)} USDT`;
}

function formatMarketFocusAbsolutePercent(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(value));
}

function formatMarketFocusSignedPercent(value: number): string {
  if (value === 0) return `0,0%`;
  return `${value > 0 ? "+" : "−"}${formatMarketFocusAbsolutePercent(value)}%`;
}

export function buildMarketFocusVideoTitle(data: Pick<MarketFocusMarketData, "coin" | "changePercent24h">
  & Partial<Pick<MarketFocusMarketData, "periodKind" | "periodChangePercent">>): string {
  const changePercent = getMarketFocusPeriodChangePercent(data);
  const periodLabel = getMarketFocusPeriodLabel(data);
  if (changePercent > 0) {
    return `Рост ${data.coin.symbol} на ${formatMarketFocusAbsolutePercent(changePercent)}% за ${periodLabel}: что произошло?`;
  }
  if (changePercent < 0) {
    return `Падение ${data.coin.symbol} на ${formatMarketFocusAbsolutePercent(changePercent)}% за ${periodLabel}: что произошло?`;
  }
  return `Что произошло с ${data.coin.symbol} за ${periodLabel}?`;
}

function formatCompactUsdt(value: number): string {
  const amount = new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
  return `${amount} USDT`;
}

function formatUtcWindow(data: MarketFocusMarketData): string {
  const format = (value: string) => new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(value));
  return `${format(data.periodStartUtc)}–${format(data.periodEndUtc)} UTC`;
}

function formatUtcWindowForVoice(data: MarketFocusMarketData): string {
  const format = (value: string) => Object.fromEntries(new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    calendar: "gregory",
    timeZone: "UTC",
  }).formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  const start = format(data.periodStartUtc);
  const end = format(data.periodEndUtc);
  const startDay = start.day as string;
  const endDay = end.day as string;
  const startMonth = start.month as string;
  const endMonth = end.month as string;
  const startYear = start.year as string;
  const endYear = end.year as string;
  if (startYear === endYear && startMonth === endMonth) {
    return startDay === endDay
      ? `за ${startDay} ${startMonth}`
      : `с ${startDay} по ${endDay} ${startMonth}`;
  }
  if (startYear === endYear) return `с ${startDay} ${startMonth} по ${endDay} ${endMonth}`;
  return `с ${startDay} ${startMonth} ${startYear} года по ${endDay} ${endMonth} ${endYear} года`;
}

export function buildMarketFocusStory(
  data: MarketFocusMarketData,
): MarketFocusStoryScene[] {
  const isMonthly = data.periodKind === "rolling_30d";
  const periodLabel = getMarketFocusPeriodLabel(data);
  const periodChangePercent = getMarketFocusPeriodChangePercent(data);
  const periodCandles = getMarketFocusPeriodCandles(data);
  const periodBenchmarks = data.periodBenchmarks ?? [
    { symbol: "BTC" as const, changePercent: data.benchmarks[0].changePercent24h },
    { symbol: "ETH" as const, changePercent: data.benchmarks[1].changePercent24h },
  ];
  const lowPrice = isMonthly ? data.periodLowPrice ?? data.lowPrice24h : data.lowPrice24h;
  const highPrice = isMonthly ? data.periodHighPrice ?? data.highPrice24h : data.highPrice24h;
  const drawdownFromHighPercent = isMonthly
    ? data.periodDrawdownFromHighPercent ?? data.drawdownFromHighPercent
    : data.drawdownFromHighPercent;
  const periodVolume = data.periodQuoteVolume ?? data.quoteVolume24h;
  const periodAverageDailyVolume = data.periodAverageDailyQuoteVolume ?? data.averageDailyQuoteVolume7d;
  const periodVolumeMultiple = data.periodVolumeVsAverage ?? data.volumeVs7dAverage;
  const btcChange = formatPercent(periodBenchmarks[0].changePercent);
  const ethChange = formatPercent(periodBenchmarks[1].changePercent);
  const drawdown = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(drawdownFromHighPercent);
  const volumeMultiple = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(periodVolumeMultiple);
  const priceChange = formatMarketFocusAbsolutePercent(periodChangePercent);
  const hypotheticalPnl = calculateMarketFocusHypotheticalPnlUsd(data);
  const hypotheticalExitValue = calculateMarketFocusHypotheticalExitValueUsdt(data);
  const hypotheticalOutcome = Math.abs(hypotheticalPnl) < 0.5
    ? "почти не изменилась бы"
    : `на ${formatMarketFocusUsdtForVoice(Math.abs(hypotheticalPnl))} ${hypotheticalPnl > 0 ? "больше" : "меньше"} исходной суммы`;
  const newsScene: MarketFocusStoryScene = data.news
    ? (() => {
        const sourceDate = new Intl.DateTimeFormat("ru-RU", {
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        }).format(new Date(data.news!.publishedAt));
        const headlineExcerpt = data.news!.title.length > 112
          ? `${data.news!.title.slice(0, 109).trimEnd()}…`
          : data.news!.title;
        return {
          key: "news",
          title: "ВОЗМОЖНЫЙ КОНТЕКСТ",
          subtitle: `${data.news!.sourceName} · ${sourceDate} UTC`,
          voiceText: `В ${data.news!.sourceName} вышел заголовок: «${headlineExcerpt}». Он может быть связан с движением, но доказательств этому нет.`,
          visualHint: "Карточка свежего заголовка с издателем и датой из прямой ленты издателя.",
          visualAction: "Покажите заголовок как возможный контекст, отдельно отметив, что причина движения не доказана.",
        };
      })()
    : {
        key: "news",
        title: "ПОВОД НЕ УСТАНОВЛЕН",
        subtitle: "Свежего подтверждённого инфоповода нет",
        voiceText: "За последнюю неделю в проверенных источниках не нашли новости, которая объясняла бы движение. Точная причина неизвестна.",
        visualHint: "Нейтральная карточка об отсутствии найденной публикации; не показывайте выдуманный заголовок или причину роста.",
        visualAction: "Ясно сообщите, что подтверждённого повода нет, и не выдавайте предположение за факт.",
      };
  return [
    {
      key: "impulse",
      title: `${data.coin.symbol} • ${formatMarketFocusSignedPercent(periodChangePercent)} ЗА ${isMonthly ? "30 ДНЕЙ" : "24 ЧАСА"}`,
      subtitle: `${formatUtcWindow(data)} · ${isMonthly || data.periodKind === "rolling" ? "скользящее окно Binance" : "24 закрытые свечи"}`,
      voiceText: `Привет, друзья! Сегодня разбираем, что произошло с ${data.coin.name}. За ${isMonthly ? "последние скользящие 30 дней" : data.periodKind === "rolling" ? "последние скользящие 24 часа" : `период ${formatUtcWindowForVoice(data)}`} цена ${periodChangePercent > 0 ? "выросла" : periodChangePercent < 0 ? "снизилась" : "почти не изменилась"}${periodChangePercent === 0 ? "" : ` на ${priceChange} процента`}.`,
      visualHint: `Крупная карточка монеты, тикер и изменение цены за ${isMonthly ? "скользящее окно последних 30 дней" : data.periodKind === "rolling" ? "скользящее окно последних 24 часов" : "24 закрытые часовые свечи"}.`,
      visualAction: "Покажите логотип монеты в центральном круге, подтверждённое изменение цены и период без прогноза.",
    },
    {
      key: "candles",
      title: "ДИАПАЗОН И ОТКАТ",
      subtitle: `${formatPrice(lowPrice)}–${formatPrice(highPrice)} USDT · от пика −${drawdown}%`,
      voiceText: `Минимум и максимум цены ${isMonthly ? "за 30 дней" : "за сутки"} показаны на экране. ${data.periodKind === "rolling" || isMonthly ? "На момент снимка" : "К закрытию"} цена была на ${drawdown} процента ниже максимума.`,
      visualHint: `${isMonthly ? "30 дневных свечей, собранных по скользящему окну" : data.periodKind === "rolling" ? "24 часовые свечи, собранные по скользящему окну" : "24 закрытые часовые свечи"} с отмеченными минимумом, максимумом и текущим откатом от пика.`,
      visualAction: `Постройте ${isMonthly ? "ровно 30 дневных" : "ровно 24 часовые"} свечей по Binance Spot для показанного UTC-окна; выделите high, low и последнюю цену.`,
    },
    {
      key: "investment",
      title: "УСЛОВНЫЕ $1 000",
      subtitle: `${formatMarketFocusUsdtForVoice(hypotheticalExitValue)} на выходе · до комиссий`,
      voiceText: `Если бы в начале периода вложить тысячу долларов, на выходе получилось бы около ${formatMarketFocusUsdtForVoice(hypotheticalExitValue)}. Это было бы ${hypotheticalOutcome}, до комиссий и проскальзывания. Это расчёт по изменению цены, а не гарантированный результат.`,
      visualHint: "Анимация превращения условной начальной суммы $1 000 в фактический расчётный итог в USDT; результат может быть положительным или отрицательным.",
      visualAction: "Плавно пересчитайте баланс от $1 000 до результата по подтверждённому изменению цены. Для роста используйте зелёный цвет и кассовый акцент; для падения — красный цвет без звука прибыли.",
      soundEffect: hypotheticalPnl > 0 ? "cash_register" : "none",
    },
    {
      key: "volume",
      title: "ОБОРОТ И СРЕДНЕЕ",
      subtitle: isMonthly
        ? `${formatCompactUsdt(periodVolume)} за 30 дней · ~${formatCompactUsdt(periodAverageDailyVolume)} в сутки`
        : `${formatCompactUsdt(data.quoteVolume24h)} · ${volumeMultiple}× среднего за 7 дней`,
      voiceText: isMonthly
        ? `За последние 30 дней оборот составил примерно ${formatCompactUsdt(periodVolume)} — в среднем около ${formatCompactUsdt(periodAverageDailyVolume)} в сутки. Общий оборот не равен деньгам, которые пришли в монету.`
        : `За сутки прошло сделок примерно на ${formatCompactUsdt(data.quoteVolume24h)} — это ${volumeMultiple} раза больше среднего за неделю. Но общий оборот не равен деньгам, которые пришли в монету.`,
      visualHint: isMonthly
        ? "Сопоставление 30 дневных quote-объёмов Binance Spot с их средним за выбранный период."
        : "Сопоставление суточного quote-объёма с семью завершёнными дневными объёмами Binance Spot.",
      visualAction: isMonthly
        ? "Покажите 30 дневных столбцов оборота за то же скользящее окно и отметьте средний дневной объём."
        : "Сначала покажите семь дневных столбцов, затем выделите оборот последних 24 часов.",
    },
    newsScene,
    {
      key: "benchmarks",
      title: "В ТО ЖЕ ВРЕМЯ",
      subtitle: `BTC ${btcChange} · ETH ${ethChange}`,
      voiceText: `За те же ${periodLabel} биткоин ${formatPriceChangeForVoice(periodBenchmarks[0].changePercent)}, а эфир ${formatPriceChangeForVoice(periodBenchmarks[1].changePercent)}. Это помогает сравнить движение с рынком, но не объясняет его причину.`,
      visualHint: "Три сопоставимых полосы: выбранная монета, BTC и ETH за один и тот же UTC-интервал.",
      visualAction: "Сравните три процента относительно нуля и подпишите единое временное окно.",
    },
    {
      key: "risk",
      title: "ФАКТЫ, НЕ ПРОГНОЗ",
      subtitle: "Волатильность · источники · без инвестиционного совета",
      voiceText: data.news
        ? "Рыночное движение может развернуться. Заголовок не доказывает, что именно он вызвал изменение цены. Это обзор данных, не рекомендация покупать или продавать."
        : "Точную причину движения мы не нашли. Рост или падение может развернуться. Это обзор данных, не рекомендация покупать или продавать.",
      visualHint: "Финальная карточка с риском волатильности, временной отметкой и источниками данных.",
      visualAction: "Завершите нейтральным предупреждением; не добавляйте CTA и обещания доходности.",
    },
  ];
}