import type { WhaleRadarV2Event, WhaleRadarV2Metrics, WhaleRadarV2RelatedEvent } from "./v2-story";
import { getWhaleFlowNodeOrder } from "./v2-motion";

export type WhaleRadarV2VisualPayload = {
  durationSeconds: number;
  event: WhaleRadarV2Event;
  relatedEvents: WhaleRadarV2RelatedEvent[];
  metrics: WhaleRadarV2Metrics;
  scannedAt: string;
};

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function buildWhaleRadarV2Html(payload: WhaleRadarV2VisualPayload): string {
  if (payload.durationSeconds < 90 || payload.durationSeconds > 150) {
    throw new Error(`Whale Radar V2 test duration must be near two minutes; got ${payload.durationSeconds}s.`);
  }
  if (payload.metrics.postTradeCandles.length < 2) {
    throw new Error("Whale Radar V2 chart needs at least two saved post-trade candles.");
  }

  const json = safeJson(payload);
  const order = safeJson(getWhaleFlowNodeOrder(payload.event.action));

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Whale Radar Shorts V2 — test render</title>
  <style>
    * { box-sizing: border-box; }
    html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #03020a; }
    body { cursor: none; }
    canvas { display: block; width: 1080px; height: 1920px; background: #03020a; }
  </style>
</head>
<body>
<canvas id="stage" width="1080" height="1920"></canvas>
<script>
(() => {
  "use strict";
  const P = ${json};
  const FLOW_ORDER = ${order};
  const W = 1080;
  const H = 1920;
  const DURATION = ${payload.durationSeconds};
  const SCENE_COUNT = 8;
  const SCENE_LENGTH = DURATION / SCENE_COUNT;
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d", { alpha: false });
  const purple = "#a44cff";
  const palePurple = "#d1a7ff";
  const green = "#a4ff79";
  const red = "#ff6b91";
  const white = "#f7f4ff";
  const muted = "#a5a0b3";
  let startedAt = null;
  let lastTime = 0;
  let finished = false;
  let bybitReady = false;
  const bybit = new Image();
  bybit.onload = () => { bybitReady = true; };
  bybit.src = new URL("../../../../attached_assets/IMG_8017_1790573840780.png", location.href).href;

  const clamp = (n, low = 0, high = 1) => Math.max(low, Math.min(high, n));
  const mix = (a, b, p) => a + (b - a) * p;
  const smooth = (a, b, n) => {
    const x = clamp((n - a) / (b - a));
    return x * x * (3 - 2 * x);
  };
  const easeOut = n => 1 - Math.pow(1 - clamp(n), 3);
  const easeInOut = n => {
    const x = clamp(n);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const fract = n => n - Math.floor(n);
  const hash = n => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const event = P.event;
  const metrics = P.metrics;
  const actionColor = event.action === "BUY" ? green : red;
  const tokenName = event.symbol === "ETH" ? "ЭФИРИУМ" : event.symbol;
  const flowLabels = {
    wallet: event.walletLabel || "SMART MONEY",
    dex: "DEX · SWAP",
    token: tokenName,
  };

  function roundedRect(x, y, w, h, r, fill, stroke, lineWidth = 1) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function text(value, x, y, size, options = {}) {
    const { color = white, align = "left", weight = 700, alpha = 1, tracking = 0, glow = 0,
      baseline = "alphabetic", family = '"DejaVu Sans", Arial, sans-serif', italic = false } = options;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = (italic ? "italic " : "") + weight + " " + size + "px " + family;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if ("letterSpacing" in ctx) ctx.letterSpacing = tracking + "px";
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
    ctx.fillStyle = color;
    ctx.fillText(String(value), x, y);
    ctx.restore();
  }

  function wrapText(value, x, y, maxWidth, lineHeight, options = {}) {
    const words = String(value).split(/\\s+/u);
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? current + " " + word : word;
      ctx.save();
      ctx.font = (options.weight || 500) + " " + (options.size || 24) + "px " + (options.family || '"DejaVu Sans", Arial, sans-serif');
      const width = ctx.measureText(next).width;
      ctx.restore();
      if (width > maxWidth && current) { lines.push(current); current = word; }
      else current = next;
    }
    if (current) lines.push(current);
    lines.forEach((lineText, index) => text(lineText, x, y + index * lineHeight, options.size || 24, options));
    return lines.length;
  }

  function line(x1, y1, x2, y2, color = purple, width = 2, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function circle(x, y, radius, color, alpha = 1, fill = true, lineWidth = 2, glow = 0) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0.1, radius), 0, Math.PI * 2);
    if (fill) {
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = color;
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = glow; }
      ctx.stroke();
    }
    ctx.restore();
  }

  function formatUsd(value, decimals = 0) {
    return "$" + new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
  }

  function formatToken(value, decimals = 4) {
    return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: decimals }).format(value);
  }

  function formatUtc(value) {
    return new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value)) + " UTC";
  }

  function shortAddress(value) {
    if (!value) return "адрес сохранён";
    return value.slice(0, 10) + "…" + value.slice(-6);
  }

  function drawBackground(t, section) {
    const base = ctx.createLinearGradient(0, 0, W * 0.74, H);
    base.addColorStop(0, "#090511");
    base.addColorStop(0.48, "#08050f");
    base.addColorStop(1, "#020207");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    const bloomX = W * 0.5 + Math.sin(t * 0.18) * 120;
    const bloomY = H * 0.38 + Math.cos(t * 0.14) * 75;
    const bloom = ctx.createRadialGradient(bloomX, bloomY, 10, bloomX, bloomY, 820);
    bloom.addColorStop(0, "rgba(116,36,190,0.24)");
    bloom.addColorStop(0.52, "rgba(56,20,92,0.12)");
    bloom.addColorStop(1, "rgba(4,2,10,0)");
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, W, H);

    // Crisp base mesh plus two independently moving parallax layers.
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(190,142,255,0.055)";
    for (let x = 0; x <= W; x += 54) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = -54 + ((t * 4) % 54); y <= H; y += 54) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(199,157,255,0.075)";
    for (let x = -108 + ((t * 8) % 108); x <= W + 108; x += 108) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - 80, H); ctx.stroke();
    }
    ctx.restore();

    const horizon = H * 0.61;
    ctx.save();
    ctx.lineWidth = 1;
    for (let i = -8; i <= 8; i += 1) {
      ctx.strokeStyle = "rgba(177,104,255," + (0.045 + (i % 2 === 0 ? 0.02 : 0)) + ")";
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.sin(t * 0.08) * 12, horizon);
      ctx.lineTo(W / 2 + i * 188 + Math.sin(t * 0.12 + i) * 12, H + 20);
      ctx.stroke();
    }
    for (let i = 0; i < 15; i += 1) {
      const f = i / 14;
      const y = horizon + Math.pow(f, 1.72) * (H - horizon + 30);
      ctx.strokeStyle = "rgba(172,93,250," + (0.035 + 0.018 * (0.5 + 0.5 * Math.sin(t * 0.5 + i))) + ")";
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();

    for (let i = 0; i < 30; i += 1) {
      const seed = i * 17.3;
      const x = (hash(seed) * W + t * (5 + hash(seed + 1) * 11)) % W;
      const y = (hash(seed + 2) * H + Math.sin(t * 0.3 + seed) * 18 + H) % H;
      const alpha = 0.12 + (0.5 + 0.5 * Math.sin(t * (0.7 + hash(seed + 4)) + seed)) * 0.28;
      circle(x, y, 1 + hash(seed + 3) * 1.8, i % 5 === 0 ? palePurple : purple, alpha);
    }

    const vignette = ctx.createRadialGradient(W / 2, H / 2, 440, W / 2, H / 2, 1190);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    text("WHALE RADAR  /  ON-CHAIN", 56, 74, 18, { color: palePurple, weight: 600, tracking: 2.4, alpha: 0.87 });
    text("ТЕСТ V2  ·  NANSEN", W - 56, 74, 16, { color: "#d5d0df", align: "right", weight: 500, tracking: 1.8, alpha: 0.68 });
    line(56, 105, W - 56, 105, "#bb82ff", 1, 0.34);
    text("СОХРАНЁННЫЕ ДАННЫЕ · НЕ ПУБЛИКУЕТСЯ АВТОМАТИЧЕСКИ", 56, H - 46, 12, {
      color: "#b9b2c7", weight: 500, tracking: 1.2, alpha: 0.68,
    });
    text(String(section + 1).padStart(2, "0") + " / 08", W - 56, H - 46, 12, {
      color: muted, align: "right", weight: 600, tracking: 1.8, alpha: 0.7,
    });
  }

  function drawImpactRings(x, y, t, color = purple, phase = 0) {
    for (let i = 0; i < 3; i += 1) {
      const p = fract((t * 0.34 + phase + i / 3) * 0.85);
      circle(x, y, 18 + p * 116, color, (1 - p) * 0.32, false, 1.4);
    }
  }

  function drawSweep(local, phase = 0) {
    const progress = fract(local / 4.8 + phase);
    const x = mix(-260, W + 260, progress);
    const gradient = ctx.createLinearGradient(x - 170, 0, x + 170, 0);
    gradient.addColorStop(0, "rgba(164,76,255,0)");
    gradient.addColorStop(0.45, "rgba(164,76,255,0.04)");
    gradient.addColorStop(0.55, "rgba(226,196,255,0.29)");
    gradient.addColorStop(1, "rgba(164,76,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x - 170, 150, 340, H - 260);
  }

  function pointOnCubic(p0, p1, p2, p3, p) {
    const q = 1 - p;
    return {
      x: q*q*q*p0.x + 3*q*q*p*p1.x + 3*q*p*p*p2.x + p*p*p*p3.x,
      y: q*q*q*p0.y + 3*q*q*p*p1.y + 3*q*p*p*p2.y + p*p*p*p3.y,
    };
  }

  function routePoints() {
    const byNode = {
      wallet: { x: W * 0.5, y: H * 0.32 },
      dex: { x: W * 0.5, y: H * 0.51 },
      token: { x: W * 0.5, y: H * 0.70 },
    };
    return FLOW_ORDER.map(key => byNode[key]);
  }

  function drawEnergyRoute(t, local, sceneDuration, strength = 1) {
    const nodes = routePoints();
    const progress = clamp(local / Math.max(1, sceneDuration - 1.2));
    for (let s = 0; s < 2; s += 1) {
      const p0 = nodes[s];
      const p3 = nodes[s + 1];
      const bend = s === 0 ? -48 : 54;
      const p1 = { x: p0.x + bend, y: mix(p0.y, p3.y, 0.34) };
      const p2 = { x: p3.x - bend, y: mix(p0.y, p3.y, 0.67) };
      const segmentP = clamp(progress * 2 - s);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      const samples = Math.max(1, Math.floor(segmentP * 48));
      for (let i = 1; i <= samples; i += 1) {
        const point = pointOnCubic(p0, p1, p2, p3, i / 48);
        ctx.lineTo(point.x, point.y);
      }
      ctx.strokeStyle = actionColor;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.72 * strength;
      ctx.shadowColor = actionColor;
      ctx.shadowBlur = 24;
      ctx.stroke();
      ctx.restore();

      if (progress >= s * 0.5 && progress <= (s + 1) * 0.5) {
        const tailCount = 11;
        for (let k = tailCount; k >= 0; k -= 1) {
          const trailProgress = clamp(segmentP - k * 0.018);
          const point = pointOnCubic(p0, p1, p2, p3, trailProgress);
          const alpha = (1 - k / (tailCount + 1)) * 0.72 * strength;
          circle(point.x, point.y, k === 0 ? 12 : 4 + (tailCount - k) * 0.42, k === 0 ? white : actionColor, alpha, true, 1, 22);
        }
        const head = pointOnCubic(p0, p1, p2, p3, segmentP);
        circle(head.x, head.y, 10, actionColor, 0.96 * strength, true, 1, 32);
        circle(head.x, head.y, 3.4, white, 1);
        if (segmentP > 0.91) {
          const flash = 1 - (segmentP - 0.91) / 0.09;
          circle(p3.x, p3.y, 14 + (1 - flash) * 42, white, flash * 0.48 * strength, false, 2.4, 12);
          drawImpactRings(p3.x, p3.y, t, actionColor, 0.1);
        }
      }
    }

    nodes.forEach((point, index) => {
      const nodeKey = FLOW_ORDER[index];
      const pulse = 1 + 0.14 * Math.sin(t * 4.1 - index * 1.4);
      const color = nodeKey === "token" ? actionColor : palePurple;
      circle(point.x, point.y, 42 * pulse, "#130c1e", 0.98);
      circle(point.x, point.y, 42 * pulse, color, 0.88, false, 2, 10);
      circle(point.x, point.y, 7.5, color, 0.92, true, 1, 20);
      text(flowLabels[nodeKey], point.x, point.y + 72, nodeKey === "wallet" ? 22 : 26, {
        color: nodeKey === "token" ? actionColor : white, align: "center", weight: 800, tracking: 1.3, glow: 8,
      });
      if (nodeKey === "dex") {
        text(event.dex ? String(event.dex).toUpperCase() : "ПЛОЩАДКА НЕ УКАЗАНА", point.x, point.y + 105, 13, {
          color: muted, align: "center", weight: 500, tracking: 1.4,
        });
      }
    });
  }

  function drawTitle(t, local) {
    const reveal = easeOut(local / 0.9);
    const slide = mix(-140, 0, reveal);
    const centerX = W / 2;
    text("СЕГОДНЯ · 6 ОКТЯБРЯ", centerX, 330 + slide, 18, { color: palePurple, align: "center", weight: 700, tracking: 4, alpha: reveal });
    text("СДЕЛКА", centerX, 510 + slide, 77, { color: white, align: "center", weight: 900, tracking: 3, glow: 26, alpha: reveal });
    text("SMART MONEY", centerX, 602 + slide, 34, { color: actionColor, align: "center", weight: 800, tracking: 5, glow: 18, alpha: reveal });
    roundedRect(150, 700, W - 300, 94, 7, "rgba(164,255,121,0.08)", "rgba(164,255,121,0.68)", 1.7);
    text(event.action + "  /  " + tokenName, centerX, 760, 28, { color: actionColor, align: "center", weight: 800, tracking: 2.2, glow: 12 });
    text("ОНЧЕЙН-РАЗБОР · NANSEN", centerX, 874, 16, { color: muted, align: "center", weight: 600, tracking: 3 });
    drawImpactRings(centerX, 1160, t, actionColor, 0.2);
    drawEnergyRoute(t, local, SCENE_LENGTH, 0.86);
    drawSweep(local, 0.14);
  }

  function drawAmount(t, local) {
    const reveal = easeOut(local / 0.65);
    const count = event.amountUsd * easeInOut((local - 0.3) / 2.0);
    const breathe = 1 + Math.sin(t * 1.6) * 0.012;
    ctx.save();
    ctx.translate(W / 2, 610);
    ctx.scale(breathe, breathe);
    text(formatUsd(count), 0, 0, 74, { color: white, align: "center", weight: 900, tracking: -1.6, glow: 27, alpha: reveal });
    ctx.restore();
    text("ОЦЕНКА СДЕЛКИ · USD", W / 2, 680, 17, { color: palePurple, align: "center", weight: 700, tracking: 3.5, alpha: reveal });

    const input = metrics.inputTokenAmount;
    const output = metrics.outputTokenAmount;
    const inputName = metrics.inputTokenSymbol || "TOKEN";
    const outputName = metrics.outputTokenSymbol || event.symbol;
    roundedRect(94, 810, W - 188, 234, 10, "rgba(16,10,28,0.8)", "rgba(199,152,255,0.46)", 1.4);
    text("SWAP · " + event.action, W / 2, 866, 15, { color: actionColor, align: "center", weight: 800, tracking: 3.5, alpha: reveal });
    text(formatToken(input || 0, 5) + " " + inputName, W / 2, 944, 31, { color: white, align: "center", weight: 700, tracking: 0.6, alpha: reveal });
    text("↓", W / 2, 994, 32, { color: palePurple, align: "center", weight: 600, alpha: reveal });
    text(formatToken(output || 0, 6) + " " + outputName, W / 2, 1035, 31, { color: green, align: "center", weight: 800, tracking: 0.6, glow: 10, alpha: reveal });

    const barX = 150;
    const barW = W - 300;
    for (let i = 0; i < 24; i += 1) {
      const x = barX + i * (barW / 24);
      const h = 15 + (0.5 + 0.5 * Math.sin(t * 2.8 + i * 0.78)) * (22 + hash(i) * 60);
      ctx.fillStyle = i % 6 === 0 ? "rgba(204,153,255,0.48)" : "rgba(167,100,231,0.18)";
      ctx.fillRect(x, 1320 - h, 5, h);
    }
    line(barX, 1321, barX + barW, 1321, palePurple, 1, 0.31);
    text("ЦЕНА СДЕЛКИ  " + formatUsd(event.priceUsd || 0, 2), W / 2, 1430, 19, {
      color: muted, align: "center", weight: 600, tracking: 1.1,
    });
    drawSweep(local, 0.34);
  }

  function drawFlowScene(t, local) {
    text("МАРШРУТ ПОКУПКИ", W / 2, 260, 22, { color: white, align: "center", weight: 800, tracking: 3.6 });
    text("КОШЕЛЁК  →  DEX  →  " + tokenName, W / 2, 309, 15, { color: muted, align: "center", weight: 600, tracking: 1.2 });
    drawEnergyRoute(t, local, SCENE_LENGTH, 1);
    drawSweep(local, 0.52);
    const textY = 1570;
    text(event.action === "BUY" ? "ПОЛУЧЕНО В СВОПЕ" : "ОТДАНО В СВОПЕ", W / 2, textY, 16, {
      color: palePurple, align: "center", weight: 700, tracking: 3,
    });
    text(formatToken(event.amount, 4) + " " + event.symbol, W / 2, textY + 74, 40, {
      color: white, align: "center", weight: 800, tracking: 0.7, glow: 13,
    });
  }

  function drawWalletScene(t, local) {
    const cx = W / 2;
    const cy = 765;
    const radius = 206 + Math.sin(t * 0.72) * 7;
    const address = shortAddress(metrics.walletAddress);
    for (let i = 0; i < 14; i += 1) {
      const angle = i / 14 * Math.PI * 2 + t * 0.1;
      const rr = radius + Math.sin(i * 1.8 + t) * 25;
      const x = cx + Math.cos(angle) * rr;
      const y = cy + Math.sin(angle) * rr;
      line(cx, cy, x, y, i % 3 === 0 ? palePurple : purple, 1.2, 0.18);
      circle(x, y, i % 4 === 0 ? 6 : 3.2, i % 3 === 0 ? palePurple : purple, 0.68, true, 1, 7);
      if (i % 2 === 0) {
        const nextAngle = angle + Math.PI * 2 / 14;
        line(x, y, cx + Math.cos(nextAngle) * radius, cy + Math.sin(nextAngle) * radius, purple, 1, 0.11);
      }
    }
    ctx.save();
    ctx.setLineDash([5, 13]);
    ctx.lineDashOffset = -t * 22;
    circle(cx, cy, radius + 30, palePurple, 0.46, false, 1.5);
    ctx.restore();
    drawImpactRings(cx, cy, t, palePurple, 0.1);
    circle(cx, cy, 110, "#100919", 1);
    circle(cx, cy, 110, palePurple, 0.93, false, 2.6, 14);
    text("0x", cx, cy - 10, 55, { color: white, align: "center", weight: 900, tracking: 2, glow: 20 });
    text("WALLET", cx, cy + 36, 15, { color: palePurple, align: "center", weight: 700, tracking: 4 });
    text(event.walletLabel || "SMART MONEY", cx, 1110, 30, { color: white, align: "center", weight: 800, tracking: 1.1 });
    text("МЕТКА NANSEN · НЕ ИМЯ ВЛАДЕЛЬЦА", cx, 1152, 13, { color: muted, align: "center", weight: 600, tracking: 1.4 });
    text(address, cx, 1210, 17, { color: palePurple, align: "center", weight: 600, tracking: 1.2 });

    const related = P.relatedEvents.slice(0, 3);
    const y0 = 1350;
    line(170, y0, 170, y0 + 280, palePurple, 2, 0.45);
    related.forEach((item, index) => {
      const y = y0 + index * 92;
      const x = 170;
      circle(x, y, 9, index === related.length - 1 ? green : palePurple, 0.93, true, 1, 12);
      const verb = item.action === "BUY" ? "BUY" : "SELL";
      text(formatUtc(item.eventTimestamp) + "  ·  " + verb + " " + item.symbol, 204, y + 5, 17, {
        color: white, weight: 700, tracking: 0.2,
      });
      text(formatUsd(item.amountUsd), 204, y + 34, 16, { color: index === related.length - 1 ? green : muted, weight: 600 });
    });
    drawEnergyRoute(t, local, SCENE_LENGTH, 0.6);
  }

  function drawMorphTokenMark(cx, cy, t, local) {
    const morph = easeInOut(local / 2.6);
    const radius = 96;
    const circlePoints = [];
    const diamondPoints = [];
    for (let i = 0; i < 8; i += 1) {
      const a = -Math.PI / 2 + i * Math.PI / 4;
      circlePoints.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
      const d = [
        { x: 0, y: -radius }, { x: radius * 0.5, y: -radius * 0.12 },
        { x: radius * 0.45, y: radius * 0.42 }, { x: 0, y: radius },
        { x: -radius * 0.45, y: radius * 0.42 }, { x: -radius * 0.5, y: -radius * 0.12 },
        { x: 0, y: -radius * 0.52 }, { x: radius * 0.18, y: -radius * 0.12 },
      ];
      diamondPoints.push(d[i]);
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(t * 0.28) * 0.025);
    ctx.shadowColor = palePurple;
    ctx.shadowBlur = 28;
    ctx.strokeStyle = palePurple;
    ctx.lineWidth = 3;
    ctx.beginPath();
    circlePoints.forEach((point, i) => {
      const target = diamondPoints[i];
      const x = mix(point.x, target.x, morph);
      const y = mix(point.y, target.y, morph);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function drawTokenScene(t, local) {
    const cx = W / 2;
    const cy = 720;
    drawMorphTokenMark(cx, cy, t, local);
    [154, 192, 230].forEach((radius, i) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * (i % 2 ? -0.055 : 0.04) + i * 0.6);
      ctx.setLineDash([82, 24, 9, 24]);
      ctx.lineDashOffset = -t * (18 + i * 7);
      circle(0, 0, radius, i === 1 ? palePurple : purple, 0.34 - i * 0.055, false, 1.2);
      ctx.restore();
    });
    text(formatToken(metrics.outputTokenAmount || event.amount, 4), cx, 1090, 58, { color: white, align: "center", weight: 900, tracking: -1, glow: 20 });
    text(metrics.outputTokenSymbol || event.symbol, cx, 1145, 24, { color: green, align: "center", weight: 800, tracking: 4, glow: 10 });
    text("ИСПОЛНЕННЫЙ ОБЪЁМ", cx, 1195, 14, { color: muted, align: "center", weight: 600, tracking: 3 });
    text("ЦЕНА В МОМЕНТ СДЕЛКИ", cx, 1350, 14, { color: palePurple, align: "center", weight: 700, tracking: 2.7 });
    text(formatUsd(event.priceUsd || 0, 2), cx, 1425, 34, { color: white, align: "center", weight: 800, tracking: 0.7 });
    drawEnergyRoute(t, local, SCENE_LENGTH, 0.48);
    const p = easeInOut((local - 1.1) / 2.8);
    line(145, 1545, 145 + (W - 290) * p, 1545, green, 2.2, 0.76);
    circle(145 + (W - 290) * p, 1545, 5.5, green, 0.94, true, 1, 14);
  }

  function drawChartScene(t, local) {
    const candles = metrics.postTradeCandles;
    const x0 = 116;
    const x1 = W - 100;
    const y0 = 1240;
    const y1 = 580;
    const entry = event.priceUsd || candles[0].open;
    const prices = [entry];
    candles.forEach(c => prices.push(c.close));
    const lows = [entry, ...candles.map(c => c.low)];
    const highs = [entry, ...candles.map(c => c.high)];
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const padding = Math.max((max - min) * 0.18, entry * 0.0015);
    const minY = min - padding;
    const maxY = max + padding;
    const yFor = value => y0 - ((value - minY) / Math.max(1e-9, maxY - minY)) * (y0 - y1);
    const count = candles.length;
    const progress = clamp((local - 1.0) / (SCENE_LENGTH * 0.72));
    const visible = Math.max(1, Math.min(count, Math.floor(progress * count) + 1));
    const gap = (x1 - x0) / Math.max(count, 1);

    text("ЦЕНА ПОСЛЕ СДЕЛКИ", 82, 300, 21, { color: palePurple, weight: 700, tracking: 3.6 });
    text("1H OHLC · NANSEN", 82, 340, 13, { color: muted, weight: 600, tracking: 2 });

    for (let i = 0; i <= 4; i += 1) {
      const y = y1 + (y0 - y1) * i / 4;
      line(x0, y, x1, y, "#c495ff", 1, 0.09);
      const price = maxY - (maxY - minY) * i / 4;
      text(formatUsd(price, 0), 86, y - 10, 12, { color: muted, weight: 500, tracking: 0.2 });
    }
    for (let i = 0; i <= 6; i += 1) {
      const x = x0 + (x1 - x0) * i / 6;
      line(x, y1, x, y0, "#c495ff", 1, 0.065);
    }
    const entryY = yFor(entry);
    ctx.save();
    ctx.setLineDash([9, 8]);
    line(x0, entryY, x1, entryY, actionColor, 1.4, 0.62);
    ctx.restore();
    text("ВХОД " + formatUsd(entry, 2), x1, entryY - 16, 13, { color: actionColor, align: "right", weight: 700, tracking: 0.4 });

    for (let i = 0; i < visible; i += 1) {
      const c = candles[i];
      const x = x0 + gap * (i + 0.5);
      const bodyW = Math.max(5, Math.min(15, gap * 0.44));
      const color = c.close >= c.open ? green : red;
      line(x, yFor(c.high), x, yFor(c.low), color, 2, 0.82);
      const bodyTop = Math.min(yFor(c.open), yFor(c.close));
      const bodyHeight = Math.max(3, Math.abs(yFor(c.open) - yFor(c.close)));
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.86;
      ctx.fillRect(x - bodyW / 2, bodyTop, bodyW, bodyHeight);
      ctx.globalAlpha = 1;
      if (i === visible - 1) {
        circle(x, yFor(c.close), 8, color, 0.95, true, 1, 16);
        drawImpactRings(x, yFor(c.close), t, color, 0.14);
      }
    }

    const endCandle = candles.at(-1);
    const move = metrics.priceChangePercent;
    const moveText = move === null ? "НЕТ ДАННЫХ" : (move > 0 ? "+" : move < 0 ? "−" : "") + formatToken(Math.abs(move), 2) + "%";
    text(moveText, 84, 470, 54, {
      color: move !== null && move < 0 ? red : green, weight: 900, tracking: 0.6, glow: 18,
    });
    text("ОТ СДЕЛКИ ДО ПОСЛЕДНЕЙ СОХРАНЁННОЙ СВЕЧИ", 86, 515, 12, { color: muted, weight: 600, tracking: 1.3 });
    if (endCandle) {
      text(formatUtc(endCandle.timestamp) + "  ·  " + formatUsd(endCandle.close, 2), W / 2, 1335, 16, {
        color: white, align: "center", weight: 700, tracking: 0.6,
      });
      text("ПОЛНЫЕ 24H / 7D ПОСЛЕ СДЕЛКИ ЕЩЁ НЕ НАКОПЛЕНЫ", W / 2, 1382, 12, {
        color: muted, align: "center", weight: 500, tracking: 1.2,
      });
    }
    text(formatUtc(event.eventTimestamp), x0, 1495, 12, { color: muted, weight: 500, tracking: 0.2 });
    if (endCandle) text(formatUtc(endCandle.timestamp), x1, 1495, 12, { color: muted, align: "right", weight: 500, tracking: 0.2 });
    drawSweep(local, 0.72);
  }

  function drawProofScene(t, local) {
    const reveal = easeOut(local / 0.6);
    const centerY = 780;
    roundedRect(62, 470, W - 124, 780, 14, "rgba(13,9,22,0.8)", "rgba(190,142,255,0.45)", 1.5);
    text("ПОДТВЕРЖДЁННАЯ ОПЕРАЦИЯ", W / 2, 385, 18, { color: palePurple, align: "center", weight: 700, tracking: 3.5, alpha: reveal });
    text("NANSEN", W / 2, centerY - 164, 62, { color: white, align: "center", weight: 900, tracking: 3, glow: 25, alpha: reveal });
    text("SMART MONEY DEX TRADE", W / 2, centerY - 90, 17, { color: green, align: "center", weight: 800, tracking: 2.5, glow: 8, alpha: reveal });
    text(event.action + " · " + event.symbol + " · " + event.blockchain.toUpperCase(), W / 2, centerY - 20, 16, {
      color: "#ded7e9", align: "center", weight: 600, tracking: 0.7, alpha: reveal,
    });
    text("TX HASH", 108, centerY + 90, 13, { color: muted, weight: 700, tracking: 2, alpha: reveal });
    wrapText(event.transactionHash, 108, centerY + 136, W - 216, 27, {
      color: white, size: 15, weight: 600, tracking: 0.2, alpha: reveal,
    });
    text("DEX VENUE", 108, centerY + 234, 13, { color: muted, weight: 700, tracking: 2, alpha: reveal });
    wrapText(event.dex ? event.dex : "Не указана в сохранённом ответе Nansen", 108, centerY + 278, W - 216, 30, {
      color: palePurple, size: 17, weight: 600, tracking: 0.2, alpha: reveal,
    });
    text("СДЕЛКА НЕ ЯВЛЯЕТСЯ ОБЕЩАНИЕМ ДОХОДНОСТИ", W / 2, 1307, 12, {
      color: muted, align: "center", weight: 600, tracking: 1.3, alpha: reveal * 0.82,
    });
    drawEnergyRoute(t, local, SCENE_LENGTH, 0.52);
    drawSweep(local, 0.22);
  }

  function drawSubscribeButton(t, local) {
    const cx = W / 2;
    const cy = 1160;
    const breathe = 1 + Math.sin(t * 3.15) * 0.018;
    const subscribed = smooth(SCENE_LENGTH * 0.72, SCENE_LENGTH * 0.91, local);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(breathe, breathe);
    ctx.shadowColor = "#9d43ff";
    ctx.shadowBlur = 36;
    roundedRect(-270, -68, 540, 132, 15, subscribed > 0.5 ? "#382057" : "#6f24bd", "rgba(226,195,255,0.96)", 2);
    ctx.restore();
    const buttonLabel = subscribed > 0.5 ? "ВЫ ПОДПИСАНЫ" : "ПОДПИСАТЬСЯ";
    text(buttonLabel, cx, cy + 12, 27, { color: white, align: "center", weight: 900, tracking: 2.2, glow: 16 });
    circle(cx + 218, cy - 30, 9 + 4 * Math.sin(t * 4), green, 0.95, true, 1, 16);
    const ring = 1 + fract(t * 0.62) * 42;
    circle(cx + 218, cy - 30, ring, green, 0.38 * (1 - fract(t * 0.62)), false, 1.3);
    for (let i = 0; i < 4; i += 1) {
      const p = fract(t * 0.18 + i / 4);
      circle(cx - 340 + p * 680, cy + 115, 2.8, palePurple, 0.65 * (1 - p));
    }
  }

  function drawCtaScene(t, local) {
    const enter = easeOut(local / 1.0);
    const slide = (1 - enter) * 80;
    text("КАЖДЫЙ ДЕНЬ", W / 2, 500 + slide, 19, { color: palePurple, align: "center", weight: 700, tracking: 4.2, alpha: enter });
    text("СДЕЛКИ КИТОВ", W / 2, 605 + slide, 48, { color: white, align: "center", weight: 900, tracking: 1.4, glow: 24, alpha: enter });
    wrapText("Подпишись: каждый день — подтверждённые движения Smart Money и разбор цены после сделки.", W / 2, 690 + slide, 840, 33, {
      color: "#ded7e9", size: 20, align: "center", weight: 500, tracking: 0.1, alpha: enter * 0.92,
    });
    drawSubscribeButton(t, local);

    if (bybitReady) {
      const bannerScale = Math.min(0.66, 640 / bybit.naturalWidth);
      const bw = bybit.naturalWidth * bannerScale;
      const bh = bybit.naturalHeight * bannerScale;
      const y = 1405;
      const bannerReveal = easeOut((local - SCENE_LENGTH * 0.12) / 1.0);
      const x = (W - bw) / 2 + (1 - bannerReveal) * 120;
      ctx.save();
      ctx.shadowColor = "#bd86ff";
      ctx.shadowBlur = 28;
      roundedRect(x - 12, y - 12, bw + 24, bh + 24, 13, "#0b0710", "rgba(194,139,255,.7)", 1.4);
      ctx.drawImage(bybit, x, y, bw, bh);
      ctx.restore();
    }
    text("ССЫЛКА НА БИРЖУ — В ШАПКЕ ПРОФИЛЯ КАНАЛА", W / 2, 1665, 15, {
      color: green, align: "center", weight: 800, tracking: 1.2, glow: 10, alpha: enter,
    });
    wrapText("Посмотри, что происходит с " + tokenName.toLowerCase() + ", или купи другую криптовалюту.", W / 2, 1710, 880, 27, {
      color: "#c2bacc", size: 16, align: "center", weight: 500, tracking: 0.1, alpha: enter * 0.86,
    });
    text("ТЕСТОВЫЙ РОЛИК · БЕЗ АВТОПУБЛИКАЦИИ", W / 2, 1790, 12, {
      color: muted, align: "center", weight: 500, tracking: 1.6, alpha: enter * 0.72,
    });
    drawSweep(local, 0.44);
  }

  const scenes = [drawTitle, drawAmount, drawFlowScene, drawWalletScene, drawTokenScene, drawChartScene, drawProofScene, drawCtaScene];

  function render(timeSeconds) {
    const t = clamp(timeSeconds, 0, DURATION);
    const index = Math.min(SCENE_COUNT - 1, Math.floor(t / SCENE_LENGTH));
    const local = t - index * SCENE_LENGTH;
    const sceneTime = Math.min(local, Math.max(0, SCENE_LENGTH - 0.68));
    drawBackground(t, index);
    const transitionIn = Math.exp(-local / 0.55);
    const zoom = 1.01 + Math.sin(sceneTime / SCENE_LENGTH * Math.PI * 2 + index * 0.8) * 0.016 + transitionIn * 0.028;
    const cameraX = Math.sin(t * 0.22 + index) * 9;
    const cameraY = Math.cos(t * 0.18 + index * 0.8) * 13;
    ctx.save();
    ctx.translate(W / 2 + cameraX, H / 2 + cameraY);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);
    scenes[index](t, sceneTime);
    ctx.restore();
    if (index > 0 && local < 0.54) {
      const sweepX = mix(-260, W + 260, easeInOut(local / 0.54));
      const beam = ctx.createLinearGradient(sweepX - 130, 0, sweepX + 130, 0);
      beam.addColorStop(0, "rgba(164,76,255,0)");
      beam.addColorStop(0.47, "rgba(164,76,255,0.05)");
      beam.addColorStop(0.54, "rgba(245,228,255,0.62)");
      beam.addColorStop(1, "rgba(164,76,255,0)");
      ctx.fillStyle = beam;
      ctx.fillRect(sweepX - 130, 105, 260, H - 190);
    }
    const fade = smooth(DURATION - 0.7, DURATION, t);
    if (fade > 0) {
      ctx.fillStyle = "rgba(3,2,10," + (fade * 0.88) + ")";
      ctx.fillRect(0, 0, W, H);
    }
  }

  function tick(now) {
    if (startedAt === null) {
      render(0);
    } else {
      const time = Math.min(DURATION, (now - startedAt) / 1000);
      lastTime = Math.max(lastTime, time);
      render(lastTime);
      if (lastTime >= DURATION) finished = true;
    }
    if (!finished) requestAnimationFrame(tick);
  }

  function play() {
    if (startedAt !== null) return;
    startedAt = performance.now();
    lastTime = 0;
    finished = false;
  }
  window.playWhaleRadarV2 = play;
  window.__whaleRadarV2Ready = true;
  document.addEventListener("keydown", eventKey => {
    if (eventKey.code === "Space" || eventKey.code === "Enter") play();
  });
  requestAnimationFrame(tick);
})();
</script>
</body>
</html>`;
}
