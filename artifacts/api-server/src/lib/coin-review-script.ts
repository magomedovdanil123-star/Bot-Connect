export type CoinReviewScene = {
  scene_number: number;
  voice_text: string;
  visual_description: string;
  duration_seconds: number;
};

export function capCoinReviewScenes<T extends CoinReviewScene>(
  scenes: T[],
  maxScenes = 24,
): T[] {
  if (!Number.isInteger(maxScenes) || maxScenes < 1) {
    throw new Error("Coin review scene limit must be a positive integer");
  }
  if (scenes.length === 0) return [];
  if (scenes.length <= maxScenes) {
    return scenes.map((scene, index) => ({ ...scene, scene_number: index + 1 }));
  }

  return Array.from({ length: maxScenes }, (_, index) => {
    const start = Math.floor(index * scenes.length / maxScenes);
    const end = Math.floor((index + 1) * scenes.length / maxScenes);
    const group = scenes.slice(start, end);
    const first = group[0]!;
    return {
      ...first,
      scene_number: index + 1,
      voice_text: group.map((scene) => scene.voice_text.trim()).filter(Boolean).join(" "),
      visual_description: group.map((scene) => scene.visual_description.trim()).filter(Boolean).join("; "),
      duration_seconds: group.reduce((total, scene) => total + scene.duration_seconds, 0),
    };
  });
}