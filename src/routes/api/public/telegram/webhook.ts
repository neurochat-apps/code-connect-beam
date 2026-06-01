import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { extractTransaction } from "@/lib/ai.server";

const ALLOWED_CHAT_ID = "5187124619";

function deriveSecret(key: string) {
  return createHash("sha256").update(`telegram-webhook:${key}`).digest("base64url");
}
function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function sendTelegram(chatId: number | string, text: string) {
  const lov = process.env.LOVABLE_API_KEY;
  const tg = process.env.TELEGRAM_API_KEY;
  if (!lov || !tg) return;
  await fetch("https://connector-gateway.lovable.dev/telegram/sendMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lov}`,
      "X-Connection-Api-Key": tg,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  }).catch(() => {});
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const tg = process.env.TELEGRAM_API_KEY;
        if (!tg) return new Response("Not configured", { status: 500 });

        const expected = deriveSecret(tg);
        const got = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(got, expected)) return new Response("Unauthorized", { status: 401 });

        const update = await request.json();
        const msg = update.message ?? update.edited_message;
        const chatId = msg?.chat?.id;
        const text: string | undefined = msg?.text;
        const messageId: number | undefined = msg?.message_id;

        if (!chatId || !text) return Response.json({ ok: true, ignored: "no-text" });
        if (String(chatId) !== ALLOWED_CHAT_ID) {
          return Response.json({ ok: true, ignored: "unauthorized-chat" });
        }

        // Find workspace by telegram_group_id
        const { data: ws } = await supabaseAdmin
          .from("workspaces")
          .select("id")
          .eq("telegram_group_id", String(chatId))
          .limit(1)
          .maybeSingle();
        if (!ws) {
          await sendTelegram(chatId, "⚠️ Ningún workspace tiene este grupo configurado.");
          return Response.json({ ok: true });
        }

        // Idempotency
        if (messageId) {
          const { data: dup } = await supabaseAdmin
            .from("transactions")
            .select("id")
            .eq("workspace_id", ws.id)
            .eq("telegram_message_id", messageId)
            .maybeSingle();
          if (dup) return Response.json({ ok: true, ignored: "dup" });
        }

        let extracted;
        try {
          extracted = await extractTransaction(text);
        } catch (e: any) {
          await sendTelegram(chatId, `⚠️ Error IA: ${e.message}`);
          return Response.json({ ok: true });
        }

        if (!extracted.found || extracted.confidence < 0.6) {
          return Response.json({ ok: true, ignored: "low-confidence" });
        }

        // Resolve category by code
        let categoryId: string | null = null;
        if (extracted.category_code) {
          const { data: cat } = await supabaseAdmin
            .from("categories").select("id")
            .eq("workspace_id", ws.id).eq("code", extracted.category_code).maybeSingle();
          categoryId = cat?.id ?? null;
        }

        // Resolve client by hint
        let clientId: string | null = null;
        if (extracted.client_hint) {
          const { data: cli } = await supabaseAdmin
            .from("clients").select("id")
            .eq("workspace_id", ws.id)
            .ilike("name", `%${extracted.client_hint}%`).limit(1).maybeSingle();
          clientId = cli?.id ?? null;
        }

        const { error } = await supabaseAdmin.from("transactions").insert({
          workspace_id: ws.id,
          date: new Date().toISOString().slice(0, 10),
          concept: extracted.concept ?? text.slice(0, 120),
          type: extracted.type ?? "egreso",
          amount: extracted.amount ?? 0,
          currency: extracted.currency ?? "COP",
          category_id: categoryId,
          client_id: clientId,
          account: extracted.account ?? "bancolombia",
          source: "telegram",
          telegram_message_id: messageId ?? null,
        });
        if (error) {
          await sendTelegram(chatId, `⚠️ Error DB: ${error.message}`);
          return Response.json({ ok: false });
        }

        const emoji = extracted.type === "ingreso" ? "💰" : "💸";
        await sendTelegram(
          chatId,
          `${emoji} <b>${extracted.type}</b> ${extracted.amount} ${extracted.currency}\n${extracted.concept ?? ""}`,
        );
        return Response.json({ ok: true });
      },
    },
  },
});
