import { z } from "zod";
import { openRouterConfig } from "../openrouter-config";
import { SUPPORTED_MOODS, soundDesignPlanSchema, type SoundDesignPlan } from "./types";

const rawPlanSchema = z.object({
  overall: z.object({
    mood: z.enum(SUPPORTED_MOODS),
    energy: z.number().min(0).max(1),
    tension: z.number().min(0).max(1),
    music_style: z.string().min(1),
  }),
  scenes: z.array(z.object({
    scene_id: z.number().int().positive(),
    music: z.object({
      enabled: z.boolean(),
      mood: z.enum(SUPPORTED_MOODS),
      energy: z.number().min(0).max(1),
      category: z.string().min(1),
      volume: z.number().min(0.05).max(0.2),
    }),
    sfx: z.array(z.object({
      type: z.string().min(1),
      query: z.string().min(1),
      timing_ratio: z.number().min(0).max(1),
      volume: z.number().min(0.15).max(0.4),
    })).max(3),
    ambience: z.object({
      enabled: z.boolean(),
      type: z.string().min(1),
      query: z.string().min(1),
      volume: z.number().min(0.03).max(0.1),
    }),
  })).min(1),
});

type AnalyzeInput = {
  projectId: number;
  topic: string;
  style: string;
  tone: string;
  scenes: Array<{ scene_number: number; voice_text: string; visual_description: string }>;
  timeline: Array<{ sceneId: number; startTime: number; endTime: number }>;
};

function parseJson(content: string): unknown {
  return JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, ""));
}

async function requestAnalysis(prompt: string): Promise<string> {
  if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const response = await fetch(openRouterConfig.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openRouterConfig.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://replit.com",
      "X-Title": "AI Content Factory Sound Design",
    },
    body: JSON.stringify({
      model: openRouterConfig.model,
      max_tokens: 8192,
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Ты профессиональный sound designer коротких вертикальных видео.",
            "Верни только строгий JSON. Никогда не возвращай URL или названия конкретных файлов.",
            `Допустимые mood: ${SUPPORTED_MOODS.join(", ")}.`,
            "Для каждой сцены используй максимум 3 важных SFX; допустима тишина или отсутствие музыки.",
            "timing_ratio: позиция эффекта внутри сцены от 0 до 1.",
            "query: короткий англоязычный поисковый запрос реального звука.",
            "ambience volume 0.03-0.10, music 0.05-0.20, sfx 0.15-0.40.",
          ].join("\n"),
        },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const data = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message || `OpenRouter API error (${response.status})`);
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned an empty sound design response");
  return content;
}

export async function analyzeSoundDesign(input: AnalyzeInput): Promise<SoundDesignPlan> {
  const prompt = JSON.stringify({
    task: "Create sound design search parameters for every scene",
    project: { topic: input.topic, style: input.style, tone: input.tone },
    scenes: input.scenes,
    required_shape: {
      overall: { mood: "dramatic", energy: 0.7, tension: 0.6, music_style: "cinematic suspense" },
      scenes: [{
        scene_id: 1,
        music: { enabled: true, mood: "suspense", energy: 0.7, category: "cinematic suspense instrumental", volume: 0.12 },
        sfx: [{ type: "phone_vibration", query: "phone vibration sound effect", timing_ratio: 0.4, volume: 0.25 }],
        ambience: { enabled: true, type: "city_night", query: "city night ambience", volume: 0.07 },
      }],
    },
  });
  let raw = await requestAnalysis(prompt);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const parsed = rawPlanSchema.parse(parseJson(raw));
      const timeline = new Map(input.timeline.map((item) => [item.sceneId, item]));
      const expectedSceneIds = input.scenes.map((scene) => scene.scene_number);
      const actualSceneIds = parsed.scenes.map((scene) => scene.scene_id);
      if (
        actualSceneIds.length !== expectedSceneIds.length ||
        new Set(actualSceneIds).size !== actualSceneIds.length ||
        expectedSceneIds.some((sceneId) => !actualSceneIds.includes(sceneId)) ||
        timeline.size !== expectedSceneIds.length
      ) {
        throw new Error("SoundDesignPlan must contain every project scene exactly once");
      }
      const parsedById = new Map(parsed.scenes.map((scene) => [scene.scene_id, scene]));
      let previousEnd = 0;
      for (const sceneId of expectedSceneIds) {
        const timing = timeline.get(sceneId);
        if (!timing || timing.endTime <= timing.startTime || timing.startTime < previousEnd) {
          throw new Error(`Invalid or overlapping voice timeline for scene ${sceneId}`);
        }
        previousEnd = timing.endTime;
      }
      const plan: SoundDesignPlan = {
        project_id: input.projectId,
        overall: parsed.overall,
        scenes: expectedSceneIds.map((sceneId) => {
          const scene = parsedById.get(sceneId)!;
          const timing = timeline.get(scene.scene_id);
          if (!timing) throw new Error(`Missing voice timeline for scene ${scene.scene_id}`);
          if (timing.endTime <= timing.startTime) throw new Error(`Invalid voice timeline for scene ${scene.scene_id}`);
          return {
            scene_id: scene.scene_id,
            start_time: timing.startTime,
            end_time: timing.endTime,
            music: scene.music,
            sfx: scene.sfx.slice(0, 3).map((effect) => ({
              type: effect.type,
              query: effect.query,
              start_time: Math.round(timing.startTime + (timing.endTime - timing.startTime) * effect.timing_ratio),
              volume: effect.volume,
            })),
            ambience: scene.ambience,
          };
        }),
      };
      return soundDesignPlanSchema.parse(plan);
    } catch {
      if (attempt === 1) throw new Error("AI returned an invalid SoundDesignPlan");
      raw = await requestAnalysis(`${prompt}\nИсправь JSON и верни все сцены без URL:\n${raw}`);
    }
  }
  throw new Error("Sound design analysis failed");
}
