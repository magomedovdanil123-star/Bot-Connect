import { and, asc, eq } from "drizzle-orm";
import { db, projectsTable, voiceGenerationsTable } from "@workspace/db";
import { videoScriptSchema } from "../script-generator";

export async function loadActiveVoiceTimeline(projectId: number, requireStorage = false) {
  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error("Project not found");
  const script = videoScriptSchema.parse(project.scriptJson);
  const voices = await db.select().from(voiceGenerationsTable).where(and(
    eq(voiceGenerationsTable.projectId, projectId),
    eq(voiceGenerationsTable.isActive, true),
    eq(voiceGenerationsTable.isFullVoice, false),
    eq(voiceGenerationsTable.status, "completed"),
  )).orderBy(asc(voiceGenerationsTable.sceneId));
  const expectedSceneIds = script.scenes.map((scene) => scene.scene_number);
  let previousEnd = 0;
  const invalidTimeline = voices.some((row) => {
    const invalid = row.startTime === null
      || row.endTime === null
      || row.endTime <= row.startTime
      || row.startTime !== previousEnd;
    previousEnd = row.endTime || previousEnd;
    return invalid;
  });
  if (
    voices.length !== expectedSceneIds.length
    || new Set(voices.map((row) => row.sceneId)).size !== voices.length
    || expectedSceneIds.some((sceneId) => !voices.some((row) => row.sceneId === sceneId))
    || (requireStorage && voices.some((row) => !row.storagePath))
    || invalidTimeline
  ) throw new Error("Complete active scene voice is required");
  return {
    project,
    script,
    voices,
    totalMs: voices.at(-1)?.endTime || 0,
  };
}