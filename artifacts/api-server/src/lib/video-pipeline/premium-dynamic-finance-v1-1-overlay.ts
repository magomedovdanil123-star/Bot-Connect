import { copyFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import type {
  CoinOverviewLongResearchData,
  CoinOverviewMarketData,
} from "../coin-overview-data";
import type { PremiumDynamicFinanceV1_1VisualEvent } from "./premium-dynamic-finance-v1-1-visual-director";

const execFileAsync = promisify(execFile);
const WIDTH = 1920;
const HEIGHT = 1080;
const CARD_WIDTH = 760;
const CARD_HEIGHT = 490;
const ACCENT = "#F0C84B";
const TEXT = "#F5F7FA";
const MUTED = "#AAB7C7";

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function cardPosition(event: PremiumDynamicFinanceV1_1VisualEvent): { x: number; y: number } {
  if (event.layout === "right") return { x: 1_080, y: 104 };
  if (event.layout === "wide" || event.layout === "centered" || event.layout === "fullscreen") {
    return { x: 580, y: 104 };
  }
  return { x: 80, y: 104 };
}

function money(value: number, digits = 4): string {
  return `$${new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: digits,
  }).format(value)}`;
}

function compactMoney(value: number): string {
  return `$${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function percent(value: number): string {
  return `${value > 0 ? "+" : ""}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}%`;
}

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("en-GB", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date)
    : "time unavailable";
}

function text(
  x: number,
  y: number,
  value: string,
  size: number,
  color = TEXT,
  weight = 500,
  anchor = "start",
): string {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${xml(value)}</text>`;
}

function commonHeader(
  event: PremiumDynamicFinanceV1_1VisualEvent,
  market: CoinOverviewMarketData,
  x: number,
  y: number,
): string {
  const badgeLabel = event.decorative
    ? event.visualType === "NEWS_CARD"
      ? "ИЛЛЮСТРАТИВНО · НЕ НОВОСТЬ"
      : event.visualType === "UI_TERMINAL"
        ? "ВЫМЫШЛЕННЫЙ ЭКРАН"
        : "СХЕМА-ИЛЛЮСТРАЦИЯ"
    : `${market.sourceLabel.toLocaleUpperCase("en-US")} · ${market.coin.symbol}`;
  const motif = event.backgroundKey === "terminal-grid"
    ? `<path d="M ${x + 560} ${y + 46}h120 M ${x + 560} ${y + 62}h120 M ${x + 560} ${y + 78}h120" stroke="#AAB7C7" stroke-opacity=".16" stroke-width="2"/>`
    : event.backgroundKey === "diagonal-rails"
      ? `<path d="M ${x + 566} ${y + 34}l112 60 M ${x + 595} ${y + 34}l112 60" stroke="#F0C84B" stroke-opacity=".18" stroke-width="3"/>`
      : event.backgroundKey === "signal-wave"
        ? `<path d="M ${x + 560} ${y + 68}c22 -25 42 25 64 0s42 25 64 0" fill="none" stroke="#72E6D3" stroke-opacity=".34" stroke-width="3"/>`
        : event.backgroundKey === "soft-particles"
          ? [0, 1, 2, 3, 4].map((index) =>
            `<circle cx="${x + 576 + index * 24}" cy="${y + 44 + (index % 2) * 26}" r="3" fill="#72E6D3" fill-opacity=".44"/>`,
          ).join("")
          : `<circle cx="${x + 626}" cy="${y + 66}" r="42" fill="none" stroke="#72E6D3" stroke-opacity=".18" stroke-width="2"/><circle cx="${x + 626}" cy="${y + 66}" r="28" fill="none" stroke="#F0C84B" stroke-opacity=".26" stroke-width="2"/>`;
  return `<g>
    <rect x="${x}" y="${y}" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" rx="26" fill="#07101D" fill-opacity=".94" stroke="#D8E2EE" stroke-opacity=".24" stroke-width="2"/>
    <rect x="${x + 1}" y="${y + 1}" width="${CARD_WIDTH - 2}" height="8" rx="4" fill="${ACCENT}" fill-opacity=".86"/>
    <circle cx="${x + 82}" cy="${y + 74}" r="47" fill="#FFF9E9"/>
    ${motif}
    ${text(x + 150, y + 59, badgeLabel, 20, event.decorative ? "#F0C84B" : "#72E6D3", 700)}
    ${text(x + 150, y + 94, `${market.coin.name} · ${market.coin.symbol}`, 26, TEXT, 700)}
    <path d="M ${x + 34} ${y + 128}H ${x + CARD_WIDTH - 34}" stroke="#D8E2EE" stroke-opacity=".16" stroke-width="2"/>
  </g>`;
}

