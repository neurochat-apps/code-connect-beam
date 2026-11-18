import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, resolveWorkspace } from "../run";

export default defineTool({
  name: "list_fixed_costs",
  title: "Listar costos fijos",
  description: "Lista los costos fijos del espacio de trabajo.",
  inputSchema: { workspace_id: z.string().uuid().optional() },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (a, ctx) => {
    const { supabase, workspaceId } = await resolveWorkspace(ctx, a.workspace_id);
    const { data, error } = await supabase.from("fixed_costs")
      .select("id,name,amount,currency,category,is_active").eq("workspace_id", workspaceId).order("sort_order");
    if (error) throw new ToolError(error.message);
    return ok(data ?? []);
  },
});
