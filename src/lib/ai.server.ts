// Server-only Gemini helpers. Never import from client code.

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function geminiCall(opts: {
  system?: string;
  user: string;
  json?: boolean;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");

  const body: any = {
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: opts.json ? { responseMimeType: "application/json" } : {},
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 300)}`);
  }
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

export type ExtractedTxn = {
  found: boolean;
  confidence: number; // 0-1
  type?: "ingreso" | "egreso";
  amount?: number;
  currency?: "COP" | "USD";
  concept?: string;
  category_code?: string; // 00001..00013
  client_hint?: string;
  account?: "bancolombia" | "stripe" | "chase" | "efectivo" | "otra";
};

export async function extractTransaction(text: string): Promise<ExtractedTxn> {
  const system = `Eres un asistente que extrae transacciones financieras de mensajes informales en español colombiano.
Devuelve SIEMPRE JSON con este formato exacto:
{"found":boolean,"confidence":0-1,"type":"ingreso"|"egreso","amount":number,"currency":"COP"|"USD","concept":string,"category_code":string,"client_hint":string|null,"account":"bancolombia"|"stripe"|"chase"|"efectivo"|"otra"}

Categorías disponibles:
00001 Ventas/Servicios, 00002 Otros ingresos, 00003 Nómina, 00004 Plataformas,
00005 Publicidad, 00006 Honorarios, 00007 Servicios públicos, 00008 Arriendo,
00009 Suministros, 00010 Impuestos, 00011 Transferencia USD↔COP,
00012 Comisiones bancarias, 00013 Otros gastos.

Si el monto no tiene moneda explícita asume COP. "k"=mil, "M"=millón.
Si no es una transacción válida: {"found":false,"confidence":0}.`;

  const raw = await geminiCall({ system, user: text, json: true });
  try {
    return JSON.parse(raw) as ExtractedTxn;
  } catch {
    return { found: false, confidence: 0 };
  }
}
