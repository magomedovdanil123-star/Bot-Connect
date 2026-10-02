import { ETHEREUM_MOTION_FFMPEG_COLORS } from "./ethereum-motion-design";

export type EthereumMotionLegalStage =
  | "opening"
  | "filing"
  | "injunction"
  | "settlement"
  | "continuation"
  | "closure";

export type EthereumMotionLegalInput = {
  width: number;
  height: number;
  start: number;
  end: number;
  beatText: string;
  sceneDescription: string;
  motionEventDescription?: string;
  motionEventKind?: string;
};

const colors = ETHEREUM_MOTION_FFMPEG_COLORS;
const activeColor = colors.text;
const mutedColor = colors.inactiveSecondary;

function normalized(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

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

function drawText(input: {
  value: string;
  x: string | number;
  y: string | number;
  size: number;
  color: string;
  enable: string;
  align?: "left" | "center" | "right";
}): string {
  const x = input.align === "center"
    ? `${input.x}-text_w/2`
    : input.align === "right" ? `${input.x}-text_w` : input.x;
  return `drawtext=font='Montserrat ExtraBold':text='${escapedText(input.value)}'` +
    `:expansion=none:x=${expression(x)}:y=${expression(input.y)}` +
    `:fontsize=${input.size}:fontcolor=${input.color}:borderw=0` +
    `:shadowcolor=black@0.7:shadowx=3:shadowy=3:enable=${expression(input.enable)}`;
}

function hasLegalContext(input: EthereumMotionLegalInput): boolean {
  const context = normalized([
    input.beatText,
    input.sceneDescription,
    input.motionEventDescription ?? "",
  ].join(" "));
  return /юрид|судебн|(?<![\p{L}\p{N}])суд(?![\p{L}\p{N}])|(?<![\p{L}\p{N}])иск(?![\p{L}\p{N}])|sec\b|регулятор|незарегистрирован|ценн.{0,28}бумаг/u.test(context);
}

function stageFor(input: EthereumMotionLegalInput): EthereumMotionLegalStage {
  const speech = normalized(input.beatText);
  if (/урегулиров|штраф|вернут|вернуть|возврат|(?:1[,.]2).{0,24}(?:миллиард|млрд)|(?:18[,.]5).{0,24}(?:миллион|млн)/u.test(speech)) {
    return "settlement";
  }
  if (/заблокир|приостанов|временно.{0,48}передач|передач.{0,48}(?:суд|покупател|заблок)/u.test(speech)) {
    return "injunction";
  }
  if (/проект.{0,30}закрыт|не вышел.{0,32}рынок|в итог.{0,24}оригинальн.{0,24}gram/u.test(speech)) {
    return "closure";
  }
  if (/независим|продолжени|открыт.{0,24}сет/u.test(speech)) {
    return "continuation";
  }
  if (/20\d{2}|sec\b|комисси|ценн.{0,28}бумаг|регулятор|(?<![\p{L}\p{N}])иск(?![\p{L}\p{N}])/u.test(speech)) {
    return "filing";
  }

  switch (input.motionEventKind) {
    case "FINANCIAL_CHART":
      return "opening";
    case "TECHNICAL_GRID":
      return "filing";
    case "NODE_SYSTEM":
    case "DATA_FLOW":
      return "injunction";
    case "PARTICLE_FLOW":
      return "settlement";
    case "MORPH_TRANSITION":
      return "closure";
    default:
      return "opening";
  }
}

function subjectLabel(context: string): string {
  const subject = context.match(/\b(?:telegram|gram|ton|ethereum|solana|aptos|sui)\b/iu)?.[0];
  return subject?.toLocaleUpperCase("en-US") ?? "ПРОЕКТ";
}

function stageHeader(stage: EthereumMotionLegalStage): string {
  switch (stage) {
    case "opening": return "ПЕРЕЛОМНЫЙ МОМЕНТ";
    case "filing": return "ПОДАН ИСК";
    case "injunction": return "РЕШЕНИЕ СУДА";
    case "settlement": return "УРЕГУЛИРОВАНИЕ";
    case "continuation": return "НЕЗАВИСИМОЕ ПРОДОЛЖЕНИЕ";
    case "closure": return "ПРОЕКТ ЗАКРЫТ";
  }
}

function fittedTextSize(value: string, requested: number, maxWidth: number): number {
  return Math.min(requested, Math.max(18, Math.floor(maxWidth / (Math.max(1, value.length) * 0.66))));
}

function renderOpening(
  filters: string[],
  input: EthereumMotionLegalInput,
  subject: string,
  active: string,
): void {
  const { width, height, start, end } = input;
  const reveal = `min(max((t-${start.toFixed(3)})/0.36,0),1)`;
  filters.push(
    box({
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.27),
      w: `${Math.max(9, Math.round(width * 0.01))}*${reveal}`,
      h: Math.round(height * 0.44),
      color: colors.coral,
      enable: active,
    }),
    drawText({
      value: "ПЕРЕЛОМНЫЙ МОМЕНТ",
      x: Math.round(width * 0.125),
      y: Math.round(height * 0.30),
      size: fittedTextSize("ПЕРЕЛОМНЫЙ МОМЕНТ", Math.round(height * 0.095), Math.round(width * 0.73)),
      color: colors.coral,
      enable: active,
    }),
    drawText({
      value: "СУДЬБА ПРОЕКТА",
      x: Math.round(width * 0.125),
      y: Math.round(height * 0.43),
      size: fittedTextSize("СУДЬБА ПРОЕКТА", Math.round(height * 0.13), Math.round(width * 0.73)),
      color: activeColor,
      enable: active,
    }),
    drawText({
      value: subject,
      x: Math.round(width * 0.13),
      y: Math.round(height * 0.61),
      size: fittedTextSize(subject, Math.round(height * 0.084), Math.round(width * 0.73)),
      color: colors.yellow,
      enable: active,
    }),
    drawText({
      value: "ИНВЕСТОРЫ  •  СУД  •  TELEGRAM",
      x: Math.round(width * 0.13),
      y: Math.round(height * 0.71),
      size: fittedTextSize("ИНВЕСТОРЫ  •  СУД  •  TELEGRAM", Math.round(height * 0.036), Math.round(width * 0.72)),
      color: colors.cyan,
      enable: active,
    }),
    box({
      x: Math.round(width * 0.125),
      y: Math.round(height * 0.79),
      w: `${Math.round(width * 0.7)}*${reveal}`,
      h: Math.max(7, Math.round(height * 0.01)),
      color: colors.cyan,
      enable: active,
    }),
    box({
      x: `${Math.round(width * 0.125)}+${Math.round(width * 0.7)}*min(max((t-${(start + 0.08).toFixed(3)})/${Math.max(0.45, end - start - 0.1).toFixed(3)},0),1)`,
      y: Math.round(height * 0.79) - Math.round(height * 0.02),
      w: Math.round(height * 0.04),
      h: Math.round(height * 0.05),
      color: colors.yellow,
      enable: active,
    }),
  );
}

