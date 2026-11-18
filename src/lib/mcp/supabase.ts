import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

type RuntimeGlobals = typeof globalThis & { process?: { env?: Record<string, string | undefined> } };
function env(names: string[]): string | undefined {
  const p = (globalThis as RuntimeGlobals).process?.env;
  for (const n of names) { const v = p?.[n]?.trim(); if (v) return v; }
  return undefined;
}
function url() {
  const u = env(["SUPABASE_URL", "VITE_SUPABASE_URL"]) ?? import.meta.env.VITE_SUPABASE_URL;
  if (!u) throw new Error("SUPABASE_URL is required");
  return u;
}
function key() {
  const k = env(["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]) ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!k) throw new Error("SUPABASE_PUBLISHABLE_KEY is required");
  return k;
}
export function supabaseForUser(ctx: ToolContext) {
  const token = ctx.getToken();
  if (!token) throw new Error("supabaseForUser requires a verified OAuth token");
  return createClient(url(), key(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
