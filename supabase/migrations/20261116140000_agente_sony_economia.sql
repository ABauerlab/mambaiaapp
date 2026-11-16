-- Sony: preco acima de 4h, respostas enxutas (tokens) e protecoes contra spam/banimento (API nao oficial). Idempotente.

-- 1) Preco: tabela base e R$ 75 por hora acima de 4h (8h = R$ 600). Multiplos de 30 min, ate 12h.
create or replace function public.calc_preco_reserva(_minutos integer) returns numeric
language sql immutable set search_path = public as $$
  select (case _minutos
    when 30 then 50 when 60 then 100 when 90 then 150 when 120 then 180
    when 150 then 230 when 180 then 250 when 210 then 280 when 240 then 300
    else case when _minutos > 240 and _minutos <= 720 and _minutos % 30 = 0 then _minutos * 1.25 end
  end)::numeric $$;

-- 2) Faixas de inicio compactas (menos tokens para o agente).
create or replace function public._agente_faixas(p_livres jsonb) returns text
language plpgsql immutable as $$
declare e text; v_ini text; v_prev int; v_cur int; v_out text := '';
begin
  for e in select jsonb_array_elements_text(p_livres) loop
    v_cur := split_part(e, ':', 1)::int * 60 + split_part(e, ':', 2)::int;
    if v_ini is null then v_ini := e; v_prev := v_cur;
    elsif v_cur = v_prev + 30 then v_prev := v_cur;
    else
      v_out := v_out || case when v_out = '' then '' else ', ' end || v_ini || ' a ' || lpad((v_prev/60)::text,2,'0') || ':' || lpad((v_prev%60)::text,2,'0');
      v_ini := e; v_prev := v_cur;
    end if;
  end loop;
  if v_ini is not null then
    v_out := v_out || case when v_out = '' then '' else ', ' end || v_ini || ' a ' || lpad((v_prev/60)::text,2,'0') || ':' || lpad((v_prev%60)::text,2,'0');
  end if;
  return v_out;
end $$;
revoke all on function public._agente_faixas(jsonb) from public, anon, authenticated;

create or replace function public.agente_horarios(p_token text, p_data date, p_duracao int default 60) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare j record; v_preco numeric := public.calc_preco_reserva(p_duracao);
begin
  perform public._agente_auth(p_token);
  if v_preco is null then
    return jsonb_build_object('ok', false, 'erro', 'Duração inválida. Use múltiplos de 30 minutos, de 30 min até 12h.');
  end if;
  select * into j from public._agente_janela(p_data);
  return jsonb_build_object('ok', true, 'data', to_char(p_data,'YYYY-MM-DD'), 'data_br', to_char(p_data,'DD/MM/YYYY'),
    'dia_semana', public._agente_dia(p_data), 'aberto', j.aberto, 'motivo_fechado', j.motivo,
    'funcionamento', case when j.aberto then to_char(j.abre,'HH24:MI') || ' às ' || to_char(j.fecha,'HH24:MI') end,
    'duracao_minutos', p_duracao, 'valor_total', v_preco, 'valor_sinal', round(v_preco * 0.5, 2),
    'horarios_livres_inicio', public._agente_livres(p_data, p_duracao));
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
      v_out := v_out || jsonb_build_object('data', to_char(d,'YYYY-MM-DD'), 'dia', public._agente_dia(d) || ' ' || to_char(d,'DD/MM'),
        'inicios_possiveis', public._agente_faixas(v_l));
    end if;
  end loop;
  return jsonb_build_object('ok', true, 'duracao_minutos', p_duracao, 'passo_minutos', 30,
    'valor_total', public.calc_preco_reserva(p_duracao), 'dias_com_vaga', v_out);
end $$;

