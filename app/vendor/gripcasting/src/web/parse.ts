/* BU Summary upload: reads the PNN BU / PNS BU / SMI BU tabs (or the three QuickBooks P&L by Business Unit
   exports) and the QB Back Up tab. Runs in the browser; SheetJS loads only when a file is dropped. */
import type { ActualRow, Tx } from "../shared/types";
import { BUS, GLS, buCode, isExcluded, iso, normGL, round2 } from "../shared/model";

type Cell = string | number | boolean | Date | null;
type Rows = Cell[][];

export interface EntityTie { e: string; cost: number; tie: number | null }
export interface TxCheck { count: number; from: string; to: string; noBU: number; total: number; diff: { g: string; d: number }[]; missing: string[] }
export interface Parsed {
  fileName: string; rows: ActualRow[]; ent: EntityTie[]; monthly: Record<string, Record<string, number>>; monthlyCount: number;
  closeDate: string | null; newGLs: string[]; tx: Tx[]; txCheck: TxCheck | null; error?: undefined;
}
export type Preview = Parsed | { fileName: string; error: string };

const GLRX = /^\d{4} · /;
export const TX_NOBU = "none";
function entityOf(name: string): string | null {
  const m = String(name).toUpperCase().match(/\b(PNN|PNS|SMI)\b/) || String(name).toUpperCase().match(/(PNN|PNS|SMI)/); return m ? m[1] : null;
}

export async function parseFiles(files: File[]): Promise<Preview> {
  const XLSX = await import("xlsx");
  const out: Parsed = { fileName: files.map(f => f.name).join(", "), rows: [], ent: [], monthly: {}, monthlyCount: 0, closeDate: null, newGLs: [], tx: [], txCheck: null };
  let maxDate: Date | null = null;
  for (const f of files) {
    const m = f.name.match(/(\d{2})[.\-_](\d{2})[.\-_](\d{2,4})/); if (m && !out.closeDate) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; out.closeDate = `${y}-${m[1]}-${m[2]}`; }
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[sn], { header: 1, raw: true, defval: null });
      if (/qb\s*back\s*up/i.test(sn)) { maxDate = parseQB(rows, out, maxDate); continue; }
      const e = entityOf(sn) || (wb.SheetNames.length === 1 ? entityOf(f.name) : null);
      if (!e) continue;
      const r = parseBU(rows, e); if (r) { out.rows.push(...r.rows); out.ent.push({ e, cost: r.cost, tie: r.tie }); }
    }
  }
  if (!out.closeDate && maxDate) out.closeDate = maxDate.toISOString().slice(0, 10);
  out.monthlyCount = Object.keys(out.monthly).length;
  out.txCheck = txCheck(out);
  const known = new Set(GLS); out.newGLs = [...new Set(out.rows.map(r => normGL(r[2])).filter(g => +g.slice(0, 4) >= 5000 && !known.has(g) && !isExcluded(g)))];
  if (!out.ent.length) return { fileName: out.fileName, error: "No PNN, PNS or SMI P&L by Business Unit tabs were found in this file." };
  return out;
}

function parseBU(rows: Rows, e: string): { rows: ActualRow[]; cost: number; tie: number | null } | null {
  let hi = -1, cols: [number, string][] = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const c: [number, string][] = []; (rows[i] || []).forEach((v, j) => { if (typeof v === "string" && /^\d{2} \S/.test(v.trim())) c.push([j, v.trim()]); });
    if (c.length) { hi = i; cols = c; break; }
  }
  if (hi < 0) return null;
  const hdr = rows[hi]; const keyCol = hdr.findIndex(v => typeof v === "string" && /concat/i.test(v));
  const totCol = hdr.findIndex(v => typeof v === "string" && /^total$/i.test(v.trim()));
  const outRows: ActualRow[] = []; let cost = 0, rev = 0, ni: number | null = null;
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i] || []; let key: string | null = null;
    const kc = keyCol >= 0 ? r[keyCol] : null; if (typeof kc === "string") key = kc.trim();
    if (!key) { for (let j = 0; j < (cols[0]?.[0] ?? r.length); j++) { const v = r[j]; if (typeof v === "string" && v.trim()) { key = v.trim(); break; } } }
    if (!key) continue;
    if (/^net income$/i.test(key)) { const t = totCol >= 0 ? r[totCol] : null; ni = typeof t === "number" ? t : cols.reduce((s, [j]) => s + (+(r[j] as number) || 0), 0); continue; }
    if (!GLRX.test(key)) continue;
    for (const [j, bu] of cols) { const v = r[j]; if (typeof v === "number" && Math.abs(v) > 0.004) { outRows.push([e, bu, key, round2(v)]); if (+key.slice(0, 4) < 5000) rev += v; else cost += v; } }
  }
  return { rows: outRows, cost, tie: ni === null ? null : round2(ni - (rev - cost)) };
}

