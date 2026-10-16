// Сценарий пользователя -> (озвучка тем же голосом, что и финансовые ролики) -> план сцен -> MP4 16:9.
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  getSpeechProvider,
  prepareSpeechText,
} from "../audio-generation/elevenlabs-client";
import { generateLumeanSpeech } from "../audio-generation/lumean-client";
import { getVoiceApiModelId } from "../audio-generation/voice-api-client";
import { buildMotionPlan, renderMotionVideo, type MotionPlan } from "./renderer";

export const MAX_MOTION_SCRIPT_CHARACTERS = 8_000;
const LEAD_IN_SECONDS = 0.6; // затемнение в начале ролика, аудио сдвигаем на столько же

export type MotionVideoStage =
  | { stage: "voice" }
  | { stage: "render"; scenes: number; progress: number };

export type MotionVideoResult = {
  buffer: Buffer;
  durationSeconds: number;
  sceneCount: number;
  voiced: boolean;
};

export async function previewMotionPlan(script: string): Promise<MotionPlan> {
  return buildMotionPlan(script);
}

async function synthesizeNarration(sentences: string[]): Promise<Buffer> {
  const settings = { speed: 0.98, stability: 0.52, similarity: 0.78, style: 0.2, speakerBoost: true };
  const voiceId = getConfiguredVoiceId();
  if (getSpeechProvider() === "voice_api") {
    // Lumean: бесплатные паузы {{pause}} между фразами — по ним потом находим границы сцен
    const text = sentences.map((sentence) => prepareSpeechText(sentence).replace(/[[\]]/gu, "")).join(" {{pause=0.8}}\n\n");
    return generateLumeanSpeech(text, voiceId, getVoiceApiModelId(), settings);
  }
  return generateSpeech(prepareSpeechText(sentences.join("\n\n")), voiceId, getElevenLabsModel(), settings);
}

function detectSilences(audioPath: string): Promise<{ silences: Array<{ start: number; end: number }>; total: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ["-i", audioPath, "-af", "silencedetect=n=-38dB:d=0.35", "-f", "null", "-"], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let log = "";
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => { log += chunk; });
    child.once("error", reject);
    child.once("exit", () => {
      const silences: Array<{ start: number; end: number }> = [];
      let start: number | undefined;
      for (const line of log.split("\n")) {
        const begin = /silence_start: ([\d.]+)/u.exec(line);
        if (begin?.[1]) start = Number(begin[1]);
        const end = /silence_end: ([\d.]+)/u.exec(line);
        if (end?.[1] && start !== undefined) {
          silences.push({ start, end: Number(end[1]) });
          start = undefined;
        }
      }
      const duration = /Duration: (\d+):(\d+):([\d.]+)/u.exec(log);
      const total = duration ? Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]) : 0;
      resolve({ silences, total });
    });
  });
}

/** Границы фраз = N-1 самых длинных пауз в аудио. Если пауз мало — делим по длине текста. */
export async function sentenceTimings(audioPath: string, sentences: string[]): Promise<Array<{ start: number; dur: number; speak: number }>> {
  const { silences, total } = await detectSilences(audioPath);
  const count = sentences.length;
  const lead = silences.find((silence) => silence.start < 0.05)?.end ?? 0;
  const inner = silences.filter((silence) => silence.start > lead + 0.3 && silence.end < total - 0.2);
  let cuts = [...inner]
    .sort((a, b) => (b.end - b.start) - (a.end - a.start))
    .slice(0, count - 1)
    .sort((a, b) => a.start - b.start);
  if (cuts.length < count - 1) {
    const lengths = sentences.map((sentence) => sentence.length);
    const sum = lengths.reduce((a, b) => a + b, 0) || 1;
    let accumulated = 0;
    cuts = lengths.slice(0, -1).map((length) => {
      accumulated += length;
      const at = lead + (total - lead) * (accumulated / sum);
      return { start: at - 0.2, end: at + 0.2 };
    });
  }
  return sentences.map((_sentence, index) => {
    const start = index === 0 ? Math.max(0, lead - 0.15) : cuts[index - 1]!.end - 0.15;
    const end = index < count - 1 ? cuts[index]!.end - 0.15 : total + 0.4;
    const speakEnd = index < count - 1 ? cuts[index]!.start : total;
    return { start, dur: end - start, speak: Math.max(0.5, speakEnd - start) };
  });
}

export async function createMotionVideo(
  script: string,
  options: { voice: boolean; onStage?: (stage: MotionVideoStage) => void },
): Promise<MotionVideoResult> {
  const plan = await buildMotionPlan(script);
  if (!plan.scenes.length) throw new Error("В сценарии нет предложений.");
  const workDir = await mkdtemp(path.join(os.tmpdir(), "motion-voice-"));
  try {
    let audioPath: string | undefined;
    if (options.voice) {
      options.onStage?.({ stage: "voice" });
      const audio = await synthesizeNarration(plan.scenes.map((scene) => scene.text));
      audioPath = path.join(workDir, "voice.mp3");
      await writeFile(audioPath, audio);
      const timings = await sentenceTimings(audioPath, plan.scenes.map((scene) => scene.text));
      plan.scenes.forEach((scene, index) => {
        const timing = timings[index]!;
        scene.start = LEAD_IN_SECONDS + timing.start;
        scene.dur = timing.dur;
        scene.speak = timing.speak;
      });
    }
    const result = await renderMotionVideo(plan, {
      audioPath,
      audioOffsetSeconds: LEAD_IN_SECONDS,
      onProgress: (progress) => options.onStage?.({ stage: "render", scenes: plan.scenes.length, progress }),
    });
    return { ...result, voiced: Boolean(audioPath) };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
