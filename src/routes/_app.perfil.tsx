import { createFileRoute } from "@tanstack/react-router";
import { Perfil } from "@/components/pages/Perfil";

export const Route = createFileRoute("/_app/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Mambaia" }] }),
  component: Perfil,
});