const BINANCE_API = "https://api.binance.com";
const INTERVAL = "4h";
const INTERVAL_MS = 4 * 60 * 60 * 1_000;
const OUTCOME_HORIZON = 36;
const NOTIONAL = 1_000;

export type TechnicalAnalysisCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  quoteVolume?: number;
};

export type TechnicalAnalysisPatternType =
  | "ascending_triangle" | "descending_triangle" | "symmetric_triangle"
  | "bull_pennant" | "bear_pennant" | "elliott_wave_1_4" | "range_breakout";

export type TechnicalAnalysisCandidate = {
  signalIndex: number;
  direction: "long" | "short";
  pattern: { type: TechnicalAnalysisPatternType; label: string };
  entry: number;
  stop: number;
  target: number;
  riskPercent: number;
  setupStartIndex: number;
  waveAnnotations?: Array<{ wave: "1" | "2" | "3" | "4"; index: number; price: number }>;
};

export type TechnicalAnalysisOutcome = "target" | "stop" | "time_exit";

export type TechnicalAnalysisSimulation = {
  future: TechnicalAnalysisCandle[];
  outcome: TechnicalAnalysisOutcome;
  exit: number;
  bars: number;
  pnlUsd: number;
};

export type TechnicalAnalysisSnapshot = {
  source: "Binance Spot";
  pair: string;
  timeframe: "4h";
  retrievedAt: string;
  signalTime: string;
  direction: "long" | "short";
  pattern: { type: TechnicalAnalysisPatternType; label: string };
  entry: number;
  stop: number;
  target: number;
  riskPercent: number;
  quantity: number;
  notionalUsd: 1_000;
  outcome: TechnicalAnalysisOutcome;
  exit: number;
  pnlUsd: number;
  bars: number;
  setupCandles: TechnicalAnalysisCandle[];
  futureCandles: TechnicalAnalysisCandle[];
  waveAnnotations?: Array<{ wave: "1" | "2" | "3" | "4"; index: number; price: number }>;
};

export type TechnicalAnalysisRequest =
  | { mode: "auto" }
  | { mode: "manual"; symbol: string };

export type TechnicalAnalysisOptions = {
  fetcher?: typeof fetch;
  random?: () => number;
  now?: () => number;
  signalIndex?: number;
  excludedCaseKeys?: Iterable<string>;
};

const STABLES = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "DAI", "USDE", "USDP", "USD1"]);
const LEVERAGED = /(?:UP|DOWN|BULL|BEAR|[235]L|[235]S)$/;

function finite(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("Binance Spot вернул некорректное значение свечи.");
  return n;
}

function normalizePair(input: string): { symbol: string; pair: string } {
  const value = input.trim().replace(/^\$/, "").replace(/[\/\-\s]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{2,20}$/.test(value)) throw new Error("Введите тикер монеты, например BTC или BTCUSDT.");
  const pair = value.endsWith("USDT") ? value : `${value}USDT`;
  const symbol = pair.slice(0, -4);
  if (!symbol || STABLES.has(symbol) || LEVERAGED.test(symbol)) {
    throw new Error(`Пара ${pair} исключена из технического анализа.`);
  }
  return { symbol, pair };
}

function range(candles: TechnicalAnalysisCandle[]): { high: number; low: number } {
  return { high: Math.max(...candles.map((c) => c.high)), low: Math.min(...candles.map((c) => c.low)) };
}

function near(a: number, b: number, tolerance = 0.012): boolean {
  return Math.abs(a - b) / Math.max(Math.abs(b), 1e-12) <= tolerance;
}

function candidate(
  candles: TechnicalAnalysisCandle[],
  signalIndex: number,
  type: TechnicalAnalysisPatternType,
  direction: "long" | "short",
  setupStartIndex: number,
  waveAnnotations?: TechnicalAnalysisCandidate["waveAnnotations"],
): TechnicalAnalysisCandidate {
  const signal = candles[signalIndex]!;
  const setup = candles.slice(setupStartIndex, signalIndex);
  const box = range(setup.length ? setup : [signal]);
  const entry = signal.close;
  const stop = direction === "long" ? Math.min(box.low, signal.low) : Math.max(box.high, signal.high);
  const risk = Math.max(entry * 0.003, Math.abs(entry - stop));
  const actualStop = direction === "long" ? entry - risk : entry + risk;
  const target = direction === "long" ? entry + risk * 2 : entry - risk * 2;
  const labels: Record<TechnicalAnalysisPatternType, string> = {
    ascending_triangle: "Восходящий треугольник",
    descending_triangle: "Нисходящий треугольник",
    symmetric_triangle: "Симметричный треугольник",
    bull_pennant: "Бычий вымпел",
    bear_pennant: "Медвежий вымпел",
    elliott_wave_1_4: "Волны Эллиота 1–4 (эвристика, не подтверждённая волна)",
    range_breakout: "Пробой диапазона",
  };
  return {
    signalIndex, direction, pattern: { type, label: labels[type] }, entry,
    stop: actualStop, target, riskPercent: risk / entry * 100, setupStartIndex,
    ...(waveAnnotations ? { waveAnnotations } : {}),
  };
}

