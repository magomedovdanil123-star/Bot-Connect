import type { KineticSubtitleWord } from "./longform-kinetic-subtitles";

export type PremiumFinanceV2SceneWindow = {
  sceneId: number;
  startMs: number;
  endMs: number;
  narration: string;
  semanticType: string;
};

export type PremiumFinanceV2SafeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  placement: "lower-left" | "upper-left" | "lower-center";
};

export type PremiumFinanceV2SceneComposition = {
  sceneId: number;
  title: string;
  treatment: string;
  focalRect: { x: number; y: number; width: number; height: number };
  safeRect: PremiumFinanceV2SafeRect;
  heroMoment: boolean;
  sourceLabels: string[];
};

const WIDTH = 1920;
const HEIGHT = 1080;
const ACCENT = "#F3B74C";
const MINT = "#72E4BE";
const ROSE = "#FF7184";
const PAPER = "#F3EAD8";

export const PREMIUM_FINANCE_V2_SCENE_BRIEFS: Record<number, Omit<PremiumFinanceV2SceneComposition, "sceneId">> = {
  1: {
    title: "GENESIS BLOCK · 2013",
    treatment: "Source-led archival timeline and block-chain marker; reconstructed as a graphic, not a screenshot.",
    focalRect: { x: 1080, y: 250, width: 660, height: 520 },
    safeRect: { x: 112, y: 850, width: 1000, height: 180, placement: "lower-left" },
    heroMoment: true,
    sourceLabels: ["Dogecoin Core · chainparams.cpp"],
  },
  2: {
    title: "PRICE AT A FIXED MOMENT",
    treatment: "Single reconstructed market terminal with the saved CoinGecko snapshot, its source, and timestamp.",
    focalRect: { x: 160, y: 265, width: 1470, height: 550 },
    safeRect: { x: 118, y: 850, width: 1320, height: 170, placement: "lower-left" },
    heroMoment: false,
    sourceLabels: ["CoinGecko · 2026-10-04 13:01 UTC"],
  },
  3: {
    title: "MEASURED RISE",
    treatment: "Full-frame sampled-price trace; only the observed rising interval is accented.",
    focalRect: { x: 210, y: 250, width: 1500, height: 520 },
    safeRect: { x: 112, y: 820, width: 1320, height: 190, placement: "lower-left" },
    heroMoment: false,
    sourceLabels: ["CoinGecko · saved seven-day sample"],
  },
  4: {
    title: "MEASURED DRAWDOWN",
    treatment: "The same measured series resolves into a past drawdown; no forecast or trade instruction.",
    focalRect: { x: 210, y: 290, width: 1500, height: 500 },
    safeRect: { x: 112, y: 820, width: 1320, height: 190, placement: "lower-left" },
    heroMoment: false,
    sourceLabels: ["CoinGecko · saved seven-day sample"],
  },
  5: {
    title: "MARKET CAPITALIZATION",
    treatment: "The sourced market-cap value grows into a full-frame typographic hero, not a dashboard card.",
    focalRect: { x: 350, y: 280, width: 1220, height: 430 },
    safeRect: { x: 160, y: 820, width: 1600, height: 180, placement: "lower-center" },
    heroMoment: true,
    sourceLabels: ["CoinGecko · 2026-10-04 13:01 UTC"],
  },
  6: {
    title: "SAME SEVEN-DAY WINDOW",
    treatment: "Two proportional performance traces on one axis; DOGE and BTC values share the same period.",
    focalRect: { x: 170, y: 275, width: 1580, height: 520 },
    safeRect: { x: 112, y: 100, width: 1690, height: 170, placement: "upper-left" },
    heroMoment: false,
    sourceLabels: ["CoinGecko · matched seven-day comparison"],
  },
  7: {
    title: "EDITORIAL RECONSTRUCTION",
    treatment: "Abstract paper and headline fragments built only from words in the narration; no fabricated headlines.",
    focalRect: { x: 230, y: 220, width: 1450, height: 580 },
    safeRect: { x: 120, y: 845, width: 1600, height: 175, placement: "lower-left" },
    heroMoment: false,
    sourceLabels: ["Visual reconstruction · not a real news page"],
  },
  8: {
    title: "COMMUNITY · ARCHIVAL EXAMPLE",
    treatment: "Licensed 2014 photograph of the No. 98 Dogecoin Chevrolet; used as historical evidence, not a current-market claim.",
    focalRect: { x: 160, y: 265, width: 1500, height: 600 },
    safeRect: { x: 125, y: 870, width: 1100, height: 160, placement: "lower-left" },
    heroMoment: true,
    sourceLabels: ["Wikimedia Commons · TaurusEmerald · CC BY-SA 4.0"],
  },
};

