-- Sony: instrucoes da equipe vindas do grupo (papel 'equipe') e aviso unico ao cliente quando o limite por hora e atingido. Idempotente.

alter table public.agente_mensagens drop constraint if exists agente_mensagens_papel_check;
alter table public.agente_mensagens add constraint agente_mensagens_papel_check check (papel in ('cliente','sony','humano','equipe'));
alter table public.agente_conversas add column if not exists limite_aviso_at timestamptz;

create or replace function public.agente_msg_registrar(p_token text, p_whatsapp text, p_nome text, p_papel text, p_texto text, p_tipo text default 'texto', p_wa_id text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_fone text := public._agente_fone(p_whatsapp); c public.agente_conversas%rowtype; v_id bigint;
        v_ack boolean := false; v_parar boolean := false; v_limite boolean := false; v_avisar boolean := false; v_ultima_sony text;
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
    -- Nunca deixa o cliente no vacuo: no maximo 1 aviso educado por hora quando o limite e atingido.
    if v_limite then
      select * into c from public.agente_conversas where whatsapp = v_fone;
      if c.limite_aviso_at is null or c.limite_aviso_at < now() - interval '1 hour' then
        v_avisar := true;
        update public.agente_conversas set limite_aviso_at = now() where whatsapp = v_fone;
      end if;
    end if;
  elsif p_papel = 'sony' then
    update public.agente_conversas set ultima_msg_sony_at = now(), atualizado_em = now() where whatsapp = v_fone;
  elsif p_papel = 'equipe' then
    -- Instrucao do grupo: nao pausa a Sony, ela executa e responde o cliente.
    update public.agente_conversas set atualizado_em = now() where whatsapp = v_fone;
  else
    update public.agente_conversas set humano_ate = now() + interval '6 hours', atualizado_em = now() where whatsapp = v_fone;
  end if;
  select * into c from public.agente_conversas where whatsapp = v_fone;
  return jsonb_build_object('ok', true, 'duplicada', false, 'msg_id', v_id, 'humano_ativo', coalesce(c.humano_ate > now(), false),
    'optout', c.optout, 'parou', v_parar, 'estado', c.estado, 'ignorar', v_ack, 'limite', v_limite, 'avisar_limite', v_avisar);
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
    'ultimo_msg_cliente_id', (select max(id) from public.agente_mensagens where whatsapp = v_fone and papel in ('cliente','equipe')),
    'agora_brt', to_char(now() at time zone 'America/Sao_Paulo','YYYY-MM-DD HH24:MI'),
    'hoje_dia_semana', public._agente_dia((now() at time zone 'America/Sao_Paulo')::date));
end $$;
