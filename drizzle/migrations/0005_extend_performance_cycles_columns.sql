ALTER TABLE public.performance_cycles
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS rating_scale_min numeric NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS rating_scale_max numeric NOT NULL DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS rating_scale_step numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS goals_weight_pct numeric NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS competencies_weight_pct numeric NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS allow_peer_reviews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS peer_review_min_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS peer_review_max_count integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS anonymous_peer_reviews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS self_review_deadline date,
  ADD COLUMN IF NOT EXISTS manager_review_deadline date,
  ADD COLUMN IF NOT EXISTS calibration_deadline date,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';