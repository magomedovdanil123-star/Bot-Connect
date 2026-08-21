import { randomBytes, createCipheriv, createDecipheriv, createHmac, createHash, timingSafeEqual } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { eq, desc } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { db, youtubeConnectionsTable } from "@workspace/db";
import { readAudioAsset } from "./audio-design/storage";
import { openRouterConfig } from "./openrouter-config";
import { generateStandaloneImage } from "./image-generation/service";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const YOUTUBE_READONLY_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const execFileAsync = promisify(execFile);
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function oauthClient(): OAuth2Client {
  return new OAuth2Client(
    required("YOUTUBE_CLIENT_ID"),
    required("YOUTUBE_CLIENT_SECRET"),
    required("YOUTUBE_REDIRECT_URI"),
  );
}

function encryptionKey(): Buffer {
  const raw = required("YOUTUBE_TOKEN_ENCRYPTION_KEY");
  const key = Buffer.from(raw, "base64");
  if (key.length === 32) return key;
  // Accept an existing non-base64 secret without exposing or replacing it.
  // SHA-256 deterministically derives the required AES-256 key from that secret.
  return createHash("sha256").update(raw, "utf8").digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(value: string): string {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored YouTube token is invalid");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export function createYoutubeAuthorizationUrl(): string {
  const payload = Buffer.from(JSON.stringify({
    nonce: randomBytes(24).toString("base64url"),
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  })).toString("base64url");
  const signature = createHmac("sha256", required("YOUTUBE_CLIENT_SECRET"))
    .update(payload)
    .digest("base64url");
  const state = `${payload}.${signature}`;
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    // Force Google to reopen the account/channel picker when adding a second
    // YouTube channel from the same Google account.
    prompt: "select_account consent",
    scope: [YOUTUBE_SCOPE, YOUTUBE_READONLY_SCOPE],
    state,
  });
}

async function youtubeAccessToken(connectionId?: number): Promise<string> {
  const [connection] = connectionId
    ? await db.select().from(youtubeConnectionsTable).where(eq(youtubeConnectionsTable.id, connectionId))
    : await db.select().from(youtubeConnectionsTable).orderBy(desc(youtubeConnectionsTable.updatedAt)).limit(1);
  if (!connection) throw new Error("YouTube is not connected");
  const client = oauthClient();
  client.setCredentials({ refresh_token: decrypt(connection.encryptedRefreshToken) });
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("YouTube access token could not be refreshed");
  return token.token;
}

