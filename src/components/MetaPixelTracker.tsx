import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { getStoredConsent, COOKIE_CONSENT_EVENT, type CookieConsent } from "@/lib/cookie-consent";
import { captureAttributionFromUrl } from "@/lib/attribution";
import { loadPixelScript, useMetaTracking } from "@/lib/meta-tracking";

/** Componente "invisível": cuida do ciclo de vida do Meta Pixel no site
 * público - carrega o script só após consentimento, inicializa com o Pixel
 * ID e dispara PageView (client + Conversions API) a cada troca de rota do
 * client-side router, já que o TanStack Router não recarrega a página. */
export function MetaPixelTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [consent, setConsent] = useState<CookieConsent | null>(() => getStoredConsent());
  const [initialized, setInitialized] = useState(false);
  const { trackEvent } = useMetaTracking();

  useEffect(() => {
    const onChange = () => setConsent(getStoredConsent());
    window.addEventListener(COOKIE_CONSENT_EVENT, onChange);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onChange);
  }, []);

  useEffect(() => {
    if (consent !== "accepted" || initialized) return;
    const pixelId = import.meta.env.VITE_META_PIXEL_ID as string | undefined;
    if (!pixelId) {
      console.warn("[MetaPixel] VITE_META_PIXEL_ID não configurado - Pixel não inicializado.");
      return;
    }
    loadPixelScript();
    window.fbq?.("init", pixelId);
    setInitialized(true);
  }, [consent, initialized]);

  useEffect(() => {
    if (consent !== "accepted" || !initialized) return;
    captureAttributionFromUrl();
    trackEvent("PageView");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, consent, initialized]);

  return null;
}
