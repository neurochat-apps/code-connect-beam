import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { previewSheet, importSheet, revertImport } from "@/lib/import.functions";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function ImportPage() {
  const previewFn = useServerFn(previewSheet);
  const importFn = useServerFn(importSheet);
  const revertFn = useServerFn(revertImport);

  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: async () => {
      const { data } = await supabase.from("workspaces").select("id,name").order("created_at");
      return data ?? [];
    },
  });
  const wsId = workspaces?.[0]?.id;

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
      setPreview(r);
      setSheetTitle(r.activeSheet);
      setMapping(r.autoMap);
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
      toast.success(`Eliminadas ${r.deleted} transacciones`);
      setResult(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <div>
          <h1 className="font-serif text-3xl">Importar desde Google Sheets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pega el link de tu hoja consolidada y mapea las columnas para cargar tu histórico.
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle>1. Hoja de cálculo</CardTitle></CardHeader>
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
              <p className="text-xs text-muted-foreground">
                La hoja debe estar compartida con el correo del conector Google Sheets (o ser pública).
              </p>
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
              <CardHeader><CardTitle>2. Mapeo de columnas</CardTitle></CardHeader>
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
              <CardHeader><CardTitle>3. Rango y opciones</CardTitle></CardHeader>
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
                      <SelectItem value="auto">Auto (por signo del monto)</SelectItem>
                      <SelectItem value="ingreso">Todo ingreso</SelectItem>
                      <SelectItem value="egreso">Todo egreso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>4. Vista previa (primeras 20 filas)</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto text-xs">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        {preview.headers.map((h, i) => (
                          <th key={i} className="border border-border px-2 py-1 text-left font-medium">{h || `Col ${i + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row, i) => (
                        <tr key={i}>
                          {preview.headers.map((_, j) => (
                            <td key={j} className="border border-border px-2 py-1">{String(row[j] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                <b>{result.inserted}</b> transacciones importadas.{" "}
                {result.skipped.length > 0 && <span>{result.skipped.length} filas omitidas.</span>}
              </p>
              {result.skipped.length > 0 && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Ver filas omitidas</summary>
                  <ul className="mt-2 space-y-0.5">
                    {result.skipped.slice(0, 50).map((s, i) => (
                      <li key={i}>Fila {s.row}: {s.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
              <Button variant="destructive" size="sm" onClick={doRevert}>
                Deshacer esta importación
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
