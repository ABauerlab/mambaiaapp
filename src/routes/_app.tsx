import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: GuardedShell,
});

function GuardedShell() {
  const { loading, session, profile } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login", replace: true });
    else if (profile?.must_change_password) navigate({ to: "/primeiro-acesso", replace: true });
  }, [loading, session, profile, navigate]);
  if (loading || !session || profile?.must_change_password) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }
  return <AppShell />;
}
