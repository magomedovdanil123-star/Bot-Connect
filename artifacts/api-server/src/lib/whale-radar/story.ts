import type { WhaleEvent, WhaleStory } from "./types";

const CHAIN_NAMES: Record<string, string> = {
  ethereum: "Эфириум",
  solana: "Солана",
  base: "Бейс",
  arbitrum: "Арбитрум",
  bitcoin: "Биткоин",
  ton: "Тон",
};

type SpokenCoinForms = {
  nominative: string;
  accusative: string;
  genitive: string;
  instrumental: string;
  afterPo: string;
};

const SPOKEN_COIN_FORMS: Record<string, SpokenCoinForms> = {
  BTC: { nominative: "биткоин", accusative: "биткоин", genitive: "биткоина", instrumental: "биткоином", afterPo: "биткоину" },
  WBTC: { nominative: "биткоин", accusative: "биткоин", genitive: "биткоина", instrumental: "биткоином", afterPo: "биткоину" },
  ETH: { nominative: "эфириум", accusative: "эфир", genitive: "эфира", instrumental: "эфиром", afterPo: "эфиру" },
  WETH: { nominative: "эфириум", accusative: "эфир", genitive: "эфира", instrumental: "эфиром", afterPo: "эфиру" },
  SOL: { nominative: "солана", accusative: "солану", genitive: "соланы", instrumental: "соланой", afterPo: "солане" },
  TON: { nominative: "тонкоин", accusative: "тонкоин", genitive: "тонкоина", instrumental: "тонкоином", afterPo: "тонкоину" },
  BNB: { nominative: "бинанс коин", accusative: "бинанс коин", genitive: "бинанс коина", instrumental: "бинанс коином", afterPo: "бинанс коину" },
  XRP: { nominative: "рипл", accusative: "рипл", genitive: "рипла", instrumental: "риплом", afterPo: "риплу" },
  DOGE: { nominative: "доджкоин", accusative: "доджкоин", genitive: "доджкоина", instrumental: "доджкоином", afterPo: "доджкоину" },
  ADA: { nominative: "кардано", accusative: "кардано", genitive: "кардано", instrumental: "кардано", afterPo: "кардано" },
  TRX: { nominative: "трон", accusative: "трон", genitive: "трона", instrumental: "троном", afterPo: "трону" },
  AVAX: { nominative: "аваланш", accusative: "аваланш", genitive: "аваланша", instrumental: "аваланшем", afterPo: "аваланшу" },
  LINK: { nominative: "чейнлинк", accusative: "чейнлинк", genitive: "чейнлинка", instrumental: "чейнлинком", afterPo: "чейнлинку" },
  DOT: { nominative: "полкадот", accusative: "полкадот", genitive: "полкадота", instrumental: "полкадотом", afterPo: "полкадоту" },
  LTC: { nominative: "лайткоин", accusative: "лайткоин", genitive: "лайткоина", instrumental: "лайткоином", afterPo: "лайткоину" },
  MATIC: { nominative: "полигон", accusative: "полигон", genitive: "полигона", instrumental: "полигоном", afterPo: "полигону" },
  POL: { nominative: "полигон", accusative: "полигон", genitive: "полигона", instrumental: "полигоном", afterPo: "полигону" },
  UNI: { nominative: "юнисвап", accusative: "юнисвап", genitive: "юнисвапа", instrumental: "юнисвапом", afterPo: "юнисвапу" },
  ATOM: { nominative: "космос", accusative: "космос", genitive: "космоса", instrumental: "космосом", afterPo: "космосу" },
  NEAR: { nominative: "ниар", accusative: "ниар", genitive: "ниара", instrumental: "ниаром", afterPo: "ниару" },
  ETC: { nominative: "эфириум классик", accusative: "эфириум классик", genitive: "эфириума классик", instrumental: "эфириумом классик", afterPo: "эфириум классик" },
  USDT: { nominative: "тезер", accusative: "тезер", genitive: "тезера", instrumental: "тезером", afterPo: "тезеру" },
  USDC: { nominative: "юэсди си", accusative: "юэсди си", genitive: "юэсди си", instrumental: "юэсди си", afterPo: "юэсди си" },
};

function spokenCoinForms(symbol: string): SpokenCoinForms {
  const normalized = symbol.trim().toUpperCase();
  return SPOKEN_COIN_FORMS[normalized] ?? {
    nominative: symbol,
    accusative: symbol,
    genitive: symbol,
    instrumental: symbol,
    afterPo: symbol,
  };
}

export function whaleCoinLabel(symbol: string): string {
  const forms = SPOKEN_COIN_FORMS[symbol.trim().toUpperCase()];
  return forms ? forms.nominative.toLocaleUpperCase("ru-RU") : symbol;
}

export function whaleChainLabel(chain: string): string {
  return CHAIN_NAMES[chain.trim().toLowerCase()] ?? chain;
}

