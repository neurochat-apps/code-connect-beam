import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { AIChatDialog } from "@/components/AIChatDialog";
import { Button } from "@/components/ui/button";
import { getMyWorkspaces, getDashboard } from "@/lib/finanzas.functions";
import { fmtCOP, fmtUSD, fmtShortDate, periodRange, monthRange, currentYM, type Period } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const dashFn = useServerFn(getDashboard);
  const [mode, setMode] = useState<"period" | "month" | "custom">("period");
  const [period, setPeriod] = useState<Period>("month");
  const [ym, setYm] = useState<string>(currentYM());
  const [customFrom, setCustomFrom] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => wsFn(),
  });
  const ws = workspaces[0];
  const range =
    mode === "period" ? periodRange(period)
    : mode === "month" ? monthRange(ym)
    : { from: customFrom, to: customTo };

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", ws?.id, mode, period, ym, customFrom, customTo],
    queryFn: () => dashFn({ data: { workspace_id: ws.id, from: range.from, to: range.to } }),
    enabled: !!ws?.id,
  });

  return (
    <AppShell onOpenAI={() => setAiOpen(true)}>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-4xl md:text-5xl">Resumen</h1>
            <p className="text-sm text-muted-foreground mt-1">{ws?.name ?? "—"}</p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!ws}>
            <Plus className="size-4" /> Registrar
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(["today", "week", "month", "quarter", "year"] as Period[]).map((p) => (
              <button key={p} onClick={() => { setMode("period"); setPeriod(p); }}
                className={cn("px-3 py-1.5 text-xs rounded-full border whitespace-nowrap",
                  mode === "period" && period === p ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-accent")}>
                {p === "today" ? "Hoy" : p === "week" ? "Semana" : p === "month" ? "Mes" : p === "quarter" ? "Trimestre" : "Año"}
              </button>
            ))}
            <button onClick={() => setMode("month")}
              className={cn("px-3 py-1.5 text-xs rounded-full border whitespace-nowrap",
                mode === "month" ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-accent")}>
              Mes específico
            </button>
            <button onClick={() => setMode("custom")}
              className={cn("px-3 py-1.5 text-xs rounded-full border whitespace-nowrap",
                mode === "custom" ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-accent")}>
              Rango personalizado
            </button>
          </div>
          {mode === "month" && (
            <Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} className="h-8 w-44 text-xs" />
          )}
          {mode === "custom" && (
            <div className="flex gap-2 items-center">
              <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-40 text-xs" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-40 text-xs" />
            </div>
          )}
        </div>

        {isLoading || !data ? (
          <div className="text-sm text-muted-foreground">Cargando...</div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPI label="Ingresos" value={fmtCOP(data.kpis.ingresos)} icon={<ArrowDownRight className="size-4 text-primary" />} />
              <KPI label="Gastos" value={fmtCOP(data.kpis.gastos)} icon={<ArrowUpRight className="size-4" />} />
              <KPI label="Utilidad" value={fmtCOP(data.kpis.utilidad)} highlight />
              <KPI label="Cartera pendiente" value={fmtCOP(data.kpis.cartera)} icon={<Wallet className="size-4" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <KPI label="Stripe USD" value={fmtUSD(data.usd.stripe)} />
              <KPI label="Chase USD" value={fmtUSD(data.usd.chase)} />
              <KPI label="Total USA" value={fmtUSD(data.usd.total)} highlight />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl bg-card border border-border p-5">
                <h2 className="font-serif text-2xl mb-4">Últimas transacciones</h2>
                {data.lastTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aún no hay movimientos en este período.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.lastTransactions.map((t: any) => (
                      <li key={t.id} className="py-3 flex items-center gap-3">
                        <div className={cn("size-9 rounded-full flex items-center justify-center shrink-0",
                          t.type === "ingreso" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                          {t.type === "ingreso" ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{t.concept}</div>
                          <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                            <span>{fmtShortDate(t.date)}</span>
                            <span>·</span>
                            <span className="capitalize">{t.account}</span>
                            <span>·</span>
                            <SourceBadge source={t.source} />
                          </div>
                        </div>
                        <div className={cn("num text-sm font-medium tabular-nums",
                          t.type === "ingreso" ? "text-primary" : "text-foreground")}>
                          {t.type === "ingreso" ? "+" : "−"}{t.currency === "USD" ? fmtUSD(t.amount) : fmtCOP(t.amount)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-4">
                <BreakEvenCard be={data.breakEven} ingresos={data.kpis.ingresos} />
                <div className="rounded-2xl bg-card border border-border p-5">
                  <h2 className="font-serif text-xl mb-3">Cartera pendiente</h2>
                  {data.pendingClients.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin pendientes 🎉</p>
                  ) : (
                    <ul className="space-y-2">
                      {data.pendingClients.map((c: any) => (
                        <li key={c.id} className="flex justify-between text-sm">
                          <span>{c.name}</span>
                          <span className="num">{fmtCOP(c.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {ws && <TransactionDialog open={open} onOpenChange={setOpen} workspaceId={ws.id} />}
      <AIChatDialog open={aiOpen} onOpenChange={setAiOpen} workspaceId={ws?.id} />

    </AppShell>
  );
}

function KPI({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("rounded-2xl border p-4",
      highlight ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border")}>
      <div className="flex items-center justify-between text-xs opacity-70">
        <span>{label}</span>{icon}
      </div>
      <div className={cn("mt-2 num-serif text-2xl md:text-3xl")}>{value}</div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const map: Record<string, string> = { manual: "Manual", telegram: "Telegram", stripe: "Stripe", ai_chat: "IA" };
  return <span className="uppercase tracking-wide text-[10px] font-mono">{map[source] ?? source}</span>;
}

function BreakEvenCard({ be, ingresos }: { be: any; ingresos: number }) {
  const colors = { green: "bg-primary", yellow: "bg-[oklch(0.78_0.13_80)]", red: "bg-destructive" };
  const labels = { green: "En punto", yellow: "Cerca", red: "Lejos" };
  const pct = Math.min(100, Math.max(0, be.pctAlcanzado));
  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-xl flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Punto de equilibrio</h2>
        <span className={cn("size-2.5 rounded-full", colors[be.status as keyof typeof colors])} />
      </div>
      <div className="num-serif text-3xl">{fmtCOP(be.puntoEquilibrio)}</div>
      <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full", colors[be.status as keyof typeof colors])} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{fmtCOP(ingresos)} alcanzado</span>
        <span>{pct.toFixed(0)}% · {labels[be.status as keyof typeof labels]}</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Costos fijos: <span className="num">{fmtCOP(be.costosFijos)}</span> · margen {(be.margen * 100).toFixed(0)}%
      </p>
    </div>
  );
}
