import type { VideoScript } from "../script-generator";

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

function wrapWords(text: string, maxChars = 42): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.trim()];
}

export function buildSubtitleCues(
  script: VideoScript,
  timeline: Array<{ sceneId: number; startTime: number; endTime: number }>,
): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const scene of script.scenes) {
    const segment = timeline.find((item) => item.sceneId === scene.scene_number);
    if (!segment) continue;
    const chunks = wrapWords(scene.voice_text);
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