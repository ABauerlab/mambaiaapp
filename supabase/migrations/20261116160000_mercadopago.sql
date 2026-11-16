-- Mercado Pago: link de pagamento (PIX e cartao com taxa repassada), confirmacao automatica e registro financeiro. Idempotente.

alter table public.reservas
  add column if not exists mp_payment_id text,
  add column if not exists mp_metodo text,
  add column if not exists mp_taxa numeric(12,2),
  add column if not exists mp_liquido numeric(12,2);

create table if not exists public.mp_pagamentos (
  payment_id text primary key,
  reserva_id uuid references public.reservas(id) on delete set null,
  status text not null,
  metodo text,
  bruto numeric(12,2),
  taxa numeric(12,2),
  liquido numeric(12,2),
  resultado text,
  criado_em timestamptz not null default now()
);
alter table public.mp_pagamentos enable row level security; -- sem policies: so o backend (service role) acessa

insert into public.agente_config (chave, valor) values ('mp_taxa_cartao', '0.0498') on conflict (chave) do nothing;

-- Dados para gerar o link (protegido pelo token do agente).
create or replace function public.agente_pagamento_dados(p_token text, p_reserva uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.reservas%rowtype; v_taxa numeric;
begin
  perform public._agente_auth(p_token);
  select * into r from public.reservas where id = p_reserva;
  if not found then return jsonb_build_object('ok', false, 'erro', 'Reserva nao encontrada'); end if;
  select valor::numeric into v_taxa from public.agente_config where chave = 'mp_taxa_cartao';
  return jsonb_build_object('ok', true, 'reserva_id', r.id, 'cliente', r.cliente_nome, 'numero', r.numero_proposta,
    'status', r.status, 'paga', r.paid_at is not null, 'valor_total', r.valor_total, 'valor_sinal', r.valor_sinal,
    'taxa_cartao', coalesce(v_taxa, 0.0498), 'data_br', to_char(r.data,'DD/MM/YYYY'), 'hora_inicio', to_char(r.hora_inicio,'HH24:MI'));
end $$;
grant execute on function public.agente_pagamento_dados(text, uuid) to anon, authenticated;

-- Confirma o pagamento aprovado no Mercado Pago (somente backend/service role). Idempotente por payment_id.
create or replace function public.mp_confirmar_pagamento(p_payment_id text, p_reserva uuid, p_bruto numeric, p_taxa numeric, p_metodo text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.reservas%rowtype; v_valor numeric; v_tipo text; v_now timestamptz := now(); v_cob uuid;
begin
  if exists (select 1 from public.mp_pagamentos where payment_id = p_payment_id and resultado in ('confirmado','ja_pago','valor_insuficiente')) then
    return jsonb_build_object('ok', true, 'duplicado', true);
  end if;
  select * into r from public.reservas where id = p_reserva for update;
  if not found then
    insert into public.mp_pagamentos (payment_id, status, metodo, bruto, taxa, liquido, resultado)
      values (p_payment_id, 'approved', p_metodo, p_bruto, p_taxa, p_bruto - coalesce(p_taxa,0), 'reserva_inexistente') on conflict (payment_id) do nothing;
    return jsonb_build_object('ok', false, 'erro', 'reserva_inexistente');
  end if;
  if r.paid_at is not null then
    insert into public.mp_pagamentos (payment_id, reserva_id, status, metodo, bruto, taxa, liquido, resultado)
      values (p_payment_id, r.id, 'approved', p_metodo, p_bruto, p_taxa, p_bruto - coalesce(p_taxa,0), 'ja_pago') on conflict (payment_id) do nothing;
    return jsonb_build_object('ok', true, 'ja_pago', true, 'reserva_id', r.id);
  end if;
  if p_bruto >= r.valor_total - 0.01 then v_valor := r.valor_total; v_tipo := 'integral';
  elsif p_bruto >= r.valor_sinal - 0.01 then v_valor := r.valor_sinal; v_tipo := 'parcial';
  else
    insert into public.mp_pagamentos (payment_id, reserva_id, status, metodo, bruto, taxa, liquido, resultado)
      values (p_payment_id, r.id, 'approved', p_metodo, p_bruto, p_taxa, p_bruto - coalesce(p_taxa,0), 'valor_insuficiente') on conflict (payment_id) do nothing;
    return jsonb_build_object('ok', false, 'erro', 'valor_insuficiente', 'reserva_id', r.id);
  end if;
  v_cob := r.cobranca_id;
  if v_cob is not null then update public.cobrancas set status = 'pago', paid_at = v_now where id = v_cob; end if;
  update public.reservas set status = case when v_tipo = 'integral' then 'paga' else 'confirmada' end,
         paid_at = v_now, valor_pago = v_valor, tipo_pagamento = v_tipo,
         mp_payment_id = p_payment_id, mp_metodo = p_metodo, mp_taxa = p_taxa, mp_liquido = p_bruto - coalesce(p_taxa,0)
   where id = r.id;
  insert into public.mp_pagamentos (payment_id, reserva_id, status, metodo, bruto, taxa, liquido, resultado)
    values (p_payment_id, r.id, 'approved', p_metodo, p_bruto, p_taxa, p_bruto - coalesce(p_taxa,0), 'confirmado') on conflict (payment_id) do nothing;
  return jsonb_build_object('ok', true, 'reserva_id', r.id, 'tipo', v_tipo);
end $$;
revoke all on function public.mp_confirmar_pagamento(text, uuid, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.mp_confirmar_pagamento(text, uuid, numeric, numeric, text) to service_role;
