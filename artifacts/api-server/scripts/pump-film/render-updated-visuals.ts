import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { sfxProvider } from "../../src/lib/audio-design/openverse-provider.ts";
import {
  calmCoinOverviewLongSoundPlan,
  selectCoinOverviewLongSfxAsset,
} from "../../src/lib/audio-design/coin-overview-long-sfx.ts";
import type { AudioAsset, SoundDesignPlan } from "../../src/lib/audio-design/types.ts";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd(), "../..");
const filmDir = join(root, "attached_assets/generated_video/pump-film-2026-09-30");
const sourcePath = join(filmDir, "pump-film-research-2026-09-30.mp4");
const timelinePath = join(filmDir, "phrase-timeline.json");
const outputPath = join(filmDir, "pump-film-research-2026-09-30-dynamic-inserts.mp4");
const videoOnlyPath = join(filmDir, "pump-film-dynamic-inserts-only.mp4");
const clipDir = join(filmDir, "clips-dynamic-inserts");
const sfxDir = join(filmDir, "sfx-openverse-cc0-pdm");
const fps = 30;
const fontFile = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const MAX_OUTPUT_BYTES = 49_000_000;

type TimelineScene = {
  scene_number: number;
  start_seconds: number;
  end_seconds: number;
  frames: number;
  visual: string;
  cues?: Array<{
    phrase: string;
    start: number;
    end: number;
  }>;
};

type SketchStyle = "flow" | "separate" | "timeline" | "branches" | "checklist";

type SketchInsert = {
  style: SketchStyle;
  cue: RegExp;
  labels: string[];
};

type ScheduledSfx = {
  sceneNumber: number;
  localStart: number;
  globalStart: number;
  kind: "whoosh" | "drawing" | "digital";
  volume: number;
  clipSeconds: number;
};

type DownloadedSfx = ScheduledSfx & {
  path: string;
  asset: AudioAsset;
};

const SKETCH_INSERTS: Record<number, SketchInsert> = {
  1: { style: "separate", cue: /three different things|смешать три разных вещи/i, labels: ["ПЛОЩАДКА", "СПРОС", "ПРАВА ТОКЕНА"] },
  2: { style: "flow", cue: /технический порог запуска/i, labels: ["ЗАПУСК", "ТОРГИ", "ПРАВИЛА"] },
  3: { style: "flow", cue: /добавляют спрос|покупатели добавляют/i, labels: ["ПОКУПКИ", "ФОРМУЛА", "ПРОДАЖИ"] },
  4: { style: "flow", cue: /выпуском или graduation/i, labels: ["BONDING CURVE", "ПОРОГ", "PUMPSWAP"] },
  5: { style: "flow", cue: /комиссию создателя|протокольную комиссию/i, labels: ["СДЕЛКА", "КОМИССИЯ", "ПОЛУЧАТЕЛИ"] },
  6: { style: "separate", cue: /комиссии, а не чистая прибыль/i, labels: ["КОМИССИИ", "ПРИБЫЛЬ", "ПРАВА ТОКЕНА"] },
  7: { style: "separate", cue: /разница между.*бизнес/i, labels: ["БИЗНЕС ПЛАТФОРМЫ", "УСЛОВИЯ ТОКЕНА", "НЕ РАВНО"] },
  8: { style: "timeline", cue: /программу выкупа и сжигания/i, labels: ["ОБЪЯВЛЕНА", "ОГРАНИЧЕННЫЙ СРОК", "УСЛОВИЯ ПРОЕКТА"] },
  9: { style: "flow", cue: /проверить транзакции/i, labels: ["ЗАЯВЛЕНИЕ", "ТРАНЗАКЦИИ", "МЕТОДИКА"] },
  10: { style: "separate", cue: /разные определения/i, labels: ["ПАНЕЛЬ ПРОЕКТА", "DEFI LLAMA", "РАЗНЫЕ МЕТОДИКИ"] },
  11: { style: "flow", cue: /максимальный объём PUMP/i, labels: ["МАКСИМУМ", "КАТЕГОРИИ", "ЧАСТИЧНОЕ РАСКРЫТИЕ"] },
  12: { style: "flow", cue: /фактический график переводов/i, labels: ["КАТЕГОРИИ", "ПОЛУЧАТЕЛИ", "ПЕРЕВОДЫ"] },
  13: { style: "separate", cue: /разблокировано.*разные категории/i, labels: ["PUMP.FUN", "COINGECKO", "TOKENOMIST"] },
  14: { style: "flow", cue: /не доказывают рост пользователей/i, labels: ["ПОКУПАТЕЛИ", "ТОРГИ", "ПРОДАВЦЫ"] },
  15: { style: "flow", cue: /цена на выбранное предложение/i, labels: ["ЦЕНА", "ПРЕДЛОЖЕНИЕ", "РАЗНЫЕ МЕТОДИКИ"] },
  16: { style: "flow", cue: /конкурирующих механизмов/i, labels: ["PUMP.FUN", "LAUNCHLAB", "ВЫБОР ПОЛЬЗОВАТЕЛЯ"] },
  17: { style: "timeline", cue: /требования.*продолжить рассмотрение/i, labels: ["31.08.2026", "РАССМОТРЕНИЕ", "ДЕЛО НЕ ЗАВЕРШЕНО"] },
  18: { style: "branches", cue: /создатели и трейдеры возвращаться|конкурирующие продукты.*судебного процесса/i, labels: ["СПРОС", "РЫНОК", "ДАННЫЕ", "СУД"] },
  19: { style: "branches", cue: /сильном операционном сценарии/i, labels: ["СИЛЬНЫЙ", "НЕЙТРАЛЬНЫЙ", "СЛАБЫЙ"] },
  20: { style: "checklist", cue: /следите за комиссиями/i, labels: ["КОМИССИИ", "ВЫКУПЫ", "ПРЕДЛОЖЕНИЕ", "КОНКУРЕНЦИЯ И СУД"] },
};

