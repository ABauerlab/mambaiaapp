import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToAll } from "@/lib/push.server";

type ReservaRow = {
  id: string;
  data: string;
  hora_inicio: string;
  cliente_nome: string;
  cliente_whatsapp: string;
  status: string;
  tipo: string | null;
  empreendimento: string | null;
  lembrete_24h_enviado_at: string | null;
  lembrete_1h_enviado_at: string | null;
};

// Sao Paulo offset: -03:00 (no DST since 2019). Handles agenda as local BR time.
const BR_OFFSET_MIN = -180;

function reservaStart(r: ReservaRow): Date {
  // Interpret r.data + r.hora_inicio as America/Sao_Paulo local time.
  const iso = `${r.data}T${String(r.hora_inicio).slice(0, 8)}-03:00`;
  return new Date(iso);
}

function fmtHora(r: ReservaRow) {
  return String(r.hora_inicio).slice(0, 5);
}

function fmtDataBR(r: ReservaRow) {
  return new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export const Route = createFileRoute("/api/public/hooks/reserva-lembretes")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        // Fetch reservas nos proximos 26h (cobre janelas 24h e 1h com folga)
        const inicio = now.toISOString().slice(0, 10);
        const fim = new Date(now.getTime() + 30 * 3600_000).toISOString().slice(0, 10);

        const { data, error } = await supabaseAdmin
          .from("reservas")
          .select(
            "id,data,hora_inicio,cliente_nome,cliente_whatsapp,status,tipo,empreendimento,lembrete_24h_enviado_at,lembrete_1h_enviado_at",
          )
          .gte("data", inicio)
          .lte("data", fim)
          .in("status", ["confirmada", "paga"]);
        if (error) throw new Error(error.message);

        let sent24 = 0;
        let sent1 = 0;
        void BR_OFFSET_MIN;

        for (const raw of (data ?? []) as ReservaRow[]) {
          // ignora bloqueios internos
          if (raw.cliente_whatsapp === "00000000000" || raw.cliente_nome.startsWith("BLOQUEIO")) continue;

          const start = reservaStart(raw);
          const diffMin = (start.getTime() - now.getTime()) / 60_000;

          // Janela 24h: entre 23h30 e 24h30 antes
          if (!raw.lembrete_24h_enviado_at && diffMin >= 23 * 60 + 30 && diffMin <= 24 * 60 + 30) {
            const who = raw.empreendimento ? `${raw.cliente_nome} (${raw.empreendimento})` : raw.cliente_nome;
            await sendPushToAll({
              title: "Lembrete: reserva em 24h",
              body: `${who} — amanhã ${fmtDataBR(raw)} às ${fmtHora(raw)}`,
              url: "/agenda",
              tag: `lembrete-24h-${raw.id}`,
            });
            await supabaseAdmin
              .from("reservas")
              .update({ lembrete_24h_enviado_at: new Date().toISOString() })
              .eq("id", raw.id);
            sent24++;
          }

          // Janela 1h: entre 45min e 75min antes
          if (!raw.lembrete_1h_enviado_at && diffMin >= 45 && diffMin <= 75) {
            const who = raw.empreendimento ? `${raw.cliente_nome} (${raw.empreendimento})` : raw.cliente_nome;
            await sendPushToAll({
              title: "Lembrete: reserva em 1h",
              body: `${who} — hoje às ${fmtHora(raw)}`,
              url: "/agenda",
              tag: `lembrete-1h-${raw.id}`,
            });
            await supabaseAdmin
              .from("reservas")
              .update({ lembrete_1h_enviado_at: new Date().toISOString() })
              .eq("id", raw.id);
            sent1++;
          }
        }

        return Response.json({ ok: true, sent_24h: sent24, sent_1h: sent1, checked: data?.length ?? 0 });
      },
    },
  },
});