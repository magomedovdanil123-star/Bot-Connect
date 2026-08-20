import type { ImageGenerationSettings } from "./types";

export type CharacterProfileData = {
  gender: string;
  age: string;
  appearance: string;
  hair: string;
  clothing: string;
  accessories: string;
  facial_features: string;
  style: string;
  persistent_traits: string;
};

export function buildCharacterDescription(profile: CharacterProfileData): string {
  return [
    `${profile.age} ${profile.gender}`,
    profile.appearance,
    `hair: ${profile.hair}`,
    `clothing: ${profile.clothing}`,
    `accessories: ${profile.accessories}`,
    `facial features: ${profile.facial_features}`,
    `visual style: ${profile.style}`,
    `persistent traits: ${profile.persistent_traits}`,
  ].filter(Boolean).join(", ");
}

export const DEFAULT_NEGATIVE_PROMPT =
  "blurry, low quality, distorted face, deformed hands, extra fingers, duplicate people, different face, changed identity, different age, different hairstyle, different clothing, bad anatomy, text, watermark, logo, oversaturated, artificial appearance";

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
    settings.characterLock && settings.characterDescription
      ? [
          "CHARACTER CONTINUITY — this is the same main protagonist across the entire video.",
          `Identity anchor: ${settings.characterDescription}`,
          "Preserve the exact same face, age, skin tone, hair, body type, clothing, accessories, and visual style in every scene.",
          "Change only the scene action, location, emotion, lighting, camera angle, and background.",
          "Do not redesign the protagonist, replace the protagonist, or introduce a visually different version of the protagonist.",
        ].join("\n")
      : "",
    "Create a detailed, coherent image with clear subject, environment, lighting, camera, composition, and emotion.",
  ]
    .filter(Boolean)
    .join("\n");
}