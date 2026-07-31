-- 1) Trigger-only SECURITY DEFINER functions must never be callable through the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_nova_reserva() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserva_sync_transacao() FROM PUBLIC, anon, authenticated;

-- Internal helpers: only needed inside other functions
REVOKE ALL ON FUNCTION public._mb_slugify(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calc_preco_reserva(integer) FROM PUBLIC, anon, authenticated;

-- 2) Harden the publicly callable payment confirmation: derive the amount server-side
CREATE OR REPLACE FUNCTION public.confirmar_pagamento_cobranca(_slug text, _tipo text, _valor numeric)
 RETURNS TABLE(cobranca_id uuid, reserva_id uuid, paid_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cob_id uuid;
  v_cob_total numeric;
  v_cob_status text;
  v_res_id uuid;
  v_res_total numeric;
  v_valor numeric;
  v_now timestamptz := now();
BEGIN
  IF _tipo NOT IN ('integral','parcial') THEN
    RAISE EXCEPTION 'Tipo de pagamento invalido';
  END IF;

  SELECT c.id, c.total, c.status
    INTO v_cob_id, v_cob_total, v_cob_status
    FROM public.cobrancas c
   WHERE c.slug = _slug
   LIMIT 1;

  IF v_cob_id IS NULL THEN
    RAISE EXCEPTION 'Cobranca nao encontrada';
  END IF;

  IF v_cob_status = 'pago' THEN
    RAISE EXCEPTION 'Esta cobranca ja foi confirmada';
  END IF;

  SELECT r.id, r.valor_total
    INTO v_res_id, v_res_total
    FROM public.reservas r
   WHERE r.cobranca_id = v_cob_id
   LIMIT 1;

  -- Amount is always derived from stored data; the client value is never trusted
  v_valor := CASE
               WHEN _tipo = 'integral' THEN COALESCE(v_res_total, v_cob_total)
               ELSE v_cob_total
             END;

  IF v_valor IS NULL OR v_valor <= 0 THEN
    RAISE EXCEPTION 'Valor invalido';
  END IF;

  UPDATE public.cobrancas
     SET status = 'pago', paid_at = v_now
   WHERE id = v_cob_id;

  IF v_res_id IS NOT NULL THEN
    UPDATE public.reservas r
       SET status = CASE WHEN _tipo = 'integral' THEN 'paga' ELSE 'confirmada' END,
           paid_at = v_now,
           valor_pago = v_valor,
           tipo_pagamento = _tipo
     WHERE r.id = v_res_id;
  END IF;

  RETURN QUERY SELECT v_cob_id, v_res_id, v_now;
END;
$function$;

REVOKE ALL ON FUNCTION public.confirmar_pagamento_cobranca(text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_cobranca(text, text, numeric) TO anon, authenticated;