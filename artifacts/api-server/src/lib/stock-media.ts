import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { saveMediaAsset, sha256, supabaseConfigured, type SupabaseMediaAsset } from "./supabase";
import { logger } from "./logger";

export type StockMediaKind = "image" | "video";

export type StockMediaCandidate = {
  provider: "pexels" | "openverse" | "wikimedia-commons";
  id: string;
  kind: StockMediaKind;
  title: string;
  sourceUrl: string;
  downloadUrl: string;
  creator: string | null;
  creatorUrl: string | null;
  license: string;
  licenseUrl: string | null;
  attribution: string | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  contentType: string | null;
};

export type StoredStockMedia = StockMediaCandidate & {
  storageAsset: Pick<SupabaseMediaAsset, "fingerprint" | "bucket" | "object_path" | "content_type" | "size_bytes">;
};

export type StockMediaSearchResult = {
  assets: StoredStockMedia[];
  errors: string[];
};

const MAX_DOWNLOAD_BYTES = 45 * 1024 * 1024;
const MAX_SOURCE_DOWNLOAD_BYTES = 120 * 1024 * 1024;
const SEARCH_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const execFileAsync = promisify(execFile);

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isCommerciallyUsableLicense(license: string | null): boolean {
  if (!license) return false;
  const normalized = license.toLocaleLowerCase();
  if (normalized.includes("nc") || normalized.includes("nd")) return false;
  return normalized.includes("cc0")
    || normalized.includes("pdm")
    || normalized === "by"
    || normalized === "by-sa"
    || normalized.includes("public domain")
    || normalized.includes("zero");
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    signal: init.signal ?? AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Stock provider returned ${response.status}`);
  return response.json();
}

function pexelsApiKey(): string {
  return process.env["PEXELS_API_KEY"]?.trim() || "";
}

function pexelsHeaders(): Record<string, string> {
  return { Authorization: pexelsApiKey() };
}

async function searchPexels(query: string, kind: StockMediaKind): Promise<StockMediaCandidate[]> {
  if (!pexelsApiKey()) return [];
  const endpoint = kind === "image" ? "photos" : "videos";
  const url = new URL(`https://api.pexels.com/v1/search`);
  if (kind === "video") url.pathname = "/videos/search";
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "portrait");
  const data = await fetchJson(url.toString(), { headers: pexelsHeaders() }) as Record<string, unknown>;
  if (kind === "image") {
    const photos = Array.isArray(data.photos) ? data.photos : [];
    return photos.flatMap((photo): StockMediaCandidate[] => {
      if (!photo || typeof photo !== "object") return [];
      const raw = photo as Record<string, unknown>;
      const src = raw.src && typeof raw.src === "object" ? raw.src as Record<string, unknown> : {};
      const sourceUrl = asString(raw.url);
      const downloadUrl = asString(src.portrait) || asString(src.large2x) || asString(src.original);
      if (!sourceUrl || !downloadUrl) return [];
      return [{
        provider: "pexels",
        id: String(raw.id || downloadUrl),
        kind,
        title: asString(raw.alt) || query,
        sourceUrl,
        downloadUrl,
        creator: asString(raw.photographer),
        creatorUrl: asString(raw.photographer_url),
        license: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attribution: asString(raw.photographer) ? `Photo by ${raw.photographer} via Pexels` : "Pexels",
        width: asNumber(raw.width),
        height: asNumber(raw.height),
        durationSeconds: null,
        contentType: "image/jpeg",
      }];
    });
  }
  const videos = Array.isArray(data.videos) ? data.videos : [];
  return videos.flatMap((video): StockMediaCandidate[] => {
    if (!video || typeof video !== "object") return [];
    const raw = video as Record<string, unknown>;
    const files = Array.isArray(raw.video_files) ? raw.video_files : [];
    const file = files
      .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate && typeof candidate === "object"))
      .filter((candidate) => asString(candidate.link)?.startsWith("http"))
      .sort((a, b) => {
        const aSize = Math.abs((asNumber(a.width) || 720) - 720);
        const bSize = Math.abs((asNumber(b.width) || 720) - 720);
        return aSize - bSize;
      })[0];
    const sourceUrl = asString(raw.url);
    const downloadUrl = file ? asString(file.link) : null;
    if (!sourceUrl || !downloadUrl) return [];
    return [{
      provider: "pexels",
      id: String(raw.id || downloadUrl),
      kind,
      title: query,
      sourceUrl,
      downloadUrl,
      creator: asString(raw.user && typeof raw.user === "object" ? (raw.user as Record<string, unknown>).name : null),
      creatorUrl: asString(raw.user && typeof raw.user === "object" ? (raw.user as Record<string, unknown>).url : null),
      license: "Pexels License",
      licenseUrl: "https://www.pexels.com/license/",
      attribution: "Pexels",
      width: file ? asNumber(file.width) : asNumber(raw.width),
      height: file ? asNumber(file.height) : asNumber(raw.height),
      durationSeconds: asNumber(raw.duration),
      contentType: asString(file?.file_type) || "video/mp4",
    }];
  });
}

