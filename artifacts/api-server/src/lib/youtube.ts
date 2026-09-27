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
import {
  fallbackYoutubeMetadata as buildFallbackYoutubeMetadata,
  sanitizeSpecializedYoutubeMetadata,
} from "./youtube-metadata-fallback";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const YOUTUBE_MANAGE_SCOPE = "https://www.googleapis.com/auth/youtube";
const YOUTUBE_READONLY_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
const YOUTUBE_COMMENTS_SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const execFileAsync = promisify(execFile);
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const MAX_YOUTUBE_SHORT_SECONDS = 180;
const MAX_YOUTUBE_TAG_BYTES = 500;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function normalizeYoutubeTags(tags: string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const rawTag of tags) {
    const tag = rawTag
      .trim()
      .replace(/^#+/u, "")
      .replace(/[\u0000-\u001f\u007f]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
    if (!tag || seen.has(tag)) continue;
    const candidate = [...normalized, tag];
    if (Buffer.byteLength(candidate.join(","), "utf8") > MAX_YOUTUBE_TAG_BYTES) continue;
    normalized.push(tag);
    seen.add(tag);
    if (normalized.length >= 30) break;
  }
  return normalized;
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
    scope: [YOUTUBE_SCOPE, YOUTUBE_MANAGE_SCOPE, YOUTUBE_READONLY_SCOPE, YOUTUBE_COMMENTS_SCOPE],
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
  let token;
  try {
    token = await client.getAccessToken();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    if (/invalid_grant|token has been expired or revoked/i.test(detail)) {
      throw new Error("YouTube authorization expired or was revoked. Reconnect the channel.");
    }
    throw error;
  }
  if (!token.token) throw new Error("YouTube access token could not be refreshed");
  return token.token;
}

export async function completeYoutubeAuthorization(code: string, state: string): Promise<{
  connectionId: number;
  channelTitle: string | null;
  channels: Array<{ connectionId: number; channelTitle: string | null }>;
}> {
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
  const channelPayload = await response.json() as {
    items?: Array<{ id?: string; snippet?: { title?: string } }>;
  };
  const channels = (channelPayload.items || [])
    .filter((channel): channel is { id: string; snippet?: { title?: string } } => Boolean(channel.id))
    .map((channel) => ({
      channelId: channel.id,
      channelTitle: channel.snippet?.title || null,
    }));
  if (!channels.length) throw new Error("Google account has no accessible YouTube channels");

  const existing = await db.select({
    id: youtubeConnectionsTable.id,
    channelId: youtubeConnectionsTable.channelId,
  }).from(youtubeConnectionsTable);
  const encryptedRefreshToken = encrypt(tokens.refresh_token);
  const created: Array<{ connectionId: number; channelTitle: string | null }> = [];
  let nextId = (existing.reduce((max, connection) => Math.max(max, connection.id), 0) || 0) + 1;

  for (const channel of channels) {
    const alreadyConnected = existing.find((connection) => connection.channelId === channel.channelId);
    if (alreadyConnected) {
      await db.update(youtubeConnectionsTable)
        .set({
          channelTitle: channel.channelTitle,
          encryptedRefreshToken,
        })
        .where(eq(youtubeConnectionsTable.id, alreadyConnected.id));
      created.push({ connectionId: alreadyConnected.id, channelTitle: channel.channelTitle });
      continue;
    }
    const [connection] = await db.insert(youtubeConnectionsTable).values({
      id: nextId++,
      channelId: channel.channelId,
      channelTitle: channel.channelTitle,
      encryptedRefreshToken,
    }).returning({ id: youtubeConnectionsTable.id });
    created.push({ connectionId: connection.id, channelTitle: channel.channelTitle });
  }
  const first = created[0]!;
  return {
    connectionId: first.connectionId,
    channelTitle: first.channelTitle,
    channels: created,
  };
}

export async function listYoutubeConnections(): Promise<Array<{ id: number; channelId: string | null; channelTitle: string | null }>> {
  return db.select({
    id: youtubeConnectionsTable.id,
    channelId: youtubeConnectionsTable.channelId,
    channelTitle: youtubeConnectionsTable.channelTitle,
  }).from(youtubeConnectionsTable).orderBy(desc(youtubeConnectionsTable.updatedAt));
}

export type YoutubeMilestoneVideo = {
  videoId: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  channelTitle: string;
};

export async function listYoutubeVideosPublishedSince(
  connectionId: number,
  since: Date,
): Promise<YoutubeMilestoneVideo[]> {
  const [connection] = await db.select().from(youtubeConnectionsTable)
    .where(eq(youtubeConnectionsTable.id, connectionId));
  if (!connection?.channelId) return [];
  const accessToken = await youtubeAccessToken(connectionId);
  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "contentDetails");
  channelUrl.searchParams.set("id", connection.channelId);
  const channelResponse = await fetch(channelUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const channelPayload = await channelResponse.json() as {
    items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }>;
    error?: { message?: string };
  };
  if (!channelResponse.ok) {
    throw new Error(channelPayload.error?.message || `YouTube channel lookup failed (${channelResponse.status})`);
  }
  const uploadsPlaylistId = channelPayload.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) return [];

  const candidates: Array<{ videoId: string; publishedAt: string }> = [];
  let pageToken: string | undefined;
  do {
    const playlistUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    playlistUrl.searchParams.set("part", "contentDetails,snippet");
    playlistUrl.searchParams.set("playlistId", uploadsPlaylistId);
    playlistUrl.searchParams.set("maxResults", "50");
    if (pageToken) playlistUrl.searchParams.set("pageToken", pageToken);
    const playlistResponse = await fetch(playlistUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const playlistPayload = await playlistResponse.json() as {
      nextPageToken?: string;
      items?: Array<{
        contentDetails?: { videoId?: string; videoPublishedAt?: string };
        snippet?: { publishedAt?: string; resourceId?: { videoId?: string } };
      }>;
      error?: { message?: string };
    };
    if (!playlistResponse.ok) {
      throw new Error(playlistPayload.error?.message || `YouTube uploads lookup failed (${playlistResponse.status})`);
    }
    const pageItems = playlistPayload.items || [];
    let reachedOlderVideo = false;
    for (const item of pageItems) {
      const videoId = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId;
      const publishedAt = item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt;
      if (!videoId || !publishedAt) continue;
      if (new Date(publishedAt) < since) {
        reachedOlderVideo = true;
        continue;
      }
      candidates.push({ videoId, publishedAt });
    }
    pageToken = reachedOlderVideo ? undefined : playlistPayload.nextPageToken;
  } while (pageToken);

  if (!candidates.length) return [];
  const videos: YoutubeMilestoneVideo[] = [];
  for (let index = 0; index < candidates.length; index += 50) {
    const chunk = candidates.slice(index, index + 50);
    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("part", "snippet,statistics");
    videosUrl.searchParams.set("id", chunk.map((item) => item.videoId).join(","));
    const videosResponse = await fetch(videosUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const videosPayload = await videosResponse.json() as {
      items?: Array<{
        id?: string;
        snippet?: { title?: string; publishedAt?: string };
        statistics?: { viewCount?: string };
      }>;
      error?: { message?: string };
    };
    if (!videosResponse.ok) {
      throw new Error(videosPayload.error?.message || `YouTube statistics lookup failed (${videosResponse.status})`);
    }
    for (const item of videosPayload.items || []) {
      if (!item.id) continue;
      const candidate = candidates.find((entry) => entry.videoId === item.id);
      if (!candidate) continue;
      videos.push({
        videoId: item.id,
        title: item.snippet?.title || "Без названия",
        publishedAt: item.snippet?.publishedAt || candidate.publishedAt,
        viewCount: Number.parseInt(item.statistics?.viewCount || "0", 10) || 0,
        channelTitle: connection.channelTitle || "YouTube-канал",
      });
    }
  }
  return videos;
}

export async function syncYoutubeChannels(connectionId?: number): Promise<Array<{ id: number; channelId: string | null; channelTitle: string | null }>> {
  const sourceConnections = connectionId
    ? await db.select().from(youtubeConnectionsTable).where(eq(youtubeConnectionsTable.id, connectionId))
    : await db.select().from(youtubeConnectionsTable).orderBy(desc(youtubeConnectionsTable.updatedAt));
  if (!sourceConnections.length) throw new Error("YouTube is not connected");

  const existing = await db.select().from(youtubeConnectionsTable);
  let nextId = existing.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  for (const connection of sourceConnections) {
    const accessToken = await youtubeAccessToken(connection.id);
    const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await response.json() as {
      items?: Array<{ id?: string; snippet?: { title?: string } }>;
      error?: { message?: string };
    };
    if (!response.ok) throw new Error(payload.error?.message || `YouTube channel sync failed (${response.status})`);

    for (const channel of payload.items || []) {
      if (!channel.id) continue;
      const alreadyConnected = existing.find((item) => item.channelId === channel.id);
      if (alreadyConnected) {
        await db.update(youtubeConnectionsTable)
          .set({
            channelTitle: channel.snippet?.title || null,
            encryptedRefreshToken: connection.encryptedRefreshToken,
          })
          .where(eq(youtubeConnectionsTable.id, alreadyConnected.id));
        alreadyConnected.channelTitle = channel.snippet?.title || null;
        alreadyConnected.encryptedRefreshToken = connection.encryptedRefreshToken;
        continue;
      }
      const [created] = await db.insert(youtubeConnectionsTable).values({
        id: nextId++,
        channelId: channel.id,
        channelTitle: channel.snippet?.title || null,
        encryptedRefreshToken: connection.encryptedRefreshToken,
      }).returning();
      if (created) existing.push(created);
    }
  }
  return listYoutubeConnections();
}

export async function youtubeConnectionStatus(connectionId?: number): Promise<{ connected: boolean; channelTitle: string | null; connectionId: number | null }> {
  const [connection] = connectionId
    ? await db.select({ id: youtubeConnectionsTable.id, channelTitle: youtubeConnectionsTable.channelTitle })
      .from(youtubeConnectionsTable).where(eq(youtubeConnectionsTable.id, connectionId))
    : await db.select({ id: youtubeConnectionsTable.id, channelTitle: youtubeConnectionsTable.channelTitle })
      .from(youtubeConnectionsTable).orderBy(desc(youtubeConnectionsTable.updatedAt)).limit(1);
  return { connected: Boolean(connection), channelTitle: connection?.channelTitle || null, connectionId: connection?.id || null };
}

export async function updateYoutubeChannelBranding(
  connectionId: number,
  input: { title?: string; description?: string },
): Promise<{ title: string; description: string }> {
  const requestedTitle = input.title === undefined ? undefined : input.title.trim();
  const requestedDescription = input.description === undefined ? undefined : input.description.trim();
  if (requestedTitle !== undefined && !requestedTitle) {
    throw new Error("Название канала не может быть пустым.");
  }
  if (requestedTitle && requestedTitle.length > 100) {
    throw new Error("Название канала должно быть не длиннее 100 символов.");
  }
  if (requestedDescription !== undefined && requestedDescription.length > 5_000) {
    throw new Error("Описание канала должно быть не длиннее 5000 символов.");
  }

  const [connection] = await db.select().from(youtubeConnectionsTable)
    .where(eq(youtubeConnectionsTable.id, connectionId));
  if (!connection?.channelId) throw new Error("YouTube-канал не найден.");

  const accessToken = await youtubeAccessToken(connectionId);
  const channelUrl = new URL("https://www.googleapis.com/youtube/v3/channels");
  channelUrl.searchParams.set("part", "snippet,brandingSettings");
  channelUrl.searchParams.set("id", connection.channelId);
  const currentResponse = await fetch(channelUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const currentPayload = await currentResponse.json() as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        description?: string;
        country?: string;
        defaultLanguage?: string;
      };
      brandingSettings?: {
        channel?: {
          description?: string;
          country?: string;
          defaultLanguage?: string;
          keywords?: string;
          trackingAnalyticsAccountId?: string;
          unsubscribedTrailer?: string;
        };
      };
    }>;
    error?: { message?: string };
  };
  if (!currentResponse.ok) {
    throw new Error(currentPayload.error?.message || `YouTube channel lookup failed (${currentResponse.status})`);
  }

  const currentSnippet = currentPayload.items?.[0]?.snippet;
  const currentBranding = currentPayload.items?.[0]?.brandingSettings?.channel;
  const title = requestedTitle || currentSnippet?.title || connection.channelTitle || "";
  const description = requestedDescription ?? currentBranding?.description ?? currentSnippet?.description ?? "";
  if (!title) throw new Error("Название канала не найдено.");
  if (requestedTitle && requestedTitle !== title) {
    throw new Error("YouTube не разрешает менять название канала через публичный API. Измените его вручную в YouTube Studio.");
  }
  const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=brandingSettings", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: connection.channelId,
      brandingSettings: {
        channel: {
          description,
          ...(currentBranding?.country ? { country: currentBranding.country } : {}),
          ...(currentBranding?.defaultLanguage ? { defaultLanguage: currentBranding.defaultLanguage } : {}),
          ...(currentBranding?.keywords ? { keywords: currentBranding.keywords } : {}),
          ...(currentBranding?.trackingAnalyticsAccountId
            ? { trackingAnalyticsAccountId: currentBranding.trackingAnalyticsAccountId }
            : {}),
          ...(currentBranding?.unsubscribedTrailer
            ? { unsubscribedTrailer: currentBranding.unsubscribedTrailer }
            : {}),
        },
      },
    }),
  });
  const payload = await response.json() as {
    brandingSettings?: { channel?: { description?: string } };
    error?: { message?: string };
  };
  if (!response.ok) {
    const message = payload.error?.message || `YouTube channel update failed (${response.status})`;
    if (/insufficient|permission|unauthorized|forbidden/i.test(message)) {
      throw new Error("Google ещё не выдал разрешение на управление каналом. Переподключите YouTube и подтвердите полный доступ.");
    }
    throw new Error(message);
  }

  const savedTitle = title;
  const savedDescription = payload.brandingSettings?.channel?.description ?? description;
  await db.update(youtubeConnectionsTable)
    .set({ channelTitle: savedTitle })
    .where(eq(youtubeConnectionsTable.id, connectionId));
  return { title: savedTitle, description: savedDescription };
}

