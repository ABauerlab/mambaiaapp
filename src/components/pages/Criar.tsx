import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, Plus, Trash2, Copy, Check, ExternalLink, Sparkles } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
// O cliente tipado ainda não conhece a tabela `cobrancas` (types gerados);
// usamos um alias sem tipos para inserts/updates dela.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;
import { useAuth } from "@/lib/auth";
import { formatBRL } from "@/lib/money";
import { friendlyErrorMessage } from "@/lib/utils";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const PIX_PADRAO = "57500686000105";
const PIX_NOME_PADRAO = "LAURA OTTONI NEGRÃO";

type Item = { nome: string; valor: string };

type Cobranca = {
  id: string;
  slug: string;
  cliente_nome: string;
  cliente_email: string | null;
  titulo: string;
  descricao: string | null;
  itens: { nome: string; valor: number }[];
  total: number;
  pix_chave: string;
  pix_nome: string;
  observacoes: string | null;
  status: "pendente" | "pago" | "cancelado";
  created_at: string;
  paid_at: string | null;
};

const itemSchema = z.object({
  nome: z.string().trim().min(1, "Descreva o item").max(120),
  valor: z.number().positive("Valor inválido").max(10_000_000),
});

const schema = z.object({
  cliente_nome: z.string().trim().min(1, "Cliente obrigatório").max(120),
  cliente_email: z
    .string()
    .trim()
    .email()
    .max(160)
    .nullable()
    .or(z.literal("").transform(() => null)),
  titulo: z.string().trim().min(1, "Título obrigatório").max(160),
  descricao: z.string().trim().max(2000).nullable(),
  itens: z.array(itemSchema).min(1, "Adicione pelo menos um item"),
  pix_chave: z.string().trim().min(1).max(160),
  pix_nome: z.string().trim().min(1).max(160),
  observacoes: z.string().trim().max(1000).nullable(),
});

function makeSlug(): string {
  const a = Math.random().toString(36).slice(2, 8);
  const b = Date.now().toString(36).slice(-4);
  return `${a}${b}`;
}

async function fetchCobrancas(): Promise<Cobranca[]> {
  const { data, error } = await sb
    .from("cobrancas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Cobranca[]).map((c) => ({
    ...c,
    total: typeof c.total === "string" ? parseFloat(c.total) : c.total,
    itens: Array.isArray(c.itens) ? c.itens : [],
  }));
}

export function Criar() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: cobrancas, isLoading } = useQuery({
    queryKey: ["cobrancas"],
    queryFn: fetchCobrancas,
  });
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Criar cobrança"
        description="Gere um link de checkout PIX para enviar ao cliente."
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="w-4 h-4" /> Nova cobrança
          </Button>
        }
      />

      {showForm && (
        <FormCobranca
          userId={user?.id ?? null}
          onDone={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ["cobrancas"] });
          }}
        />
      )}

      <div className="space-y-3">
        {isLoading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}
        {(cobrancas ?? []).map((c) => (
          <CobrancaCard key={c.id} c={c} />
        ))}
        {!isLoading && (cobrancas ?? []).length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma cobrança ainda. Clique em <span className="font-medium">Nova cobrança</span>{" "}
            para criar a primeira.
          </Card>
        )}
      </div>
    </div>
  );
}

