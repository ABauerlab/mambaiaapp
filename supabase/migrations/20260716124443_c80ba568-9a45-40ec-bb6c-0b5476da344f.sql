
-- 1) Helper: slug em pt-BR
CREATE OR REPLACE FUNCTION public._mb_slugify(_txt TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT trim(both '-' from
    regexp_replace(
      lower(translate(
        coalesce(_txt,''),
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇñÑ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUCnN'
      )),
      '[^a-z0-9]+', '-', 'g'
    )
  );
$$;

-- 2) Trigger: paid_at NULL -> NOT NULL cria receita; update ajusta; delete remove
CREATE OR REPLACE FUNCTION public.reserva_sync_transacao()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_origem TEXT;
  v_cat UUID;
  v_desc TEXT;
  v_valor NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.transacoes WHERE origem = 'reserva:' || OLD.id::text;
    RETURN OLD;
  END IF;

  v_origem := 'reserva:' || NEW.id::text;

  -- Cancelada: remove receita, se existir
  IF NEW.status = 'cancelada' THEN
    DELETE FROM public.transacoes WHERE origem = v_origem;
    RETURN NEW;
  END IF;

  -- Sem pagamento registrado: nada a fazer
  IF NEW.paid_at IS NULL THEN
    RETURN NEW;
  END IF;

  v_cat := CASE WHEN NEW.tipo = 'pacote_marcas'
                THEN '0f20966a-9361-4579-9cb4-33f0c9db13e7'::uuid  -- Sessões de Foto
                ELSE '197f2885-627f-4fcb-b4a5-daaeb19b09d9'::uuid  -- Aluguel de Espaço
           END;
  v_valor := COALESCE(NEW.valor_pago, NEW.valor_sinal);
  v_desc  := CASE WHEN NEW.tipo = 'pacote_marcas' THEN 'Pacote Marcas' ELSE 'Locação estúdio' END
             || ' — ' || NEW.cliente_nome
             || ' (' || to_char(NEW.data, 'DD/MM')
             || ' ' || to_char(NEW.hora_inicio, 'HH24:MI') || ')';

  -- Upsert manual pela origem (única por reserva)
  UPDATE public.transacoes
     SET tipo = 'receita',
         valor = v_valor,
         data = NEW.paid_at::date,
         descricao = v_desc,
         categoria_id = v_cat,
         observacoes = CASE WHEN NEW.tipo_pagamento = 'parcial'
                            THEN 'Sinal 50% recebido' ELSE 'Pagamento integral recebido' END
   WHERE origem = v_origem;

  IF NOT FOUND THEN
    INSERT INTO public.transacoes (tipo, valor, data, descricao, categoria_id, origem, observacoes)
    VALUES ('receita', v_valor, NEW.paid_at::date, v_desc, v_cat, v_origem,
            CASE WHEN NEW.tipo_pagamento = 'parcial'
                 THEN 'Sinal 50% recebido' ELSE 'Pagamento integral recebido' END);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS reservas_sync_transacao ON public.reservas;
CREATE TRIGGER reservas_sync_transacao
AFTER INSERT OR UPDATE OF paid_at, valor_pago, tipo_pagamento, status, valor_sinal, data, hora_inicio, cliente_nome, tipo
ON public.reservas
FOR EACH ROW EXECUTE FUNCTION public.reserva_sync_transacao();

DROP TRIGGER IF EXISTS reservas_sync_transacao_del ON public.reservas;
CREATE TRIGGER reservas_sync_transacao_del
AFTER DELETE ON public.reservas
FOR EACH ROW EXECUTE FUNCTION public.reserva_sync_transacao();

-- 3) Backfill: reservas já pagas viram receita retroativa
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT * FROM public.reservas WHERE paid_at IS NOT NULL AND status <> 'cancelada' LOOP
    PERFORM 1;
    -- reuse trigger logic by touching the row
    UPDATE public.reservas SET paid_at = paid_at WHERE id = r.id;
  END LOOP;
END $$;

