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

Длительные загрузки исходников нельзя считать возобновляемыми, пока `.part`-файл живёт только в `/tmp`: перезапуск workflow уничтожает точку продолжения.

**Why:** Скачивание Rutube было прервано перезапуском API, после чего временный `.part`-файл и процесс загрузки отсутствовали.

**How to apply:** Для настоящего resume сохранять исходный файл или контрольные данные вне `/tmp` до завершения загрузки; не обещать продолжение после перезапуска без такой точки сохранения.

AI-анализ звукового дизайна не должен быть обязательным условием музыкальной стадии: при ошибке провайдера нужен детерминированный план и локальный музыкальный fallback.

**Why:** Провайдер вернул ошибку уже после успешных сценария, изображений и озвучки, из-за чего первый ролик остановился на `music`, хотя резервная генерация музыки в пайплайне уже предусмотрена.

**How to apply:** Перехватывать ошибку запроса sound design до создания job failure и строить валидный план по таймлайну сцен; SFX могут быть пропущены, но музыка и микс должны продолжать пайплайн.

Для JSON-запросов OpenRouter успешный HTTP-ответ может содержать пустой `message.content`, особенно у reasoning-моделей. Это нужно считать сбоем провайдера: сохранять `finish_reason` и usage для диагностики, снижать reasoning effort у GPT-5 и использовать ограниченный fallback на другой доступной моделью.

**Why:** Реальный запуск horoscope получил три HTTP-успешных, но пустых ответа, из-за чего пакет не создался и Telegram показал только общее сообщение об ошибке.

**How to apply:** Не принимать пустой content как валидный результат; после bounded retries переключать только проблемный запрос на fallback-модель, не меняя состояние уже завершённых стадий.