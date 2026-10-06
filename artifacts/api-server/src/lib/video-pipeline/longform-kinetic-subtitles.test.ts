import assert from "node:assert/strict";
import test from "node:test";
import {
  alignKineticSubtitleWords,
  buildLongformKineticSubtitleAss,
  classifyKineticSubtitleTone,
} from "./longform-kinetic-subtitles";

test("kinetic captions use transcript word timestamps but retain approved narration text", () => {
  const voices = [{
    text: "Эта монета выросла на 32% за 24 часа.",
    startTime: 0,
    endTime: 4_000,
  }];
  const transcriptWords = [
    ["Эта", 0.12, 0.3],
    ["монета", 0.31, 0.68],
    ["выросла", 0.69, 1.12],
    ["на", 1.13, 1.24],
    ["32%", 1.25, 1.7],
    ["за", 1.83, 2.0],
    ["24", 2.01, 2.4],
    ["часа", 2.41, 2.82],
  ].map(([text, start, end]) => ({
    text: String(text),
    start: Number(start),
    end: Number(end),
    type: "word",
  }));

  const result = alignKineticSubtitleWords({
    voices,
    transcriptWords,
    durationMs: 4_000,
  });

  assert.equal(result.matchCoverage, 1);
  assert.equal(result.matchedWordCount, 8);
  assert.equal(result.interpolatedWordCount, 0);
  assert.equal(result.words[4]?.text, "32%");
  assert.equal(result.words[4]?.startMs, 1_250);
  assert.equal(result.words[4]?.endMs, 1_700);
});

test("kinetic subtitle alignment fails closed when the transcript does not match narration", () => {
  assert.throws(
    () => alignKineticSubtitleWords({
      voices: [{ text: "Утверждённая речь для субтитров", startTime: 0, endTime: 2_000 }],
      transcriptWords: [
        { text: "совершенно", start: 0.2, end: 0.5, type: "word" },
        { text: "другие", start: 0.5, end: 0.8, type: "word" },
        { text: "слова", start: 0.8, end: 1.1, type: "word" },
      ],
      durationMs: 2_000,
    }),
    /matched only .*minimum is/u,
  );
});

test("kinetic subtitle alignment joins split transcript words for approved hyphenated compounds", () => {
  const result = alignKineticSubtitleWords({
    voices: [{
      text: "We use perpetual‑exchange products",
      startTime: 0,
      endTime: 4_000,
    }],
    transcriptWords: [
      { text: "We", start: 0.1, end: 0.3, type: "word" },
      { text: "use", start: 0.35, end: 0.5, type: "word" },
      { text: "perpetual", start: 0.6, end: 0.9, type: "word" },
      { text: "exchange", start: 0.92, end: 1.3, type: "word" },
      { text: "products", start: 1.4, end: 1.9, type: "word" },
    ],
    durationMs: 4_000,
  });

  assert.equal(result.matchCoverage, 1);
  assert.equal(result.interpolatedWordCount, 0);
  assert.deepEqual(result.words[2], {
    text: "perpetual‑exchange",
    startMs: 600,
    endMs: 1_300,
  });
});

test("kinetic subtitle alignment maps spelled-out Russian numbers to exact Arabic-number timings", () => {
  const result = alignKineticSubtitleWords({
    voices: [{
      text: "Движение составило примерно 170 процентов; объём достигал 239 миллионов.",
      startTime: 0,
      endTime: 5_000,
    }],
    transcriptWords: [
      { text: "Движение", start: 0.1, end: 0.4, type: "word" },
      { text: "составило", start: 0.4, end: 0.8, type: "word" },
      { text: "примерно", start: 0.8, end: 1.1, type: "word" },
      { text: "сто", start: 1.1, end: 1.3, type: "word" },
      { text: "семьдесят", start: 1.32, end: 1.75, type: "word" },
      { text: "процентов;", start: 1.8, end: 2.2, type: "word" },
      { text: "объём", start: 2.3, end: 2.6, type: "word" },
      { text: "достигал", start: 2.6, end: 3.1, type: "word" },
      { text: "двухсот", start: 3.2, end: 3.5, type: "word" },
      { text: "тридцати", start: 3.51, end: 3.85, type: "word" },
      { text: "девяти", start: 3.86, end: 4.1, type: "word" },
      { text: "миллионов.", start: 4.12, end: 4.5, type: "word" },
    ],
    durationMs: 5_000,
    requireExactMatches: true,
  });

  assert.equal(result.matchCoverage, 1);
  assert.equal(result.matchedWordCount, 9);
  assert.equal(result.interpolatedWordCount, 0);
  assert.deepEqual(result.words[3], { text: "170", startMs: 1_100, endMs: 1_750 });
  assert.deepEqual(result.words[7], { text: "239", startMs: 3_200, endMs: 4_100 });
});

