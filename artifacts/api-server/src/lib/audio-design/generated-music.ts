import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AudioAsset } from "./types";

const execFileAsync = promisify(execFile);

const MOOD_FREQUENCIES: Record<string, [number, number, number]> = {
  calm: [174, 220, 261],
  emotional: [196, 247, 294],
  romantic: [220, 277, 330],
  dramatic: [147, 185, 220],
  dark: [110, 139, 165],
  suspense: [130, 155, 196],
  thriller: [123, 147, 185],
  energetic: [196, 247, 392],
  motivational: [196, 247, 330],
  funny: [220, 277, 370],
  sad: [146, 174, 220],
  mysterious: [138, 164, 207],
  cinematic: [147, 196, 294],
  documentary: [174, 220, 330],
  happy: [196, 247, 330],
};

export async function generateInstrumentalMusic(params: {
  projectId: number;
  durationMs: number;
  mood: string;
  category: string;
}): Promise<{ asset: AudioAsset; buffer: Buffer }> {
  const durationSeconds = Math.max(1, Math.min(20 * 60, Math.ceil(params.durationMs / 1000)));
  const frequencies = MOOD_FREQUENCIES[params.mood] || MOOD_FREQUENCIES.cinematic;
  const dir = await mkdtemp(join(tmpdir(), "generated-music-"));
  const output = join(dir, "instrumental.mp3");
  try {
    const lavfi = frequencies.map((frequency) => `sine=frequency=${frequency}:duration=${durationSeconds}`).map((source) => ["-f", "lavfi", "-i", source]).flat();
    const fadeOutStart = Math.max(0, durationSeconds - 2);
    await execFileAsync("ffmpeg", [
      "-y",
      ...lavfi,
      "-filter_complex",
      `[0:a][1:a][2:a]amix=inputs=3:duration=longest:weights=0.52 0.3 0.18,lowpass=f=1800,highpass=f=70,volume=0.48,afade=t=in:st=0:d=1,afade=t=out:st=${fadeOutStart}:d=2[out]`,
      "-map", "[out]",
      "-t", String(durationSeconds),
      "-ar", "44100",
      "-ac", "2",
      "-c:a", "libmp3lame",
      "-b:a", "128k",
      output,
    ], { maxBuffer: 10 * 1024 * 1024 });

    const buffer = await readFile(output);
    if (!buffer.length) throw new Error("FFmpeg generated an empty music file");
    return {
      asset: {
        provider: "local:ffmpeg",
        externalId: `generated-${params.projectId}-${durationSeconds}`,
        title: `Instrumental ${params.category || params.mood}`,
        creator: "AI Content Factory",
        sourceUrl: "local://ffmpeg-generated-instrumental",
        previewUrl: null,
        downloadUrl: "local://ffmpeg-generated-instrumental",
        license: "CC0",
        licenseUrl: null,
        requiresAttribution: false,
        duration: durationSeconds * 1000,
        category: params.category || "instrumental background music",
        metadata: {
          generated: true,
          generator: "ffmpeg",
          mood: params.mood,
        },
      },
      buffer,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}