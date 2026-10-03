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
import {
  ensureFinanceLongMotionSequence,
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
  FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY,
} from "../lib/video-pipeline/ethereum-motion-design";
import {
  cancelVideoGeneration,
  startVideoGeneration,
} from "../lib/video-pipeline/service";

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
  const visualBrief = typeof req.body?.visual_brief === "string"
    ? req.body.visual_brief.trim()
    : "";
  if (
    scriptText.length < 100
    || scriptText.length > 35_000
    || visualBrief.length < 100
    || visualBrief.length > 15_000
  ) {
    res.status(400).json({ error: "script_text and visual_brief must contain valid text." });
    return;
  }

  const topic = "Chainlink (LINK): оракулы, CCIP, токеномика и риски";
  const format = "YouTube Finance Long Video";
  const duration = 600;
  const style = "premium crypto documentary motion design, dark graphite, white typography, cyan accent, amber risk color";
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
        "Создай динамическую раскадровку ровно из 20 сцен для самостоятельного документального видео 16:9.",
        "Не создавай AI-изображения и не превращай ролик в слайд-шоу: визуальные описания предназначены только для анимированной инфографики, motion graphics, UI и динамического монтажа.",
        "Для каждой сцены опиши движение, смену композиции, данные/узлы/графики и переход, связанные именно с её голосовым текстом.",
        "Не добавляй новых фактов, дат, цифр и логотипов. Все читаемые подписи будут добавлены отдельно из сценария.",
        "Используй приложенный визуальный бриф как обязательную спецификацию:",
        visualBrief,
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
    const visualDescription = ensureFinanceLongMotionSequence(
      scene.visual_description || narrationGroups[index]!,
    );
    return {
      ...scene,
      scene_number: index + 1,
      duration_seconds: sceneDuration,
      voice_text: narrationGroups[index]!,
      visual_description: visualDescription,
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
  const profiledScript = {
    ...applyFinanceLongVisualProfile(script, 0, false, true),
    [FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY]: FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
  };
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

router.post("/projects/agent-cancel-video/:id", async (req, res): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.sendStatus(404);
    return;
  }
  const jobId = Number(req.params.id);
  if (!Number.isInteger(jobId) || jobId <= 0) {
    res.status(400).json({ error: "Invalid video job id." });
    return;
  }
  const job = await cancelVideoGeneration(jobId);
  if (!job) {
    res.status(409).json({ error: "Video job is not pending or processing." });
    return;
  }
  res.json({ id: job.id, status: job.status, error: job.error });
});

router.post("/projects/agent-restart-coin-history", async (req, res): Promise<void> => {
  if (process.env.NODE_ENV === "production") {
    res.sendStatus(404);
    return;
  }
  const projectId = Number(req.body?.project_id);
  const duration = Number(req.body?.duration_seconds);
  const visualDescriptions: unknown = req.body?.visual_descriptions;
  if (!Number.isInteger(projectId) || projectId <= 0) {
    res.status(400).json({ error: "Invalid project id." });
    return;
  }
  if (!Number.isInteger(duration) || duration < 60 || duration > 3_600) {
    res.status(400).json({ error: "duration_seconds must be an integer from 60 to 3,600." });
    return;
  }
  if (
    !Array.isArray(visualDescriptions)
    || visualDescriptions.length !== 20
    || visualDescriptions.some((value) =>
      typeof value !== "string" || value.trim().length < 30 || value.length > 3_000,
    )
  ) {
    res.status(400).json({ error: "Provide exactly 20 non-empty scene visual descriptions." });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }
  const script = videoScriptSchema.parse(project.scriptJson);
  if (script.scenes.length !== visualDescriptions.length) {
    res.status(409).json({ error: "Visual descriptions must match the saved scene count." });
    return;
  }
  const wordWeights = script.scenes.map((scene) => countWords(scene.voice_text));
  const totalWordWeight = wordWeights.reduce((sum, weight) => sum + weight, 0);
  let assignedDuration = 0;
  const scenes = script.scenes.map((scene, index) => {
    const sceneDuration = index === script.scenes.length - 1
      ? duration - assignedDuration
      : Math.max(1, Math.round(duration * (wordWeights[index]! / totalWordWeight)));
    assignedDuration += sceneDuration;
    return {
      ...scene,
      duration_seconds: sceneDuration,
      visual_description: ensureFinanceLongMotionSequence(
        (visualDescriptions[index] as string).trim(),
      ),
    };
  });
  const storedMetadata = typeof project.scriptJson === "object" && project.scriptJson !== null
    ? project.scriptJson as Record<string, unknown>
    : {};
  const updatedScript = {
    ...storedMetadata,
    ...script,
    duration_seconds: duration,
    scenes,
    [FINANCE_LONG_ETHEREUM_MOTION_PROFILE_KEY]: FINANCE_LONG_ETHEREUM_MOTION_PROFILE,
  };
  await db.update(projectsTable)
    .set({ duration, scriptJson: updatedScript, status: "completed" })
    .where(eq(projectsTable.id, projectId));

  try {
    const job = await startVideoGeneration(projectId, {
      format: "16:9",
      duration,
      style: project.style,
      tone: project.tone,
    });
    res.status(202).json({
      project_id: projectId,
      video_job_id: job.id,
      scene_count: scenes.length,
      format: "16:9",
      telegram_delivery: false,
    });
  } catch (error) {
    req.log.error({ err: error, projectId }, "Standalone coin-history video restart failed");
    res.status(500).json({ error: error instanceof Error ? error.message : "Не удалось перезапустить рендер." });
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