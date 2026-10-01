import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { db, pool, telegramChatPreferencesTable } from "@workspace/db";
import { sendVideo } from "../src/lib/telegram-bot.ts";

async function main(): Promise<void> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("Telegram bot is not configured.");

  const rows = await db.select({ chatId: telegramChatPreferencesTable.chatId })
    .from(telegramChatPreferencesTable);
  const privateChats = rows.filter((row) => row.chatId > 0);
  if (privateChats.length !== 1) {
    throw new Error("Refusing to send: expected exactly one saved private Telegram chat.");
  }

  const filePath = resolve(
    process.cwd(),
    "../../attached_assets/generated_video/pump-film-2026-09-30/pump-film-research-2026-09-30-dynamic-inserts.mp4",
  );
  const buffer = await readFile(filePath);
  if (buffer.length >= 49 * 1024 * 1024) throw new Error("MP4 exceeds the configured Telegram video limit.");

  await sendVideo(token, privateChats[0]!.chatId, buffer, "✅ Готовый PUMP-фильм с динамичными вставками.");
  console.log(JSON.stringify({ acceptedByTelegram: true, fileBytes: buffer.length }));
}

main()
  .catch(() => {
    console.error("Telegram delivery failed; check the API server logs for details.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });