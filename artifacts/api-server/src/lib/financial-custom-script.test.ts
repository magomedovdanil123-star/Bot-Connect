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
  assert.ok(scenes.every((scene) => scene.split(/\s+/u).length >= 5));
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