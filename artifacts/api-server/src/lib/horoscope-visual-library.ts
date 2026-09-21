import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db, horoscopeVisualLibraryTable, type HoroscopeVisualLibraryAsset } from "@workspace/db";
import { logger } from "./logger";
import { saveMediaAsset, sha256, supabaseConfigured, type SupabaseMediaAsset } from "./supabase";

const WORKSPACE_ROOT = existsSync(join(process.cwd(), "attached_assets"))
  ? process.cwd()
  : join(process.cwd(), "..", "..");
const USER_HOROSCOPE_ASSET_PROVIDER = "user-upload";
const USER_HOROSCOPE_ASSET_SET = "user-horoscope-assets";
const USER_HOROSCOPE_ASSETS = [
  "IMG_7865_1789979603670.jpeg",
  "IMG_7866_1789979603670.jpeg",
  "IMG_7867_1789979603670.jpeg",
  "IMG_7868_1789979603670.jpeg",
  "IMG_7869_1789979603670.jpeg",
  "IMG_7870_1789979603670.jpeg",
  "IMG_7871_1789979603670.jpeg",
  "IMG_7872_1789979603670.jpeg",
  "IMG_7873_1789979603670.jpeg",
  "IMG_7874_1789979603670.jpeg",
  "IMG_7875_1789979520319.jpeg",
  "IMG_7876_1789979520319.jpeg",
  "IMG_7877_1789979520319.jpeg",
  "IMG_7878_1789979520319.jpeg",
  "IMG_7879_1789979520319.jpeg",
  "IMG_7880_1789979520319.jpeg",
  "IMG_7881_1789979520319.jpeg",
  "IMG_7882_1789979520319.jpeg",
  "IMG_7883_1789979520319.jpeg",
  "IMG_7884_1789979520319.jpeg",
  "IMG_7885_1789979520318.jpeg",
  "IMG_7886_1789979520318.jpeg",
  "IMG_7887_1789979520318.jpeg",
  "IMG_7888_1789979520318.jpeg",
  "IMG_7889_1789979520318.jpeg",
  "84e9498b57a61fed7c22fa422d6a7ad5_720w_1789979520318.mp4",
  "copy_FA563F5B-E84E-45A5-ACA5-FFD40744CED5_1789979603670.mov",
] as const;

export const ZODIAC_SIGNS = [
  { key: "aries", name: "Овен", symbol: "♈", match: /овн|aries/iu, queries: ["Aries constellation", "Овен знак зодиака созвездие"] },
  { key: "taurus", name: "Телец", symbol: "♉", match: /телец|тельц|taurus/iu, queries: ["Taurus constellation", "Телец знак зодиака созвездие"] },
  { key: "gemini", name: "Близнецы", symbol: "♊", match: /близнец|gemini/iu, queries: ["Gemini constellation", "Близнецы знак зодиака созвездие"] },
  { key: "cancer", name: "Рак", symbol: "♋", match: /рак|cancer/iu, queries: ["Cancer constellation", "Рак знак зодиака созвездие"] },
  { key: "leo", name: "Лев", symbol: "♌", match: /льв|лев|leo/iu, queries: ["Leo constellation", "Лев знак зодиака созвездие"] },
  { key: "virgo", name: "Дева", symbol: "♍", match: /дев|virgo/iu, queries: ["Virgo constellation", "Дева знак зодиака созвездие"] },
  { key: "libra", name: "Весы", symbol: "♎", match: /вес|libra/iu, queries: ["Libra constellation", "Весы знак зодиака созвездие"] },
  { key: "scorpio", name: "Скорпион", symbol: "♏", match: /скорпион|скорпи|scorpio/iu, queries: ["Scorpius constellation", "Скорпион знак зодиака созвездие"] },
  { key: "sagittarius", name: "Стрелец", symbol: "♐", match: /стрелец|стрельц|sagittarius/iu, queries: ["Sagittarius constellation", "Стрелец знак зодиака созвездие"] },
  { key: "capricorn", name: "Козерог", symbol: "♑", match: /козерог|козерож|capricorn/iu, queries: ["Capricornus constellation", "Козерог знак зодиака созвездие"] },
  { key: "aquarius", name: "Водолей", symbol: "♒", match: /водолей|водоле|aquarius/iu, queries: ["Aquarius constellation", "Aquarius star map public domain", "Водолей знак зодиака созвездие", "stars night sky"] },
  { key: "pisces", name: "Рыбы", symbol: "♓", match: /рыб|pisces/iu, queries: ["Pisces constellation", "Рыбы знак зодиака созвездие"] },
] as const;

