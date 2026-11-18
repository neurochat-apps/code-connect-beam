import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, resolveWorkspace } from "../run";

export default defineTool({
  name: "update_transaction",
  title: "Editar transacción",
  description: "Edita campos de una transacción existente (solo los que envíes).",
  inputSchema: {
    transaction_id: z.string().uuid(),
    concept: z.string().optional(),
    amount: z.number().positive().optional(),
    currency: z.enum(["COP", "USD"]).optional(),
    type: z.enum(["ingreso", "egreso", "neutro"]).optional(),
    date: z.string().optional(),
    account: z.enum(["bancolombia", "stripe", "chase", "efectivo", "otra"]).optional(),
    category_code: z.string().optional(),
    client_name: z.string().optional(),
    is_pending: z.boolean().optional(),
    notes: z.string().optional(),
    workspace_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const { supabase, workspaceId } = await resolveWorkspace(ctx, a.workspace_id);
    const patch: Record<string, unknown> = {};
    for (const k of ["concept", "amount", "currency", "type", "date", "account", "is_pending", "notes"] as const) {
      if (a[k] !== undefined) patch[k] = a[k];
    }
    if (a.category_code) {
      const { data: c } = await supabase.from("categories").select("id").eq("workspace_id", workspaceId).eq("code", a.category_code).maybeSingle();
      if (!c) throw new ToolError(`Categoría ${a.category_code} no existe`);
      patch.category_id = c.id;
    }
    if (a.client_name) {
      const { data: c } = await supabase.from("clients").select("id").eq("workspace_id", workspaceId).ilike("name", `%${a.client_name}%`).limit(1).maybeSingle();
      if (!c) throw new ToolError(`Cliente "${a.client_name}" no existe`);
      patch.client_id = c.id;
    }
    const { error } = await supabase.from("transactions").update(patch as never).eq("id", a.transaction_id).eq("workspace_id", workspaceId);
    if (error) throw new ToolError(error.message);
    return ok({ ok: true });
  },
});