const SFX_KIND_BY_SCENE: Record<number, ScheduledSfx["kind"]> = {
  1: "drawing",
  3: "digital",
  4: "whoosh",
  6: "digital",
  8: "drawing",
  9: "digital",
  10: "whoosh",
  13: "digital",
  16: "whoosh",
  18: "drawing",
  20: "whoosh",
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
  const sketch = buildSketchFilters(scene, accent);
  return `${camera},${progressBar}${sketch ? `,${sketch}` : ""},format=yuv420p`;
}

function ffTime(value: number): string {
  return value.toFixed(3);
}

function enableBetween(start: number, end: number): string {
  return `between(t\\,${ffTime(start)}\\,${ffTime(end)})`;
}

function animatedHorizontalLine(
  x: number,
  y: number,
  width: number,
  color: string,
  start: number,
  end: number,
  revealSeconds = 0.5,
): string {
  const widthExpr = `max(0\\,min(${width}\\,(t-${ffTime(start)})*${width}/${revealSeconds}))`;
  return `drawbox=x=${x}:y=${y}:w='${widthExpr}':h=3:color=${color}@0.88:t=fill:enable='${enableBetween(start, end)}'`;
}

function animatedVerticalLine(
  x: number,
  y: number,
  height: number,
  color: string,
  start: number,
  end: number,
  revealSeconds = 0.35,
): string {
  const heightExpr = `max(0\\,min(${height}\\,(t-${ffTime(start)})*${height}/${revealSeconds}))`;
  return `drawbox=x=${x}:y=${y}:w=3:h='${heightExpr}':color=${color}@0.88:t=fill:enable='${enableBetween(start, end)}'`;
}

function sketchText(
  text: string,
  x: number,
  y: number,
  color: string,
  start: number,
  end: number,
  fontSize = 17,
  centered = true,
): string {
  const safeText = text.replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll(":", "\\:");
  const xExpr = centered ? `'${x}-text_w/2'` : String(x);
  return `drawtext=fontfile=${fontFile}:text='${safeText}':x=${xExpr}:y=${y}:fontsize=${fontSize}:fontcolor=${color}@0.92:enable='${enableBetween(start, end)}'`;
}

function sketchNode(x: number, color: string, start: number, end: number, size = 13): string {
  return `drawbox=x=${x - Math.floor(size / 2)}:y=710:w=${size}:h=${size}:color=${color}@0.96:t=fill:enable='${enableBetween(start, end)}'`;
}

function chooseSketchStart(scene: TimelineScene, insert: SketchInsert): number {
  const matchingCue = scene.cues?.find((cue) => insert.cue.test(cue.phrase));
  const cue = matchingCue || scene.cues?.[Math.floor((scene.cues.length || 1) / 2)];
  const relativeCueStart = cue ? cue.start - scene.start_seconds : (scene.end_seconds - scene.start_seconds) * 0.52;
  const latestSafeStart = Math.max(0, scene.end_seconds - scene.start_seconds - 6.2);
  return Math.max(0.25, Math.min(latestSafeStart, relativeCueStart + 0.25));
}

