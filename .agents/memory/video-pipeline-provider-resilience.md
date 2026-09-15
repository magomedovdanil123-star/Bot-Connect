---
name: Video pipeline provider resilience
description: Durable provider and retry constraints for the topic-to-video pipeline.
---

Long-running video generation must persist each stage and retry transient provider failures with bounded backoff; completed image, voice, audio, and subtitle stages should be reusable during a retry.

**Why:** Real runs encountered transient OpenRouter rate limits/provider errors and would otherwise fail a later stage despite all earlier artifacts being valid.

**How to apply:** Keep provider retries bounded and explicit, preserve stage outputs, and let a failed job resume from its last completed stage rather than silently regenerating everything.

Для длинных пакетных сценариев запрос к генератору должен иметь лимит не меньше 180 секунд; при таймауте дневной вариант нужно повторять с компактным prompt, а не сразу отменять весь пакет.

**Why:** Пять последовательных чат-вариантов иногда превышают обычный 90-секундный лимит даже при рабочем провайдере.

**How to apply:** Использовать увеличенный timeout для script generation и сохранять понятное сообщение о повторной попытке конкретного варианта.