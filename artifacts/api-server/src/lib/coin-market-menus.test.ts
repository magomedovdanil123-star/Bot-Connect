import assert from "node:assert/strict";
import test from "node:test";
import {
  coinFormatBackButton,
  coinFormatRetryButton,
  growingCoinsPeriodKeyboard,
} from "./coin-market-menus";
import { radarShortsPeriodKeyboard } from "./radar-shorts";

test("growth and Radar remain separate menu routes", () => {
  const growthCallbacks = growingCoinsPeriodKeyboard().inline_keyboard.flat().map((button) => button.callback_data);
  const radarCallbacks = radarShortsPeriodKeyboard().inline_keyboard.flat().map((button) => button.callback_data);

  assert.deepEqual(growthCallbacks, [
    "crypto:coin_overview:topic",
    "crypto:market_focus:topic",
    "crypto:market_focus_30d:auto",
    "menu:finance",
  ]);
  assert.deepEqual(radarCallbacks, [
    "crypto:radar_shorts:24h",
    "crypto:radar_shorts:7d",
    "crypto:radar_shorts:30d",
    "menu:finance",
  ]);
  assert.notEqual(
    coinFormatBackButton("growth").callback_data,
    coinFormatBackButton("radar").callback_data,
  );
});

test("retry buttons return to the flow that started the market scan", () => {
  assert.equal(coinFormatRetryButton("growth", "24h").callback_data, "crypto:market_focus:topic");
  assert.equal(coinFormatRetryButton("growth", "7d").callback_data, "crypto:coin_overview:topic");
  assert.equal(coinFormatRetryButton("growth", "30d").callback_data, "crypto:market_focus_30d:auto");
  assert.equal(coinFormatRetryButton("radar", "24h").callback_data, "crypto:radar_shorts:24h");
  assert.equal(coinFormatRetryButton("radar", "7d").callback_data, "crypto:radar_shorts:7d");
  assert.equal(coinFormatRetryButton("radar", "30d").callback_data, "crypto:radar_shorts:30d");
});