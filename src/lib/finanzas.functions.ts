import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============ WORKSPACE ============

export const getMyWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("workspace_members")
      .select("role, workspace:workspaces(id, name, owner_id, usd_cop_rate, telegram_group_id)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((m: any) => ({ ...m.workspace, role: m.role }));
  });

export const updateWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(80).optional(),
    usd_cop_rate: z.number().positive().optional(),
    telegram_group_id: z.string().max(40).nullable().optional(),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { id, ...patch } = data;
    const { error } = await supabase.from("workspaces").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ CATEGORIES / CLIENTS ============

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("categories").select("*").eq("workspace_id", data.workspace_id).order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("clients").select("*").eq("workspace_id", data.workspace_id).order("name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspace_id: z.string().uuid(),
    name: z.string().min(1).max(120),
    contact: z.string().max(200).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    currency: z.enum(["COP", "USD"]).optional(),
    type: z.enum(["recurrente", "proyecto", "cuota"]).optional(),
    monthly_amount: z.number().nullable().optional(),
    project_total: z.number().nullable().optional(),
    next_payment_date: z.string().nullable().optional(),
    status: z.enum(["activo", "pausado", "completado"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("clients").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    contact: z.string().max(200).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    currency: z.enum(["COP", "USD"]).optional(),
    type: z.enum(["recurrente", "proyecto", "cuota"]).optional(),
    monthly_amount: z.number().nullable().optional(),
    project_total: z.number().nullable().optional(),
    next_payment_date: z.string().nullable().optional(),
    status: z.enum(["activo", "pausado", "completado"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("clients").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase
      .from("transactions").select("id", { count: "exact", head: true }).eq("client_id", data.id);
    if ((count ?? 0) > 0) throw new Error("No se puede eliminar: tiene transacciones asociadas");
    const { error } = await context.supabase.from("clients").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---- Categories CRUD ----
export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspace_id: z.string().uuid(),
    code: z.string().min(1).max(20),
    name: z.string().min(1).max(120),
    type: z.enum(["ingreso", "egreso", "neutro"]),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("categories").insert({ ...data, is_system: false }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    type: z.enum(["ingreso", "egreso", "neutro"]).optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("categories").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: cat } = await context.supabase
      .from("categories").select("is_system").eq("id", data.id).maybeSingle();
    if (cat?.is_system) throw new Error("Las categorías del sistema no se pueden eliminar");
    const { count } = await context.supabase
      .from("transactions").select("id", { count: "exact", head: true }).eq("category_id", data.id);
    if ((count ?? 0) > 0) throw new Error("No se puede eliminar: tiene transacciones asociadas");
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ FIXED COSTS ============

const FixedCostInput = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  amount: z.number().min(0),
  currency: z.enum(["COP", "USD"]),
  category: z.enum(["payroll", "platform", "other"]),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const listFixedCosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("fixed_costs").select("*").eq("workspace_id", data.workspace_id)
      .order("sort_order", { ascending: true }).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createFixedCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => FixedCostInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("fixed_costs").insert(data).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateFixedCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    amount: z.number().min(0).optional(),
    currency: z.enum(["COP", "USD"]).optional(),
    category: z.enum(["payroll", "platform", "other"]).optional(),
    is_active: z.boolean().optional(),
    sort_order: z.number().int().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("fixed_costs").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFixedCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("fixed_costs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ TRANSACTIONS ============

const TxnInput = z.object({
  workspace_id: z.string().uuid(),
  date: z.string(),
  concept: z.string().min(1).max(200),
  type: z.enum(["ingreso", "egreso"]),
  amount: z.number().positive(),
  currency: z.enum(["COP", "USD"]),
  category_id: z.string().uuid().nullable().optional(),
  account: z.enum(["bancolombia", "stripe", "chase", "efectivo", "otra"]),
  source: z.enum(["manual", "telegram", "stripe", "ai_chat"]).default("manual"),
  client_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  is_pending: z.boolean().optional(),
  // for category 00011 USD->COP transfer
  pair_amount_cop: z.number().positive().nullable().optional(),
  pair_account: z.enum(["bancolombia", "stripe", "chase", "efectivo", "otra"]).nullable().optional(),
});

export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspace_id: z.string().uuid(),
    from: z.string().optional(),
    to: z.string().optional(),
    currency: z.enum(["COP", "USD"]).optional(),
    limit: z.number().int().min(1).max(500).default(100),
  }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("transactions")
      .select("*, category:categories(id,code,name), client:clients(id,name)")
      .eq("workspace_id", data.workspace_id)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.from) q = q.gte("date", data.from);
    if (data.to) q = q.lte("date", data.to);
    if (data.currency) q = q.eq("currency", data.currency);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => TxnInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Resolve category 00011 (transfer USD<->COP)
    let isTransfer = false;
    if (data.category_id) {
      const { data: cat } = await supabase.from("categories")
        .select("code").eq("id", data.category_id).maybeSingle();
      if (cat?.code === "00011") isTransfer = true;
    }

    if (isTransfer && data.currency === "USD" && data.pair_amount_cop) {
      // Create paired: USD egreso + COP ingreso
      const { data: usdRow, error: e1 } = await supabase.from("transactions").insert({
        workspace_id: data.workspace_id,
        date: data.date,
        concept: data.concept,
        type: "egreso",
        amount: data.amount,
        currency: "USD",
        category_id: data.category_id,
        account: data.account,
        source: data.source,
        notes: data.notes,
        created_by: userId,
      }).select().single();
      if (e1) throw new Error(e1.message);

      const { data: copRow, error: e2 } = await supabase.from("transactions").insert({
        workspace_id: data.workspace_id,
        date: data.date,
        concept: data.concept + " (recibido COP)",
        type: "ingreso",
        amount: data.pair_amount_cop,
        currency: "COP",
        category_id: data.category_id,
        account: data.pair_account ?? "bancolombia",
        source: data.source,
        notes: data.notes,
        paired_transaction_id: usdRow.id,
        created_by: userId,
      }).select().single();
      if (e2) throw new Error(e2.message);

      await supabase.from("transactions").update({ paired_transaction_id: copRow.id }).eq("id", usdRow.id);
      return { id: usdRow.id };
    }

    const { data: row, error } = await supabase.from("transactions").insert({
      ...data,
      pair_amount_cop: undefined,
      pair_account: undefined,
      created_by: userId,
    } as any).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    id: z.string().uuid(),
    date: z.string().optional(),
    concept: z.string().min(1).max(200).optional(),
    amount: z.number().positive().optional(),
    currency: z.enum(["COP", "USD"]).optional(),
    type: z.enum(["ingreso", "egreso"]).optional(),
    category_id: z.string().uuid().nullable().optional(),
    account: z.enum(["bancolombia", "stripe", "chase", "efectivo", "otra"]).optional(),
    client_id: z.string().uuid().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    is_pending: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("transactions").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // also delete paired transaction if any
    const { data: t } = await context.supabase.from("transactions")
      .select("paired_transaction_id").eq("id", data.id).maybeSingle();
    if (t?.paired_transaction_id) {
      await context.supabase.from("transactions").delete().eq("id", t.paired_transaction_id);
    }
    const { error } = await context.supabase.from("transactions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============ DASHBOARD ============

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspace_id: z.string().uuid(),
    from: z.string(),
    to: z.string(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: ws }, { data: txns, error: e1 }, { data: fixed, error: e2 }, { data: clients }] = await Promise.all([
      supabase.from("workspaces").select("*").eq("id", data.workspace_id).single(),
      supabase.from("transactions")
        .select("id,date,concept,type,amount,currency,account,source,is_pending,client_id,category:categories(code,name),client:clients(name)")
        .eq("workspace_id", data.workspace_id)
        .gte("date", data.from).lte("date", data.to)
        .order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("fixed_costs").select("*").eq("workspace_id", data.workspace_id).eq("is_active", true),
      supabase.from("clients").select("id,name").eq("workspace_id", data.workspace_id),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);

    const rate = Number(ws?.usd_cop_rate ?? 4000);
    const list = txns ?? [];

    // KPIs COP (convert USD)
    let ingresos = 0, gastos = 0, cartera = 0;
    let stripeUSD = 0, chaseUSD = 0;
    for (const t of list) {
      const amt = Number(t.amount);
      const inCop = t.currency === "USD" ? amt * rate : amt;
      if (t.is_pending && t.type === "ingreso") cartera += inCop;
      else if (t.type === "ingreso") ingresos += inCop;
      else gastos += inCop;

      if (t.currency === "USD" && !t.is_pending) {
        if (t.account === "stripe" && t.type === "ingreso") stripeUSD += amt;
        if (t.account === "chase" && t.type === "ingreso") chaseUSD += amt;
        if (t.account === "stripe" && t.type === "egreso") stripeUSD -= amt;
        if (t.account === "chase" && t.type === "egreso") chaseUSD -= amt;
      }
    }
    const utilidad = ingresos - gastos;

    // Fixed costs in COP
    let costosFijos = 0;
    for (const f of fixed ?? []) {
      const a = Number(f.amount);
      costosFijos += f.currency === "USD" ? a * rate : a;
    }
    const margen = ingresos > 0 ? Math.max(utilidad / ingresos, 0.05) : 0.30;
    const puntoEquilibrio = costosFijos / margen;
    const pctAlcanzado = puntoEquilibrio > 0 ? (ingresos / puntoEquilibrio) * 100 : 0;
    const status: "green" | "yellow" | "red" =
      pctAlcanzado >= 100 ? "green" : pctAlcanzado >= 70 ? "yellow" : "red";

    // Pending clients (cartera)
    const pendingByClient = new Map<string, { name: string; amount: number }>();
    for (const t of list) {
      if (t.is_pending && t.type === "ingreso" && t.client_id) {
        const c = pendingByClient.get(t.client_id) ?? { name: (t.client as any)?.name ?? "—", amount: 0 };
        c.amount += t.currency === "USD" ? Number(t.amount) * rate : Number(t.amount);
        pendingByClient.set(t.client_id, c);
      }
    }

    return {
      workspace: ws,
      kpis: { ingresos, gastos, utilidad, cartera },
      usd: { stripe: stripeUSD, chase: chaseUSD, total: stripeUSD + chaseUSD },
      lastTransactions: list.slice(0, 10),
      fixedCosts: fixed ?? [],
      breakEven: { costosFijos, margen, puntoEquilibrio, pctAlcanzado, status },
      pendingClients: Array.from(pendingByClient.entries()).map(([id, v]) => ({ id, ...v })),
    };
  });

// ============ TEAM ============

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("workspace_members")
      .select("id, role, user_id, profile:profiles(email, full_name, avatar_url)")
      .eq("workspace_id", data.workspace_id);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("workspace_invitations")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    workspace_id: z.string().uuid(),
    email: z.string().email(),
    role: z.enum(["admin", "member"]).default("member"),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("workspace_invitations")
      .insert({ ...data, invited_by: context.userId })
      .select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("workspace_invitations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ token: z.string().min(10) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: inv, error } = await supabase
      .from("workspace_invitations")
      .select("*").eq("token", data.token).maybeSingle();
    if (error) throw new Error(error.message);
    if (!inv) throw new Error("Invitación no válida");
    if (inv.accepted_at) throw new Error("Invitación ya aceptada");
    if (new Date(inv.expires_at) < new Date()) throw new Error("Invitación expirada");

    const { error: e1 } = await supabase.from("workspace_members").insert({
      workspace_id: inv.workspace_id, user_id: userId, role: inv.role,
    });
    if (e1 && !e1.message.includes("duplicate")) throw new Error(e1.message);

    await supabase.from("workspace_invitations").update({ accepted_at: new Date().toISOString() }).eq("id", inv.id);
    return { workspace_id: inv.workspace_id };
  });
