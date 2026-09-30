import assert from "node:assert/strict";
import test from "node:test";
import { capCoinReviewScenes, type CoinReviewScene } from "./coin-review-script";

function makeScenes(count: number): CoinReviewScene[] {
  return Array.from({ length: count }, (_, index) => ({
    scene_number: index + 1,
    voice_text: `Narration ${index + 1}`,
    visual_description: `Visual ${index + 1}`,
    duration_seconds: 10,
  }));
}

test("caps a long review at 24 scenes without losing speech or duration", () => {
  const source = makeScenes(31);
  const result = capCoinReviewScenes(source);

  assert.equal(result.length, 24);
  assert.deepEqual(result.map((scene) => scene.scene_number), Array.from({ length: 24 }, (_, index) => index + 1));
  assert.equal(result.reduce((total, scene) => total + scene.duration_seconds, 0), 310);
  for (const sourceScene of source) {
    assert.ok(result.some((scene) => scene.voice_text.includes(sourceScene.voice_text)));
    assert.ok(result.some((scene) => scene.visual_description.includes(sourceScene.visual_description)));
  }
});

test("renumbers scenes without merging when already within the limit", () => {
  const result = capCoinReviewScenes(makeScenes(20));

  assert.equal(result.length, 20);
  assert.deepEqual(result.map((scene) => scene.scene_number), Array.from({ length: 20 }, (_, index) => index + 1));
  assert.deepEqual(result.map((scene) => scene.voice_text), makeScenes(20).map((scene) => scene.voice_text));
});

test("rejects an invalid scene limit", () => {
  assert.throws(() => capCoinReviewScenes(makeScenes(2), 0), /positive integer/);
});

test("keeps an empty result empty", () => {
  assert.deepEqual(capCoinReviewScenes([]), []);
});