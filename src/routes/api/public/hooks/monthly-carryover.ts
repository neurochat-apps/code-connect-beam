import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/monthly-carryover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
        const token = authHeader?.replace("Bearer ", "");
        if (!token || !expected || token !== expected) {
          return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("run_monthly_carryover");
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        return new Response(JSON.stringify({ ok: true, created: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
