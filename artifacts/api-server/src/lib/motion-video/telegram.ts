// Кнопка «🎬 Моушн-студия»: свой сценарий -> моушн-видео 16:9 (тёмная сетка, неон, кинетическая типографика).
// Изолированный модуль: из общего проекта используется только озвучка (через motion-video/index.ts).
import { logger } from "../logger";
import { createMotionVideo, MAX_MOTION_SCRIPT_CHARACTERS, previewMotionPlan } from "./index";

type MotionKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data?: string }>> };

export type MotionTelegramDependencies = {
  sendMessage: (token: string, chatId: number, text: string, replyMarkup?: MotionKeyboard) => Promise<void>;
  sendVideo: (token: string, chatId: number, buffer: Buffer, caption: string, replyMarkup?: MotionKeyboard) => Promise<void>;
  setPendingAction: (chatId: number, pendingAction: string | null) => Promise<void>;
  runBackground: (task: Promise<void>, context: Record<string, unknown>) => void;
};

const PENDING_VOICE = "motion_studio_script:voice";
const PENDING_SILENT = "motion_studio_script:silent";
const MIN_SCRIPT_WORDS = 5;

// Рендер тяжёлый по CPU — выполняем ролики по одному
let renderChain: Promise<void> = Promise.resolve();
let queued = 0;

