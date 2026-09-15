import { execFile } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { generateInstrumentalMusic } from "./audio-design/generated-music";
import { musicProvider } from "./audio-design/openverse-provider";
import { readAudioAsset, storeAudioAsset } from "./audio-design/storage";

const execFileAsync = promisify(execFile);
const TRANSITION_SECONDS = 0.28;

type ProbeResult = {
  streams?: Array<{ codec_type?: string; duration?: string; width?: number; height?: number }>;
  format?: { duration?: string };
};

type OutputFormat = {
  name: string;
  width: number;
  height: number;
};

const OUTPUT_FORMATS = {
  portrait: { name: "9:16", width: 1080, height: 1920 },
  feed: { name: "4:5", width: 1080, height: 1350 },
  square: { name: "1:1", width: 1080, height: 1080 },
  landscape: { name: "16:9", width: 1920, height: 1080 },
} satisfies Record<string, OutputFormat>;

type AdaptationStyle = {
  transition: string;
  contrast: number;
  saturation: number;
  brightness: number;
  hue: number;
  zoom: number;
  cropX: number;
  cropY: number;
  brandColor: string;
  brandText: string;
};

const STYLES: AdaptationStyle[] = [
  {
    transition: "wipeleft",
    contrast: 1.08,
    saturation: 1.2,
    brightness: 0.018,
    hue: 0,
    zoom: 1.06,
    cropX: 0.18,
    cropY: 0.42,
    brandColor: "0x1683ff",
    brandText: "KLIPLY",
  },
  {
    transition: "slideup",
    contrast: 1.03,
    saturation: 1.1,
    brightness: -0.008,
    hue: 3,
    zoom: 1.1,
    cropX: 0.62,
    cropY: 0.28,
    brandColor: "0xff6a2a",
    brandText: "KLIPLY",
  },
  {
    transition: "circleopen",
    contrast: 1.1,
    saturation: 0.98,
    brightness: 0.01,
    hue: -4,
    zoom: 1.08,
    cropX: 0.42,
    cropY: 0.64,
    brandColor: "0x8c5cff",
    brandText: "KLIPLY",
  },
  {
    transition: "fade",
    contrast: 1.05,
    saturation: 1.28,
    brightness: 0.005,
    hue: 1,
    zoom: 1.04,
    cropX: 0.76,
    cropY: 0.5,
    brandColor: "0x16c79a",
    brandText: "KLIPLY",
  },
];

async function probeVideo(input: string): Promise<{ durationSeconds: number; hasAudio: boolean; width: number; height: number }> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,duration,width,height:format=duration",
    "-of", "json",
    input,
  ]);
  const probe = JSON.parse(stdout) as ProbeResult;
  const duration = Number.parseFloat(
    probe.format?.duration
      || probe.streams?.find((stream) => stream.codec_type === "video")?.duration
      || "0",
  );
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Не удалось определить длительность видео.");
  }
  const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
  const width = Number(videoStream?.width || 0);
  const height = Number(videoStream?.height || 0);
  if (!width || !height) throw new Error("Не удалось определить разрешение видео.");
  return {
    durationSeconds: duration,
    hasAudio: Boolean(probe.streams?.some((stream) => stream.codec_type === "audio")),
    width,
    height,
  };
}

function chooseOutputFormat(width: number, height: number): OutputFormat {
  const aspect = width / height;
  const options = aspect >= 1.3
    ? [OUTPUT_FORMATS.landscape, OUTPUT_FORMATS.feed, OUTPUT_FORMATS.square]
    : aspect <= 0.8
      ? [OUTPUT_FORMATS.portrait, OUTPUT_FORMATS.feed, OUTPUT_FORMATS.square]
      : [OUTPUT_FORMATS.feed, OUTPUT_FORMATS.square, OUTPUT_FORMATS.portrait];
  return options[randomInt(0, options.length)];
}

