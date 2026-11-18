import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "get_period_summary",
  title: "Resumen del periodo",
  description: "Ingresos, egresos, utilidad y cartera de un rango (por defecto el mes actual).",
  inputSchema: { from: z.string().optional().describe("YYYY-MM-DD"), to: z.string().optional().describe("YYYY-MM-DD"), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (args, ctx) => runAiTool("get_period_summary", args, ctx),
});
