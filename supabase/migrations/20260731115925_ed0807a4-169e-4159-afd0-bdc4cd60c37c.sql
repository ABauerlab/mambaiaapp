CREATE TABLE public.alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  observacao text,
  data date NOT NULL,
  hora time NOT NULL DEFAULT '09:00',
  recorrencia text NOT NULL DEFAULT 'unica',
  somente_dia_util boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  ultimo_disparo_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT alertas_recorrencia_chk CHECK (recorrencia IN ('unica','diaria','semanal','quinzenal','mensal'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas TO authenticated;
GRANT ALL ON public.alertas TO service_role;
ALTER TABLE public.alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_all ON public.alertas FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER alertas_set_updated_at BEFORE UPDATE ON public.alertas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.notificacoes_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  titulo text,
  corpo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.notificacoes_log TO authenticated;
GRANT ALL ON public.notificacoes_log TO service_role;
ALTER TABLE public.notificacoes_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_log_select ON public.notificacoes_log FOR SELECT TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.alertas;

INSERT INTO public.alertas (nome, observacao, data, hora, recorrencia, somente_dia_util, ativo)
VALUES ('Faxina', 'Faxina semanal do estúdio. Conferir materiais de limpeza antes.', CURRENT_DATE, '09:00', 'semanal', true, true);