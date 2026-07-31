
-- 1) Kodara de volta
INSERT INTO public.socios (nome, cor, ordem)
SELECT 'Kodara', '#A6D608', 99
WHERE NOT EXISTS (SELECT 1 FROM public.socios WHERE lower(nome) = 'kodara');

-- 2) Reset senha da Laura
UPDATE auth.users
   SET encrypted_password = crypt('24092023', gen_salt('bf')),
       updated_at = now()
 WHERE email = 'laura@mambaia.app';

UPDATE public.profiles p
   SET must_change_password = false
  FROM auth.users u
 WHERE p.user_id = u.id AND u.email = 'laura@mambaia.app';

-- 3) Gastos fixos: parcelas
ALTER TABLE public.gastos_fixos
  ADD COLUMN IF NOT EXISTS parcelas_total integer,
  ADD COLUMN IF NOT EXISTS parcelas_pagas integer NOT NULL DEFAULT 0;

-- 4) Reservas: marcadores de lembrete
ALTER TABLE public.reservas
  ADD COLUMN IF NOT EXISTS lembrete_24h_enviado_at timestamptz,
  ADD COLUMN IF NOT EXISTS lembrete_1h_enviado_at  timestamptz;

-- 5) Realtime
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transacoes','gastos_fixos','quadro_itens','reservas','acertos','categorias','cobrancas','socios']
  LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- 6) Trigger push em nova reserva
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_nova_reserva()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- ignora bloqueios internos
  IF NEW.cliente_whatsapp = '00000000000' OR NEW.cliente_nome LIKE 'BLOQUEIO%' THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://project--edccd28d-e348-42cb-bb48-27a08c6f8858.lovable.app/api/public/hooks/nova-reserva',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('reserva_id', NEW.id::text)
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_notify_nova_reserva ON public.reservas;
CREATE TRIGGER trg_notify_nova_reserva
AFTER INSERT ON public.reservas
FOR EACH ROW EXECUTE FUNCTION public.notify_nova_reserva();
