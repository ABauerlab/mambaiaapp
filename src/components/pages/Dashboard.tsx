import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, TrendingUp, Wallet, PlusCircle } from "lucide-react";
import { fetchTransacoes, fetchSocios, fetchCategorias, fetchAcertos } from "@/lib/db";
import { formatBRL, toCents, fromCents } from "@/lib/money";
import { computeNetBalances, sugerirAcertos, transacoesAbertasParaBalance, MAMBAIA_CAIXA_ID } from "@/lib/balance";
import { PageHeader } from "./PageHeader";
import { PushNotificationsCard } from "@/components/PushNotificationsCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo, useState } from "react";
import { DateRangeFilter, defaultMonthRange, isInRange, formatRange } from "@/components/DateRangeFilter";

const BRAND_COLORS = ["#A6D608", "#1F3D2B", "#DFFF4F", "#5A8A2E", "#7FB320", "#3A6440"];

export function Dashboard() {
  const { data: transacoes, isLoading: l1 } = useQuery({ queryKey: ["transacoes"], queryFn: fetchTransacoes });
  const { data: socios } = useQuery({ queryKey: ["socios"], queryFn: fetchSocios });
  const { data: categorias } = useQuery({ queryKey: ["categorias"], queryFn: fetchCategorias });
  const { data: acertos } = useQuery({ queryKey: ["acertos"], queryFn: fetchAcertos });
  const [range, setRange] = useState(defaultMonthRange());

  const stats = useMemo(() => {
    if (!transacoes) return null;
    const inRange = transacoes.filter((t) => isInRange(t.data, range));
    const receitaMes = inRange.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
    const despesaMes = inRange.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
    const receitaTotal = transacoes.filter((t) => t.tipo === "receita").reduce((s, t) => s + t.valor, 0);
    const despesaTotal = transacoes.filter((t) => t.tipo === "despesa").reduce((s, t) => s + t.valor, 0);
    return {
      receitaMes,
      despesaMes,
      lucroMes: receitaMes - despesaMes,
      receitaTotal,
      despesaTotal,
      lucroTotal: receitaTotal - despesaTotal,
    };
  }, [transacoes, range]);

  // Série mensal últimos 6 meses
  const monthlyData = useMemo(() => {
    if (!transacoes) return [];
    const now = new Date();
    const months: { key: string; label: string; receita: number; despesa: number; lucro: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      months.push({ key, label, receita: 0, despesa: 0, lucro: 0 });
    }
    for (const t of transacoes) {
      const m = months.find((x) => t.data.startsWith(x.key));
      if (!m) continue;
      if (t.tipo === "receita") m.receita += t.valor;
      else m.despesa += t.valor;
    }
    return months.map((m) => ({ ...m, lucro: m.receita - m.despesa }));
  }, [transacoes]);

  // Categorias de despesa do mês atual
  const categoryData = useMemo(() => {
    if (!transacoes || !categorias) return [];
    const map = new Map<string, number>();
    for (const t of transacoes) {
      if (t.tipo !== "despesa" || !isInRange(t.data, range)) continue;
      const cat = categorias.find((c) => c.id === t.categoria_id);
      const nome = cat?.nome ?? "Sem categoria";
      map.set(nome, (map.get(nome) ?? 0) + t.valor);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transacoes, categorias, range]);

  // Saldos entre sócios
  const balances = useMemo(() => {
    if (!socios || !transacoes) return null;
    const abertas = transacoesAbertasParaBalance(transacoes);
    const ac = (acertos ?? []).map((a) => ({
      de_socio_id: a.de_socio_id,
      para_socio_id: a.para_socio_id,
      valor_cents: toCents(a.valor),
    }));
    const bal = computeNetBalances(socios, abertas, ac);
    return { bal, sugestoes: sugerirAcertos(new Map(bal)) };
  }, [socios, transacoes, acertos]);

  if (l1 || !stats) {
    return (
      <div className="p-4 md:p-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Dashboard"
        description={`Panorama financeiro · ${formatRange(range)}`}
        action={
          <div className="flex items-center gap-2">
            <DateRangeFilter value={range} onChange={setRange} />
            <Button asChild>
              <Link to="/nova"><PlusCircle className="w-4 h-4 mr-2" />Nova</Link>
            </Button>
          </div>
        }
      />

      <div className="mb-6">
        <PushNotificationsCard />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        <KPICard
          label="Receitas (período)"
          value={formatBRL(stats.receitaMes)}
          icon={<ArrowUpRight className="w-4 h-4" />}
          tone="success"
        />
        <KPICard
          label="Despesas (período)"
          value={formatBRL(stats.despesaMes)}
          icon={<ArrowDownRight className="w-4 h-4" />}
          tone="destructive"
        />
        <KPICard
          label="Lucro (período)"
          value={formatBRL(stats.lucroMes)}
          icon={<TrendingUp className="w-4 h-4" />}
          tone={stats.lucroMes >= 0 ? "primary" : "destructive"}
        />
        <KPICard
          label="Lucro acumulado"
          value={formatBRL(stats.lucroTotal)}
          icon={<Wallet className="w-4 h-4" />}
          tone={stats.lucroTotal >= 0 ? "primary" : "destructive"}
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Evolução mensal</h3>
            <span className="text-xs text-muted-foreground">últimos 6 meses</span>
          </div>
          <div className="h-64 md:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted-foreground)/0.15)" />
                <XAxis dataKey="label" stroke="currentColor" fontSize={12} />
                <YAxis stroke="currentColor" fontSize={12} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => formatBRL(v)}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="receita" name="Receitas" stroke="#A6D608" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="despesa" name="Despesas" stroke="#1F3D2B" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="#DFFF4F" strokeWidth={2} strokeDasharray="4 4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4 md:p-6">
          <h3 className="font-semibold mb-4">Despesas por categoria <span className="text-xs text-muted-foreground font-normal">({formatRange(range)})</span></h3>
          {categoryData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Sem despesas neste mês
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={45}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {categoryData.map((_, i) => (
                      <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => formatBRL(v)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-3 space-y-1.5 max-h-40 overflow-auto scrollbar-thin">
            {categoryData.map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                  <span className="truncate">{c.name}</span>
                </div>
                <span className="font-medium tabular-nums">{formatBRL(c.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Saldo entre sócios */}
      <Card className="p-4 md:p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">Saldo entre sócios</h3>
            <p className="text-xs text-muted-foreground">Considerando despesas ainda não acertadas</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/acertos">Ver acertos</Link>
          </Button>
        </div>
        {!balances || !socios ? (
          <Skeleton className="h-20" />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {socios.map((s) => {
                const v = fromCents(balances.bal.get(s.id) ?? 0);
                return (
                  <div key={s.id} className="rounded-lg border border-border p-3 flex items-center justify-between bg-background">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold"
                        style={{ background: s.cor, color: "#0A2A20" }}>
                        {s.nome.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <span className="text-sm font-medium">{s.nome}</span>
                    </div>
                    <div className={`text-sm font-semibold tabular-nums ${v > 0 ? "text-[color:var(--success)]" : v < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                      {v > 0 ? "+" : ""}{formatBRL(v)}
                    </div>
                  </div>
                );
              })}
            </div>
            {balances.sugestoes.length > 0 && (
              <div className="rounded-lg bg-secondary/40 p-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">Sugestão para zerar saldos:</div>
                <div className="space-y-1.5">
                  {balances.sugestoes.map((s, i) => {
                    const de = socios.find((x) => x.id === s.de)?.nome;
                    const para = socios.find((x) => x.id === s.para)?.nome;
                    return (
                      <div key={i} className="text-sm flex items-center gap-2">
                        <span className="font-medium">{de}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{para}</span>
                        <span className="ml-auto font-semibold tabular-nums">{formatBRL(fromCents(s.valor_cents))}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Últimas transações */}
      <Card className="p-4 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Últimas transações</h3>
          <Button asChild variant="ghost" size="sm">
            <Link to="/transacoes">Ver todas</Link>
          </Button>
        </div>
        <div className="space-y-1">
          {transacoes!.slice(0, 8).map((t) => {
            const cat = categorias?.find((c) => c.id === t.categoria_id);
            const socio = socios?.find((s) => s.id === t.socio_id);
            return (
              <div key={t.id} className="flex items-center gap-3 py-2 border-b border-border/40 last:border-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs ${t.tipo === "receita" ? "bg-[color:var(--brand-lime)] text-[color:var(--brand-dark)]" : "bg-[color:var(--brand-dark)] text-[color:var(--brand-lime)]"}`}>
                  {t.tipo === "receita" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.descricao}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(t.data + "T00:00:00").toLocaleDateString("pt-BR")} · {cat?.nome ?? "—"}
                    {socio && ` · ${socio.nome}`}
                  </div>
                </div>
                <div className={`text-sm font-semibold tabular-nums ${t.tipo === "receita" ? "text-[color:var(--success)]" : "text-foreground"}`}>
                  {t.tipo === "receita" ? "+" : "−"}{formatBRL(t.valor)}
                </div>
              </div>
            );
          })}
          {transacoes!.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma transação ainda. <Link to="/nova" className="text-primary underline">Registrar a primeira</Link>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function KPICard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: "success" | "destructive" | "primary" }) {
  const toneClasses = {
    success: "bg-[color:var(--brand-lime)] text-[color:var(--brand-dark)]",
    destructive: "bg-destructive/10 text-destructive",
    primary: "bg-[color:var(--brand-dark)] text-[color:var(--brand-lime)]",
  };
  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        <span className={`w-7 h-7 rounded-md flex items-center justify-center ${toneClasses[tone]}`}>{icon}</span>
      </div>
      <div className="text-xl md:text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}