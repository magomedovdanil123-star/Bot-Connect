import type {
  GeneratedImageAsset,
  ImageGenerationSettings,
  ImageProvider,
} from "../types";

const DEFAULT_MODEL = "free-nano-banana-2";
const DEFAULT_ENDPOINT = "https://api.odirouter.ai/model/v1/queue/free-nano-banana-2";

type QueueResponse = {
  request_id?: string;
  response_url?: string;
  status_url?: string;
};

type StatusResponse = {
  status?: string;
};

type ResultResponse = {
  status?: string;
  output?: unknown;
  results?: unknown;
  error?: string;
};

type ImagePayload = { url?: string; data?: string; contentType: string };

function findImagePayload(value: unknown, depth = 0): ImagePayload | null {
  if (depth > 6 || value === null || value === undefined) return null;
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) {
      const match = value.match(/^data:(image\/[^;]+);base64,/);
      return { data: value, contentType: match?.[1] || "image/png" };
    }
    if (/^https?:\/\//.test(value)) return { url: value, contentType: "image/jpeg" };
    if (value.trim().startsWith("{")) {
      try {
        return findImagePayload(JSON.parse(value), depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImagePayload(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  const contentType = typeof record.mime_type === "string"
    ? record.mime_type
    : typeof record.mimeType === "string" ? record.mimeType : "image/jpeg";
  for (const key of ["url", "image_url", "imageUrl"]) {
    if (typeof record[key] === "string" && /^https?:\/\//.test(record[key] as string)) {
      return { url: record[key] as string, contentType };
    }
  }
  for (const key of ["data", "b64_json", "base64"]) {
    if (typeof record[key] === "string") {
      const raw = record[key] as string;
      return { data: raw.startsWith("data:image/") ? raw : `data:${contentType};base64,${raw}`, contentType };
    }
  }
  if (type === "image" || type === "image_url") {
    return findImagePayload(record.content, depth + 1);
  }
  for (const key of ["content", "output", "results", "images", "image"]) {
    const found = findImagePayload(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}

export class OdiRouterImageProvider implements ImageProvider {
  readonly name = "odirouter";
  readonly model = process.env["ODIROUTER_IMAGE_MODEL"] || DEFAULT_MODEL;

  private get endpoint(): string {
    return process.env["ODIROUTER_IMAGE_ENDPOINT"] || DEFAULT_ENDPOINT.replace(DEFAULT_MODEL, this.model);
  }

  private headers(): Record<string, string> {
    const apiKey = process.env["ODIROUTER_API_KEY"];
    if (!apiKey) throw new Error("ODIROUTER_API_KEY is not configured");
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async generateOnce(
    prompt: string,
    settings: ImageGenerationSettings,
  ): Promise<GeneratedImageAsset> {
    const headers = this.headers();
    const queued = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        aspect_ratio: settings.aspectRatio,
        resolution: process.env["ODIROUTER_IMAGE_RESOLUTION"] || "1K",
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const queueData = await queued.json() as QueueResponse & { error?: string };
    if (!queued.ok || !queueData.status_url || !queueData.response_url) {
      throw new Error(queueData.error || `OdiRouter queue error (${queued.status})`);
    }

    let status = "IN_PROGRESS";
    for (let attempt = 0; attempt < 36; attempt += 1) {
      const statusResponse = await fetch(queueData.status_url, {
        headers,
        signal: AbortSignal.timeout(30_000),
      });
      const statusData = await statusResponse.json() as StatusResponse & { error?: string };
      if (!statusResponse.ok) {
        throw new Error(statusData.error || `OdiRouter status error (${statusResponse.status})`);
      }
      status = (statusData.status || "").toUpperCase();
      if (["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(status)) break;
      if (["FAILED", "ERROR", "CANCELLED"].includes(status)) {
        throw new Error(`OdiRouter image generation ${status.toLowerCase()}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    if (!["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(status)) {
      throw new Error("OdiRouter image generation timed out");
    }

    const resultResponse = await fetch(queueData.response_url, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });
    const result = await resultResponse.json() as ResultResponse;
    if (!resultResponse.ok) {
      throw new Error(result.error || `OdiRouter response error (${resultResponse.status})`);
    }
    const image = findImagePayload(result.output) || findImagePayload(result.results);
    if (!image) throw new Error("OdiRouter returned no supported image payload");

    let buffer: Buffer;
    if (image.data) {
      const match = image.data.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!match) throw new Error("OdiRouter returned invalid base64 image data");
      buffer = Buffer.from(match[1], "base64");
    } else if (image.url) {
      const imageResponse = await fetch(image.url, {
        signal: AbortSignal.timeout(60_000),
      });
      if (!imageResponse.ok) throw new Error(`OdiRouter image download error (${imageResponse.status})`);
      buffer = Buffer.from(await imageResponse.arrayBuffer());
    } else {
      throw new Error("OdiRouter returned an empty image payload");
    }
    if (!buffer.length) throw new Error("OdiRouter returned an empty image");
    return {
      buffer,
      contentType: image.contentType || "image/jpeg",
      width: 1024,
      height: 1024,
    };
  }

  async generate(
    prompt: string,
    settings: ImageGenerationSettings,
  ): Promise<GeneratedImageAsset> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await this.generateOnce(prompt, settings);
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2_000));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("OdiRouter image generation failed");
  }
}