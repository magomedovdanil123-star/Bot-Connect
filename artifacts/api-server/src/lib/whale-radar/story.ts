import type { WhaleEvent, WhaleStory } from "./types";

const ACTION_WORDS: Record<WhaleEvent["action"], string> = {
  BUY: "купил",
  SELL: "продал",
  TRANSFER: "перевёл",
};

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
  ETH: { nominative: "эфириум", accusative: "эфир", genitive: "эфира", instrumental: "эфиром", afterPo: "эфиру" },
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

export function buildWhaleStory(event: WhaleEvent): WhaleStory {
  const chain = CHAIN_NAMES[event.blockchain] ?? event.blockchain;
  const coin = spokenCoinForms(event.symbol);
  const coinLabel = whaleCoinLabel(event.symbol);
  const usd = `$${formatWhaleUsd(event.amountUsd)}`;
  const actionWord = ACTION_WORDS[event.action];
  const eventDate = formatWhaleEventDate(event.timestamp);
  const tradeSentence = event.action === "TRANSFER"
    ? `Nansen зафиксировал перевод ${coin.genitive} стоимостью ${usd}.`
    : `Nansen: кит ${actionWord} ${coin.accusative} на ${usd}.`;
  const time = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Novosibirsk",
    timeZoneName: "short",
  }).format(new Date(event.timestamp));

  const narration = [
    `Привет, друзья! Сегодня разбираем свежую сделку кита по ${coin.afterPo} от ${eventDate}.`,
    tradeSentence,
    event.action === "TRANSFER" ? `Перевод в сети ${chain} сам по себе не означает продажу.` : "",
    "Одна сделка — не прогноз.",
    `Что сейчас происходит с ${coin.instrumental}? Купить любую другую криптовалюту можно по ссылке на биржу в шапке профиля канала.`,
    "Подписывайтесь: каждый день — обзор сделок китов.",
  ].filter(Boolean).join(" ");

  return {
    title: `${coinLabel}: ${getActionNoun(event)} на ${usd}`,
    hook: `${coinLabel} · ${actionWord} на ${usd}`,
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
