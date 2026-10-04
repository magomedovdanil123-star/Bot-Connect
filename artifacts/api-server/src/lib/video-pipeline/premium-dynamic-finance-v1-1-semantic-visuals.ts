import type { LongformVisualBeat } from "./longform-visual-director";
import type { PremiumDynamicFinanceV1_1SemanticEvent } from "./premium-dynamic-finance-v1-1-semantic-director";

const WIDTH = 1920;
const HEIGHT = 1080;

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function money(value: number, significantDigits = 4): string {
  return `$${new Intl.NumberFormat("en-US", {
    maximumSignificantDigits: significantDigits,
  }).format(value)}`;
}

function compactMoney(value: number): string {
  return `$${new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function percent(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function normalizedPath(values: number[], x: number, y: number, width: number, height: number): string {
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const span = Math.max(maximum - minimum, Math.abs(maximum) * 0.000001, 0.000000001);
  return values.map((value, index) => {
    const px = x + width * index / Math.max(1, values.length - 1);
    const py = y + height - ((value - minimum) / span) * height;
    return `${index === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
  }).join(" ");
}

function sampled(values: number[], limit = 48): number[] {
  if (values.length <= limit) return values;
  return Array.from({ length: limit }, (_, index) =>
    values[Math.round(index * (values.length - 1) / (limit - 1))]!,
  );
}

function focusShift(beat: LongformVisualBeat): number {
  if (beat.composition === "left-heavy") return 110;
  if (beat.composition === "right-heavy") return -110;
  if (beat.composition === "diagonal") return beat.index % 2 ? -70 : 70;
  return 0;
}

function coinMark(x: number, y: number, radius: number, accent: string, second: string, seed: number): string {
  return `<g transform="translate(${x} ${y}) rotate(${seed % 2 ? 9 : -9})">
    <circle r="${radius + 30}" fill="none" stroke="${accent}" stroke-opacity=".18" stroke-width="3"/>
    <circle r="${radius}" fill="#0A111C" stroke="${accent}" stroke-width="8"/>
    <circle r="${radius - 18}" fill="none" stroke="${second}" stroke-opacity=".6" stroke-width="3"/>
    <path d="M 0 ${-radius * 0.58} C ${radius * 0.42} ${-radius * 0.58}, ${radius * 0.5} ${-radius * 0.1}, 0 0 C ${-radius * 0.5} ${radius * 0.1}, ${-radius * 0.42} ${radius * 0.58}, 0 ${radius * 0.58}" fill="none" stroke="#F5F7FA" stroke-width="${Math.max(7, radius * 0.055)}" stroke-linecap="round"/>
    <path d="M ${-radius * 0.24} ${-radius * 0.17} H ${radius * 0.24} M ${-radius * 0.22} ${radius * 0.17} H ${radius * 0.22}" stroke="${second}" stroke-width="${Math.max(5, radius * 0.04)}" stroke-linecap="round"/>
  </g>`;
}

function lineChart(
  values: number[],
  accent: string,
  second: string,
  options: { x?: number; y?: number; width?: number; height?: number; label?: string } = {},
): string {
  const x = options.x ?? 230;
  const y = options.y ?? 190;
  const width = options.width ?? 1460;
  const height = options.height ?? 365;
  const data = sampled(values);
  const path = normalizedPath(data, x, y, width, height);
  const first = data[0] ?? 0;
  const last = data.at(-1) ?? 0;
  return `<g>
    ${[0, 1, 2, 3].map((row) => `<path d="M ${x} ${y + row * height / 3} H ${x + width}" stroke="#DCE7F4" stroke-opacity=".11" stroke-width="2" stroke-dasharray="9 15"/>`).join("")}
    <path d="${path}" fill="none" stroke="${accent}" stroke-opacity=".2" stroke-width="28" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${path}" fill="none" stroke="${accent}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${x}" cy="${y + height - ((first - Math.min(...data)) / Math.max(Math.max(...data) - Math.min(...data), 0.000000001)) * height}" r="15" fill="${second}"/>
    <circle cx="${x + width}" cy="${y + height - ((last - Math.min(...data)) / Math.max(Math.max(...data) - Math.min(...data), 0.000000001)) * height}" r="19" fill="#F5F7FA" stroke="${accent}" stroke-width="8"/>
    <path d="M ${x} ${y + height + 24} H ${x + width}" stroke="${second}" stroke-opacity=".38" stroke-width="3"/>
    ${options.label ? `<text x="${x}" y="${y - 32}" fill="#F5F7FA" fill-opacity=".7" font-family="DejaVu Sans,Arial,sans-serif" font-size="26" font-weight="700" letter-spacing="4">${xml(options.label)}</text>` : ""}
  </g>`;
}

