import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyWorkspaces, updateWorkspace, generateCarryover } from "@/lib/finanzas.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/general")({
  component: GeneralPage,
});

function GeneralPage() {
  const wsFn = useServerFn(getMyWorkspaces);
  const updFn = useServerFn(updateWorkspace);
  const qc = useQueryClient();

  const { data: workspaces = [] } = useQuery({ queryKey: ["workspaces"], queryFn: () => wsFn() });
  const ws = workspaces[0];

  const [name, setName] = useState("");
  const [rate, setRate] = useState<number>(4000);
  const [tgId, setTgId] = useState("");
  const [goal, setGoal] = useState<number>(0);

  useEffect(() => {
    if (ws) {
      setName(ws.name);
      setRate(Number(ws.usd_cop_rate));
      setTgId(ws.telegram_group_id ?? "");
      setGoal(Number((ws as any).monthly_goal ?? 0));
    }
  }, [ws?.id]);

  const save = useMutation({
    mutationFn: () => updFn({ data: {
      id: ws.id, name, usd_cop_rate: rate, telegram_group_id: tgId || null, monthly_goal: goal,
    }}),
    onSuccess: () => { toast.success("Guardado"); qc.invalidateQueries({ queryKey: ["workspaces"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="max-w-xl space-y-6">
        <div>
          <h1 className="font-serif text-4xl">Configuración</h1>
          <p className="text-sm text-muted-foreground mt-1">Espacio de trabajo, tasa de cambio y meta.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <Label>Nombre del workspace</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>TRM (COP por 1 USD)</Label>
            <Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          </div>
          <div>
            <Label>Meta de facturación mensual (COP)</Label>
            <Input type="number" value={goal} onChange={(e) => setGoal(Number(e.target.value))} placeholder="Ej: 50000000" />
            <p className="text-xs text-muted-foreground mt-1">Se usa en la barra de progreso del dashboard.</p>
          </div>
          <div>
            <Label>Telegram Group ID</Label>
            <Input value={tgId} onChange={(e) => setTgId(e.target.value)} placeholder="5187124619" />
            <p className="text-xs text-muted-foreground mt-1">Solo mensajes de este grupo serán procesados.</p>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !ws}>Guardar</Button>
        </div>

        <CarryoverCard workspaceId={ws?.id} />
      </div>
    </AppShell>
  );
}

function CarryoverCard({ workspaceId }: { workspaceId?: string }) {
  const fn = useServerFn(generateCarryover);
  const qc = useQueryClient();
  const now = new Date();
  const defaultTarget = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const [target, setTarget] = useState(defaultTarget);
  const run = useMutation({
    mutationFn: () => fn({ data: { workspace_id: workspaceId!, target_month: target } }),
    onSuccess: (r: any) => {
      if (r.id) toast.success("Saldo del mes anterior registrado");
      else toast.info("No hay saldo neto para arrastrar (o ya existe)");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
  });
  const prev = new Date(target);
  prev.setDate(0);
  const prevLabel = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div>
        <h2 className="font-serif text-2xl">Flujo de caja acumulado</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Cada día 1 se crea automáticamente una transacción con el saldo neto del mes anterior
          (categoría 00015). Úsalo aquí para generar meses pasados manualmente.
        </p>
      </div>
      <div>
        <Label>Mes destino (día 1)</Label>
        <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} />
        <p className="text-xs text-muted-foreground mt-1">Tomará el neto de {prevLabel}.</p>
      </div>
      <Button onClick={() => run.mutate()} disabled={run.isPending || !workspaceId} variant="outline">
        {run.isPending ? "Calculando..." : "Generar saldo de mes anterior"}
      </Button>
    </div>
  );
}

