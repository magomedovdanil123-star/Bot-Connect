type PresenterBeat = {
  visual: string;
  title: string;
  subtitle: string;
  voiceText?: string;
  lipSyncText?: string;
  visualAction?: string;
};

export const FINANCIAL_PRESENTER_POSES = [
  "speaking",
  "caution",
  "confident",
  "thinking-chin",
  "thinking-temple",
  "thinking-arms",
  "pointing-up",
  "shrug-surprised",
  "aha",
  "reassuring",
] as const;

export type PresenterPose = (typeof FINANCIAL_PRESENTER_POSES)[number];

export type PresenterAnimationState = {
  pose: PresenterPose;
  mouthOpen: boolean;
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

function speechUnits(text: string): Array<{ kind: "syllable" | "pause"; weight: number }> {
  const tokens = text.match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*[,.!?;:…]?/gu) ?? [];
  const units: Array<{ kind: "syllable" | "pause"; weight: number }> = [];

  for (const token of tokens) {
    const punctuation = token.match(/[,.!?;:…]+$/u)?.[0] ?? "";
    const word = punctuation ? token.slice(0, -punctuation.length) : token;
    const vowelGroups = word.toLocaleLowerCase("ru-RU").match(/[аеёиоуыэюяaeiouy]+/gu)?.length ?? 0;
    const syllables = Math.max(1, vowelGroups);
    for (let index = 0; index < syllables; index += 1) {
      units.push({ kind: "syllable", weight: 1 });
    }

    const pauseWeight = /[.!?…]/u.test(punctuation)
      ? 0.9
      : /[,;:]/u.test(punctuation)
        ? 0.55
        : 0.22;
    units.push({ kind: "pause", weight: pauseWeight });
  }

  return units;
}

function speechMouthIsOpen(beat: PresenterBeat, progress: number): boolean {
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

function stablePoseSeed(value: string, size: number): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16_777_619);
  }
  return (hash >>> 0) % size;
}

export function getPresenterAnimationState(
  beat: PresenterBeat,
  progress: number,
  absoluteTimeMs: number,
): PresenterAnimationState {
  const meaning = `${beat.visual} ${beat.visualAction || ""} ${beat.title} ${beat.subtitle}`
    .toLocaleLowerCase("ru-RU");
  const caution = /риск|осторож|марж|убыт|плеч|паден|сниж|опас|предупрежд/iu.test(meaning)
    || beat.visual === "leverage"
    || beat.visual === "risk";
  const confident = !caution && (
    /результат|вывод|итог|важн|ключев|прибыл|рост|решен/iu.test(meaning)
    || ["hook", "payoff", "comparison", "summary", "ownership"].includes(beat.visual)
  );
  const analytical = /услов|контракт|сравн|расч[её]т|номинал|доходност|процент|ставк|позици|пример|стоимост|срок/iu.test(meaning);
  const poseOptions: PresenterPose[] = caution
    ? ["caution", "thinking-temple", "shrug-surprised", "thinking-arms"]
    : confident
      ? ["confident", "pointing-up", "aha", "reassuring"]
      : analytical
        ? ["thinking-chin", "pointing-up", "thinking-temple", "thinking-arms", "speaking"]
        : ["speaking", "thinking-chin", "pointing-up", "shrug-surprised", "aha", "reassuring", "confident", "thinking-temple", "thinking-arms", "caution"];
  const fourSecondCycle = Math.floor(Math.max(0, absoluteTimeMs) / 4_000);
  const seed = stablePoseSeed(`${beat.visual}:${beat.title}`, poseOptions.length);
  const pose = poseOptions[(seed + fourSecondCycle) % poseOptions.length]!;

  return {
    pose,
    mouthOpen: speechMouthIsOpen(beat, progress),
  };
}

