import type { KineticSubtitleWord } from "./longform-kinetic-subtitles";

export const CRYPTO_DOCUMENTARY_VISUAL_TYPES = [
  "HISTORY_DOCUMENTARY",
  "PRICE_CHART",
  "MARKET_MOVEMENT",
  "FULLSCREEN_IMPACT",
  "FULLSCREEN_STAT",
  "COIN_COMPARISON",
  "NEWS_EDITORIAL",
  "COMMUNITY",
] as const;

export type CryptoDocumentaryVisualType = typeof CRYPTO_DOCUMENTARY_VISUAL_TYPES[number];

export type CryptoDocumentaryMarket = {
  dataAsOf: string;
  sourceLabel: string;
  sourceUrl: string;
  priceSamples: number[];
  riseSegment: { fromIndex: number; toIndex: number; changePercent: number } | null;
  drawdownSegment: { fromIndex: number; toIndex: number; changePercent: number } | null;
  changePercent7d: number;
  bitcoinChangePercent7d: number;
  marketCapUsd: number;
};

export type CryptoDocumentaryNarrationScene = {
  sceneId: number;
  text: string;
};

export type CryptoDocumentaryScene = {
  index: number;
  sourceSceneId: number;
  visualType: CryptoDocumentaryVisualType;
  voiceText: string;
  startMs: number;
  endMs: number;
  voiceStartMs: number;
  voiceEndMs: number;
  layout: string;
  dominantVisual: string;
  assets: string[];
  composition: string;
  animation: string;
  visualDominancePercent: number;
  subtitleMode: "small_word_synced_lower_safe_zone";
};

export type CryptoDocumentaryOverlay = {
  name: string;
  revealAtMs: number;
  svg: string;
  fadeMs?: number;
};

export type CryptoDocumentarySceneArtwork = {
  backgroundSvg: string;
  overlays: CryptoDocumentaryOverlay[];
};

const WIDTH = 1_920;
const HEIGHT = 1_080;

const SCENE_DEFINITIONS: Array<{
  sourceSceneId: number;
  visualType: CryptoDocumentaryVisualType;
  voiceText: string;
  layout: string;
  dominantVisual: string;
  assets: string[];
  composition: string;
  animation: string;
  visualDominancePercent: number;
}> = [
  {
    sourceSceneId: 3,
    visualType: "PRICE_CHART",
    voiceText: "В недельном ряду покажем измеренный восходящий фрагмент по реальным точкам, не продолжая линию в будущее.",
    layout: "full-bleed measured price landscape",
    dominantVisual: "Seven sourced price samples with the measured rising section highlighted",
    assets: ["CoinGecko seven-day price samples", "Stylized DOGE currency mark"],
    composition: "Full-frame market trace; low-contrast context segments; selected measured rise in green; start and snapshot anchors; no projected extension.",
    animation: "Seven real points draw sequentially; camera pushes into the highlighted rise and settles at the last observed point.",
    visualDominancePercent: 84,
  },
  {
    sourceSceneId: 4,
    visualType: "MARKET_MOVEMENT",
    voiceText: "В том же ряду есть нисходящий участок.",
    layout: "diagonal peak-to-trough motion field",
    dominantVisual: "Sourced downward price path from the observed local peak to trough",
    assets: ["CoinGecko seven-day price samples", "Stylized DOGE currency mark"],
    composition: "Large diagonal price path spans the frame; peak and trough are separated by a measured red descent, not a card.",
    animation: "The observed drawdown segments reveal from peak to trough with a brief endpoint impact and downward camera follow.",
    visualDominancePercent: 88,
  },
  {
    sourceSceneId: 4,
    visualType: "HISTORY_DOCUMENTARY",
    voiceText: "Он описывает прошлое снижение,",
    layout: "archival seven-day data timeline",
    dominantVisual: "A documentary record of the sourced past seven-day market interval",
    assets: ["CoinGecko seven-day price samples", "CoinGecko snapshot timestamp"],
    composition: "Warm archival paper field with a dominant measured timeline, seven sample markers, and a source/date stamp. This documents past price movement, not DOGE's origin.",
    animation: "Paper layers settle in; sample markers appear in sequence; a restrained camera push ends on the snapshot marker.",
    visualDominancePercent: 79,
  },
  {
    sourceSceneId: 4,
    visualType: "FULLSCREEN_IMPACT",
    voiceText: "а не сигнал для сделки.",
    layout: "full-bleed risk boundary",
    dominantVisual: "A measured chart line stopping at a clear past-data boundary",
    assets: ["Sourced drawdown endpoint", "Geometric warning barrier"],
    composition: "A short, edge-to-edge red/white boundary interrupts the historical line; no BUY/SELL indicator and no oversized wording.",
    animation: "A 1–2 second camera punch and brief impact flash stop the line at the boundary, then hand off to the statistic scene.",
    visualDominancePercent: 92,
  },
  {
    sourceSceneId: 5,
    visualType: "FULLSCREEN_STAT",
    voiceText: "Рыночная капитализация оценивает весь обращающийся рынок, а не цену одной монеты и не деньги на счёте.",
    layout: "full-frame market-cap monument",
    dominantVisual: "The sourced market-cap value held as the central full-frame visual",
    assets: ["CoinGecko market capitalization and snapshot timestamp", "Stylized DOGE currency mark"],
    composition: "The value fills the central field while thin circulating-market rings and a small source/time label clarify that this is market capitalization, not a coin price.",
    animation: "The sourced value holds clearly while a fine gold accent line draws beneath it and the camera eases closer.",
    visualDominancePercent: 86,
  },
  {
    sourceSceneId: 6,
    visualType: "COIN_COMPARISON",
    voiceText: "Сравним монету с биткоином за одинаковые семь дней. Один временной интервал даёт контекст, но не объясняет причины.",
    layout: "full-screen diagonal two-asset comparison",
    dominantVisual: "DOGE and BTC marks with sourced, matched-period seven-day returns",
    assets: ["CoinGecko DOGE seven-day return", "Saved BTC seven-day benchmark"],
    composition: "Two large full-height fields meet at a narrow center axis. DOGE and BTC enter on opposite sides; proportional return bars share one 7D baseline.",
    animation: "DOGE enters first, BTC follows, the shared time axis draws across both sides, then a restrained center push holds the comparison.",
    visualDominancePercent: 82,
  },
  {
    sourceSceneId: 7,
    visualType: "NEWS_EDITORIAL",
    voiceText: "Мемы и заголовки создают информационный шум. Эта сцена — абстрактная реконструкция, а не настоящая новость.",
    layout: "full-bleed editorial paper collage",
    dominantVisual: "Abstract, clearly reconstructed media fragments without fabricated headlines",
    assets: ["Original abstract vector fragments only"],
    composition: "A warm editorial spread fills the canvas with layered paper, cropped columns, and signal bars. It contains no outlet names, fake article copy, dates, or quotations.",
    animation: "Paper strips slide in on alternating masks, briefly overlap, then collapse into the community network.",
    visualDominancePercent: 80,
  },
  {
    sourceSceneId: 8,
    visualType: "COMMUNITY",
    voiceText: "У монеты есть сообщество и проекты. Не будем подменять их выдуманными числами аудитории, постами или цитатами.",
    layout: "expansive full-frame community network",
    dominantVisual: "A large DOGE mark surrounded by a growing field of generic connected nodes",
    assets: ["Stylized DOGE currency mark", "Original abstract vector network"],
    composition: "The network spans edge-to-edge around a central DOGE mark; nodes are anonymous and carry no invented counts, identities, posts, or quotes.",
    animation: "Connections draw outward, generic nodes illuminate in waves, and the camera eases back to show network scale.",
    visualDominancePercent: 82,
  },
];

