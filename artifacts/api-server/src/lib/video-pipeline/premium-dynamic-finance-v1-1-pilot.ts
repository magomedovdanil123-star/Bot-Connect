import { constants } from "node:fs";
import { access, copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import {
  resolveCoinOverviewLongResearchData,
  resolveCoinOverviewMarketData,
} from "../coin-overview-data";
import {
  buildPremiumDynamicFinanceV1_1VisualPlan,
  resolvePremiumDynamicFinanceV1_1CachedLogo,
} from "./premium-dynamic-finance-v1-1-visual-director";
import {
  buildPremiumFinanceEmphasisEvents,
  buildPremiumDynamicFinanceEditPlan,
  estimatePremiumFinanceSubtitleWords,
} from "./premium-dynamic-finance";
import { renderLongformVisualVideo } from "./longform-visual-renderer";
import {
  buildPremiumDynamicFinanceV1_1PilotVoices,
  PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS,
} from "./premium-dynamic-finance-v1-1-pilot-script";
import { renderPremiumDynamicFinanceV1_1OverlayFrames } from "./premium-dynamic-finance-v1-1-overlay";

const execFileAsync = promisify(execFile);
const MUSIC_BED = resolve("assets/audio/coin-overview-music-bed.mp3");
const DURATION_SECONDS = PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS / 1_000;

type Probe = {
  durationSeconds: number;
  streams: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    r_frame_rate?: string;
  }>;
};

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function probeMedia(path: string): Promise<Probe> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration:stream=codec_name,codec_type,width,height,r_frame_rate",
    "-of", "json",
    path,
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string };
    streams?: Probe["streams"];
  };
  return {
    durationSeconds: Number(parsed.format?.duration || 0),
    streams: parsed.streams ?? [],
  };
}

async function createMusicTrack(outputPath: string, voicePath?: string): Promise<string> {
  if (!(await pathExists(MUSIC_BED))) {
    throw new Error(`Required music bed is missing: ${MUSIC_BED}`);
  }
  const args = [
    "-y",
    "-stream_loop", "-1",
    "-i", MUSIC_BED,
    ...(voicePath ? ["-i", resolve(voicePath)] : []),
  ];
  if (voicePath) {
    args.push(
      "-filter_complex",
      "[0:a]volume=0.16[bg];[1:a]apad=whole_dur=120,volume=1.0[voice];[voice][bg]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[a]",
      "-map", "[a]",
    );
  } else {
    args.push("-map", "0:a:0", "-filter:a", "volume=0.45");
  }
  args.push(
    "-t", String(DURATION_SECONDS),
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    outputPath,
  );
  await execFileAsync("ffmpeg", args, { maxBuffer: 15 * 1024 * 1024 });
  const probe = await probeMedia(outputPath);
  if (
    !probe.streams.some((stream) => stream.codec_type === "audio")
    || probe.durationSeconds * 1_000 < PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS - 500
  ) {
    throw new Error("Prepared pilot audio did not reach the requested 120-second duration");
  }
  return outputPath;
}

async function compositeOverlays(input: {
  baseVideoPath: string;
  framePaths: string[];
  outputPath: string;
  events: Array<{ startMs: number; endMs: number }>;
}): Promise<void> {
  if (input.framePaths.length !== input.events.length) {
    throw new Error("V1.1 overlay frames do not match the semantic visual plan");
  }
  const args = ["-y", "-i", input.baseVideoPath];
  for (const framePath of input.framePaths) args.push("-i", framePath);
  const filters: string[] = [];
  let previousLabel = "0:v";
  input.events.forEach((event, index) => {
    const nextLabel = `v${index + 1}`;
    const startSeconds = (event.startMs / 1_000).toFixed(3);
    const endSeconds = (event.endMs / 1_000).toFixed(3);
    filters.push(
      `[${previousLabel}][${index + 1}:v]overlay=0:0:format=auto:eof_action=repeat:shortest=0:enable='gte(t,${startSeconds})*lt(t,${endSeconds})'[${nextLabel}]`,
    );
    previousLabel = nextLabel;
  });
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", `[${previousLabel}]`,
    "-map", "0:a:0",
    "-t", String(DURATION_SECONDS),
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-c:a", "copy",
    "-movflags", "+faststart",
    input.outputPath,
  );
  await execFileAsync("ffmpeg", args, { maxBuffer: 25 * 1024 * 1024 });
}

