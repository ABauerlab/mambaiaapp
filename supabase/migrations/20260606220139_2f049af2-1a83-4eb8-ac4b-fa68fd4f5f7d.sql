
-- 1. Cobranças: remove leitura pública direta, mantém só para autenticados
DROP POLICY IF EXISTS "Qualquer um pode ver cobrancas pelo link" ON public.cobrancas;

CREATE POLICY "Autenticados podem ver cobrancas"
  ON public.cobrancas FOR SELECT TO authenticated USING (true);

REVOKE SELECT ON public.cobrancas FROM anon;

-- Função pública que devolve só os campos necessários para o checkout via slug
CREATE OR REPLACE FUNCTION public.get_cobranca_by_slug(_slug TEXT)
RETURNS TABLE (
  id UUID,
  slug TEXT,
  cliente_nome TEXT,
  titulo TEXT,
  descricao TEXT,
  itens JSONB,
  total NUMERIC,
  pix_chave TEXT,
  pix_nome TEXT,
  observacoes TEXT,
  status TEXT,
  paid_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, slug, cliente_nome, titulo, descricao, itens, total,
         pix_chave, pix_nome, observacoes, status, paid_at
  FROM public.cobrancas
  WHERE slug = _slug
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_cobranca_by_slug(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cobranca_by_slug(TEXT) TO anon, authenticated;

-- 2. push_subscriptions: cada um vê só as suas
DROP POLICY IF EXISTS auth_all ON public.push_subscriptions;

CREATE POLICY "Owner manages own push subs"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (
    socio_id IS NOT NULL
    AND socio_id = (SELECT p.socio_id FROM public.profiles p WHERE p.user_id = auth.uid())
  )
  WITH CHECK (
    socio_id IS NOT NULL
    AND socio_id = (SELECT p.socio_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

-- 3. Revoga EXECUTE das funções internas de trigger
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated;