function buildSketchFilters(scene: TimelineScene, color: string): string {
  const insert = SKETCH_INSERTS[scene.scene_number];
  if (!insert) return "";
  const start = chooseSketchStart(scene, insert);
  const end = Math.min(scene.frames / fps - 0.15, start + 5.8);
  const filters: string[] = [];

  if (insert.style === "flow" || insert.style === "separate" || insert.style === "timeline") {
    const centers = insert.labels.length === 2 ? [590, 1330] : [430, 960, 1490];
    const labelY = insert.style === "timeline" ? 674 : 752;
    if (insert.style === "timeline") {
      filters.push(animatedHorizontalLine(centers[0]!, 716, centers.at(-1)! - centers[0]!, color, start, end, 0.8));
    }
    if (insert.style === "flow") {
      for (let i = 0; i < centers.length - 1; i += 1) {
        const lineStart = start + 0.18 + i * 0.74;
        filters.push(animatedHorizontalLine(centers[i]! + 13, 715, centers[i + 1]! - centers[i]! - 26, color, lineStart, end, 0.54));
        filters.push(sketchText("›", (centers[i]! + centers[i + 1]!) / 2 - 3, 723, color, lineStart + 0.32, end, 26));
      }
    } else if (insert.style === "separate") {
      const splitGaps = centers.slice(0, -1).map((x, i) => (x + centers[i + 1]!) / 2);
      for (const [index, x] of splitGaps.entries()) {
        filters.push(sketchText("≠", x, 723, "0xff7185", start + 0.72 + index * 0.5, end, 23));
      }
    }
    for (const [index, center] of centers.entries()) {
      const nodeAt = start + 0.15 + index * 0.78;
      filters.push(sketchNode(center, color, nodeAt, end, insert.style === "timeline" ? 15 : 13));
      filters.push(sketchText(insert.labels[index]!, center, labelY, color, nodeAt + 0.28, end, insert.labels[index]!.length > 18 ? 16 : 20));
    }
    if (insert.style === "timeline") {
      filters.push(animatedVerticalLine(centers[0]!, 706, 20, color, start + 0.15, end));
      filters.push(animatedVerticalLine(centers[1]!, 706, 20, color, start + 0.85, end));
      filters.push(animatedVerticalLine(centers[2]!, 706, 20, color, start + 1.55, end));
    }
    return filters.join(",");
  }

  if (insert.style === "branches") {
    const centers = insert.labels.length === 4 ? [390, 770, 1150, 1530] : [500, 960, 1420];
    const branchColor = color;
    const spineY = 704;
    filters.push(animatedHorizontalLine(centers[0]!, spineY, centers.at(-1)! - centers[0]!, branchColor, start + 0.5, end, 0.9));
    const anchorX = centers.length === 4 ? 960 : centers[1]!;
    filters.push(animatedVerticalLine(anchorX, 690, 25, branchColor, start + 0.12, end));
    for (const [index, center] of centers.entries()) {
      const nodeAt = start + 0.7 + index * 0.42;
      filters.push(animatedVerticalLine(center, spineY, 15, branchColor, nodeAt, end, 0.22));
      filters.push(sketchNode(center, branchColor, nodeAt + 0.18, end, 12));
      filters.push(sketchText(insert.labels[index]!, center, 752, branchColor, nodeAt + 0.4, end, insert.labels[index]!.length > 16 ? 15 : 19));
    }
    if (centers.length === 4) {
      filters.push(sketchText("ВОПРОСЫ PUMP", 960, 674, "0xff7185", start + 0.4, end, 18));
    } else {
      filters.push(sketchText("РАМКА ПРОВЕРКИ", 960, 674, "0xffbf69", start + 0.4, end, 18));
    }
    return filters.join(",");
  }

  const centers = [320, 750, 1180, 1610];
  const boxAt = centers.map((_, index) => start + 0.18 + index * 0.48);
  for (const [index, center] of centers.entries()) {
    const boxColor = index === 0 ? color : "0x80e0b0";
    filters.push(`drawbox=x=${center - 104}:y=700:w=208:h=42:color=${boxColor}@0.84:t=2:enable='${enableBetween(boxAt[index]!, end)}'`);
    filters.push(sketchText("✓", center - 90, 731, boxColor, boxAt[index]! + 0.22, end, 18, false));
    filters.push(sketchText(insert.labels[index]!, center + 4, 727, boxColor, boxAt[index]! + 0.35, end, insert.labels[index]!.length > 17 ? 14 : 16, false));
  }
  return filters.join(",");
}

