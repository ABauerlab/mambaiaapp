import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Calendar, Loader2, Wallet } from "lucide-react";
import { fetchSocios, fetchCategorias } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, toCents, fromCents } from "@/lib/money";
import { splitByCota, pesoDoSocio } from "@/lib/cotas";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn, friendlyErrorMessage } from "@/lib/utils";

const MAMBAIA = "__mambaia__";

const schema = z.object({
  tipo: z.enum(["despesa", "receita"]),
  valor: z.number().positive("Valor deve ser maior que zero").max(10_000_000, "Valor muito alto"),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"),
  descricao: z.string().trim().min(1, "Descricao obrigatoria").max(200),
  categoria_id: z.string().uuid("Selecione uma categoria"),
  socio_id: z.string().nullable(),
  observacoes: z.string().max(500).nullable(),
  participantes_ids: z.array(z.string().uuid()).min(1, "Selecione ao menos um participante"),
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
  const [pagadorId, setPagadorId] = useState<string>(MAMBAIA);
  const [observacoes, setObservacoes] = useState("");
  const [participantes, setParticipantes] = useState<string[]>([]);

  const cats = useMemo(() => (categorias ?? []).filter((c) => c.tipo === tipo), [categorias, tipo]);
  const valor = parseFloat(valorStr.replace(",", ".")) || 0;

  // Inicializa "todos os cotistas" assim que sócios carregam
  const cotistasIds = useMemo(
    () => (socios ?? []).filter((s) => pesoDoSocio(s.nome) > 0).map((s) => s.id),
    [socios],
  );
  useEffect(() => {
    if (participantes.length === 0 && cotistasIds.length > 0) setParticipantes(cotistasIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cotistasIds.join(",")]);

  const preview = useMemo(() => {
    if (!socios || valor <= 0) return null;
    try {
      return splitByCota(toCents(valor), socios.map((s) => ({ id: s.id, nome: s.nome })), participantes);
    } catch { return null; }
  }, [valor, socios, participantes]);

  const pagadorNome = pagadorId === MAMBAIA ? "a Mambaia" : socios?.find((s) => s.id === pagadorId)?.nome;

  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        tipo, valor, data, descricao,
        categoria_id: categoriaId,
        socio_id: pagadorId === MAMBAIA ? null : pagadorId,
        observacoes: observacoes || null,
        participantes_ids: participantes,
      });
      const { error } = await supabase.from("transacoes").insert({ ...parsed, origem: "manual" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transacao registrada");
      qc.invalidateQueries({ queryKey: ["transacoes"] });
      navigate({ to: "/dashboard" });
    },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e, "Nao foi possivel salvar.")),
  });

  function toggleParticipante(id: string) {
    setParticipantes((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  }
  const todosMarcados = cotistasIds.length > 0 && cotistasIds.every((id) => participantes.includes(id)) && participantes.length === cotistasIds.length;
  const modoCota = todosMarcados;

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <PageHeader title="Nova transacao" description="Registre um gasto ou ganho da Mambaia" />

      <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-5">
        <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-xl">
          <button
            type="button"
            onClick={() => { setTipo("despesa"); setCategoriaId(""); }}
            className={cn("flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition min-h-11",
              tipo === "despesa" ? "bg-[color:var(--brand-dark)] text-[color:var(--brand-lime)] shadow-sm" : "text-muted-foreground")}
          >
            <ArrowDownRight className="w-4 h-4" /> Gasto
          </button>
          <button
            type="button"
            onClick={() => { setTipo("receita"); setCategoriaId(""); }}
            className={cn("flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition min-h-11",
              tipo === "receita" ? "bg-[color:var(--brand-lime)] text-[color:var(--brand-dark)] shadow-sm" : "text-muted-foreground")}
          >
            <ArrowUpRight className="w-4 h-4" /> Ganho
          </button>
        </div>

        <Card className="p-5 space-y-4">
          <div>
            <Label htmlFor="valor">Valor</Label>
            <div className="relative mt-1.5">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <Input id="valor" inputMode="decimal" value={valorStr}
                onChange={(e) => setValorStr(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0,00" className="pl-10 text-lg h-12 tabular-nums" required />
            </div>
          </div>

          <div>
            <Label htmlFor="data">Data</Label>
            <div className="relative mt-1.5">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="pl-10" required max={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>

          <div>
            <Label htmlFor="descricao">Descricao</Label>
            <Input id="descricao" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Aluguel novembro" className="mt-1.5" required maxLength={200} />
          </div>

          <div>
            <Label>Categoria</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {cats.map((c) => (
                <button key={c.id} type="button" onClick={() => setCategoriaId(c.id)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium border transition min-h-9",
                    categoriaId === c.id ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/40")}>
                  {c.nome}
                </button>
              ))}
              {cats.length === 0 && <span className="text-xs text-muted-foreground">Nenhuma categoria de {tipo} cadastrada</span>}
            </div>
          </div>

          <div>
            <Label>{tipo === "despesa" ? "Quem pagou?" : "Quem recebeu?"}</Label>
            <div className="mt-1.5 grid grid-cols-3 gap-2 sm:grid-cols-5">
              <button type="button" onClick={() => setPagadorId(MAMBAIA)}
                className={cn("flex flex-col items-center gap-1 py-3 rounded-lg border transition min-h-16",
                  pagadorId === MAMBAIA ? "border-primary bg-secondary" : "border-border hover:border-primary/40")}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-[color:var(--brand-dark)] text-[color:var(--brand-lime)]">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium">Mambaia</span>
              </button>
              {(socios ?? []).map((s) => (
                <button key={s.id} type="button" onClick={() => setPagadorId(s.id)}
                  className={cn("flex flex-col items-center gap-1 py-3 rounded-lg border transition min-h-16",
                    pagadorId === s.id ? "border-primary bg-secondary" : "border-border hover:border-primary/40")}>
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
            <div className="flex items-center justify-between">
              <Label>Quem participa do rateio?</Label>
              <button
                type="button"
                onClick={() => setParticipantes(todosMarcados ? [] : cotistasIds)}
                className="text-xs text-primary hover:underline"
              >
                {todosMarcados ? "Limpar" : "Todos"}
              </button>
            </div>
            <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(socios ?? []).filter((s) => pesoDoSocio(s.nome) > 0).map((s) => {
                const checked = participantes.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleParticipante(s.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition min-h-11",
                      checked ? "border-primary bg-secondary" : "border-border hover:border-primary/40",
                    )}
                  >
                    <span className="w-4 h-4 rounded border flex items-center justify-center text-[10px]"
                      style={{ background: checked ? s.cor : "transparent", color: "#0A2A20" }}>
                      {checked ? "✓" : ""}
                    </span>
                    {s.nome.split(" ")[0]}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {modoCota ? "Divisão por cota (2/2/1/1)." : `Divisão igual entre ${participantes.length} pessoa(s).`}
            </p>
          </div>

          <div>
            <Label htmlFor="obs">Observacoes (opcional)</Label>
            <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="mt-1.5" rows={2} maxLength={500} />
          </div>
        </Card>

        {preview && pagadorNome && socios && (
          <Card className="p-4 bg-secondary/40 border-primary/20">
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Divisao por cota</div>
            <div className="text-sm mb-2">
              {tipo === "despesa" ? "Gasto pago por " : "Recebido por "}
              <strong>{pagadorNome}</strong>: <strong className="tabular-nums">{formatBRL(valor)}</strong>
            </div>
            <ul className="space-y-1 text-sm">
              {socios.map((s) => {
                const c = preview.get(s.id) ?? 0;
                if (c === 0) return null;
                return (
                  <li key={s.id} className="flex justify-between">
                    <span>{s.nome}</span>
                    <span className="tabular-nums font-medium">{formatBRL(fromCents(c))}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Registrar transacao
        </Button>
      </form>
    </div>
  );
}
