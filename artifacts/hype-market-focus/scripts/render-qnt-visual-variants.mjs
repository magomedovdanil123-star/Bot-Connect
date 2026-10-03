import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..');
const SOURCE = path.join(ROOT, 'exports', 'qnt-24h-market-preview.mp4');
const OUTPUT_DIR = path.join(ROOT, 'exports', 'qnt-visual-variants');
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const SCRIPT_DURATION = 39.21;
const FRAME_COUNT = Math.ceil(SCRIPT_DURATION * FPS);
const OUTPUT_DURATION = FRAME_COUNT / FPS;

const MARKET = {
  open: 103.04,
  close: 180.06,
  high: 194.95,
  low: 102.78,
  changePct: 74.7,
  quoteVolume: 86_190_793.07445,
  averageDailyVolume7d: 7_971_718.190658571,
  btcChangePct: 0.7,
  ethChangePct: 0.9,
  hourly: [
    [103.04, 108.00, 102.78, 107.79, 548661.21766],
    [107.79, 110.00, 106.25, 106.36, 836812.07845],
    [106.31, 106.87, 103.64, 104.63, 371275.26572],
    [104.59, 105.60, 103.24, 103.58, 345746.90279],
    [103.72, 107.41, 103.38, 106.17, 274510.20332],
    [106.10, 111.74, 105.93, 110.70, 975183.65584],
    [110.71, 119.91, 109.42, 116.03, 2313537.96157],
    [115.93, 123.81, 114.42, 123.17, 2658465.80014],
    [123.14, 124.61, 120.98, 123.72, 1443178.94270],
    [123.68, 125.00, 119.08, 119.75, 1184968.93920],
    [119.75, 124.32, 119.75, 122.76, 830826.77184],
    [122.74, 123.05, 118.77, 121.20, 744849.35801],
    [121.19, 124.25, 120.19, 122.31, 798249.65298],
    [122.22, 145.38, 122.17, 143.29, 4934851.19727],
    [143.34, 161.00, 138.51, 151.52, 7897834.82626],
    [151.60, 164.98, 148.44, 161.28, 4471059.06341],
    [161.36, 194.95, 159.41, 181.72, 11870645.60167],
    [181.70, 183.52, 162.40, 171.60, 9650139.59067],
    [171.39, 176.40, 167.24, 173.28, 4692452.90877],
    [173.38, 192.00, 171.12, 188.95, 6886960.02682],
    [188.92, 194.07, 170.03, 170.57, 7471345.94408],
    [170.59, 181.97, 169.17, 174.54, 5957584.68825],
    [174.67, 180.33, 167.67, 169.95, 4756412.31645],
    [170.16, 182.80, 168.08, 180.06, 4275240.16058],
  ],
};

const SEGMENTS = [
  {
    key: 'hook',
    start: 0,
    end: 6.90,
    title: 'QNT / ИМПУЛЬС',
    caption: 'QNT на Binance Spot: плюс 74,7 процента за 24 закрытых часа.',
  },
  {
    key: 'candles',
    start: 6.90,
    end: 13.71,
    title: '24 ЧАСА · ЯПОНСКИЕ СВЕЧИ',
    caption: 'От $103 до $180. Сейчас цена на 7,6 процента ниже пика.',
  },
  {
    key: 'volume',
    start: 13.71,
    end: 20.53,
    title: 'ОБЪЁМ · ПОДТВЕРЖДЕНИЕ?',
    caption: 'Объём — $86 млн, почти в 11 раз выше недельного среднего. Это не гарантия спроса.',
  },
  {
    key: 'news',
    start: 20.53,
    end: 27.14,
    title: 'ВОЗМОЖНЫЙ НОВОСТНОЙ ФОН',
    caption: 'Quant сообщила об инициативе с The Clearing House. Причина роста и роль QNT не доказаны.',
  },
  {
    key: 'comparison',
    start: 27.14,
    end: 33.15,
    title: 'ТОТ ЖЕ ПЕРИОД',
    caption: 'Биткоин прибавил 0,7 процента, эфир — 0,9. QNT заметно волатильнее.',
  },
  {
    key: 'outlook',
    start: 33.15,
    end: 39.21,
    title: 'ИМПУЛЬС — НЕ ГАРАНТИЯ',
    caption: 'Импульс сильный, но заметны откат и аномальный объём. Причина не доказана, волатильность высока. Не инвестиционная рекомендация.',
  },
];

const VARIANTS = [
  {
    id: '01-impact',
    name: 'Impact — ударный редакционный монтаж',
    concept: 'Крупные цифры, экстремальные макро-приближения графика и жёсткие диагональные матч-каты.',
    colors: { bg: '#080b0b', bg2: '#131917', ink: '#f4f5ef', muted: '#9da8a1', accent: '#d7ff38', secondary: '#69d9bd', risk: '#ff6559', grid: '#34413b' },
  },
  {
    id: '02-dossier',
    name: 'Dossier — редакционная бумажная вырезка',
    concept: 'Светлая бумажная основа, карточки-доказательства, штампы и подчёркивания; переходы как перелистывание дела.',
    colors: { bg: '#e8e2d4', bg2: '#f4efe5', ink: '#20221f', muted: '#64665f', accent: '#c64f37', secondary: '#326c78', risk: '#ad342c', grid: '#c7bead' },
  },
  {
    id: '03-orbit',
    name: 'Orbit — пространственная аналитическая камера',
    concept: 'Тёмная бирюзово-синяя лаборатория, концентрические измерительные кольца и движение камеры между слоями данных.',
    colors: { bg: '#06111b', bg2: '#0b2030', ink: '#e6f5f4', muted: '#8ba9b4', accent: '#4ff0cf', secondary: '#80a9ff', risk: '#ff726a', grid: '#214153' },
  },
  {
    id: '04-collage',
    name: 'Collage — быстрый монтаж рыночной ленты',
    concept: 'Кобальтовые и тёплые цветовые поля, разрезанный экран, тикерная полоса и собранные из блоков графические коллажи.',
    colors: { bg: '#10111a', bg2: '#17253d', ink: '#fbf3e5', muted: '#b0b8c2', accent: '#ffbd45', secondary: '#58a9ff', risk: '#ff665f', grid: '#33435c' },
  },
  {
    id: '05-type',
    name: 'Type — типографика как главный объект',
    concept: 'Светлое поле, чёрные слова и огромные числа; цифры становятся масками и геометрией переходов, график предельно точечный.',
    colors: { bg: '#f1efe9', bg2: '#fffdf8', ink: '#171918', muted: '#646761', accent: '#e74832', secondary: '#335d9b', risk: '#c83227', grid: '#d5d2c9' },
  },
];

const volumeMultiple = MARKET.quoteVolume / MARKET.averageDailyVolume7d;
const drawdownPct = (1 - MARKET.close / MARKET.high) * 100;

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function ease(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrap(value, maxChars = 39) {
  const lines = [];
  let line = '';
  for (const word of value.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function tx(x, y, value, options = {}) {
  const {
    size = 30,
    fill = '#fff',
    weight = 600,
    anchor = 'start',
    family = 'DejaVu Sans, sans-serif',
    spacing = 0,
    opacity = 1,
    transform = '',
  } = options;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}px" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}px" opacity="${opacity}"${transform ? ` transform="${transform}"` : ''}>${esc(value)}</text>`;
}

function multiline(x, y, value, options = {}) {
  const lines = Array.isArray(value) ? value : wrap(value, options.maxChars ?? 28);
  const lineHeight = options.lineHeight ?? 48;
  return `<text x="${x}" y="${y}" fill="${options.fill ?? '#fff'}" font-family="${options.family ?? 'DejaVu Sans, sans-serif'}" font-size="${options.size ?? 36}px" font-weight="${options.weight ?? 600}" text-anchor="${options.anchor ?? 'start'}" letter-spacing="${options.spacing ?? 0}px">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${esc(line)}</tspan>`)
    .join('')}</text>`;
}

function rect(x, y, width, height, fill, options = {}) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${options.rx ?? 0}" fill="${fill}"${options.stroke ? ` stroke="${options.stroke}"` : ''}${options.strokeWidth ? ` stroke-width="${options.strokeWidth}"` : ''}${options.opacity !== undefined ? ` opacity="${options.opacity}"` : ''}${options.transform ? ` transform="${options.transform}"` : ''}/>`;
}

function line(x1, y1, x2, y2, color, width = 2, options = {}) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"${options.opacity !== undefined ? ` opacity="${options.opacity}"` : ''}${options.dash ? ` stroke-dasharray="${options.dash}"` : ''}${options.transform ? ` transform="${options.transform}"` : ''}/>`;
}

function circle(cx, cy, radius, fill, options = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}"${options.stroke ? ` stroke="${options.stroke}"` : ''}${options.strokeWidth ? ` stroke-width="${options.strokeWidth}"` : ''}${options.opacity !== undefined ? ` opacity="${options.opacity}"` : ''}${options.dash ? ` stroke-dasharray="${options.dash}"` : ''}/>`;
}

