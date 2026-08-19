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

const router: IRouter = Router();

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
      status: "completed",
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
    .set({ title: script.title, scriptJson: script, status: "completed" })
    .where(eq(projectsTable.id, project.id))
    .returning();

  res.json(RegenerateProjectResponse.parse(toApiProject(updated)));
});

export default router;