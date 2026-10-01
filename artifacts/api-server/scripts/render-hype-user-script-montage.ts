import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  buildCoinOverviewLongPhraseBeats,
} from "../src/lib/video-pipeline/coin-overview-long-edit";
import {
  buildCoinOverviewLongPhraseCaptions,
} from "../src/lib/video-pipeline/coin-overview-long-captions";

const execFileAsync = promisify(execFile);

const SCRIPT = [
  "HYPE — это просто очередной хайповый токен или здесь есть что-то большее?",
  "HYPE — нативный токен экосистемы Hyperliquid, одной из самых заметных DeFi-платформ для торговли деривативами.",
  "Главная фишка — сама платформа работает быстро, а торговая инфраструктура построена вокруг собственной сети Hyperliquid.",
  "Но самое интересное начинается с токеномики.",
  "HYPE используется в экосистеме, участвует в управлении и связан с развитием всей сети.",
  "Именно поэтому вокруг монеты появилось столько внимания.",
  "Но есть и обратная сторона.",
  "Крипторынок крайне волатилен, а сильный рост интереса к токену не гарантирует дальнейшего роста цены.",
  "Так что HYPE — это фундаментальный проект или очередной хайп?",
  "Напиши в комментариях, что думаешь о HYPE, и поставь лайк, если хочешь больше разборов крипты.",
].join(" ");

const WIDTH = 1920;
const HEIGHT = 1080;
const SOURCE_VIDEO_PATH = resolve(
  process.argv[2] ?? "../../attached_assets/generated_video/coin-overview-long/hype-kinetic-script.mp4",
);
const OUTPUT_PATH = resolve(process.argv[3] ?? SOURCE_VIDEO_PATH);
const MAX_VISUAL_HOLD_MS = 1_350;
const BOLD_FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

type HypeVisualMotif =
  | "token"
  | "platform"
  | "network"
  | "tokenomics"
  | "attention"
  | "risk"
  | "question"
  | "cta";

type KineticCueRule = {
  pattern: RegExp;
  motif: HypeVisualMotif;
  cues: string[];
};

type KineticBeat = {
  startMs: number;
  endMs: number;
  text: string;
  motif: HypeVisualMotif;
  accentIndex: number;
  side: "left" | "right";
  layout: number;
};

const ACCENTS = [
  { hex: "#f3ef00", ffmpeg: "0xf3ef00" },
  { hex: "#11c9ff", ffmpeg: "0x11c9ff" },
  { hex: "#ff5b66", ffmpeg: "0xff5b66" },
  { hex: "#46edc3", ffmpeg: "0x46edc3" },
];
const DARK_FIELDS = ["0x081322", "0x0d1020", "0x0b1924", "0x11111b"];

const KINETIC_CUE_RULES: KineticCueRule[] = [
  { pattern: /хайп|хайпов/iu, motif: "token", cues: ["ХАЙП?", "HYPE", "ТОКЕН"] },
  {
    pattern: /нативн|экосистем|hyperliquid|defi|дериватив/iu,
    motif: "platform",
    cues: ["НАТИВНЫЙ ТОКЕН", "HYPERLIQUID", "DeFi", "ДЕРИВАТИВЫ"],
  },
  {
    pattern: /быстро|инфраструктур|собственн|сети/iu,
    motif: "network",
    cues: ["БЫСТРО", "ИНФРАСТРУКТУРА", "СОБСТВЕННАЯ СЕТЬ"],
  },
  { pattern: /токеномик/iu, motif: "tokenomics", cues: ["ТОКЕНОМИКА"] },
  {
    pattern: /используется|управлени|развитию|развити|сети/iu,
    motif: "tokenomics",
    cues: ["ИСПОЛЬЗУЕТСЯ", "УПРАВЛЕНИЕ", "РАЗВИТИЕ", "СЕТЬ"],
  },
  { pattern: /внимани|монет/iu, motif: "attention", cues: ["ВНИМАНИЕ", "МОНЕТА"] },
  { pattern: /обратн|сторон/iu, motif: "risk", cues: ["ОБРАТНАЯ", "СТОРОНА"] },
  {
    pattern: /волатил|рост|не гарантиру|цен/iu,
    motif: "risk",
    cues: ["ВОЛАТИЛЬНОСТЬ", "РОСТ ИНТЕРЕСА", "НЕ ГАРАНТИРУЕТ", "РОСТ ЦЕНЫ"],
  },
  {
    pattern: /фундаментальн|проект|очередной/iu,
    motif: "question",
    cues: ["ФУНДАМЕНТАЛЬНЫЙ?", "ПРОЕКТ?", "ХАЙП?"],
  },
  {
    pattern: /напиши|комментар|лайк|разбор/iu,
    motif: "cta",
    cues: ["НАПИШИ", "КОММЕНТАРИИ", "HYPE", "ПОСТАВЬ ЛАЙК", "БОЛЬШЕ РАЗБОРОВ"],
  },
];