function candlesSvg(x, y, width, height, relativeTime, color, riskColor, options = {}) {
  const min = 95;
  const max = 202;
  const yOf = (price) => y + height - ((price - min) / (max - min)) * height;
  const reveal = clamp(relativeTime / (options.revealSeconds ?? 3.2));
  const visible = Math.min(MARKET.hourly.length, Math.ceil(reveal * MARKET.hourly.length));
  const slot = width / MARKET.hourly.length;
  const candleWidth = Math.max(9, slot * (options.candleWidthFactor ?? 0.5));
  let output = '';

  for (const level of [100, 125, 150, 175, 200]) {
    const yy = yOf(level);
    output += line(x, yy, x + width, yy, options.grid ?? '#34413b', 1.5, { opacity: 0.7 });
    if (options.priceLabels !== false) {
      output += tx(x - 12, yy + 7, `$${level}`, { size: 18, fill: options.muted ?? '#9da8a1', anchor: 'end', family: 'DejaVu Sans Mono, monospace', weight: 500 });
    }
  }
  for (let index = 0; index < visible; index += 1) {
    const [open, high, low, close] = MARKET.hourly[index];
    const cx = x + slot * (index + 0.5);
    const yyHigh = yOf(high);
    const yyLow = yOf(low);
    const yyOpen = yOf(open);
    const yyClose = yOf(close);
    const candleColor = close >= open ? color : riskColor;
    const bodyY = Math.min(yyOpen, yyClose);
    const bodyHeight = Math.max(4, Math.abs(yyOpen - yyClose));
    const opacity = clamp((relativeTime - index * 0.045) / 0.2);
    output += `<g opacity="${opacity}">${line(cx, yyHigh, cx, yyLow, candleColor, options.wickWidth ?? 3)}${rect(cx - candleWidth / 2, bodyY, candleWidth, bodyHeight, candleColor, { rx: 2 })}</g>`;
  }

  const currentY = yOf(MARKET.close);
  const highY = yOf(MARKET.high);
  const markerOpacity = ease((relativeTime - 2.15) / 0.35);
  output += line(x, currentY, x + width, currentY, color, 2, { opacity: markerOpacity, dash: '9 10' });
  output += circle(x + width - 10, highY, 8, riskColor, { opacity: markerOpacity });
  if (options.labels !== false) {
    output += tx(x + width, currentY - 14, '$180,06', { size: 20, fill: color, anchor: 'end', weight: 700, family: 'DejaVu Sans Mono, monospace', opacity: markerOpacity });
    output += tx(x + width, highY - 16, 'ПИК $194,95', { size: 18, fill: riskColor, anchor: 'end', weight: 700, opacity: markerOpacity });
  }
  return output;
}

function volumeSvg(x, y, width, height, relativeTime, color, riskColor, grid, options = {}) {
  const max = Math.max(...MARKET.hourly.map((item) => item[4]));
  const reveal = clamp(relativeTime / (options.revealSeconds ?? 2.7));
  const count = Math.min(MARKET.hourly.length, Math.ceil(reveal * MARKET.hourly.length));
  const slot = width / MARKET.hourly.length;
  let output = '';
  for (const index of [0, 0.5, 1]) {
    output += line(x, y + height * index, x + width, y + height * index, grid, 1.5, { opacity: 0.7 });
  }
  for (let index = 0; index < count; index += 1) {
    const [open, , , close, volume] = MARKET.hourly[index];
    const h = Math.max(4, (volume / max) * height);
    const fill = close >= open ? color : riskColor;
    const alpha = clamp((relativeTime - index * 0.04) / 0.18);
    output += rect(x + slot * index + slot * 0.18, y + height - h, slot * 0.62, h, fill, { rx: 3, opacity: 0.86 * alpha });
  }
  const avgY = y + height - (MARKET.averageDailyVolume7d / max) * height;
  output += line(x, avgY, x + width, avgY, options.secondary ?? '#80a9ff', 3, { dash: '12 12', opacity: 0.92 });
  return output;
}

function impactHourlyVolumeProfileSvg(x, y, width, height, relativeTime, color, grid) {
  const max = Math.max(...MARKET.hourly.map((item) => item[4]));
  const slot = width / MARKET.hourly.length;
  let output = '';
  for (const ratio of [0, 0.5, 1]) {
    output += line(x, y + height * ratio, x + width, y + height * ratio, grid, 1.5, { opacity: 0.62 });
  }
  for (let index = 0; index < MARKET.hourly.length; index += 1) {
    const volume = MARKET.hourly[index][4];
    const barHeight = Math.max(4, (volume / max) * height);
    const alpha = clamp((relativeTime - index * 0.035) / 0.2);
    output += rect(
      x + slot * index + slot * 0.18,
      y + height - barHeight,
      slot * 0.64,
      barHeight,
      color,
      { rx: 2, opacity: 0.86 * alpha },
    );
  }
  return output;
}

function chartRibbon(style, segment, sceneIndex, t, globalTime) {
  const C = style.colors;
  switch (style.id) {
    case '01-impact': {
      const x = -300 + ((globalTime * 255) % 1600);
      return `
        ${line(64, 105, 1016, 105, C.grid, 2)}
        ${rect(64, 105, 952 * (globalTime / OUTPUT_DURATION), 3, C.accent)}
        ${tx(66, 76, 'QNT / 24H SNAPSHOT', { size: 21, fill: C.muted, weight: 700, spacing: 2 })}
        ${tx(1014, 76, '27.09.2026 UTC', { size: 20, fill: C.muted, anchor: 'end', weight: 600, family: 'DejaVu Sans Mono, monospace' })}
        ${rect(x, 127, 230, 5, C.accent, { opacity: 0.24 })}
      `;
    }
    case '02-dossier':
      return `
        ${rect(54, 48, 972, 92, '#f7f2e8', { rx: 6, stroke: '#c7bead', strokeWidth: 2 })}
        ${tx(82, 88, 'MARKET EVIDENCE / QNT', { size: 18, fill: C.muted, weight: 700, spacing: 2 })}
        ${tx(82, 119, segment.title, { size: 23, fill: C.ink, weight: 800, spacing: 1 })}
        ${tx(998, 106, `${String(sceneIndex + 1).padStart(2, '0')} / 06`, { size: 18, fill: C.accent, anchor: 'end', weight: 800, family: 'DejaVu Sans Mono, monospace' })}
        ${rect(54, 153, 972 * (globalTime / OUTPUT_DURATION), 4, C.accent)}
      `;
    case '03-orbit': {
      const rotation = globalTime * 11;
      return `
        ${circle(540, 88, 37 + Math.sin(t * 2) * 3, 'none', { stroke: C.accent, strokeWidth: 2, opacity: 0.8, dash: '42 18' })}
        <g transform="rotate(${rotation} 540 88)">${circle(540, 88, 52, 'none', { stroke: C.secondary, strokeWidth: 1, opacity: 0.48, dash: '3 12' })}</g>
        ${tx(78, 96, 'QNT / MARKET SIGNAL', { size: 20, fill: C.muted, weight: 700, spacing: 2 })}
        ${tx(1002, 96, `T−${Math.max(0, Math.ceil(OUTPUT_DURATION - globalTime)).toString().padStart(2, '0')}s`, { size: 19, fill: C.accent, anchor: 'end', family: 'DejaVu Sans Mono, monospace', weight: 700 })}
        ${tx(540, 168, segment.title, { size: 22, fill: C.ink, anchor: 'middle', weight: 700, spacing: 1 })}
      `;
    }
    case '04-collage': {
      const move = (globalTime * 130) % 1080;
      return `
        ${rect(0, 0, WIDTH, 140, C.secondary)}
        ${tx(42 - move, 56, 'QNT  +74,7%  /  BINANCE SPOT  /  24H  /  HISTORICAL DATA  /  ', { size: 25, fill: '#10111a', weight: 900, spacing: 1 })}
        ${tx(42 - move + 1080, 56, 'QNT  +74,7%  /  BINANCE SPOT  /  24H  /  HISTORICAL DATA  /  ', { size: 25, fill: '#10111a', weight: 900, spacing: 1 })}
        ${rect(0, 76, 36, 64, C.accent)}
        ${tx(70, 119, segment.title, { size: 21, fill: C.ink, weight: 900, spacing: 1 })}
        ${tx(1010, 119, `0${sceneIndex + 1}`, { size: 30, fill: C.ink, anchor: 'end', family: 'DejaVu Sans Mono, monospace', weight: 900 })}
      `;
    }
    default: {
      const word = ['ДВИЖЕНИЕ', 'ЦЕНА', 'ОБОРОТ', 'КОНТЕКСТ', 'СРАВНЕНИЕ', 'РИСК'][sceneIndex];
      return `
        ${tx(60, 80, 'QNT', { size: 24, fill: C.accent, weight: 900, spacing: 4 })}
        ${tx(1020, 80, '27·09·26', { size: 19, fill: C.muted, anchor: 'end', weight: 700, family: 'DejaVu Sans Mono, monospace' })}
        ${line(60, 112, 1020, 112, C.ink, 3)}
        ${tx(62, 158, word, { size: 21, fill: C.muted, weight: 800, spacing: 4 })}
        ${tx(1018, 158, `${String(sceneIndex + 1).padStart(2, '0')}—06`, { size: 19, fill: C.muted, anchor: 'end', weight: 700, family: 'DejaVu Sans Mono, monospace' })}
      `;
    }
  }
}

