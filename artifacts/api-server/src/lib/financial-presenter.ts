type PresenterBeat = {
  visual: string;
  title: string;
  subtitle: string;
  voiceText?: string;
  lipSyncText?: string;
  visualAction?: string;
  presenterPose?: PresenterPose;
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

function ease(value: number): number {
  const progress = clamp(value);
  return 1 - (1 - progress) ** 3;
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

export type TimedSpeechWord = {
  word: string;
  normalized: string;
  punctuation: string;
  start: number;
  end: number;
};

const NON_KEYWORD_WORDS = new Set([
  "а", "без", "бы", "будет", "будут", "в", "во", "вот", "все", "всё",
  "для", "до", "если", "ещё", "еще", "есть", "её", "его", "же", "за",
  "и", "или", "из", "их", "к", "как", "когда", "который", "ли", "мне",
  "может", "можно", "могут", "мы", "на", "над", "не", "но", "о", "об",
  "он", "она", "они", "оно", "от", "по", "под", "при", "про", "с", "со",
  "так", "там", "то", "тоже", "ты", "у", "уже", "что", "это", "я",
]);

function normalizeKeyword(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}]/gu, "");
}

export function getSpeechWordTimings(
  value: string,
): { words: TimedSpeechWord[]; totalWeight: number } {
  const words: TimedSpeechWord[] = [];
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

    totalWeight += /[.!?…]/u.test(punctuation)
      ? 0.9
      : /[,;:]/u.test(punctuation)
        ? 0.55
        : 0.22;
  }

  return { words, totalWeight };
}

function isSameKeywordFamily(left: string, right: string): boolean {
  if (left === right) return true;
  const sharedLength = Math.min(left.length, right.length, 6);
  return sharedLength >= 5 && left.slice(0, sharedLength) === right.slice(0, sharedLength);
}

function selectSpokenKeywords(
  title: string,
  words: TimedSpeechWord[],
): TimedSpeechWord[] {
  const titleTerms = (title.match(/[\p{L}\p{N}]+%?/gu) ?? [])
    .map(normalizeKeyword)
    .filter((word) => word && !NON_KEYWORD_WORDS.has(word));
  const selectedIndexes = new Set<number>();

  for (const term of titleTerms) {
    const matchIndex = words.findIndex((word, index) =>
      !selectedIndexes.has(index)
      && !NON_KEYWORD_WORDS.has(word.normalized)
      && isSameKeywordFamily(term, word.normalized));
    if (matchIndex >= 0) selectedIndexes.add(matchIndex);
  }

  const contentIndexes = words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => !NON_KEYWORD_WORDS.has(word.normalized))
    .map(({ index }) => index);
  const desiredKeywordCount = Math.min(4, contentIndexes.length);
  for (let sample = 0; sample < desiredKeywordCount; sample += 1) {
    const sampleIndex = desiredKeywordCount === 1
      ? 0
      : Math.round(sample * (contentIndexes.length - 1) / (desiredKeywordCount - 1));
    selectedIndexes.add(contentIndexes[sampleIndex]!);
  }
  if (selectedIndexes.size < desiredKeywordCount) {
    for (const index of contentIndexes) {
      selectedIndexes.add(index);
      if (selectedIndexes.size >= desiredKeywordCount) break;
    }
  }

  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .slice(0, 6)
    .map((index) => words[index]!);
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
  const semanticPoseOptions: PresenterPose[] = caution
    ? ["caution", "thinking-temple", "shrug-surprised", "thinking-arms"]
    : confident
      ? ["confident", "pointing-up", "aha", "reassuring"]
      : analytical
        ? ["thinking-chin", "pointing-up", "thinking-temple", "thinking-arms", "speaking"]
        : ["speaking", "thinking-chin", "pointing-up", "shrug-surprised", "aha", "reassuring", "confident", "thinking-temple", "thinking-arms", "caution"];
  const fiveSecondCycle = Math.floor(Math.max(0, absoluteTimeMs) / 5_000);
  const continuationOptions = beat.presenterPose
    ? semanticPoseOptions.filter((pose) => pose !== beat.presenterPose)
    : semanticPoseOptions;
  const seed = stablePoseSeed(`${beat.visual}:${beat.title}`, continuationOptions.length);
  const pose = beat.presenterPose && fiveSecondCycle === 0
    ? beat.presenterPose
    : continuationOptions[
        (seed + (beat.presenterPose ? fiveSecondCycle - 1 : fiveSecondCycle))
        % continuationOptions.length
      ]!;

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
  const source = beat.lipSyncText || beat.voiceText || beat.subtitle;
  const { words, totalWeight } = getSpeechWordTimings(source);
  const keywords = selectSpokenKeywords(beat.title, words);
  if (!keywords.length || !totalWeight) return "";

  const spokenWeight = clamp(progress) * totalWeight;
  const activeIndex = keywords.reduce(
    (selectedIndex, word, index) => word.start <= spokenWeight ? index : selectedIndex,
    -1,
  );
  if (activeIndex < 0) return "";
  const activeWord = keywords[activeIndex]!;
  const timeAfterWord = spokenWeight - activeWord.end;
  if (timeAfterWord > 0.48) return "";
  const wordProgress = clamp(
    (spokenWeight - activeWord.start) / Math.max(0.6, activeWord.end - activeWord.start),
  );
  const fadeIn = clamp(wordProgress / 0.18);
  const fadeOut = 1 - clamp(timeAfterWord / 0.48);
  const cardOpacity = Math.min(fadeIn, fadeOut);
  const fontSize = Math.max(30, Math.min(46, 680 / Math.max(8, activeWord.word.length * 0.62)));
  const wordWidth = activeWord.word.length * fontSize * 0.62;
  const cardWidth = Math.max(310, Math.min(760, wordWidth + 112));
  const centerX = 540;
  const cardX = centerX - cardWidth / 2;
  const cardY = 680;
  const wordX = centerX;
  const entranceProgress = ease(clamp(wordProgress / 0.34));
  const pop = 0.82 + entranceProgress * 0.18 + Math.sin(entranceProgress * Math.PI) * 0.06;
  const rotation = (1 - entranceProgress) * -4.5;
  const progressWidth = Math.max(0, (cardWidth - 36) * wordProgress);

  return `<g pointer-events="none" opacity="${cardOpacity.toFixed(2)}">
    <g transform="translate(${wordX} ${cardY + 44}) rotate(${rotation.toFixed(2)}) scale(${pop.toFixed(3)}) translate(-${wordX} ${-(cardY + 44)})">
      <rect x="${cardX.toFixed(1)}" y="${cardY}" width="${cardWidth.toFixed(1)}" height="88" rx="25" fill="#111817" fill-opacity=".97" stroke="#9C7A49" stroke-opacity=".78" stroke-width="2"/>
      <circle cx="${(cardX + 24).toFixed(1)}" cy="${cardY + 23}" r="5" fill="#F1BD6C"/>
      <text x="${(cardX + 39).toFixed(1)}" y="${cardY + 29}" fill="#D6B879" font-family="DejaVu Sans, sans-serif" font-size="14" font-weight="800" letter-spacing="2">КЛЮЧЕВОЕ СЛОВО</text>
      <text x="${wordX}" y="${cardY + 64}" text-anchor="middle" fill="#F0C579" font-family="DejaVu Sans, sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="900">${escapeXml(activeWord.word.toLocaleUpperCase("ru-RU"))}</text>
      <path d="M${(centerX - Math.min(wordWidth / 2 + 5, cardWidth / 2 - 28)).toFixed(1)} ${cardY + 74}H${(centerX + Math.min(wordWidth / 2 + 5, cardWidth / 2 - 28)).toFixed(1)}" stroke="#E1AE5D" stroke-width="3.5" stroke-linecap="round"/>
      <rect x="${(cardX + 18).toFixed(1)}" y="${cardY + 80}" width="${(cardWidth - 36).toFixed(1)}" height="3" rx="1.5" fill="#465047"/>
      <rect x="${(cardX + 18).toFixed(1)}" y="${cardY + 80}" width="${progressWidth.toFixed(1)}" height="3" rx="1.5" fill="#E1AE5D"/>
    </g>
  </g>`;
}

