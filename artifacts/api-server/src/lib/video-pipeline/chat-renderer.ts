import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { readAudioAsset } from "../audio-design/storage";

const execFileAsync = promisify(execFile);
const WIDTH = 1080;
const HEIGHT = 1920;
export const CHAT_INTRO_DURATION_SECONDS = 9;
const CHAT_INTRO_PATH = resolve(process.cwd(), "assets/chat-intro.mov");
const CHAT_TOP = 315;
const CHAT_BOTTOM = 1665;
const FONT = "DejaVu Sans";

export type ChatRenderMessage = {
  text: string;
  durationMs: number;
  sender: "anonymous" | "contact";
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string, maxChars: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current.length + word.length + 1) <= maxChars) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["…"];
}

function textBlock(lines: string[], x: number, y: number, color: string, size = 31): string {
  return `<text x="${x}" y="${y}" fill="${color}" font-family="${FONT}" font-size="${size}" font-weight="400">${
    lines.map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : size + 9}">${escapeXml(line)}</tspan>`).join("")
  }</text>`;
}

function iconCircle(cx: number, cy: number, label: string, fill: string, color: string): string {
  return [
    `<circle cx="${cx}" cy="${cy}" r="38" fill="${fill}"/>`,
    `<text x="${cx}" y="${cy + 10}" text-anchor="middle" fill="${color}" font-family="${FONT}" font-size="28">${escapeXml(label)}</text>`,
  ].join("");
}

function headerAndFooter(): string {
  return [
    `<rect x="14" y="18" width="1052" height="1884" rx="92" fill="#f7f8fc"/>`,
    `<rect x="370" y="18" width="340" height="54" rx="28" fill="#050505"/>`,
    `<text x="45" y="143" fill="#1d1e24" font-family="${FONT}" font-size="27">Закрыть</text>`,
    `<text x="540" y="139" text-anchor="middle" fill="#17181d" font-family="${FONT}" font-size="31" font-weight="700">ВАЙБ | Общение и игры</text>`,
    `<text x="540" y="176" text-anchor="middle" fill="#6e7078" font-family="${FONT}" font-size="20">мини-приложение</text>`,
    `<circle cx="1002" cy="132" r="28" fill="none" stroke="#1b1c21" stroke-width="3"/>`,
    `<text x="1002" y="142" text-anchor="middle" fill="#1b1c21" font-family="${FONT}" font-size="26">•••</text>`,
    `<line x1="18" y1="224" x2="1062" y2="224" stroke="#e4e5eb" stroke-width="2"/>`,
    `<circle cx="100" cy="306" r="39" fill="#ffffff"/>`,
    `<circle cx="100" cy="296" r="12" fill="none" stroke="#aeb3be" stroke-width="4"/>`,
    `<path d="M76 334 Q100 310 124 334" fill="none" stroke="#aeb3be" stroke-width="4"/>`,
    `<text x="173" y="297" fill="#252630" font-family="${FONT}" font-size="29" font-weight="700">Аноним</text>`,
    `<rect x="286" y="273" width="28" height="28" rx="8" fill="#4e6ce0"/>`,
    `<text x="300" y="294" text-anchor="middle" fill="#ffffff" font-family="${FONT}" font-size="18" font-weight="700">3</text>`,
    `<text x="173" y="330" fill="#4b9a72" font-family="${FONT}" font-size="22">в переписке</text>`,
    iconCircle(838, 303, "×", "#ffffff", "#4a91bd"),
    iconCircle(938, 303, "⌁", "#f7d9de", "#c96c76"),
    `<rect x="18" y="1662" width="1044" height="220" fill="#f7f8fc"/>`,
    `<line x1="18" y1="1662" x2="1062" y2="1662" stroke="#e4e5eb" stroke-width="2"/>`,
    iconCircle(100, 1788, "⚑", "#ffffff", "#7f8491"),
    `<rect x="177" y="1740" width="705" height="96" rx="48" fill="#ffffff"/>`,
    `<text x="216" y="1801" fill="#a8acb7" font-family="${FONT}" font-size="27">Сообщение...</text>`,
    iconCircle(974, 1788, "➤", "#8fc9f4", "#ffffff"),
  ].join("");
}

function messageSvg(message: ChatRenderMessage, x: number, y: number): { markup: string; height: number } {
  const incoming = message.sender === "contact";
  const maxChars = incoming ? 28 : 27;
  const lines = wrapText(message.text, maxChars);
  const height = Math.max(82, 43 + lines.length * 42);
  const width = Math.min(760, Math.max(260, Math.max(...lines.map((line) => line.length)) * 22 + 64));
  const left = incoming ? x : WIDTH - x - width;
  const fill = incoming ? "#ffffff" : "#d9f6e5";
  const textX = left + 28;
  return {
    height,
    markup: [
      `<rect x="${left}" y="${y}" width="${width}" height="${height}" rx="28" fill="${fill}" stroke="#e6e8ee" stroke-width="1"/>`,
      textBlock(lines, textX, y + 42, "#30323b", 29),
      `<text x="${left + width - 24}" y="${y + height - 14}" text-anchor="end" fill="#a1a5af" font-family="${FONT}" font-size="17">✓✓</text>`,
    ].join(""),
  };
}

function renderChatSvg(messages: ChatRenderMessage[], typingSender?: ChatRenderMessage["sender"]): string {
  const visible = messages.slice(-8);
  const rendered: string[] = [];
  let cursor = CHAT_BOTTOM;
  for (let index = visible.length - 1; index >= 0; index -= 1) {
    const result = messageSvg(visible[index]!, visible[index]!.sender === "contact" ? 66 : 66, 0);
    cursor -= result.height;
    rendered.unshift(messageSvg(visible[index]!, 66, cursor).markup);
    cursor -= 18;
  }
  if (typingSender) {
    const incoming = typingSender === "contact";
    const left = incoming ? 66 : 780;
    const fill = incoming ? "#ffffff" : "#d9f6e5";
    rendered.push(
      `<rect x="${left}" y="${Math.max(CHAT_TOP, cursor - 70)}" width="128" height="62" rx="30" fill="${fill}" stroke="#e6e8ee" stroke-width="1"/>`,
      `<text x="${left + 64}" y="${Math.max(CHAT_TOP, cursor - 30)}" text-anchor="middle" fill="#8d919b" font-family="${FONT}" font-size="28">•••</text>`,
    );
  }
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
    `<rect width="${WIDTH}" height="${HEIGHT}" fill="#000000"/>`,
    headerAndFooter(),
    ...rendered,
    `</svg>`,
  ].join("");
}

async function encodeChatVideo(
  dir: string,
  frameFiles: string[],
  frameDurationsMs: number[],
  audioStoragePath: string,
  durationMs: number,
): Promise<{ buffer: Buffer; durationMs: number }> {
  const concatPath = join(dir, "chat-frames.txt");
  const lines: string[] = [];
  frameFiles.forEach((file, index) => {
    lines.push(`file '${file.replaceAll("'", "'\\''")}'`);
    if (index < frameFiles.length - 1) lines.push(`duration ${frameDurationsMs[index]! / 1000}`);
  });
  lines.push(`file '${frameFiles.at(-1)!.replaceAll("'", "'\\''")}'`);
  await writeFile(concatPath, `${lines.join("\n")}\n`, "utf8");

  const silentVideo = join(dir, "chat-video.mp4");
  await execFileAsync("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", concatPath,
    "-vf", "fps=30,format=yuv420p",
    "-t", String(durationMs / 1000),
    "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", silentVideo,
  ], { maxBuffer: 10 * 1024 * 1024 });

  const audioPath = join(dir, "chat-audio.mp3");
  await writeFile(audioPath, await readAudioAsset(audioStoragePath));
  const output = join(dir, "chat-final.mp4");
  await execFileAsync("ffmpeg", [
    "-y", "-i", silentVideo, "-i", audioPath,
    "-map", "0:v:0", "-map", "1:a:0", "-t", String(durationMs / 1000),
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output,
  ], { maxBuffer: 10 * 1024 * 1024 });

  const buffer = await readFile(output);
  return { buffer, durationMs };
}

async function probeDurationMs(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Could not read video duration: ${filePath}`);
  }
  return Math.round(seconds * 1000);
}

