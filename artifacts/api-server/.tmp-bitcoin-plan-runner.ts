import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createFinancialTopicPlan } from "./src/lib/financial-topic-engine";

const outputDir = resolve(process.cwd(), "../../attached_assets/bitcoin-short-qa");
await mkdir(outputDir, { recursive: true });

const topic = "Почему у Bitcoin ограничено предложение?";
const plan = await createFinancialTopicPlan(topic, "", { targetDurationSeconds: 33 });
const beats = plan.beats;
const moments = beats.flatMap((beat) => beat.visualMoments ?? []);
const poseChanges = beats.slice(1).filter(
  (beat, index) => beat.presenterPose !== beats[index]!.presenterPose,
).length;
const movingCameraScenes = beats.filter((beat) => beat.cameraAction && beat.cameraAction !== "locked").length;
const output = {
  topic: plan.topic,
  title: plan.title,
  concept: plan.visualConcept,
  targetDurationMs: plan.targetDurationMs,
  scenes: beats.length,
  spokenWords: plan.script.match(/[\p{L}\p{N}]+/gu)?.length ?? 0,
  moments: moments.length,
  microBeats: moments.reduce((sum, moment) => sum + (moment.microBeats?.length ?? 0), 0),
  poseChanges,
  movingCameraScenes,
  script: plan.script,
  scenesDetail: beats.map((beat) => ({
    from: beat.from,
    to: beat.to,
    voiceText: beat.voiceText,
    presenterPose: beat.presenterPose,
    cameraAction: beat.cameraAction,
    visualMoments: (beat.visualMoments ?? []).map((moment) => ({
      kind: moment.kind,
      voiceExcerpt: moment.voiceExcerpt,
      microBeats: moment.microBeats,
    })),
  })),
};
console.log(JSON.stringify(output, null, 2));
await writeFile(resolve(outputDir, "bitcoin-plan.json"), JSON.stringify(plan), "utf8");
console.log(`[PLAN SAVED] ${resolve(outputDir, "bitcoin-plan.json")}`);