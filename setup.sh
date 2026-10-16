#!/usr/bin/env bash
# Установка «Моушн-студии» на чистый сервер Ubuntu (Oracle Cloud, любой VPS).
# Запуск: bash setup.sh
set -e
cd "$(dirname "$0")"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "▶ Ставлю Docker…"
  # Сначала пакеты Ubuntu (работают и на самых новых версиях), иначе — официальный установщик
  if ! (sudo apt-get update -q && sudo apt-get install -y -q docker.io docker-compose-v2); then
    curl -fsSL https://get.docker.com | sudo sh
  fi
  sudo systemctl enable --now docker
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
MAX_SCRIPT_CHARS=120000
ENV
fi

echo "▶ Включаю автообновление из GitHub (каждые 2 минуты)…"
DIR="$(pwd)"
sudo tee /etc/systemd/system/motion-bot-update.service >/dev/null <<UNIT
[Unit]
Description=Motion bot: pull updates from GitHub and rebuild
[Service]
Type=oneshot
WorkingDirectory=$DIR
ExecStart=/usr/bin/bash $DIR/update.sh
UNIT
sudo tee /etc/systemd/system/motion-bot-update.timer >/dev/null <<UNIT
[Unit]
Description=Check GitHub for motion bot updates every 2 minutes
[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
UNIT
sudo git config --global --add safe.directory "$DIR"
sudo systemctl daemon-reload
sudo systemctl enable --now motion-bot-update.timer

echo "▶ Собираю и запускаю бота (первый раз 3–7 минут)…"
sudo docker compose up -d --build
sleep 5
sudo docker compose logs --tail 20
echo
echo "✅ Готово. Если выше есть строка «Бот @… запущен» — пиши боту /start."
echo "   Логи: sudo docker compose logs -f    Перезапуск: sudo docker compose restart"
echo "   Автообновление: journalctl -u motion-bot-update -n 20"
