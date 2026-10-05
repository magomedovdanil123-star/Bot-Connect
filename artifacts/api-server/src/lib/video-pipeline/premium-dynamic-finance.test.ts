import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCE_LONG_LEGACY_RENDER_PROFILE,
  FINANCE_LONG_CUSTOM_SCRIPT_PRODUCTION_KEY,
  FINANCE_LONG_CUSTOM_SCRIPT_PRODUCTION_VERSION_KEY,
  FINANCE_LONG_COIN_HISTORY_PROFILE_KEY,
  FINANCE_LONG_RENDER_PROFILE_KEY,
  LEGACY_PREMIUM_DYNAMIC_FINANCE_PROFILE,
  PREMIUM_DYNAMIC_FINANCE_PROFILE,
  PREMIUM_DYNAMIC_FINANCE_VERSION_ID,
  buildFinanceLongStoryboardSvg,
  resolveFinanceLongVisualConfig,
  withFinanceLongCustomScriptProduction,
  withFinanceLongVisualProfile,
} from "./finance-long-style";
import {
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY,
} from "./ethereum-motion-design";
import {
  FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE,
  FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY,
} from "./finance-long-coin-overview-vector";
import {
  createTelegramFinanceLongCustomScriptOptions,
  dispatchTelegramFinanceLongScriptDoneUpdate,
  FINANCE_LONG_SCRIPT_DONE_CALLBACK,
} from "./telegram-finance-long-script";
import {
  buildPremiumDynamicFinanceEditPlan,
  buildPremiumFinanceEmphasisEvents,
  extractFinanceLongCoinSymbolFromTopic,
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

test("Finance Long storyboard preview uses the V2 FINAL palette", () => {
  const svg = buildFinanceLongStoryboardSvg({
    title: "TON market structure",
    scenes: [{
      scene_number: 1,
      voice_text: "TON market activity changed during the week.",
      visual_description: "A seven-day market chart with clearly labeled source data.",
    }],
    themeIndex: 0,
    motionDesignProfile: "premium-dynamic-finance-v2-final",
  });

  assert.match(svg, /FINANCE LONG · PREMIUM DYNAMIC V2 FINAL/u);
  assert.match(svg, /#F3B74C/u);
  assert.match(svg, /#72E4BE/u);
  assert.match(svg, /#F3EAD8/u);
  assert.doesNotMatch(svg, /#EAFF00|#14D8F0|#FF526F/u);
});

test("Telegram custom-script route selects V2 FINAL instead of legacy coin-vector mode", () => {
  const routeOptions = createTelegramFinanceLongCustomScriptOptions(
    "Обзор монеты Bitcoin по авторскому сценарию",
    "Verified Bitcoin context",
  );
  assert.equal(routeOptions.authorScript, true);
  assert.equal(routeOptions.coinOverview, true);
  assert.equal("coinOverviewVector" in routeOptions, false);

  const projectMetadata = withFinanceLongCustomScriptProduction({
    title: "Bitcoin",
    coin_overview_long_visual_profile: true,
    [FINANCE_LONG_COIN_HISTORY_PROFILE_KEY]: true,
    [FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY]: FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
    [FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY]: FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE,
  }, routeOptions.topicLabel);
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    projectMetadata,
    routeOptions.topicLabel,
  );

  assert.equal(projectMetadata[FINANCE_LONG_CUSTOM_SCRIPT_PRODUCTION_KEY], true);
  assert.equal(
    projectMetadata[FINANCE_LONG_CUSTOM_SCRIPT_PRODUCTION_VERSION_KEY],
    PREMIUM_DYNAMIC_FINANCE_VERSION_ID,
  );
  assert.equal(PREMIUM_DYNAMIC_FINANCE_VERSION_ID, "PREMIUM_DYNAMIC_FINANCE_V2_FINAL");
  assert.equal(projectMetadata[FINANCE_LONG_RENDER_PROFILE_KEY], PREMIUM_DYNAMIC_FINANCE_PROFILE);
  assert.equal(config.customScriptProduction, true);
  assert.equal(config.premiumDynamic, true);
  assert.equal(config.keepLegacyCoinOverviewFlag, false);
  assert.equal(config.documentaryCoinHistory, false);
  assert.equal(config.ethereumMotion, false);
  assert.equal(config.coinOverviewVector, false);
  assert.equal(config.frameRate, 30);
});

test("standard and author-script coin topics both resolve a verified symbol for the V2 renderer", () => {
  assert.equal(
    extractFinanceLongCoinSymbolFromTopic("История монеты Bitcoin (btc)"),
    "BTC",
  );
  assert.equal(
    extractFinanceLongCoinSymbolFromTopic("Обзор монеты Bitcoin (BTC) по авторскому сценарию"),
    "BTC",
  );
  assert.equal(extractFinanceLongCoinSymbolFromTopic("История монеты Bitcoin"), undefined);
});

test("previously saved Telegram author-script topics migrate away from their vector profile", () => {
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    { [FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY]: FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE },
    "Обзор монеты Bitcoin по авторскому сценарию",
  );
  assert.equal(config.customScriptProduction, true);
  assert.equal(config.premiumDynamic, true);
  assert.equal(config.coinOverviewVector, false);
  assert.equal(config.frameRate, 30);
});

test("synthetic Telegram script-done update dispatches only the approved author-script route", async () => {
  const script = "Bitcoin is an open monetary network. ".repeat(4);
  const coinContext = { coinId: "bitcoin", verified: true };
  let dispatched = false;
  const result = await dispatchTelegramFinanceLongScriptDoneUpdate(
    {
      callbackData: FINANCE_LONG_SCRIPT_DONE_CALLBACK,
      script,
      coinContext,
    },
    async (submittedScript, verifiedCoinContext) => {
      dispatched = true;
      assert.equal(submittedScript, script);
      assert.equal(verifiedCoinContext, coinContext);
      const options = createTelegramFinanceLongCustomScriptOptions(
        "Обзор монеты Bitcoin по авторскому сценарию",
        "Verified Bitcoin context",
      );
      const metadata = withFinanceLongCustomScriptProduction({}, options.topicLabel);
      const config = resolveFinanceLongVisualConfig(
        "YouTube Finance Long Video",
        metadata,
        options.topicLabel,
      );
      assert.equal(options.authorScript, true);
      assert.equal(options.coinOverview, true);
      assert.equal("coinOverviewVector" in options, false);
      assert.equal(config.customScriptProduction, true);
      assert.equal(config.premiumDynamic, true);
    },
  );

  assert.equal(result, "started");
  assert.equal(dispatched, true);
  assert.equal(await dispatchTelegramFinanceLongScriptDoneUpdate(
    { callbackData: "finance:long:script:undo", script },
    async () => assert.fail("unrelated callback must not start production"),
  ), "ignored");
  assert.equal(await dispatchTelegramFinanceLongScriptDoneUpdate(
    { callbackData: FINANCE_LONG_SCRIPT_DONE_CALLBACK, script: "short script" },
    async () => assert.fail("short scripts must not start production"),
  ), "script-too-short");
});

test("stored PREMIUM_DYNAMIC_FINANCE_V1 drafts remain on the premium renderer", () => {
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    { [FINANCE_LONG_RENDER_PROFILE_KEY]: LEGACY_PREMIUM_DYNAMIC_FINANCE_PROFILE },
    "Bitcoin",
  );
  assert.equal(config.premiumDynamic, true);
});

test("untagged and legacy Finance Long drafts migrate to V2 FINAL", () => {
  const untagged = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    { finance_long_v4_visual_profile: true },
    "Bitcoin",
  );
  const explicitlyLegacy = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    { [FINANCE_LONG_RENDER_PROFILE_KEY]: FINANCE_LONG_LEGACY_RENDER_PROFILE },
    "Bitcoin",
  );
  assert.equal(untagged.premiumDynamic, true);
  assert.equal(untagged.productionProfile, PREMIUM_DYNAMIC_FINANCE_PROFILE);
  assert.equal(explicitlyLegacy.premiumDynamic, true);
  assert.equal(explicitlyLegacy.productionProfile, PREMIUM_DYNAMIC_FINANCE_PROFILE);
});

test("explicit Ethereum and vector flags cannot override V2 FINAL", () => {
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    {
      [FINANCE_LONG_RENDER_PROFILE_KEY]: PREMIUM_DYNAMIC_FINANCE_PROFILE,
      [FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY]: FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
    },
    "Ethereum",
  );
  assert.equal(config.ethereumMotion, false);
  assert.equal(config.premiumDynamic, true);
  assert.equal(config.productionProfile, PREMIUM_DYNAMIC_FINANCE_PROFILE);
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