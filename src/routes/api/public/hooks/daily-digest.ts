import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToAll } from "@/lib/push.server";

export const Route = createFileRoute("/api/public/hooks/daily-digest")({
  server: {
    handlers: {
      POST: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const dia = new Date().getDate();

        const [tasksRes, fixosRes] = await Promise.all([
          supabaseAdmin
            .from("quadro_itens")
            .select("titulo")
            .eq("prazo", today)
            .neq("status", "concluido"),
          supabaseAdmin
            .from("gastos_fixos")
            .select("nome, valor")
            .eq("ativo", true)
            .eq("dia_mes", dia),
        ]);

        const tasks = tasksRes.data ?? [];
        const fixos = fixosRes.data ?? [];

        const parts: string[] = [];
        if (tasks.length) parts.push(`${tasks.length} tarefa(s) com prazo hoje`);
        if (fixos.length) parts.push(`${fixos.length} gasto(s) fixo(s) vencendo hoje`);

        if (parts.length === 0) {
          return Response.json({ ok: true, skipped: true });
        }

        const result = await sendPushToAll({
          title: "Mambaia - bom dia",
          body: parts.join(" • "),
          url: "/quadro",
          tag: "digest-" + today,
        });

        return Response.json({ ok: true, ...result });
      },
    },
  },
});
