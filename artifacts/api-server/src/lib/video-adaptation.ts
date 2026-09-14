import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { readAudioAsset, storeAudioAsset } from "./audio-design/storage";

const execFileAsync = promisify(execFile);

type ProbeResult = {
  streams?: Array<{ codec_type?: string; duration?: string; width?: number; height?: number }>;
  format?: { duration?: string };
};

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
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Не удалось определить длительность видео.");
  return {
    durationSeconds: duration,
    hasAudio: Boolean(probe.streams?.some((stream) => stream.codec_type === "audio")),
  };
}

export async function adaptVideoAsset(sourceStoragePath: string): Promise<string> {
  const source = await readAudioAsset(sourceStoragePath);
  if (!source.length) throw new Error("Исходный видеофайл пустой.");
  const dir = await mkdtemp(join(tmpdir(), "kliply-adaptation-"));
  const inputPath = join(dir, "source.mp4");
  const outputPath = join(dir, "kliply-adapted.mp4");
  try {
    await writeFile(inputPath, source);
    const { durationSeconds, hasAudio } = await probeVideo(inputPath);
    const musicDuration = Math.ceil(Math.min(20 * 60, durationSeconds));
    const videoFilter = [
      "scale=1080:1920:force_original_aspect_ratio=increase",
      "crop=1080:1920",
      "eq=contrast=1.06:saturation=1.12:brightness=0.015",
      "unsharp=5:5:0.35:5:5:0",
      "drawbox=x=32:y=32:w=250:h=58:color=black@0.42:t=fill",
      "drawtext=text='KLIPLY':fontcolor=white:fontsize=30:x=52:y=47",
    ].join(",");
    const args = [
      "-y",
      "-i", inputPath,
      "-f", "lavfi",
      "-t", String(musicDuration),
      "-i", `sine=frequency=196:duration=${musicDuration}`,
      "-filter_complex",
      hasAudio
        ? "[1:a]lowpass=f=1400,volume=0.10,afade=t=in:st=0:d=1,afade=t=out:st=" +
          `${Math.max(0, musicDuration - 2)}:d=2[music];[0:a]volume=0.92[original];` +
          "[original][music]amix=inputs=2:duration=first:dropout_transition=2[audio]"
        : "[1:a]lowpass=f=1400,volume=0.10,afade=t=in:st=0:d=1,afade=t=out:st=" +
          `${Math.max(0, musicDuration - 2)}:d=2[audio]`,
      "-map", "0:v:0",
      "-map", "[audio]",
      "-vf", videoFilter,
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
    return storeAudioAsset(output, "video-adapted", "video/mp4", "mp4");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}