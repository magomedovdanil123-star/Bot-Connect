import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  prepareSpeechText,
} from "./audio-generation/elevenlabs-client";
import {
  FINANCE_STYLE_DNA,
  type FinanceBackgroundId,
  type FinanceChartKind,
} from "./finance-style-dna";
import {
  renderFullPresenter,
  renderFuturesIconCards,
  renderPremiumCreatorBackground,
  renderSpokenWordChips,
} from "./financial-presenter";

const execFileAsync = promisify(execFile);

const WIDTH = FINANCE_STYLE_DNA.width;
const HEIGHT = FINANCE_STYLE_DNA.height;
const FPS = FINANCE_STYLE_DNA.fps;
const FONT = FINANCE_STYLE_DNA.typography.family;
const GREEN = FINANCE_STYLE_DNA.colors.green;
const WHITE = FINANCE_STYLE_DNA.colors.white;
const MUTED = FINANCE_STYLE_DNA.colors.muted;
const PANEL = FINANCE_STYLE_DNA.colors.panel;
const PANEL_EDGE = FINANCE_STYLE_DNA.colors.panelEdge;
const GOLD = FINANCE_STYLE_DNA.colors.gold;

export const FINANCIAL_SHORT_SCRIPT = [
  "Облигация — это по сути расписка с понятными условиями.",
  "Представь: компании нужны деньги на развитие. Она может взять кредит в банке, а может занять деньги у инвесторов.",
  "Компания выпускает облигации. Ты покупаешь одну из них и даёшь компании деньги сейчас.",
  "Взамен компания обещает две вещи: платить процент — это купон, и вернуть номинал облигации в определённую дату.",
  "Например, ты купил облигацию за десять тысяч рублей на один год с купоном восемнадцать процентов годовых.",
  "Это не значит, что ты сразу получишь тысячу восемьсот рублей. Купон может приходить частями — например, каждый квартал.",
  "В конце срока компания возвращает тебе сами десять тысяч рублей. Это и есть возврат номинала.",
  "Но облигация — не депозит. Пока она торгуется на бирже, её цена может меняться каждый день.",
  "Если продать облигацию раньше срока, можно заработать, а можно получить меньше вложенной суммы.",
  "Поэтому перед покупкой смотри на срок, доходность, кредитный рейтинг и риск эмитента.",
  "Коротко: ты даёшь деньги компании или государству, получаешь купоны по пути, а в конце — номинал. Чем выше обещанная доходность, тем внимательнее нужно проверять риск.",
].join(" ");

export type FinancialVisualKind =
  | "hook"
  | "definition"
  | "flow"
  | "coupon"
  | "calendar"
  | "market"
  | "maturity"
  | "contract"
  | "leverage"
  | "payoff"
  | "comparison"
  | "risk"
  | "ownership"
  | "fund"
  | "distribution"
  | "summary";

export type FinancialConcept =
  | "bond_flow"
  | "equity_split"
  | "fund_pool"
  | "profit_distribution"
  | "futures_contract"
  | "generic_finance";

export type FinancialShortBeat = {
  id: string;
  from: number;
  to: number;
  visual: FinancialVisualKind;
  title: string;
  subtitle: string;
  voiceText?: string;
  visualAction?: string;
  cameraAction?: string;
  textAnimation?: string;
  soundEffect?: string;
  concept?: FinancialConcept;
  objectKinds?: string[];
  background?: FinanceBackgroundId;
  chartKind?: FinanceChartKind;
  entityLabel?: string;
  metricLabel?: string;
  maturityLabel?: string;
  definitionCaption?: string;
  summaryItems?: Array<[string, string]>;
};

const SHORT_BEATS: FinancialShortBeat[] = [
  {
    id: "hook",
    from: 0,
    to: 0.09,
    visual: "hook",
    title: "ОБЛИГАЦИЯ — ЭТО РАСПИСКА",
    subtitle: "Ты даёшь деньги сейчас — и заранее знаешь условия возврата.",
  },
  {
    id: "definition",
    from: 0.09,
    to: 0.22,
    visual: "definition",
    title: "КОМУ НУЖНЫ ДЕНЬГИ?",
    subtitle: "Компания занимает деньги не у одного банка, а у множества инвесторов.",
  },
  {
    id: "flow",
    from: 0.22,
    to: 0.39,
    visual: "flow",
    title: "ТЫ ПОКУПАЕШЬ ОБЛИГАЦИЮ",
    subtitle: "Деньги переходят компании. Облигация фиксирует её обязательство.",
  },
  {
    id: "coupon",
    from: 0.39,
    to: 0.55,
    visual: "coupon",
    title: "КУПОН — ЭТО ПРОЦЕНТ",
    subtitle: "Например: 18% годовых. Выплаты могут приходить частями.",
  },
  {
    id: "calendar",
    from: 0.55,
    to: 0.66,
    visual: "calendar",
    title: "СРОК: 1 ГОД",
    subtitle: "Купоны приходят по графику, а срок постепенно заканчивается.",
  },
  {
    id: "market",
    from: 0.66,
    to: 0.79,
    visual: "market",
    title: "ЭТО НЕ ДЕПОЗИТ",
    subtitle: "Цена облигации на бирже может меняться каждый день.",
  },
  {
    id: "maturity",
    from: 0.79,
    to: 0.91,
    visual: "maturity",
    title: "ВОЗВРАТ НОМИНАЛА",
    subtitle: "Если дождаться погашения, компания возвращает сам номинал.",
  },
  {
    id: "summary",
    from: 0.91,
    to: 1,
    visual: "summary",
    title: "ПРОВЕРЬ РИСК",
    subtitle: "Срок, доходность, рейтинг и надёжность эмитента важнее красивого процента.",
  },
];

export type FinancialShortRenderPlan = {
  title: string;
  mainTitle: string;
  script: string;
  beats: FinancialShortBeat[];
  background?: FinanceBackgroundId;
  visualTheme?: "classic_dark" | "premium_creator";
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function ease(value: number): number {
  const t = clamp(value);
  return 1 - (1 - t) ** 3;
}

function localProgress(timeMs: number, startMs: number, endMs: number): number {
  return clamp((timeMs - startMs) / Math.max(1, endMs - startMs));
}

function wrapText(value: string, maxChars: number): string[] {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["…"];
}

function text(
  value: string,
  x: number,
  y: number,
  options: {
    size?: number;
    color?: string;
    weight?: number;
    anchor?: "start" | "middle" | "end";
    letterSpacing?: number;
  } = {},
): string {
  return `<text x="${x}" y="${y}" fill="${options.color ?? WHITE}" font-family="${FONT}" font-size="${options.size ?? 30}" font-weight="${options.weight ?? 600}" text-anchor="${options.anchor ?? "middle"}"${options.letterSpacing ? ` letter-spacing="${options.letterSpacing}"` : ""}>${escapeXml(value)}</text>`;
}

function textLines(
  value: string,
  x: number,
  y: number,
  maxChars: number,
  lineHeight: number,
  options: { size?: number; color?: string; weight?: number; anchor?: "start" | "middle" } = {},
): string {
  const lines = wrapText(value, maxChars);
  const anchor = options.anchor ?? "middle";
  return lines.map((line, index) => text(line, x, y + index * lineHeight, {
    ...options,
    anchor,
  })).join("");
}

function panel(x: number, y: number, width: number, height: number, fill: string = PANEL, stroke: string = PANEL_EDGE): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="34" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

function pointOnCurve(progress: number, reverse = false): { x: number; y: number } {
  const t = reverse ? 1 - clamp(progress) : clamp(progress);
  const start = { x: 285, y: 780 };
  const controlA = { x: 410, y: 570 };
  const controlB = { x: 670, y: 980 };
  const end = { x: 795, y: 780 };
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * controlA.x + 3 * inverse * t ** 2 * controlB.x + t ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * controlA.y + 3 * inverse * t ** 2 * controlB.y + t ** 3 * end.y,
  };
}

