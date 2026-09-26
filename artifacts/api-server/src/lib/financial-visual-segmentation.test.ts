import assert from "node:assert/strict";
import test from "node:test";
import {
  ESTIMATED_SPEECH_WORDS_PER_SECOND,
  semanticVoiceExcerpts,
  wordsIn,
} from "./financial-visual-segmentation";

test("merges one- and two-word clauses into renderable visual moments", () => {
  const narration = "Проверьте, сеть, затем выберите актив.";
  const excerpts = semanticVoiceExcerpts(narration);

  assert.equal(excerpts.length, 1);
  assert.deepEqual(wordsIn(excerpts.join(" ")), wordsIn(narration));
  assert.ok(wordsIn(excerpts[0]!).length / ESTIMATED_SPEECH_WORDS_PER_SECOND >= 1);
});

test("rebalances short clause fragments without losing spoken words", () => {
  const narration = "Сначала откройте кошелёк, проверьте сеть, затем переведите актив.";
  const excerpts = semanticVoiceExcerpts(narration);
  const durations = excerpts.map((excerpt) =>
    wordsIn(excerpt).length / ESTIMATED_SPEECH_WORDS_PER_SECOND);

  assert.equal(excerpts.length, 2);
  assert.deepEqual(wordsIn(excerpts.join(" ")), wordsIn(narration));
  assert.ok(durations.every((duration) => duration >= 1 && duration <= 3));
});

test("splits overlong semantic clauses into moments of at most three seconds", () => {
  const narration = "Один два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать.";
  const excerpts = semanticVoiceExcerpts(narration);
  const durations = excerpts.map((excerpt) =>
    wordsIn(excerpt).length / ESTIMATED_SPEECH_WORDS_PER_SECOND);

  assert.equal(excerpts.length, 2);
  assert.deepEqual(wordsIn(excerpts.join(" ")), wordsIn(narration));
  assert.ok(durations.every((duration) => duration >= 1 && duration <= 3));
});

test("keeps already well-sized semantic clauses intact", () => {
  const narration = "Компания выпускает облигации, инвестор покупает их.";

  assert.deepEqual(semanticVoiceExcerpts(narration), [
    "Компания выпускает облигации,",
    "инвестор покупает их.",
  ]);
});