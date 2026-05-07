import { createFileRoute } from "@tanstack/react-router";
import { Relatorios } from "@/components/pages/Relatorios";

export const Route = createFileRoute("/_app/relatorios")({
  head: () => ({
    meta: [
      { title: "Relatórios — Mambaia App" },
      { name: "description", content: "Relatórios completos do financeiro da Mambaia: balanço, evolução, exportação." },
    ],
  }),
  component: Relatorios,
});
