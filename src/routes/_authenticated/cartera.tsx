import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { getMyWorkspaces, listCartera, markTransactionPaid } from "@/lib/finanzas.functions";
import { fmtCOP, fmtUSD, fmtShortDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cartera")({
  component: CarteraPage,
});

type CurFilter = "ALL" | "COP" | "USD";
type StatusFilter = "ALL" | "green" | "yellow" | "red";

function CarteraPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const listFn = useServerFn(listCartera);
  const payFn = useServerFn(markTransactionPaid);
  const qc = useQueryClient();

  const [currency, setCurrency] = useState<CurFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: () => wsFn() });
  const ws = workspaces[0];

  const { data, isLoading } = useQuery({
    queryKey: ["cartera", ws?.id],
    queryFn: () => listFn({ data: { workspace_id: ws.id } }),
    enabled: !!ws?.id,
  });

  const pay = useMutation({
    mutationFn: (id: string) => payFn({ data: { id, date: new Date().toISOString().slice(0, 10) } }),
    onSuccess: () => { toast.success("Marcado como pagado"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const items = useMemo(() => {
    const list = data?.items ?? [];
    return list.filter((i: any) =>
      (currency === "ALL" || i.currency === currency) &&
      (status === "ALL" || i.status === status),
    );
  }, [data, currency, status]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="font-serif text-4xl">Cartera</h1>
          <p className="text-sm text-muted-foreground mt-1">Cobros pendientes por cliente</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="size-3" /> Total COP</div>
            <div className="num-serif text-2xl md:text-3xl mt-2">{fmtCOP(data?.totalCOP ?? 0)}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="size-3" /> Total USD</div>
            <div className="num-serif text-2xl md:text-3xl mt-2">{fmtUSD(data?.totalUSD ?? 0)}</div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="flex gap-1">
            {(["ALL", "COP", "USD"] as CurFilter[]).map((c) => (
              <button key={c} onClick={() => setCurrency(c)}
                className={cn("px-3 py-1.5 text-xs rounded-full border",
                  currency === c ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-accent")}>
                {c === "ALL" ? "Todas" : c}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {([
              { k: "ALL", l: "Todos" },
              { k: "green", l: "Vigente" },
              { k: "yellow", l: "Próximo" },
              { k: "red", l: "Vencido" },
            ] as { k: StatusFilter; l: string }[]).map((s) => (
              <button key={s.k} onClick={() => setStatus(s.k)}
                className={cn("px-3 py-1.5 text-xs rounded-full border",
                  status === s.k ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card hover:bg-accent")}>
                {s.l}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sin pendientes 🎉</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((i: any) => (
                <li key={i.id} className="p-4 flex items-center gap-3">
                  <span className={cn("size-2.5 rounded-full shrink-0",
                    i.status === "green" ? "bg-primary"
                    : i.status === "yellow" ? "bg-[oklch(0.78_0.13_80)]"
                    : "bg-destructive")} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {i.client?.name ?? "Sin cliente"} — {i.concept}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2 mt-0.5 flex-wrap">
                      <span>Vence {fmtShortDate(i.dueDate)}</span>
                      <span>·</span>
                      <span>
                        {i.diffDays < 0 ? `Vencido hace ${Math.abs(i.diffDays)} d`
                        : i.diffDays === 0 ? "Vence hoy"
                        : `En ${i.diffDays} días`}
                      </span>
                    </div>
                  </div>
                  <div className="num text-sm font-medium text-primary">
                    {i.currency === "USD" ? fmtUSD(i.amount) : fmtCOP(i.amount)}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => pay.mutate(i.id)} disabled={pay.isPending}>
                    <Check className="size-4" /> Pagado
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
