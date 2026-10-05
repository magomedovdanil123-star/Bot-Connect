import type { StockMediaCandidate } from "../stock-media";

export type FinanceLongScenePhoto = {
  candidate: StockMediaCandidate;
  buffer: Buffer;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  searchQuery: string;
};

type FinanceLongScenePhotoDependencies = {
  searchCandidates: (query: string) => Promise<StockMediaCandidate[]>;
  downloadCandidate: (candidate: StockMediaCandidate) => Promise<{
    buffer: Buffer;
    contentType: string;
  }>;
};

export function isAttributionFreeFinancePhoto(candidate: Pick<StockMediaCandidate, "provider" | "license">): boolean {
  if (candidate.provider === "pexels") return true;
  const license = candidate.license.toLocaleLowerCase("en-US")
    .replaceAll("_", "-")
    .replace(/\s+/gu, " ")
    .trim();
  return [
    "cc0",
    "cc0 1.0",
    "cc0-1.0",
    "cc-zero",
    "cc-zero-1.0",
    "pdm",
    "public domain",
    "public domain mark",
    "public domain mark 1.0",
    "public-domain",
    "publicdomain",
    "zero",
  ].includes(license);
}

export function buildFinanceLongSceneSearchQueries(sceneDescription: string): string[] {
  const terms = sceneDescription
    .replace(/https?:\/\/\S+/giu, " ")
    .replace(/[$€£¥₿]?\s*\b\d+(?:[.,]\d+)?%?\b/gu, " ")
    .replace(/\b(?:logo|brand|ticker|price|chart|number|percent|text|subtitle|caption)\b/giu, " ")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/u)
    .filter((word) => word.length > 2)
    .slice(0, 8)
    .join(" ")
    .trim();
  const sceneQuery = terms ? `${terms} cryptocurrency` : "";
  return [...new Set([
    sceneQuery,
    "cryptocurrency blockchain technology",
  ].filter(Boolean))];
}

function verifiedImageContentType(buffer: Buffer): FinanceLongScenePhoto["contentType"] | null {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) return "image/webp";
  return null;
}

export async function resolveFinanceLongScenePhoto(
  sceneDescription: string,
  dependencies: FinanceLongScenePhotoDependencies,
): Promise<FinanceLongScenePhoto> {
  let downloadAttempts = 0;
  for (const searchQuery of buildFinanceLongSceneSearchQueries(sceneDescription)) {
    let candidates: StockMediaCandidate[];
    try {
      candidates = await dependencies.searchCandidates(searchQuery);
    } catch {
      continue;
    }
    for (const candidate of candidates) {
      if (!isAttributionFreeFinancePhoto(candidate) || downloadAttempts >= 4) continue;
      downloadAttempts += 1;
      try {
        const downloaded = await dependencies.downloadCandidate(candidate);
        const contentType = verifiedImageContentType(downloaded.buffer);
        if (!contentType) continue;
        return { candidate, buffer: downloaded.buffer, contentType, searchQuery };
      } catch {
        // Try another commercially reusable candidate before failing the image stage.
      }
    }
  }
  throw new Error(
    "PREMIUM_DYNAMIC_FINANCE_V2_FINAL could not find a verified, attribution-free scene image. Add a scene image and retry.",
  );
}
