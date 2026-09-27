/**
 * THE SHEET SYNC (canon 0.30.162). Owner, 2026-09-21, verbatim: "on that topic,
 * can we setup a cron job or something to regularly check the sheet?  It's not
 * going anywhere."
 *
 * His picks: the worker pulls the sheet on its own cron, every hour, a row that
 * reads like a season total is taken as typed. Microsoft Graph with client
 * credentials on the grip env (MS_TENANT_ID and MS_CLIENT_ID are vars, the
 * secret is a wrangler secret and never enters a file). The default env has no
 * MS_* var; there the sync reads SHEET_FIXTURE_URL when that var is set, and
 * records "no source configured" otherwise. A fixture URL is never read when
 * MS_TENANT_ID is set.
 *
 * The Labor tab (header row 3; C a date serial, D the farm, I the hours; the
 * cached value rules) lands in harvest_labor_hours up to the farm's today. A
 * blank never clears a console number. Each run is one row in sheet_sync_runs.
 */

import { nowIso } from "./audit";
import {
  ADMIN_SHEET_SYNC_PATH,
  CONFIG_KEYS,
  HARVEST_BORN,
  HARVEST_STATUS,
  SYSTEM_REASON,
  growLicenseForFarm,
  inheritMarketStrain,
} from "./config";
import { HARVEST_FILE_SEQ_SQL, insertLog, logsForInsert } from "./db";
import { farmToday } from "./effective";
import { dayAfter, dayBefore, FARM_TIME_ZONE } from "./farmday";
import { t, type Locale } from "./i18n";
import { formatLotToken, hbnFromMetrcName, parseHbn } from "./mint";
import { esc } from "./ui";
import { writeStoreZip } from "./xlsx";

declare global {
  interface Env {
    MS_TENANT_ID?: string;
    MS_CLIENT_ID?: string;
    MS_CLIENT_SECRET?: string;
    SHEET_FIXTURE_URL?: string;
  }
}

export type SheetSyncTrigger = "cron" | "admin" | "upload";
export type SheetSyncStatus = "ok" | "skipped" | "failed";

export type SheetSyncEnv = {
  DB: D1Database;
  MS_TENANT_ID?: string;
  MS_CLIENT_ID?: string;
  MS_CLIENT_SECRET?: string;
  SHEET_FIXTURE_URL?: string;
};

/** A parsed Labor data row (row 4 on). `raw` is the cell text before interpretation. */
export type LaborRow = {
  date: string | null;
  farm: string | null;
  hours: number | null;
  raw: { row: number; date: string | null; farm: string | null; hours: string | null };
};

export type LandCounts = {
  rows_seen: number;
  rows_landed: number;
  rows_changed: number;
  rows_skipped: number;
};

export type SheetSyncView = {
  status: SheetSyncStatus;
  at: string;
  rowsSeen: number | null;
  rowsChanged: number | null;
  message: string | null;
};

export type SheetSyncRunRow = {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: SheetSyncStatus;
  trigger: SheetSyncTrigger;
  workbook_modified_at: string | null;
  workbook_ctag: string | null;
  rows_seen: number | null;
  rows_landed: number | null;
  rows_changed: number | null;
  rows_skipped: number | null;
  harvest_rows_seen?: number | null;
  harvest_rows_landed?: number | null;
  harvest_rows_changed?: number | null;
  harvest_rows_skipped?: number | null;
  message: string | null;
  source?: string | null;
};

const SHEET_FARMS = new Set(["ARL", "PNN", "PNS"]);
const HEADER = { C: "DATE", D: "HARV FARM", I: "CUT/BCK # HRS" } as const;
const KEEP_RUNS = 500;
const GRAPH = "https://graph.microsoft.com/v1.0";
const SCOPE = "https://graph.microsoft.com/.default";

/** The smoke fixture's file name. Synthetic rows only; never the owner's workbook. */
export const FIXTURE_NAME = "smoke-labor.xlsx";
export const FIXTURE_YESTERDAY_HOURS = { ARL: 12.5, PNN: 8.25, PNS: 4 } as const;
export const FIXTURE_TYPED_HOURS = 2753;

export function fixtureCtag(today: string): string {
  return `fixture-labor-${today}`;
}

/* -------------------------------------------------------------- excel dates */

/** The 1900 system: 1899-12-30 plus the integer part. date1904 is absent. */
export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const days = Math.floor(serial);
  if (days < 1 || days > 200000) return null;
  return new Date(Date.UTC(1899, 11, 30) + days * 86_400_000).toISOString().slice(0, 10);
}

export function isoToExcelSerial(iso: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const ms = Date.parse(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.round((ms - Date.UTC(1899, 11, 30)) / 86_400_000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ----------------------------------------------------------------- the zip */

const SIG_EOCD = 0x06054b50;
const SIG_CD = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

function u16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

function findEocd(bytes: Uint8Array): number {
  const start = bytes.length - 22;
  const earliest = Math.max(0, bytes.length - (22 + 65535));
  for (let i = start; i >= earliest; i--) {
    if (u32(bytes, i) !== SIG_EOCD) continue;
    const commentLen = u16(bytes, i + 20);
    if (i + 22 + commentLen === bytes.length) return i;
  }
  throw new Error("workbook zip has no end of central directory");
}

function centralDirectory(bytes: Uint8Array): ZipEntry[] {
  const eocd = findEocd(bytes);
  const count = u16(bytes, eocd + 10);
  let p = u32(bytes, eocd + 16);
  const dec = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (p + 46 > bytes.length || u32(bytes, p) !== SIG_CD) throw new Error("workbook zip central directory is broken");
    const method = u16(bytes, p + 10);
    const compressedSize = u32(bytes, p + 20);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const localOffset = u32(bytes, p + 42);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen)).replaceAll("\\", "/");
    entries.push({ name, method, compressedSize, localOffset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("deflate-raw");
  // Pull while writing. A large entry otherwise fills the buffer and write waits forever.
  const output = new Response(stream.readable).arrayBuffer();
  const writer = stream.writable.getWriter();
  await writer.write(data);
  await writer.close();
  return new Uint8Array(await output);
}

/** Read one zip entry through its local header. Method 0 is stored; method 8 is deflate-raw. */
export async function readZipEntryByName(bytes: Uint8Array, name: string): Promise<Uint8Array> {
  const want = name.replaceAll("\\", "/");
  const entry = centralDirectory(bytes).find((e) => e.name === want);
  if (!entry) throw new Error(`workbook zip is missing ${want}`);
  const p = entry.localOffset;
  if (p + 30 > bytes.length || u32(bytes, p) !== SIG_LOCAL) throw new Error(`workbook zip local header missing for ${want}`);
  const method = u16(bytes, p + 8);
  const localSize = u32(bytes, p + 18);
  const nameLen = u16(bytes, p + 26);
  const extraLen = u16(bytes, p + 28);
  const dataStart = p + 30 + nameLen + extraLen;
  const size = localSize || entry.compressedSize;
  if (dataStart + size > bytes.length) throw new Error(`workbook zip entry ${want} runs past the end`);
  const data = bytes.subarray(dataStart, dataStart + size);
  if (method === 0) return new Uint8Array(data);
  if (method === 8) return inflateRaw(data);
  throw new Error(`workbook zip method ${method} is not supported for ${want}`);
}

async function zipText(bytes: Uint8Array, name: string): Promise<string | null> {
  try {
    return new TextDecoder().decode(await readZipEntryByName(bytes, name));
  } catch (err) {
    if (err instanceof Error && err.message.includes("is missing")) return null;
    throw err;
  }
}

/* --------------------------------------------------------------- the sheet */

function xmlUnesc(s: string): string {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const si = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = si.exec(xml))) {
    const texts = [...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((hit) => xmlUnesc(hit[1]));
    out.push(texts.join(""));
  }
  return out;
}

/** A worksheet Target, absolute (`/xl/...`) or relative to `xl/`. */
export function joinSheetTarget(target: string): string {
  const cleaned = xmlUnesc(target).replaceAll("\\", "/");
  const parts = cleaned.startsWith("/") ? cleaned.split("/") : ["xl", ...cleaned.split("/")];
  const stack: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") stack.pop();
    else stack.push(part);
  }
  return stack.join("/");
}

/** The Labor sheet part, resolved by name on every run. */
export function laborSheetPath(workbookXml: string, relsXml: string, tabName: string): string {
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => {
    const attrs = m[1];
    const name = /(?:^|\s)name="([^"]*)"/.exec(attrs)?.[1];
    const rid = /r:id="([^"]*)"/.exec(attrs)?.[1];
    return name && rid ? { name: xmlUnesc(name), rid } : null;
  });
  const sheet = sheets.find((s) => s && s.name === tabName);
  if (!sheet) throw new Error(`Labor tab "${tabName}" is not in the workbook`);
  const rel = [...relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)].find((m) => /Id="([^"]*)"/.exec(m[1])?.[1] === sheet.rid);
  const target = rel ? /Target="([^"]*)"/.exec(rel[1])?.[1] : null;
  if (!target) throw new Error(`Labor tab relationship ${sheet.rid} is missing`);
  return joinSheetTarget(target);
}

type RawCell = { col: string; row: number; t: string | null; v: string | null; inline: string | null };

function parseCells(xml: string): RawCell[] {
  const cells: RawCell[] = [];
  const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const ref = /\br="([A-Z]+)(\d+)"/.exec(attrs);
    if (!ref) continue;
    const inner = m[2] ?? "";
    const stripped = inner.replace(/<f\b[^>]*\/>/g, "").replace(/<f\b[^>]*>[\s\S]*?<\/f>/g, "");
    const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(stripped);
    const inline = [...stripped.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((hit) => xmlUnesc(hit[1])).join("");
    cells.push({
      col: ref[1],
      row: Number(ref[2]),
      t: /\bt="([^"]*)"/.exec(attrs)?.[1] ?? null,
      v: v ? xmlUnesc(v[1]) : null,
      inline: inline === "" ? null : inline,
    });
  }
  return cells;
}

function sharedAt(shared: string[], indexText: string | null): string | null {
  if (indexText == null) return null;
  const index = Number(indexText);
  if (!Number.isInteger(index) || index < 0 || index >= shared.length) return null;
  return shared[index];
}

