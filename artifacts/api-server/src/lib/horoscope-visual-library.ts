import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { and, eq } from "drizzle-orm";
import { db, horoscopeVisualLibraryTable, type HoroscopeVisualLibraryAsset } from "@workspace/db";
import { logger } from "./logger";
import {
  collectHoroscopeStockMedia,
  downloadStockCandidate,
  searchStockCandidates,
  storeStockCandidate,
  type StockMediaCandidate,
  type StoredStockMedia,
} from "./stock-media";
import type { SupabaseMediaAsset } from "./supabase";
import { supabaseConfigured } from "./supabase";

const execFileAsync = promisify(execFile);
const ZODIAC_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

export const ZODIAC_SIGNS = [
  { key: "aries", name: "Овен", symbol: "♈", queries: ["Aries constellation", "Овен знак зодиака созвездие"] },
  { key: "taurus", name: "Телец", symbol: "♉", queries: ["Taurus constellation", "Телец знак зодиака созвездие"] },
  { key: "gemini", name: "Близнецы", symbol: "♊", queries: ["Gemini constellation", "Близнецы знак зодиака созвездие"] },
  { key: "cancer", name: "Рак", symbol: "♋", queries: ["Cancer constellation", "Рак знак зодиака созвездие"] },
  { key: "leo", name: "Лев", symbol: "♌", queries: ["Leo constellation", "Лев знак зодиака созвездие"] },
  { key: "virgo", name: "Дева", symbol: "♍", queries: ["Virgo constellation", "Дева знак зодиака созвездие"] },
  { key: "libra", name: "Весы", symbol: "♎", queries: ["Libra constellation", "Весы знак зодиака созвездие"] },
  { key: "scorpio", name: "Скорпион", symbol: "♏", queries: ["Scorpius constellation", "Скорпион знак зодиака созвездие"] },
  { key: "sagittarius", name: "Стрелец", symbol: "♐", queries: ["Sagittarius constellation", "Стрелец знак зодиака созвездие"] },
  { key: "capricorn", name: "Козерог", symbol: "♑", queries: ["Capricornus constellation", "Козерог знак зодиака созвездие"] },
  { key: "aquarius", name: "Водолей", symbol: "♒", queries: ["Aquarius constellation", "Aquarius star map public domain", "Водолей знак зодиака созвездие", "stars night sky"] },
  { key: "pisces", name: "Рыбы", symbol: "♓", queries: ["Pisces constellation", "Рыбы знак зодиака созвездие"] },
] as const;

export type HoroscopeSceneVisual = {
  kind: "image" | "video";
  storageAsset: SupabaseMediaAsset;
  zodiacSign: string | null;
  label: string | null;
};

function asStorageAsset(row: HoroscopeVisualLibraryAsset): SupabaseMediaAsset | null {
  if (!row.storageAsset || typeof row.storageAsset !== "object") return null;
  const asset = row.storageAsset as Partial<SupabaseMediaAsset>;
  if (!asset.bucket || !asset.object_path || !asset.content_type || !asset.fingerprint) return null;
  return {
    id: row.mediaAssetId || asset.id,
    fingerprint: asset.fingerprint,
    kind: row.kind as SupabaseMediaAsset["kind"],
    bucket: asset.bucket,
    object_path: asset.object_path,
    content_type: asset.content_type,
    size_bytes: Number(asset.size_bytes || 0),
    metadata: asset.metadata,
  };
}

