import { createHmac, timingSafeEqual } from "node:crypto";

type UploadPayload = {
  chatId: number;
  fileName: string;
  caption: string;
  exp: number;
};

function secret(): string {
  const value = process.env["SESSION_SECRET"];
  if (!value) throw new Error("SESSION_SECRET is not configured");
  return value;
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createLargeVideoUploadToken(
  chatId: number,
  fileName: string | undefined,
  caption: string | undefined,
): string {
  const payload: UploadPayload = {
    chatId,
    fileName: (fileName || "uploaded-video.mp4").slice(0, 180),
    caption: (caption || "").slice(0, 2000),
    exp: Date.now() + 30 * 60 * 1000,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${signature(encoded)}`;
}

export function verifyLargeVideoUploadToken(token: string): UploadPayload {
  const [encoded, provided] = token.split(".");
  if (!encoded || !provided) throw new Error("Invalid upload link");
  const expected = signature(encoded);
  if (provided.length !== expected.length || !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    throw new Error("Invalid upload link");
  }
  const payload = JSON.parse(decode(encoded)) as UploadPayload;
  if (!payload.chatId || payload.exp < Date.now()) throw new Error("Upload link expired");
  return payload;
}

export function uploadBaseUrl(): string {
  const configured = process.env["PUBLIC_APP_URL"] || process.env["REPLIT_DEV_DOMAIN"];
  if (!configured) throw new Error("PUBLIC_APP_URL or REPLIT_DEV_DOMAIN is required");
  return `${configured.startsWith("http") ? configured : `https://${configured}`}`.replace(/\/+$/, "");
}