import { z } from "zod";

export const SUPPORTED_MOODS = [
  "calm", "happy", "emotional", "romantic", "dramatic", "dark", "suspense",
  "thriller", "energetic", "motivational", "funny", "sad", "mysterious",
  "cinematic", "documentary",
] as const;

export const soundDesignPlanSchema = z.object({
  project_id: z.number().int().positive(),
  overall: z.object({
    mood: z.enum(SUPPORTED_MOODS),
    energy: z.number().min(0).max(1),
    tension: z.number().min(0).max(1),
    music_style: z.string().min(1),
  }),
  scenes: z.array(z.object({
    scene_id: z.number().int().positive(),
    start_time: z.number().int().nonnegative(),
    end_time: z.number().int().positive(),
    music: z.object({
      enabled: z.boolean(),
      mood: z.enum(SUPPORTED_MOODS),
      energy: z.number().min(0).max(1),
      category: z.string().min(1),
      volume: z.number().min(0).max(0.25),
    }),
    sfx: z.array(z.object({
      type: z.string().min(1),
      query: z.string().min(1),
      start_time: z.number().int().nonnegative(),
      volume: z.number().min(0.1).max(0.45),
    })).max(3),
    ambience: z.object({
      enabled: z.boolean(),
      type: z.string().min(1),
      query: z.string().min(1),
      volume: z.number().min(0.03).max(0.12),
    }),
  })).min(1),
});

export type SoundDesignPlan = z.infer<typeof soundDesignPlanSchema>;

export type AudioAsset = {
  provider: string;
  externalId: string;
  title: string;
  creator: string | null;
  sourceUrl: string;
  previewUrl: string | null;
  downloadUrl: string;
  license: string;
  licenseUrl: string | null;
  requiresAttribution: boolean;
  duration: number | null;
  category: string;
  metadata: Record<string, unknown>;
};

export type AudioSearchInput = {
  query: string;
  category?: string;
  mood?: string;
  limit?: number;
  license?: string;
};
