import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Lightbulb, CheckSquare, Inbox, Plus, Pencil, Trash2, Archive, Calendar as CalIcon, Search } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { notifyImmediate } from "@/lib/push.functions";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchSocios } from "@/lib/db";
import {
  fetchQuadroItens,
  createQuadroItem,
  updateQuadroItem,
  deleteQuadroItem,
  EMPRESAS,
  type QuadroItem,
  type QuadroStatus,
  type QuadroTipo,
  type QuadroPrioridade,
} from "@/lib/quadro";
import { friendlyErrorMessage } from "@/lib/utils";

const TIPOS: { value: QuadroTipo; label: string; icon: typeof Lightbulb; color: string }[] = [
  { value: "ideia", label: "Ideia", icon: Lightbulb, color: "var(--brand-lime)" },
  { value: "tarefa", label: "Tarefa", icon: CheckSquare, color: "var(--brand-green)" },
  { value: "demanda", label: "Demanda", icon: Inbox, color: "var(--brand-dark)" },
];

const COLUNAS: { status: QuadroStatus; label: string }[] = [
  { status: "aberto", label: "Aberto" },
  { status: "em_andamento", label: "Em andamento" },
  { status: "concluido", label: "Concluído" },
];

const PRIO_COLOR: Record<QuadroPrioridade, string> = {
  baixa: "bg-muted text-muted-foreground",
  media: "bg-[color:var(--brand-lime)]/20 text-foreground",
  alta: "bg-destructive/15 text-destructive",
};

type FormState = {
  id?: string;
  tipo: QuadroTipo;
  titulo: string;
  descricao: string;
  status: QuadroStatus;
  prioridade: QuadroPrioridade;
  responsavel_ids: string[];
  empresa: string;
  prazo: string;
  tags: string;
};

const emptyForm: FormState = {
  tipo: "ideia",
  titulo: "",
  descricao: "",
  status: "aberto",
  prioridade: "media",
  responsavel_ids: [],
  empresa: "",
  prazo: "",
  tags: "",
};

