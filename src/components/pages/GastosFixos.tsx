import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Repeat } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { fetchGastosFixos, fetchCategorias, fetchSocios } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/money";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(100),
  valor: z.number().positive("Valor inválido").max(10_000_000),
  dia_mes: z.number().int().min(1).max(31),
  categoria_id: z.string().uuid("Selecione uma categoria"),
  socio_padrao_id: z.string().uuid("Selecione um sócio").nullable(),
});

export function GastosFixos() {
  const qc = useQueryClient();
  const { data: fixos } = useQuery({ queryKey: ["fixos"], queryFn: fetchGastosFixos });
  const { data: categorias } = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [valorStr, setValorStr] = useState("");
  const [dia, setDia] = useState("5");
  const [catId, setCatId] = useState("");
  const [socioId, setSocioId] = useState("");
  const cats = (categorias ?? []).filter((c) => c.tipo === "despesa");

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        nome, valor: parseFloat(valorStr.replace(",", ".")),
        dia_mes: parseInt(dia, 10), categoria_id: catId,
        socio_padrao_id: socioId || null,
      });
      const { error } = await supabase.from("gastos_fixos").insert(parsed);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gasto fixo cadastrado");
      qc.invalidateQueries({ queryKey: ["fixos"] });
      setShowForm(false); setNome(""); setValorStr(""); setDia("5"); setCatId(""); setSocioId("");
    },
    onError: (e: unknown) => toast.error(e instanceof z.ZodError ? e.issues[0].message : (e as Error).message),
  });
  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("gastos_fixos").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixos"] }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gastos_fixos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fixos"] }); toast.success("Removido"); },
  });
  const lancar = useMutation({
    mutationFn: async (id: string) => {
      const f = fixos?.find((x) => x.id === id);
      if (!f || !f.socio_padrao_id) throw new Error("Defina um sócio pagador no cadastro");
      const { error } = await supabase.from("transacoes").insert({
        tipo: "despesa", valor: f.valor, data: new Date().toISOString().slice(0, 10),
        descricao: f.nome, categoria_id: f.categoria_id, socio_id: f.socio_padrao_id,
        empresa: f.empresa, origem: "fixo",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transacoes"] }); toast.success("Lançado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Gastos fixos" description="Recorrentes mensais"
        action={<Button onClick={() => setShowForm((v) => !v)}><Plus className="w-4 h-4 mr-1" />Novo</Button>} />
      {showForm && (
        <Card className="p-5 mb-4 space-y-3">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Aluguel" maxLength={100} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor (R$)</Label><Input inputMode="decimal" value={valorStr} onChange={(e) => setValorStr(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0,00" /></div>
            <div><Label>Dia do mês</Label><Input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} /></div>
          </div>
          <div><Label>Categoria</Label>
            <select value={catId} onChange={(e) => setCatId(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Selecione</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div><Label>Pagador padrão</Label>
            <select value={socioId} onChange={(e) => setSocioId(e.target.value)} className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm">
              <option value="">Selecione</option>
              {(socios ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}
      <Card className="divide-y divide-border">
        {(fixos ?? []).map((f) => {
          const cat = categorias?.find((c) => c.id === f.categoria_id);
          const socio = socios?.find((s) => s.id === f.socio_padrao_id);
          return (
            <div key={f.id} className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center"><Repeat className="w-4 h-4" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{f.nome}</span>
                  {!f.ativo && <Badge variant="secondary" className="text-[10px]">pausado</Badge>}
                </div>
                <div className="text-xs text-muted-foreground">Dia {f.dia_mes} · {cat?.nome ?? "—"}{socio && ` · ${socio.nome}`}</div>
              </div>
              <div className="font-semibold tabular-nums text-sm">{formatBRL(f.valor)}</div>
              <Button size="sm" variant="outline" onClick={() => lancar.mutate(f.id)} disabled={lancar.isPending}>Lançar</Button>
              <button onClick={() => toggle.mutate({ id: f.id, ativo: !f.ativo })} className="text-xs text-muted-foreground hover:text-foreground px-2">
                {f.ativo ? "Pausar" : "Ativar"}
              </button>
              <button onClick={() => { if (confirm("Remover?")) del.mutate(f.id); }} className="p-2 text-muted-foreground hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {(fixos?.length ?? 0) === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">Nenhum gasto fixo cadastrado.</div>
        )}
      </Card>
    </div>
  );
}