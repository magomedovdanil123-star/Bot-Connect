import { execFile } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  buildCoinOverviewLongMotionGraphics,
  type CoinOverviewLongBeat,
} from "./coin-overview-long-edit";
import {
  buildCoinOverviewLongScribeCaptions,
  type CoinOverviewLongTimedWord,
} from "./coin-overview-long-captions";
import type { LongformVisualBeat } from "./longform-visual-director";
import {
  buildPremiumDynamicFinanceV1_1SemanticMotionFilters,
  buildPremiumDynamicFinanceV1_1SemanticVisualSvg,
} from "./premium-dynamic-finance-v1-1-semantic-visuals";
import type { PremiumDynamicFinanceV1_1SemanticEvent } from "./premium-dynamic-finance-v1-1-semantic-director";
import {
  buildLongformKineticSubtitleAss,
  type KineticSubtitleEmphasisEvent,
  type KineticSubtitleWord,
} from "./longform-kinetic-subtitles";
import {
  buildPremiumFinanceV2KineticAss,
  buildPremiumFinanceV2ProductionSceneSvg,
  buildPremiumFinanceV2SubtitleEmphasisEvents,
  type PremiumFinanceV2ProductionResearchContext,
  type PremiumFinanceV2ProductionVisualEvent,
  type PremiumFinanceV2ProductionMarket,
} from "./premium-dynamic-finance-v2-cinematic-visuals";
import type { CoinOverviewMarketData } from "../coin-overview-data";

const execFileAsync = promisify(execFile);
const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

const PALETTES = [
  { accent: "#72E6D3", second: "#53A5FF", glow: "#0A6A79" },
  { accent: "#FFD27A", second: "#72E6D3", glow: "#85512A" },
  { accent: "#8DA8FF", second: "#FF806F", glow: "#314F9F" },
  { accent: "#FF806F", second: "#FFD27A", glow: "#7B3038" },
] as const;
const PREMIUM_FINANCE_V2_FINAL_PALETTE = {
  accent: "#F3B74C",
  second: "#72E4BE",
  glow: "#765525",
  title: "#F3EAD8",
} as const;

export type LongformVisualProfile = "PREMIUM_DYNAMIC_FINANCE_V2_FINAL" | "legacy";

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assTime(milliseconds: number): string {
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const totalSeconds = Math.floor(centiseconds / 100);
  return `${Math.floor(totalSeconds / 3600)}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}

function assText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("\n", " ");
}

function wrapText(value: string, maxCharacters: number): string[] {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function comparableText(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

function pointForComposition(beat: LongformVisualBeat): { x: number; y: number; textX: number; anchor: string } {
  const focalX = beat.focalPoint === "left" ? 0.31 : beat.focalPoint === "right" ? 0.69 : 0.5;
  const focalY = beat.focalPoint === "upper" ? 0.36 : beat.focalPoint === "lower" ? 0.64 : 0.5;
  switch (beat.composition) {
    case "left-heavy":
      return { x: 1370, y: Math.round(HEIGHT * focalY), textX: 235, anchor: "start" };
    case "right-heavy":
      return { x: 550, y: Math.round(HEIGHT * focalY), textX: 1685, anchor: "end" };
    case "high":
      return { x: Math.round(WIDTH * focalX), y: 340, textX: WIDTH / 2, anchor: "middle" };
    case "low":
      return { x: Math.round(WIDTH * focalX), y: 720, textX: WIDTH / 2, anchor: "middle" };
    case "split":
      return { x: 1430, y: Math.round(HEIGHT * focalY), textX: 260, anchor: "start" };
    case "diagonal":
      return {
        x: beat.index % 2 === 0 ? 1430 : 500,
        y: beat.index % 2 === 0 ? 370 : 710,
        textX: beat.index % 2 === 0 ? 260 : 1670,
        anchor: beat.index % 2 === 0 ? "start" : "end",
      };
    default:
      return { x: WIDTH / 2, y: Math.round(HEIGHT * focalY), textX: WIDTH / 2, anchor: "middle" };
  }
}

function renderNetwork(x: number, y: number, size: number, accent: string, second: string, seed: number): string {
  const points = Array.from({ length: 8 }, (_, index) => {
    const angle = Math.PI * 2 * index / 8 + seed * 0.13;
    const radius = size * (index % 3 === 0 ? 0.38 : 0.49);
    return {
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
      r: index === 0 ? 14 : 8,
    };
  });
  const edges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [0, 4], [1, 5], [2, 6]] as const;
  const lines = edges.map(([from, to], index) => {
    const start = points[from]!;
    const end = points[to]!;
    return `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${index % 3 === 0 ? second : accent}" stroke-opacity="${index % 3 === 0 ? 0.62 : 0.34}" stroke-width="${index % 3 === 0 ? 3 : 2}"/>`;
  }).join("");
  const nodes = points.map((point, index) =>
    `<circle cx="${point.x}" cy="${point.y}" r="${point.r + 10}" fill="none" stroke="${index === 0 ? second : accent}" stroke-opacity=".22" stroke-width="2"/><circle cx="${point.x}" cy="${point.y}" r="${point.r}" fill="${index === 0 ? second : accent}" filter="url(#glow)"/>`,
  ).join("");
  return `<g transform="translate(${x} ${y})">${lines}${nodes}<circle r="${size * 0.27}" fill="url(#core)" opacity=".8"/></g>`;
}

function renderChart(x: number, y: number, size: number, accent: string, second: string, seed: number): string {
  const points = Array.from({ length: 8 }, (_, index) => {
    const px = -size * 0.47 + size * 0.94 * index / 7;
    const wave = Math.sin(index * 1.7 + seed) * size * 0.095
      + Math.cos(index * 0.8 + seed * 0.6) * size * 0.055;
    return `${px.toFixed(1)},${wave.toFixed(1)}`;
  });
  return `<g transform="translate(${x} ${y})">
    <rect x="${-size * 0.52}" y="${-size * 0.32}" width="${size * 1.04}" height="${size * 0.64}" rx="28" fill="#121A27" fill-opacity=".75" stroke="#DCE7F4" stroke-opacity=".18"/>
    ${[1, 2, 3].map((row) => `<line x1="${-size * 0.45}" y1="${-size * 0.22 + row * size * 0.11}" x2="${size * 0.45}" y2="${-size * 0.22 + row * size * 0.11}" stroke="#DCE7F4" stroke-opacity=".09" stroke-width="2"/>`).join("")}
    <polyline points="${points.join(" ")}" transform="translate(0 0)" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
    <circle cx="${size * 0.47}" cy="${Number(points.at(-1)?.split(",")[1] || 0)}" r="12" fill="${second}"/>
  </g>`;
}

