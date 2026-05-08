import { createFileRoute } from "@tanstack/react-router";
import { Quadro } from "@/components/pages/Quadro";

export const Route = createFileRoute("/_app/quadro")({
  component: Quadro,
  head: () => ({ meta: [{ title: "Ideias & Tarefas — Mambaia" }] }),
});
