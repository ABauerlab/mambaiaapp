/**
 * Cálculo de saldos entre sócios (todos os valores em centavos).
 *
 * Algoritmo:
 * 1. Para cada despesa não acertada: o pagador credita (N-1)*each + remainder
 *    e cada outro sócio debita `each` centavos.
 * 2. Acertos manuais (transferências reais entre sócios) ajustam:
 *    - de_socio: crédito de `valor` (já pagou sua dívida)
 *    - para_socio: débito de `valor` (recebeu do outro)
 * 3. Saldo líquido de cada sócio = soma das movimentações.
 *    - Saldo positivo: outros devem para ele
 *    - Saldo negativo: ele deve para os outros
 * 4. Sugestão de transferências: algoritmo guloso minimizando número de pagamentos.
 */

import { splitForPayer } from "./money";

export type Socio = { id: string; nome: string; cor: string };

export type DespesaAberta = {
  id: string;
  valor_cents: number;
  socio_id: string; // pagador
};

export type AcertoRegistro = {
  de_socio_id: string;
  para_socio_id: string;
  valor_cents: number;
};

/** Saldo líquido por sócio (centavos). Positivo = a receber. */
export const computeNetBalances = (
  socios: Socio[],
  despesas: DespesaAberta[],
  acertos: AcertoRegistro[] = [],
): Map<string, number> => {
  const balances = new Map<string, number>();
  socios.forEach((s) => balances.set(s.id, 0));

  const N = socios.length;
  if (N === 0) return balances;

  for (const d of despesas) {
    if (!balances.has(d.socio_id)) continue;
    const { eachOwes, payerShare } = splitForPayer(d.valor_cents, N);
    // Pagador "adianta" o total e absorve sua parte
    balances.set(d.socio_id, (balances.get(d.socio_id) ?? 0) + (d.valor_cents - payerShare));
    // Cada outro deve eachOwes
    for (const s of socios) {
      if (s.id === d.socio_id) continue;
      balances.set(s.id, (balances.get(s.id) ?? 0) - eachOwes);
    }
  }

  for (const a of acertos) {
    if (balances.has(a.de_socio_id)) {
      balances.set(a.de_socio_id, (balances.get(a.de_socio_id) ?? 0) + a.valor_cents);
    }
    if (balances.has(a.para_socio_id)) {
      balances.set(a.para_socio_id, (balances.get(a.para_socio_id) ?? 0) - a.valor_cents);
    }
  }

  // Sanidade: soma dos saldos deve ser 0 (centavos exatos)
  let sum = 0;
  balances.forEach((v) => (sum += v));
  if (sum !== 0) {
    console.error("Soma dos saldos != 0:", sum, balances);
  }

  return balances;
};

export type Sugestao = { de: string; para: string; valor_cents: number };

/** Algoritmo guloso: maior devedor paga maior credor até zerar. */
export const sugerirAcertos = (balances: Map<string, number>): Sugestao[] => {
  const arr = Array.from(balances.entries()).map(([id, v]) => ({ id, v }));
  const credores = arr.filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const devedores = arr.filter((x) => x.v < 0).sort((a, b) => a.v - b.v);

  const sugs: Sugestao[] = [];
  let i = 0;
  let j = 0;
  while (i < devedores.length && j < credores.length) {
    const d = devedores[i];
    const c = credores[j];
    const valor = Math.min(-d.v, c.v);
    if (valor > 0) {
      sugs.push({ de: d.id, para: c.id, valor_cents: valor });
      d.v += valor;
      c.v -= valor;
    }
    if (d.v === 0) i++;
    if (c.v === 0) j++;
  }
  return sugs;
};