import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Loader2, CalendarDays, Clock, MessageCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBRL } from "@/lib/money";
import { friendlyErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo-mambaia.svg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const WHATSAPP_URL = "https://wa.me/5531998021169";
const OPEN_HOUR = 9;   // 09:00
const CLOSE_HOUR = 22; // 22:00 (última hora final)

// Tabela oficial (30..240 min)
const PRECOS: Record<number, number> = {
  30: 50, 60: 100, 90: 150, 120: 180, 150: 230, 180: 250, 210: 300, 240: 300,
};
const DURACOES = [30, 60, 90, 120, 150, 180, 210, 240];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function formatDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${m}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

export const Route = createFileRoute("/agendar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Agendar estúdio — Mambaia" },
      { name: "description", content: "Reserve o estúdio Mambaia na Praça Sete. Escolha o dia, o horário e garanta com 50% de sinal via PIX." },
      { property: "og:title", content: "Agendar estúdio — Mambaia" },
      { property: "og:description", content: "Reserve seu horário no estúdio Mambaia. Praça Sete · Belo Horizonte." },
    ],
  }),
  component: AgendarPage,
});

function AgendarPage() {
  const navigate = useNavigate();
  const hoje = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const dias = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [hoje]);

  const [dataSel, setDataSel] = useState<Date>(hoje);
  const [duracao, setDuracao] = useState<number>(60);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");

  const dataStr = ymd(dataSel);

  const ocupados = useQuery({
    queryKey: ["ocupados", dataStr],
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_horarios_ocupados", { _data: dataStr });
      if (error) throw error;
      return (data ?? []) as { hora_inicio: string; duracao_minutos: number }[];
    },
  });

  // slots de 30 min entre OPEN e CLOSE - duracao
  const slots = useMemo(() => {
    const out: string[] = [];
    for (let m = OPEN_HOUR * 60; m + duracao <= CLOSE_HOUR * 60; m += 30) {
      out.push(minToTime(m));
    }
    return out;
  }, [duracao]);

  // um slot é indisponível se o intervalo [inicio, inicio+duracao) sobrepõe
  // qualquer reserva existente. Também bloqueia horários no passado hoje.
  const agora = new Date();
  const isPast = (hhmm: string) => {
    if (dataSel.getTime() !== hoje.getTime()) return false;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m <= agora.getHours() * 60 + agora.getMinutes();
  };
  const conflito = (hhmm: string) => {
    const ini = timeToMin(hhmm);
    const fim = ini + duracao;
    return (ocupados.data ?? []).some((r) => {
      const rIni = timeToMin(r.hora_inicio.slice(0, 5));
      const rFim = rIni + r.duracao_minutos;
      return ini < rFim && rIni < fim;
    });
  };

  // se muda duração / data, reset hora
  const handleDataChange = (d: Date) => { setDataSel(d); setHoraInicio(null); };
  const handleDuracaoChange = (d: number) => { setDuracao(d); setHoraInicio(null); };

  const preco = PRECOS[duracao] ?? 0;
  const sinal = Math.round(preco * 0.5 * 100) / 100;

  const criar = useMutation({
    mutationFn: async () => {
      if (!horaInicio) throw new Error("Escolha um horário");
      if (nome.trim().length < 2) throw new Error("Informe seu nome");
      if (whatsapp.replace(/\D/g, "").length < 10) throw new Error("Informe um WhatsApp válido");
      const { data, error } = await sb.rpc("criar_reserva", {
        _data: dataStr,
        _hora_inicio: horaInicio + ":00",
        _duracao_minutos: duracao,
        _cliente_nome: nome.trim(),
        _cliente_whatsapp: whatsapp.trim(),
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { reserva_id: string; cobranca_slug: string; valor_total: number; valor_sinal: number };
    },
    onSuccess: (row) => {
      toast.success("Reserva criada! Pague o sinal para confirmar.");
      navigate({ to: "/cobranca/$slug", params: { slug: row.cobranca_slug } });
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--brand-dark)] via-[var(--brand-dark)] to-[#0f2118] text-[var(--brand-cream)]">
      <header className="max-w-3xl mx-auto px-5 md:px-10 pt-6 md:pt-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Mambaia" className="w-10 h-10 rounded-lg" />
          <div>
            <div className="font-semibold tracking-tight">Mambaia</div>
            <div className="text-[11px] opacity-60">Estúdio · Praça Sete · BH</div>
          </div>
        </div>
        <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="text-xs md:text-sm inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15">
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-10 py-6 md:py-10 space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--brand-green)] to-[var(--brand-lime)] text-[var(--brand-dark)] p-7 md:p-10 shadow-2xl">
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/20 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="text-xs uppercase tracking-widest font-semibold opacity-70">Agende seu horário</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2 leading-tight">Reserve o estúdio Mambaia</h1>
            <p className="mt-3 text-sm md:text-base opacity-90 max-w-prose">
              Escolha o dia, o horário e a duração. Confirme com <strong>50% de sinal via PIX</strong> — o restante é acertado no dia.
            </p>
          </div>
        </section>

        {/* Tabela de preços */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="text-xs uppercase tracking-widest opacity-60 mb-3">Tabela de preços</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <PrecoPill h="1h" v="R$ 100" />
            <PrecoPill h="2h" v="R$ 180" />
            <PrecoPill h="3h" v="R$ 250" />
            <PrecoPill h="4h" v="R$ 300" />
          </div>
          <div className="mt-3 text-xs opacity-70">
            Fração de 30 min: R$ 50. Preços sujeitos a mudança (estamos em reforma).
            Precisa de mais de 4h? <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="underline">Fale no WhatsApp</a>.
          </div>
        </section>

        {/* Data */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 opacity-70" />
            <div className="text-xs uppercase tracking-widest opacity-60">Escolha a data</div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
            {dias.map((d) => {
              const active = ymd(d) === dataStr;
              return (
                <button
                  key={ymd(d)}
                  onClick={() => handleDataChange(d)}
                  className={cn(
                    "min-w-[68px] shrink-0 rounded-2xl px-3 py-3 text-center transition border",
                    active
                      ? "bg-[var(--brand-lime)] text-[var(--brand-dark)] border-transparent shadow-lg"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <div className="text-[10px] uppercase font-semibold opacity-70">
                    {d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                  </div>
                  <div className="text-xl font-bold tabular-nums leading-none mt-0.5">
                    {d.getDate()}
                  </div>
                  <div className="text-[10px] uppercase opacity-70 mt-0.5">
                    {d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Duração */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 opacity-70" />
            <div className="text-xs uppercase tracking-widest opacity-60">Duração</div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {DURACOES.map((d) => {
              const active = duracao === d;
              return (
                <button
                  key={d}
                  onClick={() => handleDuracaoChange(d)}
                  className={cn(
                    "rounded-xl px-2 py-2.5 text-sm font-semibold border transition",
                    active
                      ? "bg-[var(--brand-lime)] text-[var(--brand-dark)] border-transparent"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  )}
                >
                  <div>{formatDuracao(d)}</div>
                  <div className={cn("text-[10px] font-normal mt-0.5", active ? "opacity-80" : "opacity-60")}>
                    {formatBRL(PRECOS[d] ?? 0)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Horários */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-widest opacity-60">Horário de início</div>
            {ocupados.isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin opacity-60" />}
          </div>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
            {slots.map((s) => {
              const past = isPast(s);
              const busy = conflito(s);
              const disabled = past || busy;
              const active = horaInicio === s;
              return (
                <button
                  key={s}
                  disabled={disabled}
                  onClick={() => setHoraInicio(s)}
                  className={cn(
                    "rounded-lg px-2 py-2 text-sm font-medium border tabular-nums transition",
                    active && "bg-[var(--brand-lime)] text-[var(--brand-dark)] border-transparent",
                    !active && !disabled && "bg-white/5 border-white/10 hover:bg-white/10",
                    disabled && "bg-white/5 border-white/5 opacity-30 line-through cursor-not-allowed"
                  )}
                  title={busy ? "Já reservado" : past ? "Horário passou" : ""}
                >
                  {s}
                </button>
              );
            })}
          </div>
          {slots.length === 0 && (
            <p className="text-sm opacity-70">Não há horários disponíveis para essa duração neste dia.</p>
          )}
        </section>

        {/* Dados + resumo */}
        <section className="rounded-2xl bg-[var(--brand-cream)] text-[var(--brand-dark)] p-5 md:p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>Seu nome *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>WhatsApp *</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(31) 99999-9999" inputMode="tel" />
            </div>
          </div>

          <div className="rounded-xl bg-[var(--brand-dark)]/5 p-4">
            <div className="text-[11px] uppercase tracking-widest opacity-60">Resumo</div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-sm">
                {dataSel.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                {horaInicio && (
                  <> · <strong>{horaInicio}</strong> · {formatDuracao(duracao)}</>
                )}
              </div>
              <div className="text-right">
                <div className="text-[11px] opacity-60">Total</div>
                <div className="text-lg font-bold tabular-nums">{formatBRL(preco)}</div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="opacity-70">Sinal para confirmar (50%)</span>
              <span className="font-semibold tabular-nums">{formatBRL(sinal)}</span>
            </div>
          </div>

          <Button
            onClick={() => criar.mutate()}
            disabled={criar.isPending || !horaInicio}
            className="w-full h-12 text-base bg-[var(--brand-dark)] text-[var(--brand-cream)] hover:bg-[var(--brand-dark)]/90"
          >
            {criar.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <>
              Reservar e pagar sinal <ArrowRight className="w-4 h-4" />
            </>}
          </Button>
          <div className="flex items-center gap-1.5 text-xs opacity-70 justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pagamento via PIX na próxima tela.
          </div>
        </section>

        <footer className="text-center text-xs opacity-60 pt-2 pb-4">
          Precisa de horário fora da tabela? <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" className="underline">Fale conosco</a>.
        </footer>
      </main>
    </div>
  );
}

function PrecoPill({ h, v }: { h: string; v: string }) {
  return (
    <div className="rounded-xl bg-white/10 border border-white/10 px-3 py-2 flex items-center justify-between">
      <span className="font-semibold">{h}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}