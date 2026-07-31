import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const getKey = useServerFn(getVapidPublicKey);
  const sub = useServerFn(subscribePush);
  const unsub = useServerFn(unsubscribePush);
  const test = useServerFn(sendTestPush);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    setPermission(Notification.permission);
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager.getSubscription())
      .then((s) => setSubscribed(!!s))
      .catch(() => {});
  }, []);

  if (!supported) return null;

  async function ativar() {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Permissão negada");
        return;
      }
      const { key } = await getKey();
      if (!key) throw new Error("VAPID indisponível");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = subscription.toJSON();
      await sub({
        data: {
          endpoint: subscription.endpoint,
          p256dh: json.keys?.p256dh ?? "",
          auth: json.keys?.auth ?? "",
          user_agent: navigator.userAgent.slice(0, 500),
        },
      });
      setSubscribed(true);
      toast.success("Notificações ativadas");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ativar");
    } finally {
      setBusy(false);
    }
  }

  async function desativar() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const s = await reg.pushManager.getSubscription();
      if (s) {
        await unsub({ data: { endpoint: s.endpoint } });
        await s.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notificações desativadas");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao desativar");
    } finally {
      setBusy(false);
    }
  }

  async function testar() {
    setBusy(true);
    try {
      const r = await test();
      toast.success(`Enviadas: ${r.sent}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha no teste");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          {subscribed ? <BellRing className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Notificações</h3>
          <p className="text-sm text-muted-foreground">
            Receba o resumo diário às 9h e avisos de tarefas e gastos do dia.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {subscribed ? (
              <>
                <Button size="sm" variant="outline" onClick={testar} disabled={busy}>
                  Enviar teste
                </Button>
                <Button size="sm" variant="ghost" onClick={desativar} disabled={busy}>
                  <BellOff className="mr-1 h-4 w-4" /> Desativar
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={ativar} disabled={busy || permission === "denied"}>
                {permission === "denied" ? "Permissão bloqueada" : "Ativar notificações"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