function renderHistory(event: PremiumDynamicFinanceV1_1SemanticEvent, beat: LongformVisualBeat, accent: string, second: string): string {
  const shift = focusShift(beat);
  const focusX = 1315 + shift;
  const y = 405 + (event.phaseIndex % 2) * 10;
  return `<g>
    <path d="M 205 482 H 1690" stroke="${accent}" stroke-opacity=".22" stroke-width="24" stroke-linecap="round"/>
    <path d="M 205 482 H 1690" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>
    ${[0, 1, 2, 3, 4].map((index) => {
      const x = 240 + index * 352;
      const active = index === 0 || index === 4;
      return `<g transform="translate(${x} 482)">
        <circle r="${active ? 22 : 11}" fill="${active ? second : accent}" fill-opacity="${active ? ".9" : ".46"}"/>
        <circle r="${active ? 38 : 22}" fill="none" stroke="${active ? second : accent}" stroke-opacity=".4" stroke-width="3"/>
      </g>`;
    }).join("")}
    <text x="250" y="365" fill="#F4F7FA" font-family="DejaVu Sans,Arial,sans-serif" font-size="226" font-weight="800" letter-spacing="-12">2013</text>
    <text x="260" y="422" fill="${second}" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="700" letter-spacing="6">GENESIS BLOCK · DOGECOIN CORE</text>
    <text x="1690" y="550" text-anchor="end" fill="#D5DEEB" fill-opacity=".74" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="600">ИСТОРИЧЕСКАЯ ОТМЕТКА СЕТИ · ${xml(event.market.dataAsOf.slice(0, 10))}</text>
    ${coinMark(focusX, y - 82, 116, accent, second, beat.index)}
  </g>`;
}

function renderPrice(event: PremiumDynamicFinanceV1_1SemanticEvent, accent: string, second: string): string {
  return `${lineChart(event.market.priceSamples, accent, second, { label: "DOGE · 7 ДНЕЙ" })}
    <text x="235" y="645" fill="#F5F7FA" font-family="DejaVu Sans,Arial,sans-serif" font-size="34" font-weight="700">${xml(money(event.market.lowPriceUsd7d, 5))}  —  ${xml(money(event.market.highPriceUsd7d, 5))}</text>
    <text x="1688" y="645" text-anchor="end" fill="${second}" font-family="DejaVu Sans,Arial,sans-serif" font-size="34" font-weight="800">СЕЙЧАС ${xml(money(event.market.currentPriceUsd, 5))}</text>
    <text x="960" y="692" text-anchor="middle" fill="#D7E1EE" fill-opacity=".65" font-family="DejaVu Sans,Arial,sans-serif" font-size="20" font-weight="600">${xml(event.market.sourceLabel)} · НЕ ПРОГНОЗ</text>`;
}

function renderMeasuredSegment(
  event: PremiumDynamicFinanceV1_1SemanticEvent,
  accent: string,
  second: string,
  kind: "rise" | "drawdown",
): string {
  const segment = kind === "rise" ? event.market.riseSegment : event.market.drawdownSegment;
  if (!segment) throw new Error(`No measured ${kind} segment was supplied to the semantic visual renderer`);
  const values = event.market.priceSamples.slice(segment.fromIndex, segment.toIndex + 1);
  const isRise = kind === "rise";
  const color = isRise ? "#66E58C" : "#FF6A70";
  const title = isRise ? "ИЗМЕРЕННЫЙ РОСТ" : "ИЗМЕРЕННОЕ СНИЖЕНИЕ";
  const y = isRise ? 252 : 280;
  const path = normalizedPath(values, 330, y, 1260, 245);
  return `<g>
    <path d="M 245 515 H 1675" stroke="#DCE7F4" stroke-opacity=".13" stroke-width="2" stroke-dasharray="9 15"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-opacity=".2" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${path}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="330" cy="${y + (isRise ? 240 : 0)}" r="22" fill="${second}" stroke="#09101A" stroke-width="7"/>
    <circle cx="1590" cy="${y + (isRise ? 0 : 240)}" r="25" fill="${color}" stroke="#09101A" stroke-width="7"/>
    <text x="960" y="180" text-anchor="middle" fill="#F5F7FA" font-family="DejaVu Sans,Arial,sans-serif" font-size="30" font-weight="700" letter-spacing="5">${title} · ФРАГМЕНТ 7Д</text>
    <text x="960" y="610" text-anchor="middle" fill="${color}" font-family="DejaVu Sans,Arial,sans-serif" font-size="70" font-weight="800">${xml(percent(segment.changePercent))}</text>
    <text x="960" y="660" text-anchor="middle" fill="#D5DEEB" fill-opacity=".7" font-family="DejaVu Sans,Arial,sans-serif" font-size="21" font-weight="600">ИСТОРИЧЕСКИЙ ОТРЕЗОК · ${xml(event.market.sourceLabel)}</text>
    ${coinMark(beatCoinX(kind), 398, 56, accent, second, segment.fromIndex + segment.toIndex)}
  </g>`;
}

