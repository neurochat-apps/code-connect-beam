import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, resolveWorkspace } from "../run";

export default defineTool({
  name: "search_transactions",
  title: "Buscar transacciones",
  description: "Busca transacciones con filtros: fechas, tipo, cuenta, código de categoría, texto del concepto y pendientes.",
  inputSchema: {
    from: z.string().optional().describe("YYYY-MM-DD"),
    to: z.string().optional().describe("YYYY-MM-DD"),
    type: z.enum(["ingreso", "egreso", "neutro"]).optional(),
    account: z.enum(["bancolombia", "stripe", "chase", "efectivo", "otra"]).optional(),
    category_code: z.string().optional(),
    text: z.string().optional().describe("Texto a buscar en el concepto"),
    pending_only: z.boolean().optional(),
    limit: z.number().int().min(1).max(500).optional(),
    workspace_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const { supabase, workspaceId } = await resolveWorkspace(ctx, a.workspace_id);
    let q = supabase.from("transactions")
      .select("id,date,concept,type,amount,currency,account,is_pending,source,notes,category:categories(code,name),client:clients(name)")
      .eq("workspace_id", workspaceId).order("date", { ascending: false }).limit(a.limit ?? 100);
    if (a.from) q = q.gte("date", a.from);
    if (a.to) q = q.lte("date", a.to);
    if (a.type) q = q.eq("type", a.type);
    if (a.account) q = q.eq("account", a.account);
    if (a.text) q = q.ilike("concept", `%${a.text}%`);
    if (a.pending_only) q = q.eq("is_pending", true);
    if (a.category_code) {
      const { data: c } = await supabase.from("categories").select("id").eq("workspace_id", workspaceId).eq("code", a.category_code).maybeSingle();
      if (!c) throw new ToolError(`Categoría ${a.category_code} no existe`);
      q = q.eq("category_id", c.id);
    }
    const { data, error } = await q;
    if (error) throw new ToolError(error.message);
    return ok({ count: data?.length ?? 0, transactions: data ?? [] });
  },
});
