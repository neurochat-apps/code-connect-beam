import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, X, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TransactionDialog } from "@/components/TransactionDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getMyWorkspaces, listTransactions, listCategories, deleteTransaction, deleteTransactions } from "@/lib/finanzas.functions";
import { fmtCOP, fmtUSD, fmtShortDate, monthRange } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/transacciones")({
  component: TxnPage,
});




function TxnPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const listFn = useServerFn(listTransactions);
  const catsFn = useServerFn(listCategories);
  const delFn = useServerFn(deleteTransaction);
  const delManyFn = useServerFn(deleteTransactions);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Filtros
  const [ym, setYm] = useState<string>(""); // "" = todos, else YYYY-MM
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("all"); // "all" | "none" | uuid
  const [account, setAccount] = useState<string>("all");
  const [txType, setTxType] = useState<string>("all");

  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: () => wsFn() });
  const ws = workspaces[0];

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", ws?.id],
    queryFn: () => catsFn({ data: { workspace_id: ws.id } }),
    enabled: !!ws?.id,
  });

  const effectiveRange = useMemo(() => {
    if (ym) return monthRange(ym);
    return { from: from || undefined, to: to || undefined };
  }, [ym, from, to]);

  const listArgs = useMemo(() => {
    const a: any = { workspace_id: ws?.id, limit: 500 };
    if (effectiveRange.from) a.from = effectiveRange.from;
    if (effectiveRange.to) a.to = effectiveRange.to;
    if (categoryId !== "all") a.category_id = categoryId;
    if (account !== "all") a.account = account;
    if (txType !== "all") a.type = txType;
    return a;
  }, [ws?.id, effectiveRange, categoryId, account, txType]);

  const { data: txns = [], isLoading } = useQuery({
    queryKey: ["txns", listArgs],
    queryFn: () => listFn({ data: listArgs }),
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

  function clearFilters() {
    setYm(""); setFrom(""); setTo("");
    setCategoryId("all"); setAccount("all"); setTxType("all");
  }
  const activeFilters =
    (ym ? 1 : 0) + (from || to ? 1 : 0) +
    (categoryId !== "all" ? 1 : 0) +
    (account !== "all" ? 1 : 0) +
    (txType !== "all" ? 1 : 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-4xl">Transacciones</h1>
            <p className="text-sm text-muted-foreground mt-1">Todos los movimientos</p>
          </div>
          <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={!ws}>
            <Plus className="size-4" /> Registrar
          </Button>
        </div>

        {/* Filtros */}
        <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Filtros {activeFilters > 0 && <span className="text-xs text-muted-foreground">· {activeFilters} activos</span>}</div>
            {activeFilters > 0 && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X className="size-3.5" /> Limpiar
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Mes</Label>
              <Input type="month" value={ym} onChange={(e) => { setYm(e.target.value); setFrom(""); setTo(""); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setYm(""); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setYm(""); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {(categories as any[]).map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cuenta</Label>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="bancolombia">Bancolombia</SelectItem>
                  <SelectItem value="chase">Chase</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="otra">Otra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={txType} onValueChange={setTxType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                  <SelectItem value="neutro">Neutro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Cargando...</div>
          ) : txns.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No hay transacciones con estos filtros.</div>
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
                        {t.category ? (<><span>·</span><span>{t.category.name}</span></>) : (<><span>·</span><span className="text-warning">Sin categoría</span></>)}
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

                    <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setOpen(true); }}>
                      <Pencil className="size-4" />
                    </Button>
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
