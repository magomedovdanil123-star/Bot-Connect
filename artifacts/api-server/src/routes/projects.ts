import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  CreateProjectBody,
  CreateProjectResponse,
  GetProjectParams,
  GetProjectResponse,
  ListProjectsResponse,
  RegenerateProjectParams,
  RegenerateProjectResponse,
} from "@workspace/api-zod";
import { db, projectsTable } from "@workspace/db";
import {
  type ScriptRequest,
  generateVideoScript,
  videoScriptSchema,
} from "../lib/script-generator";
import { applyFinanceLongVisualProfile } from "../lib/video-pipeline/finance-long-style";
import { startVideoGeneration } from "../lib/video-pipeline/service";

const router: IRouter = Router();

function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function splitSourceTextIntoScenes(text: string, sceneCount: number): string[] {
  const paragraphs = text
    .replaceAll("\r\n", "\n")
    .split(/\n\s*\n+/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  if (paragraphs.length < sceneCount) {
    throw new Error("The supplied script has too few paragraphs for the visual storyboard.");
  }

  const totalWords = paragraphs.reduce((sum, paragraph) => sum + countWords(paragraph), 0);
  let paragraphIndex = 0;
  let assignedWords = 0;

  return Array.from({ length: sceneCount }, (_, sceneIndex) => {
    const scenesRemaining = sceneCount - sceneIndex;
    const targetWords = (totalWords - assignedWords) / scenesRemaining;
    const group: string[] = [];
    let groupWords = 0;

    while (
      paragraphIndex < paragraphs.length - (scenesRemaining - 1)
      && (group.length === 0 || groupWords < targetWords)
    ) {
      const paragraph = paragraphs[paragraphIndex++]!;
      group.push(paragraph);
      groupWords += countWords(paragraph);
    }

    assignedWords += groupWords;
    return group.join("\n\n");
  });
}

// Temporary development-only route for producing the user-requested standalone asset.
router.post("/projects/agent-prepare-coin-history", async (req, res): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.sendStatus(404);
    return;
  }

  const scriptText = typeof req.body?.script_text === "string"
    ? req.body.script_text.trim()
    : "";
  if (scriptText.length < 100 || scriptText.length > 35_000) {
    res.status(400).json({ error: "script_text must contain between 100 and 35,000 characters." });
    return;
  }

  const topic = "Chainlink (LINK): оракулы, CCIP, токеномика и риски";
  const format = "YouTube Finance Long Video";
  const duration = 600;
  const style = "cinematic documentary, realistic editorial photography, graphite with restrained cyan and amber";
  const tone = "serious, analytical, balanced";

  let storyboard;
  try {
    storyboard = await generateVideoScript({
      topic,
      format,
      duration,
      style,
      tone,
      editorialProfile: "coin-history-documentary",
      minimumScenes: 20,
      instructions: [
        "Создай визуальную раскадровку ровно из 20 сцен для самостоятельного документального видео 16:9.",
        "Весь закадровый текст будет заменён исходным сценарием пользователя; сейчас нужны только разнообразные визуальные описания и prompts для генерации кадров.",
        "Не добавляй новых фактов, дат, цифр, логотипов или надписей. Не проси генератор изображений рисовать текст.",
        "Чередуй общие планы, детали, абстрактные схемы потоков данных, финансовую инфраструктуру и атмосферные документальные кадры.",
        "Исходный сценарий — единственный источник тем и фактов:",
        scriptText,
      ].join("\n\n"),
    });
  } catch (error) {
    req.log.error({ err: error }, "Standalone coin-history storyboard generation failed");
    res.status(providerErrorStatus(error)).json({ error: "Не удалось подготовить раскадровку." });
    return;
  }

  const generatedScenes = storyboard.scenes;
  if (generatedScenes.length < 12) {
    res.status(502).json({ error: "Storyboard generation returned too few scenes." });
    return;
  }
  const sceneCount = Math.min(generatedScenes.length, 24);
  const selectedScenes = generatedScenes.length <= sceneCount
    ? generatedScenes
    : Array.from({ length: sceneCount }, (_, index) =>
      generatedScenes[Math.round(index * (generatedScenes.length - 1) / (sceneCount - 1))]!,
    );
  const narrationGroups = splitSourceTextIntoScenes(scriptText, sceneCount);
  const wordWeights = narrationGroups.map(countWords);
  const totalWordWeight = wordWeights.reduce((sum, weight) => sum + weight, 0);
  let assignedDuration = 0;
  const scenes = selectedScenes.map((scene, index) => {
    const sceneDuration = index === selectedScenes.length - 1
      ? duration - assignedDuration
      : Math.max(1, Math.round(duration * (wordWeights[index]! / totalWordWeight)));
    assignedDuration += sceneDuration;
    return {
      ...scene,
      scene_number: index + 1,
      duration_seconds: sceneDuration,
      voice_text: narrationGroups[index]!,
    };
  });

  const script = {
    ...storyboard,
    title: "Chainlink: инфраструктура новой финансовой системы",
    description: "Документальный обзор Chainlink и LINK по исходному сценарию автора.",
    duration_seconds: duration,
    cta: "",
    scenes,
  };
  const profiledScript = applyFinanceLongVisualProfile(script, 0, false, true);
  const [project] = await db.insert(projectsTable).values({
    title: script.title,
    topic,
    format,
    duration,
    style,
    tone,
    scriptJson: profiledScript,
    status: "completed",
  }).returning();

  try {
    const job = await startVideoGeneration(project.id, {
      format: "16:9",
      duration,
      style,
      tone,
    });
    res.status(202).json({
      project_id: project.id,
      video_job_id: job.id,
      scene_count: scenes.length,
      format: "16:9",
      telegram_delivery: false,
    });
  } catch (error) {
    req.log.error({ err: error, projectId: project.id }, "Standalone coin-history video start failed");
    res.status(500).json({ error: error instanceof Error ? error.message : "Не удалось запустить рендер." });
  }
});

