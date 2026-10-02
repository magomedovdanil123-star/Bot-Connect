import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { objectStorageClient } from "../objectStorage";

function privatePath(
  namespace: "music" | "sfx" | "audio-mix" | "video" | "financial-short",
  extension: string,
): string {
  const privateDir = process.env["PRIVATE_OBJECT_DIR"];
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return `${privateDir.replace(/\/$/, "")}/${namespace}/${randomUUID()}.${extension}`;
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  const [bucketName, ...parts] = path.replace(/^\/+/, "").split("/");
  return { bucketName, objectName: parts.join("/") };
}

function persistedPath(absolutePath: string): string {
  const privateDir = process.env["PRIVATE_OBJECT_DIR"]!.replace(/\/$/, "");
  return `/objects/${absolutePath.slice(privateDir.length + 1)}`;
}

function absolutePath(storagePath: string): string {
  const privateDir = process.env["PRIVATE_OBJECT_DIR"];
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  return `${privateDir.replace(/\/$/, "")}/${storagePath.replace(/^\/objects\//, "")}`;
}

export async function storeAudioAsset(
  buffer: Buffer,
  namespace: "music" | "sfx" | "audio-mix" | "video" | "financial-short",
  contentType = "audio/mpeg",
  extension = "mp3",
): Promise<string> {
  const path = privatePath(namespace, extension);
  const { bucketName, objectName } = parseObjectPath(path);
  await objectStorageClient.bucket(bucketName).file(objectName).save(buffer, {
    resumable: false,
    metadata: { contentType, cacheControl: "private, max-age=31536000" },
  });
  return persistedPath(path);
}

export async function readAudioAsset(storagePath: string): Promise<Buffer> {
  const { bucketName, objectName } = parseObjectPath(absolutePath(storagePath));
  const [buffer] = await objectStorageClient.bucket(bucketName).file(objectName).download();
  return buffer;
}

export async function copyAudioAssetToFile(storagePath: string, destinationPath: string): Promise<void> {
  const { bucketName, objectName } = parseObjectPath(absolutePath(storagePath));
  await pipeline(
    objectStorageClient.bucket(bucketName).file(objectName).createReadStream(),
    createWriteStream(destinationPath),
  );
}

export async function deleteAudioAsset(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  const { bucketName, objectName } = parseObjectPath(absolutePath(storagePath));
  await objectStorageClient.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
}

export function audioUrl(storagePath: string): string {
  return `/api/storage${storagePath}`;
}

export const assetUrl = audioUrl;
