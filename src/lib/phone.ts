// Formatação e utilidades para números de WhatsApp (Brasil).

export function onlyDigits(v: string): string {
  return (v ?? "").replace(/\D+/g, "");
}

/**
 * Retorna o número em formato E.164 sem "+": 55DDDNNNNNNNNN.
 * Aceita entradas com máscara ou já limpas.
 */
export function toE164BR(v: string): string {
  let d = onlyDigits(v);
  if (d.length === 0) return "";
  if (!d.startsWith("55")) d = "55" + d;
  return d;
}

/**
 * Formata para exibição pt-BR: +55 (31) 9 9999-9999.
 * Aceita 10 (fixo) ou 11 (celular) dígitos, com ou sem DDI.
 */
export function formatPhoneBR(v: string): string {
  const d = onlyDigits(v);
  // Remove DDI 55 se veio junto
  const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  const ddd = local.slice(0, 2);
  const rest = local.slice(2);

  if (local.length === 0) return "";
  if (local.length <= 2) return `(${ddd}`;
  if (rest.length <= 4) return `+55 (${ddd}) ${rest}`;
  if (rest.length <= 8) return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  // 9 dígitos (celular): 9 XXXX-XXXX
  return `+55 (${ddd}) ${rest.slice(0, 1)} ${rest.slice(1, 5)}-${rest.slice(5, 9)}`;
}

/** Máscara para input controlado — sempre exibe o formato acima. */
export function maskPhoneInput(v: string): string {
  return formatPhoneBR(v);
}

/** True se o número tem tamanho válido (10 ou 11 dígitos locais). */
export function isValidPhoneBR(v: string): boolean {
  const d = onlyDigits(v);
  const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  return local.length === 10 || local.length === 11;
}