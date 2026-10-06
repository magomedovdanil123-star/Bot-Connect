import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  prepareSpeechText,
} from "../audio-generation/elevenlabs-client";
import { logger } from "../logger";
import type { WhaleEvent, WhaleStory, WhaleVisualPlan } from "./types";

const execFileAsync = promisify(execFile);
const WIDTH = 1080;
const HEIGHT = 1920;
const MUSIC_PATH = join(process.cwd(), "assets/audio/crypto-f2-music-bed.mp3");
const KNOWN_LOGOS: Record<string, string> = {
  BTC: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  ETH: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  SOL: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
};
const logoCache = new Map<string, string | null>();

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string, maximumCharacters: number): string[] {
  const words = value.split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maximumCharacters && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 5);
}

function svgText(
  value: string,
  x: number,
  y: number,
  options: { size?: number; fill?: string; weight?: number; anchor?: string; opacity?: number } = {},
): string {
  return `<text x="${x}" y="${y}" fill="${options.fill ?? "#F4F7FF"}" font-family="DejaVu Sans" font-size="${options.size ?? 40}" font-weight="${options.weight ?? 600}" text-anchor="${options.anchor ?? "start"}" opacity="${options.opacity ?? 1}">${xml(value)}</text>`;
}

function textLines(
  value: string,
  x: number,
  y: number,
  options: { size?: number; fill?: string; weight?: number; anchor?: string; maxCharacters?: number; lineGap?: number } = {},
): string {
  const size = options.size ?? 42;
  const lines = wrapText(value, options.maxCharacters ?? 24);
  return lines.map((line, index) => svgText(line, x, y + index * (options.lineGap ?? Math.round(size * 1.25)), {
    size,
    fill: options.fill,
    weight: options.weight,
    anchor: options.anchor,
  })).join("");
}

