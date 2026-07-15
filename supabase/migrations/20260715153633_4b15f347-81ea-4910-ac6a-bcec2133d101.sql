
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'locacao',
  ADD COLUMN IF NOT EXISTS empreendimento text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reservas_tipo_chk') THEN
    ALTER TABLE public.reservas ADD CONSTRAINT reservas_tipo_chk CHECK (tipo IN ('locacao','pacote_marcas'));
  END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.reservas_numero_seq START 1001;
GRANT USAGE, SELECT ON SEQUENCE public.reservas_numero_seq TO anon, authenticated, service_role;

ALTER TABLE public.reservas ADD COLUMN IF NOT EXISTS numero_proposta integer;
UPDATE public.reservas SET numero_proposta = nextval('public.reservas_numero_seq') WHERE numero_proposta IS NULL;
ALTER TABLE public.reservas ALTER COLUMN numero_proposta SET DEFAULT nextval('public.reservas_numero_seq');
ALTER TABLE public.reservas ALTER COLUMN numero_proposta SET NOT NULL;

CREATE OR REPLACE FUNCTION public.criar_reserva_pacote(
  _data date,
  _hora_inicio time without time zone,
  _cliente_nome text,
  _cliente_whatsapp text,
  _empreendimento text
) RETURNS TABLE(reserva_id uuid, cobranca_slug text, valor_total numeric, valor_sinal numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_preco numeric := 350;
  v_sinal numeric := 175;
  v_dur int := 60;
  v_fim time;
  v_slug text;
  v_cob uuid;
  v_res uuid;
  v_nome text;
  v_wa text;
  v_emp text;
BEGIN
  IF _data < CURRENT_DATE THEN RAISE EXCEPTION 'Nao e possivel reservar em datas passadas'; END IF;
  v_nome := btrim(_cliente_nome);
  v_wa := btrim(_cliente_whatsapp);
  v_emp := btrim(coalesce(_empreendimento, ''));
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
  ) THEN
    RAISE EXCEPTION 'Este horario ja esta reservado. Escolha outro.';
  END IF;

  LOOP
    v_slug := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.cobrancas WHERE slug = v_slug);
  END LOOP;

  INSERT INTO public.cobrancas (slug, cliente_nome, titulo, descricao, itens, total, pix_chave, pix_nome, observacoes, status)
  VALUES (
    v_slug, v_nome,
    'Pacote Marcas Mambaia - ' || v_emp || ' - ' || to_char(_data, 'DD/MM/YYYY') || ' ' || to_char(_hora_inicio, 'HH24:MI'),
    'Pacote fotografico para marcas e brechos: 1h no estudio Mambaia, com fotografia, edicao e making-of. Sinal de 50% confirma a data.',
    jsonb_build_array(
      jsonb_build_object('nome', 'Pacote Marcas (1h) - ' || v_emp, 'valor', v_preco),
      jsonb_build_object('nome', 'Sinal (50%) para confirmar', 'valor', v_sinal - v_preco)
    ),
    v_sinal, '57500686000105', 'LAURA OTTONI NEGRAO',
    'WhatsApp cliente: ' || v_wa || E'\nEmpreendimento: ' || v_emp,
    'pendente'
  ) RETURNING id INTO v_cob;

  INSERT INTO public.reservas (data, hora_inicio, duracao_minutos, cliente_nome, cliente_whatsapp, valor_total, valor_sinal, status, cobranca_id, tipo, empreendimento)
  VALUES (_data, _hora_inicio, v_dur, v_nome, v_wa, v_preco, v_sinal, 'pendente', v_cob, 'pacote_marcas', v_emp)
  RETURNING id INTO v_res;

  RETURN QUERY SELECT v_res, v_slug, v_preco, v_sinal;
END; $$;

DROP FUNCTION IF EXISTS public.get_reserva_por_slug(text);
CREATE FUNCTION public.get_reserva_por_slug(_slug text)
RETURNS TABLE(
  id uuid, data date, hora_inicio time without time zone, duracao_minutos integer,
  cliente_nome text, cliente_whatsapp text,
  valor_total numeric, valor_sinal numeric,
  status text, paid_at timestamptz, valor_pago numeric, tipo_pagamento text,
  tipo text, empreendimento text, numero_proposta integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.data, r.hora_inicio, r.duracao_minutos,
         r.cliente_nome, r.cliente_whatsapp,
         r.valor_total, r.valor_sinal,
         r.status, r.paid_at, r.valor_pago, r.tipo_pagamento,
         r.tipo, r.empreendimento, r.numero_proposta
    FROM public.reservas r
    JOIN public.cobrancas c ON c.id = r.cobranca_id
   WHERE c.slug = _slug LIMIT 1;
$$;
