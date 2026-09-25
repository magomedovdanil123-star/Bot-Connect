import { getSpeechWordTimings } from "./financial-presenter";

export type FinancialNumberPhrase = {
  value: number;
  from: number;
  to: number;
  unit: string;
  caption: string;
  kind: "calendar" | "currency" | "percent" | "quantity" | "generic" | "change";
  direction: "up" | "down" | "neutral";
  operation?: "half" | "double" | "minus_one";
};

type NumberWord = {
  word: string;
  normalized: string;
  start: number;
  end: number;
  punctuation: string;
};

const NUMBER_WORDS = new Map<string, number>([
  ["ноль", 0], ["нуль", 0],
  ["один", 1], ["одна", 1], ["одно", 1], ["одну", 1], ["одним", 1], ["одной", 1],
  ["первый", 1], ["первая", 1], ["первое", 1], ["первого", 1], ["первой", 1], ["первом", 1],
  ["два", 2], ["две", 2], ["двух", 2], ["двум", 2],
  ["второй", 2], ["вторая", 2], ["второе", 2], ["второго", 2], ["втором", 2],
  ["три", 3], ["трех", 3], ["трёх", 3],
  ["третий", 3], ["третья", 3], ["третье", 3], ["третьего", 3], ["третьей", 3], ["третьем", 3],
  ["четыре", 4], ["четырех", 4], ["четырёх", 4],
  ["четвертый", 4], ["четвёртый", 4], ["четвертая", 4], ["четвёртая", 4], ["четвертое", 4], ["четвёртое", 4],
  ["четвертого", 4], ["четвёртого", 4], ["четвертом", 4], ["четвёртом", 4],
  ["пять", 5], ["шесть", 6], ["семь", 7], ["восемь", 8], ["девять", 9],
  ["десять", 10], ["одиннадцать", 11], ["двенадцать", 12], ["тринадцать", 13],
  ["четырнадцать", 14], ["пятнадцать", 15], ["шестнадцать", 16],
  ["семнадцать", 17], ["восемнадцать", 18], ["девятнадцать", 19],
  ["двадцать", 20], ["тридцать", 30], ["сорок", 40], ["пятьдесят", 50],
  ["шестьдесят", 60], ["семьдесят", 70], ["восемьдесят", 80], ["девяносто", 90],
  ["сто", 100], ["двести", 200], ["триста", 300], ["четыреста", 400],
  ["пятьсот", 500], ["шестьсот", 600], ["семьсот", 700], ["восемьсот", 800],
  ["девятьсот", 900],
]);

const SCALE_WORDS = new Map<string, { value: number; label: string }>([
  ["тысяча", { value: 1_000, label: "тыс." }],
  ["тысячи", { value: 1_000, label: "тыс." }],
  ["тысяч", { value: 1_000, label: "тыс." }],
  ["тысячу", { value: 1_000, label: "тыс." }],
  ["миллион", { value: 1_000_000, label: "млн" }],
  ["миллиона", { value: 1_000_000, label: "млн" }],
  ["миллионов", { value: 1_000_000, label: "млн" }],
  ["миллиарды", { value: 1_000_000_000, label: "млрд" }],
  ["миллиард", { value: 1_000_000_000, label: "млрд" }],
  ["миллиарда", { value: 1_000_000_000, label: "млрд" }],
  ["миллиардов", { value: 1_000_000_000, label: "млрд" }],
  ["триллион", { value: 1_000_000_000_000, label: "трлн" }],
  ["триллиона", { value: 1_000_000_000_000, label: "трлн" }],
  ["триллионов", { value: 1_000_000_000_000, label: "трлн" }],
  ["тыс", { value: 1_000, label: "тыс." }],
  ["млн", { value: 1_000_000, label: "млн" }],
  ["млрд", { value: 1_000_000_000, label: "млрд" }],
  ["трлн", { value: 1_000_000_000_000, label: "трлн" }],
]);

type NumberUnit = {
  label: string;
  kind: FinancialNumberPhrase["kind"];
};

