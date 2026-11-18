import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "delete_transaction",
  title: "Eliminar transacción",
  description: "Elimina una transacción por id.",
  inputSchema: { transaction_id: z.string().uuid(), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  handler: (args, ctx) => runAiTool("delete_transaction", args, ctx),
});
