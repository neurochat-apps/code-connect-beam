import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { extractSpreadsheetId, getSpreadsheetMeta, getSheetValues } from "./sheets.server";

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const TRANSFER_CODE = "00010";

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
  if (s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")) {
    return Number(s.replace(/\./g, "").replace(",", ".")) || 0;
  }
  return Number(s.replace(/,/g, "")) || 0;
}

function parseDate(v: any, fallbackMonth: number, fallbackYear: number): string | null {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = Number(m[1]), mo = Number(m[2]);
    let y = Number(m[3]); if (y < 100) y += 2000;
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  const n = Number(s);
  if (Number.isFinite(n) && n >= 1 && n <= 31) {
    return `${fallbackYear}-${String(fallbackMonth).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
  }
  return null;
}

type ParsedRow = {
  date: string;
  concept: string;
  code: string;
  entrada: number;
  salida: number;
  isTransfer: boolean;
};

type MonthBucket = {
  key: string;             // "2026-06-COP"
  year: number;
  month: number;
  currency: "COP" | "USD";
  sheetTitle: string;
  rows: ParsedRow[];
  totals: {
    ingresos: number;      // excluye transferencias
    egresos: number;       // excluye transferencias
    transferIn: number;
    transferOut: number;
    sheetEntradas: number; // suma cruda columna ENTRADAS
    sheetSalidas: number;  // suma cruda columna SALIDAS
    countRows: number;
    countSkipped: number;
  };
};

async function parseAllSheets(url: string, sinceYear: number, sinceMonth: number) {
  const sid = extractSpreadsheetId(url);
  if (!sid) throw new Error("URL de Google Sheets inválida");
  const meta = await getSpreadsheetMeta(sid);
  const sinceKey = sinceYear * 100 + sinceMonth;
  const buckets: MonthBucket[] = [];

  for (const sh of meta.sheets) {
    const info = detectSheet(sh.title);
    if (!info) continue;
    if (info.year * 100 + info.month < sinceKey) continue;

    const range = `'${sh.title.replace(/'/g, "''")}'!B8:G1000`;
    const rows = await getSheetValues(sid, range);

    const parsed: ParsedRow[] = [];
    let sheetEntradas = 0, sheetSalidas = 0, skipped = 0;

    for (const row of rows) {
      const date = parseDate(row[0], info.month, info.year);
      const concept = (row[1] ?? "").toString().trim();
      const code = (row[2] ?? "").toString().trim();
      const entrada = parseAmount(row[3]);
      const salida = parseAmount(row[4]);
      sheetEntradas += entrada;
      sheetSalidas += salida;

      if (!date || !concept) { skipped++; continue; }
      if (entrada === 0 && salida === 0) { skipped++; continue; }

      parsed.push({
        date, concept, code,
        entrada, salida,
        isTransfer: code === TRANSFER_CODE,
      });
    }

    let ingresos = 0, egresos = 0, transferIn = 0, transferOut = 0;
    for (const r of parsed) {
      if (r.isTransfer) {
        transferIn += r.entrada;
        transferOut += r.salida;
      } else {
        ingresos += r.entrada;
        egresos += r.salida;
      }
    }

    buckets.push({
      key: `${info.year}-${String(info.month).padStart(2, "0")}-${info.currency}`,
      year: info.year, month: info.month, currency: info.currency,
      sheetTitle: sh.title,
      rows: parsed,
      totals: {
        ingresos, egresos, transferIn, transferOut,
        sheetEntradas, sheetSalidas,
        countRows: parsed.length, countSkipped: skipped,
      },
    });
  }

  buckets.sort((a, b) =>
    a.year !== b.year ? a.year - b.year :
    a.month !== b.month ? a.month - b.month :
    a.currency.localeCompare(b.currency)
  );
  return buckets;
}

export const previewCondorSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      url: z.string().min(10),
      since_year: z.number().int().min(2020).max(2100).default(2026),
      since_month: z.number().int().min(1).max(12).default(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const buckets = await parseAllSheets(data.url, data.since_year, data.since_month);
    return {
      months: buckets.map((b) => ({
        key: b.key,
        year: b.year,
        month: b.month,
        currency: b.currency,
        sheetTitle: b.sheetTitle,
        ingresos: b.totals.ingresos,
        egresos: b.totals.egresos,
        transferIn: b.totals.transferIn,
        transferOut: b.totals.transferOut,
        sheetEntradas: b.totals.sheetEntradas,
        sheetSalidas: b.totals.sheetSalidas,
        countRows: b.totals.countRows,
        countSkipped: b.totals.countSkipped,
      })),
    };
  });

