import { createFileRoute } from "@tanstack/react-router";
import { Categorias } from "@/components/pages/Categorias";

export const Route = createFileRoute("/_app/categorias")({
  head: () => ({
    meta: [
      { title: "Categorias - Mambaia App" },
      { name: "description", content: "Gerenciar categorias de gastos e ganhos." },
    ],
  }),
  component: Categorias,
});
