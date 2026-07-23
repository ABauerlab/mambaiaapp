import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Repeat, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { notifyImmediate } from "@/lib/push.functions";
import { fetchGastosFixos, fetchCategorias, fetchSocios, type GastoFixo } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { formatBRL } from "@/lib/money";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { friendlyErrorMessage } from "@/lib/utils";

const MAMBAIA = "__mambaia__";
const FREQS = [
  { value: "mensal", label: "Mensal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "semanal", label: "Semanal" },
  { value: "anual", label: "Anual" },
] as const;
const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const schema = z.object({
  nome: z.string().trim().min(1, "Nome obrigatório").max(100),
  valor: z.number().positive("Valor inválido").max(10_000_000),
  dia_mes: z.number().int().min(1).max(31),
  categoria_id: z.string().uuid("Selecione uma categoria"),
  socio_padrao_id: z.string().uuid().nullable(),
  frequencia: z.enum(["mensal", "semanal", "quinzenal", "anual"]),
  dia_semana: z.number().int().min(0).max(6).nullable(),
  mes: z.number().int().min(1).max(12).nullable(),
  empresa: z.string().nullable().optional(),
});

function parseDuracao(empresaStr: string | null): { total: number | null; lancadas: number } {
  if (!empresaStr) return { total: null, lancadas: 0 };
  const m = empresaStr.match(/PARCELAS:(\d+)(?:\|LANCADAS:(\d+))?/);
  if (!m) return { total: null, lancadas: 0 };
  return { total: parseInt(m[1], 10), lancadas: parseInt(m[2] || "0", 10) };
}

function buildEmpresaString(total: number | null, lancadas: number): string | null {
  if (!total || total <= 0) return null;
  return `PARCELAS:${total}|LANCADAS:${lancadas}`;
}

export function GastosFixos() {
  const qc = useQueryClient();
  const notify = useServerFn(notifyImmediate);
  const { data: fixos } = useQuery({ queryKey: ["fixos"], queryFn: fetchGastosFixos });
  const { data: categorias } = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });

  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [valorStr, setValorStr] = useState("");
  const [dia, setDia] = useState("5");
  const [catId, setCatId] = useState("");
  const [socioId, setSocioId] = useState<string>(MAMBAIA);
  const [frequencia, setFrequencia] = useState<"mensal" | "semanal" | "quinzenal" | "anual">("mensal");
  const [diaSemana, setDiaSemana] = useState("1");
  const [mes, setMes] = useState("1");
  const [duracaoParcelas, setDuracaoParcelas] = useState(""); // Ex: "3" parcelas

  const cats = (categorias ?? []).filter((c) => c.tipo === "despesa");

  const create = useMutation({
    mutationFn: async () => {
      const numTotal = parseInt(duracaoParcelas, 10);
      const empresaMetadata = Number.isInteger(numTotal) && numTotal > 0 ? buildEmpresaString(numTotal, 0) : null;

      const parsed = schema.parse({
        nome,
        valor: parseFloat(valorStr.replace(",", ".")),
        dia_mes: parseInt(dia, 10) || 1,
        categoria_id: catId,
        socio_padrao_id: socioId === MAMBAIA ? null : socioId,
        frequencia,
        dia_semana: frequencia === "semanal" ? parseInt(diaSemana, 10) : null,
        mes: frequencia === "anual" ? parseInt(mes, 10) : null,
        empresa: empresaMetadata,
      });

      const { error } = await supabase.from("gastos_fixos").insert(parsed);
      if (error) throw error;

      void notify({
        data: {
          title: "Novo gasto fixo",
          body: `${parsed.nome} - ${formatBRL(parsed.valor)} (${parsed.frequencia})`,
          url: "/fixos",
        },
      }).catch(() => {});
    },
    onSuccess: () => {
      toast.success("Gasto fixo cadastrado com sucesso!");
      qc.invalidateQueries({ queryKey: ["fixos"] });
      setShowForm(false);
      setNome("");
      setValorStr("");
      setDia("5");
      setCatId("");
      setSocioId(MAMBAIA);
      setFrequencia("mensal");
      setDiaSemana("1");
      setMes("1");
      setDuracaoParcelas("");
    },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e, "Não foi possível salvar. Tente novamente.")),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("gastos_fixos").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixos"] }),
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e, "Não foi possível atualizar.")),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("gastos_fixos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fixos"] });
      toast.success("Removido");
    },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e, "Não foi possível remover.")),
  });

  const lancar = useMutation({
    mutationFn: async (f: GastoFixo) => {
      const { total, lancadas } = parseDuracao(f.empresa);
      const proximaLancada = lancadas + 1;
      const desc = total ? `${f.nome} (${proximaLancada}/${total})` : f.nome;

      const { error: errTx } = await supabase.from("transacoes").insert({
        tipo: "despesa",
        valor: f.valor,
        data: new Date().toISOString().slice(0, 10),
        descricao: desc,
        categoria_id: f.categoria_id,
        socio_id: f.socio_padrao_id,
        empresa: f.empresa,
        origem: "fixo",
      });
      if (errTx) throw errTx;

      // Se tem número limite de parcelas, atualizar contagem ou desativar ao terminar
      if (total && total > 0) {
        const novoAtivo = proximaLancada < total;
        const novoEmpresa = buildEmpresaString(total, proximaLancada);
        const { error: errUp } = await supabase
          .from("gastos_fixos")
          .update({ empresa: novoEmpresa, ativo: novoAtivo })
          .eq("id", f.id);
        if (errUp) throw errUp;
      }
    },
    onSuccess: (_, f) => {
      qc.invalidateQueries({ queryKey: ["transacoes"] });
      qc.invalidateQueries({ queryKey: ["fixos"] });
      const { total, lancadas } = parseDuracao(f.empresa);
      if (total && lancadas + 1 >= total) {
        toast.success(`Última parcela (${total}/${total}) lançada! Gasto fixo concluído e pausado.`);
      } else {
        toast.success(total ? `Parcela ${lancadas + 1} de ${total} lançada!` : "Transação lançada!");
      }
    },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e, "Não foi possível lançar.")),
  });

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <PageHeader
        title="Gastos fixos"
        description="Recorrentes mensais e compras parceladas"
        action={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        }
      />

      {showForm && (
        <Card className="p-5 mb-4 space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Aluguel, Parcela Equipamento" maxLength={100} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor (R$)</Label>
              <Input
                inputMode="decimal"
                value={valorStr}
                onChange={(e) => setValorStr(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Recorrência</Label>
              <select
                value={frequencia}
                onChange={(e) => setFrequencia(e.target.value as typeof frequencia)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
              >
                {FREQS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(frequencia === "mensal" || frequencia === "quinzenal") && (
              <div>
                <Label>Dia do mês</Label>
                <Input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} />
              </div>
            )}
            {frequencia === "semanal" && (
              <div>
                <Label>Dia da semana</Label>
                <select
                  value={diaSemana}
                  onChange={(e) => setDiaSemana(e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {DIAS_SEMANA.map((d, i) => (
                    <option key={i} value={i}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {frequencia === "anual" && (
              <>
                <div>
                  <Label>Dia</Label>
                  <Input type="number" min={1} max={31} value={dia} onChange={(e) => setDia(e.target.value)} />
                </div>
                <div>
                  <Label>Mês</Label>
                  <select
                    value={mes}
                    onChange={(e) => setMes(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    {MESES.map((m, i) => (
                      <option key={i} value={i + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div>
              <Label>Duração / Nº de parcelas (opcional)</Label>
              <Input
                type="number"
                min={1}
                max={120}
                value={duracaoParcelas}
                onChange={(e) => setDuracaoParcelas(e.target.value)}
                placeholder="Ex: 3 (3 meses)"
              />
            </div>
          </div>

          <div>
            <Label>Categoria</Label>
            <select
              value={catId}
              onChange={(e) => setCatId(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">Selecione</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Pagador padrão</Label>
            <select
              value={socioId}
              onChange={(e) => setSocioId(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value={MAMBAIA}>Mambaia (caixa)</option>
              {(socios ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Salvar
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      <Card className="divide-y divide-border">
        {(fixos ?? []).map((f) => {
          const cat = categorias?.find((c) => c.id === f.categoria_id);
          const socio = socios?.find((s) => s.id === f.socio_padrao_id);
          const { total, lancadas } = parseDuracao(f.empresa);

          const recorrencia =
            f.frequencia === "semanal"
              ? `Toda ${DIAS_SEMANA[f.dia_semana ?? 1]}`
              : f.frequencia === "anual"
              ? `Anual · ${f.dia_mes}/${f.mes ?? 1}`
              : f.frequencia === "quinzenal"
              ? `Quinzenal · dia ${f.dia_mes}`
              : `Dia ${f.dia_mes}`;

          const concluida = total != null && lancadas >= total;

          return (
            <div key={f.id} className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                <Repeat className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{f.nome}</span>
                  {concluida && (
                    <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/10 text-[10px]">
                      Concluído ({total}/{total})
                    </Badge>
                  )}
                  {!f.ativo && !concluida && (
                    <Badge variant="secondary" className="text-[10px]">
                      pausado
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {recorrencia} · {cat?.nome ?? "-"} · {socio ? socio.nome : "Mambaia"}
                  {total && (
                    <span className="font-medium text-foreground ml-1">
                      · {lancadas}/{total} parcelas
                    </span>
                  )}
                </div>
              </div>

              <div className="font-semibold tabular-nums text-sm shrink-0">{formatBRL(f.valor)}</div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => lancar.mutate(f)}
                disabled={lancar.isPending || concluida}
              >
                {concluida ? <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : null}
                {concluida ? "Concluído" : "Lançar"}
              </Button>

              <button
                onClick={() => toggle.mutate({ id: f.id, ativo: !f.ativo })}
                className="text-xs text-muted-foreground hover:text-foreground px-1"
              >
                {f.ativo ? "Pausar" : "Ativar"}
              </button>

              <button
                onClick={() => {
                  if (confirm("Remover este gasto fixo?")) del.mutate(f.id);
                }}
                className="p-1.5 text-muted-foreground hover:text-destructive"
              >
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
