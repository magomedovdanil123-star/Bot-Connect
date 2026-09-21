import assert from "node:assert/strict";
import test from "node:test";
import {
  generateHoroscopeContentPlan,
  type HoroscopeCurrentContext,
} from "./script-generator";

const context: HoroscopeCurrentContext = {
  current_date: "понедельник, 21 сентября 2026 г.",
  current_day: "понедельник",
  current_month: "сентябрь",
  current_year: "2026",
  current_time: "12:00",
  current_timezone: "Asia/Novosibirsk",
  forecast_date: "21.09.2026",
};

const signs = [
  "Овен", "Телец", "Близнецы", "Рак", "Лев", "Дева",
  "Весы", "Скорпион", "Стрелец", "Козерог", "Водолей", "Рыбы",
] as const;

const concepts = [
  "маяк", "мост", "ключ", "компас", "источник", "вершина",
  "окно", "письмо", "зеркало", "сад", "берег", "звезда",
  "колокол", "дорога", "книга", "фонарь", "река", "порог",
] as const;

function channels(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    connectionId: 1_000 + index,
    channelName: `Канал ${index + 1}`,
    niche: `прогноз направления ${index + 1}`,
    tone: "ясный",
    topics: [`тема ${index + 1}`],
    formats: [`Формат ${index + 1}`],
    hookStyle: "прямой",
    targetAudience: "зрители гороскопов",
  }));
}

function validPlan(channelList: ReturnType<typeof channels>): string {
  return JSON.stringify({
    locked_parameters: [],
    flexible_parameters: ["знак", "тема"],
    expandable_parameters: ["совет"],
    items: channelList.map((channel, index) => {
      const concept = concepts[index % concepts.length]!;
      return {
      connection_id: channel.connectionId,
      channel_name: channel.channelName,
      forecast_date: context.forecast_date,
      forecast_text: `${signs[index % signs.length]}, образ «${concept}» поможет заметить полезную возможность.`,
      second_forecast_text: `Совет про ${concept}: проверьте детали перед решением.`,
      zodiac_sign: signs[index % signs.length],
      topic: concept,
      subtopic: `подсказка через ${concept}`,
      format: channel.formats[0],
      angle: `как распознать ${concept}`,
      hook: `${concept}: сигнал, который стоит заметить`,
      story_outline: `${concept} открывает прогноз и практический совет`,
      emotional_tone: "спокойный",
      };
    }),
  });
}

function observedOvergeneratedPlanFixture(channelList: ReturnType<typeof channels>): string {
  const base = JSON.parse(validPlan(channelList)) as {
    locked_parameters: string[];
    flexible_parameters: string[];
    expandable_parameters: string[];
    items: Array<Record<string, unknown> & { zodiac_sign: string }>;
  };
  const items = base.items.flatMap((item, channelIndex) =>
    Array.from({ length: channelIndex < 4 ? 5 : 4 }, (_, candidateIndex) => ({
      ...item,
      zodiac_sign: signs[(channelIndex + candidateIndex) % signs.length],
    })),
  );
  return JSON.stringify({ ...base, items });
}

function input(channelList: ReturnType<typeof channels>) {
  return {
    mode: "daily" as const,
    parentTopic: null,
    currentContext: context,
    channels: channelList,
    history: [],
  };
}

test("repairs an empty items response instead of surfacing Zod min1", async () => {
  const selected = channels(3);
  const responses = [
    JSON.stringify({
      locked_parameters: [],
      flexible_parameters: [],
      expandable_parameters: [],
      items: [],
    }),
    validPlan(selected),
  ];
  let calls = 0;
  const plan = await generateHoroscopeContentPlan(
    input(selected),
    async () => responses[Math.min(calls++, responses.length - 1)]!,
  );
  assert.equal(calls, 2);
  assert.deepEqual(plan.items.map((item) => item.connection_id), selected.map((item) => item.connectionId));
});

test("repairs malformed non-JSON provider output", async () => {
  const selected = channels(2);
  const responses = ["ответ без JSON", validPlan(selected)];
  let calls = 0;
  const plan = await generateHoroscopeContentPlan(
    input(selected),
    async () => responses[Math.min(calls++, responses.length - 1)]!,
  );
  assert.equal(calls, 2);
  assert.equal(plan.items.length, 2);
});

test("requests and validates coverage for every selected channel", async () => {
  const selected = channels(17);
  let prompt = "";
  let requestedMaxTokens = 0;
  const plan = await generateHoroscopeContentPlan(input(selected), async (messages, maxTokens) => {
    prompt = messages.map((message) => message.content).join("\n");
    requestedMaxTokens = maxTokens ?? 0;
    return validPlan(selected);
  });
  assert.equal(plan.items.length, selected.length);
  assert.deepEqual(new Set(plan.items.map((item) => item.connection_id)), new Set(selected.map((item) => item.connectionId)));
  assert.match(prompt, new RegExp(String(selected.at(-1)!.connectionId)));
  assert.equal(requestedMaxTokens, 24_000);
});

