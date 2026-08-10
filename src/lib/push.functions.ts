import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Só aceita caminhos internos relativos, evitando push de phishing com link externo. */
const internalPath = z
  .string()
  .max(200)
  .refine((v) => /^\/[A-Za-z0-9\-._~/?#[\]@!$&'()*+,;=%]*$/.test(v) && !v.startsWith("//"), {
    message: "URL inválida",
  });

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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => subSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ endpoint: z.string().url() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", data.endpoint);
    return { ok: true };
  });

export const sendTestPush = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { sendPushToAll } = await import("./push.server");
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
  url: internalPath.optional(),
  tag: z.string().max(100).optional(),
});

export const notifyImmediate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => notifySchema.parse(d))
  .handler(async ({ data }) => {
    const { sendPushToAll } = await import("./push.server");
    return sendPushToAll(data);
  });
