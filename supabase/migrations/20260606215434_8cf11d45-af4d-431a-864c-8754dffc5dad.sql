
CREATE TABLE public.cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT,
  titulo TEXT NOT NULL,
  descricao TEXT,
  itens JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  pix_chave TEXT NOT NULL,
  pix_nome TEXT NOT NULL,
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','cancelado')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX cobrancas_slug_idx ON public.cobrancas(slug);
CREATE INDEX cobrancas_created_at_idx ON public.cobrancas(created_at DESC);

GRANT SELECT ON public.cobrancas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cobrancas TO authenticated;
GRANT ALL ON public.cobrancas TO service_role;

ALTER TABLE public.cobrancas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Qualquer um pode ver cobrancas pelo link"
  ON public.cobrancas FOR SELECT
  USING (true);

CREATE POLICY "Autenticados podem criar cobrancas"
  ON public.cobrancas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Autenticados podem atualizar cobrancas"
  ON public.cobrancas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Autenticados podem excluir cobrancas"
  ON public.cobrancas FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER trg_cobrancas_updated_at
  BEFORE UPDATE ON public.cobrancas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
