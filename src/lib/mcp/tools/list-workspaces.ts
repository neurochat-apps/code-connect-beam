import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { ok } from "../run";

export default defineTool({
  name: "list_workspaces",
  title: "Listar espacios de trabajo",
  description: "Lista los espacios de trabajo a los que tienes acceso (id, nombre, TRM, meta).",
  inputSchema: {},
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_a, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("No autenticado");
    const { data, error } = await supabaseForUser(ctx).from("workspaces").select("id,name,usd_cop_rate,monthly_goal").order("created_at");
    if (error) throw new ToolError(error.message);
    return ok(data ?? []);
  },
});