-- 4) Recriar criar_reserva com slug significativo
CREATE OR REPLACE FUNCTION public.criar_reserva(_data date, _hora_inicio time without time zone, _duracao_minutos integer, _cliente_nome text, _cliente_whatsapp text)
 RETURNS TABLE(reserva_id uuid, cobranca_slug text, valor_total numeric, valor_sinal numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_preco NUMERIC; v_sinal NUMERIC; v_fim TIME;
  v_slug TEXT; v_slug_base TEXT; v_slug_try TEXT; v_i INT := 0;
  v_cobranca_id UUID; v_reserva_id UUID;
  v_nome TEXT; v_wa TEXT; v_num INT;
BEGIN
  IF _data < CURRENT_DATE THEN RAISE EXCEPTION 'Não é possível reservar em datas passadas'; END IF;
  v_preco := public.calc_preco_reserva(_duracao_minutos);
  IF v_preco IS NULL THEN RAISE EXCEPTION 'Duração inválida. Use múltiplos de 30 min até 4h.'; END IF;
  v_nome := btrim(_cliente_nome); v_wa := btrim(_cliente_whatsapp);
  IF length(v_nome) < 2 THEN RAISE EXCEPTION 'Informe seu nome completo'; END IF;
  IF length(v_wa) < 8 THEN RAISE EXCEPTION 'Informe um WhatsApp válido'; END IF;
  v_fim := (_hora_inicio + make_interval(mins => _duracao_minutos));
  IF EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.data = _data AND r.status <> 'cancelada'
      AND tsrange((_data + _hora_inicio)::timestamp, (_data + v_fim)::timestamp, '[)')
       && tsrange((r.data + r.hora_inicio)::timestamp,
                  (r.data + r.hora_inicio + make_interval(mins => r.duracao_minutos))::timestamp, '[)')
  ) THEN RAISE EXCEPTION 'Este horário já está reservado. Escolha outro.'; END IF;
  v_sinal := round(v_preco * 0.5, 2);
  v_num := nextval('public.reservas_numero_seq');
  v_slug_base := 'pc-' || lpad(v_num::text, 4, '0') || '-' || public._mb_slugify(v_nome);
  v_slug := v_slug_base;
  WHILE EXISTS (SELECT 1 FROM public.cobrancas WHERE slug = v_slug) LOOP
    v_i := v_i + 1;
    v_slug := v_slug_base || '-' || v_i::text;
  END LOOP;

  INSERT INTO public.cobrancas (
    slug, cliente_nome, titulo, descricao, itens, total, pix_chave, pix_nome, observacoes, status
  ) VALUES (
    v_slug, v_nome,
    'Reserva Mambaia Estúdio — ' || to_char(_data, 'DD/MM/YYYY') || ' ' || to_char(_hora_inicio, 'HH24:MI'),
    'Sinal de 50% para confirmar a reserva do estúdio. O restante é pago no dia.',
    jsonb_build_array(
      jsonb_build_object('nome',
        'Locação ' || (_duracao_minutos / 60)::text || 'h' ||
        CASE WHEN (_duracao_minutos % 60) > 0 THEN (_duracao_minutos % 60)::text || 'min' ELSE '' END ||
        ' — ' || to_char(_hora_inicio,'HH24:MI') || ' às ' || to_char(v_fim,'HH24:MI'),
        'valor', v_preco),
      jsonb_build_object('nome', 'Sinal (50%) para confirmar', 'valor', v_sinal - v_preco)
    ),
    v_sinal, '57500686000105', 'LAURA OTTONI NEGRÃO',
    'WhatsApp cliente: ' || v_wa, 'pendente'
  ) RETURNING id INTO v_cobranca_id;

  INSERT INTO public.reservas (
    data, hora_inicio, duracao_minutos, cliente_nome, cliente_whatsapp,
    valor_total, valor_sinal, status, cobranca_id, numero_proposta
  ) VALUES (
    _data, _hora_inicio, _duracao_minutos, v_nome, v_wa,
    v_preco, v_sinal, 'pendente', v_cobranca_id, v_num
  ) RETURNING id INTO v_reserva_id;

  RETURN QUERY SELECT v_reserva_id, v_slug, v_preco, v_sinal;
