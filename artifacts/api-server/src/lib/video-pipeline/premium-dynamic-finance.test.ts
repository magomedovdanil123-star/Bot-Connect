import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCE_LONG_LEGACY_RENDER_PROFILE,
  FINANCE_LONG_RENDER_PROFILE_KEY,
  PREMIUM_DYNAMIC_FINANCE_PROFILE,
  resolveFinanceLongVisualConfig,
  withFinanceLongVisualProfile,
} from "./finance-long-style";
import {
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY,
} from "./ethereum-motion-design";
import {
  buildPremiumDynamicFinanceEditPlan,
  buildPremiumFinanceEmphasisEvents,
} from "./premium-dynamic-finance";
import { buildLongformKineticSubtitleAss } from "./longform-kinetic-subtitles";

test("new Telegram Finance Long drafts select the versioned premium renderer", () => {
  const tagged = withFinanceLongVisualProfile({ title: "Bitcoin" }, "Bitcoin");
  assert.equal(tagged[FINANCE_LONG_RENDER_PROFILE_KEY], PREMIUM_DYNAMIC_FINANCE_PROFILE);
  assert.equal(
    resolveFinanceLongVisualConfig("YouTube Finance Long Video", tagged, "Bitcoin").premiumDynamic,
    true,
  );
});

test("untagged old drafts and explicit legacy drafts retain Finance Long V4", () => {
  assert.equal(
    resolveFinanceLongVisualConfig(
      "YouTube Finance Long Video",
      { finance_long_v4_visual_profile: true },
      "Bitcoin",
    ).premiumDynamic,
    false,
  );
  assert.equal(
    resolveFinanceLongVisualConfig(
      "YouTube Finance Long Video",
      { [FINANCE_LONG_RENDER_PROFILE_KEY]: FINANCE_LONG_LEGACY_RENDER_PROFILE },
      "Bitcoin",
    ).premiumDynamic,
    false,
  );
});

test("explicit Ethereum motion remains isolated from the premium default", () => {
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    {
      [FINANCE_LONG_RENDER_PROFILE_KEY]: PREMIUM_DYNAMIC_FINANCE_PROFILE,
      [FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY]: FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
    },
    "Ethereum",
  );
  assert.equal(config.ethereumMotion, true);
  assert.equal(config.premiumDynamic, false);
});

test("the edit plan keeps kinetic text verbatim and caps impact within the visual budget", () => {
  const text = Array.from({ length: 120 }, (_, index) => {
    const words = [
      "Bitcoin", "объем", "растет", "но", "риск", "коррекции", "сохраняется",
      `${index + 1}%`, "итог", "зависит", "от", "ликвидности",
    ];
    return words[index % words.length];
  }).join(" ");
  const plan = buildPremiumDynamicFinanceEditPlan({
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 120_000,
      text,
    }],
    durationMs: 120_000,
    topic: "Bitcoin",
  });

  assert.ok(plan.beats.length >= 10);
  assert.ok(plan.intensityCounts.impact <= Math.floor(plan.beats.length * 0.1));
  assert.ok(plan.intensityCounts.dynamic <= Math.floor(plan.beats.length * 0.2));
  assert.ok(plan.beats.some((beat) => beat.keyWords.includes("Bitcoin")));
  for (const beat of plan.beats) {
    if (beat.kineticText) {
      assert.ok(beat.voiceExcerpt.toLocaleLowerCase("ru-RU").includes(beat.kineticText.toLocaleLowerCase("ru-RU")));
    }
  }
  assert.ok(plan.sfxEvents.length <= 6);
  assert.ok(plan.sfxEvents.every((event) => event.startMs >= 0 && event.startMs < 120_000));
  assert.ok(buildPremiumFinanceEmphasisEvents(plan.beats).length <= plan.beats.length * 0.3);
});

test("premium captions keep supporting words restrained and animate only planned emphasis", () => {
  const captions = buildLongformKineticSubtitleAss({
    words: [
      { text: "Bitcoin", startMs: 0, endMs: 300 },
      { text: "вырос", startMs: 320, endMs: 620 },
      { text: "на", startMs: 630, endMs: 700 },
      { text: "12%", startMs: 710, endMs: 950 },
    ],
    durationMs: 1_000,
    width: 1_920,
    height: 1_080,
    emphasisEvents: [{
      word: "12%",
      startMs: 710,
      endMs: 950,
      intensity: "impact",
      tone: "gold",
    }],
  }).ass;
  const lines = captions.split("\n").filter((line) => line.startsWith("Dialogue: 1,"));
  const bitcoin = lines.find((line) => line.endsWith("BITCOIN"));
  const number = lines.find((line) => line.endsWith("12%"));
  assert.ok(bitcoin?.includes("\\1c&H00FAF7F5&"));
  assert.ok(number?.includes("\\1c&H0066D1FF&"));
  assert.ok(number?.includes("\\fscx42"));
});