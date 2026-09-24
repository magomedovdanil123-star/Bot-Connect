-- Keep the three most recent user-entered financial CTAs per Telegram chat.
ALTER TABLE public.telegram_chat_preferences
  ADD COLUMN IF NOT EXISTS financial_cta_history text;