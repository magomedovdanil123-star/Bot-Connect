export const FINANCE_STYLE_DNA = {
  width: 1080,
  height: 1920,
  fps: 30,
  colors: {
    backgroundTop: "#0B151D",
    backgroundBottom: "#050A0E",
    panel: "#101B24",
    panelDark: "#0D1A22",
    panelEdge: "#294051",
    green: "#35E69A",
    greenSoft: "#B9F7D8",
    white: "#F7FBFF",
    muted: "#92A4B5",
    gold: "#F4D477",
    red: "#FF8D8D",
  },
  typography: {
    family: "DejaVu Sans",
    titleSize: 38,
    sceneTitleSize: 25,
    subtitleSize: 26,
  },
  geometry: {
    panelRadius: 34,
    safeTop: 150,
    safeBottom: 240,
  },
  motion: {
    enter: "easeOutBack",
    move: "easeInOutCubic",
    exit: "easeInOutCubic",
    cameraZoom: 1.035,
  },
} as const;

export type FinanceBackgroundId =
  | "grid"
  | "particles"
  | "terminal"
  | "aurora"
  | "mesh"
  | "circuit"
  | "ledger"
  | "stars"
  | "waves"
  | "blueprint"
  | "radar"
  | "pulse";

export const FINANCE_BACKGROUND_LIBRARY: Array<{
  id: FinanceBackgroundId;
  label: string;
  description: string;
}> = [
  { id: "grid", label: "Dark fintech grid", description: "Тонкая сетка и зелёное свечение." },
  { id: "particles", label: "Financial particles", description: "Сетка, частицы и мягкие узлы финансового потока." },
  { id: "terminal", label: "Trading terminal", description: "Горизонтальные строки терминала и спокойный navy-gradient." },
  { id: "aurora", label: "Aurora liquidity", description: "Плавные световые волны для движения капитала." },
  { id: "mesh", label: "Market mesh", description: "Многослойная сеть с живыми узлами." },
  { id: "circuit", label: "Capital circuit", description: "Микросхема из маршрутов, узлов и импульсов." },
  { id: "ledger", label: "Ledger sheets", description: "Строгая бухгалтерская сетка с бегущими строками." },
  { id: "stars", label: "Data constellation", description: "Созвездие точек данных и тонких связей." },
  { id: "waves", label: "Yield waves", description: "Кривые доходности и спокойные синусоидальные линии." },
  { id: "blueprint", label: "Blueprint finance", description: "Чертёжная разметка для механики финансового инструмента." },
  { id: "radar", label: "Risk radar", description: "Радарные кольца для риска, цены и сигналов." },
  { id: "pulse", label: "Market pulse", description: "Вертикальные импульсы и пульсирующие бары." },
];

export type FinanceChartKind =
  | "line"
  | "area"
  | "candlestick"
  | "bar"
  | "horizontal_bar"
  | "donut"
  | "waterfall"
  | "portfolio"
  | "timeline"
  | "sparkline";

export type FinanceObjectKind =
  | "investor"
  | "company"
  | "bank"
  | "government"
  | "broker"
  | "wallet"
  | "money"
  | "gold"
  | "coin"
  | "ruble"
  | "bond"
  | "stock"
  | "dividend"
  | "percentage"
  | "chart_up"
  | "chart_down"
  | "candlestick_chart"
  | "portfolio"
  | "brokerage_account"
  | "document"
  | "calendar"
  | "clock"
  | "shield"
  | "warning"
  | "arrow"
  | "money_flow"
  | "payment"
  | "coupon"
  | "interest"
  | "balance"
  | "calculator"
  | "phone"
  | "laptop";

export type FinanceObjectDefinition = {
  kind: FinanceObjectKind;
  role: "actor" | "instrument" | "metric" | "chart" | "utility" | "risk";
  supports: readonly ["position", "scale", "rotation", "opacity", "color", "enter", "exit", "movement", "delay", "duration", "easing"];
};

const animationProperties = [
  "position",
  "scale",
  "rotation",
  "opacity",
  "color",
  "enter",
  "exit",
  "movement",
  "delay",
  "duration",
  "easing",
] as const;

const objectKinds: Array<[FinanceObjectKind, FinanceObjectDefinition["role"]]> = [
  ["investor", "actor"], ["company", "actor"], ["bank", "actor"], ["government", "actor"], ["broker", "actor"],
  ["wallet", "utility"], ["money", "instrument"], ["gold", "instrument"], ["coin", "instrument"], ["ruble", "instrument"],
  ["bond", "instrument"], ["stock", "instrument"], ["dividend", "metric"], ["percentage", "metric"],
  ["chart_up", "chart"], ["chart_down", "chart"], ["candlestick_chart", "chart"], ["portfolio", "utility"],
  ["brokerage_account", "utility"], ["document", "utility"], ["calendar", "utility"], ["clock", "utility"],
  ["shield", "risk"], ["warning", "risk"], ["arrow", "utility"], ["money_flow", "utility"],
  ["payment", "metric"], ["coupon", "metric"], ["interest", "metric"], ["balance", "metric"],
  ["calculator", "utility"], ["phone", "utility"], ["laptop", "utility"],
];

export const FINANCE_OBJECT_LIBRARY: FinanceObjectDefinition[] = objectKinds.map(([kind, role]) => ({
  kind,
  role,
  supports: animationProperties,
}));