function beatCoinX(kind: "rise" | "drawdown"): number {
  return kind === "rise" ? 182 : 1738;
}

function renderMarketCap(
  event: PremiumDynamicFinanceV1_1SemanticEvent,
  accent: string,
  second: string,
  seed: number,
  omitStaticValue = false,
): string {
  const value = event.market.marketCapUsd;
  const circles = Array.from({ length: 28 }, (_, index) => {
    const column = index % 7;
    const row = Math.floor(index / 7);
    const x = 330 + column * 209 + Math.sin(index + seed) * 13;
    const y = 240 + row * 88 + Math.cos(index * 1.3 + seed) * 10;
    const radius = index % 7 === 0 ? 19 : 12;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius}" fill="${index % 3 === 0 ? second : accent}" fill-opacity="${index % 3 === 0 ? ".74" : ".38"}"/>`;
  }).join("");
  return `<g>
    <ellipse cx="960" cy="430" rx="710" ry="245" fill="none" stroke="${accent}" stroke-opacity=".11" stroke-width="3"/>
    <ellipse cx="960" cy="430" rx="540" ry="190" fill="none" stroke="${second}" stroke-opacity=".12" stroke-width="3" transform="rotate(-8 960 430)"/>
    ${circles}
    <text x="960" y="308" text-anchor="middle" fill="#D5DEEB" fill-opacity=".75" font-family="DejaVu Sans,Arial,sans-serif" font-size="27" font-weight="700" letter-spacing="6">РЫНОЧНАЯ КАПИТАЛИЗАЦИЯ</text>
    ${value === null ? `<text x="960" y="470" text-anchor="middle" fill="#F5F7FA" font-family="DejaVu Sans,Arial,sans-serif" font-size="142" font-weight="800" letter-spacing="-6">НЕТ ДАННЫХ</text>` : omitStaticValue ? "" : `<text x="960" y="470" text-anchor="middle" fill="#F5F7FA" font-family="DejaVu Sans,Arial,sans-serif" font-size="142" font-weight="800" letter-spacing="-6">${xml(compactMoney(value))}</text>`}
    <text x="960" y="550" text-anchor="middle" fill="${second}" font-family="DejaVu Sans,Arial,sans-serif" font-size="26" font-weight="700">${xml(event.market.dataAsOf.slice(0, 10))} · ${xml(event.market.sourceLabel)}</text>
    <text x="960" y="620" text-anchor="middle" fill="#D5DEEB" fill-opacity=".7" font-family="DejaVu Sans,Arial,sans-serif" font-size="22" font-weight="600">ОЦЕНКА ОБРАЩАЮЩЕГОСЯ РЫНКА · НЕ ЦЕНА ОДНОЙ МОНЕТЫ</text>
  </g>`;
}

