/**
 * TL1: the lab samples door. An Admin upload of the TagLeaf export and
 * POST /feeds/lab-samples.json land the same rows. The worker holds no
 * TagLeaf credential and no Access token. A later file is a window: rows
 * it does not carry are left alone.
 */
import { HttpError } from "./audit";
import { roundGrams } from "./config";
import { insertLog } from "./db";
import { etInstant, etWallClock, isCalendarDate } from "./farmday";
import { t, tFill, type Locale } from "./i18n";
import { esc, fieldBlock } from "./ui";
import { readXlsxSheets } from "./xlsx";

export const LAB_SAMPLES_PATH = "/admin/lab-samples";
export const LAB_SAMPLES_FEED_PATH = "/feeds/lab-samples.json";
export const LAB_SAMPLES_LAST_LOAD_KEY = "lab_samples_last_load";
export const LAB_SAMPLES_MAX_ROWS = 2000;
export const LAB_SAMPLES_REASON_UPLOAD = "lab samples upload";
export const LAB_SAMPLES_REASON_FEED = "lab samples feed";

/** The Samples sheet, by the names his export carries. Order is not the law. */
export const SAMPLE_HEADERS = [
  "Lab Code",
  "Intake Date",
  "Intake Week (Mon)",
  "Product Code",
  "Product",
  "Strain",
  "Farm",
  "Metrc Tag",
  "Test Type",
  "Status",
  "Result",
  "Failure Mode",
  "Coliforms (CFU/g)",
  "Yeast & Mold (CFU/g)",
  "Other Failed Analyte",
  "Coliforms x Limit",
  "Y&M x Limit",
  "Total THC %",
  "COA Posted (ET)",
  "TAT (days)",
  "Batch Qty (g)",
  "Batch Qty (lb)",
  "Lot Key",
  "Samples in Lot",
  "Lot Status",
  "Rep Lbs",
  "COA Week (Mon)",
  "COA Date",
  "Freed Lbs",
  "Held Lbs",
] as const;

const SHEET_NAME = "Samples";
const HEADER_LAB_CODE = "Lab Code";
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const BATCH_STATEMENTS = 40;
const LOOKUP_CODES = 80;
const REFUSAL_CAP = 20;

const NO_SHEET = "The workbook has no Samples sheet.";
const NO_HEADER = "The Samples sheet has no Lab Code column.";
const NOT_A_WORKBOOK = "Upload the TagLeaf export workbook.";
const BAD_BODY = "The body must be JSON with a rows array.";
const TOO_MANY = "A lab samples post takes at most 2,000 rows.";
const NO_CODE = "Row {row} has no lab code.";
const BAD_DATE = "Row {row} has an unreadable intake date.";

export type LabSampleSource = "upload" | "feed";

export type LabSample = {
  lab_code: string;
  lab_name: string | null;
  intake_date: string;
  product_code: string | null;
  product: string | null;
  strain: string | null;
  farm: string | null;
  metrc_tag: string | null;
  test_type: string | null;
  status: string | null;
  result: string | null;
  failure_mode: string | null;
  coliforms_cfu: number | null;
  yeast_mold_cfu: number | null;
  other_failed_analyte: string | null;
  total_thc_pct: number | null;
  coa_posted_at: string | null;
  tat_days: number | null;
  batch_qty_g: number | null;
};

export type LabSamplesResult = {
  received: number;
  inserted: number;
  updated: number;
  unchanged: number;
  refused: number;
  refusals: string[];
};

export type LabSamplesLastLoad = LabSamplesResult & {
  at: string;
  source: LabSampleSource;
};

export type LabSamplesCounts = {
  samples: number;
  completed: number;
  inProcess: number;
  newestIntake: string | null;
  newestCoa: string | null;
};

export type LabSamplesPageModel = {
  counts: LabSamplesCounts;
  last: LabSamplesLastLoad | null;
};

type RawRow = { row: number; cells: Record<string, unknown> };

const DATA_FIELDS = [
  "lab_name",
  "intake_date",
  "product_code",
  "product",
  "strain",
  "farm",
  "metrc_tag",
  "test_type",
  "status",
  "result",
  "failure_mode",
  "coliforms_cfu",
  "yeast_mold_cfu",
  "other_failed_analyte",
  "total_thc_pct",
  "coa_posted_at",
  "tat_days",
  "batch_qty_g",
] as const;

