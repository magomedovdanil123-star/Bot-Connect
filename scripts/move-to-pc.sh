#!/usr/bin/env bash
# Переезд бота с сервера на свой компьютер (Windows → Ubuntu в WSL). Запуск в окне Ubuntu:
#   bash move-to-pc.sh IP_СЕРВЕРА
# Пароль root от сервера спросит один раз. Бот на сервере останавливается (два бота с одним токеном не работают),
# вся папка бота — код, .env с ключами, data со статистикой, каналами и готовыми роликами — копируется сюда, и бот запускается уже на компьютере.
set -e
IP="$1"; [ -n "$IP" ] || { echo "Укажи IP сервера: bash move-to-pc.sh 1.2.3.4"; exit 1; }
SSH="ssh -o ControlMaster=auto -o ControlPath=/tmp/move-%r@%h -o ControlPersist=10m -o StrictHostKeyChecking=accept-new root@$IP"
command -v ssh >/dev/null || sudo apt-get install -y -q openssh-client
echo "▶ Ищу бота на сервере (спросит пароль root от сервера)…"
REMOTE=$($SSH 'f=$(ls -d /root/*/bot.js /home/*/*/bot.js /opt/*/bot.js 2>/dev/null | head -1); [ -n "$f" ] && dirname "$f"')
[ -n "$REMOTE" ] || { echo "Не нашёл папку бота на сервере"; exit 1; }
NAME=$(basename "$REMOTE"); PARENT=$(dirname "$REMOTE")
[ ! -e ~/"$NAME" ] || { echo "Папка ~/$NAME уже есть на компьютере — переименуй её и запусти снова"; exit 1; }
echo "▶ Нашёл: $REMOTE. Останавливаю бота на сервере…"
$SSH "systemctl disable --now motion-bot-update.timer 2>/dev/null || true; cd '$REMOTE' && docker compose down"
echo "▶ Копирую бота, ключи и данные (может занять несколько минут)…"
$SSH "cd '$PARENT' && tar czf - --exclude='$NAME/node_modules' --exclude='$NAME/out' '$NAME'" | tar xzf - -C ~
$SSH -O exit 2>/dev/null || true
echo "▶ Запускаю бота на компьютере…"
cd ~/"$NAME" && bash setup.sh
echo "✅ Готово: бот работает на компьютере. Окно Ubuntu не закрывай, пока идёт сборка; компьютер не усыпляй."
