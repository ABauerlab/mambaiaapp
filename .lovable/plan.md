
# Plano — Mambaia App v2

Trabalho organizado em 8 frentes. Cada frente entrega valor sozinha.

---

## 1. Modelo de cotas fixas (regra contábil central)

A Mambaia passa a ter uma regra única de divisão para **gastos e ganhos**:

```text
Total
├─ 2/3 → Kodara + Eduardo (1/3 cada)
└─ 1/3 → João + Laura    (1/6 cada)
```

Mudanças:
- Adicionar **Kodara** como sócio na tabela `socios` (representa a empresa-cota).
- Reescrever `src/lib/balance.ts` para usar **cotas ponderadas** (não mais split igual entre N). Cálculo 100% em centavos com sobra alocada ao maior cotista (Kodara) para soma exata.
- Aplicar a mesma regra para **receitas**: ganho registrado pela "Mambaia" gera crédito proporcional para cada sócio na sua cota.
- Em **Acertos**, gerar sugestões considerando que a Mambaia (caixa coletivo) deve repassar a cada sócio o valor da sua cota das receitas, e que cada sócio deve à Mambaia sua cota das despesas pagas por outro.

Toda transação é da Mambaia (não há mais "empresa" como pagador divisor — `empresa` vira só um rótulo informativo no item).

---

## 2. Nova Transação + edição inline

- Campo "empresa pagadora" some; toda transação é da Mambaia.
- Em "Quem pagou / recebeu" mostrar os 4 sócios incluindo Kodara. Adicionar opção **"Mambaia (caixa)"** quando for receita do espaço.
- **Editar transação**: clicar em qualquer linha em `/transacoes` abre um Dialog com todos os campos preenchidos — salvar faz `UPDATE`. Sem precisar excluir.
- Validação Zod mantida; preview de divisão usa cotas.

---

## 3. Gastos fixos

- "Pagador padrão" passa a ser **obrigatório** no cadastro (UI + Zod).
- Ao lançar, cria a transação e divide pelas cotas. Se quem paga for um sócio e não a Mambaia, os outros 3 ficam devendo conforme cota.

---

## 4. Quadro (Ideias / Tarefas / Demandas)

- Empresas corretas: **Kodara, Asari, BauerLab, Kriya, Mambaia** (corrigir constante `EMPRESAS`).
- Filtro por empresa no topo do quadro (junto com tipo e busca).
- Responsável: campo passa a aceitar **múltiplos sócios** ou **"Todos"**. Schema: coluna `responsavel_ids text[]` (migração) + UI multi-select. Migrar dados existentes do `responsavel_id` para o array.
- Edição rápida no card: menus de status, prioridade e responsável direto no card (sem abrir o dialog completo).

---

## 5. Acertos + Auditoria

- Acertos passam a sugerir **dois fluxos**:
  1. Despesas pagas por sócio → ressarcimento conforme cota.
  2. Receitas da Mambaia → repasse de Mambaia → cada sócio na sua cota.
- Linha clara mostrando "Mambaia deve enviar R$ X para Fulano" quando o caixa coletivo tem saldo positivo.
- Nova rota `/auditoria`: tabela cronológica de acertos registrados + zeramentos (quem confirmou, data, valor, descrição). Lê `acertos` + `transacoes.acertada` com timestamp.

---

## 6. Performance (alvo: navegação instantânea)

- `QueryClient`: `staleTime: 60_000`, `gcTime: 5*60_000`, desabilitar `refetchOnWindowFocus`. Hoje toda navegação refaz fetches.
- **Prefetch** dos queries comuns (`socios`, `categorias`, `transacoes`) no `RootComponent`.
- **Lazy-load** Recharts: importar `LineChart`/`PieChart` via `React.lazy` + `Suspense` com skeleton. Reduz TBT inicial drasticamente.
- Code-split de páginas pesadas (Quadro, Relatórios) via `.lazy.tsx`.
- Fontes: substituir `<link>` Google Fonts por `@font-face` local com `font-display: swap` (ou manter Google mas adicionar `&display=swap` — já está, então mover para preload do woff2).
- Memoizar `Dashboard` cálculos (já tem useMemo, revisar dependências).

---

## 7. SEO + Acessibilidade + PWA

