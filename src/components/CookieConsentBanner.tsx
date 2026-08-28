import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { getStoredConsent, setStoredConsent, type CookieConsent } from "@/lib/cookie-consent";

/** Banner simples de consentimento (LGPD): só aparece enquanto o visitante
 * ainda não escolheu, e é a porta de entrada para carregar o Meta Pixel -
 * sem "Aceitar", nenhum script de terceiros/cookie de marketing é carregado. */
export function CookieConsentBanner() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConsent(getStoredConsent());
  }, []);

  if (!mounted || consent !== null) return null;

  const decide = (value: CookieConsent) => {
    setStoredConsent(value);
    setConsent(value);
  };

  return (
    <div
      role="dialog"
      aria-label="Consentimento de cookies"
      className="fixed inset-x-0 bottom-0 z-[100] p-4 md:p-5"
    >
      <div className="mx-auto max-w-3xl rounded-2xl bg-[#0D2E24] text-white shadow-2xl border border-white/10 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid place-items-center w-9 h-9 rounded-lg bg-[#E5C72A] text-[#0D2E24] shrink-0">
            <Cookie className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <h2 className="font-semibold text-sm md:text-base">Usamos cookies</h2>
            <p className="mt-1 text-xs md:text-sm text-white/75 leading-relaxed">
              Usamos cookies para melhorar sua experiência no site e medir o desempenho dos nossos
              anúncios. Você pode aceitar ou recusar os cookies de marketing a qualquer momento.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => decide("rejected")}
            className="order-2 sm:order-1 rounded-lg border border-white/20 text-white px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => decide("accepted")}
            className="order-1 sm:order-2 rounded-lg bg-[#E5C72A] text-[#0D2E24] px-5 py-2.5 text-sm font-semibold hover:brightness-95 transition"
          >
            Aceitar cookies
          </button>
        </div>
      </div>
    </div>
  );
}
