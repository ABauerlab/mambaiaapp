import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchTransacoes } from "@/lib/db";
import { formatBRL } from "@/lib/money";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export function Relatorios() {
  const { data: transacoes } = useQuery({ queryKey: ["transacoes"], queryFn: fetchTransacoes });

  const meses = useMemo(() => {
    const map = new Map<string, { receita: number; despesa: number }>();
    (transacoes ?? []).forEach((t) => {
      const key = t.data.slice(0, 7);
      const cur = map.get(key) ?? { receita: 0, despesa: 0 };
      cur[t.tipo] += Number(t.valor);
      map.set(key, cur);
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [transacoes]);

  const exportCsv = () => {
    const rows = [["mes", "receita", "despesa", "lucro"]];
    meses.forEach(([m, v]) => rows.push([m, v.receita.toFixed(2), v.despesa.toFixed(2), (v.receita - v.despesa).toFixed(2)]));
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "mambaia-relatorio.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Relatórios"
        description="Resumo mensal de receitas, despesas e lucro"
        action={<Button onClick={exportCsv} variant="outline"><Download className="w-4 h-4 mr-2" />Exportar CSV</Button>}
      />
      <Card className="divide-y divide-border">
        {meses.map(([m, v]) => {
          const lucro = v.receita - v.despesa;
          return (
            <div key={m} className="grid grid-cols-4 gap-2 p-4 text-sm tabular-nums">
              <div className="font-medium">{m}</div>
              <div className="text-[color:var(--success)]">+{formatBRL(v.receita)}</div>
              <div className="text-muted-foreground">−{formatBRL(v.despesa)}</div>
              <div className={lucro >= 0 ? "font-semibold" : "font-semibold text-destructive"}>{formatBRL(lucro)}</div>
            </div>
          );
        })}
        {meses.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">Sem dados ainda.</div>}
      </Card>
    </div>
  );
}