function quoteFilterValue(value: string): string {
  return `'${value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll(",", "\\,")}'`;
}

function ffTime(milliseconds: number): string {
  return (milliseconds / 1_000).toFixed(3);
}

function chooseFallbackCue(text: string, index: number): string {
  const stopWords = new Set([
    "это", "просто", "здесь", "есть", "что-то", "здесь", "одной", "из", "самых",
    "заметных", "для", "но", "самое", "интересное", "начинается", "и", "всей",
    "именно", "поэтому", "вокруг", "появилось", "так", "а", "как", "что", "думаешь",
    "если", "хочешь", "больше", "в", "на", "или", "вся", "вся", "вся",
  ]);
  const words = text
    .match(/[\p{L}\p{N}-]+/gu)
    ?.filter((word) => word.length >= 4 && !stopWords.has(word.toLocaleLowerCase("ru-RU")));
  return words?.[index % words.length] ?? "HYPE";
}

function makeKineticBeats(
  phraseBeats: Array<{ startMs: number; endMs: number; text: string }>,
  durationMs: number,
): KineticBeat[] {
  const result: KineticBeat[] = [];
  for (const phrase of phraseBeats) {
    const phraseStart = Math.max(0, phrase.startMs);
    const phraseEnd = Math.min(durationMs, phrase.endMs);
    if (phraseEnd <= phraseStart) continue;
    const eventCount = Math.max(1, Math.ceil((phraseEnd - phraseStart) / MAX_VISUAL_HOLD_MS));
    const rule = KINETIC_CUE_RULES.find((candidate) => candidate.pattern.test(phrase.text));
    for (let index = 0; index < eventCount; index += 1) {
      const startMs = Math.round(phraseStart + (phraseEnd - phraseStart) * index / eventCount);
      const endMs = Math.round(phraseStart + (phraseEnd - phraseStart) * (index + 1) / eventCount);
      const cueIndex = Math.min(
        (rule?.cues.length ?? 1) - 1,
        Math.floor((index + 0.5) * (rule?.cues.length ?? 1) / eventCount),
      );
      const fallback = chooseFallbackCue(phrase.text, index);
      const cue = rule?.cues[cueIndex] ?? fallback;
      const accentByMotif: Record<HypeVisualMotif, number> = {
        token: 0,
        platform: 1,
        network: 1,
        tokenomics: 0,
        attention: 3,
        risk: 2,
        question: 0,
        cta: 1,
      };
      result.push({
        startMs,
        endMs,
        text: cue.toLocaleUpperCase("ru-RU"),
        motif: rule?.motif ?? "token",
        accentIndex: accentByMotif[rule?.motif ?? "token"],
        side: result.length % 2 === 0 ? "right" : "left",
        layout: result.length % 4,
      });
    }
  }
  return result;
}

