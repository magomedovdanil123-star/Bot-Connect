import type { CoinOverviewMarketData } from "./coin-overview-data";
import type { MarketFocusCandle, MarketFocusMarketData } from "./coin-market-focus-data";

const WIDTH = 1080;
const HEIGHT = 1920;
const SPEED = 1.25;

const COLORS = {
  background: "#080D0B",
  panel: "#101714",
  panelRaised: "#151F19",
  grid: "#27342C",
  text: "#F2F5EF",
  muted: "#98A69A",
  lime: "#D8FF3F",
  green: "#56E39A",
  red: "#FF655F",
  blue: "#86A9FF",
  amber: "#E8BD67",
};

export type RadarShortsBeat = {
  id: string;
  from: number;
  to: number;
  title: string;
  subtitle: string;
  voiceText?: string;
  isCta?: boolean;
};

export type RadarShortsMarketData =
  | { kind: "coin_overview"; data: CoinOverviewMarketData }
  | { kind: "market_focus"; data: MarketFocusMarketData };

export type RadarShortsFrameInput = {
  timeMs: number;
  durationMs: number;
  beats: RadarShortsBeat[];
  beat: RadarShortsBeat;
  beatIndex: number;
  market: RadarShortsMarketData;
};

type PricePoint = { timestamp: number; label: string; price: number };
type Candle = Pick<MarketFocusCandle, "open" | "high" | "low" | "close" | "quoteVolume">;
type Benchmark = { symbol: string; changePercent: number };
type RadarMarketView = {
  coinName: string;
  symbol: string;
  pair: string;
  periodLabel: string;
  changePercent: number;
  startPrice: number;
  currentPrice: number;
  lowPrice: number;
  highPrice: number;
  candles: Candle[];
  pricePoints: PricePoint[];
  volume: number | null;
  averageVolume: number | null;
  volumeMultiple: number | null;
  activityLabel: string;
  activitySource: string;
  activityValue: number;
  benchmarks: Benchmark[];
  news: { title: string; source: string; publishedAt: string } | null;
  sourceLabel: string;
  retrievedAt: string;
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function ease(value: number): number {
  const t = clamp(value);
  return 1 - (1 - t) ** 3;
}

function localProgress(timeMs: number, durationMs: number, beat: RadarShortsBeat): number {
  const normalized = clamp(timeMs / Math.max(1, durationMs));
  const span = beat.to - beat.from;
  return span <= 0 ? (normalized >= beat.to ? 1 : 0) : clamp((normalized - beat.from) / span);
}

function text(
  value: string,
  x: number,
  y: number,
  options: { size?: number; color?: string; weight?: number; anchor?: "start" | "middle" | "end"; spacing?: number } = {},
): string {
  const { size = 24, color = COLORS.text, weight = 600, anchor = "middle", spacing = 0 } = options;
  return `<text x="${x}" y="${y}" fill="${color}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}">${escapeXml(value)}</text>`;
}

function wrappedText(
  value: string,
  x: number,
  y: number,
  maxChars: number,
  lineHeight: number,
  options: { size?: number; color?: string; weight?: number; anchor?: "start" | "middle" | "end" } = {},
): string {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.map((line, index) => text(line, x, y + index * lineHeight, options)).join("");
}

function formatMoney(value: number, currency = "USD"): string {
  if (!Number.isFinite(value)) return "—";
  const digits = Math.abs(value) < 1 ? 5 : Math.abs(value) < 100 ? 3 : 2;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
  return currency === "USDT" ? `${formatted} USDT` : `$${formatted}`;
}

function formatCompact(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "НЕТ ДАННЫХ";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value))}%`;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "время не указано";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date) + " UTC";
}

function asMarketView(market: RadarShortsMarketData): RadarMarketView {
  if (market.kind === "coin_overview") {
    const data = market.data;
    if (data.priceSamples.length < 2) {
      throw new Error(`Для Radar Shorts ${data.coin.symbol} не сохранены ценовые точки за 7 дней.`);
    }
    return {
      coinName: data.coin.name,
      symbol: data.coin.symbol,
      pair: `${data.coin.symbol}/USD`,
      periodLabel: "7 ДНЕЙ",
      changePercent: data.changePercent7d,
      startPrice: data.periodStartPriceUsd,
      currentPrice: data.currentPriceUsd,
      lowPrice: data.lowPriceUsd7d,
      highPrice: data.highPriceUsd7d,
      candles: [],
      pricePoints: data.priceSamples.map((point) => ({
        timestamp: point.timestamp,
        label: point.label,
        price: point.priceUsd,
      })),
      volume: data.activity.kind === "trading_volume" ? data.activity.valueUsd : null,
      averageVolume: null,
      volumeMultiple: null,
      activityLabel: data.activity.kind === "open_interest" ? "ОТКРЫТЫЙ ИНТЕРЕС" : "ОБОРОТ ЗА СУТКИ",
      activitySource: data.activity.sourceLabel,
      activityValue: data.activity.valueUsd,
      benchmarks: data.benchmarks.map((benchmark) => ({
        symbol: benchmark.symbol,
        changePercent: benchmark.changePercent7d,
      })),
      news: null,
      sourceLabel: data.sourceLabel,
      retrievedAt: data.retrievedAt,
    };
  }

  const data = market.data;
  const candles = data.periodCandles?.length ? data.periodCandles : data.hourlyCandles;
  if (candles.length < 2) {
    throw new Error(`Для Radar Shorts ${data.coin.symbol} не сохранены свечи выбранного периода.`);
  }
  const isMonthly = data.periodKind === "rolling_30d";
  const benchmarks = data.periodBenchmarks ?? data.benchmarks.map((benchmark) => ({
    symbol: benchmark.symbol,
    changePercent: benchmark.changePercent24h,
  })) as [Benchmark, Benchmark];
  return {
    coinName: data.coin.name,
    symbol: data.coin.symbol,
    pair: data.coin.pair,
    periodLabel: isMonthly ? "30 ДНЕЙ" : "24 ЧАСА",
    changePercent: data.periodChangePercent ?? data.changePercent24h,
    startPrice: candles[0]!.open,
    currentPrice: data.currentPrice,
    lowPrice: data.periodLowPrice ?? data.lowPrice24h,
    highPrice: data.periodHighPrice ?? data.highPrice24h,
    candles,
    pricePoints: [],
    volume: data.periodQuoteVolume ?? data.quoteVolume24h,
    averageVolume: data.periodAverageDailyQuoteVolume ?? data.averageDailyQuoteVolume7d,
    volumeMultiple: data.periodVolumeVsAverage ?? data.volumeVs7dAverage,
    activityLabel: isMonthly ? "ОБОРОТ ЗА 30 ДНЕЙ" : "ОБОРОТ ЗА 24 ЧАСА",
    activitySource: "Binance Spot",
    activityValue: data.periodQuoteVolume ?? data.quoteVolume24h,
    benchmarks,
    news: data.news
      ? {
          title: data.news.title,
          source: data.news.sourceName,
          publishedAt: data.news.publishedAt,
        }
      : null,
    sourceLabel: "Binance Spot",
    retrievedAt: data.retrievedAt,
  };
}

function sceneKind(beat: RadarShortsBeat): "hero" | "chart" | "investment" | "volume" | "news" | "benchmarks" | "risk" | "cta" {
  const key = `${beat.id} ${beat.title} ${beat.subtitle}`.toLocaleLowerCase("ru-RU");
  if (beat.isCta) return "cta";
  if (/risk|источник|волатиль|факт.{0,5}не прогноз|риск/iu.test(key)) return "risk";
  if (/benchmark|сравнен|btc|eth|рынком/iu.test(key)) return "benchmarks";
  if (/volume|оборот|активност|интерес|объём/iu.test(key)) return "volume";
  if (/news|новост|контекст|повод/iu.test(key)) return "news";
  if (/hypothetical|investment|investment|условн|инвест|одна сделка|результат за/iu.test(key)) return "investment";
  if (/candle|price_history|истори|траектор|диапазон|откат|свеч|цен.{0,8}за/iu.test(key)) return "chart";
  return "hero";
}

function frameBackground(progress: number, index: number): string {
  return `<defs>
      <linearGradient id="radar-bg" x2="0" y2="1">
        <stop offset="0" stop-color="#0C130F"/>
        <stop offset=".52" stop-color="${COLORS.background}"/>
        <stop offset="1" stop-color="#090F0C"/>
      </linearGradient>
      <radialGradient id="radar-glow" cx="${25 + (index % 3) * 24}%" cy="34%" r="58%">
        <stop offset="0" stop-color="${COLORS.lime}" stop-opacity=".12"/>
        <stop offset="1" stop-color="${COLORS.background}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="radar-grid" width="48" height="48" patternUnits="userSpaceOnUse">
        <path d="M48 0H0V48" fill="none" stroke="${COLORS.grid}" stroke-opacity=".26" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#radar-bg)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#radar-glow)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#radar-grid)"/>
    <rect x="74" y="218" width="932" height="3" rx="2" fill="#DCE6DD" opacity=".14"/>
    <rect x="74" y="218" width="${(932 * progress).toFixed(1)}" height="3" rx="2" fill="${COLORS.lime}"/>`;
}

function frameHeader(view: RadarMarketView, beat: RadarShortsBeat, index: number, total: number): string {
  const step = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
  return `<g>
    ${text(`MARKET / LIVE RADAR • ${view.periodLabel}`, 74, 106, { size: 18, color: COLORS.muted, weight: 700, anchor: "start", spacing: 2 })}
    ${text(view.symbol, 74, 184, { size: 44, color: COLORS.text, weight: 800, anchor: "start", spacing: 1 })}
    ${text(step, 1_006, 184, { size: 19, color: COLORS.muted, weight: 700, anchor: "end", spacing: 2 })}
    ${text(beat.title.toLocaleUpperCase("ru-RU"), 540, 286, { size: 23, color: COLORS.lime, weight: 800, spacing: 1.5 })}
  </g>`;
}

function card(x: number, y: number, width: number, height: number, accent = COLORS.lime): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="28" fill="${COLORS.panel}" stroke="${accent}" stroke-opacity=".28" stroke-width="2"/>`;
}

