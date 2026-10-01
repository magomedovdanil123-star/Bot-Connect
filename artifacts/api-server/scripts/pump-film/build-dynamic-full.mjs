import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = resolve(process.cwd());
const projectDir = join(root, "attached_assets/generated_video/pump-film-2026-09-30");
const outputDir = join(projectDir, "dynamic-full");
const scriptPath = join(root, "research/pump-film-script.json");
const planPath = join(root, "research/pump-film-visual-plan.json");
const alignmentPath = join(root, "attached_assets/generated_audio/pump-film-2026-09-30/alignment.json");
const voicePath = join(root, "attached_assets/generated_audio/pump-film-2026-09-30/voice.json");

const motifs = {
  1: "triad",
  2: "launch",
  3: "curve",
  4: "graduation",
  5: "fees",
  6: "metric",
  7: "rights",
  8: "buyback",
  9: "proof",
  10: "audit",
  11: "supply",
  12: "allocation",
  13: "circulation",
  14: "market",
  15: "formula",
  16: "competition",
  17: "legal",
  18: "risk",
  19: "scenario",
  20: "closing",
};

const stopWords = new Set([
  "а", "без", "более", "бы", "в", "во", "вот", "все", "всего", "вы",
  "где", "да", "для", "до", "его", "ее", "если", "есть", "ещё", "же",
  "за", "здесь", "и", "из", "или", "им", "их", "к", "как", "какие",
  "какой", "когда", "которые", "кто", "ли", "между", "мы", "на",
  "над", "нам", "не", "него", "нее", "но", "о", "об", "одна", "одной",
  "он", "она", "они", "оно", "от", "по", "под", "поэтому", "после",
  "при", "про", "раз", "с", "сам", "сама", "сами", "со", "так", "также",
  "там", "то", "только", "у", "уже", "что", "это", "этого", "этим",
  "этот", "эта", "эти", "этих", "я", "нужно", "нужны", "может", "можно",
  "будет", "будут", "должны", "очень",
]);

const layoutNotes = [
  "Асимметричный макро-кадр: смысловой знак крупно справа, короткий заголовок бьёт слева; камера быстро приближается и уходит в боковой кроп.",
  "Центральная механика: геометрия раскрывается апертурой, затем перестраивается в новый знак; текст раскрывается маской снизу вверх.",
  "Диагональная разбивка поля: поток проходит через кадр, токены пересекают границу, доминирующий цвет меняется на смысловом ударе.",
  "Бумажное поле с огромным типографическим акцентом: одно правило подчёркнуто, противоположная категория отделяется резким разрезом.",
  "Крупный графический план: один объект занимает большую часть кадра, вокруг него последовательно меняются две короткие подписи и направление камеры.",
  "Развёрнутый широкий кадр: объекты сначала разнесены по краям, затем движение стягивает их в новую схему и готовит следующий переход.",
];

function exactFragment(text) {
  const tokens = (text.match(/[\p{L}\p{N}%$]+(?:[.,]\d+)?/gu) ?? [])
    .filter((word) => !stopWords.has(word.toLocaleLowerCase("ru")));
  if (!tokens.length) return text.split(/\s+/u).slice(0, 4).join(" ");
  return tokens.slice(0, 5).join(" ").toLocaleUpperCase("ru");
}

function stableOffset(sceneNumber, shotIndex) {
  const seed = (sceneNumber * 13 + shotIndex * 7 + sceneNumber * shotIndex * 3) % 13;
  return [-0.36, -0.24, -0.17, -0.11, -0.04, 0.02, 0.08, 0.13, 0.18, 0.23, 0.29, 0.34, 0][seed];
}

