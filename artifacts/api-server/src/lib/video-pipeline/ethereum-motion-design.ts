import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY = "finance_long_ethereum_motion_profile";
export const FINANCE_LONG_ETHEREUM_MOTION_PROFILE = "ethereum-preview-v1";

export const ETHEREUM_MOTION_COLORS = {
  background: "#070B16",
  coral: "#FF5A67",
  cyan: "#16C7E8",
  yellow: "#E5D438",
  inactive: "#252B38",
  inactiveSecondary: "#343A47",
  text: "#F3F3F3",
} as const;

export const ETHEREUM_MOTION_FFMPEG_COLORS = {
  background: "0x070b16",
  coral: "0xff5a67",
  cyan: "0x16c7e8",
  yellow: "0xe5d438",
  inactive: "0x252b38",
  inactiveSecondary: "0x343a47",
  text: "0xf3f3f3",
} as const;

export const ETHEREUM_MOTION = {
  fps: 60,
  microDurationSeconds: 0.35,
  normalDurationSeconds: 0.7,
  cinematicDurationSeconds: 1.2,
  sceneTransitionSeconds: 0.8,
  maxVisualHoldMs: 1_650,
} as const;

export const FINANCE_LONG_MOTION_EVENT_KINDS = [
  "TECHNICAL_GRID",
  "DATA_FLOW",
  "NETWORK_REVEAL",
  "FINANCIAL_CHART",
  "TIMELINE",
  "COMPARISON",
  "PARTICLE_FLOW",
  "NODE_SYSTEM",
  "MORPH_TRANSITION",
  "CAMERA_PUSH",
  "MOTION_TEXT",
] as const;

export type FinanceLongMotionEventKind = typeof FINANCE_LONG_MOTION_EVENT_KINDS[number];
export type FinanceLongMotionEvent = {
  kind: FinanceLongMotionEventKind;
  description: string;
};

const PROJECT_DOCUMENT_ROOTS = [
  process.cwd(),
  resolve(process.cwd(), "artifacts/api-server"),
];

