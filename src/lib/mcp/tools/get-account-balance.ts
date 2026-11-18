import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "get_account_balance",
  title: "Saldos por cuenta",
  description: "Saldo aproximado por cuenta (Bancolombia, Chase, Stripe, efectivo).",
  inputSchema: { workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (args, ctx) => runAiTool("get_account_balance", args, ctx),
});
