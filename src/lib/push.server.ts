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

export type PushFailure = { host: string; code: number | null; body: string };

type PushSubRow = { endpoint: string; p256dh: string; auth: string };
type PushError = { statusCode?: number; body?: unknown; message?: string };

export async function sendPushToAll(
  payload: PushPayload,
): Promise<{ sent: number; removed: number; failed: PushFailure[]; vapid_public_prefix: string }> {
  configure();
  const { data: subs, error } = await supabaseAdmin.from("push_subscriptions").select("*");
  if (error) throw error;

  let sent = 0;
  let removed = 0;
  const failed: PushFailure[] = [];
  const json = JSON.stringify(payload);

  await Promise.all(
    ((subs ?? []) as PushSubRow[]).map(async (s) => {
      let host = "?";
      try {
        host = new URL(s.endpoint).host;
      } catch {
        host = "invalido";
      }
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
          { TTL: 3600, urgency: "high" },
        );
        sent++;
      } catch (err: unknown) {
        const e = err as PushError;
        const code = typeof e?.statusCode === "number" ? e.statusCode : null;
        // 404/410: inscricao expirada ou invalida, remove.
        if (code === 404 || code === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          removed++;
        } else {
          console.error("push error", host, code, e?.body);
        }
        failed.push({ host, code, body: String(e?.body ?? e?.message ?? "").slice(0, 160) });
      }
    }),
  );

  return { sent, removed, failed, vapid_public_prefix: (process.env.VAPID_PUBLIC_KEY ?? "").slice(0, 8) };
}