async function createKineticPlates(tempDir: string): Promise<string[]> {
  const paths: string[] = [];
  const gridLines = Array.from({ length: 27 }, (_, index) => {
    const x = index * 72;
    return `<path d="M ${x} 0 V ${HEIGHT}" />`;
  }).join("");
  const horizontalLines = Array.from({ length: 16 }, (_, index) => {
    const y = index * 72;
    return `<path d="M 0 ${y} H ${WIDTH}" />`;
  }).join("");

  for (const accent of ACCENTS) {
    for (const side of ["left", "right"] as const) {
      const panel = side === "right"
        ? `1280,0 ${WIDTH},0 ${WIDTH},${HEIGHT} 620,${HEIGHT}`
        : `0,0 640,0 1300,${HEIGHT} 0,${HEIGHT}`;
      const slash = side === "right"
        ? `M 620 ${HEIGHT} L 1280 0`
        : `M 640 0 L 1300 ${HEIGHT}`;
      const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
        `<g fill="none" stroke="#80a6c4" stroke-width="1" opacity=".19">${gridLines}${horizontalLines}</g>`,
        `<polygon points="${panel}" fill="${accent.hex}" fill-opacity=".93"/>`,
        `<path d="${slash}" fill="none" stroke="#f7f5ed" stroke-width="5" stroke-opacity=".82"/>`,
        `<path d="M 0 ${HEIGHT - 100} L 360 ${HEIGHT - 180} M ${WIDTH - 360} 145 L ${WIDTH} 85" fill="none" stroke="${accent.hex}" stroke-width="3" stroke-opacity=".64"/>`,
        "</svg>",
      ].join("");
      const plateIndex = paths.length;
      const svgPath = join(tempDir, `plate-${plateIndex}.svg`);
      const pngPath = join(tempDir, `plate-${plateIndex}.png`);
      await writeFile(svgPath, svg, "utf8");
      await execFileAsync("magick", ["-background", "none", svgPath, "-alpha", "set", pngPath], {
        maxBuffer: 8 * 1024 * 1024,
      });
      paths.push(pngPath);
    }
  }
  return paths;
}

function buildPlateSlideExpression(events: KineticBeat[], side: "left" | "right"): string {
  const origin = side === "left" ? -1 : 1;
  return events.reduceRight((fallback, event) => {
    const start = ffTime(event.startMs);
    const end = ffTime(event.endMs);
    const active = `gte(t,${start})*lt(t,${end})`;
    const progress = `min(max((t-${start})/0.22,0),1)`;
    return `if(${active},${origin}*${WIDTH}*(1-${progress}),${fallback})`;
  }, "0");
}

function drawBox(input: {
  x: string | number;
  y: string | number;
  w: string | number;
  h: string | number;
  color: string;
  startMs: number;
  endMs: number;
  thickness?: number | "fill";
}): string {
  const enable = `gte(t,${ffTime(input.startMs)})*lt(t,${ffTime(input.endMs)})`;
  return `drawbox=x=${quoteFilterValue(String(input.x))}:y=${quoteFilterValue(String(input.y))}` +
    `:w=${quoteFilterValue(String(input.w))}:h=${quoteFilterValue(String(input.h))}` +
    `:color=${input.color}:t=${input.thickness ?? "fill"}:enable=${quoteFilterValue(enable)}`;
}

function drawText(input: {
  text: string;
  x: string;
  y: string | number;
  fontSize: string | number;
  color: string;
  startMs: number;
  endMs: number;
  borderWidth?: number;
}): string {
  const enable = `gte(t,${ffTime(input.startMs)})*lt(t,${ffTime(input.endMs)})`;
  const text = input.text.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll(":", "\\:");
  return `drawtext=fontfile=${BOLD_FONT_PATH}:text='${text}'` +
    `:x=${quoteFilterValue(input.x)}:y=${quoteFilterValue(String(input.y))}` +
    `:fontsize=${quoteFilterValue(String(input.fontSize))}:fontcolor=${input.color}` +
    `:borderw=${input.borderWidth ?? 3}:bordercolor=0x08101d:shadowcolor=0x000000@0.58` +
    `:shadowx=4:shadowy=5:alpha=${quoteFilterValue(`min(min(max((t-${ffTime(input.startMs)})/0.07,0),1),min(max((${ffTime(input.endMs)}-t)/0.1,0),1))`)}` +
    `:enable=${quoteFilterValue(enable)}`;
}