async function labelZodiacImage(
  buffer: Buffer,
  sign: typeof ZODIAC_SIGNS[number],
): Promise<Buffer> {
  const tempDir = await mkdtemp(join("/tmp", "zodiac-visual-"));
  const inputPath = join(tempDir, "source");
  const labelPath = join(tempDir, "label.txt");
  const outputPath = join(tempDir, "labeled.png");
  try {
    await writeFile(inputPath, buffer);
    await writeFile(labelPath, `${sign.symbol}  ${sign.name}`, "utf8");
    await execFileAsync("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-i", inputPath,
      "-vf",
      [
        "scale=1080:1920:force_original_aspect_ratio=increase",
        "crop=1080:1920",
        "drawbox=x=0:y=1630:w=iw:h=290:color=black@0.52:t=fill",
        `drawtext=fontfile=${ZODIAC_FONT}:textfile=${labelPath}:fontcolor=white:fontsize=76:x=(w-text_w)/2:y=1740:borderw=3:bordercolor=black`,
      ].join(","),
      "-frames:v", "1",
      "-f", "image2",
      outputPath,
    ], { maxBuffer: 2 * 1024 * 1024 });
    return readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function insertLibraryAsset(
  candidate: StockMediaCandidate,
  stored: StoredStockMedia,
  query: string,
  details: { zodiacSign?: string; symbol?: string; label?: string } = {},
): Promise<HoroscopeVisualLibraryAsset> {
  const [row] = await db.insert(horoscopeVisualLibraryTable).values({
    zodiacSign: details.zodiacSign || null,
    symbol: details.symbol || null,
    label: details.label || null,
    kind: candidate.kind,
    query,
    mediaAssetId: stored.storageAsset.id || null,
    storageAsset: stored.storageAsset,
    provider: candidate.provider,
    sourceId: candidate.id,
    title: candidate.title,
    sourceUrl: candidate.sourceUrl,
    downloadUrl: candidate.downloadUrl,
    creator: candidate.creator,
    creatorUrl: candidate.creatorUrl,
    license: candidate.license,
    licenseUrl: candidate.licenseUrl,
    attribution: candidate.attribution,
    width: candidate.width,
    height: candidate.height,
    durationSeconds: candidate.durationSeconds === null ? null : Math.round(candidate.durationSeconds),
  }).onConflictDoNothing().returning();
  if (row) return row;
  const [existing] = await db.select().from(horoscopeVisualLibraryTable).where(and(
    eq(horoscopeVisualLibraryTable.kind, candidate.kind),
    eq(horoscopeVisualLibraryTable.provider, candidate.provider),
    eq(horoscopeVisualLibraryTable.sourceId, candidate.id),
  ));
  if (!existing) throw new Error(`Could not persist ${candidate.provider}:${candidate.id} in visual library`);
  return existing;
}

async function seedZodiacVisuals(existing: HoroscopeVisualLibraryAsset[]): Promise<{
  added: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let added = 0;
  for (const sign of ZODIAC_SIGNS) {
    if (existing.some((row) => row.zodiacSign === sign.key && row.kind === "image" && row.isActive)) continue;
    let saved = false;
    for (const query of sign.queries) {
      const candidates = await searchStockCandidates(query, "image");
      for (const candidate of candidates) {
        try {
          const downloaded = await downloadStockCandidate(candidate);
          const labeled = await labelZodiacImage(downloaded.buffer, sign);
          const stored = await storeStockCandidate(candidate, labeled, "image/png", {
            zodiacSign: sign.key,
            zodiacLabel: `${sign.symbol} ${sign.name}`,
            originalContentType: downloaded.contentType,
          });
          await insertLibraryAsset(candidate, stored, query, {
            zodiacSign: sign.key,
            symbol: sign.symbol,
            label: sign.name,
          });
          added += 1;
          saved = true;
          break;
        } catch (error) {
          logger.warn({ err: error, sign: sign.key, query, provider: candidate.provider }, "Zodiac stock image failed");
        }
      }
      if (saved) break;
    }
    if (!saved) errors.push(`${sign.name}: no licensed stock image found`);
  }
  return { added, errors };
}

async function seedCosmicVisuals(existing: HoroscopeVisualLibraryAsset[]): Promise<{
  added: number;
  errors: string[];
}> {
  const existingKeys = new Set(existing.map((row) => `${row.kind}:${row.provider}:${row.sourceId}`));
  const existingImageCount = existing.filter((row) => !row.zodiacSign && row.kind === "image" && row.isActive).length;
  const existingVideoCount = existing.filter((row) => !row.zodiacSign && row.kind === "video" && row.isActive).length;
  if (existingImageCount >= 10 && existingVideoCount >= 4) return { added: 0, errors: [] };
  const result = await collectHoroscopeStockMedia(
    ["stars night sky", "nebula space", "milky way", "moon night sky", "zodiac constellation"],
    { imageCount: Math.max(0, 10 - existingImageCount), videoCount: Math.max(0, 4 - existingVideoCount) },
  );
  let added = 0;
  for (const asset of result.assets) {
    const key = `${asset.kind}:${asset.provider}:${asset.id}`;
    if (existingKeys.has(key)) continue;
    await insertLibraryAsset(asset, asset, "cosmic space stock", {});
    added += 1;
  }
  return { added, errors: result.errors };
}

export async function seedHoroscopeVisualLibrary(): Promise<{
  zodiacAdded: number;
  cosmicAdded: number;
  errors: string[];
}> {
  if (!supabaseConfigured) throw new Error("Supabase is required for the horoscope visual library");
  const existing = await db.select().from(horoscopeVisualLibraryTable);
  const zodiac = await seedZodiacVisuals(existing);
  const afterZodiac = await db.select().from(horoscopeVisualLibraryTable);
  const cosmic = await seedCosmicVisuals(afterZodiac);
  return {
    zodiacAdded: zodiac.added,
    cosmicAdded: cosmic.added,
    errors: [...zodiac.errors, ...cosmic.errors],
  };
}

export async function getHoroscopeSceneVisuals(topic: string, sceneCount: number): Promise<HoroscopeSceneVisual[]> {
  const rows = await db.select().from(horoscopeVisualLibraryTable).where(eq(horoscopeVisualLibraryTable.isActive, true));
  const sign = ZODIAC_SIGNS.find((candidate) => new RegExp(candidate.name, "iu").test(topic));
  const signRow = sign
    ? rows.find((row) => row.kind === "image" && row.zodiacSign === sign.key)
    : undefined;
  const cosmicRows = rows
    .filter((row) => !row.zodiacSign && (row.kind === "image" || row.kind === "video"))
    .sort((a, b) => a.id - b.id);
  const rotation = cosmicRows.length
    ? Number.parseInt(createHash("sha256").update(topic).digest("hex").slice(0, 8), 16) % cosmicRows.length
    : 0;
  const selected = [
    ...(signRow ? [signRow] : []),
    ...Array.from({ length: Math.max(0, sceneCount - (signRow ? 1 : 0)) }, (_, index) =>
      cosmicRows[(rotation + index) % Math.max(1, cosmicRows.length)]),
  ].filter((row): row is HoroscopeVisualLibraryAsset => Boolean(row));
  return selected.flatMap((row) => {
    const storageAsset = asStorageAsset(row);
    return storageAsset ? [{
      kind: row.kind as "image" | "video",
      storageAsset,
      zodiacSign: row.zodiacSign,
      label: row.label,
    }] : [];
  });
}
