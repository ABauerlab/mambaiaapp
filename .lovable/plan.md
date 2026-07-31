## O que vai mudar

### 1. Notificações push (reservas + lembretes)
- **Nova reserva:** trigger no banco `after insert on reservas` chama endpoint `/api/public/hooks/nova-reserva` via `pg_net` → dispara push pra todos os admins com nome, data e hora.
- **Lembretes automáticos:** cron novo roda a cada 15 min, procura reservas confirmadas/pagas nos próximos 24h e 1h, dispara push (usa uma coluna `lembrete_24h_enviado_at` / `lembrete_1h_enviado_at` pra não repetir).
- **App fechado:** já funciona pelo Service Worker existente (`public/sw.js`). Não precisa mudar nada nele.

### 2. Login que fica salvo no PWA
- Já uso `persistSession: true`. Vou adicionar `flowType: "pkce"` e garantir `storage: localStorage` estável mesmo em PWA standalone. Aumento a duração da sessão do lado Supabase (default já é 1 semana com refresh, mas confirmo que o refresh token roda quando abre o app).

### 3. Bloquear horário na agenda (interno)
- Nova coluna `reservas.tipo` já existe; adiciono valor `'bloqueio'`.
- Na tela `/agenda`, botão "Bloquear horário" → modal com 2 opções:
  - **Faixa:** data + hora início + duração (30min a 12h)
  - **Dia inteiro:** data + marca 08:00–22:00 bloqueado
- Bloqueios aparecem na agenda pública `/agendar` como horário indisponível (mesma lógica do `get_horarios_ocupados`), com visual diferente na `/agenda` admin (cinza, sem PDF).

### 4. Login: retirar "Senha temporária" e resetar Laura
- Remover o texto/hint "Senha temporária" da tela `/login`.
- Migration reseta senha da Laura para `24092023` via `auth.users` (update `encrypted_password`) e marca `must_change_password = false` (pra ela entrar direto).

### 5. Kodara de volta (só em ideias e "quem pagou")
- Reinsere Kodara na tabela `socios`.
- `splitByCota` (em `src/lib/cotas.ts`) **continua dividindo só entre Bauer, Laura, Ed** (peso 0 pra Kodara — já é o comportamento atual).
- Kodara aparece nos selects de "quem pagou" (NovaTransacao, GastosFixos) e nos responsáveis do Quadro.

### 6. Atualização em tempo real (sem refresh)
- Migration: `alter publication supabase_realtime add table` pra `transacoes`, `gastos_fixos`, `quadro_itens`, `reservas`, `acertos`, `categorias`, `cobrancas`.
- Nas telas listadas, adiciono `useEffect` com `supabase.channel().on('postgres_changes', ...)` que invalida a query do TanStack Query (`queryClient.invalidateQueries`) quando muda algo.
- Cobre: Dashboard, Transações, Gastos Fixos, Quadro, Agenda, Acertos, Categorias, Criar.

### 7. Gastos fixos com duração (parcelas)
- Nova coluna `gastos_fixos.parcelas_total` (int, null = indefinido) e `parcelas_pagas` (int, default 0).
- No form, campo opcional "Quantas parcelas?" (ex: 3). Mostra "2/3" na lista.
- Quando `parcelas_pagas >= parcelas_total`, marca `ativo = false` automaticamente (trigger simples ou lógica no client ao registrar pagamento).

### 8. Termo de reserva atualizado
- Em `src/lib/reserva-pdf.ts` e no checkbox de consentimento em `/agendar` e `/pacote-marcas`: substituir os bullets de cancelamento pelo texto exato:
  > O cancelamento deverá ser comunicado com, no mínimo, 48 (quarenta e oito) horas de antecedência em relação ao horário da reserva. Nesses casos, o cliente poderá remarcar a locação uma única vez, em até 90 (noventa) dias, sem custo adicional, mediante disponibilidade da agenda.
  >
  > Cancelamentos comunicados com menos de 48 (quarenta e oito) horas de antecedência, bem como o não comparecimento na data e horário agendados, implicarão a perda do direito à remarcação e ao reembolso, permanecendo os valores pagos com a Mambaia.

## Detalhes técnicos

- **Migrations (uma só):** insert Kodara em `socios`, reset senha Laura (via `auth.users`), colunas `parcelas_total`/`parcelas_pagas` em `gastos_fixos`, colunas `lembrete_24h_enviado_at`/`lembrete_1h_enviado_at` em `reservas`, extende enum/text de `reservas.tipo` pra aceitar `'bloqueio'`, `alter publication supabase_realtime add table ...`, cria trigger `on_new_reserva_notify` que chama `net.http_post` pro hook novo.
- **Novos endpoints públicos:** `src/routes/api/public/hooks/nova-reserva.ts` e `src/routes/api/public/hooks/reserva-lembretes.ts`. Ambos exigem `apikey` header com anon key.
- **Cron:** `select cron.schedule('reserva-lembretes', '*/15 * * * *', ...)` chamando o hook de lembretes.
- **Realtime:** um hook `useRealtimeInvalidate(table, queryKey)` reutilizável.

## Fora do escopo
- Trocar provider de push (segue web-push/VAPID atual).
- Renderizar bloqueios na landing pública (só na agenda interna e no seletor de horário do `/agendar`).