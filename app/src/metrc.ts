/**
 * THE METRC MIRROR (canon 0.30.38). Owner, 2026-09-11, with eight METRC
 * exports attached: "Let's start the internal inventory slice.  I think it
 * would be smart to start with all the inventory at all the sites.  I've
 * dropped all the inventory here.  There isn't anything in the processing
 * license right now.  Now, I am going to want to add our own internal fields
 * to these records that are not METRC related so we might need to do some
 * stretching as we move". His picks on the Scribe's forks: F1 "Mirror + field
 * registry", F2 "Both" (METRC's xlsx or its CSV).
 *
 * The state's rows are the spine and the tag is the key. One table mirrors
 * plants and one mirrors packages, each column exactly as METRC states it, fed
 * by a drop lane like the Zoho tab: THE MIRROR LAW, the export is the truth of
 * METRC as of the drop for its license (and phase, for plants); a newer drop
 * updates rows in place and marks the rows it no longer carries as gone; the
 * mount row is the log entry (one per drop, never one per plant); history is
 * never edited. Our own fields hang off the tag (internal_field_values); the
 * field list is a lookup (category internal_field), so a new field is an Admin
 * row, not a migration: the stretching he named.
 *
 * The reader takes METRC's xlsx as exported (a zip of XML: shared strings,
 * one sheet, dates as serials under numFmt 14) or the CSV of the same grid.
 * The xlsx sheet streams through the inflater row by row, so a 48,149-row
 * plants file never sits in memory as one string. No library: the zip is a
 * central directory walk and DecompressionStream("deflate-raw").
 *
 * THE SLICED MOUNT (canon 0.30.42): after the live Error 1102 on the third
 * export, the drop page sends the file in rounds of METRC_SLICE_ROWS rows, one
 * Worker request each (mountMetrcRound); a browser without the script posts
 * once and the Worker walks the whole file in that request (mountMetrcExport).
 */

import { HttpError, nowIso, textOrNull } from "./audit";
import { applyTransition, CONFIG_KEYS, isKnownSiteLicense, isPrepackWpr, ITEM_KIND_FG, LOC_BLAST_FREEZER, metrcQuantity, parseCryoTypeCategories, parseFfzItemKinds, parseMetrcReleaseStates, roundGrams, siteOfLicense, SYSTEM_REASON, WIP_STATUS } from "./config";
import { parseCsv } from "./csv";
import { parseHbn } from "./mint";
import { ffzKindBinds, ffzKindClause, getConfigValue, insertLog, logsForInsert, requireActor } from "./db";
import type { ActionOk } from "./actions";
import type { MirrorPackage } from "./manifest";

/* ------------------------------------------------------------- constants */

export type MetrcKind = "plants" | "packages";

/** METRC's plants grid, byte for byte (PlantsFlowering and PlantsVegetative). */
export const METRC_PLANT_COLUMNS = [
  "Tag",
  "Strain",
  "Location",
  "Sublocation",
  "Hold",
  "Plant Batch",
  "Plant Batch Type",
  "Plant Batch Date",
  "Phase Date",
  "Harvested",
] as const;

/** METRC's packages grid, byte for byte (PackagesActive). */
export const METRC_PACKAGE_COLUMNS = [
  "Tag",
  "Source Harvest(s)",
  "Source Package(s)",
  "Original Source Package Label",
  "Source Processing Job(s)",
  "Location",
  "Sublocation",
  "Item",
  "Category",
  "Item Strain",
  "Quantity",
  "Unit Of Measure",
  "Production Batch Number",
  "Source Production Batch",
  "Lab Test Status",
  "Finished Goods",
  "Administrative Hold",
  "Administrative Recall",
  "Packaged Date",
  "Received",
  "Expiration Date",
  "Lab Test Expiration",
] as const;

/** The date columns, by grid, read as dates whatever the file carries. */
const DATE_COLUMNS = new Set([
  "Plant Batch Date",
  "Phase Date",
  "Packaged Date",
  "Received",
  "Expiration Date",
  "Lab Test Expiration",
]);

export const METRC_MOUNT_CHUNK = 400;
/** D1 binds at most 100 parameters per statement; multi-row inserts respect it. */
const D1_MAX_PARAMS = 100;

/* --------------------------------------------------------- the file name */

export type MetrcFilenameRead = {
  license: string | null;
  kind: MetrcKind | null;
  /** The grid word after Plants or Packages: Flowering, Vegetative, Active. */
  grid: string | null;
};

/** MetrcMichiganAUGC000832PackagesActive_12.xlsx reads license AU-G-C-000832,
 * kind packages, grid Active; MetrcMichiganGRC001132PlantsVegetative_6.xlsx
 * reads GR-C-001132, plants, Vegetative. AUP is the processor line. */
export function parseMetrcFilename(name: string): MetrcFilenameRead {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const m = /Metrc(?:[A-Za-z]+?)?((?:AUGC|AUP|GRC)\d{6})(Plants|Packages)([A-Za-z]*)/i.exec(base);
  if (!m) return { license: null, kind: null, grid: null };
  const raw = m[1].toUpperCase();
  let license: string;
  if (raw.startsWith("AUGC")) license = `AU-G-C-${raw.slice(4)}`;
  else if (raw.startsWith("AUP")) license = `AU-P-${raw.slice(3)}`;
  else license = `GR-C-${raw.slice(3)}`;
  const kind = m[2].toLowerCase() === "plants" ? "plants" : "packages";
  const grid = m[3] ? m[3] : null;
  return { license, kind, grid };
}

export function phaseFromGrid(grid: string | null | undefined): string | null {
  const g = String(grid ?? "").trim().toLowerCase();
  if (!g) return null;
  if (g.startsWith("flower")) return "flowering";
  if (g.startsWith("veg")) return "vegetative";
  return g;
}

/* ------------------------------------------------------------ the reader */

export type MetrcGrid = {
  header: string[];
  rows: string[][];
  format: "xlsx" | "csv";
};

const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP_LOCAL = 0x04034b50;

type ZipEntry = { name: string; method: number; compSize: number; dataStart: number };

function u16(b: Uint8Array, at: number): number {
  return b[at] | (b[at + 1] << 8);
}
function u32(b: Uint8Array, at: number): number {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16)) + b[at + 3] * 0x1000000;
}

/** The zip's central directory, walked without a library. */
export function zipEntries(bytes: Uint8Array): ZipEntry[] {
  const min = Math.max(0, bytes.length - 22 - 65536);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= min; i--) {
    if (u32(bytes, i) === ZIP_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new HttpError(400, "That file is not a spreadsheet (no zip directory).");
  const count = u16(bytes, eocd + 10);
  let at = u32(bytes, eocd + 16);
  const entries: ZipEntry[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (u32(bytes, at) !== ZIP_CENTRAL) break;
    const method = u16(bytes, at + 10);
    const compSize = u32(bytes, at + 20);
    const nameLen = u16(bytes, at + 28);
    const extraLen = u16(bytes, at + 30);
    const commentLen = u16(bytes, at + 32);
    const localAt = u32(bytes, at + 42);
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen));
    if (u32(bytes, localAt) !== ZIP_LOCAL) throw new HttpError(400, "That spreadsheet's zip is damaged.");
    const localNameLen = u16(bytes, localAt + 26);
    const localExtraLen = u16(bytes, localAt + 28);
    const dataStart = localAt + 30 + localNameLen + localExtraLen;
    entries.push({ name, method, compSize, dataStart });
    at += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function entryStream(bytes: Uint8Array, entry: ZipEntry): ReadableStream<Uint8Array> {
  const data = bytes.subarray(entry.dataStart, entry.dataStart + entry.compSize);
  const raw = new Blob([data]).stream() as ReadableStream<Uint8Array>;
  if (entry.method === 0) return raw;
  if (entry.method === 8) return raw.pipeThrough(new DecompressionStream("deflate-raw"));
  throw new HttpError(400, `That spreadsheet uses zip method ${entry.method}, which this reader does not open.`);
}

async function entryText(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  return new Response(entryStream(bytes, entry)).text();
}

const XML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (whole, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return XML_ENTITIES[code] ?? whole;
  });
}

/** The shared strings table: one entry per <si>, rich runs joined. */
export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const si = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = si.exec(xml))) {
    let text = "";
    const t = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = t.exec(m[1]))) text += tm[1];
    out.push(decodeXml(text));
  }
  return out;
}

/** Built-in date number formats plus any custom format that spells a date. */
export function parseDateStyles(stylesXml: string): Set<number> {
  const customDate = new Set<number>();
  const fmt = /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = fmt.exec(stylesXml))) {
    const code = decodeXml(m[2]).replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
    if (/[dmyh]/i.test(code)) customDate.add(Number(m[1]));
  }
  const builtin = (id: number) =>
    (id >= 14 && id <= 22) || (id >= 27 && id <= 36) || (id >= 45 && id <= 47) || (id >= 50 && id <= 58);
  const dateStyles = new Set<number>();
  const xfsBlock = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml);
  if (!xfsBlock) return dateStyles;
  const xf = /<xf\b([^>]*?)\/?>/g;
  let i = 0;
  while ((m = xf.exec(xfsBlock[1]))) {
    const idm = /numFmtId="(\d+)"/.exec(m[1]);
    const id = idm ? Number(idm[1]) : 0;
    if (builtin(id) || customDate.has(id)) dateStyles.add(i);
    i += 1;
  }
  return dateStyles;
}

