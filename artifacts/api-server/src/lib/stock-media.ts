import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { saveMediaAsset, sha256, supabaseConfigured, type SupabaseMediaAsset } from "./supabase";
import { logger } from "./logger";

export type StockMediaKind = "image" | "video";

export type StockMediaCandidate = {
  provider: "pexels" | "openverse" | "wikimedia-commons" | "nasa";
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
  storageAsset: Pick<SupabaseMediaAsset, "id" | "fingerprint" | "bucket" | "object_path" | "content_type" | "size_bytes">;
};

export type StockMediaSearchResult = {
  assets: StoredStockMedia[];
  errors: string[];
};

const MAX_DOWNLOAD_BYTES = 45 * 1024 * 1024;
const MAX_SOURCE_DOWNLOAD_BYTES = 120 * 1024 * 1024;
const SEARCH_TIMEOUT_MS = 20_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const USER_AGENT = "AI-Content-Factory/1.0 (licensed stock media collector)";
const execFileAsync = promisify(execFile);

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(init.headers || {}),
      },
      signal: init.signal ?? AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    });
    if (response.ok) return response.json();
    if (response.status !== 429 || attempt === 3) {
      throw new Error(`Stock provider returned ${response.status}`);
    }
    await wait(Math.min(12_000, attempt * 4_000));
  }
  throw new Error("Stock provider request retry limit reached");
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

async function searchNasaVideo(query: string): Promise<StockMediaCandidate[]> {
  const searchUrl = new URL("https://images-api.nasa.gov/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("media_type", "video");
  searchUrl.searchParams.set("page_size", "8");
  const data = await fetchJson(searchUrl.toString()) as {
    collection?: { items?: Array<{ data?: Array<Record<string, unknown>> }>; };
  };
  const items = Array.isArray(data.collection?.items) ? data.collection.items : [];
  return (await Promise.all(items.map(async (item): Promise<StockMediaCandidate[]> => {
    const metadata = item.data?.[0];
    if (!metadata) return [];
    const nasaId = asString(metadata.nasa_id);
    const title = asString(metadata.title);
    if (!nasaId || !title) return [];
    const collectionUrl = `https://images-assets.nasa.gov/video/${encodeURIComponent(nasaId)}/collection.json`;
    try {
      const collection = await fetchJson(collectionUrl) as unknown;
      if (!Array.isArray(collection)) return [];
      const mediaUrl = collection
        .filter((value): value is string => typeof value === "string" && /\.mp4(?:$|[?#])/i.test(value))
        .sort((a, b) => {
          const rank = (url: string) => url.includes("~mobile.mp4") ? 0 : url.includes("~medium.mp4") ? 1 : url.includes("~large.mp4") ? 2 : 3;
          return rank(a) - rank(b);
        })[0];
      if (!mediaUrl) return [];
      const description = asString(metadata.description);
      const credit = description?.match(/credit:\s*([^.\n]+)/iu)?.[1]?.trim() || "NASA";
      return [{
        provider: "nasa",
        id: nasaId,
        kind: "video",
        title,
        sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
        downloadUrl: mediaUrl.replace(/^http:/i, "https:"),
        creator: credit,
        creatorUrl: "https://www.nasa.gov/multimedia/guidelines/index.html",
        license: "NASA Media Usage Guidelines",
        licenseUrl: "https://www.nasa.gov/multimedia/guidelines/index.html",
        attribution: `NASA${credit === "NASA" ? "" : ` / ${credit}`}`,
        width: null,
        height: null,
        durationSeconds: null,
        contentType: "video/mp4",
      }];
    } catch (error) {
      logger.warn({ err: error, query, nasaId }, "NASA video metadata lookup failed");
      return [];
    }
  }))).flat();
}

export async function downloadStockCandidate(candidate: StockMediaCandidate): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  if (!supabaseConfigured) {
    throw new Error("Supabase storage is required to save stock media.");
  }
  let response: Response | null = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    response = await fetch(candidate.downloadUrl, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: candidate.kind === "video" ? "video/*,*/*;q=0.8" : "image/*,*/*;q=0.8",
      },
    });
    if (response.status !== 429 || attempt === 4) break;
    await wait(Math.min(15_000, attempt * 5_000));
  }
  if (!response) throw new Error(`${candidate.provider} returned no response`);
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
  return { buffer, contentType };
}

export async function storeStockCandidate(
  candidate: StockMediaCandidate,
  buffer: Buffer,
  contentType: string,
  extraMetadata: Record<string, unknown> = {},
): Promise<StoredStockMedia> {
  if (!supabaseConfigured) {
    throw new Error("Supabase storage is required to save stock media.");
  }
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
      ...extraMetadata,
    },
  });
  return {
    ...candidate,
    storageAsset: {
      id: saved.asset.id,
      fingerprint: saved.asset.fingerprint,
      bucket: saved.asset.bucket,
      object_path: saved.asset.object_path,
      content_type: saved.asset.content_type,
      size_bytes: saved.asset.size_bytes,
    },
  };
}

export async function downloadAndStoreStockCandidate(
  candidate: StockMediaCandidate,
  extraMetadata: Record<string, unknown> = {},
): Promise<StoredStockMedia> {
  const downloaded = await downloadStockCandidate(candidate);
  return storeStockCandidate(candidate, downloaded.buffer, downloaded.contentType, extraMetadata);
}

export async function searchStockCandidates(query: string, kind: StockMediaKind): Promise<StockMediaCandidate[]> {
  const providers = kind === "image"
    ? [
      async () => searchPexels(query, kind),
      async () => searchOpenverse(query),
    ]
    : [
      async () => searchPexels(query, kind),
      async () => searchNasaVideo(query),
      async () => searchWikimediaVideo(query),
    ];
  const found: StockMediaCandidate[] = [];
  for (const provider of providers) {
    try {
      found.push(...await provider());
    } catch (error) {
      logger.warn({ err: error, kind, query }, "Stock provider search failed");
    }
  }
  return [...new Map(found.map((candidate) => [
    `${candidate.provider}:${candidate.id}`,
    candidate,
  ])).values()];
}

export async function collectHoroscopeStockMedia(
  queries: string[],
  options: { imageCount?: number; videoCount?: number } = {},
): Promise<StockMediaSearchResult> {
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
  const targetByKind: Record<StockMediaKind, number> = {
    image: Math.max(0, options.imageCount ?? 8),
    video: Math.max(0, options.videoCount ?? 4),
  };
  for (const kind of ["image", "video"] as const) {
    const kindErrors: string[] = [];
    const seen = new Set<string>();
    for (const query of normalizedQueries) {
      if (assets.filter((asset) => asset.kind === kind).length >= targetByKind[kind]) break;
      const candidates = await searchStockCandidates(query, kind);
      for (const candidate of candidates) {
        const candidateKey = `${candidate.provider}:${candidate.id}`;
        if (seen.has(candidateKey)) continue;
        seen.add(candidateKey);
        try {
          assets.push(await downloadAndStoreStockCandidate(candidate, { searchQuery: query }));
          if (assets.filter((asset) => asset.kind === kind).length >= targetByKind[kind]) break;
        } catch (error) {
          kindErrors.push(`${kind}: ${error instanceof Error ? error.message : "download failed"}`);
        }
      }
    }
    if (assets.filter((asset) => asset.kind === kind).length < targetByKind[kind]) {
      errors.push(...kindErrors, `${kind}: only ${assets.filter((asset) => asset.kind === kind).length}/${targetByKind[kind]} free stock assets found`);
    }
  }
  return { assets, errors };
}