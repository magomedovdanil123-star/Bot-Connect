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
  output?: Array<{
    content?: Array<{
      type?: string;
      mime_type?: string;
      url?: string;
    }>;
  }>;
  error?: string;
};

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

  async generate(
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
    const image = result.output?.flatMap((item) => item.content || [])
      .find((item) => item.type === "image" && item.url);
    if (!image?.url) throw new Error("OdiRouter returned no image URL");

    const imageResponse = await fetch(image.url, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!imageResponse.ok) throw new Error(`OdiRouter image download error (${imageResponse.status})`);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    if (!buffer.length) throw new Error("OdiRouter returned an empty image");
    return {
      buffer,
      contentType: image.mime_type || imageResponse.headers.get("content-type") || "image/jpeg",
      width: 1024,
      height: 1024,
    };
  }
}