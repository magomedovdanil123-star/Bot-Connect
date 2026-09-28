import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  getSpeechProvider,
  prepareSpeechText,
} from "./audio-generation/elevenlabs-client";
import { getVoiceApiModelId } from "./audio-generation/voice-api-client";
import { generateLumeanSpeech } from "./audio-generation/lumean-client";
import { readAudioAsset, storeAudioAsset } from "./audio-design/storage";
import type { FinancialTopicVoiceSegment } from "@workspace/db";
import {
  FINANCE_STYLE_DNA,
  type FinanceBackgroundId,
  type FinanceChartKind,
} from "./finance-style-dna";
import {
  getSpeechWordTimings,
  getPresenterAnimationState,
  renderFullPresenter,
  renderPremiumCreatorBackground,
  renderPresenterImage,
  renderSpeechSubtitle,
  type PresenterAnimationState,
  type PresenterPose,
} from "./financial-presenter";
import { extractFinancialNumberPhrases, type FinancialNumberPhrase } from "./financial-number-phrases";
import type {
  CryptoF2EntryAnimation,
  CryptoF2ExitAnimation,
  CryptoF2MotionAction,
  CryptoF2ObjectMotif,
  CryptoF2SceneTransition,
} from "./crypto-f2-motion";
import type { CoinOverviewMarketData } from "./coin-overview-data";
import type { MarketFocusMarketData } from "./coin-market-focus-data";

const execFileAsync = promisify(execFile);

const WIDTH = FINANCE_STYLE_DNA.width;
const HEIGHT = FINANCE_STYLE_DNA.height;
const FPS = FINANCE_STYLE_DNA.fps;
const CRYPTO_F2_SUBTITLE_Y_OFFSET = 80;
const FONT = FINANCE_STYLE_DNA.typography.family;
const GREEN = FINANCE_STYLE_DNA.colors.green;
const WHITE = FINANCE_STYLE_DNA.colors.white;
const MUTED = FINANCE_STYLE_DNA.colors.muted;
const PANEL = FINANCE_STYLE_DNA.colors.panel;
const PANEL_EDGE = FINANCE_STYLE_DNA.colors.panelEdge;
const GOLD = FINANCE_STYLE_DNA.colors.gold;
const WORKSPACE_ROOT = existsSync(join(process.cwd(), "attached_assets"))
  ? process.cwd()
  : join(process.cwd(), "..", "..");
const FINANCIAL_PRESENTER_POSE_DIR = join(
  WORKSPACE_ROOT,
  "attached_assets",
  "generated_images",
);
const CRYPTO_F2_MUSIC_BED_PATH = join(
  WORKSPACE_ROOT,
  "artifacts",
  "api-server",
  "assets",
  "audio",
  "crypto-f2-music-bed.mp3",
);
const COIN_OVERVIEW_MUSIC_BED_PATH = join(
  WORKSPACE_ROOT,
  "artifacts",
  "api-server",
  "assets",
  "audio",
  "coin-overview-music-bed.mp3",
);
const financialPresenterDataUris = new Map<string, string>();

function getFinancialPresenterAssetPath(state: PresenterAnimationState): string {
  const mouthState = state.mouthOpen ? "transparent" : "closed-transparent";
  const path = join(
    FINANCIAL_PRESENTER_POSE_DIR,
    `finance-explainer-host-${state.pose}-${mouthState}.png`,
  );
  if (!existsSync(path)) {
    throw new Error(`Не найден кадр ведущего: ${path}`);
  }
  return path;
}

function getFinancialPresenterDataUri(state: PresenterAnimationState): string {
  const path = getFinancialPresenterAssetPath(state);
  let dataUri = financialPresenterDataUris.get(path);
  if (!dataUri) {
    dataUri = `data:image/png;base64,${readFileSync(path).toString("base64")}`;
    financialPresenterDataUris.set(path, dataUri);
  }
  return dataUri;
}

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
  | "compound_growth"
  | "summary";

export type FinancialConcept =
  | "bond_flow"
  | "equity_split"
  | "fund_pool"
  | "profit_distribution"
  | "compound_interest"
  | "futures_contract"
  | "generic_finance";

export type FinancialVisualMomentKind =
  | "concept_card"
  | "document"
  | "money_flow"
  | "metric"
  | "market_chart"
  | "comparison"
  | "timeline"
  | "ownership"
  | "portfolio"
  | "distribution"
  | "risk"
  | "compound_growth"
  | "reinvestment"
  | "payoff"
  | "sticker";

export type FinancialVisualPosition =
  | "top_left"
  | "top_center"
  | "top_right"
  | "center_left"
  | "center"
  | "center_right"
  | "hero";

export type FinancialVisualPresentation =
  | "card"
  | "sticker"
  | "image_sticker"
  | "cutout_object"
  | "document"
  | "infographic"
  | "notification"
  | "icon_bubble"
  | "highlighted_word"
  | "number_counter";

export type FinancialEntryAnimation = CryptoF2EntryAnimation;

export type FinancialExitAnimation = CryptoF2ExitAnimation;

export type FinancialSceneTransition = CryptoF2SceneTransition;

export type FinancialComposition =
  | "center"
  | "presenter_left"
  | "presenter_right"
  | "feature_card";

export type PresenterLayout = "center" | "left" | "right" | "large";

export type FinancialRasterAsset = {
  dataUri: string;
  medium: "licensed_photo" | "ai_illustration" | "ai_cutout";
  renderMode: "photo" | "cutout";
  title: string;
  sourceUrl?: string;
  creator?: string | null;
  license?: string;
  licenseUrl?: string | null;
};

export type FinancialVisualMoment = {
  id: string;
  voiceExcerpt: string;
  from: number;
  to: number;
  kind: FinancialVisualMomentKind;
  presentationStyle: FinancialVisualPresentation;
  label: string;
  value?: string;
  detail?: string;
  sourceLabel?: string;
  targetLabel?: string;
  position: FinancialVisualPosition;
  enterAnimation: FinancialEntryAnimation;
  exitAnimation: FinancialExitAnimation;
  motionAction?: CryptoF2MotionAction;
  objectMotif?: CryptoF2ObjectMotif;
  motionVariant?: number;
  assetId?: string;
  microBeats?: FinancialVisualMicroBeat[];
};

export type FinancialMicroBeatKind =
  | "keyword"
  | "object"
  | "sticker"
  | "arrow"
  | "number"
  | "highlight";

export type FinancialMicroBeatPosition =
  | "left"
  | "right"
  | "upper_left"
  | "upper_right";

export type FinancialVisualMicroBeat = {
  id: string;
  kind: FinancialMicroBeatKind;
  cueExcerpt: string;
  text: string;
  from: number;
  to: number;
  position: FinancialMicroBeatPosition;
  enterAnimation: FinancialEntryAnimation;
  exitAnimation: FinancialExitAnimation;
  motionVariant?: number;
  holdWords: number;
};

export type FinancialShortBeat = {
  id: string;
  from: number;
  to: number;
  visual: FinancialVisualKind;
  title: string;
  subtitle: string;
  voiceText?: string;
  lipSyncText?: string;
  visualAction?: string;
  cameraAction?: string;
  transitionIn?: FinancialSceneTransition;
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
  visualMoments?: FinancialVisualMoment[];
  composition?: FinancialComposition;
  presenterLayout?: PresenterLayout;
  presenterPose?: PresenterPose;
};

const SHORT_BEATS: FinancialShortBeat[] = [
  {
    id: "hook",
    from: 0,
    to: 0.09,
    visual: "hook",
    title: "ОБЛИГАЦИЯ — ЭТО РАСПИСКА",
    subtitle: "Ты даёшь деньги сейчас — и заранее знаешь условия возврата.",
    lipSyncText: "Облигация — это по сути расписка с понятными условиями.",
  },
  {
    id: "definition",
    from: 0.09,
    to: 0.22,
    visual: "definition",
    title: "КОМУ НУЖНЫ ДЕНЬГИ?",
    subtitle: "Компания занимает деньги не у одного банка, а у множества инвесторов.",
    lipSyncText: "Представь: компании нужны деньги на развитие. Она может взять кредит в банке, а может занять деньги у инвесторов.",
  },
  {
    id: "flow",
    from: 0.22,
    to: 0.39,
    visual: "flow",
    title: "ТЫ ПОКУПАЕШЬ ОБЛИГАЦИЮ",
    subtitle: "Деньги переходят компании. Облигация фиксирует её обязательство.",
    lipSyncText: "Компания выпускает облигации. Ты покупаешь одну из них и даёшь компании деньги сейчас.",
  },
  {
    id: "coupon",
    from: 0.39,
    to: 0.55,
    visual: "coupon",
    title: "КУПОН — ЭТО ПРОЦЕНТ",
    subtitle: "Например: 18% годовых. Выплаты могут приходить частями.",
    lipSyncText: "Взамен компания обещает две вещи: платить процент — это купон, и вернуть номинал облигации в определённую дату.",
  },
  {
    id: "calendar",
    from: 0.55,
    to: 0.66,
    visual: "calendar",
    title: "СРОК: 1 ГОД",
    subtitle: "Купоны приходят по графику, а срок постепенно заканчивается.",
    lipSyncText: "Например, ты купил облигацию за десять тысяч рублей на один год с купоном восемнадцать процентов годовых. Это не значит, что ты сразу получишь тысячу восемьсот рублей. Купон может приходить частями — например, каждый квартал.",
  },
  {
    id: "market",
    from: 0.66,
    to: 0.79,
    visual: "market",
    title: "ЭТО НЕ ДЕПОЗИТ",
    subtitle: "Цена облигации на бирже может меняться каждый день.",
    lipSyncText: "Но облигация — не депозит. Пока она торгуется на бирже, её цена может меняться каждый день. Если продать облигацию раньше срока, можно заработать, а можно получить меньше вложенной суммы.",
  },
  {
    id: "maturity",
    from: 0.79,
    to: 0.91,
    visual: "maturity",
    title: "ВОЗВРАТ НОМИНАЛА",
    subtitle: "Если дождаться погашения, компания возвращает сам номинал.",
    lipSyncText: "В конце срока компания возвращает тебе сами десять тысяч рублей. Это и есть возврат номинала.",
  },
  {
    id: "summary",
    from: 0.91,
    to: 1,
    visual: "summary",
    title: "ПРОВЕРЬ РИСК",
    subtitle: "Срок, доходность, рейтинг и надёжность эмитента важнее красивого процента.",
    lipSyncText: "Поэтому перед покупкой смотри на срок, доходность, кредитный рейтинг и риск эмитента. Коротко: ты даёшь деньги компании или государству, получаешь купоны по пути, а в конце — номинал. Чем выше обещанная доходность, тем внимательнее нужно проверять риск.",
  },
];

export type FinancialShortRenderPlan = {
  title: string;
  mainTitle: string;
  script: string;
  beats: FinancialShortBeat[];
  visualAssets?: Record<string, FinancialRasterAsset>;
  background?: FinanceBackgroundId;
  visualTheme?: "classic_dark" | "premium_creator" | "crypto_f2" | "coin_overview" | "market_focus_24h";
  coinOverviewData?: CoinOverviewMarketData;
  marketFocusData?: MarketFocusMarketData;
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
  const span = endMs - startMs;
  if (span <= 0) return timeMs >= endMs ? 1 : 0;
  return clamp((timeMs - startMs) / span);
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

function fitHeaderTitle(value: string, maxChars = 34): string {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxChars) return normalized;

  let fitted = "";
  for (const word of normalized.split(" ")) {
    const candidate = fitted ? `${fitted} ${word}` : word;
    if (candidate.length > maxChars - 1) break;
    fitted = candidate;
  }
  return fitted ? `${fitted}…` : `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
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

function kineticTextLines(
  value: string,
  x: number,
  y: number,
  maxChars: number,
  lineHeight: number,
  progress: number,
  options: { size?: number; color?: string; weight?: number; anchor?: "start" | "middle" } = {},
  animation = "reveal",
): string {
  const lines = wrapText(value, maxChars);
  return lines.map((line, index) => {
    const reveal = ease(clamp((progress - index * 0.055) / 0.22));
    const lift = animation.includes("slide") ? 20 : 11;
    const scale = animation.includes("pop") ? 0.96 + reveal * 0.04 : 1;
    return `<g opacity="${reveal.toFixed(3)}" transform="translate(0 ${((1 - reveal) * lift).toFixed(1)})">
      <g transform="translate(${x} ${y + index * lineHeight}) scale(${scale.toFixed(3)}) translate(${-x} ${-(y + index * lineHeight)})">${text(line, x, y + index * lineHeight, options)}</g>
    </g>`;
  }).join("");
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
  const labelSize = Math.max(14, Math.min(22, 240 / Math.max(1, label.length)));
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" opacity="${entry}">
    <rect x="-72" y="-52" width="144" height="104" rx="22" fill="#142B26" stroke="${color}" stroke-width="3"/>
    ${text(label, 0, 9, { size: labelSize, color: WHITE, weight: 800 })}
  </g>`;
}

function ownershipVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const split = clamp((progress - 0.14) / 0.6);
  const shares = [
    [350, 600, "АКЦИЯ"], [730, 600, "АКЦИЯ"], [430, 820, "АКЦИЯ"],
    [650, 820, "АКЦИЯ"], [540, 900, "АКЦИЯ"],
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
    ["АКЦИИ", GREEN], ["ОБЛИГАЦИИ", GOLD], ["ЗОЛОТО", "#D7C27C"], ["ДРУГИЕ АКТИВЫ", "#B9F7D8"],
  ];
  return `${investors.map(([x, y], index) => {
      const local = ease(clamp(progress * 2.1 - index * 0.18));
      return `<g transform="translate(${x + (1 - local) * -70} ${y + Math.sin(timeMs / 700 + index) * 5})" opacity="${local}">
        <circle r="48" fill="#142B26" stroke="${GREEN}" stroke-width="3"/>
        ${text("₽", 0, 14, { size: 33, color: GREEN, weight: 800 })}
      </g>`;
    }).join("")}
    ${investors.map(([x, y]) => `<path d="M${x + 58} ${y} C300 ${y} 340 760 430 760" fill="none" stroke="${GREEN}" stroke-width="4" stroke-dasharray="9 18" opacity="${poolEntry * 0.8}" stroke-dashoffset="${-Math.round(timeMs / 7)}"/>`).join("")}
    ${assets.map(([, color], index) => {
      const angle = -1.05 + index * 0.7 + Math.sin(timeMs / 1200) * 0.04;
      const x = 540 + Math.cos(angle) * 250;
      const y = 760 + Math.sin(angle) * 250;
      return `<path d="M540 760L${x.toFixed(1)} ${y.toFixed(1)}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="7 12" opacity="${assetEntry * 0.46}" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>`;
    }).join("")}
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
    ${text("ДОЛИ ПОРТФЕЛЯ · СХЕМА", 540, 1080, { size: 20, color: MUTED, weight: 750, letterSpacing: 1 })}
    ${text(beat.entityLabel ?? "ПАЕВОЙ ФОНД", 540, 1150, { size: 31, color: GREEN, weight: 800 })}`;
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
        ${text(`АКЦИОНЕР ${label}`, 0, 118, { size: 18, color: WHITE, weight: 800 })}
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

function compoundGrowthVisual(beat: FinancialShortBeat, progress: number, timeMs: number): string {
  const values = ["100 000 ₽", "110 000 ₽", "121 000 ₽"];
  const activeStep = Math.min(values.length - 1, Math.floor(clamp(progress) * values.length));
  const chartProgress = ease(clamp((progress - 0.08) / 0.86));
  const points = [[230, 970], [410, 860], [590, 715], [780, 525]];
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
  const lastX = 230 + (780 - 230) * chartProgress;
  const lastY = 970 - (970 - 525) * chartProgress;
  const count = Math.min(points.length, Math.max(1, Math.ceil(chartProgress * points.length)));

  return `${panel(110, 390, 860, 770, "#131C1B", "#78D6B0")}
    ${text("КАПИТАЛИЗАЦИЯ ПРОЦЕНТА", 540, 482, { size: 24, color: "#78D6B0", weight: 850, letterSpacing: 1.4 })}
    <path d="${line}" fill="none" stroke="#78D6B0" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="${chartProgress.toFixed(3)} 1"/>
    ${points.slice(0, count).map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${index === activeStep ? 21 + Math.sin(timeMs / 180) * 3 : 13}" fill="${index <= activeStep ? "#E8BD70" : "#293A33"}" stroke="${index <= activeStep ? "#FFF0C9" : "#63766C"}" stroke-width="3"/>`).join("")}
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="13" fill="#F0C579" opacity=".9"/>
    ${values.map((value, index) => {
      const x = 270 + index * 265;
      const y = 1050 - index * 115;
      const reached = index <= activeStep;
      return `<g opacity="${reached ? 1 : .42}" transform="translate(0 ${reached ? 0 : 10})">
        <rect x="${x - 115}" y="${y - 61}" width="230" height="76" rx="22" fill="${reached ? "#1C3027" : "#17221D"}" stroke="${reached ? "#78D6B0" : "#384B40"}" stroke-width="2"/>
        ${text(value, x, y - 13, { size: 26, color: reached ? WHITE : MUTED, weight: 850 })}
        ${text(index === 0 ? "СТАРТ" : `ПЕРИОД ${index}`, x, y + 13, { size: 13, color: "#D0B378", weight: 750, letterSpacing: 1 })}
      </g>`;
    }).join("")}
    ${text(beat.subtitle.length < 52 ? beat.subtitle : "Проценты добавляются к капиталу", 540, 1210, { size: 25, color: WHITE, weight: 700 })}
    ${text("УСЛОВНЫЙ ПРИМЕР · НЕ ПРОГНОЗ ДОХОДНОСТИ", 540, 1270, { size: 17, color: "#C9C1B3", weight: 700, letterSpacing: 1 })}`;
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
  if (beat.visual === "compound_growth") return 156;
  return 0;
}

const CAMERA_FOCAL_POINTS: Record<FinancialVisualPosition, { x: number; y: number }> = {
  top_left: { x: 352, y: 325 },
  top_center: { x: 540, y: 322 },
  top_right: { x: 728, y: 325 },
  center_left: { x: 352, y: 510 },
  center: { x: 540, y: 510 },
  center_right: { x: 728, y: 510 },
  hero: { x: 540, y: 438 },
};

function cameraFocalPoint(position?: FinancialVisualPosition): { x: number; y: number } {
  return position ? CAMERA_FOCAL_POINTS[position] : { x: 540, y: 486 };
}

function defaultCameraActionForVisual(visual: FinancialVisualKind, beatIndex = 0): string {
  const alternate = beatIndex % 2 === 1;
  if (visual === "hook" || visual === "definition" || visual === "leverage") {
    return alternate ? "push_in_focus_shift" : "push_in";
  }
  if (visual === "flow" || visual === "coupon" || visual === "maturity") {
    return alternate ? "tracking_parallax" : "follow_flow";
  }
  if (visual === "calendar" || visual === "distribution" || visual === "ownership") {
    return alternate ? "pan_left" : "pan_right";
  }
  if (visual === "compound_growth") return alternate ? "orbit_focus_shift" : "push_in";
  if (visual === "market" || visual === "payoff" || visual === "comparison") {
    return alternate ? "pan_right" : "pan_left";
  }
  if (visual === "risk" || visual === "summary") return alternate ? "focus_shift" : "pull_back";
  return alternate ? "tracking" : "parallax";
}

function cameraActionForBeat(beat: FinancialShortBeat, beatIndex: number): string {
  const requested = (beat.cameraAction ?? "").toLocaleLowerCase("en-US");
  return !requested || requested === "locked"
    ? defaultCameraActionForVisual(beat.visual, beatIndex)
    : requested;
}

function renderTransitionSweep(
  progress: number,
  accent: string,
  transition: FinancialSceneTransition,
): string {
  if (transition === "cut") return "";
  const reveal = ease(clamp(progress / 0.08));
  const opacity = 0.28 * (1 - reveal);

  if (transition === "light_flash") {
    const flash = Math.sin(Math.PI * clamp(progress / 0.12));
    return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#F7F1E7" opacity="${(flash * 0.22).toFixed(3)}" pointer-events="none"/>`;
  }
  if (transition === "radial_wipe" || transition === "zoom_blur") {
    const radius = 105 + reveal * 720;
    return `<g pointer-events="none" opacity="${opacity.toFixed(3)}">
      <circle cx="540" cy="820" r="${radius.toFixed(1)}" fill="none" stroke="${accent}" stroke-width="${transition === "zoom_blur" ? 42 : 28}"/>
      <circle cx="540" cy="820" r="${(radius - 34).toFixed(1)}" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="8 24" stroke-dashoffset="${-Math.round(reveal * 260)}"/>
    </g>`;
  }
  if (transition === "center_split_wipe") {
    const opening = 540 * reveal;
    return `<g pointer-events="none" opacity="${opacity.toFixed(3)}">
      <path d="M0 190H${(540 - opening).toFixed(1)}V1470H0Z" fill="${accent}"/>
      <path d="M1080 190H${(540 + opening).toFixed(1)}V1470H1080Z" fill="${accent}"/>
    </g>`;
  }
  if (transition === "vertical_wipe") {
    const y = -180 + reveal * 1_820;
    return `<rect x="0" y="${y.toFixed(1)}" width="${WIDTH}" height="130" fill="${accent}" opacity="${opacity.toFixed(3)}" pointer-events="none"/>`;
  }
  const x = -210 + reveal * 1_470;
  return `<rect x="${x.toFixed(1)}" y="190" width="190" height="1280" fill="${accent}" opacity="${opacity.toFixed(3)}" transform="skewX(-12)" pointer-events="none"/>`;
}

