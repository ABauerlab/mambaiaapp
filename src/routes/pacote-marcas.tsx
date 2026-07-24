import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Loader2,
  CalendarDays,
  Camera,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatBRL } from "@/lib/money";
import { friendlyErrorMessage, cn } from "@/lib/utils";
import { toast } from "sonner";
import { maskPhoneInput, isValidPhoneBR, onlyDigits } from "@/lib/phone";
import { waMambaia } from "@/lib/whatsapp";
import logo from "@/assets/logo-mambaia.svg";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

const WHATSAPP_GERAL = waMambaia(
  "Oi Mambaia! Tenho interesse no Pacote Marcas para o meu empreendimento e queria tirar uma dúvida.",
);
const OPEN_HOUR = 9;
const CLOSE_HOUR = 22;
const DURACAO = 60;
const PRECO_UNIT = 350;

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

export const Route = createFileRoute("/pacote-marcas")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Pacote Marcas Mambaia - fotos de catálogo em BH" },
      {
        name: "description",
        content:
          "Pacote fotográfico para marcas e brechós: 1h no estúdio Mambaia com fotografia, edição e making-of por R$ 350. Praça Sete, Belo Horizonte.",
      },
      {
        name: "keywords",
        content:
          "fotos de catálogo BH, ensaio para marca, brechó, fotografia de produto, estúdio Belo Horizonte, Mambaia",
      },
      { property: "og:title", content: "Pacote Marcas Mambaia - fotos de catálogo em BH" },
      {
        property: "og:description",
        content:
          "1h no estúdio com fotografia, edição e making-of por R$ 350. Ideal para marcas e brechós na Praça Sete.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { property: "og:url", content: "https://mambaiabh.com.br/pacote-marcas" },
      {
        property: "og:image",
        content:
          "https://mambaiabh.com.br/__l5e/assets-v1/bfe6eb16-e7c8-4f7d-be7b-b584a011b868/mambaia-estudio-4.jpg",
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "800" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Pacote Marcas Mambaia" },
      {
        name: "twitter:description",
        content: "1h de estúdio, fotografia, edição e making-of por R$ 350 por marca.",
      },
      {
        name: "twitter:image",
        content:
          "https://mambaiabh.com.br/__l5e/assets-v1/bfe6eb16-e7c8-4f7d-be7b-b584a011b868/mambaia-estudio-4.jpg",
      },
    ],
    links: [{ rel: "canonical", href: "https://mambaiabh.com.br/pacote-marcas" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Pacote Marcas Mambaia",
          description:
            "Sessão fotográfica de 1h para marcas e brechós no estúdio Mambaia, com fotografia, edição e making-of.",
          brand: { "@type": "Brand", name: "Mambaia" },
          image:
            "https://mambaiabh.com.br/__l5e/assets-v1/bfe6eb16-e7c8-4f7d-be7b-b584a011b868/mambaia-estudio-4.jpg",
          offers: {
            "@type": "Offer",
            price: "350.00",
            priceCurrency: "BRL",
            availability: "https://schema.org/InStock",
            url: "https://mambaiabh.com.br/pacote-marcas",
          },
        }),
      },
    ],
  }),
  component: PacoteMarcasPage,
});

