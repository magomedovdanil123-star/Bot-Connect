import { execFile } from "node:child_process";
import { copyFile, mkdtemp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  buildCoinOverviewLongPhraseBeats,
  buildCoinOverviewLongPhraseRenderChunks,
  buildCoinOverviewLongMotionGraphics,
} from "../src/lib/video-pipeline/coin-overview-long-edit";
import { buildCoinOverviewLongPhraseCaptions } from "../src/lib/video-pipeline/coin-overview-long-captions";

const execFileAsync = promisify(execFile);

function field(row: Record<string, unknown>, camelCase: string, snakeCase: string): unknown {
  return row[camelCase] ?? row[snakeCase];
}

async function main() {
  const projectId = Number(process.argv[2] ?? 85);
  const durationMs = Number(process.argv[3] ?? 30_000);
  const apiBase = process.argv[5] ?? "http://127.0.0.1:8080";
  const outputPath = resolve(
    process.argv[4] ?? `../../attached_assets/generated_video/coin-overview-long/project-${projectId}-preview-${Math.round(durationMs / 1000)}s.mp4`,
  );
  if (!Number.isInteger(projectId) || projectId < 1) {
    throw new Error("Pass a positive project ID.");
  }
  if (!Number.isInteger(durationMs) || durationMs < 1_000 || durationMs > 1_200_000) {
    throw new Error("Render duration must be between 1 second and 20 minutes.");
  }

  const [voiceResponse, soundResponse] = await Promise.all([
    fetch(new URL(`/api/projects/${projectId}/voice`, apiBase)),
    fetch(new URL(`/api/projects/${projectId}/sound-design`, apiBase)),
  ]);
  if (!voiceResponse.ok || !soundResponse.ok) {
    throw new Error(`Could not load the project source assets (voice ${voiceResponse.status}, sound ${soundResponse.status}).`);
  }
  const voiceRows = await voiceResponse.json() as Array<Record<string, unknown>>;
  const soundDesign = await soundResponse.json() as {
    mixes?: Array<Record<string, unknown>>;
  };
  const voices = voiceRows
    .filter((row) =>
      row.status === "completed"
      && field(row, "isActive", "is_active") === true
      && field(row, "isFullVoice", "is_full_voice") !== true
      && typeof row.text === "string",
    )
    .map((row) => ({
      sceneId: Number(field(row, "sceneId", "scene_id")),
      startTime: Number(field(row, "startTime", "start_time")),
      endTime: Number(field(row, "endTime", "end_time")),
      text: String(row.text),
      isFullVoice: false,
    }))
    .sort((a, b) => a.sceneId - b.sceneId);
  if (!voices.length) throw new Error(`Project ${projectId} has no active completed scene voices.`);

  const mix = soundDesign.mixes?.find((row) =>
    row.status === "completed"
    && typeof field(row, "audioUrl", "audio_url") === "string"
    && Number(row.duration) >= durationMs,
  );
  const mixAudioUrl = mix ? field(mix, "audioUrl", "audio_url") : undefined;
  if (typeof mixAudioUrl !== "string") {
    throw new Error(`Project ${projectId} has no completed audio mix long enough for this preview.`);
  }
  const audioResponse = await fetch(new URL(mixAudioUrl, apiBase));
  if (!audioResponse.ok) throw new Error(`Could not download the existing mixed audio (${audioResponse.status}).`);

  const tempDir = await mkdtemp(join(tmpdir(), "coin-overview-render-"));
  const audioPath = join(tempDir, "source-mix");
  let videoOnlyPath = join(tempDir, "video-only.mp4");
  const outputTempPath = join(tempDir, "rendered-video.mp4");
  const renderVoices = voices.map((voice) => ({
    ...voice,
    startTime: Math.max(0, Math.min(durationMs, voice.startTime)),
    endTime: Math.min(durationMs, voice.endTime),
  })).filter((voice) => voice.endTime > voice.startTime);
  const beats = buildCoinOverviewLongPhraseBeats({ voices: renderVoices, durationMs });

  try {
    await writeFile(audioPath, Buffer.from(await audioResponse.arrayBuffer()));
    const chunks = buildCoinOverviewLongPhraseRenderChunks({
      beats,
      durationMs,
      targetDurationMs: 120_000,
    });
    const renderedParts: string[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const captionsPath = join(tempDir, `captions-${index}.ass`);
      const filterGraphPath = join(tempDir, `filter-graph-${index}.txt`);
      const videoPartPath = join(tempDir, `video-part-${index}.mp4`);
      const chunkDurationSeconds = ((chunk.endMs - chunk.startMs) / 1000).toFixed(3);
      const graphics = buildCoinOverviewLongMotionGraphics({
        width: 1920,
        height: 1080,
        beats,
        chunkStartMs: chunk.startMs,
        chunkEndMs: chunk.endMs,
      });
      const captions = buildCoinOverviewLongPhraseCaptions({
        voices: renderVoices,
        durationMs,
        width: 1920,
        height: 1080,
        chunkStartMs: chunk.startMs,
        chunkEndMs: chunk.endMs,
      });
      const filters = [graphics, `subtitles=${captionsPath}`].filter(Boolean).join(",");

      await writeFile(captionsPath, captions, "utf8");
      await writeFile(filterGraphPath, `[0:v]${filters}[chunk_video]`, "utf8");
      await execFileAsync("ffmpeg", [
        "-y",
        "-f", "lavfi",
        "-i", `color=c=0x111218:s=1920x1080:r=30:d=${chunkDurationSeconds}`,
        "-filter_complex_script", filterGraphPath,
        "-map", "[chunk_video]",
        "-t", chunkDurationSeconds,
        "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-r", "30", "-movflags", "+faststart", videoPartPath,
      ], { maxBuffer: 20 * 1024 * 1024 });
      renderedParts.push(videoPartPath);
      console.log(JSON.stringify({
        part: index + 1,
        parts: chunks.length,
        startMs: chunk.startMs,
        endMs: chunk.endMs,
        status: "rendered",
      }));
    }

    if (renderedParts.length === 1) {
      videoOnlyPath = renderedParts[0]!;
    } else {
      const chunkListPath = join(tempDir, "video-parts.txt");
      await writeFile(
        chunkListPath,
        renderedParts.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"),
        "utf8",
      );
      await execFileAsync("ffmpeg", [
        "-y", "-f", "concat", "-safe", "0", "-i", chunkListPath,
        "-an", "-c", "copy", "-movflags", "+faststart", videoOnlyPath,
      ], { maxBuffer: 20 * 1024 * 1024 });
    }

    await execFileAsync("ffmpeg", [
      "-y", "-i", videoOnlyPath, "-i", audioPath,
      "-map", "0:v:0", "-map", "1:a:0",
      "-t", (durationMs / 1000).toFixed(3),
      "-c:v", "copy",
      "-af", "acompressor=threshold=0.08:ratio=2.5:attack=20:release=250:makeup=1.2,alimiter=limit=0.95",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", outputTempPath,
    ], { maxBuffer: 20 * 1024 * 1024 });
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate,codec_type",
      "-of", "json", outputTempPath,
    ]);
    const probe = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{
        codec_type?: string;
        codec_name?: string;
        width?: number;
        height?: number;
        r_frame_rate?: string;
      }>;
    };
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
    const renderedDurationMs = Math.round(Number(probe.format?.duration || 0) * 1000);
    if (
      video?.codec_name !== "h264"
      || video.width !== 1920
      || video.height !== 1080
      || video.r_frame_rate !== "30/1"
    ) {
      throw new Error("Rendered video failed 1920x1080 30 FPS H.264 validation.");
    }
    if (audio?.codec_name !== "aac") {
      throw new Error("Rendered video failed AAC audio validation.");
    }
    if (renderedDurationMs < durationMs - 1_000) {
      throw new Error(`Rendered video is too short (${renderedDurationMs} ms vs ${durationMs} ms).`);
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(outputTempPath, outputPath);
    console.log(JSON.stringify({
      projectId,
      durationMs: renderedDurationMs,
      chunkCount: chunks.length,
      bytes: (await stat(outputPath)).size,
      outputPath,
    }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});