# Supabase first-time setup

1. Keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Replit Secrets only.
2. Open the Supabase project SQL Editor.
3. Run `schema.sql` from this directory once.
4. Restart the API workflow.

The API checks for `media_assets` at startup and logs an actionable error if the
schema has not been applied. The Storage bucket is private and is also
re-checked by the API on startup.

The service role key is used only by the API server. Never put it in browser
code, Telegram messages, source control, or `.env.example`.