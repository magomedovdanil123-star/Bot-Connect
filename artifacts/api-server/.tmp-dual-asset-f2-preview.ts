import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createFinancialTopicPlan } from "./src/lib/financial-topic-engine";
import { renderFinancialTopicPreviewFrame } from "./src/lib/financial-short-renderer";

const topic = "Bybit Dual Asset: BTC и валютный риск";
const script = `Ты можешь получать доход на Bitcoin, даже если не знаешь, куда пойдёт цена.

На Bybit есть инструмент Dual Asset — бивалютные инвестиции.

Например, ты выбираешь BTC, сумму и целевую цену.

Если к моменту расчёта Bitcoin не достигает заданной цены — получаешь доход в BTC.

Если достигает — актив конвертируется по заранее установленной цене, а ты получаешь повышенную доходность.

Главное — понимать: это не гарантированный заработок и ты принимаешь валютный риск.

Хочешь разобраться, как это работает на конкретном примере с BTC? Смотри следующие видео.`;

const plan = await createFinancialTopicPlan(topic, "", {
  category: "crypto",
  customScript: script,
  targetDurationSeconds: 30,
  visualTheme: "crypto_f2",
  motionSeed: "visual-check:bybit-dual-asset",
  recentMotionFingerprints: [],
});
const normalizedScript = script.replace(/\s+/gu, " ").trim();
if (plan.script.replace(/\s+/gu, " ").trim() !== normalizedScript) {
  throw new Error("F2 visual plan changed the user's narration.");
}

const durationMs = plan.targetDurationMs;
const sceneStartTimesMs = plan.beats.slice(0, -1)
  .map((beat) => Math.round(beat.to * durationMs));
const outputDir = resolve(process.cwd(), "../../attached_assets/crypto-f2-dual-asset-preview");
await mkdir(outputDir, { recursive: true });

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");
const cards: string[] = [];
for (let index = 0; index < plan.beats.length; index += 1) {
  const beat = plan.beats[index]!;
  const sceneStart = index === 0 ? 0 : sceneStartTimesMs[index - 1]!;
  const sceneEnd = index === plan.beats.length - 1 ? durationMs : sceneStartTimesMs[index]!;
  const timeMs = Math.round((sceneStart + sceneEnd) / 2);
  const svg = renderFinancialTopicPreviewFrame(plan, durationMs, timeMs, sceneStartTimesMs);
  await writeFile(resolve(outputDir, `scene-${String(index + 1).padStart(2, "0")}.svg`), svg, "utf8");
  cards.push(`<article><h2>Сцена ${index + 1}</h2>${svg}<p>${escapeHtml(beat.voiceText ?? beat.subtitle)}</p></article>`);
}

const summary = {
  topic,
  visualTheme: plan.visualTheme,
  targetDurationMs: durationMs,
  scenes: plan.beats.length,
  words: plan.script.match(/[\p{L}\p{N}]+/gu)?.length ?? 0,
  scriptPreservedExactly: true,
  motionFingerprint: plan.cryptoF2MotionFingerprint,
  scenePlans: plan.beats.map((beat) => ({
    voiceText: beat.voiceText,
    transition: beat.transitionIn,
    visualMoments: (beat.visualMoments ?? []).map((moment) => ({
      voiceExcerpt: moment.voiceExcerpt,
      motif: moment.objectMotif,
      action: moment.motionAction,
      entry: moment.enterAnimation,
      exit: moment.exitAnimation,
      microBeats: (moment.microBeats ?? []).map((microBeat) => ({
        cue: microBeat.cueExcerpt,
        action: microBeat.text,
      })),
    })),
  })),
};
await writeFile(resolve(outputDir, "plan-summary.json"), JSON.stringify(summary, null, 2), "utf8");
await writeFile(resolve(outputDir, "preview.html"), `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Крипто Ф2 — Dual Asset</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px; color: #f2ebdd; background: #0b100e; font: 16px/1.5 system-ui, sans-serif; }
    header { max-width: 1400px; margin: 0 auto 24px; }
    h1 { margin: 0 0 6px; font-size: clamp(24px, 4vw, 38px); }
    header p { margin: 0; color: #aeb9b1; }
    main { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; max-width: 1400px; margin: auto; }
    article { overflow: hidden; border: 1px solid #29372f; border-radius: 16px; background: #121916; }
    h2 { margin: 0; padding: 12px 16px 4px; font-size: 16px; color: #9ae8bd; }
    article svg { display: block; width: 100%; height: auto; }
    article p { margin: 0; padding: 12px 16px 16px; color: #d8d9d0; font-size: 14px; }
    @media (max-width: 760px) { body { padding: 16px; } main { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>Крипто Ф2: ${escapeHtml(topic)}</h1>
    <p>Локальный storyboard по пользовательскому сценарию; кадры без озвучки и движения.</p>
  </header>
  <main>${cards.join("\n")}</main>
</body>
</html>`, "utf8");
console.log(JSON.stringify(summary, null, 2));
console.log(`[PREVIEW SAVED] ${outputDir}`);