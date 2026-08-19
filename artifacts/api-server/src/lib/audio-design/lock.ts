import { randomUUID } from "node:crypto";
import { and, eq, inArray, lt } from "drizzle-orm";
import {
  audioMixesTable,
  audioProjectLocksTable,
  db,
  soundDesignPlansTable,
} from "@workspace/db";

const STALE_LOCK_MS = 15 * 60 * 1000;
const BUSY_MESSAGE = "Audio processing is already running for this project";
const INTERRUPTED_MESSAGE = "Audio processing was interrupted and can be retried";
type AudioProjectTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class AudioProjectLockLostError extends Error {
  constructor() {
    super("Audio processing lock was lost; retry the operation");
    this.name = "AudioProjectLockLostError";
  }
}

function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("code" in error)) return undefined;
  return typeof error.code === "string" ? error.code : undefined;
}

export async function claimAudioProject(projectId: number, kind: string): Promise<string> {
  const ownerId = randomUUID();
  const staleBefore = new Date(Date.now() - STALE_LOCK_MS);
  try {
    const claimed = await db.transaction(async (tx) => {
      const removed = await tx.delete(audioProjectLocksTable).where(and(
        eq(audioProjectLocksTable.projectId, projectId),
        lt(audioProjectLocksTable.heartbeatAt, staleBefore),
      )).returning({ projectId: audioProjectLocksTable.projectId });
      if (removed.length) {
        await tx.update(soundDesignPlansTable).set({
          status: "failed",
          error: INTERRUPTED_MESSAGE,
          updatedAt: new Date(),
        }).where(and(
          eq(soundDesignPlansTable.projectId, projectId),
          inArray(soundDesignPlansTable.status, ["pending", "processing", "assets"]),
        ));
        await tx.update(audioMixesTable).set({
          status: "failed",
          error: INTERRUPTED_MESSAGE,
          updatedAt: new Date(),
        }).where(and(
          eq(audioMixesTable.projectId, projectId),
          inArray(audioMixesTable.status, ["pending", "processing"]),
        ));
      }
      const [lock] = await tx.insert(audioProjectLocksTable).values({
        projectId,
        ownerId,
        kind,
      }).onConflictDoNothing().returning({ ownerId: audioProjectLocksTable.ownerId });
      return lock;
    });
    if (!claimed) throw new Error(BUSY_MESSAGE);
    return ownerId;
  } catch (error) {
    if (databaseErrorCode(error) === "23503") throw new Error("Project not found");
    throw error;
  }
}

export async function heartbeatAudioProject(projectId: number, ownerId: string): Promise<void> {
  const [lock] = await db.update(audioProjectLocksTable).set({ heartbeatAt: new Date() }).where(and(
    eq(audioProjectLocksTable.projectId, projectId),
    eq(audioProjectLocksTable.ownerId, ownerId),
  )).returning({ ownerId: audioProjectLocksTable.ownerId });
  if (!lock) throw new AudioProjectLockLostError();
}

export async function withAudioProjectFence<T>(
  projectId: number,
  ownerId: string,
  operation: (tx: AudioProjectTransaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const [lock] = await tx.select({ ownerId: audioProjectLocksTable.ownerId })
      .from(audioProjectLocksTable)
      .where(and(
        eq(audioProjectLocksTable.projectId, projectId),
        eq(audioProjectLocksTable.ownerId, ownerId),
      ))
      .for("update");
    if (!lock) throw new AudioProjectLockLostError();
    return operation(tx);
  });
}

export async function releaseAudioProject(projectId: number, ownerId: string): Promise<void> {
  await db.delete(audioProjectLocksTable).where(and(
    eq(audioProjectLocksTable.projectId, projectId),
    eq(audioProjectLocksTable.ownerId, ownerId),
  ));
}

export async function withAudioProjectLock<T>(
  projectId: number,
  kind: string,
  operation: (ownerId: string) => Promise<T>,
): Promise<T> {
  const ownerId = await claimAudioProject(projectId, kind);
  try {
    return await operation(ownerId);
  } finally {
    await releaseAudioProject(projectId, ownerId);
  }
}