import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getMyWorkspaces, listCategories, listClients,
  createCategory, updateCategory, deleteCategory,
  createClient, updateClient, deleteClient,
} from "@/lib/finanzas.functions";

export const Route = createFileRoute("/_authenticated/settings/catalog")({
  component: CatalogPage,
});

function CatalogPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: () => wsFn() });
  const ws = workspaces[0];

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="font-serif text-4xl">Categorías y clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestiona el catálogo de tu espacio</p>
        </div>
        {ws && (
          <div className="grid lg:grid-cols-2 gap-8">
            <CategoriesPanel workspaceId={ws.id} />
            <ClientsPanel workspaceId={ws.id} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

// ---------- CATEGORIES ----------
function CategoriesPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listCategories);
  const createFn = useServerFn(createCategory);
  const updateFn = useServerFn(updateCategory);
  const deleteFn = useServerFn(deleteCategory);

  const { data: cats = [] } = useQuery({
    queryKey: ["categories", workspaceId],
    queryFn: () => listFn({ data: { workspace_id: workspaceId } }),
  });

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"ingreso" | "egreso" | "neutro">("egreso");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState<"ingreso" | "egreso" | "neutro">("egreso");

  const create = useMutation({
    mutationFn: () => createFn({ data: { workspace_id: workspaceId, code: code.trim(), name: name.trim(), type } }),
    onSuccess: () => {
      toast.success("Categoría creada");
      setCode(""); setName("");
      qc.invalidateQueries({ queryKey: ["categories", workspaceId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (id: string) => updateFn({ data: { id, name: editName.trim(), type: editType } }),
    onSuccess: () => {
      toast.success("Actualizada");
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["categories", workspaceId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Eliminada"); qc.invalidateQueries({ queryKey: ["categories", workspaceId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl bg-card border border-border p-5 space-y-4">
      <h2 className="font-serif text-xl">Categorías</h2>

      <div className="grid grid-cols-[80px_1fr_120px_auto] gap-2 items-end">
        <div className="space-y-1"><Label className="text-xs">Código</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="00099" /></div>
        <div className="space-y-1"><Label className="text-xs">Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría" /></div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ingreso">Ingreso</SelectItem>
              <SelectItem value="egreso">Egreso</SelectItem>
              <SelectItem value="neutro">Neutro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => create.mutate()} disabled={!code.trim() || !name.trim() || create.isPending}>
          <Plus className="size-4" />
        </Button>
      </div>

      <ul className="divide-y divide-border">
        {cats.map((c: any) => (
          <li key={c.id} className="py-2 flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground w-14">{c.code}</span>
            {editingId === c.id ? (
              <>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 flex-1" />
                <Select value={editType} onValueChange={(v) => setEditType(v as any)}>
                  <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                    <SelectItem value="neutro">Neutro</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="icon" variant="ghost" onClick={() => update.mutate(c.id)}><Check className="size-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="size-4" /></Button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-xs text-muted-foreground capitalize w-16">{c.type}</span>
                {c.is_system && <span className="text-[10px] uppercase text-muted-foreground">sistema</span>}
                <Button size="icon" variant="ghost" onClick={() => { setEditingId(c.id); setEditName(c.name); setEditType(c.type); }}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="icon" variant="ghost" disabled={c.is_system} onClick={() => { if (confirm("¿Eliminar categoría?")) del.mutate(c.id); }}>
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------- CLIENTS ----------
function ClientsPanel({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listClients);
  const createFn = useServerFn(createClient);
  const updateFn = useServerFn(updateClient);
  const deleteFn = useServerFn(deleteClient);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", workspaceId],
    queryFn: () => listFn({ data: { workspace_id: workspaceId } }),
  });

  const [form, setForm] = useState({
    name: "", type: "recurrente" as "recurrente" | "proyecto" | "cuota",
    currency: "COP" as "COP" | "USD", amount: "",
  });

  const create = useMutation({
    mutationFn: () => {
      const amt = parseFloat(form.amount);
      const payload: any = {
        workspace_id: workspaceId,
        name: form.name.trim(),
        type: form.type,
        currency: form.currency,
        status: "activo",
      };
      if (form.type === "recurrente" && !isNaN(amt)) payload.monthly_amount = amt;
      if (form.type !== "recurrente" && !isNaN(amt)) payload.project_total = amt;
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success("Cliente creado");
      setForm({ name: "", type: "recurrente", currency: "COP", amount: "" });
      qc.invalidateQueries({ queryKey: ["clients", workspaceId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) => updateFn({ data: { id, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", workspaceId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Eliminado"); qc.invalidateQueries({ queryKey: ["clients", workspaceId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="rounded-2xl bg-card border border-border p-5 space-y-4">
      <h2 className="font-serif text-xl">Clientes</h2>

      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input type="number" placeholder={form.type === "recurrente" ? "Monto mensual" : "Total proyecto"}
          value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recurrente">Recurrente</SelectItem>
            <SelectItem value="proyecto">Proyecto</SelectItem>
            <SelectItem value="cuota">Cuota</SelectItem>
          </SelectContent>
        </Select>
        <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v as any })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="COP">COP</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button size="sm" onClick={() => create.mutate()} disabled={!form.name.trim() || create.isPending}>
        <Plus className="size-4" /> Agregar cliente
      </Button>

      <ul className="divide-y divide-border">
        {clients.map((c: any) => (
          <li key={c.id} className="py-2 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{c.name}</div>
              <div className="text-xs text-muted-foreground">
                {c.type} · {c.currency} ·{" "}
                {c.type === "recurrente"
                  ? `${Number(c.monthly_amount ?? 0).toLocaleString()}/mes`
                  : `total ${Number(c.project_total ?? 0).toLocaleString()}`}
              </div>
            </div>
            <Select value={c.status} onValueChange={(v) => updateStatus.mutate({ id: c.id, status: v })}>
              <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="pausado">Pausado</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant="ghost" onClick={() => { if (confirm("¿Eliminar cliente?")) del.mutate(c.id); }}>
              <Trash2 className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
