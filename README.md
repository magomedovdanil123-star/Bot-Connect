# AI Content Factory

AI Content Factory creates reviewed, vertical short-form videos from one topic. It generates a Russian script, lets the creator edit and approve it, then runs the media pipeline: images, voice, music, SFX, dynamic FFmpeg montage, and one-word captions. Finished videos can be sent through Telegram.

## Project layout

- `artifacts/ai-content-factory` — React/Vite studio.
- `artifacts/api-server` — API server, Telegram bot, persisted video pipeline, provider adapters, and FFmpeg renderer.
- `lib/db` — PostgreSQL schema and Drizzle package.
- `lib/api-spec/openapi.yaml` — API contract.

## Run in a new Replit

1. Import this repository into Replit.
2. Install dependencies with `pnpm install`.
3. Create a PostgreSQL database and configure the variables from `.env.example` in Replit Secrets.
4. Run the database schema setup required by the workspace.
5. Start the configured API and web workflows.
6. Open the web artifact or message the configured Telegram bot.

Never commit real API keys, Telegram tokens, database URLs, or object-storage credentials. Use Replit Secrets in the new account.

## Checks

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server run build
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/ai-content-factory run build
```

More operational notes and architecture decisions are in [`replit.md`](./replit.md).