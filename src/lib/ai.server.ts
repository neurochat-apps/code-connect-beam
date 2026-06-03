// Server-only AI helpers via Lovable AI Gateway (Gemini con tool-calling).
// Never import from client code.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";
const LEGACY_MODEL = "gemini-2.5-flash";

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
};

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: any;
  };
};

export async function gatewayChat(opts: {
  messages: ChatMessage[];
  tools?: ToolDef[];
  tool_choice?: "auto" | "none";
  json?: boolean;
}): Promise<{
  content: string | null;
  tool_calls: Array<{ id: string; name: string; arguments: any }> | null;
}> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY no configurada");

  const body: any = {
    model: MODEL,
    messages: opts.messages,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = opts.tool_choice ?? "auto";
  }
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    if (res.status === 429) throw new Error("Límite de uso de IA alcanzado, intenta en unos segundos.");
    if (res.status === 402) throw new Error("Se agotaron los créditos de IA. Recarga en Lovable Cloud.");
    throw new Error(`AI Gateway ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message ?? {};
  const tc = Array.isArray(msg.tool_calls) && msg.tool_calls.length
    ? msg.tool_calls.map((c: any) => ({
        id: c.id,
        name: c.function?.name,
        arguments: safeJson(c.function?.arguments),
      }))
    : null;
  return { content: msg.content ?? null, tool_calls: tc };
}

function safeJson(s: any) {
  if (typeof s !== "string") return s ?? {};
  try { return JSON.parse(s); } catch { return {}; }
}

// ---- Legacy: extracción de transacciones (Gemini directo, usado por bot Telegram) ----

export type ExtractedTxn = {
  found: boolean;
  confidence: number;
  type?: "ingreso" | "egreso";
  amount?: number;
  currency?: "COP" | "USD";
  concept?: string;
  category_code?: string;
  client_hint?: string;
  account?: "bancolombia" | "stripe" | "chase" | "efectivo" | "otra";
};

export async function extractTransaction(text: string): Promise<ExtractedTxn> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    // Fallback to gateway
    const res = await gatewayChat({
      json: true,
      messages: [
        { role: "system", content: extractSystemPrompt() },
        { role: "user", content: text },
      ],
    });
    try { return JSON.parse(res.content ?? "{}"); } catch { return { found: false, confidence: 0 }; }
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${LEGACY_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text }] }],
      systemInstruction: { parts: [{ text: extractSystemPrompt() }] },
      generationConfig: { responseMimeType: "application/json" },
    }),
  });
  if (!res.ok) return { found: false, confidence: 0 };
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  try { return JSON.parse(raw); } catch { return { found: false, confidence: 0 }; }
}

function extractSystemPrompt() {
  return `Eres un asistente que extrae transacciones financieras de mensajes informales en español colombiano.
Devuelve SIEMPRE JSON con este formato exacto:
{"found":boolean,"confidence":0-1,"type":"ingreso"|"egreso","amount":number,"currency":"COP"|"USD","concept":string,"category_code":string,"client_hint":string|null,"account":"bancolombia"|"stripe"|"chase"|"efectivo"|"otra"}

Categorías: 00001 Ventas, 00002 Otros ingresos, 00003 Nómina, 00004 Plataformas,
00005 Publicidad, 00006 Honorarios, 00007 Servicios públicos, 00008 Arriendo,
00009 Suministros, 00010 Impuestos, 00011 Transferencia USD↔COP,
00012 Comisiones bancarias, 00013 Otros gastos.

Si el monto no tiene moneda explícita asume COP. "k"=mil, "M"=millón.
Si no es una transacción válida: {"found":false,"confidence":0}.`;
}
