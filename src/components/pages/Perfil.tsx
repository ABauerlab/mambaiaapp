import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export function Perfil() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? "");
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  if (!user || !profile) return null;

  async function saveName() {
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ display_name: name.trim() }).eq("id", profile!.id);
    setSavingName(false);
    if (error) toast.error(error.message);
    else { toast.success("Nome atualizado"); await refreshProfile(); }
  }

  async function uploadAvatar(file: File) {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Foto até 3MB"); return; }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user!.id}/avatar-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { setUploading(false); toast.error(upErr.message); return; }
    const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
    await supabase.from("profiles").update({ avatar_url: pub.publicUrl }).eq("id", profile!.id);
    setUploading(false);
    toast.success("Foto atualizada");
    await refreshProfile();
  }

  async function changePwd(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 6) { toast.error("Senha precisa de 6+ caracteres"); return; }
    if (pwd !== pwd2) { toast.error("As senhas não conferem"); return; }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSavingPwd(false);
    if (error) toast.error(error.message);
    else { toast.success("Senha alterada"); setPwd(""); setPwd2(""); }
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <PageHeader title="Meu perfil" description="Como você aparece no sistema" />

      <Card className="p-5 mb-4">
        <div className="flex items-center gap-4 mb-4">
          <Avatar className="w-20 h-20">
            {profile.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.display_name} />}
            <AvatarFallback className="text-lg">{profile.display_name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <Label htmlFor="file" className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-md border text-sm hover:bg-accent">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Trocar foto
            </Label>
            <input id="file" type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadAvatar(f); }} />
            <p className="text-xs text-muted-foreground mt-1">JPG ou PNG, até 3MB</p>
          </div>
        </div>
        <div>
          <Label htmlFor="dn">Nome de exibição</Label>
          <div className="flex gap-2 mt-1.5">
            <Input id="dn" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            <Button onClick={saveName} disabled={savingName || !name.trim()}>
              {savingName && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5 mb-4">
        <h3 className="font-semibold mb-3">Trocar senha</h3>
        <form onSubmit={changePwd} className="space-y-3">
          <div>
            <Label htmlFor="np">Nova senha</Label>
            <Input id="np" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} minLength={6} required />
          </div>
          <div>
            <Label htmlFor="np2">Confirme</Label>
            <Input id="np2" type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} minLength={6} required />
          </div>
          <Button type="submit" disabled={savingPwd}>
            {savingPwd && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Alterar senha
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-1">Conta</h3>
        <p className="text-sm text-muted-foreground mb-3">{user.email}</p>
        <Button variant="outline" onClick={() => void signOut()}>Sair</Button>
      </Card>
    </div>
  );
}