test("kinetic subtitle alignment does not match a different spelled-out number by prefix", () => {
  assert.throws(
    () => alignKineticSubtitleWords({
      voices: [{
        text: "Рост составил 100 процентов.",
        startTime: 0,
        endTime: 3_000,
      }],
      transcriptWords: [
        { text: "Рост", start: 0.1, end: 0.3, type: "word" },
        { text: "составил", start: 0.31, end: 0.7, type: "word" },
        { text: "сто", start: 0.8, end: 1, type: "word" },
        { text: "семьдесят", start: 1.01, end: 1.4, type: "word" },
        { text: "процентов.", start: 1.5, end: 1.9, type: "word" },
      ],
      durationMs: 3_000,
      requireExactMatches: true,
    }),
    /matched only .*minimum is/u,
  );
});

test("kinetic subtitle alignment joins split memecoin words and times ordinal years exactly", () => {
  const result = alignKineticSubtitleWords({
    voices: [{
      text: "Мемкоин, мемкоины и мемкоин-сектор. В октябре 2026 года цена приблизилась к четырём центам.",
      startTime: 0,
      endTime: 5_500,
    }],
    transcriptWords: [
      { text: "Мем", start: 0.1, end: 0.2, type: "word" },
      { text: "коин,", start: 0.22, end: 0.4, type: "word" },
      { text: "мем", start: 0.7, end: 0.8, type: "word" },
      { text: "коины", start: 0.82, end: 1, type: "word" },
      { text: "и", start: 1.1, end: 1.2, type: "word" },
      { text: "Мем", start: 1.3, end: 1.45, type: "word" },
      { text: "коин", start: 1.46, end: 1.61, type: "word" },
      { text: "сектор.", start: 1.62, end: 1.8, type: "word" },
      { text: "В", start: 2, end: 2.1, type: "word" },
      { text: "октябре", start: 2.1, end: 2.5, type: "word" },
      { text: "две", start: 2.6, end: 2.8, type: "word" },
      { text: "тысячи", start: 2.81, end: 3, type: "word" },
      { text: "двадцать", start: 3.01, end: 3.3, type: "word" },
      { text: "шестого", start: 3.31, end: 3.6, type: "word" },
      { text: "года", start: 3.61, end: 3.8, type: "word" },
      { text: "цена", start: 4, end: 4.2, type: "word" },
      { text: "приблизилась", start: 4.2, end: 4.6, type: "word" },
      { text: "к", start: 4.61, end: 4.7, type: "word" },
      { text: "четырем", start: 4.71, end: 4.9, type: "word" },
      { text: "центам.", start: 4.91, end: 5.2, type: "word" },
    ],
    durationMs: 6_000,
    requireExactMatches: true,
  });

  assert.equal(result.matchCoverage, 1);
  assert.equal(result.interpolatedWordCount, 0);
  assert.deepEqual(
    result.words.filter((word) => word.text.toLocaleLowerCase("ru-RU").includes("мемкоин")),
    [
      { text: "Мемкоин,", startMs: 100, endMs: 400 },
      { text: "мемкоины", startMs: 700, endMs: 1_000 },
      { text: "мемкоин-сектор.", startMs: 1_300, endMs: 1_800 },
    ],
  );
  assert.deepEqual(result.words.find((word) => word.text === "2026"), {
    text: "2026",
    startMs: 2_600,
    endMs: 3_600,
  });
  assert.deepEqual(result.words.find((word) => word.text === "четырём"), {
    text: "четырём",
    startMs: 4_710,
    endMs: 4_900,
  });
});

