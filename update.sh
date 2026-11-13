#!/usr/bin/env bash
# Автообновление: если в GitHub новый коммит или прошлая сборка не удалась — забираем код и пересобираем бота.
# Запускается таймером systemd каждые 2 минуты (ставит setup.sh). .env не трогается.
# .deployed — какой коммит реально работает в контейнере: если сборка упала (место, сеть), он не обновится
# и следующий запуск попробует снова, а не будет вечно считать, что всё уже обновлено.
set -e
cd "$(dirname "$0")"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
git fetch -q origin "$BRANCH"
# 💾 места на диске меньше 3 ГБ — чистим кэш сборки Docker, висячие образы и раздутые логи контейнеров (бот при этом сам чистит свои старые файлы сборки)
( set +e
  FREE=$(df -Pk . | awk 'NR==2{print int($4/1048576)}')
  if [ "${FREE:-99}" -lt 3 ]; then
    echo "$(date '+%F %T') мало места: ${FREE} ГБ — чищу кэш Docker"
    docker builder prune -af >/dev/null 2>&1; docker image prune -af >/dev/null 2>&1   # все образы, которыми не пользуется ни один контейнер
    journalctl --vacuum-size=200M >/dev/null 2>&1; apt-get clean >/dev/null 2>&1
    find /var/lib/docker/containers -name '*-json.log' -size +100M -exec truncate -s 0 {} \; 2>/dev/null
  fi ) || true
# 📥 Готовые ролики для владельца: файлы из папки send/ ветки media (видео, обложки, тексты) → data/inbox; бот сам пришлёт их в Telegram.
# Не мешает обновлению: любая ошибка здесь пропускается.
( set +e
  git fetch -q origin media 2>/dev/null || exit 0
  mkdir -p data/inbox && touch data/inbox/.got
  git ls-tree -r --name-only origin/media 2>/dev/null | grep '^send/' | while IFS= read -r f; do
    grep -qxF "$f" data/inbox/.got && continue
    out="data/inbox/$(printf '%s' "${f#send/}" | tr '/' '_')"
    git show "origin/media:$f" > "$out.part" && mv "$out.part" "$out" && printf '%s\n' "$f" >> data/inbox/.got
  done ) || true
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
  docker builder prune -f --filter until=72h >/dev/null 2>&1 || true   # старый кэш сборки — в мусор
  git rev-parse HEAD > .deployed
  echo "$(date '+%F %T') готово: работает $(cat VERSION)"
fi