const PALETTES: Record<CryptoDocumentaryVisualType, { top: string; bottom: string; accent: string; secondary: string }> = {
  PRICE_CHART: { top: "#071927", bottom: "#17374a", accent: "#72e6d3", secondary: "#a8ffd2" },
  MARKET_MOVEMENT: { top: "#180f19", bottom: "#48212a", accent: "#ff6572", secondary: "#ffc17a" },
  HISTORY_DOCUMENTARY: { top: "#332617", bottom: "#947148", accent: "#f3cf8c", secondary: "#fff1ce" },
  FULLSCREEN_IMPACT: { top: "#190b10", bottom: "#5c101b", accent: "#ff405b", secondary: "#fff4e9" },
  FULLSCREEN_STAT: { top: "#101a19", bottom: "#38543a", accent: "#f6cf5c", secondary: "#f9f3d8" },
  COIN_COMPARISON: { top: "#161426", bottom: "#342d4b", accent: "#f3ad4f", secondary: "#f9db95" },
  NEWS_EDITORIAL: { top: "#d9c8aa", bottom: "#9b8564", accent: "#2a2721", secondary: "#f4ead8" },
  COMMUNITY: { top: "#071d25", bottom: "#12505a", accent: "#73e3d3", secondary: "#d1fff5" },
};

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeWord(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function wordTokens(value: string): string[] {
  return value.trim().split(/\s+/u).filter((token) => normalizeWord(token));
}

function svgDocument(content: string, background = "transparent"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="field" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#${background === "transparent" ? "000000" : "071927"}"/>
      <stop offset="1" stop-color="#${background === "transparent" ? "000000" : "17374a"}"/>
    </linearGradient>
    <linearGradient id="coin" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff0aa"/>
      <stop offset=".48" stop-color="#e7b947"/>
      <stop offset="1" stop-color="#9d6821"/>
    </linearGradient>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff5df"/>
      <stop offset="1" stop-color="#d8c5a4"/>
    </linearGradient>
    <pattern id="grain" width="26" height="26" patternUnits="userSpaceOnUse">
      <path d="M0 25.5H26" stroke="#ffffff" stroke-opacity=".025" stroke-width="1"/>
      <circle cx="5" cy="8" r="1" fill="#ffffff" fill-opacity=".035"/>
      <circle cx="19" cy="17" r=".8" fill="#000000" fill-opacity=".035"/>
    </pattern>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${background === "transparent" ? "none" : "url(#field)"}"/>
  ${content}
</svg>`;
}

function fullSceneSvg(type: CryptoDocumentaryVisualType, content: string): string {
  const palette = PALETTES[type];
  const background = `<defs>
    <linearGradient id="sceneBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${palette.top}"/>
      <stop offset="1" stop-color="${palette.bottom}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#sceneBg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grain)"/>
  <path d="M0 1000 C520 860 1110 1100 1920 875" fill="none" stroke="${palette.secondary}" stroke-opacity=".08" stroke-width="2"/>`;
  return svgDocument(`${background}${content}`);
}

function overlaySvg(content: string): string {
  return svgDocument(content);
}

function text(
  x: number,
  y: number,
  value: string,
  size: number,
  fill: string,
  options: { anchor?: "start" | "middle" | "end"; weight?: number; opacity?: number; letterSpacing?: number } = {},
): string {
  return `<text x="${x}" y="${y}" text-anchor="${options.anchor ?? "start"}" fill="${fill}" fill-opacity="${options.opacity ?? 1}" font-family="DejaVu Sans, sans-serif" font-size="${size}" font-weight="${options.weight ?? 600}" letter-spacing="${options.letterSpacing ?? 0}">${xml(value)}</text>`;
}

function coinMark(x: number, y: number, radius: number, symbol = "Ð", accent = "#e8bd58"): string {
  return `<g transform="translate(${x} ${y})">
    <circle r="${radius}" fill="#0b1117" fill-opacity=".55" stroke="${accent}" stroke-width="${Math.max(3, radius * .075)}"/>
    <circle r="${radius * .82}" fill="url(#coin)" stroke="#fff2bf" stroke-opacity=".58" stroke-width="${Math.max(2, radius * .025)}"/>
    <text x="0" y="${radius * .37}" text-anchor="middle" fill="#533718" font-family="DejaVu Sans, sans-serif" font-size="${radius * 1.08}" font-weight="700">${xml(symbol)}</text>
  </g>`;
}

function bitcoinMark(x: number, y: number, radius: number, accent: string): string {
  const bar = Math.max(3, radius * .035);
  return `<g transform="translate(${x} ${y})">
    <circle r="${radius}" fill="#0b1117" fill-opacity=".55" stroke="${accent}" stroke-width="${Math.max(3, radius * .075)}"/>
    <circle r="${radius * .82}" fill="url(#coin)" stroke="#fff2bf" stroke-opacity=".58" stroke-width="${Math.max(2, radius * .025)}"/>
    <path d="M-${radius * .07} -${radius * .39}V${radius * .39} M${radius * .07} -${radius * .39}V${radius * .39}" fill="none" stroke="#533718" stroke-width="${bar}" stroke-linecap="round"/>
    <text x="0" y="${radius * .37}" text-anchor="middle" fill="#533718" font-family="DejaVu Sans, sans-serif" font-size="${radius * 1.08}" font-weight="700">B</text>
  </g>`;
}

function chartPoints(samples: number[], bounds = { left: 190, right: 1_760, top: 305, bottom: 790 }): Array<{ x: number; y: number }> {
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const padding = Math.max((max - min) * 0.11, 0.0001);
  const lower = min - padding;
  const upper = max + padding;
  return samples.map((value, index) => ({
    x: bounds.left + (bounds.right - bounds.left) * index / Math.max(1, samples.length - 1),
    y: bounds.bottom - (value - lower) / (upper - lower) * (bounds.bottom - bounds.top),
  }));
}

function chartGrid(points: Array<{ x: number; y: number }>, accent: string, label = "7D MARKET TRACE"): string {
  const horizontal = [335, 450, 565, 680, 795].map((y) =>
    `<line x1="130" y1="${y}" x2="1790" y2="${y}" stroke="#ffffff" stroke-opacity=".09" stroke-width="2"/>`,
  ).join("");
  const vertical = points.map((point, index) =>
    `<line x1="${point.x}" y1="290" x2="${point.x}" y2="810" stroke="${accent}" stroke-opacity="${index === 0 || index === points.length - 1 ? ".18" : ".055"}" stroke-width="2"/>`,
  ).join("");
  return `<g>${horizontal}${vertical}
    <path d="M130 825H1790" stroke="#ffffff" stroke-opacity=".32" stroke-width="3"/>
    ${text(145, 155, label, 26, "#e7f3f8", { weight: 700, letterSpacing: 4 })}
    ${text(1_775, 155, "COINGECKO • SNAPSHOT 04 OCT 2026", 20, "#d3e0e5", { anchor: "end", letterSpacing: 2, opacity: .74 })}
    ${text(145, 860, "START OF WINDOW", 18, "#cfdae0", { weight: 500, letterSpacing: 2, opacity: .8 })}
    ${text(1_775, 860, "LATEST SAMPLE", 18, "#cfdae0", { anchor: "end", weight: 500, letterSpacing: 2, opacity: .8 })}
  </g>`;
}

function lineSegmentOverlay(
  from: { x: number; y: number },
  to: { x: number; y: number },
  accent: string,
  name: string,
): CryptoDocumentaryOverlay {
  const midpointX = (from.x + to.x) / 2;
  const midpointY = (from.y + to.y) / 2;
  const path = `M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${midpointX.toFixed(1)} ${midpointY.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`;
  return {
    name,
    revealAtMs: 650,
    fadeMs: 110,
    svg: overlaySvg(`<path d="${path}" fill="none" stroke="${accent}" stroke-opacity=".26" stroke-width="30" stroke-linecap="round"/>
      <path d="${path}" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${to.x.toFixed(1)}" cy="${to.y.toFixed(1)}" r="14" fill="${accent}" stroke="#f5fbff" stroke-width="3"/>
      <circle cx="${to.x.toFixed(1)}" cy="${to.y.toFixed(1)}" r="31" fill="none" stroke="${accent}" stroke-opacity=".45" stroke-width="3"/>`),
  };
}

function dateLabel(dataAsOf: string): string {
  const date = new Date(dataAsOf);
  if (!Number.isFinite(date.getTime())) return "SOURCE SNAPSHOT";
  return `${new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date)} • ${new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(date)} UTC`;
}

export function buildCryptoDocumentaryScenePlan(input: {
  narrationScenes: CryptoDocumentaryNarrationScene[];
  subtitleWords: KineticSubtitleWord[];
  durationMs: number;
}): CryptoDocumentaryScene[] {
  const sceneById = new Map(input.narrationScenes.map((scene) => [scene.sceneId, scene]));
  const scene3 = sceneById.get(3);
  const scene4 = sceneById.get(4);
  const scene5 = sceneById.get(5);
  const scene6 = sceneById.get(6);
  const scene7 = sceneById.get(7);
  const scene8 = sceneById.get(8);
  if (!scene3 || !scene4 || !scene5 || !scene6 || !scene7 || !scene8) {
    throw new Error("Documentary plan requires the approved narration for source scenes 3–8");
  }
  const scene4Parts = [
    "В том же ряду есть нисходящий участок.",
    "Он описывает прошлое снижение,",
    "а не сигнал для сделки.",
  ];
  if (scene4.text.replace(/\s+/gu, " ").trim() !== scene4Parts.join(" ")) {
    throw new Error("Source scene 4 changed; refusing to split its approved drawdown narration");
  }
  const groups = [
    { sourceSceneId: 3, visualType: "PRICE_CHART" as const, voiceText: scene3.text },
    { sourceSceneId: 4, visualType: "MARKET_MOVEMENT" as const, voiceText: scene4Parts[0]! },
    { sourceSceneId: 4, visualType: "HISTORY_DOCUMENTARY" as const, voiceText: scene4Parts[1]! },
    { sourceSceneId: 4, visualType: "FULLSCREEN_IMPACT" as const, voiceText: scene4Parts[2]! },
    { sourceSceneId: 5, visualType: "FULLSCREEN_STAT" as const, voiceText: scene5.text },
    { sourceSceneId: 6, visualType: "COIN_COMPARISON" as const, voiceText: scene6.text },
    { sourceSceneId: 7, visualType: "NEWS_EDITORIAL" as const, voiceText: scene7.text },
    { sourceSceneId: 8, visualType: "COMMUNITY" as const, voiceText: scene8.text },
  ];
  let cursor = 0;
  const speechRanges = groups.map((group) => {
    const expected = wordTokens(group.voiceText);
    const matched = input.subtitleWords.slice(cursor, cursor + expected.length);
    if (
      matched.length !== expected.length
      || matched.some((word, index) => normalizeWord(word.text) !== normalizeWord(expected[index]!))
    ) {
      throw new Error(`Documentary scene ${group.visualType} no longer matches exact source narration`);
    }
    cursor += expected.length;
    return {
      ...group,
      voiceStartMs: matched[0]!.startMs,
      voiceEndMs: matched.at(-1)!.endMs,
    };
  });
  if (cursor !== input.subtitleWords.length) {
    throw new Error(`Documentary scene plan consumed ${cursor}/${input.subtitleWords.length} exact subtitle words`);
  }

  const boundaries = [0];
  for (let index = 1; index < speechRanges.length; index += 1) {
    const previous = speechRanges[index - 1]!;
    const current = speechRanges[index]!;
    boundaries.push(Math.round((previous.voiceEndMs + current.voiceStartMs) / 2));
  }
  boundaries.push(input.durationMs);
  const definitionByType = new Map(SCENE_DEFINITIONS.map((definition) => [definition.visualType, definition]));
  return speechRanges.map((range, index) => {
    const definition = definitionByType.get(range.visualType);
    const narration = sceneById.get(range.sourceSceneId);
    if (!definition || !narration) {
      throw new Error(`Documentary plan is missing scene definition or narration for ${range.visualType}`);
    }
    const startMs = boundaries[index]!;
    const endMs = boundaries[index + 1]!;
    if (endMs - startMs < 450) {
      throw new Error(`Documentary scene ${range.visualType} is too short to read as a distinct visual`);
    }
    return {
      index: index + 1,
      sourceSceneId: range.sourceSceneId,
      visualType: range.visualType,
      voiceText: range.voiceText,
      startMs,
      endMs,
      voiceStartMs: range.voiceStartMs,
      voiceEndMs: range.voiceEndMs,
      layout: definition.layout,
      dominantVisual: definition.dominantVisual,
      assets: definition.assets,
      composition: definition.composition,
      animation: definition.animation,
      visualDominancePercent: definition.visualDominancePercent,
      subtitleMode: "small_word_synced_lower_safe_zone",
    };
  });
}

function priceLabel(value: number): string {
  return `$${value.toFixed(4)}`;
}

function chartLines(type: "PRICE_CHART" | "MARKET_MOVEMENT", market: CryptoDocumentaryMarket): CryptoDocumentaryOverlay[] {
  const points = chartPoints(market.priceSamples);
  const overlays: CryptoDocumentaryOverlay[] = [];
  const selected = type === "PRICE_CHART" ? market.riseSegment : market.drawdownSegment;
  if (!selected) throw new Error(`Sourced ${type} segment is missing`);
  const first = type === "PRICE_CHART" ? 0 : selected.fromIndex;
  const last = type === "PRICE_CHART" ? points.length - 1 : selected.toIndex;
  const total = Math.max(1, last - first);
  for (let index = first; index < last; index += 1) {
    const highlighted = index >= selected.fromIndex && index < selected.toIndex;
    const overlay = lineSegmentOverlay(
      points[index]!,
      points[index + 1]!,
      highlighted
        ? type === "PRICE_CHART" ? "#82edab" : "#ff6674"
        : "#92afc1",
      `sample-${index + 1}-to-${index + 2}`,
    );
    overlay.revealAtMs = 450 + (index - first) * Math.min(420, Math.floor(1_250 / total));
    overlays.push(overlay);
  }
  return overlays;
}

function sceneBackground(type: CryptoDocumentaryVisualType, content: string): string {
  return fullSceneSvg(type, content);
}

export function buildCryptoDocumentaryArtwork(
  scene: CryptoDocumentaryScene,
  market: CryptoDocumentaryMarket,
): CryptoDocumentarySceneArtwork {
  const palette = PALETTES[scene.visualType];
  const values = market.priceSamples;
  if (values.length < 7 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error("Documentary scene art requires seven positive sourced DOGE price samples");
  }
  const points = chartPoints(values);
  const overlays: CryptoDocumentaryOverlay[] = [];
  let background = "";

  switch (scene.visualType) {
    case "PRICE_CHART": {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const grid = chartGrid(points, palette.accent, "DOGECOIN • MEASURED SEVEN-DAY WINDOW");
      const yLabels = [min, (min + max) / 2, max].map((value, index) =>
        text(145, [805, 575, 345][index]!, priceLabel(value), 22, "#c9d7df", { weight: 500, opacity: .72 }),
      ).join("");
      background = sceneBackground("PRICE_CHART", `<path d="M80 240H1840" stroke="#a6e7df" stroke-opacity=".18" stroke-width="2"/>
        ${text(1_760, 255, `+${Math.abs(market.riseSegment!.changePercent).toFixed(2)}%`, 98, "#a5ffc7", { anchor: "end", weight: 700 })}
        ${text(1_760, 295, "MEASURED RISE SEGMENT", 18, "#d5eee2", { anchor: "end", letterSpacing: 2, opacity: .75 })}
        ${grid}${yLabels}`);
      overlays.push(...chartLines("PRICE_CHART", market));
      break;
    }
    case "MARKET_MOVEMENT": {
      const selected = market.drawdownSegment!;
      const start = points[selected.fromIndex]!;
      const end = points[selected.toIndex]!;
      const mutedPath = points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
      background = sceneBackground("MARKET_MOVEMENT", `<path d="M0 835 L330 640 L665 685 L1025 400 L1410 505 L1920 250" fill="none" stroke="#fff" stroke-opacity=".055" stroke-width="130"/>
        <path d="M0 835 L330 640 L665 685 L1025 400 L1410 505 L1920 250" fill="none" stroke="#ff7280" stroke-opacity=".12" stroke-width="2"/>
        ${text(145, 150, "OBSERVED PRICE PATH", 25, "#ffe9e9", { weight: 700, letterSpacing: 4 })}
        ${coinMark(1_710, 140, 50, "Ð", palette.accent)}
        <path d="M${start.x} ${start.y}L${end.x} ${end.y}" stroke="#ffc17a" stroke-opacity=".16" stroke-width="3" stroke-dasharray="10 16"/>
        <polyline points="${mutedPath}" fill="none" stroke="#f4c4b4" stroke-opacity=".16" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="${start.x}" cy="${start.y}" r="20" fill="#ffca8e" fill-opacity=".32"/>
        <circle cx="${end.x}" cy="${end.y}" r="23" fill="#ff6175" fill-opacity=".4"/>
        ${text(1_725, 385, `−${Math.abs(selected.changePercent).toFixed(2)}%`, 120, "#ff8a92", { anchor: "end", weight: 700 })}
        ${text(1_725, 430, "MEASURED PEAK → TROUGH", 19, "#ffe1dd", { anchor: "end", letterSpacing: 2, opacity: .8 })}`);
      for (let index = selected.fromIndex; index < selected.toIndex; index += 1) {
        const overlay = lineSegmentOverlay(points[index]!, points[index + 1]!, "#ff6674", `drawdown-${index + 1}`);
        overlay.revealAtMs = 220 + (index - selected.fromIndex) * 300;
        overlays.push(overlay);
      }
      break;
    }
    case "HISTORY_DOCUMENTARY": {
      const timelinePoints = chartPoints(values, { left: 260, right: 1_665, top: 490, bottom: 690 });
      const stamp = dateLabel(market.dataAsOf);
      background = sceneBackground("HISTORY_DOCUMENTARY", `<rect x="95" y="92" width="1730" height="896" rx="18" fill="url(#paper)" fill-opacity=".94" stroke="#fff4d7" stroke-opacity=".72" stroke-width="3"/>
        <path d="M155 175H1760" stroke="#5b482d" stroke-opacity=".28" stroke-width="2"/>
        ${text(160, 158, "MARKET ARCHIVE / VERIFIED WINDOW", 22, "#483922", { weight: 700, letterSpacing: 3 })}
        ${text(1_750, 158, `${market.sourceLabel.toUpperCase()} • ${stamp}`, 18, "#57452b", { anchor: "end", weight: 500 })}
        ${text(160, 280, "SEVEN-DAY PRICE RECORD", 21, "#57452b", { weight: 700, letterSpacing: 2 })}
        <path d="M210 675H1710" stroke="#725832" stroke-opacity=".38" stroke-width="4"/>
        <path d="${timelinePoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ")}" fill="none" stroke="#b08b4d" stroke-opacity=".18" stroke-width="10"/>
        ${text(220, 790, "WINDOW START", 17, "#57452b", { weight: 600, letterSpacing: 2 })}
        ${text(1_710, 790, "SOURCE SNAPSHOT", 17, "#57452b", { anchor: "end", weight: 600, letterSpacing: 2 })}
        `);
      timelinePoints.forEach((point, index) => {
        overlays.push({
          name: `archive-sample-${index + 1}`,
          revealAtMs: 250 + index * 175,
          fadeMs: 100,
          svg: overlaySvg(`<circle cx="${point.x}" cy="${point.y}" r="29" fill="#8b6532" fill-opacity=".16"/>
            <circle cx="${point.x}" cy="${point.y}" r="12" fill="${index === timelinePoints.length - 1 ? "#a7443f" : "#74582f"}" stroke="#fff1cf" stroke-width="4"/>`),
        });
      });
      break;
    }
    case "FULLSCREEN_IMPACT": {
      background = sceneBackground("FULLSCREEN_IMPACT", `<path d="M-100 805 C420 770 865 360 1005 535" fill="none" stroke="#ff465f" stroke-opacity=".22" stroke-width="75"/>
        <path d="M-100 805 C420 770 865 360 1005 535" fill="none" stroke="#ffd4d5" stroke-opacity=".72" stroke-width="4"/>
        <rect x="1040" y="165" width="76" height="755" fill="#ff3c58" fill-opacity=".82"/>
        <path d="M1040 285L1116 209 M1040 405L1116 329 M1040 525L1116 449 M1040 645L1116 569 M1040 765L1116 689" stroke="#fff3eb" stroke-width="12" stroke-linecap="round"/>
        <path d="M1020 535H1175" stroke="#fff0df" stroke-opacity=".52" stroke-width="3"/>
        <circle cx="1078" cy="535" r="225" fill="none" stroke="#fff0df" stroke-opacity=".24" stroke-width="5"/>
        <circle cx="1078" cy="535" r="164" fill="none" stroke="#ff5c72" stroke-opacity=".54" stroke-width="2" stroke-dasharray="8 18"/>
        ${text(145, 155, "HISTORICAL TRACE STOPS HERE", 23, "#ffe9e6", { weight: 700, letterSpacing: 4, opacity: .86 })}`);
      overlays.push({
        name: "impact-flash",
        revealAtMs: 120,
        fadeMs: 80,
        svg: overlaySvg(`<rect width="${WIDTH}" height="${HEIGHT}" fill="#fff4e9" fill-opacity=".26"/>`),
      });
      break;
    }
    case "FULLSCREEN_STAT": {
      background = sceneBackground("FULLSCREEN_STAT", `<path d="M960 105 C1380 210 1740 540 1520 960 C1300 1380 540 1100 960 975" fill="none" stroke="${palette.accent}" stroke-opacity=".18" stroke-width="2"/>
        <circle cx="960" cy="558" r="380" fill="#09120e" fill-opacity=".16" stroke="#f5d981" stroke-opacity=".35" stroke-width="3"/>
        <circle cx="960" cy="558" r="315" fill="none" stroke="#f6d36c" stroke-opacity=".2" stroke-width="2" stroke-dasharray="2 12"/>
        ${coinMark(960, 265, 82, "Ð", palette.accent)}
        ${text(960, 415, "MARKET CAPITALIZATION", 25, "#f8f1dc", { anchor: "middle", weight: 700, letterSpacing: 6 })}
        ${text(960, 485, `${market.sourceLabel.toUpperCase()} • ${dateLabel(market.dataAsOf)}`, 16, "#d6dece", { anchor: "middle", weight: 500, letterSpacing: 1, opacity: .7 })}
        ${text(960, 660, formatCryptoDocumentaryMarketSummary(market).marketCap, 144, "#fff3c6", { anchor: "middle", weight: 700, letterSpacing: 1 })}
        ${text(960, 835, "CIRCULATING MARKET • NOT ONE COIN'S PRICE", 18, "#e1e7d6", { anchor: "middle", weight: 500, letterSpacing: 2, opacity: .8 })}
        `);
      overlays.push({
        name: "market-cap-accent-line",
        revealAtMs: 380,
        fadeMs: 180,
        svg: overlaySvg(`<path d="M650 730H1270" fill="none" stroke="#f6d36c" stroke-opacity=".68" stroke-width="4" stroke-linecap="round"/>
          <circle cx="650" cy="730" r="7" fill="#fff3c6"/><circle cx="1270" cy="730" r="7" fill="#fff3c6"/>`),
      });
      break;
    }
    case "COIN_COMPARISON": {
      const dogeValue = market.changePercent7d;
      const btcValue = market.bitcoinChangePercent7d;
      const centerX = 960;
      const barScale = 104;
      const dogeWidth = Math.abs(dogeValue) * barScale;
      const btcWidth = Math.abs(btcValue) * barScale;
      background = sceneBackground("COIN_COMPARISON", `<path d="M0 0H960L610 1080H0Z" fill="#241b2b" fill-opacity=".78"/>
        <path d="M960 0H1920V1080H610Z" fill="#3e312d" fill-opacity=".58"/>
        <path d="M960 70L610 1010" stroke="#f6e5c7" stroke-opacity=".46" stroke-width="3"/>
        ${coinMark(460, 320, 122, "Ð", "#efbd50")}
        ${bitcoinMark(1460, 320, 122, "#f49344")}
        ${text(460, 495, "DOGE", 35, "#fff1d1", { anchor: "middle", weight: 700, letterSpacing: 4 })}
        ${text(1460, 495, "BTC", 35, "#ffdfc2", { anchor: "middle", weight: 700, letterSpacing: 4 })}
        ${text(460, 563, "SAME 7D WINDOW", 17, "#e7d8bd", { anchor: "middle", weight: 500, letterSpacing: 2 })}
        ${text(1460, 563, "SAME 7D WINDOW", 17, "#e7d8bd", { anchor: "middle", weight: 500, letterSpacing: 2 })}
        <path d="M270 700H650M1270 700H1650" stroke="#ffffff" stroke-opacity=".2" stroke-width="5" stroke-linecap="round"/>
        <path d="M960 680V820" stroke="#fff3db" stroke-opacity=".52" stroke-width="2"/>
        ${text(960, 748, "VS", 22, "#fff5de", { anchor: "middle", weight: 700, letterSpacing: 2 })}
        ${text(460, 875, "−4.76%", 71, "#ff8f8f", { anchor: "middle", weight: 700 })}
        ${text(1460, 875, "+0.29%", 71, "#8ff0bd", { anchor: "middle", weight: 700 })}
        ${text(960, 620, "SOURCED SEVEN-DAY RETURNS • CONTEXT, NOT CAUSATION", 17, "#ebe1d0", { anchor: "middle", weight: 500, letterSpacing: 2, opacity: .76 })}`);
      overlays.push({
        name: "doge-return-bar",
        revealAtMs: 450,
        fadeMs: 120,
        svg: overlaySvg(`<path d="M960 700H${960 - dogeWidth}M960 700H${960 + btcWidth}" stroke="transparent" stroke-width="1"/>
          <path d="M960 700H${960 - dogeWidth}" stroke="#ff697c" stroke-opacity=".33" stroke-width="34" stroke-linecap="round"/>
          <path d="M960 700H${960 - dogeWidth}" stroke="#ff8691" stroke-width="11" stroke-linecap="round"/>
          <path d="M960 700H${960 + btcWidth}" stroke="#84e8ae" stroke-opacity=".35" stroke-width="34" stroke-linecap="round"/>
          <path d="M960 700H${960 + btcWidth}" stroke="#a5f4c4" stroke-width="11" stroke-linecap="round"/>`),
      });
      break;
    }
    case "NEWS_EDITORIAL": {
      background = sceneBackground("NEWS_EDITORIAL", `<rect x="95" y="95" width="1730" height="890" fill="#e8dcc5" stroke="#3b3328" stroke-opacity=".45" stroke-width="3"/>
        <path d="M150 190H1770" stroke="#27231e" stroke-width="5"/>
        ${text(155, 158, "EDITORIAL RECONSTRUCTION", 19, "#342b22", { weight: 700, letterSpacing: 4 })}
        <path d="M190 270H875M190 305H820M190 340H850M190 375H735" stroke="#52483a" stroke-opacity=".34" stroke-width="7" stroke-linecap="round"/>
        <path d="M1020 260H1715M1020 295H1660M1020 330H1700M1020 365H1590" stroke="#52483a" stroke-opacity=".27" stroke-width="7" stroke-linecap="round"/>
        <rect x="205" y="465" width="620" height="315" fill="#c1ad8b" fill-opacity=".56"/>
        <path d="M245 725L380 600L470 670L600 535L785 725" fill="none" stroke="#62533e" stroke-opacity=".57" stroke-width="9"/>
        <rect x="1020" y="460" width="650" height="330" fill="#998669" fill-opacity=".27"/>
        <path d="M0 0L870 0L1010 1080L0 1080Z" fill="#151411" fill-opacity=".055"/>
        ${text(1750, 158, "NO REAL ARTICLE OR QUOTE", 17, "#3d3327", { anchor: "end", weight: 600, letterSpacing: 2 })}`);
      overlays.push(
        {
          name: "editorial-strip-left",
          revealAtMs: 180,
          fadeMs: 160,
          svg: overlaySvg(`<g transform="rotate(-4 560 510)">
            <rect x="115" y="420" width="760" height="300" rx="4" fill="url(#paper)" stroke="#3c3327" stroke-opacity=".5" stroke-width="3"/>
            <path d="M165 480H810M165 520H765M165 560H790M165 600H710M165 640H790" stroke="#40382d" stroke-opacity=".3" stroke-width="8" stroke-linecap="round"/>
          </g>`),
        },
        {
          name: "editorial-strip-right",
          revealAtMs: 720,
          fadeMs: 180,
          svg: overlaySvg(`<g transform="rotate(5 1340 520)">
            <rect x="1015" y="410" width="720" height="335" rx="4" fill="#eee2cd" stroke="#3b3024" stroke-opacity=".5" stroke-width="3"/>
            <path d="M1075 470H1680M1075 510H1630M1075 550H1665M1075 590H1585M1075 630H1660" stroke="#40382d" stroke-opacity=".28" stroke-width="8" stroke-linecap="round"/>
          </g>`),
        },
      );
      break;
    }
    case "COMMUNITY": {
      const center = { x: 960, y: 555 };
      const nodes = Array.from({ length: 22 }, (_, index) => {
        const angle = index * Math.PI * (3 - Math.sqrt(5));
        const radius = 190 + (index % 4) * 115;
        return {
          x: Math.round(center.x + Math.cos(angle) * radius),
          y: Math.round(center.y + Math.sin(angle) * radius * .63),
          r: 8 + (index % 3) * 3,
        };
      });
      const links = nodes.map((node, index) => {
        const next = nodes[(index + 5) % nodes.length]!;
        return `<line x1="${node.x}" y1="${node.y}" x2="${next.x}" y2="${next.y}" stroke="${palette.accent}" stroke-opacity=".19" stroke-width="2"/>`;
      }).join("");
      background = sceneBackground("COMMUNITY", `<path d="M960 100V1010M130 555H1790M270 260L1650 850M310 850L1620 275" stroke="#8bf1df" stroke-opacity=".07" stroke-width="2"/>
        ${links}
        ${text(960, 130, "COMMUNITY • PROJECTS • NETWORK", 22, "#ddfff8", { anchor: "middle", weight: 700, letterSpacing: 4, opacity: .8 })}
        ${coinMark(center.x, center.y, 112, "Ð", palette.accent)}`);
      for (let groupStart = 0; groupStart < nodes.length; groupStart += 6) {
        const group = nodes.slice(groupStart, groupStart + 6);
        const groupIndex = Math.floor(groupStart / 6);
        overlays.push({
          name: `community-node-wave-${groupIndex + 1}`,
          revealAtMs: 180 + groupIndex * 250,
          fadeMs: 160,
          svg: overlaySvg(group.map((node, index) => `<circle cx="${node.x}" cy="${node.y}" r="${node.r + 18}" fill="none" stroke="${palette.accent}" stroke-opacity=".24" stroke-width="2"/>
            <circle cx="${node.x}" cy="${node.y}" r="${node.r}" fill="${(groupStart + index) % 4 === 0 ? "#eafff8" : palette.accent}" fill-opacity=".92"/>`).join("")),
        });
      }
      break;
    }
  }

  return { backgroundSvg: background, overlays };
}

export function formatCryptoDocumentaryMarketSummary(market: CryptoDocumentaryMarket): {
  dogeSevenDayPercent: string;
  bitcoinSevenDayPercent: string;
  marketCap: string;
  drawdownPeakToTroughPercent: string;
  riseSegmentPercent: string;
} {
  return {
    dogeSevenDayPercent: `${market.changePercent7d >= 0 ? "+" : "−"}${Math.abs(market.changePercent7d).toFixed(2)}%`,
    bitcoinSevenDayPercent: `${market.bitcoinChangePercent7d >= 0 ? "+" : "−"}${Math.abs(market.bitcoinChangePercent7d).toFixed(2)}%`,
    marketCap: `$${(market.marketCapUsd / 1_000_000_000).toFixed(2)}B`,
    drawdownPeakToTroughPercent: `−${Math.abs(market.drawdownSegment?.changePercent ?? 0).toFixed(2)}%`,
    riseSegmentPercent: `+${Math.abs(market.riseSegment?.changePercent ?? 0).toFixed(2)}%`,
  };
}