export function columnIndex(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Excel's 1900 date system: serial days from 1899-12-30, the time dropped. */
export function excelSerialToIso(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

const CELL_RE = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

/** One <row> of sheet XML into its cells, by column index. */
export function parseSheetRow(
  rowXml: string,
  shared: readonly string[],
  dateStyles: ReadonlySet<number>
): string[] {
  const cells: string[] = [];
  let m: RegExpExecArray | null;
  CELL_RE.lastIndex = 0;
  while ((m = CELL_RE.exec(rowXml))) {
    const attrs = m[1];
    const inner = m[2] ?? "";
    const ref = /\br="([A-Z]+)\d+"/.exec(attrs);
    if (!ref) continue;
    const col = columnIndex(ref[1]);
    const type = /\bt="(\w+)"/.exec(attrs)?.[1] ?? "";
    const style = /\bs="(\d+)"/.exec(attrs)?.[1];
    let value = "";
    if (type === "inlineStr") {
      const t = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(inner);
      value = decodeXml(t?.[1] ?? "");
    } else {
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
      const raw = v ? v[1] : "";
      if (raw === "") value = "";
      else if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "b") value = raw === "1" ? "True" : "False";
      else if (type === "str" || type === "e") value = decodeXml(raw);
      else if (style != null && dateStyles.has(Number(style)) && /^-?\d+(\.\d+)?$/.test(raw)) {
        value = excelSerialToIso(Number(raw));
      } else value = raw;
    }
    while (cells.length < col) cells.push("");
    cells[col] = value;
  }
  return cells;
}

/** The worksheet, streamed row by row through the inflater. */
async function readSheetRows(
  bytes: Uint8Array,
  entry: ZipEntry,
  shared: readonly string[],
  dateStyles: ReadonlySet<number>,
  onRow: (cells: string[]) => void
): Promise<void> {
  const reader = entryStream(bytes, entry).getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const drain = (final: boolean) => {
    for (;;) {
      const start = buf.indexOf("<row");
      if (start < 0) {
        if (buf.length > 65536) buf = buf.slice(-4096);
        return;
      }
      const end = buf.indexOf("</row>", start);
      if (end < 0) {
        if (start > 0) buf = buf.slice(start);
        if (final) buf = "";
        return;
      }
      onRow(parseSheetRow(buf.slice(start, end + 6), shared, dateStyles));
      buf = buf.slice(end + 6);
    }
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    drain(false);
  }
  buf += decoder.decode();
  drain(true);
}

export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export type GridStreamResult = { header: string[]; format: "xlsx" | "csv"; total: number };

/** THE SLICED MOUNT (canon 0.30.42, after the live Error 1102 on the third
 * export): the grid streams to a callback, header first, so nothing holds every
 * row at once; the caller keeps only the rows it wants. total counts the data
 * rows seen (blank rows skipped). */
export async function streamMetrcGrid(
  bytes: Uint8Array,
  onHeader: (header: string[]) => void,
  onRow: (cells: string[], index: number) => void
): Promise<GridStreamResult> {
  if (!isZipBytes(bytes)) {
    const grid = readCsvGrid(new TextDecoder().decode(bytes));
    onHeader(grid.header);
    grid.rows.forEach((r, i) => onRow(r, i));
    return { header: grid.header, format: "csv", total: grid.rows.length };
  }
  const entries = zipEntries(bytes);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const sheet =
    byName.get("xl/worksheets/sheet1.xml") ??
    entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name)).sort((a, b) => a.name.localeCompare(b.name))[0];
  if (!sheet) throw new HttpError(400, "That spreadsheet has no worksheet.");
  const sharedEntry = byName.get("xl/sharedStrings.xml");
  const stylesEntry = byName.get("xl/styles.xml");
  const shared = sharedEntry ? parseSharedStrings(await entryText(bytes, sharedEntry)) : [];
  const dateStyles = stylesEntry ? parseDateStyles(await entryText(bytes, stylesEntry)) : new Set<number>();
  let header: string[] | null = null;
  let index = 0;
  await readSheetRows(bytes, sheet, shared, dateStyles, (cells) => {
    if (!header) {
      header = cells.map((h) => h.trim());
      onHeader(header);
      return;
    }
    if (cells.every((c) => c === "")) return;
    while (cells.length < header.length) cells.push("");
    onRow(cells, index);
    index += 1;
  });
  if (!header) throw new HttpError(400, "That spreadsheet is empty.");
  return { header, format: "xlsx", total: index };
}

/** METRC's xlsx as one grid in memory (tests and small files). */
export async function readXlsxGrid(bytes: Uint8Array): Promise<MetrcGrid> {
  let header: string[] = [];
  const rows: string[][] = [];
  const result = await streamMetrcGrid(
    bytes,
    (h) => {
      header = h;
    },
    (cells) => {
      rows.push(cells);
    }
  );
  return { header, rows, format: result.format };
}

/** METRC's CSV of the same grid (RFC 4180, BOM tolerated). */
export function readCsvGrid(text: string): MetrcGrid {
  const parsed = parseCsv(text);
  if (parsed.length === 0) throw new HttpError(400, "That CSV is empty.");
  const header = parsed[0].map((h) => h.trim());
  const rows = parsed.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  for (const r of rows) while (r.length < header.length) r.push("");
  return { header, rows, format: "csv" };
}

/** Either format, by the bytes (a zip signature), not the extension. */
export async function readMetrcGrid(bytes: Uint8Array): Promise<MetrcGrid> {
  if (isZipBytes(bytes)) return readXlsxGrid(bytes);
  return readCsvGrid(new TextDecoder().decode(bytes));
}

export function detectMetrcKind(header: readonly string[]): MetrcKind | null {
  const set = new Set(header.map((h) => h.trim().toLowerCase()));
  if (!set.has("tag")) return null;
  if (set.has("plant batch")) return "plants";
  if (set.has("item") && set.has("category")) return "packages";
  return null;
}

/* ------------------------------------------------------------ shaping */

export function normalizeMetrcDate(value: string): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  if (/^\d{4,6}(\.\d+)?$/.test(s)) return excelSerialToIso(Number(s));
  return s;
}

export function normalizeMetrcBool(value: string): 0 | 1 {
  const s = String(value ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1" || s === "y" ? 1 : 0;
}

function text(value: string | undefined): string | null {
  const s = String(value ?? "").trim();
  return s ? s : null;
}

export type MetrcPlantRow = {
  tag: string;
  strain: string | null;
  location: string | null;
  sublocation: string | null;
  hold: 0 | 1;
  plant_batch: string | null;
  plant_batch_type: string | null;
  plant_batch_date: string | null;
  phase_date: string | null;
  harvested: 0 | 1;
};

export type MetrcPackageRow = {
  tag: string;
  source_harvests: string | null;
  source_packages: string | null;
  original_source_label: string | null;
  source_processing_jobs: string | null;
  location: string | null;
  sublocation: string | null;
  item: string | null;
  category: string | null;
  item_strain: string | null;
  quantity: number | null;
  uom: string | null;
  production_batch: string | null;
  source_production_batch: string | null;
  lab_test_status: string | null;
  finished_goods: 0 | 1;
  admin_hold: 0 | 1;
  admin_recall: 0 | 1;
  packaged_date: string | null;
  received_date: string | null;
  expiration_date: string | null;
  lab_test_expiration: string | null;
};

function indexer(header: readonly string[]) {
  const map = new Map<string, number>();
  header.forEach((h, i) => map.set(h.trim().toLowerCase(), i));
  return (row: string[], column: string): string => {
    const i = map.get(column.toLowerCase());
    return i == null ? "" : (row[i] ?? "");
  };
}

type Getter = (row: string[], column: string) => string;

/** One plants row shaped; null when the tag is blank. */
export function shapePlantRow(get: Getter, r: string[]): MetrcPlantRow | null {
  const tag = get(r, "Tag").trim().toUpperCase();
  if (!tag) return null;
  return {
    tag,
    strain: text(get(r, "Strain")),
    location: text(get(r, "Location")),
    sublocation: text(get(r, "Sublocation")),
    hold: normalizeMetrcBool(get(r, "Hold")),
    plant_batch: text(get(r, "Plant Batch")),
    plant_batch_type: text(get(r, "Plant Batch Type")),
    plant_batch_date: normalizeMetrcDate(get(r, "Plant Batch Date")),
    phase_date: normalizeMetrcDate(get(r, "Phase Date")),
    harvested: normalizeMetrcBool(get(r, "Harvested")),
  };
}

/** Tags upper-cased and trimmed; blank tags dropped; a tag listed twice keeps
 * its last row. */
export function shapePlants(grid: MetrcGrid): MetrcPlantRow[] {
  const get = indexer(grid.header);
  const out = new Map<string, MetrcPlantRow>();
  for (const r of grid.rows) {
    const row = shapePlantRow(get, r);
    if (row) out.set(row.tag, row);
  }
  return [...out.values()];
}

function num(value: string): number | null {
  const s = String(value ?? "").replace(/,/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** One packages row shaped; null when the tag is blank. */
export function shapePackageRow(get: Getter, r: string[]): MetrcPackageRow | null {
  const tag = get(r, "Tag").trim().toUpperCase();
  if (!tag) return null;
  return {
    tag,
    source_harvests: text(get(r, "Source Harvest(s)")),
    source_packages: text(get(r, "Source Package(s)")),
    original_source_label: text(get(r, "Original Source Package Label")),
    source_processing_jobs: text(get(r, "Source Processing Job(s)")),
    location: text(get(r, "Location")),
    sublocation: text(get(r, "Sublocation")),
    item: text(get(r, "Item")),
    category: text(get(r, "Category")),
    item_strain: text(get(r, "Item Strain")),
    quantity: num(get(r, "Quantity")),
    uom: text(get(r, "Unit Of Measure")),
    production_batch: text(get(r, "Production Batch Number")),
    source_production_batch: text(get(r, "Source Production Batch")),
    lab_test_status: text(get(r, "Lab Test Status")),
    finished_goods: normalizeMetrcBool(get(r, "Finished Goods")),
    admin_hold: normalizeMetrcBool(get(r, "Administrative Hold")),
    admin_recall: normalizeMetrcBool(get(r, "Administrative Recall")),
    packaged_date: normalizeMetrcDate(get(r, "Packaged Date")),
    received_date: normalizeMetrcDate(get(r, "Received")),
    expiration_date: normalizeMetrcDate(get(r, "Expiration Date")),
    lab_test_expiration: normalizeMetrcDate(get(r, "Lab Test Expiration")),
  };
}

export function shapePackages(grid: MetrcGrid): MetrcPackageRow[] {
  const get = indexer(grid.header);
  const out = new Map<string, MetrcPackageRow>();
  for (const r of grid.rows) {
    const row = shapePackageRow(get, r);
    if (row) out.set(row.tag, row);
  }
  return [...out.values()];
}

export { indexer as metrcIndexer };

export { DATE_COLUMNS as METRC_DATE_COLUMNS };

/* ------------------------------------------------------------ the mount */

const PLANT_COLS = [
  "strain",
  "location",
  "sublocation",
  "hold",
  "plant_batch",
  "plant_batch_type",
  "plant_batch_date",
  "phase_date",
  "harvested",
] as const;

const PACKAGE_COLS = [
  "source_harvests",
  "source_packages",
  "original_source_label",
  "source_processing_jobs",
  "location",
  "sublocation",
  "item",
  "category",
  "item_strain",
  "quantity",
  "uom",
  "production_batch",
  "source_production_batch",
  "lab_test_status",
  "finished_goods",
  "admin_hold",
  "admin_recall",
  "packaged_date",
  "received_date",
  "expiration_date",
  "lab_test_expiration",
] as const;

type ExistingRow = Record<string, unknown> & {
  tag: string;
  gone_at: string | null;
  phase?: string | null;
  license_value?: string | null;
};

function same(a: unknown, b: unknown): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "number" || typeof b === "number") return Number(a) === Number(b);
  return String(a) === String(b);
}

export type MountDiff<T extends { tag: string }> = {
  added: T[];
  updated: T[];
  unchanged: number;
  gone: string[];
};

/** THE MIRROR LAW: the file is the truth for its license (and phase). A row the
 * mirror has never seen is added; a row whose columns moved (or that had been
 * marked gone, or whose phase or license changed) updates in place; a row the
 * file no longer carries is gone. Plants compare across every phase (a plant
 * moving vegetative to flowering is one tag), but only rows in the drop's own
 * phase can go missing from it. A package transferred between two of our own
 * licenses is one tag too: the receiving license's drop updates it in place. */
export function diffMount<T extends { tag: string }>(
  incoming: T[],
  existing: ExistingRow[],
  columns: readonly string[],
  scope: { phase?: string | null; license?: string | null }
): MountDiff<T> {
  const byTag = new Map(existing.map((e) => [e.tag, e]));
  const seen = new Set<string>();
  const added: T[] = [];
  const updated: T[] = [];
  let unchanged = 0;
  for (const row of incoming) {
    seen.add(row.tag);
    const was = byTag.get(row.tag);
    if (!was) {
      added.push(row);
      continue;
    }
    const rec = row as unknown as Record<string, unknown>;
    let moved = was.gone_at != null;
    if (!moved && scope.phase != null && !same(was.phase, scope.phase)) moved = true;
    if (!moved && scope.license != null && was.license_value != null && !same(was.license_value, scope.license)) moved = true;
    if (!moved) {
      for (const c of columns) {
        if (!same(was[c], rec[c])) {
          moved = true;
          break;
        }
      }
    }
    if (moved) updated.push(row);
    else unchanged += 1;
  }
  const gone: string[] = [];
  for (const e of existing) {
    if (e.gone_at != null || seen.has(e.tag)) continue;
    if (scope.phase != null && !same(e.phase, scope.phase)) continue;
    gone.push(e.tag);
  }
  return { added, updated, unchanged, gone };
}

function chunkRows<T>(rows: T[], perStatement: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += perStatement) out.push(rows.slice(i, i + perStatement));
  return out;
}