function buildKineticGraphics(events: KineticBeat[]): {
  backgroundFilters: string[];
  filters: string[];
  plateEnable: Map<number, string>;
  plateEvents: Map<number, KineticBeat[]>;
} {
  const backgroundFilters: string[] = [];
  const plateEvents = new Map<number, KineticBeat[]>();
  events.forEach((event, index) => {
    const list = plateEvents.get(event.accentIndex * 2 + (event.side === "left" ? 0 : 1)) ?? [];
    list.push(event);
    plateEvents.set(event.accentIndex * 2 + (event.side === "left" ? 0 : 1), list);
    backgroundFilters.push(drawBox({
      x: 0,
      y: 0,
      w: WIDTH,
      h: HEIGHT,
      color: DARK_FIELDS[index % DARK_FIELDS.length],
      startMs: event.startMs,
      endMs: event.endMs,
    }));
  });

  const plateEnable = new Map<number, string>([...plateEvents].map(([plateIndex, plateList]) => [
    plateIndex,
    plateList
      .map((event) => `between(t,${ffTime(event.startMs)},${ffTime(event.endMs)})`)
      .join("+"),
  ] as const));

  const filters: string[] = [];
  events.forEach((event, index) => {
    const start = ffTime(event.startMs);
    const end = ffTime(event.endMs);
    const active = `gte(t,${start})*lt(t,${end})`;
    const localTime = `(t-${start})`;
    const textSideIsLeft = event.side === "right";
    const fontSize = event.text.length <= 4
      ? 310
      : event.text.length <= 8
        ? 245
        : event.text.length <= 13
          ? 188
          : 150;
    const yPositions = [310, 420, 250, 520];
    const y = yPositions[event.layout]!;
    const x = textSideIsLeft
      ? `92-48*(1-min(max(${localTime}/0.16,0),1))+if(lt(${localTime},0.12),8*sin(${localTime}*120),0)`
      : `${WIDTH}-92-text_w+48*(1-min(max(${localTime}/0.16,0),1))+if(lt(${localTime},0.12),8*sin(${localTime}*120),0)`;
    const titleColor = event.layout === 2 ? "0xf8f7f0" : ACCENTS[event.accentIndex]!.ffmpeg;
    filters.push(drawText({
      text: event.text,
      x,
      y,
      fontSize: `${fontSize}*(0.72+0.28*min(max(${localTime}/0.16,0),1))`,
      color: titleColor,
      startMs: event.startMs,
      endMs: event.endMs,
      borderWidth: 4,
    }));

    const panelX = event.side === "right" ? 1320 : 120;
    const panelCenterX = panelX + 260;
    const panelCenterY = 360 + (index % 3) * 58;
    const accent = ACCENTS[event.accentIndex]!.ffmpeg;
    const progress = `min(max((${localTime}-0.06)/0.32,0),1)`;

    if (event.motif === "network" || event.motif === "platform") {
      const nodes = [
        { x: panelX + 20, y: panelCenterY + 95 },
        { x: panelX + 185, y: panelCenterY - 15 },
        { x: panelX + 360, y: panelCenterY + 75 },
        { x: panelX + 245, y: panelCenterY + 235 },
      ];
      filters.push(
        drawBox({
          x: nodes[0]!.x,
          y: nodes[0]!.y,
          w: `${nodes[1]!.x - nodes[0]!.x}*${progress}`,
          h: 9,
          color: `${accent}@0.95`,
          startMs: event.startMs,
          endMs: event.endMs,
        }),
        drawBox({
          x: nodes[1]!.x,
          y: nodes[1]!.y,
          w: `${nodes[2]!.x - nodes[1]!.x}*${progress}`,
          h: 9,
          color: `${accent}@0.95`,
          startMs: event.startMs + 90,
          endMs: event.endMs,
        }),
        drawBox({
          x: nodes[2]!.x,
          y: nodes[2]!.y,
          w: 9,
          h: `${nodes[3]!.y - nodes[2]!.y}*${progress}`,
          color: `${accent}@0.95`,
          startMs: event.startMs + 160,
          endMs: event.endMs,
        }),
      );
      nodes.forEach((node, nodeIndex) => {
        filters.push(drawText({
          text: nodeIndex === 1 ? "◉" : "●",
          x: `${node.x}-34`,
          y: `${node.y}-56`,
          fontSize: `76*min(max((${localTime}-${(0.12 + nodeIndex * 0.12).toFixed(2)})/0.11,0),1)`,
          color: nodeIndex === 1 ? "0xf8f7f0" : accent,
          startMs: event.startMs + 100,
          endMs: event.endMs,
          borderWidth: 0,
        }));
      });
    } else if (event.motif === "risk") {
      const points = [
        { x: panelX + 10, y: panelCenterY + 80 },
        { x: panelX + 105, y: panelCenterY - 15 },
        { x: panelX + 205, y: panelCenterY + 115 },
        { x: panelX + 305, y: panelCenterY - 40 },
        { x: panelX + 410, y: panelCenterY + 40 },
      ];
      for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
        const from = points[pointIndex]!;
        const to = points[pointIndex + 1]!;
        const delay = 0.08 + pointIndex * 0.09;
        filters.push(
          drawBox({
            x: from.x,
            y: from.y,
            w: `${to.x - from.x}*min(max((${localTime}-${delay.toFixed(2)})/0.16,0),1)`,
            h: 11,
            color: "0xf3ef00",
            startMs: event.startMs + delay * 1_000,
            endMs: event.endMs,
          }),
          drawBox({
            x: to.x,
            y: Math.min(from.y, to.y),
            w: 11,
            h: Math.abs(to.y - from.y),
            color: "0xf3ef00",
            startMs: event.startMs + (delay + 0.09) * 1_000,
            endMs: event.endMs,
          }),
        );
      }
      points.forEach((point, pointIndex) => {
        filters.push(drawText({
          text: "●",
          x: `${point.x}-20`,
          y: `${point.y}-42`,
          fontSize: `42*min(max((${localTime}-${(0.12 + pointIndex * 0.07).toFixed(2)})/0.12,0),1)`,
          color: pointIndex % 2 === 0 ? "0x11c9ff" : "0xf3ef00",
          startMs: event.startMs + 120,
          endMs: event.endMs,
          borderWidth: 1,
        }));
      });
    } else if (event.motif === "token" || event.motif === "tokenomics") {
      filters.push(
        drawText({
          text: "◉",
          x: `${panelCenterX - 124}+16*sin(${localTime}*4)`,
          y: `${panelCenterY - 150}+12*sin(${localTime}*5)`,
          fontSize: `250*(0.9+0.08*sin(${localTime}*5))`,
          color: accent,
          startMs: event.startMs,
          endMs: event.endMs,
          borderWidth: 0,
        }),
        drawText({
          text: "●",
          x: `${panelCenterX}+135*cos(${localTime}*3.8)-25`,
          y: `${panelCenterY}+135*sin(${localTime}*3.8)-38`,
          fontSize: 58,
          color: "0xf8f7f0",
          startMs: event.startMs,
          endMs: event.endMs,
          borderWidth: 0,
        }),
        drawBox({
          x: `${panelCenterX - 210}`,
          y: `${panelCenterY + 165}`,
          w: `420*${progress}`,
          h: 8,
          color: "0xf8f7f0@0.9",
          startMs: event.startMs,
          endMs: event.endMs,
        }),
      );
    } else if (event.motif === "cta") {
      filters.push(
        drawBox({
          x: panelCenterX - 165,
          y: panelCenterY - 70,
          w: 300,
          h: 190,
          color: `${accent}@0.16`,
          startMs: event.startMs,
          endMs: event.endMs,
          thickness: 8,
        }),
        drawText({
          text: "?",
          x: `${panelCenterX + 62}+8*sin(${localTime}*9)`,
          y: panelCenterY - 175,
          fontSize: `210*(0.78+0.22*min(max(${localTime}/0.16,0),1))`,
          color: "0xf8f7f0",
          startMs: event.startMs,
          endMs: event.endMs,
          borderWidth: 0,
        }),
        drawBox({
          x: panelCenterX - 200,
          y: panelCenterY + 165,
          w: `440*${progress}`,
          h: 12,
          color: accent,
          startMs: event.startMs,
          endMs: event.endMs,
        }),
      );
    } else if (event.motif === "question" || event.motif === "attention") {
      filters.push(
        drawText({
          text: event.motif === "question" ? "?" : "!",
          x: `${panelCenterX - 74}+10*sin(${localTime}*11)`,
          y: `${panelCenterY - 170}`,
          fontSize: `250*(0.72+0.28*min(max(${localTime}/0.14,0),1))`,
          color: accent,
          startMs: event.startMs,
          endMs: event.endMs,
          borderWidth: 0,
        }),
        drawBox({
          x: panelCenterX - 170,
          y: panelCenterY + 150,
          w: `360*${progress}`,
          h: 10,
          color: "0xf8f7f0",
          startMs: event.startMs,
          endMs: event.endMs,
        }),
      );
    }

    if (index === 0 || event.motif === "risk" || event.motif === "question") {
      filters.push(drawBox({
        x: `mod((t-${start})*${WIDTH * 4},${WIDTH + 460})-260`,
        y: 100 + (index % 2) * 90,
        w: 300,
        h: 13,
        color: `${accent}@0.84`,
        startMs: event.startMs,
        endMs: Math.min(event.endMs, event.startMs + 190),
      }));
      filters.push(drawBox({
        x: 0,
        y: 0,
        w: WIDTH,
        h: HEIGHT,
        color: "0xf8f7f0@0.55",
        startMs: event.startMs,
        endMs: Math.min(event.endMs, event.startMs + 55),
      }));
    }

    filters.push(drawBox({
      x: event.side === "right" ? 104 : WIDTH - 370,
      y: 840,
      w: `260*${progress}`,
      h: 9,
      color: accent,
      startMs: event.startMs,
      endMs: event.endMs,
    }));
    filters.push(drawBox({
      x: event.side === "right"
        ? `${WIDTH}-300-${localTime}*${WIDTH * 5}`
        : `-300+${localTime}*${WIDTH * 5}`,
      y: 120 + (index % 4) * 92,
      w: 300,
      h: 10,
      color: `${accent}@0.92`,
      startMs: event.startMs,
      endMs: Math.min(event.endMs, event.startMs + 400),
    }));
  });

  return { backgroundFilters, filters, plateEnable, plateEvents };
}