function headerText(cell: RawCell | undefined, shared: string[]): string {
  if (!cell) return "blank";
  const text = cell.t === "s" ? sharedAt(shared, cell.v) : cell.t === "inlineStr" ? cell.inline : cell.v;
  const trimmed = (text ?? "").trim();
  return trimmed === "" ? "blank" : trimmed;
}

function dateOf(cell: RawCell | undefined): { iso: string | null; raw: string | null } {
  if (!cell || cell.v == null || cell.t === "s" || cell.t === "inlineStr" || cell.t === "str") return { iso: null, raw: cell?.v ?? null };
  const n = Number(cell.v);
  if (!Number.isFinite(n)) return { iso: null, raw: cell.v };
  return { iso: excelSerialToIso(n), raw: cell.v };
}

function farmOfCell(cell: RawCell | undefined, shared: string[]): { farm: string | null; raw: string | null } {
  if (!cell) return { farm: null, raw: null };
  let text: string | null = null;
  if (cell.t === "s") text = sharedAt(shared, cell.v);
  else if (cell.t === "inlineStr") text = cell.inline;
  else if (cell.t === "str" || cell.t == null) text = cell.v;
  const raw = text;
  const farm = (text ?? "").trim().toUpperCase();
  return { farm: farm === "" ? null : farm, raw };
}

function hoursOf(cell: RawCell | undefined): { hours: number | null; raw: string | null } {
  if (!cell || cell.v == null || cell.t === "s" || cell.t === "inlineStr" || cell.t === "str") return { hours: null, raw: cell?.v ?? null };
  const n = Number(cell.v);
  if (!Number.isFinite(n)) return { hours: null, raw: cell.v };
  return { hours: n, raw: cell.v };
}

/**
 * Labor rows from row 4. Throws in words when C, D, or I on row 3 is not
 * DATE, HARV FARM, CUT/BCK # HRS. A cell with no cached `<v>` is blank; `<f>` is ignored.
 */
export function parseLaborRows(sheetXml: string, sharedStrings: string[]): LaborRow[] {
  const cells = parseCells(sheetXml);
  const at = (col: string, row: number) => cells.find((c) => c.col === col && c.row === row);
  const c = headerText(at("C", 3), sharedStrings);
  const d = headerText(at("D", 3), sharedStrings);
  const i = headerText(at("I", 3), sharedStrings);
  if (c !== HEADER.C || d !== HEADER.D || i !== HEADER.I) {
    throw new Error(
      `Labor header moved: column C reads "${c}", expected ${HEADER.C}; column D reads "${d}", expected ${HEADER.D}; column I reads "${i}", expected ${HEADER.I}`
    );
  }
  const rows = [...new Set(cells.filter((cell) => cell.row >= 4).map((cell) => cell.row))].sort((a, b) => a - b);
  return rows.map((row) => {
    const date = dateOf(at("C", row));
    const farm = farmOfCell(at("D", row), sharedStrings);
    const hours = hoursOf(at("I", row));
    return {
      date: date.iso,
      farm: farm.farm,
      hours: hours.hours,
      raw: { row, date: date.raw, farm: farm.raw, hours: hours.raw },
    };
  });
}

export async function parseLaborWorkbook(bytes: Uint8Array, tabName: string): Promise<LaborRow[]> {
  const workbook = await zipText(bytes, "xl/workbook.xml");
  const rels = await zipText(bytes, "xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("workbook is missing xl/workbook.xml or its relationships");
  const sharedXml = await zipText(bytes, "xl/sharedStrings.xml");
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
  const part = laborSheetPath(workbook, rels, tabName);
  const sheet = await zipText(bytes, part);
  if (!sheet) throw new Error(`Labor sheet part ${part} is missing from the workbook`);
  return parseLaborRows(sheet, shared);
}

/* --------------------------------------------------------------- the landing */

export async function planHourWrites(
  db: D1Database,
  rows: LaborRow[],
  now: string
): Promise<{ counts: LandCounts; stmts: D1PreparedStatement[] }> {
  const today = await farmToday(db, now);
  const existing = await db
    .prepare(`SELECT id, farm_code, work_date, hours FROM harvest_labor_hours`)
    .all<{ id: string; farm_code: string; work_date: string; hours: number }>();
  const have = new Map<string, { id: string; hours: number }>();
  for (const row of existing.results ?? []) {
    have.set(`${row.farm_code}|${row.work_date}`, { id: row.id, hours: round2(Number(row.hours)) });
  }
  const stmts: D1PreparedStatement[] = [];
  let landed = 0;
  let changed = 0;
  let skipped = 0;
  for (const row of rows) {
    const farm = row.farm?.trim().toUpperCase() || null;
    const hours = row.hours == null || !Number.isFinite(row.hours) ? null : round2(row.hours);
    if (!row.date || !farm || !SHEET_FARMS.has(farm) || hours == null || row.date > today) {
      skipped++;
      continue;
    }
    const key = `${farm}|${row.date}`;
    const prev = have.get(key);
    if (!prev) {
      const id = crypto.randomUUID();
      stmts.push(
        db
          .prepare(
            `INSERT INTO harvest_labor_hours (id, farm_code, work_date, hours, created_at, created_by, updated_at, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(id, farm, row.date, hours, now, null, now, null),
        insertLog(db, {
          record_table: "harvest_labor_hours",
          record_id: id,
          field: "hours",
          old_value: null,
          new_value: String(hours),
          actor_person_id: null,
          reason: SYSTEM_REASON.sheet_sync,
          changed_at: now,
        })
      );
      have.set(key, { id, hours });
      landed++;
    } else if (prev.hours !== hours) {
      const old = String(prev.hours);
      stmts.push(
        db.prepare(`UPDATE harvest_labor_hours SET hours = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(hours, now, null, prev.id),
        insertLog(db, {
          record_table: "harvest_labor_hours",
          record_id: prev.id,
          field: "hours",
          old_value: old,
          new_value: String(hours),
          actor_person_id: null,
          reason: SYSTEM_REASON.sheet_sync,
          changed_at: now,
        })
      );
      prev.hours = hours;
      changed++;
    }
  }
  return {
    counts: { rows_seen: rows.length, rows_landed: landed, rows_changed: changed, rows_skipped: skipped },
    stmts,
  };
}

/** Land the parsed rows. One batch. A blank never deletes. */
export async function landHours(db: D1Database, rows: LaborRow[], now: string): Promise<LandCounts> {
  const plan = await planHourWrites(db, rows, now);
  if (plan.stmts.length) await db.batch(plan.stmts);
  return plan.counts;
}

/* ------------------------------------------------- the Harvest Details tab */

/** The smoke's synthetic disagreement: METRC's text for serial 80, not the sheet's. */
export const FIXTURE_ALIAS_METRC = "45999-PNN-ID-027-1-NA-26080";
export const FIXTURE_KNOWN_HBN = "26244-ARL-GH-027-0-NA-26010";
export const FIXTURE_MARKET = "Smoke Cream";
export const FIXTURE_SKIP_STRAIN = "No Such Herb";
export const FIXTURE_ALIAS_TAG = "1A4050300000000000000E80";

export function fixtureAliasSheetHbn(): string {
  return `${isoToExcelSerial("2026-08-24")}-PNN-ID-027-0-NA-26080`;
}

export function fixtureAgreeHbn(): string {
  return `${isoToExcelSerial("2026-08-25")}-PNN-GH-001-0-NA-26081`;
}

export function fixtureSkipHbn(): string {
  return `${isoToExcelSerial("2026-08-26")}-PNN-OD-078-0-NA-26082`;
}

const HARVEST_FIELDS: Array<{ label: string; key: string }> = [
  { label: "Date", key: "date" },
  { label: "METRC Harvest Tag", key: "tag" },
  { label: "Harvest Batch Name", key: "name" },
  { label: "Farm", key: "farm" },
  { label: "Grow Method", key: "grow" },
  { label: "Strain", key: "strain" },
  { label: "Market Strain", key: "market" },
  { label: "Manicure?", key: "manicure" },
  { label: "Cuts", key: "cuts" },
  { label: "Plants", key: "plants" },
  { label: "Wet Spear Weight (grams)", key: "wet" },
  { label: "Bucked Wet Weight (grams)", key: "bucked" },
  { label: "Seq.", key: "seq" },
  { label: "Seq. Date", key: "seqDate" },
  { label: "Silo #", key: "silo" },
  { label: "Dry Weight (grams)", key: "dry" },
  { label: "Dry Down", key: "dryDown" },
  { label: "Moisture", key: "moisture" },
  { label: "Water Activity", key: "water" },
  { label: "# of containers", key: "containers" },
  { label: "Total Bud Wt", key: "bud" },
  { label: "Total Other Weight", key: "otherWeight" },
  { label: "BTR", key: "btr" },
  { label: "Packaging Waste", key: "waste" },
  { label: "AVG Bud THC", key: "budThc" },
  { label: "AVG Bio THC", key: "bioThc" },
  { label: "AVG Shake THC", key: "shakeThc" },
  { label: "Untested Bud on Hand", key: "untested" },
  { label: "Tested Bud On Hand", key: "tested" },
  { label: "Trim On Hand", key: "trim" },
  { label: "Other On Hand", key: "other" },
];

export type HarvestSheetRow = {
  sheet_hbn: string;
  metrc_harvest_tag: string;
  row_no: number;
  sheet_date: string | null;
  farm_code: string | null;
  grow_method: string | null;
  strain_name: string | null;
  market_strain: string | null;
  manicure: number | null;
  cuts: number | null;
  plants: number | null;
  wet_spear_g: number | null;
  bucked_wet_g: number | null;
  seq: number | null;
  seq_date: string | null;
  silo: string | null;
  dry_weight_g: number | null;
  dry_down: number | null;
  moisture: number | null;
  water_activity: number | null;
  containers: number | null;
  total_bud_g: number | null;
  total_other_g: number | null;
  btr: number | null;
  packaging_waste: number | null;
  avg_bud_thc: number | null;
  avg_bio_thc: number | null;
  avg_shake_thc: number | null;
  untested_bud_g: number | null;
  tested_bud_g: number | null;
  trim_g: number | null;
  other_g: number | null;
};

export type HarvestParse = { rows: HarvestSheetRow[]; skipped: number; missing: string[] };

function headerNorm(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function textOfCell(cell: RawCell | undefined, shared: string[]): string | null {
  if (!cell) return null;
  let text: string | null = null;
  if (cell.t === "s") text = sharedAt(shared, cell.v);
  else if (cell.t === "inlineStr") text = cell.inline;
  else if (cell.t === "str" || cell.t == null || cell.t === "n") text = cell.v;
  else return null;
  const trimmed = (text ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function numberOfCell(cell: RawCell | undefined): number | null {
  if (!cell || cell.v == null) return null;
  if (cell.t === "s" || cell.t === "inlineStr" || cell.t === "str" || cell.t === "e") return null;
  const n = Number(cell.v);
  return Number.isFinite(n) ? n : null;
}

function dateOfCell(cell: RawCell | undefined): string | null {
  const n = numberOfCell(cell);
  return n == null ? null : excelSerialToIso(n);
}

function manicureOf(text: string | null): number | null {
  const word = (text ?? "").trim().toLowerCase();
  if (word === "yes") return 1;
  if (word === "no") return 0;
  return null;
}

function lotOfName(hbn: string): { year: number; serial: number } | null {
  const parts = parseHbn(hbn);
  if (!parts) return null;
  const lot = /^(\d{2})(\d{3,})$/.exec(parts.serial);
  if (!lot || Number(lot[2]) < 1) return null;
  return { year: 2000 + Number(lot[1]), serial: Number(lot[2]) };
}

/** Harvest Details rows. Header row 4 by text. Data from row 7 through the last readable name. */
export function parseHarvestSheet(sheetXml: string, sharedStrings: string[]): HarvestParse {
  const cells = parseCells(sheetXml);
  const at = (col: string, row: number) => cells.find((c) => c.col === col && c.row === row);
  const cols = new Map<string, string>();
  for (const cell of cells) {
    if (cell.row !== 4) continue;
    const text = headerNorm(headerText(cell, sharedStrings) === "blank" ? "" : headerText(cell, sharedStrings));
    if (text && !cols.has(text)) cols.set(text, cell.col);
  }
  const missing: string[] = [];
  const colOf = new Map<string, string>();
  for (const field of HARVEST_FIELDS) {
    const col = cols.get(headerNorm(field.label));
    if (!col) missing.push(field.label);
    else colOf.set(field.key, col);
  }
  const nameCol = colOf.get("name");
  const bodyRows = [...new Set(cells.filter((cell) => cell.row >= 7).map((cell) => cell.row))].sort((a, b) => a - b);
  const readable = (row: number) => {
    if (!nameCol) return null;
    const text = textOfCell(at(nameCol, row), sharedStrings);
    if (!text) return null;
    const hbn = text.toUpperCase();
    return lotOfName(hbn) ? hbn : null;
  };
  let last = 0;
  for (const row of bodyRows) if (readable(row)) last = row;
  const considered = bodyRows.filter((row) => row <= last);
  if (!nameCol || last === 0) return { rows: [], skipped: considered.length, missing };
  const rows: HarvestSheetRow[] = [];
  let skipped = 0;
  const takeText = (key: string, row: number) => textOfCell(at(colOf.get(key) ?? "", row), sharedStrings);
  const takeNum = (key: string, row: number) => numberOfCell(at(colOf.get(key) ?? "", row));
  const takeDate = (key: string, row: number) => dateOfCell(at(colOf.get(key) ?? "", row));
  for (const row of considered) {
    const hbn = readable(row);
    if (!hbn) {
      skipped++;
      continue;
    }
    const tag = (takeText("tag", row) ?? "").toUpperCase();
    rows.push({
      sheet_hbn: hbn,
      metrc_harvest_tag: tag,
      row_no: row,
      sheet_date: takeDate("date", row),
      farm_code: takeText("farm", row)?.toUpperCase() ?? null,
      grow_method: takeText("grow", row),
      strain_name: takeText("strain", row),
      market_strain: takeText("market", row),
      manicure: manicureOf(takeText("manicure", row)),
      cuts: takeNum("cuts", row),
      plants: takeNum("plants", row),
      wet_spear_g: takeNum("wet", row),
      bucked_wet_g: takeNum("bucked", row),
      seq: takeNum("seq", row),
      seq_date: takeDate("seqDate", row),
      silo: takeText("silo", row),
      dry_weight_g: takeNum("dry", row),
      dry_down: takeNum("dryDown", row),
      moisture: takeNum("moisture", row),
      water_activity: takeNum("water", row),
      containers: takeNum("containers", row),
      total_bud_g: takeNum("bud", row),
      total_other_g: takeNum("otherWeight", row),
      btr: takeNum("btr", row),
      packaging_waste: takeNum("waste", row),
      avg_bud_thc: takeNum("budThc", row),
      avg_bio_thc: takeNum("bioThc", row),
      avg_shake_thc: takeNum("shakeThc", row),
      untested_bud_g: takeNum("untested", row),
      tested_bud_g: takeNum("tested", row),
      trim_g: takeNum("trim", row),
      other_g: takeNum("other", row),
    });
  }
  return { rows, skipped, missing };
}

function harvestSheetPath(workbookXml: string, relsXml: string, tabName: string): string {
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => {
    const attrs = m[1];
    const name = /(?:^|\s)name="([^"]*)"/.exec(attrs)?.[1];
    const rid = /r:id="([^"]*)"/.exec(attrs)?.[1];
    return name && rid ? { name: xmlUnesc(name), rid } : null;
  });
  const sheet = sheets.find((s) => s && s.name === tabName);
  if (!sheet) throw new Error(`Harvest Details tab "${tabName}" is not in the workbook`);
  const rel = [...relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)].find((m) => /Id="([^"]*)"/.exec(m[1])?.[1] === sheet.rid);
  const target = rel ? /Target="([^"]*)"/.exec(rel[1])?.[1] : null;
  if (!target) throw new Error(`Harvest Details tab relationship ${sheet.rid} is missing`);
  return joinSheetTarget(target);
}

