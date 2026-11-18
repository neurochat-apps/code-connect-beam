import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "update_trm",
  title: "Actualizar TRM",
  description: "Actualiza la tasa USD→COP.",
  inputSchema: { rate: z.number().positive(), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (args, ctx) => runAiTool("update_trm", args, ctx),
});
