-- Remember when a financial Short must bypass depleted paid TTS providers on retry.
ALTER TABLE public.financial_topic_jobs
  ADD COLUMN IF NOT EXISTS use_free_voice boolean NOT NULL DEFAULT false;