import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "compare_months",
  title: "Comparar meses",
  description: "Compara el mes actual contra el anterior.",
  inputSchema: { workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (args, ctx) => runAiTool("compare_months", args, ctx),
});
