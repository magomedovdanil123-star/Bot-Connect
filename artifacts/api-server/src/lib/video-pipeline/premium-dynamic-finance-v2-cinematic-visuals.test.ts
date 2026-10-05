import assert from "node:assert/strict";
import { test } from "node:test";
import {
  alignPremiumFinanceV2SfxEvents,
  buildPremiumFinanceV2SubtitleEmphasisEvents,
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
  assert.equal(
    new Set(Object.values(PREMIUM_FINANCE_V2_SCENE_BRIEFS).map((scene) => scene.safeRect.placement)).size >= 4,
    true,
    "captions should move to match the scene composition",
  );
});

test("semantic kinetic captions preserve every Scribe word and accent key data", () => {
  const words = [
    { text: "Dogecoin", startMs: 100, endMs: 420 },
    { text: "вырос", startMs: 470, endMs: 820 },
    { text: "на", startMs: 860, endMs: 900 },
    { text: "127%", startMs: 910, endMs: 1_150 },
    { text: "но", startMs: 1_650, endMs: 1_820 },
    { text: "риск", startMs: 1_870, endMs: 2_010 },
    { text: "сохраняется.", startMs: 2_050, endMs: 2_400 },
  ];
  const emphasisEvents = buildPremiumFinanceV2SubtitleEmphasisEvents(words);
  const result = buildPremiumFinanceV2KineticAss({
    words,
    windows: [{
      sceneId: 1,
      startMs: 0,
      endMs: 3_000,
      narration: "Dogecoin вырос на 127%, но риск сохраняется.",
      semanticType: "market",
    }],
    emphasisEvents,
    durationMs: 3_000,
  });

  assert.equal(result.wordCount, words.length);
  assert.ok(result.phraseCount >= 3);
  assert.match(result.ass, /Dialogue: 1,0:00:00\.10/u);
  assert.match(result.ass, /Dialogue: 1,0:00:00\.47/u);
  assert.match(result.ass, /Dialogue: 1,0:00:00\.91/u);
  assert.match(result.ass, /DOGECOIN/u);
  assert.match(result.ass, /127%/u);
  assert.match(result.ass, /\\clip\(/u);
  assert.match(result.ass, /\\fscx64/u);
  const fontSizes = [...result.ass.matchAll(/\\fs(\d+)/gu)].map((match) => Number(match[1]));
  assert.ok(fontSizes.some((size) => size >= 56 && size <= 88));
  assert.ok(fontSizes.some((size) => size >= 92 && size <= 144));
});

test("existing SFX cues move to a nearby exact subtitle key-word timestamp", () => {
  const synced = alignPremiumFinanceV2SfxEvents(
    [{ sceneId: 1, startMs: 820, kind: "impact" as const }],
    [{
      sceneId: 1,
      startMs: 0,
      endMs: 2_000,
      narration: "Цена выросла.",
      semanticType: "market",
    }],
    [{
      word: "выросла",
      startMs: 650,
      endMs: 920,
      intensity: "impact",
      tone: "green",
    }],
  );
  assert.equal(synced[0]?.startMs, 650);
});

test("transition names map to supported FFmpeg xfade transitions", () => {
  assert.equal(mapPremiumFinanceV2Transition("flash-cut"), "fadewhite");
  assert.equal(mapPremiumFinanceV2Transition("whip-left"), "smoothleft");
  assert.equal(mapPremiumFinanceV2Transition("whip-right"), "smoothright");
  assert.equal(mapPremiumFinanceV2Transition("snap-cut"), "fade");
  assert.equal(mapPremiumFinanceV2Transition("unknown"), "dissolve");
});
