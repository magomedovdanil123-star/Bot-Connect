import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  getSpeechProvider,
  prepareSpeechText,
} from "../../api-server/src/lib/audio-generation/elevenlabs-client.ts";

const execFile = promisify(execFileCallback);
const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
const ROOT = path.resolve(
  process.env.QNT_VIDEO_PROJECT_ROOT || path.resolve(import.meta.dirname, ".."),
);
const EXPORT_ROOT = path.join(ROOT, "exports", "qnt-live-radar");
const TEMP_DIR = path.join("/tmp", `qnt-live-radar-${process.pid}`);
const VOICE_CACHE_DIR = path.join("/tmp", "qnt-live-radar-voice-cache");
const MUSIC = path.resolve(
  ROOT,
  "..",
  "api-server",
  "assets",
  "audio",
  "financial-user-music-bed.mp3",
);
const BINANCE = "https://api.binance.com/api/v3";

const COLORS = {
  bg: "#080c0b",
  bg2: "#111816",
  panel: "#101714",
  panel2: "#16211b",
  grid: "#26332c",
  text: "#f2f5ef",
  muted: "#91a097",
  green: "#d6ff39",
  greenDim: "#91b92c",
  red: "#ff6559",
  blue: "#82a7ff",
};

const QNT_CASE = {
  symbol: "QNTUSDT",
  open: 103.04,
  close: 180.06,
  high: 194.95,
  low: 102.78,
  changePct: 74.74767080745342,
  startUtc: "2026-09-26 09:00",
  endUtc: "2026-09-27 09:00",
  closePrices: [
    107.79, 106.36, 104.63, 103.58, 106.17, 110.7, 116.03, 123.17,
    123.72, 119.75, 122.76, 121.2, 122.31, 143.29, 151.52, 161.28,
    181.72, 171.6, 173.28, 188.95, 170.57, 174.54, 169.95, 180.06,
  ],
};

const APPROVED_CTA =
  "QNT вырос на 74,7% за сутки. Такой импульс уже прошёл — и он показывает, как быстро меняется рынок. Не жди следующего движения, чтобы только тогда искать биржу. Зарегистрируйся по моей ссылке заранее и подготовься к следующей возможности.";

const settings = {
  speed: 0.98,
  stability: 0.52,
  similarity: 0.78,
  style: 0.2,
  speakerBoost: true,
};

const stablecoinBases = new Set([
  "AEUR",
  "DAI",
  "EUR",
  "EURC",
  "FDUSD",
  "PAXG",
  "PYUSD",
  "TUSD",
  "USDC",
  "USDE",
  "USDP",
  "USTC",
  "USD1",
]);

