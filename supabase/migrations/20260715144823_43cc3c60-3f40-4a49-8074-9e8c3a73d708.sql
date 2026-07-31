DROP FUNCTION IF EXISTS public.confirmar_pagamento_cobranca(text, text, numeric);

CREATE OR REPLACE FUNCTION public.confirmar_pagamento_cobranca(_slug text, _tipo text, _valor numeric)
 RETURNS TABLE(cobranca_id uuid, reserva_id uuid, paid_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cob_id uuid;
  v_res_id uuid;
  v_now timestamptz := now();
BEGIN
  IF _tipo NOT IN ('integral','parcial') THEN RAISE EXCEPTION 'Tipo de pagamento invalido'; END IF;
  IF _valor IS NULL OR _valor <= 0 THEN RAISE EXCEPTION 'Valor invalido'; END IF;

  UPDATE public.cobrancas
     SET status='pago', paid_at=v_now
   WHERE slug=_slug
   RETURNING id INTO v_cob_id;
  IF v_cob_id IS NULL THEN RAISE EXCEPTION 'Cobranca nao encontrada'; END IF;

  UPDATE public.reservas r
     SET status = CASE WHEN _tipo='integral' THEN 'paga' ELSE 'confirmada' END,
         paid_at = v_now,
         valor_pago = _valor,
         tipo_pagamento = _tipo
   WHERE r.cobranca_id = v_cob_id
   RETURNING r.id INTO v_res_id;

  RETURN QUERY SELECT v_cob_id, v_res_id, v_now;
END;
$function$;