function segmentDurations(durationSeconds: number): number[] {
  const segmentCount = durationSeconds >= 18 ? 4 : durationSeconds >= 8 ? 3 : durationSeconds >= 4 ? 2 : 1;
  if (segmentCount === 1) return [durationSeconds];
  const boundaries = Array.from({ length: segmentCount - 1 }, (_, index) => {
    const ideal = durationSeconds * (index + 1) / segmentCount;
    const jitter = Math.min(durationSeconds * 0.08, Math.max(0.25, durationSeconds / segmentCount / 5));
    return ideal + (randomInt(0, 2) ? jitter : -jitter);
  }).sort((a, b) => a - b);
  return [boundaries[0], ...boundaries.slice(1).map((boundary, index) => boundary - boundaries[index]), durationSeconds - boundaries[boundaries.length - 1]];
}

function segmentFilter(
  start: number,
  end: number,
  index: number,
  style: AdaptationStyle,
  outputFormat: OutputFormat,
): string {
  const zoom = style.zoom + index * 0.012;
  const backgroundWidth = Math.round(outputFormat.width * zoom);
  const backgroundHeight = Math.round(outputFormat.height * zoom);
  const cropX = Math.min(1, Math.max(0, style.cropX + (index % 2 ? 0.1 : -0.05)));
  const cropY = Math.min(1, Math.max(0, style.cropY + (index % 3 ? -0.06 : 0.08)));
  const background = `split=2[bg${index}][fg${index}];` +
    `[bg${index}]scale=${backgroundWidth}:${backgroundHeight}:force_original_aspect_ratio=increase,` +
    `crop=${outputFormat.width}:${outputFormat.height}:(iw-${outputFormat.width})*${cropX.toFixed(3)}:(ih-${outputFormat.height})*${cropY.toFixed(3)},` +
    "boxblur=18:2,eq=brightness=-0.04:saturation=1.08[background" + index + "];" +
    `[fg${index}]scale=${outputFormat.width}:${outputFormat.height}:force_original_aspect_ratio=decrease[foreground${index}];` +
    `[background${index}][foreground${index}]overlay=(W-w)/2:(H-h)/2`;
  return [
    `trim=start=${start.toFixed(3)}:end=${end.toFixed(3)}`,
    "setpts=PTS-STARTPTS",
    background,
    `eq=contrast=${(style.contrast + index * 0.01).toFixed(3)}:saturation=${style.saturation.toFixed(3)}:brightness=${style.brightness.toFixed(3)}`,
    `hue=h=${style.hue + index}`,
    "unsharp=5:5:0.42:5:5:0",
    "fps=30",
    `format=yuv420p[v${index}]`,
  ].join(",");
}

function escapeDrawtextText(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}\s.,!?–—-]/gu, "")
    .replace(/\\/gu, "\\\\")
    .replace(/:/gu, "\\:")
    .replace(/'/gu, "\\'")
    .replace(/,/gu, "\\,")
    .replace(/%/gu, "\\%")
    .replace(/\r?\n/gu, " ")
    .trim()
    .slice(0, 80);
}