async function main(): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "hype-kinetic-script-"));
  const captionsPath = join(tempDir, "captions.ass");
  const filterGraphPath = join(tempDir, "filter-graph.txt");
  const outputTempPath = join(tempDir, "rendered.mp4");

  try {
    const { stdout: sourceProbeResult } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_name,codec_type,width,height,r_frame_rate",
      "-of", "json",
      SOURCE_VIDEO_PATH,
    ]);
    const sourceProbe = JSON.parse(sourceProbeResult) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
      }>;
    };
    const sourceDurationMs = Math.round(Number(sourceProbe.format?.duration) * 1_000);
    const sourceVideo = sourceProbe.streams?.find((stream) => stream.codec_type === "video");
    const sourceAudio = sourceProbe.streams?.find((stream) => stream.codec_type === "audio");
    if (
      !Number.isFinite(sourceDurationMs)
      || sourceDurationMs < 10_000
      || !sourceVideo
      || sourceVideo.width !== WIDTH
      || sourceVideo.height !== HEIGHT
      || sourceAudio?.codec_name !== "aac"
    ) {
      throw new Error("The existing HYPE MP4 must contain the expected 1920x1080 video and AAC soundtrack.");
    }
    const durationMs = sourceDurationMs;
    const voices = [{
      sceneId: 1,
      startTime: 0,
      endTime: durationMs,
      text: SCRIPT,
    }];
    const beats = buildCoinOverviewLongPhraseBeats({ voices, durationMs });
    const kineticBeats = makeKineticBeats(beats, durationMs);
    if (!kineticBeats.length || kineticBeats.some((beat) =>
      beat.endMs - beat.startMs > MAX_VISUAL_HOLD_MS + 1,
    )) {
      throw new Error("The kinetic montage plan contains an empty beat or a visual hold longer than 1.35 seconds.");
    }
    const kinetic = buildKineticGraphics(kineticBeats);
    const plates = await createKineticPlates(tempDir);
    const captions = buildCoinOverviewLongPhraseCaptions({
      voices,
      durationMs,
      width: WIDTH,
      height: HEIGHT,
      chunkStartMs: 0,
      chunkEndMs: durationMs,
    });
    await writeFile(captionsPath, captions, "utf8");

    const durationSeconds = (durationMs / 1000).toFixed(3);
    const graph: string[] = [
      `[0:v]${kinetic.backgroundFilters.join(",")}[base]`,
    ];
    let currentLabel = "base";
    for (let index = 0; index < plates.length; index += 1) {
      const enable = kinetic.plateEnable.get(index);
      if (!enable) continue;
      const plateInput = index + 2;
      const nextLabel = `plated${index}`;
      const side = index % 2 === 0 ? "left" : "right";
      const slideX = buildPlateSlideExpression(kinetic.plateEvents.get(index) ?? [], side);
      graph.push(`[${plateInput}:v]format=rgba[plate${index}]`);
      graph.push(
        `[${currentLabel}][plate${index}]overlay=x=${quoteFilterValue(slideX)}:y=0:format=auto:eof_action=repeat:enable=${quoteFilterValue(enable)}[${nextLabel}]`,
      );
      currentLabel = nextLabel;
    }
    graph.push(
      `[${currentLabel}]${kinetic.filters.join(",")},subtitles=${captionsPath},fps=30,format=yuv420p[video]`,
    );
    await writeFile(filterGraphPath, graph.join(";\n"), "utf8");

    const sourceAudioHash = await hashAudioStream(SOURCE_VIDEO_PATH);
    const ffmpegArgs = [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", `color=c=0x111820:s=${WIDTH}x${HEIGHT}:r=30:d=${durationSeconds}`,
      "-i", SOURCE_VIDEO_PATH,
    ];
    for (const plate of plates) {
      ffmpegArgs.push("-loop", "1", "-framerate", "30", "-i", plate);
    }
    ffmpegArgs.push(
      "-filter_complex_script", filterGraphPath,
      "-map", "[video]",
      "-map", "1:a:0",
      "-t", durationSeconds,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
      "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "copy",
      "-movflags", "+faststart",
      outputTempPath,
    );
    await execFileAsync("ffmpeg", ffmpegArgs, { maxBuffer: 24 * 1024 * 1024 });
    const outputAudioHash = await hashAudioStream(outputTempPath);
    if (outputAudioHash !== sourceAudioHash) {
      throw new Error("The final MP4 audio differs from the original; refusing to replace the source.");
    }

    const { stdout: probeResult } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate,codec_type",
      "-of", "json",
      outputTempPath,
    ]);
    const probe = JSON.parse(probeResult) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
      }>;
    };
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
    if (
      video?.codec_name !== "h264"
      || video.width !== WIDTH
      || video.height !== HEIGHT
      || video.r_frame_rate !== "30/1"
      || audio?.codec_name !== "aac"
      || Number(probe.format?.duration) < durationMs / 1000 - 0.2
    ) {
      throw new Error("The finished MP4 did not pass duration, video, and audio checks.");
    }

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await copyFile(outputTempPath, OUTPUT_PATH);
    console.log(JSON.stringify({
      outputPath: OUTPUT_PATH,
      durationMs,
      bytes: (await stat(OUTPUT_PATH)).size,
      beatCount: beats.length,
      resolution: `${WIDTH}x${HEIGHT}`,
      frameRate: "30 FPS",
      phraseBeatCount: beats.length,
      visualChangeCount: kineticBeats.length,
      maxVisualHoldMs: Math.max(...kineticBeats.map((beat) => beat.endMs - beat.startMs)),
      audioCopiedUnchanged: true,
    }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function hashAudioStream(path: string): Promise<string> {
  const { stdout } = await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-i", path,
    "-map", "0:a:0",
    "-c:a", "copy",
    "-f", "hash",
    "-hash", "md5",
    "-",
  ], { maxBuffer: 2 * 1024 * 1024 });
  const hash = stdout.trim();
  if (!hash.startsWith("MD5=")) throw new Error("Could not verify the source audio stream.");
  return hash;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});