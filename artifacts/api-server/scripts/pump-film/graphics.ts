type PumpFilmScene = {
  scene_number: number;
  title: string;
  visual: string;
  description: string;
};

const C = {
  bg: "#0A1117",
  panel: "#111B23",
  panel2: "#16242D",
  text: "#F2F6F7",
  muted: "#9AACB7",
  cyan: "#51C8D4",
  mint: "#80E0B0",
  amber: "#FFBF69",
  risk: "#FF7185",
  grid: "#263A45",
};

const esc = (value: string): string => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const text = (x: number, y: number, value: string, size = 24, color = C.text, weight = 400, anchor = "start"): string =>
  `<text x="${x}" y="${y}" fill="${color}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${size}px" font-weight="${weight}" text-anchor="${anchor}">${esc(value)}</text>`;
const line = (x1: number, y1: number, x2: number, y2: number, color = C.grid, width = 2, dash = "") =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
const rect = (x: number, y: number, w: number, h: number, fill = C.panel, stroke = "none", r = 14) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
const circle = (x: number, y: number, r: number, fill: string, stroke = "none", width = 2) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const path = (d: string, stroke: string, width = 4, fill = "none", dash = "") =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ""}/>`;
const arrow = (x1: number, y1: number, x2: number, y2: number, color = C.cyan): string =>
  `${line(x1, y1, x2, y2, color, 4)}<path d="M${x2 - 13},${y2 - 8} L${x2},${y2} L${x2 - 13},${y2 + 8}" fill="none" stroke="${color}" stroke-width="4"/>`;
const pill = (x: number, y: number, label: string, color = C.cyan, w = Math.max(110, label.length * 13 + 34)): string =>
  `${rect(x, y, w, 38, color, "none", 19)}${text(x + w / 2, y + 26, label, 17, C.bg, 700, "middle")}`;
const card = (x: number, y: number, w: number, h: number, heading: string, body: string | string[], accent = C.cyan): string => {
  const lines = Array.isArray(body) ? body : body.split("\n");
  return `${rect(x, y, w, h)}${rect(x, y, 7, h, accent, "none", 4)}${text(x + 25, y + 39, heading, 25, C.text, 700)}${
    lines.map((lineText, index) => text(x + 25, y + 78 + index * 30, lineText, 19, C.muted)).join("")
  }`;
};
const dotLabel = (x: number, y: number, label: string, color: string): string =>
  `${circle(x, y - 7, 7, color)}${text(x + 20, y, label, 22, C.text, 500)}`;

function base(scene: PumpFilmScene, sourceLabel: string, sceneCount: number, content: string): string {
  const index = String(scene.scene_number).padStart(2, "0");
  const progress = Math.min(100, Math.max(0, scene.scene_number / Math.max(1, sceneCount) * 100));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080" role="img" aria-label="${esc(scene.title)}">
<rect width="1920" height="1080" fill="${C.bg}"/>
<defs><pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="${C.grid}" stroke-opacity=".25"/></pattern></defs>
<rect x="0" y="0" width="1920" height="790" fill="url(#grid)"/>
<rect x="64" y="42" width="1792" height="1" fill="${C.grid}"/>
${text(70, 31, `PUMP / ИССЛЕДОВАТЕЛЬСКИЙ ФИЛЬМ`, 16, C.muted, 700)}${text(1850, 31, `${index} / ${String(sceneCount).padStart(2, "0")}`, 16, C.muted, 700, "end")}
${text(70, 101, scene.title, 42, C.text, 700)}
${text(1850, 97, scene.visual.replace(/-/g, " ").toUpperCase(), 15, C.cyan, 700, "end")}
${content}
<rect x="64" y="813" width="1792" height="1" fill="${C.grid}"/>
${text(70, 1028, `Источник: ${sourceLabel}`, 15, C.muted)}
${line(70, 1050, 1850, 1050, C.grid, 6)}<rect x="70" y="1047" width="${1780 * progress / 100}" height="6" rx="3" fill="${C.mint}"/>
</svg>`;
}

