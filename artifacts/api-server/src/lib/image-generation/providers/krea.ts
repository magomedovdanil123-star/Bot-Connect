import { openRouterConfig } from "../../openrouter-config";
import type { GeneratedImageAsset, ImageGenerationSettings, ImageProvider } from "../types";

type KreaImageResponse = {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: { message?: string };
};

function aspectPrompt(aspectRatio: string): string {
  return aspectRatio === "16:9"
    ? "wide 16:9 landscape composition"
    : "vertical 9:16 portrait composition";
}

export class KreaImageProvider implements ImageProvider {
  readonly name = "krea";
  readonly model = process.env["IMAGE_MODEL"] || "krea/krea-2-medium-turbo";

  async generate(prompt: string, settings: ImageGenerationSettings): Promise<GeneratedImageAsset> {
    if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
    let lastError = "Krea returned no image";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/images", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterConfig.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://replit.com",
            "X-Title": "AI Content Factory",
          },
          body: JSON.stringify({
            model: this.model,
            prompt: `${prompt}\nComposition: ${aspectPrompt(settings.aspectRatio)}`,
          }),
          signal: AbortSignal.timeout(180_000),
        });
        const data = await response.json() as KreaImageResponse;
        if (!response.ok) throw new Error(data.error?.message || `Krea image API error (${response.status})`);
        const item = data.data?.[0];
        if (item?.b64_json) {
          const buffer = Buffer.from(item.b64_json, "base64");
          if (!buffer.length) throw new Error("Krea returned empty image data");
          return { buffer, contentType: "image/png", width: 1024, height: 1024 };
        }
        if (item?.url) {
          const imageResponse = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
          if (!imageResponse.ok) throw new Error(`Krea image download failed (${imageResponse.status})`);
          return {
            buffer: Buffer.from(await imageResponse.arrayBuffer()),
            contentType: imageResponse.headers.get("content-type") || "image/png",
            width: 1024,
            height: 1024,
          };
        }
        throw new Error("Krea returned no image data");
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Krea image generation failed";
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
    throw new Error(lastError);
  }
}