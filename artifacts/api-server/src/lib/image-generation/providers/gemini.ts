import type {
  GeneratedImageAsset,
  ImageGenerationSettings,
  ImageProvider,
} from "../types";

const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
      }>;
    };
  }>;
  error?: { message?: string };
};

export class GeminiImageProvider implements ImageProvider {
  readonly name = "google-gemini";
  readonly model = process.env["GEMINI_IMAGE_MODEL"] || DEFAULT_GEMINI_IMAGE_MODEL;

  async generate(
    prompt: string,
    settings: ImageGenerationSettings,
  ): Promise<GeneratedImageAsset> {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured for Google AI image generation");

    let lastError = "Google Gemini returned no image";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`${GEMINI_API_URL}/${this.model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${prompt}\nAspect ratio: ${settings.aspectRatio}` }] }],
            generationConfig: { responseModalities: ["IMAGE"] },
          }),
          signal: AbortSignal.timeout(180_000),
        });
        const data = (await response.json()) as GeminiResponse;
        if (!response.ok) {
          lastError = data.error?.message || `Google Gemini image API error (${response.status})`;
          if (response.status < 500 && response.status !== 429) throw new Error(lastError);
          throw new Error(lastError);
        }
        const inlineData = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
        if (!inlineData?.data) throw new Error("Google Gemini returned no image data");
        const buffer = Buffer.from(inlineData.data, "base64");
        if (!buffer.length) throw new Error("Google Gemini returned empty image data");
        return {
          buffer,
          contentType: inlineData.mimeType || "image/png",
          width: 1024,
          height: 1024,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Google Gemini image generation failed";
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
      }
    }
    throw new Error(lastError);
  }
}