-- 3) Registro de mensagem: ignora agradecimentos soltos, honra pedido de parar e limita excesso por numero.
create or replace function public.agente_msg_registrar(p_token text, p_whatsapp text, p_nome text, p_papel text, p_texto text, p_tipo text default 'texto', p_wa_id text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fone text := public._agente_fone(p_whatsapp); c public.agente_conversas%rowtype; v_id bigint;
        v_ack boolean := false; v_parar boolean := false; v_limite boolean := false; v_ultima_sony text;
begin
  perform public._agente_auth(p_token);
  insert into public.agente_conversas (whatsapp, nome) values (v_fone, nullif(p_nome,'')) on conflict (whatsapp) do nothing;
  if p_wa_id is not null and exists (select 1 from public.agente_mensagens where wa_id = p_wa_id) then
    return jsonb_build_object('ok', true, 'duplicada', true);
  end if;
  insert into public.agente_mensagens (whatsapp, papel, texto, tipo, wa_id) values (v_fone, p_papel, p_texto, coalesce(p_tipo,'texto'), p_wa_id) returning id into v_id;
  if p_papel = 'cliente' then
    v_parar := p_texto ~* '^\s*(parar|pare|sair|stop|n[aã]o quero mais receber( mensagens)?|n[aã]o me envie mais( mensagens)?)\s*[.!]*\s*$';
    select texto into v_ultima_sony from public.agente_mensagens where whatsapp = v_fone and papel = 'sony' order by id desc limit 1;
    v_ack := p_tipo = 'texto' and not v_parar
      and p_texto ~* '^\s*(ok|okay|blz|beleza|certo|combinado|valeu|vlw|obrigad[oa]s?|obg|show|top|perfeito|entendi|t[aá]|ta bom|tudo bem|👍|🙏|❤️|💚|😊|🙂|[.!\s])+\s*$'
      and coalesce(v_ultima_sony, '') not like '%?%';
    v_limite := (select count(*) from public.agente_mensagens where whatsapp = v_fone and papel = 'cliente' and criado_em > now() - interval '1 hour') > 30;
    update public.agente_conversas set ultima_msg_cliente_at = now(), followups_enviados = 0, atualizado_em = now(),
      nome = coalesce(nome, nullif(p_nome,'')), optout = optout or v_parar,
      estado = case when v_parar then 'perdido' when estado in ('perdido','novo') then 'qualificando' else estado end
     where whatsapp = v_fone;
  elsif p_papel = 'sony' then
    update public.agente_conversas set ultima_msg_sony_at = now(), atualizado_em = now() where whatsapp = v_fone;
  else
    update public.agente_conversas set humano_ate = now() + interval '6 hours', atualizado_em = now() where whatsapp = v_fone;
  end if;
  select * into c from public.agente_conversas where whatsapp = v_fone;
  return jsonb_build_object('ok', true, 'duplicada', false, 'msg_id', v_id, 'humano_ativo', coalesce(c.humano_ate > now(), false),
    'optout', c.optout, 'parou', v_parar, 'estado', c.estado, 'ignorar', v_ack, 'limite', v_limite);
end $$;

-- 4) Teto diario de mensagens proativas (follow-up, lembrete, liberacao) e lotes pequenos.
create or replace function public.agente_followups_pegar(p_token text, p_limite int default 2) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_hora int := extract(hour from now() at time zone 'America/Sao_Paulo')::int; v jsonb;
begin
  perform public._agente_auth(p_token);
  if v_hora < 9 or v_hora >= 20 then return '[]'::jsonb; end if;
  if (select count(*) from public.agente_mensagens
       where papel = 'sony' and tipo in ('followup','lembrete','liberacao') and criado_em > now() - interval '24 hours') >= 30 then
    return '[]'::jsonb;
  end if;
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
     order by ultima_msg_sony_at limit least(greatest(p_limite,1), 2) for update skip locked),
  u as (
    update public.agente_conversas a set followups_enviados = followups_enviados + 1, ultimo_followup_at = now()
      from c where a.whatsapp = c.whatsapp
    returning a.whatsapp, a.nome, a.estado, a.resumo, a.followups_enviados)
  select coalesce(jsonb_agg(jsonb_build_object('whatsapp', u.whatsapp, 'nome', u.nome, 'estado', u.estado, 'resumo', u.resumo,
    'tentativa', u.followups_enviados,
    'ultimas_mensagens', (select coalesce(jsonb_agg(jsonb_build_object('papel', m.papel, 'texto', m.texto) order by m.id), '[]'::jsonb)
                            from (select * from public.agente_mensagens x where x.whatsapp = u.whatsapp order by id desc limit 6) m))), '[]'::jsonb) into v from u;
  return v;
end $$;