function buildVideoMontageFilter(
  durationParts: number[],
  style: AdaptationStyle,
  outputFormat: OutputFormat,
  label = style.brandText,
  focusLabel?: string,
): string {
  const filters: string[] = [];
  let start = 0;
  for (let index = 0; index < durationParts.length; index += 1) {
    const end = start + durationParts[index];
    filters.push(`[0:v]${segmentFilter(start, end, index, style, outputFormat)}`);
    start = end;
  }
  let current = "v0";
  let currentDuration = durationParts[0];
  for (let index = 1; index < durationParts.length; index += 1) {
    const output = `vx${index}`;
    const offset = Math.max(0.05, currentDuration - TRANSITION_SECONDS);
    filters.push(`[${current}][v${index}]xfade=transition=${style.transition}:duration=${TRANSITION_SECONDS}:offset=${offset.toFixed(3)}[${output}]`);
    current = output;
    currentDuration += durationParts[index] - TRANSITION_SECONDS;
  }
  const paddingSeconds = Math.max(0, (durationParts.length - 1) * TRANSITION_SECONDS);
  const brandWidth = Math.round(outputFormat.width * 0.278);
  const brandHeight = Math.round(outputFormat.height * 0.032);
  const brandFontSize = Math.max(24, Math.round(outputFormat.width * 0.03));
  const safeFocusLabel = focusLabel ? escapeDrawtextText(focusLabel) : "";
  const focusOverlay = safeFocusLabel
    ? `,drawtext=text='${safeFocusLabel}':fontcolor=white:fontsize=${Math.max(22, Math.round(brandFontSize * 0.8))}:x=52:y=${outputFormat.height - Math.round(outputFormat.height * 0.18)}:box=1:boxcolor=black@0.55:boxborderw=14:enable='between(t,0,2.5)'`
    : "";
  filters.push(`[${current}]drawbox=x=0:y=0:w=iw:h=${Math.max(6, Math.round(outputFormat.height * 0.007))}:color=${style.brandColor}@0.95:t=fill,drawbox=x=32:y=32:w=${brandWidth}:h=${brandHeight}:color=black@0.44:t=fill,drawtext=text='${escapeDrawtextText(label)}':fontcolor=white:fontsize=${brandFontSize}:x=52:y=48,drawtext=text='ADAPTED ${outputFormat.name}':fontcolor=white@0.78:fontsize=${Math.max(16, Math.round(brandFontSize * 0.56))}:x=52:y=${48 + brandFontSize + 8}${focusOverlay}${paddingSeconds > 0 ? `,tpad=stop_mode=clone:stop_duration=${paddingSeconds.toFixed(3)}` : ""}[montage]`);
  return filters.join(";");
}

function buildAudioMontageFilter(durationParts: number[], hasAudio: boolean): string | null {
  if (!hasAudio) return null;
  const filters: string[] = [];
  let start = 0;
  for (let index = 0; index < durationParts.length; index += 1) {
    const end = start + durationParts[index];
    filters.push(`[0:a]atrim=start=${start.toFixed(3)}:end=${end.toFixed(3)},asetpts=PTS-STARTPTS[a${index}]`);
    start = end;
  }
  let current = "a0";
  for (let index = 1; index < durationParts.length; index += 1) {
    const output = `ax${index}`;
    filters.push(`[${current}][a${index}]acrossfade=d=${TRANSITION_SECONDS}:c1=tri:c2=tri[${output}]`);
    current = output;
  }
  const paddingSeconds = Math.max(0, (durationParts.length - 1) * TRANSITION_SECONDS);
  filters.push(`[${current}]volume=0.86${paddingSeconds > 0 ? `,apad=pad_dur=${paddingSeconds.toFixed(3)}` : ""}[original]`);
  return filters.join(";");
}

