import type { TechnicalAnalysisSnapshot } from "./technical-analysis-data";

type TechnicalAnalysisFrameOptions = {
  snapshot: TechnicalAnalysisSnapshot;
  beatIndex: number;
  beatProgress: number;
  beatTitle: string;
  beatSubtitle: string;
};

const WIDTH = 1080;
const HEIGHT = 1920;
const GREEN = "#46e2a0";
const RED = "#ff7186";
const GOLD = "#f0c56c";
const WHITE = "#f4f7fb";
const MUTED = "#9aa9ba";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function price(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 4 : 7,
  }).format(value);
}

function money(value: number): string {
  const sign = value < 0 ? "−" : "+";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function dateLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed).toLocaleUpperCase("ru-RU")
    : "ИСТОРИЧЕСКИЕ ДАННЫЕ";
}

function dateTimeLabel(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      }).format(parsed).toLocaleUpperCase("ru-RU")
    : "ИСТОРИЧЕСКИЙ ДИАПАЗОН";
}

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  fill = WHITE,
  weight = 600,
  anchor: "start" | "middle" | "end" = "start",
  letterSpacing = 0,
): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter,Arial,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letterSpacing}">${escapeXml(value)}</text>`;
}

function levelLine(
  label: string,
  value: number,
  color: string,
  y: number,
  x1: number,
  x2: number,
): string {
  return `<g><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="${color}" stroke-width="3" stroke-dasharray="11 9" opacity=".9"/><rect x="${x2 - 154}" y="${y - 24}" width="146" height="48" rx="14" fill="#101924" stroke="${color}" stroke-opacity=".75"/><text x="${x2 - 81}" y="${y - 3}" fill="${color}" font-family="Inter,Arial,sans-serif" font-size="15" font-weight="800" text-anchor="middle">${escapeXml(label)}</text><text x="${x2 - 81}" y="${y + 15}" fill="${WHITE}" font-family="Inter,Arial,sans-serif" font-size="13" font-weight="600" text-anchor="middle">${price(value)}</text></g>`;
}

