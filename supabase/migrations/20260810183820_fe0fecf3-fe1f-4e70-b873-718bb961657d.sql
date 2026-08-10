REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_nova_reserva() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserva_sync_transacao() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.get_cobranca_by_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_horarios_ocupados(date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_reserva_por_slug(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirmar_pagamento_cobranca(text,text,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_reserva(date,time,integer,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_reserva_pacote(date,time,text,text,text,integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.criar_reserva_producao(date,time,text,text,text,text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_cobranca_by_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_horarios_ocupados(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_reserva_por_slug(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_pagamento_cobranca(text,text,numeric) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_reserva(date,time,integer,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_reserva_pacote(date,time,text,text,text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_reserva_producao(date,time,text,text,text,text) TO anon, authenticated;