function renderTimeline(x: number, y: number, size: number, accent: string, second: string, seed: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${seed % 2 ? 8 : -8})">
    <path d="M ${-size * 0.48} 0 C ${-size * 0.22} ${-size * 0.23}, ${size * 0.18} ${size * 0.23}, ${size * 0.48} 0" fill="none" stroke="${accent}" stroke-width="5" stroke-opacity=".8"/>
    ${[-0.42, -0.14, 0.15, 0.43].map((fraction, index) => `<g transform="translate(${size * fraction} ${Math.sin(index * 2.1 + seed) * size * 0.11})"><circle r="${index === 3 ? 24 : 16}" fill="${index === 3 ? second : accent}" fill-opacity=".18" stroke="${index === 3 ? second : accent}" stroke-width="4"/><circle r="5" fill="#F5F7FA"/></g>`).join("")}
    <circle r="${size * 0.24}" fill="none" stroke="${second}" stroke-opacity=".22" stroke-width="2"/>
  </g>`;
}

function renderInterface(x: number, y: number, size: number, accent: string, second: string, seed: number): string {
  const width = size * 0.98;
  const height = size * 0.64;
  return `<g transform="translate(${x} ${y}) rotate(${seed % 2 ? -7 : 7})">
    <rect x="${-width / 2}" y="${-height / 2}" width="${width}" height="${height}" rx="26" fill="#111A28" fill-opacity=".88" stroke="#E8F0FA" stroke-opacity=".28" stroke-width="2"/>
    <path d="M ${-width / 2} ${-height / 2 + 58} H ${width / 2}" stroke="#E8F0FA" stroke-opacity=".16" stroke-width="2"/>
    <circle cx="${-width / 2 + 28}" cy="${-height / 2 + 28}" r="6" fill="${second}"/>
    <circle cx="${-width / 2 + 50}" cy="${-height / 2 + 28}" r="6" fill="${accent}" opacity=".7"/>
    <rect x="${-width / 2 + 28}" y="${-height / 2 + 82}" width="${width * 0.33}" height="${height * 0.62}" rx="14" fill="#1B293A" stroke="${accent}" stroke-opacity=".36"/>
    <rect x="${-width / 2 + width * 0.4}" y="${-height / 2 + 82}" width="${width * 0.53}" height="${height * 0.24}" rx="12" fill="#1B293A" stroke="${second}" stroke-opacity=".3"/>
    <rect x="${-width / 2 + width * 0.4}" y="${-height / 2 + height * 0.47}" width="${width * 0.53}" height="${height * 0.31}" rx="12" fill="#1B293A" stroke="#E8F0FA" stroke-opacity=".18"/>
    ${Array.from({ length: 5 }, (_, index) => `<rect x="${-width / 2 + 48}" y="${-height / 2 + 108 + index * 29}" width="${width * (0.2 + (index % 3) * 0.025)}" height="5" rx="2.5" fill="${index === seed % 5 ? second : accent}" fill-opacity="${index === seed % 5 ? 0.8 : 0.3}"/>`).join("")}
  </g>`;
}

function renderHeroObject(x: number, y: number, size: number, accent: string, second: string, seed: number): string {
  const rotation = seed % 2 === 0 ? -11 : 11;
  return `<g transform="translate(${x} ${y}) rotate(${rotation})">
    <ellipse cx="0" cy="${size * 0.39}" rx="${size * 0.43}" ry="${size * 0.12}" fill="${accent}" opacity=".14" filter="url(#softGlow)"/>
    <path d="M 0 ${-size * 0.48} L ${size * 0.32} ${-size * 0.24} L ${size * 0.38} ${size * 0.2} L 0 ${size * 0.48} L ${-size * 0.36} ${size * 0.18} L ${-size * 0.3} ${-size * 0.24} Z" fill="url(#objectFill)" stroke="${accent}" stroke-width="3"/>
    <path d="M 0 ${-size * 0.48} L ${size * 0.32} ${-size * 0.24} L 0 ${-size * 0.08} L ${-size * 0.3} ${-size * 0.24} Z" fill="${second}" fill-opacity=".48"/>
    <path d="M 0 ${-size * 0.08} L ${size * 0.32} ${-size * 0.24} L ${size * 0.38} ${size * 0.2} L 0 ${size * 0.48} Z" fill="${accent}" fill-opacity=".3"/>
    <path d="M 0 ${-size * 0.08} L ${-size * 0.3} ${-size * 0.24} L ${-size * 0.36} ${size * 0.18} L 0 ${size * 0.48} Z" fill="#EAF5FF" fill-opacity=".08"/>
    <path d="M ${-size * 0.22} ${-size * 0.03} L 0 ${-size * 0.18} L ${size * 0.21} ${-size * 0.02}" fill="none" stroke="#F6F7FA" stroke-opacity=".72" stroke-width="3"/>
    <path d="M ${-size * 0.12} ${size * 0.15} L 0 ${size * 0.23} L ${size * 0.13} ${size * 0.14}" fill="none" stroke="${second}" stroke-width="4"/>
  </g>`;
}

function renderProcess(x: number, y: number, size: number, accent: string, second: string, seed: number): string {
  const nodes = Array.from({ length: 4 }, (_, index) => ({
    x: -size * 0.4 + index * size * 0.265,
    y: Math.sin(index * 1.4 + seed) * size * 0.15,
  }));
  const lines = nodes.slice(0, -1).map((point, index) => {
    const next = nodes[index + 1]!;
    return `<path d="M ${point.x} ${point.y} C ${point.x + size * 0.1} ${point.y - size * 0.25}, ${next.x - size * 0.1} ${next.y + size * 0.25}, ${next.x} ${next.y}" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" marker-end="url(#arrow)"/>`;
  }).join("");
  const circles = nodes.map((point, index) =>
    `<g transform="translate(${point.x} ${point.y})"><circle r="${size * 0.1}" fill="#111A28" stroke="${index === 3 ? second : accent}" stroke-width="4"/><circle r="${size * 0.035}" fill="${index === 3 ? second : accent}"/></g>`,
  ).join("");
  return `<g transform="translate(${x} ${y})">${lines}${circles}</g>`;
}

function renderSplit(x: number, y: number, size: number, accent: string, second: string, seed: number): string {
  const gap = size * 0.075;
  const cardWidth = size * 0.43;
  const cardHeight = size * 0.55;
  return `<g transform="translate(${x} ${y}) rotate(${seed % 2 ? 5 : -5})">
    <rect x="${-gap / 2 - cardWidth}" y="${-cardHeight / 2}" width="${cardWidth}" height="${cardHeight}" rx="24" fill="#111A28" stroke="${accent}" stroke-width="3"/>
    <rect x="${gap / 2}" y="${-cardHeight / 2}" width="${cardWidth}" height="${cardHeight}" rx="24" fill="#111A28" stroke="${second}" stroke-width="3"/>
    <path d="M ${-cardWidth + 20} 0 H ${-gap / 2 - 28}" stroke="${accent}" stroke-width="8" stroke-linecap="round"/>
    <path d="M ${gap / 2 + 28} 0 H ${cardWidth - 20}" stroke="${second}" stroke-width="8" stroke-linecap="round"/>
    <circle r="${size * 0.07}" fill="#09101A" stroke="#F5F7FA" stroke-width="3"/>
    <path d="M -12 -18 L 10 0 L -12 18" fill="none" stroke="#F5F7FA" stroke-width="4"/>
    ${Array.from({ length: 3 }, (_, row) => `<rect x="${-cardWidth + 28}" y="${-cardHeight / 2 + 50 + row * 35}" width="${cardWidth * (0.45 + (row % 2) * 0.15)}" height="6" rx="3" fill="${accent}" fill-opacity=".6"/>`).join("")}
    ${Array.from({ length: 3 }, (_, row) => `<rect x="${gap / 2 + 28}" y="${-cardHeight / 2 + 50 + row * 35}" width="${cardWidth * (0.43 + ((row + 1) % 2) * 0.18)}" height="6" rx="3" fill="${second}" fill-opacity=".6"/>`).join("")}
  </g>`;
}

