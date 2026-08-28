import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getStoredConsent } from "@/lib/cookie-consent";
import { getStoredAttribution, getFbCookies } from "@/lib/attribution";
import { trackConversionEvent } from "@/lib/meta-tracking.functions";

export type MetaEventName =
  "PageView" | "ViewContent" | "Lead" | "InitiateCheckout" | "Purchase" | "Schedule";

export type MetaCustomData = {
  value?: number;
  currency?: string;
  content_name?: string;
  content_category?: string;
};

export type MetaUserData = {
  /** WhatsApp/telefone do cliente, em qualquer formato - é normalizado e
   * hasheado (SHA-256) no servidor antes de ir para a Meta. */
  phone?: string;
};

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
    _fbq?: unknown;
  }
}

/** Carrega a lib oficial do Pixel (fbevents.js) sob demanda - só é chamada
 * depois que o visitante aceita cookies, atendendo ao requisito de LGPD de
 * não carregar o script antes do consentimento. */
type Fbq = ((...args: unknown[]) => void) & {
  queue: unknown[];
  loaded?: boolean;
  callMethod?: (...args: unknown[]) => void;
};

export function loadPixelScript(): void {
  if (typeof window === "undefined" || window.fbq) return;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.loaded = true;
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
}

function generateEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function toFbqCustomData(customData?: MetaCustomData): Record<string, unknown> {
  if (!customData) return {};
  const out: Record<string, unknown> = {};
  if (customData.value !== undefined) out.value = customData.value;
  if (customData.currency) out.currency = customData.currency;
  if (customData.content_name) out.content_name = customData.content_name;
  if (customData.content_category) out.content_category = customData.content_category;
  return out;
}

/** Hook central de tracking: dispara o Pixel no navegador e a Conversions
 * API no servidor com o MESMO event_id, para a Meta deduplicar os dois
 * envios do mesmo evento (conforme a documentação oficial de dedup). */
export function useMetaTracking() {
  const sendServerEvent = useServerFn(trackConversionEvent);

  const trackEvent = useCallback(
    (eventName: MetaEventName, customData?: MetaCustomData, userData?: MetaUserData) => {
      if (typeof window === "undefined") return;
      if (getStoredConsent() !== "accepted") return;

      const eventId = generateEventId();
      const eventSourceUrl = window.location.href;

      if (window.fbq) {
        window.fbq("track", eventName, toFbqCustomData(customData), { eventID: eventId });
      }

      const attribution = getStoredAttribution() ?? undefined;
      const { fbp, fbc } = getFbCookies(attribution?.fbclid);

      sendServerEvent({
        data: {
          event_name: eventName,
          event_id: eventId,
          event_source_url: eventSourceUrl,
          custom_data: customData,
          user_data: { phone: userData?.phone, fbp, fbc },
          attribution,
        },
      }).catch(() => {
        /* nunca deve quebrar a UX por causa de tracking */
      });
    },
    [sendServerEvent],
  );

  return { trackEvent };
}