const spokenTickerNames = {
  AXS: "Аксис",
  ENJ: "Энджин",
  GALA: "Гала",
  MANA: "Мана",
  NIGHT: "Найт",
  SAND: "Сэнд",
  WLD: "Ворлд",
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
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function text(x, y, value, options = {}) {
  const {
    size = 32,
    fill = COLORS.text,
    weight = 500,
    anchor = "start",
    family = "DejaVu Sans, sans-serif",
    letterSpacing = 0,
    opacity = 1,
  } = options;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}px" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${letterSpacing}px" opacity="${opacity}">${escapeXml(value)}</text>`;
}

function multiline(x, y, lines, options = {}) {
  const { size = 36, lineHeight = 48, ...style } = options;
  return `<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="${size}px" font-weight="${style.weight ?? 500}" fill="${style.fill ?? COLORS.text}" text-anchor="${style.anchor ?? "start"}" letter-spacing="${style.letterSpacing ?? 0}px">${lines
    .map(
      (line, index) =>
        `<tspan x="${x}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("")}</text>`;
}

function wrapWords(value, maxChars = 41) {
  const result = [];
  let line = "";
  for (const word of value.split(/\s+/u)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      result.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) result.push(line);
  return result;
}

function formatNumber(value, decimals = 1) {
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function formatUtcTimestamp(value) {
  const iso = new Date(value).toISOString();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)} ${iso.slice(11, 16)} UTC`;
}

function baseAsset(symbol) {
  return symbol.endsWith("USDT") ? symbol.slice(0, -4) : symbol;
}

function isLeveragedOrFiatToken(base) {
  return stablecoinBases.has(base) || /(?:UP|DOWN|BULL|BEAR)$/u.test(base);
}

async function fetchJson(url, label) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 429 || response.status >= 500) {
        const body = await response.text();
        lastError = new Error(`${label}: Binance returned HTTP ${response.status}`);
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
          continue;
        }
        throw new Error(
          `${lastError.message}; response: ${body.slice(0, 180) || "empty"}`,
        );
      }
      if (!response.ok) {
        throw new Error(`${label}: Binance returned HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < 2 && !(error instanceof Error && error.message.includes("HTTP 4"))) {
        await new Promise((resolve) => setTimeout(resolve, 1_000 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label}: request failed`);
}

async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await callback(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function fetchCandidate(ticker, now) {
  const url = `${BINANCE}/klines?symbol=${encodeURIComponent(ticker.symbol)}&interval=4h&limit=45`;
  const rows = await fetchJson(url, `${ticker.symbol} 4h candles`);
  const closed = rows.filter((row) => Number(row[6]) < now - 1_000);
  if (closed.length < 43) return null;

  const current = closed.at(-1);
  const baseline = closed.slice(-43, -1);
  const averageQuoteVolume =
    baseline.reduce((sum, row) => sum + Number(row[7]), 0) / baseline.length;
  const quoteVolume = Number(current[7]);
  const priceChange4h = (Number(current[4]) / Number(current[1]) - 1) * 100;
  const volumeRatio = quoteVolume / averageQuoteVolume;
  const quoteVolume24h = Number(ticker.quoteVolume);
  const change24h = Number(ticker.priceChangePercent);

  if (
    !Number.isFinite(priceChange4h) ||
    !Number.isFinite(volumeRatio) ||
    priceChange4h <= 0 ||
    volumeRatio < 1.5 ||
    quoteVolume < 1_000_000
  ) {
    return null;
  }

  return {
    symbol: ticker.symbol,
    base: baseAsset(ticker.symbol),
    price: Number(ticker.lastPrice),
    change24h,
    quoteVolume24h,
    priceChange4h,
    quoteVolume4h: quoteVolume,
    averageQuoteVolume4h: averageQuoteVolume,
    volumeRatio,
    score: priceChange4h * Math.log2(volumeRatio),
    candleOpenTime: Number(current[0]),
    candleCloseTime: Number(current[6]),
    candles: closed.slice(-12).map((row) => ({
      openTime: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      quoteVolume: Number(row[7]),
      closeTime: Number(row[6]),
    })),
  };
}

async function scanMarket() {
  const scanStartedAt = new Date().toISOString();
  const tickers = await fetchJson(
    `${BINANCE}/ticker/24hr?type=FULL`,
    "24-hour spot ticker",
  );
  if (!Array.isArray(tickers)) {
    throw new Error("Binance returned no full spot ticker list.");
  }

  const shortlist = tickers
    .filter((ticker) => {
      const base = baseAsset(ticker.symbol);
      return (
        ticker.symbol.endsWith("USDT") &&
        !isLeveragedOrFiatToken(base) &&
        Number(ticker.priceChangePercent) > 0 &&
        Number(ticker.quoteVolume) >= 10_000_000
      );
    })
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, 80);

  if (!shortlist.length) {
    throw new Error("No liquid USDT spot pairs are available for the live radar scan.");
  }

  const evaluated = await mapLimit(shortlist, 4, async (ticker) => {
    try {
      return await fetchCandidate(ticker, Date.now());
    } catch (error) {
      if (error instanceof Error && error.message.includes("HTTP 4")) throw error;
      console.warn(`Skipping ${ticker.symbol}: market candles could not be read.`);
      return null;
    }
  });
  const eligible = evaluated.filter(Boolean).sort((a, b) => b.score - a.score);
  if (!eligible.length) {
    throw new Error(
      "No liquid coin met the same-window positive-price and volume-acceleration rules; refusing to invent a live candidate.",
    );
  }

  const selected = eligible[0];
  const scannedAt = new Date().toISOString();
  return {
    provider: "Binance Spot",
    quoteAsset: "USDT",
    criteria: {
      min24hQuoteVolumeUSDT: 10_000_000,
      min4hQuoteVolumeUSDT: 1_000_000,
      min4hVolumeMultiple: 1.5,
      priceMustRiseInSame4hWindow: true,
      baseline: "42 preceding closed 4-hour candles (7 days)",
      ranking: "4h price change × log2(4h quote-volume multiple)",
    },
    scanStartedAt,
    scannedAt,
    selected,
    eligible: eligible.slice(0, 10),
  };
}

function spokenAssetName(base) {
  return spokenTickerNames[base] || base.split("").join(" ");
}

function russianNounForm(value, singular, few, many) {
  const number = Math.abs(Math.round(value));
  const lastTwo = number % 100;
  const last = number % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return singular;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function integerWordsRu(value) {
  const n = Math.max(0, Math.round(value));
  if (n >= 1_000_000) {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
  }
  if (n >= 1_000) {
    const thousands = Math.floor(n / 1_000);
    let thousandWords = integerWordsRu(thousands);
    const lastTwo = thousands % 100;
    if (lastTwo < 11 || lastTwo > 14) {
      if (thousands % 10 === 1) thousandWords = thousandWords.replace(/один$/u, "одна");
      else if (thousands % 10 === 2) thousandWords = thousandWords.replace(/два$/u, "две");
    }
    const thousandForm = russianNounForm(thousands, "тысяча", "тысячи", "тысяч");
    const remainder = n % 1_000;
    return `${thousandWords} ${thousandForm}${remainder ? ` ${integerWordsRu(remainder)}` : ""}`;
  }
  const units = [
    "ноль",
    "один",
    "два",
    "три",
    "четыре",
    "пять",
    "шесть",
    "семь",
    "восемь",
    "девять",
    "десять",
    "одиннадцать",
    "двенадцать",
    "тринадцать",
    "четырнадцать",
    "пятнадцать",
    "шестнадцать",
    "семнадцать",
    "восемнадцать",
    "девятнадцать",
  ];
  const tens = [
    "",
    "",
    "двадцать",
    "тридцать",
    "сорок",
    "пятьдесят",
    "шестьдесят",
    "семьдесят",
    "восемьдесят",
    "девяносто",
  ];
  const hundreds = [
    "",
    "сто",
    "двести",
    "триста",
    "четыреста",
    "пятьсот",
    "шестьсот",
    "семьсот",
    "восемьсот",
    "девятьсот",
  ];
  if (n < 20) return units[n];
  const parts = [];
  if (n >= 100) parts.push(hundreds[Math.floor(n / 100)]);
  const remainder = n % 100;
  if (remainder >= 20) {
    parts.push(tens[Math.floor(remainder / 10)]);
    if (remainder % 10) parts.push(units[remainder % 10]);
  } else if (remainder > 0) {
    parts.push(units[remainder]);
  }
  return parts.join(" ");
}

function makeScenes(candidate) {
  const assetName = spokenAssetName(candidate.base);
  const roundedChange = Math.round(candidate.priceChange4h);
  const roundedMillions = Math.max(1, Math.round(candidate.quoteVolume4h / 1_000_000));
  const roundedMultiple = Math.max(1, Math.round(candidate.volumeRatio));
  const roundedVolumeWords = `${integerWordsRu(roundedMillions)} ${russianNounForm(roundedMillions, "миллион", "миллиона", "миллионов")}`;
  const roundedMultipleWords = `${integerWordsRu(roundedMultiple)} ${russianNounForm(roundedMultiple, "раз", "раза", "раз")}`;
  const qntVoice =
    "QNT за сутки вырос на семьдесят четыре целых семь десятых процента. Это исторический срез Binance Spot с двадцать шестого по двадцать седьмое сентября.";
  const bridgeVoice =
    "Этот импульс уже прошёл. Теперь смотрим, где прямо сейчас цена растёт вместе с объёмом.";
  const candidateVoice =
    `На радаре ${assetName}: за последние четыре закрытых часа цена выросла примерно на ${integerWordsRu(roundedChange)} процентов. ` +
    `Оборот — примерно ${roundedVolumeWords} долларов, почти в ${roundedMultipleWords} выше среднего за такие же четыре часа предыдущих семи дней.`;

  return [
    {
      key: "qnt",
      title: "QNT / УЖЕ ПРОШЕДШИЙ ИМПУЛЬС",
      minDuration: 5.5,
      tail: 0.22,
      voice: qntVoice,
      caption:
        "QNT: +74,7% за 24 часа · исторический срез Binance Spot · 26–27.09.2026",
    },
    {
      key: "bridge",
      title: "СМОТРИМ, ЧТО РАСТЁТ СЕЙЧАС",
      minDuration: 3.7,
      tail: 0.2,
      voice: bridgeVoice,
      caption: "От прошлого роста — к монете, где сейчас ускоряются цена и объём.",
    },
    {
      key: "radar",
      title: `НА РАДАРЕ СЕЙЧАС / ${candidate.base}`,
      minDuration: 10.5,
      tail: 0.25,
      voice: candidateVoice,
      caption:
        `${candidate.base}: +${formatNumber(candidate.priceChange4h)}% за 4 закрытых часа · ` +
        `оборот ${formatNumber(candidate.quoteVolume4h / 1_000_000)} млн USDT · ` +
        `${formatNumber(candidate.volumeRatio)}× к среднему 4H за 7 дней.`,
    },
    {
      key: "cta",
      title: "БУДЬ ГОТОВ К СЛЕДУЮЩЕМУ ДВИЖЕНИЮ",
      minDuration: 12.4,
      tail: 0.9,
      voice: APPROVED_CTA,
      caption: "Зарегистрируйся по моей ссылке заранее · ссылка в описании",
    },
  ];
}

async function probeDuration(filePath) {
  const { stdout } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`Could not read audio duration: ${filePath}`);
  }
  return duration;
}

async function generateVoiceSegments(scenes) {
  const provider = getSpeechProvider();
  const voiceId = getConfiguredVoiceId();
  if (!voiceId) {
    throw new Error(
      `The configured ${provider} speech provider has no voice ID; refusing to substitute another voice.`,
    );
  }
  const modelId = getElevenLabsModel();
  const padded = [];
  await mkdir(path.join(TEMP_DIR, "voice"), { recursive: true });
  await mkdir(VOICE_CACHE_DIR, { recursive: true });

  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const previousText = scenes[index - 1]?.voice;
    const nextText = scenes[index + 1]?.voice;
    const signature = createHash("sha256")
      .update(
        JSON.stringify({
          text: scene.voice,
          provider,
          voiceId,
          modelId,
          settings,
        }),
      )
      .digest("hex")
      .slice(0, 16);
    const cachePath = path.join(VOICE_CACHE_DIR, `${scene.key}-${signature}.mp3`);
    let audio;
    try {
      audio = await readFile(cachePath);
      console.log(`Reusing configured voice for ${scene.key}.`);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      console.log(`Generating configured voice for ${scene.key} (${provider}).`);
      audio = await generateSpeech(
        prepareSpeechText(scene.voice),
        voiceId,
        modelId,
        { ...settings, previousText, nextText },
      );
      if (!audio.length) throw new Error(`Speech provider returned no audio for ${scene.key}.`);
      await writeFile(cachePath, audio);
    }

    const rawPath = path.join(TEMP_DIR, "voice", `${scene.key}.mp3`);
    const paddedPath = path.join(TEMP_DIR, "voice", `${scene.key}-padded.mp3`);
    await writeFile(rawPath, audio);
    const rawDuration = await probeDuration(rawPath);
    const duration = Math.max(scene.minDuration, rawDuration + scene.tail);
    const padDuration = duration - rawDuration;
    await execFile("ffmpeg", [
      "-y",
      "-loglevel",
      "error",
      "-i",
      rawPath,
      "-af",
      `apad=pad_dur=${padDuration.toFixed(3)}`,
      "-t",
      duration.toFixed(3),
      "-ar",
      "44100",
      "-ac",
      "2",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      paddedPath,
    ]);
    padded.push({
      scene,
      rawDuration,
      duration: await probeDuration(paddedPath),
      path: paddedPath,
    });
    console.log(
      `${scene.key}: ${rawDuration.toFixed(2)} s speech, ${padded.at(-1).duration.toFixed(2)} s scene.`,
    );
  }
  return padded;
}

function commonFrame(segment, index, relativeTime, totalDuration) {
  const scene = segment.scene;
  const enter = ease(relativeTime / 0.34);
  const elapsed =
    segment.start +
    relativeTime;
  const progressWidth = 920 * clamp(elapsed / totalDuration);
  const glowX = 780 + Math.sin(relativeTime * 0.75 + index) * 78;
  return `
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="0.9" y2="1">
        <stop offset="0" stop-color="${COLORS.bg}"/>
        <stop offset="1" stop-color="${COLORS.bg2}"/>
      </linearGradient>
      <radialGradient id="glow">
        <stop offset="0" stop-color="${index === 2 ? COLORS.green : COLORS.blue}" stop-opacity=".17"/>
        <stop offset="1" stop-color="${COLORS.bg}" stop-opacity="0"/>
      </radialGradient>
      <pattern id="microgrid" width="54" height="54" patternUnits="userSpaceOnUse">
        <path d="M54 0H0V54" fill="none" stroke="${COLORS.grid}" stroke-width="1" opacity=".25"/>
      </pattern>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="26"/>
      </filter>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#microgrid)" opacity=".45"/>
    <ellipse cx="${glowX}" cy="730" rx="520" ry="630" fill="url(#glow)" filter="url(#softGlow)"/>
    <rect x="72" y="84" width="936" height="2" fill="${COLORS.grid}"/>
    <rect x="72" y="84" width="${progressWidth}" height="4" fill="${COLORS.green}"/>
    ${text(76, 63, "MARKET / LIVE RADAR", { size: 21, fill: COLORS.muted, weight: 700, letterSpacing: 2 })}
    ${text(1004, 63, `${String(index + 1).padStart(2, "0")} / 04`, { size: 21, fill: COLORS.muted, weight: 700, anchor: "end", family: "DejaVu Sans Mono, monospace" })}
    <g opacity="${enter}" transform="translate(0 ${30 * (1 - enter)})">
      ${text(78, 151, scene.title, { size: 22, fill: COLORS.green, weight: 700, letterSpacing: 1.5 })}
    </g>
  `;
}

function captionFrame(segment, relativeTime, index) {
  const caption = segment.scene.caption;
  const lines = wrapWords(caption, 46);
  const alpha = ease(relativeTime / 0.25);
  const lineHeight = 40;
  const startY = 1430 + Math.max(0, (4 - lines.length) * 12);
  const source =
    index === 0
      ? "ИСТОРИЧЕСКИЙ СРЕЗ · BINANCE SPOT · 27.09.2026 UTC"
      : index === 2
        ? `BINANCE SPOT · ${segment.candidate.symbol} · 4H · СРЕЗ ${formatUtcTimestamp(segment.candidate.scannedAt)}`
        : "MARKET / CRYPTO · ДАННЫЕ ПОДПИСАНЫ ПО ПЕРИОДУ";
  return `
    <g opacity="${alpha}">
      <rect x="64" y="1374" width="952" height="272" rx="26" fill="${COLORS.panel}" fill-opacity=".96" stroke="${COLORS.grid}" stroke-width="2"/>
      ${multiline(96, startY, lines, { size: 30, lineHeight, fill: COLORS.text, weight: 560 })}
      <rect x="96" y="1596" width="888" height="1" fill="${COLORS.grid}"/>
      ${text(96, 1624, source, { size: 16, fill: COLORS.muted, weight: 600, letterSpacing: 0.7 })}
    </g>
  `;
}

function sceneQnt(relativeTime) {
  const p = ease(relativeTime / 0.6);
  const ring = clamp(1 - relativeTime / 5.8);
  const chart = { x: 160, y: 720, w: 760, h: 290 };
  const values = QNT_CASE.closePrices;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const xAt = (index) => chart.x + (index / (values.length - 1)) * chart.w;
  const yAt = (value) => chart.y + chart.h - ((value - min) / (max - min)) * chart.h;
  const visible = Math.max(2, Math.ceil(clamp(relativeTime / 2.8) * values.length));
  const line = values
    .slice(0, visible)
    .map((value, index) => `${index === 0 ? "M" : "L"} ${xAt(index)} ${yAt(value)}`)
    .join(" ");
  const finalX = xAt(visible - 1);
  const finalY = yAt(values[visible - 1]);
  return `
    <g opacity="${p}">
      <circle cx="540" cy="486" r="198" fill="${COLORS.panel}" stroke="${COLORS.grid}" stroke-width="2"/>
      <circle cx="540" cy="486" r="176" fill="none" stroke="${COLORS.green}" stroke-width="7"
        stroke-dasharray="${Math.round(1106 * ring)} 1110" transform="rotate(-90 540 486)" stroke-linecap="round"/>
      <circle cx="540" cy="486" r="218" fill="none" stroke="${COLORS.green}" stroke-opacity=".23" stroke-width="2" stroke-dasharray="4 18" transform="rotate(${relativeTime * 12} 540 486)"/>
      ${text(540, 476, "QNT", { size: 82, fill: COLORS.text, weight: 800, anchor: "middle", letterSpacing: 4 })}
      ${text(540, 526, "BINANCE SPOT", { size: 20, fill: COLORS.muted, weight: 700, anchor: "middle", letterSpacing: 2 })}
      ${text(540, 660, "+74,7%", { size: 142, fill: COLORS.green, weight: 800, anchor: "middle", letterSpacing: -4 })}
      ${text(540, 710, "ЗА 24 ЧАСА", { size: 24, fill: COLORS.text, weight: 700, anchor: "middle", letterSpacing: 2 })}
      <rect x="126" y="758" width="828" height="390" rx="25" fill="${COLORS.panel}" stroke="${COLORS.grid}" stroke-width="2"/>
      ${text(164, 814, "$103,04  →  $180,06", { size: 34, fill: COLORS.text, weight: 700, family: "DejaVu Sans Mono, monospace" })}
      <path d="${line}" fill="none" stroke="${COLORS.green}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${finalX}" cy="${finalY}" r="11" fill="${COLORS.green}"/>
      <line x1="${chart.x}" y1="${chart.y + chart.h + 18}" x2="${chart.x + chart.w}" y2="${chart.y + chart.h + 18}" stroke="${COLORS.grid}" stroke-width="2"/>
      ${text(164, 1100, "−7,6% ОТ ПИКА · $194,95", { size: 22, fill: COLORS.muted, weight: 600 })}
      ${text(540, 1230, "ЭТО ПРОШЛОЕ ДВИЖЕНИЕ", { size: 25, fill: COLORS.blue, weight: 700, anchor: "middle", letterSpacing: 1.2 })}
    </g>
  `;
}

function sceneBridge(relativeTime) {
  const p = ease(relativeTime / 0.65);
  const sweep = -260 + ((relativeTime * 165) % 1260);
  return `
    <g opacity="${p}">
      <circle cx="540" cy="760" r="250" fill="none" stroke="${COLORS.grid}" stroke-width="2"/>
      <circle cx="540" cy="760" r="190" fill="none" stroke="${COLORS.blue}" stroke-opacity=".38" stroke-width="2" stroke-dasharray="5 15"/>
      <circle cx="540" cy="760" r="115" fill="${COLORS.panel}" stroke="${COLORS.grid}" stroke-width="2"/>
      <path d="M 540 760 L ${sweep} 470 A 340 340 0 0 1 ${sweep + 250} 455 Z" fill="${COLORS.green}" opacity=".18"/>
      <circle cx="540" cy="760" r="8" fill="${COLORS.green}"/>
      ${text(540, 520, "QNT", { size: 35, fill: COLORS.muted, weight: 700, anchor: "middle", letterSpacing: 2 })}
      ${text(540, 778, "РАДАР", { size: 30, fill: COLORS.text, weight: 800, anchor: "middle", letterSpacing: 2 })}
      ${text(540, 1120, "ЧТО РАСТЁТ", { size: 72, fill: COLORS.text, weight: 800, anchor: "middle", letterSpacing: 1 })}
      ${text(540, 1210, "ПРЯМО СЕЙЧАС?", { size: 72, fill: COLORS.green, weight: 800, anchor: "middle", letterSpacing: 1 })}
    </g>
  `;
}

function sceneRadar(relativeTime, candidate) {
  const p = ease(relativeTime / 0.55);
  const candles = candidate.candles;
  const chart = { x: 154, y: 755, w: 772, h: 248 };
  const allPrices = candles.flatMap((candle) => [candle.low, candle.high]);
  const low = Math.min(...allPrices);
  const high = Math.max(...allPrices);
  const padding = Math.max((high - low) * 0.12, high * 0.005);
  const minPrice = low - padding;
  const maxPrice = high + padding;
  const yAt = (value) =>
    chart.y + chart.h - ((value - minPrice) / (maxPrice - minPrice)) * chart.h;
  const slot = chart.w / candles.length;
  const width = Math.max(9, slot * 0.44);
  const visible = Math.min(
    candles.length,
    Math.ceil(clamp((relativeTime - 0.3) / 2.8) * candles.length),
  );
  let candleSvg = "";
  let volumeSvg = "";
  const maxVolume = Math.max(...candles.map((candle) => candle.quoteVolume));
  for (let index = 0; index < visible; index += 1) {
    const candle = candles[index];
    const x = chart.x + slot * (index + 0.5);
    const openY = yAt(candle.open);
    const closeY = yAt(candle.close);
    const color = candle.close >= candle.open ? COLORS.green : COLORS.red;
    candleSvg += `
      <g opacity="${ease((relativeTime - index * 0.045) / 0.2)}">
        <line x1="${x}" y1="${yAt(candle.high)}" x2="${x}" y2="${yAt(candle.low)}" stroke="${color}" stroke-width="3"/>
        <rect x="${x - width / 2}" y="${Math.min(openY, closeY)}" width="${width}" height="${Math.max(4, Math.abs(openY - closeY))}" rx="2" fill="${color}"/>
      </g>`;
    const volumeHeight = (candle.quoteVolume / maxVolume) * 90;
    volumeSvg += `<rect x="${x - width / 2}" y="${1115 - volumeHeight}" width="${width}" height="${volumeHeight}" rx="2" fill="${color}" opacity=".82"/>`;
  }
  const metricAlpha = ease((relativeTime - 0.7) / 0.5);
  const change = formatNumber(candidate.priceChange4h);
  const ratio = formatNumber(candidate.volumeRatio);
  const volume = formatNumber(candidate.quoteVolume4h / 1_000_000);
  const change24h = formatNumber(candidate.change24h);
  return `
    <g opacity="${p}">
      <rect x="78" y="232" width="924" height="106" rx="22" fill="${COLORS.panel2}" stroke="${COLORS.green}" stroke-opacity=".55" stroke-width="2"/>
      ${text(124, 280, "НА РАДАРЕ СЕЙЧАС", { size: 18, fill: COLORS.muted, weight: 700, letterSpacing: 1.5 })}
      ${text(124, 322, candidate.base, { size: 47, fill: COLORS.text, weight: 800, letterSpacing: 2 })}
      ${text(950, 306, `+${change24h}% / 24H`, { size: 25, fill: COLORS.green, weight: 700, anchor: "end", family: "DejaVu Sans Mono, monospace" })}
      <rect x="126" y="378" width="828" height="684" rx="24" fill="${COLORS.panel}" stroke="${COLORS.grid}" stroke-width="2"/>
      ${text(164, 433, `${candidate.base}/USDT · 4H`, { size: 21, fill: COLORS.muted, weight: 700, letterSpacing: 1.2 })}
      ${text(164, 520, `+${change}%`, { size: 87, fill: COLORS.green, weight: 800, letterSpacing: -3 })}
      ${text(168, 566, "ЗА ПОСЛЕДНИЕ 4 ЗАКРЫТЫХ ЧАСА", { size: 19, fill: COLORS.text, weight: 700, letterSpacing: 1 })}
      <g>
        ${[0, 1, 2, 3].map((index) => {
          const y = chart.y + index * (chart.h / 3);
          return `<line x1="${chart.x}" y1="${y}" x2="${chart.x + chart.w}" y2="${y}" stroke="${COLORS.grid}" stroke-width="1.5"/>`;
        }).join("")}
        ${candleSvg}
        <line x1="${chart.x}" y1="${chart.y + chart.h}" x2="${chart.x + chart.w}" y2="${chart.y + chart.h}" stroke="${COLORS.grid}" stroke-width="2"/>
        ${volumeSvg}
        <line x1="${chart.x}" y1="1115" x2="${chart.x + chart.w}" y2="1115" stroke="${COLORS.grid}" stroke-width="2"/>
        ${text(chart.x, 1140, "ЦЕНА", { size: 15, fill: COLORS.muted, weight: 600, letterSpacing: 1 })}
        ${text(chart.x + chart.w, 1140, "ОБОРОТ", { size: 15, fill: COLORS.muted, weight: 600, anchor: "end", letterSpacing: 1 })}
      </g>
      <g opacity="${metricAlpha}">
        <rect x="126" y="1172" width="260" height="122" rx="18" fill="${COLORS.panel2}" stroke="${COLORS.grid}" stroke-width="2"/>
        ${text(152, 1225, `$${volume}M`, { size: 40, fill: COLORS.text, weight: 800, family: "DejaVu Sans Mono, monospace" })}
        ${text(152, 1265, "ОБОРОТ · 4H", { size: 17, fill: COLORS.muted, weight: 700, letterSpacing: 1 })}
        <rect x="410" y="1172" width="544" height="122" rx="18" fill="${COLORS.panel2}" stroke="${COLORS.grid}" stroke-width="2"/>
        ${text(440, 1232, `${ratio}×`, { size: 48, fill: COLORS.green, weight: 800, family: "DejaVu Sans Mono, monospace" })}
        ${text(610, 1220, "К СВОЕМУ СРЕДНЕМУ", { size: 19, fill: COLORS.text, weight: 700, letterSpacing: .4 })}
        ${text(610, 1258, "ЗА ПРЕДЫДУЩИЕ 7 ДНЕЙ", { size: 17, fill: COLORS.muted, weight: 600, letterSpacing: .5 })}
      </g>
    </g>
  `;
}

function sceneCta(relativeTime, candidate) {
  const p = ease(relativeTime / 0.55);
  const pulse = 0.65 + Math.sin(relativeTime * 3.2) * 0.12;
  const line = candidate.candles
    .slice(-8)
    .map((candle, index) => {
      const x = 116 + (index / 7) * 848;
      const y = 1120 - index * 24 + Math.sin(index * 1.1) * 34;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return `
    <g opacity="${p}">
      <path d="${line}" fill="none" stroke="${COLORS.green}" stroke-width="5" opacity=".22"/>
      <circle cx="540" cy="498" r="228" fill="none" stroke="${COLORS.green}" stroke-opacity=".3" stroke-width="2" stroke-dasharray="4 16" transform="rotate(${relativeTime * 9} 540 498)"/>
      ${text(540, 402, "РЫНОК МЕНЯЕТСЯ БЫСТРО", { size: 22, fill: COLORS.muted, weight: 700, anchor: "middle", letterSpacing: 2 })}
      ${text(540, 614, "НЕ ИЩИ БИРЖУ", { size: 58, fill: COLORS.text, weight: 800, anchor: "middle", letterSpacing: .5 })}
      ${text(540, 690, "ПОСЛЕ РЫВКА", { size: 68, fill: COLORS.green, weight: 800, anchor: "middle", letterSpacing: 1 })}
      <rect x="116" y="790" width="848" height="140" rx="24" fill="${COLORS.panel2}" stroke="${COLORS.green}" stroke-opacity=".75" stroke-width="2"/>
      ${text(540, 850, "ЗАРЕГИСТРИРУЙСЯ", { size: 39, fill: COLORS.text, weight: 800, anchor: "middle", letterSpacing: 1 })}
      ${text(540, 901, "ЗАРАНЕЕ ПО МОЕЙ ССЫЛКЕ", { size: 34, fill: COLORS.green, weight: 800, anchor: "middle", letterSpacing: .5 })}
      <g opacity="${pulse}">
        <rect x="184" y="1020" width="712" height="112" rx="56" fill="${COLORS.green}"/>
        ${text(540, 1090, "ССЫЛКА В ОПИСАНИИ", { size: 31, fill: COLORS.bg, weight: 800, anchor: "middle", letterSpacing: 1 })}
      </g>
      ${text(540, 1230, `${candidate.base} · НАБЛЮДАЙ ЗА ДВИЖЕНИЕМ`, { size: 23, fill: COLORS.muted, weight: 700, anchor: "middle", letterSpacing: 1 })}
      ${text(540, 1312, "РЕФЕРАЛЬНАЯ ССЫЛКА", { size: 19, fill: COLORS.blue, weight: 700, anchor: "middle", letterSpacing: 1.6 })}
      ${text(540, 1350, "ПРОШЛЫЙ РОСТ НЕ ГАРАНТИРУЕТ БУДУЩИЙ", { size: 16, fill: COLORS.muted, weight: 600, anchor: "middle", letterSpacing: .8 })}
    </g>
  `;
}

function renderSvg(segment, index, relativeTime, totalDuration) {
  const scene = segment.scene;
  let body;
  if (scene.key === "qnt") body = sceneQnt(relativeTime);
  else if (scene.key === "bridge") body = sceneBridge(relativeTime);
  else if (scene.key === "radar") body = sceneRadar(relativeTime, segment.candidate);
  else body = sceneCta(relativeTime, segment.candidate);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    ${commonFrame(segment, index, relativeTime, totalDuration)}
    ${body}
    ${captionFrame(segment, relativeTime, index)}
  </svg>`;
}

async function writeStoryboard(segments, snapshot, runDir) {
  let cursor = 0;
  const timeline = segments.map((segment, index) => {
    const start = cursor;
    cursor += segment.duration;
    segment.start = start;
    segment.index = index;
    segment.candidate = snapshot.selected;
    return `| ${String(index + 1).padStart(2, "0")} | ${start.toFixed(2)}–${cursor.toFixed(2)} | ${segment.scene.title} | ${segment.rawDuration.toFixed(2)} с речи |`;
  });
  const candidate = snapshot.selected;
  const startTime = new Date(candidate.candleOpenTime).toISOString();
  const endTime = new Date(candidate.candleCloseTime).toISOString();
  const script = `# QNT → live radar: ${candidate.base}\n\n## Свежие данные\n\n- **Кандидат:** ${candidate.symbol} · Binance Spot.\n- **Проверка:** ${snapshot.scanStartedAt} — ${snapshot.scannedAt} UTC.\n- **Полное 4h-окно:** ${startTime} — ${endTime} UTC.\n- **Изменение за 4h:** +${candidate.priceChange4h.toFixed(2)}%.\n- **Оборот за 4h:** ${(candidate.quoteVolume4h / 1e6).toFixed(2)} млн USDT.\n- **Средний оборот за предыдущие 42 закрытых 4h-свечи:** ${(candidate.averageQuoteVolume4h / 1e6).toFixed(2)} млн USDT.\n- **Отношение объёма к среднему:** ${candidate.volumeRatio.toFixed(2)}×.\n- **Изменение за скользящие 24h:** +${candidate.change24h.toFixed(2)}%; оборот ${(candidate.quoteVolume24h / 1e6).toFixed(1)} млн USDT.\n- **Правило выбора:** только USDT spot пары с положительным изменением цены за те же 4 часа, объёмом не менее 1,5× от собственной средней за 7 дней, 4h-оборотом не менее $1 млн и 24h-оборотом не менее $10 млн. Из прошедших фильтр выбрана максимальная величина «изменение цены 4h × log2(множителя объёма)».\n- **Оговорка:** это текущий рыночный скринер и исторические данные, не гарантия дальнейшего роста.\n\n## Текст озвучки\n\n${segments.map((segment, index) => `${index + 1}. ${segment.scene.voice}`).join("\n\n")}\n\n## Таймлайн по фактической длительности речи\n\n| № | Таймкод | Сцена | Озвучка |\n| --- | --- | --- | --- |\n${timeline.join("\n")}\n\n## Источники\n\n- Binance Spot ticker: https://api.binance.com/api/v3/ticker/24hr?type=FULL\n- Binance Spot candles: https://api.binance.com/api/v3/klines?symbol=${candidate.symbol}&interval=4h&limit=45\n- Исторический QNT срез: Binance Spot, ${QNT_CASE.startUtc} — ${QNT_CASE.endUtc} UTC.\n\n## Монтаж и озвучка\n\n9:16, 1080×1920, 30 fps. Сохранена тёмная графитовая система QNT Impact с кислотно-зелёными акцентами. Кандидат выбран из Binance Spot по синхронному росту цены и объёма за закрытое 4h-окно. Озвучка создана настроенным голосовым провайдером проекта; музыка — существующий инструментальный bed. Финальный голосовой CTA оставлен в формулировке, одобренной пользователем. Отдельная подпись в финале сообщает, что ссылка реферальная и прошлый рост не гарантирует будущий.\n`;
  await writeFile(path.join(runDir, "SCRIPT.md"), script, "utf8");
  await writeFile(
    path.join(runDir, "market-snapshot.json"),
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8",
  );
}

async function concatenateVoice(segments) {
  const listPath = path.join(TEMP_DIR, "voice-list.txt");
  await writeFile(
    listPath,
    `${segments.map((segment) => `file '${segment.path}'`).join("\n")}\n`,
    "utf8",
  );
  const output = path.join(TEMP_DIR, "voice-track.mp3");
  await execFile("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    "-ar",
    "44100",
    "-ac",
    "2",
    output,
  ]);
  return output;
}

async function renderVideo(segments, voiceTrack, candidate, output) {
  const frameDir = path.join(TEMP_DIR, "frames");
  await mkdir(frameDir, { recursive: true });
  const totalDuration = Math.ceil(segments.reduce((sum, item) => sum + item.duration, 0) * FPS) / FPS;
  let frameIndex = 0;
  let sceneStart = 0;

  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    segment.start = sceneStart;
    segment.candidate = candidate;
    const frameCount = Math.round(segment.duration * FPS);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const svg = renderSvg(segment, segmentIndex, frame / FPS, totalDuration);
      await writeFile(
        path.join(frameDir, `${String(frameIndex).padStart(5, "0")}.svg`),
        svg,
        "utf8",
      );
      frameIndex += 1;
    }
    sceneStart += segment.duration;
    console.log(`Rendered SVG scene ${segmentIndex + 1}/${segments.length}: ${frameCount} frames.`);
  }

  const audioDuration = await probeDuration(voiceTrack);
  const actualDuration = Math.min(totalDuration, Math.max(audioDuration, frameIndex / FPS));
  const fadeStart = Math.max(0, actualDuration - 1.15);
  const musicFilter =
    `[2:a]volume=0.17,afade=t=out:st=${fadeStart.toFixed(3)}:d=1.15[music];` +
    "[1:a]volume=1.0[voice];" +
    "[voice][music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0,alimiter=limit=0.95[audio]";

  await execFile(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "warning",
      "-framerate",
      String(FPS),
      "-start_number",
      "0",
      "-i",
      path.join(frameDir, "%05d.svg"),
      "-i",
      voiceTrack,
      "-stream_loop",
      "-1",
      "-i",
      MUSIC,
      "-filter_complex",
      musicFilter,
      "-map",
      "0:v:0",
      "-map",
      "[audio]",
      "-frames:v",
      String(frameIndex),
      "-t",
      actualDuration.toFixed(3),
      "-r",
      String(FPS),
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-movflags",
      "+faststart",
      output,
    ],
    { timeout: 300_000, maxBuffer: 8 * 1024 * 1024 },
  );
  return { actualDuration, frameCount: frameIndex };
}