function renderFiling(
  filters: string[],
  input: EthereumMotionLegalInput,
  subject: string,
  active: string,
): void {
  const { width, height, start, end } = input;
  const context = normalized(`${input.beatText} ${input.sceneDescription} ${input.motionEventDescription ?? ""}`);
  const authority = /\bsec\b/u.test(context) ? "SEC" : /комисси/u.test(context) ? "КОМИССИЯ" : "РЕГУЛЯТОР";
  const authorityFontSize = Math.round(height * (authority === "SEC" ? 0.16 : 0.09));
  const year = input.beatText.match(/\b20\d{2}\b/u)?.[0]
    ?? input.sceneDescription.match(/\b20\d{2}\b/u)?.[0]
    ?? "ДЕЛО";
  const stampX = Math.round(width * 0.08);
  const stampY = Math.round(height * 0.25);
  const stampWidth = Math.round(width * 0.34);
  const stampHeight = Math.round(height * 0.48);
  const reveal = `min(max((t-${(start + 0.12).toFixed(3)})/0.32,0),1)`;
  filters.push(
    box({
      x: stampX,
      y: stampY,
      w: stampWidth,
      h: stampHeight,
      color: `${colors.inactive}@0.42`,
      thickness: Math.max(6, Math.round(height * 0.008)),
      enable: active,
    }),
    box({
      x: stampX,
      y: stampY,
      w: `${stampWidth}*${reveal}`,
      h: Math.max(9, Math.round(height * 0.014)),
      color: colors.coral,
      enable: active,
    }),
    drawText({
      value: authority,
      x: stampX + Math.round(stampWidth * 0.5),
      y: stampY + Math.round(stampHeight * 0.26),
      size: fittedTextSize(authority, authorityFontSize, Math.round(stampWidth * 0.82)),
      color: colors.coral,
      enable: active,
      align: "center",
    }),
    drawText({
      value: year,
      x: stampX + Math.round(stampWidth * 0.5),
      y: stampY + Math.round(stampHeight * 0.64),
      size: Math.round(height * 0.08),
      color: colors.yellow,
      enable: active,
      align: "center",
    }),
    drawText({
      value: "ИСК ПРОТИВ",
      x: Math.round(width * 0.53),
      y: Math.round(height * 0.29),
      size: Math.round(height * 0.075),
      color: activeColor,
      enable: active,
    }),
    drawText({
      value: subject,
      x: Math.round(width * 0.53),
      y: Math.round(height * 0.405),
      size: fittedTextSize(subject, Math.round(height * 0.155), Math.round(width * 0.39)),
      color: colors.cyan,
      enable: active,
    }),
    drawText({
      value: "ПРЕДЛОЖЕНИЕ ЦЕННЫХ БУМАГ",
      x: Math.round(width * 0.535),
      y: Math.round(height * 0.61),
      size: Math.round(height * 0.039),
      color: colors.yellow,
      enable: active,
    }),
    box({
      x: `${Math.round(width * 0.43)}+min(max((t-${start.toFixed(3)})*${Math.round(width * 0.23)},0),${Math.round(width * 0.09)})`,
      y: Math.round(height * 0.49),
      w: Math.max(12, Math.round(height * 0.025)),
      h: Math.max(12, Math.round(height * 0.025)),
      color: colors.yellow,
      enable: active,
    }),
  );
}

