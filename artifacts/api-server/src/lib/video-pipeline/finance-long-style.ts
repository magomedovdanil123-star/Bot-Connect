import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  ETHEREUM_MOTION_COLORS,
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY,
  createFinanceLongMotionFontConfig,
} from "./ethereum-motion-design";

const execFileAsync = promisify(execFile);

export const FINANCE_LONG_VISUAL_PROFILE_KEY = "finance_long_v4_visual_profile";
export const FINANCE_LONG_THEME_INDEX_KEY = "finance_long_v4_theme_index";
export const FINANCE_LONG_COIN_HISTORY_PROFILE_KEY = "finance_long_coin_history_documentary_v1";

export const FINANCE_LONG_THEMES = [
  {
    name: "graphite-terracotta",
    primary: "0xc45b3a",
    secondary: "0xe6af88",
    contrast: "0xf4e8d6",
    title: "0xfff5e9",
    darkBackground: true,
  },
  {
    name: "chocolate-cool-blue",
    primary: "0x9ec3d3",
    secondary: "0xe9dac7",
    contrast: "0xf7f5f0",
    title: "0xfffcf6",
    darkBackground: true,
  },
  {
    name: "plum-powder-pink",
    primary: "0xd69fb4",
    secondary: "0xf2d9d5",
    contrast: "0xfaf2ec",
    title: "0xfff8f4",
    darkBackground: true,
  },
  {
    name: "graphite-cobalt",
    primary: "0x4678c2",
    secondary: "0xe3cb88",
    contrast: "0xf4f2ea",
    title: "0xfff9eb",
    darkBackground: true,
  },
] as const;

export type FinanceLongThemeIndex = 0 | 1 | 2 | 3;

export type FinanceLongVisualConfig = {
  enabled: boolean;
  themeIndex: FinanceLongThemeIndex;
  keepLegacyCoinOverviewFlag: boolean;
  documentaryCoinHistory: boolean;
  paletteMode: "default" | "aptos" | "ethereum-motion" | "pump-dynamic";
  ethereumMotion: boolean;
  frameRate: 30 | 60;
};

function normalizeThemeIndex(value: number): FinanceLongThemeIndex {
  const normalized = Math.abs(Math.trunc(value)) % FINANCE_LONG_THEMES.length;
  return normalized as FinanceLongThemeIndex;
}

export function getFinanceLongThemeIndex(seed: string): FinanceLongThemeIndex {
  let hash = 0x811c9dc5;
  for (const character of seed.trim().toLocaleLowerCase("ru-RU")) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return normalizeThemeIndex(hash >>> 0);
}

export function applyFinanceLongVisualProfile<T extends object>(
  script: T,
  themeIndex: number,
  keepLegacyCoinOverviewFlag = false,
  documentaryCoinHistory = false,
): T & Record<string, unknown> {
  return {
    ...script,
    [FINANCE_LONG_VISUAL_PROFILE_KEY]: true,
    [FINANCE_LONG_THEME_INDEX_KEY]: normalizeThemeIndex(themeIndex),
    ...(keepLegacyCoinOverviewFlag ? { coin_overview_long_visual_profile: true } : {}),
    ...(documentaryCoinHistory ? { [FINANCE_LONG_COIN_HISTORY_PROFILE_KEY]: true } : {}),
  };
}

export function withFinanceLongVisualProfile<T extends object>(
  script: T,
  topic: string,
  keepLegacyCoinOverviewFlag = false,
  documentaryCoinHistory = false,
): T & Record<string, unknown> {
  return applyFinanceLongVisualProfile(
    script,
    documentaryCoinHistory ? 0 : getFinanceLongThemeIndex(topic),
    keepLegacyCoinOverviewFlag,
    documentaryCoinHistory,
  );
}

