/**
 * Saldos da Mambaia (caixa coletivo) e dos socios cotistas.
 *
 * Modelo:
 *   - Toda transacao e da Mambaia.
 *   - DESPESA paga por socio: ele credita "valor"; cada cotista debita sua cota.
 *   - DESPESA paga pela Mambaia (caixa): cada cotista debita sua cota; o caixa
 *     credita o total (ja saiu).
 *   - RECEITA recebida pela Mambaia: cada cotista credita sua cota; o caixa
 *     debita o total (precisa repassar).
 *   - RECEITA recebida por socio: ele debita "valor"; cada cotista credita cota.
 *   - ACERTOS: pagador credita, recebedor debita.
 *
 * Saldo positivo = a receber. Negativo = a pagar.
 * Soma de todos os saldos == 0.
 */

import { splitByCota, MAMBAIA_CAIXA_ID, type SocioBasic } from "./cotas";
import { toCents } from "./money";

export type Socio = { id: string; nome: string; cor: string };

export type TransacaoAberta = {
  id: string;
  tipo: "despesa" | "receita";
  valor_cents: number;
  socio_id: string | null;
};

export type AcertoRegistro = {
  de_socio_id: string;
  para_socio_id: string;
  valor_cents: number;
};

export function computeNetBalances(
  socios: Socio[],
  transacoes: TransacaoAberta[],
  acertos: AcertoRegistro[] = [],
): Map<string, number> {
  const balances = new Map<string, number>();
  socios.forEach((s) => balances.set(s.id, 0));
  balances.set(MAMBAIA_CAIXA_ID, 0);

  const basics: SocioBasic[] = socios.map((s) => ({ id: s.id, nome: s.nome }));

  for (const t of transacoes) {
    const cotas = splitByCota(t.valor_cents, basics);
    if (t.tipo === "despesa") {
      for (const [id, c] of cotas) balances.set(id, (balances.get(id) ?? 0) - c);
      const pagadorId = t.socio_id ?? MAMBAIA_CAIXA_ID;
      balances.set(pagadorId, (balances.get(pagadorId) ?? 0) + t.valor_cents);
    } else {
      for (const [id, c] of cotas) balances.set(id, (balances.get(id) ?? 0) + c);
      const recebedorId = t.socio_id ?? MAMBAIA_CAIXA_ID;
      balances.set(recebedorId, (balances.get(recebedorId) ?? 0) - t.valor_cents);
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

  let sum = 0;
  balances.forEach((v) => (sum += v));
  if (sum !== 0) console.error("Soma dos saldos != 0:", sum, balances);

  return balances;
}

export type Sugestao = { de: string; para: string; valor_cents: number };

export function sugerirAcertos(balances: Map<string, number>): Sugestao[] {
  const arr = Array.from(balances.entries()).map(([id, v]) => ({ id, v }));
  const credores = arr.filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const devedores = arr.filter((x) => x.v < 0).sort((a, b) => a.v - b.v);

  const sugs: Sugestao[] = [];
  let i = 0, j = 0;
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
}

export function transacoesAbertasParaBalance(
  transacoes: { id: string; tipo: "despesa" | "receita"; valor: number; socio_id: string | null; acertada: boolean }[],
): TransacaoAberta[] {
  return transacoes
    .filter((t) => !t.acertada)
    .map((t) => ({ id: t.id, tipo: t.tipo, valor_cents: toCents(t.valor), socio_id: t.socio_id }));
}

export { MAMBAIA_CAIXA_ID };
