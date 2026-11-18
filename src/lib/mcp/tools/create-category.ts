import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, resolveWorkspace } from "../run";

export default defineTool({
  name: "create_category",
  title: "Crear categoría",
  description: "Crea una nueva categoría con el siguiente código disponible.",
  inputSchema: {
    name: z.string().min(1),
    type: z.enum(["ingreso", "egreso", "neutro"]),
    workspace_id: z.string().uuid().optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (a, ctx) => {
    const { supabase, workspaceId } = await resolveWorkspace(ctx, a.workspace_id);
    const { data: cats } = await supabase.from("categories").select("code").eq("workspace_id", workspaceId);
    const max = Math.max(0, ...(cats ?? []).map((c) => Number(c.code) || 0));
    const code = String(max + 1).padStart(5, "0");
    const { data, error } = await supabase.from("categories")
      .insert({ workspace_id: workspaceId, code, name: a.name.toUpperCase(), type: a.type }).select("id,code,name").single();
    if (error) throw new ToolError(error.message);
    return ok(data);
  },
});
