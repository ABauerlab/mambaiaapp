import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  Copy,
  Check,
  CheckCircle2,
  Loader2,
  MessageCircle,
  FileText,
  Calendar as CalendarIcon,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/utils";
import { waMambaia } from "@/lib/whatsapp";
import { formatPhoneBR } from "@/lib/phone";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import logo from "@/assets/logo-mambaia.svg";

type Cobranca = {
  id: string;
  slug: string;
  cliente_nome: string;
  titulo: string;
  descricao: string | null;
  itens: { nome: string; valor: number }[];
  total: number;
  pix_chave: string;
  pix_nome: string;
  observacoes: string | null;
  status: "pendente" | "pago" | "cancelado";
  paid_at: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

async function fetchBySlug(slug: string): Promise<Cobranca | null> {
  const { data, error } = await sb.rpc("get_cobranca_by_slug", { _slug: slug });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    ...row,
    total: typeof row.total === "string" ? parseFloat(row.total) : row.total,
    itens: Array.isArray(row.itens) ? row.itens : [],
  } as Cobranca;
}

type Reserva = {
  id: string;
  data: string;
  hora_inicio: string;
  duracao_minutos: number;
  cliente_nome: string;
  cliente_whatsapp: string;
  valor_total: number;
  valor_sinal: number;
  status: string;
  paid_at: string | null;
  valor_pago: number | null;
  tipo_pagamento: "integral" | "parcial" | null;
  tipo: "locacao" | "pacote_marcas" | null;
  empreendimento: string | null;
  numero_proposta: number;
};

async function fetchReservaBySlug(slug: string): Promise<Reserva | null> {
  const { data, error } = await sb.rpc("get_reserva_por_slug", { _slug: slug });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    ...row,
    valor_total:
      typeof row.valor_total === "string" ? parseFloat(row.valor_total) : row.valor_total,
    valor_sinal:
      typeof row.valor_sinal === "string" ? parseFloat(row.valor_sinal) : row.valor_sinal,
    valor_pago:
      row.valor_pago == null
        ? null
        : typeof row.valor_pago === "string"
          ? parseFloat(row.valor_pago)
          : row.valor_pago,
  } as Reserva;
}

