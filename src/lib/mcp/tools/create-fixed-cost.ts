import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "create_fixed_cost",
  title: "Crear costo fijo",
  description: "Crea un costo fijo recurrente.",
  inputSchema: { name: z.string().min(1), amount: z.number().positive(), currency: z.enum(["COP","USD"]).optional(), category: z.enum(["payroll","platform","other"]).optional(), workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: (args, ctx) => runAiTool("create_fixed_cost", args, ctx),
});
