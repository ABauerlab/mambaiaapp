import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/pages/Dashboard";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Mambaia App" },
      { name: "description", content: "Visão geral do financeiro da Mambaia: receitas, despesas, lucro e saldo entre sócios." },
    ],
  }),
  component: Dashboard,
});
