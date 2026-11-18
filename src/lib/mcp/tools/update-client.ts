import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, resolveWorkspace } from "../run";

export default defineTool({
  name: "update_client",
  title: "Editar cliente",
  description: "Edita datos de un cliente (solo los campos enviados).",
  inputSchema: {
    client_id: z.string().uuid(),
    name: z.string().optional(),
    monthly_amount: z.number().optional(),
    currency: z.enum(["COP", "USD"]).optional(),
    next_payment_date: z.string().optional().describe("YYYY-MM-DD"),
    contact: z.string().optional(),
    notes: z.string().optional(),
    workspace_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const { supabase, workspaceId } = await resolveWorkspace(ctx, a.workspace_id);
    const { client_id, workspace_id: _w, ...patch } = a;
    const { error } = await supabase.from("clients").update(patch).eq("id", client_id).eq("workspace_id", workspaceId);
    if (error) throw new ToolError(error.message);
    return ok({ ok: true });
  },
});
