import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { generatedImagesTable, voiceGenerationsTable } from "@workspace/db";
import { assetUrl, readAudioAsset, storeAudioAsset } from "../audio-design/storage";
import { objectStorageClient } from "../objectStorage";

const execFileAsync = promisify(execFile);

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  const [bucketName, ...parts] = path.replace(/^\/+/, "").split("/");
  return { bucketName, objectName: parts.join("/") };
}

async function readObject(storagePath: string): Promise<Buffer> {
  const privateDir = process.env["PRIVATE_OBJECT_DIR"];
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const absolute = `${privateDir.replace(/\/$/, "")}/${storagePath.replace(/^\/objects\//, "")}`;
  const { bucketName, objectName } = parseObjectPath(absolute);
  const [buffer] = await objectStorageClient.bucket(bucketName).file(objectName).download();
  return buffer;
}

export async function renderVideo(params: {
  images: Array<typeof generatedImagesTable.$inferSelect>;
  voices: Array<typeof voiceGenerationsTable.$inferSelect>;
  audioStoragePath: string;
  durationMs: number;
}): Promise<{ buffer: Buffer; durationMs: number }> {
  if (!params.images.length) throw new Error("At least one completed scene image is required");
  if (!params.voices.length) throw new Error("At least one completed voice scene is required");
  const dir = await mkdtemp(join(tmpdir(), "video-render-"));
  try {
    const imageFiles: string[] = [];
    const clipFiles: string[] = [];
    const transitionDurationMs = params.images.length > 1 ? 140 : 0;
    const clipDurationsMs: number[] = [];
    for (const [index, image] of params.images.entries()) {
      if (!image.storagePath) throw new Error(`Scene ${image.sceneId} image has no storage object`);
      const imagePath = join(dir, `image-${index}.png`);
      await writeFile(imagePath, await readObject(image.storagePath));
      imageFiles.push(imagePath);
      const clip = join(dir, `clip-${index}.mp4`);
      const sceneVoice = params.voices.find((voice) => voice.sceneId === image.sceneId);
      const sceneDuration = Math.max(250, (sceneVoice?.endTime || params.durationMs) - (sceneVoice?.startTime || 0));
      const clipDuration = sceneDuration + (index < params.images.length - 1 ? transitionDurationMs : 0);
      const frames = Math.max(8, Math.round(clipDuration / 1000 * 30));
      const zoom = index % 2 === 0
        ? "min(zoom+0.0012,1.12)"
        : "max(zoom-0.0008,1.0)";
      const motion = index % 3 === 2
        ? `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)+sin(on/18)*8':y='ih/2-(ih/zoom/2)+cos(on/21)*8':d=${frames}:s=1080x1920:fps=30`
        : `zoompan=z='${zoom}':d=${frames}:s=1080x1920:fps=30`;
      await execFileAsync("ffmpeg", [
        "-y", "-loop", "1", "-i", imagePath, "-t", String(clipDuration / 1000),
        "-vf", `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,${motion},format=yuv420p,fade=t=in:st=0:d=0.2`,
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", clip,
      ], { maxBuffer: 10 * 1024 * 1024 });
      clipFiles.push(clip);
      clipDurationsMs.push(clipDuration);
    }

    const videoOnly = join(dir, "video-only.mp4");
    const transitionNames = ["slideleft", "slideright", "wipeleft", "wiperight", "circleopen", "fade"];
    const transitionArgs = clipFiles.flatMap((file) => ["-i", file]);
    const transitionFilters = clipFiles.map((_file, index) => `[${index}:v]settb=AVTB,fps=30,format=yuv420p[clip${index}]`);
    let currentLabel = "clip0";
    let outputDuration = clipDurationsMs[0]! / 1000;
    for (let index = 1; index < clipFiles.length; index += 1) {
      const nextLabel = `transition${index}`;
      const transition = transitionNames[(index - 1) % transitionNames.length]!;
      const offset = Math.max(0, outputDuration - transitionDurationMs / 1000);
      transitionFilters.push(`[${currentLabel}][clip${index}]xfade=transition=${transition}:duration=${transitionDurationMs / 1000}:offset=${offset.toFixed(3)}[${nextLabel}]`);
      outputDuration += clipDurationsMs[index]! / 1000 - transitionDurationMs / 1000;
      currentLabel = nextLabel;
    }
    await execFileAsync("ffmpeg", [
      "-y", ...transitionArgs,
      "-filter_complex", transitionFilters.join(";"),
      "-map", `[${currentLabel}]`, "-an", "-c:v", "libx264", "-preset", "veryfast",
      "-pix_fmt", "yuv420p", "-r", "30", videoOnly,
    ], { maxBuffer: 10 * 1024 * 1024 });
    const audioFile = join(dir, "audio.mp3");
    await writeFile(audioFile, await readAudioAsset(params.audioStoragePath));
    const output = join(dir, "final_video.mp4");
    await execFileAsync("ffmpeg", [
      "-y", "-i", videoOnly, "-i", audioFile,
      "-map", "0:v:0", "-map", "1:a:0", "-t", String(params.durationMs / 1000),
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30",
      "-af", "acompressor=threshold=0.08:ratio=2.5:attack=20:release=250:makeup=1.2,alimiter=limit=0.95",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", output,
    ], { maxBuffer: 10 * 1024 * 1024 });
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate,codec_type",
      "-of", "json", output,
    ]);
    const probe = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string }> };
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
    if (video?.codec_name !== "h264" || video.width !== 1080 || video.height !== 1920 || video.r_frame_rate !== "30/1") {
      throw new Error("Rendered video failed 1080x1920 30 FPS H.264 validation");
    }
    if (audio?.codec_name !== "aac") throw new Error("Rendered video failed AAC audio validation");
    const buffer = await readFile(output);
    return { buffer, durationMs: Math.round(Number(probe.format?.duration || 0) * 1000) };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function storeRenderedVideo(buffer: Buffer): Promise<{ storagePath: string; videoUrl: string }> {
  const storagePath = await storeAudioAsset(buffer, "video", "video/mp4", "mp4");
  return { storagePath, videoUrl: assetUrl(storagePath) };
}