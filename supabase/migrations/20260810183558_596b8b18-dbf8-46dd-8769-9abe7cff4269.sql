CREATE OR REPLACE FUNCTION public.criar_reserva(_data date, _hora_inicio time without time zone, _duracao_minutos integer, _cliente_nome text, _cliente_whatsapp text)
 RETURNS TABLE(reserva_id uuid, cobranca_slug text, valor_total numeric, valor_sinal numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_preco NUMERIC; v_sinal NUMERIC; v_fim TIME;
  v_slug TEXT; v_slug_base TEXT; v_i INT := 0;
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
    v_sinal, 'contato.mambaia@gmail.com', 'JOÃO VICTOR BAUER ROCHA GOMES',
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

CREATE OR REPLACE FUNCTION public.criar_reserva_pacote(_data date, _hora_inicio time without time zone, _cliente_nome text, _cliente_whatsapp text, _empreendimento text, _qtd_marcas integer DEFAULT 1)
 RETURNS TABLE(reserva_id uuid, cobranca_slug text, valor_total numeric, valor_sinal numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_unit numeric := 350; v_qtd int; v_preco numeric; v_sinal numeric; v_dur int := 60;
  v_fim time; v_slug text; v_slug_base text; v_i int := 0;
  v_cob uuid; v_res uuid; v_nome text; v_wa text; v_emp text; v_num int;
BEGIN
  IF _data < CURRENT_DATE THEN RAISE EXCEPTION 'Nao e possivel reservar em datas passadas'; END IF;
  v_qtd := GREATEST(1, LEAST(10, COALESCE(_qtd_marcas, 1)));
  v_preco := v_unit * v_qtd;
  v_sinal := round(v_preco * 0.5, 2);
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
      jsonb_build_object('nome', 'Pacote Marcas (1h) — ' || v_emp || CASE WHEN v_qtd > 1 THEN ' — ' || v_qtd || ' marcas x R$ 350' ELSE '' END, 'valor', v_preco),
      jsonb_build_object('nome', 'Sinal (50%) para confirmar', 'valor', v_sinal - v_preco)
    ),
    v_sinal, 'contato.mambaia@gmail.com', 'JOÃO VICTOR BAUER ROCHA GOMES',
    'WhatsApp cliente: ' || v_wa || E'\nEmpreendimento: ' || v_emp || E'\nQuantidade de marcas: ' || v_qtd, 'pendente'
  ) RETURNING id INTO v_cob;

  INSERT INTO public.reservas (data, hora_inicio, duracao_minutos, cliente_nome, cliente_whatsapp,
      valor_total, valor_sinal, status, cobranca_id, tipo, empreendimento, numero_proposta)
  VALUES (_data, _hora_inicio, v_dur, v_nome, v_wa, v_preco, v_sinal, 'pendente', v_cob,
      'pacote_marcas', v_emp, v_num)
  RETURNING id INTO v_res;

  RETURN QUERY SELECT v_res, v_slug, v_preco, v_sinal;
END; $function$;