function renderBitcoinComparison(event: PremiumDynamicFinanceV1_1SemanticEvent, accent: string, second: string, seed: number): string {
  const rows = [
    { label: "DOGE", value: event.market.changePercent7d, color: accent, y: 335, x: 200 },
    { label: "BTC", value: event.market.bitcoinChangePercent7d, color: second, y: 505, x: 200 },
  ];
  const axisX = 1000;
  const scale = 102;
  return `<g>
    <text x="960" y="174" text-anchor="middle" fill="#D5DEEB" font-family="DejaVu Sans,Arial,sans-serif" font-size="25" font-weight="700" letter-spacing="5">ИЗМЕНЕНИЕ ЗА ОДИНАКОВЫЕ 7 ДНЕЙ</text>
    <path d="M ${axisX} 265 V 590" stroke="#F5F7FA" stroke-opacity=".45" stroke-width="3"/>
    ${rows.map((row, index) => {
      const length = Math.min(520, Math.abs(row.value) * scale);
      const left = row.value < 0;
      const x = left ? axisX - length : axisX;
      return `<g>
        <rect x="${axisX - 520}" y="${row.y - 56}" width="1040" height="76" rx="38" fill="#DCE7F4" fill-opacity=".05"/>
        <rect x="${x}" y="${row.y - 42}" width="${Math.max(8, length)}" height="48" rx="24" fill="${row.color}" fill-opacity=".82"/>
        ${coinMark(row.x, row.y - 24, 43, row.color, index ? accent : second, seed + index)}
        <text x="290" y="${row.y - 14}" fill="#F5F7FA" font-family="DejaVu Sans,Arial,sans-serif" font-size="52" font-weight="800">${row.label}</text>
        <text x="1510" y="${row.y - 6}" fill="${row.color}" font-family="DejaVu Sans,Arial,sans-serif" font-size="39" font-weight="800">${xml(percent(row.value))}</text>
      </g>`;
    }).join("")}
    <text x="960" y="635" text-anchor="middle" fill="#D5DEEB" fill-opacity=".66" font-family="DejaVu Sans,Arial,sans-serif" font-size="20" font-weight="600">КОНТЕКСТ ПЕРИОДА · НЕ ОБЪЯСНЕНИЕ ПРИЧИН И НЕ ПРОГНОЗ</text>
  </g>`;
}

function renderMediaNoise(accent: string, second: string, seed: number): string {
  return `<g>
    ${Array.from({ length: 7 }, (_, index) => {
      const y = 165 + index * 70;
      const x = 200 + ((index * 211 + seed * 43) % 260);
      const width = 1080 + (index % 3) * 120;
      const angle = index % 2 ? 1.2 : -1.2;
      return `<g transform="rotate(${angle} ${x} ${y})">
        <path d="M ${x} ${y} H ${x + width} l 60 22 H ${x + 24} Z" fill="${index % 2 ? accent : second}" fill-opacity="${index % 3 === 0 ? ".22" : ".11"}"/>
        <path d="M ${x + 38} ${y + 11} H ${x + width * 0.62}" stroke="#F5F7FA" stroke-opacity=".28" stroke-width="${index % 2 ? 4 : 7}"/>
        <path d="M ${x + width * 0.76} ${y + 11} H ${x + width * 0.94}" stroke="${accent}" stroke-opacity=".55" stroke-width="7"/>
      </g>`;
    }).join("")}
    ${[0, 1, 2].map((index) => `<path d="M ${260 + index * 450} 170 l 95 120 -62 35 108 132" fill="none" stroke="${index % 2 ? accent : second}" stroke-opacity=".48" stroke-width="7"/>`).join("")}
    <text x="960" y="500" text-anchor="middle" fill="#F5F7FA" font-family="DejaVu Sans,Arial,sans-serif" font-size="86" font-weight="800" letter-spacing="8">ИНФОРМАЦИОННЫЙ ШУМ</text>
    <text x="960" y="560" text-anchor="middle" fill="${accent}" font-family="DejaVu Sans,Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="5">АБСТРАКТНАЯ РЕКОНСТРУКЦИЯ · НЕ НОВОСТЬ</text>
  </g>`;
}

