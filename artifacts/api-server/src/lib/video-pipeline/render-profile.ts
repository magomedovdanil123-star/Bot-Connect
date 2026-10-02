export type VideoMotionProfile =
  | "coin-review"
  | "coin-overview-long"
  | "finance-long-v4";

export type VideoCompositionMode =
  | "chat"
  | "coin-review"
  | "coin-overview-long"
  | "finance-long-v4"
  | "image-scenes";

export function resolveVideoCompositionMode(input: {
  format: string;
  motionProfile?: VideoMotionProfile;
}): VideoCompositionMode {
  if (input.format.toLocaleLowerCase().includes("chat")) return "chat";

  if (input.motionProfile === "finance-long-v4") {
    if (input.format !== "16:9") {
      throw new Error("Finance Long V4 requires a 16:9 render format");
    }
    return "finance-long-v4";
  }

  if (input.motionProfile === "coin-overview-long" && input.format === "16:9") {
    return "coin-overview-long";
  }

  if (input.motionProfile === "coin-review") return "coin-review";
  return "image-scenes";
}