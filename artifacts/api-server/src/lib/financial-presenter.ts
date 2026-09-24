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
  const drift = Math.sin(timeMs / 3_800) * 8;
  const horizon = 930;
  const floorLines = Array.from({ length: 13 }, (_, index) => {
    const t = (index + 1) / 13;
    const y = horizon + Math.pow(t, 1.65) * (1_900 - horizon);
    return `<path d="M0 ${Math.round(y)}H1080" stroke="#61705F" stroke-width="${index < 5 ? 1 : 2}" opacity="${0.08 + t * 0.1}"/>`;
  }).join("");
  const perspectiveLines = Array.from({ length: 15 }, (_, index) => {
    const endX = index * 90 - 90;
    return `<path d="M540 ${horizon}L${endX} 1920" stroke="#61705F" stroke-width="2" opacity=".12"/>`;
  }).join("");

  return `<defs>
    <linearGradient id="creator-studio-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#101720"/>
      <stop offset=".52" stop-color="#11191A"/>
      <stop offset="1" stop-color="#090D0F"/>
    </linearGradient>
    <radialGradient id="creator-studio-light" cx="74%" cy="36%" r="72%">
      <stop offset="0" stop-color="#B37A36" stop-opacity=".11"/>
      <stop offset=".45" stop-color="#37584D" stop-opacity=".08"/>
      <stop offset="1" stop-color="#090D0F" stop-opacity=".38"/>
    </radialGradient>
    <linearGradient id="creator-floor-fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#26352F" stop-opacity=".18"/>
      <stop offset="1" stop-color="#080B0D" stop-opacity=".86"/>
    </linearGradient>
    <filter id="creator-card-shadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity=".48"/>
    </filter>
  </defs>
  <rect width="1080" height="1920" fill="url(#creator-studio-bg)"/>
  <rect width="1080" height="1920" fill="url(#creator-studio-light)"/>
  <g opacity=".86">
    <rect x="18" y="198" width="330" height="650" rx="12" fill="#0A1015" stroke="#263136" stroke-width="3"/>
    <path d="M24 324H342M24 470H342M24 616H342M24 762H342" stroke="#303C38" stroke-width="10"/>
    <path d="M24 322H342M24 468H342M24 614H342M24 760H342" stroke="#B87831" stroke-width="4" opacity=".42"/>
    <g fill="#202B29" stroke="#38413A" stroke-width="2">
      <rect x="48" y="272" width="20" height="48" rx="3"/><rect x="72" y="252" width="26" height="68" rx="3"/>
      <rect x="104" y="283" width="18" height="37" rx="3"/><rect x="127" y="260" width="29" height="60" rx="3"/>
      <rect x="174" y="418" width="22" height="50" rx="3"/><rect x="202" y="395" width="28" height="73" rx="3"/>
      <rect x="235" y="427" width="19" height="41" rx="3"/><rect x="258" y="402" width="32" height="66" rx="3"/>
      <rect x="50" y="565" width="26" height="48" rx="3"/><rect x="82" y="542" width="18" height="72" rx="3"/>
      <rect x="106" y="574" width="31" height="40" rx="3"/>
    </g>
    <g fill="#24352A" stroke="#314431" stroke-width="2">
      <path d="M259 248Q231 207 221 180Q253 188 265 226Q266 191 291 172Q300 206 279 242Z"/>
      <path d="M271 239Q286 198 316 185Q317 218 282 249Q320 225 339 237Q318 263 278 259Z"/>
    </g>
    <rect x="704" y="206" width="352" height="500" rx="22" fill="#0C1720" stroke="#2A3A43" stroke-width="4"/>
    <path d="M731 620H1026M731 620V244" fill="none" stroke="#344149" stroke-width="3"/>
    <path d="M744 552 788 518 827 535 872 443 910 461 958 352 1008 326" fill="none" stroke="#C28A42" stroke-width="6" opacity=".68"/>
    <path d="M744 576 789 560 834 575 875 520 920 534 963 477 1008 488" fill="none" stroke="#457E73" stroke-width="5" opacity=".64"/>
    <g fill="#D49A4B" opacity=".68">
      <circle cx="788" cy="518" r="5"/><circle cx="872" cy="443" r="5"/><circle cx="958" cy="352" r="5"/>
    </g>
    <rect x="680" y="724" width="400" height="18" fill="#12191A"/>
    <path d="M680 725H1080" stroke="#B87831" stroke-width="4" opacity=".65"/>
    <rect x="294" y="835" width="756" height="24" rx="10" fill="#12191A"/>
    <path d="M294 836H1050" stroke="#B87831" stroke-width="3" opacity=".44"/>
  </g>
  <ellipse cx="${540 + drift}" cy="920" rx="620" ry="94" fill="#C38D47" opacity=".045"/>
  <path d="M0 ${horizon}H1080" stroke="#5A6B5E" stroke-width="2" opacity=".22"/>
  <rect y="${horizon}" width="1080" height="${1920 - horizon}" fill="url(#creator-floor-fade)"/>
  <g>${floorLines}${perspectiveLines}</g>
  <g fill="#D49A4B" opacity=".36">
    <circle cx="86" cy="354" r="3"/><circle cx="1000" cy="382" r="4"/>
    <circle cx="954" cy="671" r="3"/><circle cx="120" cy="716" r="3"/>
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
      <rect x="0" y="0" width="${width}" height="54" rx="20" fill="${isActive ? "#C28B43" : "#202927"}" stroke="${isActive ? "#E2B66F" : "#46534A"}" stroke-width="${isActive ? 2.5 : 1.5}" filter="url(#creator-card-shadow)"/>
      <text x="${width / 2}" y="35" text-anchor="middle" fill="${isActive ? "#171512" : "#E4DED1"}" font-family="DejaVu Sans, sans-serif" font-size="24" font-weight="${isActive ? 800 : 650}">${escapeXml(word)}</text>
    </g>`;
  }).join("");

  return `<g transform="translate(0 0)">
     <text x="265" y="522" text-anchor="middle" fill="#B7A47F" font-family="DejaVu Sans, sans-serif" font-size="17" font-weight="800" letter-spacing="2.2">СЛОВА ВЕДУЩЕГО</text>
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
      <rect width="290" height="112" rx="24" fill="#192321" stroke="#46534A" stroke-width="2"/>
      <circle cx="54" cy="56" r="34" fill="${accent}" fill-opacity=".12"/>
      <g transform="translate(20 22)">${iconMarkup(icon, accent)}</g>
      <text x="105" y="48" fill="#EEE6D7" font-family="DejaVu Sans, sans-serif" font-size="20" font-weight="850" letter-spacing=".6">${escapeXml(title)}</text>
      <text x="105" y="78" fill="#B7B8AE" font-family="DejaVu Sans, sans-serif" font-size="16" font-weight="600">${escapeXml(detail)}</text>
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
  const mouthOpen = 2 + Math.abs(Math.sin(timeMs / 170)) * 5;
  const headTilt = Math.sin(timeMs / 1_050) * 1.4;
  const handLift = Math.sin(timeMs / 560) * 3;
  const eyeHeight = Math.abs(Math.sin(timeMs / 3_900)) < 0.035 ? 1 : 6;

  const leftHand = `<path d="M75 602C58 597 47 584 45 566L39 524Q38 510 48 510Q58 510 60 526L64 550 64 514Q65 500 75 502Q86 504 84 520L82 551 92 523Q97 510 107 516Q115 522 107 538L96 566 112 548Q122 538 130 547Q137 556 124 570L105 597Q92 613 75 602Z" fill="url(#presenter-skin)" stroke="#966B50" stroke-width="3" stroke-linejoin="round"/>`;
  const openRight = `<path d="M425 602C442 597 453 584 455 566L461 524Q462 510 452 510Q442 510 440 526L436 550 436 514Q435 500 425 502Q414 504 416 520L418 551 408 523Q403 510 393 516Q385 522 393 538L404 566 388 548Q378 538 370 547Q363 556 376 570L395 597Q408 613 425 602Z" fill="url(#presenter-skin)" stroke="#966B50" stroke-width="3" stroke-linejoin="round"/>`;
  const pointingRight = `<path d="M390 559C409 540 425 516 437 489L459 442Q465 429 475 434Q485 439 479 451L464 483 490 457Q500 447 508 456Q516 465 504 477L478 506C459 529 439 551 417 575L400 592Z" fill="url(#presenter-skin)" stroke="#966B50" stroke-width="3" stroke-linejoin="round"/>`;
  const raisedPalm = `<path d="M414 567C402 557 397 543 399 527L402 479Q403 465 413 466Q423 467 422 481L421 511 431 465Q434 451 444 455Q454 459 449 474L440 514 457 479Q464 467 473 473Q482 479 473 495L456 526 477 505Q488 496 495 505Q502 514 489 526L460 558Q440 577 414 567Z" fill="url(#presenter-skin)" stroke="#966B50" stroke-width="3" stroke-linejoin="round"/>`;
  const rightHand = pointing ? pointingRight : caution ? raisedPalm : openRight;

  return `<g transform="translate(12 ${638 + Math.sin(timeMs / 2_800) * 2}) scale(.94)">
    <defs>
      <linearGradient id="presenter-skin" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#F7C89F"/><stop offset=".56" stop-color="#E8AA7D"/><stop offset="1" stop-color="#CE8964"/>
      </linearGradient>
      <linearGradient id="presenter-jacket" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#D4C2AA"/><stop offset=".54" stop-color="#B9A58E"/><stop offset="1" stop-color="#927E6A"/>
      </linearGradient>
      <linearGradient id="presenter-shirt" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#303638"/><stop offset="1" stop-color="#151A1C"/>
      </linearGradient>
      <linearGradient id="presenter-hair" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#614A3A"/><stop offset=".5" stop-color="#3B2E26"/><stop offset="1" stop-color="#27211D"/>
      </linearGradient>
      <linearGradient id="presenter-beard" x1="0" y1="0" x2="1" y2="1">
        <stop stop-color="#735542"/><stop offset=".52" stop-color="#594131"/><stop offset="1" stop-color="#403128"/>
      </linearGradient>
      <radialGradient id="presenter-face-light" cx="43%" cy="32%" r="76%">
        <stop offset="0" stop-color="#FFE0BC" stop-opacity=".32"/>
        <stop offset="1" stop-color="#D48B65" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <ellipse cx="260" cy="855" rx="222" ry="24" fill="#000000" opacity=".3"/>
    <path d="M150 350C102 363 70 397 58 458L28 823H492L462 458C450 397 418 363 370 350L315 328H205Z" fill="url(#presenter-jacket)" stroke="#76685A" stroke-width="4"/>
    <g transform="translate(0 ${handLift})">
      <path d="M164 358C115 369 86 408 73 466L57 590C55 624 72 644 101 646L143 540 186 449Z" fill="url(#presenter-jacket)" stroke="#76685A" stroke-width="3"/>
      <path d="M356 358C405 369 434 408 447 466L463 590C465 624 448 644 419 646L377 540 334 449Z" fill="url(#presenter-jacket)" stroke="#76685A" stroke-width="3"/>
      ${leftHand}
      ${rightHand}
    </g>
    <path d="M208 309V385L260 426 312 385V309Z" fill="url(#presenter-skin)"/>
    <path d="M205 365 260 417 221 469 169 388ZM315 365 260 417 299 469 351 388Z" fill="#A99985" stroke="#766A5D" stroke-width="3" stroke-linejoin="round"/>
    <path d="M169 388 221 469 260 440 299 469 351 388 370 823H150Z" fill="url(#presenter-shirt)"/>
    <path d="M208 365 260 417 230 463 169 388Z" fill="url(#presenter-jacket)" stroke="#766A5D" stroke-width="3" stroke-linejoin="round"/>
    <path d="M312 365 260 417 290 463 351 388Z" fill="url(#presenter-jacket)" stroke="#766A5D" stroke-width="3" stroke-linejoin="round"/>
    <path d="M181 408C190 520 190 677 181 814M339 408C330 520 330 677 339 814" fill="none" stroke="#877663" stroke-opacity=".64" stroke-width="3"/>
    <path d="M162 535H205V585H162ZM315 535H358V585H315Z" fill="none" stroke="#857460" stroke-width="3"/>
    <circle cx="184" cy="559" r="4" fill="#5C5145"/><circle cx="336" cy="559" r="4" fill="#5C5145"/>
    <g transform="rotate(${headTilt.toFixed(2)} 260 202)">
      <path d="M172 166C156 151 148 166 154 190 158 206 166 214 176 211ZM348 166C364 151 372 166 366 190 362 206 354 214 344 211Z" fill="url(#presenter-skin)" stroke="#AA795A" stroke-width="3"/>
      <path d="M169 140C169 80 202 43 260 43S351 80 351 140L344 244C338 302 305 337 260 337S182 302 176 244Z" fill="url(#presenter-skin)" stroke="#A97759" stroke-width="3"/>
      <path d="M169 140C169 80 202 43 260 43S351 80 351 140L344 244C338 302 305 337 260 337S182 302 176 244Z" fill="url(#presenter-face-light)"/>
      <path d="M151 164C142 130 145 91 160 67L151 51 178 59 187 31 207 48 225 19 245 41 262 13 279 40 301 22 308 51 333 39 331 72 356 59 358 94 371 105 368 140 355 179 344 143C330 151 312 151 296 144 282 138 273 125 269 108 253 136 222 151 185 148L169 182Z" fill="url(#presenter-hair)" stroke="#2D241F" stroke-width="3" stroke-linejoin="round"/>
      <path d="M165 87 181 64 197 77 209 48 229 65 246 34 264 58 280 35 296 61 321 48M170 105 189 84 206 94 224 67 242 82 261 57 278 77 300 55 320 79" fill="none" stroke="#A07A59" stroke-opacity=".48" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M194 168Q214 154 234 167M286 167Q306 154 326 168" fill="none" stroke="#5D4637" stroke-width="6" stroke-linecap="round"/>
      <g>
        <ellipse cx="215" cy="188" rx="17" ry="${eyeHeight}" fill="#FFF4E6"/>
        <ellipse cx="305" cy="188" rx="17" ry="${eyeHeight}" fill="#FFF4E6"/>
        <ellipse cx="219" cy="188" rx="7" ry="${Math.max(1, eyeHeight - 1)}" fill="#6A4B37"/>
        <ellipse cx="301" cy="188" rx="7" ry="${Math.max(1, eyeHeight - 1)}" fill="#6A4B37"/>
        <ellipse cx="219" cy="188" rx="3.2" ry="${Math.max(1, eyeHeight - 1)}" fill="#241C18"/>
        <ellipse cx="301" cy="188" rx="3.2" ry="${Math.max(1, eyeHeight - 1)}" fill="#241C18"/>
        <circle cx="221" cy="185" r="2.8" fill="#FFFFFF"/><circle cx="303" cy="185" r="2.8" fill="#FFFFFF"/>
      </g>
      <path d="M178 222C188 231 199 237 213 240 220 271 232 296 260 309 288 296 300 271 307 240 321 237 332 231 342 222L339 258C334 299 304 329 260 337 216 329 186 299 181 258Z" fill="url(#presenter-beard)" stroke="#594233" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M190 238C197 264 205 286 222 304M330 238C323 264 315 286 298 304M232 316Q260 326 288 316" fill="none" stroke="#A17A5B" stroke-opacity=".36" stroke-width="3" stroke-linecap="round"/>
      <path d="M260 191C257 213 250 228 247 238 254 244 266 244 273 239" fill="none" stroke="#B47D5E" stroke-width="4" stroke-linecap="round"/>
      <path d="M189 221Q211 229 233 221M287 221Q309 229 331 221" fill="none" stroke="#E6A27E" stroke-width="4" stroke-linecap="round" opacity=".26"/>
      <path d="M224 258Q239 250 251 258Q260 264 269 258Q282 250 296 258Q287 272 270 269Q260 267 250 269Q233 272 224 258Z" fill="#594032"/>
      <path d="M235 271Q260 281 285 271Q280 289 260 293Q240 289 235 271Z" fill="#75433A"/>
      <ellipse cx="260" cy="280" rx="12" ry="${mouthOpen.toFixed(1)}" fill="#63352F"/>
      <path d="M246 273Q260 277 274 273L271 278Q260 281 249 278Z" fill="#F5E5D4" opacity=".9"/>
      <path d="M244 291Q260 296 276 291" fill="none" stroke="#B47A5C" stroke-width="3" stroke-linecap="round"/>
    </g>
  </g>`;
}