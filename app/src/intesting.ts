/**
 * THE IN TESTING SHEET (canon 0.30.187). One parser, two doors. The sheet
 * wins on the columns it owns. A manual or desk row is never touched. A row
 * the sheet drops stays, with on_sheet 0. Driver Info is never opened.
 */

import { nowIso } from "./audit";
import { normHeader, outcomeOf } from "./compliance";
import { CONFIG_KEYS, DEFAULT_LAB_TEST_BATCH, roundGrams, SYSTEM_REASON } from "./config";
import { insertLog, logsForInsert } from "./db";
import { readGraphItem, sheetSourceKind, type SheetSyncEnv, type SheetSyncTrigger } from "./sheetsync";
import { excelSerialToIso, readXlsbSheets, writeXlsb, type XlsbCell, type XlsbRow } from "./xlsb";

export type SheetPanel = "full_compliance" | "potency" | "rnd";
export type DeskOutcome = "passed" | "failed" | "open";

export type InTestingRow = {
  tab: string;
  rowNumber: number;
  license_number: string | null;
  med_au: string | null;
  strain: string | null;
  item_name: string | null;
  source_metrc_tag: string | null;
  batch_weight_grams: number | null;
  hbn: string | null;
  sample_tag: string | null;
  required_test: string | null;
  net_weight_grams: number | null;
  testing_facility: string | null;
  entered_testing: string | null;
  finished_testing: string | null;
  potency: number | null;
  status: string | null;
  failure_mode: string | null;
  notes: string | null;
  panel: SheetPanel | null;
  attempt: number;
  sheetKey: string;
};

export type InTestingCounts = {
  rows_seen: number;
  rows_landed: number;
  rows_changed: number;
  rows_skipped: number;
  message: string | null;
};

const STORED_HEADERS = [
  "License Number",
  "Med/AU",
  "Strain",
  "Item Name",
  "Source Metrc Tag",
  "Batch Weight (grams)",
  "Harvest Batch Name",
  "Sample Tag",
  "Required Test",
  "Net Weight (grams)",
  "Testing Facility",
  "Entered Testing",
  "Finished testing",
  "THC Potency %",
  "Testing Status",
  "Fail Reason",
  "Notes",
] as const;

export function parseAliasList(raw: string | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of String(raw ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at < 1) continue;
    const name = part.slice(0, at).trim().toLowerCase();
    const id = part.slice(at + 1).trim();
    if (name && id) out.set(name, id);
  }
  return out;
}

export function panelOf(tab: string, required: string | null, rndTab: string): SheetPanel | null {
  if (normHeader(tab) === normHeader(rndTab)) return "rnd";
  const name = normHeader(required ?? "");
  if (name === "full compliance") return "full_compliance";
  if (name === "potency") return "potency";
  if (name === "r&d" || name === "rnd" || name === "r and d" || name.includes("r&d") || name.includes("r and d")) return "rnd";
  return null;
}

export { outcomeOf };

export function sheetDate(value: XlsbCell): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && value > 20000 && value < 80000) return excelSerialToIso(value);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (slash) return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  return text || null;
}

export function sheetGrams(value: XlsbCell): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return roundGrams(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.replace(/,/g, "").replace("%", "").trim());
    if (Number.isFinite(n)) return roundGrams(n);
  }
  return null;
}

export function sheetThc(value: XlsbCell): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value).replace("%", "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function farmFromHbn(hbn: string | null): string {
  const farm = String(hbn ?? "").split("-")[1]?.trim().toUpperCase() ?? "";
  return /^[A-Z]{3}$/.test(farm) ? farm : "";
}

function cellText(value: XlsbCell): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function headerIndex(header: XlsbCell[], name: string): number {
  const want = normHeader(name);
  return header.findIndex((cell) => normHeader(cellText(cell) ?? "") === want);
}

