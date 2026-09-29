const COINGECKO_API = "https://api.coingecko.com/api/v3";
const HYPERLIQUID_INFO_API = "https://api.hyperliquid.xyz/info";
const CACHE_TTL_MS = 45_000;
const MIN_SEVEN_DAY_SPAN_MS = 6 * 24 * 60 * 60 * 1_000;

export const COIN_OVERVIEW_SCENE_DURATIONS_SECONDS = [
  12,
  4.8,
  9.1,
  5.5,
  7.9,
  11.9,
] as const;

export const CRYPTO_MARKET_7D_CTA =
  "Все эти движения можно отслеживать самостоятельно. Ссылка на биржу — в описании и шапке профиля.";

type CoinGeckoSearchCoin = {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
};

type CoinGeckoMarket = {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank?: number | null;
  current_price: number | null;
  market_cap: number | null;
  total_volume: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  last_updated: string | null;
};

type PricePoint = {
  timestamp: number;
  priceUsd: number;
};

export type CoinOverviewBenchmark = {
  id: "bitcoin" | "ethereum";
  name: "Bitcoin" | "Ethereum";
  symbol: "BTC" | "ETH";
  changePercent7d: number;
};

export type CoinOverviewActivity = {
  kind: "open_interest" | "trading_volume";
  valueUsd: number;
  sourceLabel: "Hyperliquid" | "CoinGecko";
  sourceUrl: string;
};

export type CoinOverviewMarketData = {
  coin: {
    id: string;
    name: string;
    symbol: string;
    marketCapRank: number | null;
    sourceUrl: string;
  };
  currency: "USD";
  periodDays: 7;
  currentPriceUsd: number;
  periodStartPriceUsd: number;
  changePercent7d: number;
  lowPriceUsd7d: number;
  highPriceUsd7d: number;
  priceSamples: Array<{
    timestamp: number;
    label: string;
    priceUsd: number;
  }>;
  activity: CoinOverviewActivity;
  benchmarks: [CoinOverviewBenchmark, CoinOverviewBenchmark];
  hypothetical100Usd: number;
  marketCapUsd: number | null;
  dataAsOf: string;
  retrievedAt: string;
};

export type CoinOverviewStoryScene = {
  key: "identity" | "price_history" | "activity" | "benchmarks" | "hypothetical" | "risk_sources";
  title: string;
  subtitle: string;
  voiceText: string;
  visualHint: string;
  visualAction: string;
};

export type CoinMarketLeader7d = {
  coin: {
    id: string;
    name: string;
    symbol: string;
    marketCapRank: number;
    sourceUrl: string;
  };
  currentPriceUsd: number;
  changePercent7d: number;
  lowPriceUsd7d: number;
  highPriceUsd7d: number;
  volumeUsd24h: number;
  priceSamples: Array<{
    timestamp: number;
    label: string;
    priceUsd: number;
  }>;
  entryZone: {
    supportUsd: number;
    lowUsd: number;
    highUsd: number;
    basis: "local_support" | "weekly_low";
  };
};

export type CoinLeaders7dMarketData = {
  leaders: {
    gainer: CoinMarketLeader7d;
    decliner: CoinMarketLeader7d;
  };
  screenedCoinCount: number;
  retrievedAt: string;
  dataAsOf: string;
  sourceLabel?: "CoinGecko";
  sourceUrl: string;
};

export type CoinLeaders7dGainerOption = {
  coin: {
    id: string;
    name: string;
    symbol: string;
    marketCapRank: number;
    sourceUrl: string;
  };
  changePercent7d: number;
};

export type CoinLeaders7dStoryScene = {
  key: "market_summary" | "gainer" | "gainer_entry" | "decliner" | "decliner_entry" | "risk_sources";
  title: string;
  subtitle: string;
  voiceText: string;
  visualHint: string;
  visualAction: string;
};

type CoinGeckoChartResponse = {
  prices?: unknown;
};

type HyperliquidMetaResponse = [
  { universe?: Array<{ name?: unknown }> },
  Array<{ openInterest?: unknown; markPx?: unknown }>,
];

