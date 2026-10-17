#!/usr/bin/env bash
# Однократная установка AI Content Factory на сервер (рядом с моушн-ботом). Запуск: bash deploy/vps/setup.sh
set -e
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
command -v docker >/dev/null || { apt-get update && apt-get install -y docker.io docker-compose-v2 || curl -fsSL https://get.docker.com | sh; }
mkdir -p .vps-data/objects
# секрет для подписи ссылок и публичный адрес сервера (для ссылок на скачивание больших видео)
if [ ! -f deploy/vps/local.env ]; then
  IP=$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')
  printf 'SESSION_SECRET=%s\nPUBLIC_APP_URL=http://%s:8080\n' "$(openssl rand -hex 32)" "$IP" > deploy/vps/local.env
  chmod 600 deploy/vps/local.env
fi
chmod +x deploy/vps/update.sh
docker compose -f deploy/vps/docker-compose.yml up -d --build
# автообновление каждые 2 минуты
cat > /etc/systemd/system/ai-factory-update.service <<UNIT
[Unit]
Description=AI Content Factory auto-update
[Service]
Type=oneshot
ExecStart=$ROOT/deploy/vps/update.sh
UNIT
cat > /etc/systemd/system/ai-factory-update.timer <<UNIT
[Unit]
Description=AI Content Factory auto-update timer
[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload && systemctl enable --now ai-factory-update.timer
echo "Готово. Логи: docker compose -f deploy/vps/docker-compose.yml logs -f --tail=50"