export function rowsPerInsert(columnsPerRow: number): number {
  return Math.max(1, Math.floor(D1_MAX_PARAMS / columnsPerRow));
}

export type MountSummary = Record<string, unknown>;

/* The summaries accumulate row by row so a sliced mount can total the whole
 * file on its last round without holding every row. */

export type PlantSummaryAcc = {
  plants: number;
  byStrain: Record<string, number>;
  byBatchType: Record<string, number>;
  locations: Set<string>;
  holds: number;
  harvested: number;
};

export function plantSummaryAcc(): PlantSummaryAcc {
  return { plants: 0, byStrain: {}, byBatchType: {}, locations: new Set(), holds: 0, harvested: 0 };
}

export function accumulatePlant(acc: PlantSummaryAcc, r: MetrcPlantRow): void {
  acc.plants += 1;
  const s = r.strain ?? "";
  acc.byStrain[s] = (acc.byStrain[s] ?? 0) + 1;
  const bt = r.plant_batch_type ?? "";
  acc.byBatchType[bt] = (acc.byBatchType[bt] ?? 0) + 1;
  if (r.location) acc.locations.add(r.location);
  acc.holds += r.hold;
  acc.harvested += r.harvested;
}

export function finishPlantSummary(acc: PlantSummaryAcc): MountSummary {
  return {
    plants: acc.plants,
    strains: Object.keys(acc.byStrain).length,
    locations: acc.locations.size,
    holds: acc.holds,
    harvested: acc.harvested,
    by_strain: acc.byStrain,
    by_batch_type: acc.byBatchType,
  };
}

export function summarizePlants(rows: MetrcPlantRow[]): MountSummary {
  const acc = plantSummaryAcc();
  for (const r of rows) accumulatePlant(acc, r);
  return finishPlantSummary(acc);
}

export type PackageSummaryAcc = {
  packages: number;
  byCategory: Record<string, { count: number; quantity: number; uom: string }>;
  locations: Set<string>;
  holds: number;
  lab: Record<string, number>;
};

export function packageSummaryAcc(): PackageSummaryAcc {
  return { packages: 0, byCategory: {}, locations: new Set(), holds: 0, lab: {} };
}

export function accumulatePackage(acc: PackageSummaryAcc, r: MetrcPackageRow): void {
  acc.packages += 1;
  const c = r.category ?? "";
  const slot = acc.byCategory[c] ?? { count: 0, quantity: 0, uom: r.uom ?? "" };
  slot.count += 1;
  slot.quantity = metrcQuantity(slot.quantity + (r.quantity ?? 0));
  if (!slot.uom && r.uom) slot.uom = r.uom;
  acc.byCategory[c] = slot;
  if (r.location) acc.locations.add(r.location);
  acc.holds += r.admin_hold;
  const l = r.lab_test_status ?? "";
  acc.lab[l] = (acc.lab[l] ?? 0) + 1;
}

export function finishPackageSummary(acc: PackageSummaryAcc): MountSummary {
  return { packages: acc.packages, locations: acc.locations.size, holds: acc.holds, by_category: acc.byCategory, lab: acc.lab };
}

export function summarizePackages(rows: MetrcPackageRow[]): MountSummary {
  const acc = packageSummaryAcc();
  for (const r of rows) accumulatePackage(acc, r);
  return finishPackageSummary(acc);
}

/* ------------------------------------------------------- the file scan */

/** THE SLICED MOUNT (canon 0.30.42). The owner's screenshot of 2026-09-11,
 * 23:50 UTC, Error 1102 "Worker exceeded resource limits", "On the third export
 * mounting": one request that parsed, diffed and wrote a whole plants export
 * passed the Worker's ceiling. So the drop page sends the same file in rounds
 * of METRC_SLICE_ROWS rows, each round its own request: the file streams once
 * per round, every row is read (the tags seen and the summary total the whole
 * file) but only the window's rows are kept, diffed and written; the mount row
 * is written on the first round with its counts growing per round; gone rows
 * and the summary land on the last. A browser without the script posts once
 * and the Worker walks the whole file in that one request, as before. */
export const METRC_SLICE_ROWS = 5000;
const SLICE_MIN = 100;
const SLICE_MAX = 20000;

export type MountScan = {
  header: string[];
  format: "xlsx" | "csv";
  kind: MetrcKind;
  /** Data rows in the file (blank rows skipped, blank tags counted). */
  total: number;
  /** Every tag the file carries, whatever the window. */
  seen: Set<string>;
  /** The window's rows, a tag listed twice keeping its last row. */
  plants: MetrcPlantRow[];
  packages: MetrcPackageRow[];
  /** Over the whole file, each tag counted once. */
  summary: MountSummary;
};

/** One streaming pass over the export. Rows with index in [start, end) are kept;
 * every row feeds the seen set and the summary. */
export async function scanMetrcExport(bytes: Uint8Array, start: number, end: number): Promise<MountScan> {
  let kind: MetrcKind | null = null;
  let get: Getter = () => "";
  const seen = new Set<string>();
  const plants = new Map<string, MetrcPlantRow>();
  const packages = new Map<string, MetrcPackageRow>();
  const plantAcc = plantSummaryAcc();
  const packageAcc = packageSummaryAcc();
  const result = await streamMetrcGrid(
    bytes,
    (header) => {
      kind = detectMetrcKind(header);
      if (!kind) {
        throw new HttpError(400, "That grid is not METRC's plants or packages export (no Tag with Plant Batch, or Item and Category).");
      }
      get = indexer(header);
    },
    (cells, index) => {
      const inWindow = index >= start && index < end;
      if (kind === "plants") {
        const row = shapePlantRow(get, cells);
        if (!row) return;
        if (!seen.has(row.tag)) {
          seen.add(row.tag);
          accumulatePlant(plantAcc, row);
        }
        if (inWindow) plants.set(row.tag, row);
      } else {
        const row = shapePackageRow(get, cells);
        if (!row) return;
        if (!seen.has(row.tag)) {
          seen.add(row.tag);
          accumulatePackage(packageAcc, row);
        }
        if (inWindow) packages.set(row.tag, row);
      }
    }
  );
  if (!kind) throw new HttpError(400, "That file is empty.");
  const k: MetrcKind = kind;
  return {
    header: result.header,
    format: result.format,
    kind: k,
    total: result.total,
    seen,
    plants: [...plants.values()],
    packages: [...packages.values()],
    summary: k === "plants" ? finishPlantSummary(plantAcc) : finishPackageSummary(packageAcc),
  };
}

/* ------------------------------------------------------------ the mount */

/** The window's existing rows by tag, every license and phase: a tag known
 * under another license or phase updates instead of colliding on insert. */
async function loadExistingByTags(db: D1Database, kind: MetrcKind, tags: string[]): Promise<ExistingRow[]> {
  if (tags.length === 0) return [];
  const table = kind === "plants" ? "metrc_plants" : "metrc_packages";
  const cols = kind === "plants" ? ["tag", "license_value", "phase", "gone_at", ...PLANT_COLS] : ["tag", "license_value", "gone_at", ...PACKAGE_COLS];
  const stmts = chunkRows(tags, D1_MAX_PARAMS - 1).map((chunk) => {
    const marks = chunk.map(() => "?").join(", ");
    return db.prepare(`SELECT ${cols.join(", ")} FROM ${table} WHERE tag IN (${marks})`).bind(...chunk);
  });
  const out: ExistingRow[] = [];
  for (let i = 0; i < stmts.length; i += METRC_MOUNT_CHUNK) {
    const results = await db.batch<ExistingRow>(stmts.slice(i, i + METRC_MOUNT_CHUNK));
    for (const r of results) out.push(...(r.results ?? []));
  }
  return out;
}

/** The tags the mirror still holds live under the license (and phase). */
async function loadLiveTags(db: D1Database, kind: MetrcKind, license: string, phase: string | null): Promise<string[]> {
  const table = kind === "plants" ? "metrc_plants" : "metrc_packages";
  const stmt =
    kind === "plants"
      ? db.prepare(`SELECT tag FROM ${table} WHERE license_value = ? AND phase = ? AND gone_at IS NULL`).bind(license, phase)
      : db.prepare(`SELECT tag FROM ${table} WHERE license_value = ? AND gone_at IS NULL`).bind(license);
  const result = await stmt.all<{ tag: string }>();
  return (result.results ?? []).map((r) => r.tag);
}

function plantInsertStmts(
  db: D1Database,
  rows: MetrcPlantRow[],
  license: string,
  phase: string,
  mountId: string,
  ts: string
): D1PreparedStatement[] {
  const cols = ["tag", "license_value", "phase", ...PLANT_COLS, "mount_id", "first_seen_at", "changed_at"];
  const per = rowsPerInsert(cols.length);
  return chunkRows(rows, per).map((chunk) => {
    const marks = chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");
    const values: unknown[] = [];
    for (const r of chunk) {
      values.push(r.tag, license, phase);
      for (const c of PLANT_COLS) values.push(r[c]);
      values.push(mountId, ts, ts);
    }
    return db.prepare(`INSERT INTO metrc_plants (${cols.join(", ")}) VALUES ${marks}`).bind(...values);
  });
}

function plantUpdateStmt(
  db: D1Database,
  r: MetrcPlantRow,
  license: string,
  phase: string,
  mountId: string,
  ts: string
): D1PreparedStatement {
  const sets = [
    "license_value = ?",
    "phase = ?",
    ...PLANT_COLS.map((c) => `${c} = ?`),
    "mount_id = ?",
    "changed_at = ?",
    "gone_at = NULL",
    "gone_mount_id = NULL",
  ];
  const values: unknown[] = [license, phase];
  for (const c of PLANT_COLS) values.push(r[c]);
  values.push(mountId, ts, r.tag);
  return db.prepare(`UPDATE metrc_plants SET ${sets.join(", ")} WHERE tag = ?`).bind(...values);
}

