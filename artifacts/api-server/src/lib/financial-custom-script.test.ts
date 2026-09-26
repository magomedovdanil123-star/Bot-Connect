import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCryptoCustomScriptMessage,
  splitVerbatimCryptoScript,
} from "./financial-custom-script";

const sampleScript = [
  "Блокчейн — это общий журнал операций, который хранится сразу у многих участников сети.",
  "Каждая новая запись проверяется по правилам протокола, а не одной центральной компанией.",
  "Криптокошелёк хранит ключи, с помощью которых владелец подтверждает свои действия.",
  "Сама криптовалюта при этом обычно остаётся записью в блокчейне.",
  "Биржа помогает обменивать активы, но не заменяет личный кошелёк.",
  "Перед переводом важно проверить сеть и адрес получателя.",
].join(" ");

test("parses an explicit topic and keeps the user's narration text", () => {
  const parsed = parseCryptoCustomScriptMessage(
    `Тема: Как устроен блокчейн\nСценарий:\n${sampleScript}`,
    180,
  );

  assert.equal(parsed.topic, "Как устроен блокчейн");
  assert.equal(parsed.script, sampleScript);
});

test("splits the script into scenes without dropping or rewriting words", () => {
  const scenes = splitVerbatimCryptoScript(sampleScript);

  assert.equal(scenes.length, 6);
  assert.equal(scenes.join(" "), sampleScript);
  assert.ok(scenes.every((scene) => (scene.match(/[\p{L}\p{N}]+/gu) ?? []).length >= 4));
});

test("derives a topic from the first sentence when no topic header is supplied", () => {
  const parsed = parseCryptoCustomScriptMessage(sampleScript, 180);

  assert.equal(parsed.topic, "Блокчейн — это общий журнал операций, который хранится сразу у многих участников сети.");
  assert.equal(parsed.script, sampleScript);
});

test("rejects scripts too short to form six scenes", () => {
  assert.throws(
    () => parseCryptoCustomScriptMessage("Биткоин — это цифровая валюта.", 180),
    /не менее 30 слов/u,
  );
});

test("keeps a negated guarantee phrase together when splitting a user script", () => {
  const script = [
    "Актив проходит проверку сети — не гарантированный заработок",
    "определяется только условиями задачи",
    "и заранее выбранными параметрами перевода",
    "внимательно проверяйте адрес получателя",
    "и подтверждайте все действия самостоятельно",
    "Такой подход помогает осознанно оценить возможные последствия перед выбором.",
  ].join(" ");
  const scenes = splitVerbatimCryptoScript(script);

  assert.equal(scenes.length, 6);
  assert.equal(scenes.join(" "), script);
  assert.ok(scenes.every((scene) => (scene.match(/[\p{L}\p{N}]+/gu) ?? []).length >= 4));
  assert.ok(scenes.some((scene) => /не гарантированный заработок/iu.test(scene)));
});