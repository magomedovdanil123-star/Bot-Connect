import assert from "node:assert/strict";
import test from "node:test";
import { splitFinanceLongAuthorScript } from "./finance-long-script";
import { parseFinanceRssFeed } from "./financial-topic-research";

test("parses only recent finance RSS entries and decodes feed text", () => {
  const xml = `<?xml version="1.0"?>
    <rss><channel>
      <item>
        <title>Рынок акций: рост &amp; риск</title>
        <link>https://publisher.example/market</link>
        <pubDate>Sun, 27 Sep 2026 13:00:00 GMT</pubDate>
        <description><![CDATA[<p>Свежий обзор облигаций и ключевой ставки.</p>]]></description>
      </item>
      <item>
        <title>Старая новость о рынке</title>
        <link>https://publisher.example/old</link>
        <pubDate>Wed, 23 Sep 2026 13:00:00 GMT</pubDate>
      </item>
      <item>
        <title>Новая новость о погоде</title>
        <link>https://publisher.example/weather</link>
        <pubDate>Sun, 27 Sep 2026 13:30:00 GMT</pubDate>
      </item>
    </channel></rss>`;

  const parsed = parseFinanceRssFeed(xml, {
    key: "test",
    source: "Тестовый источник",
    now: new Date("2026-09-27T14:00:00.000Z"),
  });

  assert.equal(parsed.length, 1);
  assert.equal(parsed[0]?.title, "Рынок акций: рост & риск");
  assert.equal(parsed[0]?.source, "Тестовый источник");
  assert.equal(parsed[0]?.snippet, "Свежий обзор облигаций и ключевой ставки.");
  assert.equal(parsed[0]?.url, "https://publisher.example/market");
});

test("keeps author wording and punctuation while splitting into scenes", () => {
  const script = "Почему ставка меняется? Вот цифры: 1.5 процента. А теперь — риск и вывод!";
  const scenes = splitFinanceLongAuthorScript(script, 3);

  assert.equal(scenes.length, 3);
  assert.equal(scenes.join(" "), script);
  assert.ok(scenes.every((scene) => scene.length > 0));
});

test("splits long author text without dropping words or creating empty scenes", () => {
  const script = Array.from({ length: 180 }, (_value, index) => `слово${index}`).join(" ");
  const scenes = splitFinanceLongAuthorScript(script, 4);

  assert.equal(scenes.length, 4);
  assert.equal(scenes.join(" "), script);
  assert.ok(scenes.every((scene) => scene.length > 0));
});