function renderForm(beat: LongformVisualBeat, x: number, y: number, size: number, accent: string, second: string): string {
  const seed = beat.index + beat.sceneId * 3;
  switch (beat.visualForm) {
    case "network-map":
      return renderNetwork(x, y, size, accent, second, seed);
    case "data-chart":
      return renderChart(x, y, size, accent, second, seed);
    case "timeline":
      return renderTimeline(x, y, size, accent, second, seed);
    case "cinematic-interface":
      return renderInterface(x, y, size, accent, second, seed);
    case "split-screen":
      return renderSplit(x, y, size, accent, second, seed);
    case "process-flow":
      return renderProcess(x, y, size, accent, second, seed);
    case "kinetic-type":
      return `<g transform="translate(${x} ${y})"><circle r="${size * 0.36}" fill="url(#halo)" opacity=".9"/><path d="M ${-size * 0.45} 0 H ${size * 0.45}" stroke="${accent}" stroke-width="3" stroke-opacity=".5"/></g>`;
    case "abstract-field":
      return `<g transform="translate(${x} ${y})">${Array.from({ length: 9 }, (_, index) => {
        const angle = (Math.PI * 2 * index) / 9 + seed;
        const radius = size * (0.18 + (index % 3) * 0.1);
        const px = Math.cos(angle) * radius;
        const py = Math.sin(angle) * radius;
        return `<path d="M ${px} ${py - size * 0.12} L ${px + size * 0.11} ${py} L ${px} ${py + size * 0.12} L ${px - size * 0.11} ${py} Z" fill="${index % 2 ? second : accent}" fill-opacity="${0.18 + (index % 3) * 0.1}" stroke="${index % 2 ? second : accent}" stroke-width="2"/>`;
      }).join("")}</g>`;
    default:
      return renderHeroObject(x, y, size, accent, second, seed);
  }
}

function formatVerifiedUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: 6,
  }).format(value);
}