export const Route = createFileRoute("/cobranca/$slug")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Proposta Mambaia · ${params.slug}` },
      {
        name: "description",
        content: `Sua proposta personalizada da Mambaia. Pagamento via PIX seguro.`,
      },
      { property: "og:title", content: "Proposta Mambaia" },
      {
        property: "og:description",
        content: "Sua proposta personalizada da Mambaia. Pagamento via PIX.",
      },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: CobrancaPage,
});

function CobrancaPage() {
  const qc = useQueryClient();
  const { slug } = Route.useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["cobranca", slug],
    queryFn: () => fetchBySlug(slug),
  });
  const { data: reserva } = useQuery({
    queryKey: ["reserva-slug", slug],
    queryFn: () => fetchReservaBySlug(slug),
    enabled: !!data,
  });
  const [copied, setCopied] = useState<"chave" | "valor" | null>(null);
  const autoPreviewRef = useRef(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const confirmar = useMutation({
    mutationFn: async () => {
      const valor = reserva?.valor_sinal ?? (data ? data.total : 0);
      if (!valor || valor <= 0) throw new Error("Valor do sinal indisponível");
      const { error } = await sb.rpc("confirmar_pagamento_cobranca", {
        _slug: slug,
        _tipo: "parcial",
        _valor: valor,
      });
      if (error) throw error;
      return { valorPago: valor, valorTotal: reserva?.valor_total ?? (data ? data.total : valor) };
    },
    onSuccess: (res) => {
      autoPreviewRef.current = true;
      toast.success(
        `Pagamento recebido: ${formatBRL(res.valorPago)} (Total da reserva: ${formatBRL(res.valorTotal)}). Status: Confirmado. Obrigado por agendar na Mambaia!`,
      );
      qc.invalidateQueries({ queryKey: ["cobranca", slug] });
      qc.invalidateQueries({ queryKey: ["reserva-slug", slug] });
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  const reservaPDF =
    reserva && reserva.paid_at
      ? {
          cliente: reserva.cliente_nome,
          whatsapp: reserva.cliente_whatsapp,
          data: reserva.data,
          horaInicio: reserva.hora_inicio.slice(0, 5),
          duracaoMinutos: reserva.duracao_minutos,
          valorTotal: reserva.valor_total,
          valorPago: reserva.valor_pago ?? reserva.valor_sinal,
          tipoPagamento: (reserva.tipo_pagamento ?? "parcial") as "integral" | "parcial",
          paidAt: reserva.paid_at,
          slug,
          numeroProposta: reserva.numero_proposta ?? 0,
          tipo: (reserva.tipo ?? "locacao") as "locacao" | "pacote_marcas",
          empreendimento: reserva.empreendimento,
        }
      : null;

  useEffect(() => {
    if (autoPreviewRef.current && reserva?.paid_at) {
      autoPreviewRef.current = false;
      setPdfOpen(true);
    }
  }, [reserva?.paid_at]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--brand-dark)] text-[var(--brand-cream)]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--brand-dark)] text-[var(--brand-cream)] p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Proposta não encontrada</h1>
          <p className="mt-2 text-sm opacity-70">O link pode ter expirado ou está incorreto.</p>
        </div>
      </div>
    );
  }

  const copy = async (text: string, which: "chave" | "valor") => {
    await navigator.clipboard.writeText(text);
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  };

  const pago = data.status === "pago";

  const whatsappHref = (() => {
    const pagoValor = reserva?.valor_pago ?? reserva?.valor_sinal ?? data.total;
    const totalValor = reserva?.valor_total ?? data.total;
    const msg =
      `Olá! Recebi a confirmação do pagamento de ${formatBRL(pagoValor)} ` +
      `referente à proposta "${data.titulo}" (Total: ${formatBRL(totalValor)}). ` +
      `Segue o comprovante em anexo.\n\nCliente: ${data.cliente_nome}\nLink: ${typeof window !== "undefined" ? window.location.href : ""}`;
    return waMambaia(msg);
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[var(--brand-dark)] via-[var(--brand-dark)] to-[#0f2118] text-[var(--brand-cream)]">
      {/* Header */}
      <header className="px-5 py-6 md:px-10 md:py-8 flex items-center justify-between max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Mambaia" className="w-10 h-10 rounded-lg" />
          <div>
            <div className="font-semibold tracking-tight">Mambaia</div>
            <div className="text-[11px] opacity-60">Espaço criativo · BH</div>
          </div>
        </div>
        {pago && (
          <div className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-[var(--brand-lime)] text-[var(--brand-dark)] font-medium">
            <CheckCircle2 className="w-4 h-4" /> Pago
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto px-5 md:px-10 pb-16 space-y-6">
        {reserva && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 flex items-start gap-3">
            <CalendarIcon className="w-5 h-5 mt-0.5 text-[var(--brand-lime)] shrink-0" />
            <div className="text-sm">
              <div className="opacity-70 text-xs uppercase tracking-widest">Sua reserva</div>
              <div className="font-semibold mt-0.5 capitalize">
                {new Date(reserva.data + "T12:00:00").toLocaleDateString("pt-BR", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div className="opacity-80">
                Início <strong>{reserva.hora_inicio.slice(0, 5)}</strong> ·{" "}
                {Math.floor(reserva.duracao_minutos / 60)}h
                {reserva.duracao_minutos % 60 ? `${reserva.duracao_minutos % 60}` : ""}
              </div>
            </div>
          </section>
        )}

        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--brand-green)] to-[var(--brand-lime)] text-[var(--brand-dark)] p-7 md:p-10 shadow-2xl">
          <div
            className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/20 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="text-xs uppercase tracking-widest font-semibold opacity-70">
              Proposta para
            </div>
            <div className="text-lg font-medium mt-1">{data.cliente_nome}</div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-3 leading-tight">
              {data.titulo}
            </h1>
            {data.descricao && (
              <p className="mt-4 text-sm md:text-base whitespace-pre-wrap opacity-90 max-w-prose">
                {data.descricao}
              </p>
            )}
          </div>
        </section>

        {/* Itens */}
        <section className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 overflow-hidden">
          <div className="px-5 py-4 border-b border-white/10 text-xs uppercase tracking-widest opacity-60">
            Itens
          </div>
          <ul className="divide-y divide-white/5">
            {data.itens.map((it, i) => (
              <li key={i} className="px-5 py-3.5 flex items-center justify-between gap-3">
                <span className="text-sm">{it.nome}</span>
                <span className="text-sm font-medium tabular-nums">{formatBRL(it.valor)}</span>
              </li>
            ))}
          </ul>
          <div className="px-5 py-4 flex items-center justify-between bg-white/5">
            <span className="text-sm uppercase tracking-wider opacity-70">Total</span>
            <span className="text-2xl font-bold text-[var(--brand-lime)] tabular-nums">
              {formatBRL(data.total)}
            </span>
          </div>
        </section>

        {/* PIX */}
        <section className="rounded-2xl bg-[var(--brand-cream)] text-[var(--brand-dark)] p-6 md:p-8 shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-xs uppercase tracking-widest font-semibold opacity-60">
                Pagamento via PIX
              </div>
              <div className="text-lg font-semibold mt-1">{data.pix_nome}</div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-60">Valor</div>
              <div className="text-xl font-bold tabular-nums">{formatBRL(data.total)}</div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--brand-dark)]/15 bg-white p-4">
            <div className="text-[11px] uppercase tracking-widest opacity-60 mb-1">
              Chave PIX (CNPJ)
            </div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <code className="text-base md:text-lg font-mono font-semibold break-all">
                {data.pix_chave}
              </code>
              <Button
                onClick={() => copy(data.pix_chave, "chave")}
                className="bg-[var(--brand-dark)] text-[var(--brand-cream)] hover:bg-[var(--brand-dark)]/90"
              >
                {copied === "chave" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied === "chave" ? "Copiado" : "Copiar chave"}
              </Button>
            </div>
          </div>

          <Button
            onClick={() => copy(String(data.total.toFixed(2)), "valor")}
            variant="outline"
            className="mt-3 w-full border-[var(--brand-dark)]/20 text-[var(--brand-dark)] hover:bg-[var(--brand-dark)]/5"
          >
            {copied === "valor" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied === "valor" ? "Valor copiado" : `Copiar valor (${formatBRL(data.total)})`}
          </Button>

          <ol className="mt-5 text-sm space-y-1.5 opacity-80">
            <li>1. Abra o app do seu banco e escolha PIX → Pagar com chave.</li>
            <li>2. Cole a chave acima (CNPJ) e digite o valor exato.</li>
            <li>3. Confirme o pagamento. Pronto!</li>
          </ol>

          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer"
            className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] hover:bg-[#1fbb59] text-white font-semibold h-12 px-4 transition shadow-lg"
          >
            <MessageCircle className="w-5 h-5" />
            Enviar comprovante no WhatsApp
          </a>
          <p className="mt-2 text-xs opacity-60 text-center">
            Após pagar, toque no botão acima para nos enviar o comprovante.
          </p>
        </section>

        {/* Confirmar pagamento / baixar PDF */}
        {!pago ? (
          <section className="rounded-2xl border-2 border-[var(--brand-lime)] bg-white/5 p-6 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-widest opacity-70 mb-1 font-semibold">
                Passo final - obrigatório
              </div>
              <h2 className="text-xl font-bold">Já pagou o sinal? Confirme aqui</h2>
              <p className="text-sm opacity-80 mt-1">
                Ao confirmar, sua reserva fica garantida e o comprovante em PDF é gerado
                automaticamente.
              </p>
            </div>

            <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-baseline justify-between">
              <span className="text-sm opacity-80">Sinal a confirmar</span>
              <span className="text-2xl font-bold tabular-nums text-[var(--brand-lime)]">
                {formatBRL(reserva?.valor_sinal ?? data.total)}
              </span>
            </div>

            <Button
              onClick={() => confirmar.mutate()}
              disabled={confirmar.isPending || !reserva}
              className="w-full h-12 bg-[var(--brand-lime)] text-[var(--brand-dark)] hover:bg-[var(--brand-lime)]/90 font-semibold text-base"
            >
              {confirmar.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" /> Confirmar pagamento e baixar PDF
                </>
              )}
            </Button>
            <p className="text-[11px] text-center opacity-60">
              O restante é acertado no dia diretamente com a equipe.
            </p>
          </section>
        ) : reserva ? (
          <section className="rounded-2xl bg-[var(--brand-lime)] text-[var(--brand-dark)] p-6 space-y-3 shadow-xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6" />
              <h2 className="text-xl font-bold">Pagamento confirmado!</h2>
            </div>
            <p className="text-sm">
              Sua reserva do dia{" "}
              <strong>{new Date(reserva.data + "T12:00:00").toLocaleDateString("pt-BR")}</strong> às{" "}
              <strong>{reserva.hora_inicio.slice(0, 5)}</strong> está garantida. Baixe seu
              comprovante em PDF para guardar.
            </p>
            <div className="rounded-xl bg-[var(--brand-dark)]/10 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Valor pago</span>
                <strong>{formatBRL(reserva.valor_pago ?? reserva.valor_sinal)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Valor total da reserva</span>
                <strong>{formatBRL(reserva.valor_total)}</strong>
              </div>
              {(reserva.valor_pago ?? reserva.valor_sinal) < reserva.valor_total && (
                <div className="flex justify-between opacity-80">
                  <span>Restante no dia</span>
                  <strong>
                    {formatBRL(reserva.valor_total - (reserva.valor_pago ?? reserva.valor_sinal))}
                  </strong>
                </div>
              )}
            </div>
            <Button
              onClick={() => setPdfOpen(true)}
              className="w-full h-12 bg-[var(--brand-dark)] text-[var(--brand-cream)] hover:bg-[var(--brand-dark)]/90 font-semibold"
            >
              <Eye className="w-5 h-5" /> Ver, baixar ou compartilhar PDF
            </Button>
            <p className="text-xs text-center opacity-70 flex items-center justify-center gap-1">
              <FileText className="w-3 h-3" /> Contém data, horário, valor e combinados
            </p>
          </section>
        ) : (
          <section className="rounded-2xl bg-[var(--brand-lime)] text-[var(--brand-dark)] p-6 text-center">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2" />
            <div className="font-bold">Pagamento confirmado. Obrigada!</div>
            <div className="mt-1 text-sm">
              Valor pago: <strong>{formatBRL(data.total)}</strong> · Total:{" "}
              <strong>{formatBRL(data.total)}</strong>
            </div>
          </section>
        )}

        {data.observacoes && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm whitespace-pre-wrap opacity-90">
            {data.observacoes}
          </section>
        )}

        <footer className="text-center text-xs opacity-50 pt-4">
          Dúvidas? Fale com a gente:{" "}
          <a
            className="underline"
            href={waMambaia(
              `Oi! Estou vendo a proposta "${data.titulo}" e queria tirar uma dúvida.`,
            )}
            target="_blank"
            rel="noreferrer"
          >
            {formatPhoneBR("3132232356")}
          </a>
        </footer>
      </main>
      <PdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} reserva={reservaPDF} />
    </div>
  );
}