function statTile(x: number, y: number, label: string, value: string, accent = COLORS.lime): string {
  return `<g>${card(x, y, 432, 154, accent)}
    ${text(label, x + 34, y + 45, { size: 16, color: COLORS.muted, weight: 700, anchor: "start", spacing: 1.1 })}
    ${text(value, x + 34, y + 105, { size: value.length > 15 ? 26 : 34, color: COLORS.text, weight: 800, anchor: "start" })}
  </g>`;
}

function renderHero(view: RadarMarketView, beat: RadarShortsBeat, progress: number): string {
  const directionColor = view.changePercent > 0 ? COLORS.green : view.changePercent < 0 ? COLORS.red : COLORS.amber;
  const ringProgress = ease(clamp(progress / 0.65));
  const radius = 158;
  const circumference = 2 * Math.PI * radius;
  const priceChange = view.currentPrice - view.startPrice;
  return `<g opacity="${ease(clamp(progress / 0.16)).toFixed(3)}">
    ${card(74, 340, 932, 920, directionColor)}
    <circle cx="540" cy="562" r="${radius}" fill="#0B120E" stroke="#27372D" stroke-width="14"/>
    <circle cx="540" cy="562" r="${radius}" fill="none" stroke="${COLORS.lime}" stroke-width="8"
      stroke-dasharray="${circumference.toFixed(1)}" stroke-dashoffset="${(circumference * (1 - ringProgress)).toFixed(1)}"
      transform="rotate(-90 540 562)" stroke-linecap="round"/>
    ${text(view.symbol.slice(0, 8), 540, 579, { size: view.symbol.length > 5 ? 39 : 52, color: COLORS.text, weight: 800 })}
    ${text(view.coinName, 540, 802, { size: 24, color: COLORS.muted, weight: 600 })}
    ${text(formatSignedPercent(view.changePercent), 540, 934, { size: 78, color: directionColor, weight: 800 })}
    ${text(`ЗА ${view.periodLabel}`, 540, 991, { size: 18, color: COLORS.muted, weight: 700, spacing: 2 })}
    <line x1="135" y1="1043" x2="945" y2="1043" stroke="${COLORS.grid}" stroke-width="2"/>
    ${text("ТЕКУЩАЯ ЦЕНА", 135, 1092, { size: 16, color: COLORS.muted, weight: 700, anchor: "start", spacing: 1 })}
    ${text(formatMoney(view.currentPrice), 135, 1150, { size: 34, color: COLORS.text, weight: 800, anchor: "start" })}
    ${text("ИЗМЕНЕНИЕ ЦЕНЫ", 945, 1092, { size: 16, color: COLORS.muted, weight: 700, anchor: "end", spacing: 1 })}
    ${text(`${priceChange >= 0 ? "+" : "−"}${formatMoney(Math.abs(priceChange))}`, 945, 1150, { size: 34, color: directionColor, weight: 800, anchor: "end" })}
    ${wrappedText(beat.subtitle, 540, 1221, 54, 31, { size: 18, color: COLORS.muted, weight: 500 })}
  </g>`;
}

