const COINGECKO_API = "https://api.coingecko.com/api/v3";
const HYPERLIQUID_INFO_API = "https://api.hyperliquid.xyz/info";
const CACHE_TTL_MS = 45_000;
const MIN_SEVEN_DAY_SPAN_MS = 6 * 24 * 60 * 60 * 1_000;

export const COIN_OVERVIEW_SCENE_DURATIONS_SECONDS = [
  4.8,
  4.8,
  9.1,
  5.5,
  7.9,
  11.9,
] as const;

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

type CoinGeckoChartResponse = {
  prices?: unknown;
};

type HyperliquidMetaResponse = [
  { universe?: Array<{ name?: unknown }> },
  Array<{ openInterest?: unknown; markPx?: unknown }>,
];

const jsonCache = new Map<string, { expiresAt: number; value: unknown }>();

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
  if (canCache) {
    const cached = jsonCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  }

  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: init?.signal ?? AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "network error";
    throw new Error(`${provider} не ответил: ${detail}`);
  }

  if (!response.ok) {
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

function parsePricePoints(value: unknown, coinName: string): PricePoint[] {
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
): Promise<CoinOverviewMarketData> {
  const query = topicInput.trim().replace(/^\$/, "").replace(/\s+/g, " ");
  if (!query) throw new Error("Укажите тикер или точное название монеты.");
  if (query.length > 80) throw new Error("Сократите название монеты до 80 символов.");

  const searchUrl = `${COINGECKO_API}/search?query=${encodeURIComponent(query)}`;
  const search = await requestJson<{ coins?: CoinGeckoSearchCoin[] }>(
    searchUrl,
    fetcher,
    "CoinGecko",
  );
  const coin = exactSearchMatch(Array.isArray(search.coins) ? search.coins : [], query);

  const coinIds = [...new Set([coin.id, "bitcoin", "ethereum"])];
  const marketsUrl = `${COINGECKO_API}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(coinIds.join(","))}&price_change_percentage=7d`;
  const chartUrl = `${COINGECKO_API}/coins/${encodeURIComponent(coin.id)}/market_chart?vs_currency=usd&days=7`;
  const [marketRows, chartResponse] = await Promise.all([
    requestJson<CoinGeckoMarket[]>(marketsUrl, fetcher, "CoinGecko"),
    requestJson<CoinGeckoChartResponse>(chartUrl, fetcher, "CoinGecko"),
  ]);
  if (!Array.isArray(marketRows)) {
    throw new Error("CoinGecko не вернул текущие рыночные данные.");
  }

  const marketById = new Map(marketRows.map((market) => [market.id, market]));
  const market = marketById.get(coin.id);
  const bitcoinMarket = marketById.get("bitcoin");
  const ethereumMarket = marketById.get("ethereum");
  if (!market || !bitcoinMarket || !ethereumMarket) {
    throw new Error("CoinGecko не вернул цену монеты или одного из двух рыночных ориентиров.");
  }

  const pricePoints = parsePricePoints(chartResponse?.prices, coin.name);
  const currentPriceUsd = numericValue(market.current_price);
  const volumeUsd24h = numericValue(market.total_volume);
  const bitcoinChangePercent7d = numericValue(bitcoinMarket.price_change_percentage_7d_in_currency);
  const ethereumChangePercent7d = numericValue(ethereumMarket.price_change_percentage_7d_in_currency);
  if (currentPriceUsd === null || currentPriceUsd <= 0) {
    throw new Error(`CoinGecko не вернул актуальную цену ${coin.symbol.toUpperCase()}.`);
  }
  if (volumeUsd24h === null || volumeUsd24h <= 0) {
    throw new Error(`CoinGecko не вернул суточный торговый оборот ${coin.symbol.toUpperCase()}.`);
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
        sourceUrl: `https://www.coingecko.com/en/coins/${coin.id}`,
      };
  const changePercent = ((lastPoint.priceUsd / firstPoint.priceUsd) - 1) * 100;
  const rank = numericValue(coin.market_cap_rank);
  const marketCapUsd = numericValue(market.market_cap);

  return {
    coin: {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol.toLocaleUpperCase("en-US"),
      marketCapRank: rank,
      sourceUrl: `https://www.coingecko.com/en/coins/${coin.id}`,
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
      voiceText: `${data.coin.name}, тикер ${data.coin.symbol}: сейчас ${price(data.currentPriceUsd)} долларов. За семь дней изменение — ${change}. Это факт за период, не прогноз.`,
      visualHint: "Монета, тикер, актуальная цена и недельное изменение.",
      visualAction: "Медленно раскройте медальон монеты и акцентируйте процент изменения.",
    },
    {
      key: "price_history",
      title: "ЦЕНА ЗА 7 ДНЕЙ",
      subtitle: `${price(data.lowPriceUsd7d)} — ${price(data.highPriceUsd7d)} $ · 7 снимков`,
      voiceText: `За неделю цена проходила диапазон от ${price(data.lowPriceUsd7d)} до ${price(data.highPriceUsd7d)} долларов. На графике — семь равномерных снимков за этот период.`,
      visualHint: "Ровно семь точек недельной цены, с подписью минимума и максимума.",
      visualAction: "Постройте минималистичный недельный график из семи точек.",
    },
    {
      key: "activity",
      title: data.activity.kind === "open_interest" ? "ОТКРЫТЫЙ ИНТЕРЕС" : "ОБОРОТ ЗА СУТКИ",
      subtitle: `${data.activity.sourceLabel} · ${data.activity.kind === "open_interest" ? "одна биржа" : "24 часа"}`,
      voiceText: activityVoice,
      visualHint: "Открытый интерес на одной бирже или суточный оборот — с явной подписью источника.",
      visualAction: "Покажите один крупный проверенный показатель и подпишите его источник.",
    },
    {
      key: "benchmarks",
      title: "СРАВНЕНИЕ С РЫНКОМ",
      subtitle: `BTC ${percent(data.benchmarks[0].changePercent7d)} · ETH ${percent(data.benchmarks[1].changePercent7d)}`,
      voiceText: `За ту же неделю Bitcoin изменился на ${percent(data.benchmarks[0].changePercent7d)}, а Ethereum — на ${percent(data.benchmarks[1].changePercent7d)}. Это контекст, а не доказательство причины движения.`,
      visualHint: "Сопоставьте недельное изменение монеты с Bitcoin и Ethereum на одной шкале.",
      visualAction: "Анимируйте три сравнительные полосы относительно нулевой линии.",
    },
    {
      key: "hypothetical",
      title: "УСЛОВНЫЕ $100",
      subtitle: `$100 → ${price(data.hypothetical100Usd)} $ · без комиссий`,
      voiceText: `Условные сто долларов в начале недели превратились бы примерно в ${price(data.hypothetical100Usd)} долларов сейчас — до комиссий, налогов и проскальзывания. Это расчёт задним числом, не прогноз.`,
      visualHint: "Рассчитайте результат условных 100 долларов только по фактическому изменению цены.",
      visualAction: "Соберите сумму из монет и покажите итог без обещания будущей доходности.",
    },
    {
      key: "risk_sources",
      title: "РИСКИ И ИСТОЧНИКИ",
      subtitle: `Получено ${asOf} UTC · CoinGecko${data.activity.kind === "open_interest" ? " + Hyperliquid" : ""}`,
      voiceText: `Криптоактивы волатильны, цена может резко упасть. Прошлая динамика не гарантирует будущего результата. Источник цены — CoinGecko${data.activity.kind === "open_interest" ? ", открытого интереса — Hyperliquid" : ""}. Это образовательный обзор, не инвестиционная рекомендация.`,
      visualHint: "Завершите коротким риском, временем получения данных и названиями источников.",
      visualAction: "Перейдите к спокойной светлой карточке с риском, источниками и отказом от рекомендации.",
    },
  ];
}

export function clearCoinOverviewMarketDataCacheForTests(): void {
  jsonCache.clear();
}