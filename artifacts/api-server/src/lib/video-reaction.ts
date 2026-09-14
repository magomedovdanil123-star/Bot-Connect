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

async function probeVideo(input: string): Promise<{ durationSeconds: number; width: number; height: number }> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,duration,width,height:format=duration",
    "-of", "json",
    input,
  ]);
  const probe = JSON.parse(stdout) as ProbeResult;
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const duration = Number.parseFloat(
    probe.format?.duration || video?.duration || "0",
  );
  const width = Number(video?.width || 0);
  const height = Number(video?.height || 0);
  if (!Number.isFinite(duration) || duration <= 0 || !width || !height) {
    throw new Error("Не удалось определить параметры видео для реакции.");
  }
  return { durationSeconds: duration, width, height };
}

export async function addReactionOverlay(
  mainStoragePath: string,
  reactionStoragePath: string,
): Promise<string> {
  const [main, reaction] = await Promise.all([
    readAudioAsset(mainStoragePath),
    readAudioAsset(reactionStoragePath),
  ]);
  if (!main.length || !reaction.length) throw new Error("Один из reaction-файлов пустой.");

  const dir = await mkdtemp(join(tmpdir(), "kliply-reaction-"));
  const mainPath = join(dir, "main.mp4");
  const reactionPath = join(dir, "reaction.mp4");
  const outputPath = join(dir, "reaction-result.mp4");
  try {
    await Promise.all([writeFile(mainPath, main), writeFile(reactionPath, reaction)]);
    const { durationSeconds, width, height } = await probeVideo(mainPath);
    const reactionWidth = Math.max(240, Math.min(Math.round(width * 0.38), 720));
    const bottomMargin = Math.max(24, Math.round(height * 0.025));
    const filter = [
      `[1:v]scale=${reactionWidth}:-2:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=0.98[reaction]`,
      "[0:v]format=yuv420p[main]",
      "[main]drawbox=x=0:y=ih-1:w=iw:h=1:color=white@0.24:t=fill[framed]",
      `[framed][reaction]overlay=(W-w)/2:H-h-${bottomMargin}:eof_action=repeat[video]`,
    ].join(";");
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", mainPath,
      "-stream_loop", "-1",
      "-i", reactionPath,
      "-filter_complex", filter,
      "-map", "[video]",
      "-map", "0:a?",
      "-t", String(durationSeconds),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      outputPath,
    ], { maxBuffer: 20 * 1024 * 1024 });
    const output = await readFile(outputPath);
    if (!output.length) throw new Error("FFmpeg вернул пустое видео с реакцией.");
    return storeAudioAsset(output, "video", "video/mp4", "mp4");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function addReactionImageOverlay(
  mainStoragePath: string,
  reactionImagePath: string,
): Promise<string> {
  const main = await readAudioAsset(mainStoragePath);
  const reactionImage = await readFile(reactionImagePath);
  if (!main.length || !reactionImage.length) {
    throw new Error("Основное видео или reaction-фото пустое.");
  }

  const dir = await mkdtemp(join(tmpdir(), "kliply-reaction-image-"));
  const mainPath = join(dir, "main.mp4");
  const reactionPath = join(dir, "reaction.png");
  const outputPath = join(dir, "reaction-result.mp4");
  try {
    await Promise.all([
      writeFile(mainPath, main),
      writeFile(reactionPath, reactionImage),
    ]);
    const { durationSeconds, width, height } = await probeVideo(mainPath);
    const reactionWidth = Math.max(240, Math.min(Math.round(width * 0.38), 720));
    const bottomMargin = Math.max(24, Math.round(height * 0.025));
    const filter = [
      `[1:v]scale=${reactionWidth}:-2:force_original_aspect_ratio=decrease,format=rgba,colorchannelmixer=aa=0.98[reaction]`,
      "[0:v]format=yuv420p[main]",
      "[main]drawbox=x=0:y=ih-1:w=iw:h=1:color=white@0.24:t=fill[framed]",
      `[framed][reaction]overlay=W-w-${bottomMargin}:H-h-${bottomMargin}:eof_action=repeat[video]`,
    ].join(";");
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", mainPath,
      "-loop", "1",
      "-i", reactionPath,
      "-filter_complex", filter,
      "-map", "[video]",
      "-map", "0:a?",
      "-t", String(durationSeconds),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      outputPath,
    ], { maxBuffer: 20 * 1024 * 1024 });
    const output = await readFile(outputPath);
    if (!output.length) throw new Error("FFmpeg вернул пустое видео с фото-реакцией.");
    return storeAudioAsset(output, "video", "video/mp4", "mp4");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}