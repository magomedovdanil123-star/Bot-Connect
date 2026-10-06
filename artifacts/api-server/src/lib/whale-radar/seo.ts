import { formatWhaleUsd } from "./story";
import type { WhaleEvent, WhaleYoutubeMetadata } from "./types";

export function buildWhaleYoutubeMetadata(event: WhaleEvent): WhaleYoutubeMetadata {
  const action = event.action === "BUY" ? "покупка"
    : event.action === "SELL" ? "продажа"
      : "перевод";
  const amount = `$${formatWhaleUsd(event.amountUsd)}`;
  const title = `${event.symbol}: ${action} на ${amount} | Whale Radar`;
  const description = [
    `Проверяемое on-chain событие: ${action} ${event.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${event.symbol} на ${amount}.`,
    `Сеть: ${event.blockchain}. Источник данных: Nansen. Транзакция: ${event.transactionHash}.`,
    event.action === "TRANSFER" ? "Перевод не подтверждает продажу." : "Одна операция не гарантирует дальнейшего движения цены.",
    "Информационный материал, не финансовая рекомендация.",
  ].join("\n");
  return {
    title: title.slice(0, 100),
    description,
    tags: ["Whale Radar", "криптовалюты", "on-chain", event.symbol, event.blockchain],
    hashtags: ["#WhaleRadar", "#криптовалюты", `#${event.symbol.replace(/[^A-Z0-9]/g, "")}`],
  };
}
