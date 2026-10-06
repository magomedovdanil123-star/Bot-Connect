import { readAudioAsset, storeAudioAsset } from "../audio-design/storage";
import { logger } from "../logger";
import { getWhaleRadarConfig } from "./config";
import { loadWhaleMarketContext, scanAndPersistWhaleEvents } from "./pipeline";
import {
  createWhaleShortJob,
  getWhaleEvent,
  getWhaleShortJob,
  listWhaleEvents,
  recordWhaleScore,
  saveWhaleScript,
  updateWhaleEventMarketContext,
  updateWhaleScriptVisualPlan,
  updateWhaleShortJob,
} from "./persistence";
import { renderWhaleRadarShort } from "./renderer";
import { buildWhaleYoutubeMetadata } from "./seo";
import { updateWhaleMarketContextScore } from "./scoring";
import { buildWhaleStory, formatWhaleUsd, getPostTradePerformance } from "./story";
import type { WhaleEvent, WhaleStory, WhaleVisualPlan } from "./types";
import { buildWhaleVisualPlan } from "./visual-plan";

type WhaleInlineKeyboard = {
  inline_keyboard: Array<Array<{
    text: string;
    callback_data?: string;
    url?: string;
  }>>;
};

export type WhaleTelegramDependencies = {
  sendMessage: (
    token: string,
    chatId: number,
    text: string,
    replyMarkup?: WhaleInlineKeyboard,
  ) => Promise<void>;
  sendVideo: (
    token: string,
    chatId: number,
    buffer: Buffer,
    caption: string,
    replyMarkup?: WhaleInlineKeyboard,
  ) => Promise<void>;
  runBackground: (task: Promise<void>, context: Record<string, unknown>) => void;
};

function txUrl(event: WhaleEvent): string | null {
  const path = {
    ethereum: "https://etherscan.io/tx/",
    base: "https://basescan.org/tx/",
    arbitrum: "https://arbiscan.io/tx/",
    optimism: "https://optimistic.etherscan.io/tx/",
    polygon: "https://polygonscan.com/tx/",
    bnb: "https://bscscan.com/tx/",
    solana: "https://solscan.io/tx/",
    bitcoin: "https://mempool.space/tx/",
    ton: "https://tonviewer.com/transaction/",
  }[event.blockchain];
  return path ? `${path}${encodeURIComponent(event.transactionHash)}` : null;
}

function formatEventLine(event: WhaleEvent): string {
  const marker = event.action === "BUY" ? "BUY" : event.action === "SELL" ? "SELL" : "TRANSFER";
  return `🐋 ${event.symbol} ${marker} · $${formatWhaleUsd(event.amountUsd)} · ${event.whaleScore}/100`;
}

function eventsKeyboard(events: WhaleEvent[]): WhaleInlineKeyboard {
  return {
    inline_keyboard: [
      ...events.map((event) => [{
        text: formatEventLine(event).slice(0, 62),
        callback_data: `whale:event:${event.id}`,
      }]),
      [{ text: "🔄 Найти сделки Smart Money", callback_data: "whale:scan" }],
      [{ text: "⬅️ Финансы", callback_data: "menu:finance" }],
    ],
  };
}

function formatScore(event: WhaleEvent): string {
  const labels: Array<[keyof WhaleEvent["scoreBreakdown"], string]> = [
    ["sizeScore", "размер сделки"],
    ["smartMoneyScore", "Smart Money"],
    ["unusualActivityScore", "необычность события"],
    ["accumulationScore", "накопление"],
    ["marketContextScore", "контекст рынка"],
    ["walletHistoryScore", "история адреса"],
  ];
  return labels.map(([key, label]) => `${label}: ${event.scoreBreakdown[key]}`).join("\n");
}

function rawExcerpt(value: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(value, null, 2);
  } catch {
    text = String(value);
  }
  return text.length <= 1_200 ? text : `${text.slice(0, 1_200)}…`;
}