function packageInsertStmts(
  db: D1Database,
  rows: MetrcPackageRow[],
  license: string,
  mountId: string,
  ts: string
): D1PreparedStatement[] {
  const cols = ["tag", "license_value", ...PACKAGE_COLS, "mount_id", "first_seen_at", "changed_at"];
  const per = rowsPerInsert(cols.length);
  return chunkRows(rows, per).map((chunk) => {
    const marks = chunk.map(() => `(${cols.map(() => "?").join(", ")})`).join(", ");
    const values: unknown[] = [];
    for (const r of chunk) {
      values.push(r.tag, license);
      for (const c of PACKAGE_COLS) values.push(r[c]);
      values.push(mountId, ts, ts);
    }
    return db.prepare(`INSERT INTO metrc_packages (${cols.join(", ")}) VALUES ${marks}`).bind(...values);
  });
}

function packageUpdateStmt(db: D1Database, r: MetrcPackageRow, license: string, mountId: string, ts: string): D1PreparedStatement {
  const sets = [
    "license_value = ?",
    ...PACKAGE_COLS.map((c) => `${c} = ?`),
    "mount_id = ?",
    "changed_at = ?",
    "gone_at = NULL",
    "gone_mount_id = NULL",
  ];
  const values: unknown[] = [license];
  for (const c of PACKAGE_COLS) values.push(r[c]);
  values.push(mountId, ts, r.tag);
  return db.prepare(`UPDATE metrc_packages SET ${sets.join(", ")} WHERE tag = ?`).bind(...values);
}

function goneStmts(db: D1Database, table: string, tags: string[], mountId: string, ts: string): D1PreparedStatement[] {
  const per = D1_MAX_PARAMS - 2;
  return chunkRows(tags, per).map((chunk) => {
    const marks = chunk.map(() => "?").join(", ");
    return db
      .prepare(`UPDATE ${table} SET gone_at = ?, gone_mount_id = ? WHERE tag IN (${marks}) AND gone_at IS NULL`)
      .bind(ts, mountId, ...chunk);
  });
}

async function runChunked(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < stmts.length; i += METRC_MOUNT_CHUNK) {
    await db.batch(stmts.slice(i, i + METRC_MOUNT_CHUNK));
  }
}

export type MountResult = {
  id: string;
  kind: MetrcKind;
  phase: string | null;
  license: string;
  rows_total: number;
  rows_added: number;
  rows_updated: number;
  rows_unchanged: number;
  rows_gone: number;
};

/** One round's answer to the drop page's script. Counts are the mount's so far. */
export type MountRound = {
  ok: true;
  mount_id: string;
  kind: MetrcKind;
  phase: string | null;
  license: string;
  total: number;
  /** The first row index of the next round; total when done. */
  next: number;
  done: boolean;
  added: number;
  updated: number;
  unchanged: number;
  gone: number;
  /** THE MIRROR CLOSES THE LEDGER (canon 0.30.128): the ledger items and the queue packages closed once the mount landed. */
  closed: number;
  closed_packages: number;
  /** THE MIRROR RELEASES THE QUEUE (canon 0.30.193). Zero on a plants mount. */
  released: number;
  released_passed: number;
  released_failed: number;
  /** THE FFZ INVENTORY (canon 0.30.225): fresh frozen packages landed at the Blast Freezer. */
  landed: number;
  redirect: string;
};

type MountHead = {
  actor: { id: string };
  file: File;
  bytes: Uint8Array;
  license: string;
  named: MetrcFilenameRead;
  phaseAsked: string | null;
};

type MountRowState = {
  id: string;
  kind: MetrcKind;
  phase: string | null;
  license_value: string;
  rows_total: number;
  rows_added: number;
  rows_updated: number;
  rows_unchanged: number;
};

/** What every round reads from the form before the file is scanned. */
async function mountHead(db: D1Database, form: FormData): Promise<MountHead> {
  const actor = await requireActor(db, String(form.get("person_id") ?? "").trim() || null);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new HttpError(400, "Drop a METRC export (xlsx or csv) first.");
  }
  const named = parseMetrcFilename(file.name);
  const license = (textOrNull(form.get("license_value")) ?? named.license ?? "").trim();
  if (!license) {
    throw new HttpError(400, "The file name carries no license; pick one on the form.");
  }
  if (!isKnownSiteLicense(license)) {
    throw new HttpError(400, `Unknown license ${license}; the mirror knows the seven site lines.`);
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  return { actor, file, bytes, license, named, phaseAsked: textOrNull(form.get("phase")) };
}

function resolvePhase(head: MountHead, kind: MetrcKind): string | null {
  if (kind !== "plants") return null;
  const phase = phaseFromGrid(head.phaseAsked ?? head.named.grid);
  if (!phase) throw new HttpError(400, "Say which phase this plants file is (flowering or vegetative).");
  return phase;
}

function checkKind(head: MountHead, kind: MetrcKind): void {
  if (head.named.kind && head.named.kind !== kind) {
    throw new HttpError(400, `The file name says ${head.named.kind} but the grid is ${kind}.`);
  }
}

/** THE MIRROR CLOSES THE LEDGER (canon 0.30.128). Owner, 2026-09-19: "How do
 * I empty my FFZ inventory.  I passed a METRC Mirror for the licenses that
 * material was in, now METRC is showing 0 and the ledger is full"; his picks:
 * the packages were sold or transferred out (the re-mount marked them gone),
 * and the mirror closes the ledger. After every packages mount lands, every
 * live ledger item whose METRC tag the mirror marks gone closes with the
 * reason (deleted_at, deleted_by, delete_reason), and every Testing Queue
 * package whose tag the mirror marks gone leaves the queue as gone; each
 * change lands in record_change_log. A tag the mirror has never seen is
 * untouched (METRC cannot speak for it); a tag that comes back later does not
 * reopen anything by itself. Returns the counts for the flash. */
