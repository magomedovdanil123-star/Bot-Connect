import assert from "node:assert/strict";
import { test } from "node:test";
import {
  requiresCompletedSceneImage,
  resolveVideoCompositionMode,
} from "./render-profile";

test("V2 FINAL is selected as a landscape Finance Long composition", () => {
  assert.equal(resolveVideoCompositionMode({
    format: "YouTube Finance Long Video",
    motionProfile: "premium-dynamic-finance-v2-final",
  }), "premium-dynamic-finance-v2-final");
});

test("V2 FINAL fails closed for a non-landscape format", () => {
  assert.throws(
    () => resolveVideoCompositionMode({
      format: "9:16",
      motionProfile: "premium-dynamic-finance-v2-final",
    }),
    /requires a 16:9 Finance Long render format/u,
  );
});

test("16:9 cannot silently select a legacy composition", () => {
  assert.throws(
    () => resolveVideoCompositionMode({ format: "16:9" }),
    /16:9 Long-video composition is disabled/u,
  );
});

test("V2 FINAL can render without scene images while ordinary scenes still require one", () => {
  assert.equal(requiresCompletedSceneImage({
    compositionMode: "premium-dynamic-finance-v2-final",
    coinOverviewLongMotion: false,
  }), false);
  assert.equal(requiresCompletedSceneImage({
    compositionMode: "finance-long-v4",
    coinOverviewLongMotion: false,
  }), true);
  assert.equal(requiresCompletedSceneImage({
    compositionMode: "image-scenes",
    coinOverviewLongMotion: true,
  }), false);
});
