import { randomUUID } from "node:crypto";
import { objectStorageClient } from "../objectStorage";
import { logger } from "../logger";
import { characterProfilesTable, db, generatedImagesTable, projectsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { videoScriptSchema } from "../script-generator";
import { buildScenePrompt, DEFAULT_NEGATIVE_PROMPT } from "./prompt-builder";
import { OpenRouterImageProvider } from "./providers/openrouter";
import type { ImageGenerationSettings } from "./types";

const provider = new OpenRouterImageProvider();

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

export type ImageJobSettings = ImageGenerationSettings & {
  count: number;
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
  const script = videoScriptSchema.parse(project.scriptJson);
  if (settings.characterProfile) {
    const profile = settings.characterProfile;
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
  const scenes = script.scenes.slice(0, settings.count);
  const rows = await db.transaction(async (tx) => {
    await tx.delete(generatedImagesTable).where(eq(generatedImagesTable.projectId, projectId));
    return tx.insert(generatedImagesTable).values(
      scenes.map((scene) => ({
        projectId,
        sceneId: scene.scene_number,
        prompt: buildScenePrompt(scene, settings),
        negativePrompt: DEFAULT_NEGATIVE_PROMPT,
        provider: provider.name,
        model: provider.model,
        aspectRatio: settings.aspectRatio,
        status: "pending",
        version: 1,
        isPrimary: true,
      })),
    ).returning({ id: generatedImagesTable.id });
  });
  const ids = rows.map((row) => row.id);
  void processImageJob(projectId, ids, settings);
  return ids;
}

async function processImageJob(projectId: number, ids: number[], settings: ImageJobSettings): Promise<void> {
  for (const id of ids) {
    const started = Date.now();
    try {
      const [image] = await db.select().from(generatedImagesTable).where(eq(generatedImagesTable.id, id));
      if (!image) continue;
      await db.update(generatedImagesTable).set({ status: "processing", updatedAt: new Date() }).where(eq(generatedImagesTable.id, id));
      const asset = await provider.generate(image.prompt, settings);
      const storagePath = await storeImage(asset.buffer, asset.contentType);
      await db.update(generatedImagesTable).set({
        status: "completed",
        storagePath,
        imageUrl: `/api/storage${storagePath}`,
        width: asset.width,
        height: asset.height,
        generationTime: Date.now() - started,
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
  const [version] = await db.insert(generatedImagesTable).values({
    projectId: source.projectId,
    sceneId: source.sceneId,
    prompt,
    negativePrompt: source.negativePrompt,
    provider: source.provider,
    model: source.model,
    aspectRatio: source.aspectRatio,
    status: "pending",
    version: sql`coalesce((select max(version) + 1 from generated_images where scene_id = ${source.sceneId} and project_id = ${source.projectId}), 2)`,
    isPrimary: false,
  }).returning();
  void processImageJob(source.projectId, [version.id], {
    count: 1,
    aspectRatio: source.aspectRatio,
    visualStyle: "cinematic realistic",
    realism: "high",
    people: "optional",
    colorAtmosphere: "natural cinematic",
    consistentCharacter: false,
  });
  return version;
}