function captionPlate(style, sceneIndex, caption) {
  const C = style.colors;
  const lines = wrap(caption, style.id === '05-type' ? 42 : 39);
  const lineHeight = 47;
  const startY = 1509 + Math.max(0, (3 - lines.length) * 15);
  const source = sceneIndex === 3
    ? 'QUANT · ОФИЦИАЛЬНАЯ ЛЕНТА · 24.09.2026'
    : 'BINANCE SPOT · QNTUSDT · 1H OHLC · UTC';
  if (style.id === '02-dossier') {
    return `
      ${rect(54, 1448, 972, 360, '#f7f2e8', { rx: 5, stroke: C.grid, strokeWidth: 2, opacity: 0.98 })}
      ${rect(54, 1448, 14, 360, C.accent)}
      ${multiline(92, startY, lines, { size: 31, lineHeight, fill: C.ink, weight: 700 })}
      ${line(92, 1740, 990, 1740, C.grid, 2)}
      ${tx(92, 1776, source, { size: 17, fill: C.muted, weight: 700, spacing: 1 })}
    `;
  }
  if (style.id === '03-orbit') {
    return `
      ${rect(48, 1450, 984, 352, '#071823', { rx: 22, stroke: C.grid, strokeWidth: 2, opacity: 0.96 })}
      ${rect(48, 1450, 7, 352, C.accent)}
      ${multiline(92, startY, lines, { size: 31, lineHeight, fill: C.ink, weight: 600 })}
      ${line(92, 1740, 990, 1740, C.grid, 2)}
      ${tx(92, 1778, source, { size: 17, fill: C.muted, weight: 700, spacing: 1 })}
    `;
  }
  if (style.id === '04-collage') {
    return `
      ${rect(46, 1450, 988, 356, '#f7f3e9', { rx: 0, stroke: C.ink, strokeWidth: 3, opacity: 0.98, transform: 'rotate(-1 540 1628)' })}
      ${rect(46, 1450, 20, 356, C.accent, { transform: 'rotate(-1 540 1628)' })}
      ${multiline(98, startY, lines, { size: 31, lineHeight, fill: '#171820', weight: 800 })}
      ${tx(98, 1776, source, { size: 17, fill: '#50525a', weight: 700, spacing: 1 })}
    `;
  }
  if (style.id === '05-type') {
    return `
      ${rect(50, 1450, 980, 356, C.bg2, { rx: 0 })}
      ${rect(50, 1450, 13, 356, C.accent)}
      ${multiline(92, startY, lines, { size: 30, lineHeight, fill: C.ink, weight: 700 })}
      ${line(92, 1740, 990, 1740, '#cbc8be', 2)}
      ${tx(92, 1778, source, { size: 16, fill: C.muted, weight: 700, spacing: 1 })}
    `;
  }
  return `
    ${rect(54, 1448, 972, 360, '#101715', { rx: 22, stroke: C.grid, strokeWidth: 2, opacity: 0.97 })}
    ${rect(54, 1448, 8, 360, sceneIndex === 3 ? C.secondary : C.accent)}
    ${multiline(96, startY, lines, { size: 31, lineHeight, fill: C.ink, weight: 600 })}
    ${line(96, 1740, 988, 1740, C.grid, 2)}
    ${tx(96, 1778, source, { size: 17, fill: C.muted, weight: 700, spacing: 1 })}
  `;
}

function impactBody(index, t, C) {
  const p = ease(t / 0.75);
  if (index === 0) {
    const pulse = 1 + Math.sin(t * 4) * 0.018;
    const slashX = -420 + t * 2800;
    const slashOpacity = 0.24 * (1 - clamp(t / 0.48));
    return `
      <polygon points="${slashX},394 ${slashX + 170},394 ${slashX - 205},1006 ${slashX - 375},1006" fill="${C.accent}" opacity="${slashOpacity}"/>
      ${circle(540, 700, 284 * pulse, 'none', { stroke: C.accent, strokeWidth: 2, opacity: 0.26 })}
      ${circle(540, 700, 224, 'none', { stroke: C.accent, strokeWidth: 7, opacity: 0.7, dash: `${Math.max(20, 1100 * clamp(t / 5.7))} 1500` })}
      ${tx(540, 415, 'QNTUSDT  /  BINANCE SPOT  /  24H', { size: 21, fill: C.secondary, anchor: 'middle', weight: 800, spacing: 2 })}
      ${tx(540, 678, 'QNT', { size: 128, fill: C.ink, anchor: 'middle', weight: 900, spacing: 5, transform: `translate(540 678) scale(${p}) translate(-540 -678)` })}
      ${tx(540, 1088, '+74,7%', { size: 184, fill: C.accent, anchor: 'middle', weight: 900, spacing: -8, transform: `translate(${(1 - p) * 90} 0)` })}
      ${tx(540, 1160, 'ЗА 24 ЗАКРЫТЫХ ЧАСА', { size: 27, fill: C.ink, anchor: 'middle', weight: 700, spacing: 2 })}
      ${tx(540, 1232, '$103,04  →  $180,06', { size: 32, fill: C.muted, anchor: 'middle', weight: 700, family: 'DejaVu Sans Mono, monospace' })}
      ${rect(340, 1282, 400, 54, '#261918', { rx: 12, stroke: C.risk, strokeWidth: 2, opacity: ease((t - 1.8) / 0.45) })}
      ${tx(540, 1318, `−${drawdownPct.toFixed(1).replace('.', ',')}% ОТ ПИКА`, { size: 19, fill: C.risk, anchor: 'middle', weight: 800, spacing: 1, opacity: ease((t - 1.8) / 0.45) })}
      ${tx(540, 1406, 'ИСТОРИЧЕСКИЙ СРЕЗ · 27.09.2026', { size: 19, fill: C.muted, anchor: 'middle', weight: 700, spacing: 1 })}
    `;
  }
  if (index === 1) {
    return `
      ${rect(54, 316, 972, 1040, '#101513', { rx: 24, stroke: C.grid, strokeWidth: 2 })}
      ${tx(94, 384, 'QNTUSDT / 1H', { size: 22, fill: C.accent, weight: 800, spacing: 2 })}
      ${candlesSvg(144, 444, 820, 808, t, C.accent, C.risk, { grid: C.grid, muted: C.muted, revealSeconds: 3.4, candleWidthFactor: 0.64, wickWidth: 4 })}
      ${tx(94, 1310, `−${drawdownPct.toFixed(1).replace('.', ',')}% ОТ ПИКА`, { size: 24, fill: C.risk, weight: 800 })}
      ${tx(986, 1310, '24 ЗАВЕРШЁННЫЕ СВЕЧИ', { size: 18, fill: C.muted, anchor: 'end', weight: 700 })}
    `;
  }
  if (index === 2) {
    const x = 110;
    const y = 664;
    const width = 860;
    const height = 82;
    const scaleMax = 90_000_000;
    const totalWidth = width * (MARKET.quoteVolume / scaleMax) * ease(t / 0.9);
    const averageX = x + width * (MARKET.averageDailyVolume7d / scaleMax);
    return `
      ${tx(540, 450, '$86,2', { size: 154, fill: C.ink, anchor: 'middle', weight: 900, spacing: -6 })}
      ${tx(540, 506, 'МИЛЛИОНА USDT · ОБОРОТ ЗА 24 ЧАСА', { size: 21, fill: C.muted, anchor: 'middle', weight: 700, spacing: 1 })}
      ${tx(x, 616, `7-ДНЕВНОЕ СРЕДНЕЕ · $${(MARKET.averageDailyVolume7d / 1_000_000).toFixed(2).replace('.', ',')}M`, { size: 18, fill: C.secondary, weight: 800 })}
      ${tx(x + width, 616, '24 ЧАСА · $86,2M', { size: 18, fill: C.accent, anchor: 'end', weight: 800 })}
      ${rect(x, y, width, height, '#18211d', { rx: 8, stroke: C.grid, strokeWidth: 2 })}
      ${rect(x, y, totalWidth, height, C.accent, { rx: 8, opacity: 0.88 })}
      ${line(averageX, y - 18, averageX, y + height + 22, C.secondary, 5)}
      ${circle(averageX, y - 18, 7, C.secondary)}
      ${tx(averageX, y + height + 54, 'СРЕДНЕЕ', { size: 15, fill: C.secondary, anchor: 'middle', weight: 800 })}
      ${tx(118, 1010, `${volumeMultiple.toFixed(1).replace('.', ',')}×`, { size: 112, fill: C.accent, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(435, 958, 'ВЫШЕ СРЕДНЕГО', { size: 25, fill: C.ink, weight: 800, spacing: 1 })}
      ${tx(435, 1004, 'ЗА ОДИН ДЕНЬ', { size: 25, fill: C.ink, weight: 800, spacing: 1 })}
      ${tx(435, 1050, 'сравнение полных суточных итогов', { size: 18, fill: C.muted, weight: 600 })}
      ${tx(110, 1146, 'ПОЧАСОВОЙ ОБЪЁМ · 24 ЗАКРЫТЫЕ СВЕЧИ', { size: 18, fill: C.muted, weight: 800, spacing: 1 })}
      ${impactHourlyVolumeProfileSvg(110, 1172, 860, 158, t, C.accent, C.grid)}
      ${tx(110, 1372, 'ПРОФИЛЬ ВНУТРИ СУТОК · QNT/USDT', { size: 16, fill: C.muted, weight: 700, spacing: 1 })}
    `;
  }
  if (index === 3) {
    const slide = (1 - p) * 180;
    return `
      ${circle(540, 476, 144, '#111816', { stroke: C.secondary, strokeWidth: 3 })}
      ${tx(540, 452, '24', { size: 98, fill: C.ink, anchor: 'middle', weight: 900 })}
      ${tx(540, 508, 'СЕНТЯБРЯ', { size: 17, fill: C.secondary, anchor: 'middle', weight: 800, spacing: 2 })}
      ${rect(62 + slide, 698, 956, 602, '#101715', { rx: 22, stroke: C.grid, strokeWidth: 2 })}
      ${tx(104 + slide, 772, 'ОФИЦИАЛЬНАЯ ЛЕНТА QUANT · 24.09.2026', { size: 18, fill: C.secondary, weight: 800, spacing: 1 })}
      ${multiline(104 + slide, 878, ['Quant powers The Clearing', 'House’s On-Chain Money', 'Initiative in the US'], { size: 43, lineHeight: 64, fill: C.ink, weight: 800 })}
      ${line(104 + slide, 1105, 976 + slide, 1105, C.grid, 2)}
      ${tx(104 + slide, 1170, 'ВОЗМОЖНЫЙ КОНТЕКСТ', { size: 21, fill: C.accent, weight: 800 })}
      ${tx(104 + slide, 1228, 'Совпадение по времени не доказывает причину', { size: 22, fill: C.muted, weight: 600 })}
      ${rect(80, 1330, 920, 72, '#261918', { rx: 12, stroke: C.risk, strokeWidth: 2, opacity: ease((t - 0.8) / 0.5) })}
      ${tx(540, 1377, 'РОЛЬ QNT ЭТИМ НЕ ПОДТВЕРЖДЕНА', { size: 19, fill: C.risk, anchor: 'middle', weight: 800, spacing: 1, opacity: ease((t - 0.8) / 0.5) })}
    `;
  }
  if (index === 4) {
    const bars = [
      { label: 'QNT', value: 74.7, color: C.accent },
      { label: 'BTC', value: 0.7, color: C.secondary },
      { label: 'ETH', value: 0.9, color: C.ink },
    ];
    return bars.map((item, i) => {
      const yy = 475 + i * 282;
      const reveal = ease((t - i * 0.25) / 0.7);
      const width = (item.value / 74.7) * 610 * reveal;
      return `
        ${tx(88, yy, item.label, { size: 24, fill: C.muted, weight: 800, spacing: 2 })}
        ${rect(88, yy + 34, 610, 66, C.grid, { rx: 4, opacity: 0.42 })}
        ${rect(88, yy + 34, Math.max(12, width), 66, item.color, { rx: 4 })}
        ${tx(988, yy + 84, `+${item.value.toFixed(1).replace('.', ',')}%`, { size: 52, fill: item.color, anchor: 'end', weight: 900, family: 'DejaVu Sans Mono, monospace', opacity: reveal })}
        ${tx(88, yy + 144, 'ТОТ ЖЕ UTC-ПЕРИОД', { size: 17, fill: C.muted, weight: 700, spacing: 1 })}
      `;
    }).join('') + `${tx(88, 1403, 'BINANCE SPOT · 26.09—27.09.2026 UTC', { size: 18, fill: C.muted, weight: 700 })}`;
  }
  const facts = [
    { x: 70, value: '+74,7%', label: 'РОСТ', color: C.accent },
    { x: 385, value: `−${drawdownPct.toFixed(1).replace('.', ',')}%`, label: 'ОТ ПИКА', color: C.risk },
    { x: 700, value: `${volumeMultiple.toFixed(1).replace('.', ',')}×`, label: 'ОБОРОТ', color: C.secondary },
  ];
  return `
    ${tx(80, 380, 'ИМПУЛЬС НЕ РАВЕН ТЕЗИСУ', { size: 39, fill: C.ink, weight: 900, spacing: 1 })}
    ${facts.map((item, i) => {
      const a = ease((t - i * 0.18) / 0.5);
      return `${rect(item.x, 490, 290, 226, '#101715', { rx: 16, stroke: C.grid, strokeWidth: 2, opacity: a })}${tx(item.x + 22, 610, item.value, { size: 50, fill: item.color, weight: 900, family: 'DejaVu Sans Mono, monospace', opacity: a })}${tx(item.x + 22, 670, item.label, { size: 18, fill: C.muted, weight: 800, spacing: 1, opacity: a })}`;
    }).join('')}
    ${rect(78, 790, 924, 430, '#101715', { rx: 22, stroke: C.grid, strokeWidth: 2 })}
    ${tx(118, 866, 'ЧТО ПОДТВЕРЖДЕНО', { size: 18, fill: C.accent, weight: 800, spacing: 2 })}
    ${multiline(118, 930, ['24 завершённые свечи Binance Spot', 'и суточный оборот $86,2 млн.'], { size: 29, lineHeight: 44, fill: C.ink, weight: 600 })}
    ${line(118, 1010, 962, 1010, C.grid, 2)}
    ${tx(118, 1062, 'ЧТО НЕ УСТАНОВЛЕНО', { size: 18, fill: C.risk, weight: 800, spacing: 2 })}
    ${multiline(118, 1124, ['Причина движения и роль токена', 'в упомянутой инициативе.'], { size: 26, lineHeight: 40, fill: C.muted, weight: 600 })}
    ${rect(78, 1280, 924, 104, '#261918', { rx: 16, stroke: C.risk, strokeWidth: 2 })}
    ${tx(540, 1344, 'ВЫСОКАЯ ВОЛАТИЛЬНОСТЬ · НЕ ИНВЕСТИЦИОННАЯ РЕКОМЕНДАЦИЯ', { size: 20, fill: C.risk, anchor: 'middle', weight: 800, spacing: 0.4 })}
    ${tx(80, 1420, 'ДАННЫЕ: BINANCE SPOT · СРЕЗ 27.09.2026 UTC', { size: 16, fill: C.muted, weight: 700 })}
  `;
}

