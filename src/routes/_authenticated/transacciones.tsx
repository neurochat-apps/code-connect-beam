import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";
import { getMyWorkspaces, listTransactions, deleteTransaction } from "@/lib/finanzas.functions";
import { fmtCOP, fmtUSD, fmtShortDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transacciones")({
  component: TxnPage,
});

function TxnPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const listFn = useServerFn(listTransactions);
  const delFn = useServerFn(deleteTransaction);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: () => wsFn() });
  const ws = workspaces[0];

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["txns", ws?.id],
    queryFn: () => listFn({ data: { workspace_id: ws.id, limit: 200 } }),
    enabled: !!ws?.id,
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Eliminada"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-4xl">Transacciones</h1>
            <p className="text-sm text-muted-foreground mt-1">Todos los movimientos</p>
          </div>
          <Button onClick={() => setOpen(true)} disabled={!ws}>
            <Plus className="size-4" /> Registrar
          </Button>
        </div>

        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando...</div>
          ) : txns.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No hay transacciones aún.</div>
          ) : (
            <ul className="divide-y divide-border">
              {txns.map((t: any) => (
                <li key={t.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{t.concept}</div>
                    <div className="text-xs text-muted-foreground flex gap-2 mt-0.5 flex-wrap">
                      <span>{fmtShortDate(t.date)}</span>
                      <span>·</span>
                      <span className="capitalize">{t.account}</span>
                      {t.category && (<><span>·</span><span>{t.category.name}</span></>)}
                      {t.client && (<><span>·</span><span>{t.client.name}</span></>)}
                      {t.is_pending && (<><span>·</span><span className="text-warning">Pendiente</span></>)}
                      <span>·</span>
                      <span className="font-mono uppercase text-[10px]">{t.source}</span>
                    </div>
                  </div>
                  <div className={cn("num text-sm font-medium",
                    t.type === "ingreso" ? "text-primary" : "text-foreground")}>
                    {t.type === "ingreso" ? "+" : "−"}{t.currency === "USD" ? fmtUSD(t.amount) : fmtCOP(t.amount)}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar?")) del.mutate(t.id); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {ws && <TransactionDialog open={open} onOpenChange={setOpen} workspaceId={ws.id} />}
    </AppShell>
  );
}
