import {
  buildLongformKineticSubtitleAss,
  classifyKineticSubtitleTone,
  type KineticSubtitleAnimationPreset,
  type KineticSubtitleEmphasisEvent,
  type KineticSubtitleLayout,
  type KineticSubtitleTone,
  type KineticSubtitleWord,
} from "./longform-kinetic-subtitles";

export type PremiumFinanceV2SceneWindow = {
  sceneId: number;
  startMs: number;
  endMs: number;
  narration: string;
  semanticType: string;
};

export const PREMIUM_FINANCE_V2_PRODUCTION_VISUAL_TYPES = [
  "COIN_REVEAL",
  "PRICE_MOVEMENT",
  "MARKET_ACTIVITY",
  "MARKET_CAP",
  "COIN_COMPARISON",
  "TIMELINE",
  "PERSON_PROFILE",
  "ECOSYSTEM_MAP",
  "TECHNOLOGY_EXPLAINER",
  "BLOCKCHAIN_NETWORK",
  "COMMUNITY",
  "NEWS_EDITORIAL",
  "QUOTE",
  "RISK_WARNING",
  "FULLSCREEN_STAT",
  "DATA_VISUALIZATION",
  "CONCEPT_ILLUSTRATION",
  "HERO_SCENE",
] as const;

export type PremiumFinanceV2ProductionVisualType =
  typeof PREMIUM_FINANCE_V2_PRODUCTION_VISUAL_TYPES[number];

export type PremiumFinanceV2ProductionVisualEvent = {
  beatIndex: number;
  sceneId: number;
  startMs: number;
  endMs: number;
  visualType: PremiumFinanceV2ProductionVisualType;
  narration: string;
  mainIdea: string;
  visualConcept: string;
  assetDescription: string;
  keyWords: string[];
  comparisonSymbols: string[];
  transition: string;
  movement: string;
  intensity: "restrained" | "dynamic" | "impact";
  sfxEvent: "impact" | "whoosh" | null;
  factualData: Record<string, number | string | null>;
  sourceReferences: Array<{ label: string; url: string }>;
  assetPlan: {
    status: "available" | "original-graphic" | "unavailable";
    reason: string;
  };
};

export type PremiumFinanceV2ProductionMarket = {
  coin: {
    name: string;
    symbol: string;
    sourceUrl: string;
    logoDataUri?: string;
  };
  sourceLabel: string;
  currentPriceUsd: number;
  lowPriceUsd7d: number;
  highPriceUsd7d: number;
  changePercent7d: number;
  marketCapUsd: number | null;
  activity?: { kind: string; valueUsd: number; sourceLabel: string; sourceUrl: string };
  priceSamples: Array<{ priceUsd: number }>;
  benchmarks: Array<{ id: string; name: string; symbol: string; changePercent7d: number }>;
  dataAsOf: string;
};

export type PremiumFinanceV2ProductionResearchContext = {
  sourceLabel: string;
  description: string;
  categories: string[];
  genesisDate: string | null;
  hashingAlgorithm: string | null;
  sourceUrls: string[];
  sourceExcerpts: Array<{ url: string; text: string }>;
  historyFirstObservedAt: string;
  historyLastObservedAt: string;
  historySourceUrl: string;
  historicalReturns: Array<{
    periodKey: "30d" | "90d" | "1y" | "all";
    periodLabel: string;
    startAt: string;
    endAt: string;
    startPriceUsd: number;
    endPriceUsd: number;
    changePercent: number;
  }>;
};

