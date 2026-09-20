---
name: Horoscope channel isolation
description: Telegram horoscope content uses a separate persistent channel selection and keeps its target list through publication.
---

Гороскопы используют отдельный persistent-выбор YouTube-каналов, не `activeYoutubeConnectionId` и не общий список каналов публикации. При создании проекта сохраняется снимок выбранных connection IDs; последующие изменения общего выбора не должны расширять список адресатов гороскопа.

**Why:** Пользователь хочет самостоятельно настроить каналы для гороскопов, не меняя привычный Telegram flow и не отправляя гороскопный контент на остальные каналы.

**How to apply:** Новые horoscope callback/pendingAction и таблицы должны оставаться изолированными. Контентный запуск хранит отдельный snapshot конфигурации каждого канала, а анти-повтор проверяет историю всей категории Horoscope, не только текущий канал. На шаге публикации повторно ограничивай доступные каналы сохранённым target-списком и не выбирай все подключённые каналы по умолчанию.