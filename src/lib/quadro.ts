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
  responsavel_id: string | null;
  empresa: string | null;
  tags: string[];
  prazo: string | null;
  ordem: number;
  created_at: string;
  updated_at: string;
};

export async function fetchQuadroItens(): Promise<QuadroItem[]> {
  const { data, error } = await supabase
    .from("quadro_itens")
    .select("*")
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as QuadroItem[];
}

export async function createQuadroItem(input: Omit<QuadroItem, "id" | "created_at" | "updated_at" | "ordem"> & { ordem?: number }) {
  const { error } = await supabase.from("quadro_itens").insert(input);
  if (error) throw error;
}

export async function updateQuadroItem(id: string, patch: Partial<QuadroItem>) {
  const { error } = await supabase.from("quadro_itens").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteQuadroItem(id: string) {
  const { error } = await supabase.from("quadro_itens").delete().eq("id", id);
  if (error) throw error;
}
