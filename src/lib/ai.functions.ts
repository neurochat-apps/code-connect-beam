import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { gatewayChat, type ChatMessage } from "./ai.server";
import { TOOLS, ACTION_TOOLS, executeTool, summarizeAction } from "./ai-tools.server";

// ---------------- Contexto del workspace ----------------
async function buildContext(supabase: any, workspace_id: string) {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to = today.toISOString().slice(0, 10);

  const [{ data: ws }, { data: txns }, { data: fixed }, { data: clients }, { data: cats }] = await Promise.all([
    supabase.from("workspaces").select("name,usd_cop_rate,monthly_goal").eq("id", workspace_id).single(),
    supabase.from("transactions")
      .select("type,amount,currency,is_pending,paired_transaction_id,client_id,account")
      .eq("workspace_id", workspace_id).gte("date", from).lte("date", to),
    supabase.from("fixed_costs").select("name,amount,currency,is_active").eq("workspace_id", workspace_id).eq("is_active", true),
    supabase.from("clients").select("id,name,monthly_amount,currency,next_payment_date").eq("workspace_id", workspace_id).limit(20),
    supabase.from("categories").select("code,name,type").eq("workspace_id", workspace_id).order("code"),
  ]);

  const rate = Number(ws?.usd_cop_rate ?? 4000);
  let ingresos = 0, egresos = 0, cartera = 0;
  const balByAccount: Record<string, { COP: number; USD: number }> = {};
  for (const t of txns ?? []) {
    if (!t.paired_transaction_id) {
      const v = t.currency === "USD" ? Number(t.amount) * rate : Number(t.amount);
      if (t.is_pending && t.type === "ingreso") cartera += v;
      else if (t.type === "ingreso") ingresos += v;
      else egresos += v;
    }
    const a = t.account ?? "otra";
    balByAccount[a] = balByAccount[a] ?? { COP: 0, USD: 0 };
    balByAccount[a][t.currency as "COP" | "USD"] += Number(t.amount) * (t.type === "ingreso" ? 1 : -1);
  }

  return {
    ws, rate, from, to, ingresos, egresos, cartera,
    fixed: fixed ?? [],
    clients: clients ?? [],
    categories: cats ?? [],
    balances: balByAccount,
  };
}

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof buildContext>>) {
  const meta = Number(ctx.ws?.monthly_goal ?? 0);
  const progreso = meta > 0 ? ((ctx.ingresos / meta) * 100).toFixed(0) : "—";
  return `Eres el asistente financiero TOTAL de Neuro Finanzas (Neurochat). Hablas español, breve y directo.

Tienes herramientas para CONSULTAR y para EJECUTAR acciones (crear/editar/eliminar). Úsalas siempre que la pregunta lo amerite. NO inventes datos: si necesitas saber algo, llama la herramienta correspondiente.

REGLAS:
- Para CONSULTAS (resumen, saldos, comparaciones, cartera) → llama la tool de consulta.
- Para ACCIONES (crear transacción, transferencia, cliente, costo fijo, actualizar TRM/meta, eliminar/marcar como pagado) → llama la tool de acción. El sistema pedirá confirmación al usuario antes de ejecutarla, tú NO confirmas en texto.
- Si el usuario dicta o escribe VARIAS operaciones en un mismo mensaje (por ejemplo "un gasto de 50k en comida y un ingreso de 200k de Juan"), emite VARIAS tool_calls en la misma respuesta, una por cada operación. El usuario podrá confirmarlas todas juntas o una por una.
- Si falta un dato esencial para una acción, pregúntalo en una sola frase antes de llamar la tool.
- Cuando recibas resultados de una tool, responde con cifras claras en COP (formato 1.234.567).

CONTEXTO DEL MES (${ctx.from} → ${ctx.to}):
- Workspace: ${ctx.ws?.name} · TRM ${ctx.rate} COP/USD · Meta ${meta} COP (${progreso}%)
- Ingresos: ${Math.round(ctx.ingresos)} COP · Egresos: ${Math.round(ctx.egresos)} COP · Utilidad: ${Math.round(ctx.ingresos - ctx.egresos)} COP
- Cartera pendiente: ${Math.round(ctx.cartera)} COP
- Saldos por cuenta: ${Object.entries(ctx.balances).map(([k, v]) => `${k}=${Math.round(v.COP)}COP/${Math.round(v.USD)}USD`).join(" · ")}
- Costos fijos: ${ctx.fixed.map((f: any) => `${f.name}(${f.amount} ${f.currency})`).join(", ") || "—"}
- Categorías: ${ctx.categories.map((c: any) => `${c.code} ${c.name}`).join(", ")}
- Clientes: ${ctx.clients.map((c: any) => c.name).join(", ")}`;
}

