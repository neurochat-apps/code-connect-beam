import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, Target, Landmark } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { AIChatDialog } from "@/components/AIChatDialog";
import { Button } from "@/components/ui/button";
import { getMyWorkspaces, getDashboard, getCategoryBreakdown } from "@/lib/finanzas.functions";
import { fmtCOP, fmtUSD, fmtShortDate, periodRange, monthRange, currentYM, type Period } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

type CurFilter = "ALL" | "COP" | "USD";
type TxType = "ingreso" | "egreso";

function DashboardPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const dashFn = useServerFn(getDashboard);
  const breakdownFn = useServerFn(getCategoryBreakdown);
  const [mode, setMode] = useState<"period" | "month" | "custom">("period");
  const [period, setPeriod] = useState<Period>("month");
  const [ym, setYm] = useState<string>(currentYM());
  const [customFrom, setCustomFrom] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [catType, setCatType] = useState<TxType>("egreso");
  const [currency, setCurrency] = useState<CurFilter>("ALL");
  const [selectedCat, setSelectedCat] = useState<any | null>(null);

  const { data: workspaces = [] } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => wsFn(),
  });
  const ws = workspaces[0];
  const range = useMemo(() =>
    mode === "period" ? periodRange(period)
    : mode === "month" ? monthRange(ym)
    : { from: customFrom, to: customTo },
  [mode, period, ym, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", ws?.id, range.from, range.to],
    queryFn: () => dashFn({ data: { workspace_id: ws.id, from: range.from, to: range.to } }),
    enabled: !!ws?.id,
  });

  const { data: catData } = useQuery({
    queryKey: ["cat-breakdown", ws?.id, range.from, range.to, catType, currency],
    queryFn: () => breakdownFn({ data: { workspace_id: ws.id, from: range.from, to: range.to, type: catType, currency } }),
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
            {data.kpis.saldoAnterior > 0 && (
              <div className="rounded-2xl bg-card border border-primary/30 p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Saldo anterior agregado a este mes</div>
                  <div className="mt-1 num-serif text-2xl md:text-3xl text-primary">{fmtCOP(data.kpis.saldoAnterior)}</div>
                </div>
                <Landmark className="size-5 text-primary" />
              </div>
            )}

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
                          t.type === "ingreso" ? "bg-primary/10 text-primary"
                            : t.type === "neutro" ? "bg-muted text-muted-foreground"
                            : "bg-muted text-muted-foreground")}>
                          {t.type === "ingreso" ? <ArrowDownRight className="size-4" />
                            : t.type === "neutro" ? <span className="text-xs">⇄</span>
                            : <ArrowUpRight className="size-4" />}
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
                          t.type === "ingreso" ? "text-primary"
                            : t.type === "neutro" ? "text-muted-foreground"
                            : "text-foreground")}>
                          {t.type === "ingreso" ? "+" : t.type === "neutro" ? "⇄ " : "−"}{t.currency === "USD" ? fmtUSD(t.amount) : fmtCOP(t.amount)}
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

            {/* Categorías embebidas */}
            <div className="rounded-2xl bg-card border border-border p-5">
              <div className="flex items-baseline justify-between flex-wrap gap-3 mb-4">
                <h2 className="font-serif text-2xl">Categorías</h2>
                <div className="flex gap-2 items-center">
                  <div className="flex gap-1">
                    {(["ingreso", "egreso"] as TxType[]).map((t) => (
                      <button key={t} onClick={() => setCatType(t)}
                        className={cn("px-3 py-1.5 text-xs rounded-full border capitalize",
                          catType === t
                            ? t === "ingreso" ? "bg-primary text-primary-foreground border-primary" : "bg-foreground text-background border-foreground"
                            : "border-border bg-card hover:bg-accent")}>
                        {t === "ingreso" ? "Ingresos" : "Egresos"}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    {(["ALL", "COP", "USD"] as CurFilter[]).map((c) => (
                      <button key={c} onClick={() => setCurrency(c)}
                        className={cn("px-3 py-1.5 text-xs rounded-full border",
                          currency === c ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-accent")}>
                        {c === "ALL" ? "Todas" : c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {!catData || catData.breakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin movimientos en este rango.</p>
              ) : (
                <CategoryBars data={catData} type={catType} onSelect={setSelectedCat} />
              )}
            </div>
          </>
        )}
      </div>

      {/* Detalle categoría */}
      <Dialog open={!!selectedCat} onOpenChange={(v) => !v && setSelectedCat(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {selectedCat?.code} · {selectedCat?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedCat && (
            <div className="space-y-4">
              <div className="flex items-baseline gap-4">
                <div className="num-serif text-3xl">{fmtCOP(selectedCat.amount)}</div>
                <div className="text-sm text-muted-foreground">{selectedCat.count} mov · {selectedCat.pct.toFixed(1)}%</div>
              </div>
              <ul className="divide-y divide-border">
                {selectedCat.txns.map((t: any) => (
                  <li key={t.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.concept}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 mt-0.5 flex-wrap">
                        <span>{fmtShortDate(t.date)}</span>
                        <span>·</span>
                        <span className="capitalize">{t.account}</span>
                        {t.client && (<><span>·</span><span>{t.client.name}</span></>)}
                      </div>
                    </div>
                    <div className={cn("num text-sm font-medium",
                      catType === "ingreso" ? "text-primary" : "text-foreground")}>
                      {catType === "ingreso" ? "+" : "−"}{t.currency === "USD" ? fmtUSD(t.amount) : fmtCOP(t.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {ws && <TransactionDialog open={open} onOpenChange={setOpen} workspaceId={ws.id} />}
      <AIChatDialog open={aiOpen} onOpenChange={setAiOpen} workspaceId={ws?.id} />

    </AppShell>
  );
}

function CategoryBars({ data, type, onSelect }: { data: any; type: TxType; onSelect: (c: any) => void }) {
  const max = data.breakdown[0]?.amount ?? 0;
  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-3 min-h-72 pb-2" style={{ minWidth: `${data.breakdown.length * 96}px` }}>
        {data.breakdown.map((c: any) => {
          const h = max > 0 ? Math.max(8, (c.amount / max) * 240) : 8;
          const isIngreso = type === "ingreso";
          return (
            <button key={c.id} onClick={() => onSelect(c)}
              className="flex-1 min-w-20 flex flex-col items-center gap-1.5 group">
              <div className="text-[10px] font-mono text-muted-foreground">{c.pct.toFixed(0)}%</div>
              <div
                className={cn("w-full rounded-t-xl transition-all group-hover:opacity-80",
                  isIngreso ? "bg-primary" : "bg-foreground")}
                style={{ height: `${h}px` }}
              />
              <div className="text-[11px] num tabular-nums font-medium text-center leading-tight">
                {fmtCOP(c.amount)}
              </div>
              <div className="text-[10px] text-muted-foreground text-center leading-tight line-clamp-2 px-1" title={c.name}>
                {c.code} · {c.name}
              </div>
            </button>
          );
        })}
      </div>
    </div>
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
  const labels = { green: "Meta alcanzada", yellow: "Sobre equilibrio", red: "Debajo de equilibrio" };
  const meta = Number(be.meta ?? 0);
  const pe = Number(be.puntoEquilibrio ?? 0);
  const target = meta > 0 ? meta : pe;
  const pct = target > 0 ? Math.min(100, Math.max(0, (ingresos / target) * 100)) : 0;
  const equilibriumMark = meta > 0 && pe > 0 ? Math.min(100, (pe / meta) * 100) : null;

  return (
    <div className="rounded-2xl bg-card border border-border p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-serif text-xl flex items-center gap-2"><TrendingUp className="size-4 text-primary" /> Equilibrio & Meta</h2>
        <span className={cn("size-2.5 rounded-full", colors[be.status as keyof typeof colors])} />
      </div>

      <div className="space-y-1 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Punto equilibrio</span>
          <span className="num font-medium">{fmtCOP(pe)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground flex items-center gap-1"><Target className="size-3" /> Meta</span>
          <span className="num font-medium">{meta > 0 ? fmtCOP(meta) : "— sin definir"}</span>
        </div>
      </div>

      <div className="relative mt-3 h-2.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full", colors[be.status as keyof typeof colors])} style={{ width: `${pct}%` }} />
        {equilibriumMark !== null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-foreground/60"
            style={{ left: `${equilibriumMark}%` }}
            title="Punto de equilibrio"
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{fmtCOP(ingresos)} alcanzado</span>
        <span>{pct.toFixed(0)}% · {labels[be.status as keyof typeof labels]}</span>
      </div>
      {meta === 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Define tu meta mensual en Configuración → General.
        </p>
      )}
    </div>
  );
}
