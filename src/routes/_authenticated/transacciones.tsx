import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getMyWorkspaces, listTransactions, deleteTransaction, deleteTransactions } from "@/lib/finanzas.functions";
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
  const delManyFn = useServerFn(deleteTransactions);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: () => wsFn() });
  const ws = workspaces[0];

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["txns", ws?.id],
    queryFn: () => listFn({ data: { workspace_id: ws.id, limit: 500 } }),
    enabled: !!ws?.id,
  });

  const allIds = useMemo(() => (txns as any[]).map((t) => t.id), [txns]);
  const allChecked = allIds.length > 0 && selected.size === allIds.length;
  const someChecked = selected.size > 0 && !allChecked;

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Eliminada"); qc.invalidateQueries(); },
    onError: (e: any) => toast.error(e.message),
  });

  const delMany = useMutation({
    mutationFn: () => delManyFn({ data: { workspace_id: ws.id, ids: Array.from(selected) } }),
    onSuccess: (r: any) => {
      toast.success(`Eliminadas ${r.deleted} transacciones`);
      setSelected(new Set());
      setConfirmOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(allIds));
  }

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
            <>
              <div className="p-3 px-4 border-b border-border flex items-center gap-3 bg-muted/30">
                <Checkbox
                  checked={allChecked ? true : someChecked ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">
                  {selected.size > 0 ? `${selected.size} seleccionadas` : `${txns.length} transacciones`}
                </span>
              </div>
              <ul className="divide-y divide-border">
                {(txns as any[]).map((t) => (
                  <li key={t.id} className="p-4 flex items-center gap-3">
                    <Checkbox
                      checked={selected.has(t.id)}
                      onCheckedChange={() => toggle(t.id)}
                    />
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
                      t.type === "ingreso" ? "text-primary"
                        : t.type === "neutro" ? "text-muted-foreground"
                        : "text-foreground")}>
                      {t.type === "ingreso" ? "+" : t.type === "neutro" ? "⇄ " : "−"}{t.currency === "USD" ? fmtUSD(t.amount) : fmtCOP(t.amount)}
                    </div>

                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("¿Eliminar?")) del.mutate(t.id); }}>
                      <Trash2 className="size-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border border-border shadow-lg rounded-full px-4 py-2 flex items-center gap-3">
          <span className="text-sm">{selected.size} seleccionadas</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Cancelar</Button>
          <Button size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" /> Eliminar
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selected.size} transacciones?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. También se eliminarán transacciones emparejadas (transferencias USD↔COP).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); delMany.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {delMany.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {ws && <TransactionDialog open={open} onOpenChange={setOpen} workspaceId={ws.id} />}
    </AppShell>
  );
}
