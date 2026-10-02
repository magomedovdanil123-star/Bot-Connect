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

export const FINANCE_LONG_V4_GRAPHIC_STYLE =
  "Finance Long V4 graphic-first fintech motion graphics; dark technology explainer, clean vector diagrams, layered dimensional UI, deliberate editorial composition, not documentary photography";
export const FINANCE_LONG_V4_GRAPHIC_REALISM =
  "polished stylized 2.5D digital illustration with crisp vector geometry and dimensional interface elements; clearly non-photographic";
export const FINANCE_LONG_V4_GRAPHIC_COLOR_ATMOSPHERE =
  "deep black and navy with a subtle digital grid; electric cyan, vivid neon yellow, and coral accents; sharp contrast and controlled glow";
export const FINANCE_LONG_V4_GRAPHIC_NEGATIVE_PROMPT =
  "photograph, photorealistic still life, stock photography, photographed paper, printed charts, paper documents, brick walls, stone walls, physical display boards, realistic room, pseudo-text, illegible text, random letters, random numbers, logos, watermarks, blurry, low quality";

const FINANCE_LONG_V4_GRAPHIC_DIRECTIVE = [
  "Match the user's Finance Long V4 references: a premium dark-tech explainer frame with bold, intentional composition.",
  "Translate the scene concept into clean digital infographic shapes, luminous graph lines, modular UI panels, orbiting markers, and layered vector or 2.5D elements.",
  "If the scene description mentions paper, documents, a wall, a printed chart, or a physical board, reinterpret it as a digital graphic; do not depict a photograph of those objects.",
  "Use a restrained black/navy base with vivid cyan, yellow, and coral accents. Keep a clean area for accurate captions to be composited separately.",
  "Do not render words, letters, numbers, pseudo-writing, logos, or watermarks inside the image.",
].join("\n");

export function buildFinanceLongV4RegenerationPrompt(visualBrief: string): string {
  return [
    `Scene concept to visualize: ${visualBrief.trim()}`,
    `Visual style: ${FINANCE_LONG_V4_GRAPHIC_STYLE}`,
    `Realism: ${FINANCE_LONG_V4_GRAPHIC_REALISM}`,
    `Color atmosphere: ${FINANCE_LONG_V4_GRAPHIC_COLOR_ATMOSPHERE}`,
    "Aspect ratio: 16:9 landscape keyframe.",
    FINANCE_LONG_V4_GRAPHIC_DIRECTIVE,
  ].join("\n\n");
}

export function buildFinanceLongV4ScenePrompt(scene: {
  visual_description: string;
  image_prompt?: string;
}): string {
  return buildFinanceLongV4RegenerationPrompt(
    scene.visual_description || scene.image_prompt || "Aptos blockchain infrastructure",
  );
}

export function buildScenePrompt(
  scene: {
    voice_text: string;
    visual_description: string;
    image_prompt: string;
    scene_purpose?: string;
    story_beat?: string;
    cause?: string;
    action?: string;
    obstacle?: string;
    change?: string;
    continuity?: string;
    transition?: string;
  },
  settings: ImageGenerationSettings,
): string {
  if (settings.visualStyle === FINANCE_LONG_V4_GRAPHIC_STYLE) {
    return buildFinanceLongV4ScenePrompt(scene);
  }
  return [
    scene.image_prompt,
    `Scene action: ${scene.visual_description}`,
    `Narration context: ${scene.voice_text}`,
    scene.action ? `Dramatic action: ${scene.action}` : "",
    scene.obstacle ? `Visible obstacle: ${scene.obstacle}` : "",
    scene.change ? `Resulting change: ${scene.change}` : "",
    scene.continuity ? `Continuity to preserve: ${scene.continuity}` : "",
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