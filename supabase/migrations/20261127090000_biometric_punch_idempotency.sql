BEGIN;

-- Keep pre-existing events untouched. The public terminal route begins writing
-- an idempotency key for new events, and the partial unique index makes retries
-- and concurrent submits safe without requiring a risky historical dedupe.
ALTER TABLE public.punches
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_punches_company_idempotency_key
  ON public.punches(company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMIT;
