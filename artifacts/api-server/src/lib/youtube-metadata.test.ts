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

test("long-form finance fallback uses Russian long-video SEO without Shorts markers", () => {
  const metadata = fallbackYoutubeMetadata({
    title: "Как работают облигации и от чего зависит их доходность",
    topic: "Облигации и доходность",
    description: "Полный разбор устройства облигаций, купонов и рисков.",
    scriptText: "Объясняем облигации, купоны, доходность и риск эмитента.",
    contentType: "finance",
    videoKind: "long",
  });

  assert.ok(metadata.title.length <= 100);
  assert.ok(!metadata.tags.includes("shorts"));
  assert.ok(!metadata.hashtags.includes("#shorts"));
  assert.ok(metadata.hashtags.includes("#финансы"));
  assert.match(metadata.description, /индивидуальной инвестиционной рекомендацией/iu);
});

test("long-form finance metadata sanitation removes generated Shorts markers", () => {
  const input = {
    title: "Облигации: доходность и риски",
    topic: "Облигации",
    description: "Объясняем купоны, срок и риск эмитента.",
    scriptText: "В длинном видео объясняем, как работают облигации.",
    contentType: "finance" as const,
    videoKind: "long" as const,
  };
  const fallback = fallbackYoutubeMetadata(input);
  const metadata = sanitizeSpecializedYoutubeMetadata({
    title: "Облигации: доходность и риски",
    description: "Полный разбор облигаций. #shorts #финансы #облигации",
    tags: ["shorts", "финансы", "облигации"],
    hashtags: ["#shorts", "#финансы", "#облигации"],
  }, fallback, input.contentType, input.videoKind);

  assert.ok(!metadata.description.includes("#shorts"));
  assert.ok(!metadata.tags.includes("shorts"));
  assert.ok(!metadata.hashtags.includes("#shorts"));
  assert.match(metadata.description, /индивидуальной инвестиционной рекомендацией/iu);
});

test("generic long-form metadata fallback does not use Shorts keywords", () => {
  const metadata = fallbackYoutubeMetadata({
    title: "Как устроены городские системы отопления",
    topic: "Городские системы отопления",
    description: "Объяснение принципа работы централизованного отопления.",
    scriptText: "Разбираем устройство теплосетей и подачу тепла в здания.",
    videoKind: "long",
  });

  assert.ok(metadata.title.length <= 100);
  assert.ok(!metadata.tags.includes("shorts"));
  assert.ok(!metadata.hashtags.includes("#shorts"));
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