import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchAcertos, fetchTransacoes, fetchSocios } from "@/lib/db";
import { MAMBAIA_CAIXA_ID } from "@/lib/balance";
import { formatBRL } from "@/lib/money";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { DateRangeFilter, defaultMonthRange, type DateRangeValue } from "@/components/DateRangeFilter";

type Linha = {
  id: string;
  data: string;
  tipo: "acerto" | "zeramento";
  texto: React.ReactNode;
  valor: number | null;
};

export function Auditoria() {
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });
  const { data: acertos } = useQuery({ queryKey: ["acertos"], queryFn: fetchAcertos });
  const { data: transacoes } = useQuery({ queryKey: ["transacoes"], queryFn: fetchTransacoes });
  const [range, setRange] = useState<DateRangeValue>(() => defaultMonthRange());

  const nomeDe = (id: string | null) => {
    if (!id || id === MAMBAIA_CAIXA_ID) return "Mambaia (caixa)";
    return socios?.find((s) => s.id === id)?.nome ?? "?";
  };

  const linhas: Linha[] = useMemo(() => {
    const out: Linha[] = [];
    for (const a of acertos ?? []) {
      out.push({
        id: "a-" + a.id, data: a.created_at, tipo: "acerto", valor: a.valor,
        texto: (
          <span><strong>{nomeDe(a.de_socio_id)}</strong> <ArrowRight className="inline w-3 h-3 mx-1" /> <strong>{nomeDe(a.para_socio_id)}</strong>{a.observacoes ? ` - ${a.observacoes}` : ""}</span>
        ),
      });
    }
    for (const t of transacoes ?? []) {
      if (!t.acertada) continue;
      out.push({
        id: "z-" + t.id, data: t.created_at, tipo: "zeramento", valor: t.valor,
        texto: <span><CheckCircle2 className="inline w-3 h-3 mr-1 text-[color:var(--success)]" />Transacao {t.descricao} movida ao balanco geral</span>,
      });
    }
    return out
      .filter((l) => {
        const d = new Date(l.data);
        return d >= range.from && d <= range.to;
      })
      .sort((x, y) => y.data.localeCompare(x.data));
  }, [acertos, transacoes, socios, range]);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Auditoria"
        description="Historico de acertos e fechamentos"
        action={<DateRangeFilter value={range} onChange={setRange} />}
      />
      <Card className="divide-y divide-border">
        {linhas.map((l) => (
          <div key={l.id} className="flex items-start gap-3 p-3 md:p-4">
            <Badge variant={l.tipo === "acerto" ? "default" : "secondary"} className="text-[10px] mt-0.5">
              {l.tipo === "acerto" ? "Acerto" : "Fechamento"}
            </Badge>
            <div className="flex-1 min-w-0">
              <div className="text-sm">{l.texto}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(l.data).toLocaleString("pt-BR")}
              </div>
            </div>
            {l.valor != null && (
              <div className="font-semibold tabular-nums text-sm">{formatBRL(l.valor)}</div>
            )}
          </div>
        ))}
        {linhas.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">Sem registros ainda.</div>
        )}
      </Card>
    </div>
  );
}