export type HoroscopeSceneVisual = {
  kind: "image" | "video";
  storageAsset: SupabaseMediaAsset;
  provider: string;
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

async function seedUserVisuals(existing: HoroscopeVisualLibraryAsset[]): Promise<{
  added: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let added = 0;
  for (const filename of USER_HOROSCOPE_ASSETS) {
    const sourcePath = join(WORKSPACE_ROOT, "attached_assets", filename);
    const kind = filename.endsWith(".mp4") || filename.endsWith(".mov") ? "video" : "image";
    const contentType = kind === "video"
      ? filename.endsWith(".mov") ? "video/quicktime" : "video/mp4"
      : "image/jpeg";
    try {
      const buffer = await readFile(sourcePath);
      const fingerprint = sha256(buffer);
      const stored = await saveMediaAsset({
        kind,
        buffer,
        contentType,
        fingerprint,
        metadata: {
          provider: USER_HOROSCOPE_ASSET_PROVIDER,
          assetSet: USER_HOROSCOPE_ASSET_SET,
          sourceFilename: filename,
        },
      });
      const sourceId = filename;
      const [current] = await db.select().from(horoscopeVisualLibraryTable).where(and(
        eq(horoscopeVisualLibraryTable.provider, USER_HOROSCOPE_ASSET_PROVIDER),
        eq(horoscopeVisualLibraryTable.sourceId, sourceId),
      ));
      if (current) {
        if (
          current.isActive
          && current.kind === kind
          && (current.storageAsset as Record<string, unknown>)?.fingerprint === fingerprint
        ) continue;
        await db.update(horoscopeVisualLibraryTable).set({
          kind,
          mediaAssetId: stored.asset.id || null,
          storageAsset: stored.asset,
          title: filename,
          isActive: true,
        }).where(eq(horoscopeVisualLibraryTable.id, current.id));
        continue;
      }
      await db.insert(horoscopeVisualLibraryTable).values({
        zodiacSign: null,
        symbol: null,
        label: null,
        kind,
        query: USER_HOROSCOPE_ASSET_SET,
        mediaAssetId: stored.asset.id || null,
        storageAsset: stored.asset,
        provider: USER_HOROSCOPE_ASSET_PROVIDER,
        sourceId,
        title: filename,
        sourceUrl: `user-upload://${filename}`,
        downloadUrl: `user-upload://${filename}`,
        creator: "User-provided",
        creatorUrl: null,
        license: "user-provided",
        licenseUrl: null,
        attribution: "User-provided horoscope visual",
        width: null,
        height: null,
        durationSeconds: null,
        isActive: true,
      });
      added += 1;
    } catch (error) {
      errors.push(`${filename}: ${error instanceof Error ? error.message : "asset unavailable"}`);
      logger.error({ err: error, filename, sourcePath }, "User horoscope visual failed");
    }
  }
  return { added, errors };
}

export async function seedHoroscopeVisualLibrary(): Promise<{
  zodiacAdded: number;
  cosmicAdded: number;
  errors: string[];
}> {
  if (!supabaseConfigured) throw new Error("Supabase is required for the horoscope visual library");
  const existing = await db.select().from(horoscopeVisualLibraryTable);
  for (const row of existing) {
    if (row.provider !== USER_HOROSCOPE_ASSET_PROVIDER && row.isActive) {
      await db.update(horoscopeVisualLibraryTable)
        .set({ isActive: false })
        .where(eq(horoscopeVisualLibraryTable.id, row.id));
    }
  }
  const userAssets = await seedUserVisuals(existing);
  return {
    zodiacAdded: 0,
    cosmicAdded: userAssets.added,
    errors: userAssets.errors,
  };
}

function rotateRows<T>(rows: T[], rotationKey: string, kind: string): T[] {
  if (!rows.length) return [];
  const hash = createHash("sha256").update(`${rotationKey}:${kind}`).digest("hex");
  const rotation = Number.parseInt(hash.slice(0, 8), 16) % rows.length;
  return rows.slice(rotation).concat(rows.slice(0, rotation));
}

export async function getHoroscopeSceneVisuals(
  topic: string,
  sceneCount: number,
  options: { rotationKey?: string } = {},
): Promise<HoroscopeSceneVisual[]> {
  const rows = await db.select().from(horoscopeVisualLibraryTable).where(and(
    eq(horoscopeVisualLibraryTable.isActive, true),
    eq(horoscopeVisualLibraryTable.provider, USER_HOROSCOPE_ASSET_PROVIDER),
  ));
  const mentionedSigns = ZODIAC_SIGNS.filter((candidate) => candidate.match.test(topic));
  const signRows = mentionedSigns
    .map((sign) => rows.find((row) => row.kind === "image" && row.zodiacSign === sign.key))
    .filter((row): row is HoroscopeVisualLibraryAsset => Boolean(row));
  const cosmicImages = rotateRows(
    rows.filter((row) => !row.zodiacSign && row.kind === "image").sort((a, b) => a.id - b.id),
    options.rotationKey || topic,
    "image",
  );
  const cosmicVideos = rotateRows(
    rows.filter((row) => !row.zodiacSign && row.kind === "video").sort((a, b) => a.id - b.id),
    options.rotationKey || topic,
    "video",
  );
  const selected: HoroscopeVisualLibraryAsset[] = [];
  for (let index = 0; index < sceneCount; index += 1) {
    const slot = index % 3;
    const cycle = Math.floor(index / 3);
    const candidate = slot === 0 && signRows.length
      ? signRows[cycle % signRows.length]
      : slot === 0
        ? cosmicImages[cycle % Math.max(1, cosmicImages.length)]
      : slot === 1
        ? cosmicImages[cycle % Math.max(1, cosmicImages.length)]
        : slot === 2
          ? cosmicVideos[cycle % Math.max(1, cosmicVideos.length)]
          : signRows[cycle % Math.max(1, signRows.length)];
    if (candidate) selected.push(candidate);
  }
  return selected.flatMap((row) => {
    const storageAsset = asStorageAsset(row);
    return storageAsset ? [{
      kind: row.kind as "image" | "video",
      storageAsset,
      provider: row.provider,
      zodiacSign: row.zodiacSign,
      label: row.label,
    }] : [];
  });
}