function buildReport(event: WhaleEvent, story: WhaleStory, plan: WhaleVisualPlan): string {
  return [
    "🐋 WHALE RADAR · LIVE REPORT",
    "",
    "RAW DATA · NANSEN",
    `Время: ${event.timestamp}`,
    `Сеть: ${event.blockchain}`,
    `Tx: ${event.transactionHash}`,
    "```",
    rawExcerpt(event.rawData),
    "```",
    "",
    "NORMALIZED EVENT",
    `${event.eventType} · ${event.action} · ${event.amount} ${event.symbol}`,
    `Стоимость операции: $${formatWhaleUsd(event.amountUsd)}`,
    `Адрес: ${event.fromAddress ?? "нет"}${event.walletLabel ? ` · метка: ${event.walletLabel}` : " · публичная метка не найдена"}`,
    "",
    `SCORE: ${event.whaleScore}/100`,
    formatScore(event),
    "",
    "SCRIPT",
    story.narration,
    "",
    `VISUAL PLAN · ${plan.format} · ${plan.targetDurationSeconds}s · ${plan.scenes.length} сцен`,
    ...plan.scenes.map((scene, index) => `${index + 1}. ${scene.kind}: ${scene.title} — ${scene.subtitle}`),
    "",
    "Факты основаны на данных Nansen; перевод между адресами не считается продажей.",
  ].join("\n");
}

