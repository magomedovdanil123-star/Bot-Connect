import { execFile } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { generateInstrumentalMusic } from "./audio-design/generated-music";
import { readAudioAsset, storeAudioAsset } from "./audio-design/storage";

const execFileAsync = promisify(execFile);
const TRANSITION_SECONDS = 0.28;

type ProbeResult = {
  streams?: Array<{ codec_type?: string; duration?: string; width?: number; height?: number }>;
  format?: { duration?: string };
};

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

async function probeVideo(input: string): Promise<{ durationSeconds: number; hasAudio: boolean }> {
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
  return {
    durationSeconds: duration,
    hasAudio: Boolean(probe.streams?.some((stream) => stream.codec_type === "audio")),
  };
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
): string {
  const zoom = style.zoom + index * 0.012;
  const targetWidth = Math.round(1080 * zoom);
  const targetHeight = Math.round(1920 * zoom);
  const cropX = Math.min(1, Math.max(0, style.cropX + (index % 2 ? 0.1 : -0.05)));
  const cropY = Math.min(1, Math.max(0, style.cropY + (index % 3 ? -0.06 : 0.08)));
  return [
    `trim=start=${start.toFixed(3)}:end=${end.toFixed(3)}`,
    "setpts=PTS-STARTPTS",
    `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`,
    `crop=1080:1920:(iw-1080)*${cropX.toFixed(3)}:(ih-1920)*${cropY.toFixed(3)}`,
    `eq=contrast=${(style.contrast + index * 0.01).toFixed(3)}:saturation=${style.saturation.toFixed(3)}:brightness=${style.brightness.toFixed(3)}`,
    `hue=h=${style.hue + index}`,
    "unsharp=5:5:0.42:5:5:0",
    "fps=30",
    `format=yuv420p[v${index}]`,
  ].join(",");
}

function buildVideoMontageFilter(durationParts: number[], style: AdaptationStyle): string {
  const filters: string[] = [];
  let start = 0;
  for (let index = 0; index < durationParts.length; index += 1) {
    const end = start + durationParts[index];
    filters.push(`[0:v]${segmentFilter(start, end, index, style)}`);
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
  filters.push(`[${current}]drawbox=x=0:y=0:w=iw:h=8:color=${style.brandColor}@0.95:t=fill,drawbox=x=32:y=32:w=300:h=62:color=black@0.44:t=fill,drawtext=text='${style.brandText}':fontcolor=white:fontsize=32:x=52:y=48,drawtext=text='ADAPTED':fontcolor=white@0.78:fontsize=18:x=52:y=82${paddingSeconds > 0 ? `,tpad=stop_mode=clone:stop_duration=${paddingSeconds.toFixed(3)}` : ""}[montage]`);
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
    const { durationSeconds, hasAudio } = await probeVideo(inputPath);
    const style = STYLES[randomInt(0, STYLES.length)];
    const durations = segmentDurations(durationSeconds);
    const mood = ["cinematic", "energetic", "motivational", "documentary"][randomInt(0, 4)];
    const music = await generateInstrumentalMusic({
      projectId: randomInt(1, 2_000_000_000),
      durationMs: durationSeconds * 1000,
      mood,
      category: "Kliply adaptation background",
    });
    await writeFile(musicPath, music.buffer);

    const videoFilter = buildVideoMontageFilter(durations, style);
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