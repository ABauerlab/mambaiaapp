import webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || "mailto:contato@mambaiabh.com.br";
  if (!pub || !priv) throw new Error("VAPID keys missing");
  webpush.setVapidDetails(sub, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushToAll(
  payload: PushPayload,
): Promise<{ sent: number; removed: number }> {
  configure();
  const { data: subs, error } = await supabaseAdmin.from("push_subscriptions").select("*");
  if (error) throw error;
  
  let sent = 0;
  let removed = 0;
  const json = JSON.stringify(payload);

  await Promise.all(
    (subs ?? []).map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        );
        sent++;
      } catch (err: any) {
        // Status 404 ou 410 significa que a inscrição expirou ou é inválida (chave VAPID mudou)
        const code = err?.statusCode;
        if (code === 404 || code === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          removed++;
        } else {
          console.error("push error", code, err?.body);
        }
      }
    }),
  );

  return { sent, removed };
}