export function Quadro() {
  const qc = useQueryClient();
  const { data: itens, isLoading } = useQuery({ queryKey: ["quadro_itens"], queryFn: fetchQuadroItens });
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });
  useRealtimeInvalidate("quadro_itens", ["quadro_itens"]);

  const [tab, setTab] = useState<"ativos" | "arquivados">("ativos");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | QuadroTipo>("todos");
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; mode: "create" | "edit"; data: FormState }>({
    open: false,
    mode: "create",
    data: emptyForm,
  });

  const filtrados = useMemo(() => {
    if (!itens) return [];
    return itens.filter((i) => {
      const arquivado = i.status === "arquivado";
      if (tab === "ativos" && arquivado) return false;
      if (tab === "arquivados" && !arquivado) return false;
      if (filtroTipo !== "todos" && i.tipo !== filtroTipo) return false;
      if (filtroEmpresa !== "todas" && (i.empresa ?? "") !== filtroEmpresa) return false;
      if (busca && !`${i.titulo} ${i.descricao ?? ""} ${i.tags.join(" ")}`.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [itens, tab, filtroTipo, filtroEmpresa, busca]);

  const porColuna = (status: QuadroStatus) => filtrados.filter((i) => i.status === status);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const notify = useServerFn(notifyImmediate);

  const moverStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: QuadroStatus }) => updateQuadroItem(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quadro_itens"] }),
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  function handleDragEnd(e: DragEndEvent) {
    const id = String(e.active.id);
    const overId = e.over?.id;
    if (!overId) return;
    const novoStatus = String(overId) as QuadroStatus;
    const item = itens?.find((i) => i.id === id);
    if (!item || item.status === novoStatus) return;
    moverStatus.mutate({ id, status: novoStatus });
  }

  const salvar = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        tipo: f.tipo,
        titulo: f.titulo.trim(),
        descricao: f.descricao.trim() || null,
        status: f.status,
        prioridade: f.prioridade,
        responsavel_id: f.responsavel_ids[0] ?? null,
        responsavel_ids: f.responsavel_ids,
        empresa: f.empresa || null,
        prazo: f.prazo || null,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (!payload.titulo) throw new Error("Título é obrigatório");
      if (f.id) await updateQuadroItem(f.id, payload);
      else await createQuadroItem(payload);
      const today = new Date().toISOString().slice(0, 10);
      if (!f.id && payload.prazo === today) {
        void notify({ data: {
          title: "Tarefa para hoje",
          body: payload.titulo,
          url: "/quadro",
        }}).catch(() => {});
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quadro_itens"] });
      setDialog({ open: false, mode: "create", data: emptyForm });
      toast.success("Salvo!");
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => deleteQuadroItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quadro_itens"] });
      setDialog({ open: false, mode: "create", data: emptyForm });
      toast.success("Excluído");
    },
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  function abrirEdicao(item: QuadroItem) {
    setDialog({
      open: true,
      mode: "edit",
      data: {
        id: item.id,
        tipo: item.tipo,
        titulo: item.titulo,
        descricao: item.descricao ?? "",
        status: item.status,
        prioridade: item.prioridade,
        responsavel_ids: item.responsavel_ids ?? (item.responsavel_id ? [item.responsavel_id] : []),
        empresa: item.empresa ?? "",
        prazo: item.prazo ?? "",
        tags: item.tags.join(", "),
      },
    });
  }

  const quickUpdate = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<QuadroItem> }) => updateQuadroItem(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quadro_itens"] }),
    onError: (e) => toast.error(friendlyErrorMessage(e)),
  });

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
      <PageHeader
        title="Ideias, Tarefas & Demandas"
        description="Espaço criativo: anote tudo que pulsa por aqui."
        action={
          <Button onClick={() => setDialog({ open: true, mode: "create", data: emptyForm })}>
            <Plus className="w-4 h-4 mr-2" />
            Nova
          </Button>
        }
      />

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="ativos">Ativos</TabsTrigger>
            <TabsTrigger value="arquivados">Arquivados</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as empresas</SelectItem>
            {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar..." className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-lg" />)}
        </div>
      ) : tab === "arquivados" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {porColuna("arquivado").map((item) => (
            <ItemCard key={item.id} item={item} socios={socios ?? []} onClick={() => abrirEdicao(item)} onQuick={(patch) => quickUpdate.mutate({ id: item.id, patch })} />
          ))}
          {porColuna("arquivado").length === 0 && (
            <p className="text-muted-foreground text-sm col-span-full text-center py-12">Nenhum arquivado.</p>
          )}
        </div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid md:grid-cols-3 gap-4">
            {COLUNAS.map((col) => (
              <Coluna key={col.status} status={col.status} label={col.label} count={porColuna(col.status).length}>
                {porColuna(col.status).map((item) => (
                  <DraggableCard key={item.id} item={item} socios={socios ?? []} onClick={() => abrirEdicao(item)} onQuick={(patch) => quickUpdate.mutate({ id: item.id, patch })} />
                ))}
              </Coluna>
            ))}
          </div>
        </DndContext>
      )}

      <ItemDialog
        state={dialog}
        socios={socios ?? []}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onSave={(f) => salvar.mutate(f)}
        onDelete={(id) => excluir.mutate(id)}
        saving={salvar.isPending}
      />
    </div>
  );
}