async function main() {
  const [script, visualPlan, alignment, voice] = await Promise.all([
    readFile(scriptPath, "utf8").then(JSON.parse),
    readFile(planPath, "utf8").then(JSON.parse),
    readFile(alignmentPath, "utf8").then(JSON.parse),
    readFile(voicePath, "utf8").then(JSON.parse),
  ]);

  if (script.scenes.length !== 20 || visualPlan.scenes.length !== 20 || alignment.sentences.length < 100) {
    throw new Error("PUMP full-film inputs are incomplete; expected 20 chapters and aligned narration.");
  }
  if (alignment.script_alignment.match_ratio < 0.9 || Math.abs(voice.duration_seconds - alignment.audio_duration_seconds) > 1) {
    throw new Error("PUMP narration alignment does not match the voice manifest.");
  }

  const sentencesByScene = new Map();
  for (const sentence of alignment.sentences) {
    const rows = sentencesByScene.get(sentence.scene_number) ?? [];
    rows.push(sentence);
    sentencesByScene.set(sentence.scene_number, rows);
  }
  const planByScene = new Map(visualPlan.scenes.map((scene) => [scene.scene_number, scene]));
  const orderedScenes = [...script.scenes].sort((a, b) => a.scene_number - b.scene_number);
  const duration = voice.duration_seconds;
  const shots = [];
  let globalShot = 0;

  for (let sceneIndex = 0; sceneIndex < orderedScenes.length; sceneIndex++) {
    const scene = orderedScenes[sceneIndex];
    const plan = planByScene.get(scene.scene_number);
    const sentences = sentencesByScene.get(scene.scene_number);
    if (!plan || !sentences?.length) throw new Error(`Missing aligned scene content for chapter ${scene.scene_number}`);

    const start = sceneIndex === 0 ? 0 : sentences[0].start;
    const nextScene = orderedScenes[sceneIndex + 1];
    const nextSentences = nextScene ? sentencesByScene.get(nextScene.scene_number) : undefined;
    const end = nextSentences?.[0]?.start ?? duration;
    const span = end - start;
    const shotCount = Math.max(1, Math.round(span / 4.15));
    const baseDuration = span / shotCount;
    const offsets = Array.from({ length: shotCount }, (_, i) => stableOffset(scene.scene_number, i));
    const offsetMean = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
    let cursor = start;

    for (let shotIndex = 0; shotIndex < shotCount; shotIndex++) {
      const shotStart = cursor;
      const shotEnd = shotIndex === shotCount - 1
        ? end
        : cursor + baseDuration + offsets[shotIndex] - offsetMean;
      const midpoint = (shotStart + shotEnd) / 2;
      const activeSentence = [...sentences].reverse().find((sentence) => sentence.start <= midpoint) ?? sentences[0];
      const exactCue = plan.cues.find((item) => item.sentence_number === activeSentence.sentence_number);
      const nearbyCue = [...plan.cues]
        .map((item) => ({ item, distance: Math.abs(item.sentence_number - activeSentence.sentence_number) }))
        .sort((a, b) => a.distance - b.distance)[0];
      const cue = exactCue ?? (nearbyCue?.distance <= 2 ? nearbyCue.item : undefined);
      const copy = cue?.text ?? exactFragment(activeSentence.text);
      const visualLabels = plan.cues.map((item) => item.text);
      const shot = {
        index: globalShot,
        sceneNumber: scene.scene_number,
        chapter: scene.chapter,
        chapterTitle: plan.title,
        motif: motifs[scene.scene_number],
        start: Number(shotStart.toFixed(4)),
        end: Number(shotEnd.toFixed(4)),
        duration: Number((shotEnd - shotStart).toFixed(4)),
        sentenceNumber: activeSentence.sentence_number,
        spokenText: activeSentence.text,
        copy,
        sourceKeys: scene.source_keys,
        visual: plan.visual,
        description: plan.description,
        visualLabels,
        layout: (scene.scene_number + shotIndex * 2) % layoutNotes.length,
        layoutNote: layoutNotes[(scene.scene_number + shotIndex * 2) % layoutNotes.length],
      };
      if (shot.duration < 2.8 || shot.duration > 5.1) {
        throw new Error(`Shot ${globalShot + 1} is outside the 2.8–5.1 second pacing range.`);
      }
      shots.push(shot);
      globalShot++;
      cursor = shotEnd;
    }
  }

  const compiled = {
    title: script.title,
    fps: 30,
    width: 1920,
    height: 1080,
    durationSeconds: duration,
    audioDurationSeconds: alignment.audio_duration_seconds,
    alignmentMatchRatio: alignment.script_alignment.match_ratio,
    chapterCount: orderedScenes.length,
    shots,
  };

  const chapterHeader = [
    "# PUMP — полный динамичный монтаж",
    "",
    `- Длительность озвучки: ${duration.toFixed(3)} с (13:${String(Math.floor(duration % 3600 / 60)).padStart(2, "0")}:${String(duration % 60).padStart(6, "0")}).`,
    "- Формат: 16:9, 1920×1080, 30 fps.",
    "- Звук: исходная полная дорожка готового фильма — без переозвучки, перестановки реплик и изменения музыки.",
    "- Видеоряд: новые процедурные графические композиции; не используются кадры и карточки старого монтажа.",
    "- Пейсинг: композиция меняется примерно каждые 3–5 секунд; внутри каждой — новые графические и типографические акценты примерно раз в секунду.",
    "- Цифры и утверждения берутся только из размеченного сценария и визуального плана; иллюстративные кривые не подписаны выдуманными значениями.",
    "",
    "## Арт-направление",
    "",
    "Исследовательское финансовое видео на контрасте графитового, молочного, кислотно-жёлтого, кобальтового и кораллового. Короткие русские акценты крупной тяжёлой типографикой; схемы собираются и перестраиваются на экране, токены проходят через механики, а не стоят рядом с текстом. Между главами используются жёсткие смысловые склейки, цветовые переломы, масштабные проходы и перенос графической формы. Без статичных карточек.",
    "",
    `## Полный покадровый план: ${shots.length} композиций`,
    "",
  ];
  const sections = [];
  for (const scene of orderedScenes) {
    const sceneShots = shots.filter((shot) => shot.sceneNumber === scene.scene_number);
    sections.push(`### Глава ${String(scene.scene_number).padStart(2, "0")} — ${scene.chapter}`);
    sections.push("");
    sections.push("| № / таймкод | Текстовый удар | Смысл озвучки | Композиция и движение |");
    sections.push("| --- | --- | --- | --- |");
    for (const shot of sceneShots) {
      const time = `${shot.start.toFixed(2)}–${shot.end.toFixed(2)} с`;
      const spoken = shot.spokenText.replace(/\|/gu, "\\|");
      sections.push(`| ${String(shot.index + 1).padStart(3, "0")} · ${time} | ${shot.copy.replace(/\|/gu, "\\|")} | ${spoken} | ${shot.layoutNote} ${shot.description} |`);
    }
    sections.push("");
  }

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(join(outputDir, "storyboard.json"), `${JSON.stringify(compiled, null, 2)}\n`),
    writeFile(join(outputDir, "SCRIPT.md"), `${chapterHeader.join("\n")}${sections.join("\n")}\n`),
  ]);
  console.log(JSON.stringify({
    storyboard: join(outputDir, "storyboard.json"),
    script: join(outputDir, "SCRIPT.md"),
    chapters: orderedScenes.length,
    shots: shots.length,
    durationSeconds: Number(duration.toFixed(3)),
    minShotSeconds: Math.min(...shots.map((shot) => shot.duration)),
    maxShotSeconds: Math.max(...shots.map((shot) => shot.duration)),
    originalVoiceAlignment: alignment.script_alignment.match_ratio,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});