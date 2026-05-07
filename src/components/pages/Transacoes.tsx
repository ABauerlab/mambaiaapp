import { useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Trash2, PlusCircle, Search } from "lucide-react";
import { fetchTransacoes, fetchSocios, fetchCategorias } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/money";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function Transacoes() {
  const qc = useQueryClient();
  const { data: transacoes } = useQuery({ queryKey: ["transacoes"], queryFn: fetchTransacoes });
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });
  const { data: categorias } = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });

  const [filtro, setFiltro] = useState("");
  const [tipo, setTipo] = useState<"todos" | "despesa" | "receita">("todos");

  const filtered = useMemo(() => {
    return (transacoes ?? []).filter((t) => {
      if (tipo !== "todos" && t.tipo !== tipo) return false;
      if (filtro && !t.descricao.toLowerCase().includes(filtro.toLowerCase())) return false;
      return true;
    });
  }, [transacoes, filtro, tipo]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transação removida");
      qc.invalidateQueries({ queryKey: ["transacoes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Transações"
        description="Histórico de todos os gastos e ganhos"
        action={
          <Button asChild>
            <Link to="/nova"><PlusCircle className="w-4 h-4 mr-2" />Nova</Link>
          </Button>
        }
      />

      <Card className="p-3 mb-4 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar descrição..." className="pl-9" />
        </div>
        <div className="flex gap-1 p-1 bg-secondary rounded-md">
          {(["todos", "despesa", "receita"] as const).map((t) => (
            <button key={t}
              onClick={() => setTipo(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded ${tipo === t ? "bg-background shadow-sm" : "text-muted-foreground"}`}
            >
              {t === "todos" ? "Todos" : t === "despesa" ? "Gastos" : "Ganhos"}
            </button>
          ))}
        </div>
      </Card>

      <Card className="divide-y divide-border">
        {filtered.map((t) => {
          const cat = categorias?.find((c) => c.id === t.categoria_id);
          const socio = socios?.find((s) => s.id === t.socio_id);
          return (
            <div key={t.id} className="flex items-center gap-3 p-3 md:p-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.tipo === "receita" ? "bg-[color:var(--brand-lime)] text-[color:var(--brand-dark)]" : "bg-[color:var(--brand-dark)] text-[color:var(--brand-lime)]"}`}>
                {t.tipo === "receita" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium text-sm truncate">{t.descricao}</div>
                  {t.acertada && <Badge variant="secondary" className="text-[10px]">acertada</Badge>}
                  {t.origem === "fixo" && <Badge variant="outline" className="text-[10px]">fixo</Badge>}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(t.data + "T00:00:00").toLocaleDateString("pt-BR")} · {cat?.nome ?? "—"}
                  {socio && ` · ${socio.nome}`}
                  {t.empresa && ` · ${t.empresa}`}
                </div>
              </div>
              <div className={`text-sm font-semibold tabular-nums ${t.tipo === "receita" ? "text-[color:var(--success)]" : ""}`}>
                {t.tipo === "receita" ? "+" : "−"}{formatBRL(t.valor)}
              </div>
              <button
                onClick={() => { if (confirm("Remover esta transação?")) del.mutate(t.id); }}
                className="p-2 text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">Nenhuma transação encontrada.</div>
        )}
      </Card>
    </div>
  );
}