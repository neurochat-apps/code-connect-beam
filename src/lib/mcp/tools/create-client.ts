import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "create_client",
  title: "Crear cliente",
  description: "Crea un nuevo cliente.",
  inputSchema: { name: z.string().min(1), type: z.enum(["recurrente","proyecto"]).optional(), monthly_amount: z.number().optional(), currency: z.enum(["COP","USD"]).optional(), contact: z.string().optional(), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (args, ctx) => runAiTool("create_client", args, ctx),
});
