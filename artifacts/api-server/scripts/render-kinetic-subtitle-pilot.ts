import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { transcribeSpeechWithTimestamps } from "../src/lib/audio-generation/elevenlabs-client";
import {
  alignKineticSubtitleWords,
  buildLongformKineticSubtitleAss,
  type KineticSubtitleAlignment,
  type KineticSubtitleVoice,
} from "../src/lib/video-pipeline/longform-kinetic-subtitles";
import { buildCoinOverviewLongPhraseBeats } from "../src/lib/video-pipeline/coin-overview-long-edit";
import { buildCoinOverviewLongScribeCaptions } from "../src/lib/video-pipeline/coin-overview-long-captions";
import {
  buildLongformMicroBeats,
  validateLongformVisualPlan,
} from "../src/lib/video-pipeline/longform-visual-director";
import {
  renderCoinOverviewLongPumpDynamicVideo,
  renderLongformVisualVideo,
} from "../src/lib/video-pipeline/longform-visual-renderer";

const execFileAsync = promisify(execFile);
type ApiVoiceRow = Record<string, unknown>;

function field(row: ApiVoiceRow, camelCase: string, snakeCase: string): unknown {
  return row[camelCase] ?? row[snakeCase];
}

function isAvailable(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

async function main(): Promise<void> {
  const projectId = Number(process.argv[2] ?? 85);
  const durationMs = Number(process.argv[3] ?? 45_000);
  const sourceVideoPath = resolve(
    process.argv[4] ?? "../../attached_assets/generated_video/coin-overview-long/hype-overview-final.mp4",
  );
  const outputPath = resolve(
    process.argv[5]
      ?? "../../attached_assets/generated_video/coin-overview-long/hype-overview-kinetic-subtitles-45s-test.mp4",
  );
  const apiBase = process.argv[6] ?? "http://127.0.0.1:8080";
  const planPath = resolve(
    process.argv[7]
      ?? "../../attached_assets/generated_video/coin-overview-long/hype-overview-final-new-visual-45s.mp4.plan.json",
  );
  const reusableAlignmentPath = process.argv[8] ? resolve(process.argv[8]) : undefined;
  const pumpDynamic = process.argv[9] === "pump-dynamic";
  const pumpDynamicAssetsDir = resolve(
    process.argv[10]
      ?? "../../attached_assets/generated_images/hype-pump-style-storyboard-v1/backgrounds",
  );
  const alignmentPath = `${outputPath}.alignment.json`;

  if (projectId !== 85) throw new Error("This isolated kinetic subtitle pilot is scoped to HYPE project 85.");
  if (!Number.isInteger(durationMs) || durationMs < 30_000 || durationMs > 60_000) {
    throw new Error("Kinetic subtitle pilot duration must be between 30 and 60 seconds.");
  }
  if (sourceVideoPath === outputPath) {
    throw new Error("Kinetic subtitle pilot output must not overwrite its source video.");
  }
  if (await isAvailable(outputPath)) {
    throw new Error(`Refusing to overwrite existing kinetic subtitle pilot: ${outputPath}`);
  }
  if (await isAvailable(alignmentPath)) {
    throw new Error(`Refusing to overwrite existing subtitle alignment report: ${alignmentPath}`);
  }
  const sourceInfo = await stat(sourceVideoPath);
  if (!sourceInfo.isFile()) throw new Error(`Source video is not a regular file: ${sourceVideoPath}`);

  const voiceResponse = await fetch(new URL(`/api/projects/${projectId}/voice`, apiBase));
  if (!voiceResponse.ok) throw new Error(`Could not load project ${projectId} narration (${voiceResponse.status}).`);
  const rows = await voiceResponse.json() as ApiVoiceRow[];
  if (!Array.isArray(rows)) throw new Error("Project voice endpoint returned an invalid response.");
  const voices: KineticSubtitleVoice[] = rows
    .filter((row) =>
      row.status === "completed"
      && field(row, "isActive", "is_active") === true
      && field(row, "isFullVoice", "is_full_voice") !== true
      && typeof row.text === "string"
      && Number.isFinite(field(row, "startTime", "start_time"))
      && Number.isFinite(field(row, "endTime", "end_time")),
    )
    .map((row) => ({
      sceneId: Number(field(row, "sceneId", "scene_id")),
      text: String(row.text),
      startTime: Number(field(row, "startTime", "start_time")),
      endTime: Number(field(row, "endTime", "end_time")),
      isFullVoice: false,
    }))
    .filter((voice) => voice.startTime! < durationMs && voice.endTime! > voice.startTime!)
    .sort((left, right) => left.startTime! - right.startTime!);
  if (!voices.length) throw new Error(`Project ${projectId} has no completed timed narration in the pilot range.`);

  const tempDir = await mkdtemp(resolve(tmpdir(), "kinetic-subtitle-pilot-"));
  try {
    let alignment: KineticSubtitleAlignment;
    if (reusableAlignmentPath) {
      const savedAlignment = JSON.parse(await readFile(reusableAlignmentPath, "utf8")) as {
        projectId?: number;
        durationMs?: number;
        sourceVideoPath?: string;
        expectedWordCount?: number;
        matchedWordCount?: number;
        interpolatedWordCount?: number;
        matchCoverage?: number;
        words?: KineticSubtitleAlignment["words"];
      };
      if (
        savedAlignment.projectId !== projectId
        || savedAlignment.durationMs !== durationMs
        || savedAlignment.sourceVideoPath !== sourceVideoPath
        || !Array.isArray(savedAlignment.words)
        || !savedAlignment.words.length
      ) {
        throw new Error(`Saved subtitle alignment does not match this pilot: ${reusableAlignmentPath}`);
      }
      alignment = {
        words: savedAlignment.words,
        expectedWordCount: Number(savedAlignment.expectedWordCount),
        matchedWordCount: Number(savedAlignment.matchedWordCount),
        interpolatedWordCount: Number(savedAlignment.interpolatedWordCount),
        matchCoverage: Number(savedAlignment.matchCoverage),
      };
      console.log(JSON.stringify({
        event: "longform-kinetic-subtitle-alignment-resumed",
        reusableAlignmentPath,
        words: alignment.words.length,
        matchCoverage: alignment.matchCoverage,
      }));
    } else {
      const speechPath = resolve(tempDir, "speech-for-alignment.mp3");
      await execFileAsync("ffmpeg", [
        "-y",
        "-i", sourceVideoPath,
        "-t", (durationMs / 1_000).toFixed(3),
        "-map", "0:a:0",
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-c:a", "libmp3lame",
        "-b:a", "64k",
        speechPath,
      ], { maxBuffer: 10 * 1024 * 1024 });

      const transcription = await transcribeSpeechWithTimestamps(
        await readFile(speechPath),
        "hype-kinetic-subtitle-pilot.mp3",
      );
      alignment = alignKineticSubtitleWords({
        voices,
        transcriptWords: transcription.words,
        durationMs,
      });
    }
    const subtitlePlan = pumpDynamic
      ? buildCoinOverviewLongScribeCaptions({
          words: alignment.words,
          durationMs,
          width: 1_920,
          height: 1_080,
          paletteMode: "pump-dynamic",
        })
      : buildLongformKineticSubtitleAss({
          words: alignment.words,
          durationMs,
          width: 1_920,
          height: 1_080,
        });
    if (subtitlePlan.maxWordsPerPhrase > 5) {
      throw new Error("Kinetic subtitle phrase exceeded the five-word limit.");
    }

    const result = pumpDynamic
      ? await renderCoinOverviewLongPumpDynamicVideo({
          beats: buildCoinOverviewLongPhraseBeats({
            voices: voices.map((voice, index) => ({
              sceneId: voice.sceneId ?? index + 1,
              startTime: voice.startTime,
              endTime: voice.endTime,
              text: voice.text,
              isFullVoice: false,
            })),
            durationMs,
          }),
          durationMs,
          sourceVideoPath,
          outputPath,
          kineticSubtitleWords: alignment.words,
          visualAssets: {
            photoBackgroundPath: join(pumpDynamicAssetsDir, "intro-phone-16x9.png"),
            introOverlayPath: join(pumpDynamicAssetsDir, "intro-orbit-overlay.png"),
            marketBackgroundPath: join(pumpDynamicAssetsDir, "market-diagonal.png"),
            hypeBackgroundPath: join(pumpDynamicAssetsDir, "hype-token-focus.png"),
            riskBackgroundPath: join(pumpDynamicAssetsDir, "risk-icon-selection.png"),
            exchangeBackgroundPath: join(pumpDynamicAssetsDir, "exchange-network.png"),
            contractBackgroundPath: join(pumpDynamicAssetsDir, "contract-loop.png"),
          },
        })
      : await (async () => {
          const savedPlan = JSON.parse(await readFile(planPath, "utf8")) as {
            projectId?: number;
            durationMs?: number;
            sourceVideoPath?: string;
            beats?: unknown;
          };
          if (
            savedPlan.projectId !== projectId
            || savedPlan.durationMs !== durationMs
            || savedPlan.sourceVideoPath !== sourceVideoPath
          ) {
            throw new Error(`Existing visual plan does not match this pilot's source and duration: ${planPath}`);
          }
          const beats = validateLongformVisualPlan(
            buildLongformMicroBeats({ voices, durationMs }),
            { beats: savedPlan.beats },
          );
          return renderLongformVisualVideo({
            beats,
            durationMs,
            sourceVideoPath,
            outputPath,
            kineticSubtitleWords: alignment.words,
          });
        })();
    await writeFile(alignmentPath, JSON.stringify({
      projectId,
      durationMs,
      sourceVideoPath,
      outputPath,
      timingSource: "ElevenLabs Scribe word timestamps aligned to approved project narration",
      renderStyle: pumpDynamic
        ? "pump-dynamic-approved-storyboard-v1"
        : "longform-kinetic-subtitles",
      expectedWordCount: alignment.expectedWordCount,
      matchedWordCount: alignment.matchedWordCount,
      interpolatedWordCount: alignment.interpolatedWordCount,
      matchCoverage: alignment.matchCoverage,
      phraseCount: subtitlePlan.phraseCount,
      maxWordsPerPhrase: subtitlePlan.maxWordsPerPhrase,
      words: alignment.words,
    }, null, 2), { encoding: "utf8", flag: "wx" });

    console.log(JSON.stringify({
      ...result,
      pilot: pumpDynamic
        ? "pump-dynamic-approved-storyboard-v1"
        : "longform-kinetic-subtitles",
      projectId,
      planPath,
      alignmentPath,
      subtitleAlignment: {
        expectedWordCount: alignment.expectedWordCount,
        matchedWordCount: alignment.matchedWordCount,
        interpolatedWordCount: alignment.interpolatedWordCount,
        matchCoverage: Number(alignment.matchCoverage.toFixed(4)),
        phraseCount: subtitlePlan.phraseCount,
        maxWordsPerPhrase: subtitlePlan.maxWordsPerPhrase,
         animationPresets: pumpDynamic ? 6 : 5,
      },
      sourceAudioPolicy: "Copied from source MP4 with -c:a copy",
    }, null, 2));
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exitCode = 1;
});