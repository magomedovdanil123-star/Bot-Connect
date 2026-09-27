const BINANCE_API = "https://api.binance.com";
const COINGECKO_API = "https://api.coingecko.com/api/v3";
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const REQUEST_TIMEOUT_MS = 12_000;
const NEWS_MAX_AGE_MS = 7 * DAY_MS;

export const MARKET_FOCUS_SCENE_DURATIONS_SECONDS = [
  5.8,
  5.8,
  6.2,
  6.4,
  5.4,
  5.4,
] as const;

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

export type MarketFocusMarketData = {
  coin: {
    name: string;
    symbol: string;
    pair: string;
    sourceUrl: string;
  };
  currency: "USDT";
  periodStartUtc: string;
  periodEndUtc: string;
  hourlyCandles: MarketFocusCandle[];
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
  news: MarketFocusNewsItem;
  retrievedAt: string;
};

export type MarketFocusStoryScene = {
  key: "impulse" | "candles" | "volume" | "news" | "benchmarks" | "risk";
  title: string;
  subtitle: string;
  voiceText: string;
  visualHint: string;
  visualAction: string;
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
  priceChangePercent?: unknown;
  quoteVolume?: unknown;
};

type CoinGeckoSearchResponse = {
  coins?: Array<{
    id?: unknown;
    name?: unknown;
    symbol?: unknown;
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

async function resolveCoinName(symbol: string, fetcher: typeof fetch): Promise<string> {
  const url = `${COINGECKO_API}/search?query=${encodeURIComponent(symbol)}`;
  try {
    const response = await requestJson<CoinGeckoSearchResponse>(url, "CoinGecko", fetcher);
    const matches = (Array.isArray(response?.coins) ? response.coins : [])
      .filter((coin) => (
        typeof coin?.symbol === "string"
        && coin.symbol.toLocaleUpperCase("en-US") === symbol
        && typeof coin.name === "string"
        && coin.name.trim()
      ));
    // Avoid matching a headline to the wrong asset where a ticker is shared.
    return matches.length === 1 ? (matches[0]!.name as string).trim() : symbol;
  } catch (error) {
    console.warn(
      `[market-focus] CoinGecko identity lookup unavailable for ${symbol}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return symbol;
  }
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
  for (const result of responses) {
    if (result.status === "rejected") {
      console.warn(
        `[market-focus] Publisher RSS unavailable: ${
          result.reason instanceof Error ? result.reason.message : String(result.reason)
        }`,
      );
      continue;
    }
    const { feed, items } = result.value;
    recentStories.push(...items.filter((item) => {
      const publishedMs = Date.parse(item.publishedAt);
      return publishedMs <= nowMs + 5 * 60_000
        && publishedMs >= nowMs - NEWS_MAX_AGE_MS
        && matchesCoinNews(item, symbol, coinName, feed);
    }));
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

async function fetchKlines(
  pair: string,
  interval: "1h" | "1d",
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

function normalizeExcludedMarketFocusSymbol(value: string): string {
  const normalized = value.trim().replace(/^\$/, "").replace(/[\/-\s]/g, "").toLocaleUpperCase("en-US");
  return normalized.endsWith("USDT") ? normalized.slice(0, -"USDT".length) : normalized;
}

async function fetchMarketFocusGainerCandidates(
  fetcher: typeof fetch,
): Promise<Array<{ symbol: string; changePercent: number; quoteVolume: number }>> {
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

  const candidates: Array<{ symbol: string; changePercent: number; quoteVolume: number }> = [];
  for (const item of tickerPayload as Binance24HourTicker[]) {
    if (typeof item.symbol !== "string" || !item.symbol.endsWith("USDT")) continue;
    const symbol = item.symbol.slice(0, -"USDT".length).toLocaleUpperCase("en-US");
    const changePercent = Number(item.priceChangePercent);
    const quoteVolume = finitePositive(item.quoteVolume);
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
    candidates.push({ symbol, changePercent, quoteVolume });
  }
  return candidates.sort((left, right) => (
    right.changePercent - left.changePercent
    || right.quoteVolume - left.quoteVolume
    || left.symbol.localeCompare(right.symbol, "en-US")
  ));
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

export async function resolveMarketFocusMarketData(
  topicInput: string,
  options: {
    fetcher?: typeof fetch;
    now?: () => number;
  } = {},
): Promise<MarketFocusMarketData> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  const nowMs = options.now?.() ?? Date.now();
  if (typeof fetcher !== "function") throw new Error("Сетевой клиент для проверки рынка недоступен.");
  const { symbol, pair } = normalizePair(topicInput);
  await validateSpotPair(pair, symbol, fetcher);

  const currentHourStart = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  const hourEndTime = currentHourStart - 1;
  const hourStartTime = currentHourStart - 24 * HOUR_MS;
  const currentDayStart = Math.floor(nowMs / DAY_MS) * DAY_MS;
  const dailyEndTime = currentDayStart - 1;
  const dailyStartTime = currentDayStart - 7 * DAY_MS;

  const [coinRows, bitcoinRows, ethereumRows, dailyRows, coinName] = await Promise.all([
    fetchKlines(pair, "1h", hourStartTime, hourEndTime, 24, fetcher),
    fetchKlines("BTCUSDT", "1h", hourStartTime, hourEndTime, 24, fetcher),
    fetchKlines("ETHUSDT", "1h", hourStartTime, hourEndTime, 24, fetcher),
    fetchKlines(pair, "1d", dailyStartTime, dailyEndTime, 7, fetcher),
    resolveCoinName(symbol, fetcher),
  ]);
  const hourlyCandles = parseKlineRows(
    coinRows,
    24,
    HOUR_MS,
    hourStartTime,
    nowMs,
    pair,
  );
  const bitcoinCandles = parseKlineRows(
    bitcoinRows,
    24,
    HOUR_MS,
    hourStartTime,
    nowMs,
    "BTCUSDT",
  );
  const ethereumCandles = parseKlineRows(
    ethereumRows,
    24,
    HOUR_MS,
    hourStartTime,
    nowMs,
    "ETHUSDT",
  );
  const dailyCandles = parseKlineRows(
    dailyRows,
    7,
    DAY_MS,
    dailyStartTime,
    nowMs,
    `${pair}, дневные`,
  );
  const news = await findVerifiedRecentNews(symbol, coinName, nowMs, fetcher);
  if (!news) {
    throw new Error(
      `Не нашёл свежую новость о ${coinName} (${symbol}) с прямой ссылкой в проверяемых источниках за последние 7 дней. Ролик не будет собран без подтверждённого контекста.`,
    );
  }

  const highPrice24h = Math.max(...hourlyCandles.map((candle) => candle.high));
  const lowPrice24h = Math.min(...hourlyCandles.map((candle) => candle.low));
  const currentPrice = hourlyCandles.at(-1)!.close;
  const quoteVolume24h = hourlyCandles.reduce((sum, candle) => sum + candle.quoteVolume, 0);
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
      name: coinName,
      symbol,
      pair,
      sourceUrl: `https://www.binance.com/en/trade/${symbol}_USDT?type=spot`,
    },
    currency: "USDT",
    periodStartUtc: new Date(firstCandle.openTime).toISOString(),
    periodEndUtc: new Date(lastCandle.closeTime + 1).toISOString(),
    hourlyCandles,
    dailyQuoteVolumes,
    currentPrice,
    changePercent24h: periodChange(hourlyCandles),
    highPrice24h,
    lowPrice24h,
    drawdownFromHighPercent: Math.max(0, (1 - currentPrice / highPrice24h) * 100),
    quoteVolume24h,
    averageDailyQuoteVolume7d,
    volumeVs7dAverage: quoteVolume24h / averageDailyQuoteVolume7d,
    benchmarks: [
      { symbol: "BTC", changePercent24h: periodChange(bitcoinCandles) },
      { symbol: "ETH", changePercent24h: periodChange(ethereumCandles) },
    ],
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

export function buildMarketFocusStory(
  data: MarketFocusMarketData,
): MarketFocusStoryScene[] {
  const change = formatPercent(data.changePercent24h);
  const btcChange = formatPercent(data.benchmarks[0].changePercent24h);
  const ethChange = formatPercent(data.benchmarks[1].changePercent24h);
  const drawdown = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(data.drawdownFromHighPercent);
  const volumeMultiple = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(data.volumeVs7dAverage);
  const sourceDate = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(data.news.publishedAt));
  const headlineExcerpt = data.news.title.length > 112
    ? `${data.news.title.slice(0, 109).trimEnd()}…`
    : data.news.title;
  return [
    {
      key: "impulse",
      title: `${data.coin.symbol} • ДВИЖЕНИЕ ЗА 24 ЧАСА`,
      subtitle: `${formatUtcWindow(data)} · 24 закрытые свечи`,
      voiceText: `${data.coin.name} (${data.coin.symbol}): за сутки изменение ${change}.`,
      visualHint: "Крупная карточка монеты, тикер, изменение за окно из 24 закрытых часовых свечей.",
      visualAction: "Покажите ценовой импульс и временной диапазон без прогноза.",
    },
    {
      key: "candles",
      title: "ДИАПАЗОН И ОТКАТ",
      subtitle: `${formatPrice(data.lowPrice24h)}–${formatPrice(data.highPrice24h)} USDT · от пика −${drawdown}%`,
      voiceText: `Диапазон — ${formatPrice(data.lowPrice24h)}–${formatPrice(data.highPrice24h)} USDT; сейчас на ${drawdown} процента ниже максимума.`,
      visualHint: "24 часовые японские свечи с отмеченными минимумом, максимумом и текущим откатом от пика.",
      visualAction: "Постройте ровно 24 свечи по Binance Spot; выделите high, low и последнюю цену.",
    },
    {
      key: "volume",
      title: "ОБОРОТ И СРЕДНЕЕ",
      subtitle: `${formatCompactUsdt(data.quoteVolume24h)} · ${volumeMultiple}× среднего за 7 дней`,
      voiceText: `Оборот — ${formatCompactUsdt(data.quoteVolume24h)}; это ${volumeMultiple} раза выше среднего семи полных дней UTC. Это не чистый приток.`,
      visualHint: "Сопоставление суточного quote-объёма с семью завершёнными дневными объёмами Binance Spot.",
      visualAction: "Сначала покажите семь дневных столбцов, затем выделите оборот последних 24 часов.",
    },
    {
      key: "news",
      title: "ВОЗМОЖНЫЙ КОНТЕКСТ",
      subtitle: `${data.news.sourceName} · ${sourceDate} UTC`,
      voiceText: `Заголовок ${data.news.sourceName}: «${headlineExcerpt}». Связь с движением цены не доказана.`,
      visualHint: "Карточка свежего заголовка с издателем и датой из прямой ленты издателя.",
      visualAction: "Покажите заголовок как возможный контекст, отдельно отметив, что причина движения не доказана.",
    },
    {
      key: "benchmarks",
      title: "В ТО ЖЕ ВРЕМЯ",
      subtitle: `BTC ${btcChange} · ETH ${ethChange}`,
      voiceText: `За то же окно BTC — ${btcChange}, ETH — ${ethChange}. Сравнение не доказывает причину движения ${data.coin.symbol}.`,
      visualHint: "Три сопоставимых полосы: выбранная монета, BTC и ETH за один и тот же UTC-интервал.",
      visualAction: "Сравните три процента относительно нуля и подпишите единое временное окно.",
    },
    {
      key: "risk",
      title: "ФАКТЫ, НЕ ПРОГНОЗ",
      subtitle: "Волатильность · источники · без инвестиционного совета",
      voiceText: `Резкий импульс может развернуться. Новость не доказывает спрос на токен. Не инвестиционная рекомендация.`,
      visualHint: "Финальная карточка с риском волатильности, временной отметкой и источниками данных.",
      visualAction: "Завершите нейтральным предупреждением; не добавляйте CTA и обещания доходности.",
    },
  ];
}