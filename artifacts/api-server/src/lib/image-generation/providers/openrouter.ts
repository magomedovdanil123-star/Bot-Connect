import { openRouterConfig } from "../../openrouter-config";
import type {
  GeneratedImageAsset,
  ImageGenerationSettings,
  ImageProvider,
} from "../types";

type OpenRouterImageResponse = {
  choices?: Array<{
    message?: {
      images?: Array<{
        image_url?: { url?: string };
      }>;
    };
  }>;
  error?: { message?: string };
};

function decodeDataUrl(value: string): { buffer: Buffer; contentType: string } {
  const match = value.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error("Image provider returned an invalid image payload");
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}

export class OpenRouterImageProvider implements ImageProvider {
  readonly name = "openrouter";
  readonly model: string;

  constructor() {
    this.model = process.env["IMAGE_MODEL"] || "google/gemini-2.5-flash-image";
  }

  async generate(
    prompt: string,
    settings: ImageGenerationSettings,
  ): Promise<GeneratedImageAsset> {
    if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

    const response = await fetch(openRouterConfig.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterConfig.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://replit.com",
        "X-Title": "AI Content Factory",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "user", content: `${prompt}\nAspect ratio: ${settings.aspectRatio}` }],
        modalities: ["text", "image"],
      }),
      signal: AbortSignal.timeout(180_000),
    });

    const data = (await response.json()) as OpenRouterImageResponse;
    if (!response.ok) throw new Error(data.error?.message ?? `Image API error (${response.status})`);

    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error("Image provider returned no image");
    const decoded = decodeDataUrl(imageUrl);
    return { ...decoded, width: 1024, height: 1024 };
  }
}