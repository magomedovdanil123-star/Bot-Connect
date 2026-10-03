import { execFile as execFileCallback } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  getSpeechProvider,
  prepareSpeechText,
} from "../../api-server/src/lib/audio-generation/elevenlabs-client.ts";

const execFile = promisify(execFileCallback);
const FPS = 30;
const ROOT = path.resolve(
  process.env.QNT_VIDEO_PROJECT_ROOT || path.resolve(import.meta.dirname, ".."),
);
const EXPORT_DIR = path.join(ROOT, "exports", "qnt-visual-variants");
const BASE_VIDEO = path.join(EXPORT_DIR, "qnt-01-impact-refined.mp4");
const RADAR_DIR = path.join(
  ROOT,
  "exports",
  "qnt-live-radar",
  "SAND-20261003-061347UTC",
);
const RADAR_VIDEO = path.join(
  RADAR_DIR,
  "qnt-live-radar-SAND-20261003-061347UTC.mp4",
);
const RADAR_SCRIPT = path.join(RADAR_DIR, "SCRIPT.md");
const SNAPSHOT_PATH = path.join(RADAR_DIR, "market-snapshot.json");
const OUTPUT_VIDEO = path.join(
  EXPORT_DIR,
  "qnt-01-impact-refined-live-radar.mp4",
);
const OUTPUT_SCRIPT = path.join(
  ROOT,
  "exports",
  "SCRIPT-QNT-IMPACT-REFINED-LIVE-RADAR.md",
);
const MUSIC = path.resolve(
  ROOT,
  "..",
  "api-server",
  "assets",
  "audio",
  "coin-overview-music-bed.mp3",
);
const CTA_TEXT =
  "Сэнд, не пропусти: посмотри эту монету на бирже прямо сейчас. Ссылка — в описании.";
const CTA_BANNER =
  "НЕ ПРОПУСТИ SAND · ПРОВЕРЬ НА БИРЖЕ · ССЫЛКА В ОПИСАНИИ";
const VOICE_SETTINGS = {
  speed: 0.98,
  stability: 0.52,
  similarity: 0.78,
  style: 0.2,
  speakerBoost: true,
};

async function probeMedia(filePath) {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_type,width,height,r_frame_rate,duration",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ]);
  return JSON.parse(stdout);
}