function FormCobranca({ userId, onDone }: { userId: string | null; onDone: () => void }) {
  const [cliente, setCliente] = useState("");
  const [email, setEmail] = useState("");
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [itens, setItens] = useState<Item[]>([{ nome: "", valor: "" }]);
  const [pixChave, setPixChave] = useState(PIX_PADRAO);
  const [pixNome, setPixNome] = useState(PIX_NOME_PADRAO);
  const [obs, setObs] = useState("");

  const total = itens.reduce((acc, it) => {
    const v = parseFloat((it.valor ?? "").replace(",", "."));
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        cliente_nome: cliente,
        cliente_email: email || null,
        titulo,
        descricao: descricao || null,
        itens: itens.map((it) => ({
          nome: it.nome.trim(),
          valor: parseFloat((it.valor ?? "").replace(",", ".")),
        })),
        pix_chave: pixChave,
        pix_nome: pixNome,
        observacoes: obs || null,
      });
      const slug = makeSlug();
      const payload = {
        ...parsed,
        slug,
        total: parsed.itens.reduce((a, b) => a + b.valor, 0),
        created_by: userId,
      };
      const { data, error } = await sb.from("cobrancas").insert(payload).select("slug").single();
      if (error) throw error;
      return (data as { slug: string }).slug;
    },
    onSuccess: (slug) => {
      const url = `${window.location.origin}/cobranca/${slug}`;
      void navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Cobrança criada! Link copiado.");
      onDone();
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  return (
    <Card className="p-5 mb-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Cliente *</Label>
          <Input
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            placeholder="Nome do cliente"
          />
        </div>
        <div>
          <Label>E-mail (opcional)</Label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            type="email"
          />
        </div>
      </div>
      <div>
        <Label>Título da proposta *</Label>
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex: Identidade visual completa"
        />
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          placeholder="Detalhe a proposta para o cliente"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Itens / serviços *</Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setItens((arr) => [...arr, { nome: "", valor: "" }])}
          >
            <Plus className="w-3 h-3" /> Item
          </Button>
        </div>
        <div className="space-y-2">
          {itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_140px_auto] gap-2">
              <Input
                value={it.nome}
                onChange={(e) =>
                  setItens((arr) =>
                    arr.map((x, ix) => (ix === i ? { ...x, nome: e.target.value } : x)),
                  )
                }
                placeholder={`Item ${i + 1}`}
              />
              <Input
                value={it.valor}
                onChange={(e) =>
                  setItens((arr) =>
                    arr.map((x, ix) => (ix === i ? { ...x, valor: e.target.value } : x)),
                  )
                }
                placeholder="0,00"
                inputMode="decimal"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={itens.length === 1}
                onClick={() => setItens((arr) => arr.filter((_, ix) => ix !== i))}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-2 text-right text-sm">
          Total: <span className="font-semibold">{formatBRL(total)}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Chave PIX *</Label>
          <Input value={pixChave} onChange={(e) => setPixChave(e.target.value)} />
        </div>
        <div>
          <Label>Nome do recebedor *</Label>
          <Input value={pixNome} onChange={(e) => setPixNome(e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea
          value={obs}
          onChange={(e) => setObs(e.target.value)}
          rows={2}
          placeholder="Prazo, condições, etc."
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Criar e copiar link
        </Button>
      </div>
    </Card>
  );
}

function CobrancaCard({ c }: { c: Cobranca }) {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/cobranca/${c.slug}`
      : `/cobranca/${c.slug}`;

  const setStatus = useMutation({
    mutationFn: async (status: Cobranca["status"]) => {
      const { error } = await sb
        .from("cobrancas")
        .update({ status, paid_at: status === "pago" ? new Date().toISOString() : null })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cobrancas"] }),
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("cobrancas").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cobrança excluída");
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{c.titulo}</span>
            {c.status === "pago" && (
              <Badge className="bg-success text-success-foreground">Pago</Badge>
            )}
            {c.status === "cancelado" && <Badge variant="secondary">Cancelado</Badge>}
            {c.status === "pendente" && <Badge variant="outline">Pendente</Badge>}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {c.cliente_nome} · {formatBRL(c.total)} ·{" "}
            {new Date(c.created_at).toLocaleDateString("pt-BR")}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <Button size="sm" variant="outline" onClick={copy}>
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copiar link
          </Button>
          <Link to="/cobranca/$slug" params={{ slug: c.slug }} target="_blank">
            <Button size="sm" variant="ghost">
              <ExternalLink className="w-3 h-3" /> Abrir
            </Button>
          </Link>
          {c.status !== "pago" ? (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("pago")}>
              <Check className="w-3 h-3" /> Marcar pago
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("pendente")}>
              Reabrir
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Excluir esta cobrança?")) remove.mutate();
            }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