function renderCandleChart(view: RadarMarketView, progress: number): string {
  const x = 150;
  const y = 660;
  const width = 780;
  const height = 360;
  const chartValues = view.candles.flatMap((candle) => [candle.high, candle.low]);
  const high = Math.max(...chartValues);
  const low = Math.min(...chartValues);
  const range = Math.max(Number.EPSILON, high - low);
  const shown = Math.max(1, Math.ceil(view.candles.length * ease(clamp((progress - 0.14) / 0.48))));
  const candleWidth = Math.max(5, Math.min(20, width / view.candles.length * 0.54));
  const candles = view.candles.slice(0, shown).map((candle, index) => {
    const centerX = x + (index + 0.5) * width / view.candles.length;
    const priceY = (price: number) => y + (high - price) / range * height;
    const openY = priceY(candle.open);
    const closeY = priceY(candle.close);
    const top = Math.min(openY, closeY);
    const bodyHeight = Math.max(3, Math.abs(openY - closeY));
    const color = candle.close >= candle.open ? COLORS.green : COLORS.red;
    const op = Math.min(1, 0.55 + index / Math.max(1, view.candles.length) * 0.45);
    return `<g opacity="${op.toFixed(2)}">
      <line x1="${centerX.toFixed(1)}" y1="${priceY(candle.high).toFixed(1)}" x2="${centerX.toFixed(1)}" y2="${priceY(candle.low).toFixed(1)}" stroke="${color}" stroke-width="3"/>
      <rect x="${(centerX - candleWidth / 2).toFixed(1)}" y="${top.toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${bodyHeight.toFixed(1)}" rx="2" fill="${color}"/>
    </g>`;
  }).join("");
  const maxVolume = Math.max(1, ...view.candles.map((candle) => candle.quoteVolume));
  const volumeBars = view.candles.slice(0, shown).map((candle, index) => {
    const barWidth = Math.max(3, width / view.candles.length * 0.58);
    const barHeight = 74 * Math.max(0.05, candle.quoteVolume / maxVolume);
    const barX = x + (index + 0.5) * width / view.candles.length - barWidth / 2;
    const color = candle.close >= candle.open ? COLORS.green : COLORS.red;
    return `<rect x="${barX.toFixed(1)}" y="${(1126 - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="2" fill="${color}" opacity=".48"/>`;
  }).join("");
  const candleCount = view.candles.length;
  const finalTwoDigits = candleCount % 100;
  const finalDigit = candleCount % 10;
  const candleUnit = view.periodLabel === "30 ДНЕЙ"
    ? finalTwoDigits >= 11 && finalTwoDigits <= 14
      ? "ДНЕВНЫХ СВЕЧЕЙ"
      : finalDigit === 1
        ? "ДНЕВНАЯ СВЕЧА"
        : finalDigit >= 2 && finalDigit <= 4
          ? "ДНЕВНЫЕ СВЕЧИ"
          : "ДНЕВНЫХ СВЕЧЕЙ"
    : finalTwoDigits >= 11 && finalTwoDigits <= 14
      ? "ЧАСОВЫХ СВЕЧЕЙ"
      : finalDigit === 1
        ? "ЧАСОВАЯ СВЕЧА"
        : finalDigit >= 2 && finalDigit <= 4
          ? "ЧАСОВЫЕ СВЕЧИ"
          : "ЧАСОВЫХ СВЕЧЕЙ";
  return `<g>
    ${card(74, 340, 932, 866)}
    ${text(view.pair, 116, 394, { size: 18, color: COLORS.muted, weight: 700, anchor: "start", spacing: 1 })}
    ${text(formatSignedPercent(view.changePercent), 964, 394, { size: 25, color: view.changePercent >= 0 ? COLORS.green : COLORS.red, weight: 800, anchor: "end" })}
    ${text(formatMoney(view.currentPrice, view.pair.endsWith("USDT") ? "USDT" : "USD"), 116, 484, { size: 52, color: COLORS.text, weight: 800, anchor: "start" })}
    ${text(`${candleCount} ${candleUnit}`, 964, 484, { size: 15, color: COLORS.muted, weight: 700, anchor: "end", spacing: 1 })}
    ${Array.from({ length: 5 }, (_, index) => {
      const lineY = y + index * height / 4;
      const value = high - index * range / 4;
      return `<g><line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="${COLORS.grid}" stroke-width="1"/>${text(formatMoney(value, view.pair.endsWith("USDT") ? "USDT" : "USD"), x - 16, lineY + 6, { size: 13, color: COLORS.muted, weight: 500, anchor: "end" })}</g>`;
    }).join("")}
    ${candles}
    <line x1="${x}" y1="1126" x2="${x + width}" y2="1126" stroke="${COLORS.grid}" stroke-width="1"/>
    ${volumeBars}
    ${statTile(74, 1230, "МИНИМУМ ПЕРИОДА", formatMoney(view.lowPrice, view.pair.endsWith("USDT") ? "USDT" : "USD"))}
    ${statTile(574, 1230, "МАКСИМУМ ПЕРИОДА", formatMoney(view.highPrice, view.pair.endsWith("USDT") ? "USDT" : "USD"))}
  </g>`;
}