function renderCommunity(accent: string, second: string, seed: number): string {
  const centerX = 960;
  const centerY = 390;
  const nodes = Array.from({ length: 10 }, (_, index) => {
    const angle = index * Math.PI * 2 / 10 + seed * 0.11;
    const radiusX = 650 + (index % 3) * 27;
    const radiusY = 235 + (index % 2) * 32;
    return {
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
      r: index % 3 === 0 ? 24 : 16,
    };
  });
  return `<g>
    ${nodes.map((node, index) => {
      const next = nodes[(index + 3) % nodes.length]!;
      const midX = (node.x + next.x) / 2 + Math.sin(index + seed) * 46;
      const midY = (node.y + next.y) / 2 - 48;
      return `<path d="M ${node.x.toFixed(1)} ${node.y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${next.x.toFixed(1)} ${next.y.toFixed(1)}" fill="none" stroke="${index % 2 ? accent : second}" stroke-opacity=".28" stroke-width="4"/>`;
    }).join("")}
    ${nodes.map((node, index) => `<g transform="translate(${node.x.toFixed(1)} ${node.y.toFixed(1)})">
      <circle r="${node.r + 14}" fill="${index % 2 ? accent : second}" fill-opacity=".08"/>
      <circle r="${node.r}" fill="#0B121D" stroke="${index % 2 ? accent : second}" stroke-width="4"/>
      <path d="M ${-node.r * 0.42} 0 H ${node.r * 0.42} M 0 ${-node.r * 0.42} V ${node.r * 0.42}" stroke="#F5F7FA" stroke-opacity=".74" stroke-width="3" stroke-linecap="round"/>
    </g>`).join("")}
    ${coinMark(centerX, centerY, 110, accent, second, seed)}
    <text x="960" y="614" text-anchor="middle" fill="#D5DEEB" fill-opacity=".74" font-family="DejaVu Sans,Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="4">СВЯЗИ И ПРОЕКТЫ · БЕЗ ВЫДУМАННЫХ ЧИСЕЛ</text>
  </g>`;
}

function renderBlockchain(accent: string, second: string, seed: number): string {
  const centers = [300, 740, 1180, 1620];
  return `<g>
    ${centers.slice(0, -1).map((x, index) =>
      `<path d="M ${x + 120} 392 H ${centers[index + 1]! - 120}" stroke="${index % 2 ? second : accent}" stroke-opacity=".62" stroke-width="8" marker-end="url(#semanticArrow)"/>`,
    ).join("")}
    ${centers.map((x, index) => {
      const y = 385 + Math.sin(index * 1.4 + seed) * 32;
      const color = index % 2 ? second : accent;
      return `<g transform="translate(${x} ${y}) rotate(${index % 2 ? 4 : -4})">
        <path d="M 0 -116 L 104 -58 L 104 58 L 0 116 L -104 58 L -104 -58 Z" fill="#0C1420" stroke="${color}" stroke-opacity=".9" stroke-width="5"/>
        <path d="M 0 -116 L 104 -58 L 0 0 L -104 -58 Z" fill="${color}" fill-opacity=".22"/>
        <path d="M 0 0 L 104 -58 M 0 0 L -104 -58 M 0 0 V 116" stroke="${color}" stroke-opacity=".75" stroke-width="4"/>
        <circle r="16" fill="#F5F7FA"/>
      </g>`;
    }).join("")}
    <text x="960" y="596" text-anchor="middle" fill="#F5F7FA" font-family="DejaVu Sans,Arial,sans-serif" font-size="39" font-weight="800" letter-spacing="5">БЛОКИ · СВЯЗИ · УЗЛЫ</text>
    <text x="960" y="650" text-anchor="middle" fill="#D5DEEB" fill-opacity=".68" font-family="DejaVu Sans,Arial,sans-serif" font-size="21" font-weight="600">ПОЯСНИТЕЛЬНАЯ СХЕМА · НЕ ЖИВЫЕ ТРАНЗАКЦИИ</text>
  </g>`;
}

function renderConclusion(accent: string, second: string, seed: number): string {
  return `<g>
    <path d="M 280 430 H 1640" stroke="${accent}" stroke-opacity=".26" stroke-width="18" stroke-linecap="round"/>
    <path d="M 280 430 H 1640" stroke="${accent}" stroke-width="4" stroke-dasharray="14 22"/>
    ${[0, 1, 2, 3, 4].map((index) => {
      const x = 350 + index * 300;
      const y = 430 + Math.sin(index * 1.9 + seed) * 46;
      return `<circle cx="${x}" cy="${y}" r="${index === 4 ? 24 : 14}" fill="${index === 4 ? second : accent}" fill-opacity="${index === 4 ? ".95" : ".6"}"/>`;
    }).join("")}
    <path d="M 1420 250 L 1535 430 L 1420 610 Z" fill="#101722" stroke="#FF6A70" stroke-width="8"/>
    <path d="M 1475 330 V 445 M 1475 484 V 498" stroke="#F5F7FA" stroke-width="17" stroke-linecap="round"/>
    <text x="960" y="235" text-anchor="middle" fill="#F5F7FA" font-family="DejaVu Sans,Arial,sans-serif" font-size="77" font-weight="800" letter-spacing="5">ИСТОРИЯ ≠ ПРОГНОЗ</text>
    <text x="960" y="620" text-anchor="middle" fill="${second}" font-family="DejaVu Sans,Arial,sans-serif" font-size="26" font-weight="700" letter-spacing="4">ИСТОЧНИК · ГОРИЗОНТ · РИСК</text>
  </g>`;
}

