import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, CalendarDays, Clock, MessageCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBRL } from "@/lib/money";
import { friendlyErrorMessage } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { maskPhoneInput, isValidPhoneBR, onlyDigits } from "@/lib/phone";
import { waMambaia } from "@/lib/whatsapp";
import logo from "@/assets/logo-mambaia.svg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const WHATSAPP_GERAL = waMambaia(
  "Oi Mambaia! Estava vendo a agenda do estúdio no site e queria tirar uma dúvida antes de reservar."
);
const OPEN_HOUR = 9;   // 09:00
const CLOSE_HOUR = 22; // 22:00 (última hora final)

// Tabela oficial (30..240 min)
const PRECOS: Record<number, number> = {
  30: 50, 60: 100, 90: 150, 120: 180, 150: 230, 180: 250, 210: 280, 240: 300,
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
      { title: "Agendar estúdio Mambaia - Praça Sete, BH" },
      { name: "description", content: "Reserve o estúdio Mambaia na Praça Sete, Belo Horizonte. Escolha o dia, o horário e garanta com 50% de sinal via PIX. A partir de R$ 100/h." },
      { name: "keywords", content: "aluguel estúdio BH, estúdio Praça Sete, estúdio criativo Belo Horizonte, Mambaia, aluguel por hora, coworking criativo" },
      { property: "og:title", content: "Agendar estúdio Mambaia - Praça Sete, BH" },
      { property: "og:description", content: "Reserve seu horário no estúdio Mambaia. Praça Sete · Belo Horizonte. A partir de R$ 100/h com sinal via PIX." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:url", content: "https://mambaiabh.com.br/agendar" },
      { property: "og:image", content: "https://mambaiabh.com.br/__l5e/assets-v1/bfe6eb16-e7c8-4f7d-be7b-b584a011b868/mambaia-estudio-4.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "800" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Agendar estúdio Mambaia - Praça Sete, BH" },
      { name: "twitter:description", content: "Reserve seu horário no estúdio Mambaia. Sinal 50% via PIX." },
      { name: "twitter:image", content: "https://mambaiabh.com.br/__l5e/assets-v1/bfe6eb16-e7c8-4f7d-be7b-b584a011b868/mambaia-estudio-4.jpg" },
    ],
    links: [
      { rel: "canonical", href: "https://mambaiabh.com.br/agendar" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          serviceType: "Aluguel de estúdio fotográfico por hora",
          provider: {
            "@type": "LocalBusiness",
            name: "Mambaia Estúdio",
            address: { "@type": "PostalAddress", streetAddress: "R. Rio de Janeiro, 462 - Sala 2217", addressLocality: "Belo Horizonte", addressRegion: "MG", addressCountry: "BR" },
            telephone: "+55 31 3223-2356",
          },
          areaServed: { "@type": "City", name: "Belo Horizonte" },
          offers: [
            { "@type": "Offer", name: "1h", price: "100.00", priceCurrency: "BRL" },
            { "@type": "Offer", name: "2h", price: "180.00", priceCurrency: "BRL" },
            { "@type": "Offer", name: "3h", price: "250.00", priceCurrency: "BRL" },
            { "@type": "Offer", name: "4h", price: "300.00", priceCurrency: "BRL" },
          ],
          url: "https://mambaiabh.com.br/agendar",
        }),
      },
    ],
  }),
  component: AgendarPage,
});

function AgendarPage() {
  const navigate = useNavigate();
  const hoje = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(hoje);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [hoje]);

  const [dataSel, setDataSel] = useState<Date>(hoje);
  const [duracao, setDuracao] = useState<number>(60);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [aceito, setAceito] = useState(false);

  // pré-preenche nome/whatsapp quando vier do formulário da landing (?nome=&whatsapp=)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const n = p.get("nome");
    const w = p.get("whatsapp");
    if (n) setNome((prev) => prev || n);
    if (w) setWhatsapp((prev) => prev || maskPhoneInput(w));
  }, []);

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
      if (!isValidPhoneBR(whatsapp)) throw new Error("Informe um WhatsApp válido, com DDD");
      if (!aceito) throw new Error("Leia e aceite o termo de reserva para continuar");
      const { data, error } = await sb.rpc("criar_reserva", {
        _data: dataStr,
        _hora_inicio: horaInicio + ":00",
        _duracao_minutos: duracao,
        _cliente_nome: nome.trim(),
        _cliente_whatsapp: onlyDigits(whatsapp),
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
        <a href={WHATSAPP_GERAL} target="_blank" rel="noreferrer" className="text-xs md:text-sm inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15">
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
              Escolha o dia, o horário e a duração. Confirme com <strong>50% de sinal via PIX</strong> - o restante é acertado no dia.
            </p>
          </div>
        </section>

        {/* Tabela de preços */}
        <section aria-labelledby="tabela-precos" className="rounded-2xl bg-white/[0.04] border border-white/10 p-5">
          <h2 id="tabela-precos" className="text-xs uppercase tracking-widest opacity-60 mb-3 font-medium">
            Tabela de preços
          </h2>
          <dl className="divide-y divide-white/10 select-none">
            {[
              { h: "1h", v: "R$ 100" },
              { h: "2h", v: "R$ 180" },
              { h: "3h", v: "R$ 250" },
              { h: "4h", v: "R$ 300" },
            ].map((row) => (
              <div key={row.h} className="flex items-baseline justify-between py-2.5">
                <dt className="text-sm opacity-80">{row.h}</dt>
                <dd className="text-sm font-semibold tabular-nums">{row.v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs opacity-70 leading-relaxed">
            Fração adicional de 30 min: <strong>R$ 50</strong>. Preços sujeitos a mudança (estamos em reforma).
            {" "}Precisa de mais de 4h?{" "}
            <a href={WHATSAPP_GERAL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Fale no WhatsApp
            </a>.
          </p>
        </section>

        {/* Data */}
        <section className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 opacity-70" />
            <div className="text-xs uppercase tracking-widest opacity-60">Escolha a data</div>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button
                className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-3 text-left transition"
              >
                <div>
                  <div className="text-[11px] uppercase tracking-widest opacity-60">Data selecionada</div>
                  <div className="text-base font-semibold mt-0.5 capitalize">
                    {dataSel.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                  </div>
                </div>
                <CalendarDays className="w-5 h-5 opacity-70" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-0 pointer-events-auto">
              <Calendar
                mode="single"
                selected={dataSel}
                onSelect={(d) => {
                  if (d) {
                    handleDataChange(d);
                    setCalendarOpen(false);
                  }
                }}
                disabled={{ before: hoje, after: maxDate }}
                defaultMonth={dataSel}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
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
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(maskPhoneInput(e.target.value))}
                placeholder="+55 (31) 9 9999-9999"
                inputMode="tel"
                autoComplete="tel"
              />
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
          É marca ou brechó?{" "}
          <a href="/pacote-marcas" className="underline font-medium">Conheça o Pacote Marcas</a>
          {" "}· Precisa de horário fora da tabela?{" "}
          <a href={WHATSAPP_GERAL} target="_blank" rel="noreferrer" className="underline">Fale no WhatsApp</a>.
        </footer>
      </main>
    </div>
  );
}
