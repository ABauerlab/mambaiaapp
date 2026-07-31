
-- Tabela de reservas do estúdio
CREATE TABLE public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  duracao_minutos INTEGER NOT NULL CHECK (duracao_minutos > 0 AND duracao_minutos <= 240),
  cliente_nome TEXT NOT NULL,
  cliente_whatsapp TEXT NOT NULL,
  valor_total NUMERIC(10,2) NOT NULL,
  valor_sinal NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmada','paga','cancelada')),
  cobranca_id UUID REFERENCES public.cobrancas(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX reservas_data_idx ON public.reservas(data);
CREATE INDEX reservas_status_idx ON public.reservas(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservas TO authenticated;
GRANT ALL ON public.reservas TO service_role;

ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gerenciam reservas"
  ON public.reservas FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE TRIGGER reservas_set_updated_at
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Preço oficial
CREATE OR REPLACE FUNCTION public.calc_preco_reserva(_minutos INTEGER)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _minutos
    WHEN 30  THEN 50
    WHEN 60  THEN 100
    WHEN 90  THEN 150
    WHEN 120 THEN 180
    WHEN 150 THEN 230
    WHEN 180 THEN 250
    WHEN 210 THEN 300
    WHEN 240 THEN 300
    ELSE NULL
  END::numeric;
$$;

REVOKE EXECUTE ON FUNCTION public.calc_preco_reserva(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calc_preco_reserva(INTEGER) TO anon, authenticated;

-- Horários ocupados por data (público, sem PII)
CREATE OR REPLACE FUNCTION public.get_horarios_ocupados(_data DATE)
RETURNS TABLE(hora_inicio TIME, duracao_minutos INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hora_inicio, duracao_minutos
  FROM public.reservas
  WHERE data = _data
    AND status <> 'cancelada'
  ORDER BY hora_inicio;
$$;

REVOKE EXECUTE ON FUNCTION public.get_horarios_ocupados(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_horarios_ocupados(DATE) TO anon, authenticated;

-- Criação pública de reserva + cobrança de sinal (50%)
CREATE OR REPLACE FUNCTION public.criar_reserva(
  _data DATE,
  _hora_inicio TIME,
  _duracao_minutos INTEGER,
  _cliente_nome TEXT,
  _cliente_whatsapp TEXT
)
RETURNS TABLE(reserva_id UUID, cobranca_slug TEXT, valor_total NUMERIC, valor_sinal NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preco NUMERIC;
  v_sinal NUMERIC;
  v_fim TIME;
  v_slug TEXT;
  v_cobranca_id UUID;
  v_reserva_id UUID;
  v_nome TEXT;
  v_wa TEXT;
BEGIN
  -- validações
  IF _data < CURRENT_DATE THEN
    RAISE EXCEPTION 'Não é possível reservar em datas passadas';
  END IF;

  v_preco := public.calc_preco_reserva(_duracao_minutos);
  IF v_preco IS NULL THEN
    RAISE EXCEPTION 'Duração inválida. Use múltiplos de 30 min até 4h.';
  END IF;

  v_nome := btrim(_cliente_nome);
  v_wa := btrim(_cliente_whatsapp);
  IF length(v_nome) < 2 THEN RAISE EXCEPTION 'Informe seu nome completo'; END IF;
  IF length(v_wa)  < 8 THEN RAISE EXCEPTION 'Informe um WhatsApp válido'; END IF;

  v_fim := (_hora_inicio + make_interval(mins => _duracao_minutos));

  -- conflito de horário (não cancelada)
  IF EXISTS (
    SELECT 1 FROM public.reservas r
    WHERE r.data = _data
      AND r.status <> 'cancelada'
      AND tsrange(
        (_data + _hora_inicio)::timestamp,
        (_data + v_fim)::timestamp,
        '[)'
      ) && tsrange(
        (r.data + r.hora_inicio)::timestamp,
        (r.data + r.hora_inicio + make_interval(mins => r.duracao_minutos))::timestamp,
        '[)'
      )
  ) THEN
    RAISE EXCEPTION 'Este horário já está reservado. Escolha outro.';
  END IF;

  v_sinal := round(v_preco * 0.5, 2);

  -- gera slug único (colisão extremamente improvável, mas re-tenta)
  LOOP
    v_slug := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 10));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.cobrancas WHERE slug = v_slug);
  END LOOP;

  INSERT INTO public.cobrancas (
    slug, cliente_nome, titulo, descricao,
    itens, total, pix_chave, pix_nome, observacoes, status
  ) VALUES (
    v_slug,
    v_nome,
    'Reserva Mambaia Estúdio — ' || to_char(_data, 'DD/MM/YYYY') || ' ' || to_char(_hora_inicio, 'HH24:MI'),
    'Sinal de 50% para confirmar a reserva do estúdio. O restante é pago no dia.',
    jsonb_build_array(
      jsonb_build_object(
        'nome', 'Locação ' || (_duracao_minutos / 60)::text || 'h' ||
                CASE WHEN (_duracao_minutos % 60) > 0 THEN (_duracao_minutos % 60)::text || 'min' ELSE '' END ||
                ' — ' || to_char(_hora_inicio,'HH24:MI') || ' às ' || to_char(v_fim,'HH24:MI'),
        'valor', v_preco
      ),
      jsonb_build_object('nome', 'Sinal (50%) para confirmar', 'valor', v_sinal - v_preco)
    ),
    v_sinal,
    '57500686000105',
    'LAURA OTTONI NEGRÃO',
    'WhatsApp cliente: ' || v_wa,
    'pendente'
  )
  RETURNING id INTO v_cobranca_id;

  INSERT INTO public.reservas (
    data, hora_inicio, duracao_minutos,
    cliente_nome, cliente_whatsapp,
    valor_total, valor_sinal, status, cobranca_id
  ) VALUES (
    _data, _hora_inicio, _duracao_minutos,
    v_nome, v_wa,
    v_preco, v_sinal, 'pendente', v_cobranca_id
  )
  RETURNING id INTO v_reserva_id;

  RETURN QUERY SELECT v_reserva_id, v_slug, v_preco, v_sinal;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_reserva(DATE, TIME, INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_reserva(DATE, TIME, INTEGER, TEXT, TEXT) TO anon, authenticated;
