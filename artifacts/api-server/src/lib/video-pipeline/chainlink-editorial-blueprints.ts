export const CHAINLINK_EDITORIAL_BLUEPRINT_PREFIX = "CHAINLINK_EDITORIAL_V1:";

export type ChainlinkEditorialLayout =
  | "split-ledger"
  | "isolated-network"
  | "oracle-flow"
  | "data-risk"
  | "ccip-bridge"
  | "network-mesh"
  | "ccip-timeline"
  | "asset-tokenization"
  | "link-utility"
  | "staking-abstraction"
  | "reserve-flow"
  | "infrastructure-stack"
  | "competition"
  | "supply"
  | "standard-fork"
  | "scenarios"
  | "investment-thesis"
  | "research-checklist"
  | "story-to-usage"
  | "final-network";

export type ChainlinkEditorialBlueprint = {
  layout: ChainlinkEditorialLayout;
  title: string;
  steps: string[];
  labels: string[];
};

export const CHAINLINK_EDITORIAL_BLUEPRINTS: Record<number, ChainlinkEditorialBlueprint> = {
  1: {
    layout: "split-ledger",
    title: "АКТИВЫ ПЕРЕХОДЯТ В СЕТЬ",
    steps: ["ТРАДИЦИОННЫЕ ФИНАНСЫ", "АКЦИИ И ОБЛИГАЦИИ", "ТОКЕНИЗАЦИЯ", "СЕТЯМ НУЖНЫ ДАННЫЕ"],
    labels: ["АКЦИИ", "ОБЛИГАЦИИ", "ТОКЕНЫ", "БЛОКЧЕЙНЫ"],
  },
  2: {
    layout: "isolated-network",
    title: "БЛОКЧЕЙН НЕ ВИДИТ СНАРУЖИ",
    steps: ["ЗАМКНУТАЯ СЕТЬ", "ВНЕШНИЙ СИГНАЛ", "CHAINLINK", "ТОКЕН LINK"],
    labels: ["СМАРТ-КОНТРАКТ", "ВНЕШНИЕ ДАННЫЕ", "CHAINLINK", "LINK"],
  },
  3: {
    layout: "oracle-flow",
    title: "ОТ ИСТОЧНИКА К КОНТРАКТУ",
    steps: ["ЦЕНЫ СНАРУЖИ", "УЗЛЫ ОРАКУЛОВ", "СВЕРКА ДАННЫХ", "ОТВЕТ В СЕТИ"],
    labels: ["ETH / USD", "ДОЛЛАР", "ЗОЛОТО", "ОРАКУЛЫ", "КОНТРАКТ"],
  },
  4: {
    layout: "data-risk",
    title: "НАДЁЖНОСТЬ ДАННЫХ",
    steps: ["ИСТОЧНИКИ", "НЕЗАВИСИМЫЕ УЗЛЫ", "ПРОВЕРКА", "ЗОНА РИСКА"],
    labels: ["ЦЕНА ETH", "ОРАКУЛЫ", "DEFI", "РИСК"],
  },
  5: {
    layout: "ccip-bridge",
    title: "CCIP — ОБЩАЯ ИНФРАСТРУКТУРА",
    steps: ["ДВЕ СЕТИ", "CCIP", "СООБЩЕНИЕ", "АКТИВ И ДАННЫЕ"],
    labels: ["СЕТЬ A", "CCIP", "СЕТЬ B", "ТОКЕН", "СООБЩЕНИЕ", "ДАННЫЕ"],
  },
  6: {
    layout: "network-mesh",
    title: "КРИПТОРЫНОК РАЗДРОБЛЕН",
    steps: ["ОТДЕЛЬНЫЕ СЕТИ", "ОТДЕЛЬНЫЕ КЛАСТЕРЫ", "ОБЩИЕ СВЯЗИ", "ПЕРЕДАЧА АКТИВОВ"],
    labels: ["ETHEREUM", "SOLANA", "AVALANCHE", "ARBITRUM", "ДРУГИЕ СЕТИ"],
  },
  7: {
    layout: "ccip-timeline",
    title: "ОБНОВЛЕНИЕ CCIP 2.0",
    steps: ["28 СЕНТЯБРЯ 2026", "CCIP 2.0", "БОЛЬШЕ ПРОВЕРОК", "БЫСТРЕЕ ИСПОЛНЕНИЕ"],
    labels: ["28.09.2026", "CCIP 2.0", "ИНСТИТУЦИОНАЛЬНЫЕ СЦЕНАРИИ"],
  },
  8: {
    layout: "asset-tokenization",
    title: "ТОКЕНИЗАЦИЯ РЕАЛЬНЫХ АКТИВОВ",
    steps: ["АКЦИИ И ОБЛИГАЦИИ", "ФОНДЫ И ТОВАРЫ", "ЦИФРОВЫЕ ТОКЕНЫ", "ПЕРЕХОД МЕЖДУ СЕТЯМИ"],
    labels: ["АКЦИИ", "ОБЛИГАЦИИ", "ФОНДЫ", "ТОВАРЫ", "ВАЛЮТЫ"],
  },
  9: {
    layout: "link-utility",
    title: "ГДЕ ЗДЕСЬ LINK",
    steps: ["НАТИВНЫЙ ТОКЕН", "ОПЛАТА СЕРВИСОВ", "ОПЕРАТОРЫ", "ЭКОНОМИЧЕСКАЯ ЗАЩИТА"],
    labels: ["LINK", "СЕРВИСЫ", "ОПЕРАТОРЫ", "БЕЗОПАСНОСТЬ"],
  },
  10: {
    layout: "staking-abstraction",
    title: "STAKING И PAYMENT ABSTRACTION",
    steps: ["LINK В БЛОКИРОВКЕ", "ЭКОНОМИЧЕСКАЯ ГАРАНТИЯ", "ПЛАТЁЖИ В РАЗНЫХ АКТИВАХ", "КОНВЕРТАЦИЯ В LINK"],
    labels: ["STAKING", "LINK", "ПЛАТЁЖ", "КОНВЕРТАЦИЯ"],
  },
  11: {
    layout: "reserve-flow",
    title: "CHAINLINK RESERVE",
    steps: ["ИСПОЛЬЗОВАНИЕ СЕРВИСОВ", "ДОХОД", "РЕЗЕРВ LINK", "ЭКОНОМИЧЕСКИЙ ПОТОК"],
    labels: ["СЕРВИСЫ", "ВНЕДРЕНИЕ", "ДОХОДЫ", "RESERVE"],
  },
  12: {
    layout: "infrastructure-stack",
    title: "НЕ ПРОСТО ОДНА МОНЕТА",
    steps: ["ОРАКУЛЫ", "INTEROPERABILITY", "ДАННЫЕ", "ТОКЕНИЗИРОВАННЫЕ АКТИВЫ", "ПРИЛОЖЕНИЯ"],
    labels: ["ОРАКУЛЫ", "СОВМЕСТИМОСТЬ", "ДАННЫЕ", "АКТИВЫ", "ПРИЛОЖЕНИЯ"],
  },
  13: {
    layout: "competition",
    title: "ИНФРАСТРУКТУРА ≠ ЦЕНА ТОКЕНА",
    steps: ["КОНКУРЕНТЫ", "ОРАКУЛЫ И CCIP", "ИСПОЛЬЗОВАНИЕ", "ЦЕННОСТЬ ДЛЯ LINK"],
    labels: ["CHAINLINK", "ДРУГИЕ ПРОЕКТЫ", "ИСПОЛЬЗОВАНИЕ", "LINK"],
  },
  14: {
    layout: "supply",
    title: "ПРЕДЛОЖЕНИЕ LINK",
    steps: ["МАКСИМАЛЬНОЕ КОЛИЧЕСТВО", "1 МЛРД LINK", "ГОДОВОЙ ВЫПУСК", "ДО 7% В ГОД"],
    labels: ["1 МЛРД LINK", "ДО 7% В ГОД"],
  },
  15: {
    layout: "standard-fork",
    title: "СТАНЕТ ЛИ ЭТО СТАНДАРТОМ?",
    steps: ["ТЕХНОЛОГИЯ", "ШИРОКОЕ ПРИМЕНЕНИЕ", "СТАНДАРТНАЯ ИНФРАСТРУКТУРА", "РАЗВИЛКА"],
    labels: ["ТЕХНОЛОГИЯ", "СТАНДАРТ", "ОГРАНИЧЕННОЕ ПРИМЕНЕНИЕ"],
  },
  16: {
    layout: "scenarios",
    title: "ДВА СЦЕНАРИЯ РАЗВИТИЯ",
    steps: ["МАССОВАЯ ТОКЕНИЗАЦИЯ", "ФИНАНСОВЫЕ ОРГАНИЗАЦИИ", "МЕДЛЕННОЕ РАЗВИТИЕ", "КОНКУРЕНТЫ"],
    labels: ["МАССОВОЕ ПРИМЕНЕНИЕ", "МЕДЛЕННОЕ РАЗВИТИЕ", "КОНКУРЕНТЫ"],
  },
  17: {
    layout: "investment-thesis",
    title: "LINK КАК СТАВКА НА ИДЕЮ",
    steps: ["ФИНАНСОВАЯ СИСТЕМА", "БЛОКЧЕЙНЫ", "ВНЕШНИЕ ДАННЫЕ", "МЕЖСЕТЕВОЕ ВЗАИМОДЕЙСТВИЕ"],
    labels: ["ДАННЫЕ", "БЛОКЧЕЙНЫ", "CCIP", "LINK"],
  },
  18: {
    layout: "research-checklist",
    title: "ИЗУЧАЙТЕ LINK САМОСТОЯТЕЛЬНО",
    steps: ["ТОКЕНОМИКА", "КОНКУРЕНТЫ", "РИСКИ", "РЕШЕНИЕ ЗА ВАМИ"],
    labels: ["ТОКЕНОМИКА", "КОНКУРЕНТЫ", "РИСКИ", "САМОСТОЯТЕЛЬНОЕ ИЗУЧЕНИЕ"],
  },
  19: {
    layout: "story-to-usage",
    title: "ИСТОРИЯ ПРОЕКТА И РЕАЛЬНОЕ ПРИМЕНЕНИЕ",
    steps: ["КРАСИВАЯ ИСТОРИЯ", "ПРОВЕРКА", "ИСПОЛЬЗОВАНИЕ", "ЭКОНОМИЧЕСКАЯ ЦЕННОСТЬ"],
    labels: ["ИСТОРИЯ", "ПРОВЕРКА", "ИСПОЛЬЗОВАНИЕ"],
  },
  20: {
    layout: "final-network",
    title: "ИНФРАСТРУКТУРА НОВОГО ФИНАНСОВОГО РЫНКА",
    steps: ["СЕТИ СОЕДИНЯЮТСЯ", "ДАННЫЕ ПОСТУПАЮТ", "АКТИВЫ ДВИЖУТСЯ", "ВОЗМОЖНЫЙ СТАНДАРТ"],
    labels: ["CHAINLINK", "LINK", "ДАННЫЕ", "АКТИВЫ", "БЛОКЧЕЙНЫ"],
  },
};

