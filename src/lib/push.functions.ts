import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPushToAll } from "./push.server";

export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? "" };
});

const subSchema = z.object({
  endpoint: z.string().url().max(2000),
  p256dh: z.string().min(10).max(500),
  auth: z.string().min(10).max(200),
  user_agent: z.string().max(500).optional().nullable(),
  socio_id: z.string().uuid().optional().nullable(),
});

export const subscribePush = createServerFn({ method: "POST" })
  .inputValidator((d) => subSchema.parse(d))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
      {
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        user_agent: data.user_agent ?? null,
        socio_id: data.socio_id ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsubscribePush = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" }).handler(async () => {
  return sendPushToAll({
    title: "Mambaia App",
    body: "Notificações ativas. Tudo certo!",
    url: "/",
    tag: "teste",
  });
});

const notifySchema = z.object({
  title: z.string().min(1).max(100),
  body: z.string().min(1).max(300),
  url: z.string().max(200).optional(),
  tag: z.string().max(100).optional(),
});

export const notifyImmediate = createServerFn({ method: "POST" })
  .inputValidator((d) => notifySchema.parse(d))
  .handler(async ({ data }) => {
    return sendPushToAll(data);
  });
