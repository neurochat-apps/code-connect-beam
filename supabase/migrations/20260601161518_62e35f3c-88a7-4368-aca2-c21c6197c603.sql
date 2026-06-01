-- Add enum values
ALTER TYPE txn_account ADD VALUE IF NOT EXISTS 'stripe';
ALTER TYPE txn_source ADD VALUE IF NOT EXISTS 'stripe';
ALTER TYPE txn_source ADD VALUE IF NOT EXISTS 'import';

-- Columns
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS import_batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_transactions_import_batch ON public.transactions(import_batch_id);

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Stripe events (idempotency)
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id text PRIMARY KEY,
  type text NOT NULL,
  workspace_id uuid,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.stripe_events TO service_role;

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon: only service_role (webhook) writes/reads.
