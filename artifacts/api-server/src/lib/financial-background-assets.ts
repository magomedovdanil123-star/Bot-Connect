import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE_ROOT = existsSync(join(process.cwd(), "attached_assets"))
  ? process.cwd()
  : join(process.cwd(), "..", "..");
const FINANCE_BACKGROUND_PATH = join(
  WORKSPACE_ROOT,
  "attached_assets",
  "generated_images",
  "finance-black-terracotta-gradient-bg.jpg",
);

let financeBackgroundDataUri: string | undefined;

export function getFinanceBlackTerracottaGradientDataUri(): string {
  if (financeBackgroundDataUri) return financeBackgroundDataUri;
  if (!existsSync(FINANCE_BACKGROUND_PATH)) {
    throw new Error("Не найден утверждённый чёрно-терракотовый фон для финансовых видео.");
  }
  financeBackgroundDataUri = `data:image/jpeg;base64,${readFileSync(FINANCE_BACKGROUND_PATH).toString("base64")}`;
  return financeBackgroundDataUri;
}