import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { availableParallelism, tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { readAudioAsset, storeAudioAsset } from "./audio-design/storage";
import { analyzeInterestingMoments } from "./video-highlight-analyzer";

const execFileAsync = promisify(execFile);
const MIN_CLIP_SECONDS = 60;
const MAX_CLIP_SECONDS = 120;
const CUT_ENCODE_CONCURRENCY = Math.min(2, availableParallelism());
const CUT_ENCODER_THREADS = Math.max(1, Math.floor(availableParallelism() / CUT_ENCODE_CONCURRENCY));

export type VideoCut = {
  sequence: number;
  startSeconds: number;
  durationSeconds: number;
  storagePath: string;
  reason?: string;
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

function formatSeconds(value: number): string {
  return value.toFixed(3);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index]!, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function shortsRenderFilter(bannerKind: "image" | "video" | null): string {
  const filters = [
    "[0:v]split=2[backgroundSource][foregroundSource]",
    "[backgroundSource]scale=1080:1920:force_original_aspect_ratio=increase,"
      + "crop=1080:1920,boxblur=12:4,eq=brightness=-0.12:saturation=0.92[background]",
    "[foregroundSource]scale=1080:1920:force_original_aspect_ratio=decrease,"
      + "format=rgba,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0[foreground]",
    "[background][foreground]overlay=0:0:format=auto,format=yuv420p[baseVideo]",
  ];
  if (bannerKind) {
    const removeGreen = bannerKind === "video"
      ? ",chromakey=0x00ff00:0.24:0.08"
      : "";
    filters.push(
      `[1:v]scale=760:-2:force_original_aspect_ratio=decrease,format=rgba${removeGreen}[banner]`,
      "[baseVideo][banner]overlay=(W-w)/2:48:eof_action=repeat,format=yuv420p[video]",
    );
  } else {
    filters.push("[baseVideo]null[video]");
  }
  return filters.join(";");
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
    onAnalysisProgress?: (message: string) => Promise<void>;
    banner?: { storagePath: string; kind: "image" | "video" };
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
    const highlights = await analyzeInterestingMoments({
      sourcePath,
      workDir: dir,
      durationSeconds: source.durationSeconds,
      requestedCount: Math.min(options.count || 15, Math.floor(source.durationSeconds / MIN_CLIP_SECONDS)),
      onProgress: options.onAnalysisProgress,
    });
    let bannerPath: string | null = null;
    if (options.banner) {
      const bannerBuffer = await readAudioAsset(options.banner.storagePath);
      if (!bannerBuffer.length) throw new Error("Файл баннера пустой.");
      bannerPath = join(dir, options.banner.kind === "video" ? "banner.mp4" : "banner.png");
      await writeFile(bannerPath, bannerBuffer);
    }
    let completedCount = 0;
    const cuts = await mapWithConcurrency(highlights, CUT_ENCODE_CONCURRENCY, async (highlight, index) => {
      const segment = {
        startSeconds: highlight.startSeconds,
        durationSeconds: Math.min(MAX_CLIP_SECONDS, highlight.endSeconds - highlight.startSeconds),
      };
      const clipPath = join(dir, `clip-${String(index + 1).padStart(2, "0")}.mp4`);
      await options.onClipStart?.(index + 1, highlights.length);
      const ffmpegArgs = [
        "-y",
        "-ss", formatSeconds(segment.startSeconds),
        "-i", sourcePath,
        ...(bannerPath
          ? [options.banner?.kind === "video" ? "-stream_loop" : "-loop", "-1", "-i", bannerPath]
          : []),
        "-t", formatSeconds(segment.durationSeconds),
        "-map", "0:v:0",
        "-filter_complex", shortsRenderFilter(options.banner?.kind || null),
        "-map", "[video]",
        "-map", "0:a?",
        "-sn",
        "-c:v", "libx264",
        "-preset", "superfast",
        "-threads", String(CUT_ENCODER_THREADS),
        "-crf", "18",
        "-maxrate", "2600k",
        "-bufsize", "5200k",
        "-profile:v", "high",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-ar", "48000",
        "-sws_flags", "lanczos+accurate_rnd+full_chroma_int",
        "-movflags", "+faststart",
        clipPath,
      ];
      await execFileAsync("ffmpeg", ffmpegArgs, { timeout: 10 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });

      const clipBuffer = await readFile(clipPath);
      if (!clipBuffer.length) throw new Error(`Нарезка ${index + 1} получилась пустой.`);
      const storagePath = await storeAudioAsset(clipBuffer, "video", "video/mp4", "mp4");
      completedCount += 1;
      await options.onProgress?.(completedCount, highlights.length);
      return {
        sequence: index + 1,
        startSeconds: segment.startSeconds,
        durationSeconds: segment.durationSeconds,
        storagePath,
        reason: highlight.reason,
      };
    });

    return cuts.sort((left, right) => left.sequence - right.sequence);
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