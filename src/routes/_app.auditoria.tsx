import { createFileRoute } from "@tanstack/react-router";
import { Auditoria } from "@/components/pages/Auditoria";

export const Route = createFileRoute("/_app/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoria - Mambaia App" },
      { name: "description", content: "Historico completo de acertos e fechamentos da Mambaia." },
    ],
  }),
  component: Auditoria,
});
