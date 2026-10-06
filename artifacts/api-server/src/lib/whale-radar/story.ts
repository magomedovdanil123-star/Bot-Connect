import type { WhaleEvent, WhaleStory } from "./types";

const ACTION_WORDS: Record<WhaleEvent["action"], string> = {
  BUY: "купил",
  SELL: "продал",
  TRANSFER: "перевёл",
};

const CHAIN_NAMES: Record<string, string> = {
  ethereum: "Ethereum",
  solana: "Solana",
  base: "Base",
  arbitrum: "Arbitrum",
  bitcoin: "Bitcoin",
  ton: "TON",
};

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
  const usd = `$${formatWhaleUsd(event.amountUsd)}`;
  const amount = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 4,
  }).format(event.amount);
  const walletClause = event.walletLabel
    ? "Кошелёк с публичной меткой Nansen"
    : "Кошелёк без публичной метки";
  const actionWord = ACTION_WORDS[event.action];
  const time = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(event.timestamp));

  const narration = [
    `${walletClause} ${actionWord} ${amount} ${event.symbol} на ${usd}.`,
    event.action === "TRANSFER"
      ? `Перевод в сети ${chain}; он не подтверждает продажу.`
      : `Сеть ${chain}.`,
    event.previousActivity.length
      ? `Ещё ${event.previousActivity.length} операций этого кошелька зафиксировал Nansen.`
      : "",
    event.marketContext?.changePercent !== null && event.marketContext?.changePercent !== undefined
      ? `За сутки ${event.symbol}: ${event.marketContext.changePercent >= 0 ? "плюс " : "минус "}${Math.abs(event.marketContext.changePercent).toFixed(2)} процента.`
      : "",
    "Одна сделка не предсказывает цену. Не финансовая рекомендация.",
    "Ссылка на биржу — в шапке профиля. Подписывайтесь: каждый день разбираем сделки китов.",
  ].filter(Boolean).join(" ");

  return {
    title: `${event.symbol}: ${getActionNoun(event)} на ${usd}`,
    hook: `${event.symbol} · ${actionWord} на ${usd}`,
    narration,
    keyFacts: [
      `${event.action} · ${amount} ${event.symbol}`,
      `Стоимость операции: ${usd}`,
      `Сеть: ${chain}`,
      `Время события (UTC): ${time}`,
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
