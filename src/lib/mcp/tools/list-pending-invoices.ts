import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "list_pending_invoices",
  title: "Cartera pendiente",
  description: "Lista cobros pendientes de clientes.",
  inputSchema: { workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (args, ctx) => runAiTool("list_pending_invoices", args, ctx),
});
