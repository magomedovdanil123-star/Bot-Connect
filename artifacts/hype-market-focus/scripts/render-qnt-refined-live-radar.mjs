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
const LEGACY_RENDER = process.env.QNT_RADAR_RENDER_MODE === "legacy";
const OUTPUT_VIDEO = path.join(
  EXPORT_DIR,
  LEGACY_RENDER
    ? "qnt-01-impact-refined-live-radar.mp4"
    : "qnt-01-impact-refined-live-radar-investment.mp4",
);
const OUTPUT_SCRIPT = path.join(
  ROOT,
  "exports",
  LEGACY_RENDER
    ? "SCRIPT-QNT-IMPACT-REFINED-LIVE-RADAR.md"
    : "SCRIPT-QNT-IMPACT-REFINED-LIVE-RADAR-INVESTMENT.md",
);
const DOLLAR_SFX = path.resolve(
  ROOT,
  "..",
  "..",
  "attached_assets",
  "Доллары_1790668200494.mp3",
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
const BRIDGE_TEXT =
  "Этот импульс по QNT уже прошёл. Сегодня, третьего октября, набирает обороты SAND.";
const RADAR_TEXT =
  "За четыре часа цена SAND выросла на тринадцать целых девяносто три сотых процента. Оборот — семнадцать миллионов долларов, почти в десять раз выше среднего за семь дней.";
const INVESTMENT_TEXT =
  "Если бы вы вложили тысячу долларов перед этим движением, на выходе было бы около тысячи ста тридцати девяти долларов — до комиссий.";
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

async function mainLegacy() {
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

async function mainInvestment() {
  await Promise.all([
    access(BASE_VIDEO),
    access(RADAR_VIDEO),
    access(RADAR_SCRIPT),
    access(SNAPSHOT_PATH),
    access(MUSIC),
    access(DOLLAR_SFX),
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
  const baseAudioPad = Math.max(0, baseDuration - Number(baseAudio.duration));
  const radarScript = await readFile(RADAR_SCRIPT, "utf8");
  const snapshot = JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));
  if (snapshot.selected?.symbol !== "SANDUSDT") {
    throw new Error("The saved market snapshot is not the expected SAND spot scan.");
  }

  const timelineRows = [
    ...radarScript.matchAll(
      /^\|\s*(\d+)\s*\|\s*([\d.]+)[–-]([\d.]+)\s*\|\s*([^|]+)\|/gmu,
    ),
  ];
  const bridgeRowIndex = timelineRows.findIndex((row) =>
    row[4].trim().startsWith("СМОТРИМ"),
  );
  const radarRowIndex = timelineRows.findIndex((row) =>
    row[4].trim().startsWith("НА РАДАРЕ СЕЙЧАС"),
  );
  if (bridgeRowIndex < 1 || radarRowIndex <= bridgeRowIndex) {
    throw new Error("Could not locate the saved transition and SAND radar scenes.");
  }

  const rowFrames = (row) => ({
    startSeconds: Number(row[2]),
    startFrame: Math.round(Number(row[2]) * FPS),
    frames: Math.round((Number(row[3]) - Number(row[2])) * FPS),
  });
  const bridgeSource = rowFrames(timelineRows[bridgeRowIndex]);
  const radarSource = rowFrames(timelineRows[radarRowIndex]);
  if (bridgeSource.frames < 1 || radarSource.frames < 1) {
    throw new Error("The saved transition or SAND radar scene has no video frames.");
  }

  const provider = getSpeechProvider();
  const voiceId = getConfiguredVoiceId();
  if (!voiceId) {
    throw new Error(
      `The configured ${provider} speech provider has no voice ID; refusing to substitute another voice.`,
    );
  }

  const voiceSections = [
    { key: "bridge", text: BRIDGE_TEXT },
    { key: "radar", text: RADAR_TEXT },
    { key: "investment", text: INVESTMENT_TEXT },
    { key: "cta", text: CTA_TEXT },
  ];
  const tempDir = path.join("/tmp", `qnt-refined-investment-${process.pid}`);
  const outputDir = path.dirname(OUTPUT_VIDEO);
  await mkdir(tempDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const voiceFiles = [];
  for (let index = 0; index < voiceSections.length; index += 1) {
    const section = voiceSections[index];
    const audio = await generateSpeech(
      prepareSpeechText(section.text),
      voiceId,
      getElevenLabsModel(),
      {
        ...VOICE_SETTINGS,
        previousText: voiceSections[index - 1]?.text,
        nextText: voiceSections[index + 1]?.text,
      },
    );
    if (!audio?.length) {
      throw new Error(`The configured voice provider returned no ${section.key} audio.`);
    }
    const filePath = path.join(tempDir, `${section.key}.mp3`);
    await writeFile(filePath, audio);
    voiceFiles.push({
      ...section,
      filePath,
      duration: await probeDuration(filePath),
    });
  }

  const byKey = Object.fromEntries(voiceFiles.map((voice) => [voice.key, voice]));
  const dollarDuration = await probeDuration(DOLLAR_SFX);
  const bridgeFrames = Math.max(
    bridgeSource.frames,
    Math.ceil((byKey.bridge.duration + 0.5) * FPS),
  );
  const radarFrames = Math.max(
    radarSource.frames,
    Math.ceil((byKey.radar.duration + 0.5) * FPS),
  );
  const investmentFrames = Math.max(
    Math.ceil(8 * FPS),
    Math.ceil((byKey.investment.duration + 0.7) * FPS),
    Math.ceil((dollarDuration + 2.4) * FPS),
  );
  const ctaFrames = Math.max(
    160,
    Math.ceil((byKey.cta.duration + 0.45) * FPS),
  );
  const bridgeDuration = bridgeFrames / FPS;
  const radarDuration = radarFrames / FPS;
  const investmentDuration = investmentFrames / FPS;
  const ctaDuration = ctaFrames / FPS;
  const appendDuration = bridgeDuration + radarDuration + investmentDuration + ctaDuration;
  const totalFrames =
    baseFrameCount + bridgeFrames + radarFrames + investmentFrames + ctaFrames;
  const totalDuration = totalFrames / FPS;
  if (totalDuration > 80) {
    throw new Error(
      `The requested scenes would make a ${totalDuration.toFixed(2)} second video; shorten the new narration first.`,
    );
  }

  const fontMatch = await execFile("fc-match", [
    "-f",
    "%{file}",
    "DejaVu Sans:style=Bold",
  ]);
  const fontPath = fontMatch.stdout.trim();
  if (!fontPath) throw new Error("Could not locate a bold DejaVu font for the overlays.");

  const dateTagPath = path.join(tempDir, "date-tag.txt");
  const ctaBannerPath = path.join(tempDir, "cta-banner.txt");
  await Promise.all([
    writeFile(dateTagPath, "03.10.2026", "utf8"),
    writeFile(ctaBannerPath, CTA_BANNER, "utf8"),
  ]);

  const investmentLabels = [
    ["eyebrow", "ИСТОРИЧЕСКИЙ ПРИМЕР · SAND · 03.10.2026"],
    ["heading", "ЕСЛИ БЫ ВЫ ВЛОЖИЛИ"],
    ["ticker", "SAND"],
    ["start-value", "$1 000"],
    ["start-label", "НА ВХОДЕ"],
    ["arrow", "→"],
    ["end-value", "$1 139"],
    ["end-label", "НА ВЫХОДЕ"],
    ["profit", "+$139"],
    ["movement", "+13,93% ЗА 4 ЧАСА"],
    ["disclaimer", "РАСЧЁТ ДО КОМИССИЙ · НЕ ПРОГНОЗ"],
    ["caveat", "ПРОШЛЫЙ РОСТ НЕ ГАРАНТИРУЕТ БУДУЩИЙ"],
  ];
  const labelPaths = new Map(
    await Promise.all(
      investmentLabels.map(async ([key, text]) => {
        const filePath = path.join(tempDir, `money-${key}.txt`);
        await writeFile(filePath, text, "utf8");
        return [key, filePath];
      }),
    ),
  );

  const drawText = (key, size, y, color, alpha = "1", centerX = 540) =>
    `drawtext=fontfile=${fontPath}:textfile=${labelPaths.get(key)}:expansion=none:fontcolor=${color}:fontsize=${size}:x=${centerX}-text_w/2:y=${y}:alpha='${alpha}'`;
  const cardFilters = [
    "drawgrid=w=54:h=54:t=1:c=0x26332c@0.24",
    "drawbox=x=72:y=220:w=936:h=1320:color=0x101714:t=fill",
    "drawbox=x=72:y=220:w=936:h=1320:color=0x26332c:t=2",
    "drawbox=x=72:y=220:w=936:h=5:color=0xd6ff39:t=fill",
    "drawbox=x=112:y=665:w=390:h=350:color=0x142019:t=fill",
    "drawbox=x=112:y=665:w=390:h=350:color=0x364737:t=2",
    "drawbox=x=578:y=665:w=390:h=350:color=0x142019:t=fill",
    "drawbox=x=578:y=665:w=390:h=350:color=0xd6ff39@0.9:t=2",
    "drawbox=x=148:y=1062:w=784:h=2:color=0x364737:t=fill",
    drawText("eyebrow", 21, 375, "0x91a097"),
    drawText("heading", 35, 520, "0xf2f5ef", "if(lt(t,0.35),t/0.35,1)"),
    drawText("ticker", 50, 604, "0xd6ff39"),
    drawText("start-value", 66, 824, "0xf2f5ef", "if(lt(t,0.55),t/0.55,1)", 307),
    drawText("start-label", 21, 910, "0x91a097", "1", 307),
    drawText("arrow", 54, 850, "0xd6ff39", "if(lt(t,0.9),t/0.9,1)"),
    drawText("end-value", 63, 824, "0xd6ff39", "if(lt(t,1.15),t/1.15,1)", 773),
    drawText("end-label", 21, 910, "0x91a097", "1", 773),
    drawText("profit", 63, 1154, "0xd6ff39", "if(lt(t,1.45),t/1.45,1)"),
    drawText("movement", 27, 1215, "0xf2f5ef"),
    drawText("disclaimer", 22, 1375, "0x91a097"),
    drawText("caveat", 19, 1422, "0x91a097"),
    "zoompan=z='min(zoom+0.00007,1.015)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30",
    "setsar=1,format=yuv420p",
  ];
  const investmentVideo = path.join(tempDir, "investment-card.mp4");
  await execFile(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "warning",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x080c0b:s=1080x1920:r=${FPS}:d=${investmentDuration.toFixed(6)}`,
      "-vf",
      cardFilters.join(","),
      "-frames:v",
      String(investmentFrames),
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
      investmentVideo,
    ],
    { timeout: 300_000, maxBuffer: 12 * 1024 * 1024 },
  );

  const holdStart = radarDuration.toFixed(6);
  const ctaFadeOutStart = Math.max(0, ctaDuration - 0.65).toFixed(6);
  const bridgeVideoFilters = [
    `trim=start_frame=${bridgeSource.startFrame}:end_frame=${bridgeSource.startFrame + bridgeSource.frames}`,
    "setpts=PTS-STARTPTS",
    `fps=${FPS}`,
    "setsar=1",
    `tpad=stop_mode=clone:stop_duration=${Math.max(0, bridgeDuration - bridgeSource.frames / FPS).toFixed(6)}`,
    `trim=duration=${bridgeDuration.toFixed(6)}`,
    "drawbox=x=818:y=116:w=188:h=48:color=0x080c0b@0.96:t=fill",
    "drawbox=x=818:y=116:w=188:h=48:color=0xd6ff39@0.82:t=2",
    `drawtext=fontfile=${fontPath}:textfile=${dateTagPath}:fontcolor=0xd6ff39:fontsize=17:x=855:y=147`,
    "format=yuv420p",
  ].join(",");
  const radarVideoFilters = [
    `trim=start_frame=${radarSource.startFrame}:end_frame=${radarSource.startFrame + radarSource.frames}`,
    "setpts=PTS-STARTPTS",
    `fps=${FPS}`,
    "setsar=1",
    `tpad=stop_mode=clone:stop_duration=${Math.max(0, radarDuration - radarSource.frames / FPS).toFixed(6)}`,
    `trim=duration=${radarDuration.toFixed(6)}`,
    "drawbox=x=818:y=35:w=188:h=43:color=0x080c0b@0.96:t=fill",
    "drawbox=x=818:y=35:w=188:h=43:color=0xd6ff39@0.82:t=2",
    `drawtext=fontfile=${fontPath}:textfile=${dateTagPath}:fontcolor=0xd6ff39:fontsize=17:x=855:y=63`,
    "format=yuv420p",
  ].join(",");
  const ctaStillFrame =
    radarSource.startFrame + Math.min(radarSource.frames - 1, Math.round(8.5 * FPS));
  const ctaVideoFilters = [
    `trim=start_frame=${ctaStillFrame}:end_frame=${ctaStillFrame + 1}`,
    "setpts=PTS-STARTPTS",
    `fps=${FPS}`,
    "setsar=1",
    `tpad=stop_mode=clone:stop_duration=${ctaDuration.toFixed(6)}`,
    `trim=duration=${ctaDuration.toFixed(6)}`,
    "drawbox=x=895:y=39:w=128:h=36:color=0x080c0b:t=fill",
    `drawtext=fontfile=${fontPath}:text=FINAL:fontcolor=0x91a097:fontsize=18:x=1004-text_w:y=63`,
    "drawbox=x=96:y=598:w=888:h=105:color=0x101714@0.98:t=fill",
    "drawbox=x=96:y=598:w=888:h=105:color=0xd6ff39@0.9:t=2",
    `drawtext=fontfile=${fontPath}:textfile=${ctaBannerPath}:fontcolor=0xd6ff39:fontsize=22:x=(w-text_w)/2:y=642`,
    "format=yuv420p",
  ].join(",");

  const bridgeBedStart = 0;
  const radarBedStart = bridgeDuration;
  const investmentBedStart = bridgeDuration + radarDuration;
  const ctaBedStart = bridgeDuration + radarDuration + investmentDuration;
  const dollarDelayMs = Math.min(
    2_400,
    Math.max(1_800, Math.round(byKey.investment.duration * 0.36 * 1_000)),
  );
  const dollarFadeStart = Math.max(0, dollarDelayMs / 1_000 + dollarDuration - 0.6);
  const filterGraph = [
    `[0:v]fps=${FPS},setsar=1,format=yuv420p,setpts=PTS-STARTPTS[basev]`,
    `[1:v]${bridgeVideoFilters}[bridgev]`,
    `[1:v]${radarVideoFilters}[radarv]`,
    `[8:v]fps=${FPS},setsar=1,format=yuv420p,trim=duration=${investmentDuration.toFixed(6)},setpts=PTS-STARTPTS[moneyv]`,
    `[1:v]${ctaVideoFilters}[ctav]`,
    `[basev][bridgev][radarv][moneyv][ctav]concat=n=5:v=1:a=0[v]`,
    `[0:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS,apad=pad_dur=${baseAudioPad.toFixed(6)},atrim=duration=${baseDuration.toFixed(6)}[basea]`,
    `[2:a]aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur=${bridgeDuration.toFixed(6)},atrim=duration=${bridgeDuration.toFixed(6)},asetpts=PTS-STARTPTS[bridgevoice]`,
    `[3:a]aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur=${radarDuration.toFixed(6)},atrim=duration=${radarDuration.toFixed(6)},asetpts=PTS-STARTPTS[radarvoice]`,
    `[4:a]aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur=${investmentDuration.toFixed(6)},atrim=duration=${investmentDuration.toFixed(6)},asetpts=PTS-STARTPTS[moneyvoice]`,
    `[5:a]aresample=48000,aformat=channel_layouts=stereo,apad=pad_dur=${ctaDuration.toFixed(6)},atrim=duration=${ctaDuration.toFixed(6)},asetpts=PTS-STARTPTS[ctavoice]`,
    `[7:a]aresample=48000,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS,volume=0.12,atrim=duration=${appendDuration.toFixed(6)}[bed]`,
    "[bed]asplit=4[bedbridge0][bedradar0][bedmoney0][bedcta0]",
    `[bedbridge0]atrim=start=${bridgeBedStart.toFixed(6)}:duration=${bridgeDuration.toFixed(6)},asetpts=PTS-STARTPTS[bedbridge]`,
    `[bedradar0]atrim=start=${radarBedStart.toFixed(6)}:duration=${radarDuration.toFixed(6)},asetpts=PTS-STARTPTS[bedradar]`,
    `[bedmoney0]atrim=start=${investmentBedStart.toFixed(6)}:duration=${investmentDuration.toFixed(6)},asetpts=PTS-STARTPTS[bedmoney]`,
    `[bedcta0]atrim=start=${ctaBedStart.toFixed(6)}:duration=${ctaDuration.toFixed(6)},asetpts=PTS-STARTPTS,afade=t=out:st=${ctaFadeOutStart}:d=0.65[bedcta]`,
    `[6:a]aresample=48000,aformat=channel_layouts=stereo,volume=0.48,adelay=${dollarDelayMs}|${dollarDelayMs},apad=pad_dur=${investmentDuration.toFixed(6)},atrim=duration=${investmentDuration.toFixed(6)},afade=t=out:st=${dollarFadeStart.toFixed(6)}:d=0.55[dollarsfx]`,
    "[bridgevoice][bedbridge]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[bridgea]",
    "[radarvoice][bedradar]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[radara]",
    "[moneyvoice][bedmoney][dollarsfx]amix=inputs=3:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[moneya]",
    "[ctavoice][bedcta]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[ctaa]",
    "[basea][bridgea][radara][moneya][ctaa]concat=n=5:v=0:a=1[a]",
  ].join(";");

  console.log(
    `Rendering QNT → dated SAND transition → ${snapshot.selected.priceChange4h.toFixed(2)}% radar → $1,000 example → CTA (${totalDuration.toFixed(2)} s).`,
  );
  for (const voice of voiceFiles) {
    console.log(`${voice.key}: ${voice.duration.toFixed(2)} s speech.`);
  }
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
      byKey.bridge.filePath,
      "-i",
      byKey.radar.filePath,
      "-i",
      byKey.investment.filePath,
      "-i",
      byKey.cta.filePath,
      "-i",
      DOLLAR_SFX,
      "-stream_loop",
      "-1",
      "-i",
      MUSIC,
      "-i",
      investmentVideo,
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
  const priceChange = snapshot.selected.priceChange4h;
  const initialInvestment = 1_000;
  const estimatedExit = initialInvestment * (1 + priceChange / 100);
  const bridgeStart = baseDuration;
  const radarStart = bridgeStart + bridgeDuration;
  const investmentStart = radarStart + radarDuration;
  const ctaStart = investmentStart + investmentDuration;
  const sectionTimeline = [
    `| QNT · исходный фрагмент | 0.00–${baseDuration.toFixed(2)} | Сохранён без изменений |`,
    `| Переход · 03.10.2026 | ${bridgeStart.toFixed(2)}–${radarStart.toFixed(2)} | ${BRIDGE_TEXT} |`,
    `| SAND · радар | ${radarStart.toFixed(2)}–${investmentStart.toFixed(2)} | ${RADAR_TEXT} |`,
    `| Пример $1,000 | ${investmentStart.toFixed(2)}–${ctaStart.toFixed(2)} | ${INVESTMENT_TEXT} |`,
    `| CTA | ${ctaStart.toFixed(2)}–${totalDuration.toFixed(2)} | ${CTA_TEXT} |`,
  ].join("\n");
  const script = `# QNT — Impact: SAND, переход и пример $1,000

## Сохранённая основа

- Исходный файл оставлен без изменений: qnt-01-impact-refined.mp4.
- Первые ${baseFrameCount} кадров сохраняют прежний QNT-фрагмент; короткий AAC-хвост дополнен тишиной до конца видеоряда.
- Предыдущий вариант с радаром также сохранён отдельно: qnt-01-impact-refined-live-radar.mp4.

## Данные SAND

- Пара: ${snapshot.selected.symbol} · Binance Spot.
- Снимок: ${snapshotAt} UTC.
- Закрытое 4h-окно: ${windowStart} — ${windowEnd} UTC.
- Изменение цены: +${priceChange.toFixed(4)}%.
- Оборот: ${(snapshot.selected.quoteVolume4h / 1e6).toFixed(2)} млн USDT.
- Объём относительно среднего за 42 предшествующие закрытые 4h-свечи: ${snapshot.selected.volumeRatio.toFixed(2)}×.

## Гипотетический расчёт

- Условный вход: $${initialInvestment.toLocaleString("en-US")} перед началом указанного четырёхчасового движения.
- Расчёт на выходе: $${estimatedExit.toFixed(2)} до комиссий и проскальзывания.
- Прирост: $${(estimatedExit - initialInvestment).toFixed(2)}.
- Это исторический пример на основании закрытого изменения цены, не прогноз и не обещание результата.
- На вставке использован приложенный пользователем звук «Доллары».

## Таймлайн и озвучка

${sectionTimeline}

## Тексты

- Переход: ${BRIDGE_TEXT}
- Радар: ${RADAR_TEXT}
- Пример: ${INVESTMENT_TEXT}
- CTA: ${CTA_TEXT}
- Финальная плашка: ${CTA_BANNER}

## Источники и монтаж

- Основная версия: exports/qnt-visual-variants/qnt-01-impact-refined.mp4.
- Рыночный снимок и исходный графический радар: exports/qnt-live-radar/SAND-20261003-061347UTC/.
- Озвучка синтезирована настроенным голосовым провайдером проекта.
- Финальный файл: ${path.basename(OUTPUT_VIDEO)} · 1080×1920 · ${FPS} fps · ${totalDuration.toFixed(2)} с.
`;
  await writeFile(OUTPUT_SCRIPT, script, "utf8");

  const finalProbe = await probeMedia(OUTPUT_VIDEO);
  console.log(`Completed: ${OUTPUT_VIDEO}`);
  console.log(JSON.stringify(finalProbe, null, 2));
}

const render = LEGACY_RENDER ? mainLegacy : mainInvestment;
render().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});