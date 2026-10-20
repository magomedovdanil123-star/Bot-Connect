#!/usr/bin/env bash
# Автообновление: если в GitHub новый коммит или прошлая сборка не удалась — забираем код и пересобираем бота.
# Запускается таймером systemd каждые 2 минуты (ставит setup.sh). .env не трогается.
# .deployed — какой коммит реально работает в контейнере: если сборка упала (место, сеть), он не обновится
# и следующий запуск попробует снова, а не будет вечно считать, что всё уже обновлено.
set -e
cd "$(dirname "$0")"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git fetch -q origin "$BRANCH"
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]; then
  echo "$(date '+%F %T') код $(git rev-parse --short HEAD) -> $(git rev-parse --short "origin/$BRANCH")"
  git reset -q --hard "origin/$BRANCH"
fi
# /update в боте кладёт data/update-now: обновиться и перезапуститься сразу, даже посреди сборки (сборку потом можно продолжить)
FORCE=0; if [ -f data/update-now ]; then rm -f data/update-now; FORCE=1; fi
# сборка висит дольше 90 минут (зависла) — тоже не ждём, иначе обновление не приедет никогда
STALE=0; if [ -f data/job.json ] && [ $(( $(date +%s) - $(stat -c %Y data/job.json) )) -gt 5400 ]; then STALE=1; fi
if [ "$FORCE" = 1 ] && [ "$(git rev-parse HEAD)" = "$(cat .deployed 2>/dev/null)" ]; then
  echo "$(date '+%F %T') /update: код свежий — перезапускаю бота"; rm -f data/busy; docker compose restart motion-bot; exit 0
fi
if [ "$(git rev-parse HEAD)" != "$(cat .deployed 2>/dev/null)" ]; then
  # идёт сборка ролика (бот обновляет data/busy каждые 30 с) — не перезапускаем, обновимся сразу после
  if [ "$FORCE" = 0 ] && [ "$STALE" = 0 ] && [ -f data/busy ] && [ $(( $(date +%s) - $(stat -c %Y data/busy) )) -lt 180 ]; then echo "$(date '+%F %T') идёт сборка ролика — обновлюсь после (/update в боте — сразу)"; exit 0; fi
  echo "$(date '+%F %T') сборка $(git rev-parse --short HEAD)"
  echo "$(git rev-parse --short HEAD) $(git log -1 --format=%cd --date=format:'%d.%m %H:%M')" > VERSION
  docker image prune -f >/dev/null || true   # место под новый образ
  docker compose up -d --build
  git rev-parse HEAD > .deployed
  echo "$(date '+%F %T') готово: работает $(cat VERSION)"
fi
