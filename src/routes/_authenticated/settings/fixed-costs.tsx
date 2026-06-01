import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getMyWorkspaces, listFixedCosts, createFixedCost, updateFixedCost, deleteFixedCost, updateWorkspace,
} from "@/lib/finanzas.functions";
import { fmtCOP, fmtUSD } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/fixed-costs")({
  component: FixedCostsPage,
});

function FixedCostsPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const listFn = useServerFn(listFixedCosts);
  const createFn = useServerFn(createFixedCost);
  const updateFn = useServerFn(updateFixedCost);
  const delFn = useServerFn(deleteFixedCost);
  const updWs = useServerFn(updateWorkspace);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: () => wsFn() });
  const ws = workspaces[0];

  const { data: items = [] } = useQuery({
    queryKey: ["fixed_costs", ws?.id],
    queryFn: () => listFn({ data: { workspace_id: ws.id } }),
    enabled: !!ws?.id,
  });

  const upd = useMutation({
    mutationFn: (v: any) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fixed_costs"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["fixed_costs"] }); },
  });

  const rate = Number(ws?.usd_cop_rate ?? 4000);
  const totals = items.reduce((acc: any, f: any) => {
    if (!f.is_active) return acc;
    const a = Number(f.amount);
    if (f.currency === "USD") acc.usd += a;
    else acc.cop += a;
    return acc;
  }, { cop: 0, usd: 0 });
  const totalCOP = totals.cop + totals.usd * rate;

  return (
    <AppShell>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="font-serif text-4xl">Costos fijos</h1>
          <p className="text-sm text-muted-foreground mt-1">Configura los gastos mensuales recurrentes.</p>
        </div>

        <div className="rounded-2xl bg-card border border-border p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Total COP</div>
            <div className="num-serif text-2xl mt-1">{fmtCOP(totals.cop)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total USD</div>
            <div className="num-serif text-2xl mt-1">{fmtUSD(totals.usd)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total mensual (COP)</div>
            <div className="num-serif text-2xl mt-1 text-primary">{fmtCOP(totalCOP)}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">TRM {fmtCOP(rate)}/USD</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            TRM USD→COP:
            <Input className="w-28 h-8" type="number" defaultValue={rate}
              onBlur={(e) => {
                const v = parseFloat(e.target.value);
                if (v > 0 && v !== rate && ws) {
                  updWs({ data: { id: ws.id, usd_cop_rate: v } }).then(() => {
                    qc.invalidateQueries({ queryKey: ["workspaces"] });
                    toast.success("TRM actualizada");
                  });
                }
              }} />
          </label>
          <Button onClick={() => setOpen(true)} disabled={!ws}>
            <Plus className="size-4" /> Agregar
          </Button>
        </div>

        <div className="rounded-2xl bg-card border border-border overflow-hidden">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Sin costos fijos.</div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((f: any) => (
                <li key={f.id} className="p-4 flex items-center gap-3">
                  <input type="checkbox" checked={f.is_active}
                    onChange={(e) => upd.mutate({ id: f.id, is_active: e.target.checked })} />
                  <div className="flex-1 min-w-0">
                    <Input className="h-8 border-0 px-1 bg-transparent font-medium"
                      defaultValue={f.name}
                      onBlur={(e) => e.target.value !== f.name && upd.mutate({ id: f.id, name: e.target.value })} />
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-1">{f.category}</div>
                  </div>
                  <Input className="h-8 w-32 text-right num" type="number" step="0.01"
                    defaultValue={f.amount}
                    onBlur={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v !== Number(f.amount)) upd.mutate({ id: f.id, amount: v });
                    }} />
                  <span className="text-xs text-muted-foreground w-10">{f.currency}</span>
                  <Button variant="ghost" size="icon"
                    onClick={() => { if (confirm(`¿Eliminar ${f.name}?`)) del.mutate(f.id); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {ws && (
        <NewFixedCostDialog open={open} onOpenChange={setOpen} workspaceId={ws.id}
          onSave={async (v) => { await createFn({ data: { ...v, workspace_id: ws.id } }); qc.invalidateQueries({ queryKey: ["fixed_costs"] }); }} />
      )}
    </AppShell>
  );
}

function NewFixedCostDialog({
  open, onOpenChange, workspaceId, onSave,
}: { open: boolean; onOpenChange: (v: boolean) => void; workspaceId: string; onSave: (v: any) => Promise<void> }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"COP" | "USD">("COP");
  const [category, setCategory] = useState<"payroll" | "platform" | "other">("platform");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle className="font-serif text-2xl">Nuevo costo fijo</DialogTitle></DialogHeader>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const a = parseFloat(amount);
          if (!a || a < 0) { toast.error("Monto inválido"); return; }
          setSaving(true);
          try {
            await onSave({ name, amount: a, currency, category });
            setName(""); setAmount("");
            onOpenChange(false);
            toast.success("Agregado");
          } catch (e: any) { toast.error(e.message); }
          setSaving(false);
        }} className="space-y-4">
          <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Monto</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">COP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="payroll">Nómina</SelectItem>
                <SelectItem value="platform">Plataforma</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
