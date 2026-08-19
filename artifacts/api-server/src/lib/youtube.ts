import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { OAuth2Client } from "google-auth-library";
import { db, youtubeConnectionsTable } from "@workspace/db";
import { readAudioAsset } from "./audio-design/storage";

const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const oauthStates = new Map<string, number>();

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
  return Buffer.from(raw, "base64").length === 32
    ? Buffer.from(raw, "base64")
    : createCipheriv("aes-256-gcm", Buffer.alloc(32), Buffer.alloc(12)).constructor
      ? (() => {
          const key = Buffer.from(raw, "utf8");
          if (key.length !== 32) throw new Error("YOUTUBE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
          return key;
        })()
      : Buffer.alloc(32);
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
  const state = randomBytes(24).toString("base64url");
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  for (const [key, expiresAt] of oauthStates) if (expiresAt < Date.now()) oauthStates.delete(key);
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [YOUTUBE_SCOPE],
    state,
  });
}

async function youtubeAccessToken(): Promise<string> {
  const [connection] = await db.select().from(youtubeConnectionsTable).where(eq(youtubeConnectionsTable.id, 1));
  if (!connection) throw new Error("YouTube is not connected");
  const client = oauthClient();
  client.setCredentials({ refresh_token: decrypt(connection.encryptedRefreshToken) });
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("YouTube access token could not be refreshed");
  return token.token;
}

export async function completeYoutubeAuthorization(code: string, state: string): Promise<string | null> {
  const expiresAt = oauthStates.get(state);
  if (!expiresAt || expiresAt < Date.now()) throw new Error("YouTube authorization state expired");
  oauthStates.delete(state);
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token; revoke the old app grant and try again");
  client.setCredentials(tokens);
  const accessToken = await client.getAccessToken();
  if (!accessToken.token) throw new Error("YouTube access token could not be verified");
  const response = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken.token}` },
  });
  if (!response.ok) throw new Error(`YouTube channel lookup failed (${response.status})`);
  const payload = await response.json() as { items?: Array<{ snippet?: { title?: string } }> };
  const channelTitle = payload.items?.[0]?.snippet?.title || null;
  await db.insert(youtubeConnectionsTable).values({
    id: 1,
    channelTitle,
    encryptedRefreshToken: encrypt(tokens.refresh_token),
  }).onConflictDoUpdate({
    target: youtubeConnectionsTable.id,
    set: { channelTitle, encryptedRefreshToken: encrypt(tokens.refresh_token), updatedAt: new Date() },
  });
  return channelTitle;
}

export async function youtubeConnectionStatus(): Promise<{ connected: boolean; channelTitle: string | null }> {
  const [connection] = await db.select({ channelTitle: youtubeConnectionsTable.channelTitle })
    .from(youtubeConnectionsTable).where(eq(youtubeConnectionsTable.id, 1));
  return { connected: Boolean(connection), channelTitle: connection?.channelTitle || null };
}

export async function uploadYoutubeShort(params: {
  videoStoragePath: string;
  title: string;
  description: string;
  tags?: string[];
}): Promise<{ videoId: string; privacyStatus: string }> {
  const accessToken = await youtubeAccessToken();
  const video = await readAudioAsset(params.videoStoragePath);
  const privacyStatus = process.env["YOUTUBE_DEFAULT_PRIVACY_STATUS"] || "private";
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
  return { videoId: payload.id, privacyStatus: payload.status?.privacyStatus || privacyStatus };
}