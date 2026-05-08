import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Calendar, Loader2 } from "lucide-react";
import { fetchSocios, fetchCategorias } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, splitForPayer, toCents, fromCents } from "@/lib/money";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { friendlyErrorMessage } from "@/lib/utils";

const EMPRESAS = ["Mambaia", "Kriya", "Kodara", "Asari", "Bauer Lab"] as const;

const schema = z.object({
  tipo: z.enum(["despesa", "receita"]),
  valor: z.number().positive("Valor deve ser maior que zero").max(10_000_000, "Valor muito alto"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  descricao: z.string().trim().min(1, "Descrição obrigatória").max(200),
  categoria_id: z.string().uuid("Selecione uma categoria"),
  socio_id: z.string().uuid("Selecione quem pagou/recebeu"),
  empresa: z.string().max(50).nullable(),
  observacoes: z.string().max(500).nullable(),
});

export function NovaTransacao() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });
  const { data: categorias } = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });

  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [valorStr, setValorStr] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState<string>("");
  const [socioId, setSocioId] = useState<string>("");
  const [empresa, setEmpresa] = useState<string>("Mambaia");
  const [observacoes, setObservacoes] = useState("");

  const cats = useMemo(
    () => (categorias ?? []).filter((c) => c.tipo === tipo),
    [categorias, tipo],
  );

  // Preview da divisão
  const valor = parseFloat(valorStr.replace(",", ".")) || 0;
  const preview = useMemo(() => {
    if (tipo !== "despesa" || !socios || socios.length === 0 || valor <= 0) return null;
    try {
      const r = splitForPayer(toCents(valor), socios.length);
      return r;
    } catch { return null; }
  }, [valor, tipo, socios]);

  const pagador = socios?.find((s) => s.id === socioId);

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        tipo,
        valor,
        data,
        descricao,
        categoria_id: categoriaId,
        socio_id: socioId,
        empresa: empresa || null,
        observacoes: observacoes || null,
      });
      const { error } = await supabase.from("transacoes").insert({
        ...parsed,
        origem: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transação registrada");
      qc.invalidateQueries({ queryKey: ["transacoes"] });
      navigate({ to: "/" });
    },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e, "Não foi possível salvar a transação.")),
  });

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <PageHeader title="Nova transação" description="Registre um gasto ou ganho da Mambaia" />

      <form
        onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
        className="space-y-5"
      >
        {/* Toggle tipo */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl">
          <button
            type="button"
            onClick={() => { setTipo("despesa"); setCategoriaId(""); }}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition",
              tipo === "despesa" ? "bg-[color:var(--brand-dark)] text-[color:var(--brand-lime)] shadow-sm" : "text-muted-foreground"
            )}
          >
            <ArrowDownRight className="w-4 h-4" /> Gasto
          </button>
          <button
            type="button"
            onClick={() => { setTipo("receita"); setCategoriaId(""); }}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition",
              tipo === "receita" ? "bg-[color:var(--brand-lime)] text-[color:var(--brand-dark)] shadow-sm" : "text-muted-foreground"
            )}
          >
            <ArrowUpRight className="w-4 h-4" /> Ganho
          </button>
        </div>

        <Card className="p-5 space-y-4">
          <div>
            <Label htmlFor="valor">Valor</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input
                id="valor"
                inputMode="decimal"
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0,00"
                className="pl-10 text-lg h-12 tabular-nums"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="data">Data</Label>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="pl-10" required max={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>
            <div>
              <Label htmlFor="empresa">Empresa</Label>
              <select
                id="empresa"
                value={empresa}
                onChange={(e) => setEmpresa(e.target.value)}
                className="mt-1.5 w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                {EMPRESAS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Aluguel novembro" className="mt-1.5" required maxLength={200} />
          </div>

          <div>
            <Label>Categoria</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaId(c.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                    categoriaId === c.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:border-primary/40"
                  )}
                >
                  {c.nome}
                </button>
              ))}
              {cats.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhuma categoria de {tipo} cadastrada</span>
              )}
            </div>
          </div>

          <div>
            <Label>{tipo === "despesa" ? "Quem pagou?" : "Quem recebeu?"}</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(socios ?? []).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSocioId(s.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-3 rounded-lg border transition",
                    socioId === s.id ? "border-primary bg-secondary" : "border-border hover:border-primary/40"
                  )}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: s.cor, color: "#0A2A20" }}>
                    {s.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <span className="text-xs font-medium">{s.nome.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="obs">Observações (opcional)</Label>
            <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="mt-1.5" rows={2} maxLength={500} />
          </div>
        </Card>

        {tipo === "despesa" && preview && pagador && socios && (
          <Card className="p-4 bg-secondary/40 border-primary/20">
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Divisão</div>
            <div className="text-sm">
              <strong>{pagador.nome}</strong> pagou <strong className="tabular-nums">{formatBRL(valor)}</strong>.
              Cada um dos outros {socios.length - 1} sócios deve <strong className="tabular-nums">{formatBRL(fromCents(preview.eachOwes))}</strong> para {pagador.nome.split(" ")[0]}.
            </div>
          </Card>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Registrar transação
        </Button>
      </form>
    </div>
  );
}