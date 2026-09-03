import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

type NovaReserva = {
  id: string;
  cliente_nome: string;
  data: string;
  hora_inicio: string;
  tipo: string | null;
  empreendimento: string | null;
};

function resumoReserva(r: NovaReserva): string {
  const dataFmt = new Date(r.data + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const hora = r.hora_inicio.slice(0, 5);
  const quem = r.empreendimento ? `${r.cliente_nome} (${r.empreendimento})` : r.cliente_nome;
  return `${quem} - ${dataFmt} às ${hora}`;
}

/** Roda uma vez a cada entrada no sistema (abertura do app/PWA): confere se
 * chegou reserva nova desde a última vez que o usuário abriu e avisa com um
 * toast, sem depender do push do PWA (que nem sempre dispara, ex.: iOS). */
export function NovaReservaWatcher() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || !profile) return;
    checked.current = true;

    void (async () => {
      const desde = profile.last_seen_reservas_at;
      const agora = new Date().toISOString();

      const { data, error } = await supabase
        .from("reservas")
        .select("id, cliente_nome, data, hora_inicio, tipo, empreendimento")
        .gt("created_at", desde)
        .neq("status", "cancelada")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        const lista = data as unknown as NovaReserva[];
        const titulo =
          lista.length === 1
            ? "1 nova reserva desde sua última visita"
            : `${lista.length} novas reservas desde sua última visita`;
        toast.success(titulo, {
          description: lista.slice(0, 5).map(resumoReserva).join("\n"),
          duration: 10000,
          action: {
            label: "Ver agenda",
            onClick: () => navigate({ to: "/agenda" }),
          },
        });
      }

      await supabase.from("profiles").update({ last_seen_reservas_at: agora }).eq("id", profile.id);
      void refreshProfile();
    })();
  }, [profile, navigate, refreshProfile]);

  return null;
}
