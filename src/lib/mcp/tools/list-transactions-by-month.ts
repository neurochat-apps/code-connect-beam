import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "list_transactions_by_month",
  title: "Transacciones del mes",
  description: "Lista transacciones de un mes (YYYY-MM).",
  inputSchema: { ym: z.string().optional().describe("YYYY-MM"), type: z.enum(["ingreso","egreso","neutro"]).optional(), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (args, ctx) => runAiTool("list_transactions_by_month", args, ctx),
});
