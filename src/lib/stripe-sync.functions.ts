import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STRIPE_API = "https://api.stripe.com/v1";

function stripeKey() {
  const k = process.env.STRIPE_ACCOUNT_API_KEY;
  if (!k) throw new Error("STRIPE_ACCOUNT_API_KEY not configured");
  return k;
}

async function stripeGet(path: string, params: Record<string, string | number>) {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await fetch(`${STRIPE_API}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${stripeKey()}` },
  });
  if (!res.ok) throw new Error(`Stripe ${path}: ${res.status} ${await res.text()}`);
  return res.json();
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
    const { supabase } = context;
    const sinceTs = Math.floor(new Date(data.since + "T00:00:00Z").getTime() / 1000);

    let starting_after: string | undefined;
    let inserted = 0;
    let skipped = 0;
    let scanned = 0;

    while (true) {
      const params: Record<string, string | number> = {
        limit: 100,
        "created[gte]": sinceTs,
      };
      if (starting_after) params.starting_after = starting_after;

      const page = await stripeGet("/balance_transactions", params);
      const items: any[] = page.data ?? [];
      if (items.length === 0) break;

      for (const bt of items) {
        scanned++;
        // skip payouts (just money movement out, not income/expense)
        if (bt.type === "payout") { skipped++; continue; }

        // idempotency via stripe_events table
        const eventId = `bt_${bt.id}`;
        const { data: exists } = await supabase
          .from("stripe_events").select("id").eq("id", eventId).maybeSingle();
        if (exists) { skipped++; continue; }

        const amountCents = Number(bt.net ?? bt.amount ?? 0);
        if (amountCents === 0) { skipped++; continue; }

        const amount = Math.abs(amountCents) / 100;
        const type = amountCents > 0 ? "ingreso" : "egreso";
        const currency = String(bt.currency ?? "usd").toUpperCase() === "USD" ? "USD" : "COP";
        const date = new Date(bt.created * 1000).toISOString().slice(0, 10);
        const concept = (bt.description ?? `Stripe ${bt.type}`).toString().slice(0, 500);

        const { error: txnErr } = await supabase.from("transactions").insert({
          workspace_id: data.workspace_id,
          date, concept, type, amount, currency,
          account: "stripe", source: "stripe",
          notes: `Stripe ${bt.type} · ${bt.id}`,
        });
        if (txnErr) { skipped++; continue; }

        await supabase.from("stripe_events").insert({
          id: eventId, type: `sync.${bt.type}`,
          workspace_id: data.workspace_id, payload: bt as any,
        });
        inserted++;
      }

      if (!page.has_more) break;
      starting_after = items[items.length - 1].id;
    }

    return { inserted, skipped, scanned, since: data.since };
  });
