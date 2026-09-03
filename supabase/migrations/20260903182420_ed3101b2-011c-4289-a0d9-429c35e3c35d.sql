ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_reservas_at TIMESTAMPTZ NOT NULL DEFAULT now();