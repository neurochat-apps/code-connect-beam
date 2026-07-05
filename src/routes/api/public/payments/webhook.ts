import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, getWebhookSecret, type StripeEnv } from "@/lib/stripe.server";

async function findCat(wsId: string, code: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("categories").select("id")
    .eq("workspace_id", wsId).eq("code", code).maybeSingle();
  return data?.id ?? null;
}

async function alreadyExists(wsId: string, marker: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("transactions").select("id")
    .eq("workspace_id", wsId).eq("source", "stripe")
    .ilike("notes", `%${marker}%`).maybeSingle();
  return !!data;
}

async function insertRow(wsId: string, marker: string, row: any, extraNote?: string) {
  if (await alreadyExists(wsId, marker)) return null;
  const notes = `Stripe ${marker}${extraNote ? ` · ${extraNote}` : ""}`;
  const { data } = await supabaseAdmin.from("transactions")
    .insert({ ...row, workspace_id: wsId, source: "stripe", account: row.account ?? "chase", notes })
    .select("id").maybeSingle();
  return data?.id ?? null;
}

async function handleChargeSucceeded(wsId: string, charge: any, stripe: any, evtId: string) {
  const catVentas = await findCat(wsId, "00001");
  const catFees = await findCat(wsId, "00014");
  const gross = Number(charge.amount ?? 0) / 100;
  const currency = String(charge.currency ?? "usd").toUpperCase() === "USD" ? "USD" : "COP";
  const date = new Date((charge.created ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10);
  const concept = (charge.description ?? charge.statement_descriptor ?? "Stripe payment").toString().slice(0, 500);

  // Try to resolve client by email
  let client_id: string | null = null;
  const email: string | undefined = charge.receipt_email ?? charge.billing_details?.email;
  if (email) {
    const { data: c } = await supabaseAdmin
      .from("clients").select("id")
      .eq("workspace_id", wsId).ilike("contact", `%${email}%`).maybeSingle();
    if (c) client_id = c.id;
  }

  if (gross > 0) {
    await insertRow(wsId, `${charge.id}:gross`, {
      date, concept, type: "ingreso", amount: gross, currency,
      category_id: catVentas, client_id,
    }, `evt ${evtId}`);
  }

  // Fetch balance_transaction to get exact fee
  let feeAmt = 0;
  try {
    if (charge.balance_transaction && typeof charge.balance_transaction === "string") {
      const bt = await stripe.balanceTransactions.retrieve(charge.balance_transaction);
      feeAmt = Number(bt.fee ?? 0) / 100;
    } else if (charge.balance_transaction && typeof charge.balance_transaction === "object") {
      feeAmt = Number(charge.balance_transaction.fee ?? 0) / 100;
    }
  } catch (e) {
    console.error("Failed to fetch balance_transaction:", e);
  }

  if (feeAmt > 0) {
    await insertRow(wsId, `${charge.id}:fee`, {
      date, concept: `Comisión Stripe · ${concept}`.slice(0, 500),
      type: "egreso", amount: feeAmt, currency,
      category_id: catFees,
    }, `evt ${evtId}`);
  }
}

async function handleChargeRefunded(wsId: string, charge: any, evtId: string) {
  const catVentas = await findCat(wsId, "00001");
  const refunded = Number(charge.amount_refunded ?? 0) / 100;
  const currency = String(charge.currency ?? "usd").toUpperCase() === "USD" ? "USD" : "COP";
  const date = new Date(Date.now()).toISOString().slice(0, 10);
  if (refunded > 0) {
    await insertRow(wsId, `${charge.id}:refund`, {
      date, concept: `Reembolso · ${charge.description ?? charge.id}`.slice(0, 500),
      type: "egreso", amount: refunded, currency,
      category_id: catVentas,
    }, `evt ${evtId}`);
  }
}

async function handleDispute(wsId: string, dispute: any, evtId: string) {
  const catFees = await findCat(wsId, "00014");
  const amt = Number(dispute.amount ?? 0) / 100;
  const currency = String(dispute.currency ?? "usd").toUpperCase() === "USD" ? "USD" : "COP";
  const date = new Date(Date.now()).toISOString().slice(0, 10);
  if (amt > 0) {
    await insertRow(wsId, `${dispute.id}:dispute`, {
      date, concept: `Disputa Stripe ${dispute.reason ?? ""}`.slice(0, 500),
      type: "egreso", amount: amt, currency,
      category_id: catFees,
    }, `evt ${evtId}`);
  }
}

async function handlePayoutPaid(wsId: string, payout: any, evtId: string) {
  const catTransfer = await findCat(wsId, "00011");
  const { data: ws } = await supabaseAdmin
    .from("workspaces").select("usd_cop_rate").eq("id", wsId).maybeSingle();
  const trm = Number(ws?.usd_cop_rate ?? 4000);
  const usdAmt = Number(payout.amount ?? 0) / 100;
  if (usdAmt <= 0) return;
  const copAmt = Math.round(usdAmt * trm);
  const date = new Date((payout.arrival_date ?? payout.created ?? Date.now() / 1000) * 1000)
    .toISOString().slice(0, 10);
  const concept = "Transferencia Chase (USD) → Bancolombia (COP)";

  if (await alreadyExists(wsId, `${payout.id}:transfer_out`)) return;

  const { data: usdRow } = await supabaseAdmin.from("transactions").insert({
    workspace_id: wsId, source: "stripe", account: "chase",
    date, concept, type: "egreso", amount: usdAmt, currency: "USD",
    category_id: catTransfer,
    notes: `Stripe ${payout.id}:transfer_out · TRM ${trm} · evt ${evtId}`,
  }).select("id").maybeSingle();

  const { data: copRow } = await supabaseAdmin.from("transactions").insert({
    workspace_id: wsId, source: "stripe", account: "bancolombia",
    date, concept, type: "ingreso", amount: copAmt, currency: "COP",
    category_id: catTransfer,
    notes: `Stripe ${payout.id}:transfer_in · TRM ${trm} · evt ${evtId}`,
    paired_transaction_id: usdRow?.id ?? null,
  }).select("id").maybeSingle();

  if (usdRow?.id && copRow?.id) {
    await supabaseAdmin.from("transactions")
      .update({ paired_transaction_id: copRow.id })
      .eq("id", usdRow.id);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") === "live" ? "live" : "sandbox") as StripeEnv;
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const rawBody = await request.text();
        let event: any;
        let stripe: any;
        try {
          stripe = createStripeClient(env);
          event = stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret(env));
        } catch (e: any) {
          return new Response(`Invalid signature: ${e.message}`, { status: 400 });
        }

        // Idempotencia por event.id
        const { data: existing } = await supabaseAdmin
          .from("stripe_events").select("id").eq("id", event.id).maybeSingle();
        if (existing) return Response.json({ ok: true, dup: true });

        const { data: ws } = await supabaseAdmin
          .from("workspaces").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();

        await supabaseAdmin.from("stripe_events").insert({
          id: event.id, type: event.type, workspace_id: ws?.id ?? null, payload: event as any,
        });

        if (!ws) return Response.json({ ok: true });
        const wsId = ws.id as string;

        try {
          switch (event.type) {
            case "charge.succeeded":
              await handleChargeSucceeded(wsId, event.data.object, stripe, event.id);
              break;
            case "charge.refunded":
              await handleChargeRefunded(wsId, event.data.object, event.id);
              break;
            case "charge.dispute.funds_withdrawn":
            case "charge.dispute.created":
              await handleDispute(wsId, event.data.object, event.id);
              break;
            case "payout.paid":
              await handlePayoutPaid(wsId, event.data.object, event.id);
              break;
            default:
              // Ignored events (checkout.session.completed, invoice.paid) — charge.succeeded ya cubre
              break;
          }
        } catch (e: any) {
          console.error("Stripe webhook handler error:", e);
        }

        return Response.json({ ok: true });
      },
    },
  },
});
