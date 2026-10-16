#!/usr/bin/env bash
# Автообновление: если в GitHub появился новый коммит — забираем его и пересобираем бота.
# Запускается таймером systemd каждые 2 минуты (ставит setup.sh). .env не трогается.
set -e
cd "$(dirname "$0")"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git fetch -q origin "$BRANCH"
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]; then
  echo "$(date '+%F %T') обновление $(git rev-parse --short HEAD) -> $(git rev-parse --short "origin/$BRANCH")"
  git reset -q --hard "origin/$BRANCH"
  docker compose up -d --build
  docker image prune -f >/dev/null
fi
