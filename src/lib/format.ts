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

export type Period = "today" | "week" | "month" | "quarter" | "year" | "all";

function iso(d: Date) { return d.toISOString().slice(0, 10); }

export function periodRange(p: Period): { from: string; to: string } {
  const now = new Date();
  const to = iso(now);
  const from = new Date(now);
  switch (p) {
    case "today": break;
    case "week": from.setDate(now.getDate() - 7); break;
    case "month": from.setDate(1); break;
    case "quarter": from.setMonth(now.getMonth() - 3); break;
    case "year": from.setMonth(0); from.setDate(1); break;
    case "all": return { from: "1970-01-01", to };
  }
  return { from: iso(from), to };
}

/** YYYY-MM → rango del mes completo */
export function monthRange(ym: string): { from: string; to: string } {
  const [y, m] = ym.split("-").map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0); // último día del mes
  return { from: iso(from), to: iso(to) };
}

export function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
