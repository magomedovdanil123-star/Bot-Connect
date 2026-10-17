# AI Content Factory (artifacts/api-server) на обычном сервере вместо Replit.
# Сборка из корня репозитория: docker build -f deploy/vps/Dockerfile .
ARG NODE_IMAGE=node:24-trixie-slim
FROM ${NODE_IMAGE}

# ffmpeg (рендер), ImageMagick + rsvg (SVG/PNG), шрифты, Chromium (моушн-студия), python3 + yt-dlp (нарезка по ссылкам)
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg imagemagick librsvg2-bin fontconfig fonts-dejavu-core fonts-liberation chromium \
      python3 python3-pip ca-certificates git \
 && pip3 install --no-cache-dir --break-system-packages yt-dlp \
 && (command -v magick >/dev/null || ln -s "$(command -v convert)" /usr/local/bin/magick) \
 && (command -v convert >/dev/null || ln -s "$(command -v magick)" /usr/local/bin/convert) \
 && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile --filter "@workspace/api-server..." \
 && pnpm --filter @workspace/api-server run build

ENV NODE_ENV=production PORT=8080 CHROMIUM_BIN=/usr/bin/chromium OBJECT_STORAGE_DIR=/data/objects
WORKDIR /app/artifacts/api-server
EXPOSE 8080
CMD ["node", "--enable-source-maps", "dist/index.mjs"]
