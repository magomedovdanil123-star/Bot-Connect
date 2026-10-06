import type { WhaleEvent, WhaleStory, WhaleVisualPlan, WhaleVisualScene } from "./types";

export function buildWhaleVisualPlan(
  event: WhaleEvent,
  story: WhaleStory,
  durationSeconds = 28,
): WhaleVisualPlan {
  const wallet = event.fromAddress
    ? `${event.fromAddress.slice(0, 8)}…${event.fromAddress.slice(-6)}`
    : "адрес не указан";
  const previousBuys = event.previousActivity.filter((item) => item.action === "BUY");
  const previousSells = event.previousActivity.filter((item) => item.action === "SELL");
  const historyScene: WhaleVisualScene | null = event.action === "BUY" && previousBuys.length
    ? {
      id: "accumulation",
      kind: "ACCUMULATION",
      title: "ПРЕДЫДУЩИЕ ПОКУПКИ",
      subtitle: `Nansen · ${previousBuys.length + 1} операций`,
      visualDescription: "Хронология только подтверждённых покупок этого адреса в выборке Nansen.",
    }
    : event.action === "SELL" && previousSells.length
      ? {
        id: "distribution",
        kind: "DISTRIBUTION",
        title: "ПРЕДЫДУЩИЕ ПРОДАЖИ",
        subtitle: `Nansen · ${previousSells.length + 1} операций`,
        visualDescription: "Хронология только подтверждённых продаж этого адреса в выборке Nansen.",
      }
      : event.previousActivity.length
        ? {
          id: "wallet-history",
          kind: "WALLET_HISTORY",
          title: "ПРЕДЫДУЩАЯ АКТИВНОСТЬ",
          subtitle: `Nansen · ${event.previousActivity.length} операций`,
          visualDescription: "Хронология предыдущих операций без утверждения о накоплении или распределении.",
        }
        : null;
  const scenes: WhaleVisualScene[] = [
    {
      id: "hook",
      kind: "HOOK",
      title: event.symbol,
      subtitle: `${event.walletType === "smart_money" ? "SMART MONEY" : "ON-CHAIN"} · ${event.action}`,
      visualDescription: "Полноэкранный тикер на тёмном фоне, короткий световой импульс и крупная сумма.",
    },
    {
      id: "trade-fact",
      kind: "TRADE_FACT",
      title: "ФАКТ СДЕЛКИ",
      subtitle: "Стоимость одной операции · Nansen",
      visualDescription: "Фактическая стоимость и размер операции, указанные источником данных.",
    },
    {
      id: "money-flow",
      kind: "MONEY_FLOW",
      title: event.action === "TRANSFER" ? "ON-CHAIN TRANSFER" : "DEX SWAP",
      subtitle: event.action === "TRANSFER"
        ? "Перевод не равен продаже"
        : `${event.blockchain.toUpperCase()} · ${event.action} · пары из Nansen`,
      visualDescription: event.action === "TRANSFER"
        ? "Поток между отправителем и получателем без вывода о продаже."
        : "Поток от адреса трейдера к токену; не показывать неподтверждённую биржу или пул.",
    },
    {
      id: "wallet",
      kind: "WALLET",
      title: "КОШЕЛЁК ТРЕЙДЕРА",
      subtitle: event.walletLabel ? "Публичная метка Nansen" : wallet,
      visualDescription: "Карточка адреса и только та метка, которую вернул Nansen.",
    },
    ...(event.marketContext?.candles.length
      ? [{
        id: "market",
        kind: "MARKET" as const,
        title: "РЫНОЧНЫЙ КОНТЕКСТ",
        subtitle: event.marketContext.changePercent === null
          ? "Свечи Nansen · 1 час"
          : `${event.marketContext.changePercent >= 0 ? "+" : ""}${event.marketContext.changePercent.toFixed(2)}% за выбранный интервал`,
        visualDescription: "Показать свечи OHLCV Nansen с отметкой времени события; не строить прогноз.",
      }]
      : []),
    {
      id: "source-proof",
      kind: "SOURCE_PROOF",
      title: "ПРОВЕРЯЕМАЯ ТРАНЗАКЦИЯ",
      subtitle: `${event.blockchain.toUpperCase()} · Nansen`,
      visualDescription: "Показать сокращённый хеш и сеть; ссылка ведёт в explorer, если он известен.",
    },
    ...(historyScene ? [historyScene] : []),
    {
      id: "takeaway",
      kind: "TAKEAWAY",
      title: "ОДНО СОБЫТИЕ",
      subtitle: "Факт не является прогнозом цены",
      visualDescription: "Крупный контрастный вывод без ценовой цели и инвестиционного призыва.",
    },
    {
      id: "cta",
      kind: "CTA",
      title: "КАЖДЫЙ ДЕНЬ — ОБЗОР СДЕЛОК КИТОВ",
      subtitle: "Ссылка на биржу — в шапке профиля",
      visualDescription: "Финальная сцена с ежедневным обещанием, ссылкой на биржу в шапке профиля и центральной анимированной кнопкой подписки.",
    },
  ];
  return {
    format: "WHALE_RADAR_SHORTS_V1",
    source: "Nansen",
    targetDurationSeconds: Math.min(35, Math.max(25, durationSeconds)),
    aspectRatio: "9:16",
    scenes,
  };
}
