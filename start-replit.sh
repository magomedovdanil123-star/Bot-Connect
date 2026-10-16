#!/usr/bin/env bash
# Запуск бота в Replit. Токены берутся из Secrets (BOT_TOKEN, ALLOWED_USERS, LUMEAN_KEY, LUMEAN_TEMPLATE).
set -e
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
export CHROMIUM_PATH="${CHROMIUM_PATH:-$(command -v chromium || command -v chromium-browser)}"
[ -d node_modules/playwright ] || npm install --ignore-scripts --no-audit --no-fund
echo "Chromium: $CHROMIUM_PATH"
exec node bot.js