function makeSoundDesignPlan(scenes: TimelineScene[]): SoundDesignPlan {
  const candidateScenes = scenes.map((scene) => {
    const kind = SFX_KIND_BY_SCENE[scene.scene_number];
    const insert = SKETCH_INSERTS[scene.scene_number];
    const localStart = insert ? chooseSketchStart(scene, insert) + 0.12 : (scene.end_seconds - scene.start_seconds) * 0.5;
    return {
      scene_id: scene.scene_number,
      start_time: Math.round(scene.start_seconds * 1000),
      end_time: Math.round(scene.end_seconds * 1000),
      music: {
        enabled: false,
        mood: "documentary" as const,
        energy: 0.2,
        category: "none",
        volume: 0,
      },
      sfx: kind
        ? [{
          type: kind === "drawing" ? "pencil drawing" : kind === "digital" ? "digital click" : "whoosh transition",
          query: kind === "drawing" ? "pencil drawing" : kind === "digital" ? "click" : "whoosh",
          start_time: Math.round((scene.start_seconds + localStart) * 1000),
          volume: 0.16,
        }]
        : [],
      ambience: { enabled: false, type: "none", query: "none", volume: 0.03 },
    };
  });
  return calmCoinOverviewLongSoundPlan({
    project_id: 1,
    overall: { mood: "documentary", energy: 0.2, tension: 0.1, music_style: "preserve source mix" },
    scenes: candidateScenes,
  });
}

async function fetchSfxForPlan(scenes: TimelineScene[]): Promise<DownloadedSfx[]> {
  await mkdir(sfxDir, { recursive: true });
  const plan = makeSoundDesignPlan(scenes);
  const usedAssets = new Set<string>();
  const downloaded: DownloadedSfx[] = [];
  for (const scenePlan of plan.scenes) {
    for (const effect of scenePlan.sfx) {
      const kind = effect.type.includes("pencil") ? "drawing" : effect.type.includes("digital") ? "digital" : "whoosh";
      const queries = kind === "drawing"
        ? ["pencil drawing", "paper drawing"]
        : kind === "digital"
          ? ["click", "minimal UI pack"]
          : ["whoosh", "swish"];
      let asset: AudioAsset | undefined;
      for (const query of queries) {
        const candidates = await sfxProvider.search({ query, limit: 20, license: "cc0,pdm" });
        asset = selectCoinOverviewLongSfxAsset(candidates, effect, usedAssets);
        if (asset) break;
      }
      if (!asset) throw new Error(`No safe CC0/PDM Openverse sound effect found for ${kind}`);
      const scene = scenes.find((candidate) => candidate.scene_number === scenePlan.scene_id)!;
      const buffer = await sfxProvider.download(asset);
      const index = downloaded.length + 1;
      const path = join(sfxDir, `cue-${String(index).padStart(2, "0")}-${kind}.mp3`);
      await writeFile(path, buffer);
      downloaded.push({
        sceneNumber: scene.scene_number,
        localStart: effect.start_time / 1000 - scene.start_seconds,
        globalStart: effect.start_time / 1000,
        kind,
        volume: kind === "drawing" ? 0.052 : kind === "whoosh" ? 0.06 : 0.048,
        clipSeconds: kind === "drawing" ? 1.35 : kind === "whoosh" ? 1.5 : 0.72,
        path,
        asset,
      });
      console.log(`Downloaded ${kind} cue from Openverse: ${asset.title} (${asset.license})`);
    }
  }
  if (downloaded.length < 6) {
    throw new Error(`Expected a sparse but distributed Openverse sound bed; only ${downloaded.length} safe cues were selected`);
  }
  return downloaded;
}

