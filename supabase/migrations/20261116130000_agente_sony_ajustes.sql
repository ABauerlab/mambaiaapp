-- Ajustes do agente Sony: pagamento conferido pela equipe, liberacao de pendentes,
-- lembrete de pagamento por inatividade e push de remarcacao/cancelamento. Idempotente.

-- 1) Distingue pagamento marcado pelo cliente (anon, nao conferido) do confirmado pela equipe (autenticado).
create or replace function public._agente_evento_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tipo text; v_old jsonb := '{}'::jsonb; v_role text;
begin
  if NEW.cliente_nome like 'BLOQUEIO%' or NEW.cliente_whatsapp = '00000000000' then return NEW; end if;
  v_role := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''),
                     nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role');
  if TG_OP = 'INSERT' then v_tipo := 'nova';
  elsif OLD.status <> 'cancelada' and NEW.status = 'cancelada' then v_tipo := 'cancelada';
  elsif OLD.paid_at is null and NEW.paid_at is not null then
    v_tipo := case when v_role = 'anon' then 'pago_cliente' else 'pago' end;
  elsif OLD.data <> NEW.data or OLD.hora_inicio <> NEW.hora_inicio then
    v_tipo := 'alterada';
    v_old := jsonb_build_object('data_anterior', to_char(OLD.data,'DD/MM/YYYY'), 'hora_anterior', to_char(OLD.hora_inicio,'HH24:MI'));
  else return NEW; end if;
  insert into public.agente_eventos (tipo, reserva_id, dados) values (v_tipo, NEW.id, v_old || jsonb_build_object(
    'cliente_nome', NEW.cliente_nome, 'whatsapp', NEW.cliente_whatsapp, 'data', to_char(NEW.data,'DD/MM/YYYY'),
    'dia_semana', public._agente_dia(NEW.data), 'hora_inicio', to_char(NEW.hora_inicio,'HH24:MI'),
    'hora_fim', to_char(NEW.hora_inicio + make_interval(mins => NEW.duracao_minutos),'HH24:MI'),
    'duracao_minutos', NEW.duracao_minutos, 'tipo_reserva', NEW.tipo, 'status', NEW.status, 'empreendimento', NEW.empreendimento,
    'numero_proposta', NEW.numero_proposta, 'valor_total', NEW.valor_total, 'valor_sinal', NEW.valor_sinal, 'valor_pago', NEW.valor_pago,
    'origem', coalesce(nullif(current_setting('app.origem', true), ''), NEW.origem),
    'fora_horario', coalesce(nullif(current_setting('app.fora_horario', true), '')::boolean, NEW.fora_horario)));
  return NEW;
end $$;

-- 2) Estado "comprovante_enviado" (aguarda conferencia manual, sem cobranca automatica).
create or replace function public.agente_lead_atualizar(p_token text, p_whatsapp text, p_estado text default null, p_nome text default null, p_resumo text default null, p_optout boolean default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fone text := public._agente_fone(p_whatsapp);
begin
  perform public._agente_auth(p_token);
  if p_estado is not null and p_estado not in ('novo','qualificando','aguardando_pagamento','comprovante_enviado','reservado','perdido','humano') then
    return jsonb_build_object('ok', false, 'erro', 'estado inválido');
  end if;
  insert into public.agente_conversas (whatsapp) values (v_fone) on conflict (whatsapp) do nothing;
  update public.agente_conversas set estado = coalesce(p_estado, estado), nome = coalesce(nullif(p_nome,''), nome),
    resumo = coalesce(p_resumo, resumo), optout = coalesce(p_optout, optout), atualizado_em = now() where whatsapp = v_fone;
  return jsonb_build_object('ok', true);
end $$;

-- 3) Follow-up: pagamento so cobrado apos inatividade do cliente depois que a Sony enviou o que ele precisa pagar.
create or replace function public.agente_followups_pegar(p_token text, p_limite int default 5) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hora int := extract(hour from now() at time zone 'America/Sao_Paulo')::int; v jsonb;
begin
  perform public._agente_auth(p_token);
  if v_hora < 9 or v_hora >= 20 then return '[]'::jsonb; end if;
  with c as (
    select whatsapp from public.agente_conversas
     where not optout and (humano_ate is null or humano_ate < now())
       and estado in ('qualificando','aguardando_pagamento')
       and ultima_msg_sony_at is not null and ultima_msg_cliente_at is not null
       and ultima_msg_cliente_at < ultima_msg_sony_at
       and ultima_msg_cliente_at > now() - interval '7 days'
       and (
         (estado = 'qualificando' and followups_enviados < 3 and (
              (followups_enviados = 0 and ultima_msg_sony_at < now() - interval '2 hours')
           or (followups_enviados = 1 and ultimo_followup_at < now() - interval '24 hours')
           or (followups_enviados = 2 and ultimo_followup_at < now() - interval '72 hours')))
         or
         (estado = 'aguardando_pagamento' and followups_enviados < 2 and (
              (followups_enviados = 0 and ultima_msg_sony_at < now() - interval '2 hours')
           or (followups_enviados = 1 and ultimo_followup_at < now() - interval '9 hours')))
       )
     order by ultima_msg_sony_at limit greatest(p_limite,1) for update skip locked),
  u as (
    update public.agente_conversas a set followups_enviados = followups_enviados + 1, ultimo_followup_at = now()
      from c where a.whatsapp = c.whatsapp
    returning a.whatsapp, a.nome, a.estado, a.resumo, a.followups_enviados)
  select coalesce(jsonb_agg(jsonb_build_object('whatsapp', u.whatsapp, 'nome', u.nome, 'estado', u.estado, 'resumo', u.resumo,
    'tentativa', u.followups_enviados,
    'ultimas_mensagens', (select coalesce(jsonb_agg(jsonb_build_object('papel', m.papel, 'texto', m.texto) order by m.id), '[]'::jsonb)
                            from (select * from public.agente_mensagens x where x.whatsapp = u.whatsapp order by id desc limit 8) m))), '[]'::jsonb) into v from u;
  return v;
