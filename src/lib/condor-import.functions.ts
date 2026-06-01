import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { extractSpreadsheetId, getSpreadsheetMeta, getSheetValues } from "./sheets.server";

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function detectSheet(title: string): { month: number; year: number; currency: "COP" | "USD" } | null {
  const t = title.toLowerCase().trim();
  let month: number | null = null;
  for (const [name, num] of Object.entries(MONTHS)) {
    if (t.includes(name)) { month = num; break; }
  }
  if (!month) return null;
  const yearMatch = t.match(/20\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
  const currency: "COP" | "USD" = /dolar|usd|dollar/.test(t) ? "USD" : "COP";
  return { month, year, currency };
}

function parseAmount(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[^\d,.\-]/g, "").trim();
  if (!s) return 0;
  // Colombian format: "1.234.567,89" → 1234567.89
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(s.replace(/,/g, "")) || 0;
}

function parseDate(v: any, fallbackMonth: number, fallbackYear: number): string | null {
  if (!v) return null;
  const s = String(v).trim();
  // DD/MM/YYYY or D/M/YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]);
    let y = Number(m[3]); if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  // Just day number → use fallback month/year
  const n = Number(s);
  if (Number.isFinite(n) && n >= 1 && n <= 31) {
    return `${fallbackYear}-${String(fallbackMonth).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
  }
  return null;
}

export const importCondorSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspace_id: z.string().uuid(),
      url: z.string().min(10),
      since_year: z.number().int().min(2020).max(2100).default(2026),
      since_month: z.number().int().min(1).max(12).default(6),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const sid = extractSpreadsheetId(data.url);
    if (!sid) throw new Error("URL de Google Sheets inválida");

    const meta = await getSpreadsheetMeta(sid);
    const batchId = crypto.randomUUID();
    const sinceKey = data.since_year * 100 + data.since_month;

    let inserted = 0;
    const perSheet: { sheet: string; rows: number; skipped: number }[] = [];

    for (const sh of meta.sheets) {
      const info = detectSheet(sh.title);
      if (!info) continue;
      if (info.year * 100 + info.month < sinceKey) continue;

      // Read columns B..G from row 8: FECHA | CONCEPTO | Cod | ENTRADAS | SALIDAS | SALDO
      const range = `'${sh.title.replace(/'/g, "''")}'!B8:G1000`;
      const rows = await getSheetValues(sid, range);

      let sheetInserted = 0;
      let sheetSkipped = 0;
      const toInsert: any[] = [];

      for (const row of rows) {
        const date = parseDate(row[0], info.month, info.year);
        const concept = (row[1] ?? "").toString().trim();
        const entrada = parseAmount(row[3]);
        const salida = parseAmount(row[4]);

        if (!date || !concept) { sheetSkipped++; continue; }
        if (entrada === 0 && salida === 0) { sheetSkipped++; continue; }

        if (entrada > 0) {
          toInsert.push({
            workspace_id: data.workspace_id, date, concept: concept.slice(0, 500),
            type: "ingreso", amount: entrada, currency: info.currency,
            account: info.currency === "USD" ? "chase" : "bancolombia",
            source: "import", import_batch_id: batchId,
            notes: `${sh.title}`,
          });
        }
        if (salida > 0) {
          toInsert.push({
            workspace_id: data.workspace_id, date, concept: concept.slice(0, 500),
            type: "egreso", amount: salida, currency: info.currency,
            account: info.currency === "USD" ? "chase" : "bancolombia",
            source: "import", import_batch_id: batchId,
            notes: `${sh.title}`,
          });
        }
      }

      if (toInsert.length > 0) {
        // chunked insert
        for (let i = 0; i < toInsert.length; i += 500) {
          const chunk = toInsert.slice(i, i + 500);
          const { error } = await supabase.from("transactions").insert(chunk);
          if (error) throw new Error(`${sh.title}: ${error.message}`);
          sheetInserted += chunk.length;
        }
      }
      inserted += sheetInserted;
      perSheet.push({ sheet: sh.title, rows: sheetInserted, skipped: sheetSkipped });
    }

    return { batchId, inserted, perSheet };
  });
