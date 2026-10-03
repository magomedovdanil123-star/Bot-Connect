import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type {
  PremiumDynamicFinanceV1_1VisualEvent,
  PremiumDynamicFinanceV1_1VisualPlan,
} from "./premium-dynamic-finance-v1-1-visual-director";

const execFileAsync = promisify(execFile);
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;
const SCENE_DURATION_SECONDS = 12;
const PHASE_COUNT = 8;
const CROSSFADE_SECONDS = 0.18;

type MarketSnapshot = NonNullable<PremiumDynamicFinanceV1_1VisualPlan["marketSnapshot"]>;

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function text(
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#F6F4ED",
  weight = 700,
  anchor = "start",
  opacity = 1,
): string {
  return `<text x="${x}" y="${y}" fill="${color}" fill-opacity="${opacity}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${xml(value)}</text>`;
}

function wrapText(value: string, limit: number): string[] {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > limit) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function factualNumber(event: PremiumDynamicFinanceV1_1VisualEvent, key: string): number | null {
  const value = event.factualData[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function factualString(event: PremiumDynamicFinanceV1_1VisualEvent, key: string): string {
  const value = event.factualData[key];
  return typeof value === "string" ? value : "";
}

function dollars(value: number, digits = 4): string {
  return `$${new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: digits,
  }).format(value)}`;
}

function compactDollars(value: number): string {
  return `$${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function percent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function dateOnly(value: string): string {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("ru-RU", {
      timeZone: "UTC",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(parsed)
    : value;
}

function captionSvg(event: PremiumDynamicFinanceV1_1VisualEvent): string {
  if (event.visualType === "FULLSCREEN_IMPACT") return "";
  const lines = wrapText(event.text, 49);
  const visibleLines = lines.slice(0, 3);
  const lineHeight = 45;
  const startY = 970 - (visibleLines.length - 1) * lineHeight;
  const captions = visibleLines.map((line, index) =>
    text(112, startY + index * lineHeight, line, 34, "#F6F4ED", 600),
  ).join("");
  return `<defs>
      <linearGradient id="captionFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#05090F" stop-opacity="0"/>
        <stop offset=".28" stop-color="#05090F" stop-opacity=".68"/>
        <stop offset="1" stop-color="#05090F" stop-opacity=".96"/>
      </linearGradient>
    </defs>
    <rect x="0" y="794" width="${WIDTH}" height="286" fill="url(#captionFade)"/>
    ${captions}`;
}

function logoSvg(logoDataUri: string | undefined, x: number, y: number, size: number): string {
  if (!logoDataUri || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/u.test(logoDataUri)) {
    return `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="#F0B90B"/>
      ${text(x + size / 2, y + size * .63, "DOGE", size * .25, "#201809", 800, "middle")}`;
  }
  return `<image href="${logoDataUri}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid meet"/>`;
}

function sceneArt(input: {
  event: PremiumDynamicFinanceV1_1VisualEvent;
  snapshot: MarketSnapshot;
  dataAsOf: string;
  phase: number;
  logoDataUri?: string;
}): string {
  const { event, snapshot, dataAsOf, phase, logoDataUri } = input;
  const p = phase / (PHASE_COUNT - 1);
  switch (event.visualType) {
    case "HISTORY_DOCUMENTARY": {
      const lineCount = 11 + phase * 3;
      const textLines = Array.from({ length: lineCount }, (_, index) => {
        const y = 178 + (index % 18) * 30;
        const x = index % 2 === 0 ? 164 : 1_130;
        const width = 390 + ((index * 97) % 280);
        return `<rect x="${x}" y="${y}" width="${width}" height="5" rx="2" fill="#554F41" fill-opacity=".${String(10 + (index % 4) * 3)}"/>`;
      }).join("");
      const timelineX = 260 + p * 290;
      return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#D9CFB6"/>
        <path d="M0 80H1920M0 1020H1920" stroke="#9C8F73" stroke-opacity=".38" stroke-width="2"/>
        <g transform="rotate(-2.2 960 540)">
          <rect x="92" y="82" width="1736" height="876" fill="#EFE7D4"/>
          <path d="M92 164H1828" stroke="#24231F" stroke-width="3"/>
          ${text(156, 145, "DOGECOIN · РЕДАКЦИОННАЯ РЕКОНСТРУКЦИЯ", 26, "#24231F", 800)}
          ${textLines}
          <path d="M${timelineX} 655H1626" stroke="#25251F" stroke-width="7"/>
          <circle cx="${timelineX}" cy="655" r="22" fill="#C59B38"/>
          <circle cx="1626" cy="655" r="22" fill="#C59B38"/>
          ${text(timelineX, 711, "ПРОИСХОЖДЕНИЕ", 21, "#413D31", 700, "middle")}
          ${text(1626, 711, "РЫНОЧНЫЙ СРЕЗ", 21, "#413D31", 700, "middle")}
          <g transform="translate(944 468) scale(${.82 + p * .18}) translate(-944 -468)">
            ${logoSvg(logoDataUri, 820, 344, 248)}
          </g>
          ${text(944, 633, "DOGE", 35, "#24231F", 800, "middle")}
          ${text(960, 768, "НЕ АРХИВ · НЕПОДТВЕРЖДЁННЫЕ ДАТЫ ПРОПУЩЕНЫ", 22, "#6A614E", 700, "middle")}
        </g>
        <path d="M${1_160 + p * 520} 900l240 -180" stroke="#E9D9A8" stroke-width="18" stroke-opacity=".84"/>
        ${text(111, 76, "01 / HISTORY", 19, "#514A3B", 800)}`;
    }
    case "PRICE_MOVEMENT": {
      const low = snapshot.lowPriceUsd7d;
      const high = snapshot.highPriceUsd7d;
      const min = Math.min(low, high);
      const span = Math.max(high - low, Math.abs(high) * .001);
      const yFor = (value: number) => 700 - ((value - min) / span) * 450;
      const startX = 265;
      const endX = 1_636;
      const startY = yFor(snapshot.periodStartPriceUsd);
      const endY = yFor(snapshot.currentPriceUsd);
      const drawX = startX + (endX - startX) * Math.min(1, .38 + p * .62);
      const drawY = startY + (endY - startY) * ((drawX - startX) / (endX - startX));
      return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#07111C"/>
        <rect x="120" y="110" width="1680" height="690" fill="url(#chartGrid)"/>
        <path d="M220 250H1715M220 475H1715M220 700H1715" stroke="#728094" stroke-opacity=".2" stroke-width="2"/>
        <path d="M220 205V730M1715 205V730" stroke="#8B9AAE" stroke-opacity=".55" stroke-width="3"/>
        <path d="M220 ${yFor(high)}H1715M220 ${yFor(low)}H1715" stroke="#5A6A7D" stroke-opacity=".55" stroke-dasharray="8 14" stroke-width="2"/>
        <path d="M${startX} ${startY}L${drawX} ${drawY}" fill="none" stroke="#69E3CC" stroke-width="12" stroke-linecap="round"/>
        <circle cx="${startX}" cy="${startY}" r="17" fill="#F1BD55"/>
        <circle cx="${drawX}" cy="${drawY}" r="22" fill="#69E3CC"/>
        ${text(124, 122, "DOGE · 7 ДНЕЙ", 25, "#69E3CC", 800)}
        ${text(1764, yFor(high) - 14, dollars(high), 21, "#9EADBE", 600, "end")}
        ${text(1764, yFor(low) + 34, dollars(low), 21, "#9EADBE", 600, "end")}
        ${text(startX, startY + 56, `НАЧАЛО · ${dollars(snapshot.periodStartPriceUsd)}`, 22, "#F1BD55", 700)}
        ${text(endX, endY - 38, `СРЕЗ · ${dollars(snapshot.currentPriceUsd)}`, 23, "#69E3CC", 700, "end")}
        ${text(960, 760, `${percent(snapshot.changePercent7d)} · две крайние точки, без реконструкции промежуточного пути`, 24, "#D6DFE9", 600, "middle")}
        ${text(1790, 93, dateOnly(dataAsOf), 18, "#91A0B3", 600, "end")}
        ${text(1790, 122, "COINGECKO", 16, "#91A0B3", 700, "end")}
        ${text(111, 76, "02 / PRICE", 19, "#A4B3C4", 800)}`;
    }
    case "MARKET_GROWTH":
    case "MARKET_DROP": {
      const isGrowth = event.visualType === "MARKET_GROWTH";
      const start = factualNumber(event, "moveStartPriceUsd");
      const end = factualNumber(event, "moveEndPriceUsd");
      const change = factualNumber(event, "moveChangePercent");
      const startAt = factualString(event, "moveStartAt");
      const endAt = factualString(event, "moveEndAt");
      const accent = isGrowth ? "#8DE0A6" : "#F17D78";
      const startX = 286;
      const endX = 1_640;
      const startY = isGrowth ? 730 : 290;
      const endY = isGrowth ? 285 : 730;
      const drawX = startX + (endX - startX) * p;
      const drawY = startY + (endY - startY) * p;
      const moveName = isGrowth ? "ВОСХОДЯЩИЙ ОТРЕЗОК" : "НИСХОДЯЩИЙ ОТРЕЗОК";
      const titleY = isGrowth ? 170 : 170;
      return `<rect width="${WIDTH}" height="${HEIGHT}" fill="${isGrowth ? "#081916" : "#1A0C14"}"/>
        <path d="M160 190H1760M160 540H1760M160 890H1760" stroke="${accent}" stroke-opacity=".14" stroke-width="2"/>
        <path d="M240 155V900M1680 155V900" stroke="${accent}" stroke-opacity=".22" stroke-width="2"/>
        <path d="M${startX} ${startY}L${drawX} ${drawY}" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
        ${p > .2 ? `<circle cx="${startX}" cy="${startY}" r="25" fill="#F6F4ED"/>` : ""}
        <circle cx="${drawX}" cy="${drawY}" r="30" fill="${accent}"/>
        <path d="M${drawX - 56} ${drawY}H${drawX + 56}" stroke="#F6F4ED" stroke-width="3" stroke-opacity=".68"/>
        ${text(186, titleY, moveName, 32, accent, 800)}
        ${text(186, 242, `DOGE · ${startAt} → ${endAt}`, 24, "#E3E8EA", 600)}
        ${start !== null ? text(startX, startY + (isGrowth ? 40 : -34), `${startAt} · ${dollars(start)}`, 23, "#F6F4ED", 700) : ""}
        ${end !== null ? text(endX, endY + (isGrowth ? -42 : 40), `${endAt} · ${dollars(end)}`, 23, "#F6F4ED", 700, "end") : ""}
        ${change !== null ? text(960, 410, percent(change), 84, accent, 800, "middle") : ""}
        ${text(960, 462, "COINGECKO · ФАКТИЧЕСКИЕ КРАЙНИЕ ТОЧКИ · ПРОШЛЫЙ ПЕРИОД", 22, "#E3E8EA", 700, "middle")}
        <path d="M${1_440 + p * 260} 205l180 -110" stroke="${accent}" stroke-width="6" stroke-opacity=".78"/>
        ${text(111, 76, isGrowth ? "03 / GROWTH" : "04 / DECLINE", 19, "#AAB6C4", 800)}`;
    }
    case "FULLSCREEN_STAT": {
      const value = factualNumber(event, "marketCapUsd");
      const shownValue = value === null ? dollars(snapshot.currentPriceUsd) : compactDollars(value);
      const metric = value === null ? "ЦЕНА · USD" : "РЫНОЧНАЯ КАПИТАЛИЗАЦИЯ";
      return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#12110C"/>
        <circle cx="${1_340 - p * 250}" cy="510" r="${470 + phase * 16}" fill="none" stroke="#E9B64E" stroke-opacity=".14" stroke-width="3"/>
        <circle cx="${1_340 - p * 250}" cy="510" r="${350 + phase * 12}" fill="none" stroke="#E9B64E" stroke-opacity=".22" stroke-width="2"/>
        <path d="M0 820L680 150L910 150L240 820Z" fill="#E9B64E" fill-opacity=".05"/>
        ${text(960, 280, metric, 32, "#E9B64E", 800, "middle")}
        ${text(960, 520, shownValue, 150, "#F6F4ED", 800, "middle")}
        ${text(960, 602, value === null ? "USD" : "USD · РАЗМЕР РЫНКА, НЕ ЦЕНА МОНЕТЫ", 26, "#D7D0BC", 700, "middle")}
        ${text(960, 750, `COINGECKO · СНИМОК ${dateOnly(dataAsOf)}`, 24, "#A7A08E", 700, "middle")}
        <circle cx="${380 + p * 1_080}" cy="870" r="18" fill="#E9B64E"/>
        ${text(111, 76, "05 / MARKET CAP", 19, "#C6B98F", 800)}`;
    }
    case "COIN_COMPARISON": {
      const dogeChange = factualNumber(event, "dogeChangePercent7d");
      const btcChange = factualNumber(event, "btcChangePercent7d");
      const ethChange = factualNumber(event, "ethChangePercent7d");
      if (dogeChange === null || btcChange === null || ethChange === null) {
        throw new Error("The reviewed comparison scene is missing a saved asset return");
      }
      const rows = [
        { label: "DOGE", name: "DOGECOIN", value: dogeChange, color: "#E9B64E" },
        { label: "BTC", name: "BITCOIN", value: btcChange, color: "#F7931A" },
        { label: "ETH", name: "ETHEREUM", value: ethChange, color: "#9AA8FF" },
      ];
      const rowSvg = rows.map((row, index) => {
        const y = 330 + index * 175;
        const width = Math.abs(row.value) * 92 * p;
        const x = row.value < 0 ? 960 - width : 960;
        return `<g>
          <path d="M960 ${y - 56}V${y + 42}" stroke="#E4E8EC" stroke-opacity=".18" stroke-width="2"/>
          <rect x="${x}" y="${y - 37}" width="${Math.max(3, width)}" height="72" fill="${row.color}" fill-opacity=".88"/>
          ${text(210, y + 12, row.label, 44, row.color, 800)}
          ${text(340, y + 12, row.name, 25, "#E6E7E3", 700)}
          ${text(1_710, y + 12, percent(row.value), 37, row.color, 800, "end")}
        </g>`;
      }).join("");
      return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#11141D"/>
        <path d="M0 0H960V1080H0Z" fill="#E9B64E" fill-opacity=".055"/>
        <path d="M960 0H1920V1080H960Z" fill="#8FA7FF" fill-opacity=".045"/>
        <path d="M960 205V850" stroke="#F2F2EC" stroke-opacity=".42" stroke-width="3"/>
        ${text(960, 138, "COINGECKO · ОДИНАКОВЫЙ ИНТЕРВАЛ · 7 ДНЕЙ", 28, "#D7DCE5", 700, "middle")}
        ${rowSvg}
        ${text(960, 770, "ИЗМЕНЕНИЕ ЦЕНЫ · ПРОШЛЫЙ ПЕРИОД, НЕ ПРОГНОЗ", 22, "#AFB8C5", 700, "middle")}
        <path d="M${730 - p * 240} 980H${1_190 + p * 240}" stroke="#E9B64E" stroke-width="4"/>
        ${text(111, 76, "06 / COMPARISON", 19, "#AAB6C4", 800)}`;
    }
    case "NEWS_EDITORIAL": {
      const rows = Array.from({ length: 23 }, (_, index) => {
        const y = 280 + (index % 12) * 39;
        const x = index % 2 === 0 ? 190 : 1_110;
        const width = 420 + ((index * 83) % 340);
        return `<rect x="${x}" y="${y}" width="${width}" height="6" rx="3" fill="#292824" fill-opacity=".${String(12 + (index % 5) * 4)}"/>`;
      }).join("");
      return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#DAD2BF"/>
        <g transform="rotate(${(p - .5) * 2} 960 540)">
          <rect x="88" y="78" width="1744" height="906" fill="#F0EBDD"/>
          <path d="M142 178H1778" stroke="#24231F" stroke-width="5"/>
          ${text(160, 150, "РЕДАКЦИОННАЯ ПОЛОСА", 27, "#282722", 800)}
          <path d="M155 228H1765" stroke="#3D3B34" stroke-width="2"/>
          ${text(170, 254, "МАКЕТ · НЕ РЕАЛЬНАЯ НОВОСТЬ", 31, "#9C3B36", 800)}
          ${text(170, 385, "РЫНОЧНЫЙ", 84, "#22221F", 800)}
          ${text(170, 483, "ФОРМАТ", 84, "#22221F", 800)}
          ${rows}
          <path d="M900 525V854" stroke="#8B8068" stroke-width="3"/>
          ${text(960, 770, "СОБЫТИЕ ИЛИ ЗАЯВЛЕНИЕ НЕ СООБЩАЕТСЯ", 21, "#4B493F", 700, "middle")}
        </g>
        <path d="M${1_400 + p * 260} 0L${1_050 + p * 220} 1080" stroke="#B9AD93" stroke-opacity=".48" stroke-width="12"/>
        ${text(111, 76, "07 / EDITORIAL", 19, "#514B3D", 800)}`;
    }
    case "COMMUNITY": {
      const nodes = [
        [390, 300], [650, 215], [960, 270], [1_310, 210],
        [1_560, 370], [1_390, 620], [1_080, 710], [690, 650],
        [370, 570], [820, 430], [1_140, 455], [590, 445],
      ] as const;
      const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0], [0, 9], [1, 11], [2, 9], [3, 10], [4, 10], [6, 10], [7, 9], [8, 11], [9, 10], [11, 9]] as const;
      const visibleEdges = Math.ceil(edges.length * p);
      const edgeSvg = edges.slice(0, visibleEdges).map(([a, b], index) =>
        `<path d="M${nodes[a]![0]} ${nodes[a]![1]}L${nodes[b]![0]} ${nodes[b]![1]}" stroke="${index % 3 === 0 ? "#E9B64E" : "#65D4C4"}" stroke-opacity=".42" stroke-width="4"/>`,
      ).join("");
      const visibleNodes = Math.max(4, Math.ceil(nodes.length * p));
      const nodeSvg = nodes.slice(0, visibleNodes).map(([x, y], index) =>
        `<g><circle cx="${x}" cy="${y}" r="${index === 9 ? 86 : 39 + (index % 3) * 6}" fill="${index === 9 ? "#E9B64E" : "#111C2B"}" fill-opacity="${index === 9 ? ".95" : ".92"}" stroke="${index % 2 ? "#65D4C4" : "#E9B64E"}" stroke-width="4"/>
          ${index === 9 ? text(x, y + 13, "DOGE", 30, "#141A1D", 800, "middle") : `<circle cx="${x}" cy="${y - 4}" r="9" fill="#E6EBEC"/><path d="M${x - 18} ${y + 19}q18 -22 36 0" fill="none" stroke="#E6EBEC" stroke-width="6" stroke-linecap="round"/>`}
        </g>`,
      ).join("");
      return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0B1220"/>
        <circle cx="960" cy="470" r="${240 + phase * 17}" fill="none" stroke="#4FC4B7" stroke-opacity=".13" stroke-width="3"/>
        <circle cx="960" cy="470" r="${340 + phase * 13}" fill="none" stroke="#E9B64E" stroke-opacity=".1" stroke-width="2"/>
        ${edgeSvg}${nodeSvg}
        ${text(960, 154, "СВЯЗИ И ОБЩИЕ ИДЕИ", 29, "#DDE5E8", 700, "middle")}
        ${text(960, 760, "ИЛЛЮСТРАЦИЯ · БЕЗ СЧЁТЧИКОВ И ФЕЙКОВЫХ ПОСТОВ", 21, "#AAB7C4", 700, "middle")}
        <path d="M${950 + p * 430} 840q145 80 265 4" fill="none" stroke="#E9B64E" stroke-width="5"/>
        ${text(111, 76, "08 / COMMUNITY", 19, "#AAB6C4", 800)}`;
    }
    case "BLOCKCHAIN_NETWORK": {
      const points = [
        [240, 350], [520, 215], [785, 390], [1_085, 240],
        [1_430, 355], [1_650, 590], [1_280, 730], [900, 680], [525, 720],
      ] as const;
      const links = [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3], [2, 7], [3, 4], [3, 6], [4, 5], [4, 6], [5, 6], [6, 7], [7, 8], [2, 8], [0, 8]] as const;
      const lineCount = Math.ceil(links.length * p);
      const connectionSvg = links.slice(0, lineCount).map(([a, b], index) =>
        `<path d="M${points[a]![0]} ${points[a]![1]}L${points[b]![0]} ${points[b]![1]}" fill="none" stroke="${index % 2 ? "#76A9FF" : "#62D7C1"}" stroke-opacity=".68" stroke-width="5" stroke-dasharray="12 12"/>`,
      ).join("");
      const nodeSvg = points.map(([x, y], index) =>
        `<g><circle cx="${x}" cy="${y}" r="${index === 2 ? 50 : 31}" fill="#0A1D2A" stroke="${index === 2 ? "#E9B64E" : "#62D7C1"}" stroke-width="5"/>
          <circle cx="${x}" cy="${y}" r="9" fill="${index === 2 ? "#E9B64E" : "#A5D5FF"}"/>
        </g>`,
      ).join("");
      const packetT = p;
      const packetX = 240 + (1_085 - 240) * packetT;
      const packetY = 350 + (240 - 350) * packetT;
      return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#061625"/>
        <path d="M0 0H1920V1080H0Z" fill="url(#networkGlow)"/>
        <path d="M112 170H1808M112 875H1808" stroke="#71A5D9" stroke-opacity=".16" stroke-width="2"/>
        ${connectionSvg}${nodeSvg}
        <circle cx="${packetX}" cy="${packetY}" r="20" fill="#F7C961"/>
        <circle cx="${packetX}" cy="${packetY}" r="36" fill="none" stroke="#F7C961" stroke-opacity=".56" stroke-width="3"/>
        ${text(960, 144, "УЗЛЫ · СВЯЗИ · ПОТОК ДАННЫХ", 29, "#DFE9F1", 700, "middle")}
        ${text(960, 770, "СХЕМА · НЕ LIVE-ТРАНЗАКЦИИ", 22, "#E9C761", 800, "middle")}
        ${text(111, 76, "09 / NETWORK", 19, "#AAB6C4", 800)}`;
    }
    case "FULLSCREEN_IMPACT": {
      const mainAlpha = Math.min(1, .25 + p * 1.1);
      const scale = 1.08 - p * .08;
      return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#05080C"/>
        <circle cx="960" cy="540" r="${360 + phase * 38}" fill="none" stroke="#E9B64E" stroke-opacity="${.08 + p * .08}" stroke-width="3"/>
        <path d="M80 270H${220 + phase * 190}" stroke="#E9B64E" stroke-width="7"/>
        <path d="M${1_840 - phase * 170} 800H1840" stroke="#65D4C4" stroke-width="7"/>
        <g transform="translate(960 515) scale(${scale}) translate(-960 -515)" opacity="${mainAlpha}">
          ${text(960, 340, "ГРАФИК ПОКАЗЫВАЕТ", 62, "#AEB9C4", 700, "middle")}
          ${text(960, 495, "ЧТО БЫЛО.", 126, "#F6F4ED", 800, "middle")}
          ${text(960, 645, "НЕ ЧТО БУДЕТ.", 112, "#E9B64E", 800, "middle")}
        </g>
        ${text(960, 790, "РИСК  ·  ИСТОЧНИК  ·  ВРЕМЕННОЙ ГОРИЗОНТ", 26, "#C7D0D7", 700, "middle")}
        ${text(960, 914, "ПРОШЛЫЕ ДАННЫЕ НЕ ЯВЛЯЮТСЯ ПРОГНОЗОМ", 19, "#7F8B96", 600, "middle")}
        <circle cx="${1_540 + p * 220}" cy="220" r="14" fill="#E9B64E"/>
        ${text(111, 76, "10 / CONCLUSION", 19, "#AAB6C4", 800)}`;
    }
    default:
      throw new Error(`No full-scene V1.1 renderer for ${event.visualType}`);
  }
}