const menuKeyboard = (): MotionKeyboard => ({
  inline_keyboard: [
    [{ text: "🎙 Сценарий + озвучка", callback_data: "motion:start:voice" }],
    [{ text: "🔇 Сценарий без озвучки", callback_data: "motion:start:silent" }],
    [{ text: "ℹ️ Как писать сценарий", callback_data: "motion:help" }],
    [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
  ],
});

const afterKeyboard = (): MotionKeyboard => ({
  inline_keyboard: [
    [{ text: "🎬 Ещё ролик", callback_data: "motion:menu" }],
    [{ text: "⬅️ Главное меню", callback_data: "menu:home" }],
  ],
});

const HELP_TEXT = [
  "ℹ️ КАК ПИСАТЬ СЦЕНАРИЙ",
  "",
  "Пишите текст диктора как есть — каждое предложение станет отдельной сценой.",
  "• Год («в 2011 году») → таймлайн. Число («5 миллионов») → счётчик.",
  "• «с 8 до 200» → было/стало. «у X …, то у Y …» → сравнение полосами.",
  "• Несколько вопросов подряд → анкета. «Первая причина — …» → заставка главы.",
  "• Перечисление через запятую → схема. Рост/ракета → график роста, падение → график отставания.",
  "• Короткая фраза («Но подожди.») → крупный заголовок с глитчем.",
  "• «подписывайся», «ссылка в шапке профиля», «не финансовая рекомендация» → готовые концовки.",
  "• Названия латиницей (Bitcoin, ETF) и числа подсвечиваются автоматически.",
  "",
  `Формат: 16:9, 1920×1080. Лимит — ${MAX_MOTION_SCRIPT_CHARACTERS} символов.`,
].join("\n");

export async function showMotionStudioMenu(token: string, chatId: number, deps: MotionTelegramDependencies): Promise<void> {
  await deps.setPendingAction(chatId, null);
  await deps.sendMessage(token, chatId, [
    "🎬 МОУШН-СТУДИЯ",
    "",
    "Пришлите свой сценарий — соберу моушн-ролик 16:9: тёмная сетка, неоновые акценты, кинетическая типографика, схемы, графики и счётчики под каждую фразу.",
    "С озвучкой ролик подстраивается под голос: сцены меняются точно по фразам диктора.",
  ].join("\n"), menuKeyboard());
}

export async function handleMotionCallback(
  token: string,
  chatId: number,
  data: string,
  deps: MotionTelegramDependencies,
): Promise<boolean> {
  if (!data.startsWith("motion:")) return false;
  if (data === "motion:menu") {
    await showMotionStudioMenu(token, chatId, deps);
  } else if (data === "motion:help") {
    await deps.sendMessage(token, chatId, HELP_TEXT, menuKeyboard());
  } else if (data === "motion:start:voice" || data === "motion:start:silent") {
    const voice = data.endsWith(":voice");
    await deps.setPendingAction(chatId, voice ? PENDING_VOICE : PENDING_SILENT);
    await deps.sendMessage(token, chatId, [
      `✍️ Пришлите сценарий одним сообщением${voice ? " — озвучу его вашим голосом из настроек бота" : ""}.`,
      "",
      `Лимит — ${MAX_MOTION_SCRIPT_CHARACTERS} символов. Для отмены отправьте /cancel.`,
    ].join("\n"));
  } else {
    await showMotionStudioMenu(token, chatId, deps);
  }
  return true;
}

/** Возвращает true, если сообщение было сценарием для Моушн-студии. */
export async function handleMotionPendingText(
  token: string,
  chatId: number,
  pendingAction: string | null | undefined,
  text: string,
  deps: MotionTelegramDependencies,
): Promise<boolean> {
  if (pendingAction !== PENDING_VOICE && pendingAction !== PENDING_SILENT) return false;
  const script = text.trim();
  if (script.length > MAX_MOTION_SCRIPT_CHARACTERS) {
    await deps.sendMessage(token, chatId, `Сценарий слишком длинный: ${script.length} символов (лимит ${MAX_MOTION_SCRIPT_CHARACTERS}). Сократите и отправьте ещё раз или /cancel.`);
    return true;
  }
  if (script.split(/\s+/u).filter(Boolean).length < MIN_SCRIPT_WORDS) {
    await deps.sendMessage(token, chatId, "Слишком короткий сценарий. Нужно хотя бы одно полноценное предложение. Отправьте ещё раз или /cancel.");
    return true;
  }
  const voice = pendingAction === PENDING_VOICE;
  await deps.setPendingAction(chatId, null);

  const plan = await previewMotionPlan(script);
  const estimatedSeconds = Math.round(plan.scenes.reduce((sum, scene) => sum + Math.max(2.4, scene.text.length / 14.5 + 0.8), 0));
  const position = queued;
  queued++;
  await deps.sendMessage(token, chatId, [
    `✅ Сценарий принят: ${plan.scenes.length} сцен, ролик ≈ ${estimatedSeconds} сек${voice ? " (точная длина — по озвучке)" : ""}.`,
    position ? `⏳ Перед вами в очереди: ${position}.` : "⚙️ Начинаю сборку.",
  ].join("\n"));

  const job = renderChain.then(() => runMotionJob(token, chatId, script, voice, deps)).finally(() => { queued--; });
  renderChain = job.catch(() => undefined);
  deps.runBackground(job, { chatId, task: "motion-studio", voice, scenes: plan.scenes.length });
  return true;
}

async function runMotionJob(
  token: string,
  chatId: number,
  script: string,
  voice: boolean,
  deps: MotionTelegramDependencies,
): Promise<void> {
  const startedAt = Date.now();
  let lastReported = 0;
  try {
    const result = await createMotionVideo(script, {
      voice,
      onStage: (stage) => {
        if (stage.stage !== "render") return;
        const percent = Math.floor(stage.progress * 100);
        if (percent >= lastReported + 25 && percent < 100) {
          lastReported = percent - (percent % 25);
          logger.info({ chatId, percent }, "Motion studio render progress");
        }
      },
    });
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    await deps.sendVideo(
      token,
      chatId,
      result.buffer,
      `🎬 Моушн-ролик готов: ${result.sceneCount} сцен, ${Math.round(result.durationSeconds)} сек${result.voiced ? ", с озвучкой" : ""}. Сборка заняла ${seconds} сек.`,
      afterKeyboard(),
    );
  } catch (error) {
    logger.error({ err: error, chatId }, "Motion studio render failed");
    await deps.sendMessage(
      token,
      chatId,
      `❌ Не удалось собрать моушн-ролик: ${error instanceof Error ? error.message.slice(0, 400) : "неизвестная ошибка"}`,
      afterKeyboard(),
    ).catch(() => undefined);
    throw error;
  }
}