function graphic(scene: PumpFilmScene): string {
  const v = scene.visual;
  if (v === "three-columns") {
    return [card(90, 190, 510, 430, "БИЗНЕС ПЛОЩАДКИ", ["комиссии", "и продукт"], C.cyan),
      card(705, 190, 510, 430, "РЫНОЧНЫЙ СПРОС", ["внимание", "и сделки"], C.mint),
      card(1320, 190, 510, 430, "ПРАВА ДЕРЖАТЕЛЯ", ["юридические", "условия"], C.amber),
      text(960, 690, "≠", 48, C.risk, 700, "middle")].join("");
  }
  if (v === "launch-flow") {
    return [pill(130, 260, "создать токен", C.cyan, 220), arrow(360, 279, 610, 279),
      pill(640, 260, "bonding curve", C.mint, 240), arrow(890, 279, 1140, 279),
      pill(1170, 260, "торги", C.amber, 170), rect(270, 410, 1380, 170),
      text(330, 465, "Низкий технический порог", 28, C.text, 700), text(330, 515, "не проверяет идею и не делает токен безопасным", 23, C.muted),
      text(1510, 465, "PUMP?", 44, C.risk, 700, "middle"), text(1510, 515, "активность ≠ право", 20, C.muted, 500, "middle")].join("");
  }
  if (v === "bonding-curve") {
    return [text(170, 220, "цена", 20, C.muted), line(170, 650, 1700, 650, C.muted, 2), line(170, 650, 170, 230, C.muted, 2),
      path("M190 620 C420 605 500 560 680 510 S900 390 1080 350 S1340 270 1640 235", C.mint, 7),
      path("M1640 235 C1410 310 1270 370 1090 450 S780 570 520 620 S300 635 190 640", C.risk, 4, "none", "10 14"),
      arrow(660, 510, 790, 450, C.mint), arrow(1130, 430, 1000, 490, C.risk),
      text(790, 300, "виртуальные резервы", 23, C.cyan, 700), text(1240, 690, "спрос ↑", 22, C.mint, 700), text(420, 690, "продажи ↓", 22, C.risk, 700)].join("");
  }
  if (v === "graduation") {
    return [rect(120, 270, 430, 210), text(335, 345, "BONDING", 30, C.mint, 700, "middle"), text(335, 390, "CURVE", 30, C.mint, 700, "middle"),
      arrow(570, 375, 790, 375, C.amber), circle(860, 375, 75, C.amber), text(860, 368, "порог", 22, C.bg, 700, "middle"), text(860, 398, "graduation", 16, C.bg, 700, "middle"),
      arrow(950, 375, 1170, 375, C.cyan), rect(1200, 270, 500, 210), text(1450, 345, "PUMP", 30, C.cyan, 700, "middle"), text(1450, 390, "SWAP / POOL", 30, C.cyan, 700, "middle"),
      text(960, 610, "Переход меняет механику, но не гарантирует спрос", 25, C.text, 500, "middle")].join("");
  }
  if (v === "fee-stack") {
    return [text(130, 210, "BONDING CURVE · 1,25%", 25, C.text, 700),
      rect(150, 280, 300, 90, C.mint, "none", 0), rect(450, 280, 950, 90, C.cyan, "none", 0),
      text(300, 338, "создатель · 0,30%", 21, C.bg, 700, "middle"), text(925, 338, "протокол · 0,95%", 27, C.bg, 700, "middle"),
      rect(150, 410, 1250, 92, "none", C.muted, 10), text(775, 466, "пул · 0%", 25, C.muted, 700, "middle"),
      rect(1480, 280, 280, 270, C.panel2), text(1620, 340, "PUMP", 30, C.amber, 700, "middle"), text(1620, 390, "не равно", 22, C.muted, 500, "middle"), text(1620, 445, "выплата", 30, C.risk, 700, "middle"), text(1620, 495, "держателю", 22, C.muted, 500, "middle")].join("");
  }
  if (v === "fees-metric") {
    return [rect(120, 215, 750, 390), text(170, 280, "DEFI LLAMA · 30 ДНЕЙ", 19, C.muted, 700), text(170, 420, "$45,98 млн", 76, C.mint, 700), text(170, 475, "комиссий", 30, C.text, 700),
      rect(980, 215, 700, 390, C.panel2), dotLabel(1040, 310, "комиссии", C.cyan), dotLabel(1040, 390, "чистая прибыль", C.amber), dotLabel(1040, 470, "выплата PUMP", C.risk),
      text(1040, 550, "не одно и то же", 25, C.text, 700)].join("");
  }
  if (v === "token-rights") {
    return [rect(220, 180, 1050, 450, C.panel2), line(220, 250, 1270, 250, C.grid, 2), text(280, 225, "УСЛОВИЯ ТОКЕНА / ОТКРЫТЫЙ ДОКУМЕНТ", 17, C.muted, 700),
      dotLabel(290, 335, "нет доли компании", C.risk), dotLabel(290, 415, "нет дивидендов", C.risk), dotLabel(290, 495, "нет права на выручку", C.risk),
      arrow(1340, 380, 1530, 380, C.amber), text(1630, 350, "бизнес", 26, C.cyan, 700, "middle"), text(1630, 410, "≠", 48, C.risk, 700, "middle"), text(1630, 470, "права токена", 26, C.amber, 700, "middle")].join("");
  }
  if (v === "buyback-flow") {
    return [rect(130, 260, 370, 170), text(315, 335, "чистая выручка", 24, C.text, 700, "middle"), arrow(530, 345, 780, 345, C.mint),
      circle(870, 345, 100, C.mint), text(870, 336, "≈ 50%", 30, C.bg, 700, "middle"), text(870, 375, "план", 18, C.bg, 700, "middle"),
      arrow(980, 345, 1210, 345, C.cyan), rect(1250, 260, 450, 170, C.panel2), text(1475, 330, "купить PUMP", 26, C.cyan, 700, "middle"), text(1475, 380, "→ сжечь", 26, C.risk, 700, "middle"),
      text(960, 570, "ограниченная годовая программа · не постоянная доходность", 23, C.muted, 500, "middle")].join("");
  }
  if (v === "project-buyback-stats") {
    return [card(120, 220, 510, 280, "ВЫКУПЫ", "$468,53 млн", C.mint), card(705, 220, 510, 280, "СОЖЖЕНО", "168,91 млрд PUMP", C.risk), card(1290, 220, 510, 280, "ДОЛЯ SUPPLY", "16,9%", C.amber),
      text(960, 650, "Опубликовано проектом · не независимый аудит", 24, C.muted, 500, "middle")].join("");
  }
  if (v === "methodology") {
    return [rect(120, 220, 690, 350), text(170, 280, "ПАНЕЛЬ ПРОЕКТА", 23, C.cyan, 700), dotLabel(180, 360, "свои категории", C.cyan), dotLabel(180, 430, "custom pairs неполны", C.risk),
      rect(1110, 220, 690, 350), text(1160, 280, "DEFILLAMA", 23, C.mint, 700), dotLabel(1170, 360, "своя методика", C.mint), dotLabel(1170, 430, "другие потоки", C.amber),
      text(960, 680, "≠  складывать без поправки нельзя", 30, C.risk, 700, "middle")].join("");
  }
  if (v === "max-supply") {
    return [text(960, 260, "1 000 млрд PUMP", 72, C.text, 700, "middle"), rect(260, 350, 1120, 100, C.cyan), rect(260, 350, 370, 100, C.amber), text(445, 414, "33% · ICO", 28, C.bg, 700, "middle"), text(900, 414, "67% · другие категории", 25, C.bg, 700, "middle"), pill(1370, 610, "частичный filing · 8 пробелов", C.risk, 350)].join("");
  }
  if (v === "allocation") {
    const parts = [
      { n: "ICO", p: 33, c: C.amber }, { n: "сообщество", p: 24, c: C.cyan },
      { n: "команда", p: 20, c: C.mint }, { n: "существующие инвесторы", p: 13, c: C.risk },
      { n: "livestream incentives", p: 3, c: "#A48BDE" }, { n: "ликвидность / биржи", p: 2.6, c: "#6FB6D2" },
      { n: "фонд экосистемы", p: 2.4, c: "#D69AD4" }, { n: "фонд проекта", p: 2, c: "#B7C67B" },
    ];
    let x = 130; const barWidth = 1600; const out = [text(130, 225, "ЗАЯВЛЕННОЕ РАСПРЕДЕЛЕНИЕ · 100%", 21, C.muted, 700)];
    for (const part of parts) {
      const width = barWidth * part.p / 100;
      out.push(rect(x, 285, width, 100, part.c, "none", 0));
      if (width >= 100) out.push(text(x + width / 2, 344, `${part.p}%`, 17, C.bg, 700, "middle"));
      x += width;
    }
    const legendY = [455, 520];
    parts.forEach((part, index) => {
      const col = index % 4;
      const row = Math.floor(index / 4);
      const lx = 130 + col * 430;
      out.push(rect(lx, legendY[row] - 16, 16, 16, part.c, "none", 3), text(lx + 28, legendY[row], `${part.n} ${part.p}%`, 17, C.text));
    });
    out.push(text(960, 650, "Категория ≠ фактический получатель или текущая продажа", 25, C.muted, 500, "middle")); return out.join("");
  }
  if (v === "circulating-supply") {
    return [text(140, 230, "циркулирует", 22, C.muted), rect(140, 280, 1160, 85, C.cyan), text(1320, 338, "399,46 млрд", 29, C.cyan, 700),
      rect(140, 430, 1350, 85, C.mint), text(1510, 488, "465,32 млрд", 29, C.mint, 700), text(140, 405, "Pump.fun", 20, C.cyan, 700), text(140, 555, "CoinGecko", 20, C.mint, 700),
      rect(1450, 180, 320, 390, C.panel2), text(1610, 270, "UNLOCKED", 22, C.amber, 700, "middle"), text(1610, 350, "≠", 54, C.risk, 700, "middle"), text(1610, 440, "CIRCULATING", 22, C.cyan, 700, "middle")].join("");
  }
  if (v === "market-snapshot") {
    return [pill(140, 190, "30.09.2026 · 13:53 UTC", C.cyan, 300), card(140, 290, 500, 250, "ЦЕНА", "$0,0057", C.mint), card(710, 290, 500, 250, "СУТОЧНЫЙ ОБЪЁМ", "$417,7 млн", C.cyan), card(1280, 290, 500, 250, "ИЗМЕНЕНИЕ", ["+35% · 7 дней", "+31% · 30 дней"], C.amber), text(960, 660, "Снимок прошлого · не прогноз", 27, C.muted, 500, "middle")].join("");
  }
  if (v === "market-cap-formula") {
    return [text(960, 260, "КАПИТАЛИЗАЦИЯ = ЦЕНА × ПРЕДЛОЖЕНИЕ", 38, C.text, 700, "middle"), card(170, 350, 680, 190, "Pump.fun", "399,46 млрд в обращении", C.cyan), card(1070, 350, 680, 190, "CoinGecko", "465,32 млрд в обращении", C.mint), text(960, 650, "разные знаменатели → спорное сравнение", 28, C.risk, 700, "middle")].join("");
  }
  if (v === "competition") {
    return [rect(150, 250, 610, 230, C.panel2), text(455, 350, "Pump.fun", 42, C.cyan, 700, "middle"), text(455, 410, "запуски токенов", 23, C.muted, 500, "middle"),
      rect(1160, 250, 610, 230, C.panel2), text(1465, 350, "Raydium", 42, C.mint, 700, "middle"), text(1465, 410, "LaunchLab", 27, C.mint, 700, "middle"), line(760, 365, 1160, 365, C.amber, 3, "12 12"), text(960, 600, "конкуренция есть · рейтинг не установлен", 27, C.muted, 500, "middle")].join("");
  }
  if (v === "legal-status") {
    return [pill(160, 190, "31.08.2026", C.amber, 200), rect(160, 290, 1600, 170, C.panel2), text(230, 355, "RICO", 48, C.risk, 700), text(480, 350, "требования допущены к дальнейшему рассмотрению", 29, C.text, 600), text(480, 405, "сообщение юристов истцов · процесс незавершён", 22, C.muted), line(350, 560, 1570, 560, C.risk, 3, "10 12"), text(960, 635, "допуск ≠ решение по существу ≠ доказательство обвинений", 26, C.risk, 700, "middle")].join("");
  }
  if (v === "risk-map") {
    return [circle(960, 400, 125, C.panel2, C.cyan, 4), text(960, 392, "PUMP", 36, C.cyan, 700, "middle"), text(960, 430, "вопросы", 20, C.muted, 500, "middle"),
      line(960, 275, 960, 190, C.amber, 3), line(835, 400, 650, 300, C.mint, 3), line(1085, 400, 1270, 300, C.risk, 3), line(835, 465, 650, 560, C.cyan, 3), line(1085, 465, 1270, 560, C.amber, 3),
      text(960, 175, "операции", 23, C.amber, 700, "middle"), text(600, 285, "рынок", 23, C.mint, 700, "middle"), text(1320, 285, "суд", 23, C.risk, 700, "middle"), text(590, 590, "предложение", 23, C.cyan, 700, "middle"), text(1340, 590, "конкуренция", 23, C.amber, 700, "middle")].join("");
  }
  if (v === "scenarios") {
    return [card(110, 220, 530, 300, "СИЛЬНЫЙ", ["пользователи ·", "проверенные комиссии"], C.mint), card(695, 220, 530, 300, "НЕЙТРАЛЬНЫЙ", ["цикличность ·", "связь косвенная"], C.amber), card(1280, 220, 530, 300, "СЛАБЫЙ", ["оборот ниже ·", "неясность сохраняется"], C.risk), text(960, 650, "рамка проверки · не прогноз", 29, C.muted, 700, "middle")].join("");
  }
  if (v === "closing-checklist") {
    return [text(140, 220, "ЧТО ОТСЛЕЖИВАТЬ", 25, C.muted, 700), dotLabel(180, 315, "комиссии и методика", C.cyan), dotLabel(180, 385, "фактические выкупы", C.mint), dotLabel(180, 455, "циркулирующее предложение", C.amber), dotLabel(180, 525, "конкуренция и судебный процесс", C.risk),
      rect(1110, 220, 620, 350, C.panel2), text(1420, 325, "АКТИВНОСТЬ", 24, C.cyan, 700, "middle"), text(1420, 385, "+", 44, C.mint, 700, "middle"), text(1420, 445, "ПРАВО НА ДОХОД", 24, C.risk, 700, "middle"), text(1420, 505, "не следует автоматически", 19, C.muted, 500, "middle")].join("");
  }
  return `${rect(150, 220, 1620, 360)}${text(960, 400, scene.description, 28, C.text, 500, "middle")}`;
}

export function renderPumpFilmSceneSvg(
  scene: PumpFilmScene,
  sourceLabel: string,
  sceneCount: number,
): string {
  return base(scene, sourceLabel, sceneCount, graphic(scene));
}