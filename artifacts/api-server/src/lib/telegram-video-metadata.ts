import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type TelegramVideoDimensions = {
  width: number;
  height: number;
};

export async function probeTelegramVideoDimensions(
  buffer: Buffer,
): Promise<TelegramVideoDimensions> {
  if (!buffer.length) throw new Error("Нельзя отправить пустой видеофайл в Telegram.");

  const tempDir = await mkdtemp(join(tmpdir(), "telegram-video-metadata-"));
  const videoPath = join(tempDir, "upload.mp4");
  try {
    await writeFile(videoPath, buffer);
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      videoPath,
    ], {
      timeout: 15_000,
      maxBuffer: 1 * 1024 * 1024,
    });
    const result = JSON.parse(stdout) as {
      streams?: Array<{ width?: number; height?: number }>;
    };
    const stream = result.streams?.[0];
    const width = stream?.width;
    const height = stream?.height;
    if (
      !Number.isInteger(width)
      || !Number.isInteger(height)
      || !width
      || !height
      || width < 1
      || height < 1
    ) {
      throw new Error("FFprobe не вернул корректные размеры видеокадра.");
    }
    return { width, height };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Не удалось определить формат видео для Telegram: ${reason}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}