export type PremiumFinanceV2SafeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  placement:
    | "center"
    | "center-left"
    | "center-right"
    | "top"
    | "bottom"
    | "upper-left"
    | "upper-center"
    | "upper-right"
    | "lower-left"
    | "lower-center"
    | "lower-right";
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
    safeRect: { x: 112, y: 90, width: 1220, height: 150, placement: "upper-left" },
    heroMoment: false,
    sourceLabels: ["CoinGecko · saved seven-day sample"],
  },
  4: {
    title: "MEASURED DRAWDOWN",
    treatment: "The same measured series resolves into a past drawdown; no forecast or trade instruction.",
    focalRect: { x: 210, y: 290, width: 1500, height: 500 },
    safeRect: { x: 112, y: 90, width: 1220, height: 150, placement: "upper-left" },
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
    safeRect: { x: 112, y: 104, width: 1690, height: 155, placement: "upper-center" },
    heroMoment: false,
    sourceLabels: ["CoinGecko · matched seven-day comparison"],
  },
  7: {
    title: "EDITORIAL RECONSTRUCTION",
    treatment: "Abstract paper and headline fragments built only from words in the narration; no fabricated headlines.",
    focalRect: { x: 230, y: 220, width: 1450, height: 580 },
    safeRect: { x: 120, y: 842, width: 1680, height: 182, placement: "lower-center" },
    heroMoment: false,
    sourceLabels: ["Visual reconstruction · not a real news page"],
  },
  8: {
    title: "COMMUNITY · ARCHIVAL EXAMPLE",
    treatment: "Licensed 2014 photograph of the No. 98 Dogecoin Chevrolet; used as historical evidence, not a current-market claim.",
    focalRect: { x: 160, y: 265, width: 1500, height: 600 },
    safeRect: { x: 820, y: 872, width: 1030, height: 160, placement: "lower-right" },
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

export function classifyPremiumFinanceV2ProductionVisualType(
  narration: string,
  fallbackIndex = 0,
): PremiumFinanceV2ProductionVisualType {
  const text = narration.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
  if (/(?:основател|создател|команд|человек|личност|founder)/u.test(text)) return "PERSON_PROFILE";
  if (/(?:экосистем|партнер|партн[её]р|сервис|приложен)/u.test(text)) return "ECOSYSTEM_MAP";
  if (/(?:технолог|алгоритм|консенсус|механизм|протокол|техническ)/u.test(text)) return "TECHNOLOGY_EXPLAINER";
  if (/(?:блокчейн|ончейн|узел|нод|смарт-контракт|сеть)/u.test(text)) return "BLOCKCHAIN_NETWORK";
  if (/(?:сообществ|комьюнит|пользовател|участник|community)/u.test(text)) return "COMMUNITY";
  if (/(?:новост|заголов|публикац|сообщил|объявил|news)/u.test(text)) return "NEWS_EDITORIAL";
  if (/(?:цитат|говорил|заявил|по словам|quote)/u.test(text)) return "QUOTE";
  if (/(?:риск|угроз|опасност|уязвим|предупрежден|осторож|рискован)/u.test(text)) return "RISK_WARNING";
  if (/(?:капитализац|market cap)/u.test(text)) return "MARKET_CAP";
  if (/(?:объем|оборот|ликвидност|торговл|volume)/u.test(text)) return "MARKET_ACTIVITY";
  if (/(?:сравн|против|vs\.?|на фоне|в отличие|выше чем|ниже чем)/u.test(text)) return "COIN_COMPARISON";
  if (/(?:ath|atl|историческ(?:ий|ого) максимум|максимум за все время|рекорд)/iu.test(text)) return "FULLSCREEN_STAT";
  if (/(?:цена|курс|рост|паден|динамик|доходност|процент|\d\s*%)/u.test(text)) return "PRICE_MOVEMENT";
  if (/(?:истор|год|дата|запуск|появил|начал|генезис|таймлайн)/u.test(text)) return "TIMELINE";
  if (/(?:монет|токен|тикер|символ|называется)/u.test(text)) return "COIN_REVEAL";
  const rotation: PremiumFinanceV2ProductionVisualType[] = [
    "DATA_VISUALIZATION",
    "CONCEPT_ILLUSTRATION",
    "HERO_SCENE",
    "COIN_REVEAL",
  ];
  return rotation[Math.abs(fallbackIndex) % rotation.length]!;
}

function productionUsd(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "н/д";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: value < 1 ? 6 : 2,
  });
}

function safeProductionSamples(market: PremiumFinanceV2ProductionMarket): number[] {
  return market.priceSamples
    .map((sample) => sample.priceUsd)
    .filter((value) => Number.isFinite(value) && value > 0);
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
  return `
    ${gridLines()}
    <path d="${fullPath}" fill="none" stroke="#A8B6C3" stroke-opacity=".42" stroke-width="5"/>
    <path d="${focusPath}" fill="none" stroke="${mainColor}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"
      stroke-dasharray="1800" stroke-dashoffset="${dashOffset.toFixed(1)}"/>
    ${chartDots(samples, 0, samples.length - 1, "#DEE7EC")}
    ${svgText(1380, 312, focusText, 90, mainColor, 800, Math.min(1, input.progress * 1.35))}
  `;
}