const jsonCache = new Map<string, { expiresAt: number; value: unknown }>();
const MARKET_LEADERS_MINIMUM_24H_VOLUME_USD = 5_000_000;
const COINGECKO_MIN_REQUEST_INTERVAL_MS = 2_000;
const COINGECKO_MAX_RETRIES = 3;
const COINGECKO_MAX_RETRY_DELAY_MS = 30_000;
const STABLECOIN_SYMBOLS = new Set([
  "USDT", "USDC", "USDE", "USDS", "DAI", "USDS", "FDUSD", "USDD", "TUSD", "USDP",
  "PYUSD", "USD1", "USD0", "USDY", "FRAX", "LUSD", "GUSD", "BUSD", "USTC", "USDX",
  "USDC.E", "USDT.E", "USDBC", "USDB", "SUSD", "CRVUSD", "GHO", "EURC", "EURS",
  "EURT", "XAUT", "PAXG",
]);
let coinGeckoRequestQueue = Promise.resolve();
let lastCoinGeckoRequestAt = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizedName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function numericValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function exactSearchMatch(
  searchResults: CoinGeckoSearchCoin[],
  query: string,
): CoinGeckoSearchCoin {
  const exactNames = searchResults.filter((coin) => normalizedName(coin.name) === normalizedName(query));
  if (exactNames.length === 1) return exactNames[0]!;
  if (exactNames.length > 1) {
    throw new Error(`Для «${query}» найдено несколько монет с одинаковым названием. Уточните тикер.`);
  }

  const ticker = query.replace(/^\$/, "").toLocaleUpperCase("en-US");
  const exactSymbols = searchResults.filter(
    (coin) => coin.symbol.toLocaleUpperCase("en-US") === ticker,
  );
  if (exactSymbols.length === 1) return exactSymbols[0]!;

  const ranked = exactSymbols
    .filter((coin) => Number.isFinite(coin.market_cap_rank))
    .sort((left, right) => left.market_cap_rank! - right.market_cap_rank!);
  const top = ranked[0];
  const next = ranked[1];
  if (
    top
    && top.market_cap_rank! <= 10
    && (!next || next.market_cap_rank! > top.market_cap_rank! * 5)
  ) {
    return top;
  }

  if (exactSymbols.length > 1) {
    const candidates = exactSymbols.slice(0, 4).map((coin) => `${coin.name} (${coin.symbol.toUpperCase()})`);
    throw new Error(
      `Тикер ${ticker} неоднозначен: ${candidates.join(", ")}. Отправьте точное название монеты.`,
    );
  }

  throw new Error(
    `CoinGecko не нашёл монету «${query}». Отправьте точный тикер или название, например HYPE или Bitcoin.`,
  );
}

async function requestJson<T>(
  url: string,
  fetcher: typeof fetch,
  provider: "CoinGecko" | "Hyperliquid",
  init?: RequestInit,
): Promise<T> {
  const cacheKey = `${provider}:${init?.method ?? "GET"}:${url}`;
  const canCache = fetcher === globalThis.fetch && !init?.body;
  const coinGeckoDemoApiKey = provider === "CoinGecko"
    ? process.env.COINGECKO_DEMO_API_KEY?.trim()
    : undefined;
  if (canCache) {
    const cached = jsonCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  }

  const performRequest = async (): Promise<Response> => {
    try {
      return await fetcher(url, {
        ...init,
        headers: (() => {
          const headers = new Headers(init?.headers);
          headers.set("accept", "application/json");
          if (provider === "CoinGecko") {
            headers.set("user-agent", "CryptoMarketDataBot/1.0");
            if (coinGeckoDemoApiKey) {
              headers.set("x-cg-demo-api-key", coinGeckoDemoApiKey);
            }
          }
          return headers;
        })(),
        signal: init?.signal ?? AbortSignal.timeout(12_000),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "network error";
      throw new Error(`${provider} не ответил: ${detail}`);
    }
  };
  const requestCoinGecko = async (): Promise<Response> => {
    const previous = coinGeckoRequestQueue;
    let releaseQueue: () => void = () => {};
    coinGeckoRequestQueue = new Promise<void>((resolve) => {
      releaseQueue = resolve;
    });
    await previous;
    try {
      const waitMs = Math.max(
        0,
        COINGECKO_MIN_REQUEST_INTERVAL_MS - (Date.now() - lastCoinGeckoRequestAt),
      );
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      lastCoinGeckoRequestAt = Date.now();
      return await performRequest();
    } finally {
      releaseQueue();
    }
  };
  const retryDelayMs = (response: Response, retryNumber: number): number => {
    const retryAfter = response.headers.get("retry-after");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
      const retryAt = Date.parse(retryAfter);
      if (Number.isFinite(retryAt)) return Math.max(0, retryAt - Date.now());
    }
    return [1_500, 3_000, 6_000][Math.min(retryNumber - 1, 2)]!;
  };

  let response: Response;
  for (let retryNumber = 0; ; retryNumber += 1) {
    response = provider === "CoinGecko" && fetcher === globalThis.fetch
      ? await requestCoinGecko()
      : await performRequest();
    const canRetry = provider === "CoinGecko"
      && (response.status === 429 || response.status >= 500)
      && retryNumber < COINGECKO_MAX_RETRIES;
    if (!canRetry) break;

    const waitMs = retryDelayMs(response, retryNumber + 1);
    if (response.body) await response.body.cancel().catch(() => {});
    if (waitMs > COINGECKO_MAX_RETRY_DELAY_MS) {
      throw new Error(
        `CoinGecko ограничил частоту запросов (HTTP ${response.status}). Подождите ${Math.ceil(waitMs / 1_000)} секунд и нажмите «Продолжить».`,
      );
    }
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  if (!response.ok) {
    if (provider === "CoinGecko" && response.status === 429) {
      throw new Error(
        "CoinGecko продолжает ограничивать частоту запросов после автоматических повторов. Подождите минуту и нажмите «Продолжить».",
      );
    }
    if (provider === "CoinGecko" && response.status === 401) {
      throw new Error(
        "CoinGecko отклонил API-ключ. Проверьте COINGECKO_DEMO_API_KEY в Replit Secrets.",
      );
    }
    if (provider === "CoinGecko" && response.status === 403) {
      throw new Error(
        "CoinGecko отклонил запрос (HTTP 403). Проверьте доступ к API из среды проекта; для Demo API добавьте COINGECKO_DEMO_API_KEY в Replit Secrets.",
      );
    }
    throw new Error(`${provider} вернул HTTP ${response.status}. Повторите попытку позже.`);
  }

  let value: T;
  try {
    value = await response.json() as T;
  } catch {
    throw new Error(`${provider} вернул ответ в неизвестном формате.`);
  }

  if (canCache) {
    jsonCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  }
  return value;
}

function parsePricePoints(
  value: unknown,
  coinName: string,
): PricePoint[] {
  if (!Array.isArray(value)) {
    throw new Error(`CoinGecko не вернул историю цены для ${coinName}.`);
  }
  const points = value
    .filter((item): item is [number, number] => (
      Array.isArray(item)
      && item.length >= 2
      && Number.isFinite(Number(item[0]))
      && Number.isFinite(Number(item[1]))
      && Number(item[1]) > 0
    ))
    .map(([timestamp, priceUsd]) => ({
      timestamp: Number(timestamp),
      priceUsd: Number(priceUsd),
    }))
    .sort((left, right) => left.timestamp - right.timestamp);

  if (points.length < 7) {
    throw new Error(`Для ${coinName} недостаточно точек цены за неделю.`);
  }
  if (points.at(-1)!.timestamp - points[0]!.timestamp < MIN_SEVEN_DAY_SPAN_MS) {
    throw new Error(`Для ${coinName} пока нет полной семидневной истории цены.`);
  }
  return points;
}

function samplePricePoints(points: PricePoint[]): CoinOverviewMarketData["priceSamples"] {
  const first = points[0]!;
  const last = points.at(-1)!;
  const samples: PricePoint[] = [];
  let cursor = 0;

  for (let index = 0; index < 7; index += 1) {
    const target = first.timestamp + ((last.timestamp - first.timestamp) * index) / 6;
    while (
      cursor + 1 < points.length
      && Math.abs(points[cursor + 1]!.timestamp - target) <= Math.abs(points[cursor]!.timestamp - target)
    ) {
      cursor += 1;
    }
    samples.push(points[cursor]!);
  }

  return samples.map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(point.timestamp)),
  }));
}

