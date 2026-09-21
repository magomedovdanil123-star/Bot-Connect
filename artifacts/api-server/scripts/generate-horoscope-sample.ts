import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  db,
  horoscopeContentHistoryTable,
  telegramHoroscopeChannelsTable,
  youtubeConnectionsTable,
} from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import {
  buildHoroscopeChannelConfig,
  generateHoroscopeContent,
} from "../src/lib/horoscope-content-generator";
import {
  createHoroscopeCurrentContext,
  generateHoroscopeContentPlan,
  type HoroscopePlanningHistoryItem,
} from "../src/lib/script-generator";

const SAMPLE_CONNECTIONS = [
  { id: 900_001, channelTitle: "Гороскоп на завтра — тестовый профиль" },
  { id: 900_002, channelTitle: "Любовь по Знакам — тестовый профиль" },
  { id: 900_003, channelTitle: "Деньги и Знаки — тестовый профиль" },
  { id: 900_004, channelTitle: "Лунные подсказки — тестовый профиль" },
  { id: 900_005, channelTitle: "Гороскоп на сегодня — тестовый профиль" },
] as const;

const SIGNS = [
  "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
  "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы",
] as const;

function detectSign(...values: string[]): string | null {
  const content = values.join(" ").toLocaleLowerCase("ru-RU");
  return SIGNS.find((sign) => content.includes(sign.toLocaleLowerCase("ru-RU"))) || null;
}

async function main(): Promise<void> {
  const selectedRows = await db.select({
    id: youtubeConnectionsTable.id,
    channelTitle: youtubeConnectionsTable.channelTitle,
  }).from(telegramHoroscopeChannelsTable)
    .innerJoin(
      youtubeConnectionsTable,
      eq(telegramHoroscopeChannelsTable.connectionId, youtubeConnectionsTable.id),
    );
  const selectedById = new Map<number, { id: number; channelTitle: string | null }>();
  for (const row of selectedRows) selectedById.set(row.id, row);
  const actualConnections = [...selectedById.values()].slice(0, 5);
  const useActualChannels = actualConnections.length >= 5;
  const connections = useActualChannels ? actualConnections : [...SAMPLE_CONNECTIONS];

  const historyRows = await db.select().from(horoscopeContentHistoryTable)
    .orderBy(desc(horoscopeContentHistoryTable.createdAt))
    .limit(120);
  const history: HoroscopePlanningHistoryItem[] = historyRows.map((row) => ({
    connection_id: row.connectionId,
    channel_name: row.channelTitle,
    zodiac_sign: detectSign(row.topic, row.idea, row.hook, row.title),
    topic: row.topic,
    idea: row.idea,
    format: row.format,
    hook: row.hook,
    title: row.title,
    created_at: row.createdAt.toISOString(),
  }));
  const historySummary = history.map((entry) => [
    entry.channel_name,
    entry.zodiac_sign || "знак не указан",
    entry.topic,
    entry.idea,
    entry.format,
    entry.hook,
    entry.title,
  ].join(" | "));

  const currentContext = createHoroscopeCurrentContext();
  const profiles = connections.map((connection) => ({
    connection,
    config: buildHoroscopeChannelConfig(connection),
  }));
  const plan = await generateHoroscopeContentPlan({
    mode: "daily",
    parentTopic: null,
    currentContext,
    channels: profiles.map(({ connection, config }) => ({
      connectionId: connection.id,
      channelName: config.channel_name,
      niche: config.niche,
      tone: config.tone,
      topics: config.topics,
      formats: config.formats,
      hookStyle: config.hook_style,
      targetAudience: config.target_audience,
    })),
    history,
  });

  const packages = [];
  for (const { connection, config } of profiles) {
    const planItem = plan.items.find((item) => item.connection_id === connection.id);
    if (!planItem) throw new Error(`Content Plan omitted ${config.channel_name}`);
    const content = await generateHoroscopeContent({
      topic: "Гороскоп на сегодня",
      config,
      recentContent: historySummary,
      planItem,
      currentContext,
    });
    packages.push({
      channel: config.channel_name,
      channel_profile: {
        niche: config.niche,
        tone_of_voice: config.tone,
        hook_style: config.hook_style,
        target_audience: config.target_audience,
        three_formats: config.formats,
      },
      plan: {
        format: planItem.format,
        zodiac: planItem.zodiac_sign,
        topic: planItem.topic,
        subtopic: planItem.subtopic,
        angle: planItem.angle,
        hook: planItem.hook,
        emotional_tone: planItem.emotional_tone,
        forecast_date: planItem.forecast_date,
      },
      seo: {
        title_variants: content.titleVariants,
        selected_title: content.title,
        description: content.description,
        keywords: content.keywords,
        tags: content.tags,
        hashtags: content.hashtags,
      },
      mandatory_opening_verified: content.script.scenes[0]?.voice_text.startsWith(
        `Вы нашли это видео ${currentContext.forecast_date}, и это не просто так…`,
      ) || false,
      script: content.script,
    });
  }

  const output = {
    generated_at: new Date().toISOString(),
    source_mode: useActualChannels
      ? "five_configured_selected_channels"
      : `sample_channel_profiles_because_only_${actualConnections.length}_configured_selected_channels_were_available`,
    current_context: currentContext,
    global_plan_created_before_scripts: true,
    plan_analysis: {
      locked_parameters: plan.locked_parameters,
      flexible_parameters: plan.flexible_parameters,
      expandable_parameters: plan.expandable_parameters,
    },
    packages,
  };
  const outputDirectory = join(process.cwd(), "test-output");
  const outputPath = join(outputDirectory, "horoscope-five-channel-sample.json");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    output_path: outputPath,
    source_mode: output.source_mode,
    package_count: packages.length,
  }));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});