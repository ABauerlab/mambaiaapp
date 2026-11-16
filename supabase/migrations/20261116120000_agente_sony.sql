-- Agente Sony (WhatsApp / n8n): funcoes de agenda, reservas, memoria e fila de eventos.
-- Idempotente. Todas as funcoes agente_* exigem um token (hash em agente_config.token_hash).
-- O token NAO fica neste arquivo: gravar com
--   insert into agente_config(chave, valor) values ('token_hash', encode(sha256(convert_to('<TOKEN>','utf8')),'hex'))
--   on conflict (chave) do update set valor = excluded.valor;

create table if not exists public.agente_config (chave text primary key, valor text not null);
alter table public.agente_config enable row level security;
revoke all on public.agente_config from anon, authenticated;

create table if not exists public.agente_feriados (data date primary key, nome text not null);
alter table public.agente_feriados enable row level security;
revoke all on public.agente_feriados from anon, authenticated;

insert into public.agente_feriados (data, nome) values
  ('2026-11-20','Consciência Negra'),('2026-12-08','Nossa Senhora da Conceição'),('2026-12-25','Natal'),
  ('2027-01-01','Confraternização Universal'),('2027-03-26','Sexta-feira Santa'),('2027-04-21','Tiradentes'),
  ('2027-05-01','Dia do Trabalho'),('2027-05-27','Corpus Christi'),('2027-09-07','Independência'),
  ('2027-10-12','Nossa Senhora Aparecida'),('2027-11-02','Finados'),('2027-11-15','Proclamação da República'),
  ('2027-11-20','Consciência Negra'),('2027-12-08','Nossa Senhora da Conceição'),('2027-12-25','Natal')
on conflict (data) do nothing;

alter table public.reservas add column if not exists remarcacoes int not null default 0;
alter table public.reservas add column if not exists origem text not null default 'site';
alter table public.reservas add column if not exists fora_horario boolean not null default false;
alter table public.reservas add column if not exists cliente_lembrete_24h_at timestamptz;
alter table public.reservas add column if not exists cliente_lembrete_1h_at timestamptz;

