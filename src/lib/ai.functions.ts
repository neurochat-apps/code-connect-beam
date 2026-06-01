import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geminiCall } from "./ai.server";

export const chatFinanciero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspace_id: z.string().uuid(),
    message: z.string().min(1).max(2000),
    history: z.array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(4000),
    })).max(20).default([]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    const to = today.toISOString().slice(0, 10);

    const [{ data: ws }, { data: txns }, { data: fixed }, { data: clients }] = await Promise.all([
      supabase.from("workspaces").select("name,usd_cop_rate").eq("id", data.workspace_id).single(),
      supabase.from("transactions")
        .select("date,concept,type,amount,currency,account,is_pending,category:categories(code,name),client:clients(name)")
        .eq("workspace_id", data.workspace_id)
        .gte("date", from).lte("date", to)
        .order("date", { ascending: false }).limit(50),
      supabase.from("fixed_costs").select("name,amount,currency,is_active").eq("workspace_id", data.workspace_id),
      supabase.from("clients").select("name").eq("workspace_id", data.workspace_id),
    ]);

    const rate = Number(ws?.usd_cop_rate ?? 4000);
    let ingresos = 0, gastos = 0, cartera = 0;
    for (const t of txns ?? []) {
      const c = t.currency === "USD" ? Number(t.amount) * rate : Number(t.amount);
      if (t.is_pending && t.type === "ingreso") cartera += c;
      else if (t.type === "ingreso") ingresos += c;
      else gastos += c;
    }

    const context_str = `Contexto financiero del mes (${from} a ${to}):
- Workspace: ${ws?.name} (TRM ${rate} COP/USD)
- Ingresos mes: ${ingresos.toFixed(0)} COP
- Gastos mes: ${gastos.toFixed(0)} COP
- Utilidad: ${(ingresos - gastos).toFixed(0)} COP
- Cartera pendiente: ${cartera.toFixed(0)} COP
- Costos fijos activos: ${(fixed ?? []).filter((f: any) => f.is_active).map((f: any) => `${f.name}=${f.amount} ${f.currency}`).join(", ")}
- Clientes: ${(clients ?? []).map((c: any) => c.name).join(", ")}
- Últimas transacciones: ${(txns ?? []).slice(0, 20).map((t: any) => `${t.date} ${t.type} ${t.amount} ${t.currency} "${t.concept}"`).join(" | ")}`;

    const system = `Eres el asistente financiero de Neuro Finanzas (agencia Neurochat).
Respondes en español, breve, directo, con cifras en COP cuando aplique.
Usa ÚNICAMENTE los datos del contexto. Si te piden algo fuera de finanzas, redirige amable.

${context_str}`;

    const history = data.history.map((h) => `${h.role === "user" ? "Usuario" : "Asistente"}: ${h.content}`).join("\n");
    const user = `${history ? history + "\n" : ""}Usuario: ${data.message}`;

    const reply = await geminiCall({ system, user });
    return { reply };
  });