async function probeDuration(filePath) {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read audio duration: ${filePath}`);
  }
  return duration;
}

async function main() {
  await Promise.all([
    access(BASE_VIDEO),
    access(RADAR_VIDEO),
    access(RADAR_SCRIPT),
    access(SNAPSHOT_PATH),
    access(MUSIC),
  ]);

  const baseProbe = await probeMedia(BASE_VIDEO);
  const radarProbe = await probeMedia(RADAR_VIDEO);
  const baseVideo = baseProbe.streams.find((stream) => stream.codec_type === "video");
  const baseAudio = baseProbe.streams.find((stream) => stream.codec_type === "audio");
  const radarVideo = radarProbe.streams.find((stream) => stream.codec_type === "video");
  const radarAudio = radarProbe.streams.find((stream) => stream.codec_type === "audio");
  if (
    !baseVideo ||
    !baseAudio ||
    !radarVideo ||
    !radarAudio ||
    baseVideo.width !== 1080 ||
    baseVideo.height !== 1920 ||
    radarVideo.width !== 1080 ||
    radarVideo.height !== 1920
  ) {
    throw new Error("Expected both source videos to contain 1080×1920 video and audio.");
  }

  const baseFrameCount = Math.round(Number(baseProbe.format.duration) * FPS);
  const baseDuration = baseFrameCount / FPS;
  const baseAudioDuration = Number(baseAudio.duration);
  const baseAudioPad = Math.max(0, baseDuration - baseAudioDuration);
  const radarScript = await readFile(RADAR_SCRIPT, "utf8");
  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  const timelineRows = [
    ...radarScript.matchAll(
      /^\|\s*(\d+)\s*\|\s*([\d.]+)[–-]([\d.]+)\s*\|\s*([^|]+)\|/gmu,
    ),
  ];
  const radarRowIndex = timelineRows.findIndex((row) =>
    row[4].trim().startsWith("НА РАДАРЕ СЕЙЧАС"),
  );
  const radarNarration = radarScript.match(/^3\.\s+(.+)$/mu)?.[1]?.trim();
  if (radarRowIndex < 1 || !radarNarration || snapshot.selected?.symbol !== "SANDUSDT") {
    throw new Error("Could not verify the saved SAND radar scene and narration.");
  }

  const radarRow = timelineRows[radarRowIndex];
  const radarStartSeconds = Number(radarRow[2]);
  const radarFrames = Math.round((Number(radarRow[3]) - radarStartSeconds) * FPS);
  const radarStartFrame = timelineRows
    .slice(0, radarRowIndex)
    .reduce(
      (frames, row) =>
        frames + Math.round((Number(row[3]) - Number(row[2])) * FPS),
      0,
    );
  const radarDuration = radarFrames / FPS;
  if (radarFrames < 1 || radarDuration > 20) {
    throw new Error("The saved SAND radar scene has an invalid duration.");
  }

  const provider = getSpeechProvider();
  const voiceId = getConfiguredVoiceId();
  if (!voiceId) {
    throw new Error(
      `The configured ${provider} speech provider has no voice ID; refusing to substitute another voice.`,
    );
  }
  const ctaAudio = await generateSpeech(
    prepareSpeechText(CTA_TEXT),
    voiceId,
    getElevenLabsModel(),
    { ...VOICE_SETTINGS, previousText: radarNarration },
  );
  if (!ctaAudio?.length) throw new Error("The configured voice provider returned no CTA audio.");

  const tempDir = path.join("/tmp", `qnt-refined-radar-${process.pid}`);
  const ctaAudioPath = path.join(tempDir, "cta.mp3");
  const bannerPath = path.join(tempDir, "cta-banner.txt");
  const outputDir = path.dirname(OUTPUT_VIDEO);
  await mkdir(tempDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(ctaAudioPath, ctaAudio);
  await writeFile(bannerPath, CTA_BANNER, "utf8");

  const ctaRawDuration = await probeDuration(ctaAudioPath);
  const ctaFrames = Math.max(120, Math.ceil((ctaRawDuration + 0.45) * FPS));
  const ctaHoldDuration = ctaFrames / FPS;
  const totalFrames = baseFrameCount + radarFrames + ctaFrames;
  const totalDuration = totalFrames / FPS;
  if (totalDuration > 60) {
    throw new Error(
      `The appended version would be ${totalDuration.toFixed(2)} seconds; shorten the CTA before rendering.`,
    );
  }

  const fontMatch = await execFile("fc-match", [
    "-f",
    "%{file}",
    "DejaVu Sans:style=Bold",
  ]);
  const fontPath = fontMatch.stdout.trim();
  if (!fontPath) throw new Error("Could not locate a bold DejaVu font for the CTA banner.");

  const holdStart = radarDuration.toFixed(6);
  const ctaFadeOutStart = Math.max(0, ctaHoldDuration - 0.65).toFixed(6);
  const radarVideoFilters = [
    `trim=start_frame=${radarStartFrame}:end_frame=${radarStartFrame + radarFrames}`,
    "setpts=PTS-STARTPTS",
    `fps=${FPS}`,
    "setsar=1",
    `tpad=stop_mode=clone:stop_duration=${ctaHoldDuration.toFixed(6)}`,
    "drawbox=x=895:y=39:w=128:h=36:color=0x080c0b:t=fill",
    `drawtext=fontfile=${fontPath}:text=FINAL:fontcolor=0x91a097:fontsize=18:x=1004-text_w:y=63`,
    `drawbox=x=96:y=598:w=888:h=105:color=0x101714@0.98:t=fill:enable='gte(t,${holdStart})'`,
    `drawbox=x=96:y=598:w=888:h=105:color=0xd6ff39@0.9:t=2:enable='gte(t,${holdStart})'`,
    `drawtext=fontfile=${fontPath}:textfile=${bannerPath}:fontcolor=0xd6ff39:fontsize=22:x=(w-text_w)/2:y=642:enable='gte(t,${holdStart})'`,
    "format=yuv420p",
  ].join(",");
  const filterGraph = [
    `[0:v]fps=${FPS},setsar=1,format=yuv420p,setpts=PTS-STARTPTS[basev]`,
    `[1:v]${radarVideoFilters}[radarv]`,
    `[basev][radarv]concat=n=2:v=1:a=0[v]`,
    `[0:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS,apad=pad_dur=${baseAudioPad.toFixed(6)},atrim=duration=${baseDuration.toFixed(6)}[basea]`,
    `[1:a]atrim=start=${radarStartSeconds.toFixed(6)}:duration=${radarDuration.toFixed(6)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur=0.1,atrim=duration=${radarDuration.toFixed(6)}[radara]`,
    `[2:a]aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur=${ctaHoldDuration.toFixed(6)},atrim=duration=${ctaHoldDuration.toFixed(6)},asetpts=PTS-STARTPTS[ctavoice]`,
    `[3:a]volume=0.13,afade=t=in:st=0:d=0.4,afade=t=out:st=${ctaFadeOutStart}:d=0.65,atrim=duration=${ctaHoldDuration.toFixed(6)},aresample=48000,aformat=channel_layouts=stereo[ctamusic]`,
    `[ctavoice][ctamusic]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[ctaa]`,
    `[basea][radara][ctaa]concat=n=3:v=0:a=1[a]`,
  ].join(";");

  console.log(
    `Appending SAND radar (${radarDuration.toFixed(2)} s) and a ${ctaRawDuration.toFixed(2)} s spoken CTA to the refined QNT version.`,
  );
  await execFile(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "warning",
      "-i",
      BASE_VIDEO,
      "-i",
      RADAR_VIDEO,
      "-i",
      ctaAudioPath,
      "-stream_loop",
      "-1",
      "-i",
      MUSIC,
      "-filter_complex",
      filterGraph,
      "-map",
      "[v]",
      "-map",
      "[a]",
      "-frames:v",
      String(totalFrames),
      "-t",
      totalDuration.toFixed(6),
      "-r",
      String(FPS),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      OUTPUT_VIDEO,
    ],
    { timeout: 300_000, maxBuffer: 12 * 1024 * 1024 },
  );

  const snapshotAt = snapshot.scannedAt;
  const windowStart = new Date(snapshot.selected.candleOpenTime).toISOString();
  const windowEnd = new Date(snapshot.selected.candleCloseTime).toISOString();
  const script = `# QNT — Impact: уточнённая версия + SAND на радаре

## Сохранённая основа

- Исходный файл оставлен без изменений: qnt-01-impact-refined.mp4.
- Первые ${baseFrameCount} кадров идут первыми; исходный аудиомикс сохранён, а короткий AAC-хвост дополнен тишиной до конца видеоряда для точной синхронизации радара.
- Исходный QNT-срез и весь исторический блок остаются прежними.

## Добавленный финал

- Кандидат: ${snapshot.selected.symbol} · Binance Spot.
- Снимок рынка: ${snapshotAt} UTC.
- Закрытое 4h-окно: ${windowStart} — ${windowEnd} UTC.
- Изменение: +${snapshot.selected.priceChange4h.toFixed(2)}% за 4h.
- Оборот: ${(snapshot.selected.quoteVolume4h / 1e6).toFixed(2)} млн USDT.
- Объём к среднему за 42 предшествующие закрытые 4h-свечи: ${snapshot.selected.volumeRatio.toFixed(2)}×.
- Таймкод радара: ${(baseFrameCount / FPS).toFixed(2)}–${((baseFrameCount + radarFrames) / FPS).toFixed(2)} с.
- Таймкод финального CTA: ${((baseFrameCount + radarFrames) / FPS).toFixed(2)}–${totalDuration.toFixed(2)} с.
- Озвучка радара: ${radarNarration}
- Новая озвучка CTA: ${CTA_TEXT}
- Экранная плашка в последнем кадре: ${CTA_BANNER}

## Источники

- Основная версия: exports/qnt-visual-variants/qnt-01-impact-refined.mp4.
- Радар и таймкод данных: exports/qnt-live-radar/SAND-20261003-061347UTC/.
- Новый голос CTA создан настроенным голосовым провайдером проекта.
- Итог: 1080×1920, 30 fps, ${totalDuration.toFixed(2)} с.
`;
  await writeFile(OUTPUT_SCRIPT, script, "utf8");

  const finalProbe = await probeMedia(OUTPUT_VIDEO);
  console.log(`Completed: ${OUTPUT_VIDEO}`);
  console.log(JSON.stringify(finalProbe, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});