const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function headers() {
  const lov = process.env.LOVABLE_API_KEY;
  const gs = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lov) throw new Error("LOVABLE_API_KEY no configurado");
  if (!gs) throw new Error("GOOGLE_SHEETS_API_KEY no configurado (conecta Google Sheets)");
  return {
    Authorization: `Bearer ${lov}`,
    "X-Connection-Api-Key": gs,
    "Content-Type": "application/json",
  };
}

export function extractSpreadsheetId(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(input.trim())) return input.trim();
  return null;
}

export interface SheetMeta {
  spreadsheetId: string;
  title: string;
  sheets: { sheetId: number; title: string; rowCount: number; columnCount: number }[];
}

export async function getSpreadsheetMeta(spreadsheetId: string): Promise<SheetMeta> {
  const url = `${GATEWAY}/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties(sheetId,title,gridProperties)`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Google Sheets error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title ?? "",
    sheets: (data.sheets ?? []).map((s: any) => ({
      sheetId: s.properties.sheetId,
      title: s.properties.title,
      rowCount: s.properties.gridProperties?.rowCount ?? 0,
      columnCount: s.properties.gridProperties?.columnCount ?? 0,
    })),
  };
}

export async function getSheetValues(spreadsheetId: string, range: string): Promise<string[][]> {
  const url = `${GATEWAY}/spreadsheets/${spreadsheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`Google Sheets error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.values ?? []) as string[][];
}