function renderInjunction(
  filters: string[],
  input: EthereumMotionLegalInput,
  subject: string,
  active: string,
): void {
  const { width, height, start, end } = input;
  const barrierX = Math.round(width * 0.515);
  const barrierY = Math.round(height * 0.25);
  const barrierHeight = Math.round(height * 0.47);
  filters.push(
    drawText({
      value: "ПРОЕКТ",
      x: Math.round(width * 0.09),
      y: Math.round(height * 0.265),
      size: Math.round(height * 0.04),
      color: colors.yellow,
      enable: active,
    }),
    drawText({
      value: subject,
      x: Math.round(width * 0.09),
      y: Math.round(height * 0.34),
      size: Math.round(height * 0.175),
      color: colors.cyan,
      enable: active,
    }),
    drawText({
      value: "ПЕРЕДАЧА",
      x: Math.round(width * 0.09),
      y: Math.round(height * 0.59),
      size: Math.round(height * 0.064),
      color: activeColor,
      enable: active,
    }),
    box({
      x: barrierX,
      y: barrierY,
      w: Math.max(18, Math.round(width * 0.018)),
      h: barrierHeight,
      color: colors.coral,
      enable: active,
    }),
    box({
      x: barrierX + Math.round(width * 0.027),
      y: barrierY + Math.round(height * 0.055),
      w: Math.max(10, Math.round(width * 0.009)),
      h: barrierHeight - Math.round(height * 0.11),
      color: `${colors.yellow}@0.76`,
      enable: active,
    }),
    drawText({
      value: "×",
      x: barrierX - Math.round(width * 0.04),
      y: Math.round(height * 0.25),
      size: Math.round(height * 0.35),
      color: colors.coral,
      enable: active,
      align: "center",
    }),
    drawText({
      value: "СУД",
      x: Math.round(width * 0.63),
      y: Math.round(height * 0.25),
      size: Math.round(height * 0.11),
      color: colors.yellow,
      enable: active,
    }),
    drawText({
      value: "ВРЕМЕННО",
      x: Math.round(width * 0.63),
      y: Math.round(height * 0.43),
      size: Math.round(height * 0.062),
      color: activeColor,
      enable: active,
    }),
    drawText({
      value: "ЗАБЛОКИРОВАНА",
      x: Math.round(width * 0.63),
      y: Math.round(height * 0.52),
      size: Math.round(height * 0.059),
      color: colors.coral,
      enable: active,
    }),
    drawText({
      value: "ДЛЯ ПОКУПАТЕЛЕЙ",
      x: Math.round(width * 0.63),
      y: Math.round(height * 0.64),
      size: Math.round(height * 0.037),
      color: activeColor,
      enable: active,
    }),
  );

  for (let token = 0; token < 4; token += 1) {
    const delay = (start + token * 0.14).toFixed(3);
    const y = Math.round(height * (0.36 + token * 0.082));
    filters.push(box({
      x: `${Math.round(width * 0.17)}+min(max((t-${delay})*${Math.round(width * 0.42)},0),${Math.round(width * 0.3)})`,
      y,
      w: Math.max(8, Math.round(height * 0.018)),
      h: Math.max(8, Math.round(height * 0.018)),
      color: token % 2 === 0 ? colors.cyan : colors.yellow,
      enable: `gte(t,${delay})*lt(t,${end.toFixed(3)})`,
    }));
  }
}

