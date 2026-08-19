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
  const createResponse = await fetch(endpoint("/tasks"), {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
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
    }),
    signal: AbortSignal.timeout(30_000),
  });
  const created = await createResponse.json() as TaskCreateResponse & { detail?: string };
  if (!createResponse.ok || !created.task_id) {
    throw new Error(created.message || created.detail || `Voice API task error (${createResponse.status})`);
  }

  let status = "waiting";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const statusResponse = await fetch(endpoint(`/tasks/${created.task_id}/status`), {
      headers: authHeaders,
      signal: AbortSignal.timeout(30_000),
    });
    const task = await statusResponse.json() as TaskStatusResponse & { detail?: string };
    if (!statusResponse.ok) {
      throw new Error(task.detail || `Voice API status error (${statusResponse.status})`);
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

  const result = await fetch(endpoint(`/tasks/${created.task_id}/result`), {
    headers: { "X-API-Key": authHeaders["X-API-Key"] },
    signal: AbortSignal.timeout(60_000),
  });
  if (!result.ok) {
    const errorText = await result.text();
    throw new Error(errorText || `Voice API result error (${result.status})`);
  }
  const buffer = Buffer.from(await result.arrayBuffer());
  if (!buffer.length) throw new Error("Voice API returned an empty audio file");
  return buffer;
}