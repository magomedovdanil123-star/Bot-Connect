import assert from "node:assert/strict";
import test from "node:test";
import { buildChainlinkEditorialMotionGraphics } from "./chainlink-editorial-motion";
import {
  FINANCE_LONG_COIN_OVERVIEW_VECTOR_IDENTITY_KEY,
  FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE,
  FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY,
  getFinanceLongCoinOverviewVectorIdentity,
  isFinanceLongCoinOverviewVectorProfile,
  parseFinanceLongCoinOverviewVectorBlueprint,
  withFinanceLongCoinOverviewVectorProfile,
} from "./finance-long-coin-overview-vector";
import { buildFinanceLongStoryboardSvg } from "./finance-long-style";

const identity = { name: "Ripple", symbol: "XRP" };

test("coin overview vector profile preserves narration and uses labels sourced from it", () => {
  const source = {
    title: "Авторский обзор XRP",
    duration_seconds: 18,
    scenes: [{
      scene_number: 1,
      duration_seconds: 18,
      voice_text: "История XRP начинается с запуска проекта и продолжается этапами развития.",
      visual_description: "Нейтральная техническая схема.",
    }],
  };

  const result = withFinanceLongCoinOverviewVectorProfile(source, identity);
  const scene = result.scenes[0]!;
  const blueprint = parseFinanceLongCoinOverviewVectorBlueprint(scene.visual_description!);

  assert.equal(result.duration_seconds, source.duration_seconds);
  assert.equal(scene.voice_text, source.scenes[0]!.voice_text);
  assert.equal(blueprint?.layout, "timeline");
  assert.equal(blueprint?.coinLabel, "XRP · RIPPLE");
  assert.ok(blueprint?.title.includes("XRP"));
  assert.equal(result[FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY], FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE);
  assert.deepEqual(result[FINANCE_LONG_COIN_OVERVIEW_VECTOR_IDENTITY_KEY], identity);
  assert.ok(isFinanceLongCoinOverviewVectorProfile(result));
  assert.deepEqual(getFinanceLongCoinOverviewVectorIdentity(result), identity);
  assert.doesNotMatch(JSON.stringify(blueprint), /CHAINLINK|ETHEREUM|SOLANA|LINK/u);
});

test("scene layouts follow the script topic and avoid repeating adjacent compositions", () => {
  const source = {
    title: "XRP",
    duration_seconds: 36,
    scenes: [
      {
        scene_number: 1,
        duration_seconds: 12,
        voice_text: "История запуска началась в 2020 году и продолжилась позже.",
        visual_description: "Схема возможных угроз.",
      },
      {
        scene_number: 2,
        duration_seconds: 12,
        voice_text: "Главный риск — потеря доступа, поэтому проверяйте безопасность.",
        visual_description: "Сравнение нескольких вариантов.",
      },
      {
        scene_number: 3,
        duration_seconds: 12,
        voice_text: "Сравним два варианта и их отличие для пользователя.",
        visual_description: "Узлы инфраструктуры и сети.",
      },
    ],
  };

  const result = withFinanceLongCoinOverviewVectorProfile(source, identity);
  const layouts = result.scenes.map((scene) =>
    parseFinanceLongCoinOverviewVectorBlueprint(scene.visual_description!)?.layout,
  );

  assert.deepEqual(layouts, ["timeline", "risk-map", "compare"]);
  assert.notEqual(layouts[0], layouts[1]);
  assert.notEqual(layouts[1], layouts[2]);
});

test("vector motion filter renders generic coin diagrams without Chainlink-specific labels", () => {
  const script = withFinanceLongCoinOverviewVectorProfile({
    title: "Обзор Ripple",
    duration_seconds: 10,
    scenes: [{
      scene_number: 1,
      duration_seconds: 10,
      voice_text: "XRP связывает платёжные потоки и помогает обсуждать переводы.",
      visual_description: "Поток между системами.",
    }],
  }, identity);
  const scene = script.scenes[0]!;
  const filter = buildChainlinkEditorialMotionGraphics({
    width: 1920,
    height: 1080,
    frameRate: 60,
    voices: [{
      sceneId: 1,
      startTime: 0,
      endTime: 10_000,
      text: scene.voice_text,
    }],
    sceneVisualDescriptions: [{
      sceneId: 1,
      description: scene.visual_description!,
    }],
    durationMs: 10_000,
    chunkStartMs: 0,
    chunkEndMs: 10_000,
  });

  assert.match(filter, /XRP/);
  assert.match(filter, /ПЛАТ/u);
  assert.doesNotMatch(filter, /CHAINLINK|ETHEREUM|SOLANA|LINK/u);
});

test("the storyboard preview stays image-free, dark, and free of full-script subtitles", () => {
  const voiceText = "XRP supports payment transfers across systems while users compare different options and risks.";
  const script = withFinanceLongCoinOverviewVectorProfile({
    title: "Авторский обзор Ripple",
    duration_seconds: 12,
    scenes: [{
      scene_number: 1,
      duration_seconds: 12,
      voice_text: voiceText,
      visual_description: "Поток между платёжными системами.",
    }],
  }, identity);
  const svg = buildFinanceLongStoryboardSvg({
    title: script.title,
    scenes: script.scenes,
    themeIndex: 0,
    motionDesignProfile: "coin-overview-vector-v1",
  });

  assert.match(svg, /#05090f/u);
  assert.match(svg, /#18c7e8/u);
  assert.match(svg, /COIN REVIEW · VECTOR/u);
  assert.doesNotMatch(svg, /<image\b|data:image/u);
  assert.ok(!svg.includes(voiceText));
});