async function buildAndSendWhaleShort(
  jobId: number,
  token: string,
  chatId: number,
  dependencies: WhaleTelegramDependencies,
): Promise<void> {
  let stage = "loading_event";
  try {
    const job = await getWhaleShortJob(jobId);
    if (!job) throw new Error("Whale Radar job not found.");
    const storedEvent = await getWhaleEvent(job.eventId);
    if (!storedEvent) throw new Error("Whale Radar event not found.");
    await updateWhaleShortJob(jobId, { status: "running", stage, error: null, startedAt: new Date() });

    stage = "market_context";
    let event = await loadWhaleMarketContext(storedEvent);
    const config = getWhaleRadarConfig();
    event = updateWhaleMarketContextScore(event);
    event.passedSignificance = event.amountUsd >= config.minimumUsd && event.whaleScore >= config.minimumScore;
    if (event.id) {
      await updateWhaleEventMarketContext(event.id, event.marketContext, event);
      await recordWhaleScore(event);
    }

    stage = "script";
    let comparisonEvent: WhaleEvent | undefined;
    if (event.action !== "TRANSFER" && getPostTradePerformance(event)) {
      try {
        const candidates = await listWhaleEvents({
          minimumScore: config.minimumScore,
          minimumUsd: config.minimumUsd,
          limit: Math.max(10, config.maximumEvents * 3),
          smartMoneyOnly: true,
        });
        const eventTime = new Date(event.timestamp).getTime();
        const distinctCandidates = candidates
          .filter((candidate) => candidate.id !== event.id
            && candidate.transactionHash !== event.transactionHash
            && candidate.action !== "TRANSFER"
            && Boolean(candidate.marketContext?.candles.length)
            && candidate.symbol.trim().toUpperCase() !== event.symbol.trim().toUpperCase()
            && Math.abs(new Date(candidate.timestamp).getTime() - eventTime) <= 12 * 60 * 60 * 1_000)
          .sort((left, right) =>
            Math.abs(new Date(left.timestamp).getTime() - eventTime)
            - Math.abs(new Date(right.timestamp).getTime() - eventTime)
            || right.whaleScore - left.whaleScore);
        for (const candidate of distinctCandidates) {
          if (getPostTradePerformance(candidate)) {
            comparisonEvent = candidate;
            break;
          }
        }
      } catch (error) {
        logger.warn(
          { err: error, eventId: event.id },
          "[WHALE RADAR] Optional second-coin comparison unavailable; continuing with the selected event.",
        );
      }
    }

    const story = buildWhaleStory(event, comparisonEvent);
    const visualPlan = buildWhaleVisualPlan(event, story, 60, comparisonEvent);
    const metadata = buildWhaleYoutubeMetadata(event);
    const scriptId = event.id
      ? await saveWhaleScript({ eventId: event.id, story, visualPlan, metadata })
      : null;
    await updateWhaleShortJob(jobId, { stage, scriptId });

    stage = "render";
    await updateWhaleShortJob(jobId, { stage });
    const rendered = await renderWhaleRadarShort({ event, comparisonEvent, story, visualPlan });
    const finalVisualPlan = {
      ...visualPlan,
      targetDurationSeconds: Math.round(rendered.durationMs / 1_000),
    };
    if (scriptId) await updateWhaleScriptVisualPlan(scriptId, finalVisualPlan);
    const outputStoragePath = await storeAudioAsset(rendered.buffer, "video", "video/mp4", "mp4");
    await updateWhaleShortJob(jobId, {
      stage: "telegram_delivery",
      outputStoragePath,
      status: "rendered",
    });

    stage = "telegram_delivery";
    const report = buildReport(event, story, finalVisualPlan);
    await dependencies.sendMessage(token, chatId, report);
    const explorerUrl = txUrl(event);
    const keyboard = explorerUrl
      ? { inline_keyboard: [[{ text: "🔎 Проверить транзакцию", url: explorerUrl }]] }
      : undefined;
    await dependencies.sendVideo(
      token,
      chatId,
      rendered.buffer,
      `🐋 Whale Radar · ${event.symbol} · источник: Nansen · не финансовая рекомендация`,
      keyboard,
    );
    await updateWhaleShortJob(jobId, {
      status: "sent",
      stage: "complete",
      completedAt: new Date(),
      error: null,
    });
    logger.info({ jobId, eventId: event.id, durationMs: rendered.durationMs }, "[WHALE RADAR] MP4 sent to the requesting Telegram chat.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Whale Radar pipeline error.";
    await updateWhaleShortJob(jobId, { status: "failed", stage, error: message }).catch((dbError) => {
      logger.error({ err: dbError, jobId }, "[WHALE RADAR] Failed to persist short job error.");
    });
    logger.error({ err: error, jobId, stage }, "[WHALE RADAR] Short generation failed.");
    const keyboard: WhaleInlineKeyboard = {
      inline_keyboard: [[{ text: "🔁 Продолжить Whale Radar", callback_data: `whale:retry:${jobId}` }]],
    };
    await dependencies.sendMessage(
      token,
      chatId,
      `❌ Whale Radar остановлен на этапе ${stage}: ${message}\nСобытие, сценарий и готовые файлы сохраняются, если они уже созданы.`,
      keyboard,
    ).catch(() => undefined);
  }
}

async function retryWhaleShort(
  jobId: number,
  token: string,
  chatId: number,
  dependencies: WhaleTelegramDependencies,
): Promise<void> {
  const job = await getWhaleShortJob(jobId);
  if (!job) throw new Error("Whale Radar job not found.");
  if (job.chatId !== chatId) throw new Error("Этот Whale Radar ролик принадлежит другому чату.");
  if (job.outputStoragePath && job.stage === "telegram_delivery") {
    const event = await getWhaleEvent(job.eventId);
    if (!event) throw new Error("Whale Radar event not found.");
    const buffer = await readAudioAsset(job.outputStoragePath);
    const explorerUrl = txUrl(event);
    const keyboard = explorerUrl
      ? { inline_keyboard: [[{ text: "🔎 Проверить транзакцию", url: explorerUrl }]] }
      : undefined;
    await dependencies.sendVideo(
      token,
      chatId,
      buffer,
      `🐋 Whale Radar · ${event.symbol} · источник: Nansen · не финансовая рекомендация`,
      keyboard,
    );
    await updateWhaleShortJob(jobId, { status: "sent", stage: "complete", completedAt: new Date(), error: null });
    return;
  }
  await buildAndSendWhaleShort(jobId, token, chatId, dependencies);
}

export async function handleWhaleRadarCallback(
  token: string,
  chatId: number,
  data: string,
  dependencies: WhaleTelegramDependencies,
): Promise<boolean> {
  if (!data.startsWith("whale:")) return false;
  const config = getWhaleRadarConfig();
  if (!config.enabled) {
    await dependencies.sendMessage(token, chatId, "Whale Radar отключён в настройках этого окружения.");
    return true;
  }

  if (data === "whale:menu") {
    await dependencies.sendMessage(token, chatId, [
      "🐋 WHALE RADAR",
      "",
      "Отдельный формат для сделок кошельков Smart Money, размеченных Nansen. Большая сумма сама по себе не делает адрес китом.",
      "",
      `Порог операции: $${formatWhaleUsd(config.minimumUsd)} · минимальный score: ${config.minimumScore}/100`,
      "Новый поиск выполняется не чаще раза в 24 часа, чтобы беречь бесплатные кредиты Nansen.",
      "Публикация куда-либо автоматически отключена.",
    ].join("\n"), {
      inline_keyboard: [
        [{ text: "🔎 Найти сделки Smart Money", callback_data: "whale:scan" }],
        [{ text: "📋 Сильные события за 24 часа", callback_data: "whale:latest" }],
        [{ text: "⚙️ Настройки MVP", callback_data: "whale:settings" }],
        [{ text: "⬅️ Финансы", callback_data: "menu:finance" }],
      ],
    });
    return true;
  }

  if (data === "whale:settings") {
    await dependencies.sendMessage(token, chatId, [
      "⚙️ WHALE RADAR · ТЕКУЩИЕ ФИЛЬТРЫ",
      "",
      `Источник: Nansen Smart Money DEX Trades`,
      `Сети: ${config.chains.join(", ")}`,
      `Активы: ${config.assets.length ? config.assets.join(", ") : "все подходящие активы"}`,
      `Минимальная стоимость события: $${formatWhaleUsd(config.minimumUsd)}`,
      `Минимальный score: ${config.minimumScore}/100`,
      `Автопубликация: выключена`,
      "",
      "Nansen ищет размеченные Smart Money DEX-сделки за последние 24 часа. Новый запрос — не чаще раза в 24 часа; свечи загружаются только для выбранного события.",
    ].join("\n"), {
      inline_keyboard: [[{ text: "⬅️ Назад", callback_data: "whale:menu" }]],
    });
    return true;
  }

  if (data === "whale:scan") {
    await dependencies.sendMessage(token, chatId, "🔎 Проверяю сделки размеченных кошельков Smart Money в Nansen. Повторный запрос в течение 24 часов использует сохранённый результат.");
    dependencies.runBackground((async () => {
      try {
        const scanResult = await scanAndPersistWhaleEvents();
        const events = scanResult.events;
        if (!events.length) {
          await dependencies.sendMessage(token, chatId, [
            scanResult.reusedRecentScan
              ? "В сохранённом скане за последние 24 часа не найдено событий, прошедших заданные фильтры."
              : "За последние 24 часа не найдено событий Smart Money, прошедших заданные фильтры.",
            `Фильтры: от $${formatWhaleUsd(config.minimumUsd)} и от ${config.minimumScore}/100.`,
            ...(scanResult.reusedRecentScan
              ? ["Новый запрос к Nansen не отправлялся, чтобы не расходовать ежедневный бесплатный лимит."]
              : []),
            ...(scanResult.warnings.length ? [`Nansen: ${scanResult.warnings.join(" · ").slice(0, 500)}`] : []),
            "Существующие крипто-Shorts и данные не затронуты.",
          ].join("\n"), {
            inline_keyboard: [
              [{ text: "🔄 Повторить сканирование", callback_data: "whale:scan" }],
              [{ text: "⬅️ Назад", callback_data: "whale:menu" }],
            ],
          });
          return;
        }
        await dependencies.sendMessage(
          token,
          chatId,
          [
            scanResult.reusedRecentScan
              ? `Показываю ${events.length} сохранённых событий Smart Money — новый запрос к Nansen не отправлялся. Выберите событие:`
              : `Nansen нашёл ${events.length} проверяемых сделок размеченных Smart Money-кошельков. Выберите событие:`,
            ...(scanResult.warnings.length ? [`Nansen: ${scanResult.warnings.join(" · ").slice(0, 500)}`] : []),
          ].join("\n"),
          eventsKeyboard(events),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Неизвестная ошибка Nansen.";
        await dependencies.sendMessage(token, chatId, `❌ Сканирование Whale Radar не удалось: ${message}`, {
          inline_keyboard: [[{ text: "🔁 Повторить", callback_data: "whale:scan" }]],
        }).catch(() => undefined);
      }
    })(), { chatId, task: "whale-radar-nansen-scan" });
    return true;
  }

  if (data === "whale:latest") {
    const events = await listWhaleEvents({
      minimumScore: config.minimumScore,
      minimumUsd: config.minimumUsd,
      limit: config.maximumEvents,
      smartMoneyOnly: true,
    });
    await dependencies.sendMessage(
      token,
      chatId,
      events.length ? "Выберите сохранённое проверяемое событие:" : "Сохранённых сильных событий за последние 24 часа пока нет.",
      eventsKeyboard(events),
    );
    return true;
  }

  const eventMatch = /^whale:event:(\d+)$/.exec(data);
  if (eventMatch) {
    const event = await getWhaleEvent(Number(eventMatch[1]));
    if (!event) throw new Error("Событие Whale Radar не найдено.");
    const explorerUrl = txUrl(event);
    const keyboard: WhaleInlineKeyboard = {
      inline_keyboard: [
        [{ text: "🎬 Создать отдельный Shorts", callback_data: `whale:create:${event.id}` }],
        ...(explorerUrl ? [[{ text: "🔎 Проверить исходную транзакцию", url: explorerUrl }]] : []),
        [{ text: "⬅️ К событиям", callback_data: "whale:latest" }],
      ],
    };
    await dependencies.sendMessage(token, chatId, [
      "🐋 СОБЫТИЕ WHALE RADAR",
      "",
      `Тип: ${event.eventType} · ${event.action}`,
      `Актив: ${event.amount.toLocaleString("ru-RU", { maximumFractionDigits: 4 })} ${event.symbol}`,
      `Стоимость операции: $${formatWhaleUsd(event.amountUsd)}`,
      `Сеть: ${event.blockchain}`,
      `Время UTC: ${event.timestamp}`,
      `Кошелёк: ${event.fromAddress ?? "нет адреса"}${event.walletLabel ? ` · ${event.walletLabel}` : " · без публичной метки"}`,
      `Tx hash: ${event.transactionHash}`,
      "",
      `Whale Score: ${event.whaleScore}/100`,
      formatScore(event),
      "",
      "Исходные поля Nansen:",
      rawExcerpt(event.rawData),
    ].join("\n"), keyboard);
    return true;
  }

  const createMatch = /^whale:create:(\d+)$/.exec(data);
  if (createMatch) {
    const eventId = Number(createMatch[1]);
    const event = await getWhaleEvent(eventId);
    if (!event) throw new Error("Событие Whale Radar не найдено.");
    const jobId = await createWhaleShortJob(eventId, chatId);
    await dependencies.sendMessage(
      token,
      chatId,
      "🎬 Создаю отдельный Whale Radar Short до 60 секунд: добавлю разбор сделки, график цены после неё и сравнение со второй монетой, если в данных Nansen найдётся подходящее подтверждённое событие. Публикация на канал не запускается.",
    );
    dependencies.runBackground(
      buildAndSendWhaleShort(jobId, token, chatId, dependencies),
      { chatId, jobId, task: "whale-radar-render" },
    );
    return true;
  }

  const retryMatch = /^whale:retry:(\d+)$/.exec(data);
  if (retryMatch) {
    const jobId = Number(retryMatch[1]);
    await dependencies.sendMessage(token, chatId, "▶️ Продолжаю Whale Radar из сохранённого состояния.");
    dependencies.runBackground(
      retryWhaleShort(jobId, token, chatId, dependencies).catch(async (error) => {
        const message = error instanceof Error ? error.message : "Не удалось продолжить Whale Radar.";
        await dependencies.sendMessage(token, chatId, `❌ ${message}`).catch(() => undefined);
        throw error;
      }),
      { chatId, jobId, task: "whale-radar-resume" },
    );
    return true;
  }

  await dependencies.sendMessage(token, chatId, "Неизвестное действие Whale Radar. Откройте меню заново.");
  return true;
}