type YoutubeVideoProbe = {
  streams?: Array<{
    codec_type?: string;
    duration?: string;
    width?: number;
    height?: number;
  }>;
  format?: { duration?: string };
};

async function ensureYoutubeShortVideo(video: Buffer): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "youtube-short-normalize-"));
  const sourcePath = join(dir, "source.mp4");
  const outputPath = join(dir, "short.mp4");
  try {
    await writeFile(sourcePath, video);
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "stream=codec_type,duration,width,height:format=duration",
      "-of", "json",
      sourcePath,
    ]);
    const probe = JSON.parse(stdout) as YoutubeVideoProbe;
    const videoStream = probe.streams?.find((stream) => stream.codec_type === "video");
    const duration = Number.parseFloat(probe.format?.duration || videoStream?.duration || "0");
    const width = Number(videoStream?.width || 0);
    const height = Number(videoStream?.height || 0);
    if (!Number.isFinite(duration) || duration <= 0 || !width || !height) {
      throw new Error("Не удалось определить параметры видео перед загрузкой.");
    }
    if (duration > MAX_YOUTUBE_SHORT_SECONDS) {
      throw new Error("Видео длиннее 3 минут и не может быть опубликовано как YouTube Shorts.");
    }
    if (width === 1080 && height === 1920) return video;

    await execFileAsync("ffmpeg", [
      "-y",
      "-i", sourcePath,
      "-map", "0:v:0",
      "-map", "0:a?",
      "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,format=yuv420p",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "18",
      "-maxrate", "2600k",
      "-bufsize", "5200k",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      "-ar", "48000",
      "-sn",
      "-movflags", "+faststart",
      outputPath,
    ], { timeout: 15 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });
    const normalized = await readFile(outputPath);
    if (!normalized.length) throw new Error("Не удалось подготовить вертикальный Shorts-файл.");
    return normalized;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function uploadYoutubeShort(params: {
  videoStoragePath: string;
  title: string;
  description: string;
  tags?: string[];
  thumbnail?: Buffer;
  thumbnailContentType?: string;
  privacyStatus?: "private" | "unlisted" | "public";
  connectionId?: number;
  preserveDescription?: boolean;
  publishAt?: Date;
}): Promise<{ videoId: string; privacyStatus: string; thumbnailSet: boolean; thumbnailError?: string }> {
  const accessToken = await youtubeAccessToken(params.connectionId);
  const sourceVideo = await readAudioAsset(params.videoStoragePath);
  const video = await ensureYoutubeShortVideo(sourceVideo);
  const privacyStatus = params.privacyStatus || process.env["YOUTUBE_DEFAULT_PRIVACY_STATUS"] || "private";
  const description = params.preserveDescription
    ? params.description.slice(0, 5000)
    : ensureYoutubeBrandMarkers(params.description);
  const scheduledPrivacyStatus = params.publishAt ? "private" : privacyStatus;
  const tags = normalizeYoutubeTags(params.tags || []);
  const metadata = {
    snippet: {
      title: params.title.slice(0, 100),
      description,
      tags,
      categoryId: "22",
    },
    status: {
      privacyStatus: scheduledPrivacyStatus,
      selfDeclaredMadeForKids: false,
      ...(params.publishAt ? { publishAt: params.publishAt.toISOString() } : {}),
    },
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
  if (!init.ok) {
    const detail = (await init.text()).replace(/\s+/g, " ").trim().slice(0, 600);
    let reason = detail;
    try {
      const payload = JSON.parse(detail) as {
        error?: {
          message?: string;
          errors?: Array<{ reason?: string; message?: string }>;
        };
      };
      const apiError = payload.error;
      const apiReason = apiError?.errors?.find((entry) => entry.reason || entry.message);
      reason = [
        apiReason?.reason,
        apiError?.message || apiReason?.message,
      ].filter(Boolean).join(": ") || detail;
    } catch {
      // Keep the raw response when YouTube does not return JSON.
    }
    throw new Error(`YouTube upload initialization failed (${init.status})${reason ? `: ${reason}` : ""}`);
  }
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
  let thumbnailError: string | undefined;
  if (params.thumbnail?.length) {
    const thumbnailResponse = await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?uploadType=media&videoId=${encodeURIComponent(payload.id)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": params.thumbnailContentType || "image/jpeg",
        "Content-Length": String(params.thumbnail.length),
      },
      body: params.thumbnail,
    });
    if (!thumbnailResponse.ok) {
      const thumbnailResponseBody = await thumbnailResponse.text();
      thumbnailError = thumbnailResponse.status === 403
        ? "YouTube не разрешил этому каналу пользовательские обложки."
        : `YouTube не установил обложку (${thumbnailResponse.status}): ${thumbnailResponseBody.slice(0, 300)}`;
    } else {
      thumbnailSet = true;
    }
  }
  return {
    videoId: payload.id,
    privacyStatus: payload.status?.privacyStatus || scheduledPrivacyStatus,
    thumbnailSet,
    ...(thumbnailError ? { thumbnailError } : {}),
  };
}