function dossierBody(index, t, C) {
  const reveal = ease(t / 0.52);
  if (index === 0) {
    return `
      ${rect(95, 350, 890, 920, '#f8f3e8', { rx: 4, stroke: C.grid, strokeWidth: 2, transform: `rotate(-1.2 540 810)` })}
      ${rect(128, 396, 198, 42, C.accent, { rx: 2, transform: `rotate(-1.2 540 810)` })}
      ${tx(148, 425, 'СУТОЧНЫЙ СРЕЗ', { size: 18, fill: '#fffaf0', weight: 900, spacing: 1 })}
      ${tx(132, 593, '+74,7%', { size: 174, fill: C.ink, weight: 900, spacing: -8, transform: `rotate(-1.2 540 810) scale(${reveal})` })}
      ${tx(138, 675, 'QNT / BINANCE SPOT', { size: 26, fill: C.accent, weight: 900, spacing: 2 })}
      ${line(138, 741, 925, 741, C.grid, 2)}
      ${tx(138, 828, '$103,04', { size: 49, fill: C.muted, weight: 700, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(531, 828, '→', { size: 48, fill: C.accent, weight: 800, anchor: 'middle' })}
      ${tx(925, 828, '$180,06', { size: 49, fill: C.ink, weight: 800, anchor: 'end', family: 'DejaVu Sans Mono, monospace' })}
      ${tx(138, 902, '24 ЗАВЕРШЁННЫХ ЧАСА · ИСТОРИЧЕСКИЕ ДАННЫЕ', { size: 18, fill: C.muted, weight: 700, spacing: 1 })}
      ${tx(90, 1370, '27.09.2026 / 09:00 UTC', { size: 20, fill: C.muted, weight: 700, family: 'DejaVu Sans Mono, monospace' })}
    `;
  }
  if (index === 1) {
    return `
      ${rect(58, 302, 964, 1080, '#f8f3e8', { rx: 4, stroke: C.grid, strokeWidth: 2 })}
      ${rect(72, 318, 936, 1048, 'none', { stroke: C.grid, strokeWidth: 1 })}
      ${tx(96, 378, 'ПРИЛОЖЕНИЕ A · 24 СВЕЧИ', { size: 18, fill: C.accent, weight: 800, spacing: 1 })}
      ${candlesSvg(157, 455, 780, 766, t, C.secondary, C.risk, { grid: C.grid, muted: C.muted, revealSeconds: 3.2, priceLabels: false, candleWidthFactor: 0.6 })}
      ${rect(95, 1255, 894, 80, '#ded6c7', { rx: 2 })}
      ${tx(122, 1307, `ПИК $194,95  /  ОТКАТ −${drawdownPct.toFixed(1).replace('.', ',')}%`, { size: 22, fill: C.ink, weight: 800, spacing: 1 })}
    `;
  }
  if (index === 2) {
    return `
      ${rect(80, 390, 920, 850, '#f8f3e8', { rx: 4, stroke: C.grid, strokeWidth: 2 })}
      ${tx(124, 470, 'ОБОРОТ · QNT/USDT', { size: 20, fill: C.secondary, weight: 900, spacing: 2 })}
      ${tx(124, 604, '$86,2 млн', { size: 99, fill: C.ink, weight: 900, spacing: -4 })}
      ${tx(126, 652, 'ЗА 24 ПОЛНЫХ ЧАСА', { size: 18, fill: C.muted, weight: 700, spacing: 2 })}
      ${volumeSvg(136, 730, 808, 330, t, C.secondary, C.risk, C.grid, { secondary: C.accent })}
      ${rect(124, 1100, 830, 82, '#e3dac8', { rx: 3 })}
      ${tx(150, 1158, `${volumeMultiple.toFixed(1).replace('.', ',')}×`, { size: 48, fill: C.accent, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(355, 1156, 'СРЕДНЕГО ЗА 7 ДНЕЙ', { size: 20, fill: C.ink, weight: 800 })}
      ${tx(125, 1330, 'СРАВНЕНИЕ ОБЪЁМА · 7 ПРЕДЫДУЩИХ ПОЛНЫХ ДНЕЙ', { size: 17, fill: C.muted, weight: 700 })}
    `;
  }
  if (index === 3) {
    const paperY = 500 + (1 - reveal) * 110;
    return `
      ${rect(70, 384, 225, 58, C.secondary, { rx: 1, transform: 'rotate(-4 180 413)' })}
      ${tx(95, 422, 'ПРИЛОЖЕНИЕ B', { size: 18, fill: '#fff', weight: 900, spacing: 1, transform: 'rotate(-4 180 413)' })}
      ${rect(78, paperY, 924, 724, '#f8f3e8', { rx: 3, stroke: C.grid, strokeWidth: 2, transform: 'rotate(0.7 540 862)' })}
      ${tx(120, paperY + 80, 'OFFICIAL QUANT NEWS · 24.09.2026', { size: 18, fill: C.secondary, weight: 800, spacing: 1 })}
      ${multiline(120, paperY + 196, ['Quant powers The Clearing', 'House’s On-Chain Money', 'Initiative in the US'], { size: 42, lineHeight: 61, fill: C.ink, weight: 800 })}
      ${line(120, paperY + 425, 960, paperY + 425, C.grid, 2)}
      ${tx(120, paperY + 493, 'ВОЗМОЖНЫЙ КОНТЕКСТ', { size: 20, fill: C.accent, weight: 900, spacing: 1 })}
      ${multiline(120, paperY + 553, ['Совпадение по времени не доказывает', 'причину движения или роль токена.'], { size: 26, lineHeight: 40, fill: C.muted, weight: 600 })}
      ${rect(82, 1280, 916, 78, '#ead8cf', { rx: 2, stroke: C.risk, strokeWidth: 2 })}
      ${tx(540, 1330, 'РОЛЬ QNT НЕ ПОДТВЕРЖДЕНА ЭТИМ СООБЩЕНИЕМ', { size: 18, fill: C.risk, anchor: 'middle', weight: 900, spacing: 1 })}
    `;
  }
  if (index === 4) {
    const entries = [
      { symbol: 'QNT', value: '+0,7%', note: '24 ЧАСА', color: C.accent },
      { symbol: 'BTC', value: '+0,7%', note: 'ТОТ ЖЕ ПЕРИОД', color: C.secondary },
      { symbol: 'ETH', value: '+0,9%', note: 'ТОТ ЖЕ ПЕРИОД', color: C.ink },
    ];
    entries[0].value = '+74,7%';
    return entries.map((item, i) => {
      const y = 405 + i * 280;
      const a = ease((t - i * 0.24) / 0.48);
      return `
        ${rect(84, y, 912, 224, '#f8f3e8', { rx: 3, stroke: C.grid, strokeWidth: 2, opacity: a })}
        ${tx(124, y + 65, item.symbol, { size: 20, fill: C.muted, weight: 900, spacing: 2, opacity: a })}
        ${tx(124, y + 166, item.value, { size: 75, fill: item.color, weight: 900, family: 'DejaVu Sans Mono, monospace', opacity: a })}
        ${tx(958, y + 166, item.note, { size: 16, fill: C.muted, anchor: 'end', weight: 800, spacing: 1, opacity: a })}
      `;
    }).join('') + tx(85, 1342, 'BINANCE SPOT · 26.09—27.09.2026 UTC', { size: 18, fill: C.muted, weight: 700 });
  }
  return `
    ${rect(66, 390, 948, 910, '#f8f3e8', { rx: 4, stroke: C.grid, strokeWidth: 2 })}
    ${rect(92, 422, 298, 54, C.accent, { rx: 2 })}
    ${tx(110, 458, 'КАРТОЧКА ВЫВОДОВ', { size: 17, fill: '#fff', weight: 900, spacing: 1 })}
    ${tx(112, 592, 'ИМПУЛЬС', { size: 57, fill: C.ink, weight: 900, spacing: 1 })}
    ${tx(112, 656, 'НЕ ГАРАНТИЯ', { size: 57, fill: C.risk, weight: 900, spacing: 1 })}
    ${line(112, 704, 946, 704, C.grid, 2)}
    ${tx(112, 806, '+74,7%', { size: 55, fill: C.accent, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
    ${tx(514, 806, `−${drawdownPct.toFixed(1).replace('.', ',')}% ОТ ПИКА`, { size: 23, fill: C.risk, weight: 800 })}
    ${tx(112, 902, 'ПОДТВЕРЖДЕНО', { size: 18, fill: C.secondary, weight: 900, spacing: 1 })}
    ${multiline(112, 954, ['Суточные свечи и оборот', 'на Binance Spot.'], { size: 27, lineHeight: 41, fill: C.ink, weight: 650 })}
    ${tx(112, 1102, 'НЕ ДОКАЗАНО', { size: 18, fill: C.risk, weight: 900, spacing: 1 })}
    ${multiline(112, 1154, ['Причина роста и роль токена', 'в инициативе Quant.'], { size: 27, lineHeight: 41, fill: C.muted, weight: 600 })}
    ${tx(66, 1370, 'ТЕСТОВЫЙ РЕДАКЦИОННЫЙ МАТЕРИАЛ · НЕ СИГНАЛ', { size: 18, fill: C.muted, weight: 700 })}
  `;
}

