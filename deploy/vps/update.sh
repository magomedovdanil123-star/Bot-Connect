#!/usr/bin/env bash
# Автообновление AI Content Factory: новый коммит в GitHub — пересборка; изменились ключи — перезапуск.
set -e
cd "$(dirname "$0")/../.."
BRANCH=$(git rev-parse --abbrev-ref HEAD)
COMPOSE="docker compose -f deploy/vps/docker-compose.yml"
KEYS="${FACTORY_KEYS:-/root/motion-bot/data/ai-factory.env}"
git fetch -q origin "$BRANCH"
if [ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]; then
  echo "$(date '+%F %T') обновление $(git rev-parse --short HEAD) -> $(git rev-parse --short "origin/$BRANCH")"
  git reset -q --hard "origin/$BRANCH"
  $COMPOSE up -d --build
  docker image prune -f >/dev/null
fi
SUM=$( [ -f "$KEYS" ] && sha256sum "$KEYS" | cut -d' ' -f1 || echo none )
if [ "$SUM" != "$(cat .vps-keys.sha 2>/dev/null)" ]; then
  echo "$(date '+%F %T') ключи изменились — перезапуск"
  $COMPOSE up -d --force-recreate
  echo "$SUM" > .vps-keys.sha
fi
