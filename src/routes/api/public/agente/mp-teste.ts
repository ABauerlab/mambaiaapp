import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SITE = "https://mambaiabh.com.br";

type RpcClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

/** TEMPORARIO: gera uma preferencia com a credencial de TESTE para a avaliacao de qualidade do Mercado Pago. Sera removido. */
export const Route = createFileRoute("/api/public/agente/mp-teste")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MP_ACCESS_TOKEN_TESTE;
        if (!token) return new Response("sem token de teste", { status: 500 });
        const { error } = await (supabaseAdmin as unknown as RpcClient).rpc("agente_pagamento_dados", {
          p_token: request.headers.get("x-agente-token") ?? "",
          p_reserva: "00000000-0000-0000-0000-000000000000",
        });
        if (error) return new Response("nao autorizado", { status: 401 });
        const ref = "TESTE-" + Date.now();
        const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [
              {
                id: ref,
                title: "Sinal 50% - Mambaia, proposta teste",
                description: "Locacao de estudio fotografico por hora",
                category_id: "services",
                quantity: 1,
                currency_id: "BRL",
                unit_price: 10,
              },
            ],
            payer: { name: "Teste", surname: "Comprador" },
            external_reference: ref,
            notification_url: `${SITE}/api/public/hooks/mercadopago`,
            statement_descriptor: "MAMBAIA",
            expires: true,
            expiration_date_to: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
            payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }], installments: 3 },
            back_urls: { success: SITE, pending: SITE, failure: SITE },
          }),
        });
        const d = (await res.json()) as { init_point?: string; sandbox_init_point?: string; message?: string };
        return new Response(JSON.stringify({ ok: res.ok, init_point: d.init_point, sandbox_init_point: d.sandbox_init_point, erro: d.message }), {
          status: res.ok ? 200 : 502,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
