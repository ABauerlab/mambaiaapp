import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";
import { z } from "zod";

// Server function pública (sem auth): recebe o mesmo evento e event_id que o
// Pixel disparou no navegador e reenvia para a Meta Conversions API, com
// dedup garantida pelo event_id compartilhado. O token de acesso e o Pixel ID
// nunca saem do servidor - seguem apenas em variáveis de ambiente.

const CAPI_EVENT_NAMES = [
  "PageView",
  "ViewContent",
  "Lead",
  "InitiateCheckout",
  "Purchase",
  "Schedule",
] as const;

const inputSchema = z.object({
  event_name: z.enum(CAPI_EVENT_NAMES),
  event_id: z.string().min(1).max(100),
  event_source_url: z.string().url().max(500),
  custom_data: z
    .object({
      value: z.number().nonnegative().optional(),
      currency: z.string().length(3).optional(),
      content_name: z.string().max(200).optional(),
      content_category: z.string().max(200).optional(),
    })
    .partial()
    .optional(),
  user_data: z
    .object({
      phone: z.string().max(20).optional(),
      fbp: z.string().max(200).optional(),
      fbc: z.string().max(500).optional(),
    })
    .partial()
    .optional(),
  attribution: z
    .object({
      utm_source: z.string().max(200).optional(),
      utm_medium: z.string().max(200).optional(),
      utm_campaign: z.string().max(200).optional(),
      utm_content: z.string().max(200).optional(),
      utm_term: z.string().max(200).optional(),
      fbclid: z.string().max(500).optional(),
    })
    .partial()
    .optional(),
});

function sha256Lower(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

/** Normaliza o telefone para E.164 sem "+" (padrão exigido pela Meta: código
 * do país + DDD + número) antes de fazer o hash. */
function hashPhone(rawPhone: string): string | undefined {
  const digits = rawPhone.replace(/\D/g, "");
  if (digits.length < 10) return undefined;
  const withCountryCode = digits.startsWith("55") ? digits : `55${digits}`;
  return sha256Lower(withCountryCode);
}

function getMetaPixelId(): string | undefined {
  return import.meta.env.VITE_META_PIXEL_ID || process.env.META_PIXEL_ID;
}

export const trackConversionEvent = createServerFn({ method: "POST" })
  .inputValidator((d) => inputSchema.parse(d))
  .handler(async ({ data }) => {
    const pixelId = getMetaPixelId();
    const accessToken = process.env.META_CAPI_TOKEN;

    if (!pixelId || !accessToken) {
      console.error(
        `[MetaCAPI] META_PIXEL_ID/META_CAPI_TOKEN não configurados - evento "${data.event_name}" não enviado.`,
      );
      return { ok: false as const };
    }

    const request = getRequest();
    const ip =
      request?.headers.get("cf-connecting-ip") ||
      request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      undefined;
    const userAgent = request?.headers.get("user-agent") || undefined;

    const userData: Record<string, unknown> = {};
    if (ip) userData.client_ip_address = ip;
    if (userAgent) userData.client_user_agent = userAgent;
    if (data.user_data?.fbp) userData.fbp = data.user_data.fbp;
    if (data.user_data?.fbc) userData.fbc = data.user_data.fbc;
    if (data.user_data?.phone) {
      const ph = hashPhone(data.user_data.phone);
      if (ph) userData.ph = [ph];
    }

    const customData: Record<string, unknown> = { ...data.custom_data };
    if (data.attribution) {
      for (const [key, value] of Object.entries(data.attribution)) {
        if (value) customData[key] = value;
      }
    }

    const payload = {
      data: [
        {
          event_name: data.event_name,
          event_time: Math.floor(Date.now() / 1000),
          event_id: data.event_id,
          event_source_url: data.event_source_url,
          action_source: "website",
          user_data: userData,
          custom_data: customData,
        },
      ],
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        console.error(`[MetaCAPI] Erro ao enviar "${data.event_name}":`, await res.text());
        return { ok: false as const };
      }
    } catch (err) {
      console.error(`[MetaCAPI] Falha de rede ao enviar "${data.event_name}":`, err);
      return { ok: false as const };
    }

    return { ok: true as const };
  });
