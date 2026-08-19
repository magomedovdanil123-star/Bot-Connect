import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  DeleteImageParams,
  GenerateProjectImagesBody,
  GenerateProjectImagesParams,
  GenerateProjectImagesResponse,
  GetImageParams,
  GetImageResponse,
  ListProjectImagesParams,
  ListProjectImagesResponse,
  RegenerateImageBody,
  RegenerateImageParams,
  RegenerateImageResponse,
  SetPrimaryImageParams,
  SetPrimaryImageResponse,
} from "@workspace/api-zod";
import { db, generatedImagesTable, projectsTable } from "@workspace/db";
import { startProjectImageGeneration, startSingleImageRegeneration } from "../lib/image-generation/service";

const router: IRouter = Router();

function toApiImage(row: typeof generatedImagesTable.$inferSelect) {
  return {
    id: row.id,
    project_id: row.projectId,
    scene_id: row.sceneId,
    prompt: row.prompt,
    negative_prompt: row.negativePrompt,
    provider: row.provider,
    model: row.model,
    aspect_ratio: row.aspectRatio,
    status: row.status,
    image_url: row.imageUrl,
    storage_path: row.storagePath,
    width: row.width,
    height: row.height,
    generation_time: row.generationTime,
    error: row.error,
    version: row.version,
    is_primary: row.isPrimary,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

router.get("/projects/:id/images", async (req, res): Promise<void> => {
  const params = ListProjectImagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const rows = await db.select().from(generatedImagesTable).where(eq(generatedImagesTable.projectId, params.data.id));
  res.json(ListProjectImagesResponse.parse(rows.map(toApiImage)));
});

router.post("/projects/:id/images", async (req, res): Promise<void> => {
  const params = GenerateProjectImagesParams.safeParse(req.params);
  const body = GenerateProjectImagesBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Invalid image generation settings" });
    return;
  }
  const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const settings = body.data;
  const ids = await startProjectImageGeneration(params.data.id, {
    count: settings.count,
    aspectRatio: settings.aspect_ratio,
    visualStyle: settings.visual_style,
    realism: settings.realism,
    people: settings.people,
    colorAtmosphere: settings.color_atmosphere,
    consistentCharacter: settings.consistent_character,
    characterProfile: settings.character_profile,
  });
  res.status(202).json(GenerateProjectImagesResponse.parse({
    project_id: params.data.id,
    status: "pending",
    total: ids.length,
    image_ids: ids,
  }));
});

router.get("/images/:id", async (req, res): Promise<void> => {
  const params = GetImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(generatedImagesTable).where(eq(generatedImagesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.json(GetImageResponse.parse(toApiImage(row)));
});

router.delete("/images/:id", async (req, res): Promise<void> => {
  const params = DeleteImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.delete(generatedImagesTable).where(eq(generatedImagesTable.id, params.data.id)).returning({ id: generatedImagesTable.id });
  if (!row) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.sendStatus(204);
});

router.post("/images/:id/regenerate", async (req, res): Promise<void> => {
  const params = RegenerateImageParams.safeParse(req.params);
  const body = RegenerateImageBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Prompt is required" });
    return;
  }
  try {
    const row = await startSingleImageRegeneration(params.data.id, body.data.prompt);
    res.status(202).json(RegenerateImageResponse.parse(toApiImage(row)));
  } catch (error) {
    if (error instanceof Error && error.message === "Image not found") {
      res.status(404).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Could not start image regeneration" });
  }
});

router.put("/images/:id/primary", async (req, res): Promise<void> => {
  const params = SetPrimaryImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(generatedImagesTable).where(eq(generatedImagesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  const updated = await db.transaction(async (tx) => {
    await tx.update(generatedImagesTable).set({ isPrimary: false, updatedAt: new Date() }).where(and(
      eq(generatedImagesTable.projectId, row.projectId),
      eq(generatedImagesTable.sceneId, row.sceneId),
    ));
    return tx.update(generatedImagesTable).set({ isPrimary: true, updatedAt: new Date() }).where(eq(generatedImagesTable.id, row.id)).returning();
  });
  res.json(SetPrimaryImageResponse.parse(toApiImage(updated[0])));
});

export default router;