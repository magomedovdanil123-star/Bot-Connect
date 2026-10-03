import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { generatedImagesTable, voiceGenerationsTable } from "@workspace/db";
import { assetUrl, copyAudioAssetToFile, readAudioAsset, storeAudioAsset } from "../audio-design/storage";
import { objectStorageClient } from "../objectStorage";
import { renderChatVideo, type ChatRenderMessage } from "./chat-renderer";
import { downloadMediaAsset, type SupabaseMediaAsset } from "../supabase";
import {
  buildCoinOverviewLongCaptions,
  buildCoinOverviewLongPhraseCaptions,
} from "./coin-overview-long-captions";
import { getFinanceLongBackgroundPath } from "./finance-long-style";
import { resolveVideoCompositionMode, type VideoMotionProfile } from "./render-profile";
import {
  buildCoinOverviewLongMotionGraphics,
  buildCoinOverviewLongPhraseBeats,
  buildCoinOverviewLongPhraseRenderChunks,
} from "./coin-overview-long-edit";
import {
  createFinanceLongMotionFontConfig,
  ETHEREUM_MOTION_FFMPEG_COLORS,
} from "./ethereum-motion-design";
import {
  renderChainlinkEditorialVideoOnly,
  renderFinanceLongCoinOverviewVectorVideoOnly,
} from "./chainlink-editorial-motion";
import { renderPremiumDynamicFinanceProduction } from "./premium-dynamic-finance";

const execFileAsync = promisify(execFile);
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

export type RenderVisual = typeof generatedImagesTable.$inferSelect & {
  supabaseAsset?: SupabaseMediaAsset;
  mediaKind?: "image" | "video";
};

async function readVisual(image: RenderVisual): Promise<{ buffer: Buffer; kind: "image" | "video" }> {
  if (image.supabaseAsset) {
    return {
      buffer: await downloadMediaAsset(image.supabaseAsset),
      kind: image.mediaKind ?? (image.supabaseAsset.kind === "video" ? "video" : "image"),
    };
  }
  if (!image.storagePath) throw new Error(`Scene ${image.sceneId} image has no storage object`);
  return { buffer: await readObject(image.storagePath), kind: image.mediaKind || "image" };
}