async function searchOpenverse(query: string): Promise<StockMediaCandidate[]> {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "8");
  url.searchParams.set("mature", "false");
  url.searchParams.set("license_type", "commercial");
  const data = await fetchJson(url.toString()) as Record<string, unknown>;
  const results = Array.isArray(data.results) ? data.results : [];
  return results.flatMap((result): StockMediaCandidate[] => {
    if (!result || typeof result !== "object") return [];
    const raw = result as Record<string, unknown>;
    const downloadUrl = asString(raw.url);
    const sourceUrl = asString(raw.foreign_landing_url) || asString(raw.detail_url);
    const license = asString(raw.license);
    if (!downloadUrl || !sourceUrl || !isCommerciallyUsableLicense(license)) return [];
    return [{
      provider: "openverse",
      id: String(raw.id || downloadUrl),
      kind: "image",
      title: asString(raw.title) || query,
      sourceUrl,
      downloadUrl,
      creator: asString(raw.creator),
      creatorUrl: asString(raw.creator_url),
      license: license!,
      licenseUrl: asString(raw.license_url),
      attribution: asString(raw.attribution),
      width: asNumber(raw.width),
      height: asNumber(raw.height),
      durationSeconds: null,
      contentType: asString(raw.filetype),
    }];
  });
}

async function searchWikimediaVideo(query: string): Promise<StockMediaCandidate[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", `${query} filetype:video`);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|duration|extmetadata");
  url.searchParams.set("format", "json");
  const data = await fetchJson(url.toString()) as Record<string, unknown>;
  const pages = data.query && typeof data.query === "object"
    ? (data.query as Record<string, unknown>).pages
    : null;
  const values = pages && typeof pages === "object" ? Object.values(pages) : [];
  return values.flatMap((page): StockMediaCandidate[] => {
    if (!page || typeof page !== "object") return [];
    const rawPage = page as Record<string, unknown>;
    const info = Array.isArray(rawPage.imageinfo) && rawPage.imageinfo[0] && typeof rawPage.imageinfo[0] === "object"
      ? rawPage.imageinfo[0] as Record<string, unknown>
      : null;
    if (!info || !/^video\//i.test(asString(info.mime) || "") && !/^(application\/ogg|video\/ogg)$/i.test(asString(info.mime) || "")) {
      return [];
    }
    const ext = info.extmetadata && typeof info.extmetadata === "object"
      ? info.extmetadata as Record<string, unknown>
      : {};
    const metadataValue = (key: string): string | null => {
      const field = ext[key];
      return field && typeof field === "object" ? asString((field as Record<string, unknown>).value) : asString(field);
    };
    const downloadUrl = asString(info.url);
    const sourceUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(rawPage.title || "").replaceAll(" ", "_"))}`;
    if (!downloadUrl) return [];
    const size = asNumber(info.size);
    if (size && size > MAX_SOURCE_DOWNLOAD_BYTES) return [];
    return [{
      provider: "wikimedia-commons",
      id: String(rawPage.pageid || downloadUrl),
      kind: "video",
      title: String(rawPage.title || query).replace(/^File:/, ""),
      sourceUrl,
      downloadUrl,
      creator: metadataValue("Artist"),
      creatorUrl: null,
      license: metadataValue("LicenseShortName") || "Wikimedia Commons license",
      licenseUrl: metadataValue("LicenseUrl"),
      attribution: metadataValue("Attribution"),
      width: asNumber(info.width),
      height: asNumber(info.height),
      durationSeconds: asNumber(info.duration),
      contentType: asString(info.mime),
    }];
  });
}

async function downloadCandidate(candidate: StockMediaCandidate): Promise<StoredStockMedia> {
  if (!supabaseConfigured) {
    throw new Error("Supabase storage is required to save stock media.");
  }
  const response = await fetch(candidate.downloadUrl, {
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    headers: { "User-Agent": "AI-Content-Factory/1.0 stock-media downloader" },
  });
  if (!response.ok) throw new Error(`${candidate.provider} download returned ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) throw new Error("Stock file is larger than 45 MB");
  let buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_SOURCE_DOWNLOAD_BYTES) throw new Error("Stock source file is larger than 120 MB");
  let contentType = candidate.contentType || response.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  if (candidate.kind === "video" && contentType !== "video/mp4") {
    const tempDir = await mkdtemp(join("/tmp", "stock-video-"));
    const inputPath = join(tempDir, "source");
    const outputPath = join(tempDir, "normalized.mp4");
    try {
      await writeFile(inputPath, buffer);
      await execFileAsync("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel", "error",
        "-i", inputPath,
        "-t", "20",
        "-an",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "30",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        outputPath,
      ], { maxBuffer: 2 * 1024 * 1024 });
      buffer = await readFile(outputPath);
      contentType = "video/mp4";
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) throw new Error("Normalized stock file is larger than 45 MB");
  const saved = await saveMediaAsset({
    kind: candidate.kind,
    buffer,
    contentType,
    fingerprint: sha256(buffer),
    metadata: {
      provider: candidate.provider,
      sourceUrl: candidate.sourceUrl,
      title: candidate.title,
      creator: candidate.creator,
      creatorUrl: candidate.creatorUrl,
      license: candidate.license,
      licenseUrl: candidate.licenseUrl,
      attribution: candidate.attribution,
      width: candidate.width,
      height: candidate.height,
      durationSeconds: candidate.durationSeconds,
    },
  });
  return {
    ...candidate,
    storageAsset: {
      fingerprint: saved.asset.fingerprint,
      bucket: saved.asset.bucket,
      object_path: saved.asset.object_path,
      content_type: saved.asset.content_type,
      size_bytes: saved.asset.size_bytes,
    },
  };
}