function coin(x: number, y: number, scale: number, color: string, rotation: number, opacity = 1): string {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" opacity="${opacity}">
    <circle r="40" fill="#122C25" stroke="${color}" stroke-width="6"/>
    <circle r="29" fill="none" stroke="${color}" stroke-width="2" opacity=".55"/>
    ${text("₽", 0, 12, { size: 33, color, weight: 800 })}
  </g>`;
}

function coinsAlongCurve(progress: number, reverse: boolean, color: string, count = 5): string {
  return Array.from({ length: count }, (_, index) => {
    const offset = (index - (count - 1) / 2) * 0.075;
    const point = pointOnCurve(progress + offset, reverse);
    const scale = 0.78 + ((index + 1) % 3) * 0.07;
    return coin(point.x, point.y, scale, color, (progress * 240 + index * 29) % 360, clamp(1 - Math.abs(offset) * 2));
  }).join("");
}

function actor(kind: "investor" | "company", x: number, y: number, progress: number, timeMs = 0): string {
  const entry = ease(progress);
  const offsetX = kind === "investor" ? -90 * (1 - entry) : 90 * (1 - entry);
  const liveOffset = Math.sin(timeMs / 620 + (kind === "investor" ? 0 : Math.PI)) * 7 * entry;
  const liveRotation = Math.sin(timeMs / 890 + (kind === "investor" ? 0 : Math.PI)) * 0.8 * entry;
  const label = kind === "investor" ? "ИНВЕСТОР" : "КОМПАНИЯ";
  const icon = kind === "investor"
    ? `<rect x="-84" y="-45" width="168" height="105" rx="18" fill="#172936" stroke="${GREEN}" stroke-width="3"/>
       <path d="M-42 -10 L42 -10 M-42 20 L28 20" stroke="${GREEN}" stroke-width="8" stroke-linecap="round" opacity=".72"/>
       <circle cx="0" cy="82" r="18" fill="${GREEN}"/>${text("₽", 0, 91, { size: 25, color: "#092017", weight: 800 })}`
    : `<path d="M-72 65 V-32 L0 -88 L72 -32 V65 Z" fill="#172936" stroke="${GREEN}" stroke-width="3"/>
       <path d="M-46 54 V3 H-10 V54 M10 54 V3 H46 V54 M-85 72 H85" fill="none" stroke="${GREEN}" stroke-width="9" stroke-linejoin="round" opacity=".78"/>`;
  return `<g transform="translate(${x + offsetX} ${y + liveOffset}) rotate(${liveRotation}) scale(${0.9 + entry * 0.1})" opacity="${entry}">
    ${panel(-135, -120, 270, 240)}
    ${icon}
    ${text(label, 0, 155, { size: 25, color: WHITE, weight: 800, letterSpacing: 1 })}
  </g>`;
}

function documentCard(progress: number, label = "ОБЯЗАТЕЛЬСТВО", caption = "вернуть деньги"): string {
  const entry = ease(progress);
  return `<g transform="translate(540 780) scale(${0.82 + entry * 0.18}) rotate(${(1 - entry) * -3})" opacity="${entry}">
    <rect x="-230" y="-150" width="460" height="300" rx="30" fill="#F1F7F5" stroke="${GREEN}" stroke-width="4"/>
    <path d="M-170 -62 H150 M-170 0 H125 M-170 62 H55" stroke="#4B6A62" stroke-width="14" stroke-linecap="round"/>
    <rect x="106" y="72" width="72" height="38" rx="12" fill="${GREEN}"/>
    ${text(label, 0, -190, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
    ${text(caption, 0, 215, { size: 26, color: WHITE, weight: 700 })}
  </g>`;
}

function shareTile(x: number, y: number, label: string, progress: number, rotation = 0, color: string = GREEN): string {
  const entry = ease(progress);
  const scale = 0.72 + entry * 0.28;
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" opacity="${entry}">
    <rect x="-72" y="-52" width="144" height="104" rx="22" fill="#142B26" stroke="${color}" stroke-width="3"/>
    ${text(label, 0, 9, { size: 22, color: WHITE, weight: 800 })}
  </g>`;
}

function ownershipVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const split = clamp((progress - 0.14) / 0.6);
  const shares = [
    [350, 600, "25%"], [540, 540, "10%"], [730, 600, "35%"],
    [430, 820, "15%"], [650, 820, "15%"],
  ];
  const companyScale = 1 - ease(split) * 0.18;
  return `${actor("company", 850, 770, ease(progress * 1.8), timeMs)}
    <g transform="translate(540 700) scale(${companyScale})" opacity="${1 - ease(split) * 0.62}">
      ${panel(-150, -120, 300, 240, "#162B2B", GREEN)}
      ${text("КОМПАНИЯ", 0, -12, { size: 25, color: WHITE, weight: 800 })}
      ${text("100%", 0, 42, { size: 44, color: GREEN, weight: 900 })}
    </g>
    ${shares.map(([x, y, label], index) => {
      const shareProgress = clamp((split - index * 0.08) * 2.3);
      const originX = 540 + (Number(x) - 540) * (1 - ease(split));
      const originY = 700 + (Number(y) - 700) * (1 - ease(split));
      return shareTile(originX, originY, String(label), shareProgress, Math.sin(timeMs / 600 + index) * 2);
    }).join("")}
    ${text("КОМПАНИЯ → ДОЛИ", 540, 1050, { size: 28, color: GREEN, weight: 800, letterSpacing: 1 })}
    ${text(beat.entityLabel ?? "АКЦИЯ", 540, 1120, { size: 34, color: WHITE, weight: 900 })}`;
}

function fundPoolVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const poolEntry = ease(clamp((progress - 0.16) * 1.6));
  const assetEntry = ease(clamp((progress - 0.48) * 2.1));
  const investors = [
    [165, 600], [165, 780], [165, 960],
  ];
  const assets: Array<[string, string]> = [
    ["АКЦИИ", GREEN], ["ОБЛИГАЦИИ", GOLD], ["ЗОЛОТО", "#D7C27C"], ["КЭШ", "#B9F7D8"],
  ];
  return `${investors.map(([x, y], index) => {
      const local = ease(clamp(progress * 2.1 - index * 0.18));
      return `<g transform="translate(${x + (1 - local) * -70} ${y + Math.sin(timeMs / 700 + index) * 5})" opacity="${local}">
        <circle r="48" fill="#142B26" stroke="${GREEN}" stroke-width="3"/>
        ${text("₽", 0, 14, { size: 33, color: GREEN, weight: 800 })}
      </g>`;
    }).join("")}
    ${investors.map(([x, y]) => `<path d="M${x + 58} ${y} C300 ${y} 340 760 430 760" fill="none" stroke="${GREEN}" stroke-width="4" stroke-dasharray="9 18" opacity="${poolEntry * 0.8}" stroke-dashoffset="${-Math.round(timeMs / 7)}"/>`).join("")}
    <g transform="translate(540 760) scale(${0.72 + poolEntry * 0.28})" opacity="${poolEntry}">
      <circle r="190" fill="#102A29" stroke="${GREEN}" stroke-width="5"/>
      <circle r="155" fill="none" stroke="${GREEN}" stroke-width="2" stroke-dasharray="8 18" opacity=".65"/>
      ${text("ОБЩИЙ", 0, -12, { size: 27, color: MUTED, weight: 800, letterSpacing: 2 })}
      ${text("ФОНД", 0, 42, { size: 48, color: WHITE, weight: 900 })}
    </g>
    ${assets.map(([label, color], index) => {
      const angle = -1.05 + index * 0.7 + Math.sin(timeMs / 1200) * 0.04;
      const x = 540 + Math.cos(angle) * 250;
      const y = 760 + Math.sin(angle) * 250;
      return shareTile(x, y, String(label), assetEntry, index % 2 ? -4 : 4, String(color));
    }).join("")}
    ${text(beat.entityLabel ?? "ПАЕВОЙ ФОНД", 540, 1130, { size: 31, color: GREEN, weight: 800 })}`;
}

function distributionVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const profitEntry = ease(clamp(progress * 1.8));
  const distribution = ease(clamp((progress - 0.3) * 1.7));
  const payments: Array<[number, number, string]> = [
    [330, 910, "1"], [540, 1000, "2"], [750, 910, "3"],
  ];
  return `${actor("company", 540, 575, profitEntry, timeMs)}
    ${badge("ПРИБЫЛЬ", 540, 350, GOLD, profitEntry, 300)}
    <path d="M540 760 C540 820 330 820 330 900 M540 760 C540 850 540 900 540 970 M540 760 C540 820 750 820 750 900" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="10 16" opacity="${distribution * .8}" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>
    ${payments.map(([x, y, label], index) => {
      const local = ease(clamp(distribution * 2.2 - index * 0.16));
      return `<g transform="translate(${x} ${y + Math.sin(timeMs / 500 + index) * 6}) scale(${0.76 + local * 0.24})" opacity="${local}">
        <circle r="74" fill="#142B26" stroke="${GREEN}" stroke-width="4"/>
        ${text("₽", 0, 12, { size: 38, color: GREEN, weight: 900 })}
        ${text(`АКЦИЯ ${label}`, 0, 118, { size: 20, color: WHITE, weight: 800 })}
      </g>`;
    }).join("")}
    ${text("ПРИБЫЛЬ → ВЫПЛАТА", 540, 1220, { size: 29, color: GREEN, weight: 800, letterSpacing: 1 })}
    ${text(beat.entityLabel ?? "ДИВИДЕНД", 540, 1280, { size: 34, color: WHITE, weight: 900 })}`;
}

function badge(label: string, x: number, y: number, color: string, progress: number, width = 310): string {
  const entry = ease(progress);
  return `<g transform="translate(${x} ${y}) scale(${0.78 + entry * 0.22})" opacity="${entry}">
    <rect x="${-width / 2}" y="-43" width="${width}" height="86" rx="43" fill="#12261F" stroke="${color}" stroke-width="2"/>
    <circle cx="${-width / 2 + 34}" cy="0" r="10" fill="${color}"/>
    ${text(label, 18, 11, { size: 27, color: WHITE, weight: 800, letterSpacing: .7 })}
  </g>`;
}

function seededSeries(seed: number, count: number, trend = 0.5): number[] {
  let state = Math.abs(Math.round(seed)) || 17;
  const values: number[] = [];
  let value = 42;
  for (let index = 0; index < count; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const noise = (state / 0xFFFFFFFF - 0.5) * 15;
    value = Math.max(12, Math.min(88, value + trend + noise));
    values.push(value);
  }
  return values;
}

function chartSeed(beat: FinancialShortBeat): number {
  return [...beat.id, beat.entityLabel ?? "", beat.title].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
}

function chartVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const kind = beat.chartKind ?? "line";
  const seed = chartSeed(beat);
  const values = seededSeries(seed, 9, kind === "candlestick" ? 0.2 : 1.2);
  const plotX = 205;
  const plotY = 570;
  const plotWidth = 670;
  const plotHeight = 360;
  const visible = Math.max(2, Math.ceil(clamp((progress - 0.08) / 0.76) * values.length));
  const pointAt = (value: number, index: number) => ({
    x: plotX + (index / (values.length - 1)) * plotWidth,
    y: plotY + plotHeight - (value / 100) * plotHeight,
  });
  const points = values.map(pointAt);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const y = plotY + index * (plotHeight / 4);
    return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="#294051" stroke-width="2" stroke-dasharray="6 18"/>`;
  }).join("");
  const axes = `<line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="${MUTED}" stroke-width="3" opacity=".65"/><line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="${MUTED}" stroke-width="3" opacity=".65"/>`;
  const label = kind === "candlestick"
    ? "СВЕЧНОЙ ГРАФИК"
    : kind === "area"
      ? "ДИНАМИКА ПОКАЗАТЕЛЯ"
      : kind === "bar" || kind === "horizontal_bar"
        ? "СРАВНЕНИЕ ЗНАЧЕНИЙ"
        : "ДВИЖЕНИЕ ПОКАЗАТЕЛЯ";

  if (kind === "candlestick") {
    const candles = values.map((value, index) => {
      const x = plotX + index * (plotWidth / (values.length - 1));
      const open = Math.max(10, value - 8 + Math.sin(seed + index) * 4);
      const close = Math.max(10, value + 6 - Math.cos(seed + index) * 4);
      const high = Math.min(98, Math.max(open, close) + 10);
      const low = Math.max(4, Math.min(open, close) - 10);
      const scale = Math.max(0.28, clamp((progress * values.length - index) * 1.8));
      const color = close >= open ? GREEN : "#FF8D8D";
      const yHigh = pointAt(high, index).y;
      const yLow = pointAt(low, index).y;
      const yOpen = pointAt(open, index).y;
      const yClose = pointAt(close, index).y;
      const active = Math.floor(timeMs / 260) % values.length === index;
      return `<g opacity="${scale}"><line x1="${x}" y1="${yHigh}" x2="${x}" y2="${yLow}" stroke="${color}" stroke-width="${active ? 9 : 5}"/><rect x="${x - (active ? 23 : 18)}" y="${Math.min(yOpen, yClose)}" width="${active ? 46 : 36}" height="${Math.max(12, Math.abs(yClose - yOpen))}" rx="6" fill="${color}" opacity="${active ? 1 : .85}"/>${active ? `<circle cx="${x}" cy="${yHigh - 18}" r="${10 + Math.sin(timeMs / 120) * 3}" fill="${color}"/>` : ""}</g>`;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text(label, 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      ${grid}${axes}${candles}
      ${text("Учебный пример движения цены", 540, 1145, { size: 27, color: WHITE, weight: 700 })}
      ${badge(beat.metricLabel ?? "ЦЕНА НА БИРЖЕ", 540, 1240, GOLD, ease(progress), 390)}`;
  }

  if (kind === "bar" || kind === "horizontal_bar" || kind === "portfolio") {
    const labels = kind === "portfolio" ? ["АКЦИИ", "ОБЛИГАЦИИ", "ЗОЛОТО", "КЭШ", "ДРУГОЕ"] : ["A", "B", "C", "D", "E", "F"];
    const bars = labels.map((labelText, index) => {
      const value = values[index % values.length];
      const local = ease(clamp(progress * 1.8 - index * 0.12));
      if (kind === "horizontal_bar" || kind === "portfolio") {
        const y = 600 + index * 82;
        const width = value * 5.1 * (0.94 + Math.sin(timeMs / 360 + index) * .06);
        return `<g opacity="${local}">${text(labelText, 210, y + 28, { size: 22, color: WHITE, weight: 700, anchor: "start" })}<rect x="370" y="${y}" width="${width}" height="46" rx="23" fill="${index % 2 ? GOLD : GREEN}" opacity=".8"/><text x="${390 + width}" y="${y + 31}" fill="${WHITE}" font-family="${FONT}" font-size="20" font-weight="800">${Math.round(value)}%</text></g>`;
      }
      const x = 225 + index * 105;
      const height = value * 3.2 * (0.94 + Math.sin(timeMs / 360 + index) * .06);
      return `<g opacity="${local}"><rect x="${x}" y="${930 - height}" width="64" height="${height}" rx="16" fill="${index % 2 ? GOLD : GREEN}" opacity=".82"/><text x="${x + 32}" y="970" fill="${WHITE}" font-family="${FONT}" font-size="20" font-weight="800" text-anchor="middle">${labelText}</text></g>`;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text(kind === "portfolio" ? "СТРУКТУРА ПОРТФЕЛЯ" : label, 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      ${kind === "horizontal_bar" || kind === "portfolio" ? bars : `${axes}${bars}`}
      ${text("Доли и значения показаны как учебный пример", 540, 1145, { size: 25, color: WHITE, weight: 700 })}`;
  }

  if (kind === "donut") {
    const segments = [28, 22, 18, 17, 15];
    const colors = [GREEN, GOLD, "#7ED8FF", "#C795FF", "#FF9B8D"];
    const circumference = 2 * Math.PI * 150;
    let offset = 0;
    const rings = segments.map((segment, index) => {
      const length = circumference * segment / 100;
      const local = ease(clamp(progress * 2 - index * 0.18));
      const ring = `<circle cx="540" cy="760" r="150" fill="none" stroke="${colors[index]}" stroke-width="64" stroke-dasharray="${length * local} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 540 760)" opacity="${local}"/>`;
      offset += length;
      return ring;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text("РАСПРЕДЕЛЕНИЕ", 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      <g transform="rotate(${Math.sin(timeMs / 1800) * 8} 540 760)">${rings}</g>
      <circle cx="540" cy="760" r="104" fill="#0D1A22"/>
      ${text(beat.entityLabel ?? "ПОРТФЕЛЬ", 540, 750, { size: 24, color: WHITE, weight: 800 })}
      ${text("100%", 540, 795, { size: 36, color: GREEN, weight: 900 })}
      ${text("Учебная структура", 540, 1145, { size: 27, color: WHITE, weight: 700 })}`;
  }

  if (kind === "waterfall") {
    const values = [68, 24, -18, 15, -9, 80];
    let running = 42;
    const bars = values.map((change, index) => {
      const start = running;
      running += change;
      const local = ease(clamp(progress * 1.8 - index * 0.13));
      const x = 190 + index * 112;
      const yStart = 930 - start * 3;
      const yEnd = 930 - running * 3;
      const y = Math.min(yStart, yEnd);
      const height = Math.max(18, Math.abs(yEnd - yStart));
      const color = change >= 0 ? GREEN : "#FF8D8D";
      return `<g opacity="${local}"><rect x="${x}" y="${y}" width="72" height="${height}" rx="12" fill="${color}" opacity=".85"/><text x="${x + 36}" y="980" fill="${WHITE}" font-family="${FONT}" font-size="18" font-weight="800" text-anchor="middle">${change > 0 ? "+" : ""}${change}</text></g>`;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text("ПРИБЫЛЬ → ВЫПЛАТА", 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      ${axes}${bars}
      ${text("Как сумма меняется после каждого шага", 540, 1145, { size: 27, color: WHITE, weight: 700 })}`;
  }

  const linePoints = points.slice(0, visible).map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${plotX},${plotY + plotHeight} ${linePoints} ${points[Math.max(0, visible - 1)]!.x},${plotY + plotHeight}`;
  const fullPoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const progressivePath = `<polyline points="${fullPoints}" fill="none" stroke="${GREEN}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".24"/><polyline points="${linePoints}" fill="none" stroke="${GREEN}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12" stroke-dashoffset="${-Math.round(timeMs / 5)}"/>`;
  const area = kind === "area" ? `<polygon points="${areaPoints}" fill="${GREEN}" opacity=".12"/><polyline points="${fullPoints}" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="12 22" stroke-dashoffset="${-Math.round(timeMs / 6)}" opacity=".55"/>` : "";
  const dots = points.map((point, index) => {
    const visibleOpacity = index < visible ? 1 : .22;
    const active = Math.floor(timeMs / 300) % values.length === index;
    return `<circle cx="${point.x}" cy="${point.y}" r="${active ? 16 + Math.sin(timeMs / 140) * 3 : 8 + Math.sin(timeMs / 220 + index) * 2}" fill="${GREEN}" stroke="#0D1A22" stroke-width="5" opacity="${visibleOpacity}"/>`;
  }).join("");
  return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
    ${text(label, 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
    ${grid}${axes}${area}${progressivePath}${dots}
    ${text("Показатель меняется во времени", 540, 1145, { size: 27, color: WHITE, weight: 700 })}
    ${badge(beat.metricLabel ?? "ДИНАМИКА", 540, 1240, GREEN, ease(progress), 330)}`;
}

function renderBackgroundLayer(background: FinanceBackgroundId, timeMs: number): string {
  const drift = Math.round(timeMs / 14);
  const grid = `<g opacity=".12">${Array.from({ length: 16 }, (_, index) => `<line x1="${index * 72}" y1="0" x2="${index * 72}" y2="${HEIGHT}" stroke="${GREEN}" stroke-width="1"/>`).join("")}${Array.from({ length: 28 }, (_, index) => `<line x1="0" y1="${index * 72}" x2="${WIDTH}" y2="${index * 72}" stroke="${GREEN}" stroke-width="1"/>`).join("")}</g>`;
  if (background === "grid") return grid;
  if (background === "particles" || background === "stars") {
    return `${grid}<g fill="${GREEN}" opacity=".2">${Array.from({ length: background === "stars" ? 42 : 24 }, (_, index) => {
      const x = 34 + ((index * 173) % 1010);
      const y = 180 + ((index * 311) % 1440);
      const radius = background === "stars" ? 2 + (index % 4) * 2 : 3 + (index % 4) * 2;
      return `<circle cx="${x}" cy="${y}" r="${radius}"/><circle cx="${(x + 120) % WIDTH}" cy="${y + 54}" r="2"/>`;
    }).join("")}</g>`;
  }
  if (background === "terminal" || background === "ledger") {
    const rows = Array.from({ length: 12 }, (_, index) => {
      const y = 250 + index * 118;
      return `<line x1="48" y1="${y}" x2="${1030 - (index % 3) * 90}" y2="${y}" stroke="${GREEN}" stroke-width="${background === "ledger" ? 1 : 2}" stroke-dasharray="${18 + (index % 4) * 11} 22" stroke-dashoffset="${-drift}"/>`;
    }).join("");
    return `${background === "ledger" ? grid : ""}<g opacity=".16">${rows}</g>`;
  }
  if (background === "aurora") {
    return `<g opacity=".24" fill="none" stroke-linecap="round"><path d="M-80 520 C220 220 420 820 720 470 S1120 210 1190 540" stroke="${GREEN}" stroke-width="70" opacity=".1"/><path d="M-80 930 C230 620 470 1180 770 840 S1120 610 1190 900" stroke="#7ED8FF" stroke-width="42" opacity=".12"/><path d="M-80 1340 C240 1040 470 1500 820 1200 S1110 1050 1190 1320" stroke="${GOLD}" stroke-width="24" opacity=".12"/></g>`;
  }
  if (background === "mesh") {
    return `<g opacity=".14" fill="none" stroke="${GREEN}" stroke-width="2">${Array.from({ length: 9 }, (_, index) => `<path d="M-50 ${340 + index * 150} C260 ${180 + index * 150} 520 ${520 + index * 120} 1130 ${300 + index * 138}"/>`).join("")}</g><g fill="${GREEN}" opacity=".28">${Array.from({ length: 18 }, (_, index) => `<circle cx="${80 + ((index * 227) % 900)}" cy="${260 + ((index * 149) % 1240)}" r="5"/>`).join("")}</g>`;
  }
  if (background === "circuit") {
    return `<g fill="none" stroke="${GREEN}" stroke-width="3" opacity=".16">${Array.from({ length: 9 }, (_, index) => {
      const y = 260 + index * 150;
      return `<path d="M30 ${y} H${170 + (index % 3) * 70} V${y + 60} H${420 + (index % 4) * 90} V${y - 40} H1050"/>`;
    }).join("")}</g><g fill="${GREEN}" opacity=".36">${Array.from({ length: 18 }, (_, index) => `<circle cx="${170 + (index % 6) * 150}" cy="${260 + Math.floor(index / 6) * 430}" r="7"/>`).join("")}</g>`;
  }
  if (background === "waves") {
    return `<g fill="none" stroke-linecap="round"><path d="M-80 460 C100 300 250 620 430 460 S760 300 940 460 S1130 620 1180 480" stroke="${GREEN}" stroke-width="4" opacity=".22"/><path d="M-80 800 C100 640 250 960 430 800 S760 640 940 800 S1130 960 1180 820" stroke="${GOLD}" stroke-width="3" opacity=".18"/><path d="M-80 1140 C100 980 250 1300 430 1140 S760 980 940 1140 S1130 1300 1180 1160" stroke="#7ED8FF" stroke-width="3" opacity=".16"/></g>`;
  }
  if (background === "blueprint") {
    return `<g opacity=".16" stroke="${GREEN}" fill="none" stroke-width="2" stroke-dasharray="10 16">${Array.from({ length: 9 }, (_, index) => `<rect x="${80 + (index % 3) * 300}" y="${260 + Math.floor(index / 3) * 380}" width="220" height="240" rx="24"/>`).join("")}</g>${grid}`;
  }
  if (background === "radar") {
    return `<g transform="translate(540 760)" fill="none" stroke="${GREEN}" opacity=".18">${[180, 300, 420, 540].map((radius) => `<circle r="${radius}"/>`).join("")}<path d="M0 0 L0 -540 M0 0 L540 0 M0 0 L0 540 M0 0 L-540 0"/></g><path d="M540 760 L540 220 A540 540 0 0 1 850 318 Z" fill="${GREEN}" opacity=".07"/>`;
  }
  return `<g opacity=".16" fill="${GREEN}">${Array.from({ length: 15 }, (_, index) => {
    const x = 80 + index * 70;
    const height = 80 + ((index * 83) % 260);
    return `<rect x="${x}" y="${1200 - height}" width="24" height="${height}" rx="12" transform="scale(1 ${1 + Math.sin(timeMs / 500 + index) * .08})"/>`;
  }).join("")}</g>`;
}

function contractVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const reveal = ease(clamp(progress * 1.8));
  const scanX = 300 + ((timeMs / 8) % 480);
  return `<g opacity="${reveal}">
    <g transform="translate(540 700) rotate(${Math.sin(timeMs / 900) * 1.5})">
      ${panel(-245, -190, 490, 380, "#111D2B", "#5DC7FF")}
      ${text("КОНТРАКТ", 0, -118, { size: 23, color: "#7ED8FF", weight: 800, letterSpacing: 2 })}
      <path d="M-170 -54 H170 M-170 8 H120 M-170 70 H60" stroke="#7C93A7" stroke-width="14" stroke-linecap="round"/>
      <rect x="92" y="106" width="92" height="42" rx="12" fill="#5DC7FF"/>
      ${text(beat.maturityLabel ?? "БУДУЩАЯ ДАТА", 0, 245, { size: 25, color: WHITE, weight: 800 })}
    </g>
    <g transform="translate(190 720)">${panel(-120, -100, 240, 200, "#132338", "#FFB86B")}${text("ПОКУПАТЕЛЬ", 0, -8, { size: 21, color: "#FFB86B", weight: 800 })}${text("цена", 0, 42, { size: 27, color: WHITE, weight: 700 })}</g>
    <g transform="translate(890 720)">${panel(-120, -100, 240, 200, "#132338", "#C795FF")}${text("ПРОДАВЕЦ", 0, -8, { size: 21, color: "#C795FF", weight: 800 })}${text("актив", 0, 42, { size: 27, color: WHITE, weight: 700 })}</g>
    <path d="M315 720 C380 590 430 590 470 650 M610 650 C650 590 700 590 765 720" fill="none" stroke="#7ED8FF" stroke-width="6" stroke-dasharray="12 18" stroke-dashoffset="${-Math.round(timeMs / 7)}"/>
    <rect x="${scanX}" y="450" width="6" height="510" fill="#7ED8FF" opacity=".24"/>
    ${text("Договорённость о цене на будущую дату", 540, 1110, { size: 27, color: WHITE, weight: 700 })}
  </g>`;
}

function leverageVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const level = ease(clamp((progress - 0.12) * 1.45));
  const marker = 250 + level * 580;
  return `${panel(130, 420, 820, 700, "#111B2A", "#FFB86B")}
    ${text("ПЛЕЧО УВЕЛИЧИВАЕТ ПОЗИЦИЮ", 540, 505, { size: 23, color: "#FFB86B", weight: 800, letterSpacing: 1 })}
    ${text("ЗАЛОГ", 190, 660, { size: 22, color: MUTED, weight: 800, anchor: "start" })}
    <rect x="190" y="700" width="700" height="54" rx="27" fill="#27394B"/>
    <rect x="190" y="700" width="${260 * level}" height="54" rx="27" fill="#7ED8FF"/>
    ${text("позиция", 190, 850, { size: 22, color: MUTED, weight: 800, anchor: "start" })}
    <rect x="190" y="890" width="700" height="54" rx="27" fill="#27394B"/>
    <rect x="190" y="890" width="${700 * level}" height="54" rx="27" fill="#FFB86B"/>
    <circle cx="${marker}" cy="917" r="${22 + Math.sin(timeMs / 180) * 4}" fill="#FFF2D7" stroke="#FFB86B" stroke-width="5"/>
    ${badge(beat.metricLabel ?? "ЦЕНА КОНТРАКТА", 540, 1190, "#FFB86B", level, 390)}
    ${text("Маленькое движение цены влияет на большую позицию", 540, 1280, { size: 25, color: WHITE, weight: 700 })}`;
}

function payoffVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const reveal = ease(clamp((progress - 0.1) * 1.3));
  const futuresExample = beat.concept === "futures_contract";
  const shortScenario = futuresExample && /short|95/iu.test(`${beat.title} ${beat.visualAction || ""}`);
  const currentX = futuresExample
    ? shortScenario ? 540 - 320 * ease(progress) : 540 + 320 * ease(progress)
    : 240 + ((timeMs / 18) % 600);
  const currentY = futuresExample
    ? shortScenario ? 850 - (540 - currentX) * (170 / 320) : 850 - (currentX - 540) * 0.8
    : 850 - (currentX - 540) * 0.8;
  const longOpacity = futuresExample && shortScenario ? 0.38 : 1;
  const shortOpacity = futuresExample && !shortScenario ? 0.38 : 0.72;
  const curveReveal = futuresExample ? "" : `stroke-dasharray="${720 * reveal} 720"`;
  return `${panel(130, 410, 820, 720, "#111A2C", "#C795FF")}
    ${text(futuresExample ? "УЧЕБНЫЙ PAYOFF · БЕЗ КОМИССИЙ" : "РЕЗУЛЬТАТ ПРИ РАЗНОЙ ЦЕНЕ", 540, 500, { size: 23, color: "#C795FF", weight: 800, letterSpacing: 1 })}
    <line x1="220" y1="850" x2="880" y2="850" stroke="${MUTED}" stroke-width="3"/>
    <line x1="540" y1="580" x2="540" y2="1040" stroke="${MUTED}" stroke-width="3"/>
    <path d="M220 1010 L540 850 L860 590" fill="none" stroke="#C795FF" stroke-width="10" ${curveReveal} stroke-linecap="round" opacity="${longOpacity}"/>
    <path d="M220 680 L540 850 L860 1010" fill="none" stroke="#FF8D8D" stroke-width="6" ${curveReveal} stroke-linecap="round" opacity="${shortOpacity}"/>
    <circle cx="${currentX}" cy="${currentY}" r="${18 + Math.sin(timeMs / 160) * 4}" fill="#FFFFFF" stroke="${shortScenario ? "#FF8D8D" : "#C795FF"}" stroke-width="5"/>
    ${futuresExample
      ? `${text("ЛОНГ", 300, 650, { size: 22, color: "#C795FF", weight: 850 })}${text("ШОРТ", 780, 650, { size: 22, color: "#FF8D8D", weight: 850 })}${text("95", 220, 900, { size: 21, color: MUTED, weight: 700 })}${text("100 · ВХОД", 540, 900, { size: 21, color: GOLD, weight: 800 })}${text("105", 860, 900, { size: 21, color: MUTED, weight: 700 })}`
      : text("цена актива", 840, 900, { size: 20, color: MUTED, weight: 700 })}
    ${text("прибыль / убыток", 560, 575, { size: 20, color: MUTED, weight: 700 })}
    ${text(beat.maturityLabel ?? "ИСПОЛНЕНИЕ В БУДУЩЕМ", 540, 1190, { size: 27, color: WHITE, weight: 700 })}`;
}

function comparisonVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const reveal = ease(clamp(progress * 1.8));
  const leftScale = 0.94 + Math.sin(timeMs / 420) * 0.025;
  const rightScale = 0.94 + Math.sin(timeMs / 420 + Math.PI) * 0.025;
  return `${panel(90, 420, 430, 650, "#122033", "#5DC7FF")}
    ${panel(560, 420, 430, 650, "#241D31", "#C795FF")}
    <g opacity="${reveal}" transform="translate(305 710) scale(${leftScale})">
      ${text("СЦЕНАРИЙ A", 0, -120, { size: 22, color: "#7ED8FF", weight: 800, letterSpacing: 1 })}
      ${text("ЦЕНА РАСТЁТ", 0, -18, { size: 30, color: WHITE, weight: 900 })}
      <path d="M-120 100 L-55 45 L10 65 L120 -75" fill="none" stroke="#7ED8FF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12" stroke-dashoffset="${-Math.round(timeMs / 5)}"/>
      ${text("+", 0, 160, { size: 38, color: "#7ED8FF", weight: 900 })}
    </g>
    <g opacity="${reveal}" transform="translate(775 710) scale(${rightScale})">
      ${text("СЦЕНАРИЙ B", 0, -120, { size: 22, color: "#C795FF", weight: 800, letterSpacing: 1 })}
      ${text("ЦЕНА ПАДАЕТ", 0, -18, { size: 30, color: WHITE, weight: 900 })}
      <path d="M-120 -75 L-55 35 L10 0 L120 100" fill="none" stroke="#C795FF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12" stroke-dashoffset="${Math.round(timeMs / 5)}"/>
      ${text("−", 0, 160, { size: 38, color: "#C795FF", weight: 900 })}
    </g>
    ${text(beat.metricLabel ?? "ДВА РЕЗУЛЬТАТА", 540, 1160, { size: 27, color: WHITE, weight: 800 })}`;
}

function riskVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const reveal = ease(clamp(progress * 1.8));
  const level = 0.28 + 0.42 * (0.5 + Math.sin(timeMs / 700) * 0.5);
  const markerX = 220 + 640 * level;
  return `${panel(120, 420, 840, 660, "#1E1823", "#FFB86B")}
    ${text("ЛАБОРАТОРИЯ РИСКА", 540, 515, { size: 24, color: "#FFB86B", weight: 800, letterSpacing: 2 })}
    ${text("Доходность", 210, 690, { size: 23, color: MUTED, weight: 700, anchor: "start" })}
    <rect x="210" y="735" width="660" height="38" rx="19" fill="#293442"/>
    <rect x="210" y="735" width="${660 * level * reveal}" height="38" rx="19" fill="#FFB86B" opacity=".9"/>
    <circle cx="${markerX}" cy="754" r="${18 + Math.sin(timeMs / 170) * 3}" fill="#FFF2D7" stroke="#FFB86B" stroke-width="5"/>
    ${text("Низкий риск", 210, 850, { size: 21, color: "#7ED8FF", weight: 700, anchor: "start" })}
    ${text("Высокий риск", 870, 850, { size: 21, color: "#FF8D8D", weight: 700, anchor: "end" })}
    ${text(beat.metricLabel ?? "ПРОВЕРЬ ОГРАНИЧЕНИЯ", 540, 1015, { size: 28, color: WHITE, weight: 800 })}
    ${text("Больше потенциальный результат — выше цена ошибки", 540, 1165, { size: 25, color: GOLD, weight: 700 })}`;
}

function sceneHueRotation(beat: FinancialShortBeat): number {
  if (beat.visual === "contract") return 170;
  if (beat.visual === "leverage") return -92;
  if (beat.visual === "payoff") return 112;
  if (beat.visual === "comparison") return 82;
  if (beat.visual === "risk") return -48;
  if (beat.visual === "market") return 48;
  if (beat.visual === "fund") return 188;
  if (beat.visual === "distribution") return 300;
  if (beat.visual === "ownership") return 228;
  return 0;
}

function renderSceneMotion(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const phase = timeMs / 420;
  const sweepX = 150 + ((timeMs / 5) % 780);
  const ringScale = 1 + Math.sin(phase) * 0.08;
  const motionColor = beat.visual === "payoff" ? "#C795FF" : beat.visual === "leverage" ? "#FFB86B" : "#7ED8FF";
  return `<g pointer-events="none" opacity=".5">
    <circle cx="540" cy="760" r="${300 * ringScale}" fill="none" stroke="${motionColor}" stroke-width="2" stroke-dasharray="5 30" stroke-dashoffset="${-Math.round(timeMs / 4)}"/>
    <circle cx="540" cy="760" r="${350 - Math.sin(phase * .7) * 18}" fill="none" stroke="${motionColor}" stroke-width="2" stroke-dasharray="2 46" stroke-dashoffset="${Math.round(timeMs / 6)}" opacity=".45"/>
    <line x1="${sweepX}" y1="300" x2="${sweepX}" y2="1210" stroke="${motionColor}" stroke-width="4" opacity=".12"/>
    ${Array.from({ length: 8 }, (_, index) => {
      const x = 160 + index * 108 + Math.sin(phase + index) * 16;
      const y = 420 + ((index * 93 + Math.round(timeMs / 3)) % 660);
      return `<circle cx="${x}" cy="${y}" r="${3 + (index % 3) * 2}" fill="${motionColor}" opacity="${.18 + (index % 4) * .08}"/>`;
    }).join("")}
  </g>`;
}

function renderVisual(beat: FinancialShortBeat, progress: number, timeMs: number, beatStartMs: number, beatEndMs: number): string {
  const entry = ease(clamp(progress * 1.7));
  const exit = clamp((1 - progress) * 1.7);
  const actors = beat.concept === "futures_contract"
    ? ""
    : `${actor("investor", 170, 760, entry, timeMs)}${actor("company", 910, 760, entry, timeMs)}`;
  const livePulse = 1 + Math.sin(timeMs / 360) * 0.035;

  if (beat.visual === "ownership") return ownershipVisual(beat, progress, timeMs);
  if (beat.visual === "fund") return fundPoolVisual(beat, progress, timeMs);
  if (beat.visual === "distribution") return distributionVisual(beat, progress, timeMs);
  if (beat.visual === "contract") return contractVisual(beat, progress, timeMs);
  if (beat.visual === "leverage") return leverageVisual(beat, progress, timeMs);
  if (beat.visual === "payoff") return payoffVisual(beat, progress, timeMs);
  if (beat.visual === "comparison") return comparisonVisual(beat, progress, timeMs);
  if (beat.visual === "risk") return riskVisual(beat, progress, timeMs);

  if (beat.visual === "hook") {
    const flowProgress = clamp((progress - 0.24) / 0.76);
    return `${actors}
      <path d="M285 780 C410 570 670 980 795 780" fill="none" stroke="${GREEN}" stroke-width="4" stroke-dasharray="12 18" opacity=".45"/>
      ${coinsAlongCurve(flowProgress, false, GREEN)}
      ${badge(beat.entityLabel ?? "10 000 ₽", 540, 465, GREEN, entry * livePulse, 330)}
      ${text("ДЕНЬГИ СЕЙЧАС", 540, 1110, { size: 25, color: MUTED, weight: 700, letterSpacing: 2 })}`;
  }

  if (beat.visual === "definition") {
    return `${actors}
      ${documentCard(entry, beat.entityLabel ?? "ОБЯЗАТЕЛЬСТВО", beat.definitionCaption)}
      ${text(beat.entityLabel ?? "Облигация", 540, 1090, { size: 36, color: WHITE, weight: 800 })}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "понятная финансовая схема", 540, 1140, { size: 28, color: GREEN, weight: 700 })}`;
  }

  if (beat.visual === "flow") {
    const flowProgress = clamp((progress - 0.15) / 0.72);
    return `${actors}
      <path d="M285 780 C410 570 670 980 795 780" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="12 18" opacity=".58"/>
      ${coinsAlongCurve(flowProgress, false, GREEN)}
      ${badge(beat.entityLabel ?? "ОБЛИГАЦИЯ", 540, 465, GREEN, entry * livePulse, 350)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "Инвестор → компания", 540, 1100, { size: 30, color: WHITE, weight: 700 })}`;
  }

  if (beat.visual === "coupon") {
    const flowProgress = clamp((progress - 0.12) / 0.76);
    return `${actors}
      <path d="M795 780 C670 570 410 980 285 780" fill="none" stroke="#B9F7D8" stroke-width="5" stroke-dasharray="12 18" opacity=".58"/>
      ${coinsAlongCurve(flowProgress, true, "#B9F7D8")}
      ${badge(beat.metricLabel ?? "18% годовых", 540, 465, "#B9F7D8", entry * livePulse, 350)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "Выплата приходит по графику", 540, 1100, { size: 29, color: WHITE, weight: 700 })}`;
  }

  if (beat.visual === "calendar") {
    const months = Math.round(clamp(progress) * 12);
    return `${actors}
      ${panel(170, 490, 740, 400, "#0D1A22", PANEL_EDGE)}
      ${text("ГРАФИК ВЫПЛАТ", 540, 565, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      <line x1="260" y1="720" x2="820" y2="720" stroke="#35505B" stroke-width="8" stroke-linecap="round"/>
      <line x1="260" y1="720" x2="${260 + 560 * clamp(progress)}" y2="720" stroke="${GREEN}" stroke-width="8" stroke-linecap="round"/>
      ${Array.from({ length: 5 }, (_, index) => {
        const x = 260 + index * 140;
        const active = index / 4 <= progress;
        const pulse = active ? 1 + Math.sin(timeMs / 280 + index) * 0.12 : 1;
        return `<circle cx="${x}" cy="720" r="${22 * pulse}" fill="${active ? GREEN : "#20343F"}" stroke="${active ? GREEN : "#3A5360"}" stroke-width="4"/>${text(`${index * 3 || 1} мес.`, x, 790, { size: 20, color: active ? WHITE : MUTED, weight: 700 })}`;
      }).join("")}
      ${text(`${months || 1} / 12 месяцев`, 540, 965, { size: 36, color: WHITE, weight: 800 })}
      ${text("Время работает по плану", 540, 1100, { size: 28, color: GREEN, weight: 700 })}`;
  }

  if (beat.visual === "market") {
    return `${actors}${chartVisual(beat, progress, timeMs)}`;
  }

  if (beat.visual === "maturity") {
    const flowProgress = clamp((progress - 0.18) / 0.7);
    return `${actors}
      <path d="M795 780 C670 570 410 980 285 780" fill="none" stroke="${GOLD}" stroke-width="5" stroke-dasharray="12 18" opacity=".58"/>
      ${coinsAlongCurve(flowProgress, true, GOLD)}
      ${badge(beat.maturityLabel ?? "10 000 ₽", 540, 465, GOLD, entry * livePulse, 330)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "ГЛАВНЫЙ РЕЗУЛЬТАТ", 540, 1100, { size: 28, color: WHITE, weight: 800, letterSpacing: 1 })}`;
  }

  const listEntry = ease(clamp(progress * 2));
  return `${panel(150, 430, 780, 660, "#0D1A22", PANEL_EDGE)}
    ${text("ПЕРЕД ПОКУПКОЙ ПРОВЕРЬ", 540, 525, { size: 24, color: GREEN, weight: 800, letterSpacing: 1.5 })}
    ${(beat.summaryItems ?? [
      ["01", "Срок"],
      ["02", "Доходность"],
      ["03", "Рейтинг эмитента"],
      ["04", "Риск"],
    ]).map((item, index) => {
      const [number, label] = item;
      const itemProgress = ease(clamp((progress - index * 0.12) * 3));
      const y = 640 + index * 110;
      return `<g opacity="${Math.max(0.88, itemProgress)}" transform="translate(${(1 - itemProgress) * 35} 0)">
        <circle cx="280" cy="${y - 10}" r="27" fill="${GREEN}" opacity=".16"/>
        ${text(number, 280, y - 2, { size: 18, color: GREEN, weight: 800 })}
        ${text(label, 340, y, { size: 31, color: WHITE, weight: 700, anchor: "start" })}
      </g>`;
    }).join("")}
    ${text("Доходность выше — риск проверяй внимательнее", 540, 1230, { size: 26, color: GOLD, weight: 700 })}`;
}

function renderFrame(
  timeMs: number,
  durationMs: number,
  beats: FinancialShortBeat[],
  mainTitle = "ЧТО ТАКОЕ ОБЛИГАЦИЯ?",
  background: FinanceBackgroundId = "grid",
  visualTheme: "classic_dark" | "premium_creator" = "classic_dark",
): string {
  const normalized = clamp(timeMs / Math.max(1, durationMs));
  const beat = beats.find((candidate) => normalized >= candidate.from && normalized < candidate.to) ?? beats.at(-1)!;
  const beatIndex = Math.max(0, beats.indexOf(beat));
  const premiumCreator = visualTheme === "premium_creator";
  const sceneBackground = beat.background ?? background;
  const progress = localProgress(normalized, beat.from, beat.to);
  const beatStartMs = beat.from * durationMs;
  const beatEndMs = beat.to * durationMs;
  const sceneIntro = ease(clamp(progress / 0.2));
  const liveCamera = timeMs / 1_000;
  const cameraProgress = ease(clamp((normalized - 0.83) / 0.17));
  const cameraScale = 1 + cameraProgress * 0.035 + Math.sin(liveCamera * 0.7) * 0.004;
  const cameraAction = (beat.cameraAction ?? "locked").toLocaleLowerCase("en-US");
  const panDirection = cameraAction.includes("pan_left") ? -1 : cameraAction.includes("pan_right") ? 1 : 0;
  const followDirection = cameraAction.includes("follow_flow") ? Math.sin(liveCamera * 0.85) : 0;
  const cameraX = -12 * cameraProgress
    + panDirection * ease(progress) * 34
    + followDirection * 12
    + Math.sin(liveCamera * 0.48) * 7;
  const cameraY = -16 * cameraProgress
    + (cameraAction.includes("push_in") ? -18 * ease(progress) : 0)
    + (cameraAction.includes("pull_back") ? 16 * ease(progress) : 0)
    + Math.cos(liveCamera * 0.38) * 5;
  const directedScale = cameraAction.includes("push_in")
    ? 1 + ease(progress) * 0.025
    : cameraAction.includes("pull_back")
      ? 1 - ease(progress) * 0.018
      : 1;
  const subtitleLines = wrapText(beat.subtitle, 35);
  const hueRotation = premiumCreator ? 0 : sceneHueRotation(beat);
  const sceneContent = premiumCreator
    ? `<g transform="translate(300 -150) scale(.82)" filter="url(#scene-hue)">
        ${renderVisual(beat, progress, timeMs, beatStartMs, beatEndMs)}
        ${renderSceneMotion(beat, progress, timeMs)}
      </g>
      ${renderSpokenWordChips(beat, progress, timeMs)}
      ${renderFuturesIconCards(beat, progress, timeMs)}
      ${renderFullPresenter(beat, progress, timeMs)}`
    : `<g filter="url(#scene-hue)">
        ${renderVisual(beat, progress, timeMs, beatStartMs, beatEndMs)}
        ${renderSceneMotion(beat, progress, timeMs)}
      </g>`;
  const captionY = premiumCreator ? 1_485 : 1_390;
  const captionHeight = premiumCreator ? 340 : subtitleLines.length > 2 ? 230 : 190;
  const captionFill = premiumCreator ? "#D7E3D9" : "#0D1A22";
  const captionStroke = premiumCreator ? "#90A894" : PANEL_EDGE;
  const captionTitleColor = premiumCreator ? "#35533C" : GREEN;
  const captionTextColor = premiumCreator ? "#23372A" : WHITE;
  const headingLabelColor = premiumCreator ? "#B7CCBA" : GREEN;
  const headingColor = premiumCreator ? "#F0F4EE" : WHITE;
  const mutedColor = premiumCreator ? "#C0D0C2" : MUTED;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0B151D"/>
        <stop offset="1" stop-color="#050A0E"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="42%" r="58%">
        <stop offset="0" stop-color="#1B6A4A" stop-opacity=".3"/>
        <stop offset="1" stop-color="#071016" stop-opacity="0"/>
      </radialGradient>
      <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
      <filter id="scene-hue"><feColorMatrix type="hueRotate" values="${hueRotation}"/></filter>
    </defs>
    ${premiumCreator
      ? renderPremiumCreatorBackground(timeMs)
      : `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
        <g filter="url(#scene-hue)">${renderBackgroundLayer(sceneBackground, timeMs)}</g>
        <path d="M-120 1240 C220 1080 420 1380 760 1180 S1180 1080 1220 920" fill="none" stroke="${GREEN}" stroke-width="3" stroke-dasharray="8 34" opacity=".2" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>`}
    <g transform="translate(${cameraX} ${cameraY}) scale(${cameraScale * directedScale})">
      <circle cx="540" cy="760" r="380" fill="${GREEN}" opacity=".06" filter="url(#soft-glow)"/>
      ${text("FINANCE / EXPLAINER SHORT", 54, 88, { size: 20, color: headingLabelColor, weight: 700, anchor: "start", letterSpacing: 3 })}
      ${text(mainTitle, 54, 145, { size: 38, color: headingColor, weight: 800, anchor: "start", letterSpacing: 1 })}
      <g filter="url(#scene-hue)" opacity="${sceneIntro}" transform="translate(${(1 - sceneIntro) * 46} ${Math.sin(timeMs / 420) * 3})">
        ${sceneContent}
      </g>
      <rect x="${-80 + sceneIntro * 1240}" y="210" width="12" height="940" rx="6" fill="${GREEN}" opacity="${(1 - sceneIntro) * 0.32}"/>
      <g opacity="${clamp(0.68 + progress * .32)}" transform="translate(0 ${(1 - sceneIntro) * 32})">
        <rect x="${premiumCreator ? 54 : 92}" y="${captionY}" width="${premiumCreator ? 972 : 896}" height="${captionHeight}" rx="34" fill="${captionFill}" stroke="${captionStroke}" stroke-width="2"/>
        ${textLines(beat.title, 540, captionY + 60, 32, 40, { size: 25, color: captionTitleColor, weight: 800 })}
        ${textLines(beat.subtitle, 540, captionY + 140, 35, 42, { size: 26, color: captionTextColor, weight: 600 })}
      </g>
      ${text(`${String(beatIndex + 1).padStart(2, "0")} / ${String(beats.length).padStart(2, "0")}`, 1024, 145, { size: 20, color: mutedColor, weight: 700, anchor: "end", letterSpacing: 2 })}
      ${text("Образовательный ролик • не инвестиционная рекомендация", 540, premiumCreator ? 1_868 : 1_810, { size: 19, color: mutedColor, weight: 500 })}
    </g>
  </svg>`;
}

async function probeDurationMs(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error("Не удалось определить длительность озвучки.");
  return Math.round(seconds * 1_000);
}

async function encodeShort(
  dir: string,
  durationMs: number,
  audioPath: string,
  beats: FinancialShortBeat[],
  mainTitle: string,
  background: FinanceBackgroundId = "grid",
  visualTheme: "classic_dark" | "premium_creator" = "classic_dark",
): Promise<Buffer> {
  const frameCount = Math.ceil(durationMs / 1_000 * FPS);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const timeMs = Math.min(durationMs - 1, Math.round(frame * 1_000 / FPS));
    await writeFile(
      join(dir, `frame-${String(frame).padStart(5, "0")}.svg`),
      renderFrame(timeMs, durationMs, beats, mainTitle, background, visualTheme),
      "utf8",
    );
  }

  const output = join(dir, "financial-explainer-short.mp4");
  await execFileAsync("ffmpeg", [
    "-y",
    "-framerate", String(FPS),
    "-start_number", "0",
    "-i", join(dir, "frame-%05d.svg"),
    "-i", audioPath,
    "-t", String(durationMs / 1_000),
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-c:v", "libx264",
    "-preset", "veryfast",
    "-crf", "19",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-shortest",
    "-movflags", "+faststart",
    output,
  ], { timeout: 30 * 60 * 1_000, maxBuffer: 20 * 1024 * 1024 });
  return readFile(output);
}

async function generateFinancialSpeech(text: string): Promise<Buffer> {
  return generateSpeech(
    prepareSpeechText(text),
    getConfiguredVoiceId(),
    getElevenLabsModel(),
    {
      speed: 0.98,
      stability: 0.52,
      similarity: 0.78,
      style: 0.2,
      speakerBoost: true,
    },
  );
}

async function concatenateAudio(dir: string, audioPaths: string[]): Promise<string> {
  const listPath = join(dir, "audio-list.txt");
  const list = audioPaths
    .map((path) => `file '${path.replaceAll("'", "'\\\\''")}'`)
    .join("\n");
  await writeFile(listPath, `${list}\n`, "utf8");
  const output = join(dir, "voice-segmented.mp3");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listPath,
    "-c:a", "libmp3lame",
    "-q:a", "3",
    output,
  ], { timeout: 10 * 60 * 1_000, maxBuffer: 20 * 1024 * 1024 });
  return output;
}

async function renderPlan(plan: FinancialShortRenderPlan): Promise<{ buffer: Buffer; durationMs: number }> {
  const dir = await mkdtemp(join(tmpdir(), "financial-short-"));
  try {
    let audioPath: string;
    let durationMs: number;
    let beats = plan.beats;
    const canSegmentVoice = plan.beats.length > 0 && plan.beats.every((beat) => beat.voiceText?.trim());
    if (canSegmentVoice) {
      const segmentPaths: string[] = [];
      const segmentDurations: number[] = [];
      for (const [index, beat] of plan.beats.entries()) {
        const voice = await generateFinancialSpeech(beat.voiceText!);
        const segmentPath = join(dir, `voice-${String(index).padStart(2, "0")}.mp3`);
        await writeFile(segmentPath, voice);
        segmentPaths.push(segmentPath);
        segmentDurations.push(await probeDurationMs(segmentPath));
      }
      const segmentedDuration = segmentDurations.reduce((sum, value) => sum + value, 0);
      let elapsed = 0;
      beats = plan.beats.map((beat, index) => {
        const from = elapsed / Math.max(1, segmentedDuration);
        elapsed += segmentDurations[index]!;
        const to = index === plan.beats.length - 1
          ? 1
          : elapsed / Math.max(1, segmentedDuration);
        return { ...beat, from, to };
      });
      audioPath = await concatenateAudio(dir, segmentPaths);
      durationMs = await probeDurationMs(audioPath);
    } else {
      const voice = await generateFinancialSpeech(plan.script);
      audioPath = join(dir, "voice.mp3");
      await writeFile(audioPath, voice);
      durationMs = await probeDurationMs(audioPath);
    }
    if (durationMs > 180_000) throw new Error("Озвучка получилась длиннее лимита 3 минут.");
    const buffer = await encodeShort(
      dir,
      durationMs,
      audioPath,
      beats,
      plan.mainTitle,
      plan.background,
      plan.visualTheme,
    );
    return { buffer, durationMs };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function renderFinancialExplainerShort(): Promise<{
  buffer: Buffer;
  durationMs: number;
  sceneCount: number;
  script: string;
}> {
  const plan: FinancialShortRenderPlan = {
    title: "Как работает облигация",
    mainTitle: "ЧТО ТАКОЕ ОБЛИГАЦИЯ?",
    script: FINANCIAL_SHORT_SCRIPT,
    beats: SHORT_BEATS,
    background: "grid",
  };
  const rendered = await renderPlan(plan);
  return {
    ...rendered,
    sceneCount: SHORT_BEATS.length,
    script: FINANCIAL_SHORT_SCRIPT,
  };
}

export async function renderFinancialTopicShort(plan: FinancialShortRenderPlan): Promise<{
  buffer: Buffer;
  durationMs: number;
  sceneCount: number;
  script: string;
}> {
  if (!plan.beats.length) throw new Error("Финансовый animation plan не содержит сцен.");
  const rendered = await renderPlan(plan);
  return {
    ...rendered,
    sceneCount: plan.beats.length,
    script: plan.script,
  };
}