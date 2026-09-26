-- Persist financial Shorts so Telegram can resume after provider or server failures.
CREATE TABLE IF NOT EXISTS public.financial_topic_jobs (
  id serial PRIMARY KEY,
  chat_id bigint NOT NULL,
  topic text NOT NULL,
  category text NOT NULL DEFAULT 'finance',
  cta text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'queued',
  stage text NOT NULL DEFAULT 'planning',
  plan jsonb NOT NULL DEFAULT '{}'::jsonb,
  voice_segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  output_storage_path text,
  duration_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS financial_topic_jobs_chat_status_idx
  ON public.financial_topic_jobs (chat_id, status);