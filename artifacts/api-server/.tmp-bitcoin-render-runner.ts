import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderFinancialTopicShortWithAudioTrack } from "./src/lib/financial-short-renderer";

type RenderPlan = Parameters<typeof renderFinancialTopicShortWithAudioTrack>[0];

const outputDir = resolve(process.cwd(), "../../attached_assets/bitcoin-short-qa");
const planPath = resolve(outputDir, "bitcoin-plan.json");
const sourceVideoPath = resolve(outputDir, "bitcoin-short.mp4");
const finalVideoPath = resolve(outputDir, "bitcoin-short-final.mp4");
const plan = JSON.parse(await readFile(planPath, "utf8")) as RenderPlan;
plan.mainTitle = "ПОЧЕМУ У BITCOIN ЕСТЬ ЛИМИТ?";
plan.title = "Почему у Bitcoin есть лимит";
plan.visualTheme = "premium_creator";
plan.visualAssets = {};
const visualKinds = [
  ["concept_card", "metric", "metric"],
  ["money_flow", "money_flow", "document"],
  ["timeline", "timeline", "metric"],
  ["timeline", "comparison", "comparison"],
  ["metric", "document", "concept_card"],
  ["document", "document", "concept_card"],
] as const;
const visualLabels = [
  ["У БИТКОИНА ЕСТЬ", "ПРЕДЕЛ ВЫПУСКА", "21 МЛН BTC"],
  ["НОВЫЕ BTC", "НАГРАДА ЗА БЛОК", "ПРАВИЛО ПРОТОКОЛА"],
  ["РАЗ В ЧЕТЫРЕ ГОДА", "ХАЛВИНГ", "НАГРАДА ВДВОЕ"],
  ["ГРАФИК ВЫПУСКА", "ВЫПУСК ≠ ЦЕНА", "СПРОС МЕНЯЕТСЯ"],
  ["ЛИМИТ ПО ПРАВИЛАМ", "КОМПАНИЯ И ПРОТОКОЛ", "ПРАВИЛА ПРОТОКОЛА"],
  ["НОВАЯ ВЕРСИЯ", "УЧАСТНИКИ СЕТИ", "РЕДКОСТЬ ≠ ГАРАНТИЯ"],
] as const;
plan.beats = plan.beats.map((beat, sceneIndex) => ({
  ...beat,
  soundEffect: "none",
  visualMoments: (beat.visualMoments ?? []).map((moment, momentIndex) => ({
    ...moment,
    kind: visualKinds[sceneIndex]?.[momentIndex] ?? moment.kind,
    presentationStyle: "card",
    assetId: undefined,
    label: visualLabels[sceneIndex]?.[momentIndex] ?? moment.label,
    ...(sceneIndex === 1 && momentIndex === 0 ? { sourceLabel: "БЛОК", targetLabel: "НОВЫЕ BTC" } : {}),
    ...(sceneIndex === 1 && momentIndex === 1 ? { sourceLabel: "БЛОК", targetLabel: "НАГРАДА" } : {}),
    ...(sceneIndex === 3 && momentIndex === 1 ? {
      sourceLabel: "ВЫПУСК",
      targetLabel: "ЦЕНА BTC",
      value: "ПО ПРАВИЛАМ",
      detail: "МЕНЯЕТСЯ СПРОСОМ",
    } : {}),
    ...(sceneIndex === 3 && momentIndex === 2 ? {
      sourceLabel: "ПРОТОКОЛ",
      targetLabel: "РЫНОК",
      value: "ЗАДАЁТ ВЫПУСК",
      detail: "СПРОС МЕНЯЕТ ЦЕНУ",
    } : {}),
    ...(sceneIndex === 4 && momentIndex === 2 ? {
      value: "BTC",
      detail: "ЭМИССИЮ ЗАДАЁТ ПРОТОКОЛ",
    } : {}),
    ...(sceneIndex === 5 && momentIndex === 2 ? {
      value: "ФАКТ",
      detail: "ЦЕНА МОЖЕТ НЕ ВЫРАСТИ",
    } : {}),
  })),
}));

const sceneStartTimesMs = [4_293, 10_173, 15_584, 21_231, 26_382];
const rendered = await renderFinancialTopicShortWithAudioTrack(
  plan,
  sourceVideoPath,
  sceneStartTimesMs,
);
await writeFile(finalVideoPath, rendered.buffer);
console.log(JSON.stringify({
  finalVideoPath,
  durationMs: rendered.durationMs,
  sceneCount: rendered.sceneCount,
}, null, 2));