function buildRenderReport(input: {
  outputPath: string;
  reportPath: string;
  market: Awaited<ReturnType<typeof resolveCoinOverviewMarketData>>;
  research: Awaited<ReturnType<typeof resolveCoinOverviewLongResearchData>> | null;
  plan: ReturnType<typeof buildPremiumDynamicFinanceV1_1VisualPlan>;
  probe: Probe;
  voiceProvided: boolean;
}): string {
  const video = input.probe.streams.find((stream) => stream.codec_type === "video");
  const audio = input.probe.streams.find((stream) => stream.codec_type === "audio");
  const counts = Object.entries(input.plan.visualTypeCounts)
    .map(([visualType, count]) => `- ${visualType}: ${count}`)
    .join("\n");
  const numeric = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 7 });
  const historyNote = input.research
    ? input.research.genesisDate
      ? `CoinGecko вернул дату генезиса: ${input.research.genesisDate}.`
      : "CoinGecko не вернул дату генезиса; значение не добавлялось."
    : "Необязательный запрос расширенной истории был недоступен; дата запуска не использовалась.";
  return `# Premium Dynamic Finance V1.1 — отчёт о рендере Dogecoin

## Файл

- Файл: \`${basename(input.outputPath)}\`
- Продолжительность: ${input.probe.durationSeconds.toFixed(3)} с
- Видео: ${video?.codec_name ?? "неизвестно"}, ${video?.width ?? "?"}×${video?.height ?? "?"}, ${video?.r_frame_rate ?? "неизвестно"} кадров/с
- Аудио: ${audio?.codec_name ?? "неизвестно"}; ${input.voiceProvided ? "голосовая дорожка сведена с музыкой" : "музыкальная дорожка зациклена до 120 секунд"}
- Субтитры: авторский текст, 12 сцен по 10 секунд
- Видеослой: штатный Premium Dynamic renderer для основы; карточки V1.1 наложены локальным тестовым runner после основного рендера

## Рыночные данные

- Монета: ${input.market.coin.name} (${input.market.coin.symbol})
- Источник: ${input.market.sourceLabel} — ${input.market.coin.sourceUrl}
- Данные на: ${input.market.dataAsOf}
- Получено: ${input.market.retrievedAt}
- Текущая цена: ${numeric.format(input.market.currentPriceUsd)} USD
- Изменение за 7 дней: ${input.market.changePercent7d.toFixed(2)}%
- Диапазон за 7 дней: ${numeric.format(input.market.lowPriceUsd7d)}–${numeric.format(input.market.highPriceUsd7d)} USD
- ${input.market.activity.kind === "open_interest" ? "Открытый интерес" : "Торговый оборот за 24 часа"}: ${numeric.format(input.market.activity.valueUsd)} USD (${input.market.activity.sourceLabel} — ${input.market.activity.sourceUrl})
- Капитализация: ${input.market.marketCapUsd === null ? "источник не предоставил; в видео не показывается" : `${numeric.format(input.market.marketCapUsd)} USD`}
- Дата запуска: ${input.research?.genesisDate ?? "не получена"}
- Историческая справка: ${historyNote}
- Логотип: получен через существующий resolver CoinGecko

## Проверки визуального плана

- Семантических сцен: ${input.plan.events.length}
- Повторов визуального типа подряд: ${input.plan.repeatedVisualTypes}
- Сцен с резервной иллюстрацией: ${input.plan.fallbackScenes}
- Количество по визуальному типу:
${counts}
- Новостная карточка помечена как иллюстративная, не новость
- Торговый экран помечен как вымышленный; стакан заявок и исполняемые котировки не отображаются
- Схема помечена как иллюстрация, а не как данные блокчейна в реальном времени
- Финансовые значения взяты из источников; недоступные исторические сведения и прогнозы не выдумывались

## Изоляция

- Рендер выполнен только локальным тестовым runner V1.1
- Маршрут Telegram не вызывался
- Production renderer и маршруты Telegram не изменялись
- Отчёт: \`${basename(input.reportPath)}\`
`;
}