function amountText(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function tokenAmountText(value: number, symbol: string): string {
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${symbol}`;
}

function nansenTradeFlow(event: WhaleEvent): {
  soldLabel: string;
  boughtLabel: string;
  soldAmount: string;
  boughtAmount: string;
} {
  const raw = event.rawData && typeof event.rawData === "object"
    ? event.rawData as Record<string, unknown>
    : {};
  const soldSymbol = typeof raw["token_sold_symbol"] === "string" ? raw["token_sold_symbol"] : event.symbol;
  const boughtSymbol = typeof raw["token_bought_symbol"] === "string" ? raw["token_bought_symbol"] : event.symbol;
  const soldAmount = Number(raw["token_sold_amount"]);
  const boughtAmount = Number(raw["token_bought_amount"]);
  return {
    soldLabel: soldSymbol,
    boughtLabel: boughtSymbol,
    soldAmount: Number.isFinite(soldAmount) ? tokenAmountText(soldAmount, soldSymbol) : soldSymbol,
    boughtAmount: Number.isFinite(boughtAmount) ? tokenAmountText(boughtAmount, boughtSymbol) : tokenAmountText(event.amount, event.symbol),
  };
}

function shorten(value: string | null, left = 13, right = 10): string {
  if (!value) return "нет данных";
  return value.length <= left + right + 1 ? value : `${value.slice(0, left)}…${value.slice(-right)}`;
}

async function getLogoDataUri(symbol: string): Promise<string | null> {
  const normalized = symbol.toUpperCase();
  if (logoCache.has(normalized)) return logoCache.get(normalized) ?? null;
  const url = KNOWN_LOGOS[normalized];
  if (!url) {
    logoCache.set(normalized, null);
    return null;
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const dataUri = `data:${response.headers.get("content-type") || "image/png"};base64,${buffer.toString("base64")}`;
    logoCache.set(normalized, dataUri);
    return dataUri;
  } catch (error) {
    logger.warn({ err: error, symbol: normalized }, "[WHALE RADAR] Verified asset logo unavailable; rendering without a logo.");
    logoCache.set(normalized, null);
    return null;
  }
}

function chartSvg(event: WhaleEvent): string {
  const candles = event.marketContext?.candles ?? [];
  if (!candles.length) return "";
  const values = candles.map((candle) => candle.close);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, max * 0.002, 0.000001);
  const points = values.map((value, index) => {
    const x = 100 + (index / Math.max(1, values.length - 1)) * 760;
    const y = 520 - ((value - min) / range) * 340;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const eventTime = new Date(event.timestamp).getTime();
  const markerIndex = candles.reduce((bestIndex, candle, index) => {
    const bestDistance = Math.abs(new Date(candles[bestIndex]!.timestamp).getTime() - eventTime);
    const candidateDistance = Math.abs(new Date(candle.timestamp).getTime() - eventTime);
    return candidateDistance < bestDistance ? index : bestIndex;
  }, 0);
  const markerValue = values[markerIndex]!;
  const markerX = 100 + (markerIndex / Math.max(1, values.length - 1)) * 760;
  const markerY = 520 - ((markerValue - min) / range) * 340;
  return [
    `<rect x="66" y="155" width="948" height="520" rx="42" fill="#0D1727" stroke="#1C3049" stroke-width="2"/>`,
    `<path d="M100 200 H980 M100 360 H980 M100 520 H980" stroke="#1C3049" stroke-width="2" stroke-dasharray="8 14"/>`,
    `<polyline points="${points}" fill="none" stroke="#54E7BB" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="M${markerX.toFixed(1)} 180 V575" stroke="#F4F7FF" stroke-opacity="0.48" stroke-width="2" stroke-dasharray="7 9"/>`,
    `<circle cx="${markerX.toFixed(1)}" cy="${markerY.toFixed(1)}" r="17" fill="#07101D" stroke="#54E7BB" stroke-width="8"/>`,
    svgText(event.action, markerX, markerY - 28, { size: 19, fill: "#F4F7FF", weight: 700, anchor: "middle" }),
    svgText("OHLCV · NANSEN · 1H", 100, 725, { size: 24, fill: "#8DA1BB", weight: 500 }),
    svgText(`Цена при событии ≈ $${markerValue.toLocaleString("en-US", { maximumFractionDigits: 2 })}`, 980, 725, { size: 24, fill: "#8DA1BB", weight: 500, anchor: "end" }),
  ].join("");
}

function sceneSvg(input: {
  event: WhaleEvent;
  story: WhaleStory;
  plan: WhaleVisualPlan;
  sceneIndex: number;
  logoDataUri: string | null;
}): string {
  const { event, story, plan, sceneIndex, logoDataUri } = input;
  const scene = plan.scenes[sceneIndex]!;
  const buyColor = "#42E3B3";
  const sellColor = "#FF6475";
  const transferColor = "#A8A1FF";
  const accent = event.action === "BUY" ? buyColor : event.action === "SELL" ? sellColor : transferColor;
  const backgroundShift = (sceneIndex % 2) * 90;
  const backgroundColor = scene.kind === "MARKET"
    ? "#06191A"
    : scene.kind === "WALLET" || scene.kind === "SOURCE_PROOF"
      ? "#111024"
      : scene.kind === "ACCUMULATION" || scene.kind === "DISTRIBUTION" || scene.kind === "WALLET_HISTORY"
        ? "#0D1421"
        : scene.kind === "CTA"
          ? "#151021"
          : "#07101D";
  const brand = svgText("WHALE RADAR  /  ON-CHAIN", 78, 112, { size: 24, fill: "#98AAC4", weight: 700 });
  const progress = `<rect x="78" y="145" width="${924 * (sceneIndex + 1) / plan.scenes.length}" height="5" rx="3" fill="${accent}"/>`;
  const flow = nansenTradeFlow(event);
  const logo = logoDataUri
    ? `<image href="${logoDataUri}" x="78" y="206" width="132" height="132" preserveAspectRatio="xMidYMid meet"/>`
    : `<circle cx="144" cy="272" r="63" fill="#15253B" stroke="${accent}" stroke-width="3"/>${svgText(event.symbol.slice(0, 5), 144, 284, { size: 31, fill: accent, weight: 700, anchor: "middle" })}`;

  let illustration = "";
  if (scene.kind === "HOOK") {
    illustration = [
      `<circle cx="540" cy="350" r="154" fill="${accent}" opacity="0.08"/>`,
      logoDataUri
        ? `<image href="${logoDataUri}" x="444" y="254" width="192" height="192" preserveAspectRatio="xMidYMid meet"/>`
        : `<circle cx="540" cy="350" r="96" fill="#15253B" stroke="${accent}" stroke-width="4"/>${svgText(event.symbol.slice(0, 5), 540, 365, { size: 44, fill: accent, weight: 700, anchor: "middle" })}`,
      `<rect x="350" y="510" width="380" height="66" rx="33" fill="${accent}" opacity="0.14"/>`,
      svgText(event.action === "BUY" ? "WHALE BUY" : event.action === "SELL" ? "WHALE SELL" : "LARGE TRANSFER", 540, 554, { size: 30, fill: accent, weight: 700, anchor: "middle" }),
      svgText(amountText(event.amountUsd), 540, 730, { size: 100, fill: "#FFFFFF", weight: 700, anchor: "middle" }),
      svgText(tokenAmountText(event.amount, event.symbol), 540, 790, { size: 32, fill: "#A8B7CC", weight: 600, anchor: "middle" }),
    ].join("");
  } else if (scene.kind === "TRADE_FACT") {
    illustration = [
      `<rect x="78" y="214" width="924" height="542" rx="48" fill="#101D30" stroke="#29405B" stroke-width="2"/>`,
      `<rect x="118" y="254" width="180" height="54" rx="27" fill="${accent}" opacity="0.18"/>`,
      svgText(event.action, 208, 291, { size: 25, fill: accent, weight: 700, anchor: "middle" }),
      logo,
      svgText(event.symbol, 250, 283, { size: 48, fill: "#F4F7FF", weight: 700 }),
      svgText(amountText(event.amountUsd), 120, 480, { size: 85, fill: "#FFFFFF", weight: 700 }),
      svgText(`${event.amount.toLocaleString("en-US", { maximumFractionDigits: 4 })} ${event.symbol}`, 120, 550, { size: 32, fill: "#A8B7CC" }),
      svgText("стоимость одной операции", 120, 656, { size: 25, fill: "#8295AE" }),
    ].join("");
  } else if (scene.kind === "MONEY_FLOW") {
    const leftLabel = event.action === "TRANSFER"
      ? event.fromLabel || shorten(event.fromAddress, 10, 7)
      : flow.soldAmount;
    const rightLabel = event.action === "TRANSFER"
      ? event.toLabel || shorten(event.toAddress, 10, 7)
      : flow.boughtAmount;
    const leftAsset = event.action === "TRANSFER" ? "ОТПРАВИТЕЛЬ" : `ОТДАЛИ · ${flow.soldLabel}`;
    const rightAsset = event.action === "TRANSFER" ? "ПОЛУЧАТЕЛЬ" : `ПОЛУЧИЛИ · ${flow.boughtLabel}`;
    illustration = [
      `<rect x="64" y="244" width="390" height="378" rx="38" fill="#111E31" stroke="#31445F" stroke-width="2"/>`,
      `<rect x="626" y="244" width="390" height="378" rx="38" fill="#111E31" stroke="#31445F" stroke-width="2"/>`,
      svgText(leftAsset, 259, 312, { size: 23, fill: "#90A2BB", weight: 700, anchor: "middle" }),
      textLines(leftLabel, 259, 424, { size: 31, fill: "#F4F7FF", weight: 700, anchor: "middle", maxCharacters: 17, lineGap: 44 }),
      svgText(rightAsset, 821, 312, { size: 23, fill: "#90A2BB", weight: 700, anchor: "middle" }),
      textLines(rightLabel, 821, 424, { size: 31, fill: "#F4F7FF", weight: 700, anchor: "middle", maxCharacters: 17, lineGap: 44 }),
      `<path d="M472 424 H608" stroke="${accent}" stroke-width="12" stroke-linecap="round"/><path d="M574 386 L614 424 L574 462" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>`,
      svgText(event.action === "TRANSFER" ? tokenAmountText(event.amount, event.symbol) : "DEX SWAP", 540, 700, { size: 31, fill: accent, weight: 700, anchor: "middle" }),
      svgText(amountText(event.amountUsd), 540, 772, { size: 48, fill: "#F4F7FF", weight: 700, anchor: "middle" }),
    ].join("");
  } else if (scene.kind === "WALLET") {
    illustration = [
      `<rect x="78" y="228" width="924" height="560" rx="46" fill="#111E31" stroke="#344B68" stroke-width="2"/>`,
      `<circle cx="190" cy="361" r="55" fill="${accent}" opacity="0.16"/>`,
      svgText("◈", 190, 377, { size: 46, fill: accent, weight: 700, anchor: "middle" }),
      textLines(event.walletLabel || "Метка в Nansen недоступна", 280, 348, { size: 35, fill: "#F4F7FF", weight: 700, maxCharacters: 28 }),
      svgText("АДРЕС", 120, 520, { size: 22, fill: "#8498B3", weight: 700 }),
      textLines(shorten(event.fromAddress, 18, 14), 120, 584, { size: 33, fill: "#CAD5E5", maxCharacters: 25 }),
      svgText("КЛАССИФИКАЦИЯ", 120, 682, { size: 22, fill: "#8498B3", weight: 700 }),
      svgText(event.walletType === "smart_money" ? "Smart Money · Nansen" : "Только факты из события", 120, 735, { size: 28, fill: accent, weight: 600 }),
    ].join("");
  } else if (scene.kind === "ACCUMULATION" || scene.kind === "DISTRIBUTION" || scene.kind === "WALLET_HISTORY") {
    const action = scene.kind === "ACCUMULATION" ? "BUY" : scene.kind === "DISTRIBUTION" ? "SELL" : null;
    const history = event.previousActivity
      .filter((item) => !action || item.action === action)
      .slice(-3)
      .map((item) => ({ action: item.action, amountUsd: item.amountUsd, timestamp: item.timestamp, current: false }));
    history.push({ action: event.action, amountUsd: event.amountUsd, timestamp: event.timestamp, current: true });
    const startX = history.length === 1 ? 540 : 140;
    const step = history.length === 1 ? 0 : 800 / (history.length - 1);
    const timeline = history.map((item, index) => {
      const x = startX + step * index;
      const color = item.action === "BUY" ? buyColor : item.action === "SELL" ? sellColor : transferColor;
      const date = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(item.timestamp));
      return [
        index ? `<path d="M${(x - step).toFixed(1)} 456 H${x.toFixed(1)}" stroke="#3B506B" stroke-width="5"/>` : "",
        `<circle cx="${x.toFixed(1)}" cy="456" r="${item.current ? 25 : 18}" fill="#07101D" stroke="${color}" stroke-width="${item.current ? 8 : 5}"/>`,
        svgText(item.current ? "NOW" : item.action, x, 390, { size: 20, fill: color, weight: 700, anchor: "middle" }),
        textLines(amountText(item.amountUsd), x, 526, { size: 27, fill: "#F4F7FF", weight: 700, anchor: "middle", maxCharacters: 13, lineGap: 34 }),
        svgText(date, x, 604, { size: 20, fill: "#8295AE", weight: 500, anchor: "middle" }),
      ].join("");
    }).join("");
    const total = history.reduce((sum, item) => sum + item.amountUsd, 0);
    illustration = [
      `<rect x="64" y="250" width="952" height="476" rx="42" fill="#101D30" stroke="#29405B" stroke-width="2"/>`,
      svgText(scene.kind === "ACCUMULATION" ? "ПОДТВЕРЖДЁННЫЕ ПОКУПКИ" : scene.kind === "DISTRIBUTION" ? "ПОДТВЕРЖДЁННЫЕ ПРОДАЖИ" : "ИСТОРИЯ NANSEN", 540, 326, { size: 26, fill: "#A8B7CC", weight: 700, anchor: "middle" }),
      timeline,
      svgText(`ИТОГО В ПОКАЗАННОЙ ВЫБОРКЕ · ${amountText(total)}`, 540, 684, { size: 25, fill: accent, weight: 700, anchor: "middle" }),
    ].join("");
  } else if (scene.kind === "MARKET") {
    illustration = chartSvg(event);
  } else if (scene.kind === "SOURCE_PROOF") {
    illustration = [
      `<rect x="78" y="245" width="924" height="542" rx="46" fill="#101D30" stroke="#31445F" stroke-width="2"/>`,
      svgText("ИСТОЧНИК", 124, 328, { size: 22, fill: "#8498B3", weight: 700 }),
      svgText("Nansen · Smart Money DEX Trades", 124, 386, { size: 28, fill: "#F4F7FF", weight: 700 }),
      svgText("СЕТЬ", 124, 492, { size: 22, fill: "#8498B3", weight: 700 }),
      svgText(event.blockchain.toUpperCase(), 124, 550, { size: 32, fill: accent, weight: 700 }),
      svgText("TRANSACTION HASH", 124, 645, { size: 22, fill: "#8498B3", weight: 700 }),
      textLines(shorten(event.transactionHash, 25, 18), 124, 703, { size: 28, fill: "#E5EBF5", maxCharacters: 33 }),
    ].join("");
  } else if (scene.kind === "TAKEAWAY") {
    illustration = [
      `<rect x="78" y="278" width="924" height="440" rx="48" fill="#101D30" stroke="${accent}" stroke-opacity="0.52" stroke-width="2"/>`,
      svgText("ОН-ЧЕЙН СОБЫТИЕ", 540, 390, { size: 27, fill: accent, weight: 700, anchor: "middle" }),
      svgText("≠", 540, 522, { size: 92, fill: "#F4F7FF", weight: 700, anchor: "middle" }),
      svgText("ЦЕНА БУДУЩЕГО", 540, 638, { size: 34, fill: "#A9B8CE", weight: 600, anchor: "middle" }),
    ].join("");
  } else if (scene.kind === "CTA") {
    illustration = [
      `<circle cx="540" cy="425" r="80" fill="${accent}" opacity="0.13"/>`,
      svgText("W", 540, 456, { size: 82, fill: accent, weight: 700, anchor: "middle" }),
      textLines("Каждый день — обзор сделок китов", 540, 650, { size: 47, fill: "#F4F7FF", weight: 700, anchor: "middle", maxCharacters: 25, lineGap: 60 }),
      textLines("Ссылка на биржу — в шапке профиля", 540, 805, { size: 27, fill: "#A9B8CE", anchor: "middle", maxCharacters: 36 }),
      `<rect x="250" y="888" width="580" height="144" rx="36" fill="#54E7BB" stroke="#D6FFF4" stroke-width="3"/>`,
      `<path d="M286 900 H794" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="3"/>`,
    ].join("");
  } else {
    illustration = [
      logo,
      svgText(event.symbol, 270, 295, { size: 64, fill: "#F4F7FF", weight: 700 }),
      svgText(amountText(event.amountUsd), 78, 560, { size: 82, fill: accent, weight: 700 }),
      textLines(scene.subtitle, 78, 690, { size: 39, fill: "#E5EBF5", maxCharacters: 22, lineGap: 54 }),
    ].join("");
  }

  const titleLines = scene.kind === "CTA" ? "" : textLines(scene.title, 540, 950, {
    size: 49,
    fill: "#FFFFFF",
    weight: 700,
    anchor: "middle",
    maxCharacters: 22,
    lineGap: 58,
  });
  const subtitleLines = scene.kind === "CTA" ? "" : textLines(scene.subtitle, 540, 1120, {
    size: 31,
    fill: "#D0D9E7",
    weight: 600,
    anchor: "middle",
    maxCharacters: 32,
    lineGap: 42,
  });
  const footer = [
    svgText("ДАННЫЕ: NANSEN", 78, 1770, { size: 22, fill: "#8194AE", weight: 700 }),
    svgText(`${String(sceneIndex + 1).padStart(2, "0")} / ${String(plan.scenes.length).padStart(2, "0")}`, 1002, 1770, { size: 22, fill: "#8194AE", weight: 700, anchor: "end" }),
    `<rect x="78" y="1802" width="924" height="2" fill="#263850"/>`,
    svgText("НЕ ФИНАНСОВАЯ РЕКОМЕНДАЦИЯ", 78, 1855, { size: 19, fill: "#71839C", weight: 500 }),
  ].join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${backgroundColor}"/><stop offset="0.55" stop-color="#09182A"/><stop offset="1" stop-color="#0A1020"/>
      </linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="${accent}" stop-opacity="0.22"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <circle cx="${860 - backgroundShift}" cy="360" r="510" fill="url(#glow)"/>
    <path d="M0 ${960 + backgroundShift} C260 ${820 + backgroundShift} 620 ${1090 - backgroundShift} 1080 ${875 + backgroundShift}" fill="none" stroke="${accent}" stroke-opacity="0.09" stroke-width="3"/>
    ${brand}${progress}${illustration}
    ${titleLines}
    ${subtitleLines}
    ${footer}
  </svg>`;
}

async function probeDurationSeconds(path: string): Promise<number> {
  const result = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    path,
  ], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
  const duration = Number(result.stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Не удалось определить длительность дорожки Whale Radar.");
  return duration;
}

async function resolveFontPath(): Promise<string> {
  const result = await execFileAsync("fc-match", ["-f", "%{file}", "DejaVu Sans"], {
    timeout: 10_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  const fontPath = result.stdout.trim();
  if (!fontPath) throw new Error("Не удалось найти шрифт DejaVu Sans для Whale Radar.");
  return fontPath;
}

function escapeFilterValue(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]");
}

function createVisualFilter(
  durations: number[],
  scenes: WhaleVisualPlan["scenes"],
  action: WhaleEvent["action"],
  fontPath: string,
): string {
  const accent = action === "BUY" ? "0x42E3B3" : action === "SELL" ? "0xFF6475" : "0xA8A1FF";
  const fontFile = escapeFilterValue(fontPath);
  const sceneFilters = durations.map((duration, index) => {
    const scene = scenes[index];
    const zoomRate = index % 2 === 0 ? "0.00032" : "0.00022";
    const motion = scene?.kind === "MONEY_FLOW"
      ? `,drawbox=x='410+mod(t*150,180)':y=400:w=48:h=48:color=${accent}@0.25:t=fill,drawbox=x='427+mod(t*150,180)':y=417:w=14:h=14:color=white@0.96:t=fill`
      : scene?.kind === "TRADE_FACT"
        ? `,drawbox=x=120:y=690:w='min(820,max(0,t*900))':h=7:color=${accent}@0.88:t=fill`
        : scene?.kind === "ACCUMULATION" || scene?.kind === "DISTRIBUTION" || scene?.kind === "WALLET_HISTORY"
          ? `,drawbox=x='116+mod(t*210,820)':y=440:w=32:h=32:color=${accent}@0.76:t=fill`
          : "";
    const ctaMotion = scene?.kind === "CTA"
      ? [
        "drawbox=x=250:y=888:w=580:h=144:color=white@0.25:t=fill:enable='between(t,0.86,1.02)'",
        "drawbox=x='260+mod(t*480,560)':y=898:w=24:h=124:color=white@0.26:t=fill:enable='between(t,0.1,1.1)'",
        `drawtext=fontfile='${fontFile}':text='ПОДПИСАТЬСЯ':expansion=none:fontcolor=0x07101D:fontsize=48:x=(w-text_w)/2:y=(h-text_h)/2:enable='lt(t,1.2)'`,
        `drawtext=fontfile='${fontFile}':text='ВЫ ПОДПИСАНЫ ✓':expansion=none:fontcolor=0x07101D:fontsize=44:x=(w-text_w)/2:y=(h-text_h)/2:enable='gte(t,1.2)'`,
      ].join(",")
      : "";
    return `[${index}:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},zoompan=z='min(zoom+${zoomRate},1.045)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${WIDTH}x${HEIGHT}:fps=30${motion}${ctaMotion ? `,${ctaMotion}` : ""},trim=duration=${duration.toFixed(3)},setpts=PTS-STARTPTS[v${index}]`;
  });
  const concatInputs = durations.map((_duration, index) => `[v${index}]`).join("");
  sceneFilters.push(`${concatInputs}concat=n=${durations.length}:v=1:a=0,format=yuv420p[v]`);
  const voiceInput = durations.length;
  const musicInput = durations.length + 1;
  sceneFilters.push(`[${voiceInput}:a]volume=1.0[voice]`);
  sceneFilters.push(`[${musicInput}:a]volume=0.16[music]`);
  sceneFilters.push(`[voice][music]amix=inputs=2:duration=longest:dropout_transition=1,alimiter=limit=0.95[a]`);
  return sceneFilters.join(";");
}

export async function renderWhaleRadarShort(input: {
  event: WhaleEvent;
  story: WhaleStory;
  visualPlan: WhaleVisualPlan;
}): Promise<{ buffer: Buffer; durationMs: number; sceneCount: number }> {
  const directory = await mkdtemp(join(tmpdir(), "whale-radar-"));
  try {
    const fontPath = await resolveFontPath();
    const logoDataUri = await getLogoDataUri(input.event.symbol);
    const imagePaths: string[] = [];
    for (let index = 0; index < input.visualPlan.scenes.length; index += 1) {
      const svgPath = join(directory, `scene-${index + 1}.svg`);
      const pngPath = join(directory, `scene-${index + 1}.png`);
      await writeFile(svgPath, sceneSvg({
        event: input.event,
        story: input.story,
        plan: input.visualPlan,
        sceneIndex: index,
        logoDataUri,
      }), "utf8");
      await execFileAsync(process.env["IMAGEMAGICK_CONVERT_BIN"] || "convert", [
        "-font", fontPath,
        "-background", "#07101D",
        svgPath,
        pngPath,
      ], { timeout: 45_000, maxBuffer: 4 * 1024 * 1024 });
      imagePaths.push(pngPath);
    }

    const voicePath = join(directory, "voice.mp3");
    const narration = prepareSpeechText(input.story.narration);
    const voice = await generateSpeech(narration, getConfiguredVoiceId(), getElevenLabsModel(), {
      speed: 1.02,
      stability: 0.52,
      similarity: 0.78,
      style: 0.18,
      speakerBoost: true,
    });
    await writeFile(voicePath, voice);
    const voiceDurationSeconds = await probeDurationSeconds(voicePath);
    if (voiceDurationSeconds > 29) {
      throw new Error(`Озвучка Whale Radar слишком длинная: ${voiceDurationSeconds.toFixed(1)} с; сократите сценарий до 29 секунд.`);
    }
    const durationSeconds = Math.min(30, Math.max(25, voiceDurationSeconds + 1));
    const sceneDurations = input.visualPlan.scenes.map(() => durationSeconds / input.visualPlan.scenes.length);
    const outputPath = join(directory, "whale-radar.mp4");
    const args: string[] = ["-y"];
    for (const imagePath of imagePaths) {
      args.push("-loop", "1", "-framerate", "30", "-t", String(durationSeconds / imagePaths.length), "-i", imagePath);
    }
    const voiceInput = imagePaths.length;
    const musicInput = imagePaths.length + 1;
    args.push(
      "-i", voicePath,
      "-stream_loop", "-1",
      "-i", MUSIC_PATH,
      "-filter_complex", createVisualFilter(sceneDurations, input.visualPlan.scenes, input.event.action, fontPath),
      "-map", "[v]",
      "-map", "[a]",
      "-t", durationSeconds.toFixed(3),
      "-r", "30",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-c:a", "aac",
      "-b:a", "160k",
      "-ar", "48000",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-metadata", `title=${input.story.title}`,
      outputPath,
    );
    if (voiceInput !== imagePaths.length || musicInput !== imagePaths.length + 1) {
      throw new Error("Whale Radar audio input mapping is inconsistent.");
    }
    await execFileAsync(process.env["FFMPEG_BIN"] || "ffmpeg", args, {
      timeout: 8 * 60 * 1_000,
      maxBuffer: 12 * 1024 * 1024,
    });
    const buffer = await readFile(outputPath);
    if (buffer.length < 100_000) throw new Error("Rendered Whale Radar MP4 is unexpectedly small.");
    logger.info({
      durationSeconds,
      sceneCount: input.visualPlan.scenes.length,
      bytes: buffer.length,
    }, "[WHALE RADAR] Isolated Shorts renderer completed.");
    return {
      buffer,
      durationMs: Math.round(durationSeconds * 1_000),
      sceneCount: input.visualPlan.scenes.length,
    };
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}
