import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { generateFreeRussianSpeech } from "../src/lib/audio-generation/free-tts";
import {
  buildCoinOverviewLongPhraseBeats,
} from "../src/lib/video-pipeline/coin-overview-long-edit";
import {
  buildCoinOverviewLongPhraseCaptions,
} from "../src/lib/video-pipeline/coin-overview-long-captions";
import {
  buildCoinOverviewLongMotionGraphics,
} from "../src/lib/video-pipeline/coin-overview-long-edit";

const execFileAsync = promisify(execFile);

const SCRIPT = [
  "HYPE — это просто очередной хайповый токен или здесь есть что-то большее?",
  "HYPE — нативный токен экосистемы Hyperliquid, одной из самых заметных DeFi-платформ для торговли деривативами.",
  "Главная фишка — сама платформа работает быстро, а торговая инфраструктура построена вокруг собственной сети Hyperliquid.",
  "Но самое интересное начинается с токеномики.",
  "HYPE используется в экосистеме, участвует в управлении и связан с развитием всей сети.",
  "Именно поэтому вокруг монеты появилось столько внимания.",
  "Но есть и обратная сторона.",
  "Крипторынок крайне волатилен, а сильный рост интереса к токену не гарантирует дальнейшего роста цены.",
  "Так что HYPE — это фундаментальный проект или очередной хайп?",
  "Напиши в комментариях, что думаешь о HYPE, и поставь лайк, если хочешь больше разборов крипты.",
].join(" ");

const WIDTH = 1920;
const HEIGHT = 1080;
const OUTPUT_PATH = resolve(
  process.argv[2] ?? "../../attached_assets/generated_video/coin-overview-long/hype-kinetic-script.mp4",
);
const MUSIC_PATH = resolve("../hype-market-focus/public/audio/bg_music.mp3");
const LOGO_PATH = resolve("../hype-market-focus/public/images/hype-token-logo.jpg");

async function main(): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), "hype-kinetic-script-"));
  const voicePath = join(tempDir, "narration.mp3");
  const captionsPath = join(tempDir, "captions.ass");
  const filterGraphPath = join(tempDir, "filter-graph.txt");
  const outputTempPath = join(tempDir, "rendered.mp4");

  try {
    // The saved narrator is not available through the configured API accounts, so use the
    // project's built-in Russian TTS fallback rather than emitting a silent or partial video.
    const narration = await generateFreeRussianSpeech(SCRIPT);
    await writeFile(voicePath, narration);

    const { stdout: audioProbe } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      voicePath,
    ]);
    const durationMs = Math.round(Number(audioProbe.trim()) * 1000);
    if (!Number.isFinite(durationMs) || durationMs < 10_000) {
      throw new Error("The generated narration is missing or unexpectedly short.");
    }
    const voices = [{
      sceneId: 1,
      startTime: 0,
      endTime: durationMs,
      text: SCRIPT,
    }];
    const beats = buildCoinOverviewLongPhraseBeats({ voices, durationMs });
    const graphics = buildCoinOverviewLongMotionGraphics({
      width: WIDTH,
      height: HEIGHT,
      beats,
      chunkStartMs: 0,
      chunkEndMs: durationMs,
    });
    const captions = buildCoinOverviewLongPhraseCaptions({
      voices,
      durationMs,
      width: WIDTH,
      height: HEIGHT,
      chunkStartMs: 0,
      chunkEndMs: durationMs,
    });
    await writeFile(captionsPath, captions, "utf8");

    const logoMoments = beats
      .filter((beat) => /\bhype\b/iu.test(beat.text))
      .slice(0, 5)
      .map((beat) => {
        const start = (beat.startMs / 1000).toFixed(2);
        const end = (Math.min(beat.endMs, beat.startMs + 1_000) / 1000).toFixed(2);
        return `between(t\\,${start}\\,${end})`;
      });
    const logoEnable = logoMoments.length ? logoMoments.join("+") : "between(t\\,0\\,1.2)";
    const durationSeconds = (durationMs / 1000).toFixed(3);
    const musicFadeStart = Math.max(0, durationMs / 1000 - 1.2).toFixed(3);
    const filterGraph = [
      `[0:v]${graphics},subtitles=${captionsPath}[captioned]`,
      `[3:v]scale=180:180[logo]`,
      `[captioned][logo]overlay=x=W-w-110+18*sin(t*8):y=125+15*sin(t*10):enable='${logoEnable}':eval=frame[video]`,
      `[1:a]volume=0.12,afade=t=in:d=0.6,afade=t=out:st=${musicFadeStart}:d=1.2[music]`,
      "[2:a]volume=1.0[voice]",
      "[voice][music]amix=inputs=2:duration=first:dropout_transition=0:weights='1 0.7':normalize=0,alimiter=limit=0.96[audio]",
    ].join(";\n");
    await writeFile(filterGraphPath, filterGraph, "utf8");

    await execFileAsync("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-y",
      "-f", "lavfi",
      "-i", `color=c=0x111820:s=${WIDTH}x${HEIGHT}:r=30:d=${durationSeconds}`,
      "-stream_loop", "-1", "-i", MUSIC_PATH,
      "-i", voicePath,
      "-loop", "1", "-framerate", "30", "-i", LOGO_PATH,
      "-filter_complex_script", filterGraphPath,
      "-map", "[video]",
      "-map", "[audio]",
      "-t", durationSeconds,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
      "-pix_fmt", "yuv420p", "-r", "30",
      "-c:a", "aac", "-b:a", "192k",
      "-movflags", "+faststart",
      outputTempPath,
    ], { maxBuffer: 24 * 1024 * 1024 });

    const { stdout: probeResult } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate,codec_type",
      "-of", "json",
      outputTempPath,
    ]);
    const probe = JSON.parse(probeResult) as {
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
    if (
      video?.codec_name !== "h264"
      || video.width !== WIDTH
      || video.height !== HEIGHT
      || video.r_frame_rate !== "30/1"
      || audio?.codec_name !== "aac"
      || Number(probe.format?.duration) < durationMs / 1000 - 0.2
    ) {
      throw new Error("The finished MP4 did not pass duration, video, and audio checks.");
    }

    await mkdir(dirname(OUTPUT_PATH), { recursive: true });
    await copyFile(outputTempPath, OUTPUT_PATH);
    console.log(JSON.stringify({
      outputPath: OUTPUT_PATH,
      durationMs,
      bytes: (await stat(OUTPUT_PATH)).size,
      beatCount: beats.length,
      resolution: `${WIDTH}x${HEIGHT}`,
      frameRate: "30 FPS",
    }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});