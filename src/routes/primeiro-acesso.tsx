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

export const Route = createFileRoute("/primeiro-acesso")({
  head: () => ({ meta: [{ title: "Primeiro acesso - Mambaia" }] }),
  component: PrimeiroAcesso,
});

function PrimeiroAcesso() {
  const { session, loading, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/login", replace: true });
    else if (profile && !profile.must_change_password)
      navigate({ to: "/dashboard", replace: true });
    else if (profile && !name) setName(profile.display_name);
  }, [session, loading, profile, navigate, name]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 6) {
      toast.error("Senha precisa ter ao menos 6 caracteres");
      return;
    }
    if (pwd !== pwd2) {
      toast.error("As senhas não conferem");
      return;
    }
    setBusy(true);
    const { error: pErr } = await supabase.auth.updateUser({ password: pwd });
    if (pErr) {
      setBusy(false);
      toast.error(pErr.message);
      return;
    }
    if (profile) {
      await supabase
        .from("profiles")
        .update({ display_name: name.trim() || profile.display_name, must_change_password: false })
        .eq("id", profile.id);
    }
    await refreshProfile();
    setBusy(false);
    toast.success("Tudo pronto!");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold mb-1">Bem-vindo!</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Defina sua senha e como quer ser chamado.
        </p>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name">Como te chamamos?</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={40}
            />
          </div>
          <div>
            <Label htmlFor="p1">Nova senha</Label>
            <Input
              id="p1"
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label htmlFor="p2">Confirme a senha</Label>
            <Input
              id="p2"
              type="password"
              value={pwd2}
              onChange={(e) => setPwd2(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar e entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}
