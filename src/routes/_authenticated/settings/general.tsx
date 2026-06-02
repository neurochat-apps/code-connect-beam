import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMyWorkspaces, updateWorkspace } from "@/lib/finanzas.functions";
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
      </div>
    </AppShell>
  );
}
