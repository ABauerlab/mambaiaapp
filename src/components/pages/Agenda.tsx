import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, ExternalLink, Copy, Check, XCircle, CheckCircle2, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import { friendlyErrorMessage } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type Reserva = {
  id: string;
  data: string;
  hora_inicio: string;
  duracao_minutos: number;
  cliente_nome: string;
  cliente_whatsapp: string;
  valor_total: number;
  valor_sinal: number;
  status: "pendente" | "confirmada" | "paga" | "cancelada";
  cobranca_id: string | null;
  observacoes: string | null;
  created_at: string;
  cobrancas?: { slug: string; status: string } | null;
};

function formatDuracao(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${m}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

async function fetchReservas(from: string, to: string): Promise<Reserva[]> {
  const { data, error } = await sb
    .from("reservas")
    .select("*, cobrancas(slug,status)")
    .gte("data", from)
    .lte("data", to)
    .order("data", { ascending: true })
    .order("hora_inicio", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Reserva[]).map((r) => ({
    ...r,
    valor_total: typeof r.valor_total === "string" ? parseFloat(r.valor_total) : r.valor_total,
    valor_sinal: typeof r.valor_sinal === "string" ? parseFloat(r.valor_sinal) : r.valor_sinal,
  }));
}

export function Agenda() {
  const qc = useQueryClient();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const in60 = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10);
  }, []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(in60);

  const { data: reservas, isLoading } = useQuery({
    queryKey: ["reservas", from, to],
    queryFn: () => fetchReservas(from, to),
  });

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/agendar` : "/agendar";
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Link público copiado");
    setTimeout(() => setCopied(false), 1500);
  };

  const grupos = useMemo(() => {
    const map = new Map<string, Reserva[]>();
    (reservas ?? []).forEach((r) => {
      if (!map.has(r.data)) map.set(r.data, []);
      map.get(r.data)!.push(r);
    });
    return Array.from(map.entries());
  }, [reservas]);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Agenda do estúdio"
        description="Gerencie as reservas do Mambaia. O link público está sempre disponível para o cliente."
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={copyLink}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copiar link público
            </Button>
            <a href="/agendar" target="_blank" rel="noreferrer">
              <Button variant="ghost"><ExternalLink className="w-4 h-4" /> Abrir</Button>
            </a>
          </div>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid md:grid-cols-3 gap-3 items-end">
          <div>
            <Label>De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="text-sm text-muted-foreground">
            {reservas?.length ?? 0} reserva{(reservas?.length ?? 0) === 1 ? "" : "s"} no período
          </div>
        </div>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}

      <div className="space-y-4">
        {grupos.map(([dia, lista]) => (
          <div key={dia}>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2 px-1">
              {new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
            </div>
            <div className="space-y-2">
              {lista.map((r) => <ReservaCard key={r.id} r={r} onChange={() => qc.invalidateQueries({ queryKey: ["reservas"] })} />)}
            </div>
          </div>
        ))}
        {!isLoading && grupos.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma reserva no período selecionado.
          </Card>
        )}
      </div>
    </div>
  );
}

function ReservaCard({ r, onChange }: { r: Reserva; onChange: () => void }) {
  const wa = r.cliente_whatsapp.replace(/\D/g, "");
  const setStatus = useMutation({
    mutationFn: async (status: Reserva["status"]) => {
      const { error } = await sb.from("reservas").update({ status }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reserva atualizada"); onChange(); },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("reservas").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Reserva excluída"); onChange(); },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold tabular-nums">{r.hora_inicio.slice(0, 5)}</span>
            <span className="text-muted-foreground text-sm">· {formatDuracao(r.duracao_minutos)}</span>
            {r.status === "paga" && <Badge className="bg-success text-success-foreground">Paga</Badge>}
            {r.status === "confirmada" && <Badge className="bg-primary text-primary-foreground">Confirmada</Badge>}
            {r.status === "pendente" && <Badge variant="outline">Aguardando sinal</Badge>}
            {r.status === "cancelada" && <Badge variant="secondary">Cancelada</Badge>}
          </div>
          <div className="text-sm mt-1">
            <span className="font-medium">{r.cliente_nome}</span>
            <span className="text-muted-foreground"> · {r.cliente_whatsapp}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Total {formatBRL(r.valor_total)} · sinal {formatBRL(r.valor_sinal)}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {r.cobrancas?.slug && (
            <Link to="/cobranca/$slug" params={{ slug: r.cobrancas.slug }} target="_blank">
              <Button size="sm" variant="ghost"><ExternalLink className="w-3 h-3" /> Cobrança</Button>
            </Link>
          )}
          {wa.length >= 10 && (
            <a href={`https://wa.me/${wa.startsWith("55") ? wa : "55" + wa}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost"><MessageCircle className="w-3 h-3" /> WhatsApp</Button>
            </a>
          )}
          {r.status !== "paga" && (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("paga")}>
              <CheckCircle2 className="w-3 h-3" /> Marcar paga
            </Button>
          )}
          {r.status !== "cancelada" ? (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("cancelada")}>
              <XCircle className="w-3 h-3" /> Cancelar
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setStatus.mutate("pendente")}>
              Reabrir
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir esta reserva?")) remove.mutate(); }}>
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      </div>
    </Card>
  );
}