export async function renderPremiumDynamicFinanceV1_1DogecoinPilot(input: {
  outputPath: string;
  voicePath?: string;
}): Promise<{ outputPath: string; reportPath: string; report: string }> {
  const outputPath = resolve(input.outputPath);
  const reportPath = outputPath.replace(/\.mp4$/iu, ".report.md");
  if (outputPath === reportPath) throw new Error("Pilot output must use an .mp4 extension");
  if (await pathExists(outputPath)) {
    throw new Error(`Refusing to overwrite existing pilot video: ${outputPath}`);
  }
  if (await pathExists(reportPath)) {
    throw new Error(`Refusing to overwrite existing pilot report: ${reportPath}`);
  }
  if (input.voicePath && !(await pathExists(resolve(input.voicePath)))) {
    throw new Error(`Optional voice recording was not found: ${resolve(input.voicePath)}`);
  }

  const market = await resolveCoinOverviewMarketData(
    "dogecoin",
    globalThis.fetch,
    "dogecoin",
  );
  let research: Awaited<ReturnType<typeof resolveCoinOverviewLongResearchData>> | null = null;
  try {
    research = await resolveCoinOverviewLongResearchData(
      market.coin.id,
      market.coin.name,
      globalThis.fetch,
      market.sourceLabel,
    );
  } catch (error) {
    console.warn(JSON.stringify({
      render: "premium-dynamic-finance-v1-1-dogecoin-pilot",
      event: "optional-history-unavailable",
      reason: error instanceof Error ? error.message : String(error),
    }));
  }

  const logoDataUri = await resolvePremiumDynamicFinanceV1_1CachedLogo(
    market.coin.id,
    async () => market.coin.logoDataUri ?? null,
  );
  if (!logoDataUri) {
    throw new Error("CoinGecko did not supply a Dogecoin logo for the V1.1 pilot");
  }
  const voices = buildPremiumDynamicFinanceV1_1PilotVoices();
  const visualPlan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices,
    entity: {
      id: market.coin.id,
      name: market.coin.name,
      symbol: market.coin.symbol,
    },
    dataAsOf: market.dataAsOf,
  });
  const editPlan = buildPremiumDynamicFinanceEditPlan({
    voices,
    durationMs: PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS,
    topic: market.coin.name,
  });
  const subtitleWords = estimatePremiumFinanceSubtitleWords(
    voices,
    PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS,
  );

  const tempDir = await mkdtemp(join(tmpdir(), "premium-dynamic-finance-v1-1-"));
  const baseVideoPath = join(tempDir, "premium-dynamic-finance-v1-base.mp4");
  const musicTrackPath = join(tempDir, "music-track.m4a");
  const compositedPath = join(tempDir, "premium-dynamic-finance-v1-1-composited.mp4");
  await mkdir(dirname(outputPath), { recursive: true });
  try {
    await createMusicTrack(musicTrackPath, input.voicePath);
    await renderLongformVisualVideo({
      beats: editPlan.beats,
      durationMs: PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS,
      sourceAudioPath: musicTrackPath,
      outputPath: baseVideoPath,
      kineticSubtitleWords: subtitleWords,
      kineticSubtitleEmphasis: buildPremiumFinanceEmphasisEvents(editPlan.beats, subtitleWords),
    });
    const framePaths = await renderPremiumDynamicFinanceV1_1OverlayFrames({
      events: visualPlan.events,
      market,
      research,
      logoDataUri,
      tempDir,
    });
    await compositeOverlays({
      baseVideoPath,
      framePaths,
      outputPath: compositedPath,
      events: visualPlan.events,
    });
    const probe = await probeMedia(compositedPath);
    const video = probe.streams.find((stream) => stream.codec_type === "video");
    const audio = probe.streams.find((stream) => stream.codec_type === "audio");
    if (
      video?.codec_name !== "h264"
      || video.width !== 1920
      || video.height !== 1080
      || video.r_frame_rate !== "30/1"
      || !audio
      || Math.abs(probe.durationSeconds * 1_000 - PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS) > 1_000
    ) {
      throw new Error("Final V1.1 pilot failed 1920×1080, 30 FPS, audio, or 120-second validation");
    }
    if (visualPlan.events.length !== 12 || visualPlan.repeatedVisualTypes !== 0) {
      throw new Error("Final V1.1 pilot does not contain the expected twelve distinct semantic scenes");
    }

    const report = buildRenderReport({
      outputPath,
      reportPath,
      market,
      research,
      plan: visualPlan,
      probe,
      voiceProvided: Boolean(input.voicePath),
    });
    await copyFile(compositedPath, outputPath, constants.COPYFILE_EXCL);
    await writeFile(reportPath, report, { encoding: "utf8", flag: "wx" });
    return { outputPath, reportPath, report };
  } catch (error) {
    throw new Error(`Premium Dynamic Finance V1.1 Dogecoin pilot failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function parsePremiumDynamicFinanceV1_1PilotArgs(args: string[]): {
  outputPath: string;
  voicePath?: string;
  help: boolean;
} {
  let outputPath = resolve("output/premium-dynamic-finance-v1-1-dogecoin.mp4");
  let voicePath: string | undefined;
  let help = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === "--") continue;
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--output") {
      const value = args[index + 1];
      if (!value) throw new Error("--output requires an MP4 file path");
      outputPath = resolve(value);
      index += 1;
      continue;
    }
    if (arg === "--voice") {
      const value = args[index + 1];
      if (!value) throw new Error("--voice requires an audio file path");
      voicePath = resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown pilot option: ${arg}`);
  }
  return {
    outputPath,
    ...(voicePath ? { voicePath } : {}),
    help,
  };
}

export function premiumDynamicFinanceV1_1PilotUsage(): string {
  return [
    "Render the isolated two-minute Dogecoin V1.1 visual-diversity pilot.",
    "Options:",
    "  --output <file.mp4>   Output path (default: output/premium-dynamic-finance-v1-1-dogecoin.mp4)",
    "  --voice <audio-file>  Optional narration audio mixed over the looped music bed",
  ].join("\n");
}