export type WhaleRadarV2Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd?: number | null;
};

export type WhaleRadarV2Event = {
  eventTimestamp: string;
  blockchain: string;
  symbol: string;
  action: "BUY" | "SELL";
  amount: number;
  amountUsd: number;
  priceUsd: number | null;
  walletLabel: string | null;
  walletType: string | null;
  dex: string | null;
  transactionHash: string;
  marketContext: {
    timeframe: string;
    candles: WhaleRadarV2Candle[];
  } | null;
  rawData: unknown;
};

export type WhaleRadarV2RelatedEvent = {
  eventTimestamp: string;
  symbol: string;
  action: "BUY" | "SELL";
  amountUsd: number;
  transactionHash: string;
};

export type WhaleRadarV2Metrics = {
  inputTokenSymbol: string | null;
  inputTokenAmount: number | null;
  outputTokenSymbol: string | null;
  outputTokenAmount: number | null;
  latestCandle: WhaleRadarV2Candle | null;
  priceChangePercent: number | null;
  postTradeCandles: WhaleRadarV2Candle[];
  walletAddress: string | null;
};

export type WhaleRadarV2Story = {
  title: string;
  narration: string;
  paragraphs: string[];
  metrics: WhaleRadarV2Metrics;
};

type RawNansenTrade = Record<string, unknown>;

function asRawTrade(value: unknown): RawNansenTrade {
  return value && typeof value === "object" ? value as RawNansenTrade : {};
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function deriveWhaleRadarV2Metrics(event: WhaleRadarV2Event): WhaleRadarV2Metrics {
  const raw = asRawTrade(event.rawData);
  const eventTime = Date.parse(event.eventTimestamp);
  const candles = [...(event.marketContext?.candles ?? [])]
    .filter((candle) => Number.isFinite(Date.parse(candle.timestamp)))
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const postTradeCandles = Number.isFinite(eventTime)
    ? candles.filter((candle) => Date.parse(candle.timestamp) > eventTime)
    : [];
  const latestCandle = postTradeCandles.at(-1) ?? null;
  const priceChangePercent = event.priceUsd && latestCandle
    ? ((latestCandle.close / event.priceUsd) - 1) * 100
    : null;

  return {
    inputTokenSymbol: nonEmptyString(raw.token_sold_symbol),
    inputTokenAmount: finiteNumber(raw.token_sold_amount),
    outputTokenSymbol: nonEmptyString(raw.token_bought_symbol),
    outputTokenAmount: finiteNumber(raw.token_bought_amount),
    latestCandle,
    priceChangePercent,
    postTradeCandles,
    walletAddress: nonEmptyString(raw.trader_address),
  };
}

function formatMoney(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits }).format(value);
}

function formatDecimal(value: number, maximumFractionDigits = 4): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits }).format(value);
}

function formatUtcTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid on-chain timestamp: ${value}`);
  return `${new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date)} UTC`;
}

function formatRussianDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid on-chain timestamp: ${value}`);
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(date);
}