function renderSceneMotion(
  beat: FinancialShortBeat,
  progress: number,
  timeMs: number,
  premiumCreator = false,
): string {
  const phase = timeMs / 420;
  const motionColor = beat.visual === "payoff" ? "#C795FF" : beat.visual === "leverage" ? "#FFB86B" : "#7ED8FF";
  if (premiumCreator) {
    const sweepX = 470 + ((timeMs / 5) % 520);
    const glowY = 450 + ((Math.round(timeMs / 7) + 310) % 560);
    const opacity = 0.08 + ease(progress * 1.6) * 0.055;
    return `<g pointer-events="none" opacity="${opacity.toFixed(3)}">
      <path d="M${sweepX.toFixed(1)} 410V1090" stroke="${motionColor}" stroke-width="2" opacity=".48"/>
      <circle cx="${sweepX.toFixed(1)}" cy="${glowY}" r="7" fill="${motionColor}" opacity=".56"/>
      <path d="M${(sweepX - 20).toFixed(1)} ${glowY}H${(sweepX + 20).toFixed(1)}" stroke="${motionColor}" stroke-width="2" opacity=".42"/>
    </g>`;
  }
  const sweepX = 150 + ((timeMs / 5) % 780);
  const ringScale = 1 + Math.sin(phase) * 0.08;
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

function momentAccent(kind: FinancialVisualMomentKind): string {
  if (kind === "risk") return "#D27662";
  if (kind === "compound_growth" || kind === "reinvestment" || kind === "market_chart") return "#78D6B0";
  if (kind === "comparison" || kind === "payoff") return "#B796E8";
  return "#E0B56F";
}

function momentCardRadius(presentation: FinancialVisualPresentation): number {
  if (presentation === "document") return 14;
  if (presentation === "sticker" || presentation === "image_sticker" || presentation === "icon_bubble") return 42;
  if (presentation === "notification" || presentation === "highlighted_word" || presentation === "number_counter") return 24;
  return 32;
}

function countUpVisualValue(value: string, progress: number): string {
  const match = value.match(/-?\d[\d \u00a0\u202f]*(?:[.,]\d+)?/u);
  if (!match || match.index === undefined) return value;
  const numericValue = Number(match[0].replace(/[ \u00a0\u202f]/gu, "").replace(",", "."));
  if (!Number.isFinite(numericValue)) return value;
  const countedValue = Math.round(numericValue * ease(clamp(progress / 0.46)))
    .toLocaleString("ru-RU");
  return `${value.slice(0, match.index)}${countedValue}${value.slice(match.index + match[0].length)}`;
}

function renderMomentPresentationShell(
  style: FinancialVisualPresentation,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  accent: string,
  timeMs: number,
): string {
  const pulse = (0.68 + Math.sin(timeMs / 170) * 0.18).toFixed(2);
  switch (style) {
    case "sticker":
      return `<rect x="${x + 1}" y="${y + 2}" width="${width - 2}" height="${height - 4}" rx="${radius + 8}" fill="#F1EADB" stroke="#FFF9EC" stroke-width="7"/>
        <rect x="${x + 8}" y="${y + 9}" width="${width - 16}" height="${height - 18}" rx="${radius + 3}" fill="url(#moment-card-fill)" stroke="${accent}" stroke-width="2"/>
        <path d="M${x + width - 52} ${y + 18}l8 8 12-2-2 12 8 8-12 3-4 11-8-8-12 1 2-12-8-8 12-3z" fill="${accent}" opacity="${pulse}"/>`;
    case "image_sticker":
      return `<path d="M${x + 30} ${y + 3}Q${x + 46} ${y - 4} ${x + 60} ${y + 4}H${x + width - 44}Q${x + width - 24} ${y + 4} ${x + width - 28} ${y + 24}V${y + height - 24}Q${x + width - 26} ${y + height - 3} ${x + width - 48} ${y + height - 7}H${x + 46}Q${x + 20} ${y + height - 4} ${x + 24} ${y + height - 26}V${y + 28}Q${x + 18} ${y + 7} ${x + 30} ${y + 3}Z" fill="url(#moment-card-fill)" stroke="#FFF9EC" stroke-width="9"/>
        <path d="M${x + 32} ${y + 10}H${x + width - 46}Q${x + width - 34} ${y + 10} ${x + width - 34} ${y + 26}" fill="none" stroke="${accent}" stroke-width="2" opacity=".8"/>`;
    case "cutout_object":
      return `<path d="M${x + 24} ${y + 6}Q${x + 47} ${y - 4} ${x + 65} ${y + 7}Q${x + 93} ${y - 1} ${x + 109} ${y + 9}H${x + width - 92}Q${x + width - 70} ${y - 2} ${x + width - 53} ${y + 10}Q${x + width - 24} ${y + 4} ${x + width - 20} ${y + 29}V${y + height - 36}Q${x + width - 8} ${y + height - 15} ${x + width - 33} ${y + height - 12}Q${x + width - 59} ${y + height + 1} ${x + width - 81} ${y + height - 12}H${x + 77}Q${x + 53} ${y + height + 1} ${x + 32} ${y + height - 12}Q${x + 9} ${y + height - 8} ${x + 13} ${y + height - 35}V${y + 32}Q${x + 5} ${y + 10} ${x + 24} ${y + 6}Z" fill="url(#moment-card-fill)" stroke="#F7F0E4" stroke-width="8"/>
        <path d="M${x + 26} ${y + 13}H${x + width - 24}" stroke="${accent}" stroke-width="2" stroke-dasharray="4 9" opacity=".65"/>`;
    case "document":
      return `<path d="M${x + 12} ${y + 2}H${x + width - 38}L${x + width - 2} ${y + 38}V${y + height - 14}Q${x + width - 2} ${y + height - 2} ${x + width - 14} ${y + height - 2}H${x + 14}Q${x + 2} ${y + height - 2} ${x + 2} ${y + height - 14}V${y + 14}Q${x + 2} ${y + 2} ${x + 12} ${y + 2}Z" fill="url(#moment-card-fill)" stroke="${accent}" stroke-width="2.5"/>
        <path d="M${x + width - 38} ${y + 2}V${y + 28}Q${x + width - 38} ${y + 38} ${x + width - 28} ${y + 38}H${x + width - 2}" fill="none" stroke="${accent}" stroke-width="2" opacity=".8"/>
        <path d="M${x + 24} ${y + 60}H${x + width - 24}" stroke="${accent}" stroke-width="2" stroke-dasharray="4 8" opacity=".62"/>`;
    case "infographic":
      return `<rect x="${x + 2}" y="${y + 3}" width="${width - 4}" height="${height - 6}" rx="${radius}" fill="url(#moment-card-fill)" stroke="${accent}" stroke-width="2"/>
        <path d="M${x + 22} ${y + 59}H${x + width - 22}" stroke="${accent}" stroke-width="2" opacity=".58"/>
        <circle cx="${x + width - 34}" cy="${y + 30}" r="8" fill="${accent}" opacity="${pulse}"/>
        <rect x="${x + width - 57}" y="${y + 18}" width="4" height="24" rx="2" fill="${accent}" opacity=".45"/>
        <rect x="${x + 22}" y="${y + 23}" width="6" height="23" rx="3" fill="${accent}"/>`;
    case "notification":
      return `<rect x="${x + 3}" y="${y + 5}" width="${width - 6}" height="${height - 10}" rx="${Math.min(height / 2, 48)}" fill="#0C1311" stroke="${accent}" stroke-width="2.5"/>
        <rect x="${x + 13}" y="${y + 16}" width="7" height="${height - 32}" rx="4" fill="${accent}"/>
        <circle cx="${x + width - 31}" cy="${y + 30}" r="8" fill="${accent}" opacity="${pulse}"/>`;
    case "icon_bubble":
      return `<rect x="${x + 3}" y="${y + 5}" width="${width - 6}" height="${height - 10}" rx="${radius + 9}" fill="url(#moment-card-fill)" stroke="${accent}" stroke-width="2.5"/>
        <circle cx="${x + 42}" cy="${y + 39}" r="22" fill="#101713" stroke="${accent}" stroke-width="2.5"/>
        <circle cx="${x + 42}" cy="${y + 39}" r="7" fill="${accent}" opacity="${pulse}"/>`;
    case "highlighted_word":
      return `<path d="M${x + 24} ${y + 26}Q${x + width * .35} ${y + 16} ${x + width * .58} ${y + 24}T${x + width - 26} ${y + 25}L${x + width - 30} ${y + 53}Q${x + width * .64} ${y + 58} ${x + width * .4} ${y + 51}T${x + 28} ${y + 54}Z" fill="${accent}" fill-opacity=".35"/>
        <path d="M${x + 30} ${y + 58}Q${x + width * .56} ${y + 62} ${x + width - 35} ${y + 56}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" opacity=".8"/>`;
    case "number_counter":
      return `<rect x="${x + 3}" y="${y + 7}" width="${width - 6}" height="${height - 14}" rx="${height / 2}" fill="#101713" stroke="${accent}" stroke-width="3"/>
        <circle cx="${x + 42}" cy="${y + 39}" r="19" fill="${accent}" fill-opacity=".2" stroke="${accent}" stroke-width="2"/>
        <path d="M${x + 35} ${y + 39}h14M${x + 42} ${y + 32}v14" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>`;
    default:
      return `<rect x="${x + 8}" y="${y + 9}" width="${width - 16}" height="${height - 18}" rx="${radius}" fill="#050908" opacity=".52"/>
        <rect x="${x + 2}" y="${y + 2}" width="${width - 4}" height="${height - 4}" rx="${radius}" fill="url(#moment-card-fill)" stroke="${accent}" stroke-opacity=".88" stroke-width="2.5"/>
        <rect x="${x + 20}" y="${y + 17}" width="6" height="38" rx="3" fill="${accent}"/>
        <circle cx="${x + width - 26}" cy="${y + 27}" r="5" fill="${accent}" opacity="${pulse}"/>`;
  }
}

function renderMomentGraphic(
  moment: FinancialVisualMoment,
  x: number,
  y: number,
  width: number,
  progress: number,
  accent: string,
): string {
  const center = x + width / 2;
  const baseline = y + 120;
  const source = (moment.sourceLabel || "ИСТОЧНИК").slice(0, 22).toLocaleUpperCase("ru-RU");
  const target = (moment.targetLabel || "ПОЛУЧАТЕЛЬ").slice(0, 22).toLocaleUpperCase("ru-RU");
  const label = moment.label.replace(/\s+/gu, " ").slice(0, 38);
  const detail = (moment.detail || "").slice(0, 54);
  const rawValue = (moment.value || "").slice(0, 24);
  const value = moment.presentationStyle === "number_counter"
    ? countUpVisualValue(rawValue, progress)
    : rawValue;

  if (moment.kind === "money_flow" || moment.kind === "distribution" || moment.kind === "reinvestment") {
    const coinX = x + 82 + (width - 164) * clamp(progress);
    return `<path d="M${x + 62} ${baseline}H${x + width - 62}" stroke="${accent}" stroke-width="5" stroke-dasharray="10 12" opacity=".76"/>
      <circle cx="${x + 74}" cy="${baseline}" r="33" fill="#17211D" stroke="${accent}" stroke-width="3"/>
      <circle cx="${x + width - 74}" cy="${baseline}" r="33" fill="#17211D" stroke="${accent}" stroke-width="3"/>
      ${text(source, x + 74, baseline + 6, { size: 13, color: WHITE, weight: 800 })}
      ${text(target, x + width - 74, baseline + 6, { size: 13, color: WHITE, weight: 800 })}
      <circle cx="${coinX.toFixed(1)}" cy="${baseline}" r="18" fill="#E7BC70" stroke="#FFF0C9" stroke-width="3"/>
      ${text(value || "₽", coinX, baseline + 6, { size: value.length > 4 ? 11 : 14, color: "#1B211C", weight: 900 })}
      ${moment.kind === "reinvestment" ? `<path d="M${x + width - 46} ${y + 87}C${x + width - 18} ${y + 52} ${x + 28} ${y + 52} ${x + 50} ${y + 83}" fill="none" stroke="${accent}" stroke-width="3" marker-end="url(#moment-arrow)"/>` : ""}`;
  }

  if (moment.kind === "market_chart" || moment.kind === "compound_growth" || moment.kind === "payoff") {
    const points = moment.kind === "compound_growth"
      ? [[0, 52], [0.24, 42], [0.5, 30], [0.74, 17], [1, 2]]
      : moment.kind === "payoff"
        ? [[0, 44], [0.27, 40], [0.52, 30], [0.76, 20], [1, 8]]
        : [[0, 34], [0.25, 20], [0.48, 28], [0.72, 11], [1, 16]];
    const left = x + 65;
    const right = x + width - 65;
    const top = y + 78;
    const path = points.map(([px, py], index) => {
      const pointX = left + (right - left) * px!;
      const pointY = top + py!;
      return `${index ? "L" : "M"}${pointX.toFixed(1)} ${pointY.toFixed(1)}`;
    }).join(" ");
    const drawn = clamp(progress);
    return `<line x1="${left}" y1="${baseline}" x2="${right}" y2="${baseline}" stroke="#73877D" stroke-width="2" opacity=".5"/>
      <path d="${path}" fill="none" stroke="${accent}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="${drawn.toFixed(3)} 1"/>
      ${points.slice(0, Math.max(2, Math.ceil(points.length * drawn))).map(([px, py]) => `<circle cx="${(left + (right - left) * px!).toFixed(1)}" cy="${(top + py!).toFixed(1)}" r="5" fill="${accent}"/>`).join("")}
      ${value ? text(value, x + width - 70, y + 74, { size: 17, color: "#F1D18C", weight: 850, anchor: "end" }) : ""}
      ${detail ? text(detail.slice(0, 24), center, y + 149, { size: 15, color: MUTED, weight: 650 }) : ""}`;
  }

  if (moment.kind === "comparison") {
    const split = center;
    const hasComparisonAnchors = Boolean(moment.sourceLabel || moment.targetLabel);
    const leftTitle = hasComparisonAnchors
      ? source
      : label.slice(0, 16).toLocaleUpperCase("ru-RU");
    const rightTitle = hasComparisonAnchors
      ? target
      : (detail || "ДРУГОЙ РЕЗУЛЬТАТ").slice(0, 16).toLocaleUpperCase("ru-RU");
    const leftDetail = value || (hasComparisonAnchors ? "ПРАВИЛО" : detail.slice(0, 16));
    const rightDetail = hasComparisonAnchors ? detail.slice(0, 16) : "СРАВНЕНИЕ";
    return `<line x1="${split}" y1="${y + 72}" x2="${split}" y2="${y + 152}" stroke="#65766C" stroke-width="2" opacity=".7"/>
      <rect x="${x + 38}" y="${y + 78}" width="${width / 2 - 55}" height="69" rx="17" fill="#1A2822" stroke="${accent}" stroke-opacity=".62"/>
      <rect x="${split + 17}" y="${y + 78}" width="${width / 2 - 55}" height="69" rx="17" fill="#25221E" stroke="#D27662" stroke-opacity=".62"/>
      ${text(leftTitle, x + width * .27, y + 105, { size: 15, color: WHITE, weight: 850 })}
      ${text(leftDetail, x + width * .27, y + 130, { size: 13, color: accent, weight: 700 })}
      ${text(rightTitle, x + width * .73, y + 105, { size: 15, color: WHITE, weight: 850 })}
      ${text(rightDetail, x + width * .73, y + 130, { size: 13, color: "#E39A84", weight: 700 })}`;
  }

  if (moment.kind === "timeline") {
    const points = [x + 74, center, x + width - 74];
    return `<line x1="${points[0]}" y1="${baseline}" x2="${points[2]}" y2="${baseline}" stroke="#718278" stroke-width="5" stroke-linecap="round"/>
      <line x1="${points[0]}" y1="${baseline}" x2="${(points[0] + (points[2] - points[0]) * clamp(progress)).toFixed(1)}" y2="${baseline}" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
      ${points.map((point, index) => `<circle cx="${point}" cy="${baseline}" r="${index / 2 <= progress ? 13 : 10}" fill="${index / 2 <= progress ? accent : "#293931"}" stroke="${index / 2 <= progress ? "#F1D18C" : "#53645B"}" stroke-width="2"/>`).join("")}
      ${text(value || detail.slice(0, 24), center, y + 152, { size: 14, color: MUTED, weight: 650 })}`;
  }

  if (moment.kind === "portfolio") {
    const assets = [
      { label: "АКЦИИ", color: "#77C9A8" },
      { label: "ОБЛИГАЦИИ", color: "#D8B16D" },
      { label: "ЗОЛОТО", color: "#89A9DB" },
      { label: "ДРУГИЕ АКТИВЫ", color: "#C398D7" },
    ];
    return `<circle cx="${x + 53}" cy="${baseline}" r="35" fill="#18241E" stroke="${accent}" stroke-width="3"/>
      ${text("ФОНД", x + 53, baseline + 5, { size: 16, color: WHITE, weight: 850 })}
      ${assets.map((asset, index) => {
        const tileX = x + 105 + (index % 2) * 143;
        const tileY = y + 82 + Math.floor(index / 2) * 57;
        const reveal = clamp(progress * 2.2 - index * 0.12);
        return `<path d="M${x + 88} ${baseline}L${tileX} ${tileY + 19}" stroke="${asset.color}" stroke-width="2" stroke-dasharray="4 6" opacity="${(reveal * .66).toFixed(2)}"/>
          <g opacity="${reveal.toFixed(3)}" transform="translate(0 ${(1 - reveal) * 7})">
            <rect x="${tileX}" y="${tileY}" width="132" height="38" rx="10" fill="${asset.color}" fill-opacity=".14" stroke="${asset.color}" stroke-width="2"/>
            ${text(asset.label, tileX + 66, tileY + 24, { size: asset.label.length > 9 ? 15 : 17, color: WHITE, weight: 800 })}
          </g>`;
      }).join("")}
      ${text("ДОЛИ ПОРТФЕЛЯ · СХЕМА", center, y + 193, { size: 15, color: MUTED, weight: 700 })}`;
  }

  if (moment.kind === "ownership") {
    const shareholders = [
      { x: x + 286, y: y + 82, label: "АКЦИОНЕР 1" },
      { x: x + 286, y: y + 122, label: "АКЦИОНЕР 2" },
      { x: x + 286, y: y + 162, label: "АКЦИОНЕР 3" },
    ];
    const reveal = clamp(progress * 2);
    return `<rect x="${x + 22}" y="${y + 91}" width="134" height="58" rx="15" fill="#142B26" stroke="${accent}" stroke-width="2.5"/>
      ${text("КОМПАНИЯ", x + 89, y + 126, { size: 16, color: WHITE, weight: 850 })}
      ${shareholders.map((shareholder, index) => {
        const itemReveal = clamp(reveal - index * .12);
        return `<path d="M${x + 157} ${y + 120}L${shareholder.x - 8} ${shareholder.y}" stroke="${accent}" stroke-width="2" stroke-dasharray="4 6" opacity="${itemReveal.toFixed(2)}"/>
          <g opacity="${itemReveal.toFixed(3)}">
            <circle cx="${shareholder.x}" cy="${shareholder.y}" r="13" fill="#18241E" stroke="${accent}" stroke-width="2"/>
            <circle cx="${shareholder.x}" cy="${shareholder.y - 3}" r="4" fill="${accent}"/>
            <path d="M${shareholder.x - 6} ${shareholder.y + 7}Q${shareholder.x} ${shareholder.y + 1} ${shareholder.x + 6} ${shareholder.y + 7}" fill="none" stroke="${accent}" stroke-width="2"/>
            ${text(shareholder.label, shareholder.x + 21, shareholder.y + 5, { size: 14, color: WHITE, weight: 750, anchor: "start" })}
          </g>`;
      }).join("")}
      ${text("АКЦИЯ = ДОЛЯ В КОМПАНИИ", center, y + 193, { size: 15, color: MUTED, weight: 750 })}`;
  }

  if (moment.kind === "risk") {
    const meterWidth = width - 140;
    const meterX = x + 70;
    return `<rect x="${meterX}" y="${baseline - 8}" width="${meterWidth}" height="16" rx="8" fill="#354239"/>
      <rect x="${meterX}" y="${baseline - 8}" width="${(meterWidth * clamp(progress * .88 + .12)).toFixed(1)}" height="16" rx="8" fill="url(#moment-risk-gradient)"/>
      <path d="M${meterX + meterWidth * .66} ${baseline - 25}L${meterX + meterWidth * .66 + 14} ${baseline + 24}H${meterX + meterWidth * .66 - 14}Z" fill="#F2C979"/>
      ${text("РИСК", meterX + meterWidth * .66, y + 78, { size: 14, color: "#F2C979", weight: 900 })}
      ${text(detail || value || label, center, y + 153, { size: 15, color: WHITE, weight: 700 })}`;
  }

  if (moment.kind === "document" || moment.kind === "concept_card") {
    return `<rect x="${center - 47}" y="${y + 73}" width="94" height="73" rx="11" fill="#E8E0CE" stroke="#F8F0DE" stroke-width="2" transform="rotate(-4 ${center} ${y + 110})"/>
      <path d="M${center - 28} ${y + 96}H${center + 26}M${center - 28} ${y + 110}H${center + 18}M${center - 28} ${y + 124}H${center + 2}" stroke="#627064" stroke-width="4" stroke-linecap="round"/>
      <circle cx="${center + 27}" cy="${y + 130}" r="16" fill="${accent}" opacity=".88"/>
      ${text(value || "ФАКТ", center + 27, y + 135, { size: 11, color: "#17221D", weight: 900 })}
      ${detail ? text(detail.slice(0, 28), center, y + 159, { size: 14, color: MUTED, weight: 700 }) : ""}`;
  }

  if (moment.kind === "sticker") {
    return `<circle cx="${center}" cy="${baseline}" r="38" fill="${accent}" fill-opacity=".18" stroke="${accent}" stroke-width="3"/>
      <path d="M${center - 16} ${baseline}L${center - 3} ${baseline + 13}L${center + 20} ${baseline - 15}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      ${detail ? text(detail.slice(0, 30), center, y + 158, { size: 14, color: WHITE, weight: 750 }) : ""}`;
  }

  const numberSize = (value || "").length > 11 ? 31 : (value || "").length > 7 ? 38 : 48;
  return `<circle cx="${center}" cy="${baseline}" r="37" fill="${accent}" fill-opacity=".14"/>
    ${text(value || label.slice(0, 14), center, baseline + 14, { size: value ? numberSize : 24, color: "#F0C579", weight: 900 })}
    ${detail ? text(detail.slice(0, 44), center, y + 181, { size: 12, color: MUTED, weight: 600 }) : ""}`;
}

function renderFinancialRasterLayer(
  moment: FinancialVisualMoment,
  asset: FinancialRasterAsset,
  x: number,
  y: number,
  width: number,
  height: number,
  accent: string,
): string {
  const safeId = moment.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const href = escapeXml(asset.dataUri);
  if (asset.renderMode === "cutout") {
    const objectWidth = Math.min(width - 52, (height - 58) * 1.15);
    const objectHeight = height - 58;
    return `<ellipse cx="${x + width / 2}" cy="${y + height * 0.63}" rx="${objectWidth * 0.42}" ry="${objectHeight * 0.34}" fill="${accent}" opacity=".12"/>
      <image href="${href}" x="${x + (width - objectWidth) / 2}" y="${y + 48}" width="${objectWidth}" height="${objectHeight}" preserveAspectRatio="xMidYMid meet" filter="url(#moment-shadow)"/>`;
  }
  const imageX = x + 13;
  const imageY = y + 56;
  const imageWidth = width - 26;
  const imageHeight = height - 69;
  return `<defs><clipPath id="finance-media-${safeId}">
      <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="18"/>
    </clipPath></defs>
    <image href="${href}" x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" preserveAspectRatio="xMidYMid slice" clip-path="url(#finance-media-${safeId})"/>
    <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="18" fill="#09151D" fill-opacity=".2"/>
    <rect x="${imageX}" y="${imageY}" width="${imageWidth}" height="${imageHeight}" rx="18" fill="none" stroke="${accent}" stroke-opacity=".72" stroke-width="2"/>`;
}

function renderMicroObjectGlyph(label: string, x: number, y: number, accent: string): string {
  const normalized = label.toLocaleLowerCase("ru-RU");
  if (/bitcoin|биткоин|\bbtc\b/u.test(normalized)) {
    return `<circle cx="${x}" cy="${y}" r="22" fill="#1A2119" stroke="${accent}" stroke-width="3"/>
      ${text("BTC", x, y + 6, { size: 14, color: WHITE, weight: 900 })}`;
  }
  if (/кошел|wallet/u.test(normalized)) {
    return `<rect x="${x - 24}" y="${y - 17}" width="48" height="34" rx="7" fill="#17231E" stroke="${accent}" stroke-width="3"/>
      <path d="M${x - 23} ${y - 5}H${x + 24}M${x + 8} ${y - 1}H${x + 24}V${y + 10}H${x + 8}Z" fill="none" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="${x + 13}" cy="${y + 5}" r="2.5" fill="${accent}"/>`;
  }
  if (/сеть|блокчейн|узел|node|network/u.test(normalized)) {
    return `<path d="M${x - 17} ${y - 11}L${x + 16} ${y - 12}L${x} ${y + 17}Z" fill="none" stroke="${accent}" stroke-width="3"/>
      <circle cx="${x - 17}" cy="${y - 11}" r="6" fill="#122019" stroke="${accent}" stroke-width="3"/>
      <circle cx="${x + 16}" cy="${y - 12}" r="6" fill="#122019" stroke="${accent}" stroke-width="3"/>
      <circle cx="${x}" cy="${y + 17}" r="6" fill="#122019" stroke="${accent}" stroke-width="3"/>`;
  }
  if (/бирж|обмен|exchange/u.test(normalized)) {
    return `<rect x="${x - 23}" y="${y - 18}" width="46" height="36" rx="6" fill="#17231E" stroke="${accent}" stroke-width="3"/>
      <path d="M${x - 13} ${y - 7}H${x + 10}L${x + 5} ${y - 12}M${x + 13} ${y + 7}H${x - 10}L${x - 5} ${y + 12}" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  const initial = [...label.trim()][0]?.toLocaleUpperCase("ru-RU") || "•";
  return `<circle cx="${x}" cy="${y}" r="22" fill="#17231E" stroke="${accent}" stroke-width="3"/>
    ${text(initial, x, y + 9, { size: 28, color: WHITE, weight: 900 })}`;
}

type FinancialStickerSymbol =
  | "bitcoin"
  | "ethereum"
  | "coin"
  | "cash"
  | "bank"
  | "wallet"
  | "network"
  | "machine"
  | "speech"
  | "comparison"
  | "risk"
  | "exchange"
  | "lock"
  | "contract"
  | "rocket"
  | "lightning"
  | "savings"
  | "target"
  | "tax"
  | "portfolio"
  | "transfer"
  | "document"
  | "calendar"
  | "protocol"
  | "number"
  | "sparkle"
  | "price_chart"
  | "dual_asset"
  | "play";

type FinancialStickerMotion =
  | "float"
  | "spin"
  | "price_up"
  | "price_down"
  | "price_wave"
  | "swap"
  | "yield"
  | "pulse"
  | "shake"
  | "near_miss"
  | "target_hit"
  | "play";

type FinancialStickerRule = {
  pattern: RegExp;
  symbol: FinancialStickerSymbol;
  glyph: string;
  caption?: string;
  motion?: FinancialStickerMotion;
  priority?: number;
};

const FINANCIAL_STICKER_LIBRARY: FinancialStickerRule[] = [
  { pattern: /dual\s*asset|dualasset|бивалют|двухвалют|две валюты/iu, symbol: "dual_asset", glyph: "⇄", caption: "Dual Asset", motion: "swap", priority: 145 },
  { pattern: /bybit|байбит/iu, symbol: "exchange", glyph: "B", caption: "Bybit", motion: "swap", priority: 138 },
  { pattern: /валютн.{0,10}рис|currency risk/iu, symbol: "risk", glyph: "!", caption: "Валютный риск", motion: "shake", priority: 139 },
  { pattern: /не гарант|без гаранти/iu, symbol: "risk", glyph: "!", caption: "Нет гарантии", motion: "shake", priority: 137 },
  { pattern: /не дости|не достиг|ниже.{0,12}целев|не дош[её]л|не косн[её]т/iu, symbol: "target", glyph: "↘", caption: "Цена ниже цели", motion: "near_miss", priority: 135 },
  { pattern: /куда.{0,24}цен|не зна.{0,30}цен|направлен.{0,12}цен|цен.{0,20}(?:колеб|неопредел|меня|движ)/iu, symbol: "price_chart", glyph: "↕", caption: "Направление цены", motion: "price_wave", priority: 134 },
  { pattern: /цен.{0,28}(?:раст|вверх|выраст).{0,24}(?:пад|вниз|сниж)|(?:раст|вверх).{0,24}цен.{0,28}(?:пад|вниз|сниж)/iu, symbol: "price_chart", glyph: "↕", caption: "Цена может колебаться", motion: "price_wave", priority: 134 },
  { pattern: /цен.{0,16}(?:раст|вверх|выраст|поднима)|(?:вверх|рост|раст|поднима).{0,16}цен/iu, symbol: "price_chart", glyph: "↗", caption: "Цена вверх", motion: "price_up", priority: 133 },
  { pattern: /цен.{0,16}(?:пада|сниж|вниз|опуска)|(?:вниз|паден|пада|снижен|опуска).{0,16}цен/iu, symbol: "price_chart", glyph: "↘", caption: "Цена вниз", motion: "price_down", priority: 133 },
  { pattern: /достига|достигнут|достигнет|цель достигнута/iu, symbol: "target", glyph: "✓", caption: "Цель достигнута", motion: "target_hit", priority: 130 },
  { pattern: /целев.{0,18}цен|target price/iu, symbol: "target", glyph: "◎", caption: "Целевая цена", motion: "target_hit", priority: 126 },
  { pattern: /конвертир|конвертац|обмен.{0,15}на|меняет.{0,15}актив|convert|conversion/iu, symbol: "exchange", glyph: "⇄", caption: "Конвертация", motion: "swap", priority: 122 },
  { pattern: /повышенн.{0,15}доходност|доходност|получа.{0,16}доход|доход в|yield|return/iu, symbol: "cash", glyph: "+", caption: "Доходность", motion: "yield", priority: 116 },
  { pattern: /следующ.{0,12}видео|смотри.{0,12}видео|нов.{0,12}ролик|next video|subscribe/iu, symbol: "play", glyph: "▶", caption: "Следующее видео", motion: "play", priority: 115 },
  { pattern: /сумм|размер влож|amount|выбираешь.{0,12}сколько/iu, symbol: "number", glyph: "#", caption: "Сумма", motion: "pulse", priority: 90 },
  { pattern: /bitcoin|биткоин|биткойн|\bbtc\b/iu, symbol: "bitcoin", glyph: "₿", caption: "Bitcoin", motion: "spin", priority: 112 },
  { pattern: /ethereum|эфириум|эфир|\beth\b/iu, symbol: "ethereum", glyph: "Ξ", caption: "Ethereum", motion: "spin", priority: 108 },
  { pattern: /solana|солан|cardano|кардан|toncoin|\bton\b/iu, symbol: "network", glyph: "◎", caption: "Криптоактив", motion: "pulse", priority: 100 },
  { pattern: /nft|нфт|токенизац|цифровое искусство/iu, symbol: "contract", glyph: "◈", caption: "NFT", motion: "float", priority: 96 },
  { pattern: /криптовалют|альткоин|токен|монет|altcoin|coin/iu, symbol: "coin", glyph: "◈" },
  { pattern: /смарт.?контракт|smart.?contract|контракт/iu, symbol: "contract", glyph: "§" },
  { pattern: /стейблкоин|stablecoin|usdt|usdc|tether|тейтер/iu, symbol: "cash", glyph: "$" },
  { pattern: /кошел|wallet|seed.?phrase|сид.?фраз|приватн.*ключ/iu, symbol: "wallet", glyph: "▣", caption: "Кошелёк", motion: "float", priority: 88 },
  { pattern: /бирж|exchange|обменник|торговая площадка/iu, symbol: "exchange", glyph: "⇄", caption: "Биржа", motion: "swap", priority: 86 },
  { pattern: /блокчейн|blockchain|валидатор|узел сети|нода|сет[ьи]|сетей|сетев|network/iu, symbol: "network", glyph: "⛓" },
  { pattern: /майнинг|майнер|добыч[аи]|хешрейт|mining/iu, symbol: "machine", glyph: "⚙" },
  { pattern: /стейкинг|staking|валидатор|делегирован/iu, symbol: "coin", glyph: "◈" },
  { pattern: /defi|дефи|ликвидност|пул ликвидности/iu, symbol: "transfer", glyph: "↔" },
  { pattern: /газ|комисси|сбор|fee|network fee/iu, symbol: "tax", glyph: "%" },
  { pattern: /халвинг|halving|эмисси|выпуск монет|предложение монет/iu, symbol: "coin", glyph: "₿" },
  { pattern: /лимит|ограничен|правил|протокол|обновлен|верси/iu, symbol: "protocol", glyph: "✓" },
  { pattern: /взлом|хакер|мошенн|безопас|защит|риск|угроз|потер|волатил/iu, symbol: "risk", glyph: "!" },
  { pattern: /акци|доля|эмитент|компани|бизнес/iu, symbol: "portfolio", glyph: "▣" },
  { pattern: /дивиденд|выплат акционер|распределен прибыли/iu, symbol: "cash", glyph: "$" },
  { pattern: /облигац|купон|погашен|номинал|госдолг/iu, symbol: "contract", glyph: "§" },
  { pattern: /брокер|счёт инвест|счет инвест|депозитар|биржевой счет/iu, symbol: "portfolio", glyph: "▣" },
  { pattern: /банк|банков|вклад|депозит|сбережен/iu, symbol: "bank", glyph: "⌂" },
  { pattern: /кредит|заём|заем|долг|ипотек|займ/iu, symbol: "bank", glyph: "₽" },
  { pattern: /налог|ндфл|вычет|декларац|квитанц/iu, symbol: "tax", glyph: "%" },
  { pattern: /бюджет|расход|трата|затрат|себестоим|смета/iu, symbol: "cash", glyph: "₽" },
  { pattern: /платеж|оплат|перевод|транзакц|покупк|продаж/iu, symbol: "transfer", glyph: "↔" },
  { pattern: /доход|прибыл|выручк|заработ|дивиденд|купонный поток/iu, symbol: "cash", glyph: "+" },
  { pattern: /процент|ставк|доходност|инфляц|индексац/iu, symbol: "number", glyph: "%" },
  { pattern: /портфел|инвест|актив|капитал|фонд|накоплен/iu, symbol: "portfolio", glyph: "▣" },
  { pattern: /рынок|цена|стоимост|спрос|предложен|курс/iu, symbol: "coin", glyph: "₽" },
  { pattern: /рост|выраст|поднял|увелич|масштаб|ускор/iu, symbol: "rocket", glyph: "↗" },
  { pattern: /паден|сниз|сокращ|убыт|просад|минус/iu, symbol: "risk", glyph: "!" },
  { pattern: /сравнен|выгодн|лучше|хуже|разниц|вместо|однако/iu, symbol: "comparison", glyph: "↔" },
  { pattern: /автомат|алгоритм|механизм|робот|процесс|систем/iu, symbol: "machine", glyph: "⚙" },
  { pattern: /срок|дата|период|месяц|год|календар|погашен/iu, symbol: "calendar", glyph: "◷" },
  { pattern: /цель|план|стратег|ориентир|показател|метрик/iu, symbol: "target", glyph: "◎" },
  { pattern: /страхов|гаранти|резерв|подушк|защит/iu, symbol: "savings", glyph: "✓" },
  { pattern: /подпис|лайк|коммент|сообщ|чат|напиши|cta/iu, symbol: "speech", glyph: "…" },
  { pattern: /подар|бонус|награ|кэшбек|кешбек/iu, symbol: "coin", glyph: "+" },
  { pattern: /срочн|быстро|мгновен|скорост|времени нет/iu, symbol: "lightning", glyph: "⚡" },
  { pattern: /цен[ауы]?|price|курс/iu, symbol: "price_chart", glyph: "↕", caption: "Цена", motion: "price_wave", priority: 82 },
];

const FINANCIAL_STICKER_FALLBACKS: FinancialStickerRule[] = [
  { pattern: /./u, symbol: "coin", glyph: "₽" },
  { pattern: /./u, symbol: "transfer", glyph: "↔" },
  { pattern: /./u, symbol: "portfolio", glyph: "▣" },
  { pattern: /./u, symbol: "document", glyph: "✓" },
];

function financialStickerStylesForText(
  cue: string,
  context: string,
  index: number,
): FinancialStickerRule[] {
  const normalizedCue = cue.toLocaleLowerCase("ru-RU");
  const normalizedContext = context.toLocaleLowerCase("ru-RU");
  const direct = FINANCIAL_STICKER_LIBRARY
    .filter((rule) => rule.pattern.test(normalizedCue))
    .map((rule) => ({ rule, direct: true }));
  const contextual = normalizedContext === normalizedCue
    ? []
    : FINANCIAL_STICKER_LIBRARY
      .filter((rule) => rule.pattern.test(normalizedContext))
      .map((rule) => ({ rule, direct: false }));
  const matches = [...direct, ...contextual]
    .sort((first, second) =>
      Number(second.direct) - Number(first.direct)
      || (second.rule.priority ?? 40) - (first.rule.priority ?? 40));
  const selected: FinancialStickerRule[] = [];
  const selectedSymbols = new Set<FinancialStickerSymbol>();
  for (const { rule } of matches) {
    if (selectedSymbols.has(rule.symbol)) continue;
    selected.push(rule);
    selectedSymbols.add(rule.symbol);
    if (selected.length === 2) return selected;
  }
  if (selected.length) return selected;

  const seed = [...`${normalizedCue}:${index}`]
    .reduce((sum, character) => sum + character.codePointAt(0)!, 0);
  return [FINANCIAL_STICKER_FALLBACKS[seed % FINANCIAL_STICKER_FALLBACKS.length]!];
}

function renderFinancialStickerArtwork(
  symbol: FinancialStickerSymbol,
  centerX: number,
  centerY: number,
  motion: FinancialStickerMotion,
  timeMs: number,
  eventProgress: number,
): string {
  switch (symbol) {
    case "bitcoin":
      return `<circle cx="${centerX}" cy="${centerY}" r="47" fill="#F49B2F" stroke="#FFF9EC" stroke-width="10"/>
        <circle cx="${centerX}" cy="${centerY}" r="36" fill="#FFB43F" stroke="#D87518" stroke-width="2"/>
        ${text("BTC", centerX, centerY + 7, { size: 19, color: "#5A3210", weight: 950 })}
        <path d="M${centerX - 43} ${centerY - 20}l-13-8M${centerX + 42} ${centerY - 22}l12-9M${centerX + 43} ${centerY + 25}l12 8" stroke="#FFF9EC" stroke-width="6" stroke-linecap="round"/>`;
    case "ethereum":
      return `<path d="M${centerX} ${centerY - 48}L${centerX + 34} ${centerY + 3}L${centerX} ${centerY + 22}L${centerX - 34} ${centerY + 3}Z" fill="#8D84EF" stroke="#FFF9EC" stroke-width="10" stroke-linejoin="round"/>
        <path d="M${centerX} ${centerY + 26}L${centerX + 34} ${centerY + 8}L${centerX} ${centerY + 51}L${centerX - 34} ${centerY + 8}Z" fill="#5968C9" stroke="#FFF9EC" stroke-width="9" stroke-linejoin="round"/>
        <path d="M${centerX} ${centerY - 30}V${centerY + 36}" stroke="#D9E2FF" stroke-width="3" opacity=".8"/>`;
    case "coin":
      return `<circle cx="${centerX}" cy="${centerY}" r="48" fill="#FFC84E" stroke="#FFF9EC" stroke-width="10"/>
        <circle cx="${centerX}" cy="${centerY}" r="34" fill="#F2A62D" stroke="#D87818" stroke-width="3"/>
        ${text("¢", centerX, centerY + 17, { size: 57, color: "#FFF9EC", weight: 900 })}`;
    case "cash": {
      const coinBounce = motion === "yield" ? Math.sin(timeMs / 145) * 5 : 0;
      return `<rect x="${centerX - 54}" y="${centerY - 34}" width="108" height="68" rx="16" fill="#45C98B" stroke="#FFF9EC" stroke-width="10"/>
        <rect x="${centerX - 38}" y="${centerY - 22}" width="76" height="44" rx="10" fill="none" stroke="#D9FFE7" stroke-width="4"/>
        <circle cx="${centerX}" cy="${centerY + coinBounce}" r="17" fill="#F3C44E" stroke="#FFF9EC" stroke-width="6"/>
        ${motion === "yield" ? text("+", centerX + 41, centerY - 34 - Math.abs(coinBounce), { size: 33, color: "#FFF9EC", weight: 900 }) : ""}`;
    }
    case "bank":
      return `<path d="M${centerX - 55} ${centerY - 19}L${centerX} ${centerY - 52}L${centerX + 55} ${centerY - 19}Z" fill="#7F70E8" stroke="#FFF9EC" stroke-width="9" stroke-linejoin="round"/>
        <path d="M${centerX - 48} ${centerY + 39}H${centerX + 48}M${centerX - 41} ${centerY + 26}V${centerY - 12}M${centerX - 14} ${centerY + 26}V${centerY - 12}M${centerX + 14} ${centerY + 26}V${centerY - 12}M${centerX + 41} ${centerY + 26}V${centerY - 12}" stroke="#FFF9EC" stroke-width="10" stroke-linecap="round"/>
        <path d="M${centerX - 56} ${centerY + 48}H${centerX + 56}" stroke="#F5C34D" stroke-width="10" stroke-linecap="round"/>`;
    case "wallet":
      return `<rect x="${centerX - 48}" y="${centerY - 34}" width="96" height="68" rx="20" fill="#2386F3" stroke="#FFF9EC" stroke-width="10"/>
        <path d="M${centerX - 18} ${centerY - 11}H${centerX + 42}Q${centerX + 52} ${centerY - 11} ${centerX + 52} ${centerY}V${centerY + 23}H${centerX - 18}Q${centerX - 29} ${centerY + 23} ${centerX - 29} ${centerY + 12}V${centerY}Q${centerX - 29} ${centerY - 11} ${centerX - 18} ${centerY - 11}Z" fill="#53D1D4" stroke="#FFF9EC" stroke-width="8" stroke-linejoin="round"/>
        <circle cx="${centerX + 17}" cy="${centerY + 6}" r="6" fill="#F4C552" stroke="#FFF9EC" stroke-width="3"/>`;
    case "network":
      return `<path d="M${centerX - 31} ${centerY - 20}L${centerX + 30} ${centerY - 21}L${centerX} ${centerY + 34}Z" fill="none" stroke="#FFF9EC" stroke-width="15" stroke-linejoin="round"/>
        <path d="M${centerX - 31} ${centerY - 20}L${centerX + 30} ${centerY - 21}L${centerX} ${centerY + 34}Z" fill="none" stroke="#3AADEB" stroke-width="7" stroke-linejoin="round"/>
        <circle cx="${centerX - 31}" cy="${centerY - 20}" r="15" fill="#5EC8EE" stroke="#FFF9EC" stroke-width="8"/>
        <circle cx="${centerX + 30}" cy="${centerY - 21}" r="15" fill="#A986F4" stroke="#FFF9EC" stroke-width="8"/>
        <circle cx="${centerX}" cy="${centerY + 34}" r="15" fill="#55C991" stroke="#FFF9EC" stroke-width="8"/>`;
    case "machine":
      return `<rect x="${centerX - 49}" y="${centerY - 34}" width="98" height="68" rx="19" fill="#2586E8" stroke="#FFF9EC" stroke-width="10"/>
        <path d="M${centerX - 43} ${centerY + 12}H${centerX + 43}" stroke="#FFF9EC" stroke-width="8" stroke-linecap="round"/>
        <circle cx="${centerX - 17}" cy="${centerY - 3}" r="22" fill="#F2B94C" stroke="#FFF9EC" stroke-width="8"/>
        <path d="M${centerX - 17} ${centerY - 18}V${centerY - 11}M${centerX - 17} ${centerY + 5}V${centerY + 12}M${centerX - 32} ${centerY - 3}H${centerX - 25}M${centerX - 9} ${centerY - 3}H${centerX - 2}M${centerX - 28} ${centerY - 14}L${centerX - 23} ${centerY - 9}M${centerX - 11} ${centerY + 3}L${centerX - 6} ${centerY + 8}M${centerX - 28} ${centerY + 8}L${centerX - 23} ${centerY + 3}M${centerX - 11} ${centerY - 9}L${centerX - 6} ${centerY - 14}" stroke="#FFF9EC" stroke-width="5" stroke-linecap="round"/>
        <circle cx="${centerX - 17}" cy="${centerY - 3}" r="7" fill="#FFF9EC"/>
        <circle cx="${centerX + 27}" cy="${centerY - 5}" r="14" fill="#48C78E" stroke="#FFF9EC" stroke-width="7"/>
        <circle cx="${centerX + 27}" cy="${centerY - 5}" r="4" fill="#FFF9EC"/>`;
    case "speech":
      return `<path d="M${centerX - 47} ${centerY - 35}Q${centerX - 47} ${centerY - 49} ${centerX - 31} ${centerY - 49}H${centerX + 34}Q${centerX + 49} ${centerY - 49} ${centerX + 49} ${centerY - 34}V${centerY + 12}Q${centerX + 49} ${centerY + 28} ${centerX + 34} ${centerY + 28}H${centerX + 2}L${centerX - 24} ${centerY + 48}L${centerX - 20} ${centerY + 28}H${centerX - 31}Q${centerX - 47} ${centerY + 28} ${centerX - 47} ${centerY + 12}Z" fill="#1688F4" stroke="#FFF9EC" stroke-width="10" stroke-linejoin="round"/>
        <circle cx="${centerX - 18}" cy="${centerY - 8}" r="5" fill="#FFF9EC"/>
        <circle cx="${centerX}" cy="${centerY - 8}" r="5" fill="#FFF9EC"/>
        <circle cx="${centerX + 18}" cy="${centerY - 8}" r="5" fill="#FFF9EC"/>
        <path d="M${centerX + 27} ${centerY - 38}C${centerX + 42} ${centerY - 59} ${centerX + 64} ${centerY - 41} ${centerX + 47} ${centerY - 23}L${centerX + 36} ${centerY - 14}L${centerX + 26} ${centerY - 23}C${centerX + 17} ${centerY - 31} ${centerX + 20} ${centerY - 39} ${centerX + 27} ${centerY - 38}Z" fill="#F04F48" stroke="#FFF9EC" stroke-width="6" stroke-linejoin="round"/>`;
    case "comparison":
      return `<rect x="${centerX - 53}" y="${centerY - 34}" width="48" height="62" rx="14" fill="#FF6A5F" stroke="#FFF9EC" stroke-width="9"/>
        <rect x="${centerX + 5}" y="${centerY - 34}" width="48" height="62" rx="14" fill="#39BB78" stroke="#FFF9EC" stroke-width="9"/>
        <path d="M${centerX - 41} ${centerY - 12}l23 24M${centerX - 18} ${centerY - 12}l-23 24" stroke="#FFF9EC" stroke-width="8" stroke-linecap="round"/>
        <path d="M${centerX + 17} ${centerY - 2}l11 11 21-27" fill="none" stroke="#FFF9EC" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "risk":
      return `<path d="M${centerX} ${centerY - 49}L${centerX + 43} ${centerY - 31}V${centerY + 3}Q${centerX + 39} ${centerY + 34} ${centerX} ${centerY + 51}Q${centerX - 39} ${centerY + 34} ${centerX - 43} ${centerY + 3}V${centerY - 31}Z" fill="#E86B56" stroke="#FFF9EC" stroke-width="10" stroke-linejoin="round"/>
        ${text("!", centerX, centerY + 18, { size: 51, color: "#FFF9EC", weight: 950 })}
        <circle cx="${centerX + 42}" cy="${centerY - 35}" r="10" fill="#F7C34D" stroke="#FFF9EC" stroke-width="5"/>`;
    case "exchange":
      return `<path d="M${centerX - 48} ${centerY - 16}H${centerX + 34}L${centerX + 18} ${centerY - 32}M${centerX + 48} ${centerY + 17}H${centerX - 34}L${centerX - 18} ${centerY + 33}" fill="none" stroke="#FFF9EC" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M${centerX - 48} ${centerY - 16}H${centerX + 34}L${centerX + 18} ${centerY - 32}M${centerX + 48} ${centerY + 17}H${centerX - 34}L${centerX - 18} ${centerY + 33}" fill="none" stroke="#2A9CE5" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "lock":
      return `<rect x="${centerX - 40}" y="${centerY - 10}" width="80" height="58" rx="16" fill="#45B58A" stroke="#FFF9EC" stroke-width="10"/>
        <path d="M${centerX - 25} ${centerY - 10}V${centerY - 27}Q${centerX - 25} ${centerY - 52} ${centerX} ${centerY - 52}Q${centerX + 25} ${centerY - 52} ${centerX + 25} ${centerY - 27}V${centerY - 10}" fill="none" stroke="#FFF9EC" stroke-width="11"/>
        <circle cx="${centerX}" cy="${centerY + 15}" r="8" fill="#FFF9EC"/>`;
    case "contract":
      return `<path d="M${centerX - 35} ${centerY - 50}H${centerX + 15}L${centerX + 40} ${centerY - 25}V${centerY + 44}Q${centerX + 40} ${centerY + 52} ${centerX + 31} ${centerY + 52}H${centerX - 31}Q${centerX - 40} ${centerY + 52} ${centerX - 40} ${centerY + 43}V${centerY - 41}Q${centerX - 40} ${centerY - 50} ${centerX - 35} ${centerY - 50}Z" fill="#F7F4ED" stroke="#FFF9EC" stroke-width="9" stroke-linejoin="round"/>
        <path d="M${centerX + 15} ${centerY - 49}V${centerY - 25}H${centerX + 39}M${centerX - 20} ${centerY - 7}H${centerX + 20}M${centerX - 20} ${centerY + 7}H${centerX + 8}M${centerX - 19} ${centerY + 31}Q${centerX - 7} ${centerY + 16} ${centerX + 3} ${centerY + 32}L${centerX + 22} ${centerY + 21}" fill="none" stroke="#3286C8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "rocket":
      return `<path d="M${centerX + 4} ${centerY - 50}Q${centerX + 41} ${centerY - 48} ${centerX + 43} ${centerY - 9}L${centerX + 10} ${centerY + 25}L${centerX - 16} ${centerY - 1}Z" fill="#F26857" stroke="#FFF9EC" stroke-width="10" stroke-linejoin="round"/>
        <circle cx="${centerX + 19}" cy="${centerY - 19}" r="9" fill="#7BD5EC" stroke="#FFF9EC" stroke-width="5"/>
        <path d="M${centerX - 14} ${centerY + 2}Q${centerX - 34} ${centerY + 11} ${centerX - 35} ${centerY + 31}Q${centerX - 15} ${centerY + 28} ${centerX - 8} ${centerY + 17}M${centerX + 4} ${centerY + 24}Q${centerX - 1} ${centerY + 41} ${centerX - 20} ${centerY + 48}Q${centerX - 18} ${centerY + 29} ${centerX - 7} ${centerY + 20}" fill="#F6B843" stroke="#FFF9EC" stroke-width="8" stroke-linejoin="round"/>`;
    case "lightning":
      return `<path d="M${centerX + 8} ${centerY - 52}L${centerX - 39} ${centerY + 5}L${centerX - 6} ${centerY + 5}L${centerX - 17} ${centerY + 51}L${centerX + 40} ${centerY - 15}L${centerX + 8} ${centerY - 15}Z" fill="#F6C343" stroke="#FFF9EC" stroke-width="10" stroke-linejoin="round"/>`;
    case "savings":
      return `<path d="M${centerX - 43} ${centerY - 5}Q${centerX - 41} ${centerY - 38} ${centerX - 8} ${centerY - 39}H${centerX + 25}Q${centerX + 45} ${centerY - 37} ${centerX + 47} ${centerY - 12}L${centerX + 59} ${centerY - 5}L${centerX + 46} ${centerY + 7}Q${centerX + 43} ${centerY + 31} ${centerX + 20} ${centerY + 35}H${centerX - 19}Q${centerX - 42} ${centerY + 32} ${centerX - 43} ${centerY - 5}Z" fill="#F49B77" stroke="#FFF9EC" stroke-width="10" stroke-linejoin="round"/>
        <circle cx="${centerX + 20}" cy="${centerY - 14}" r="5" fill="#27333B"/>
        <path d="M${centerX - 18} ${centerY - 42}L${centerX - 7} ${centerY - 58}L${centerX + 4} ${centerY - 40}M${centerX - 30} ${centerY + 30}V${centerY + 45}M${centerX + 25} ${centerY + 29}V${centerY + 44}" fill="none" stroke="#FFF9EC" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "target":
      return `<circle cx="${centerX}" cy="${centerY}" r="48" fill="#E95759" stroke="#FFF9EC" stroke-width="10"/>
        <circle cx="${centerX}" cy="${centerY}" r="31" fill="#FFF9EC"/>
        <circle cx="${centerX}" cy="${centerY}" r="15" fill="#4AB98A"/>
        <path d="M${centerX + 5} ${centerY - 5}L${centerX + 48} ${centerY - 49}M${centerX + 29} ${centerY - 49}H${centerX + 48}V${centerY - 30}" fill="none" stroke="#F2B943" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "tax":
      return `<rect x="${centerX - 39}" y="${centerY - 51}" width="78" height="102" rx="17" fill="#5D8FE7" stroke="#FFF9EC" stroke-width="10"/>
        <rect x="${centerX - 23}" y="${centerY - 34}" width="46" height="24" rx="6" fill="#DFF8E7"/>
        <circle cx="${centerX - 17}" cy="${centerY + 2}" r="6" fill="#F4C243"/><circle cx="${centerX + 1}" cy="${centerY + 2}" r="6" fill="#F4C243"/><circle cx="${centerX + 19}" cy="${centerY + 2}" r="6" fill="#F4C243"/>
        <circle cx="${centerX - 17}" cy="${centerY + 23}" r="6" fill="#49C992"/><circle cx="${centerX + 1}" cy="${centerY + 23}" r="6" fill="#49C992"/><circle cx="${centerX + 19}" cy="${centerY + 23}" r="6" fill="#49C992"/>`;
    case "number":
      return `<path d="M${centerX - 37} ${centerY - 49}H${centerX + 37}Q${centerX + 52} ${centerY - 49} ${centerX + 52} ${centerY - 34}V${centerY + 34}Q${centerX + 52} ${centerY + 49} ${centerX + 37} ${centerY + 49}H${centerX - 37}Q${centerX - 52} ${centerY + 49} ${centerX - 52} ${centerY + 34}V${centerY - 34}Q${centerX - 52} ${centerY - 49} ${centerX - 37} ${centerY - 49}Z" fill="#25A876" stroke="#FFF9EC" stroke-width="10"/>
        ${text("#", centerX, centerY + 18, { size: 63, color: "#FFF9EC", weight: 950 })}`;
    case "protocol":
      return `<path d="M${centerX - 35} ${centerY - 49}H${centerX + 14}L${centerX + 39} ${centerY - 24}V${centerY + 42}Q${centerX + 39} ${centerY + 51} ${centerX + 30} ${centerY + 51}H${centerX - 30}Q${centerX - 39} ${centerY + 51} ${centerX - 39} ${centerY + 42}V${centerY - 40}Q${centerX - 39} ${centerY - 49} ${centerX - 35} ${centerY - 49}Z" fill="#7C70E8" stroke="#FFF9EC" stroke-width="9" stroke-linejoin="round"/>
        <path d="M${centerX + 14} ${centerY - 48}V${centerY - 24}H${centerX + 38}M${centerX - 20} ${centerY - 7}H${centerX + 17}M${centerX - 20} ${centerY + 7}H${centerX + 3}M${centerX - 18} ${centerY + 28}l10 10 24-25" fill="none" stroke="#FFF9EC" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "portfolio":
      return `<rect x="${centerX - 48}" y="${centerY - 23}" width="96" height="67" rx="17" fill="#237AE0" stroke="#FFF9EC" stroke-width="10"/>
        <path d="M${centerX - 22} ${centerY - 23}V${centerY - 36}Q${centerX - 22} ${centerY - 44} ${centerX - 13} ${centerY - 44}H${centerX + 13}Q${centerX + 22} ${centerY - 44} ${centerX + 22} ${centerY - 36}V${centerY - 23}" fill="#7E67E7" stroke="#FFF9EC" stroke-width="8"/>
        <circle cx="${centerX - 18}" cy="${centerY + 10}" r="13" fill="#F4BC42" stroke="#FFF9EC" stroke-width="6"/>
        <circle cx="${centerX + 17}" cy="${centerY + 10}" r="13" fill="#43C48D" stroke="#FFF9EC" stroke-width="6"/>`;
    case "transfer":
      return `<rect x="${centerX - 54}" y="${centerY - 26}" width="43" height="54" rx="13" fill="#2686E9" stroke="#FFF9EC" stroke-width="9"/>
        <rect x="${centerX + 11}" y="${centerY - 26}" width="43" height="54" rx="13" fill="#36B87B" stroke="#FFF9EC" stroke-width="9"/>
        <path d="M${centerX - 5} ${centerY - 11}H${centerX + 10}L${centerX + 3} ${centerY - 20}M${centerX + 5} ${centerY + 12}H${centerX - 10}L${centerX - 3} ${centerY + 21}" fill="none" stroke="#FFF9EC" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${centerX}" cy="${centerY}" r="15" fill="#F4B943" stroke="#FFF9EC" stroke-width="6"/>`;
    case "document":
      return `<path d="M${centerX - 35} ${centerY - 48}H${centerX + 16}L${centerX + 39} ${centerY - 25}V${centerY + 43}Q${centerX + 39} ${centerY + 51} ${centerX + 31} ${centerY + 51}H${centerX - 31}Q${centerX - 39} ${centerY + 51} ${centerX - 39} ${centerY + 43}V${centerY - 40}Q${centerX - 39} ${centerY - 48} ${centerX - 35} ${centerY - 48}Z" fill="#F7F4ED" stroke="#FFF9EC" stroke-width="9" stroke-linejoin="round"/>
        <path d="M${centerX + 16} ${centerY - 47}V${centerY - 26}H${centerX + 38}M${centerX - 20} ${centerY - 8}H${centerX + 19}M${centerX - 20} ${centerY + 7}H${centerX + 12}" fill="none" stroke="#3A8FCE" stroke-width="7" stroke-linecap="round"/>
        <path d="M${centerX - 13} ${centerY + 27}l9 9 19-20" fill="none" stroke="#35B77C" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "calendar":
      return `<rect x="${centerX - 43}" y="${centerY - 38}" width="86" height="79" rx="17" fill="#FFF9EC" stroke="#FFF9EC" stroke-width="9"/>
        <path d="M${centerX - 39} ${centerY - 14}H${centerX + 39}V${centerY - 27}Q${centerX + 39} ${centerY - 36} ${centerX + 30} ${centerY - 36}H${centerX - 30}Q${centerX - 39} ${centerY - 36} ${centerX - 39} ${centerY - 27}Z" fill="#E7645C"/>
        <path d="M${centerX - 18} ${centerY + 8}l11 11 25-28" fill="none" stroke="#29AF72" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
    case "price_chart": {
      const path = motion === "price_up"
        ? `M${centerX - 55} ${centerY + 28}L${centerX - 25} ${centerY + 8}L${centerX - 4} ${centerY + 17}L${centerX + 20} ${centerY - 15}L${centerX + 53} ${centerY - 39}`
        : motion === "price_down"
          ? `M${centerX - 55} ${centerY - 33}L${centerX - 25} ${centerY - 9}L${centerX - 4} ${centerY - 21}L${centerX + 20} ${centerY + 13}L${centerX + 53} ${centerY + 38}`
          : `M${centerX - 55} ${centerY + 11}L${centerX - 30} ${centerY - 17}L${centerX - 8} ${centerY + 22}L${centerX + 16} ${centerY - 24}L${centerX + 37} ${centerY + 8}L${centerX + 55} ${centerY - 7}`;
      const endY = motion === "price_up" ? centerY - 39 : motion === "price_down" ? centerY + 38 : centerY - 7;
      const reveal = ease(clamp(eventProgress / 0.58));
      const offset = 190 * (1 - reveal);
      return `<path d="${path}" fill="none" stroke="#FFF9EC" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="${path}" fill="none" stroke="${motion === "price_down" ? "#F16B62" : "#39CA91"}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="190" stroke-dashoffset="${offset.toFixed(1)}"/>
        <circle cx="${centerX + 52}" cy="${endY}" r="${(10 + Math.sin(timeMs / 100) * 1.6).toFixed(1)}" fill="${motion === "price_down" ? "#F16B62" : "#39CA91"}" stroke="#FFF9EC" stroke-width="6" opacity="${reveal.toFixed(2)}"/>
        <path d="M${centerX + 34} ${endY - 18}L${centerX + 55} ${endY}L${centerX + 34} ${endY + 4}" fill="none" stroke="#FFF9EC" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="${reveal.toFixed(2)}"/>`;
    }
    case "dual_asset": {
      const swap = motion === "swap" ? Math.sin(timeMs / 135) * 7 : 0;
      return `<path d="M${centerX - 50} ${centerY - 14}H${centerX + 38}L${centerX + 22} ${centerY - 29}M${centerX + 50} ${centerY + 15}H${centerX - 38}L${centerX - 22} ${centerY + 30}" fill="none" stroke="#FFF9EC" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M${centerX - 50} ${centerY - 14}H${centerX + 38}L${centerX + 22} ${centerY - 29}M${centerX + 50} ${centerY + 15}H${centerX - 38}L${centerX - 22} ${centerY + 30}" fill="none" stroke="#37BDEA" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="${(150 * eventProgress).toFixed(1)} 150"/>
        <circle cx="${centerX - 30 + swap}" cy="${centerY}" r="27" fill="#F4A62E" stroke="#FFF9EC" stroke-width="8"/>
        <text x="${centerX - 30 + swap}" y="${centerY + 7}" fill="#FFFFFF" font-family="${FONT}" font-size="18" font-weight="900" text-anchor="middle">BTC</text>
        <circle cx="${centerX + 30 - swap}" cy="${centerY}" r="27" fill="#4A94E9" stroke="#FFF9EC" stroke-width="8"/>
        <text x="${centerX + 30 - swap}" y="${centerY + 7}" fill="#FFFFFF" font-family="${FONT}" font-size="15" font-weight="900" text-anchor="middle">USD</text>`;
    }
    case "play": {
      const ripple = 58 + (timeMs % 720) / 24;
      const rippleOpacity = Math.max(0, 0.36 - (ripple - 58) / 50);
      return `<circle cx="${centerX}" cy="${centerY}" r="${ripple.toFixed(1)}" fill="none" stroke="#FF716A" stroke-width="7" opacity="${rippleOpacity.toFixed(2)}"/>
        <circle cx="${centerX}" cy="${centerY}" r="48" fill="#F05453" stroke="#FFF9EC" stroke-width="10"/>
        <path d="M${centerX - 10} ${centerY - 23}L${centerX + 25} ${centerY}L${centerX - 10} ${centerY + 23}Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round"/>`;
    }
    default:
      return `<path d="M${centerX} ${centerY - 54}L${centerX + 17} ${centerY - 18}L${centerX + 54} ${centerY}L${centerX + 17} ${centerY + 17}L${centerX} ${centerY + 54}L${centerX - 17} ${centerY + 17}L${centerX - 54} ${centerY}L${centerX - 17} ${centerY - 18}Z" fill="#F2B840" stroke="#FFF9EC" stroke-width="10" stroke-linejoin="round"/>
        <circle cx="${centerX}" cy="${centerY}" r="15" fill="#FFF9EC"/>`;
  }
}

function renderFinancialStickerOverlay(
  symbol: FinancialStickerSymbol,
  glyph: string,
  centerX: number,
  centerY: number,
  timeMs: number,
  captionLabel: string,
  motion: FinancialStickerMotion,
  eventProgress: number,
): string {
  const label = captionLabel.replace(/\s+/gu, " ").trim();
  const pillWidth = Math.min(360, Math.max(280, label.length * 11 + 90));
  const pillX = centerX - pillWidth / 2;
  const bob = motion === "play"
    ? -Math.abs(Math.sin(timeMs / 150)) * 8
    : motion === "yield"
      ? Math.sin(timeMs / 145) * 4
      : Math.sin(timeMs / 175) * 2.5;
  const iconX = centerX;
  const iconY = centerY - 95 + bob;
  const pillY = centerY + 70 + bob;
  const enterScale = 0.9 + 0.1 * ease(clamp(eventProgress / 0.24));
  const iconScale = 2.45 * enterScale;
  const fontSize = Math.max(15, Math.min(24, (pillWidth - 56) / Math.max(1, label.length * 0.6)));
  const palette: Record<FinancialStickerSymbol, string> = {
    bitcoin: "#1685E9",
    ethereum: "#6759D8",
    wallet: "#1685E9",
    network: "#7853D2",
    machine: "#1685E9",
    speech: "#1685E9",
    comparison: "#258B62",
    risk: "#D9504C",
    portfolio: "#278C79",
    transfer: "#1685E9",
    document: "#287DCD",
    calendar: "#C97936",
    protocol: "#6759D8",
    number: "#218C65",
    sparkle: "#268B7D",
    coin: "#C97936",
    cash: "#238B64",
    bank: "#6759D8",
    exchange: "#1685E9",
    lock: "#258B62",
    contract: "#287DCD",
    rocket: "#D9504C",
    lightning: "#C97936",
    savings: "#D9504C",
    target: "#C97936",
    tax: "#287DCD",
    price_chart: "#278C79",
    dual_asset: "#6759D8",
    play: "#D9504C",
  };
  const pulse = motion === "yield" || motion === "play"
    ? 1 + Math.sin(timeMs / 120) * 0.035
    : 1 + Math.sin(timeMs / 145) * 0.02;
  const rotation = motion === "shake"
    ? Math.sin(timeMs / 42) * 2.4
    : motion === "spin" || motion === "swap"
      ? Math.sin(timeMs / (motion === "spin" ? 155 : 135)) * 5
      : Math.sin(timeMs / 260) * 1.5;
  const captionY = pillY;
  return `<defs><filter id="financial-sticker-shadow" x="-40%" y="-40%" width="180%" height="190%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000000" flood-opacity=".32"/>
    </filter></defs>
    <ellipse cx="${centerX}" cy="${centerY + 104 + bob}" rx="126" ry="13" fill="#030806" opacity=".24"/>
    <g filter="url(#financial-sticker-shadow)" transform="translate(${iconX} ${iconY}) rotate(${rotation.toFixed(2)}) scale(${(iconScale * pulse).toFixed(3)}) translate(${-iconX} ${-iconY})">
      ${renderFinancialStickerArtwork(symbol, centerX, iconY, motion, timeMs, eventProgress)}
    </g>
    <circle cx="${centerX + 55}" cy="${iconY - 38}" r="22" fill="${palette[symbol]}" stroke="#FFF9EC" stroke-width="6"/>
    ${text(glyph, centerX + 55, iconY - 31, { size: 18, color: "#FFF9EC", weight: 950 })}
    <g>
      <rect x="${pillX}" y="${captionY}" width="${pillWidth}" height="56" rx="28" fill="#FFF9EC" stroke="#FFFFFF" stroke-width="4"/>
      <rect x="${pillX + 5}" y="${captionY + 5}" width="${pillWidth - 10}" height="46" rx="23" fill="${palette[symbol]}"/>
      <circle cx="${pillX + 28}" cy="${captionY + 28}" r="12" fill="#FFFFFF" fill-opacity=".24"/>
      ${text(glyph, pillX + 28, captionY + 34, { size: 15, color: "#FFFFFF", weight: 950 })}
      ${text(label, centerX + 12, captionY + 36, { size: fontSize, color: "#FFFFFF", weight: 900 })}
    </g>`;
}

const STICKER_CAPTION_STOP_WORDS = new Set([
  "а", "без", "бы", "в", "во", "вот", "для", "до", "если", "есть", "за", "и", "из",
  "или", "как", "к", "когда", "ли", "на", "над", "но", "о", "об", "от", "по", "под",
  "при", "про", "раз", "с", "со", "так", "тоже", "у", "это", "этот", "эта", "эти",
  "примерно", "каждый", "каждая", "каждое", "каждые", "новые", "новый", "новая",
  "новое", "новых", "найденный", "найденная", "найденное", "найденные", "само", "сама", "себе",
  "быть", "будет", "будут", "были", "было", "всего", "вроде", "вы", "да", "даже", "дело",
  "должен", "должна", "должны", "если", "здесь", "затем", "значит", "именно", "их", "который",
  "которая", "которые", "может", "можно", "мы", "надо", "нам", "наш", "наша", "наши", "нет",
  "оно", "они", "очень", "пока", "потому", "почти", "просто", "сам", "свой", "свои", "сейчас",
  "такой", "такая", "такие", "тогда", "тут", "уже", "чтобы", "это", "этого", "этой",
  "получать", "получает", "получают", "получишь", "можешь", "можно", "будет", "будут",
  "пойдёт", "пойдет", "движется", "становится", "оказывается", "представь",
]);

type FinancialStickerTimedWord = ReturnType<typeof getSpeechWordTimings>["words"][number];

type FinancialStickerWordRange = {
  start: number;
  end: number;
  sentenceStart: number;
  sentenceEnd: number;
};

type FinancialStickerRailEvent = {
  beatIndex: number;
  startMs: number;
  endMs: number;
  displayUntilMs: number;
  caption: string;
  symbol: FinancialStickerSymbol;
  glyph: string;
  motion: FinancialStickerMotion;
};

function financialStickerWordRanges(words: FinancialStickerTimedWord[]): FinancialStickerWordRange[] {
  const sentences: Array<{ start: number; end: number }> = [];
  let sentenceStart = 0;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const nextWord = words[index + 1];
    const endsWithSentencePunctuation = /[!?…]/u.test(word.punctuation)
      || (/\./u.test(word.punctuation)
        && (!nextWord || /^\p{Lu}/u.test(nextWord.word) || !/\d/u.test(word.word)));
    if (endsWithSentencePunctuation) {
      sentences.push({ start: sentenceStart, end: index });
      sentenceStart = index + 1;
    }
  }
  if (sentenceStart < words.length) sentences.push({ start: sentenceStart, end: words.length - 1 });

  const ranges: FinancialStickerWordRange[] = [];
  for (const sentence of sentences) {
    let clauseStart = sentence.start;
    for (let index = sentence.start; index <= sentence.end; index += 1) {
      const word = words[index]!;
      const clauseBreak = index < sentence.end
        && /[,;:]/u.test(word.punctuation)
        && !/\d/u.test(word.word);
      if (clauseBreak) {
        if (clauseStart <= index) {
          ranges.push({
            start: clauseStart,
            end: index,
            sentenceStart: sentence.start,
            sentenceEnd: sentence.end,
          });
        }
        clauseStart = index + 1;
      }
    }
    if (clauseStart <= sentence.end) {
      ranges.push({
        start: clauseStart,
        end: sentence.end,
        sentenceStart: sentence.start,
        sentenceEnd: sentence.end,
      });
    }
  }
  return ranges;
}