export function renderSpeechSubtitle(beat: PresenterBeat, progress: number): string {
  const source = beat.lipSyncText || beat.voiceText || beat.subtitle;
  const { words, totalWeight } = getSpeechWordTimings(source);
  if (!words.length || !totalWeight) return "";

  const chunks: Array<{ words: TimedSpeechWord[]; start: number; end: number }> = [];
  let current: TimedSpeechWord[] = [];
  const pushChunk = () => {
    if (!current.length) return;
    chunks.push({
      words: current,
      start: current[0]!.start,
      end: current.at(-1)!.end,
    });
    current = [];
  };
  for (const word of words) {
    current.push(word);
    const sentenceBreak = /[.!?…]/u.test(word.punctuation);
    const clauseBreak = /[,;:]/u.test(word.punctuation) && current.length >= 2;
    if (current.length >= 4 || sentenceBreak || clauseBreak) pushChunk();
  }
  pushChunk();

  const spokenWeight = clamp(progress) * totalWeight;
  const active = chunks.find((chunk) =>
    spokenWeight >= chunk.start && spokenWeight <= chunk.end + 0.16);
  if (!active) return "";
  const caption = active.words
    .map((word) => `${word.word}${word.punctuation}`)
    .join(" ")
    .toLocaleUpperCase("ru-RU");
  const fontSize = Math.max(22, Math.min(32, 840 / Math.max(16, caption.length * 0.58)));
  const chunkProgress = clamp(
    (spokenWeight - active.start) / Math.max(0.4, active.end - active.start),
  );
  const enter = ease(clamp(chunkProgress / 0.18));
  const opacity = Math.min(1, enter);
  const scale = 0.97 + enter * 0.03;
  return `<g pointer-events="none" opacity="${opacity.toFixed(3)}" transform="translate(540 1722) scale(${scale.toFixed(3)}) translate(-540 -1722)">
    <rect x="78" y="1668" width="924" height="108" rx="28" fill="#080D0B" fill-opacity=".94" stroke="#C9A66B" stroke-opacity=".38" stroke-width="2"/>
    <rect x="104" y="1691" width="5" height="61" rx="2.5" fill="#8DC58B" opacity=".9"/>
    <text x="540" y="1737" text-anchor="middle" fill="#F5F0E5" font-family="DejaVu Sans, sans-serif" font-size="${fontSize.toFixed(1)}" font-weight="800" letter-spacing=".35">${escapeXml(caption)}</text>
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