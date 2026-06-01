export function fmtCOP(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
}

export function fmtUSD(n: number | null | undefined): string {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(v);
}

export function fmtMoney(n: number | null | undefined, currency: "COP" | "USD"): string {
  return currency === "USD" ? fmtUSD(n) : fmtCOP(n);
}

export function fmtDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
}

export function fmtShortDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(date);
}

export type Period = "today" | "week" | "month" | "quarter" | "year";

export function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now);
  switch (p) {
    case "today": break;
    case "week": from.setDate(now.getDate() - 7); break;
    case "month": from.setDate(1); break;
    case "quarter": from.setMonth(now.getMonth() - 3); break;
    case "year": from.setMonth(0); from.setDate(1); break;
  }
  return { from: from.toISOString().slice(0, 10), to };
}
