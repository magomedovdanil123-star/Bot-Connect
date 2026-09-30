import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { renderPumpFilmSceneSvg } from "./graphics";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd(), "../..");
const scriptPath = resolve(root, "research/pump-film-script.json");
const planPath = resolve(root, "research/pump-film-visual-plan.json");
const audioDir = resolve(root, "attached_assets/generated_audio/pump-film-2026-09-30");
const voicePath = resolve(audioDir, "pump-film-voice.mp3");
const voiceManifestPath = resolve(audioDir, "voice.json");
const alignmentPath = resolve(audioDir, "alignment.json");
const musicPath = resolve(root, "attached_assets/музыка_для_видео_1790775701649.mp3");
const outputDir = resolve(root, "attached_assets/generated_video/pump-film-2026-09-30");
const frameDir = resolve(outputDir, "frames");
const clipDir = resolve(outputDir, "clips");
const fps = 30;
const outputPath = resolve(outputDir, "pump-film-research-2026-09-30.mp4");

type ScriptScene = {
  scene_number: number;
  chapter: string;
  source_keys: string[];
};

type Script = {
  title: string;
  scenes: ScriptScene[];
};

type PlanCue = {
  sentence_number: number;
  text: string;
};

type PlanScene = {
  scene_number: number;
  title: string;
  visual: string;
  description: string;
  cues: PlanCue[];
};

type VisualPlan = {
  scenes: PlanScene[];
};

type TimedSentence = {
  scene_number: number;
  sentence_number: number;
  text: string;
  start: number;
  end: number;
};

type Alignment = {
  audio_duration_seconds: number;
  script_alignment: {
    match_ratio: number;
  };
  sentences: TimedSentence[];
};

type VoiceManifest = {
  duration_seconds: number;
  provider: string;
  word_count: number;
};

const sourceLabels: Record<string, string> = {
  "pump-token-page": "Pump.fun • проектная страница и условия",
  "coingecko-pump": "CoinGecko • снимок 30.09.2026, 13:53 UTC",
  "defillama-pump-fees": "DefiLlama • комиссии за 30 дней",
  "pump-bonding-curve": "Pump.fun • описание bonding curve",
  "pump-fees": "Pump.fun • документация комиссий, 20.05.2026",
  "pump-buyback-announcement": "Pump.fun • объявление программы, 28.04.2026",
  "blockworks-pump-filing": "Blockworks • частичный filing, сентябрь 2026",
  "tokenomist-pump": "Tokenomist • предложение и разблокировки",
  "raydium-launchlab": "Raydium • официальная страница LaunchLab",
  "wolfpopper-pump-case": "Wolf Popper • сообщение юристов истцов, 31.08.2026",
};

