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
  const drift = Math.sin(timeMs / 3_800) * 12;
  const horizon = 945;
  const floorLines = Array.from({ length: 13 }, (_, index) => {
    const t = (index + 1) / 13;
    const y = horizon + Math.pow(t, 1.65) * (1_900 - horizon);
    return `<path d="M0 ${Math.round(y)}H1080" stroke="#B9C7BE" stroke-width="${index < 5 ? 1 : 2}" opacity="${0.18 + t * 0.24}"/>`;
  }).join("");
  const perspectiveLines = Array.from({ length: 15 }, (_, index) => {
    const endX = index * 90 - 90;
    return `<path d="M540 ${horizon}L${endX} 1920" stroke="#B9C7BE" stroke-width="2" opacity=".27"/>`;
  }).join("");

  return `<defs>
    <linearGradient id="creator-studio-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FBFCF8"/>
      <stop offset=".52" stop-color="#F3F6F1"/>
      <stop offset="1" stop-color="#E4ECE6"/>
    </linearGradient>
    <radialGradient id="creator-studio-light" cx="47%" cy="25%" r="76%">
      <stop offset="0" stop-color="#FFFFFF" stop-opacity=".94"/>
      <stop offset=".58" stop-color="#EFF5EF" stop-opacity=".55"/>
      <stop offset="1" stop-color="#DCE8E0" stop-opacity=".08"/>
    </radialGradient>
    <linearGradient id="creator-floor-fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E5ECE6" stop-opacity=".18"/>
      <stop offset="1" stop-color="#D8E2DA" stop-opacity=".42"/>
    </linearGradient>
    <filter id="creator-card-shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#42584B" flood-opacity=".13"/>
    </filter>
  </defs>
  <rect width="1080" height="1920" fill="url(#creator-studio-bg)"/>
  <rect width="1080" height="1920" fill="url(#creator-studio-light)"/>
  <ellipse cx="${540 + drift}" cy="915" rx="620" ry="94" fill="#D8E9DD" opacity=".22"/>
  <path d="M0 ${horizon}H1080" stroke="#B7C6BC" stroke-width="2" opacity=".52"/>
  <rect y="${horizon}" width="1080" height="${1920 - horizon}" fill="url(#creator-floor-fade)"/>
  <g>${floorLines}${perspectiveLines}</g>
  <g fill="#799A85" opacity=".15">
    <circle cx="85" cy="328" r="4"/><circle cx="998" cy="405" r="5"/>
    <circle cx="955" cy="688" r="3"/><circle cx="126" cy="733" r="4"/>
  </g>`;
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
  const widths = visibleWords.map((word) => Math.max(74, Math.min(170, word.length * 15 + 30)));
  const gap = 9;
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + gap * (widths.length - 1);
  let cursor = 265 - totalWidth / 2;
  const pop = 1 + (1 - ((timeMs % 620) / 620)) * 0.045;
  const chips = visibleWords.map((word, index) => {
    const width = widths[index]!;
    const isActive = index === activeWord;
    const x = cursor;
    cursor += width + gap;
    return `<g opacity="${index <= activeWord ? 1 : 0.34}" transform="translate(${x.toFixed(1)} 0) scale(${isActive ? pop : 1})">
      <rect x="0" y="0" width="${width}" height="54" rx="20" fill="${isActive ? "#E2F1E6" : "#FFFFFF"}" stroke="${isActive ? "#7BA88A" : "#D7E1D9"}" stroke-width="${isActive ? 2.5 : 1.5}" filter="url(#creator-card-shadow)"/>
      <text x="${width / 2}" y="35" text-anchor="middle" fill="${isActive ? "#244B34" : "#5E6D63"}" font-family="DejaVu Sans, sans-serif" font-size="24" font-weight="${isActive ? 800 : 650}">${escapeXml(word)}</text>
    </g>`;
  }).join("");

  return `<g transform="translate(0 0)">
    <text x="265" y="522" text-anchor="middle" fill="#718279" font-family="DejaVu Sans, sans-serif" font-size="17" font-weight="800" letter-spacing="2.2">СЛОВА ВЕДУЩЕГО</text>
    <g transform="translate(0 540)">${chips}</g>
  </g>`;
}

