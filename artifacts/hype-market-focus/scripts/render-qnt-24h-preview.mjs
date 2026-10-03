import { createHash } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { generateLumeanSpeech } from '../../api-server/src/lib/audio-generation/lumean-client.ts';

const execFile = promisify(execFileCallback);
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'exports');
const TEMP_DIR = path.join('/tmp', `qnt-24h-preview-${process.pid}`);
const VOICE_CACHE_DIR = path.join('/tmp', 'qnt-24h-preview-voice-cache');
const OUTPUT = path.join(OUT_DIR, 'qnt-24h-market-preview.mp4');
const MUSIC = path.resolve(import.meta.dirname, '..', '..', 'api-server', 'assets', 'audio', 'financial-user-music-bed.mp3');

const MARKET = {
  symbol: 'QNTUSDT',
  open: 103.04,
  close: 180.06,
  high: 194.95,
  low: 102.78,
  changePct: 74.74767080745342,
  quoteVolume: 86190793.07445,
  averageDailyVolume7d: 7971718.190658571,
  btcChangePct: 0.6886605689075509,
  ethChangePct: 0.876625789669272,
  startUtc: '2026-09-26 09:00',
  endUtc: '2026-09-27 09:00',
  snapshotUtc: '2026-09-27 09:00',
  retrievedUtc: '2026-09-27 09:13',
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

const volumeMultiple = MARKET.quoteVolume / MARKET.averageDailyVolume7d;
const drawdownPct = (1 - MARKET.close / MARKET.high) * 100;

const SCENES = [
  {
    key: 'hook',
    title: 'QNT / ИМПУЛЬС',
    minDuration: 5.2,
    tail: 0.18,
    voice:
      'QNT на Binance Spot: плюс семьдесят четыре целых семь десятых процента за двадцать четыре закрытых часа.',
    caption:
      'QNT на Binance Spot: плюс 74,7 процента за 24 закрытых часа.',
  },
  {
    key: 'candles',
    title: '24 ЧАСА · ЯПОНСКИЕ СВЕЧИ',
    minDuration: 6.8,
    tail: 0.18,
    voice:
      'От ста трёх до ста восьмидесяти. Сейчас цена на семь целых шесть десятых процента ниже пика.',
    caption:
      'От $103 до $180. Сейчас цена на 7,6 процента ниже пика.',
  },
  {
    key: 'volume',
    title: 'ОБЪЁМ · ПОДТВЕРЖДЕНИЕ?',
    minDuration: 6.3,
    tail: 0.18,
    voice:
      'Объём — восемьдесят шесть миллионов, почти в одиннадцать раз выше недельного среднего. Это не гарантия спроса.',
    caption:
      'Объём — $86 млн, почти в 11 раз выше недельного среднего. Это не гарантия спроса.',
  },
  {
    key: 'news',
    title: 'ВОЗМОЖНЫЙ НОВОСТНОЙ ФОН',
    minDuration: 6.6,
    tail: 0.18,
    voice:
      'Quant сообщила об инициативе с The Clearing House. Причина роста и роль токена QNT не доказаны.',
    caption:
      'Quant сообщила об инициативе с The Clearing House. Причина роста и роль QNT не доказаны.',
  },
  {
    key: 'comparison',
    title: 'ТОТ ЖЕ ПЕРИОД',
    minDuration: 5.4,
    tail: 0.18,
    voice:
      'Биткоин прибавил ноль целых семь десятых, эфир — ноль целых девять. QNT заметно волатильнее.',
    caption:
      'Биткоин прибавил 0,7 процента, эфир — 0,9. QNT заметно волатильнее.',
  },
  {
    key: 'outlook',
    title: 'ИМПУЛЬС — НЕ ГАРАНТИЯ',
    minDuration: 5.2,
    tail: 0.95,
    voice:
      'Рост резкий, откат заметен. Причина не доказана. Не инвестиционная рекомендация.',
    caption:
      'Импульс сильный, но заметны откат и аномальный объём. Причина не доказана, волатильность высока. Не инвестиционная рекомендация.',
  },
];

const COLORS = {
  bg: '#080c0b',
  bg2: '#111816',
  panel: '#101714',
  panel2: '#16211b',
  grid: '#26332c',
  text: '#f2f5ef',
  muted: '#91a097',
  green: '#d6ff39',
  greenDim: '#91b92c',
  red: '#ff6559',
  blue: '#82a7ff',
  white: '#ffffff',
};

function clamp(value, low = 0, high = 1) {
  return Math.min(high, Math.max(low, value));
}

function ease(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapWords(value, maxChars = 42) {
  const words = value.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
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

function text(x, y, value, options = {}) {
  const {
    size = 32,
    fill = COLORS.text,
    weight = 500,
    anchor = 'start',
    family = 'DejaVu Sans, sans-serif',
    letterSpacing = 0,
    opacity = 1,
  } = options;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}px" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letterSpacing}px" opacity="${opacity}">${escapeXml(value)}</text>`;
}

function multiLine(x, y, lines, options = {}) {
  const { size = 36, lineHeight = 48, ...textOptions } = options;
  return `<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="${size}px" font-weight="${textOptions.weight ?? 500}" fill="${textOptions.fill ?? COLORS.text}" text-anchor="${textOptions.anchor ?? 'start'}" letter-spacing="${textOptions.letterSpacing ?? 0}px">${lines
    .map((line, index) => `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`)
    .join('')}</text>`;
}

function commonFrame(scene, sceneIndex, relativeTime, totalDuration) {
  const enter = ease(relativeTime / 0.34);
  const elapsed = SCENES.slice(0, sceneIndex).reduce((sum, item) => sum + item.duration, 0) + relativeTime;
  const globalProgress = clamp(elapsed / totalDuration);
  const progressWidth = 920 * globalProgress;
  const glowX = 790 + Math.sin(relativeTime * 0.9 + sceneIndex) * 70;

  return `
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="0.9" y2="1">
        <stop offset="0" stop-color="${COLORS.bg}"/>
        <stop offset="1" stop-color="${COLORS.bg2}"/>
      </linearGradient>
      <radialGradient id="glow">
        <stop offset="0" stop-color="${sceneIndex === 1 || sceneIndex === 2 ? COLORS.green : COLORS.blue}" stop-opacity=".12"/>
        <stop offset="1" stop-color="${COLORS.bg}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="microgrid" width="54" height="54" patternUnits="userSpaceOnUse">
        <path d="M54 0H0V54" fill="none" stroke="${COLORS.grid}" stroke-width="1" opacity=".23"/>
      </pattern>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="26"/>
      </filter>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#microgrid)" opacity=".4"/>
    <ellipse cx="${glowX}" cy="730" rx="520" ry="630" fill="url(#glow)" filter="url(#softGlow)"/>
    <rect x="72" y="84" width="936" height="1.5" fill="${COLORS.grid}" opacity=".8"/>
    <rect x="72" y="84" width="${progressWidth}" height="3" fill="${COLORS.green}" opacity=".88"/>
    ${text(76, 65, 'MARKET / QNT', { size: 22, fill: COLORS.muted, weight: 700, letterSpacing: 2 })}
    ${text(1004, 65, `${String(sceneIndex + 1).padStart(2, '0')} / 06`, { size: 22, fill: COLORS.muted, weight: 600, anchor: 'end', family: 'DejaVu Sans Mono, monospace' })}
    <g opacity="${enter}" transform="translate(0 ${32 * (1 - enter)})">
      ${text(78, 150, scene.title, { size: 23, fill: COLORS.green, weight: 700, letterSpacing: 2 })}
    </g>
  `;
}

function captionFrame(scene, sceneIndex, relativeTime) {
  const alpha = ease(relativeTime / 0.25);
  const lines = wrapWords(scene.caption, 44);
  const lineHeight = 45;
  const startY = 1518 + Math.max(0, (4 - lines.length) * 14);
  const source = sceneIndex === 3
    ? 'ИСТОЧНИК: QUANT · ОФИЦИАЛЬНАЯ ЛЕНТА · 24.09.2026'
    : 'BINANCE SPOT · QNTUSDT · 1H OHLC · UTC';
  return `
    <g opacity="${alpha}">
      <rect x="64" y="1456" width="952" height="330" rx="28" fill="${COLORS.panel}" fill-opacity=".96" stroke="${COLORS.grid}" stroke-width="2"/>
      ${multiLine(98, startY, lines, { size: 34, lineHeight, fill: COLORS.text, weight: 550 })}
      <rect x="98" y="1747" width="884" height="1" fill="${COLORS.grid}"/>
      ${text(98, 1780, source, { size: 18, fill: COLORS.muted, weight: 600, letterSpacing: 1 })}
    </g>
  `;
}

function sceneHook(relativeTime) {
  const p = ease(relativeTime / 0.9);
  const ring = Math.max(0, 1 - relativeTime / 6);
  return `
    <g opacity="${p}" transform="translate(0 ${54 * (1 - p)})">
      <circle cx="540" cy="670" r="278" fill="none" stroke="${COLORS.green}" stroke-opacity=".12" stroke-width="2"/>
      <circle cx="540" cy="670" r="228" fill="none" stroke="${COLORS.green}" stroke-opacity=".45" stroke-width="2" stroke-dasharray="3 16" transform="rotate(${relativeTime * 8} 540 670)"/>
      <circle cx="540" cy="670" r="174" fill="${COLORS.panel}" stroke="${COLORS.grid}" stroke-width="2"/>
      <circle cx="540" cy="670" r="158" fill="none" stroke="${COLORS.green}" stroke-width="8" stroke-dasharray="${Math.round(990 * ring)} 1000" transform="rotate(-90 540 670)" stroke-linecap="round"/>
      ${text(540, 660, 'QNT', { size: 86, fill: COLORS.text, weight: 800, anchor: 'middle', letterSpacing: 5 })}
      ${text(540, 714, 'BINANCE SPOT', { size: 22, fill: COLORS.muted, weight: 600, anchor: 'middle', letterSpacing: 2 })}
    </g>
    <g opacity="${p}" transform="translate(0 ${76 * (1 - p)})">
      ${text(540, 1080, '+74,7%', { size: 158, fill: COLORS.green, weight: 800, anchor: 'middle', letterSpacing: -4 })}
      ${text(540, 1150, 'ЗА 24 ЗАКРЫТЫХ ЧАСА', { size: 25, fill: COLORS.text, weight: 700, anchor: 'middle', letterSpacing: 2 })}
      ${text(540, 1212, '$103,04  →  $180,06', { size: 34, fill: COLORS.muted, weight: 600, anchor: 'middle', family: 'DejaVu Sans Mono, monospace' })}
    </g>
    ${text(78, 1405, 'Срез: 26.09.2026 09:00 — 27.09.2026 09:00 UTC', { size: 20, fill: COLORS.muted, weight: 500 })}
  `;
}

function sceneCandles(relativeTime) {
  const chart = { x: 152, y: 330, w: 780, h: 850 };
  const minimum = 95;
  const maximum = 202;
  const yOf = (price) => chart.y + chart.h - ((price - minimum) / (maximum - minimum)) * chart.h;
  const reveal = clamp(relativeTime / 3.0);
  const visible = Math.min(MARKET.hourly.length, Math.ceil(reveal * MARKET.hourly.length));
  const candleSlot = chart.w / MARKET.hourly.length;
  const candleWidth = Math.max(13, candleSlot * 0.48);
  let grid = '';
  for (const level of [100, 125, 150, 175, 200]) {
    const y = yOf(level);
    grid += `<line x1="${chart.x}" y1="${y}" x2="${chart.x + chart.w}" y2="${y}" stroke="${COLORS.grid}" stroke-width="1.5"/>`;
    grid += text(chart.x - 18, y + 7, `$${level}`, { size: 20, fill: COLORS.muted, weight: 500, anchor: 'end', family: 'DejaVu Sans Mono, monospace' });
  }

  let candles = '';
  let volume = '';
  for (let index = 0; index < visible; index += 1) {
    const [open, high, low, close, quoteVolume] = MARKET.hourly[index];
    const cx = chart.x + candleSlot * (index + 0.5);
    const yHigh = yOf(high);
    const yLow = yOf(low);
    const yOpen = yOf(open);
    const yClose = yOf(close);
    const color = close >= open ? COLORS.green : COLORS.red;
    const bodyY = Math.min(yOpen, yClose);
    const bodyH = Math.max(5, Math.abs(yOpen - yClose));
    candles += `<g opacity="${clamp((relativeTime - index * 0.055) / 0.25)}">
      <line x1="${cx}" y1="${yHigh}" x2="${cx}" y2="${yLow}" stroke="${color}" stroke-width="3"/>
      <rect x="${cx - candleWidth / 2}" y="${bodyY}" width="${candleWidth}" height="${bodyH}" rx="2" fill="${color}"/>
    </g>`;
    const volumeH = (quoteVolume / 11870645.60167) * 120;
    volume += `<rect x="${cx - candleWidth / 2}" y="${1360 - volumeH}" width="${candleWidth}" height="${volumeH}" rx="2" fill="${color}" opacity=".72"/>`;
  }

  let timeLabels = '';
  const labels = ['09', '13', '17', '21', '01', '05', '08'];
  const labelIndexes = [0, 4, 8, 12, 16, 20, 23];
  labelIndexes.forEach((index, i) => {
    const x = chart.x + candleSlot * (index + 0.5);
    timeLabels += text(x, 1410, labels[i], { size: 18, fill: COLORS.muted, weight: 600, anchor: 'middle', family: 'DejaVu Sans Mono, monospace' });
  });

  const currentY = yOf(MARKET.close);
  const currentAlpha = ease((relativeTime - 2.4) / 0.4);
  const highY = yOf(MARKET.high);
  return `
    <g>
      ${grid}
      <rect x="${chart.x}" y="${chart.y}" width="${chart.w}" height="${chart.h}" fill="none" stroke="${COLORS.grid}" stroke-width="2"/>
      ${candles}
      <line x1="${chart.x}" y1="1360" x2="${chart.x + chart.w}" y2="1360" stroke="${COLORS.grid}" stroke-width="2"/>
      ${volume}
      ${timeLabels}
      <line x1="${chart.x + chart.w - 6}" y1="${currentY}" x2="${chart.x + chart.w + 12}" y2="${currentY}" stroke="${COLORS.green}" stroke-width="2" opacity="${currentAlpha}"/>
      ${text(chart.x + chart.w + 20, currentY + 8, '$180,06', { size: 20, fill: COLORS.green, weight: 700, opacity: currentAlpha, family: 'DejaVu Sans Mono, monospace' })}
      <circle cx="${chart.x + chart.w - 10}" cy="${highY}" r="8" fill="${COLORS.red}" opacity="${currentAlpha}"/>
      ${text(chart.x + 34, 294, 'LOW $102,78', { size: 21, fill: COLORS.muted, weight: 700, opacity: currentAlpha })}
      ${text(520, 294, 'HIGH $194,95', { size: 21, fill: COLORS.red, weight: 700, anchor: 'middle', opacity: currentAlpha })}
      ${text(1000, 294, `−${drawdownPct.toFixed(1).replace('.', ',')}% ОТ ПИКА`, { size: 21, fill: COLORS.text, weight: 700, anchor: 'end', opacity: currentAlpha })}
    </g>
  `;
}

function sceneVolume(relativeTime) {
  const chart = { x: 126, y: 570, w: 828, h: 590 };
  const slot = chart.w / MARKET.hourly.length;
  const maxVolume = 11870645.60167;
  const visible = Math.min(MARKET.hourly.length, Math.ceil(clamp(relativeTime / 2.5) * MARKET.hourly.length));
  let bars = '';
  for (let index = 0; index < visible; index += 1) {
    const [open, , , close, qv] = MARKET.hourly[index];
    const h = (qv / maxVolume) * chart.h;
    const color = close >= open ? COLORS.green : COLORS.red;
    const x = chart.x + slot * (index + 0.5);
    const y = chart.y + chart.h - h;
    bars += `<rect x="${x - slot * 0.28}" y="${y}" width="${slot * 0.56}" height="${h}" rx="4" fill="${color}" opacity=".86"/>`;
  }
  const avgLineY = chart.y + chart.h - (7971718.190658571 / maxVolume) * chart.h;
  const metricEnter = ease((relativeTime - 0.28) / 0.65);
  return `
    ${text(126, 395, '$86,2 млн', { size: 112, fill: COLORS.text, weight: 800, opacity: metricEnter, letterSpacing: -3 })}
    ${text(130, 458, 'ОБОРОТ ЗА 24 ПОЛНЫЕ ЧАСА · QNT/USDT', { size: 21, fill: COLORS.muted, weight: 600, opacity: metricEnter, letterSpacing: 1 })}
    <g>
      <line x1="${chart.x}" y1="${avgLineY}" x2="${chart.x + chart.w}" y2="${avgLineY}" stroke="${COLORS.blue}" stroke-width="3" stroke-dasharray="12 12" opacity=".9"/>
      ${bars}
      <line x1="${chart.x}" y1="${chart.y + chart.h}" x2="${chart.x + chart.w}" y2="${chart.y + chart.h}" stroke="${COLORS.grid}" stroke-width="2"/>
      ${text(chart.x + chart.w - 2, avgLineY - 16, 'СРЕДНЕЕ ЗА 7 ДНЕЙ', { size: 18, fill: COLORS.blue, weight: 700, anchor: 'end', letterSpacing: 1 })}
    </g>
    <g opacity="${metricEnter}" transform="translate(0 ${40 * (1 - metricEnter)})">
      <rect x="126" y="1234" width="828" height="112" rx="20" fill="${COLORS.panel2}" stroke="${COLORS.grid}" stroke-width="2"/>
      ${text(164, 1304, `${volumeMultiple.toFixed(1).replace('.', ',')}×`, { size: 70, fill: COLORS.green, weight: 800, family: 'DejaVu Sans Mono, monospace' })}
      ${text(420, 1290, 'К СРЕДНЕМУ ОБЪЁМУ', { size: 23, fill: COLORS.text, weight: 700, letterSpacing: 1 })}
      ${text(420, 1324, 'СЕМЬ ПРЕДЫДУЩИХ ПОЛНЫХ ДНЕЙ', { size: 18, fill: COLORS.muted, weight: 600, letterSpacing: 1 })}
    </g>
    ${text(126, 1402, 'Binance Spot · Quote volume в USDT', { size: 19, fill: COLORS.muted, weight: 500 })}
  `;
}

function sceneNews(relativeTime) {
  const p = ease(relativeTime / 0.75);
  const drift = 54 * (1 - p);
  const cardX = 78 + drift;
  return `
    <g opacity="${p}" transform="translate(${drift} 0)">
      <circle cx="540" cy="515" r="180" fill="none" stroke="${COLORS.blue}" stroke-opacity=".24" stroke-width="2"/>
      <circle cx="540" cy="515" r="146" fill="${COLORS.panel}" stroke="${COLORS.blue}" stroke-opacity=".55" stroke-width="2"/>
      ${text(540, 484, '24', { size: 108, fill: COLORS.text, weight: 800, anchor: 'middle' })}
      ${text(540, 540, 'СЕНТЯБРЯ', { size: 20, fill: COLORS.blue, weight: 700, anchor: 'middle', letterSpacing: 2 })}
      <rect x="${cardX}" y="752" width="924" height="534" rx="30" fill="${COLORS.panel}" stroke="${COLORS.grid}" stroke-width="2"/>
      ${text(124 + drift, 814, 'ОФИЦИАЛЬНАЯ ЛЕНТА QUANT', { size: 20, fill: COLORS.blue, weight: 700, letterSpacing: 1 })}
      ${multiLine(124 + drift, 906, [
        'Quant powers The Clearing',
        'House’s On-Chain Money',
        'Initiative in the US',
      ], { size: 45, lineHeight: 66, fill: COLORS.text, weight: 750 })}
      <line x1="${124 + drift}" y1="1110" x2="${936 + drift}" y2="1110" stroke="${COLORS.grid}" stroke-width="2"/>
      ${text(124 + drift, 1172, 'ВОЗМОЖНЫЙ НОВОСТНОЙ ФОН', { size: 23, fill: COLORS.green, weight: 700, letterSpacing: 1 })}
      ${text(124 + drift, 1224, 'Не доказательство причины роста', { size: 26, fill: COLORS.text, weight: 600 })}
    </g>
    <g opacity="${ease((relativeTime - 1.0) / 0.55)}">
      <rect x="78" y="1330" width="924" height="84" rx="18" fill="#241714" stroke="${COLORS.red}" stroke-opacity=".7" stroke-width="2"/>
      ${text(540, 1384, 'РОЛЬ ТОКЕНА QNT ЭТИМ НЕ ПОДТВЕРЖДЕНА', { size: 22, fill: COLORS.red, weight: 700, anchor: 'middle', letterSpacing: 1 })}
    </g>
  `;
}

function sceneComparison(relativeTime) {
  const p = ease(relativeTime / 1.0);
  const cards = [
    { label: 'QNT', value: '+74,7%', detail: '24 ЗАКРЫТЫХ 1H-СВЕЧИ', color: COLORS.green, y: 456, big: true },
    { label: 'BITCOIN', value: '+0,7%', detail: 'ТОТ ЖЕ UTC-ПЕРИОД', color: COLORS.blue, y: 815 },
    { label: 'ETHEREUM', value: '+0,9%', detail: 'ТОТ ЖЕ UTC-ПЕРИОД', color: COLORS.text, y: 1080 },
  ];
  return cards.map((card, index) => {
    const reveal = ease((relativeTime - index * 0.22) / 0.55);
    const x = 80 + 920 * (1 - reveal);
    const height = card.big ? 280 : 205;
    return `
      <g opacity="${reveal}" transform="translate(${x - 80} 0)">
        <rect x="80" y="${card.y}" width="920" height="${height}" rx="28" fill="${index === 0 ? COLORS.panel2 : COLORS.panel}" stroke="${index === 0 ? card.color : COLORS.grid}" stroke-opacity="${index === 0 ? '.65' : '1'}" stroke-width="2"/>
        ${text(124, card.y + 62, card.label, { size: 21, fill: COLORS.muted, weight: 700, letterSpacing: 2 })}
        ${text(124, card.y + (card.big ? 190 : 144), card.value, { size: card.big ? 104 : 72, fill: card.color, weight: 800, letterSpacing: -2 })}
        ${text(960, card.y + (card.big ? 192 : 145), card.detail, { size: 17, fill: COLORS.muted, weight: 700, anchor: 'end', letterSpacing: 1 })}
      </g>
    `;
  }).join('') + `
    ${text(80, 1394, '26.09 09:00 — 27.09 09:00 UTC · BINANCE SPOT', { size: 18, fill: COLORS.muted, weight: 600, letterSpacing: 1 })}
  `;
}

function sceneOutlook(relativeTime) {
  const p = ease(relativeTime / 0.9);
  const metrics = [
    { x: 78, value: '+74,7%', label: 'РОСТ ЗА 24 ЧАСА', color: COLORS.green },
    { x: 382, value: `−${drawdownPct.toFixed(1).replace('.', ',')}%`, label: 'ОТСТУПИЛ ОТ ПИКА', color: COLORS.red },
    { x: 686, value: `${volumeMultiple.toFixed(1).replace('.', ',')}×`, label: 'ОБЪЁМ К СРЕДНЕМУ', color: COLORS.blue },
  ];
  const cards = metrics.map((metric, index) => {
    const a = ease((relativeTime - index * 0.15) / 0.48);
    return `
      <g opacity="${a}" transform="translate(0 ${36 * (1 - a)})">
        <rect x="${metric.x}" y="516" width="286" height="222" rx="24" fill="${COLORS.panel}" stroke="${COLORS.grid}" stroke-width="2"/>
        ${text(metric.x + 24, 618, metric.value, { size: 58, fill: metric.color, weight: 800, family: 'DejaVu Sans Mono, monospace' })}
        ${multiLine(metric.x + 24, 675, wrapWords(metric.label, 19), { size: 16, lineHeight: 22, fill: COLORS.muted, weight: 700 })}
      </g>
    `;
  }).join('');

  return `
    <g opacity="${p}">
      ${text(80, 376, 'СИЛЬНЫЙ ИМПУЛЬС', { size: 43, fill: COLORS.text, weight: 800, letterSpacing: 1 })}
      ${text(80, 430, 'НО НЕ ЛИНЕЙНЫЙ РОСТ', { size: 26, fill: COLORS.muted, weight: 600, letterSpacing: 1 })}
      ${cards}
      <rect x="78" y="820" width="924" height="310" rx="28" fill="${COLORS.panel}" stroke="${COLORS.grid}" stroke-width="2"/>
      ${text(122, 900, 'ЧТО ПОДТВЕРЖДЕНО', { size: 19, fill: COLORS.green, weight: 700, letterSpacing: 2 })}
      ${multiLine(122, 962, [
        '24 реальные часовые свечи',
        'и всплеск оборота на Binance Spot.',
      ], { size: 34, lineHeight: 48, fill: COLORS.text, weight: 600 })}
      ${text(122, 1068, 'ЧТО НЕ ДОКАЗАНО', { size: 19, fill: COLORS.red, weight: 700, letterSpacing: 2 })}
      ${text(122, 1110, 'Причина движения и роль токена в инициативе.', { size: 24, fill: COLORS.muted, weight: 500 })}
      ${text(80, 1386, 'ДАННЫЕ · BINANCE SPOT API  |  НОВОСТЬ · QUANT, 24.09.2026', { size: 18, fill: COLORS.muted, weight: 600, letterSpacing: 1 })}
      ${text(80, 1420, 'Срез свечей: 27.09.2026 09:00 UTC · Тестовый редакционный материал', { size: 16, fill: COLORS.muted, weight: 500 })}
    </g>
  `;
}

function renderSvg(scene, sceneIndex, relativeTime, totalDuration) {
  const body = {
    hook: sceneHook,
    candles: sceneCandles,
    volume: sceneVolume,
    news: sceneNews,
    comparison: sceneComparison,
    outlook: sceneOutlook,
  }[scene.key](relativeTime);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${commonFrame(scene, sceneIndex, relativeTime, totalDuration)}
    ${body}
    ${captionFrame(scene, sceneIndex, relativeTime)}
  </svg>`;
}

async function probeDuration(filePath) {
  const { stdout } = await execFile('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Не удалось определить длительность: ${filePath}`);
  }
  return duration;
}

async function generateVoiceSegments() {
  if (!process.env.LUMEAN_API_KEY) {
    throw new Error('LUMEAN_API_KEY is not configured; refusing to render a silent test.');
  }
  const voiceId = process.env.VOICE_API_VOICE_ID;
  if (!voiceId) {
    throw new Error('VOICE_API_VOICE_ID is not configured; use the project voice settings.');
  }
  const modelId = process.env.VOICE_API_MODEL_ID || 'eleven_multilingual_v2';
  const settings = {
    speed: 0.98,
    stability: 0.52,
    similarity: 0.78,
    style: 0.2,
    speakerBoost: true,
  };
  const voiceDir = path.join(TEMP_DIR, 'voice');
  await mkdir(voiceDir, { recursive: true });
  await mkdir(VOICE_CACHE_DIR, { recursive: true });
  const padded = [];

  for (let index = 0; index < SCENES.length; index += 1) {
    const scene = SCENES[index];
    const signature = createHash('sha256')
      .update(JSON.stringify({ text: scene.voice, voiceId, modelId, settings }))
      .digest('hex')
      .slice(0, 14);
    const cachePath = path.join(VOICE_CACHE_DIR, `${scene.key}-${signature}.mp3`);
    let audio;
    try {
      audio = await readFile(cachePath);
      console.log(`Повторно использую озвучку сцены ${index + 1}/${SCENES.length}: ${scene.key}`);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
      console.log(`Озвучка сцены ${index + 1}/${SCENES.length}: ${scene.key}`);
      audio = await generateLumeanSpeech(scene.voice, voiceId, modelId, settings);
      await writeFile(cachePath, audio);
    }
    const rawPath = path.join(voiceDir, `voice-${String(index + 1).padStart(2, '0')}.mp3`);
    const paddedPath = path.join(voiceDir, `voice-${String(index + 1).padStart(2, '0')}-padded.mp3`);
    await writeFile(rawPath, audio);
    const rawDuration = await probeDuration(rawPath);
    const padDuration = Math.max(scene.tail, scene.minDuration - rawDuration);
    const sceneDuration = rawDuration + padDuration;
    await execFile('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', rawPath,
      '-af', `apad=pad_dur=${padDuration.toFixed(3)}`,
      '-t', sceneDuration.toFixed(3),
      '-ar', '44100',
      '-ac', '2',
      '-c:a', 'libmp3lame',
      '-b:a', '192k',
      paddedPath,
    ]);
    const measuredDuration = await probeDuration(paddedPath);
    padded.push({ scene, rawDuration, duration: measuredDuration, path: paddedPath });
    console.log(`  голос ${rawDuration.toFixed(2)} с · сцена ${measuredDuration.toFixed(2)} с`);
  }

  return padded;
}

async function writeStoryboard(segments) {
  let cursor = 0;
  const rows = segments.map(({ scene, rawDuration, duration }, index) => {
    const start = cursor;
    cursor += duration;
    return `| ${String(index + 1).padStart(2, '0')} | ${start.toFixed(2)}–${cursor.toFixed(2)} | ${scene.title} | ${rawDuration.toFixed(2)} с речи |`;
  });
  const storyboard = `# QNT за 24 часа — тестовый Shorts\n\n## Срез данных\n\n- **Биржа и рынок:** Binance Spot, QNT/USDT.\n- **Окно свечей:** ${MARKET.startUtc} — ${MARKET.endUtc} UTC; 24 завершённые часовые свечи.\n- **Снимок:** ${MARKET.snapshotUtc} UTC; данные запрошены ${MARKET.retrievedUtc} UTC.\n- **Цена:** $${MARKET.open.toFixed(2)} → $${MARKET.close.toFixed(2)} (**+${MARKET.changePct.toFixed(1)}%**); максимум $${MARKET.high.toFixed(2)}, минимум $${MARKET.low.toFixed(2)}.\n- **Объём:** $${(MARKET.quoteVolume / 1e6).toFixed(1)} млн quote volume за те же 24 полных часа; ${volumeMultiple.toFixed(1)}× среднего $${(MARKET.averageDailyVolume7d / 1e6).toFixed(2)} млн за семь закрытых дней 20–26 сентября.\n- **Сравнение за те же 24 часа:** BTC +${MARKET.btcChangePct.toFixed(1)}%, ETH +${MARKET.ethChangePct.toFixed(1)}%.\n- **Новостной фон:** в официальной ленте Quant опубликован заголовок «Quant powers The Clearing House’s On-Chain Money Initiative in the US», 24.09.2026. Публикация отмечена как возможный контекст, а не доказанная причина движения; сообщение само по себе не подтверждает роль токена QNT.\n\n## Таймлайн\n\n| № | Таймкод | Сцена | Озвучка |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n\n## Текст озвучки\n\n${SCENES.map((scene, index) => `${index + 1}. ${scene.voice}`).join('\n\n')}\n\n## Визуальная система\n\n9:16, 1080×1920, 30 fps. Редакционная графика рыночного терминала: графитовый фон, светлая типографика, кислотно-зелёный для роста, красный для отката и риска, синий для среднего объёма. Свечи построены напрямую из Binance OHLC; логотипы бирж и токена не используются. Фоновая музыка взята из уже имеющегося инструментального bed проекта; голос сгенерирован настроенным голосом проекта.\n\n## Источники\n\n- Binance Spot OHLC: https://api.binance.com/api/v3/klines?symbol=QNTUSDT&interval=1h&limit=25\n- Binance Spot OHLC: https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=25\n- Binance Spot OHLC: https://api.binance.com/api/v3/klines?symbol=ETHUSDT&interval=1h&limit=25\n- Binance Spot daily volume baseline: https://api.binance.com/api/v3/klines?symbol=QNTUSDT&interval=1d&limit=8\n- Quant official news listing: https://quant.network/news/\n- Quant announcement: https://quant.network/news/quant-powers-the-clearing-houses-on-chain-money-initiative-in-the-us/\n\n**Оговорка:** значения — исторический снимок, не текущая котировка. Возможное совпадение новости и движения цены не доказывает причинность. Не инвестиционная рекомендация.\n`;
  await writeFile(path.join(OUT_DIR, 'SCRIPT-QNT-24H.md'), storyboard, 'utf8');
}

async function concatenateVoice(segments) {
  const listPath = path.join(TEMP_DIR, 'voice-list.txt');
  await writeFile(listPath, `${segments.map((segment) => `file '${segment.path}'`).join('\n')}\n`, 'utf8');
  const output = path.join(TEMP_DIR, 'voice-track.mp3');
  await execFile('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c:a', 'libmp3lame',
    '-b:a', '192k',
    '-ar', '44100',
    '-ac', '2',
    output,
  ]);
  return output;
}

