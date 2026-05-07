import { createFileRoute } from "@tanstack/react-router";
import { Acertos } from "@/components/pages/Acertos";

export const Route = createFileRoute("/_app/acertos")({
  head: () => ({
    meta: [
      { title: "Acertos entre sócios — Mambaia App" },
      { name: "description", content: "Saldo atualizado de quem deve para quem entre os sócios da Mambaia." },
    ],
  }),
  component: Acertos,
});
