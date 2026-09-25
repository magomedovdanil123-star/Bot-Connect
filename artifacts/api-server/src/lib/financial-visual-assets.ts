import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { generateStandaloneImage } from "./image-generation/service";
import { logger } from "./logger";
import { downloadStockCandidate, searchStockCandidates } from "./stock-media";
import type {
  FinancialConcept,
  FinancialRasterAsset,
  FinancialShortBeat,
  FinancialVisualMoment,
} from "./financial-short-renderer";

const execFileAsync = promisify(execFile);
const MAX_VISUAL_MEDIA_BYTES = 30 * 1024 * 1024;
const MAX_NORMALIZED_VISUAL_BYTES = 512 * 1024;

type MomentLocation = {
  beatIndex: number;
  moment: FinancialVisualMoment;
};

export type FinancialVisualMediaResolution = {
  beats: FinancialShortBeat[];
  assets: Record<string, FinancialRasterAsset>;
  notice: string;
  credits: string[];
};

const CONCEPT_MEDIA: Record<FinancialConcept, {
  stockQueries: string[];
  illustrationSubject: string;
  stockMomentKinds: FinancialVisualMoment["kind"][];
  illustrationMomentKinds: FinancialVisualMoment["kind"][];
}> = {
  bond_flow: {
    stockQueries: ["finance district office building", "business finance office meeting"],
    illustrationSubject: "a folded blank bond certificate beside one unbranded coin",
    stockMomentKinds: ["document", "money_flow", "concept_card"],
    illustrationMomentKinds: ["timeline", "metric", "sticker", "concept_card"],
  },
  equity_split: {
    stockQueries: ["stock exchange exterior building", "company shareholder meeting"],
    illustrationSubject: "a clean modern office tower with two simple share tiles",
    stockMomentKinds: ["ownership", "market_chart", "concept_card"],
    illustrationMomentKinds: ["ownership", "comparison", "sticker", "concept_card"],
  },
  fund_pool: {
    stockQueries: ["diversified investment assets", "investment planning office"],
    illustrationSubject: "a glass bowl holding several distinct neutral asset tokens",
    stockMomentKinds: ["portfolio", "ownership", "concept_card"],
    illustrationMomentKinds: ["portfolio", "comparison", "sticker", "concept_card"],
  },
  profit_distribution: {
    stockQueries: ["company shareholder meeting", "business owners discussing company results"],
    illustrationSubject: "a simple dividend envelope releasing coins toward separate recipient nodes",
    stockMomentKinds: ["distribution", "money_flow", "concept_card"],
    illustrationMomentKinds: ["distribution", "reinvestment", "sticker", "concept_card"],
  },
  compound_interest: {
    stockQueries: ["savings coins investment", "long term savings concept"],
    illustrationSubject: "three coin stacks that increase in height beside a small growing leaf",
    stockMomentKinds: ["compound_growth", "reinvestment", "concept_card"],
    illustrationMomentKinds: ["compound_growth", "reinvestment", "sticker", "concept_card"],
  },
  futures_contract: {
    stockQueries: ["commodity port containers warehouse", "grain storage commodity market"],
    illustrationSubject: "two opposing abstract contract tabs connected by one simple market route",
    stockMomentKinds: ["payoff", "risk", "concept_card"],
    illustrationMomentKinds: ["payoff", "comparison", "sticker", "concept_card"],
  },
  generic_finance: {
    stockQueries: ["financial planning documents finance", "investment planning desk"],
    illustrationSubject: "a neutral finance concept made from a document, one coin, and a clean upward route",
    stockMomentKinds: ["concept_card", "document", "money_flow"],
    illustrationMomentKinds: ["concept_card", "comparison", "sticker"],
  },
};

const STOCK_LICENSES_WITHOUT_ATTRIBUTION = [
  "cc0",
  "cc-zero",
  "pdm",
  "public domain",
  "publicdomain",
  "zero",
];

function isAttributionFreeStock(candidate: Awaited<ReturnType<typeof searchStockCandidates>>[number]): boolean {
  const license = candidate.license.toLocaleLowerCase();
  return candidate.provider === "pexels"
    || STOCK_LICENSES_WITHOUT_ATTRIBUTION.some((term) => license.includes(term));
}

function findMoment(
  candidates: MomentLocation[],
  preferredKinds: FinancialVisualMoment["kind"][],
  excludedId?: string,
): MomentLocation | undefined {
  return candidates.find(({ moment }) => moment.id !== excludedId && preferredKinds.includes(moment.kind))
    ?? candidates.find(({ moment }) => moment.id !== excludedId);
}

