import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE = "https://mambaiabh.com.br";

type Dados = {
  ok: boolean;
  erro?: string;
  reserva_id: string;
  cliente: string;
  numero: number;
  paga: boolean;
  valor_total: number | string;
  valor_sinal: number | string;
  taxa_cartao: number | string;
};

type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: Dados | null; error: { message: string } | null }>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function criarPreferencia(token: string, p: {
  titulo: string;
  valor: number;
  reservaId: string;
  tipo: "pix" | "cartao";
}) {
  const expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const excluidos =
    p.tipo === "pix"
      ? [{ id: "credit_card" }, { id: "debit_card" }, { id: "ticket" }, { id: "atm" }, { id: "prepaid_card" }]
      : [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }, { id: "account_money" }];
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `${p.reservaId}-${p.tipo}-${p.valor}`,
    },
    body: JSON.stringify({
      items: [{ id: p.reservaId, title: p.titulo, quantity: 1, currency_id: "BRL", unit_price: p.valor }],
      external_reference: p.reservaId,
      metadata: { reserva_id: p.reservaId, tipo: p.tipo },
      notification_url: `${SITE}/api/public/hooks/mercadopago`,
      statement_descriptor: "MAMBAIA",
      expires: true,
      expiration_date_to: expira,
      payment_methods: { excluded_payment_types: excluidos, installments: 1 },
      back_urls: { success: SITE, pending: SITE, failure: SITE },
    }),
  });
  const d = (await res.json()) as { init_point?: string; message?: string };
  if (!res.ok || !d.init_point) throw new Error(d.message ?? `Mercado Pago ${res.status}`);
  return d.init_point;
}

/**
 * Gera os links de pagamento (PIX e cartao com taxa repassada) do sinal de uma reserva.
 * Protegido pelo token do agente (header x-agente-token), validado no banco.
 */
export const Route = createFileRoute("/api/public/agente/pagamento")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const mpToken = process.env.MP_ACCESS_TOKEN;
        if (!mpToken) return json({ ok: false, erro: "Mercado Pago nao configurado" }, 500);
        const agenteToken = request.headers.get("x-agente-token") ?? "";
        let reservaId = "";
        try {
          reservaId = String(((await request.json()) as { reserva_id?: string }).reserva_id ?? "");
        } catch {
          return json({ ok: false, erro: "JSON invalido" }, 400);
        }
        if (!agenteToken || !/^[0-9a-f-]{36}$/i.test(reservaId)) return json({ ok: false, erro: "Dados invalidos" }, 400);

        const { data: d, error } = await (supabaseAdmin as unknown as RpcClient).rpc("agente_pagamento_dados", {
          p_token: agenteToken,
          p_reserva: reservaId,
        });
        if (error || !d) return json({ ok: false, erro: "Nao autorizado" }, 401);
        if (!d.ok) return json({ ok: false, erro: d.erro ?? "Reserva nao encontrada" }, 404);
        if (d.paga) return json({ ok: false, erro: "Reserva ja paga" }, 409);

        const sinal = Number(d.valor_sinal);
        const taxa = Math.min(Math.max(Number(d.taxa_cartao) || 0.0498, 0), 0.2);
        const sinalCartao = Math.round((sinal / (1 - taxa)) * 100) / 100;
        const titulo = `Sinal 50% - Mambaia, proposta ${String(d.numero).padStart(4, "0")}`;
        try {
          const [linkPix, linkCartao] = await Promise.all([
            criarPreferencia(mpToken, { titulo, valor: sinal, reservaId, tipo: "pix" }),
            criarPreferencia(mpToken, { titulo: `${titulo} (cartao)`, valor: sinalCartao, reservaId, tipo: "cartao" }),
          ]);
          return json({
            ok: true,
            valor_pix: sinal,
            link_pix: linkPix,
            valor_cartao: sinalCartao,
            link_cartao: linkCartao,
            validade: "24 horas",
          });
        } catch (e) {
          return json({ ok: false, erro: e instanceof Error ? e.message : "Falha ao gerar link" }, 502);
        }
      },
    },
  },
});
