// Server-only: definiciones y ejecutores de herramientas para el Chat IA.
// Las "queries" se ejecutan directo y devuelven datos al modelo.
// Las "actions" requieren confirmación del usuario antes de ejecutarse.

import type { ToolDef } from "./ai.server";

export const ACTION_TOOLS = new Set([
  "create_transaction",
  "create_usd_cop_transfer",
  "delete_transaction",
  "mark_transaction_paid",
  "create_client",
  "update_trm",
  "update_monthly_goal",
  "create_fixed_cost",
]);

export const TOOLS: ToolDef[] = [
  // ===== QUERIES (auto-ejecutadas) =====
  {
    type: "function",
    function: {
      name: "get_period_summary",
      description: "Resumen financiero de un periodo: ingresos, egresos, utilidad, cartera. Default: mes actual.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "YYYY-MM-DD inicio" },
          to: { type: "string", description: "YYYY-MM-DD fin" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pending_invoices",
      description: "Lista clientes con cobros pendientes (cartera).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_category_breakdown",
      description: "Desglose de gastos por categoría en el mes actual.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_months",
      description: "Compara totales del mes actual vs el anterior.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_months",
      description: "Compara totales del mes actual vs el anterior.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_categories",
      description: "Lista todas las categorías del workspace (incluye las nuevas creadas por el usuario). Úsala cuando el usuario pregunte por sus categorías o antes de crear una transacción para elegir el código correcto.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_transactions_by_month",
      description: "Lista las transacciones de un mes específico con categoría, cuenta, monto y moneda. Úsala para ver el detalle del mes actual, del mes pasado o de cualquier mes.",
      parameters: {
        type: "object",
        properties: {
          ym: { type: "string", description: "Mes en formato YYYY-MM. Default: mes actual." },
          type: { type: "string", enum: ["ingreso", "egreso", "neutro"], description: "Filtro opcional por tipo." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_balance",
      description: "Saldo aproximado por cuenta (bancolombia, stripe, chase, efectivo).",
      parameters: { type: "object", properties: {} },
    },
  },

  // ===== ACTIONS (requieren confirmación) =====
  {
    type: "function",
    function: {
      name: "create_transaction",
      description: "Crea una transacción (ingreso o egreso).",
      parameters: {
        type: "object",
        required: ["type", "amount", "concept"],
        properties: {
          type: { type: "string", enum: ["ingreso", "egreso"] },
          amount: { type: "number" },
          currency: { type: "string", enum: ["COP", "USD"], default: "COP" },
          concept: { type: "string" },
          category_code: { type: "string", description: "00001..00013" },
          client_name: { type: "string" },
          account: { type: "string", enum: ["bancolombia", "stripe", "chase", "efectivo", "otra"], default: "bancolombia" },
          date: { type: "string", description: "YYYY-MM-DD; default hoy" },
          notes: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_usd_cop_transfer",
      description: "Registra envío de USD a Colombia: egreso USD + ingreso COP emparejado (categoría 00011).",
      parameters: {
        type: "object",
        required: ["amount_usd", "amount_cop"],
        properties: {
          amount_usd: { type: "number" },
          amount_cop: { type: "number" },
          from_account: { type: "string", enum: ["stripe", "chase", "otra"], default: "chase" },
          to_account: { type: "string", enum: ["bancolombia", "efectivo", "otra"], default: "bancolombia" },
          date: { type: "string" },
          concept: { type: "string", default: "Transferencia USD→COP" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_transaction",
      description: "Elimina una transacción por id.",
      parameters: {
        type: "object",
        required: ["transaction_id"],
        properties: { transaction_id: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mark_transaction_paid",
      description: "Marca una transacción pendiente como cobrada.",
      parameters: {
        type: "object",
        required: ["transaction_id"],
        properties: { transaction_id: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client",
      description: "Crea un nuevo cliente.",
      parameters: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          type: { type: "string", enum: ["recurrente", "proyecto"], default: "recurrente" },
          monthly_amount: { type: "number" },
          currency: { type: "string", enum: ["COP", "USD"], default: "COP" },
          contact: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_trm",
      description: "Actualiza la tasa USD→COP del workspace.",
      parameters: {
        type: "object",
        required: ["rate"],
        properties: { rate: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_monthly_goal",
      description: "Actualiza la meta mensual de ingresos (COP).",
      parameters: {
        type: "object",
        required: ["amount"],
        properties: { amount: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_fixed_cost",
      description: "Crea un costo fijo recurrente.",
      parameters: {
        type: "object",
        required: ["name", "amount"],
        properties: {
          name: { type: "string" },
          amount: { type: "number" },
          currency: { type: "string", enum: ["COP", "USD"], default: "COP" },
          category: { type: "string", enum: ["payroll", "platform", "other"], default: "other" },
        },
      },
    },
  },
];

// ---- Resumen humano de una acción para mostrar al usuario ----
export function summarizeAction(name: string, args: any): string {
  const fmt = (n: number, c = "COP") =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(n);
  switch (name) {
    case "create_transaction":
      return `Crear ${args.type} de ${fmt(args.amount, args.currency ?? "COP")}\nConcepto: ${args.concept}\nCuenta: ${args.account ?? "bancolombia"}\nFecha: ${args.date ?? "hoy"}`;
    case "create_usd_cop_transfer":
      return `Transferencia USD→COP\n• Egreso ${fmt(args.amount_usd, "USD")} de ${args.from_account ?? "chase"}\n• Ingreso ${fmt(args.amount_cop, "COP")} en ${args.to_account ?? "bancolombia"}`;
    case "delete_transaction":
      return `Eliminar transacción ${args.transaction_id}`;
    case "mark_transaction_paid":
      return `Marcar como cobrada la transacción ${args.transaction_id}`;
    case "create_client":
      return `Crear cliente "${args.name}" (${args.type ?? "recurrente"}${args.monthly_amount ? `, ${fmt(args.monthly_amount, args.currency ?? "COP")}/mes` : ""})`;
    case "update_trm":
      return `Actualizar TRM a ${args.rate} COP por USD`;
    case "update_monthly_goal":
      return `Actualizar meta mensual a ${fmt(args.amount)}`;
    case "create_fixed_cost":
      return `Crear costo fijo "${args.name}" — ${fmt(args.amount, args.currency ?? "COP")} (${args.category ?? "other"})`;
    default:
      return `Ejecutar ${name}`;
  }
}

// ---- Ejecutores ----
// `supabase` es el cliente autenticado, `workspace_id` viene del request.
export async function executeTool(
  name: string,
  args: any,
  ctx: { supabase: any; workspaceId: string; userId: string }
): Promise<any> {
  const { supabase, workspaceId, userId } = ctx;

  switch (name) {
    // ===== QUERIES =====
    case "get_period_summary": {
      const today = new Date();
      const from = args.from ?? new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const to = args.to ?? today.toISOString().slice(0, 10);
      const { data: txns } = await supabase
        .from("transactions")
        .select("type,amount,currency,is_pending,paired_transaction_id")
        .eq("workspace_id", workspaceId).gte("date", from).lte("date", to);
      const { data: ws } = await supabase.from("workspaces").select("usd_cop_rate").eq("id", workspaceId).single();
      const rate = Number(ws?.usd_cop_rate ?? 4000);
      let ingresos = 0, egresos = 0, cartera = 0;
      for (const t of txns ?? []) {
        if (t.paired_transaction_id) continue; // ignorar pares de transferencia
        const v = t.currency === "USD" ? Number(t.amount) * rate : Number(t.amount);
        if (t.is_pending && t.type === "ingreso") cartera += v;
        else if (t.type === "ingreso") ingresos += v;
        else egresos += v;
      }
      return { from, to, ingresos, egresos, utilidad: ingresos - egresos, cartera, trm: rate };
    }
    case "list_pending_invoices": {
      const { data } = await supabase
        .from("transactions")
        .select("id,date,concept,amount,currency,client:clients(name)")
        .eq("workspace_id", workspaceId).eq("is_pending", true).eq("type", "ingreso")
        .order("date", { ascending: true }).limit(50);
      return { pending: data ?? [] };
    }
    case "get_category_breakdown": {
      const today = new Date();
      const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
      const { data: txns } = await supabase
        .from("transactions")
        .select("type,amount,currency,category:categories(code,name)")
        .eq("workspace_id", workspaceId).gte("date", from).eq("type", "egreso");
      const { data: ws } = await supabase.from("workspaces").select("usd_cop_rate").eq("id", workspaceId).single();
      const rate = Number(ws?.usd_cop_rate ?? 4000);
      const map = new Map<string, number>();
      for (const t of txns ?? []) {
        const k = (t.category as any)?.name ?? "Sin categoría";
        const v = t.currency === "USD" ? Number(t.amount) * rate : Number(t.amount);
        map.set(k, (map.get(k) ?? 0) + v);
      }
      return { breakdown: [...map.entries()].map(([k, v]) => ({ category: k, total_cop: v })).sort((a, b) => b.total_cop - a.total_cop) };
    }
    case "compare_months": {
      const now = new Date();
      const curFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const curTo = now.toISOString().slice(0, 10);
      const prevFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const prevTo = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      const cur = await executeTool("get_period_summary", { from: curFrom, to: curTo }, ctx);
      const prev = await executeTool("get_period_summary", { from: prevFrom, to: prevTo }, ctx);
      return { mes_actual: cur, mes_anterior: prev };
    }
    case "get_account_balance": {
      const { data: txns } = await supabase
        .from("transactions")
        .select("type,amount,currency,account,paired_transaction_id")
        .eq("workspace_id", workspaceId);
      const bal: Record<string, { COP: number; USD: number }> = {};
      for (const t of txns ?? []) {
        const a = t.account ?? "otra";
        bal[a] = bal[a] ?? { COP: 0, USD: 0 };
        const v = Number(t.amount) * (t.type === "ingreso" ? 1 : -1);
        bal[a][t.currency as "COP" | "USD"] += v;
      }
      return { balances: bal };
    }

    // ===== ACTIONS =====
    case "create_transaction": {
      const date = args.date ?? new Date().toISOString().slice(0, 10);
      let category_id: string | null = null;
      if (args.category_code) {
        const { data: cat } = await supabase.from("categories").select("id")
          .eq("workspace_id", workspaceId).eq("code", args.category_code).maybeSingle();
        category_id = cat?.id ?? null;
      }
      let client_id: string | null = null;
      if (args.client_name) {
        const { data: cli } = await supabase.from("clients").select("id")
          .eq("workspace_id", workspaceId).ilike("name", `%${args.client_name}%`).maybeSingle();
        client_id = cli?.id ?? null;
      }
      const { data, error } = await supabase.from("transactions").insert({
        workspace_id: workspaceId,
        date, concept: args.concept, type: args.type,
        amount: args.amount, currency: args.currency ?? "COP",
        category_id, client_id,
        account: args.account ?? "bancolombia",
        source: "ai_chat",
        notes: args.notes ?? null,
        created_by: userId,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    case "create_usd_cop_transfer": {
      const date = args.date ?? new Date().toISOString().slice(0, 10);
      const concept = args.concept ?? "Transferencia USD→COP";
      const { data: cat } = await supabase.from("categories").select("id")
        .eq("workspace_id", workspaceId).eq("code", "00011").maybeSingle();
      const { data: usd, error: e1 } = await supabase.from("transactions").insert({
        workspace_id: workspaceId, date, concept, type: "egreso",
        amount: args.amount_usd, currency: "USD",
        category_id: cat?.id ?? null, account: args.from_account ?? "chase",
        source: "ai_chat", created_by: userId,
      }).select("id").single();
      if (e1) throw new Error(e1.message);
      const { data: cop, error: e2 } = await supabase.from("transactions").insert({
        workspace_id: workspaceId, date, concept: concept + " (recibido COP)", type: "ingreso",
        amount: args.amount_cop, currency: "COP",
        category_id: cat?.id ?? null, account: args.to_account ?? "bancolombia",
        source: "ai_chat", paired_transaction_id: usd.id, created_by: userId,
      }).select("id").single();
      if (e2) throw new Error(e2.message);
      await supabase.from("transactions").update({ paired_transaction_id: cop.id }).eq("id", usd.id);
      return { ok: true, usd_id: usd.id, cop_id: cop.id };
    }
    case "delete_transaction": {
      const { error } = await supabase.from("transactions").delete().eq("id", args.transaction_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    case "mark_transaction_paid": {
      const { error } = await supabase.from("transactions").update({ is_pending: false }).eq("id", args.transaction_id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    case "create_client": {
      const { data, error } = await supabase.from("clients").insert({
        workspace_id: workspaceId,
        name: args.name,
        type: args.type ?? "recurrente",
        currency: args.currency ?? "COP",
        monthly_amount: args.monthly_amount ?? null,
        contact: args.contact ?? null,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    case "update_trm": {
      const { error } = await supabase.from("workspaces").update({ usd_cop_rate: args.rate }).eq("id", workspaceId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    case "update_monthly_goal": {
      const { error } = await supabase.from("workspaces").update({ monthly_goal: args.amount }).eq("id", workspaceId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    case "create_fixed_cost": {
      const { data, error } = await supabase.from("fixed_costs").insert({
        workspace_id: workspaceId,
        name: args.name,
        amount: args.amount,
        currency: args.currency ?? "COP",
        category: args.category ?? "other",
      }).select("id").single();
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    default:
      throw new Error(`Tool desconocido: ${name}`);
  }
}