function listMoments(beats: FinancialShortBeat[]): MomentLocation[] {
  return beats.flatMap((beat, beatIndex) => (beat.visualMoments ?? []).map((moment) => ({
    beatIndex,
    moment,
  })));
}

function pngHasAlphaChannel(buffer: Buffer): boolean {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 26 || !buffer.subarray(0, 8).equals(signature)) return false;
  return buffer[25] === 4 || buffer[25] === 6;
}

async function normalizeRaster(
  buffer: Buffer,
  mode: "photo" | "cutout" | "illustration",
): Promise<{ buffer: Buffer; contentType: string }> {
  if (!buffer.length || buffer.length > MAX_VISUAL_MEDIA_BYTES) {
    throw new Error("Financial visual image is empty or larger than 30 MB.");
  }
  const tempDir = await mkdtemp(join(tmpdir(), "financial-visual-"));
  const inputPath = join(tempDir, "source-image");
  const isCutout = mode === "cutout";
  const outputPath = join(tempDir, isCutout ? "cutout.png" : "visual.jpg");
  const filters = isCutout
    ? "format=rgba,scale=320:320:force_original_aspect_ratio=decrease:flags=lanczos,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=0x00000000"
    : mode === "photo"
      ? "scale=768:256:force_original_aspect_ratio=increase:flags=lanczos,crop=768:256,format=yuv420p"
      : "scale=768:256:force_original_aspect_ratio=decrease:flags=lanczos,pad=768:256:(ow-iw)/2:(oh-ih)/2:color=0x0B151D,format=yuv420p";
  try {
    await writeFile(inputPath, buffer);
    await execFileAsync("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel", "error",
      "-i", inputPath,
      "-vf", filters,
      "-frames:v", "1",
      ...(isCutout ? ["-compression_level", "9"] : ["-q:v", "6"]),
      outputPath,
    ], { timeout: 60_000, maxBuffer: 2 * 1024 * 1024 });
    const normalized = await readFile(outputPath);
    if (!normalized.length || normalized.length > MAX_NORMALIZED_VISUAL_BYTES) {
      throw new Error("Normalized financial visual image is empty or larger than 512 KB.");
    }
    return {
      buffer: normalized,
      contentType: isCutout ? "image/png" : "image/jpeg",
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function makeDataUri(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function findLicensedPhoto(
  queries: string[],
): Promise<FinancialRasterAsset | null> {
  let downloadAttempts = 0;
  for (const query of queries) {
    const candidates = (await searchStockCandidates(query, "image"))
      .filter((candidate) => isAttributionFreeStock(candidate) && /^https?:\/\//i.test(candidate.sourceUrl))
      .slice(0, 2);
    for (const candidate of candidates) {
      if (downloadAttempts >= 2) return null;
      downloadAttempts += 1;
      try {
        const downloaded = await downloadStockCandidate(candidate);
        const normalized = await normalizeRaster(downloaded.buffer, "photo");
        return {
          dataUri: makeDataUri(normalized.buffer, normalized.contentType),
          medium: "licensed_photo",
          renderMode: "photo",
          title: candidate.title,
          sourceUrl: candidate.sourceUrl,
          creator: candidate.creator,
          license: candidate.license,
          licenseUrl: candidate.licenseUrl,
        };
      } catch (error) {
        logger.warn({ err: error, provider: candidate.provider, candidateId: candidate.id }, "Financial stock photo could not be prepared");
      }
    }
  }
  return null;
}

async function generateEditorialIllustration(
  concept: FinancialConcept,
  subject: string,
): Promise<FinancialRasterAsset> {
  const prompt = [
    `Create one polished editorial illustration of ${subject}.`,
    "Single still-life subject, isolated, with a transparent background when supported.",
    "Do not include words, letters, numbers, percentages, currency symbols, logos, brands, or readable interface text.",
    "Do not depict a real company, real security, or specific market data.",
    "Use a restrained premium fintech palette: deep navy, warm ivory, muted teal, and small antique-gold accents; soft studio lighting; clear silhouette.",
    `This image is a topic-neutral visual metaphor for ${concept.replaceAll("_", " ")}; it must not make a financial claim.`,
  ].join(" ");
  const generated = await generateStandaloneImage(prompt, {
    aspectRatio: "1:1",
    visualStyle: "premium editorial fintech still-life illustration",
    realism: "soft stylized 3D illustration, clean shapes, no photorealistic text",
    people: "none",
    colorAtmosphere: "deep navy, warm ivory, muted teal, restrained antique gold, soft studio lighting",
  });
  const hasAlpha = generated.contentType.toLocaleLowerCase().includes("png")
    && pngHasAlphaChannel(generated.buffer);
  const normalized = await normalizeRaster(generated.buffer, hasAlpha ? "cutout" : "illustration");
  return {
    dataUri: makeDataUri(normalized.buffer, normalized.contentType),
    medium: hasAlpha ? "ai_cutout" : "ai_illustration",
    renderMode: hasAlpha ? "cutout" : "photo",
    title: `AI editorial illustration: ${subject}`,
  };
}

function mediaNotice(assets: Record<string, FinancialRasterAsset>): string {
  const photoCount = Object.values(assets).filter((asset) => asset.medium === "licensed_photo").length;
  const aiCount = Object.values(assets).filter((asset) => asset.medium !== "licensed_photo").length;
  const sources: string[] = [];
  if (photoCount) sources.push(`${photoCount} лицензированное тематическое фото`);
  if (aiCount) sources.push(`${aiCount} AI-иллюстрация${aiCount === 1 ? "" : "и"}`);
  return sources.length
    ? `${sources.join(" + ")}; графики, интерфейсные карточки, документы, схемы и подписи остаются программными.`
    : "Внешние изображения недоступны; использованы программные карточки, графики, документы и схемы.";
}

export async function resolveFinancialVisualAssets(
  beats: FinancialShortBeat[],
  concept: FinancialConcept,
): Promise<FinancialVisualMediaResolution> {
  const preparedBeats = beats.map((beat) => ({
    ...beat,
    visualMoments: beat.visualMoments?.map((moment) => ({ ...moment })),
  }));
  const moments = listMoments(preparedBeats);
  const mediaGuide = CONCEPT_MEDIA[concept];
  const photoMoment = findMoment(moments, mediaGuide.stockMomentKinds);
  const laterSceneMoments = photoMoment
    ? moments.filter(({ beatIndex }) => beatIndex !== photoMoment.beatIndex)
    : moments;
  const illustrationMoment = findMoment(
    laterSceneMoments,
    mediaGuide.illustrationMomentKinds,
    photoMoment?.moment.id,
  ) ?? findMoment(moments, mediaGuide.illustrationMomentKinds, photoMoment?.moment.id);
  const assets: Record<string, FinancialRasterAsset> = {};
  const notices: string[] = [];

  const tasks: Array<Promise<void>> = [];
  if (photoMoment) {
    tasks.push((async () => {
      try {
        const photo = await findLicensedPhoto(mediaGuide.stockQueries);
        if (!photo) {
          notices.push("Для темы не найдено фото с лицензией без обязательной атрибуции.");
          return;
        }
        const assetId = "financial-licensed-photo";
        photoMoment.moment.assetId = assetId;
        photoMoment.moment.presentationStyle = "image_sticker";
        assets[assetId] = photo;
      } catch (error) {
        logger.warn({ err: error, concept }, "Financial licensed photo search failed");
        notices.push("Поиск лицензированного фото завершился без подходящего результата.");
      }
    })());
  }
  if (illustrationMoment) {
    tasks.push((async () => {
      try {
        const illustration = await generateEditorialIllustration(concept, mediaGuide.illustrationSubject);
        const assetId = "financial-ai-illustration";
        illustrationMoment.moment.assetId = assetId;
        illustrationMoment.moment.presentationStyle = illustration.renderMode === "cutout"
          ? "cutout_object"
          : "image_sticker";
        assets[assetId] = illustration;
      } catch (error) {
        logger.warn({ err: error, concept }, "Financial AI illustration generation failed");
        notices.push("AI-иллюстрация недоступна; визуальный план сохранён на программной графике.");
      }
    })());
  }
  await Promise.all(tasks);

  if (!photoMoment) notices.push("В плане нет подходящего визуального момента для тематического фото.");
  if (!illustrationMoment) notices.push("В плане нет подходящего отдельного момента для AI-иллюстрации.");
  const credits = Object.values(assets)
    .filter((asset) => asset.medium === "licensed_photo" && asset.sourceUrl)
    .map((asset) => [
      `Фото: ${asset.title}`,
      asset.creator ? `автор ${asset.creator}` : "",
      asset.license ? `лицензия ${asset.license}` : "",
      asset.licenseUrl ? `условия ${asset.licenseUrl}` : "",
      asset.sourceUrl!,
    ].filter(Boolean).join(" · "));
  if (notices.length) {
    logger.info({ concept, notices }, "Financial visual media resolved with fallback notes");
  }
  const notice = [mediaNotice(assets), ...new Set(notices)]
    .filter(Boolean)
    .join(" ");

  return {
    beats: preparedBeats,
    assets,
    notice,
    credits,
  };
}