export const DEFAULT_YOUTUBE_COMMENT = "Сервис поиска в профиле";

export async function postYoutubeComment(params: {
  videoId: string;
  text?: string;
  connectionId?: number;
}): Promise<{ commentId: string }> {
  const accessToken = await youtubeAccessToken(params.connectionId);
  const response = await fetch(
    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        snippet: {
          videoId: params.videoId,
          topLevelComment: {
            snippet: { textOriginal: params.text || DEFAULT_YOUTUBE_COMMENT },
          },
        },
      }),
    },
  );
  const payload = await response.json() as {
    id?: string;
    error?: { message?: string };
  };
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message || `YouTube comment creation failed (${response.status})`);
  }
  return { commentId: payload.id };
}

export type YoutubeMetadata = {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
};

export type YoutubeMetadataContentType = "story" | "finance" | "crypto";

export const REQUIRED_YOUTUBE_BRAND_MARKERS = [
  "@viberolebot",
  "#viberolebot",
  "#вайббот",
] as const;

export function ensureYoutubeBrandMarkers(description: string): string {
  const base = description.trim();
  const normalizedBase = base.toLocaleLowerCase();
  const missing = REQUIRED_YOUTUBE_BRAND_MARKERS.filter((marker) =>
    !normalizedBase.includes(marker.toLocaleLowerCase()),
  );
  if (!missing.length) return base.slice(0, 5000);
  const suffix = missing.join(" ");
  const baseLimit = Math.max(0, 5000 - suffix.length - 2);
  const trimmedBase = base.slice(0, baseLimit).trimEnd();
  return `${trimmedBase}${trimmedBase ? "\n\n" : ""}${suffix}`.slice(0, 5000);
}