export function buildPremiumDynamicFinanceV1_1SceneSvg(input: {
  plan: PremiumDynamicFinanceV1_1VisualPlan;
  event: PremiumDynamicFinanceV1_1VisualEvent;
  phase: number;
  logoDataUri?: string;
}): string {
  const { plan, event } = input;
  const phase = Math.max(0, Math.min(PHASE_COUNT - 1, Math.round(input.phase)));
  const art = sceneArt({
    event,
    snapshot: plan.marketSnapshot!,
    dataAsOf: plan.dataAsOf,
    phase,
    logoDataUri: input.logoDataUri,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <pattern id="chartGrid" width="96" height="96" patternUnits="userSpaceOnUse">
        <path d="M96 0H0V96" fill="none" stroke="#B9C6D5" stroke-opacity=".11" stroke-width="1.5"/>
      </pattern>
      <radialGradient id="networkGlow">
        <stop offset="0" stop-color="#1A4F62" stop-opacity=".38"/>
        <stop offset="1" stop-color="#061625" stop-opacity="0"/>
      </radialGradient>
    </defs>
    ${art}
    ${captionSvg(event)}
  </svg>`;
}

function validatePlan(plan: PremiumDynamicFinanceV1_1VisualPlan): void {
  const requiredTypes = [
    "HISTORY_DOCUMENTARY",
    "PRICE_MOVEMENT",
    "MARKET_GROWTH",
    "MARKET_DROP",
    "FULLSCREEN_STAT",
    "COIN_COMPARISON",
    "NEWS_EDITORIAL",
    "COMMUNITY",
    "BLOCKCHAIN_NETWORK",
    "FULLSCREEN_IMPACT",
  ];
  if (plan.mode !== "PLAN_ONLY" || plan.durationMs !== 120_000 || plan.events.length !== 10) {
    throw new Error("V1.1 renderer requires the reviewed 10-scene, 120-second plan");
  }
  const actualTypes = plan.events.map((event) => event.visualType);
  if (requiredTypes.some((type) => !actualTypes.includes(type as typeof actualTypes[number]))) {
    throw new Error("V1.1 plan does not have the reviewed semantic scene coverage");
  }
  if (!plan.marketSnapshot) {
    throw new Error("V1.1 plan has no saved market snapshot; refusing to fetch new figures during render");
  }
  for (let index = 0; index < plan.events.length; index += 1) {
    const event = plan.events[index]!;
    if (event.startMs !== index * 12_000 || event.endMs !== (index + 1) * 12_000) {
      throw new Error(`V1.1 scene ${event.sceneId} has an unexpected timeline boundary`);
    }
  }
}

async function probeMedia(filePath: string): Promise<{
  durationSeconds: number;
  streams: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
  }>;
}> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,r_frame_rate",
    "-of", "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{
      codec_type?: string;
      codec_name?: string;
      width?: number;
      height?: number;
      r_frame_rate?: string;
    }>;
  };
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    streams: parsed.streams ?? [],
  };
}

async function createMusicTrack(input: {
  sourcePath: string;
  outputPath: string;
  durationSeconds: number;
}): Promise<void> {
  await access(input.sourcePath);
  const probe = await probeMedia(input.sourcePath);
  const audioStream = probe.streams.find((stream) => stream.codec_type === "audio");
  if (!audioStream || probe.durationSeconds < 5) {
    throw new Error(`Music bed is missing or too short: ${input.sourcePath}`);
  }
  const loopCount = Math.ceil(input.durationSeconds / (probe.durationSeconds - 1));
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y"];
  for (let index = 0; index < loopCount; index += 1) {
    args.push("-i", input.sourcePath);
  }
  const filters: string[] = [];
  for (let index = 0; index < loopCount; index += 1) {
    filters.push(
      `[${index}:a]atrim=duration=${probe.durationSeconds.toFixed(6)},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=0.24[m${index}]`,
    );
  }
  let previous = "m0";
  for (let index = 1; index < loopCount; index += 1) {
    const next = `mix${index}`;
    filters.push(`[${previous}][m${index}]acrossfade=d=1.0:c1=tri:c2=tri[${next}]`);
    previous = next;
  }
  filters.push(
    `[${previous}]atrim=duration=${input.durationSeconds},asetpts=PTS-STARTPTS,afade=t=out:st=${Math.max(0, input.durationSeconds - 2.5)}:d=2.5[music]`,
  );
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[music]",
    "-t", String(input.durationSeconds),
    "-c:a", "aac",
    "-b:a", "192k",
    "-movflags", "+faststart",
    input.outputPath,
  );
  await execFileAsync("ffmpeg", args, { maxBuffer: 16 * 1024 * 1024 });
}

async function renderSceneClip(input: {
  plan: PremiumDynamicFinanceV1_1VisualPlan;
  event: PremiumDynamicFinanceV1_1VisualEvent;
  sceneIndex: number;
  tempDir: string;
  logoDataUri?: string;
}): Promise<string> {
  const baseLength =
    (SCENE_DURATION_SECONDS + (PHASE_COUNT - 1) * CROSSFADE_SECONDS) / PHASE_COUNT;
  const framePaths: string[] = [];
  for (let phase = 0; phase < PHASE_COUNT; phase += 1) {
    const frameName = `scene-${String(input.sceneIndex + 1).padStart(2, "0")}-phase-${phase + 1}.png`;
    const svgPath = join(input.tempDir, frameName.replace(/\.png$/u, ".svg"));
    const pngPath = join(input.tempDir, frameName);
    const svg = buildPremiumDynamicFinanceV1_1SceneSvg({
      plan: input.plan,
      event: input.event,
      phase,
      logoDataUri: input.logoDataUri,
    });
    await writeFile(svgPath, svg, "utf8");
    await execFileAsync("magick", [
      "-background", "#05080C",
      "-density", "96",
      svgPath,
      "-resize", `${WIDTH}x${HEIGHT}!`,
      "-alpha", "remove",
      pngPath,
    ], { maxBuffer: 16 * 1024 * 1024 });
    framePaths.push(pngPath);
  }

  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y"];
  for (const framePath of framePaths) {
    args.push(
      "-f", "image2",
      "-loop", "1",
      "-framerate", String(FPS),
      "-t", baseLength.toFixed(6),
      "-i", framePath,
    );
  }
  const filters: string[] = [];
  for (let index = 0; index < framePaths.length; index += 1) {
    filters.push(
      `[${index}:v]zoompan=z='min(zoom+0.00042,1.022)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS},trim=duration=${baseLength.toFixed(6)},setpts=PTS-STARTPTS,settb=expr=1/${FPS},setsar=1,format=yuv420p[v${index}]`,
    );
  }
  let previous = "v0";
  for (let index = 1; index < framePaths.length; index += 1) {
    const output = index === framePaths.length - 1 ? "sceneout" : `xf${index}`;
    const offset = index * (baseLength - CROSSFADE_SECONDS);
    filters.push(
      `[${previous}][v${index}]xfade=transition=fade:duration=${CROSSFADE_SECONDS}:offset=${offset.toFixed(6)}[${output}]`,
    );
    previous = output;
  }
  filters.push(`[${previous}]trim=duration=${SCENE_DURATION_SECONDS},setpts=PTS-STARTPTS,fps=${FPS},format=yuv420p[final]`);
  const clipPath = join(
    input.tempDir,
    `scene-${String(input.sceneIndex + 1).padStart(2, "0")}.mp4`,
  );
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[final]",
    "-an",
    "-frames:v", String(SCENE_DURATION_SECONDS * FPS),
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-movflags", "+faststart",
    clipPath,
  );
  await execFileAsync("ffmpeg", args, { maxBuffer: 24 * 1024 * 1024 });
  return clipPath;
}

