import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Pagamento = {
  id: number | string;
  status: string;
  transaction_amount: number;
  external_reference?: string | null;
  payment_type_id?: string;
  fee_details?: { amount: number }[];
};

type AdminClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (t: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

const ok = () => new Response("ok", { status: 200 });

function hex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function assinaturaValida(request: Request, dataId: string, secret: string) {
  const header = request.headers.get("x-signature") ?? "";
  const requestId = request.headers.get("x-request-id") ?? "";
  const ts = /ts=([^,]+)/.exec(header)?.[1];
  const v1 = /v1=([^,]+)/.exec(header)?.[1];
  if (!ts || !v1 || !dataId) return false;
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const calc = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest)));
  return calc === v1;
}

/**
 * Webhook do Mercado Pago. Valida a assinatura, consulta o pagamento direto na API
 * (nunca confia no corpo da notificacao) e confirma a reserva automaticamente.
 */
export const Route = createFileRoute("/api/public/hooks/mercadopago")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MP_ACCESS_TOKEN;
        const secret = process.env.MP_WEBHOOK_SECRET;
        if (!token || !secret) return new Response("not configured", { status: 500 });

        const url = new URL(request.url);
        let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
        try {
          body = await request.json();
        } catch {
          /* corpo vazio */
        }
        const tipo = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? body.type ?? "";
        const dataId = String(url.searchParams.get("data.id") ?? body.data?.id ?? "");
        if (tipo !== "payment" || !dataId) return ok();
        if (!(await assinaturaValida(request, dataId, secret))) return new Response("invalid signature", { status: 401 });

        const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(dataId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return new Response("payment lookup failed", { status: 502 });
        const p = (await res.json()) as Pagamento;
        const reservaId = String(p.external_reference ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(reservaId)) return ok();

        const db = supabaseAdmin as unknown as AdminClient;
        if (p.status === "approved") {
          const taxa = (p.fee_details ?? []).reduce((s, f) => s + Number(f.amount || 0), 0);
          const { data, error } = await db.rpc("mp_confirmar_pagamento", {
            p_payment_id: String(p.id),
            p_reserva: reservaId,
            p_bruto: Number(p.transaction_amount),
            p_taxa: taxa,
            p_metodo: p.payment_type_id ?? "",
          });
          if (error) return new Response("db error", { status: 500 });
          const r = data as { ok?: boolean; erro?: string; ja_pago?: boolean } | null;
          if (r && (r.erro || r.ja_pago)) {
            await db.from("agente_eventos").insert({
              tipo: "mp_alerta",
              reserva_id: reservaId,
              dados: {
                resumo: r.ja_pago
                  ? `Pagamento do Mercado Pago (id ${p.id}, R$ ${p.transaction_amount}) em reserva que ja estava paga. Verifique duplicidade e reembolse se preciso.`
                  : `Pagamento do Mercado Pago (id ${p.id}, R$ ${p.transaction_amount}) com problema: ${r.erro}. Confira no painel.`,
              },
            });
          }
        } else if (p.status === "refunded" || p.status === "charged_back") {
          await db.from("agente_eventos").insert({
            tipo: "mp_alerta",
            reserva_id: reservaId,
            dados: { resumo: `Pagamento ${p.id} (R$ ${p.transaction_amount}) ficou como ${p.status} no Mercado Pago. Ajuste a reserva e as financas.` },
          });
        }
        return ok();
      },
    },
  },
});