function renderSampleChart(view: RadarMarketView, progress: number): string {
  const x = 170;
  const y = 755;
  const width = 740;
  const height = 330;
  const values = view.pricePoints.map((point) => point.price);
  const high = Math.max(...values);
  const low = Math.min(...values);
  const range = Math.max(Number.EPSILON, high - low);
  const shown = Math.max(2, Math.ceil(view.pricePoints.length * ease(clamp((progress - 0.18) / 0.45))));
  const coords = view.pricePoints.slice(0, shown).map((point, index, points) => {
    const px = x + index * width / Math.max(1, view.pricePoints.length - 1);
    const py = y + (high - point.price) / range * height;
    return { x: px, y: py, point };
  });
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const dots = coords.map(({ x: px, y: py }, index) => (
    `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${index === coords.length - 1 ? 11 : 6}" fill="${COLORS.lime}" stroke="${COLORS.panel}" stroke-width="4"/>`
  )).join("");
  return `<g>
    ${card(74, 340, 932, 866)}
    ${text(view.pair, 116, 394, { size: 18, color: COLORS.muted, weight: 700, anchor: "start", spacing: 1 })}
    ${text(formatSignedPercent(view.changePercent), 964, 394, { size: 25, color: view.changePercent >= 0 ? COLORS.green : COLORS.red, weight: 800, anchor: "end" })}
    ${text(formatMoney(view.currentPrice), 116, 484, { size: 52, color: COLORS.text, weight: 800, anchor: "start" })}
    ${text(`${view.pricePoints.length} РАВНОМЕРНЫХ СНИМКА`, 964, 484, { size: 15, color: COLORS.muted, weight: 700, anchor: "end", spacing: 1 })}
    ${Array.from({ length: 5 }, (_, index) => {
      const lineY = y + index * height / 4;
      return `<g><line x1="${x}" y1="${lineY}" x2="${x + width}" y2="${lineY}" stroke="${COLORS.grid}" stroke-width="1"/>${text(formatMoney(high - index * range / 4), x - 18, lineY + 6, { size: 13, color: COLORS.muted, weight: 500, anchor: "end" })}</g>`;
    }).join("")}
    <path d="${path}" fill="none" stroke="${COLORS.lime}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    ${text("7 ДНЕЙ", 540, 1158, { size: 17, color: COLORS.muted, weight: 700, spacing: 2 })}
    ${statTile(74, 1230, "МИНИМУМ ПЕРИОДА", formatMoney(view.lowPrice))}
    ${statTile(574, 1230, "МАКСИМУМ ПЕРИОДА", formatMoney(view.highPrice))}
  </g>`;
}

