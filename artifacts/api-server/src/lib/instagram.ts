import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db, instagramConnectionsTable } from "@workspace/db";

const INSTAGRAM_AUTH_URL = "https://www.instagram.com/oauth/authorize";
const INSTAGRAM_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const INSTAGRAM_GRAPH_URL = "https://graph.instagram.com";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function encryptionKey(): Buffer {
  const raw = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY
    || process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("INSTAGRAM_TOKEN_ENCRYPTION_KEY is not configured");
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : createHash("sha256").update(raw, "utf8").digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function signedState(): string {
  const payload = Buffer.from(JSON.stringify({
    nonce: randomBytes(24).toString("base64url"),
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  })).toString("base64url");
  const signature = createHmac("sha256", required("INSTAGRAM_CLIENT_SECRET"))
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifyState(state: string): void {
  const [payload, encodedSignature] = state.split(".");
  if (!payload || !encodedSignature) throw new Error("Instagram authorization state is invalid");
  const expectedSignature = createHmac("sha256", required("INSTAGRAM_CLIENT_SECRET"))
    .update(payload)
    .digest("base64url");
  const received = Buffer.from(encodedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("Instagram authorization state is invalid");
  }
  let stateData: { expiresAt?: number };
  try {
    stateData = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { expiresAt?: number };
  } catch {
    throw new Error("Instagram authorization state is invalid");
  }
  if (!stateData.expiresAt || stateData.expiresAt < Date.now()) {
    throw new Error("Instagram authorization state expired. Start the connection flow again.");
  }
}

export function createInstagramAuthorizationUrl(): string {
  const url = new URL(INSTAGRAM_AUTH_URL);
  url.searchParams.set("client_id", required("INSTAGRAM_CLIENT_ID"));
  url.searchParams.set("redirect_uri", required("INSTAGRAM_REDIRECT_URI"));
  url.searchParams.set("state", signedState());
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    [
      "instagram_business_basic",
      "instagram_business_content_publish",
    ].join(","),
  );
  return url.toString();
}

type GraphError = { error?: { message?: string; type?: string; code?: number } };

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${INSTAGRAM_GRAPH_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url);
  const payload = await response.json() as T & GraphError;
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message || `Instagram Graph API request failed (${response.status})`);
  }
  return payload;
}

export async function completeInstagramAuthorization(code: string, state: string): Promise<{
  accounts: Array<{ id: number; username: string | null; displayName: string | null }>;
}> {
  verifyState(state);
  const clientId = required("INSTAGRAM_CLIENT_ID");
  const clientSecret = required("INSTAGRAM_CLIENT_SECRET");
  const redirectUri = required("INSTAGRAM_REDIRECT_URI");
  const codeResponse = await fetch(INSTAGRAM_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const codePayload = await codeResponse.json() as { access_token?: string } & GraphError;
  if (!codeResponse.ok || !codePayload.access_token) {
    throw new Error(codePayload.error?.message || `Instagram authorization failed (${codeResponse.status})`);
  }

  const longLivedUrl = new URL(`${INSTAGRAM_GRAPH_URL}/access_token`);
  longLivedUrl.searchParams.set("grant_type", "ig_exchange_token");
  longLivedUrl.searchParams.set("client_secret", clientSecret);
  longLivedUrl.searchParams.set("access_token", codePayload.access_token);
  const longLivedResponse = await fetch(longLivedUrl);
  const longLivedPayload = await longLivedResponse.json() as { access_token?: string } & GraphError;
  if (!longLivedResponse.ok || !longLivedPayload.access_token) {
    throw new Error(longLivedPayload.error?.message || `Instagram token exchange failed (${longLivedResponse.status})`);
  }

  const profile = await graphGet<{
    user_id?: string;
    id?: string;
    username?: string;
    name?: string;
  }>("/me", {
    fields: "user_id,username,name",
    access_token: longLivedPayload.access_token,
  });
  const instagramUserId = profile.user_id || profile.id;
  if (!instagramUserId) throw new Error("Instagram не вернул идентификатор аккаунта.");

  const existing = await db.select({
    id: instagramConnectionsTable.id,
    instagramUserId: instagramConnectionsTable.instagramUserId,
  }).from(instagramConnectionsTable);
  const saved: Array<{ id: number; username: string | null; displayName: string | null }> = [];
  const values = {
    pageId: null,
    pageName: null,
    instagramUserId,
    username: profile.username || null,
    displayName: profile.name || null,
    encryptedAccessToken: encrypt(longLivedPayload.access_token),
    updatedAt: new Date(),
  };
  const alreadyConnected = existing.find((connection) => connection.instagramUserId === instagramUserId);
  if (alreadyConnected) {
    const [updated] = await db.update(instagramConnectionsTable)
      .set(values)
      .where(eq(instagramConnectionsTable.id, alreadyConnected.id))
      .returning({ id: instagramConnectionsTable.id });
    saved.push({
      id: updated.id,
      username: values.username,
      displayName: values.displayName,
    });
  } else {
    const [created] = await db.insert(instagramConnectionsTable)
      .values(values)
      .returning({ id: instagramConnectionsTable.id });
    saved.push({
      id: created.id,
      username: values.username,
      displayName: values.displayName,
    });
  }
  return { accounts: saved };
}

export async function listInstagramConnections(): Promise<Array<{
  id: number;
  username: string | null;
  displayName: string | null;
  pageName: string | null;
  updatedAt: Date;
}>> {
  return db.select({
    id: instagramConnectionsTable.id,
    username: instagramConnectionsTable.username,
    displayName: instagramConnectionsTable.displayName,
    pageName: instagramConnectionsTable.pageName,
    updatedAt: instagramConnectionsTable.updatedAt,
  }).from(instagramConnectionsTable).orderBy(desc(instagramConnectionsTable.updatedAt));
}