function formatShortHash(hash: string): string {
  if (hash.length < 22) return hash;
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

function formatMove(value: number | null): string {
  if (value === null) return "нет подтверждённой последующей цены";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${formatDecimal(Math.abs(value), 2)}%`;
}

function describeRelatedEvents(events: WhaleRadarV2RelatedEvent[]): string {
  if (events.length === 0) {
    return "В сохранённой истории нет других подтверждённых операций этого кошелька для сравнения.";
  }

  return events.map((event) => {
    const verb = event.action === "BUY" ? "купил" : "продал";
    return `${formatUtcTime(event.eventTimestamp)} — ${verb} ${event.symbol} примерно на ${formatMoney(event.amountUsd)} долларов`;
  }).join("; ");
}

function describeElapsedMinutes(relatedEvents: WhaleRadarV2RelatedEvent[], event: WhaleRadarV2Event): string {
  const firstRelated = relatedEvents
    .map((item) => Date.parse(item.eventTimestamp))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)[0];
  const current = Date.parse(event.eventTimestamp);
  if (!firstRelated || !Number.isFinite(current) || current <= firstRelated) return "";
  const minutes = Math.round((current - firstRelated) / 60_000);
  return ` Последовательность от первого до последнего события заняла около ${minutes} минут.`;
}

export function buildWhaleRadarV2Story(
  event: WhaleRadarV2Event,
  relatedEvents: WhaleRadarV2RelatedEvent[],
): WhaleRadarV2Story {
  if (event.walletType !== "smart_money" || !event.walletLabel) {
    throw new Error("Whale Radar V2 requires a labelled Nansen Smart Money event.");
  }
  if (event.action !== "BUY" && event.action !== "SELL") {
    throw new Error("Whale Radar V2 only narrates confirmed BUY or SELL swaps.");
  }
  if (!event.transactionHash || !event.priceUsd || !event.marketContext?.candles.length) {
    throw new Error("Whale Radar V2 requires a transaction hash, execution price, and saved market candles.");
  }

  const metrics = deriveWhaleRadarV2Metrics(event);
  if (!metrics.outputTokenSymbol || !metrics.outputTokenAmount || !metrics.inputTokenSymbol || !metrics.inputTokenAmount) {
    throw new Error("The saved Nansen response is missing the swap's input or output token details.");
  }
  if (!metrics.latestCandle || metrics.priceChangePercent === null) {
    throw new Error("The saved market candles do not include an observation after this trade.");
  }

  const assetName = event.symbol === "ETH" ? "эфириум" : event.symbol;
  const tokenName = event.symbol === "ETH" ? "эфир" : event.symbol;
  const assetInstrumental = event.symbol === "ETH" ? "эфириумом" : event.symbol;
  const actionLabel = event.action === "BUY" ? "покупку" : "продажу";
  const priceMove = formatMove(metrics.priceChangePercent);
  const latestTime = formatUtcTime(metrics.latestCandle.timestamp);
  const relatedSummary = describeRelatedEvents(relatedEvents);
  const elapsedSummary = describeElapsedMinutes(relatedEvents, event);
  const tradeDate = formatRussianDate(event.eventTimestamp);
  const blockchainName = event.blockchain.toLowerCase() === "ethereum" ? "Ethereum" : event.blockchain;
  const dexDisclosure = event.dex
    ? `Площадка в сохранённой записи указана как ${event.dex}.`
    : "Название конкретной DEX-площадки в сохранённой записи не указано, поэтому мы не называем её наугад.";
  const walletAddress = metrics.walletAddress
    ? `${metrics.walletAddress.slice(0, 10)}…${metrics.walletAddress.slice(-6)}`
    : "адрес кошелька сохранён в транзакции";

  const paragraphs = [
    `Привет, друзья. Сегодня, ${tradeDate}, разбираем подтверждённую ${actionLabel} ${assetName === "эфириум" ? "эфириума" : assetName}. Это не прогноз: сначала проверим, что именно сделал кошелёк, а затем посмотрим на доступное движение цены после операции.`,
    `В ${formatUtcTime(event.eventTimestamp)} в сети ${blockchainName} кошелёк с меткой Nansen «${event.walletLabel}» обменял ${formatDecimal(metrics.inputTokenAmount, 5)} ${metrics.inputTokenSymbol} и получил ${formatDecimal(metrics.outputTokenAmount, 6)} ${metrics.outputTokenSymbol}. Оценка Nansen для сделки — около ${formatMoney(event.amountUsd)} долларов, расчётная цена — ${formatMoney(event.priceUsd, 2)} доллара за ${tokenName}. Nansen классифицирует событие как Smart Money ${event.action} через DEX. ${dexDisclosure} Хэш в ролике можно сверить независимо: ${formatShortHash(event.transactionHash)}. Адрес кошелька показан сокращённо: ${walletAddress}.`,
    `Важен и короткий контекст до этой операции. В сохранённой истории того же кошелька есть такие подтверждённые действия: ${relatedSummary}.${elapsedSummary} Это показывает активность одного помеченного кошелька, но не доказывает, что он набирает позицию или заранее знает направление рынка. Метка Nansen — это аналитическая подпись адреса, а не подтверждённая личность владельца.`,
    `Теперь график. Цена сделки составляла ${formatMoney(event.priceUsd, 2)} доллара за ${tokenName}. На последней сохранённой часовой свече с отметкой ${latestTime} цена закрытия — ${formatMoney(metrics.latestCandle.close, 2)} доллара. Изменение от цены сделки до этой отметки — ${priceMove}. На графике показаны только сохранённые часовые свечи после сделки. Данных за полные сутки и семь дней после этой операции пока нет, поэтому этих процентов здесь не будет.`,
    `И ещё одно важное различие: изменение рыночной цены не равно прибыли кошелька. У нас нет полного размера позиции, данных о комиссиях и всех последующих действиях. Мы показываем конкретный подтверждённый своп, его цену и доступные свечи — без выводов о заработке и без обещаний будущего роста.`,
    `Каждый день здесь разбираем подтверждённые движения Smart Money и показываем, что цена сделала после сделки. Подпишись на канал, чтобы не пропустить следующий обзор. Хочешь посмотреть, что сейчас происходит с ${assetInstrumental}, или купить другую криптовалюту — ссылка на биржу в шапке профиля канала.`,
  ];

  return {
    title: `Smart Money ${event.action}: ${event.symbol} — 6 октября`,
    narration: paragraphs.join("\n\n"),
    paragraphs,
    metrics,
  };
}

export function countWhaleRadarV2Words(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}