function renderChart(view: RadarMarketView, progress: number): string {
  return view.candles.length > 1
    ? renderCandleChart(view, progress)
    : renderSampleChart(view, progress);
}

function renderInvestment(view: RadarMarketView, progress: number): string {
  const initial = 1_000;
  const pnl = initial * view.changePercent / 100;
  const finalValue = initial + pnl;
  const amountProgress = ease(clamp((progress - 0.18) / 0.56));
  const displayed = initial + (finalValue - initial) * amountProgress;
  const color = pnl > 0 ? COLORS.green : pnl < 0 ? COLORS.red : COLORS.amber;
  return `<g>
    ${card(74, 340, 932, 922, color)}
    ${text("РАСЧЁТ ПО ИСТОРИЧЕСКОЙ ЦЕНЕ", 540, 420, { size: 17, color: COLORS.muted, weight: 700, spacing: 1.5 })}
    ${text("УСЛОВНЫЕ", 540, 524, { size: 20, color: COLORS.lime, weight: 800, spacing: 3 })}
    ${text("$1 000", 540, 634, { size: 76, color: COLORS.text, weight: 800 })}
    <path d="M540 676V746" stroke="${COLORS.lime}" stroke-width="4" stroke-dasharray="8 12"/>
    <path d="M528 733L540 748L552 733" fill="none" stroke="${COLORS.lime}" stroke-width="4"/>
    ${text("НА ВЫХОДЕ", 540, 824, { size: 17, color: COLORS.muted, weight: 700, spacing: 2 })}
    ${text(formatMoney(displayed), 540, 932, { size: 72, color, weight: 800 })}
    ${text(`${pnl > 0 ? "+" : pnl < 0 ? "−" : ""}${formatMoney(Math.abs(pnl))} • ${formatSignedPercent(view.changePercent)}`, 540, 1008, { size: 30, color, weight: 700 })}
    <rect x="156" y="1074" width="768" height="5" rx="3" fill="${COLORS.grid}"/>
    <rect x="156" y="1074" width="${(768 * amountProgress).toFixed(1)}" height="5" rx="3" fill="${color}"/>
    ${wrappedText(`Динамика ${view.symbol} за ${view.periodLabel.toLocaleLowerCase("ru-RU")}. До комиссий, налогов и проскальзывания.`, 540, 1164, 58, 30, { size: 20, color: COLORS.muted })}
    ${text("ЭТО РАСЧЁТ ЗАДНИМ ЧИСЛОМ, НЕ ПРОГНОЗ", 540, 1260, { size: 15, color: COLORS.amber, weight: 700, spacing: 1 })}
  </g>`;
}

