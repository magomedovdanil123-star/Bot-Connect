import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { probeTelegramVideoDimensions } from "./telegram-video-metadata";

const execFileAsync = promisify(execFile);

test("keeps portrait, square, and landscape video dimensions", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "telegram-video-metadata-test-"));
  try {
    for (const dimensions of [
      { width: 270, height: 480 },
      { width: 360, height: 360 },
      { width: 480, height: 270 },
    ]) {
      const videoPath = join(tempDir, `${dimensions.width}x${dimensions.height}.mp4`);
      await execFileAsync("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        `color=c=black:s=${dimensions.width}x${dimensions.height}:r=1`,
        "-t",
        "1",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        videoPath,
      ], {
        timeout: 30_000,
        maxBuffer: 1 * 1024 * 1024,
      });

      assert.deepEqual(
        await probeTelegramVideoDimensions(await readFile(videoPath)),
        dimensions,
      );
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("rejects invalid bytes instead of guessing a video format", async () => {
  await assert.rejects(
    probeTelegramVideoDimensions(Buffer.from("not an MP4")),
    /Не удалось определить формат видео для Telegram/u,
  );
});