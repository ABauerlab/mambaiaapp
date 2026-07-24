import { createFileRoute } from "@tanstack/react-router";
import { Agenda } from "@/components/pages/Agenda";

export const Route = createFileRoute("/_app/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda do estúdio - Mambaia App" },
      { name: "description", content: "Gerencie as reservas do estúdio Mambaia." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Agenda,
});