test("normalizes observed overgenerated candidate shape into one balanced item per channel", async () => {
  const selected = channels(15);
  const fixture = observedOvergeneratedPlanFixture(selected);
  assert.equal((JSON.parse(fixture) as { items: unknown[] }).items.length, 64);
  const plan = await generateHoroscopeContentPlan(input(selected), async () => fixture);
  assert.equal(plan.items.length, 15);
  const signCounts = new Map<string, number>();
  for (const item of plan.items) {
    signCounts.set(item.zodiac_sign, (signCounts.get(item.zodiac_sign) || 0) + 1);
  }
  assert.ok(Math.max(...signCounts.values()) <= 3);
});

test("merges observed partial repair shape with omitted story_outline", async () => {
  const selected = channels(15);
  const full = JSON.parse(validPlan(selected)) as {
    locked_parameters: string[];
    flexible_parameters: string[];
    expandable_parameters: string[];
    items: Array<Record<string, unknown>>;
  };
  const firstResponse = JSON.stringify({ ...full, items: full.items.slice(0, 12) });
  const repairedItems = full.items.slice(12).map(({ story_outline: _omitted, ...item }) => item);
  const secondResponse = JSON.stringify({ ...full, items: repairedItems });
  const prompts: string[] = [];
  let calls = 0;
  const plan = await generateHoroscopeContentPlan(input(selected), async (messages) => {
    prompts.push(messages.at(-1)?.content || "");
    return calls++ === 0 ? firstResponse : secondResponse;
  });
  assert.equal(calls, 2);
  assert.equal(plan.items.length, 15);
  assert.match(prompts[1]!, /1012, 1013, 1014/);
  assert.ok(plan.items.slice(12).every((item) => item.story_outline.includes("→")));
});

test("automatically changes a sign repeated across the last three publications", async () => {
  const selected = channels(1);
  const repeatedHistory = Array.from({ length: 3 }, (_, index) => ({
    connection_id: selected[0]!.connectionId,
    channel_name: selected[0]!.channelName,
    zodiac_sign: "Рыбы",
    topic: `прошлая тема ${index}`,
    idea: `прошлая идея ${index}`,
    format: selected[0]!.formats[0]!,
    hook: `прошлый hook ${index}`,
    title: `прошлый заголовок ${index}`,
    created_at: `2026-09-${String(21 - index).padStart(2, "0")}T10:00:00.000Z`,
  }));
  const rejected = JSON.parse(validPlan(selected)) as {
    items: Array<Record<string, unknown>>;
  };
  rejected.items[0]!.zodiac_sign = "Рыбы";
  let calls = 0;
  const plan = await generateHoroscopeContentPlan(
    { ...input(selected), history: repeatedHistory },
    async () => {
      calls += 1;
      return JSON.stringify(rejected);
    },
  );
  assert.equal(calls, 1);
  assert.equal(plan.items[0]!.zodiac_sign, "Овен");
});

test("translates common planner labels before checking Russian content", async () => {
  const selected = channels(1);
  const candidate = JSON.parse(validPlan(selected)) as {
    items: Array<Record<string, string>>;
  };
  const item = candidate.items[0]!;
  item.topic = "topic: money";
  item.subtopic = "forecast: unexpected chance";
  item.angle = "angle: warning";
  item.hook = "hook: mystical signal";
  item.story_outline = "story_outline: today";
  item.emotional_tone = "emotional, dynamic";
  item.forecast_text = "forecast: money signal";
  item.second_forecast_text = "second_forecast_text: love";
  const plan = await generateHoroscopeContentPlan(input(selected), async () => JSON.stringify(candidate));
  const text = JSON.stringify(plan.items[0]);
  assert.doesNotMatch(text, /[a-z]{3,}/iu);
  assert.match(text, /зацепка|прогноз|деньги/iu);
});

test("fails explicitly after repair exhaustion without an empty fallback plan", async () => {
  const selected = channels(4);
  let calls = 0;
  await assert.rejects(
    generateHoroscopeContentPlan(input(selected), async () => {
      calls += 1;
      return JSON.stringify({
        locked_parameters: [],
        flexible_parameters: [],
        expandable_parameters: [],
        items: [],
      });
    }),
    /AI Content Planner returned an invalid plan: items не содержит ни одного валидного пункта/,
  );
  assert.equal(calls, 5);
});