export async function completeYoutubeAuthorization(code: string, state: string): Promise<{ connectionId: number; channelTitle: string | null }> {
  const [statePayload, encodedSignature] = state.split(".");
  if (!statePayload || !encodedSignature) throw new Error("YouTube authorization state is invalid");
  const expectedSignature = createHmac("sha256", required("YOUTUBE_CLIENT_SECRET"))
    .update(statePayload)
    .digest("base64url");
  const received = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("YouTube authorization state is invalid");
  }
  let stateData: { expiresAt?: number };
  try {
    stateData = JSON.parse(Buffer.from(statePayload, "base64url").toString("utf8")) as { expiresAt?: number };
  } catch {
    throw new Error("YouTube authorization state is invalid");
  }
  if (!stateData.expiresAt || stateData.expiresAt < Date.now()) {
    throw new Error("YouTube authorization state expired. Start the YouTube connection flow again.");
  }
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token; revoke the old app grant and try again");
  client.setCredentials(tokens);
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) throw new Error("YouTube access token could not be verified");
  const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken.token}` },
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, " ").trim().slice(0, 300);
    throw new Error(`YouTube channel lookup failed (${response.status})${detail ? `: ${detail}` : ""}. Reconnect YouTube and grant channel read access.`);
  }
  const channelPayload = await response.json() as { items?: Array<{ id?: string; snippet?: { title?: string } }> };
  const channel = channelPayload.items?.[0];
  const channelTitle = channel?.snippet?.title || null;
  const channelId = channel?.id || null;
  const [lastConnection] = await db.select({ id: youtubeConnectionsTable.id })
    .from(youtubeConnectionsTable)
    .orderBy(desc(youtubeConnectionsTable.id))
    .limit(1);
  const [connection] = await db.insert(youtubeConnectionsTable).values({
    id: (lastConnection?.id || 0) + 1,
    channelId,
    channelTitle,
    encryptedRefreshToken: encrypt(tokens.refresh_token),
  }).returning({ id: youtubeConnectionsTable.id });
  return { connectionId: connection.id, channelTitle };
}

export async function listYoutubeConnections(): Promise<Array<{ id: number; channelId: string | null; channelTitle: string | null }>> {
  return db.select({
    id: youtubeConnectionsTable.id,
    channelId: youtubeConnectionsTable.channelId,
    channelTitle: youtubeConnectionsTable.channelTitle,
  }).from(youtubeConnectionsTable).orderBy(desc(youtubeConnectionsTable.updatedAt));
}

export async function youtubeConnectionStatus(connectionId?: number): Promise<{ connected: boolean; channelTitle: string | null; connectionId: number | null }> {
  const [connection] = connectionId
    ? await db.select({ id: youtubeConnectionsTable.id, channelTitle: youtubeConnectionsTable.channelTitle })
      .from(youtubeConnectionsTable).where(eq(youtubeConnectionsTable.id, connectionId))
    : await db.select({ id: youtubeConnectionsTable.id, channelTitle: youtubeConnectionsTable.channelTitle })
      .from(youtubeConnectionsTable).orderBy(desc(youtubeConnectionsTable.updatedAt)).limit(1);
  return { connected: Boolean(connection), channelTitle: connection?.channelTitle || null, connectionId: connection?.id || null };
}

export async function uploadYoutubeShort(params: {
  videoStoragePath: string;
  title: string;
  description: string;
  tags?: string[];
  thumbnail?: Buffer;
  privacyStatus?: "private" | "unlisted" | "public";
  connectionId?: number;
}): Promise<{ videoId: string; privacyStatus: string; thumbnailSet: boolean }> {
  const accessToken = await youtubeAccessToken(params.connectionId);
  const video = await readAudioAsset(params.videoStoragePath);
  const privacyStatus = params.privacyStatus || process.env["YOUTUBE_DEFAULT_PRIVACY_STATUS"] || "private";
  const metadata = {
    snippet: {
      title: params.title.slice(0, 100),
      description: params.description.slice(0, 5000),
      tags: (params.tags || []).slice(0, 30),
      categoryId: "22",
    },
    status: { privacyStatus, selfDeclaredMadeForKids: false },
  };
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(video.length),
    },
    body: JSON.stringify(metadata),
  });
  if (!init.ok) throw new Error(`YouTube upload initialization failed (${init.status})`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube did not return an upload URL");
  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "video/mp4", "Content-Length": String(video.length) },
    body: video,
  });
  const payload = await upload.json() as { id?: string; status?: { privacyStatus?: string }; error?: { message?: string } };
  if (!upload.ok || !payload.id) throw new Error(payload.error?.message || `YouTube upload failed (${upload.status})`);
  let thumbnailSet = false;
  if (params.thumbnail?.length) {
    const thumbnailResponse = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?uploadType=media&videoId=${encodeURIComponent(payload.id)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/jpeg",
        "Content-Length": String(params.thumbnail.length),
      },
      body: params.thumbnail,
    });
    if (!thumbnailResponse.ok) {
      const thumbnailError = await thumbnailResponse.text();
      throw new Error(`YouTube thumbnail upload failed (${thumbnailResponse.status}): ${thumbnailError.slice(0, 300)}`);
    }
    thumbnailSet = true;
  }
  return { videoId: payload.id, privacyStatus: payload.status?.privacyStatus || privacyStatus, thumbnailSet };
}

export type YoutubeMetadata = {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
};

function fallbackYoutubeMetadata(input: { title: string; topic: string; description: string }): YoutubeMetadata {
  const safeTitle = input.title.trim().slice(0, 60) || input.topic.trim().slice(0, 60) || "Что произошло дальше?";
  const hashtags = ["#shorts", "#история", "#AI"];
  return {
    title: safeTitle,
    description: `${input.description.trim()}\n\n${hashtags.join(" ")}\n\nСоздано в AI Content Factory.`,
    tags: ["shorts", "история", "короткое видео", "ai", "русский контент"].slice(0, 30),
    hashtags,
  };
}

export async function generateYoutubeMetadata(input: {
  title: string;
  topic: string;
  description: string;
  scriptText: string;
}): Promise<YoutubeMetadata> {
  const fallback = fallbackYoutubeMetadata(input);
  if (!openRouterConfig.apiKey) return fallback;
  const prompt = [
    "Ты YouTube SEO-редактор для русскоязычных вертикальных Shorts.",
    "Верни только валидный JSON без markdown.",
    "Придумай короткий цепляющий заголовок до 60 символов в стиле Shorts: интрига, конфликт или неожиданный поворот. Например: «Один день из жизни курьера — но этот заказ изменил всё».",
    "Описание должно быть до 3500 символов. Верни ровно 3 хэштега, и они обязательно должны быть добавлены в конец описания.",
    "Заголовок должен быть привлекательным, но не обещать того, чего нет в сюжете.",
    JSON.stringify({
      title: input.title,
      topic: input.topic,
      description: input.description,
      script: input.scriptText.slice(0, 12000),
    }),
    JSON.stringify({ title: "Короткий цепляющий заголовок", description: "Описание ролика\n\n#shorts #история #сюжет", tags: ["shorts"], hashtags: ["#shorts", "#история", "#сюжет"] }),
  ].join("\n\n");
  try {
    const response = await fetch(openRouterConfig.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterConfig.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://replit.com",
        "X-Title": "AI Content Factory YouTube SEO",
      },
      body: JSON.stringify({
        model: openRouterConfig.model,
        messages: [
          { role: "system", content: "Ты возвращаешь только JSON-объект." },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 2500,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) return fallback;
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return fallback;
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? content.slice(start, end + 1) : content) as Partial<YoutubeMetadata>;
    const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 60) : fallback.title;
    const descriptionBase = typeof parsed.description === "string" ? parsed.description.trim().slice(0, 5000) : fallback.description;
    const tags = Array.isArray(parsed.tags) ? parsed.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean).slice(0, 30) : fallback.tags;
    const parsedHashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().replace(/^#?/, "#"))
        .filter(Boolean)
        .slice(0, 3)
      : [];
    const hashtags = parsedHashtags.length === 3 ? parsedHashtags : fallback.hashtags;
    const description = `${descriptionBase.replace(/(?:^|\s)#\S+/g, "").trim()}\n\n${hashtags.join(" ")}`.trim();
    return { title: title || fallback.title, description, tags: tags.length ? tags : fallback.tags, hashtags };
  } catch {
    return fallback;
  }
}

