import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "update_monthly_goal",
  title: "Actualizar meta mensual",
  description: "Actualiza la meta mensual de ingresos en COP.",
  inputSchema: { amount: z.number().nonnegative(), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (args, ctx) => runAiTool("update_monthly_goal", args, ctx),
});