function readableYoutubeScriptText(scriptText?: string): string {
  const raw = scriptText?.trim() || "";
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return raw;
    if (typeof parsed.youtubeSourceScriptText === "string" && parsed.youtubeSourceScriptText.trim()) {
      return parsed.youtubeSourceScriptText.trim();
    }
    const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];
    const spokenScenes = scenes
      .filter((scene): scene is Record<string, unknown> => Boolean(scene) && typeof scene === "object" && !Array.isArray(scene))
      .map((scene) => typeof scene.voice_text === "string" ? scene.voice_text : "")
      .filter(Boolean);
    return [
      typeof parsed.title === "string" ? parsed.title : "",
      typeof parsed.hook === "string" ? parsed.hook : "",
      typeof parsed.description === "string" ? parsed.description : "",
      ...spokenScenes,
      typeof parsed.ending === "string" ? parsed.ending : "",
      typeof parsed.cta === "string" ? parsed.cta : "",
    ].filter(Boolean).join("\n\n").trim() || raw;
  } catch {
    return raw;
  }
}

function youtubeContext(input: { topic: string; description: string; scriptText?: string }): { city: string; profession: string; hero: string; plot: string } {
  const readableScript = readableYoutubeScriptText(input.scriptText);
  const sourceText = `${input.topic}\n${input.description}\n${readableScript}`;
  const city = input.topic.match(/город\s*:\s*([^.\n]+)/iu)?.[1]?.trim() || "";
  const profession = input.topic.match(/професс(?:ия|ию)\s*:\s*([^.\n]+)/iu)?.[1]?.trim()
    || (/\bкурьер\b/iu.test(sourceText) ? "курьер" : "герой");
  const hero = input.description.match(/\bя\s+([А-ЯЁ][а-яё-]+)/u)?.[1] || "герой";
  const plot = readableScript
    || input.description.match(/Сюжет:\s*([\s\S]*?)(?:\n\n|Что происходит|Финал:|$)/iu)?.[1]?.trim()
    || input.description.replace(/^(?:Название|Завязка|Сюжет|Что происходит в ролике|Финал):\s*/gim, "").trim();
  return { city, profession, hero, plot };
}

