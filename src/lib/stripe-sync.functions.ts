import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STRIPE_API = "https://api.stripe.com/v1";

function stripeKey() {
  const k = process.env.STRIPE_ACCOUNT_API_KEY;
  if (!k) throw new Error("STRIPE_ACCOUNT_API_KEY not configured");
  return k;
}

async function stripeGet(path: string, params: Record<string, string | number | string[]>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.forEach((vv) => qs.append(k, vv));
    else qs.append(k, String(v));
  }
  const res = await fetch(`${STRIPE_API}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${stripeKey()}` },
  });
  if (!res.ok) throw new Error(`Stripe ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

type Counters = {
  gross: number; fee: number; refund: number; adjustment: number;
  payouts: number; scanned: number; skipped: number; inserted: number;
  grossUsd: number; feeUsd: number; payoutUsd: number;
};

async function processStripeSince(
  supabase: any,
  workspaceId: string,
  since: string,
): Promise<Counters> {
  const sinceTs = Math.floor(new Date(since + "T00:00:00Z").getTime() / 1000);

  // Load category ids
  const { data: cats } = await supabase
    .from("categories").select("id,code")
    .eq("workspace_id", workspaceId)
    .in("code", ["00001", "00011", "00014"]);
  const catBy = new Map<string, string>((cats ?? []).map((c: any) => [c.code, c.id]));
  const catVentas = catBy.get("00001") ?? null;
  const catTransfer = catBy.get("00011") ?? null;
  const catFees = catBy.get("00014") ?? null;

  // TRM
  const { data: ws } = await supabase
    .from("workspaces").select("usd_cop_rate").eq("id", workspaceId).maybeSingle();
  const trm = Number(ws?.usd_cop_rate ?? 4000);

  const c: Counters = {
    gross: 0, fee: 0, refund: 0, adjustment: 0, payouts: 0,
    scanned: 0, skipped: 0, inserted: 0,
    grossUsd: 0, feeUsd: 0, payoutUsd: 0,
  };

  async function insertIfNew(kind: string, externalId: string, row: any) {
    const marker = `${externalId}:${kind}`;
    const { data: dup } = await supabase
      .from("transactions").select("id")
      .eq("workspace_id", workspaceId)
      .eq("source", "stripe")
      .ilike("notes", `%${marker}%`)
      .maybeSingle();
    if (dup) { c.skipped++; return null; }
    const notes = `Stripe ${marker}${row.notes ? ` · ${row.notes}` : ""}`;
    const { data: inserted, error } = await supabase
      .from("transactions")
      .insert({ ...row, workspace_id: workspaceId, source: "stripe", account: row.account ?? "stripe", notes })
      .select("id").maybeSingle();
    if (error) { c.skipped++; return null; }
    c.inserted++;
    return inserted?.id ?? null;
  }

  let starting_after: string | undefined;
  while (true) {
    const params: Record<string, string | number | string[]> = {
      limit: 100, "created[gte]": sinceTs,
      "expand[]": ["data.source"],
    };
    if (starting_after) params.starting_after = starting_after;

    const page = await stripeGet("/balance_transactions", params);
    const items: any[] = page.data ?? [];
    if (items.length === 0) break;

    for (const bt of items) {
      c.scanned++;
      const currency = String(bt.currency ?? "usd").toUpperCase() === "USD" ? "USD" : "COP";
      const date = new Date(bt.created * 1000).toISOString().slice(0, 10);
      const type: string = bt.type;
      const source = bt.source;
      const sourceId: string = typeof source === "string" ? source : source?.id ?? bt.id;

      if (type === "charge" || type === "payment") {
        // amount: cents (positive); fee: cents
        const gross = Math.abs(Number(bt.amount ?? 0)) / 100;
        const feeAmt = Math.abs(Number(bt.fee ?? 0)) / 100;
        const concept = (source?.description ?? source?.statement_descriptor ?? bt.description ?? "Stripe payment")
          .toString().slice(0, 500);

        if (gross > 0) {
          const id = await insertIfNew("gross", sourceId, {
            date, concept, type: "ingreso", amount: gross, currency,
            category_id: catVentas,
          });
          if (id) { c.gross++; c.grossUsd += gross; }
        }
        if (feeAmt > 0) {
          const id = await insertIfNew("fee", sourceId, {
            date, concept: `Comisión Stripe · ${concept}`.slice(0, 500),
            type: "egreso", amount: feeAmt, currency,
            category_id: catFees,
          });
          if (id) { c.fee++; c.feeUsd += feeAmt; }
        }
        continue;
      }


      if (type === "refund" || type === "payment_refund") {
        const amt = Math.abs(Number(bt.amount ?? 0)) / 100;
        const concept = (source?.description ?? "Reembolso Stripe").toString().slice(0, 500);
        if (amt > 0) {
          const id = await insertIfNew("refund", sourceId, {
            date, concept, type: "egreso", amount: amt, currency,
            category_id: catVentas,
          });
          if (id) c.refund++;
        }
        continue;
      }

      if (type === "stripe_fee" || type === "adjustment" || type === "application_fee") {
        const amt = Math.abs(Number(bt.amount ?? 0)) / 100;
        const concept = (bt.description ?? `Cargo Stripe (${type})`).toString().slice(0, 500);
        if (amt > 0) {
          const id = await insertIfNew("adj", bt.id, {
            date, concept, type: "egreso", amount: amt, currency,
            category_id: catFees,
          });
          if (id) c.adjustment++;
        }
        continue;
      }

      if (type === "payout") {
        // Transferencia: USD sale de la billetera Stripe y entra a Chase (USD). Sin conversión.
        const usdAmt = Math.abs(Number(bt.amount ?? 0)) / 100;
        if (usdAmt <= 0) { c.skipped++; continue; }
        const concept = `Transferencia Stripe (USD) → Chase (USD)`;

        const outMarker = `${sourceId}:transfer_out`;
        const { data: existing } = await supabase
          .from("transactions").select("id")
          .eq("workspace_id", workspaceId).eq("source", "stripe")
          .ilike("notes", `%${outMarker}%`).maybeSingle();
        if (existing) { c.skipped++; continue; }

        const { data: outRow } = await supabase.from("transactions").insert({
          workspace_id: workspaceId, source: "stripe", account: "stripe",
          date, concept, type: "egreso", amount: usdAmt, currency: "USD",
          category_id: catTransfer,
          notes: `Stripe ${outMarker}`,
        }).select("id").maybeSingle();

        const { data: inRow } = await supabase.from("transactions").insert({
          workspace_id: workspaceId, source: "stripe", account: "chase",
          date, concept, type: "ingreso", amount: usdAmt, currency: "USD",
          category_id: catTransfer,
          notes: `Stripe ${sourceId}:transfer_in`,
          paired_transaction_id: outRow?.id ?? null,
        }).select("id").maybeSingle();

        if (outRow?.id && inRow?.id) {
          await supabase.from("transactions")
            .update({ paired_transaction_id: inRow.id })
            .eq("id", outRow.id);
          c.inserted += 2;
          c.payouts++;
          c.payoutUsd += usdAmt;
        }
        continue;
      }

      c.skipped++;
    }

    if (!page.has_more) break;
    starting_after = items[items.length - 1].id;
  }

  return c;
}

export const syncStripeAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspace_id: z.string().uuid(),
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-06-01"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const c = await processStripeSince(context.supabase, data.workspace_id, data.since);
    return c;
  });

export const resyncStripeSince = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      workspace_id: z.string().uuid(),
      since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default("2026-06-01"),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Wipe existing Stripe rows from `since` onwards
    const { data: deletedRows } = await supabase
      .from("transactions")
      .delete()
      .eq("workspace_id", data.workspace_id)
      .eq("source", "stripe")
      .gte("date", data.since)
      .select("id");
    const deleted = deletedRows?.length ?? 0;
    const c = await processStripeSince(supabase, data.workspace_id, data.since);
    return { ...c, deleted };
  });