export function buildPremiumFinanceV2ProductionSceneSvg(input: {
  event: PremiumFinanceV2ProductionVisualEvent;
  market?: PremiumFinanceV2ProductionMarket;
  researchContext?: PremiumFinanceV2ProductionResearchContext;
  visualAssetDataUri?: string;
  phase: number;
}): string {
  const phase = Math.max(0, Math.min(1, input.phase));
  const progress = 1 - Math.pow(1 - phase, 3);
  const { event, market } = input;
  const symbol = market?.coin.symbol.toLocaleUpperCase("en-US") ?? "";
  const name = market?.coin.name ?? "";
  const accent = event.visualType === "RISK_WARNING"
    || (event.visualType === "PRICE_MOVEMENT" && (market?.changePercent7d ?? 0) < 0)
    ? ROSE
    : event.visualType === "COIN_COMPARISON" || event.visualType === "MARKET_ACTIVITY" ? MINT : ACCENT;
  const title = (event.mainIdea || event.narration).replace(/\s+/gu, " ").trim().slice(0, 76);
  const sourceLine = market
    ? `${market.sourceLabel} · ${market.dataAsOf.slice(0, 10)} ${market.dataAsOf.slice(11, 16)} UTC`
    : input.researchContext
      ? `${input.researchContext.sourceLabel} · VERIFIED RESEARCH CONTEXT`
      : "ILLUSTRATIVE · NO UNSOURCED MARKET DATA";
  const samples = market ? safeProductionSamples(market) : [];
  const bounds = { left: 650, right: 1770, top: 320, bottom: 740 };
  const chart = samples.length >= 2
    ? `<path d="${chartPoints(samples, 0, samples.length - 1, bounds)}" fill="none" stroke="#CDD8DE" stroke-opacity=".45" stroke-width="4"/>
       <path d="${chartPoints(samples, 0, samples.length - 1, bounds)}" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1900" stroke-dashoffset="${((1 - progress) * 1900).toFixed(1)}"/>
       ${chartDots(samples, 0, samples.length - 1, "#EAF0F2", bounds)}`
    : "";
  const logo = market?.coin.logoDataUri?.startsWith("data:image/")
    ? `<image href="${xml(market.coin.logoDataUri)}" x="850" y="340" width="220" height="220" preserveAspectRatio="xMidYMid meet"/>`
    : `<circle cx="960" cy="450" r="112" fill="#0B141C" stroke="${accent}" stroke-width="3"/>${svgText(960, 462, symbol.slice(0, 5) || "COIN", 36, "#F3EAD8", 800, 1, "DejaVu Sans,Arial,sans-serif", undefined, "middle")}`;
  const scene = (() => {
    switch (event.visualType) {
      case "PRICE_MOVEMENT":
        return market && chart
          ? `<g>${gridLines("#7E9CAE", 0.12)}${chart}
              ${svgText(150, 320, `${symbol} / USD`, 24, "#B8C6CE", 700, 0.9, "DejaVu Sans,Arial,sans-serif", 5)}
              ${svgText(150, 480, `$${productionUsd(market.currentPriceUsd)}`, 84, "#F6F4ED", 800)}
              ${svgText(155, 548, `7D ${market.changePercent7d >= 0 ? "+" : ""}${market.changePercent7d.toFixed(2)}%`, 30, accent, 800)}
              ${svgText(150, 610, `LOW $${productionUsd(market.lowPriceUsd7d)} · HIGH $${productionUsd(market.highPriceUsd7d)}`, 20, "#AABBC5", 600)}
            </g>`
          : `${logo}${svgText(410, 620, "ГРАФИЧЕСКАЯ РЕКОНСТРУКЦИЯ", 22, accent, 700)}`;
      case "DATA_VISUALIZATION":
        return `<g>
          ${gridLines("#7E9CAE", 0.12)}
          <path d="M 300 670 C 500 640 600 390 800 480 S 1150 700 1360 430 S 1600 360 1690 300" fill="none" stroke="${accent}" stroke-width="8" stroke-linecap="round" stroke-dasharray="1400" stroke-dashoffset="${((1 - progress) * 1400).toFixed(1)}"/>
          <circle cx="${300 + progress * 1340}" cy="${670 - Math.sin(progress * Math.PI * 3) * 150}" r="12" fill="#F6F4ED"/>
          ${svgText(300, 260, title, 32, "#F6F4ED", 700)}
          ${svgText(300, 760, "CONCEPT DIAGRAM · NO NUMERIC SCALE", 17, "#B8C6CE", 600, .9, "DejaVu Sans,Arial,sans-serif", 2)}
        </g>`;
      case "MARKET_CAP":
      case "MARKET_ACTIVITY":
      case "FULLSCREEN_STAT": {
        const value = event.visualType === "MARKET_CAP"
          ? market?.marketCapUsd ? `$${productionUsd(market.marketCapUsd)}` : "НЕТ ДАННЫХ"
          : event.visualType === "MARKET_ACTIVITY"
            ? market?.activity ? `$${productionUsd(market.activity.valueUsd)}` : "НЕТ ДАННЫХ"
            : title;
        const label = event.visualType === "MARKET_CAP" ? "MARKET CAPITALIZATION"
          : event.visualType === "MARKET_ACTIVITY"
            ? market?.activity?.kind === "open_interest" ? "OPEN INTEREST · VERIFIED DATA" : "TRADING VOLUME · VERIFIED DATA"
            : "SCRIPT STATEMENT · NOT A MARKET-DATA SNAPSHOT";
        const footer = event.visualType === "FULLSCREEN_STAT"
          ? "AUTHOR NARRATION · NO EXTERNAL ALL-TIME PRICE CLAIM"
          : sourceLine;
        return `<g>
          <circle cx="960" cy="480" r="${270 + progress * 50}" fill="none" stroke="${accent}" stroke-opacity=".15" stroke-width="2"/>
          <circle cx="960" cy="480" r="205" fill="none" stroke="${accent}" stroke-opacity=".28" stroke-width="2" stroke-dasharray="4 13"/>
          ${svgText(960, 282, label, 22, "#D4DDE1", 600, .92, "DejaVu Sans,Arial,sans-serif", 5, "middle")}
          ${svgText(960, 560, value, value.length > 42 ? 36 : value.length > 20 ? 48 : 92, "#F6F4ED", 800, 1, "DejaVu Sans,Arial,sans-serif", undefined, "middle")}
          ${svgText(960, 642, `${symbol} · ${name}`, 27, accent, 700, .95, "DejaVu Sans,Arial,sans-serif", 3, "middle")}
          ${svgText(960, 820, footer, 15, "#B8C6CE", 600, .88, "DejaVu Sans,Arial,sans-serif", 1.6, "middle")}
        </g>`;
      }
      case "COIN_COMPARISON":
        return market && event.comparisonSymbols.length
          ? `<g>
              <path d="M 960 320 V 800" stroke="#91A3AD" stroke-opacity=".3" stroke-width="2"/>
              <path d="M 350 460 H 1570" stroke="#7F929E" stroke-opacity=".36" stroke-width="2"/>
              ${[
                { symbol, change: market.changePercent7d, color: accent },
                ...event.comparisonSymbols
                  .map((benchmarkSymbol) => market.benchmarks.find((item) => item.symbol.toLocaleUpperCase("en-US") === benchmarkSymbol))
                  .filter((item): item is NonNullable<typeof item> => Boolean(item))
                  .slice(0, 2)
                  .map((item, index) => ({ symbol: item.symbol, change: item.changePercent7d, color: index ? "#B7C5CF" : MINT })),
              ].map((item, index) => {
                const y = 400 + index * 145;
                const length = Math.min(510, Math.abs(item.change) * 23) * Math.sign(item.change || 1) * progress;
                return `<path d="M 960 ${y} H ${960 + length}" stroke="${item.color}" stroke-width="15" stroke-linecap="round"/>
                  ${svgText(350, y + 8, item.symbol, 24, "#DEE5E8", 700, 1, "DejaVu Sans,Arial,sans-serif", 4)}
                  ${svgText(1510, y + 10, `${item.change >= 0 ? "+" : ""}${item.change.toFixed(2)}%`, 27, item.color, 800, 1, "DejaVu Sans,Arial,sans-serif", undefined, "end")}`;
              }).join("")}
              ${svgText(960, 860, "MATCHED 7-DAY WINDOW · VERIFIED SOURCE", 16, "#B8C6CE", 600, .88, "DejaVu Sans,Arial,sans-serif", 2, "middle")}
            </g>`
          : `<g>
              <path d="M 960 340 V 720" stroke="#91A3AD" stroke-opacity=".4" stroke-width="2"/>
              <path d="M 390 520 H 1530" stroke="${accent}" stroke-opacity=".55" stroke-width="4"/>
              <circle cx="620" cy="520" r="82" fill="#0B141C" stroke="${accent}" stroke-width="3"/>
              <circle cx="1300" cy="520" r="82" fill="#0B141C" stroke="${MINT}" stroke-width="3"/>
              ${svgText(620, 530, symbol || "COIN", 25, "#F6F4ED", 800, 1, "DejaVu Sans,Arial,sans-serif", 2, "middle")}
              ${svgText(1300, 530, "SCRIPT", 22, "#F6F4ED", 800, 1, "DejaVu Sans,Arial,sans-serif", 2, "middle")}
              ${svgText(960, 760, "ILLUSTRATIVE COMPARISON · NO METRICS ADDED", 16, "#B8C6CE", 600, .9, "DejaVu Sans,Arial,sans-serif", 2, "middle")}
            </g>`;
      case "TIMELINE":
        return `<g>
          <path d="M 250 670 H 1660" stroke="#6B8798" stroke-width="4" stroke-opacity=".55"/>
          <path d="M 250 670 H ${250 + 1410 * progress}" stroke="url(#gold)" stroke-width="7" stroke-linecap="round"/>
          ${[0, 1, 2, 3, 4].map((index) => `<circle cx="${250 + index * 352}" cy="670" r="${index === 4 ? 11 : 7}" fill="${index === 4 ? ACCENT : "#A9BBC7"}" opacity="${.45 + .45 * progress}"/>`).join("")}
          ${logo}
          ${svgText(420, 625, title, 32, "#F6F4ED", 700)}
          ${svgText(250, 740, input.researchContext?.genesisDate
            ? `GENESIS ${input.researchContext.genesisDate} · ${input.researchContext.sourceLabel}`
            : "СХЕМА ПО ТЕКСТУ СЦЕНАРИЯ · БЕЗ НЕПОДТВЕРЖДЁННЫХ ДАТ", 16, "#B8C6CE", 600, .9)}
        </g>`;
      case "RISK_WARNING":
        return `<g>
          <path d="M 960 250 L 1480 760 H 440 Z" fill="#1A1117" stroke="${ROSE}" stroke-width="4" stroke-opacity=".85"/>
          <path d="M 960 392 V 572" stroke="${ROSE}" stroke-width="20" stroke-linecap="round"/><circle cx="960" cy="630" r="12" fill="${ROSE}"/>
          ${svgText(960, 830, "РИСК · ПО ТЕКСТУ СЦЕНАРИЯ", 20, "#F0C8CF", 700, .95, "DejaVu Sans,Arial,sans-serif", 3, "middle")}
        </g>`;
      case "BLOCKCHAIN_NETWORK":
      case "ECOSYSTEM_MAP":
      case "TECHNOLOGY_EXPLAINER":
      case "COMMUNITY":
      case "PERSON_PROFILE":
        return `<g>
          ${Array.from({ length: 12 }, (_, index) => {
            const angle = index * Math.PI / 6 + progress * .18;
            const x = 960 + Math.cos(angle) * (240 + (index % 3) * 68);
            const y = 500 + Math.sin(angle) * (155 + (index % 3) * 46);
            return `<path d="M 960 500 L ${x.toFixed(1)} ${y.toFixed(1)}" stroke="${accent}" stroke-opacity=".26" stroke-width="2"/><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${6 + index % 3}" fill="${accent}" fill-opacity=".82"/>`;
          }).join("")}
          <circle cx="960" cy="500" r="74" fill="#0B141C" stroke="${accent}" stroke-width="3"/>
          ${svgText(960, 508, symbol || "NETWORK", symbol ? 24 : 16, "#F6F4ED", 800, 1, "DejaVu Sans,Arial,sans-serif", 1, "middle")}
          ${event.visualType === "TECHNOLOGY_EXPLAINER" && input.researchContext?.hashingAlgorithm
            ? svgText(960, 680, `VERIFIED ALGORITHM · ${input.researchContext.hashingAlgorithm}`, 18, "#DCE5EA", 600, .92, "DejaVu Sans,Arial,sans-serif", 2, "middle")
            : ""}
          ${svgText(960, 794, "ИЛЛЮСТРАЦИЯ · НЕ СХЕМА РЕАЛЬНОЙ ИНФРАСТРУКТУРЫ", 16, "#B8C6CE", 600, .9, "DejaVu Sans,Arial,sans-serif", 2, "middle")}
        </g>`;
      case "NEWS_EDITORIAL":
      case "QUOTE":
        return `<g>
          <path d="M 245 280 L 820 252 L 850 710 L 274 734 Z" fill="${PAPER}" stroke="#C9BDA7" stroke-width="3"/>
          <path d="M 1070 300 L 1668 274 L 1640 714 L 1040 736 Z" fill="#E7DDC8" stroke="#B8AA91" stroke-width="3"/>
          ${svgText(310, 390, event.visualType === "QUOTE" ? "ЦИТАТА ИЗ СЦЕНАРИЯ" : "РЕДАКЦИОННЫЙ МАКЕТ", 27, "#1E272B", 800)}
          ${svgText(310, 475, title, 30, "#263036", 700)}
          ${[0, 1, 2, 3].map((index) => `<path d="M 310 ${530 + index * 42} H ${740 - index * 34}" stroke="#55574F" stroke-opacity=".55" stroke-width="5"/>`).join("")}
          <path d="M 900 210 L 1080 210 L 1410 830 L 1230 830 Z" fill="${accent}" opacity=".45"/>
          ${svgText(1650, 822, "RECONSTRUCTION · NOT A REAL PUBLICATION", 14, "#D5DDE2", 600, .9, "DejaVu Sans,Arial,sans-serif", 1.5, "end")}
        </g>`;
      default:
        return `<g>
          ${logo}
          <path d="M 565 650 C 760 360 1110 360 1350 610" fill="none" stroke="${accent}" stroke-opacity=".74" stroke-width="4" stroke-dasharray="10 20"/>
          <circle cx="${600 + progress * 720}" cy="${630 - progress * 170}" r="12" fill="${accent}"/>
          ${svgText(440, 290, "ILLUSTRATIVE · NO UNSOURCED CLAIMS", 18, accent, 700, .95, "DejaVu Sans,Arial,sans-serif", 3)}
          ${svgText(440, 505, title, 36, "#F6F4ED", 700)}
        </g>`;
    }
  })();
  const image = input.visualAssetDataUri
    ? `<image href="${xml(input.visualAssetDataUri)}" x="0" y="0" width="${WIDTH}" height="${HEIGHT}" preserveAspectRatio="xMidYMid slice"/><rect width="${WIDTH}" height="${HEIGHT}" fill="#07111B" fill-opacity=".66"/>`
    : `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <title>${xml(event.visualConcept)}</title><desc>${xml(event.assetDescription)}</desc>
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14232D"/><stop offset=".55" stop-color="#08121B"/><stop offset="1" stop-color="#04080D"/></linearGradient><linearGradient id="gold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#C98731"/><stop offset=".55" stop-color="#FFE39B"/><stop offset="1" stop-color="#D89535"/></linearGradient><pattern id="grid" width="80" height="80" patternUnits="userSpaceOnUse"><path d="M 80 0 L 0 0 0 80" fill="none" stroke="#C9D8EE" stroke-opacity=".045" stroke-width="1"/></pattern></defs>
    ${image}<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)" opacity=".52"/>
    <path d="M 105 114 H 430" stroke="${accent}" stroke-opacity=".78" stroke-width="4"/><circle cx="105" cy="114" r="7" fill="${accent}"/>
    ${svgText(145, 174, `${event.visualType.replaceAll("_", " ")} · ${symbol || "FINANCE"}`, 16, "#B8C6CE", 700, .9, "DejaVu Sans Mono,monospace", 2)}
    ${scene}${svgText(145, 1012, `${title} · ${sourceLine}`, 14, "#B8C6CE", 600, .84, "DejaVu Sans,Arial,sans-serif", 1)}
  </svg>`;
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
        ${svgText(152, 386, "HISTORICAL ORIGIN", 17, "#D8E1E5", 600, 0.64, "DejaVu Sans,Arial,sans-serif", 3)}
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
  const filmOverlay = `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#vignette)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grain)" opacity=".22"/>
    <path d="M 0 38 H ${WIDTH} M 0 1042 H ${WIDTH}" stroke="#ECF0EF" stroke-opacity=".13" stroke-width="1"/>
    ${headerTitle}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${commonDefs}
    ${background}
    ${midground}
    ${foreground}
    ${filmOverlay}
  </svg>`;
}

function normalizeWord(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function isCoinName(normalized: string): boolean {
  return ["dogecoin", "doge", "биткоин", "биткойн", "btc", "монет", "криптовалют"]
    .some((stem) => normalized.startsWith(stem));
}

function financeV2Tone(word: string): KineticSubtitleTone {
  const normalized = normalizeWord(word);
  const normalTone = classifyKineticSubtitleTone(word);
  if (normalTone !== "white") return normalTone;
  if (isCoinName(normalized)) return "accent";
  if (/^(резк|огром|гигант|появ|возник|генезис|истор|результ|итог|смысл|значим)/u.test(normalized)) {
    return "gold";
  }
  if (/^(сравн|сопостав|контекст|сообществ|популярн)/u.test(normalized)) return "accent";
  if (/^(исчез|пропал|утрат|риск|опас|угроз)/u.test(normalized)) return "red";
  return "white";
}

function financeV2Intensity(tone: KineticSubtitleTone): "dynamic" | "impact" {
  return tone === "accent" ? "dynamic" : "impact";
}

export function buildPremiumFinanceV2SubtitleEmphasisEvents(
  words: KineticSubtitleWord[],
  directorEvents: KineticSubtitleEmphasisEvent[] = [],
): KineticSubtitleEmphasisEvent[] {
  const eventsByWordAndTime = new Map<string, KineticSubtitleEmphasisEvent>();
  for (const event of directorEvents) {
    const key = `${event.startMs}:${normalizeWord(event.word)}`;
    eventsByWordAndTime.set(key, event);
  }
  for (const word of words) {
    const tone = financeV2Tone(word.text);
    if (tone === "white") continue;
    const key = `${word.startMs}:${normalizeWord(word.text)}`;
    if (!eventsByWordAndTime.has(key)) {
      eventsByWordAndTime.set(key, {
        word: word.text,
        startMs: word.startMs,
        endMs: word.endMs,
        intensity: financeV2Intensity(tone),
        tone,
      });
    }
  }
  return [...eventsByWordAndTime.values()].sort((left, right) =>
    left.startMs - right.startMs || left.endMs - right.endMs,
  );
}

export function alignPremiumFinanceV2SfxEvents<T extends { sceneId: number; startMs: number }>(
  sfxEvents: T[],
  windows: PremiumFinanceV2SceneWindow[],
  subtitleEvents: KineticSubtitleEmphasisEvent[],
): T[] {
  return sfxEvents.map((event) => {
    const window = windows.find((candidate) => candidate.sceneId === event.sceneId);
    if (!window) return event;
    const nearestKeyWord = subtitleEvents
      .filter((subtitleEvent) =>
        subtitleEvent.startMs >= window.startMs
        && subtitleEvent.startMs < window.endMs
        && subtitleEvent.endMs > window.startMs,
      )
      .sort((left, right) =>
        Math.abs(left.startMs - event.startMs) - Math.abs(right.startMs - event.startMs),
      )[0];
    if (!nearestKeyWord || Math.abs(nearestKeyWord.startMs - event.startMs) > 2_500) return event;
    return { ...event, startMs: nearestKeyWord.startMs };
  });
}

function kineticLayout(rect: PremiumFinanceV2SafeRect): KineticSubtitleLayout {
  const alignment: KineticSubtitleLayout["alignment"] =
    rect.placement.includes("center") || rect.placement === "top" || rect.placement === "bottom"
      ? "center"
      : rect.placement.includes("right")
        ? "right"
        : "left";
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, alignment };
}

function financeV2AnimationPreset(input: {
  word: KineticSubtitleWord;
  tone: KineticSubtitleTone;
  emphasis?: KineticSubtitleEmphasisEvent;
  wordIndex: number;
}): KineticSubtitleAnimationPreset {
  const normalized = normalizeWord(input.word.text);
  if (/^(сравн|сопостав)/u.test(normalized)) {
    return input.wordIndex % 2 === 0 ? "WORD_FLY_IN" : "WORD_SLIDE";
  }
  if (/^(вырос|рост|увелич|подня|повыс|укреп|прибав)/u.test(normalized)) return "WORD_RISE";
  if (/^(пад|сниж|сократ|просад|обвал|рухнул|убыт|исчез|пропал|утрат)/u.test(normalized)) {
    return normalized.startsWith("исчез") || normalized.startsWith("пропал")
      ? "WORD_SHRINK"
      : "WORD_DROP";
  }
  if (/^(появ|возник|генезис|начал|открыл)/u.test(normalized)) return "PHRASE_REVEAL";
  if (/^(резк|сильн|огром|гигант|рекорд)/u.test(normalized)) return "WORD_PUNCH";
  if (/\d|[%‰]/u.test(input.word.text)) return "WORD_PUNCH";
  if (isCoinName(normalized)) return "WORD_MASK_REVEAL";
  if (input.tone === "green") return "WORD_RISE";
  if (input.tone === "red") return "WORD_DROP";
  if (input.tone === "gold") return "WORD_PUNCH";
  if (input.emphasis?.intensity === "impact") return "WORD_PUNCH";
  if (input.emphasis) return "WORD_SCALE";
  return "WORD_STAGGER";
}

export function buildPremiumFinanceV2KineticAss(input: {
  words: KineticSubtitleWord[];
  windows: PremiumFinanceV2SceneWindow[];
  emphasisEvents: KineticSubtitleEmphasisEvent[];
  durationMs: number;
}): { ass: string; wordCount: number; phraseCount: number } {
  if (!input.words.length) throw new Error("Cinematic V2 subtitles require timestamped words");
  const dialogueLines: string[] = [];
  let wordCount = 0;
  let phraseCount = 0;
  for (const window of input.windows) {
    const layout = kineticLayout(getPremiumFinanceV2SceneComposition(window.sceneId).safeRect);
    const sceneWords = input.words
      .filter((word) =>
        word.startMs >= window.startMs
        && word.startMs < window.endMs
        && word.startMs < input.durationMs
        && word.endMs > word.startMs,
      )
      .sort((left, right) => left.startMs - right.startMs);
    if (!sceneWords.length) continue;
    const directorEvents = input.emphasisEvents.filter((event) =>
      event.startMs < window.endMs && event.endMs > window.startMs,
    );
    const result = buildLongformKineticSubtitleAss({
      words: sceneWords,
      durationMs: input.durationMs,
      width: WIDTH,
      height: HEIGHT,
      emphasisEvents: directorEvents,
      layoutForPhrase: () => layout,
      animationForWord: ({ word, tone, emphasis, wordIndex }) =>
        financeV2AnimationPreset({ word, tone, emphasis, wordIndex }),
      cinematicTypography: {
        bodyMinPx: 56,
        bodyMaxPx: 88,
        keyMinPx: 92,
        keyMaxPx: 144,
        keyScale: 1.32,
      },
      maxWordsPerPhrase: 2,
    });
    wordCount += result.wordCount;
    phraseCount += result.phraseCount;
    dialogueLines.push(...result.ass.split("\n").filter((line) => line.startsWith("Dialogue: ")));
  }

  if (!dialogueLines.length) throw new Error("Cinematic V2 subtitle layout produced no visible word events");
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
      "Style: Kinetic,DejaVu Sans,88,&H00F6F4ED,&H00F6F4ED,&H00101822,&H00000000,-1,0,1,5,2,5,96,96,0,1",
      "",
      "[Events]",
      "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
      ...dialogueLines,
      "",
    ].join("\n"),
    wordCount,
    phraseCount,
  };
}