export async function adaptVideoAsset(sourceStoragePath: string): Promise<string> {
  const source = await readAudioAsset(sourceStoragePath);
  if (!source.length) throw new Error("Исходный видеофайл пустой.");
  const dir = await mkdtemp(join(tmpdir(), "kliply-adaptation-"));
  const inputPath = join(dir, "source.mp4");
  const musicPath = join(dir, "music.mp3");
  const outputPath = join(dir, "kliply-adapted.mp4");
  try {
    await writeFile(inputPath, source);
    const { durationSeconds, hasAudio, width, height } = await probeVideo(inputPath);
    const style = STYLES[randomInt(0, STYLES.length)];
    const outputFormat = chooseOutputFormat(width, height);
    const durations = segmentDurations(durationSeconds);
    const mood = ["cinematic", "energetic", "motivational", "documentary"][randomInt(0, 4)];
    const music = await generateInstrumentalMusic({
      projectId: randomInt(1, 2_000_000_000),
      durationMs: durationSeconds * 1000,
      mood,
      category: "Kliply adaptation background",
    });
    await writeFile(musicPath, music.buffer);

    const videoFilter = buildVideoMontageFilter(durations, style, outputFormat);
    const audioFilter = buildAudioMontageFilter(durations, hasAudio);
    const filterComplex = [
      videoFilter,
      audioFilter,
      hasAudio
        ? "[1:a]volume=0.42[music];[original][music]amix=inputs=2:duration=first:dropout_transition=2[audio]"
        : "[1:a]volume=0.72[audio]",
    ].filter(Boolean).join(";");
    const args = [
      "-y",
      "-i", inputPath,
      "-i", musicPath,
      "-filter_complex", filterComplex,
      "-map", "[montage]",
      "-map", "[audio]",
      "-t", String(durationSeconds),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      outputPath,
    ];
    await execFileAsync("ffmpeg", args, { maxBuffer: 20 * 1024 * 1024 });
    const output = await readFile(outputPath);
    if (!output.length) throw new Error("FFmpeg вернул пустой адаптированный файл.");
    return storeAudioAsset(output, "video", "video/mp4", "mp4");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export type VideoEditOptions = {
  musicSource: "generated" | "library" | "none";
  musicMood: string;
  editStyle: string;
  focusLabel?: string;
};

async function resolveEditMusic(options: VideoEditOptions, durationSeconds: number): Promise<Buffer | null> {
  if (options.musicSource === "none") return null;
  if (options.musicSource === "generated") {
    const generated = await generateInstrumentalMusic({
      projectId: randomInt(1, 2_000_000_000),
      durationMs: durationSeconds * 1000,
      mood: options.musicMood,
      category: `Video edit ${options.editStyle}`,
    });
    return generated.buffer;
  }

  const assets = await musicProvider.search({
    query: `${options.musicMood} ${options.editStyle} instrumental background`,
    category: "video edit",
    mood: options.musicMood,
    limit: 8,
  });
  for (const asset of assets.filter((candidate) => !candidate.requiresAttribution)) {
    try {
      return await musicProvider.download(asset);
    } catch {
      // Individual public-library files may be unavailable; try another licensed result.
    }
  }
  throw new Error("Не удалось найти доступный трек в бесплатной библиотеке.");
}

export async function createVideoEditAsset(
  sourceStoragePath: string,
  options: VideoEditOptions,
): Promise<string> {
  const source = await readAudioAsset(sourceStoragePath);
  if (!source.length) throw new Error("Исходный видеофайл пустой.");
  const dir = await mkdtemp(join(tmpdir(), "kliply-video-edit-"));
  const inputPath = join(dir, "source.mp4");
  const musicPath = join(dir, "music.mp3");
  const outputPath = join(dir, "edit.mp4");
  try {
    await writeFile(inputPath, source);
    const { durationSeconds, hasAudio, width, height } = await probeVideo(inputPath);
    const style = STYLES[randomInt(0, STYLES.length)];
    const outputFormat = chooseOutputFormat(width, height);
    const durations = segmentDurations(durationSeconds);
    const music = await resolveEditMusic(options, durationSeconds);
    if (music) await writeFile(musicPath, music);

    const videoFilter = buildVideoMontageFilter(
      durations,
      style,
      outputFormat,
      "EDIT",
      options.focusLabel,
    );
    const audioFilter = buildAudioMontageFilter(durations, hasAudio);
    const audioOutput = music && hasAudio
      ? "[1:a]volume=0.42[music];[original][music]amix=inputs=2:duration=first:dropout_transition=2[audio]"
      : music
        ? "[1:a]volume=0.72[audio]"
        : hasAudio
          ? "[original]volume=0.86[audio]"
          : `anullsrc=r=44100:cl=stereo,atrim=duration=${durationSeconds.toFixed(3)}[audio]`;
    const filterComplex = [videoFilter, audioFilter, audioOutput].filter(Boolean).join(";");
    const args = [
      "-y",
      "-i", inputPath,
      ...(music ? ["-stream_loop", "-1", "-i", musicPath] : []),
      "-filter_complex", filterComplex,
      "-map", "[montage]",
      "-map", "[audio]",
      "-t", String(durationSeconds),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      outputPath,
    ];
    await execFileAsync("ffmpeg", args, { maxBuffer: 20 * 1024 * 1024 });
    const output = await readFile(outputPath);
    if (!output.length) throw new Error("FFmpeg вернул пустой edit-файл.");
    return storeAudioAsset(output, "video", "video/mp4", "mp4");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}