function orbitBody(index, t, C) {
  const pulse = 1 + Math.sin(t * 3.2) * 0.025;
  if (index === 0) {
    return `
      ${circle(540, 760, 315 * pulse, 'none', { stroke: C.grid, strokeWidth: 2 })}
      ${circle(540, 760, 252, 'none', { stroke: C.secondary, strokeWidth: 2, opacity: 0.62, dash: '4 14' })}
      ${circle(540, 760, 190, '#0a1d29', { stroke: C.accent, strokeWidth: 4 })}
      ${circle(540, 760, 163, 'none', { stroke: C.accent, strokeWidth: 9, opacity: 0.4, dash: `${clamp(t / 5.5) * 850} 1200` })}
      ${tx(540, 755, 'QNT', { size: 106, fill: C.ink, anchor: 'middle', weight: 900, spacing: 4 })}
      ${tx(540, 1084, '+74,7%', { size: 164, fill: C.accent, anchor: 'middle', weight: 900, family: 'DejaVu Sans Mono, monospace', transform: `scale(${ease(t / 0.8)})` })}
      ${tx(540, 1150, '24 ЗАВЕРШЁННЫХ ЧАСА', { size: 24, fill: C.ink, anchor: 'middle', weight: 700, spacing: 2 })}
      ${tx(540, 1234, '$103,04 → $180,06', { size: 30, fill: C.muted, anchor: 'middle', weight: 700, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(540, 1384, 'СНИМОК РЫНКА · 27.09.2026 UTC', { size: 18, fill: C.muted, anchor: 'middle', weight: 700 })}
    `;
  }
  if (index === 1) {
    const chart = { x: 126, y: 470, w: 830, h: 742 };
    return `
      ${circle(540, 820, 459, 'none', { stroke: C.grid, strokeWidth: 1, opacity: 0.7 })}
      ${circle(540, 820, 400, 'none', { stroke: C.secondary, strokeWidth: 1, opacity: 0.52, dash: '3 15' })}
      ${tx(540, 390, '24-HOUR PRICE TRAJECTORY', { size: 19, fill: C.secondary, anchor: 'middle', weight: 800, spacing: 2 })}
      ${candlesSvg(chart.x, chart.y, chart.w, chart.h, t, C.accent, C.risk, { grid: C.grid, muted: C.muted, revealSeconds: 3.3, priceLabels: false, candleWidthFactor: 0.42 })}
      ${circle(chart.x + chart.w * 0.72, chart.y + chart.h * 0.1, 18 + Math.sin(t * 4) * 3, C.risk, { opacity: ease((t - 2.2) / 0.3) })}
      ${tx(540, 1314, 'HIGH $194,95', { size: 23, fill: C.risk, anchor: 'middle', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(540, 1364, `−${drawdownPct.toFixed(1).replace('.', ',')}% ОТ ПИКА`, { size: 20, fill: C.ink, anchor: 'middle', weight: 800 })}
    `;
  }
  if (index === 2) {
    return `
      ${tx(540, 410, '$86,2 млн', { size: 103, fill: C.ink, anchor: 'middle', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(540, 464, 'QUOTE VOLUME · 24H', { size: 20, fill: C.muted, anchor: 'middle', weight: 800, spacing: 2 })}
      ${circle(540, 965, 311, 'none', { stroke: C.grid, strokeWidth: 3 })}
      ${circle(540, 965, 246, 'none', { stroke: C.secondary, strokeWidth: 2, dash: '5 15', opacity: 0.7 })}
      <g transform="rotate(${t * 17} 540 965)">${volumeSvg(290, 720, 500, 488, t, C.accent, C.risk, C.grid, { secondary: C.secondary, revealSeconds: 3.3 })}</g>
      ${circle(540, 965, 112, '#0a1d29', { stroke: C.accent, strokeWidth: 3 })}
      ${tx(540, 988, `${volumeMultiple.toFixed(1).replace('.', ',')}×`, { size: 54, fill: C.accent, anchor: 'middle', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(540, 1310, 'К СРЕДНЕМУ ЗА 7 ДНЕЙ', { size: 21, fill: C.muted, anchor: 'middle', weight: 800 })}
    `;
  }
  if (index === 3) {
    return `
      ${circle(540, 475, 174, 'none', { stroke: C.secondary, strokeWidth: 2, dash: '3 12' })}
      ${circle(540, 475, 128, '#0a1d29', { stroke: C.secondary, strokeWidth: 3 })}
      ${tx(540, 464, '24.09', { size: 59, fill: C.ink, anchor: 'middle', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${rect(66, 700, 948, 566, '#0a1d29', { rx: 26, stroke: C.secondary, strokeWidth: 2, opacity: 0.97 })}
      ${tx(108, 775, 'QUANT OFFICIAL NEWS', { size: 19, fill: C.secondary, weight: 800, spacing: 2 })}
      ${multiline(108, 890, ['Quant powers The Clearing', 'House’s On-Chain Money', 'Initiative in the US'], { size: 42, lineHeight: 64, fill: C.ink, weight: 750 })}
      ${line(108, 1112, 970, 1112, C.grid, 2)}
      ${tx(108, 1178, 'ВОЗМОЖНЫЙ ФОН', { size: 21, fill: C.accent, weight: 900, spacing: 2 })}
      ${tx(108, 1224, 'Причина и роль QNT не доказаны', { size: 23, fill: C.muted, weight: 600 })}
      ${circle(914, 1318, 11 + Math.sin(t * 6) * 3, C.risk, { opacity: 0.88 })}
      ${tx(108, 1373, 'СООБЩЕНИЕ НЕ ДОКАЗЫВАЕТ ПРИЧИННОСТЬ', { size: 18, fill: C.risk, weight: 800, spacing: 1 })}
    `;
  }
  if (index === 4) {
    const bars = [
      { label: 'QNT', value: 74.7, color: C.accent },
      { label: 'BTC', value: 0.7, color: C.secondary },
      { label: 'ETH', value: 0.9, color: C.ink },
    ];
    return bars.map((item, i) => {
      const yy = 535 + i * 247;
      const a = ease((t - i * 0.2) / 0.6);
      const r = 18 + (item.value / 74.7) * 225;
      return `
        ${circle(238, yy, r, 'none', { stroke: item.color, strokeWidth: item.value > 1 ? 9 : 4, opacity: a })}
        ${tx(344, yy - 5, item.label, { size: 24, fill: C.muted, weight: 900, spacing: 2 })}
        ${tx(344, yy + 63, `+${item.value.toFixed(1).replace('.', ',')}%`, { size: 58, fill: item.color, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
        ${tx(344, yy + 100, 'ТОТ ЖЕ UTC-ПЕРИОД', { size: 17, fill: C.muted, weight: 700, spacing: 1 })}
      `;
    }).join('') + tx(80, 1370, 'BINANCE SPOT · 26.09—27.09.2026 UTC', { size: 18, fill: C.muted, weight: 700 });
  }
  return `
    ${circle(540, 796, 305 * pulse, 'none', { stroke: C.accent, strokeWidth: 2, opacity: 0.22 })}
    ${circle(540, 796, 226, 'none', { stroke: C.secondary, strokeWidth: 2, opacity: 0.6, dash: '3 13' })}
    ${tx(540, 570, 'СИГНАЛ', { size: 32, fill: C.muted, anchor: 'middle', weight: 800, spacing: 5 })}
    ${tx(540, 728, '+74,7%', { size: 114, fill: C.accent, anchor: 'middle', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
    ${tx(540, 808, `−${drawdownPct.toFixed(1).replace('.', ',')}%`, { size: 64, fill: C.risk, anchor: 'middle', weight: 900 })}
    ${tx(540, 866, 'ОТ ПИКА', { size: 19, fill: C.muted, anchor: 'middle', weight: 800, spacing: 3 })}
    ${line(200, 1026, 880, 1026, C.grid, 2)}
    ${tx(540, 1090, 'ПОДТВЕРЖДЕНО', { size: 19, fill: C.accent, anchor: 'middle', weight: 900, spacing: 2 })}
    ${tx(540, 1144, 'ЦЕНА · ОБЪЁМ · ПЕРИОД', { size: 22, fill: C.ink, anchor: 'middle', weight: 700 })}
    ${tx(540, 1240, 'НЕ ДОКАЗАНО', { size: 19, fill: C.risk, anchor: 'middle', weight: 900, spacing: 2 })}
    ${tx(540, 1292, 'ПРИЧИНА · РОЛЬ ТОКЕНА', { size: 22, fill: C.muted, anchor: 'middle', weight: 700 })}
  `;
}