/* QB Back Up: monthly totals per GL for run rates, plus each transaction for the Transactions tab.
   The BU is the Name column when it names a BU (Class is the harvest, not the BU); anything else goes to "No BU".
   Split (card holder names) and Balance are dropped. */
function parseQB(rows: Rows, out: Parsed, maxDate: Date | null): Date | null {
  const monthly = out.monthly;
  const hi = rows.findIndex(r => r && r.includes("Account") && (r.includes("Debit") || r.includes("Amount")));
  if (hi < 0) return maxDate;
  const h = rows[hi], ia = h.indexOf("Account"), idt = h.indexOf("Date"), idb = h.indexOf("Debit"), icr = h.indexOf("Credit"), iam = h.indexOf("Amount");
  const col = (n: string) => h.findIndex(v => typeof v === "string" && v.trim().toLowerCase() === n);
  const ity = col("type"), inum = col("num"), inm = col("name"), isrc = col("source name"), imemo = col("memo"), ifarm = col("farm");
  const str = (r: Cell[], j: number) => j >= 0 && r[j] != null ? String(r[j]).trim() : "";
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue; const d = r[idt]; if (!(d instanceof Date)) continue; const g = r[ia]; if (typeof g !== "string" || !GLRX.test(g.trim())) continue;
    const amt = iam >= 0 && typeof r[iam] === "number" ? r[iam] as number : (+(r[idb] as number) || 0) - (+(r[icr] as number) || 0);
    const k = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); const gg = g.trim(); monthly[gg] = monthly[gg] || {}; monthly[gg][k] = round2((monthly[gg][k] || 0) + amt);
    const nm = str(r, inm), bu = BUS.find(b => b.toLowerCase() === nm.toLowerCase());
    out.tx.push({ bu: bu ? buCode(bu) : TX_NOBU, r: [iso(d), str(r, ity), str(r, inum), str(r, isrc) || (bu ? "" : nm), str(r, imemo), normGL(gg), str(r, ifarm), round2(amt)] });
    if (!maxDate || d > maxDate) maxDate = d;
  }
  return maxDate;
}

/** upload preview: what the transaction detail covers and where it differs from the BU tabs, by GL */
function txCheck(p: Parsed): TxCheck | null {
  if (!p.tx.length) return null;
  const ds = p.tx.map(t => t.r[0]).sort(), det: Record<string, number> = {}, tab: Record<string, number> = {};
  for (const t of p.tx) { const g = t.r[5]; if (+g.slice(0, 4) >= 5000 && !isExcluded(g)) det[g] = (det[g] || 0) + t.r[7]; }
  for (const [, , g, a] of p.rows) { if (+g.slice(0, 4) < 5000 || isExcluded(g)) continue; const n = normGL(g); tab[n] = (tab[n] || 0) + a; }
  const diff = Object.keys(det).filter(g => Math.abs((tab[g] || 0) - det[g]) >= 1).map(g => ({ g, d: round2((tab[g] || 0) - det[g]) })).sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  return {
    count: p.tx.length, from: ds[0], to: ds[ds.length - 1], noBU: p.tx.filter(t => t.bu === TX_NOBU).length,
    total: round2(Object.values(det).reduce((s, v) => s + v, 0)), diff, missing: Object.keys(tab).filter(g => !(g in det) && Math.abs(tab[g]) >= 1).sort(),
  };
}
