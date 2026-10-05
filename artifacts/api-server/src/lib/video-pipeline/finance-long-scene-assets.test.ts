import assert from "node:assert/strict";
import { test } from "node:test";
import type { StockMediaCandidate } from "../stock-media";
import {
  buildFinanceLongSceneSearchQueries,
  isAttributionFreeFinancePhoto,
  resolveFinanceLongScenePhoto,
} from "./finance-long-scene-assets";

function candidate(overrides: Partial<StockMediaCandidate> = {}): StockMediaCandidate {
  return {
    provider: "openverse",
    id: "asset-1",
    kind: "image",
    title: "Abstract financial network",
    sourceUrl: "https://example.test/source",
    downloadUrl: "https://example.test/image.jpg",
    creator: null,
    creatorUrl: null,
    license: "CC0 1.0",
    licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    attribution: null,
    width: 1920,
    height: 1080,
    durationSeconds: null,
    contentType: "image/jpeg",
    ...overrides,
  };
}

test("Finance Long accepts only stock sources that do not require attribution", () => {
  assert.equal(isAttributionFreeFinancePhoto(candidate({ provider: "pexels", license: "Pexels License" })), true);
  assert.equal(isAttributionFreeFinancePhoto(candidate({ license: "CC0 1.0" })), true);
  assert.equal(isAttributionFreeFinancePhoto(candidate({ license: "Public Domain Mark 1.0" })), true);
  assert.equal(isAttributionFreeFinancePhoto(candidate({ license: "CC BY 4.0" })), false);
  assert.equal(isAttributionFreeFinancePhoto(candidate({ license: "CC BY-NC 4.0" })), false);
});

test("Finance Long stock search uses a short visual query and a generic fallback", () => {
  const queries = buildFinanceLongSceneSearchQueries(
    "Abstract blockchain network with moving nodes, logo-free, no text, price 123.45",
  );
  assert.equal(queries.length, 2);
  assert.match(queries[0]!, /blockchain network/i);
  assert.doesNotMatch(queries[0]!, /logo|text|123|price/i);
  assert.equal(queries[1], "cryptocurrency blockchain technology");
});

test("Finance Long skips attribution-required assets and verifies downloaded image bytes", async () => {
  const attributionRequired = candidate({ id: "by-image", license: "CC BY 4.0" });
  const publicDomain = candidate({ id: "cc0-image" });
  const downloadedCandidates: string[] = [];
  const resolved = await resolveFinanceLongScenePhoto("blockchain market", {
    searchCandidates: async () => [attributionRequired, publicDomain],
    downloadCandidate: async (item) => {
      downloadedCandidates.push(item.id);
      return { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), contentType: "image/jpeg" };
    },
  });

  assert.deepEqual(downloadedCandidates, ["cc0-image"]);
  assert.equal(resolved.candidate.id, "cc0-image");
  assert.equal(resolved.contentType, "image/jpeg");
});

test("Finance Long rejects a stock download that is not a supported image", async () => {
  await assert.rejects(
    resolveFinanceLongScenePhoto("blockchain market", {
      searchCandidates: async () => [candidate()],
      downloadCandidate: async () => ({ buffer: Buffer.from("not an image"), contentType: "image/jpeg" }),
    }),
    /could not find a verified, attribution-free scene image/,
  );
});