- Cada rota com `head()` único: title <60 chars, description <160 chars, og:image apontando para a logo amarela em fundo verde escuro (gerar PNG 1200×630 em `public/og-mambaia.png`).
- Limpar `__root.tsx`: hoje há **título e og:title duplicados** — deixar só os do root, deixar leaf routes sobrescrevem.
- Adicionar JSON-LD `Organization` no root.
- Logo no header: `alt="Mambaia App"` (já tem "Mambaia", melhorar).
- Hierarquia de headings: garantir um único `<h1>` por página (PageHeader vira h1, demais cards usam h2/h3 sequencial).
- Contraste WCAG AA: escurecer `--success` e `--destructive` (oklch com L menor). Ajustar `text-destructive` em fundo claro.
- Touch targets ≥44px na bottom bar mobile (aumentar `py-3`, garantir gap).
- Tom feminino: revisar todas as strings ("a Mambaia", "Bem-vinda", "Obrigada"). Substituir emojis (✨🌱🎉) por ícones lucide.
- Mobile 100% responsivo: revisar overflows em Dashboard (gráficos), Acertos e Quadro com viewports 320–414px.
- Manifest: já tem `display: standalone`. Confirmar ícones e `theme_color`.

---

## 8. Notificações Push (PWA)

Ressalva: iOS só envia push se o app estiver **instalado na tela inicial**. Android/desktop funciona com permissão normal.

Implementação:
- Tabela `push_subscriptions` (endpoint, p256dh, auth, sócio opcional).
- Service worker `public/sw.js` que recebe `push` e mostra notificação (clique abre rota relevante).
- Tela "Ativar notificações" no Dashboard pedindo permissão e salvando subscription com VAPID.
- Server route `/api/public/hooks/daily-digest` (Tanstack server route) chamada por `pg_cron` às **09:00** todo dia: lista tarefas com prazo hoje + insights (data comemorativa, gasto fixo do dia) e dispara push para todas as subscriptions.
- Ao criar **gasto fixo** ou **tarefa com prazo hoje**, dispara push imediato.
- Segredos necessários: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (vou pedir via `add_secret` na hora).

---

## 9. /wifi — ajustes finais

- Sem emojis. Tom feminino ("Bem-vinda", "Obrigada por nos visitar!").
- Mensagem final: **"Obrigada por nos visitar! Se algo der errado com a senha, fale com nossa equipe!"**
- Botão "Já avaliei" / "Já segui" libera **3s após o clique no botão de ação** (timer simples), não dependendo mais de `visibilitychange` — resolve o problema de quem já segue/avaliou.
- Tentar abrir review no app nativo: usar URL `https://search.google.com/local/writereview?placeid=...` que o Android abre no app Maps; iOS abre no Safari. Manter `target="_blank"`.
- Após a tela final do Wi-Fi, **upsell** com 4 cards linkando os Instagrams:
  - kriyastudio.co · vistakodara · use.asari · abauerlab

---

## Detalhes técnicos

- Migrações novas: `socios` insert Kodara; `quadro_itens.responsavel_ids text[]` + backfill; `push_subscriptions` table.
- Helper `cotas.ts` com a função `splitByCota(totalCents)` retornando `Map<socio_id, cents>` somando exatamente o total.
- Testes inline em `cotas.ts` (como já existe em `money.ts`) para garantir soma exata em casos com sobra (ex: 100 / cotas 1/3,1/3,1/6,1/6 = 33,33,17,17 → ajusta resto pra Kodara).
- Edge case: se uma transação for marcada `empresa = "Kriya"` (legado), continua aparecendo no histórico mas o cálculo ignora — divisão sempre por cota.

---

## Ordem de entrega

1. ✅ Migração (Kodara + responsavel_ids)
2. ✅ cotas.ts + balance.ts
3. ✅ Edição inline de transações + Nova com Mambaia + Fixos com pagador obrigatório
4. ✅ Acertos Mambaia↔sócios + /auditoria
5. ✅ Quadro (empresas, multi-responsável, edição rápida de prioridade no card, filtro de empresa)
6. ✅ QueryClient com staleTime/gcTime, sem refetchOnWindowFocus
7. ✅ Limpeza de meta tags duplicadas no root
8. ✅ Push notifications — VAPID configurado, service worker, tabela push_subscriptions, card no Dashboard, digest diário 09:00 (12 UTC) via pg_cron, push imediato ao criar gasto fixo ou tarefa com prazo hoje
9. ✅ /wifi (upsell de Instagrams, tom feminino sem emojis, 3s timer, mensagem final)