export function resolveFinanceLongVisualConfig(
  format: string,
  metadata: Record<string, unknown>,
  topic: string,
): FinanceLongVisualConfig {
  const keepLegacyCoinOverviewFlag = metadata.coin_overview_long_visual_profile === true;
  const documentaryCoinHistory = metadata[FINANCE_LONG_COIN_HISTORY_PROFILE_KEY] === true;
  const isFinanceLongFormat = format.trim().toLocaleLowerCase("en-US") === "youtube finance long video";
  const ethereumMotion = isFinanceLongFormat
    && metadata[FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY] === FINANCE_LONG_ETHEREUM_MOTION_PROFILE;
  // Finance Long is a format-level visual profile: every Telegram entry path
  // resolves to the same editorial renderer, independent of project metadata.
  const enabled = isFinanceLongFormat;
  const storedThemeIndex = metadata[FINANCE_LONG_THEME_INDEX_KEY];
  const themeIndex = documentaryCoinHistory
    ? 0
    : typeof storedThemeIndex === "number" && Number.isInteger(storedThemeIndex)
    ? normalizeThemeIndex(storedThemeIndex)
    : getFinanceLongThemeIndex(topic);

  const paletteMode = ethereumMotion
    ? "ethereum-motion"
    : isFinanceLongFormat ? "pump-dynamic" : "default";

  return {
    enabled,
    themeIndex,
    keepLegacyCoinOverviewFlag,
    documentaryCoinHistory,
    paletteMode,
    ethereumMotion,
    frameRate: ethereumMotion ? 60 : 30,
  };
}

export function getFinanceLongBackgroundPath(themeIndex: number): string {
  const fileName = FINANCE_LONG_THEMES[normalizeThemeIndex(themeIndex)].name;
  const relativePath = `attached_assets/references/long-video-palettes/backgrounds/${fileName}.jpg`;
  const candidates = [
    resolve(process.cwd(), "../../", relativePath),
    resolve(process.cwd(), relativePath),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(`Finance Long palette background is missing: ${relativePath}`);
  }
  return path;
}

type StoryboardScene = {
  scene_number: number;
  voice_text: string;
  visual_description: string;
  image_prompt?: string;
};

type StoryboardScript = {
  title: string;
  scenes: StoryboardScene[];
};

type StoryboardMotif = "market" | "network" | "record" | "timeline" | "risk" | "access" | "asset";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getStoryboardMotif(scene: StoryboardScene): StoryboardMotif {
  const text = `${scene.visual_description}\n${scene.image_prompt || ""}`.toLocaleLowerCase("ru-RU");
  if (/сеть|блокчейн|узел|транзакц|подтвержден/u.test(text)) return "network";
  if (/график|цена|рынок|объ[её]м|капитализац|динамик/u.test(text)) return "market";
  if (/доступ|кошел|пользоват|перевод|комисси/u.test(text)) return "access";
  if (/истори|этап|врем|запуск|период|год/u.test(text)) return "timeline";
  if (/документ|резерв|эмисс|токен|предложен|команд/u.test(text)) return "record";
  if (/риск|угроз|уязв|щит|защит|волат|падени|потер|ограничен/u.test(text)) return "risk";
  return "asset";
}

function storyboardMotifLabel(motif: StoryboardMotif): string {
  switch (motif) {
    case "market": return "ДИНАМИКА АКТИВА";
    case "network": return "СЕТЬ И СВЯЗИ";
    case "record": return "ФАКТЫ И ДОКУМЕНТЫ";
    case "timeline": return "ХРОНОЛОГИЯ";
    case "risk": return "ОГРАНИЧЕНИЯ";
    case "access": return "ДОСТУП И ИСПОЛЬЗОВАНИЕ";
    case "asset": return "ОБРАЗ АКТИВА";
  }
}

function spokenExcerpt(value: string, maxWords = 7): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value.trim();
  return `${words.slice(0, maxWords).join(" ")}…`;
}

