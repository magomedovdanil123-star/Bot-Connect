type PresenterBeat = {
  visual: string;
  title: string;
  subtitle: string;
  voiceText?: string;
  visualAction?: string;
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
    <radialGradient id="creator-host-light" cx="31%" cy="48%" r="64%">
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
  <ellipse cx="${292 + drift}" cy="1440" rx="390" ry="70" fill="#C28B43" opacity=".075"/>
  <path d="M0 1480H1080" stroke="#C28B43" stroke-width="2" opacity=".1"/>
  <g>${dust}</g>`;
}

export function renderSpokenWordChips(
  beat: PresenterBeat,
  progress: number,
  timeMs: number,
): string {
  const words = (beat.voiceText || beat.subtitle)
    .replace(/[—–]/gu, " ")
    .split(/\s+/u)
    .map((word) => word.trim())
    .filter(Boolean);
  if (!words.length) return "";

  const wordIndex = Math.min(words.length - 1, Math.floor(clamp(progress) * words.length));
  const chunkStart = Math.floor(wordIndex / 3) * 3;
  const activeWord = wordIndex - chunkStart;
  const visibleWords = words.slice(chunkStart, chunkStart + 3);
  const widths = visibleWords.map((word) => Math.max(62, Math.min(132, word.length * 13 + 22)));
  const gap = 6;
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
  const centerX = 820;
  let cursor = centerX - totalWidth / 2;
  const pop = 1 + (1 - ((timeMs % 680) / 680)) * 0.025;
  const chips = visibleWords.map((word, index) => {
    const width = widths[index]!;
    const isActive = index === activeWord;
    const x = cursor;
    cursor += width + gap;
    return `<g opacity="${index < activeWord ? 0.68 : isActive ? 1 : 0.36}" transform="translate(${x.toFixed(1)} 0) scale(${isActive ? pop : 1})">
      <text x="${width / 2}" y="1358" text-anchor="middle" fill="${isActive ? "#E4B66F" : "#E5DFD3"}" font-family="DejaVu Sans, sans-serif" font-size="26" font-weight="${isActive ? 800 : 650}">${escapeXml(word)}</text>
      ${isActive ? `<path d="M${Math.max(4, width * 0.18)} 1368H${width - Math.max(4, width * 0.18)}" stroke="#D7A85F" stroke-width="2.5" stroke-linecap="round"/>` : ""}
    </g>`;
  }).join("");

  return `<g pointer-events="none" opacity="${0.86 + 0.14 * clamp(progress * 2)}">
    <rect x="604" y="1322" width="432" height="58" rx="22" fill="#101716" fill-opacity=".94" stroke="#4B574B" stroke-width="1.5"/>
    ${chips}
  </g>`;
}

export function renderFullPresenter(
  beat: PresenterBeat,
  _progress: number,
  timeMs: number,
): string {
  const visualAction = `${beat.visual} ${beat.visualAction || ""}`.toLocaleLowerCase("ru-RU");
  const caution = /риск|осторож|марж|вниман|убыт|плеч/iu.test(visualAction)
    || beat.visual === "leverage"
    || beat.visual === "risk"
    || beat.visual === "summary";
  const warmth = caution ? "#C36D57" : "#C28B43";
  const bob = Math.sin(timeMs / (caution ? 1_520 : 1_860)) * 3.2;

  return `<g pointer-events="none">
    <defs>
      <radialGradient id="presenter-aura" cx="46%" cy="42%" r="60%">
        <stop offset="0" stop-color="${warmth}" stop-opacity=".22"/>
        <stop offset=".58" stop-color="${warmth}" stop-opacity=".07"/>
        <stop offset="1" stop-color="${warmth}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="270" cy="${(1020 + bob).toFixed(1)}" rx="330" ry="500" fill="url(#presenter-aura)" opacity=".78"/>
    <ellipse cx="286" cy="${(1434 + bob).toFixed(1)}" rx="350" ry="34" fill="#000000" opacity=".32"/>
  </g>`;
}

export function renderPresenterImage(imageDataUri: string, timeMs: number): string {
  const x = -104 + Math.sin(timeMs / 1_724) * 3;
  const y = 620 + Math.sin(timeMs / 1_250) * 4;
  return `<g pointer-events="none" transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
    <image href="${escapeXml(imageDataUri)}" x="0" y="0" width="760" height="760" preserveAspectRatio="xMidYMid meet"/>
  </g>`;
}