type DataField = (typeof DATA_FIELDS)[number];

const INSERT_SQL = `INSERT INTO lab_samples (
  lab_code, lab_name, intake_date, product_code, product, strain, farm, metrc_tag,
  test_type, status, result, failure_mode, coliforms_cfu, yeast_mold_cfu,
  other_failed_analyte, total_thc_pct, coa_posted_at, tat_days, batch_qty_g,
  source, first_seen_at, changed_at, received_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const UPDATE_SQL = `UPDATE lab_samples SET
  lab_name = ?, intake_date = ?, product_code = ?, product = ?, strain = ?, farm = ?, metrc_tag = ?,
  test_type = ?, status = ?, result = ?, failure_mode = ?, coliforms_cfu = ?, yeast_mold_cfu = ?,
  other_failed_analyte = ?, total_thc_pct = ?, coa_posted_at = ?, tat_days = ?, batch_qty_g = ?,
  source = ?, changed_at = ?, received_at = ?
WHERE lab_code = ?`;

const CONFIG_UPSERT = `INSERT INTO app_config (key, value, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by)
  VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by, deleted_at = NULL`;

const COUNTS_SQL = `SELECT
  COUNT(*) AS samples,
  COALESCE(SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed,
  COALESCE(SUM(CASE WHEN status = 'In Process' THEN 1 ELSE 0 END), 0) AS in_process,
  MAX(intake_date) AS newest_intake,
  MAX(coa_posted_at) AS newest_coa
FROM lab_samples`;

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

function fill(key: string, vars: Record<string, string>): string {
  let out = key;
  for (const [name, value] of Object.entries(vars)) out = out.split(`{${name}}`).join(value);
  return out;
}

function textOf(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = textOf(value);
  if (!text) return null;
  const cleaned = text.replace(/,/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Excel's day count (1899-12-30) as YYYY-MM-DD. A time fraction stays on that calendar day. */
export function excelDate(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const days = Math.floor(serial + 1e-8);
  if (days < 1 || days > 100000) return null;
  const iso = new Date(EXCEL_EPOCH_MS + days * 86_400_000).toISOString().slice(0, 10);
  return isCalendarDate(iso) ? iso : null;
}

function usDate(text: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return isCalendarDate(iso) ? iso : null;
}

function clock24(hour: number, minute: number, meridiem: string | undefined): { hh: number; mm: number } | null {
  if (minute < 0 || minute > 59) return null;
  if (meridiem) {
    const half = meridiem.toUpperCase();
    if ((half !== "AM" && half !== "PM") || hour < 1 || hour > 12) return null;
    return { hh: (hour % 12) + (half === "PM" ? 12 : 0), mm: minute };
  }
  if (hour < 0 || hour > 23) return null;
  return { hh: hour, mm: minute };
}

function wallInstant(date: string, hh: number, mm: number): string | null {
  const iso = etInstant(date, `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  return iso || null;
}

function excelInstant(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  const days = Math.floor(serial + 1e-8);
  let minutes = Math.round((serial - days) * 1440);
  let dateDays = days;
  if (minutes >= 1440) {
    minutes -= 1440;
    dateDays += 1;
  }
  if (minutes < 0) return null;
  const date = excelDate(dateDays);
  if (!date) return null;
  return wallInstant(date, Math.floor(minutes / 60), minutes % 60);
}

/** An Eastern wall clock, or an instant that already carries its zone, as ISO. Blank stays blank. */
export function coaInstant(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return excelInstant(value);
  const text = textOf(value);
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return excelInstant(Number(text));
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?$/i.exec(text);
  if (us) {
    const date = usDate(`${us[1]}/${us[2]}/${us[3]}`);
    if (!date) return null;
    if (!us[4]) return wallInstant(date, 0, 0);
    const clock = clock24(Number(us[4]), Number(us[5]), us[6]);
    if (!clock) return null;
    return wallInstant(date, clock.hh, clock.mm);
  }
  const wall = /^(\d{4}-\d{2}-\d{2})[ T]([01]\d|2[0-3]):([0-5]\d)/.exec(text);
  if (wall && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) {
    if (!isCalendarDate(wall[1])) return null;
    return wallInstant(wall[1], Number(wall[2]), Number(wall[3]));
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/.test(text)) {
    const ms = Date.parse(text);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
  }
  return null;
}

