BEGIN;

CREATE TABLE IF NOT EXISTS whale_events (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  deduplication_key TEXT NOT NULL UNIQUE,
  event_timestamp TIMESTAMPTZ NOT NULL,
  blockchain TEXT NOT NULL,
  asset TEXT NOT NULL,
  symbol TEXT NOT NULL,
  token_address TEXT,
  action TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  amount_usd DOUBLE PRECISION NOT NULL,
  price_usd DOUBLE PRECISION,
  from_address TEXT,
  to_address TEXT,
  from_label TEXT,
  to_label TEXT,
  wallet_type TEXT,
  wallet_label TEXT,
  transaction_hash TEXT NOT NULL,
  dex TEXT,
  exchange TEXT,
  confidence_score INTEGER NOT NULL,
  whale_score INTEGER NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL,
  previous_activity JSONB NOT NULL DEFAULT '[]'::jsonb,
  market_context JSONB,
  data_sources JSONB NOT NULL DEFAULT '["nansen"]'::jsonb,
  raw_data JSONB NOT NULL,
  passed_significance BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whale_events_time_idx
  ON whale_events (event_timestamp DESC);
CREATE INDEX IF NOT EXISTS whale_events_score_idx
  ON whale_events (whale_score DESC, amount_usd DESC);
CREATE INDEX IF NOT EXISTS whale_events_asset_time_idx
  ON whale_events (blockchain, symbol, event_timestamp DESC);

CREATE TABLE IF NOT EXISTS whale_transactions (
  id SERIAL PRIMARY KEY,
  blockchain TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whale_transactions_chain_hash_uidx UNIQUE (blockchain, transaction_hash)
);

CREATE TABLE IF NOT EXISTS whale_wallets (
  id SERIAL PRIMARY KEY,
  blockchain TEXT NOT NULL,
  address TEXT NOT NULL,
  wallet_type TEXT,
  label TEXT,
  source TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT whale_wallets_chain_address_uidx UNIQUE (blockchain, address)
);

CREATE TABLE IF NOT EXISTS whale_scores (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES whale_events(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  breakdown JSONB NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whale_scripts (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES whale_events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  narration TEXT NOT NULL,
  key_facts JSONB NOT NULL,
  visual_plan JSONB NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whale_shorts (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES whale_events(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  stage TEXT NOT NULL DEFAULT 'queued',
  output_storage_path TEXT,
  script_id INTEGER REFERENCES whale_scripts(id) ON DELETE SET NULL,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whale_shorts_chat_event_idx
  ON whale_shorts (chat_id, event_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whale_data_sources (
  id SERIAL PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle',
  last_fetched_at TIMESTAMPTZ,
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
