import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fallbackYoutubeMetadata,
  sanitizeSpecializedYoutubeMetadata,
} from "./youtube-metadata-fallback";

test("crypto fallback keeps SEO relevant to the coin and avoids story tags", () => {
  const metadata = fallbackYoutubeMetadata({
    title: "BTC: что изменилось на рынке",
    topic: "BTC",
    description: "Краткий обзор биткоина и ключевых факторов рынка.",
    scriptText: "Разбираем данные по BTC и риски криптовалютного рынка.",
    contentType: "crypto",
  });

  assert.ok(metadata.title.length <= 60);
  assert.ok(metadata.tags.includes("криптовалюта"));
  assert.ok(metadata.tags.includes("BTC"));
  assert.ok(!metadata.tags.includes("история из жизни"));
  assert.ok(metadata.hashtags.includes("#криптовалюта"));
  assert.match(metadata.description, /инвестиционной рекомендацией/iu);
});

test("finance fallback provides educational SEO without unrelated story keywords", () => {
  const metadata = fallbackYoutubeMetadata({
    title: "Облигации: как это работает",
    topic: "Облигации",
    description: "Простое объяснение купонов, срока и риска эмитента.",
    scriptText: "В ролике объясняем, как работают облигации.",
    contentType: "finance",
  });

  assert.ok(metadata.title.length <= 60);
  assert.ok(metadata.tags.includes("финансы"));
  assert.ok(metadata.tags.includes("финансовое образование"));
  assert.ok(!metadata.tags.includes("история из жизни"));
  assert.ok(metadata.hashtags.includes("#финансы"));
  assert.match(metadata.description, /индивидуальной инвестиционной рекомендацией/iu);
});

test("specialized generated metadata removes story language and enforces the finance disclosure", () => {
  const input = {
    title: "Облигации: доходность и риски",
    topic: "Облигации",
    description: "Объясняем купоны, срок и риск эмитента.",
    scriptText: "В ролике объясняем, как работают облигации.",
    contentType: "finance" as const,
  };
  const fallback = fallbackYoutubeMetadata(input);
  const metadata = sanitizeSpecializedYoutubeMetadata({
    title: "История курьера, который купил облигации",
    description: "История из жизни курьера и его первые инвестиции. #shorts #история #курьер",
    tags: ["shorts", "истории курьера", "облигации"],
    hashtags: ["#shorts", "#история", "#курьер"],
  }, fallback, input.contentType);

  assert.equal(metadata.title, fallback.title);
  assert.ok(!metadata.description.includes("курьера"));
  assert.ok(metadata.tags.includes("облигации"));
  assert.ok(!metadata.tags.includes("истории курьера"));
  assert.ok(metadata.hashtags.includes("#финансы"));
  assert.match(metadata.description, /индивидуальной инвестиционной рекомендацией/iu);
});