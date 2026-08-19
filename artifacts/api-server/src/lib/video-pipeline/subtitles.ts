import type { VideoScript } from "../script-generator";
import { cleanSubtitleText } from "../audio-generation/elevenlabs-client";

export type SubtitleCue = {
  index: number;
  startTime: number;
  endTime: number;
  text: string;
  sceneId: number;
};

function timestamp(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const hours = Math.floor(safe / 3_600_000);
  const minutes = Math.floor((safe % 3_600_000) / 60_000);
  const seconds = Math.floor((safe % 60_000) / 1000);
  const millis = safe % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function buildSubtitleCues(
  script: VideoScript,
  timeline: Array<{ sceneId: number; startTime: number; endTime: number }>,
): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const scene of script.scenes) {
    const segment = timeline.find((item) => item.sceneId === scene.scene_number);
    if (!segment) continue;
    const chunks = splitWords(cleanSubtitleText(scene.voice_text));
    const duration = Math.max(1, segment.endTime - segment.startTime);
    const chunkDuration = duration / chunks.length;
    chunks.forEach((text, index) => cues.push({
      index: cues.length + 1,
      startTime: segment.startTime + index * chunkDuration,
      endTime: segment.startTime + (index + 1) * chunkDuration,
      text,
      sceneId: scene.scene_number,
    }));
  }
  return cues;
}

export function toSrt(cues: SubtitleCue[]): string {
  return cues.map((cue) => [
    String(cue.index),
    `${timestamp(cue.startTime)} --> ${timestamp(cue.endTime)}`,
    cue.text,
    "",
  ].join("\n")).join("\n");
}