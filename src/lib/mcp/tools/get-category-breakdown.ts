import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "get_category_breakdown",
  title: "Gastos por categoría",
  description: "Desglose por categoría del mes actual.",
  inputSchema: { workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (args, ctx) => runAiTool("get_category_breakdown", args, ctx),
});
