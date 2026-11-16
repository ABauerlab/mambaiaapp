# Sony, atendente de WhatsApp da Mambaia

Agente de IA (n8n + Evolution API + Gemini) que atende, qualifica e fecha reservas no WhatsApp da Mambaia.
Usa as mesmas regras do `/agendar` (conflito de horario, cobranca do sinal de 50%).

## Pecas
- **n8n**
  - `Mambaia | Sony | Atendimento WhatsApp`: webhook do Evolution, audio/imagem (Gemini), agente com ferramentas, envio de mensagens e PDF.
  - `Mambaia | Sony | Rotinas`: avisos no grupo dos donos, confirmacao ao cliente, follow-up, lembretes 24h/1h e liberacao de pendentes.
  - `Mambaia | Sony | Alerta de falha (grupo)`: avisa o grupo quando algum fluxo falha.
- **Banco** (`supabase/migrations/20261116120000_agente_sony.sql` e `20261116130000_agente_sony_ajustes.sql`)
  - Funcoes `agente_*` (somente via header `x-agente-token`, hash em `agente_config`).
  - Tabelas `agente_conversas`, `agente_mensagens` (memoria), `agente_eventos` (fila de avisos), `agente_feriados`.
- **App** (`src/routes/api/public/agente/proposta.ts`, `src/lib/reserva-pdf.ts`): PDF da proposta (aguardando sinal e confirmado).
  `src/routes/api/public/hooks/nova-reserva.ts` envia push (PWA) para nova reserva, remarcacao, cancelamento e pagamento.

## Regras de negocio
- Horario: seg a sex 09h as 18h, sabado 09h as 15h, domingo e feriados fechado (tabela `agente_feriados`).
  Fora do expediente a reserva e aceita e marcada como "fora do horario" (a equipe se organiza).
- Pagamento: sinal de 50% via PIX (contato.mambaia@gmail.com). A equipe confere manualmente e confirma no app.
  O cliente que marca "pago" na pagina gera o aviso `pago_cliente` (nao conferido); a confirmacao da equipe gera `pago`
  e so entao a Sony confirma ao cliente do WhatsApp e envia o PDF.
- Remarcacao: 1 vez, ate 90 dias, com 48h ou mais de antecedencia. Antes de 48h ou segunda remarcacao: escala para a equipe.
- Reservas feitas pela Sony sem sinal ou comprovante em 24h (e cliente inativo) sao liberadas automaticamente.
- Follow-up: leads em qualificacao 2h, 24h e 72h apos a ultima mensagem da Sony; cobranca de sinal 2h e ~11h apos o envio
  dos dados de pagamento. Somente entre 9h e 20h (Brasilia).
- Se um dono responde pelo celular da Mambaia, a Sony pausa naquela conversa por 6 horas.

## Operacao
- Credencial n8n `Header Auth`: Name `x-agente-token`, Value igual ao segredo cujo hash esta em `agente_config.token_hash`.
- Para trocar o segredo: `insert into agente_config(chave, valor) values ('token_hash', encode(sha256(convert_to('<NOVO>','utf8')),'hex')) on conflict (chave) do update set valor = excluded.valor;`
  e atualize a credencial no n8n.
- Webhook do Evolution (instancia `Mambaia`): `https://n8n.bauerlab.com.br/webhook/mambaia-sony-in`, evento `MESSAGES_UPSERT`.