/** YYYY-MM-DD, a US date, or an Excel serial. Blank and anything else are unreadable. */
export function intakeDate(value: unknown): string | null {
  if (typeof value === "number") return excelDate(value);
  const text = textOf(value);
  if (!text) return null;
  if (isCalendarDate(text)) return text;
  const us = usDate(text);
  if (us) return us;
  if (/^\d+(\.\d+)?$/.test(text)) return excelDate(Number(text));
  const wall = /^(\d{4}-\d{2}-\d{2})[ T]/.exec(text);
  if (wall && isCalendarDate(wall[1]) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(text)) return wall[1];
  const usTime = /^(\d{1,2}\/\d{1,2}\/\d{4})\b/.exec(text);
  if (usTime) return usDate(usTime[1]);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    const ms = Date.parse(text);
    if (!Number.isFinite(ms)) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(ms));
    const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const iso = `${pick("year")}-${pick("month")}-${pick("day")}`;
    return isCalendarDate(iso) ? iso : null;
  }
  return null;
}

function wholeOrNull(value: unknown): number | null {
  const n = finiteNumber(value);
  return n == null ? null : roundGrams(n);
}

/** A percent a person reads. An Excel percent cell is a fraction at or under 1. */
function thcPercent(value: unknown): number | null {
  if (value == null || value === "") return null;
  const text = typeof value === "string" ? value.trim() : "";
  const marked = /%$/.test(text);
  const n = marked ? finiteNumber(text.replace(/%$/, "").trim()) : finiteNumber(value);
  if (n == null) return null;
  return round4(marked || Math.abs(n) > 1 ? n : n * 100);
}

function tatDays(value: unknown): number | null {
  const n = finiteNumber(value);
  return n == null ? null : round6(n);
}

function fieldOf(cells: Record<string, unknown>, name: string): unknown {
  if (Object.prototype.hasOwnProperty.call(cells, name)) return cells[name];
  for (const key of Object.keys(cells)) {
    if (key.trim() === name) return cells[key];
  }
  return undefined;
}

function sampleOf(cells: Record<string, unknown>, row: number): { sample: LabSample } | { reason: string } {
  const code = textOf(fieldOf(cells, HEADER_LAB_CODE));
  if (!code) return { reason: fill(NO_CODE, { row: String(row) }) };
  const intake = intakeDate(fieldOf(cells, "Intake Date"));
  if (!intake) return { reason: fill(BAD_DATE, { row: String(row) }) };
  return {
    sample: {
      lab_code: code,
      lab_name: textOf(fieldOf(cells, "Lab Name")),
      intake_date: intake,
      product_code: textOf(fieldOf(cells, "Product Code")),
      product: textOf(fieldOf(cells, "Product")),
      strain: textOf(fieldOf(cells, "Strain")),
      farm: textOf(fieldOf(cells, "Farm")),
      metrc_tag: textOf(fieldOf(cells, "Metrc Tag")),
      test_type: textOf(fieldOf(cells, "Test Type")),
      status: textOf(fieldOf(cells, "Status")),
      result: textOf(fieldOf(cells, "Result")),
      failure_mode: textOf(fieldOf(cells, "Failure Mode")),
      coliforms_cfu: wholeOrNull(fieldOf(cells, "Coliforms (CFU/g)")),
      yeast_mold_cfu: wholeOrNull(fieldOf(cells, "Yeast & Mold (CFU/g)")),
      other_failed_analyte: textOf(fieldOf(cells, "Other Failed Analyte")),
      total_thc_pct: thcPercent(fieldOf(cells, "Total THC %")),
      coa_posted_at: coaInstant(fieldOf(cells, "COA Posted (ET)")),
      tat_days: tatDays(fieldOf(cells, "TAT (days)")),
      batch_qty_g: wholeOrNull(fieldOf(cells, "Batch Qty (g)")),
    },
  };
}

function valueOf(sample: LabSample, field: DataField): string | number | null {
  return sample[field];
}

function sameSample(a: LabSample, b: LabSample): boolean {
  return DATA_FIELDS.every((field) => valueOf(a, field) === valueOf(b, field));
}

function changedFields(prev: LabSample, next: LabSample): DataField[] {
  return DATA_FIELDS.filter((field) => valueOf(prev, field) !== valueOf(next, field));
}

function logValue(value: string | number | null): string | null {
  return value == null ? null : String(value);
}

