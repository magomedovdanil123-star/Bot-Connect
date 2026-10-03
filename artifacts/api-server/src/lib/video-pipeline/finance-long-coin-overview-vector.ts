export const FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY =
  "finance_long_coin_overview_vector_profile";
export const FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE = "dark-editorial-vector-v1";
export const FINANCE_LONG_COIN_OVERVIEW_VECTOR_IDENTITY_KEY =
  "finance_long_coin_overview_vector_identity";
export const FINANCE_LONG_COIN_OVERVIEW_VECTOR_BLUEPRINT_PREFIX =
  "FINANCE_LONG_COIN_VECTOR_V1:";

export type FinanceLongCoinOverviewVectorIdentity = {
  name: string;
  symbol: string;
};

export type FinanceLongCoinOverviewVectorLayout =
  | "coin-summary"
  | "flow-map"
  | "timeline"
  | "compare"
  | "node-network"
  | "layer-stack"
  | "risk-map"
  | "evidence-grid";

export type FinanceLongCoinOverviewVectorBlueprint = {
  layout: FinanceLongCoinOverviewVectorLayout;
  title: string;
  steps: string[];
  labels: string[];
  coinLabel: string;
};

const layouts: FinanceLongCoinOverviewVectorLayout[] = [
  "coin-summary",
  "flow-map",
  "timeline",
  "compare",
  "node-network",
  "layer-stack",
  "risk-map",
  "evidence-grid",
];

const fallbackLabels = ["КОНТЕКСТ", "ДАННЫЕ", "СВЯЗЬ", "ПРОВЕРКА", "ВЫВОД"];
const maxLabelLength = 28;

