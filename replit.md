# AI Content Factory

AI Content Factory turns a topic into a reviewed vertical short video: it drafts a Russian script, waits for approval, generates visuals and voice, designs music/SFX, renders dynamic FFmpeg motion, adds one-word captions, and can deliver the MP4 through Telegram.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server on port 8080
- `pnpm --filter @workspace/ai-content-factory run dev` — run the web studio
- `pnpm run typecheck` — full typecheck across all packages
- `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/ai-content-factory run build` — build the web studio
- `pnpm --filter @workspace/api-server run build` — build the API server
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required environment variables are listed in `.env.example`. Keep real values in Replit Secrets, never in Git.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/ai-content-factory` — React/Vite web studio.
- `artifacts/api-server` — API, persisted pipeline orchestration, Telegram bot, providers, and FFmpeg renderer.
- `lib/db` — Drizzle schema and database package.
- `lib/api-spec/openapi.yaml` — API contract source of truth.
- `lib/api-client-react` and `lib/api-zod` — generated API clients and validators.
- `artifacts/api-server/src/lib/video-pipeline` — script approval, image/voice/audio stages, Dynamic Shorts rendering, and word captions.

## Architecture decisions

- New projects are created as `draft`; media generation starts only after explicit script approval.
- Lumean is the active Voice API backend when `LUMEAN_API_KEY` is present. The legacy
  `voice_api` route is intentionally retained as a compatibility alias so saved Telegram
  voice preferences continue to work, while synthesis is sent to Lumean. Templates are
  reused by a deterministic voice/model/settings signature (or `LUMEAN_TEMPLATE_ID`).
- The regular Telegram video flow generates YouTube title, description, tags, and hashtags
  automatically after rendering, sends the MP4 with the metadata preview, and then offers
  channel selection. The regular flow no longer asks for manual metadata.
- Video output is vertical 1080×1920 H.264/AAC with FFmpeg motion, transitions, music/SFX, and one-word ASS captions.
- OpenRouter currently handles script generation and the stable image fallback; image providers can be changed in the provider modules without changing the UI flow.
- Subtitle text is generated from the saved scene voice timing, so changing voice text requires regenerating that scene's voice before rendering.

## Product

- Create a short-form video brief for TikTok, Instagram Reels, or YouTube Shorts.
- Choose duration, format, visual style, and narrative tone.
- Review and edit the generated script before any expensive media generation.
- Approve the script, monitor each pipeline stage, and download the finished MP4.
- Create the same draft → edit → approve flow from Telegram.
- The web studio complements Telegram; do not change the Telegram flow or Telegram UX unless explicitly requested.

## User preferences

- Keep the current visual language, pipeline behavior, and provider setup stable when making future changes.
- Do not reintroduce subtitles as a separate SRT artifact; captions are burned into the final MP4 when rendering.
- Finance and crypto publications in every format must not include the Vibe Bot profile-service comment or its account/hashtag tags, whether generated, edited, or uploaded.
- Use the user-provided Lumean “Для сна” template `01a0c3c1-1599-7331-846c-2796f7ec3f10` through `LUMEAN_TEMPLATE_ID`; do not reuse the earlier UUID from the old bot. Requested settings: model `eleven_v3`, voice `BTL5iDLqtiUxgJtpekus`, stability 1, similarity 1, speaker boost on, speed 0.9, style 0.9; chunk size 2000, inter-chunk pause on at 0.4 seconds, watermark removal off, provider subtitles off. Enable advanced voice settings when configuring the provider template. Test synthesis succeeded, but remote template settings remain unverified because template reading returns 403.

## Gotchas

- Configure `DATABASE_URL`, object storage variables, provider keys, `SESSION_SECRET`, and `TELEGRAM_BOT_TOKEN` through Replit Secrets.
- After changing API code, restart the API Server workflow; after changing frontend code, restart the web workflow.
- Run `pnpm run typecheck` plus the relevant build before committing.
- Do not commit `.env`, generated `dist`, `node_modules`, or provider credentials.
- The private YouTube uploader requires a Google Cloud OAuth web client and a base64-encoded 32-byte `YOUTUBE_TOKEN_ENCRYPTION_KEY`; uploads default to `private`.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