export async function parseHarvestWorkbook(bytes: Uint8Array, tabName: string): Promise<HarvestParse> {
  const workbook = await zipText(bytes, "xl/workbook.xml");
  const rels = await zipText(bytes, "xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) throw new Error("workbook is missing xl/workbook.xml or its relationships");
  const sharedXml = await zipText(bytes, "xl/sharedStrings.xml");
  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
  const part = harvestSheetPath(workbook, rels, tabName);
  const sheet = await zipText(bytes, part);
  if (!sheet) throw new Error(`Harvest Details sheet part ${part} is missing from the workbook`);
  return parseHarvestSheet(sheet, shared);
}

type AppBatch = {
  id: string;
  hbn: string;
  entry_date: string;
  farm_code: string;
  grow_method_code: string;
  strain_id: string;
  strain_name: string;
  market_strain: string | null;
  manicure: number;
  metrc_harvest_tag: string | null;
  harvest_year: number;
  lot_serial: number;
  born_from: string;
  deleted_at: string | null;
};

type StoredSheetRow = HarvestSheetRow & { harvest_batch_id: string | null };

const SHEET_NUM_KEYS: Array<keyof HarvestSheetRow> = [
  "cuts", "plants", "wet_spear_g", "bucked_wet_g", "seq", "dry_weight_g", "dry_down", "moisture", "water_activity",
  "containers", "total_bud_g", "total_other_g", "btr", "packaging_waste", "avg_bud_thc", "avg_bio_thc", "avg_shake_thc",
  "untested_bud_g", "tested_bud_g", "trim_g", "other_g",
];

function sameNum(stored: unknown, next: number | null): boolean {
  if (stored == null || stored === "") return next == null;
  if (next == null) return false;
  return Number(stored) === next;
}

function sameText(stored: unknown, next: string | null): boolean {
  const left = stored == null || stored === "" ? null : String(stored);
  const right = next == null || next === "" ? null : next;
  return left === right;
}

function sheetSame(stored: StoredSheetRow, row: HarvestSheetRow, batchId: string | null): boolean {
  if (stored.row_no !== row.row_no) return false;
  if (!sameText(stored.sheet_date, row.sheet_date)) return false;
  if (!sameText(stored.farm_code, row.farm_code)) return false;
  if (!sameText(stored.grow_method, row.grow_method)) return false;
  if (!sameText(stored.strain_name, row.strain_name)) return false;
  if (!sameText(stored.market_strain, row.market_strain)) return false;
  if (!sameNum(stored.manicure, row.manicure)) return false;
  if (!sameText(stored.seq_date, row.seq_date)) return false;
  if (!sameText(stored.silo, row.silo)) return false;
  if ((stored.harvest_batch_id ?? null) !== batchId) return false;
  return SHEET_NUM_KEYS.every((key) => sameNum(stored[key], row[key] as number | null));
}

function note(parts: string[], line: string): void {
  parts.push(line);
}

function fillLine(template: string, vars: Record<string, string>): string {
  let text = template;
  for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, value);
  return text;
}