export function serializeChainlinkEditorialBlueprint(sceneId: number): string {
  const blueprint = CHAINLINK_EDITORIAL_BLUEPRINTS[sceneId];
  if (!blueprint) throw new Error(`Missing Chainlink editorial blueprint for scene ${sceneId}`);
  return `${CHAINLINK_EDITORIAL_BLUEPRINT_PREFIX}${JSON.stringify(blueprint)}`;
}

export function parseChainlinkEditorialBlueprint(description: string): ChainlinkEditorialBlueprint | null {
  if (!description.startsWith(CHAINLINK_EDITORIAL_BLUEPRINT_PREFIX)) return null;
  try {
    const candidate = JSON.parse(description.slice(CHAINLINK_EDITORIAL_BLUEPRINT_PREFIX.length)) as Partial<ChainlinkEditorialBlueprint>;
    if (
      typeof candidate.layout !== "string"
      || typeof candidate.title !== "string"
      || !Array.isArray(candidate.steps)
      || !candidate.steps.every((step) => typeof step === "string")
      || !Array.isArray(candidate.labels)
      || !candidate.labels.every((label) => typeof label === "string")
    ) {
      throw new Error("Invalid Chainlink editorial blueprint payload");
    }
    return candidate as ChainlinkEditorialBlueprint;
  } catch (error) {
    throw new Error(
      `Invalid Chainlink editorial blueprint: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}