import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCryptoDocumentaryArtwork,
  buildCryptoDocumentaryScenePlan,
  formatCryptoDocumentaryMarketSummary,
  type CryptoDocumentaryMarket,
} from "./premium-dynamic-finance-v1-1-crypto-documentary-visuals";
import { buildSmallWordSubtitleAss } from "./premium-dynamic-finance-v1-1-crypto-documentary-renderer";

const narrationScenes = [
  {
    sceneId: 3,
    text: "В недельном ряду покажем измеренный восходящий фрагмент по реальным точкам, не продолжая линию в будущее.",
  },
  {
    sceneId: 4,
    text: "В том же ряду есть нисходящий участок. Он описывает прошлое снижение, а не сигнал для сделки.",
  },
  {
    sceneId: 5,
    text: "Рыночная капитализация оценивает весь обращающийся рынок, а не цену одной монеты и не деньги на счёте.",
  },
  {
    sceneId: 6,
    text: "Сравним монету с биткоином за одинаковые семь дней. Один временной интервал даёт контекст, но не объясняет причины.",
  },
  {
    sceneId: 7,
    text: "Мемы и заголовки создают информационный шум. Эта сцена — абстрактная реконструкция, а не настоящая новость.",
  },
  {
    sceneId: 8,
    text: "У монеты есть сообщество и проекты. Не будем подменять их выдуманными числами аудитории, постами или цитатами.",
  },
];

const market: CryptoDocumentaryMarket = {
  dataAsOf: "2026-10-04T13:01:20.000Z",
  sourceLabel: "CoinGecko",
  sourceUrl: "https://www.coingecko.com/en/coins/dogecoin",
  priceSamples: [
    0.09808782150688386,
    0.0943272409370802,
    0.09401055808900624,
    0.09450892695084427,
    0.09674387652083344,
    0.09252775178712423,
    0.09339743439911617,
  ],
  riseSegment: { fromIndex: 2, toIndex: 4, changePercent: 2.9074589997001965 },
  drawdownSegment: { fromIndex: 0, toIndex: 5, changePercent: -5.668460808225229 },
  changePercent7d: -4.764935580260444,
  bitcoinChangePercent7d: 0.2886,
  marketCapUsd: 14_589_808_762,
};

function fakeTimestampedWords(): Array<{ text: string; startMs: number; endMs: number }> {
  return narrationScenes.flatMap((scene) => scene.text.trim().split(/\s+/u))
    .filter((text) => /[\p{L}\p{N}]/u.test(text))
    .map((text, index) => ({
      text,
      startMs: 120 + index * 260,
      endMs: 330 + index * 260,
    }));
}

function buildScenePlan() {
  const subtitleWords = fakeTimestampedWords();
  return {
    subtitleWords,
    scenes: buildCryptoDocumentaryScenePlan({
      narrationScenes,
      subtitleWords,
      durationMs: 40_667,
    }),
  };
}

