import assert from "node:assert/strict";
import { test } from "node:test";
import { radarShortsPeriodKeyboard, applyRadarShortsYoutubeSeo } from "./radar-shorts";
import type { YoutubeMetadata } from "./youtube-metadata-fallback";

const BASE_METADATA: YoutubeMetadata = {
  title: "Рост SOL на 12% за 24 часа: что произошло?",
  description: "Разбираем рыночные данные по SOL и текущую динамику крипторынка.\n\n#shorts #криптовалюта #sol",
  tags: ["криптовалюта", "SOL", "рыночный обзор", "факты"],
  hashtags: ["#shorts", "#криптовалюта", "#sol"],
};

test("Radar Shorts period menu routes directly to each top-10 ranking", () => {
  const keyboard = radarShortsPeriodKeyboard();
  assert.deepEqual(
    keyboard.inline_keyboard.slice(0, 3).map((row) => row[0]?.callback_data),
    [
      "crypto:radar_shorts:24h",
      "crypto:radar_shorts:7d",
      "crypto:radar_shorts:30d",
    ],
  );
  assert.match(keyboard.inline_keyboard[0]?.[0]?.text ?? "", /24 часа.*топ-10/u);
  assert.match(keyboard.inline_keyboard[1]?.[0]?.text ?? "", /7 дней.*топ-10/u);
  assert.match(keyboard.inline_keyboard[2]?.[0]?.text ?? "", /30 дней.*топ-10/u);
});

test("Radar Shorts metadata includes the coin, selected period, verified movement, and crypto SEO", () => {
  const metadata = applyRadarShortsYoutubeSeo(BASE_METADATA, {
    coinName: "Solana",
    symbol: "SOL",
    periodLabel: "24 часа",
    changePercent: 12.345,
  });

  assert.match(metadata.description, /Solana \(SOL\).*24 часа: рост на 12,35%/u);
  assert.ok(metadata.tags.includes("криптовалюта"));
  assert.ok(metadata.tags.includes("крипторынок"));
  assert.ok(metadata.tags.includes("Solana"));
  assert.ok(metadata.tags.includes("SOL 24 часа"));
  assert.deepEqual(metadata.hashtags, ["#shorts", "#криптовалюта", "#sol"]);
  assert.match(metadata.description, /@viberolebot.*#viberolebot.*#вайббот/su);
});

test("Radar Shorts SEO preserves falling-period facts and caps tags at YouTube limits", () => {
  const metadata = applyRadarShortsYoutubeSeo({
    ...BASE_METADATA,
    tags: Array.from({ length: 30 }, (_, index) => `дополнительный тег ${index}`),
  }, {
    coinName: "Bitcoin",
    symbol: "BTC",
    periodLabel: "7 дней",
    changePercent: -4.2,
  });

  assert.match(metadata.description, /Bitcoin \(BTC\).*7 дней: снижение на 4,2%/u);
  assert.ok(metadata.tags.length <= 30);
  assert.ok(metadata.tags.length > 10);
  assert.ok(metadata.tags.includes("Bitcoin"));
  assert.ok(Buffer.byteLength(metadata.tags.join(","), "utf8") <= 500);
});