function renderVerifiedMarketContext(
  beat: LongformVisualBeat,
  market: CoinOverviewMarketData | undefined,
  profile: LongformVisualProfile,
): string {
  if (profile !== "PREMIUM_DYNAMIC_FINANCE_V2_FINAL" || !market) return "";
  const isDataBeat = beat.visualForm === "data-chart";
  const trendColor = market.changePercent7d >= 0 ? "#72E4BE" : "#FF7184";
  const logo = market.coin.logoDataUri?.startsWith("data:image/")
    ? `<image href="${xml(market.coin.logoDataUri)}" x="117" y="148" width="54" height="54" preserveAspectRatio="xMidYMid meet"/>`
    : `<circle cx="144" cy="175" r="25" fill="#F3B74C" fill-opacity=".12" stroke="#F3B74C" stroke-opacity=".7"/><text x="144" y="181" text-anchor="middle" fill="#F3EAD8" font-family="DejaVu Sans,Arial,sans-serif" font-size="15" font-weight="800">${xml(market.coin.symbol.slice(0, 4).toUpperCase())}</text>`;
  const chart = isDataBeat && market.priceSamples.length >= 2
    ? (() => {
      const samples = market.priceSamples;
      const minimum = Math.min(...samples.map((sample) => sample.priceUsd));
      const maximum = Math.max(...samples.map((sample) => sample.priceUsd));
      const span = Math.max(Number.EPSILON, maximum - minimum);
      const points = samples.map((sample, index) => {
        const x = 1120 + (index / (samples.length - 1)) * 650;
        const y = 360 - ((sample.priceUsd - minimum) / span) * 125;
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(" ");
      return `<g>
        <rect x="1094" y="270" width="690" height="164" rx="24" fill="#0A1018" fill-opacity=".86" stroke="#F3B74C" stroke-opacity=".55"/>
        <path d="${points}" fill="none" stroke="${trendColor}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
        <text x="1120" y="318" fill="#F3EAD8" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="700">7-DAY SAMPLED PRICE · ${xml(market.coin.symbol.toUpperCase())}</text>
        <text x="1120" y="408" fill="#B8C1CC" font-family="DejaVu Sans,Arial,sans-serif" font-size="18">${xml(market.sourceLabel)} · ${xml(market.dataAsOf.slice(0, 16).replace("T", " "))} UTC</text>
      </g>`;
    })()
    : "";
  return `<g>
    <rect x="98" y="138" width="720" height="80" rx="20" fill="#080D15" fill-opacity=".78" stroke="#F3B74C" stroke-opacity=".38"/>
    ${logo}
    <text x="188" y="177" fill="#F3EAD8" font-family="DejaVu Sans,Arial,sans-serif" font-size="24" font-weight="800">${xml(market.coin.symbol.toUpperCase())} · ${xml(market.coin.name)}</text>
    <text x="188" y="201" fill="#BBC5CF" font-family="DejaVu Sans,Arial,sans-serif" font-size="15">VERIFIED · ${xml(market.sourceLabel)} · ${xml(market.dataAsOf.slice(0, 16).replace("T", " "))} UTC</text>
    ${isDataBeat ? `<text x="850" y="188" fill="${trendColor}" font-family="DejaVu Sans,Arial,sans-serif" font-size="20" font-weight="800">7D ${market.changePercent7d >= 0 ? "+" : ""}${market.changePercent7d.toFixed(2)}%</text>` : ""}
    ${chart}
    ${isDataBeat ? `<text x="1120" y="461" fill="#F3EAD8" font-family="DejaVu Sans,Arial,sans-serif" font-size="18">NOW $${formatVerifiedUsd(market.currentPriceUsd)} · 7D ${market.lowPriceUsd7d.toPrecision(4)}—${market.highPriceUsd7d.toPrecision(4)}</text>` : ""}
  </g>`;
}

export function buildLongformVisualSvg(
  beat: LongformVisualBeat,
  semanticEvent?: PremiumDynamicFinanceV1_1SemanticEvent,
  profile: LongformVisualProfile = "legacy",
  visualAssetDataUri?: string,
  marketData?: CoinOverviewMarketData,
  v2ProductionEvent?: PremiumFinanceV2ProductionVisualEvent,
  v2ResearchContext?: PremiumFinanceV2ProductionResearchContext,
): string {
  if (profile === "PREMIUM_DYNAMIC_FINANCE_V2_FINAL" && v2ProductionEvent) {
    return buildPremiumFinanceV2ProductionSceneSvg({
      event: v2ProductionEvent,
      ...(marketData ? { market: marketData as PremiumFinanceV2ProductionMarket } : {}),
      ...(v2ResearchContext ? { researchContext: v2ResearchContext } : {}),
      ...(visualAssetDataUri ? { visualAssetDataUri } : {}),
      phase: 0.68,
    });
  }
  const palette = profile === "PREMIUM_DYNAMIC_FINANCE_V2_FINAL"
    ? PREMIUM_FINANCE_V2_FINAL_PALETTE
    : { ...PALETTES[beat.index % PALETTES.length]!, title: "#F3F6FA" };
  const composition = pointForComposition(beat);
  const size = beat.visualForm === "cinematic-interface" ? 600 : beat.visualForm === "kinetic-type" ? 510 : 470;
  const titleLines = wrapText(beat.kineticText, 22);
  const titleFontSize = Math.min(220, Math.max(78, Math.floor(980 / Math.max(1, ...titleLines.map((line) => line.length)) * 1.26)));
  const lineHeight = Math.round(titleFontSize * 1.03);
  const titleY = titleLines.length === 1
    ? 570
    : 520 - Math.round((titleLines.length - 1) * lineHeight / 2);
  const textSvg = titleLines.length
    ? `<g text-anchor="${composition.anchor}" font-family="DejaVu Sans,Arial,sans-serif" font-weight="800" letter-spacing="-7">
        <text x="${composition.textX + 7}" y="${titleY + 9}" fill="${palette.accent}" opacity=".28" font-size="${titleFontSize}">${titleLines.map((line, index) => `<tspan x="${composition.textX + 7}" dy="${index === 0 ? 0 : lineHeight}">${xml(line.toLocaleUpperCase("ru-RU"))}</tspan>`).join("")}</text>
        <text x="${composition.textX}" y="${titleY}" fill="${palette.title}" stroke="${palette.title}" stroke-opacity=".15" stroke-width="1" font-size="${titleFontSize}">${titleLines.map((line, index) => `<tspan x="${composition.textX}" dy="${index === 0 ? 0 : lineHeight}">${xml(line.toLocaleUpperCase("ru-RU"))}</tspan>`).join("")}</text>
        <rect x="${composition.anchor === "start" ? composition.textX : composition.anchor === "end" ? composition.textX - 400 : composition.textX - 200}" y="${titleY + lineHeight * titleLines.length + 18}" width="400" height="6" rx="3" fill="url(#accent)"/>
      </g>`
    : "";
  const objectSize = size * (beat.composition === "split" ? 0.84 : 1);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <title>${xml(beat.visualConcept)}</title>
    <desc>${xml(beat.assetDescription)}</desc>
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#05070D"/>
        <stop offset=".47" stop-color="#0D1422"/>
        <stop offset="1" stop-color="#080B12"/>
      </linearGradient>
      <radialGradient id="halo">
        <stop offset="0" stop-color="${palette.glow}" stop-opacity=".72"/>
        <stop offset=".52" stop-color="${palette.glow}" stop-opacity=".2"/>
        <stop offset="1" stop-color="${palette.glow}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${palette.accent}" stop-opacity=".25"/>
        <stop offset=".48" stop-color="${palette.accent}"/>
        <stop offset="1" stop-color="${palette.second}" stop-opacity=".8"/>
      </linearGradient>
      <linearGradient id="objectFill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#F3F8FF" stop-opacity=".34"/>
        <stop offset=".42" stop-color="${palette.accent}" stop-opacity=".56"/>
        <stop offset="1" stop-color="#121A28" stop-opacity=".92"/>
      </linearGradient>
      <radialGradient id="core">
        <stop offset="0" stop-color="#F3F8FF" stop-opacity=".36"/>
        <stop offset="1" stop-color="${palette.accent}" stop-opacity=".04"/>
      </radialGradient>
      <pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#C9D8EE" stroke-opacity=".055" stroke-width="1"/>
      </pattern>
      <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="8" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="softGlow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur stdDeviation="26"/>
      </filter>
      <marker id="arrow" markerWidth="11" markerHeight="11" refX="8" refY="5" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 Z" fill="${palette.accent}"/>
      </marker>
      <marker id="semanticArrow" markerWidth="14" markerHeight="14" refX="11" refY="7" orient="auto">
        <path d="M 0 0 L 13 7 L 0 14 Z" fill="${palette.accent}"/>
      </marker>
    </defs>
    ${visualAssetDataUri
      ? `<image href="${xml(visualAssetDataUri)}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice"/><rect width="${WIDTH}" height="${HEIGHT}" fill="#05070D" fill-opacity=".62"/>`
      : `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>`}
    <ellipse cx="${composition.x}" cy="${composition.y}" rx="780" ry="570" fill="url(#halo)" opacity=".92"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" opacity=".56"/>
    <path d="M -80 850 C 360 620 680 1000 1120 735 S 1620 510 2050 760" fill="none" stroke="${palette.accent}" stroke-opacity=".1" stroke-width="2"/>
    <path d="M -120 930 C 280 740 660 1030 1010 840 S 1610 610 2050 850" fill="none" stroke="${palette.second}" stroke-opacity=".08" stroke-width="1"/>
    <g opacity=".75">
      <path d="M 105 114 H 430" stroke="${palette.accent}" stroke-opacity=".72" stroke-width="4"/>
      <circle cx="105" cy="114" r="7" fill="${palette.accent}"/>
      <path d="M 1490 976 H 1815" stroke="#EAF2FE" stroke-opacity=".25" stroke-width="2"/>
    </g>
    <g>${semanticEvent
      ? buildPremiumDynamicFinanceV1_1SemanticVisualSvg(semanticEvent, beat, palette.accent, palette.second)
      : renderForm(beat, composition.x, composition.y, objectSize, palette.accent, palette.second)}</g>
    ${renderVerifiedMarketContext(beat, marketData, profile)}
    ${textSvg}
    <path d="M 0 1036 C 380 986 740 1080 1120 1020 S 1590 980 1920 1030" fill="none" stroke="${palette.accent}" stroke-opacity=".24" stroke-width="2"/>
  </svg>`;
}

export function buildLongformCaptionsAss(beats: LongformVisualBeat[], durationMs: number): string {
  const dialogues = beats
    .filter((beat) =>
      beat.voiceExcerpt.trim()
      && beat.endMs > beat.startMs
      && comparableText(beat.voiceExcerpt) !== comparableText(beat.kineticText),
    )
    .map((beat) => {
      const captionLines = wrapText(beat.voiceExcerpt, 54).slice(0, 2);
      return `Dialogue: 0,${assTime(beat.startMs)},${assTime(Math.min(durationMs, beat.endMs))},Caption,,0,0,0,,{\\fad(50,70)}${captionLines.map(assText).join("\\N")}`;
    });

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${WIDTH}`,
    `PlayResY: ${HEIGHT}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Caption,DejaVu Sans,38,&H00F5F7FA,&H00F5F7FA,&H00101620,&HBE07101A,0,0,3,13,1,2,170,170,54,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogues,
    "",
  ].join("\n");
}

function transitionFilters(beat: LongformVisualBeat, durationSeconds: number): string[] {
  const filters: string[] = [];
  const accent = PALETTES[beat.index % PALETTES.length]!.accent.replace("#", "0x");
  if (beat.transition === "flash-cut") {
    filters.push("drawbox=x=0:y=0:w=iw:h=ih:color=white@0.42:t=fill:enable='lt(t,0.055)'");
  } else if (beat.transition === "glitch-cut") {
    filters.push(
      `drawbox=x='mod(t*30*174+${beat.index * 73},iw)':y=0:w=120:h=ih:color=0xff527a@0.38:t=fill:enable='lt(t,0.14)'`,
      `drawbox=x='mod(t*30*131+${beat.index * 109},iw)':y=0:w=64:h=ih:color=0x56e8ff@0.34:t=fill:enable='lt(t,0.12)'`,
    );
  } else if (beat.transition === "swipe" || beat.transition === "mask-reveal") {
    const direction = beat.index % 2 === 0 ? 1 : -1;
    filters.push(
      `drawbox=x='${direction > 0 ? "-iw+iw*min(t/0.18,1)" : "iw*min(t/0.18,1)"}':y=0:w=iw:h=ih:color=${accent}@0.22:t=fill:enable='lt(t,0.18)'`,
    );
  } else if (beat.transition === "whip-left" || beat.transition === "whip-right") {
    const reverse = beat.transition === "whip-left";
    filters.push(
      `drawbox=x='${reverse ? "iw-iw*min(t/0.16,1)" : "-iw+iw*min(t/0.16,1)"}':y=0:w=iw*0.28:h=ih:color=${accent}@0.20:t=fill:enable='lt(t,0.16)'`,
      `drawbox=x='${reverse ? "iw-iw*min(t/0.16,1)" : "-iw+iw*min(t/0.16,1)"}':y=0:w=7:h=ih:color=0xf1f7ff@0.58:t=fill:enable='lt(t,0.16)'`,
    );
  } else if (beat.transition === "snap-cut") {
    filters.push("drawbox=x=0:y=0:w=iw:h=ih:color=white@0.18:t=fill:enable='lt(t,0.035)'");
  }

  const entryAccent = accent;
  if (beat.entry === "sweep-left" || beat.entry === "sweep-right") {
    const reverse = beat.entry === "sweep-left";
    filters.push(
      `drawbox=x='${reverse ? "iw-iw*min(t/0.24,1)" : "-iw+iw*min(t/0.24,1)"}':y='ih*0.18':w='iw*0.62':h=4:color=${entryAccent}@0.8:t=fill:enable='lt(t,0.24)'`,
    );
  } else if (beat.entry === "rise") {
    filters.push(
      `drawbox=x=0:y='ih-ih*min(t/0.2,1)':w=iw:h=5:color=${entryAccent}@0.72:t=fill:enable='lt(t,0.2)'`,
    );
  } else if (beat.entry === "impact" || beat.entry === "shatter") {
    filters.push(
      `drawbox=x=0:y='ih*0.5+sin(t*30*0.8)*ih*0.02':w=iw:h=3:color=${entryAccent}@0.8:t=fill:enable='lt(t,0.12)'`,
      `drawbox=x='iw*0.5+cos(t*30*1.1)*iw*0.14':y=0:w=3:h=ih:color=0xf2f6ff@0.48:t=fill:enable='lt(t,0.08)'`,
    );
  } else if (beat.entry === "particle-burst") {
    filters.push(
      `drawbox=x='iw*0.5+sin(t*30*1.6)*iw*0.22':y='ih*0.5+cos(t*30*1.2)*ih*0.2':w=8:h=8:color=${entryAccent}@0.88:t=fill:enable='lt(t,0.4)'`,
      `drawbox=x='iw*0.5+cos(t*30*1.4)*iw*0.28':y='ih*0.5+sin(t*30*1.7)*ih*0.22':w=5:h=5:color=0xf2f6ff@0.75:t=fill:enable='lt(t,0.35)'`,
    );
  } else if (beat.entry === "unmask") {
    filters.push(
      `drawbox=x='iw*min(t/0.2,1)':y=0:w='iw*(1-min(t/0.2,1))':h=ih:color=0x080b12@0.9:t=fill:enable='lt(t,0.2)'`,
    );
  }

  const exitStart = Math.max(0, durationSeconds - 0.1).toFixed(3);
  if (beat.exit === "fade") {
    filters.push(`fade=t=out:st=${exitStart}:d=0.1`);
  } else if (beat.exit === "flash") {
    filters.push(`drawbox=x=0:y=0:w=iw:h=ih:color=white@0.28:t=fill:enable='gte(t,${exitStart})'`);
  } else if (beat.exit === "whip-left" || beat.exit === "whip-right") {
    const reverse = beat.exit === "whip-left";
    filters.push(
      `drawbox=x='${reverse ? "iw*min((t-" + exitStart + ")/0.1,1)" : "-iw*min((t-" + exitStart + ")/0.1,1)"}':y=0:w=iw:h=ih:color=${accent}@0.24:t=fill:enable='gte(t,${exitStart})'`,
    );
  } else if (beat.exit === "collapse" || beat.exit === "fold" || beat.exit === "scatter") {
    filters.push(
      `drawbox=x=0:y='ih*min((t-${exitStart})/0.1,1)':w=iw:h='ih*min((t-${exitStart})/0.1,1)':color=0x070A10@0.92:t=fill:enable='gte(t,${exitStart})'`,
    );
  }
  return filters;
}

function movementZoom(beat: LongformVisualBeat, frames: number): { zoom: string; x: string; y: string } {
  const progress = `min(on/${Math.max(1, frames - 1)},1)`;
  const centeredX = "iw/2-iw/zoom/2";
  const centeredY = "ih/2-ih/zoom/2";
  switch (beat.movement) {
    case "punch-in":
      return { zoom: `1+0.095*${progress}`, x: centeredX, y: centeredY };
    case "pull-back":
      return { zoom: `1.105-0.085*${progress}`, x: centeredX, y: centeredY };
    case "whip-left":
      return { zoom: "1.11", x: `(iw-iw/zoom)*(1-min(on/8,1))`, y: centeredY };
    case "whip-right":
      return { zoom: "1.11", x: `(iw-iw/zoom)*min(on/8,1)`, y: centeredY };
    case "orbit":
      return {
        zoom: "1.075",
        x: `${centeredX}+sin(on/17)*iw*0.018`,
        y: `${centeredY}+cos(on/23)*ih*0.015`,
      };
    case "parallax":
      return {
        zoom: `1.025+0.045*${progress}`,
        x: `${centeredX}+${progress}*iw*0.014`,
        y: `${centeredY}-${progress}*ih*0.012`,
      };
    case "overshoot":
      return {
        zoom: `if(lte(on,7),1+0.14*on/7,if(lte(on,17),1.14-0.06*(on-7)/10,1.08))`,
        x: centeredX,
        y: centeredY,
      };
    case "micro-shake":
      return {
        zoom: "1.08",
        x: `${centeredX}+if(lt(on,7),sin(on*2)*iw*0.018,0)`,
        y: `${centeredY}+if(lt(on,7),cos(on*2.7)*ih*0.014,0)`,
      };
    case "rotate":
      return {
        zoom: "1.08+0.015*sin(on/12)",
        x: `${centeredX}+sin(on/15)*iw*0.01`,
        y: `${centeredY}+cos(on/17)*ih*0.01`,
      };
    default:
      return {
        zoom: `1.04+0.045*${progress}`,
        x: centeredX,
        y: `${centeredY}-${progress}*ih*0.025`,
      };
  }
}

async function renderBeatClip(input: {
  beat: LongformVisualBeat;
  tempDir: string;
  frameCount: number;
  index: number;
  semanticVisual?: PremiumDynamicFinanceV1_1SemanticEvent;
  profile: LongformVisualProfile;
  visualAssetDataUri?: string;
  marketData?: CoinOverviewMarketData;
  v2ProductionEvent?: PremiumFinanceV2ProductionVisualEvent;
  v2ResearchContext?: PremiumFinanceV2ProductionResearchContext;
}): Promise<string> {
  const {
    beat, tempDir, frameCount, index, semanticVisual, profile,
    visualAssetDataUri, marketData, v2ProductionEvent, v2ResearchContext,
  } = input;
  const svgPath = join(tempDir, `beat-${String(index).padStart(3, "0")}.svg`);
  const pngPath = join(tempDir, `beat-${String(index).padStart(3, "0")}.png`);
  const videoPath = join(tempDir, `beat-${String(index).padStart(3, "0")}.mp4`);
  const palette = profile === "PREMIUM_DYNAMIC_FINANCE_V2_FINAL"
    ? PREMIUM_FINANCE_V2_FINAL_PALETTE
    : PALETTES[index % PALETTES.length]!;
  await writeFile(
    svgPath,
    buildLongformVisualSvg(
      beat,
      semanticVisual,
      profile,
      visualAssetDataUri,
      marketData,
      v2ProductionEvent,
      v2ResearchContext,
    ),
    "utf8",
  );
  await execFileAsync("magick", [
    "-background", "#080b12",
    "-density", "96",
    svgPath,
    "-resize", `${WIDTH}x${HEIGHT}!`,
    pngPath,
  ], { maxBuffer: 10 * 1024 * 1024 });

  const seconds = (frameCount / FPS).toFixed(3);
  const movement = movementZoom(beat, frameCount);
  const filters = [
    `zoompan=z='${movement.zoom}':x='${movement.x}':y='${movement.y}':d=1:s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
    `drawbox=x='mod(t*30*47+${index * 131},${WIDTH + 360})-180':y='${Math.round(HEIGHT * (0.13 + (index % 5) * 0.12))}':w=260:h=2:color=${palette.accent.replace("#", "0x")}@0.22:t=fill`,
    `drawbox=x='mod(t*30*23+${index * 89},${WIDTH + 140})-70':y='mod(t*30*11+${index * 47},${HEIGHT})':w=5:h=5:color=0xf2f6ff@0.38:t=fill`,
    ...(semanticVisual ? buildPremiumDynamicFinanceV1_1SemanticMotionFilters(semanticVisual) : []),
    ...transitionFilters(beat, Number(seconds)),
    "format=yuv420p",
  ].join(",");
  await execFileAsync("ffmpeg", [
    "-y",
    "-loop", "1",
    "-framerate", String(FPS),
    "-i", pngPath,
    "-vf", filters,
    "-frames:v", String(frameCount),
    "-an",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", String(FPS),
    "-g", String(FPS),
    "-keyint_min", String(FPS),
    "-sc_threshold", "0",
    "-movflags", "+faststart",
    videoPath,
  ], { maxBuffer: 15 * 1024 * 1024 });
  return videoPath;
}

async function probeVideo(filePath: string): Promise<{
  durationSeconds: number;
  streams: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string }>;
}> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_name,codec_type,width,height,r_frame_rate",
    "-of", "json",
    filePath,
  ]);
  const probe = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string }>;
  };
  return {
    durationSeconds: Number(probe.format?.duration || 0),
    streams: probe.streams ?? [],
  };
}

