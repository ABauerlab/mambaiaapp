/**
 * Utilitários monetários - todos os cálculos em CENTAVOS (inteiros)
 * para evitar erros de ponto flutuante. Conversão apenas na borda.
 */

export const toCents = (reais: number | string): number => {
  const n = typeof reais === "string" ? Number(reais.replace(",", ".")) : reais;
  if (!Number.isFinite(n)) throw new Error("Valor inválido");
  return Math.round(n * 100);
};

export const fromCents = (cents: number): number => cents / 100;

export const formatBRL = (reais: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(reais);

export const formatBRLCents = (cents: number): string => formatBRL(fromCents(cents));

/**
 * Divide um valor (em centavos) entre N pessoas garantindo que a soma
 * das partes seja EXATAMENTE igual ao total. O resto em centavos é
 * absorvido pelo primeiro pagador (índice 0 da lista de "outros").
 * Retorna a parte que cada pessoa (que NÃO pagou) deve.
 */
export const splitEqually = (
  totalCents: number,
  numberOfPeople: number,
): { each: number; remainder: number } => {
  if (numberOfPeople <= 0) throw new Error("Número de pessoas inválido");
  if (!Number.isInteger(totalCents)) throw new Error("totalCents deve ser inteiro");
  const each = Math.floor(totalCents / numberOfPeople);
  const remainder = totalCents - each * numberOfPeople;
  return { each, remainder };
};

/**
 * Para um gasto pago por UMA pessoa e dividido por TODAS:
 * - Cada um dos OUTROS deve `each` centavos ao pagador.
 * - O pagador absorve o resto (sobra de centavos) na sua própria parte.
 * Retorna o valor que cada outro sócio deve ao pagador.
 * GARANTE: pagador.parte + (N-1) * each === totalCents.
 */
export const splitForPayer = (
  totalCents: number,
  numberOfPeople: number,
): { eachOwes: number; payerShare: number } => {
  const { each, remainder } = splitEqually(totalCents, numberOfPeople);
  const eachOwes = each;
  const payerShare = each + remainder;
  // sanity check
  const sum = payerShare + eachOwes * (numberOfPeople - 1);
  if (sum !== totalCents) {
    throw new Error(`Erro de cálculo: soma ${sum} != total ${totalCents}`);
  }
  return { eachOwes, payerShare };
};

// Self-tests (executados no carregamento do módulo em dev)
if (import.meta.env?.DEV) {
  const test = (totalCents: number, n: number) => {
    const { eachOwes, payerShare } = splitForPayer(totalCents, n);
    const sum = payerShare + eachOwes * (n - 1);
    console.assert(sum === totalCents, `splitForPayer failed for ${totalCents}/${n}: ${sum}`);
  };
  test(10000, 3); // R$ 100 / 3
  test(10001, 3); // R$ 100,01 / 3
  test(10002, 3);
  test(1, 3);
  test(99, 3);
}