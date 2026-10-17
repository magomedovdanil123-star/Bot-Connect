#!/usr/bin/env bash
# Включает озвучку клоном голоса на этом сервере (VoiceStudio в Docker, без видеокарты).
# Запуск один раз: bash voice-server.sh   Дальше всё обновляется само вместе с ботом.
set -e
cd "$(dirname "$0")"
[ -f .env ] || { echo "Сначала установите бота: bash setup.sh"; exit 1; }

MEM=$(awk '/MemTotal/ {printf "%d", $2/1024/1024 + 0.5}' /proc/meminfo)
FREE=$(df -BG --output=avail . | tail -1 | tr -dc 0-9)
echo "▶ Память: ${MEM} ГБ, свободно на диске: ${FREE} ГБ"
if [ "$MEM" -lt 7 ]; then
  echo "⚠️  Мало памяти: VoiceStudio нужно минимум 8 ГБ ОЗУ (рекомендуется 16)."
  echo "   Увеличьте тариф сервера в панели Timeweb и запустите скрипт снова."
  exit 1
fi
if [ "$FREE" -lt 15 ]; then echo "⚠️  Нужно минимум 15 ГБ свободного места (образ ~5 ГБ + модели ~4 ГБ)."; exit 1; fi

set_env() { grep -q "^$1=" .env && sed -i "s|^$1=.*|$1=$2|" .env || echo "$1=$2" >> .env; }
grep -q '^VOICESTUDIO_TOKEN=' .env || set_env VOICESTUDIO_TOKEN "$(head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)"
set_env VOICESTUDIO_URL http://voicestudio:3900
set_env COMPOSE_PROFILES voice
# оставляем запас памяти боту и системе
LIMIT=$(( MEM - 3 )); [ "$LIMIT" -gt 12 ] && LIMIT=12; [ "$LIMIT" -lt 6 ] && LIMIT=6
set_env VOICESTUDIO_MEM "${LIMIT}g"
chmod 600 .env

echo "▶ Скачиваю VoiceStudio (~5 ГБ, 5–15 минут)…"
sudo docker compose pull voicestudio
sudo docker compose up -d
echo
echo "✅ Сервис озвучки запущен. При первом старте он ещё скачает модели (~4 ГБ, до 15 минут)."
echo "   Прогресс: sudo docker compose logs -f voicestudio"
echo "   Дальше в боте: /clone и пришлите запись голоса — клон создастся один раз и будет использоваться всегда."