async function renderCoinOverviewLongInfographic(input: {
  dir: string;
  voices: Array<typeof voiceGenerationsTable.$inferSelect>;
  sceneVisualDescriptions?: Array<{ sceneId: number; description: string }>;
  durationMs: number;
  width: number;
  height: number;
  financeLongV4?: boolean;
  themeIndex?: number;
  paletteMode?: "default" | "aptos" | "ethereum-motion" | "pump-dynamic";
  frameRate?: 30 | 60;
}): Promise<string> {
  const visualDescriptionByScene = new Map(
    (input.sceneVisualDescriptions ?? []).map(({ sceneId, description }) => [sceneId, description]),
  );
  const voices = input.voices.map((voice) => ({
    sceneId: voice.sceneId,
    startTime: voice.startTime,
    endTime: voice.endTime,
    text: voice.text,
    isFullVoice: voice.isFullVoice,
    visualDescription: visualDescriptionByScene.get(voice.sceneId),
  }));
  const beats = buildCoinOverviewLongPhraseBeats({
    voices,
    durationMs: input.durationMs,
    useEthereumMotionSequence: input.paletteMode === "ethereum-motion",
  });
  const chunks = buildCoinOverviewLongPhraseRenderChunks({
    beats,
    durationMs: input.durationMs,
    targetDurationMs: 60_000,
  });
  if (!beats.length || !chunks.length) {
    throw new Error("Long coin overview infographic has no timed visual beats");
  }
  if (
    input.paletteMode === "ethereum-motion"
    && beats.some((beat) => beat.text.trim() && !beat.motionEvents?.length)
  ) {
    throw new Error(
      "Ethereum motion render requires a valid 5–8-event MOTION_SEQUENCE for every narrated scene",
    );
  }

  const frameRate = input.frameRate ?? 30;
  const clipFiles: string[] = [];
  const motionFontConfig = input.paletteMode === "ethereum-motion"
    ? await createFinanceLongMotionFontConfig(input.dir)
    : undefined;
  for (const [index, chunk] of chunks.entries()) {
    const chunkDurationMs = chunk.endMs - chunk.startMs;
    const chunkSeconds = (chunkDurationMs / 1000).toFixed(3);
    const filterPath = join(input.dir, `coin-overview-graphics-${index}.filter`);
    const clipPath = join(input.dir, `coin-overview-graphics-${index}.mp4`);
    const filter = buildCoinOverviewLongMotionGraphics({
      width: input.width,
      height: input.height,
      beats,
      chunkStartMs: chunk.startMs,
      chunkEndMs: chunk.endMs,
      ...(input.financeLongV4
        ? {
            paletteMode: input.paletteMode === "ethereum-motion"
              ? "ethereum-motion" as const
              : input.paletteMode === "aptos" ? "aptos" as const : "finance-long-v4" as const,
          themeIndex: input.themeIndex ?? 0,
        }
        : {}),
    });
    if (!filter.trim()) {
      throw new Error(`Long coin overview infographic chunk ${index + 1} has no graphics`);
    }
    await writeFile(filterPath, filter, "utf8");
    const backgroundInput = input.financeLongV4 && input.paletteMode === "default"
      ? ["-loop", "1", "-framerate", String(frameRate), "-i", getFinanceLongBackgroundPath(input.themeIndex ?? 0)]
      : [
        "-f",
        "lavfi",
        "-i",
        `color=c=${input.paletteMode === "ethereum-motion"
          ? ETHEREUM_MOTION_FFMPEG_COLORS.background
          : input.paletteMode === "aptos" ? "0x080c16" : "black"}:s=${input.width}x${input.height}:r=${frameRate}:d=${chunkSeconds}`,
      ];
    await execFileAsync("ffmpeg", [
      "-y",
      ...backgroundInput,
      "-filter_script:v", filterPath,
      "-t", chunkSeconds,
      "-an",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-pix_fmt", "yuv420p",
      "-r", String(frameRate),
      clipPath,
    ], {
      maxBuffer: 10 * 1024 * 1024,
      ...(motionFontConfig ? { env: motionFontConfig.env } : {}),
    });
    clipFiles.push(clipPath);
  }

  if (clipFiles.length === 1) return clipFiles[0]!;
  const concatVideoList = join(input.dir, "coin-overview-graphics-clips.txt");
  const videoOnly = join(input.dir, "video-only.mp4");
  await writeFile(
    concatVideoList,
    clipFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"),
    "utf8",
  );
  await execFileAsync("ffmpeg", [
    "-y", "-f", "concat", "-safe", "0", "-i", concatVideoList,
    "-an", "-c", "copy", "-movflags", "+faststart", videoOnly,
  ], { maxBuffer: 10 * 1024 * 1024 });
  return videoOnly;
}

