import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseDistinctCryptoF2Motion,
  cryptoF2MotionFingerprintFromPlan,
  cryptoF2VariationIndex,
} from "./crypto-f2-motion";
import { renderSpeechSubtitle } from "./financial-presenter";
import {
  renderFinancialTopicPreviewFrame,
  renderFinancialTopicSubtitlePreviewFrame,
  type FinancialShortBeat,
  type FinancialShortRenderPlan,
  type FinancialVisualMicroBeat,
} from "./financial-short-renderer";

test("chooses a different available motion when the requested one was already used", () => {
  const choices = ["orbit", "scan", "morph"] as const;
  const used = new Set<string>(["orbit"]);
  const selected = chooseDistinctCryptoF2Motion("orbit", choices, used, "scene-2");

  assert.notEqual(selected, "orbit");
  assert.ok(used.has(selected));
});

test("motion fallback choices are repeatable for the same seed", () => {
  const choices = ["orbit", "scan", "morph"] as const;
  const first = chooseDistinctCryptoF2Motion(
    "orbit",
    choices,
    new Set<string>(["orbit"]),
    "stable-seed",
  );
  const second = chooseDistinctCryptoF2Motion(
    "orbit",
    choices,
    new Set<string>(["orbit"]),
    "stable-seed",
  );

  assert.equal(first, second);
  assert.equal(cryptoF2VariationIndex("stable-seed", 97), cryptoF2VariationIndex("stable-seed", 97));
});

test("fingerprints capture transitions, object actions, and micro-beat variants", () => {
  const plan = {
    visualTheme: "crypto_f2",
    beats: [{
      transitionIn: "cut",
      visualMoments: [{
        objectMotif: "block",
        motionAction: "assemble",
        enterAnimation: "split_assemble",
        exitAnimation: "fold_away",
        motionVariant: 7,
        microBeats: [{
          kind: "object",
          enterAnimation: "arc_left",
          exitAnimation: "spiral_out",
          motionVariant: 2,
        }],
      }],
    }],
  };
  const fingerprint = cryptoF2MotionFingerprintFromPlan(plan);

  assert.ok(fingerprint);
  assert.equal(cryptoF2MotionFingerprintFromPlan({
    ...plan,
    cryptoF2MotionFingerprint: fingerprint,
  }), fingerprint);
  assert.equal(cryptoF2MotionFingerprintFromPlan({ ...plan, visualTheme: "premium_creator" }), undefined);
  assert.notEqual(cryptoF2MotionFingerprintFromPlan({
    ...plan,
    beats: [{
      ...plan.beats[0]!,
      visualMoments: [{
        ...plan.beats[0]!.visualMoments[0]!,
        motionVariant: 8,
      }],
    }],
  }), fingerprint);
});

test("Crypto F2 omits all detached word inserts while keeping sticker text and subtitles", () => {
  const detachedMicroBeats: FinancialVisualMicroBeat[] = [
    "keyword",
    "object",
    "sticker",
    "arrow",
    "number",
    "highlight",
  ].map((kind, index) => ({
    id: `f2-micro-${index + 1}`,
    kind: kind as FinancialVisualMicroBeat["kind"],
    cueExcerpt: "Сеть проверяет перевод",
    text: `ЛИШНЯЯ ВСТАВКА ${index + 1}`,
    from: 0.1 + index * 0.1,
    to: 0.2 + index * 0.1,
    position: "left",
    enterAnimation: "arc_left",
    exitAnimation: "spiral_out",
    motionVariant: index,
    holdWords: 2,
  }));
  const beat: FinancialShortBeat = {
    id: "f2-scene-1",
    from: 0,
    to: 1,
    visual: "definition",
    title: "СЕТЬ",
    subtitle: "Сеть проверяет перевод.",
    transitionIn: "cut",
    visualMoments: [{
      id: "f2-moment-1",
      voiceExcerpt: "Сеть проверяет перевод.",
      from: 0,
      to: 1,
      kind: "concept_card",
      presentationStyle: "card",
      label: "Сеть проверяет перевод",
      position: "center",
      enterAnimation: "draw_on",
      exitAnimation: "fold_away",
      objectMotif: "network",
      motionAction: "scan",
      motionVariant: 2,
      microBeats: detachedMicroBeats,
    }],
  };
  const plan: FinancialShortRenderPlan = {
    title: "Крипто Ф2",
    mainTitle: "КАК РАБОТАЕТ СЕТЬ",
    script: beat.subtitle,
    beats: [beat],
    background: "grid",
    visualTheme: "crypto_f2",
  };
  const svg = renderFinancialTopicPreviewFrame(plan, 1_000, 500, []);

  assert.match(svg, /^<svg/u);
  assert.ok(svg.includes("Сеть проверяет перевод."));
  assert.ok(svg.includes("СЕТЬ ПРОВЕРЯЕТ ПЕРЕВОД"));
  for (let index = 1; index <= detachedMicroBeats.length; index += 1) {
    assert.doesNotMatch(svg, new RegExp(`ЛИШНЯЯ ВСТАВКА ${index}`, "u"));
  }
  const cryptoSubtitle = renderFinancialTopicSubtitlePreviewFrame(plan, 1_000, 500, []);
  assert.match(cryptoSubtitle, /<text x="540" y="980"/u);
  assert.ok(cryptoSubtitle.includes("Сеть"));
  assert.match(renderSpeechSubtitle(beat, 0.5), /<text x="540" y="900"/u);
  assert.ok(svg.includes("#9AE8BD"));
  assert.doesNotMatch(svg, /<image\b/u);
});