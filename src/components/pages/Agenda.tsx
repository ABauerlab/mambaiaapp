import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Loader2,
  ExternalLink,
  Copy,
  Check,
  XCircle,
  CheckCircle2,
  MessageCircle,
  Trash2,
  FileDown,
  Lock,
  Unlock,
  Pencil,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "./PageHeader";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatBRL } from "@/lib/money";
import { friendlyErrorMessage } from "@/lib/utils";
import { formatPhoneBR, maskPhoneInput, onlyDigits, isValidPhoneBR } from "@/lib/phone";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import type { ReservaPDFInput } from "@/lib/reserva-pdf";

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
  valor_pago: number | null;
  tipo_pagamento: "integral" | "parcial" | null;
  paid_at: string | null;
  tipo: "locacao" | "pacote_marcas" | null;
  empreendimento: string | null;
  numero_proposta: number;
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
    const d = new Date();
    d.setDate(d.getDate() + 60);
    return d.toISOString().slice(0, 10);
  }, []);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(in60);

  // Modal para Bloquear Horário
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockData, setBlockData] = useState(today);
  const [blockHora, setBlockHora] = useState("09:00");
  const [blockDuracao, setBlockDuracao] = useState<number>(120);
  const [blockMotivo, setBlockMotivo] = useState("");

  const { data: reservas, isLoading } = useQuery({
    queryKey: ["reservas", from, to],
    queryFn: () => fetchReservas(from, to),
  });
  useRealtimeInvalidate("reservas", ["reservas", "ocupados"]);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/agendar` : "/agendar";
  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    toast.success("Link público copiado");
    setTimeout(() => setCopied(false), 1500);
  };

  const criarBloqueio = useMutation({
    mutationFn: async () => {
      const motivo = blockMotivo.trim() || "Uso interno / Indisponível";
      const { error } = await sb.from("reservas").insert({
        data: blockData,
        hora_inicio: blockHora + ":00",
        duracao_minutos: blockDuracao,
        cliente_nome: `BLOQUEIO: ${motivo}`,
        cliente_whatsapp: "00000000000",
        valor_total: 0,
        valor_sinal: 0,
        status: "confirmada",
        observacoes: `Bloqueio de agenda: ${motivo}`,
        tipo: "locacao",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Horário bloqueado na agenda");
      setBlockOpen(false);
      setBlockMotivo("");
      qc.invalidateQueries({ queryKey: ["reservas"] });
      qc.invalidateQueries({ queryKey: ["ocupados"] });
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

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
        description="Gerencie as reservas e bloqueios do estúdio. Horários bloqueados não aparecem como disponíveis para o cliente."
        action={
          <div className="flex gap-2 flex-wrap">
            <Button variant="default" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => setBlockOpen(true)}>
              <Lock className="w-4 h-4 mr-1.5" /> Bloquear horário
            </Button>
            <Button variant="outline" onClick={copyLink}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              Copiar link público
            </Button>
            <a href="/agendar" target="_blank" rel="noreferrer">
              <Button variant="ghost">
                <ExternalLink className="w-4 h-4" /> Abrir
              </Button>
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
            {reservas?.length ?? 0} item{(reservas?.length ?? 0) === 1 ? "" : "s"} no período
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-brand-dark text-brand-cream px-4 py-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[10px] uppercase tracking-widest opacity-70">Período selecionado</span>
          <span className="text-sm md:text-base font-semibold capitalize">
            {new Date(from + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}{" "}
            até{" "}
            {new Date(to + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
          </span>
          <span className="ml-auto text-xs opacity-80">
            {grupos.length} dia{grupos.length === 1 ? "" : "s"} com agendamentos
          </span>
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
            <div className="sticky top-0 z-10 -mx-4 md:mx-0 px-4 md:px-3 py-2 mb-3 bg-brand-dark text-brand-cream rounded-md flex items-baseline gap-3 shadow-sm">
              <span className="text-2xl md:text-3xl font-bold tabular-nums leading-none">
                {new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit" })}
              </span>
              <span className="text-sm md:text-base font-medium capitalize">
                {new Date(dia + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", month: "long", year: "numeric" })}
              </span>
              <span className="ml-auto text-xs opacity-75">
                {lista.length} agendamento{lista.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="space-y-2">
              {lista.map((r) => (
                <ReservaCard
                  key={r.id}
                  r={r}
                  onChange={() => {
                    qc.invalidateQueries({ queryKey: ["reservas"] });
                    qc.invalidateQueries({ queryKey: ["ocupados"] });
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        {!isLoading && grupos.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Nenhuma reserva ou bloqueio no período selecionado.
          </Card>
        )}
      </div>

      {/* Modal para Bloquear Horário */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              Bloquear horário na agenda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs text-muted-foreground">
              O horário bloqueado ficará indisponível para reservas no site público.
            </p>
            <div>
              <Label>Data</Label>
              <Input type="date" value={blockData} onChange={(e) => setBlockData(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Hora de início</Label>
                <Input type="time" value={blockHora} onChange={(e) => setBlockHora(e.target.value)} />
              </div>
              <div>
                <Label>Duração</Label>
                <select
                  value={blockDuracao}
                  onChange={(e) => setBlockDuracao(parseInt(e.target.value, 10))}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value={30}>30 minutos</option>
                  <option value={60}>1 hora</option>
                  <option value={120}>2 horas</option>
                  <option value={180}>3 horas</option>
                  <option value={240}>4 horas</option>
                  <option value={480}>8 horas (Turno)</option>
                  <option value={780}>Dia inteiro (09h às 22h)</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Motivo / Observação (opcional)</Label>
              <Input
                value={blockMotivo}
                onChange={(e) => setBlockMotivo(e.target.value)}
                placeholder="Ex: Manutenção, Ensaio Mambaia, Fechado..."
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={() => criarBloqueio.mutate()}
              disabled={criarBloqueio.isPending}
            >
              {criarBloqueio.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Bloquear Horário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReservaCard({ r, onChange }: { r: Reserva; onChange: () => void }) {
  const isBloqueio = r.cliente_nome.startsWith("BLOQUEIO") || r.cliente_whatsapp === "00000000000";
  const motivoBloqueio = isBloqueio ? r.cliente_nome.replace(/^BLOQUEIO:\s*/, "") : "";

  const [payOpen, setPayOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [tipoPag, setTipoPag] = useState<"integral" | "parcial">("parcial");
  const [valorPag, setValorPag] = useState<string>(String(r.valor_sinal.toFixed(2)));
  const [editOpen, setEditOpen] = useState(false);
  const [edData, setEdData] = useState(r.data);
  const [edHora, setEdHora] = useState(r.hora_inicio.slice(0, 5));
  const [edDur, setEdDur] = useState<number>(r.duracao_minutos);
  const [edNome, setEdNome] = useState(r.cliente_nome);
  const [edWa, setEdWa] = useState(formatPhoneBR(r.cliente_whatsapp));
  const [edEmp, setEdEmp] = useState(r.empreendimento ?? "");
  const [edTotal, setEdTotal] = useState(String(r.valor_total.toFixed(2)));
  const [edSinal, setEdSinal] = useState(String(r.valor_sinal.toFixed(2)));

  const dataFmt = new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const waMsg =
    `Oi ${r.cliente_nome.split(" ")[0]}! Aqui é da Mambaia 💚\n` +
    `Confirmando sua reserva para ${dataFmt} às ${r.hora_inicio.slice(0, 5)} ` +
    `(${Math.floor(r.duracao_minutos / 60)}h${r.duracao_minutos % 60 ? r.duracao_minutos % 60 : ""}).\n` +
    (r.cobrancas?.slug
      ? `Se ainda não pagou o sinal: ${typeof window !== "undefined" ? window.location.origin : ""}/cobranca/${r.cobrancas.slug}\n`
      : "") +
    `Qualquer coisa é só chamar por aqui!`;
  const waHref = buildWhatsAppUrl(r.cliente_whatsapp, waMsg);

  const setStatus = useMutation({
    mutationFn: async (status: Reserva["status"]) => {
      const { error } = await sb.from("reservas").update({ status }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reserva atualizada");
      onChange();
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  const marcarPago = useMutation({
    mutationFn: async () => {
      const v = parseFloat((valorPag || "").replace(",", "."));
      if (!Number.isFinite(v) || v <= 0) throw new Error("Informe o valor recebido");
      const isIntegral = tipoPag === "integral";
      const patch: Record<string, unknown> = {
        status: isIntegral ? "paga" : "confirmada",
        paid_at: new Date().toISOString(),
        valor_pago: v,
        tipo_pagamento: tipoPag,
      };
      const { error } = await sb.from("reservas").update(patch).eq("id", r.id);
      if (error) throw error;
      if (r.cobranca_id) {
        await sb.from("cobrancas").update({ status: "pago", paid_at: new Date().toISOString() }).eq("id", r.cobranca_id);
      }
    },
    onSuccess: () => {
      toast.success("Pagamento registrado");
      setPayOpen(false);
      onChange();
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await sb.from("reservas").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(isBloqueio ? "Bloqueio removido" : "Reserva excluída");
      onChange();
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  const salvarEdicao = useMutation({
    mutationFn: async () => {
      if (edNome.trim().length < 2) throw new Error("Informe o nome");
      const total = parseFloat(edTotal.replace(",", "."));
      const sinal = parseFloat(edSinal.replace(",", "."));
      const patch: Record<string, unknown> = {
        data: edData,
        hora_inicio: edHora + ":00",
        duracao_minutos: edDur,
        cliente_nome: edNome.trim(),
        cliente_whatsapp: isBloqueio ? "00000000000" : onlyDigits(edWa),
        valor_total: Number.isFinite(total) ? total : 0,
        valor_sinal: Number.isFinite(sinal) ? sinal : 0,
        empreendimento: edEmp.trim() || null,
      };
      const { error } = await sb.from("reservas").update(patch).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Atualizado com sucesso");
      setEditOpen(false);
      onChange();
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  if (isBloqueio) {
    return (
      <Card className="p-4 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-semibold tabular-nums">{r.hora_inicio.slice(0, 5)}</span>
              <span className="text-muted-foreground text-sm">· {formatDuracao(r.duracao_minutos)}</span>
              <Badge variant="outline" className="border-amber-500/50 text-amber-700 dark:text-amber-400 bg-amber-500/10">
                Horário Bloqueado
              </Badge>
            </div>
            <div className="text-sm mt-1 font-medium text-foreground">
              {motivoBloqueio || "Uso interno / Indisponível"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm("Desbloquear este horário na agenda?")) remove.mutate();
              }}
            >
              <Unlock className="w-3.5 h-3.5 mr-1" /> Desbloquear
            </Button>
          </div>
        </div>

        {/* Modal Edição de Bloqueio */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Editar Bloqueio de Horário</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <Label>Data</Label>
                <Input type="date" value={edData} onChange={(e) => setEdData(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hora de início</Label>
                  <Input type="time" value={edHora} onChange={(e) => setEdHora(e.target.value)} />
                </div>
                <div>
                  <Label>Duração (min)</Label>
                  <Input type="number" step={30} min={30} value={edDur} onChange={(e) => setEdDur(parseInt(e.target.value || "0", 10))} />
                </div>
              </div>
              <div>
                <Label>Motivo / Identificador</Label>
                <Input value={edNome} onChange={(e) => setEdNome(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancelar</Button>
              <Button onClick={() => salvarEdicao.mutate()} disabled={salvarEdicao.isPending}>
                {salvarEdicao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold tabular-nums">{r.hora_inicio.slice(0, 5)}</span>
            <span className="text-muted-foreground text-sm">· {formatDuracao(r.duracao_minutos)}</span>
            {r.tipo === "pacote_marcas" && (
              <Badge className="bg-brand-lime text-brand-dark border-transparent">Pacote Marcas</Badge>
            )}
            {r.status === "paga" && <Badge className="bg-success text-success-foreground">Paga integral</Badge>}
            {r.status === "confirmada" && <Badge className="bg-primary text-primary-foreground">Sinal pago</Badge>}
            {r.status === "pendente" && <Badge variant="outline">Aguardando sinal</Badge>}
            {r.status === "cancelada" && <Badge variant="secondary">Cancelada</Badge>}
          </div>
          <div className="text-sm mt-1">
            <span className="font-medium">{r.cliente_nome}</span>
            <span className="text-muted-foreground"> · {formatPhoneBR(r.cliente_whatsapp)}</span>
            {r.empreendimento && <span className="text-muted-foreground"> · {r.empreendimento}</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Proposta nº {String(r.numero_proposta).padStart(4, "0")} · Total {formatBRL(r.valor_total)} · sinal {formatBRL(r.valor_sinal)}
            {r.valor_pago != null && (
              <>
                {" "}
                · <span className="text-foreground font-medium">recebido {formatBRL(r.valor_pago)} ({r.tipo_pagamento})</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {r.cobrancas?.slug && (
            <Link to="/cobranca/$slug" params={{ slug: r.cobrancas.slug }} target="_blank">
              <Button size="sm" variant="ghost">
                <ExternalLink className="w-3 h-3" /> Cobrança
              </Button>
            </Link>
          )}
          <a href={waHref} target="_blank" rel="noreferrer">
            <Button size="sm" variant="ghost">
              <MessageCircle className="w-3 h-3" /> WhatsApp
            </Button>
          </a>
          <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
            <Pencil className="w-3 h-3" /> Editar
          </Button>
          {r.status !== "paga" && (
            <Button size="sm" variant="ghost" onClick={() => setPayOpen(true)}>
              <CheckCircle2 className="w-3 h-3" /> Marcar pago
            </Button>
          )}
          {r.paid_at && (
            <Button size="sm" variant="ghost" onClick={() => setPdfOpen(true)}>
              <FileDown className="w-3 h-3" /> Ordem de serviço
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm("Excluir esta reserva?")) remove.mutate();
            }}
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </Button>
        </div>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-sm text-muted-foreground">
              Reserva de <strong>{r.cliente_nome}</strong> - {dataFmt} às {r.hora_inicio.slice(0, 5)}. Total {formatBRL(r.valor_total)}.
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setTipoPag("parcial");
                  setValorPag(String(r.valor_sinal.toFixed(2)));
                }}
                className={`rounded-lg border p-3 text-left transition ${tipoPag === "parcial" ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
              >
                <div className="text-sm font-semibold">Parcial (sinal)</div>
                <div className="text-xs text-muted-foreground">Sugerido: {formatBRL(r.valor_sinal)}</div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTipoPag("integral");
                  setValorPag(String(r.valor_total.toFixed(2)));
                }}
                className={`rounded-lg border p-3 text-left transition ${tipoPag === "integral" ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
              >
                <div className="text-sm font-semibold">Integral</div>
                <div className="text-xs text-muted-foreground">Valor cheio: {formatBRL(r.valor_total)}</div>
              </button>
            </div>
            <div>
              <Label>Valor recebido (R$)</Label>
              <Input value={valorPag} onChange={(e) => setValorPag(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => marcarPago.mutate()} disabled={marcarPago.isPending}>
              {marcarPago.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar reserva</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={edData} onChange={(e) => setEdData(e.target.value)} />
            </div>
            <div>
              <Label>Hora de início</Label>
              <Input type="time" value={edHora} onChange={(e) => setEdHora(e.target.value)} />
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input type="number" min={30} step={30} value={edDur} onChange={(e) => setEdDur(parseInt(e.target.value || "0", 10))} />
            </div>
            <div>
              <Label>Empreendimento</Label>
              <Input value={edEmp} onChange={(e) => setEdEmp(e.target.value)} placeholder="opcional" />
            </div>
            <div className="col-span-2">
              <Label>Cliente</Label>
              <Input value={edNome} onChange={(e) => setEdNome(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>WhatsApp</Label>
              <Input value={edWa} onChange={(e) => setEdWa(maskPhoneInput(e.target.value))} placeholder="(31) 9 9999-9999" inputMode="tel" />
            </div>
            <div>
              <Label>Valor total (R$)</Label>
              <Input value={edTotal} onChange={(e) => setEdTotal(e.target.value)} inputMode="decimal" />
            </div>
            <div>
              <Label>Sinal (R$)</Label>
              <Input value={edSinal} onChange={(e) => setEdSinal(e.target.value)} inputMode="decimal" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvarEdicao.mutate()} disabled={salvarEdicao.isPending}>
              {salvarEdicao.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Salvar alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        reserva={
          r.paid_at
            ? ({
                cliente: r.cliente_nome,
                whatsapp: r.cliente_whatsapp,
                data: r.data,
                horaInicio: r.hora_inicio.slice(0, 5),
                duracaoMinutos: r.duracao_minutos,
                valorTotal: r.valor_total,
                valorPago: r.valor_pago ?? r.valor_sinal,
                tipoPagamento: (r.tipo_pagamento ?? "parcial") as "integral" | "parcial",
                paidAt: r.paid_at,
                slug: r.cobrancas?.slug ?? r.id,
                numeroProposta: r.numero_proposta ?? 0,
                tipo: (r.tipo ?? "locacao") as "locacao" | "pacote_marcas",
                empreendimento: r.empreendimento,
              } as ReservaPDFInput)
            : null
        }
      />
    </Card>
  );
}
