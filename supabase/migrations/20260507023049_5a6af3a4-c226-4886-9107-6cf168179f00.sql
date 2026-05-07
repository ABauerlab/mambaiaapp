
-- Sócios
CREATE TABLE public.socios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  cor TEXT NOT NULL DEFAULT '#A6D608',
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.socios (nome, cor, ordem) VALUES
  ('João Victor', '#A6D608', 1),
  ('Laura Ottoni', '#DFFF4F', 2),
  ('Eduardo', '#1F3D2B', 3);

-- Tipo de transação
CREATE TYPE public.tipo_transacao AS ENUM ('despesa', 'receita');

-- Categorias
CREATE TABLE public.categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo public.tipo_transacao NOT NULL,
  icone TEXT NOT NULL DEFAULT 'Tag',
  cor TEXT NOT NULL DEFAULT '#A6D608',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(nome, tipo)
);

INSERT INTO public.categorias (nome, tipo, icone, cor) VALUES
  ('Aluguel', 'despesa', 'Home', '#1F3D2B'),
  ('IPTU', 'despesa', 'FileText', '#1F3D2B'),
  ('Condomínio', 'despesa', 'Building', '#1F3D2B'),
  ('Internet', 'despesa', 'Wifi', '#1F3D2B'),
  ('Energia', 'despesa', 'Zap', '#DFFF4F'),
  ('Água', 'despesa', 'Droplet', '#A6D608'),
  ('Estúdio Fotográfico', 'despesa', 'Camera', '#A6D608'),
  ('Materiais e Suprimentos', 'despesa', 'Package', '#A6D608'),
  ('Manutenção', 'despesa', 'Wrench', '#1F3D2B'),
  ('Outros', 'despesa', 'MoreHorizontal', '#1F3D2B'),
  ('Aluguel de Espaço', 'receita', 'Home', '#A6D608'),
  ('Sessões de Foto', 'receita', 'Camera', '#DFFF4F'),
  ('Eventos', 'receita', 'Calendar', '#A6D608'),
  ('Outros', 'receita', 'MoreHorizontal', '#A6D608');

-- Transações
CREATE TABLE public.transacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo public.tipo_transacao NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  descricao TEXT NOT NULL,
  observacoes TEXT,
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  socio_id UUID REFERENCES public.socios(id) ON DELETE SET NULL,
  empresa TEXT,
  origem TEXT NOT NULL DEFAULT 'manual',
  acertada BOOLEAN NOT NULL DEFAULT false,
  acerto_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transacoes_data ON public.transacoes(data DESC);
CREATE INDEX idx_transacoes_tipo ON public.transacoes(tipo);
CREATE INDEX idx_transacoes_acertada ON public.transacoes(acertada);

-- Gastos fixos
CREATE TABLE public.gastos_fixos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  dia_mes INTEGER NOT NULL CHECK (dia_mes BETWEEN 1 AND 31),
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  socio_padrao_id UUID REFERENCES public.socios(id) ON DELETE SET NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  empresa TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Acertos
CREATE TABLE public.acertos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  de_socio_id UUID NOT NULL REFERENCES public.socios(id),
  para_socio_id UUID NOT NULL REFERENCES public.socios(id),
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_acertos_data ON public.acertos(data DESC);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transacoes_updated
  BEFORE UPDATE ON public.transacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS: nesta fase, acesso totalmente aberto (uso interno administrativo, sem login)
ALTER TABLE public.socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_fixos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acertos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "open_all" ON public.socios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.transacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.gastos_fixos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "open_all" ON public.acertos FOR ALL USING (true) WITH CHECK (true);
