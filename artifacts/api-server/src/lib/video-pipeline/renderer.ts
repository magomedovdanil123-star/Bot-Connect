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
    for (const [index, image] of params.images.entries()) {
      if (!image.storagePath) throw new Error(`Scene ${image.sceneId} image has no storage object`);
      const imagePath = join(dir, `image-${index}.png`);
      await writeFile(imagePath, await readObject(image.storagePath));
      imageFiles.push(imagePath);
      const clip = join(dir, `clip-${index}.mp4`);
      const sceneVoice = params.voices.find((voice) => voice.sceneId === image.sceneId);
      const sceneDuration = Math.max(250, (sceneVoice?.endTime || params.durationMs) - (sceneVoice?.startTime || 0));
      const frames = Math.max(8, Math.round(sceneDuration / 1000 * 30));
      await execFileAsync("ffmpeg", [
        "-y", "-loop", "1", "-i", imagePath, "-t", String(sceneDuration / 1000),
        "-vf", `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0007,1.08)':d=${frames}:s=1080x1920:fps=30,format=yuv420p,fade=t=in:st=0:d=0.25,fade=t=out:st=${Math.max(0, sceneDuration / 1000 - 0.25)}:d=0.25`,
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", clip,
      ], { maxBuffer: 10 * 1024 * 1024 });
      clipFiles.push(clip);
    }

    const concat = join(dir, "clips.txt");
    await writeFile(concat, clipFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
    const videoOnly = join(dir, "video-only.mp4");
    await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", videoOnly], { maxBuffer: 10 * 1024 * 1024 });
    const audioFile = join(dir, "audio.mp3");
    await writeFile(audioFile, await readAudioAsset(params.audioStoragePath));
    const output = join(dir, "final_video.mp4");
    await execFileAsync("ffmpeg", [
      "-y", "-i", videoOnly, "-i", audioFile,
      "-map", "0:v:0", "-map", "1:a:0", "-t", String(params.durationMs / 1000),
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30",
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