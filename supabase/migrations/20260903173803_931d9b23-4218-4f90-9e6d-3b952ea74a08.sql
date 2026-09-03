-- Marca a partir de quando o usuário já viu as reservas (usado pra notificação
-- em app de "novo agendamento" ao entrar no sistema, sem depender de push).
ALTER TABLE public.profiles
  ADD COLUMN last_seen_reservas_at TIMESTAMPTZ NOT NULL DEFAULT now();
