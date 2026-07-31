import { createFileRoute } from "@tanstack/react-router";
import { Alertas } from "@/components/pages/Alertas";

export const Route = createFileRoute("/_app/alertas")({
  head: () => ({
    meta: [
      { title: "Alertas e lembretes - Mambaia App" },
      {
        name: "description",
        content: "Cadastre lembretes com notificação push para os sócios da Mambaia.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Alertas,
});