create table if not exists public.agente_conversas (
  whatsapp text primary key,
  nome text,
  estado text not null default 'novo',
  resumo text,
  ultima_msg_cliente_at timestamptz,
  ultima_msg_sony_at timestamptz,
  followups_enviados int not null default 0,
  ultimo_followup_at timestamptz,
  optout boolean not null default false,
  humano_ate timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create table if not exists public.agente_mensagens (
  id bigserial primary key,
  whatsapp text not null,
  papel text not null check (papel in ('cliente','sony','humano')),
  texto text not null,
  tipo text not null default 'texto',
  wa_id text,
  criado_em timestamptz not null default now()
);
create unique index if not exists agente_mensagens_wa_id_uq on public.agente_mensagens (wa_id) where wa_id is not null;
create index if not exists agente_mensagens_fone_idx on public.agente_mensagens (whatsapp, id desc);
create table if not exists public.agente_eventos (
  id bigserial primary key,
  tipo text not null,
  reserva_id uuid,
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  reservado_em timestamptz,
  enviado_em timestamptz,
  tentativas int not null default 0,
  erro text
);
create index if not exists agente_eventos_pend_idx on public.agente_eventos (id) where enviado_em is null;
alter table public.agente_conversas enable row level security;
alter table public.agente_mensagens enable row level security;
alter table public.agente_eventos enable row level security;
revoke all on public.agente_conversas, public.agente_mensagens, public.agente_eventos from anon, authenticated;
revoke all on sequence public.agente_mensagens_id_seq, public.agente_eventos_id_seq from anon, authenticated;

-- ---------- helpers internos ----------
create or replace function public._agente_auth(p_token text) returns void
language plpgsql security definer set search_path = public as $$
declare v_hdr text; v_tok text;
begin
  -- Prefere o header x-agente-token (credencial do n8n); aceita o parametro como alternativa.
  begin
    v_hdr := nullif(current_setting('request.headers', true)::jsonb ->> 'x-agente-token', '');
  exception when others then
    v_hdr := null;
  end;
  v_tok := coalesce(v_hdr, nullif(p_token, ''));
  if v_tok is null or not exists (
    select 1 from public.agente_config
    where chave = 'token_hash' and valor = encode(sha256(convert_to(v_tok,'utf8')),'hex')
  ) then
    raise exception 'nao autorizado' using errcode = '28000';
  end if;
end $$;

create or replace function public._agente_fone(p text) returns text
language sql immutable as $$
  select case when length(d) in (12,13) and left(d,2) = '55' then substr(d,3) else d end
  from (select regexp_replace(coalesce(p,''), '\D', '', 'g') as d) x $$;

create or replace function public._agente_janela(p_data date, out aberto boolean, out abre time, out fecha time, out motivo text)
language plpgsql stable security definer set search_path = public as $$
declare v_dow int := extract(dow from p_data)::int; v_fer text;
begin
  select nome into v_fer from public.agente_feriados where data = p_data;
  if v_fer is not null then aberto := false; motivo := 'Feriado: ' || v_fer; return; end if;
  if v_dow = 0 then aberto := false; motivo := 'Domingo (fechado)'; return; end if;
  aberto := true; abre := '09:00'; fecha := case when v_dow = 6 then '15:00'::time else '18:00'::time end;
end $$;

create or replace function public._agente_livres(p_data date, p_dur int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare j record; v_agora timestamp := now() at time zone 'America/Sao_Paulo'; m int; v_out jsonb := '[]'::jsonb;
begin
  select * into j from public._agente_janela(p_data);
  if not j.aberto then return v_out; end if;
  for m in select generate_series(extract(hour from j.abre)::int * 60, extract(hour from j.fecha)::int * 60 - p_dur, 30) loop
    if (p_data + make_interval(mins => m)) > v_agora
       and not exists (
         select 1 from public.reservas r
         where r.data = p_data and r.status <> 'cancelada'
           and m < extract(epoch from r.hora_inicio)/60 + r.duracao_minutos
           and extract(epoch from r.hora_inicio)/60 < m + p_dur
       ) then
      v_out := v_out || to_jsonb(lpad((m/60)::text,2,'0') || ':' || lpad((m%60)::text,2,'0'));
    end if;
  end loop;
  return v_out;
end $$;

create or replace function public._agente_dia(p_data date) returns text language sql immutable as $$
  select (array['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'])[extract(dow from p_data)::int + 1] $$;

create or replace function public._agente_reserva_json(p_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'reserva_id', r.id, 'numero_proposta', r.numero_proposta,
    'data', to_char(r.data,'YYYY-MM-DD'), 'data_br', to_char(r.data,'DD/MM/YYYY'), 'dia_semana', public._agente_dia(r.data),
    'hora_inicio', to_char(r.hora_inicio,'HH24:MI'), 'hora_fim', to_char(r.hora_inicio + make_interval(mins => r.duracao_minutos),'HH24:MI'),
    'duracao_minutos', r.duracao_minutos, 'tipo', r.tipo, 'status', r.status, 'cliente_nome', r.cliente_nome,
    'empreendimento', r.empreendimento, 'valor_total', r.valor_total, 'valor_sinal', r.valor_sinal, 'valor_pago', r.valor_pago,
    'remarcacoes', r.remarcacoes, 'fora_horario', r.fora_horario,
    'pix_chave', c.pix_chave, 'pix_nome', c.pix_nome,
    'link_pagamento', case when c.slug is null then null else 'https://mambaiabh.com.br/cobranca/' || c.slug end
  )
  from public.reservas r left join public.cobrancas c on c.id = r.cobranca_id where r.id = p_id $$;

-- ---------- agenda ----------
create or replace function public.agente_horarios(p_token text, p_data date, p_duracao int default 60) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare j record; v_preco numeric := public.calc_preco_reserva(p_duracao); v_ocup jsonb;
begin
  perform public._agente_auth(p_token);
  if v_preco is null then
    return jsonb_build_object('ok', false, 'erro', 'Duração inválida. Use 30, 60, 90, 120, 150, 180, 210 ou 240 minutos.');
  end if;
  select * into j from public._agente_janela(p_data);
  select coalesce(jsonb_agg(jsonb_build_object('inicio', to_char(hora_inicio,'HH24:MI'),
           'fim', to_char(hora_inicio + make_interval(mins => duracao_minutos),'HH24:MI')) order by hora_inicio), '[]'::jsonb)
    into v_ocup from public.reservas where data = p_data and status <> 'cancelada';
  return jsonb_build_object('ok', true, 'data', to_char(p_data,'YYYY-MM-DD'), 'data_br', to_char(p_data,'DD/MM/YYYY'),
    'dia_semana', public._agente_dia(p_data), 'aberto', j.aberto, 'motivo_fechado', j.motivo,
    'funcionamento', case when j.aberto then to_char(j.abre,'HH24:MI') || ' às ' || to_char(j.fecha,'HH24:MI') end,
    'duracao_minutos', p_duracao, 'valor_total', v_preco, 'valor_sinal', round(v_preco * 0.5, 2),
    'horarios_livres_inicio', public._agente_livres(p_data, p_duracao), 'ocupados', v_ocup);
end $$;

create or replace function public.agente_agenda(p_token text, p_duracao int default 60, p_de date default null, p_dias int default 14) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_de date := coalesce(p_de, (now() at time zone 'America/Sao_Paulo')::date); d date; v_out jsonb := '[]'::jsonb; v_l jsonb;
begin
  perform public._agente_auth(p_token);
  if public.calc_preco_reserva(p_duracao) is null then
    return jsonb_build_object('ok', false, 'erro', 'Duração inválida');
  end if;
  for d in select generate_series(v_de, v_de + least(greatest(p_dias,1), 30) - 1, interval '1 day')::date loop
    v_l := public._agente_livres(d, p_duracao);
    if jsonb_array_length(v_l) > 0 then
      v_out := v_out || jsonb_build_object('data', to_char(d,'YYYY-MM-DD'), 'data_br', to_char(d,'DD/MM'),
        'dia_semana', public._agente_dia(d), 'qtd_horarios', jsonb_array_length(v_l), 'horarios_livres_inicio', v_l);
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'duracao_minutos', p_duracao, 'dias_com_vaga', v_out);
end $$;

-- ---------- reservas ----------
create or replace function public.agente_criar_reserva(
  p_token text, p_data date, p_hora time, p_duracao int, p_nome text, p_whatsapp text,
  p_pacote text default null, p_empreendimento text default null, p_qtd_marcas int default 1, p_observacoes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_fone text := public._agente_fone(p_whatsapp); v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_dur int; v_fora boolean; j record; r record; v_exist uuid;
begin
  perform public._agente_auth(p_token);
  v_dur := case p_pacote when 'marcas' then 60 when 'express' then 120 when 'lookbook' then 180 when 'campanha' then 240 when 'creator' then 120 else p_duracao end;
  if p_pacote is not null and p_pacote not in ('marcas','express','lookbook','campanha','creator') then
    return jsonb_build_object('ok', false, 'erro', 'Pacote inválido. Use marcas, express, lookbook, campanha ou creator.');
  end if;
  if (p_data + p_hora) <= v_agora then return jsonb_build_object('ok', false, 'erro', 'Esse horário já passou.'); end if;
  if length(v_fone) < 10 then return jsonb_build_object('ok', false, 'erro', 'WhatsApp inválido.'); end if;

  select id into v_exist from public.reservas
   where right(regexp_replace(cliente_whatsapp,'\D','','g'),8) = right(v_fone,8)
     and data = p_data and hora_inicio = p_hora and status <> 'cancelada' limit 1;
  if v_exist is not null then
    return jsonb_build_object('ok', true, 'ja_existia', true) || public._agente_reserva_json(v_exist);
  end if;

  select * into j from public._agente_janela(p_data);
  v_fora := (not j.aberto) or p_hora < j.abre or (p_hora + make_interval(mins => v_dur)) > j.fecha;

  perform set_config('app.origem', 'whatsapp', true);
  perform set_config('app.fora_horario', v_fora::text, true);
  begin
    if p_pacote is null then
      select * into r from public.criar_reserva(p_data, p_hora, p_duracao, p_nome, v_fone);
    elsif p_pacote = 'marcas' then
      select * into r from public.criar_reserva_pacote(p_data, p_hora, p_nome, v_fone, coalesce(p_empreendimento,''), greatest(1, coalesce(p_qtd_marcas,1)));
    else
      select * into r from public.criar_reserva_producao(p_data, p_hora, p_pacote, p_nome, v_fone, p_empreendimento);
    end if;
  exception when others then
    return jsonb_build_object('ok', false, 'erro', sqlerrm);
  end;

  update public.reservas set origem = 'whatsapp', fora_horario = v_fora,
    observacoes = nullif(trim(both E'\n ' from concat_ws(E'\n', observacoes,
      case when v_fora then 'FORA DO HORÁRIO NORMAL: equipe precisa organizar este horário.' end, p_observacoes)), '')
   where id = r.reserva_id;
  return jsonb_build_object('ok', true, 'ja_existia', false) || public._agente_reserva_json(r.reserva_id);
end $$;

create or replace function public.agente_minhas_reservas(p_token text, p_whatsapp text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_fone text := public._agente_fone(p_whatsapp); v_out jsonb;
begin
  perform public._agente_auth(p_token);
  select coalesce(jsonb_agg(public._agente_reserva_json(id) order by data, hora_inicio), '[]'::jsonb) into v_out
    from public.reservas
   where length(v_fone) >= 8 and right(regexp_replace(cliente_whatsapp,'\D','','g'),8) = right(v_fone,8)
     and cliente_nome not like 'BLOQUEIO%' and status <> 'cancelada'
     and data >= (now() at time zone 'America/Sao_Paulo')::date;
  return v_out;
end $$;

create or replace function public.agente_alterar_reserva(p_token text, p_reserva uuid, p_whatsapp text, p_nova_data date, p_nova_hora time) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.reservas%rowtype; v_agora timestamp := now() at time zone 'America/Sao_Paulo';
  v_ini timestamp; v_novo timestamp := p_nova_data + p_nova_hora; v_fim time; j record; v_fora boolean;
begin
  perform public._agente_auth(p_token);
  select * into r from public.reservas where id = p_reserva;
  if not found or right(regexp_replace(r.cliente_whatsapp,'\D','','g'),8) <> right(public._agente_fone(p_whatsapp),8) then
    return jsonb_build_object('ok', false, 'erro', 'Reserva não encontrada para este número.');
  end if;
  if r.status = 'cancelada' then return jsonb_build_object('ok', false, 'erro', 'Reserva já está cancelada.'); end if;
  v_ini := r.data + r.hora_inicio;
  if v_ini <= v_agora then return jsonb_build_object('ok', false, 'escalar', true, 'erro', 'Reserva já passou.'); end if;
  if v_ini - v_agora < interval '48 hours' then
    return jsonb_build_object('ok', false, 'escalar', true, 'erro', 'Faltam menos de 48h: pelo termo, não há direito a remarcação. Encaminhar para a equipe decidir.');
  end if;
  if r.remarcacoes >= 1 then
    return jsonb_build_object('ok', false, 'escalar', true, 'erro', 'Esta reserva já foi remarcada uma vez. Encaminhar para a equipe.');
  end if;
  if v_novo <= v_agora then return jsonb_build_object('ok', false, 'erro', 'O novo horário já passou.'); end if;
  if p_nova_data > r.data + 90 then return jsonb_build_object('ok', false, 'erro', 'A remarcação precisa ser em até 90 dias da data original.'); end if;
  v_fim := p_nova_hora + make_interval(mins => r.duracao_minutos);
  if exists (select 1 from public.reservas x where x.id <> r.id and x.data = p_nova_data and x.status <> 'cancelada'
      and tsrange(p_nova_data + p_nova_hora, p_nova_data + v_fim, '[)') &&
          tsrange(x.data + x.hora_inicio, x.data + x.hora_inicio + make_interval(mins => x.duracao_minutos), '[)')) then
    return jsonb_build_object('ok', false, 'erro', 'Esse novo horário já está reservado.');
  end if;
  select * into j from public._agente_janela(p_nova_data);
  v_fora := (not j.aberto) or p_nova_hora < j.abre or v_fim > j.fecha;
  perform set_config('app.origem', 'whatsapp', true);

  update public.reservas set data = p_nova_data, hora_inicio = p_nova_hora, remarcacoes = remarcacoes + 1, fora_horario = v_fora,
    lembrete_24h_enviado_at = null, lembrete_1h_enviado_at = null, cliente_lembrete_24h_at = null, cliente_lembrete_1h_at = null,
    observacoes = nullif(trim(both E'\n ' from concat_ws(E'\n', observacoes,
      'Remarcada via WhatsApp de ' || to_char(r.data,'DD/MM/YYYY') || ' ' || to_char(r.hora_inicio,'HH24:MI'),
      case when v_fora then 'FORA DO HORÁRIO NORMAL: equipe precisa organizar este horário.' end)), '')
   where id = r.id;
  if r.cobranca_id is not null then
    update public.cobrancas set
      titulo = regexp_replace(titulo, '\d{2}/\d{2}/\d{4} \d{2}:\d{2}$', to_char(p_nova_data,'DD/MM/YYYY') || ' ' || to_char(p_nova_hora,'HH24:MI')),
      itens = regexp_replace(itens::text, '\d{2}:\d{2} às \d{2}:\d{2}', to_char(p_nova_hora,'HH24:MI') || ' às ' || to_char(v_fim,'HH24:MI'))::jsonb
     where id = r.cobranca_id;
  end if;
  return jsonb_build_object('ok', true) || public._agente_reserva_json(r.id);
end $$;

create or replace function public.agente_cancelar_reserva(p_token text, p_reserva uuid, p_whatsapp text, p_motivo text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.reservas%rowtype; v_agora timestamp := now() at time zone 'America/Sao_Paulo'; v_horas numeric;
begin
  perform public._agente_auth(p_token);
  select * into r from public.reservas where id = p_reserva;
  if not found or right(regexp_replace(r.cliente_whatsapp,'\D','','g'),8) <> right(public._agente_fone(p_whatsapp),8) then
    return jsonb_build_object('ok', false, 'erro', 'Reserva não encontrada para este número.');
  end if;
  if r.status = 'cancelada' then return jsonb_build_object('ok', false, 'erro', 'Reserva já está cancelada.'); end if;
  v_horas := round(extract(epoch from ((r.data + r.hora_inicio) - v_agora)) / 3600, 1);
  perform set_config('app.origem', 'whatsapp', true);
  update public.reservas set status = 'cancelada',
    observacoes = nullif(trim(both E'\n ' from concat_ws(E'\n', observacoes, 'Cancelada via WhatsApp: ' || coalesce(p_motivo,'sem motivo informado'))), '')
   where id = r.id;
  return jsonb_build_object('ok', true, 'reserva_id', r.id, 'antecedencia_horas', v_horas, 'menos_de_48h', v_horas < 48,
    'ja_pago', r.paid_at is not null, 'valor_pago', r.valor_pago,
    'aviso_equipe', 'Equipe define se há reembolso/remarcação conforme o termo (48h).');
end $$;

-- ---------- eventos (fila para o grupo dos donos) ----------
create or replace function public._agente_evento_reserva() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_tipo text; v_old jsonb := '{}'::jsonb;
begin
  if NEW.cliente_nome like 'BLOQUEIO%' or NEW.cliente_whatsapp = '00000000000' then return NEW; end if;
  if TG_OP = 'INSERT' then v_tipo := 'nova';
  elsif OLD.status <> 'cancelada' and NEW.status = 'cancelada' then v_tipo := 'cancelada';
  elsif OLD.paid_at is null and NEW.paid_at is not null then v_tipo := 'pago';
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
    'origem', coalesce(nullif(current_setting('app.origem', true), ''), 'site'),
    'fora_horario', coalesce(nullif(current_setting('app.fora_horario', true), '')::boolean, NEW.fora_horario)));
  return NEW;
end $$;

drop trigger if exists trg_agente_evento_reserva on public.reservas;
create trigger trg_agente_evento_reserva after insert or update on public.reservas
  for each row execute function public._agente_evento_reserva();

create or replace function public.agente_evento_criar(p_token text, p_tipo text, p_whatsapp text default null, p_dados jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public._agente_auth(p_token);
  insert into public.agente_eventos (tipo, dados) values (p_tipo, coalesce(p_dados,'{}'::jsonb) || jsonb_build_object('whatsapp', p_whatsapp)) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.agente_eventos_pegar(p_token text, p_limite int default 10) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  perform public._agente_auth(p_token);
  with u as (
    update public.agente_eventos e set reservado_em = now(), tentativas = tentativas + 1
     where e.id in (select id from public.agente_eventos
                     where enviado_em is null and tentativas < 5 and (reservado_em is null or reservado_em < now() - interval '3 minutes')
                     order by id limit greatest(p_limite,1) for update skip locked)
     returning e.id, e.tipo, e.reserva_id, e.dados, e.criado_em)
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'reserva_id', reserva_id, 'dados', dados, 'criado_em', criado_em) order by id), '[]'::jsonb) into v from u;
  return v;