export function renderTechnicalAnalysisFrame({
  snapshot,
  beatIndex,
  beatProgress,
  beatTitle,
  beatSubtitle,
}: TechnicalAnalysisFrameOptions): string {
  const revealsFuture = beatIndex >= 3;
  const revealsResult = beatIndex >= 4;
  const revealProgress = beatIndex < 3 ? 0 : beatIndex === 3
    ? Math.min(1, Math.max(0, beatProgress))
    : 1;
  const visibleFutureCount = Math.ceil(snapshot.futureCandles.length * revealProgress);
  const layoutCandles = [
    ...snapshot.setupCandles,
    ...(revealsFuture ? snapshot.futureCandles : []),
  ];
  const candles = [
    ...snapshot.setupCandles,
    ...snapshot.futureCandles.slice(0, visibleFutureCount),
  ];
  const plot = { x: 92, y: 500, width: 890, height: 620 };
  const levels = beatIndex >= 2
    ? [snapshot.entry, snapshot.stop, snapshot.target]
    : [];
  const low = Math.min(...layoutCandles.map((candle) => candle.low), ...levels);
  const high = Math.max(...layoutCandles.map((candle) => candle.high), ...levels);
  const padding = Math.max((high - low) * 0.09, high * 0.002);
  const minPrice = low - padding;
  const maxPrice = high + padding;
  const yAt = (value: number) => plot.y + (maxPrice - value) / (maxPrice - minPrice) * plot.height;
  const step = plot.width / Math.max(layoutCandles.length, 1);
  const bodyWidth = Math.max(4, Math.min(11, step * 0.58));

  const grid = Array.from({ length: 6 }, (_, index) => {
    const y = plot.y + index * plot.height / 5;
    const value = maxPrice - index * (maxPrice - minPrice) / 5;
    return `<g><line x1="${plot.x}" y1="${y}" x2="${plot.x + plot.width}" y2="${y}" stroke="#293544" stroke-width="1.5" stroke-dasharray="5 11"/><text x="${plot.x + plot.width - 4}" y="${y - 9}" fill="${MUTED}" font-family="Inter,Arial,sans-serif" font-size="14" text-anchor="end">${price(value)}</text></g>`;
  }).join("");

  const candleShapes = candles.map((candle, index) => {
    const x = plot.x + step * (index + 0.5);
    const color = candle.close >= candle.open ? GREEN : RED;
    const wick = `<line x1="${x}" y1="${yAt(candle.high)}" x2="${x}" y2="${yAt(candle.low)}" stroke="${color}" stroke-width="2.2" opacity=".9"/>`;
    const top = yAt(Math.max(candle.open, candle.close));
    const bottom = yAt(Math.min(candle.open, candle.close));
    const body = `<rect x="${x - bodyWidth / 2}" y="${top}" width="${bodyWidth}" height="${Math.max(3, bottom - top)}" rx="2" fill="${color}" opacity="${index >= snapshot.setupCandles.length ? ".9" : ".8"}"/>`;
    return `<g data-candle-index="${index}">${wick}${body}</g>`;
  }).join("");

  const signalX = plot.x + step * (snapshot.setupCandles.length - 0.5);
  const signalMarker = `<g><line x1="${signalX}" y1="${plot.y - 6}" x2="${signalX}" y2="${plot.y + plot.height + 8}" stroke="${GOLD}" stroke-width="2" stroke-dasharray="5 8" opacity=".88"/><circle cx="${signalX}" cy="${plot.y + plot.height + 10}" r="7" fill="${GOLD}"/></g>`;
  const entryY = yAt(snapshot.entry);
  const stopY = yAt(snapshot.stop);
  const targetY = yAt(snapshot.target);
  const tradeLevels = beatIndex >= 2
    ? `<g opacity="${(0.62 + 0.38 * Math.min(1, Math.max(0, beatProgress * 4))).toFixed(2)}">${levelLine("ВХОД", snapshot.entry, GOLD, entryY, plot.x, plot.x + plot.width)}${levelLine("СТОП", snapshot.stop, RED, stopY, plot.x, plot.x + plot.width)}${levelLine("ТЕЙК", snapshot.target, GREEN, targetY, plot.x, plot.x + plot.width)}</g>`
    : "";
  const positionSummary = snapshot.direction === "long"
    ? `Риск до стопа: ${snapshot.riskPercent.toFixed(2)}% • без плеча`
    : `Условный шорт • риск до стопа: ${snapshot.riskPercent.toFixed(2)}%`;

  const waveLabels = (snapshot.waveAnnotations ?? []).map((wave, index) => {
    const relativeIndex = Number.isFinite(wave.index) ? wave.index : index + 1;
    const x = plot.x + Math.max(0.04, Math.min(0.92, relativeIndex / Math.max(1, snapshot.setupCandles.length - 1))) * plot.width;
    const y = yAt(wave.price) + (index % 2 ? 30 : -20);
    return `<g><circle cx="${x}" cy="${y}" r="17" fill="#15272a" stroke="${GOLD}" stroke-width="2"/><text x="${x}" y="${y + 6}" fill="${GOLD}" font-family="Inter,Arial,sans-serif" font-size="15" font-weight="900" text-anchor="middle">${escapeXml(wave.wave)}</text></g>`;
  }).join("");

  const outcomeColor = snapshot.outcome === "target" ? GREEN : snapshot.outcome === "stop" ? RED : GOLD;
  const outcomeLabel = snapshot.outcome === "target"
    ? "ТЕЙК ДОСТИГНУТ"
    : snapshot.outcome === "stop"
      ? "СРАБОТАЛ СТОП"
      : "ВЫХОД ПО ВРЕМЕНИ";
  const resultCard = revealsResult
    ? `<g><rect x="92" y="1212" width="890" height="138" rx="28" fill="#111b25" stroke="${outcomeColor}" stroke-opacity=".7" stroke-width="2"/><text x="132" y="1263" fill="${outcomeColor}" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="850" letter-spacing="2">${outcomeLabel}</text><text x="132" y="1318" fill="${WHITE}" font-family="Inter,Arial,sans-serif" font-size="35" font-weight="850">${money(snapshot.pnlUsd)}</text><text x="935" y="1314" fill="${MUTED}" font-family="Inter,Arial,sans-serif" font-size="16" font-weight="650" text-anchor="end">до комиссий и проскальзывания</text></g>`
       : beatIndex >= 2
         ? `<g><rect x="92" y="1212" width="890" height="138" rx="28" fill="#111b25" stroke="#283544" stroke-width="2"/><text x="132" y="1263" fill="${GOLD}" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="850" letter-spacing="2">МОДЕЛЬ СДЕЛКИ • $1 000</text><text x="132" y="1318" fill="${WHITE}" font-family="Inter,Arial,sans-serif" font-size="25" font-weight="800">${escapeXml(positionSummary)}</text><text x="935" y="1314" fill="${MUTED}" font-family="Inter,Arial,sans-serif" font-size="16" font-weight="650" text-anchor="end">${price(snapshot.quantity)} ${escapeXml(snapshot.pair.replace(/USDT$/u, ""))}</text></g>`
      : `<g><rect x="92" y="1212" width="890" height="138" rx="28" fill="#111b25" stroke="#283544" stroke-width="2"/><text x="132" y="1263" fill="${GOLD}" font-family="Inter,Arial,sans-serif" font-size="18" font-weight="850" letter-spacing="2">${revealsFuture ? "ИСТОРИЧЕСКОЕ ДВИЖЕНИЕ" : "УРОВНИ БУДУТ ЗАФИКСИРОВАНЫ ДО РЕЗУЛЬТАТА"}</text><text x="132" y="1318" fill="${WHITE}" font-family="Inter,Arial,sans-serif" font-size="23" font-weight="760">${revealsFuture ? `Выход: ${price(snapshot.exit)} • ${snapshot.bars} свеч.` : "Без заявлений о гарантированном исходе"}</text></g>`;

  const patternCode = snapshot.pattern.type.replaceAll("_", " ").toLocaleUpperCase("ru-RU");
  const resultReveal = revealsFuture
    ? `<rect x="92" y="425" width="300" height="42" rx="21" fill="#16372f" stroke="${GREEN}" stroke-opacity=".5"/><text x="242" y="452" fill="${GREEN}" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="850" text-anchor="middle" letter-spacing="1.4">ПОСЛЕ СИГНАЛА • ${dateLabel(snapshot.signalTime)}</text>`
    : `<rect x="92" y="425" width="266" height="42" rx="21" fill="#30291c" stroke="${GOLD}" stroke-opacity=".5"/><text x="225" y="452" fill="${GOLD}" font-family="Inter,Arial,sans-serif" font-size="14" font-weight="850" text-anchor="middle" letter-spacing="1.4">СИГНАЛ • ${dateLabel(snapshot.signalTime)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1118"/><stop offset="1" stop-color="#141c28"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#1c7d5b" stop-opacity=".28"/><stop offset="1" stop-color="#1c7d5b" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <circle cx="870" cy="290" r="430" fill="url(#glow)"/>
    ${text("HISTORICAL MARKET REPLAY", 92, 128, 16, GREEN, 850, "start", 3)}
    ${text(snapshot.pair, 92, 224, 62, WHITE, 900)}
    ${text(snapshot.pattern.label.toLocaleUpperCase("ru-RU"), 92, 286, 25, GOLD, 800)}
    ${text(`BINANCE SPOT • ${snapshot.timeframe.toUpperCase()} • СИГНАЛ ${dateLabel(snapshot.signalTime)}`, 92, 332, 17, MUTED, 700, "start", 1.2)}
    ${text(`ГРАФИК: ${dateTimeLabel(snapshot.rangeStartTime)} — ${dateTimeLabel(snapshot.rangeEndTime)} UTC`, 92, 360, 14, MUTED, 700, "start", 0.5)}
    ${text(revealsFuture ? "ИСТОРИЯ ПОСЛЕ СИГНАЛА" : "СНАЧАЛА СИГНАЛ И УРОВНИ", 92, 390, 20, WHITE, 850, "start", 1.4)}
    ${resultReveal}
    <rect x="72" y="480" width="936" height="700" rx="28" fill="#0b131c" stroke="#273747" stroke-width="2"/>
    ${grid}
    <line x1="${plot.x}" y1="${plot.y + plot.height}" x2="${plot.x + plot.width}" y2="${plot.y + plot.height}" stroke="#526173" stroke-width="2" opacity=".72"/>
    ${candleShapes}
    ${signalMarker}
    ${tradeLevels}
    ${waveLabels}
    ${text("ЦЕНА, USDT", 104, 488, 13, MUTED, 700, "start", 1.3)}
    ${text(`УРОВЕНЬ: ${price(beatIndex >= 2 ? snapshot.entry : snapshot.setupCandles.at(-1)?.close ?? snapshot.entry)}`, 104, 1154, 14, GOLD, 780)}
    ${resultCard}
    <rect x="92" y="1380" width="890" height="58" rx="18" fill="#0e1721" stroke="#293746"/>
    ${text(`${snapshot.direction === "long" ? "УСЛОВНЫЙ ЛОНГ" : "УСЛОВНЫЙ ШОРТ"} • ${patternCode}`, 128, 1417, 16, snapshot.direction === "long" ? GREEN : RED, 800, "start", 1)}
    ${text(beatTitle.toLocaleUpperCase("ru-RU"), 540, 1468, 17, GOLD, 800, "middle", 1.3)}
    ${text("УЧЕБНЫЙ ПРИМЕР • НЕ ПРОГНОЗ И НЕ СОВЕТ", 540, 1788, 15, MUTED, 700, "middle", 1.5)}
  </svg>`;
}