function financialStickerRuleWordRange(
  words: FinancialStickerTimedWord[],
  rule: FinancialStickerRule,
): { first: FinancialStickerTimedWord; last: FinancialStickerTimedWord } | undefined {
  for (let start = 0; start < words.length; start += 1) {
    const maxEnd = Math.min(words.length - 1, start + 7);
    for (let end = start; end <= maxEnd; end += 1) {
      const phrase = words.slice(start, end + 1).map((word) => word.word).join(" ");
      if (rule.pattern.test(phrase)) return { first: words[start]!, last: words[end]! };
    }
  }
  return undefined;
}

function financialStickerCaption(rule: FinancialStickerRule, cue: string): string {
  if (rule.caption) return rule.caption.slice(0, 32);
  const defaultCaptions: Partial<Record<FinancialStickerSymbol, string>> = {
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    coin: "Криптоактив",
    cash: "Доход",
    bank: "Банк",
    wallet: "Кошелёк",
    network: "Сеть",
    exchange: "Обмен",
    risk: "Риск",
    target: "Цель",
    price_chart: "Цена",
    dual_asset: "Dual Asset",
    play: "Смотри дальше",
  };
  const words = getSpeechWordTimings(cue).words
    .filter((word) =>
      (word.normalized.length > 2 || /\d/u.test(word.normalized))
      && !STICKER_CAPTION_STOP_WORDS.has(word.normalized));
  const label = words.slice(0, 3).map((word) => word.word).join(" ");
  return (label || defaultCaptions[rule.symbol] || rule.glyph).slice(0, 32);
}