function toApiProject(row: typeof projectsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    topic: row.topic,
    format: row.format,
    duration: row.duration,
    style: row.style,
    tone: row.tone,
    script: videoScriptSchema.parse(row.scriptJson),
    status: row.status,
    created_at: row.createdAt,
  };
}

function scriptRequestFromProject(project: typeof projectsTable.$inferSelect): ScriptRequest {
  return {
    topic: project.topic,
    format: project.format,
    duration: project.duration,
    style: project.style,
    tone: project.tone,
  };
}

function providerErrorStatus(error: unknown): number {
  return error instanceof Error && error.message.includes("rate limit") ? 429 : 502;
}

router.get("/projects", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(projectsTable)
    .orderBy(desc(projectsTable.createdAt));
  res.json(ListProjectsResponse.parse(rows.map(toApiProject)));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let script;
  try {
    script = await generateVideoScript(parsed.data);
  } catch (error) {
    req.log.error({ err: error }, "Project script generation failed");
    res.status(providerErrorStatus(error)).json({ error: "Не удалось создать сценарий" });
    return;
  }

  const [row] = await db
    .insert(projectsTable)
    .values({
      title: script.title,
      topic: parsed.data.topic,
      format: parsed.data.format,
      duration: parsed.data.duration,
      style: parsed.data.style,
      tone: parsed.data.tone,
      scriptJson: script,
       status: "draft",
    })
    .returning();

  res.status(201).json(CreateProjectResponse.parse(toApiProject(row)));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(GetProjectResponse.parse(toApiProject(row)));
});

router.post("/projects/:id/regenerate", async (req, res): Promise<void> => {
  const params = RegenerateProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, params.data.id));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  let script;
  try {
    script = await generateVideoScript(scriptRequestFromProject(project));
  } catch (error) {
    req.log.error({ err: error, projectId: project.id }, "Project regeneration failed");
    res.status(providerErrorStatus(error)).json({ error: "Не удалось перегенерировать сценарий" });
    return;
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ title: script.title, scriptJson: script, status: "draft" })
    .where(eq(projectsTable.id, project.id))
    .returning();

  res.json(RegenerateProjectResponse.parse(toApiProject(updated)));
});

router.post("/projects/:id/approve", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const script = videoScriptSchema.safeParse(req.body?.script);
  if (!script.success) {
    res.status(400).json({ error: "Сценарий имеет неверную структуру" });
    return;
  }
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, params.data.id));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const [updated] = await db.update(projectsTable)
    .set({ title: script.data.title, scriptJson: script.data, status: "completed" })
    .where(eq(projectsTable.id, project.id))
    .returning();
  res.json(toApiProject(updated));
});

export default router;