function normalize(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/[^\p{L}\p{N}%]/gu, "");
}

function unitFor(word: string | undefined): NumberUnit | undefined {
  if (!word) return undefined;
  const normalized = normalize(word);
  if (/^(?:год|года|лет|году|годам|годах|годовой|годовых)$/u.test(normalized)) {
    return { label: word.toLocaleLowerCase("ru-RU"), kind: "calendar" };
  }
  if (/^(?:месяц|месяца|месяцев|месяце|месяцам|месячный|месячных)$/u.test(normalized)) {
    return { label: word.toLocaleLowerCase("ru-RU"), kind: "calendar" };
  }
  if (/^(?:день|дня|дней|дню|днями|дневной|дневных)$/u.test(normalized)) {
    return { label: word.toLocaleLowerCase("ru-RU"), kind: "calendar" };
  }
  if (/^(?:неделя|недели|недель|неделю|неделям|недельный|недельных)$/u.test(normalized)) {
    return { label: word.toLocaleLowerCase("ru-RU"), kind: "calendar" };
  }
  if (/^(?:квартал|квартала|кварталов|квартале|квартальный|квартальных)$/u.test(normalized)) {
    return { label: word.toLocaleLowerCase("ru-RU"), kind: "calendar" };
  }
  if (/^(?:процент|процента|процентов|процентный|процентных|%)$/u.test(normalized)) {
    return { label: "%", kind: "percent" };
  }
  if (/^(?:рубль|рубля|рублей|рублях|руб\.?|₽)$/u.test(normalized)) {
    return { label: "₽", kind: "currency" };
  }
  if (/^(?:доллар|доллара|долларов|долларах|usd|\$)$/u.test(normalized)) {
    return { label: "$", kind: "currency" };
  }
  if (/^(?:евро|eur|€)$/u.test(normalized)) {
    return { label: "€", kind: "currency" };
  }
  if (/^(?:монета|монеты|монет|монетой|монетами)$/u.test(normalized)) {
    return { label: word.toLocaleLowerCase("ru-RU"), kind: "quantity" };
  }
  if (/^(?:биткоин|биткоина|биткоинов|btc)$/u.test(normalized)) {
    return { label: "BTC", kind: "quantity" };
  }
  if (/^(?:акция|акции|акций|акциями|акцию)$/u.test(normalized)) {
    return { label: word.toLocaleLowerCase("ru-RU"), kind: "quantity" };
  }
  if (/^(?:облигация|облигации|облигаций|облигациями|облигацию)$/u.test(normalized)) {
    return { label: word.toLocaleLowerCase("ru-RU"), kind: "quantity" };
  }
  if (/^(?:раз|раза|разов)$/u.test(normalized)) {
    return { label: word.toLocaleLowerCase("ru-RU"), kind: "quantity" };
  }
  return undefined;
}