export function rowsFromSheet(tab: string, grid: XlsbRow[], rndTab: string): { rows: InTestingRow[]; missing: string | null } {
  const headerRow = grid.find((line) => line.row === 0);
  const header = headerRow?.cells ?? [];
  const missing = STORED_HEADERS.find((name) => headerIndex(header, name) < 0) ?? null;
  if (missing) return { rows: [], missing };
  const col = (name: string) => headerIndex(header, name);
  const rows: InTestingRow[] = [];
  for (const line of grid) {
    if (line.row === 0) continue;
    const at = (name: string) => line.cells[col(name)] ?? null;
    const values = STORED_HEADERS.map((name) => at(name));
    if (values.every((value) => value == null || String(value).trim() === "")) continue;
    const required = cellText(at("Required Test"));
    rows.push({
      tab,
      rowNumber: line.row + 1,
      license_number: cellText(at("License Number")),
      med_au: cellText(at("Med/AU")),
      strain: cellText(at("Strain")),
      item_name: cellText(at("Item Name")),
      source_metrc_tag: cellText(at("Source Metrc Tag")),
      batch_weight_grams: sheetGrams(at("Batch Weight (grams)")),
      hbn: cellText(at("Harvest Batch Name")),
      sample_tag: cellText(at("Sample Tag")),
      required_test: required,
      net_weight_grams: sheetGrams(at("Net Weight (grams)")),
      testing_facility: cellText(at("Testing Facility")),
      entered_testing: sheetDate(at("Entered Testing")),
      finished_testing: sheetDate(at("Finished testing")),
      potency: sheetThc(at("THC Potency %")),
      status: cellText(at("Testing Status")),
      failure_mode: cellText(at("Fail Reason")),
      notes: cellText(at("Notes")),
      panel: panelOf(tab, required, rndTab),
      attempt: 1,
      sheetKey: "",
    });
  }
  return { rows, missing: null };
}

export function assignAttempts(rows: InTestingRow[]): void {
  const groups = new Map<string, InTestingRow[]>();
  for (const row of rows) {
    if (!row.source_metrc_tag || !row.panel) {
      row.attempt = 1;
      continue;
    }
    const key = `${row.source_metrc_tag}|${row.panel}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => (a.entered_testing ?? "").localeCompare(b.entered_testing ?? "") || a.rowNumber - b.rowNumber);
    list.forEach((row, i) => {
      row.attempt = i + 1;
    });
  }
  for (const row of rows) {
    row.sheetKey = row.sample_tag ? `${row.tab}|${row.sample_tag}|${row.attempt}` : `${row.tab}|row:${row.rowNumber}`;
  }
}

function createdStamp(date: string | null, rowNumber: number, fallback: string): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return fallback;
  return `${date}T00:00:00.${String(rowNumber % 1000).padStart(3, "0")}Z`;
}

type Existing = {
  id: string;
  sheet_key: string;
  on_sheet: number;
  fields: Record<string, string | null>;
};

async function configValue(db: D1Database, key: string): Promise<string | null> {
  const row = await db.prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`).bind(key).first<{ value: string }>();
  const value = row?.value?.trim() ?? "";
  return value || null;
}

async function existingSheetRows(db: D1Database, table: "external_test_results" | "test_orders" | "test_samples"): Promise<Map<string, Existing>> {
  const result = await db
    .prepare(`SELECT * FROM ${table} WHERE deleted_at IS NULL AND source = 'sheet' AND sheet_key IS NOT NULL`)
    .all<Record<string, unknown>>();
  const out = new Map<string, Existing>();
  for (const row of result.results ?? []) {
    const key = String(row.sheet_key ?? "");
    if (!key) continue;
    const fields: Record<string, string | null> = {};
    for (const [field, value] of Object.entries(row)) fields[field] = value == null ? null : String(value);
    out.set(key, { id: String(row.id), sheet_key: key, on_sheet: Number(row.on_sheet ?? 0), fields });
  }
  return out;
}

