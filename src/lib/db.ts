import { supabase } from "@/integrations/supabase/client";

export type Socio = {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
};

export type Categoria = {
  id: string;
  nome: string;
  tipo: "despesa" | "receita";
  icone: string;
  cor: string;
};

export type Transacao = {
  id: string;
  tipo: "despesa" | "receita";
  valor: number; // numeric do PG vem como string ou number; normalizamos
  data: string;
  descricao: string;
  observacoes: string | null;
  categoria_id: string | null;
  socio_id: string | null;
  empresa: string | null;
  origem: string;
  acertada: boolean;
  acerto_id: string | null;
  created_at: string;
};

export type Acerto = {
  id: string;
  data: string;
  de_socio_id: string;
  para_socio_id: string;
  valor: number;
  observacoes: string | null;
  created_at: string;
};

export type GastoFixo = {
  id: string;
  nome: string;
  valor: number;
  dia_mes: number;
  categoria_id: string | null;
  socio_padrao_id: string | null;
  ativo: boolean;
  empresa: string | null;
};

const num = (v: unknown): number => (typeof v === "string" ? parseFloat(v) : (v as number));

export async function fetchSocios(): Promise<Socio[]> {
  const { data, error } = await supabase.from("socios").select("*").order("ordem");
  if (error) throw error;
  return (data ?? []) as Socio[];
}

export async function fetchCategorias(): Promise<Categoria[]> {
  const { data, error } = await supabase.from("categorias").select("*").order("nome");
  if (error) throw error;
  return (data ?? []) as Categoria[];
}

export async function fetchTransacoes(): Promise<Transacao[]> {
  const { data, error } = await supabase
    .from("transacoes")
    .select("*")
    .order("data", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Transacao[]).map((t) => ({ ...t, valor: num(t.valor) }));
}

export async function fetchAcertos(): Promise<Acerto[]> {
  const { data, error } = await supabase
    .from("acertos")
    .select("*")
    .order("data", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Acerto[]).map((a) => ({ ...a, valor: num(a.valor) }));
}

export async function fetchGastosFixos(): Promise<GastoFixo[]> {
  const { data, error } = await supabase.from("gastos_fixos").select("*").order("nome");
  if (error) throw error;
  return ((data ?? []) as GastoFixo[]).map((g) => ({ ...g, valor: num(g.valor) }));
}