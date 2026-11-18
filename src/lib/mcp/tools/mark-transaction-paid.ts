import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "mark_transaction_paid",
  title: "Marcar como cobrada",
  description: "Marca una transacción pendiente como cobrada.",
  inputSchema: { transaction_id: z.string().uuid(), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (args, ctx) => runAiTool("mark_transaction_paid", args, ctx),
});