function renderSettlement(
  filters: string[],
  input: EthereumMotionLegalInput,
  active: string,
): void {
  const { width, height, start } = input;
  const speech = normalized(input.beatText);
  const hasRefundAmount = /1[,.]2/u.test(speech);
  const hasFineAmount = /18[,.]5/u.test(speech);
  const dividerX = Math.round(width * 0.61);
  filters.push(
    drawText({
      value: "ВОЗВРАТ ИНВЕСТОРАМ",
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.255),
      size: Math.round(height * 0.046),
      color: colors.cyan,
      enable: active,
    }),
    drawText({
      value: hasRefundAmount ? "БОЛЕЕ" : "СУММА ВОЗВРАТА",
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.37),
      size: Math.round(height * 0.052),
      color: hasRefundAmount ? colors.cyan : activeColor,
      enable: active,
    }),
    drawText({
      value: hasRefundAmount ? "$1,2" : "ВОЗВРАТ",
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.43),
      size: Math.round(height * (hasRefundAmount ? 0.2 : 0.12)),
      color: activeColor,
      enable: active,
    }),
    drawText({
      value: hasRefundAmount ? "МЛРД" : "ИНВЕСТОРАМ",
      x: Math.round(width * 0.09),
      y: Math.round(height * 0.66),
      size: Math.round(height * 0.066),
      color: colors.yellow,
      enable: active,
    }),
    box({
      x: dividerX,
      y: Math.round(height * 0.25),
      w: Math.max(6, Math.round(width * 0.006)),
      h: Math.round(height * 0.5),
      color: colors.coral,
      enable: active,
    }),
    drawText({
      value: "ШТРАФ",
      x: Math.round(width * 0.68),
      y: Math.round(height * 0.30),
      size: Math.round(height * 0.058),
      color: colors.coral,
      enable: active,
    }),
    drawText({
      value: hasFineAmount ? "18,5" : "СУДЕБНЫЙ",
      x: Math.round(width * 0.68),
      y: Math.round(height * 0.41),
      size: Math.round(height * (hasFineAmount ? 0.15 : 0.085)),
      color: activeColor,
      enable: active,
    }),
    drawText({
      value: hasFineAmount ? "МЛН $" : "ПЛАТЁЖ",
      x: Math.round(width * 0.69),
      y: Math.round(height * 0.62),
      size: Math.round(height * 0.064),
      color: colors.yellow,
      enable: active,
    }),
  );

  const reveal = `min(max((t-${(start + 0.16).toFixed(3)})/0.6,0),1)`;
  for (let bar = 0; bar < 5; bar += 1) {
    const x = Math.round(width * (0.13 + bar * 0.07));
    const barHeight = Math.round(height * (0.08 + (bar % 3) * 0.035));
    filters.push(box({
      x,
      y: `${Math.round(height * 0.79)}-${barHeight}*${reveal}`,
      w: Math.max(8, Math.round(width * 0.025)),
      h: `${barHeight}*${reveal}`,
      color: bar % 2 ? colors.cyan : colors.yellow,
      enable: active,
    }));
  }
}

