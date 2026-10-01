import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  buildLongformMicroBeats,
  createLongformVisualPlan,
  type LongformVoice,
  validateLongformVisualPlan,
} from "../src/lib/video-pipeline/longform-visual-director";
import {
  longformPilotFileName,
  renderLongformVisualVideo,
} from "../src/lib/video-pipeline/longform-visual-renderer";

type ApiVoiceRow = Record<string, unknown>;

function field(row: ApiVoiceRow, camelCase: string, snakeCase: string): unknown {
  return row[camelCase] ?? row[snakeCase];
}

function isFileAvailable(path: string): Promise<boolean> {
  return access(path).then(() => true, () => false);
}

async function main(): Promise<void> {
  const projectId = Number(process.argv[2] ?? 85);
  const durationMs = Number(process.argv[3] ?? 45_000);
  const sourceVideoPath = resolve(
    process.argv[4] ?? "../../attached_assets/generated_video/coin-overview-long/hype-overview-final.mp4",
  );
  const defaultOutput = resolve(
    `../../attached_assets/generated_video/coin-overview-long/${longformPilotFileName(sourceVideoPath, durationMs)}`,
  );
  const outputPath = resolve(process.argv[5] ?? defaultOutput);
  const apiBase = process.argv[6] ?? "http://127.0.0.1:8080";
  const planPath = resolve(process.argv[7] ?? `${outputPath}.plan.json`);

  if (!Number.isInteger(projectId) || projectId !== 85) {
    throw new Error("This isolated pilot is scoped to existing HYPE project 85.");
  }
  if (!Number.isInteger(durationMs) || durationMs < 30_000 || durationMs > 60_000) {
    throw new Error("Pilot duration must be between 30 and 60 seconds.");
  }
  if (sourceVideoPath === outputPath) {
    throw new Error("Pilot output must be a new file; the source video cannot be overwritten.");
  }
  if (await isFileAvailable(outputPath)) {
    throw new Error(`Refusing to overwrite existing output: ${outputPath}`);
  }
  const resumeFromPlan = await isFileAvailable(planPath);

  const sourceMetadata = await stat(sourceVideoPath);
  if (!sourceMetadata.isFile()) throw new Error(`Source video is not a regular file: ${sourceVideoPath}`);

  const voiceResponse = await fetch(new URL(`/api/projects/${projectId}/voice`, apiBase));
  if (!voiceResponse.ok) {
    throw new Error(`Could not load project ${projectId} narration (${voiceResponse.status}).`);
  }
  const rows = await voiceResponse.json() as ApiVoiceRow[];
  if (!Array.isArray(rows)) throw new Error("Project voice endpoint returned an invalid response.");

  const voices: LongformVoice[] = rows
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
      startTime: Number(field(row, "startTime", "start_time")),
      endTime: Number(field(row, "endTime", "end_time")),
      text: String(row.text),
      isFullVoice: false,
    }))
    .filter((voice) => (voice.startTime ?? 0) < durationMs)
    .map((voice) => ({
      ...voice,
      endTime: Math.min(durationMs, voice.endTime ?? durationMs),
    }))
    .filter((voice) => (voice.endTime ?? 0) > (voice.startTime ?? 0))
    .sort((left, right) => (left.startTime ?? 0) - (right.startTime ?? 0));

  if (!voices.length) throw new Error(`Project ${projectId} has no completed timed narration in the pilot range.`);

  let beats;
  if (resumeFromPlan) {
    const saved = JSON.parse(await readFile(planPath, "utf8")) as {
      projectId?: number;
      durationMs?: number;
      sourceVideoPath?: string;
      beats?: unknown;
    };
    if (
      saved.projectId !== projectId
      || saved.durationMs !== durationMs
      || saved.sourceVideoPath !== sourceVideoPath
    ) {
      throw new Error(`Existing visual plan does not match this pilot's source and duration: ${planPath}`);
    }
    beats = validateLongformVisualPlan(
      buildLongformMicroBeats({ voices, durationMs }),
      { beats: saved.beats },
    );
    console.log(JSON.stringify({ event: "longform-visual-plan-resumed", planPath, beats: beats.length }));
  } else {
    beats = await createLongformVisualPlan({
      voices,
      durationMs,
      context: [
        "Educational Russian-language long YouTube overview of Hyperliquid and its HYPE token.",
        "Project 85 approved voice timeline is the sole source for claims and on-screen phrases.",
        "Use cinematic metaphor and abstract visuals; do not add factual numbers, labels, logos, or recommendations.",
        "Create a fresh 16:9 visual language, separate from Shorts and previous financial-video treatments.",
      ].join(" "),
    });

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(planPath, JSON.stringify({
      projectId,
      durationMs,
      sourceVideoPath,
      sourceAudioPolicy: "Use only the source MP4 audio stream, copied without re-encoding.",
      beats,
    }, null, 2), { encoding: "utf8", flag: "wx" });
  }

  const result = await renderLongformVisualVideo({
    beats,
    durationMs,
    sourceVideoPath,
    outputPath,
  });

  console.log(JSON.stringify({
    ...result,
    projectId,
    planPath,
    sourceAudioPolicy: "Copied from source MP4 with -c:a copy",
    visualForms: [...new Set(beats.map((beat) => beat.visualForm))],
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});