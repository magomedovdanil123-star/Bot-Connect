#!/usr/bin/env bash
# Установка «Моушн-студии» на чистый сервер Ubuntu (Oracle Cloud, любой VPS).
# Запуск: bash setup.sh
set -e
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1; then
  echo "▶ Ставлю Docker…"
  curl -fsSL https://get.docker.com | sudo sh
fi

if [ ! -f .env ]; then
  echo
  echo "▶ Настройка бота (данные сохранятся только на этом сервере, в файле .env)"
  read -rp "Токен бота от @BotFather: " BOT_TOKEN
  read -rp "Твой Telegram id (только он сможет пользоваться ботом): " ALLOWED
  read -rp "Ключ Lumean API (Enter — без озвучки): " LKEY
  LTPL=""
  if [ -n "$LKEY" ]; then
    read -rp "Шаблон Lumean [01a0c3c1-1599-7331-846c-2796f7ec3f10]: " LTPL
    LTPL="${LTPL:-01a0c3c1-1599-7331-846c-2796f7ec3f10}"
  fi
  umask 077
  cat > .env <<ENV
BOT_TOKEN=$BOT_TOKEN
ALLOWED_USERS=$ALLOWED
LUMEAN_KEY=$LKEY
LUMEAN_TEMPLATE=$LTPL
MAX_SCRIPT_CHARS=8000
ENV
fi

echo "▶ Собираю и запускаю бота (первый раз 3–7 минут)…"
sudo docker compose up -d --build
sleep 5
sudo docker compose logs --tail 20
echo
echo "✅ Готово. Если выше есть строка «Бот @… запущен» — пиши боту /start."
echo "   Логи: sudo docker compose logs -f    Перезапуск: sudo docker compose restart"
