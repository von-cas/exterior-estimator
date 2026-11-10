export const usd = (cents: number) =>
  (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const num = (x: number | null | undefined, digits = 2) =>
  x === null || x === undefined ? "—" : x.toLocaleString("en-US", { maximumFractionDigits: digits });
/** 176.6667 ft → 176' 8" */
export const feetInches = (x: number) => {
  const f = Math.floor(x + 1e-9);
  const i = Math.round((x - f) * 12);
  return i === 12 ? `${f + 1}'` : i ? `${f}' ${i}"` : `${f}'`;
};
export const when = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const TRADE_LABEL: Record<string, string> = { roofing: "Roofing", siding: "Siding", windows: "Windows", gutters: "Gutters" };
