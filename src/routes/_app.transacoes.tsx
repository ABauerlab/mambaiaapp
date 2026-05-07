import { createFileRoute } from "@tanstack/react-router";
import { Transacoes } from "@/components/pages/Transacoes";

export const Route = createFileRoute("/_app/transacoes")({
  head: () => ({
    meta: [
      { title: "Transações — Mambaia App" },
      { name: "description", content: "Lista de todos os gastos e ganhos da Mambaia com filtros." },
    ],
  }),
  component: Transacoes,
});
