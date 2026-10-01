import assert from "node:assert/strict";
import test from "node:test";
import { extractFinanceLongCoinHeader, splitFinanceLongAuthorScript } from "./finance-long-script";

test("extractFinanceLongCoinHeader removes a leading coin metadata line from narration", () => {
  const narration = "Сегодня разберём, как устроен проект HYPE.\nОн работает в своей экосистеме.";
  assert.deepEqual(
    extractFinanceLongCoinHeader(`Монета: $HYPE\n\n${narration}`),
    { coinQuery: "HYPE", narration },
  );
});

test("extractFinanceLongCoinHeader accepts a header after a short title", () => {
  assert.deepEqual(
    extractFinanceLongCoinHeader("Большой разбор\nАктив — Bitcoin\n\nНачнём с истории проекта."),
    { coinQuery: "Bitcoin", narration: "Большой разбор\n\nНачнём с истории проекта." },
  );
});

test("extractFinanceLongCoinHeader does not guess from ordinary narration", () => {
  assert.equal(
    extractFinanceLongCoinHeader("Сегодня поговорим о Bitcoin и сравним его с другими активами."),
    null,
  );
});

test("splitFinanceLongAuthorScript preserves every spoken word", () => {
  const source = "Первый абзац рассказывает о проекте. Второй объясняет технологию и её ограничения.";
  const parts = splitFinanceLongAuthorScript(source, 2);
  assert.equal(parts.join(" "), source);
});