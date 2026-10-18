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
if [ "$(git rev-parse HEAD)" != "$(cat .deployed 2>/dev/null)" ]; then
  echo "$(date '+%F %T') сборка $(git rev-parse --short HEAD)"
  echo "$(git rev-parse --short HEAD) $(git log -1 --format=%cd --date=format:'%d.%m %H:%M')" > VERSION
  docker image prune -f >/dev/null || true   # место под новый образ
  docker compose up -d --build
  git rev-parse HEAD > .deployed
  echo "$(date '+%F %T') готово: работает $(cat VERSION)"
fi