export async function closeLedgerForGoneTags(
  db: D1Database,
  actorId: string,
  mountId: string,
  ts: string
): Promise<{ items: number; packages: number }> {
  const reason = `${SYSTEM_REASON.gone_in_metrc} (mount ${mountId.replaceAll("-", "").slice(0, 8)})`;
  const items = await db
    .prepare(
      `SELECT i.id, i.metrc_tag, i.qty, i.location
       FROM local_inventory_items i
       JOIN metrc_packages m ON m.tag = UPPER(TRIM(i.metrc_tag))
       WHERE i.deleted_at IS NULL AND TRIM(COALESCE(i.metrc_tag, '')) <> '' AND m.gone_at IS NOT NULL`
    )
    .all<{ id: string; metrc_tag: string; qty: number; location: string | null }>();
  const packages = await db
    .prepare(
      `SELECT p.id, p.package_code, p.status
       FROM wip_packages p
       JOIN metrc_packages m ON m.tag = UPPER(TRIM(p.package_code))
       WHERE p.deleted_at IS NULL AND p.status = ? AND m.gone_at IS NOT NULL`
    )
    .bind(WIP_STATUS.testing_queue)
    .all<{ id: string; package_code: string; status: string }>();
  const stmts: D1PreparedStatement[] = [];
  for (const item of items.results ?? []) {
    stmts.push(
      db
        .prepare(
          `UPDATE local_inventory_items SET deleted_at = ?, deleted_by = ?, delete_reason = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(ts, actorId, reason, ts, actorId, item.id),
      insertLog(db, {
        record_table: "local_inventory_items",
        record_id: item.id,
        field: "deleted_at",
        old_value: null,
        new_value: ts,
        actor_person_id: actorId,
        reason,
        changed_at: ts,
      })
    );
  }
  for (const pkg of packages.results ?? []) {
    stmts.push(
      db
        .prepare(`UPDATE wip_packages SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL AND status = ?`)
        .bind(WIP_STATUS.gone, ts, actorId, pkg.id, pkg.status),
      insertLog(db, {
        record_table: "wip_packages",
        record_id: pkg.id,
        field: "status",
        old_value: pkg.status,
        new_value: WIP_STATUS.gone,
        actor_person_id: actorId,
        reason,
        changed_at: ts,
      })
    );
  }
  if (stmts.length > 0) await runChunked(db, stmts);
  return { items: (items.results ?? []).length, packages: (packages.results ?? []).length };
}

/** THE FFZ INVENTORY (canon 0.30.225). After a packages mount lands whole, every
 * active fresh-frozen package the ledger does not already bear (live or closed)
 * lands as one finished-goods item at the Blast Freezer. A second mount of the
 * same file lands nothing. */
export async function landFfzFromMirror(db: D1Database, actorId: string, mountId: string, ts: string): Promise<number> {
  const kinds = parseFfzItemKinds(await getConfigValue(db, CONFIG_KEYS.ffz_item_kinds));
  const kindList = kinds.length > 0 ? kinds : ["FFZ"];
  const where = kindList.map(() => ffzKindClause("m")).join(" OR ");
  const rows = await db
    .prepare(
      `SELECT m.tag, m.quantity, m.uom, m.license_value, m.item_strain
       FROM metrc_packages m
       WHERE m.gone_at IS NULL
         AND LOWER(TRIM(COALESCE(m.uom, ''))) IN ('g', 'grams', 'gram')
         AND m.quantity IS NOT NULL
         AND (${where})
         AND NOT EXISTS (
           SELECT 1 FROM local_inventory_items i
           WHERE UPPER(TRIM(COALESCE(i.metrc_tag, ''))) = UPPER(TRIM(m.tag))
         )`
    )
    .bind(...ffzKindBinds(kindList))
    .all<{ tag: string; quantity: number | null; uom: string | null; license_value: string; item_strain: string | null }>();
  const eight = mountId.replaceAll("-", "").slice(0, 8);
  const reason = `${SYSTEM_REASON.ffz_from_mirror} (mount ${eight})`;
  const stmts: D1PreparedStatement[] = [];
  let landed = 0;
  for (const row of rows.results ?? []) {
    const qty = roundGrams(Number(row.quantity));
    if (!Number.isFinite(qty)) continue;
    const tag = String(row.tag ?? "").trim().toUpperCase();
    if (!tag) continue;
    const strainName = String(row.item_strain ?? "").trim();
    let strainId: string | null = null;
    if (strainName) {
      const strains = await db
        .prepare(`SELECT id FROM strains WHERE deleted_at IS NULL AND UPPER(TRIM(name)) = UPPER(TRIM(?))`)
        .bind(strainName)
        .all<{ id: string }>();
      const found = strains.results ?? [];
      if (found.length === 1) strainId = found[0].id;
    }
    const id = crypto.randomUUID();
    const farm = siteOfLicense(row.license_value) ?? "PNN";
    const record = {
      id,
      item_kind: ITEM_KIND_FG,
      package_code: tag,
      metrc_tag: tag,
      strain_id: strainId,
      qty,
      uom: "g",
      farm_code: farm,
      license_value: row.license_value,
      location: LOC_BLAST_FREEZER,
      created_at: ts,
      created_by: actorId,
      updated_at: ts,
      updated_by: actorId,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO local_inventory_items (
            id, item_kind, package_code, metrc_tag, harvest_batch_id, wet_weight_entry_id, wip_package_id,
            strain_id, qty, uom, farm_code, license_value, location,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
          ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 'g', ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(id, ITEM_KIND_FG, tag, tag, strainId, qty, farm, row.license_value, LOC_BLAST_FREEZER, ts, actorId, ts, actorId),
      ...logsForInsert(db, "local_inventory_items", id, record, actorId, reason, ts)
    );
    landed += 1;
  }
  if (stmts.length > 0) await runChunked(db, stmts);
  return landed;
}

export type MirrorRelease = { total: number; passed: number; failed: number };

/** THE MIRROR RELEASES THE QUEUE (canon 0.30.193). A Testing Queue package
 * whose live mirror row names a release state leaves the queue. A state that
 * is not in the vocabulary stays. A gone row is not a live row. */
export async function releaseTestedFromMirror(db: D1Database, actorId: string | null, mountId: string, ts: string): Promise<MirrorRelease> {
  const vocab = parseMetrcReleaseStates(await getConfigValue(db, CONFIG_KEYS.metrc_release_states));
  const eight = mountId.replaceAll("-", "").slice(0, 8);
  const rows = await db
    .prepare(
      `SELECT p.id, p.status, p.test_outcome,
              COALESCE(
                (SELECT m.lab_test_status FROM metrc_packages m
                  WHERE m.gone_at IS NULL AND m.tag = UPPER(TRIM(p.package_code)) LIMIT 1),
                (SELECT m.lab_test_status FROM metrc_packages m
                  JOIN local_inventory_items i ON i.deleted_at IS NULL AND i.wip_package_id = p.id
                    AND m.tag = UPPER(TRIM(i.metrc_tag))
                  WHERE m.gone_at IS NULL LIMIT 1)
              ) AS lab_state
       FROM wip_packages p
       WHERE p.deleted_at IS NULL AND p.status = ?`
    )
    .bind(WIP_STATUS.testing_queue)
    .all<{ id: string; status: string; test_outcome: string | null; lab_state: string | null }>();
  const stmts: D1PreparedStatement[] = [];
  let passed = 0;
  let failed = 0;
  for (const row of rows.results ?? []) {
    const state = String(row.lab_state ?? "").trim();
    const outcome = vocab.get(state.toLowerCase());
    if (!state || !outcome) continue;
    let next: string;
    try {
      next = applyTransition("released", row.status);
    } catch {
      continue;
    }
    const reason = `${SYSTEM_REASON.metrc_release}: ${state} (mount ${eight})`;
    stmts.push(
      db
        .prepare(
          `UPDATE wip_packages SET status = ?, test_outcome = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL AND status = ?`
        )
        .bind(next, outcome, ts, actorId, row.id, row.status),
      insertLog(db, {
        record_table: "wip_packages",
        record_id: row.id,
        field: "status",
        old_value: row.status,
        new_value: next,
        actor_person_id: actorId,
        reason,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "wip_packages",
        record_id: row.id,
        field: "test_outcome",
        old_value: row.test_outcome,
        new_value: outcome,
        actor_person_id: actorId,
        reason,
        changed_at: ts,
      })
    );
    if (outcome === "passed") passed += 1;
    else if (outcome === "failed") failed += 1;
  }
  if (stmts.length > 0) await runChunked(db, stmts);
  return { total: passed + failed, passed, failed };
}

function mountedRedirect(
  mountId: string,
  kind: MetrcKind,
  added: number,
  updated: number,
  gone: number,
  closed: { items: number; packages: number } = { items: 0, packages: 0 },
  released: MirrorRelease = { total: 0, passed: 0, failed: 0 },
  landed = 0
): string {
  const q = new URLSearchParams({
    pane: "metrc",
    ok: "mounted",
    mount: mountId,
    kind,
    added: String(added),
    updated: String(updated),
    gone: String(gone),
    closed: String(closed.items),
    closed_packages: String(closed.packages),
    released: String(released.total),
    released_passed: String(released.passed),
    released_failed: String(released.failed),
    landed: String(landed),
  });
  return `/inventory/metrc?${q.toString()}`;
}

function mountRowInsert(
  db: D1Database,
  head: MountHead,
  scan: MountScan,
  phase: string | null,
  mountId: string,
  ts: string
): D1PreparedStatement[] {
  const record = {
    id: mountId,
    kind: scan.kind,
    phase,
    license_value: head.license,
    filename: head.file.name,
    file_format: scan.format,
    rows_total: scan.total,
    created_at: ts,
    created_by: head.actor.id,
  };
  return [
    db
      .prepare(
        `INSERT INTO metrc_mounts (
          id, kind, phase, license_value, filename, file_format, rows_total, rows_added, rows_updated,
          rows_unchanged, rows_gone, summary, created_at, created_by, updated_at, updated_by,
          deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(
        mountId,
        scan.kind,
        phase,
        head.license,
        head.file.name,
        scan.format,
        scan.total,
        JSON.stringify({ mounting: true, rows_done: 0 }),
        ts,
        head.actor.id,
        ts,
        head.actor.id
      ),
    ...logsForInsert(db, "metrc_mounts", mountId, record, head.actor.id, SYSTEM_REASON.metrc_mount, ts),
  ];
}

/** The mount row of a round after the first, checked against this round's file. */
async function mountRowFor(db: D1Database, mountId: string, head: MountHead, scan: MountScan, phase: string | null): Promise<MountRowState> {
  const row = await db
    .prepare(
      `SELECT id, kind, phase, license_value, rows_total, rows_added, rows_updated, rows_unchanged
       FROM metrc_mounts WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(mountId)
    .first<MountRowState>();
  if (!row) throw new HttpError(404, "That mount is not on record; start the drop again.");
  if (row.kind !== scan.kind || row.license_value !== head.license || !same(row.phase, phase)) {
    throw new HttpError(400, "That round belongs to a different drop (kind, license or phase changed); start again.");
  }
  if (Number(row.rows_total) !== scan.total) {
    throw new HttpError(400, `That is not the file this drop started with (${row.rows_total} rows then, ${scan.total} now); start again.`);
  }
  return { ...row, rows_added: Number(row.rows_added), rows_updated: Number(row.rows_updated), rows_unchanged: Number(row.rows_unchanged) };
}

/** Diff the window against the mirror and write it, the mount row's counts
 * growing in the same final batch; on the last round the gone rows, the
 * summary and the count logs land too. Returns the mount's counts so far. */
async function writeMountWindow(
  db: D1Database,
  head: MountHead,
  scan: MountScan,
  phase: string | null,
  mountId: string,
  before: { added: number; updated: number; unchanged: number },
  lead: D1PreparedStatement[],
  done: boolean,
  next: number,
  ts: string
): Promise<{ added: number; updated: number; unchanged: number; gone: number }> {
  const stmts: D1PreparedStatement[] = [...lead];
  let roundAdded = 0;
  let roundUpdated = 0;
  let roundUnchanged = 0;
  if (scan.kind === "plants") {
    const existing = await loadExistingByTags(db, "plants", scan.plants.map((r) => r.tag));
    const diff = diffMount(scan.plants, existing, PLANT_COLS, { phase, license: head.license });
    stmts.push(...plantInsertStmts(db, diff.added, head.license, phase ?? "", mountId, ts));
    for (const r of diff.updated) stmts.push(plantUpdateStmt(db, r, head.license, phase ?? "", mountId, ts));
    roundAdded = diff.added.length;
    roundUpdated = diff.updated.length;
    roundUnchanged = diff.unchanged;
  } else {
    const existing = await loadExistingByTags(db, "packages", scan.packages.map((r) => r.tag));
    const diff = diffMount(scan.packages, existing, PACKAGE_COLS, { license: head.license });
    stmts.push(...packageInsertStmts(db, diff.added, head.license, mountId, ts));
    for (const r of diff.updated) stmts.push(packageUpdateStmt(db, r, head.license, mountId, ts));
    roundAdded = diff.added.length;
    roundUpdated = diff.updated.length;
    roundUnchanged = diff.unchanged;
  }
  const counts = {
    added: before.added + roundAdded,
    updated: before.updated + roundUpdated,
    unchanged: before.unchanged + roundUnchanged,
    gone: 0,
  };
  if (done) {
    const live = await loadLiveTags(db, scan.kind, head.license, phase);
    const gone = live.filter((tag) => !scan.seen.has(tag));
    stmts.push(...goneStmts(db, scan.kind === "plants" ? "metrc_plants" : "metrc_packages", gone, mountId, ts));
    counts.gone = gone.length;
  }
  stmts.push(
    db
      .prepare(
        `UPDATE metrc_mounts SET rows_added = ?, rows_updated = ?, rows_unchanged = ?, rows_gone = ?,
         summary = ?, updated_at = ?, updated_by = ? WHERE id = ?`
      )
      .bind(
        counts.added,
        counts.updated,
        counts.unchanged,
        counts.gone,
        JSON.stringify(done ? scan.summary : { mounting: true, rows_done: next }),
        ts,
        head.actor.id,
        mountId
      )
  );
  if (done) {
    const finals: Record<string, number> = {
      rows_added: counts.added,
      rows_updated: counts.updated,
      rows_unchanged: counts.unchanged,
      rows_gone: counts.gone,
    };
    for (const [field, value] of Object.entries(finals)) {
      stmts.push(
        insertLog(db, {
          record_table: "metrc_mounts",
          record_id: mountId,
          field,
          old_value: null,
          new_value: String(value),
          actor_person_id: head.actor.id,
          reason: SYSTEM_REASON.metrc_mount,
          changed_at: ts,
        })
      );
    }
  }
  // The mount row leads so a chunk that fails leaves the drop on record; the
  // counts trail in the last batch so they never run ahead of the rows.
  await runChunked(db, stmts);
  return counts;
}

function sliceSize(form: FormData): number {
  const raw = Number(String(form.get("slice_size") ?? "").trim());
  if (!Number.isFinite(raw) || raw <= 0) return METRC_SLICE_ROWS;
  return Math.min(SLICE_MAX, Math.max(SLICE_MIN, Math.floor(raw)));
}

/** True when the form is one of the drop page's rounds (it carries slice). */
export function isMountRound(form: FormData): boolean {
  return form.has("slice");
}

/** One round of the sliced mount: rows [slice, slice + slice_size) of the file,
 * the mount row written on round zero and carried by mount_id after. */
export async function mountMetrcRound(db: D1Database, form: FormData): Promise<MountRound> {
  const head = await mountHead(db, form);
  const sliceRaw = Number(String(form.get("slice") ?? "0").trim());
  if (!Number.isInteger(sliceRaw) || sliceRaw < 0) throw new HttpError(400, "The round's slice must be a whole number of rows.");
  const size = sliceSize(form);
  const start = sliceRaw;
  const end = start + size;
  const scan = await scanMetrcExport(head.bytes, start, end);
  checkKind(head, scan.kind);
  const phase = resolvePhase(head, scan.kind);
  const ts = nowIso();
  let mountId: string;
  let before = { added: 0, updated: 0, unchanged: 0 };
  let lead: D1PreparedStatement[] = [];
  if (start === 0) {
    mountId = crypto.randomUUID();
    lead = mountRowInsert(db, head, scan, phase, mountId, ts);
  } else {
    mountId = String(form.get("mount_id") ?? "").trim();
    if (!mountId) throw new HttpError(400, "A round after the first must name its mount.");
    const row = await mountRowFor(db, mountId, head, scan, phase);
    before = { added: row.rows_added, updated: row.rows_updated, unchanged: row.rows_unchanged };
  }
  const next = Math.min(end, scan.total);
  const done = next >= scan.total;
  const counts = await writeMountWindow(db, head, scan, phase, mountId, before, lead, done, next, ts);
  // THE MIRROR CLOSES THE LEDGER (canon 0.30.128): once a packages mount has landed whole.
  const closed = done && scan.kind === "packages" ? await closeLedgerForGoneTags(db, head.actor.id, mountId, ts) : { items: 0, packages: 0 };
  const landed = done && scan.kind === "packages" ? await landFfzFromMirror(db, head.actor.id, mountId, ts) : 0;
  const released = done && scan.kind === "packages" ? await releaseTestedFromMirror(db, head.actor.id, mountId, ts) : { total: 0, passed: 0, failed: 0 };
  return {
    ok: true,
    mount_id: mountId,
    kind: scan.kind,
    phase,
    license: head.license,
    total: scan.total,
    next,
    done,
    added: counts.added,
    updated: counts.updated,
    unchanged: counts.unchanged,
    gone: counts.gone,
    closed: closed.items,
    closed_packages: closed.packages,
    released: released.total,
    released_passed: released.passed,
    released_failed: released.failed,
    landed,
    redirect: mountedRedirect(mountId, scan.kind, counts.added, counts.updated, counts.gone, closed, released, landed),
  };
}

/** The drop in one request (a browser without the script): the whole file is
 * one window, scanned once. The file is read by its bytes (xlsx or CSV), its
 * license from the file name unless the form names one, its kind from the
 * header, its phase (plants) from the name unless the form names one. */
export async function mountMetrcExport(db: D1Database, form: FormData): Promise<ActionOk> {
  const head = await mountHead(db, form);
  const scan = await scanMetrcExport(head.bytes, 0, Number.MAX_SAFE_INTEGER);
  checkKind(head, scan.kind);
  const phase = resolvePhase(head, scan.kind);
  const ts = nowIso();
  const mountId = crypto.randomUUID();
  const lead = mountRowInsert(db, head, scan, phase, mountId, ts);
  const counts = await writeMountWindow(db, head, scan, phase, mountId, { added: 0, updated: 0, unchanged: 0 }, lead, true, scan.total, ts);
  // THE MIRROR CLOSES THE LEDGER (canon 0.30.128): the packages mount has landed whole.
  const closed = scan.kind === "packages" ? await closeLedgerForGoneTags(db, head.actor.id, mountId, ts) : { items: 0, packages: 0 };
  const landed = scan.kind === "packages" ? await landFfzFromMirror(db, head.actor.id, mountId, ts) : 0;
  const released = scan.kind === "packages" ? await releaseTestedFromMirror(db, head.actor.id, mountId, ts) : { total: 0, passed: 0, failed: 0 };
  return { redirect: mountedRedirect(mountId, scan.kind, counts.added, counts.updated, counts.gone, closed, released, landed) };
}

/* ------------------------------------------------------------ readers */

export type MetrcMountRow = {
  id: string;
  kind: MetrcKind;
  phase: string | null;
  license_value: string;
  filename: string;
  file_format: string;
  rows_total: number;
  rows_added: number;
  rows_updated: number;
  rows_unchanged: number;
  rows_gone: number;
  summary: string;
  created_at: string;
};

export async function listMetrcMounts(db: D1Database, limit = 40): Promise<MetrcMountRow[]> {
  const result = await db
    .prepare(
      `SELECT id, kind, phase, license_value, filename, file_format, rows_total, rows_added, rows_updated,
              rows_unchanged, rows_gone, summary, created_at
       FROM metrc_mounts WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`
    )
    .bind(limit)
    .all<MetrcMountRow>();
  return result.results ?? [];
}

export type MetrcLicenseLine = {
  license_value: string;
  plants_flowering: number;
  plants_vegetative: number;
  plants_other: number;
  packages: number;
  package_grams: number;
  package_eaches: number;
  newest_mount: string | null;
};

/** What the mirror holds per license today (gone rows excluded). */
export async function metrcLicenseLines(db: D1Database): Promise<MetrcLicenseLine[]> {
  const plants = await db
    .prepare(
      `SELECT license_value, phase, COUNT(*) AS n FROM metrc_plants
       WHERE gone_at IS NULL GROUP BY license_value, phase`
    )
    .all<{ license_value: string; phase: string; n: number }>();
  const packages = await db
    .prepare(
      `SELECT license_value, uom, COUNT(*) AS n, SUM(COALESCE(quantity, 0)) AS q FROM metrc_packages
       WHERE gone_at IS NULL GROUP BY license_value, uom`
    )
    .all<{ license_value: string; uom: string | null; n: number; q: number }>();
  const mounts = await db
    .prepare(`SELECT license_value, MAX(created_at) AS newest FROM metrc_mounts WHERE deleted_at IS NULL GROUP BY license_value`)
    .all<{ license_value: string; newest: string }>();
  const lines = new Map<string, MetrcLicenseLine>();
  const line = (lic: string) => {
    let l = lines.get(lic);
    if (!l) {
      l = {
        license_value: lic,
        plants_flowering: 0,
        plants_vegetative: 0,
        plants_other: 0,
        packages: 0,
        package_grams: 0,
        package_eaches: 0,
        newest_mount: null,
      };
      lines.set(lic, l);
    }
    return l;
  };
  for (const p of plants.results ?? []) {
    const l = line(p.license_value);
    if (p.phase === "flowering") l.plants_flowering += Number(p.n);
    else if (p.phase === "vegetative") l.plants_vegetative += Number(p.n);
    else l.plants_other += Number(p.n);
  }
  for (const k of packages.results ?? []) {
    const l = line(k.license_value);
    l.packages += Number(k.n);
    const uom = String(k.uom ?? "").toLowerCase();
    if (uom === "g" || uom === "grams") l.package_grams = metrcQuantity(l.package_grams + Number(k.q));
    else if (uom === "ea" || uom === "each") l.package_eaches += Number(k.q);
  }
  for (const m of mounts.results ?? []) line(m.license_value).newest_mount = m.newest;
  return [...lines.values()].sort((a, b) => a.license_value.localeCompare(b.license_value));
}

/* ------------------------------------------- FG inventory in METRC */

/** FG INVENTORY IN METRC (canon 0.30.43). Owner, 2026-09-11, with a screenshot
 * of the Zoho-fed FG INVENTORY pane on /inventory: "Change this pane to "FG
 * INVENTORY IN METRC" It should reflect the inventories correctly here". His
 * pick on the Scribe's fork: "By item kind (Recommended)". The pane reads the
 * mirror's active packages, every license together, grouped by the first word
 * of METRC's Item name (MIX, BUD, MOB, GRIP Vape, Infused Pre-Rolls...), grams
 * and eaches kept apart, each kind opening to its items. */

/** The kind is the Item name's first segment: "BUD - Donny Burger - PNS - O"
 * reads BUD; "GRIP Vape - Elsewhere - 2g" reads GRIP Vape. */
export function metrcItemKind(item: string | null | undefined): string {
  const s = String(item ?? "").trim();
  if (!s) return "(no item)";
  const first = s.split(" - ")[0].trim();
  return first || s;
}

/** METRC's units folded to the app's two words, g and ea; anything else as it came. */
export type MetrcAdoptRow = {
  tag: string;
  kind: string;
  strain: string;
  grams: number;
  location: string;
  license: string;
  /** THE HBN INHERITED (canon 0.30.196): the harvest METRC's lineage names, or null when it names none. */
  harvest: string | null;
  /** The app's batch for that harvest; null when the harvest is new from METRC. */
  hbnId: string | null;
  /** The heading this stranger files under: the batch's grow method, else the method its HBN code names. Null is Unknown. */
  growMethod: string | null;
  packagedDate: string | null;
};

export type MetrcAdoptPane = { rows: MetrcAdoptRow[] };

/** Comma or semicolon separated METRC lists. */
export function harvestTokens(raw: string | null | undefined): string[] {
  return String(raw ?? "")
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The harvest a stranger inherits: its own Source Harvest, else the Source
 * Harvest of one source package in the mirror. No further hop. Among several
 * names the first the app knows wins, else the first named. */
export function inheritedHarvest(
  row: { sourceHarvests: string | null; sourcePackages: string | null },
  byTag: ReadonlyMap<string, { sourceHarvests: string | null }>,
  known: ReadonlyMap<string, string>
): { harvest: string; hbnId: string | null } | null {
  const pick = (raw: string | null | undefined): { harvest: string; hbnId: string | null } | null => {
    const names = harvestTokens(raw).map((name) => name.toUpperCase());
    if (names.length === 0) return null;
    const hit = names.find((name) => known.has(name));
    return hit ? { harvest: hit, hbnId: known.get(hit) ?? null } : { harvest: names[0], hbnId: null };
  };
  const direct = pick(row.sourceHarvests);
  if (direct) return direct;
  for (const tag of harvestTokens(row.sourcePackages)) {
    const hop = pick(byTag.get(tag.toUpperCase())?.sourceHarvests);
    if (hop) return hop;
  }
  return null;
}

/** The grow heading a stranger files under. A known batch uses that batch's
 * display name. Otherwise the live method whose hbn_code matches the code
 * parseHbn reads. Null (Unknown) when there is no harvest, the harvest is not
 * a seven-part HBN, or no live method carries the code. */
export function adoptGrowMethod(
  row: { harvest: string | null; hbnId: string | null },
  batchMethod: ReadonlyMap<string, string | null>,
  methods: readonly { display_name: string; hbn_code: string }[]
): string | null {
  if (row.hbnId) {
    const named = String(batchMethod.get(row.hbnId) ?? "").trim();
    return named || null;
  }
  if (!row.harvest) return null;
  const parts = parseHbn(row.harvest);
  if (!parts) return null;
  const code = parts.grow_code.trim().toUpperCase();
  const hit = methods.find((method) => method.hbn_code.trim().toUpperCase() === code);
  const name = String(hit?.display_name ?? "").trim();
  return name || null;
}

function adoptStrain(item: string | null, named: string | null): string {
  const strain = String(named ?? "").trim();
  if (strain) return strain;
  return (String(item ?? "").split(" - ")[1] ?? "").trim();
}

export async function listMetrcAdoptions(db: D1Database): Promise<MetrcAdoptPane> {
  const categories = parseCryoTypeCategories(await getConfigValue(db, CONFIG_KEYS.cryo_type_categories));
  const vocab = parseMetrcReleaseStates(await getConfigValue(db, CONFIG_KEYS.metrc_release_states));
  const [mirror, batches, methods, takenPackages, takenItems] = await Promise.all([
    db
      .prepare(
        `SELECT tag, license_value, source_harvests, source_packages, location, item, item_strain, quantity, uom,
                lab_test_status, packaged_date
         FROM metrc_packages WHERE gone_at IS NULL AND quantity > 0`
      )
      .all<{
        tag: string;
        license_value: string;
        source_harvests: string | null;
        source_packages: string | null;
        location: string | null;
        item: string | null;
        item_strain: string | null;
        quantity: number | null;
        uom: string | null;
        lab_test_status: string | null;
        packaged_date: string | null;
      }>(),
    db
      .prepare(
        `SELECT b.id, b.hbn, gm.display_name AS grow_method
         FROM harvest_batches b
         LEFT JOIN grow_methods gm ON gm.code = b.grow_method_code AND gm.deleted_at IS NULL
         WHERE b.deleted_at IS NULL AND b.hbn IS NOT NULL`
      )
      .all<{ id: string; hbn: string; grow_method: string | null }>(),
    db.prepare(`SELECT display_name, hbn_code FROM grow_methods WHERE deleted_at IS NULL ORDER BY code`).all<{ display_name: string; hbn_code: string }>(),
    db.prepare(`SELECT upper(package_code) AS tag FROM wip_packages WHERE package_code IS NOT NULL`).all<{ tag: string }>(),
    db.prepare(`SELECT upper(metrc_tag) AS tag FROM local_inventory_items WHERE deleted_at IS NULL AND metrc_tag IS NOT NULL AND trim(metrc_tag) <> ''`).all<{ tag: string }>(),
  ]);
  const taken = new Set([...(takenPackages.results ?? []).map((row) => row.tag), ...(takenItems.results ?? []).map((row) => row.tag)]);
  const known = new Map((batches.results ?? []).map((row) => [row.hbn.trim().toUpperCase(), row.id]));
  const batchMethod = new Map((batches.results ?? []).map((row) => [row.id, row.grow_method]));
  const growMethods = methods.results ?? [];
  const candidates = (mirror.results ?? []).filter(
    (row) =>
      !taken.has(row.tag.toUpperCase()) &&
      metrcUomKey(row.uom) === "g" &&
      roundGrams(Number(row.quantity ?? 0)) > 0 &&
      vocab.get(String(row.lab_test_status ?? "").trim().toLowerCase()) === "passed" &&
      isPrepackWpr(metrcItemKind(row.item), categories)
  );
  // The hop reads the source package's row even when METRC has since marked it gone: lineage does not expire.
  const parentTags = [
    ...new Set(
      candidates
        .filter((row) => harvestTokens(row.source_harvests).length === 0)
        .flatMap((row) => harvestTokens(row.source_packages).map((tag) => tag.toUpperCase()))
    ),
  ];
  const byTag = new Map<string, { sourceHarvests: string | null }>();
  for (const chunk of chunkRows(parentTags, D1_MAX_PARAMS)) {
    const found = await db
      .prepare(`SELECT tag, source_harvests FROM metrc_packages WHERE tag IN (${chunk.map(() => "?").join(", ")})`)
      .bind(...chunk)
      .all<{ tag: string; source_harvests: string | null }>();
    for (const parent of found.results ?? []) byTag.set(parent.tag.toUpperCase(), { sourceHarvests: parent.source_harvests });
  }
  const rows: MetrcAdoptRow[] = [];
  for (const row of candidates) {
    const grams = roundGrams(Number(row.quantity ?? 0));
    const lineage = inheritedHarvest({ sourceHarvests: row.source_harvests, sourcePackages: row.source_packages }, byTag, known);
    rows.push({
      tag: row.tag,
      kind: metrcItemKind(row.item),
      strain: adoptStrain(row.item, row.item_strain),
      grams,
      location: String(row.location ?? "").trim(),
      license: row.license_value,
      harvest: lineage?.harvest ?? null,
      hbnId: lineage?.hbnId ?? null,
      growMethod: adoptGrowMethod(
        { harvest: lineage?.harvest ?? null, hbnId: lineage?.hbnId ?? null },
        batchMethod,
        growMethods
      ),
      packagedDate: row.packaged_date,
    });
  }
  rows.sort((a, b) => a.tag.localeCompare(b.tag));
  return { rows };
}

export function metrcUomKey(uom: string | null | undefined): string {
  const u = String(uom ?? "").trim().toLowerCase();
  if (u === "g" || u === "grams" || u === "gram") return "g";
  if (u === "ea" || u === "each" || u === "eaches") return "ea";
  return u || "(none)";
}

export type MetrcFgItem = {
  item: string;
  category: string | null;
  packages: number;
  quantity: number;
  /** Packages whose Lab Test Status is not TestPassed or RetestPassed. */
  not_passed: number;
};

export type MetrcFgKind = {
  kind: string;
  uom: string;
  packages: number;
  quantity: number;
  not_passed: number;
  categories: string[];
  items: MetrcFgItem[];
};

export type MetrcFgLicense = { license_value: string; packages: number; newest_mount: string | null };

export type MetrcFgInventory = {
  /** Kinds measured in grams, largest first. */
  grams: MetrcFgKind[];
  /** Kinds counted in eaches, largest first. */
  eaches: MetrcFgKind[];
  /** Kinds in any other unit, largest first. */
  other: MetrcFgKind[];
  packages: number;
  licenses: MetrcFgLicense[];
  newest_mount: string | null;
};

type FgSourceRow = {
  license_value: string;
  item: string | null;
  category: string | null;
  uom: string | null;
  n: number;
  q: number;
  not_passed: number;
};

/** Shape the grouped rows into kinds; exported so the shaping is testable
 * without a database. */
export function shapeMetrcFg(rows: readonly FgSourceRow[], mounts: ReadonlyArray<{ license_value: string; newest: string | null }>): MetrcFgInventory {
  const kinds = new Map<string, MetrcFgKind & { itemMap: Map<string, MetrcFgItem>; catSet: Set<string> }>();
  const licenses = new Map<string, MetrcFgLicense>();
  let total = 0;
  for (const r of rows) {
    const kind = metrcItemKind(r.item);
    const uom = metrcUomKey(r.uom);
    const key = `${kind}\u0000${uom}`;
    let k = kinds.get(key);
    if (!k) {
      k = { kind, uom, packages: 0, quantity: 0, not_passed: 0, categories: [], items: [], itemMap: new Map(), catSet: new Set() };
      kinds.set(key, k);
    }
    const n = Number(r.n) || 0;
    const q = Number(r.q) || 0;
    const np = Number(r.not_passed) || 0;
    k.packages += n;
    k.quantity = metrcQuantity(k.quantity + q);
    k.not_passed += np;
    if (r.category) k.catSet.add(r.category);
    const itemName = String(r.item ?? "").trim() || "(no item)";
    let it = k.itemMap.get(itemName);
    if (!it) {
      it = { item: itemName, category: r.category ?? null, packages: 0, quantity: 0, not_passed: 0 };
      k.itemMap.set(itemName, it);
    }
    it.packages += n;
    it.quantity = metrcQuantity(it.quantity + q);
    it.not_passed += np;
    total += n;
    const lic = licenses.get(r.license_value) ?? { license_value: r.license_value, packages: 0, newest_mount: null };
    lic.packages += n;
    licenses.set(r.license_value, lic);
  }
  for (const m of mounts) {
    const lic = licenses.get(m.license_value) ?? { license_value: m.license_value, packages: 0, newest_mount: null };
    lic.newest_mount = m.newest;
    licenses.set(m.license_value, lic);
  }
  const finished: MetrcFgKind[] = [...kinds.values()].map((k) => ({
    kind: k.kind,
    uom: k.uom,
    packages: k.packages,
    quantity: k.quantity,
    not_passed: k.not_passed,
    categories: [...k.catSet].sort(),
    items: [...k.itemMap.values()].sort((a, b) => b.quantity - a.quantity || a.item.localeCompare(b.item)),
  }));
  const byQty = (a: MetrcFgKind, b: MetrcFgKind) => b.quantity - a.quantity || a.kind.localeCompare(b.kind);
  const licenseList = [...licenses.values()].sort((a, b) => a.license_value.localeCompare(b.license_value));
  let newest: string | null = null;
  for (const l of licenseList) if (l.newest_mount && (!newest || l.newest_mount > newest)) newest = l.newest_mount;
  return {
    grams: finished.filter((k) => k.uom === "g").sort(byQty),
    eaches: finished.filter((k) => k.uom === "ea").sort(byQty),
    other: finished.filter((k) => k.uom !== "g" && k.uom !== "ea").sort(byQty),
    packages: total,
    licenses: licenseList,
    newest_mount: newest,
  };
}

/** What the state holds today, from the mirror (gone rows excluded), every
 * license together. Null when no packages export has ever been mounted. */
export async function metrcFgInventory(db: D1Database): Promise<MetrcFgInventory | null> {
  const mounts = await db
    .prepare(
      `SELECT license_value, MAX(created_at) AS newest FROM metrc_mounts
       WHERE kind = 'packages' AND deleted_at IS NULL GROUP BY license_value`
    )
    .all<{ license_value: string; newest: string | null }>();
  const mountRows = mounts.results ?? [];
  const rows = await db
    .prepare(
      `SELECT license_value, item, category, uom, COUNT(*) AS n, SUM(COALESCE(quantity, 0)) AS q,
              SUM(CASE WHEN LOWER(COALESCE(lab_test_status, '')) IN ('testpassed', 'retestpassed') THEN 0 ELSE 1 END) AS not_passed
       FROM metrc_packages WHERE gone_at IS NULL
       GROUP BY license_value, item, category, uom`
    )
    .all<FgSourceRow>();
  const source = rows.results ?? [];
  if (mountRows.length === 0 && source.length === 0) return null;
  return shapeMetrcFg(source, mountRows);
}

export type MetrcCrossCheck = {
  /** Ledger packages carrying a METRC tag, by how the mirror reads them. */
  ledger_tagged: number;
  ledger_in_metrc: number;
  ledger_gone_in_metrc: number;
  ledger_unknown_to_metrc: number;
  ledger_untagged: number;
  /** Mirror packages (active) the ledger has never claimed. */
  metrc_active: number;
  metrc_unclaimed: number;
  /** Zoho offerings with a METRC-shaped SKU, against the mirror. */
  zoho_tagged: number;
  zoho_in_metrc: number;
  zoho_not_in_metrc: number;
  samples: { ledger_unknown: string[]; zoho_not_in_metrc: string[] };
};

/** Three pictures against one another: our ledger, the state's mirror, Zoho's
 * offering (canon 0.30.36). Counts, not judgments; the owner reads them. */
export async function metrcCrossCheck(db: D1Database): Promise<MetrcCrossCheck> {
  const ledger = await db
    .prepare(
      `SELECT i.id, i.metrc_tag, p.tag AS mirror_tag, p.gone_at
       FROM local_inventory_items i
       LEFT JOIN metrc_packages p ON p.tag = UPPER(TRIM(i.metrc_tag))
       WHERE i.deleted_at IS NULL`
    )
    .all<{ id: string; metrc_tag: string | null; mirror_tag: string | null; gone_at: string | null }>();
  let ledger_tagged = 0;
  let ledger_in_metrc = 0;
  let ledger_gone_in_metrc = 0;
  let ledger_unknown_to_metrc = 0;
  let ledger_untagged = 0;
  const unknownSamples: string[] = [];
  for (const r of ledger.results ?? []) {
    const tag = String(r.metrc_tag ?? "").trim();
    if (!/^1A[0-9A-F]{22}$/i.test(tag)) {
      ledger_untagged += 1;
      continue;
    }
    ledger_tagged += 1;
    if (!r.mirror_tag) {
      ledger_unknown_to_metrc += 1;
      if (unknownSamples.length < 12) unknownSamples.push(tag.toUpperCase());
    } else if (r.gone_at) ledger_gone_in_metrc += 1;
    else ledger_in_metrc += 1;
  }
  const active = await db
    .prepare(`SELECT COUNT(*) AS n FROM metrc_packages WHERE gone_at IS NULL`)
    .first<{ n: number }>();
  const claimed = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM metrc_packages p
       WHERE p.gone_at IS NULL AND EXISTS (
         SELECT 1 FROM local_inventory_items i
         WHERE i.deleted_at IS NULL AND UPPER(TRIM(i.metrc_tag)) = p.tag
       )`
    )
    .first<{ n: number }>();
  const zoho = await db
    .prepare(
      `SELECT l.package_tag, p.tag AS mirror_tag, p.gone_at
       FROM listings l
       LEFT JOIN metrc_packages p ON p.tag = UPPER(TRIM(l.package_tag))
       WHERE l.deleted_at IS NULL AND l.listed = 1 AND l.source = 'zoho' AND l.package_tag IS NOT NULL`
    )
    .all<{ package_tag: string; mirror_tag: string | null; gone_at: string | null }>();
  let zoho_tagged = 0;
  let zoho_in_metrc = 0;
  let zoho_not_in_metrc = 0;
  const zohoSamples: string[] = [];
  for (const r of zoho.results ?? []) {
    if (!/^1A[0-9A-F]{22}$/i.test(String(r.package_tag ?? "").trim())) continue;
    zoho_tagged += 1;
    if (r.mirror_tag && !r.gone_at) zoho_in_metrc += 1;
    else {
      zoho_not_in_metrc += 1;
      if (zohoSamples.length < 12) zohoSamples.push(String(r.package_tag).toUpperCase());
    }
  }
  const metrc_active = Number(active?.n ?? 0);
  return {
    ledger_tagged,
    ledger_in_metrc,
    ledger_gone_in_metrc,
    ledger_unknown_to_metrc,
    ledger_untagged,
    metrc_active,
    metrc_unclaimed: metrc_active - Number(claimed?.n ?? 0),
    zoho_tagged,
    zoho_in_metrc,
    zoho_not_in_metrc,
    samples: { ledger_unknown: unknownSamples, zoho_not_in_metrc: zohoSamples },
  };
}

export type MetrcRecord =
  | { kind: "package"; row: Record<string, unknown> }
  | { kind: "plant"; row: Record<string, unknown> }
  | null;

/** THE MANIFEST BUILDER (canon 0.30.125): the mirror's live packages under one
 * license, the fields the origin pane shows. The pane sorts them by last six. */
export async function listMirrorPackagesForLicense(db: D1Database, license: string): Promise<MirrorPackage[]> {
  const result = await db
    .prepare(
      `SELECT tag, item, category, quantity, uom, location
       FROM metrc_packages WHERE license_value = ? AND gone_at IS NULL
       ORDER BY tag`
    )
    .bind(license)
    .all<MirrorPackage>();
  return (result.results ?? []).map((r) => ({
    tag: String(r.tag),
    item: r.item ?? null,
    category: r.category ?? null,
    quantity: r.quantity == null ? null : Number(r.quantity),
    uom: r.uom ?? null,
    location: r.location ?? null,
  }));
}

/** THE MANIFEST BUILDER (his pick "Mirror only"): the location names the
 * mirror's packages carry, per license (receive into). Live rows name the
 * list; a license whose packages have all gone keeps the names its rows ever
 * carried, so a quiet license still has somewhere to receive into. */
export async function listMirrorLocationsByLicense(db: D1Database): Promise<Record<string, string[]>> {
  const result = await db
    .prepare(
      `SELECT license_value, location, SUM(CASE WHEN gone_at IS NULL THEN 1 ELSE 0 END) AS live
       FROM metrc_packages
       WHERE location IS NOT NULL AND TRIM(location) <> ''
       GROUP BY license_value, location`
    )
    .all<{ license_value: string; location: string; live: number }>();
  const live = new Map<string, Set<string>>();
  const ever = new Map<string, Set<string>>();
  for (const row of result.results ?? []) {
    const name = String(row.location).trim();
    if (!name) continue;
    const bucket = Number(row.live) > 0 ? live : ever;
    const set = bucket.get(row.license_value) ?? new Set<string>();
    set.add(name);
    bucket.set(row.license_value, set);
  }
  const out: Record<string, string[]> = {};
  const licenses = new Set([...live.keys(), ...ever.keys()]);
  for (const license of licenses) {
    const names = live.get(license) ?? ever.get(license) ?? new Set<string>();
    out[license] = [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base", numeric: true }));
  }
  return out;
}

export async function findMetrcRecord(db: D1Database, tagRaw: string): Promise<MetrcRecord> {
  const tag = String(tagRaw ?? "").trim().toUpperCase();
  if (!tag) return null;
  const pkg = await db.prepare(`SELECT * FROM metrc_packages WHERE tag = ?`).bind(tag).first<Record<string, unknown>>();
  if (pkg) return { kind: "package", row: pkg };
  const plant = await db.prepare(`SELECT * FROM metrc_plants WHERE tag = ?`).bind(tag).first<Record<string, unknown>>();
  if (plant) return { kind: "plant", row: plant };
  return null;
}

/** A package's METRC row by tag, for surfaces that decorate a ledger item. */
export async function listMetrcPackagesByTags(
  db: D1Database,
  tags: readonly string[]
): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  const clean = [...new Set(tags.map((t) => String(t ?? "").trim().toUpperCase()).filter((t) => /^1A[0-9A-F]{22}$/.test(t)))];
  for (const chunk of chunkRows(clean, D1_MAX_PARAMS - 1)) {
    const marks = chunk.map(() => "?").join(", ");
    const result = await db
      .prepare(`SELECT * FROM metrc_packages WHERE tag IN (${marks})`)
      .bind(...chunk)
      .all<Record<string, unknown>>();
    for (const r of result.results ?? []) out.set(String(r.tag), r);
  }
  return out;
}

/* ------------------------------------------------------ internal fields */

export type InternalFieldDef = { key: string; label: string; applies_to: string | null; sort_order: number };

/** The registry: lookup_values category internal_field (value = key, label,
 * tone = plants, packages, or blank for both). Admin adds rows; no migration. */
export async function listInternalFieldDefs(db: D1Database): Promise<InternalFieldDef[]> {
  const result = await db
    .prepare(
      `SELECT value AS key, label, tone AS applies_to, sort_order FROM lookup_values
       WHERE category = 'internal_field' AND deleted_at IS NULL ORDER BY sort_order, value`
    )
    .all<InternalFieldDef>();
  return result.results ?? [];
}

export function fieldAppliesTo(def: InternalFieldDef, kind: "plant" | "package"): boolean {
  const scope = String(def.applies_to ?? "").trim().toLowerCase();
  if (!scope || scope === "both") return true;
  return scope.startsWith(kind);
}

export type InternalFieldValue = { id: string; tag: string; field_key: string; value: string | null; updated_at: string };

export async function listInternalFieldValues(db: D1Database, tag: string): Promise<InternalFieldValue[]> {
  const result = await db
    .prepare(
      `SELECT id, tag, field_key, value, updated_at FROM internal_field_values
       WHERE tag = ? AND deleted_at IS NULL ORDER BY field_key`
    )
    .bind(String(tag ?? "").trim().toUpperCase())
    .all<InternalFieldValue>();
  return result.results ?? [];
}

/** Set (or clear) one of our fields on a tag, with a reason, logged like every
 * edit. The tag must be a row the mirror knows; a field must be registered. */
export async function setInternalField(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, String(form.get("person_id") ?? "").trim() || null);
  const tag = String(form.get("tag") ?? "").trim().toUpperCase();
  const key = String(form.get("field_key") ?? "").trim();
  const value = textOrNull(form.get("value"));
  const reason = textOrNull(form.get("reason")) ?? "";
  if (!tag) throw new HttpError(400, "Which tag?");
  if (!key) throw new HttpError(400, "Which field?");
  if (!reason) throw new HttpError(400, "A reason is required.");
  const defs = await listInternalFieldDefs(db);
  if (!defs.some((d) => d.key === key)) {
    throw new HttpError(400, `Unknown internal field ${key}; add it in Admin, Data Lookups, Internal fields.`);
  }
  const record = await findMetrcRecord(db, tag);
  if (!record) throw new HttpError(404, "The mirror does not know that tag; mount the export that carries it first.");
  const ts = nowIso();
  const existing = await db
    .prepare(`SELECT id, value FROM internal_field_values WHERE tag = ? AND field_key = ?`)
    .bind(tag, key)
    .first<{ id: string; value: string | null }>();
  const stmts: D1PreparedStatement[] = [];
  if (existing) {
    stmts.push(
      db
        .prepare(
          `UPDATE internal_field_values SET value = ?, updated_at = ?, updated_by = ?, deleted_at = NULL, deleted_by = NULL, delete_reason = NULL
           WHERE id = ?`
        )
        .bind(value, ts, actor.id, existing.id),
      insertLog(db, {
        record_table: "internal_field_values",
        record_id: existing.id,
        field: key,
        old_value: existing.value,
        new_value: value,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      })
    );
  } else {
    const id = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO internal_field_values (
            id, tag, field_key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(id, tag, key, value, ts, actor.id, ts, actor.id),
      insertLog(db, {
        record_table: "internal_field_values",
        record_id: id,
        field: key,
        old_value: null,
        new_value: value,
        actor_person_id: actor.id,
        reason: reason || SYSTEM_REASON.internal_field_set,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `/inventory/metrc?tag=${encodeURIComponent(tag)}&ok=field` };
}