function commonFooter(
  event: PremiumDynamicFinanceV1_1VisualEvent,
  market: CoinOverviewMarketData,
  x: number,
  y: number,
): string {
  const label = event.decorative
    ? "Иллюстрация · не рыночный сигнал"
    : `Источник: ${market.sourceLabel} · данные на ${dateLabel(market.dataAsOf)}`;
  return text(x + 36, y + CARD_HEIGHT - 24, label, 17, MUTED, 500);
}

function visualBody(
  event: PremiumDynamicFinanceV1_1VisualEvent,
  market: CoinOverviewMarketData,
  research: CoinOverviewLongResearchData | null,
  x: number,
  y: number,
): string {
  const bodyY = y + 174;
  const valueColor = market.changePercent7d >= 0 ? "#72E6D3" : "#FF8A80";
  switch (event.visualType) {
    case "COIN_INTRO":
      return [
        text(x + 40, bodyY, "ПРОФИЛЬ АКТИВА", 19, MUTED, 700),
        text(x + 40, bodyY + 70, market.coin.name, 48, TEXT, 800),
        text(x + 40, bodyY + 116, `${market.coin.symbol}  ·  актив CoinGecko`, 25, ACCENT, 700),
        text(x + 40, bodyY + 164, "Рыночный срез и история · без прогноза доходности", 20, MUTED),
      ].join("");
    case "MARKET_DATA": {
      const cells: Array<{ title: string; value: string; color?: string }> = [
        { title: "ЦЕНА · USD", value: money(market.currentPriceUsd) },
      ];
      if (market.marketCapUsd !== null) {
        cells.push({ title: "КАПИТАЛИЗАЦИЯ", value: compactMoney(market.marketCapUsd) });
      }
      cells.push({
        title: market.activity.kind === "open_interest" ? "ОТКРЫТЫЙ ИНТЕРЕС" : "ОБОРОТ ЗА 24 ЧАСА",
        value: compactMoney(market.activity.valueUsd),
      });
      const cellWidth = 680 / cells.length;
      return cells.map((cell, index) => {
        const cellX = x + 40 + index * cellWidth;
        return `<g>
          <rect x="${cellX}" y="${bodyY - 26}" width="${cellWidth - 12}" height="132" rx="16" fill="#152337" stroke="#D8E2EE" stroke-opacity=".13"/>
          ${text(cellX + 18, bodyY + 10, cell.title, 17, MUTED, 700)}
          ${text(cellX + 18, bodyY + 66, cell.value, 31, cell.color ?? TEXT, 800)}
        </g>`;
      }).join("");
    }
    case "PRICE_CHART": {
      const points = market.priceSamples;
      const values = points.map((point) => point.priceUsd);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = Math.max(max - min, Math.abs(max) * 0.0001, 0.00000001);
      const chartX = x + 54;
      const chartY = bodyY + 107;
      const chartWidth = 644;
      const chartHeight = 90;
      const path = points.map((point, index) => {
        const px = chartX + chartWidth * index / Math.max(1, points.length - 1);
        const py = chartY + chartHeight - ((point.priceUsd - min) / span) * chartHeight;
        return `${index === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
      }).join(" ");
      return [
        text(x + 44, bodyY - 6, "ЦЕНА ЗА 7 ДНЕЙ · USD", 19, MUTED, 700),
        text(x + 44, bodyY + 43, `${money(market.lowPriceUsd7d)}  →  ${money(market.highPriceUsd7d)}`, 27, TEXT, 700),
        `<path d="M ${chartX} ${chartY + chartHeight / 2}H ${chartX + chartWidth} M ${chartX} ${chartY}H ${chartX + chartWidth}" stroke="#D8E2EE" stroke-opacity=".12" stroke-width="2"/>`,
        `<path d="${path}" fill="none" stroke="#72E6D3" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
        text(x + 44, bodyY + 226, `Текущая ${money(market.currentPriceUsd)} · история, не прогноз`, 18, MUTED),
      ].join("");
    }
    case "STAT_CARD": {
      const launchDate = research?.genesisDate;
      return [
        text(x + 42, bodyY - 4, "ОДИН ПОДТВЕРЖДЁННЫЙ ФАКТ", 20, MUTED, 700),
        launchDate
          ? text(x + 42, bodyY + 76, launchDate, 54, ACCENT, 800)
          : text(x + 42, bodyY + 70, "Дата запуска не получена", 33, MUTED, 700),
        text(x + 42, bodyY + 126, launchDate ? "Поле даты генезиса CoinGecko" : "Дата не предполагалась и не добавлена", 20, MUTED),
      ].join("");
    }
    case "TIMELINE": {
      const launch = research?.genesisDate;
      const leftLabel = launch ?? "Нет даты запуска";
      const rightLabel = new Date(market.dataAsOf).toISOString().slice(0, 10);
      return [
        `<path d="M ${x + 92} ${bodyY + 84}H ${x + 668}" stroke="#72E6D3" stroke-width="5" stroke-opacity=".78"/>`,
        `<circle cx="${x + 104}" cy="${bodyY + 84}" r="13" fill="${ACCENT}"/><circle cx="${x + 654}" cy="${bodyY + 84}" r="13" fill="#72E6D3"/>`,
        text(x + 104, bodyY + 34, "ЗАПУСК", 18, MUTED, 700, "middle"),
        text(x + 104, bodyY + 133, leftLabel, 22, launch ? TEXT : MUTED, 700, "middle"),
        text(x + 654, bodyY + 34, "РЫНОЧНЫЙ СРЕЗ", 18, MUTED, 700, "middle"),
        text(x + 654, bodyY + 133, rightLabel, 22, TEXT, 700, "middle"),
        text(x + 42, bodyY + 204, "Нет данных об истории — дата не оценивалась", 18, MUTED),
      ].join("");
    }
    case "COMPARISON": {
      const rows = [
        { symbol: market.coin.symbol, value: market.changePercent7d, color: valueColor },
        { symbol: "BTC", value: market.benchmarks[0].changePercent7d, color: "#F0C84B" },
        { symbol: "ETH", value: market.benchmarks[1].changePercent7d, color: "#8DA8FF" },
      ];
      return [
        text(x + 42, bodyY - 6, "ИЗМЕНЕНИЕ ЗА 7 ДНЕЙ · ОДИНАКОВЫЙ ПЕРИОД", 19, MUTED, 700),
        ...rows.map((row, index) => {
          const rowY = bodyY + 40 + index * 51;
          return `<g>
            <rect x="${x + 40}" y="${rowY - 27}" width="678" height="39" rx="10" fill="#152337" fill-opacity="${index === 0 ? ".95" : ".55"}"/>
            ${text(x + 64, rowY, row.symbol, 21, TEXT, 700)}
            ${text(x + 674, rowY, percent(row.value), 22, row.color, 800, "end")}
          </g>`;
        }),
        text(x + 42, bodyY + 222, "CoinGecko · сравнение прошлого периода, не прогноз", 17, MUTED),
      ].join("");
    }
    case "NEWS_CARD":
      return [
        text(x + 42, bodyY - 4, "РЕДАКЦИОННЫЙ МАКЕТ", 20, MUTED, 700),
        text(x + 42, bodyY + 58, "Рыночный срез DOGE", 34, TEXT, 800),
        text(x + 42, bodyY + 108, "Только иллюстративный формат", 23, ACCENT, 700),
        text(x + 42, bodyY + 151, "Реальное событие или заявление не сообщается", 19, MUTED),
      ].join("");
    case "UI_TERMINAL":
      return [
        text(x + 42, bodyY - 4, "ВЫМЫШЛЕННЫЙ ТОРГОВЫЙ ЭКРАН", 20, MUTED, 700),
        `<rect x="${x + 40}" y="${bodyY + 20}" width="678" height="128" rx="16" fill="#101E2D" stroke="#72E6D3" stroke-opacity=".34"/>`,
        text(x + 66, bodyY + 62, `ПАРА  ${market.coin.symbol}/USD`, 24, TEXT, 700),
        text(x + 66, bodyY + 103, "НЕТ СТАКАНА · НЕТ ИСПОЛНЯЕМЫХ КОТИРОВОК", 18, ACCENT, 700),
        text(x + 42, bodyY + 185, "Рыночные значения показаны только в карточках с источником", 18, MUTED),
      ].join("");
    case "ILLUSTRATION":
      return [
        text(x + 42, bodyY - 4, "ПОЯСНИТЕЛЬНАЯ СХЕМА", 20, MUTED, 700),
        ...[
          { label: "ИСТОЧНИК", px: x + 146 },
          { label: market.coin.symbol, px: x + 380 },
          { label: "USD", px: x + 614 },
        ].map((item, index) => `<g>
          <rect x="${item.px - 84}" y="${bodyY + 34}" width="168" height="86" rx="18" fill="#132337" stroke="${index === 1 ? ACCENT : "#72E6D3"}" stroke-opacity=".56"/>
          ${text(item.px, bodyY + 86, item.label, 20, TEXT, 700, "middle")}
        </g>`),
        `<path d="M ${x + 238} ${bodyY + 77}H ${x + 276} M ${x + 472} ${bodyY + 77}H ${x + 510}" stroke="#72E6D3" stroke-width="4"/>`,
        text(x + 42, bodyY + 171, "Иллюстрация · не данные блокчейна в реальном времени", 18, MUTED),
      ].join("");
    case "ICON_CLUSTER":
      return [
        text(x + 42, bodyY - 4, "ТРИ ПРОВЕРКИ ПЕРЕД РЕШЕНИЕМ", 20, MUTED, 700),
        ...[
          { label: "ЦЕНА", value: money(market.currentPriceUsd), color: TEXT },
          { label: "ИЗМЕНЕНИЕ 7Д", value: percent(market.changePercent7d), color: valueColor },
          { label: "РИСК", value: "ВОЗМОЖНЫ УБЫТКИ", color: "#FF9B8F" },
        ].map((item, index) => {
          const cellX = x + 40 + index * 228;
          return `<g>
            <circle cx="${cellX + 90}" cy="${bodyY + 51}" r="31" fill="#17283A" stroke="${item.color}" stroke-opacity=".65" stroke-width="3"/>
            <path d="M ${cellX + 76} ${bodyY + 51}l10 10 19 -22" fill="none" stroke="${item.color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
            ${text(cellX + 90, bodyY + 111, item.label, 16, MUTED, 700, "middle")}
            ${text(cellX + 90, bodyY + 146, item.value, 18, item.color, 700, "middle")}
          </g>`;
        }),
        text(x + 42, bodyY + 206, "Данные CoinGecko · риск здесь не оценивается численно", 17, MUTED),
      ].join("");
    case "QUOTE":
      return [
        text(x + 42, bodyY + 14, "ОГОВОРКА ИЗ СЦЕНАРИЯ", 19, MUTED, 700),
        text(x + 42, bodyY + 78, "«Прошлая недельная динамика", 28, TEXT, 700),
        text(x + 42, bodyY + 122, "не гарантирует будущего результата»", 28, TEXT, 700),
        text(x + 42, bodyY + 185, "Текст сценария · не инвестиционная рекомендация", 18, ACCENT, 700),
      ].join("");
    case "FULLSCREEN_IMPACT":
      return [
        text(x + CARD_WIDTH / 2, bodyY + 10, "РЫНОЧНЫЙ РИСК", 20, MUTED, 700, "middle"),
        text(x + CARD_WIDTH / 2, bodyY + 82, "ВОЛАТИЛЬНОСТЬ", 44, ACCENT, 800, "middle"),
        text(x + CARD_WIDTH / 2, bodyY + 132, "МОЖЕТ ПРИВЕСТИ К УБЫТКАМ", 34, TEXT, 800, "middle"),
        text(x + CARD_WIDTH / 2, bodyY + 191, "БЕЗ ПРОГНОЗА ДОХОДНОСТИ", 19, MUTED, 700, "middle"),
      ].join("");
    default:
      throw new Error(
        `The legacy card overlay cannot render semantic V1.1 scene type "${event.visualType}".`,
      );
  }
}

export function buildPremiumDynamicFinanceV1_1OverlaySvg(input: {
  event: PremiumDynamicFinanceV1_1VisualEvent;
  market: CoinOverviewMarketData;
  research: CoinOverviewLongResearchData | null;
}): { svg: string; logoPosition: { x: number; y: number } } {
  const { event, market, research } = input;
  if (event.visualType === "FULLSCREEN_IMPACT") {
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
        <rect x="58" y="48" width="1804" height="984" rx="42" fill="#07101D" fill-opacity=".28" stroke="#F0C84B" stroke-opacity=".82" stroke-width="3"/>
        <rect x="58" y="48" width="1804" height="10" rx="5" fill="#F0C84B"/>
        <circle cx="166" cy="144" r="48" fill="#FFF9E9"/>
        ${text(238, 132, `${market.coin.name} · ${market.coin.symbol}`, 26, TEXT, 700)}
        ${text(238, 170, "РИСК · БЕЗ ПРОГНОЗА ДОХОДНОСТИ", 19, ACCENT, 700)}
        <path d="M 132 232H 1788" stroke="#D8E2EE" stroke-opacity=".2" stroke-width="2"/>
        ${text(960, 436, "ВОЛАТИЛЬНОСТЬ", 84, ACCENT, 800, "middle")}
        ${text(960, 528, "МОЖЕТ ПРИВЕСТИ К УБЫТКАМ", 52, TEXT, 800, "middle")}
        <path d="M 510 586H 1410" stroke="#F0C84B" stroke-opacity=".72" stroke-width="4"/>
        ${text(960, 646, "ДАННЫЕ НЕ ЯВЛЯЮТСЯ ПРОГНОЗОМ", 26, MUTED, 700, "middle")}
        ${text(130, 988, `Источник данных: ${market.sourceLabel} · ${dateLabel(market.dataAsOf)}`, 19, MUTED)}
      </svg>`,
      logoPosition: { x: 122, y: 100 },
    };
  }
  const { x, y } = cardPosition(event);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${commonHeader(event, market, x, y)}
    ${visualBody(event, market, research, x, y)}
    ${commonFooter(event, market, x, y)}
  </svg>`;
  return {
    svg,
    logoPosition: { x: x + 38, y: y + 30 },
  };
}

export async function renderPremiumDynamicFinanceV1_1OverlayFrames(input: {
  events: PremiumDynamicFinanceV1_1VisualEvent[];
  market: CoinOverviewMarketData;
  research: CoinOverviewLongResearchData | null;
  logoDataUri: string;
  tempDir: string;
}): Promise<string[]> {
  const logoMatch = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/u.exec(input.logoDataUri);
  if (!logoMatch) throw new Error("Dogecoin logo did not have a supported image data URI");
  const logoPath = join(input.tempDir, `dogecoin-logo.${logoMatch[1] === "jpeg" ? "jpg" : logoMatch[1]}`);
  await writeFile(logoPath, Buffer.from(logoMatch[2]!, "base64"));
  const logoBadgePath = join(input.tempDir, "dogecoin-logo-badge.png");
  await execFileAsync("magick", [
    logoPath,
    "-resize", "88x88!",
    logoBadgePath,
  ], { maxBuffer: 10 * 1024 * 1024 });

  const frames: string[] = [];
  for (const [index, event] of input.events.entries()) {
    const number = String(index + 1).padStart(2, "0");
    const svgPath = join(input.tempDir, `v1-1-overlay-${number}.svg`);
    const pngPath = join(input.tempDir, `v1-1-overlay-${number}.png`);
    const withLogoPath = join(input.tempDir, `v1-1-overlay-${number}-logo.png`);
    const { svg, logoPosition } = buildPremiumDynamicFinanceV1_1OverlaySvg({
      event,
      market: input.market,
      research: input.research,
    });
    await writeFile(svgPath, svg, "utf8");
    await execFileAsync("magick", [
      "-background", "none",
      "-density", "96",
      svgPath,
      "-resize", `${WIDTH}x${HEIGHT}!`,
      pngPath,
    ], { maxBuffer: 10 * 1024 * 1024 });
    await execFileAsync("magick", [
      pngPath,
      logoBadgePath,
      "-gravity", "northwest",
      "-geometry", `+${logoPosition.x}+${logoPosition.y}`,
      "-compose", "over",
      "-composite",
      withLogoPath,
    ], { maxBuffer: 10 * 1024 * 1024 });
    await copyFile(withLogoPath, pngPath);
    frames.push(pngPath);
  }
  return frames;
}