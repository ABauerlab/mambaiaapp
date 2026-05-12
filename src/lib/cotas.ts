/**
 * Sistema de cotas da Mambaia.
 *
 * Regra fixa de divisao de gastos e ganhos:
 *   - Kodara:  2/6 (~33,33%)
 *   - Eduardo: 2/6 (~33,33%)
 *   - Joao:    1/6 (~16,67%)
 *   - Laura:   1/6 (~16,67%)
 *
 * Socio identificado pelo `nome` (case-insensitive, primeiro nome basta).
 * Toda a aritmetica e feita em CENTAVOS (inteiros). A sobra de
 * arredondamento sempre vai para Kodara primeiro (a maior cotista) - assim
 * a soma das partes e matematicamente igual ao total, sem perder 1 centavo.
 */

export type SocioBasic = { id: string; nome: string };

/** Pesos relativos sobre 6. Total = 6. */
export const PESOS_BASE: Record<string, number> = {
  kodara: 2,
  eduardo: 2,
  joao: 1,
  laura: 1,
};

const ORDEM_PRIORIDADE_SOBRA = ["kodara", "eduardo", "joao", "laura"];

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function chave(nome: string): string {
  return semAcento(nome.trim().toLowerCase()).split(/\s+/)[0];
}

/** Retorna o peso (0 se o socio nao for cotista). */
export function pesoDoSocio(nome: string): number {
  return PESOS_BASE[chave(nome)] ?? 0;
}

/**
 * Divide `totalCents` entre os socios cotistas conforme cota.
 * Retorna Map<socio_id, cents>. Soma garantida == totalCents.
 */
export function splitByCota(
  totalCents: number,
  socios: SocioBasic[],
  participantesIds?: string[],
): Map<string, number> {
  if (!Number.isInteger(totalCents)) {
    throw new Error("totalCents deve ser inteiro (centavos)");
  }
  const result = new Map<string, number>();
  socios.forEach((s) => result.set(s.id, 0));
  // Se foi passado um subset de participantes, usar divisão IGUAL.
  // Caso contrário (ou se todos os 4 cotistas estão presentes), usar pesos.
  const todosCotistasIds = socios.filter((s) => pesoDoSocio(s.nome) > 0).map((s) => s.id);
  const usarSubset =
    Array.isArray(participantesIds) &&
    participantesIds.length > 0 &&
    !(participantesIds.length === todosCotistasIds.length &&
      todosCotistasIds.every((id) => participantesIds.includes(id)));

  if (usarSubset) {
    const ativos = socios.filter((s) => participantesIds!.includes(s.id));
    if (ativos.length === 0) return result;
    const base = Math.floor(totalCents / ativos.length);
    let sobra = totalCents - base * ativos.length;
    for (const s of ativos) {
      let parte = base;
      if (sobra > 0) { parte += 1; sobra -= 1; }
      result.set(s.id, parte);
    }
    return result;
  }

  const cotistas = socios.filter((s) => pesoDoSocio(s.nome) > 0);
  if (cotistas.length === 0) return result;

  const totalPesos = cotistas.reduce((sum, s) => sum + pesoDoSocio(s.nome), 0);
  let alocado = 0;
  for (const s of cotistas) {
    const parte = Math.floor((totalCents * pesoDoSocio(s.nome)) / totalPesos);
    result.set(s.id, parte);
    alocado += parte;
  }
  let sobra = totalCents - alocado;
  if (sobra !== 0) {
    const ordenados = [...cotistas].sort((a, b) => {
      const ia = ORDEM_PRIORIDADE_SOBRA.indexOf(chave(a.nome));
      const ib = ORDEM_PRIORIDADE_SOBRA.indexOf(chave(b.nome));
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    let i = 0;
    while (sobra > 0) {
      const s = ordenados[i % ordenados.length];
      result.set(s.id, (result.get(s.id) ?? 0) + 1);
      sobra--;
      i++;
    }
  }
  return result;
}

/** Mambaia (caixa coletivo) nao e socio - e uma entidade virtual nos saldos. */
export const MAMBAIA_CAIXA_ID = "__mambaia_caixa__";

if (import.meta.env?.DEV) {
  const test = (cents: number) => {
    const fake: SocioBasic[] = [
      { id: "k", nome: "Kodara" },
      { id: "e", nome: "Eduardo" },
      { id: "j", nome: "Joao Victor" },
      { id: "l", nome: "Laura Ottoni" },
    ];
    const r = splitByCota(cents, fake);
    const sum = (r.get("k") ?? 0) + (r.get("e") ?? 0) + (r.get("j") ?? 0) + (r.get("l") ?? 0);
    console.assert(sum === cents, "splitByCota " + cents + " soma " + sum);
  };
  test(10000); test(10001); test(99); test(1); test(123456); test(7);
  // subset igual
  const fake2: SocioBasic[] = [
    { id: "k", nome: "Kodara" }, { id: "e", nome: "Eduardo" },
    { id: "j", nome: "Joao Victor" }, { id: "l", nome: "Laura Ottoni" },
  ];
  const r2 = splitByCota(100, fake2, ["e", "j"]);
  console.assert((r2.get("e") ?? 0) === 50 && (r2.get("j") ?? 0) === 50, "subset igual");
}