function financialStickerMotion(rule: FinancialStickerRule): FinancialStickerMotion {
  if (rule.motion) return rule.motion;
  if (rule.symbol === "bitcoin" || rule.symbol === "ethereum" || rule.symbol === "coin") return "spin";
  if (rule.symbol === "risk") return "shake";
  if (rule.symbol === "cash") return "yield";
  if (rule.symbol === "exchange" || rule.symbol === "dual_asset") return "swap";
  return "float";
}

function financialStickerRailEvents(
  beats: FinancialShortBeat[],
  durationMs: number,
): FinancialStickerRailEvent[] {
  const selected: Omit<FinancialStickerRailEvent, "displayUntilMs">[] = [];
  for (const [beatIndex, beat] of beats.entries()) {
    const sceneDurationMs = Math.max(0, (beat.to - beat.from) * durationMs);
    if (sceneDurationMs <= 0) continue;
    const source = beat.voiceText?.trim() || beat.lipSyncText?.trim() || beat.subtitle || beat.title;
    const { words, totalWeight } = getSpeechWordTimings(source);
    if (!words.length || totalWeight <= 0) continue;
    const ranges = financialStickerWordRanges(words);

    for (const [rangeIndex, range] of ranges.entries()) {
      const clauseWords = words.slice(range.start, range.end + 1);
      const sentenceWords = words.slice(range.sentenceStart, range.sentenceEnd + 1);
      const cue = clauseWords.map((word) => word.word).join(" ");
      const sentenceContext = sentenceWords.map((word) => word.word).join(" ");
      const styles = financialStickerStylesForText(
        cue,
        `${sentenceContext} ${beat.title} ${beat.subtitle}`,
        rangeIndex,
      );
      const sceneStartMs = beat.from * durationMs;
      for (const style of styles) {
        const matchedRange = financialStickerRuleWordRange(clauseWords, style);
        const first = matchedRange?.first ?? clauseWords[0]!;
        const last = matchedRange?.last ?? clauseWords.at(-1)!;
        const startMs = sceneStartMs + sceneDurationMs * clamp(first.start / totalWeight);
        const endMs = sceneStartMs + sceneDurationMs * clamp(last.end / totalWeight);
        const caption = financialStickerCaption(style, cue);
        if (!caption) continue;
        selected.push({
          beatIndex,
          startMs,
          endMs: Math.max(startMs + 240, endMs),
          caption,
          symbol: style.symbol,
          glyph: style.glyph,
          motion: financialStickerMotion(style),
        });
      }
    }
  }

  const ordered = selected
    .sort((first, second) => first.startMs - second.startMs)
    .filter((event, index, events) => {
      const previous = events[index - 1];
      return !previous
        || event.caption.toLocaleLowerCase("ru-RU") !== previous.caption.toLocaleLowerCase("ru-RU")
        || event.symbol !== previous.symbol
        || event.startMs - previous.startMs >= 1_100;
    });

  return ordered.map((event, index) => {
    const next = ordered[index + 1];
    const naturalEnd = event.endMs + 240;
    const nextTransitionEnd = next ? next.startMs + 180 : event.startMs + 720;
    return {
    ...event,
      displayUntilMs: Math.max(
        event.endMs,
        Math.min(Math.max(naturalEnd, nextTransitionEnd), event.startMs + 1_800),
      ),
    };
  });
}

function renderFinancialStickerRail(
  beats: FinancialShortBeat[],
  durationMs: number,
  timeMs: number,
  layout: PresenterLayout,
): string {
  const events = financialStickerRailEvents(beats, durationMs);
  const started = events.filter((event) => event.startMs <= timeMs && event.displayUntilMs >= timeMs);
  const visible = started.slice(-2);
  if (!visible.length) return "";

  const latest = visible.at(-1)!;
  const enterProgress = ease(clamp((timeMs - latest.startMs) / 240));
  const rowY = layout === "large" ? 470 : 680;
  const output = visible.map((event, slotIndex) => {
    const eventIndex = events.indexOf(event);
    const previous = events[eventIndex - 1];
    const isNewest = event === latest;
    let x = 540;
    let scale = 1;
    let enter = 1;

    if (visible.length === 2 && isNewest) {
      x = 740 + (1 - enterProgress) * 104;
      scale = 0.68 + enterProgress * 0.32;
      enter = enterProgress;
    } else if (visible.length === 2) {
      const cameFromRight = Boolean(previous && previous.displayUntilMs >= latest.startMs);
      const startingX = cameFromRight ? 740 : 540;
      x = startingX + (340 - startingX) * enterProgress;
    } else if (previous && previous.displayUntilMs >= event.startMs && timeMs < event.endMs + 240) {
      const settle = ease(clamp((timeMs - event.endMs) / 240));
      x = 740 + (540 - 740) * settle;
    }

    const fadeStartMs = event.displayUntilMs - 180;
    const leave = 1 - ease(clamp((timeMs - fadeStartMs) / 180));
    const opacity = clamp(enter * leave);
    const positionScale = scale * (0.985 + Math.sin(timeMs / 300 + slotIndex) * 0.015);
    const eventProgress = clamp((timeMs - event.startMs) / Math.max(1, event.endMs - event.startMs));
    return `<g pointer-events="none" opacity="${opacity.toFixed(3)}" transform="translate(${x.toFixed(1)} ${rowY}) scale(${positionScale.toFixed(3)}) translate(${-x.toFixed(1)} ${-rowY})">
      ${renderFinancialStickerOverlay(event.symbol, event.glyph, x, rowY, timeMs, event.caption, event.motion, eventProgress)}
    </g>`;
  }).join("");
  return output ? `<g pointer-events="none">${output}</g>` : "";
}

function renderFinancialMicroBeat(
  moment: FinancialVisualMoment,
  microBeat: FinancialVisualMicroBeat,
  progress: number,
  timeMs: number,
): string {
  if (microBeat.kind !== "number") return "";
  if (progress < microBeat.from || progress >= microBeat.to) return "";
  const eventProgress = clamp((progress - microBeat.from) / Math.max(0.001, microBeat.to - microBeat.from));
  const enter = ease(clamp(eventProgress / 0.28));
  const exitProgress = clamp((eventProgress - 0.74) / 0.26);
  const leave = 1 - ease(exitProgress);
  const centerX = 540;
  const centerY = 790;
  const accent = momentAccent(moment.kind);
  const label = microBeat.text.toLocaleUpperCase("ru-RU");
  const width = Math.max(118, Math.min(238, 74 + label.length * 12));
  const height = 82;
  const x = centerX - width / 2;
  const y = centerY - height / 2;
  let offsetX = 0;
  let offsetY = 0;
  let scale = 0.35 + enter * 0.65;
  let scaleX = 1;
  let rotation = 0;

  switch (microBeat.enterAnimation) {
    case "slide_left":
    case "swipe":
      offsetX = -86 * (1 - enter);
      break;
    case "slide_right":
    case "notification":
      offsetX = 86 * (1 - enter);
      break;
    case "slide_top":
      offsetY = -58 * (1 - enter);
      break;
    case "slide_bottom":
      offsetY = 58 * (1 - enter);
      break;
    case "bounce":
      offsetY = -30 * (1 - enter) + Math.sin(enter * Math.PI * 3) * (1 - enter) * 9;
      scale = 0.76 + enter * 0.24;
      break;
    case "elastic_pop":
    case "spring":
      scale = 0.54 + enter * 0.46 + Math.sin(enter * Math.PI * 2) * (1 - enter) * 0.18;
      break;
    case "rotate_scale":
    case "sticker_pop":
      rotation += (1 - enter) * -13;
      scale = 0.42 + enter * 0.58;
      break;
    case "flip":
      scaleX = Math.max(0.04, enter);
      scale = 1;
      break;
    case "floating":
      offsetY = Math.sin(timeMs / 220) * 4;
      break;
    case "scale_pop":
    case "card_pop":
      scale = 0.48 + enter * 0.52 + (1 - enter) * 0.08;
      break;
    case "overshoot":
      scale = 0.38 + ease(enter) * 0.62 + Math.sin(enter * Math.PI) * (1 - enter) * 0.24;
      break;
  }

  const exitOffset = 54 * exitProgress;
  if (microBeat.exitAnimation === "slide_left") offsetX -= exitOffset;
  if (microBeat.exitAnimation === "slide_right") offsetX += exitOffset;
  if (microBeat.exitAnimation === "slide_top") offsetY -= exitOffset;
  if (microBeat.exitAnimation === "slide_bottom") offsetY += exitOffset;
  if (microBeat.exitAnimation === "shrink") scale *= 1 - exitProgress * 0.5;
  const transform = `translate(${(centerX + offsetX).toFixed(1)} ${(centerY + offsetY).toFixed(1)}) rotate(${rotation.toFixed(2)}) scale(${(scale * scaleX).toFixed(3)} ${scale.toFixed(3)}) translate(${-centerX} ${-centerY})`;

  const stickerShell = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="24" fill="#101B17" fill-opacity=".97" stroke="${accent}" stroke-width="2"/>`;
  return `<g pointer-events="none" opacity="${(enter * leave).toFixed(3)}" transform="${transform}">
    ${stickerShell}
    ${text(label, centerX, centerY + 8, { size: 30, color: "#F0C579", weight: 900 })}
    <circle cx="${x + 14}" cy="${y + 14}" r="4" fill="${accent}"/>
  </g>`;
}

function cryptoF2MomentPoint(position: FinancialVisualPosition): { x: number; y: number } {
  return {
    top_left: { x: 330, y: 650 },
    top_center: { x: 540, y: 560 },
    top_right: { x: 750, y: 650 },
    center_left: { x: 335, y: 790 },
    center: { x: 540, y: 700 },
    center_right: { x: 745, y: 790 },
    hero: { x: 540, y: 660 },
  }[position];
}

function renderCryptoF2Motif(
  motif: CryptoF2ObjectMotif,
  x: number,
  y: number,
  size: number,
  timeMs: number,
  variant = 0,
): string {
  const scale = size / 220;
  const mint = "#9AE8BD";
  const warm = "#F2C782";
  const phase = timeMs / 1_900 + variant * 0.71;
  const rotation = Math.sin(phase * 0.42) * 1.2;
  let form = "";

  switch (motif) {
    case "token":
      form = `<circle r="77" fill="#152820" stroke="${mint}" stroke-width="8"/>
        <circle r="59" fill="none" stroke="${warm}" stroke-width="3" opacity=".84"/>
        <path d="M-29 -27L0 -48L29 -27L29 14L0 42L-29 14Z" fill="${mint}" fill-opacity=".19" stroke="${mint}" stroke-width="4"/>
        <path d="M-29 -27L0 0L29 -27M0 0V42" fill="none" stroke="${warm}" stroke-width="3"/>`;
      break;
    case "block":
      form = `<path d="M-82 -42L0 -88L82 -42L0 5Z" fill="#294838" stroke="${mint}" stroke-width="5"/>
        <path d="M-82 -42V45L0 91V5Z" fill="#13241D" stroke="${mint}" stroke-width="5"/>
        <path d="M82 -42V45L0 91V5Z" fill="#1B3327" stroke="${mint}" stroke-width="5"/>
        <path d="M0 5V91M-82 -42L0 5L82 -42" fill="none" stroke="${warm}" stroke-width="3" opacity=".9"/>`;
      break;
    case "chain":
      form = `<g transform="rotate(-23)">
        <rect x="-94" y="-38" width="112" height="76" rx="36" fill="#14241C" stroke="${mint}" stroke-width="8"/>
        <rect x="-20" y="-38" width="112" height="76" rx="36" fill="#20392A" stroke="${warm}" stroke-width="8"/>
        <path d="M-33 0H33" stroke="${mint}" stroke-width="12" stroke-linecap="round"/>
      </g>`;
      break;
    case "wallet":
      form = `<rect x="-83" y="-62" width="166" height="124" rx="20" fill="#16271F" stroke="${mint}" stroke-width="7"/>
        <path d="M-80 -29H80" stroke="${warm}" stroke-width="4"/>
        <path d="M34 9H83V47H34Q14 47 14 28Q14 9 34 9Z" fill="#294837" stroke="${mint}" stroke-width="4"/>
        <circle cx="42" cy="28" r="5" fill="${warm}"/>`;
      break;
    case "key":
      form = `<circle cx="-48" cy="-4" r="42" fill="#16271F" stroke="${warm}" stroke-width="8"/>
        <circle cx="-48" cy="-4" r="16" fill="none" stroke="${mint}" stroke-width="5"/>
        <path d="M-8 -4H91V20H62V43H39V20H-8Z" fill="#294837" stroke="${mint}" stroke-width="5" stroke-linejoin="round"/>`;
      break;
    case "shield":
      form = `<path d="M0 -91L76 -60V0Q69 55 0 92Q-69 55 -76 0V-60Z" fill="#16271F" stroke="${mint}" stroke-width="8" stroke-linejoin="round"/>
        <path d="M-34 0L-8 26L39 -29" fill="none" stroke="${warm}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M0 -62V-17" stroke="${mint}" stroke-width="3" opacity=".7"/>`;
      break;
    case "network":
      form = `<path d="M-59 -48L9 -70L64 -27L47 48L-27 69L-66 9Z" fill="none" stroke="${mint}" stroke-width="5" opacity=".8"/>
        <path d="M-59 -48L0 0L9 -70M0 0L64 -27M0 0L47 48M0 0L-27 69M0 0L-66 9" stroke="${warm}" stroke-width="3" opacity=".78"/>
        <circle cx="0" cy="0" r="22" fill="#294837" stroke="${mint}" stroke-width="5"/>
        <circle cx="-59" cy="-48" r="11" fill="${mint}"/><circle cx="9" cy="-70" r="11" fill="${warm}"/>
        <circle cx="64" cy="-27" r="11" fill="${mint}"/><circle cx="47" cy="48" r="11" fill="${warm}"/>
        <circle cx="-27" cy="69" r="11" fill="${mint}"/><circle cx="-66" cy="9" r="11" fill="${warm}"/>`;
      break;
    case "ledger":
      form = `<path d="M-70 -86H70V86H-70Z" fill="#16271F" stroke="${mint}" stroke-width="7"/>
        <path d="M-43 -48H42M-43 -14H42M-43 20H20M-43 54H42" stroke="${warm}" stroke-width="5" stroke-linecap="round"/>
        <path d="M-49 -86V86" stroke="${mint}" stroke-width="4" opacity=".65"/>`;
      break;
    case "bridge":
      form = `<path d="M-90 48H90M-67 48V-14M67 48V-14M-67 -14Q0 -99 67 -14" fill="none" stroke="${mint}" stroke-width="8" stroke-linecap="round"/>
        <path d="M-67 5H67M-48 4V48M-16 4V48M16 4V48M48 4V48" stroke="${warm}" stroke-width="4" opacity=".85"/>
        <circle cx="0" cy="-51" r="10" fill="${warm}"/>`;
      break;
    case "magnifier":
      form = `<circle cx="-17" cy="-19" r="61" fill="#16271F" stroke="${mint}" stroke-width="9"/>
        <circle cx="-17" cy="-19" r="39" fill="none" stroke="${warm}" stroke-width="4"/>
        <path d="M27 27L83 83" stroke="${mint}" stroke-width="17" stroke-linecap="round"/>
        <path d="M-41 -17H7M-17 -41V7" stroke="${warm}" stroke-width="4" stroke-linecap="round"/>`;
      break;
    case "orb":
    default:
      form = `<circle r="75" fill="#173025" stroke="${mint}" stroke-width="7"/>
        <circle r="55" fill="none" stroke="${warm}" stroke-width="3" stroke-dasharray="10 11" stroke-dashoffset="${(-phase * 6).toFixed(1)}"/>
        <path d="M-48 -25Q0 -77 48 -25Q79 0 47 33Q0 77 -48 31Q-77 0 -48 -25Z" fill="none" stroke="${mint}" stroke-width="5"/>
        <circle r="15" fill="${warm}" opacity=".95"/>`;
      break;
  }

  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)}) rotate(${rotation.toFixed(2)})">
    <circle r="106" fill="${mint}" opacity=".045" filter="url(#soft-glow)"/>
    <circle r="101" fill="none" stroke="${mint}" stroke-width="2" stroke-dasharray="4 17" stroke-dashoffset="${(-phase * 6).toFixed(1)}" opacity=".24"/>
    ${form}
  </g>`;
}