/** Run messages are stored in English and spoken in the page's language. */
export function translateSheetMessage(message: string, locale: Locale): string {
  const rules: Array<{ re: RegExp; key: string; names: string[] }> = [
    { re: /^Missing Harvest Details header: (.+)$/, key: "Missing Harvest Details header: {header}", names: ["header"] },
    { re: /^(\S+) follows METRC (\S+)$/, key: "{sheet} follows METRC {metrc}", names: ["sheet", "metrc"] },
    { re: /^(\S+) skipped: no live strain named (.+)$/, key: "{hbn} skipped: no live strain named {strain}", names: ["hbn", "strain"] },
    { re: /^(\S+) skipped: the year (\d+) is not the date's year (\d+)$/, key: "{hbn} skipped: the year {year} is not the date's year {dateYear}", names: ["hbn", "year", "dateYear"] },
    { re: /^(\S+) skipped: farm (.+) is unknown$/, key: "{hbn} skipped: farm {farm} is unknown", names: ["hbn", "farm"] },
    { re: /^(\S+) skipped: grow method (.+) is unknown$/, key: "{hbn} skipped: grow method {method} is unknown", names: ["hbn", "method"] },
    { re: /^(\S+) skipped: lot (\S+) already belongs to (.+)$/, key: "{hbn} skipped: lot {lot} already belongs to {other}", names: ["hbn", "lot", "other"] },
    { re: /^(\S+) skipped: METRC names (.+) for lot (\S+)$/, key: "{hbn} skipped: METRC names {names} for lot {lot}", names: ["hbn", "names", "lot"] },
    { re: /^(\S+) was not renamed: pending file (.+)$/, key: "{hbn} was not renamed: pending file {file}", names: ["hbn", "file"] },
    { re: /^(\S+) disagrees on ([^:]+): sheet (.+), app (.+)$/, key: "{hbn} disagrees on {field}: sheet {sheetValue}, app {appValue}", names: ["hbn", "field", "sheetValue", "appValue"] },
    { re: /^(\S+) is not (\S+); the HBN stays$/, key: "{sheet} is not {app}; the HBN stays", names: ["sheet", "app"] },
  ];
  return message
    .split(" | ")
    .map((line) => {
      for (const rule of rules) {
        const hit = rule.re.exec(line);
        if (!hit) continue;
        const vars: Record<string, string> = {};
        rule.names.forEach((name, i) => {
          vars[name] = hit[i + 1] ?? "";
        });
        return fill(locale, rule.key, vars);
      }
      return line;
    })
    .join(" | ");
}

type HarvestPlan = { counts: LandCounts; message: string | null; stmts: D1PreparedStatement[] };

export async function planHarvestWrites(db: D1Database, parsed: HarvestParse, now: string, runId: string): Promise<HarvestPlan> {
  const notes: string[] = [];
  for (const header of parsed.missing) notes.push(fillLine("Missing Harvest Details header: {header}", { header }));
  if (parsed.rows.length === 0) {
    return {
      counts: { rows_seen: parsed.skipped, rows_landed: 0, rows_changed: 0, rows_skipped: parsed.skipped },
      message: notes.length ? notes.join(" | ").slice(0, 2000) : null,
      stmts: [],
    };
  }
  const [batchRows, strainRows, growRows, farmRows, sheetRows, harvestNames, today] = await Promise.all([
    db.prepare(
      `SELECT b.id, b.hbn, b.entry_date, b.farm_code, b.grow_method_code, b.strain_id,
              s.name AS strain_name, b.market_strain, b.manicure, b.metrc_harvest_tag,
              b.harvest_year, b.lot_serial, b.born_from, b.deleted_at
       FROM harvest_batches b LEFT JOIN strains s ON s.id = b.strain_id`
    ).all<AppBatch>(),
    db.prepare(`SELECT id, name FROM strains WHERE deleted_at IS NULL`).all<{ id: string; name: string }>(),
    db.prepare(`SELECT code, display_name, hbn_code FROM grow_methods WHERE deleted_at IS NULL`).all<{ code: string; display_name: string; hbn_code: string }>(),
    db.prepare(`SELECT code FROM farms WHERE deleted_at IS NULL`).all<{ code: string }>(),
    db.prepare(`SELECT * FROM harvest_sheet_rows`).all<StoredSheetRow>(),
    db.prepare(`SELECT source_harvests FROM metrc_packages WHERE source_harvests IS NOT NULL AND TRIM(source_harvests) <> ''`).all<{ source_harvests: string }>(),
    farmToday(db, now),
  ]);
  const byHbn = new Map<string, AppBatch>();
  const bySerial = new Map<string, AppBatch>();
  for (const batch of batchRows.results ?? []) {
    byHbn.set(batch.hbn.trim().toUpperCase(), batch);
    bySerial.set(`${batch.harvest_year}|${batch.lot_serial}`, batch);
  }
  const strains = strainRows.results ?? [];
  const grows = growRows.results ?? [];
  const farms = new Set((farmRows.results ?? []).map((row) => row.code.toUpperCase()));
  const stored = new Map<string, StoredSheetRow>();
  for (const row of sheetRows.results ?? []) stored.set(`${row.sheet_hbn}|${row.metrc_harvest_tag ?? ""}`, row);
  const metrcBySerial = new Map<string, Set<string>>();
  for (const row of harvestNames.results ?? []) {
    for (const token of String(row.source_harvests).split(/[,;]/)) {
      const reading = hbnFromMetrcName(token, null, today);
      if (!reading.ok) continue;
      const key = `${reading.mint.harvest_year}|${reading.mint.lot_serial}`;
      const set = metrcBySerial.get(key) ?? new Set<string>();
      set.add(reading.mint.hbn);
      metrcBySerial.set(key, set);
    }
  }
  const stmts: D1PreparedStatement[] = [];
  let landed = 0;
  let changed = 0;
  let skipped = parsed.skipped;
  const matchStrain = (word: string | null) => {
    const want = (word ?? "").trim().toLowerCase();
    if (!want) return null;
    const hits = strains.filter((row) => row.name.trim().toLowerCase() === want);
    return hits.length === 1 ? hits[0] : null;
  };
  const matchGrow = (word: string | null, segment: string) => {
    const want = (word ?? "").trim().toLowerCase();
    if (!want) return null;
    const hit = grows.find(
      (row) => row.display_name.trim().toLowerCase() === want || row.hbn_code.trim().toLowerCase() === want || row.code.trim().toLowerCase() === want
    );
    if (!hit || hit.hbn_code.trim().toUpperCase() !== segment.trim().toUpperCase()) return null;
    return hit;
  };
  const matchFarm = (word: string | null, segment: string) => {
    const want = (word ?? "").trim().toUpperCase();
    if (!want || !farms.has(want) || want !== segment.trim().toUpperCase()) return null;
    return want;
  };
  for (const row of parsed.rows) {
    const lot = lotOfName(row.sheet_hbn);
    if (!lot) {
      skipped++;
      continue;
    }
    const serialKey = `${lot.year}|${lot.serial}`;
    const metrcNames = [...(metrcBySerial.get(serialKey) ?? [])];
    const others = metrcNames.filter((name) => name !== row.sheet_hbn);
    if (others.length > 1) {
      skipped++;
      note(notes, fillLine("{hbn} skipped: METRC names {names} for lot {lot}", { hbn: row.sheet_hbn, names: others.join(", "), lot: formatLotToken(lot.year, lot.serial) }));
      continue;
    }
    const winning = others[0] ?? row.sheet_hbn;
    const parts = parseHbn(winning);
    const byName = byHbn.get(row.sheet_hbn) ?? null;
    const byLot = bySerial.get(serialKey) ?? null;
    const byWin = byHbn.get(winning) ?? null;
    const clash = (byName && byLot && byName.id !== byLot.id) || (byWin && byName && byWin.id !== byName.id) || (byWin && byLot && byWin.id !== byLot.id);
    if (clash) {
      skipped++;
      const other = (byWin && byLot && byWin.id !== byLot.id ? byWin : byLot ?? byWin)?.hbn ?? winning;
      note(notes, fillLine("{hbn} skipped: lot {lot} already belongs to {other}", { hbn: row.sheet_hbn, lot: formatLotToken(lot.year, lot.serial), other }));
      continue;
    }
    let batch = byName ?? byLot;
    if (batch?.deleted_at) {
      skipped++;
      note(notes, fillLine("{hbn} skipped: lot {lot} already belongs to {other}", { hbn: row.sheet_hbn, lot: formatLotToken(lot.year, lot.serial), other: batch.hbn }));
      continue;
    }
    if (!batch) {
      if (byWin && byWin.id) {
        skipped++;
        note(notes, fillLine("{hbn} skipped: lot {lot} already belongs to {other}", { hbn: row.sheet_hbn, lot: formatLotToken(lot.year, lot.serial), other: byWin.hbn }));
        continue;
      }
      const strain = matchStrain(row.strain_name);
      if (!strain) {
        skipped++;
        note(notes, fillLine("{hbn} skipped: no live strain named {strain}", { hbn: row.sheet_hbn, strain: row.strain_name ?? "" }));
        continue;
      }
      if (!row.sheet_date || String(lot.year) !== row.sheet_date.slice(0, 4)) {
        skipped++;
        note(notes, fillLine("{hbn} skipped: the year {year} is not the date's year {dateYear}", { hbn: row.sheet_hbn, year: String(lot.year), dateYear: row.sheet_date?.slice(0, 4) ?? "" }));
        continue;
      }
      const farm = matchFarm(row.farm_code, parts?.farm ?? "");
      if (!farm) {
        skipped++;
        note(notes, fillLine("{hbn} skipped: farm {farm} is unknown", { hbn: row.sheet_hbn, farm: row.farm_code ?? "" }));
        continue;
      }
      const grow = matchGrow(row.grow_method, parts?.grow_code ?? "");
      if (!grow) {
        skipped++;
        note(notes, fillLine("{hbn} skipped: grow method {method} is unknown", { hbn: row.sheet_hbn, method: row.grow_method ?? "" }));
        continue;
      }
      const id = crypto.randomUUID();
      const tag = row.metrc_harvest_tag || null;
      const record = {
        id,
        entry_date: row.sheet_date,
        farm_code: farm,
        grow_method_code: grow.code,
        strain_id: strain.id,
        market_strain: inheritMarketStrain(row.market_strain, strain.name),
        manicure: row.manicure ?? 0,
        planned_dryspc: parts?.silo ?? null,
        metrc_harvest_tag: tag,
        hbn: winning,
        lot_serial: lot.serial,
        harvest_year: lot.year,
        status: HARVEST_STATUS.open,
        license_value: growLicenseForFarm(farm),
        born_from: HARVEST_BORN.sheet,
        created_at: now,
        created_by: null,
        updated_at: now,
        updated_by: null,
      };
      stmts.push(
        db.prepare(
          `INSERT INTO harvest_batches (
            id, entry_date, farm_code, grow_method_code, strain_id, market_strain, manicure, planned_dryspc,
            start_time, zone, rows_text, metrc_harvest_tag, hbn, lot_serial, harvest_year, status, license_value, born_from,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        ).bind(
          id, record.entry_date, record.farm_code, record.grow_method_code, record.strain_id, record.market_strain,
          record.manicure, record.planned_dryspc, record.metrc_harvest_tag, record.hbn, record.lot_serial, record.harvest_year,
          record.status, record.license_value, record.born_from, now, null, now, null
        ),
        ...logsForInsert(db, "harvest_batches", id, record, null, SYSTEM_REASON.harvest_details, now)
      );
      batch = {
        id,
        hbn: winning,
        entry_date: row.sheet_date,
        farm_code: farm,
        grow_method_code: grow.code,
        strain_id: strain.id,
        strain_name: strain.name,
        market_strain: record.market_strain,
        manicure: record.manicure,
        metrc_harvest_tag: tag,
        harvest_year: lot.year,
        lot_serial: lot.serial,
        born_from: HARVEST_BORN.sheet,
        deleted_at: null,
      };
      byHbn.set(winning, batch);
      bySerial.set(serialKey, batch);
      if (winning !== row.sheet_hbn) note(notes, fillLine("{sheet} follows METRC {metrc}", { sheet: row.sheet_hbn, metrc: winning }));
    } else {
      const updates: Array<{ field: string; value: string | number | null; old: string | null }> = [];
      const market = (row.market_strain ?? "").trim();
      if (market && market !== (batch.market_strain ?? "").trim()) {
        updates.push({ field: "market_strain", value: market, old: batch.market_strain });
        batch.market_strain = market;
      }
      if (row.manicure != null && row.manicure !== Number(batch.manicure)) {
        updates.push({ field: "manicure", value: row.manicure, old: String(batch.manicure) });
        batch.manicure = row.manicure;
      }
      if (!(batch.metrc_harvest_tag ?? "").trim() && row.metrc_harvest_tag) {
        updates.push({ field: "metrc_harvest_tag", value: row.metrc_harvest_tag, old: null });
        batch.metrc_harvest_tag = row.metrc_harvest_tag;
      }
      if (winning !== batch.hbn.toUpperCase()) {
        const pending = await pendingHarvestFile(db, batch.id, batch.hbn);
        if (pending) {
          note(notes, fillLine("{hbn} was not renamed: pending file {file}", { hbn: batch.hbn, file: pending }));
        } else if (byWin && byWin.id !== batch.id) {
          note(notes, fillLine("{hbn} skipped: lot {lot} already belongs to {other}", { hbn: batch.hbn, lot: formatLotToken(lot.year, lot.serial), other: byWin.hbn }));
        } else {
          const old = batch.hbn;
          stmts.push(
            db.prepare(`UPDATE harvest_batches SET hbn = ?, updated_at = ?, updated_by = NULL WHERE id = ?`).bind(winning, now, batch.id),
            insertLog(db, {
              record_table: "harvest_batches",
              record_id: batch.id,
              field: "hbn",
              old_value: old,
              new_value: winning,
              actor_person_id: null,
              reason: SYSTEM_REASON.hbn_follows_metrc,
              changed_at: now,
            })
          );
          const internal = await db
            .prepare(`SELECT id, hbn FROM internal_test_results WHERE deleted_at IS NULL AND upper(hbn) = ?`)
            .bind(old.toUpperCase())
            .all<{ id: string; hbn: string }>();
          for (const result of internal.results ?? []) {
            stmts.push(
              db.prepare(`UPDATE internal_test_results SET hbn = ?, updated_at = ?, updated_by = NULL WHERE id = ?`).bind(winning, now, result.id),
              insertLog(db, {
                record_table: "internal_test_results",
                record_id: result.id,
                field: "hbn",
                old_value: result.hbn,
                new_value: winning,
                actor_person_id: null,
                reason: SYSTEM_REASON.hbn_follows_metrc,
                changed_at: now,
              })
            );
          }
          byHbn.delete(old.toUpperCase());
          batch.hbn = winning;
          byHbn.set(winning, batch);
          note(notes, fillLine("{sheet} follows METRC {metrc}", { sheet: old, metrc: winning }));
        }
      } else if (row.sheet_hbn !== batch.hbn.toUpperCase()) {
        note(notes, fillLine("{sheet} is not {app}; the HBN stays", { sheet: row.sheet_hbn, app: batch.hbn }));
      }
      if (batch.born_from === HARVEST_BORN.app) {
        if (row.sheet_date && row.sheet_date !== batch.entry_date) {
          note(notes, fillLine("{hbn} disagrees on {field}: sheet {sheetValue}, app {appValue}", { hbn: batch.hbn, field: "entry_date", sheetValue: row.sheet_date, appValue: batch.entry_date }));
        }
        if (row.farm_code && row.farm_code.toUpperCase() !== batch.farm_code.toUpperCase()) {
          note(notes, fillLine("{hbn} disagrees on {field}: sheet {sheetValue}, app {appValue}", { hbn: batch.hbn, field: "farm_code", sheetValue: row.farm_code, appValue: batch.farm_code }));
        }
        const namedGrow = grows.find((item) => {
          const want = (row.grow_method ?? "").trim().toLowerCase();
          return want && (item.display_name.trim().toLowerCase() === want || item.code.trim().toLowerCase() === want || item.hbn_code.trim().toLowerCase() === want);
        });
        if (row.grow_method && (!namedGrow || namedGrow.code !== batch.grow_method_code)) {
          note(notes, fillLine("{hbn} disagrees on {field}: sheet {sheetValue}, app {appValue}", { hbn: batch.hbn, field: "grow_method_code", sheetValue: row.grow_method, appValue: batch.grow_method_code }));
        }
        const namedStrain = matchStrain(row.strain_name);
        if (row.strain_name && (!namedStrain || namedStrain.name.trim().toLowerCase() !== (batch.strain_name ?? "").trim().toLowerCase())) {
          note(notes, fillLine("{hbn} disagrees on {field}: sheet {sheetValue}, app {appValue}", { hbn: batch.hbn, field: "strain", sheetValue: row.strain_name, appValue: batch.strain_name ?? "" }));
        }
      }
      if (updates.length) {
        const sets = updates.map((item) => `${item.field} = ?`).join(", ");
        stmts.push(
          db.prepare(`UPDATE harvest_batches SET ${sets}, updated_at = ?, updated_by = NULL WHERE id = ?`).bind(
            ...updates.map((item) => item.value),
            now,
            batch.id
          ),
          ...updates.map((item) =>
            insertLog(db, {
              record_table: "harvest_batches",
              record_id: batch!.id,
              field: item.field,
              old_value: item.old,
              new_value: item.value == null ? null : String(item.value),
              actor_person_id: null,
              reason: SYSTEM_REASON.harvest_details,
              changed_at: now,
            })
          )
        );
      }
    }
    const batchId = batch?.id ?? null;
    const key = `${row.sheet_hbn}|${row.metrc_harvest_tag}`;
    const prev = stored.get(key);
    if (!prev) {
      stmts.push(sheetInsert(db, row, batchId, now, runId));
      stored.set(key, { ...row, harvest_batch_id: batchId });
      landed++;
    } else if (!sheetSame(prev, row, batchId)) {
      stmts.push(sheetUpdate(db, row, batchId, now, runId));
      stored.set(key, { ...row, harvest_batch_id: batchId });
      changed++;
    }
  }
  return {
    counts: { rows_seen: parsed.rows.length + parsed.skipped, rows_landed: landed, rows_changed: changed, rows_skipped: skipped },
    message: notes.length ? notes.join(" | ").slice(0, 2000) : null,
    stmts,
  };
}

const SHEET_COLS = [
  "sheet_hbn", "metrc_harvest_tag", "row_no", "sheet_date", "farm_code", "grow_method", "strain_name", "market_strain", "manicure",
  "cuts", "plants", "wet_spear_g", "bucked_wet_g", "seq", "seq_date", "silo", "dry_weight_g", "dry_down", "moisture", "water_activity",
  "containers", "total_bud_g", "total_other_g", "btr", "packaging_waste", "avg_bud_thc", "avg_bio_thc", "avg_shake_thc",
  "untested_bud_g", "tested_bud_g", "trim_g", "other_g", "harvest_batch_id", "landed_at", "run_id",
] as const;

function sheetBinds(row: HarvestSheetRow, batchId: string | null, now: string, runId: string): unknown[] {
  return [
    row.sheet_hbn, row.metrc_harvest_tag, row.row_no, row.sheet_date, row.farm_code, row.grow_method, row.strain_name, row.market_strain, row.manicure,
    row.cuts, row.plants, row.wet_spear_g, row.bucked_wet_g, row.seq, row.seq_date, row.silo, row.dry_weight_g, row.dry_down, row.moisture, row.water_activity,
    row.containers, row.total_bud_g, row.total_other_g, row.btr, row.packaging_waste, row.avg_bud_thc, row.avg_bio_thc, row.avg_shake_thc,
    row.untested_bud_g, row.tested_bud_g, row.trim_g, row.other_g, batchId, now, runId,
  ];
}

function sheetInsert(db: D1Database, row: HarvestSheetRow, batchId: string | null, now: string, runId: string): D1PreparedStatement {
  return db
    .prepare(`INSERT INTO harvest_sheet_rows (${SHEET_COLS.join(", ")}) VALUES (${SHEET_COLS.map(() => "?").join(", ")})`)
    .bind(...sheetBinds(row, batchId, now, runId));
}

function sheetUpdate(db: D1Database, row: HarvestSheetRow, batchId: string | null, now: string, runId: string): D1PreparedStatement {
  const sets = SHEET_COLS.filter((col) => col !== "sheet_hbn" && col !== "metrc_harvest_tag").map((col) => `${col} = ?`);
  const binds = sheetBinds(row, batchId, now, runId);
  return db
    .prepare(`UPDATE harvest_sheet_rows SET ${sets.join(", ")} WHERE sheet_hbn = ? AND metrc_harvest_tag = ?`)
    .bind(...binds.slice(2), row.sheet_hbn, row.metrc_harvest_tag);
}

export async function pendingHarvestFile(db: D1Database, batchId: string, hbn: string): Promise<string | null> {
  const wet = await db
    .prepare(
      `SELECT ${HARVEST_FILE_SEQ_SQL} AS seq FROM wet_weight_entries w
       WHERE w.harvest_batch_id = ? AND w.deleted_at IS NULL AND w.status <> 'weighing'
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.harvest_batch_id = w.harvest_batch_id AND u.kind = 'wet_weights' AND u.deleted_at IS NULL
             AND (u.ref_id = w.id OR (u.ref_id IS NULL AND w.created_at < u.uploaded_at))
         )
       ORDER BY ${HARVEST_FILE_SEQ_SQL}, w.created_at, w.id`
    )
    .bind(batchId)
    .all<{ seq: number | null }>();
  const names = (wet.results ?? []).map((row) => `${hbn}(${Number(row.seq)}).csv`);
  if (names.length > 0) return names.join(", ");
  const pkg = await db
    .prepare(
      `SELECT ${HARVEST_FILE_SEQ_SQL} AS seq FROM unload_sessions s
       JOIN wet_weight_entries w ON w.id = s.wet_weight_entry_id AND w.deleted_at IS NULL
       WHERE w.harvest_batch_id = ? AND s.deleted_at IS NULL AND s.finished_at IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = s.id AND u.deleted_at IS NULL AND u.kind IN ('package_from_harvest', 'package_adjust')
         )
       ORDER BY s.finished_at
       LIMIT 1`
    )
    .bind(batchId)
    .first<{ seq: number | null }>();
  if (pkg) return `packages_from_harvests_${hbn}(${Number(pkg.seq)}).csv`;
  return null;
}

/* ----------------------------------------------------------------- the run */

type Meta = { name: string | null; cTag: string | null; webUrl: string | null; modifiedAt: string | null };

export function sheetSourceKind(env: SheetSyncEnv): "graph" | "fixture" | "none" {
  if ((env.MS_TENANT_ID ?? "").trim() !== "") return "graph";
  if ((env.SHEET_FIXTURE_URL ?? "").trim() !== "") return "fixture";
  return "none";
}

/** Status and a short body. Never the request URL (a content redirect carries a temporary token). */
export function scrubSecrets(text: string, secret?: string): string {
  let out = text;
  if (secret && secret.length > 0) out = out.split(secret).join("[redacted]");
  out = out.replace(/access_token["']?\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]+/gi, "access_token=[redacted]");
  out = out.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
  return out.slice(0, 400);
}

async function failResponse(res: Response, what: string, secret?: string): Promise<never> {
  const body = (await res.text()).slice(0, 240);
  throw new Error(scrubSecrets(`${what} ${res.status}: ${body}`, secret));
}

async function graphToken(env: SheetSyncEnv): Promise<string> {
  const tenant = (env.MS_TENANT_ID ?? "").trim();
  const clientId = (env.MS_CLIENT_ID ?? "").trim();
  const secret = env.MS_CLIENT_SECRET ?? "";
  if (!clientId) throw new Error("MS_CLIENT_ID is not set");
  if (!secret) throw new Error("MS_CLIENT_SECRET is not set");
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: secret,
    scope: SCOPE,
  });
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) await failResponse(res, "token", secret);
  const payload = (await res.json()) as { access_token?: string };
  if (!payload.access_token) throw new Error("token response had no access_token");
  return payload.access_token;
}

async function configValue(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`)
    .bind(key)
    .first<{ value: string }>();
  const value = row?.value?.trim() ?? "";
  return value === "" ? null : value;
}

async function graphMeta(env: SheetSyncEnv, token: string): Promise<Meta> {
  const drive = await configValue(env.DB, CONFIG_KEYS.sheet_drive_id);
  const item = await configValue(env.DB, CONFIG_KEYS.sheet_item_id);
  if (!drive) throw new Error("sheet_drive_id is not set");
  if (!item) throw new Error("sheet_item_id is not set");
  const url = `${GRAPH}/drives/${encodeURIComponent(drive)}/items/${encodeURIComponent(item)}?select=id,name,cTag,eTag,lastModifiedDateTime,size,webUrl`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) await failResponse(res, "Graph", env.MS_CLIENT_SECRET);
  const payload = (await res.json()) as { name?: string; cTag?: string; webUrl?: string; lastModifiedDateTime?: string };
  return {
    name: payload.name ?? null,
    cTag: payload.cTag || null,
    webUrl: payload.webUrl ?? null,
    modifiedAt: payload.lastModifiedDateTime ?? null,
  };
}

async function graphBytes(env: SheetSyncEnv, token: string): Promise<Uint8Array> {
  const drive = await configValue(env.DB, CONFIG_KEYS.sheet_drive_id);
  const item = await configValue(env.DB, CONFIG_KEYS.sheet_item_id);
  if (!drive || !item) throw new Error("sheet_drive_id is not set");
  return readGraphItem(env, drive, item, token);
}

/** The same Graph content read the Labor tab uses, for any drive item. */
export async function readGraphItem(env: SheetSyncEnv, driveId: string, itemId: string, token?: string): Promise<Uint8Array> {
  const bearer = token ?? (await graphToken(env));
  const url = `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${bearer}` } });
  if (!res.ok) await failResponse(res, "Graph", env.MS_CLIENT_SECRET);
  return new Uint8Array(await res.arrayBuffer());
}

