// Captura e persiste parâmetros de atribuição de campanha (UTM + fbclid) para
// que a Conversions API consiga atribuir corretamente qual anúncio gerou a reserva.

const STORAGE_KEY = "mambaia_attribution";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const TRACKED_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const;

export type Attribution = Partial<Record<(typeof TRACKED_PARAMS)[number], string>>;

type StoredAttribution = {
  data: Attribution;
  ts: number;
};

/** Lê a query string atual e, se houver algum parâmetro rastreado, atualiza o
 * armazenamento local com um novo prazo de 7 dias. Chamado a cada navegação. */
export function captureAttributionFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const found: Attribution = {};
  let hasAny = false;
  for (const key of TRACKED_PARAMS) {
    const v = params.get(key);
    if (v) {
      found[key] = v;
      hasAny = true;
    }
  }
  if (!hasAny) return;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ data: found, ts: Date.now() } satisfies StoredAttribution),
    );
  } catch {
    /* ignora falhas de storage (modo privado etc.) */
  }
}

/** Retorna a atribuição salva, se ainda estiver dentro da janela de 7 dias. */
export function getStoredAttribution(): Attribution | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAttribution;
    if (!parsed?.data || typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

/** Cookies que o próprio Pixel do Meta cria no navegador (_fbp/_fbc), usados
 * para "advanced matching" na Conversions API. Se o clique veio de um anúncio
 * (fbclid na URL) mas o cookie _fbc ainda não existe, construímos o valor
 * manualmente seguindo o formato oficial da Meta: fb.1.<timestamp>.<fbclid>. */
export function getFbCookies(fbclid?: string): { fbp?: string; fbc?: string } {
  const fbp = readCookie("_fbp");
  let fbc = readCookie("_fbc");
  if (!fbc && fbclid) {
    fbc = `fb.1.${Date.now()}.${fbclid}`;
  }
  return { fbp, fbc };
}