function renderCryptoF2Action(
  moment: FinancialVisualMoment,
  x: number,
  y: number,
  progress: number,
  timeMs: number,
): string {
  const action = moment.motionAction ?? "pulse";
  const variant = moment.motionVariant ?? 0;
  const phase = timeMs / 1_000 + variant;
  const pulse = 1 + Math.sin(phase) * 0.035;
  const mint = "#9AE8BD";
  const warm = "#F2C782";
  const orbitX = 185 + (variant % 4) * 13;
  const flowX = x - orbitX + 2 * orbitX * clamp(progress);

  if (action === "flow" || action === "transfer") {
    return `<path d="M${(x - orbitX).toFixed(1)} ${(y + 18).toFixed(1)}C${(x - 95).toFixed(1)} ${(y - 92).toFixed(1)} ${(x + 95).toFixed(1)} ${(y + 92).toFixed(1)} ${(x + orbitX).toFixed(1)} ${(y - 18).toFixed(1)}" fill="none" stroke="${mint}" stroke-width="4" stroke-dasharray="8 15" opacity=".65"/>
      <circle cx="${flowX.toFixed(1)}" cy="${(y + Math.sin(phase) * 18).toFixed(1)}" r="10" fill="${warm}"/>
      <circle cx="${flowX.toFixed(1)}" cy="${(y + Math.sin(phase) * 18).toFixed(1)}" r="24" fill="${warm}" opacity=".12"/>`;
  }
  if (action === "orbit") {
    return `<ellipse cx="${x}" cy="${y}" rx="${orbitX}" ry="120" fill="none" stroke="${mint}" stroke-width="3" stroke-dasharray="6 16" opacity=".48" transform="rotate(${(phase * 5).toFixed(1)} ${x} ${y})"/>
      <circle cx="${(x + Math.cos(phase) * orbitX).toFixed(1)}" cy="${(y + Math.sin(phase) * 120).toFixed(1)}" r="9" fill="${warm}"/>`;
  }
  if (action === "scan") {
    const scanX = x - 110 + 220 * clamp(progress);
    return `<path d="M${scanX.toFixed(1)} ${(y - 92).toFixed(1)}V${(y + 92).toFixed(1)}" stroke="${warm}" stroke-width="4" opacity=".75"/>
      <path d="M${(scanX - 18).toFixed(1)} ${(y - 92).toFixed(1)}V${(y + 92).toFixed(1)}" stroke="${warm}" stroke-width="28" opacity=".08"/>`;
  }
  if (action === "split_merge") {
    const spread = 74 * (1 - Math.abs(progress - 0.5) * 2);
    return `<circle cx="${(x - spread).toFixed(1)}" cy="${y}" r="${(58 * pulse).toFixed(1)}" fill="none" stroke="${mint}" stroke-width="4" opacity=".7"/>
      <circle cx="${(x + spread).toFixed(1)}" cy="${y}" r="${(58 * pulse).toFixed(1)}" fill="none" stroke="${warm}" stroke-width="4" opacity=".7"/>`;
  }
  if (action === "assemble" || action === "build" || action === "unfold") {
    return Array.from({ length: 5 }, (_, index) => {
      const angle = (index / 5) * Math.PI * 2 + variant;
      const distance = 142 * (1 - ease(clamp(progress / 0.8)));
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      return `<path d="M${px.toFixed(1)} ${py.toFixed(1)}l12 -8l12 8l-12 8Z" fill="${index % 2 ? mint : warm}" opacity="${(0.72 - progress * 0.2).toFixed(2)}"/>`;
    }).join("");
  }
  if (action === "lock") {
    return `<path d="M${(x - 31).toFixed(1)} ${(y - 65).toFixed(1)}v-22a31 31 0 0 1 62 0v22" fill="none" stroke="${warm}" stroke-width="8"/>
      <rect x="${x - 46}" y="${y - 67}" width="92" height="76" rx="14" fill="#152820" stroke="${mint}" stroke-width="6"/>
      <circle cx="${x}" cy="${y - 34}" r="8" fill="${warm}"/>`;
  }
  if (action === "reveal" || action === "morph") {
    const radius = 110 + 48 * clamp(progress);
    return `<circle cx="${x}" cy="${y}" r="${radius.toFixed(1)}" fill="none" stroke="${warm}" stroke-width="3" stroke-dasharray="10 20" stroke-dashoffset="${(-phase * 9).toFixed(1)}" opacity=".72"/>
      <path d="M${x - 110} ${y + 112}Q${x} ${(y + 112 - 40 * progress).toFixed(1)} ${x + 110} ${y + 112}" fill="none" stroke="${mint}" stroke-width="3" opacity=".6"/>`;
  }
  if (action === "pulse") {
    return `<circle cx="${x}" cy="${y}" r="${(132 * pulse).toFixed(1)}" fill="none" stroke="${warm}" stroke-width="3" opacity=".48"/>
      <circle cx="${x}" cy="${y}" r="${(156 * pulse).toFixed(1)}" fill="none" stroke="${mint}" stroke-width="2" opacity=".25"/>`;
  }
  return `<path d="M${x - 172} ${y + 132}Q${x} ${y + 176} ${x + 172} ${y + 132}" fill="none" stroke="${mint}" stroke-width="3" stroke-dasharray="4 14" opacity=".42"/>`;
}

function renderCryptoF2Moment(
  moment: FinancialVisualMoment,
  progress: number,
  timeMs: number,
): string {
  const point = cryptoF2MomentPoint(moment.position);
  const enter = ease(clamp(progress / 0.3));
  const exitProgress = clamp((progress - 0.84) / 0.16);
  const exit = moment.exitAnimation === "hold" ? 0 : ease(exitProgress);
  const variant = moment.motionVariant ?? 0;
  const animation = moment.enterAnimation;
  let xOffset = 0;
  let yOffset = Math.sin(timeMs / 1_700 + variant) * 2.5;
  let rotation = Math.sin(timeMs / 2_600 + variant) * 1.1;
  let scale = 0.72 + enter * 0.28;

  if (animation === "slide_left" || animation === "swipe" || animation === "flow_in") xOffset -= (1 - enter) * 155;
  else if (animation === "slide_right" || animation === "notification") xOffset += (1 - enter) * 155;
  else if (animation === "slide_top" || animation === "arc_top") yOffset -= (1 - enter) * 130;
  else if (animation === "slide_bottom" || animation === "arc_bottom") yOffset += (1 - enter) * 130;
  else if (animation === "arc_left") xOffset -= (1 - enter) * 135 * (variant % 2 ? -1 : 1);
  else if (animation === "arc_right") xOffset += (1 - enter) * 135 * (variant % 2 ? -1 : 1);
  else if (animation === "spiral_in" || animation === "orbit_in") rotation += (1 - enter) * (variant % 2 ? -55 : 55);
  else if (animation === "rotate_scale" || animation === "sticker_pop" || animation === "flip") rotation += (1 - enter) * (variant % 2 ? 14 : -14);
  else if (animation === "unfold_in" || animation === "split_assemble") scale *= 0.42 + enter * 0.58;
  else if (animation === "elastic_pop" || animation === "spring" || animation === "magnet_snap" || animation === "overshoot") {
    scale = 0.72 + enter * 0.28 + Math.sin(enter * Math.PI * 2) * (1 - enter) * 0.05;
  } else if (animation === "shards_in" || animation === "draw_on" || animation === "mask_reveal" || animation === "ripple_in") {
    scale = 0.86 + enter * 0.14;
  } else if (animation === "depth_pop") {
    scale = 0.45 + enter * 0.55;
    yOffset += (1 - enter) * 26;
  } else if (animation === "glitch_reform") {
    xOffset += (1 - enter) * Math.sin(timeMs / 420) * 10;
  }

  const exitAnimation = moment.exitAnimation;
  if (exitAnimation === "slide_left" || exitAnimation === "flow_out" || exitAnimation === "transfer_out") xOffset -= exit * 145;
  else if (exitAnimation === "slide_right") xOffset += exit * 145;
  else if (exitAnimation === "slide_top") yOffset -= exit * 120;
  else if (exitAnimation === "slide_bottom") yOffset += exit * 120;
  else if (exitAnimation === "spiral_out" || exitAnimation === "orbit_out" || exitAnimation === "turn_away") rotation += exit * (variant % 2 ? 50 : -50);
  else if (exitAnimation === "fold_away" || exitAnimation === "scale_through" || exitAnimation === "pull_back") scale *= 1 - exit * 0.32;
  else if (exitAnimation === "shatter" || exitAnimation === "scatter" || exitAnimation === "dissolve") scale *= 1 - exit * 0.14;

  const opacity = Math.max(0, 1 - (exitAnimation === "hold" ? 0 : exit));
  const motif = moment.objectMotif ?? "orb";
  const radius = moment.position === "hero" ? 232 : 212;
  const label = moment.label.replace(/\s+/gu, " ").trim().slice(0, 42).toLocaleUpperCase("ru-RU");
  const labelY = point.y - radius * 0.63;
  const particles = animation === "shards_in" || animation === "split_assemble"
    || exitAnimation === "shatter" || exitAnimation === "scatter" || exitAnimation === "dissolve"
    ? Array.from({ length: 8 }, (_, index) => {
        const angle = index / 8 * Math.PI * 2 + variant;
        const isLeaving = exitAnimation === "shatter" || exitAnimation === "scatter" || exitAnimation === "dissolve";
        const distance = isLeaving ? exit * 120 : (1 - enter) * 120;
        const px = point.x + Math.cos(angle) * distance;
        const py = point.y + Math.sin(angle) * distance;
        return `<path d="M${px.toFixed(1)} ${py.toFixed(1)}l8 -5l8 5l-8 5Z" fill="${index % 2 ? "#9AE8BD" : "#F2C782"}" opacity="${(isLeaving ? 1 - exit : 1 - enter).toFixed(2)}"/>`;
      }).join("")
    : "";

  return `<g pointer-events="none" opacity="${opacity.toFixed(3)}" transform="translate(${(point.x + xOffset).toFixed(1)} ${(point.y + yOffset).toFixed(1)}) rotate(${rotation.toFixed(2)}) scale(${scale.toFixed(3)}) translate(${-point.x} ${-point.y})">
    ${text(label, point.x, labelY, { size: label.length > 28 ? 20 : 24, color: "#E6C990", weight: 800, letterSpacing: 1 })}
    <circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="#9AE8BD" opacity=".04" filter="url(#soft-glow)"/>
    ${renderCryptoF2Action(moment, point.x, point.y, progress, timeMs)}
    ${renderCryptoF2Motif(motif, point.x, point.y, 218, timeMs, variant)}
    ${particles}
  </g>`;
}

function renderCryptoF2Transition(
  transition: FinancialSceneTransition | undefined,
  progress: number,
  previousMoment: FinancialVisualMoment | undefined,
  currentMoment: FinancialVisualMoment | undefined,
  timeMs: number,
): string {
  if (!transition || transition === "cut" || progress >= 1) return "";
  const p = ease(clamp(progress));
  const opacity = 1 - p;
  const mint = "#9AE8BD";
  const warm = "#F2C782";
  const center = cryptoF2MomentPoint(currentMoment?.position ?? "center");
  const oldMotif = previousMoment?.objectMotif ?? "orb";

  if (transition === "object_match_cut" && previousMoment) {
    return `<g opacity="${(opacity * .58).toFixed(3)}">${renderCryptoF2Motif(oldMotif, center.x, center.y, 190 * (1 - p * .24), timeMs, previousMoment.motionVariant ?? 0)}</g>`;
  }
  if (transition === "shape_morph") {
    return `<circle cx="${center.x}" cy="${center.y}" r="${(180 - p * 160).toFixed(1)}" fill="none" stroke="${warm}" stroke-width="${(8 - p * 5).toFixed(1)}" opacity="${opacity.toFixed(3)}"/>
      <path d="M${center.x - 220} ${center.y}Q${center.x} ${(center.y - 160 + p * 320).toFixed(1)} ${center.x + 220} ${center.y}" fill="none" stroke="${mint}" stroke-width="4" opacity="${(opacity * .8).toFixed(3)}"/>`;
  }
  if (transition === "particle_dissolve") {
    return `<g opacity="${opacity.toFixed(3)}">${Array.from({ length: 12 }, (_, index) => {
      const angle = index / 12 * Math.PI * 2;
      const distance = 35 + p * 170;
      const x = center.x + Math.cos(angle) * distance;
      const y = center.y + Math.sin(angle) * distance;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3 + index % 4).toFixed(1)}" fill="${index % 2 ? mint : warm}"/>`;
    }).join("")}</g>`;
  }
  if (transition === "whip_pan" || transition === "horizontal_sweep" || transition === "light_sweep") {
    const x = -480 + p * 1_560;
    return `<g opacity="${(opacity * .46).toFixed(3)}" transform="skewX(-16)">
      <rect x="${x.toFixed(1)}" y="300" width="220" height="1140" fill="${mint}" opacity=".07"/>
      <path d="M${(x + 60).toFixed(1)} 300V1440" stroke="${warm}" stroke-width="3"/>
      <path d="M${(x + 78).toFixed(1)} 300V1440" stroke="${mint}" stroke-width="2" opacity=".5"/>
    </g>`;
  }
  if (transition === "vertical_wipe" || transition === "radial_wipe" || transition === "ripple_wipe" || transition === "zoom_blur") {
    const radius = 40 + p * 650;
    return `<circle cx="${center.x}" cy="${center.y}" r="${radius.toFixed(1)}" fill="none" stroke="${transition === "ripple_wipe" ? mint : warm}" stroke-width="${transition === "zoom_blur" ? 18 : 5}" opacity="${(opacity * .6).toFixed(3)}"/>
      ${transition === "vertical_wipe" ? `<path d="M0 ${(-220 + p * 1_900).toFixed(1)}H1080" stroke="${mint}" stroke-width="16" opacity="${(opacity * .28).toFixed(3)}"/>` : ""}`;
  }
  if (transition === "center_split_wipe" || transition === "split_reveal") {
    const gap = 540 * p;
    return `<path d="M0 280H${(540 - gap).toFixed(1)}V1320H0Z" fill="${mint}" opacity="${(opacity * .12).toFixed(3)}"/>
      <path d="M1080 280H${(540 + gap).toFixed(1)}V1320H1080Z" fill="${warm}" opacity="${(opacity * .12).toFixed(3)}"/>`;
  }
  if (transition === "chain_link") {
    const spread = 34 + p * 150;
    return `<g opacity="${(opacity * .72).toFixed(3)}">
      <ellipse cx="${(540 - spread).toFixed(1)}" cy="690" rx="85" ry="49" fill="none" stroke="${mint}" stroke-width="8" transform="rotate(-26 ${540 - spread} 690)"/>
      <ellipse cx="${(540 + spread).toFixed(1)}" cy="690" rx="85" ry="49" fill="none" stroke="${warm}" stroke-width="8" transform="rotate(26 ${540 + spread} 690)"/>
    </g>`;
  }
  if (transition === "object_push") {
    const offset = 250 * (1 - p);
    return `<path d="M${(center.x - offset).toFixed(1)} 490H${(center.x - offset).toFixed(1)}V930" stroke="${mint}" stroke-width="5" opacity="${opacity.toFixed(3)}"/>
      <path d="M${(center.x + offset).toFixed(1)} 490H${(center.x + offset).toFixed(1)}V930" stroke="${warm}" stroke-width="5" opacity="${opacity.toFixed(3)}"/>`;
  }
  if (transition === "orbit_wipe") {
    return `<circle cx="${center.x}" cy="${center.y}" r="${(230 - p * 60).toFixed(1)}" fill="none" stroke="${mint}" stroke-width="4" stroke-dasharray="58 30" stroke-dashoffset="${(-timeMs / 8).toFixed(1)}" opacity="${opacity.toFixed(3)}"/>`;
  }
  if (transition === "light_flash") {
    return `<rect width="1080" height="1920" fill="${warm}" opacity="${(opacity * .055).toFixed(3)}"/>`;
  }
  if (transition === "object_match_cut" || transition === "shape_morph") return "";
  return renderTransitionSweep(progress, mint, transition);
}

function renderCryptoF2SceneContent(
  beat: FinancialShortBeat,
  moment: FinancialVisualMoment | undefined,
  momentProgress: number,
  previousMoment: FinancialVisualMoment | undefined,
  beatProgress: number,
  timeMs: number,
  isFirstBeat: boolean,
): string {
  const transitionProgress = isFirstBeat ? 1 : clamp(beatProgress / 0.22);
  if (!moment) return "";
  // Crypto F2 uses micro-beats as timing metadata only; detached lower-word inserts are not part of this visual layer.
  return `<g>
    ${previousMoment && moment.motionAction === "morph"
      ? `<g opacity="${(1 - ease(clamp(momentProgress / .22))) * .34}">${renderCryptoF2Motif(previousMoment.objectMotif ?? "orb", cryptoF2MomentPoint(moment.position).x, cryptoF2MomentPoint(moment.position).y, 210, timeMs, previousMoment.motionVariant ?? 0)}</g>`
      : ""}
    ${renderCryptoF2Moment(moment, momentProgress, timeMs)}
    ${renderCryptoF2Transition(beat.transitionIn, transitionProgress, previousMoment, moment, timeMs)}
  </g>`;
}

function renderCryptoF2Caption(moment: FinancialVisualMoment | undefined): string {
  const excerpt = moment?.voiceExcerpt.trim() || "";
  if (!excerpt) return "";
  return `<g pointer-events="none">
    <rect x="0" y="1340" width="1080" height="360" fill="#070A08" opacity=".38"/>
    <path d="M112 1390H968" stroke="#9AE8BD" stroke-width="2" opacity=".3"/>
    ${textLines(excerpt, 540, 1_465, 34, 45, { size: 29, color: "#F2EBDD", weight: 650 })}
    <path d="M112 1540H968" stroke="#F2C782" stroke-width="2" opacity=".24"/>
  </g>`;
}

function renderCryptoF2Ambient(timeMs: number): string {
  const particles = Array.from({ length: 14 }, (_, index) => {
    const x = (index * 173 + 71) % 1_080;
    const baseY = 250 + (index * 137) % 1_320;
    const y = baseY + Math.sin(timeMs / 1_100 + index * 0.8) * 19;
    const radius = 2 + index % 3;
    return `<circle cx="${x}" cy="${y.toFixed(1)}" r="${radius}" fill="${index % 3 === 0 ? "#F2C782" : "#9AE8BD"}" opacity=".24"/>`;
  }).join("");
  const orbitShift = Math.sin(timeMs / 1_800) * 22;
  return `<g pointer-events="none" opacity=".72">
    <path d="M80 970C220 710 335 460 540 420S870 625 1000 440" fill="none" stroke="#9AE8BD" stroke-width="2" stroke-dasharray="3 22" opacity=".22"/>
    <path d="M76 1190C245 1025 402 1130 540 1018S826 830 1005 1025" fill="none" stroke="#F2C782" stroke-width="2" stroke-dasharray="4 26" opacity=".17" transform="translate(0 ${orbitShift.toFixed(1)})"/>
    ${particles}
  </g>`;
}

function renderFinancialVisualMoment(
  moment: FinancialVisualMoment,
  progress: number,
  timeMs: number,
  featured = false,
  asset?: FinancialRasterAsset,
): string {
  const position = {
    top_left: { x: 352, y: 325 },
    top_center: { x: 540, y: 322 },
    top_right: { x: 728, y: 325 },
    center_left: { x: 352, y: 510 },
    center: { x: 540, y: 510 },
    center_right: { x: 728, y: 510 },
    hero: { x: 540, y: 438 },
  }[moment.position];
  const width = moment.position === "hero" ? 790 : moment.position === "center" ? 500 : 410;
  const height = moment.position === "hero" ? 248 : 214;
  const x = position.x - width / 2;
  const y = position.y - height / 2;
  const accent = momentAccent(moment.kind);
  const presentationStyle = moment.presentationStyle ?? "card";
  const enter = ease(clamp(progress / 0.16));
  const exitProgress = clamp((progress - 0.83) / 0.17);
  const leave = moment.exitAnimation === "hold" ? 1 : 1 - ease(exitProgress);
  let offsetX = 0;
  let offsetY = 0;
  let rotation = 0;
  let scaleX = 1;
  let scaleY = 1;
  let scale = 0.76 + enter * 0.24;
  const presentationScale = {
    card: 0.86,
    sticker: 0.78,
    image_sticker: 0.76,
    cutout_object: 0.8,
    document: 0.84,
    infographic: 0.88,
    notification: 0.78,
    icon_bubble: 0.8,
    highlighted_word: 0.85,
    number_counter: 0.76,
  }[presentationStyle] * (moment.position === "hero" ? 0.84 : moment.position === "center" ? 0.9 : 1);
  const displacement = (1 - enter) * 118;

  switch (moment.enterAnimation) {
    case "slide_left":
    case "swipe":
      offsetX = -displacement;
      scale = 1;
      break;
    case "slide_right":
    case "notification":
      offsetX = displacement;
      scale = 1;
      break;
    case "slide_top":
      offsetY = -displacement;
      scale = 1;
      break;
    case "slide_bottom":
      offsetY = displacement;
      scale = 1;
      break;
    case "bounce":
      offsetY = (1 - enter) * -68 + Math.sin(enter * Math.PI * 3) * (1 - enter) * 13;
      break;
    case "elastic_pop":
    case "spring":
      scale = 0.72 + enter * 0.28 + Math.sin(enter * Math.PI * 2) * (1 - enter) * 0.12;
      break;
    case "rotate_scale":
    case "sticker_pop":
      rotation = (1 - enter) * -11;
      scale = 0.64 + enter * 0.36;
      break;
    case "flip":
      scaleX = Math.max(0.04, enter);
      scale = 1;
      break;
    case "floating":
      offsetY = Math.sin(timeMs / 240) * 7;
      break;
    case "scale_pop":
    case "card_pop":
      scale = 0.62 + enter * 0.38 + (1 - enter) * 0.06;
      break;
    case "overshoot":
      scale = 0.52 + ease(enter) * 0.48 + Math.sin(enter * Math.PI) * (1 - enter) * 0.28;
      break;
  }

  if (featured) scale *= 1.08;
  const exitOffset = 94 * exitProgress;
  if (moment.exitAnimation === "slide_left") offsetX -= exitOffset;
  if (moment.exitAnimation === "slide_right") offsetX += exitOffset;
  if (moment.exitAnimation === "slide_top") offsetY -= exitOffset;
  if (moment.exitAnimation === "slide_bottom") offsetY += exitOffset;
  if (moment.exitAnimation === "shrink") scale *= 1 - exitProgress * 0.32;
  const opacity = leave;
  const radius = momentCardRadius(presentationStyle);
  const styleRotation = presentationStyle === "sticker" || presentationStyle === "image_sticker"
    ? -2.4
    : presentationStyle === "cutout_object"
      ? 1.5
      : presentationStyle === "document"
        ? -0.8
        : 0;
  const labelX = x + (presentationStyle === "icon_bubble" || presentationStyle === "number_counter" ? 72 : 40);
  const labelText = moment.label.replace(/\s+/gu, " ").slice(0, 48).toLocaleUpperCase("ru-RU");
  const labelMaxChars = Math.max(16, Math.floor((width - (labelX - x) - 32) / 12));
  const labelLines = wrapText(labelText, labelMaxChars).slice(0, 2);
  const labelFontSize = labelLines.length > 1 ? 15 : 18;
  const labelY = y + (labelLines.length > 1 ? 28 : 43);
  const transformScale = scale * presentationScale;
  const shell = renderMomentPresentationShell(
    presentationStyle,
    x,
    y,
    width,
    height,
    radius,
    accent,
    timeMs,
  );
  const rasterLayer = asset
    ? renderFinancialRasterLayer(moment, asset, x, y, width, height, accent)
    : "";

  return `<g pointer-events="none" opacity="${opacity.toFixed(3)}" transform="translate(${(position.x + offsetX).toFixed(1)} ${(position.y + offsetY).toFixed(1)}) rotate(${(rotation + styleRotation).toFixed(2)}) scale(${(transformScale * scaleX).toFixed(3)} ${(transformScale * scaleY).toFixed(3)}) translate(${-position.x} ${-position.y})">
    <defs>
      <linearGradient id="moment-card-fill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1B2822" stop-opacity=".99"/>
        <stop offset="1" stop-color="#111A17" stop-opacity=".98"/>
      </linearGradient>
      <linearGradient id="moment-risk-gradient" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#7FC5A2"/>
        <stop offset=".62" stop-color="#E2B76E"/>
        <stop offset="1" stop-color="#D27662"/>
      </linearGradient>
      <marker id="moment-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0 0L8 4L0 8Z" fill="${accent}"/>
      </marker>
      <filter id="moment-shadow" x="-30%" y="-30%" width="160%" height="180%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity=".35"/>
      </filter>
    </defs>
    <g filter="url(#moment-shadow)">${shell}</g>
    ${rasterLayer}
    ${labelLines.map((line, index) => text(
      line,
      labelX,
      labelY + index * 18,
      { size: labelFontSize, color: WHITE, weight: 850, anchor: "start", letterSpacing: .4 },
    )).join("")}
    ${asset ? "" : renderMomentGraphic(moment, x, y, width, progress, accent)}
    ${(moment.microBeats ?? []).map((microBeat) =>
      renderFinancialMicroBeat(moment, microBeat, progress, timeMs)).join("")}
  </g>`;
}

