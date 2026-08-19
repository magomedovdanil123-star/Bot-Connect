import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { and, asc, eq } from "drizzle-orm";
import {
  audioMixesTable,
  db,
  projectMusicTable,
  projectSoundEffectsTable,
} from "@workspace/db";
import { logger } from "../logger";
import { heartbeatAudioProject, withAudioProjectFence } from "./lock";
import { audioUrl, deleteAudioAsset, readAudioAsset, storeAudioAsset } from "./storage";
import { loadActiveVoiceTimeline } from "./timeline";

const execFileAsync = promisify(execFile);

async function durationMs(path: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]);
  return Math.max(0, Math.round(Number.parseFloat(stdout.trim()) * 1000));
}

export async function mixProjectAudio(jobId: number, projectId: number, lockOwnerId: string): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "sound-mix-"));
  try {
    await withAudioProjectFence(projectId, lockOwnerId, (tx) =>
      tx.update(audioMixesTable).set({ status: "processing", updatedAt: new Date() }).where(eq(audioMixesTable.id, jobId))
    );
    const { voices } = await loadActiveVoiceTimeline(projectId, true);
    const voiceFiles: string[] = [];
    for (const [index, row] of voices.entries()) {
      const path = join(dir, `voice-${index}.mp3`);
      await writeFile(path, await readAudioAsset(row.storagePath!));
      voiceFiles.push(path);
    }
    const concat = join(dir, "voice.txt");
    await writeFile(concat, voiceFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join("\n"));
    const voicePath = join(dir, "voice.wav");
    await execFileAsync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concat, "-ar", "44100", "-ac", "2", voicePath]);
    const totalMs = await durationMs(voicePath);
    await heartbeatAudioProject(projectId, lockOwnerId);

    const music = await db.select().from(projectMusicTable).where(and(
      eq(projectMusicTable.projectId, projectId),
      eq(projectMusicTable.isActive, true),
      eq(projectMusicTable.status, "completed"),
    )).orderBy(asc(projectMusicTable.startTime), asc(projectMusicTable.createdAt));
    const effects = await db.select().from(projectSoundEffectsTable).where(and(
      eq(projectSoundEffectsTable.projectId, projectId),
      eq(projectSoundEffectsTable.isActive, true),
      eq(projectSoundEffectsTable.status, "completed"),
    )).orderBy(asc(projectSoundEffectsTable.startTime));

    const args = ["-y", "-i", voicePath];
    const filters: string[] = [];
    const mixLabels: string[] = [];
    let input = 1;
    if (music.length > 0) {
      const totalSeconds = totalMs / 1000;
      const starts = music.map((track) => track.startTime / 1000);
      if (
        starts[0] !== 0 ||
        starts.some((start, index) => start < 0 || start >= totalSeconds || (index > 0 && start <= starts[index - 1]!))
      ) throw new Error("Music transition timeline is invalid");

      const crossfades = starts.slice(1).map((start, index) => {
        const previousGap = start - starts[index]!;
        const nextAvailable = index + 2 < starts.length
          ? starts[index + 2]! - start
          : totalSeconds - start;
        return Math.max(0.05, Math.min(1.5, previousGap / 2, nextAvailable / 2));
      });

      for (const [index, track] of music.entries()) {
        if (!track.storagePath) throw new Error("Music asset is unavailable");
        const path = join(dir, `music-${index}.bin`);
        await writeFile(path, await readAudioAsset(track.storagePath));
        if (track.loop) args.push("-stream_loop", "-1");
        args.push("-i", path);
        const duration = index < music.length - 1
          ? starts[index + 1]! - starts[index]! + crossfades[index]!
          : totalSeconds - starts[index]!;
        filters.push(`[${input}:a]aresample=44100,atrim=0:${duration},asetpts=PTS-STARTPTS,volume=${track.volume}[music${index}]`);
        input += 1;
      }
      await heartbeatAudioProject(projectId, lockOwnerId);

      let musicLabel = "music0";
      for (let index = 1; index < music.length; index += 1) {
        const outputLabel = `musiccross${index}`;
        filters.push(`[${musicLabel}][music${index}]acrossfade=d=${crossfades[index - 1]}:c1=tri:c2=tri[${outputLabel}]`);
        musicLabel = outputLabel;
      }
      const firstMusic = music[0]!;
      const lastMusic = music.at(-1)!;
      const fadeOutStart = Math.max(0, totalSeconds - lastMusic.fadeOut / 1000);
      filters.push(`[${musicLabel}]atrim=0:${totalSeconds},afade=t=in:st=0:d=${firstMusic.fadeIn / 1000},afade=t=out:st=${fadeOutStart}:d=${lastMusic.fadeOut / 1000}[musicbase]`);
      if (music.some((track) => track.ducking)) {
        filters.push("[0:a]aresample=44100,asplit=2[voiceout][voicekey]");
        filters.push("[musicbase][voicekey]sidechaincompress=threshold=0.025:ratio=10:attack=20:release=500[ducked]");
        mixLabels.push("[voiceout]", "[ducked]");
      } else {
        filters.push("[0:a]aresample=44100[voiceout]");
        mixLabels.push("[voiceout]", "[musicbase]");
      }
    } else {
      filters.push("[0:a]aresample=44100[voiceout]");
      mixLabels.push("[voiceout]");
    }
    for (const [index, effect] of effects.entries()) {
      if (!effect.storagePath) continue;
      const path = join(dir, `effect-${index}.bin`);
      await writeFile(path, await readAudioAsset(effect.storagePath));
      args.push("-i", path);
      const duration = Math.min((effect.duration || 5000) / 1000, totalMs / 1000);
      const fadeOut = Math.max(0, duration - effect.fadeOut / 1000);
      filters.push(`[${input}:a]aresample=44100,atrim=0:${duration},afade=t=in:st=0:d=${effect.fadeIn / 1000},afade=t=out:st=${fadeOut}:d=${effect.fadeOut / 1000},volume=${effect.volume},adelay=${effect.startTime}|${effect.startTime}[sfx${index}]`);
      mixLabels.push(`[sfx${index}]`);
      input += 1;
    }
    await heartbeatAudioProject(projectId, lockOwnerId);
    filters.push(`${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:normalize=0,alimiter=limit=0.95[out]`);
    const output = join(dir, "mixed_audio.mp3");
    args.push("-filter_complex", filters.join(";"), "-map", "[out]", "-t", String(totalMs / 1000), "-c:a", "libmp3lame", "-b:a", "192k", output);
    await execFileAsync("ffmpeg", args, { maxBuffer: 10 * 1024 * 1024 });
    await heartbeatAudioProject(projectId, lockOwnerId);
    const buffer = await readFile(output);
    const finalDuration = await durationMs(output);
    const storagePath = await storeAudioAsset(buffer, "audio-mix");
    try {
      await withAudioProjectFence(projectId, lockOwnerId, (tx) =>
        tx.update(audioMixesTable).set({
          status: "completed",
          storagePath,
          audioUrl: audioUrl(storagePath),
          duration: finalDuration,
          fileSize: buffer.length,
          peakDb: -0.45,
          updatedAt: new Date(),
        }).where(eq(audioMixesTable.id, jobId))
      );
    } catch (error) {
      await deleteAudioAsset(storagePath).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    logger.error({ err: error, projectId, audioMixJobId: jobId }, "Audio mix failed");
    await db.update(audioMixesTable).set({
      status: "failed",
      error: error instanceof Error ? error.message : "Audio mix failed",
      updatedAt: new Date(),
    }).where(eq(audioMixesTable.id, jobId));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
