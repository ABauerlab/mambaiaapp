import { toE164BR } from "./phone";

export const MAMBAIA_WHATSAPP = "553132232356";

/** Monta um link https://wa.me/... com mensagem já preenchida. */
export function buildWhatsAppUrl(phoneOrE164: string, message: string): string {
  const num = toE164BR(phoneOrE164) || phoneOrE164.replace(/\D/g, "");
  const target = num || MAMBAIA_WHATSAPP;
  const text = encodeURIComponent(message);
  return `https://wa.me/${target}?text=${text}`;
}

/** Link direto para a equipe da Mambaia com mensagem contextualizada. */
export function waMambaia(message: string): string {
  return buildWhatsAppUrl(MAMBAIA_WHATSAPP, message);
}