export function buildPremiumFinanceV2SceneWindows(
  script: Array<{ sceneId: number; startMs: number; endMs: number; text: string; semanticType: string }>,
  selectedSceneIds: number[],
  durationMs: number,
): PremiumFinanceV2SceneWindow[] {
  const selected = selectedSceneIds.map((sceneId) => {
    const scene = script.find((candidate) => candidate.sceneId === sceneId);
    if (!scene) throw new Error(`V2 visual plan is missing narration scene ${sceneId}`);
    return scene;
  });
  if (selected.length < 2 || selected.some((scene, index) => index > 0 && scene.sceneId <= selected[index - 1]!.sceneId)) {
    throw new Error("V2 scene selection must contain at least two ordered, unique narration scenes");
  }
  return selected.map((scene, index) => {
    const startMs = index === 0
      ? 0
      : Math.round((selected[index - 1]!.endMs + scene.startMs) / 2);
    const endMs = index === selected.length - 1
      ? durationMs
      : Math.round((scene.endMs + selected[index + 1]!.startMs) / 2);
    if (endMs <= startMs) throw new Error(`V2 scene ${scene.sceneId} has an invalid render window`);
    return {
      sceneId: scene.sceneId,
      startMs,
      endMs,
      narration: scene.text,
      semanticType: scene.semanticType,
    };
  });
}

export function getPremiumFinanceV2SceneComposition(sceneId: number): PremiumFinanceV2SceneComposition {
  const brief = PREMIUM_FINANCE_V2_SCENE_BRIEFS[sceneId];
  if (!brief) throw new Error(`No cinematic V2 composition exists for scene ${sceneId}`);
  return { sceneId, ...brief };
}