function fromDb(row: Record<string, unknown>): LabSample {
  const num = (field: DataField, kind: "int" | "thc" | "tat"): number | null => {
    const value = row[field];
    if (value == null || value === "") return null;
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    if (kind === "int") return roundGrams(n);
    return kind === "thc" ? round4(n) : round6(n);
  };
  return {
    lab_code: String(row.lab_code),
    lab_name: textOf(row.lab_name),
    intake_date: String(row.intake_date),
    product_code: textOf(row.product_code),
    product: textOf(row.product),
    strain: textOf(row.strain),
    farm: textOf(row.farm),
    metrc_tag: textOf(row.metrc_tag),
    test_type: textOf(row.test_type),
    status: textOf(row.status),
    result: textOf(row.result),
    failure_mode: textOf(row.failure_mode),
    coliforms_cfu: num("coliforms_cfu", "int"),
    yeast_mold_cfu: num("yeast_mold_cfu", "int"),
    other_failed_analyte: textOf(row.other_failed_analyte),
    total_thc_pct: num("total_thc_pct", "thc"),
    coa_posted_at: textOf(row.coa_posted_at),
    tat_days: num("tat_days", "tat"),
    batch_qty_g: num("batch_qty_g", "int"),
  };
}

function insertBinds(sample: LabSample, source: LabSampleSource, now: string): unknown[] {
  return [
    sample.lab_code,
    sample.lab_name,
    sample.intake_date,
    sample.product_code,
    sample.product,
    sample.strain,
    sample.farm,
    sample.metrc_tag,
    sample.test_type,
    sample.status,
    sample.result,
    sample.failure_mode,
    sample.coliforms_cfu,
    sample.yeast_mold_cfu,
    sample.other_failed_analyte,
    sample.total_thc_pct,
    sample.coa_posted_at,
    sample.tat_days,
    sample.batch_qty_g,
    source,
    now,
    now,
    now,
  ];
}

function updateBinds(sample: LabSample, source: LabSampleSource, now: string): unknown[] {
  return [
    sample.lab_name,
    sample.intake_date,
    sample.product_code,
    sample.product,
    sample.strain,
    sample.farm,
    sample.metrc_tag,
    sample.test_type,
    sample.status,
    sample.result,
    sample.failure_mode,
    sample.coliforms_cfu,
    sample.yeast_mold_cfu,
    sample.other_failed_analyte,
    sample.total_thc_pct,
    sample.coa_posted_at,
    sample.tat_days,
    sample.batch_qty_g,
    source,
    now,
    now,
    sample.lab_code,
  ];
}

async function loadExisting(db: D1Database, codes: string[]): Promise<Map<string, LabSample>> {
  const out = new Map<string, LabSample>();
  const cols = ["lab_code", ...DATA_FIELDS].join(", ");
  for (let i = 0; i < codes.length; i += LOOKUP_CODES) {
    const slice = codes.slice(i, i + LOOKUP_CODES);
    const marks = slice.map(() => "?").join(", ");
    const rows = await db
      .prepare(`SELECT ${cols} FROM lab_samples WHERE lab_code IN (${marks})`)
      .bind(...slice)
      .all<Record<string, unknown>>();
    for (const row of rows.results ?? []) out.set(String(row.lab_code), fromDb(row));
  }
  return out;
}

async function runChunks(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < stmts.length; i += BATCH_STATEMENTS) {
    await db.batch(stmts.slice(i, i + BATCH_STATEMENTS));
  }
}

function parseLast(raw: string | null): LabSamplesLastLoad | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<LabSamplesLastLoad>;
    if (!value || typeof value.at !== "string" || (value.source !== "upload" && value.source !== "feed")) return null;
    const refusals = Array.isArray(value.refusals) ? value.refusals.map((item) => String(item)).slice(0, REFUSAL_CAP) : [];
    return {
      at: value.at,
      source: value.source,
      received: Number(value.received) || 0,
      inserted: Number(value.inserted) || 0,
      updated: Number(value.updated) || 0,
      unchanged: Number(value.unchanged) || 0,
      refused: Number(value.refused) || 0,
      refusals,
    };
  } catch {
    return null;
  }
}

/** The rows of one load. Blank sheet lines are not rows. A JSON element always is. */
export function rawRowsFromObjects(rows: unknown[], numberedFrom: number): RawRow[] {
  return rows.map((row, index) => ({
    row: numberedFrom + index,
    cells: row != null && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {},
  }));
}