end $$;

-- 4) Libera reservas pendentes feitas pela Sony sem sinal em 24h (cliente inativo e sem comprovante).
create or replace function public.agente_liberar_pendentes(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hora int := extract(hour from now() at time zone 'America/Sao_Paulo')::int; v jsonb;
begin
  perform public._agente_auth(p_token);
  if v_hora < 9 or v_hora >= 20 then return '[]'::jsonb; end if;
  perform set_config('app.origem', 'sistema', true);
  with c as (
    select r.id from public.reservas r
     where r.status = 'pendente' and r.origem = 'whatsapp' and r.cliente_nome not like 'BLOQUEIO%'
       and r.created_at < now() - interval '24 hours'
       and (r.data + r.hora_inicio) > (now() at time zone 'America/Sao_Paulo')
       and not exists (select 1 from public.agente_eventos e
                        where e.tipo = 'comprovante' and e.criado_em > r.created_at
                          and right(regexp_replace(coalesce(e.dados->>'whatsapp',''),'\D','','g'),8) = right(regexp_replace(r.cliente_whatsapp,'\D','','g'),8))
       and not exists (select 1 from public.agente_conversas g
                        where right(g.whatsapp,8) = right(regexp_replace(r.cliente_whatsapp,'\D','','g'),8)
                          and (g.humano_ate > now() or g.ultima_msg_cliente_at > now() - interval '6 hours' or g.estado = 'comprovante_enviado'))
     for update of r skip locked),
  u as (
    update public.reservas r set status = 'cancelada',
      observacoes = nullif(trim(both E'\n ' from concat_ws(E'\n', r.observacoes, 'Liberada automaticamente: sem sinal em 24h.')), '')
      from c where r.id = c.id
    returning r.id, r.cliente_nome, r.cliente_whatsapp, r.data, r.hora_inicio, r.numero_proposta)
  select coalesce(jsonb_agg(jsonb_build_object('reserva_id', id, 'nome', cliente_nome, 'whatsapp', cliente_whatsapp,
    'data_br', to_char(data,'DD/MM/YYYY'), 'dia_semana', public._agente_dia(data), 'hora_inicio', to_char(hora_inicio,'HH24:MI'),
    'numero', numero_proposta)), '[]'::jsonb) into v from u;
  return v;
end $$;

-- 5) Push (PWA) para remarcacao, cancelamento e pagamento, reaproveitando o endpoint existente.
insert into public.agente_config (chave, valor)
select 'cron_secret', (regexp_match(pg_get_functiondef('public.notify_nova_reserva'::regproc), 'x-cron-secret":"([0-9a-f]+)'))[1]
 where (regexp_match(pg_get_functiondef('public.notify_nova_reserva'::regproc), 'x-cron-secret":"([0-9a-f]+)'))[1] is not null
on conflict (chave) do update set valor = excluded.valor;

create or replace function public._agente_push_evento() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_secret text; v_ev text;
begin
  if NEW.reserva_id is null or NEW.tipo not in ('alterada','cancelada','pago','pago_cliente') then return NEW; end if;
  select valor into v_secret from public.agente_config where chave = 'cron_secret';
  if v_secret is null then return NEW; end if;
  v_ev := case NEW.tipo when 'pago_cliente' then 'pago' else NEW.tipo end;
  perform net.http_post(
    url := 'https://project--edccd28d-e348-42cb-bb48-27a08c6f8858.lovable.app/api/public/hooks/nova-reserva',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('reserva_id', NEW.reserva_id::text, 'evento', v_ev));
  return NEW;
end $$;

drop trigger if exists trg_agente_push_evento on public.agente_eventos;
create trigger trg_agente_push_evento after insert on public.agente_eventos
  for each row execute function public._agente_push_evento();

revoke all on function public._agente_push_evento() from public, anon, authenticated;
revoke all on function public.agente_liberar_pendentes(text) from public;
grant execute on function public.agente_liberar_pendentes(text) to anon, authenticated;
