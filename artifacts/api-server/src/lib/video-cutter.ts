import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { storeAudioAsset } from "./audio-design/storage";

const execFileAsync = promisify(execFile);
const MIN_CLIP_SECONDS = 60;
const MAX_CLIP_SECONDS = 120;

export type VideoCut = {
  sequence: number;
  startSeconds: number;
  durationSeconds: number;
  storagePath: string;
};

type ProbeResult = {
  streams?: Array<{
    codec_type?: string;
    duration?: string;
    width?: number;
    height?: number;
  }>;
  format?: { duration?: string };
};

async function probeVideo(filePath: string): Promise<{
  durationSeconds: number;
  width: number;
  height: number;
}> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,duration,width,height:format=duration",
    "-of", "json",
    filePath,
  ]);
  const probe = JSON.parse(stdout) as ProbeResult;
  const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
  const durationSeconds = Number.parseFloat(probe.format?.duration || videoStream?.duration || "0");
  const width = Number(videoStream?.width || 0);
  const height = Number(videoStream?.height || 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds < MIN_CLIP_SECONDS || !width || !height) {
    throw new Error("Исходное видео должно быть длиннее 60 секунд.");
  }
  return { durationSeconds, width, height };
}

function chooseSegments(durationSeconds: number, requestedCount: number): Array<{ startSeconds: number; durationSeconds: number }> {
  const possibleCount = Math.max(1, Math.floor(durationSeconds / MIN_CLIP_SECONDS));
  const count = Math.min(requestedCount, possibleCount);
  const clipDuration = Math.min(
    MAX_CLIP_SECONDS,
    Math.max(MIN_CLIP_SECONDS, durationSeconds / count),
  );
  const maxStart = Math.max(0, durationSeconds - clipDuration);
  const step = count > 1 ? maxStart / (count - 1) : 0;

  return Array.from({ length: count }, (_, index) => ({
    startSeconds: Math.max(0, Math.min(maxStart, step * index)),
    durationSeconds: Math.min(clipDuration, durationSeconds - step * index),
  }));
}

function formatSeconds(value: number): string {
  return value.toFixed(3);
}

function shortsRenderFilter(): string {
  return [
    "[0:v]split=2[backgroundSource][foregroundSource]",
    "[backgroundSource]scale=1080:1920:force_original_aspect_ratio=increase,"
      + "crop=1080:1920,boxblur=12:4,eq=brightness=-0.12:saturation=0.92[background]",
    "[foregroundSource]scale=1080:1920:force_original_aspect_ratio=decrease,"
      + "format=rgba,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0[foreground]",
    "[background][foreground]overlay=0:0:format=auto,format=yuv420p[video]",
  ].join(";");
}

function resolveYtDlpInvocation(): {
  command: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
} {
  const rootCandidates = [
    process.cwd(),
    join(process.cwd(), ".."),
    join(process.cwd(), "..", ".."),
  ];
  const workspaceRoot = rootCandidates.find((root) => existsSync(join(root, ".pythonlibs"))) || process.cwd();
  const pythonPath = join(workspaceRoot, ".pythonlibs", "bin", "python");
  const sitePackages = join(workspaceRoot, ".pythonlibs", "lib", "python3.12", "site-packages");
  if (existsSync(pythonPath) && existsSync(join(sitePackages, "yt_dlp"))) {
    return {
      command: pythonPath,
      args: ["-m", "yt_dlp"],
      env: {
        ...process.env,
        PYTHONPATH: [sitePackages, process.env.PYTHONPATH].filter(Boolean).join(":"),
      },
    };
  }
  return { command: "yt-dlp", args: [] };
}

export async function createVideoCuts(
  sourceUrl: string,
  options: {
    count?: number;
    onClipStart?: (current: number, total: number) => Promise<void>;
    onProgress?: (completed: number, total: number) => Promise<void>;
  } = {},
): Promise<VideoCut[]> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new Error("Нужна корректная ссылка на видео.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Поддерживаются только публичные http/https-ссылки.");
  }

  const dir = await mkdtemp(join(tmpdir(), "kliply-video-cuts-"));
  const outputTemplate = join(dir, "source.%(ext)s");
  try {
    const ytDlp = resolveYtDlpInvocation();
    await execFileAsync(ytDlp.command, [
      ...ytDlp.args,
      "--no-playlist",
      "--no-warnings",
      "--extractor-args", "youtube:player_client=android",
      "--format", "bv*[height<=1440]+ba/b[height<=1440]/b",
      "--merge-output-format", "mp4",
      "--output", outputTemplate,
      sourceUrl,
    ], { env: ytDlp.env, timeout: 15 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });

    const files = await readdir(dir);
    const sourceFileName = files.find((file) => file.startsWith("source."));
    if (!sourceFileName) throw new Error("Не удалось скачать видео по этой ссылке.");
    const sourcePath = join(dir, sourceFileName);
    const source = await probeVideo(sourcePath);
    const segments = chooseSegments(source.durationSeconds, options.count || 15);
    const cuts: VideoCut[] = [];

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]!;
      const clipPath = join(dir, `clip-${String(index + 1).padStart(2, "0")}.mp4`);
      await options.onClipStart?.(index + 1, segments.length);
      await execFileAsync("ffmpeg", [
        "-y",
        "-ss", formatSeconds(segment.startSeconds),
        "-i", sourcePath,
        "-t", formatSeconds(segment.durationSeconds),
        "-map", "0:v:0",
        "-filter_complex", shortsRenderFilter(),
        "-map", "[video]",
        "-map", "0:a?",
        "-sn",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "18",
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-sws_flags", "lanczos+accurate_rnd+full_chroma_int",
        "-movflags", "+faststart",
        clipPath,
      ], { timeout: 10 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });

      const clipBuffer = await readFile(clipPath);
      if (!clipBuffer.length) throw new Error(`Нарезка ${index + 1} получилась пустой.`);
      const storagePath = await storeAudioAsset(clipBuffer, "video", "video/mp4", "mp4");
      cuts.push({
        sequence: index + 1,
        startSeconds: segment.startSeconds,
        durationSeconds: segment.durationSeconds,
        storagePath,
      });
      await options.onProgress?.(cuts.length, segments.length);
    }

    return cuts;
  } catch (error) {
    const message = error instanceof Error ? error.message : "неизвестная ошибка";
    if (/ENOENT|spawn yt-dlp/i.test(message)) {
      throw new Error("Загрузчик публичных видео недоступен в окружении.");
    }
    throw new Error(`Не удалось скачать или нарезать видео: ${message.slice(0, 500)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}