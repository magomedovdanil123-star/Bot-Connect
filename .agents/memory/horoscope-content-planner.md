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

Для одного Telegram-чата одновременно должна выполняться только одна активная horoscope-очередь; запуск нового daily/weekly режима сначала завершает старую активную очередь, чтобы её поздний ответ не выглядел как результат нового режима.

**Why:** Пересекающиеся запуски могли прислать недельную ошибку после того, как пользователь уже нажал «Гороскоп на сегодня».

**How to apply:** Разделять daily и weekly явными callback-данными и отменять прежние статусы planning/generating/awaiting_video/awaiting_publication перед созданием новой очереди.