export async function renderLongformVisualVideo(input: {
  beats: LongformVisualBeat[];
  durationMs: number;
  sourceVideoPath?: string;
  sourceAudioPath?: string;
  outputPath: string;
  kineticSubtitleWords?: KineticSubtitleWord[];
  kineticSubtitleEmphasis?: KineticSubtitleEmphasisEvent[];
  semanticVisualEvents?: PremiumDynamicFinanceV1_1SemanticEvent[];
  premiumFinanceV2VisualEvents?: PremiumFinanceV2ProductionVisualEvent[];
  premiumFinanceV2ResearchContext?: PremiumFinanceV2ProductionResearchContext;
  premiumFinanceV2SfxEvents?: Array<{ startMs: number; kind: "impact" | "whoosh"; volume: number }>;
  profile?: LongformVisualProfile;
  visualAssets?: Array<{ sceneId: number; buffer: Buffer }>;
  marketData?: CoinOverviewMarketData;
}): Promise<{ outputPath: string; durationMs: number; beatCount: number; bytes: number }> {
  if (!input.beats.length) throw new Error("Long-form visual render requires at least one planned beat");
  const semanticByBeat = new Map<number, PremiumDynamicFinanceV1_1SemanticEvent>();
  if (input.semanticVisualEvents) {
    for (const event of input.semanticVisualEvents) {
      if (semanticByBeat.has(event.beatIndex)) {
        throw new Error(`Duplicate semantic visual event for Premium Dynamic beat ${event.beatIndex}`);
      }
      semanticByBeat.set(event.beatIndex, event);
    }
    for (const beat of input.beats) {
      const event = semanticByBeat.get(beat.index);
      if (
        !event
        || event.sceneId !== beat.sceneId
        || event.startMs !== beat.startMs
        || event.endMs !== beat.endMs
      ) {
        throw new Error(`Semantic visual event does not align with existing Premium Dynamic beat ${beat.index}`);
      }
    }
    if (semanticByBeat.size !== input.beats.length) {
      throw new Error("Semantic visual event count must match the existing Premium Dynamic edit plan");
    }
  }
  const profile = input.profile ?? "legacy";
  const v2VisualByBeat = new Map<number, PremiumFinanceV2ProductionVisualEvent>();
  if (profile === "PREMIUM_DYNAMIC_FINANCE_V2_FINAL") {
    if (!input.premiumFinanceV2VisualEvents?.length) {
      throw new Error("PREMIUM_DYNAMIC_FINANCE_V2_FINAL requires its persisted semantic visual plan; refusing legacy fallback");
    }
    for (const event of input.premiumFinanceV2VisualEvents) {
      if (v2VisualByBeat.has(event.beatIndex)) {
        throw new Error(`Duplicate V2 production visual event for beat ${event.beatIndex}`);
      }
      v2VisualByBeat.set(event.beatIndex, event);
    }
    for (const beat of input.beats) {
      const event = v2VisualByBeat.get(beat.index);
      if (!event || event.sceneId !== beat.sceneId || event.startMs !== beat.startMs || event.endMs !== beat.endMs) {
        throw new Error(`V2 production visual event does not align with edit-plan beat ${beat.index}`);
      }
    }
    if (v2VisualByBeat.size !== input.beats.length) {
      throw new Error("V2 production visual event count must match the edit plan");
    }
  }
  const durationMs = Math.round(input.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < 1_000) {
    throw new Error("Long-form visual render duration must be at least one second");
  }
  if (!input.sourceVideoPath && !input.sourceAudioPath) {
    throw new Error("Long-form visual render requires source audio");
  }
  const visualAssetsByScene = new Map<number, string>();
  for (const asset of input.visualAssets ?? []) {
    if (visualAssetsByScene.has(asset.sceneId)) continue;
    const contentType = asset.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      ? "image/png"
      : asset.buffer[0] === 0xff && asset.buffer[1] === 0xd8 && asset.buffer[2] === 0xff
        ? "image/jpeg"
        : asset.buffer.subarray(0, 4).toString("ascii") === "RIFF"
          && asset.buffer.subarray(8, 12).toString("ascii") === "WEBP"
          ? "image/webp"
          : null;
    if (!contentType) {
      throw new Error(`PREMIUM_DYNAMIC_FINANCE_V2_FINAL received an unsupported image asset for scene ${asset.sceneId}`);
    }
    visualAssetsByScene.set(asset.sceneId, `data:${contentType};base64,${asset.buffer.toString("base64")}`);
  }
  const sourceVideoPath = input.sourceVideoPath ? resolve(input.sourceVideoPath) : undefined;
  const sourceAudioPath = resolve(input.sourceAudioPath ?? input.sourceVideoPath!);
  await access(sourceAudioPath);
  if (sourceVideoPath) await access(sourceVideoPath);
  const sourceProbe = await probeVideo(sourceAudioPath);
  if (!sourceProbe.streams.some((stream) => stream.codec_type === "audio")) {
    throw new Error("Long-form visual source does not contain an audio stream");
  }
  const audioDurationToleranceMs = input.sourceAudioPath ? 500 : 0;
  if (sourceProbe.durationSeconds * 1_000 + audioDurationToleranceMs < durationMs) {
    throw new Error("Long-form visual source audio is shorter than the requested duration");
  }

  const outputPath = resolve(input.outputPath);
  try {
    await access(outputPath);
    throw new Error(`Refusing to overwrite an existing long-form pilot: ${outputPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
  }
  await mkdir(dirname(outputPath), { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "longform-visual-engine-"));
  try {
    const targetFrames = Math.round(durationMs * FPS / 1_000);
    const sortedBeats = [...input.beats].sort((left, right) => left.startMs - right.startMs);
    const beatFrameCounts = sortedBeats.map((beat, index) => {
      const startFrame = Math.round(beat.startMs * FPS / 1_000);
      const endFrame = index === sortedBeats.length - 1
        ? targetFrames
        : Math.round(beat.endMs * FPS / 1_000);
      return Math.max(1, Math.min(targetFrames - startFrame, endFrame - startFrame));
    });
    const totalFrames = beatFrameCounts.reduce((sum, count) => sum + count, 0);
    if (totalFrames !== targetFrames) {
      const delta = targetFrames - totalFrames;
      beatFrameCounts[beatFrameCounts.length - 1] = Math.max(1, beatFrameCounts.at(-1)! + delta);
    }

    const clipPaths: string[] = [];
    const scenesWithImages = new Set<number>();
    for (const [index, beat] of sortedBeats.entries()) {
      const sceneAsset = !scenesWithImages.has(beat.sceneId)
        ? visualAssetsByScene.get(beat.sceneId)
        : undefined;
      if (sceneAsset) scenesWithImages.add(beat.sceneId);
      const videoPath = await renderBeatClip({
        beat,
        tempDir,
        frameCount: beatFrameCounts[index]!,
        index,
        profile,
        ...(v2VisualByBeat.has(beat.index) ? { v2ProductionEvent: v2VisualByBeat.get(beat.index)! } : {}),
        ...(input.premiumFinanceV2ResearchContext
          ? { v2ResearchContext: input.premiumFinanceV2ResearchContext }
          : {}),
        ...(input.marketData ? { marketData: input.marketData } : {}),
        ...(sceneAsset ? { visualAssetDataUri: sceneAsset } : {}),
        ...(semanticByBeat.has(beat.index) ? { semanticVisual: semanticByBeat.get(beat.index)! } : {}),
      });
      clipPaths.push(videoPath);
      console.log(JSON.stringify({
        render: profile === "PREMIUM_DYNAMIC_FINANCE_V2_FINAL"
          ? "PREMIUM_DYNAMIC_FINANCE_V2_FINAL"
          : input.sourceAudioPath ? "premium-dynamic-finance" : "longform-visual-pilot",
        beat: index + 1,
        beats: sortedBeats.length,
        startMs: beat.startMs,
        endMs: beat.endMs,
        visualForm: beat.visualForm,
        transition: beat.transition,
      }));
    }

    const concatPath = join(tempDir, "video-parts.txt");
    const videoOnlyPath = join(tempDir, "visual-only.mp4");
    const renderedOutputPath = join(tempDir, "rendered-output.mp4");
    await writeFile(
      concatPath,
      clipPaths.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"),
      "utf8",
    );
    await execFileAsync("ffmpeg", [
      "-y", "-f", "concat", "-safe", "0", "-i", concatPath,
      "-an", "-c", "copy", "-movflags", "+faststart", videoOnlyPath,
    ], { maxBuffer: 15 * 1024 * 1024 });

    const captionsPath = join(tempDir, "captions.ass");
    let captions: string;
    if (profile === "PREMIUM_DYNAMIC_FINANCE_V2_FINAL") {
      const groupedWindows = new Map<number, PremiumFinanceV2ProductionVisualEvent[]>();
      for (const event of input.premiumFinanceV2VisualEvents ?? []) {
        const events = groupedWindows.get(event.sceneId) ?? [];
        events.push(event);
        groupedWindows.set(event.sceneId, events);
      }
      const windows = [...groupedWindows.entries()]
        .map(([sceneId, events], index) => {
          const ordered = [...events].sort((left, right) => left.startMs - right.startMs);
          return {
            sceneId: (index % 8) + 1,
            startMs: ordered[0]!.startMs,
            endMs: ordered.at(-1)!.endMs,
            narration: ordered.map((event) => event.narration).join(" "),
            semanticType: ordered[0]!.visualType,
          };
        })
        .sort((left, right) => left.startMs - right.startMs);
      if (!input.kineticSubtitleWords?.length) {
        throw new Error("PREMIUM_DYNAMIC_FINANCE_V2_FINAL requires exact Scribe word timestamps for subtitles");
      }
      const emphasis = buildPremiumFinanceV2SubtitleEmphasisEvents(
        input.kineticSubtitleWords,
        input.kineticSubtitleEmphasis ?? [],
      );
      const subtitleResult = buildPremiumFinanceV2KineticAss({
        words: input.kineticSubtitleWords,
        windows,
        emphasisEvents: emphasis,
        durationMs,
      });
      if (subtitleResult.wordCount !== input.kineticSubtitleWords.length) {
        throw new Error(
          `V2 subtitles do not cover every Scribe word: ${subtitleResult.wordCount}/${input.kineticSubtitleWords.length}`,
        );
      }
      captions = subtitleResult.ass;
    } else if (input.kineticSubtitleWords) {
      captions = buildLongformKineticSubtitleAss({
          words: input.kineticSubtitleWords,
          durationMs,
          width: WIDTH,
          height: HEIGHT,
          ...(input.kineticSubtitleEmphasis
            ? { emphasisEvents: input.kineticSubtitleEmphasis }
            : {}),
        }).ass;
    } else {
      captions = buildLongformCaptionsAss(sortedBeats, durationMs);
    }
    await writeFile(captionsPath, captions, "utf8");
    const captionFilterPath = captionsPath.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
    const sfxEvents = profile === "PREMIUM_DYNAMIC_FINANCE_V2_FINAL"
      ? [...(input.premiumFinanceV2SfxEvents ?? [])]
        .filter((event) =>
          Number.isFinite(event.startMs)
          && event.startMs >= 0
          && event.startMs < durationMs
          && Number.isFinite(event.volume)
          && (event.kind === "impact" || event.kind === "whoosh"),
        )
        .slice(0, 6)
      : [];
    const sfxInputs = sfxEvents.flatMap((event) => [
      "-f",
      "lavfi",
      "-i",
      event.kind === "impact"
        ? "aevalsrc=0.32*sin(2*PI*58*t)*exp(-t*12):s=48000:d=0.55"
        : "anoisesrc=color=white:sample_rate=48000:amplitude=0.04:duration=0.55,highpass=f=350,lowpass=f=6000,afade=t=in:st=0:d=0.04,afade=t=out:st=0.32:d=0.23",
    ]);
    const audioFilterGraph = sfxEvents.length
      ? [
          "[1:a:0]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[base]",
          ...sfxEvents.map((event, index) => {
            const delay = Math.max(0, Math.round(event.startMs));
            const volume = Math.max(0, Math.min(0.22, event.volume)).toFixed(3);
            return `[${index + 2}:a:0]volume=${volume},adelay=${delay}|${delay},aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[sfx${index}]`;
          }),
          `[base]${sfxEvents.map((_, index) => `[sfx${index}]`).join("")}amix=inputs=${sfxEvents.length + 1}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[aout]`,
        ].join(";")
      : undefined;
    console.info(JSON.stringify({
      render: profile === "PREMIUM_DYNAMIC_FINANCE_V2_FINAL" ? profile : "longform-visual",
      event: "planned-sfx-mix",
      cueCount: sfxEvents.length,
    }));
    const encodeArgs = [
      "-y",
      "-i", videoOnlyPath,
      "-i", sourceAudioPath,
      ...sfxInputs,
      ...(audioFilterGraph ? ["-filter_complex", audioFilterGraph] : []),
      "-map", "0:v:0",
      "-map", audioFilterGraph ? "[aout]" : "1:a:0",
      "-vf", `subtitles='${captionFilterPath}'`,
      "-t", (targetFrames / FPS).toFixed(3),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "17",
      "-pix_fmt", "yuv420p",
      "-r", String(FPS),
      "-c:a", input.sourceAudioPath || audioFilterGraph ? "aac" : "copy",
      ...(input.sourceAudioPath || audioFilterGraph ? ["-b:a", "192k"] : []),
      "-movflags", "+faststart",
      renderedOutputPath,
    ];
    await execFileAsync("ffmpeg", encodeArgs, { maxBuffer: 15 * 1024 * 1024 });

    const outputProbe = await probeVideo(renderedOutputPath);
    const video = outputProbe.streams.find((stream) => stream.codec_type === "video");
    const sourceAudio = sourceProbe.streams.find((stream) => stream.codec_type === "audio");
    const outputAudio = outputProbe.streams.find((stream) => stream.codec_type === "audio");
    if (
      video?.codec_name !== "h264"
      || video.width !== WIDTH
      || video.height !== HEIGHT
      || video.r_frame_rate !== `${FPS}/1`
    ) {
      throw new Error("Long-form pilot failed 1920x1080 30 FPS H.264 validation");
    }
    const expectedOutputAudioCodec = input.sourceAudioPath || audioFilterGraph ? "aac" : sourceAudio?.codec_name;
    if (!sourceAudio || outputAudio?.codec_name !== expectedOutputAudioCodec) {
      throw new Error("Long-form visual render did not preserve or encode the source audio");
    }
    const output = await readFile(renderedOutputPath);
    await copyFile(renderedOutputPath, outputPath, constants.COPYFILE_EXCL);
    return {
      outputPath,
      durationMs: Math.round(outputProbe.durationSeconds * 1_000),
      beatCount: sortedBeats.length,
      bytes: output.length,
    };
  } catch (error) {
    throw new Error(`Long-form visual render failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function renderCoinOverviewLongPumpDynamicVideo(input: {
  beats: CoinOverviewLongBeat[];
  durationMs: number;
  sourceVideoPath: string;
  outputPath: string;
  kineticSubtitleWords: CoinOverviewLongTimedWord[];
}): Promise<{ outputPath: string; durationMs: number; beatCount: number; bytes: number }> {
  if (!input.beats.length) throw new Error("Pump-dynamic render requires at least one voice-timed visual beat");
  const durationMs = Math.round(input.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < 1_000) {
    throw new Error("Pump-dynamic render duration must be at least one second");
  }

  const sourceVideoPath = resolve(input.sourceVideoPath);
  await access(sourceVideoPath);
  const sourceProbe = await probeVideo(sourceVideoPath);
  if (!sourceProbe.streams.some((stream) => stream.codec_type === "audio")) {
    throw new Error("Pump-dynamic pilot source does not contain an audio stream");
  }
  if (sourceProbe.durationSeconds * 1_000 < durationMs) {
    throw new Error("Pump-dynamic pilot source is shorter than the requested duration");
  }

  const outputPath = resolve(input.outputPath);
  if (sourceVideoPath === outputPath) {
    throw new Error("Pump-dynamic pilot output must not overwrite its source video");
  }
  try {
    await access(outputPath);
    throw new Error(`Refusing to overwrite an existing pump-dynamic pilot: ${outputPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Refusing to overwrite")) throw error;
  }

  await mkdir(dirname(outputPath), { recursive: true });
  const tempDir = await mkdtemp(join(tmpdir(), "pump-dynamic-pilot-"));
  try {
    const targetFrames = Math.round(durationMs * FPS / 1_000);
    const renderedDuration = (targetFrames / FPS).toFixed(3);
    const sortedBeats = [...input.beats].sort((left, right) => left.startMs - right.startMs);
    const captions = buildCoinOverviewLongScribeCaptions({
      words: input.kineticSubtitleWords,
      beats: sortedBeats,
      durationMs,
      width: WIDTH,
      height: HEIGHT,
      paletteMode: "pump-dynamic",
    });
    const graphics = buildCoinOverviewLongMotionGraphics({
      width: WIDTH,
      height: HEIGHT,
      beats: sortedBeats,
      chunkStartMs: 0,
      chunkEndMs: durationMs,
      paletteMode: "pump-dynamic",
    });
    const captionsPath = join(tempDir, "pump-dynamic-captions.ass");
    const graphPath = join(tempDir, "pump-dynamic-filter.txt");
    const videoOnlyPath = join(tempDir, "pump-dynamic-video.mp4");
    const renderedOutputPath = join(tempDir, "pump-dynamic-output.mp4");
    const captionFilterPath = captionsPath.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
    await writeFile(captionsPath, captions.ass, "utf8");
    await writeFile(graphPath, `[0:v]${graphics},subtitles='${captionFilterPath}'[pump_dynamic]`, "utf8");

    await execFileAsync("ffmpeg", [
      "-y",
      "-f", "lavfi",
      "-i", `color=c=0x10131b:s=${WIDTH}x${HEIGHT}:r=${FPS}:d=${renderedDuration}`,
      "-filter_complex_script", graphPath,
      "-map", "[pump_dynamic]",
      "-t", renderedDuration,
      "-an",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "17",
      "-pix_fmt", "yuv420p",
      "-r", String(FPS),
      "-movflags", "+faststart",
      videoOnlyPath,
    ], { maxBuffer: 20 * 1024 * 1024 });

    await execFileAsync("ffmpeg", [
      "-y",
      "-i", videoOnlyPath,
      "-i", sourceVideoPath,
      "-map", "0:v:0",
      "-map", "1:a:0",
      "-t", renderedDuration,
      "-c:v", "copy",
      "-c:a", "copy",
      "-movflags", "+faststart",
      renderedOutputPath,
    ], { maxBuffer: 20 * 1024 * 1024 });

    const outputProbe = await probeVideo(renderedOutputPath);
    const video = outputProbe.streams.find((stream) => stream.codec_type === "video");
    const sourceAudio = sourceProbe.streams.find((stream) => stream.codec_type === "audio");
    const outputAudio = outputProbe.streams.find((stream) => stream.codec_type === "audio");
    if (
      video?.codec_name !== "h264"
      || video.width !== WIDTH
      || video.height !== HEIGHT
      || video.r_frame_rate !== `${FPS}/1`
    ) {
      throw new Error("Pump-dynamic pilot failed 1920x1080 30 FPS H.264 validation");
    }
    if (!sourceAudio || outputAudio?.codec_name !== sourceAudio.codec_name) {
      throw new Error("Pump-dynamic pilot did not preserve the source audio codec");
    }

    const output = await readFile(renderedOutputPath);
    await copyFile(renderedOutputPath, outputPath, constants.COPYFILE_EXCL);
    return {
      outputPath,
      durationMs: Math.round(outputProbe.durationSeconds * 1_000),
      beatCount: sortedBeats.length,
      bytes: output.length,
    };
  } catch (error) {
    throw new Error(`Pump-dynamic render failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function longformPilotFileName(sourceVideoPath: string, durationMs: number): string {
  const stem = basename(sourceVideoPath).replace(/\.[^.]+$/u, "");
  return `${stem}-new-visual-${Math.round(durationMs / 1_000)}s.mp4`;
}