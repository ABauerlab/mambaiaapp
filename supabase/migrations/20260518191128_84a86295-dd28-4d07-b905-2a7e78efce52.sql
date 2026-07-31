
ALTER TABLE public.gastos_fixos
  ADD COLUMN IF NOT EXISTS frequencia TEXT NOT NULL DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS dia_semana SMALLINT,
  ADD COLUMN IF NOT EXISTS mes SMALLINT;

ALTER TABLE public.gastos_fixos
  DROP CONSTRAINT IF EXISTS gastos_fixos_frequencia_check;

ALTER TABLE public.gastos_fixos
  ADD CONSTRAINT gastos_fixos_frequencia_check
  CHECK (frequencia IN ('mensal','semanal','quinzenal','anual'));