test("kinetic caption colors distinguish numbers, sentiment and domain keywords", () => {
  assert.equal(classifyKineticSubtitleTone("32%"), "gold");
  assert.equal(classifyKineticSubtitleTone("двадцать"), "gold");
  assert.equal(classifyKineticSubtitleTone("падение"), "red");
  assert.equal(classifyKineticSubtitleTone("выросла"), "green");
  assert.equal(classifyKineticSubtitleTone("Hyperliquid"), "accent");
  assert.equal(classifyKineticSubtitleTone("обычное"), "white");
});

test("kinetic ASS reveals words at their own timestamps with short phrases and varied motion", () => {
  const words = [
    { text: "Эта", startMs: 1_000, endMs: 1_200 },
    { text: "монета", startMs: 1_200, endMs: 1_450 },
    { text: "выросла", startMs: 1_450, endMs: 1_800 },
    { text: "на", startMs: 1_800, endMs: 1_920 },
    { text: "32%", startMs: 1_920, endMs: 2_300 },
    { text: "за", startMs: 2_450, endMs: 2_600 },
    { text: "24", startMs: 2_600, endMs: 2_950 },
    { text: "часа.", startMs: 2_950, endMs: 3_250 },
  ];
  const result = buildLongformKineticSubtitleAss({
    words,
    durationMs: 5_000,
    width: 1_920,
    height: 1_080,
  });
  const events = result.ass.split("\n").filter((line) => line.startsWith("Dialogue:"));
  const firstWordPosition = events[0]!.match(/\\pos\((\d+),(\d+)\)/u);
  const secondWordPosition = events[1]!.match(/\\pos\((\d+),(\d+)\)/u);

  assert.equal(result.wordCount, words.length);
  assert.ok(result.phraseCount >= 4);
  assert.ok(result.maxWordsPerPhrase <= 3);
  assert.equal(events.length, words.length);
  assert.match(events[0]!, /0:00:01\.00/);
  assert.match(events[1]!, /0:00:01\.20/);
  assert.match(events.find((line) => line.endsWith("32%"))!, /&H0066D1FF&/);
  assert.match(result.ass, /&H0074FF55&/);
  assert.match(result.ass, /\\move\(/);
  assert.match(result.ass, /\\t\(0,/);
  assert.ok(Number(secondWordPosition?.[1]) - Number(firstWordPosition?.[1]) > 250);
});

test("opt-in cinematic captions use a scene zone, readable key-word sizes, and semantic motion", () => {
  const result = buildLongformKineticSubtitleAss({
    words: [
      { text: "выросла", startMs: 100, endMs: 480 },
      { text: "127%", startMs: 500, endMs: 900 },
    ],
    durationMs: 1_000,
    width: 1_920,
    height: 1_080,
    emphasisEvents: [{
      word: "127%",
      startMs: 500,
      endMs: 900,
      intensity: "impact",
      tone: "gold",
    }],
    layoutForPhrase: () => ({
      x: 400,
      y: 100,
      width: 1_350,
      height: 180,
      alignment: "right",
    }),
    animationForWord: ({ word }) => word.text.startsWith("вырос") ? "WORD_RISE" : "WORD_PUNCH",
    cinematicTypography: {
      bodyMinPx: 56,
      bodyMaxPx: 88,
      keyMinPx: 92,
      keyMaxPx: 144,
      keyScale: 1.32,
    },
  });
  const events = result.ass.split("\n").filter((line) => line.startsWith("Dialogue:"));
  const fontSizes = [...result.ass.matchAll(/\\fs(\d+)/gu)].map((match) => Number(match[1]));

  assert.equal(result.wordCount, 2);
  assert.equal(events.length, 2);
  assert.match(events[0]!, /0:00:00\.10/u);
  assert.match(events[1]!, /0:00:00\.50/u);
  assert.match(events[0]!, /\\move\(/u);
  assert.match(events[1]!, /\\fscx64/u);
  assert.ok(fontSizes.some((size) => size >= 56 && size <= 88));
  assert.ok(fontSizes.some((size) => size >= 92 && size <= 144));
});