function renderVisual(beat: FinancialShortBeat, progress: number, timeMs: number, beatStartMs: number, beatEndMs: number): string {
  const entry = ease(clamp(progress * 1.7));
  const exit = clamp((1 - progress) * 1.7);
  const actors = beat.concept === "futures_contract" || beat.concept === "compound_interest"
    ? ""
    : `${actor("investor", 170, 760, entry, timeMs)}${actor("company", 910, 760, entry, timeMs)}`;
  const livePulse = 1 + Math.sin(timeMs / 360) * 0.035;

  if (beat.visual === "ownership") return ownershipVisual(beat, progress, timeMs);
  if (beat.visual === "fund") return fundPoolVisual(beat, progress, timeMs);
  if (beat.visual === "distribution") return distributionVisual(beat, progress, timeMs);
  if (beat.visual === "compound_growth") return compoundGrowthVisual(beat, progress, timeMs);
  if (beat.visual === "contract") return contractVisual(beat, progress, timeMs);
  if (beat.visual === "leverage") return leverageVisual(beat, progress, timeMs);
  if (beat.visual === "payoff") return payoffVisual(beat, progress, timeMs);
  if (beat.visual === "comparison") return comparisonVisual(beat, progress, timeMs);
  if (beat.visual === "risk") return riskVisual(beat, progress, timeMs);

  if (beat.visual === "hook") {
    const flowProgress = clamp((progress - 0.24) / 0.76);
    const heroWord = beat.entityLabel?.trim()
      || beat.title.replace(/[—–:!?.,]/gu, " ").trim().split(/\s+/u)[0]
      || "ФИНАНСЫ";
    const heroSize = Math.max(58, Math.min(96, 650 / Math.max(1, heroWord.length * 0.6)));
    const heroReveal = ease(clamp(progress / 0.2));
    const heroScale = 0.82 + heroReveal * 0.18;
    return `${actors}
      <circle cx="540" cy="625" r="${148 + Math.sin(timeMs / 230) * 5}" fill="#C28B43" opacity=".065"/>
      <circle cx="540" cy="625" r="168" fill="none" stroke="#D4A660" stroke-width="2" stroke-dasharray="5 18" stroke-dashoffset="${-Math.round(timeMs / 4)}" opacity=".44"/>
      <g opacity="${heroReveal.toFixed(3)}" transform="translate(540 625) scale(${heroScale.toFixed(3)}) translate(-540 -625)">
        ${text(heroWord.toLocaleUpperCase("ru-RU"), 540, 650, { size: heroSize, color: WHITE, weight: 900, letterSpacing: 1 })}
      </g>
      <path d="M285 780 C410 570 670 980 795 780" fill="none" stroke="${GREEN}" stroke-width="4" stroke-dasharray="12 18" opacity=".45"/>
      ${coinsAlongCurve(flowProgress, false, GREEN)}
      <path d="M310 730H770" stroke="#D4A660" stroke-width="2" stroke-dasharray="5 12" opacity=".46"/>
      ${text(beat.metricLabel ?? "КОНТРАКТ И ЕГО РИСК", 540, 1110, { size: 28, color: MUTED, weight: 700, letterSpacing: 1.5 })}`;
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
      ${badge(beat.metricLabel ?? "КУПОННАЯ ДОХОДНОСТЬ", 540, 465, "#B9F7D8", entry * livePulse, 350)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "Выплата приходит по графику", 540, 1100, { size: 29, color: WHITE, weight: 700 })}`;
  }

  if (beat.visual === "calendar" && beat.concept === "profit_distribution") {
    const stages = [
      { x: 290, label: "РЕШЕНИЕ" },
      { x: 540, label: "ДАТА ФИКСАЦИИ" },
      { x: 790, label: "ВЫПЛАТА" },
    ];
    return `${actors}
      ${panel(145, 490, 790, 400, "#0D1A22", PANEL_EDGE)}
      ${text("КАЛЕНДАРЬ ДИВИДЕНДА", 540, 565, { size: 30, color: GREEN, weight: 800, letterSpacing: 1.5 })}
      <line x1="290" y1="710" x2="790" y2="710" stroke="#35505B" stroke-width="8" stroke-linecap="round"/>
      <line x1="290" y1="710" x2="${290 + 500 * clamp(progress)}" y2="710" stroke="${GREEN}" stroke-width="8" stroke-linecap="round"/>
      ${stages.map((stage, index) => {
        const active = index / (stages.length - 1) <= progress;
        const pulse = active ? 1 + Math.sin(timeMs / 280 + index) * 0.1 : 1;
        return `<circle cx="${stage.x}" cy="710" r="${19 * pulse}" fill="${active ? GREEN : "#20343F"}" stroke="${active ? GREEN : "#3A5360"}" stroke-width="4"/>${text(stage.label, stage.x, 785, { size: 19, color: active ? WHITE : MUTED, weight: 750 })}`;
      }).join("")}
      ${text("ДЕНЬГИ → АКЦИОНЕРАМ", 540, 875, { size: 27, color: GOLD, weight: 800, letterSpacing: .8 })}`;
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
      ${badge(beat.maturityLabel ?? "ВОЗВРАТ НОМИНАЛА", 540, 465, GOLD, entry * livePulse, 330)}
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

function formatCoinOverviewUsd(value: number): string {
  const absolute = Math.abs(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: absolute >= 1_000 ? 0 : absolute >= 1 ? 2 : 6,
  }).format(value);
}

function formatCoinOverviewPercent(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.abs(value))}%`;
}

function renderCoinOverviewFrame(
  timeMs: number,
  durationMs: number,
  beat: FinancialShortBeat,
  beatIndex: number,
  data: CoinOverviewMarketData,
): string {
  const progress = ease(clamp(timeMs / Math.max(1, durationMs)));
  const intro = ease(clamp(progress / 0.24));
  const accent = data.changePercent7d >= 0 ? "#88E2B4" : "#EF8177";
  const prices = data.priceSamples.map((point) => point.priceUsd);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const spread = Math.max(0.0000001, high - low);
  const left = 142;
  const right = 938;
  const chartTop = 590;
  const chartBottom = 1_020;
  const chartPoints = data.priceSamples.map((point, index) => ({
    ...point,
    x: left + ((right - left) * index) / Math.max(1, data.priceSamples.length - 1),
    y: chartBottom - ((point.priceUsd - low) / spread) * (chartBottom - chartTop),
  }));
  const priceLinePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");
  const firstChartPoint = chartPoints[0]!;
  const lastChartPoint = chartPoints.at(-1)!;
  const areaPath = `${priceLinePath} L ${right} ${chartBottom} L ${left} ${chartBottom} Z`;
  const benchmarkValues = [
    { label: data.coin.symbol, value: data.changePercent7d, color: accent },
    { label: "BTC", value: data.benchmarks[0].changePercent7d, color: "#E9C875" },
    { label: "ETH", value: data.benchmarks[1].changePercent7d, color: "#86B8E8" },
  ];
  const maxBenchmark = Math.max(1, ...benchmarkValues.map((item) => Math.abs(item.value)));
  const sourceStamp = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(data.retrievedAt));
  const sourceList = data.activity.kind === "open_interest"
    ? "COINGECKO • HYPERLIQUID"
    : "COINGECKO";
  let scene = "";

  if (beatIndex === 0) {
    scene = `<g opacity="${intro.toFixed(3)}" transform="translate(540 820) scale(${(0.92 + intro * 0.08).toFixed(3)}) translate(-540 -820)">
      <circle cx="540" cy="790" r="246" fill="#101714" stroke="#D8BB75" stroke-opacity=".68" stroke-width="2"/>
      <circle cx="540" cy="790" r="218" fill="none" stroke="#88E2B4" stroke-width="3" stroke-dasharray="5 16" stroke-dashoffset="${-Math.round(timeMs / 42)}" opacity=".68"/>
      <circle cx="540" cy="790" r="172" fill="#0A0E0C" stroke="#39463B" stroke-width="2"/>
      <circle cx="540" cy="790" r="146" fill="none" stroke="#D8BB75" stroke-opacity=".3" stroke-width="1"/>
      ${text(data.coin.symbol.slice(0, 12), 540, 818, { size: 78, color: "#F4EEDC", weight: 800, letterSpacing: 2 })}
      ${text(formatCoinOverviewPercent(data.changePercent7d), 540, 470, { size: 82, color: accent, weight: 800 })}
      ${text("ИЗМЕНЕНИЕ ЗА 7 ДНЕЙ", 540, 520, { size: 20, color: "#B7C0B8", weight: 700, letterSpacing: 3 })}
      ${text(formatCoinOverviewUsd(data.currentPriceUsd), 540, 1_125, { size: 50, color: "#F4EEDC", weight: 700 })}
      ${text(data.coin.name.toLocaleUpperCase("ru-RU"), 540, 1_176, { size: 21, color: "#A7B2A9", weight: 600, letterSpacing: 2 })}
    </g>`;
  } else if (beatIndex === 1) {
    scene = `<g opacity="${intro.toFixed(3)}">
      ${text("СЕМЬ СНИМКОВ ЦЕНЫ", 540, 330, { size: 27, color: "#E8D39C", weight: 700, letterSpacing: 3 })}
      ${Array.from({ length: 5 }, (_, index) => {
        const y = chartTop + ((chartBottom - chartTop) * index) / 4;
        return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#E7EFE8" stroke-opacity=".11" stroke-width="2"/>`;
      }).join("")}
      <path d="${areaPath}" fill="#88E2B4" fill-opacity=".11"/>
      <path d="${priceLinePath}" fill="none" stroke="#88E2B4" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="1200" stroke-dashoffset="${Math.round(1200 * (1 - intro))}"/>
      ${chartPoints.map((point, index) => `<g>
        <circle cx="${point.x}" cy="${point.y}" r="${index === chartPoints.length - 1 ? 14 : 8}" fill="${index === chartPoints.length - 1 ? "#E8D39C" : "#88E2B4"}" stroke="#0A0E0C" stroke-width="4"/>
        ${text(point.label, point.x, 1_078, { size: 17, color: "#B7C0B8", weight: 600 })}
      </g>`).join("")}
      ${text(formatCoinOverviewUsd(data.lowPriceUsd7d), 142, 1_150, { size: 24, color: "#B7C0B8", weight: 600, anchor: "start" })}
      ${text(formatCoinOverviewUsd(data.highPriceUsd7d), 938, 1_150, { size: 24, color: "#B7C0B8", weight: 600, anchor: "end" })}
      ${text("МИН.", 142, 1_190, { size: 16, color: "#7F8E83", weight: 600, anchor: "start", letterSpacing: 2 })}
      ${text("МАКС.", 938, 1_190, { size: 16, color: "#7F8E83", weight: 600, anchor: "end", letterSpacing: 2 })}
    </g>`;
  } else if (beatIndex === 2) {
    const isOpenInterest = data.activity.kind === "open_interest";
    scene = `<g opacity="${intro.toFixed(3)}">
      <circle cx="540" cy="824" r="248" fill="none" stroke="#88E2B4" stroke-opacity=".16" stroke-width="2"/>
      <circle cx="540" cy="824" r="${150 + Math.sin(timeMs / 640) * 8}" fill="#0F1713" stroke="#D8BB75" stroke-opacity=".68" stroke-width="2"/>
      <circle cx="540" cy="824" r="120" fill="none" stroke="#88E2B4" stroke-width="2" stroke-dasharray="4 12" stroke-dashoffset="${-Math.round(timeMs / 36)}"/>
      ${text(isOpenInterest ? "OPEN INTEREST" : "24H VOLUME", 540, 426, { size: 23, color: "#E8D39C", weight: 700, letterSpacing: 3 })}
      ${text(formatCoinOverviewUsd(data.activity.valueUsd), 540, 824, { size: 67, color: "#F4EEDC", weight: 800 })}
      ${text(isOpenInterest ? "ОТКРЫТЫЕ ПОЗИЦИИ" : "ОБОРОТ ЗА 24 ЧАСА", 540, 1_190, { size: 24, color: "#AFC0B2", weight: 700, letterSpacing: 2 })}
      ${text(data.activity.sourceLabel.toLocaleUpperCase("ru-RU"), 540, 1_235, { size: 17, color: "#829186", weight: 600, letterSpacing: 3 })}
      ${isOpenInterest ? text("ОДНА БИРЖА • НЕ СОВОКУПНЫЙ РЫНОК", 540, 1_278, { size: 16, color: "#829186", weight: 600 }) : ""}
    </g>`;
  } else if (beatIndex === 3) {
    const zeroX = 540;
    const maxWidth = 300;
    scene = `<g opacity="${intro.toFixed(3)}">
      ${text("7-ДНЕВНОЕ ИЗМЕНЕНИЕ", 540, 360, { size: 25, color: "#E8D39C", weight: 700, letterSpacing: 3 })}
      <line x1="${zeroX}" y1="484" x2="${zeroX}" y2="1180" stroke="#E7EFE8" stroke-opacity=".48" stroke-width="2"/>
      ${benchmarkValues.map((item, index) => {
        const y = 585 + index * 218;
        const width = Math.max(6, Math.abs(item.value) / maxBenchmark * maxWidth);
        const x = item.value >= 0 ? zeroX : zeroX - width;
        return `<g>
          ${text(item.label, 128, y + 12, { size: 30, color: "#F4EEDC", weight: 800, anchor: "start", letterSpacing: 2 })}
          <rect x="${x.toFixed(1)}" y="${y - 38}" width="${width.toFixed(1)}" height="74" rx="18" fill="${item.color}" opacity=".86"/>
          ${text(formatCoinOverviewPercent(item.value), item.value >= 0 ? zeroX + width + 18 : x - 18, y + 12, {
            size: 27,
            color: item.color,
            weight: 800,
            anchor: item.value >= 0 ? "start" : "end",
          })}
        </g>`;
      }).join("")}
      ${text("BTC И ETH — КОНТЕКСТ, НЕ ПРИЧИНА", 540, 1_310, { size: 18, color: "#8A998E", weight: 600, letterSpacing: 2 })}
    </g>`;
  } else if (beatIndex === 4) {
    scene = `<g opacity="${intro.toFixed(3)}">
      <circle cx="540" cy="810" r="268" fill="none" stroke="#D8BB75" stroke-opacity=".32" stroke-width="2"/>
      <circle cx="540" cy="810" r="214" fill="#101714" stroke="#88E2B4" stroke-opacity=".36" stroke-width="2"/>
      ${text("УСЛОВНЫЙ РАСЧЁТ", 540, 444, { size: 24, color: "#E8D39C", weight: 700, letterSpacing: 3 })}
      ${text(formatCoinOverviewUsd(100), 540, 752, { size: 88, color: "#F4EEDC", weight: 800 })}
      ${text("→", 540, 872, { size: 62, color: "#D8BB75", weight: 500 })}
      ${text(formatCoinOverviewUsd(data.hypothetical100Usd), 540, 1_012, { size: 76, color: accent, weight: 800 })}
      ${text("ДО КОМИССИЙ, НАЛОГОВ И ПРОСКАЛЬЗЫВАНИЯ", 540, 1_270, { size: 17, color: "#AFC0B2", weight: 600, letterSpacing: 1 })}
      ${text("ИСТОРИЧЕСКАЯ ИЛЛЮСТРАЦИЯ • НЕ ПРОГНОЗ", 540, 1_316, { size: 17, color: "#7F8E83", weight: 600, letterSpacing: 1 })}
    </g>`;
  } else {
    scene = `<g opacity="${intro.toFixed(3)}">
      <rect x="100" y="342" width="880" height="1015" rx="30" fill="#EEEBDD" stroke="#D8BB75" stroke-width="2"/>
      ${text("СНАЧАЛА — РИСК", 540, 470, { size: 28, color: "#202722", weight: 800, letterSpacing: 3 })}
      ${textLines("Криптоактивы волатильны. Цена может резко упасть.", 540, 620, 36, 48, { size: 31, color: "#303A32", weight: 600 })}
      ${textLines("Прошлая динамика не гарантирует будущий результат.", 540, 800, 36, 48, { size: 27, color: "#4B564D", weight: 600 })}
      <line x1="190" y1="920" x2="890" y2="920" stroke="#B9B5A8" stroke-width="2"/>
      ${text("ИСТОЧНИКИ", 540, 1_005, { size: 18, color: "#717A70", weight: 700, letterSpacing: 3 })}
      ${text(sourceList, 540, 1_065, { size: 24, color: "#202722", weight: 800, letterSpacing: 2 })}
      ${text(`ДАННЫЕ ПОЛУЧЕНЫ • ${sourceStamp} UTC`, 540, 1_125, { size: 18, color: "#4B564D", weight: 600 })}
      ${text(`COINGECKO.COM/EN/COINS/${data.coin.id.toLocaleUpperCase("en-US")}`, 540, 1_190, { size: 15, color: "#687267", weight: 600 })}
      ${text("ОБРАЗОВАТЕЛЬНЫЙ МАТЕРИАЛ • НЕ ИНВЕСТСОВЕТ", 540, 1_285, { size: 17, color: "#202722", weight: 800, letterSpacing: 1 })}
    </g>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="coin-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#111814"/>
        <stop offset="1" stop-color="#050807"/>
      </linearGradient>
      <radialGradient id="coin-glow" cx="50%" cy="43%" r="60%">
        <stop offset="0" stop-color="#355844" stop-opacity=".28"/>
        <stop offset="1" stop-color="#050807" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#coin-bg)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#coin-glow)"/>
    ${Array.from({ length: 9 }, (_, index) => `<line x1="74" y1="${300 + index * 145}" x2="1006" y2="${300 + index * 145}" stroke="#E7EFE8" stroke-opacity=".025" stroke-width="1"/>`).join("")}
    ${text("МОНЕТА В ФОКУСЕ • 7 ДНЕЙ", 74, 105, { size: 19, color: "#B5C1B6", weight: 700, anchor: "start", letterSpacing: 3 })}
    ${text(data.coin.symbol, 74, 188, { size: 42, color: "#F4EEDC", weight: 800, anchor: "start", letterSpacing: 2 })}
    ${text(`${String(beatIndex + 1).padStart(2, "0")} / 06`, 1_006, 188, { size: 20, color: "#8D9A90", weight: 700, anchor: "end", letterSpacing: 2 })}
    <rect x="74" y="218" width="932" height="3" rx="2" fill="#E7EFE8" opacity=".14"/>
    <rect x="74" y="218" width="${(932 * progress).toFixed(1)}" height="3" rx="2" fill="#D8BB75"/>
    ${text(beat.title, 540, 284, { size: 27, color: "#E8D39C", weight: 700, letterSpacing: 2 })}
    ${scene}
    ${text("ИСТОЧНИК ДАННЫХ: COINGECKO", 540, 1_805, { size: 16, color: "#77857A", weight: 600, letterSpacing: 2 })}
  </svg>`;
}

function formatMarketFocusUsdt(value: number): string {
  const number = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: value >= 1_000 ? 0 : 2,
    maximumFractionDigits: value >= 1_000 ? 0 : value >= 1 ? 2 : 6,
  }).format(value);
  return `${number} USDT`;
}

function renderMarketFocusFrame(
  timeMs: number,
  durationMs: number,
  beat: FinancialShortBeat,
  beatIndex: number,
  data: MarketFocusMarketData,
): string {
  const normalized = clamp(timeMs / Math.max(1, durationMs));
  const progress = localProgress(normalized, beat.from, beat.to);
  const intro = ease(clamp(progress / 0.16));
  const accent = data.changePercent24h >= 0 ? "#63E6A7" : "#FF6377";
  const muted = "#91A49A";
  const price = (value: number) => formatMarketFocusUsdt(value);
  const newsTitle = data.news
    ? data.news.title.length > 138
      ? `${data.news.title.slice(0, 135).trimEnd()}…`
      : data.news.title
    : "";
  let scene = "";

  if (beatIndex === 0) {
    const firstOpen = data.hourlyCandles[0]!.open;
    const absoluteChange = data.currentPrice - firstOpen;
    const absoluteChangeLabel = `${absoluteChange >= 0 ? "+" : "−"}${price(Math.abs(absoluteChange))}`;
    scene = `<g opacity="${intro.toFixed(3)}" transform="translate(540 790) scale(${(0.92 + intro * 0.08).toFixed(3)}) translate(-540 -790)">
      <circle cx="540" cy="790" r="250" fill="#101A15" stroke="#D7BE83" stroke-opacity=".66" stroke-width="2"/>
      <circle cx="540" cy="790" r="218" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="5 15" stroke-dashoffset="${-Math.round(timeMs / 44)}" opacity=".76"/>
      <circle cx="540" cy="790" r="171" fill="#080D0B" stroke="#34443A" stroke-width="2"/>
      ${text(data.coin.symbol, 540, 804, { size: 78, color: "#F3F1E8", weight: 800, letterSpacing: 3 })}
      ${text(formatCoinOverviewPercent(data.changePercent24h), 540, 488, { size: 83, color: accent, weight: 800 })}
      ${text("ЗА 24 ЗАКРЫТЫХ ЧАСА", 540, 538, { size: 21, color: "#B5C3BA", weight: 700, letterSpacing: 3 })}
      ${text(price(data.currentPrice), 540, 1_118, { size: 43, color: "#F3F1E8", weight: 700 })}
      ${text(data.coin.name.toLocaleUpperCase("ru-RU"), 540, 1_168, { size: 20, color: muted, weight: 600, letterSpacing: 2 })}
      ${text(`ОТКРЫТИЕ ${price(firstOpen)} · ИЗМЕНЕНИЕ ${absoluteChangeLabel}`, 540, 1_238, { size: 19, color: "#B5C3BA", weight: 700 })}
    </g>`;
  } else if (beatIndex === 1) {
    const chart = { left: 158, right: 922, top: 448, bottom: 1_080 };
    const min = Math.min(...data.hourlyCandles.map((candle) => candle.low));
    const max = Math.max(...data.hourlyCandles.map((candle) => candle.high));
    const span = Math.max(0.0000001, max - min);
    const y = (value: number) => chart.bottom - ((value - min) / span) * (chart.bottom - chart.top);
    const step = (chart.right - chart.left) / data.hourlyCandles.length;
    const highIndex = data.hourlyCandles.findIndex((candle) => candle.high === max);
    const lowIndex = data.hourlyCandles.findIndex((candle) => candle.low === min);
    const highCandle = data.hourlyCandles[highIndex]!;
    const lowCandle = data.hourlyCandles[lowIndex]!;
    const risingHours = data.hourlyCandles.filter((candle) => candle.close > candle.open).length;
    const fallingHours = data.hourlyCandles.filter((candle) => candle.close < candle.open).length;
    const neutralHours = data.hourlyCandles.length - risingHours - fallingHours;
    const hasPriceRange = max > min;
    const currentRangePercent = hasPriceRange
      ? Math.max(0, Math.min(100, ((data.currentPrice - min) / span) * 100))
      : 50;
    const currentRangeLabel = hasPriceRange ? `${currentRangePercent.toFixed(0)}%` : "без диапазона";
    const rangeMarkerX = chart.left + ((chart.right - chart.left) * currentRangePercent) / 100;
    const highX = chart.left + step * (highIndex + 0.5);
    const lowX = chart.left + step * (lowIndex + 0.5);
    scene = `<g opacity="${intro.toFixed(3)}">
      ${text("24 ЗАКРЫТЫЕ ЧАСОВЫЕ СВЕЧИ", 540, 374, { size: 24, color: "#D8C68F", weight: 700, letterSpacing: 2 })}
      ${Array.from({ length: 5 }, (_, index) => {
        const gridY = chart.top + ((chart.bottom - chart.top) * index) / 4;
        return `<line x1="${chart.left}" y1="${gridY}" x2="${chart.right}" y2="${gridY}" stroke="#E8F2EB" stroke-opacity=".1" stroke-width="2"/>`;
      }).join("")}
      ${data.hourlyCandles.map((candle, index) => {
        const x = chart.left + step * (index + 0.5);
        const candleColor = candle.close >= candle.open ? "#63E6A7" : "#FF6377";
        const openY = y(candle.open);
        const closeY = y(candle.close);
        const bodyY = Math.min(openY, closeY);
        const bodyHeight = Math.max(4, Math.abs(closeY - openY));
        return `<g opacity="${(0.28 + intro * 0.72).toFixed(3)}">
          <line x1="${x.toFixed(1)}" y1="${y(candle.high).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y(candle.low).toFixed(1)}" stroke="${candleColor}" stroke-width="3"/>
          <rect x="${(x - 8).toFixed(1)}" y="${bodyY.toFixed(1)}" width="16" height="${bodyHeight.toFixed(1)}" rx="2" fill="${candleColor}"/>
        </g>`;
      }).join("")}
      <line x1="${chart.left}" y1="${y(max).toFixed(1)}" x2="${chart.right}" y2="${y(max).toFixed(1)}" stroke="#D7BE83" stroke-opacity=".48" stroke-width="2" stroke-dasharray="8 10"/>
      <line x1="${chart.left}" y1="${y(min).toFixed(1)}" x2="${chart.right}" y2="${y(min).toFixed(1)}" stroke="#D7BE83" stroke-opacity=".48" stroke-width="2" stroke-dasharray="8 10"/>
      <line x1="${chart.left}" y1="${y(data.currentPrice).toFixed(1)}" x2="${chart.right}" y2="${y(data.currentPrice).toFixed(1)}" stroke="#F3F1E8" stroke-opacity=".56" stroke-width="2" stroke-dasharray="4 9"/>
      <circle cx="${highX.toFixed(1)}" cy="${y(max).toFixed(1)}" r="8" fill="#D7BE83" stroke="#101713" stroke-width="3"/>
      <circle cx="${lowX.toFixed(1)}" cy="${y(min).toFixed(1)}" r="8" fill="#D7BE83" stroke="#101713" stroke-width="3"/>
      ${[0, 6, 12, 18, 23].map((index) => {
        const candle = data.hourlyCandles[index]!;
        const x = chart.left + step * (index + 0.5);
        const anchor = index === 0 ? "start" : index === 23 ? "end" : "middle";
        return text(
          new Date(candle.openTime).toISOString().slice(11, 16),
          x,
          chart.bottom + 38,
          { size: 15, color: muted, weight: 600, anchor },
        );
      }).join("")}
      ${text(price(max), 130, chart.top + 8, { size: 21, color: "#E9EFEA", weight: 700, anchor: "end" })}
      ${text(price(min), 130, chart.bottom + 8, { size: 21, color: "#E9EFEA", weight: 700, anchor: "end" })}
      ${text(`МАКСИМУМ ${new Date(highCandle.openTime).toISOString().slice(11, 16)} UTC · МИНИМУМ ${new Date(lowCandle.openTime).toISOString().slice(11, 16)} UTC`, 540, 1_170, { size: 17, color: muted, weight: 700 })}
      ${text(`${risingHours} растущих · ${fallingHours} снижающихся · ${neutralHours} без изменений`, 540, 1_218, { size: 18, color: "#F3F1E8", weight: 700 })}
      ${text("ПОЗИЦИЯ ТЕКУЩЕЙ ЦЕНЫ В ДИАПАЗОНЕ", 540, 1_278, { size: 16, color: muted, weight: 700, letterSpacing: 1 })}
      <rect x="${chart.left}" y="1304" width="${chart.right - chart.left}" height="14" rx="7" fill="#2D3B32"/>
      <rect x="${chart.left}" y="1304" width="${((chart.right - chart.left) * currentRangePercent / 100).toFixed(1)}" height="14" rx="7" fill="${accent}" opacity=".75"/>
      <circle cx="${rangeMarkerX.toFixed(1)}" cy="1311" r="12" fill="#F3F1E8" stroke="#101713" stroke-width="4"/>
      ${text(`${price(min)} · LOW`, chart.left, 1_356, { size: 16, color: muted, weight: 600, anchor: "start" })}
      ${text(currentRangeLabel, 540, 1_356, { size: 18, color: "#F3F1E8", weight: 800 })}
      ${text(`${price(max)} · HIGH`, chart.right, 1_356, { size: 16, color: muted, weight: 600, anchor: "end" })}
    </g>`;
  } else if (beatIndex === 2) {
    const average = data.averageDailyQuoteVolume7d;
    const bars = [
      ...data.dailyQuoteVolumes.map((day) => ({
        label: day.dayUtc.slice(5),
        value: day.quoteVolume / average,
        color: "#648A77",
      })),
      {
        label: "24 Ч",
        value: data.volumeVs7dAverage,
        color: accent,
      },
    ];
    const maxRatio = Math.max(1, ...bars.map((bar) => bar.value));
    const baselineY = 1_080;
    const maxHeight = 500;
    scene = `<g opacity="${intro.toFixed(3)}">
      ${text("ОБОРОТ В ПАРЕ USDT", 540, 372, { size: 26, color: "#D8C68F", weight: 700, letterSpacing: 3 })}
      ${text(`${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(data.volumeVs7dAverage)}×`, 540, 528, { size: 78, color: accent, weight: 800 })}
      ${text("СРЕДНЕГО ЗА 7 ПОЛНЫХ UTC-ДНЕЙ", 540, 576, { size: 18, color: muted, weight: 700, letterSpacing: 2 })}
      <line x1="150" y1="${baselineY}" x2="930" y2="${baselineY}" stroke="#E7EFE8" stroke-opacity=".34" stroke-width="2"/>
      ${bars.map((bar, index) => {
        const width = 68;
        const gap = 24;
        const x = 178 + index * (width + gap);
        const height = Math.max(5, Math.min(maxHeight, (bar.value / maxRatio) * maxHeight));
        const ratioLabel = `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(bar.value)}×`;
        const ratioY = Math.max(610, baselineY - height - 18);
        return `<g>
          <rect x="${x}" y="${(baselineY - height).toFixed(1)}" width="${width}" height="${height.toFixed(1)}" rx="14" fill="${bar.color}" opacity=".9"/>
          ${text(ratioLabel, x + width / 2, ratioY, { size: 14, color: bar.label === "24 Ч" ? "#F3F1E8" : muted, weight: 700 })}
          ${text(bar.label, x + width / 2, baselineY + 42, { size: 17, color: bar.label === "24 Ч" ? "#F1F3EE" : muted, weight: 700 })}
        </g>`;
      }).join("")}
      ${text(`24 Ч: ${formatMarketFocusUsdt(data.quoteVolume24h)}`, 540, 1_230, { size: 25, color: "#F3F1E8", weight: 700 })}
      ${text(`7-дневное среднее: ${formatMarketFocusUsdt(average)}`, 540, 1_278, { size: 19, color: muted, weight: 600 })}
    </g>`;
  } else if (beatIndex === 3) {
    if (data.news) {
      const published = new Intl.DateTimeFormat("ru-RU", {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }).format(new Date(data.news.publishedAt));
      scene = `<g opacity="${intro.toFixed(3)}">
        <rect x="112" y="408" width="856" height="740" rx="30" fill="#101A15" stroke="#D7BE83" stroke-opacity=".58" stroke-width="2"/>
        <rect x="156" y="454" width="112" height="5" rx="2" fill="${accent}"/>
        ${text("ЗАГОЛОВОК ИЗ ИСТОЧНИКА", 540, 534, { size: 21, color: "#D8C68F", weight: 700, letterSpacing: 3 })}
        ${textLines(newsTitle, 540, 676, 31, 52, { size: 33, color: "#F3F1E8", weight: 700 })}
        ${text(data.news.sourceName.toLocaleUpperCase("ru-RU"), 540, 1_018, { size: 23, color: accent, weight: 800, letterSpacing: 2 })}
        ${text(`${published} UTC · прямая лента издателя`, 540, 1_070, { size: 18, color: muted, weight: 600 })}
        ${text("ВОЗМОЖНЫЙ КОНТЕКСТ • ПРИЧИНА НЕ ДОКАЗАНА", 540, 1_234, { size: 17, color: "#B5C3BA", weight: 700, letterSpacing: 1 })}
      </g>`;
    } else {
      scene = `<g opacity="${intro.toFixed(3)}">
        <rect x="112" y="408" width="856" height="740" rx="30" fill="#101A15" stroke="#D7BE83" stroke-opacity=".58" stroke-width="2"/>
        <rect x="156" y="454" width="112" height="5" rx="2" fill="${accent}"/>
        ${text("НОВОСТНОЙ КАТАЛИЗАТОР НЕ НАЙДЕН", 540, 534, { size: 21, color: "#D8C68F", weight: 700, letterSpacing: 2 })}
        ${textLines("В доступных проверенных лентах за последние 7 дней нет свежего подтверждённого инфоповода.", 540, 704, 35, 43, { size: 31, color: "#F3F1E8", weight: 700 })}
        ${text("ТОЧНЫЙ ПОВОД НЕ УСТАНОВЛЕН", 540, 964, { size: 23, color: accent, weight: 800, letterSpacing: 2 })}
        ${textLines("Оборот и сравнение с BTC и ETH — рыночный контекст, а не доказанная причина.", 540, 1_052, 28, 52, { size: 19, color: muted, weight: 600 })}
      </g>`;
    }
  } else if (beatIndex === 4) {
    const values = [
      { label: data.coin.symbol, value: data.changePercent24h, color: accent },
      { label: "BTC", value: data.benchmarks[0].changePercent24h, color: "#F2BA6B" },
      { label: "ETH", value: data.benchmarks[1].changePercent24h, color: "#A4A0F7" },
    ];
    const zeroX = 540;
    const maxValue = Math.max(2, ...values.map((item) => Math.abs(item.value)));
    const maxWidth = 320;
    scene = `<g opacity="${intro.toFixed(3)}">
      ${text("ОДИНАКОВОЕ ОКНО • UTC", 540, 382, { size: 23, color: "#D8C68F", weight: 700, letterSpacing: 3 })}
      <line x1="${zeroX}" y1="462" x2="${zeroX}" y2="1180" stroke="#E7EFE8" stroke-opacity=".45" stroke-width="2"/>
      ${values.map((item, index) => {
        const y = 596 + index * 204;
        const width = Math.max(8, Math.abs(item.value) / maxValue * maxWidth);
        const x = item.value >= 0 ? zeroX : zeroX - width;
        return `<g>
          ${text(item.label, 144, y + 10, { size: 29, color: "#F3F1E8", weight: 800, anchor: "start", letterSpacing: 2 })}
          <rect x="${x.toFixed(1)}" y="${y - 34}" width="${width.toFixed(1)}" height="66" rx="17" fill="${item.color}" opacity=".88"/>
          ${text(formatCoinOverviewPercent(item.value), item.value >= 0 ? zeroX + width + 16 : x - 16, y + 10, {
            size: 25,
            color: item.color,
            weight: 800,
            anchor: item.value >= 0 ? "start" : "end",
          })}
        </g>`;
      }).join("")}
      ${text("BTC И ETH — СРАВНЕНИЕ, НЕ ПРИЧИНА", 540, 1_258, { size: 18, color: muted, weight: 600, letterSpacing: 1 })}
    </g>`;
  } else {
    const retrieved = new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    }).format(new Date(data.retrievedAt));
    scene = `<g opacity="${intro.toFixed(3)}">
      <rect x="110" y="398" width="860" height="814" rx="30" fill="#ECEBDD" stroke="#D7BE83" stroke-width="2"/>
      ${text("СНАЧАЛА — РИСК", 540, 516, { size: 27, color: "#242C27", weight: 800, letterSpacing: 3 })}
      ${textLines("Суточный импульс может быстро развернуться.", 540, 656, 40, 52, { size: 32, color: "#303A32", weight: 700 })}
      ${textLines(
        data.news
          ? "Новость не доказывает причину движения или спрос на токен."
          : "Подтверждённого инфоповода не найдено. Точный повод роста не установлен.",
        540,
        832,
        38,
        50,
        { size: 28, color: "#4B564D", weight: 600 },
      )}
      <line x1="194" y1="964" x2="886" y2="964" stroke="#B9B5A8" stroke-width="2"/>
      ${text("ИСТОЧНИКИ", 540, 1_034, { size: 18, color: "#717A70", weight: 700, letterSpacing: 3 })}
      ${text(
        data.news
          ? `BINANCE SPOT • ${data.news.sourceName.toLocaleUpperCase("ru-RU")}`
          : "BINANCE SPOT • ПРОВЕРЕННЫЕ RSS-ЛЕНТЫ",
        540,
        1_094,
        { size: 18, color: "#202722", weight: 800, letterSpacing: 1 },
      )}
      ${text(`ДАННЫЕ ПОЛУЧЕНЫ • ${retrieved} UTC`, 540, 1_148, { size: 16, color: "#4B564D", weight: 600 })}
      ${text("ОБРАЗОВАТЕЛЬНЫЙ МАТЕРИАЛ • НЕ ИНВЕСТСОВЕТ", 540, 1_176, { size: 14, color: "#202722", weight: 800, letterSpacing: 1 })}
    </g>`;
  }

  const windowLabel = `${new Date(data.periodStartUtc).toISOString().slice(0, 16)}–${new Date(data.periodEndUtc).toISOString().slice(0, 16)} UTC`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="market-focus-bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#101713"/>
        <stop offset="1" stop-color="#050807"/>
      </linearGradient>
      <radialGradient id="market-focus-glow" cx="50%" cy="42%" r="62%">
        <stop offset="0" stop-color="#315845" stop-opacity=".28"/>
        <stop offset="1" stop-color="#050807" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#market-focus-bg)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#market-focus-glow)"/>
    ${Array.from({ length: 9 }, (_, index) => `<line x1="74" y1="${300 + index * 145}" x2="1006" y2="${300 + index * 145}" stroke="#E7EFE8" stroke-opacity=".025" stroke-width="1"/>`).join("")}
    ${text("МОНЕТА В ФОКУСЕ • 24 ЧАСА", 74, 105, { size: 19, color: "#B5C1B6", weight: 700, anchor: "start", letterSpacing: 3 })}
    ${text(data.coin.symbol, 74, 188, { size: 42, color: "#F3F1E8", weight: 800, anchor: "start", letterSpacing: 2 })}
    ${text(`${String(beatIndex + 1).padStart(2, "0")} / 06`, 1_006, 188, { size: 20, color: muted, weight: 700, anchor: "end", letterSpacing: 2 })}
    <rect x="74" y="218" width="932" height="3" rx="2" fill="#E7EFE8" opacity=".14"/>
    <rect x="74" y="218" width="${(932 * progress).toFixed(1)}" height="3" rx="2" fill="#D7BE83"/>
    ${text(beat.title, 540, 284, { size: 25, color: "#D8C68F", weight: 700, letterSpacing: 2 })}
    ${scene}
    ${text(`BINANCE SPOT • ${data.coin.pair} • ${windowLabel}`, 540, 1_808, { size: 15, color: "#77857A", weight: 600, letterSpacing: 1 })}
  </svg>`;
}

