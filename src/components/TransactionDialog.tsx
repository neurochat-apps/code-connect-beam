import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createTransaction, listCategories, listClients, createClient,
} from "@/lib/finanzas.functions";
import { Plus } from "lucide-react";

type Currency = "COP" | "USD";
type TxType = "ingreso" | "egreso";
type Account = "bancolombia" | "stripe" | "chase" | "efectivo" | "otra";

export function TransactionDialog({
  open, onOpenChange, workspaceId,
}: { open: boolean; onOpenChange: (v: boolean) => void; workspaceId: string }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createTransaction);
  const catsFn = useServerFn(listCategories);
  const cliFn = useServerFn(listClients);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => catsFn({ data: { workspace_id: workspaceId } }),
    enabled: open,
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients", workspaceId],
    queryFn: () => cliFn({ data: { workspace_id: workspaceId } }),
    enabled: open,
  });

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [concept, setConcept] = useState("");
  const [type, setType] = useState<TxType>("ingreso");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("COP");
  const [categoryId, setCategoryId] = useState<string>("");
  const [account, setAccount] = useState<Account>("bancolombia");
  const [clientId, setClientId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [pairCOP, setPairCOP] = useState("");
  const [pairAcc, setPairAcc] = useState<Account>("bancolombia");

  useEffect(() => {
    if (!open) {
      setConcept(""); setAmount(""); setNotes(""); setIsPending(false);
      setPairCOP(""); setCategoryId(""); setClientId("");
    }
  }, [open]);

  const selectedCat = categories.find((c: any) => c.id === categoryId);
  const isTransfer = selectedCat?.code === "00011";

  const mut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error("Monto inválido");
      return createFn({
        data: {
          workspace_id: workspaceId,
          date, concept, type, amount: amt, currency,
          category_id: categoryId || null,
          account, source: "manual",
          client_id: clientId || null,
          notes: notes || null,
          is_pending: isPending,
          pair_amount_cop: isTransfer && pairCOP ? parseFloat(pairCOP) : null,
          pair_account: isTransfer ? pairAcc : null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Transacción registrada");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredCats = categories.filter((c: any) => isTransfer || c.type === type || c.type === "neutro");

  const [newClientName, setNewClientName] = useState("");
  const [creatingClient, setCreatingClient] = useState(false);
  const createClientFn = useServerFn(createClient);
  async function handleCreateClient() {
    const name = newClientName.trim();
    if (!name) return;
    setCreatingClient(true);
    try {
      const c: any = await createClientFn({ data: { workspace_id: workspaceId, name } });
      await qc.invalidateQueries({ queryKey: ["clients", workspaceId] });
      setClientId(c.id);
      setNewClientName("");
      toast.success("Cliente creado");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingClient(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Nueva transacción</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as TxType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">Ingreso</SelectItem>
                  <SelectItem value="egreso">Egreso</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Concepto</Label>
            <Input value={concept} onChange={(e) => setConcept(e.target.value)} required placeholder="Ej: Pago IaChat" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Monto</Label>
              <Input type="number" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="COP">COP</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {filteredCats.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} · {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cuenta</Label>
              <Select value={account} onValueChange={(v) => setAccount(v as Account)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bancolombia">Bancolombia</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="chase">Chase</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="otra">Otra</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isTransfer && currency === "USD" && (
            <div className="rounded-lg border border-border bg-accent/30 p-3 space-y-3">
              <p className="text-xs text-muted-foreground">Transferencia USD→COP: ingresa el COP recibido y la cuenta destino.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>COP recibido</Label>
                  <Input type="number" step="1" value={pairCOP} onChange={(e) => setPairCOP(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cuenta COP</Label>
                  <Select value={pairAcc} onValueChange={(v) => setPairAcc(v as Account)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bancolombia">Bancolombia</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="otra">Otra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Cliente (opcional)</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPending} onChange={(e) => setIsPending(e.target.checked)} />
            Marcar como cartera pendiente
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "Guardando..." : "Guardar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