export async function lotByHbn(db: D1Database): Promise<Map<string, string>> {
  const result = await db
    .prepare(
      `SELECT b.hbn, w.id, w.status
       FROM harvest_batches b
       JOIN wet_weight_entries w ON w.harvest_batch_id = b.id AND w.deleted_at IS NULL
       WHERE b.deleted_at IS NULL AND b.hbn IS NOT NULL
       ORDER BY CASE WHEN w.status = 'trimmed' THEN 0 ELSE 1 END, w.created_at ASC`
    )
    .all<{ hbn: string; id: string; status: string }>();
  const out = new Map<string, string>();
  for (const row of result.results ?? []) {
    if (!out.has(row.hbn)) out.set(row.hbn, row.id);
  }
  return out;
}

function same(a: string | null, b: string | null): boolean {
  return (a ?? "") === (b ?? "");
}

function externalFields(row: InTestingRow): Record<string, string | null> {
  return {
    license_number: row.license_number,
    med_au: row.med_au,
    strain: row.strain,
    item_name: row.item_name,
    source_metrc_tag: row.source_metrc_tag,
    batch_weight_grams: row.batch_weight_grams == null ? null : String(row.batch_weight_grams),
    hbn: row.hbn,
    sample_tag: row.sample_tag,
    required_test: row.required_test,
    net_weight_grams: row.net_weight_grams == null ? null : String(row.net_weight_grams),
    testing_facility: row.testing_facility,
    entered_testing: row.entered_testing,
    finished_testing: row.finished_testing,
    attempt: String(row.attempt),
    potency_result: row.potency == null ? null : String(row.potency),
    status: row.status,
    failure_mode: row.failure_mode,
    notes: row.notes,
  };
}

async function commit(db: D1Database, stmts: D1PreparedStatement[]): Promise<void> {
  for (let i = 0; i < stmts.length; i += 40) {
    const chunk = stmts.slice(i, i + 40);
    if (chunk.length) await db.batch(chunk);
  }
}