function renderFrame(
  timeMs: number,
  durationMs: number,
  beats: FinancialShortBeat[],
  mainTitle = "ЧТО ТАКОЕ ОБЛИГАЦИЯ?",
  background: FinanceBackgroundId = "grid",
  visualTheme: "classic_dark" | "premium_creator" | "crypto_f2" | "coin_overview" | "market_focus_24h" = "premium_creator",
  inlinePresenter = false,
  visualAssets: Record<string, FinancialRasterAsset> = {},
  coinOverviewData?: CoinOverviewMarketData,
  marketFocusData?: MarketFocusMarketData,
): string {
  const normalized = clamp(timeMs / Math.max(1, durationMs));
  const beat = beats.find((candidate) => normalized >= candidate.from && normalized < candidate.to) ?? beats.at(-1)!;
  const beatIndex = Math.max(0, beats.indexOf(beat));
  if (visualTheme === "coin_overview") {
    if (!coinOverviewData) throw new Error("Для рендера «Обзор монет» не сохранены рыночные данные.");
    return renderCoinOverviewFrame(timeMs, durationMs, beat, beatIndex, coinOverviewData);
  }
  if (visualTheme === "market_focus_24h") {
    if (!marketFocusData) throw new Error("Для рендера «Монета в фокусе — 24 часа» не сохранены рыночные данные.");
    return renderMarketFocusFrame(timeMs, durationMs, beat, beatIndex, marketFocusData);
  }
  const premiumCreator = visualTheme === "premium_creator";
  const cryptoF2 = visualTheme === "crypto_f2";
  const sceneBackground = beat.background ?? background;
  const progress = localProgress(normalized, beat.from, beat.to);
  const activeMoment = beat.visualMoments?.find((moment) => progress >= moment.from && progress < moment.to)
    ?? beat.visualMoments?.at(-1);
  const activeMomentProgress = activeMoment
    ? localProgress(progress, activeMoment.from, activeMoment.to)
    : 0;
  const activeMomentIndex = activeMoment ? beat.visualMoments?.indexOf(activeMoment) ?? -1 : -1;
  const previousMoment = activeMomentIndex > 0 ? beat.visualMoments?.[activeMomentIndex - 1] : undefined;
  const cryptoF2PreviousMoment = activeMomentIndex > 0
    ? previousMoment
    : beats[beatIndex - 1]?.visualMoments?.at(-1);
  const startFocus = cameraFocalPoint(previousMoment?.position);
  const endFocus = cameraFocalPoint(activeMoment?.position);
  const momentFocusProgress = ease(clamp(activeMomentProgress / 0.34));
  const cameraFocusX = startFocus.x + (endFocus.x - startFocus.x) * momentFocusProgress;
  const cameraFocusY = startFocus.y + (endFocus.y - startFocus.y) * momentFocusProgress;
  const presenterLayout = presenterLayoutForBeat(beat);
  const beatStartMs = beat.from * durationMs;
  const beatEndMs = beat.to * durationMs;
  const stickerRail = premiumCreator
    ? renderFinancialStickerRail(beats, durationMs, timeMs, presenterLayout)
    : "";
  const sceneIntro = premiumCreator || cryptoF2 ? 1 : ease(clamp(progress / 0.14));
  const cameraProgress = ease(progress);
  const requestedCameraAction = (beat.cameraAction ?? "").toLocaleLowerCase("en-US");
  const cameraAction = cryptoF2
    ? "locked"
    : !requestedCameraAction || requestedCameraAction === "locked"
      ? premiumCreator ? "locked" : defaultCameraActionForVisual(beat.visual, beatIndex)
      : requestedCameraAction;
  const momentArc = Math.sin(Math.PI * clamp(activeMomentProgress));
  const motionDirection = endFocus.x < startFocus.x ? -1 : 1;
  const panDirection = cameraAction.includes("pan_left") ? -1 : cameraAction.includes("pan_right") ? 1 : 0;
  const followsSubject = cameraAction.includes("follow_flow") || cameraAction.includes("tracking");
  const parallaxX = cameraAction.includes("parallax") ? motionDirection * momentArc * 14 : 0;
  const parallaxY = cameraAction.includes("parallax") ? -momentArc * 5 : 0;
  const focusPanX = cameraAction.includes("focus_shift") ? clamp((540 - cameraFocusX) * 0.11, -28, 28) : 0;
  const focusPanY = cameraAction.includes("focus_shift") ? clamp((780 - cameraFocusY) * 0.08, -26, 26) : 0;
  const cameraX = panDirection * cameraProgress * 28
    + (followsSubject ? motionDirection * momentArc * 12 : 0)
    + parallaxX
    + focusPanX;
  const cameraY = (cameraAction.includes("push_in") ? -12 * cameraProgress : 0)
    + (cameraAction.includes("pull_back") ? 10 * cameraProgress : 0)
    + (cameraAction.includes("tracking") ? -momentArc * 5 : 0)
    + parallaxY
    + focusPanY;
  const directedScale = cameraAction.includes("push_in")
    ? 1 + cameraProgress * 0.03
    : cameraAction.includes("pull_back")
      ? 1 - cameraProgress * 0.02
      : cameraAction.includes("focus_shift")
        ? 1 + momentArc * 0.01
      : 1;
  const cameraScale = directedScale;
  const cameraTranslationX = cameraX + WIDTH / 2 * (1 - cameraScale);
  const cameraTranslationY = cameraY + HEIGHT / 2 * (1 - cameraScale);
  const cameraRotation = cameraAction.includes("orbit") ? momentArc * 0.18 : 0;
  const subtitleLines = wrapText(beat.subtitle, 35);
  const hueRotation = premiumCreator ? 0 : sceneHueRotation(beat);
  const presenterAnimation = premiumCreator
    ? getPresenterAnimationState(beat, progress, Math.max(0, timeMs - beatStartMs))
    : undefined;
  const presenterDataUri = inlinePresenter && presenterAnimation
    ? getFinancialPresenterDataUri(presenterAnimation)
    : undefined;
  const sceneContent = premiumCreator
    ? `${stickerRail}
      ${renderFullPresenter(beat, progress, timeMs, presenterLayout)}`
    : cryptoF2
      ? renderCryptoF2SceneContent(
          beat,
          activeMoment,
          activeMomentProgress,
          cryptoF2PreviousMoment,
          progress,
          timeMs,
          beatIndex === 0,
        )
      : `<g filter="url(#scene-hue)">
          ${renderVisual(beat, progress, timeMs, beatStartMs, beatEndMs)}
          ${renderSceneMotion(beat, progress, timeMs, false)}
        </g>`;
  const captionY = premiumCreator ? 1_472 : 1_390;
  const captionHeight = premiumCreator ? 344 : subtitleLines.length > 2 ? 230 : 190;
  const captionFill = premiumCreator ? "#121A1C" : cryptoF2 ? "#151D19" : "#0D1A22";
  const captionStroke = premiumCreator ? "#536054" : cryptoF2 ? "#587261" : PANEL_EDGE;
  const captionTitleColor = premiumCreator ? "#E0B56F" : cryptoF2 ? "#A7DDBA" : GREEN;
  const captionTextColor = premiumCreator ? "#F0ECE3" : cryptoF2 ? "#F2EBDD" : WHITE;
  const headingLabelColor = premiumCreator ? "#C49A5D" : cryptoF2 ? "#A7DDBA" : GREEN;
  const headingColor = premiumCreator ? "#F0EADF" : cryptoF2 ? "#F2EBDD" : WHITE;
  const mutedColor = premiumCreator ? "#C9C1B3" : cryptoF2 ? "#B8C4BA" : MUTED;
  const normalizedTitle = beat.title.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
  const normalizedSubtitle = beat.subtitle.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
  const captionSubtitle = normalizedTitle && normalizedTitle === normalizedSubtitle ? "" : beat.subtitle;
  const textAnimation = (beat.textAnimation ?? "reveal").toLocaleLowerCase("en-US");
  const titleBarWidth = 110 + 450 * ease(clamp(progress / 0.25));
  const titleEntry = !premiumCreator && beatIndex === 0 ? ease(clamp(progress / 0.34)) : 1;
  const captionPanel = premiumCreator
    ? ""
    : cryptoF2
      ? renderCryptoF2Caption(activeMoment)
      : `<g opacity="${clamp(0.82 + progress * .18)}" transform="translate(0 ${(1 - sceneIntro) * 22})">
        <rect x="92" y="${captionY}" width="896" height="${captionHeight}" rx="34" fill="${captionFill}" stroke="${captionStroke}" stroke-width="2"/>
        <rect x="126" y="${captionY + 28}" width="160" height="4" rx="2" fill="${captionTitleColor}" opacity=".5"/>
        ${textLines(beat.title, 540, captionY + 60, 32, 40, { size: 25, color: captionTitleColor, weight: 800 })}
        ${captionSubtitle
          ? textLines(captionSubtitle, 540, captionY + 140, 35, 42, { size: 26, color: captionTextColor, weight: 600 })
          : ""}
      </g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${cryptoF2 ? "#101714" : "#0B151D"}"/>
        <stop offset="1" stop-color="${cryptoF2 ? "#070A08" : "#050A0E"}"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="42%" r="58%">
        <stop offset="0" stop-color="#1B6A4A" stop-opacity=".3"/>
        <stop offset="1" stop-color="#071016" stop-opacity="0"/>
      </radialGradient>
      <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
      <filter id="scene-hue"><feColorMatrix type="hueRotate" values="${hueRotation}"/></filter>
    </defs>
    ${premiumCreator
      ? `<g transform="translate(${(cameraX * 0.38).toFixed(1)} ${(cameraY * 0.38).toFixed(1)})">${renderPremiumCreatorBackground(timeMs)}</g>`
      : `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
        ${cryptoF2
          ? renderCryptoF2Ambient(timeMs)
          : `<g filter="url(#scene-hue)">${renderBackgroundLayer(sceneBackground, timeMs)}</g>
            <path d="M-120 1240 C220 1080 420 1380 760 1180 S1180 1080 1220 920" fill="none" stroke="${GREEN}" stroke-width="3" stroke-dasharray="8 34" opacity=".2" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>`}`}
    <g transform="translate(${cameraTranslationX.toFixed(1)} ${cameraTranslationY.toFixed(1)}) rotate(${cameraRotation.toFixed(3)} ${WIDTH / 2} ${HEIGHT / 2}) scale(${cameraScale.toFixed(4)})">
      <circle cx="540" cy="760" r="380" fill="${GREEN}" opacity=".06" filter="url(#soft-glow)"/>
      ${premiumCreator ? "" : text(cryptoF2 ? "КРИПТО Ф2 • ВИЗУАЛЬНОЕ ОБЪЯСНЕНИЕ" : "FINANCE / EXPLAINER SHORT", 54, 88, { size: 20, color: headingLabelColor, weight: 700, anchor: "start", letterSpacing: 3 })}
      ${premiumCreator ? "" : `<g opacity="${titleEntry.toFixed(3)}" transform="translate(54 ${145 + (1 - titleEntry) * 16}) scale(${0.97 + titleEntry * 0.03}) translate(-54 -145)">
        ${text(fitHeaderTitle(mainTitle), 54, 145, { size: 38, color: headingColor, weight: 800, anchor: "start", letterSpacing: 1 })}
      </g>`}
      <g filter="url(#scene-hue)" opacity="${sceneIntro}" transform="translate(${(1 - sceneIntro) * 46} ${premiumCreator ? 0 : Math.sin(timeMs / 420) * 3})">
        ${sceneContent}
      </g>
      ${premiumCreator
        ? ""
        : `<rect x="${-80 + sceneIntro * 1240}" y="210" width="12" height="940" rx="6" fill="${GREEN}" opacity="${(1 - sceneIntro) * 0.32}"/>`}
      ${captionPanel}
      ${premiumCreator ? "" : text(`${String(beatIndex + 1).padStart(2, "0")} / ${String(beats.length).padStart(2, "0")}`, 1024, 145, { size: 20, color: mutedColor, weight: 700, anchor: "end", letterSpacing: 2 })}
      ${!premiumCreator
        ? text("Образовательный ролик • не инвестиционная рекомендация", 540, 1_810, { size: 19, color: mutedColor, weight: 500 })
        : ""}
    </g>
    ${premiumCreator && presenterDataUri ? renderPresenterImage(presenterDataUri, timeMs, presenterLayout) : ""}
    ${premiumCreator && inlinePresenter ? renderSpeechSubtitle(beat, progress, presenterLayout) : ""}
  </svg>`;
}

