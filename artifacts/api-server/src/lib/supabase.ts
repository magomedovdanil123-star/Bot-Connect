import { createHash } from "node:crypto";
import { logger } from "./logger";

const DEFAULT_BUCKET = "ai-content-factory";
const configuredUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

export const supabaseConfigured = Boolean(configuredUrl && serviceKey);

function requireConfig(): { url: string; key: string } {
  if (!configuredUrl || !serviceKey) {
    throw new Error(
      "Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Replit Secrets.",
    );
  }
  return { url: configuredUrl, key: serviceKey };
}

async function supabaseFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { url, key } = requireConfig();
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${url}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(30_000) });
}

function encodePath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export type SupabaseMediaAsset = {
  id?: string;
  fingerprint: string;
  kind: "image" | "video" | "audio";
  bucket: string;
  object_path: string;
  content_type: string;
  size_bytes: number;
  metadata?: Record<string, unknown>;
  project_id?: number | null;
  scene_id?: number | null;
};

export async function ensureSupabaseStorage(): Promise<void> {
  if (!supabaseConfigured) return;
  const response = await supabaseFetch("/storage/v1/bucket", {
    method: "POST",
    body: JSON.stringify({ id: DEFAULT_BUCKET, name: DEFAULT_BUCKET, public: false }),
  });
  if (!response.ok && response.status !== 409 && response.status !== 400) {
    const message = await response.text();
    throw new Error(`Supabase Storage bucket setup failed (${response.status}): ${message.slice(0, 300)}`);
  }
}

export async function checkSupabaseSchema(): Promise<void> {
  if (!supabaseConfigured) {
    logger.warn("Supabase persistence is disabled: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing");
    return;
  }
  const response = await supabaseFetch("/rest/v1/media_assets?select=id&limit=1");
  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Supabase schema is not ready (${response.status}). Apply artifacts/api-server/supabase/schema.sql in the Supabase SQL editor. ${message.slice(0, 300)}`,
    );
  }
  await ensureSupabaseStorage();
  logger.info("Supabase persistence is ready");
}

export async function findMediaAsset(fingerprint: string): Promise<SupabaseMediaAsset | null> {
  if (!supabaseConfigured) return null;
  const response = await supabaseFetch(
    `/rest/v1/media_assets?fingerprint=eq.${encodeURIComponent(fingerprint)}&select=*&limit=1`,
  );
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Supabase media lookup failed (${response.status})`);
  }
  const rows = await response.json() as SupabaseMediaAsset[];
  return rows[0] ?? null;
}

export async function downloadMediaAsset(asset: SupabaseMediaAsset): Promise<Buffer> {
  const response = await supabaseFetch(
    `/storage/v1/object/${encodeURIComponent(asset.bucket)}/${encodePath(asset.object_path)}`,
  );
  if (!response.ok) throw new Error(`Supabase media download failed (${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

export async function saveMediaAsset(params: {
  kind: SupabaseMediaAsset["kind"];
  buffer: Buffer;
  contentType: string;
  fingerprint?: string;
  projectId?: number;
  sceneId?: number;
  metadata?: Record<string, unknown>;
}): Promise<{ asset: SupabaseMediaAsset; reused: boolean; buffer: Buffer }> {
  const fingerprint = params.fingerprint ?? sha256(params.buffer);
  const existing = await findMediaAsset(fingerprint);
  if (existing) {
    try {
      return { asset: existing, reused: true, buffer: await downloadMediaAsset(existing) };
    } catch (error) {
      logger.warn({ err: error, fingerprint }, "Supabase asset exists but could not be downloaded; regenerating upload");
    }
  }

  const bucket = DEFAULT_BUCKET;
  const objectPath = `${params.kind}/${new Date().toISOString().slice(0, 10)}/${fingerprint}.${params.kind === "video" ? "mp4" : params.kind === "audio" ? "mp3" : "png"}`;
  const upload = await supabaseFetch(`/storage/v1/object/${encodeURIComponent(bucket)}/${encodePath(objectPath)}`, {
    method: "POST",
    headers: { "Content-Type": params.contentType, "x-upsert": "true", "cache-control": "31536000" },
    body: params.buffer,
  });
  if (!upload.ok) throw new Error(`Supabase media upload failed (${upload.status}): ${(await upload.text()).slice(0, 300)}`);

  const asset: SupabaseMediaAsset = {
    fingerprint,
    kind: params.kind,
    bucket,
    object_path: objectPath,
    content_type: params.contentType,
    size_bytes: params.buffer.byteLength,
    project_id: params.projectId ?? null,
    scene_id: params.sceneId ?? null,
    metadata: params.metadata,
  };
  const insert = await supabaseFetch("/rest/v1/media_assets", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(asset),
  });
  if (!insert.ok) throw new Error(`Supabase media metadata save failed (${insert.status}): ${(await insert.text()).slice(0, 300)}`);
  const saved = await insert.json() as SupabaseMediaAsset[];
  return { asset: saved[0] ?? asset, reused: false, buffer: params.buffer };
}

export async function linkMediaToSeries(params: {
  seriesId: number;
  episodeId?: number;
  projectId?: number;
  sceneId?: number;
  assetId: string;
}): Promise<void> {
  if (!supabaseConfigured) return;
  const response = await supabaseFetch("/rest/v1/series_media_links", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      series_id: params.seriesId,
      episode_id: params.episodeId ?? null,
      project_id: params.projectId ?? null,
      scene_id: params.sceneId ?? null,
      asset_id: params.assetId,
    }),
  });
  if (!response.ok) throw new Error(`Supabase series media link failed (${response.status})`);
}

export async function saveSeriesMemory(params: {
  seriesId: number;
  episodeId?: number;
  eventType: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  if (!supabaseConfigured) return;
  const response = await supabaseFetch("/rest/v1/series_memory_events", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      series_id: params.seriesId,
      episode_id: params.episodeId ?? null,
      event_type: params.eventType,
      payload: params.payload,
    }),
  });
  if (!response.ok) throw new Error(`Supabase series memory save failed (${response.status})`);
}

export async function saveSeriesSnapshot(params: {
  seriesId: number;
  bible: unknown;
  continuity?: Record<string, unknown>;
}): Promise<void> {
  if (!supabaseConfigured) return;
  const response = await supabaseFetch("/rest/v1/series_memory_snapshots", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      series_id: params.seriesId,
      bible: params.bible,
      continuity: params.continuity ?? {},
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Supabase series snapshot save failed (${response.status})`);
}