CREATE OR REPLACE FUNCTION public.criar_reserva_producao(_data date, _hora_inicio time without time zone, _pacote text, _cliente_nome text, _cliente_whatsapp text, _empreendimento text DEFAULT NULL)
 RETURNS TABLE(reserva_id uuid, cobranca_slug text, valor_total numeric, valor_sinal numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_preco numeric; v_dur int; v_titulo text; v_desc text; v_sinal numeric;
  v_fim time; v_slug text; v_slug_base text; v_i int := 0;
  v_cob uuid; v_res uuid; v_nome text; v_wa text; v_emp text; v_num int;
BEGIN
  IF _data < CURRENT_DATE THEN RAISE EXCEPTION 'Não é possível reservar em datas passadas'; END IF;

  CASE _pacote
    WHEN 'express' THEN
      v_preco := 880; v_dur := 120;
      v_titulo := 'Pacote Autônomo / Express';
      v_desc := '2h de estúdio + captação profissional. 15 fotos tratadas + 2 Reels editados (até 60s). Entrega em 5 dias úteis.';
    WHEN 'lookbook' THEN
      v_preco := 1500; v_dur := 180;
      v_titulo := 'Pacote Coleção / Lookbook';
      v_desc := '3h de estúdio + captação completa. Até 30 peças, 25 fotos tratadas + 4 Reels editados. Entrega em 5 dias úteis.';
    WHEN 'campanha' THEN
      v_preco := 2100; v_dur := 240;
      v_titulo := 'Pacote Campanha Full';
      v_desc := '4h de estúdio + captação dedicada. Lote completo, 40 fotos tratadas + 6 Reels editados. Entrega em até 7 dias úteis.';
    WHEN 'creator' THEN
      v_preco := 1580; v_dur := 120;
      v_titulo := 'Plano Creator (mensal)';
      v_desc := '2h de estúdio por mês em sessão única. 20 fotos tratadas + 8 Reels editados por mês. Entrega em 5 dias úteis. Contrato mínimo de 3 meses.';
    ELSE
      RAISE EXCEPTION 'Pacote inválido';
  END CASE;

  v_nome := btrim(_cliente_nome); v_wa := btrim(_cliente_whatsapp); v_emp := btrim(coalesce(_empreendimento, ''));
  IF length(v_nome) < 2 THEN RAISE EXCEPTION 'Informe seu nome completo'; END IF;
  IF length(v_wa) < 8 THEN RAISE EXCEPTION 'Informe um WhatsApp válido'; END IF;

  v_fim := _hora_inicio + make_interval(mins => v_dur);
  IF EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.data = _data AND r.status <> 'cancelada'
      AND tsrange((_data + _hora_inicio)::timestamp, (_data + v_fim)::timestamp, '[)')
       && tsrange((r.data + r.hora_inicio)::timestamp,
                  (r.data + r.hora_inicio + make_interval(mins => r.duracao_minutos))::timestamp, '[)')
  ) THEN RAISE EXCEPTION 'Este horário já está reservado. Escolha outro.'; END IF;

  v_sinal := round(v_preco * 0.5, 2);
  v_num := nextval('public.reservas_numero_seq');
  v_slug_base := 'pp-' || lpad(v_num::text, 4, '0') || '-' || public._mb_slugify(v_nome);
  v_slug := v_slug_base;
  WHILE EXISTS (SELECT 1 FROM public.cobrancas WHERE slug = v_slug) LOOP
    v_i := v_i + 1; v_slug := v_slug_base || '-' || v_i::text;
  END LOOP;

  INSERT INTO public.cobrancas (slug, cliente_nome, titulo, descricao, itens, total, pix_chave, pix_nome, observacoes, status)
  VALUES (
    v_slug, v_nome,
    v_titulo || ' — ' || to_char(_data, 'DD/MM/YYYY') || ' ' || to_char(_hora_inicio, 'HH24:MI'),
    v_desc || ' Regra de troca: 10 fotos = 1 Reels editado. Sinal de 50% confirma a data.',
    jsonb_build_array(
      jsonb_build_object('nome', v_titulo || ' — ' || to_char(_hora_inicio,'HH24:MI') || ' às ' || to_char(v_fim,'HH24:MI'), 'valor', v_preco),
      jsonb_build_object('nome', 'Sinal (50%) para confirmar', 'valor', v_sinal - v_preco)
    ),
    v_sinal, 'contato.mambaia@gmail.com', 'JOÃO VICTOR BAUER ROCHA GOMES',
    'WhatsApp cliente: ' || v_wa || CASE WHEN v_emp <> '' THEN E'\nEmpreendimento: ' || v_emp ELSE '' END,
    'pendente'
  ) RETURNING id INTO v_cob;

  INSERT INTO public.reservas (data, hora_inicio, duracao_minutos, cliente_nome, cliente_whatsapp,
      valor_total, valor_sinal, status, cobranca_id, tipo, empreendimento, numero_proposta, observacoes)
  VALUES (_data, _hora_inicio, v_dur, v_nome, v_wa, v_preco, v_sinal, 'pendente', v_cob,
      'producao', NULLIF(v_emp, ''), v_num, v_titulo)
  RETURNING id INTO v_res;

  RETURN QUERY SELECT v_res, v_slug, v_preco, v_sinal;
END; $function$;

-- Atualiza cobranças pendentes existentes que ainda tenham o nome antigo
UPDATE public.cobrancas
   SET pix_nome = 'JOÃO VICTOR BAUER ROCHA GOMES'
 WHERE status = 'pendente'
   AND pix_chave = 'contato.mambaia@gmail.com'
   AND pix_nome <> 'JOÃO VICTOR BAUER ROCHA GOMES';
