/* Display formatting: whole dollars, negatives in parentheses. */
export const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
export const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (x: number) => (x < 0 ? "(" : "") + nf0.format(Math.abs(Math.round(x))) + (x < 0 ? ")" : "");
export const dash = (x: number) => Math.abs(x) < 0.5 ? "–" : money(x);
export function big(x: number): string {
  const a = Math.abs(x), s = x < 0 ? "−" : "";
  if (a >= 1e6) return s + "$" + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "M";
  if (a >= 1e3) return s + "$" + Math.round(a / 1e3) + "K";
  return s + "$" + Math.round(a);
}
export const pct = (x: number) => Math.abs(x) < 0.0005 ? "0%" : (x * 100).toFixed(Math.abs(x) < 0.1 ? 1 : 0) + "%";
export function esc(s: unknown): string { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)); }
export function parseNum(s: string): number { s = String(s).replace(/[$,\s]/g, ""); if (s.endsWith("%")) return parseFloat(s) / 100; const n = parseFloat(s); return isFinite(n) ? n : 0; }
export function fmtDate(iso: string | null | undefined): string { if (!iso) return ""; const d = new Date(iso.slice(0, 10) + "T00:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
export const fmtStamp = (iso: string) => new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
export const monthLbl = (k: string) => new Date(k + "-01T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
export function fmtIn(v: number, isPct?: boolean | string | number): string { return isPct ? (v * 100).toFixed(2).replace(/\.?0+$/, "") + "%" : nf2.format(v); }