export function mapPremiumFinanceV2Transition(value: string): string {
  switch (value) {
    case "flash-cut": return "fadewhite";
    case "whip-left": return "smoothleft";
    case "whip-right": return "smoothright";
    case "snap-cut": return "fade";
    default: return "dissolve";
  }
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function svgText(
  x: number,
  y: number,
  value: string,
  size: number,
  color = "#F6F4ED",
  weight = 700,
  opacity = 1,
  family = "DejaVu Sans,Arial,sans-serif",
  spacing?: number,
  anchor: "start" | "middle" | "end" = "start",
): string {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" fill-opacity="${opacity}" font-family="${family}" font-size="${size}" font-weight="${weight}"${spacing === undefined ? "" : ` letter-spacing="${spacing}"`}>${xml(value)}</text>`;
}

function marketTimestamp(value: string): string {
  return `${value.slice(0, 10)}  ${value.slice(11, 16)} UTC`;
}

function chartPoints(
  samples: number[],
  startIndex = 0,
  endIndex = samples.length - 1,
  bounds = { left: 210, right: 1710, top: 300, bottom: 650 },
): string {
  const selected = samples.slice(startIndex, endIndex + 1);
  const minimum = Math.min(...samples);
  const maximum = Math.max(...samples);
  const range = Math.max(0.0000001, maximum - minimum);
  return selected.map((value, index) => {
    const x = bounds.left + ((startIndex + index) / Math.max(1, samples.length - 1)) * (bounds.right - bounds.left);
    const y = bounds.bottom - ((value - minimum) / range) * (bounds.bottom - bounds.top);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

function chartDots(
  samples: number[],
  startIndex = 0,
  endIndex = samples.length - 1,
  color = "#D6E0E8",
  bounds = { left: 210, right: 1710, top: 300, bottom: 650 },
): string {
  const minimum = Math.min(...samples);
  const maximum = Math.max(...samples);
  const range = Math.max(0.0000001, maximum - minimum);
  return samples.slice(startIndex, endIndex + 1).map((value, localIndex) => {
    const index = startIndex + localIndex;
    const x = bounds.left + (index / Math.max(1, samples.length - 1)) * (bounds.right - bounds.left);
    const y = bounds.bottom - ((value - minimum) / range) * (bounds.bottom - bounds.top);
    const r = 7 + (index === endIndex ? 4 : 0);
    return `<circle cx="${x}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" fill-opacity="${index === endIndex ? 1 : 0.8}"/>`;
  }).join("");
}

function gridLines(color = "#9AB0C2", opacity = 0.13): string {
  const horizontal = [260, 390, 520, 650, 780].map((y) =>
    `<path d="M 110 ${y} H 1810" stroke="${color}" stroke-opacity="${opacity}" stroke-width="1"/>`,
  ).join("");
  const vertical = [280, 620, 960, 1300, 1640].map((x) =>
    `<path d="M ${x} 205 V 810" stroke="${color}" stroke-opacity="${opacity * 0.7}" stroke-width="1"/>`,
  ).join("");
  return `${horizontal}${vertical}`;
}

function chartScene(input: {
  market: Record<string, unknown>;
  progress: number;
  mode: "all" | "rise" | "drawdown";
}): string {
  const samples = input.market.priceSamples as number[];
  const segment = input.mode === "rise"
    ? input.market.riseSegment as { fromIndex: number; toIndex: number; changePercent: number }
    : input.market.drawdownSegment as { fromIndex: number; toIndex: number; changePercent: number };
  const fullPath = chartPoints(samples);
  const focusPath = chartPoints(samples, segment.fromIndex, segment.toIndex);
  const focusLength = Math.max(1, (segment.toIndex - segment.fromIndex) / Math.max(1, samples.length - 1));
  const dashOffset = Math.max(0, 1 - input.progress) * 1_800 * focusLength;
  const mainColor = input.mode === "drawdown" ? ROSE : MINT;
  const focusText = `${segment.changePercent < 0 ? "−" : "+"}${Math.abs(segment.changePercent).toFixed(2)}%`;
  const marker = input.mode === "rise" ? "MEASURED RISE" : "MEASURED DRAWDOWN";
  return `
    ${gridLines()}
    <path d="${fullPath}" fill="none" stroke="#A8B6C3" stroke-opacity=".42" stroke-width="5"/>
    <path d="${focusPath}" fill="none" stroke="${mainColor}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"
      stroke-dasharray="1800" stroke-dashoffset="${dashOffset.toFixed(1)}"/>
    ${chartDots(samples, 0, samples.length - 1, "#DEE7EC")}
    ${svgText(150, 230, marker, 28, mainColor, 700, 0.9, "DejaVu Sans,Arial,sans-serif", 5)}
    ${svgText(1380, 312, focusText, 90, mainColor, 800, Math.min(1, input.progress * 1.35))}
    ${svgText(1385, 350, "OBSERVED SEGMENT", 16, "#BAC7D2", 600, 0.8, "DejaVu Sans,Arial,sans-serif", 2)}
  `;
}

export function buildPremiumFinanceV2SceneSvg(input: {
  sceneId: number;
  phase: number;
  market: Record<string, unknown>;
  dataAsOf: string;
  photoDataUri: string;
  motion: { backgroundScale: number; midgroundScale: number; foregroundScale: number };
}): string {
  const phase = Math.max(0, Math.min(1, input.phase));
  const progress = 1 - Math.pow(1 - phase, 3);
  const market = input.market;
  const backgroundScale = Math.max(1.01, Math.min(1.08, input.motion.backgroundScale));
  const midgroundScale = Math.max(1.015, Math.min(1.09, input.motion.midgroundScale));
  const foregroundScale = Math.max(1.02, Math.min(1.1, input.motion.foregroundScale));
  const bgTransform = `translate(${-WIDTH * (backgroundScale - 1) / 2} ${-HEIGHT * (backgroundScale - 1) / 2}) scale(${backgroundScale})`;
  const midTransform = `translate(${-WIDTH * (midgroundScale - 1) / 2} ${-HEIGHT * (midgroundScale - 1) / 2}) scale(${midgroundScale})`;
  const frontTransform = `translate(${-WIDTH * (foregroundScale - 1) / 2} ${-HEIGHT * (foregroundScale - 1) / 2}) scale(${foregroundScale})`;
  const commonDefs = `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#14232D"/><stop offset=".55" stop-color="#08121B"/><stop offset="1" stop-color="#04080D"/>
      </linearGradient>
      <linearGradient id="gold" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#C98731"/><stop offset=".55" stop-color="#FFE39B"/><stop offset="1" stop-color="#D89535"/>
      </linearGradient>
      <linearGradient id="photoShade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#07111B" stop-opacity=".76"/><stop offset=".48" stop-color="#07111B" stop-opacity=".08"/><stop offset="1" stop-color="#07111B" stop-opacity=".83"/>
      </linearGradient>
      <radialGradient id="vignette">
        <stop offset=".42" stop-color="#02060A" stop-opacity="0"/>
        <stop offset="1" stop-color="#02060A" stop-opacity=".78"/>
      </radialGradient>
      <pattern id="grain" width="7" height="7" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r=".7" fill="#E1E8ED" opacity=".15"/>
      </pattern>
    </defs>`;

  let background = `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>`;
  let midground = "";
  let foreground = "";

  switch (input.sceneId) {
    case 1: {
      const yearOpacity = Math.min(1, 0.38 + progress * 0.72);
      background += `<g opacity=".42" transform="${bgTransform}">
        <path d="M 80 840 H 1840 M 80 840 V 190" stroke="#93A9B8" stroke-opacity=".42" stroke-width="2"/>
        <path d="M 190 775 H 1740" stroke="#A8BBC6" stroke-opacity=".17" stroke-width="2" stroke-dasharray="4 14"/>
        ${svgText(145, 250, "DOGECOIN CORE", 20, "#A8BBC6", 600, 0.75, "DejaVu Sans Mono,monospace", 4)}
        ${svgText(145, 294, "src / chainparams.cpp", 18, "#A8BBC6", 500, 0.53, "DejaVu Sans Mono,monospace")}
      </g>`;
      midground = `<g transform="${midTransform}">
        <path d="M 210 712 H 1600" stroke="#6B8798" stroke-width="4" stroke-opacity=".52"/>
        <path d="M 210 712 H ${210 + 1390 * progress}" stroke="url(#gold)" stroke-width="7" stroke-linecap="round"/>
        ${[0, 1, 2, 3, 4, 5].map((index) => `<circle cx="${210 + index * 278}" cy="712" r="${index === 5 ? 12 : 7}" fill="${index === 5 ? ACCENT : "#A9BBC7"}" opacity="${0.45 + 0.5 * progress}"/>`).join("")}
        <circle cx="1390" cy="520" r="218" fill="none" stroke="#F3B74C" stroke-opacity=".17" stroke-width="2"/>
        <circle cx="1390" cy="520" r="164" fill="none" stroke="#F3B74C" stroke-opacity=".28" stroke-width="2"/>
        ${svgText(1390, 544, "2013", 178, "#F6F4ED", 800, yearOpacity, "DejaVu Sans,Arial,sans-serif", -3, "middle")}
        ${svgText(1390, 604, "GENESIS BLOCK", 22, ACCENT, 700, 0.95, "DejaVu Sans,Arial,sans-serif", 5, "middle")}
      </g>`;
      foreground = `<g transform="${frontTransform}">
        ${svgText(152, 386, "A NETWORK BEGINS", 28, "#D8E1E5", 600, 0.88, "DejaVu Sans,Arial,sans-serif", 5)}
        ${svgText(152, 434, "verified source · Dogecoin Core", 18, "#A9BBC7", 500, 0.78)}
        <path d="M 152 468 H 690" stroke="${ACCENT}" stroke-opacity=".72" stroke-width="3"/>
      </g>`;
      break;
    }
    case 2: {
      const samples = market.priceSamples as number[];
      const currentPrice = Number(market.currentPriceUsd);
      const plotBounds = { left: 1060, right: 1740, top: 350, bottom: 690 };
      background += `<g transform="${bgTransform}">${gridLines("#7E9CAE", 0.12)}</g>`;
      midground = `<g transform="${midTransform}">
        <path d="${chartPoints(samples, 0, samples.length - 1, plotBounds)}" fill="none" stroke="#C7D5DD" stroke-opacity=".55" stroke-width="4"/>
        <path d="${chartPoints(samples, 0, samples.length - 1, plotBounds)}" fill="none" stroke="${MINT}" stroke-opacity=".86" stroke-width="8"
          stroke-dasharray="1900" stroke-dashoffset="${(1 - progress) * 1900}"/>
        ${chartDots(samples, 0, samples.length - 1, "#EAF0F2", plotBounds)}
        <path d="M 980 325 V 736" stroke="#89A1AF" stroke-opacity=".28" stroke-width="1.5" stroke-dasharray="4 9"/>
      </g>`;
      foreground = `<g transform="${frontTransform}">
        ${svgText(150, 300, "DOGE / USD", 24, "#B8C6CE", 700, 0.88, "DejaVu Sans,Arial,sans-serif", 5)}
        ${svgText(148, 472, `$${currentPrice.toFixed(6)}`, 94, "#F6F4ED", 800, 1)}
        ${svgText(154, 524, "FIXED MARKET SNAPSHOT", 18, ACCENT, 600, 0.95, "DejaVu Sans,Arial,sans-serif", 4)}
        ${svgText(154, 596, `7D LOW  $${Number(market.lowPriceUsd7d).toFixed(6)}`, 22, "#AABBC5", 600, 0.92)}
        ${svgText(154, 640, `7D HIGH $${Number(market.highPriceUsd7d).toFixed(6)}`, 22, "#AABBC5", 600, 0.92)}
        ${svgText(1440, 800, `COINGECKO  ·  ${marketTimestamp(input.dataAsOf)}`, 16, "#B3C1C9", 600, 0.92, "DejaVu Sans,Arial,sans-serif", 1.5)}
      </g>`;
      break;
    }
    case 3:
      background += `<g transform="${bgTransform}">${gridLines()}</g>`;
      midground = `<g transform="${midTransform}">${chartScene({ market, progress, mode: "rise" })}</g>`;
      foreground = `<g transform="${frontTransform}">
        ${svgText(1780, 192, "COINGECKO · WEEKLY PRICE SAMPLES", 14, "#B7C4CC", 600, 0.86, "DejaVu Sans,Arial,sans-serif", 1.5, "end")}
      </g>`;
      break;
    case 4:
      background += `<g transform="${bgTransform}">${gridLines("#B78391", 0.13)}</g>`;
      midground = `<g transform="${midTransform}">${chartScene({ market, progress, mode: "drawdown" })}</g>`;
      foreground = `<g transform="${frontTransform}">
        ${svgText(1780, 192, "COINGECKO · PAST PRICE MOVEMENT", 14, "#C7B9BE", 600, 0.9, "DejaVu Sans,Arial,sans-serif", 1.5, "end")}
      </g>`;
      break;
    case 5: {
      const billions = Number(market.marketCapUsd) / 1_000_000_000;
      const shown = (billions * progress).toFixed(2);
      background += `<circle cx="960" cy="490" r="${270 + progress * 70}" fill="none" stroke="#F3B74C" stroke-opacity=".12" stroke-width="1.5"/>
        <circle cx="960" cy="490" r="${220 + progress * 42}" fill="none" stroke="#F3B74C" stroke-opacity=".22" stroke-width="2"/>
        <path d="M 270 710 Q 960 ${850 - progress * 90} 1650 710" fill="none" stroke="url(#gold)" stroke-opacity=".55" stroke-width="2"/>`;
      midground = `<g transform="${midTransform}">
        <circle cx="960" cy="488" r="185" fill="#0B141C" stroke="url(#gold)" stroke-width="4"/>
        <circle cx="960" cy="488" r="154" fill="none" stroke="#F8D37C" stroke-opacity=".4" stroke-width="2" stroke-dasharray="3 12"/>
        ${svgText(960, 518, "Ð", 162, "#F3C86D", 800, 1, "DejaVu Sans,Arial,sans-serif", undefined, "middle")}
      </g>`;
      foreground = `<g transform="${frontTransform}">
        ${svgText(960, 202, "MARKET CAPITALIZATION", 24, "#D4DDE1", 600, 0.88, "DejaVu Sans,Arial,sans-serif", 6, "middle")}
        ${svgText(960, 244, "SAVED SNAPSHOT · COINGECKO", 15, "#B8C5CC", 600, 0.88, "DejaVu Sans,Arial,sans-serif", 2, "middle")}
        ${svgText(960, 267, marketTimestamp(input.dataAsOf), 14, "#B8C5CC", 500, 0.8, "DejaVu Sans,Arial,sans-serif", undefined, "middle")}
        ${svgText(960, 810, `$${shown}B`, 128, "#F6F4ED", 800, 1, "DejaVu Sans,Arial,sans-serif", undefined, "middle")}
      </g>`;
      break;
    }
    case 6: {
      const doge = Number(market.changePercent7d);
      const btc = Number(market.bitcoinChangePercent7d);
      const scale = 132;
      const dogeLength = Math.abs(doge) * scale;
      const btcLength = Math.abs(btc) * scale;
      midground = `<g transform="${midTransform}">
        <path d="M 960 270 V 800" stroke="#9BAEB9" stroke-opacity=".32" stroke-width="2"/>
        <path d="M 350 478 H 1570" stroke="#7F929E" stroke-opacity=".36" stroke-width="2"/>
        <path d="M 960 478 H ${960 - dogeLength * progress}" stroke="${ROSE}" stroke-width="19" stroke-linecap="round"/>
        <path d="M 960 612 H ${960 + btcLength * progress}" stroke="${MINT}" stroke-width="19" stroke-linecap="round"/>
        <circle cx="${960 - dogeLength * progress}" cy="478" r="12" fill="${ROSE}"/>
        <circle cx="${960 + btcLength * progress}" cy="612" r="12" fill="${MINT}"/>
      </g>`;
      foreground = `<g transform="${frontTransform}">
        ${svgText(350, 382, "DOGE", 25, "#DEE5E8", 700, 1, "DejaVu Sans,Arial,sans-serif", 5)}
        ${svgText(350, 560, `${doge < 0 ? "−" : "+"}${Math.abs(doge).toFixed(2)}%`, 70, ROSE, 800, 1)}
        ${svgText(1050, 382, "BTC", 25, "#DEE5E8", 700, 1, "DejaVu Sans,Arial,sans-serif", 5)}
        ${svgText(1050, 694, `${btc < 0 ? "−" : "+"}${Math.abs(btc).toFixed(2)}%`, 70, MINT, 800, 1)}
        ${svgText(150, 830, "MATCHED SEVEN-DAY PERIOD · ONE AXIS · SOURCE: COINGECKO", 17, "#B8C6CE", 600, 0.87, "DejaVu Sans,Arial,sans-serif", 2)}
      </g>`;
      break;
    }
    case 7: {
      const offset = progress * 42;
      background = `<rect width="${WIDTH}" height="${HEIGHT}" fill="#BDAE94"/>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="#1A1C1B" opacity=".12"/>
        <path d="M 0 150 H 1920 M 0 875 H 1920" stroke="#4A463C" stroke-opacity=".42" stroke-width="2"/>`;
      midground = `<g transform="${midTransform}">
        <path d="M 130 256 L 730 218 L 780 732 L 173 762 Z" fill="${PAPER}" stroke="#5C5549" stroke-width="3"/>
        <path d="M 1020 230 L 1740 272 L 1696 733 L 986 704 Z" fill="#E7DDC8" stroke="#5C5549" stroke-width="3"/>
        ${svgText(190, 370, "МЕМЫ", 82, "#1E272B", 800, 0.95, "DejaVu Sans,Arial,sans-serif", 8)}
        ${svgText(1080, 380, "ЗАГОЛОВКИ", 52, "#263036", 800, 0.92, "DejaVu Sans,Arial,sans-serif", 3)}
        <path d="M 190 420 H 667 M 190 458 H 657 M 190 496 H 612 M 1080 430 H 1610 M 1080 467 H 1575 M 1080 504 H 1505"
          stroke="#55574F" stroke-opacity=".6" stroke-width="5"/>
        <path d="M ${offset + 670} 175 L ${offset + 860} 175 L ${offset + 1260} 790 L ${offset + 1070} 790 Z"
          fill="#C44A4F" opacity=".76"/>
        <path d="M 310 648 H 650 M 1160 650 H 1530" stroke="#31393B" stroke-opacity=".44" stroke-width="3"/>
      </g>`;
      foreground = `<g transform="${frontTransform}">
        <rect x="118" y="138" width="710" height="46" fill="#0A1117" fill-opacity=".87"/>
        ${svgText(142, 169, "RECONSTRUCTION · NO REAL HEADLINES", 16, "#F0D6AA", 700, 1, "DejaVu Sans,Arial,sans-serif", 3)}
      </g>`;
      break;
    }
    case 8: {
      background = `<image x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice" href="${input.photoDataUri}"/>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#photoShade)"/>`;
      midground = `<g transform="${midTransform}">
        <path d="M 1310 330 C 1500 225, 1665 310, 1710 445 C 1750 568, 1610 680, 1450 685"
          fill="none" stroke="#F5C768" stroke-opacity="${0.16 + 0.4 * progress}" stroke-width="4" stroke-dasharray="9 18"/>
        ${[0, 1, 2, 3, 4].map((index) => `<circle cx="${1320 + index * 82}" cy="${350 + Math.sin(index + progress * 3) * 44}" r="${5 + progress * 2}" fill="${ACCENT}" opacity=".64"/>`).join("")}
      </g>`;
      foreground = `<g transform="${frontTransform}">
        <rect width="${WIDTH}" height="162" fill="url(#photoShade)" opacity=".62"/>
        ${svgText(132, 91, "DOGECOIN CHEVROLET · SONOMA 2014", 21, "#F6F4ED", 700, 1, "DejaVu Sans,Arial,sans-serif", 3)}
        ${svgText(132, 135, "Wikimedia Commons · TaurusEmerald · CC BY-SA 4.0", 16, "#E6E3D9", 500, 0.94)}
        <rect x="121" y="808" width="668" height="46" fill="#07111B" fill-opacity=".86"/>
        ${svgText(145, 839, "АНАЛОГОВАЯ ИСТОРИЯ СООБЩЕСТВА", 16, "#F5D58F", 700, 1, "DejaVu Sans,Arial,sans-serif", 2)}
      </g>`;
      break;
    }
    default:
      throw new Error(`No V2 cinematic SVG exists for scene ${input.sceneId}`);
  }

  const sceneLabel = PREMIUM_FINANCE_V2_SCENE_BRIEFS[input.sceneId]!.title;
  const headerTitle = input.sceneId === 8
    ? ""
    : `<g opacity=".82">${svgText(118, 74, sceneLabel, 16, "#E2E7E8", 600, 1, "DejaVu Sans,Arial,sans-serif", 3)}</g>`;
  const footer = input.sceneId === 8
    ? `<g opacity=".82">${svgText(1780, 1018, "COMMUNITY · ARCHIVAL EXAMPLE", 14, "#E2E7E8", 600, 1, "DejaVu Sans,Arial,sans-serif", 2, "end")}</g>`
    : `<g opacity=".72">${svgText(1475, 1018, "DOGECOIN · TEST MODE", 14, "#B8C6CE", 600, 1, "DejaVu Sans,Arial,sans-serif", 2)}</g>`;
  const filmOverlay = `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grain)" opacity=".22"/>
    <path d="M 0 38 H ${WIDTH} M 0 1042 H ${WIDTH}" stroke="#ECF0EF" stroke-opacity=".13" stroke-width="1"/>
    ${headerTitle}
    ${footer}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${commonDefs}
    ${background}
    ${midground}
    ${foreground}
    ${filmOverlay}
  </svg>`;
}

function assTime(ms: number): string {
  const totalCs = Math.max(0, Math.round(ms / 10));
  const hours = Math.floor(totalCs / 360_000);
  const minutes = Math.floor(totalCs / 6_000) % 60;
  const seconds = Math.floor(totalCs / 100) % 60;
  const centiseconds = totalCs % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`;
}

function assText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("\n", " ");
}

function normalizeWord(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

type CaptionGroup = KineticSubtitleWord[];

function phraseGroups(words: KineticSubtitleWord[]): CaptionGroup[] {
  const groups: CaptionGroup[] = [];
  let group: CaptionGroup = [];
  for (const word of words) {
    if (!group.length) {
      group = [word];
      continue;
    }
    const previous = group.at(-1)!;
    const punctuation = /[.!?…,:;]$/u.test(previous.text);
    const tooLong = word.endMs - group[0]!.startMs > 1_520;
    if (group.length >= 3 || punctuation || tooLong) {
      groups.push(group);
      group = [word];
    } else {
      group.push(word);
    }
  }
  if (group.length) groups.push(group);
  return groups;
}

export function buildPremiumFinanceV2KineticAss(input: {
  words: KineticSubtitleWord[];
  windows: PremiumFinanceV2SceneWindow[];
  emphasisWordsByScene: Record<number, string[]>;
  durationMs: number;
}): { ass: string; wordCount: number; phraseCount: number } {
  if (!input.words.length) throw new Error("Cinematic V2 subtitles require timestamped words");
  const dialogues: string[] = [];
  let phraseCount = 0;

  for (const window of input.windows) {
    const layout = getPremiumFinanceV2SceneComposition(window.sceneId).safeRect;
    const sceneWords = input.words
      .filter((word) => word.startMs < window.endMs && word.endMs > window.startMs && word.startMs < input.durationMs)
      .sort((left, right) => left.startMs - right.startMs);
    const groups = phraseGroups(sceneWords);
    phraseCount += groups.length;

    for (const [groupIndex, group] of groups.entries()) {
      const emphasisWords = new Set((input.emphasisWordsByScene[window.sceneId] ?? []).map(normalizeWord));
      const entries = group.map((word) => {
        const emphasis = emphasisWords.has(normalizeWord(word.text));
        const fontSize = emphasis ? 62 : 44;
        const upper = word.text.toLocaleUpperCase("ru-RU");
        // Reserve extra horizontal room for Cyrillic uppercase and the visual
        // gap between individually-timed words; this is intentionally conservative.
        const estimatedWidth = upper.length * fontSize * 0.76 + fontSize * 0.8;
        return { word, upper, emphasis, fontSize, estimatedWidth };
      });
      const lines: typeof entries[] = [];
      let current: typeof entries = [];
      let currentWidth = 0;
      for (const entry of entries) {
        if (current.length && currentWidth + entry.estimatedWidth > layout.width * 0.92) {
          lines.push(current);
          current = [];
          currentWidth = 0;
        }
        current.push(entry);
        currentWidth += entry.estimatedWidth;
      }
      if (current.length) lines.push(current);
      if (lines.length > 2) {
        throw new Error(`Cinematic subtitle phrase ${groupIndex} in scene ${window.sceneId} exceeds its safe zone`);
      }

      lines.forEach((line, lineIndex) => {
        const totalWidth = line.reduce((sum, entry) => sum + entry.estimatedWidth, 0);
        let cursorX = layout.x + (layout.width - totalWidth) / 2;
        const y = layout.y + Math.min(layout.height - 24, 62 + lineIndex * 76);
        const phraseEndMs = Math.min(input.durationMs, group.at(-1)!.endMs + 150);
        for (const entry of line) {
          const x = cursorX + entry.estimatedWidth / 2;
          const color = entry.emphasis ? "&H004FC6F2&" : "&H00F6F4ED&";
          const style = entry.emphasis
            ? `\\fs${entry.fontSize}\\fscx100\\fscy100\\t(0,140,\\fscx108\\fscy108)`
            : `\\fs${entry.fontSize}`;
          const override = `{\\an5\\pos(${Math.round(x)},${Math.round(y)})${style}\\b1\\1c${color}\\3c&H00050A10&\\bord5\\shad2\\blur1\\fad(55,85)}`;
          dialogues.push(
            `Dialogue: 2,${assTime(entry.word.startMs)},${assTime(phraseEndMs)},Kinetic,,0,0,0,,${override}${assText(entry.upper)}`,
          );
          cursorX += entry.estimatedWidth;
        }
      });
    }
  }

  if (!dialogues.length) throw new Error("Cinematic V2 subtitle layout produced no visible word events");
  return {
    ass: [
      "[Script Info]",
      "ScriptType: v4.00+",
      `PlayResX: ${WIDTH}`,
      `PlayResY: ${HEIGHT}`,
      "WrapStyle: 2",
      "ScaledBorderAndShadow: yes",
      "",
      "[V4+ Styles]",
      "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
      "Style: Kinetic,DejaVu Sans,44,&H00F6F4ED,&H00F6F4ED,&H00050A10,&H00000000,-1,0,1,5,2,5,96,96,0,1",
      "",
      "[Events]",
      "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
      ...dialogues,
      "",
    ].join("\n"),
    wordCount: input.words.filter((word) => word.startMs < input.durationMs).length,
    phraseCount,
  };
}