async function renderVideo(segments, voiceTrack) {
  const frameDir = path.join(TEMP_DIR, 'frames');
  await mkdir(frameDir, { recursive: true });

  let totalDuration = segments.reduce((sum, item) => sum + item.duration, 0);
  totalDuration = Math.ceil(totalDuration * FPS) / FPS;
  let framesWritten = 0;
  let sceneStart = 0;

  for (let sceneIndex = 0; sceneIndex < segments.length; sceneIndex += 1) {
    const segment = segments[sceneIndex];
    const sceneStartFrame = Math.round(sceneStart * FPS);
    const sceneFrames = Math.round(segment.duration * FPS);
    for (let frame = 0; frame < sceneFrames; frame += 1) {
      const relativeTime = frame / FPS;
      const svg = renderSvg(segment.scene, sceneIndex, relativeTime, totalDuration);
      const filename = path.join(frameDir, `${String(framesWritten).padStart(5, '0')}.svg`);
      await writeFile(filename, svg, 'utf8');
      framesWritten += 1;
    }
    sceneStart += segment.duration;
    console.log(`Кадры сцены ${sceneIndex + 1}/${segments.length}: ${sceneFrames}`);
  }

  const audioEnd = await probeDuration(voiceTrack);
  const actualDuration = Math.min(totalDuration, Math.max(audioEnd, framesWritten / FPS));
  const fadeStart = Math.max(0, actualDuration - 1.15);
  const musicFilter = `[2:a]volume=0.17,afade=t=out:st=${fadeStart.toFixed(3)}:d=1.15[music];[1:a]volume=1.0[voice];[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[audio]`;

  await execFile('ffmpeg', [
    '-y', '-loglevel', 'warning',
    '-framerate', String(FPS),
    '-start_number', '0',
    '-i', path.join(frameDir, '%05d.svg'),
    '-i', voiceTrack,
    '-stream_loop', '-1',
    '-i', MUSIC,
    '-filter_complex', musicFilter,
    '-map', '0:v:0',
    '-map', '[audio]',
    '-frames:v', String(framesWritten),
    '-t', actualDuration.toFixed(3),
    '-r', String(FPS),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-ar', '48000',
    '-ac', '2',
    '-movflags', '+faststart',
    OUTPUT,
  ], { timeout: 240_000, maxBuffer: 8 * 1024 * 1024 });

  return { actualDuration, framesWritten };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await rm(TEMP_DIR, { recursive: true, force: true });
  await mkdir(TEMP_DIR, { recursive: true });
  if (!process.env.LUMEAN_TEMPLATE_ID) {
    throw new Error('LUMEAN_TEMPLATE_ID is not configured; refusing to create a new remote voice template.');
  }
  console.log('Начинаю отдельный офлайн-рендер QNT; Telegram и API-пайплайн не вызываются.');
  const segments = await generateVoiceSegments();
  await writeStoryboard(segments);
  const voiceTrack = await concatenateVoice(segments);
  const result = await renderVideo(segments, voiceTrack);
  const { stdout: probe } = await execFile('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_name,width,height,sample_aspect_ratio,r_frame_rate,channels',
    '-show_entries', 'format=duration,size',
    '-of', 'json',
    OUTPUT,
  ]);
  console.log(`Готово: ${OUTPUT}`);
  console.log(`Кадров: ${result.framesWritten} · длительность: ${result.actualDuration.toFixed(2)} с`);
  console.log(probe.trim());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});