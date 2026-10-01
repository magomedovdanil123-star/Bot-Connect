import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd(), "../..");
const filmDir = join(root, "attached_assets/generated_video/pump-film-2026-09-30");
const sourcePath = join(filmDir, "pump-film-research-2026-09-30.mp4");
const timelinePath = join(filmDir, "phrase-timeline.json");
const outputPath = join(filmDir, "pump-film-research-2026-09-30-updated-visuals.mp4");
const videoOnlyPath = join(filmDir, "pump-film-updated-visuals-only.mp4");
const clipDir = join(filmDir, "clips-updated-visuals");
const fps = 30;

type TimelineScene = {
  scene_number: number;
  start_seconds: number;
  end_seconds: number;
  frames: number;
  visual: string;
};

function accentForVisual(visual: string): string {
  if (/legal|risk|scenario|methodology|rights/i.test(visual)) return "0xff7185";
  if (/allocation|max-supply|buyback|closing/i.test(visual)) return "0xffbf69";
  if (/launch|graduation|flow|competition/i.test(visual)) return "0x51c8d4";
  return "0x80e0b0";
}

function buildSceneFilter(scene: TimelineScene, sceneIndex: number): string {
  const { frames, start_seconds: start, end_seconds: end, visual } = scene;
  const duration = (frames / fps).toFixed(6);
  const progress = `min(on/${Math.max(1, frames - 1)},1)`;
  const zoom = sceneIndex % 2 === 0
    ? `1.012+0.022*${progress}`
    : `1.034-0.022*${progress}`;
  const directionX = sceneIndex % 4 < 2 ? 1 : -1;
  const directionY = sceneIndex % 2 === 0 ? -1 : 1;
  const panPhase = Math.max(90, Math.round(frames * 0.72));
  const accent = accentForVisual(visual);
  const camera =
    `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)+(${directionX})*sin(on/${panPhase})*iw*0.0025'` +
    `:y='ih/2-(ih/zoom/2)+(${directionY})*sin(on/${panPhase})*ih*0.0018'` +
    `:d=1:s=1920x1080:fps=${fps}`;
  const progressBar =
    `drawbox=x=70:y=151:w=1780:h=2:color=0xece6d8@0.19:t=fill` +
    `,drawbox=x=70:y=150:w='1780*min(t/${duration}\\,1)':h=4:color=${accent}@0.74:t=fill` +
    `,drawbox=x='70+1780*min(t/${duration}\\,1)':y=146:w=3:h=12:color=${accent}@0.96:t=fill`;

  if (end <= start || frames < 60) {
    throw new Error(`Invalid motion interval for scene ${scene.scene_number}`);
  }
  return `${camera},${progressBar},format=yuv420p`;
}

