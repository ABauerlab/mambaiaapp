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
  valor_pago: number | string | null;
  diff_pricing_id: string | null;
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
  tipo: "sinal" | "saldo";
  cliente: string;
  horasValidade: number;
  diffPricingId: string | null;
}) {
  const expira = new Date(Date.now() + p.horasValidade * 60 * 60 * 1000).toISOString();
  const body: Record<string, unknown> = {
    items: [
      {
        id: p.reservaId,
        title: p.titulo,
        description: "Locacao de estudio fotografico por hora",
        category_id: "services",
        quantity: 1,
        currency_id: "BRL",
        unit_price: p.valor,
      },
    ],
    payer: { name: p.cliente.split(" ")[0] || undefined, surname: p.cliente.split(" ").slice(1).join(" ") || undefined },
    external_reference: p.reservaId,
    metadata: { reserva_id: p.reservaId, tipo: p.tipo },
    notification_url: `${SITE}/api/public/hooks/mercadopago`,
    statement_descriptor: "MAMBAIA",
    expires: true,
    expiration_date_to: expira,
    // Todas as formas (PIX, cartao, saldo Mercado Pago), exceto boleto e lotericas (demoram dias e conflitam com a validade).
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 3 },
    back_urls: { success: SITE, pending: SITE, failure: SITE },
  };
  if (p.diffPricingId && /^\d+$/.test(p.diffPricingId)) body.differential_pricing = { id: Number(p.diffPricingId) };
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `${p.reservaId}-${p.tipo}-${p.valor}-${Math.floor(Date.now() / 3600000)}`,
    },
    body: JSON.stringify(body),
  });
  const d = (await res.json()) as { init_point?: string; message?: string };
  if (!res.ok || !d.init_point) throw new Error(d.message ?? `Mercado Pago ${res.status}`);
  return d.init_point;
}

/**
 * Gera 1 link de pagamento (todas as formas) do sinal ou do saldo de uma reserva.
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
        let tipo: "sinal" | "saldo" = "sinal";
        try {
          const b = (await request.json()) as { reserva_id?: string; tipo?: string };
          reservaId = String(b.reserva_id ?? "");
          if (b.tipo === "saldo") tipo = "saldo";
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
        const total = Number(d.valor_total);
        const pago = Number(d.valor_pago ?? 0);
        let valor: number;
        let titulo: string;
        const num = String(d.numero).padStart(4, "0");
        if (tipo === "saldo") {
          valor = Math.round((total - pago) * 100) / 100;
          if (!d.paga || valor <= 0.01) return json({ ok: false, erro: "Nao ha saldo a pagar" }, 409);
          titulo = `Saldo - Mambaia, proposta ${num}`;
        } else {
          if (d.paga) return json({ ok: false, erro: "Reserva ja paga" }, 409);
          valor = Number(d.valor_sinal);
          titulo = `Sinal 50% - Mambaia, proposta ${num}`;
        }
        try {
          const link = await criarPreferencia(mpToken, {
            titulo,
            valor,
            reservaId,
            tipo,
            cliente: String(d.cliente ?? "").replace(/^TESTE.*/i, "").trim(),
            horasValidade: tipo === "saldo" ? 48 : 24,
            diffPricingId: d.diff_pricing_id,
          });
          return json({ ok: true, tipo, valor, link, validade: tipo === "saldo" ? "48 horas" : "24 horas" });
        } catch (e) {
          return json({ ok: false, erro: e instanceof Error ? e.message : "Falha ao gerar link" }, 502);
        }
      },
    },
  },
});
