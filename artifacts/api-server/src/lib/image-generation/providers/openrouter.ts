import { openRouterConfig } from "../../openrouter-config";
import type {
  GeneratedImageAsset,
  ImageGenerationSettings,
  ImageProvider,
} from "../types";

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      images?: unknown[];
      content?: unknown;
    };
  }>;
  error?: { message?: string };
};

const FALLBACK_IMAGE_MODEL = "google/gemini-2.5-flash-image";

function decodeDataUrl(value: string): { buffer: Buffer; contentType: string } {
  const match = value.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error("Image provider returned an invalid image payload");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("Image provider returned an empty image payload");
  return { contentType: match[1], buffer };
}

function findImageDataUrl(value: unknown, depth = 0): string | null {
  if (depth > 5 || value === null || value === undefined) return null;
  if (typeof value === "string") return value.startsWith("data:image/") ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageDataUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["url", "image_url", "imageUrl", "data"]) {
    const found = findImageDataUrl(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function getImageDataUrl(data: OpenRouterImageResponse): string | null {
  const message = data.choices?.[0]?.message;
  return findImageDataUrl(message?.images) || findImageDataUrl(message?.content);
}

async function pauseBeforeRetry(attempt: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt));
}

export class OpenRouterImageProvider implements ImageProvider {
  readonly name = "openrouter";
  readonly model: string;

  constructor() {
    this.model = process.env["IMAGE_MODEL"] || "google/gemini-3.1-flash-lite-image";
  }

  async generate(
    prompt: string,
    settings: ImageGenerationSettings,
  ): Promise<GeneratedImageAsset> {
    if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

    const fallbackModel = process.env["IMAGE_FALLBACK_MODEL"] || FALLBACK_IMAGE_MODEL;
    const models = [...new Set([this.model, fallbackModel])];
    let lastError = "Image provider returned no image";

    for (const [modelIndex, model] of models.entries()) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await fetch(openRouterConfig.url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openRouterConfig.apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://replit.com",
              "X-Title": "AI Content Factory",
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: `${prompt}\nAspect ratio: ${settings.aspectRatio}` }],
              modalities: ["text", "image"],
            }),
            signal: AbortSignal.timeout(180_000),
          });

          const data = (await response.json()) as OpenRouterImageResponse;
          if (!response.ok) {
            lastError = data.error?.message ?? `Image API error (${response.status})`;
            if (response.status < 500 && response.status !== 429) throw new Error(lastError);
            throw new Error(lastError);
          }

          const imageUrl = getImageDataUrl(data);
          if (!imageUrl) throw new Error(`Image provider returned no image for ${model}`);
          const decoded = decodeDataUrl(imageUrl);
          return { ...decoded, width: 1024, height: 1024 };
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Image generation failed";
          if (attempt < 2) await pauseBeforeRetry(attempt);
          else if (modelIndex < models.length - 1) await pauseBeforeRetry(attempt);
        }
      }
    }

    throw new Error(lastError);
  }
}