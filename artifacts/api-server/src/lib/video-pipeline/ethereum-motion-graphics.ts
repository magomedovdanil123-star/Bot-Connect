import { ETHEREUM_MOTION_FFMPEG_COLORS } from "./ethereum-motion-design";
import type { CoinOverviewLongBeat, CoinOverviewLongMotif } from "./coin-overview-long-edit";

type GraphicsInput = {
  width: number;
  height: number;
  start: number;
  end: number;
  layout: number;
  beat: CoinOverviewLongBeat;
  motif: CoinOverviewLongMotif;
  motionEventDescription?: string;
};

type TextInput = {
  text: string;
  x: string | number;
  y: string | number;
  size: number;
  color: string;
  enable: string;
  align?: "left" | "center" | "right";
};

const SECTION_LABELS: Record<CoinOverviewLongMotif, string> = {
  asset: "АКТИВ",
  market: "РЫНОК",
  comparison: "СРАВНЕНИЕ",
  particles: "ПОТОК ДАННЫХ",
  morph: "ПЕРЕХОД",
  record: "ФАКТЫ И ЦИФРЫ",
  network: "СЕТЬ",
  timeline: "ХРОНОЛОГИЯ",
  access: "ДОСТУП",
  risk: "РИСКИ И ОГРАНИЧЕНИЯ",
};

const EVIDENCE_TERMS: Array<[string, RegExp]> = [
  ["TELEGRAM", /\btelegram\b/iu],
  ["GRAM", /\bgram\b/iu],
  ["TON", /\bton\b/iu],
  ["SEC", /\bsec\b|комисси.{0,18}ценн.{0,18}бумаг/iu],
  ["ETHEREUM", /\bethereum\b/iu],
  ["SOLANA", /\bsolana\b/iu],
  ["SUI", /\bsui\b/iu],
  ["ИДЕЯ", /иде[яи]|замысл/iu],
  ["ОСТАНОВКА", /останов|заблокир|запрет|ограничен/iu],
  ["СООБЩЕСТВО", /сообществ/iu],
  ["СОЗДАТЕЛИ", /создат|разработчик/iu],
  ["ПЛАТЕЖИ", /платеж|оплат/iu],
  ["КОМИССИИ", /комисс/iu],
  ["ВАЛИДАТОРЫ", /валидатор/iu],
  ["СМАРТ-КОНТРАКТЫ", /смарт.?контракт/iu],
  ["MINI APPS", /mini\s*apps|мини-прилож/iu],
  ["КОШЕЛЬКИ", /кошел/iu],
  ["ИНВЕСТОРЫ", /инвестор/iu],
  ["БЛОКЧЕЙН", /блокчейн/iu],
  ["СУД", /судебн|(?<![\p{L}\p{N}])суд(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])иск(?![\p{L}\p{N}])/iu],
  ["2018", /\b2018\b/u],
  ["2019", /\b2019\b/u],
  ["2020", /\b2020\b/u],
];

const MOTIF_TEXT_COLOR = ETHEREUM_MOTION_FFMPEG_COLORS.text;
const MOTIF_CORAL = ETHEREUM_MOTION_FFMPEG_COLORS.coral;
const MOTIF_CYAN = ETHEREUM_MOTION_FFMPEG_COLORS.cyan;
const MOTIF_YELLOW = ETHEREUM_MOTION_FFMPEG_COLORS.yellow;
const PANEL_COLOR = `${ETHEREUM_MOTION_FFMPEG_COLORS.inactive}@0.94`;
const GRID_COLOR = `${ETHEREUM_MOTION_FFMPEG_COLORS.inactiveSecondary}@0.62`;

function expression(value: string | number): string {
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "\\'").replaceAll(",", "\\,")}'`;
}

function escapedText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll(":", "\\:")
    .replaceAll(",", "\\,")
    .replaceAll("%", "\\%");
}

function box(input: {
  x: string | number;
  y: string | number;
  w: string | number;
  h: string | number;
  color: string;
  enable: string;
  thickness?: number | "fill";
}): string {
  return `drawbox=x=${expression(input.x)}:y=${expression(input.y)}` +
    `:w=${expression(input.w)}:h=${expression(input.h)}` +
    `:color=${input.color}:t=${input.thickness ?? "fill"}:enable=${expression(input.enable)}`;
}

