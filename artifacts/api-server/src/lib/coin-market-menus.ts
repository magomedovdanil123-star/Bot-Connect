export type CoinFormatOrigin = "growth" | "radar";
export type CoinMarketPeriod = "24h" | "7d" | "30d";

export function growingCoinsPeriodKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📈 Монета в фокусе — 7 дней", callback_data: "crypto:coin_overview:topic" }],
      [{ text: "📈 Монета в фокусе — 24 часа", callback_data: "crypto:market_focus:topic" }],
      [{ text: "📈 Монета в фокусе — 30 дней", callback_data: "crypto:market_focus_30d:auto" }],
      [{ text: "⬅️ Финансы", callback_data: "menu:finance" }],
    ],
  };
}

export function coinFormatBackButton(origin: CoinFormatOrigin) {
  return origin === "radar"
    ? { text: "⬅️ Radar Shorts", callback_data: "finance:radar_shorts" }
    : { text: "⬅️ Монеты Роста", callback_data: "finance:growing_coins" };
}

export function coinFormatRetryButton(origin: CoinFormatOrigin, period: CoinMarketPeriod) {
  if (origin === "radar") {
    return {
      text: `🔄 Повторить топ-10 за ${period === "24h" ? "24 часа" : period === "7d" ? "7 дней" : "30 дней"}`,
      callback_data: `crypto:radar_shorts:${period}`,
    };
  }

  const callback_data = period === "24h"
    ? "crypto:market_focus:topic"
    : period === "7d"
      ? "crypto:coin_overview:topic"
      : "crypto:market_focus_30d:auto";
  const text = period === "24h"
    ? "↩️ Повторить обзор за 24 часа"
    : period === "7d"
      ? "↩️ Повторить обзор за 7 дней"
      : "🔄 Повторить топ-10 за 30 дней";
  return { text, callback_data };
}