import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPremiumFinanceV2KineticAss,
  buildPremiumFinanceV2SceneWindows,
  getPremiumFinanceV2SceneComposition,
  mapPremiumFinanceV2Transition,
  PREMIUM_FINANCE_V2_SCENE_BRIEFS,
} from "./premium-dynamic-finance-v2-cinematic-visuals";

test("cinematic scene windows are contiguous and preserve the requested duration", () => {
  const script = [
    { sceneId: 1, startMs: 200, endMs: 1_000, text: "Первый фрагмент.", semanticType: "history" },
    { sceneId: 2, startMs: 1_500, endMs: 2_500, text: "Второй фрагмент.", semanticType: "market" },
    { sceneId: 3, startMs: 2_600, endMs: 3_100, text: "Последний фрагмент.", semanticType: "close" },
  ];
  const windows = buildPremiumFinanceV2SceneWindows(script, [1, 2, 3], 3_200);

  assert.equal(windows[0]!.startMs, 0);
  assert.equal(windows[0]!.endMs, 1_250);
  assert.equal(windows[1]!.startMs, windows[0]!.endMs);
  assert.equal(windows[1]!.endMs, 2_550);
  assert.equal(windows[2]!.startMs, windows[1]!.endMs);
  assert.equal(windows[2]!.endMs, 3_200);
  assert.equal(windows.reduce((sum, window) => sum + window.endMs - window.startMs, 0), 3_200);
});

test("all planned subtitle-safe zones stay outside the primary focal rectangle", () => {
  for (const sceneId of Object.keys(PREMIUM_FINANCE_V2_SCENE_BRIEFS).map(Number)) {
    const { focalRect, safeRect } = getPremiumFinanceV2SceneComposition(sceneId);
    const overlaps = focalRect.x < safeRect.x + safeRect.width
      && safeRect.x < focalRect.x + focalRect.width
      && focalRect.y < safeRect.y + safeRect.height
      && safeRect.y < focalRect.y + focalRect.height;
    assert.equal(overlaps, false, `scene ${sceneId} safe zone overlaps its focal subject`);
  }
});

test("kinetic captions preserve Scribe word times and split into short phrases", () => {
  const result = buildPremiumFinanceV2KineticAss({
    words: [
      { text: "Цена", startMs: 100, endMs: 420 },
      { text: "движется", startMs: 470, endMs: 820 },
      { text: "быстро,", startMs: 860, endMs: 1_150 },
      { text: "но", startMs: 1_650, endMs: 1_820 },
      { text: "не", startMs: 1_870, endMs: 2_010 },
      { text: "всегда.", startMs: 2_050, endMs: 2_400 },
    ],
    windows: [{
      sceneId: 1,
      startMs: 0,
      endMs: 5_000,
      narration: "Цена движется быстро, но не всегда.",
      semanticType: "market",
    }],
    emphasisWordsByScene: { 1: ["быстро"] },
    durationMs: 5_000,
  });

  assert.equal(result.wordCount, 6);
  assert.equal(result.phraseCount, 2);
  assert.match(result.ass, /0:00:00\.10,0:00:01\.30,Kinetic/);
  assert.match(result.ass, /0:00:00\.47,0:00:01\.30,Kinetic/);
  assert.match(result.ass, /БЫСТРО,/);
  assert.match(result.ass, /ВСЕГДА\./);
});

test("transition names map to supported FFmpeg xfade transitions", () => {
  assert.equal(mapPremiumFinanceV2Transition("flash-cut"), "fadewhite");
  assert.equal(mapPremiumFinanceV2Transition("whip-left"), "smoothleft");
  assert.equal(mapPremiumFinanceV2Transition("whip-right"), "smoothright");
  assert.equal(mapPremiumFinanceV2Transition("snap-cut"), "fade");
  assert.equal(mapPremiumFinanceV2Transition("unknown"), "dissolve");
});