export async function landInTestingRows(db: D1Database, rows: InTestingRow[], now: string): Promise<InTestingCounts> {
  const labs = parseAliasList(await configValue(db, CONFIG_KEYS.in_testing_lab_aliases));
  const fails = parseAliasList(await configValue(db, CONFIG_KEYS.in_testing_fail_types));
  const [external, orders, samples, lots] = await Promise.all([
    existingSheetRows(db, "external_test_results"),
    existingSheetRows(db, "test_orders"),
    existingSheetRows(db, "test_samples"),
    lotByHbn(db),
  ]);
  const byKey = new Map<string, InTestingRow>();
  for (const row of rows) byKey.set(row.sheetKey, row);
  const unique = [...byKey.values()];
  const stmts: D1PreparedStatement[] = [];
  const seen = new Set<string>();
  let landed = 0;
  let changed = 0;
  let skipped = 0;
  const reasons: string[] = [];
  const noteSkip = (reason: string) => {
    skipped += 1;
    if (reasons.length < 5 && !reasons.includes(reason)) reasons.push(reason);
  };
  for (const row of unique) {
    seen.add(row.sheetKey);
    const fields = externalFields(row);
    const prev = external.get(row.sheetKey);
    if (!prev) {
      const id = crypto.randomUUID();
      const record = { id, ...fields, source: "sheet", sheet_key: row.sheetKey, sheet_seen_at: now, on_sheet: 1, created_at: now, updated_at: now };
      stmts.push(
        db
          .prepare(
            `INSERT INTO external_test_results (
              id, license_number, med_au, strain, item_name, source_metrc_tag, batch_weight_grams, hbn,
              sample_tag, required_test, net_weight_grams, testing_facility, entered_testing, finished_testing,
              attempt, potency_result, status, failure_mode, notes, source, sheet_key, sheet_seen_at, on_sheet,
              created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sheet', ?, ?, 1, ?, NULL, ?, NULL, NULL, NULL)`
          )
          .bind(
            id,
            row.license_number,
            row.med_au,
            row.strain,
            row.item_name,
            row.source_metrc_tag,
            row.batch_weight_grams,
            row.hbn,
            row.sample_tag,
            row.required_test,
            row.net_weight_grams,
            row.testing_facility,
            row.entered_testing,
            row.finished_testing,
            row.attempt,
            row.potency,
            row.status,
            row.failure_mode,
            row.notes,
            row.sheetKey,
            now,
            now,
            now
          )
      );
      stmts.push(...logsForInsert(db, "external_test_results", id, record, null, SYSTEM_REASON.in_testing_sheet, now));
      landed += 1;
    } else {
      let dirty = false;
      for (const [field, value] of Object.entries(fields)) {
        if (same(prev.fields[field] ?? null, value)) continue;
        dirty = true;
        stmts.push(
          db.prepare(`UPDATE external_test_results SET ${field} = ?, updated_at = ? WHERE id = ?`).bind(value, now, prev.id),
          insertLog(db, {
            record_table: "external_test_results",
            record_id: prev.id,
            field,
            old_value: prev.fields[field] ?? null,
            new_value: value,
            actor_person_id: null,
            reason: SYSTEM_REASON.in_testing_sheet,
            changed_at: now,
          })
        );
      }
      stmts.push(db.prepare(`UPDATE external_test_results SET sheet_seen_at = ?, on_sheet = 1, updated_at = ? WHERE id = ?`).bind(now, now, prev.id));
      if (dirty) changed += 1;
    }
    if (!row.sample_tag) {
      noteSkip("blank Sample Tag");
      continue;
    }
    if (!row.panel) {
      noteSkip(`unknown Required Test ${row.required_test ?? ""}`.trim());
      continue;
    }
    const labId = labs.get((row.testing_facility ?? "").trim().toLowerCase()) ?? null;
    if (!labId) {
      noteSkip(`unknown lab ${row.testing_facility ?? ""}`.trim());
      continue;
    }
    const outcome = outcomeOf(row.status);
    const orderStatus = outcome === "open" ? "sent" : outcome;
    const stamp = createdStamp(row.entered_testing, row.rowNumber, now);
    const lotId = row.hbn ? (lots.get(row.hbn) ?? null) : null;
    const batch = row.batch_weight_grams ?? 0;
    const net = row.net_weight_grams ?? 0;
    const market = normHeader(row.med_au ?? "").includes("med") ? "MED" : "AU";
    const orderPrev = orders.get(row.sheetKey);
    const orderId = orderPrev?.id ?? crypto.randomUUID();
    if (!orderPrev) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO test_orders (
              id, lot_id, source_package_tag, source_package_code, item_name, license_value, market, lab_id, panel,
              required_lab_test_batch, batch_grams, sample_grams, status, pickup_date, notes,
              created_at, created_by, updated_at, updated_by, deleted_at, deleted_by,
              source, sheet_key, sheet_seen_at, on_sheet
            ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, NULL, 'sheet', ?, ?, 1)`
          )
          .bind(
            orderId,
            lotId,
            row.source_metrc_tag,
            row.item_name,
            row.license_number,
            market,
            labId,
            row.panel,
            DEFAULT_LAB_TEST_BATCH,
            batch,
            net,
            orderStatus,
            row.entered_testing,
            row.notes,
            stamp,
            now,
            row.sheetKey,
            now
          )
      );
      stmts.push(
        ...logsForInsert(
          db,
          "test_orders",
          orderId,
          { status: orderStatus, panel: row.panel, source: "sheet", sheet_key: row.sheetKey },
          null,
          SYSTEM_REASON.in_testing_sheet,
          now
        )
      );
    } else {
      const next: Record<string, string | null> = {
        lot_id: lotId,
        source_package_tag: row.source_metrc_tag,
        item_name: row.item_name,
        license_value: row.license_number,
        market,
        lab_id: labId,
        panel: row.panel,
        batch_grams: String(batch),
        sample_grams: String(net),
        status: orderStatus,
        pickup_date: row.entered_testing,
      };
      for (const [field, value] of Object.entries(next)) {
        if (same(orderPrev.fields[field] ?? null, value)) continue;
        stmts.push(
          db.prepare(`UPDATE test_orders SET ${field} = ?, updated_at = ? WHERE id = ?`).bind(value, now, orderId),
          insertLog(db, {
            record_table: "test_orders",
            record_id: orderId,
            field,
            old_value: orderPrev.fields[field] ?? null,
            new_value: value,
            actor_person_id: null,
            reason: SYSTEM_REASON.in_testing_sheet,
            changed_at: now,
          })
        );
      }
      stmts.push(db.prepare(`UPDATE test_orders SET sheet_seen_at = ?, on_sheet = 1, updated_at = ? WHERE id = ?`).bind(now, now, orderId));
    }
    const samplePrev = samples.get(row.sheetKey);
    const sampleId = samplePrev?.id ?? crypto.randomUUID();
    const overall = outcome === "passed" ? 1 : outcome === "failed" ? 0 : null;
    if (!samplePrev) {
      stmts.push(
        db
          .prepare(
            `INSERT INTO test_samples (
              id, order_id, sample_tag, net_grams, sampled_at, attempt, overall_passed, thc_total_pct, results_at,
              created_at, created_by, updated_at, updated_by, deleted_at, deleted_by,
              source, sheet_key, sheet_seen_at, on_sheet
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, NULL, 'sheet', ?, ?, 1)`
          )
          .bind(
            sampleId,
            orderId,
            row.sample_tag,
            net,
            stamp,
            row.attempt,
            overall,
            row.potency,
            outcome === "open" ? null : row.finished_testing,
            stamp,
            now,
            row.sheetKey,
            now
          )
      );
    } else {
      stmts.push(
        db
          .prepare(
            `UPDATE test_samples SET order_id = ?, sample_tag = ?, net_grams = ?, attempt = ?, overall_passed = ?,
              thc_total_pct = ?, results_at = ?, sheet_seen_at = ?, on_sheet = 1, updated_at = ? WHERE id = ?`
          )
          .bind(orderId, row.sample_tag, net, row.attempt, overall, row.potency, outcome === "open" ? null : row.finished_testing, now, now, sampleId)
      );
    }
    if (outcome !== "open") {
      stmts.push(db.prepare(`UPDATE test_results SET deleted_at = ?, deleted_by = NULL WHERE sample_id = ? AND deleted_at IS NULL`).bind(now, sampleId));
      const parts =
        outcome === "passed"
          ? [{ type: "other", notes: null as string | null, passed: 1 }]
          : (row.failure_mode ?? "")
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean)
              .map((part) => {
                const type = fails.get(part.toLowerCase()) ?? "other";
                return { type, notes: type === "other" ? part : null, passed: 0 };
              });
      if (outcome === "failed" && parts.length === 0) parts.push({ type: "other", notes: null, passed: 0 });
      for (const part of parts) {
        const id = crypto.randomUUID();
        stmts.push(
          db
            .prepare(
              `INSERT INTO test_results (
                id, sample_id, test_type, passed, notes, result_date, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
              ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, NULL)`
            )
            .bind(id, sampleId, part.type, part.passed, part.notes, row.finished_testing, now, now)
        );
      }
    }
  }
  for (const [key, prev] of external) {
    if (seen.has(key) || prev.on_sheet === 0) continue;
    stmts.push(
      db.prepare(`UPDATE external_test_results SET on_sheet = 0, updated_at = ? WHERE id = ?`).bind(now, prev.id),
      insertLog(db, {
        record_table: "external_test_results",
        record_id: prev.id,
        field: "on_sheet",
        old_value: "1",
        new_value: "0",
        actor_person_id: null,
        reason: SYSTEM_REASON.in_testing_sheet,
        changed_at: now,
      })
    );
  }
  for (const [key, prev] of orders) {
    if (seen.has(key) || prev.on_sheet === 0) continue;
    stmts.push(
      db.prepare(`UPDATE test_orders SET on_sheet = 0, updated_at = ? WHERE id = ?`).bind(now, prev.id),
      insertLog(db, {
        record_table: "test_orders",
        record_id: prev.id,
        field: "on_sheet",
        old_value: "1",
        new_value: "0",
        actor_person_id: null,
        reason: SYSTEM_REASON.in_testing_sheet,
        changed_at: now,
      })
    );
  }
  for (const [key, prev] of samples) {
    if (seen.has(key) || prev.on_sheet === 0) continue;
    stmts.push(
      db.prepare(`UPDATE test_samples SET on_sheet = 0, updated_at = ? WHERE id = ?`).bind(now, prev.id),
      insertLog(db, {
        record_table: "test_samples",
        record_id: prev.id,
        field: "on_sheet",
        old_value: "1",
        new_value: "0",
        actor_person_id: null,
        reason: SYSTEM_REASON.in_testing_sheet,
        changed_at: now,
      })
    );
  }
  await commit(db, stmts);
  return {
    rows_seen: rows.length,
    rows_landed: landed,
    rows_changed: changed,
    rows_skipped: skipped,
    message: reasons.length ? reasons.join("; ") : null,
  };
}

export async function rowsFromWorkbook(bytes: Uint8Array, tabName: string, rndName: string): Promise<InTestingRow[]> {
  const sheets = await readXlsbSheets(bytes, [tabName, rndName]);
  const main = rowsFromSheet(tabName, sheets.get(tabName) ?? [], rndName);
  if (main.missing) throw new Error(`The ${tabName} tab is missing ${main.missing}.`);
  const rndGrid = sheets.get(rndName);
  const rnd = rndGrid ? rowsFromSheet(rndName, rndGrid, rndName) : { rows: [], missing: null };
  if (rnd.missing) throw new Error(`The ${rndName} tab is missing ${rnd.missing}.`);
  const rows = [...main.rows, ...rnd.rows];
  assignAttempts(rows);
  return rows;
}

export async function landInTestingWorkbook(db: D1Database, bytes: Uint8Array, now = nowIso()): Promise<InTestingCounts> {
  const tab = (await configValue(db, CONFIG_KEYS.in_testing_tab)) ?? "In Testing";
  const rnd = (await configValue(db, CONFIG_KEYS.in_testing_rnd_tab)) ?? "R&D";
  const rows = await rowsFromWorkbook(bytes, tab, rnd);
  return landInTestingRows(db, rows, now);
}

export async function applyInTestingBytes(db: D1Database, bytes: Uint8Array, trigger: SheetSyncTrigger): Promise<InTestingCounts> {
  const started = nowIso();
  const id = crypto.randomUUID();
  try {
    const counts = await landInTestingWorkbook(db, bytes, started);
    await recordRun(db, { ...counts, id, started, finished: nowIso(), status: "ok", trigger });
    return counts;
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 400);
    await recordRun(db, {
      id,
      started,
      finished: nowIso(),
      status: "failed",
      trigger,
      rows_seen: 0,
      rows_landed: 0,
      rows_changed: 0,
      rows_skipped: 0,
      message,
    });
    throw err;
  }
}

const FIXTURE_TAG_A = "1A40503000311FB0000000A1";
const FIXTURE_SAMPLE_A = "1A40503000311FB0000000A2";
const FIXTURE_TAG_B = "1A40503000311FB0000000B1";
const FIXTURE_SAMPLE_B = "1A40503000311FB0000000B2";

/** The smoke fixture. Synthetic rows only. Never the owner's workbook. */
export function inTestingFixtureWorkbook(): Uint8Array {
  const header = [
    "License Number",
    "Med/AU",
    "Strain",
    "Item Name",
    "Source Metrc Tag",
    "Batch Weight (grams)",
    "Harvest Batch Name",
    "Sample Tag",
    "Required Test",
    "Net Weight (grams)",
    "Testing Facility",
    "Entered Testing",
    "Finished testing",
    "Turnaround Time (Days)",
    "THC Potency %",
    "Testing Status",
    "Fail Reason",
    "Notes",
  ];
  return writeXlsb([
    {
      name: "In Testing",
      rows: [
        header,
        ["AU-G-C-000832", "AU", "Seed Pass", "BUD Seed", FIXTURE_TAG_A, 4480, "26099-ARL-GH-001-0-NA-26099", FIXTURE_SAMPLE_A, "Full Compliance", 14, "SC Labs", "2026-09-01", "2026-09-05", 4, 12.5, "Passed", "", ""],
        ["AU-G-C-000832", "AU", "Seed Fail", "BUD Seed Fail", FIXTURE_TAG_B, 2240, "26098-PNN-GH-001-0-NA-26098", FIXTURE_SAMPLE_B, "Full Compliance", 14, "ACT", "2026-09-02", "2026-09-06", 4, 9.5, "Failed", "Coliforms", ""],
      ],
    },
    { name: "R&D", rows: [header.slice(0, 13).concat(header.slice(14))] },
  ]);
}

async function recordRun(db: D1Database, row: InTestingCounts & { id: string; started: string; finished: string; status: string; trigger: string }): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sheet_sync_runs (
        id, started_at, finished_at, status, trigger, workbook_modified_at, workbook_ctag,
        rows_seen, rows_landed, rows_changed, rows_skipped, message, source
      ) VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, 'in_testing')`
    )
    .bind(row.id, row.started, row.finished, row.status, row.trigger, row.rows_seen, row.rows_landed, row.rows_changed, row.rows_skipped, row.message)
    .run();
}

