import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "create_transaction",
  title: "Registrar transacción",
  description: "Crea un ingreso o egreso. Usa list_categories para elegir category_code.",
  inputSchema: { type: z.enum(["ingreso","egreso"]), amount: z.number().positive(), currency: z.enum(["COP","USD"]).optional(), concept: z.string().min(1), category_code: z.string().optional(), client_name: z.string().optional(), account: z.enum(["bancolombia","stripe","chase","efectivo","otra"]).optional(), date: z.string().optional().describe("YYYY-MM-DD"), notes: z.string().optional(), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (args, ctx) => runAiTool("create_transaction", args, ctx),
});
