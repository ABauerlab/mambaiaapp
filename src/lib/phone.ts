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
  // Remove DDI 55 se veio junto (e o número for maior que o padrão local)
  const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (local.length === 10) {
    // Fixo: (DDD) NNNN-NNNN
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  if (local.length === 11) {
    // Celular: (DDD) 9 NNNN-NNNN
    return `(${local.slice(0, 2)}) ${local.slice(2, 3)} ${local.slice(3, 7)}-${local.slice(7)}`;
  }
  // Incompleto: devolve apenas os dígitos digitados, sem máscara.
  return local;
}

/**
 * Máscara para input controlado - enquanto o usuário digita, mantemos apenas
 * os dígitos. Só formatamos quando o número está completo (10 ou 11 dígitos).
 */
export function maskPhoneInput(v: string): string {
  const d = onlyDigits(v);
  const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  // Limita a 11 dígitos (celular BR com 9 na frente).
  const trimmed = local.slice(0, 11);
  if (trimmed.length === 10 || trimmed.length === 11) return formatPhoneBR(trimmed);
  return trimmed;
}

/** True se o número tem tamanho válido (10 ou 11 dígitos locais). */
export function isValidPhoneBR(v: string): boolean {
  const d = onlyDigits(v);
  const local = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  return local.length === 10 || local.length === 11;
}
