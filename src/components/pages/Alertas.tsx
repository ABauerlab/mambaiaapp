import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, Plus, Trash2, Send, Loader2, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { notifyImmediate } from "@/lib/push.functions";
import { PushNotificationsCard } from "@/components/PushNotificationsCard";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { friendlyErrorMessage } from "@/lib/utils";

type Alerta = {
  id: string;
  nome: string;
  observacao: string | null;
  data: string;
  hora: string;
  recorrencia: string;
  somente_dia_util: boolean;
  ativo: boolean;
};

const RECORRENCIAS = [
  { value: "unica", label: "Uma vez" },
  { value: "diaria", label: "Todo dia" },
  { value: "semanal", label: "Toda semana" },
  { value: "quinzenal", label: "A cada 15 dias" },
  { value: "mensal", label: "Todo mês" },
] as const;

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do alerta").max(80),
  observacao: z.string().trim().max(300).nullable(),
  data: z.string().min(10, "Escolha a data"),
  hora: z.string().min(4, "Escolha a hora"),
  recorrencia: z.enum(["unica", "diaria", "semanal", "quinzenal", "mensal"]),
  somente_dia_util: z.boolean(),
});

async function fetchAlertas(): Promise<Alerta[]> {
  const { data, error } = await supabase
    .from("alertas")
    .select("*")
    .order("data", { ascending: true })
    .order("hora", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as Alerta[];
}

function fmtData(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

export function Alertas() {
  const qc = useQueryClient();
  const notify = useServerFn(notifyImmediate);
  const { data: alertas, isLoading } = useQuery({ queryKey: ["alertas"], queryFn: fetchAlertas });
  useRealtimeInvalidate("alertas", ["alertas"]);

  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [obs, setObs] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [hora, setHora] = useState("09:00");
  const [recorrencia, setRecorrencia] = useState<(typeof RECORRENCIAS)[number]["value"]>("semanal");
  const [diaUtil, setDiaUtil] = useState(true);

  function reset() {
    setNome("");
    setObs("");
    setData(new Date().toISOString().slice(0, 10));
    setHora("09:00");
    setRecorrencia("semanal");
    setDiaUtil(true);
    setShowForm(false);
  }

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse({
        nome,
        observacao: obs.trim() ? obs.trim() : null,
        data,
        hora,
        recorrencia,
        somente_dia_util: diaUtil,
      });
      const { error } = await supabase.from("alertas").insert(parsed);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerta cadastrado!");
      qc.invalidateQueries({ queryKey: ["alertas"] });
      reset();
    },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e)),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("alertas").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alertas"] }),
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alertas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Alerta excluído");
      qc.invalidateQueries({ queryKey: ["alertas"] });
    },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e)),
  });

  async function testar(a: Alerta) {
    try {
      await notify({
        data: {
          title: `Mambaia • ${a.nome}`,
          body: a.observacao?.trim() || `Lembrete das ${a.hora.slice(0, 5)}`,
          url: "/alertas",
          tag: `teste-${a.id}`,
        },
      });
      toast.success("Notificação de teste enviada");
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <PageHeader
        title="Alertas"
        description="Lembretes que chegam como notificação no celular dos sócios."
      />

      <PushNotificationsCard />

      {!showForm ? (
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Plus className="mr-1 h-4 w-4" /> Novo alerta
        </Button>
      ) : (
        <Card className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="al-nome">Nome</Label>
            <Input
              id="al-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Faxina"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="al-data">Data</Label>
              <Input
                id="al-data"
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-hora">Hora</Label>
              <Input
                id="al-hora"
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Repetir</Label>
            <div className="flex flex-wrap gap-2">
              {RECORRENCIAS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRecorrencia(r.value)}
                  className={
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition " +
                    (recorrencia === r.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted-foreground hover:bg-muted")
                  }
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="pr-3">
              <div className="text-sm font-medium">Somente em dia útil</div>
              <p className="text-xs text-muted-foreground">
                Se cair no fim de semana, avisa na segunda seguinte.
              </p>
            </div>
            <Switch checked={diaUtil} onCheckedChange={setDiaUtil} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="al-obs">Observações da notificação</Label>
            <Textarea
              id="al-obs"
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              placeholder="Texto que aparece no corpo da notificação"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Salvar alerta
            </Button>
            <Button variant="ghost" onClick={reset}>
              Cancelar
            </Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (alertas ?? []).length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          Nenhum alerta cadastrado ainda.
        </Card>
      ) : (
        <div className="space-y-2">
          {(alertas ?? []).map((a) => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <BellRing className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.nome}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {RECORRENCIAS.find((r) => r.value === a.recorrencia)?.label ?? a.recorrencia}
                    </Badge>
                    {a.somente_dia_util && (
                      <Badge variant="outline" className="text-[10px]">
                        Dia útil
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {fmtData(a.data)} às {a.hora.slice(0, 5)}
                  </div>
                  {a.observacao && (
                    <p className="mt-1 text-sm text-muted-foreground break-words">{a.observacao}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Switch
                      checked={a.ativo}
                      onCheckedChange={(v) => toggle.mutate({ id: a.id, ativo: v })}
                      aria-label="Ativar alerta"
                    />
                    <span className="text-xs text-muted-foreground">
                      {a.ativo ? "Ativo" : "Pausado"}
                    </span>
                    <Button size="sm" variant="outline" onClick={() => void testar(a)}>
                      <Send className="mr-1 h-3.5 w-3.5" /> Testar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(a.id)}
                      aria-label={`Excluir alerta ${a.nome}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