function renderVolume(view: RadarMarketView, progress: number): string {
  const fill = 768 * ease(clamp((progress - 0.15) / 0.55));
  const ratio = view.volumeMultiple;
  return `<g>
    ${card(74, 340, 932, 920)}
    ${text(view.activityLabel, 540, 450, { size: 20, color: COLORS.muted, weight: 700, spacing: 1.5 })}
    ${text(formatCompact(view.activityValue), 540, 608, { size: 92, color: COLORS.lime, weight: 800 })}
    ${text(view.activitySource.toLocaleUpperCase("ru-RU"), 540, 666, { size: 17, color: COLORS.muted, weight: 700, spacing: 2 })}
    <line x1="156" y1="742" x2="924" y2="742" stroke="${COLORS.grid}" stroke-width="2"/>
    ${ratio !== null && view.averageVolume !== null
      ? `<g>
          ${text("СРЕДНЕЕ / ОТНОШЕНИЕ К СРЕДНЕМУ", 540, 814, { size: 17, color: COLORS.muted, weight: 700, spacing: 1 })}
          ${text(`${formatCompact(view.averageVolume)} В ДЕНЬ`, 540, 892, { size: 31, color: COLORS.text, weight: 800 })}
          ${text(`${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(ratio)}×`, 540, 1004, { size: 70, color: COLORS.lime, weight: 800 })}
          <rect x="156" y="1070" width="768" height="9" rx="5" fill="${COLORS.grid}"/>
          <rect x="156" y="1070" width="${fill.toFixed(1)}" height="9" rx="5" fill="${COLORS.lime}"/>
          ${wrappedText("Оборот показывает объём сделок, а не чистый приток денег в актив.", 540, 1160, 57, 30, { size: 19, color: COLORS.muted })}
        </g>`
      : `<g>
          ${text("ПОКАЗАТЕЛЬ АКТИВНОСТИ", 540, 832, { size: 17, color: COLORS.muted, weight: 700, spacing: 1 })}
          ${wrappedText(view.activityLabel === "ОТКРЫТЫЙ ИНТЕРЕС" ? "Открытый интерес одной биржи — это открытые позиции на этой площадке, а не спотовый спрос всего рынка." : "Это показатель оборота за сутки, а не подтверждение чистого притока средств.", 540, 930, 58, 34, { size: 21, color: COLORS.text, weight: 500 })}
          ${text("ПОКАЗАТЕЛЬ НЕ ОБЪЯСНЯЕТ ПРИЧИНУ ДВИЖЕНИЯ", 540, 1168, { size: 15, color: COLORS.amber, weight: 700, spacing: 1 })}
        </g>`}
  </g>`;
}

