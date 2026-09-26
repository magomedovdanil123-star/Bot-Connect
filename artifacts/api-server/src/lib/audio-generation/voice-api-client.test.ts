import assert from "node:assert/strict";
import test from "node:test";
import { LUMEAN_SYNTHESIS_TIMEOUT_MESSAGE } from "./lumean-client";
import { withLumeanTimeoutFallback } from "./voice-api-client";

test("uses the fallback only after the Lumean synthesis timeout", async () => {
  let fallbackCalls = 0;
  const expected = Buffer.from("fallback audio");
  const result = await withLumeanTimeoutFallback(
    async () => {
      throw new Error(LUMEAN_SYNTHESIS_TIMEOUT_MESSAGE);
    },
    async () => {
      fallbackCalls += 1;
      return expected;
    },
  );

  assert.equal(result, expected);
  assert.equal(fallbackCalls, 1);
});

test("does not fall back for other Lumean errors", async () => {
  const primaryError = new Error("Lumean API error (HTTP 402)");
  let fallbackCalls = 0;

  await assert.rejects(
    withLumeanTimeoutFallback(
      async () => {
        throw primaryError;
      },
      async () => {
        fallbackCalls += 1;
        return Buffer.from("should not be used");
      },
    ),
    (error) => error === primaryError,
  );
  assert.equal(fallbackCalls, 0);
});

test("keeps successful Lumean synthesis on the primary provider", async () => {
  const expected = Buffer.from("primary audio");
  let fallbackCalls = 0;
  const result = await withLumeanTimeoutFallback(
    async () => expected,
    async () => {
      fallbackCalls += 1;
      return Buffer.from("should not be used");
    },
  );

  assert.equal(result, expected);
  assert.equal(fallbackCalls, 0);
});