function iconMarkup(kind: string, accent: string): string {
  if (kind === "calendar") {
    return `<rect x="12" y="12" width="44" height="40" rx="8" fill="none" stroke="${accent}" stroke-width="4"/><path d="M12 24H56M23 8V18M45 8V18M22 34H28M39 34H45M22 43H28" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (kind === "leverage") {
    return `<path d="M12 48H55M19 45 28 18l9 27M28 18l17 18M42 36h15" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="28" cy="18" r="5" fill="${accent}"/>`;
  }
  if (kind === "risk") {
    return `<path d="M34 9 57 18V34C57 48 48 57 34 62 20 57 11 48 11 34V18Z" fill="none" stroke="${accent}" stroke-width="4" stroke-linejoin="round"/><path d="M34 22V38M34 47V48" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`;
  }
  if (kind === "compare") {
    return `<path d="M11 48H58M16 42 27 31 36 37 53 17M16 20 27 28 37 18 53 34" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M46 17H53V24M46 34H53V27" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `<rect x="12" y="11" width="44" height="48" rx="7" fill="none" stroke="${accent}" stroke-width="4"/><path d="M22 24H45M22 34H45M22 44H39M22 53H34" stroke="${accent}" stroke-width="3.5" stroke-linecap="round"/>`;
}

export function renderFuturesIconCards(
  beat: PresenterBeat,
  progress: number,
  timeMs: number,
): string {
  const primaryByVisual: Record<string, [string, string, string, string]> = {
    hook: ["КОНТРАКТ", "цена фиксируется заранее", "document", "#3B8660"],
    contract: ["ФЬЮЧЕРС", "актив · цена · дата", "calendar", "#3B8660"],
    flow: ["ДВЕ СТОРОНЫ", "покупатель и продавец", "compare", "#4889A0"],
    market: ["ЦЕНА", "сценарий на графике", "compare", "#4889A0"],
    leverage: ["ПЛЕЧО", "усиливает и плюс, и минус", "leverage", "#C58B37"],
    payoff: ["ЛОНГ / ШОРТ", "разные стороны движения", "compare", "#7962A7"],
    comparison: ["ЛОНГ / ШОРТ", "два противоположных сценария", "compare", "#7962A7"],
    calendar: ["ИСПОЛНЕНИЕ", "поставка или расчёт", "calendar", "#C58B37"],
    risk: ["РИСК", "маржа · срок · волатильность", "risk", "#C36D57"],
    summary: ["ПРОВЕРЬ", "условия до сделки", "risk", "#C36D57"],
  };
  const primary = primaryByVisual[beat.visual] || ["ФЬЮЧЕРС", "условия контракта", "document", "#3B8660"];
  const secondary: [string, string, string, string] = progress > 0.52
    ? ["СРОК", "исполнение в будущем", "calendar", "#C58B37"]
    : ["ГРАФИК", "цена и результат", "compare", "#4889A0"];

  function card(data: [string, string, string, string], x: number, y: number, delay: number): string {
    const [title, detail, icon, accent] = data;
    const floatY = Math.sin(timeMs / 720 + delay) * 7;
    const rotation = Math.sin(timeMs / 1_600 + delay) * 0.8;
    return `<g transform="translate(${x} ${y + floatY}) rotate(${rotation} 145 55)" filter="url(#creator-card-shadow)">
      <rect width="290" height="112" rx="24" fill="#FFFFFF" stroke="#DBE4DD" stroke-width="2"/>
      <circle cx="54" cy="56" r="34" fill="${accent}" fill-opacity=".12"/>
      <g transform="translate(20 22)">${iconMarkup(icon, accent)}</g>
      <text x="105" y="48" fill="#26382D" font-family="DejaVu Sans, sans-serif" font-size="20" font-weight="850" letter-spacing=".6">${escapeXml(title)}</text>
      <text x="105" y="78" fill="#69786E" font-family="DejaVu Sans, sans-serif" font-size="16" font-weight="600">${escapeXml(detail)}</text>
    </g>`;
  }

  return `<g opacity="${0.82 + 0.18 * clamp(progress * 2)}">
    ${card(primary, 740, 1055, 0)}
    ${card(secondary, 765, 1202, 1.8)}
  </g>`;
}

export function renderFullPresenter(
  beat: PresenterBeat,
  progress: number,
  timeMs: number,
): string {
  const visualAction = `${beat.visual} ${beat.visualAction || ""}`.toLocaleLowerCase("ru-RU");
  const pointing = /график|покаж|укаж|цен|сценар|рост|пад/iu.test(visualAction)
    || beat.visual === "market"
    || beat.visual === "payoff"
    || beat.visual === "comparison";
  const caution = /риск|осторож|марж|вниман|убыт|плеч/iu.test(visualAction)
    || beat.visual === "leverage"
    || beat.visual === "risk"
    || beat.visual === "summary";
  const mouthOpen = 5 + Math.abs(Math.sin(timeMs / 92)) * 11;
  const headTilt = Math.sin(timeMs / 1_050) * 1.4;
  const handLift = Math.sin(timeMs / 340) * 5;
  const eyeHeight = Math.abs(Math.sin(timeMs / 3_900)) < 0.035 ? 1 : 6;

  const leftHand = `<path d="M75 602C58 597 47 584 45 566L39 524Q38 510 48 510Q58 510 60 526L64 550 64 514Q65 500 75 502Q86 504 84 520L82 551 92 523Q97 510 107 516Q115 522 107 538L96 566 112 548Q122 538 130 547Q137 556 124 570L105 597Q92 613 75 602Z" fill="url(#presenter-skin)" stroke="#8E6752" stroke-width="3" stroke-linejoin="round"/>`;
  const openRight = `<path d="M425 602C442 597 453 584 455 566L461 524Q462 510 452 510Q442 510 440 526L436 550 436 514Q435 500 425 502Q414 504 416 520L418 551 408 523Q403 510 393 516Q385 522 393 538L404 566 388 548Q378 538 370 547Q363 556 376 570L395 597Q408 613 425 602Z" fill="url(#presenter-skin)" stroke="#8E6752" stroke-width="3" stroke-linejoin="round"/>`;
  const pointingRight = `<path d="M390 559C409 540 425 516 437 489L459 442Q465 429 475 434Q485 439 479 451L464 483 490 457Q500 447 508 456Q516 465 504 477L478 506C459 529 439 551 417 575L400 592Z" fill="url(#presenter-skin)" stroke="#8E6752" stroke-width="3" stroke-linejoin="round"/>`;
  const raisedPalm = `<path d="M414 567C402 557 397 543 399 527L402 479Q403 465 413 466Q423 467 422 481L421 511 431 465Q434 451 444 455Q454 459 449 474L440 514 457 479Q464 467 473 473Q482 479 473 495L456 526 477 505Q488 496 495 505Q502 514 489 526L460 558Q440 577 414 567Z" fill="url(#presenter-skin)" stroke="#8E6752" stroke-width="3" stroke-linejoin="round"/>`;
  const rightHand = pointing ? pointingRight : caution ? raisedPalm : openRight;

  return `<g transform="translate(12 ${638 + Math.sin(timeMs / 2_800) * 2}) scale(.94)">
    <defs>
      <linearGradient id="presenter-skin" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#F3C6A0"/><stop offset=".56" stop-color="#DDA17A"/><stop offset="1" stop-color="#BE805F"/>
      </linearGradient>
      <linearGradient id="presenter-jacket" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#E5D9C7"/><stop offset=".54" stop-color="#CBBDA8"/><stop offset="1" stop-color="#A99D8C"/>
      </linearGradient>
      <linearGradient id="presenter-shirt" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#30383D"/><stop offset="1" stop-color="#141B1F"/>
      </linearGradient>
      <linearGradient id="presenter-hair" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#40352F"/><stop offset=".52" stop-color="#242321"/><stop offset="1" stop-color="#141B19"/>
      </linearGradient>
    </defs>
    <ellipse cx="260" cy="855" rx="222" ry="24" fill="#506354" opacity=".12"/>
    <path d="M150 350C102 363 70 397 58 458L28 823H492L462 458C450 397 418 363 370 350L315 328H205Z" fill="url(#presenter-jacket)" stroke="#81796E" stroke-width="4"/>
    <g transform="translate(0 ${handLift})">
      <path d="M164 358C115 369 86 408 73 466L57 590C55 624 72 644 101 646L143 540 186 449Z" fill="url(#presenter-jacket)" stroke="#81796E" stroke-width="3"/>
      <path d="M356 358C405 369 434 408 447 466L463 590C465 624 448 644 419 646L377 540 334 449Z" fill="url(#presenter-jacket)" stroke="#81796E" stroke-width="3"/>
      ${leftHand}
      ${rightHand}
    </g>
    <path d="M208 309V385L260 426 312 385V309Z" fill="url(#presenter-skin)"/>
    <path d="M205 365 260 417 221 469 169 388ZM315 365 260 417 299 469 351 388Z" fill="#BEB09D" stroke="#8C8175" stroke-width="3" stroke-linejoin="round"/>
    <path d="M169 388 221 469 260 417 299 469 351 388 370 823H150Z" fill="url(#presenter-shirt)"/>
    <path d="M208 365 260 417 241 446 260 823 169 388Z" fill="#E7DDCD" stroke="#8C8175" stroke-width="2"/>
    <path d="M312 365 260 417 279 446 260 823 351 388Z" fill="#D4C8B6" stroke="#8C8175" stroke-width="2"/>
    <path d="M162 535H205V585H162ZM315 535H358V585H315Z" fill="none" stroke="#938879" stroke-width="3"/>
    <circle cx="184" cy="559" r="4" fill="#736B61"/><circle cx="336" cy="559" r="4" fill="#736B61"/>
    <g transform="rotate(${headTilt.toFixed(2)} 260 202)">
      <path d="M172 166C156 151 148 166 154 190 158 206 166 214 176 211ZM348 166C364 151 372 166 366 190 362 206 354 214 344 211Z" fill="url(#presenter-skin)" stroke="#A87558" stroke-width="3"/>
      <path d="M169 140C169 80 202 43 260 43S351 80 351 140L344 244C338 302 305 337 260 337S182 302 176 244Z" fill="url(#presenter-skin)" stroke="#9E6D52" stroke-width="3"/>
      <path d="M151 163C143 104 163 49 204 26 230 11 278 11 309 25 349 43 371 85 369 139L355 178 344 142C329 150 315 151 300 145 284 139 274 126 270 108 254 136 222 151 185 148L169 182Z" fill="url(#presenter-hair)" stroke="#242724" stroke-width="3" stroke-linejoin="round"/>
      <path d="M185 66C208 40 243 31 281 38M194 55C220 32 257 26 293 37M213 39C238 24 268 24 291 33" fill="none" stroke="#B6A28B" stroke-opacity=".37" stroke-width="5" stroke-linecap="round"/>
      <path d="${caution ? "M194 170Q213 155 234 168M286 168Q307 155 326 170" : "M194 166Q214 151 234 165M286 165Q306 151 326 166"}" fill="none" stroke="#49372F" stroke-width="7" stroke-linecap="round"/>
      <g>
        <ellipse cx="215" cy="188" rx="18" ry="${eyeHeight}" fill="#FFF9EF"/>
        <ellipse cx="305" cy="188" rx="18" ry="${eyeHeight}" fill="#FFF9EF"/>
        <ellipse cx="219" cy="188" rx="7" ry="${Math.max(1, eyeHeight - 1)}" fill="#475D4F"/>
        <ellipse cx="301" cy="188" rx="7" ry="${Math.max(1, eyeHeight - 1)}" fill="#475D4F"/>
        <circle cx="221" cy="185" r="2.8" fill="#FFFFFF"/><circle cx="303" cy="185" r="2.8" fill="#FFFFFF"/>
      </g>
      <path d="M260 191C257 213 250 228 247 238 254 244 266 244 273 239" fill="none" stroke="#AA765A" stroke-width="4" stroke-linecap="round"/>
      <path d="M189 221Q211 230 233 221M287 221Q309 230 331 221" fill="none" stroke="#D88F78" stroke-width="5" stroke-linecap="round" opacity=".35"/>
      <path d="M211 252Q260 272 309 252 304 299 260 307 216 299 211 252Z" fill="#493A35" opacity=".92"/>
      <ellipse cx="260" cy="267" rx="18" ry="${mouthOpen.toFixed(1)}" fill="#713B39"/>
      <path d="M243 263Q260 257 277 263L274 268H246Z" fill="#FFF4E8"/>
      <path d="M230 288Q260 300 290 288" fill="none" stroke="#B87960" stroke-width="4" stroke-linecap="round"/>
    </g>
  </g>`;
}