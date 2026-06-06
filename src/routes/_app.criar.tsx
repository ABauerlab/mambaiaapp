import { createFileRoute } from "@tanstack/react-router";
import { Criar } from "@/components/pages/Criar";

export const Route = createFileRoute("/_app/criar")({
  head: () => ({
    meta: [
      { title: "Criar cobrança — Mambaia App" },
      { name: "description", content: "Crie um link de cobrança PIX para enviar ao cliente." },
    ],
  }),
  component: Criar,
});