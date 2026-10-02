export type VideoMotionProfile =
  | "coin-review";

export type VideoCompositionMode =
  | "chat"
  | "coin-review"
  | "image-scenes";

export function resolveVideoCompositionMode(input: {
  format: string;
  motionProfile?: VideoMotionProfile;
}): VideoCompositionMode {
  if (input.format === "16:9" || input.format.toLocaleLowerCase().includes("long")) {
    throw new Error("16:9 Long-video composition is disabled.");
  }
  if (input.format.toLocaleLowerCase().includes("chat")) return "chat";
  if (input.motionProfile === "coin-review") return "coin-review";
  return "image-scenes";
}