function renderSubtitleFrame(
  timeMs: number,
  durationMs: number,
  beats: FinancialShortBeat[],
  visualTheme: "classic_dark" | "premium_creator" | "crypto_f2" | "coin_overview" | "market_focus_24h" = "premium_creator",
): string {
  const normalized = clamp(timeMs / Math.max(1, durationMs));
  const beat = beats.find((candidate) => normalized >= candidate.from && normalized < candidate.to)
    ?? beats.at(-1)!;
  const progress = localProgress(normalized, beat.from, beat.to);
  if (visualTheme === "coin_overview" || visualTheme === "market_focus_24h") {
    const opacity = ease(clamp(progress / 0.18));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
      <g opacity="${opacity.toFixed(3)}" transform="translate(0 ${(1 - opacity) * 18})">
        <rect x="74" y="1480" width="932" height="218" rx="26" fill="#0A0E0C" fill-opacity=".96" stroke="#D8BB75" stroke-opacity=".5" stroke-width="2"/>
        <rect x="110" y="1515" width="120" height="4" rx="2" fill="#88E2B4" opacity=".8"/>
        ${textLines(beat.subtitle, 540, 1578, 34, 42, { size: 27, color: "#F4EEDC", weight: 600 })}
      </g>
    </svg>`;
  }
  const layout = presenterLayoutForBeat(beat);
  const verticalOffset = visualTheme === "crypto_f2" && layout === "center"
    ? CRYPTO_F2_SUBTITLE_Y_OFFSET
    : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${renderSpeechSubtitle(beat, progress, layout, verticalOffset)}
  </svg>`;
}

function alignBeatsToSceneStarts(
  plan: FinancialShortRenderPlan,
  durationMs: number,
  sceneStartTimesMs: number[],
): FinancialShortBeat[] {
  if (!plan.beats.length) throw new Error("Финансовый animation plan не содержит сцен.");
  if (sceneStartTimesMs.length !== plan.beats.length - 1) {
    throw new Error("Количество отметок сцен не совпадает с количеством сцен в плане.");
  }
  const boundaries = [0, ...sceneStartTimesMs, durationMs];
  for (let index = 1; index < boundaries.length; index += 1) {
    const current = boundaries[index]!;
    const previous = boundaries[index - 1]!;
    if (!Number.isFinite(current) || current <= previous || current >= durationMs && index < boundaries.length - 1) {
      throw new Error("Отметки сцен должны строго возрастать и находиться внутри длительности ролика.");
    }
  }
  return plan.beats.map((beat, index) => ({
    ...beat,
    from: boundaries[index]! / durationMs,
    to: boundaries[index + 1]! / durationMs,
  }));
}

function presenterLayoutForBeat(beat: FinancialShortBeat): PresenterLayout {
  if (beat.presenterLayout) return beat.presenterLayout;
  if (beat.composition === "presenter_left") return "left";
  if (beat.composition === "presenter_right") return "right";
  if (beat.composition === "feature_card") return "large";
  return "center";
}

function momentForComposition(
  moment: FinancialVisualMoment,
  composition: FinancialComposition | undefined,
): FinancialVisualMoment {
  if (composition === "feature_card") {
    return {
      ...moment,
      position: moment.position === "center" ? "hero" : moment.position,
      exitAnimation: "shrink",
    };
  }
  if (composition === "presenter_left") {
    const rightPositions: Partial<Record<FinancialVisualPosition, FinancialVisualPosition>> = {
      center: "center_right",
      hero: "center_right",
    };
    return { ...moment, position: rightPositions[moment.position] ?? moment.position };
  }
  if (composition === "presenter_right") {
    const leftPositions: Partial<Record<FinancialVisualPosition, FinancialVisualPosition>> = {
      center: "center_left",
      hero: "center_left",
    };
    return { ...moment, position: leftPositions[moment.position] ?? moment.position };
  }
  return moment;
}

export function renderFinancialTopicPreviewFrame(
  plan: FinancialShortRenderPlan,
  durationMs: number,
  timeMs: number,
  sceneStartTimesMs: number[],
): string {
  const beats = alignBeatsToSceneStarts(plan, durationMs, sceneStartTimesMs);
  const visualTheme = plan.visualTheme ?? "premium_creator";
  return renderFrame(
    timeMs,
    durationMs,
    beats,
    plan.mainTitle,
    plan.background,
    visualTheme,
    visualTheme === "premium_creator",
    plan.visualAssets,
    plan.coinOverviewData,
    plan.marketFocusData,
  );
}

export function renderFinancialTopicSubtitlePreviewFrame(
  plan: FinancialShortRenderPlan,
  durationMs: number,
  timeMs: number,
  sceneStartTimesMs: number[],
): string {
  const beats = alignBeatsToSceneStarts(plan, durationMs, sceneStartTimesMs);
  return renderSubtitleFrame(timeMs, durationMs, beats, plan.visualTheme);
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

async function writePresenterPoseSequence(
  dir: string,
  frameCount: number,
  durationMs: number,
  beats: FinancialShortBeat[],
): Promise<string> {
  const sequenceDir = join(dir, "presenter-frames");
  await mkdir(sequenceDir, { recursive: true });
  let activePose: PresenterAnimationState["pose"] | undefined;
  let activeMouthOpen: boolean | undefined;
  let lastPoseChangeMs = Number.NEGATIVE_INFINITY;
  let lastMouthChangeMs = Number.NEGATIVE_INFINITY;
  let previousBeatIndex = -1;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const timeMs = Math.min(durationMs - 1, Math.round(frame * 1_000 / FPS));
    const normalized = clamp(timeMs / Math.max(1, durationMs));
    const beat = beats.find((candidate) => normalized >= candidate.from && normalized < candidate.to)
      ?? beats.at(-1)!;
    const progress = localProgress(normalized, beat.from, beat.to);
    const beatLocalTimeMs = Math.max(0, timeMs - beat.from * durationMs);
    const desiredState = getPresenterAnimationState(beat, progress, beatLocalTimeMs);
    const beatIndex = beats.indexOf(beat);

    if (beatIndex !== previousBeatIndex) {
      if (!activePose || timeMs - lastPoseChangeMs >= 5_000) {
        activePose = desiredState.pose;
        lastPoseChangeMs = timeMs;
      }
      activeMouthOpen = desiredState.mouthOpen;
      lastMouthChangeMs = timeMs;
      previousBeatIndex = beatIndex;
    } else {
      // The generated pose pairs vary slightly outside the mouth; avoid one-frame sprite flicker.
      if (desiredState.pose !== activePose && timeMs - lastPoseChangeMs >= 5_000) {
        activePose = desiredState.pose;
        lastPoseChangeMs = timeMs;
      }
      if (desiredState.mouthOpen !== activeMouthOpen && timeMs - lastMouthChangeMs >= 150) {
        activeMouthOpen = desiredState.mouthOpen;
        lastMouthChangeMs = timeMs;
      }
    }

    const state: PresenterAnimationState = {
      pose: activePose ?? desiredState.pose,
      mouthOpen: activeMouthOpen ?? desiredState.mouthOpen,
    };
    const framePath = join(sequenceDir, `pose-${String(frame).padStart(5, "0")}.png`);
    await symlink(getFinancialPresenterAssetPath(state), framePath);
  }

  return sequenceDir;
}

function presenterLayoutExpressions(
  beats: FinancialShortBeat[],
  durationMs: number,
): { scale: string; x: string; y: string } {
  let scale = "900";
  let x = "90";
  let y = "950";

  for (const beat of [...beats].reverse()) {
    const layout = presenterLayoutForBeat(beat);
    if (layout === "center") continue;
    const start = (beat.from * durationMs / 1_000).toFixed(3);
    const end = (beat.to * durationMs / 1_000).toFixed(3);
    const values = layout === "left"
      ? { scale: "760", x: "10", y: "1050" }
      : layout === "right"
        ? { scale: "760", x: "310", y: "1050" }
        : { scale: "1080", x: "0", y: "790" };
    const inScene = `between(t,${start},${end})`;
    scale = `if(${inScene},${values.scale},${scale})`;
    x = `if(${inScene},${values.x},${x})`;
    y = `if(${inScene},${values.y},${y})`;
  }

  return { scale, x, y };
}

export function buildMarketDataAudioFilterGraph(options: {
  audioInputIndex: number;
  musicInputIndex: number;
  durationMs: number;
  theme: "coin_overview" | "market_focus_24h";
}): { filterChains: string[]; outputLabel: string } {
  const prefix = options.theme === "market_focus_24h" ? "market-focus" : "coin-overview";
  const durationSeconds = options.durationMs / 1_000;
  const fadeDuration = Math.min(0.7, durationSeconds);
  const fadeStart = Math.max(0, durationSeconds - fadeDuration);
  const musicVolume = options.theme === "market_focus_24h" ? "0.10" : "0.36";
  const outputLabel = `${prefix}-base`;
  return {
    filterChains: [
      `[${options.audioInputIndex}:a]asplit=2[${prefix}-voice-sidechain][${prefix}-voice-main]`,
      `[${options.musicInputIndex}:a]asetpts=PTS-STARTPTS,volume=${musicVolume},atrim=duration=${durationSeconds.toFixed(3)},afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeDuration.toFixed(3)}[${prefix}-bed]`,
      `[${prefix}-bed][${prefix}-voice-sidechain]sidechaincompress=threshold=0.05:ratio=6:attack=12:release=480[${prefix}-ducked]`,
      `[${prefix}-voice-main][${prefix}-ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.97:level=0[${outputLabel}]`,
    ],
    outputLabel,
  };
}

async function encodeShort(
  dir: string,
  durationMs: number,
  audioPath: string,
  beats: FinancialShortBeat[],
  mainTitle: string,
  background: FinanceBackgroundId = "grid",
  visualTheme: "classic_dark" | "premium_creator" | "crypto_f2" | "coin_overview" | "market_focus_24h" = "premium_creator",
  copyAudioTrack = false,
  visualAssets: Record<string, FinancialRasterAsset> = {},
  coinOverviewData?: CoinOverviewMarketData,
  marketFocusData?: MarketFocusMarketData,
): Promise<Buffer> {
  const frameCount = Math.ceil(durationMs / 1_000 * FPS);
  const hasPresenter = visualTheme === "premium_creator";
  const hasCryptoF2MusicBed = visualTheme === "crypto_f2";
  const hasMarketFocusMusicBed = visualTheme === "market_focus_24h";
  const hasMarketDataMusicBed = visualTheme === "coin_overview" || hasMarketFocusMusicBed;
  if (hasCryptoF2MusicBed && !existsSync(CRYPTO_F2_MUSIC_BED_PATH)) {
    throw new Error("Не найден музыкальный фон для формата «Крипто Ф2».");
  }
  if (hasMarketFocusMusicBed && !existsSync(CRYPTO_F2_MUSIC_BED_PATH)) {
    throw new Error("Не найден лёгкий музыкальный фон для формата «Монета в фокусе — 24 часа».");
  }
  if (visualTheme === "coin_overview" && !existsSync(COIN_OVERVIEW_MUSIC_BED_PATH)) {
    throw new Error("Не найден музыкальный фон для рыночного криптоформата.");
  }
  const presenterSequenceDir = hasPresenter
    ? await writePresenterPoseSequence(dir, frameCount, durationMs, beats)
    : undefined;
  const presenterPositions = presenterLayoutExpressions(beats, durationMs);

  for (let frame = 0; frame < frameCount; frame += 1) {
    const timeMs = Math.min(durationMs - 1, Math.round(frame * 1_000 / FPS));
    await writeFile(
      join(dir, `frame-${String(frame).padStart(5, "0")}.svg`),
      renderFrame(timeMs, durationMs, beats, mainTitle, background, visualTheme, false, visualAssets, coinOverviewData, marketFocusData),
      "utf8",
    );
    await writeFile(
      join(dir, `subtitle-frame-${String(frame).padStart(5, "0")}.svg`),
      renderSubtitleFrame(timeMs, durationMs, beats, visualTheme),
      "utf8",
    );
  }

  const output = join(dir, "financial-explainer-short.mp4");
  const subtitleInputIndex = hasPresenter ? 2 : 1;
  const audioInputIndex = subtitleInputIndex + 1;
  const soundCues: ScheduledFinancialSoundCue[] = hasCryptoF2MusicBed
    ? cryptoF2MotionSoundCues(beats, durationMs)
    : hasMarketFocusMusicBed
      ? []
    : hasMarketDataMusicBed
      ? []
    : beats.flatMap((beat, index) => {
        const kind = soundCueKindForBeat(beat, index);
        const delayMs = Math.max(0, Math.round(beat.from * durationMs + (index === 0 ? 90 : 45)));
        return kind && delayMs < durationMs - 260 ? [{ kind, delayMs }] : [];
      });
  const args = [
    "-y",
    "-framerate", String(FPS),
    "-start_number", "0",
    "-i", join(dir, "frame-%05d.svg"),
    ...(presenterSequenceDir
      ? ["-framerate", String(FPS), "-start_number", "0", "-i", join(presenterSequenceDir, "pose-%05d.png")]
      : []),
    "-framerate", String(FPS),
    "-start_number", "0",
    "-i", join(dir, "subtitle-frame-%05d.svg"),
    "-i", audioPath,
    ...(hasCryptoF2MusicBed
      ? ["-stream_loop", "-1", "-i", CRYPTO_F2_MUSIC_BED_PATH]
      : hasMarketDataMusicBed
        ? ["-stream_loop", "-1", "-i", hasMarketFocusMusicBed ? CRYPTO_F2_MUSIC_BED_PATH : COIN_OVERVIEW_MUSIC_BED_PATH]
        : []),
  ];
  const soundCueInputStartIndex = audioInputIndex + (hasCryptoF2MusicBed || hasMarketDataMusicBed ? 2 : 1);
  soundCues.forEach((cue) => {
    args.push("-f", "lavfi", "-i", soundCueSource(cue.kind));
  });

  const filterChains: string[] = [];
  const preSubtitleVideoLabel = hasPresenter ? "host-video" : "0:v";
  let baseAudioLabel = `${audioInputIndex}:a:0`;
  let mappedAudioLabel: string | undefined;
  if (hasCryptoF2MusicBed) {
    const musicInputIndex = audioInputIndex + 1;
    const durationSeconds = durationMs / 1_000;
    const fadeDuration = Math.min(0.7, durationSeconds);
    const fadeStart = Math.max(0, durationSeconds - fadeDuration);
    filterChains.push(
      `[${audioInputIndex}:a]asplit=2[crypto-f2-voice-sidechain][crypto-f2-voice-main]`,
    );
    filterChains.push(
      `[${musicInputIndex}:a]asetpts=PTS-STARTPTS,volume=0.36,atrim=duration=${durationSeconds.toFixed(3)},afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeDuration.toFixed(3)}[crypto-f2-bed]`,
    );
    filterChains.push(
      `[crypto-f2-bed][crypto-f2-voice-sidechain]sidechaincompress=threshold=0.05:ratio=6:attack=12:release=480[crypto-f2-ducked]`,
    );
    filterChains.push(
      `[crypto-f2-voice-main][crypto-f2-ducked]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.97:level=0[crypto-f2-base]`,
    );
    baseAudioLabel = "crypto-f2-base";
    mappedAudioLabel = baseAudioLabel;
  } else if (hasMarketDataMusicBed) {
    const marketDataAudio = buildMarketDataAudioFilterGraph({
      audioInputIndex,
      musicInputIndex: audioInputIndex + 1,
      durationMs,
      theme: hasMarketFocusMusicBed ? "market_focus_24h" : "coin_overview",
    });
    filterChains.push(...marketDataAudio.filterChains);
    baseAudioLabel = marketDataAudio.outputLabel;
    mappedAudioLabel = marketDataAudio.outputLabel;
  }
  if (hasPresenter) {
    const scale = `(${presenterPositions.scale})+12*sin(t*0.926)`;
    filterChains.push(`[1:v]scale=w='${scale}':h='${scale}':eval=frame:flags=lanczos,format=rgba[host]`);
    filterChains.push(`[0:v][host]overlay=x='(${presenterPositions.x})+7*sin(t*1.724)+4*sin(t*0.704)':y='(${presenterPositions.y})+8*sin(t*2.083)+4*sin(t*0.568)':eval=frame:shortest=1:format=auto[host-video]`);
  }
  filterChains.push(
    `[${preSubtitleVideoLabel}][${subtitleInputIndex}:v]overlay=0:0:eval=frame:shortest=1:format=auto[composited]`,
  );
  filterChains.push(
    `[composited]scale=${WIDTH}:${HEIGHT}:flags=lanczos,setsar=1/1[video]`,
  );
  if (soundCues.length) {
    soundCues.forEach((cue, index) => {
      const inputIndex = soundCueInputStartIndex + index;
      filterChains.push(
        `[${inputIndex}:a]${soundCueFilter(cue.kind)}${cue.volumeScale ? `,volume=${cue.volumeScale}` : ""},pan=stereo|c0=c0|c1=c0,adelay=${cue.delayMs}|${cue.delayMs}[sfx${index}]`,
      );
    });
    const cueLabels = soundCues.map((_, index) => `[sfx${index}]`).join("");
    filterChains.push(
      `[${baseAudioLabel}]${cueLabels}amix=inputs=${soundCues.length + 1}:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.97:level=0[audio]`,
    );
  }

  if (filterChains.length) args.push("-filter_complex", filterChains.join(";"));
  args.push(
    "-t", String(durationMs / 1_000),
    "-map", "[video]",
    "-map", soundCues.length
      ? "[audio]"
      : mappedAudioLabel ? `[${mappedAudioLabel}]` : `${audioInputIndex}:a:0`,
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "17",
    "-pix_fmt", "yuv420p",
    ...(copyAudioTrack && !soundCues.length && !hasCryptoF2MusicBed && !hasMarketDataMusicBed
      ? ["-c:a", "copy"]
      : ["-c:a", "aac", "-b:a", "192k"]),
    "-shortest",
    "-movflags", "+faststart",
    output,
  );
  await execFileAsync("ffmpeg", args, { timeout: 30 * 60 * 1_000, maxBuffer: 20 * 1024 * 1024 });
  const probe = await execFileAsync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height,sample_aspect_ratio",
    "-of", "json",
    output,
  ], { timeout: 30_000, maxBuffer: 1 * 1024 * 1024 });
  const videoStream = (JSON.parse(probe.stdout) as {
    streams?: Array<{ width?: number; height?: number; sample_aspect_ratio?: string }>;
  }).streams?.[0];
  if (
    videoStream?.width !== WIDTH
    || videoStream.height !== HEIGHT
    || videoStream.sample_aspect_ratio !== "1:1"
  ) {
    throw new Error(
      `Неверная геометрия финансового Shorts: ожидалось ${WIDTH}x${HEIGHT} SAR 1:1, получено ${videoStream?.width ?? "?"}x${videoStream?.height ?? "?"} SAR ${videoStream?.sample_aspect_ratio ?? "?"}.`,
    );
  }
  return readFile(output);
}

async function generateFinancialSpeech(text: string): Promise<Buffer> {
  const preparedText = prepareSpeechText(text);
  const voiceId = getConfiguredVoiceId();
  const settings = {
    speed: 0.98,
    stability: 0.52,
    similarity: 0.78,
    style: 0.2,
    speakerBoost: true,
  };
  if (getSpeechProvider() === "voice_api") {
    return generateLumeanSpeech(preparedText, voiceId, getVoiceApiModelId(), settings);
  }
  return generateSpeech(preparedText, voiceId, getElevenLabsModel(), settings);
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

type FinancialSoundCueKind = "whoosh" | "tick" | "impact";

function soundCueKindForBeat(beat: FinancialShortBeat, index: number): FinancialSoundCueKind | undefined {
  const requested = (beat.soundEffect ?? "").toLocaleLowerCase("ru-RU");
  if (requested === "none") return undefined;
  if (/impact|hit|thump|удар|акцент|импакт/iu.test(requested)) return "impact";
  if (/tick|click|coin|bell|ping|монет|щелч|звон/iu.test(requested)) return "tick";
  if (/whoosh|sweep|swish|переход|свип|взмах/iu.test(requested)) return "whoosh";
  if (index === 0 || beat.visual === "hook" || beat.visual === "risk" || beat.visual === "leverage" || beat.visual === "summary") {
    return "impact";
  }
  if (beat.visual === "coupon" || beat.visual === "calendar" || beat.visual === "maturity") return "tick";
  return "whoosh";
}

function soundCueSource(kind: FinancialSoundCueKind): string {
  if (kind === "whoosh") return "anoisesrc=color=pink:duration=0.34:sample_rate=48000";
  if (kind === "tick") return "sine=frequency=1000:duration=0.12:sample_rate=48000";
  return "sine=frequency=82:duration=0.24:sample_rate=48000";
}

function soundCueFilter(kind: FinancialSoundCueKind): string {
  if (kind === "whoosh") {
    return "highpass=f=180,lowpass=f=3800,afade=t=in:st=0:d=0.035,afade=t=out:st=0.12:d=0.22,volume=0.035";
  }
  if (kind === "tick") {
    return "highpass=f=650,lowpass=f=7500,afade=t=in:st=0:d=0.003,afade=t=out:st=0.015:d=0.095,volume=0.045";
  }
  return "lowpass=f=190,afade=t=in:st=0:d=0.005,afade=t=out:st=0.04:d=0.19,volume=0.11";
}

type ScheduledFinancialSoundCue = {
  kind: FinancialSoundCueKind;
  delayMs: number;
  volumeScale?: number;
};

function cryptoF2MotionSoundCues(
  beats: FinancialShortBeat[],
  durationMs: number,
): ScheduledFinancialSoundCue[] {
  const scheduled: ScheduledFinancialSoundCue[] = [];
  let lastCueMs = -1_000;
  for (const beat of beats) {
    const beatDurationMs = Math.max(0, (beat.to - beat.from) * durationMs);
    for (const moment of beat.visualMoments ?? []) {
      const cueBeat = (moment.microBeats ?? []).find((item) => item.kind !== "keyword")
        ?? moment.microBeats?.[0];
      if (!cueBeat) continue;
      const momentDurationMs = (moment.to - moment.from) * beatDurationMs;
      const delayMs = Math.round(
        beat.from * durationMs
        + moment.from * beatDurationMs
        + cueBeat.from * momentDurationMs,
      );
      if (delayMs < 0 || delayMs >= durationMs - 180 || delayMs - lastCueMs < 360) continue;

      const action = moment.motionAction ?? "pulse";
      const kind: FinancialSoundCueKind = ["flow", "transfer", "orbit", "unfold"].includes(action)
        ? "whoosh"
        : ["assemble", "build", "morph", "split_merge", "reveal"].includes(action)
          ? "impact"
          : "tick";
      scheduled.push({ kind, delayMs, volumeScale: 0.42 });
      lastCueMs = delayMs;
      if (scheduled.length >= 24) return scheduled;
    }
  }
  return scheduled;
}

export type FinancialShortRenderCheckpoint = {
  voiceSegments?: FinancialTopicVoiceSegment[];
  onVoiceSegmentSaved?: (
    index: number,
    segment: FinancialTopicVoiceSegment,
  ) => Promise<void>;
};

async function renderPlan(
  plan: FinancialShortRenderPlan,
  checkpoint?: FinancialShortRenderCheckpoint,
): Promise<{ buffer: Buffer; durationMs: number }> {
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
        const savedSegment = checkpoint?.voiceSegments?.[index];
        let voice: Buffer | undefined;
        let reusedSavedSegment = false;
        if (savedSegment?.storagePath) {
          try {
            voice = await readAudioAsset(savedSegment.storagePath);
            reusedSavedSegment = true;
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            console.warn(
              `[financial-short] Saved voice segment ${index + 1} was unavailable; regenerating it: ${reason}`,
            );
          }
        }
        if (!voice) voice = await generateFinancialSpeech(beat.voiceText!);
        const segmentPath = join(dir, `voice-${String(index).padStart(2, "0")}.mp3`);
        await writeFile(segmentPath, voice);
        segmentPaths.push(segmentPath);
        const segmentDurationMs = await probeDurationMs(segmentPath);
        segmentDurations.push(segmentDurationMs);
        if (!reusedSavedSegment && checkpoint?.onVoiceSegmentSaved) {
          const storagePath = await storeAudioAsset(
            voice,
            "financial-short",
            "audio/mpeg",
            "mp3",
          );
          await checkpoint.onVoiceSegmentSaved(index, {
            storagePath,
            durationMs: segmentDurationMs,
          });
        }
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
      false,
      plan.visualAssets,
      plan.coinOverviewData,
      plan.marketFocusData,
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

export async function renderFinancialTopicShort(
  plan: FinancialShortRenderPlan,
  checkpoint?: FinancialShortRenderCheckpoint,
): Promise<{
  buffer: Buffer;
  durationMs: number;
  sceneCount: number;
  script: string;
}> {
  if (!plan.beats.length) throw new Error("Финансовый animation plan не содержит сцен.");
  const rendered = await renderPlan(plan, checkpoint);
  return {
    ...rendered,
    sceneCount: plan.beats.length,
    script: plan.script,
  };
}

export async function renderFinancialTopicShortWithAudioTrack(
  plan: FinancialShortRenderPlan,
  audioPath: string,
  sceneStartTimesMs: number[],
): Promise<{
  buffer: Buffer;
  durationMs: number;
  sceneCount: number;
  script: string;
}> {
  const durationMs = await probeDurationMs(audioPath);
  const beats = alignBeatsToSceneStarts(plan, durationMs, sceneStartTimesMs);
  const dir = await mkdtemp(join(tmpdir(), "financial-short-restyle-"));
  try {
    const buffer = await encodeShort(
      dir,
      durationMs,
      audioPath,
      beats,
      plan.mainTitle,
      plan.background,
      plan.visualTheme,
      true,
      plan.visualAssets,
      plan.coinOverviewData,
    );
    return {
      buffer,
      durationMs,
      sceneCount: beats.length,
      script: plan.script,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}