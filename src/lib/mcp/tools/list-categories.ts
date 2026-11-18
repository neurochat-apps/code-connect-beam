import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { runAiTool } from "../run";

export default defineTool({
  name: "list_categories",
  title: "Listar categorías",
  description: "Lista todas las categorías con su código.",
  inputSchema: { workspace_id: z.string().uuid().optional().describe("Espacio de trabajo (opcional; por defecto el primero).") },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: (args, ctx) => runAiTool("list_categories", args, ctx),
});