function shortLabel(value: string): string {
  const normalized = value
    .replace(/[\u0000-\u001f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (normalized.length <= maxLabelLength) {
    return normalized.toLocaleUpperCase("ru-RU");
  }
  return `${normalized.slice(0, maxLabelLength - 1).trimEnd()}…`
    .toLocaleUpperCase("ru-RU");
}

function sourcePhrases(value: string): string[] {
  const words = value.match(/[\p{L}\p{N}$%]+(?:[’'-][\p{L}\p{N}]+)*/gu) ?? [];
  const phrases: string[] = [];
  for (let index = 0; index < words.length; index += 3) {
    const phrase = shortLabel(words.slice(index, index + 3).join(" "));
    if (phrase && !phrases.includes(phrase)) phrases.push(phrase);
  }
  return phrases;
}

function classifyLayout(
  text: string,
  sceneIndex: number,
  previousLayout?: FinanceLongCoinOverviewVectorLayout,
): FinanceLongCoinOverviewVectorLayout {
  const lower = text.toLocaleLowerCase("ru-RU");
  let preferred: FinanceLongCoinOverviewVectorLayout | null = null;
  if (/риск|волатиль|уязв|безопас|регуляц|ограничен|потер|падени/iu.test(lower)) {
    preferred = "risk-map";
  } else if (/сравн|конкурент|альтернатив|в отличие|против|разниц/iu.test(lower)) {
    preferred = "compare";
  } else if (/истори|запуск|основан|в \d{4}|в прошлом|год|этап|сначала/iu.test(lower)) {
    preferred = "timeline";
  } else if (/сеть|блокчейн|узел|межсет|цепочк|инфраструктур/iu.test(lower)) {
    preferred = "node-network";
  } else if (/передач|транзакц|перевод|комисси|использ|оплат|обмен/iu.test(lower)) {
    preferred = "flow-map";
  } else if (/данн|источник|подтвержд|статист|исследован|отч[её]т|провер/iu.test(lower)) {
    preferred = "evidence-grid";
  } else if (/токеномик|предложен|эмисс|стейкинг|разработ|платформ|приложен/iu.test(lower)) {
    preferred = "layer-stack";
  }

  const fallback = layouts[sceneIndex % layouts.length]!;
  const candidate = preferred ?? fallback;
  if (candidate !== previousLayout) return candidate;
  return layouts.find((layout) => layout !== previousLayout && layout !== candidate)
    ?? candidate;
}

function normalizedIdentity(
  identity: FinanceLongCoinOverviewVectorIdentity,
): FinanceLongCoinOverviewVectorIdentity {
  const name = identity.name.trim().replace(/\s+/gu, " ").slice(0, 48);
  const symbol = identity.symbol.trim().replace(/^\$/u, "").toLocaleUpperCase("en-US").slice(0, 12);
  if (!name || !symbol) throw new Error("A verified coin name and symbol are required for the vector profile");
  return { name, symbol };
}

export function formatFinanceLongCoinOverviewVectorLabel(
  identity: FinanceLongCoinOverviewVectorIdentity,
): string {
  const clean = normalizedIdentity(identity);
  return shortLabel(`${clean.symbol} · ${clean.name}`);
}

export function serializeFinanceLongCoinOverviewVectorBlueprint(
  blueprint: FinanceLongCoinOverviewVectorBlueprint,
): string {
  return `${FINANCE_LONG_COIN_OVERVIEW_VECTOR_BLUEPRINT_PREFIX}${JSON.stringify(blueprint)}`;
}

export function parseFinanceLongCoinOverviewVectorBlueprint(
  description: string,
): FinanceLongCoinOverviewVectorBlueprint | null {
  if (!description.startsWith(FINANCE_LONG_COIN_OVERVIEW_VECTOR_BLUEPRINT_PREFIX)) return null;
  try {
    const candidate = JSON.parse(
      description.slice(FINANCE_LONG_COIN_OVERVIEW_VECTOR_BLUEPRINT_PREFIX.length),
    ) as Partial<FinanceLongCoinOverviewVectorBlueprint>;
    if (
      typeof candidate.layout !== "string"
      || !layouts.includes(candidate.layout as FinanceLongCoinOverviewVectorLayout)
      || typeof candidate.title !== "string"
      || typeof candidate.coinLabel !== "string"
      || !Array.isArray(candidate.steps)
      || !candidate.steps.every((step) => typeof step === "string")
      || candidate.steps.length !== 4
      || !Array.isArray(candidate.labels)
      || !candidate.labels.every((label) => typeof label === "string")
      || candidate.labels.length !== 5
      || candidate.title.length > maxLabelLength
      || candidate.coinLabel.length > maxLabelLength
      || candidate.steps.some((step) => step.length > maxLabelLength)
      || candidate.labels.some((label) => label.length > maxLabelLength)
    ) {
      throw new Error("Invalid Finance Long coin-vector blueprint payload");
    }
    return candidate as FinanceLongCoinOverviewVectorBlueprint;
  } catch (error) {
    throw new Error(
      `Invalid Finance Long coin-vector blueprint: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function withFinanceLongCoinOverviewVectorProfile<
  T extends {
    scenes: Array<{
      scene_number: number;
      voice_text: string;
      visual_description?: string;
    }>;
  },
>(
  script: T,
  identity: FinanceLongCoinOverviewVectorIdentity,
): T & Record<string, unknown> {
  const cleanIdentity = normalizedIdentity(identity);
  const coinLabel = formatFinanceLongCoinOverviewVectorLabel(cleanIdentity);
  let previousLayout: FinanceLongCoinOverviewVectorLayout | undefined;
  const scenes = script.scenes.map((scene, index) => {
    const source = scene.voice_text.trim();
    const phrases = sourcePhrases(source);
    const fallback = fallbackLabels[index % fallbackLabels.length]!;
    const labels = Array.from({ length: 5 }, (_, labelIndex) =>
      phrases[labelIndex] || fallbackLabels[(index + labelIndex) % fallbackLabels.length] || fallback,
    );
    const steps = Array.from({ length: 4 }, (_, stepIndex) =>
      phrases[stepIndex] || fallbackLabels[(index + stepIndex) % fallbackLabels.length] || fallback,
    );
    const layout = classifyLayout(source, index, previousLayout);
    previousLayout = layout;
    const title = index === 0
      ? `${coinLabel} · ОБЗОР`
      : index === script.scenes.length - 1
        ? `${coinLabel} · ИТОГ`
        : phrases[0] || `СЦЕНА ${String(scene.scene_number).padStart(2, "0")}`;
    const blueprint: FinanceLongCoinOverviewVectorBlueprint = {
      layout,
      title: shortLabel(title),
      steps,
      labels,
      coinLabel,
    };
    return {
      ...scene,
      visual_description: serializeFinanceLongCoinOverviewVectorBlueprint(blueprint),
    };
  });

  return {
    ...script,
    scenes,
    [FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY]: FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE,
    [FINANCE_LONG_COIN_OVERVIEW_VECTOR_IDENTITY_KEY]: cleanIdentity,
  } as T & Record<string, unknown>;
}

export function isFinanceLongCoinOverviewVectorProfile(metadata: unknown): boolean {
  return Boolean(
    metadata
    && typeof metadata === "object"
    && (metadata as Record<string, unknown>)[FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE_KEY]
      === FINANCE_LONG_COIN_OVERVIEW_VECTOR_PROFILE,
  );
}

export function getFinanceLongCoinOverviewVectorIdentity(
  metadata: unknown,
): FinanceLongCoinOverviewVectorIdentity | null {
  if (!metadata || typeof metadata !== "object") return null;
  const identity = (metadata as Record<string, unknown>)[FINANCE_LONG_COIN_OVERVIEW_VECTOR_IDENTITY_KEY];
  if (!identity || typeof identity !== "object") return null;
  const candidate = identity as Record<string, unknown>;
  if (typeof candidate.name !== "string" || typeof candidate.symbol !== "string") return null;
  try {
    return normalizedIdentity({ name: candidate.name, symbol: candidate.symbol });
  } catch {
    return null;
  }
}