function collageBody(index, t, C) {
  const pop = ease(t / 0.4);
  if (index === 0) {
    const shift = 54 * (1 - pop);
    return `
      ${rect(48 + shift, 354, 984, 640, C.accent, { rx: 0, transform: `rotate(-2 540 674)` })}
      ${tx(94 + shift, 442, 'QNT', { size: 48, fill: '#10111a', weight: 900, spacing: 5 })}
      ${tx(540 + shift, 710, '+74,7%', { size: 177, fill: '#10111a', anchor: 'middle', weight: 900, spacing: -8, transform: `rotate(-2 540 674)` })}
      ${rect(76, 1055, 720, 114, '#f7f3e9', { rx: 0 })}
      ${tx(112, 1125, 'ЗА 24 ЗАКРЫТЫХ ЧАСА', { size: 28, fill: '#171820', weight: 900, spacing: 1 })}
      ${rect(760, 1196, 250, 140, C.risk, { rx: 0, transform: 'rotate(4 885 1266)' })}
      ${tx(885, 1280, 'HISTORICAL', { size: 21, fill: '#fff', anchor: 'middle', weight: 900, spacing: 2, transform: 'rotate(4 885 1266)' })}
      ${tx(80, 1390, '$103,04  →  $180,06 · 27.09.2026 UTC', { size: 20, fill: C.ink, weight: 800, family: 'DejaVu Sans Mono, monospace' })}
    `;
  }
  if (index === 1) {
    return `
      ${rect(0, 300, 238, 1040, C.secondary)}
      ${tx(70, 365, '24', { size: 30, fill: '#10111a', weight: 900 })}
      ${candlesSvg(270, 370, 720, 870, t, C.accent, C.risk, { grid: C.grid, muted: C.muted, revealSeconds: 3.1, priceLabels: false, candleWidthFactor: 0.57 })}
      ${rect(62, 1278, 310, 104, '#f7f3e9')}
      ${tx(84, 1343, 'ПИК $194,95', { size: 21, fill: '#171820', weight: 900 })}
      ${rect(700, 1262, 312, 104, C.risk)}
      ${tx(730, 1328, `−${drawdownPct.toFixed(1).replace('.', ',')}%`, { size: 33, fill: '#fff', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
    `;
  }
  if (index === 2) {
    return `
      ${rect(66, 340, 456, 176, C.accent, { rx: 0 })}
      ${tx(104, 452, '$86 млн', { size: 74, fill: '#10111a', weight: 900 })}
      ${rect(560, 340, 452, 176, C.secondary, { rx: 0 })}
      ${tx(596, 452, `${volumeMultiple.toFixed(1).replace('.', ',')}×`, { size: 74, fill: '#10111a', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${volumeSvg(114, 635, 850, 545, t, C.accent, C.risk, C.grid, { secondary: C.secondary })}
      ${rect(88, 1248, 904, 98, '#f7f3e9')}
      ${tx(124, 1311, 'СРАВНЕНИЕ СО СРЕДНИМ ЗА 7 ДНЕЙ', { size: 21, fill: '#171820', weight: 900, spacing: 1 })}
    `;
  }
  if (index === 3) {
    return `
      ${rect(0, 280, WIDTH, 1030, '#f7f3e9')}
      ${rect(64, 336, 952, 74, C.accent)}
      ${tx(98, 385, 'QUANT / OFFICIAL FEED / 24.09.2026', { size: 20, fill: '#10111a', weight: 900, spacing: 1 })}
      ${rect(64, 460, 510, 604, '#fffdf8', { stroke: C.grid, strokeWidth: 2, transform: `rotate(-2 ${WIDTH / 2} 762)` })}
      ${multiline(104, 590, ['Quant powers The', 'Clearing House’s', 'On-Chain Money', 'Initiative in the US'], { size: 37, lineHeight: 58, fill: '#171820', weight: 900 })}
      ${rect(605, 520, 400, 430, C.secondary, { rx: 0, transform: `rotate(2 ${WIDTH / 2} 762)` })}
      ${tx(640, 610, 'ВОЗМОЖНЫЙ', { size: 25, fill: '#10111a', weight: 900 })}
      ${tx(640, 660, 'КОНТЕКСТ', { size: 43, fill: '#10111a', weight: 900 })}
      ${line(640, 705, 960, 705, '#10111a', 3)}
      ${multiline(640, 768, ['не причина', 'роста'], { size: 32, lineHeight: 45, fill: '#10111a', weight: 800 })}
      ${rect(94, 1120, 890, 112, C.risk)}
      ${tx(540, 1186, 'РОЛЬ QNT НЕ ДОКАЗАНА', { size: 26, fill: '#fff', anchor: 'middle', weight: 900, spacing: 1 })}
      ${tx(88, 1375, 'ИСТОЧНИК: QUANT · ОФИЦИАЛЬНАЯ ПУБЛИКАЦИЯ', { size: 17, fill: C.muted, weight: 700 })}
    `;
  }
  if (index === 4) {
    const tiles = [
      { label: 'QNT', value: '+74,7%', color: C.accent, height: 280 },
      { label: 'BTC', value: '+0,7%', color: C.secondary, height: 200 },
      { label: 'ETH', value: '+0,9%', color: '#f7f3e9', height: 200 },
    ];
    return tiles.map((item, i) => {
      const y = 360 + i * 320;
      const x = 72 + (i % 2 ? 118 : 0);
      const a = ease((t - i * 0.18) / 0.42);
      return `
        ${rect(x, y, 900 - (i % 2) * 118, item.height, item.color, { rx: 0, opacity: a, transform: `rotate(${i === 1 ? -1 : 1} ${540} ${y + item.height / 2})` })}
        ${tx(x + 28, y + 66, item.label, { size: 20, fill: '#10111a', weight: 900, spacing: 2, opacity: a })}
        ${tx(x + 28, y + item.height - 42, item.value, { size: i === 0 ? 76 : 64, fill: '#10111a', weight: 900, family: 'DejaVu Sans Mono, monospace', opacity: a })}
        ${tx(x + 850 - (i % 2) * 118, y + item.height - 42, '24H', { size: 20, fill: '#10111a', anchor: 'end', weight: 900, opacity: a })}
      `;
    }).join('') + tx(78, 1377, 'ОДИН UTC-ПЕРИОД · BINANCE SPOT', { size: 18, fill: C.muted, weight: 800 });
  }
  return `
    ${rect(58, 374, 964, 942, '#f7f3e9', { rx: 0, stroke: C.ink, strokeWidth: 3 })}
    ${rect(58, 374, 964, 90, C.accent)}
    ${tx(98, 433, 'ФАКТЫ / ИНТЕРПРЕТАЦИЯ / РИСК', { size: 21, fill: '#10111a', weight: 900, spacing: 1 })}
    ${tx(100, 586, '+74,7%', { size: 81, fill: C.ink, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
    ${tx(640, 586, `−${drawdownPct.toFixed(1).replace('.', ',')}%`, { size: 55, fill: C.risk, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
    ${line(100, 630, 976, 630, C.grid, 3)}
    ${rect(100, 688, 30, 30, C.accent)}
    ${tx(158, 712, 'ПОДТВЕРЖДЁННЫЕ СВЕЧИ И ОБОРОТ', { size: 22, fill: C.ink, weight: 900 })}
    ${rect(100, 792, 30, 30, C.risk)}
    ${tx(158, 816, 'ПРИЧИНА РОСТА НЕ ДОКАЗАНА', { size: 22, fill: C.ink, weight: 900 })}
    ${rect(100, 892, 30, 30, C.secondary)}
    ${tx(158, 916, 'РОЛЬ ТОКЕНА В ИНИЦИАТИВЕ НЕ ПОДТВЕРЖДЕНА', { size: 20, fill: C.ink, weight: 900 })}
    ${tx(100, 1044, 'НЕ ИНВЕСТИЦИОННАЯ РЕКОМЕНДАЦИЯ', { size: 21, fill: C.risk, weight: 900, spacing: 1 })}
    ${tx(100, 1262, 'QNT / 27.09.2026 UTC', { size: 19, fill: C.muted, weight: 800, family: 'DejaVu Sans Mono, monospace' })}
  `;
}

