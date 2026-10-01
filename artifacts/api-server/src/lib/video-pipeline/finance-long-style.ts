import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const FINANCE_LONG_VISUAL_PROFILE_KEY = "finance_long_v4_visual_profile";
export const FINANCE_LONG_THEME_INDEX_KEY = "finance_long_v4_theme_index";

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
): T & Record<string, unknown> {
  return {
    ...script,
    [FINANCE_LONG_VISUAL_PROFILE_KEY]: true,
    [FINANCE_LONG_THEME_INDEX_KEY]: normalizeThemeIndex(themeIndex),
    ...(keepLegacyCoinOverviewFlag ? { coin_overview_long_visual_profile: true } : {}),
  };
}

export function withFinanceLongVisualProfile<T extends object>(
  script: T,
  topic: string,
  keepLegacyCoinOverviewFlag = false,
): T & Record<string, unknown> {
  return applyFinanceLongVisualProfile(
    script,
    getFinanceLongThemeIndex(topic),
    keepLegacyCoinOverviewFlag,
  );
}

export function resolveFinanceLongVisualConfig(
  format: string,
  metadata: Record<string, unknown>,
  topic: string,
): FinanceLongVisualConfig {
  const keepLegacyCoinOverviewFlag = metadata.coin_overview_long_visual_profile === true;
  const enabled = format === "YouTube Finance Long Video"
    && (metadata[FINANCE_LONG_VISUAL_PROFILE_KEY] === true || keepLegacyCoinOverviewFlag);
  const storedThemeIndex = metadata[FINANCE_LONG_THEME_INDEX_KEY];
  const themeIndex = typeof storedThemeIndex === "number" && Number.isInteger(storedThemeIndex)
    ? normalizeThemeIndex(storedThemeIndex)
    : getFinanceLongThemeIndex(topic);

  return { enabled, themeIndex, keepLegacyCoinOverviewFlag };
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
  visual_description?: string;
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
  const text = `${scene.voice_text}\n${scene.visual_description || ""}`.toLocaleLowerCase("ru-RU");
  if (/риск|угроз|уязв|волат|падени|потер|ограничен/u.test(text)) return "risk";
  if (/сеть|блокчейн|узел|транзакц|подтвержден/u.test(text)) return "network";
  if (/график|цена|рынок|объ[её]м|капитализац|динамик/u.test(text)) return "market";
  if (/доступ|кошел|пользоват|перевод|комисси/u.test(text)) return "access";
  if (/истори|этап|врем|запуск|период|год/u.test(text)) return "timeline";
  if (/документ|резерв|эмисс|токен|предложен|команд/u.test(text)) return "record";
  return "asset";
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
      `<path d="M${px(280)} ${py(24)} L${px(500)} ${py(270)} H${px(60)} Z" fill="none" stroke="${accent}" stroke-width="8" stroke-linejoin="round"/>`,
      line(`M${px(280)} ${py(105)} V${py(180)}`, support, 10),
      dot(280, 220, support, 8),
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
  backgroundJpeg: Buffer;
}): string {
  if (!input.scenes.length) throw new Error("Finance Long storyboard has no scenes");
  const theme = FINANCE_LONG_THEMES[normalizeThemeIndex(input.themeIndex)];
  const accent = `#${theme.primary.slice(2)}`;
  const support = `#${theme.secondary.slice(2)}`;
  const backgroundData = input.backgroundJpeg.toString("base64");
  const frameCount = Math.min(6, input.scenes.length);
  const selectedScenes = Array.from({ length: frameCount }, (_, index) => {
    const sourceIndex = frameCount === 1
      ? 0
      : Math.round(index * (input.scenes.length - 1) / (frameCount - 1));
    return input.scenes[sourceIndex]!;
  });
  const outerX = 55;
  const cardWidth = 590;
  const cardHeight = 405;
  const imageHeight = 332;
  const gapX = 20;
  const rowY = [126, 561];
  const cards = selectedScenes.map((scene, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = outerX + column * (cardWidth + gapX);
    const y = rowY[row]!;
    const excerpt = wrapWords(spokenExcerpt(scene.voice_text), 48);
    const titleLines = excerpt.map((line, lineIndex) =>
      `<text x="${x + 18}" y="${y + imageHeight + 34 + lineIndex * 23}" fill="#F8F4EC" font-size="17" font-family="DejaVu Sans, Arial" font-weight="600">${escapeXml(line)}</text>`,
    ).join("");
    return [
      `<g clip-path="url(#clip-${index})">`,
      `<image x="${x}" y="${y}" width="${cardWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" href="data:image/jpeg;base64,${backgroundData}"/>`,
      `<rect x="${x}" y="${y}" width="${cardWidth}" height="${imageHeight}" fill="#101116" opacity="0.22"/>`,
      `<rect x="${x}" y="${y + imageHeight - 100}" width="${cardWidth}" height="100" fill="url(#caption-shade)"/>`,
      motifSvg(getStoryboardMotif(scene), x + 34, y + 22, accent, support),
      `<rect x="${x + 14}" y="${y + 14}" width="46" height="34" rx="17" fill="#101116" opacity="0.82"/>`,
      `<text x="${x + 37}" y="${y + 37}" text-anchor="middle" fill="#F8F4EC" font-size="18" font-family="DejaVu Sans, Arial" font-weight="700">${String(scene.scene_number).padStart(2, "0")}</text>`,
      `</g>`,
      `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="16" fill="none" stroke="${support}" stroke-opacity="0.65" stroke-width="2"/>`,
      titleLines,
    ].join("");
  }).join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">`,
    `<defs>`,
    `<linearGradient id="caption-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101116" stop-opacity="0"/><stop offset="1" stop-color="#101116" stop-opacity="0.82"/></linearGradient>`,
    selectedScenes.map((_, index) =>
      `<clipPath id="clip-${index}"><rect x="${outerX + (index % 3) * (cardWidth + gapX)}" y="${rowY[Math.floor(index / 3)]}" width="${cardWidth}" height="${imageHeight}"/></clipPath>`,
    ).join(""),
    `</defs>`,
    `<rect width="1920" height="1080" fill="#111217"/>`,
    `<text x="56" y="65" fill="#F6F0E6" font-size="27" font-family="DejaVu Sans, Arial" font-weight="700">ФИНАНСОВЫЙ LONG · РАСКАДРОВКА</text>`,
    `<text x="1864" y="65" text-anchor="end" fill="${support}" font-size="18" font-family="DejaVu Sans, Arial">${escapeXml(input.title.slice(0, 64))}</text>`,
    cards,
    `<text x="56" y="1025" fill="#E7E0D5" font-size="16" font-family="DejaVu Sans, Arial">Композиции и стиль на ключевых сценах · без неподтверждённых цифр и логотипов</text>`,
    `</svg>`,
  ].join("");
}

export async function renderFinanceLongStoryboardPreview(input: {
  title: string;
  scenes: StoryboardScene[];
  themeIndex: number;
}): Promise<Buffer> {
  const backgroundPath = getFinanceLongBackgroundPath(input.themeIndex);
  const backgroundJpeg = await readFile(backgroundPath);
  const svg = buildFinanceLongStoryboardSvg({ ...input, backgroundJpeg });
  const directory = await mkdtemp(resolve(tmpdir(), "finance-long-storyboard-"));
  const svgPath = resolve(directory, "storyboard.svg");
  const outputPath = resolve(directory, "storyboard.jpg");
  try {
    await writeFile(svgPath, svg, "utf8");
    await execFileAsync("magick", [
      svgPath,
      "-strip",
      "-quality", "88",
      outputPath,
    ], { maxBuffer: 10 * 1024 * 1024 });
    return await readFile(outputPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}