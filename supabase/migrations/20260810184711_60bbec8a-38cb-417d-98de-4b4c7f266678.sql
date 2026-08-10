CREATE OR REPLACE FUNCTION public.notify_nova_reserva()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.cliente_whatsapp = '00000000000' OR NEW.cliente_nome LIKE 'BLOQUEIO%' THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://project--edccd28d-e348-42cb-bb48-27a08c6f8858.lovable.app/api/public/hooks/nova-reserva',
    headers := '{"Content-Type":"application/json","x-cron-secret":"9abb734b4f74b148549b4ede8197b09baade9495ccded7de"}'::jsonb,
    body := jsonb_build_object('reserva_id', NEW.id::text)
  );
  RETURN NEW;
END $function$;

SELECT cron.alter_job(1, command := $cmd$
  SELECT net.http_post(
    url := 'https://project--edccd28d-e348-42cb-bb48-27a08c6f8858.lovable.app/api/public/hooks/daily-digest',
    headers := '{"Content-Type":"application/json","x-cron-secret":"9abb734b4f74b148549b4ede8197b09baade9495ccded7de"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
$cmd$);

SELECT cron.alter_job(2, command := $cmd$
  SELECT net.http_post(
    url := 'https://project--edccd28d-e348-42cb-bb48-27a08c6f8858.lovable.app/api/public/hooks/reserva-lembretes',
    headers := '{"Content-Type":"application/json","x-cron-secret":"9abb734b4f74b148549b4ede8197b09baade9495ccded7de"}'::jsonb,
    body := '{}'::jsonb
  );
$cmd$);

SELECT cron.alter_job(3, command := $cmd$
  select net.http_post(
    url := 'https://mambaiaapp.lovable.app/api/public/hooks/alertas',
    headers := '{"Content-Type":"application/json","x-cron-secret":"9abb734b4f74b148549b4ede8197b09baade9495ccded7de"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
$cmd$);