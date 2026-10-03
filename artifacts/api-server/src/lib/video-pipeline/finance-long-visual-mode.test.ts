import assert from "node:assert/strict";
import test from "node:test";
import {
  FINANCE_LONG_COIN_HISTORY_PROFILE_KEY,
  resolveFinanceLongVisualConfig,
} from "./finance-long-style";
import {
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY,
} from "./ethereum-motion-design";
import {
  FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE,
  FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY,
} from "./finance-long-coin-overview-vector";

test("documentary Ethereum motion selects its image-free 60 FPS renderer mode", () => {
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    {
      [FINANCE_LONG_COIN_HISTORY_PROFILE_KEY]: true,
      [FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY]: FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
    },
    "Chainlink (LINK)",
  );

  assert.equal(config.documentaryCoinHistory, true);
  assert.equal(config.ethereumMotion, true);
  assert.equal(config.paletteMode, "ethereum-motion");
  assert.equal(config.frameRate, 60);
});

test("ordinary Finance Long projects keep the pump-dynamic palette", () => {
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    {},
    "Bitcoin",
  );

  assert.equal(config.ethereumMotion, false);
  assert.equal(config.paletteMode, "pump-dynamic");
  assert.equal(config.frameRate, 30);
});

test("the first-button coin overview profile keeps its own dark vector renderer at 60 FPS", () => {
  const config = resolveFinanceLongVisualConfig(
    "YouTube Finance Long Video",
    {
      [FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY]: FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE,
    },
    "XRP (Ripple)",
  );

  assert.equal(config.coinOverviewVector, true);
  assert.equal(config.ethereumMotion, false);
  assert.equal(config.paletteMode, "pump-dynamic");
  assert.equal(config.frameRate, 60);

  const unrelatedFormat = resolveFinanceLongVisualConfig(
    "YouTube Long Video",
    {
      [FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY]: FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE,
    },
    "XRP (Ripple)",
  );
  assert.equal(unrelatedFormat.coinOverviewVector, false);
  assert.equal(unrelatedFormat.frameRate, 30);
});