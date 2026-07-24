import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Trash2,
  PlusCircle,
  Search,
  Wallet,
  Loader2,
} from "lucide-react";
import { fetchTransacoes, fetchSocios, fetchCategorias } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { formatBRL } from "@/lib/money";
import { PageHeader } from "./PageHeader";
import {
  DateRangeFilter,
  defaultMonthRange,
  isInRange,
  type DateRangeValue,
} from "@/components/DateRangeFilter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn, friendlyErrorMessage } from "@/lib/utils";
import type { Transacao } from "@/lib/db";

const MAMBAIA = "__mambaia__";

export function Transacoes() {
  const qc = useQueryClient();
  const { data: transacoes } = useQuery({ queryKey: ["transacoes"], queryFn: fetchTransacoes });
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });
  const { data: categorias } = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });
  useRealtimeInvalidate("transacoes", ["transacoes"]);

  const [filtro, setFiltro] = useState("");
  const [tipo, setTipo] = useState<"todos" | "despesa" | "receita">("todos");
  const [range, setRange] = useState<DateRangeValue>(() => defaultMonthRange());
  const [editTx, setEditTx] = useState<Transacao | null>(null);

  const filtered = useMemo(() => {
    return (transacoes ?? []).filter((t) => {
      if (tipo !== "todos" && t.tipo !== tipo) return false;
      if (!isInRange(t.data, range)) return false;
      if (filtro && !t.descricao.toLowerCase().includes(filtro.toLowerCase())) return false;
      return true;
    });
  }, [transacoes, filtro, tipo, range]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transação removida");
      qc.invalidateQueries({ queryKey: ["transacoes"] });
    },
    onError: (e: unknown) =>
      toast.error(friendlyErrorMessage(e, "Não foi possível remover. Tente novamente.")),
  });

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Transações"
        description="Histórico de todos os gastos e ganhos"
        action={
          <Button asChild>
            <Link to="/nova">
              <PlusCircle className="w-4 h-4 mr-2" />
              Nova
            </Link>
          </Button>
        }
      />

      <Card className="p-3 mb-4 flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Buscar descrição..."
            className="pl-9"
          />
        </div>
        <DateRangeFilter value={range} onChange={setRange} />
        <div className="flex gap-1 p-1 bg-secondary rounded-md">
          {(["todos", "despesa", "receita"] as const).map((t) => (
            <button
              key={t}
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
            <div
              key={t.id}
              className="flex items-center gap-3 p-3 md:p-4 hover:bg-secondary/40 cursor-pointer"
              onClick={() => setEditTx(t)}
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${t.tipo === "receita" ? "bg-[color:var(--brand-lime)] text-[color:var(--brand-dark)]" : "bg-[color:var(--brand-dark)] text-[color:var(--brand-lime)]"}`}
              >
                {t.tipo === "receita" ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-medium text-sm truncate">{t.descricao}</div>
                  {t.acertada && (
                    <Badge variant="secondary" className="text-[10px]">
                      acertada
                    </Badge>
                  )}
                  {t.origem === "fixo" && (
                    <Badge variant="outline" className="text-[10px]">
                      fixo
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {new Date(t.data + "T00:00:00").toLocaleDateString("pt-BR")} · {cat?.nome ?? "-"}
                  {socio ? ` · ${socio.nome}` : ` · Mambaia`}
                </div>
              </div>
              <div
                className={`text-sm font-semibold tabular-nums ${t.tipo === "receita" ? "text-[color:var(--success)]" : ""}`}
              >
                {t.tipo === "receita" ? "+" : "−"}
                {formatBRL(t.valor)}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("Remover esta transação?")) del.mutate(t.id);
                }}
                className="p-2 text-muted-foreground hover:text-destructive"
                aria-label="Remover"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            Nenhuma transação encontrada.
          </div>
        )}
      </Card>

      <EditarTransacaoDialog
        tx={editTx}
        socios={socios ?? []}
        categorias={categorias ?? []}
        onClose={() => setEditTx(null)}
      />
    </div>
  );
}

function EditarTransacaoDialog({
  tx,
  socios,
  categorias,
  onClose,
}: {
  tx: Transacao | null;
  socios: { id: string; nome: string; cor: string }[];
  categorias: { id: string; nome: string; tipo: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"despesa" | "receita">("despesa");
  const [valorStr, setValorStr] = useState("");
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [pagadorId, setPagadorId] = useState<string>(MAMBAIA);
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!tx) return;
    setTipo(tx.tipo);
    setValorStr(String(tx.valor).replace(".", ","));
    setData(tx.data);
    setDescricao(tx.descricao);
    setCategoriaId(tx.categoria_id ?? "");
    setPagadorId(tx.socio_id ?? MAMBAIA);
    setObservacoes(tx.observacoes ?? "");
  }, [tx]);

  const cats = useMemo(() => categorias.filter((c) => c.tipo === tipo), [categorias, tipo]);

  const save = useMutation({
    mutationFn: async () => {
      if (!tx) return;
      const valor = parseFloat(valorStr.replace(",", "."));
      if (!(valor > 0)) throw new Error("Valor inválido");
      if (!descricao.trim()) throw new Error("Descrição obrigatória");
      if (!categoriaId) throw new Error("Selecione uma categoria");
      const { error } = await supabase
        .from("transacoes")
        .update({
          tipo,
          valor,
          data,
          descricao: descricao.trim(),
          categoria_id: categoriaId,
          socio_id: pagadorId === MAMBAIA ? null : pagadorId,
          observacoes: observacoes.trim() || null,
        })
        .eq("id", tx.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transação atualizada");
      qc.invalidateQueries({ queryKey: ["transacoes"] });
      onClose();
    },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e, "Não foi possível salvar.")),
  });

  return (
    <Dialog open={!!tx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar transação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 p-1 bg-secondary rounded-lg">
            {(["despesa", "receita"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setTipo(t);
                  setCategoriaId("");
                }}
                className={cn(
                  "py-2 rounded-md text-sm font-medium",
                  tipo === t
                    ? t === "despesa"
                      ? "bg-[color:var(--brand-dark)] text-[color:var(--brand-lime)]"
                      : "bg-[color:var(--brand-lime)] text-[color:var(--brand-dark)]"
                    : "text-muted-foreground",
                )}
              >
                {t === "despesa" ? "Gasto" : "Ganho"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                inputMode="decimal"
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value.replace(/[^\d.,]/g, ""))}
              />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={200}
            />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoriaId} onValueChange={setCategoriaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tipo === "despesa" ? "Quem pagou" : "Quem recebeu"}</Label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => setPagadorId(MAMBAIA)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 rounded-lg border",
                  pagadorId === MAMBAIA ? "border-primary bg-secondary" : "border-border",
                )}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[color:var(--brand-dark)] text-[color:var(--brand-lime)]">
                  <Wallet className="w-4 h-4" />
                </div>
                <span className="text-[11px]">Mambaia</span>
              </button>
              {socios.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setPagadorId(s.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 rounded-lg border",
                    pagadorId === s.id ? "border-primary bg-secondary" : "border-border",
                  )}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold"
                    style={{ background: s.cor, color: "#0A2A20" }}
                  >
                    {s.nome
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")}
                  </div>
                  <span className="text-[11px]">{s.nome.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea
              rows={2}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              maxLength={500}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
