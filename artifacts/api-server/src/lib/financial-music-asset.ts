import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const WORKSPACE_ROOT = existsSync(join(process.cwd(), "attached_assets"))
  ? process.cwd()
  : join(process.cwd(), "..", "..");

export const FINANCIAL_MUSIC_BED_PATH = join(
  WORKSPACE_ROOT,
  "artifacts",
  "api-server",
  "assets",
  "audio",
  "financial-user-music-bed.mp3",
);

export const FINANCIAL_BACKGROUND_MUSIC_VOLUME = 0.1;
export const FINANCIAL_COIN_REVIEW_MUSIC_VOLUME = 0.13;
export const TECHNICAL_ANALYSIS_BACKGROUND_MUSIC_VOLUME =
  FINANCIAL_BACKGROUND_MUSIC_VOLUME * 1.2;
export const FINANCIAL_MUSIC_BED_TRACK_ID = "financial-user-music-bed-v1";

export async function readFinancialMusicBedBuffer(): Promise<Buffer> {
  try {
    return await readFile(FINANCIAL_MUSIC_BED_PATH);
  } catch (error) {
    throw new Error("Не найден сохранённый музыкальный фон для финансовых видео.", { cause: error });
  }
}