export function buildPremiumDynamicFinanceV1_1SemanticVisualSvg(
  event: PremiumDynamicFinanceV1_1SemanticEvent,
  beat: LongformVisualBeat,
  accent: string,
  second: string,
  options: { omitStaticMarketCapValue?: boolean } = {},
): string {
  const seed = beat.index + beat.sceneId * 7 + event.phaseIndex;
  switch (event.semanticType) {
    case "genesis-history":
      return renderHistory(event, beat, accent, second);
    case "price-history":
      return renderPrice(event, accent, second);
    case "measured-rise":
      return renderMeasuredSegment(event, accent, second, "rise");
    case "measured-drawdown":
      return renderMeasuredSegment(event, accent, second, "drawdown");
    case "market-cap":
      return renderMarketCap(event, accent, second, seed, options.omitStaticMarketCapValue);
    case "bitcoin-comparison":
      return renderBitcoinComparison(event, accent, second, seed);
    case "media-noise":
      return renderMediaNoise(accent, second, seed);
    case "community":
      return renderCommunity(accent, second, seed);
    case "blockchain":
      return renderBlockchain(accent, second, seed);
    case "conclusion":
      return renderConclusion(accent, second, seed);
  }
}

export function buildPremiumDynamicFinanceV1_1SemanticMotionFilters(
  event: PremiumDynamicFinanceV1_1SemanticEvent,
): string[] {
  const phase = event.phaseIndex % 3;
  switch (event.semanticType) {
    case "genesis-history":
    case "price-history":
      return [
        `drawbox=x='iw*0.12':y='ih*0.46':w='iw*0.76*min(t/0.48,1)':h=4:color=0x72e6d3@0.82:t=fill:enable='lt(t,0.48)'`,
      ];
    case "measured-rise":
      return [
        `drawbox=x='iw*(0.18+min(t/0.55,1)*0.62)':y='ih*0.31':w=7:h='ih*0.22':color=0x66e58c@0.72:t=fill:enable='lt(t,0.55)'`,
      ];
    case "measured-drawdown":
      return [
        `drawbox=x='iw*(0.18+min(t/0.55,1)*0.62)':y='ih*0.31':w=7:h='ih*0.22':color=0xff6a70@0.82:t=fill:enable='lt(t,0.55)'`,
        `drawbox=x=0:y=0:w=iw:h=ih:color=0xff5964@0.12:t=fill:enable='lt(t,0.035)'`,
      ];
    case "market-cap":
      return [
        `drawbox=x='iw*(0.18+min(t/0.45,1)*0.62)':y='ih*0.24':w=10:h='ih*0.32':color=0xf0c84b@0.58:t=fill:enable='lt(t,0.45)'`,
      ];
    case "bitcoin-comparison":
      return [
        `drawbox=x='iw*(0.5+sin(t*23+${phase})*0.12)':y='ih*0.24':w=5:h='ih*0.34':color=0xf5f7fa@0.52:t=fill:enable='lt(t,0.32)'`,
      ];
    case "media-noise":
      return [
        `drawbox=x='mod(t*30*173+${phase * 311},iw)':y='ih*0.27':w='iw*0.18':h=5:color=0xff5964@0.48:t=fill:enable='lt(t,0.16)'`,
        `drawbox=x='mod(t*30*119+${phase * 197},iw)':y='ih*0.44':w='iw*0.12':h=4:color=0x59ceff@0.46:t=fill:enable='lt(t,0.14)'`,
      ];
    case "community":
    case "blockchain":
      return [
        `drawbox=x='iw*0.14':y='ih*(0.28+mod(t*0.18+${phase * 0.07},0.24))':w='iw*0.72':h=3:color=0x72e6d3@0.42:t=fill:enable='lt(t,0.5)'`,
      ];
    case "conclusion":
      return [
        `drawbox=x=0:y=0:w=iw:h=ih:color=white@0.2:t=fill:enable='lt(t,0.035)'`,
      ];
  }
}

export function premiumDynamicFinanceV1_1SemanticSvgSize(): { width: number; height: number } {
  return { width: WIDTH, height: HEIGHT };
}