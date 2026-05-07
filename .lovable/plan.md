# Mambaia App — Fase 1: Financeiro

PWA instalável com a identidade visual da Mambaia (verde escuro #1F3D2B, verde vibrante #A6D608, amarelo limão #DFFF4F, creme #F5F2E9), tipografia Poppins, logo enviada como ícone/favicon. Sem login nesta fase — uso interno da administração.

## Estrutura de páginas

- **/** — Dashboard (estilo PowerBI)
- **/transacoes** — Lista de gastos e ganhos com filtros
- **/nova** — Registrar gasto ou ganho
- **/fixos** — Gastos fixos recorrentes
- **/acertos** — Saldo entre sócios e histórico de acertos
- **/relatorios** — Relatórios detalhados
- **/categorias** — Gerenciar categorias

## Modelo de dados (Lovable Cloud)

- **socios**: João Victor, Laura Ottoni, Eduardo (pré-cadastrados)
- **categorias**: tipo (despesa/receita), nome, ícone, cor — pré-populadas + criação livre
- **transacoes**: tipo (gasto/ganho), valor, data, descrição, categoria, pago_por (sócio), recebido_por (opcional, p/ ganhos), empresa relacionada (Kriya/Kodara/Asari/Bauer Lab/Mambaia), observações
- **gastos_fixos**: nome, valor, dia do mês, categoria, ativo — gera transação automática mensal
- **acertos**: data, de_socio, para_socio, valor, transações incluídas

## Lógica financeira (validada)

Todo gasto é dividido por 3 igualmente:
- Quem pagou fica com crédito de `valor × 2/3` contra os outros dois
- Cada outro sócio deve `valor / 3` ao pagador
- Arredondamento em centavos com ajuste para o pagador absorver a diferença (garante soma = total exato)

**Saldo por sócio** = soma de todos os créditos − soma de todas as dívidas (considerando apenas transações ainda não acertadas).

**Sugestão de acerto**: algoritmo de minimização de transferências (ex: se A deve 100 a B e B deve 100 a C, sugere A → C diretamente).

Ao marcar acerto: as transações envolvidas são marcadas como "acertadas", saem do saldo ativo e vão para o histórico/balanço geral.

**Validações obrigatórias**:
- Valores > 0, máximo 2 casas decimais
- Data não futura para registros (configurável p/ fixos)
- Pagador obrigatório em gastos
- Soma das divisões = valor total (teste automático em cada cálculo)
- Schema Zod no client e validação server-side

## Dashboard (estilo PowerBI)

Layout em cards/grid responsivo:

```text
┌─────────────────────────────────────────┐
│ KPIs: Receita | Despesa | Lucro mês    │
├──────────────────┬──────────────────────┤
│ Linha mês a mês  │ Donut por categoria  │
│ (rec x desp)     │                      │
├──────────────────┴──────────────────────┤
│ Saldo entre sócios (cards)              │
│ João → Laura: R$ X | Laura → Edu: R$ Y │
├─────────────────────────────────────────┤
│ Últimas transações                      │
└─────────────────────────────────────────┘
```

- Gráficos com Recharts nas cores da marca
- Filtro global de período (mês atual, últimos 3, 6, 12, customizado)
- Animações suaves, dark mode opcional usando verde escuro como base

## Registrar transação (UX otimizada)

Formulário em uma tela com:
- Toggle Gasto/Ganho (cores diferentes)
- Valor com máscara R$
- Categoria (chips clicáveis + botão "+ Nova")
- Data (default: hoje)
- Pago por (avatar dos 3 sócios) — preview em tempo real: "Cada um deve R$ X,XX para [pagador]"
- Empresa associada (opcional)
- Descrição
- Botão salvar grande (mobile-friendly)

## Gastos fixos

Cadastro com geração automática de transação no dia configurado (via cron edge function diária), marcando origem "fixo".

## Acertos

Tela mostra:
- Matriz visual: quem deve para quem
- Botão "Sugerir acerto ótimo"
- Botão "Marcar como pago" por par de sócios
- Histórico de acertos passados

## Relatórios

- Resumo mensal: receitas × despesas × lucro
- Evolução temporal (linha) mês a mês
- Saldo entre sócios e histórico completo de acertos
- Exportar CSV

## PWA & SEO

- `manifest.json` com nome "Mambaia App", cores da marca, ícones gerados a partir da SVG enviada (192, 512, maskable, apple-touch-icon, favicon)
- `display: standalone`, instalável em mobile e desktop
- Sem service worker (evita problemas no preview do Lovable; instalação funciona com manifest puro)
- Meta tags completas: title, description, og:title, og:description, og:image, twitter card em cada rota
- `lang="pt-BR"`, theme-color verde escuro

## Stack técnica

- TanStack Start (já configurado), Tailwind v4, shadcn/ui
- Lovable Cloud (Postgres) com RLS aberta nesta fase (sem auth) — preparada para adicionar auth depois
- Recharts para gráficos
- Zod para validação
- Server functions para cron de gastos fixos
- Fonte Poppins via Google Fonts

## Preparação para próximas fases

Estrutura modular já pronta para receber:
- Agenda do estúdio fotográfico com notificações push
- Autenticação dos 3 sócios
- Módulos por empresa (Kriya, Kodara, Asari, Bauer Lab)