function makeWords(value: string): NumberWord[] {
  const timings = getSpeechWordTimings(value);
  const matches = [...value.matchAll(/[\p{L}\p{N}]+(?:[-’'][\p{L}\p{N}]+)*%?[,.!?;:…]?/gu)];
  return timings.words.map((timing, index) => {
    const raw = matches[index]?.[0] ?? timing.word;
    const punctuation = timing.punctuation;
    return {
      word: raw.replace(/[,.!?;:…]+$/u, ""),
      normalized: normalize(raw),
      start: timing.start,
      end: timing.end,
      punctuation,
    };
  });
}

function numericValueFromWord(word: NumberWord): number | undefined {
  const rawNumeric = word.word.replace(/[^\d.,]/gu, "");
  if (!rawNumeric || !/^\d+(?:[.,]\d+)?$/u.test(rawNumeric)) return undefined;
  const value = Number(rawNumeric.replace(",", "."));
  return Number.isFinite(value) ? value : undefined;
}

function parseNumberAt(
  words: NumberWord[],
  start: number,
): { value: number; end: number; scaleLabel?: string; containsDigit: boolean } | undefined {
  let index = start;
  let total = 0;
  let group = 0;
  let foundNumber = false;
  let containsDigit = false;
  let scaleLabel: string | undefined;

  while (index < words.length) {
    const word = words[index]!;
    const digitValue = numericValueFromWord(word);
    if (digitValue !== undefined) {
      let combinedValue = digitValue;
      let combinedEnd = index + 1;
      const decimalPart = word.punctuation === "," || word.punctuation === "."
        ? numericValueFromWord(words[index + 1]!)
        : undefined;
      if (decimalPart !== undefined && /^\d+$/u.test(words[index + 1]!.word)) {
        combinedValue = Number(`${word.word.replace(/\D/gu, "")}.${words[index + 1]!.word}`);
        combinedEnd = index + 2;
      }
      const firstDigits = word.word.replace(/\D/gu, "");
      if (combinedEnd === index + 1 && /^\d{1,3}$/u.test(firstDigits) && !word.punctuation) {
        let lastRaw = word.word;
        while (combinedEnd < words.length) {
          const next = words[combinedEnd]!;
          const nextDigits = next.word.replace(/\D/gu, "");
          if (!/^\d{3}$/u.test(nextDigits) || next.punctuation || !/^\d+$/u.test(next.word)) break;
          lastRaw += next.word;
          combinedEnd += 1;
        }
        if (combinedEnd > index + 1) combinedValue = Number(lastRaw);
      }
      group += combinedValue;
      foundNumber = true;
      containsDigit = true;
      index = combinedEnd;
      continue;
    }

    const scale = SCALE_WORDS.get(word.normalized);
    if (scale && foundNumber) {
      group = (group || 1) * scale.value;
      total += group;
      group = 0;
      scaleLabel = scale.label;
      index += 1;
      continue;
    }

    const spoken = NUMBER_WORDS.get(word.normalized);
    if (spoken !== undefined) {
      group += spoken;
      foundNumber = true;
      index += 1;
      continue;
    }
    break;
  }

  if (!foundNumber) return undefined;
  const value = total + group;
  return Number.isFinite(value) ? { value, end: index, scaleLabel, containsDigit } : undefined;
}

function nearbyCaption(words: NumberWord[], start: number, end: number, unit: string, kind: FinancialNumberPhrase["kind"]): string {
  const context = words
    .slice(Math.max(0, start - 5), Math.min(words.length, end + 4))
    .map((word) => word.normalized)
    .join(" ");
  if (/максимум|предел|лимит|эмисс|предлож/iu.test(context)) return "ЛИМИТ";
  if (/бюджет|расход|затрат|потрат/iu.test(context)) return "РАСХОД";
  if (/купон|ставк|процент|доходност/iu.test(context)) return "СТАВКА";
  if (kind === "percent") return "СТАВКА";
  if (/цена|цену|цене|ценой|стоимост/iu.test(context)) return "ЦЕНА";
  if (kind === "calendar") return "ПЕРИОД";
  if (/уменьш|сниж|падает|сокращ|убыт|вдвое|половин|меньш/iu.test(context)) return "СНИЖЕНИЕ";
  if (/увелич|раст|рост|прибав|удво/iu.test(context)) return "РОСТ";
  if (/прибыл|выруч|доход|дивиденд/iu.test(context)) return "ДОХОД";
  if (kind === "currency") return "СУММА";
  if (unit) return unit.toLocaleUpperCase("ru-RU");
  return "ЗНАЧЕНИЕ";
}

export function extractFinancialNumberPhrases(value: string): FinancialNumberPhrase[] {
  const words = makeWords(value);
  if (!words.length) return [];
  const totalWeight = getSpeechWordTimings(value).totalWeight;
  if (totalWeight <= 0) return [];

  const phrases: FinancialNumberPhrase[] = [];

  for (let index = 0; index < words.length; index += 1) {
    const normalized = words[index]!.normalized;
    if (normalized === "вдвое" || normalized === "пополам") {
      const before = words.slice(Math.max(0, index - 4), index).map((word) => word.normalized).join(" ");
      const direction: FinancialNumberPhrase["direction"] = /уменьш|сниж|падает|сокращ|меньш/iu.test(before)
        ? "down"
        : "neutral";
      phrases.push({
        value: 2,
        from: words[index]!.start / totalWeight,
        to: words[index]!.end / totalWeight,
        unit: "",
        caption: direction === "down" ? "ПОЛОВИНА" : "В ДВА РАЗА",
        kind: "change",
        direction,
        operation: "half",
      });
      continue;
    }
    if (normalized.startsWith("удво")) {
      phrases.push({
        value: 2,
        from: words[index]!.start / totalWeight,
        to: words[index]!.end / totalWeight,
        unit: "",
        caption: "УДВОЕНИЕ",
        kind: "change",
        direction: "up",
        operation: "double",
      });
      continue;
    }

    const parsed = parseNumberAt(words, index);
    if (!parsed) continue;
    const embeddedPercent = words.slice(index, parsed.end).some((word) => word.word.includes("%"))
      ? { label: "%", kind: "percent" as const }
      : undefined;
    const unit = embeddedPercent ?? unitFor(words[parsed.end]?.word);
    const previous = words.slice(Math.max(0, index - 4), index).map((word) => word.normalized).join(" ");
    const hasExplicitPeriod = /\bраз\b.*\bв\b|\bкажд(?:ый|ая|ое|ые)\b|\bпримерно\b|\bоколо\b/iu.test(previous);
    const scaleWasSpoken = Boolean(parsed.scaleLabel);
    if (!parsed.containsDigit && !unit && !scaleWasSpoken && !hasExplicitPeriod) continue;

    let endIndex = parsed.end;
    let unitLabel = unit?.label ?? parsed.scaleLabel ?? "";
    let kind = unit?.kind ?? (parsed.scaleLabel ? "quantity" : "generic");
    if (unit && !embeddedPercent) endIndex += 1;

    const nextWords = words.slice(endIndex, endIndex + 3).map((word) => word.normalized);
    if (kind === "percent" && /^(?:годовой|годовых|годовая|годовое)$/u.test(nextWords[0] ?? "")) {
      unitLabel = `${unitLabel} ${words[endIndex]!.word.toLocaleLowerCase("ru-RU")}`;
      endIndex += 1;
    }
    if (/^(?:в|за)$/u.test(nextWords[0] ?? "") && unitFor(words[endIndex + 1]?.word)?.kind === "calendar") {
      unitLabel = `${unitLabel} ${words[endIndex]!.word} ${words[endIndex + 1]!.word.toLocaleLowerCase("ru-RU")}`;
      endIndex += 2;
    }

    const phraseStart = words[index]!.start;
    const phraseEnd = words[Math.max(index, endIndex - 1)]!.end;
    const localContext = words
      .slice(Math.max(0, index - 7), Math.min(words.length, endIndex + 3))
      .map((word) => word.normalized)
      .join(" ");
    const direction: FinancialNumberPhrase["direction"] = kind === "calendar"
      ? "neutral"
      : /уменьш|сниж|падает|сокращ|убыт|трат|расход|минус|меньш/iu.test(localContext)
        ? "down"
      : /увелич|вырос|раст|рост|прибав|доход|плюс|удво/iu.test(localContext)
          ? "up"
          : "neutral";
    const explicitMinusOne = direction === "down"
      && (localContext.includes("на один")
        || localContext.includes("на одну")
        || localContext.includes("по одному")
        || localContext.includes("на 1"));

    phrases.push({
      value: parsed.value,
      from: phraseStart / totalWeight,
      to: phraseEnd / totalWeight,
      unit: unitLabel,
      caption: nearbyCaption(words, index, endIndex, unitLabel, kind),
      kind,
      direction,
      ...(explicitMinusOne ? { operation: "minus_one" as const } : {}),
    });
    index = Math.max(index, endIndex - 1);
  }

  return phrases
    .filter((phrase) => phrase.to > phrase.from)
    .sort((first, second) => first.from - second.from);
}