function assTime(seconds: number): string {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const wholeSeconds = Math.floor(centiseconds / 100);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  const fraction = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}.${String(fraction).padStart(2, "0")}`;
}

function escapeAssText(text: string): string {
  return text
    .replace(/\\/gu, "\\\\")
    .replace(/\{/gu, "\\{")
    .replace(/\}/gu, "\\}");
}

function assFile(events: Array<{ start: number; end: number; text: string }>): string {
  const header = [
    "[Script Info]",
    "Title: PUMP research film - timed phrase callouts",
    "ScriptType: v4.00+",
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "",
    "[V4+ Styles]",
    "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding",
    "Style: Cue,DejaVu Sans,39,&H00F2F6F7,&H000000FF,&H80111B23,&HA6111B23,-1,0,0,0,100,100,0,0,3,12,0,2,90,90,112,1",
    "",
    "[Events]",
    "Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text",
  ];
  const lines = events.map((event) =>
    `Dialogue: 0,${assTime(event.start)},${assTime(event.end)},Cue,,0,0,0,,{\\fad(180,260)}${escapeAssText(event.text)}`,
  );
  return `${header.join("\n")}\n${lines.join("\n")}\n`;
}

function formatSourceLabel(keys: string[]): string {
  const labels = [...new Set(keys)]
    .map((key) => sourceLabels[key] || key.replace(/-/gu, " "))
    ;
  return labels.length > 4
    ? "Источники указаны в соответствующих главах"
    : labels.join("  •  ");
}

async function run(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(command, args, { maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const detail = error as Error & { stderr?: string; stdout?: string };
    const stderr = detail.stderr?.trim();
    throw new Error(`${command} failed: ${detail.message}${stderr ? `\n${stderr.slice(-6000)}` : ""}`);
  }
}

async function main(): Promise<void> {
  const onlySceneArg = process.argv.find((argument) => argument.startsWith("--only-scene="));
  const onlySceneNumber = onlySceneArg ? Number(onlySceneArg.split("=")[1]) : undefined;
  if (onlySceneArg && (!Number.isInteger(onlySceneNumber) || onlySceneNumber! < 1)) {
    throw new Error("Expected --only-scene=<positive scene number>");
  }
  const [script, plan, alignment, voiceManifest] = await Promise.all([
    readFile(scriptPath, "utf8").then((value) => JSON.parse(value) as Script),
    readFile(planPath, "utf8").then((value) => JSON.parse(value) as VisualPlan),
    readFile(alignmentPath, "utf8").then((value) => JSON.parse(value) as Alignment),
    readFile(voiceManifestPath, "utf8").then((value) => JSON.parse(value) as VoiceManifest),
  ]);
  if (
    script.scenes.length !== 20
    || plan.scenes.length !== 20
    || alignment.script_alignment.match_ratio < 0.9
  ) {
    throw new Error("PUMP film input validation failed: expected 20 scenes and at least 90% script alignment");
  }
  if (onlySceneNumber !== undefined && !plan.scenes.some((scene) => scene.scene_number === onlySceneNumber)) {
    throw new Error(`Visual plan does not contain scene ${onlySceneNumber}`);
  }
  if (Math.abs(alignment.audio_duration_seconds - voiceManifest.duration_seconds) > 1) {
    throw new Error("Word alignment and voice manifest durations differ by more than one second");
  }

  const scriptScenes = new Map(script.scenes.map((scene) => [scene.scene_number, scene]));
  const sentenceMap = new Map(
    alignment.sentences.map((sentence) => [`${sentence.scene_number}:${sentence.sentence_number}`, sentence]),
  );
  const firstSentenceByScene = new Map<number, TimedSentence>();
  for (const scene of plan.scenes) {
    const firstSentence = alignment.sentences.find((sentence) => sentence.scene_number === scene.scene_number);
    if (!firstSentence) throw new Error(`Missing audio timing for scene ${scene.scene_number}`);
    firstSentenceByScene.set(scene.scene_number, firstSentence);
    for (const cue of scene.cues) {
      if (!sentenceMap.has(`${scene.scene_number}:${cue.sentence_number}`)) {
        throw new Error(`Missing phrase timing for scene ${scene.scene_number}, sentence ${cue.sentence_number}`);
      }
    }
  }

  await Promise.all([
    mkdir(frameDir, { recursive: true }),
    mkdir(clipDir, { recursive: true }),
  ]);
  const durationSeconds = voiceManifest.duration_seconds;
  const totalFrames = Math.round(durationSeconds * fps);
  const renderRows: Array<{
    scene_number: number;
    start_seconds: number;
    end_seconds: number;
    frames: number;
    visual: string;
    cues: Array<{ sentence_number: number; phrase: string; overlay: string; start: number; end: number }>;
  }> = [];
  const clipPaths: string[] = [];

  for (const [index, scene] of plan.scenes.entries()) {
    const scriptScene = scriptScenes.get(scene.scene_number);
    if (!scriptScene) throw new Error(`Script is missing scene ${scene.scene_number}`);
    const sentenceStart = firstSentenceByScene.get(scene.scene_number)!;
    const nextScene = plan.scenes[index + 1];
    const nextSentence = nextScene ? firstSentenceByScene.get(nextScene.scene_number)! : undefined;
    const startFrame = index === 0 ? 0 : Math.round(sentenceStart.start * fps);
    const endFrame = nextSentence ? Math.round(nextSentence.start * fps) : totalFrames;
    const frameCount = endFrame - startFrame;
    if (frameCount < fps * 2) {
      throw new Error(`Scene ${scene.scene_number} has an implausibly short video interval`);
    }
    const clipStart = startFrame / fps;
    const clipEnd = endFrame / fps;
    const cueRows = [...scene.cues]
      .sort((a, b) => a.sentence_number - b.sentence_number)
      .map((cue, cueIndex, cues) => {
        const sentence = sentenceMap.get(`${scene.scene_number}:${cue.sentence_number}`)!;
        const nextCue = cues[cueIndex + 1];
        const nextCueSentence = nextCue
          ? sentenceMap.get(`${scene.scene_number}:${nextCue.sentence_number}`)!
          : undefined;
        const nextCueStart = nextCueSentence?.start ?? clipEnd;
        const globalEnd = Math.min(
          Math.max(sentence.end + 0.8, sentence.start + 1.4),
          nextCueStart - 0.15,
          clipEnd - 0.12,
        );
        return {
          sentence_number: cue.sentence_number,
          phrase: sentence.text,
          overlay: cue.text,
          start: Math.max(0, sentence.start - clipStart),
          end: Math.max(0, globalEnd - clipStart),
        };
      })
      .filter((cue) => cue.end > cue.start + 0.3);

    const svgPath = resolve(frameDir, `scene-${String(scene.scene_number).padStart(2, "0")}.svg`);
    const pngPath = resolve(frameDir, `scene-${String(scene.scene_number).padStart(2, "0")}.png`);
    const assPath = resolve(frameDir, `scene-${String(scene.scene_number).padStart(2, "0")}.ass`);
    const clipPath = resolve(clipDir, `scene-${String(scene.scene_number).padStart(2, "0")}.mp4`);
    const timelineRow = {
      scene_number: scene.scene_number,
      start_seconds: clipStart,
      end_seconds: clipEnd,
      frames: frameCount,
      visual: scene.visual,
      cues: cueRows.map((cue) => ({
        sentence_number: cue.sentence_number,
        phrase: cue.phrase,
        overlay: cue.overlay,
        start: Number((clipStart + cue.start).toFixed(2)),
        end: Number((clipStart + cue.end).toFixed(2)),
      })),
    };
    if (onlySceneNumber !== undefined && scene.scene_number !== onlySceneNumber) {
      try {
        await access(clipPath);
      } catch {
        throw new Error(`Cannot reuse missing scene clip: ${clipPath}`);
      }
      clipPaths.push(clipPath);
      renderRows.push(timelineRow);
      console.log(`Reused visual chapter ${index + 1}/${plan.scenes.length}`);
      continue;
    }
    const svg = renderPumpFilmSceneSvg(
      {
        scene_number: scene.scene_number,
        title: scene.title,
        visual: scene.visual,
        description: scene.description,
      },
      formatSourceLabel(scriptScene.source_keys),
      plan.scenes.length,
    );
    await writeFile(svgPath, svg, "utf8");
    await run("convert", ["-background", "#0A1117", svgPath, pngPath]);
    const events = cueRows.map((cue) => ({ start: cue.start, end: cue.end, text: cue.overlay }));
    await writeFile(assPath, assFile(events), "utf8");

    const filter = [
      "zoompan=z='min(1+0.00002*on,1.025)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30",
      `subtitles=${assPath}`,
      "format=yuv420p",
    ].join(",");
    await run("ffmpeg", [
      "-y",
      "-loglevel", "error",
      "-loop", "1",
      "-framerate", String(fps),
      "-i", pngPath,
      "-vf", filter,
      "-frames:v", String(frameCount),
      "-an",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-tune", "stillimage",
      "-crf", "21",
      "-profile:v", "high",
      "-level:v", "4.1",
      "-pix_fmt", "yuv420p",
      "-r", String(fps),
      "-movflags", "+faststart",
      clipPath,
    ]);
    clipPaths.push(clipPath);
    renderRows.push(timelineRow);
    console.log(`Rendered visual chapter ${index + 1}/${plan.scenes.length}`);
  }

  const concatPath = resolve(outputDir, "clips.txt");
  const concatContents = clipPaths.map((path) => `file '${path}'`).join("\n") + "\n";
  await writeFile(concatPath, concatContents, "utf8");
  const videoOnlyPath = resolve(outputDir, "pump-film-visuals.mp4");
  await run("ffmpeg", [
    "-y",
    "-loglevel", "error",
    "-f", "concat",
    "-safe", "0",
    "-i", concatPath,
    "-c:v", "copy",
    "-movflags", "+faststart",
    videoOnlyPath,
  ]);

  const timelinePath = resolve(outputDir, "phrase-timeline.json");
  await writeFile(timelinePath, JSON.stringify({
    generated_at: new Date().toISOString(),
    duration_seconds: durationSeconds,
    fps,
    resolution: "1920x1080",
    alignment_match_ratio: alignment.script_alignment.match_ratio,
    scenes: renderRows,
  }, null, 2), "utf8");

  const musicVolume = 0.14;
  const fadeOutStart = Math.max(0, durationSeconds - 6);
  const filterComplex = [
    `[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS,asplit=2[voice][key]`,
    `[2:a]aresample=48000,aformat=channel_layouts=stereo,atrim=duration=${durationSeconds},asetpts=PTS-STARTPTS,volume=${musicVolume},afade=t=in:st=0:d=3,afade=t=out:st=${fadeOutStart}:d=6[music]`,
    "[music][key]sidechaincompress=threshold=0.025:ratio=9:attack=20:release=550[ducked]",
    "[voice][ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.96[outa]",
  ].join(";");
  await run("ffmpeg", [
    "-y",
    "-loglevel", "error",
    "-i", videoOnlyPath,
    "-i", voicePath,
    "-stream_loop", "-1",
    "-i", musicPath,
    "-filter_complex", filterComplex,
    "-map", "0:v:0",
    "-map", "[outa]",
    "-t", durationSeconds.toFixed(3),
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-movflags", "+faststart",
    "-metadata", "title=PUMP: у платформы есть доход — принадлежит ли он токену?",
    outputPath,
  ]);

  const probe = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration,size:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels",
    "-of", "json",
    outputPath,
  ]);
  const media = JSON.parse(probe.stdout) as {
    format?: { duration?: string; size?: string };
    streams?: Array<Record<string, string | number>>;
  };
  const actualDuration = Number(media.format?.duration || 0);
  if (!actualDuration || Math.abs(actualDuration - durationSeconds) > 1) {
    throw new Error(`Rendered MP4 duration mismatch: expected ${durationSeconds}s, got ${actualDuration}s`);
  }
  if (!media.streams?.some((stream) => stream.codec_type === "video" && stream.width === 1920 && stream.height === 1080)) {
    throw new Error("Rendered MP4 is missing the expected 1920x1080 video stream");
  }
  if (!media.streams?.some((stream) => stream.codec_type === "audio")) {
    throw new Error("Rendered MP4 is missing its mixed audio stream");
  }
  console.log(JSON.stringify({
    output: outputPath,
    timeline: timelinePath,
    scenes: plan.scenes.length,
    timedPhraseCues: renderRows.reduce((sum, scene) => sum + scene.cues.length, 0),
    durationSeconds: Number(actualDuration.toFixed(2)),
    sizeMB: Number((Number(media.format?.size || 0) / (1024 * 1024)).toFixed(1)),
    streams: media.streams,
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown PUMP film render error");
  process.exit(1);
});