function wrapWords(value: string, maxCharacters: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && candidate.length > maxCharacters) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function motifSvg(motif: StoryboardMotif, x: number, y: number, accent: string, support: string): string {
  const px = (value: number) => Math.round(x + value);
  const py = (value: number) => Math.round(y + value);
  const line = (d: string, color = accent, width = 5) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const dot = (cx: number, cy: number, color = support, radius = 10) =>
    `<circle cx="${px(cx)}" cy="${py(cy)}" r="${radius}" fill="${color}"/>`;

  if (motif === "market") {
    return [
      line(`M${px(0)} ${py(210)} C${px(65)} ${py(180)} ${px(95)} ${py(205)} ${px(150)} ${py(144)} S${px(250)} ${py(165)} ${px(320)} ${py(82)} S${px(440)} ${py(114)} ${px(520)} ${py(36)}`),
      line(`M${px(0)} ${py(255)} H${px(525)}`, support, 2),
      dot(150, 144),
      dot(320, 82, support, 12),
      dot(520, 36),
    ].join("");
  }
  if (motif === "network") {
    const nodes = [[60, 90], [210, 45], [355, 125], [135, 235], [420, 255], [510, 60]];
    const edges = [[0, 1], [0, 3], [1, 2], [1, 5], [2, 4], [3, 4], [2, 5]];
    return edges.map(([from, to]) => {
      const a = nodes[from]!;
      const b = nodes[to]!;
      return line(`M${px(a[0]!)} ${py(a[1]!)} L${px(b[0]!)} ${py(b[1]!)}`, support, 3);
    }).join("") + nodes.map(([nx, ny], index) => dot(nx!, ny!, index % 2 ? support : accent, index === 2 ? 15 : 11)).join("");
  }
  if (motif === "record") {
    return [
      `<rect x="${px(108)}" y="${py(30)}" width="320" height="250" rx="18" fill="none" stroke="${accent}" stroke-width="5"/>`,
      line(`M${px(155)} ${py(92)} H${px(380)}`, support, 6),
      line(`M${px(155)} ${py(143)} H${px(368)}`, accent, 4),
      line(`M${px(155)} ${py(184)} H${px(340)}`, support, 4),
      line(`M${px(155)} ${py(225)} H${px(300)}`, accent, 4),
    ].join("");
  }
  if (motif === "timeline") {
    return [
      line(`M${px(25)} ${py(165)} H${px(530)}`, support, 4),
      [45, 165, 285, 405, 525].map((point, index) =>
        `<circle cx="${px(point)}" cy="${py(165)}" r="${index === 4 ? 16 : 11}" fill="${index === 4 ? accent : support}"/>`,
      ).join(""),
      line(`M${px(165)} ${py(165)} V${py(88)} M${px(405)} ${py(165)} V${py(235)}`, accent, 4),
    ].join("");
  }
  if (motif === "risk") {
    return [
      `<path d="M${px(280)} ${py(34)} C${px(342)} ${py(73)} ${px(405)} ${py(65)} ${px(470)} ${py(88)} V${py(168)} C${px(470)} ${py(218)} ${px(378)} ${py(264)} ${px(280)} ${py(292)} C${px(182)} ${py(264)} ${px(90)} ${py(218)} ${px(90)} ${py(168)} V${py(88)} C${px(155)} ${py(65)} ${px(218)} ${py(73)} ${px(280)} ${py(34)} Z" fill="${accent}" fill-opacity="0.09" stroke="${accent}" stroke-width="7" stroke-linejoin="round"/>`,
      line(`M${px(292)} ${py(72)} L${px(250)} ${py(130)} L${px(306)} ${py(171)} L${px(267)} ${py(224)} L${px(292)} ${py(263)}`, support, 8),
      dot(250, 130, support, 8),
      dot(306, 171, accent, 7),
    ].join("");
  }
  if (motif === "access") {
    return [
      `<circle cx="${px(205)}" cy="${py(150)}" r="88" fill="none" stroke="${accent}" stroke-width="12"/>`,
      `<path d="M${px(293)} ${py(150)} H${px(510)} V${py(210)} H${px(445)} V${py(255)} H${px(390)} V${py(210)} H${px(340)}" fill="none" stroke="${support}" stroke-width="12" stroke-linejoin="round"/>`,
      dot(205, 150, support, 13),
    ].join("");
  }
  return [
    `<circle cx="${px(285)}" cy="${py(160)}" r="112" fill="none" stroke="${accent}" stroke-width="7"/>`,
    `<circle cx="${px(285)}" cy="${py(160)}" r="68" fill="none" stroke="${support}" stroke-width="4"/>`,
    `<ellipse cx="${px(285)}" cy="${py(160)}" rx="210" ry="74" fill="none" stroke="${accent}" stroke-width="3" transform="rotate(-24 ${px(285)} ${py(160)})"/>`,
    dot(470, 72, support, 15),
    dot(130, 220, accent, 10),
  ].join("");
}

