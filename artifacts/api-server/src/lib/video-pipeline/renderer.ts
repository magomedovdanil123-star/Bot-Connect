import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify } from "node:util";
import { generatedImagesTable, voiceGenerationsTable } from "@workspace/db";
import { assetUrl, readAudioAsset, storeAudioAsset } from "../audio-design/storage";
import { objectStorageClient } from "../objectStorage";

const execFileAsync = promisify(execFile);
const RECRUITMENT_BANNER_PATH = resolve(process.cwd(), "assets/courier-recruitment-banner.png");
const RECRUITMENT_BANNER_DURATION_SECONDS = 3;

function assTime(milliseconds: number): string {
  const centiseconds = Math.max(0, Math.floor(milliseconds / 10));
  const seconds = Math.floor(centiseconds / 100);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}

function assText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("{", "\\{")
    .replaceAll("}", "\\}")
    .replaceAll("\n", " ");
}

function buildWordCaptions(
  voices: Array<typeof voiceGenerationsTable.$inferSelect>,
  durationMs: number,
  width: number,
  height: number,
): string {
  const dialogues: string[] = [];
  for (const voice of voices.filter((row) => !row.isFullVoice && row.text.trim()).sort((a, b) => (a.startTime || 0) - (b.startTime || 0))) {
    const words = voice.text.trim().split(/\s+/).filter(Boolean);
    const start = Math.max(0, voice.startTime || 0);
    const end = Math.min(durationMs, voice.endTime || durationMs);
    const available = Math.max(words.length * 120, end - start);
    const weights = words.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, "").length));
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = start;
    for (const [index, word] of words.entries()) {
      const wordDuration = Math.max(90, Math.round(available * (weights[index]! / weightTotal)));
      const wordEnd = Math.min(end, cursor + wordDuration);
      if (wordEnd > cursor) {
        dialogues.push(`Dialogue: 0,${assTime(cursor)},${assTime(wordEnd)},Word,,0,0,0,,${assText(word)}`);
      }
      cursor = wordEnd;
    }
  }

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${width}`,
    `PlayResY: ${height}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, TertiaryColour, BackColour, Bold, Italic, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Word,Arial,70,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,-1,0,1,5,1,2,80,80,220,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogues,
    "",
  ].join("\n");
}

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
  format: string;
}): Promise<{ buffer: Buffer; durationMs: number }> {
  if (!params.images.length) throw new Error("At least one completed scene image is required");
  if (!params.voices.length) throw new Error("At least one completed voice scene is required");
  const dir = await mkdtemp(join(tmpdir(), "video-render-"));
  const landscape = params.format === "16:9";
  const width = landscape ? 1920 : 1080;
  const height = landscape ? 1080 : 1920;
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
        ? `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)+sin(on/18)*8':y='ih/2-(ih/zoom/2)+cos(on/21)*8':d=${frames}:s=${width}x${height}:fps=30`
        : `zoompan=z='${zoom}':d=${frames}:s=${width}x${height}:fps=30`;
      await execFileAsync("ffmpeg", [
        "-y", "-loop", "1", "-i", imagePath, "-t", String(clipDuration / 1000),
         "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},${motion},format=yuv420p,fade=t=in:st=0:d=0.2`,
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
    const captionsFile = join(dir, "captions.ass");
     await writeFile(captionsFile, buildWordCaptions(params.voices, params.durationMs, width, height), "utf8");
     const mainOutput = join(dir, "main_video.mp4");
    await execFileAsync("ffmpeg", [
      "-y", "-i", videoOnly, "-i", audioFile,
      "-map", "0:v:0", "-map", "1:a:0", "-t", String(params.durationMs / 1000),
      "-vf", `subtitles=${captionsFile}`,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30",
      "-af", "acompressor=threshold=0.08:ratio=2.5:attack=20:release=250:makeup=1.2,alimiter=limit=0.95",
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", mainOutput,
     ], { maxBuffer: 10 * 1024 * 1024 });
     const endCard = join(dir, "recruitment-end-card.mp4");
     await execFileAsync("ffmpeg", [
       "-y",
       "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
       "-loop", "1", "-i", RECRUITMENT_BANNER_PATH,
       "-t", String(RECRUITMENT_BANNER_DURATION_SECONDS),
       "-map", "1:v:0", "-map", "0:a:0",
       "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p`,
       "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", "30",
       "-c:a", "aac", "-b:a", "192k", "-shortest", endCard,
     ], { maxBuffer: 10 * 1024 * 1024 });
     const concatFile = join(dir, "concat.txt");
     await writeFile(concatFile, [
       `file '${mainOutput.replaceAll("'", "'\\''")}'`,
       `file '${endCard.replaceAll("'", "'\\''")}'`,
     ].join("\n"));
     const output = join(dir, "final_video.mp4");
     await execFileAsync("ffmpeg", [
       "-y", "-f", "concat", "-safe", "0", "-i", concatFile,
       "-c", "copy", "-movflags", "+faststart", output,
    ], { maxBuffer: 10 * 1024 * 1024 });
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate,codec_type",
      "-of", "json", output,
    ]);
    const probe = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string }> };
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
    if (video?.codec_name !== "h264" || video.width !== width || video.height !== height || video.r_frame_rate !== "30/1") {
      throw new Error(`Rendered video failed ${width}x${height} 30 FPS H.264 validation`);
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