import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "create_usd_cop_transfer",
  title: "Transferencia USD→COP",
  description: "Registra un envío de dólares a Colombia como par emparejado (no duplica ingresos).",
  inputSchema: { amount_usd: z.number().positive(), amount_cop: z.number().positive(), from_account: z.enum(["stripe","chase","otra"]).optional(), to_account: z.enum(["bancolombia","efectivo","otra"]).optional(), date: z.string().optional(), concept: z.string().optional(), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (args, ctx) => runAiTool("create_usd_cop_transfer", args, ctx),
});
