const DEFAULT_ENDPOINT = "https://voiceapiru.csv666.ru";
const DEFAULT_VOICE_ID = "iP95p4xoKVk53GoZ742B";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

type TaskCreateResponse = { task_id?: number; message?: string };
type TaskStatusResponse = {
  status?: string;
  error?: { ru?: string; en?: string };
};

function endpoint(path: string): string {
  return `${(process.env["VOICE_API_URL"] || DEFAULT_ENDPOINT).replace(/\/+$/, "")}${path}`;
}

function headers(): Record<string, string> {
  const apiKey = process.env["VOICE_API_KEY"];
  if (!apiKey) throw new Error("VOICE_API_KEY is not configured");
  return { "X-API-Key": apiKey, "Content-Type": "application/json" };
}

function errorMessage(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["ru", "en", "message", "detail"]) {
      const message = errorMessage(record[key]);
      if (message) return message;
    }
    return JSON.stringify(value);
  }
  return undefined;
}

async function readJsonResponse<T>(response: Response, label: string): Promise<T> {
  const body = await response.text();
  try {
    return JSON.parse(body) as T;
  } catch {
    const contentType = response.headers.get("content-type") || "unknown content type";
    const preview = body.replace(/\s+/g, " ").trim().slice(0, 180);
    throw new Error(
      `${label} вернул не JSON (HTTP ${response.status}, ${contentType}). ` +
      `Ответ: ${preview || "пустой ответ"}`,
    );
  }
}

export function getVoiceApiVoiceId(): string {
  return process.env["VOICE_API_VOICE_ID"] || DEFAULT_VOICE_ID;
}

export function getVoiceApiModelId(): string {
  return process.env["VOICE_API_MODEL_ID"] || DEFAULT_MODEL_ID;
}

export async function generateVoiceApiSpeech(
  text: string,
  voiceId: string,
  modelId: string,
  settings: {
    speed: number;
    stability: number;
    similarity: number;
    style: number;
    speakerBoost: boolean;
  },
): Promise<Buffer> {
  const authHeaders = headers();
  const templateUuid = process.env["VOICE_API_TEMPLATE_UUID"];
  const requestBody = templateUuid
    ? { text, template_uuid: templateUuid }
    : {
        text,
        template: {
          model_id: modelId || getVoiceApiModelId(),
          voice_id: voiceId || getVoiceApiVoiceId(),
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity,
            style: settings.style,
            speed: settings.speed,
            use_speaker_boost: settings.speakerBoost,
          },
          voice_result_type: "default",
          subtitles: false,
          voice_engine: "default",
        },
      };
  let createResponse: Response | undefined;
  let created: (TaskCreateResponse & { detail?: unknown; error?: unknown }) | undefined;
  let lastCreateError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(endpoint("/tasks"), {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(requestBody),
        // Voice task creation can take longer while the provider queues synthesis.
         signal: AbortSignal.timeout(240_000),
      });
      if (response.status >= 500 && attempt < 3) {
        await response.text();
        await new Promise((resolve) => setTimeout(resolve, attempt * 3_000));
        continue;
      }
      createResponse = response;
      created = await readJsonResponse<TaskCreateResponse & { detail?: unknown; error?: unknown }>(
        response,
        "Voice API /tasks",
      );
      break;
    } catch (error) {
      lastCreateError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 3_000));
    }
  }
  if (!createResponse || !created) {
    throw lastCreateError instanceof Error
      ? new Error(`Voice API task creation failed after retry: ${lastCreateError.message}`)
      : new Error("Voice API task creation failed after retry");
  }
  if (!createResponse.ok || !created.task_id) {
    throw new Error(errorMessage(created.message) || errorMessage(created.error) || errorMessage(created.detail) || `Voice API task error (${createResponse.status})`);
  }

  let status = "waiting";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const statusResponse = await fetch(endpoint(`/tasks/${created.task_id}/status`), {
      headers: authHeaders,
      signal: AbortSignal.timeout(30_000),
    });
    const task = await readJsonResponse<TaskStatusResponse & { detail?: unknown }>(
      statusResponse,
      "Voice API task status",
    );
    if (!statusResponse.ok) {
      throw new Error(errorMessage(task.detail) || `Voice API status error (${statusResponse.status})`);
    }
    status = (task.status || "").toLowerCase();
    if (["ending", "ending_processed", "completed", "success"].includes(status)) break;
    if (["error", "error_handled", "failed"].includes(status)) {
      throw new Error(task.error?.ru || task.error?.en || "Voice API synthesis failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  if (!["ending", "ending_processed", "completed", "success"].includes(status)) {
    throw new Error("Voice API synthesis timed out");
  }

  let result: Response | undefined;
  let lastResultError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      result = await fetch(endpoint(`/tasks/${created.task_id}/result`), {
        headers: { "X-API-Key": authHeaders["X-API-Key"] },
        signal: AbortSignal.timeout(180_000),
      });
      break;
    } catch (error) {
      lastResultError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  if (!result) {
    throw lastResultError instanceof Error
      ? new Error(`Voice API result download failed after retry: ${lastResultError.message}`)
      : new Error("Voice API result download failed after retry");
  }
  if (!result.ok) {
    const errorText = await result.text();
    throw new Error(errorText || `Voice API result error (${result.status})`);
  }
  const buffer = Buffer.from(await result.arrayBuffer());
  if (!buffer.length) throw new Error("Voice API returned an empty audio file");
  return buffer;
}