async function fixtureMeta(env: SheetSyncEnv): Promise<Meta> {
  const base = (env.SHEET_FIXTURE_URL ?? "").trim();
  const url = new URL(base);
  url.searchParams.set("meta", "1");
  const res = await fetch(url.toString());
  if (!res.ok) await failResponse(res, "fixture");
  const payload = (await res.json()) as { name?: string; cTag?: string; webUrl?: string; lastModifiedDateTime?: string };
  return {
    name: payload.name ?? null,
    cTag: payload.cTag || null,
    webUrl: payload.webUrl ?? null,
    modifiedAt: payload.lastModifiedDateTime ?? null,
  };
}

async function fixtureBytes(env: SheetSyncEnv): Promise<Uint8Array> {
  const res = await fetch((env.SHEET_FIXTURE_URL ?? "").trim());
  if (!res.ok) await failResponse(res, "fixture");
  return new Uint8Array(await res.arrayBuffer());
}

async function lastCtag(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT workbook_ctag FROM sheet_sync_runs
       WHERE source = 'labor' AND status IN ('ok', 'skipped') AND workbook_ctag IS NOT NULL AND workbook_ctag <> ''
       ORDER BY started_at DESC LIMIT 1`
    )
    .first<{ workbook_ctag: string }>();
  return row?.workbook_ctag ?? null;
}

function pruneStmt(db: D1Database): D1PreparedStatement {
  return db.prepare(
    `DELETE FROM sheet_sync_runs WHERE id IN (
       SELECT id FROM sheet_sync_runs ORDER BY started_at DESC LIMIT -1 OFFSET ${KEEP_RUNS}
     )`
  );
}

function metaStmts(db: D1Database, meta: Meta, ts: string): D1PreparedStatement[] {
  const upsert = `INSERT INTO app_config (key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
    VALUES (?, ?, ?, NULL, ?, NULL, NULL, NULL)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, deleted_at = NULL`;
  const stmts: D1PreparedStatement[] = [];
  if (meta.name) stmts.push(db.prepare(upsert).bind(CONFIG_KEYS.sheet_last_name, meta.name, ts, ts));
  if (meta.webUrl) stmts.push(db.prepare(upsert).bind(CONFIG_KEYS.sheet_last_web_url, meta.webUrl, ts, ts));
  return stmts;
}

function runStmt(
  db: D1Database,
  row: {
    id: string;
    started: string;
    finished: string;
    status: SheetSyncStatus;
    trigger: SheetSyncTrigger;
    modifiedAt: string | null;
    cTag: string | null;
    counts: LandCounts | null;
    harvest: LandCounts | null;
    message: string | null;
  }
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO sheet_sync_runs (
        id, started_at, finished_at, status, trigger, workbook_modified_at, workbook_ctag,
        rows_seen, rows_landed, rows_changed, rows_skipped, message, source,
        harvest_rows_seen, harvest_rows_landed, harvest_rows_changed, harvest_rows_skipped
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'labor', ?, ?, ?, ?)`
    )
    .bind(
      row.id,
      row.started,
      row.finished,
      row.status,
      row.trigger,
      row.modifiedAt,
      row.cTag,
      row.counts?.rows_seen ?? null,
      row.counts?.rows_landed ?? null,
      row.counts?.rows_changed ?? null,
      row.counts?.rows_skipped ?? null,
      row.message,
      row.harvest?.rows_seen ?? null,
      row.harvest?.rows_landed ?? null,
      row.harvest?.rows_changed ?? null,
      row.harvest?.rows_skipped ?? null
    );
}