async function main() {
  console.log("Scanning live Binance Spot market data for one candidate.");
  const snapshot = await scanMarket();
  const candidate = snapshot.selected;
  candidate.scannedAt = snapshot.scannedAt;
  console.log(
    `Selected ${candidate.symbol}: +${candidate.priceChange4h.toFixed(2)}% / 4h, ` +
      `${candidate.volumeRatio.toFixed(2)}x 4h volume baseline.`,
  );

  const runTimestamp = snapshot.scannedAt
    .replace(/[-:]/gu, "")
    .replace(/\.\d{3}/u, "")
    .replace("T", "-")
    .replace("Z", "UTC");
  const runDir = path.join(EXPORT_ROOT, `${candidate.base}-${runTimestamp}`);
  const output = path.join(runDir, `qnt-live-radar-${candidate.base}-${runTimestamp}.mp4`);
  await mkdir(runDir, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  const scenes = makeScenes(candidate);
  const segments = await generateVoiceSegments(scenes);
  for (const segment of segments) segment.candidate = candidate;
  await writeStoryboard(segments, snapshot, runDir);
  const voiceTrack = await concatenateVoice(segments);
  const result = await renderVideo(segments, voiceTrack, candidate, output);

  const { stdout: probe } = await execFile("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "stream=codec_name,width,height,sample_aspect_ratio,r_frame_rate,channels",
    "-show_entries",
    "format=duration,size",
    "-of",
    "json",
    output,
  ]);
  console.log(`Completed: ${output}`);
  console.log(`Frames: ${result.frameCount} · duration: ${result.actualDuration.toFixed(2)} s`);
  console.log(probe.trim());
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});