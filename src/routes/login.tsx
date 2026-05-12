import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import logo from "@/assets/logo-mambaia.svg";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Mambaia" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { session, loading, profile } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (session) {
      if (profile?.must_change_password) navigate({ to: "/primeiro-acesso", replace: true });
      else navigate({ to: "/", replace: true });
    }
  }, [session, loading, profile, navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      toast.error("E-mail ou senha incorretos");
      return;
    }
    toast.success("Bem-vindo!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-sm p-6">
        <div className="flex flex-col items-center text-center gap-2 mb-5">
          <img src={logo} alt="Mambaia" className="w-14 h-14 rounded-xl" />
          <h1 className="text-xl font-semibold">Mambaia App</h1>
          <p className="text-sm text-muted-foreground">Entre com sua conta interna</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="pwd">Senha</Label>
            <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Entrar
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-4">
          Senha temporária: <code>mambaia2026</code> — você troca no primeiro acesso.
        </p>
      </Card>
    </div>
  );
}