async function commit(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  const size = 80;
  for (let i = 0; i < stmts.length; i += size) {
    const part = stmts.slice(i, i + size);
    if (part.length) await db.batch(part);
  }
}

export async function runSheetSync(env: SheetSyncEnv, trigger: SheetSyncTrigger): Promise<SheetSyncRunRow> {
  const started = nowIso();
  const id = crypto.randomUUID();
  const finish = (
    status: SheetSyncStatus,
    message: string | null,
    meta: Meta | null,
    counts: LandCounts | null
  ): SheetSyncRunRow => ({
    id,
    started_at: started,
    finished_at: nowIso(),
    status,
    trigger,
    workbook_modified_at: meta?.modifiedAt ?? null,
    workbook_ctag: meta?.cTag ?? null,
    rows_seen: counts?.rows_seen ?? null,
    rows_landed: counts?.rows_landed ?? null,
    rows_changed: counts?.rows_changed ?? null,
    rows_skipped: counts?.rows_skipped ?? null,
    message,
  });
  try {
    const kind = sheetSourceKind(env);
    if (kind === "none") {
      const row = finish("failed", "no source configured", null, null);
      await commit(env.DB, [runStmt(env.DB, { ...row, started, finished: row.finished_at ?? started, modifiedAt: null, cTag: null, counts: null, harvest: null, message: row.message }), pruneStmt(env.DB)]);
      return row;
    }
    const token = kind === "graph" ? await graphToken(env) : null;
    const meta = kind === "graph" ? await graphMeta(env, token ?? "") : await fixtureMeta(env);
    const previous = await lastCtag(env.DB);
    if (meta.cTag && previous && meta.cTag === previous) {
      const row = finish("skipped", null, meta, null);
      await commit(env.DB, [
        runStmt(env.DB, { ...row, started, finished: row.finished_at ?? started, modifiedAt: meta.modifiedAt, cTag: meta.cTag, counts: null, harvest: null, message: null }),
        ...metaStmts(env.DB, meta, row.finished_at ?? started),
        pruneStmt(env.DB),
      ]);
      return row;
    }
    const bytes = kind === "graph" ? await graphBytes(env, token ?? "") : await fixtureBytes(env);
    return await writeWorkbook(env.DB, bytes, trigger, meta, started, id, env.MS_CLIENT_SECRET);
  } catch (err) {
    const message = scrubSecrets(err instanceof Error ? err.message : String(err), env.MS_CLIENT_SECRET);
    const row = finish("failed", message, null, null);
    try {
      await commit(env.DB, [
        runStmt(env.DB, { ...row, started, finished: row.finished_at ?? started, modifiedAt: null, cTag: null, counts: null, harvest: null, message }),
        pruneStmt(env.DB),
      ]);
    } catch {
      // The run row is the record of the failure. A second failure leaves the thrown error's words on the row we return.
    }
    return row;
  }
}