async function getHyperliquidOpenInterestUsd(
  symbol: string,
  fetcher: typeof fetch,
): Promise<number | null> {
  const response = await requestJson<HyperliquidMetaResponse>(
    HYPERLIQUID_INFO_API,
    fetcher,
    "Hyperliquid",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "metaAndAssetCtxs" }),
    },
  );
  if (!Array.isArray(response) || !isRecord(response[0]) || !Array.isArray(response[1])) return null;
  const universe = Array.isArray(response[0].universe) ? response[0].universe : [];
  const index = universe.findIndex((asset) => (
    isRecord(asset)
    && typeof asset.name === "string"
    && asset.name.toLocaleUpperCase("en-US") === symbol.toLocaleUpperCase("en-US")
  ));
  if (index < 0) return null;

  const context = response[1][index];
  if (!isRecord(context)) return null;
  const openInterest = numericValue(context.openInterest);
  const markPrice = numericValue(context.markPx);
  if (openInterest === null || markPrice === null || openInterest <= 0 || markPrice <= 0) return null;
  return openInterest * markPrice;
}

export async function resolveCoinOverviewMarketData(
  topicInput: string,
  fetcher: typeof fetch = globalThis.fetch,
  selectedCoinId?: string,
): Promise<CoinOverviewMarketData> {
  const query = topicInput.trim().replace(/^\$/, "").replace(/\s+/g, " ");
  if (!query) throw new Error("Укажите тикер или точное название монеты.");
  if (query.length > 80) throw new Error("Сократите название монеты до 80 символов.");

  let selectedCoin: CoinGeckoSearchCoin | undefined;
  if (selectedCoinId?.trim()) {
    const coinId = selectedCoinId.trim();
    if (!/^[a-z0-9-]{1,100}$/iu.test(coinId)) {
      throw new Error("Выбранная монета имеет недопустимый идентификатор CoinGecko.");
    }
    selectedCoin = {
      id: coinId,
      name: query,
      symbol: query,
      market_cap_rank: null,
    };
  } else {
    const searchUrl = `${COINGECKO_API}/search?query=${encodeURIComponent(query)}`;
    const search = await requestJson<{ coins?: CoinGeckoSearchCoin[] }>(
      searchUrl,
      fetcher,
      "CoinGecko",
    );
    selectedCoin = exactSearchMatch(Array.isArray(search.coins) ? search.coins : [], query);
  }

  const coinIds = [...new Set([selectedCoin.id, "bitcoin", "ethereum"])];
  const marketsUrl = `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coinIds.join(","))}&price_change_percentage=7d`;
  const chartUrl = `${COINGECKO_API}/coins/${encodeURIComponent(selectedCoin.id)}/market_chart?vs_currency=usd&days=7`;
  const [marketRows, chartResponse] = await Promise.all([
    requestJson<CoinGeckoMarket[]>(marketsUrl, fetcher, "CoinGecko"),
    requestJson<CoinGeckoChartResponse>(chartUrl, fetcher, "CoinGecko"),
  ]);
  if (!Array.isArray(marketRows)) {
    throw new Error("CoinGecko не вернул текущие рыночные данные.");
  }

  const marketById = new Map(marketRows.map((market) => [market.id, market]));
  const market = marketById.get(selectedCoin.id);
  const bitcoinMarket = marketById.get("bitcoin");
  const ethereumMarket = marketById.get("ethereum");
  if (!market || !bitcoinMarket || !ethereumMarket) {
    throw new Error(`CoinGecko не вернул цену ${query} или одного из двух рыночных ориентиров.`);
  }

  const pricePoints = parsePricePoints(chartResponse?.prices, market.name);
  const currentPriceUsd = numericValue(market.current_price);
  const volumeUsd24h = numericValue(market.total_volume);
  const bitcoinChangePercent7d = numericValue(bitcoinMarket.price_change_percentage_7d_in_currency);
  const ethereumChangePercent7d = numericValue(ethereumMarket.price_change_percentage_7d_in_currency);
  if (currentPriceUsd === null || currentPriceUsd <= 0) {
    throw new Error(`CoinGecko не вернул актуальную цену ${market.symbol.toUpperCase()}.`);
  }
  if (volumeUsd24h === null || volumeUsd24h <= 0) {
    throw new Error(`CoinGecko не вернул суточный торговый оборот ${market.symbol.toUpperCase()}.`);
  }
  if (bitcoinChangePercent7d === null || ethereumChangePercent7d === null) {
    throw new Error("CoinGecko не вернул недельную динамику Bitcoin и Ethereum для сравнения.");
  }

  let hyperliquidOpenInterestUsd: number | null = null;
  try {
    hyperliquidOpenInterestUsd = await getHyperliquidOpenInterestUsd(coin.symbol, fetcher);
  } catch (error) {
    console.warn(
      `[coin-overview] Hyperliquid open interest unavailable for ${coin.symbol}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const firstPoint = pricePoints[0]!;
  const lastPoint = pricePoints.at(-1)!;
  const dataAsOf = market.last_updated && Number.isFinite(Date.parse(market.last_updated))
    ? market.last_updated
    : new Date(lastPoint.timestamp).toISOString();
  const retrievedAt = new Date().toISOString();
  const activity: CoinOverviewActivity = hyperliquidOpenInterestUsd
    ? {
        kind: "open_interest",
        valueUsd: hyperliquidOpenInterestUsd,
        sourceLabel: "Hyperliquid",
        sourceUrl: "https://hyperliquid.xyz",
      }
    : {
        kind: "trading_volume",
        valueUsd: volumeUsd24h,
        sourceLabel: "CoinGecko",
        sourceUrl: `https://www.coingecko.com/en/coins/${selectedCoin.id}`,
      };
  const changePercent = ((lastPoint.priceUsd / firstPoint.priceUsd) - 1) * 100;
  const rank = numericValue(market.market_cap_rank) ?? numericValue(selectedCoin.market_cap_rank);
  const marketCapUsd = numericValue(market.market_cap);

  return {
    coin: {
      id: selectedCoin.id,
      name: market.name,
      symbol: market.symbol.toLocaleUpperCase("en-US"),
      marketCapRank: rank,
      sourceUrl: `https://www.coingecko.com/en/coins/${selectedCoin.id}`,
    },
    currency: "USD",
    periodDays: 7,
    currentPriceUsd,
    periodStartPriceUsd: firstPoint.priceUsd,
    changePercent7d: changePercent,
    lowPriceUsd7d: Math.min(...pricePoints.map((point) => point.priceUsd)),
    highPriceUsd7d: Math.max(...pricePoints.map((point) => point.priceUsd)),
    priceSamples: samplePricePoints(pricePoints),
    activity,
    benchmarks: [
      {
        id: "bitcoin",
        name: "Bitcoin",
        symbol: "BTC",
        changePercent7d: bitcoinChangePercent7d,
      },
      {
        id: "ethereum",
        name: "Ethereum",
        symbol: "ETH",
        changePercent7d: ethereumChangePercent7d,
      },
    ],
    hypothetical100Usd: 100 * currentPriceUsd / firstPoint.priceUsd,
    marketCapUsd,
    dataAsOf,
    retrievedAt,
  };
}

export function buildCoinOverviewStory(
  data: CoinOverviewMarketData,
): CoinOverviewStoryScene[] {
  const price = (value: number) => new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: value >= 1_000 ? 0 : 2,
    maximumFractionDigits: value >= 1_000 ? 0 : value >= 1 ? 2 : 6,
  }).format(value);
  const percent = (value: number) => {
    const direction = value > 0 ? "плюс" : value < 0 ? "минус" : "около нуля";
    const amount = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.abs(value));
    return value === 0 ? "около нуля процентов" : `${direction} ${amount} процента`;
  };
  const compactDollars = (value: number) => (
    `${new Intl.NumberFormat("ru-RU", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)} долларов`
  );
  const change = percent(data.changePercent7d);
  const activityVoice = data.activity.kind === "open_interest"
    ? `Открытый интерес на Hyperliquid — ${compactDollars(data.activity.valueUsd)}. Это открытые позиции одной биржи, не всего рынка и не показатель спотового спроса.`
    : `Оборот за сутки по CoinGecko — ${compactDollars(data.activity.valueUsd)}. Это объём сделок, а не чистый приток и не объяснение движения цены.`;
  const asOf = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(data.retrievedAt));

  return [
    {
      key: "identity",
      title: `${data.coin.symbol} В ФОКУСЕ`,
      subtitle: `${price(data.currentPriceUsd)} $ · ${change} за неделю`,
      voiceText: `Привет, друзья! Что показала ${data.coin.name} (${data.coin.symbol}) за эту неделю? Сейчас цена ${price(data.currentPriceUsd)} долларов, изменение за семь дней — ${change}. Давайте пройдём этот период по шагам: посмотрим на путь цены, сравним с биткоином и эфиром, а в конце посчитаем, что стало бы с условными $100.`,
      visualHint: "Монета, тикер, актуальная цена и недельное изменение.",
      visualAction: "Медленно раскройте медальон монеты и акцентируйте процент изменения.",
    },
    {
      key: "price_history",
      title: "ЦЕНА ЗА 7 ДНЕЙ",
      subtitle: `${price(data.lowPriceUsd7d)} — ${price(data.highPriceUsd7d)} $ · 7 снимков`,
      voiceText: `Теперь смотрим на саму траекторию: за неделю цена побывала в диапазоне от ${price(data.lowPriceUsd7d)} до ${price(data.highPriceUsd7d)} долларов. Семь точек на графике — это равномерные снимки периода, чтобы не путать один удачный момент с полной картиной.`,
      visualHint: "Ровно семь точек недельной цены, с подписью минимума и максимума.",
      visualAction: "Постройте минималистичный недельный график из семи точек.",
    },
    {
      key: "activity",
      title: data.activity.kind === "open_interest" ? "ОТКРЫТЫЙ ИНТЕРЕС" : "ОБОРОТ ЗА СУТКИ",
      subtitle: `${data.activity.sourceLabel} · ${data.activity.kind === "open_interest" ? "одна биржа" : "24 часа"}`,
      voiceText: `А теперь — показатель активности, но с важной оговоркой. ${activityVoice}`,
      visualHint: "Открытый интерес на одной бирже или суточный оборот — с явной подписью источника.",
      visualAction: "Покажите один крупный проверенный показатель и подпишите его источник.",
    },
    {
      key: "benchmarks",
      title: "СРАВНЕНИЕ С РЫНКОМ",
      subtitle: `BTC ${percent(data.benchmarks[0].changePercent7d)} · ETH ${percent(data.benchmarks[1].changePercent7d)}`,
      voiceText: `Чтобы понять масштаб движения, сравним тот же семидневный отрезок: Bitcoin изменился на ${percent(data.benchmarks[0].changePercent7d)}, а Ethereum — на ${percent(data.benchmarks[1].changePercent7d)}. Так мы видим рыночный фон, но это контекст, а не доказательство причины движения.`,
      visualHint: "Сопоставьте недельное изменение монеты с Bitcoin и Ethereum на одной шкале.",
      visualAction: "Анимируйте три сравнительные полосы относительно нулевой линии.",
    },
    {
      key: "hypothetical",
      title: "УСЛОВНЫЕ $100",
      subtitle: `$100 → ${price(data.hypothetical100Usd)} $ · без комиссий`,
      voiceText: `Переведём эту динамику в понятный пример: условные сто долларов в начале недели превратились бы примерно в ${price(data.hypothetical100Usd)} долларов сейчас — до комиссий, налогов и проскальзывания. Это расчёт задним числом, не прогноз и не обещание результата.`,
      visualHint: "Рассчитайте результат условных 100 долларов только по фактическому изменению цены.",
      visualAction: "Соберите сумму из монет и покажите итог без обещания будущей доходности.",
    },
    {
      key: "risk_sources",
      title: "РИСКИ И ИСТОЧНИКИ",
      subtitle: `Получено ${asOf} UTC · CoinGecko${data.activity.kind === "open_interest" ? " + Hyperliquid" : ""}`,
      voiceText: `И финальная важная мысль: криптоактивы волатильны, цена может резко упасть, а прошлая динамика не гарантирует будущего результата. Цена и недельная история — CoinGecko${data.activity.kind === "open_interest" ? ", открытый интерес — Hyperliquid" : ""}. Это образовательный обзор, не инвестиционная рекомендация.`,
      visualHint: "Завершите коротким риском, временем получения данных и названиями источников.",
      visualAction: "Перейдите к спокойной светлой карточке с риском, источниками и отказом от рекомендации.",
    },
  ];
}

