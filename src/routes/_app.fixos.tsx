import { createFileRoute } from "@tanstack/react-router";
import { GastosFixos } from "@/components/pages/GastosFixos";

export const Route = createFileRoute("/_app/fixos")({
  head: () => ({
    meta: [
      { title: "Gastos fixos - Mambaia App" },
      {
        name: "description",
        content:
          "Cadastro dos gastos fixos mensais da Mambaia: aluguel, IPTU, condomínio, internet.",
      },
    ],
  }),
  component: GastosFixos,
});