/** Land both tabs from bytes already in hand. An upload does not consult the cTag. */
export async function landSheetWorkbook(db: D1Database, bytes: Uint8Array, trigger: SheetSyncTrigger): Promise<SheetSyncRunRow> {
  const started = nowIso();
  const id = crypto.randomUUID();
  try {
    return await writeWorkbook(db, bytes, trigger, null, started, id);
  } catch (err) {
    const message = scrubSecrets(err instanceof Error ? err.message : String(err));
    const row: SheetSyncRunRow = {
      id,
      started_at: started,
      finished_at: nowIso(),
      status: "failed",
      trigger,
      workbook_modified_at: null,
      workbook_ctag: null,
      rows_seen: null,
      rows_landed: null,
      rows_changed: null,
      rows_skipped: null,
      message,
    };
    try {
      await commit(db, [
        runStmt(db, { id, started, finished: row.finished_at ?? started, status: "failed", trigger, modifiedAt: null, cTag: null, counts: null, harvest: null, message }),
        pruneStmt(db),
      ]);
    } catch {
      // The returned row still carries the failure.
    }
    return row;
  }
}

async function writeWorkbook(
  db: D1Database,
  bytes: Uint8Array,
  trigger: SheetSyncTrigger,
  meta: Meta | null,
  started: string,
  id: string,
  secret?: string
): Promise<SheetSyncRunRow> {
  const laborTab = (await configValue(db, CONFIG_KEYS.sheet_labor_tab)) ?? "Labor";
  const harvestTab = (await configValue(db, CONFIG_KEYS.sheet_harvest_tab)) ?? "Harvest Details";
  const parsed = await parseLaborWorkbook(bytes, laborTab);
  const harvestParsed = await parseHarvestWorkbook(bytes, harvestTab);
  const plan = await planHourWrites(db, parsed, started);
  const harvest = await planHarvestWrites(db, harvestParsed, started, id);
  const finished = nowIso();
  const row: SheetSyncRunRow = {
    id,
    started_at: started,
    finished_at: finished,
    status: "ok",
    trigger,
    workbook_modified_at: meta?.modifiedAt ?? null,
    workbook_ctag: meta?.cTag ?? null,
    rows_seen: plan.counts.rows_seen,
    rows_landed: plan.counts.rows_landed,
    rows_changed: plan.counts.rows_changed,
    rows_skipped: plan.counts.rows_skipped,
    harvest_rows_seen: harvest.counts.rows_seen,
    harvest_rows_landed: harvest.counts.rows_landed,
    harvest_rows_changed: harvest.counts.rows_changed,
    harvest_rows_skipped: harvest.counts.rows_skipped,
    message: harvest.message,
  };
  await commit(db, [
    ...plan.stmts,
    ...harvest.stmts,
    runStmt(db, {
      id,
      started,
      finished,
      status: "ok",
      trigger,
      modifiedAt: meta?.modifiedAt ?? null,
      cTag: meta?.cTag ?? null,
      counts: plan.counts,
      harvest: harvest.counts,
      message: harvest.message,
    }),
    ...(meta ? metaStmts(db, meta, finished) : []),
    pruneStmt(db),
  ]);
  if (secret && row.message) row.message = scrubSecrets(row.message, secret);
  return row;
}

/* ------------------------------------------------------------- the console */

/** Eastern wall time, 12-hour, labeled ET, whatever zone the process is in. */
export function easternStamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FARM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  }).formatToParts(d);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const period = /a/i.test(pick("dayPeriod")) ? "AM" : "PM";
  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")} ${period} ET`;
}

function fill(locale: Locale, key: string, vars: Record<string, string | number>): string {
  let text = t(locale, key);
  for (const [name, value] of Object.entries(vars)) text = text.replaceAll(`{${name}}`, String(value));
  return text;
}

export function sheetSyncLineText(view: SheetSyncView | null, locale: Locale): string {
  if (!view) return t(locale, "sheet never read");
  const time = easternStamp(view.at);
  if (view.status === "ok") {
    return fill(locale, "read from the sheet at {time} ({rows} rows, {changed} changed)", {
      time,
      rows: view.rowsSeen ?? 0,
      changed: view.rowsChanged ?? 0,
    });
  }
  if (view.status === "skipped") return fill(locale, "sheet unchanged since {time}", { time });
  return fill(locale, "sheet read failed at {time}: {message}", { time, message: view.message ?? "" });
}

export async function latestSheetSync(db: D1Database): Promise<SheetSyncView | null> {
  const row = await db
    .prepare(
      `SELECT status, COALESCE(finished_at, started_at) AS at, rows_seen, rows_changed, message
       FROM sheet_sync_runs
       WHERE source = 'labor'
       ORDER BY started_at DESC LIMIT 1`
    )
    .first<{ status: string; at: string; rows_seen: number | null; rows_changed: number | null; message: string | null }>();
  if (!row) return null;
  if (row.status !== "ok" && row.status !== "skipped" && row.status !== "failed") return null;
  return {
    status: row.status,
    at: row.at,
    rowsSeen: row.rows_seen == null ? null : Number(row.rows_seen),
    rowsChanged: row.rows_changed == null ? null : Number(row.rows_changed),
    message: row.message,
  };
}

export async function sheetSyncStatusLine(db: D1Database, locale: Locale): Promise<string> {
  return sheetSyncLineText(await latestSheetSync(db), locale);
}

/* ---------------------------------------------------------------- the admin */

export async function loadSheetSyncAdmin(db: D1Database): Promise<{ runs: SheetSyncRunRow[]; name: string | null; webUrl: string | null }> {
  const [runs, name, webUrl] = await Promise.all([
    db
      .prepare(
        `SELECT id, started_at, finished_at, status, trigger, workbook_modified_at, workbook_ctag,
                rows_seen, rows_landed, rows_changed, rows_skipped,
                harvest_rows_seen, harvest_rows_landed, harvest_rows_changed, harvest_rows_skipped,
                message, source
         FROM sheet_sync_runs ORDER BY started_at DESC LIMIT 10`
      )
      .all<SheetSyncRunRow>(),
    configValue(db, CONFIG_KEYS.sheet_last_name),
    configValue(db, CONFIG_KEYS.sheet_last_web_url),
  ]);
  return { runs: runs.results ?? [], name, webUrl };
}

function safeHttpUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.toString();
  } catch {
    return null;
  }
  return null;
}

function numCell(n: number | null): string {
  return n == null ? "" : esc(String(n));
}

export function sheetSyncAdminPage(
  data: { runs: SheetSyncRunRow[]; name: string | null; webUrl: string | null },
  locale: Locale,
  ok: string | null
): string {
  const latest = data.runs.find((run) => (run.source ?? "labor") !== "in_testing") ?? null;
  const latestInTesting = data.runs.find((run) => run.source === "in_testing") ?? null;
  const flash =
    ok === "ran" && latest
      ? `<p class="banner ${latest.status === "failed" ? "err" : "ok"}" data-sheet-sync-flash="${esc(latest.status)}">${esc(
          t(locale, latest.status === "ok" ? "The sheet was read." : latest.status === "skipped" ? "The sheet was unchanged." : "The sheet read failed.")
        )}</p>`
      : "";
  const href = safeHttpUrl(data.webUrl);
  const meta = data.name
    ? `<p data-sheet-sync-name="${esc(data.name)}" data-sheet-sync-url="${esc(href ?? "")}">${esc(t(locale, "Sheet"))}: ${esc(data.name)}${
        href ? ` <a href="${esc(href)}">${esc(href)}</a>` : ""
      }</p>`
    : `<p class="muted" data-sheet-sync-name="">${esc(t(locale, "no sheet metadata yet"))}</p>`;
  const head = `<tr><th>${esc(t(locale, "Started"))}</th><th>${esc(t(locale, "Status"))}</th><th>${esc(t(locale, "Trigger"))}</th><th>${esc(
    t(locale, "Rows seen")
  )}</th><th>${esc(t(locale, "Landed"))}</th><th>${esc(t(locale, "Changed")  )}</th><th>${esc(t(locale, "Skipped"))}</th><th>${esc(t(locale, "Harvest seen"))}</th><th>${esc(
    t(locale, "Harvest landed")
  )}</th><th>${esc(t(locale, "Harvest changed"))}</th><th>${esc(t(locale, "Harvest skipped"))}</th><th>${esc(
    t(locale, "Message")
  )}</th></tr>`;
  let laborMarked = false;
  let testingMarked = false;
  const body = data.runs
    .map((run) => {
      const source = run.source ?? "labor";
      const laborLatest = source !== "in_testing" && !laborMarked;
      const testingLatest = source === "in_testing" && !testingMarked;
      if (laborLatest) laborMarked = true;
      if (testingLatest) testingMarked = true;
      return `<tr data-sheet-sync-status="${esc(run.status)}" data-sheet-sync-source="${esc(source)}" data-sheet-sync-seen="${numCell(run.rows_seen)}" data-sheet-sync-landed="${numCell(
        run.rows_landed
      )}" data-sheet-sync-changed="${numCell(run.rows_changed)}" data-sheet-sync-skipped="${numCell(run.rows_skipped)}" data-harvest-seen="${numCell(
        run.harvest_rows_seen ?? null
      )}" data-harvest-landed="${numCell(run.harvest_rows_landed ?? null)}" data-harvest-changed="${numCell(
        run.harvest_rows_changed ?? null
      )}" data-harvest-skipped="${numCell(run.harvest_rows_skipped ?? null)}"${
        laborLatest ? ` data-sheet-sync-latest="${esc(run.status)}"` : ""
      }${testingLatest ? ` data-in-testing-latest="${esc(run.status)}"` : ""}>
        <td>${esc(easternStamp(run.started_at))}</td>
        <td>${esc(t(locale, run.status))}</td>
        <td>${esc(t(locale, run.trigger))}</td>
        <td>${numCell(run.rows_seen)}</td>
        <td>${numCell(run.rows_landed)}</td>
        <td>${numCell(run.rows_changed)}</td>
        <td>${numCell(run.rows_skipped)}</td>
        <td>${numCell(run.harvest_rows_seen ?? null)}</td>
        <td>${numCell(run.harvest_rows_landed ?? null)}</td>
        <td>${numCell(run.harvest_rows_changed ?? null)}</td>
        <td>${numCell(run.harvest_rows_skipped ?? null)}</td>
        <td>${esc(run.message ? translateSheetMessage(run.message, locale) : "")}</td>
      </tr>`;
    })
    .join("");
  const inTestingLine = latestInTesting
    ? `<p data-in-testing-status="${esc(latestInTesting.status)}" data-in-testing-seen="${numCell(latestInTesting.rows_seen)}">${esc(t(locale, "In testing sheet"))}: ${esc(latestInTesting.status)}${
        latestInTesting.rows_seen == null ? "" : ` ${esc(String(latestInTesting.rows_seen))} ${esc(t(locale, "Rows seen"))}`
      }</p>`
    : `<p class="muted" data-in-testing-status="">${esc(t(locale, "In testing sheet"))}: ${esc(t(locale, "No runs yet."))}</p>`;
  const table = data.runs.length
    ? `<table class="data"><thead>${head}</thead><tbody>${body}</tbody></table>`
    : `<p class="muted">${esc(t(locale, "No runs yet."))}</p>`;
  return `<h1>${esc(t(locale, "Sheet sync"))}</h1>
    ${flash}
    ${meta}
    ${inTestingLine}
    <form method="post" action="${ADMIN_SHEET_SYNC_PATH}/run">
      <button type="submit" data-sheet-sync-run>${esc(t(locale, "Run now"))}</button>
    </form>
    ${table}
    <p class="muted">${esc(t(locale, "The sheet is the source of the cutting and bucking hours and replaces a typed number at the next hour."))}</p>`;
}