export function renderPremiumCreatorBackground(timeMs: number): string {
  const drift = Math.sin(timeMs / 4_200) * 18;
  const dust = Array.from({ length: 5 }, (_, index) => {
    const x = 135 + index * 206 + Math.sin(timeMs / 1_400 + index) * 12;
    const y = 355 + ((index * 137 + Math.round(timeMs / 36)) % 780);
    const opacity = 0.12 + (index % 3) * 0.045;
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
  <path d="M0 246H1080" stroke="#D2A05E" stroke-width="2" opacity=".08"/>
  <path d="M${548 + drift} 220V1390M1050 230V1390" stroke="#9B8766" stroke-width="2" opacity=".07"/>
  <path d="M0 1390C210 1348 374 1418 540 1385S850 1355 1080 1408V1920H0Z" fill="#11191A" opacity=".62"/>
  <rect y="1370" width="1080" height="550" fill="url(#creator-floor-fade)"/>
   <ellipse cx="${540 + drift}" cy="1440" rx="390" ry="70" fill="#C28B43" opacity=".075"/>
   <path d="M0 820H1080" stroke="#C28B43" stroke-width="2" opacity=".1"/>
  <g>${dust}</g>`;
}

export function renderSpokenWordChips(
  beat: PresenterBeat,
  progress: number,
  timeMs: number,
): string {
  const words = (beat.lipSyncText || beat.voiceText || beat.subtitle)
    .match(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*/gu) ?? [];
  if (!words.length) return "";

  const spokenPosition = clamp(progress) * words.length;
  const wordIndex = Math.min(words.length - 1, Math.floor(spokenPosition));
  const chunkStart = Math.floor(wordIndex / 2) * 2;
  const activeWord = wordIndex - chunkStart;
  const visibleWords = words.slice(chunkStart, chunkStart + 2);
  const totalLetters = visibleWords.reduce((sum, word) => sum + word.length, 0);
  const fontSize = Math.max(26, Math.min(38, 504 / Math.max(14, totalLetters * 0.62 + 1)));
  const widths = visibleWords.map((word) => Math.max(54, word.length * fontSize * 0.58));
  const gap = fontSize * 0.48;
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
  const centerX = 540;
  const cardY = 726;
  let cursor = centerX - totalWidth / 2;
  const wordFraction = spokenPosition - Math.floor(spokenPosition);
  const pop = 1 + (1 - clamp(wordFraction * 2.4)) * 0.085;
  const cardX = centerX - Math.max(260, totalWidth / 2 + 38);
  const cardWidth = Math.max(520, totalWidth + 76);
  const chips = visibleWords.map((word, index) => {
    const width = widths[index]!;
    const isActive = index === activeWord;
    const x = cursor;
    cursor += width + gap;
    const anchor = x + width / 2;
    return `<g opacity="${isActive ? 1 : 0.55}" transform="translate(${anchor.toFixed(1)} 0) scale(${isActive ? pop : 1}) translate(${-anchor.toFixed(1)} 0)">
      <text x="${anchor.toFixed(1)}" y="${cardY + 63}" text-anchor="middle" fill="${isActive ? "#F0C579" : "#E5DFD3"}" font-family="DejaVu Sans, sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="${isActive ? 850 : 650}">${escapeXml(word)}</text>
      ${isActive ? `<path d="M${(x + Math.max(4, width * 0.12)).toFixed(1)} ${cardY + 73}H${(x + width - Math.max(4, width * 0.12)).toFixed(1)}" stroke="#E1AE5D" stroke-width="3.5" stroke-linecap="round"/>` : ""}
    </g>`;
  }).join("");

  const beatProgress = clamp(progress);
  const progressWidth = Math.max(0, (cardWidth - 36) * beatProgress);
  return `<g pointer-events="none" opacity="${0.96 + 0.04 * Math.sin(timeMs / 180)}">
    <rect x="${cardX.toFixed(1)}" y="${cardY}" width="${cardWidth.toFixed(1)}" height="86" rx="25" fill="#111817" fill-opacity=".97" stroke="#9C7A49" stroke-opacity=".78" stroke-width="2"/>
    <circle cx="${(cardX + 24).toFixed(1)}" cy="${cardY + 23}" r="5" fill="#F1BD6C"/>
    <text x="${(cardX + 39).toFixed(1)}" y="${cardY + 29}" fill="#D6B879" font-family="DejaVu Sans, sans-serif" font-size="14" font-weight="800" letter-spacing="2">СЕЙЧАС</text>
    ${chips}
    <rect x="${(cardX + 18).toFixed(1)}" y="${cardY + 78}" width="${(cardWidth - 36).toFixed(1)}" height="3" rx="1.5" fill="#465047"/>
    <rect x="${(cardX + 18).toFixed(1)}" y="${cardY + 78}" width="${progressWidth.toFixed(1)}" height="3" rx="1.5" fill="#E1AE5D"/>
  </g>`;
}

export function renderFullPresenter(
  beat: PresenterBeat,
  _progress: number,
  timeMs: number,
  layout: "center" | "left" | "right" | "large" = "center",
): string {
  const visualAction = `${beat.visual} ${beat.visualAction || ""}`.toLocaleLowerCase("ru-RU");
  const caution = /риск|осторож|марж|вниман|убыт|плеч/iu.test(visualAction)
    || beat.visual === "leverage"
    || beat.visual === "risk"
    || beat.visual === "summary";
  const warmth = caution ? "#C36D57" : "#C28B43";
  const bob = Math.sin(timeMs / (caution ? 1_520 : 1_860)) * 3.2;
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

export function renderPresenterImage(
  imageDataUri: string,
  timeMs: number,
  layout: "center" | "left" | "right" | "large" = "center",
): string {
  const base = layout === "left"
    ? { x: 10, y: 1_050, scale: 0.76 }
    : layout === "right"
      ? { x: 310, y: 1_050, scale: 0.76 }
      : layout === "large"
        ? { x: 0, y: 790, scale: 1.08 }
        : { x: 90, y: 950, scale: 0.9 };
  const x = base.x + Math.sin(timeMs / 580) * (layout === "center" ? 7 : 4);
  const y = base.y + Math.sin(timeMs / 480) * 6 + Math.sin(timeMs / 1_760) * 3;
  const scale = base.scale * (1 + Math.sin(timeMs / 1_080) * 0.012);
  return `<g pointer-events="none" transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) translate(500 500) scale(${scale.toFixed(4)}) translate(-500 -500)">
    <image href="${escapeXml(imageDataUri)}" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid meet"/>
  </g>`;
}