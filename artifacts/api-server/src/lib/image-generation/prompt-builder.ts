import type { ImageGenerationSettings } from "./types";

export const DEFAULT_NEGATIVE_PROMPT =
  "blurry, low quality, distorted face, deformed hands, extra fingers, duplicate people, bad anatomy, text, watermark, logo, oversaturated, artificial appearance";

export function buildScenePrompt(
  scene: {
    voice_text: string;
    visual_description: string;
    image_prompt: string;
  },
  settings: ImageGenerationSettings,
): string {
  return [
    scene.image_prompt,
    `Scene action: ${scene.visual_description}`,
    `Narration context: ${scene.voice_text}`,
    `Visual style: ${settings.visualStyle}`,
    `Realism: ${settings.realism}`,
    `People: ${settings.people}`,
    `Color atmosphere: ${settings.colorAtmosphere}`,
    `Aspect ratio: ${settings.aspectRatio}, vertical cinematic composition when applicable.`,
    settings.characterDescription
      ? `Keep this character appearance consistent across scenes: ${settings.characterDescription}`
      : "",
    "Create a detailed, coherent image with clear subject, environment, lighting, camera, composition, and emotion.",
  ]
    .filter(Boolean)
    .join("\n");
}