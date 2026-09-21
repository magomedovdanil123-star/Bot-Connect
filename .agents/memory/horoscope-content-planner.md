---
name: Horoscope content planner
description: Durable rules for distributing horoscope content across selected channels.
---

Horoscope generation has two user-facing modes: daily content where AI chooses the concepts, and manual topic where the user topic is a parent direction. Both modes must create one shared plan before individual scripts.

**Why:** A network of channels must not receive the same script with only the zodiac sign changed; manual inputs can also contain locked parameters that must survive distribution.

**How to apply:** Persist planner mode, plan items, and locked/flexible/expandable analysis with the run. Generate each package from its own plan item, validate channel coverage and semantic similarity, and resume planning or generation after API restarts.

Single-channel test runs should continue automatically into project creation, video rendering, Telegram delivery, and publication approval; multi-channel planner runs should not auto-render all videos at once.

**Why:** The operator needs to verify one complete finished roller before spending resources on a 15-channel render.

**How to apply:** Treat a run with one selected channel as the end-to-end smoke path, while keeping larger runs at the content-package stage until explicitly expanded.

The daily horoscope action plans all selected channels together before generating any script. Each channel has exactly three formats derived from its actual channel identity (for example love, finance, tomorrow, weekly, or mystical), never from a numeric connection-id rotation. The planner receives structured per-channel history plus the application's current date, day, month, year, time, and timezone; it varies recent formats and signs and repairs cross-channel semantic duplicates before script generation.

Each daily script starts with the exact dated phrase «Вы нашли это видео DD.MM.YYYY, и это не просто так…», immediately followed by that plan item's unique hook. SEO is generated separately from the full plan and script for every video and includes at least three title variants, one selected title, description, keywords, tags, and hashtags.

Related themes and similar motifs across channels are allowed. Global diversity checks should reject only identical or near-identical packages—especially the same topic, subtopic, angle, hook, and structure with only the zodiac sign replaced. Do not force unrelated themes merely to maximize semantic distance.

Для одного Telegram-чата одновременно должна выполняться только одна активная horoscope-очередь; запуск нового daily/weekly режима сначала завершает старую активную очередь, чтобы её поздний ответ не выглядел как результат нового режима.

**Why:** Пересекающиеся запуски могли прислать недельную ошибку после того, как пользователь уже нажал «Гороскоп на сегодня».

**How to apply:** Разделять daily и weekly явными callback-данными и отменять прежние статусы planning/generating/awaiting_video/awaiting_publication перед созданием новой очереди.