function PacoteMarcasPage() {
  const navigate = useNavigate();
  const hoje = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const maxDate = useMemo(() => {
    const d = new Date(hoje);
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }, [hoje]);

  const [dataSel, setDataSel] = useState<Date>(hoje);
  const [horaInicio, setHoraInicio] = useState<string | null>(null);
  const [nome, setNome] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [empreendimento, setEmpreendimento] = useState("");
  const [qtdMarcas, setQtdMarcas] = useState<number>(1);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [aceito, setAceito] = useState(false);

  const dataStr = ymd(dataSel);
  const qtd = Math.max(1, Math.min(10, qtdMarcas || 1));
  const precoTotal = PRECO_UNIT * qtd;
  const sinalTotal = precoTotal / 2;

  const ocupados = useQuery({
    queryKey: ["ocupados", dataStr],
    queryFn: async () => {
      const { data, error } = await sb.rpc("get_horarios_ocupados", { _data: dataStr });
      if (error) throw error;
      return (data ?? []) as { hora_inicio: string; duracao_minutos: number }[];
    },
  });

  const slots = useMemo(() => {
    const out: string[] = [];
    for (let m = OPEN_HOUR * 60; m + DURACAO <= CLOSE_HOUR * 60; m += 30) out.push(minToTime(m));
    return out;
  }, []);

  const agora = new Date();
  const isPast = (hhmm: string) => {
    if (dataSel.getTime() !== hoje.getTime()) return false;
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m <= agora.getHours() * 60 + agora.getMinutes();
  };
  const conflito = (hhmm: string) => {
    const ini = timeToMin(hhmm);
    const fim = ini + DURACAO;
    return (ocupados.data ?? []).some((r) => {
      const rIni = timeToMin(r.hora_inicio.slice(0, 5));
      const rFim = rIni + r.duracao_minutos;
      return ini < rFim && rIni < fim;
    });
  };

  const criar = useMutation({
    mutationFn: async () => {
      if (!horaInicio) throw new Error("Escolha um horário");
      if (nome.trim().length < 2) throw new Error("Informe seu nome");
      if (empreendimento.trim().length < 2) throw new Error("Informe o nome da marca ou brechó");
      if (!isValidPhoneBR(whatsapp)) throw new Error("Informe um WhatsApp válido, com DDD");
      if (!aceito) throw new Error("Leia e aceite o termo de reserva para continuar");
      const { data, error } = await sb.rpc("criar_reserva_pacote", {
        _data: dataStr,
        _hora_inicio: horaInicio + ":00",
        _cliente_nome: nome.trim(),
        _cliente_whatsapp: onlyDigits(whatsapp),
        _empreendimento: empreendimento.trim(),
        _qtd_marcas: qtd,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { reserva_id: string; cobranca_slug: string };
    },
    onSuccess: (row) => {
      toast.success("Pacote reservado! Pague o sinal para confirmar.");
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
            <div className="text-[11px] opacity-60">Pacote Marcas · Praça Sete · BH</div>
          </div>
        </div>
        <a
          href={WHATSAPP_GERAL}
          target="_blank"
          rel="noreferrer"
          className="text-xs md:text-sm inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15"
        >
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </a>
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-10 py-6 md:py-10 space-y-6">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--brand-green)] to-[var(--brand-lime)] text-[var(--brand-dark)] p-7 md:p-10 shadow-2xl">
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/20 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold opacity-70">
              <Sparkles className="w-3.5 h-3.5" /> Pacote Marcas e Brechós
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-2 leading-tight">
              Fotos de catálogo em 1h no Mambaia
            </h1>
            <p className="mt-3 text-sm md:text-base opacity-90 max-w-prose">
              Traga as peças, a gente faz o resto. Um pacote fechado com{" "}
              <strong>fotografia, edição e making-of</strong> por{" "}
              <strong>R$ 350 e 1h de estúdio por marca</strong>. Trouxe 2 marcas? São 2h e R$ 700, e
              assim por diante.
            </p>
          </div>
        </section>

        <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 space-y-3">
          <h2 className="text-xs uppercase tracking-widest opacity-60 font-medium">
            O que está incluso
          </h2>
          <p className="text-sm opacity-90">
            <strong>Você só precisa trazer as peças.</strong> A gente cuida de toda a estrutura:
            câmera profissional, tripés, iluminação e o olhar da equipe. O valor de{" "}
            <strong>R$ 350 vale para 1 marca com 1h de estúdio</strong>. Se você trouxer mais de um
            empreendimento, cada marca extra soma <strong>+ R$ 350 e + 1h</strong> na sessão - assim
            garantimos tempo e cuidado individual para cada uma.
          </p>
          <ul className="text-sm space-y-1.5 opacity-90 pt-1">
            <li className="flex gap-2">
              <Camera className="w-4 h-4 mt-0.5 shrink-0 text-[var(--brand-lime)]" /> Fotografia de
              produto (3 a 5 ângulos por peça - frente, costas e laterais).
            </li>
            <li className="flex gap-2">
              <Camera className="w-4 h-4 mt-0.5 shrink-0 text-[var(--brand-lime)]" /> Edição das
              imagens prontas para site e Instagram.
            </li>
            <li className="flex gap-2">
              <Camera className="w-4 h-4 mt-0.5 shrink-0 text-[var(--brand-lime)]" /> Making-of do
              dia para você usar como conteúdo.
            </li>
            <li className="flex gap-2">
              <Package className="w-4 h-4 mt-0.5 shrink-0 text-[var(--brand-lime)]" /> Cada marca
              ganha <strong>1h dedicada + R$ 350</strong>. Ex.: 3 marcas = 3h e R$ 1.050.
            </li>
            <li className="flex gap-2">
              <Camera className="w-4 h-4 mt-0.5 shrink-0 text-[var(--brand-lime)]" /> Estúdio em L
              com iluminação, Wi-Fi, banheiro e água à vontade.
            </li>
          </ul>
          <p className="text-xs opacity-70">
            Precisa de produção completa com busca de modelos?{" "}
            <a
              href={WHATSAPP_GERAL}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Fale no WhatsApp
            </a>
            .
          </p>
        </section>

        <section className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 opacity-70" />
            <div className="text-xs uppercase tracking-widest opacity-60">Escolha a data</div>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <button className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-3 text-left transition">
                <div>
                  <div className="text-[11px] uppercase tracking-widest opacity-60">
                    Data selecionada
                  </div>
                  <div className="text-base font-semibold mt-0.5 capitalize">
                    {dataSel.toLocaleDateString("pt-BR", {
                      weekday: "long",
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
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
                    setDataSel(d);
                    setHoraInicio(null);
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

        <section className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-widest opacity-60">
              Horário de início (duração fixa de 1h)
            </div>
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
                    disabled &&
                      "bg-white/5 border-white/5 opacity-30 line-through cursor-not-allowed",
                  )}
                  title={busy ? "Já reservado" : past ? "Horário passou" : ""}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl bg-[var(--brand-cream)] text-[var(--brand-dark)] p-5 md:p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Marca(s) ou brechó(s) *</Label>
              <Input
                value={empreendimento}
                onChange={(e) => setEmpreendimento(e.target.value)}
                placeholder="Ex.: Brechó da Lua · Ateliê Sol"
              />
              <p className="text-[11px] opacity-70 mt-1">
                Se for mais de uma marca, separe por vírgula.
              </p>
            </div>
            <div>
              <Label>Quantas marcas você vai trazer? *</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={qtdMarcas}
                onChange={(e) =>
                  setQtdMarcas(Math.max(1, Math.min(10, parseInt(e.target.value || "1", 10))))
                }
              />
              <p className="text-[11px] opacity-70 mt-1">
                R$ 350 e 1h de estúdio para <strong>cada</strong> marca. O valor total e a duração
                são multiplicados pela quantidade.
              </p>
            </div>
            <div>
              <Label>Seu nome *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div className="md:col-span-2">
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
                {dataSel.toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                })}
                {horaInicio && (
                  <>
                    {" "}
                    · <strong>{horaInicio}</strong> · 1h
                  </>
                )}
                {qtd > 1 && (
                  <>
                    {" "}
                    · <strong>{qtd} marcas</strong>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="text-[11px] opacity-60">
                  Total {qtd > 1 ? `(${qtd} × R$ 350)` : ""}
                </div>
                <div className="text-lg font-bold tabular-nums">{formatBRL(precoTotal)}</div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="opacity-70">Sinal para confirmar (50%)</span>
              <span className="font-semibold tabular-nums">{formatBRL(sinalTotal)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--brand-dark)]/15 bg-white p-4 text-xs leading-relaxed">
            <div className="text-[11px] uppercase tracking-widest opacity-60 mb-2 font-semibold">
              Termo de reserva
            </div>
            <ul className="space-y-2 opacity-90 list-disc pl-4">
              <li>
                O cancelamento deverá ser comunicado com, no mínimo,{" "}
                <strong>48 (quarenta e oito) horas de antecedência</strong> em relação ao horário da
                reserva. Nesses casos, o cliente poderá remarcar a locação uma única vez, em até 90
                (noventa) dias, sem custo adicional, mediante disponibilidade da agenda.
              </li>
              <li>
                Cancelamentos comunicados com menos de 48 (quarenta e oito) horas de antecedência,
                bem como o não comparecimento na data e horário agendados, implicarão a perda do
                direito à remarcação e ao reembolso, permanecendo os valores pagos com a Mambaia.
              </li>
              <li>
                Comprometo-me a deixar o estúdio nas mesmas condições em que encontrei, limpo e
                organizado.
              </li>
              <li>
                Estúdio em L: <strong>3,00 m × 2,50 m × 2,96 m</strong> (largura × profundidade ×
                altura).
              </li>
              <li>
                Não é permitido consumir bebidas ou alimentos no estúdio, nem fumar no espaço.
              </li>
            </ul>
            <label className="mt-3 flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={aceito}
                onChange={(e) => setAceito(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[var(--brand-dark)] shrink-0"
              />
              <span className="text-xs font-medium">
                Li e entendi as condições acima e aceito os termos da reserva.
              </span>
            </label>
          </div>

          <Button
            onClick={() => criar.mutate()}
            disabled={criar.isPending || !horaInicio || !aceito}
            className="w-full h-12 text-base bg-[var(--brand-dark)] text-[var(--brand-cream)] hover:bg-[var(--brand-dark)]/90"
          >
            {criar.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Reservar pacote e pagar sinal <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
          <div className="flex items-center gap-1.5 text-xs opacity-70 justify-center">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pagamento via PIX na próxima tela.
          </div>
        </section>

        <footer className="text-center text-xs opacity-60 pt-2 pb-4">
          Só precisa alugar o estúdio?{" "}
          <a href="/agendar" className="underline">
            Ir para locação simples
          </a>
          .
        </footer>
      </main>
    </div>
  );
}
