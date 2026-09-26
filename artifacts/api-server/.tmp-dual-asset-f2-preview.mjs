// .tmp-dual-asset-f2-preview.ts
import { mkdir, writeFile as writeFile3 } from "node:fs/promises";
import { resolve } from "node:path";

// src/lib/openrouter-config.ts
var DEFAULT_MODEL = "openai/gpt-5-nano";
var FALLBACK_MODEL = "openai/gpt-4o-mini";
var openRouterConfig = {
  url: "https://openrouter.ai/api/v1/chat/completions",
  get apiKey() {
    return process.env["OPENROUTER_API_KEY"] ?? "";
  },
  get model() {
    return process.env["OPENROUTER_MODEL"] || DEFAULT_MODEL;
  },
  fallbackModel: FALLBACK_MODEL
};

// src/lib/finance-style-dna.ts
var FINANCE_STYLE_DNA = {
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
    red: "#FF8D8D"
  },
  typography: {
    family: "DejaVu Sans",
    titleSize: 38,
    sceneTitleSize: 25,
    subtitleSize: 26
  },
  geometry: {
    safeTop: 150,
    safeBottom: 240
  }
};
var FINANCE_BRAND_PROFILE = {
  label: "Finance DNA \xB7 Premium Creator",
  presenter: "Existing approved financial presenter; preserve the same identity and appearance.",
  quality: {
    width: FINANCE_STYLE_DNA.width,
    height: FINANCE_STYLE_DNA.height,
    fps: FINANCE_STYLE_DNA.fps
  },
  colors: FINANCE_STYLE_DNA.colors,
  typography: FINANCE_STYLE_DNA.typography,
  safeZones: {
    topPx: FINANCE_STYLE_DNA.geometry.safeTop,
    bottomPx: FINANCE_STYLE_DNA.geometry.safeBottom
  }
};
var FINANCE_BACKGROUND_LIBRARY = [
  { id: "grid", label: "Dark fintech grid", description: "\u0422\u043E\u043D\u043A\u0430\u044F \u0441\u0435\u0442\u043A\u0430 \u0438 \u0437\u0435\u043B\u0451\u043D\u043E\u0435 \u0441\u0432\u0435\u0447\u0435\u043D\u0438\u0435." },
  { id: "particles", label: "Financial particles", description: "\u0421\u0435\u0442\u043A\u0430, \u0447\u0430\u0441\u0442\u0438\u0446\u044B \u0438 \u043C\u044F\u0433\u043A\u0438\u0435 \u0443\u0437\u043B\u044B \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u043F\u043E\u0442\u043E\u043A\u0430." },
  { id: "terminal", label: "Trading terminal", description: "\u0413\u043E\u0440\u0438\u0437\u043E\u043D\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043B\u0430 \u0438 \u0441\u043F\u043E\u043A\u043E\u0439\u043D\u044B\u0439 navy-gradient." },
  { id: "aurora", label: "Aurora liquidity", description: "\u041F\u043B\u0430\u0432\u043D\u044B\u0435 \u0441\u0432\u0435\u0442\u043E\u0432\u044B\u0435 \u0432\u043E\u043B\u043D\u044B \u0434\u043B\u044F \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F \u043A\u0430\u043F\u0438\u0442\u0430\u043B\u0430." },
  { id: "mesh", label: "Market mesh", description: "\u041C\u043D\u043E\u0433\u043E\u0441\u043B\u043E\u0439\u043D\u0430\u044F \u0441\u0435\u0442\u044C \u0441 \u0436\u0438\u0432\u044B\u043C\u0438 \u0443\u0437\u043B\u0430\u043C\u0438." },
  { id: "circuit", label: "Capital circuit", description: "\u041C\u0438\u043A\u0440\u043E\u0441\u0445\u0435\u043C\u0430 \u0438\u0437 \u043C\u0430\u0440\u0448\u0440\u0443\u0442\u043E\u0432, \u0443\u0437\u043B\u043E\u0432 \u0438 \u0438\u043C\u043F\u0443\u043B\u044C\u0441\u043E\u0432." },
  { id: "ledger", label: "Ledger sheets", description: "\u0421\u0442\u0440\u043E\u0433\u0430\u044F \u0431\u0443\u0445\u0433\u0430\u043B\u0442\u0435\u0440\u0441\u043A\u0430\u044F \u0441\u0435\u0442\u043A\u0430 \u0441 \u0431\u0435\u0433\u0443\u0449\u0438\u043C\u0438 \u0441\u0442\u0440\u043E\u043A\u0430\u043C\u0438." },
  { id: "stars", label: "Data constellation", description: "\u0421\u043E\u0437\u0432\u0435\u0437\u0434\u0438\u0435 \u0442\u043E\u0447\u0435\u043A \u0434\u0430\u043D\u043D\u044B\u0445 \u0438 \u0442\u043E\u043D\u043A\u0438\u0445 \u0441\u0432\u044F\u0437\u0435\u0439." },
  { id: "waves", label: "Yield waves", description: "\u041A\u0440\u0438\u0432\u044B\u0435 \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u0438 \u0438 \u0441\u043F\u043E\u043A\u043E\u0439\u043D\u044B\u0435 \u0441\u0438\u043D\u0443\u0441\u043E\u0438\u0434\u0430\u043B\u044C\u043D\u044B\u0435 \u043B\u0438\u043D\u0438\u0438." },
  { id: "blueprint", label: "Blueprint finance", description: "\u0427\u0435\u0440\u0442\u0451\u0436\u043D\u0430\u044F \u0440\u0430\u0437\u043C\u0435\u0442\u043A\u0430 \u0434\u043B\u044F \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0438 \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u0430." },
  { id: "radar", label: "Risk radar", description: "\u0420\u0430\u0434\u0430\u0440\u043D\u044B\u0435 \u043A\u043E\u043B\u044C\u0446\u0430 \u0434\u043B\u044F \u0440\u0438\u0441\u043A\u0430, \u0446\u0435\u043D\u044B \u0438 \u0441\u0438\u0433\u043D\u0430\u043B\u043E\u0432." },
  { id: "pulse", label: "Market pulse", description: "\u0412\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0435 \u0438\u043C\u043F\u0443\u043B\u044C\u0441\u044B \u0438 \u043F\u0443\u043B\u044C\u0441\u0438\u0440\u0443\u044E\u0449\u0438\u0435 \u0431\u0430\u0440\u044B." }
];
var animationProperties = [
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
  "easing"
];
var objectKinds = [
  ["investor", "actor"],
  ["company", "actor"],
  ["bank", "actor"],
  ["government", "actor"],
  ["broker", "actor"],
  ["wallet", "utility"],
  ["money", "instrument"],
  ["gold", "instrument"],
  ["coin", "instrument"],
  ["ruble", "instrument"],
  ["bond", "instrument"],
  ["stock", "instrument"],
  ["dividend", "metric"],
  ["percentage", "metric"],
  ["chart_up", "chart"],
  ["chart_down", "chart"],
  ["candlestick_chart", "chart"],
  ["portfolio", "utility"],
  ["brokerage_account", "utility"],
  ["document", "utility"],
  ["calendar", "utility"],
  ["clock", "utility"],
  ["shield", "risk"],
  ["warning", "risk"],
  ["arrow", "utility"],
  ["money_flow", "utility"],
  ["payment", "metric"],
  ["coupon", "metric"],
  ["interest", "metric"],
  ["balance", "metric"],
  ["calculator", "utility"],
  ["phone", "utility"],
  ["laptop", "utility"]
];
var FINANCE_OBJECT_LIBRARY = objectKinds.map(([kind, role]) => ({
  kind,
  role,
  supports: animationProperties
}));

// src/lib/financial-short-renderer.ts
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

// src/lib/audio-generation/elevenlabs-client.ts
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// src/lib/objectStorage.ts
import { Storage } from "@google-cloud/storage";
var REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
var objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token"
      }
    },
    universe_domain: "googleapis.com"
  },
  projectId: ""
});

// src/lib/financial-presenter.ts
var FINANCIAL_PRESENTER_POSES = [
  "speaking",
  "caution",
  "confident",
  "thinking-chin",
  "thinking-temple",
  "thinking-arms",
  "pointing-up",
  "shrug-surprised",
  "aha",
  "reassuring"
];
function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
function ease(value) {
  const progress = clamp(value);
  return 1 - (1 - progress) ** 3;
}
function speechUnits(text2) {
  const tokens = text2.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*[,.!?;:…]?/gu) ?? [];
  const units = [];
  for (const token of tokens) {
    const punctuation = token.match(/[,.!?;:…]+$/u)?.[0] ?? "";
    const word = punctuation ? token.slice(0, -punctuation.length) : token;
    const vowelGroups = word.toLocaleLowerCase("ru-RU").match(/[аеёиоуыэюяaeiouy]+/gu)?.length ?? 0;
    const syllables = Math.max(1, vowelGroups);
    for (let index = 0; index < syllables; index += 1) {
      units.push({ kind: "syllable", weight: 1 });
    }
    const pauseWeight = /[.!?…]/u.test(punctuation) ? 0.9 : /[,;:]/u.test(punctuation) ? 0.55 : 0.22;
    units.push({ kind: "pause", weight: pauseWeight });
  }
  return units;
}
function normalizeKeyword(value) {
  return value.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
}
function getSpeechWordTimings(value) {
  const words = [];
  let totalWeight = 0;
  const tokens = value.matchAll(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*%?[,.!?;:…]?/gu);
  for (const match of tokens) {
    const token = match[0];
    const punctuation = token.match(/[,.!?;:…]+$/u)?.[0] ?? "";
    const word = punctuation ? token.slice(0, -punctuation.length) : token;
    const normalized = normalizeKeyword(word);
    if (!normalized) continue;
    const vowelGroups = word.toLocaleLowerCase("ru-RU").match(/[аеёиоуыэюяaeiouy]+/gu)?.length ?? 0;
    const syllables = Math.max(1, vowelGroups);
    const start = totalWeight;
    totalWeight += syllables;
    words.push({ word, normalized, punctuation, start, end: totalWeight });
    totalWeight += /[.!?…]/u.test(punctuation) ? 0.9 : /[,;:]/u.test(punctuation) ? 0.55 : 0.22;
  }
  return { words, totalWeight };
}
function speechMouthIsOpen(beat, progress) {
  const units = speechUnits(beat.lipSyncText || beat.voiceText || beat.subtitle);
  const totalWeight = units.reduce((sum, unit) => sum + unit.weight, 0);
  if (!totalWeight) return false;
  let position = clamp(progress) * totalWeight;
  for (const unit of units) {
    if (position < unit.weight) {
      if (unit.kind === "pause") return false;
      return Math.sin(Math.PI * clamp(position / unit.weight)) > 0.24;
    }
    position -= unit.weight;
  }
  return false;
}
function stablePoseSeed(value, size) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) % size;
}
function getPresenterAnimationState(beat, progress, absoluteTimeMs) {
  const meaning = `${beat.visual} ${beat.visualAction || ""} ${beat.title} ${beat.subtitle}`.toLocaleLowerCase("ru-RU");
  const caution = /риск|осторож|марж|убыт|плеч|паден|сниж|опас|предупрежд/iu.test(meaning) || beat.visual === "leverage" || beat.visual === "risk";
  const confident = !caution && (/результат|вывод|итог|важн|ключев|прибыл|рост|решен/iu.test(meaning) || ["hook", "payoff", "comparison", "summary", "ownership"].includes(beat.visual));
  const analytical = /услов|контракт|сравн|расч[её]т|номинал|доходност|процент|ставк|позици|пример|стоимост|срок/iu.test(meaning);
  const semanticPoseOptions = caution ? ["caution", "thinking-temple", "shrug-surprised", "thinking-arms"] : confident ? ["confident", "pointing-up", "aha", "reassuring"] : analytical ? ["thinking-chin", "pointing-up", "thinking-temple", "thinking-arms", "speaking"] : ["speaking", "thinking-chin", "pointing-up", "shrug-surprised", "aha", "reassuring", "confident", "thinking-temple", "thinking-arms", "caution"];
  const fiveSecondCycle = Math.floor(Math.max(0, absoluteTimeMs) / 5e3);
  const continuationOptions = beat.presenterPose ? semanticPoseOptions.filter((pose2) => pose2 !== beat.presenterPose) : semanticPoseOptions;
  const seed = stablePoseSeed(`${beat.visual}:${beat.title}`, continuationOptions.length);
  const pose = beat.presenterPose && fiveSecondCycle === 0 ? beat.presenterPose : continuationOptions[(seed + (beat.presenterPose ? fiveSecondCycle - 1 : fiveSecondCycle)) % continuationOptions.length];
  return {
    pose,
    mouthOpen: speechMouthIsOpen(beat, progress)
  };
}
function renderPremiumCreatorBackground(timeMs) {
  const drift = Math.sin(timeMs / 4200) * 18;
  const dust = Array.from({ length: 5 }, (_, index) => {
    const x = 135 + index * 206 + Math.sin(timeMs / 1400 + index) * 12;
    const y = 355 + (index * 137 + Math.round(timeMs / 36)) % 780;
    const opacity = 0.12 + index % 3 * 0.045;
    return `<circle cx="${x.toFixed(1)}" cy="${y}" r="${index % 2 ? 2 : 3}" fill="#D7AF70" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");
  return `<defs>
    <linearGradient id="creator-studio-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#10171B"/>
      <stop offset=".56" stop-color="#11191A"/>
      <stop offset="1" stop-color="#090D0E"/>
    </linearGradient>
    <radialGradient id="creator-host-light" cx="50%" cy="48%" r="64%">
      <stop offset="0" stop-color="#D29851" stop-opacity=".24"/>
      <stop offset=".52" stop-color="#8E673B" stop-opacity=".09"/>
      <stop offset="1" stop-color="#090D0E" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="creator-visual-light" cx="82%" cy="35%" r="66%">
      <stop offset="0" stop-color="#397769" stop-opacity=".15"/>
      <stop offset=".52" stop-color="#233C3B" stop-opacity=".08"/>
      <stop offset="1" stop-color="#090D0E" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="creator-floor-fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#17211F" stop-opacity="0"/>
      <stop offset="1" stop-color="#080B0C" stop-opacity=".9"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1920" fill="url(#creator-studio-bg)"/>
  <rect width="1080" height="1920" fill="url(#creator-host-light)"/>
  <rect width="1080" height="1920" fill="url(#creator-visual-light)"/>
  <path d="M0 1390C210 1348 374 1418 540 1385S850 1355 1080 1408V1920H0Z" fill="#11191A" opacity=".62"/>
  <rect y="1370" width="1080" height="550" fill="url(#creator-floor-fade)"/>
  <ellipse cx="${540 + drift}" cy="1440" rx="390" ry="70" fill="#C28B43" opacity=".075"/>
  <g>${dust}</g>`;
}
function renderSpeechSubtitle(beat, progress, layout = "center") {
  const source = beat.lipSyncText || beat.voiceText || beat.subtitle;
  const { words, totalWeight } = getSpeechWordTimings(source);
  if (!words.length || !totalWeight) return "";
  const chunks = [];
  for (let index = 0; index < words.length; ) {
    const remaining = words.length - index;
    const count = remaining === 4 ? 2 : Math.min(3, remaining);
    const chunkWords = words.slice(index, index + count);
    chunks.push({
      words: chunkWords,
      start: chunkWords[0].start,
      end: chunkWords.at(-1).end
    });
    index += count;
  }
  const spokenWeight = clamp(progress) * totalWeight;
  const activeIndex = chunks.findIndex((chunk, index) => {
    const nextStart = chunks[index + 1]?.start ?? Number.POSITIVE_INFINITY;
    return spokenWeight >= chunk.start && spokenWeight < Math.min(chunk.end + 0.16, nextStart);
  });
  if (activeIndex < 0) return "";
  const active = chunks[activeIndex];
  const positions = {
    center: { x: 540, y: 900, maxWidth: 840 },
    left: { x: 390, y: 980, maxWidth: 700 },
    right: { x: 690, y: 980, maxWidth: 700 },
    large: { x: 540, y: 700, maxWidth: 840 }
  }[layout];
  const caption = active.words.map((word) => `${word.word}${word.punctuation}`).join(" ");
  const fontSize = Math.max(24, Math.min(58, positions.maxWidth / Math.max(12, caption.length * 0.66)));
  const chunkSpan = Math.max(0.35, active.end - active.start);
  const enter = ease(clamp((spokenWeight - active.start) / Math.min(0.22, chunkSpan * 0.22)));
  const exit = 1 - ease(clamp((spokenWeight - active.end) / 0.16));
  const opacity = enter * exit;
  const scale = 0.94 + enter * 0.06;
  const rise = (1 - enter) * 15 + (1 - exit) * 8;
  const wordMarkup = active.words.map((word, index) => {
    const current = spokenWeight >= word.start && spokenWeight <= word.end;
    const spoken = spokenWeight > word.end;
    const fill = current ? "#F1C36E" : spoken ? "#FFF9EE" : "#CFD4D0";
    const wordOpacity = spoken || current ? 1 : 0.54;
    const spacing = index ? ` dx="${fontSize * 0.25}"` : "";
    return `<tspan${spacing} fill="${fill}" opacity="${wordOpacity}">${escapeXml(`${word.word}${word.punctuation}`)}</tspan>`;
  }).join("");
  return `<g pointer-events="none" opacity="${opacity.toFixed(3)}" transform="translate(${positions.x} ${(positions.y + rise).toFixed(1)}) scale(${scale.toFixed(3)}) translate(${-positions.x} ${-positions.y})">
    <text x="${positions.x}" y="${positions.y}" text-anchor="middle" fill="#FFF9EE" stroke="#07100D" stroke-width="12" stroke-linejoin="round" paint-order="stroke fill" font-family="DejaVu Sans, sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="900" letter-spacing=".1">${wordMarkup}</text>
  </g>`;
}
function renderFullPresenter(beat, _progress, timeMs, layout = "center") {
  const visualAction = `${beat.visual} ${beat.visualAction || ""}`.toLocaleLowerCase("ru-RU");
  const caution = /риск|осторож|марж|вниман|убыт|плеч/iu.test(visualAction) || beat.visual === "leverage" || beat.visual === "risk" || beat.visual === "summary";
  const warmth = caution ? "#C36D57" : "#C28B43";
  const bob = Math.sin(timeMs / (caution ? 1520 : 1860)) * 3.2;
  const centerX = layout === "left" ? 390 : layout === "right" ? 690 : 540;
  const auraY = layout === "center" ? 1320 : layout === "large" ? 1270 : 1450;
  const auraRx = layout === "large" ? 500 : layout === "center" ? 440 : 360;
  const shadowY = layout === "center" ? 1824 : layout === "large" ? 1840 : 1796;
  return `<g pointer-events="none">
    <defs>
      <radialGradient id="presenter-aura" cx="46%" cy="42%" r="60%">
        <stop offset="0" stop-color="${warmth}" stop-opacity=".22"/>
        <stop offset=".58" stop-color="${warmth}" stop-opacity=".07"/>
        <stop offset="1" stop-color="${warmth}" stop-opacity="0"/>
      </radialGradient>
    </defs>
     <ellipse cx="${centerX}" cy="${(auraY + bob).toFixed(1)}" rx="${auraRx}" ry="430" fill="url(#presenter-aura)" opacity=".78"/>
     <ellipse cx="${centerX}" cy="${(shadowY + bob).toFixed(1)}" rx="${layout === "large" ? 460 : 330}" ry="34" fill="#000000" opacity=".32"/>
  </g>`;
}
function renderPresenterImage(imageDataUri, timeMs, layout = "center") {
  const base = layout === "left" ? { x: 10, y: 1050, scale: 0.76 } : layout === "right" ? { x: 310, y: 1050, scale: 0.76 } : layout === "large" ? { x: 0, y: 790, scale: 1.08 } : { x: 90, y: 950, scale: 0.9 };
  const x = base.x + Math.sin(timeMs / 580) * (layout === "center" ? 7 : 4);
  const y = base.y + Math.sin(timeMs / 480) * 6 + Math.sin(timeMs / 1760) * 3;
  const scale = base.scale * (1 + Math.sin(timeMs / 1080) * 0.012);
  return `<g pointer-events="none" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) translate(500 500) scale(${scale.toFixed(4)}) translate(-500 -500)">
    <image href="${escapeXml(imageDataUri)}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid meet"/>
  </g>`;
}

// src/lib/financial-short-renderer.ts
var execFileAsync = promisify(execFile);
var WIDTH = FINANCE_STYLE_DNA.width;
var HEIGHT = FINANCE_STYLE_DNA.height;
var FPS = FINANCE_STYLE_DNA.fps;
var FONT = FINANCE_STYLE_DNA.typography.family;
var GREEN = FINANCE_STYLE_DNA.colors.green;
var WHITE = FINANCE_STYLE_DNA.colors.white;
var MUTED = FINANCE_STYLE_DNA.colors.muted;
var PANEL = FINANCE_STYLE_DNA.colors.panel;
var PANEL_EDGE = FINANCE_STYLE_DNA.colors.panelEdge;
var GOLD = FINANCE_STYLE_DNA.colors.gold;
var WORKSPACE_ROOT = existsSync(join(process.cwd(), "attached_assets")) ? process.cwd() : join(process.cwd(), "..", "..");
var FINANCIAL_PRESENTER_POSE_DIR = join(
  WORKSPACE_ROOT,
  "attached_assets",
  "generated_images"
);
var CRYPTO_F2_MUSIC_BED_PATH = join(
  WORKSPACE_ROOT,
  "artifacts",
  "api-server",
  "assets",
  "audio",
  "crypto-f2-music-bed.mp3"
);
var financialPresenterDataUris = /* @__PURE__ */ new Map();
function getFinancialPresenterAssetPath(state) {
  const mouthState = state.mouthOpen ? "transparent" : "closed-transparent";
  const path = join(
    FINANCIAL_PRESENTER_POSE_DIR,
    `finance-explainer-host-${state.pose}-${mouthState}.png`
  );
  if (!existsSync(path)) {
    throw new Error(`\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u043A\u0430\u0434\u0440 \u0432\u0435\u0434\u0443\u0449\u0435\u0433\u043E: ${path}`);
  }
  return path;
}
function getFinancialPresenterDataUri(state) {
  const path = getFinancialPresenterAssetPath(state);
  let dataUri = financialPresenterDataUris.get(path);
  if (!dataUri) {
    dataUri = `data:image/png;base64,${readFileSync(path).toString("base64")}`;
    financialPresenterDataUris.set(path, dataUri);
  }
  return dataUri;
}
var FINANCIAL_SHORT_SCRIPT = [
  "\u041E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044F \u2014 \u044D\u0442\u043E \u043F\u043E \u0441\u0443\u0442\u0438 \u0440\u0430\u0441\u043F\u0438\u0441\u043A\u0430 \u0441 \u043F\u043E\u043D\u044F\u0442\u043D\u044B\u043C\u0438 \u0443\u0441\u043B\u043E\u0432\u0438\u044F\u043C\u0438.",
  "\u041F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u044C: \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438 \u043D\u0443\u0436\u043D\u044B \u0434\u0435\u043D\u044C\u0433\u0438 \u043D\u0430 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u0435. \u041E\u043D\u0430 \u043C\u043E\u0436\u0435\u0442 \u0432\u0437\u044F\u0442\u044C \u043A\u0440\u0435\u0434\u0438\u0442 \u0432 \u0431\u0430\u043D\u043A\u0435, \u0430 \u043C\u043E\u0436\u0435\u0442 \u0437\u0430\u043D\u044F\u0442\u044C \u0434\u0435\u043D\u044C\u0433\u0438 \u0443 \u0438\u043D\u0432\u0435\u0441\u0442\u043E\u0440\u043E\u0432.",
  "\u041A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u0432\u044B\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u0438. \u0422\u044B \u043F\u043E\u043A\u0443\u043F\u0430\u0435\u0448\u044C \u043E\u0434\u043D\u0443 \u0438\u0437 \u043D\u0438\u0445 \u0438 \u0434\u0430\u0451\u0448\u044C \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438 \u0434\u0435\u043D\u044C\u0433\u0438 \u0441\u0435\u0439\u0447\u0430\u0441.",
  "\u0412\u0437\u0430\u043C\u0435\u043D \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u043E\u0431\u0435\u0449\u0430\u0435\u0442 \u0434\u0432\u0435 \u0432\u0435\u0449\u0438: \u043F\u043B\u0430\u0442\u0438\u0442\u044C \u043F\u0440\u043E\u0446\u0435\u043D\u0442 \u2014 \u044D\u0442\u043E \u043A\u0443\u043F\u043E\u043D, \u0438 \u0432\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u043E\u043C\u0438\u043D\u0430\u043B \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u0438 \u0432 \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0451\u043D\u043D\u0443\u044E \u0434\u0430\u0442\u0443.",
  "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u0442\u044B \u043A\u0443\u043F\u0438\u043B \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044E \u0437\u0430 \u0434\u0435\u0441\u044F\u0442\u044C \u0442\u044B\u0441\u044F\u0447 \u0440\u0443\u0431\u043B\u0435\u0439 \u043D\u0430 \u043E\u0434\u0438\u043D \u0433\u043E\u0434 \u0441 \u043A\u0443\u043F\u043E\u043D\u043E\u043C \u0432\u043E\u0441\u0435\u043C\u043D\u0430\u0434\u0446\u0430\u0442\u044C \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u043E\u0432 \u0433\u043E\u0434\u043E\u0432\u044B\u0445.",
  "\u042D\u0442\u043E \u043D\u0435 \u0437\u043D\u0430\u0447\u0438\u0442, \u0447\u0442\u043E \u0442\u044B \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u043B\u0443\u0447\u0438\u0448\u044C \u0442\u044B\u0441\u044F\u0447\u0443 \u0432\u043E\u0441\u0435\u043C\u044C\u0441\u043E\u0442 \u0440\u0443\u0431\u043B\u0435\u0439. \u041A\u0443\u043F\u043E\u043D \u043C\u043E\u0436\u0435\u0442 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442\u044C \u0447\u0430\u0441\u0442\u044F\u043C\u0438 \u2014 \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u043A\u0430\u0436\u0434\u044B\u0439 \u043A\u0432\u0430\u0440\u0442\u0430\u043B.",
  "\u0412 \u043A\u043E\u043D\u0446\u0435 \u0441\u0440\u043E\u043A\u0430 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0435\u0442 \u0442\u0435\u0431\u0435 \u0441\u0430\u043C\u0438 \u0434\u0435\u0441\u044F\u0442\u044C \u0442\u044B\u0441\u044F\u0447 \u0440\u0443\u0431\u043B\u0435\u0439. \u042D\u0442\u043E \u0438 \u0435\u0441\u0442\u044C \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u043E\u043C\u0438\u043D\u0430\u043B\u0430.",
  "\u041D\u043E \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044F \u2014 \u043D\u0435 \u0434\u0435\u043F\u043E\u0437\u0438\u0442. \u041F\u043E\u043A\u0430 \u043E\u043D\u0430 \u0442\u043E\u0440\u0433\u0443\u0435\u0442\u0441\u044F \u043D\u0430 \u0431\u0438\u0440\u0436\u0435, \u0435\u0451 \u0446\u0435\u043D\u0430 \u043C\u043E\u0436\u0435\u0442 \u043C\u0435\u043D\u044F\u0442\u044C\u0441\u044F \u043A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C.",
  "\u0415\u0441\u043B\u0438 \u043F\u0440\u043E\u0434\u0430\u0442\u044C \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044E \u0440\u0430\u043D\u044C\u0448\u0435 \u0441\u0440\u043E\u043A\u0430, \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C, \u0430 \u043C\u043E\u0436\u043D\u043E \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C \u043C\u0435\u043D\u044C\u0448\u0435 \u0432\u043B\u043E\u0436\u0435\u043D\u043D\u043E\u0439 \u0441\u0443\u043C\u043C\u044B.",
  "\u041F\u043E\u044D\u0442\u043E\u043C\u0443 \u043F\u0435\u0440\u0435\u0434 \u043F\u043E\u043A\u0443\u043F\u043A\u043E\u0439 \u0441\u043C\u043E\u0442\u0440\u0438 \u043D\u0430 \u0441\u0440\u043E\u043A, \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C, \u043A\u0440\u0435\u0434\u0438\u0442\u043D\u044B\u0439 \u0440\u0435\u0439\u0442\u0438\u043D\u0433 \u0438 \u0440\u0438\u0441\u043A \u044D\u043C\u0438\u0442\u0435\u043D\u0442\u0430.",
  "\u041A\u043E\u0440\u043E\u0442\u043A\u043E: \u0442\u044B \u0434\u0430\u0451\u0448\u044C \u0434\u0435\u043D\u044C\u0433\u0438 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438 \u0438\u043B\u0438 \u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0443, \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0448\u044C \u043A\u0443\u043F\u043E\u043D\u044B \u043F\u043E \u043F\u0443\u0442\u0438, \u0430 \u0432 \u043A\u043E\u043D\u0446\u0435 \u2014 \u043D\u043E\u043C\u0438\u043D\u0430\u043B. \u0427\u0435\u043C \u0432\u044B\u0448\u0435 \u043E\u0431\u0435\u0449\u0430\u043D\u043D\u0430\u044F \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C, \u0442\u0435\u043C \u0432\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u044C\u043D\u0435\u0435 \u043D\u0443\u0436\u043D\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0442\u044C \u0440\u0438\u0441\u043A."
].join(" ");
function escapeXml2(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function clamp2(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}
function ease2(value) {
  const t = clamp2(value);
  return 1 - (1 - t) ** 3;
}
function localProgress(timeMs, startMs, endMs) {
  const span = endMs - startMs;
  if (span <= 0) return timeMs >= endMs ? 1 : 0;
  return clamp2((timeMs - startMs) / span);
}
function wrapText(value, maxChars) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
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
  return lines.length ? lines : ["\u2026"];
}
function fitHeaderTitle(value, maxChars = 34) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  let fitted = "";
  for (const word of normalized.split(" ")) {
    const candidate = fitted ? `${fitted} ${word}` : word;
    if (candidate.length > maxChars - 1) break;
    fitted = candidate;
  }
  return fitted ? `${fitted}\u2026` : `${normalized.slice(0, maxChars - 1).trimEnd()}\u2026`;
}
function text(value, x, y, options = {}) {
  return `<text x="${x}" y="${y}" fill="${options.color ?? WHITE}" font-family="${FONT}" font-size="${options.size ?? 30}" font-weight="${options.weight ?? 600}" text-anchor="${options.anchor ?? "middle"}"${options.letterSpacing ? ` letter-spacing="${options.letterSpacing}"` : ""}>${escapeXml2(value)}</text>`;
}
function textLines(value, x, y, maxChars, lineHeight, options = {}) {
  const lines = wrapText(value, maxChars);
  const anchor = options.anchor ?? "middle";
  return lines.map((line, index) => text(line, x, y + index * lineHeight, {
    ...options,
    anchor
  })).join("");
}
function panel(x, y, width, height, fill = PANEL, stroke = PANEL_EDGE) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="34" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}
function pointOnCurve(progress, reverse = false) {
  const t = reverse ? 1 - clamp2(progress) : clamp2(progress);
  const start = { x: 285, y: 780 };
  const controlA = { x: 410, y: 570 };
  const controlB = { x: 670, y: 980 };
  const end = { x: 795, y: 780 };
  const inverse = 1 - t;
  return {
    x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * controlA.x + 3 * inverse * t ** 2 * controlB.x + t ** 3 * end.x,
    y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * controlA.y + 3 * inverse * t ** 2 * controlB.y + t ** 3 * end.y
  };
}
function coin(x, y, scale, color, rotation, opacity = 1) {
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" opacity="${opacity}">
    <circle r="40" fill="#122C25" stroke="${color}" stroke-width="6"/>
    <circle r="29" fill="none" stroke="${color}" stroke-width="2" opacity=".55"/>
    ${text("\u20BD", 0, 12, { size: 33, color, weight: 800 })}
  </g>`;
}
function coinsAlongCurve(progress, reverse, color, count = 5) {
  return Array.from({ length: count }, (_, index) => {
    const offset = (index - (count - 1) / 2) * 0.075;
    const point = pointOnCurve(progress + offset, reverse);
    const scale = 0.78 + (index + 1) % 3 * 0.07;
    return coin(point.x, point.y, scale, color, (progress * 240 + index * 29) % 360, clamp2(1 - Math.abs(offset) * 2));
  }).join("");
}
function actor(kind, x, y, progress, timeMs = 0) {
  const entry = ease2(progress);
  const offsetX = kind === "investor" ? -90 * (1 - entry) : 90 * (1 - entry);
  const liveOffset = Math.sin(timeMs / 620 + (kind === "investor" ? 0 : Math.PI)) * 7 * entry;
  const liveRotation = Math.sin(timeMs / 890 + (kind === "investor" ? 0 : Math.PI)) * 0.8 * entry;
  const label = kind === "investor" ? "\u0418\u041D\u0412\u0415\u0421\u0422\u041E\u0420" : "\u041A\u041E\u041C\u041F\u0410\u041D\u0418\u042F";
  const icon = kind === "investor" ? `<rect x="-84" y="-45" width="168" height="105" rx="18" fill="#172936" stroke="${GREEN}" stroke-width="3"/>
       <path d="M-42 -10 L42 -10 M-42 20 L28 20" stroke="${GREEN}" stroke-width="8" stroke-linecap="round" opacity=".72"/>
       <circle cx="0" cy="82" r="18" fill="${GREEN}"/>${text("\u20BD", 0, 91, { size: 25, color: "#092017", weight: 800 })}` : `<path d="M-72 65 V-32 L0 -88 L72 -32 V65 Z" fill="#172936" stroke="${GREEN}" stroke-width="3"/>
       <path d="M-46 54 V3 H-10 V54 M10 54 V3 H46 V54 M-85 72 H85" fill="none" stroke="${GREEN}" stroke-width="9" stroke-linejoin="round" opacity=".78"/>`;
  return `<g transform="translate(${x + offsetX} ${y + liveOffset}) rotate(${liveRotation}) scale(${0.9 + entry * 0.1})" opacity="${entry}">
    ${panel(-135, -120, 270, 240)}
    ${icon}
    ${text(label, 0, 155, { size: 25, color: WHITE, weight: 800, letterSpacing: 1 })}
  </g>`;
}
function documentCard(progress, label = "\u041E\u0411\u042F\u0417\u0410\u0422\u0415\u041B\u042C\u0421\u0422\u0412\u041E", caption = "\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0434\u0435\u043D\u044C\u0433\u0438") {
  const entry = ease2(progress);
  return `<g transform="translate(540 780) scale(${0.82 + entry * 0.18}) rotate(${(1 - entry) * -3})" opacity="${entry}">
    <rect x="-230" y="-150" width="460" height="300" rx="30" fill="#F1F7F5" stroke="${GREEN}" stroke-width="4"/>
    <path d="M-170 -62 H150 M-170 0 H125 M-170 62 H55" stroke="#4B6A62" stroke-width="14" stroke-linecap="round"/>
    <rect x="106" y="72" width="72" height="38" rx="12" fill="${GREEN}"/>
    ${text(label, 0, -190, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
    ${text(caption, 0, 215, { size: 26, color: WHITE, weight: 700 })}
  </g>`;
}
function shareTile(x, y, label, progress, rotation = 0, color = GREEN) {
  const entry = ease2(progress);
  const scale = 0.72 + entry * 0.28;
  const labelSize = Math.max(14, Math.min(22, 240 / Math.max(1, label.length)));
  return `<g transform="translate(${x} ${y}) rotate(${rotation}) scale(${scale})" opacity="${entry}">
    <rect x="-72" y="-52" width="144" height="104" rx="22" fill="#142B26" stroke="${color}" stroke-width="3"/>
    ${text(label, 0, 9, { size: labelSize, color: WHITE, weight: 800 })}
  </g>`;
}
function ownershipVisual(beat, progress, timeMs) {
  const split = clamp2((progress - 0.14) / 0.6);
  const shares = [
    [350, 600, "\u0410\u041A\u0426\u0418\u042F"],
    [730, 600, "\u0410\u041A\u0426\u0418\u042F"],
    [430, 820, "\u0410\u041A\u0426\u0418\u042F"],
    [650, 820, "\u0410\u041A\u0426\u0418\u042F"],
    [540, 900, "\u0410\u041A\u0426\u0418\u042F"]
  ];
  const companyScale = 1 - ease2(split) * 0.18;
  return `${actor("company", 850, 770, ease2(progress * 1.8), timeMs)}
    <g transform="translate(540 700) scale(${companyScale})" opacity="${1 - ease2(split) * 0.62}">
      ${panel(-150, -120, 300, 240, "#162B2B", GREEN)}
      ${text("\u041A\u041E\u041C\u041F\u0410\u041D\u0418\u042F", 0, -12, { size: 25, color: WHITE, weight: 800 })}
      ${text("100%", 0, 42, { size: 44, color: GREEN, weight: 900 })}
    </g>
    ${shares.map(([x, y, label], index) => {
    const shareProgress = clamp2((split - index * 0.08) * 2.3);
    const originX = 540 + (Number(x) - 540) * (1 - ease2(split));
    const originY = 700 + (Number(y) - 700) * (1 - ease2(split));
    return shareTile(originX, originY, String(label), shareProgress, Math.sin(timeMs / 600 + index) * 2);
  }).join("")}
    ${text("\u041A\u041E\u041C\u041F\u0410\u041D\u0418\u042F \u2192 \u0414\u041E\u041B\u0418", 540, 1050, { size: 28, color: GREEN, weight: 800, letterSpacing: 1 })}
    ${text(beat.entityLabel ?? "\u0410\u041A\u0426\u0418\u042F", 540, 1120, { size: 34, color: WHITE, weight: 900 })}`;
}
function fundPoolVisual(beat, progress, timeMs) {
  const poolEntry = ease2(clamp2((progress - 0.16) * 1.6));
  const assetEntry = ease2(clamp2((progress - 0.48) * 2.1));
  const investors = [
    [165, 600],
    [165, 780],
    [165, 960]
  ];
  const assets = [
    ["\u0410\u041A\u0426\u0418\u0418", GREEN],
    ["\u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u0418", GOLD],
    ["\u0417\u041E\u041B\u041E\u0422\u041E", "#D7C27C"],
    ["\u0414\u0420\u0423\u0413\u0418\u0415 \u0410\u041A\u0422\u0418\u0412\u042B", "#B9F7D8"]
  ];
  return `${investors.map(([x, y], index) => {
    const local = ease2(clamp2(progress * 2.1 - index * 0.18));
    return `<g transform="translate(${x + (1 - local) * -70} ${y + Math.sin(timeMs / 700 + index) * 5})" opacity="${local}">
        <circle r="48" fill="#142B26" stroke="${GREEN}" stroke-width="3"/>
        ${text("\u20BD", 0, 14, { size: 33, color: GREEN, weight: 800 })}
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
      ${text("\u041E\u0411\u0429\u0418\u0419", 0, -12, { size: 27, color: MUTED, weight: 800, letterSpacing: 2 })}
      ${text("\u0424\u041E\u041D\u0414", 0, 42, { size: 48, color: WHITE, weight: 900 })}
    </g>
    ${assets.map(([label, color], index) => {
    const angle = -1.05 + index * 0.7 + Math.sin(timeMs / 1200) * 0.04;
    const x = 540 + Math.cos(angle) * 250;
    const y = 760 + Math.sin(angle) * 250;
    return shareTile(x, y, String(label), assetEntry, index % 2 ? -4 : 4, String(color));
  }).join("")}
    ${text("\u0414\u041E\u041B\u0418 \u041F\u041E\u0420\u0422\u0424\u0415\u041B\u042F \xB7 \u0421\u0425\u0415\u041C\u0410", 540, 1080, { size: 20, color: MUTED, weight: 750, letterSpacing: 1 })}
    ${text(beat.entityLabel ?? "\u041F\u0410\u0415\u0412\u041E\u0419 \u0424\u041E\u041D\u0414", 540, 1150, { size: 31, color: GREEN, weight: 800 })}`;
}
function distributionVisual(beat, progress, timeMs) {
  const profitEntry = ease2(clamp2(progress * 1.8));
  const distribution = ease2(clamp2((progress - 0.3) * 1.7));
  const payments = [
    [330, 910, "1"],
    [540, 1e3, "2"],
    [750, 910, "3"]
  ];
  return `${actor("company", 540, 575, profitEntry, timeMs)}
    ${badge("\u041F\u0420\u0418\u0411\u042B\u041B\u042C", 540, 350, GOLD, profitEntry, 300)}
    <path d="M540 760 C540 820 330 820 330 900 M540 760 C540 850 540 900 540 970 M540 760 C540 820 750 820 750 900" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="10 16" opacity="${distribution * 0.8}" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>
    ${payments.map(([x, y, label], index) => {
    const local = ease2(clamp2(distribution * 2.2 - index * 0.16));
    return `<g transform="translate(${x} ${y + Math.sin(timeMs / 500 + index) * 6}) scale(${0.76 + local * 0.24})" opacity="${local}">
        <circle r="74" fill="#142B26" stroke="${GREEN}" stroke-width="4"/>
        ${text("\u20BD", 0, 12, { size: 38, color: GREEN, weight: 900 })}
        ${text(`\u0410\u041A\u0426\u0418\u041E\u041D\u0415\u0420 ${label}`, 0, 118, { size: 18, color: WHITE, weight: 800 })}
      </g>`;
  }).join("")}
    ${text("\u041F\u0420\u0418\u0411\u042B\u041B\u042C \u2192 \u0412\u042B\u041F\u041B\u0410\u0422\u0410", 540, 1220, { size: 29, color: GREEN, weight: 800, letterSpacing: 1 })}
    ${text(beat.entityLabel ?? "\u0414\u0418\u0412\u0418\u0414\u0415\u041D\u0414", 540, 1280, { size: 34, color: WHITE, weight: 900 })}`;
}
function badge(label, x, y, color, progress, width = 310) {
  const entry = ease2(progress);
  return `<g transform="translate(${x} ${y}) scale(${0.78 + entry * 0.22})" opacity="${entry}">
    <rect x="${-width / 2}" y="-43" width="${width}" height="86" rx="43" fill="#12261F" stroke="${color}" stroke-width="2"/>
    <circle cx="${-width / 2 + 34}" cy="0" r="10" fill="${color}"/>
    ${text(label, 18, 11, { size: 27, color: WHITE, weight: 800, letterSpacing: 0.7 })}
  </g>`;
}
function seededSeries(seed, count, trend = 0.5) {
  let state = Math.abs(Math.round(seed)) || 17;
  const values = [];
  let value = 42;
  for (let index = 0; index < count; index += 1) {
    state = state * 1664525 + 1013904223 >>> 0;
    const noise = (state / 4294967295 - 0.5) * 15;
    value = Math.max(12, Math.min(88, value + trend + noise));
    values.push(value);
  }
  return values;
}
function chartSeed(beat) {
  return [...beat.id, beat.entityLabel ?? "", beat.title].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0
  );
}
function chartVisual(beat, progress, timeMs) {
  const kind = beat.chartKind ?? "line";
  const seed = chartSeed(beat);
  const values = seededSeries(seed, 9, kind === "candlestick" ? 0.2 : 1.2);
  const plotX = 205;
  const plotY = 570;
  const plotWidth = 670;
  const plotHeight = 360;
  const visible = Math.max(2, Math.ceil(clamp2((progress - 0.08) / 0.76) * values.length));
  const pointAt = (value, index) => ({
    x: plotX + index / (values.length - 1) * plotWidth,
    y: plotY + plotHeight - value / 100 * plotHeight
  });
  const points = values.map(pointAt);
  const grid = Array.from({ length: 5 }, (_, index) => {
    const y = plotY + index * (plotHeight / 4);
    return `<line x1="${plotX}" y1="${y}" x2="${plotX + plotWidth}" y2="${y}" stroke="#294051" stroke-width="2" stroke-dasharray="6 18"/>`;
  }).join("");
  const axes = `<line x1="${plotX}" y1="${plotY + plotHeight}" x2="${plotX + plotWidth}" y2="${plotY + plotHeight}" stroke="${MUTED}" stroke-width="3" opacity=".65"/><line x1="${plotX}" y1="${plotY}" x2="${plotX}" y2="${plotY + plotHeight}" stroke="${MUTED}" stroke-width="3" opacity=".65"/>`;
  const label = kind === "candlestick" ? "\u0421\u0412\u0415\u0427\u041D\u041E\u0419 \u0413\u0420\u0410\u0424\u0418\u041A" : kind === "area" ? "\u0414\u0418\u041D\u0410\u041C\u0418\u041A\u0410 \u041F\u041E\u041A\u0410\u0417\u0410\u0422\u0415\u041B\u042F" : kind === "bar" || kind === "horizontal_bar" ? "\u0421\u0420\u0410\u0412\u041D\u0415\u041D\u0418\u0415 \u0417\u041D\u0410\u0427\u0415\u041D\u0418\u0419" : "\u0414\u0412\u0418\u0416\u0415\u041D\u0418\u0415 \u041F\u041E\u041A\u0410\u0417\u0410\u0422\u0415\u041B\u042F";
  if (kind === "candlestick") {
    const candles = values.map((value, index) => {
      const x = plotX + index * (plotWidth / (values.length - 1));
      const open = Math.max(10, value - 8 + Math.sin(seed + index) * 4);
      const close = Math.max(10, value + 6 - Math.cos(seed + index) * 4);
      const high = Math.min(98, Math.max(open, close) + 10);
      const low = Math.max(4, Math.min(open, close) - 10);
      const scale = Math.max(0.28, clamp2((progress * values.length - index) * 1.8));
      const color = close >= open ? GREEN : "#FF8D8D";
      const yHigh = pointAt(high, index).y;
      const yLow = pointAt(low, index).y;
      const yOpen = pointAt(open, index).y;
      const yClose = pointAt(close, index).y;
      const active = Math.floor(timeMs / 260) % values.length === index;
      return `<g opacity="${scale}"><line x1="${x}" y1="${yHigh}" x2="${x}" y2="${yLow}" stroke="${color}" stroke-width="${active ? 9 : 5}"/><rect x="${x - (active ? 23 : 18)}" y="${Math.min(yOpen, yClose)}" width="${active ? 46 : 36}" height="${Math.max(12, Math.abs(yClose - yOpen))}" rx="6" fill="${color}" opacity="${active ? 1 : 0.85}"/>${active ? `<circle cx="${x}" cy="${yHigh - 18}" r="${10 + Math.sin(timeMs / 120) * 3}" fill="${color}"/>` : ""}</g>`;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text(label, 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      ${grid}${axes}${candles}
      ${text("\u0423\u0447\u0435\u0431\u043D\u044B\u0439 \u043F\u0440\u0438\u043C\u0435\u0440 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F \u0446\u0435\u043D\u044B", 540, 1145, { size: 27, color: WHITE, weight: 700 })}
      ${badge(beat.metricLabel ?? "\u0426\u0415\u041D\u0410 \u041D\u0410 \u0411\u0418\u0420\u0416\u0415", 540, 1240, GOLD, ease2(progress), 390)}`;
  }
  if (kind === "bar" || kind === "horizontal_bar" || kind === "portfolio") {
    const labels = kind === "portfolio" ? ["\u0410\u041A\u0426\u0418\u0418", "\u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u0418", "\u0417\u041E\u041B\u041E\u0422\u041E", "\u041A\u042D\u0428", "\u0414\u0420\u0423\u0413\u041E\u0415"] : ["A", "B", "C", "D", "E", "F"];
    const bars = labels.map((labelText, index) => {
      const value = values[index % values.length];
      const local = ease2(clamp2(progress * 1.8 - index * 0.12));
      if (kind === "horizontal_bar" || kind === "portfolio") {
        const y = 600 + index * 82;
        const width = value * 5.1 * (0.94 + Math.sin(timeMs / 360 + index) * 0.06);
        return `<g opacity="${local}">${text(labelText, 210, y + 28, { size: 22, color: WHITE, weight: 700, anchor: "start" })}<rect x="370" y="${y}" width="${width}" height="46" rx="23" fill="${index % 2 ? GOLD : GREEN}" opacity=".8"/><text x="${390 + width}" y="${y + 31}" fill="${WHITE}" font-family="${FONT}" font-size="20" font-weight="800">${Math.round(value)}%</text></g>`;
      }
      const x = 225 + index * 105;
      const height = value * 3.2 * (0.94 + Math.sin(timeMs / 360 + index) * 0.06);
      return `<g opacity="${local}"><rect x="${x}" y="${930 - height}" width="64" height="${height}" rx="16" fill="${index % 2 ? GOLD : GREEN}" opacity=".82"/><text x="${x + 32}" y="970" fill="${WHITE}" font-family="${FONT}" font-size="20" font-weight="800" text-anchor="middle">${labelText}</text></g>`;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text(kind === "portfolio" ? "\u0421\u0422\u0420\u0423\u041A\u0422\u0423\u0420\u0410 \u041F\u041E\u0420\u0422\u0424\u0415\u041B\u042F" : label, 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      ${kind === "horizontal_bar" || kind === "portfolio" ? bars : `${axes}${bars}`}
      ${text("\u0414\u043E\u043B\u0438 \u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u043F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043A\u0430\u043A \u0443\u0447\u0435\u0431\u043D\u044B\u0439 \u043F\u0440\u0438\u043C\u0435\u0440", 540, 1145, { size: 25, color: WHITE, weight: 700 })}`;
  }
  if (kind === "donut") {
    const segments = [28, 22, 18, 17, 15];
    const colors = [GREEN, GOLD, "#7ED8FF", "#C795FF", "#FF9B8D"];
    const circumference = 2 * Math.PI * 150;
    let offset = 0;
    const rings = segments.map((segment, index) => {
      const length = circumference * segment / 100;
      const local = ease2(clamp2(progress * 2 - index * 0.18));
      const ring = `<circle cx="540" cy="760" r="150" fill="none" stroke="${colors[index]}" stroke-width="64" stroke-dasharray="${length * local} ${circumference}" stroke-dashoffset="${-offset}" transform="rotate(-90 540 760)" opacity="${local}"/>`;
      offset += length;
      return ring;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text("\u0420\u0410\u0421\u041F\u0420\u0415\u0414\u0415\u041B\u0415\u041D\u0418\u0415", 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      <g transform="rotate(${Math.sin(timeMs / 1800) * 8} 540 760)">${rings}</g>
      <circle cx="540" cy="760" r="104" fill="#0D1A22"/>
      ${text(beat.entityLabel ?? "\u041F\u041E\u0420\u0422\u0424\u0415\u041B\u042C", 540, 750, { size: 24, color: WHITE, weight: 800 })}
      ${text("100%", 540, 795, { size: 36, color: GREEN, weight: 900 })}
      ${text("\u0423\u0447\u0435\u0431\u043D\u0430\u044F \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0430", 540, 1145, { size: 27, color: WHITE, weight: 700 })}`;
  }
  if (kind === "waterfall") {
    const values2 = [68, 24, -18, 15, -9, 80];
    let running = 42;
    const bars = values2.map((change, index) => {
      const start = running;
      running += change;
      const local = ease2(clamp2(progress * 1.8 - index * 0.13));
      const x = 190 + index * 112;
      const yStart = 930 - start * 3;
      const yEnd = 930 - running * 3;
      const y = Math.min(yStart, yEnd);
      const height = Math.max(18, Math.abs(yEnd - yStart));
      const color = change >= 0 ? GREEN : "#FF8D8D";
      return `<g opacity="${local}"><rect x="${x}" y="${y}" width="72" height="${height}" rx="12" fill="${color}" opacity=".85"/><text x="${x + 36}" y="980" fill="${WHITE}" font-family="${FONT}" font-size="18" font-weight="800" text-anchor="middle">${change > 0 ? "+" : ""}${change}</text></g>`;
    }).join("");
    return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
      ${text("\u041F\u0420\u0418\u0411\u042B\u041B\u042C \u2192 \u0412\u042B\u041F\u041B\u0410\u0422\u0410", 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      ${axes}${bars}
      ${text("\u041A\u0430\u043A \u0441\u0443\u043C\u043C\u0430 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043F\u043E\u0441\u043B\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0448\u0430\u0433\u0430", 540, 1145, { size: 27, color: WHITE, weight: 700 })}`;
  }
  const linePoints = points.slice(0, visible).map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${plotX},${plotY + plotHeight} ${linePoints} ${points[Math.max(0, visible - 1)].x},${plotY + plotHeight}`;
  const fullPoints = points.map((point) => `${point.x},${point.y}`).join(" ");
  const progressivePath = `<polyline points="${fullPoints}" fill="none" stroke="${GREEN}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" opacity=".24"/><polyline points="${linePoints}" fill="none" stroke="${GREEN}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12" stroke-dashoffset="${-Math.round(timeMs / 5)}"/>`;
  const area = kind === "area" ? `<polygon points="${areaPoints}" fill="${GREEN}" opacity=".12"/><polyline points="${fullPoints}" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="12 22" stroke-dashoffset="${-Math.round(timeMs / 6)}" opacity=".55"/>` : "";
  const dots = points.map((point, index) => {
    const visibleOpacity = index < visible ? 1 : 0.22;
    const active = Math.floor(timeMs / 300) % values.length === index;
    return `<circle cx="${point.x}" cy="${point.y}" r="${active ? 16 + Math.sin(timeMs / 140) * 3 : 8 + Math.sin(timeMs / 220 + index) * 2}" fill="${GREEN}" stroke="#0D1A22" stroke-width="5" opacity="${visibleOpacity}"/>`;
  }).join("");
  return `${panel(140, 420, 800, 650, "#0D1A22", PANEL_EDGE)}
    ${text(label, 540, 500, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
    ${grid}${axes}${area}${progressivePath}${dots}
    ${text("\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u0432\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438", 540, 1145, { size: 27, color: WHITE, weight: 700 })}
    ${badge(beat.metricLabel ?? "\u0414\u0418\u041D\u0410\u041C\u0418\u041A\u0410", 540, 1240, GREEN, ease2(progress), 330)}`;
}
function renderBackgroundLayer(background, timeMs) {
  const drift = Math.round(timeMs / 14);
  const grid = `<g opacity=".12">${Array.from({ length: 16 }, (_, index) => `<line x1="${index * 72}" y1="0" x2="${index * 72}" y2="${HEIGHT}" stroke="${GREEN}" stroke-width="1"/>`).join("")}${Array.from({ length: 28 }, (_, index) => `<line x1="0" y1="${index * 72}" x2="${WIDTH}" y2="${index * 72}" stroke="${GREEN}" stroke-width="1"/>`).join("")}</g>`;
  if (background === "grid") return grid;
  if (background === "particles" || background === "stars") {
    return `${grid}<g fill="${GREEN}" opacity=".2">${Array.from({ length: background === "stars" ? 42 : 24 }, (_, index) => {
      const x = 34 + index * 173 % 1010;
      const y = 180 + index * 311 % 1440;
      const radius = background === "stars" ? 2 + index % 4 * 2 : 3 + index % 4 * 2;
      return `<circle cx="${x}" cy="${y}" r="${radius}"/><circle cx="${(x + 120) % WIDTH}" cy="${y + 54}" r="2"/>`;
    }).join("")}</g>`;
  }
  if (background === "terminal" || background === "ledger") {
    const rows = Array.from({ length: 12 }, (_, index) => {
      const y = 250 + index * 118;
      return `<line x1="48" y1="${y}" x2="${1030 - index % 3 * 90}" y2="${y}" stroke="${GREEN}" stroke-width="${background === "ledger" ? 1 : 2}" stroke-dasharray="${18 + index % 4 * 11} 22" stroke-dashoffset="${-drift}"/>`;
    }).join("");
    return `${background === "ledger" ? grid : ""}<g opacity=".16">${rows}</g>`;
  }
  if (background === "aurora") {
    return `<g opacity=".24" fill="none" stroke-linecap="round"><path d="M-80 520 C220 220 420 820 720 470 S1120 210 1190 540" stroke="${GREEN}" stroke-width="70" opacity=".1"/><path d="M-80 930 C230 620 470 1180 770 840 S1120 610 1190 900" stroke="#7ED8FF" stroke-width="42" opacity=".12"/><path d="M-80 1340 C240 1040 470 1500 820 1200 S1110 1050 1190 1320" stroke="${GOLD}" stroke-width="24" opacity=".12"/></g>`;
  }
  if (background === "mesh") {
    return `<g opacity=".14" fill="none" stroke="${GREEN}" stroke-width="2">${Array.from({ length: 9 }, (_, index) => `<path d="M-50 ${340 + index * 150} C260 ${180 + index * 150} 520 ${520 + index * 120} 1130 ${300 + index * 138}"/>`).join("")}</g><g fill="${GREEN}" opacity=".28">${Array.from({ length: 18 }, (_, index) => `<circle cx="${80 + index * 227 % 900}" cy="${260 + index * 149 % 1240}" r="5"/>`).join("")}</g>`;
  }
  if (background === "circuit") {
    return `<g fill="none" stroke="${GREEN}" stroke-width="3" opacity=".16">${Array.from({ length: 9 }, (_, index) => {
      const y = 260 + index * 150;
      return `<path d="M30 ${y} H${170 + index % 3 * 70} V${y + 60} H${420 + index % 4 * 90} V${y - 40} H1050"/>`;
    }).join("")}</g><g fill="${GREEN}" opacity=".36">${Array.from({ length: 18 }, (_, index) => `<circle cx="${170 + index % 6 * 150}" cy="${260 + Math.floor(index / 6) * 430}" r="7"/>`).join("")}</g>`;
  }
  if (background === "waves") {
    return `<g fill="none" stroke-linecap="round"><path d="M-80 460 C100 300 250 620 430 460 S760 300 940 460 S1130 620 1180 480" stroke="${GREEN}" stroke-width="4" opacity=".22"/><path d="M-80 800 C100 640 250 960 430 800 S760 640 940 800 S1130 960 1180 820" stroke="${GOLD}" stroke-width="3" opacity=".18"/><path d="M-80 1140 C100 980 250 1300 430 1140 S760 980 940 1140 S1130 1300 1180 1160" stroke="#7ED8FF" stroke-width="3" opacity=".16"/></g>`;
  }
  if (background === "blueprint") {
    return `<g opacity=".16" stroke="${GREEN}" fill="none" stroke-width="2" stroke-dasharray="10 16">${Array.from({ length: 9 }, (_, index) => `<rect x="${80 + index % 3 * 300}" y="${260 + Math.floor(index / 3) * 380}" width="220" height="240" rx="24"/>`).join("")}</g>${grid}`;
  }
  if (background === "radar") {
    return `<g transform="translate(540 760)" fill="none" stroke="${GREEN}" opacity=".18">${[180, 300, 420, 540].map((radius) => `<circle r="${radius}"/>`).join("")}<path d="M0 0 L0 -540 M0 0 L540 0 M0 0 L0 540 M0 0 L-540 0"/></g><path d="M540 760 L540 220 A540 540 0 0 1 850 318 Z" fill="${GREEN}" opacity=".07"/>`;
  }
  return `<g opacity=".16" fill="${GREEN}">${Array.from({ length: 15 }, (_, index) => {
    const x = 80 + index * 70;
    const height = 80 + index * 83 % 260;
    return `<rect x="${x}" y="${1200 - height}" width="24" height="${height}" rx="12" transform="scale(1 ${1 + Math.sin(timeMs / 500 + index) * 0.08})"/>`;
  }).join("")}</g>`;
}
function contractVisual(beat, progress, timeMs) {
  const reveal = ease2(clamp2(progress * 1.8));
  const scanX = 300 + timeMs / 8 % 480;
  return `<g opacity="${reveal}">
    <g transform="translate(540 700) rotate(${Math.sin(timeMs / 900) * 1.5})">
      ${panel(-245, -190, 490, 380, "#111D2B", "#5DC7FF")}
      ${text("\u041A\u041E\u041D\u0422\u0420\u0410\u041A\u0422", 0, -118, { size: 23, color: "#7ED8FF", weight: 800, letterSpacing: 2 })}
      <path d="M-170 -54 H170 M-170 8 H120 M-170 70 H60" stroke="#7C93A7" stroke-width="14" stroke-linecap="round"/>
      <rect x="92" y="106" width="92" height="42" rx="12" fill="#5DC7FF"/>
      ${text(beat.maturityLabel ?? "\u0411\u0423\u0414\u0423\u0429\u0410\u042F \u0414\u0410\u0422\u0410", 0, 245, { size: 25, color: WHITE, weight: 800 })}
    </g>
    <g transform="translate(190 720)">${panel(-120, -100, 240, 200, "#132338", "#FFB86B")}${text("\u041F\u041E\u041A\u0423\u041F\u0410\u0422\u0415\u041B\u042C", 0, -8, { size: 21, color: "#FFB86B", weight: 800 })}${text("\u0446\u0435\u043D\u0430", 0, 42, { size: 27, color: WHITE, weight: 700 })}</g>
    <g transform="translate(890 720)">${panel(-120, -100, 240, 200, "#132338", "#C795FF")}${text("\u041F\u0420\u041E\u0414\u0410\u0412\u0415\u0426", 0, -8, { size: 21, color: "#C795FF", weight: 800 })}${text("\u0430\u043A\u0442\u0438\u0432", 0, 42, { size: 27, color: WHITE, weight: 700 })}</g>
    <path d="M315 720 C380 590 430 590 470 650 M610 650 C650 590 700 590 765 720" fill="none" stroke="#7ED8FF" stroke-width="6" stroke-dasharray="12 18" stroke-dashoffset="${-Math.round(timeMs / 7)}"/>
    <rect x="${scanX}" y="450" width="6" height="510" fill="#7ED8FF" opacity=".24"/>
    ${text("\u0414\u043E\u0433\u043E\u0432\u043E\u0440\u0451\u043D\u043D\u043E\u0441\u0442\u044C \u043E \u0446\u0435\u043D\u0435 \u043D\u0430 \u0431\u0443\u0434\u0443\u0449\u0443\u044E \u0434\u0430\u0442\u0443", 540, 1110, { size: 27, color: WHITE, weight: 700 })}
  </g>`;
}
function leverageVisual(beat, progress, timeMs) {
  const level = ease2(clamp2((progress - 0.12) * 1.45));
  const marker = 250 + level * 580;
  return `${panel(130, 420, 820, 700, "#111B2A", "#FFB86B")}
    ${text("\u041F\u041B\u0415\u0427\u041E \u0423\u0412\u0415\u041B\u0418\u0427\u0418\u0412\u0410\u0415\u0422 \u041F\u041E\u0417\u0418\u0426\u0418\u042E", 540, 505, { size: 23, color: "#FFB86B", weight: 800, letterSpacing: 1 })}
    ${text("\u0417\u0410\u041B\u041E\u0413", 190, 660, { size: 22, color: MUTED, weight: 800, anchor: "start" })}
    <rect x="190" y="700" width="700" height="54" rx="27" fill="#27394B"/>
    <rect x="190" y="700" width="${260 * level}" height="54" rx="27" fill="#7ED8FF"/>
    ${text("\u043F\u043E\u0437\u0438\u0446\u0438\u044F", 190, 850, { size: 22, color: MUTED, weight: 800, anchor: "start" })}
    <rect x="190" y="890" width="700" height="54" rx="27" fill="#27394B"/>
    <rect x="190" y="890" width="${700 * level}" height="54" rx="27" fill="#FFB86B"/>
    <circle cx="${marker}" cy="917" r="${22 + Math.sin(timeMs / 180) * 4}" fill="#FFF2D7" stroke="#FFB86B" stroke-width="5"/>
    ${badge(beat.metricLabel ?? "\u0426\u0415\u041D\u0410 \u041A\u041E\u041D\u0422\u0420\u0410\u041A\u0422\u0410", 540, 1190, "#FFB86B", level, 390)}
    ${text("\u041C\u0430\u043B\u0435\u043D\u044C\u043A\u043E\u0435 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0446\u0435\u043D\u044B \u0432\u043B\u0438\u044F\u0435\u0442 \u043D\u0430 \u0431\u043E\u043B\u044C\u0448\u0443\u044E \u043F\u043E\u0437\u0438\u0446\u0438\u044E", 540, 1280, { size: 25, color: WHITE, weight: 700 })}`;
}
function payoffVisual(beat, progress, timeMs) {
  const reveal = ease2(clamp2((progress - 0.1) * 1.3));
  const futuresExample = beat.concept === "futures_contract";
  const shortScenario = futuresExample && /short|95/iu.test(`${beat.title} ${beat.visualAction || ""}`);
  const currentX = futuresExample ? shortScenario ? 540 - 320 * ease2(progress) : 540 + 320 * ease2(progress) : 240 + timeMs / 18 % 600;
  const currentY = futuresExample ? shortScenario ? 850 - (540 - currentX) * (170 / 320) : 850 - (currentX - 540) * 0.8 : 850 - (currentX - 540) * 0.8;
  const longOpacity = futuresExample && shortScenario ? 0.38 : 1;
  const shortOpacity = futuresExample && !shortScenario ? 0.38 : 0.72;
  const curveReveal = futuresExample ? "" : `stroke-dasharray="${720 * reveal} 720"`;
  return `${panel(130, 410, 820, 720, "#111A2C", "#C795FF")}
    ${text(futuresExample ? "\u0423\u0427\u0415\u0411\u041D\u042B\u0419 PAYOFF \xB7 \u0411\u0415\u0417 \u041A\u041E\u041C\u0418\u0421\u0421\u0418\u0419" : "\u0420\u0415\u0417\u0423\u041B\u042C\u0422\u0410\u0422 \u041F\u0420\u0418 \u0420\u0410\u0417\u041D\u041E\u0419 \u0426\u0415\u041D\u0415", 540, 500, { size: 23, color: "#C795FF", weight: 800, letterSpacing: 1 })}
    <line x1="220" y1="850" x2="880" y2="850" stroke="${MUTED}" stroke-width="3"/>
    <line x1="540" y1="580" x2="540" y2="1040" stroke="${MUTED}" stroke-width="3"/>
    <path d="M220 1010 L540 850 L860 590" fill="none" stroke="#C795FF" stroke-width="10" ${curveReveal} stroke-linecap="round" opacity="${longOpacity}"/>
    <path d="M220 680 L540 850 L860 1010" fill="none" stroke="#FF8D8D" stroke-width="6" ${curveReveal} stroke-linecap="round" opacity="${shortOpacity}"/>
    <circle cx="${currentX}" cy="${currentY}" r="${18 + Math.sin(timeMs / 160) * 4}" fill="#FFFFFF" stroke="${shortScenario ? "#FF8D8D" : "#C795FF"}" stroke-width="5"/>
    ${futuresExample ? `${text("\u041B\u041E\u041D\u0413", 300, 650, { size: 22, color: "#C795FF", weight: 850 })}${text("\u0428\u041E\u0420\u0422", 780, 650, { size: 22, color: "#FF8D8D", weight: 850 })}${text("95", 220, 900, { size: 21, color: MUTED, weight: 700 })}${text("100 \xB7 \u0412\u0425\u041E\u0414", 540, 900, { size: 21, color: GOLD, weight: 800 })}${text("105", 860, 900, { size: 21, color: MUTED, weight: 700 })}` : text("\u0446\u0435\u043D\u0430 \u0430\u043A\u0442\u0438\u0432\u0430", 840, 900, { size: 20, color: MUTED, weight: 700 })}
    ${text("\u043F\u0440\u0438\u0431\u044B\u043B\u044C / \u0443\u0431\u044B\u0442\u043E\u043A", 560, 575, { size: 20, color: MUTED, weight: 700 })}
    ${text(beat.maturityLabel ?? "\u0418\u0421\u041F\u041E\u041B\u041D\u0415\u041D\u0418\u0415 \u0412 \u0411\u0423\u0414\u0423\u0429\u0415\u041C", 540, 1190, { size: 27, color: WHITE, weight: 700 })}`;
}
function compoundGrowthVisual(beat, progress, timeMs) {
  const values = ["100 000 \u20BD", "110 000 \u20BD", "121 000 \u20BD"];
  const activeStep = Math.min(values.length - 1, Math.floor(clamp2(progress) * values.length));
  const chartProgress = ease2(clamp2((progress - 0.08) / 0.86));
  const points = [[230, 970], [410, 860], [590, 715], [780, 525]];
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x} ${y}`).join(" ");
  const lastX = 230 + (780 - 230) * chartProgress;
  const lastY = 970 - (970 - 525) * chartProgress;
  const count = Math.min(points.length, Math.max(1, Math.ceil(chartProgress * points.length)));
  return `${panel(110, 390, 860, 770, "#131C1B", "#78D6B0")}
    ${text("\u041A\u0410\u041F\u0418\u0422\u0410\u041B\u0418\u0417\u0410\u0426\u0418\u042F \u041F\u0420\u041E\u0426\u0415\u041D\u0422\u0410", 540, 482, { size: 24, color: "#78D6B0", weight: 850, letterSpacing: 1.4 })}
    <path d="${line}" fill="none" stroke="#78D6B0" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="${chartProgress.toFixed(3)} 1"/>
    ${points.slice(0, count).map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="${index === activeStep ? 21 + Math.sin(timeMs / 180) * 3 : 13}" fill="${index <= activeStep ? "#E8BD70" : "#293A33"}" stroke="${index <= activeStep ? "#FFF0C9" : "#63766C"}" stroke-width="3"/>`).join("")}
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="13" fill="#F0C579" opacity=".9"/>
    ${values.map((value, index) => {
    const x = 270 + index * 265;
    const y = 1050 - index * 115;
    const reached = index <= activeStep;
    return `<g opacity="${reached ? 1 : 0.42}" transform="translate(0 ${reached ? 0 : 10})">
        <rect x="${x - 115}" y="${y - 61}" width="230" height="76" rx="22" fill="${reached ? "#1C3027" : "#17221D"}" stroke="${reached ? "#78D6B0" : "#384B40"}" stroke-width="2"/>
        ${text(value, x, y - 13, { size: 26, color: reached ? WHITE : MUTED, weight: 850 })}
        ${text(index === 0 ? "\u0421\u0422\u0410\u0420\u0422" : `\u041F\u0415\u0420\u0418\u041E\u0414 ${index}`, x, y + 13, { size: 13, color: "#D0B378", weight: 750, letterSpacing: 1 })}
      </g>`;
  }).join("")}
    ${text(beat.subtitle.length < 52 ? beat.subtitle : "\u041F\u0440\u043E\u0446\u0435\u043D\u0442\u044B \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043A \u043A\u0430\u043F\u0438\u0442\u0430\u043B\u0443", 540, 1210, { size: 25, color: WHITE, weight: 700 })}
    ${text("\u0423\u0421\u041B\u041E\u0412\u041D\u042B\u0419 \u041F\u0420\u0418\u041C\u0415\u0420 \xB7 \u041D\u0415 \u041F\u0420\u041E\u0413\u041D\u041E\u0417 \u0414\u041E\u0425\u041E\u0414\u041D\u041E\u0421\u0422\u0418", 540, 1270, { size: 17, color: "#C9C1B3", weight: 700, letterSpacing: 1 })}`;
}
function comparisonVisual(beat, progress, timeMs) {
  const reveal = ease2(clamp2(progress * 1.8));
  const leftScale = 0.94 + Math.sin(timeMs / 420) * 0.025;
  const rightScale = 0.94 + Math.sin(timeMs / 420 + Math.PI) * 0.025;
  return `${panel(90, 420, 430, 650, "#122033", "#5DC7FF")}
    ${panel(560, 420, 430, 650, "#241D31", "#C795FF")}
    <g opacity="${reveal}" transform="translate(305 710) scale(${leftScale})">
      ${text("\u0421\u0426\u0415\u041D\u0410\u0420\u0418\u0419 A", 0, -120, { size: 22, color: "#7ED8FF", weight: 800, letterSpacing: 1 })}
      ${text("\u0426\u0415\u041D\u0410 \u0420\u0410\u0421\u0422\u0401\u0422", 0, -18, { size: 30, color: WHITE, weight: 900 })}
      <path d="M-120 100 L-55 45 L10 65 L120 -75" fill="none" stroke="#7ED8FF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12" stroke-dashoffset="${-Math.round(timeMs / 5)}"/>
      ${text("+", 0, 160, { size: 38, color: "#7ED8FF", weight: 900 })}
    </g>
    <g opacity="${reveal}" transform="translate(775 710) scale(${rightScale})">
      ${text("\u0421\u0426\u0415\u041D\u0410\u0420\u0418\u0419 B", 0, -120, { size: 22, color: "#C795FF", weight: 800, letterSpacing: 1 })}
      ${text("\u0426\u0415\u041D\u0410 \u041F\u0410\u0414\u0410\u0415\u0422", 0, -18, { size: 30, color: WHITE, weight: 900 })}
      <path d="M-120 -75 L-55 35 L10 0 L120 100" fill="none" stroke="#C795FF" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="18 12" stroke-dashoffset="${Math.round(timeMs / 5)}"/>
      ${text("\u2212", 0, 160, { size: 38, color: "#C795FF", weight: 900 })}
    </g>
    ${text(beat.metricLabel ?? "\u0414\u0412\u0410 \u0420\u0415\u0417\u0423\u041B\u042C\u0422\u0410\u0422\u0410", 540, 1160, { size: 27, color: WHITE, weight: 800 })}`;
}
function riskVisual(beat, progress, timeMs) {
  const reveal = ease2(clamp2(progress * 1.8));
  const level = 0.28 + 0.42 * (0.5 + Math.sin(timeMs / 700) * 0.5);
  const markerX = 220 + 640 * level;
  return `${panel(120, 420, 840, 660, "#1E1823", "#FFB86B")}
    ${text("\u041B\u0410\u0411\u041E\u0420\u0410\u0422\u041E\u0420\u0418\u042F \u0420\u0418\u0421\u041A\u0410", 540, 515, { size: 24, color: "#FFB86B", weight: 800, letterSpacing: 2 })}
    ${text("\u0414\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C", 210, 690, { size: 23, color: MUTED, weight: 700, anchor: "start" })}
    <rect x="210" y="735" width="660" height="38" rx="19" fill="#293442"/>
    <rect x="210" y="735" width="${660 * level * reveal}" height="38" rx="19" fill="#FFB86B" opacity=".9"/>
    <circle cx="${markerX}" cy="754" r="${18 + Math.sin(timeMs / 170) * 3}" fill="#FFF2D7" stroke="#FFB86B" stroke-width="5"/>
    ${text("\u041D\u0438\u0437\u043A\u0438\u0439 \u0440\u0438\u0441\u043A", 210, 850, { size: 21, color: "#7ED8FF", weight: 700, anchor: "start" })}
    ${text("\u0412\u044B\u0441\u043E\u043A\u0438\u0439 \u0440\u0438\u0441\u043A", 870, 850, { size: 21, color: "#FF8D8D", weight: 700, anchor: "end" })}
    ${text(beat.metricLabel ?? "\u041F\u0420\u041E\u0412\u0415\u0420\u042C \u041E\u0413\u0420\u0410\u041D\u0418\u0427\u0415\u041D\u0418\u042F", 540, 1015, { size: 28, color: WHITE, weight: 800 })}
    ${text("\u0411\u043E\u043B\u044C\u0448\u0435 \u043F\u043E\u0442\u0435\u043D\u0446\u0438\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u2014 \u0432\u044B\u0448\u0435 \u0446\u0435\u043D\u0430 \u043E\u0448\u0438\u0431\u043A\u0438", 540, 1165, { size: 25, color: GOLD, weight: 700 })}`;
}
function sceneHueRotation(beat) {
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
var CAMERA_FOCAL_POINTS = {
  top_left: { x: 352, y: 325 },
  top_center: { x: 540, y: 322 },
  top_right: { x: 728, y: 325 },
  center_left: { x: 352, y: 510 },
  center: { x: 540, y: 510 },
  center_right: { x: 728, y: 510 },
  hero: { x: 540, y: 438 }
};
function cameraFocalPoint(position) {
  return position ? CAMERA_FOCAL_POINTS[position] : { x: 540, y: 486 };
}
function defaultCameraActionForVisual(visual, beatIndex = 0) {
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
function renderTransitionSweep(progress, accent, transition) {
  if (transition === "cut") return "";
  const reveal = ease2(clamp2(progress / 0.08));
  const opacity = 0.28 * (1 - reveal);
  if (transition === "light_flash") {
    const flash = Math.sin(Math.PI * clamp2(progress / 0.12));
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
    const y = -180 + reveal * 1820;
    return `<rect x="0" y="${y.toFixed(1)}" width="${WIDTH}" height="130" fill="${accent}" opacity="${opacity.toFixed(3)}" pointer-events="none"/>`;
  }
  const x = -210 + reveal * 1470;
  return `<rect x="${x.toFixed(1)}" y="190" width="190" height="1280" fill="${accent}" opacity="${opacity.toFixed(3)}" transform="skewX(-12)" pointer-events="none"/>`;
}
function renderSceneMotion(beat, progress, timeMs, premiumCreator = false) {
  const phase = timeMs / 420;
  const motionColor = beat.visual === "payoff" ? "#C795FF" : beat.visual === "leverage" ? "#FFB86B" : "#7ED8FF";
  if (premiumCreator) {
    const sweepX2 = 470 + timeMs / 5 % 520;
    const glowY = 450 + (Math.round(timeMs / 7) + 310) % 560;
    const opacity = 0.08 + ease2(progress * 1.6) * 0.055;
    return `<g pointer-events="none" opacity="${opacity.toFixed(3)}">
      <path d="M${sweepX2.toFixed(1)} 410V1090" stroke="${motionColor}" stroke-width="2" opacity=".48"/>
      <circle cx="${sweepX2.toFixed(1)}" cy="${glowY}" r="7" fill="${motionColor}" opacity=".56"/>
      <path d="M${(sweepX2 - 20).toFixed(1)} ${glowY}H${(sweepX2 + 20).toFixed(1)}" stroke="${motionColor}" stroke-width="2" opacity=".42"/>
    </g>`;
  }
  const sweepX = 150 + timeMs / 5 % 780;
  const ringScale = 1 + Math.sin(phase) * 0.08;
  return `<g pointer-events="none" opacity=".5">
    <circle cx="540" cy="760" r="${300 * ringScale}" fill="none" stroke="${motionColor}" stroke-width="2" stroke-dasharray="5 30" stroke-dashoffset="${-Math.round(timeMs / 4)}"/>
    <circle cx="540" cy="760" r="${350 - Math.sin(phase * 0.7) * 18}" fill="none" stroke="${motionColor}" stroke-width="2" stroke-dasharray="2 46" stroke-dashoffset="${Math.round(timeMs / 6)}" opacity=".45"/>
    <line x1="${sweepX}" y1="300" x2="${sweepX}" y2="1210" stroke="${motionColor}" stroke-width="4" opacity=".12"/>
    ${Array.from({ length: 8 }, (_, index) => {
    const x = 160 + index * 108 + Math.sin(phase + index) * 16;
    const y = 420 + (index * 93 + Math.round(timeMs / 3)) % 660;
    return `<circle cx="${x}" cy="${y}" r="${3 + index % 3 * 2}" fill="${motionColor}" opacity="${0.18 + index % 4 * 0.08}"/>`;
  }).join("")}
  </g>`;
}
var FINANCIAL_STICKER_LIBRARY = [
  { pattern: /dual\s*asset|dualasset|бивалют|двухвалют|две валюты/iu, symbol: "dual_asset", glyph: "\u21C4", caption: "Dual Asset", motion: "swap", priority: 145 },
  { pattern: /bybit|байбит/iu, symbol: "exchange", glyph: "B", caption: "Bybit", motion: "swap", priority: 138 },
  { pattern: /валютн.{0,10}рис|currency risk/iu, symbol: "risk", glyph: "!", caption: "\u0412\u0430\u043B\u044E\u0442\u043D\u044B\u0439 \u0440\u0438\u0441\u043A", motion: "shake", priority: 139 },
  { pattern: /не гарант|без гаранти/iu, symbol: "risk", glyph: "!", caption: "\u041D\u0435\u0442 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0438", motion: "shake", priority: 137 },
  { pattern: /не дости|не достиг|ниже.{0,12}целев|не дош[её]л|не косн[её]т/iu, symbol: "target", glyph: "\u2198", caption: "\u0426\u0435\u043D\u0430 \u043D\u0438\u0436\u0435 \u0446\u0435\u043B\u0438", motion: "near_miss", priority: 135 },
  { pattern: /куда.{0,24}цен|не зна.{0,30}цен|направлен.{0,12}цен|цен.{0,20}(?:колеб|неопредел|меня|движ)/iu, symbol: "price_chart", glyph: "\u2195", caption: "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0446\u0435\u043D\u044B", motion: "price_wave", priority: 134 },
  { pattern: /цен.{0,28}(?:раст|вверх|выраст).{0,24}(?:пад|вниз|сниж)|(?:раст|вверх).{0,24}цен.{0,28}(?:пад|вниз|сниж)/iu, symbol: "price_chart", glyph: "\u2195", caption: "\u0426\u0435\u043D\u0430 \u043C\u043E\u0436\u0435\u0442 \u043A\u043E\u043B\u0435\u0431\u0430\u0442\u044C\u0441\u044F", motion: "price_wave", priority: 134 },
  { pattern: /цен.{0,16}(?:раст|вверх|выраст|поднима)|(?:вверх|рост|раст|поднима).{0,16}цен/iu, symbol: "price_chart", glyph: "\u2197", caption: "\u0426\u0435\u043D\u0430 \u0432\u0432\u0435\u0440\u0445", motion: "price_up", priority: 133 },
  { pattern: /цен.{0,16}(?:пада|сниж|вниз|опуска)|(?:вниз|паден|пада|снижен|опуска).{0,16}цен/iu, symbol: "price_chart", glyph: "\u2198", caption: "\u0426\u0435\u043D\u0430 \u0432\u043D\u0438\u0437", motion: "price_down", priority: 133 },
  { pattern: /достига|достигнут|достигнет|цель достигнута/iu, symbol: "target", glyph: "\u2713", caption: "\u0426\u0435\u043B\u044C \u0434\u043E\u0441\u0442\u0438\u0433\u043D\u0443\u0442\u0430", motion: "target_hit", priority: 130 },
  { pattern: /целев.{0,18}цен|target price/iu, symbol: "target", glyph: "\u25CE", caption: "\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u0446\u0435\u043D\u0430", motion: "target_hit", priority: 126 },
  { pattern: /конвертир|конвертац|обмен.{0,15}на|меняет.{0,15}актив|convert|conversion/iu, symbol: "exchange", glyph: "\u21C4", caption: "\u041A\u043E\u043D\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u044F", motion: "swap", priority: 122 },
  { pattern: /повышенн.{0,15}доходност|доходност|получа.{0,16}доход|доход в|yield|return/iu, symbol: "cash", glyph: "+", caption: "\u0414\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C", motion: "yield", priority: 116 },
  { pattern: /следующ.{0,12}видео|смотри.{0,12}видео|нов.{0,12}ролик|next video|subscribe/iu, symbol: "play", glyph: "\u25B6", caption: "\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0435 \u0432\u0438\u0434\u0435\u043E", motion: "play", priority: 115 },
  { pattern: /сумм|размер влож|amount|выбираешь.{0,12}сколько/iu, symbol: "number", glyph: "#", caption: "\u0421\u0443\u043C\u043C\u0430", motion: "pulse", priority: 90 },
  { pattern: /bitcoin|биткоин|биткойн|\bbtc\b/iu, symbol: "bitcoin", glyph: "\u20BF", caption: "Bitcoin", motion: "spin", priority: 112 },
  { pattern: /ethereum|эфириум|эфир|\beth\b/iu, symbol: "ethereum", glyph: "\u039E", caption: "Ethereum", motion: "spin", priority: 108 },
  { pattern: /solana|солан|cardano|кардан|toncoin|\bton\b/iu, symbol: "network", glyph: "\u25CE", caption: "\u041A\u0440\u0438\u043F\u0442\u043E\u0430\u043A\u0442\u0438\u0432", motion: "pulse", priority: 100 },
  { pattern: /nft|нфт|токенизац|цифровое искусство/iu, symbol: "contract", glyph: "\u25C8", caption: "NFT", motion: "float", priority: 96 },
  { pattern: /криптовалют|альткоин|токен|монет|altcoin|coin/iu, symbol: "coin", glyph: "\u25C8" },
  { pattern: /смарт.?контракт|smart.?contract|контракт/iu, symbol: "contract", glyph: "\xA7" },
  { pattern: /стейблкоин|stablecoin|usdt|usdc|tether|тейтер/iu, symbol: "cash", glyph: "$" },
  { pattern: /кошел|wallet|seed.?phrase|сид.?фраз|приватн.*ключ/iu, symbol: "wallet", glyph: "\u25A3", caption: "\u041A\u043E\u0448\u0435\u043B\u0451\u043A", motion: "float", priority: 88 },
  { pattern: /бирж|exchange|обменник|торговая площадка/iu, symbol: "exchange", glyph: "\u21C4", caption: "\u0411\u0438\u0440\u0436\u0430", motion: "swap", priority: 86 },
  { pattern: /блокчейн|blockchain|валидатор|узел сети|нода|сет[ьи]|сетей|сетев|network/iu, symbol: "network", glyph: "\u26D3" },
  { pattern: /майнинг|майнер|добыч[аи]|хешрейт|mining/iu, symbol: "machine", glyph: "\u2699" },
  { pattern: /стейкинг|staking|валидатор|делегирован/iu, symbol: "coin", glyph: "\u25C8" },
  { pattern: /defi|дефи|ликвидност|пул ликвидности/iu, symbol: "transfer", glyph: "\u2194" },
  { pattern: /газ|комисси|сбор|fee|network fee/iu, symbol: "tax", glyph: "%" },
  { pattern: /халвинг|halving|эмисси|выпуск монет|предложение монет/iu, symbol: "coin", glyph: "\u20BF" },
  { pattern: /лимит|ограничен|правил|протокол|обновлен|верси/iu, symbol: "protocol", glyph: "\u2713" },
  { pattern: /взлом|хакер|мошенн|безопас|защит|риск|угроз|потер|волатил/iu, symbol: "risk", glyph: "!" },
  { pattern: /акци|доля|эмитент|компани|бизнес/iu, symbol: "portfolio", glyph: "\u25A3" },
  { pattern: /дивиденд|выплат акционер|распределен прибыли/iu, symbol: "cash", glyph: "$" },
  { pattern: /облигац|купон|погашен|номинал|госдолг/iu, symbol: "contract", glyph: "\xA7" },
  { pattern: /брокер|счёт инвест|счет инвест|депозитар|биржевой счет/iu, symbol: "portfolio", glyph: "\u25A3" },
  { pattern: /банк|банков|вклад|депозит|сбережен/iu, symbol: "bank", glyph: "\u2302" },
  { pattern: /кредит|заём|заем|долг|ипотек|займ/iu, symbol: "bank", glyph: "\u20BD" },
  { pattern: /налог|ндфл|вычет|декларац|квитанц/iu, symbol: "tax", glyph: "%" },
  { pattern: /бюджет|расход|трата|затрат|себестоим|смета/iu, symbol: "cash", glyph: "\u20BD" },
  { pattern: /платеж|оплат|перевод|транзакц|покупк|продаж/iu, symbol: "transfer", glyph: "\u2194" },
  { pattern: /доход|прибыл|выручк|заработ|дивиденд|купонный поток/iu, symbol: "cash", glyph: "+" },
  { pattern: /процент|ставк|доходност|инфляц|индексац/iu, symbol: "number", glyph: "%" },
  { pattern: /портфел|инвест|актив|капитал|фонд|накоплен/iu, symbol: "portfolio", glyph: "\u25A3" },
  { pattern: /рынок|цена|стоимост|спрос|предложен|курс/iu, symbol: "coin", glyph: "\u20BD" },
  { pattern: /рост|выраст|поднял|увелич|масштаб|ускор/iu, symbol: "rocket", glyph: "\u2197" },
  { pattern: /паден|сниз|сокращ|убыт|просад|минус/iu, symbol: "risk", glyph: "!" },
  { pattern: /сравнен|выгодн|лучше|хуже|разниц|вместо|однако/iu, symbol: "comparison", glyph: "\u2194" },
  { pattern: /автомат|алгоритм|механизм|робот|процесс|систем/iu, symbol: "machine", glyph: "\u2699" },
  { pattern: /срок|дата|период|месяц|год|календар|погашен/iu, symbol: "calendar", glyph: "\u25F7" },
  { pattern: /цель|план|стратег|ориентир|показател|метрик/iu, symbol: "target", glyph: "\u25CE" },
  { pattern: /страхов|гаранти|резерв|подушк|защит/iu, symbol: "savings", glyph: "\u2713" },
  { pattern: /подпис|лайк|коммент|сообщ|чат|напиши|cta/iu, symbol: "speech", glyph: "\u2026" },
  { pattern: /подар|бонус|награ|кэшбек|кешбек/iu, symbol: "coin", glyph: "+" },
  { pattern: /срочн|быстро|мгновен|скорост|времени нет/iu, symbol: "lightning", glyph: "\u26A1" },
  { pattern: /цен[ауы]?|price|курс/iu, symbol: "price_chart", glyph: "\u2195", caption: "\u0426\u0435\u043D\u0430", motion: "price_wave", priority: 82 }
];
var FINANCIAL_STICKER_FALLBACKS = [
  { pattern: /./u, symbol: "coin", glyph: "\u20BD" },
  { pattern: /./u, symbol: "transfer", glyph: "\u2194" },
  { pattern: /./u, symbol: "portfolio", glyph: "\u25A3" },
  { pattern: /./u, symbol: "document", glyph: "\u2713" }
];
function financialStickerStylesForText(cue, context, index) {
  const normalizedCue = cue.toLocaleLowerCase("ru-RU");
  const normalizedContext = context.toLocaleLowerCase("ru-RU");
  const direct = FINANCIAL_STICKER_LIBRARY.filter((rule) => rule.pattern.test(normalizedCue)).map((rule) => ({ rule, direct: true }));
  const contextual = normalizedContext === normalizedCue ? [] : FINANCIAL_STICKER_LIBRARY.filter((rule) => rule.pattern.test(normalizedContext)).map((rule) => ({ rule, direct: false }));
  const matches = [...direct, ...contextual].sort((first, second) => Number(second.direct) - Number(first.direct) || (second.rule.priority ?? 40) - (first.rule.priority ?? 40));
  const selected = [];
  const selectedSymbols = /* @__PURE__ */ new Set();
  for (const { rule } of matches) {
    if (selectedSymbols.has(rule.symbol)) continue;
    selected.push(rule);
    selectedSymbols.add(rule.symbol);
    if (selected.length === 2) return selected;
  }
  if (selected.length) return selected;
  const seed = [...`${normalizedCue}:${index}`].reduce((sum, character) => sum + character.codePointAt(0), 0);
  return [FINANCIAL_STICKER_FALLBACKS[seed % FINANCIAL_STICKER_FALLBACKS.length]];
}
function renderFinancialStickerArtwork(symbol, centerX, centerY, motion, timeMs, eventProgress) {
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
        ${text("\xA2", centerX, centerY + 17, { size: 57, color: "#FFF9EC", weight: 900 })}`;
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
      const path = motion === "price_up" ? `M${centerX - 55} ${centerY + 28}L${centerX - 25} ${centerY + 8}L${centerX - 4} ${centerY + 17}L${centerX + 20} ${centerY - 15}L${centerX + 53} ${centerY - 39}` : motion === "price_down" ? `M${centerX - 55} ${centerY - 33}L${centerX - 25} ${centerY - 9}L${centerX - 4} ${centerY - 21}L${centerX + 20} ${centerY + 13}L${centerX + 53} ${centerY + 38}` : `M${centerX - 55} ${centerY + 11}L${centerX - 30} ${centerY - 17}L${centerX - 8} ${centerY + 22}L${centerX + 16} ${centerY - 24}L${centerX + 37} ${centerY + 8}L${centerX + 55} ${centerY - 7}`;
      const endY = motion === "price_up" ? centerY - 39 : motion === "price_down" ? centerY + 38 : centerY - 7;
      const reveal = ease2(clamp2(eventProgress / 0.58));
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
      const ripple = 58 + timeMs % 720 / 24;
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
function renderFinancialStickerOverlay(symbol, glyph, centerX, centerY, timeMs, captionLabel, motion, eventProgress) {
  const label = captionLabel.replace(/\s+/gu, " ").trim();
  const pillWidth = Math.min(360, Math.max(280, label.length * 11 + 90));
  const pillX = centerX - pillWidth / 2;
  const bob = motion === "play" ? -Math.abs(Math.sin(timeMs / 150)) * 8 : motion === "yield" ? Math.sin(timeMs / 145) * 4 : Math.sin(timeMs / 175) * 2.5;
  const iconX = centerX;
  const iconY = centerY - 95 + bob;
  const pillY = centerY + 70 + bob;
  const enterScale = 0.9 + 0.1 * ease2(clamp2(eventProgress / 0.24));
  const iconScale = 2.45 * enterScale;
  const fontSize = Math.max(15, Math.min(24, (pillWidth - 56) / Math.max(1, label.length * 0.6)));
  const palette = {
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
    play: "#D9504C"
  };
  const pulse = motion === "yield" || motion === "play" ? 1 + Math.sin(timeMs / 120) * 0.035 : 1 + Math.sin(timeMs / 145) * 0.02;
  const rotation = motion === "shake" ? Math.sin(timeMs / 42) * 2.4 : motion === "spin" || motion === "swap" ? Math.sin(timeMs / (motion === "spin" ? 155 : 135)) * 5 : Math.sin(timeMs / 260) * 1.5;
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
var STICKER_CAPTION_STOP_WORDS = /* @__PURE__ */ new Set([
  "\u0430",
  "\u0431\u0435\u0437",
  "\u0431\u044B",
  "\u0432",
  "\u0432\u043E",
  "\u0432\u043E\u0442",
  "\u0434\u043B\u044F",
  "\u0434\u043E",
  "\u0435\u0441\u043B\u0438",
  "\u0435\u0441\u0442\u044C",
  "\u0437\u0430",
  "\u0438",
  "\u0438\u0437",
  "\u0438\u043B\u0438",
  "\u043A\u0430\u043A",
  "\u043A",
  "\u043A\u043E\u0433\u0434\u0430",
  "\u043B\u0438",
  "\u043D\u0430",
  "\u043D\u0430\u0434",
  "\u043D\u043E",
  "\u043E",
  "\u043E\u0431",
  "\u043E\u0442",
  "\u043F\u043E",
  "\u043F\u043E\u0434",
  "\u043F\u0440\u0438",
  "\u043F\u0440\u043E",
  "\u0440\u0430\u0437",
  "\u0441",
  "\u0441\u043E",
  "\u0442\u0430\u043A",
  "\u0442\u043E\u0436\u0435",
  "\u0443",
  "\u044D\u0442\u043E",
  "\u044D\u0442\u043E\u0442",
  "\u044D\u0442\u0430",
  "\u044D\u0442\u0438",
  "\u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E",
  "\u043A\u0430\u0436\u0434\u044B\u0439",
  "\u043A\u0430\u0436\u0434\u0430\u044F",
  "\u043A\u0430\u0436\u0434\u043E\u0435",
  "\u043A\u0430\u0436\u0434\u044B\u0435",
  "\u043D\u043E\u0432\u044B\u0435",
  "\u043D\u043E\u0432\u044B\u0439",
  "\u043D\u043E\u0432\u0430\u044F",
  "\u043D\u043E\u0432\u043E\u0435",
  "\u043D\u043E\u0432\u044B\u0445",
  "\u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0439",
  "\u043D\u0430\u0439\u0434\u0435\u043D\u043D\u0430\u044F",
  "\u043D\u0430\u0439\u0434\u0435\u043D\u043D\u043E\u0435",
  "\u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0435",
  "\u0441\u0430\u043C\u043E",
  "\u0441\u0430\u043C\u0430",
  "\u0441\u0435\u0431\u0435",
  "\u0431\u044B\u0442\u044C",
  "\u0431\u0443\u0434\u0435\u0442",
  "\u0431\u0443\u0434\u0443\u0442",
  "\u0431\u044B\u043B\u0438",
  "\u0431\u044B\u043B\u043E",
  "\u0432\u0441\u0435\u0433\u043E",
  "\u0432\u0440\u043E\u0434\u0435",
  "\u0432\u044B",
  "\u0434\u0430",
  "\u0434\u0430\u0436\u0435",
  "\u0434\u0435\u043B\u043E",
  "\u0434\u043E\u043B\u0436\u0435\u043D",
  "\u0434\u043E\u043B\u0436\u043D\u0430",
  "\u0434\u043E\u043B\u0436\u043D\u044B",
  "\u0435\u0441\u043B\u0438",
  "\u0437\u0434\u0435\u0441\u044C",
  "\u0437\u0430\u0442\u0435\u043C",
  "\u0437\u043D\u0430\u0447\u0438\u0442",
  "\u0438\u043C\u0435\u043D\u043D\u043E",
  "\u0438\u0445",
  "\u043A\u043E\u0442\u043E\u0440\u044B\u0439",
  "\u043A\u043E\u0442\u043E\u0440\u0430\u044F",
  "\u043A\u043E\u0442\u043E\u0440\u044B\u0435",
  "\u043C\u043E\u0436\u0435\u0442",
  "\u043C\u043E\u0436\u043D\u043E",
  "\u043C\u044B",
  "\u043D\u0430\u0434\u043E",
  "\u043D\u0430\u043C",
  "\u043D\u0430\u0448",
  "\u043D\u0430\u0448\u0430",
  "\u043D\u0430\u0448\u0438",
  "\u043D\u0435\u0442",
  "\u043E\u043D\u043E",
  "\u043E\u043D\u0438",
  "\u043E\u0447\u0435\u043D\u044C",
  "\u043F\u043E\u043A\u0430",
  "\u043F\u043E\u0442\u043E\u043C\u0443",
  "\u043F\u043E\u0447\u0442\u0438",
  "\u043F\u0440\u043E\u0441\u0442\u043E",
  "\u0441\u0430\u043C",
  "\u0441\u0432\u043E\u0439",
  "\u0441\u0432\u043E\u0438",
  "\u0441\u0435\u0439\u0447\u0430\u0441",
  "\u0442\u0430\u043A\u043E\u0439",
  "\u0442\u0430\u043A\u0430\u044F",
  "\u0442\u0430\u043A\u0438\u0435",
  "\u0442\u043E\u0433\u0434\u0430",
  "\u0442\u0443\u0442",
  "\u0443\u0436\u0435",
  "\u0447\u0442\u043E\u0431\u044B",
  "\u044D\u0442\u043E",
  "\u044D\u0442\u043E\u0433\u043E",
  "\u044D\u0442\u043E\u0439",
  "\u043F\u043E\u043B\u0443\u0447\u0430\u0442\u044C",
  "\u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442",
  "\u043F\u043E\u043B\u0443\u0447\u0430\u044E\u0442",
  "\u043F\u043E\u043B\u0443\u0447\u0438\u0448\u044C",
  "\u043C\u043E\u0436\u0435\u0448\u044C",
  "\u043C\u043E\u0436\u043D\u043E",
  "\u0431\u0443\u0434\u0435\u0442",
  "\u0431\u0443\u0434\u0443\u0442",
  "\u043F\u043E\u0439\u0434\u0451\u0442",
  "\u043F\u043E\u0439\u0434\u0435\u0442",
  "\u0434\u0432\u0438\u0436\u0435\u0442\u0441\u044F",
  "\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F",
  "\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F",
  "\u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u044C"
]);
function financialStickerWordRanges(words) {
  const sentences = [];
  let sentenceStart = 0;
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    const nextWord = words[index + 1];
    const endsWithSentencePunctuation = /[!?…]/u.test(word.punctuation) || /\./u.test(word.punctuation) && (!nextWord || /^\p{Lu}/u.test(nextWord.word) || !/\d/u.test(word.word));
    if (endsWithSentencePunctuation) {
      sentences.push({ start: sentenceStart, end: index });
      sentenceStart = index + 1;
    }
  }
  if (sentenceStart < words.length) sentences.push({ start: sentenceStart, end: words.length - 1 });
  const ranges = [];
  for (const sentence of sentences) {
    let clauseStart = sentence.start;
    for (let index = sentence.start; index <= sentence.end; index += 1) {
      const word = words[index];
      const clauseBreak = index < sentence.end && /[,;:]/u.test(word.punctuation) && !/\d/u.test(word.word);
      if (clauseBreak) {
        if (clauseStart <= index) {
          ranges.push({
            start: clauseStart,
            end: index,
            sentenceStart: sentence.start,
            sentenceEnd: sentence.end
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
        sentenceEnd: sentence.end
      });
    }
  }
  return ranges;
}
function financialStickerRuleWordRange(words, rule) {
  for (let start = 0; start < words.length; start += 1) {
    const maxEnd = Math.min(words.length - 1, start + 7);
    for (let end = start; end <= maxEnd; end += 1) {
      const phrase = words.slice(start, end + 1).map((word) => word.word).join(" ");
      if (rule.pattern.test(phrase)) return { first: words[start], last: words[end] };
    }
  }
  return void 0;
}
function financialStickerCaption(rule, cue) {
  if (rule.caption) return rule.caption.slice(0, 32);
  const defaultCaptions = {
    bitcoin: "Bitcoin",
    ethereum: "Ethereum",
    coin: "\u041A\u0440\u0438\u043F\u0442\u043E\u0430\u043A\u0442\u0438\u0432",
    cash: "\u0414\u043E\u0445\u043E\u0434",
    bank: "\u0411\u0430\u043D\u043A",
    wallet: "\u041A\u043E\u0448\u0435\u043B\u0451\u043A",
    network: "\u0421\u0435\u0442\u044C",
    exchange: "\u041E\u0431\u043C\u0435\u043D",
    risk: "\u0420\u0438\u0441\u043A",
    target: "\u0426\u0435\u043B\u044C",
    price_chart: "\u0426\u0435\u043D\u0430",
    dual_asset: "Dual Asset",
    play: "\u0421\u043C\u043E\u0442\u0440\u0438 \u0434\u0430\u043B\u044C\u0448\u0435"
  };
  const words = getSpeechWordTimings(cue).words.filter((word) => (word.normalized.length > 2 || /\d/u.test(word.normalized)) && !STICKER_CAPTION_STOP_WORDS.has(word.normalized));
  const label = words.slice(0, 3).map((word) => word.word).join(" ");
  return (label || defaultCaptions[rule.symbol] || rule.glyph).slice(0, 32);
}
function financialStickerMotion(rule) {
  if (rule.motion) return rule.motion;
  if (rule.symbol === "bitcoin" || rule.symbol === "ethereum" || rule.symbol === "coin") return "spin";
  if (rule.symbol === "risk") return "shake";
  if (rule.symbol === "cash") return "yield";
  if (rule.symbol === "exchange" || rule.symbol === "dual_asset") return "swap";
  return "float";
}
function financialStickerRailEvents(beats, durationMs2) {
  const selected = [];
  for (const [beatIndex, beat] of beats.entries()) {
    const sceneDurationMs = Math.max(0, (beat.to - beat.from) * durationMs2);
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
        rangeIndex
      );
      const sceneStartMs = beat.from * durationMs2;
      for (const style of styles) {
        const matchedRange = financialStickerRuleWordRange(clauseWords, style);
        const first = matchedRange?.first ?? clauseWords[0];
        const last = matchedRange?.last ?? clauseWords.at(-1);
        const startMs = sceneStartMs + sceneDurationMs * clamp2(first.start / totalWeight);
        const endMs = sceneStartMs + sceneDurationMs * clamp2(last.end / totalWeight);
        const caption = financialStickerCaption(style, cue);
        if (!caption) continue;
        selected.push({
          beatIndex,
          startMs,
          endMs: Math.max(startMs + 240, endMs),
          caption,
          symbol: style.symbol,
          glyph: style.glyph,
          motion: financialStickerMotion(style)
        });
      }
    }
  }
  const ordered = selected.sort((first, second) => first.startMs - second.startMs).filter((event, index, events) => {
    const previous = events[index - 1];
    return !previous || event.caption.toLocaleLowerCase("ru-RU") !== previous.caption.toLocaleLowerCase("ru-RU") || event.symbol !== previous.symbol || event.startMs - previous.startMs >= 1100;
  });
  return ordered.map((event, index) => {
    const next = ordered[index + 1];
    const naturalEnd = event.endMs + 240;
    const nextTransitionEnd = next ? next.startMs + 180 : event.startMs + 720;
    return {
      ...event,
      displayUntilMs: Math.max(
        event.endMs,
        Math.min(Math.max(naturalEnd, nextTransitionEnd), event.startMs + 1800)
      )
    };
  });
}
function renderFinancialStickerRail(beats, durationMs2, timeMs, layout) {
  const events = financialStickerRailEvents(beats, durationMs2);
  const started = events.filter((event) => event.startMs <= timeMs && event.displayUntilMs >= timeMs);
  const visible = started.slice(-2);
  if (!visible.length) return "";
  const latest = visible.at(-1);
  const enterProgress = ease2(clamp2((timeMs - latest.startMs) / 240));
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
      const settle = ease2(clamp2((timeMs - event.endMs) / 240));
      x = 740 + (540 - 740) * settle;
    }
    const fadeStartMs = event.displayUntilMs - 180;
    const leave = 1 - ease2(clamp2((timeMs - fadeStartMs) / 180));
    const opacity = clamp2(enter * leave);
    const positionScale = scale * (0.985 + Math.sin(timeMs / 300 + slotIndex) * 0.015);
    const eventProgress = clamp2((timeMs - event.startMs) / Math.max(1, event.endMs - event.startMs));
    return `<g pointer-events="none" opacity="${opacity.toFixed(3)}" transform="translate(${x.toFixed(1)} ${rowY}) scale(${positionScale.toFixed(3)}) translate(${-x.toFixed(1)} ${-rowY})">
      ${renderFinancialStickerOverlay(event.symbol, event.glyph, x, rowY, timeMs, event.caption, event.motion, eventProgress)}
    </g>`;
  }).join("");
  return output ? `<g pointer-events="none">${output}</g>` : "";
}
function cryptoF2MomentPoint(position) {
  return {
    top_left: { x: 330, y: 650 },
    top_center: { x: 540, y: 560 },
    top_right: { x: 750, y: 650 },
    center_left: { x: 335, y: 790 },
    center: { x: 540, y: 700 },
    center_right: { x: 745, y: 790 },
    hero: { x: 540, y: 660 }
  }[position];
}
function renderCryptoF2Motif(motif, x, y, size, timeMs, variant = 0) {
  const scale = size / 220;
  const mint = "#9AE8BD";
  const warm = "#F2C782";
  const phase = timeMs / 720 + variant * 0.71;
  const rotation = Math.sin(phase * 0.62) * 3;
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
        <circle r="55" fill="none" stroke="${warm}" stroke-width="3" stroke-dasharray="10 11" stroke-dashoffset="${(-phase * 11).toFixed(1)}"/>
        <path d="M-48 -25Q0 -77 48 -25Q79 0 47 33Q0 77 -48 31Q-77 0 -48 -25Z" fill="none" stroke="${mint}" stroke-width="5"/>
        <circle r="15" fill="${warm}" opacity=".95"/>`;
      break;
  }
  return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)}) rotate(${rotation.toFixed(2)})">
    <circle r="106" fill="${mint}" opacity=".045" filter="url(#soft-glow)"/>
    <circle r="101" fill="none" stroke="${mint}" stroke-width="2" stroke-dasharray="4 17" stroke-dashoffset="${(-phase * 13).toFixed(1)}" opacity=".28"/>
    ${form}
  </g>`;
}
function renderCryptoF2Action(moment, x, y, progress, timeMs) {
  const action = moment.motionAction ?? "pulse";
  const variant = moment.motionVariant ?? 0;
  const phase = timeMs / 260 + variant;
  const pulse = 1 + Math.sin(phase) * 0.08;
  const mint = "#9AE8BD";
  const warm = "#F2C782";
  const orbitX = 185 + variant % 4 * 13;
  const flowX = x - orbitX + 2 * orbitX * clamp2(progress);
  if (action === "flow" || action === "transfer") {
    return `<path d="M${(x - orbitX).toFixed(1)} ${(y + 18).toFixed(1)}C${(x - 95).toFixed(1)} ${(y - 92).toFixed(1)} ${(x + 95).toFixed(1)} ${(y + 92).toFixed(1)} ${(x + orbitX).toFixed(1)} ${(y - 18).toFixed(1)}" fill="none" stroke="${mint}" stroke-width="4" stroke-dasharray="8 15" opacity=".65"/>
      <circle cx="${flowX.toFixed(1)}" cy="${(y + Math.sin(phase) * 34).toFixed(1)}" r="10" fill="${warm}"/>
      <circle cx="${flowX.toFixed(1)}" cy="${(y + Math.sin(phase) * 34).toFixed(1)}" r="24" fill="${warm}" opacity=".12"/>`;
  }
  if (action === "orbit") {
    return `<ellipse cx="${x}" cy="${y}" rx="${orbitX}" ry="120" fill="none" stroke="${mint}" stroke-width="3" stroke-dasharray="6 16" opacity=".55" transform="rotate(${(phase * 13).toFixed(1)} ${x} ${y})"/>
      <circle cx="${(x + Math.cos(phase) * orbitX).toFixed(1)}" cy="${(y + Math.sin(phase) * 120).toFixed(1)}" r="9" fill="${warm}"/>`;
  }
  if (action === "scan") {
    const scanX = x - 110 + 220 * clamp2(progress);
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
      const angle = index / 5 * Math.PI * 2 + variant;
      const distance = 142 * (1 - ease2(clamp2(progress / 0.62)));
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
    const radius = 110 + 48 * clamp2(progress);
    return `<circle cx="${x}" cy="${y}" r="${radius.toFixed(1)}" fill="none" stroke="${warm}" stroke-width="3" stroke-dasharray="10 20" stroke-dashoffset="${(-phase * 9).toFixed(1)}" opacity=".72"/>
      <path d="M${x - 110} ${y + 112}Q${x} ${(y + 112 - 40 * progress).toFixed(1)} ${x + 110} ${y + 112}" fill="none" stroke="${mint}" stroke-width="3" opacity=".6"/>`;
  }
  if (action === "pulse") {
    return `<circle cx="${x}" cy="${y}" r="${(132 * pulse).toFixed(1)}" fill="none" stroke="${warm}" stroke-width="3" opacity=".48"/>
      <circle cx="${x}" cy="${y}" r="${(156 * pulse).toFixed(1)}" fill="none" stroke="${mint}" stroke-width="2" opacity=".25"/>`;
  }
  return `<path d="M${x - 172} ${y + 132}Q${x} ${y + 176} ${x + 172} ${y + 132}" fill="none" stroke="${mint}" stroke-width="3" stroke-dasharray="4 14" opacity=".42"/>`;
}
function renderCryptoF2MicroBeat(moment, microBeat, progress, timeMs) {
  if (progress < microBeat.from || progress >= microBeat.to) return "";
  const eventProgress = clamp2((progress - microBeat.from) / Math.max(1e-3, microBeat.to - microBeat.from));
  const enter = ease2(clamp2(eventProgress / 0.24));
  const leave = microBeat.exitAnimation === "hold" ? 1 : 1 - ease2(clamp2((eventProgress - 0.76) / 0.24));
  const left = microBeat.position === "left" || microBeat.position === "upper_left";
  const x = left ? 282 : 798;
  const y = 1075 + Math.sin(timeMs / 440 + (microBeat.motionVariant ?? 0)) * 5;
  const accent = microBeat.kind === "number" ? "#F2C782" : "#9AE8BD";
  const label = microBeat.text.replace(/\s+/gu, " ").trim().slice(0, 34).toLocaleUpperCase("ru-RU");
  const variant = microBeat.motionVariant ?? 0;
  const slide = microBeat.enterAnimation === "slide_left" || microBeat.enterAnimation === "arc_left" ? -1 : microBeat.enterAnimation === "slide_right" || microBeat.enterAnimation === "arc_right" ? 1 : left ? -1 : 1;
  const offsetX = slide * (1 - enter) * 74;
  const scale = 0.76 + enter * 0.24 + Math.sin(enter * Math.PI) * (1 - enter) * 0.06;
  const icon = microBeat.kind === "number" ? `<circle cx="${x - 72}" cy="${y - 7}" r="33" fill="#302718" stroke="${accent}" stroke-width="3"/>` : `<circle cx="${x - 72}" cy="${y - 7}" r="33" fill="#152820" stroke="${accent}" stroke-width="3"/>
      <path d="M${x - 84} ${y - 7}l10 -12l18 12l-18 12Z" fill="${accent}" opacity=".78"/>`;
  const line = microBeat.kind === "arrow" ? `<path d="M${left ? x + 34 : x - 34} ${y - 7}Q540 ${y - 118} 540 795" fill="none" stroke="${accent}" stroke-width="3" stroke-dasharray="7 12" opacity=".68"/>
      <path d="M532 806L540 793L548 806" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>` : `<path d="M${left ? x - 46 : x + 46} ${y + 25}H${left ? x + 168 : x - 168}" stroke="${accent}" stroke-width="2" opacity=".38"/>`;
  const renderedText = microBeat.kind === "keyword" ? text(label, x + (left ? 40 : -40), y + 2, { size: 29, color: accent, weight: 900, anchor: left ? "start" : "end", letterSpacing: 0.5 }) : text(label, x + (left ? 40 : -40), y + 2, { size: 22, color: "#F2EBDD", weight: 750, anchor: left ? "start" : "end", letterSpacing: 0.4 });
  return `<g pointer-events="none" opacity="${(enter * leave).toFixed(3)}" transform="translate(${(x + offsetX).toFixed(1)} ${y.toFixed(1)}) scale(${scale.toFixed(3)}) translate(${-x} ${-y})">
    ${line}${microBeat.kind === "arrow" ? "" : icon}${renderedText}
    <circle cx="${left ? x - 72 : x + 72}" cy="${y - 7}" r="${(39 + Math.sin(timeMs / 210 + variant) * 3).toFixed(1)}" fill="none" stroke="${accent}" stroke-width="1.5" opacity=".23"/>
  </g>`;
}
function renderCryptoF2Moment(moment, progress, timeMs) {
  const point = cryptoF2MomentPoint(moment.position);
  const enter = ease2(clamp2(progress / 0.22));
  const exitProgress = clamp2((progress - 0.84) / 0.16);
  const exit = moment.exitAnimation === "hold" ? 0 : ease2(exitProgress);
  const variant = moment.motionVariant ?? 0;
  const animation = moment.enterAnimation;
  let xOffset = 0;
  let yOffset = Math.sin(timeMs / 440 + variant) * 5;
  let rotation = Math.sin(timeMs / 900 + variant) * 2;
  let scale = 0.72 + enter * 0.28;
  if (animation === "slide_left" || animation === "swipe" || animation === "flow_in") xOffset -= (1 - enter) * 230;
  else if (animation === "slide_right" || animation === "notification") xOffset += (1 - enter) * 230;
  else if (animation === "slide_top" || animation === "arc_top") yOffset -= (1 - enter) * 180;
  else if (animation === "slide_bottom" || animation === "arc_bottom") yOffset += (1 - enter) * 180;
  else if (animation === "arc_left") xOffset -= (1 - enter) * 180 * (variant % 2 ? -1 : 1);
  else if (animation === "arc_right") xOffset += (1 - enter) * 180 * (variant % 2 ? -1 : 1);
  else if (animation === "spiral_in" || animation === "orbit_in") rotation += (1 - enter) * (variant % 2 ? -180 : 180);
  else if (animation === "rotate_scale" || animation === "sticker_pop" || animation === "flip") rotation += (1 - enter) * (variant % 2 ? 24 : -24);
  else if (animation === "unfold_in" || animation === "split_assemble") scale *= 0.42 + enter * 0.58;
  else if (animation === "elastic_pop" || animation === "spring" || animation === "magnet_snap" || animation === "overshoot") {
    scale = 0.58 + enter * 0.42 + Math.sin(enter * Math.PI * 2) * (1 - enter) * 0.12;
  } else if (animation === "shards_in" || animation === "draw_on" || animation === "mask_reveal" || animation === "ripple_in") {
    scale = 0.86 + enter * 0.14;
  } else if (animation === "depth_pop") {
    scale = 0.45 + enter * 0.55;
    yOffset += (1 - enter) * 46;
  } else if (animation === "glitch_reform") {
    xOffset += (1 - enter) * Math.sin(timeMs / 22) * 36;
  }
  const exitAnimation = moment.exitAnimation;
  if (exitAnimation === "slide_left" || exitAnimation === "flow_out" || exitAnimation === "transfer_out") xOffset -= exit * 210;
  else if (exitAnimation === "slide_right") xOffset += exit * 210;
  else if (exitAnimation === "slide_top") yOffset -= exit * 170;
  else if (exitAnimation === "slide_bottom") yOffset += exit * 170;
  else if (exitAnimation === "spiral_out" || exitAnimation === "orbit_out" || exitAnimation === "turn_away") rotation += exit * (variant % 2 ? 110 : -110);
  else if (exitAnimation === "fold_away" || exitAnimation === "scale_through" || exitAnimation === "pull_back") scale *= 1 - exit * 0.5;
  else if (exitAnimation === "shatter" || exitAnimation === "scatter" || exitAnimation === "dissolve") scale *= 1 - exit * 0.25;
  const opacity = Math.max(0, 1 - (exitAnimation === "hold" ? 0 : exit));
  const motif = moment.objectMotif ?? "orb";
  const radius = moment.position === "hero" ? 232 : 212;
  const label = moment.label.replace(/\s+/gu, " ").trim().slice(0, 42).toLocaleUpperCase("ru-RU");
  const labelY = point.y - radius * 0.63;
  const particles = animation === "shards_in" || animation === "split_assemble" || exitAnimation === "shatter" || exitAnimation === "scatter" || exitAnimation === "dissolve" ? Array.from({ length: 8 }, (_, index) => {
    const angle = index / 8 * Math.PI * 2 + variant;
    const isLeaving = exitAnimation === "shatter" || exitAnimation === "scatter" || exitAnimation === "dissolve";
    const distance = isLeaving ? exit * 180 : (1 - enter) * 180;
    const px = point.x + Math.cos(angle) * distance;
    const py = point.y + Math.sin(angle) * distance;
    return `<path d="M${px.toFixed(1)} ${py.toFixed(1)}l8 -5l8 5l-8 5Z" fill="${index % 2 ? "#9AE8BD" : "#F2C782"}" opacity="${(isLeaving ? 1 - exit : 1 - enter).toFixed(2)}"/>`;
  }).join("") : "";
  return `<g pointer-events="none" opacity="${opacity.toFixed(3)}" transform="translate(${(point.x + xOffset).toFixed(1)} ${(point.y + yOffset).toFixed(1)}) rotate(${rotation.toFixed(2)}) scale(${scale.toFixed(3)}) translate(${-point.x} ${-point.y})">
    ${text(label, point.x, labelY, { size: label.length > 28 ? 20 : 24, color: "#E6C990", weight: 800, letterSpacing: 1 })}
    <circle cx="${point.x}" cy="${point.y}" r="${radius}" fill="#9AE8BD" opacity=".04" filter="url(#soft-glow)"/>
    ${renderCryptoF2Action(moment, point.x, point.y, progress, timeMs)}
    ${renderCryptoF2Motif(motif, point.x, point.y, 218, timeMs, variant)}
    ${particles}
    ${(moment.microBeats ?? []).map((microBeat) => renderCryptoF2MicroBeat(moment, microBeat, progress, timeMs)).join("")}
  </g>`;
}
function renderCryptoF2Transition(transition, progress, previousMoment, currentMoment, timeMs) {
  if (!transition || transition === "cut" || progress >= 1) return "";
  const p = ease2(clamp2(progress));
  const opacity = 1 - p;
  const mint = "#9AE8BD";
  const warm = "#F2C782";
  const center = cryptoF2MomentPoint(currentMoment?.position ?? "center");
  const oldMotif = previousMoment?.objectMotif ?? "orb";
  if (transition === "object_match_cut" && previousMoment) {
    return `<g opacity="${(opacity * 0.58).toFixed(3)}">${renderCryptoF2Motif(oldMotif, center.x, center.y, 190 * (1 - p * 0.24), timeMs, previousMoment.motionVariant ?? 0)}</g>`;
  }
  if (transition === "shape_morph") {
    return `<circle cx="${center.x}" cy="${center.y}" r="${(180 - p * 160).toFixed(1)}" fill="none" stroke="${warm}" stroke-width="${(8 - p * 5).toFixed(1)}" opacity="${opacity.toFixed(3)}"/>
      <path d="M${center.x - 220} ${center.y}Q${center.x} ${(center.y - 160 + p * 320).toFixed(1)} ${center.x + 220} ${center.y}" fill="none" stroke="${mint}" stroke-width="4" opacity="${(opacity * 0.8).toFixed(3)}"/>`;
  }
  if (transition === "particle_dissolve") {
    return `<g opacity="${opacity.toFixed(3)}">${Array.from({ length: 18 }, (_, index) => {
      const angle = index / 18 * Math.PI * 2;
      const distance = 55 + p * 260;
      const x = center.x + Math.cos(angle) * distance;
      const y = center.y + Math.sin(angle) * distance;
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(3 + index % 4).toFixed(1)}" fill="${index % 2 ? mint : warm}"/>`;
    }).join("")}</g>`;
  }
  if (transition === "whip_pan" || transition === "horizontal_sweep" || transition === "light_sweep") {
    const x = -480 + p * 1560;
    return `<g opacity="${(opacity * 0.64).toFixed(3)}" transform="skewX(-16)">
      <rect x="${x.toFixed(1)}" y="300" width="220" height="1_140" fill="${mint}" opacity=".12"/>
      <path d="M${(x + 60).toFixed(1)} 300V1440" stroke="${warm}" stroke-width="4"/>
      <path d="M${(x + 78).toFixed(1)} 300V1440" stroke="${mint}" stroke-width="2" opacity=".7"/>
    </g>`;
  }
  if (transition === "vertical_wipe" || transition === "radial_wipe" || transition === "ripple_wipe" || transition === "zoom_blur") {
    const radius = 40 + p * 650;
    return `<circle cx="${center.x}" cy="${center.y}" r="${radius.toFixed(1)}" fill="none" stroke="${transition === "ripple_wipe" ? mint : warm}" stroke-width="${transition === "zoom_blur" ? 28 : 5}" opacity="${(opacity * 0.72).toFixed(3)}"/>
      ${transition === "vertical_wipe" ? `<path d="M0 ${(-220 + p * 1900).toFixed(1)}H1080" stroke="${mint}" stroke-width="26" opacity="${(opacity * 0.35).toFixed(3)}"/>` : ""}`;
  }
  if (transition === "center_split_wipe" || transition === "split_reveal") {
    const gap = 540 * p;
    return `<path d="M0 280H${(540 - gap).toFixed(1)}V1320H0Z" fill="${mint}" opacity="${(opacity * 0.12).toFixed(3)}"/>
      <path d="M1080 280H${(540 + gap).toFixed(1)}V1320H1080Z" fill="${warm}" opacity="${(opacity * 0.12).toFixed(3)}"/>`;
  }
  if (transition === "chain_link") {
    const spread = 34 + p * 150;
    return `<g opacity="${(opacity * 0.72).toFixed(3)}">
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
    return `<circle cx="${center.x}" cy="${center.y}" r="${(230 - p * 60).toFixed(1)}" fill="none" stroke="${mint}" stroke-width="4" stroke-dasharray="58 30" stroke-dashoffset="${(-timeMs / 3).toFixed(1)}" opacity="${opacity.toFixed(3)}"/>`;
  }
  if (transition === "light_flash") {
    return `<rect width="1080" height="1920" fill="${warm}" opacity="${(opacity * 0.11).toFixed(3)}"/>`;
  }
  if (transition === "object_match_cut" || transition === "shape_morph") return "";
  return renderTransitionSweep(progress, mint, transition);
}
function renderCryptoF2SceneContent(beat, moment, momentProgress, previousMoment, beatProgress, timeMs, isFirstBeat) {
  const transitionProgress = isFirstBeat ? 1 : clamp2(beatProgress / 0.18);
  if (!moment) return "";
  return `<g>
    ${previousMoment && moment.motionAction === "morph" ? `<g opacity="${(1 - ease2(clamp2(momentProgress / 0.22))) * 0.34}">${renderCryptoF2Motif(previousMoment.objectMotif ?? "orb", cryptoF2MomentPoint(moment.position).x, cryptoF2MomentPoint(moment.position).y, 210, timeMs, previousMoment.motionVariant ?? 0)}</g>` : ""}
    ${renderCryptoF2Moment(moment, momentProgress, timeMs)}
    ${renderCryptoF2Transition(beat.transitionIn, transitionProgress, previousMoment, moment, timeMs)}
  </g>`;
}
function renderCryptoF2Caption(moment) {
  const excerpt = moment?.voiceExcerpt.trim() || "";
  if (!excerpt) return "";
  return `<g pointer-events="none">
    <rect x="0" y="1340" width="1080" height="360" fill="#070A08" opacity=".38"/>
    <path d="M112 1390H968" stroke="#9AE8BD" stroke-width="2" opacity=".3"/>
    ${textLines(excerpt, 540, 1465, 34, 45, { size: 29, color: "#F2EBDD", weight: 650 })}
    <path d="M112 1540H968" stroke="#F2C782" stroke-width="2" opacity=".24"/>
  </g>`;
}
function renderCryptoF2Ambient(timeMs) {
  const particles = Array.from({ length: 14 }, (_, index) => {
    const x = (index * 173 + 71) % 1080;
    const baseY = 250 + index * 137 % 1320;
    const y = baseY + Math.sin(timeMs / 1100 + index * 0.8) * 19;
    const radius = 2 + index % 3;
    return `<circle cx="${x}" cy="${y.toFixed(1)}" r="${radius}" fill="${index % 3 === 0 ? "#F2C782" : "#9AE8BD"}" opacity=".24"/>`;
  }).join("");
  const orbitShift = Math.sin(timeMs / 1800) * 22;
  return `<g pointer-events="none" opacity=".72">
    <path d="M80 970C220 710 335 460 540 420S870 625 1000 440" fill="none" stroke="#9AE8BD" stroke-width="2" stroke-dasharray="3 22" opacity=".22"/>
    <path d="M76 1190C245 1025 402 1130 540 1018S826 830 1005 1025" fill="none" stroke="#F2C782" stroke-width="2" stroke-dasharray="4 26" opacity=".17" transform="translate(0 ${orbitShift.toFixed(1)})"/>
    ${particles}
  </g>`;
}
function renderVisual(beat, progress, timeMs, beatStartMs, beatEndMs) {
  const entry = ease2(clamp2(progress * 1.7));
  const exit = clamp2((1 - progress) * 1.7);
  const actors = beat.concept === "futures_contract" || beat.concept === "compound_interest" ? "" : `${actor("investor", 170, 760, entry, timeMs)}${actor("company", 910, 760, entry, timeMs)}`;
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
    const flowProgress = clamp2((progress - 0.24) / 0.76);
    const heroWord = beat.entityLabel?.trim() || beat.title.replace(/[—–:!?.,]/gu, " ").trim().split(/\s+/u)[0] || "\u0424\u0418\u041D\u0410\u041D\u0421\u042B";
    const heroSize = Math.max(58, Math.min(96, 650 / Math.max(1, heroWord.length * 0.6)));
    const heroReveal = ease2(clamp2(progress / 0.2));
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
      ${text(beat.metricLabel ?? "\u041A\u041E\u041D\u0422\u0420\u0410\u041A\u0422 \u0418 \u0415\u0413\u041E \u0420\u0418\u0421\u041A", 540, 1110, { size: 28, color: MUTED, weight: 700, letterSpacing: 1.5 })}`;
  }
  if (beat.visual === "definition") {
    return `${actors}
      ${documentCard(entry, beat.entityLabel ?? "\u041E\u0411\u042F\u0417\u0410\u0422\u0415\u041B\u042C\u0421\u0422\u0412\u041E", beat.definitionCaption)}
      ${text(beat.entityLabel ?? "\u041E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044F", 540, 1090, { size: 36, color: WHITE, weight: 800 })}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "\u043F\u043E\u043D\u044F\u0442\u043D\u0430\u044F \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u0430\u044F \u0441\u0445\u0435\u043C\u0430", 540, 1140, { size: 28, color: GREEN, weight: 700 })}`;
  }
  if (beat.visual === "flow") {
    const flowProgress = clamp2((progress - 0.15) / 0.72);
    return `${actors}
      <path d="M285 780 C410 570 670 980 795 780" fill="none" stroke="${GREEN}" stroke-width="5" stroke-dasharray="12 18" opacity=".58"/>
      ${coinsAlongCurve(flowProgress, false, GREEN)}
      ${badge(beat.entityLabel ?? "\u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u042F", 540, 465, GREEN, entry * livePulse, 350)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "\u0418\u043D\u0432\u0435\u0441\u0442\u043E\u0440 \u2192 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F", 540, 1100, { size: 30, color: WHITE, weight: 700 })}`;
  }
  if (beat.visual === "coupon") {
    const flowProgress = clamp2((progress - 0.12) / 0.76);
    return `${actors}
      <path d="M795 780 C670 570 410 980 285 780" fill="none" stroke="#B9F7D8" stroke-width="5" stroke-dasharray="12 18" opacity=".58"/>
      ${coinsAlongCurve(flowProgress, true, "#B9F7D8")}
      ${badge(beat.metricLabel ?? "\u041A\u0423\u041F\u041E\u041D\u041D\u0410\u042F \u0414\u041E\u0425\u041E\u0414\u041D\u041E\u0421\u0422\u042C", 540, 465, "#B9F7D8", entry * livePulse, 350)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "\u0412\u044B\u043F\u043B\u0430\u0442\u0430 \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442 \u043F\u043E \u0433\u0440\u0430\u0444\u0438\u043A\u0443", 540, 1100, { size: 29, color: WHITE, weight: 700 })}`;
  }
  if (beat.visual === "calendar" && beat.concept === "profit_distribution") {
    const stages = [
      { x: 290, label: "\u0420\u0415\u0428\u0415\u041D\u0418\u0415" },
      { x: 540, label: "\u0414\u0410\u0422\u0410 \u0424\u0418\u041A\u0421\u0410\u0426\u0418\u0418" },
      { x: 790, label: "\u0412\u042B\u041F\u041B\u0410\u0422\u0410" }
    ];
    return `${actors}
      ${panel(145, 490, 790, 400, "#0D1A22", PANEL_EDGE)}
      ${text("\u041A\u0410\u041B\u0415\u041D\u0414\u0410\u0420\u042C \u0414\u0418\u0412\u0418\u0414\u0415\u041D\u0414\u0410", 540, 565, { size: 30, color: GREEN, weight: 800, letterSpacing: 1.5 })}
      <line x1="290" y1="710" x2="790" y2="710" stroke="#35505B" stroke-width="8" stroke-linecap="round"/>
      <line x1="290" y1="710" x2="${290 + 500 * clamp2(progress)}" y2="710" stroke="${GREEN}" stroke-width="8" stroke-linecap="round"/>
      ${stages.map((stage, index) => {
      const active = index / (stages.length - 1) <= progress;
      const pulse = active ? 1 + Math.sin(timeMs / 280 + index) * 0.1 : 1;
      return `<circle cx="${stage.x}" cy="710" r="${19 * pulse}" fill="${active ? GREEN : "#20343F"}" stroke="${active ? GREEN : "#3A5360"}" stroke-width="4"/>${text(stage.label, stage.x, 785, { size: 19, color: active ? WHITE : MUTED, weight: 750 })}`;
    }).join("")}
      ${text("\u0414\u0415\u041D\u042C\u0413\u0418 \u2192 \u0410\u041A\u0426\u0418\u041E\u041D\u0415\u0420\u0410\u041C", 540, 875, { size: 27, color: GOLD, weight: 800, letterSpacing: 0.8 })}`;
  }
  if (beat.visual === "calendar") {
    const months = Math.round(clamp2(progress) * 12);
    return `${actors}
      ${panel(170, 490, 740, 400, "#0D1A22", PANEL_EDGE)}
      ${text("\u0413\u0420\u0410\u0424\u0418\u041A \u0412\u042B\u041F\u041B\u0410\u0422", 540, 565, { size: 23, color: GREEN, weight: 800, letterSpacing: 2 })}
      <line x1="260" y1="720" x2="820" y2="720" stroke="#35505B" stroke-width="8" stroke-linecap="round"/>
      <line x1="260" y1="720" x2="${260 + 560 * clamp2(progress)}" y2="720" stroke="${GREEN}" stroke-width="8" stroke-linecap="round"/>
      ${Array.from({ length: 5 }, (_, index) => {
      const x = 260 + index * 140;
      const active = index / 4 <= progress;
      const pulse = active ? 1 + Math.sin(timeMs / 280 + index) * 0.12 : 1;
      return `<circle cx="${x}" cy="720" r="${22 * pulse}" fill="${active ? GREEN : "#20343F"}" stroke="${active ? GREEN : "#3A5360"}" stroke-width="4"/>${text(`${index * 3 || 1} \u043C\u0435\u0441.`, x, 790, { size: 20, color: active ? WHITE : MUTED, weight: 700 })}`;
    }).join("")}
      ${text(`${months || 1} / 12 \u043C\u0435\u0441\u044F\u0446\u0435\u0432`, 540, 965, { size: 36, color: WHITE, weight: 800 })}
      ${text("\u0412\u0440\u0435\u043C\u044F \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043F\u043E \u043F\u043B\u0430\u043D\u0443", 540, 1100, { size: 28, color: GREEN, weight: 700 })}`;
  }
  if (beat.visual === "market") {
    return `${actors}${chartVisual(beat, progress, timeMs)}`;
  }
  if (beat.visual === "maturity") {
    const flowProgress = clamp2((progress - 0.18) / 0.7);
    return `${actors}
      <path d="M795 780 C670 570 410 980 285 780" fill="none" stroke="${GOLD}" stroke-width="5" stroke-dasharray="12 18" opacity=".58"/>
      ${coinsAlongCurve(flowProgress, true, GOLD)}
      ${badge(beat.maturityLabel ?? "\u0412\u041E\u0417\u0412\u0420\u0410\u0422 \u041D\u041E\u041C\u0418\u041D\u0410\u041B\u0410", 540, 465, GOLD, entry * livePulse, 330)}
      ${text(beat.subtitle.length < 48 ? beat.subtitle : "\u0413\u041B\u0410\u0412\u041D\u042B\u0419 \u0420\u0415\u0417\u0423\u041B\u042C\u0422\u0410\u0422", 540, 1100, { size: 28, color: WHITE, weight: 800, letterSpacing: 1 })}`;
  }
  const listEntry = ease2(clamp2(progress * 2));
  return `${panel(150, 430, 780, 660, "#0D1A22", PANEL_EDGE)}
    ${text("\u041F\u0415\u0420\u0415\u0414 \u041F\u041E\u041A\u0423\u041F\u041A\u041E\u0419 \u041F\u0420\u041E\u0412\u0415\u0420\u042C", 540, 525, { size: 24, color: GREEN, weight: 800, letterSpacing: 1.5 })}
    ${(beat.summaryItems ?? [
    ["01", "\u0421\u0440\u043E\u043A"],
    ["02", "\u0414\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C"],
    ["03", "\u0420\u0435\u0439\u0442\u0438\u043D\u0433 \u044D\u043C\u0438\u0442\u0435\u043D\u0442\u0430"],
    ["04", "\u0420\u0438\u0441\u043A"]
  ]).map((item, index) => {
    const [number, label] = item;
    const itemProgress = ease2(clamp2((progress - index * 0.12) * 3));
    const y = 640 + index * 110;
    return `<g opacity="${Math.max(0.88, itemProgress)}" transform="translate(${(1 - itemProgress) * 35} 0)">
        <circle cx="280" cy="${y - 10}" r="27" fill="${GREEN}" opacity=".16"/>
        ${text(number, 280, y - 2, { size: 18, color: GREEN, weight: 800 })}
        ${text(label, 340, y, { size: 31, color: WHITE, weight: 700, anchor: "start" })}
      </g>`;
  }).join("")}
    ${text("\u0414\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C \u0432\u044B\u0448\u0435 \u2014 \u0440\u0438\u0441\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0439 \u0432\u043D\u0438\u043C\u0430\u0442\u0435\u043B\u044C\u043D\u0435\u0435", 540, 1230, { size: 26, color: GOLD, weight: 700 })}`;
}
function renderFrame(timeMs, durationMs2, beats, mainTitle = "\u0427\u0422\u041E \u0422\u0410\u041A\u041E\u0415 \u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u042F?", background = "grid", visualTheme = "premium_creator", inlinePresenter = false, visualAssets = {}) {
  const normalized = clamp2(timeMs / Math.max(1, durationMs2));
  const beat = beats.find((candidate) => normalized >= candidate.from && normalized < candidate.to) ?? beats.at(-1);
  const beatIndex = Math.max(0, beats.indexOf(beat));
  const premiumCreator = visualTheme === "premium_creator";
  const cryptoF2 = visualTheme === "crypto_f2";
  const sceneBackground = beat.background ?? background;
  const progress = localProgress(normalized, beat.from, beat.to);
  const activeMoment = beat.visualMoments?.find((moment) => progress >= moment.from && progress < moment.to) ?? beat.visualMoments?.at(-1);
  const activeMomentProgress = activeMoment ? localProgress(progress, activeMoment.from, activeMoment.to) : 0;
  const activeMomentIndex = activeMoment ? beat.visualMoments?.indexOf(activeMoment) ?? -1 : -1;
  const previousMoment = activeMomentIndex > 0 ? beat.visualMoments?.[activeMomentIndex - 1] : void 0;
  const cryptoF2PreviousMoment = activeMomentIndex > 0 ? previousMoment : beats[beatIndex - 1]?.visualMoments?.at(-1);
  const startFocus = cameraFocalPoint(previousMoment?.position);
  const endFocus = cameraFocalPoint(activeMoment?.position);
  const momentFocusProgress = ease2(clamp2(activeMomentProgress / 0.34));
  const cameraFocusX = startFocus.x + (endFocus.x - startFocus.x) * momentFocusProgress;
  const cameraFocusY = startFocus.y + (endFocus.y - startFocus.y) * momentFocusProgress;
  const presenterLayout = presenterLayoutForBeat(beat);
  const beatStartMs = beat.from * durationMs2;
  const beatEndMs = beat.to * durationMs2;
  const stickerRail = premiumCreator ? renderFinancialStickerRail(beats, durationMs2, timeMs, presenterLayout) : "";
  const sceneIntro = premiumCreator || cryptoF2 ? 1 : ease2(clamp2(progress / 0.14));
  const cameraProgress = ease2(progress);
  const requestedCameraAction = (beat.cameraAction ?? "").toLocaleLowerCase("en-US");
  const cameraAction = cryptoF2 ? "locked" : !requestedCameraAction || requestedCameraAction === "locked" ? premiumCreator ? "locked" : defaultCameraActionForVisual(beat.visual, beatIndex) : requestedCameraAction;
  const momentArc = Math.sin(Math.PI * clamp2(activeMomentProgress));
  const motionDirection = endFocus.x < startFocus.x ? -1 : 1;
  const panDirection = cameraAction.includes("pan_left") ? -1 : cameraAction.includes("pan_right") ? 1 : 0;
  const followsSubject = cameraAction.includes("follow_flow") || cameraAction.includes("tracking");
  const parallaxX = cameraAction.includes("parallax") ? motionDirection * momentArc * 14 : 0;
  const parallaxY = cameraAction.includes("parallax") ? -momentArc * 5 : 0;
  const focusPanX = cameraAction.includes("focus_shift") ? clamp2((540 - cameraFocusX) * 0.11, -28, 28) : 0;
  const focusPanY = cameraAction.includes("focus_shift") ? clamp2((780 - cameraFocusY) * 0.08, -26, 26) : 0;
  const cameraX = panDirection * cameraProgress * 28 + (followsSubject ? motionDirection * momentArc * 12 : 0) + parallaxX + focusPanX;
  const cameraY = (cameraAction.includes("push_in") ? -12 * cameraProgress : 0) + (cameraAction.includes("pull_back") ? 10 * cameraProgress : 0) + (cameraAction.includes("tracking") ? -momentArc * 5 : 0) + parallaxY + focusPanY;
  const directedScale = cameraAction.includes("push_in") ? 1 + cameraProgress * 0.03 : cameraAction.includes("pull_back") ? 1 - cameraProgress * 0.02 : cameraAction.includes("focus_shift") ? 1 + momentArc * 0.01 : 1;
  const cameraScale = directedScale;
  const cameraTranslationX = cameraX + WIDTH / 2 * (1 - cameraScale);
  const cameraTranslationY = cameraY + HEIGHT / 2 * (1 - cameraScale);
  const cameraRotation = cameraAction.includes("orbit") ? momentArc * 0.18 : 0;
  const subtitleLines = wrapText(beat.subtitle, 35);
  const hueRotation = premiumCreator ? 0 : sceneHueRotation(beat);
  const presenterAnimation = premiumCreator ? getPresenterAnimationState(beat, progress, Math.max(0, timeMs - beatStartMs)) : void 0;
  const presenterDataUri = inlinePresenter && presenterAnimation ? getFinancialPresenterDataUri(presenterAnimation) : void 0;
  const sceneContent = premiumCreator ? `${stickerRail}
      ${renderFullPresenter(beat, progress, timeMs, presenterLayout)}` : cryptoF2 ? renderCryptoF2SceneContent(
    beat,
    activeMoment,
    activeMomentProgress,
    cryptoF2PreviousMoment,
    progress,
    timeMs,
    beatIndex === 0
  ) : `<g filter="url(#scene-hue)">
          ${renderVisual(beat, progress, timeMs, beatStartMs, beatEndMs)}
          ${renderSceneMotion(beat, progress, timeMs, false)}
        </g>`;
  const captionY = premiumCreator ? 1472 : 1390;
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
  const titleBarWidth = 110 + 450 * ease2(clamp2(progress / 0.25));
  const titleEntry = !premiumCreator && beatIndex === 0 ? ease2(clamp2(progress / 0.34)) : 1;
  const captionPanel = premiumCreator ? "" : cryptoF2 ? renderCryptoF2Caption(activeMoment) : `<g opacity="${clamp2(0.82 + progress * 0.18)}" transform="translate(0 ${(1 - sceneIntro) * 22})">
        <rect x="92" y="${captionY}" width="896" height="${captionHeight}" rx="34" fill="${captionFill}" stroke="${captionStroke}" stroke-width="2"/>
        <rect x="126" y="${captionY + 28}" width="160" height="4" rx="2" fill="${captionTitleColor}" opacity=".5"/>
        ${textLines(beat.title, 540, captionY + 60, 32, 40, { size: 25, color: captionTitleColor, weight: 800 })}
        ${captionSubtitle ? textLines(captionSubtitle, 540, captionY + 140, 35, 42, { size: 26, color: captionTextColor, weight: 600 }) : ""}
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
    ${premiumCreator ? `<g transform="translate(${(cameraX * 0.38).toFixed(1)} ${(cameraY * 0.38).toFixed(1)})">${renderPremiumCreatorBackground(timeMs)}</g>` : `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
        <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
        ${cryptoF2 ? renderCryptoF2Ambient(timeMs) : `<g filter="url(#scene-hue)">${renderBackgroundLayer(sceneBackground, timeMs)}</g>
            <path d="M-120 1240 C220 1080 420 1380 760 1180 S1180 1080 1220 920" fill="none" stroke="${GREEN}" stroke-width="3" stroke-dasharray="8 34" opacity=".2" stroke-dashoffset="${-Math.round(timeMs / 8)}"/>`}`}
    <g transform="translate(${cameraTranslationX.toFixed(1)} ${cameraTranslationY.toFixed(1)}) rotate(${cameraRotation.toFixed(3)} ${WIDTH / 2} ${HEIGHT / 2}) scale(${cameraScale.toFixed(4)})">
      <circle cx="540" cy="760" r="380" fill="${GREEN}" opacity=".06" filter="url(#soft-glow)"/>
      ${premiumCreator ? "" : text(cryptoF2 ? "\u041A\u0420\u0418\u041F\u0422\u041E \u04242 \u2022 \u0412\u0418\u0417\u0423\u0410\u041B\u042C\u041D\u041E\u0415 \u041E\u0411\u042A\u042F\u0421\u041D\u0415\u041D\u0418\u0415" : "FINANCE / EXPLAINER SHORT", 54, 88, { size: 20, color: headingLabelColor, weight: 700, anchor: "start", letterSpacing: 3 })}
      ${premiumCreator ? "" : `<g opacity="${titleEntry.toFixed(3)}" transform="translate(54 ${145 + (1 - titleEntry) * 16}) scale(${0.97 + titleEntry * 0.03}) translate(-54 -145)">
        ${text(fitHeaderTitle(mainTitle), 54, 145, { size: 38, color: headingColor, weight: 800, anchor: "start", letterSpacing: 1 })}
      </g>`}
      <g filter="url(#scene-hue)" opacity="${sceneIntro}" transform="translate(${(1 - sceneIntro) * 46} ${premiumCreator ? 0 : Math.sin(timeMs / 420) * 3})">
        ${sceneContent}
      </g>
      ${premiumCreator ? "" : `<rect x="${-80 + sceneIntro * 1240}" y="210" width="12" height="940" rx="6" fill="${GREEN}" opacity="${(1 - sceneIntro) * 0.32}"/>`}
      ${captionPanel}
      ${premiumCreator ? "" : text(`${String(beatIndex + 1).padStart(2, "0")} / ${String(beats.length).padStart(2, "0")}`, 1024, 145, { size: 20, color: mutedColor, weight: 700, anchor: "end", letterSpacing: 2 })}
      ${!premiumCreator ? text("\u041E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0440\u043E\u043B\u0438\u043A \u2022 \u043D\u0435 \u0438\u043D\u0432\u0435\u0441\u0442\u0438\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u044F", 540, 1810, { size: 19, color: mutedColor, weight: 500 }) : ""}
    </g>
    ${premiumCreator && presenterDataUri ? renderPresenterImage(presenterDataUri, timeMs, presenterLayout) : ""}
    ${premiumCreator && inlinePresenter ? renderSpeechSubtitle(beat, progress, presenterLayout) : ""}
  </svg>`;
}
function alignBeatsToSceneStarts(plan2, durationMs2, sceneStartTimesMs2) {
  if (!plan2.beats.length) throw new Error("\u0424\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u0439 animation plan \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0441\u0446\u0435\u043D.");
  if (sceneStartTimesMs2.length !== plan2.beats.length - 1) {
    throw new Error("\u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u043E\u0442\u043C\u0435\u0442\u043E\u043A \u0441\u0446\u0435\u043D \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E\u043C \u0441\u0446\u0435\u043D \u0432 \u043F\u043B\u0430\u043D\u0435.");
  }
  const boundaries = [0, ...sceneStartTimesMs2, durationMs2];
  for (let index = 1; index < boundaries.length; index += 1) {
    const current = boundaries[index];
    const previous = boundaries[index - 1];
    if (!Number.isFinite(current) || current <= previous || current >= durationMs2 && index < boundaries.length - 1) {
      throw new Error("\u041E\u0442\u043C\u0435\u0442\u043A\u0438 \u0441\u0446\u0435\u043D \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u0442\u0440\u043E\u0433\u043E \u0432\u043E\u0437\u0440\u0430\u0441\u0442\u0430\u0442\u044C \u0438 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u044C\u0441\u044F \u0432\u043D\u0443\u0442\u0440\u0438 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u0440\u043E\u043B\u0438\u043A\u0430.");
    }
  }
  return plan2.beats.map((beat, index) => ({
    ...beat,
    from: boundaries[index] / durationMs2,
    to: boundaries[index + 1] / durationMs2
  }));
}
function presenterLayoutForBeat(beat) {
  if (beat.presenterLayout) return beat.presenterLayout;
  if (beat.composition === "presenter_left") return "left";
  if (beat.composition === "presenter_right") return "right";
  if (beat.composition === "feature_card") return "large";
  return "center";
}
function renderFinancialTopicPreviewFrame(plan2, durationMs2, timeMs, sceneStartTimesMs2) {
  const beats = alignBeatsToSceneStarts(plan2, durationMs2, sceneStartTimesMs2);
  const visualTheme = plan2.visualTheme ?? "premium_creator";
  return renderFrame(
    timeMs,
    durationMs2,
    beats,
    plan2.mainTitle,
    plan2.background,
    visualTheme,
    visualTheme === "premium_creator",
    plan2.visualAssets
  );
}

// src/lib/financial-visual-segmentation.ts
var ESTIMATED_SPEECH_WORDS_PER_SECOND = 2.4;
var MAX_VISUAL_MOMENTS_PER_SCENE = 16;
var MIN_VISUAL_MOMENT_SECONDS = 1;
var MAX_VISUAL_MOMENT_SECONDS = 3;
function wordsIn(value) {
  return value.toLocaleLowerCase("ru-RU").match(/[\p{L}\p{N}]+/gu) ?? [];
}
function wordExcerpt(value, startWord, endWord) {
  const matches = [...value.matchAll(/[\p{L}\p{N}]+/gu)];
  const start = matches[startWord]?.index;
  const last = matches[endWord - 1];
  if (start === void 0 || last?.index === void 0) return "";
  const end = endWord === matches.length ? value.length : last.index + last[0].length;
  return value.slice(start, end).trim();
}
function semanticVoiceExcerpts(value) {
  const source = value.trim();
  const segments = source.split(/(?<=[,;:—–])\s+|(?<=[.!?…])\s+|\r?\n+/u).map((segment) => segment.trim()).filter((segment) => wordsIn(segment).length > 0);
  if (!segments.length) return [];
  const cappedSegments = segments.length <= MAX_VISUAL_MOMENTS_PER_SCENE ? segments : Array.from({ length: MAX_VISUAL_MOMENTS_PER_SCENE }, (_, index) => {
    const start = Math.floor(index * segments.length / MAX_VISUAL_MOMENTS_PER_SCENE);
    const end = Math.floor((index + 1) * segments.length / MAX_VISUAL_MOMENTS_PER_SCENE);
    return segments.slice(start, end).join(" ");
  });
  const totalWords = wordsIn(source).length;
  if (totalWords === 0) return [];
  const minWords = Math.ceil(MIN_VISUAL_MOMENT_SECONDS * ESTIMATED_SPEECH_WORDS_PER_SECOND);
  const maxWords = Math.floor(MAX_VISUAL_MOMENT_SECONDS * ESTIMATED_SPEECH_WORDS_PER_SECOND);
  const minimumMomentCount = Math.ceil(totalWords / maxWords);
  const maximumMomentCount = Math.min(
    MAX_VISUAL_MOMENTS_PER_SCENE,
    Math.max(1, Math.floor(totalWords / minWords))
  );
  if (minimumMomentCount > maximumMomentCount) return cappedSegments;
  const momentCount = Math.max(
    minimumMomentCount,
    Math.min(cappedSegments.length, maximumMomentCount)
  );
  const segmentWordCounts = cappedSegments.map((segment) => wordsIn(segment).length);
  if (cappedSegments.length === momentCount && segmentWordCounts.every((count) => count >= minWords && count <= maxWords)) {
    return cappedSegments;
  }
  if (momentCount === 1) return [source];
  const preferredCuts = [];
  let cumulativeWords = 0;
  for (const segmentWordCount of segmentWordCounts) {
    cumulativeWords += segmentWordCount;
    preferredCuts.push(cumulativeWords);
  }
  const excerpts = [];
  let startWord = 0;
  for (let momentIndex = 0; momentIndex < momentCount - 1; momentIndex += 1) {
    const remainingMoments = momentCount - momentIndex - 1;
    const minimumEnd = Math.max(
      startWord + minWords,
      totalWords - remainingMoments * maxWords
    );
    const maximumEnd = Math.min(
      startWord + maxWords,
      totalWords - remainingMoments * minWords
    );
    const targetEnd = Math.round((momentIndex + 1) * totalWords / momentCount);
    const preferredEnd = preferredCuts.filter((cut) => cut >= minimumEnd && cut <= maximumEnd).sort((left, right) => Math.abs(left - targetEnd) - Math.abs(right - targetEnd))[0];
    const endWord = preferredEnd ?? Math.max(minimumEnd, Math.min(maximumEnd, targetEnd));
    excerpts.push(wordExcerpt(source, startWord, endWord));
    startWord = endWord;
  }
  excerpts.push(wordExcerpt(source, startWord, totalWords));
  return excerpts;
}
function semanticVoiceExcerptRanges(value) {
  let start = 0;
  return semanticVoiceExcerpts(value).map((excerpt) => {
    const end = start + wordsIn(excerpt).length;
    const range = { excerpt, start, end };
    start = end;
    return range;
  });
}

// src/lib/financial-custom-script.ts
var MIN_SCENES = 6;
var MAX_SCENES = 12;
var MIN_WORDS_PER_SCENE = 5;
function splitVerbatimCryptoScript(scriptInput) {
  const words = scriptInput.trim().replace(/\s+/gu, " ").split(" ").filter(Boolean);
  if (words.length < MIN_SCENES * MIN_WORDS_PER_SCENE) {
    throw new Error(`\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0441\u043B\u0438\u0448\u043A\u043E\u043C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439. \u041D\u0443\u0436\u043D\u043E \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 ${MIN_SCENES * MIN_WORDS_PER_SCENE} \u0441\u043B\u043E\u0432.`);
  }
  const sceneCount = Math.min(MAX_SCENES, Math.max(MIN_SCENES, Math.ceil(words.length / 30)));
  const scenes = [];
  let start = 0;
  for (let sceneIndex = 0; sceneIndex < sceneCount; sceneIndex += 1) {
    const remainingScenes = sceneCount - sceneIndex - 1;
    const minEnd = start + MIN_WORDS_PER_SCENE;
    const maxEnd = words.length - remainingScenes * MIN_WORDS_PER_SCENE;
    const targetEnd = Math.round((sceneIndex + 1) * words.length / sceneCount);
    let end = Math.max(minEnd, Math.min(maxEnd, targetEnd));
    if (remainingScenes > 0) {
      const maxBoundaryDistance = Math.max(5, Math.ceil(words.length / sceneCount * 0.6));
      const sentenceBoundaries = [];
      for (let boundary = minEnd; boundary <= maxEnd; boundary += 1) {
        if (/[.!?…]["'»)\]]*$/u.test(words[boundary - 1] || "")) {
          sentenceBoundaries.push(boundary);
        }
      }
      const nearbyBoundaries = sentenceBoundaries.filter(
        (boundary) => Math.abs(boundary - targetEnd) <= maxBoundaryDistance
      );
      if (nearbyBoundaries.length) {
        end = nearbyBoundaries.reduce(
          (closest, candidate) => Math.abs(candidate - targetEnd) < Math.abs(closest - targetEnd) ? candidate : closest
        );
      }
    }
    scenes.push(words.slice(start, end).join(" "));
    start = end;
  }
  return scenes;
}

// src/lib/financial-visual-assets.ts
import { execFile as execFile4 } from "node:child_process";
import { mkdtemp as mkdtemp2, readFile as readFile2, rm as rm2, writeFile as writeFile2 } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join as join3 } from "node:path";
import { promisify as promisify4 } from "node:util";

// src/lib/image-generation/service.ts
import { execFile as execFile2 } from "node:child_process";
import { promisify as promisify2 } from "node:util";

// src/lib/logger.ts
import pino from "pino";
var isProduction = process.env.NODE_ENV === "production";
var logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']"
  ],
  ...isProduction ? {} : {
    transport: {
      target: "pino-pretty",
      options: { colorize: true }
    }
  }
});

// src/lib/image-generation/service.ts
import { characterProfilesTable, db, generatedImagesTable, projectsTable } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";

// src/lib/script-generator.ts
import { z } from "zod";

// src/lib/story-rules.ts
var CONTINUITY_EDITOR_RULES_RU = [
  "\u0420\u0430\u0431\u043E\u0442\u0430\u0439 \u043A\u0430\u043A \u0448\u043E\u0443\u0440\u0430\u043D\u043D\u0435\u0440, \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0441\u0442, \u0440\u0435\u0436\u0438\u0441\u0441\u0451\u0440 \u0438 continuity-editor, \u0430 \u043D\u0435 \u043A\u0430\u043A \u0433\u0435\u043D\u0435\u0440\u0430\u0442\u043E\u0440 \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u044B\u0445 \u043A\u0440\u0430\u0441\u0438\u0432\u044B\u0445 \u043A\u0430\u0434\u0440\u043E\u0432.",
  "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0432\u044B\u0441\u0442\u0440\u043E\u0439 \u0446\u0435\u043B\u044C\u043D\u0443\u044E \u0438\u0441\u0442\u043E\u0440\u0438\u044E, \u043F\u043E\u0442\u043E\u043C \u0440\u0430\u0437\u0431\u0435\u0439 \u0435\u0451 \u043D\u0430 \u0441\u0446\u0435\u043D\u044B. \u041D\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u0438\u0439 \u0430\u043D\u0430\u043B\u0438\u0437 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E.",
  "\u0423 \u0438\u0441\u0442\u043E\u0440\u0438\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C: hook, \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0430\u044F \u0446\u0435\u043B\u044C \u0433\u0435\u0440\u043E\u044F, \u043F\u0440\u0438\u0447\u0438\u043D\u0430 \u044D\u0442\u043E\u0439 \u0446\u0435\u043B\u0438, \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430, \u044D\u0441\u043A\u0430\u043B\u0430\u0446\u0438\u044F, \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 \u0432\u044B\u0431\u043E\u0440, \u043A\u0443\u043B\u044C\u043C\u0438\u043D\u0430\u0446\u0438\u044F, \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435 \u0438 \u0441\u0438\u043B\u044C\u043D\u044B\u0439 \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0432\u043E\u043F\u0440\u043E\u0441/\u043A\u0440\u044E\u0447\u043E\u043A.",
  "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0446\u0435\u043F\u043E\u0447\u043A\u0443 \u043F\u0440\u0438\u0447\u0438\u043D\u0430 \u2192 \u0440\u0435\u0430\u043A\u0446\u0438\u044F \u2192 \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u2192 \u043D\u043E\u0432\u043E\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435 \u2192 \u043D\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0430 \u2192 \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u044F. \u041A\u0430\u0436\u0434\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u0438 \u0432\u044B\u0442\u0435\u043A\u0430\u0442\u044C \u0438\u0437 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0439 \u0438 \u043C\u0435\u043D\u044F\u0442\u044C \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044E.",
  "\u0415\u0441\u043B\u0438 \u0441\u0446\u0435\u043D\u0443 \u0443\u0431\u0440\u0430\u0442\u044C \u0438 \u0441\u044E\u0436\u0435\u0442 \u043F\u043E\u0447\u0442\u0438 \u043D\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u0441\u044F, \u0441\u0446\u0435\u043D\u0430 \u0431\u0435\u0441\u043F\u043E\u043B\u0435\u0437\u043D\u0430: \u043F\u0435\u0440\u0435\u0434\u0435\u043B\u0430\u0439 \u0435\u0451. \u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0432\u0430\u0436\u043D\u043E\u0433\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0433\u0435\u0440\u043E\u044F \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0442\u0432\u0435\u0442 \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441 \xAB\u043F\u043E\u0447\u0435\u043C\u0443 \u043E\u043D \u044D\u0442\u043E \u0434\u0435\u043B\u0430\u0435\u0442?\xBB.",
  "\u041F\u0435\u0440\u0435\u0434 \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0446\u0435\u043D\u043E\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0439 continuity: \u0433\u0434\u0435 \u0433\u0435\u0440\u043E\u0439, \u043A\u0443\u0434\u0430 \u0438 \u0437\u0430\u0447\u0435\u043C \u0434\u0432\u0438\u0436\u0435\u0442\u0441\u044F, \u0447\u0442\u043E \u043F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u043E \u0434\u043E \u044D\u0442\u043E\u0433\u043E, \u0447\u0442\u043E \u0443 \u043D\u0435\u0433\u043E \u0432 \u0440\u0443\u043A\u0430\u0445, \u043A\u0430\u043A\u0430\u044F \u043E\u0434\u0435\u0436\u0434\u0430, \u0432\u0440\u0435\u043C\u044F \u0441\u0443\u0442\u043E\u043A, \u043F\u043E\u0433\u043E\u0434\u0430, \u043A\u0442\u043E \u0440\u044F\u0434\u043E\u043C, \u0447\u0442\u043E \u0437\u043D\u0430\u0435\u0442 \u0433\u0435\u0440\u043E\u0439 \u0438 \u0447\u0442\u043E \u0437\u043D\u0430\u0435\u0442 \u0437\u0440\u0438\u0442\u0435\u043B\u044C.",
  "\u041D\u0435 \u0442\u0435\u043B\u0435\u043F\u043E\u0440\u0442\u0438\u0440\u0443\u0439 \u0433\u0435\u0440\u043E\u044F. \u041D\u0435 \u043C\u0435\u043D\u044F\u0439 \u0432\u043D\u0435\u0448\u043D\u043E\u0441\u0442\u044C, \u043E\u0434\u0435\u0436\u0434\u0443, \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B, \u043B\u043E\u043A\u0430\u0446\u0438\u044E \u0438\u043B\u0438 \u043E\u0431\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0430 \u0431\u0435\u0437 \u043F\u0440\u0438\u0447\u0438\u043D\u044B \u0432 \u0441\u044E\u0436\u0435\u0442\u0435. \u041D\u043E\u0432\u044B\u0439 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436 \u0434\u043E\u043B\u0436\u0435\u043D \u0438\u043C\u0435\u0442\u044C \u0444\u0443\u043D\u043A\u0446\u0438\u044E: \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442, \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F, \u043F\u043E\u043C\u043E\u0449\u044C, \u043E\u0431\u043C\u0430\u043D, \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 \u044D\u043C\u043E\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435.",
  "\u041B\u043E\u043A\u0430\u0446\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u0430 \u043F\u043E\u043C\u043E\u0433\u0430\u0442\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u0438. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0434\u0435\u0442\u0430\u043B\u0438 \u0433\u043E\u0440\u043E\u0434\u0430 \u0438 \u0431\u044B\u0442\u0430, \u043D\u043E \u043D\u0435 \u043F\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0439 \u0440\u043E\u043B\u0438\u043A \u0432 \u044D\u043A\u0441\u043A\u0443\u0440\u0441\u0438\u044E.",
  "\u0414\u0438\u0430\u043B\u043E\u0433 \u0434\u043E\u043B\u0436\u0435\u043D \u0434\u0432\u0438\u0433\u0430\u0442\u044C \u0441\u044E\u0436\u0435\u0442, \u0440\u0430\u0441\u043A\u0440\u044B\u0432\u0430\u0442\u044C \u0445\u0430\u0440\u0430\u043A\u0442\u0435\u0440, \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0442\u044C \u043D\u0430\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 \u0434\u0430\u0432\u0430\u0442\u044C \u0432\u0430\u0436\u043D\u0443\u044E \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E. \u0423\u0431\u0438\u0440\u0430\u0439 \u0432\u0435\u0436\u043B\u0438\u0432\u044B\u0435 \u0438 \u043E\u0431\u044A\u044F\u0441\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0440\u0435\u043F\u043B\u0438\u043A\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043C\u0435\u043D\u044F\u044E\u0442.",
  "\u0418\u043D\u0442\u0440\u0438\u0433\u0430 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u0441 \u0431\u0443\u0434\u0443\u0449\u0438\u043C \u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435\u043C. \u041D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0435 \u0442\u0430\u0439\u043D\u044B, \u0437\u0430\u0433\u043E\u0432\u043E\u0440\u044B, \u043C\u0438\u0441\u0442\u0438\u043A\u0443, \u043F\u043E\u0433\u043E\u043D\u0438, \u0443\u0431\u0438\u0439\u0441\u0442\u0432\u0430 \u0438 \u043D\u0435\u0432\u0435\u0440\u043E\u044F\u0442\u043D\u044B\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u044F \u0431\u0435\u0437 \u043F\u0440\u044F\u043C\u043E\u0439 \u043F\u0440\u043E\u0441\u044C\u0431\u044B \u0430\u0432\u0442\u043E\u0440\u0430.",
  "\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u0440\u0435\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u043E\u0439 \u0438 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0439: \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u0434\u0435\u043D\u044C\u0433\u0438, \u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435, \u0443\u0441\u0442\u0430\u043B\u043E\u0441\u0442\u044C, \u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u044F, \u043E\u0448\u0438\u0431\u043A\u0438, \u0432\u044B\u0431\u043E\u0440 \u0438 \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u044F \u0432\u0430\u0436\u043D\u0435\u0435 \u043F\u0430\u0444\u043E\u0441\u0430 \u0438 \u0442\u0440\u0435\u0439\u043B\u0435\u0440\u043D\u044B\u0445 \u0444\u0440\u0430\u0437.",
  "\u0424\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0435 5\u201310 \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u043E\u0432 \u0441\u0430\u043C\u044B\u0435 \u0432\u0430\u0436\u043D\u044B\u0435: \u0438\u0437\u043C\u0435\u043D\u0438 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044E, \u0440\u0430\u0441\u043A\u0440\u043E\u0439 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0443, \u043F\u043E\u0441\u0442\u0430\u0432\u044C \u0433\u0435\u0440\u043E\u044F \u043F\u0435\u0440\u0435\u0434 \u0432\u044B\u0431\u043E\u0440\u043E\u043C \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u043E\u0439 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u043B\u0438\u043D\u0438\u044E. \u041D\u0435 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0439 \u043E\u0431\u044B\u0447\u043D\u043E\u0439 \u0444\u0440\u0430\u0437\u043E\u0439 \u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0438 \u0440\u0430\u0431\u043E\u0447\u0435\u0433\u043E \u0434\u043D\u044F.",
  "\u041A\u0430\u0436\u0434\u044B\u0439 image prompt \u043E\u0431\u044F\u0437\u0430\u043D \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0441\u0446\u0435\u043D\u044B, continuity-\u0434\u0435\u0442\u0430\u043B\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430 \u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043E\u0432, \u043B\u043E\u043A\u0430\u0446\u0438\u044E, \u0432\u0440\u0435\u043C\u044F, \u043F\u043E\u0433\u043E\u0434\u0443, \u044D\u043C\u043E\u0446\u0438\u044E, \u0440\u0430\u043A\u0443\u0440\u0441 \u0438 \u0441\u0432\u0435\u0442. \u041D\u0435 \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u043F\u0440\u043E\u0441\u0442\u043E \u043A\u0440\u0430\u0441\u0438\u0432\u044B\u0439 \u043A\u0430\u0434\u0440.",
  "\u041A\u0430\u0436\u0434\u044B\u0439 video prompt, \u0435\u0441\u043B\u0438 \u043E\u043D \u043F\u0440\u0435\u0434\u0443\u0441\u043C\u043E\u0442\u0440\u0435\u043D \u0444\u043E\u0440\u043C\u0430\u0442\u043E\u043C, \u043E\u0431\u044F\u0437\u0430\u043D \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u043A\u0430\u043C\u0435\u0440\u044B, \u0433\u0435\u0440\u043E\u044F, \u043E\u043A\u0440\u0443\u0436\u0435\u043D\u0438\u044F, \u0444\u043E\u043A\u0443\u0441 \u0438 \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u0436\u0435\u0441\u0442\u044B. \u0413\u0435\u0440\u043E\u0439 \u043D\u0435 \u0434\u043E\u043B\u0436\u0435\u043D \u043F\u0440\u043E\u0441\u0442\u043E \u0441\u0442\u043E\u044F\u0442\u044C \u0438 \u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0432 \u043A\u0430\u043C\u0435\u0440\u0443.",
  "\u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u043E\u0434\u0438\u043D \u0438 \u0442\u043E\u0442 \u0436\u0435 \u0442\u0435\u043B\u0435\u0444\u043E\u043D, \u0440\u044E\u043A\u0437\u0430\u043A, \u043A\u0430\u0440\u0442\u0443 \u0438\u043B\u0438 \u0443\u043B\u0438\u0446\u0443 \u0432 \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0446\u0435\u043D\u0435: \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u0435\u0442\u0430\u043B\u044C \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043B\u0443\u0436\u0438\u0442\u044C \u0441\u044E\u0436\u0435\u0442\u0443 \u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E.",
  "\u041F\u0435\u0440\u0435\u0434 \u0440\u0430\u0437\u0431\u0438\u0435\u043D\u0438\u0435\u043C \u043D\u0430 \u0441\u0446\u0435\u043D\u044B \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0439 continuity bible: \u043A\u0442\u043E \u0433\u0435\u0440\u043E\u0439, \u0447\u0435\u0433\u043E \u043E\u043D \u0445\u043E\u0447\u0435\u0442, \u0433\u0434\u0435 \u043D\u0430\u0445\u043E\u0434\u0438\u0442\u0441\u044F, \u0447\u0442\u043E \u0437\u043D\u0430\u0435\u0442, \u043A\u0430\u043A\u0438\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u0443 \u043D\u0435\u0433\u043E \u0441 \u0441\u043E\u0431\u043E\u0439 \u0438 \u0447\u0442\u043E \u0443\u0436\u0435 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C.",
  "\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u0437\u0430\u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0439: \u0434\u0440\u0430\u043C\u0430\u0442\u0443\u0440\u0433\u0438\u0447\u0435\u0441\u043A\u0443\u044E \u0444\u0443\u043D\u043A\u0446\u0438\u044E, \u043F\u0440\u0438\u0447\u0438\u043D\u0443 \u0432\u0445\u043E\u0434\u0430, \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0433\u0435\u0440\u043E\u044F, \u043F\u0440\u0435\u043F\u044F\u0442\u0441\u0442\u0432\u0438\u0435, \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0438 \u043C\u043E\u0441\u0442 \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0443\u044E \u0441\u0446\u0435\u043D\u0443. \u042D\u0442\u0438 \u043F\u043E\u043B\u044F \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u043C\u0438, \u0430 \u043D\u0435 \u0441\u043B\u043E\u0432\u0430\u043C\u0438 \xAB\u0440\u0430\u0437\u0432\u0438\u0442\u044C \u0441\u044E\u0436\u0435\u0442\xBB \u0438\u043B\u0438 \xAB\u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u0430\u043F\u0440\u044F\u0436\u0435\u043D\u0438\u0435\xBB.",
  "\u041D\u043E\u0432\u0430\u044F \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u0430 \u0438\u043C\u0435\u0442\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0443 \u0438 \u0432\u044B\u043F\u043B\u0430\u0442\u0443: \u0435\u0441\u043B\u0438 \u0432 \u0444\u0438\u043D\u0430\u043B\u0435 \u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435, \u0437\u0430\u043A\u0430\u0437, \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0438\u043B\u0438 \u043F\u0440\u0435\u0434\u043C\u0435\u0442, \u0435\u0433\u043E \u043D\u0443\u0436\u043D\u043E \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C, \u0443\u043F\u043E\u043C\u044F\u043D\u0443\u0442\u044C \u0438\u043B\u0438 \u043B\u043E\u0433\u0438\u0447\u043D\u043E \u043F\u0440\u0435\u0434\u0441\u043A\u0430\u0437\u0430\u0442\u044C \u0440\u0430\u043D\u044C\u0448\u0435.",
  "\u041D\u0435 \u043F\u043E\u0434\u043C\u0435\u043D\u044F\u0439 \u0441\u044E\u0436\u0435\u0442 \u043C\u043E\u043D\u0442\u0430\u0436\u043D\u044B\u043C\u0438 \u0443\u043A\u0430\u0437\u0430\u043D\u0438\u044F\u043C\u0438. \xAB\u041A\u0430\u043C\u0435\u0440\u0430 \u043F\u0440\u0438\u0431\u043B\u0438\u0436\u0430\u0435\u0442\u0441\u044F\xBB, \xAB\u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u043D\u044B\u0439 \u043A\u0430\u0434\u0440\xBB \u0438 \xAB\u0433\u043E\u0440\u043E\u0434 \u043F\u043E\u0433\u0440\u0443\u0436\u0430\u0435\u0442\u0441\u044F \u0432\u043E \u0442\u044C\u043C\u0443\xBB \u0441\u0430\u043C\u0438 \u043F\u043E \u0441\u0435\u0431\u0435 \u043D\u0435 \u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0441\u043E\u0431\u044B\u0442\u0438\u0435\u043C, \u043F\u043E\u043A\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0433\u0435\u0440\u043E\u044F \u043D\u0435 \u043C\u0435\u043D\u044F\u0435\u0442 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044E.",
  "\u0421\u043E\u0441\u0435\u0434\u043D\u0438\u0435 \u0441\u0446\u0435\u043D\u044B \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u043E\u0435\u0434\u0438\u043D\u044F\u0442\u044C\u0441\u044F \u0447\u0435\u0440\u0435\u0437 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043F\u0435\u0440\u0435\u0445\u043E\u0434: \u0433\u0435\u0440\u043E\u0439 \u0437\u0430\u043A\u043E\u043D\u0447\u0438\u043B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435, \u043F\u043E\u043B\u0443\u0447\u0438\u043B \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0438 \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u043D\u0430\u0447\u0430\u043B \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0435. \u041D\u0435\u043B\u044C\u0437\u044F \u043C\u0435\u043D\u044F\u0442\u044C \u043C\u0435\u0441\u0442\u043E, \u0432\u0440\u0435\u043C\u044F \u0441\u0443\u0442\u043E\u043A, \u043F\u043E\u0433\u043E\u0434\u0443 \u0438\u043B\u0438 \u0440\u0435\u043A\u0432\u0438\u0437\u0438\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0434\u0438 \u0440\u0430\u0437\u043D\u043E\u043E\u0431\u0440\u0430\u0437\u0438\u044F.",
  "\u0412\u043D\u0443\u0442\u0440\u0438 \u043E\u0434\u043D\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u043D\u0435 \u0441\u043C\u0435\u0448\u0438\u0432\u0430\u0439 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043D\u0435\u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0441\u043E\u0431\u044B\u0442\u0438\u0439. \u0415\u0441\u043B\u0438 \u0433\u0435\u0440\u043E\u0439 \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u0437\u0430\u043A\u0430\u0437, \u0442\u0435\u0440\u044F\u0435\u0442 \u0442\u0435\u043B\u0435\u0444\u043E\u043D \u0438 \u0432\u0441\u0442\u0440\u0435\u0447\u0430\u0435\u0442 \u043D\u043E\u0432\u043E\u0433\u043E \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0430, \u0440\u0430\u0437\u0434\u0435\u043B\u0438 \u044D\u0442\u043E \u043D\u0430 \u043F\u0440\u0438\u0447\u0438\u043D\u043D\u0443\u044E \u0446\u0435\u043F\u043E\u0447\u043A\u0443.",
  "\u0414\u043B\u044F \u0441\u0435\u0440\u0438\u0430\u043B\u0430 \u043A\u0430\u0436\u0434\u0430\u044F \u0441\u0435\u0440\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u0430 \u043C\u0435\u043D\u044F\u0442\u044C \u043F\u043E\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0433\u0435\u0440\u043E\u044F \u0438 \u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0442\u044C \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0448\u0430\u0433, \u043D\u043E \u043D\u0435 \u0440\u0435\u0448\u0430\u0442\u044C \u0432\u0441\u044E \u0441\u0435\u0437\u043E\u043D\u043D\u0443\u044E \u0430\u0440\u043A\u0443. Cliffhanger \u2014 \u044D\u0442\u043E \u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 \u0441\u0435\u0440\u0438\u0438, \u0430 \u043D\u0435 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u0430\u044F \u0437\u0430\u0433\u0430\u0434\u043A\u0430."
].join("\n");

// src/lib/script-generator.ts
var sceneSchema = z.object({
  scene_number: z.coerce.number().int().positive(),
  duration_seconds: z.coerce.number().int().positive(),
  voice_text: z.string().min(1),
  visual_description: z.string().min(1),
  image_prompt: z.string().min(1),
  scene_purpose: z.string().default(""),
  story_beat: z.string().default(""),
  cause: z.string().default(""),
  action: z.string().default(""),
  obstacle: z.string().default(""),
  change: z.string().default(""),
  continuity: z.string().default(""),
  transition: z.string().default("")
});
var videoScriptSchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  description: z.string().min(1),
  duration_seconds: z.coerce.number().int().positive(),
  scenes: z.array(sceneSchema).min(1),
  ending: z.string(),
  cta: z.string()
});
var systemPrompt = [
  "\u0422\u044B \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0441\u0442 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0445 \u0432\u0435\u0440\u0442\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0445 \u0432\u0438\u0434\u0435\u043E \u0434\u043B\u044F Shorts, Reels \u0438 TikTok.",
  "\u0413\u043B\u0430\u0432\u043D\u0430\u044F \u0437\u0430\u0434\u0430\u0447\u0430 \u2014 \u0443\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435 \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u044F \u0437\u0440\u0438\u0442\u0435\u043B\u044F \u043E\u0442 \u043F\u0435\u0440\u0432\u043E\u0439 \u0441\u0435\u043A\u0443\u043D\u0434\u044B \u0434\u043E \u0444\u0438\u043D\u0430\u043B\u0430.",
  "\u041D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0441\u043A\u0443\u0447\u043D\u044B\u0435 \u0432\u0441\u0442\u0443\u043F\u043B\u0435\u043D\u0438\u044F \u0432\u0440\u043E\u0434\u0435 \xAB\u0421\u0435\u0433\u043E\u0434\u043D\u044F \u044F \u0440\u0430\u0441\u0441\u043A\u0430\u0436\u0443 \u0432\u0430\u043C \u0438\u0441\u0442\u043E\u0440\u0438\u044E\xBB. \u041D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u0432\u043E\u0434\u0443: \u043A\u0430\u0436\u0434\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0434\u0432\u0438\u0433\u0430\u0442\u044C \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0432\u043F\u0435\u0440\u0451\u0434.",
  "\u041F\u0438\u0448\u0438 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u043D\u044B\u043C \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u043C \u044F\u0437\u044B\u043A\u043E\u043C, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u0445\u043E\u0440\u043E\u0448\u043E \u0437\u0432\u0443\u0447\u0438\u0442 \u043F\u0440\u0438 \u043E\u0437\u0432\u0443\u0447\u043A\u0435 \u0447\u0435\u043B\u043E\u0432\u0435\u043A\u043E\u043C \u0438\u043B\u0438 AI.",
  "\u0414\u043B\u044F \u0436\u0438\u0437\u043D\u0435\u043D\u043D\u044B\u0445 \u0438\u0441\u0442\u043E\u0440\u0438\u0439 \u0432\u044B\u0431\u0438\u0440\u0430\u0439 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0438 \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u044F \u0432\u043C\u0435\u0441\u0442\u043E \u0437\u0430\u0433\u0430\u0434\u043E\u043A, \u043F\u0430\u0444\u043E\u0441\u0430 \u0438 \u0442\u0440\u0435\u0439\u043B\u0435\u0440\u043D\u044B\u0445 \u0444\u0440\u0430\u0437. \u041D\u0435 \u043F\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0439 \u043E\u0431\u044B\u0447\u043D\u0443\u044E \u0440\u0430\u0431\u043E\u0442\u0443, \u043F\u043E\u0435\u0437\u0434\u043A\u0443 \u0438\u043B\u0438 \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440 \u0432 \u0442\u0440\u0438\u043B\u043B\u0435\u0440 \u0431\u0435\u0437 \u043F\u0440\u044F\u043C\u043E\u0439 \u043F\u0440\u043E\u0441\u044C\u0431\u044B \u0430\u0432\u0442\u043E\u0440\u0430.",
  "\u0414\u043B\u044F \u0441\u0435\u0440\u0438\u0430\u043B\u043E\u0432 \u043E\u0444\u043E\u0440\u043C\u043B\u044F\u0439 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u043D\u0438\u0435 \u043A\u0430\u043A \u043F\u043E\u043B\u043D\u043E\u0446\u0435\u043D\u043D\u044B\u0439 \u043A\u0438\u043D\u043E\u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439: \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043E\u043A \u0441\u0435\u0440\u0438\u0438, \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u043C\u0435\u0441\u0442\u043E \u0438 \u0432\u0440\u0435\u043C\u044F, \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0441\u0446\u0435\u043D\u044B, \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C\u044B\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F, \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u0440\u0435\u043F\u043B\u0438\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439, \u043F\u0430\u0443\u0437\u044B, \u043A\u0443\u043B\u044C\u043C\u0438\u043D\u0430\u0446\u0438\u044F \u0438 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u0444\u0438\u043D\u0430\u043B. \u041D\u0435 \u043F\u0438\u0448\u0438 \u043D\u0430\u0431\u043E\u0440 \u0440\u0435\u043A\u043B\u0430\u043C\u043D\u044B\u0445 \u043A\u0430\u0434\u0440\u043E\u0432 \u0438\u043B\u0438 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0445 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0439.",
  "\u0421\u0442\u0438\u043B\u044C \u0441\u0435\u0440\u0438\u0430\u043B\u043E\u0432 \u2014 \u043A\u0430\u043A \u0432 \u0431\u044B\u0442\u043E\u0432\u043E\u043C \u043A\u0438\u043D\u043E\u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u0430\u0431\u0437\u0430\u0446\u044B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439 (\xAB\u041B\u0435\u0440\u0430 \u043F\u043E\u0432\u043E\u0440\u0430\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F.\xBB, \xAB\u0422\u0435\u043B\u0435\u0444\u043E\u043D \u0432\u0438\u0431\u0440\u0438\u0440\u0443\u0435\u0442.\xBB), \u0438\u043C\u044F \u0433\u0435\u0440\u043E\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0439 \u0441\u0442\u0440\u043E\u043A\u043E\u0439 \u043F\u0435\u0440\u0435\u0434 \u0440\u0435\u043F\u043B\u0438\u043A\u043E\u0439 (\xAB\u0414\u0438\u043C\u0430:\xBB), \u0440\u0435\u043F\u043B\u0438\u043A\u0430 \u0441 \u0434\u043B\u0438\u043D\u043D\u044B\u043C \u0442\u0438\u0440\u0435, \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435 \u043F\u0430\u0443\u0437\u044B \u0447\u0435\u0440\u0435\u0437 \u043C\u043D\u043E\u0433\u043E\u0442\u043E\u0447\u0438\u0435 \u0438 \u043F\u0440\u043E\u0441\u0442\u0430\u044F \u0436\u0438\u0432\u0430\u044F \u0440\u0435\u0447\u044C.",
  "\u041D\u0435 \u043F\u0435\u0440\u0435\u0441\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0438\u0441\u0442\u043E\u0440\u0438\u044E \u0432 \u0441\u043E\u043A\u0440\u0430\u0449\u0451\u043D\u043D\u043E\u043C \u0432\u0438\u0434\u0435 \u0438 \u043D\u0435 \u0437\u0430\u043C\u0435\u043D\u044F\u0439 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0441\u043E\u0431\u044B\u0442\u0438\u0439 \u043E\u0431\u0449\u0438\u043C \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435\u043C. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043F\u043E\u043A\u0430\u0436\u0438 \u043A\u0430\u0436\u0434\u043E\u0435 \u0432\u0430\u0436\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435, \u0437\u0430\u0442\u0435\u043C \u0440\u0435\u0430\u043A\u0446\u0438\u044E, \u0437\u0430\u0442\u0435\u043C \u0440\u0435\u043F\u043B\u0438\u043A\u0443 \u0438\u043B\u0438 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0448\u0430\u0433. \u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439 \u0431\u044B\u0442\u043E\u0432\u0443\u044E \u0438\u043D\u0442\u043E\u043D\u0430\u0446\u0438\u044E, \u043D\u0435\u043B\u043E\u0432\u043A\u043E\u0441\u0442\u044C, \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u043E\u0442\u0432\u0435\u0442\u044B \u0438 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u0434\u0435\u0442\u0430\u043B\u0438.",
  "\u0424\u0438\u043D\u0430\u043B \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F \u043C\u043E\u0436\u0435\u0442 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0441\u0442\u0440\u043E\u043A\u0438 \xAB\u041A\u041E\u041D\u0415\u0426 \u0421\u0415\u0420\u0418\u0418\xBB, \xAB\u0422\u0435\u043A\u0441\u0442 \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435:\xBB \u0438 \xAB\u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0435\u043D\u0438\u0435 \u0441\u043B\u0435\u0434\u0443\u0435\u0442\u2026\xBB, \u0435\u0441\u043B\u0438 \u044D\u0442\u043E \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0435 \u0441\u0435\u0440\u0438\u0430\u043B\u0430. \u041D\u0435 \u043F\u0440\u044F\u0447\u044C \u0438\u0445 \u0432 \u043A\u0440\u0430\u0442\u043A\u043E\u043C \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0438 \u0438 \u043D\u0435 \u0443\u0434\u0430\u043B\u044F\u0439.",
  "\u0414\u043B\u044F \u0441\u0435\u0440\u0438\u0438 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C\u044E \u0434\u043E 3 \u043C\u0438\u043D\u0443\u0442 \u043F\u0438\u0448\u0438 \u043F\u043E\u043B\u043D\u044B\u0439 \u0441\u0432\u044F\u0437\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442, \u0440\u0430\u0441\u0441\u0447\u0438\u0442\u0430\u043D\u043D\u044B\u0439 \u043D\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u0443\u044E \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0432\u043F\u043B\u043E\u0442\u044C \u0434\u043E 180 \u0441\u0435\u043A\u0443\u043D\u0434 \u043E\u0437\u0432\u0443\u0447\u043A\u0438. \u041D\u0435 \u0434\u0435\u043B\u0430\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043A\u043E\u0440\u043E\u0447\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0434\u0438 \u0443\u043C\u0435\u043D\u044C\u0448\u0435\u043D\u0438\u044F \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0430 \u0441\u0446\u0435\u043D.",
  "\u0421\u0446\u0435\u043D\u044B \u0434\u043E\u043B\u0436\u043D\u044B \u0447\u0438\u0442\u0430\u0442\u044C\u0441\u044F \u043A\u0430\u043A \u0441\u0432\u044F\u0437\u043D\u0430\u044F \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u0432 \u0441\u0442\u0438\u043B\u0435 \u0431\u044B\u0442\u043E\u0432\u043E\u0433\u043E \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F: \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0438 \u043C\u0435\u0441\u0442\u043E, \u0437\u0430\u0442\u0435\u043C \u0440\u0435\u043F\u043B\u0438\u043A\u0438 \u0438 \u0440\u0435\u0430\u043A\u0446\u0438\u044F \u0433\u0435\u0440\u043E\u044F. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u0435 \u0443\u043B\u0438\u0446\u044B, \u0440\u0430\u0439\u043E\u043D\u044B, \u0437\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u044F \u0438 \u0433\u043E\u0440\u043E\u0434\u0441\u043A\u0438\u0435 \u0442\u043E\u0447\u043A\u0438, \u0435\u0441\u043B\u0438 \u0433\u043E\u0440\u043E\u0434 \u0437\u0430\u0434\u0430\u043D.",
  "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043C\u044B\u0441\u043B\u0435\u043D\u043D\u043E \u0432\u044B\u0441\u0442\u0440\u043E\u0439 \u043F\u0440\u0438\u0447\u0438\u043D\u043D\u043E-\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0435\u043D\u043D\u0443\u044E \u0438\u0441\u0442\u043E\u0440\u0438\u044E: hook \u2192 \u0433\u0435\u0440\u043E\u0439 \u0438 \u0435\u0433\u043E \u0446\u0435\u043B\u044C \u2192 \u0441\u043E\u0431\u044B\u0442\u0438\u0435, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u0435\u0442 \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442 \u2192 \u043D\u0430\u0440\u0430\u0441\u0442\u0430\u043D\u0438\u0435 \u043F\u0440\u0435\u043F\u044F\u0442\u0441\u0442\u0432\u0438\u0439 \u2192 \u043A\u0443\u043B\u044C\u043C\u0438\u043D\u0430\u0446\u0438\u044F \u2192 \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435 \u0438 \u043B\u043E\u0433\u0438\u0447\u043D\u044B\u0439 \u0444\u0438\u043D\u0430\u043B. \u0422\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0441\u043B\u0435 \u044D\u0442\u043E\u0433\u043E \u0440\u0430\u0437\u0431\u0438\u0432\u0430\u0439 \u0435\u0451 \u043D\u0430 \u0441\u0446\u0435\u043D\u044B.",
  "\u041A\u0430\u0436\u0434\u0430\u044F \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u043E\u0431\u044F\u0437\u0430\u043D\u0430 \u0431\u044B\u0442\u044C \u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435\u043C \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0439. \u041D\u0435 \u0432\u0432\u043E\u0434\u0438 \u0432\u043D\u0435\u0437\u0430\u043F\u043D\u043E \u043D\u043E\u0432\u044B\u0445 \u0433\u0435\u0440\u043E\u0435\u0432, \u043C\u0435\u0441\u0442 \u0438\u043B\u0438 \u0444\u0430\u043A\u0442\u043E\u0432 \u0431\u0435\u0437 \u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u044F.",
  "\u041D\u0435 \u043F\u0435\u0440\u0435\u0441\u043A\u0430\u043A\u0438\u0432\u0430\u0439 \u043C\u0435\u0436\u0434\u0443 \u043D\u0435\u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u043C\u0438 \u043E\u0431\u0440\u0430\u0437\u0430\u043C\u0438. \u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439 \u043E\u0434\u043D\u043E\u0433\u043E \u0433\u043B\u0430\u0432\u043D\u043E\u0433\u043E \u0433\u0435\u0440\u043E\u044F, \u0432\u0440\u0435\u043C\u044F, \u043C\u0435\u0441\u0442\u043E \u0438 \u043C\u043E\u0442\u0438\u0432\u0430\u0446\u0438\u044E, \u043F\u043E\u043A\u0430 \u0438\u0441\u0442\u043E\u0440\u0438\u044F \u043D\u0435 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u0441\u044F.",
  "\u0412 \u043A\u043E\u043D\u0446\u0435 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0440\u0430\u0437\u0440\u0435\u0448\u0438 \u0433\u043B\u0430\u0432\u043D\u044B\u0439 \u0432\u043E\u043F\u0440\u043E\u0441, \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0439 hook. CTA \u043D\u0435 \u0434\u043E\u043B\u0436\u0435\u043D \u0437\u0430\u043C\u0435\u043D\u044F\u0442\u044C \u0444\u0438\u043D\u0430\u043B \u0438\u0441\u0442\u043E\u0440\u0438\u0438.",
  "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0441\u043E\u0441\u0442\u0430\u0432\u044C \u0434\u043B\u044F \u0441\u0435\u0431\u044F \u043D\u0435\u0432\u0438\u0434\u0438\u043C\u0443\u044E \u043A\u0430\u0440\u0442\u0443: \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0433\u0435\u0440\u043E\u044F, \u0435\u0433\u043E \u0446\u0435\u043B\u044C, \u043F\u0440\u0435\u043F\u044F\u0442\u0441\u0442\u0432\u0438\u0435, \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u0438 \u043D\u043E\u0432\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u043E\u0441\u043B\u0435 \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0446\u0435\u043D\u044B. \u041D\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u043A\u0430\u0440\u0442\u0443 \u043A\u0430\u043A \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0430\u043D\u0430\u043B\u0438\u0437, \u043D\u043E \u043E\u0442\u0440\u0430\u0437\u0438 \u0435\u0451 \u0432 \u043F\u043E\u043B\u044F\u0445 \u0441\u0446\u0435\u043D.",
  "\u0412 \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0446\u0435\u043D\u0435 \u0434\u043E\u043B\u0436\u043D\u043E \u043F\u0440\u043E\u0438\u0437\u043E\u0439\u0442\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435: \u0433\u0435\u0440\u043E\u0439 \u0443\u0437\u043D\u0430\u043B \u0444\u0430\u043A\u0442, \u0441\u0434\u0435\u043B\u0430\u043B \u0432\u044B\u0431\u043E\u0440, \u0441\u0442\u043E\u043B\u043A\u043D\u0443\u043B\u0441\u044F \u0441 \u043F\u0440\u0435\u043F\u044F\u0442\u0441\u0442\u0432\u0438\u0435\u043C, \u043F\u043E\u043B\u0443\u0447\u0438\u043B \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0438\u043B\u0438 \u0438\u0437\u043C\u0435\u043D\u0438\u043B \u043F\u043B\u0430\u043D. \u0415\u0441\u043B\u0438 \u043A\u0430\u0434\u0440 \u043C\u043E\u0436\u043D\u043E \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u0431\u0435\u0437 \u043F\u043E\u0442\u0435\u0440\u0438 \u0438\u0441\u0442\u043E\u0440\u0438\u0438, \u043D\u0435 \u0432\u043A\u043B\u044E\u0447\u0430\u0439 \u0435\u0433\u043E.",
  "\u041D\u0435 \u043F\u0438\u0448\u0438 \u0441\u0446\u0435\u043D\u0443 \u043A\u0430\u043A \u043D\u0430\u0431\u043E\u0440 \u0430\u0442\u043C\u043E\u0441\u0444\u0435\u0440\u044B. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0443\u043A\u0430\u0436\u0438, \u0447\u0442\u043E \u0433\u0435\u0440\u043E\u0439 \u0434\u0435\u043B\u0430\u0435\u0442 \u0438 \u0437\u0430\u0447\u0435\u043C, \u0437\u0430\u0442\u0435\u043C \u0447\u0442\u043E \u0435\u043C\u0443 \u043C\u0435\u0448\u0430\u0435\u0442, \u0437\u0430\u0442\u0435\u043C \u0447\u0435\u043C \u0441\u0446\u0435\u043D\u0430 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0438 \u043F\u043E\u0447\u0435\u043C\u0443 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0439.",
  "\u041D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u0432 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0439 \u0441\u0446\u0435\u043D\u0435 \u043D\u043E\u0432\u044B\u0435 \u0437\u0430\u043A\u0430\u0437\u044B, \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B, \u043B\u044E\u0434\u0435\u0439, \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u0440\u0435\u0448\u0435\u043D\u0438\u044F, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043D\u0435 \u0431\u044B\u043B\u043E \u0432 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0445 \u0441\u0446\u0435\u043D\u0430\u0445. \u0424\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u043A\u0440\u044E\u0447\u043E\u043A \u043E\u0431\u044F\u0437\u0430\u043D \u0431\u044B\u0442\u044C \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0439 \u0434\u0435\u0442\u0430\u043B\u044C\u044E \u0440\u0430\u043D\u044C\u0448\u0435.",
  "voice_text \u2014 \u044D\u0442\u043E \u043F\u043E\u043B\u043D\u043E\u0446\u0435\u043D\u043D\u0430\u044F \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u0430\u044F \u0440\u0435\u043F\u043B\u0438\u043A\u0430/\u0437\u0430\u043A\u0430\u0434\u0440\u043E\u0432\u044B\u0439 \u0442\u0435\u043A\u0441\u0442, \u0430 \u043D\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u043A \u043A\u0430\u0440\u0442\u0438\u043D\u043A\u0435. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u0434\u043E\u0441\u043B\u043E\u0432\u043D\u043E visual_description \u0438 image_prompt.",
  "\u0412 voice_text \u043F\u043E\u043C\u0435\u0449\u0430\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u043E, \u0447\u0442\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u043F\u0440\u043E\u0438\u0437\u043D\u043E\u0441\u0438\u0442\u0441\u044F \u0433\u043E\u043B\u043E\u0441\u043E\u043C: \u0440\u0435\u043F\u043B\u0438\u043A\u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u0436\u0435\u0439 \u0438 \u0437\u0430\u043A\u0430\u0434\u0440\u043E\u0432\u044B\u0439 \u0440\u0430\u0441\u0441\u043A\u0430\u0437. \u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0433\u0435\u0440\u043E\u044F, \u043C\u0438\u043C\u0438\u043A\u0443, \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F, \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B, \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0438 \u0441\u0446\u0435\u043D, \xAB\u041A\u041E\u041D\u0415\u0426 \u0421\u0415\u0420\u0418\u0418\xBB, \xAB\u0422\u0435\u043A\u0441\u0442 \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435\xBB \u0438 \u043D\u0430\u0434\u043F\u0438\u0441\u0438 \u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0439 \u0432 visual_description \u0438\u043B\u0438 ending, \u043D\u043E \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u0432 voice_text.",
  "visual_description \u2014 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0438 \u0435\u0433\u043E \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u043C\u043E\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435. Image prompt \u2014 \u043F\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043E\u0447\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0442\u043E\u0433\u043E \u0436\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441 continuity-\u0434\u0435\u0442\u0430\u043B\u044F\u043C\u0438, \u0430 \u043D\u0435 \u043D\u043E\u0432\u044B\u0439 \u0441\u044E\u0436\u0435\u0442.",
  "\u0412\u0435\u0440\u043D\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 JSON \u0431\u0435\u0437 markdown, \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432 \u0438 \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u043E \u0438\u043B\u0438 \u043F\u043E\u0441\u043B\u0435 JSON.",
  "\u0424\u043E\u0440\u043C\u0430\u0442 JSON \u0441\u0442\u0440\u043E\u0433\u043E \u0442\u0430\u043A\u043E\u0439:",
  JSON.stringify({
    title: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0440\u043E\u043B\u0438\u043A\u0430",
    hook: "\u0421\u0438\u043B\u044C\u043D\u044B\u0439 hook \u043F\u0435\u0440\u0432\u044B\u0445 1-3 \u0441\u0435\u043A\u0443\u043D\u0434",
    description: "\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435",
    duration_seconds: 60,
    scenes: [
      {
        scene_number: 1,
        duration_seconds: 5,
        voice_text: "\u0422\u0435\u043A\u0441\u0442 \u0434\u043B\u044F \u043E\u0437\u0432\u0443\u0447\u043A\u0438",
        visual_description: "\u0427\u0442\u043E \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0434\u0438\u0442 \u0432 \u0441\u0446\u0435\u043D\u0435",
        image_prompt: "\u041F\u043E\u0434\u0440\u043E\u0431\u043D\u044B\u0439 prompt \u0434\u043B\u044F \u0431\u0443\u0434\u0443\u0449\u0435\u0439 \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0438 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F",
        scene_purpose: "\u0417\u0430\u0447\u0435\u043C \u044D\u0442\u0430 \u0441\u0446\u0435\u043D\u0430 \u043D\u0443\u0436\u043D\u0430 \u0438\u0441\u0442\u043E\u0440\u0438\u0438",
        story_beat: "\u042D\u0442\u0430\u043F \u0438\u0441\u0442\u043E\u0440\u0438\u0438: \u0437\u0430\u0432\u044F\u0437\u043A\u0430, \u043E\u0441\u043B\u043E\u0436\u043D\u0435\u043D\u0438\u0435, \u043F\u043E\u0432\u043E\u0440\u043E\u0442, \u043A\u0443\u043B\u044C\u043C\u0438\u043D\u0430\u0446\u0438\u044F, \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435 \u0438\u043B\u0438 \u0444\u0438\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u043A\u0440\u044E\u0447\u043E\u043A",
        cause: "\u0427\u0442\u043E \u0432 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0439 \u0441\u0446\u0435\u043D\u0435 \u0437\u0430\u0441\u0442\u0430\u0432\u0438\u043B\u043E \u0433\u0435\u0440\u043E\u044F \u0434\u0435\u0439\u0441\u0442\u0432\u043E\u0432\u0430\u0442\u044C \u0441\u0435\u0439\u0447\u0430\u0441",
        action: "\u041A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0433\u0435\u0440\u043E\u044F \u0432 \u044D\u0442\u043E\u0439 \u0441\u0446\u0435\u043D\u0435",
        obstacle: "\u0427\u0442\u043E \u043C\u0435\u0448\u0430\u0435\u0442 \u0433\u0435\u0440\u043E\u044E \u0438\u043B\u0438 \u0443\u0441\u043B\u043E\u0436\u043D\u044F\u0435\u0442 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044E",
        change: "\u0427\u0442\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C \u043A \u043A\u043E\u043D\u0446\u0443 \u0441\u0446\u0435\u043D\u044B",
        continuity: "\u0413\u0434\u0435 \u0433\u0435\u0440\u043E\u0439, \u0447\u0442\u043E \u0443 \u043D\u0435\u0433\u043E \u0441 \u0441\u043E\u0431\u043E\u0439, \u0432\u0440\u0435\u043C\u044F, \u043F\u043E\u0433\u043E\u0434\u0430 \u0438 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0435\u0439 \u0441\u0446\u0435\u043D\u044B",
        transition: "\u041F\u043E\u0447\u0435\u043C\u0443 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043D\u0430\u0447\u0430\u0442\u044C\u0441\u044F \u0438\u043C\u0435\u043D\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u044D\u0442\u043E\u0439"
      }
    ],
    ending: "\u0424\u0438\u043D\u0430\u043B\u044C\u043D\u0430\u044F \u0444\u0440\u0430\u0437\u0430",
    cta: "\u041F\u0440\u0438\u0437\u044B\u0432 \u043A \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044E \u0438\u043B\u0438 \u043F\u0443\u0441\u0442\u0430\u044F \u0441\u0442\u0440\u043E\u043A\u0430"
  }),
  "\u0421\u0446\u0435\u043D \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u044B\u0442\u044C \u0441\u0442\u043E\u043B\u044C\u043A\u043E, \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043D\u0443\u0436\u043D\u043E \u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438. \u0414\u043B\u044F 60 \u0441\u0435\u043A\u0443\u043D\u0434 \u043E\u0440\u0438\u0435\u043D\u0442\u0438\u0440\u0443\u0439\u0441\u044F \u043D\u0430 7-12 \u0441\u0446\u0435\u043D, \u0434\u043B\u044F 90-180 \u0441\u0435\u043A\u0443\u043D\u0434 \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0439 10-24 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0445 \u0441\u0446\u0435\u043D.",
  "\u041E\u0440\u0438\u0435\u043D\u0442\u0438\u0440\u044B \u043F\u043E \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0435: \u0441\u0446\u0435\u043D\u044B 1-2 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0442 \u0433\u0435\u0440\u043E\u044F, \u0446\u0435\u043B\u044C \u0438 \u0437\u0430\u043F\u0443\u0441\u043A\u0430\u044E\u0449\u0435\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u0435; \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u0441\u0446\u0435\u043D\u044B \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0434\u0430\u044E\u0442 \u043F\u043E\u043F\u044B\u0442\u043A\u0443, \u043F\u0440\u0435\u043F\u044F\u0442\u0441\u0442\u0432\u0438\u0435 \u0438 \u0440\u0435\u0430\u043A\u0446\u0438\u044E; \u043F\u0435\u0440\u0435\u0434 \u0444\u0438\u043D\u0430\u043B\u043E\u043C \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D \u043F\u043E\u0432\u043E\u0440\u043E\u0442 \u0438\u043B\u0438 \u0432\u044B\u0431\u043E\u0440; \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 2 \u0441\u0446\u0435\u043D\u044B \u0434\u0430\u044E\u0442 \u043A\u0443\u043B\u044C\u043C\u0438\u043D\u0430\u0446\u0438\u044E, \u043F\u043E\u0441\u043B\u0435\u0434\u0441\u0442\u0432\u0438\u0435 \u0438 \u043F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043B\u0435\u043D\u043D\u044B\u0439 \u043A\u0440\u044E\u0447\u043E\u043A.",
  "\u041A\u0430\u0436\u0434\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C voice_text, visual_description, image_prompt, scene_purpose, story_beat, cause, action, obstacle, change, continuity \u0438 transition.",
  "\u0414\u043B\u044F \u0435\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0439 \u043E\u0437\u0432\u0443\u0447\u043A\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043F\u0443\u043D\u043A\u0442\u0443\u0430\u0446\u0438\u044E: \u0437\u0430\u043F\u044F\u0442\u044B\u0435 \u0434\u043B\u044F \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0445 \u043F\u0430\u0443\u0437, \u0442\u0438\u0440\u0435 \u0438 \u043C\u043D\u043E\u0433\u043E\u0442\u043E\u0447\u0438\u0435 \u0434\u043B\u044F \u0432\u044B\u0440\u0430\u0437\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u043F\u0430\u0443\u0437.",
  "\u0412 \u043D\u0435\u043E\u0434\u043D\u043E\u0437\u043D\u0430\u0447\u043D\u044B\u0445 \u0440\u0443\u0441\u0441\u043A\u0438\u0445 \u0441\u043B\u043E\u0432\u0430\u0445 \u043C\u043E\u0436\u0435\u0448\u044C \u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0437\u043D\u0430\u043A \u0443\u0434\u0430\u0440\u0435\u043D\u0438\u044F \u043D\u0430\u0434 \u0433\u043B\u0430\u0441\u043D\u043E\u0439 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0437\xE1\u043C\u043E\u043A/\u0437\u0430\u043C\xF3\u043A), \u043D\u043E \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 markdown \u0438\u043B\u0438 \u0441\u043B\u0443\u0436\u0435\u0431\u043D\u044B\u0435 \u0442\u0435\u0433\u0438.",
  "\u0415\u0441\u043B\u0438 \u0430\u0432\u0442\u043E\u0440 \u043F\u0440\u043E\u0441\u0438\u0442 \u0442\u043E\u0447\u043D\u0443\u044E \u043F\u0430\u0443\u0437\u0443, \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u043C\u0430\u0440\u043A\u0435\u0440 [\u043F\u0430\u0443\u0437\u0430 0.5] \u0432 voice_text; \u043E\u043D \u0431\u0443\u0434\u0435\u0442 \u043E\u0431\u0440\u0430\u0431\u043E\u0442\u0430\u043D \u043F\u0435\u0440\u0435\u0434 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u043E\u0439 \u0432 ElevenLabs.",
  "\u0420\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0441\u043A\u0438\u0435 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u0441\u0435\u0440\u0438\u0430\u043B\u0430 \u0438 continuity:",
  CONTINUITY_EDITOR_RULES_RU
].join("\n");
var horoscopePlanItemSchema = z.object({
  connection_id: z.coerce.number().int().positive(),
  channel_name: z.string().default(""),
  forecast_date: z.string().regex(/^\d{2}\.\d{2}\.\d{4}$/),
  forecast_text: z.string().min(1).max(300),
  second_forecast_text: z.string().min(1).max(300),
  zodiac_sign: z.string().min(1),
  topic: z.string().min(1),
  subtopic: z.string().min(1),
  format: z.string().min(1),
  angle: z.string().min(1),
  hook: z.string().min(1),
  story_outline: z.string().min(1).optional(),
  emotional_tone: z.string().min(1)
}).transform((item) => ({
  ...item,
  story_outline: item.story_outline?.trim() || `${item.forecast_text} \u2192 ${item.second_forecast_text}`
}));
var horoscopeContentPlanSchema = z.object({
  locked_parameters: z.array(z.string().min(1)),
  flexible_parameters: z.array(z.string().min(1)),
  expandable_parameters: z.array(z.string().min(1)),
  items: z.array(horoscopePlanItemSchema).min(1)
});
var horoscopeContentPlanEnvelopeSchema = horoscopeContentPlanSchema.extend({
  items: z.array(z.unknown())
});

// src/lib/image-generation/providers/openrouter.ts
var FALLBACK_IMAGE_MODEL = "google/gemini-2.5-flash-image";
function decodeDataUrl(value) {
  const match = value.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!match) throw new Error("Image provider returned an invalid image payload");
  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) throw new Error("Image provider returned an empty image payload");
  return { contentType: match[1], buffer };
}
function findImageDataUrl(value, depth = 0) {
  if (depth > 5 || value === null || value === void 0) return null;
  if (typeof value === "string") return value.startsWith("data:image/") ? value : null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImageDataUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value;
  for (const key of ["url", "image_url", "imageUrl", "data"]) {
    const found = findImageDataUrl(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}
function getImageDataUrl(data) {
  const message = data.choices?.[0]?.message;
  return findImageDataUrl(message?.images) || findImageDataUrl(message?.content);
}
async function pauseBeforeRetry(attempt) {
  await new Promise((resolve2) => setTimeout(resolve2, 1500 * attempt));
}
var OpenRouterImageProvider = class {
  name = "openrouter";
  model;
  constructor() {
    this.model = process.env["IMAGE_MODEL"] || "google/gemini-3.1-flash-lite-image";
  }
  async generate(prompt, settings) {
    if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
    const fallbackModel = process.env["IMAGE_FALLBACK_MODEL"] || FALLBACK_IMAGE_MODEL;
    const models = [.../* @__PURE__ */ new Set([this.model, fallbackModel])];
    let lastError = "Image provider returned no image";
    for (const [modelIndex, model] of models.entries()) {
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await fetch(openRouterConfig.url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openRouterConfig.apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://replit.com",
              "X-Title": "AI Content Factory"
            },
            body: JSON.stringify({
              model,
              messages: [{ role: "user", content: `${prompt}
Aspect ratio: ${settings.aspectRatio}` }],
              modalities: ["text", "image"]
            }),
            signal: AbortSignal.timeout(18e4)
          });
          const data = await response.json();
          if (!response.ok) {
            lastError = data.error?.message ?? `Image API error (${response.status})`;
            if (response.status < 500 && response.status !== 429) throw new Error(lastError);
            throw new Error(lastError);
          }
          const imageUrl = getImageDataUrl(data);
          if (!imageUrl) throw new Error(`Image provider returned no image for ${model}`);
          const decoded = decodeDataUrl(imageUrl);
          return { ...decoded, width: 1024, height: 1024 };
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Image generation failed";
          if (attempt < 2) await pauseBeforeRetry(attempt);
          else if (modelIndex < models.length - 1) await pauseBeforeRetry(attempt);
        }
      }
    }
    throw new Error(lastError);
  }
};

// src/lib/image-generation/providers/gemini.ts
var DEFAULT_GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
var GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
var GeminiImageProvider = class {
  name = "google-gemini";
  model = process.env["GEMINI_IMAGE_MODEL"] || DEFAULT_GEMINI_IMAGE_MODEL;
  async generate(prompt, settings) {
    const apiKey = process.env["GEMINI_API_KEY"];
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured for Google AI image generation");
    let lastError = "Google Gemini returned no image";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(`${GEMINI_API_URL}/${this.model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${prompt}
Aspect ratio: ${settings.aspectRatio}` }] }],
            generationConfig: {
              responseModalities: ["IMAGE"],
              imageConfig: { aspectRatio: settings.aspectRatio }
            }
          }),
          signal: AbortSignal.timeout(18e4)
        });
        const data = await response.json();
        if (!response.ok) {
          lastError = data.error?.message || `Google Gemini image API error (${response.status})`;
          if (response.status < 500 && response.status !== 429) throw new Error(lastError);
          throw new Error(lastError);
        }
        const inlineData = data.candidates?.[0]?.content?.parts?.find((part) => part.inlineData)?.inlineData;
        if (!inlineData?.data) throw new Error("Google Gemini returned no image data");
        const buffer = Buffer.from(inlineData.data, "base64");
        if (!buffer.length) throw new Error("Google Gemini returned empty image data");
        return {
          buffer,
          contentType: inlineData.mimeType || "image/png",
          width: 1024,
          height: 1024
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Google Gemini image generation failed";
        if (attempt < 3) await new Promise((resolve2) => setTimeout(resolve2, 2e3 * attempt));
      }
    }
    throw new Error(lastError);
  }
};

// src/lib/image-generation/providers/odirouter.ts
var DEFAULT_MODEL2 = "free-nano-banana-2";
var DEFAULT_ENDPOINT = "https://api.odirouter.ai/model/v1/queue/free-nano-banana-2";
function findImagePayload(value, depth = 0) {
  if (depth > 6 || value === null || value === void 0) return null;
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) {
      const match = value.match(/^data:(image\/[^;]+);base64,/);
      return { data: value, contentType: match?.[1] || "image/png" };
    }
    if (/^https?:\/\//.test(value)) return { url: value, contentType: "image/jpeg" };
    if (value.trim().startsWith("{")) {
      try {
        return findImagePayload(JSON.parse(value), depth + 1);
      } catch {
        return null;
      }
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findImagePayload(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== "object") return null;
  const record = value;
  const type = typeof record.type === "string" ? record.type : "";
  const contentType = typeof record.mime_type === "string" ? record.mime_type : typeof record.mimeType === "string" ? record.mimeType : "image/jpeg";
  for (const key of ["url", "image_url", "imageUrl"]) {
    if (typeof record[key] === "string" && /^https?:\/\//.test(record[key])) {
      return { url: record[key], contentType };
    }
  }
  for (const key of ["data", "b64_json", "base64"]) {
    if (typeof record[key] === "string") {
      const raw = record[key];
      return { data: raw.startsWith("data:image/") ? raw : `data:${contentType};base64,${raw}`, contentType };
    }
  }
  if (type === "image" || type === "image_url") {
    return findImagePayload(record.content, depth + 1);
  }
  for (const key of ["content", "output", "results", "images", "image"]) {
    const found = findImagePayload(record[key], depth + 1);
    if (found) return found;
  }
  return null;
}
var OdiRouterImageProvider = class {
  name = "odirouter";
  model = process.env["ODIROUTER_IMAGE_MODEL"] || DEFAULT_MODEL2;
  get endpoint() {
    return process.env["ODIROUTER_IMAGE_ENDPOINT"] || DEFAULT_ENDPOINT.replace(DEFAULT_MODEL2, this.model);
  }
  headers() {
    const apiKey = process.env["ODIROUTER_API_KEY"];
    if (!apiKey) throw new Error("ODIROUTER_API_KEY is not configured");
    return {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    };
  }
  async generateOnce(prompt, settings) {
    const headers = this.headers();
    const queued = await fetch(this.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        prompt,
        aspect_ratio: settings.aspectRatio,
        resolution: process.env["ODIROUTER_IMAGE_RESOLUTION"] || "1K"
      }),
      signal: AbortSignal.timeout(3e4)
    });
    const queueData = await queued.json();
    if (!queued.ok || !queueData.status_url || !queueData.response_url) {
      throw new Error(queueData.error || `OdiRouter queue error (${queued.status})`);
    }
    let status = "IN_PROGRESS";
    for (let attempt = 0; attempt < 36; attempt += 1) {
      const statusResponse = await fetch(queueData.status_url, {
        headers,
        signal: AbortSignal.timeout(3e4)
      });
      const statusData = await statusResponse.json();
      if (!statusResponse.ok) {
        throw new Error(statusData.error || `OdiRouter status error (${statusResponse.status})`);
      }
      status = (statusData.status || "").toUpperCase();
      if (["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(status)) break;
      if (["FAILED", "ERROR", "CANCELLED"].includes(status)) {
        throw new Error(`OdiRouter image generation ${status.toLowerCase()}`);
      }
      await new Promise((resolve2) => setTimeout(resolve2, 5e3));
    }
    if (!["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(status)) {
      throw new Error("OdiRouter image generation timed out");
    }
    const resultResponse = await fetch(queueData.response_url, {
      headers,
      signal: AbortSignal.timeout(3e4)
    });
    const result = await resultResponse.json();
    if (!resultResponse.ok) {
      throw new Error(result.error || `OdiRouter response error (${resultResponse.status})`);
    }
    const image = findImagePayload(result.output) || findImagePayload(result.results);
    if (!image) throw new Error("OdiRouter returned no supported image payload");
    let buffer;
    if (image.data) {
      const match = image.data.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!match) throw new Error("OdiRouter returned invalid base64 image data");
      buffer = Buffer.from(match[1], "base64");
    } else if (image.url) {
      const imageResponse = await fetch(image.url, {
        signal: AbortSignal.timeout(6e4)
      });
      if (!imageResponse.ok) throw new Error(`OdiRouter image download error (${imageResponse.status})`);
      buffer = Buffer.from(await imageResponse.arrayBuffer());
    } else {
      throw new Error("OdiRouter returned an empty image payload");
    }
    if (!buffer.length) throw new Error("OdiRouter returned an empty image");
    return {
      buffer,
      contentType: image.contentType || "image/jpeg",
      width: 1024,
      height: 1024
    };
  }
  async generate(prompt, settings) {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        return await this.generateOnce(prompt, settings);
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve2) => setTimeout(resolve2, 2e3));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("OdiRouter image generation failed");
  }
};

// src/lib/image-generation/providers/fal.ts
var DEFAULT_MODEL3 = "fal-ai/flux/schnell";
function falKey() {
  const key = process.env["FAL_KEY"];
  if (!key) throw new Error("FAL_KEY is not configured");
  return key;
}
function imageSize(aspectRatio) {
  if (aspectRatio === "9:16") return { width: 768, height: 1365 };
  if (aspectRatio === "16:9") return { width: 1365, height: 768 };
  if (aspectRatio === "4:5") return { width: 1024, height: 1280 };
  return { width: 1024, height: 1024 };
}
var FalImageProvider = class {
  name = "fal";
  model = process.env["FAL_IMAGE_MODEL"] || DEFAULT_MODEL3;
  async generate(prompt, settings) {
    const authorization = `Key ${falKey()}`;
    const queued = await fetch(`https://queue.fal.run/${this.model}`, {
      method: "POST",
      headers: { Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `${prompt}
Generate one coherent image. Do not include text, captions, logos, or watermarks.`,
        image_size: imageSize(settings.aspectRatio),
        num_images: 1,
        enable_safety_checker: true
      }),
      signal: AbortSignal.timeout(3e4)
    });
    const rawQueueBody = await queued.text();
    let queueData = {};
    try {
      queueData = JSON.parse(rawQueueBody);
    } catch {
    }
    if (!queued.ok || !queueData.status_url || !queueData.response_url) {
      const detail = queueData.error || rawQueueBody.replace(/\s+/g, " ").trim().slice(0, 300);
      if (queued.status === 401 || queued.status === 403) {
        throw new Error(`fal.ai access denied (${queued.status}). Check that FAL_KEY is active and the fal.ai account has available credits${detail ? `: ${detail}` : ""}`);
      }
      throw new Error(detail || `fal.ai queue error (${queued.status})`);
    }
    let status = "IN_PROGRESS";
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const statusResponse = await fetch(queueData.status_url, {
        headers: { Authorization: authorization },
        signal: AbortSignal.timeout(3e4)
      });
      const statusData = await statusResponse.json();
      if (!statusResponse.ok) throw new Error(statusData.error || `fal.ai status error (${statusResponse.status})`);
      status = (statusData.status || "").toUpperCase();
      if (["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(status)) break;
      if (["FAILED", "ERROR", "CANCELLED"].includes(status)) {
        throw new Error(`fal.ai image generation ${status.toLowerCase()}`);
      }
      await new Promise((resolve2) => setTimeout(resolve2, 2e3));
    }
    if (!["COMPLETED", "SUCCEEDED", "SUCCESS"].includes(status)) {
      throw new Error("fal.ai image generation timed out");
    }
    const resultResponse = await fetch(queueData.response_url, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(3e4)
    });
    const result = await resultResponse.json();
    if (!resultResponse.ok) throw new Error(result.error || `fal.ai result error (${resultResponse.status})`);
    const image = result.images?.[0];
    if (!image?.url) throw new Error("fal.ai returned no image");
    const imageResponse = await fetch(image.url, { signal: AbortSignal.timeout(6e4) });
    if (!imageResponse.ok) throw new Error(`fal.ai image download error (${imageResponse.status})`);
    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    if (!buffer.length) throw new Error("fal.ai returned an empty image");
    const size = imageSize(settings.aspectRatio);
    return {
      buffer,
      contentType: image.content_type || imageResponse.headers.get("content-type") || "image/jpeg",
      width: image.width || size.width,
      height: image.height || size.height
    };
  }
};

// src/lib/image-generation/providers/krea.ts
function aspectPrompt(aspectRatio) {
  return aspectRatio === "16:9" ? "wide 16:9 landscape composition" : "vertical 9:16 portrait composition";
}
var KreaImageProvider = class {
  name = "krea";
  model = process.env["IMAGE_MODEL"] || "krea/krea-2-medium-turbo";
  async generate(prompt, settings) {
    if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
    let lastError = "Krea returned no image";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/images", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterConfig.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://replit.com",
            "X-Title": "AI Content Factory"
          },
          body: JSON.stringify({
            model: this.model,
            prompt: `${prompt}
Composition: ${aspectPrompt(settings.aspectRatio)}`
          }),
          signal: AbortSignal.timeout(18e4)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || `Krea image API error (${response.status})`);
        const item = data.data?.[0];
        if (item?.b64_json) {
          const buffer = Buffer.from(item.b64_json, "base64");
          if (!buffer.length) throw new Error("Krea returned empty image data");
          return { buffer, contentType: "image/png", width: 1024, height: 1024 };
        }
        if (item?.url) {
          const imageResponse = await fetch(item.url, { signal: AbortSignal.timeout(6e4) });
          if (!imageResponse.ok) throw new Error(`Krea image download failed (${imageResponse.status})`);
          return {
            buffer: Buffer.from(await imageResponse.arrayBuffer()),
            contentType: imageResponse.headers.get("content-type") || "image/png",
            width: 1024,
            height: 1024
          };
        }
        throw new Error("Krea returned no image data");
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Krea image generation failed";
        if (attempt < 3) await new Promise((resolve2) => setTimeout(resolve2, attempt * 2e3));
      }
    }
    throw new Error(lastError);
  }
};

// src/lib/supabase.ts
var configuredUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
var serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
var supabaseConfigured = Boolean(configuredUrl && serviceKey);

// src/lib/image-generation/service.ts
var execFileAsync2 = promisify2(execFile2);
function getImageProvider() {
  const provider = (process.env["IMAGE_PROVIDER"] || "krea").toLowerCase();
  if (provider === "krea") return new KreaImageProvider();
  if (provider === "gemini") return new GeminiImageProvider();
  if (provider === "odirouter") return new OdiRouterImageProvider();
  if (provider === "fal") return new FalImageProvider();
  return new OpenRouterImageProvider();
}
var imageProviderQueue = Promise.resolve();
function withImageProviderQueue(task) {
  const queuedTask = imageProviderQueue.then(task, task);
  imageProviderQueue = queuedTask.then(() => void 0, () => void 0);
  return queuedTask;
}
function isInFlightCreditError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /available credits|in-flight requests|add credits|retry after in-flight/iu.test(message);
}
async function generateImageWithRetry(provider, prompt, settings) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      return await withImageProviderQueue(() => provider.generate(prompt, settings));
    } catch (error) {
      if (!isInFlightCreditError(error) || attempt === 5) throw error;
      const delayMs = Math.min(6e4, attempt * 15e3);
      logger.warn({ attempt, delayMs }, "Image provider is at its in-flight credit limit; waiting before retry");
      await new Promise((resolve2) => setTimeout(resolve2, delayMs));
    }
  }
  throw new Error("Image generation retry limit reached");
}
async function generateStandaloneImage(prompt, settings) {
  return generateImageWithRetry(getImageProvider(), prompt, settings);
}

// src/lib/stock-media.ts
import { execFile as execFile3 } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join as join2 } from "node:path";
import { promisify as promisify3 } from "node:util";
var MAX_DOWNLOAD_BYTES = 45 * 1024 * 1024;
var MAX_SOURCE_DOWNLOAD_BYTES = 120 * 1024 * 1024;
var SEARCH_TIMEOUT_MS = 2e4;
var DOWNLOAD_TIMEOUT_MS = 6e4;
var USER_AGENT = "AI-Content-Factory/1.0 (licensed stock media collector)";
var execFileAsync3 = promisify3(execFile3);
function wait(milliseconds) {
  return new Promise((resolve2) => setTimeout(resolve2, milliseconds));
}
function asNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function asString(value) {
  return typeof value === "string" && value.trim() ? value : null;
}
function isCommerciallyUsableLicense(license) {
  if (!license) return false;
  const normalized = license.toLocaleLowerCase();
  if (normalized.includes("nc") || normalized.includes("nd")) return false;
  return normalized.includes("cc0") || normalized.includes("pdm") || normalized === "by" || normalized === "by-sa" || normalized.includes("public domain") || normalized.includes("zero");
}
async function fetchJson(url, init = {}) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url, {
      ...init,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...init.headers || {}
      },
      signal: init.signal ?? AbortSignal.timeout(SEARCH_TIMEOUT_MS)
    });
    if (response.ok) return response.json();
    if (response.status !== 429 || attempt === 3) {
      throw new Error(`Stock provider returned ${response.status}`);
    }
    await wait(Math.min(12e3, attempt * 4e3));
  }
  throw new Error("Stock provider request retry limit reached");
}
function pexelsApiKey() {
  return process.env["PEXELS_API_KEY"]?.trim() || "";
}
function pexelsHeaders() {
  return { Authorization: pexelsApiKey() };
}
async function searchPexels(query, kind) {
  if (!pexelsApiKey()) return [];
  const endpoint = kind === "image" ? "photos" : "videos";
  const url = new URL(`https://api.pexels.com/v1/search`);
  if (kind === "video") url.pathname = "/videos/search";
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "portrait");
  const data = await fetchJson(url.toString(), { headers: pexelsHeaders() });
  if (kind === "image") {
    const photos = Array.isArray(data.photos) ? data.photos : [];
    return photos.flatMap((photo) => {
      if (!photo || typeof photo !== "object") return [];
      const raw = photo;
      const src = raw.src && typeof raw.src === "object" ? raw.src : {};
      const sourceUrl = asString(raw.url);
      const downloadUrl = asString(src.portrait) || asString(src.large2x) || asString(src.original);
      if (!sourceUrl || !downloadUrl) return [];
      return [{
        provider: "pexels",
        id: String(raw.id || downloadUrl),
        kind,
        title: asString(raw.alt) || query,
        sourceUrl,
        downloadUrl,
        creator: asString(raw.photographer),
        creatorUrl: asString(raw.photographer_url),
        license: "Pexels License",
        licenseUrl: "https://www.pexels.com/license/",
        attribution: asString(raw.photographer) ? `Photo by ${raw.photographer} via Pexels` : "Pexels",
        width: asNumber(raw.width),
        height: asNumber(raw.height),
        durationSeconds: null,
        contentType: "image/jpeg"
      }];
    });
  }
  const videos = Array.isArray(data.videos) ? data.videos : [];
  return videos.flatMap((video) => {
    if (!video || typeof video !== "object") return [];
    const raw = video;
    const files = Array.isArray(raw.video_files) ? raw.video_files : [];
    const file = files.filter((candidate) => Boolean(candidate && typeof candidate === "object")).filter((candidate) => asString(candidate.link)?.startsWith("http")).sort((a, b) => {
      const aSize = Math.abs((asNumber(a.width) || 720) - 720);
      const bSize = Math.abs((asNumber(b.width) || 720) - 720);
      return aSize - bSize;
    })[0];
    const sourceUrl = asString(raw.url);
    const downloadUrl = file ? asString(file.link) : null;
    if (!sourceUrl || !downloadUrl) return [];
    return [{
      provider: "pexels",
      id: String(raw.id || downloadUrl),
      kind,
      title: query,
      sourceUrl,
      downloadUrl,
      creator: asString(raw.user && typeof raw.user === "object" ? raw.user.name : null),
      creatorUrl: asString(raw.user && typeof raw.user === "object" ? raw.user.url : null),
      license: "Pexels License",
      licenseUrl: "https://www.pexels.com/license/",
      attribution: "Pexels",
      width: file ? asNumber(file.width) : asNumber(raw.width),
      height: file ? asNumber(file.height) : asNumber(raw.height),
      durationSeconds: asNumber(raw.duration),
      contentType: asString(file?.file_type) || "video/mp4"
    }];
  });
}
async function searchOpenverse(query) {
  const url = new URL("https://api.openverse.org/v1/images/");
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", "8");
  url.searchParams.set("mature", "false");
  url.searchParams.set("license_type", "commercial");
  const data = await fetchJson(url.toString());
  const results = Array.isArray(data.results) ? data.results : [];
  return results.flatMap((result) => {
    if (!result || typeof result !== "object") return [];
    const raw = result;
    const downloadUrl = asString(raw.url);
    const sourceUrl = asString(raw.foreign_landing_url) || asString(raw.detail_url);
    const license = asString(raw.license);
    if (!downloadUrl || !sourceUrl || !isCommerciallyUsableLicense(license)) return [];
    return [{
      provider: "openverse",
      id: String(raw.id || downloadUrl),
      kind: "image",
      title: asString(raw.title) || query,
      sourceUrl,
      downloadUrl,
      creator: asString(raw.creator),
      creatorUrl: asString(raw.creator_url),
      license,
      licenseUrl: asString(raw.license_url),
      attribution: asString(raw.attribution),
      width: asNumber(raw.width),
      height: asNumber(raw.height),
      durationSeconds: null,
      contentType: asString(raw.filetype)
    }];
  });
}
async function searchWikimediaVideo(query) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", `${query} filetype:video`);
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrlimit", "8");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|size|duration|extmetadata");
  url.searchParams.set("format", "json");
  const data = await fetchJson(url.toString());
  const pages = data.query && typeof data.query === "object" ? data.query.pages : null;
  const values = pages && typeof pages === "object" ? Object.values(pages) : [];
  return values.flatMap((page) => {
    if (!page || typeof page !== "object") return [];
    const rawPage = page;
    const info = Array.isArray(rawPage.imageinfo) && rawPage.imageinfo[0] && typeof rawPage.imageinfo[0] === "object" ? rawPage.imageinfo[0] : null;
    if (!info || !/^video\//i.test(asString(info.mime) || "") && !/^(application\/ogg|video\/ogg)$/i.test(asString(info.mime) || "")) {
      return [];
    }
    const ext = info.extmetadata && typeof info.extmetadata === "object" ? info.extmetadata : {};
    const metadataValue = (key) => {
      const field = ext[key];
      return field && typeof field === "object" ? asString(field.value) : asString(field);
    };
    const downloadUrl = asString(info.url);
    const sourceUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(String(rawPage.title || "").replaceAll(" ", "_"))}`;
    if (!downloadUrl) return [];
    const size = asNumber(info.size);
    if (size && size > MAX_SOURCE_DOWNLOAD_BYTES) return [];
    return [{
      provider: "wikimedia-commons",
      id: String(rawPage.pageid || downloadUrl),
      kind: "video",
      title: String(rawPage.title || query).replace(/^File:/, ""),
      sourceUrl,
      downloadUrl,
      creator: metadataValue("Artist"),
      creatorUrl: null,
      license: metadataValue("LicenseShortName") || "Wikimedia Commons license",
      licenseUrl: metadataValue("LicenseUrl"),
      attribution: metadataValue("Attribution"),
      width: asNumber(info.width),
      height: asNumber(info.height),
      durationSeconds: asNumber(info.duration),
      contentType: asString(info.mime)
    }];
  });
}
async function searchNasaVideo(query) {
  const searchUrl = new URL("https://images-api.nasa.gov/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("media_type", "video");
  searchUrl.searchParams.set("page_size", "8");
  const data = await fetchJson(searchUrl.toString());
  const items = Array.isArray(data.collection?.items) ? data.collection.items : [];
  return (await Promise.all(items.map(async (item) => {
    const metadata = item.data?.[0];
    if (!metadata) return [];
    const nasaId = asString(metadata.nasa_id);
    const title = asString(metadata.title);
    if (!nasaId || !title) return [];
    const collectionUrl = `https://images-assets.nasa.gov/video/${encodeURIComponent(nasaId)}/collection.json`;
    try {
      const collection = await fetchJson(collectionUrl);
      if (!Array.isArray(collection)) return [];
      const mediaUrl = collection.filter((value) => typeof value === "string" && /\.mp4(?:$|[?#])/i.test(value)).sort((a, b) => {
        const rank = (url) => url.includes("~mobile.mp4") ? 0 : url.includes("~medium.mp4") ? 1 : url.includes("~large.mp4") ? 2 : 3;
        return rank(a) - rank(b);
      })[0];
      if (!mediaUrl) return [];
      const description = asString(metadata.description);
      const credit = description?.match(/credit:\s*([^.\n]+)/iu)?.[1]?.trim() || "NASA";
      return [{
        provider: "nasa",
        id: nasaId,
        kind: "video",
        title,
        sourceUrl: `https://images.nasa.gov/details/${encodeURIComponent(nasaId)}`,
        downloadUrl: mediaUrl.replace(/^http:/i, "https:"),
        creator: credit,
        creatorUrl: "https://www.nasa.gov/multimedia/guidelines/index.html",
        license: "NASA Media Usage Guidelines",
        licenseUrl: "https://www.nasa.gov/multimedia/guidelines/index.html",
        attribution: `NASA${credit === "NASA" ? "" : ` / ${credit}`}`,
        width: null,
        height: null,
        durationSeconds: null,
        contentType: "video/mp4"
      }];
    } catch (error) {
      logger.warn({ err: error, query, nasaId }, "NASA video metadata lookup failed");
      return [];
    }
  }))).flat();
}
async function downloadStockCandidate(candidate) {
  if (!supabaseConfigured) {
    throw new Error("Supabase storage is required to save stock media.");
  }
  let response = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    response = await fetch(candidate.downloadUrl, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      headers: {
        "User-Agent": USER_AGENT,
        Accept: candidate.kind === "video" ? "video/*,*/*;q=0.8" : "image/*,*/*;q=0.8"
      }
    });
    if (response.status !== 429 || attempt === 4) break;
    await wait(Math.min(15e3, attempt * 5e3));
  }
  if (!response) throw new Error(`${candidate.provider} returned no response`);
  if (!response.ok) throw new Error(`${candidate.provider} download returned ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_DOWNLOAD_BYTES) throw new Error("Stock file is larger than 45 MB");
  let buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_SOURCE_DOWNLOAD_BYTES) throw new Error("Stock source file is larger than 120 MB");
  let contentType = candidate.contentType || response.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
  if (candidate.kind === "video" && contentType !== "video/mp4") {
    const tempDir = await mkdtemp(join2("/tmp", "stock-video-"));
    const inputPath = join2(tempDir, "source");
    const outputPath = join2(tempDir, "normalized.mp4");
    try {
      await writeFile(inputPath, buffer);
      await execFileAsync3("ffmpeg", [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        inputPath,
        "-t",
        "20",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputPath
      ], { maxBuffer: 2 * 1024 * 1024 });
      buffer = await readFile(outputPath);
      contentType = "video/mp4";
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => void 0);
    }
  }
  if (buffer.byteLength > MAX_DOWNLOAD_BYTES) throw new Error("Normalized stock file is larger than 45 MB");
  return { buffer, contentType };
}
async function searchStockCandidates(query, kind) {
  const providers = kind === "image" ? [
    async () => searchPexels(query, kind),
    async () => searchOpenverse(query)
  ] : [
    async () => searchPexels(query, kind),
    async () => searchNasaVideo(query),
    async () => searchWikimediaVideo(query)
  ];
  const found = [];
  for (const provider of providers) {
    try {
      found.push(...await provider());
    } catch (error) {
      logger.warn({ err: error, kind, query }, "Stock provider search failed");
    }
  }
  return [...new Map(found.map((candidate) => [
    `${candidate.provider}:${candidate.id}`,
    candidate
  ])).values()];
}

// src/lib/financial-visual-assets.ts
var execFileAsync4 = promisify4(execFile4);
var MAX_VISUAL_MEDIA_BYTES = 30 * 1024 * 1024;
var MAX_NORMALIZED_VISUAL_BYTES = 512 * 1024;
var CONCEPT_MEDIA = {
  bond_flow: {
    stockQueries: ["finance district office building", "business finance office meeting"],
    illustrationSubject: "a folded blank bond certificate beside one unbranded coin",
    stockMomentKinds: ["document", "money_flow", "concept_card"],
    illustrationMomentKinds: ["timeline", "metric", "sticker", "concept_card"]
  },
  equity_split: {
    stockQueries: ["stock exchange exterior building", "company shareholder meeting"],
    illustrationSubject: "a clean modern office tower with two simple share tiles",
    stockMomentKinds: ["ownership", "market_chart", "concept_card"],
    illustrationMomentKinds: ["ownership", "comparison", "sticker", "concept_card"]
  },
  fund_pool: {
    stockQueries: ["diversified investment assets", "investment planning office"],
    illustrationSubject: "a glass bowl holding several distinct neutral asset tokens",
    stockMomentKinds: ["portfolio", "ownership", "concept_card"],
    illustrationMomentKinds: ["portfolio", "comparison", "sticker", "concept_card"]
  },
  profit_distribution: {
    stockQueries: ["company shareholder meeting", "business owners discussing company results"],
    illustrationSubject: "a simple dividend envelope releasing coins toward separate recipient nodes",
    stockMomentKinds: ["distribution", "money_flow", "concept_card"],
    illustrationMomentKinds: ["distribution", "reinvestment", "sticker", "concept_card"]
  },
  compound_interest: {
    stockQueries: ["savings coins investment", "long term savings concept"],
    illustrationSubject: "three coin stacks that increase in height beside a small growing leaf",
    stockMomentKinds: ["compound_growth", "reinvestment", "concept_card"],
    illustrationMomentKinds: ["compound_growth", "reinvestment", "sticker", "concept_card"]
  },
  futures_contract: {
    stockQueries: ["commodity port containers warehouse", "grain storage commodity market"],
    illustrationSubject: "two opposing abstract contract tabs connected by one simple market route",
    stockMomentKinds: ["payoff", "risk", "concept_card"],
    illustrationMomentKinds: ["payoff", "comparison", "sticker", "concept_card"]
  },
  generic_finance: {
    stockQueries: ["financial planning documents finance", "investment planning desk"],
    illustrationSubject: "a neutral finance concept made from a document, one coin, and a clean upward route",
    stockMomentKinds: ["concept_card", "document", "money_flow"],
    illustrationMomentKinds: ["concept_card", "comparison", "sticker"]
  }
};
var STOCK_LICENSES_WITHOUT_ATTRIBUTION = [
  "cc0",
  "cc-zero",
  "pdm",
  "public domain",
  "publicdomain",
  "zero"
];
function isAttributionFreeStock(candidate) {
  const license = candidate.license.toLocaleLowerCase();
  return candidate.provider === "pexels" || STOCK_LICENSES_WITHOUT_ATTRIBUTION.some((term) => license.includes(term));
}
function findMoment(candidates, preferredKinds, excludedId) {
  return candidates.find(({ moment }) => moment.id !== excludedId && preferredKinds.includes(moment.kind)) ?? candidates.find(({ moment }) => moment.id !== excludedId);
}
function listMoments(beats) {
  return beats.flatMap((beat, beatIndex) => (beat.visualMoments ?? []).map((moment) => ({
    beatIndex,
    moment
  })));
}
function pngHasAlphaChannel(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 26 || !buffer.subarray(0, 8).equals(signature)) return false;
  return buffer[25] === 4 || buffer[25] === 6;
}
async function normalizeRaster(buffer, mode) {
  if (!buffer.length || buffer.length > MAX_VISUAL_MEDIA_BYTES) {
    throw new Error("Financial visual image is empty or larger than 30 MB.");
  }
  const tempDir = await mkdtemp2(join3(tmpdir(), "financial-visual-"));
  const inputPath = join3(tempDir, "source-image");
  const isCutout = mode === "cutout";
  const outputPath = join3(tempDir, isCutout ? "cutout.png" : "visual.jpg");
  const filters = isCutout ? "format=rgba,scale=320:320:force_original_aspect_ratio=decrease:flags=lanczos,pad=320:320:(ow-iw)/2:(oh-ih)/2:color=0x00000000" : mode === "photo" ? "scale=768:256:force_original_aspect_ratio=increase:flags=lanczos,crop=768:256,format=yuv420p" : "scale=768:256:force_original_aspect_ratio=decrease:flags=lanczos,pad=768:256:(ow-iw)/2:(oh-ih)/2:color=0x0B151D,format=yuv420p";
  try {
    await writeFile2(inputPath, buffer);
    await execFileAsync4("ffmpeg", [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-vf",
      filters,
      "-frames:v",
      "1",
      ...isCutout ? ["-compression_level", "9"] : ["-q:v", "6"],
      outputPath
    ], { timeout: 6e4, maxBuffer: 2 * 1024 * 1024 });
    const normalized = await readFile2(outputPath);
    if (!normalized.length || normalized.length > MAX_NORMALIZED_VISUAL_BYTES) {
      throw new Error("Normalized financial visual image is empty or larger than 512 KB.");
    }
    return {
      buffer: normalized,
      contentType: isCutout ? "image/png" : "image/jpeg"
    };
  } finally {
    await rm2(tempDir, { recursive: true, force: true }).catch(() => void 0);
  }
}
function makeDataUri(buffer, contentType) {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}
async function findLicensedPhoto(queries) {
  let downloadAttempts = 0;
  for (const query of queries) {
    const candidates = (await searchStockCandidates(query, "image")).filter((candidate) => isAttributionFreeStock(candidate) && /^https?:\/\//i.test(candidate.sourceUrl)).slice(0, 2);
    for (const candidate of candidates) {
      if (downloadAttempts >= 2) return null;
      downloadAttempts += 1;
      try {
        const downloaded = await downloadStockCandidate(candidate);
        const normalized = await normalizeRaster(downloaded.buffer, "photo");
        return {
          dataUri: makeDataUri(normalized.buffer, normalized.contentType),
          medium: "licensed_photo",
          renderMode: "photo",
          title: candidate.title,
          sourceUrl: candidate.sourceUrl,
          creator: candidate.creator,
          license: candidate.license,
          licenseUrl: candidate.licenseUrl
        };
      } catch (error) {
        logger.warn({ err: error, provider: candidate.provider, candidateId: candidate.id }, "Financial stock photo could not be prepared");
      }
    }
  }
  return null;
}
async function generateEditorialIllustration(concept, subject) {
  const prompt = [
    `Create one polished editorial illustration of ${subject}.`,
    "Single still-life subject, isolated, with a transparent background when supported.",
    "Do not include words, letters, numbers, percentages, currency symbols, logos, brands, or readable interface text.",
    "Do not depict a real company, real security, or specific market data.",
    "Use a restrained premium fintech palette: deep navy, warm ivory, muted teal, and small antique-gold accents; soft studio lighting; clear silhouette.",
    `This image is a topic-neutral visual metaphor for ${concept.replaceAll("_", " ")}; it must not make a financial claim.`
  ].join(" ");
  const generated = await generateStandaloneImage(prompt, {
    aspectRatio: "1:1",
    visualStyle: "premium editorial fintech still-life illustration",
    realism: "soft stylized 3D illustration, clean shapes, no photorealistic text",
    people: "none",
    colorAtmosphere: "deep navy, warm ivory, muted teal, restrained antique gold, soft studio lighting"
  });
  const hasAlpha = generated.contentType.toLocaleLowerCase().includes("png") && pngHasAlphaChannel(generated.buffer);
  const normalized = await normalizeRaster(generated.buffer, hasAlpha ? "cutout" : "illustration");
  return {
    dataUri: makeDataUri(normalized.buffer, normalized.contentType),
    medium: hasAlpha ? "ai_cutout" : "ai_illustration",
    renderMode: hasAlpha ? "cutout" : "photo",
    title: `AI editorial illustration: ${subject}`
  };
}
function mediaNotice(assets) {
  const photoCount = Object.values(assets).filter((asset) => asset.medium === "licensed_photo").length;
  const aiCount = Object.values(assets).filter((asset) => asset.medium !== "licensed_photo").length;
  const sources = [];
  if (photoCount) sources.push(`${photoCount} \u043B\u0438\u0446\u0435\u043D\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0435 \u0442\u0435\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0435 \u0444\u043E\u0442\u043E`);
  if (aiCount) sources.push(`${aiCount} AI-\u0438\u043B\u043B\u044E\u0441\u0442\u0440\u0430\u0446\u0438\u044F${aiCount === 1 ? "" : "\u0438"}`);
  return sources.length ? `${sources.join(" + ")}; \u0433\u0440\u0430\u0444\u0438\u043A\u0438, \u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441\u043D\u044B\u0435 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438, \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B, \u0441\u0445\u0435\u043C\u044B \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u0438 \u043E\u0441\u0442\u0430\u044E\u0442\u0441\u044F \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043D\u044B\u043C\u0438.` : "\u0412\u043D\u0435\u0448\u043D\u0438\u0435 \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B; \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u044B \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043D\u044B\u0435 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438, \u0433\u0440\u0430\u0444\u0438\u043A\u0438, \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u0438 \u0441\u0445\u0435\u043C\u044B.";
}
async function resolveFinancialVisualAssets(beats, concept) {
  const preparedBeats = beats.map((beat) => ({
    ...beat,
    visualMoments: beat.visualMoments?.map((moment) => ({ ...moment }))
  }));
  const moments = listMoments(preparedBeats);
  const mediaGuide = CONCEPT_MEDIA[concept];
  const photoMoment = findMoment(moments, mediaGuide.stockMomentKinds);
  const laterSceneMoments = photoMoment ? moments.filter(({ beatIndex }) => beatIndex !== photoMoment.beatIndex) : moments;
  const illustrationMoment = findMoment(
    laterSceneMoments,
    mediaGuide.illustrationMomentKinds,
    photoMoment?.moment.id
  ) ?? findMoment(moments, mediaGuide.illustrationMomentKinds, photoMoment?.moment.id);
  const assets = {};
  const notices = [];
  const tasks = [];
  if (photoMoment) {
    tasks.push((async () => {
      try {
        const photo = await findLicensedPhoto(mediaGuide.stockQueries);
        if (!photo) {
          notices.push("\u0414\u043B\u044F \u0442\u0435\u043C\u044B \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u0444\u043E\u0442\u043E \u0441 \u043B\u0438\u0446\u0435\u043D\u0437\u0438\u0435\u0439 \u0431\u0435\u0437 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0430\u0442\u0440\u0438\u0431\u0443\u0446\u0438\u0438.");
          return;
        }
        const assetId = "financial-licensed-photo";
        photoMoment.moment.assetId = assetId;
        photoMoment.moment.presentationStyle = "image_sticker";
        assets[assetId] = photo;
      } catch (error) {
        logger.warn({ err: error, concept }, "Financial licensed photo search failed");
        notices.push("\u041F\u043E\u0438\u0441\u043A \u043B\u0438\u0446\u0435\u043D\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0433\u043E \u0444\u043E\u0442\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0441\u044F \u0431\u0435\u0437 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0433\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430.");
      }
    })());
  }
  if (illustrationMoment) {
    tasks.push((async () => {
      try {
        const illustration = await generateEditorialIllustration(concept, mediaGuide.illustrationSubject);
        const assetId = "financial-ai-illustration";
        illustrationMoment.moment.assetId = assetId;
        illustrationMoment.moment.presentationStyle = illustration.renderMode === "cutout" ? "cutout_object" : "image_sticker";
        assets[assetId] = illustration;
      } catch (error) {
        logger.warn({ err: error, concept }, "Financial AI illustration generation failed");
        notices.push("AI-\u0438\u043B\u043B\u044E\u0441\u0442\u0440\u0430\u0446\u0438\u044F \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430; \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u043B\u0430\u043D \u0441\u043E\u0445\u0440\u0430\u043D\u0451\u043D \u043D\u0430 \u043F\u0440\u043E\u0433\u0440\u0430\u043C\u043C\u043D\u043E\u0439 \u0433\u0440\u0430\u0444\u0438\u043A\u0435.");
      }
    })());
  }
  await Promise.all(tasks);
  if (!photoMoment) notices.push("\u0412 \u043F\u043B\u0430\u043D\u0435 \u043D\u0435\u0442 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0433\u043E \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u0434\u043B\u044F \u0442\u0435\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u0444\u043E\u0442\u043E.");
  if (!illustrationMoment) notices.push("\u0412 \u043F\u043B\u0430\u043D\u0435 \u043D\u0435\u0442 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0433\u043E \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u0434\u043B\u044F AI-\u0438\u043B\u043B\u044E\u0441\u0442\u0440\u0430\u0446\u0438\u0438.");
  const credits = Object.values(assets).filter((asset) => asset.medium === "licensed_photo" && asset.sourceUrl).map((asset) => [
    `\u0424\u043E\u0442\u043E: ${asset.title}`,
    asset.creator ? `\u0430\u0432\u0442\u043E\u0440 ${asset.creator}` : "",
    asset.license ? `\u043B\u0438\u0446\u0435\u043D\u0437\u0438\u044F ${asset.license}` : "",
    asset.licenseUrl ? `\u0443\u0441\u043B\u043E\u0432\u0438\u044F ${asset.licenseUrl}` : "",
    asset.sourceUrl
  ].filter(Boolean).join(" \xB7 "));
  if (notices.length) {
    logger.info({ concept, notices }, "Financial visual media resolved with fallback notes");
  }
  const notice = [mediaNotice(assets), ...new Set(notices)].filter(Boolean).join(" ");
  return {
    beats: preparedBeats,
    assets,
    notice,
    credits
  };
}

// src/lib/crypto-f2-motion.ts
var CRYPTO_F2_OBJECT_MOTIFS = [
  "token",
  "block",
  "chain",
  "wallet",
  "key",
  "shield",
  "network",
  "ledger",
  "bridge",
  "magnifier",
  "orb"
];
var CRYPTO_F2_MOTION_ACTIONS = [
  "assemble",
  "unfold",
  "morph",
  "reveal",
  "transfer",
  "flow",
  "orbit",
  "split_merge",
  "pulse",
  "scan",
  "lock",
  "build"
];
var CRYPTO_F2_ENTRY_ANIMATIONS = [
  "card_pop",
  "sticker_pop",
  "bounce",
  "slide_left",
  "slide_right",
  "slide_top",
  "slide_bottom",
  "scale_pop",
  "elastic_pop",
  "rotate_scale",
  "flip",
  "swipe",
  "spring",
  "floating",
  "notification",
  "overshoot",
  "arc_left",
  "arc_right",
  "arc_top",
  "arc_bottom",
  "spiral_in",
  "unfold_in",
  "draw_on",
  "shards_in",
  "magnet_snap",
  "depth_pop",
  "mask_reveal",
  "orbit_in",
  "ripple_in",
  "glitch_reform",
  "flow_in",
  "split_assemble"
];
var CRYPTO_F2_EXIT_ANIMATIONS = [
  "slide_left",
  "slide_right",
  "slide_top",
  "slide_bottom",
  "shrink",
  "fade",
  "hold",
  "arc_out_left",
  "arc_out_right",
  "spiral_out",
  "fold_away",
  "dissolve",
  "shatter",
  "pull_back",
  "orbit_out",
  "flow_out",
  "glitch_out",
  "vanish",
  "transfer_out",
  "scale_through",
  "scatter",
  "turn_away"
];
var CRYPTO_F2_TRANSITIONS = [
  "cut",
  "light_flash",
  "radial_wipe",
  "center_split_wipe",
  "horizontal_sweep",
  "vertical_wipe",
  "zoom_blur",
  "object_match_cut",
  "shape_morph",
  "particle_dissolve",
  "whip_pan",
  "orbit_wipe",
  "split_reveal",
  "ripple_wipe",
  "object_push",
  "chain_link",
  "light_sweep"
];
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : void 0;
}
function stringValue(value) {
  return typeof value === "string" ? value : "";
}
function numberValue(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function cryptoF2MotionFingerprintFromPlan(value) {
  const plan2 = asRecord(value);
  if (!plan2 || plan2.visualTheme !== "crypto_f2") return void 0;
  if (typeof plan2.cryptoF2MotionFingerprint === "string" && plan2.cryptoF2MotionFingerprint) {
    return plan2.cryptoF2MotionFingerprint;
  }
  if (!Array.isArray(plan2.beats)) return void 0;
  const scenes = plan2.beats.map((beatValue) => {
    const beat = asRecord(beatValue);
    if (!beat) return "";
    const moments = Array.isArray(beat.visualMoments) ? beat.visualMoments.map((momentValue) => {
      const moment = asRecord(momentValue);
      if (!moment) return "";
      const microBeats = Array.isArray(moment.microBeats) ? moment.microBeats.map((microBeatValue) => {
        const microBeat = asRecord(microBeatValue);
        return microBeat ? [
          stringValue(microBeat.kind),
          stringValue(microBeat.enterAnimation),
          stringValue(microBeat.exitAnimation),
          String(numberValue(microBeat.motionVariant))
        ].join(".") : "";
      }).join(",") : "";
      return [
        stringValue(moment.objectMotif),
        stringValue(moment.motionAction),
        stringValue(moment.enterAnimation),
        stringValue(moment.exitAnimation),
        String(numberValue(moment.motionVariant)),
        microBeats
      ].join(".");
    }).join(",") : "";
    return `${stringValue(beat.transitionIn)}:${moments}`;
  }).join("|");
  return scenes || void 0;
}
function cryptoF2VariationIndex(seed, count) {
  if (!Number.isInteger(count) || count < 1) return 0;
  let hash = 2166136261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) % count;
}
function chooseDistinctCryptoF2Motion(requested, candidates, used, seed) {
  if (candidates.length === 0) return requested;
  if (!used.has(requested)) {
    used.add(requested);
    return requested;
  }
  const start = cryptoF2VariationIndex(seed, candidates.length);
  for (let offset = 0; offset < candidates.length; offset += 1) {
    const candidate = candidates[(start + offset) % candidates.length];
    if (used.has(candidate)) continue;
    used.add(candidate);
    return candidate;
  }
  const fallback = candidates[start];
  used.add(fallback);
  return fallback;
}

// src/lib/financial-topic-engine.ts
var MAX_FINANCIAL_TOPIC_LENGTH = 180;
var MAX_FINANCIAL_CTA_LENGTH = 240;
var MIN_DURATION_SECONDS = 45;
var MAX_DURATION_SECONDS = 150;
var MIN_SCENES2 = 6;
var MAX_SCENES2 = 12;
function textValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
function stableChoiceIndex(seed, count) {
  let hash = 2166136261;
  for (const character of seed) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  }
  return (hash >>> 0) % count;
}
function normalizeFinancialCta(value) {
  const cta = value.trim().replace(/\s+/g, " ");
  if (cta.length > MAX_FINANCIAL_CTA_LENGTH) {
    throw new Error(`CTA \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0435 \u0434\u043B\u0438\u043D\u043D\u0435\u0435 ${MAX_FINANCIAL_CTA_LENGTH} \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.`);
  }
  return cta;
}
function numberValue2(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function stringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 8);
}
function parseJson(content) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("\u0424\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u0439 AI \u043D\u0435 \u0432\u0435\u0440\u043D\u0443\u043B JSON-\u043F\u043B\u0430\u043D.");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}
async function requestOpenRouterJson(system, user, errorLabel, maxCompletionTokens = 5e3) {
  if (!openRouterConfig.apiKey) throw new Error("OPENROUTER_API_KEY is not configured");
  const models = Array.from(/* @__PURE__ */ new Set([openRouterConfig.model, openRouterConfig.fallbackModel]));
  let lastError = "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430";
  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const response = await fetch(openRouterConfig.url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openRouterConfig.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://replit.com",
            "X-Title": "AI Content Factory Finance"
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: system },
              { role: "user", content: user }
            ],
            max_completion_tokens: maxCompletionTokens,
            response_format: { type: "json_object" },
            ...model.startsWith("openai/gpt-5") ? { reasoning: { effort: "minimal" } } : {}
          }),
          signal: AbortSignal.timeout(18e4)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || `OpenRouter API error (${response.status})`);
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) throw new Error(`OpenRouter \u0432\u0435\u0440\u043D\u0443\u043B \u043F\u0443\u0441\u0442\u043E\u0439 \u043E\u0442\u0432\u0435\u0442: ${errorLabel}.`);
        return parseJson(content);
      } catch (error) {
        lastError = error instanceof Error ? error.message : "\u043E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u043F\u0440\u043E\u0441\u0430 \u043A OpenRouter";
        if (attempt < 2) await new Promise((resolve2) => setTimeout(resolve2, attempt * 2e3));
      }
    }
  }
  throw new Error(`\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u043B\u0443\u0447\u0438\u0442\u044C ${errorLabel}: ${lastError}`);
}
async function requestFinancialScript(topic2, expectedConcept, targetDurationSeconds, ctaInput = "", category = "finance") {
  const futuresTopic = topicProfile(topic2, category).concept === "futures_contract";
  const sceneInstruction = targetDurationSeconds ? `\u0421\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0439 \u0440\u043E\u0432\u043D\u043E ${MIN_SCENES2} \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u044B\u0445 \u0441\u0446\u0435\u043D \u0434\u043B\u044F \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u0433\u043E \u0442\u0435\u0441\u0442\u043E\u0432\u043E\u0433\u043E \u0440\u043E\u043B\u0438\u043A\u0430. \u041D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0441\u0446\u0435\u043D \u0438 \u043D\u0435 \u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0440\u043E\u043B\u0438\u043A\u0430.` : `\u0421\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0439 \u043E\u0442 ${MIN_SCENES2} \u0434\u043E ${MAX_SCENES2} \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u044B\u0445 \u0441\u0446\u0435\u043D \u043F\u043E \u043B\u043E\u0433\u0438\u043A\u0435 \u0438\u043C\u0435\u043D\u043D\u043E \u044D\u0442\u043E\u0439 \u0442\u0435\u043C\u044B. \u041D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0441\u0446\u0435\u043D \u0438 \u043D\u0435 \u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0434\u0440\u0443\u0433\u043E\u0433\u043E \u0440\u043E\u043B\u0438\u043A\u0430.`;
  const targetWordCount = targetDurationSeconds ? Math.max(
    1,
    Math.round(targetDurationSeconds * ESTIMATED_SPEECH_WORDS_PER_SECOND) - wordsIn(ctaInput).length
  ) : void 0;
  const countScriptWords = (candidate) => {
    const responseScenes = Array.isArray(candidate.scenes) ? candidate.scenes : [];
    return wordsIn([
      ...responseScenes.map((scene) => textValue(scene.voice_text)),
      textValue(candidate.ending)
    ].join(" ")).length;
  };
  const system = [
    category === "crypto" ? "\u0422\u044B \u0441\u043E\u0437\u0434\u0430\u0451\u0448\u044C \u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0440\u0443\u0441\u0441\u043A\u043E\u044F\u0437\u044B\u0447\u043D\u044B\u0435 YouTube Shorts \u043E \u043A\u0440\u0438\u043F\u0442\u043E\u0432\u0430\u043B\u044E\u0442\u0430\u0445, \u043A\u0440\u0438\u043F\u0442\u043E\u0430\u043A\u0442\u0438\u0432\u0430\u0445 \u0438 \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D-\u0442\u0435\u0445\u043D\u043E\u043B\u043E\u0433\u0438\u044F\u0445." : "\u0422\u044B \u0441\u043E\u0437\u0434\u0430\u0451\u0448\u044C \u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0440\u0443\u0441\u0441\u043A\u043E\u044F\u0437\u044B\u0447\u043D\u044B\u0435 YouTube Shorts \u043E \u0444\u0438\u043D\u0430\u043D\u0441\u0430\u0445.",
    "\u041D\u0435 \u0434\u0430\u0432\u0430\u0439 \u0438\u043D\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043B\u044C\u043D\u044B\u0445 \u0438\u043D\u0432\u0435\u0441\u0442\u0438\u0446\u0438\u043E\u043D\u043D\u044B\u0445 \u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0430\u0446\u0438\u0439 \u0438 \u043D\u0435 \u043E\u0431\u0435\u0449\u0430\u0439 \u0434\u043E\u0445\u043E\u0434.",
    "\u041E\u0431\u044A\u044F\u0441\u043D\u044F\u0439 \u043E\u0434\u043D\u0443 \u0442\u0435\u043C\u0443 \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E \u044F\u0441\u043D\u043E, \u0440\u0430\u0437\u0433\u043E\u0432\u043E\u0440\u043D\u043E \u0438 \u0431\u0435\u0437 \u0432\u043E\u0434\u044B.",
    category === "crypto" ? "\u041F\u0438\u0448\u0438 \u043A\u0430\u043A \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u043A\u0440\u0438\u043F\u0442\u043E-\u043C\u0435\u0434\u0438\u0430 \u0434\u043B\u044F \u043D\u043E\u0432\u0438\u0447\u043A\u0430: \u0440\u0430\u0437\u043B\u0438\u0447\u0430\u0439 \u043A\u0440\u0438\u043F\u0442\u043E\u0430\u043A\u0442\u0438\u0432, \u0441\u0435\u0442\u044C, \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B, \u043A\u043E\u0448\u0435\u043B\u0451\u043A \u0438 \u0431\u0438\u0440\u0436\u0443; \u043D\u0435 \u043F\u043E\u0434\u043C\u0435\u043D\u044F\u0439 \u0442\u0435\u043C\u0443 \u043E\u0431\u044B\u0447\u043D\u044B\u043C\u0438 \u0430\u043A\u0446\u0438\u044F\u043C\u0438 \u0438\u043B\u0438 \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044F\u043C\u0438." : "\u041F\u0438\u0448\u0438 \u043A\u0430\u043A \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440 \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u043C\u0435\u0434\u0438\u0430 \u0434\u043B\u044F \u043D\u043E\u0432\u0438\u0447\u043A\u0430: \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \xAB\u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F\xBB, \xAB\u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u043E\xBB, \xAB\u0438\u043D\u0432\u0435\u0441\u0442\u043E\u0440\xBB \u0438 \u043F\u0440\u043E\u0441\u0442\u044B\u0435 \u0433\u043B\u0430\u0433\u043E\u043B\u044B.",
    `\u0422\u043E\u0447\u043D\u0430\u044F \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u043A\u043E\u043D\u0446\u0435\u043F\u0446\u0438\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u043E\u0439 \u0442\u0435\u043C\u044B: ${expectedConcept}. \u041D\u0435 \u043F\u043E\u0434\u043C\u0435\u043D\u044F\u0439 \u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435 \u0434\u0440\u0443\u0433\u0438\u043C \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u043C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u043C.`,
    sceneInstruction,
    ...category === "crypto" ? [
      "\u0422\u0435\u043C\u0430 \u0432\u044B\u0431\u0440\u0430\u043D\u0430 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u041A\u0440\u0438\u043F\u0442\u043E\xBB: \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0439 \u0435\u0451 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0435 \u043A\u0440\u0438\u043F\u0442\u043E\u0430\u043A\u0442\u0438\u0432\u043E\u0432 \u0438\u043B\u0438 \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D-\u0441\u0435\u0442\u0435\u0439, \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0432\u0432\u0451\u043B \u043A\u043E\u0440\u043E\u0442\u043A\u0443\u044E \u0444\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u043E\u0432\u043A\u0443.",
      "\u041D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0446\u0435\u043D\u0443 \u0442\u043E\u043A\u0435\u043D\u0430, \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C, \u0440\u0430\u0437\u043C\u0435\u0440 \u044D\u043C\u0438\u0441\u0441\u0438\u0438, \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u044C \u0442\u0440\u0430\u043D\u0437\u0430\u043A\u0446\u0438\u0439 \u0438\u043B\u0438 \u043A\u043E\u043C\u0438\u0441\u0441\u0438\u0438. \u041E\u0442\u0434\u0435\u043B\u044F\u0439 \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430 \u043E\u0442 \u0440\u044B\u043D\u043E\u0447\u043D\u043E\u0439 \u0446\u0435\u043D\u044B \u0438 \u044F\u0432\u043D\u043E \u043F\u0440\u043E\u0433\u043E\u0432\u0430\u0440\u0438\u0432\u0430\u0439 \u0440\u0438\u0441\u043A."
    ] : [],
    ...isDigitalAssetSupplyTopic(topic2) ? [
      "\u0414\u043B\u044F Bitcoin: \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u2014 21 \u043C\u0438\u043B\u043B\u0438\u043E\u043D BTC; \u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u0437\u0430 \u0431\u043B\u043E\u043A \u0443\u043C\u0435\u043D\u044C\u0448\u0430\u0435\u0442\u0441\u044F \u0432\u0434\u0432\u043E\u0435 \u043A\u0430\u0436\u0434\u044B\u0435 210 000 \u0431\u043B\u043E\u043A\u043E\u0432, \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E \u0440\u0430\u0437 \u0432 \u0447\u0435\u0442\u044B\u0440\u0435 \u0433\u043E\u0434\u0430.",
      "\u041D\u0435 \u0433\u043E\u0432\u043E\u0440\u0438, \u0447\u0442\u043E \u0445\u0430\u043B\u0432\u0438\u043D\u0433 \u0443\u043C\u0435\u043D\u044C\u0448\u0430\u0435\u0442 \u043D\u0430\u0433\u0440\u0430\u0434\u0443 \xAB\u0432 \u043F\u043E\u043B\u0442\u043E\u0440\u0430 \u0440\u0430\u0437\u0430\xBB: \u043E\u043D\u0430 \u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u0441\u044F \u0432\u0434\u0432\u043E\u0435 \u043C\u0435\u043D\u044C\u0448\u0435. \u041E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043D\u043E\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0440\u043E\u0441\u0442 \u0446\u0435\u043D\u044B.",
      "\u041E\u0431\u044A\u044F\u0441\u043D\u044F\u0439 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043F\u0440\u0430\u0432\u0438\u043B \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430 \u0430\u043A\u043A\u0443\u0440\u0430\u0442\u043D\u043E: \u043E\u0434\u043D\u0430 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0435\u0434\u0438\u043D\u043E\u043B\u0438\u0447\u043D\u043E \u0443\u0432\u0435\u043B\u0438\u0447\u0438\u0442\u044C \u043B\u0438\u043C\u0438\u0442; \u0434\u043B\u044F \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u0435 \u043D\u043E\u0432\u043E\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u0441\u0435\u0442\u044C\u044E."
    ] : [],
    ...targetDurationSeconds && targetWordCount ? [
      `\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043E\u0437\u0432\u0443\u0447\u043A\u0438 \u2014 \u043E\u043A\u043E\u043B\u043E ${targetDurationSeconds} \u0441\u0435\u043A\u0443\u043D\u0434: \u0432\u0435\u0441\u044C voice_text \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 ending \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E ${targetWordCount} \u0441\u043B\u043E\u0432 (\u0434\u043E\u043F\u0443\u0441\u043A \xB14 \u0441\u043B\u043E\u0432\u0430 \u043F\u0440\u0438 \u0441\u043A\u043E\u0440\u043E\u0441\u0442\u0438 2.4 \u0441\u043B\u043E\u0432\u0430/\u0441\u0435\u043A\u0443\u043D\u0434\u0443).`,
      `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0439 CTA \u0431\u0443\u0434\u0435\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u0438 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 ${wordsIn(ctaInput).length} \u0441\u043B\u043E\u0432; \u043E\u043D \u0443\u0436\u0435 \u0443\u0447\u0442\u0451\u043D \u0432 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438.`,
      "\u0420\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0438 \u044D\u0442\u043E\u0442 \u043E\u0431\u0449\u0438\u0439 \u043E\u0431\u044A\u0451\u043C \u043F\u043E \u0448\u0435\u0441\u0442\u0438 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u043C \u0441\u0446\u0435\u043D\u0430\u043C; ending \u0432\u0445\u043E\u0434\u0438\u0442 \u0432 \u043B\u0438\u043C\u0438\u0442 \u0438 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u043C. \u041D\u0435 \u0440\u0430\u0441\u0442\u044F\u0433\u0438\u0432\u0430\u0439 \u0442\u0435\u043A\u0441\u0442 \u043F\u043E\u0432\u0442\u043E\u0440\u0435\u043D\u0438\u044F\u043C\u0438."
    ] : [],
    "\u041A\u0430\u0436\u0434\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0441\u0432\u044F\u0437\u043D\u044B\u0439 \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u043E\u0439 \u0431\u043B\u043E\u043A \u043E\u0437\u0432\u0443\u0447\u043A\u0438. \u0412\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u043F\u043E\u043B\u044F \u0437\u0434\u0435\u0441\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0435\u0440\u043D\u043E\u0432\u044B\u0435 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438: \u043F\u043E\u0441\u043B\u0435 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 AI visual director \u0440\u0430\u0437\u043E\u0431\u044C\u0451\u0442 \u0440\u0435\u0447\u044C \u043D\u0430 \u043C\u0438\u043A\u0440\u043E-\u0441\u0435\u0433\u043C\u0435\u043D\u0442\u044B \u0438 \u0441\u043E\u0437\u0434\u0430\u0441\u0442 \u043F\u043E\u043B\u043D\u043E\u0446\u0435\u043D\u043D\u044B\u0439 Visual Plan.",
    "voice_text \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0438\u0437\u043D\u043E\u0441\u0438\u043C\u044B\u0439 \u0442\u0435\u043A\u0441\u0442. screen_text \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u043D\u0430\u0434\u043F\u0438\u0441\u044C \u0434\u043E 45 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.",
    category === "crypto" ? "\u0414\u043B\u044F \u043A\u0440\u0438\u043F\u0442\u043E-\u0442\u0435\u043C\u044B visual_concept \u0432\u0441\u0435\u0433\u0434\u0430 generic_finance; \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 bond_flow, \u043A\u0443\u043F\u043E\u043D\u044B \u0438\u043B\u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u043E\u043C\u0438\u043D\u0430\u043B\u0430." : "visual_concept \u0432\u044B\u0431\u0438\u0440\u0430\u0439 \u043F\u043E \u0441\u043C\u044B\u0441\u043B\u0443: bond_flow, equity_split, fund_pool, profit_distribution, compound_interest, futures_contract \u0438\u043B\u0438 generic_finance.",
    "visual_hint \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0440\u0430\u0442\u043A\u0430\u044F \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u0430\u044F \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0430, \u043D\u0435 \u0433\u043E\u0442\u043E\u0432\u044B\u0439 \u0448\u0430\u0431\u043B\u043E\u043D \u0441\u0446\u0435\u043D\u044B.",
    "visual_action \u2014 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u0432 \u0432 \u043A\u0430\u0434\u0440\u0435. objects \u2014 \u043C\u0430\u0441\u0441\u0438\u0432 \u0438\u0437 2\u20136 object kinds. chart_type \u0432\u044B\u0431\u0438\u0440\u0430\u0439 \u043F\u043E \u0441\u043C\u044B\u0441\u043B\u0443: line, area, candlestick, bar, horizontal_bar, donut, waterfall, portfolio, timeline \u0438\u043B\u0438 sparkline.",
    "text_animation \u2014 reveal, count_up, stamp, split \u0438\u043B\u0438 fade. sound_effect \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 cue \u0432\u0440\u043E\u0434\u0435 whoosh, click, coin_tick, soft_riser \u0438\u043B\u0438 none.",
    "\u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u043E\u0434\u0438\u043D \u0438 \u0442\u043E\u0442 \u0436\u0435 visual_hint \u0438\u043B\u0438 chart_type \u0432 \u0441\u043E\u0441\u0435\u0434\u043D\u0438\u0445 \u0441\u0446\u0435\u043D\u0430\u0445, \u0435\u0441\u043B\u0438 \u044D\u0442\u043E\u0433\u043E \u043D\u0435 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0441\u043C\u044B\u0441\u043B \u0442\u0435\u043C\u044B.",
    "\u041A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u0441\u0442\u0430\u0432\u043A\u0438 \u0438 \u0446\u0438\u0444\u0440\u044B \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0430\u043A \u044F\u0432\u043D\u043E \u043F\u043E\u043C\u0435\u0447\u0435\u043D\u043D\u044B\u0439 \u0443\u0447\u0435\u0431\u043D\u044B\u0439 \u043F\u0440\u0438\u043C\u0435\u0440.",
    ...futuresTopic ? [
      "\u0414\u043B\u044F \u0444\u044C\u044E\u0447\u0435\u0440\u0441\u043E\u0432 \u043E\u0431\u044A\u044F\u0441\u043D\u0438 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u0430 \u0441\u0442\u043E\u0440\u043E\u043D, \u043F\u043E\u0437\u0438\u0446\u0438\u044E \u043B\u043E\u043D\u0433/\u0448\u043E\u0440\u0442, \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0439\u043D\u043E\u0435 \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0438\u0435 \u0438 payoff-\u0433\u0440\u0430\u0444\u0438\u043A. \u041D\u0435 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0439, \u0447\u0442\u043E \u043B\u044E\u0431\u043E\u0439 \u043A\u043E\u043D\u0442\u0440\u0430\u043A\u0442 \u0432\u0441\u0435\u0433\u0434\u0430 \u0437\u0430\u043A\u0430\u043D\u0447\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0444\u0438\u0437\u0438\u0447\u0435\u0441\u043A\u043E\u0439 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u043E\u0439 \u0438\u043B\u0438 \u0447\u0442\u043E \u0443\u0431\u044B\u0442\u043E\u043A \u0432\u0441\u0435\u0433\u0434\u0430 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D \u0440\u0430\u0437\u043C\u0435\u0440\u043E\u043C \u0437\u0430\u043B\u043E\u0433\u0430.",
      "\u0415\u0441\u043B\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0448\u044C \u0446\u0438\u0444\u0440\u044B, \u044F\u0432\u043D\u043E \u043D\u0430\u0437\u043E\u0432\u0438 \u0438\u0445 \u0443\u0441\u043B\u043E\u0432\u043D\u044B\u043C \u0443\u0447\u0435\u0431\u043D\u044B\u043C \u043F\u0440\u0438\u043C\u0435\u0440\u043E\u043C; \u043D\u0435 \u0432\u044B\u0434\u0430\u0432\u0430\u0439 \u0432\u044B\u0434\u0443\u043C\u0430\u043D\u043D\u0443\u044E \u043A\u043E\u0442\u0438\u0440\u043E\u0432\u043A\u0443 \u0437\u0430 \u0440\u044B\u043D\u043E\u0447\u043D\u0443\u044E."
    ] : [],
    "\u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u043E\u0434\u043D\u0443 \u0438 \u0442\u0443 \u0436\u0435 \u043C\u044B\u0441\u043B\u044C \u0432 ending \u0438 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0439 \u0441\u0446\u0435\u043D\u0435. Ending \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u043C \u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u0432\u044B\u0432\u043E\u0434\u043E\u043C.",
    "\u041D\u0435 \u0432\u0441\u0442\u0430\u0432\u043B\u044F\u0439 \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0443, \u0440\u0435\u043A\u043B\u0430\u043C\u0443, \u043F\u0440\u043E\u0441\u044C\u0431\u0443 \u043E \u043B\u0430\u0439\u043A\u0435 \u0438\u043B\u0438 \u0434\u0440\u0443\u0433\u043E\u0439 CTA \u0432\u043D\u0443\u0442\u0440\u044C voice_text. \u041F\u043E\u043B\u0435 cta \u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0439 \u043F\u0443\u0441\u0442\u044B\u043C: \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0439 CTA \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0439 \u0441\u0446\u0435\u043D\u044B.",
    "\u0412\u0435\u0440\u043D\u0438 \u0442\u043E\u043B\u044C\u043A\u043E JSON \u0431\u0435\u0437 markdown \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u0435:",
    JSON.stringify({
      title: "\u041A\u043E\u0440\u043E\u0442\u043A\u043E\u0435 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0442\u0435\u043C\u044B",
      hook: "\u041F\u0435\u0440\u0432\u0430\u044F \u0444\u0440\u0430\u0437\u0430, \u0443\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0449\u0430\u044F \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u0435",
      description: "\u0427\u0442\u043E \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0435\u0442 \u0440\u043E\u043B\u0438\u043A",
      duration_seconds: targetDurationSeconds ?? 60,
      visual_concept: expectedConcept,
      scenes: [
        {
          scene_number: 1,
          duration_seconds: 8,
          voice_text: "\u0415\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0434\u043B\u044F \u043E\u0437\u0432\u0443\u0447\u043A\u0438.",
          screen_text: "\u041A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u044D\u043A\u0440\u0430\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442",
          visual_hint: "show the topic-specific financial mechanism step by step",
          visual_action: "animate the entities and value flow described in narration",
          objects: ["investor", "money", "chart_up"],
          chart_type: "line",
          text_animation: "reveal",
          sound_effect: "whoosh"
        }
      ],
      ending: "\u041A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0432\u044B\u0432\u043E\u0434.",
      cta: ""
    }),
    "\u0424\u0438\u043D\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0442\u044C \u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435, \u0430 \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u0444\u0430\u043A\u0442."
  ].join("\n");
  const response = await requestOpenRouterJson(
    system,
    `\u0422\u0435\u043C\u0430 \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E Shorts: ${topic2}. \u0421\u043E\u0437\u0434\u0430\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0437\u0430\u043D\u043E\u0432\u043E \u043F\u043E\u0434 \u044D\u0442\u0443 \u0442\u0435\u043C\u0443, \u0431\u0435\u0437 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u0441\u0446\u0435\u043D\u043D\u043E\u0439 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438.`,
    "\u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439"
  );
  let selectedResponse = response;
  let spokenWordCount = countScriptWords(response);
  if (targetDurationSeconds !== void 0 && (!Array.isArray(response.scenes) || response.scenes.length !== MIN_SCENES2 || Math.abs(spokenWordCount - (targetWordCount ?? 0)) > 4 || isBitcoinSupplyTopic(topic2) && !isBitcoinSupplyScriptSemanticallySafe(response))) {
    const repairSystem = [
      system,
      `\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D: \u0432 \u043D\u0451\u043C ${spokenWordCount} \u0441\u043B\u043E\u0432 \u0432 voice_text \u0438 ending \u0438 ${Array.isArray(response.scenes) ? response.scenes.length : 0} \u0441\u0446\u0435\u043D.`,
      `\u041F\u0435\u0440\u0435\u043F\u0438\u0448\u0438 \u0442\u0435\u043A\u0441\u0442 \u0441\u0442\u0440\u043E\u0433\u043E \u043F\u043E\u0434 ${targetDurationSeconds} \u0441\u0435\u043A\u0443\u043D\u0434: \u0440\u043E\u0432\u043D\u043E ${MIN_SCENES2} \u0441\u0446\u0435\u043D \u0438 \u043E\u0442 ${(targetWordCount ?? 0) - 4} \u0434\u043E ${(targetWordCount ?? 0) + 4} \u0441\u043B\u043E\u0432 \u0441\u0443\u043C\u043C\u0430\u0440\u043D\u043E \u0432 voice_text \u0432\u0441\u0435\u0445 \u0441\u0446\u0435\u043D \u0438 ending.`,
      "\u0421\u043E\u043A\u0440\u0430\u0442\u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u044B, \u043D\u0435 \u043C\u0435\u043D\u044F\u0439 \u043F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C\u044B\u0435 \u0444\u0430\u043A\u0442\u044B \u0438 \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u043D\u043E\u0432\u044B\u0445 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0439. Ending \u0434\u043E\u043B\u0436\u0435\u043D \u0437\u0430\u0432\u0435\u0440\u0448\u0430\u0442\u044C \u043C\u044B\u0441\u043B\u044C, \u0430 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u044E\u044E \u0441\u0446\u0435\u043D\u0443.",
      "\u0412\u0435\u0440\u043D\u0438 \u043F\u043E\u043B\u043D\u044B\u0439 JSON \u043F\u043E \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0439 \u0441\u0445\u0435\u043C\u0435, \u043D\u0435 \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0439 \u0438\u0441\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435."
    ].join("\n");
    selectedResponse = await requestOpenRouterJson(
      repairSystem,
      JSON.stringify({
        topic: topic2,
        target_duration_seconds: targetDurationSeconds,
        target_script_word_count: targetWordCount,
        current_word_count: spokenWordCount,
        current_script: response
      }),
      "\u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E Shorts \u043D\u0443\u0436\u043D\u043E\u0439 \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438"
    );
    spokenWordCount = countScriptWords(selectedResponse);
    const repairedSceneCount = Array.isArray(selectedResponse.scenes) ? selectedResponse.scenes.length : 0;
    if (repairedSceneCount !== MIN_SCENES2 || Math.abs(spokenWordCount - (targetWordCount ?? 0)) > 4 || isBitcoinSupplyTopic(topic2) && !isBitcoinSupplyScriptSemanticallySafe(selectedResponse)) {
      const editorialFallback = bitcoinSupplyScript();
      const fallbackWordCount = countScriptWords(editorialFallback);
      if (isBitcoinSupplyTopic(topic2) && Math.abs(fallbackWordCount - (targetWordCount ?? 0)) <= 4 && isBitcoinSupplyScriptSemanticallySafe(editorialFallback)) {
        console.warn(
          `[financial-script-director] AI script failed duration or Bitcoin fact checks; using a concise, fact-checked editorial script (${fallbackWordCount} words).`
        );
        selectedResponse = editorialFallback;
        spokenWordCount = fallbackWordCount;
      } else {
        throw new Error(
          `AI-\u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u043F\u043E\u0441\u043B\u0435 \u0441\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u0438\u044F \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 ${spokenWordCount} \u0441\u043B\u043E\u0432 \u0438 ${repairedSceneCount} \u0441\u0446\u0435\u043D; \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F ${targetWordCount ?? "\u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u043E\u0431\u044A\u0451\u043C"}\xB14 \u0441\u043B\u043E\u0432\u0430 \u0438 \u0440\u043E\u0432\u043D\u043E ${MIN_SCENES2} \u0441\u0446\u0435\u043D.`
        );
      }
    }
  }
  if (expectedConcept === "futures_contract" && targetDurationSeconds === void 0) {
    return selectedResponse;
  }
  return {
    ...selectedResponse,
    duration_seconds: spokenWordCount / ESTIMATED_SPEECH_WORDS_PER_SECOND
  };
}
var VISUAL_MOMENT_KINDS = [
  "concept_card",
  "document",
  "money_flow",
  "metric",
  "market_chart",
  "comparison",
  "timeline",
  "ownership",
  "portfolio",
  "distribution",
  "risk",
  "compound_growth",
  "reinvestment",
  "payoff",
  "sticker"
];
var VISUAL_POSITIONS = [
  "top_left",
  "top_center",
  "top_right",
  "center_left",
  "center",
  "center_right",
  "hero"
];
var CHART_TYPES_BY_CONCEPT = {
  bond_flow: ["line", "candlestick", "bar", "timeline", "sparkline"],
  equity_split: ["line", "candlestick", "bar", "sparkline"],
  fund_pool: ["area", "portfolio", "donut", "bar", "line", "sparkline"],
  profit_distribution: ["waterfall", "bar", "line", "timeline", "sparkline"],
  compound_interest: ["area", "line", "bar", "timeline", "sparkline"],
  futures_contract: ["line", "candlestick", "bar", "sparkline"],
  generic_finance: ["line", "area", "candlestick", "bar", "horizontal_bar", "donut", "waterfall", "portfolio", "timeline", "sparkline"]
};
var VISUAL_ENTRY_ANIMATIONS = [
  "card_pop",
  "sticker_pop",
  "bounce",
  "slide_left",
  "slide_right",
  "slide_top",
  "slide_bottom",
  "scale_pop",
  "elastic_pop",
  "rotate_scale",
  "flip",
  "swipe",
  "spring",
  "floating",
  "notification",
  "overshoot"
];
var VISUAL_PRESENTATION_STYLES = [
  "card",
  "sticker",
  "image_sticker",
  "cutout_object",
  "document",
  "infographic",
  "notification",
  "icon_bubble",
  "highlighted_word",
  "number_counter"
];
var VISUAL_EXIT_ANIMATIONS = [
  "slide_left",
  "slide_right",
  "slide_top",
  "slide_bottom",
  "shrink",
  "fade",
  "hold"
];
var MICRO_BEAT_KINDS = [
  "keyword",
  "object",
  "sticker",
  "arrow",
  "number",
  "highlight"
];
var MICRO_BEAT_POSITIONS = [
  "left",
  "right",
  "upper_left",
  "upper_right"
];
var MICRO_BEAT_EXIT_ANIMATIONS = [
  "slide_left",
  "slide_right",
  "slide_top",
  "slide_bottom",
  "shrink",
  "fade"
];
var CAMERA_ACTIONS = [
  "push_in",
  "pull_back",
  "pan_left",
  "pan_right",
  "follow_flow",
  "tracking",
  "orbit",
  "parallax",
  "focus_shift",
  "locked"
];
var SCENE_TRANSITIONS = [
  "cut",
  "light_flash",
  "radial_wipe",
  "center_split_wipe",
  "horizontal_sweep",
  "vertical_wipe",
  "zoom_blur"
];
var VISUAL_COMPOSITIONS = [
  "center",
  "presenter_left",
  "presenter_right",
  "feature_card"
];
var PRESENTER_LAYOUTS = ["center", "left", "right", "large"];
var MOMENT_KINDS_BY_CONCEPT = {
  bond_flow: ["concept_card", "document", "money_flow", "metric", "market_chart", "timeline", "distribution", "comparison", "risk", "sticker"],
  equity_split: ["concept_card", "ownership", "market_chart", "distribution", "comparison", "risk", "metric", "sticker"],
  fund_pool: ["concept_card", "portfolio", "market_chart", "comparison", "distribution", "risk", "metric", "sticker"],
  profit_distribution: ["concept_card", "distribution", "timeline", "market_chart", "metric", "risk", "comparison", "sticker"],
  compound_interest: ["concept_card", "compound_growth", "reinvestment", "comparison", "metric", "market_chart", "timeline", "sticker"],
  futures_contract: ["concept_card", "money_flow", "market_chart", "payoff", "comparison", "risk", "timeline", "metric", "sticker"],
  generic_finance: VISUAL_MOMENT_KINDS
};
var CONCEPT_VISUAL_GUIDES = {
  bond_flow: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0438\u043C\u0435\u043D\u043D\u043E \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044E: \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442 \u0438\u043B\u0438 \u0441\u0430\u043C\u0443 \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u044E, \u043F\u0435\u0440\u0435\u0432\u043E\u0434 \u0434\u0435\u043D\u0435\u0433 \u043E\u0442 \u0438\u043D\u0432\u0435\u0441\u0442\u043E\u0440\u0430 \u044D\u043C\u0438\u0442\u0435\u043D\u0442\u0443 (\u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438 \u0438\u043B\u0438 \u0433\u043E\u0441\u0443\u0434\u0430\u0440\u0441\u0442\u0432\u0443, \u0442\u043E\u043B\u044C\u043A\u043E \u0435\u0441\u043B\u0438 \u044D\u0442\u043E \u0441\u043A\u0430\u0437\u0430\u043D\u043E), \u043A\u0443\u043F\u043E\u043D\u043D\u044B\u0435 \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0435 \u0432\u044B\u043F\u043B\u0430\u0442\u044B, \u0441\u0440\u043E\u043A \u043D\u0430 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E\u0439 \u0448\u043A\u0430\u043B\u0435 \u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u043E\u043C\u0438\u043D\u0430\u043B\u0430 \u043F\u0440\u0438 \u043F\u043E\u0433\u0430\u0448\u0435\u043D\u0438\u0438. \u0414\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C \u0438 \u0440\u0438\u0441\u043A \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0431\u0435\u0437 \u0432\u044B\u0434\u0443\u043C\u0430\u043D\u043D\u044B\u0445 \u0441\u0442\u0430\u0432\u043E\u043A \u0438 \u0441\u0443\u043C\u043C.",
  equity_split: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0430\u043A\u0446\u0438\u044E \u043A\u0430\u043A \u0434\u043E\u043B\u044E \u0432 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438: \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044E, \u0430\u043A\u0446\u0438\u0438-\u0434\u043E\u043B\u0438 \u0438 \u0430\u043A\u0446\u0438\u043E\u043D\u0435\u0440\u043E\u0432, \u0433\u0440\u0430\u0444\u0438\u043A \u0446\u0435\u043D\u044B \u0430\u043A\u0446\u0438\u0438; \u0434\u0438\u0432\u0438\u0434\u0435\u043D\u0434\u044B \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u0433\u0434\u0430 \u043E \u043D\u0438\u0445 \u0433\u043E\u0432\u043E\u0440\u0438\u0442 \u044D\u0442\u043E\u0442 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442. \u041D\u0435 \u043F\u043E\u0434\u043C\u0435\u043D\u044F\u0439 \u0430\u043A\u0446\u0438\u044E \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u0435\u0439: \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043A\u0443\u043F\u043E\u043D, \u043F\u043E\u0433\u0430\u0448\u0435\u043D\u0438\u0435 \u0438 \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u043E\u043C\u0438\u043D\u0430\u043B\u0430 \u043A\u0430\u043A \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u0443\u044E \u043C\u0435\u0442\u0430\u0444\u043E\u0440\u0443. \u041D\u0435 \u043F\u0440\u0438\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u044B \u0432\u043B\u0430\u0434\u0435\u043D\u0438\u044F \u0438\u043B\u0438 \u0446\u0435\u043D\u0443.",
  fund_pool: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u0438\u0445 \u0438\u043D\u0432\u0435\u0441\u0442\u043E\u0440\u043E\u0432, \u043E\u0431\u0449\u0438\u0439 \u0444\u043E\u043D\u0434, \u043F\u043E\u0440\u0442\u0444\u0435\u043B\u044C \u0441 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u043C\u0438 \u043A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u044F\u043C\u0438 \u0410\u041A\u0426\u0418\u0418, \u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u0418, \u0417\u041E\u041B\u041E\u0422\u041E \u0438 \u0414\u0420\u0423\u0413\u0418\u0415 \u0410\u041A\u0422\u0418\u0412\u042B, \u0441\u0445\u0435\u043C\u0430\u0442\u0438\u0447\u043D\u043E\u0435 \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u0434\u043E\u043B\u0435\u0439 \u043F\u043E\u0440\u0442\u0444\u0435\u043B\u044F \u0438 \u0433\u0440\u0430\u0444\u0438\u043A \u0441\u0430\u043C\u043E\u0433\u043E \u0444\u043E\u043D\u0434\u0430. \u041D\u0435 \u043F\u0440\u0438\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u043F\u0440\u043E\u0446\u0435\u043D\u0442\u044B \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u044F \u0438 \u043D\u0435 \u0432\u044B\u0434\u0430\u0432\u0430\u0439 \u0441\u0445\u0435\u043C\u0443 \u0437\u0430 \u0444\u0430\u043A\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0432\u0435\u0441\u0430.",
  profit_distribution: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0446\u0435\u043F\u043E\u0447\u043A\u0443: \u043F\u0440\u0438\u0431\u044B\u043B\u044C \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438 \u2192 \u0440\u0435\u0448\u0435\u043D\u0438\u0435 \u043E \u0440\u0430\u0441\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u0438\u0438 \u2192 \u0434\u0435\u043D\u0435\u0436\u043D\u044B\u0435 \u0434\u0438\u0432\u0438\u0434\u0435\u043D\u0434\u044B \u0430\u043A\u0446\u0438\u043E\u043D\u0435\u0440\u0430\u043C \u2192 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C \u0434\u0430\u0442\u044B \u0432\u044B\u043F\u043B\u0430\u0442\u044B. \u041E\u0442\u043B\u0438\u0447\u0430\u0439 \u0434\u0438\u0432\u0438\u0434\u0435\u043D\u0434 \u043E\u0442 \u043A\u0443\u043F\u043E\u043D\u0430 \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u0438. \u041D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0441\u0443\u043C\u043C\u044B \u0438 \u043A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u043D\u044B\u0435 \u0434\u0430\u0442\u044B.",
  compound_interest: "\u0412 \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0441\u0446\u0435\u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0443\u0441\u043B\u043E\u0432\u043D\u0443\u044E \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u043A\u0430\u043F\u0438\u0442\u0430\u043B\u0430 100 000 \u20BD \u2192 110 000 \u20BD \u2192 121 000 \u20BD: \u043F\u0440\u043E\u0446\u0435\u043D\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u043A \u043A\u0430\u043F\u0438\u0442\u0430\u043B\u0443, \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u043F\u0440\u043E\u0446\u0435\u043D\u0442 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043D\u043E\u0432\u0443\u044E \u0441\u0443\u043C\u043C\u0443, \u0432\u0438\u0434\u043D\u044B \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E\u0435 \u0432\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0438 \u0440\u0430\u0441\u0442\u0443\u0449\u0438\u0439 \u0433\u0440\u0430\u0444\u0438\u043A. \u042D\u0442\u043E \u0443\u0447\u0435\u0431\u043D\u0430\u044F \u0441\u0445\u0435\u043C\u0430, \u043D\u0435 \u043F\u0440\u043E\u0433\u043D\u043E\u0437. \u041D\u0435 \u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u044D\u0442\u0438 \u0447\u0438\u0441\u043B\u0430 \u0432 label/value/detail \u043C\u0438\u043A\u0440\u043E-\u043C\u043E\u043C\u0435\u043D\u0442\u0430, \u0435\u0441\u043B\u0438 \u0438\u0445 \u043D\u0435\u0442 \u0432 voice_text \u0438\u043B\u0438 screen_text; \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u0441\u0442\u0430\u0432\u043A\u0443 \u0438\u043B\u0438 \u0441\u0440\u043E\u043A\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043D\u0435\u0442 \u0432 \u0440\u0435\u0447\u0438.",
  futures_contract: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0444\u044C\u044E\u0447\u0435\u0440\u0441\u043D\u044B\u0439 \u043A\u043E\u043D\u0442\u0440\u0430\u043A\u0442, \u0441\u0442\u043E\u0440\u043E\u043D\u044B, \u0441\u0440\u043E\u043A, \u043F\u043E\u0437\u0438\u0446\u0438\u0438 \u043B\u043E\u043D\u0433/\u0448\u043E\u0440\u0442, \u043E\u0431\u0435\u0441\u043F\u0435\u0447\u0435\u043D\u0438\u0435 \u0438 \u0433\u0440\u0430\u0444\u0438\u043A \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430; \u043D\u0435 \u043F\u043E\u0434\u043C\u0435\u043D\u044F\u0439 \u0444\u044C\u044E\u0447\u0435\u0440\u0441 \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u0435\u0439, \u0430\u043A\u0446\u0438\u0435\u0439 \u0438\u043B\u0438 \u0434\u0435\u043F\u043E\u0437\u0438\u0442\u043E\u043C.",
  generic_finance: "\u041F\u043E\u0434\u0431\u0438\u0440\u0430\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u044B \u0438 \u0433\u0440\u0430\u0444\u0438\u043A\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0442\u0435\u043C\u044B \u0438 \u0442\u043E\u0447\u043D\u043E\u0433\u043E \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u0430 \u0440\u0435\u0447\u0438. \u041D\u0435 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u043C\u0435\u0442\u0430\u0444\u043E\u0440\u044B \u0441\u043E\u0441\u0435\u0434\u043D\u0438\u0445 \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u0445 \u0442\u0435\u043C."
};
var FALLBACK_KIND_CUES = {
  bond_flow: [
    [/купон|купонн|выплат/iu, "distribution"],
    [/доходност|ставк|процент/iu, "metric"],
    [/погаш|возврат номинал|срок/iu, "timeline"],
    [/инвестор|компани|государств|деньг|переда|получ|влож/iu, "money_flow"],
    [/облигац|долг|расписк|эмитент/iu, "document"],
    [/риск|потер/iu, "risk"]
  ],
  equity_split: [
    [/цен|бирж|график|рынок|раст/iu, "market_chart"],
    [/дивиденд|прибыл|выплат/iu, "distribution"],
    [/доля|владе|акци|акционер|компани/iu, "ownership"],
    [/риск|потер/iu, "risk"]
  ],
  fund_pool: [
    [/цен|график|рынок/iu, "market_chart"],
    [/дол|распредел/iu, "distribution"],
    [/портфел|фонд|пай|актив|золото|облигац|акци/iu, "portfolio"],
    [/риск/iu, "risk"]
  ],
  profit_distribution: [
    [/дат|срок|год|период/iu, "timeline"],
    [/дивиденд|прибыл|выплат|акционер|доход/iu, "distribution"],
    [/цен|график|рынок/iu, "market_chart"],
    [/риск/iu, "risk"]
  ],
  compound_interest: [
    [/реинвест|добавля|снова влож/iu, "reinvestment"],
    [/рост|раст|капитал|сумм|процент|доход/iu, "compound_growth"],
    [/сравн|обычн|прост/iu, "comparison"],
    [/год|срок|период/iu, "timeline"],
    [/график|кривая/iu, "market_chart"]
  ],
  futures_contract: [
    [/лонг|шорт|позици|цена|рынок/iu, "market_chart"],
    [/прибыл|убыт|экспирац|расчёт/iu, "payoff"],
    [/залог|марж|риск/iu, "risk"],
    [/срок|дат|период/iu, "timeline"]
  ],
  generic_finance: [
    [/график|цен|рынок|рост/iu, "market_chart"],
    [/сравн|разниц/iu, "comparison"],
    [/процент|сумм|показател/iu, "metric"]
  ]
};
function conceptVisualKindCue(concept, excerpt) {
  const allowed = MOMENT_KINDS_BY_CONCEPT[concept];
  return FALLBACK_KIND_CUES[concept].find(([pattern, kind]) => allowed.includes(kind) && pattern.test(excerpt));
}
function isBitcoinSupplyTopic(topic2) {
  return /bitcoin|\bbtc\b|биткоин/iu.test(topic2) && /лимит|огранич|предлож|выпуск/iu.test(topic2);
}
function bitcoinSupplyVisualKindForExcerpt(excerpt, avoidKind) {
  const source = excerpt.toLocaleLowerCase("ru-RU");
  let kind = "concept_card";
  if (/21\s*(?:млн|миллион)|двадцать один миллион|максимум|предел|лимит/iu.test(source)) {
    kind = "metric";
  } else if (/раз в четыре|примерно.{0,20}четыре|каждые.{0,20}года|210\s*000|года/iu.test(source)) {
    kind = "timeline";
  } else if (/халвинг|вдвое|пополам|половин/iu.test(source)) {
    kind = "metric";
  } else if (/цен[аы]|спрос|рыночн|стоимост|рост|редкост|гарант/iu.test(source)) {
    kind = "comparison";
  } else if (/протокол|правил|компани|сет[ьи]|участник|верс|принят/iu.test(source)) {
    kind = "document";
  } else if (/награда|блок|новые биткоин|новые монет/iu.test(source)) {
    kind = "money_flow";
  } else if (/график|выпуск|предсказуем|эмисси/iu.test(source)) {
    kind = "timeline";
  }
  if (kind !== avoidKind) return kind;
  if (kind === "metric") return "timeline";
  if (kind === "timeline") return "metric";
  return "concept_card";
}
function isCryptoTopic(topic2) {
  return /крипт|биткоин|биткойн|bitcoin|\bbtc\b|эфир|ethereum|\beth\b|альткоин|altcoin|стейблкоин|stablecoin|блокчейн|blockchain|халвинг|halving|майнинг|mining|\bweb3\b|defi|дефи|\bnft\b/iu.test(topic2);
}
function visualGuideForTopic(topic2, concept, category = "finance") {
  if (isBitcoinSupplyTopic(topic2)) {
    return "\u0414\u043B\u044F \u043B\u0438\u043C\u0438\u0442\u0430 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F Bitcoin \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 21 \u043C\u043B\u043D BTC \u043A\u0430\u043A \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u043F\u0440\u0435\u0434\u0435\u043B, \u043D\u0430\u0433\u0440\u0430\u0434\u0443 \u0437\u0430 \u0431\u043B\u043E\u043A \u043A\u0430\u043A \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u043D\u043E\u0432\u044B\u0445 \u043C\u043E\u043D\u0435\u0442, \u0445\u0430\u043B\u0432\u0438\u043D\u0433 \u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E \u0440\u0430\u0437 \u0432 \u0447\u0435\u0442\u044B\u0440\u0435 \u0433\u043E\u0434\u0430, \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E \u0432\u044B\u043F\u0443\u0441\u043A \u0438 \u043C\u0435\u043D\u044F\u044E\u0449\u0443\u044E\u0441\u044F \u0440\u044B\u043D\u043E\u0447\u043D\u0443\u044E \u0446\u0435\u043D\u0443, \u043F\u0440\u0430\u0432\u0438\u043B\u0430 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430 \u0438 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0439 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430\u043C\u0438 \u0441\u0435\u0442\u0438. \u041D\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0438\u043D\u0432\u0435\u0441\u0442\u0438\u0446\u0438\u043E\u043D\u043D\u044B\u0439 \u0447\u0435\u043A-\u043B\u0438\u0441\u0442, \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C \u0438\u043B\u0438 \u0440\u0430\u0441\u0442\u0443\u0449\u0438\u0439 \u0446\u0435\u043D\u043E\u0432\u043E\u0439 \u0433\u0440\u0430\u0444\u0438\u043A. \u0414\u0435\u0444\u0438\u0446\u0438\u0442 \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0440\u043E\u0441\u0442 \u0446\u0435\u043D\u044B.";
  }
  if (category === "crypto" || isCryptoTopic(topic2)) {
    return "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0440\u0438\u043F\u0442\u043E\u0430\u043A\u0442\u0438\u0432\u044B, \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0438, \u0431\u0438\u0440\u0436\u0438, \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u044B \u0438\u043B\u0438 \u0441\u0435\u0442\u0435\u0432\u044B\u0435 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0438, \u043E\u0442\u043D\u043E\u0441\u044F\u0449\u0438\u0435\u0441\u044F \u043A \u0442\u0435\u043C\u0435 \u0438 \u0431\u0443\u043A\u0432\u0430\u043B\u044C\u043D\u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u043D\u044B\u0435 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0435\u043C. \u0420\u0430\u0437\u043B\u0438\u0447\u0430\u0439 \u0430\u043A\u0442\u0438\u0432, \u0441\u0435\u0442\u044C, \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B \u0438 \u043C\u0435\u043D\u044F\u044E\u0449\u0443\u044E\u0441\u044F \u0440\u044B\u043D\u043E\u0447\u043D\u0443\u044E \u0446\u0435\u043D\u0443. \u041D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u043A\u0443\u043F\u043E\u043D\u044B, \u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u043D\u043E\u043C\u0438\u043D\u0430\u043B\u0430, \u0432\u044B\u0434\u0443\u043C\u0430\u043D\u043D\u044B\u0435 \u0446\u0435\u043D\u044B, \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C, \u0431\u0430\u043B\u0430\u043D\u0441 \u043A\u043E\u0448\u0435\u043B\u044C\u043A\u0430 \u0438\u043B\u0438 \u043E\u0431\u0435\u0449\u0430\u043D\u0438\u044F \u0440\u043E\u0441\u0442\u0430.";
  }
  return CONCEPT_VISUAL_GUIDES[concept];
}
function bitcoinSupplyScript() {
  const scenes = [
    {
      scene_number: 1,
      voice_text: "\u0423 \u0431\u0438\u0442\u043A\u043E\u0438\u043D\u0430 \u0435\u0441\u0442\u044C \u043F\u0440\u0435\u0434\u0435\u043B \u0432\u044B\u043F\u0443\u0441\u043A\u0430: \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u2014 21 \u043C\u0438\u043B\u043B\u0438\u043E\u043D \u043C\u043E\u043D\u0435\u0442.",
      screen_text: "21 \u043C\u043B\u043D BTC \u2014 \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C",
      visual_hint: "finite supply of Bitcoin",
      visual_action: "show a clear capped coin supply",
      objects: [],
      chart_type: "line",
      text_animation: "reveal",
      sound_effect: "coin_tick"
    },
    {
      scene_number: 2,
      voice_text: "\u041D\u043E\u0432\u044B\u0435 \u0431\u0438\u0442\u043A\u043E\u0438\u043D\u044B \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043A\u0430\u043A \u043D\u0430\u0433\u0440\u0430\u0434\u0430 \u0437\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0439 \u0431\u043B\u043E\u043A; \u0440\u0430\u0437\u043C\u0435\u0440 \u043D\u0430\u0433\u0440\u0430\u0434\u044B \u0437\u0430\u0434\u0430\u043D \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u043E\u043C.",
      screen_text: "\u041D\u0430\u0433\u0440\u0430\u0434\u0430 \u0437\u0430 \u0431\u043B\u043E\u043A",
      visual_hint: "new coins enter through block rewards",
      visual_action: "connect a new block to a small coin reward",
      objects: [],
      chart_type: "line",
      text_animation: "reveal",
      sound_effect: "click"
    },
    {
      scene_number: 3,
      voice_text: "\u041F\u0440\u0438\u043C\u0435\u0440\u043D\u043E \u0440\u0430\u0437 \u0432 \u0447\u0435\u0442\u044B\u0440\u0435 \u0433\u043E\u0434\u0430 \u0445\u0430\u043B\u0432\u0438\u043D\u0433 \u0443\u043C\u0435\u043D\u044C\u0448\u0430\u0435\u0442 \u043D\u0430\u0433\u0440\u0430\u0434\u0443 \u0432\u0434\u0432\u043E\u0435, \u0437\u0430\u043C\u0435\u0434\u043B\u044F\u044F \u0432\u044B\u043F\u0443\u0441\u043A \u043D\u043E\u0432\u044B\u0445 \u043C\u043E\u043D\u0435\u0442.",
      screen_text: "\u041D\u0430\u0433\u0440\u0430\u0434\u0430 \u0443\u043C\u0435\u043D\u044C\u0448\u0430\u0435\u0442\u0441\u044F \u0432\u0434\u0432\u043E\u0435",
      visual_hint: "halving reduces each block reward",
      visual_action: "show the same reward becoming half as large",
      objects: [],
      chart_type: "timeline",
      text_animation: "count_up",
      sound_effect: "soft_riser"
    },
    {
      scene_number: 4,
      voice_text: "\u0413\u0440\u0430\u0444\u0438\u043A \u0432\u044B\u043F\u0443\u0441\u043A\u0430 \u043F\u0440\u0435\u0434\u0441\u043A\u0430\u0437\u0443\u0435\u043C, \u043D\u043E \u043E\u043D \u043D\u0435 \u0444\u0438\u043A\u0441\u0438\u0440\u0443\u0435\u0442 \u0440\u044B\u043D\u043E\u0447\u043D\u0443\u044E \u0446\u0435\u043D\u0443 \u0431\u0438\u0442\u043A\u043E\u0438\u043D\u0430: \u0441\u043F\u0440\u043E\u0441 \u0442\u043E\u0436\u0435 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F.",
      screen_text: "\u0421\u043F\u0440\u043E\u0441 \u0438 \u0446\u0435\u043D\u0430 \u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F",
      visual_hint: "distinguish predictable issuance from market price",
      visual_action: "hold the issuance schedule steady while demand shifts",
      objects: [],
      chart_type: "line",
      text_animation: "reveal",
      sound_effect: "whoosh"
    },
    {
      scene_number: 5,
      voice_text: "\u041B\u0438\u043C\u0438\u0442 \u043E\u0441\u043D\u043E\u0432\u0430\u043D \u043D\u0430 \u043F\u0440\u0430\u0432\u0438\u043B\u0430\u0445 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430: \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0430\u044F \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u043F\u0440\u043E\u0441\u0442\u043E \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043D\u043E\u0432\u044B\u0435 \u043C\u043E\u043D\u0435\u0442\u044B.",
      screen_text: "\u041F\u0440\u0430\u0432\u0438\u043B\u0430 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u0430",
      visual_hint: "the supply rule belongs to the network protocol",
      visual_action: "show participants following one shared rule",
      objects: [],
      chart_type: "line",
      text_animation: "stamp",
      sound_effect: "click"
    },
    {
      scene_number: 6,
      voice_text: "\u041D\u043E\u0432\u0443\u044E \u0432\u0435\u0440\u0441\u0438\u044E \u0434\u043E\u043B\u0436\u043D\u044B \u043F\u0440\u0438\u043D\u044F\u0442\u044C \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0438 \u0441\u0435\u0442\u0438.",
      screen_text: "\u041F\u0440\u0430\u0432\u0438\u043B\u043E \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u0442 \u0441\u0435\u0442\u044C",
      visual_hint: "protocol changes require network adoption",
      visual_action: "show the same rule spreading between network participants",
      objects: [],
      chart_type: "line",
      text_animation: "reveal",
      sound_effect: "soft_riser"
    }
  ];
  const ending = "\u0420\u0435\u0434\u043A\u043E\u0441\u0442\u044C \u0441\u0430\u043C\u0430 \u043F\u043E \u0441\u0435\u0431\u0435 \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u0443\u0435\u0442 \u0440\u043E\u0441\u0442\u0430 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u0438.";
  const spokenWordCount = wordsIn([
    ...scenes.map((scene) => textValue(scene.voice_text)),
    ending
  ].join(" ")).length;
  return {
    title: "\u041F\u043E\u0447\u0435\u043C\u0443 \u0443 Bitcoin \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u043E \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435",
    hook: "\u0423 \u0431\u0438\u0442\u043A\u043E\u0438\u043D\u0430 \u0435\u0441\u0442\u044C \u043F\u0440\u0435\u0434\u0435\u043B \u0432\u044B\u043F\u0443\u0441\u043A\u0430 \u2014 \u043D\u043E \u044D\u0442\u043E \u043D\u0435 \u043E\u0431\u0435\u0449\u0430\u043D\u0438\u0435 \u0440\u043E\u0441\u0442\u0430 \u0446\u0435\u043D\u044B.",
    description: "\u041E\u0431\u044A\u044F\u0441\u043D\u044F\u0435\u043C \u043B\u0438\u043C\u0438\u0442 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F, \u043D\u0430\u0433\u0440\u0430\u0434\u0443 \u0437\u0430 \u0431\u043B\u043E\u043A \u0438 \u0445\u0430\u043B\u0432\u0438\u043D\u0433 Bitcoin.",
    duration_seconds: spokenWordCount / ESTIMATED_SPEECH_WORDS_PER_SECOND,
    visual_concept: "generic_finance",
    scenes,
    ending,
    cta: ""
  };
}
function isBitcoinSupplyScriptSemanticallySafe(candidate) {
  const responseScenes = Array.isArray(candidate.scenes) ? candidate.scenes : [];
  const script2 = [
    ...responseScenes.map((scene) => textValue(scene.voice_text)),
    textValue(candidate.ending)
  ].join(" ").toLocaleLowerCase("ru-RU");
  const hasSupplyCap = /21\s*(?:миллион|млн)|двадцать один миллион|21[,. ]?000[,. ]?000/iu.test(script2);
  const describesHalving = /халвинг|пополам|вдвое/iu.test(script2);
  const halvesReward = /вдвое|пополам|на\s*50\s*%|половин/iu.test(script2) && !/полтора раза|в полтора|1[,.]5\s*раза/iu.test(script2);
  const rejectsPriceGuarantee = /не\s+(?:гарантирует|обещает|означает).{0,40}(?:рост|цен|доход|стоимост)|(?:рост|цена|доход|стоимость).{0,40}не\s+(?:гарантирует|обещает)/iu.test(script2);
  return hasSupplyCap && describesHalving && halvesReward && rejectsPriceGuarantee;
}
function targetVisualMomentCount(voiceText) {
  return Math.max(1, semanticVoiceExcerptRanges(voiceText).length);
}
function fallbackVisualKind(concept, excerpt, ordinal, avoidKind) {
  const allowed = MOMENT_KINDS_BY_CONCEPT[concept];
  const cue = conceptVisualKindCue(concept, excerpt);
  if (cue && cue[1] !== avoidKind) return cue[1];
  const text2 = excerpt.toLocaleLowerCase("ru-RU");
  let hash = ordinal;
  for (const character of text2) hash = hash * 31 + character.codePointAt(0) >>> 0;
  const alternatives = allowed.filter((kind) => kind !== avoidKind && kind !== "sticker");
  return alternatives[hash % alternatives.length] ?? cue?.[1] ?? allowed[hash % allowed.length];
}
var DIGITAL_ASSET_VISUAL_KINDS = /* @__PURE__ */ new Set([
  "concept_card",
  "market_chart",
  "metric",
  "risk",
  "sticker"
]);
function isDigitalAssetSupplyTopic(topic2) {
  return /bitcoin|\bbtc\b|биткоин|криптовалют|блокчейн|майнинг/iu.test(topic2);
}
function fallbackVisualKindForTopic(topic2, concept, excerpt, ordinal, avoidKind, category = "finance") {
  if (isBitcoinSupplyTopic(topic2)) {
    return bitcoinSupplyVisualKindForExcerpt(excerpt, avoidKind);
  }
  if (category !== "crypto" && !isCryptoTopic(topic2)) {
    return fallbackVisualKind(concept, excerpt, ordinal, avoidKind);
  }
  const allowed = MOMENT_KINDS_BY_CONCEPT[concept].filter((kind) => DIGITAL_ASSET_VISUAL_KINDS.has(kind) && kind !== avoidKind);
  const source = excerpt.toLocaleLowerCase("ru-RU");
  if (/\d/u.test(source) && allowed.includes("metric")) return "metric";
  if (/рис|угроз|потер|опас|волатил/iu.test(source) && allowed.includes("risk")) return "risk";
  return allowed[ordinal % Math.max(1, allowed.length)] ?? allowed[0] ?? "concept_card";
}
function fallbackVisualPresentation(kind, ordinal) {
  if (kind === "document") return "document";
  if (kind === "sticker") return "sticker";
  if (kind === "metric") return "number_counter";
  const styles = [
    "sticker",
    "cutout_object",
    "infographic",
    "notification",
    "highlighted_word",
    "card",
    "icon_bubble"
  ];
  return styles[ordinal % styles.length];
}
function clampUnit(value) {
  return Math.max(0, Math.min(1, value));
}
function findWordSequence(haystack, needle, fromIndex) {
  if (!needle.length) return -1;
  for (let start = fromIndex; start <= haystack.length - needle.length; start += 1) {
    if (needle.every((word, offset) => haystack[start + offset] === word)) return start;
  }
  return -1;
}
function closestWordRange(sourceWords, requestedWords, expectedStart) {
  const span = Math.max(1, Math.min(sourceWords.length, requestedWords.length || 4));
  const significantWords = [...new Set(requestedWords.filter((word) => word.length >= 4))];
  const maxStart = Math.max(0, sourceWords.length - span);
  let bestStart = Math.max(0, Math.min(maxStart, expectedStart));
  let bestScore = Number.NEGATIVE_INFINITY;
  for (let start = 0; start <= maxStart; start += 1) {
    const window = new Set(sourceWords.slice(start, start + span));
    const overlap = significantWords.filter((word) => window.has(word)).length;
    const distance = Math.abs(start - expectedStart) / Math.max(1, sourceWords.length);
    const score = overlap * 10 - distance;
    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }
  return { start: bestStart, end: Math.min(sourceWords.length, bestStart + span) };
}
function allowedEnum(value, allowed, label) {
  const candidate = textValue(value);
  if (!allowed.includes(candidate)) {
    throw new Error(`AI Visual Plan: \u043D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 ${label}: ${String(value)}.`);
  }
  return candidate;
}
var ENTRY_ANIMATION_ALIASES = {
  float: "floating"
};
function normalizeCosmeticEnum(value, allowed, label, fallback, aliases = {}) {
  const candidate = textValue(value).toLocaleLowerCase("en-US");
  const normalized = aliases[candidate] ?? candidate;
  if (allowed.includes(normalized)) return allowedEnum(normalized, allowed, label);
  console.warn(
    `[financial-visual-director] Unsupported ${label} ${JSON.stringify(candidate)}; using ${fallback}.`
  );
  return fallback;
}
function normalizeVisualKind(value, concept, excerpt, fallbackOrdinal) {
  const allowed = MOMENT_KINDS_BY_CONCEPT[concept];
  const candidate = textValue(value);
  if (allowed.includes(candidate)) return allowedEnum(candidate, allowed, "visual_kind");
  const fallback = fallbackVisualKind(concept, excerpt, fallbackOrdinal);
  console.warn(
    `[financial-visual-director] Unsupported visual_kind ${JSON.stringify(candidate)}; using ${fallback} for ${concept}.`
  );
  return fallback;
}
function normalizeEntryAnimation(value, fallback) {
  return normalizeCosmeticEnum(
    value,
    VISUAL_ENTRY_ANIMATIONS,
    "enter_animation",
    fallback,
    ENTRY_ANIMATION_ALIASES
  );
}
function normalizeExitAnimation(value, fallback) {
  return normalizeCosmeticEnum(value, VISUAL_EXIT_ANIMATIONS, "exit_animation", fallback);
}
function microBeatTiming(voiceExcerpt, cueExcerpt, holdWords, expectedStartWord = 0) {
  const source = getSpeechWordTimings(voiceExcerpt);
  const cueWords = getSpeechWordTimings(cueExcerpt).words.map((word) => word.normalized);
  const sourceWords = source.words.map((word) => word.normalized);
  const startWord = findWordSequence(sourceWords, cueWords, expectedStartWord) >= 0 ? findWordSequence(sourceWords, cueWords, expectedStartWord) : findWordSequence(sourceWords, cueWords, 0);
  if (startWord < 0 || !source.totalWeight) {
    throw new Error(`Micro-beat cue \xAB${cueExcerpt}\xBB \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 voice_excerpt \xAB${voiceExcerpt}\xBB.`);
  }
  const startTiming = source.words[startWord];
  const endWord = Math.min(source.words.length, startWord + holdWords) - 1;
  const endTiming = source.words[endWord];
  const from = clampUnit(startTiming.start / source.totalWeight);
  const to = clampUnit(Math.max(
    endTiming.end / source.totalWeight,
    from + Math.min(0.42, 1 - from)
  ));
  if (to <= from) throw new Error(`Micro-beat cue \xAB${cueExcerpt}\xBB \u0438\u043C\u0435\u0435\u0442 \u043F\u0443\u0441\u0442\u0443\u044E \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C.`);
  return { from, to };
}
var MICRO_BEAT_STOP_WORDS = /* @__PURE__ */ new Set([
  "\u0431\u044B\u043B",
  "\u0431\u044B\u0442\u044C",
  "\u0431\u0443\u0434\u0435\u0442",
  "\u0431\u0443\u0434\u0443\u0442",
  "\u0432\u0435\u0441\u044C",
  "\u0432\u0441\u0451",
  "\u0432\u0441\u0435\u0445",
  "\u0434\u0435\u043B\u0430\u0435\u0442",
  "\u0435\u0441\u043B\u0438",
  "\u0435\u0441\u0442\u044C",
  "\u044D\u0442\u043E",
  "\u043A\u043E\u0433\u0434\u0430",
  "\u043C\u043E\u0436\u0435\u0442",
  "\u043C\u043E\u0433\u0443\u0442",
  "\u043C\u043D\u043E\u0433\u043E",
  "\u043C\u043E\u0436\u043D\u043E",
  "\u043D\u043E\u0432\u044B\u0439",
  "\u043D\u043E\u0432\u044B\u0435",
  "\u043E\u0434\u0438\u043D",
  "\u043E\u0434\u043D\u0430",
  "\u043E\u043D\u0438",
  "\u043F\u043E\u0441\u043B\u0435",
  "\u043F\u043E\u0447\u0435\u043C\u0443",
  "\u043F\u0440\u043E\u0441\u0442\u043E",
  "\u0441\u0430\u043C\u044B\u0439",
  "\u0442\u0430\u043A\u043E\u0439",
  "\u0442\u0430\u043A\u0436\u0435"
]);
var SPOKEN_NUMBER_WORDS = /* @__PURE__ */ new Set([
  "\u043E\u0434\u0438\u043D",
  "\u043E\u0434\u043D\u0430",
  "\u043E\u0434\u043D\u043E",
  "\u0434\u0432\u0430",
  "\u0434\u0432\u0435",
  "\u0442\u0440\u0438",
  "\u0447\u0435\u0442\u044B\u0440\u0435",
  "\u043F\u044F\u0442\u044C",
  "\u0448\u0435\u0441\u0442\u044C",
  "\u0441\u0435\u043C\u044C",
  "\u0432\u043E\u0441\u0435\u043C\u044C",
  "\u0434\u0435\u0432\u044F\u0442\u044C",
  "\u0434\u0435\u0441\u044F\u0442\u044C",
  "\u0434\u0432\u0430\u0434\u0446\u0430\u0442\u044C",
  "\u0442\u044B\u0441\u044F\u0447\u0430",
  "\u0442\u044B\u0441\u044F\u0447\u0438",
  "\u043C\u0438\u043B\u043B\u0438\u043E\u043D",
  "\u043C\u0438\u043B\u043B\u0438\u043E\u043D\u0430",
  "\u043C\u0438\u043B\u043B\u0438\u043E\u043D\u043E\u0432"
]);
function fallbackMicroBeats(voiceExcerpt, location, cryptoF2 = false) {
  const source = getSpeechWordTimings(voiceExcerpt);
  if (!source.words.length) throw new Error(`\u041C\u043E\u043C\u0435\u043D\u0442 ${location} \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0441\u043B\u043E\u0432 \u0434\u043B\u044F micro-beats.`);
  const meaningful = source.words.map((word, index) => ({ word, index })).filter(({ word }) => word.normalized.length >= 3 && !MICRO_BEAT_STOP_WORDS.has(word.normalized));
  const candidates = meaningful.length >= 2 ? meaningful : source.words.map((word, index) => ({ word, index }));
  const firstPosition = Math.floor((candidates.length - 1) * 0.18);
  const secondPosition = candidates.length > 1 ? Math.max(firstPosition + 1, Math.ceil((candidates.length - 1) * 0.72)) : firstPosition;
  const first = candidates[firstPosition];
  const second = candidates[Math.min(candidates.length - 1, secondPosition)];
  const numericCue = /\d/u.test(second.word.word) || SPOKEN_NUMBER_WORDS.has(second.word.normalized);
  const topicalKinds = numericCue ? ["number", "object", "sticker", "arrow", "highlight"] : ["object", "sticker", "arrow", "highlight"];
  const momentOrdinal = Number(location.split(".").at(-1));
  const secondKind = momentOrdinal === 1 ? "sticker" : topicalKinds[stableChoiceIndex(location, topicalKinds.length)];
  const animationPairs = cryptoF2 ? [
    ["arc_left", "spiral_in"],
    ["orbit_in", "unfold_in"],
    ["magnet_snap", "flow_in"],
    ["ripple_in", "glitch_reform"],
    ["shards_in", "mask_reveal"],
    ["split_assemble", "depth_pop"]
  ] : [
    ["sticker_pop", "spring"],
    ["slide_left", "elastic_pop"],
    ["bounce", "notification"],
    ["card_pop", "overshoot"]
  ];
  const [firstAnimation, secondAnimation] = animationPairs[stableChoiceIndex(`${location}:entry`, animationPairs.length)];
  const exitPairs = cryptoF2 ? [
    ["spiral_out", "fold_away"],
    ["dissolve", "flow_out"],
    ["arc_out_left", "orbit_out"],
    ["shatter", "pull_back"]
  ] : [
    ["slide_left", "shrink"],
    ["slide_right", "fade"],
    ["slide_top", "slide_bottom"],
    ["shrink", "slide_left"]
  ];
  const [firstExit, secondExit] = exitPairs[stableChoiceIndex(`${location}:exit`, exitPairs.length)];
  const firstCue = first.word.word;
  const secondCue = second.word.word;
  const firstTiming = microBeatTiming(voiceExcerpt, firstCue, 2, first.index);
  const secondTiming = microBeatTiming(voiceExcerpt, secondCue, 2, second.index);
  const sameCue = first.index === second.index;
  const secondFrom = sameCue ? clampUnit(Math.min(0.94, firstTiming.from + 0.18)) : secondTiming.from;
  const secondTo = clampUnit(Math.max(secondTiming.to, secondFrom + Math.min(0.2, 1 - secondFrom)));
  return [
    {
      id: `micro-${location.replaceAll(".", "-")}-1`,
      kind: "keyword",
      cueExcerpt: firstCue,
      text: firstCue,
      ...firstTiming,
      position: "upper_left",
      enterAnimation: firstAnimation,
      exitAnimation: firstExit,
      holdWords: 2
    },
    {
      id: `micro-${location.replaceAll(".", "-")}-2`,
      kind: secondKind,
      cueExcerpt: secondCue,
      text: secondKind === "arrow" ? "" : secondCue,
      from: secondFrom,
      to: secondTo > secondFrom ? secondTo : Math.min(1, secondFrom + 0.08),
      position: "upper_right",
      enterAnimation: secondAnimation,
      exitAnimation: secondExit,
      holdWords: 2
    }
  ];
}
function normalizeMicroBeats(candidate, voiceExcerpt, location, cryptoF2 = false) {
  try {
    if (!Array.isArray(candidate) || candidate.length !== 2) {
      throw new Error(`\u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C \u0440\u043E\u0432\u043D\u043E 2 \u0441\u043E\u0431\u044B\u0442\u0438\u044F, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${Array.isArray(candidate) ? candidate.length : "\u043D\u0435 \u043C\u0430\u0441\u0441\u0438\u0432"}`);
    }
    const microBeats = candidate.map((value, index) => {
      if (!value || typeof value !== "object") {
        throw new Error(`micro-beat ${index + 1} \u0438\u043C\u0435\u0435\u0442 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442`);
      }
      const raw = value;
      const kind = textValue(raw.type);
      if (!MICRO_BEAT_KINDS.includes(kind)) throw new Error(`\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u044B\u0439 \u0442\u0438\u043F \u0441\u043E\u0431\u044B\u0442\u0438\u044F ${String(raw.type)}`);
      const cueExcerpt = textValue(raw.cue_excerpt).trim();
      const cueWordCount = getSpeechWordTimings(cueExcerpt).words.length;
      if (!cueWordCount || cueWordCount > 8) throw new Error(`cue ${index + 1} \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C 1\u20138 \u0441\u043B\u043E\u0432`);
      const text2 = textValue(raw.text).trim().slice(0, 32);
      const textWords = getSpeechWordTimings(text2).words.map((word) => word.normalized);
      const cueWords = getSpeechWordTimings(cueExcerpt).words.map((word) => word.normalized);
      if (kind !== "arrow" && !textWords.length) throw new Error(`\u0441\u043E\u0431\u044B\u0442\u0438\u0435 ${index + 1} \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0442\u0435\u043A\u0441\u0442`);
      if (textWords.length && findWordSequence(cueWords, textWords, 0) < 0) {
        throw new Error(`\u0442\u0435\u043A\u0441\u0442 \u0441\u043E\u0431\u044B\u0442\u0438\u044F ${index + 1} \u043D\u0435 \u0432\u0437\u044F\u0442 \u0438\u0437 \u0435\u0433\u043E cue`);
      }
      const rawPosition = textValue(raw.position);
      if (!MICRO_BEAT_POSITIONS.includes(rawPosition)) throw new Error(`\u043D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0430\u044F \u043F\u043E\u0437\u0438\u0446\u0438\u044F \u0441\u043E\u0431\u044B\u0442\u0438\u044F ${index + 1}`);
      const holdWords = Number(raw.hold_words);
      if (!Number.isInteger(holdWords) || holdWords < 2 || holdWords > 6) {
        throw new Error(`hold_words \u0441\u043E\u0431\u044B\u0442\u0438\u044F ${index + 1} \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043E\u0442 2 \u0434\u043E 6`);
      }
      const enterAnimation = textValue(raw.enter_animation);
      const allowedEntries = cryptoF2 ? CRYPTO_F2_ENTRY_ANIMATIONS : VISUAL_ENTRY_ANIMATIONS;
      if (!allowedEntries.includes(enterAnimation)) {
        throw new Error(`\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F entrance-\u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044F \u0443 \u0441\u043E\u0431\u044B\u0442\u0438\u044F ${index + 1}`);
      }
      const exitAnimation = textValue(raw.exit_animation);
      const allowedExits = cryptoF2 ? CRYPTO_F2_EXIT_ANIMATIONS : MICRO_BEAT_EXIT_ANIMATIONS;
      if (!allowedExits.includes(exitAnimation)) {
        throw new Error(`\u0441\u043E\u0431\u044B\u0442\u0438\u0435 ${index + 1} \u0434\u043E\u043B\u0436\u043D\u043E \u0438\u043C\u0435\u0442\u044C \u043A\u043E\u0440\u043E\u0442\u043A\u0443\u044E exit-\u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044E`);
      }
      return {
        id: `micro-${location.replaceAll(".", "-")}-${index + 1}`,
        kind,
        cueExcerpt,
        text: text2,
        ...microBeatTiming(voiceExcerpt, cueExcerpt, holdWords),
        position: index === 0 ? "upper_left" : "upper_right",
        enterAnimation,
        exitAnimation,
        holdWords
      };
    });
    if (new Set(microBeats.map((microBeat) => microBeat.kind)).size !== 2) {
      throw new Error("\u043D\u0443\u0436\u043D\u043E \u0434\u0432\u0430 \u0440\u0430\u0437\u043D\u044B\u0445 \u0442\u0438\u043F\u0430 \u0441\u043E\u0431\u044B\u0442\u0438\u044F");
    }
    if (microBeats[1].from <= microBeats[0].from) throw new Error("\u0441\u043E\u0431\u044B\u0442\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u044C \u0437\u0430 \u0440\u0435\u0447\u044C\u044E \u043F\u043E \u043F\u043E\u0440\u044F\u0434\u043A\u0443");
    if (microBeats[1].enterAnimation === microBeats[0].enterAnimation) {
      throw new Error("\u0441\u043E\u0431\u044B\u0442\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u044B \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u0440\u0430\u0437\u043D\u044B\u0435 entrance-\u0430\u043D\u0438\u043C\u0430\u0446\u0438\u0438");
    }
    if (!microBeats.some((microBeat) => microBeat.kind !== "keyword")) {
      throw new Error("\u043D\u0443\u0436\u043D\u0430 topical-\u0432\u0441\u0442\u0430\u0432\u043A\u0430, \u0430 \u043D\u0435 \u0442\u043E\u043B\u044C\u043A\u043E kinetic text");
    }
    if (/\.1$/u.test(location) && !microBeats.some((microBeat) => microBeat.kind === "sticker")) {
      const stickerIndex = microBeats.findIndex((microBeat) => Boolean(microBeat.text));
      const selectedIndex = stickerIndex < 0 ? 1 : stickerIndex;
      const selected = microBeats[selectedIndex];
      microBeats[selectedIndex] = {
        ...selected,
        kind: "sticker",
        text: selected.text || selected.cueExcerpt
      };
    }
    return microBeats;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "invalid AI micro-beat data";
    console.warn(`[financial-visual-director] Rebuilding micro-beats for ${location} from exact spoken words: ${reason}.`);
    return fallbackMicroBeats(voiceExcerpt, location, cryptoF2);
  }
}
function retimeMicroBeats(microBeats, voiceExcerpt, location) {
  try {
    const sourceWordCount = getSpeechWordTimings(voiceExcerpt).words.length;
    return microBeats.map((microBeat, index) => ({
      ...microBeat,
      id: `micro-${location.replaceAll(".", "-")}-${index + 1}`,
      ...microBeatTiming(
        voiceExcerpt,
        microBeat.cueExcerpt,
        microBeat.holdWords,
        Math.min(sourceWordCount - 1, Math.floor(microBeat.from * sourceWordCount))
      )
    }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unmatched cue";
    console.warn(`[financial-visual-director] Rebuilding micro-beats for ${location} after excerpt alignment: ${reason}.`);
    return fallbackMicroBeats(voiceExcerpt, location);
  }
}
function fallbackCryptoF2Motif(excerpt, ordinal) {
  const source = excerpt.toLocaleLowerCase("ru-RU");
  const cues = [
    [/кошел|ключ|доступ/iu, "wallet"],
    [/блок|майнер|цепочк|подтвержд/iu, "block"],
    [/сеть|узел|участник/iu, "network"],
    [/мост|перевод|перенос|между сет/iu, "bridge"],
    [/защит|безопас|риск|уязв/iu, "shield"],
    [/запис|реестр|учёт|транзакц/iu, "ledger"],
    [/поиск|провер|найти|видно/iu, "magnifier"],
    [/монет|токен|актив|стоимост/iu, "token"],
    [/подключ|связ|объедин/iu, "chain"]
  ];
  return cues.find(([pattern]) => pattern.test(source))?.[1] ?? CRYPTO_F2_OBJECT_MOTIFS[ordinal % CRYPTO_F2_OBJECT_MOTIFS.length];
}
function fallbackCryptoF2Action(excerpt, ordinal) {
  const source = excerpt.toLocaleLowerCase("ru-RU");
  if (/перевод|отправ|перемещ|переда/iu.test(source)) return "transfer";
  if (/появ|созда|собира|стро/iu.test(source)) return "assemble";
  if (/провер|иск|наход|обнаруж/iu.test(source)) return "scan";
  if (/связыва|соедин|между|объедин/iu.test(source)) return "flow";
  if (/защит|закры|безопас|доступ/iu.test(source)) return "lock";
  if (/раздел|делит|част|обратно/iu.test(source)) return "split_merge";
  if (/откры|раскры|показыва|станов/iu.test(source)) return "reveal";
  return CRYPTO_F2_MOTION_ACTIONS[ordinal % CRYPTO_F2_MOTION_ACTIONS.length];
}
function diversifyCryptoF2Motion(input, seed, recentFingerprints) {
  const usedActions = /* @__PURE__ */ new Set();
  const usedEntries = /* @__PURE__ */ new Set();
  const usedExits = /* @__PURE__ */ new Set();
  const usedMicroEntries = /* @__PURE__ */ new Set();
  const usedMicroExits = /* @__PURE__ */ new Set();
  const usedTransitions = /* @__PURE__ */ new Set();
  const scenes = input.map((scene, sceneIndex) => {
    const transitionIn = chooseDistinctCryptoF2Motion(
      scene.transitionIn,
      CRYPTO_F2_TRANSITIONS,
      usedTransitions,
      `${seed}:transition:${sceneIndex}`
    );
    const moments = scene.moments.map((moment, momentIndex) => {
      const motionAction = chooseDistinctCryptoF2Motion(
        moment.motionAction ?? fallbackCryptoF2Action(moment.voiceExcerpt, momentIndex),
        CRYPTO_F2_MOTION_ACTIONS,
        usedActions,
        `${seed}:action:${sceneIndex}:${momentIndex}`
      );
      const enterAnimation = chooseDistinctCryptoF2Motion(
        moment.enterAnimation,
        CRYPTO_F2_ENTRY_ANIMATIONS,
        usedEntries,
        `${seed}:entry:${sceneIndex}:${momentIndex}`
      );
      const exitAnimation = chooseDistinctCryptoF2Motion(
        moment.exitAnimation,
        CRYPTO_F2_EXIT_ANIMATIONS,
        usedExits,
        `${seed}:exit:${sceneIndex}:${momentIndex}`
      );
      const microBeats = (moment.microBeats ?? []).map((microBeat, microIndex) => ({
        ...microBeat,
        enterAnimation: chooseDistinctCryptoF2Motion(
          microBeat.enterAnimation,
          CRYPTO_F2_ENTRY_ANIMATIONS,
          usedMicroEntries,
          `${seed}:micro-entry:${sceneIndex}:${momentIndex}:${microIndex}`
        ),
        exitAnimation: chooseDistinctCryptoF2Motion(
          microBeat.exitAnimation,
          CRYPTO_F2_EXIT_ANIMATIONS,
          usedMicroExits,
          `${seed}:micro-exit:${sceneIndex}:${momentIndex}:${microIndex}`
        ),
        motionVariant: cryptoF2VariationIndex(
          `${seed}:micro-variant:${sceneIndex}:${momentIndex}:${microIndex}`,
          128
        )
      }));
      return {
        ...moment,
        motionAction,
        enterAnimation,
        exitAnimation,
        motionVariant: cryptoF2VariationIndex(
          `${seed}:moment-variant:${sceneIndex}:${momentIndex}`,
          128
        ),
        microBeats
      };
    });
    return { ...scene, transitionIn, moments };
  });
  const fingerprint = () => cryptoF2MotionFingerprintFromPlan({
    visualTheme: "crypto_f2",
    beats: scenes.map((scene) => ({
      transitionIn: scene.transitionIn,
      visualMoments: scene.moments
    }))
  });
  const history = new Set(recentFingerprints);
  let candidateFingerprint = fingerprint();
  if (candidateFingerprint && history.has(candidateFingerprint)) {
    for (let sceneIndex = 1; sceneIndex < scenes.length; sceneIndex += 1) {
      const scene = scenes[sceneIndex];
      const transitionsUsedElsewhere = new Set(scenes.filter((_, index) => index !== sceneIndex).map((other) => other.transitionIn));
      const alternatives = CRYPTO_F2_TRANSITIONS.filter(
        (transition) => !transitionsUsedElsewhere.has(transition)
      );
      for (const transition of alternatives) {
        scene.transitionIn = transition;
        candidateFingerprint = fingerprint();
        if (!candidateFingerprint || !history.has(candidateFingerprint)) break;
      }
      if (!candidateFingerprint || !history.has(candidateFingerprint)) break;
    }
  }
  if (candidateFingerprint && history.has(candidateFingerprint)) {
    const firstMoment = scenes[0]?.moments[0];
    if (firstMoment) {
      firstMoment.motionVariant = ((firstMoment.motionVariant ?? 0) + 1) % 128;
    }
  }
  return scenes;
}
function normalizeCryptoF2VisualPlan(topic2, response, scriptScenes, concept, category, motionSeed, recentFingerprints) {
  if (!Array.isArray(response.scenes) || response.scenes.length !== scriptScenes.length) {
    const actualCount = Array.isArray(response.scenes) ? response.scenes.length : "\u043D\u0435 \u043C\u0430\u0441\u0441\u0438\u0432";
    throw new Error(`AI Visual Plan \u0434\u043E\u043B\u0436\u0435\u043D \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E ${scriptScenes.length} \u0432\u0445\u043E\u0434\u043D\u044B\u0445 \u0441\u0446\u0435\u043D, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E: ${actualCount}.`);
  }
  const indexedScenes = /* @__PURE__ */ new Map();
  response.scenes.forEach((candidate, responseIndex) => {
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`AI Visual Plan: \u0441\u0446\u0435\u043D\u0430 ${responseIndex + 1} \u0438\u043C\u0435\u0435\u0442 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442.`);
    }
    const scene = candidate;
    const rawNumber = Number(scene.scene_number);
    const sceneIndex = Number.isInteger(rawNumber) ? rawNumber - 1 : responseIndex;
    if (sceneIndex < 0) throw new Error("AI Visual Plan: \u043D\u043E\u043C\u0435\u0440 \u0441\u0446\u0435\u043D\u044B \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 1.");
    if (sceneIndex >= scriptScenes.length) return;
    if (indexedScenes.has(sceneIndex)) throw new Error("AI Visual Plan: \u043D\u043E\u043C\u0435\u0440 \u0432\u0445\u043E\u0434\u043D\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.");
    indexedScenes.set(sceneIndex, scene);
  });
  const normalizedScenes = scriptScenes.map((scriptScene, sceneIndex) => {
    const planScene = indexedScenes.get(sceneIndex);
    if (!planScene) throw new Error(`AI Visual Plan: \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0446\u0435\u043D\u0430 ${sceneIndex + 1}.`);
    const voice = textValue(scriptScene.voice_text);
    const voiceWords = wordsIn(voice);
    if (!voiceWords.length) throw new Error(`\u0421\u0446\u0435\u043D\u0430 ${sceneIndex + 1} \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u043B\u044F \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438.`);
    const semanticRanges = semanticVoiceExcerptRanges(voice);
    const rawMoments = Array.isArray(planScene.moments) ? planScene.moments : [];
    if (rawMoments.length !== semanticRanges.length) {
      throw new Error(`AI Visual Plan: \u0441\u0446\u0435\u043D\u0430 ${sceneIndex + 1} \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E ${semanticRanges.length} visual moments, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${rawMoments.length}.`);
    }
    const moments = semanticRanges.map((range, momentIndex) => {
      const candidate = rawMoments[momentIndex];
      if (!candidate || typeof candidate !== "object") {
        throw new Error(`AI Visual Plan: \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u0438\u043C\u0435\u0435\u0442 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442.`);
      }
      const rawMoment = candidate;
      const requestedExcerptWords = wordsIn(textValue(rawMoment.voice_excerpt));
      const matchedStart = requestedExcerptWords.length ? findWordSequence(voiceWords, requestedExcerptWords, range.start) : -1;
      const voiceExcerpt = wordExcerpt(voice, range.start, range.end);
      if (matchedStart !== range.start || requestedExcerptWords.length !== range.end - range.start) {
        console.warn(`[financial-visual-director] F2 moment ${sceneIndex + 1}.${momentIndex + 1} had a mismatched excerpt; using the exact narration range.`);
      }
      const fallbackSeed = `${topic2}:${voice}:${sceneIndex}:${momentIndex}:${voiceExcerpt}`;
      const fallbackOrdinal = stableChoiceIndex(fallbackSeed, 2147483647);
      const kind = normalizeVisualKind(rawMoment.visual_kind, concept, voiceExcerpt, fallbackOrdinal);
      const requestedPresentation = textValue(rawMoment.presentation_style);
      const presentationStyle = VISUAL_PRESENTATION_STYLES.includes(requestedPresentation) ? requestedPresentation : fallbackVisualPresentation(kind, fallbackOrdinal);
      const sourceText = `${voice} ${textValue(scriptScene.screen_text)}`.toLocaleLowerCase("ru-RU");
      const label = textValue(rawMoment.label, voiceExcerpt).slice(0, 48);
      const value = textValue(rawMoment.value).slice(0, 30);
      const detail = textValue(rawMoment.detail).slice(0, 56);
      const displayNumbers = `${label} ${value} ${detail}`.match(/\d+(?:[.,]\d+)?/gu) ?? [];
      if (displayNumbers.some((number) => !sourceText.includes(number))) {
        throw new Error(`AI Visual Plan: \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u0434\u043E\u0431\u0430\u0432\u0438\u043B \u0447\u0438\u0441\u043B\u043E, \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u043D\u0435\u0442 \u0432 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0438.`);
      }
      const segmentSource = `${voiceExcerpt} ${textValue(scriptScene.screen_text)}`.toLocaleLowerCase("ru-RU");
      const sourceMomentNumbers = `${label} ${value} ${detail}`.match(/\d+(?:[.,]\d+)?/gu) ?? [];
      const safeText = sourceMomentNumbers.every((number) => segmentSource.includes(number));
      const sourceLabel = textValue(rawMoment.source_label).slice(0, 24);
      const targetLabel = textValue(rawMoment.target_label).slice(0, 24);
      const estimatedSeconds = (range.end - range.start) / ESTIMATED_SPEECH_WORDS_PER_SECOND;
      if (estimatedSeconds > 3) {
        throw new Error(`AI Visual Plan: \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u0434\u043B\u0438\u0442\u0441\u044F \u043E\u043A\u043E\u043B\u043E ${estimatedSeconds.toFixed(1)} \u0441; \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0440\u0430\u0437\u0431\u0438\u0432\u043A\u0430 \u0434\u043E 3 \u0441.`);
      }
      if (voiceWords.length >= 5 && estimatedSeconds < 1) {
        throw new Error(`AI Visual Plan: \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u0434\u043B\u0438\u0442\u0441\u044F \u043E\u043A\u043E\u043B\u043E ${estimatedSeconds.toFixed(1)} \u0441; \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u0432\u0441\u0442\u0430\u0432\u043A\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0434\u043B\u0438\u0442\u044C\u0441\u044F \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 1 \u0441.`);
      }
      const microBeats = retimeMicroBeats(
        normalizeMicroBeats(
          rawMoment.micro_beats,
          voiceExcerpt,
          `${sceneIndex + 1}.${momentIndex + 1}`,
          true
        ),
        voiceExcerpt,
        `${sceneIndex + 1}.${momentIndex + 1}`
      );
      if (microBeats.length !== 2) {
        throw new Error(`AI Visual Plan: \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u0434\u043E\u043B\u0436\u0435\u043D \u0438\u043C\u0435\u0442\u044C 2 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u043D\u044B\u0445 micro-beats.`);
      }
      const objectMotif = normalizeCosmeticEnum(
        rawMoment.object_motif,
        CRYPTO_F2_OBJECT_MOTIFS,
        "object_motif",
        fallbackCryptoF2Motif(voiceExcerpt, fallbackOrdinal)
      );
      const motionAction = normalizeCosmeticEnum(
        rawMoment.motion_action,
        CRYPTO_F2_MOTION_ACTIONS,
        "motion_action",
        fallbackCryptoF2Action(voiceExcerpt, fallbackOrdinal)
      );
      const from = clampUnit(range.start / voiceWords.length);
      const to = clampUnit(range.end / voiceWords.length);
      return {
        id: `visual-${sceneIndex + 1}-${momentIndex + 1}`,
        voiceExcerpt,
        from,
        to,
        kind,
        presentationStyle,
        label: safeText ? label : voiceExcerpt.slice(0, 48),
        value: safeText && value ? value : void 0,
        detail: safeText && detail ? detail : void 0,
        sourceLabel: sourceLabel && voiceExcerpt.toLocaleLowerCase("ru-RU").includes(sourceLabel.toLocaleLowerCase("ru-RU")) ? sourceLabel : void 0,
        targetLabel: targetLabel && voiceExcerpt.toLocaleLowerCase("ru-RU").includes(targetLabel.toLocaleLowerCase("ru-RU")) ? targetLabel : void 0,
        position: normalizeCosmeticEnum(
          rawMoment.position,
          VISUAL_POSITIONS,
          "position",
          VISUAL_POSITIONS[stableChoiceIndex(`${fallbackSeed}:position`, VISUAL_POSITIONS.length)]
        ),
        enterAnimation: normalizeCosmeticEnum(
          rawMoment.enter_animation,
          CRYPTO_F2_ENTRY_ANIMATIONS,
          "enter_animation",
          CRYPTO_F2_ENTRY_ANIMATIONS[stableChoiceIndex(`${fallbackSeed}:enter`, CRYPTO_F2_ENTRY_ANIMATIONS.length)]
        ),
        exitAnimation: normalizeCosmeticEnum(
          rawMoment.exit_animation,
          CRYPTO_F2_EXIT_ANIMATIONS,
          "exit_animation",
          CRYPTO_F2_EXIT_ANIMATIONS[stableChoiceIndex(`${fallbackSeed}:exit`, CRYPTO_F2_EXIT_ANIMATIONS.length)]
        ),
        objectMotif,
        motionAction,
        microBeats
      };
    });
    const transitionIn = sceneIndex === 0 ? "cut" : normalizeCosmeticEnum(
      planScene.transition_in,
      CRYPTO_F2_TRANSITIONS,
      "transition_in",
      CRYPTO_F2_TRANSITIONS[stableChoiceIndex(`${topic2}:${voice}:${sceneIndex}:f2-transition`, CRYPTO_F2_TRANSITIONS.length)]
    );
    return { moments, transitionIn };
  });
  return diversifyCryptoF2Motion(
    normalizedScenes,
    motionSeed || `${topic2}:${scriptScenes.map((scene) => textValue(scene.voice_text)).join("|")}`,
    recentFingerprints
  );
}
function normalizeVisualPlan(topic2, response, scriptScenes, concept, targetDurationSeconds) {
  if (!Array.isArray(response.scenes) || response.scenes.length !== scriptScenes.length) {
    const actualCount = Array.isArray(response.scenes) ? response.scenes.length : "\u043D\u0435 \u043C\u0430\u0441\u0441\u0438\u0432";
    throw new Error(`AI Visual Plan \u0434\u043E\u043B\u0436\u0435\u043D \u043E\u043F\u0438\u0441\u044B\u0432\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E ${scriptScenes.length} \u0432\u0445\u043E\u0434\u043D\u044B\u0445 \u0441\u0446\u0435\u043D, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E: ${actualCount}.`);
  }
  const indexedScenes = /* @__PURE__ */ new Map();
  response.scenes.forEach((candidate, responseIndex) => {
    if (!candidate || typeof candidate !== "object") {
      throw new Error(`AI Visual Plan: \u0441\u0446\u0435\u043D\u0430 ${responseIndex + 1} \u0438\u043C\u0435\u0435\u0442 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442.`);
    }
    const scene = candidate;
    const rawNumber = Number(scene.scene_number);
    const sceneIndex = Number.isInteger(rawNumber) ? rawNumber - 1 : responseIndex;
    if (sceneIndex < 0) throw new Error("AI Visual Plan: \u043D\u043E\u043C\u0435\u0440 \u0441\u0446\u0435\u043D\u044B \u0434\u043E\u043B\u0436\u0435\u043D \u0431\u044B\u0442\u044C \u043D\u0435 \u043C\u0435\u043D\u044C\u0448\u0435 1.");
    if (sceneIndex >= scriptScenes.length) return;
    if (indexedScenes.has(sceneIndex)) throw new Error("AI Visual Plan: \u043D\u043E\u043C\u0435\u0440 \u0432\u0445\u043E\u0434\u043D\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0435\u0442\u0441\u044F.");
    indexedScenes.set(sceneIndex, scene);
  });
  let sideLayoutCount = 0;
  const normalizedScenes = scriptScenes.map((scriptScene, sceneIndex) => {
    const planScene = indexedScenes.get(sceneIndex);
    if (!planScene) throw new Error(`AI Visual Plan: \u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0441\u0446\u0435\u043D\u0430 ${sceneIndex + 1}.`);
    const rawMoments = Array.isArray(planScene.moments) ? planScene.moments : [];
    const voice = textValue(scriptScene.voice_text);
    const voiceWords = wordsIn(voice);
    if (!voiceWords.length) throw new Error(`\u0421\u0446\u0435\u043D\u0430 ${sceneIndex + 1} \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u043B\u044F \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438.`);
    const semanticRanges = semanticVoiceExcerptRanges(voice);
    const desiredMomentCount = semanticRanges.length;
    if (rawMoments.length !== desiredMomentCount) {
      throw new Error(`AI Visual Plan: \u0441\u0446\u0435\u043D\u0430 ${sceneIndex + 1} \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E ${desiredMomentCount} visual moments, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${rawMoments.length}.`);
    }
    const parsedMoments = rawMoments.map((candidate, momentIndex) => {
      if (!candidate || typeof candidate !== "object") {
        throw new Error(`AI Visual Plan: \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u0438\u043C\u0435\u0435\u0442 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442.`);
      }
      const rawMoment = candidate;
      const requestedExcerpt = textValue(rawMoment.voice_excerpt);
      const excerptWords = wordsIn(requestedExcerpt);
      if (!excerptWords.length) {
        throw new Error(`AI Visual Plan: \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 voice_excerpt.`);
      }
      const expectedStart = semanticRanges[momentIndex]?.start ?? 0;
      const exactWordStart = findWordSequence(voiceWords, excerptWords, expectedStart);
      const range = exactWordStart >= 0 ? { start: exactWordStart, end: exactWordStart + excerptWords.length } : closestWordRange(
        voiceWords,
        excerptWords,
        expectedStart
      );
      const wordStart = range.start;
      const wordEnd = range.end;
      const voiceExcerpt = wordExcerpt(voice, wordStart, wordEnd);
      const fallbackSeed = `${topic2}:${voice}:${sceneIndex}:${momentIndex}:${voiceExcerpt}`;
      const fallbackOrdinal = stableChoiceIndex(fallbackSeed, 2147483647);
      const requestedKind = normalizeVisualKind(
        rawMoment.visual_kind,
        concept,
        voiceExcerpt,
        fallbackOrdinal
      );
      const cueKind = conceptVisualKindCue(concept, voiceExcerpt)?.[1];
      const kind = isBitcoinSupplyTopic(topic2) ? bitcoinSupplyVisualKindForExcerpt(voiceExcerpt) : isDigitalAssetSupplyTopic(topic2) ? cueKind && DIGITAL_ASSET_VISUAL_KINDS.has(cueKind) ? cueKind : DIGITAL_ASSET_VISUAL_KINDS.has(requestedKind) ? requestedKind : fallbackVisualKindForTopic(topic2, concept, voiceExcerpt, fallbackOrdinal) : cueKind ?? requestedKind;
      const requestedPresentation = textValue(rawMoment.presentation_style);
      const presentationStyle = VISUAL_PRESENTATION_STYLES.includes(requestedPresentation) ? requestedPresentation : fallbackVisualPresentation(kind, fallbackOrdinal);
      const value = textValue(rawMoment.value).slice(0, 30);
      const sourceText = `${voice} ${textValue(scriptScene.screen_text)}`.toLocaleLowerCase("ru-RU");
      const label = textValue(rawMoment.label, textValue(scriptScene.screen_text, voiceExcerpt)).slice(0, 48);
      const detail = textValue(rawMoment.detail).slice(0, 56);
      const displayNumbers = `${label} ${value} ${detail}`.match(/\d+(?:[.,]\d+)?/gu) ?? [];
      if (displayNumbers.some((number) => !sourceText.includes(number))) {
        throw new Error(`AI Visual Plan: \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u0434\u043E\u0431\u0430\u0432\u0438\u043B \u0447\u0438\u0441\u043B\u043E, \u043A\u043E\u0442\u043E\u0440\u043E\u0433\u043E \u043D\u0435\u0442 \u0432 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0438.`);
      }
      return {
        voiceExcerpt,
        wordStart,
        wordEnd,
        kind,
        presentationStyle,
        label,
        value,
        detail,
        sourceLabel: textValue(rawMoment.source_label).slice(0, 24),
        targetLabel: textValue(rawMoment.target_label).slice(0, 24),
        position: normalizeCosmeticEnum(
          rawMoment.position,
          VISUAL_POSITIONS,
          "position",
          VISUAL_POSITIONS[stableChoiceIndex(`${fallbackSeed}:position`, VISUAL_POSITIONS.length)]
        ),
        enterAnimation: normalizeEntryAnimation(
          rawMoment.enter_animation,
          VISUAL_ENTRY_ANIMATIONS[fallbackOrdinal % VISUAL_ENTRY_ANIMATIONS.length]
        ),
        exitAnimation: normalizeExitAnimation(
          rawMoment.exit_animation,
          VISUAL_EXIT_ANIMATIONS[(fallbackOrdinal + 1) % VISUAL_EXIT_ANIMATIONS.length]
        ),
        microBeats: normalizeMicroBeats(
          rawMoment.micro_beats,
          voiceExcerpt,
          `${sceneIndex + 1}.${momentIndex + 1}`
        )
      };
    });
    parsedMoments.sort((left, right) => left.wordStart - right.wordStart);
    const assignedMomentIndexes = /* @__PURE__ */ new Set();
    const fallbackPositions = [
      "top_center",
      "top_left",
      "top_right",
      "center_left",
      "center_right",
      "hero"
    ];
    const moments = Array.from({ length: desiredMomentCount }, (_, momentIndex) => {
      const { start: startWord, end: endWord, excerpt } = semanticRanges[momentIndex];
      const match = parsedMoments.map((moment, candidateIndex) => ({ moment, candidateIndex })).filter(({ moment, candidateIndex }) => !assignedMomentIndexes.has(candidateIndex) && moment.wordStart < endWord && moment.wordEnd > startWord).map((candidate) => ({
        ...candidate,
        overlap: Math.max(
          0,
          Math.min(candidate.moment.wordEnd, endWord) - Math.max(candidate.moment.wordStart, startWord)
        )
      })).filter((candidate) => candidate.overlap / Math.max(1, Math.min(
        candidate.moment.wordEnd - candidate.moment.wordStart,
        endWord - startWord
      )) >= 0.5).sort((left, right) => right.overlap - left.overlap || Math.abs(left.moment.wordStart - startWord) - Math.abs(right.moment.wordStart - startWord))[0];
      const sourceMoment = match?.moment;
      if (match) assignedMomentIndexes.add(match.candidateIndex);
      const from = clampUnit(startWord / voiceWords.length);
      const to = clampUnit(endWord / voiceWords.length);
      const kind = sourceMoment?.kind ?? fallbackVisualKindForTopic(
        topic2,
        concept,
        excerpt,
        stableChoiceIndex(`${topic2}:${voice}:${sceneIndex}:${momentIndex}:${excerpt}:kind`, 2147483647)
      );
      const presentationStyle = sourceMoment?.presentationStyle ?? fallbackVisualPresentation(
        kind,
        stableChoiceIndex(`${topic2}:${voice}:${sceneIndex}:${momentIndex}:${excerpt}:presentation`, 2147483647)
      );
      const fallbackSeed = `${topic2}:${voice}:${sceneIndex}:${momentIndex}:${excerpt}`;
      const estimatedSeconds = (to - from) * voiceWords.length / ESTIMATED_SPEECH_WORDS_PER_SECOND;
      if (estimatedSeconds > 3) {
        throw new Error(`AI Visual Plan: \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u0434\u043B\u0438\u0442\u0441\u044F \u043E\u043A\u043E\u043B\u043E ${estimatedSeconds.toFixed(1)} \u0441; \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0440\u0430\u0437\u0431\u0438\u0432\u043A\u0430 \u0434\u043E 3 \u0441.`);
      }
      if (voiceWords.length >= 5 && estimatedSeconds < 1) {
        throw new Error(`AI Visual Plan: \u043C\u043E\u043C\u0435\u043D\u0442 ${sceneIndex + 1}.${momentIndex + 1} \u0434\u043B\u0438\u0442\u0441\u044F \u043E\u043A\u043E\u043B\u043E ${estimatedSeconds.toFixed(1)} \u0441; \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u0432\u0441\u0442\u0430\u0432\u043A\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0434\u043B\u0438\u0442\u044C\u0441\u044F \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 1 \u0441.`);
      }
      if (to <= from) throw new Error(`AI Visual Plan: \u043F\u0443\u0441\u0442\u043E\u0439 \u0438\u043D\u0442\u0435\u0440\u0432\u0430\u043B \u0443 \u043C\u043E\u043C\u0435\u043D\u0442\u0430 ${sceneIndex + 1}.${momentIndex + 1}.`);
      const segmentSource = `${excerpt} ${textValue(scriptScene.screen_text)}`.toLocaleLowerCase("ru-RU");
      const sourceDisplayNumbers = `${sourceMoment?.label ?? ""} ${sourceMoment?.value ?? ""} ${sourceMoment?.detail ?? ""}`.match(/\d+(?:[.,]\d+)?/gu) ?? [];
      const sourceMomentSafe = sourceDisplayNumbers.every((number) => segmentSource.includes(number));
      const label = sourceMomentSafe && sourceMoment?.label ? sourceMoment.label : excerpt.slice(0, 48);
      return {
        id: `visual-${sceneIndex + 1}-${momentIndex + 1}`,
        voiceExcerpt: excerpt,
        from,
        to,
        kind,
        presentationStyle,
        label,
        value: sourceMomentSafe ? sourceMoment?.value || void 0 : void 0,
        detail: sourceMomentSafe ? sourceMoment?.detail || void 0 : void 0,
        sourceLabel: sourceMoment?.sourceLabel || void 0,
        targetLabel: sourceMoment?.targetLabel || void 0,
        position: sourceMoment?.position ?? fallbackPositions[stableChoiceIndex(`${fallbackSeed}:position`, fallbackPositions.length)],
        enterAnimation: sourceMoment?.enterAnimation ?? VISUAL_ENTRY_ANIMATIONS[stableChoiceIndex(`${fallbackSeed}:enter`, VISUAL_ENTRY_ANIMATIONS.length)],
        exitAnimation: sourceMoment?.exitAnimation ?? VISUAL_EXIT_ANIMATIONS[stableChoiceIndex(`${fallbackSeed}:exit`, VISUAL_EXIT_ANIMATIONS.length)],
        microBeats: sourceMoment ? retimeMicroBeats(
          sourceMoment.microBeats ?? [],
          excerpt,
          `${sceneIndex + 1}.${momentIndex + 1}`
        ) : []
      };
    });
    const missingMicroBeatMoments = moments.filter((moment) => moment.microBeats?.length !== 2);
    if (missingMicroBeatMoments.length > 0) {
      throw new Error(
        `AI Visual Plan: ${missingMicroBeatMoments.length} visual moments \u0441\u0446\u0435\u043D\u044B ${sceneIndex + 1} \u043D\u0435 \u043F\u043E\u043B\u0443\u0447\u0438\u043B\u0438 2 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u043D\u044B\u0445 micro-beats.`
      );
    }
    const fallbackMomentCount = desiredMomentCount - assignedMomentIndexes.size;
    if (fallbackMomentCount > 0 || rawMoments.length !== desiredMomentCount) {
      console.warn(
        `[financial-visual-director] ${topic2}, scene ${sceneIndex + 1}: AI moments ${rawMoments.length}/${desiredMomentCount}; narration-derived fallback moments ${fallbackMomentCount}.`
      );
    }
    const meaningSignature = (moment) => [
      moment.kind,
      moment.presentationStyle,
      moment.position,
      moment.value || "",
      moment.detail?.toLocaleLowerCase("ru-RU") || "",
      moment.sourceLabel?.toLocaleLowerCase("ru-RU") || "",
      moment.targetLabel?.toLocaleLowerCase("ru-RU") || ""
    ].join("|");
    let duplicateFallbackCount = 0;
    for (let momentIndex = 1; momentIndex < moments.length; momentIndex += 1) {
      if (meaningSignature(moments[momentIndex - 1]) === meaningSignature(moments[momentIndex])) {
        const current = moments[momentIndex];
        const previous = moments[momentIndex - 1];
        const fallbackSeed = `${topic2}:${voice}:${sceneIndex}:${momentIndex}:${current.voiceExcerpt}:distinct`;
        const kind = fallbackVisualKindForTopic(
          topic2,
          concept,
          current.voiceExcerpt,
          stableChoiceIndex(fallbackSeed, 2147483647),
          previous.kind
        );
        moments[momentIndex] = {
          ...current,
          kind,
          presentationStyle: fallbackVisualPresentation(
            kind,
            stableChoiceIndex(`${fallbackSeed}:presentation`, 2147483647)
          ),
          value: void 0,
          detail: void 0,
          sourceLabel: void 0,
          targetLabel: void 0,
          position: fallbackPositions[stableChoiceIndex(`${fallbackSeed}:position`, fallbackPositions.length)]
        };
        duplicateFallbackCount += 1;
        if (meaningSignature(previous) === meaningSignature(moments[momentIndex])) {
          throw new Error(`AI Visual Plan: \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0439 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u043C\u044B\u0441\u043B \u0434\u043B\u044F \u043C\u043E\u043C\u0435\u043D\u0442\u0430 ${sceneIndex + 1}.${momentIndex + 1}.`);
        }
      }
    }
    if (duplicateFallbackCount > 0) {
      console.warn(
        `[financial-visual-director] ${topic2}, scene ${sceneIndex + 1}: replaced ${duplicateFallbackCount} repeated visual moments with concept-specific visuals.`
      );
    }
    let repositionedMomentCount = 0;
    for (let momentIndex = 1; momentIndex < moments.length; momentIndex += 1) {
      const previousPosition = moments[momentIndex - 1].position;
      if (moments[momentIndex].position !== previousPosition) continue;
      const alternatives = fallbackPositions.filter((position) => position !== previousPosition);
      const fallbackSeed = `${topic2}:${voice}:${sceneIndex}:${momentIndex}:position`;
      moments[momentIndex] = {
        ...moments[momentIndex],
        position: alternatives[stableChoiceIndex(fallbackSeed, alternatives.length)]
      };
      repositionedMomentCount += 1;
    }
    if (repositionedMomentCount > 0) {
      console.warn(
        `[financial-visual-director] ${topic2}, scene ${sceneIndex + 1}: shifted ${repositionedMomentCount} adjacent visual moments to different positions.`
      );
    }
    const presenterPose = textValue(planScene.presenter_pose);
    if (!FINANCIAL_PRESENTER_POSES.includes(presenterPose)) {
      throw new Error(`AI Visual Plan: \u0441\u0446\u0435\u043D\u0430 ${sceneIndex + 1} \u0434\u043E\u043B\u0436\u043D\u0430 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043F\u043E\u0437\u0443 \u0432\u0435\u0434\u0443\u0449\u0435\u0433\u043E \u0438\u0437 ${FINANCIAL_PRESENTER_POSES.join(", ")}.`);
    }
    const rawComposition = textValue(planScene.composition);
    const rawPresenterLayout = textValue(planScene.presenter_layout);
    const validComposition = VISUAL_COMPOSITIONS.includes(rawComposition);
    const validPresenterLayout = PRESENTER_LAYOUTS.includes(rawPresenterLayout);
    let composition = validComposition ? rawComposition : rawPresenterLayout === "left" ? "presenter_left" : rawPresenterLayout === "right" ? "presenter_right" : rawPresenterLayout === "large" ? "feature_card" : "center";
    let presenterLayout = validPresenterLayout ? rawPresenterLayout : composition === "presenter_left" ? "left" : composition === "presenter_right" ? "right" : composition === "feature_card" ? "large" : "center";
    if (composition === "presenter_left" || presenterLayout === "left") composition = "presenter_left";
    if (composition === "presenter_right" || presenterLayout === "right") composition = "presenter_right";
    if (composition === "presenter_left" || composition === "presenter_right") {
      if (sceneIndex === 0 || sceneIndex === scriptScenes.length - 1 || sideLayoutCount >= 2) {
        composition = "center";
        presenterLayout = "center";
      } else {
        sideLayoutCount += 1;
        presenterLayout = composition === "presenter_left" ? "left" : "right";
      }
    } else if (composition === "feature_card") {
      presenterLayout = presenterLayout === "large" ? "large" : "center";
    } else {
      presenterLayout = presenterLayout === "large" ? "large" : "center";
      composition = "center";
    }
    return {
      moments,
      composition,
      presenterLayout,
      presenterPose,
      cameraAction: normalizeCosmeticEnum(
        planScene.camera_action,
        CAMERA_ACTIONS,
        "camera_action",
        "locked"
      ),
      transitionIn: normalizeCosmeticEnum(
        planScene.transition_in,
        SCENE_TRANSITIONS,
        "transition_in",
        SCENE_TRANSITIONS[stableChoiceIndex(`${topic2}:${voice}:${sceneIndex}:transition`, SCENE_TRANSITIONS.length)]
      )
    };
  });
  if (targetDurationSeconds !== void 0 && normalizedScenes.length > 1) {
    let activePose = normalizedScenes[0].presenterPose;
    let lastPoseChangeAtMs = 0;
    let sceneStartAtMs = 0;
    for (let sceneIndex = 1; sceneIndex < normalizedScenes.length; sceneIndex += 1) {
      sceneStartAtMs += wordsIn(textValue(scriptScenes[sceneIndex - 1].voice_text)).length / ESTIMATED_SPEECH_WORDS_PER_SECOND * 1e3;
      const scene = normalizedScenes[sceneIndex];
      if (sceneStartAtMs - lastPoseChangeAtMs < 5e3) {
        scene.presenterPose = activePose;
        continue;
      }
      let nextPose = scene.presenterPose;
      if (nextPose === activePose) {
        const alternatives = FINANCIAL_PRESENTER_POSES.filter((pose) => pose !== activePose);
        nextPose = alternatives[stableChoiceIndex(`${topic2}:${sceneIndex}:pose-cooldown`, alternatives.length)];
      }
      scene.presenterPose = nextPose;
      activePose = nextPose;
      lastPoseChangeAtMs = sceneStartAtMs;
    }
  }
  const poseChangeCount = normalizedScenes.slice(1).filter(
    (scene, index) => scene.presenterPose !== normalizedScenes[index].presenterPose
  ).length;
  const minimumPoseChanges = targetDurationSeconds === void 0 ? Math.min(1, normalizedScenes.length - 1) : Math.min(4, normalizedScenes.length - 1);
  const maximumPoseChanges = targetDurationSeconds === void 0 ? normalizedScenes.length - 1 : Math.min(6, normalizedScenes.length - 1);
  if (poseChangeCount < minimumPoseChanges || poseChangeCount > maximumPoseChanges) {
    throw new Error(`AI Visual Plan: \u043F\u043E\u0437\u044B \u0432\u0435\u0434\u0443\u0449\u0435\u0433\u043E \u0434\u043E\u043B\u0436\u043D\u044B \u0441\u043C\u0435\u043D\u0438\u0442\u044C\u0441\u044F ${minimumPoseChanges}\u2013${maximumPoseChanges} \u0440\u0430\u0437, \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043E ${poseChangeCount}.`);
  }
  const movingCameraSceneCount = normalizedScenes.filter((scene) => scene.cameraAction !== "locked").length;
  const maximumMovingCameraScenes = Math.max(1, Math.floor(normalizedScenes.length / 4));
  if (movingCameraSceneCount > maximumMovingCameraScenes) {
    throw new Error(`AI Visual Plan: \u043A\u0430\u043C\u0435\u0440\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043E\u0441\u0442\u0430\u0432\u0430\u0442\u044C\u0441\u044F locked \u0432 \u0431\u043E\u043B\u044C\u0448\u0438\u043D\u0441\u0442\u0432\u0435 \u0441\u0446\u0435\u043D; \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0439 \u043A\u0430\u043C\u0435\u0440\u044B ${movingCameraSceneCount}, \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C ${maximumMovingCameraScenes}.`);
  }
  if (normalizedScenes.length >= MIN_SCENES2 && normalizedScenes.every((scene) => scene.composition === "center")) {
    const middleCandidates = normalizedScenes.slice(1, -1).map((scene, offset) => ({
      scene,
      sceneIndex: offset + 1,
      sideScore: scene.moments.filter((moment) => ["money_flow", "market_chart", "portfolio", "ownership", "distribution"].includes(moment.kind)).length,
      featureScore: scene.moments.filter((moment) => ["concept_card", "document", "metric", "compound_growth", "payoff"].includes(moment.kind)).length
    }));
    const selected = middleCandidates.reduce((best, candidate) => candidate.sideScore + candidate.featureScore > best.sideScore + best.featureScore ? candidate : best);
    const useFeatureCard = selected.featureScore > selected.sideScore;
    if (useFeatureCard) {
      normalizedScenes[selected.sceneIndex] = {
        ...selected.scene,
        composition: "feature_card",
        presenterLayout: "large"
      };
    } else {
      const leftVisuals = selected.scene.moments.filter((moment) => moment.position.endsWith("left")).length;
      const rightVisuals = selected.scene.moments.filter((moment) => moment.position.endsWith("right")).length;
      const voiceHash = wordsIn(textValue(scriptScenes[selected.sceneIndex]?.voice_text)).join("").split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
      const presenterSide = leftVisuals > rightVisuals ? "right" : rightVisuals > leftVisuals ? "left" : voiceHash % 2 === 0 ? "left" : "right";
      normalizedScenes[selected.sceneIndex] = {
        ...selected.scene,
        composition: presenterSide === "left" ? "presenter_left" : "presenter_right",
        presenterLayout: presenterSide
      };
    }
  }
  return normalizedScenes;
}
function buildNarrationDrivenVisualPlan(topic2, concept, scriptScenes, targetDurationSeconds, category = "finance", visualTheme) {
  const cryptoF2 = visualTheme === "crypto_f2";
  const requiredPoseChanges = cryptoF2 ? 0 : Math.min(5, Math.max(0, scriptScenes.length - 1));
  const poseOffset = stableChoiceIndex(
    `${topic2}:fallback-presenter-poses`,
    FINANCIAL_PRESENTER_POSES.length
  );
  let previousTransition;
  return {
    scenes: scriptScenes.map((scriptScene, sceneIndex) => {
      const voice = textValue(scriptScene.voice_text);
      const voiceWords = wordsIn(voice);
      if (!voiceWords.length) {
        throw new Error(`\u0421\u0446\u0435\u043D\u0430 ${sceneIndex + 1} \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u043B\u044F narration-driven visual plan.`);
      }
      const semanticRanges = semanticVoiceExcerptRanges(voice);
      const momentCount = semanticRanges.length;
      const moments = semanticRanges.map(({ excerpt }, momentIndex) => {
        const seed = `${topic2}:${voice}:${sceneIndex}:${momentIndex}:${excerpt}:narration-fallback`;
        const ordinal = stableChoiceIndex(seed, 2147483647);
        const kind = fallbackVisualKindForTopic(topic2, concept, excerpt, ordinal, void 0, category);
        const microBeats = fallbackMicroBeats(
          excerpt,
          `${sceneIndex + 1}.${momentIndex + 1}`,
          cryptoF2
        ).map((microBeat) => ({
          type: microBeat.kind,
          cue_excerpt: microBeat.cueExcerpt,
          text: microBeat.text,
          position: microBeat.position,
          enter_animation: microBeat.enterAnimation,
          exit_animation: microBeat.exitAnimation,
          hold_words: microBeat.holdWords
        }));
        return {
          voice_excerpt: excerpt,
          visual_kind: kind,
          label: excerpt.slice(0, 48),
          value: "",
          detail: "",
          source_label: "",
          target_label: "",
          ...cryptoF2 ? {
            object_motif: fallbackCryptoF2Motif(excerpt, ordinal),
            motion_action: fallbackCryptoF2Action(excerpt, ordinal)
          } : {},
          ...!cryptoF2 ? { presentation_style: fallbackVisualPresentation(kind, ordinal) } : {},
          position: VISUAL_POSITIONS[stableChoiceIndex(`${seed}:position`, VISUAL_POSITIONS.length)],
          enter_animation: cryptoF2 ? CRYPTO_F2_ENTRY_ANIMATIONS[stableChoiceIndex(`${seed}:enter`, CRYPTO_F2_ENTRY_ANIMATIONS.length)] : VISUAL_ENTRY_ANIMATIONS[stableChoiceIndex(`${seed}:enter`, VISUAL_ENTRY_ANIMATIONS.length)],
          exit_animation: cryptoF2 ? CRYPTO_F2_EXIT_ANIMATIONS[stableChoiceIndex(`${seed}:exit`, CRYPTO_F2_EXIT_ANIMATIONS.length)] : VISUAL_EXIT_ANIMATIONS[stableChoiceIndex(`${seed}:exit`, VISUAL_EXIT_ANIMATIONS.length)],
          micro_beats: microBeats
        };
      });
      const availableTransitions = cryptoF2 ? CRYPTO_F2_TRANSITIONS : SCENE_TRANSITIONS;
      const transitionIndex = sceneIndex === 0 ? availableTransitions.indexOf("cut") : stableChoiceIndex(
        `${topic2}:${sceneIndex}:${voice}:fallback-transition`,
        availableTransitions.length
      );
      let transition = availableTransitions[transitionIndex] ?? availableTransitions[0];
      if (sceneIndex > 0 && transition === previousTransition) {
        transition = availableTransitions[(transitionIndex + 1) % availableTransitions.length];
      }
      previousTransition = transition;
      const poseStep = Math.min(sceneIndex, requiredPoseChanges);
      const presenterPose = FINANCIAL_PRESENTER_POSES[(poseOffset + poseStep) % FINANCIAL_PRESENTER_POSES.length];
      return {
        scene_number: sceneIndex + 1,
        duration_seconds: voiceWords.length / ESTIMATED_SPEECH_WORDS_PER_SECOND,
        target_moment_count: momentCount,
        transition_in: transition,
        ...!cryptoF2 ? {
          camera_action: "locked",
          composition: "center",
          presenter_layout: "center",
          presenter_pose: presenterPose
        } : {},
        moments
      };
    })
  };
}
async function requestFinancialVisualPlan(topic2, concept, scriptScenes, targetDurationSeconds, category = "finance", visualTheme, motionSeed = "", recentMotionFingerprints = []) {
  const cryptoF2 = visualTheme === "crypto_f2";
  const permittedKinds = MOMENT_KINDS_BY_CONCEPT[concept];
  const microBeatSchema = () => [{
    type: `one of: ${MICRO_BEAT_KINDS.join(", ")}`,
    cue_excerpt: "short exact spoken phrase, preferably a complete semantic cue",
    text: "short exact fragment of cue_excerpt; empty only for arrow",
    position: `one of: ${MICRO_BEAT_POSITIONS.join(", ")}`,
    enter_animation: `one of: ${(cryptoF2 ? CRYPTO_F2_ENTRY_ANIMATIONS : VISUAL_ENTRY_ANIMATIONS).join(", ")}`,
    exit_animation: `one of: ${(cryptoF2 ? CRYPTO_F2_EXIT_ANIMATIONS : MICRO_BEAT_EXIT_ANIMATIONS).join(", ")}`,
    hold_words: "2 to 6"
  }, {
    type: `one of: ${MICRO_BEAT_KINDS.join(", ")}`,
    cue_excerpt: "a later exact phrase from this visual moment",
    text: "short exact fragment of cue_excerpt; empty only for arrow",
    position: `one of: ${MICRO_BEAT_POSITIONS.join(", ")}`,
    enter_animation: `one of: ${(cryptoF2 ? CRYPTO_F2_ENTRY_ANIMATIONS : VISUAL_ENTRY_ANIMATIONS).join(", ")}`,
    exit_animation: `one of: ${(cryptoF2 ? CRYPTO_F2_EXIT_ANIMATIONS : MICRO_BEAT_EXIT_ANIMATIONS).join(", ")}`,
    hold_words: "2 to 6"
  }];
  const visualMomentSchema = (momentIndex) => ({
    voice_excerpt: `exact consecutive words for moment ${momentIndex + 1}`,
    visual_kind: `one of: ${permittedKinds.join(", ")}`,
    label: "short, topic-specific label",
    value: "only a value literally stated in this exact narration or screen text",
    detail: "brief explanation grounded in this exact moment",
    source_label: "participant stated in this exact moment, or empty",
    target_label: "participant stated in this exact moment, or empty",
    ...!cryptoF2 ? { presentation_style: `one of: ${VISUAL_PRESENTATION_STYLES.join(", ")}` } : {},
    position: `one of: ${VISUAL_POSITIONS.join(", ")}`,
    enter_animation: `one of: ${(cryptoF2 ? CRYPTO_F2_ENTRY_ANIMATIONS : VISUAL_ENTRY_ANIMATIONS).join(", ")}`,
    exit_animation: `one of: ${(cryptoF2 ? CRYPTO_F2_EXIT_ANIMATIONS : VISUAL_EXIT_ANIMATIONS).join(", ")}`,
    ...cryptoF2 ? {
      object_motif: `one of: ${CRYPTO_F2_OBJECT_MOTIFS.join(", ")}`,
      motion_action: `one of: ${CRYPTO_F2_MOTION_ACTIONS.join(", ")}`
    } : {},
    micro_beats: microBeatSchema()
  });
  const visualPlanSchema = {
    scenes: scriptScenes.map((scene, sceneIndex) => {
      const voiceText = textValue(scene.voice_text);
      const momentCount = targetVisualMomentCount(voiceText);
      return {
        scene_number: sceneIndex + 1,
        duration_seconds: "number matching the input narration",
        target_moment_count: momentCount,
        transition_in: `one of: ${(cryptoF2 ? CRYPTO_F2_TRANSITIONS : SCENE_TRANSITIONS).join(", ")}`,
        ...!cryptoF2 ? {
          camera_action: `one of: ${CAMERA_ACTIONS.join(", ")}`,
          composition: `one of: ${VISUAL_COMPOSITIONS.join(", ")}`,
          presenter_layout: `one of: ${PRESENTER_LAYOUTS.join(", ")}`,
          presenter_pose: `one of: ${FINANCIAL_PRESENTER_POSES.join(", ")}`
        } : {},
        moments: Array.from({ length: momentCount }, (_, momentIndex) => visualMomentSchema(momentIndex))
      };
    })
  };
  const system = [
    "\u0422\u044B \u2014 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 AI visual director \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u0445 YouTube Shorts. \u0414\u043E \u0440\u0435\u043D\u0434\u0435\u0440\u0430 \u0441\u043E\u0437\u0434\u0430\u0439 \u043F\u043B\u0430\u043D \u0442\u043E\u0433\u043E, \u0447\u0442\u043E, \u0433\u0434\u0435, \u043A\u043E\u0433\u0434\u0430 \u0438 \u043A\u0430\u043A \u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F, \u0438 \u043A\u043E\u0433\u0434\u0430 \u0443\u0445\u043E\u0434\u0438\u0442.",
    "\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0438 voice_text \u0443\u0436\u0435 \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u044B. \u041D\u0435 \u043F\u0435\u0440\u0435\u043F\u0438\u0441\u044B\u0432\u0430\u0439 \u0438\u0445, \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u0444\u0440\u0430\u0437\u044B \u0438 \u043D\u0435 \u043C\u0435\u043D\u044F\u0439 \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u0439 \u0441\u043C\u044B\u0441\u043B.",
    ...cryptoF2 ? [
      "\u0412 \u0444\u043E\u0440\u043C\u0430\u0442\u0435 \xAB\u041A\u0440\u0438\u043F\u0442\u043E \u04242\xBB \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u0430\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u0430 \u043E\u0442 \u0432\u0435\u0434\u0443\u0449\u0435\u0433\u043E \u0438 \u0448\u0430\u0431\u043B\u043E\u043D\u043E\u0432 \u043F\u0435\u0440\u0432\u043E\u0433\u043E \u0444\u043E\u0440\u043C\u0430\u0442\u0430: \u0442\u0451\u043C\u043D\u0430\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043D\u0430\u044F 2D-\u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044F, \u043C\u044F\u0442\u043D\u044B\u0435 \u0438 \u0442\u0451\u043F\u043B\u044B\u0435 \u0441\u0432\u0435\u0442\u043B\u044B\u0435 \u0430\u043A\u0446\u0435\u043D\u0442\u044B, \u0431\u0435\u0437 \u0432\u0435\u0434\u0443\u0449\u0435\u0433\u043E, \u0444\u043E\u0442\u043E, \u043F\u0430\u043D\u0435\u043B\u0435\u0439 \u0438 \u0431\u043E\u043B\u044C\u0448\u0438\u0445 \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A.",
      "\u0421\u0432\u044F\u0436\u0438 \u0440\u043E\u043B\u0438\u043A \u0433\u043B\u0430\u0432\u043D\u044B\u043C \u0442\u0435\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u043C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C \u0438\u043B\u0438 \u043C\u0435\u0442\u0430\u0444\u043E\u0440\u043E\u0439. \u041F\u043E \u043C\u0435\u0440\u0435 \u0440\u0435\u0447\u0438 \u043C\u0435\u043D\u044F\u0439 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435 \u0438 \u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u044F \u044D\u0442\u043E\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430, \u0430 \u043D\u0435 \u043F\u043E\u0434\u043C\u0435\u043D\u044F\u0439 \u0435\u0433\u043E \u043D\u0435\u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u043C\u0438 \u0434\u0435\u043A\u043E\u0440\u0430\u0442\u0438\u0432\u043D\u044B\u043C\u0438 \u0438\u043A\u043E\u043D\u043A\u0430\u043C\u0438.",
      `\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u0432\u044B\u0431\u0435\u0440\u0438 object_motif \u0438\u0437 ${CRYPTO_F2_OBJECT_MOTIFS.join(", ")} \u0438 motion_action \u0438\u0437 ${CRYPTO_F2_MOTION_ACTIONS.join(", ")}. \u0414\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0434\u043E\u043B\u0436\u043D\u043E \u0431\u0443\u043A\u0432\u0430\u043B\u044C\u043D\u043E \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0441\u043C\u044B\u0441\u043B \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0440\u0435\u043F\u043B\u0438\u043A\u0438: \u0441\u0431\u043E\u0440\u043A\u0443, \u043F\u0435\u0440\u0435\u0445\u043E\u0434, \u043F\u043E\u0442\u043E\u043A, \u0440\u0430\u0441\u043A\u0440\u044B\u0442\u0438\u0435, \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443, \u0437\u0430\u0449\u0438\u0442\u0443 \u0438\u043B\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F.`,
      `\u0412\u044B\u0431\u0438\u0440\u0430\u0439 enter_animation \u0438\u0437 ${CRYPTO_F2_ENTRY_ANIMATIONS.join(", ")} \u0438 exit_animation \u0438\u0437 ${CRYPTO_F2_EXIT_ANIMATIONS.join(", ")}. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u043E\u0434\u0438\u043D \u0438 \u0442\u043E\u0442 \u0436\u0435 \u0432\u044B\u0431\u043E\u0440 \u0432 \u043F\u0440\u0435\u0434\u0435\u043B\u0430\u0445 \u0440\u043E\u043B\u0438\u043A\u0430, \u043F\u043E\u043A\u0430 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B \u0430\u043B\u044C\u0442\u0435\u0440\u043D\u0430\u0442\u0438\u0432\u044B; \u043C\u0435\u043D\u044F\u0439 \u0442\u0440\u0430\u0435\u043A\u0442\u043E\u0440\u0438\u044E \u0438 \u0432\u0430\u0440\u0438\u0430\u043D\u0442 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F.`,
      `\u0414\u043B\u044F transition_in \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0442\u043E\u043B\u044C\u043A\u043E ${CRYPTO_F2_TRANSITIONS.join(", ")}. \u0412\u044B\u0431\u0438\u0440\u0430\u0439 \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u043F\u043E \u0441\u0432\u044F\u0437\u0438 \u043C\u0435\u0436\u0434\u0443 \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u043C \u0438 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u043C \u043E\u0431\u044A\u0435\u043A\u0442\u043E\u043C \u0438\u043B\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435\u043C; \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u0441\u043E\u0441\u0435\u0434\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u044B.`,
      "\u041A\u0430\u0436\u0434\u044B\u0439 micro_beat \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D \u043A \u0442\u043E\u0447\u043D\u044B\u043C \u0441\u043B\u043E\u0432\u0430\u043C cue_excerpt. \u041F\u0435\u0440\u0432\u044B\u0439 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u043D\u0430\u0447\u0430\u043B\u044C\u043D\u044B\u0439 \u043E\u0431\u044A\u0435\u043A\u0442 \u0438\u043B\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435; \u0432\u0442\u043E\u0440\u043E\u0439 \u2014 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435, \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0438\u043B\u0438 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430. \u0421\u0442\u0430\u0432\u044C \u043A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u044B\u0435 \u0432\u0441\u0442\u0430\u0432\u043A\u0438 \u0441\u043B\u0435\u0432\u0430 \u0438\u043B\u0438 \u0441\u043F\u0440\u0430\u0432\u0430 \u043D\u0430\u0434 \u043D\u0438\u0436\u043D\u0435\u0439 \u0437\u043E\u043D\u043E\u0439 \u0441\u0443\u0431\u0442\u0438\u0442\u0440\u043E\u0432, \u0431\u0435\u0437 sticker rail.",
      "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u0443\u044E \u0438\u0434\u0435\u043D\u0442\u0438\u0447\u043D\u043E\u0441\u0442\u044C \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0433\u043E \u0442\u0435\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u043E\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430 \u0432 \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0445 \u0441\u0446\u0435\u043D\u0430\u0445. \u0414\u043B\u044F \u043F\u0430\u0440\u044B \u0431\u043B\u043E\u043A\u0447\u0435\u0439\u043D/\u043A\u043E\u0448\u0435\u043B\u0451\u043A/\u043A\u043B\u044E\u0447 \u0432\u044B\u0431\u0438\u0440\u0430\u0439 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0443\u044E \u0444\u043E\u0440\u043C\u0443 \u043F\u043E \u0440\u0435\u043F\u043B\u0438\u043A\u0435; \u043D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0447\u0438\u0441\u043B\u0430, \u0442\u0438\u043A\u0435\u0440\u044B, \u0431\u0430\u043B\u0430\u043D\u0441\u044B \u0438\u043B\u0438 \u0442\u0435\u0445\u043D\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0441\u0432\u043E\u0439\u0441\u0442\u0432\u0430.",
      "\u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u043D\u0435\u0434\u0430\u0432\u043D\u044E\u044E \u043F\u043E\u043B\u043D\u0443\u044E \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0439. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043F\u0435\u0440\u0435\u0434\u0430\u043D\u043D\u044B\u0435 \u043D\u0435\u0434\u0430\u0432\u043D\u0438\u0435 motion fingerprints \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0430\u043A \u0437\u0430\u043F\u0440\u0435\u0442 \u043D\u0430 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435, \u043D\u0435 \u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u043F\u0440\u043E\u0448\u043B\u044B\u0435 \u0441\u0446\u0435\u043D\u044B."
    ] : [],
    ...!cryptoF2 ? [
      "\u041F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u0430\u044F \u0444\u0438\u0440\u043C\u0435\u043D\u043D\u0430\u044F \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0430 \u0432\u0435\u0434\u0443\u0449\u0438\u043C, \u043F\u0430\u043B\u0438\u0442\u0440\u043E\u0439, \u0442\u0438\u043F\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u043E\u0439, \u043A\u0430\u0447\u0435\u0441\u0442\u0432\u043E\u043C \u043A\u0430\u0434\u0440\u0430 \u0438 safe zones. \u041E\u043D\u0430 \u043D\u0435 \u0437\u0430\u0434\u0430\u0451\u0442 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438, \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F, \u0433\u0440\u0430\u0444\u0438\u043A\u0438, \u043A\u043E\u043C\u043F\u043E\u0437\u0438\u0446\u0438\u044E, \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u043A\u0430\u043C\u0435\u0440\u044B, \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044E, \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u044B \u0438\u043B\u0438 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C."
    ] : [],
    ...!cryptoF2 ? [
      "\u0421\u043E\u0437\u0434\u0430\u0439 \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u044B\u0435 \u0441\u0442\u0438\u043A\u0435\u0440\u044B \u0438 emoji-\u043F\u043E\u0434\u043E\u0431\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043D\u044B\u0435 \u0432\u0441\u0442\u0430\u0432\u043A\u0438 \u0437\u0430\u043D\u043E\u0432\u043E \u043F\u043E \u0442\u043E\u0447\u043D\u043E\u0439 \u0442\u0435\u043C\u0435 \u0438 \u0440\u0435\u0447\u0438 \u044D\u0442\u043E\u0433\u043E \u0440\u043E\u043B\u0438\u043A\u0430. \u041D\u0435 \u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u043F\u0440\u043E\u0448\u043B\u044B\u0435 \u043F\u043B\u0430\u043D\u044B \u0438\u043B\u0438 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u043D\u0430\u0431\u043E\u0440\u044B \u0432\u0438\u0437\u0443\u0430\u043B\u043E\u0432. \u0412 premium_creator \u0432\u0438\u0434\u0438\u043C\u044B\u0435 \u0441\u043B\u043E\u0438 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u044B \u0432\u0435\u0434\u0443\u0449\u0438\u043C, \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u043D\u044B\u043C\u0438 \u0441\u0443\u0431\u0442\u0438\u0442\u0440\u0430\u043C\u0438 \u0438 \u0441\u0442\u0438\u043A\u0435\u0440\u0430\u043C\u0438; \u0437\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u044B \u043F\u043E\u043B\u043D\u043E\u0440\u0430\u0437\u043C\u0435\u0440\u043D\u044B\u0435 \u0433\u0440\u0430\u0444\u0438\u043A\u0438, \u0434\u0438\u0430\u0433\u0440\u0430\u043C\u043C\u044B, \u043E\u0441\u0438, \u0438\u043D\u0444\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u0430, \u0442\u0430\u0431\u043B\u0438\u0446\u044B, \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0438 \u043F\u0430\u043D\u0435\u043B\u0438. \u041A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u0430\u044F \u043B\u0438\u043D\u0438\u044F \u0446\u0435\u043D\u044B \u0440\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0430\u043A \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0441\u0442\u0438\u043A\u0435\u0440, \u043A\u043E\u0433\u0434\u0430 \u043E\u043D\u0430 \u043F\u0440\u044F\u043C\u043E \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0440\u0435\u0447\u0438."
    ] : [],
    `\u041E\u0442\u0432\u0435\u0442 \u043E\u0431\u044F\u0437\u0430\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E ${scriptScenes.length} \u0441\u0446\u0435\u043D: \u043F\u043E \u043E\u0434\u043D\u043E\u0439 \u043D\u0430 \u043A\u0430\u0436\u0434\u0443\u044E \u0432\u0445\u043E\u0434\u043D\u0443\u044E \u0441\u0446\u0435\u043D\u0443, \u0441 scene_number \u043E\u0442 1 \u0434\u043E ${scriptScenes.length}. \u041D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u043D\u043E\u0432\u044B\u0435 \u0441\u0446\u0435\u043D\u044B \u0438 \u043D\u0435 \u0440\u0430\u0437\u0431\u0438\u0432\u0430\u0439 \u0432\u0445\u043E\u0434\u043D\u044B\u0435 \u0441\u0446\u0435\u043D\u044B \u2014 \u0434\u043E\u043F\u043E\u043B\u043D\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u0441\u043E\u0431\u044B\u0442\u0438\u044F \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C moments \u0432\u043D\u0443\u0442\u0440\u0438 \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0439 \u0441\u0446\u0435\u043D\u044B. \u041D\u0435 \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438\u043C\u0435\u0440 \u043F\u0435\u0440\u0432\u043E\u0439 \u0441\u0446\u0435\u043D\u044B.`,
    "\u0412 \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0446\u0435\u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0439 \u0440\u043E\u0432\u043D\u043E target_moment_count \u043C\u043E\u043C\u0435\u043D\u0442\u043E\u0432. \u0420\u0430\u0437\u0431\u0435\u0439 \u0432\u0435\u0441\u044C voice_text \u043D\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u0442\u043E\u0447\u043D\u044B\u0435 voice_excerpt \u2014 \u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u0440\u0435\u0447\u044C \u0434\u043E\u0441\u043B\u043E\u0432\u043D\u043E, \u0431\u0435\u0437 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u043E\u0432 \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u043E\u0432.",
    "\u041A\u0430\u0436\u0434\u044B\u0439 visual moment \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u043E\u0434\u043D\u043E\u0439 \u0437\u0430\u043A\u043E\u043D\u0447\u0435\u043D\u043D\u043E\u0439 \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u043E\u0439 \u0444\u0440\u0430\u0437\u0435: \u043E\u0440\u0438\u0435\u043D\u0442\u0438\u0440\u0443\u0439\u0441\u044F \u043D\u0430 \u0433\u0440\u0430\u043D\u0438\u0446\u044B \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0439 \u0438 \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0447\u0430\u0441\u0442\u0435\u0439 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F. \u041D\u0435 \u0440\u0430\u0437\u0440\u0435\u0437\u0430\u0439 \u0446\u0435\u043B\u044C\u043D\u0443\u044E \u043C\u044B\u0441\u043B\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0430\u0434\u0438 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u043E\u0439 \u0434\u043B\u0438\u043D\u044B; \u0440\u0430\u0437\u0434\u0435\u043B\u044F\u0439, \u043A\u043E\u0433\u0434\u0430 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442, \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u0438\u043B\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442. \u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439 \u0442\u043E\u0447\u043D\u044B\u0439 \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 voice_excerpt \u0431\u0435\u0437 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u043E\u0432 \u0438 \u043F\u043E\u0432\u0442\u043E\u0440\u043E\u0432.",
    "\u0412\u041D\u0423\u0422\u0420\u0418 \u043A\u0430\u0436\u0434\u043E\u0433\u043E visual moment \u0441\u043E\u0437\u0434\u0430\u0439 \u0440\u043E\u0432\u043D\u043E 2 micro_beats \u0432 \u0445\u0440\u043E\u043D\u043E\u043B\u043E\u0433\u0438\u0447\u0435\u0441\u043A\u043E\u043C \u043F\u043E\u0440\u044F\u0434\u043A\u0435. \u041A\u0430\u0436\u0434\u044B\u0439 cue_excerpt \u2014 \u0442\u043E\u0447\u043D\u044B\u0439 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442 \u0438\u0437 voice_excerpt, \u043E\u0431\u044B\u0447\u043D\u043E \u0446\u0435\u043B\u0430\u044F \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043D\u0430\u044F \u0444\u0440\u0430\u0437\u0430, \u0430 \u043D\u0435 \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0435 1\u20133 \u0441\u043B\u043E\u0432\u0430; text \u2014 \u043A\u043E\u0440\u043E\u0442\u043A\u0430\u044F \u043F\u043E\u0434\u043F\u0438\u0441\u044C \u043F\u043E \u0441\u043C\u044B\u0441\u043B\u0443 \u044D\u0442\u043E\u0433\u043E cue. \u041D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u0447\u0438\u0441\u043B\u0430 \u0438 \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u044B\u0435 \u0444\u0430\u043A\u0442\u044B, \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043D\u0435\u0442 \u0432 \u0440\u0435\u0447\u0438. \u041F\u0435\u0440\u0432\u044B\u0439 beat \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0433\u043B\u0430\u0432\u043D\u044B\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442 \u0438\u043B\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435; \u0432\u0442\u043E\u0440\u043E\u0439 \u2014 \u0435\u0433\u043E \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u044D\u0442\u0430\u043F, \u0443\u0441\u043B\u043E\u0432\u0438\u0435 \u0438\u043B\u0438 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0443\u043C\u0435\u0441\u0442\u043D\u044B\u0439 companion-\u0432\u0438\u0437\u0443\u0430\u043B. \u0415\u0441\u043B\u0438 \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043F\u0440\u043E\u0438\u0437\u043D\u0435\u0441\u0451\u043D\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E, \u043E\u0434\u0438\u043D beat \u043C\u043E\u0436\u0435\u0442 \u043F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0435\u0433\u043E \u043A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u044B\u043C \u0447\u0438\u0441\u043B\u043E\u0432\u044B\u043C \u0441\u0442\u0438\u043A\u0435\u0440\u043E\u043C. \u0412\u044B\u0431\u0438\u0440\u0430\u0439 \u0440\u0430\u0437\u043D\u044B\u0435 entrance-\u0430\u043D\u0438\u043C\u0430\u0446\u0438\u0438; hold_words \u2014 \u043E\u0442 2 \u0434\u043E 6. \u042D\u0442\u0438 \u0441\u043E\u0431\u044B\u0442\u0438\u044F \u043F\u0440\u043E\u0438\u0441\u0445\u043E\u0434\u044F\u0442 \u0432\u043D\u0443\u0442\u0440\u0438 \u0438\u0441\u0445\u043E\u0434\u043D\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u0438 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u044E\u0442 \u043D\u043E\u0432\u044B\u0445 \u0441\u0446\u0435\u043D.",
    "\u0421\u0442\u0438\u043A\u0435\u0440\u044B \u0441\u043C\u0435\u043D\u044F\u044E\u0442\u0441\u044F \u043F\u043E \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u044B\u043C \u0444\u0440\u0430\u0437\u0430\u043C \u0438 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F\u043C, \u0430 \u043D\u0435 \u043F\u043E \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u043C\u0443 \u0447\u0438\u0441\u043B\u0443 \u0441\u043B\u043E\u0432 \u0438 \u043D\u0435 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u043A\u0430\u0436\u0434\u044B\u0435 \u0434\u0432\u0430 \u0441\u043B\u043E\u0432\u0430. \u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u043E\u0439 \u0447\u0430\u0441\u0442\u0438 \u0440\u0435\u0447\u0438 \u0432\u044B\u0431\u0435\u0440\u0438 \u043E\u0434\u0438\u043D \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0442\u0435\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u0441\u0442\u0438\u043A\u0435\u0440 \u0438 \u043F\u0440\u0438 \u043D\u0435\u043E\u0431\u0445\u043E\u0434\u0438\u043C\u043E\u0441\u0442\u0438 \u043E\u0434\u0438\u043D \u043E\u0442\u043B\u0438\u0447\u0430\u044E\u0449\u0438\u0439\u0441\u044F companion/action-\u0432\u0438\u0437\u0443\u0430\u043B. \u0410\u043D\u0438\u043C\u0438\u0440\u0443\u0439 \u0441\u0430\u043C \u043E\u0431\u044A\u0435\u043A\u0442; \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0439 \u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0438\u043B\u0438 \u0431\u043E\u043B\u044C\u0448\u0438\u0435 \u043F\u0430\u043D\u0435\u043B\u0438. \u0427\u0438\u0441\u043B\u043E\u0432\u043E\u0439 \u0441\u0442\u0438\u043A\u0435\u0440 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0438\u0437\u043D\u0435\u0441\u0451\u043D\u043D\u043E\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0438 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0443\u044E \u0435\u0434\u0438\u043D\u0438\u0446\u0443.",
    ...!cryptoF2 ? [
      "\u041D\u0430\u043A\u043B\u0435\u0439\u043A\u0438 \u043F\u043E\u044F\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0432 \u0435\u0434\u0438\u043D\u043E\u0439 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u043E\u0439 \u043F\u043E\u043B\u043E\u0441\u0435 \u043D\u0430\u0434 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u043D\u044B\u043C\u0438 \u0441\u0443\u0431\u0442\u0438\u0442\u0440\u0430\u043C\u0438: \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0430\u044F \u0432\u0445\u043E\u0434\u0438\u0442 \u0441\u043F\u0440\u0430\u0432\u0430, \u043F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0430\u044F \u0441\u0434\u0432\u0438\u0433\u0430\u0435\u0442\u0441\u044F \u0432\u043B\u0435\u0432\u043E; \u043D\u0430 \u044D\u043A\u0440\u0430\u043D\u0435 \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u0434\u0432\u0435. \u041F\u043E\u0437\u0438\u0446\u0438\u044E \u043F\u043E\u043B\u043E\u0441\u044B \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0442 \u0440\u0435\u043D\u0434\u0435\u0440\u0435\u0440 \u2014 \u043D\u0435 \u0440\u0430\u0441\u0441\u0442\u0430\u0432\u043B\u044F\u0439 \u0441\u0442\u0438\u043A\u0435\u0440\u044B \u043F\u043E \u0443\u0433\u043B\u0430\u043C \u0438 \u043D\u0435 \u0441\u043E\u0437\u0434\u0430\u0432\u0430\u0439 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u043F\u043B\u0430\u0432\u0430\u044E\u0449\u0438\u0435 \u0441\u043B\u043E\u0432\u0430. \u0414\u043B\u044F \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0433\u043E \u043F\u043E\u043B\u044F position \u0443\u043A\u0430\u0436\u0438 upper_left \u0443 \u043F\u0435\u0440\u0432\u043E\u0433\u043E micro_beat \u0438 upper_right \u0443 \u0432\u0442\u043E\u0440\u043E\u0433\u043E."
    ] : [],
    "\u041A\u0430\u0436\u0434\u044B\u0439 \u043C\u043E\u043C\u0435\u043D\u0442 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442 \u043D\u043E\u0432\u044B\u0439 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0441\u043C\u044B\u0441\u043B \u0438\u0437 voice_excerpt, \u0430 \u043D\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u043E\u0432\u0443\u044E \u043F\u043E\u0434\u043F\u0438\u0441\u044C, \u0446\u0432\u0435\u0442 \u0438\u043B\u0438 fade. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u0441\u043E\u0441\u0435\u0434\u043D\u044E\u044E \u043A\u043E\u043C\u0431\u0438\u043D\u0430\u0446\u0438\u044E \u043E\u0431\u044A\u0435\u043A\u0442\u0430 \u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u0438: \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u043D\u043E\u0432\u0443\u044E \u0441\u0442\u043E\u0440\u043E\u043D\u0443 \u043C\u0435\u0445\u0430\u043D\u0438\u043A\u0438, \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435, \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430, \u043F\u043E\u0442\u043E\u043A \u0438\u043B\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442. \u0415\u0441\u043B\u0438 visual_kind \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0442\u0435\u043C \u0436\u0435, \u0438\u0437\u043C\u0435\u043D\u0438 \u0432\u0438\u0434\u0438\u043C\u043E\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u0435/\u043E\u0442\u043D\u043E\u0448\u0435\u043D\u0438\u0435 \u0438 detail, value, source_label \u0438\u043B\u0438 target_label.",
    "\u0412 premium_creator \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u044B\u0435 \u0432\u0441\u0442\u0430\u0432\u043A\u0438 \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u0440\u0443\u043F\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043D\u044B\u0435 \u0441\u0442\u0438\u043A\u0435\u0440\u044B/emoji-\u043E\u0431\u0440\u0430\u0437\u044B \u0432 \u043E\u0434\u043D\u043E\u0439 \u043F\u043E\u043B\u043E\u0441\u0435 \u043D\u0430\u0434 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u043D\u044B\u043C\u0438 \u0441\u0443\u0431\u0442\u0438\u0442\u0440\u0430\u043C\u0438. \u041D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0441\u0432\u0435\u0447\u0438, \u043E\u0441\u0438, \u043F\u0430\u043D\u0435\u043B\u0438, \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0438\u043B\u0438 \u043C\u0438\u043D\u0438-\u0438\u043D\u0444\u043E\u0433\u0440\u0430\u0444\u0438\u043A\u0443. \u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0430 \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u043C\u043F\u0430\u043A\u0442\u043D\u0430\u044F \u0430\u043D\u0438\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u0430\u044F \u043B\u0438\u043D\u0438\u044F \u0446\u0435\u043D\u044B \u043A\u0430\u043A \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0441\u0442\u0438\u043A\u0435\u0440, \u043A\u043E\u0433\u0434\u0430 \u0440\u0435\u0447\u044C \u043F\u0440\u044F\u043C\u043E \u043E\u0431\u0441\u0443\u0436\u0434\u0430\u0435\u0442 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0438\u043B\u0438 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u0446\u0435\u043D\u044B. \u041F\u043E\u0434\u0431\u0438\u0440\u0430\u0439 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043E\u0431\u044A\u0435\u043A\u0442 \u0438 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u043F\u043E \u043F\u0440\u043E\u0438\u0437\u043D\u0435\u0441\u0451\u043D\u043D\u043E\u0439 \u0444\u0440\u0430\u0437\u0435; \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0439 \u0432\u0438\u0437\u0443\u0430\u043B, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u0440\u0435\u0447\u0438\u0442 \u0443\u0441\u043B\u043E\u0432\u0438\u044E \u0438\u043B\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0443.",
    `\u041E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0432\u0438\u0437\u0443\u0430\u043B\u043E\u0432 \u0434\u043B\u044F \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u0439 \u0442\u0435\u043C\u044B: ${visualGuideForTopic(topic2, concept, category)}`,
    "\u041D\u0430 \u0432\u0441\u0451\u043C \u0440\u043E\u043B\u0438\u043A\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0439 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043D\u0443\u044E \u043F\u043E\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u044D\u0442\u043E\u0439 \u0442\u0435\u043C\u044B \u0438 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0442\u043D\u043E\u0441\u044F\u0449\u0438\u0435\u0441\u044F \u043A \u043D\u0435\u0439 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u044B; \u043D\u0435 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438 \u043A\u0443\u043F\u043E\u043D\u044B \u0438 \u043F\u043E\u0433\u0430\u0448\u0435\u043D\u0438\u0435 \u043E\u0431\u043B\u0438\u0433\u0430\u0446\u0438\u0439 \u0432 \u0432\u0438\u0437\u0443\u0430\u043B \u0430\u043A\u0446\u0438\u0439 \u0438\u043B\u0438 \u0434\u0438\u0432\u0438\u0434\u0435\u043D\u0434\u043E\u0432. \u0415\u0441\u043B\u0438 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0433\u043E \u0444\u0430\u043A\u0442\u0430 \u043D\u0435\u0442 \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u043C \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u0435 \u0440\u0435\u0447\u0438, \u043D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0441\u0443\u043C\u043C\u0443, \u0441\u0442\u0430\u0432\u043A\u0443, \u0434\u0430\u0442\u0443, \u0432\u0435\u0441 \u0430\u043A\u0442\u0438\u0432\u0430 \u0438\u043B\u0438 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430.",
    "\u0414\u043B\u044F money_flow, distribution \u0438 reinvestment \u0437\u0430\u043F\u043E\u043B\u043D\u044F\u0439 source_label \u0438 target_label \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430\u043C\u0438 \u0438\u043C\u0435\u043D\u043D\u043E \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0444\u0440\u0430\u0437\u044B voice_excerpt. \u041D\u0435 \u043F\u0435\u0440\u0435\u043D\u043E\u0441\u0438 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u043E\u0432 \u0438\u0437 \u0441\u043E\u0441\u0435\u0434\u043D\u0438\u0445 \u0444\u0440\u0430\u0437 \u0438 \u043D\u0435 \u043F\u0440\u0438\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0438\u0445; \u0435\u0441\u043B\u0438 \u0441\u0442\u043E\u0440\u043E\u043D\u0443 \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043F\u043E \u044D\u0442\u043E\u0439 \u0444\u0440\u0430\u0437\u0435, \u043E\u0441\u0442\u0430\u0432\u044C \u043F\u043E\u043B\u0435 \u043F\u0443\u0441\u0442\u044B\u043C.",
    `\u0414\u043B\u044F visual_kind \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u044D\u0442\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F: ${permittedKinds.join(", ")}.`,
    "label \u0438 detail \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u043C\u0438. value \u043C\u043E\u0436\u043D\u043E \u0437\u0430\u043F\u043E\u043B\u043D\u044F\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0446\u0438\u0444\u0440\u043E\u0439 \u0438\u043B\u0438 \u043A\u043E\u0440\u043E\u0442\u043A\u0438\u043C \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435\u043C, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0431\u0443\u043A\u0432\u0430\u043B\u044C\u043D\u043E \u043F\u0440\u0438\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0432 screen_text; \u043D\u0435 \u0432\u044B\u0434\u0443\u043C\u044B\u0432\u0430\u0439 \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C, \u0446\u0435\u043D\u0443, \u0442\u0438\u043A\u0435\u0440 \u0438\u043B\u0438 \u0447\u0438\u0441\u043B\u043E.",
    ...!cryptoF2 ? [
      "\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u0432\u044B\u0431\u0435\u0440\u0438 position: top_left, top_center, top_right, center_left, center, center_right \u0438\u043B\u0438 hero. \u041D\u0435 \u0437\u0430\u043D\u0438\u043C\u0430\u0439 \u043D\u0438\u0436\u043D\u044E\u044E \u0437\u043E\u043D\u0443 \u0442\u0438\u0442\u0440\u043E\u0432 \u0438 \u043B\u0438\u0446\u043E \u0432\u0435\u0434\u0443\u0449\u0435\u0433\u043E. \u0412 premium_creator \u043F\u043E\u0437\u0438\u0446\u0438\u044F \u0437\u0430\u0434\u0430\u0451\u0442 \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u043E\u0439 \u0444\u043E\u043A\u0443\u0441, \u043D\u043E \u043D\u0435 \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u0443\u044E \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443: \u0440\u0435\u043D\u0434\u0435\u0440\u0435\u0440 \u0441\u0430\u043C \u0440\u0430\u0437\u043C\u0435\u0449\u0430\u0435\u0442 \u0441\u0442\u0438\u043A\u0435\u0440\u043D\u0443\u044E \u043F\u043E\u043B\u043E\u0441\u0443.",
      "\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u0432\u044B\u0431\u0435\u0440\u0438 presentation_style \u0438\u0437 card, sticker, image_sticker, cutout_object, document, infographic, notification, icon_bubble, highlighted_word, number_counter. \u0412 premium_creator \u043F\u0440\u0435\u0434\u043F\u043E\u0447\u0438\u0442\u0430\u0439 sticker, image_sticker \u0438\u043B\u0438 cutout_object; \u0447\u0438\u0441\u043B\u043E\u0432\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0432\u043D\u0443\u0442\u0440\u0438 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0435\u0433\u043E \u0441\u0442\u0438\u043A\u0435\u0440\u0430, \u043D\u0435 \u043A\u0430\u043A \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0441\u0447\u0451\u0442\u0447\u0438\u043A. \u041D\u0435 \u043F\u043B\u0430\u043D\u0438\u0440\u0443\u0439 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u043E\u043D\u043D\u044B\u0435 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u0438 \u043F\u0430\u043D\u0435\u043B\u0438.",
      "\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u0432\u044B\u0431\u0435\u0440\u0438 enter_animation \u0438\u0437 card_pop, sticker_pop, bounce, slide_left, slide_right, slide_top, slide_bottom, scale_pop, elastic_pop, rotate_scale, flip, swipe, spring, floating, notification, overshoot. \u041D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u0442\u0438\u043F \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u0438 \u043F\u043E\u0434\u0440\u044F\u0434. Motion blur \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430 \u0431\u044B\u0441\u0442\u0440\u043E\u043C \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0435 \u0438 \u043D\u0435 \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043C\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0442\u0438\u0442\u0440.",
      "\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u043C\u043E\u043C\u0435\u043D\u0442\u0430 \u0432\u044B\u0431\u0435\u0440\u0438 exit_animation \u0438\u0437 slide_left, slide_right, slide_top, slide_bottom, shrink, fade, hold. \u0423\u043A\u0430\u0436\u0438, \u043A\u0430\u043A \u044D\u043B\u0435\u043C\u0435\u043D\u0442 \u043F\u043E\u043A\u0438\u0434\u0430\u0435\u0442 \u043A\u0430\u0434\u0440.",
      `\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0433\u043E visual moment \u0432\u044B\u0431\u0435\u0440\u0438 presenter_pose \u0438\u0437 ${FINANCIAL_PRESENTER_POSES.join(", ")} \u043F\u043E \u0441\u043C\u044B\u0441\u043B\u0443 \u0441\u0446\u0435\u043D\u044B. \u041C\u0435\u043D\u044F\u0439 \u043F\u043E\u0437\u0443 \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u0438 \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u043E\u043C \u043F\u0435\u0440\u0435\u0445\u043E\u0434\u0435; \u0441\u043E\u0441\u0435\u0434\u043D\u0438\u0435 \u0441\u0446\u0435\u043D\u044B \u0434\u043E\u043B\u0436\u043D\u044B \u0438\u043C\u0435\u0442\u044C \u0440\u0430\u0437\u043D\u044B\u0435 pose cue. \u041A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u0442\u0435\u0441\u0442 \u043D\u0430 30\u201340 \u0441\u0435\u043A\u0443\u043D\u0434 \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C 4\u20136 \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u0445 \u0441\u043C\u0435\u043D \u043F\u043E\u0437\u044B.`,
      "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439 camera_action locked \u043F\u043E\u0447\u0442\u0438 \u0432\u043E \u0432\u0441\u0435\u0445 \u0441\u0446\u0435\u043D\u0430\u0445; \u043D\u0435 \u0431\u043E\u043B\u0435\u0435 \u043E\u0434\u043D\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u0438\u0437 \u0447\u0435\u0442\u044B\u0440\u0451\u0445 \u043C\u043E\u0436\u0435\u0442 \u0438\u043C\u0435\u0442\u044C \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u043A\u0430\u043C\u0435\u0440\u044B. \u041D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 zoom \u0438\u043B\u0438 pan \u043A\u0430\u043A \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A \u043E\u0441\u043D\u043E\u0432\u043D\u043E\u0439 \u0434\u0438\u043D\u0430\u043C\u0438\u043A\u0438: \u0435\u0451 \u0441\u043E\u0437\u0434\u0430\u044E\u0442 \u0430\u043D\u0438\u043C\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043D\u044B\u0435 \u0441\u0442\u0438\u043A\u0435\u0440\u044B \u0438 \u0441\u043C\u0435\u043D\u044B \u043F\u043E\u0437\u044B.",
      "\u0421\u043E\u0445\u0440\u0430\u043D\u044F\u0439 \u0442\u0440\u0438 \u0440\u0430\u0437\u0434\u0435\u043B\u044C\u043D\u044B\u0435 \u0437\u043E\u043D\u044B: \u0442\u0435\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0435 \u0432\u0441\u0442\u0430\u0432\u043A\u0438 \u0441\u0432\u0435\u0440\u0445\u0443, \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u0435 \u043A\u043B\u044E\u0447\u0435\u0432\u043E\u0435 \u0441\u043B\u043E\u0432\u043E/\u0444\u0440\u0430\u0437\u0430 \u043C\u0435\u0436\u0434\u0443 \u0432\u0441\u0442\u0430\u0432\u043A\u0430\u043C\u0438 \u0438 \u0432\u0435\u0434\u0443\u0449\u0438\u043C, \u0432\u0435\u0434\u0443\u0449\u0438\u0439 \u0432\u043D\u0438\u0437\u0443. \u041D\u0435 \u043F\u0440\u0435\u0432\u0440\u0430\u0449\u0430\u0439 \u0440\u043E\u043B\u0438\u043A \u0432 \u043E\u0434\u0438\u043D \u0431\u043E\u043B\u044C\u0448\u043E\u0439 \u0438\u043D\u0444\u043E\u0433\u0440\u0430\u0444\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043A\u0430\u0434\u0440; \u043C\u0435\u043D\u044F\u0439 \u0432\u0435\u0440\u0445\u043D\u0438\u0439 \u043E\u0431\u044A\u0435\u043A\u0442 \u043F\u043E \u043C\u0435\u0440\u0435 \u0441\u043C\u0435\u043D\u044B \u0444\u0440\u0430\u0433\u043C\u0435\u043D\u0442\u0430 \u0440\u0435\u0447\u0438.",
      "\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u0432\u044B\u0431\u0435\u0440\u0438 composition \u0441\u0442\u0440\u043E\u0433\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 center, presenter_left, presenter_right, feature_card, \u0430 presenter_layout \u0441\u0442\u0440\u043E\u0433\u043E \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 center, left, right, large. \u041D\u0435 \u043F\u043E\u043C\u0435\u0449\u0430\u0439 \u0432 composition \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430 \u2014 \u043E\u0431\u044A\u0435\u043A\u0442\u044B \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 moments[].visual_kind. \u0412\u0435\u0434\u0443\u0449\u0438\u0439 \u043E\u0441\u0442\u0430\u0451\u0442\u0441\u044F \u0441\u043D\u0438\u0437\u0443; \u043E\u0431\u044B\u0447\u043D\u043E \u043E\u043D \u043F\u043E \u0446\u0435\u043D\u0442\u0440\u0443, \u0431\u043E\u043A\u043E\u0432\u044B\u0435 \u0432\u0430\u0440\u0438\u0430\u043D\u0442\u044B \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u0432 \u0434\u0432\u0443\u0445 \u0441\u0446\u0435\u043D\u0430\u0445 \u0438 \u043D\u0435 \u0432 \u043F\u0435\u0440\u0432\u043E\u0439 \u0438\u043B\u0438 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0439. \u0414\u043B\u044F \u0431\u043E\u043A\u043E\u0432\u043E\u0433\u043E \u0432\u0435\u0434\u0443\u0449\u0435\u0433\u043E \u0440\u0430\u0437\u043C\u0435\u0449\u0430\u0439 \u0433\u043B\u0430\u0432\u043D\u044B\u0439 \u0432\u0438\u0437\u0443\u0430\u043B \u0441 \u043F\u0440\u043E\u0442\u0438\u0432\u043E\u043F\u043E\u043B\u043E\u0436\u043D\u043E\u0439 \u0441\u0442\u043E\u0440\u043E\u043D\u044B.",
      `\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u0432\u044B\u0431\u0435\u0440\u0438 camera_action \u0438\u0437 ${CAMERA_ACTIONS.join(", ")} \u0438\u0441\u0445\u043E\u0434\u044F \u0438\u0437 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F \u0441\u043C\u044B\u0441\u043B\u043E\u0432\u043E\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430; \u043D\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0439 \u043A\u0430\u043C\u0435\u0440\u0443 \u043F\u043E \u043D\u043E\u043C\u0435\u0440\u0443 \u0441\u0446\u0435\u043D\u044B \u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u0441\u043E\u0441\u0435\u0434\u043D\u0435\u0435 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435 \u0431\u0435\u0437 \u043F\u0440\u0438\u0447\u0438\u043D\u044B.`,
      `\u0414\u043B\u044F \u043A\u0430\u0436\u0434\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u0432\u044B\u0431\u0435\u0440\u0438 transition_in \u0438\u0437 ${SCENE_TRANSITIONS.join(", ")} \u0438\u0441\u0445\u043E\u0434\u044F \u0438\u0437 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u043E\u0439 \u043D\u0435\u043F\u0440\u0435\u0440\u044B\u0432\u043D\u043E\u0441\u0442\u0438; \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0446\u0438\u043A\u043B\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u043E\u0440\u044F\u0434\u043E\u043A \u0438 \u043D\u0435 \u043F\u043E\u0432\u0442\u043E\u0440\u044F\u0439 \u0441\u043E\u0441\u0435\u0434\u043D\u0438\u0439 \u043F\u0435\u0440\u0435\u0445\u043E\u0434 \u0431\u0435\u0437 \u043F\u0440\u0438\u0447\u0438\u043D\u044B. \u0414\u043B\u044F \u043F\u0435\u0440\u0432\u043E\u0439 \u0441\u0446\u0435\u043D\u044B \u043E\u0431\u044B\u0447\u043D\u043E \u0432\u044B\u0431\u0438\u0440\u0430\u0439 cut.`,
      `\u041F\u0440\u0438 ${MIN_SCENES2} \u0438 \u0431\u043E\u043B\u0435\u0435 \u0441\u0446\u0435\u043D\u0430\u0445 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u0430 \u0441\u0440\u0435\u0434\u043D\u044F\u044F \u0441\u0446\u0435\u043D\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u043E\u0442\u043B\u0438\u0447\u0430\u0442\u044C\u0441\u044F \u043E\u0442 center: presenter_left, presenter_right \u0438\u043B\u0438 feature_card. \u0412\u044B\u0431\u0435\u0440\u0438 \u0435\u0451 \u043F\u043E \u0441\u043C\u044B\u0441\u043B\u0443, \u043D\u0435 \u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u0444\u0438\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u043F\u043E\u0440\u044F\u0434\u043E\u043A.`,
      "\u041D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u043E\u0434\u0438\u043D\u0430\u043A\u043E\u0432\u0443\u044E \u043A\u043E\u043C\u043F\u043E\u043D\u043E\u0432\u043A\u0443 \u043A\u0430\u0440\u0442\u043E\u0447\u0435\u043A \u0438\u043B\u0438 \u0432\u0438\u0437\u0443\u0430\u043B\u044C\u043D\u044B\u0439 \u0440\u0438\u0442\u043C \u0432\u043E \u0432\u0441\u0435\u0445 \u0440\u043E\u043B\u0438\u043A\u0430\u0445. presentation_style \u2014 \u043E\u0434\u0438\u043D \u0438\u0437 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442\u043E\u0432, \u0430 \u043D\u0435 \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u044B\u0439 \u043A\u0430\u0440\u043A\u0430\u0441."
    ] : [],
    `\u0421\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 JSON \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442 \u0440\u043E\u0432\u043D\u043E ${scriptScenes.length} \u0432\u0445\u043E\u0434\u043D\u044B\u0445 \u0441\u0446\u0435\u043D \u0438 \u0442\u043E\u0447\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E moments \u0432 \u043A\u0430\u0436\u0434\u043E\u0439. \u0421\u043E\u0445\u0440\u0430\u043D\u0438 \u044D\u0442\u0438 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0430, \u0437\u0430\u043C\u0435\u043D\u0438 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u0440\u0435\u0430\u043B\u044C\u043D\u044B\u043C\u0438 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F\u043C\u0438, \u0430 voice_excerpt \u0438 cue_excerpt \u0441\u043A\u043E\u043F\u0438\u0440\u0443\u0439 \u0438\u0437 \u0442\u0435\u043A\u0441\u0442\u0430 \u0441\u0446\u0435\u043D\u044B. \u042D\u0442\u043E \u043D\u0435 \u0434\u0438\u0437\u0430\u0439\u043D-\u0448\u0430\u0431\u043B\u043E\u043D.`,
    "\u0412\u0435\u0440\u043D\u0438 \u0442\u043E\u043B\u044C\u043A\u043E JSON \u0431\u0435\u0437 markdown:",
    JSON.stringify(visualPlanSchema)
  ].join("\n");
  const user = JSON.stringify({
    topic: topic2,
    concept,
    category,
    visual_theme: visualTheme ?? null,
    target_duration_seconds: targetDurationSeconds ?? null,
    expected_scene_count: scriptScenes.length,
    conceptVisualGuide: visualGuideForTopic(topic2, concept, category),
    brandStyle: cryptoF2 ? { label: "\u041A\u0440\u0438\u043F\u0442\u043E \u04242", palette: ["deep charcoal", "mint", "warm light"], presenter: false } : FINANCE_BRAND_PROFILE,
    allowedVisualKinds: permittedKinds,
    ...cryptoF2 ? { recent_motion_fingerprints: recentMotionFingerprints.slice(0, 12) } : {},
    scenes: scriptScenes.map((scene, index) => ({
      scene_number: index + 1,
      target_moment_count: targetVisualMomentCount(textValue(scene.voice_text)),
      duration_seconds: Math.max(
        1,
        wordsIn(textValue(scene.voice_text)).length / ESTIMATED_SPEECH_WORDS_PER_SECOND
      ),
      voice_text: textValue(scene.voice_text),
      screen_text: textValue(scene.screen_text),
      visual_hint: textValue(scene.visual_hint),
      visual_action: textValue(scene.visual_action),
      objects: stringArray(scene.objects)
    }))
  });
  let previousResponse;
  let previousError = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const repairContext = attempt === 0 ? { system, user } : {
      system: `${system}
\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0439 \u043E\u0442\u0432\u0435\u0442 \u043D\u0435 \u043F\u0440\u043E\u0448\u0451\u043B \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443: ${previousError}. \u0418\u0441\u043F\u0440\u0430\u0432\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0448\u0438\u0431\u043A\u0438 \u0444\u043E\u0440\u043C\u0430\u0442\u0430 \u0438 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438, \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0432 \u0442\u043E\u0447\u043D\u044B\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439.`,
      user: JSON.stringify({ task: user, invalid_plan: previousResponse })
    };
    const response = await requestOpenRouterJson(
      repairContext.system,
      repairContext.user,
      "AI Visual Plan",
      12e3
    );
    try {
      return cryptoF2 ? normalizeCryptoF2VisualPlan(
        topic2,
        response,
        scriptScenes,
        concept,
        category,
        motionSeed,
        recentMotionFingerprints
      ) : normalizeVisualPlan(topic2, response, scriptScenes, concept, targetDurationSeconds);
    } catch (error) {
      previousResponse = response;
      previousError = error instanceof Error ? error.message : "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438";
      if (attempt === 1) {
        console.warn(
          `[financial-visual-director] AI plan remained invalid after repair (${previousError}); rebuilding visuals from exact narration.`
        );
        try {
          const fallback = buildNarrationDrivenVisualPlan(
            topic2,
            concept,
            scriptScenes,
            targetDurationSeconds,
            category,
            visualTheme
          );
          return cryptoF2 ? normalizeCryptoF2VisualPlan(
            topic2,
            fallback,
            scriptScenes,
            concept,
            category,
            motionSeed,
            recentMotionFingerprints
          ) : normalizeVisualPlan(topic2, fallback, scriptScenes, concept, targetDurationSeconds);
        } catch (fallbackError) {
          const fallbackReason = fallbackError instanceof Error ? fallbackError.message : "\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430 narration fallback";
          throw new Error(
            `AI Visual Plan \u0438 narration fallback \u043D\u0435 \u043F\u0440\u043E\u0448\u043B\u0438 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443: ${previousError}; ${fallbackReason}`
          );
        }
      }
    }
  }
  throw new Error("AI Visual Plan: \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u0439 \u043F\u043B\u0430\u043D.");
}
function topicProfile(topic2, category = "finance") {
  const normalized = topic2.toLocaleLowerCase("ru-RU");
  if (category === "crypto" || isCryptoTopic(topic2)) {
    const entityLabel = /bitcoin|биткоин|биткойн|\bbtc\b/iu.test(normalized) ? "BITCOIN" : /ethereum|\beth\b|эфир/iu.test(normalized) ? "ETHEREUM" : "\u041A\u0420\u0418\u041F\u0422\u041E\u0410\u041A\u0422\u0418\u0412";
    return {
      entityLabel,
      metricLabel: /лимит|предлож|эмисс|халвинг|halving|выпуск/iu.test(normalized) ? "\u041F\u0420\u0410\u0412\u0418\u041B\u041E \u0412\u042B\u041F\u0423\u0421\u041A\u0410" : "\u041C\u0415\u0425\u0410\u041D\u0418\u041A\u0410 \u0421\u0415\u0422\u0418",
      maturityLabel: "\u041F\u0420\u0418\u041C\u0415\u041D\u0415\u041D\u0418\u0415 \u0418 \u0420\u0418\u0421\u041A",
      concept: "generic_finance",
      definitionCaption: "\u0430\u043A\u0442\u0438\u0432 \u0438\u043B\u0438 \u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B",
      summaryItems: [["01", "\u0410\u043A\u0442\u0438\u0432 / \u0441\u0435\u0442\u044C"], ["02", "\u041C\u0435\u0445\u0430\u043D\u0438\u043A\u0430"], ["03", "\u041F\u0440\u0438\u043C\u0435\u043D\u0435\u043D\u0438\u0435"], ["04", "\u0420\u0438\u0441\u043A"]],
      objectKinds: ["coin", "wallet", "laptop", "money", "chart_up", "chart_down", "shield", "warning", "calculator"]
    };
  }
  if (/сложн.{0,16}процент|капитализац|реинвест/iu.test(normalized)) {
    return {
      entityLabel: "\u0421\u041B\u041E\u0416\u041D\u042B\u0419 \u041F\u0420\u041E\u0426\u0415\u041D\u0422",
      metricLabel: "\u0420\u041E\u0421\u0422 \u041D\u0410 \u0420\u041E\u0421\u0422",
      maturityLabel: "\u041A\u0410\u041F\u0418\u0422\u0410\u041B \u0417\u0410 \u041F\u0415\u0420\u0418\u041E\u0414",
      concept: "compound_interest",
      definitionCaption: "\u043F\u0440\u043E\u0446\u0435\u043D\u0442\u044B \u043F\u0440\u0438\u0431\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u043A \u043A\u0430\u043F\u0438\u0442\u0430\u043B\u0443",
      summaryItems: [["01", "\u0421\u0442\u0430\u0440\u0442\u043E\u0432\u044B\u0439 \u043A\u0430\u043F\u0438\u0442\u0430\u043B"], ["02", "\u0421\u0442\u0430\u0432\u043A\u0430"], ["03", "\u0420\u0435\u0438\u043D\u0432\u0435\u0441\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435"], ["04", "\u0421\u0440\u043E\u043A \u0438 \u0440\u0438\u0441\u043A"]],
      objectKinds: ["money", "percentage", "calculator", "chart_up", "calendar", "wallet", "warning"]
    };
  }
  if (normalized.includes("\u0434\u0438\u0432\u0438\u0434\u0435\u043D\u0434")) {
    return {
      entityLabel: "\u0414\u0418\u0412\u0418\u0414\u0415\u041D\u0414",
      metricLabel: "\u0412\u042B\u041F\u041B\u0410\u0422\u0410 \u0410\u041A\u0426\u0418\u041E\u041D\u0415\u0420\u0423",
      maturityLabel: "\u0414\u041E\u0425\u041E\u0414 \u041E\u0422 \u0410\u041A\u0426\u0418\u0418",
      concept: "profit_distribution",
      definitionCaption: "\u0432\u044B\u043F\u043B\u0430\u0442\u0430 \u0432\u043B\u0430\u0434\u0435\u043B\u044C\u0446\u0443",
      summaryItems: [["01", "\u041F\u0440\u0438\u0431\u044B\u043B\u044C \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438"], ["02", "\u0420\u0435\u0448\u0435\u043D\u0438\u0435 \u043E \u0432\u044B\u043F\u043B\u0430\u0442\u0435"], ["03", "\u0414\u0430\u0442\u0430 \u0432\u044B\u043F\u043B\u0430\u0442\u044B"], ["04", "\u0420\u0438\u0441\u043A"]],
      objectKinds: ["investor", "company", "stock", "dividend", "percentage", "payment", "chart_up", "warning"]
    };
  }
  if (normalized.includes("\u0430\u043A\u0446\u0438")) {
    return {
      entityLabel: "\u0410\u041A\u0426\u0418\u042F",
      metricLabel: "\u0426\u0415\u041D\u0410 \u041D\u0410 \u0411\u0418\u0420\u0416\u0415",
      maturityLabel: "\u0414\u041E\u041B\u042F \u0412 \u041A\u041E\u041C\u041F\u0410\u041D\u0418\u0418",
      concept: "equity_split",
      definitionCaption: "\u0447\u0430\u0441\u0442\u044C \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438",
      summaryItems: [["01", "\u0411\u0438\u0437\u043D\u0435\u0441"], ["02", "\u0426\u0435\u043D\u0430"], ["03", "\u0414\u0438\u0432\u0438\u0434\u0435\u043D\u0434\u044B"], ["04", "\u0420\u0438\u0441\u043A"]],
      objectKinds: ["investor", "company", "stock", "dividend", "payment", "money", "chart_up", "chart_down", "portfolio", "warning"]
    };
  }
  if (normalized.includes("\u043F\u0430\u0435\u0432") || normalized.includes("\u0431\u043F\u0438\u0444") || normalized.includes("\u0444\u043E\u043D\u0434")) {
    return {
      entityLabel: normalized.includes("\u0431\u043F\u0438\u0444") ? "\u0411\u041F\u0418\u0424" : "\u041F\u0410\u0415\u0412\u041E\u0419 \u0424\u041E\u041D\u0414",
      metricLabel: "\u0421\u0422\u041E\u0418\u041C\u041E\u0421\u0422\u042C \u041F\u0410\u042F",
      maturityLabel: "\u0414\u041E\u041B\u042F \u0412 \u041F\u041E\u0420\u0422\u0424\u0415\u041B\u0415",
      concept: "fund_pool",
      definitionCaption: "\u043E\u0431\u0449\u0438\u0439 \u043F\u043E\u0440\u0442\u0444\u0435\u043B\u044C",
      summaryItems: [["01", "\u0421\u043E\u0441\u0442\u0430\u0432 \u0444\u043E\u043D\u0434\u0430"], ["02", "\u0410\u043A\u0442\u0438\u0432\u044B"], ["03", "\u041A\u043E\u043C\u0438\u0441\u0441\u0438\u044F"], ["04", "\u0420\u0438\u0441\u043A"]],
      objectKinds: ["investor", "broker", "stock", "bond", "gold", "portfolio", "percentage", "chart_up", "warning"]
    };
  }
  if (normalized.includes("\u0444\u044C\u044E\u0447\u0435\u0440\u0441")) {
    return {
      entityLabel: "\u0424\u042C\u042E\u0427\u0415\u0420\u0421",
      metricLabel: "\u0426\u0415\u041D\u0410 \u041A\u041E\u041D\u0422\u0420\u0410\u041A\u0422\u0410",
      maturityLabel: "\u0418\u0421\u041F\u041E\u041B\u041D\u0415\u041D\u0418\u0415 \u0412 \u0411\u0423\u0414\u0423\u0429\u0415\u041C",
      concept: "futures_contract",
      definitionCaption: "\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E \u043D\u0430 \u0431\u0443\u0434\u0443\u0449\u0435\u0435",
      summaryItems: [["01", "\u0410\u043A\u0442\u0438\u0432"], ["02", "\u0421\u0440\u043E\u043A"], ["03", "\u041F\u043B\u0435\u0447\u043E"], ["04", "\u0420\u0438\u0441\u043A"]],
      objectKinds: ["investor", "broker", "stock", "money", "percentage", "calendar", "chart_up", "chart_down", "calculator", "warning"]
    };
  }
  if (normalized.includes("\u043E\u0431\u043B\u0438\u0433\u0430") || normalized.includes("\u043E\u0444\u0437") || normalized.includes("\u043A\u0443\u043F\u043E\u043D")) {
    return {
      entityLabel: normalized.includes("\u043E\u0444\u0437") ? "\u041E\u0424\u0417" : "\u041E\u0411\u041B\u0418\u0413\u0410\u0426\u0418\u042F",
      metricLabel: normalized.includes("\u043E\u0444\u0437") ? "\u041A\u0423\u041F\u041E\u041D \u0413\u041E\u0421\u0423\u0414\u0410\u0420\u0421\u0422\u0412\u0410" : "\u041A\u0423\u041F\u041E\u041D\u041D\u0410\u042F \u0414\u041E\u0425\u041E\u0414\u041D\u041E\u0421\u0422\u042C",
      maturityLabel: "\u0412\u041E\u0417\u0412\u0420\u0410\u0422 \u041D\u041E\u041C\u0418\u041D\u0410\u041B\u0410",
      concept: "bond_flow",
      definitionCaption: "\u0432\u0435\u0440\u043D\u0443\u0442\u044C \u0434\u0435\u043D\u044C\u0433\u0438",
      summaryItems: [["01", "\u0421\u0440\u043E\u043A"], ["02", "\u0414\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C"], ["03", "\u0420\u0435\u0439\u0442\u0438\u043D\u0433"], ["04", "\u0420\u0438\u0441\u043A"]],
      objectKinds: ["investor", "company", "government", "bond", "money", "coupon", "percentage", "calendar", "warning"]
    };
  }
  return {
    entityLabel: topic2.toLocaleUpperCase("ru-RU").slice(0, 24),
    metricLabel: "\u0424\u0418\u041D\u0410\u041D\u0421\u041E\u0412\u042B\u0419 \u041F\u041E\u041A\u0410\u0417\u0410\u0422\u0415\u041B\u042C",
    maturityLabel: "\u0413\u041B\u0410\u0412\u041D\u042B\u0419 \u0412\u042B\u0412\u041E\u0414",
    concept: "generic_finance",
    definitionCaption: "\u043A\u0430\u043A \u044D\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442",
    summaryItems: [["01", "\u041C\u0435\u0445\u0430\u043D\u0438\u043A\u0430"], ["02", "\u0421\u0440\u043E\u043A"], ["03", "\u0414\u043E\u0445\u043E\u0434"], ["04", "\u0420\u0438\u0441\u043A"]],
    objectKinds: ["investor", "money", "document", "percentage", "chart_up", "warning", "calculator"]
  };
}
function inferVisualKind(topic2, scene, index, total, concept) {
  const source = [
    topic2,
    textValue(scene.voice_text),
    textValue(scene.screen_text),
    textValue(scene.visual_hint),
    textValue(scene.visual_action)
  ].join(" ").toLocaleLowerCase("ru-RU");
  if (index === 0) return "hook";
  if (index === total - 1) return "summary";
  if (/итого|вывод|перед покуп|проверь|важно помнить|риск/iu.test(source)) return "risk";
  if (concept === "futures_contract") {
    if (/залог|обеспечен|марж|плеч/iu.test(source)) return "leverage";
    if (/лонг|шорт|результат|payoff|прибыл|убыт/iu.test(source)) return "payoff";
    if (/цен[аы]|бирж|график|рын[окке]/iu.test(source)) return "market";
    if (/срок|дата|исполн|расч[её]т/iu.test(source)) return "calendar";
    if (/контракт|спецификац|обязательств/iu.test(source)) return "contract";
    return "definition";
  }
  if (concept === "compound_interest") {
    if (/риск|инфляц|срок|год|период/iu.test(source)) return /риск|инфляц/iu.test(source) ? "risk" : "calendar";
    if (/капитал|реинвест|сложн|процент|рост|сумм/iu.test(source)) return "compound_growth";
    if (/сравн|прост(ой|ые) процент/iu.test(source)) return "comparison";
    return "definition";
  }
  if (concept === "equity_split") {
    if (/доля|владел|совлад|акционер|голос/iu.test(source)) return "ownership";
    if (/цен[аы]|бирж|график|раст[её]т|пада|рын[окке]/iu.test(source)) return "market";
    if (/дивиденд|выплат|прибыл/iu.test(source)) return "coupon";
    return "definition";
  }
  if (concept === "fund_pool") {
    if (/график|стоим|индекс|рын[окке]/iu.test(source)) return "market";
    if (/комисс|состав|актив|портфел|фонд|па[йя]|золот|облигац|акци/iu.test(source)) return "fund";
    if (/риск|сниж|паден/iu.test(source)) return "risk";
    return "definition";
  }
  if (concept === "profit_distribution") {
    if (/дата|срок|период|календар/iu.test(source)) return "calendar";
    if (/прибыл|распредел|выплат|акционер|дивиденд/iu.test(source)) return "distribution";
    if (/график|цена|рын[окке]/iu.test(source)) return "market";
    return "coupon";
  }
  if (concept === "bond_flow") {
    if (/срок|погаш|возврат номинал/iu.test(source)) return "maturity";
    if (/купон|процент|выплат|доходност/iu.test(source)) return "coupon";
    if (/дата|месяц|год|период|календар/iu.test(source)) return "calendar";
    if (/цен[аы]|бирж|график|рын[окке]/iu.test(source)) return "market";
    if (/деньг|переда|инвестор|влож|капитал/iu.test(source)) return "flow";
    return "definition";
  }
  if (/дивиденд|купон|процент|выплат|доход/iu.test(source)) return "coupon";
  if (/цен[аы]|бирж|раст[её]т|пада|график|волатил|рын[окке]/iu.test(source)) return "market";
  if (/срок|дата|месяц|год|период|календар/iu.test(source)) return "calendar";
  if (/покуп|инвест|деньг|переда|влож|капитал|сч[её]т/iu.test(source)) return "flow";
  return index % 2 === 0 ? "definition" : "flow";
}
function fallbackTitle(topic2, scene, profile, index) {
  const screen = textValue(scene.screen_text);
  if (screen) return screen.toLocaleUpperCase("ru-RU").slice(0, 64);
  if (index === 0) return `\u0427\u0422\u041E \u0422\u0410\u041A\u041E\u0415 ${profile.entityLabel}?`;
  if (index === 1) return `${profile.entityLabel}: \u0413\u041B\u0410\u0412\u041D\u0410\u042F \u0418\u0414\u0415\u042F`;
  if (index >= 5) return "\u041F\u0420\u041E\u0412\u0415\u0420\u042C \u0420\u0418\u0421\u041A";
  return topic2.toLocaleUpperCase("ru-RU").slice(0, 64);
}
function fallbackSubtitle(scene, kind, profile) {
  const screen = textValue(scene.screen_text);
  if (screen && screen.length <= 110) return screen;
  const voice = textValue(scene.voice_text);
  if (voice) return voice.length <= 120 ? voice : `${voice.slice(0, 117).trim()}\u2026`;
  if (kind === "coupon") return profile.metricLabel;
  if (kind === "market") return "\u0426\u0435\u043D\u0430 \u0438 \u0440\u0438\u0441\u043A \u043C\u043E\u0433\u0443\u0442 \u043C\u0435\u043D\u044F\u0442\u044C\u0441\u044F.";
  return `\u0420\u0430\u0437\u0431\u0438\u0440\u0430\u0435\u043C \u0442\u0435\u043C\u0443: ${profile.entityLabel.toLocaleLowerCase("ru-RU")}.`;
}
function backgroundForTopic(topic2) {
  const hash = [...topic2].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return FINANCE_BACKGROUND_LIBRARY[hash % FINANCE_BACKGROUND_LIBRARY.length].id;
}
function backgroundForScene(topic2, scene, index) {
  const sceneCue = [
    textValue(scene.voice_text),
    textValue(scene.visual_hint),
    textValue(scene.visual_action)
  ].join(":");
  const seed = `${topic2}:${sceneCue}:${index}`;
  return FINANCE_BACKGROUND_LIBRARY[stableChoiceIndex(seed, FINANCE_BACKGROUND_LIBRARY.length)].id;
}
function chartKindForScene(scene, visual, index, concept) {
  const requested = textValue(scene.chart_type);
  if (CHART_TYPES_BY_CONCEPT[concept].includes(requested)) return requested;
  if (visual === "compound_growth" || concept === "compound_interest") return "area";
  if (visual === "ownership" || visual === "fund") return visual === "fund" ? "portfolio" : "donut";
  if (visual === "distribution") return concept === "profit_distribution" ? "waterfall" : "bar";
  if (visual === "market") {
    if (concept === "bond_flow") return index % 2 ? "line" : "candlestick";
    if (concept === "fund_pool") return "area";
    return index % 2 ? "candlestick" : "line";
  }
  return index % 2 ? "sparkline" : "line";
}
function collectObjects(profile, beats) {
  const inferred = new Set(profile.objectKinds);
  beats.forEach((beat) => {
    if (beat.visual === "market") inferred.add("chart_up");
    if (beat.visual === "coupon") inferred.add("percentage");
    if (beat.visual === "calendar") inferred.add("calendar");
    if (beat.visual === "summary") inferred.add("warning");
    if (beat.visual === "risk") inferred.add("warning");
    if (beat.visual === "compound_growth") {
      inferred.add("chart_up");
      inferred.add("percentage");
      inferred.add("calculator");
      inferred.add("calendar");
    }
    if (beat.visual === "comparison") {
      inferred.add("chart_up");
      inferred.add("chart_down");
    }
    if (beat.visual === "flow") inferred.add("money_flow");
    for (const kind of beat.objectKinds ?? []) {
      if (FINANCE_OBJECT_LIBRARY.some((definition) => definition.kind === kind)) {
        inferred.add(kind);
      }
    }
    for (const moment of beat.visualMoments ?? []) {
      if (moment.kind === "compound_growth" || moment.kind === "market_chart") inferred.add("chart_up");
      if (moment.kind === "money_flow" || moment.kind === "reinvestment") inferred.add("money_flow");
      if (moment.kind === "risk") inferred.add("warning");
      if (moment.kind === "document") inferred.add("document");
      if (moment.kind === "portfolio") inferred.add("portfolio");
    }
  });
  return FINANCE_OBJECT_LIBRARY.map((definition) => definition.kind).filter((kind) => inferred.has(kind));
}
async function createFinancialTopicPlan(topicInput, ctaInput = "", options = {}) {
  const topic2 = topicInput.trim().replace(/\s+/g, " ").slice(0, MAX_FINANCIAL_TOPIC_LENGTH);
  if (!topic2) throw new Error("\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0442\u0435\u043C\u0443 \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u0440\u043E\u043B\u0438\u043A\u0430.");
  const cta = normalizeFinancialCta(ctaInput);
  const category = options.category ?? "finance";
  const targetDurationSeconds = options.targetDurationSeconds;
  const customScript = options.customScript?.trim();
  if (customScript && category !== "crypto") {
    throw new Error("\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u0438\u0439 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u041A\u0440\u0438\u043F\u0442\u043E\xBB.");
  }
  if (targetDurationSeconds !== void 0 && (!Number.isFinite(targetDurationSeconds) || targetDurationSeconds < 30 || targetDurationSeconds > 40)) {
    throw new Error("\u0426\u0435\u043B\u0435\u0432\u0430\u044F \u0434\u043B\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u044C \u0442\u0435\u0441\u0442\u043E\u0432\u043E\u0433\u043E \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u0440\u043E\u043B\u0438\u043A\u0430 \u0434\u043E\u043B\u0436\u043D\u0430 \u0431\u044B\u0442\u044C \u043E\u0442 30 \u0434\u043E 40 \u0441\u0435\u043A\u0443\u043D\u0434.");
  }
  const profile = topicProfile(topic2, category);
  const customScenes = customScript ? splitVerbatimCryptoScript(customScript).map((voiceText, index) => ({
    scene_number: index + 1,
    duration_seconds: Math.max(
      1,
      wordsIn(voiceText).length / ESTIMATED_SPEECH_WORDS_PER_SECOND
    ),
    voice_text: voiceText,
    screen_text: voiceText.slice(0, 45),
    visual_hint: "\u0421\u043E\u0437\u0434\u0430\u0439 \u043A\u0440\u0438\u043F\u0442\u043E-\u0432\u0438\u0437\u0443\u0430\u043B \u043F\u043E \u0442\u043E\u0447\u043D\u043E\u043C\u0443 \u0441\u043C\u044B\u0441\u043B\u0443 \u044D\u0442\u043E\u0439 \u0440\u0435\u043F\u043B\u0438\u043A\u0438.",
    visual_action: "\u041F\u043E\u043A\u0430\u0436\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C, \u043E\u043F\u0438\u0441\u0430\u043D\u043D\u044B\u0439 \u0432 \u043E\u0437\u0432\u0443\u0447\u043A\u0435.",
    objects: [],
    text_animation: "reveal",
    sound_effect: "none"
  })) : void 0;
  const ai = customScript ? {
    title: topic2,
    hook: customScenes?.[0]?.voice_text || topic2,
    description: `\u041E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0440\u043E\u043B\u0438\u043A \u043E \u0442\u0435\u043C\u0435 \xAB${topic2}\xBB.`,
    duration_seconds: wordsIn(customScript).length / ESTIMATED_SPEECH_WORDS_PER_SECOND,
    visual_concept: "generic_finance",
    scenes: customScenes,
    ending: "",
    cta: ""
  } : await requestFinancialScript(topic2, profile.concept, targetDurationSeconds, cta, category);
  const rawScenes = Array.isArray(ai.scenes) ? ai.scenes : [];
  const concept = textValue(ai.visual_concept) || profile.concept;
  const aiConcept = [
    "bond_flow",
    "equity_split",
    "fund_pool",
    "profit_distribution",
    "compound_interest",
    "futures_contract",
    "generic_finance"
  ].includes(concept) ? concept : profile.concept;
  const selectedConcept = category === "crypto" ? "generic_finance" : profile.concept === "generic_finance" ? aiConcept : profile.concept;
  const aiScenes = rawScenes.filter((scene) => Boolean(scene && typeof scene === "object")).slice(0, MAX_SCENES2);
  const requiredSceneCount = MIN_SCENES2;
  if (aiScenes.length < requiredSceneCount) {
    throw new Error(`AI-\u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0432\u0435\u0440\u043D\u0443\u043B ${aiScenes.length} \u0441\u0446\u0435\u043D; \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u043D\u0435 \u043C\u0435\u043D\u0435\u0435 ${requiredSceneCount}.`);
  }
  const scenes = aiScenes;
  const ending = textValue(ai.ending);
  const finalVoice = [textValue(scenes.at(-1)?.voice_text), ending, cta].filter(Boolean).join("\n\n").trim();
  const extraVoiceSeconds = Math.min(12, wordsIn([ending, cta].filter(Boolean).join(" ")).length / 2.4);
  const plannedScenes = scenes.map((scene, index) => index === scenes.length - 1 ? {
    ...scene,
    voice_text: finalVoice,
    duration_seconds: numberValue2(scene.duration_seconds, 8) + extraVoiceSeconds
  } : scene);
  const totalSceneSeconds = plannedScenes.reduce((sum, scene, index) => sum + Math.max(4, numberValue2(scene.duration_seconds, index === 0 ? 8 : 9)), 0);
  const requestedDuration = targetDurationSeconds ?? Math.max(
    MIN_DURATION_SECONDS,
    Math.min(MAX_DURATION_SECONDS, numberValue2(ai.duration_seconds, totalSceneSeconds))
  );
  const visualPlans = await requestFinancialVisualPlan(
    topic2,
    selectedConcept,
    plannedScenes,
    targetDurationSeconds,
    category,
    options.visualTheme,
    options.motionSeed ?? `${topic2}:${customScript ? "user-script" : "generated-script"}`,
    options.recentMotionFingerprints ?? []
  );
  let cursor = 0;
  const beats = plannedScenes.map((scene, index) => {
    const rawDuration = Math.max(4, numberValue2(scene.duration_seconds, index === 0 ? 8 : 9));
    const durationRatio = rawDuration / totalSceneSeconds;
    const from = cursor;
    const to = index === plannedScenes.length - 1 ? 1 : Math.min(1, cursor + durationRatio);
    cursor = to;
    const visual = inferVisualKind(topic2, scene, index, plannedScenes.length, selectedConcept);
    const sceneVoice = textValue(scene.voice_text);
    return {
      id: `financial-${index + 1}`,
      from,
      to,
      visual,
      title: fallbackTitle(topic2, scene, profile, index),
      subtitle: fallbackSubtitle(scene, visual, profile),
      voiceText: sceneVoice,
      visualAction: textValue(scene.visual_action, textValue(scene.visual_hint)),
      cameraAction: visualPlans[index].cameraAction,
      transitionIn: visualPlans[index].transitionIn,
      textAnimation: textValue(scene.text_animation, "reveal"),
      soundEffect: textValue(scene.sound_effect, "none"),
      concept: selectedConcept,
      composition: visualPlans[index].composition,
      presenterLayout: visualPlans[index].presenterLayout,
      presenterPose: visualPlans[index].presenterPose,
      visualMoments: visualPlans[index].moments,
      objectKinds: stringArray(scene.objects),
      background: options.visualTheme === "crypto_f2" ? "grid" : backgroundForScene(topic2, scene, index),
      chartKind: chartKindForScene(scene, visual, index, selectedConcept),
      entityLabel: profile.entityLabel,
      metricLabel: profile.metricLabel,
      maturityLabel: profile.maturityLabel,
      definitionCaption: profile.definitionCaption,
      summaryItems: profile.summaryItems
    };
  });
  const voiceParts = plannedScenes.map((scene) => textValue(scene.voice_text)).filter(Boolean);
  const script2 = voiceParts.join("\n\n").trim();
  if (!script2) throw new Error("AI-\u0441\u0446\u0435\u043D\u0430\u0440\u0438\u0439 \u0444\u0438\u043D\u0430\u043D\u0441\u043E\u0432\u043E\u0433\u043E \u0440\u043E\u043B\u0438\u043A\u0430 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u043B\u044F \u043E\u0437\u0432\u0443\u0447\u043A\u0438.");
  const visualMedia = options.visualTheme === "crypto_f2" ? {
    beats,
    assets: {},
    notice: "\u0412\u0435\u043A\u0442\u043E\u0440\u043D\u0430\u044F \u043E\u0431\u044A\u0435\u043A\u0442\u043D\u0430\u044F \u0430\u043D\u0438\u043C\u0430\u0446\u0438\u044F \u0431\u0435\u0437 \u0441\u0442\u043E\u043A\u043E\u0432\u044B\u0445 \u0444\u043E\u0442\u043E.",
    credits: []
  } : await resolveFinancialVisualAssets(beats, selectedConcept);
  const background = options.visualTheme === "crypto_f2" ? "grid" : backgroundForTopic(topic2);
  const cryptoF2MotionFingerprint = options.visualTheme === "crypto_f2" ? cryptoF2MotionFingerprintFromPlan({ visualTheme: "crypto_f2", beats }) : void 0;
  const backgroundLabel = FINANCE_BACKGROUND_LIBRARY.find((item) => item.id === background)?.label || background;
  return {
    topic: topic2,
    cta,
    scriptSource: customScript ? "user" : "ai",
    title: textValue(ai.title, `\u0424\u0438\u043D\u0430\u043D\u0441\u044B: ${topic2}`).slice(0, 100),
    mainTitle: textValue(ai.title, topic2).toLocaleUpperCase("ru-RU").slice(0, 54),
    script: script2,
    targetDurationMs: requestedDuration * 1e3,
    visualConcept: selectedConcept,
    beats: visualMedia.beats,
    visualAssets: visualMedia.assets,
    visualMediaNotice: visualMedia.notice,
    visualMediaCredits: visualMedia.credits,
    background,
    visualTheme: options.visualTheme ?? "premium_creator",
    ...cryptoF2MotionFingerprint ? { cryptoF2MotionFingerprint } : {},
    hook: textValue(ai.hook, beats[0]?.subtitle || topic2),
    description: textValue(ai.description, `\u041E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0440\u043E\u043B\u0438\u043A \u043E \u0442\u0435\u043C\u0435 \xAB${topic2}\xBB.`),
    objects: collectObjects(profile, beats),
    backgroundLabel,
    brandStyleLabel: options.visualTheme === "crypto_f2" ? "\u041A\u0440\u0438\u043F\u0442\u043E \u04242 \u2014 \u0442\u0451\u043C\u043D\u0430\u044F \u0441\u0446\u0435\u043D\u0430 \u0438 \u043C\u044F\u0442\u043D\u044B\u0435 \u0430\u043A\u0446\u0435\u043D\u0442\u044B" : FINANCE_BRAND_PROFILE.label
  };
}

// .tmp-dual-asset-f2-preview.ts
var topic = "Bybit Dual Asset: BTC \u0438 \u0432\u0430\u043B\u044E\u0442\u043D\u044B\u0439 \u0440\u0438\u0441\u043A";
var script = `\u0422\u044B \u043C\u043E\u0436\u0435\u0448\u044C \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u044C \u0434\u043E\u0445\u043E\u0434 \u043D\u0430 Bitcoin, \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u043D\u0435 \u0437\u043D\u0430\u0435\u0448\u044C, \u043A\u0443\u0434\u0430 \u043F\u043E\u0439\u0434\u0451\u0442 \u0446\u0435\u043D\u0430.

\u041D\u0430 Bybit \u0435\u0441\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043C\u0435\u043D\u0442 Dual Asset \u2014 \u0431\u0438\u0432\u0430\u043B\u044E\u0442\u043D\u044B\u0435 \u0438\u043D\u0432\u0435\u0441\u0442\u0438\u0446\u0438\u0438.

\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440, \u0442\u044B \u0432\u044B\u0431\u0438\u0440\u0430\u0435\u0448\u044C BTC, \u0441\u0443\u043C\u043C\u0443 \u0438 \u0446\u0435\u043B\u0435\u0432\u0443\u044E \u0446\u0435\u043D\u0443.

\u0415\u0441\u043B\u0438 \u043A \u043C\u043E\u043C\u0435\u043D\u0442\u0443 \u0440\u0430\u0441\u0447\u0451\u0442\u0430 Bitcoin \u043D\u0435 \u0434\u043E\u0441\u0442\u0438\u0433\u0430\u0435\u0442 \u0437\u0430\u0434\u0430\u043D\u043D\u043E\u0439 \u0446\u0435\u043D\u044B \u2014 \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0448\u044C \u0434\u043E\u0445\u043E\u0434 \u0432 BTC.

\u0415\u0441\u043B\u0438 \u0434\u043E\u0441\u0442\u0438\u0433\u0430\u0435\u0442 \u2014 \u0430\u043A\u0442\u0438\u0432 \u043A\u043E\u043D\u0432\u0435\u0440\u0442\u0438\u0440\u0443\u0435\u0442\u0441\u044F \u043F\u043E \u0437\u0430\u0440\u0430\u043D\u0435\u0435 \u0443\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u043E\u0439 \u0446\u0435\u043D\u0435, \u0430 \u0442\u044B \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0448\u044C \u043F\u043E\u0432\u044B\u0448\u0435\u043D\u043D\u0443\u044E \u0434\u043E\u0445\u043E\u0434\u043D\u043E\u0441\u0442\u044C.

\u0413\u043B\u0430\u0432\u043D\u043E\u0435 \u2014 \u043F\u043E\u043D\u0438\u043C\u0430\u0442\u044C: \u044D\u0442\u043E \u043D\u0435 \u0433\u0430\u0440\u0430\u043D\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0439 \u0437\u0430\u0440\u0430\u0431\u043E\u0442\u043E\u043A \u0438 \u0442\u044B \u043F\u0440\u0438\u043D\u0438\u043C\u0430\u0435\u0448\u044C \u0432\u0430\u043B\u044E\u0442\u043D\u044B\u0439 \u0440\u0438\u0441\u043A.

\u0425\u043E\u0447\u0435\u0448\u044C \u0440\u0430\u0437\u043E\u0431\u0440\u0430\u0442\u044C\u0441\u044F, \u043A\u0430\u043A \u044D\u0442\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043D\u0430 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u043E\u043C \u043F\u0440\u0438\u043C\u0435\u0440\u0435 \u0441 BTC? \u0421\u043C\u043E\u0442\u0440\u0438 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0435 \u0432\u0438\u0434\u0435\u043E.`;
var plan = await createFinancialTopicPlan(topic, "", {
  category: "crypto",
  customScript: script,
  targetDurationSeconds: 30,
  visualTheme: "crypto_f2",
  motionSeed: "visual-check:bybit-dual-asset",
  recentMotionFingerprints: []
});
var normalizedScript = script.replace(/\s+/gu, " ").trim();
if (plan.script.replace(/\s+/gu, " ").trim() !== normalizedScript) {
  throw new Error("F2 visual plan changed the user's narration.");
}
var durationMs = plan.targetDurationMs;
var sceneStartTimesMs = plan.beats.slice(0, -1).map((beat) => Math.round(beat.to * durationMs));
var outputDir = resolve(process.cwd(), "../../attached_assets/crypto-f2-dual-asset-preview");
await mkdir(outputDir, { recursive: true });
var escapeHtml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
var cards = [];
for (let index = 0; index < plan.beats.length; index += 1) {
  const beat = plan.beats[index];
  const sceneStart = index === 0 ? 0 : sceneStartTimesMs[index - 1];
  const sceneEnd = index === plan.beats.length - 1 ? durationMs : sceneStartTimesMs[index];
  const timeMs = Math.round((sceneStart + sceneEnd) / 2);
  const svg = renderFinancialTopicPreviewFrame(plan, durationMs, timeMs, sceneStartTimesMs);
  await writeFile3(resolve(outputDir, `scene-${String(index + 1).padStart(2, "0")}.svg`), svg, "utf8");
  cards.push(`<article><h2>\u0421\u0446\u0435\u043D\u0430 ${index + 1}</h2>${svg}<p>${escapeHtml(beat.voiceText ?? beat.subtitle)}</p></article>`);
}
var summary = {
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
        action: microBeat.text
      }))
    }))
  }))
};
await writeFile3(resolve(outputDir, "plan-summary.json"), JSON.stringify(summary, null, 2), "utf8");
await writeFile3(resolve(outputDir, "preview.html"), `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>\u041A\u0440\u0438\u043F\u0442\u043E \u04242 \u2014 Dual Asset</title>
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
    <h1>\u041A\u0440\u0438\u043F\u0442\u043E \u04242: ${escapeHtml(topic)}</h1>
    <p>\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u044B\u0439 storyboard \u043F\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C\u0441\u043A\u043E\u043C\u0443 \u0441\u0446\u0435\u043D\u0430\u0440\u0438\u044E; \u043A\u0430\u0434\u0440\u044B \u0431\u0435\u0437 \u043E\u0437\u0432\u0443\u0447\u043A\u0438 \u0438 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u044F.</p>
  </header>
  <main>${cards.join("\n")}</main>
</body>
</html>`, "utf8");
console.log(JSON.stringify(summary, null, 2));
console.log(`[PREVIEW SAVED] ${outputDir}`);
