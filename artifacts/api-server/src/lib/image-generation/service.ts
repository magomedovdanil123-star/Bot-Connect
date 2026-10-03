import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { objectStorageClient } from "../objectStorage";
import { logger } from "../logger";
import { characterProfilesTable, db, generatedImagesTable, projectsTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { videoScriptSchema } from "../script-generator";
import {
  buildCharacterDescription,
  buildScenePrompt,
  DEFAULT_NEGATIVE_PROMPT,
} from "./prompt-builder";
import { OpenRouterImageProvider } from "./providers/openrouter";
import { GeminiImageProvider } from "./providers/gemini";
import { OdiRouterImageProvider } from "./providers/odirouter";
import { FalImageProvider } from "./providers/fal";
import { KreaImageProvider } from "./providers/krea";
import type { ImageGenerationSettings } from "./types";
import { findMediaAsset, downloadMediaAsset, saveMediaAsset, sha256, supabaseConfigured } from "../supabase";

const execFileAsync = promisify(execFile);

function getImageProvider() {
  const provider = (process.env["IMAGE_PROVIDER"] || "krea").toLowerCase();
  if (provider === "krea") return new KreaImageProvider();
  if (provider === "gemini") return new GeminiImageProvider();
  if (provider === "odirouter") return new OdiRouterImageProvider();
  if (provider === "fal") return new FalImageProvider();
  return new OpenRouterImageProvider();
}

let imageProviderQueue = Promise.resolve();

function withImageProviderQueue<T>(task: () => Promise<T>): Promise<T> {
  const queuedTask = imageProviderQueue.then(task, task);
  imageProviderQueue = queuedTask.then(() => undefined, () => undefined);
  return queuedTask;
}

function isInFlightCreditError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /available credits|in-flight requests|add credits|retry after in-flight/iu.test(message);
}

async function generateImageWithRetry(
  provider: ReturnType<typeof getImageProvider>,
  prompt: string,
  settings: ImageGenerationSettings,
) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await withImageProviderQueue(() => provider.generate(prompt, settings));
    } catch (error) {
      if (!isInFlightCreditError(error) || attempt === 5) throw error;
      const delayMs = Math.min(60_000, attempt * 15_000);
      logger.warn({ attempt, delayMs }, "Image provider is at its in-flight credit limit; waiting before retry");
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("Image generation retry limit reached");
}

export async function generateStandaloneImage(
  prompt: string,
  settings: ImageGenerationSettings,
) {
  return generateImageWithRetry(getImageProvider(), prompt, settings);
}

function parseObjectPath(path: string): { bucketName: string; objectName: string } {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  const [bucketName, ...parts] = normalized.split("/");
  return { bucketName, objectName: parts.join("/") };
}

async function storeImage(buffer: Buffer, contentType: string): Promise<string> {
  const privateDir = process.env["PRIVATE_OBJECT_DIR"];
  if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
  const path = `${privateDir}/generated/${randomUUID()}.png`;
  const { bucketName, objectName } = parseObjectPath(path);
  await objectStorageClient.bucket(bucketName).file(objectName).save(buffer, {
    resumable: false,
    metadata: { contentType, cacheControl: "private, max-age=31536000" },
  });
  const relative = privateDir.endsWith("/") ? path.slice(privateDir.length) : path.slice(privateDir.length + 1);
  return `/objects/${relative}`;
}

