import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createFinancialTopicPlan } from "./src/lib/financial-topic-engine";

const topics = [
  { slug: "01-bonds", title: "Что такое облигация?" },
  { slug: "02-stocks", title: "Что такое акция?" },
  { slug: "03-mutual-funds", title: "Что такое паевой фонд?" },
  { slug: "04-dividends", title: "Что такое дивиденды?" },
  { slug: "05-compound-interest", title: "Что такое сложный процент?" },
];

const outputDir = resolve(process.cwd(), "../../attached_assets/financial-short-test-renders");
await mkdir(outputDir, { recursive: true });
const plans = [];

for (const [index, item] of topics.entries()) {
  console.log(`[PLAN ${index + 1}/${topics.length}] ${item.title}`);
  const plan = await createFinancialTopicPlan(item.title);
  const moments = plan.beats.flatMap((beat) => beat.visualMoments ?? []);
  const kinds = [...new Set(moments.map((moment) => moment.kind))];
  const positions = [...new Set(plan.beats.map((beat) => beat.composition ?? "center"))];
  const signature = plan.beats
    .map((beat) => (beat.visualMoments ?? []).map((moment) => moment.kind).join(","))
    .join("|");
  console.log(JSON.stringify({
    title: item.title,
    concept: plan.visualConcept,
    template: plan.templateId,
    scenes: plan.beats.length,
    moments: moments.length,
    kinds,
    positions,
    signature,
  }));
  plans.push({ ...item, plan, signature });
  if (index < topics.length - 1) await new Promise((resolveDelay) => setTimeout(resolveDelay, 900));
}

const planPath = resolve(outputDir, "plans.json");
await writeFile(planPath, JSON.stringify(plans, null, 2), "utf8");
console.log(`[SAVED] ${planPath}`);