import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, getWebhookSecret, type StripeEnv } from "@/lib/stripe.server";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") === "live" ? "live" : "sandbox") as StripeEnv;
        const signature = request.headers.get("stripe-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });

        const rawBody = await request.text();
        let event;
        try {
          const stripe = createStripeClient(env);
          event = stripe.webhooks.constructEvent(rawBody, signature, getWebhookSecret(env));
        } catch (e: any) {
          return new Response(`Invalid signature: ${e.message}`, { status: 400 });
        }

        // Idempotency
        const { data: existing } = await supabaseAdmin
          .from("stripe_events").select("id").eq("id", event.id).maybeSingle();
        if (existing) return Response.json({ ok: true, dup: true });

        // Pick first workspace (single-tenant agency use case)
        const { data: ws } = await supabaseAdmin
          .from("workspaces").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle();

        await supabaseAdmin.from("stripe_events").insert({
          id: event.id, type: event.type, workspace_id: ws?.id ?? null, payload: event as any,
        });

        if (ws && (event.type === "charge.succeeded" || event.type === "checkout.session.completed" || event.type === "invoice.paid")) {
          const obj: any = event.data.object;
          const amountCents = obj.amount_total ?? obj.amount_paid ?? obj.amount ?? 0;
          const amount = Number(amountCents) / 100;
          const currency = (obj.currency ?? "usd").toString().toUpperCase() === "USD" ? "USD" : "COP";
          const concept = obj.description ?? obj.statement_descriptor ?? `Stripe ${event.type}`;
          const date = new Date((event.created ?? Date.now() / 1000) * 1000).toISOString().slice(0, 10);

          if (amount > 0) {
            await supabaseAdmin.from("transactions").insert({
              workspace_id: ws.id, date, concept: String(concept).slice(0, 500),
              type: "ingreso", amount, currency, account: "stripe", source: "stripe",
              notes: `Stripe event ${event.id}`,
            });
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});
