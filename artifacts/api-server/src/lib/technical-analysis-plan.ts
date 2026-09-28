import type { FinancialShortBeat } from "./financial-short-renderer";
import type { FinancialTopicPlan } from "./financial-topic-engine";
import type { TechnicalAnalysisSnapshot } from "./technical-analysis-data";

function usd(value: number): string {
  return `$${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
}

function roundedUsdWords(value: number): string {
  const amount = Math.round(Math.abs(value) * 100) / 100;
  const dollars = Math.floor(amount);
  const cents = Math.round((amount - dollars) * 100);
  return `${dollars} ${dollars === 1 ? "доллар" : "долларов"}${cents ? ` ${cents} центов` : ""}`;
}

function outcomeName(snapshot: TechnicalAnalysisSnapshot): string {
  if (snapshot.outcome === "target") return "тейк-профит";
  if (snapshot.outcome === "stop") return "стоп";
  return "выход по времени";
}

export function createTechnicalAnalysisPlan(
  topic: string,
  snapshot: TechnicalAnalysisSnapshot,
): FinancialTopicPlan {
  const baseSymbol = snapshot.pair.replace(/USDT$/u, "");
  const entryValue = usd(snapshot.entry);
  const stopValue = usd(snapshot.stop);
  const targetValue = usd(snapshot.target);
  const exitValue = usd(snapshot.exit);
  const riskUsd = snapshot.notionalUsd * snapshot.riskPercent / 100;
  const pnlWords = roundedUsdWords(snapshot.pnlUsd);
  const signalDate = new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(snapshot.signalTime));
  const voice = [
    `Исторический технический разбор ${baseSymbol} по четырёхчасовым свечам Binance Spot. Сигнал был ${signalDate}. Сначала зафиксируем условия, затем покажем следующие свечи.`,
    `На графике сформировался паттерн: ${snapshot.pattern.label}. Направление условного сценария — ${snapshot.direction === "long" ? "вверх, лонг" : "вниз, шорт"}. Это техническая гипотеза; структура Эллиотта отмечается как эвристика.`,
    `Моделируем вход на тысячу долларов без плеча. Цена входа — ${entryValue}; условный объём — ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(snapshot.quantity)} ${baseSymbol}. Стоп — ${stopValue}, тейк — ${targetValue}. Риск до стопа — около ${usd(riskUsd)}, до комиссий и проскальзывания.`,
    snapshot.outcome === "target"
      ? `После сигнальной свечи цена в этом историческом примере достигла тейк-профита. Уровни входа, стопа и тейка были рассчитаны по свечам, доступным на момент сигнала.`
      : snapshot.outcome === "stop"
        ? `После сигнальной свечи сначала был бы достигнут стоп, а не тейк. Здесь показаны все следующие свечи до срабатывания уровня.`
        : `За следующие тридцать шесть свечей ни стоп, ни тейк не сработали. Для расчёта закрываем условную позицию по цене последней свечи: ${exitValue}.`,
    snapshot.outcome === "target"
      ? `При условной позиции на тысячу долларов валовый результат по тейку составил бы плюс ${pnlWords}. Это расчёт до комиссий и проскальзывания, а не фактическая сделка.`
      : snapshot.outcome === "stop"
        ? `По стопу условный валовый результат составил бы минус ${pnlWords}. Сумма входа — тысяча долларов; комиссии и проскальзывание не учтены.`
        : `Без достижения тейка расчётный валовый результат к выходу составил бы ${snapshot.pnlUsd >= 0 ? "плюс" : "минус"} ${pnlWords}. Тейк не был достигнут; комиссии и проскальзывание не учтены.`,
    "Это исторический учебный пример, не инвестиционная рекомендация.",
  ];
  const beats: FinancialShortBeat[] = [
    {
      id: "ta-signal",
      from: 0,
      to: 1 / 6,
      visual: "market",
      title: "ИСТОРИЧЕСКИЙ СИГНАЛ",
      subtitle: `${snapshot.pair} • 4 часа • ${signalDate}`,
      voiceText: voice[0],
      cameraAction: "locked",
    },
    {
      id: "ta-pattern",
      from: 1 / 6,
      to: 2 / 6,
      visual: "market",
      title: snapshot.pattern.label.toLocaleUpperCase("ru-RU"),
      subtitle: snapshot.pattern.type === "elliott_wave_1_4"
        ? "Волновая нумерация — техническая эвристика"
        : "Паттерн — сценарий, а не гарантия движения",
      voiceText: voice[1],
      cameraAction: "locked",
    },
    {
      id: "ta-levels",
      from: 2 / 6,
      to: 3 / 6,
      visual: "market",
      title: "ВХОД • СТОП • ТЕЙК",
      subtitle: `Условная позиция ${usd(snapshot.notionalUsd)} • риск ${snapshot.riskPercent.toFixed(2)}%`,
      voiceText: voice[2],
      cameraAction: "locked",
    },
    {
      id: "ta-reveal",
      from: 3 / 6,
      to: 4 / 6,
      visual: "market",
      title: "ДАЛЬШЕ ПОСЛЕ СИГНАЛА",
      subtitle: snapshot.outcome === "target"
        ? "В этом историческом примере тейк был достигнут"
        : snapshot.outcome === "stop"
          ? "В этом историческом примере сработал стоп"
          : "Ни стоп, ни тейк не сработали за горизонт",
      voiceText: voice[3],
      cameraAction: "locked",
    },
    {
      id: "ta-pnl",
      from: 4 / 6,
      to: 5 / 6,
      visual: snapshot.pnlUsd >= 0 ? "summary" : "risk",
      title: `РЕЗУЛЬТАТ • ${outcomeName(snapshot).toLocaleUpperCase("ru-RU")}`,
      subtitle: `Условный валовый итог: ${snapshot.pnlUsd >= 0 ? "+" : "−"}${usd(Math.abs(snapshot.pnlUsd))}`,
      voiceText: voice[4],
      cameraAction: "locked",
      soundEffect: snapshot.outcome === "target" ? "money_ding" : "none",
    },
    {
      id: "ta-disclaimer",
      from: 5 / 6,
      to: 1,
      visual: "summary",
      title: "НЕ ИНВЕСТИЦИОННАЯ РЕКОМЕНДАЦИЯ",
      subtitle: "Исторический учебный пример • без комиссий и проскальзывания",
      voiceText: voice[5],
      cameraAction: "locked",
      soundEffect: "none",
    },
  ];

  return {
    topic: `${baseSymbol} — ${snapshot.pattern.label}`,
    cta: "",
    scriptSource: "market_data",
    title: `${baseSymbol}: ${snapshot.pattern.label} — исторический разбор`,
    mainTitle: `${snapshot.pair} • ${snapshot.pattern.label}`.toLocaleUpperCase("ru-RU").slice(0, 54),
    script: voice.join(" "),
    targetDurationMs: 60_000,
    visualConcept: "generic_finance",
    beats,
    background: "grid",
    visualTheme: "technical_analysis",
    technicalAnalysisData: snapshot,
    hook: `${baseSymbol} • ${snapshot.pattern.label}`,
    description: `Исторический пример технического анализа ${baseSymbol} по 4-часовым свечам Binance Spot. Условная модель позиции $1 000, без учёта комиссий и проскальзывания.`,
    objects: [],
    backgroundLabel: "Тёмный свечной график",
    brandStyleLabel: "ТехАнализ — исторический replay с уровнями до раскрытия результата",
    visualMediaNotice: "Исторические свечи Binance Spot; будущие свечи раскрываются после показа условий.",
    visualMediaCredits: [],
  };
}