const DELIVERY_TERMS = /\b(?:заказ\p{L}*|курьер\p{L}*|достав\p{L}*|яндекс\s*ед\p{L}*)\b/iu;

function sourceExplicitlyMentionsDelivery(input: { title: string; topic: string; description: string; scriptText?: string }): boolean {
  return DELIVERY_TERMS.test(`${input.title}\n${input.topic}\n${input.description}\n${input.scriptText || ""}`);
}

function removeUnrequestedDeliveryMetadata(metadata: YoutubeMetadata): YoutubeMetadata {
  const cleanTitle = metadata.title
    .replace(DELIVERY_TERMS, "")
    .replace(/\s{2,}/gu, " ")
    .replace(/\s+([:—,-])/gu, "$1")
    .replace(/([:—,-])\s*([:—,-])/gu, "$1")
    .trim();
  const cleanDescription = metadata.description
    .split(/\n+|(?<=[.!?])\s+/u)
    .filter((part) => !DELIVERY_TERMS.test(part))
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return {
    ...metadata,
    title: cleanTitle || "Что произошло дальше?",
    description: cleanDescription || "История, которую стоит досмотреть до конца.",
    tags: metadata.tags.filter((tag) => !DELIVERY_TERMS.test(tag)),
  };
}

const SEO_STOP_WORDS = new Set([
  "когда", "который", "которая", "которые", "этот", "этого", "потом", "после",
  "перед", "между", "через", "только", "самый", "свой", "свою", "было", "стало",
  "один", "одна", "одном", "очень", "история", "ролик", "герой", "девушка",
  "мужчина", "женщина", "сегодня", "каждый", "начала", "конце", "просто",
]);