async function run(command: string, args: string[]) {
  try {
    return await execFileAsync(command, args, { maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const detail = error as Error & { stderr?: string };
    const stderr = detail.stderr?.trim();
    throw new Error(`${command} failed: ${detail.message}${stderr ? `\n${stderr.slice(-6000)}` : ""}`);
  }
}

async function main(): Promise<void> {
  const timeline = JSON.parse(await readFile(timelinePath, "utf8")) as {
    duration_seconds: number;
    resolution: string;
    fps: number;
    scenes: TimelineScene[];
  };
  if (timeline.resolution !== "1920x1080" || timeline.fps !== fps || timeline.scenes.length !== 20) {
    throw new Error("Expected the original 20-scene PUMP film timeline at 1920x1080 and 30 FPS");
  }
  const previewArg = process.argv.find((argument) => argument.startsWith("--preview-scene="));
  const previewSceneNumber = previewArg ? Number(previewArg.split("=")[1]) : undefined;
  if (previewArg && (!Number.isInteger(previewSceneNumber) || previewSceneNumber! < 1)) {
    throw new Error("Expected --preview-scene=<positive scene number>");
  }
  const scenes = previewSceneNumber === undefined
    ? timeline.scenes
    : timeline.scenes.filter((scene) => scene.scene_number === previewSceneNumber);
  if (!scenes.length) throw new Error(`Scene ${previewSceneNumber} is not present in the PUMP timeline`);
  await mkdir(clipDir, { recursive: true });

  const clipPaths: string[] = [];
  for (const scene of scenes) {
    const index = timeline.scenes.findIndex((candidate) => candidate.scene_number === scene.scene_number);
    const clipPath = join(clipDir, `scene-${String(scene.scene_number).padStart(2, "0")}.mp4`);
    const startFrame = Math.round(scene.start_seconds * fps);
    const duration = scene.frames / fps;
    await run("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-ss", (startFrame / fps).toFixed(6),
      "-i", sourcePath,
      "-an",
      "-t", duration.toFixed(6),
      "-vf", buildSceneFilter(scene, index),
      "-frames:v", String(scene.frames),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-tune", "animation",
      "-crf", "22",
      "-maxrate", "260k",
      "-bufsize", "520k",
      "-profile:v", "high",
      "-level:v", "4.1",
      "-pix_fmt", "yuv420p",
      "-r", String(fps),
      "-movflags", "+faststart",
      clipPath,
    ]);
    clipPaths.push(clipPath);
    console.log(`Updated visual chapter ${index + 1}/${timeline.scenes.length}`);
  }

  if (previewSceneNumber !== undefined) {
    const previewPath = join(filmDir, `pump-film-motion-preview-scene-${String(previewSceneNumber).padStart(2, "0")}.mp4`);
    await copyFile(clipPaths[0]!, previewPath);
    console.log(JSON.stringify({ preview: previewPath, scene: previewSceneNumber, audio: "omitted for visual review" }, null, 2));
    return;
  }

  const concatPath = join(clipDir, "clips.txt");
  await writeFile(
    concatPath,
    clipPaths.map((path) => `file '${path.replaceAll("'", "'\\''")}'`).join("\n") + "\n",
    "utf8",
  );
  await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-f", "concat",
    "-safe", "0",
    "-i", concatPath,
    "-an",
    "-c:v", "copy",
    "-movflags", "+faststart",
    videoOnlyPath,
  ]);

  // Keep the existing mixed audio bit-for-bit: same ElevenLabs voice and music.
  await run("ffmpeg", [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-i", videoOnlyPath,
    "-i", sourcePath,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "copy",
    "-c:a", "copy",
    "-t", timeline.duration_seconds.toFixed(3),
    "-movflags", "+faststart",
    "-metadata", "title=PUMP — исследовательский фильм (обновлённый визуал)",
    outputPath,
  ]);

  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels",
    "-of", "json",
    outputPath,
  ]);
  const media = JSON.parse(stdout) as {
    format?: { duration?: string; size?: string };
    streams?: Array<Record<string, string | number>>;
  };
  const duration = Number(media.format?.duration || 0);
  if (Math.abs(duration - timeline.duration_seconds) > 1) {
    throw new Error(`Rendered duration mismatch: expected ${timeline.duration_seconds}s, got ${duration}s`);
  }
  if (!media.streams?.some((stream) =>
    stream.codec_type === "video"
    && stream.codec_name === "h264"
    && stream.width === 1920
    && stream.height === 1080
    && stream.avg_frame_rate === "30/1")) {
    throw new Error("Updated PUMP film does not have the expected H.264 1920x1080 30 FPS video");
  }
  if (!media.streams?.some((stream) =>
    stream.codec_type === "audio"
    && stream.codec_name === "aac"
    && stream.sample_rate === "48000"
    && stream.channels === 2)) {
    throw new Error("Updated PUMP film is missing its original AAC stereo mix");
  }
  const sizeBytes = Number(media.format?.size || 0);
  if (sizeBytes > 49_000_000) {
    throw new Error(`Updated MP4 is ${sizeBytes} bytes; reduce its video bitrate before Telegram delivery`);
  }

  const updatedTimeline = {
    generated_at: new Date().toISOString(),
    source_video: sourcePath,
    source_phrase_timeline: timelinePath,
    output_video: outputPath,
    duration_seconds: Number(duration.toFixed(3)),
    fps,
    resolution: timeline.resolution,
    audio: "copied unchanged from the original MP4",
    motion_profile: "gentle alternating camera push/pan with scene-colored chapter progress",
    scenes: timeline.scenes.map((scene) => ({
      scene_number: scene.scene_number,
      visual: scene.visual,
      accent_color: accentForVisual(scene.visual),
      start_seconds: scene.start_seconds,
      end_seconds: scene.end_seconds,
    })),
  };
  await writeFile(
    join(filmDir, "phrase-timeline-updated-visuals.json"),
    JSON.stringify(updatedTimeline, null, 2),
    "utf8",
  );
  await Promise.all([
    rm(clipDir, { recursive: true, force: true }),
    rm(videoOnlyPath, { force: true }),
  ]);
  console.log(JSON.stringify({
    output: outputPath,
    durationSeconds: Number(duration.toFixed(3)),
    sizeMB: Number((sizeBytes / 1024 / 1024).toFixed(1)),
    streams: media.streams,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown PUMP visual update error");
  process.exit(1);
});