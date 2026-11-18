import { ToolError, type ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";
import { executeTool } from "../ai-tools.server";

/** Resuelve el workspace del usuario (o valida el indicado) vía RLS. */
export async function resolveWorkspace(ctx: ToolContext, requested?: string) {
  if (!ctx.isAuthenticated()) throw new ToolError("No autenticado");
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase.from("workspaces").select("id,name").order("created_at");
  if (error) throw new ToolError(error.message);
  const ws = requested ? data?.find((w) => w.id === requested) : data?.[0];
  if (!ws) throw new ToolError("No tienes acceso a ese espacio de trabajo");
  return { supabase, workspaceId: ws.id as string, userId: ctx.getUserId() ?? "" };
}

export function ok(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
  };
}

/** Ejecuta una herramienta existente del chat IA como herramienta MCP. */
export async function runAiTool(name: string, args: Record<string, unknown>, ctx: ToolContext) {
  const { workspace_id, ...rest } = args as { workspace_id?: string };
  const w = await resolveWorkspace(ctx, workspace_id);
  try {
    return ok(await executeTool(name, rest, w));
  } catch (e) {
    throw new ToolError(e instanceof Error ? e.message : String(e));
  }
}