END; $function$;

-- 5) Recriar criar_reserva_pacote com slug significativo
CREATE OR REPLACE FUNCTION public.criar_reserva_pacote(_data date, _hora_inicio time without time zone, _cliente_nome text, _cliente_whatsapp text, _empreendimento text)
 RETURNS TABLE(reserva_id uuid, cobranca_slug text, valor_total numeric, valor_sinal numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_preco numeric := 350; v_sinal numeric := 175; v_dur int := 60;
  v_fim time; v_slug text; v_slug_base text; v_i int := 0;
  v_cob uuid; v_res uuid; v_nome text; v_wa text; v_emp text; v_num int;
BEGIN
  IF _data < CURRENT_DATE THEN RAISE EXCEPTION 'Nao e possivel reservar em datas passadas'; END IF;
  v_nome := btrim(_cliente_nome); v_wa := btrim(_cliente_whatsapp); v_emp := btrim(coalesce(_empreendimento, ''));
  IF length(v_nome) < 2 THEN RAISE EXCEPTION 'Informe seu nome completo'; END IF;
  IF length(v_wa)  < 8 THEN RAISE EXCEPTION 'Informe um WhatsApp valido'; END IF;
  IF length(v_emp) < 2 THEN RAISE EXCEPTION 'Informe o nome da marca ou brecho'; END IF;
  v_fim := _hora_inicio + make_interval(mins => v_dur);
  IF EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.data = _data AND r.status <> 'cancelada'
      AND tsrange((_data + _hora_inicio)::timestamp, (_data + v_fim)::timestamp, '[)')
       && tsrange((r.data + r.hora_inicio)::timestamp,
                  (r.data + r.hora_inicio + make_interval(mins => r.duracao_minutos))::timestamp, '[)')
  ) THEN RAISE EXCEPTION 'Este horario ja esta reservado. Escolha outro.'; END IF;

  v_num := nextval('public.reservas_numero_seq');
  v_slug_base := 'pm-' || lpad(v_num::text, 4, '0') || '-' || public._mb_slugify(v_nome);
  v_slug := v_slug_base;
  WHILE EXISTS (SELECT 1 FROM public.cobrancas WHERE slug = v_slug) LOOP
    v_i := v_i + 1; v_slug := v_slug_base || '-' || v_i::text;
  END LOOP;

  INSERT INTO public.cobrancas (slug, cliente_nome, titulo, descricao, itens, total, pix_chave, pix_nome, observacoes, status)
  VALUES (
    v_slug, v_nome,
    'Pacote Marcas Mambaia — ' || v_emp || ' — ' || to_char(_data, 'DD/MM/YYYY') || ' ' || to_char(_hora_inicio, 'HH24:MI'),
    'Pacote fotográfico para marcas e brechós: 1h no estúdio Mambaia com toda a estrutura (câmera, tripés e iluminação profissionais). Você traz as peças, a gente cuida do resto. Sinal de 50% confirma a data.',
    jsonb_build_array(
      jsonb_build_object('nome', 'Pacote Marcas (1h) — ' || v_emp, 'valor', v_preco),
      jsonb_build_object('nome', 'Sinal (50%) para confirmar', 'valor', v_sinal - v_preco)
    ),
    v_sinal, '57500686000105', 'LAURA OTTONI NEGRÃO',
    'WhatsApp cliente: ' || v_wa || E'\nEmpreendimento: ' || v_emp, 'pendente'
  ) RETURNING id INTO v_cob;

  INSERT INTO public.reservas (data, hora_inicio, duracao_minutos, cliente_nome, cliente_whatsapp,
      valor_total, valor_sinal, status, cobranca_id, tipo, empreendimento, numero_proposta)
  VALUES (_data, _hora_inicio, v_dur, v_nome, v_wa, v_preco, v_sinal, 'pendente', v_cob,
      'pacote_marcas', v_emp, v_num)
  RETURNING id INTO v_res;

  RETURN QUERY SELECT v_res, v_slug, v_preco, v_sinal;
END; $function$;
