import type {
  GeneratedImageAsset,
  ImageGenerationSettings,
  ImageProvider,
} from "../types";

const DEFAULT_MODEL = "fal-ai/flux/schnell";

type QueueResponse = {
  request_id?: string;
  status_url?: string;
  response_url?: string;
  error?: string;
};

type FalImage = {
  url?: string;
  content_type?: string;
  width?: number;
  height?: number;
};

type ResultResponse = {
  images?: FalImage[];
  error?: string;
};

function falKey(): string {
  const key = process.env["FAL_KEY"];
  if (!key) throw new Error("FAL_KEY is not configured");
  return key;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Key ${falKey()}`,
    "Content-Type": "application/json",
  };
}

function imageSize(aspectRatio: string): { width: number; height: number } {
  if (aspectRatio === "9:16") return { width: 768, height: 1365 };
  if (aspectRatio === "16:9") return { width: 1365, height: 768 };
  if (aspectRatio === "4:5") return { width: 1024, height: 1280 };
  return { width: 1024, height: 1024 };
}

export class FalImageProvider implements ImageProvider {
  readonly name = "fal";
  readonly model = process.env["FAL_IMAGE_MODEL"] || DEFAULT_MODEL;

  async generate(
    prompt: string,
    settings: ImageGenerationSettings,
  ): Promise<GeneratedImageAsset> {
    const queued = await fetch(`https://queue.fal.run/${this.model}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        prompt: `${prompt}\nGenerate a single coherent image. Do not include text, captions, logos, or watermarks.`,
        image_size: imageSize(settings.aspectRatio),
        num_images: 1,
        enable_safety_checker: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const queueData = await queued.json() as QueueResponse;
    if (!queued.ok || !queueData.status_url || !queueData.response_url) {
      throw new Error(queueData.error || `fal.ai queue error (${queued.status})`);
    }

    let status = "IN_PROGRESS";
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const statusResponse = await fetch(queueData.status_url, {
        headers: { Authorization: `Key ${falKey()}` },
        signal: AbortSignal.timeout(30_000),
      });
      const statusData = await statusResponse.json() as { status?: string; error?: string };
      if (!statusResponse.ok) {
        throw new Error(statusData.error || `fal.ai status error (${statusResponse.status})`);
      }
      status = (statusData.status || "").toUpperCase();
      if (["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(status)) break;
      if (["FAILED", "ERROR", "CANCELLED"].includes(status)) {
        throw new Error(`fal.ai image generation ${status.toLowerCase()}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    if (!["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(status)) {
      throw new Error("fal.ai image generation timed out");
    }

    const resultResponse = await fetch(queueData.response_url, {
      headers: { Authorization: `Key ${falKey()}` },
      signal: AbortSignal.timeout(30_000),
    });
    const result = await resultResponse.json() as ResultResponse;
    if (!resultResponse.ok) {
      throw new Error(result.error || `fal.ai result error (${resultResponse.status})`);
    }
    const image = result.images?.[0];
    if (!image?.url) throw new Error("fal.ai returned no image");
    const imageResponse = await fetch(image.url, { signal: AbortSignal.timeout(60_000) });
    if (!imageResponse.ok) throw new Error(`fal.ai image download error (${imageResponse.status})`);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    if (!buffer.length) throw new Error("fal.ai returned an empty image");
    return {
      buffer,
      contentType: image.content_type || imageResponse.headers.get("content-type") || "image/jpeg",
      width: image.width || imageSize(settings.aspectRatio).width,
      height: image.height || imageSize(settings.aspectRatio).height,
    };
  }
}