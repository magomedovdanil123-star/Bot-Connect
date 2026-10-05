export type VideoMotionProfile =
  | "coin-review"
  | "finance-long-v4"
  | "premium-dynamic-finance-v2-final";

export type VideoCompositionMode =
  | "chat"
  | "coin-review"
  | "image-scenes"
  | "finance-long-v4"
  | "premium-dynamic-finance-v2-final";

export function resolveVideoCompositionMode(input: {
  format: string;
  motionProfile?: VideoMotionProfile;
}): VideoCompositionMode {
  if (input.motionProfile === "premium-dynamic-finance-v2-final") {
    const isLandscapeLong = input.format === "16:9"
      || input.format.toLocaleLowerCase().includes("long");
    if (!isLandscapeLong) {
      throw new Error("PREMIUM_DYNAMIC_FINANCE_V2_FINAL requires a 16:9 Finance Long render format.");
    }
    return "premium-dynamic-finance-v2-final";
  }
  if (input.motionProfile === "finance-long-v4") {
    const isLandscapeLong = input.format === "16:9"
      || input.format.toLocaleLowerCase().includes("long");
    if (!isLandscapeLong) {
      throw new Error("Finance Long composition requires a 16:9 render format.");
    }
    return "finance-long-v4";
  }
  if (input.format === "16:9" || input.format.toLocaleLowerCase().includes("long")) {
    throw new Error("16:9 Long-video composition is disabled.");
  }
  if (input.format.toLocaleLowerCase().includes("chat")) return "chat";
  if (input.motionProfile === "coin-review") return "coin-review";
  return "image-scenes";
}