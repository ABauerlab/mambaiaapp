-- Mercado Pago: link unico, link do saldo no inicio da reserva e confirmacao do saldo. Idempotente.

alter table public.reservas add column if not exists saldo_link_enviado_em timestamptz;

-- Opcional: id do "preco diferencial" criado no painel do Mercado Pago para repassar a taxa do cartao.
-- insert into agente_config(chave, valor) values ('mp_differential_pricing_id', '<ID>') on conflict (chave) do update set valor = excluded.valor;

create or replace function public.agente_pagamento_dados(p_token text, p_reserva uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.reservas%rowtype; v_diff text;
begin
  perform public._agente_auth(p_token);
  select * into r from public.reservas where id = p_reserva;
  if not found then return jsonb_build_object('ok', false, 'erro', 'Reserva nao encontrada'); end if;
  select valor into v_diff from public.agente_config where chave = 'mp_differential_pricing_id';
  return jsonb_build_object('ok', true, 'reserva_id', r.id, 'cliente', r.cliente_nome, 'numero', r.numero_proposta,
    'status', r.status, 'paga', r.paid_at is not null, 'valor_total', r.valor_total, 'valor_sinal', r.valor_sinal,
    'valor_pago', r.valor_pago, 'diff_pricing_id', v_diff,
    'data_br', to_char(r.data,'DD/MM/YYYY'), 'hora_inicio', to_char(r.hora_inicio,'HH24:MI'));
end $$;
grant execute on function public.agente_pagamento_dados(text, uuid) to anon, authenticated;

-- Reservas com sinal pago que estao comecando agora: devolve (uma unica vez) para enviar o link do saldo.
create or replace function public.agente_saldos_pegar(p_token text, p_limite int default 5) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb; v_agora timestamp := (now() at time zone 'America/Sao_Paulo');
begin
  perform public._agente_auth(p_token);
  with c as (
    select r.id from public.reservas r
     where r.paid_at is not null and r.status <> 'cancelada' and r.saldo_link_enviado_em is null
       and r.valor_pago is not null and r.valor_pago < r.valor_total - 0.01
       and r.cliente_nome not like 'BLOQUEIO%' and length(regexp_replace(coalesce(r.cliente_whatsapp,''),'\D','','g')) >= 10
       and (r.data + r.hora_inicio) <= v_agora + interval '5 minutes'
       and (r.data + r.hora_inicio) >= v_agora - interval '3 hours'
       and not exists (select 1 from public.agente_conversas g
                        where right(g.whatsapp,8) = right(regexp_replace(r.cliente_whatsapp,'\D','','g'),8) and g.optout)
     order by r.data, r.hora_inicio limit least(greatest(p_limite,1), 10) for update of r skip locked),
  u as (
    update public.reservas r set saldo_link_enviado_em = now() from c where r.id = c.id
    returning r.id, r.cliente_nome, r.cliente_whatsapp, r.valor_total, r.valor_pago, r.hora_inicio, r.data)
  select coalesce(jsonb_agg(jsonb_build_object('reserva_id', id, 'nome', cliente_nome, 'whatsapp', cliente_whatsapp,
    'saldo', valor_total - valor_pago, 'hora_inicio', to_char(hora_inicio,'HH24:MI'))), '[]'::jsonb) into v from u;
  return v;
end $$;
grant execute on function public.agente_saldos_pegar(text, int) to anon, authenticated;

-- Libera de novo o envio do link do saldo (caso o envio tenha falhado).
create or replace function public.agente_saldo_reenviar(p_token text, p_reserva uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._agente_auth(p_token);
  update public.reservas set saldo_link_enviado_em = null where id = p_reserva;
  return jsonb_build_object('ok', true);
end $$;
grant execute on function public.agente_saldo_reenviar(text, uuid) to anon, authenticated;

-- Confirma o pagamento do saldo (somente backend/service role). Idempotente por payment_id.
create or replace function public.mp_confirmar_saldo(p_payment_id text, p_reserva uuid, p_bruto numeric, p_taxa numeric, p_metodo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.reservas%rowtype;
begin
  if exists (select 1 from public.mp_pagamentos where payment_id = p_payment_id) then
    return jsonb_build_object('ok', true, 'duplicado', true);
  end if;
  select * into r from public.reservas where id = p_reserva for update;
  if not found or r.paid_at is null or r.valor_pago is null or r.valor_pago >= r.valor_total - 0.01 then
    insert into public.mp_pagamentos (payment_id, reserva_id, status, metodo, bruto, taxa, liquido, resultado)
      values (p_payment_id, r.id, 'approved', p_metodo, p_bruto, p_taxa, p_bruto - coalesce(p_taxa,0), 'saldo_sem_pendencia') on conflict (payment_id) do nothing;
    return jsonb_build_object('ok', true, 'ja_pago', true);
  end if;
  if p_bruto < (r.valor_total - r.valor_pago) - 0.01 then
    insert into public.mp_pagamentos (payment_id, reserva_id, status, metodo, bruto, taxa, liquido, resultado)
      values (p_payment_id, r.id, 'approved', p_metodo, p_bruto, p_taxa, p_bruto - coalesce(p_taxa,0), 'valor_insuficiente') on conflict (payment_id) do nothing;
    return jsonb_build_object('ok', false, 'erro', 'valor_insuficiente');
  end if;
  update public.reservas set valor_pago = valor_total, tipo_pagamento = 'integral', status = 'paga',
         mp_taxa = coalesce(mp_taxa,0) + coalesce(p_taxa,0), mp_liquido = coalesce(mp_liquido,0) + p_bruto - coalesce(p_taxa,0)
   where id = r.id;
  insert into public.mp_pagamentos (payment_id, reserva_id, status, metodo, bruto, taxa, liquido, resultado)
    values (p_payment_id, r.id, 'approved', p_metodo, p_bruto, p_taxa, p_bruto - coalesce(p_taxa,0), 'saldo_confirmado') on conflict (payment_id) do nothing;
  insert into public.agente_eventos (tipo, reserva_id, dados) values ('mp_alerta', r.id, jsonb_build_object(
    'nome', r.cliente_nome, 'whatsapp', r.cliente_whatsapp,
    'resumo', 'Saldo pago pelo Mercado Pago: R$ ' || to_char(p_bruto,'FM999990.00') || ' (proposta ' || lpad(r.numero_proposta::text,4,'0') || '). Reserva quitada.'));
  return jsonb_build_object('ok', true, 'reserva_id', r.id);
end $$;
revoke all on function public.mp_confirmar_saldo(text, uuid, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.mp_confirmar_saldo(text, uuid, numeric, numeric, text) to service_role;