export const importCondorMonths = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspace_id: z.string().uuid(),
      url: z.string().min(10),
      since_year: z.number().int().min(2020).max(2100).default(2026),
      since_month: z.number().int().min(1).max(12).default(1),
      // claves "YYYY-MM-CUR" a importar; si vacío, importa todo
      keys: z.array(z.string()).default([]),
      // reemplaza transacciones previas con source='import' del mismo mes/moneda
      replace: z.boolean().default(true),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. tasa workspace
    const { data: ws } = await supabase
      .from("workspaces")
      .select("usd_cop_rate")
      .eq("id", data.workspace_id)
      .maybeSingle();
    const rate = Number(ws?.usd_cop_rate ?? 4000);

    // 2. categorías sistema para mapear código
    const { data: cats } = await supabase
      .from("categories")
      .select("id,code")
      .eq("workspace_id", data.workspace_id);
    const codeToCatId = new Map<string, string>();
    for (const c of cats ?? []) codeToCatId.set(c.code, c.id);
    const transferCatId = codeToCatId.get("00011") ?? null; // TRANSFERENCIA USD→COP

    // 3. parsear todas las hojas
    const buckets = await parseAllSheets(data.url, data.since_year, data.since_month);
    const selected = data.keys.length > 0
      ? buckets.filter((b) => data.keys.includes(b.key))
      : buckets;

    if (selected.length === 0) return { inserted: 0, paired: 0, perMonth: [] };

    const batchId = crypto.randomUUID();

    // 4. borrar transacciones previas del mismo mes/moneda con source='import'
    if (data.replace) {
      for (const b of selected) {
        const first = `${b.year}-${String(b.month).padStart(2, "0")}-01`;
        const nextMonth = b.month === 12 ? 1 : b.month + 1;
        const nextYear = b.month === 12 ? b.year + 1 : b.year;
        const last = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
        await supabase
          .from("transactions")
          .delete()
          .eq("workspace_id", data.workspace_id)
          .eq("source", "import")
          .eq("currency", b.currency)
          .gte("date", first)
          .lt("date", last);
      }
    }

    // 5. preparar inserts
    type ToInsert = {
      workspace_id: string;
      date: string;
      concept: string;
      type: "ingreso" | "egreso";
      amount: number;
      currency: "COP" | "USD";
      account: "chase" | "bancolombia";
      source: "import";
      import_batch_id: string;
      category_id: string | null;
      notes: string;
      _bucketKey: string;
      _isTransfer: boolean;
      _tempId: string;
    };

    const toInsert: ToInsert[] = [];
    for (const b of selected) {
      for (const r of b.rows) {
        const baseCat = r.isTransfer ? transferCatId : (codeToCatId.get(r.code) ?? null);
        if (r.entrada > 0) {
          toInsert.push({
            workspace_id: data.workspace_id, date: r.date,
            concept: r.concept.slice(0, 500),
            type: "ingreso", amount: r.entrada, currency: b.currency,
            account: b.currency === "USD" ? "chase" : "bancolombia",
            source: "import", import_batch_id: batchId,
            category_id: baseCat,
            notes: `${b.sheetTitle}${r.code ? ` [${r.code}]` : ""}`,
            _bucketKey: b.key, _isTransfer: r.isTransfer, _tempId: crypto.randomUUID(),
          });
        }
        if (r.salida > 0) {
          toInsert.push({
            workspace_id: data.workspace_id, date: r.date,
            concept: r.concept.slice(0, 500),
            type: "egreso", amount: r.salida, currency: b.currency,
            account: b.currency === "USD" ? "chase" : "bancolombia",
            source: "import", import_batch_id: batchId,
            category_id: baseCat,
            notes: `${b.sheetTitle}${r.code ? ` [${r.code}]` : ""}`,
            _bucketKey: b.key, _isTransfer: r.isTransfer, _tempId: crypto.randomUUID(),
          });
        }
      }
    }

    // 6. emparejar transferencias USD egreso ↔ COP ingreso (por mes, ±5% al cambio)
    const pairs: Array<[string, string]> = []; // [tempIdA, tempIdB]
    const monthsSet = new Set(selected.map((b) => `${b.year}-${b.month}`));
    for (const ym of monthsSet) {
      const [yy, mm] = ym.split("-").map(Number);
      const usdOut = toInsert.filter((t) =>
        t._isTransfer && t.currency === "USD" && t.type === "egreso" &&
        Number(t.date.slice(5, 7)) === mm && Number(t.date.slice(0, 4)) === yy
      );
      const copIn = toInsert.filter((t) =>
        t._isTransfer && t.currency === "COP" && t.type === "ingreso" &&
        Number(t.date.slice(5, 7)) === mm && Number(t.date.slice(0, 4)) === yy
      );
      const usedCop = new Set<string>();
      for (const u of usdOut) {
        const expected = u.amount * rate;
        const tol = expected * 0.05;
        let best: typeof copIn[number] | null = null;
        let bestDiff = Infinity;
        for (const c of copIn) {
          if (usedCop.has(c._tempId)) continue;
          const diff = Math.abs(c.amount - expected);
          if (diff <= tol && diff < bestDiff) { best = c; bestDiff = diff; }
        }
        if (best) {
          usedCop.add(best._tempId);
          pairs.push([u._tempId, best._tempId]);
        }
      }
    }

    // 7. insertar (sin campos internos)
    const tempToReal = new Map<string, string>();
    const cleanRows = toInsert.map((t) => {
      const id = crypto.randomUUID();
      tempToReal.set(t._tempId, id);
      const { _bucketKey, _isTransfer, _tempId, ...rest } = t;
      return { id, ...rest };
    });

    for (let i = 0; i < cleanRows.length; i += 500) {
      const chunk = cleanRows.slice(i, i + 500);
      const { error } = await supabase.from("transactions").insert(chunk);
      if (error) throw new Error(`Import: ${error.message}`);
    }

    // 8. aplicar paired_transaction_id
    let pairedCount = 0;
    for (const [a, b] of pairs) {
      const ra = tempToReal.get(a)!;
      const rb = tempToReal.get(b)!;
      await supabase.from("transactions").update({ paired_transaction_id: rb }).eq("id", ra);
      await supabase.from("transactions").update({ paired_transaction_id: ra }).eq("id", rb);
      pairedCount++;
    }

    const perMonth = selected.map((b) => ({
      key: b.key,
      sheetTitle: b.sheetTitle,
      inserted: toInsert.filter((t) => t._bucketKey === b.key).length,
    }));

    return { inserted: cleanRows.length, paired: pairedCount, perMonth, batchId };
  });
