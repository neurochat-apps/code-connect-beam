import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractSpreadsheetId, getSpreadsheetMeta, getSheetValues } from "./sheets.server";

// ---------- helpers ----------
function normalizeHeader(s: string) {
  return s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const FIELD_ALIASES: Record<string, string[]> = {
  date: ["fecha", "date", "dia", "día"],
  concept: ["concepto", "concept", "descripcion", "descripción", "detalle", "description"],
  type: ["tipo", "type", "movimiento"],
  amount: ["monto", "valor", "amount", "importe", "total"],
  currency: ["moneda", "currency", "divisa"],
  category: ["categoria", "categoría", "category", "rubro"],
  client: ["cliente", "client", "customer"],
  account: ["cuenta", "account", "banco"],
  notes: ["notas", "notes", "observaciones", "comentarios", "nota"],
};

export function autoMap(headers: string[]): Record<string, number | null> {
  const map: Record<string, number | null> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(normalizeHeader(String(h))));
    map[field] = idx >= 0 ? idx : null;
  }
  return map;
}

function parseAmount(v: any): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[$\s]/g, "");
  // Handle "1.234,56" (es) and "1,234.56" (en)
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  let normalized = s;
  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) normalized = s.replace(/\./g, "").replace(",", ".");
    else normalized = s.replace(/,/g, "");
  } else if (hasComma) {
    normalized = s.replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function parseDate(v: any): string | null {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  // DD/MM/YYYY or D/M/YYYY
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    let y = m[3];
    if (y.length === 2) y = "20" + y;
    return `${y}-${mo}-${d}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return null;
}

function parseType(v: any): "ingreso" | "egreso" | null {
  if (!v) return null;
  const s = normalizeHeader(String(v));
  if (["ingreso", "income", "in", "credito", "crédito", "abono", "entrada"].includes(s)) return "ingreso";
  if (["egreso", "expense", "gasto", "out", "debito", "débito", "salida", "pago"].includes(s)) return "egreso";
  return null;
}

function parseCurrency(v: any): "COP" | "USD" {
  if (!v) return "COP";
  const s = normalizeHeader(String(v));
  return s.includes("usd") || s === "$" ? "USD" : "COP";
}

function parseAccount(v: any): "bancolombia" | "chase" | "cash" | "stripe" {
  if (!v) return "bancolombia";
  const s = normalizeHeader(String(v));
  if (s.includes("chase")) return "chase";
  if (s.includes("stripe")) return "stripe";
  if (s.includes("efectivo") || s.includes("cash") || s.includes("caja")) return "cash";
  return "bancolombia";
}

// ---------- server fns ----------

export const previewSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    url: z.string().min(5).max(500),
    sheet_title: z.string().optional(),
  }).parse(i))
  .handler(async ({ data }) => {
    const id = extractSpreadsheetId(data.url);
    if (!id) throw new Error("URL de Google Sheets inválida");
    const meta = await getSpreadsheetMeta(id);
    const title = data.sheet_title ?? meta.sheets[0]?.title;
    if (!title) throw new Error("Hoja no encontrada");
    const range = `'${title}'!A1:Z50`;
    const values = await getSheetValues(id, range);
    const headers = (values[0] ?? []).map((h) => String(h ?? ""));
    const rows = values.slice(1, 21);
    return {
      spreadsheetId: id,
      title: meta.title,
      sheets: meta.sheets.map((s) => s.title),
      activeSheet: title,
      headers,
      sampleRows: rows,
      autoMap: autoMap(headers),
    };
  });

const ImportInput = z.object({
  workspace_id: z.string().uuid(),
  url: z.string().min(5).max(500),
  sheet_title: z.string().min(1),
  start_row: z.number().int().min(2).max(100000).default(2),
  end_row: z.number().int().min(2).max(100000).default(10000),
  mapping: z.object({
    date: z.number().int().nullable(),
    concept: z.number().int().nullable(),
    type: z.number().int().nullable(),
    amount: z.number().int().nullable(),
    currency: z.number().int().nullable(),
    category: z.number().int().nullable(),
    client: z.number().int().nullable(),
    account: z.number().int().nullable(),
    notes: z.number().int().nullable(),
  }),
  default_type: z.enum(["ingreso", "egreso", "auto"]).default("auto"),
});

export const importSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ImportInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const id = extractSpreadsheetId(data.url);
    if (!id) throw new Error("URL de Google Sheets inválida");

    const range = `'${data.sheet_title}'!A${data.start_row}:Z${data.end_row}`;
    const values = await getSheetValues(id, range);

    // Cache categories + clients
    const { data: cats } = await supabase.from("categories").select("id,name,type").eq("workspace_id", data.workspace_id);
    const { data: clis } = await supabase.from("clients").select("id,name").eq("workspace_id", data.workspace_id);
    const catMap = new Map((cats ?? []).map((c: any) => [normalizeHeader(c.name), c]));
    const cliMap = new Map((clis ?? []).map((c: any) => [normalizeHeader(c.name), c]));

    const batchId = randomUUID();
    const toInsert: any[] = [];
    const skipped: { row: number; reason: string }[] = [];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const rowNum = data.start_row + i;
      const m = data.mapping;

      const date = m.date != null ? parseDate(row[m.date]) : null;
      const concept = m.concept != null ? String(row[m.concept] ?? "").trim() : "";
      const amountRaw = m.amount != null ? parseAmount(row[m.amount]) : null;
      const amount = amountRaw != null ? Math.abs(amountRaw) : null;

      if (!date) { skipped.push({ row: rowNum, reason: "fecha inválida" }); continue; }
      if (!amount || amount === 0) { skipped.push({ row: rowNum, reason: "monto inválido" }); continue; }
      if (!concept) { skipped.push({ row: rowNum, reason: "concepto vacío" }); continue; }

      // Type
      let type = m.type != null ? parseType(row[m.type]) : null;
      if (!type && data.default_type !== "auto") type = data.default_type;
      if (!type) type = amountRaw != null && amountRaw < 0 ? "egreso" : "ingreso";

      const currency = m.currency != null ? parseCurrency(row[m.currency]) : "COP";
      const account = m.account != null ? parseAccount(row[m.account]) : "bancolombia";
      const notes = m.notes != null ? String(row[m.notes] ?? "").trim() || null : null;

      // Category
      let categoryId: string | null = null;
      if (m.category != null) {
        const catName = String(row[m.category] ?? "").trim();
        if (catName) {
          const found = catMap.get(normalizeHeader(catName));
          if (found) categoryId = (found as any).id;
          else {
            const code = `9${String(catMap.size + 1).padStart(4, "0")}`;
            const { data: newCat } = await supabase.from("categories")
              .insert({ workspace_id: data.workspace_id, code, name: catName, type, is_system: false })
              .select("id,name,type").single();
            if (newCat) { categoryId = newCat.id; catMap.set(normalizeHeader(catName), newCat); }
          }
        }
      }

      // Client
      let clientId: string | null = null;
      if (m.client != null) {
        const cliName = String(row[m.client] ?? "").trim();
        if (cliName) {
          const found = cliMap.get(normalizeHeader(cliName));
          if (found) clientId = (found as any).id;
          else {
            const { data: newCli } = await supabase.from("clients")
              .insert({ workspace_id: data.workspace_id, name: cliName })
              .select("id,name").single();
            if (newCli) { clientId = newCli.id; cliMap.set(normalizeHeader(cliName), newCli); }
          }
        }
      }

      toInsert.push({
        workspace_id: data.workspace_id,
        date,
        concept: concept.slice(0, 500),
        type,
        amount,
        currency,
        account,
        category_id: categoryId,
        client_id: clientId,
        notes,
        source: "import",
        import_batch_id: batchId,
      });
    }

    // Insert in chunks of 500
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500);
      const { error, count } = await supabase.from("transactions").insert(chunk, { count: "exact" });
      if (error) throw new Error(`Error insertando: ${error.message}`);
      inserted += count ?? chunk.length;
    }

    return { batchId, inserted, skipped, totalRows: values.length };
  });

export const revertImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspace_id: z.string().uuid(),
    batch_id: z.string().uuid(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error, count } = await supabase.from("transactions")
      .delete({ count: "exact" })
      .eq("workspace_id", data.workspace_id)
      .eq("import_batch_id", data.batch_id);
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  });
