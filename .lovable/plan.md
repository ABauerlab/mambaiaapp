# Plano — Mambaia App v3

## 1. Autenticação (3 usuários fixos)

- **Usuários permitidos:** João Victor, Laura, Ed Faria. Acesso por **e-mail + senha** (Lovable Cloud Auth).
- **Primeiro acesso:** o admin (eu) cria os 3 usuários via seed (e-mails pré-definidos com senha temporária). No primeiro login, o sistema obriga **trocar a senha** antes de liberar o app.
- **"Manter conectado":** padrão. Sessão persistente no navegador (`persistSession: true`). Sem opt-out — comportamento Notion-like.
- **Escopo da proteção:**
  - **Protegido:** todo `/_app/*` (dashboard, transações, fixos, quadro, acertos, categorias, relatórios, auditoria).
  - **Público:** `/wifi` continua aberto, sem login.
- **Estrutura:** rota `_authenticated.tsx` com `beforeLoad` redirecionando para `/login`. `/login`, `/primeiro-acesso` e `/wifi` ficam fora.
- **Tabelas novas:**
  - `profiles` (user_id → auth.users, display_name, avatar_url, socio_id, must_change_password)
  - vínculo automático: trigger `handle_new_user` cria perfil ao signup e linka ao `socios.id` correspondente pelo e-mail.
- **RLS:** todas as tabelas existentes (`transacoes`, `acertos`, `gastos_fixos`, `quadro_itens`, `socios`, `categorias`, `push_subscriptions`, `profiles`) passam de `open_all` para "usuário autenticado pode tudo" (3 usuários internos). Sem autenticação = sem acesso.

## 2. Perfil de usuário

- Página `/_app/perfil` (e atalho no header):
  - Editar **nome de exibição** (como será chamado no app).
  - Upload de **foto de perfil** (bucket `avatars`, público).
  - Trocar senha.
- Foto aparece no header, nos cards de tarefa (responsável), nos pagadores de transação, e na lista de acertos — substituindo as iniciais coloridas quando houver.

## 3. Filtro por data (calendário real)

Componente reutilizável `DateRangeFilter` (calendário shadcn + presets: Hoje, 7d, Mês atual, Mês passado, Personalizado).

Aplicado em:
- **Dashboard** — KPIs e listas
- **Transações** — substitui o filtro atual de mês
- **Relatórios** — já tem, padronizar
- **Auditoria** — adicionar
- **Acertos** — adicionar

Estado de filtro persiste por aba (URL search params).

## 4. Tarefas em carrossel

`Quadro.tsx` ganha modo carrossel (default no mobile, opcional no desktop):
- Mobile: cada coluna (Aberto / Em andamento / Concluído) vira um carrossel horizontal com snap, 1 card visível + peek do próximo.
- Desktop: cards dentro de cada coluna ficam em carrossel horizontal com setas, em vez de stack vertical longa.
- Drag & drop entre colunas mantido (dnd-kit).
- Usar `embla-carousel-react` (já leve).

## 5. Mobile-first Notion-like

- Reduzir paddings (`p-4` → `p-3`), tipografia mais compacta, ícones 16px.
- Header colapsável estilo Notion (título grande no topo, vira sticky pequeno ao rolar).
- Bottom nav já existe — refinar: 5 ícones, sem labels exceto no ativo.
- Cards com bordas mais sutis (`border-border/40`), hover removido no touch.
- Inputs com `text-base` (evita zoom no iOS) já está; revisar.

## 6. Performance

**Diagnóstico do "/(pagina)":** o que aparece na URL é o file-based routing do TanStack — cada rota é uma tela SPA. Isso **não é navegação full-page** (não recarrega o servidor). A lentidão vem de outros fatores. Ações:

- **Code-split por rota** (TanStack já faz, validar `lazy: true` nas rotas pesadas: Relatórios, Auditoria, Quadro).
- **Prefetch de dados** ao hover dos links do menu (`router.preloadRoute`).
- **Reduzir re-renders:** memoizar listas grandes em Transações/Auditoria.
- **Imagens:** lazy loading + WebP no avatar.
- **React Query:** aumentar `staleTime` para 60s nas queries estáveis (sócios, categorias).
- Remover console.logs e libs não usadas do bundle.

## 7. Rateio flexível na transação

`NovaTransacao.tsx`:
- Novo bloco **"Quem participa do rateio?"** com checkboxes dos 4 sócios + botão "Todos".
- Se **todos os 4 marcados** → usa `splitByCota` (regra 2-2-1-1) já existente.
- Se **subset** → divide **igualmente** entre os marcados (centavos com sobra para o primeiro alfabético, mantendo soma exata).
- Persistir em coluna nova `transacoes.participantes_ids uuid[]` (default todos).
- Atualizar `splitByCota` para receber lista e decidir o modo. Refletir nas telas de saldo, acertos e auditoria.

## 8. Verificação dos pedidos anteriores

Antes de finalizar, conferir e completar (se faltar):
- Empresas: Kodara, Asari, BauerLab, Kriya, Mambaia ✓ (validar `EMPRESAS`)
- Filtro de tarefas por empresa ✓
- Múltiplos responsáveis + opção "Todos" ✓
- Kodara como pagador em transações ✓
- Wifi: liberação automática 3s após clicar em seguir + mensagem final "Obrigado por nos visitar! Se algo der errado com a senha, fale com nossa equipe!" — revalidar.
- Push notifications com VAPID ✓

## 9. Reset final

Ao fim de tudo testado, executar limpeza (apenas dados, mantendo schema, sócios, categorias e usuários):
- `DELETE FROM transacoes;`
- `DELETE FROM acertos;`
- `DELETE FROM gastos_fixos;`
- `DELETE FROM quadro_itens;`
- `DELETE FROM push_subscriptions;`

---

## Detalhes técnicos

**Migrações:**
1. `profiles` table + trigger `handle_new_user` + RLS.
2. Storage bucket `avatars` público + policies.
3. `transacoes.participantes_ids uuid[] not null default '{}'`.
4. Trocar policies `open_all` → `authenticated` em todas as tabelas.

**Seed de usuários:** preciso dos **3 e-mails reais** de João Victor, Laura e Ed Faria para criar as contas. Senha temporária inicial: `mambaia2026` (cada um troca no primeiro login).

**Pergunta antes de implementar:**
1. Confirma os 3 e-mails que vou cadastrar? (preciso deles para criar as contas)
2. Mantém a senha temporária `mambaia2026` ou prefere outra?
3. O reset de dados ao final deve manter os **gastos fixos cadastrados** (aluguel, IPTU etc.) ou apaga tudo mesmo?
