import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, BellRing, Info, RefreshCcw, Terminal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getVapidPublicKey,
  subscribePush,
  unsubscribePush,
  sendTestPush,
} from "@/lib/push.functions";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushNotificationsCard() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<{ t: string; msg: string; type: "info" | "err" | "ok" }[]>([]);

  const addLog = (msg: string, type: "info" | "err" | "ok" = "info") => {
    const t = new Date().toLocaleTimeString("pt-BR");
    setLogs((prev) => [{ t, msg, type }, ...prev].slice(0, 15));
  };

  const getKey = useServerFn(getVapidPublicKey);
  const sub = useServerFn(subscribePush);
  const unsub = useServerFn(unsubscribePush);
  const test = useServerFn(sendTestPush);

  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(isSupported);
    if (!isSupported) {
      addLog("Push não suportado: verifique se está no modo Standalone (Tela de Início) no iOS", "err");
      return;
    }
    setPermission(Notification.permission);
    navigator.serviceWorker.ready.then(async (reg) => {
      const s = await reg.pushManager.getSubscription();
      setSubscribed(!!s);
      addLog(s ? "Inscrição ativa encontrada" : "Sem inscrição ativa", s ? "ok" : "info");
    });
  }, []);

  async function deepReset() {
    setBusy(true);
    addLog("Iniciando reset profundo...", "info");
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.unregister();
        addLog(`SW removido: ${reg.scope}`, "ok");
      }
      addLog("Service Workers limpos. O app será recarregado.", "ok");
      toast.info("Cache limpo. Recarregando...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e: any) {
      addLog(`Erro ao resetar: ${e.message}`, "err");
    } finally {
      setBusy(false);
    }
  }

  async function ativar() {
    setBusy(true);
    addLog("Solicitando permissão...", "info");
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        addLog("Permissão negada pelo usuário", "err");
        return;
      }
      addLog("Permissão concedida!", "ok");

      addLog("Buscando VAPID Key do servidor...", "info");
      const { key } = await getKey();
      if (!key) throw new Error("VAPID Public Key não encontrada no .env do servidor");
      addLog(`VAPID Key obtida (começa com: ${key.slice(0, 5)}...)`, "ok");

      addLog("Registrando Service Worker...", "info");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      addLog("Service Worker pronto!", "ok");

      addLog("Criando inscrição no navegador...", "info");
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      addLog("Inscrição criada no navegador", "ok");

      const json = subscription.toJSON();
      addLog("Enviando inscrição para o Supabase...", "info");
      await sub({
        data: {
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });
      addLog("Inscrição salva com sucesso no banco!", "ok");

      setSubscribed(true);
      toast.success("Notificações ativadas");
    } catch (e: any) {
      addLog(`FALHA NA CADEIA: ${e.message}`, "err");
      toast.error("Erro ao ativar push");
    } finally {
      setBusy(false);
    }
  }

  async function testar() {
    setBusy(true);
    addLog("Chamando notifyImmediate no backend...", "info");
    try {
      const r = await test();
      addLog(`RESPOSTA DO SERVIDOR: Enviadas: ${r.sent}, Removidas: ${r.removed}`, r.sent > 0 ? "ok" : "err");
      if (r.sent === 0) {
        addLog("Dica: Se enviadas=0, sua inscrição no banco pode estar orfã. Tente Reset Deep + Ativar novamente.", "info");
      }
    } catch (e: any) {
      addLog(`ERRO NO TESTE: ${e.message}`, "err");
    } finally {
      setBusy(false);
    }
  }

  if (supported === false) {
    return (
      <Card className="p-4 border-destructive/20 bg-destructive/5 text-destructive">
        <div className="flex items-center gap-3">
          <BellOff className="h-5 w-5" />
          <div className="text-sm font-medium">Push não suportado (instale o PWA no iOS)</div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2 ${subscribed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
          {subscribed ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notificações Push</h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowDebug(!showDebug)}>
              <Info className={showDebug ? "text-primary" : "text-muted-foreground"} size={16} />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Alertas de agendamentos e vencimentos.</p>
          
          <div className="mt-3 flex flex-wrap gap-2">
            {subscribed ? (
              <>
                <Button size="sm" variant="outline" onClick={testar} disabled={busy}>
                  {busy ? <RefreshCcw className="h-3.5 w-3.5 animate-spin mr-1" /> : "Testar agora"}
                </Button>
                <Button size="sm" variant="ghost" onClick={deepReset} disabled={busy} className="text-destructive">
                  Reset Deep
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={ativar} disabled={busy || permission === "denied"}>
                {busy ? <RefreshCcw className="h-3.5 w-3.5 animate-spin mr-1" /> : "Ativar notificações"}
              </Button>
            )}
          </div>

          {showDebug && (
            <div className="mt-4 pt-3 border-t">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                <Terminal size={12} /> Log de Eventos
              </div>
              <div className="bg-black/90 rounded-lg p-3 font-mono text-[10px] space-y-1.5 max-h-48 overflow-y-auto">
                {logs.map((l, i) => (
                  <div key={i} className={l.type === "err" ? "text-red-400" : l.type === "ok" ? "text-green-400" : "text-blue-300"}>
                    <span className="opacity-50 mr-2">[{l.t}]</span>
                    {l.msg}
                  </div>
                ))}
                {logs.length === 0 && <div className="text-white/30 italic">Nenhum evento registrado ainda.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}