/* -------------------------------------------------------------- the fixture */

function xmlEsc(s: string): string {
  return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function colLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    out = String.fromCharCode(65 + m) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** A Harvest Details row keyed by header label. A date is an ISO day. A string in a gram column is text. */
export type HarvestFixtureRow = Record<string, string | number | null | undefined>;

function harvestSheetXml(data: HarvestFixtureRow[]): string {
  const labels = HARVEST_FIELDS.map((field) => field.label);
  const header = labels
    .map((label, i) => {
      const col = colLetter(i);
      const text = label === "Wet Spear Weight (grams)" ? "Wet Spear Weight\n(grams)" : label;
      if (text.includes("\n")) {
        const [head, tail] = text.split("\n");
        return `<c r="${col}4" t="inlineStr"><is><t>${xmlEsc(head ?? "")}</t><t>${xmlEsc("\n" + (tail ?? ""))}</t></is></c>`;
      }
      return `<c r="${col}4" t="inlineStr"><is><t>${xmlEsc(text)}</t></is></c>`;
    })
    .join("");
  const body = data
    .map((row, i) => {
      const r = 7 + i;
      const cells = labels
        .map((label, c) => {
          const value = row[label];
          if (value == null || value === "") return "";
          const col = colLetter(c);
          const ref = `${col}${r}`;
          if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
          if ((label === "Date" || label === "Seq. Date") && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return `<c r="${ref}"><v>${isoToExcelSerial(value) ?? ""}</v></c>`;
          }
          return `<c r="${ref}" t="inlineStr"><is><t>${xmlEsc(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData><row r="4">${header}</row>${body}</sheetData></worksheet>`;
}

function smokeHarvestRows(): HarvestFixtureRow[] {
  return [
    {
      Date: "2026-08-24",
      "METRC Harvest Tag": FIXTURE_ALIAS_TAG,
      "Harvest Batch Name": fixtureAliasSheetHbn(),
      Farm: "PNN",
      "Grow Method": "Indoor",
      Strain: "Fruity Pebbles",
      "Market Strain": "Sheet Apple",
      "Manicure?": "No",
      Cuts: 2,
      Plants: 10,
      "Wet Spear Weight (grams)": 1000.5,
      "Dry Weight (grams)": 400,
    },
    {
      Date: "2026-08-25",
      "METRC Harvest Tag": "1A4050300000000000000E81",
      "Harvest Batch Name": fixtureAgreeHbn(),
      Farm: "PNN",
      "Grow Method": "Greenhouse",
      Strain: "After Party",
      "Manicure?": "Yes",
    },
    {
      Date: "2026-09-01",
      "Harvest Batch Name": FIXTURE_KNOWN_HBN,
      Farm: "ARL",
      "Grow Method": "Greenhouse",
      Strain: "Fruity Pebbles",
      "Market Strain": FIXTURE_MARKET,
      "Manicure?": "No",
      "Dry Weight (grams)": "n/a",
    },
    {
      Date: "2026-08-26",
      "Harvest Batch Name": fixtureSkipHbn(),
      Farm: "PNN",
      "Grow Method": "Outdoor",
      Strain: FIXTURE_SKIP_STRAIN,
      "Manicure?": "No",
    },
  ];
}

/** A small store-method workbook. Labor dates are relative to the farm's today. Harvest rows are synthetic. */
export function sheetWorkbook(today: string, harvestRows: HarvestFixtureRow[]): Uint8Array {
  const yesterday = dayBefore(today);
  const older = dayBefore(yesterday);
  const tomorrow = dayAfter(today);
  const serial = (iso: string) => String(isoToExcelSerial(iso) ?? "");
  const shared = ["DATE", "HARV FARM", "CUT/BCK # HRS", "PNN"];
  const sharedXml = `<?xml version="1.0" encoding="UTF-8"?><sst>${shared
    .map((s) => `<si><t>${xmlEsc(s)}</t></si>`)
    .join("")}</sst>`;
  const workbookXml = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Labor" sheetId="10" r:id="rId10"/><sheet name="Harvest Details" sheetId="11" r:id="rId11"/></sheets></workbook>`;
  const relsXml = `<?xml version="1.0" encoding="UTF-8"?><Relationships><Relationship Id="rId10" Type="worksheet" Target="worksheets/sheet10.xml"/><Relationship Id="rId11" Type="worksheet" Target="worksheets/sheet11.xml"/></Relationships>`;
  const sheetXml = `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>
    <row r="3"><c r="C3" t="s"><v>0</v></c><c r="D3" t="s"><v>1</v></c><c r="I3" t="s"><v>2</v></c></row>
    <row r="4"><c r="C4"><f t="array" ref="C4">1</f><v>${serial(yesterday)}</v></c><c r="D4" t="str"><v>ARL</v></c><c r="I4"><v>${FIXTURE_YESTERDAY_HOURS.ARL}</v></c></row>
    <row r="5"><c r="C5"><f t="shared" si="15"/><v>${serial(yesterday)}</v></c><c r="D5" t="s"><v>3</v></c><c r="I5"><v>${FIXTURE_YESTERDAY_HOURS.PNN}</v></c></row>
    <row r="6"><c r="C6"><v>${serial(yesterday)}</v></c><c r="D6" t="inlineStr"><is><t>pns</t></is></c><c r="I6"><v>${FIXTURE_YESTERDAY_HOURS.PNS}</v></c></row>
    <row r="7"><c r="C7"><v>${serial(older)}</v></c><c r="D7" t="str"><v>PNN</v></c><c r="I7"><f>1</f><v>${FIXTURE_TYPED_HOURS}</v></c></row>
    <row r="8"><c r="C8"><v>${serial(tomorrow)}</v></c><c r="D8" t="str"><v>ARL</v></c><c r="I8"><v>99</v></c></row>
    <row r="9"><c r="C9"><v>${serial(yesterday)}</v></c><c r="D9" t="str"><v>xyz</v></c><c r="I9"><v>6</v></c></row>
    <row r="10"><c r="C10"><v>${serial(yesterday)}</v></c><c r="I10"><v>5</v></c></row>
    <row r="11"><c r="C11"><v>${serial(yesterday)}</v></c><c r="D11" t="str"><v>ARL</v></c><c r="I11" s="185"/></row>
  </sheetData></worksheet>`;
  const enc = new TextEncoder();
  return writeStoreZip([
    { name: "xl/workbook.xml", data: enc.encode(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(relsXml) },
    { name: "xl/sharedStrings.xml", data: enc.encode(sharedXml) },
    { name: "xl/worksheets/sheet10.xml", data: enc.encode(sheetXml) },
    { name: "xl/worksheets/sheet11.xml", data: enc.encode(harvestSheetXml(harvestRows)) },
  ]);
}

/** Labor plus a header-only Harvest Details tab, so a run that only checks hours still finds the tab. */
export function laborFixtureWorkbook(today: string): Uint8Array {
  return sheetWorkbook(today, []);
}

/** The smoke fixture: Labor as before, plus four synthetic Harvest Details rows. Never the owner's workbook. */
export function smokeSheetWorkbook(today: string): Uint8Array {
  return sheetWorkbook(today, smokeHarvestRows());
}

export async function fixtureHttpResponse(db: D1Database, fixtureUrl: string, meta: boolean): Promise<Response> {
  const now = nowIso();
  const today = await farmToday(db, now);
  const bytes = smokeSheetWorkbook(today);
  if (meta) {
    const payload = {
      id: "fixture",
      name: FIXTURE_NAME,
      cTag: fixtureCtag(today),
      eTag: fixtureCtag(today),
      lastModifiedDateTime: now,
      size: bytes.byteLength,
      webUrl: fixtureUrl,
    };
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return new Response(bytes, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "cache-control": "no-store",
    },
  });
}