/** Detects only structures visible at each signal candle; later candles are never read. */
export function findTechnicalAnalysisCandidates(candles: TechnicalAnalysisCandle[]): TechnicalAnalysisCandidate[] {
  const result: TechnicalAnalysisCandidate[] = [];
  for (let i = 24; i < candles.length; i += 1) {
    const before = candles.slice(i - 20, i);
    const signal = candles[i]!;
    const first = before.slice(0, 10), second = before.slice(10);
    const a = range(first), b = range(second);
    const highs = before.map((c) => c.high), lows = before.map((c) => c.low);
    const upperConverges = a.high > b.high && a.high - b.high > signal.close * 0.003;
    const lowerConverges = a.low < b.low && b.low - a.low > signal.close * 0.003;
    const breakoutUp = signal.close > b.high;
    const breakoutDown = signal.close < b.low;
    const body = Math.abs(signal.close - signal.open);
    const impulse = body > signal.close * 0.008;
    const poleMove = first.at(-1)!.close - first[0]!.open;
    const pole = Math.abs(poleMove) > signal.close * 0.018
      && first.some((c) => Math.abs(c.close - c.open) > c.close * 0.008);
    let found = false;
    const pennantCompression = b.high - b.low < (a.high - a.low) * 0.72;
    if (poleMove > 0 && pole && pennantCompression && breakoutUp && impulse) {
      result.push(candidate(candles, i, "bull_pennant", "long", i - 20)); found = true;
    } else if (poleMove < 0 && pole && pennantCompression && breakoutDown && impulse) {
      result.push(candidate(candles, i, "bear_pennant", "short", i - 20)); found = true;
    } else if (breakoutUp && lowerConverges && near(a.high, b.high, 0.025)) {
      result.push(candidate(candles, i, "ascending_triangle", "long", i - 20)); found = true;
    } else if (breakoutDown && upperConverges && near(a.low, b.low, 0.025)) {
      result.push(candidate(candles, i, "descending_triangle", "short", i - 20)); found = true;
    } else if (breakoutUp && upperConverges && lowerConverges) {
      result.push(candidate(candles, i, "symmetric_triangle", "long", i - 20)); found = true;
    } else if (breakoutDown && upperConverges && lowerConverges) {
      result.push(candidate(candles, i, "symmetric_triangle", "short", i - 20)); found = true;
    }
    if (i >= 12) {
      const history = candles.slice(Math.max(0, i - 30), i);
      const pivots: Array<{ index: number; price: number; kind: "high" | "low" }> = [];
      for (let n = 1; n < history.length - 1; n += 1) {
        const current = history[n]!, previous = history[n - 1]!, next = history[n + 1]!;
        if (current.high > previous.high && current.high >= next.high) {
          pivots.push({ index: i - history.length + n, price: current.high, kind: "high" });
        } else if (current.low < previous.low && current.low <= next.low) {
          pivots.push({ index: i - history.length + n, price: current.low, kind: "low" });
        }
      }
      const sequence = pivots.slice(-4);
      const p1 = sequence[0], p2 = sequence[1], p3 = sequence[2], p4 = sequence[3];
      const bullish = sequence.length === 4 && p1!.kind === "high" && p2!.kind === "low"
        && p3!.kind === "high" && p4!.kind === "low"
        && p3!.price > p1!.price && p4!.price > p2!.price && signal.close > p3!.price;
      const bearish = sequence.length === 4 && p1!.kind === "low" && p2!.kind === "high"
        && p3!.kind === "low" && p4!.kind === "high"
        && p3!.price < p1!.price && p4!.price < p2!.price && signal.close < p3!.price;
      if (bullish || bearish) {
        result.push(candidate(candles, i, "elliott_wave_1_4", bullish ? "long" : "short", Math.max(0, p1!.index - 1),
          [p1!, p2!, p3!, p4!].map((p, n) => ({
            wave: String(n + 1) as "1" | "2" | "3" | "4", index: p.index, price: p.price,
          }))));
        found = true;
      }
    }
    if (!found && (breakoutUp || breakoutDown)) {
      result.push(candidate(candles, i, "range_breakout", breakoutUp ? "long" : "short", i - 20));
    }
  }
  return result;
}