function renderContinuation(
  filters: string[],
  input: EthereumMotionLegalInput,
  active: string,
): void {
  const { width, height, start, end } = input;
  const lineY = Math.round(height * 0.54);
  const lineWidth = Math.round(width * 0.7);
  const lineX = Math.round(width * 0.15);
  const reveal = `min(max((t-${(start + 0.12).toFixed(3)})/0.56,0),1)`;
  filters.push(
    drawText({
      value: "TELEGRAM",
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.34),
      size: Math.round(height * 0.075),
      color: colors.coral,
      enable: active,
    }),
    drawText({
      value: "TON",
      x: Math.round(width * 0.59),
      y: Math.round(height * 0.29),
      size: Math.round(height * 0.22),
      color: colors.cyan,
      enable: active,
    }),
    drawText({
      value: "НЕЗАВИСИМОЕ ПРОДОЛЖЕНИЕ",
      x: Math.round(width * 0.59),
      y: Math.round(height * 0.57),
      size: Math.round(height * 0.045),
      color: activeColor,
      enable: active,
    }),
    box({
      x: lineX,
      y: lineY,
      w: `${lineWidth}*${reveal}`,
      h: Math.max(7, Math.round(height * 0.01)),
      color: colors.cyan,
      enable: active,
    }),
  );
  for (let branch = 0; branch < 4; branch += 1) {
    const branchY = Math.round(height * (0.29 + branch * 0.12));
    const branchStart = (start + 0.18 + branch * 0.11).toFixed(3);
    filters.push(
      box({
        x: Math.round(width * 0.34),
        y: branchY,
        w: `${Math.round(width * 0.18)}*min(max((t-${branchStart})/0.32,0),1)`,
        h: Math.max(4, Math.round(height * 0.006)),
        color: branch % 2 ? colors.yellow : colors.coral,
        enable: `gte(t,${branchStart})*lt(t,${end.toFixed(3)})`,
      }),
      box({
        x: `${Math.round(width * 0.5)}+min(max((t-${branchStart})*${Math.round(width * 0.18)},0),${Math.round(width * 0.18)})`,
        y: branchY - Math.round(height * 0.012),
        w: Math.max(10, Math.round(height * 0.024)),
        h: Math.max(10, Math.round(height * 0.024)),
        color: colors.yellow,
        enable: `gte(t,${branchStart})*lt(t,${end.toFixed(3)})`,
      }),
    );
  }
}