export async function createYoutubeThumbnail(input: {
  topic: string;
  title: string;
  description: string;
}): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "youtube-thumbnail-"));
  const generatedInput = join(dir, "generated.png");
  const output = join(dir, "thumbnail.jpg");
  try {
    const asset = await generateStandaloneImage(
      [
        "Create a professional high-click-through YouTube Shorts thumbnail.",
        "16:9 landscape composition, bold cinematic lighting, dramatic close-up or clear action, one instantly readable visual idea, strong contrast, vivid but realistic colors.",
        "Make it look like a premium viral documentary/thriller thumbnail, not a generic stock image.",
        "Do not copy a video frame. Do not use watermarks, logos, UI, borders, or long text. No illegible AI-generated lettering.",
        `Video topic: ${input.topic}`,
        `Short title: ${input.title}`,
        `Story context: ${input.description.slice(0, 1200)}`,
      ].join("\n"),
      {
        aspectRatio: "16:9",
        visualStyle: "premium cinematic YouTube Shorts thumbnail",
        realism: "high",
        people: "one clear main subject when relevant",
        colorAtmosphere: "high contrast, dramatic, vivid",
      },
    );
    await writeFile(generatedInput, asset.buffer);
    await execFileAsync("ffmpeg", [
      "-y", "-i", generatedInput,
      "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
      "-frames:v", "1", "-q:v", "2", output,
    ], { maxBuffer: 4 * 1024 * 1024 });
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}