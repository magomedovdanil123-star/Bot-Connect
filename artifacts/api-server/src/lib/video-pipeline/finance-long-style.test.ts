import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FINANCE_LONG_COIN_HISTORY_PROFILE_KEY,
  FINANCE_LONG_RENDER_PROFILE_KEY,
  PREMIUM_DYNAMIC_FINANCE_PROFILE,
  PREMIUM_DYNAMIC_FINANCE_VERSION_ID,
  resolveFinanceLongVisualConfig,
  withFinanceLongCustomScriptProduction,
  withFinanceLongVisualProfile,
} from "./finance-long-style";

test("Finance Long always resolves to the V2 FINAL production profile", () => {
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    {
      [FINANCE_LONG_RENDER_PROFILE_KEY]: "PREMIUM_DYNAMIC_FINANCE_PRODUCTION",
      [FINANCE_LONG_COIN_HISTORY_PROFILE_KEY]: true,
      coin_overview_long_visual_profile: true,
    },
    "Обзор монеты TON",
  );

  assert.equal(config.enabled, true);
  assert.equal(config.premiumDynamic, true);
  assert.equal(config.productionProfile, PREMIUM_DYNAMIC_FINANCE_PROFILE);
  assert.equal(config.documentaryCoinHistory, false);
  assert.equal(config.keepLegacyCoinOverviewFlag, false);
  assert.equal(config.coinOverviewVector, false);
  assert.equal(config.frameRate, 30);
});

test("new Finance Long metadata replaces legacy visual flags with V2 FINAL", () => {
  const profile = withFinanceLongVisualProfile({
    coin_overview_long_visual_profile: true,
    [FINANCE_LONG_COIN_HISTORY_PROFILE_KEY]: true,
  }, "Обзор монеты TON");
  const customScript = withFinanceLongCustomScriptProduction(profile, "Обзор монеты TON");

  assert.equal(customScript[FINANCE_LONG_RENDER_PROFILE_KEY], PREMIUM_DYNAMIC_FINANCE_PROFILE);
  assert.equal(customScript.finance_long_custom_script_production_version, PREMIUM_DYNAMIC_FINANCE_VERSION_ID);
  assert.equal("coin_overview_long_visual_profile" in customScript, false);
  assert.equal(FINANCE_LONG_COIN_HISTORY_PROFILE_KEY in customScript, false);
});