export function simulateTechnicalAnalysisOutcome(
  candidateValue: TechnicalAnalysisCandidate,
  candles: TechnicalAnalysisCandle[],
  horizon = OUTCOME_HORIZON,
): TechnicalAnalysisSimulation {
  const future = candles.slice(candidateValue.signalIndex + 1, candidateValue.signalIndex + 1 + horizon);
  let outcome: TechnicalAnalysisOutcome = "time_exit", exit = future.at(-1)?.close ?? candidateValue.entry, bars = future.length;
  for (let i = 0; i < future.length; i += 1) {
    const c = future[i]!;
    const stop = candidateValue.direction === "long" ? c.low <= candidateValue.stop : c.high >= candidateValue.stop;
    const target = candidateValue.direction === "long" ? c.high >= candidateValue.target : c.low <= candidateValue.target;
    if (stop || target) {
      outcome = stop ? "stop" : "target";
      exit = stop ? candidateValue.stop : candidateValue.target;
      bars = i + 1;
      break;
    }
  }
  const pnlUsd = NOTIONAL * ((exit - candidateValue.entry) / candidateValue.entry) * (candidateValue.direction === "long" ? 1 : -1);
  return { future: outcome === "time_exit" ? future : future.slice(0, bars), outcome, exit, bars, pnlUsd };
}

export function chooseTechnicalAnalysisCandidate<T extends {
  pair: string;
  candidate: TechnicalAnalysisCandidate;
}>(
  candidates: T[],
  excludedCaseKeys: Iterable<string>,
  random: () => number = Math.random,
): T {
  if (!candidates.length) throw new Error("Нет доступных технических setup-кандидатов.");
  const excluded = new Set(excludedCaseKeys);
  const preferred = candidates.filter((item) => !excluded.has(`${item.pair}:${item.candidate.pattern.type}`));
  const pool = preferred.length ? preferred : candidates;
  const position = Math.max(0, Math.min(pool.length - 1, Math.floor(random() * pool.length)));
  return pool[position]!;
}

export function createTechnicalAnalysisSnapshot(
  symbol: string,
  candles: TechnicalAnalysisCandle[],
  options: Pick<TechnicalAnalysisOptions, "now" | "signalIndex"> = {},
): TechnicalAnalysisSnapshot {
  if (candles.length < 25) throw new Error("Недостаточно исторических 4h-свечей для технического анализа.");
  const pair = normalizePair(symbol).pair;
  const candidates = findTechnicalAnalysisCandidates(candles);
  const eligible = candidates.filter((c) => c.signalIndex + 1 + OUTCOME_HORIZON <= candles.length);
  const wanted = options.signalIndex === undefined ? eligible.at(-1) : eligible.find((c) => c.signalIndex === options.signalIndex);
  if (!wanted) throw new Error("Для пары не найден исторический технический setup с будущими свечами.");
  const simulated = simulateTechnicalAnalysisOutcome(wanted, candles);
  const signal = candles[wanted.signalIndex]!;
  return {
    source: "Binance Spot", pair, timeframe: "4h",
    retrievedAt: new Date(options.now?.() ?? Date.now()).toISOString(),
    signalTime: new Date(signal.closeTime).toISOString(), direction: wanted.direction,
    pattern: wanted.pattern, entry: wanted.entry, stop: wanted.stop, target: wanted.target,
    riskPercent: wanted.riskPercent, quantity: NOTIONAL / wanted.entry, notionalUsd: 1_000,
    outcome: simulated.outcome, exit: simulated.exit, pnlUsd: simulated.pnlUsd, bars: simulated.bars,
    setupCandles: candles.slice(wanted.setupStartIndex, wanted.signalIndex + 1),
    futureCandles: simulated.future,
    ...(wanted.waveAnnotations
      ? {
          waveAnnotations: wanted.waveAnnotations.map((annotation) => ({
            ...annotation,
            index: annotation.index - wanted.setupStartIndex,
          })),
        }
      : {}),
  };
}

