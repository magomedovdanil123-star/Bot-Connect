import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderFinancialTopicShort } from "./src/lib/financial-short-renderer";

type TestPlan = {
  slug: string;
  title: string;
  plan: Parameters<typeof renderFinancialTopicShort>[0];
};

const outputDir = resolve(process.cwd(), "../../attached_assets/financial-short-test-renders");
const plans = JSON.parse(await readFile(resolve(outputDir, "plans.json"), "utf8")) as TestPlan[];
const failures: string[] = [];

for (const [index, item] of plans.entries()) {
  console.log(`[RENDER ${index + 1}/${plans.length}] ${item.title}`);
  try {
    const result = await renderFinancialTopicShort(item.plan);
    const filePath = resolve(outputDir, `${item.slug}.mp4`);
    await writeFile(filePath, result.buffer);
    console.log(JSON.stringify({
      title: item.title,
      path: filePath,
      durationSeconds: Math.round(result.durationMs / 1_000),
      sceneCount: result.sceneCount,
      bytes: result.buffer.length,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${item.title}: ${message}`);
    console.error(`[FAILED] ${item.title}: ${message}`);
  }
}

if (failures.length) throw new Error(failures.join("\n"));
console.log("[DONE] All five local renders completed; no Telegram delivery was attempted.");