import assert from "node:assert/strict";
import test from "node:test";
import {
  cryptoF2WarningBoundaryIsSafe,
  findCryptoF2ProtectedWarnings,
} from "./crypto-f2-warning";

test("returns the exact negated guarantee phrase and its word range", () => {
  const narration = "Главное — понимать: это не гарантированный заработок и ты принимаешь валютный риск.";
  const warnings = findCryptoF2ProtectedWarnings(narration);

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]?.excerpt, "не гарантированный заработок");
  assert.equal(warnings[0]?.label, "не гарантированный заработок");
  const narrationWords = narration.match(/[\p{L}\p{N}]+/gu) ?? [];
  assert.equal(
    narrationWords.slice(warnings[0]!.startWord, warnings[0]!.endWord).join(" "),
    "не гарантированный заработок",
  );
  assert.equal(cryptoF2WarningBoundaryIsSafe(warnings, warnings[0]!.startWord + 1), false);
  assert.equal(cryptoF2WarningBoundaryIsSafe(warnings, warnings[0]!.endWord), true);
});

test("recognizes other negated guarantee wording without changing its words", () => {
  const warnings = findCryptoF2ProtectedWarnings(
    "Доход не гарантирован, а актив не обещает будущую прибыль.",
  );

  assert.deepEqual(warnings.map((warning) => warning.excerpt), [
    "Доход не гарантирован",
    "не обещает будущую прибыль",
  ]);
});