export async function storeUploadedImage(buffer: Buffer, contentType: string): Promise<string> {
  const dir = await mkdtemp(join("/tmp", "uploaded-image-"));
  const input = join(dir, "source");
  const output = join(dir, "vertical.png");
  try {
    await writeFile(input, buffer);
    let crop = "";
    try {
      const probe = await execFileAsync("ffmpeg", [
        "-hide_banner", "-i", input, "-vf", "cropdetect=limit=0.05:round=2:reset=0", "-frames:v", "120", "-f", "null", "-",
      ], { maxBuffer: 2 * 1024 * 1024 });
      const matches = probe.stderr.match(/crop=\d+:\d+:\d+:\d+/g);
      crop = matches?.at(-1) || "";
    } catch {
      // If crop detection cannot inspect an unusual image, the final aspect-ratio crop still applies.
    }
    const filters = [
      crop,
      "scale=1080:1920:force_original_aspect_ratio=increase",
      "crop=1080:1920",
      "format=rgba",
    ].filter(Boolean).join(",");
    await execFileAsync("ffmpeg", ["-y", "-hide_banner", "-i", input, "-vf", filters, "-frames:v", "1", output], {
      maxBuffer: 2 * 1024 * 1024,
    });
    return storeImage(await readFile(output), "image/png");
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export type ImageJobSettings = ImageGenerationSettings & {
  count: number;
  sceneIds?: number[];
  consistentCharacter: boolean;
  characterDescription?: string;
  characterProfile?: {
    gender: string;
    age: string;
    appearance: string;
    hair: string;
    clothing: string;
    accessories: string;
    facial_features: string;
    style: string;
    persistent_traits: string;
  } | null;
};

export async function startProjectImageGeneration(
  projectId: number,
  settings: ImageJobSettings,
): Promise<number[]> {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error("Project not found");
  if (project.format === "16:9" || project.format.toLocaleLowerCase().includes("long")) {
    throw new Error("Image generation for 16:9 Long-video projects is disabled.");
  }
  const script = videoScriptSchema.parse(project.scriptJson);
  const generationSettings = settings;
  let characterProfile = generationSettings.characterProfile;
  if (generationSettings.consistentCharacter && !characterProfile) {
    const [storedProfile] = await db.select().from(characterProfilesTable).where(eq(characterProfilesTable.projectId, projectId));
    if (storedProfile) {
      characterProfile = {
        gender: storedProfile.gender,
        age: storedProfile.age,
        appearance: storedProfile.appearance,
        hair: storedProfile.hair,
        clothing: storedProfile.clothing,
        accessories: storedProfile.accessories,
        facial_features: storedProfile.facialFeatures,
        style: storedProfile.style,
        persistent_traits: storedProfile.persistentTraits,
      };
    }
  }
  if (characterProfile) {
    const profile = characterProfile;
    await db.insert(characterProfilesTable).values({
      projectId,
      gender: profile.gender,
      age: profile.age,
      appearance: profile.appearance,
      hair: profile.hair,
      clothing: profile.clothing,
      accessories: profile.accessories,
      facialFeatures: profile.facial_features,
      style: profile.style,
      persistentTraits: profile.persistent_traits,
    }).onConflictDoUpdate({
      target: characterProfilesTable.projectId,
      set: {
        gender: profile.gender,
        age: profile.age,
        appearance: profile.appearance,
        hair: profile.hair,
        clothing: profile.clothing,
        accessories: profile.accessories,
        facialFeatures: profile.facial_features,
        style: profile.style,
        persistentTraits: profile.persistent_traits,
        updatedAt: new Date(),
      },
    });
  }
  const promptSettings = {
    ...generationSettings,
    characterLock: generationSettings.consistentCharacter,
    characterDescription: characterProfile
      ? buildCharacterDescription(characterProfile)
      : generationSettings.consistentCharacter
        ? [
            "the same main protagonist throughout every scene",
            "use the first scene as the visual identity reference",
            `identity anchor from opening scene: ${script.scenes[0]?.visual_description || script.scenes[0]?.image_prompt || "the protagonist established by the story"}`,
            "keep the protagonist's face, age, hair, clothing, body type, and accessories unchanged",
          ].join(", ")
        : undefined,
  };
  const provider = getImageProvider();
  const scenes = generationSettings.sceneIds?.length
    ? script.scenes.filter((scene) => generationSettings.sceneIds!.includes(scene.scene_number))
    : script.scenes.slice(0, generationSettings.count);
  const rows = await db.transaction(async (tx) => {
    if (generationSettings.sceneIds?.length) {
      await tx.delete(generatedImagesTable).where(and(
        eq(generatedImagesTable.projectId, projectId),
        inArray(generatedImagesTable.sceneId, generationSettings.sceneIds),
      ));
    } else {
      await tx.delete(generatedImagesTable).where(eq(generatedImagesTable.projectId, projectId));
    }
    return tx.insert(generatedImagesTable).values(
      scenes.map((scene) => ({
        projectId,
        sceneId: scene.scene_number,
        prompt: buildScenePrompt(scene, promptSettings),
        negativePrompt: DEFAULT_NEGATIVE_PROMPT,
        provider: provider.name,
        model: provider.model,
        aspectRatio: generationSettings.aspectRatio,
        status: "pending",
        version: 1,
        isPrimary: true,
      })),
    ).returning({ id: generatedImagesTable.id });
  });
  const ids = rows.map((row) => row.id);
  void processImageJob(projectId, ids, generationSettings);
  return ids;
}

async function processImageJob(projectId: number, ids: number[], settings: ImageJobSettings): Promise<void> {
  const provider = getImageProvider();
  for (const id of ids) {
    const started = Date.now();
    try {
      const [image] = await db.select().from(generatedImagesTable).where(eq(generatedImagesTable.id, id));
      if (!image) continue;
      await db.update(generatedImagesTable).set({ status: "processing", updatedAt: new Date() }).where(eq(generatedImagesTable.id, id));
      const fingerprint = sha256(Buffer.from(JSON.stringify({
        kind: "image",
        prompt: image.prompt,
        negativePrompt: image.negativePrompt,
        provider: image.provider,
        model: image.model,
        aspectRatio: image.aspectRatio,
        settings: {
          visualStyle: settings.visualStyle,
          realism: settings.realism,
          people: settings.people,
          colorAtmosphere: settings.colorAtmosphere,
          consistentCharacter: settings.consistentCharacter,
          characterProfile: settings.characterProfile,
        },
      })));
      let imageBuffer: Buffer;
      let contentType = "image/png";
      let width: number | undefined;
      let height: number | undefined;
      let reused = false;
      if (supabaseConfigured) {
        const existing = await findMediaAsset(fingerprint);
        if (existing) {
          try {
            imageBuffer = await downloadMediaAsset(existing);
            contentType = existing.content_type;
            width = typeof existing.metadata?.width === "number" ? existing.metadata.width : undefined;
            height = typeof existing.metadata?.height === "number" ? existing.metadata.height : undefined;
            reused = true;
          } catch (error) {
            logger.warn({ err: error, imageId: id }, "Cached Supabase image could not be downloaded");
            const generated = await generateImageWithRetry(provider, image.prompt, settings);
            imageBuffer = generated.buffer;
            contentType = generated.contentType;
            width = generated.width;
            height = generated.height;
          }
        } else {
          const generated = await generateImageWithRetry(provider, image.prompt, settings);
          imageBuffer = generated.buffer;
          contentType = generated.contentType;
          width = generated.width;
          height = generated.height;
        }
      } else {
        const generated = await generateImageWithRetry(provider, image.prompt, settings);
        imageBuffer = generated.buffer;
        contentType = generated.contentType;
        width = generated.width;
        height = generated.height;
      }
      if (supabaseConfigured) {
        const persisted = await saveMediaAsset({
          kind: "image",
          buffer: imageBuffer,
          contentType,
          fingerprint,
          projectId,
          sceneId: image.sceneId,
          metadata: { prompt: image.prompt, provider: image.provider, model: image.model, reused, width, height },
        });
        imageBuffer = persisted.buffer;
        reused ||= persisted.reused;
      }
      const storagePath = await storeImage(imageBuffer, contentType);
      await db.update(generatedImagesTable).set({
        status: "completed",
        storagePath,
        imageUrl: `/api/storage${storagePath}`,
        width,
        height,
        generationTime: Date.now() - started,
        error: reused ? "reused_from_supabase" : null,
        updatedAt: new Date(),
      }).where(eq(generatedImagesTable.id, id));
    } catch (error) {
      logger.error({ err: error, imageId: id, projectId }, "Image generation failed");
      await db.update(generatedImagesTable).set({
        status: "failed",
        error: error instanceof Error ? error.message : "Image generation failed",
        generationTime: Date.now() - started,
        updatedAt: new Date(),
      }).where(eq(generatedImagesTable.id, id));
    }
  }
}

export async function startSingleImageRegeneration(
  imageId: number,
  prompt: string,
): Promise<typeof generatedImagesTable.$inferSelect> {
  const [source] = await db.select().from(generatedImagesTable).where(eq(generatedImagesTable.id, imageId));
  if (!source) throw new Error("Image not found");
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, source.projectId));
  if (!project) throw new Error("Project not found");
  if (project.format === "16:9" || project.format.toLocaleLowerCase().includes("long")) {
    throw new Error("Image regeneration for 16:9 Long-video projects is disabled.");
  }
  const regenerationSettings: ImageJobSettings = {
    count: 1,
    aspectRatio: source.aspectRatio,
    visualStyle: "cinematic realistic",
    realism: "high",
    people: "optional",
    colorAtmosphere: "natural cinematic",
    consistentCharacter: false,
  };
  const [version] = await db.insert(generatedImagesTable).values({
    projectId: source.projectId,
    sceneId: source.sceneId,
    prompt,
    negativePrompt: source.negativePrompt,
    provider: source.provider,
    model: source.model,
    aspectRatio: regenerationSettings.aspectRatio,
    status: "pending",
    version: sql`coalesce((select max(version) + 1 from generated_images where scene_id = ${source.sceneId} and project_id = ${source.projectId}), 2)`,
    isPrimary: false,
  }).returning();
  void processImageJob(source.projectId, [version.id], regenerationSettings);
  return version;
}