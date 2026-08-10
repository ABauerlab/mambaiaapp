import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToAll } from "@/lib/push.server";

/** Bloqueia chamadas externas: apenas o agendador interno conhece o segredo. */
function autorizado(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("x-cron-secret") === secret;
}

export const Route = createFileRoute("/api/public/hooks/nova-reserva")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!autorizado(request)) return new Response(\"Unauthorized\", { status: 401 });
        let body: { reserva_id?: string } = {};
        try {
          body = (await request.json()) as { reserva_id?: string };
        } catch {
          body = {};
        }
        if (!body.reserva_id) {
          return Response.json({ ok: false, error: "reserva_id required" }, { status: 400 });
        }
        const { data: r, error } = await supabaseAdmin
          .from("reservas")
          .select("cliente_nome,data,hora_inicio,tipo,empreendimento,duracao_minutos")
          .eq("id", body.reserva_id)
          .maybeSingle();
        if (error || !r) {
          return Response.json(
            { ok: false, error: error?.message ?? "not found" },
            { status: 404 },
          );
        }
        const dataFmt = new Date((r.data as string) + "T12:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        });
        const hora = String(r.hora_inicio).slice(0, 5);
        const label = r.tipo === "pacote_marcas" ? "Pacote Marcas" : "Reserva";
        const who = r.empreendimento ? `${r.cliente_nome} (${r.empreendimento})` : r.cliente_nome;
        const result = await sendPushToAll({
          title: `${label}: ${who}`,
          body: `${dataFmt} às ${hora} — nova reserva recebida`,
          url: "/agenda",
          tag: `nova-reserva-${body.reserva_id}`,
        });
        return Response.json({ ok: true, ...result });
      },
    },
  },
});
