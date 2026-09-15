import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { openRouterConfig } from "./openrouter-config";

const execFileAsync = promisify(execFile);
const HIGHLIGHT_REQUEST_TIMEOUT_MS = 180_000;
const DEFAULT_HIGHLIGHT_MODEL = "google/gemini-2.5-flash";

type Highlight = {
  startSeconds: number;
  endSeconds: number;
  score: number;
  reason: string;
};

type OpenRouterResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>;
  error?: { message?: string };
};

function parseJson(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const objectStart = cleaned.indexOf("{");
    const objectEnd = cleaned.lastIndexOf("}");
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(cleaned.slice(objectStart, objectEnd + 1));
    }
    throw new Error("AI вернул некорректный список интересных моментов.");
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeHighlights(
  raw: unknown,
  durationSeconds: number,
  requestedCount: number,
): Highlight[] {
  const candidates = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { highlights?: unknown }).highlights)
      ? (raw as { highlights: unknown[] }).highlights
      : [];
  const minimumDuration = Math.min(60, durationSeconds);
  const maximumDuration = Math.min(120, durationSeconds);
  const normalized = candidates
    .map((item): Highlight | null => {
      if (!item || typeof item !== "object") return null;
      const value = item as Record<string, unknown>;
      const start = Number(value.start_seconds ?? value.start);
      const end = Number(value.end_seconds ?? value.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
      const requestedDuration = clamp(end - start, minimumDuration, maximumDuration);
      const center = (start + end) / 2;
      const safeStart = clamp(center - requestedDuration / 2, 0, Math.max(0, durationSeconds - requestedDuration));
      return {
        startSeconds: safeStart,
        endSeconds: safeStart + requestedDuration,
        score: clamp(Number(value.score) || 0, 0, 100),
        reason: typeof value.reason === "string" ? value.reason.trim().slice(0, 240) : "",
      };
    })
    .filter((item): item is Highlight => item !== null)
    .sort((a, b) => b.score - a.score);

  const selected: Highlight[] = [];
  for (const candidate of normalized) {
    const overlaps = selected.some((item) => {
      const overlapStart = Math.max(item.startSeconds, candidate.startSeconds);
      const overlapEnd = Math.min(item.endSeconds, candidate.endSeconds);
      return overlapEnd - overlapStart > Math.min(item.endSeconds - item.startSeconds, candidate.endSeconds - candidate.startSeconds) * 0.35;
    });
    if (!overlaps) selected.push(candidate);
    if (selected.length >= requestedCount) break;
  }
  if (selected.length < requestedCount) {
    throw new Error(`AI нашёл только ${selected.length} подходящих моментов из ${requestedCount}.`);
  }
  return selected.sort((a, b) => a.startSeconds - b.startSeconds);
}

export async function analyzeInterestingMoments(params: {
  sourcePath: string;
  workDir: string;
  durationSeconds: number;
  requestedCount: number;
  sourceTitle?: string;
  sourceDescription?: string;
  onProgress?: (message: string) => Promise<void>;
}): Promise<Highlight[]> {
  if (!openRouterConfig.apiKey) {
    throw new Error("Для определения интересных мест не настроен AI-анализ.");
  }
  await params.onProgress?.("Создаю раскадровку исходного видео для AI-анализа.");
  const sampleInterval = clamp(params.durationSeconds / 40, 6, 15);
  const maxFrames = Math.min(48, Math.max(10, Math.ceil(params.durationSeconds / sampleInterval)));
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", params.sourcePath,
    "-vf", `fps=1/${sampleInterval.toFixed(3)},scale=320:-2:flags=lanczos`,
    "-frames:v", String(maxFrames),
    "-q:v", "7",
    `${params.workDir}/highlight-frame-%03d.jpg`,
  ], { timeout: 10 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });

  const files = (await readdir(params.workDir))
    .filter((file) => /^highlight-frame-\d+\.jpg$/u.test(file))
    .sort();
  if (!files.length) throw new Error("Не удалось подготовить кадры для AI-анализа.");

  const content: Array<Record<string, unknown>> = [{
    type: "text",
    text: [
      "Ты видеоредактор, который выбирает лучшие моменты для короткой нарезки.",
      `Исходное видео длится ${params.durationSeconds.toFixed(1)} секунд.`,
      params.sourceTitle ? `Название исходника: ${params.sourceTitle}` : "",
      params.sourceDescription ? `Описание исходника: ${params.sourceDescription.slice(0, 1200)}` : "",
      `Нужно выбрать ровно ${params.requestedCount} разных фрагментов длиной 60–120 секунд.`,
      "Нумерация кадров идёт с интервалом " + sampleInterval.toFixed(1) + " секунд, первый кадр — начало видео.",
      "Оценивай визуальную динамику, появление конфликта или важной информации, эмоцию, неожиданность, кульминацию и самостоятельность фрагмента.",
      "Не выбирай пустые, повторяющиеся или спокойные участки. Начало ставь немного до главного события, конец — после понятного результата.",
      "Верни только JSON: {\"highlights\":[{\"start_seconds\":0,\"end_seconds\":60,\"score\":92,\"reason\":\"краткая причина\"}]}",
    ].join("\n"),
  }];
  for (let index = 0; index < files.length; index += 1) {
    const buffer = await readFile(`${params.workDir}/${files[index]}`);
    content.push({ type: "text", text: `Кадр ${index + 1}: ${Math.min(params.durationSeconds, index * sampleInterval).toFixed(1)} сек.` });
    content.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${buffer.toString("base64")}` },
    });
  }

  await params.onProgress?.("AI определяет самые интересные места.");
  const response = await fetch(openRouterConfig.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterConfig.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://replit.com",
      "X-Title": "AI Content Factory video highlights",
    },
    body: JSON.stringify({
      model: process.env["VIDEO_HIGHLIGHT_MODEL"] || DEFAULT_HIGHLIGHT_MODEL,
      messages: [{ role: "user", content }],
      max_tokens: Math.max(1200, params.requestedCount * 300),
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(HIGHLIGHT_REQUEST_TIMEOUT_MS),
  });
  const data = (await response.json()) as OpenRouterResponse;
  if (!response.ok) throw new Error(data.error?.message || `AI-анализ завершился с ошибкой (${response.status}).`);
  const message = data.choices?.[0]?.message?.content;
  const text = Array.isArray(message) ? message.map((part) => part.text || "").join("") : message;
  if (!text?.trim()) throw new Error("AI не вернул список интересных мест.");
  return normalizeHighlights(parseJson(text), params.durationSeconds, params.requestedCount);
}