const STORAGE_KEY = "mambaia_cookie_consent";
export const COOKIE_CONSENT_EVENT = "mambaia:cookie-consent-changed";

export type CookieConsent = "accepted" | "rejected";

export function getStoredConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    return null;
  }
}

export function setStoredConsent(value: CookieConsent): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* localStorage indisponível (modo privado etc.) - segue sem persistir */
  }
  window.dispatchEvent(new Event(COOKIE_CONSENT_EVENT));
}
