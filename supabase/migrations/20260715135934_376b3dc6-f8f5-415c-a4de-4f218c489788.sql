
-- Ajuste de preço 3h30
CREATE OR REPLACE FUNCTION public.calc_preco_reserva(_minutos integer)
 RETURNS numeric
 LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE _minutos
    WHEN 30  THEN 50
    WHEN 60  THEN 100
    WHEN 90  THEN 150
    WHEN 120 THEN 180
    WHEN 150 THEN 230
    WHEN 180 THEN 250
    WHEN 210 THEN 280
    WHEN 240 THEN 300
    ELSE NULL
  END::numeric;
$function$;

-- Campos de pagamento na reserva
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS tipo_pagamento TEXT;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='reservas_tipo_pagamento_check') THEN
    ALTER TABLE public.reservas ADD CONSTRAINT reservas_tipo_pagamento_check
      CHECK (tipo_pagamento IS NULL OR tipo_pagamento IN ('integral','parcial'));
  END IF;
END $$;

-- Limpa acertos órfãos (usuário zerou transações)
DELETE FROM public.acertos;

-- RPC: reserva por slug (público)
CREATE OR REPLACE FUNCTION public.get_reserva_por_slug(_slug text)
RETURNS TABLE(
  id uuid, data date, hora_inicio time, duracao_minutos int,
  cliente_nome text, cliente_whatsapp text,
  valor_total numeric, valor_sinal numeric,
  status text, paid_at timestamptz, valor_pago numeric, tipo_pagamento text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT r.id, r.data, r.hora_inicio, r.duracao_minutos,
         r.cliente_nome, r.cliente_whatsapp,
         r.valor_total, r.valor_sinal,
         r.status, r.paid_at, r.valor_pago, r.tipo_pagamento
  FROM public.reservas r
  JOIN public.cobrancas c ON c.id = r.cobranca_id
  WHERE c.slug = _slug
  LIMIT 1;
$$;

-- RPC: cliente confirma pagamento (marca cobrança e reserva)
CREATE OR REPLACE FUNCTION public.confirmar_pagamento_cobranca(_slug text, _tipo text, _valor numeric)
RETURNS TABLE(cobranca_id uuid, reserva_id uuid, paid_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE
  v_cob_id uuid;
  v_res_id uuid;
  v_now timestamptz := now();
BEGIN
  IF _tipo NOT IN ('integral','parcial') THEN RAISE EXCEPTION 'Tipo de pagamento inválido'; END IF;
  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor inválido'; END IF;

  UPDATE public.cobrancas
     SET status='pago', paid_at=v_now
   WHERE slug=_slug
   RETURNING id INTO v_cob_id;
  IF v_cob_id IS NULL THEN RAISE EXCEPTION 'Cobrança não encontrada'; END IF;

  UPDATE public.reservas
     SET status = CASE WHEN _tipo='integral' THEN 'paga' ELSE 'confirmada' END,
         paid_at = v_now,
         valor_pago = _valor,
         tipo_pagamento = _tipo
   WHERE cobranca_id = v_cob_id
   RETURNING id INTO v_res_id;

  RETURN QUERY SELECT v_cob_id, v_res_id, v_now;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reserva_por_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_cobranca(text, text, numeric) TO anon, authenticated;