function assTime(milliseconds: number): string {
  const centiseconds = Math.round(milliseconds / 10);
  const hours = Math.floor(centiseconds / 360_000);
  const minutes = Math.floor(centiseconds / 6_000) % 60;
  const seconds = Math.floor(centiseconds / 100) % 60;
  const remainder = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(remainder).padStart(2, "0")}`;
}

test("the documentary director maps exact source narration to eight distinct semantic scenes", () => {
  const { subtitleWords, scenes } = buildScenePlan();
  assert.equal(scenes.length, 8);
  assert.deepEqual(scenes.map((scene) => scene.visualType), [
    "PRICE_CHART",
    "MARKET_MOVEMENT",
    "HISTORY_DOCUMENTARY",
    "FULLSCREEN_IMPACT",
    "FULLSCREEN_STAT",
    "COIN_COMPARISON",
    "NEWS_EDITORIAL",
    "COMMUNITY",
  ]);
  assert.equal(new Set(scenes.map((scene) => scene.layout)).size, 8);
  assert.equal(scenes[0]!.voiceText, narrationScenes[0]!.text);
  assert.equal(scenes[1]!.voiceText, "В том же ряду есть нисходящий участок.");
  assert.equal(scenes[2]!.voiceText, "Он описывает прошлое снижение,");
  assert.equal(scenes[3]!.voiceText, "а не сигнал для сделки.");
  assert.equal(scenes[4]!.voiceText, narrationScenes[2]!.text);
  assert.equal(scenes[7]!.voiceText, narrationScenes[5]!.text);
  assert.equal(scenes[0]!.startMs, 0);
  assert.equal(scenes.at(-1)!.endMs, 40_667);
  assert.equal(scenes.reduce((sum, scene) => sum + scene.endMs - scene.startMs, 0), 40_667);
  assert.equal(subtitleWords.length, 94);
  assert.ok(scenes.every((scene) => scene.visualDominancePercent >= 70 && scene.visualDominancePercent <= 95));
  assert.ok(scenes.every((scene) => scene.subtitleMode === "small_word_synced_lower_safe_zone"));
});

test("each scene produces a different full-frame composition and factual visual layers", () => {
  const { scenes } = buildScenePlan();
  const artwork = scenes.map((scene) => buildCryptoDocumentaryArtwork(scene, market));
  const overlayCounts = artwork.map((scene) => scene.overlays.length);
  assert.deepEqual(overlayCounts, [6, 5, 7, 1, 1, 1, 2, 4]);
  assert.equal(new Set(artwork.map((scene) => scene.backgroundSvg)).size, 8);
  const allSvg = artwork.map((scene) =>
    [scene.backgroundSvg, ...scene.overlays.map((overlay) => overlay.svg)].join("\n"),
  ).join("\n");
  assert.doesNotMatch(allSvg, /NaN|undefined/u);
  assert.doesNotMatch(
    allSvg,
    /(?:x|y|x1|x2|y1|y2|cx|cy|width|height)="\d{1,3},\d{3}"/u,
  );
  assert.doesNotMatch(artwork[2]!.backgroundSvg, /genesis|2013|origin/iu);
  assert.match(artwork[2]!.backgroundSvg, /MARKET ARCHIVE/u);
  assert.match(artwork[2]!.backgroundSvg, /COINGECKO/u);
  assert.doesNotMatch(artwork[2]!.backgroundSvg, /CoinGecko • measured historical samples/u);
  assert.doesNotMatch(artwork[0]!.backgroundSvg, />S\d+</u);
  assert.doesNotMatch(artwork[1]!.backgroundSvg, /PAST MARKET DATA/u);
  assert.match(artwork[4]!.backgroundSvg, /\$14\.59B/u);
  assert.equal(artwork[4]!.overlays[0]!.name, "market-cap-accent-line");
  assert.match(artwork[5]!.backgroundSvg, />BTC</u);
  assert.match(artwork[5]!.backgroundSvg, />B</u);
  assert.doesNotMatch(artwork[5]!.backgroundSvg, /₿/u);
  assert.match(artwork[5]!.backgroundSvg, /x="960" y="620"[^>]*>SOURCED SEVEN-DAY RETURNS/u);
  assert.doesNotMatch(artwork[5]!.backgroundSvg, /y="980"/u);
  assert.match(artwork[6]!.backgroundSvg, /NO REAL ARTICLE OR QUOTE/u);
  assert.doesNotMatch(artwork[6]!.backgroundSvg, /ABSTRACT MEDIA LAYERS/u);
  assert.doesNotMatch(artwork[6]!.backgroundSvg, /BREAKING|EXCLUSIVE|@[\w]+/iu);
  assert.doesNotMatch(artwork[7]!.backgroundSvg, /followers|posts|quote|@\w+/iu);
});

test("sourced market values retain their distinct meanings", () => {
  assert.deepEqual(formatCryptoDocumentaryMarketSummary(market), {
    dogeSevenDayPercent: "−4.76%",
    bitcoinSevenDayPercent: "+0.29%",
    marketCap: "$14.59B",
    drawdownPeakToTroughPercent: "−5.67%",
    riseSegmentPercent: "+2.91%",
  });
});

test("small lower-safe-zone subtitles keep every exact word start timestamp", () => {
  const words = fakeTimestampedWords();
  const subtitle = buildSmallWordSubtitleAss(words, 40_667);
  const dialogues = subtitle.ass.split(/\r?\n/u).filter((line) => line.startsWith("Dialogue:"));
  assert.equal(subtitle.wordCount, words.length);
  assert.equal(dialogues.length, words.length);
  assert.equal(subtitle.fontSize, 42);
  assert.equal(subtitle.lowerSafeZoneY, 966);
  assert.ok(subtitle.maxWordsPerPhrase <= 5);
  words.forEach((word, index) => {
    assert.ok(dialogues[index]!.startsWith(`Dialogue: 1,${assTime(word.startMs)},`));
  });
  assert.doesNotMatch(subtitle.ass, /\\fs(?:7\d|[89]\d|1\d\d)/u);
});
