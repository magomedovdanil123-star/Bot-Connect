// Run from artifacts/api-server with esbuild; pass an optional scene number to regenerate one clip.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  generateSpeech,
  getConfiguredVoiceId,
  getSpeechProvider,
  prepareSpeechText,
} from "../src/lib/audio-generation/elevenlabs-client.ts";
import { getVoiceApiModelId } from "../src/lib/audio-generation/voice-api-client.ts";

const scenes = [
  {
    name: "scene-01.mp3",
    text: "Сегодня разбираем Хайп: за месяц он вырос примерно на одиннадцать процентов.",
  },
  {
    name: "scene-02.mp3",
    text: "Пик — почти девяносто восемь долларов; сейчас — около девяноста трёх.",
  },
  {
    name: "scene-03.mp3",
    text: "Сообщения о займах для держателей HYPE и листинге Binance — возможные факторы; открытый интерес достиг рекорда — восемнадцать миллиардов.",
  },
  {
    name: "scene-04.mp3",
    text: "Хайп обошёл эфир и биткоин: одиннадцать процентов против восьми и пяти с половиной.",
  },
  {
    name: "scene-05.mp3",
    text: "Сто долларов месяц назад сегодня стоили бы около ста одиннадцати. Чистая прибыль — одиннадцать долларов десять центов до расходов.",
  },
  {
    name: "scene-06.mp3",
    text: "Если спрос удержится, импульс может продолжиться; ослабнет — возможен откат. Хайп уже в центре внимания — не пропусти; ссылка на биржу в шапке профиля.",
  },
];

const provider = getSpeechProvider();
if (provider !== "voice_api") {
  throw new Error(`Expected the configured voice_api provider, received ${provider}.`);
}

const voiceId = getConfiguredVoiceId();
if (!voiceId) {
  throw new Error("The configured voice_api provider has no voice ID.");
}

const modelId = getVoiceApiModelId();
const settings = {
  speed: 0.98,
  stability: 0.52,
  similarity: 0.78,
  style: 0.2,
  speakerBoost: true,
};
const outputDir = resolve(process.cwd(), "../hype-market-focus/public/audio/voiceover");
await mkdir(outputDir, { recursive: true });

const requestedScene = process.argv[2];
const selectedScenes = requestedScene
  ? scenes.filter((scene) => scene.name === `scene-${requestedScene.padStart(2, "0")}.mp3`)
  : scenes;
if (!selectedScenes.length) {
  throw new Error(`No voiceover scene matches "${requestedScene}". Use scene numbers 1–6.`);
}

let nextIndex = 0;
async function worker() {
  while (nextIndex < selectedScenes.length) {
    const scene = selectedScenes[nextIndex++];
    const audio = await generateSpeech(
      prepareSpeechText(scene.text),
      voiceId,
      modelId,
      settings,
    );
    if (!audio.length) {
      throw new Error(`Voice generation returned empty audio for ${scene.name}.`);
    }
    await writeFile(resolve(outputDir, scene.name), audio);
    console.log(`Generated ${scene.name} (${audio.length} bytes).`);
  }
}

await Promise.all([worker(), worker()]);
console.log(`Voice clips saved to ${outputDir}`);