function storyKeywords(input: { topic: string; description: string; scriptText?: string }): string[] {
  const words = `${input.topic} ${input.description} ${readableYoutubeScriptText(input.scriptText)}`
    .toLocaleLowerCase()
    .match(/[а-яёa-z0-9]{5,}/gu) || [];
  return [...new Set(words)]
    .filter((word) => !SEO_STOP_WORDS.has(word))
    .filter((word) => !DELIVERY_TERMS.test(word))
    .slice(0, 8);
}

function relevantYoutubeTags(input: {
  title: string;
  topic: string;
  description: string;
  scriptText?: string;
  contentType?: YoutubeMetadataContentType;
}): string[] {
  const context = youtubeContext(input);
  const deliveryContext = sourceExplicitlyMentionsDelivery(input);
  const keywords = storyKeywords(input);
  const contentType = input.contentType ?? "story";
  const topicTicker = input.topic.trim().match(/^\$?([A-Z0-9]{2,20})(?:USDT)?$/i)?.[1];
  const tags = contentType === "story"
    ? [
        "shorts",
        "история из жизни",
        deliveryContext ? "истории курьера" : "",
        deliveryContext ? "работа курьером" : "",
        deliveryContext ? "доставка" : "",
        deliveryContext ? context.profession : "",
        deliveryContext && context.city ? `${context.profession} ${context.city}` : "",
        deliveryContext && context.city ? `доставка ${context.city}` : "",
        deliveryContext && /яндекс\s*ед/iu.test(`${input.topic} ${input.description}`) ? "Яндекс Еда" : "",
        deliveryContext && /новосибирск/iu.test(`${input.topic} ${input.description}`) ? "курьер Новосибирск" : "",
        ...keywords,
      ]
    : [
        "shorts",
        contentType === "crypto" ? "криптовалюта" : "финансы",
        contentType === "crypto" ? "крипторынок" : "финансовое образование",
        topicTicker?.toLocaleUpperCase("en-US") || "",
        ...keywords,
      ];
  return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 30);
}

