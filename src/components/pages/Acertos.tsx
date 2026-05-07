import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { fetchTransacoes, fetchSocios, fetchAcertos } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { computeNetBalances, sugerirAcertos } from "@/lib/balance";
import { formatBRL, fromCents, toCents } from "@/lib/money";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function Acertos() {
  const qc = useQueryClient();
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });
  const { data: transacoes } = useQuery({ queryKey: ["transacoes"], queryFn: fetchTransacoes });
  const { data: acertos } = useQuery({ queryKey: ["acertos"], queryFn: fetchAcertos });
  const [registering, setRegistering] = useState<string | null>(null);

  const result = useMemo(() => {
    if (!socios || !transacoes) return null;
    const despesasAbertas = transacoes
      .filter((t) => t.tipo === "despesa" && !t.acertada && t.socio_id)
      .map((t) => ({ id: t.id, valor_cents: toCents(t.valor), socio_id: t.socio_id! }));
    const ac = (acertos ?? []).map((a) => ({
      de_socio_id: a.de_socio_id,
      para_socio_id: a.para_socio_id,
      valor_cents: toCents(a.valor),
    }));
    const bal = computeNetBalances(socios.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor })), despesasAbertas, ac);
    return { bal, sugestoes: sugerirAcertos(new Map(bal)), despesasAbertasIds: despesasAbertas.map((d) => d.id) };
  }, [socios, transacoes, acertos]);

  const registrarAcerto = useMutation({
    mutationFn: async ({ de, para, valor_cents }: { de: string; para: string; valor_cents: number }) => {
      const { error } = await supabase.from("acertos").insert({ de_socio_id: de, para_socio_id: para, valor: fromCents(valor_cents) });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acertos"] });
      toast.success("Acerto registrado");
      setRegistering(null);
    },
    onError: (e: Error) => { toast.error(e.message); setRegistering(null); },
  });

  const zerarTudo = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("Sem dados");
      if (result.sugestoes.length > 0) throw new Error("Existem saldos pendentes");
      const { error } = await supabase.from("transacoes").update({ acertada: true }).in("id", result.despesasAbertasIds);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transacoes"] }); toast.success("Movido ao balanço geral"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader title="Acertos" description="Saldos atuais entre os sócios" />
      {!result || !socios ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <Card className="p-5 mb-4">
            <h3 className="font-semibold mb-4">Saldo de cada sócio</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {socios.map((s) => {
                const v = fromCents(result.bal.get(s.id) ?? 0);
                return (
                  <div key={s.id} className="rounded-lg border border-border p-4 text-center">
                    <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-sm font-bold mb-2" style={{ background: s.cor, color: "#0A2A20" }}>
                      {s.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="text-sm font-medium">{s.nome}</div>
                    <div className={`text-lg font-semibold tabular-nums mt-1 ${v > 0 ? "text-[color:var(--success)]" : v < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {v > 0 ? "+" : ""}{formatBRL(v)}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {v > 0 ? "a receber" : v < 0 ? "a pagar" : "em dia"}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Transferências sugeridas</h3>
                <p className="text-xs text-muted-foreground">Forma mais rápida de zerar os saldos</p>
              </div>
              {result.sugestoes.length === 0 && result.despesasAbertasIds.length > 0 && (
                <Button onClick={() => zerarTudo.mutate()} disabled={zerarTudo.isPending}>
                  {zerarTudo.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Mover ao balanço
                </Button>
              )}
            </div>
            {result.sugestoes.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[color:var(--success)]" />
                Tudo em dia entre os sócios.
              </div>
            ) : (
              <div className="space-y-2">
                {result.sugestoes.map((s, i) => {
                  const de = socios.find((x) => x.id === s.de);
                  const para = socios.find((x) => x.id === s.para);
                  if (!de || !para) return null;
                  const key = `${s.de}-${s.para}-${s.valor_cents}`;
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Avatar s={de} /><span className="font-medium text-sm truncate">{de.nome}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        <Avatar s={para} /><span className="font-medium text-sm truncate">{para.nome}</span>
                      </div>
                      <div className="font-semibold tabular-nums">{formatBRL(fromCents(s.valor_cents))}</div>
                      <Button size="sm" variant="outline" disabled={registering === key}
                        onClick={() => { setRegistering(key); registrarAcerto.mutate({ de: s.de, para: s.para, valor_cents: s.valor_cents }); }}>
                        {registering === key ? <Loader2 className="w-3 h-3 animate-spin" /> : "Marcar pago"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold mb-4">Histórico de acertos</h3>
            {(acertos?.length ?? 0) === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Nenhum acerto registrado ainda.</div>
            ) : (
              <div className="divide-y divide-border">
                {acertos!.map((a) => {
                  const de = socios.find((x) => x.id === a.de_socio_id);
                  const para = socios.find((x) => x.id === a.para_socio_id);
                  return (
                    <div key={a.id} className="flex items-center gap-3 py-3">
                      <span className="text-xs text-muted-foreground tabular-nums w-20">{new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                      <span className="text-sm flex-1"><strong>{de?.nome}</strong> <ArrowRight className="inline w-3 h-3 mx-1" /> <strong>{para?.nome}</strong></span>
                      <span className="font-semibold tabular-nums">{formatBRL(a.valor)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function Avatar({ s }: { s: { nome: string; cor: string } }) {
  return (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0" style={{ background: s.cor, color: "#0A2A20" }}>
      {s.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
    </div>
  );
}