export async function renderPremiumDynamicFinanceV1_1FullSceneVideo(input: {
  plan: PremiumDynamicFinanceV1_1VisualPlan;
  outputPath: string;
  planPath?: string;
  musicPath?: string;
  logoDataUri?: string;
}): Promise<{
  outputPath: string;
  reportPath: string;
  durationMs: number;
  bytes: number;
  sourceSnapshot: MarketSnapshot;
}> {
  validatePlan(input.plan);
  const outputPath = resolve(input.outputPath);
  const reportPath = outputPath.replace(/\.mp4$/iu, ".report.md");
  if (outputPath === reportPath) throw new Error("V1.1 output path must end in .mp4");
  try {
    await access(outputPath);
    throw new Error(`Refusing to overwrite existing V1.1 render: ${outputPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
  }
  try {
    await access(reportPath);
    throw new Error(`Refusing to overwrite existing V1.1 report: ${reportPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
  }

  const musicPath = resolve(input.musicPath ?? "assets/audio/financial-user-music-bed.mp3");
  const tempDir = await mkdtemp(join(tmpdir(), "premium-finance-v1-1-full-scene-"));
  const musicOutput = join(tempDir, "music-120s.m4a");
  const concatList = join(tempDir, "scenes.txt");
  const videoOnlyPath = join(tempDir, "semantic-scenes.mp4");
  const finalPath = join(tempDir, "dogecoin-semantic.mp4");
  const clipPaths: string[] = [];
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    for (const [sceneIndex, event] of input.plan.events.entries()) {
      clipPaths.push(await renderSceneClip({
        plan: input.plan,
        event,
        sceneIndex,
        tempDir,
        logoDataUri: input.logoDataUri,
      }));
      console.log(JSON.stringify({
        render: "premium-dynamic-finance-v1-1-full-scene",
        scene: sceneIndex + 1,
        scenes: input.plan.events.length,
        visualType: event.visualType,
        background: event.backgroundKey,
        status: "complete",
      }));
    }
    await writeFile(
      concatList,
      clipPaths.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"),
      "utf8",
    );
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-f", "concat", "-safe", "0", "-i", concatList,
      "-an", "-c:v", "copy", "-movflags", "+faststart",
      videoOnlyPath,
    ], { maxBuffer: 16 * 1024 * 1024 });
    await createMusicTrack({
      sourcePath: musicPath,
      outputPath: musicOutput,
      durationSeconds: input.plan.durationMs / 1_000,
    });
    await execFileAsync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y",
      "-i", videoOnlyPath,
      "-i", musicOutput,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-t", String(input.plan.durationMs / 1_000),
      "-c:v", "copy",
      "-c:a", "copy",
      "-movflags", "+faststart",
      finalPath,
    ], { maxBuffer: 16 * 1024 * 1024 });

    const probe = await probeMedia(finalPath);
    const video = probe.streams.find((stream) => stream.codec_type === "video");
    const audio = probe.streams.find((stream) => stream.codec_type === "audio");
    if (
      video?.codec_name !== "h264"
      || video.width !== WIDTH
      || video.height !== HEIGHT
      || video.r_frame_rate !== `${FPS}/1`
      || audio?.codec_name !== "aac"
      || Math.abs(probe.durationSeconds * 1_000 - input.plan.durationMs) > 1_000
    ) {
      throw new Error("Full-scene render failed 1920×1080, 30 FPS, audio, or 120-second validation");
    }
    const videoBytes = (await stat(finalPath)).size;
    await copyFile(finalPath, outputPath, constants.COPYFILE_EXCL);
    const report = `# Premium Dynamic Finance V1.1 — Dogecoin full-scene render

- Mode: isolated visual-diversity experiment
- Plan: ${basename(input.planPath ?? "premium-dynamic-finance-v1-1-dogecoin.visual-plan.json")}
- Duration: ${Math.round(probe.durationSeconds * 1_000)} ms
- Video: ${video?.codec_name}, ${video.width}×${video.height}, ${video.r_frame_rate} fps
- Audio: ${audio?.codec_name}; instrumental bed only, no generated voiceover
- Market snapshot: ${input.plan.dataAsOf}
- Source: ${input.plan.dataSource.label} — ${input.plan.dataSource.url}
- Music bed: ${basename(musicPath)}; repetitions joined with 1-second crossfades
- Composition: ten full-scene vector treatments, eight evolving visual phases per scene, distinct backgrounds
- Scene render: ${basename(outputPath)}

Telegram, production routing, and the active production renderer were not invoked or changed.
`;
    await writeFile(reportPath, report, { encoding: "utf8", flag: "wx" });
    return {
      outputPath,
      reportPath,
      durationMs: Math.round(probe.durationSeconds * 1_000),
      bytes: videoBytes,
      sourceSnapshot: input.plan.marketSnapshot!,
    };
  } catch (error) {
    throw new Error(
      `Premium Dynamic Finance V1.1 full-scene render failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}