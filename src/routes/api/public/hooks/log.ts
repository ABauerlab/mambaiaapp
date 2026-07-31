import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/log")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const { error } = await supabaseAdmin.from("notificacoes_log").insert({
            chave: body.chave || 'sw-log',
            titulo: body.titulo || 'Log do Service Worker',
            corpo: body.msg || 'Sem corpo',
          });
          if (error) console.error("Erro ao salvar log no banco:", error);
          return Response.json({ ok: true });
        } catch (e) {
          return Response.json({ ok: false, error: String(e) }, { status: 400 });
        }
      },
    },
  },
});