function typeBody(index, t, C) {
  const cut = ease(t / 0.36);
  if (index === 0) {
    return `
      ${tx(540, 660, 'QNT', { size: 212, fill: C.ink, anchor: 'middle', weight: 900, spacing: -8, transform: `translate(0 ${(1 - cut) * 90})` })}
      ${tx(40, 1010, '+74,7%', { size: 202, fill: C.accent, weight: 900, spacing: -11, transform: `rotate(-7 540 950)` })}
      ${rect(76, 1100, 854, 12, C.ink, { transform: `scale(${cut} 1)` })}
      ${tx(82, 1190, 'ЗА 24 ЗАКРЫТЫХ ЧАСА', { size: 27, fill: C.ink, weight: 900, spacing: 2 })}
      ${tx(82, 1280, '$103,04', { size: 45, fill: C.muted, weight: 800, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(530, 1280, '→', { size: 43, fill: C.accent, weight: 900 })}
      ${tx(965, 1280, '$180,06', { size: 45, fill: C.ink, anchor: 'end', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(82, 1380, 'ИСТОРИЧЕСКИЕ ДАННЫЕ · 27.09.2026 UTC', { size: 18, fill: C.muted, weight: 700, spacing: 1 })}
    `;
  }
  if (index === 1) {
    return `
      ${tx(30, 588, '24', { size: 264, fill: '#dedbd2', weight: 900, spacing: -15 })}
      ${tx(545, 490, 'ЧАСОВЫХ', { size: 49, fill: C.ink, weight: 900, spacing: 2 })}
      ${tx(545, 554, 'СВЕЧЕЙ', { size: 49, fill: C.accent, weight: 900, spacing: 2 })}
      ${candlesSvg(140, 670, 820, 570, t, C.secondary, C.risk, { grid: C.grid, muted: C.muted, revealSeconds: 3.2, priceLabels: false, candleWidthFactor: 0.58 })}
      ${tx(94, 1313, '$180,06', { size: 49, fill: C.ink, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(980, 1313, `−${drawdownPct.toFixed(1).replace('.', ',')}% ОТ ПИКА`, { size: 20, fill: C.risk, anchor: 'end', weight: 900 })}
    `;
  }
  if (index === 2) {
    const reveal = ease(t / 1.2);
    return `
      ${tx(40, 710, '$86', { size: 216, fill: C.ink, weight: 900, spacing: -11 })}
      ${tx(540, 710, ',2', { size: 92, fill: C.accent, weight: 900 })}
      ${tx(760, 710, 'МЛН', { size: 42, fill: C.muted, weight: 900 })}
      ${rect(76, 785, 870 * reveal, 10, C.accent)}
      ${volumeSvg(106, 900, 868, 290, t, C.secondary, C.risk, C.grid, { secondary: C.accent, revealSeconds: 2.8 })}
      ${tx(86, 1274, `${volumeMultiple.toFixed(1).replace('.', ',')}×`, { size: 91, fill: C.accent, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${tx(500, 1274, 'СЕМЬДНЕВНОГО СРЕДНЕГО', { size: 21, fill: C.ink, weight: 900, spacing: 1 })}
      ${tx(86, 1367, 'ОБОРОТ · BINANCE SPOT · QNT/USDT', { size: 18, fill: C.muted, weight: 800 })}
    `;
  }
  if (index === 3) {
    return `
      ${tx(78, 480, '«', { size: 196, fill: C.accent, weight: 900 })}
      ${multiline(162, 600, ['Quant powers The', 'Clearing House’s', 'On-Chain Money', 'Initiative in the US'], { size: 40, lineHeight: 64, fill: C.ink, weight: 850 })}
      ${line(164, 918, 920, 918, C.ink, 4)}
      ${tx(164, 1000, 'OFFICIAL NEWS · 24.09.2026', { size: 20, fill: C.secondary, weight: 900, spacing: 2 })}
      ${tx(84, 1154, 'НЕ РАВНО', { size: 45, fill: C.muted, weight: 900, spacing: 2 })}
      ${tx(84, 1230, 'ПРИЧИНА', { size: 91, fill: C.risk, weight: 900, spacing: -2 })}
      ${tx(84, 1310, 'И НЕ ДОКАЗЫВАЕТ РОЛЬ QNT', { size: 20, fill: C.ink, weight: 900, spacing: 1 })}
    `;
  }
  if (index === 4) {
    return `
      ${tx(62, 495, 'QNT', { size: 75, fill: C.ink, weight: 900, spacing: 1 })}
      ${tx(1018, 495, '+74,7%', { size: 47, fill: C.accent, anchor: 'end', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${line(62, 540, 1018, 540, C.ink, 3)}
      ${tx(66, 712, 'BTC', { size: 30, fill: C.muted, weight: 900 })}
      ${tx(1016, 712, '+0,7%', { size: 52, fill: C.secondary, anchor: 'end', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${rect(66, 738, 956, 8, C.secondary, { transform: `scale(${ease(t / 0.7)} 1)` })}
      ${tx(66, 916, 'ETH', { size: 30, fill: C.muted, weight: 900 })}
      ${tx(1016, 916, '+0,9%', { size: 52, fill: C.ink, anchor: 'end', weight: 900, family: 'DejaVu Sans Mono, monospace' })}
      ${rect(66, 942, 956, 8, C.ink, { transform: `scale(${ease((t - 0.2) / 0.7)} 1)` })}
      ${tx(66, 1132, 'ТОТ ЖЕ ПЕРИОД', { size: 20, fill: C.muted, weight: 800, spacing: 2 })}
      ${tx(66, 1218, 'QNT — ВЫШЕ', { size: 49, fill: C.accent, weight: 900 })}
      ${tx(66, 1286, 'И ВОЛАТИЛЬНЕЕ', { size: 49, fill: C.risk, weight: 900 })}
      ${tx(66, 1374, 'BINANCE SPOT · UTC', { size: 18, fill: C.muted, weight: 800 })}
    `;
  }
  return `
    ${tx(540, 480, 'ИМПУЛЬС', { size: 61, fill: C.ink, anchor: 'middle', weight: 900, spacing: 5 })}
    ${tx(540, 670, '≠', { size: 124, fill: C.accent, anchor: 'middle', weight: 900 })}
    ${tx(540, 854, 'ГАРАНТИЯ', { size: 91, fill: C.risk, anchor: 'middle', weight: 900, spacing: -1 })}
    ${line(116, 920, 964, 920, C.ink, 4)}
    ${tx(112, 1050, '+74,7%', { size: 61, fill: C.accent, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
    ${tx(112, 1114, 'ЗА 24 ЧАСА', { size: 19, fill: C.muted, weight: 900, spacing: 2 })}
    ${tx(568, 1050, `−${drawdownPct.toFixed(1).replace('.', ',')}%`, { size: 54, fill: C.risk, weight: 900, family: 'DejaVu Sans Mono, monospace' })}
    ${tx(568, 1114, 'ОТ ПИКА', { size: 19, fill: C.muted, weight: 900, spacing: 2 })}
    ${tx(112, 1256, 'ПРИЧИНА РОСТА', { size: 25, fill: C.ink, weight: 900 })}
    ${tx(112, 1313, 'НЕ ДОКАЗАНА', { size: 25, fill: C.risk, weight: 900 })}
    ${tx(112, 1380, 'НЕ ИНВЕСТИЦИОННАЯ РЕКОМЕНДАЦИЯ', { size: 17, fill: C.muted, weight: 800 })}
  `;
}

const BODY_RENDERERS = [impactBody, dossierBody, orbitBody, collageBody, typeBody];

