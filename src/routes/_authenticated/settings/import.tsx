import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { previewSheet, importSheet, revertImport } from "@/lib/import.functions";
import { syncStripeAccount } from "@/lib/stripe-sync.functions";
import { previewCondorSheet, importCondorMonths } from "@/lib/condor-import.functions";
import { deleteAllTransactions } from "@/lib/finanzas.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/import")({
  component: ImportPage,
});

const FIELDS = [
  { key: "date", label: "Fecha *" },
  { key: "concept", label: "Concepto *" },
  { key: "amount", label: "Monto *" },
  { key: "type", label: "Tipo (ingreso/egreso)" },
  { key: "currency", label: "Moneda" },
  { key: "category", label: "Categoría" },
  { key: "client", label: "Cliente" },
  { key: "account", label: "Cuenta" },
  { key: "notes", label: "Notas" },
] as const;

type CondorMonth = {
  key: string;
  year: number;
  month: number;
  currency: "COP" | "USD";
  sheetTitle: string;
  ingresos: number;
  egresos: number;
  transferIn: number;
  transferOut: number;
  sheetEntradas: number;
  sheetSalidas: number;
  countRows: number;
  countSkipped: number;
};

const MES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const fmt = (n: number, cur: string) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

function ImportPage() {
  const previewFn = useServerFn(previewSheet);
  const importFn = useServerFn(importSheet);
  const revertFn = useServerFn(revertImport);
  const stripeSyncFn = useServerFn(syncStripeAccount);
  const condorPreviewFn = useServerFn(previewCondorSheet);
  const condorImportFn = useServerFn(importCondorMonths);
  const wipeFn = useServerFn(deleteAllTransactions);

  const [stripeSince, setStripeSince] = useState("2026-06-01");
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeResult, setStripeResult] = useState<{ inserted: number; skipped: number; scanned: number } | null>(null);

  const [condorUrl, setCondorUrl] = useState("https://docs.google.com/spreadsheets/d/1VAOPJvrYMDZthudxHfzEbtcvcQpdNhDLb2W71no54iY/edit");
  const [condorSince, setCondorSince] = useState("2026-01");
  const [condorLoading, setCondorLoading] = useState(false);
  const [condorMonths, setCondorMonths] = useState<CondorMonth[] | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [condorImportResult, setCondorImportResult] = useState<{ inserted: number; paired: number } | null>(null);

  const [wipeConfirm, setWipeConfirm] = useState("");
  const [wipeLoading, setWipeLoading] = useState(false);

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("id,name,usd_cop_rate").order("created_at");
      return data ?? [];
    },
  });
  const wsId = workspaces?.[0]?.id;
  const wsRate = Number(workspaces?.[0]?.usd_cop_rate ?? 4000);

  async function doWipe() {
    if (!wsId || wipeConfirm !== "ELIMINAR") return;
    setWipeLoading(true);
    try {
      const r = await wipeFn({ data: { workspace_id: wsId, confirm: "ELIMINAR" } });
      toast.success(`Eliminadas ${r.deleted} transacciones`);
      setWipeConfirm("");
    } catch (e: any) { toast.error(e.message); }
    finally { setWipeLoading(false); }
  }

  async function doStripeSync() {
    if (!wsId) return;
    setStripeLoading(true); setStripeResult(null);
    try {
      const r = await stripeSyncFn({ data: { workspace_id: wsId, since: stripeSince } });
      setStripeResult(r);
      toast.success(`Stripe: ${r.inserted} nuevas (${r.scanned} revisadas)`);
    } catch (e: any) { toast.error(e.message); }
    finally { setStripeLoading(false); }
  }

  async function doCondorPreview() {
    if (!wsId) return;
    const [y, m] = condorSince.split("-").map(Number);
    setCondorLoading(true); setCondorMonths(null); setCondorImportResult(null);
    try {
      const r = await condorPreviewFn({ data: { url: condorUrl, since_year: y, since_month: m } });
      setCondorMonths(r.months);
      setSelectedKeys(new Set(r.months.map((x) => x.key)));
      toast.success(`Analizadas ${r.months.length} hojas`);
    } catch (e: any) { toast.error(e.message); }
    finally { setCondorLoading(false); }
  }

  async function doCondorImport() {
    if (!wsId || !condorMonths || selectedKeys.size === 0) return;
    const [y, m] = condorSince.split("-").map(Number);
    setCondorLoading(true); setCondorImportResult(null);
    try {
      const r = await condorImportFn({
        data: {
          workspace_id: wsId, url: condorUrl,
          since_year: y, since_month: m,
          keys: Array.from(selectedKeys),
          replace: true,
        },
      });
      setCondorImportResult({ inserted: r.inserted, paired: r.paired });
      toast.success(`Importadas ${r.inserted} transacciones · ${r.paired} transferencias emparejadas`);
    } catch (e: any) { toast.error(e.message); }
    finally { setCondorLoading(false); }
  }

  function toggleKey(k: string) {
    const next = new Set(selectedKeys);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelectedKeys(next);
  }
  function toggleAll() {
    if (!condorMonths) return;
    if (selectedKeys.size === condorMonths.length) setSelectedKeys(new Set());
    else setSelectedKeys(new Set(condorMonths.map((x) => x.key)));
  }

  // ---- bloque legacy mapeo manual ----
  const [url, setUrl] = useState("");
  const [sheetTitle, setSheetTitle] = useState<string | undefined>();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewSheet>> | null>(null);
  const [mapping, setMapping] = useState<Record<string, number | null>>({});
  const [startRow, setStartRow] = useState(2);
  const [endRow, setEndRow] = useState(10000);
  const [defaultType, setDefaultType] = useState<"ingreso" | "egreso" | "auto">("auto");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ batchId: string; inserted: number; skipped: any[] } | null>(null);

  async function doPreview() {
    setLoading(true); setResult(null);
    try {
      const r = await previewFn({ data: { url, sheet_title: sheetTitle } });
      setPreview(r); setSheetTitle(r.activeSheet); setMapping(r.autoMap);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  async function doImport() {
    if (!wsId || !preview) return;
    setLoading(true);
    try {
      const r = await importFn({
        data: {
          workspace_id: wsId, url, sheet_title: preview.activeSheet,
          start_row: startRow, end_row: endRow,
          mapping: mapping as any, default_type: defaultType,
        },
      });
      setResult(r);
      toast.success(`Importadas ${r.inserted} transacciones`);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  async function doRevert() {
    if (!wsId || !result) return;
    if (!confirm(`¿Eliminar las ${result.inserted} transacciones del último import?`)) return;
    setLoading(true);
    try {
      const r = await revertFn({ data: { workspace_id: wsId, batch_id: result.batchId } });
      toast.success(`Eliminadas ${r.deleted}`); setResult(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="font-serif text-3xl">Importar transacciones</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sincroniza Stripe o importa desde Google Sheets.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle>Sincronizar Stripe (respaldo)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Los pagos de Stripe se registran <b>automáticamente en tiempo real</b> vía webhook, con categoría <b>Ingresos por Ventas</b>. Usa este botón solo si sospechas que falta algún movimiento histórico. Es idempotente — no duplica.
            </p>
            <div className="flex gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Desde</Label>
                <Input type="date" value={stripeSince} onChange={(e) => setStripeSince(e.target.value)} className="w-44" />
              </div>
              <Button onClick={doStripeSync} disabled={stripeLoading || !wsId}>
                {stripeLoading ? "Sincronizando..." : "Sincronizar Stripe"}
              </Button>
            </div>
            {stripeResult && (
              <p className="text-sm">
                <b>{stripeResult.inserted}</b> nuevas · {stripeResult.skipped} omitidas · {stripeResult.scanned} revisadas
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Importar Cóndor (Google Sheet)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Lee las hojas mensuales (pesos + dólares), detecta transferencias USD→COP por código <b>00010</b> y las empareja para no contar doble ingreso.
              Tasa actual del workspace: <b>{wsRate.toLocaleString()} COP/USD</b>.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">URL del sheet</Label>
              <Input value={condorUrl} onChange={(e) => setCondorUrl(e.target.value)} />
            </div>
            <div className="flex gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-xs">Desde (YYYY-MM)</Label>
                <Input value={condorSince} onChange={(e) => setCondorSince(e.target.value)} className="w-44" placeholder="2026-01" />
              </div>
              <Button onClick={doCondorPreview} disabled={condorLoading || !wsId || !condorUrl}>
                {condorLoading ? "Analizando..." : "1. Analizar sheet"}
              </Button>
            </div>

            {condorMonths && condorMonths.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">2. Revisa y selecciona meses a importar</p>
                  <Button size="sm" variant="ghost" onClick={toggleAll}>
                    {selectedKeys.size === condorMonths.length ? "Deseleccionar todo" : "Seleccionar todo"}
                  </Button>
                </div>
                <div className="overflow-x-auto text-xs border rounded">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 w-8"></th>
                        <th className="p-2 text-left">Mes</th>
                        <th className="p-2 text-left">Cur</th>
                        <th className="p-2 text-right">Ingresos op.</th>
                        <th className="p-2 text-right">Egresos op.</th>
                        <th className="p-2 text-right">Transf in</th>
                        <th className="p-2 text-right">Transf out</th>
                        <th className="p-2 text-right">Σ Sheet Entradas</th>
                        <th className="p-2 text-right">Σ Sheet Salidas</th>
                        <th className="p-2 text-right">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {condorMonths.map((m) => {
                        const calcEntradas = m.ingresos + m.transferIn;
                        const calcSalidas = m.egresos + m.transferOut;
                        const diffIn = calcEntradas - m.sheetEntradas;
                        const diffOut = calcSalidas - m.sheetSalidas;
                        const ok = Math.abs(diffIn) < 1 && Math.abs(diffOut) < 1;
                        return (
                          <tr key={m.key} className="border-t">
                            <td className="p-2">
                              <Checkbox
                                checked={selectedKeys.has(m.key)}
                                onCheckedChange={() => toggleKey(m.key)}
                              />
                            </td>
                            <td className="p-2 font-medium">{MES[m.month - 1]} {m.year}</td>
                            <td className="p-2">{m.currency}</td>
                            <td className="p-2 text-right">{fmt(m.ingresos, m.currency)}</td>
                            <td className="p-2 text-right">{fmt(m.egresos, m.currency)}</td>
                            <td className="p-2 text-right text-muted-foreground">{fmt(m.transferIn, m.currency)}</td>
                            <td className="p-2 text-right text-muted-foreground">{fmt(m.transferOut, m.currency)}</td>
                            <td className="p-2 text-right">{fmt(m.sheetEntradas, m.currency)}</td>
                            <td className="p-2 text-right">{fmt(m.sheetSalidas, m.currency)}</td>
                            <td className={`p-2 text-right font-medium ${ok ? "text-green-600" : "text-destructive"}`}>
                              {ok ? "✓" : `${fmt(diffIn, m.currency)} / ${fmt(diffOut, m.currency)}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  "Ingresos op." y "Egresos op." excluyen transferencias (código 00010). Σ Sheet es la suma cruda de las columnas ENTRADAS/SALIDAS de la hoja.
                  Δ verde = los totales calculados cuadran con el sheet.
                </p>
                <Button onClick={doCondorImport} disabled={condorLoading || selectedKeys.size === 0}>
                  {condorLoading ? "Importando..." : `3. Importar ${selectedKeys.size} mes(es) seleccionados`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Al importar se eliminan transacciones previas de tipo "import" del mismo mes/moneda para evitar duplicados.
                </p>
              </div>
            )}
            {condorImportResult && (
              <div className="rounded border border-primary p-3 text-sm">
                ✓ <b>{condorImportResult.inserted}</b> transacciones insertadas · <b>{condorImportResult.paired}</b> transferencias USD↔COP emparejadas.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Google Sheets — mapeo manual</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL de Google Sheets</Label>
              <div className="flex gap-2">
                <Input value={url} onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..." />
                <Button onClick={doPreview} disabled={!url || loading}>
                  {loading ? "Cargando..." : "Vista previa"}
                </Button>
              </div>
            </div>

            {preview && preview.sheets.length > 1 && (
              <div className="space-y-2">
                <Label>Hoja</Label>
                <Select value={sheetTitle} onValueChange={(v) => { setSheetTitle(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {preview.sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={doPreview}>Recargar hoja</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {preview && (
          <>
            <Card>
              <CardHeader><CardTitle>Mapeo de columnas</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Select
                      value={mapping[f.key] != null ? String(mapping[f.key]) : "none"}
                      onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === "none" ? null : Number(v) })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— ninguna —</SelectItem>
                        {preview.headers.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>{h || `Col ${i + 1}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Rango y opciones</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fila inicial</Label>
                  <Input type="number" value={startRow} onChange={(e) => setStartRow(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fila final</Label>
                  <Input type="number" value={endRow} onChange={(e) => setEndRow(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo por defecto</Label>
                  <Select value={defaultType} onValueChange={(v: any) => setDefaultType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (por signo)</SelectItem>
                      <SelectItem value="ingreso">Todo ingreso</SelectItem>
                      <SelectItem value="egreso">Todo egreso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button onClick={doImport} disabled={loading || !wsId}>
                {loading ? "Importando..." : "Importar transacciones"}
              </Button>
            </div>
          </>
        )}

        {result && (
          <Card className="border-primary">
            <CardHeader><CardTitle>Resultado</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">
                <b>{result.inserted}</b> transacciones · {result.skipped.length} omitidas.
              </p>
              <Button variant="destructive" size="sm" onClick={doRevert}>Deshacer</Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-destructive/40">
          <CardHeader><CardTitle className="text-destructive">Zona peligrosa</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Elimina TODAS las transacciones del workspace.
            </p>
            <div className="flex gap-2 items-end">
              <div className="space-y-1 flex-1 max-w-xs">
                <Label className="text-xs">Escribe <b>ELIMINAR</b></Label>
                <Input value={wipeConfirm} onChange={(e) => setWipeConfirm(e.target.value)} placeholder="ELIMINAR" />
              </div>
              <Button variant="destructive" onClick={doWipe} disabled={wipeConfirm !== "ELIMINAR" || wipeLoading || !wsId}>
                {wipeLoading ? "Eliminando..." : "Eliminar todas"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