export type PostTradePerformance = {
  changePercent: number;
  elapsedHours: number;
  entryPriceUsd: number;
  latestPriceUsd: number;
  latestCandleTimestamp: string;
};

function candleDurationMs(timeframe: string): number {
  const match = /^(\d+)(m|h|d)$/iu.exec(timeframe.trim());
  if (!match) return 60 * 60 * 1_000;
  const multiplier = match[2]!.toLowerCase() === "m"
    ? 60 * 1_000
    : match[2]!.toLowerCase() === "h"
      ? 60 * 60 * 1_000
      : 24 * 60 * 60 * 1_000;
  return Number(match[1]) * multiplier;
}

export function getPostTradePerformance(event: WhaleEvent): PostTradePerformance | null {
  if (event.action === "TRANSFER" || !event.marketContext || !event.priceUsd || event.priceUsd <= 0) return null;
  const eventTime = new Date(event.timestamp).getTime();
  if (!Number.isFinite(eventTime)) return null;
  const intervalMs = candleDurationMs(event.marketContext.timeframe);
  const latestCandle = event.marketContext.candles
    .filter((candle) => {
      const candleStart = new Date(candle.timestamp).getTime();
      return Number.isFinite(candleStart) && candleStart + intervalMs > eventTime
        && Number.isFinite(candle.close) && candle.close > 0;
    })
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .at(-1);
  if (!latestCandle) return null;
  const closeTime = new Date(latestCandle.timestamp).getTime() + intervalMs;
  const elapsedHours = Math.max(1, Math.round((closeTime - eventTime) / (60 * 60 * 1_000)));
  const changePercent = ((latestCandle.close - event.priceUsd) / event.priceUsd) * 100;
  if (!Number.isFinite(changePercent)) return null;
  return {
    changePercent,
    elapsedHours,
    entryPriceUsd: event.priceUsd,
    latestPriceUsd: latestCandle.close,
    latestCandleTimestamp: latestCandle.timestamp,
  };
}

function rawDexSwap(rawData: unknown): {
  soldSymbol: string;
  soldAmount: number;
  boughtSymbol: string;
  boughtAmount: number;
} | null {
  if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) return null;
  const row = rawData as Record<string, unknown>;
  const soldSymbol = typeof row["token_sold_symbol"] === "string" ? row["token_sold_symbol"].trim() : "";
  const boughtSymbol = typeof row["token_bought_symbol"] === "string" ? row["token_bought_symbol"].trim() : "";
  const soldAmount = Number(row["token_sold_amount"]);
  const boughtAmount = Number(row["token_bought_amount"]);
  if (!soldSymbol || !boughtSymbol || !Number.isFinite(soldAmount) || soldAmount <= 0
    || !Number.isFinite(boughtAmount) || boughtAmount <= 0) return null;
  return { soldSymbol, soldAmount, boughtSymbol, boughtAmount };
}

function spokenPercentChange(changePercent: number): string {
  const magnitude = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(changePercent));
  if (changePercent > 0.05) return `выросла на ${magnitude} процента`;
  if (changePercent < -0.05) return `снизилась на ${magnitude} процента`;
  return "почти не изменилась";
}

function formatHourDuration(hours: number): string {
  const lastTwoDigits = hours % 100;
  const lastDigit = hours % 10;
  const unit = lastTwoDigits >= 11 && lastTwoDigits <= 14
    ? "часов"
    : lastDigit === 1
      ? "час"
      : lastDigit >= 2 && lastDigit <= 4
        ? "часа"
        : "часов";
  return `${hours} ${unit}`;
}

function compactCoinAmount(amount: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 4 }).format(amount);
}

function postTradeSentence(event: WhaleEvent): string | null {
  const performance = getPostTradePerformance(event);
  if (!performance) return null;
  const coin = spokenCoinForms(event.symbol);
  return `За ${formatHourDuration(performance.elapsedHours)} после сделки цена ${coin.genitive} ${spokenPercentChange(performance.changePercent)} — от цены исполнения до последней часовой свечи Nansen.`;
}

export function formatWhaleEventDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new Error("Некорректная дата сделки Whale Radar.");
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Novosibirsk",
  }).format(date);
}

