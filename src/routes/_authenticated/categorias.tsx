import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  getMyWorkspaces, getCategoryBreakdown, getMonthTotals,
} from "@/lib/finanzas.functions";
import { fmtCOP, fmtUSD, fmtShortDate, monthRange } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/categorias")({
  component: CategoriasPage,
});

type TxType = "ingreso" | "egreso";
type CurFilter = "ALL" | "COP" | "USD";

function ymOf(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function CategoriasPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const breakdownFn = useServerFn(getCategoryBreakdown);
  const totalsFn = useServerFn(getMonthTotals);

  const [ym, setYm] = useState<string>(() => ymOf(new Date()));
  const [type, setType] = useState<TxType>("ingreso");
  const [currency, setCurrency] = useState<CurFilter>("ALL");
  const [selected, setSelected] = useState<any | null>(null);

  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: () => wsFn() });
  const ws = workspaces[0];
  const range = useMemo(() => monthRange(ym), [ym]);

  const { data: totals } = useQuery({
    queryKey: ["month-totals", ws?.id, ym, currency],
    queryFn: () => totalsFn({ data: { workspace_id: ws.id, from: range.from, to: range.to, currency } }),
    enabled: !!ws?.id,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["cat-breakdown", ws?.id, ym, type, currency],
    queryFn: () => breakdownFn({ data: { workspace_id: ws.id, from: range.from, to: range.to, type, currency } }),
    enabled: !!ws?.id,
  });

  function shiftMonth(delta: number) {
    const [y, m] = ym.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setYm(ymOf(d));
  }

  const monthLabel = useMemo(() => {
    const [y, m] = ym.split("-").map(Number);
    return new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" }).format(new Date(y, m - 1, 1));
  }, [ym]);

  const max = data?.breakdown[0]?.amount ?? 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-4xl">Categorías</h1>
          <p className="text-sm text-muted-foreground mt-1">Distribución mensual por categoría</p>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => shiftMonth(-1)}><ChevronLeft className="size-4" /></Button>
            <div className="min-w-44 text-center font-serif text-xl capitalize">{monthLabel}</div>
            <Button variant="outline" size="icon" onClick={() => shiftMonth(1)}><ChevronRight className="size-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setYm(ymOf(new Date()))}>Hoy</Button>
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

        {/* Month totals */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setType("ingreso")}
            className={cn("rounded-2xl border p-4 text-left transition",
              type === "ingreso" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border hover:bg-accent")}>
            <div className="flex items-center justify-between text-xs opacity-80">
              <span>Ingresos del mes</span><ArrowDownRight className="size-4" />
            </div>
            <div className="mt-2 num-serif text-2xl md:text-3xl">{fmtCOP(totals?.ingresos ?? 0)}</div>
          </button>
          <button onClick={() => setType("egreso")}
            className={cn("rounded-2xl border p-4 text-left transition",
              type === "egreso" ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-accent")}>
            <div className="flex items-center justify-between text-xs opacity-80">
              <span>Egresos del mes</span><ArrowUpRight className="size-4" />
            </div>
            <div className="mt-2 num-serif text-2xl md:text-3xl">{fmtCOP(totals?.egresos ?? 0)}</div>
          </button>
        </div>

        {/* Bars */}
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-serif text-2xl capitalize">{type === "ingreso" ? "Ingresos" : "Egresos"} por categoría</h2>
            <span className="text-xs text-muted-foreground">Total: <span className="num">{fmtCOP(data?.total ?? 0)}</span></span>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : !data || data.breakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin movimientos en este mes.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-end gap-3 min-h-72 pb-2" style={{ minWidth: `${data.breakdown.length * 96}px` }}>
                {data.breakdown.map((c: any) => {
                  const h = max > 0 ? Math.max(8, (c.amount / max) * 240) : 8;
                  const isIngreso = type === "ingreso";
                  return (
                    <button key={c.id} onClick={() => setSelected(c)}
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
          )}
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {selected?.code} · {selected?.name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-baseline gap-4">
                <div className="num-serif text-3xl">{fmtCOP(selected.amount)}</div>
                <div className="text-sm text-muted-foreground">{selected.count} mov · {selected.pct.toFixed(1)}%</div>
              </div>
              <ul className="divide-y divide-border">
                {selected.txns.map((t: any) => (
                  <li key={t.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{t.concept}</div>
                      <div className="text-xs text-muted-foreground flex gap-2 mt-0.5 flex-wrap">
                        <span>{fmtShortDate(t.date)}</span>
                        <span>·</span>
                        <span className="capitalize">{t.account}</span>
                        {t.client && (<><span>·</span><span>{t.client.name}</span></>)}
                        <span>·</span>
                        <span className="font-mono uppercase text-[10px]">{t.source}</span>
                      </div>
                    </div>
                    <div className={cn("num text-sm font-medium",
                      type === "ingreso" ? "text-primary" : "text-foreground")}>
                      {type === "ingreso" ? "+" : "−"}{t.currency === "USD" ? fmtUSD(t.amount) : fmtCOP(t.amount)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
