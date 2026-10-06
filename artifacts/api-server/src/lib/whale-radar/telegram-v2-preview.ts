import { readFile } from "node:fs/promises";

const TELEGRAM_API = "https://api.telegram.org";
const MAX_VIDEO_BYTES = 45 * 1024 * 1024;
const SEND_SPACING_MS = 1_100;
let nextSendAt = 0;

type TelegramEnvelope<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  parameters?: { retry_after?: number };
};

type TelegramChat = {
  type?: string;
};

type TelegramVideo = {
  width?: number;
  height?: number;
  file_size?: number;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSendSlot(): Promise<void> {
  const waitMs = Math.max(0, nextSendAt - Date.now());
  if (waitMs > 0) await delay(waitMs);
}

async function readTelegramResult<T>(response: Response): Promise<TelegramEnvelope<T>> {
  const payload = await response.json() as TelegramEnvelope<T>;
  if (!response.ok && !payload.description) {
    throw new Error(`Telegram request failed with HTTP ${response.status}.`);
  }
  return payload;
}

export async function sendWhaleRadarV2PrivatePreview(
  chatId: number,
  videoPath: string,
  caption: string,
): Promise<{ width: number; height: number; fileSize: number }> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured; preview was not sent.");

  const video = await readFile(videoPath);
  if (video.length > MAX_VIDEO_BYTES) {
    throw new Error(`Preview is ${video.length} bytes; compress below ${MAX_VIDEO_BYTES} bytes before sending.`);
  }

  const chatResponse = await fetch(`${TELEGRAM_API}/bot${token}/getChat?chat_id=${encodeURIComponent(String(chatId))}`, {
    signal: AbortSignal.timeout(30_000),
  });
  const chatEnvelope = await readTelegramResult<TelegramChat>(chatResponse);
  if (!chatEnvelope.ok || chatEnvelope.result?.type !== "private") {
    throw new Error("The only saved Telegram destination is not a verified private chat; preview was not sent.");
  }

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption.slice(0, 1_000));
  form.append("width", "1080");
  form.append("height", "1920");
  form.append("supports_streaming", "true");
  form.append("video", new Blob([new Uint8Array(video)], { type: "video/mp4" }), "whale-radar-v2-test.mp4");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForSendSlot();
    nextSendAt = Date.now() + SEND_SPACING_MS;
    const response = await fetch(`${TELEGRAM_API}/bot${token}/sendVideo`, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(180_000),
    });
    const envelope = await readTelegramResult<{ video?: TelegramVideo }>(response);
    if (response.ok && envelope.ok && envelope.result?.video) {
      const sent = envelope.result.video;
      if (sent.width !== 1080 || sent.height !== 1920) {
        throw new Error(`Telegram accepted the preview with unexpected dimensions ${sent.width}x${sent.height}.`);
      }
      return {
        width: sent.width,
        height: sent.height,
        fileSize: sent.file_size ?? video.length,
      };
    }

    const retryAfter = envelope.parameters?.retry_after;
    if (retryAfter && attempt < 2) {
      await delay(Math.min(Math.max(retryAfter * 1_000 + 1_000, 1_000), 10 * 60 * 1_000));
      continue;
    }
    throw new Error(envelope.description ?? "Telegram did not accept the V2 preview.");
  }

  throw new Error("Telegram preview retry limit exceeded.");
}