export function buildFinanceLongStoryboardSvg(input: {
  title: string;
  scenes: StoryboardScene[];
  themeIndex: number;
  backgroundJpeg?: Buffer;
  motionDesignProfile?: "finance-long-v4" | "ethereum-preview-v1" | "pump-dynamic-v1";
}): string {
  if (!input.scenes.length) throw new Error("Finance Long storyboard has no scenes");
  const isEthereumMotion = input.motionDesignProfile === "ethereum-preview-v1";
  const isPumpDynamic = input.motionDesignProfile === undefined || input.motionDesignProfile === "pump-dynamic-v1";
  if (!isEthereumMotion && !isPumpDynamic && !input.backgroundJpeg) {
    throw new Error("Finance Long v4 storyboard background is required");
  }
  const theme = FINANCE_LONG_THEMES[normalizeThemeIndex(input.themeIndex)];
  const accent = isEthereumMotion
    ? ETHEREUM_MOTION_COLORS.coral
    : isPumpDynamic
      ? "#EAFF00"
    : `#${theme.primary.slice(2)}`;
  const support = isEthereumMotion
    ? ETHEREUM_MOTION_COLORS.cyan
    : isPumpDynamic
      ? "#14D8F0"
    : `#${theme.secondary.slice(2)}`;
  const contrast = isEthereumMotion
    ? ETHEREUM_MOTION_COLORS.yellow
    : isPumpDynamic
      ? "#FF526F"
    : `#${theme.contrast.slice(2)}`;
  const backgroundColor = isEthereumMotion
    ? ETHEREUM_MOTION_COLORS.background
    : isPumpDynamic
      ? "#10131B"
    : "#111217";
  const backgroundData = input.backgroundJpeg?.toString("base64") || "";
  const previewFontFamily = isEthereumMotion || isPumpDynamic
    ? "Montserrat, DejaVu Sans, Arial"
    : "DejaVu Sans, Arial";
  const editorialPanelColors = ["#10131B", "#EAFF00", "#14D8F0", "#FF526F", "#F4F2E8"];
  const frameCount = Math.min(4, input.scenes.length);
  const selectedScenes = Array.from({ length: frameCount }, (_, index) => {
    const sourceIndex = frameCount === 1
      ? 0
      : Math.round(index * (input.scenes.length - 1) / (frameCount - 1));
    return input.scenes[sourceIndex]!;
  });
  const outerX = 55;
  const cardWidth = 890;
  const cardHeight = 405;
  const gapX = 30;
  const rowY = [126, 551];
  const columnX = [outerX, outerX + cardWidth + gapX];
  const motifScale = 1.17;
  const cards = selectedScenes.map((scene, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = columnX[column]!;
    const y = rowY[row]!;
    const motif = getStoryboardMotif(scene);
    const excerpt = wrapWords(spokenExcerpt(scene.voice_text, 10), 58);
    const motifX = x + Math.round((cardWidth - 530 * motifScale) / 2);
    const motifY = y + 12;
    const labelX = x + 28;
    const labelY = y + 35;
    const captionY = y + cardHeight - 116;
    const accentOrb = isEthereumMotion
      ? `<path d="M${x + 620} ${y + 64}h190m-75 15h145" fill="none" stroke="${index % 2 === 0 ? accent : contrast}" stroke-opacity="0.82" stroke-width="4"/>`
      : isPumpDynamic
        ? `<path d="M${x + 570} ${y + 60}h260M${x + 645} ${y + 82}h185" fill="none" stroke="${index % 2 === 0 ? accent : contrast}" stroke-opacity="0.9" stroke-width="8"/>`
      : index % 2 === 0
        ? `<circle cx="${x + 760}" cy="${y + 95}" r="185" fill="${accent}" fill-opacity="0.13"/>`
        : `<circle cx="${x + 130}" cy="${y + 125}" r="205" fill="${support}" fill-opacity="0.12"/>`;
    const sceneBackground = isEthereumMotion
      ? `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" fill="${backgroundColor}"/><rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" fill="url(#technical-grid)" opacity="0.62"/>`
      : isPumpDynamic
        ? `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" fill="${editorialPanelColors[index % editorialPanelColors.length]}"/><path d="M${x + cardWidth * 0.57} ${y}H${x + cardWidth}V${y + cardHeight}H${x + cardWidth * 0.36}Z" fill="${index % 2 === 0 ? "#14D8F0" : "#EAFF00"}" fill-opacity="0.42"/><path d="M${x} ${y + cardHeight * 0.78}L${x + cardWidth * 0.34} ${y + cardHeight * 0.54}L${x + cardWidth * 0.52} ${y + cardHeight}H${x}Z" fill="${index % 2 === 0 ? "#FF526F" : "#10131B"}" fill-opacity="0.72"/>`
      : `<image x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${backgroundData}" opacity="0.22"/><rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" fill="url(#panel-gradient-${index})"/>`;
    const titleLines = excerpt.map((line, lineIndex) =>
      `<text x="${x + 30}" y="${captionY + 72 + lineIndex * 30}" fill="${isEthereumMotion || isPumpDynamic ? "#F7F7F2" : "#FBF7F0"}" font-size="23" font-family="${previewFontFamily}" font-weight="${isEthereumMotion || isPumpDynamic ? "800" : "600"}">${escapeXml(line)}</text>`,
    ).join("");
    return [
      `<g clip-path="url(#panel-clip-${index})">`,
      sceneBackground,
      accentOrb,
      `<path d="M${x - 40} ${y + 315} C${x + 230} ${y + 220} ${x + 390} ${y + 430} ${x + 715} ${y + 270} S${x + 990} ${y + 335} ${x + 970} ${y + 140}" fill="none" stroke="${support}" stroke-opacity="${isEthereumMotion ? "0.46" : "0.15"}" stroke-width="${isEthereumMotion ? "4" : "3"}"/>`,
      `<g transform="translate(${motifX},${motifY}) scale(${motifScale})">${motifSvg(motif, 0, 0, accent, support)}</g>`,
      `<rect x="${x}" y="${captionY}" width="${cardWidth}" height="${cardHeight - captionY + y}" fill="${isEthereumMotion ? backgroundColor : "url(#caption-shade)"}" fill-opacity="${isEthereumMotion ? "0.96" : "1"}"/>`,
      `<rect x="${labelX}" y="${labelY - 19}" width="75" height="38" rx="${isEthereumMotion ? "4" : "19"}" fill="${backgroundColor}" fill-opacity="0.92" stroke="${support}" stroke-opacity="0.82"/>`,
      `<text x="${labelX + 37}" y="${labelY + 7}" text-anchor="middle" fill="${isEthereumMotion || isPumpDynamic ? "#F7F7F2" : "#FBF7F0"}" font-size="17" font-family="${previewFontFamily}" font-weight="${isEthereumMotion || isPumpDynamic ? "800" : "700"}">${String(scene.scene_number).padStart(2, "0")}</text>`,
      `<text x="${labelX + 94}" y="${labelY + 7}" fill="${contrast}" font-size="17" font-family="${previewFontFamily}" font-weight="${isEthereumMotion || isPumpDynamic ? "800" : "700"}" letter-spacing="1.2">${storyboardMotifLabel(motif)}</text>`,
      `</g>`,
      `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="22" fill="none" stroke="${support}" stroke-opacity="0.72" stroke-width="2"/>`,
      titleLines,
    ].join("");
  }).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">`,
    `<defs>`,
    `<pattern id="technical-grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="${ETHEREUM_MOTION_COLORS.cyan}" stroke-opacity="0.14" stroke-width="1"/></pattern>`,
    `<linearGradient id="caption-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#111217" stop-opacity="0"/><stop offset="0.2" stop-color="#111217" stop-opacity="0.54"/><stop offset="1" stop-color="#111217" stop-opacity="0.96"/></linearGradient>`,
    selectedScenes.map((_, index) => [
      `<linearGradient id="panel-gradient-${index}" x1="${index % 2 === 0 ? "0" : "1"}" y1="0" x2="${index % 2 === 0 ? "1" : "0"}" y2="1">`,
      `<stop offset="0" stop-color="${isEthereumMotion ? backgroundColor : "#141821"}" stop-opacity="0.56"/>`,
      `<stop offset="0.55" stop-color="${accent}" stop-opacity="${isEthereumMotion ? "0.12" : "0.31"}"/>`,
      `<stop offset="1" stop-color="${isEthereumMotion ? backgroundColor : "#101116"}" stop-opacity="0.82"/>`,
      `</linearGradient>`,
      `<clipPath id="panel-clip-${index}"><rect x="${columnX[index % 2]}" y="${rowY[Math.floor(index / 2)]}" width="${cardWidth}" height="${cardHeight}" rx="22"/></clipPath>`,
    ].join("")).join(""),
    `</defs>`,
    `<rect width="1920" height="1080" fill="${backgroundColor}"/>`,
    ...(isEthereumMotion ? [`<rect width="1920" height="1080" fill="url(#technical-grid)" opacity="0.5"/>`] : []),
    `<text x="56" y="63" fill="${ETHEREUM_MOTION_COLORS.text}" font-size="25" font-family="${previewFontFamily}" font-weight="800">${isEthereumMotion ? "FINANCE LONG · MOTION DESIGN" : isPumpDynamic ? "FINANCE LONG · EDITORIAL MOTION" : "FINANCE LONG · ВИЗУАЛЬНАЯ КОНЦЕПЦИЯ"}</text>`,
    `<text x="1864" y="62" text-anchor="end" fill="${contrast}" font-size="18" font-family="${previewFontFamily}" font-weight="${isEthereumMotion ? "800" : "400"}">${escapeXml(input.title.slice(0, 58))}</text>`,
    cards,
    `<text x="56" y="1017" fill="${isEthereumMotion ? ETHEREUM_MOTION_COLORS.inactiveSecondary : "#D8D0C4"}" font-size="17" font-family="${previewFontFamily}">Эскиз композиции по описаниям сцен · это не финальные изображения ролика</text>`,
    `</svg>`,
  ].join("");
}