end $$;

create or replace function public.agente_evento_resultado(p_token text, p_id bigint, p_ok boolean, p_erro text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public._agente_auth(p_token);
  update public.agente_eventos set enviado_em = case when p_ok then now() end, erro = case when p_ok then null else p_erro end where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- memoria de conversa / leads ----------
create or replace function public.agente_msg_registrar(p_token text, p_whatsapp text, p_nome text, p_papel text, p_texto text, p_tipo text default 'texto', p_wa_id text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fone text := public._agente_fone(p_whatsapp); c public.agente_conversas%rowtype; v_id bigint;
begin
  perform public._agente_auth(p_token);
  insert into public.agente_conversas (whatsapp, nome) values (v_fone, nullif(p_nome,'')) on conflict (whatsapp) do nothing;
  if p_wa_id is not null and exists (select 1 from public.agente_mensagens where wa_id = p_wa_id) then
    return jsonb_build_object('ok', true, 'duplicada', true);
  end if;
  insert into public.agente_mensagens (whatsapp, papel, texto, tipo, wa_id) values (v_fone, p_papel, p_texto, coalesce(p_tipo,'texto'), p_wa_id) returning id into v_id;
  if p_papel = 'cliente' then
    update public.agente_conversas set ultima_msg_cliente_at = now(), followups_enviados = 0, atualizado_em = now(),
      nome = coalesce(nome, nullif(p_nome,'')), estado = case when estado in ('perdido','novo') then 'qualificando' else estado end
     where whatsapp = v_fone;
  elsif p_papel = 'sony' then
    update public.agente_conversas set ultima_msg_sony_at = now(), atualizado_em = now() where whatsapp = v_fone;
  else
    update public.agente_conversas set humano_ate = now() + interval '6 hours', atualizado_em = now() where whatsapp = v_fone;
  end if;
  select * into c from public.agente_conversas where whatsapp = v_fone;
  return jsonb_build_object('ok', true, 'duplicada', false, 'msg_id', v_id, 'humano_ativo', coalesce(c.humano_ate > now(), false), 'optout', c.optout, 'estado', c.estado);
end $$;

create or replace function public.agente_historico(p_token text, p_whatsapp text, p_limite int default 40) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_fone text := public._agente_fone(p_whatsapp); v_conv jsonb; v_msgs jsonb;
begin
  perform public._agente_auth(p_token);
  select to_jsonb(c) - 'criado_em' into v_conv from public.agente_conversas c where whatsapp = v_fone;
  select coalesce(jsonb_agg(jsonb_build_object('papel', papel, 'texto', texto, 'tipo', tipo,
           'quando', to_char(criado_em at time zone 'America/Sao_Paulo','DD/MM HH24:MI')) order by id), '[]'::jsonb) into v_msgs
    from (select * from public.agente_mensagens where whatsapp = v_fone order by id desc limit greatest(p_limite,1)) m;
  return jsonb_build_object('conversa', v_conv, 'mensagens', v_msgs, 'reservas_ativas', public.agente_minhas_reservas(p_token, v_fone),
    'ultimo_msg_cliente_id', (select max(id) from public.agente_mensagens where whatsapp = v_fone and papel = 'cliente'),
    'agora_brt', to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI'),
    'hoje_dia_semana', public._agente_dia((now() at time zone 'America/Sao_Paulo')::date));
end $$;

create or replace function public.agente_lead_atualizar(p_token text, p_whatsapp text, p_estado text default null, p_nome text default null, p_resumo text default null, p_optout boolean default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fone text := public._agente_fone(p_whatsapp);
begin
  perform public._agente_auth(p_token);
  if p_estado is not null and p_estado not in ('novo','qualificando','aguardando_pagamento','reservado','perdido','humano') then
    return jsonb_build_object('ok', false, 'erro', 'estado inválido');
  end if;
  insert into public.agente_conversas (whatsapp) values (v_fone) on conflict (whatsapp) do nothing;
  update public.agente_conversas set estado = coalesce(p_estado, estado), nome = coalesce(nullif(p_nome,''), nome),
    resumo = coalesce(p_resumo, resumo), optout = coalesce(p_optout, optout), atualizado_em = now() where whatsapp = v_fone;
  return jsonb_build_object('ok', true);
end $$;

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
       and followups_enviados < 3
       and ((followups_enviados = 0 and ultima_msg_sony_at < now() - interval '2 hours')
         or (followups_enviados = 1 and ultimo_followup_at < now() - interval '24 hours')
         or (followups_enviados = 2 and ultimo_followup_at < now() - interval '72 hours'))
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

create or replace function public.agente_lembretes_pegar(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb := '[]'::jsonb; v_agora timestamp := now() at time zone 'America/Sao_Paulo'; v2 jsonb;
begin
  perform public._agente_auth(p_token);
  with u as (
    update public.reservas r set cliente_lembrete_24h_at = now()
     where r.status in ('confirmada','paga') and r.cliente_lembrete_24h_at is null and r.cliente_nome not like 'BLOQUEIO%'
       and (r.data + r.hora_inicio) between v_agora + interval '23 hours' and v_agora + interval '25 hours'
    returning r.id, r.cliente_whatsapp)
  select coalesce(jsonb_agg(public._agente_reserva_json(id) || jsonb_build_object('lembrete','24h','whatsapp', cliente_whatsapp)), '[]'::jsonb) into v from u;
  with u as (
    update public.reservas r set cliente_lembrete_1h_at = now()
     where r.status in ('confirmada','paga') and r.cliente_lembrete_1h_at is null and r.cliente_nome not like 'BLOQUEIO%'
       and (r.data + r.hora_inicio) between v_agora + interval '50 minutes' and v_agora + interval '75 minutes'
    returning r.id, r.cliente_whatsapp)
  select coalesce(jsonb_agg(public._agente_reserva_json(id) || jsonb_build_object('lembrete','1h','whatsapp', cliente_whatsapp)), '[]'::jsonb) into v2 from u;
  return v || v2;
end $$;

-- ---------- documento (proposta/comprovante em PDF) ----------
-- Chave por reserva derivada do token: permite o Evolution baixar o PDF por URL sem expor o token do agente.
create or replace function public._agente_doc_chave(p_reserva uuid) returns text
language sql stable security definer set search_path = public as $$
  select left(encode(sha256(convert_to(valor || p_reserva::text || ':doc','utf8')),'hex'), 24)
  from public.agente_config where chave = 'token_hash' $$;

create or replace function public.agente_documento_url(p_token text, p_reserva uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_slug text; v_nome text; v_num int;
begin
  perform public._agente_auth(p_token);
  select c.slug, r.cliente_nome, r.numero_proposta into v_slug, v_nome, v_num
    from public.reservas r join public.cobrancas c on c.id = r.cobranca_id where r.id = p_reserva;
  if v_slug is null then return jsonb_build_object('ok', false, 'erro', 'Reserva sem cobrança'); end if;
  return jsonb_build_object('ok', true,
    'url', 'https://mambaiabh.com.br/api/public/agente/proposta?slug=' || v_slug || '&k=' || public._agente_doc_chave(p_reserva),
    'nome_arquivo', 'proposta-comercial-' || v_num || '.pdf');
end $$;

create or replace function public.agente_documento_dados(p_slug text, p_chave text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r public.reservas%rowtype; c public.cobrancas%rowtype;
begin
  select * into c from public.cobrancas where slug = p_slug;
  if not found then return null; end if;
  select * into r from public.reservas where cobranca_id = c.id limit 1;
  if not found or p_chave is distinct from public._agente_doc_chave(r.id) then return null; end if;
  return jsonb_build_object('cliente', r.cliente_nome, 'whatsapp', r.cliente_whatsapp, 'data', to_char(r.data,'YYYY-MM-DD'),
    'hora_inicio', to_char(r.hora_inicio,'HH24:MI'), 'duracao_minutos', r.duracao_minutos, 'valor_total', r.valor_total,
    'valor_sinal', r.valor_sinal, 'valor_pago', r.valor_pago, 'tipo_pagamento', r.tipo_pagamento, 'paid_at', r.paid_at,
    'status', r.status, 'numero_proposta', r.numero_proposta, 'tipo', r.tipo, 'empreendimento', r.empreendimento,
    'pix_chave', c.pix_chave, 'pix_nome', c.pix_nome, 'slug', c.slug);
end $$;

-- ---------- permissoes ----------
revoke all on function public._agente_auth(text), public._agente_fone(text), public._agente_janela(date), public._agente_livres(date,int),
  public._agente_dia(date), public._agente_reserva_json(uuid), public._agente_evento_reserva(), public._agente_doc_chave(uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'agente_horarios(text,date,int)','agente_agenda(text,int,date,int)',
    'agente_criar_reserva(text,date,time,int,text,text,text,text,int,text)','agente_minhas_reservas(text,text)',
    'agente_alterar_reserva(text,uuid,text,date,time)','agente_cancelar_reserva(text,uuid,text,text)',
    'agente_evento_criar(text,text,text,jsonb)','agente_eventos_pegar(text,int)','agente_evento_resultado(text,bigint,boolean,text)',
    'agente_msg_registrar(text,text,text,text,text,text,text)','agente_historico(text,text,int)',
    'agente_lead_atualizar(text,text,text,text,text,boolean)','agente_followups_pegar(text,int)','agente_lembretes_pegar(text)',
    'agente_documento_url(text,uuid)','agente_documento_dados(text,text)']
  loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;