function renderNews(view: RadarMarketView, progress: number): string {
  if (!view.news) {
    return `<g>
      ${card(74, 340, 932, 920, COLORS.amber)}
      ${text("ВОЗМОЖНЫЙ КОНТЕКСТ", 540, 470, { size: 18, color: COLORS.amber, weight: 800, spacing: 2 })}
      ${text("ПОДТВЕРЖДЁННОГО", 540, 650, { size: 42, color: COLORS.text, weight: 800 })}
      ${text("ИНФОПОВОДА", 540, 718, { size: 42, color: COLORS.text, weight: 800 })}
      ${text("НЕ НАЙДЕНО", 540, 786, { size: 42, color: COLORS.text, weight: 800 })}
      <line x1="200" y1="876" x2="880" y2="876" stroke="${COLORS.grid}" stroke-width="2"/>
      ${wrappedText("Движение цены видно в данных, но его точная причина не установлена.", 540, 972, 50, 36, { size: 23, color: COLORS.muted })}
      ${text("НЕ ВЫДАЁМ ПРЕДПОЛОЖЕНИЕ ЗА ФАКТ", 540, 1138, { size: 15, color: COLORS.amber, weight: 700, spacing: 1 })}
    </g>`;
  }
  const reveal = ease(clamp((progress - 0.18) / 0.42));
  return `<g opacity="${reveal.toFixed(3)}">
    ${card(74, 340, 932, 920, COLORS.blue)}
    ${text("ВОЗМОЖНЫЙ КОНТЕКСТ • НЕ ДОКАЗАННАЯ ПРИЧИНА", 540, 438, { size: 16, color: COLORS.blue, weight: 800, spacing: 1.2 })}
    ${wrappedText(view.news.title, 540, 610, 37, 52, { size: 35, color: COLORS.text, weight: 700 })}
    <line x1="156" y1="928" x2="924" y2="928" stroke="${COLORS.grid}" stroke-width="2"/>
    ${text(view.news.source.toLocaleUpperCase("ru-RU"), 156, 1004, { size: 17, color: COLORS.blue, weight: 800, anchor: "start", spacing: 1 })}
    ${text(formatTimestamp(view.news.publishedAt), 924, 1004, { size: 16, color: COLORS.muted, weight: 600, anchor: "end" })}
    ${wrappedText("Заголовок может быть связан с движением, но сам по себе не подтверждает, что именно он его вызвал.", 540, 1100, 55, 33, { size: 19, color: COLORS.muted })}
  </g>`;
}

function renderBenchmarks(view: RadarMarketView, progress: number): string {
  const items = [
    { symbol: view.symbol, change: view.changePercent, color: COLORS.lime },
    ...view.benchmarks.map((benchmark, index) => ({
      symbol: benchmark.symbol,
      change: benchmark.changePercent,
      color: index === 0 ? COLORS.blue : COLORS.amber,
    })),
  ];
  const maxMagnitude = Math.max(1, ...items.map((item) => Math.abs(item.change)));
  return `<g>
    ${card(74, 340, 932, 920)}
    ${text(`ОДИН ПЕРИОД • ${view.periodLabel}`, 540, 440, { size: 17, color: COLORS.muted, weight: 700, spacing: 1.5 })}
    ${items.map((item, index) => {
      const y = 552 + index * 190;
      const barWidth = 565 * Math.abs(item.change) / maxMagnitude * ease(clamp((progress - 0.1 - index * 0.1) / 0.45));
      const x = item.change < 0 ? 510 - barWidth : 510;
      return `<g>
        ${text(item.symbol, 156, y + 19, { size: 24, color: COLORS.text, weight: 800, anchor: "start" })}
        ${text(formatSignedPercent(item.change), 924, y + 19, { size: 25, color: item.change < 0 ? COLORS.red : item.color, weight: 800, anchor: "end" })}
        <line x1="510" y1="${y + 44}" x2="510" y2="${y + 124}" stroke="${COLORS.grid}" stroke-width="2"/>
        <rect x="${x.toFixed(1)}" y="${y + 58}" width="${Math.max(5, barWidth).toFixed(1)}" height="34" rx="17" fill="${item.change < 0 ? COLORS.red : item.color}" opacity=".9"/>
      </g>`;
    }).join("")}
    ${wrappedText("Сравнение показывает рыночный фон за тот же срок, но не объясняет причину движения.", 540, 1154, 58, 31, { size: 19, color: COLORS.muted })}
  </g>`;
}

