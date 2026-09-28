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
  return "выход по времени";
}

export function formatTechnicalAnalysisRange(
  snapshot: Pick<TechnicalAnalysisSnapshot, "rangeStartTime" | "rangeEndTime">,
  includeTime = true,
): string {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: includeTime ? "long" : "short",
    year: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "UTC",
  });
  return `с ${formatter.format(new Date(snapshot.rangeStartTime))} по ${formatter.format(new Date(snapshot.rangeEndTime))} UTC`;
}

export function createTechnicalAnalysisPlan(
  topic: string,
  snapshot: TechnicalAnalysisSnapshot,
): FinancialTopicPlan {
  if (!Number.isFinite(snapshot.pnlUsd) || snapshot.pnlUsd <= 0) {
    throw new Error("Для «ТехАнализа» недоступен расчётный результат.");
  }
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
  }).format(new Date(snapshot.signalTime)).replace(/\sг\.$/u, "");
  const chartRange = formatTechnicalAnalysisRange(snapshot);
  const shortPosition = snapshot.direction === "short";
  const technicalAnalysisCta =
    "Если хотите зарегистрироваться на Bybit, отсканируйте QR-код или введите код BPJLZJ. Условия акции и ссылка для регистрации — в описании.";
  const voice = [
    `Привет, друзья! Сегодня разберём исторический сигнал по ${baseSymbol}: что произошло после него? График взят из диапазона ${chartRange}. Перед нами четырёхчасовые свечи Binance Spot, а сам сигнал появился ${signalDate}. Сначала зафиксируем только то, что было видно в этот момент, и лишь потом откроем следующие свечи.`,
    `Итак, на видимой части графика сформировался паттерн — ${snapshot.pattern.label}. Его условный сценарий направлен ${snapshot.direction === "long" ? "вверх, это лонг" : "вниз, это шорт"}. Важно: паттерн здесь — техническая гипотеза, а не обещание движения. Если это структура Эллиотта, мы называем её эвристикой, потому что такая разметка не является гарантией.`,
    shortPosition
      ? `Теперь переведём уровни в понятный пример: моделируем условную короткую позицию номиналом на тысячу долларов. По цене входа это ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(snapshot.quantity)} ${baseSymbol}. Результат считаем от обратного движения цены по тем же спотовым свечам; фактическую маржинальную или фьючерсную сделку не моделируем. Стоп — ${stopValue}, тейк — ${targetValue}; расчётный риск до стопа — около ${usd(riskUsd)}.`
      : `Теперь переведём уровни в понятный пример: моделируем покупку актива на тысячу долларов без плеча. Цена входа — ${entryValue}, поэтому условный объём составил бы ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(snapshot.quantity)} ${baseSymbol}. Стоп — ${stopValue}, тейк — ${targetValue}. То есть до стопа мы заранее видим риск около ${usd(riskUsd)}; это оценка до комиссий и проскальзывания.`,
    snapshot.outcome === "target"
      ? `Теперь открываем продолжение графика. После сигнальной свечи цена в этом историческом примере достигла тейк-профита. Уровни входа, стопа и тейка были рассчитаны только по свечам, доступным на момент сигнала — мы не подгоняем их задним числом.`
      : `Теперь открываем продолжение графика. За следующие двенадцать четырёхчасовых свечей ни стоп, ни тейк не сработали. Поэтому для расчёта закрываем условную позицию по цене последней свечи — ${exitValue}; это выход по времени, а не срабатывание одного из уровней.`,
    snapshot.outcome === "target"
      ? `Что это означает в деньгах? При условной позиции на тысячу долларов валовый результат по тейку составил бы плюс ${pnlWords}. Это расчёт по историческим уровням, до комиссий и проскальзывания, а не отчёт о фактической сделке.`
      : `Что это означает в деньгах? Без достижения тейка расчётный валовый результат к выходу составил бы плюс ${pnlWords}. Комиссии и проскальзывание не учтены, а сам результат относится только к этому историческому окну.`,
    "Итог простой: это исторический учебный пример, который помогает разобрать механику уровней, но не инвестиционная рекомендация и не прогноз будущего результата.",
    technicalAnalysisCta,
  ];
  const beats: FinancialShortBeat[] = [
    {
      id: "ta-signal",
      from: 0,
      to: 1 / 7,
      visual: "market",
      title: "ИСТОРИЧЕСКИЙ СИГНАЛ",
      subtitle: `График ${formatTechnicalAnalysisRange(snapshot, false)} • сигнал ${signalDate}`,
      voiceText: voice[0],
      cameraAction: "locked",
    },
    {
      id: "ta-pattern",
      from: 1 / 7,
      to: 2 / 7,
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
      from: 2 / 7,
      to: 3 / 7,
      visual: "market",
      title: "ВХОД • СТОП • ТЕЙК",
      subtitle: `Условная позиция ${usd(snapshot.notionalUsd)} • риск ${snapshot.riskPercent.toFixed(2)}%`,
      voiceText: voice[2],
      cameraAction: "locked",
    },
    {
      id: "ta-reveal",
      from: 3 / 7,
      to: 4 / 7,
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
      from: 4 / 7,
      to: 5 / 7,
      visual: "summary",
      title: `РЕЗУЛЬТАТ • ${outcomeName(snapshot).toLocaleUpperCase("ru-RU")}`,
      subtitle: `Условный валовый итог: +${usd(snapshot.pnlUsd)}`,
      voiceText: voice[4],
      cameraAction: "locked",
      soundEffect: snapshot.pnlUsd > 0 ? "money_ding" : "none",
    },
    {
      id: "ta-disclaimer",
      from: 5 / 7,
      to: 6 / 7,
      visual: "summary",
      title: "НЕ ИНВЕСТИЦИОННАЯ РЕКОМЕНДАЦИЯ",
      subtitle: "Исторический учебный пример • без комиссий и проскальзывания",
      voiceText: voice[5],
      cameraAction: "locked",
      soundEffect: "none",
    },
    {
      id: "ta-cta",
      from: 6 / 7,
      to: 1,
      visual: "summary",
      title: "ПРИСОЕДИНЯЙТЕСЬ К BYBIT",
      subtitle: "QR-код • код BPJLZJ",
      voiceText: voice[6],
      isCta: true,
      cameraAction: "locked",
      soundEffect: "none",
    },
  ];

  return {
    topic: `${baseSymbol} — ${snapshot.pattern.label}`,
    cta: technicalAnalysisCta,
    scriptSource: "market_data",
    title: `${baseSymbol}: ${snapshot.pattern.label} — исторический разбор`,
    mainTitle: `${snapshot.pair} • ${snapshot.pattern.label}`.toLocaleUpperCase("ru-RU").slice(0, 54),
    script: voice.join(" "),
    targetDurationMs: 70_000,
    visualConcept: "generic_finance",
    beats,
    background: "grid",
    visualTheme: "technical_analysis",
    technicalAnalysisData: snapshot,
    hook: voice[0],
    description: `Исторический пример технического анализа ${baseSymbol} по 4-часовым свечам Binance Spot за диапазон ${chartRange}. Условная модель позиции $1 000, без учёта комиссий и проскальзывания.`,
    objects: [],
    backgroundLabel: "Тёмный свечной график",
    brandStyleLabel: "ТехАнализ — график за последние 7 дней, уровни до раскрытия результата",
    visualMediaNotice: "Исторические свечи Binance Spot; будущие свечи раскрываются после показа условий.",
    visualMediaCredits: [],
  };
}