function text(input: TextInput): string {
  const positionedX = input.align === "center"
    ? `${input.x}-text_w/2`
    : input.align === "right" ? `${input.x}-text_w` : input.x;
  return `drawtext=font='Montserrat ExtraBold':text='${escapedText(input.text)}'` +
    `:expansion=none:x=${expression(positionedX)}:y=${expression(input.y)}` +
    `:fontsize=${input.size}:fontcolor=${input.color}` +
    `:borderw=0:shadowcolor=black@0.7:shadowx=2:shadowy=2:enable=${expression(input.enable)}`;
}

function evidenceLabels(source: string): string[] {
  const matches: Array<{ index: number; label: string }> = [];
  for (const [label, pattern] of EVIDENCE_TERMS) {
    const match = pattern.exec(source);
    if (match?.index !== undefined) matches.push({ index: match.index, label });
  }
  for (const match of source.matchAll(/\d[\d\s.,]*\s*(?:млрд|миллиард\w*|млн|миллион\w*|тыс\.?|%)/giu)) {
    const label = match[0]!
      .replace(/\s+/gu, " ")
      .replace(/миллиард\w*/iu, "МЛРД")
      .replace(/миллион\w*/iu, "МЛН")
      .replace(/тыс\.?/iu, "ТЫС")
      .toLocaleUpperCase("ru-RU");
    matches.push({ index: match.index, label });
  }
  const unique: Array<{ index: number; label: string }> = [];
  const seen = new Set<string>();
  for (const match of matches.sort((left, right) => left.index - right.index)) {
    if (seen.has(match.label)) continue;
    seen.add(match.label);
    unique.push(match);
  }
  return unique.slice(0, 5).map(({ label }) => label);
}

