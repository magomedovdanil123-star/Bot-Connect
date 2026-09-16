---
name: Story pipeline architecture
description: Durable rules for Telegram story batches, per-channel variants, and single-background rendering.
---

Истории в Telegram должны оставаться отдельной веткой, а не переиспользовать `chat_day`: пакет и варианты хранятся в БД, каждый канал получает свой проект и job, а готовые строки `generated_images` с одним общим storage path не запускают image-generation. Выбранный баннер передаётся в renderer через metadata проекта.

**Why:** `chat_day` жёстко рассчитан на пять чат-роликов, а история требует количества вариантов по каналам, отдельной озвучки и пользовательской проверки каждого MP4.

**How to apply:** Новые действия истории привязывать к `story_batches`/`story_batch_items`; постоянное состояние не держать в in-memory maps, а визуальный баннер добавлять только через story-specific renderer parameters.