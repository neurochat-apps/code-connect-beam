import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, resolveWorkspace } from "../run";

export default defineTool({
  name: "list_clients",
  title: "Listar clientes",
  description: "Lista clientes con monto mensual, estado y próxima fecha de pago.",
  inputSchema: { workspace_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const { supabase, workspaceId } = await resolveWorkspace(ctx, a.workspace_id);
    const { data, error } = await supabase.from("clients")
      .select("id,name,type,status,monthly_amount,currency,next_payment_date,contact").eq("workspace_id", workspaceId).order("name");
    if (error) throw new ToolError(error.message);
    return ok(data ?? []);
  },
});
