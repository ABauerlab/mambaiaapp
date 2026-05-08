# Plano — Mambaia App: Ideias/Tarefas + Página /wifi

## 1. Confirmação sobre o banco
O sistema já está totalmente conectado ao banco real (Lovable Cloud). Não há dados fictícios em código — Dashboard, Transações, Acertos, etc. já leem das tabelas `transacoes`, `socios`, `categorias`, `gastos_fixos`, `acertos`. Tudo que for registrado no app já fica salvo de verdade. Nada a mudar aqui.

## 2. Novo módulo: Ideias / Tarefas / Demandas

Espaço criativo para anotar e visualizar de forma clara.

### Banco (nova tabela)
```
quadro_itens (
  id uuid pk,
  tipo text check in ('ideia','tarefa','demanda'),
  titulo text not null,
  descricao text,
  status text check in ('aberto','em_andamento','concluido','arquivado') default 'aberto',
  prioridade text check in ('baixa','media','alta') default 'media',
  responsavel_id uuid references socios(id) null,
  empresa text null,            -- Kriya, Kodara, Mambaia, Estúdio
  tags text[] default '{}',
  prazo date null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```
- RLS aberta (mantém padrão atual sem auth na administração).
- Trigger `set_updated_at` (já existe a função).

### Rota e UI: `/quadro` (item no menu: "Ideias")
- Visualização **Kanban** com 3 colunas (Aberto → Em andamento → Concluído) + tab "Arquivados".
- Filtros: tipo (ideia/tarefa/demanda), responsável, empresa, prioridade, busca.
- Cards visuais com cor por tipo (ideia=lima `#A6D608`, tarefa=verde escuro `#1F3D2B`, demanda=amarelo `#DFFF4F`), badge de prioridade, avatar do responsável, prazo.
- Botão "+ Nova" abre dialog com: tipo, título, descrição (textarea), responsável, empresa, prioridade, prazo, tags.
- Click no card abre dialog de edição completa (com mover status, arquivar, excluir).
- Drag & drop entre colunas para mudar status (usa `@dnd-kit/core` — já leve e suportado).

### AppShell
- Adicionar item "Ideias" no menu lateral/bottom bar com ícone `Lightbulb`.

## 3. Página /wifi (pública, separada do app)

Rota **fora** do layout `_app` — sem sidebar, sem acesso ao sistema. Arquivo: `src/routes/wifi.tsx`.

### Fluxo (3 passos guiados)
```
[ Boas-vindas Mambaia ]
        ↓
Passo 1: Avaliar no Google (5 estrelas)
  - Botão "Abrir Google Reviews" → window.open(url)
  - Após retorno, botão "Já avaliei ✓" desbloqueia próximo passo
        ↓
Passo 2: Seguir no Instagram
  - Botão "Abrir Instagram @mambaiabh"
  - Após retorno, botão "Já segui ✓" libera senha
        ↓
Passo 3: Wifi liberado
  - Card grande: Rede MAMBAIA, Senha Mambaia*22
  - Botão "Copiar senha" (navigator.clipboard)
  - Mensagem de agradecimento
```

### Detalhes técnicos
- **Sem login**, página 100% pública.
- Estado dos passos guardado em `localStorage` (`mambaia_wifi_step`) — se a pessoa fechar e voltar, retoma. Se já completou antes no mesmo dispositivo, vai direto para a senha.
- Detecta retorno do Google/Instagram via `visibilitychange` + timer mínimo (~3s na aba externa) antes de habilitar "Já avaliei/segui" — evita clique imediato sem sair.
- Funciona Android/iOS: links abrem app nativo quando instalado (URLs `https://` deep-linkam automaticamente em ambos), fallback no navegador.
- Layout mobile-first, branding Mambaia (verde escuro + lima), logo no topo, botões grandes (touch target 48px+).
- Meta tags próprias (`<title>Wi-Fi Mambaia</title>`), sem itens de menu do app.

### Registro opcional (sem PII)
Tabela `wifi_acessos` com `created_at`, `user_agent` (truncado), só para contagem agregada futura. RLS aberta para insert anônimo. *Confirmar se quer rastrear* — se preferir não registrar nada, removo.

### Limitações honestas
- Não há como **verificar** de fato que a pessoa avaliou no Google ou seguiu no Insta (Google/Meta não expõem essa API publicamente sem OAuth complexo). O fluxo é baseado em confiança + fricção (precisa abrir os links, esperar uns segundos, confirmar). É o padrão usado por apps similares de "wifi social".

## 4. Arquivos a criar/editar

**Criar:**
- `supabase/migrations/...` — tabela `quadro_itens` (+ `wifi_acessos` se aprovado) + trigger updated_at.
- `src/routes/_app.quadro.tsx`
- `src/routes/wifi.tsx` (fora do layout `_app`)
- `src/components/pages/Quadro.tsx` (kanban + dialogs)
- `src/components/wifi/WifiFlow.tsx`
- `src/lib/quadro.ts` (queries CRUD)

**Editar:**
- `src/components/AppShell.tsx` — adicionar item "Ideias".
- `src/lib/db.ts` — exports adicionais se preciso.

**Dependência nova:**
- `@dnd-kit/core` + `@dnd-kit/sortable` para drag & drop do kanban.

## 5. Perguntas antes de implementar
1. Quer registrar acessos ao /wifi (contagem anônima) ou não rastrear nada?
2. Quadro de Ideias: começar com **Kanban** (recomendado) ou prefere visualização em **lista/grid**?
3. Senha do wifi (`Mambaia*22`) e nome da rede (`MAMBAIA`) ficam **hardcoded** no código ou quer uma tela de admin no app para editá-las?
