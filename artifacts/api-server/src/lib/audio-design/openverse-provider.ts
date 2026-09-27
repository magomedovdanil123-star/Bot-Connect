import type { MusicProvider } from "./music-provider";
import type { SFXProvider } from "./sfx-provider";
import type { AudioAsset, AudioSearchInput } from "./types";

const API = "https://api.openverse.org/v1/audio";
const USER_AGENT = "AIContentFactory/1.0";
const OPENVERSE_REQUEST_TIMEOUT_MS = 15_000;
const OPENVERSE_MAX_ATTEMPTS = 3;
const ALLOWED_AUDIO_HOSTS = [
  "cdn.freesound.org",
  "storage.jamendo.com",
  "upload.wikimedia.org",
  "archive.org",
  "freemusicarchive.org",
];

type OpenverseAudio = {
  id?: string;
  title?: string;
  creator?: string;
  url?: string;
  detail_url?: string;
  foreign_landing_url?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  provider?: string;
  source?: string;
  duration?: number;
  filetype?: string;
  attribution?: string;
};

function asAsset(row: OpenverseAudio, category: string): AudioAsset | null {
  if (!row.id || !row.title || !row.url || !row.url.startsWith("https://")) return null;
  try {
    assertAllowedAudioUrl(row.url);
  } catch {
    return null;
  }
  const license = [row.license, row.license_version].filter(Boolean).join(" ").toUpperCase() || "unknown";
  return {
    provider: `openverse:${row.provider || row.source || "unknown"}`,
    externalId: row.id,
    title: row.title,
    creator: row.creator || null,
    sourceUrl: row.foreign_landing_url || row.detail_url || `${API}/${row.id}/`,
    previewUrl: row.url,
    downloadUrl: row.url,
    license,
    licenseUrl: row.license_url || null,
    requiresAttribution: !["CC0", "PDM"].includes(license.split(" ")[0] || ""),
    duration: typeof row.duration === "number" ? row.duration : null,
    category,
    metadata: {
      attribution: row.attribution || null,
      filetype: row.filetype || null,
      upstreamProvider: row.provider || null,
      upstreamSource: row.source || null,
    },
  };
}

function isRetryableOpenverseError(error: unknown): boolean {
  if (!(error instanceof Error)) return true;
  return error.name === "TimeoutError"
    || error.name === "AbortError"
    || /fetch failed|network|socket|temporarily unavailable/i.test(error.message);
}

async function requestJson(url: string): Promise<any> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= OPENVERSE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(OPENVERSE_REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        const error = new Error(`Openverse request failed (${response.status})`);
        if (response.status < 500 && response.status !== 429) throw error;
        throw error;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt >= OPENVERSE_MAX_ATTEMPTS || !isRetryableOpenverseError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Openverse request failed after retry");
}

function assertAllowedAudioUrl(value: string): URL {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  const allowed = ALLOWED_AUDIO_HOSTS.some((candidate) => host === candidate || host.endsWith(`.${candidate}`));
  if (url.protocol !== "https:" || !allowed) throw new Error(`Audio host is not allowed: ${host}`);
  return url;
}

async function fetchAudio(value: string): Promise<Response> {
  let url = assertAllowedAudioUrl(value);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
    });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location) throw new Error("Audio redirect did not include a location");
    url = assertAllowedAudioUrl(new URL(location, url).toString());
  }
  throw new Error("Audio download exceeded redirect limit");
}

class OpenverseBase {
  readonly name = "openverse";

  async search(input: AudioSearchInput): Promise<AudioAsset[]> {
    const params = new URLSearchParams({
      q: [input.query, input.category, input.mood].filter(Boolean).join(" "),
      page_size: String(Math.min(20, Math.max(1, input.limit || 8))),
    });
    if (input.license) params.set("license", input.license);
    const data = await requestJson(`${API}/?${params}`);
    return ((data.results || []) as OpenverseAudio[])
      .map((row) => asAsset(row, input.category || input.query))
      .filter((row): row is AudioAsset => row !== null);
  }

  async get(id: string): Promise<AudioAsset> {
    const row = (await requestJson(`${API}/${encodeURIComponent(id)}/`)) as OpenverseAudio;
    const asset = asAsset(row, "audio");
    if (!asset) throw new Error("Openverse asset is not downloadable");
    return asset;
  }

  async getPreview(id: string): Promise<string | null> {
    return (await this.get(id)).previewUrl;
  }

  async download(asset: AudioAsset): Promise<Buffer> {
    const response = await fetchAudio(asset.downloadUrl);
    if (!response.ok) throw new Error(`Audio download failed (${response.status})`);
    const contentType = response.headers.get("content-type")?.toLowerCase() || "";
    if (contentType && !contentType.startsWith("audio/") && !contentType.includes("octet-stream")) {
      throw new Error(`Openverse asset is not audio (${contentType})`);
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 50 * 1024 * 1024) throw new Error("Audio asset exceeds 50 MB limit");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 50 * 1024 * 1024) throw new Error("Invalid audio download");
    return buffer;
  }
}

export class OpenverseMusicProvider extends OpenverseBase implements MusicProvider {
  getTrack(id: string) { return this.get(id); }
}

export class OpenverseSFXProvider extends OpenverseBase implements SFXProvider {
  getEffect(id: string) { return this.get(id); }
}

export const musicProvider = new OpenverseMusicProvider();
export const sfxProvider = new OpenverseSFXProvider();