export function formatWhaleUsd(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function shortWallet(address: string | null): string {
  if (!address) return "адрес без метки";
  if (address.length <= 15) return address;
  return `${address.slice(0, 7)}…${address.slice(-5)}`;
}

function getActionNoun(event: WhaleEvent): string {
  return event.action === "BUY" ? "покупка"
    : event.action === "SELL" ? "продажа"
      : "перевод";
}

export function buildWhaleStory(event: WhaleEvent, comparisonEvent?: WhaleEvent): WhaleStory {
  const chain = CHAIN_NAMES[event.blockchain] ?? event.blockchain;
  const coin = spokenCoinForms(event.symbol);
  const coinLabel = whaleCoinLabel(event.symbol);
  const usd = `$${formatWhaleUsd(event.amountUsd)}`;
  const hasDistinctComparison = Boolean(
    comparisonEvent
    && comparisonEvent.action !== "TRANSFER"
    && comparisonEvent.symbol.toUpperCase() !== event.symbol.toUpperCase(),
  );
  const comparisonCoin = hasDistinctComparison && comparisonEvent
    ? spokenCoinForms(comparisonEvent.symbol)
    : null;
  const comparisonMove = hasDistinctComparison && comparisonEvent
    ? getPostTradePerformance(comparisonEvent)
    : null;
  const eventDate = formatWhaleEventDate(event.timestamp);
  const tradeSentence = event.action === "TRANSFER"
    ? `Nansen зафиксировал перевод ${compactCoinAmount(event.amount)} ${coin.genitive} на ${formatWhaleUsd(event.amountUsd)} долларов.`
    : `Nansen относит этот кошелёк к группе «${event.walletLabel ?? "Smart Money"}» и подтверждает ${event.action === "BUY" ? "покупку" : "продажу"} ${compactCoinAmount(event.amount)} ${coin.genitive} примерно на ${formatWhaleUsd(event.amountUsd)} долларов.`;
  const swap = event.action === "TRANSFER" ? null : rawDexSwap(event.rawData);
  const swapSentence = swap
    ? `Обмен: ${compactCoinAmount(swap.soldAmount)} ${spokenCoinForms(swap.soldSymbol).genitive} на ${compactCoinAmount(swap.boughtAmount)} ${spokenCoinForms(swap.boughtSymbol).genitive}.`
    : "";
  const priceSentence = event.priceUsd && Number.isFinite(event.priceUsd)
    ? `Цена исполнения — около ${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(event.priceUsd)} долларов за монету.`
    : "";
  const postTrade = event.action === "TRANSFER" ? null : postTradeSentence(event);
  const comparisonSentence = hasDistinctComparison && comparisonEvent && comparisonCoin && comparisonMove
    ? `Для сравнения: ${comparisonEvent.action === "BUY" ? "покупка" : "продажа"} ${comparisonCoin.genitive} на ${formatWhaleUsd(comparisonEvent.amountUsd)} долларов; затем цена ${comparisonCoin.genitive} ${spokenPercentChange(comparisonMove.changePercent)} за ${formatHourDuration(comparisonMove.elapsedHours)}.`
    : "";
  const whyItMatters = event.action === "TRANSFER"
    ? `Важно: это подтверждённый перевод, не доказательство покупки или продажи. Причина движения средств неизвестна.`
    : postTrade
      ? `Метка Smart Money не раскрывает мотив сделки. Это разбор фактов, не прогноз.`
      : `Важно: метка Smart Money подтверждает классификацию кошелька, но не мотив сделки. Без часовых свечей после неё изменение цены не посчитать.`;
  const time = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Novosibirsk",
    timeZoneName: "short",
  }).format(new Date(event.timestamp));

  const narration = [
    `Привет, друзья! ${eventDate} — свежая сделка кошелька из группы Smart Money по ${coin.afterPo}.`,
    tradeSentence,
    swapSentence,
    priceSentence,
    postTrade ?? (event.action === "TRANSFER" ? "" : "После сделки Nansen не предоставил достаточно часовых свечей для надёжного расчёта изменения цены."),
    comparisonSentence,
    whyItMatters,
    `Подписывайтесь: каждый день — сделки китов. Ссылка на биржу — в шапке профиля канала: узнать, что сейчас с ${coin.instrumental}, или купить любую другую криптовалюту.`,
  ].filter(Boolean).join(" ");

  return {
    title: `${coinLabel}: ${getActionNoun(event)} на ${usd}`,
    hook: `${coinLabel} · ${event.action} на ${usd}`,
    narration,
    keyFacts: [
      `${event.action} · ${event.amount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} ${coinLabel}`,
      `Стоимость операции: ${usd}`,
      `Сеть: ${chain}`,
      `Время события (Новосибирск): ${time}`,
      `Адрес: ${shortWallet(event.fromAddress)}`,
      ...(event.walletLabel ? [`Метка Nansen: ${event.walletLabel}`] : []),
      ...(event.priceUsd && Number.isFinite(event.priceUsd)
        ? [`Расчётная цена за токен: $${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(event.priceUsd)}`]
        : []),
      ...(event.previousActivity.length ? [`Предыдущих операций в выборке: ${event.previousActivity.length}`] : []),
    ],
    disclaimer: event.action === "TRANSFER"
      ? "Перевод между адресами сам по себе не означает продажу."
      : "Одна DEX-сделка не подтверждает будущий рост или падение.",
  };
}