async function loadFinanceLongProjectDocument(fileName: string): Promise<string> {
  const candidates = PROJECT_DOCUMENT_ROOTS.map((root) => resolve(root, fileName));
  for (const path of candidates) {
    try {
      const document = (await readFile(path, "utf8")).trim();
      if (document.length < 100) {
        throw new Error(`Finance Long project instruction is incomplete: ${path}`);
      }
      return document;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  throw new Error(
    `Finance Long project instruction ${fileName} is missing. Expected one of: ${candidates.join(", ")}`,
  );
}

export async function loadFinanceLongMotionPromptContext(): Promise<string> {
  const files = [
    "AGENT_INSTRUCTIONS.md",
    "MOTION_DESIGN_SYSTEM.md",
    "VIDEO_PIPELINE.md",
  ];
  const documents = await Promise.all(files.map((fileName) => loadFinanceLongProjectDocument(fileName)));
  return documents.map((document, index) => `## ${files[index]}\n\n${document}`).join("\n\n");
}

export async function createFinanceLongMotionFontConfig(directory: string): Promise<{
  fontPath: string;
  fontConfigPath: string;
  env: NodeJS.ProcessEnv;
}> {
  const candidates = [
    resolve(process.cwd(), "assets/fonts/Montserrat-ExtraBold.ttf"),
    resolve(process.cwd(), "artifacts/api-server/assets/fonts/Montserrat-ExtraBold.ttf"),
  ];
  let fontPath: string | undefined;
  for (const candidate of candidates) {
    try {
      await access(candidate);
      fontPath = candidate;
      break;
    } catch {
      // Try the other known package/root location before failing explicitly.
    }
  }
  if (!fontPath) {
    throw new Error(`Finance Long motion font is missing. Expected: ${candidates.join(", ")}`);
  }

  const fontDirectory = dirname(fontPath);
  const cacheDirectory = resolve(directory, "fontconfig-cache");
  const fontConfigPath = resolve(directory, "fontconfig-montserrat.xml");
  await mkdir(cacheDirectory, { recursive: true });
  const escapeXml = (value: string) =>
    value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  await writeFile(fontConfigPath, [
    '<?xml version="1.0"?>',
    "<fontconfig>",
    '  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>',
    `  <dir>${escapeXml(fontDirectory)}</dir>`,
    `  <cachedir>${escapeXml(cacheDirectory)}</cachedir>`,
    '  <alias><family>Montserrat</family><prefer><family>Montserrat ExtraBold</family></prefer></alias>',
    "</fontconfig>",
  ].join("\n"), "utf8");

  return {
    fontPath,
    fontConfigPath,
    env: { ...process.env, FONTCONFIG_FILE: fontConfigPath },
  };
}

function sequenceBase(description: string): string {
  return description
    .split(/\r?\n/u)
    .filter((line) => !/^\s*MOTION_SEQUENCE\s*:/iu.test(line))
    .join("\n")
    .trim();
}

export function parseFinanceLongMotionSequence(description: string): FinanceLongMotionEvent[] {
  const sequenceLine = description
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find((line) => /^MOTION_SEQUENCE\s*:/iu.test(line));
  if (!sequenceLine) return [];

  const body = sequenceLine.replace(/^MOTION_SEQUENCE\s*:/iu, "").trim();
  return body.split("|").map((part) => {
    const match = part.trim().match(/^\[([A-Z_]+)\]\s*(.+)$/u);
    if (!match || !FINANCE_LONG_MOTION_EVENT_KINDS.includes(match[1] as FinanceLongMotionEventKind)) {
      return null;
    }
    const event: FinanceLongMotionEvent = {
      kind: match[1] as FinanceLongMotionEventKind,
      description: match[2]!.trim(),
    };
    return event.description ? event : null;
  }).filter((event): event is FinanceLongMotionEvent => event !== null);
}

function defaultMotionSequence(sceneDescription: string): FinanceLongMotionEvent[] {
  const lead = sceneDescription.replace(/\s+/gu, " ").trim().slice(0, 150)
    || "основная визуальная метафора сцены";
  const firstKind: FinanceLongMotionEventKind = /цен|рын|граф|динамик|ликвид|объём/iu.test(lead)
    ? "FINANCIAL_CHART"
    : /сет|блок|узел|протокол|валидат|транзакц/iu.test(lead)
      ? "NETWORK_REVEAL"
      : "TECHNICAL_GRID";
  const standard: FinanceLongMotionEvent[] = [
    { kind: firstKind, description: `обозначить главный тезис сцены: ${lead}` },
    { kind: "TECHNICAL_GRID", description: "собрать координатное поле вокруг главной формы" },
    { kind: "NODE_SYSTEM", description: "поочерёдно выявить связанные визуальные узлы" },
    { kind: "DATA_FLOW", description: "провести один сигнал между относящимися к сцене элементами" },
    { kind: "PARTICLE_FLOW", description: "поддержать направление движения короткими импульсами" },
    { kind: "MORPH_TRANSITION", description: "перестроить геометрию в следующий смысловой блок" },
  ];
  return standard;
}

export function ensureFinanceLongMotionSequence(description: string): string {
  const base = sequenceBase(description);
  const existing = parseFinanceLongMotionSequence(description);
  if (existing.length >= 5 && existing.length <= 8) {
    return `${base}\nMOTION_SEQUENCE: ${existing
      .map((event) => `[${event.kind}] ${event.description}`)
      .join(" | ")}`;
  }

  const standard = defaultMotionSequence(base);
  const usableExisting = existing.length > 0 ? existing : [];
  const combined = [
    ...usableExisting,
    ...standard.filter((event) => !usableExisting.some((item) => item.kind === event.kind)),
  ].slice(0, 6);
  return `${base}\nMOTION_SEQUENCE: ${combined
    .map((event) => `[${event.kind}] ${event.description}`)
    .join(" | ")}`;
}