function Coluna({ status, label, count, children }: { status: QuadroStatus; label: string; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-card p-3 min-h-[400px] transition ${isOver ? "ring-2 ring-primary bg-primary/5" : ""}`}
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="font-semibold text-sm">{label}</h3>
        <Badge variant="secondary">{count}</Badge>
      </div>
      {/* Mobile: horizontal carousel com snap. Desktop: stack vertical. */}
      <div className="md:hidden -mx-3 px-3 overflow-x-auto snap-x snap-mandatory flex gap-2 pb-1 scroll-smooth [&>*]:snap-start [&>*]:shrink-0 [&>*]:w-[85%]">
        {children}
      </div>
      <div className="hidden md:block space-y-2">{children}</div>
    </div>
  );
}

function DraggableCard({ item, socios, onClick, onQuick }: { item: QuadroItem; socios: { id: string; nome: string; cor: string }[]; onClick: () => void; onQuick: (patch: Partial<QuadroItem>) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-50" : ""}>
      {/* Drag handle só na barra superior; o resto do card aceita cliques. */}
      <ItemCard item={item} socios={socios} onClick={onClick} onQuick={onQuick} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}

function ItemCard({
  item, socios, onClick, onQuick, dragHandleProps,
}: {
  item: QuadroItem;
  socios: { id: string; nome: string; cor: string }[];
  onClick: () => void;
  onQuick: (patch: Partial<QuadroItem>) => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const tipo = TIPOS.find((t) => t.value === item.tipo)!;
  const Icon = tipo.icon;
  const respIds = item.responsavel_ids ?? (item.responsavel_id ? [item.responsavel_id] : []);
  const responsaveis = socios.filter((s) => respIds.includes(s.id));
  return (
    <Card
      className="p-3 hover:shadow-md transition border-l-4"
        style={{ borderLeftColor: `var(--brand-${item.tipo === "ideia" ? "lime" : item.tipo === "tarefa" ? "green" : "dark"})` as string }}
    >
      <div
        className="flex items-start justify-between gap-2 mb-1.5 -mx-1 -mt-1 px-1 pt-1 cursor-grab active:cursor-grabbing"
        {...(dragHandleProps ?? {})}
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="w-3.5 h-3.5" style={{ color: tipo.color }} />
          {tipo.label}
        </div>
        <Select
          value={item.prioridade}
          onValueChange={(v) => onQuick({ prioridade: v as QuadroPrioridade })}
        >
          <SelectTrigger
            className={`h-6 px-2 text-[11px] border-0 ${PRIO_COLOR[item.prioridade]}`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="baixa">baixa</SelectItem>
            <SelectItem value="media">média</SelectItem>
            <SelectItem value="alta">alta</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="text-left w-full"
      >
        <h4 className="font-medium text-sm leading-snug mb-1">{item.titulo}</h4>
        {item.descricao && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.descricao}</p>}
      </button>
      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
        {responsaveis.length === 0 ? (
          <span className="italic opacity-60">sem responsável</span>
        ) : responsaveis.length === socios.length ? (
          <span className="inline-flex items-center gap-1 font-medium">Todos</span>
        ) : (
          responsaveis.map((r) => (
            <span key={r.id} className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: r.cor }} />
              {r.nome.split(" ")[0]}
            </span>
          ))
        )}
        {item.empresa && <Badge variant="outline" className="text-[10px] py-0">{item.empresa}</Badge>}
        {item.prazo && (
          <span className="inline-flex items-center gap-1">
            <CalIcon className="w-3 h-3" />
            {new Date(item.prazo + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
          </span>
        )}
        {item.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px] py-0">#{t}</Badge>)}
      </div>
    </Card>
  );
}

function ItemDialog({
  state,
  socios,
  onClose,
  onSave,
  onDelete,
  saving,
}: {
  state: { open: boolean; mode: "create" | "edit"; data: FormState };
  socios: { id: string; nome: string }[];
  onClose: () => void;
  onSave: (f: FormState) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(state.data);
  // sync form when dialog opens or data changes
  useEffect(() => {
    if (state.open) setForm(state.data);
  }, [state.open, state.data]);

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{state.mode === "edit" ? "Editar item" : "Novo item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as QuadroTipo })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => setForm({ ...form, prioridade: v as QuadroPrioridade })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixa">Baixa</SelectItem>
                  <SelectItem value="media">Média</SelectItem>
                  <SelectItem value="alta">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Título</Label>
            <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} maxLength={200} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as QuadroStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável</Label>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, responsavel_ids: form.responsavel_ids.length === socios.length ? [] : socios.map((s) => s.id) })}
                  className={`px-2.5 py-1 text-xs rounded-full border ${form.responsavel_ids.length === socios.length && socios.length > 0 ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                >
                  Todos
                </button>
                {socios.map((s) => {
                  const sel = form.responsavel_ids.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        responsavel_ids: sel
                          ? form.responsavel_ids.filter((id) => id !== s.id)
                          : [...form.responsavel_ids, s.id],
                      })}
                      className={`px-2.5 py-1 text-xs rounded-full border ${sel ? "bg-primary text-primary-foreground border-primary" : "bg-background"}`}
                    >
                      {s.nome.split(" ")[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Empresa</Label>
              <Select value={form.empresa || "none"} onValueChange={(v) => setForm({ ...form, empresa: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-</SelectItem>
                  {EMPRESAS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prazo</Label>
              <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="urgente, evento, foto" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2 flex-row justify-between">
          <div>
            {state.mode === "edit" && form.id && (
              <>
                <Button variant="ghost" size="sm" onClick={() => { setForm({ ...form, status: "arquivado" }); onSave({ ...form, status: "arquivado" }); }}>
                  <Archive className="w-4 h-4 mr-1" /> Arquivar
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(form.id!)}>
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => onSave(form)} disabled={saving}>
              <Pencil className="w-4 h-4 mr-1" />
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