export function fallbackYoutubeMetadata(input: {
  title: string;
  topic: string;
  description: string;
  scriptText?: string;
  channelTitle?: string;
  contentType?: YoutubeMetadataContentType;
}): YoutubeMetadata {
  return buildFallbackYoutubeMetadata(input);
}

export async function generateYoutubeMetadata(input: {
  title: string;
  topic: string;
  description: string;
  scriptText: string;
  contentType?: YoutubeMetadataContentType;
  channelTitle?: string;
  avoidTitles?: string[];
  avoidDescriptions?: string[];
}): Promise<YoutubeMetadata> {
  const fallback = fallbackYoutubeMetadata(input);
  const readableScript = readableYoutubeScriptText(input.scriptText);
  if (!openRouterConfig.apiKey) return fallback;
  const prompt = [
    "Ты YouTube SEO-редактор для русскоязычных вертикальных Shorts.",
    "Верни только валидный JSON без markdown.",
    ...(input.contentType === "finance" || input.contentType === "crypto"
      ? [
          `Тематика ролика: ${input.contentType === "crypto" ? "криптовалюта и крипторынок" : "личные финансы и финансовое образование"}.`,
          "Создай короткое кликабельное SEO-название до 60 символов: интрига и сильный интерес, но без ложных обещаний и неподтверждённых выводов.",
          "Заголовок, описание, теги и хэштеги должны точно соответствовать теме и полному исходному сценарию именно этого ролика.",
          "Описание до 1000 символов в 2 коротких абзацах: естественно включи поисковые фразы по теме, объясни пользу ролика, не добавляй прогнозы цены, гарантии дохода, причинно-следственные выводы или финансовые советы, которых нет в исходных данных.",
          "Добавь ясное образовательное уточнение, что ролик не является индивидуальной инвестиционной рекомендацией.",
          "Верни ровно 3 релевантных хэштега и добавь их в конец описания. Теги — обычные поисковые фразы без символа #, максимум 30.",
          "Никогда не вставляй JSON, названия служебных полей или структуру сцен.",
        ]
      : [
          "Придумай короткий цепляющий заголовок до 60 символов в стиле Shorts: интрига, конфликт или неожиданный поворот.",
          "Заголовок, описание и хэштеги должны быть придуманы заново по полному исходному сценарию именно этого ролика. Не используй шаблон «Авторская история» и не копируй SEO-данные другого канала.",
          "Описание должно быть до 1000 символов, написано обычным человеческим языком в 2 коротких абзацах.",
          "Начни с общей подводки в духе: «У каждого рабочего дня бывают интересные истории, которыми хочется поделиться. Так и у нашего героя…». Затем в 2–3 предложениях объясни, какая история произошла с героем.",
          "Пиши о ролике как о публикации, а не как о сценарии: не пересказывай сцены по порядку, не перечисляй действия героя, не раскрывай весь финал и не копируй voice_text.",
          "Указывай профессию, город, доставку или заказ только если они прямо есть в исходных данных. Ничего из этой темы не добавляй самостоятельно.",
          "Никогда не вставляй JSON, названия полей вроде scenes, cause, action, change, image_prompt или служебную структуру сценария.",
          "Верни ровно 3 хэштега, и они обязательно должны быть добавлены в конец описания.",
          "Заголовок должен быть привлекательным, но не обещать того, чего нет в сюжете. Теги должны быть конкретными и релевантными: профессия, город, доставка, работа курьером и тема истории.",
        ]),
    "Если указан канал, используй его только как дополнительный контекст бренда, но не делай одинаковое название для разных каналов.",
    JSON.stringify({
      content_type: input.contentType ?? "story",
      title: input.title,
      channel: input.channelTitle || "",
      topic: input.topic,
      description: input.description,
       script: readableScript.slice(0, 12000),
      do_not_repeat_titles: input.avoidTitles || [],
      do_not_repeat_descriptions: input.avoidDescriptions || [],
    }),
    JSON.stringify({
      title: "Короткий цепляющий заголовок",
      description: "Описание ролика\n\n#shorts #тема #разбор",
      tags: ["shorts", "тема ролика"],
      hashtags: ["#shorts", "#тема", "#разбор"],
    }),
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
    const generatedTags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
      : [];
    const tags = [...new Set([...generatedTags, ...relevantYoutubeTags(input)])].slice(0, 30);
    const parsedHashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().replace(/^#?/, "#"))
        .filter(Boolean)
        .slice(0, 3)
      : [];
    const genericHashtags = new Set(["#shorts", "#история", "#сюжет", "#ai"]);
    const hasThematicHashtag = parsedHashtags.some((tag) => !genericHashtags.has(tag.toLocaleLowerCase()));
    const hashtags = parsedHashtags.length === 3 && hasThematicHashtag ? parsedHashtags : fallback.hashtags;
    const looksLikeTechnicalJson = /^\s*[\[{]/.test(descriptionBase)
      || /["'](?:scenes|image_prompt|scene_number|voice_text|story_beat|continuity)["']\s*:/i.test(descriptionBase)
      || /(?:^|\n)\s*(?:завязка|сюжет|что происходит в ролике|сцена\s*\d+)\s*:/iu.test(descriptionBase);
    const description = looksLikeTechnicalJson
      ? fallback.description
      : ensureYoutubeBrandMarkers(`${descriptionBase.replace(/(?:^|\s)#\S+/g, "").trim()}\n\n${hashtags.join(" ")}`);
    const generatedMetadata = sanitizeSpecializedYoutubeMetadata(
      { title: title || fallback.title, description, tags: tags.length ? tags : fallback.tags, hashtags },
      fallback,
      input.contentType,
    );
    const normalizedTitle = generatedMetadata.title.toLocaleLowerCase().replace(/\s+/gu, " ").trim();
    const normalizedDescription = generatedMetadata.description.toLocaleLowerCase().replace(/\s+/gu, " ").trim();
    const hasDuplicateTitle = (input.avoidTitles || []).some((value) =>
      value.toLocaleLowerCase().replace(/\s+/gu, " ").trim() === normalizedTitle,
    );
    const hasDuplicateDescription = (input.avoidDescriptions || []).some((value) =>
      value.toLocaleLowerCase().replace(/\s+/gu, " ").trim() === normalizedDescription,
    );
    if (hasDuplicateTitle || hasDuplicateDescription) {
      const uniqueFallback = fallbackYoutubeMetadata(input);
      return input.contentType && input.contentType !== "story"
        ? uniqueFallback
        : sourceExplicitlyMentionsDelivery(input)
          ? uniqueFallback
          : removeUnrequestedDeliveryMetadata(uniqueFallback);
    }
    return input.contentType && input.contentType !== "story"
      ? generatedMetadata
      : sourceExplicitlyMentionsDelivery(input)
        ? generatedMetadata
        : removeUnrequestedDeliveryMetadata(generatedMetadata);
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