export async function renderFinanceLongStoryboardPreview(input: {
  title: string;
  scenes: StoryboardScene[];
  themeIndex: number;
  motionDesignProfile?: "finance-long-v4" | "ethereum-preview-v1" | "pump-dynamic-v1";
}): Promise<Buffer> {
  const motionDesignProfile = input.motionDesignProfile ?? "pump-dynamic-v1";
  const isEthereumMotion = motionDesignProfile === "ethereum-preview-v1";
  const backgroundJpeg = isEthereumMotion || motionDesignProfile === "pump-dynamic-v1"
    ? undefined
    : await readFile(getFinanceLongBackgroundPath(input.themeIndex));
  const svg = buildFinanceLongStoryboardSvg({ ...input, motionDesignProfile, backgroundJpeg });
  const directory = await mkdtemp(resolve(tmpdir(), "finance-long-storyboard-"));
  const svgPath = resolve(directory, "storyboard.svg");
  const outputPath = resolve(directory, "storyboard.jpg");
  try {
    await writeFile(svgPath, svg, "utf8");
    const fontConfig = isEthereumMotion || motionDesignProfile === "pump-dynamic-v1"
      ? await createFinanceLongMotionFontConfig(directory)
      : undefined;
    await execFileAsync("magick", [
      svgPath,
      "-strip",
      "-quality", "88",
      outputPath,
    ], {
      maxBuffer: 10 * 1024 * 1024,
      ...(fontConfig ? { env: fontConfig.env } : {}),
    });
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}