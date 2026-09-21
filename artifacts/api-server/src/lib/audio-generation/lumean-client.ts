import { createHash } from "node:crypto";

const DEFAULT_BASE_URL = "https://api.lumean.app/api/public";
const TEMPLATE_PREFIX = "AI Content Factory";
const templateCache = new Map<string, string>();

type VoiceSettings = {
  speed: number;
  stability: number;
  similarity: number;
  style: number;
  speakerBoost: boolean;
};

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  reason?: string;
  shortfall_lmc?: number;
  data?: T;
};

type Template = {
  id?: string;
  name?: string;
};

type Order = {
  id?: string;
  status?: string;
  result?: {
    files?: string[];
    user_message?: string | null;
  } | null;
};

function apiKey(): string {
  const value = process.env["LUMEAN_API_KEY"];
  if (!value) throw new Error("LUMEAN_API_KEY is not configured");
  return value;
}

function endpoint(path: string): string {
  return `${(process.env["LUMEAN_API_URL"] || DEFAULT_BASE_URL).replace(/\/+$/, "")}${path}`;
}

function describeError(status: number, body: ApiEnvelope<unknown>): string {
  if (status === 401) return "Lumean отклонил API-ключ. Проверьте LUMEAN_API_KEY.";
  if (status === 403) return "API-ключ Lumean не имеет нужных прав (templates.read/write, orders.read/write, storage.read).";
  if (status === 402) {
    const amount = typeof body.shortfall_lmc === "number" ? ` Нужно пополнить ${body.shortfall_lmc} LMC.` : "";
    return `На балансе или в квоте Lumean недостаточно средств.${amount}`;
  }
  if (status === 429) return "Lumean временно ограничил запросы или исчерпана токен-квота.";
  return body.message || `Lumean API error (HTTP ${status})`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(endpoint(path), {
    ...init,
    headers: {
      "X-API-KEY": apiKey(),
      "X-Locale": "ru",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: init.signal || AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body: ApiEnvelope<T>;
  try {
    body = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new Error(`Lumean вернул некорректный ответ (HTTP ${response.status}).`);
  }
  if (!response.ok || !body.data) throw new Error(describeError(response.status, body));
  return body.data;
}

function templateSignature(voiceId: string, modelId: string, settings: VoiceSettings): string {
  return createHash("sha256")
    .update(JSON.stringify({ voiceId, modelId, settings }))
    .digest("hex")
    .slice(0, 12);
}

async function resolveTemplate(voiceId: string, modelId: string, settings: VoiceSettings): Promise<string> {
  const configured = process.env["LUMEAN_TEMPLATE_ID"];
  if (configured) return configured;

  const signature = templateSignature(voiceId, modelId, settings);
  const cached = templateCache.get(signature);
  if (cached) return cached;
  const name = `${TEMPLATE_PREFIX} ${signature}`;
  const templates = await request<Template[]>("/templates?per_page=100");
  const existing = templates.find((template) => template.name === name && template.id);
  if (existing?.id) {
    templateCache.set(signature, existing.id);
    return existing.id;
  }

  const created = await request<Template>("/templates", {
    method: "POST",
    body: JSON.stringify({
      service_key: "elevenlabs",
      name,
      is_public: false,
      config: {
        tts_settings: {
          mode: "mode_v1",
          model_id: modelId,
          voice_id: voiceId,
          language_code: "ru",
          advanced_voice_settings: true,
          apply_text_normalization: "auto",
          prev_next_text: true,
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity,
            style: settings.style,
            speed: settings.speed,
            use_speaker_boost: settings.speakerBoost,
          },
        },
      },
    }),
  });
  if (!created.id) throw new Error("Lumean создал шаблон без идентификатора.");
  templateCache.set(signature, created.id);
  return created.id;
}

async function waitForOrder(orderId: string): Promise<Order> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const order = await request<Order>(`/orders/${encodeURIComponent(orderId)}`);
    const status = (order.status || "").toLowerCase();
    if (status === "completed" || status === "result_delivered") return order;
    if (["failed", "compensated", "cancelled", "partially_completed"].includes(status)) {
      throw new Error(order.result?.user_message || `Lumean не завершил озвучку: ${status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("Lumean synthesis timed out after 4 minutes.");
}

export async function generateLumeanSpeech(
  text: string,
  voiceId: string,
  modelId: string,
  settings: VoiceSettings,
): Promise<Buffer> {
  const templateId = await resolveTemplate(voiceId, modelId, settings);
  const created = await request<Order>("/orders", {
    method: "POST",
    body: JSON.stringify({
      template_id: templateId,
      input_text: text,
      name: text.replace(/\s+/g, " ").trim().slice(0, 60) || "Озвучка",
    }),
  });
  if (!created.id) throw new Error("Lumean создал заказ без идентификатора.");
  const completed = await waitForOrder(created.id);
  const filePath = completed.result?.files?.[0];
  if (!filePath) throw new Error("Lumean завершил заказ без аудиофайла.");
  const download = await request<{ url?: string }>("/storage/url", {
    method: "POST",
    body: JSON.stringify({ path: filePath, download: true }),
  });
  if (!download.url) throw new Error("Lumean не вернул ссылку на аудиофайл.");
  const response = await fetch(download.url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`Не удалось скачать аудио Lumean (HTTP ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) throw new Error("Lumean вернул пустой аудиофайл.");
  return buffer;
}