async function findCandidate(query: string, kind: StockMediaKind): Promise<StockMediaCandidate | null> {
  const providers = kind === "image"
    ? [
      async () => searchPexels(query, kind),
      async () => searchOpenverse(query),
    ]
    : [
      async () => searchPexels(query, kind),
      async () => searchWikimediaVideo(query),
    ];
  for (const provider of providers) {
    try {
      const candidates = await provider();
      if (candidates[0]) return candidates[0];
    } catch (error) {
      logger.warn({ err: error, kind, query }, "Stock provider search failed");
    }
  }
  return null;
}

export async function collectHoroscopeStockMedia(queries: string[]): Promise<StockMediaSearchResult> {
  const fallbackQueries = [
    "mystical stars night sky",
    "zodiac constellation",
    "full moon night sky",
    "cosmic blue background",
  ];
  const normalizedQueries = [...new Set([
    ...queries.map((query) => query.trim()).filter(Boolean),
    ...fallbackQueries,
  ])].slice(0, 8);
  if (!normalizedQueries.length) return { assets: [], errors: ["No stock search queries were generated."] };
  const assets: StoredStockMedia[] = [];
  const errors: string[] = [];
  for (const kind of ["image", "video"] as const) {
    let saved: StoredStockMedia | null = null;
    const kindErrors: string[] = [];
    for (const query of normalizedQueries) {
      const candidate = await findCandidate(query, kind);
      if (!candidate) continue;
      try {
        saved = await downloadCandidate(candidate);
        break;
      } catch (error) {
        kindErrors.push(`${kind}: ${error instanceof Error ? error.message : "download failed"}`);
      }
    }
    if (saved) assets.push(saved);
    else errors.push(...kindErrors, `${kind}: no free stock asset found`);
  }
  return { assets, errors };
}