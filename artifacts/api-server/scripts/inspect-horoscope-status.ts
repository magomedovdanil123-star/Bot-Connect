import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import {
  db,
  horoscopeContentItemsTable,
  horoscopeContentRunsTable,
  videoGenerationJobsTable,
} from "@workspace/db";

const chatId = Number(process.argv[2]);
if (!Number.isInteger(chatId) || chatId <= 0) throw new Error("chatId required");

const runs = await db.select({
  id: horoscopeContentRunsTable.id,
  status: horoscopeContentRunsTable.status,
  topic: horoscopeContentRunsTable.topic,
  totalCount: horoscopeContentRunsTable.totalCount,
  completedCount: horoscopeContentRunsTable.completedCount,
  failedCount: horoscopeContentRunsTable.failedCount,
  createdAt: horoscopeContentRunsTable.createdAt,
  updatedAt: horoscopeContentRunsTable.updatedAt,
}).from(horoscopeContentRunsTable)
  .where(eq(horoscopeContentRunsTable.chatId, chatId))
  .orderBy(desc(horoscopeContentRunsTable.updatedAt))
  .limit(10);

const items = await db.select({
  id: horoscopeContentItemsTable.id,
  runId: horoscopeContentItemsTable.runId,
  channelTitle: horoscopeContentItemsTable.channelTitle,
  videoStatus: horoscopeContentItemsTable.videoStatus,
  videoJobId: horoscopeContentItemsTable.videoJobId,
  projectId: horoscopeContentItemsTable.projectId,
  updatedAt: horoscopeContentItemsTable.updatedAt,
}).from(horoscopeContentItemsTable)
  .innerJoin(horoscopeContentRunsTable, eq(horoscopeContentRunsTable.id, horoscopeContentItemsTable.runId))
  .where(eq(horoscopeContentRunsTable.chatId, chatId))
  .orderBy(desc(horoscopeContentItemsTable.updatedAt))
  .limit(30);

const jobIds = items.map((item) => item.videoJobId).filter((id): id is number => Number.isInteger(id));
const jobs = jobIds.length
  ? await db.select({
    id: videoGenerationJobsTable.id,
    projectId: videoGenerationJobsTable.projectId,
    status: videoGenerationJobsTable.status,
    progress: videoGenerationJobsTable.progress,
    videoStoragePath: videoGenerationJobsTable.videoStoragePath,
    telegramDeliveredAt: videoGenerationJobsTable.telegramDeliveredAt,
    error: videoGenerationJobsTable.error,
    updatedAt: videoGenerationJobsTable.updatedAt,
  }).from(videoGenerationJobsTable).where(inArray(videoGenerationJobsTable.id, jobIds))
  : [];

console.log(JSON.stringify({ runs, items, jobs }, null, 2));