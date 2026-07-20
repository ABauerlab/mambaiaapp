// Cross-platform helper to open Google Maps in the native app when possible
// and fall back to a web URL in every other case. Web-only project, but the
// util keeps the same shape a React Native implementation would use.

export type OpenMapsOptions = {
  lat?: number;
  lng?: number;
  query?: string;      // free-text address or place name
  placeId?: string;    // Google Place ID (preferred when available)
  reviewUrl?: string;  // pre-built https://g.page/... review URL
  label?: string;
};

function webUrl(o: OpenMapsOptions): string {
  if (o.reviewUrl) return o.reviewUrl;
  if (o.placeId) {
    return `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(o.placeId)}`;
  }
  const q = o.query ?? (o.lat != null && o.lng != null ? `${o.lat},${o.lng}` : "");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function detect(): { ios: boolean; android: boolean; mobile: boolean } {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const ios = /iPhone|iPad|iPod/i.test(ua);
  const android = /Android/i.test(ua);
  return { ios, android, mobile: ios || android };
}

/**
 * Try to open the native Google Maps app; fall back to the web URL.
 * Returns the URL that was ultimately used so callers can show feedback.
 */
export function openMaps(opts: OpenMapsOptions): string {
  const url = webUrl(opts);
  if (typeof window === "undefined") return url;

  const { ios, android, mobile } = detect();
  if (!mobile) {
    window.open(url, "_blank", "noopener,noreferrer");
    return url;
  }

  // Build the deep-link. Prefer review URL (g.page short link handles both apps).
  if (opts.reviewUrl) {
    if (android) {
      const intent = `intent://${opts.reviewUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.google.android.apps.maps;end`;
      window.location.href = intent;
      // Safety fallback: some Android browsers ignore intent:// silently.
      window.setTimeout(() => { window.location.href = url; }, 1500);
      return url;
    }
    // iOS + others: just open the review URL. Google Maps app usually
    // intercepts g.page links when installed; otherwise Safari handles it.
    window.location.href = opts.reviewUrl;
    return url;
  }

  const q = opts.query ?? (opts.lat != null && opts.lng != null ? `${opts.lat},${opts.lng}` : "");
  if (ios) {
    // Try Google Maps app first, fall back to web (Apple Maps opens web too).
    const app = `comgooglemaps://?q=${encodeURIComponent(q)}`;
    const start = Date.now();
    const fallback = window.setTimeout(() => {
      if (Date.now() - start < 2500) window.location.href = url;
    }, 900);
    try {
      window.location.href = app;
    } catch {
      window.clearTimeout(fallback);
      window.location.href = url;
    }
    return url;
  }

  // Android generic
  const intent = `intent://maps.google.com/maps?q=${encodeURIComponent(q)}#Intent;scheme=https;package=com.google.android.apps.maps;end`;
  window.location.href = intent;
  window.setTimeout(() => { window.location.href = url; }, 1500);
  return url;
}
