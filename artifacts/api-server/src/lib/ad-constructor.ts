import { z } from "zod";
import { openRouterConfig } from "./openrouter-config";

const adPlanSchema = z.object({
  route: z.enum(["create", "process", "cuts", "hybrid"]),
  idea: z.string().min(1),
  rationale: z.string().min(1),
  deliverables: z.array(z.string().min(1)).min(1).max(8),
  production_steps: z.array(z.string().min(1)).min(1).max(8),
  required_assets: z.array(z.string().min(1)).max(8),
  duration_seconds: z.coerce.number().int().min(10).max(180),
  voiceover: z.enum(["synthetic", "original", "none"]),
  cta: z.string().default(""),
  risks: z.array(z.string().min(1)).max(6).default([]),
});

export type AdPlan = z.infer<typeof adPlanSchema>;

export type AdAssetSummary = {
  kind: "image" | "video";
  name: string;
};

function parseJson(content: string): unknown {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Ответ AI не содержит JSON рекламного плана");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

export async function analyzeAdBrief(input: {
  brief: string;
  assets: AdAssetSummary[];
}): Promise<AdPlan> {
  if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const assetText = input.assets.length
    ? input.assets.map((asset) => `- ${asset.kind}: ${asset.name}`).join("\n")
    : "Материалы пока не загружены.";
  const response = await fetch(openRouterConfig.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "HTTP-Referer": "https://replit.com",
      "X-Title": "AI Content Factory Ad Constructor",
    },
    body: JSON.stringify({
      model: openRouterConfig.model,
      messages: [
        {
          role: "system",
          content: [
            "Ты — креативный продюсер рекламных вертикальных видео.",
            "Проанализируй рекламное ТЗ и доступные материалы, предложи одну конкретную идею и маршрут производства.",
            "Выбирай create, если ролик нужно создать с нуля; process, если основа — готовое видео; cuts, если нужны отдельные фрагменты; hybrid, если нужно соединить готовое видео с новыми сценами.",
            "Не обещай функции, которых нет в материалах. Пиши по-русски.",
            "Верни только JSON с ключами route, idea, rationale, deliverables, production_steps, required_assets, duration_seconds, voiceover, cta, risks.",
          ].join("\n"),
        },
        {
          role: "user",
          content: `Рекламное ТЗ:\n${input.brief.slice(0, 12000)}\n\nДоступные материалы:\n${assetText}`,
        },
      ],
      max_tokens: 3000,
      temperature: 0.65,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(data.error?.message || `OpenRouter API error (${response.status})`);
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("AI не вернул рекламный план");
  return adPlanSchema.parse(parseJson(content));
}