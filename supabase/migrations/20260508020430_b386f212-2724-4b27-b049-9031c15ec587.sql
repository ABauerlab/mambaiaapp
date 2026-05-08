
CREATE TABLE public.quadro_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('ideia','tarefa','demanda')),
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_andamento','concluido','arquivado')),
  prioridade text NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta')),
  responsavel_id uuid,
  empresa text,
  tags text[] NOT NULL DEFAULT '{}',
  prazo date,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.quadro_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all" ON public.quadro_itens FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER trg_quadro_itens_updated
BEFORE UPDATE ON public.quadro_itens
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_quadro_itens_status ON public.quadro_itens(status);