function findEntryZone(
  points: PricePoint[],
  currentPriceUsd: number,
): CoinMarketLeader7d["entryZone"] {
  const swingSupports: number[] = [];
  const lookback = 6;
  for (let index = lookback; index < points.length - lookback; index += 1) {
    const price = points[index]!.priceUsd;
    const left = points.slice(index - lookback, index).map((point) => point.priceUsd);
    const right = points.slice(index + 1, index + lookback + 1).map((point) => point.priceUsd);
    const rebound = Math.min(Math.max(...left), Math.max(...right));
    const prominence = (rebound - price) / price;
    if (
      price <= Math.min(...left)
      && price <= Math.min(...right)
      && prominence >= 0.007
      && price <= currentPriceUsd * 1.005
    ) {
      swingSupports.push(price);
    }
  }

  const supportUsd = swingSupports.length
    ? Math.max(...swingSupports)
    : Math.min(...points.map((point) => point.priceUsd));
  return {
    supportUsd,
    lowUsd: supportUsd * 0.996,
    highUsd: supportUsd * 1.004,
    basis: swingSupports.length ? "local_support" : "weekly_low",
  };
}

async function resolveCoinMarketLeader7d(
  market: CoinGeckoMarket,
  marketCapRank: number,
  fetcher: typeof fetch,
): Promise<CoinMarketLeader7d> {
  const chartUrl = `${COINGECKO_API}/coins/${encodeURIComponent(market.id)}/market_chart?vs_currency=usd&days=7`;
  const chart = await requestJson<CoinGeckoChartResponse>(chartUrl, fetcher, "CoinGecko");
  const pricePoints = parsePricePoints(chart?.prices, market.name);
  const currentPriceUsd = numericValue(market.current_price);
  const volumeUsd24h = numericValue(market.total_volume);
  const changePercent7d = numericValue(market.price_change_percentage_7d_in_currency);
  if (currentPriceUsd === null || currentPriceUsd <= 0) {
    throw new Error(`CoinGecko не вернул актуальную цену ${market.symbol.toUpperCase()}.`);
  }
  if (volumeUsd24h === null || volumeUsd24h <= 0) {
    throw new Error(`CoinGecko не вернул суточный оборот ${market.symbol.toUpperCase()}.`);
  }
  if (changePercent7d === null) {
    throw new Error(`CoinGecko не вернул недельное изменение ${market.symbol.toUpperCase()}.`);
  }
  const rank = numericValue(market.market_cap_rank) ?? marketCapRank;
  return {
    coin: {
      id: market.id,
      name: market.name,
      symbol: market.symbol.toLocaleUpperCase("en-US"),
      marketCapRank: rank,
      sourceUrl: `https://www.coingecko.com/en/coins/${market.id}`,
    },
    currentPriceUsd,
    changePercent7d,
    lowPriceUsd7d: Math.min(...pricePoints.map((point) => point.priceUsd)),
    highPriceUsd7d: Math.max(...pricePoints.map((point) => point.priceUsd)),
    volumeUsd24h,
    priceSamples: samplePricePoints(pricePoints),
    entryZone: findEntryZone(pricePoints, currentPriceUsd),
  };
}

