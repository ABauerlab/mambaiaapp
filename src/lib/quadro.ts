import { supabase } from "@/integrations/supabase/client";

export type QuadroTipo = "ideia" | "tarefa" | "demanda";
export type QuadroStatus = "aberto" | "em_andamento" | "concluido" | "arquivado";
export type QuadroPrioridade = "baixa" | "media" | "alta";

export type QuadroItem = {
  id: string;
  tipo: QuadroTipo;
  titulo: string;
  descricao: string | null;
  status: QuadroStatus;
  prioridade: QuadroPrioridade;
  responsavel_id: string | null; // legado
  responsavel_ids: string[];
  empresa: string | null;
  tags: string[];
  prazo: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export const EMPRESAS = ["Mambaia", "Asari", "BauerLab", "Kriya"] as const;

export async function fetchQuadroItens(): Promise<QuadroItem[]> {
  const { data, error } = await supabase
    .from("quadro_itens")
    .select("*")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as QuadroItem[]).map((i) => ({
    ...i,
    responsavel_ids: i.responsavel_ids ?? (i.responsavel_id ? [i.responsavel_id] : []),
  }));
}

export async function createQuadroItem(input: Partial<QuadroItem>) {
  const { error } = await supabase.from("quadro_itens").insert(input as never);
  if (error) throw error;
}

export async function updateQuadroItem(id: string, patch: Partial<QuadroItem>) {
  const { error } = await supabase.from("quadro_itens").update(patch as never).eq("id", id);
  if (error) throw error;
}

export async function deleteQuadroItem(id: string) {
  const { error } = await supabase.from("quadro_itens").delete().eq("id", id);
  if (error) throw error;
}