/** Grip stores TBD until the Entra ids and the secret land. That is absent, not a failed pull. */
function graphCredentialsReady(env: SheetSyncEnv): boolean {
  const tenant = (env.MS_TENANT_ID ?? "").trim();
  const client = (env.MS_CLIENT_ID ?? "").trim();
  const secret = (env.MS_CLIENT_SECRET ?? "").trim();
  if (!tenant || tenant.toUpperCase() === "TBD") return false;
  if (!client || client.toUpperCase() === "TBD") return false;
  if (!secret) return false;
  return true;
}

export async function runInTestingSync(env: SheetSyncEnv, trigger: SheetSyncTrigger): Promise<InTestingCounts & { status: string }> {
  const started = nowIso();
  const id = crypto.randomUUID();
  const empty = { rows_seen: 0, rows_landed: 0, rows_changed: 0, rows_skipped: 0, message: null as string | null };
  try {
    const kind = sheetSourceKind(env);
    if (kind === "none" || (kind === "graph" && !graphCredentialsReady(env))) {
      await recordRun(env.DB, { ...empty, id, started, finished: nowIso(), status: "skipped", trigger, message: "no source configured" });
      return { ...empty, status: "skipped", message: "no source configured" };
    }
    let bytes: Uint8Array;
    if (kind === "graph") {
      const drive = await configValue(env.DB, CONFIG_KEYS.in_testing_drive_id);
      const item = await configValue(env.DB, CONFIG_KEYS.in_testing_item_id);
      if (!drive || !item) throw new Error("in_testing_drive_id is not set");
      bytes = await readGraphItem(env, drive, item);
    } else {
      const base = (env.SHEET_FIXTURE_URL ?? "").trim();
      const url = new URL(base);
      url.searchParams.set("book", "in_testing");
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`fixture ${res.status}`);
      bytes = new Uint8Array(await res.arrayBuffer());
    }
    const counts = await landInTestingWorkbook(env.DB, bytes, started);
    await recordRun(env.DB, { ...counts, id, started, finished: nowIso(), status: "ok", trigger });
    return { ...counts, status: "ok" };
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 400);
    try {
      await recordRun(env.DB, { ...empty, id, started, finished: nowIso(), status: "failed", trigger, message });
    } catch {
      // The Labor sync shares this cron.
    }
    return { ...empty, status: "failed", message };
  }
}
