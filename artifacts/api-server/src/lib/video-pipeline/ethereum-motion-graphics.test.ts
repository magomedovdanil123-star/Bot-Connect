import assert from "node:assert/strict";
import test from "node:test";
import { buildEthereumMotionSceneGraphics } from "./ethereum-motion-graphics";
import type { CoinOverviewLongMotif } from "./coin-overview-long-edit";

test("Ethereum motion graphics do not append opacity to an already translucent color", () => {
  const motifs: CoinOverviewLongMotif[] = [
    "asset",
    "market",
    "comparison",
    "particles",
    "morph",
    "record",
    "network",
    "timeline",
    "access",
    "risk",
  ];
  const filters = motifs.flatMap((motif, layout) =>
    buildEthereumMotionSceneGraphics({
      width: 1920,
      height: 1080,
      start: 0,
      end: 10,
      layout,
      beat: {
        sceneId: layout + 1,
        beatIndex: 0,
        startMs: 0,
        endMs: 10_000,
        text: "Market data moves across a financial network",
        motif,
        visualDescription: "Animated numeric tokens move across a changing line graph",
      },
      motif,
    }),
  );

  assert.ok(filters.some((filter) => filter.includes("0x343a47@0.64")));
  assert.ok(!filters.some((filter) => /0x343a47@[\d.]+@[\d.]+/iu.test(filter)));
});