async function normalizeIntroVideo(dir: string): Promise<{ path: string; durationMs: number }> {
  const durationMs = await probeDurationMs(CHAT_INTRO_PATH);
  const normalizedPath = join(dir, "chat-intro-normalized.mp4");
  await execFileAsync("ffmpeg", [
    "-y", "-i", CHAT_INTRO_PATH,
    "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black",
    "-r", "30",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    normalizedPath,
  ], { maxBuffer: 10 * 1024 * 1024 });
  return { path: normalizedPath, durationMs };
}

async function prependIntro(
  dir: string,
  introPath: string,
  chatPath: string,
): Promise<Buffer> {
  const output = join(dir, "chat-with-intro.mp4");
  await execFileAsync("ffmpeg", [
    "-y", "-i", introPath, "-i", chatPath,
    "-filter_complex", "[0:v:0][0:a:0][1:v:0][1:a:0]concat=n=2:v=1:a=1[v][a]",
    "-map", "[v]", "-map", "[a]",
    "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k",
    "-movflags", "+faststart",
    output,
  ], { maxBuffer: 10 * 1024 * 1024 });
  return readFile(output);
}

export async function renderChatVideo(params: {
  messages: ChatRenderMessage[];
  audioStoragePath: string;
  durationMs: number;
}): Promise<{ buffer: Buffer; durationMs: number }> {
  if (!params.messages.length) throw new Error("At least one chat message is required");
  const dir = await mkdtemp(join("/tmp", "chat-render-"));
  try {
    const intro = await normalizeIntroVideo(dir);
    const chatDurationMs = Math.max(1_000, params.durationMs - intro.durationMs);
    const frameFiles: string[] = [];
    const frameDurationsMs: number[] = [];
    const normalizedTotal = params.messages.reduce((sum, message) => sum + Math.max(1, message.durationMs), 0);
    const scale = chatDurationMs / normalizedTotal;
    const visible: ChatRenderMessage[] = [];

    for (const [index, message] of params.messages.entries()) {
      const durationMs = Math.max(600, Math.round(message.durationMs * scale));
      const typingMs = Math.min(650, Math.max(250, Math.round(durationMs * 0.18)));
      const typingPath = join(dir, `frame-${index}-typing.png`);
      await writeFile(join(dir, `frame-${index}-typing.svg`), renderChatSvg(visible, message.sender), "utf8");
      await execFileAsync("convert", [join(dir, `frame-${index}-typing.svg`), typingPath]);
      frameFiles.push(typingPath);
      frameDurationsMs.push(typingMs);

      visible.push(message);
      const messagePath = join(dir, `frame-${index}.png`);
      await writeFile(join(dir, `frame-${index}.svg`), renderChatSvg(visible), "utf8");
      await execFileAsync("convert", [join(dir, `frame-${index}.svg`), messagePath]);
      frameFiles.push(messagePath);
      frameDurationsMs.push(Math.max(250, durationMs - typingMs));
    }

    const chatVideo = await encodeChatVideo(dir, frameFiles, frameDurationsMs, params.audioStoragePath, chatDurationMs);
    const buffer = await prependIntro(dir, intro.path, join(dir, "chat-final.mp4"));
    return { buffer, durationMs: intro.durationMs + chatVideo.durationMs };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}