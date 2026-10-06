export type WhaleFlowAction = "BUY" | "SELL";
export type WhaleFlowNode = "wallet" | "dex" | "token";

export type WhaleRadarV2MotionProfile = {
  cameraZoom: number;
  cameraPunch: number;
  routeProgress: number;
  nodePulse: number;
  lightSweep: number;
};

export function getWhaleFlowNodeOrder(action: WhaleFlowAction): WhaleFlowNode[] {
  return action === "BUY"
    ? ["wallet", "dex", "token"]
    : ["token", "dex", "wallet"];
}

export function getWhaleRadarV2MotionProfile(
  sceneTimeSeconds: number,
  sceneDurationSeconds: number,
  sceneIndex: number,
): WhaleRadarV2MotionProfile {
  const duration = Math.max(1, sceneDurationSeconds);
  const t = Math.max(0, Math.min(duration, sceneTimeSeconds));
  const transitionIn = Math.max(0, 1 - t / 0.72);
  const transitionOut = Math.max(0, (t - (duration - 0.9)) / 0.9);
  const punch = Math.max(transitionIn, transitionOut);
  const normalized = t / duration;

  return {
    cameraZoom: 1.012 + Math.sin(normalized * Math.PI * 2 + sceneIndex * 0.72) * 0.014 + punch * 0.025,
    cameraPunch: punch,
    routeProgress: Math.max(0, Math.min(1, normalized * 1.14)),
    nodePulse: 0.5 + 0.5 * Math.sin(t * 3.2 + sceneIndex * 1.17),
    lightSweep: (normalized + sceneIndex * 0.13) % 1,
  };
}

export function getWhaleFlowSegment(progress: number): {
  segmentIndex: 0 | 1;
  segmentProgress: number;
} {
  const safeProgress = Math.max(0, Math.min(1, progress));
  if (safeProgress < 0.5) {
    return { segmentIndex: 0, segmentProgress: safeProgress * 2 };
  }
  return { segmentIndex: 1, segmentProgress: (safeProgress - 0.5) * 2 };
}