function renderClosure(
  filters: string[],
  input: EthereumMotionLegalInput,
  subject: string,
  active: string,
): void {
  const { width, height, start } = input;
  const reveal = `min(max((t-${(start + 0.16).toFixed(3)})/0.42,0),1)`;
  filters.push(
    drawText({
      value: "ОРИГИНАЛЬНЫЙ ПРОЕКТ",
      x: Math.round(width * 0.09),
      y: Math.round(height * 0.27),
      size: Math.round(height * 0.043),
      color: activeColor,
      enable: active,
    }),
    drawText({
      value: subject,
      x: Math.round(width * 0.09),
      y: Math.round(height * 0.35),
      size: fittedTextSize(subject, Math.round(height * 0.19), Math.round(width * 0.39)),
      color: colors.cyan,
      enable: active,
    }),
    box({
      x: Math.round(width * 0.085),
      y: Math.round(height * 0.55),
      w: `${Math.round(width * 0.38)}*${reveal}`,
      h: Math.max(10, Math.round(height * 0.014)),
      color: colors.coral,
      enable: active,
    }),
    drawText({
      value: "НЕ ВЫШЕЛ",
      x: Math.round(width * 0.57),
      y: Math.round(height * 0.34),
      size: Math.round(height * 0.091),
      color: colors.coral,
      enable: active,
    }),
    drawText({
      value: "НА РЫНОК",
      x: Math.round(width * 0.57),
      y: Math.round(height * 0.47),
      size: Math.round(height * 0.091),
      color: activeColor,
      enable: active,
    }),
    drawText({
      value: "ПРОЕКТ ЗАКРЫТ",
      x: Math.round(width * 0.09),
      y: Math.round(height * 0.65),
      size: Math.round(height * 0.07),
      color: colors.yellow,
      enable: active,
    }),
    box({
      x: Math.round(width * 0.09),
      y: Math.round(height * 0.76),
      w: `${Math.round(width * 0.78)}*${reveal}`,
      h: Math.max(5, Math.round(height * 0.007)),
      color: colors.cyan,
      enable: active,
    }),
  );
}

export function buildEthereumMotionLegalSceneGraphics(
  input: EthereumMotionLegalInput,
): string[] | null {
  if (!hasLegalContext(input)) return null;

  const { width, height, start, end } = input;
  const context = normalized([
    input.beatText,
    input.sceneDescription,
    input.motionEventDescription ?? "",
  ].join(" "));
  const stage = stageFor(input);
  const subject = subjectLabel(context);
  const active = `gte(t,${start.toFixed(3)})*lt(t,${end.toFixed(3)})`;
  const reveal = `min(max((t-${start.toFixed(3)})/0.28,0),1)`;
  const title = /sec\b/u.test(context) ? "GRAM  /  ДЕЛО SEC" : "ЮРИДИЧЕСКИЙ КЕЙС";
  const filters = [
    box({ x: 0, y: 0, w: width, h: height, color: colors.background, enable: active }),
    drawText({
      value: `FINANCE LONG   /   ${title}`,
      x: Math.round(width * 0.075),
      y: Math.round(height * 0.073),
      size: Math.max(22, Math.round(height * 0.03)),
      color: colors.yellow,
      enable: active,
    }),
    box({
      x: Math.round(width * 0.075),
      y: Math.round(height * 0.123),
      w: `${Math.round(width * 0.85)}*${reveal}`,
      h: Math.max(4, Math.round(height * 0.005)),
      color: colors.cyan,
      enable: active,
    }),
  ];

  switch (stage) {
    case "opening":
      renderOpening(filters, input, subject, active);
      break;
    case "filing":
      renderFiling(filters, input, subject, active);
      break;
    case "injunction":
      renderInjunction(filters, input, subject, active);
      break;
    case "settlement":
      renderSettlement(filters, input, active);
      break;
    case "continuation":
      renderContinuation(filters, input, active);
      break;
    case "closure":
      renderClosure(filters, input, "GRAM", active);
      break;
  }
  filters.push(drawText({
    value: stageHeader(stage),
    x: Math.round(width * 0.92),
    y: Math.round(height * 0.17),
    size: Math.round(height * 0.032),
    color: colors.cyan,
    enable: active,
    align: "right",
  }));
  return filters;
}