export function rawRowsFromSheet(grid: Array<{ row: number; cells: (string | number | boolean | null)[] }>): RawRow[] | string {
  const header = grid.find((line) => line.cells.some((cell) => String(cell ?? "").trim() === HEADER_LAB_CODE));
  if (!header) return NO_HEADER;
  const names = header.cells.map((cell) => String(cell ?? "").trim());
  const out: RawRow[] = [];
  for (const line of grid) {
    if (line.row <= header.row) continue;
    const cells: Record<string, unknown> = {};
    let any = false;
    names.forEach((name, index) => {
      if (!name) return;
      const value = line.cells[index] ?? null;
      if (value != null && value !== "") any = true;
      cells[name] = value;
    });
    if (!any) continue;
    out.push({ row: line.row + 1, cells });
  }
  return out;
}

export async function rowsFromWorkbook(bytes: Uint8Array): Promise<RawRow[]> {
  let sheets: Map<string, Array<{ row: number; cells: (string | number | boolean | null)[] }>>;
  try {
    sheets = await readXlsxSheets(bytes, [SHEET_NAME]);
  } catch {
    throw new HttpError(400, NOT_A_WORKBOOK);
  }
  const grid = sheets.get(SHEET_NAME);
  if (!grid) throw new HttpError(400, NO_SHEET);
  const rows = rawRowsFromSheet(grid);
  if (typeof rows === "string") throw new HttpError(400, rows);
  return rows;
}

export async function landLabSamples(
  db: D1Database,
  raws: RawRow[],
  source: LabSampleSource,
  actorId: string | null,
  now: string
): Promise<LabSamplesResult> {
  const accepted: LabSample[] = [];
  const reasons: string[] = [];
  for (const raw of raws) {
    const parsed = sampleOf(raw.cells, raw.row);
    if ("reason" in parsed) reasons.push(parsed.reason);
    else accepted.push(parsed.sample);
  }
  const codes = [...new Set(accepted.map((sample) => sample.lab_code))];
  const have = await loadExisting(db, codes);
  const pending = new Map(have);
  const stmts: D1PreparedStatement[] = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  const reason = source === "upload" ? LAB_SAMPLES_REASON_UPLOAD : LAB_SAMPLES_REASON_FEED;
  for (const sample of accepted) {
    const prev = pending.get(sample.lab_code);
    if (!prev) {
      inserted += 1;
      stmts.push(db.prepare(INSERT_SQL).bind(...insertBinds(sample, source, now)));
      pending.set(sample.lab_code, sample);
      continue;
    }
    if (sameSample(prev, sample)) {
      unchanged += 1;
      continue;
    }
    updated += 1;
    stmts.push(db.prepare(UPDATE_SQL).bind(...updateBinds(sample, source, now)));
    for (const field of changedFields(prev, sample)) {
      stmts.push(
        insertLog(db, {
          record_table: "lab_samples",
          record_id: sample.lab_code,
          field,
          old_value: logValue(valueOf(prev, field)),
          new_value: logValue(valueOf(sample, field)),
          actor_person_id: actorId,
          reason,
          changed_at: now,
        })
      );
    }
    pending.set(sample.lab_code, sample);
  }
  const result: LabSamplesResult = {
    received: raws.length,
    inserted,
    updated,
    unchanged,
    refused: reasons.length,
    refusals: reasons.slice(0, REFUSAL_CAP),
  };
  const stored: LabSamplesLastLoad = { ...result, at: now, source };
  stmts.push(db.prepare(CONFIG_UPSERT).bind(LAB_SAMPLES_LAST_LOAD_KEY, JSON.stringify(stored), now, actorId, now, actorId));
  if (stmts.length) await runChunks(db, stmts);
  return result;
}

export async function uploadLabSamples(db: D1Database, bytes: Uint8Array, actorId: string | null, now: string): Promise<LabSamplesResult> {
  const rows = await rowsFromWorkbook(bytes);
  return landLabSamples(db, rows, "upload", actorId, now);
}

