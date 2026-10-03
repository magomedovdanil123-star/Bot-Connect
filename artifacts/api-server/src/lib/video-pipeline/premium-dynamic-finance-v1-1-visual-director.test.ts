import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPremiumDynamicFinanceV1_1VisualPlan,
  detectPremiumDynamicFinanceV1_1SemanticTags,
  PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES,
} from "./premium-dynamic-finance-v1-1-visual-director";
import {
  buildPremiumDynamicFinanceV1_1PilotVoices,
  PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS,
} from "./premium-dynamic-finance-v1-1-pilot-script";

const dogecoin = { id: "dogecoin", name: "Dogecoin", symbol: "DOGE" };
const dataAsOf = "2026-10-03T12:00:00.000Z";

test("Dogecoin pilot maps 12 semantic script scenes to 12 distinct visual forms", () => {
  const plan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices: buildPremiumDynamicFinanceV1_1PilotVoices(),
    entity: dogecoin,
    dataAsOf,
  });

  assert.equal(plan.events.length, 12);
  assert.deepEqual(
    plan.events.map((event) => event.visualType),
    [...PREMIUM_DYNAMIC_FINANCE_V1_1_VISUAL_TYPES],
  );
  assert.equal(plan.repeatedVisualTypes, 0);
  assert.equal(plan.fallbackScenes, 0);
  assert.equal(plan.events[0]?.visualType, "COIN_INTRO");
  assert.ok(plan.events[2]?.semanticTags.includes("PRICE"));
  assert.ok(plan.events[2]?.semanticTags.includes("COIN_MENTION"));
  assert.ok(plan.events[5]?.semanticTags.includes("COMPARISON"));
  assert.equal(plan.events[6]?.decorative, true);
  assert.equal(plan.events[7]?.decorative, true);
  assert.ok(plan.events.every((event) => event.endMs > event.startMs));
  assert.equal(plan.events.at(-1)?.endMs, PREMIUM_DYNAMIC_FINANCE_V1_1_PILOT_DURATION_MS);
});

test("chart detection reads scene text and selects a data chart instead of a generic illustration", () => {
  const plan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 10_000,
      text: "Dogecoin, тикер DOGE.",
    }, {
      sceneId: 2,
      startTime: 10_000,
      endTime: 20_000,
      text: "График цены Dogecoin показывает прошлые наблюдения.",
    }],
    entity: dogecoin,
    dataAsOf,
  });

  assert.equal(plan.events[1]?.visualType, "PRICE_CHART");
});

test("unknown text uses an explicitly counted editorial fallback", () => {
  const text = "Generic camera shot with no defined financial terminology.";
  assert.deepEqual(detectPremiumDynamicFinanceV1_1SemanticTags(text, dogecoin), []);
  const plan = buildPremiumDynamicFinanceV1_1VisualPlan({
    voices: [{ sceneId: 1, startTime: 0, endTime: 10_000, text }],
    entity: dogecoin,
    dataAsOf,
  });

  assert.equal(plan.events[0]?.visualType, "ILLUSTRATION");
  assert.equal(plan.fallbackScenes, 1);
  assert.match(plan.events[0]?.fallbackReason ?? "", /No semantic tags matched/u);
});