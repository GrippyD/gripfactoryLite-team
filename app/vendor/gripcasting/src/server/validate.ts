/* Input checks for request bodies. Anything that fails is a 422 with a plain message. */
import type { ActualRow, ActualsUpload, BuildDoc, BuildItem, BuildLine, Drivers, LineStatus, Tx, Vol, VolBase } from "../shared/types";
import { HttpError } from "./env";

const bad = (msg: string): never => { throw new HttpError(422, msg); };
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x: unknown, what: string) => (typeof x === "number" && isFinite(x)) ? x : bad(`${what} must be a number.`);
const str = (x: unknown, what: string, max = 500) => (typeof x === "string" && x.length <= max) ? x : bad(`${what} must be text (up to ${max} characters).`);
const optStr = (x: unknown, what: string, max = 500) => x == null ? undefined : str(x, what, max);
const optNum = (x: unknown, what: string) => x == null || x === "" ? undefined : num(x, what);
export const isoDate = (x: unknown, what: string) => (typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x) && !isNaN(Date.parse(x))) ? x : bad(`${what} must be a date (YYYY-MM-DD).`);
const optDate = (x: unknown, what: string) => x == null || x === "" ? undefined : isoDate(x, what);
export const version = (x: unknown) => x == null ? null : (typeof x === "string" && !isNaN(Date.parse(x))) ? x : bad("version must be a timestamp or null.");

const VOL_BOOL = new Set(["premOn", "ghOn", "iprOn", "ibOn", "tpsOn"]);
export function drivers(x: unknown, volKeys: string[]): Drivers {
  if (!isObj(x) || !isObj(x.vol)) bad("drivers.vol is required.");
  const d = x as { vol: Record<string, unknown>; gl?: unknown }, vol: Record<string, number | boolean> = {};
  for (const k of volKeys) {
    const v = d.vol[k];
    if (VOL_BOOL.has(k)) vol[k] = typeof v === "boolean" ? v : bad(`drivers.vol.${k} must be true or false.`);
    else vol[k] = num(v, `drivers.vol.${k}`);
  }
  return { vol: vol as unknown as Vol, gl: isObj(d.gl) ? d.gl as Drivers["gl"] : {} };
}

const STATUSES: LineStatus[] = ["notstarted", "inprogress", "fixed", "closed"];
const BASES: VolBase[] = ["wet", "dry", "bud", "trim", "prepack", "plants"];
function item(x: unknown, i: number): BuildItem {
  if (!isObj(x)) return bad(`item ${i + 1} is not valid.`);
  const it: BuildItem = { id: str(x.id, "item id", 40) };
  const drv = x.drv == null || x.drv === "" ? undefined : BASES.includes(x.drv as VolBase) ? x.drv as VolBase : bad("item driver is not valid.");
  Object.assign(it, {
    desc: optStr(x.desc, "item description", 500), po: optStr(x.po, "PO #", 100), drv,
    share: optNum(x.share, "share"), per: optNum(x.per, "per hour"), qty: optNum(x.qty, "quantity"), unit: optStr(x.unit, "unit", 50), cost: optNum(x.cost, "unit cost"),
    start: optDate(x.start, "start date"), end: optDate(x.end, "end date"),
    month: x.month == null ? undefined : (typeof x.month === "string" && /^\d{4}-\d{2}$/.test(x.month) ? x.month : bad("item month is not valid.")),
  });
  for (const k of Object.keys(it) as (keyof BuildItem)[]) if (it[k] === undefined) delete it[k];
  return it;
}
export function buildDoc(x: unknown): BuildDoc {
  if (!isObj(x) || !isObj(x.lines)) return bad("build.lines is required.");
  const lines: Record<string, BuildLine> = {};
  const entries = Object.entries(x.lines); if (entries.length > 200) bad("Too many lines.");
  for (const [g, l] of entries) {
    str(g, "GL", 200); if (!isObj(l)) bad(`line ${g} is not valid.`);
    const ln = l as Record<string, unknown>;
    const status = STATUSES.includes(ln.status as LineStatus) ? ln.status as LineStatus : bad(`status on ${g} is not valid.`);
    const items = Array.isArray(ln.items) ? ln.items : []; if (items.length > 500) bad("Too many items.");
    lines[g] = { status, items: items.map(item), reason: optStr(ln.reason, "reason", 2000) || "", custom: ln.custom === true };
  }
  return { bu: typeof x.bu === "string" ? x.bu : "", lines };
}

export function actualsUpload(x: unknown): ActualsUpload {
  if (!isObj(x)) return bad("Upload body is required.");
  const closeDate = isoDate(x.closeDate, "closeDate"), fileName = str(x.fileName, "fileName", 500);
  const rowsIn = Array.isArray(x.rows) ? x.rows : bad("rows is required."); if (rowsIn.length > 20000) bad("Too many rows.");
  const rows: ActualRow[] = rowsIn.map((r, i) => Array.isArray(r) && r.length === 4 ? [str(r[0], `row ${i + 1} entity`, 20), str(r[1], `row ${i + 1} BU`, 200), str(r[2], `row ${i + 1} GL`, 200), num(r[3], `row ${i + 1} amount`)] : bad(`row ${i + 1} is not valid.`));
  const monthly: Record<string, Record<string, number>> = {};
  if (isObj(x.monthly)) for (const [g, m] of Object.entries(x.monthly)) {
    if (!isObj(m)) return bad("monthly is not valid."); monthly[str(g, "GL", 200)] = {};
    for (const [k, v] of Object.entries(m)) { if (!/^\d{4}-\d{2}$/.test(k)) bad("monthly month is not valid."); monthly[g][k] = num(v, "monthly amount"); }
  }
  const txIn = Array.isArray(x.transactions) ? x.transactions : []; if (txIn.length > 100000) bad("Too many transactions.");
  const transactions: Tx[] = txIn.map((t, i) => {
    if (!isObj(t) || !Array.isArray(t.r) || t.r.length !== 8) return bad(`transaction ${i + 1} is not valid.`);
    const r = t.r;
    return { bu: str(t.bu, "transaction BU", 10), r: [isoDate(r[0], "transaction date"), str(r[1], "type", 100), str(r[2], "num", 200), str(r[3], "vendor", 500), str(r[4], "memo", 4000), str(r[5], "GL", 200), str(r[6], "entity", 20), num(r[7], "amount")] };
  });
  return { closeDate, fileName, rows, monthly, transactions };
}