export async function feedLabSamples(db: D1Database, body: unknown, actorId: string | null, now: string): Promise<LabSamplesResult> {
  const rows = body != null && typeof body === "object" && !Array.isArray(body) ? (body as { rows?: unknown }).rows : undefined;
  if (!Array.isArray(rows)) throw new HttpError(400, BAD_BODY);
  if (rows.length > LAB_SAMPLES_MAX_ROWS) throw new HttpError(400, TOO_MANY);
  return landLabSamples(db, rawRowsFromObjects(rows, 1), "feed", actorId, now);
}

export async function loadLabSamplesPage(db: D1Database): Promise<LabSamplesPageModel> {
  const [counts, config] = await Promise.all([
    db.prepare(COUNTS_SQL).first<{
      samples: number;
      completed: number;
      in_process: number;
      newest_intake: string | null;
      newest_coa: string | null;
    }>(),
    db.prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`).bind(LAB_SAMPLES_LAST_LOAD_KEY).first<{ value: string }>(),
  ]);
  return {
    counts: {
      samples: Number(counts?.samples ?? 0),
      completed: Number(counts?.completed ?? 0),
      inProcess: Number(counts?.in_process ?? 0),
      newestIntake: counts?.newest_intake ?? null,
      newestCoa: counts?.newest_coa ?? null,
    },
    last: parseLast(config?.value ?? null),
  };
}

function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function resultLine(locale: Locale, result: LabSamplesResult): string {
  return tFill(locale, "Received {received}. Inserted {inserted}. Updated {updated}. Unchanged {unchanged}. Refused {refused}.", {
    received: formatCount(result.received),
    inserted: formatCount(result.inserted),
    updated: formatCount(result.updated),
    unchanged: formatCount(result.unchanged),
    refused: formatCount(result.refused),
  });
}

function lastLine(locale: Locale, last: LabSamplesLastLoad): string {
  return tFill(locale, "Last load {when} ET, {source}. {answer}", {
    when: etWallClock(last.at),
    source: last.source,
    answer: resultLine(locale, last),
  });
}

/** The Admin page: the upload, the last load, and the counts. Rows are not edited here. */
export function labSamplesPage(
  model: LabSamplesPageModel,
  locale: Locale = "en",
  opts: { banner?: LabSamplesResult | null; error?: string | null } = {}
): string {
  const counts = model.counts;
  const coa = counts.newestCoa ? etWallClock(counts.newestCoa) : t(locale, "none");
  const intake = counts.newestIntake ?? t(locale, "none");
  const countLine = tFill(locale, "{samples} samples. {completed} completed. {inProcess} in process. Newest intake {intake}. Newest COA {coa}.", {
    samples: formatCount(counts.samples),
    completed: formatCount(counts.completed),
    inProcess: formatCount(counts.inProcess),
    intake,
    coa,
  });
  const error = opts.error ? `<div class="banner err" data-lab-samples-error>${esc(t(locale, opts.error))}</div>` : "";
  const banner = opts.banner
    ? `<div class="banner ok" data-lab-samples-banner>${esc(resultLine(locale, opts.banner))}${
        opts.banner.refusals.length
          ? `<ul>${opts.banner.refusals.map((reason) => `<li>${esc(reason)}</li>`).join("")}</ul>`
          : ""
      }</div>`
    : "";
  const last = model.last
    ? `<p data-lab-samples-last data-source="${esc(model.last.source)}" data-at="${esc(model.last.at)}">${esc(lastLine(locale, model.last))}</p>`
    : `<p data-lab-samples-last>${esc(t(locale, "No lab samples load yet."))}</p>`;
  return `<section class="lab-samples">
    <h1>${esc(t(locale, "Lab Samples"))}</h1>
    <p class="muted">${esc(t(locale, "Upload the TagLeaf export workbook. The Samples sheet is read by its column names. Other sheets are ignored."))}</p>
    ${error}
    ${banner}
    <form class="stack" method="post" action="${LAB_SAMPLES_PATH}" enctype="multipart/form-data" data-lab-samples-form>
      ${fieldBlock(locale, "Workbook", `<input type="file" name="file" accept=".xlsx" required>`, "The TagLeaf export workbook.")}
      <button type="submit">${esc(t(locale, "Upload"))}</button>
    </form>
    ${last}
    <p data-lab-samples-counts data-samples="${counts.samples}" data-completed="${counts.completed}" data-in-process="${counts.inProcess}" data-newest-intake="${esc(counts.newestIntake ?? "")}" data-newest-coa="${esc(counts.newestCoa ?? "")}">${esc(countLine)}</p>
  </section>`;
}