function renderRisk(view: RadarMarketView): string {
  return `<g>
    ${card(74, 340, 932, 920, COLORS.amber)}
    <circle cx="540" cy="532" r="86" fill="#171810" stroke="${COLORS.amber}" stroke-width="3"/>
    ${text("!", 540, 566, { size: 98, color: COLORS.amber, weight: 800 })}
    ${text("ВОЛАТИЛЬНОСТЬ", 540, 708, { size: 28, color: COLORS.text, weight: 800, spacing: 2 })}
    ${wrappedText("Цена может резко измениться. Прошлая динамика не гарантирует будущего результата.", 540, 792, 48, 39, { size: 23, color: COLORS.muted })}
    <line x1="156" y1="948" x2="924" y2="948" stroke="${COLORS.grid}" stroke-width="2"/>
    ${text("ИСТОЧНИК ДАННЫХ", 156, 1014, { size: 15, color: COLORS.muted, weight: 700, anchor: "start", spacing: 1 })}
    ${text(view.sourceLabel, 924, 1014, { size: 17, color: COLORS.text, weight: 700, anchor: "end" })}
    ${text("ДАННЫЕ ПОЛУЧЕНЫ", 156, 1084, { size: 15, color: COLORS.muted, weight: 700, anchor: "start", spacing: 1 })}
    ${text(formatTimestamp(view.retrievedAt), 924, 1084, { size: 17, color: COLORS.text, weight: 700, anchor: "end" })}
    ${text("ОБРАЗОВАТЕЛЬНЫЙ ОБЗОР • НЕ ИНВЕСТИЦИОННЫЙ СОВЕТ", 540, 1180, { size: 14, color: COLORS.amber, weight: 700, spacing: 1 })}
  </g>`;
}

function renderCta(view: RadarMarketView, beat: RadarShortsBeat, progress: number): string {
  const reveal = ease(clamp((progress - 0.08) / 0.3));
  const ctaText = beat.voiceText?.trim() || beat.subtitle.trim();
  if (!ctaText) throw new Error(`Для Radar Shorts ${view.symbol} не сохранён текст CTA.`);
  return `<g opacity="${reveal.toFixed(3)}">
    ${card(74, 340, 932, 920)}
    <circle cx="540" cy="530" r="96" fill="#151F19" stroke="${COLORS.lime}" stroke-width="3"/>
    <path d="M502 530H578M540 492V568" stroke="${COLORS.lime}" stroke-width="8" stroke-linecap="round"/>
    ${text(`${view.symbol} • ${view.periodLabel}`, 540, 710, { size: 19, color: COLORS.muted, weight: 700, spacing: 1.5 })}
    ${wrappedText(beat.title || "ПРОВЕРЬ ДАННЫЕ САМ", 540, 826, 30, 58, { size: 40, color: COLORS.text, weight: 800 })}
    ${wrappedText(ctaText, 540, 1000, 46, 31, { size: 20, color: COLORS.lime, weight: 600 })}
  </g>`;
}

export function renderRadarShortsFrame(input: RadarShortsFrameInput): string {
  const view = asMarketView(input.market);
  const progress = localProgress(input.timeMs, input.durationMs, input.beat);
  const kind = sceneKind(input.beat);
  const scene = kind === "hero"
    ? renderHero(view, input.beat, progress)
    : kind === "chart"
        ? renderChart(view, progress)
      : kind === "investment"
        ? renderInvestment(view, progress)
        : kind === "volume"
          ? renderVolume(view, progress)
          : kind === "news"
            ? renderNews(view, progress)
            : kind === "benchmarks"
              ? renderBenchmarks(view, progress)
              : kind === "risk"
                ? renderRisk(view)
                : renderCta(view, input.beat, progress);
  const index = Math.max(0, input.beatIndex);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${frameBackground(progress, index)}
    ${frameHeader(view, input.beat, index, input.beats.length)}
    ${scene}
    ${text(`${view.pair} • ${view.sourceLabel.toLocaleUpperCase("ru-RU")} • PLAYBACK ${SPEED.toFixed(2)}×`, 540, 1405, { size: 14, color: COLORS.muted, weight: 600, spacing: 1 })}
  </svg>`;
}

export function renderRadarShortsSubtitleFrame(beat: RadarShortsBeat, progress: number): string {
  const opacity = ease(clamp(progress / 0.18));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <g opacity="${opacity.toFixed(3)}" transform="translate(0 ${(1 - opacity) * 16})">
      <rect x="74" y="1424" width="932" height="230" rx="28" fill="#0A100D" fill-opacity=".98" stroke="${COLORS.lime}" stroke-opacity=".32" stroke-width="2"/>
      <rect x="112" y="1462" width="112" height="4" rx="2" fill="${COLORS.lime}"/>
      ${wrappedText(beat.subtitle, 540, 1530, 54, 38, { size: 26, color: COLORS.text, weight: 600 })}
    </g>
  </svg>`;
}