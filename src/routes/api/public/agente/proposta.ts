import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  gerarReservaPDF,
  nomeArquivoProposta,
  type ReservaPDFInput,
} from "@/lib/reserva-pdf";

type DocRow = {
  cliente: string;
  whatsapp: string;
  data: string;
  hora_inicio: string;
  duracao_minutos: number;
  valor_total: number | string;
  valor_sinal: number | string;
  valor_pago: number | string | null;
  tipo_pagamento: "integral" | "parcial" | null;
  paid_at: string | null;
  numero_proposta: number;
  tipo: string | null;
  empreendimento: string | null;
  pix_chave: string | null;
  pix_nome: string | null;
  slug: string;
};

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: DocRow | null; error: { message: string } | null }>;
};

/**
 * PDF da proposta/comprovante para envio pelo WhatsApp (agente Sony).
 * Protegido por uma chave por reserva (derivada do segredo do agente), validada no banco.
 */
export const Route = createFileRoute("/api/public/agente/proposta")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const slug = url.searchParams.get("slug") ?? "";
        const chave = url.searchParams.get("k") ?? "";
        if (!slug || !chave) return new Response("Not found", { status: 404 });

        const { data: d, error } = await (supabaseAdmin as unknown as RpcClient).rpc(
          "agente_documento_dados",
          { p_slug: slug, p_chave: chave },
        );
        if (error || !d) return new Response("Not found", { status: 404 });

        const pago = !!d.paid_at;
        const input: ReservaPDFInput = {
          cliente: d.cliente,
          whatsapp: d.whatsapp,
          data: d.data,
          horaInicio: d.hora_inicio,
          duracaoMinutos: d.duracao_minutos,
          valorTotal: Number(d.valor_total),
          valorPago: pago ? Number(d.valor_pago ?? d.valor_sinal) : 0,
          tipoPagamento: d.tipo_pagamento ?? "parcial",
          paidAt: d.paid_at ?? "",
          slug: d.slug,
          numeroProposta: d.numero_proposta,
          tipo: d.tipo === "pacote_marcas" ? "pacote_marcas" : "locacao",
          empreendimento: d.empreendimento,
          pendente: !pago,
          valorSinal: Number(d.valor_sinal),
          pixChave: d.pix_chave,
          pixNome: d.pix_nome,
        };

        const pdf = gerarReservaPDF(input).output("arraybuffer");
        return new Response(pdf, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${nomeArquivoProposta(input)}"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