function addEvidenceCards(
  filters: string[],
  labels: string[],
  input: GraphicsInput,
  options: { x: number; y: number; width: number; height: number; max?: number },
): void {
  const { width, height, start, end, layout } = input;
  const max = options.max ?? 4;
  const cardLabels = labels.slice(0, max);
  if (!cardLabels.length) cardLabels.push("КЛЮЧЕВОЙ ФАКТ");
  const gap = Math.round(width * 0.018);
  const cardWidth = Math.floor((options.width - gap * (cardLabels.length - 1)) / cardLabels.length);
  const reveal = `min(max((t-${start.toFixed(3)})/0.32,0),1)`;
  cardLabels.forEach((label, index) => {
    const x = options.x + index * (cardWidth + gap);
    const color = index % 3 === 0 ? MOTIF_CYAN : index % 3 === 1 ? MOTIF_CORAL : MOTIF_YELLOW;
    const delay = (0.08 + (index % 3) * 0.11).toFixed(3);
    const cardReveal = `min(max((t-${(start + Number(delay)).toFixed(3)})/0.28,0),1)`;
    filters.push(
      box({
        x,
        y: options.y,
        w: `${cardWidth}*${cardReveal}`,
        h: options.height,
        color: PANEL_COLOR,
        enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      box({
        x,
        y: options.y,
        w: `${Math.max(4, Math.round(width * 0.004))}*${cardReveal}`,
        h: options.height,
        color,
        enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      text({
        text: label,
        x: x + Math.round(cardWidth * 0.09),
        y: options.y + Math.round(options.height * 0.34),
        size: Math.min(Math.round(height * 0.033), Math.max(20, Math.floor(cardWidth * 0.077))),
        color: MOTIF_TEXT_COLOR,
        enable: `gte(t,${(start + Number(delay)).toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
  });
  filters.push(box({
    x: options.x,
    y: options.y + options.height + Math.max(10, Math.round(height * 0.028)),
    w: `${options.width}*${reveal}`,
    h: Math.max(3, Math.round(height * 0.004)),
    color: GRID_COLOR,
    enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
  }));
}

function addNetworkDiagram(filters: string[], labels: string[], input: GraphicsInput): void {
  const { width, height, start, end, layout } = input;
  const items = labels.slice(0, 4);
  if (items.length < 3) items.push(...["СВЯЗЬ", "СИСТЕМА"].filter((item) => !items.includes(item)).slice(0, 3 - items.length));
  const left = Math.round(width * 0.11);
  const right = Math.round(width * 0.89);
  const centerY = Math.round(height * (layout % 2 === 0 ? 0.48 : 0.53));
  const nodeWidth = Math.round(width * 0.16);
  const nodeHeight = Math.round(height * 0.15);
  const positions = items.map((_, index) => ({
    x: left + Math.round((right - left) * index / (items.length - 1)),
    y: centerY + Math.round(Math.sin(index * 1.9 + layout * 0.35) * height * 0.05),
  }));
  positions.slice(0, -1).forEach((point, index) => {
    const next = positions[index + 1]!;
    const delay = start + 0.12 + index * 0.12;
    const color = index % 2 === 0 ? MOTIF_CYAN : MOTIF_CORAL;
    filters.push(
      box({
        x: point.x + Math.round(nodeWidth * 0.52),
        y: point.y + Math.round(nodeHeight * 0.48),
        w: `${Math.max(3, next.x - point.x - nodeWidth)}*min(max((t-${delay.toFixed(3)})/0.28,0),1)`,
        h: Math.max(4, Math.round(height * 0.006)),
        color,
        enable: `gte(t,${delay.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      box({
        x: `${point.x + nodeWidth + Math.max(8, Math.round(width * 0.015))}+mod((t-${start.toFixed(3)})*${Math.round(width * 0.22)},${Math.max(1, next.x - point.x - nodeWidth)})`,
        y: point.y + Math.round(nodeHeight * 0.48) - Math.round(height * 0.008),
        w: Math.max(10, Math.round(height * 0.02)),
        h: Math.max(10, Math.round(height * 0.02)),
        color: MOTIF_YELLOW,
        enable: `gte(t,${delay.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
  });
  positions.forEach((point, index) => {
    const x = point.x - Math.round(nodeWidth / 2);
    const color = index === items.length - 1 ? MOTIF_YELLOW : index % 2 === 0 ? MOTIF_CYAN : MOTIF_CORAL;
    const revealAt = start + 0.12 + index * 0.13;
    filters.push(
      box({
        x,
        y: point.y,
        w: nodeWidth,
        h: nodeHeight,
        color: PANEL_COLOR,
        thickness: Math.max(4, Math.round(height * 0.005)),
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      box({
        x,
        y: point.y,
        w: nodeWidth,
        h: Math.max(4, Math.round(height * 0.009)),
        color,
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      text({
        text: items[index]!,
        x: point.x,
        y: point.y + Math.round(nodeHeight * 0.43),
        size: Math.min(Math.round(height * 0.03), Math.max(18, Math.floor(nodeWidth * 0.085))),
        color: MOTIF_TEXT_COLOR,
        align: "center",
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
  });
}

function addTimelineDiagram(filters: string[], labels: string[], input: GraphicsInput): void {
  const { width, height, start, end, layout } = input;
  const marks = labels.slice(0, 4);
  if (!marks.length) marks.push("СТАРТ", "СОБЫТИЕ", "ДАЛЬШЕ");
  const left = Math.round(width * 0.13);
  const lineWidth = Math.round(width * 0.74);
  const y = Math.round(height * (layout % 2 === 0 ? 0.46 : 0.5));
  const lineHeight = Math.max(6, Math.round(height * 0.009));
  const reveal = `min(max((t-${(start + 0.1).toFixed(3)})/0.58,0),1)`;
  filters.push(box({
    x: left,
    y,
    w: `${lineWidth}*${reveal}`,
    h: lineHeight,
    color: MOTIF_CYAN,
    enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
  }));
  marks.forEach((label, index) => {
    const x = left + Math.round(lineWidth * index / Math.max(1, marks.length - 1));
    const delay = start + 0.12 + index * 0.12;
    const color = index === marks.length - 1 ? MOTIF_YELLOW : index % 2 === 0 ? MOTIF_CORAL : MOTIF_CYAN;
    const labelY = y + (index % 2 === layout % 2 ? -1 : 1) * Math.round(height * 0.09);
    filters.push(
      box({
        x: x - Math.round(height * 0.014),
        y: y - Math.round(height * 0.022),
        w: Math.round(height * 0.044),
        h: Math.round(height * 0.044),
        color,
        enable: `gte(t,${delay.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      text({
        text: label,
        x,
        y: labelY,
        size: Math.min(Math.round(height * 0.032), Math.max(18, Math.floor(width * 0.044))),
        color: MOTIF_TEXT_COLOR,
        align: "center",
        enable: `gte(t,${delay.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
  });
  filters.push(box({
    x: `${left}+${lineWidth}*min(max((t-${(start + 0.12).toFixed(3)})/${Math.max(0.55, end - start - 0.2).toFixed(3)},0),1)`,
    y: y - Math.round(height * 0.042),
    w: Math.max(5, Math.round(height * 0.009)),
    h: Math.round(height * 0.084),
    color: MOTIF_YELLOW,
    enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
  }));
}

function addRiskDiagram(filters: string[], labels: string[], input: GraphicsInput): void {
  const { width, height, start, end, layout } = input;
  const items = labels.slice(0, 3);
  if (items.length < 2) items.push(...["ПРОЕКТ", "ОГРАНИЧЕНИЕ"].filter((item) => !items.includes(item)).slice(0, 2 - items.length));
  const left = Math.round(width * 0.14);
  const cardWidth = Math.round(width * 0.22);
  const cardHeight = Math.round(height * 0.17);
  const gap = Math.round(width * 0.1);
  const y = Math.round(height * (layout % 2 === 0 ? 0.44 : 0.49));
  items.forEach((label, index) => {
    const x = left + index * (cardWidth + gap);
    const color = index === 1 ? MOTIF_CORAL : index === 2 ? MOTIF_YELLOW : MOTIF_CYAN;
    const revealAt = start + 0.08 + index * 0.14;
    filters.push(
      box({
        x,
        y,
        w: cardWidth,
        h: cardHeight,
        color: PANEL_COLOR,
        thickness: Math.max(5, Math.round(height * 0.006)),
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      box({
        x,
        y,
        w: cardWidth,
        h: Math.max(5, Math.round(height * 0.011)),
        color,
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      text({
        text: label,
        x: x + Math.round(cardWidth * 0.08),
        y: y + Math.round(cardHeight * 0.4),
        size: Math.min(Math.round(height * 0.034), Math.max(18, Math.floor(cardWidth * 0.12))),
        color: MOTIF_TEXT_COLOR,
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
    if (index < items.length - 1) {
      const connectorX = x + cardWidth;
      const nextX = x + cardWidth + gap;
      const middleX = Math.round((connectorX + nextX) / 2);
      filters.push(
        box({
          x: connectorX,
          y: y + Math.round(cardHeight * 0.49),
          w: Math.max(2, middleX - connectorX - 11),
          h: Math.max(5, Math.round(height * 0.006)),
          color: index === 0 ? MOTIF_CYAN : MOTIF_CORAL,
          enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
        }),
        box({
          x: middleX + 10,
          y: y + Math.round(cardHeight * 0.49),
          w: Math.max(2, nextX - middleX - 10),
          h: Math.max(5, Math.round(height * 0.006)),
          color: `${MOTIF_CORAL}@0.34`,
          enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
        }),
        box({
          x: middleX,
          y: y + Math.round(cardHeight * 0.36),
          w: Math.max(7, Math.round(height * 0.018)),
          h: Math.max(7, Math.round(height * 0.045)),
          color: MOTIF_YELLOW,
          enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
        }),
      );
    }
  });
}

function addComparisonDiagram(filters: string[], labels: string[], input: GraphicsInput): void {
  const { width, height, start, end, layout } = input;
  const left = labels[0] ?? "СТОРОНА 01";
  const right = labels.find((label) => label !== left) ?? "СТОРОНА 02";
  const cardY = Math.round(height * 0.34);
  const cardHeight = Math.round(height * 0.29);
  const cardWidth = Math.round(width * 0.34);
  const leftX = Math.round(width * 0.1);
  const rightX = Math.round(width * 0.56);
  const barRows = 3;
  for (const [index, card] of [left, right].entries()) {
    const x = index === 0 ? leftX : rightX;
    const color = index === 0 ? MOTIF_CYAN : MOTIF_CORAL;
    const revealAt = start + 0.1 + index * 0.15;
    filters.push(
      box({
        x,
        y: cardY,
        w: cardWidth,
        h: cardHeight,
        color: PANEL_COLOR,
        thickness: Math.max(5, Math.round(height * 0.006)),
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      box({
        x,
        y: cardY,
        w: cardWidth,
        h: Math.max(7, Math.round(height * 0.012)),
        color,
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      text({
        text: card,
        x: x + Math.round(cardWidth * 0.08),
        y: cardY + Math.round(cardHeight * 0.21),
        size: Math.min(Math.round(height * 0.041), Math.max(20, Math.floor(cardWidth * 0.14))),
        color: MOTIF_TEXT_COLOR,
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
    for (let row = 0; row < barRows; row += 1) {
      const rowY = cardY + Math.round(cardHeight * (0.46 + row * 0.15));
      const trackX = x + Math.round(cardWidth * 0.08);
      const trackWidth = Math.round(cardWidth * 0.72);
      const barHeight = Math.max(5, Math.round(height * 0.008));
      const barEnable = `gte(t,${(revealAt + 0.14 + row * 0.08).toFixed(3)})*lt(t,${end.toFixed(3)})`;
      filters.push(box({
        x: trackX,
        y: rowY,
        w: trackWidth,
        h: barHeight,
        color: GRID_COLOR,
        enable: barEnable,
      }), box({
        x: trackX,
        y: rowY,
        w: `${Math.round(trackWidth * 0.54)}*min(max((t-${(revealAt + 0.14 + row * 0.08).toFixed(3)})/0.25,0),1)`,
        h: barHeight,
        color: `${color}@${row === 0 ? "0.9" : "0.52"}`,
        enable: barEnable,
      }));
    }
  }
  const dividerX = Math.round(width * 0.5);
  filters.push(
    box({
      x: dividerX,
      y: cardY - Math.round(height * 0.035),
      w: Math.max(4, Math.round(width * 0.004)),
      h: cardHeight + Math.round(height * 0.07),
      color: MOTIF_YELLOW,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    text({
      text: "VS",
      x: dividerX,
      y: cardY + Math.round(cardHeight * 0.48),
      size: Math.round(height * 0.045),
      color: MOTIF_YELLOW,
      align: "center",
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
  );
}

function addRecordDiagram(filters: string[], labels: string[], input: GraphicsInput): void {
  const { width, height, start, end, layout } = input;
  const rows = labels.length ? labels.slice(0, 4) : ["ПРОЕКТ", "СОБЫТИЕ"];
  const left = Math.round(width * 0.16);
  const top = Math.round(height * 0.32);
  const rowHeight = Math.round(height * 0.09);
  const widthPx = Math.round(width * 0.68);
  filters.push(box({
    x: left - Math.round(width * 0.045),
    y: top - Math.round(height * 0.045),
    w: widthPx + Math.round(width * 0.09),
    h: rowHeight * rows.length + Math.round(height * 0.1),
    color: PANEL_COLOR,
    thickness: Math.max(5, Math.round(height * 0.006)),
    enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
  }));
  rows.forEach((label, index) => {
    const y = top + index * rowHeight;
    const color = index % 2 === 0 ? MOTIF_YELLOW : MOTIF_CYAN;
    const revealAt = start + 0.09 + index * 0.12;
    filters.push(
      box({
        x: left,
        y: y + Math.round(rowHeight * 0.67),
        w: `${Math.round(widthPx * 0.82)}*min(max((t-${revealAt.toFixed(3)})/0.34,0),1)`,
        h: Math.max(3, Math.round(height * 0.004)),
        color: GRID_COLOR,
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      text({
        text: label,
        x: left,
        y: y + Math.round(rowHeight * 0.1),
        size: Math.min(Math.round(height * 0.038), Math.max(19, Math.floor(widthPx * 0.075))),
        color: index === 0 ? MOTIF_TEXT_COLOR : color,
        enable: `gte(t,${revealAt.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
  });
  filters.push(box({
    x: `${left + widthPx * 0.08}+${widthPx * 0.76}*min(max((t-${(start + 0.16).toFixed(3)})/0.72,0),1)`,
    y: top - Math.round(height * 0.035),
    w: Math.max(5, Math.round(height * 0.007)),
    h: rowHeight * rows.length + Math.round(height * 0.06),
    color: MOTIF_CORAL,
    enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
  }));
}

function addMarketDiagram(filters: string[], labels: string[], input: GraphicsInput): void {
  const { width, height, start, end, beat } = input;
  const symbol = labels.find((label) => /GRAM|TON|HYPE|APTOS|ETHEREUM|SOLANA|SUI/u.test(label)) ?? "ЦЕНА";
  const left = Math.round(width * 0.14);
  const top = Math.round(height * 0.37);
  const graphWidth = Math.round(width * 0.72);
  const graphHeight = Math.round(height * 0.24);
  const normalizedText = `${beat.text} ${beat.visualDescription ?? ""} ${input.motionEventDescription ?? ""}`
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е");
  const trend = /упал|паден|снизил|снижен|просел|спад|обвал|ниже|дешев|медвеж/u.test(normalizedText)
    ? "down"
    : /вырос|рост|поднял|повышен|выше|дороже|бычь/u.test(normalizedText) ? "up" : "neutral";
  const lineThickness = Math.max(4, Math.round(height * 0.009));
  const middle = top + Math.round(graphHeight * 0.5);
  const endpointOffset = trend === "down"
    ? Math.round(graphHeight * 0.36)
    : trend === "up" ? -Math.round(graphHeight * 0.36) : 0;
  const points = [
    { x: left, y: middle + Math.round(endpointOffset * 0.72) },
    { x: left + Math.round(graphWidth * 0.23), y: middle + Math.round(endpointOffset * 0.58) },
    { x: left + Math.round(graphWidth * 0.48), y: middle + Math.round(endpointOffset * 0.34) },
    { x: left + Math.round(graphWidth * 0.73), y: middle + Math.round(endpointOffset * 0.85) },
    { x: left + graphWidth, y: middle + endpointOffset },
  ];
  for (let row = 0; row <= 3; row += 1) {
    filters.push(box({
      x: left,
      y: top + Math.round(graphHeight * row / 3),
      w: graphWidth,
      h: Math.max(2, Math.round(height * 0.0025)),
      color: `${GRID_COLOR}@0.64`,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }));
  }
  points.slice(0, -1).forEach((point, index) => {
    const next = points[index + 1]!;
    const delay = start + 0.12 + index * 0.12;
    filters.push(
      box({
        x: point.x,
        y: point.y,
        w: `${next.x - point.x}*min(max((t-${delay.toFixed(3)})/0.22,0),1)`,
        h: lineThickness,
        color: MOTIF_CYAN,
        enable: `gte(t,${delay.toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      box({
        x: next.x - Math.round(lineThickness / 2),
        y: Math.min(point.y, next.y),
        w: lineThickness,
        h: Math.max(lineThickness, Math.abs(next.y - point.y) + lineThickness),
        color: MOTIF_CYAN,
        enable: `gte(t,${(delay + 0.1).toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
  });
  const progressDuration = Math.max(0.65, end - start - 0.2);
  filters.push(
    box({
      x: `${left}+${graphWidth}*min(max((t-${(start + 0.1).toFixed(3)})/${progressDuration.toFixed(3)},0),1)`,
      y: `${middle}+${endpointOffset}*min(max((t-${(start + 0.1).toFixed(3)})/${progressDuration.toFixed(3)},0),1)`,
      w: lineThickness * 2,
      h: lineThickness * 2,
      color: MOTIF_YELLOW,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    text({
      text: symbol,
      x: Math.round(width * 0.14),
      y: Math.round(height * 0.27),
      size: Math.round(height * 0.043),
      color: MOTIF_TEXT_COLOR,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
  );
}

function addAssetDiagram(filters: string[], labels: string[], input: GraphicsInput): void {
  const { width, height, start, end, layout } = input;
  const asset = labels.find((label) => /GRAM|TON|HYPE|APTOS|ETHEREUM|SOLANA|SUI/u.test(label)) ?? labels[0] ?? "АКТИВ";
  const x = Math.round(width * 0.17);
  const y = Math.round(height * 0.34);
  const cardWidth = Math.round(width * 0.66);
  const cardHeight = Math.round(height * 0.29);
  const reveal = `min(max((t-${(start + 0.06).toFixed(3)})/0.35,0),1)`;
  filters.push(
    box({
      x,
      y,
      w: `${cardWidth}*${reveal}`,
      h: cardHeight,
      color: PANEL_COLOR,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    box({
      x,
      y,
      w: Math.max(7, Math.round(width * 0.009)),
      h: `${cardHeight}*${reveal}`,
      color: MOTIF_CORAL,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    text({
      text: asset,
      x: Math.round(width * 0.23),
      y: Math.round(height * 0.46),
      size: Math.min(Math.round(height * 0.102), Math.round(width * 0.12)),
      color: MOTIF_TEXT_COLOR,
      enable: `gte(t,${(start + 0.1).toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
  );
  labels.filter((label) => label !== asset).slice(0, 2).forEach((label, index) => {
    const chipX = Math.round(width * (0.64 + index * 0.12));
    filters.push(
      box({
        x: chipX,
        y: Math.round(height * 0.55),
        w: Math.round(width * 0.1),
        h: Math.round(height * 0.06),
        color: index === 0 ? MOTIF_CYAN : MOTIF_YELLOW,
        enable: `gte(t,${(start + 0.2 + index * 0.15).toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      text({
        text: label,
        x: chipX + Math.round(width * 0.015),
        y: Math.round(height * 0.571),
        size: Math.min(Math.round(height * 0.024), Math.round(width * 0.027)),
        color: ETHEREUM_MOTION_FFMPEG_COLORS.background,
        enable: `gte(t,${(start + 0.2 + index * 0.15).toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
  });
}

function addAccessDiagram(filters: string[], labels: string[], input: GraphicsInput): void {
  const { width, height, start, end, layout } = input;
  const left = Math.round(width * 0.17);
  const y = Math.round(height * 0.42);
  const lockX = Math.round(width * 0.39);
  const lockWidth = Math.round(width * 0.17);
  const lockHeight = Math.round(height * 0.16);
  const keyX = Math.round(width * 0.66);
  const keyWidth = Math.round(width * 0.2);
  filters.push(
    box({
      x: lockX + Math.round(lockWidth * 0.19),
      y: y - Math.round(height * 0.08),
      w: Math.round(lockWidth * 0.62),
      h: Math.round(height * 0.19),
      color: MOTIF_CYAN,
      thickness: Math.max(5, Math.round(height * 0.007)),
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    box({
      x: lockX,
      y,
      w: lockWidth,
      h: lockHeight,
      color: PANEL_COLOR,
      thickness: Math.max(5, Math.round(height * 0.007)),
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    box({
      x: lockX + Math.round(lockWidth * 0.47),
      y: y + Math.round(lockHeight * 0.34),
      w: Math.max(6, Math.round(width * 0.009)),
      h: Math.round(lockHeight * 0.34),
      color: MOTIF_YELLOW,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    box({
      x: left,
      y: y + Math.round(lockHeight * 0.45),
      w: Math.round(width * 0.16),
      h: Math.max(6, Math.round(height * 0.008)),
      color: MOTIF_CORAL,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    box({
      x: keyX,
      y: y + Math.round(lockHeight * 0.45),
      w: keyWidth,
      h: Math.max(6, Math.round(height * 0.008)),
      color: MOTIF_CYAN,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    text({
      text: labels.find((label) => /TELEGRAM|GRAM|TON/u.test(label)) ?? "ДОСТУП",
      x: Math.round(width * 0.5),
      y: Math.round(height * 0.68),
      size: Math.round(height * 0.034),
      color: MOTIF_TEXT_COLOR,
      align: "center",
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    box({
      x: `${left}+mod((t-${start.toFixed(3)})*${Math.round(width * 0.35)},${Math.round(width * 0.66)})`,
      y: y + Math.round(lockHeight * 0.45) - Math.round(height * 0.016),
      w: Math.max(12, Math.round(height * 0.032)),
      h: Math.max(12, Math.round(height * 0.032)),
      color: MOTIF_YELLOW,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
  );
}

function addTransitionDiagram(filters: string[], labels: string[], input: GraphicsInput): void {
  const { width, height, start, end, layout } = input;
  const left = labels[0] ?? "ЭТАП 01";
  const right = labels.find((label) => label !== left) ?? "ЭТАП 02";
  const cardY = Math.round(height * 0.39);
  const cardHeight = Math.round(height * 0.19);
  const cardWidth = Math.round(width * 0.25);
  const leftX = Math.round(width * 0.16);
  const rightX = Math.round(width * 0.59);
  for (const [index, label] of [left, right].entries()) {
    const x = index === 0 ? leftX : rightX;
    filters.push(
      box({
        x,
        y: cardY,
        w: cardWidth,
        h: cardHeight,
        color: PANEL_COLOR,
        thickness: Math.max(5, Math.round(height * 0.006)),
        enable: `gte(t,${(start + index * 0.18).toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
      text({
        text: label,
        x: x + Math.round(cardWidth * 0.09),
        y: cardY + Math.round(cardHeight * 0.4),
        size: Math.min(Math.round(height * 0.034), Math.max(18, Math.floor(cardWidth * 0.12))),
        color: index === 0 ? MOTIF_CORAL : MOTIF_CYAN,
        enable: `gte(t,${(start + index * 0.18).toFixed(3)})*lt(t,${end.toFixed(3)})`,
      }),
    );
  }
  filters.push(
    box({
      x: leftX + cardWidth,
      y: cardY + Math.round(cardHeight * 0.48),
      w: Math.round(width * 0.18),
      h: Math.max(5, Math.round(height * 0.007)),
      color: MOTIF_CYAN,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
    box({
      x: `${leftX + cardWidth}+${Math.round(width * 0.18)}*min(max((t-${(start + 0.08).toFixed(3)})/0.7,0),1)`,
      y: cardY + Math.round(cardHeight * 0.4),
      w: Math.max(12, Math.round(height * 0.03)),
      h: Math.max(12, Math.round(height * 0.03)),
      color: MOTIF_YELLOW,
      enable: `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`,
    }),
  );
}

export function buildEthereumMotionSceneGraphics(input: GraphicsInput): string[] {
  const { width, height, start, end, layout, beat, motif } = input;
  const colors = ETHEREUM_MOTION_FFMPEG_COLORS;
  const active = `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`;
  const context = [
    beat.text,
    beat.visualDescription ?? "",
    input.motionEventDescription ?? "",
  ].join(" ");
  const labels = evidenceLabels(context);
  const reveal = `min(max((t-${start.toFixed(3)})/0.24,0),1)`;
  const panelX = Math.round(width * 0.055);
  const panelY = Math.round(height * 0.225);
  const panelWidth = Math.round(width * 0.89);
  const panelHeight = Math.round(height * 0.51);
  const filters = [
    box({ x: 0, y: 0, w: width, h: height, color: colors.background, enable: active }),
  ];

  for (let line = 1; line <= 8; line += 1) {
    const x = Math.round(width * line / 9);
    filters.push(box({
      x,
      y: Math.round(height * 0.18),
      w: Math.max(1, Math.round(width * 0.001)),
      h: Math.round(height * 0.58),
      color: `${colors.inactiveSecondary}@0.34`,
      enable: active,
    }));
  }
  for (let line = 1; line <= 4; line += 1) {
    const y = Math.round(height * (0.21 + line * 0.115));
    filters.push(box({
      x: Math.round(width * 0.05),
      y,
      w: Math.round(width * 0.9),
      h: Math.max(1, Math.round(height * 0.0015)),
      color: `${colors.inactiveSecondary}@0.3`,
      enable: active,
    }));
  }

  filters.push(
    text({
      text: `FINANCE LONG   /   ${SECTION_LABELS[motif]}`,
      x: Math.round(width * 0.07),
      y: Math.round(height * 0.075),
      size: Math.max(18, Math.round(height * 0.029)),
      color: colors.yellow,
      enable: active,
    }),
    box({
      x: Math.round(width * 0.07),
      y: Math.round(height * 0.125),
      w: `${Math.round(width * 0.86)}*${reveal}`,
      h: Math.max(3, Math.round(height * 0.004)),
      color: colors.cyan,
      enable: active,
    }),
    box({
      x: panelX,
      y: panelY,
      w: panelWidth,
      h: panelHeight,
      color: `${colors.inactive}@0.88`,
      enable: active,
    }),
    box({
      x: panelX,
      y: panelY,
      w: panelWidth,
      h: Math.max(4, Math.round(height * 0.006)),
      color: motif === "risk" ? colors.coral : colors.cyan,
      enable: active,
    }),
    box({
      x: panelX,
      y: panelY,
      w: panelWidth,
      h: panelHeight,
      color: `${colors.inactiveSecondary}@0.7`,
      thickness: Math.max(2, Math.round(height * 0.002)),
      enable: active,
    }),
  );

  if (motif === "network") {
    addNetworkDiagram(filters, labels, input);
  } else if (motif === "timeline") {
    addTimelineDiagram(filters, labels, input);
  } else if (motif === "risk") {
    addRiskDiagram(filters, labels, input);
  } else if (motif === "comparison") {
    addComparisonDiagram(filters, labels, input);
  } else if (motif === "record") {
    addRecordDiagram(filters, labels, input);
  } else if (motif === "market") {
    addMarketDiagram(filters, labels, input);
  } else if (motif === "access") {
    addAccessDiagram(filters, labels, input);
  } else if (motif === "morph") {
    addTransitionDiagram(filters, labels, input);
  } else if (motif === "particles") {
    addEvidenceCards(filters, labels, input, {
      x: Math.round(width * 0.11),
      y: Math.round(height * 0.41),
      width: Math.round(width * 0.78),
      height: Math.round(height * 0.16),
      max: 4,
    });
  } else {
    addAssetDiagram(filters, labels, input);
  }

  filters.push(
    box({
      x: panelX,
      y: panelY + panelHeight + Math.round(height * 0.035),
      w: `${panelWidth}*min(max((t-${(start + 0.12).toFixed(3)})/${Math.max(0.55, end - start - 0.2).toFixed(3)},0),1)`,
      h: Math.max(3, Math.round(height * 0.004)),
      color: layout % 2 === 0 ? colors.coral : colors.yellow,
      enable: active,
    }),
  );
  return filters;
}