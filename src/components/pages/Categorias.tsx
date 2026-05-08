import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { fetchCategorias } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyErrorMessage } from "@/lib/utils";

const schema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(50),
  tipo: z.enum(["despesa", "receita"]),
});

export function Categorias() {
  const qc = useQueryClient();
  const { data: categorias } = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({ nome, tipo });
      const { error } = await supabase.from("categorias").insert(parsed);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Categoria criada"); qc.invalidateQueries({ queryKey: ["categorias"] }); setNome(""); },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e, "Não foi possível criar a categoria.")),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categorias"] }); toast.success("Removida"); },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e, "Não foi possível remover.")),
  });

  const despesas = (categorias ?? []).filter((c) => c.tipo === "despesa");
  const receitas = (categorias ?? []).filter((c) => c.tipo === "receita");

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader title="Categorias" description="Organize gastos e ganhos" />
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="flex gap-1 p-1 bg-secondary rounded-md">
            {(["despesa", "receita"] as const).map((t) => (
              <button key={t} onClick={() => setTipo(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded ${tipo === t ? "bg-background shadow-sm" : "text-muted-foreground"}`}>
                {t === "despesa" ? "Gasto" : "Ganho"}
              </button>
            ))}
          </div>
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome da categoria" maxLength={50} className="flex-1" />
          <Button onClick={() => create.mutate()} disabled={create.isPending || !nome.trim()}>
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Adicionar</>}
          </Button>
        </div>
      </Card>
      <div className="grid md:grid-cols-2 gap-4">
        {[{ title: "Gastos", items: despesas }, { title: "Ganhos", items: receitas }].map((g) => (
          <Card key={g.title} className="p-5">
            <h3 className="font-semibold mb-3 text-sm">{g.title} ({g.items.length})</h3>
            <div className="space-y-1">
              {g.items.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <span className="text-sm">{c.nome}</span>
                  <button onClick={() => { if (confirm(`Remover "${c.nome}"?`)) del.mutate(c.id); }} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}