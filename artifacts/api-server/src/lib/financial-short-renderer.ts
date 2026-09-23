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
import { FINANCE_STYLE_DNA, type FinanceBackgroundId } from "./finance-style-dna";

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
  | "ownership"
  | "fund"
  | "distribution"
  | "summary";

export type FinancialConcept =
  | "bond_flow"
  | "equity_split"
  | "fund_pool"
  | "profit_distribution"
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

function renderVisual(beat: FinancialShortBeat, progress: number, timeMs: number, beatStartMs: number, beatEndMs: number): string {
  const entry = ease(clamp(progress * 1.7));
  const exit = clamp((1 - progress) * 1.7);
  const actors = `${actor("investor", 170, 760, entry, timeMs)}${actor("company", 910, 760, entry, timeMs)}`;
  const livePulse = 1 + Math.sin(timeMs / 360) * 0.035;

  if (beat.visual === "ownership") return ownershipVisual(beat, progress, timeMs);
  if (beat.visual === "fund") return fundPoolVisual(beat, progress, timeMs);
  if (beat.visual === "distribution") return distributionVisual(beat, progress, timeMs);

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
    const chartProgress = clamp((progress - 0.12) / 0.7);
    const pointX = 290 + chartProgress * 490;
    const pointY = 800 - Math.sin(chartProgress * Math.PI * 2.4) * 110 - chartProgress * 70;
    return `${actors}
      ${panel(150, 430, 780, 550, "#0D1A22", PANEL_EDGE)}
      ${text("ЦЕНА НА БИРЖЕ", 540, 505, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      <path d="M250 850 L330 790 L420 825 L515 680 L600 745 L690 620 L820 700" fill="none" stroke="${GOLD}" stroke-width="${7 + Math.sin(timeMs / 260) * 1.5}" stroke-linecap="round" stroke-linejoin="round" opacity="${Math.max(0.3, chartProgress)}"/>
      <circle cx="${pointX}" cy="${pointY}" r="18" fill="${GOLD}" opacity="${Math.max(0.6, chartProgress)}"/>
      <circle cx="${pointX}" cy="${pointY}" r="${28 + Math.sin(timeMs / 180) * 5}" fill="none" stroke="${GOLD}" stroke-width="3" opacity=".38"/>
      ${text("цена может расти и падать", 540, 1060, { size: 29, color: WHITE, weight: 700 })}
      ${badge("НЕ ДЕПОЗИТ", 540, 1170, GOLD, entry, 330)}`;
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
): string {
  const normalized = clamp(timeMs / Math.max(1, durationMs));
  const beat = beats.find((candidate) => normalized >= candidate.from && normalized < candidate.to) ?? beats.at(-1)!;
  const beatIndex = Math.max(0, beats.indexOf(beat));
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
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
    <g opacity=".12">
      ${Array.from({ length: 16 }, (_, index) => `<line x1="${index * 72}" y1="0" x2="${index * 72}" y2="${HEIGHT}" stroke="${GREEN}" stroke-width="1"/>`).join("")}
      ${Array.from({ length: 28 }, (_, index) => `<line x1="0" y1="${index * 72}" x2="${WIDTH}" y2="${index * 72}" stroke="${GREEN}" stroke-width="1"/>`).join("")}
    </g>
    ${background === "particles"
      ? `<g fill="${GREEN}" opacity=".18">${Array.from({ length: 24 }, (_, index) => {
        const x = 44 + ((index * 173) % 990);
        const y = 210 + ((index * 311) % 1360);
        const radius = 3 + (index % 4) * 2;
        return `<circle cx="${x}" cy="${y}" r="${radius}"/><circle cx="${(x + 120) % WIDTH}" cy="${y + 54}" r="2"/>`;
      }).join("")}</g>`
      : ""}
    ${background === "terminal"
      ? `<g opacity=".12">${Array.from({ length: 12 }, (_, index) => `<line x1="48" y1="${250 + index * 118}" x2="${1030 - (index % 3) * 90}" y2="${250 + index * 118}" stroke="${GREEN}" stroke-width="2" stroke-dasharray="${18 + (index % 4) * 11} 22"/>`).join("")}</g>`
      : ""}
    <path d="M-120 1240 C220 1080 420 1380 760 1180 S1180 1080 1220 920" fill="none" stroke="${GREEN}" stroke-width="3" stroke-dasharray="8 34" opacity=".2" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>
    <g transform="translate(${cameraX} ${cameraY}) scale(${cameraScale * directedScale})">
      <circle cx="540" cy="760" r="380" fill="${GREEN}" opacity=".06" filter="url(#soft-glow)"/>
      ${text("FINANCE / EXPLAINER SHORT", 54, 88, { size: 20, color: GREEN, weight: 700, anchor: "start", letterSpacing: 3 })}
      ${text(mainTitle, 54, 145, { size: 38, color: WHITE, weight: 800, anchor: "start", letterSpacing: 1 })}
      <g opacity="${sceneIntro}" transform="translate(${(1 - sceneIntro) * 46} ${Math.sin(timeMs / 420) * 3})">
        ${renderVisual(beat, progress, timeMs, beatStartMs, beatEndMs)}
      </g>
      <rect x="${-80 + sceneIntro * 1240}" y="210" width="12" height="940" rx="6" fill="${GREEN}" opacity="${(1 - sceneIntro) * 0.32}"/>
      <g opacity="${clamp(0.68 + progress * .32)}" transform="translate(0 ${(1 - sceneIntro) * 32})">
        <rect x="92" y="1390" width="896" height="${subtitleLines.length > 2 ? 230 : 190}" rx="34" fill="#0D1A22" stroke="${PANEL_EDGE}" stroke-width="2"/>
        ${textLines(beat.title, 540, 1450, 32, 40, { size: 25, color: GREEN, weight: 800 })}
        ${textLines(beat.subtitle, 540, 1530, 35, 42, { size: 26, color: WHITE, weight: 600 })}
      </g>
      ${text(`${String(beatIndex + 1).padStart(2, "0")} / ${String(beats.length).padStart(2, "0")}`, 1024, 145, { size: 20, color: MUTED, weight: 700, anchor: "end", letterSpacing: 2 })}
      ${text("Образовательный ролик • не инвестиционная рекомендация", 540, 1810, { size: 19, color: MUTED, weight: 500 })}
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
): Promise<Buffer> {
  const frameCount = Math.ceil(durationMs / 1_000 * FPS);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const timeMs = Math.min(durationMs - 1, Math.round(frame * 1_000 / FPS));
    await writeFile(
      join(dir, `frame-${String(frame).padStart(5, "0")}.svg`),
      renderFrame(timeMs, durationMs, beats, mainTitle, background),
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