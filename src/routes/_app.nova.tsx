import { createFileRoute } from "@tanstack/react-router";
import { NovaTransacao } from "@/components/pages/NovaTransacao";

export const Route = createFileRoute("/_app/nova")({
  head: () => ({
    meta: [
      { title: "Nova transação — Mambaia App" },
      { name: "description", content: "Registrar novo gasto ou ganho da Mambaia." },
    ],
  }),
  component: NovaTransacao,
});