function frameBackground(style, t, globalTime) {
  const C = style.colors;
  if (style.id === '01-impact') {
    let grid = '';
    for (let x = 44; x <= WIDTH; x += 86) grid += line(x, 168, x, 1430, C.grid, 1, { opacity: 0.18 });
    for (let y = 180; y <= 1440; y += 86) grid += line(42, y, 1038, y, C.grid, 1, { opacity: 0.18 });
    return `${rect(0, 0, WIDTH, HEIGHT, C.bg)}${grid}`;
  }
  if (style.id === '02-dossier') {
    let ruled = '';
    for (let y = 198; y < 1435; y += 62) ruled += line(42, y, 1038, y, C.grid, 1, { opacity: 0.35 });
    return `${rect(0, 0, WIDTH, HEIGHT, C.bg)}${ruled}${rect(24, 24, 1032, 1870, 'none', { stroke: C.grid, strokeWidth: 2 })}`;
  }
  if (style.id === '03-orbit') {
    const drift = Math.sin(globalTime * 0.35) * 22;
    return `${rect(0, 0, WIDTH, HEIGHT, C.bg)}${circle(540 + drift, 890, 490, 'none', { stroke: C.grid, strokeWidth: 1, opacity: 0.58 })}${circle(540 + drift, 890, 400, 'none', { stroke: C.grid, strokeWidth: 1, opacity: 0.38 })}${line(540 + drift, 150, 540 + drift, 1435, C.grid, 1, { opacity: 0.34 })}`;
  }
  if (style.id === '04-collage') {
    const shift = (globalTime * 74) % 1080;
    return `${rect(0, 0, WIDTH, HEIGHT, C.bg)}${rect(0, 135, 62, 1305, C.accent)}${rect(820, 140, 260, 450, C.secondary, { opacity: 0.22, transform: `rotate(${Math.sin(t) * 1.2} 950 365)` })}${rect(-shift, 1390, WIDTH, 20, C.secondary, { opacity: 0.7 })}${rect(1080 - shift, 1390, WIDTH, 20, C.secondary, { opacity: 0.7 })}`;
  }
  let marks = '';
  for (let y = 196; y <= 1410; y += 80) marks += line(54, y, 72, y, C.grid, 2);
  return `${rect(0, 0, WIDTH, HEIGHT, C.bg)}${marks}${rect(42, 182, 996, 1264, 'none', { stroke: C.grid, strokeWidth: 1 })}`;
}

function sceneTransition(style, index, t) {
  if (index === 0 || t > 0.42) return '';
  const p = clamp(t / 0.42);
  const C = style.colors;
  switch (style.id) {
    case '01-impact':
      return `<polygon points="${-260 + p * 1400},142  ${-170 + p * 1400},142  ${-400 + p * 1400},1450  ${-500 + p * 1400},1450" fill="${C.accent}" opacity="${(1 - p) * 0.22}"/>`;
    case '02-dossier':
      return `<path d="M${-220 + p * 1300} 170 L${-40 + p * 1300} 170 L${-190 + p * 1300} 1430 L${-380 + p * 1300} 1430 Z" fill="${C.bg}" opacity="${(1 - p) * 0.3}"/>`;
    case '03-orbit':
      return `<circle cx="540" cy="870" r="${30 + p * 650}" fill="none" stroke="${C.accent}" stroke-width="${Math.max(2, 16 - p * 14)}" opacity="${(1 - p) * 0.55}"/>`;
    case '04-collage':
      return `${rect(-500 + p * 900, 180, 480, 1260, C.secondary, { opacity: (1 - p) * 0.55 })}${rect(1100 - p * 940, 180, 440, 1260, C.accent, { opacity: (1 - p) * 0.38 })}`;
    default:
      return `${tx(80 + p * 690, 880, ['QNT', '24H', 'VOLUME', 'NEWS', 'MARKET', 'RISK'][index], { size: 108, fill: C.accent, weight: 900, opacity: (1 - p) * 0.22 })}`;
  }
}

function sceneAt(time) {
  const index = SEGMENTS.findIndex((segment) => time < segment.end);
  const safeIndex = index < 0 ? SEGMENTS.length - 1 : index;
  const segment = SEGMENTS[safeIndex];
  return { segment, index: safeIndex, relativeTime: Math.max(0, Math.min(time - segment.start, segment.end - segment.start)) };
}

function renderSvg(style, frame) {
  const time = Math.min(frame / FPS, SCRIPT_DURATION);
  const { segment, index, relativeTime } = sceneAt(time);
  const C = style.colors;
  const body = BODY_RENDERERS[VARIANTS.indexOf(style)](index, relativeTime, C);
  const global = chartRibbon(style, segment, index, relativeTime, time);
  const background = frameBackground(style, relativeTime, time);
  const transition = sceneTransition(style, index, relativeTime);
  const captions = captionPlate(style, index, segment.caption);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${background}
    ${global}
    ${body}
    ${transition}
    ${captions}
  </svg>`;
}

function parseOptions(args) {
  let variantId = null;
  let outputName = null;
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag !== '--variant' && flag !== '--output') {
      throw new Error(`Неизвестный аргумент: ${flag}`);
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Для ${flag} требуется значение.`);
    }
    if (flag === '--variant') variantId = value;
    if (flag === '--output') outputName = value;
    index += 1;
  }
  if (outputName && !variantId) {
    throw new Error('--output можно использовать только вместе с --variant.');
  }
  if (outputName && (path.basename(outputName) !== outputName || !outputName.endsWith('.mp4'))) {
    throw new Error('--output должен быть именем MP4-файла без пути к папке.');
  }
  return { variantId, outputName };
}

async function renderVariant(style, workDir, outputName) {
  const output = path.join(OUTPUT_DIR, outputName ?? `qnt-${style.id}.mp4`);
  try {
    await access(output);
    throw new Error(`Refusing to overwrite an existing variant: ${output}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Refusing to overwrite')) throw error;
  }

  const frameDir = path.join(workDir, style.id);
  await mkdir(frameDir, { recursive: true });
  for (let frame = 0; frame < FRAME_COUNT; frame += 1) {
    await writeFile(path.join(frameDir, `${String(frame).padStart(5, '0')}.svg`), renderSvg(style, frame), 'utf8');
  }
  await mkdir(OUTPUT_DIR, { recursive: true });
  const args = [
    '-y', '-loglevel', 'warning',
    '-framerate', String(FPS),
    '-start_number', '0',
    '-i', path.join(frameDir, '%05d.svg'),
    '-i', SOURCE,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-frames:v', String(FRAME_COUNT),
    '-t', OUTPUT_DURATION.toFixed(3),
    '-r', String(FPS),
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'copy',
    '-movflags', '+faststart',
    output,
  ];
  await execFile('ffmpeg', args, { timeout: 300_000, maxBuffer: 8 * 1024 * 1024 });
  const { stdout } = await execFile('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    output,
  ]);
  const probe = JSON.parse(stdout);
  const video = probe.streams.find((stream) => stream.codec_type === 'video');
  const audio = probe.streams.find((stream) => stream.codec_type === 'audio');
  const duration = Number.parseFloat(probe.format.duration);
  if (
    video?.codec_name !== 'h264'
    || video.width !== WIDTH
    || video.height !== HEIGHT
    || video.r_frame_rate !== `${FPS}/1`
    || audio?.codec_name !== 'aac'
    || Math.abs(duration - OUTPUT_DURATION) > 0.05
  ) {
    throw new Error(`Invalid output for ${style.id}: ${stdout}`);
  }
  console.log(`Готово: ${path.basename(output)} · ${duration.toFixed(3)} с · ${probe.format.size} байт`);
  return { style, output, duration, size: Number(probe.format.size) };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const selectedStyle = options.variantId
    ? VARIANTS.find((style) => style.id === options.variantId)
    : null;
  if (options.variantId && !selectedStyle) {
    throw new Error(`Неизвестный вариант: ${options.variantId}. Доступны: ${VARIANTS.map((style) => style.id).join(', ')}`);
  }
  await access(SOURCE);
  if (!selectedStyle) {
    const existing = await readdir(OUTPUT_DIR).catch((error) => {
      if (error?.code === 'ENOENT') return [];
      throw error;
    });
    if (existing.length) {
      throw new Error(`Папка ${OUTPUT_DIR} уже содержит файлы. Чтобы не затереть варианты, сначала проверьте её содержимое.`);
    }
  }
  const workDir = await mkdtemp(path.join('/tmp', 'qnt-visual-variants-'));
  try {
    console.log(`Источник: ${SOURCE}`);
    console.log(`Сценарий и звуковая дорожка не меняются; итоговая длительность: ${OUTPUT_DURATION.toFixed(3)} с.`);
    const rendered = [];
    if (selectedStyle) {
      rendered.push(await renderVariant(selectedStyle, workDir, options.outputName));
      console.log(`Выбранный вариант готов: ${rendered[0].output}`);
    } else {
      for (const style of VARIANTS) rendered.push(await renderVariant(style, workDir));
      const manifest = rendered.map(({ style, output, duration, size }) => [
        `## ${style.name}`,
        '',
        style.concept,
        '',
        `- Файл: ${path.basename(output)}`,
        `- Длительность: ${duration.toFixed(3)} с`,
        `- Размер: ${size} байт`,
        '- Сценарий, исторические данные, голос и исходный микс сохранены.',
        '',
      ].join('\n')).join('\n');
      await writeFile(path.join(OUTPUT_DIR, 'README.md'), [
        '# QNT — пять визуальных вариантов',
        '',
        'Все варианты используют одну и ту же озвучку и монтажные границы из исходного QNT-клипа. Новые визуальные направления меняют композицию, графический язык и переходы, но не переписывают текст, не меняют QNT и не обновляют исторический срез.',
        '',
        'Исходный срез: Binance Spot, 26.09.2026 09:00 — 27.09.2026 09:00 UTC. Финальный видеоряд — 1080×1920, 30 fps. Длительность совпадает с готовым сценарием: около 39,2 секунды.',
        '',
        manifest,
      ].join('\n'), 'utf8');
      console.log(`Все пять вариантов готовы: ${OUTPUT_DIR}`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});