type EligibleCoinLeader7dMarket = {
  market: CoinGeckoMarket;
  rank: number;
  changePercent7d: number;
};

async function resolveEligibleCoinLeader7dMarkets(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<EligibleCoinLeader7dMarket[]> {
  const marketsUrl = `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=7d`;
  const rows = await requestJson<CoinGeckoMarket[]>(marketsUrl, fetcher, "CoinGecko");
  if (!Array.isArray(rows)) {
    throw new Error("CoinGecko не вернул список криптовалют для недельного обзора.");
  }
  return rows
    .map((market, index) => ({
      market,
      rank: numericValue(market.market_cap_rank) ?? index + 1,
      volumeUsd24h: numericValue(market.total_volume),
      marketCapUsd: numericValue(market.market_cap),
      changePercent7d: numericValue(market.price_change_percentage_7d_in_currency),
    }))
    .filter(({ market, rank, volumeUsd24h, marketCapUsd, changePercent7d }) => (
      rank <= 100
      && !STABLECOIN_SYMBOLS.has(market.symbol.toLocaleUpperCase("en-US"))
      && volumeUsd24h !== null
      && volumeUsd24h >= MARKET_LEADERS_MINIMUM_24H_VOLUME_USD
      && marketCapUsd !== null
      && marketCapUsd > 0
      && changePercent7d !== null
    ))
    .sort((left, right) => right.changePercent7d! - left.changePercent7d!);
}

export async function resolveCoinLeaders7dTopGainers(
  limit = 10,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<CoinLeaders7dGainerOption[]> {
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error("Количество недельных лидеров должно быть положительным числом.");
  }
  const eligible = await resolveEligibleCoinLeader7dMarkets(fetcher);
  return eligible
    .filter(({ changePercent7d }) => changePercent7d > 0)
    .slice(0, Math.min(100, Math.trunc(limit)))
    .map(({ market, rank, changePercent7d }, index) => ({
      coin: {
        id: market.id,
        name: market.name,
        symbol: market.symbol.toLocaleUpperCase("en-US"),
        marketCapRank: rank,
        sourceUrl: `https://www.coingecko.com/en/coins/${market.id}`,
      },
      changePercent7d,
    }));
}

export async function resolveCoinLeaders7dMarketData(
  fetcher: typeof fetch = globalThis.fetch,
): Promise<CoinLeaders7dMarketData> {
  const eligible = await resolveEligibleCoinLeader7dMarkets(fetcher);
  if (eligible.length < 2) {
    throw new Error("CoinGecko вернул меньше двух ликвидных монет с полной недельной динамикой.");
  }

  const top = eligible[0]!;
  const bottom = eligible.at(-1)!;
  const gainer = await resolveCoinMarketLeader7d(top.market, top.rank, fetcher);
  const decliner = await resolveCoinMarketLeader7d(bottom.market, bottom.rank, fetcher);
  const latestTimestamp = Math.max(
    gainer.priceSamples.at(-1)!.timestamp,
    decliner.priceSamples.at(-1)!.timestamp,
  );
  const sourceMarketUpdates = [top.market.last_updated, bottom.market.last_updated]
    .map((value) => value && Date.parse(value))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const dataAsOf = sourceMarketUpdates.length
    ? new Date(Math.min(...sourceMarketUpdates)).toISOString()
    : new Date(latestTimestamp).toISOString();

  return {
    leaders: { gainer, decliner },
    screenedCoinCount: eligible.length,
    retrievedAt: new Date().toISOString(),
    dataAsOf,
    sourceLabel: "CoinGecko",
    sourceUrl: "https://www.coingecko.com/",
  };
}

export const COIN_LEADERS_7D_SCENE_DURATIONS_SECONDS = [
  15,
  18,
  16,
  18,
  16,
  17,
] as const;

export function buildCoinLeaders7dStory(
  data: CoinLeaders7dMarketData,
): CoinLeaders7dStoryScene[] {
  const price = (value: number) => new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: value >= 1_000 ? 0 : 2,
    maximumFractionDigits: value >= 1_000 ? 0 : value >= 1 ? 2 : 6,
  }).format(value);
  const percent = (value: number) => {
    const direction = value > 0 ? "+" : value < 0 ? "минус " : "";
    const amount = new Intl.NumberFormat("ru-RU", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(Math.abs(value));
    return `${direction}${amount}%`;
  };
  const compactDollars = (value: number) => (
    `${new Intl.NumberFormat("ru-RU", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value)} долларов`
  );
  const { gainer, decliner } = data.leaders;
  const sourceLabel = data.sourceLabel ?? "CoinGecko";
  const asOf = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(data.retrievedAt));
  const zoneBasis = (coin: CoinMarketLeader7d) => coin.entryZone.basis === "local_support"
    ? "локальной поддержки"
    : "недельного минимума";

  return [
    {
      key: "market_summary",
      title: "РЫНОК ЗА 7 ДНЕЙ",
      subtitle: "Топ-100 по капитализации · стейблкоины исключены",
      voiceText: `Привет, друзья! Давайте разберём неделю без лишнего шума. Кто за неделю вырос сильнее всех, а кто упал? В топ-100 ${sourceLabel} это ${gainer.coin.name} и ${decliner.coin.name}. Стейблкоины и монеты с оборотом ниже пяти миллионов долларов исключены — перед нами итоги недели, не прогноз.`,
      visualHint: "Покажите лидера роста и лидера падения на общей недельной шкале.",
      visualAction: "Разведите две карточки по разные стороны нулевой линии и подсветите проценты.",
    },
    {
      key: "gainer",
      title: gainer.changePercent7d > 0 ? "ЛИДЕР РОСТА" : "ЛУЧШИЙ РЕЗУЛЬТАТ",
      subtitle: `${gainer.coin.name} · ${percent(gainer.changePercent7d)} за неделю`,
      voiceText: `Начнём с лидера роста — ${gainer.coin.name} (${gainer.coin.symbol}): ${percent(gainer.changePercent7d)} за неделю. Сейчас цена ${price(gainer.currentPriceUsd)} долларов, суточный оборот — ${compactDollars(gainer.volumeUsd24h)}. Это помогает описать масштаб и активность движения, но данные не доказывают его причину.`,
      visualHint: "Покажите монету, недельный процент, актуальную цену и суточный оборот.",
      visualAction: "Анимируйте рост на коротком недельном графике без прогнозной стрелки.",
    },
    {
      key: "gainer_entry",
      title: "ЗОНА НАБЛЮДЕНИЯ",
      subtitle: `${gainer.coin.symbol} · технический уровень, не сигнал`,
      voiceText: `Рост сам по себе не обещает продолжения. Поэтому отметим только зону наблюдения для ${gainer.coin.symbol}: ${price(gainer.entryZone.lowUsd)}–${price(gainer.entryZone.highUsd)} долларов, у ${zoneBasis(gainer)}. Это не сигнал покупки: уровень может не удержаться.`,
      visualHint: "Отобразите недельный ценовой график лидера роста и условную зону наблюдения.",
      visualAction: "Выделите узкую горизонтальную область у локальной поддержки и подпишите её как учебный ориентир.",
    },
    {
      key: "decliner",
      title: decliner.changePercent7d < 0 ? "ЛИДЕР ПАДЕНИЯ" : "САМАЯ СЛАБАЯ ДИНАМИКА",
      subtitle: `${decliner.coin.name} · ${percent(decliner.changePercent7d)} за неделю`,
      voiceText: `Теперь другая сторона недели — ${decliner.coin.name} (${decliner.coin.symbol}): ${percent(decliner.changePercent7d)}. Цена сейчас ${price(decliner.currentPriceUsd)} долларов, оборот — ${compactDollars(decliner.volumeUsd24h)}. Но падение само по себе не доказывает недооценённость и не обещает скорого разворота.`,
      visualHint: "Покажите недельную динамику лидера падения, цену и суточный оборот.",
      visualAction: "Постройте нисходящий график и не добавляйте обещание разворота.",
    },
    {
      key: "decliner_entry",
      title: "ЗОНА НАБЛЮДЕНИЯ",
      subtitle: `${decliner.coin.symbol} · дождаться стабилизации`,
      voiceText: `И здесь тот же принцип осторожности: у ${decliner.coin.symbol} зона ${price(decliner.entryZone.lowUsd)}–${price(decliner.entryZone.highUsd)} долларов у ${zoneBasis(decliner)}. Это только зона для наблюдения, не точка входа; цена может падать дальше.`,
      visualHint: "Покажите технический уровень для наблюдения у локального минимума падающей монеты.",
      visualAction: "Отобразите зону с пометкой «не сигнал» и сценарную отметку возможного пробоя вниз.",
    },
    {
      key: "risk_sources",
      title: "РИСКИ И ИСТОЧНИКИ",
      subtitle: `${data.screenedCoinCount} активов · ${sourceLabel} · получено ${asOf} UTC`,
      voiceText: `Финал: криптоактивы рискованны, можно потерять всю сумму. Оба уровня рассчитаны по прошлым ценам и не учитывают вашу ситуацию, а недельный лидер не становится прогнозом только потому, что уже вырос. Это образовательный обзор, не инвестиционная рекомендация. Источник данных — ${sourceLabel}, получено ${asOf} UTC.`,
      visualHint: "Завершите рисками, методикой отбора, временем получения данных и названием источника.",
      visualAction: "Покажите спокойную контрастную карточку с источником и крупным предупреждением.",
    },
  ];
}

export function refreshCoinLeaders7dNarration<
  TPlan extends {
    script: string;
    beats: Array<{ voiceText?: string }>;
    marketLeaders7dData?: CoinLeaders7dMarketData;
  },
>(plan: TPlan): TPlan {
  if (!plan.marketLeaders7dData) return plan;
  const story = buildCoinLeaders7dStory(plan.marketLeaders7dData);
  if (plan.beats.length !== story.length) return plan;

  const beats = plan.beats.map((beat, index) => ({
    ...beat,
    voiceText: story[index]!.voiceText,
  }));
  return {
    ...plan,
    script: story.map((scene) => scene.voiceText).join("\n\n"),
    beats,
  };
}

export function clearCoinOverviewMarketDataCacheForTests(): void {
  jsonCache.clear();
}