function audioFilterGraph(cues: DownloadedSfx[]): string {
  const inputs: string[] = ["[1:a]aresample=48000[sourceAudio]"];
  for (const [index, cue] of cues.entries()) {
    const inputIndex = index + 2;
    const fadeOutStart = Math.max(0.12, cue.clipSeconds - 0.18);
    const delayMs = Math.round(cue.globalStart * 1000);
    inputs.push(
      `[${inputIndex}:a]atrim=start=0:duration=${cue.clipSeconds.toFixed(3)},asetpts=PTS-STARTPTS,aresample=48000,` +
      `afade=t=in:st=0:d=0.04,afade=t=out:st=${fadeOutStart.toFixed(3)}:d=0.16,volume=${cue.volume},adelay=${delayMs}|${delayMs}[sfx${index}]`,
    );
  }
  const allInputs = ["[sourceAudio]", ...cues.map((_, index) => `[sfx${index}]`)].join("");
  inputs.push(`${allInputs}amix=inputs=${cues.length + 1}:duration=first:dropout_transition=0:normalize=0[mixedAudio]`);
  return inputs.join(";");
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
  let soundCues: DownloadedSfx[] = [];
  if (previewSceneNumber === undefined) {
    const sourceProbe = await run("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate,sample_rate,channels",
      "-of", "json",
      sourcePath,
    ]);
    const sourceMedia = JSON.parse(sourceProbe.stdout) as {
      format?: { duration?: string };
      streams?: Array<Record<string, string | number>>;
    };
    const sourceDuration = Number(sourceMedia.format?.duration || 0);
    if (Math.abs(sourceDuration - timeline.duration_seconds) > 1
      || !sourceMedia.streams?.some((stream) =>
        stream.codec_type === "audio" && stream.codec_name === "aac" && stream.channels === 2)) {
      throw new Error("The source film duration or stereo audio does not match the approved PUMP timeline");
    }
    soundCues = await fetchSfxForPlan(timeline.scenes);
    await writeFile(
      join(filmDir, "pump-film-openverse-sfx-cues.json"),
      JSON.stringify(soundCues.map((cue) => ({
        scene: cue.sceneNumber,
        at_seconds: Number(cue.globalStart.toFixed(3)),
        local_scene_seconds: Number(cue.localStart.toFixed(3)),
        kind: cue.kind,
        mix_volume: cue.volume,
        clip_seconds: cue.clipSeconds,
        title: cue.asset.title,
        creator: cue.asset.creator,
        provider: cue.asset.provider,
        license: cue.asset.license,
        license_url: cue.asset.licenseUrl,
        source_url: cue.asset.sourceUrl,
        preview_url: cue.asset.previewUrl,
      })), null, 2),
      "utf8",
    );
  }
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

  // Preserve the original narration/music track at unity gain; only quiet SFX are added.
  const audioArgs = [
    "-y",
    "-hide_banner",
    "-loglevel", "error",
    "-i", videoOnlyPath,
    "-i", sourcePath,
  ];
  for (const cue of soundCues) audioArgs.push("-i", cue.path);
  audioArgs.push(
    "-filter_complex", audioFilterGraph(soundCues),
    "-map", "0:v:0",
    "-map", "[mixedAudio]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ar", "48000",
    "-ac", "2",
    "-shortest",
    "-t", timeline.duration_seconds.toFixed(3),
    "-movflags", "+faststart",
    "-metadata", "title=PUMP — исследовательский фильм (анимированные вставки)",
    outputPath,
  );
  await run("ffmpeg", audioArgs);

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
    throw new Error("Updated PUMP film is missing the original narration/music mix and added AAC stereo effects");
  }
  const sizeBytes = Number(media.format?.size || 0);
  if (sizeBytes > MAX_OUTPUT_BYTES) {
    throw new Error(`Updated MP4 is ${sizeBytes} bytes; reduce its video bitrate before Telegram delivery`);
  }

  const effectManifest = JSON.parse(await readFile(join(filmDir, "pump-film-openverse-sfx-cues.json"), "utf8")) as Array<Record<string, unknown>>;
  const updatedTimeline = {
    generated_at: new Date().toISOString(),
    source_video: sourcePath,
    source_phrase_timeline: timelinePath,
    output_video: outputPath,
    duration_seconds: Number(duration.toFixed(3)),
    fps,
    resolution: timeline.resolution,
    audio: "original narration and music retained at unity gain; sparse quiet CC0/PDM Openverse effects mixed over it",
    motion_profile: "gentle alternating camera push/pan, scene-colored chapter progress, and timed hand-sketched inserts in all 20 scenes",
    sfx_cues: effectManifest,
    scenes: timeline.scenes.map((scene) => ({
      scene_number: scene.scene_number,
      visual: scene.visual,
      accent_color: accentForVisual(scene.visual),
      sketch_insert: SKETCH_INSERTS[scene.scene_number],
      start_seconds: scene.start_seconds,
      end_seconds: scene.end_seconds,
    })),
  };
  await writeFile(
    join(filmDir, "phrase-timeline-dynamic-inserts.json"),
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
    quietSfxCues: soundCues.length,
    streams: media.streams,
  }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown PUMP visual update error");
  process.exit(1);
});