export async function renderVideo(params: {
  images: RenderVisual[];
  voices: Array<typeof voiceGenerationsTable.$inferSelect>;
  sceneVisualDescriptions?: Array<{ sceneId: number; description: string }>;
  audioStoragePath: string;
  durationMs: number;
  format: string;
  motionProfile?: VideoMotionProfile;
  financeLongThemeIndex?: number;
  financeLongPaletteMode?: "default" | "aptos" | "ethereum-motion" | "pump-dynamic";
  financeLongFrameRate?: 30 | 60;
  financeLongPremiumDynamic?: boolean;
  financeLongCustomScriptProduction?: boolean;
  financeLongTopic?: string;
  financeLongDocumentary?: boolean;
  financeLongEditorialBlueprint?: boolean;
  financeLongCoinOverviewVector?: boolean;
  preserveAudioFromSourceVideo?: boolean;
  chatMessages?: ChatRenderMessage[];
  bannerStoragePath?: string | null;
  bannerKind?: "image" | "video" | null;
}): Promise<{ buffer: Buffer; durationMs: number }> {
  if (!params.voices.length) throw new Error("At least one completed voice scene is required");
  const compositionMode = resolveVideoCompositionMode(params);
  if (compositionMode === "chat") {
    if (!params.chatMessages?.length) throw new Error("At least one chat message is required");
    return renderChatVideo({
      messages: params.chatMessages,
      audioStoragePath: params.audioStoragePath,
      durationMs: params.durationMs,
    });
  }
  const dir = await mkdtemp(join(tmpdir(), "video-render-"));
  const coinReviewMotion = compositionMode === "coin-review";
  const financeLongV4Motion = compositionMode === "finance-long-v4";
  const financeLongDocumentary = financeLongV4Motion && params.financeLongDocumentary === true;
  const coinOverviewLongMotion = financeLongV4Motion && (
    !financeLongDocumentary || params.financeLongPaletteMode === "ethereum-motion"
  );
  const landscape = params.format === "16:9" || financeLongV4Motion;
  const financeLongFrameRate = financeLongV4Motion
    ? params.financeLongFrameRate ?? (
      params.financeLongPaletteMode === "ethereum-motion" || params.financeLongCoinOverviewVector
        ? 60
        : 30
    )
    : 30;
  const financeLongVectorMotion = params.financeLongEditorialBlueprint === true
    || params.financeLongCoinOverviewVector === true;
  const financeLongPremiumDynamic = financeLongV4Motion
    && params.financeLongPremiumDynamic === true
    && !params.financeLongEditorialBlueprint
    && !params.financeLongCoinOverviewVector
    && !financeLongDocumentary;
  if (params.financeLongCustomScriptProduction && !financeLongPremiumDynamic) {
    await rm(dir, { recursive: true, force: true });
    throw new Error("Telegram Finance Long custom scripts require the Premium Dynamic production renderer");
  }
  const visualDescriptionByScene = new Map(
    (params.sceneVisualDescriptions ?? []).map(({ sceneId, description }) => [sceneId, description]),
  );
  if (!params.images.length && !coinOverviewLongMotion) {
    throw new Error("At least one completed scene image is required");
  }
  const width = landscape ? 1920 : 1080;
  const height = landscape ? 1080 : 1920;
  try {
    let videoOnly: string;
    if (financeLongPremiumDynamic) {
      const audioFile = join(dir, "premium-finance-audio.mp3");
      await writeFile(audioFile, await readAudioAsset(params.audioStoragePath));
      const longformVoices = params.voices
        .filter((voice) => !voice.isFullVoice)
        .map((voice) => ({
          sceneId: voice.sceneId,
          startTime: voice.startTime,
          endTime: voice.endTime,
          text: voice.text,
          isFullVoice: voice.isFullVoice,
        }));
      const rendered = await renderPremiumDynamicFinanceProduction({
        voices: longformVoices,
        durationMs: params.durationMs,
        topic: params.financeLongTopic,
        sourceAudioPath: audioFile,
        outputPath: join(dir, "premium-dynamic-finance.mp4"),
        customScriptProduction: params.financeLongCustomScriptProduction === true,
      });
      return {
        buffer: await readFile(rendered.outputPath),
        durationMs: rendered.durationMs,
      };
    } else if (coinOverviewLongMotion) {
      videoOnly = params.financeLongEditorialBlueprint
        ? await renderChainlinkEditorialVideoOnly({
          dir,
          voices: params.voices,
          sceneVisualDescriptions: params.sceneVisualDescriptions ?? [],
          durationMs: params.durationMs,
          width,
          height,
          frameRate: financeLongFrameRate,
        })
        : params.financeLongCoinOverviewVector
          ? await renderFinanceLongCoinOverviewVectorVideoOnly({
            dir,
            voices: params.voices,
            sceneVisualDescriptions: params.sceneVisualDescriptions ?? [],
            durationMs: params.durationMs,
            width,
            height,
            frameRate: financeLongFrameRate,
          })
        : await renderCoinOverviewLongInfographic({
          dir,
          voices: params.voices,
          sceneVisualDescriptions: params.sceneVisualDescriptions,
          durationMs: params.durationMs,
          width,
          height,
          financeLongV4: financeLongV4Motion,
          themeIndex: params.financeLongThemeIndex ?? 0,
          paletteMode: params.financeLongPaletteMode ?? "default",
          frameRate: financeLongFrameRate,
        });
    } else {
      const clipFiles: string[] = [];
      const transitionDurationMs = params.images.length > 1
        ? coinReviewMotion
          ? 650
          : financeLongDocumentary
            ? params.images.length > 24 ? 0 : 500
            : 140
        : 0;
      const clipDurationsMs: number[] = [];
      for (const [index, image] of params.images.entries()) {
        const visual = await readVisual(image);
        const imagePath = join(dir, `visual-${index}.${visual.kind === "video" ? "mp4" : "png"}`);
        await writeFile(imagePath, visual.buffer);
        const clip = join(dir, `clip-${index}.mp4`);
        const sceneVoice = params.voices.find((voice) => voice.sceneId === image.sceneId);
        const sceneDuration = Math.max(250, (sceneVoice?.endTime || params.durationMs) - (sceneVoice?.startTime || 0));
        const clipDuration = sceneDuration + (index < params.images.length - 1 ? transitionDurationMs : 0);
        const frames = Math.max(8, Math.round(clipDuration / 1000 * 30));
        const zoom = index % 2 === 0
          ? "min(zoom+0.0012,1.12)"
          : "max(zoom-0.0008,1.0)";
        const coinReviewProgress = `min(on/${frames},1)`;
        const coinReviewZoom = index % 2 === 0
          ? `1.025+0.075*${coinReviewProgress}`
          : `1.10-0.075*${coinReviewProgress}`;
        const coinReviewPhase = Math.max(60, Math.round(frames * 0.85));
        const driftX = index % 4 < 2 ? 1 : -1;
        const driftY = index % 2 === 0 ? -1 : 1;
        const coinReviewMotionFilter =
          `zoompan=z='${coinReviewZoom}':x='iw/2-(iw/zoom/2)+(${driftX})*sin(on/${coinReviewPhase})*iw*0.012'` +
          `:y='ih/2-(ih/zoom/2)+(${driftY})*sin(on/${coinReviewPhase})*ih*0.008':d=${frames}:s=${width}x${height}:fps=30`;
        const clipSeconds = (clipDuration / 1000).toFixed(3);
        const reviewMotionGraphics = coinReviewMotion
          ? `,drawbox=x='mod(t*${(width / Math.max(0.25, clipDuration / 1000)).toFixed(3)},${width})':y=0:w=3:h=${height}:color=0x5be3d1@0.12:t=fill` +
            `,drawbox=x=0:y=8:w='${width}*min(t/${clipSeconds},1)':h=3:color=0xd8ad4b@0.82:t=fill`
          : "";
        const standardMotion = index % 3 === 2
          ? `zoompan=z='${zoom}':x='iw/2-(iw/zoom/2)+sin(on/18)*8':y='ih/2-(ih/zoom/2)+cos(on/21)*8':d=${frames}:s=${width}x${height}:fps=30`
          : `zoompan=z='${zoom}':d=${frames}:s=${width}x${height}:fps=30`;
        const motion = coinReviewMotion ? coinReviewMotionFilter : standardMotion;
        const visualInput = visual.kind === "video"
          ? ["-stream_loop", "-1", "-i", imagePath]
          : ["-loop", "1", "-i", imagePath];
        const visualFilter = visual.kind === "video"
          ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=yuv420p${reviewMotionGraphics},fade=t=in:st=0:d=0.2`
          : `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},${motion},format=yuv420p${reviewMotionGraphics},fade=t=in:st=0:d=0.2`;
        await execFileAsync("ffmpeg", [
          "-y", ...visualInput, "-t", String(clipDuration / 1000),
          "-vf", visualFilter,
          "-an", "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", clip,
        ], { maxBuffer: 10 * 1024 * 1024 });
        clipFiles.push(clip);
        clipDurationsMs.push(clipDuration);
      }

      videoOnly = join(dir, "video-only.mp4");
      if (clipFiles.length > 24) {
        // A single xfade graph with dozens of inputs can exceed FFmpeg's
        // encoder/filter limits. The clips already share the same codec and
        // dimensions, so concat demuxing is safer for long author scripts.
        const concatVideoList = join(dir, "video-clips.txt");
        await writeFile(
          concatVideoList,
          clipFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"),
          "utf8",
        );
        await execFileAsync("ffmpeg", [
          "-y", "-f", "concat", "-safe", "0", "-i", concatVideoList,
          "-an", "-c", "copy", "-movflags", "+faststart", videoOnly,
        ], { maxBuffer: 10 * 1024 * 1024 });
      } else {
        const transitionNames = financeLongDocumentary
          ? ["fade", "fade", "wipeleft"]
          : ["slideleft", "slideright", "wipeleft", "wiperight", "circleopen", "fade"];
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
      }
    }
    const preserveSourceAudio = params.preserveAudioFromSourceVideo === true;
    const audioFile = join(dir, preserveSourceAudio ? "source-video.mp4" : "audio.mp3");
    if (preserveSourceAudio) {
      await copyAudioAssetToFile(params.audioStoragePath, audioFile);
    } else {
      await writeFile(audioFile, await readAudioAsset(params.audioStoragePath));
    }
    let videoInput = videoOnly;
    const captionsFile = join(dir, "captions.ass");
    const captionVoices = params.voices.map((voice) => ({
      sceneId: voice.sceneId,
      startTime: voice.startTime,
      endTime: voice.endTime,
      text: voice.text,
      isFullVoice: voice.isFullVoice,
      visualDescription: visualDescriptionByScene.get(voice.sceneId),
    }));
    const financeLongCaptions = financeLongV4Motion && !financeLongVectorMotion
      ? buildCoinOverviewLongCaptions({
        voices: captionVoices,
        beats: buildCoinOverviewLongPhraseBeats({
          voices: captionVoices,
          durationMs: params.durationMs,
          useEthereumMotionSequence: params.financeLongPaletteMode === "ethereum-motion",
        }),
        durationMs: params.durationMs,
        width,
        height,
        paletteMode: params.financeLongPaletteMode === "ethereum-motion"
          ? "ethereum-motion"
          : params.financeLongPaletteMode === "aptos" ? "aptos" : "finance-long-v4",
        themeIndex: params.financeLongThemeIndex ?? 0,
      })
      : null;
    const legacyLongCaptions = coinOverviewLongMotion && !financeLongV4Motion
      ? buildCoinOverviewLongPhraseCaptions({
        voices: captionVoices,
        durationMs: params.durationMs,
        width,
        height,
      })
      : null;
    const captions = financeLongVectorMotion
      ? ""
      : financeLongCaptions ?? legacyLongCaptions ?? buildWordCaptions(params.voices, params.durationMs, width, height);
    await writeFile(captionsFile, captions, "utf8");
    const mainOutput = join(dir, "main_video.mp4");
    const ffmpegArgs = ["-y", "-i", videoInput, "-i", audioFile];
    let videoMap = financeLongVectorMotion ? "0:v:0" : "[base]";
    let filterComplex = financeLongVectorMotion ? "" : `[0:v]subtitles=${captionsFile}[base]`;
    if (params.bannerStoragePath) {
      if (!filterComplex) filterComplex = "[0:v]null[base]";
      const bannerFile = join(dir, `story-banner.${params.bannerKind === "video" ? "mp4" : "png"}`);
      await writeFile(bannerFile, await readObject(params.bannerStoragePath));
      if (params.bannerKind === "video") {
        ffmpegArgs.push("-stream_loop", "-1", "-i", bannerFile);
      } else {
        ffmpegArgs.push("-loop", "1", "-i", bannerFile);
      }
      const keyFilter = params.bannerKind === "video" ? ",colorkey=0x00ff00:0.3:0.1" : "";
      filterComplex +=
        `${filterComplex ? ";" : ""}[2:v]scale=iw*min(${width}/iw\\,${height}/ih):ih*min(${width}/iw\\,${height}/ih),format=rgba${keyFilter}[story_banner]` +
        `;[base][story_banner]overlay=x=(W-w)/2:y=80:format=auto[story_video]`;
      videoMap = "[story_video]";
    }
    ffmpegArgs.push("-map", videoMap, "-map", "1:a:0", "-t", String(params.durationMs / 1000));
    if (filterComplex) ffmpegArgs.push("-filter_complex", filterComplex);
    ffmpegArgs.push(
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-r", String(financeLongFrameRate),
      ...(preserveSourceAudio ? [] : [
        "-af",
        "acompressor=threshold=0.08:ratio=2.5:attack=20:release=250:makeup=1.2,alimiter=limit=0.95",
      ]),
      "-c:a", preserveSourceAudio ? "copy" : "aac",
      ...(preserveSourceAudio ? [] : ["-b:a", "192k"]),
      "-movflags", "+faststart", mainOutput,
    );
    const financeLongFontConfig = params.financeLongPaletteMode === "ethereum-motion"
      ? await createFinanceLongMotionFontConfig(dir)
      : undefined;
    await execFileAsync("ffmpeg", ffmpegArgs, {
      maxBuffer: 10 * 1024 * 1024,
      ...(financeLongFontConfig ? { env: financeLongFontConfig.env } : {}),
    });
    const output = mainOutput;
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error", "-show_entries", "format=duration:stream=codec_name,width,height,r_frame_rate,codec_type",
      "-of", "json", output,
    ]);
    const probe = JSON.parse(stdout) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string; codec_name?: string; width?: number; height?: number; r_frame_rate?: string }> };
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
    if (
      video?.codec_name !== "h264"
      || video.width !== width
      || video.height !== height
      || video.r_frame_rate !== `${financeLongFrameRate}/1`
    ) {
      throw new Error(`Rendered video failed ${width}x${height} ${financeLongFrameRate} FPS H.264 validation`);
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