type BinanceFetcher = typeof fetch;
async function json<T>(fetcher: BinanceFetcher, url: string): Promise<T> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Binance Spot вернул HTTP ${response.status}.`);
  return response.json() as Promise<T>;
}

async function loadCandles(pair: string, fetcher: BinanceFetcher, now: number): Promise<TechnicalAnalysisCandle[]> {
  const boundary = Math.floor(now / INTERVAL_MS) * INTERVAL_MS;
  const start = boundary - 240 * INTERVAL_MS;
  const end = boundary - 1;
  const rows = await json<unknown[]>(fetcher, `${BINANCE_API}/api/v3/klines?symbol=${pair}&interval=${INTERVAL}&startTime=${start}&endTime=${end}&limit=240`);
  if (!Array.isArray(rows) || rows.length < 25) throw new Error(`Binance Spot не вернул исторические 4h-свечи для ${pair}.`);
  const candles = rows.map((row, index) => {
    if (!Array.isArray(row) || row.length < 8) throw new Error(`Binance Spot вернул неполную свечу для ${pair}.`);
    const openTime = finite(row[0]);
    const closeTime = finite(row[6]);
    const open = finite(row[1]), high = finite(row[2]), low = finite(row[3]), close = finite(row[4]);
    if (
      openTime !== start + index * INTERVAL_MS
      || closeTime < openTime || closeTime >= now
      || high < Math.max(open, low, close) || low > Math.min(open, high, close)
    ) {
      throw new Error(`Binance Spot вернул несогласованные или открытые 4h-свечи для ${pair}.`);
    }
    return { openTime, open, high, low, close, closeTime, volume: finite(row[5]), quoteVolume: finite(row[7]) };
  });
  return candles;
}

async function validatePair(pair: string, fetcher: BinanceFetcher): Promise<void> {
  const data = await json<{ symbols?: Array<{ symbol?: string; status?: string; quoteAsset?: string }> }>(fetcher, `${BINANCE_API}/api/v3/exchangeInfo?symbol=${pair}`);
  if (!data.symbols?.some((s) => s.symbol === pair && s.status === "TRADING" && s.quoteAsset === "USDT")) {
    throw new Error(`Пара ${pair} не найдена или недоступна как Binance Spot USDT.`);
  }
}

export async function resolveTechnicalAnalysisSnapshot(
  request: TechnicalAnalysisRequest,
  options: TechnicalAnalysisOptions = {},
): Promise<TechnicalAnalysisSnapshot> {
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== "function") throw new Error("Сетевой клиент для Binance Spot недоступен.");
  const now = options.now?.() ?? Date.now();
  let pair: string;
  if (request.mode === "manual") pair = normalizePair(request.symbol).pair;
  else {
    const exchangeInfo = await json<{ symbols?: Array<{ symbol?: string; status?: string; quoteAsset?: string; baseAsset?: string }> }>(
      fetcher,
      `${BINANCE_API}/api/v3/exchangeInfo`,
    );
    const markets = exchangeInfo.symbols;
    if (!Array.isArray(markets) || markets.length === 0) {
      throw new Error("Binance Spot не вернул список торговых пар для автоматического выбора.");
    }
    const tickers = await json<Array<{ symbol?: string; quoteVolume?: string }>>(fetcher, `${BINANCE_API}/api/v3/ticker/24hr`);
    const eligible = tickers.filter((t) => typeof t.symbol === "string" && t.symbol.endsWith("USDT"))
      .filter((t) => { const base = t.symbol!.slice(0, -4); return !STABLES.has(base) && !LEVERAGED.test(base) && markets.some((m) => m.symbol === t.symbol && m.status === "TRADING" && m.quoteAsset === "USDT"); })
      .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume)).slice(0, 10);
    const excluded = new Set(options.excludedCaseKeys ?? []);
    const random = options.random ?? Math.random;
    const shuffled = [...eligible];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const picked = Math.max(0, Math.min(index, Math.floor(random() * (index + 1))));
      [shuffled[index], shuffled[picked]] = [shuffled[picked]!, shuffled[index]!];
    }
    const valid: Array<{ pair: string; candles: TechnicalAnalysisCandle[]; candidate: TechnicalAnalysisCandidate }> = [];
    for (const item of shuffled.slice(0, 10)) {
      try {
        const candles = await loadCandles(item.symbol!, fetcher, now);
        const candidates = findTechnicalAnalysisCandidates(candles)
          .filter((c) => c.signalIndex + 1 + OUTCOME_HORIZON <= candles.length);
        for (const chosen of candidates) valid.push({ pair: item.symbol!, candles, candidate: chosen });
      } catch { /* try the next liquid market */ }
    }
    if (valid.length) {
      const newestByCase = new Map<string, (typeof valid)[number]>();
      for (const item of valid) {
        const key = `${item.pair}:${item.candidate.pattern.type}`;
        const previous = newestByCase.get(key);
        if (!previous || item.candidate.signalIndex > previous.candidate.signalIndex) newestByCase.set(key, item);
      }
      const selected = chooseTechnicalAnalysisCandidate([...newestByCase.values()], excluded, random);
      return createTechnicalAnalysisSnapshot(selected.pair, selected.candles, {
        ...options, now: () => now, signalIndex: selected.candidate.signalIndex,
      });
    }
    throw new Error("Не найден исторический setup среди десяти ликвидных USDT Spot-пар Binance.");
  }
  await validatePair(pair, fetcher);
  return createTechnicalAnalysisSnapshot(pair, await loadCandles(pair, fetcher, now), { ...options, now: () => now });
}