import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Loader2, CheckCircle2, ArrowRight, Wallet, FileSearch } from "lucide-react";
import { fetchTransacoes, fetchSocios, fetchAcertos } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import {
  computeNetBalances, sugerirAcertos, transacoesAbertasParaBalance, MAMBAIA_CAIXA_ID,
} from "@/lib/balance";
import { formatBRL, fromCents, toCents } from "@/lib/money";
import { PageHeader } from "./PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/utils";
import { DateRangeFilter, defaultMonthRange, type DateRangeValue } from "@/components/DateRangeFilter";

export function Acertos() {
  const qc = useQueryClient();
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });
  const { data: transacoes } = useQuery({ queryKey: ["transacoes"], queryFn: fetchTransacoes });
  const { data: acertos } = useQuery({ queryKey: ["acertos"], queryFn: fetchAcertos });
  const [registering, setRegistering] = useState<string | null>(null);
  const [range, setRange] = useState<DateRangeValue>(() => defaultMonthRange());

  const acertosFiltrados = useMemo(() => {
    return (acertos ?? []).filter((a) => {
      const d = new Date(a.data + "T12:00:00");
      return d >= range.from && d <= range.to;
    });
  }, [acertos, range]);

  const result = useMemo(() => {
    if (!socios || !transacoes) return null;
    const abertas = transacoesAbertasParaBalance(transacoes);
    const ac = (acertos ?? []).map((a) => ({
      de_socio_id: a.de_socio_id, para_socio_id: a.para_socio_id, valor_cents: toCents(a.valor),
    }));
    const bal = computeNetBalances(socios, abertas, ac);
    return { bal, sugestoes: sugerirAcertos(new Map(bal)), abertasIds: abertas.map((a) => a.id) };
  }, [socios, transacoes, acertos]);

  const registrarAcerto = useMutation({
    mutationFn: async ({ de, para, valor_cents }: { de: string; para: string; valor_cents: number }) => {
      const { error } = await supabase.from("acertos").insert({
        de_socio_id: de === MAMBAIA_CAIXA_ID ? null : de,
        para_socio_id: para === MAMBAIA_CAIXA_ID ? null : para,
        valor: fromCents(valor_cents),
        observacoes: de === MAMBAIA_CAIXA_ID ? "Repasse da Mambaia" : para === MAMBAIA_CAIXA_ID ? "Aporte na Mambaia" : null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["acertos"] });
      toast.success("Acerto registrado");
      setRegistering(null);
    },
    onError: (e: unknown) => { toast.error(friendlyErrorMessage(e)); setRegistering(null); },
  });

  const zerarTudo = useMutation({
    mutationFn: async () => {
      if (!result) throw new Error("Sem dados");
      if (result.sugestoes.length > 0) throw new Error("Existem saldos pendentes");
      const { error } = await supabase.from("transacoes").update({ acertada: true }).in("id", result.abertasIds);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transacoes"] }); toast.success("Movido ao balanco geral"); },
    onError: (e: unknown) => toast.error(friendlyErrorMessage(e)),
  });

  function nomeDe(id: string) {
    if (id === MAMBAIA_CAIXA_ID) return "a Mambaia (caixa)";
    return socios?.find((s) => s.id === id)?.nome ?? "?";
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <PageHeader
        title="Acertos"
        description="Saldos atuais entre a Mambaia e os socios"
        action={<Button asChild variant="outline" size="sm"><Link to="/auditoria"><FileSearch className="w-4 h-4 mr-2" />Auditoria</Link></Button>}
      />
      {!result || !socios ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <Card className="p-5 mb-4">
            <h2 className="font-semibold mb-4">Saldo atual</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <SaldoCard nome="Mambaia (caixa)" cor="#1F3D2B" valor={fromCents(result.bal.get(MAMBAIA_CAIXA_ID) ?? 0)} icon={<Wallet className="w-5 h-5" />} />
              {socios.map((s) => (
                <SaldoCard key={s.id} nome={s.nome} cor={s.cor} valor={fromCents(result.bal.get(s.id) ?? 0)} />
              ))}
            </div>
          </Card>

          <Card className="p-5 mb-4">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div>
                <h2 className="font-semibold">Transferencias sugeridas</h2>
                <p className="text-xs text-muted-foreground">Para zerar todos os saldos</p>
              </div>
              {result.sugestoes.length === 0 && result.abertasIds.length > 0 && (
                <Button onClick={() => zerarTudo.mutate()} disabled={zerarTudo.isPending}>
                  {zerarTudo.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Mover ao balanco
                </Button>
              )}
            </div>
            {result.sugestoes.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[color:var(--success)]" />
                Tudo em dia.
              </div>
            ) : (
              <div className="space-y-2">
                {result.sugestoes.map((s) => {
                  const key = `${s.de}-${s.para}-${s.valor_cents}`;
                  return (
                    <div key={key} className="flex items-center gap-3 p-3 rounded-lg border border-border flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">{nomeDe(s.de)}</span>
                        <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="font-medium text-sm truncate">{nomeDe(s.para)}</span>
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
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h2 className="font-semibold">Historico de acertos</h2>
              <DateRangeFilter value={range} onChange={setRange} />
            </div>
            {acertosFiltrados.length === 0 ? (
              <div className="text-center py-6 text-sm text-muted-foreground">Nenhum acerto registrado.</div>
            ) : (
              <div className="divide-y divide-border">
                {acertosFiltrados.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 py-3 flex-wrap">
                    <span className="text-xs text-muted-foreground tabular-nums w-20">{new Date(a.data + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                    <span className="text-sm flex-1 min-w-0">
                      <strong>{nomeDe(a.de_socio_id ?? MAMBAIA_CAIXA_ID)}</strong>
                      <ArrowRight className="inline w-3 h-3 mx-1" />
                      <strong>{nomeDe(a.para_socio_id ?? MAMBAIA_CAIXA_ID)}</strong>
                    </span>
                    <span className="font-semibold tabular-nums">{formatBRL(a.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function SaldoCard({ nome, cor, valor, icon }: { nome: string; cor: string; valor: number; icon?: React.ReactNode }) {
  const tone = valor > 0 ? "text-[color:var(--success)]" : valor < 0 ? "text-destructive" : "text-muted-foreground";
  const label = valor > 0 ? "a receber" : valor < 0 ? "a pagar" : "em dia";
  return (
    <div className="rounded-lg border border-border p-4 text-center">
      <div className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-sm font-bold mb-2" style={{ background: cor, color: "#0A2A20" }}>
        {icon ?? nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
      </div>
      <div className="text-sm font-medium">{nome}</div>
      <div className={`text-lg font-semibold tabular-nums mt-1 ${tone}`}>
        {valor > 0 ? "+" : ""}{formatBRL(valor)}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}