// ---------------- chatFinanciero ----------------
export const chatFinanciero = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      workspace_id: z.string().uuid(),
      message: z.string().min(1).max(2000),
      history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })).max(20).default([]),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ctx = await buildContext(supabase, data.workspace_id);
    const system = buildSystemPrompt(ctx);

    const messages: ChatMessage[] = [
      { role: "system", content: system },
      ...data.history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: data.message },
    ];

    // Loop hasta 4 iteraciones para queries multi-paso
    for (let i = 0; i < 4; i++) {
      const res = await gatewayChat({ messages, tools: TOOLS });

      if (res.tool_calls?.length) {
        // ¿Hay acciones? Devolvemos TODAS para confirmar en batch.
        const actions = res.tool_calls.filter((c) => ACTION_TOOLS.has(c.name));
        if (actions.length) {
          return {
            type: "confirm" as const,
            actions: actions.map((a) => ({
              name: a.name,
              args: a.arguments,
              summary: summarizeAction(a.name, a.arguments),
            })),
          };
        }
        // Todas son queries → ejecutar y reintroducir resultados
        messages.push({
          role: "assistant",
          content: res.content,
          tool_calls: res.tool_calls.map((c) => ({
            id: c.id, type: "function",
            function: { name: c.name, arguments: JSON.stringify(c.arguments) },
          })),
        });
        for (const c of res.tool_calls) {
          try {
            const out = await executeTool(c.name, c.arguments, {
              supabase, workspaceId: data.workspace_id, userId,
            });
            messages.push({ role: "tool", tool_call_id: c.id, name: c.name, content: JSON.stringify(out) });
          } catch (e: any) {
            messages.push({ role: "tool", tool_call_id: c.id, name: c.name, content: JSON.stringify({ error: e.message }) });
          }
        }
        continue;
      }

      return { type: "message" as const, reply: res.content ?? "" };
    }
    return { type: "message" as const, reply: "No pude completar la consulta, intenta reformularla." };
  });

// ---------------- executeAction (post-confirmación) ----------------
export const executeAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      workspace_id: z.string().uuid(),
      name: z.string(),
      args: z.record(z.string(), z.any()),
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    if (!ACTION_TOOLS.has(data.name)) throw new Error(`Acción no permitida: ${data.name}`);
    const { supabase, userId } = context;
    const out = await executeTool(data.name, data.args, {
      supabase, workspaceId: data.workspace_id, userId,
    });
    return { ok: true, result: out };
  });

// ---------------- getChatAlerts ----------------
export const getChatAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const ctx = await buildContext(supabase, data.workspace_id);
    const alerts: Array<{ kind: "info" | "warn" | "ok"; text: string }> = [];

    // Cartera vencida
    const { data: overdue } = await supabase
      .from("transactions")
      .select("client:clients(name,next_payment_date)")
      .eq("workspace_id", data.workspace_id).eq("is_pending", true).eq("type", "ingreso")
      .limit(30);
    const overdueCount = (overdue ?? []).filter((t: any) => t.client?.next_payment_date && t.client.next_payment_date < todayStr).length;
    if (overdueCount > 0) alerts.push({ kind: "warn", text: `${overdueCount} cobro(s) vencidos` });

    // Progreso de meta
    const meta = Number(ctx.ws?.monthly_goal ?? 0);
    if (meta > 0) {
      const pct = Math.round((ctx.ingresos / meta) * 100);
      alerts.push({
        kind: pct >= 100 ? "ok" : pct >= 70 ? "info" : "warn",
        text: `Meta del mes: ${pct}% (${Math.round(ctx.ingresos).toLocaleString("es-CO")} / ${meta.toLocaleString("es-CO")} COP)`,
      });
    }

    return { alerts };
  });
