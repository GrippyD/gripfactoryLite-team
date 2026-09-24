import { HttpError, nowIso, textOrNull } from "./audit";
import { csvCell } from "./csv";
import {
  DEFAULT_LAB_TEST_BATCH,
  IN_TESTING_LOCATION,
  SAMPLE_FLOOR_GRAMS,
  SYSTEM_REASON,
  TEST_OPEN_STATUSES,
  TEST_PANEL_LABELS,
  TEST_PANELS,
  TEST_TYPE_LABELS,
  TEST_TYPES,
  TESTING_TRANSFER_TYPE,
  formatGrams,
  isMetrcTag,
  licenseClassOf,
  metrcQuantity,
  roundGrams,
  shortLotId,
  type TestPanel,
  type TestType,
} from "./config";
import { insertLog, logsForInsert, requireActor } from "./db";
import { t, type Locale } from "./i18n";

export const RETEST_WORDS = "R 420.306: two separate new samples must pass consecutively.";
export const PORTAL_WORDS = "Book the pickup in the lab portal. This desk does not call the lab.";

export const TEST_SAMPLE_CSV_HEADER =
  "Tag Number,Location Name,Item Name,Use Same Item,Quantity,Unit Of Measure,Note,Actual Date,Expiration Date,Sell By Date,Use By Date,Is Donation,Template Ingredients Quantity,Template Ingredients Unit Of Measure,Package Number,Ingredient Quantity,Ingredient Unit Of Measure,Ingredient Finish Package,Ingredient Finish Date";

const OPEN_LIST = TEST_OPEN_STATUSES.map((s) => `'${s}'`).join(",");

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  sampled: "Sampled",
  in_transit: "In transit",
  at_lab: "At the lab",
  results_in: "Results in",
  passed: "Passed",
  failed: "Failed",
  retest_scheduled: "Retest scheduled",
  remediated: "Remediated",
  cancelled: "Cancelled",
  sent: "Sent",
};

export type TestingLab = {
  id: string;
  name: string;
  portal_kind: string;
  portal_url: string | null;
  med_license: string | null;
  au_license: string | null;
  turnaround_days: number | null;
  pickup_cutoff: string | null;
  sample_increment_grams: number | null;
  active: number;
};

export type ReadyLot = {
  lot_id: string;
  dry_grams: number;
  harvest_batch_id: string;
  hbn: string;
  farm_code: string;
  license_value: string;
  strain_name: string;
  package_code: string | null;
  metrc_tag: string | null;
  metrc_harvest_tag: string | null;
};

export type DeskOrder = {
  id: string;
  lot_id: string;
  status: string;
  panel: string;
  market: string;
  pickup_date: string | null;
  batch_grams: number;
  sample_grams: number;
  item_name: string | null;
  license_value: string | null;
  source_package_tag: string | null;
  source_package_code: string | null;
  lab_id: string;
  lab_name: string;
  portal_url: string | null;
  hbn: string;
  farm_code: string;
  strain_name: string | null;
  sample_id: string | null;
  sample_tag: string | null;
  net_grams: number | null;
  attempt: number | null;
  manifest_id: string | null;
  prior_samples: number;
  failure_note: string | null;
  failed_types: string;
  source: string | null;
};

export type DeskManifest = {
  id: string;
  lab_id: string;
  lab_name: string;
  license_value: string;
  manifest_date: string;
  metrc_manifest_number: string | null;
  route_note: string | null;
  harvest_batch_id: string;
  order_status: string | null;
  tags: string;
};

export type TestingDesk = {
  ready: ReadyLot[];
  orders: DeskOrder[];
  manifests: DeskManifest[];
  labs: TestingLab[];
};

export type PendingTestSampleRow = {
  id: string;
  manifest_date: string;
  lab_name: string;
  license_value: string;
  hbn: string;
  harvest_batch_id: string;
  samples: number;
  untagged: number;
  filename: string;
};

export type TestSampleCsvRow = {
  sample_tag: string;
  item_name: string;
  net_grams: number;
  actual_date: string;
  source_package: string;
};

type ActionOk = { redirect: string };

function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function personIdFrom(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

function rowsOf<T>(result: { results?: T[] }): T[] {
  return result.results ?? [];
}

function clip(raw: unknown, max: number): string | null {
  const s = textOrNull(raw);
  if (!s) return null;
  return s.slice(0, max);
}

function requireDate(raw: unknown, label: string): string {
  const s = textOrNull(raw);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(400, `${label} must be a date.`);
  return s;
}

function optionalWhole(raw: unknown, label: string): number | null {
  const s = textOrNull(raw);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new HttpError(400, `${label} must be a whole number, 1 or more.`);
  }
  return n;
}

function requireWholeGrams(raw: unknown, label: string): number {
  const s = textOrNull(raw);
  if (!s) throw new HttpError(400, `${label} is required.`);
  const n = Number(s);
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} must be a number of grams.`);
  const g = roundGrams(n);
  if (g <= 0) throw new HttpError(400, `${label} must be more than zero.`);
  return g;
}

function optionalNumber(raw: unknown, label: string): number | null {
  const s = textOrNull(raw);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) throw new HttpError(400, `${label} must be a number.`);
  return n;
}

/** 0.5 percent of the batch, whole grams, 14 g floor, then up to the lab increment when known. */
export function sampleGrams(batchGrams: number, increment: number | null | undefined): number {
  const batch = roundGrams(batchGrams);
  const pct = Math.ceil((batch * 5) / 1000);
  const floor = Math.max(pct, SAMPLE_FLOOR_GRAMS);
  const step = increment == null ? 0 : Math.trunc(Number(increment));
  if (!Number.isFinite(step) || step <= 1) return floor;
  return Math.ceil(floor / step) * step;
}

export function marketOf(license: string | null | undefined): "AU" | "MED" {
  return licenseClassOf(String(license ?? "")) === "med" ? "MED" : "AU";
}

export function requireSampleTag(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!isMetrcTag(s)) {
    throw new HttpError(400, "The sample tag must be a METRC tag: 1A and 22 hex characters.");
  }
  return s.toUpperCase();
}

export function testSampleFilename(manifestDate: string, id: string): string {
  const day = String(manifestDate).replace(/[^0-9-]+/g, "");
  return `test_sample_${day}_${id.slice(0, 8)}.csv`;
}

export function testSampleCsv(lines: TestSampleCsvRow[]): string {
  const out = [TEST_SAMPLE_CSV_HEADER];
  for (const row of lines) {
    const qty = metrcQuantity(row.net_grams).toFixed(2);
    out.push(
      [
        csvCell(row.sample_tag),
        csvCell(IN_TESTING_LOCATION),
        csvCell(row.item_name),
        "true",
        qty,
        "Grams",
        "",
        csvCell(row.actual_date),
        "",
        "",
        "",
        "false",
        "",
        "",
        csvCell(row.source_package),
        qty,
        "Grams",
        "",
        "",
      ].join(",")
    );
  }
  return out.join("\r\n") + "\r\n";
}

function labLicense(lab: TestingLab, market: string): string {
  const lic = market === "MED" ? lab.med_license : lab.au_license;
  if (!lic) throw new HttpError(400, "That lab has no license for this market.");
  return lic;
}

export async function listTestingLabs(db: D1Database, activeOnly = false): Promise<TestingLab[]> {
  const where = activeOnly ? "AND active = 1" : "";
  const result = await db
    .prepare(
      `SELECT id, name, portal_kind, portal_url, med_license, au_license,
              turnaround_days, pickup_cutoff, sample_increment_grams, active
       FROM testing_labs
       WHERE deleted_at IS NULL ${where}
       ORDER BY active DESC, name`
    )
    .all<TestingLab>();
  return rowsOf(result);
}

async function labById(db: D1Database, id: string): Promise<TestingLab | null> {
  return db
    .prepare(
      `SELECT id, name, portal_kind, portal_url, med_license, au_license,
              turnaround_days, pickup_cutoff, sample_increment_grams, active
       FROM testing_labs WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<TestingLab>();
}

async function openOrderId(db: D1Database, lotId: string): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT id FROM test_orders
       WHERE lot_id = ? AND deleted_at IS NULL AND status IN (${OPEN_LIST})
       LIMIT 1`
    )
    .bind(lotId)
    .first<{ id: string }>();
  return row?.id ?? null;
}

export async function listReadyLots(db: D1Database): Promise<ReadyLot[]> {
  const result = await db
    .prepare(
      `SELECT w.id AS lot_id, COALESCE(w.dry_weight_grams, 0) AS dry_grams, w.harvest_batch_id,
              b.hbn, b.farm_code, b.metrc_harvest_tag,
              COALESCE(
                (SELECT i.license_value FROM local_inventory_items i
                 WHERE i.wet_weight_entry_id = w.id AND i.deleted_at IS NULL
                 ORDER BY i.created_at ASC LIMIT 1),
                b.license_value
              ) AS license_value,
              COALESCE(s.name, '') AS strain_name,
              (SELECT i.package_code FROM local_inventory_items i
               WHERE i.wet_weight_entry_id = w.id AND i.deleted_at IS NULL
               ORDER BY i.created_at ASC LIMIT 1) AS package_code,
              (SELECT i.metrc_tag FROM local_inventory_items i
               WHERE i.wet_weight_entry_id = w.id AND i.deleted_at IS NULL
               ORDER BY i.created_at ASC LIMIT 1) AS metrc_tag
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE w.deleted_at IS NULL AND w.status = 'trimmed'
         AND NOT EXISTS (
           SELECT 1 FROM test_orders o
           WHERE o.lot_id = w.id AND o.deleted_at IS NULL AND o.status IN (${OPEN_LIST})
         )
       ORDER BY b.hbn`
    )
    .all<ReadyLot>();
  return rowsOf(result);
}

export async function loadTestingDesk(db: D1Database): Promise<TestingDesk> {
  const [labs, ready, orderResult, manifestResult, failResult] = await Promise.all([
    listTestingLabs(db, true),
    listReadyLots(db),
    db
      .prepare(
        `SELECT o.id, o.lot_id, o.status, o.panel, o.market, o.pickup_date, o.batch_grams, o.sample_grams,
                o.item_name, o.license_value, o.source_package_tag, o.source_package_code, o.lab_id,
                o.failure_note, o.source, l.name AS lab_name, l.portal_url,
                COALESCE(b.hbn, e.hbn, '') AS hbn, b.farm_code, s.name AS strain_name,
                sm.id AS sample_id, sm.sample_tag, sm.net_grams, sm.attempt, sm.manifest_id,
                (SELECT COUNT(*) FROM test_samples s2
                 JOIN test_orders o2 ON o2.id = s2.order_id
                 WHERE o2.lot_id = o.lot_id AND o.lot_id IS NOT NULL AND s2.deleted_at IS NULL) AS prior_samples
         FROM test_orders o
         JOIN testing_labs l ON l.id = o.lab_id
         LEFT JOIN external_test_results e ON e.sheet_key = o.sheet_key AND e.deleted_at IS NULL
         LEFT JOIN wet_weight_entries w ON w.id = o.lot_id
         LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
         LEFT JOIN strains s ON s.id = b.strain_id
         LEFT JOIN test_samples sm ON sm.id = (
           SELECT s2.id FROM test_samples s2
           WHERE s2.order_id = o.id AND s2.deleted_at IS NULL
           ORDER BY s2.created_at DESC LIMIT 1
         )
         WHERE o.deleted_at IS NULL
         ORDER BY o.created_at DESC`
      )
      .all<Omit<DeskOrder, "failed_types">>(),
    db
      .prepare(
        `SELECT m.id, m.lab_id, l.name AS lab_name, m.license_value, m.manifest_date,
                m.metrc_manifest_number, m.route_note, m.harvest_batch_id
         FROM test_manifests m
         JOIN testing_labs l ON l.id = m.lab_id
         WHERE m.deleted_at IS NULL
         ORDER BY m.created_at DESC
         LIMIT 40`
      )
      .all<Omit<DeskManifest, "order_status" | "tags">>(),
    db
      .prepare(
        `SELECT s.order_id, r.test_type
         FROM test_results r
         JOIN test_samples s ON s.id = r.sample_id AND s.deleted_at IS NULL
         JOIN test_orders o ON o.id = s.order_id AND o.deleted_at IS NULL
         WHERE r.deleted_at IS NULL AND r.passed = 0 AND o.status = 'failed'`
      )
      .all<{ order_id: string; test_type: string }>(),
  ]);
  const failed = new Map<string, string[]>();
  for (const row of rowsOf(failResult)) {
    const list = failed.get(row.order_id) ?? [];
    if (!list.includes(row.test_type)) list.push(row.test_type);
    failed.set(row.order_id, list);
  }
  const orders: DeskOrder[] = rowsOf(orderResult).map((row) => ({
    ...row,
    failed_types: (failed.get(row.id) ?? []).join(", "),
  }));
  const sampleRows = await db
    .prepare(
      `SELECT s.manifest_id, s.sample_tag, o.status
       FROM test_samples s
       JOIN test_orders o ON o.id = s.order_id
       WHERE s.deleted_at IS NULL AND s.manifest_id IS NOT NULL`
    )
    .all<{ manifest_id: string; sample_tag: string; status: string }>();
  const byManifest = new Map<string, { tags: string[]; status: string | null }>();
  for (const row of rowsOf(sampleRows)) {
    const cur = byManifest.get(row.manifest_id) ?? { tags: [], status: null };
    cur.tags.push(row.sample_tag);
    cur.status = row.status;
    byManifest.set(row.manifest_id, cur);
  }
  const manifests: DeskManifest[] = rowsOf(manifestResult).map((row) => {
    const extra = byManifest.get(row.id);
    return { ...row, tags: extra?.tags.join(", ") ?? "", order_status: extra?.status ?? null };
  });
  return { ready, orders, manifests, labs };
}

export async function listPendingTestSamples(db: D1Database): Promise<PendingTestSampleRow[]> {
  const manifests = await db
    .prepare(
      `SELECT m.id, m.manifest_date, m.license_value, m.harvest_batch_id, l.name AS lab_name, b.hbn
       FROM test_manifests m
       JOIN testing_labs l ON l.id = m.lab_id
       JOIN harvest_batches b ON b.id = m.harvest_batch_id
       WHERE m.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = m.id AND u.kind = 'test_sample' AND u.deleted_at IS NULL
         )
       ORDER BY m.created_at DESC`
    )
    .all<{ id: string; manifest_date: string; license_value: string; harvest_batch_id: string; lab_name: string; hbn: string }>();
  const tags = await db
    .prepare(
      `SELECT s.manifest_id, o.source_package_tag
       FROM test_samples s
       JOIN test_orders o ON o.id = s.order_id
       JOIN test_manifests m ON m.id = s.manifest_id AND m.deleted_at IS NULL
       WHERE s.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM metrc_uploads u
           WHERE u.ref_id = m.id AND u.kind = 'test_sample' AND u.deleted_at IS NULL
         )`
    )
    .all<{ manifest_id: string; source_package_tag: string | null }>();
  const grouped = new Map<string, { samples: number; untagged: number }>();
  for (const row of rowsOf(tags)) {
    const cur = grouped.get(row.manifest_id) ?? { samples: 0, untagged: 0 };
    cur.samples += 1;
    if (!isMetrcTag(row.source_package_tag)) cur.untagged += 1;
    grouped.set(row.manifest_id, cur);
  }
  return rowsOf(manifests).map((row) => {
    const extra = grouped.get(row.id) ?? { samples: 0, untagged: 0 };
    return {
      ...row,
      samples: extra.samples,
      untagged: extra.untagged,
      filename: testSampleFilename(row.manifest_date, row.id),
    };
  });
}

async function assertTagUnused(db: D1Database, tag: string): Promise<void> {
  const hit = await db
    .prepare(
      `SELECT id FROM test_samples WHERE sample_tag = ? AND deleted_at IS NULL
       UNION ALL
       SELECT id FROM local_inventory_items
       WHERE deleted_at IS NULL AND (metrc_tag = ? OR package_code = ?)
       UNION ALL
       SELECT id FROM wip_packages WHERE deleted_at IS NULL AND package_code = ?
       LIMIT 1`
    )
    .bind(tag, tag, tag, tag)
    .first<{ id: string }>();
  if (hit) throw new HttpError(400, "That tag is already in use.");
}

export async function scheduleTestOrder(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const lotId = textOrNull(form.get("lot_id"));
  if (!lotId) throw new HttpError(400, "Pick a lot.");
  const lab = await labById(db, String(form.get("lab_id") ?? ""));
  if (!lab || Number(lab.active) !== 1) throw new HttpError(400, "Pick an active lab.");
  const panel = String(form.get("panel") ?? "");
  if (!TEST_PANELS.includes(panel as TestPanel)) throw new HttpError(400, "Pick a panel.");
  const pickup = requireDate(form.get("pickup_date"), "Pickup date");
  const lot = await db
    .prepare(
      `SELECT w.id, w.status, w.dry_weight_grams, w.harvest_batch_id, b.license_value AS batch_license,
              COALESCE(s.name, '') AS strain_name
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE w.id = ? AND w.deleted_at IS NULL`
    )
    .bind(lotId)
    .first<{
      id: string;
      status: string;
      dry_weight_grams: number | null;
      harvest_batch_id: string;
      batch_license: string | null;
      strain_name: string;
    }>();
  if (!lot || lot.status !== "trimmed") throw new HttpError(400, "That lot is not ready to schedule.");
  if (await openOrderId(db, lotId)) throw new HttpError(400, "This lot already has an open test order.");
  const batch = roundGrams(Number(lot.dry_weight_grams ?? 0));
  if (batch <= 0) throw new HttpError(400, "This lot has no dry weight.");
  const pkg = await db
    .prepare(
      `SELECT package_code, metrc_tag, license_value FROM local_inventory_items
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL
       ORDER BY created_at ASC LIMIT 1`
    )
    .bind(lotId)
    .first<{ package_code: string; metrc_tag: string | null; license_value: string }>();
  const license = pkg?.license_value || lot.batch_license || "";
  const sourceTag = isMetrcTag(pkg?.metrc_tag) ? String(pkg?.metrc_tag).toUpperCase() : null;
  const id = crypto.randomUUID();
  const ts = nowIso();
  const sample = sampleGrams(batch, lab.sample_increment_grams);
  const record = {
    id,
    lot_id: lotId,
    source_package_tag: sourceTag,
    source_package_code: pkg?.package_code ?? null,
    item_name: lot.strain_name || "Flower",
    license_value: license,
    market: marketOf(license),
    lab_id: lab.id,
    panel,
    required_lab_test_batch: DEFAULT_LAB_TEST_BATCH,
    batch_grams: batch,
    sample_grams: sample,
    status: "scheduled",
    pickup_date: pickup,
    notes: clip(form.get("notes"), 400),
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO test_orders (
          id, lot_id, source_package_tag, source_package_code, item_name, license_value, market,
          lab_id, panel, required_lab_test_batch, batch_grams, sample_grams, status, pickup_date, notes,
          metrc_lab_testing_state, metrc_state_date,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(
        id,
        lotId,
        sourceTag,
        record.source_package_code,
        record.item_name,
        license,
        record.market,
        lab.id,
        panel,
        DEFAULT_LAB_TEST_BATCH,
        batch,
        sample,
        "scheduled",
        pickup,
        record.notes,
        ts,
        actor.id,
        ts,
        actor.id
      ),
    ...logsForInsert(db, "test_orders", id, record, actor.id, SYSTEM_REASON.test_scheduled, ts),
  ]);
  return { redirect: `/testing?ok=test_scheduled&order=${encodeURIComponent(id)}` };
}

export async function saveTestSample(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const orderId = textOrNull(form.get("order_id"));
  if (!orderId) throw new HttpError(400, "Pick an order.");
  const tag = requireSampleTag(form.get("sample_tag"));
  const net = requireWholeGrams(form.get("net_grams"), "Net grams");
  const grossRaw = textOrNull(form.get("gross_grams"));
  const gross = grossRaw ? requireWholeGrams(form.get("gross_grams"), "Gross grams") : net;
  const order = await db
    .prepare(`SELECT id, lot_id, status FROM test_orders WHERE id = ? AND deleted_at IS NULL`)
    .bind(orderId)
    .first<{ id: string; lot_id: string; status: string }>();
  if (!order) throw new HttpError(404, "Unknown order.");
  if (order.status !== "scheduled" && order.status !== "retest_scheduled") {
    throw new HttpError(400, "That order is not waiting for a sample.");
  }
  await assertTagUnused(db, tag);
  const prior = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM test_samples s
       JOIN test_orders o ON o.id = s.order_id
       WHERE o.lot_id = ? AND s.deleted_at IS NULL`
    )
    .bind(order.lot_id)
    .first<{ n: number }>();
  const attempt = Number(prior?.n ?? 0) + 1;
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    order_id: orderId,
    sample_tag: tag,
    net_grams: net,
    gross_grams: gross,
    sampled_at: ts,
    sampler_name: clip(form.get("sampler_name"), 80),
    grower_witness: clip(form.get("grower_witness"), 80),
    chain_of_custody_ref: clip(form.get("chain_of_custody_ref"), 80),
    sealed_container_ref: clip(form.get("sealed_container_ref"), 80),
    attempt,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO test_samples (
          id, order_id, manifest_id, sample_tag, net_grams, gross_grams, sampled_at,
          sampler_name, grower_witness, chain_of_custody_ref, sealed_container_ref, attempt,
          overall_passed, coa_file_id, metrc_lab_testing_state, metrc_state_date, metrc_result_id,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(
        id,
        orderId,
        tag,
        net,
        gross,
        ts,
        record.sampler_name,
        record.grower_witness,
        record.chain_of_custody_ref,
        record.sealed_container_ref,
        attempt,
        ts,
        actor.id,
        ts,
        actor.id
      ),
    db
      .prepare(
        `UPDATE test_orders SET status = 'sampled', updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, orderId),
    ...logsForInsert(db, "test_samples", id, record, actor.id, SYSTEM_REASON.test_sampled, ts),
    insertLog(db, {
      record_table: "test_orders",
      record_id: orderId,
      field: "status",
      old_value: order.status,
      new_value: "sampled",
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.test_sampled,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/testing?ok=test_sampled&order=${encodeURIComponent(orderId)}` };
}

type ManifestOrder = {
  id: string;
  status: string;
  lab_id: string;
  market: string;
  pickup_date: string | null;
  harvest_batch_id: string;
  sample_id: string;
  manifest_id: string | null;
};

export async function createTestManifest(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const lab = await labById(db, String(form.get("lab_id") ?? ""));
  if (!lab) throw new HttpError(400, "Pick a lab.");
  const day = requireDate(form.get("manifest_date"), "Manifest date");
  const ids = form
    .getAll("order_id")
    .map((v) => String(v))
    .filter((v) => v.length > 0);
  if (ids.length === 0) throw new HttpError(400, "Pick at least one sampled order.");
  const picked: ManifestOrder[] = [];
  for (const id of ids) {
    const row = await db
      .prepare(
        `SELECT o.id, o.status, o.lab_id, o.market, o.pickup_date, w.harvest_batch_id,
                s.id AS sample_id, s.manifest_id
         FROM test_orders o
         JOIN wet_weight_entries w ON w.id = o.lot_id
         LEFT JOIN test_samples s ON s.order_id = o.id AND s.deleted_at IS NULL
         WHERE o.id = ? AND o.deleted_at IS NULL`
      )
      .bind(id)
      .first<ManifestOrder>();
    if (!row || !row.sample_id) throw new HttpError(400, "Each picked order needs a sample.");
    if (row.status !== "sampled") throw new HttpError(400, "Only sampled orders go on a manifest.");
    if (row.manifest_id) throw new HttpError(400, "That sample is already on a manifest.");
    if (row.lab_id !== lab.id) throw new HttpError(400, "Every order on a manifest must use the same lab.");
    if (row.pickup_date !== day) throw new HttpError(400, "Every order on a manifest must be the same day.");
    if (picked.length > 0 && row.market !== picked[0].market) {
      throw new HttpError(400, "Every order on a manifest must be the same market.");
    }
    picked.push(row);
  }
  const license = labLicense(lab, picked[0].market);
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    lab_id: lab.id,
    license_value: license,
    manifest_date: day,
    driver_name: clip(form.get("driver_name"), 80),
    driver_license: clip(form.get("driver_license"), 40),
    driver_phone: clip(form.get("driver_phone"), 40),
    vehicle_make: clip(form.get("vehicle_make"), 40),
    vehicle_model: clip(form.get("vehicle_model"), 40),
    vehicle_plate: clip(form.get("vehicle_plate"), 20),
    route_note: clip(form.get("route_note"), 200),
    harvest_batch_id: picked[0].harvest_batch_id,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `INSERT INTO test_manifests (
          id, lab_id, license_value, manifest_date, metrc_manifest_number,
          driver_name, driver_license, driver_phone, vehicle_make, vehicle_model, vehicle_plate, route_note,
          harvest_batch_id, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(
        id,
        lab.id,
        license,
        day,
        record.driver_name,
        record.driver_license,
        record.driver_phone,
        record.vehicle_make,
        record.vehicle_model,
        record.vehicle_plate,
        record.route_note,
        record.harvest_batch_id,
        ts,
        actor.id,
        ts,
        actor.id
      ),
    ...logsForInsert(db, "test_manifests", id, record, actor.id, SYSTEM_REASON.test_manifest, ts),
  ];
  for (const row of picked) {
    stmts.push(
      db
        .prepare(`UPDATE test_samples SET manifest_id = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
        .bind(id, ts, actor.id, row.sample_id),
      insertLog(db, {
        record_table: "test_samples",
        record_id: row.sample_id,
        field: "manifest_id",
        old_value: null,
        new_value: id,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.test_manifest,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `/testing?ok=test_manifest&manifest=${encodeURIComponent(id)}` };
}

async function manifestOrders(db: D1Database, manifestId: string) {
  const result = await db
    .prepare(
      `SELECT o.id, o.status
       FROM test_samples s
       JOIN test_orders o ON o.id = s.order_id AND o.deleted_at IS NULL
       WHERE s.manifest_id = ? AND s.deleted_at IS NULL`
    )
    .bind(manifestId)
    .all<{ id: string; status: string }>();
  return rowsOf(result);
}

export async function markManifestSent(db: D1Database, manifestId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const manifest = await db
    .prepare(`SELECT id FROM test_manifests WHERE id = ? AND deleted_at IS NULL`)
    .bind(manifestId)
    .first<{ id: string }>();
  if (!manifest) throw new HttpError(404, "Unknown manifest.");
  const orders = await manifestOrders(db, manifestId);
  if (orders.length === 0) throw new HttpError(400, "That manifest has no samples.");
  if (orders.every((o) => o.status === "in_transit" || o.status === "at_lab")) {
    throw new HttpError(400, "This manifest is already sent.");
  }
  if (orders.some((o) => o.status !== "sampled")) throw new HttpError(400, "Only sampled orders can be marked sent.");
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  for (const order of orders) {
    stmts.push(
      db
        .prepare(`UPDATE test_orders SET status = 'in_transit', updated_at = ?, updated_by = ? WHERE id = ?`)
        .bind(ts, actor.id, order.id),
      insertLog(db, {
        record_table: "test_orders",
        record_id: order.id,
        field: "status",
        old_value: order.status,
        new_value: "in_transit",
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.test_sent,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `/testing?ok=test_sent&manifest=${encodeURIComponent(manifestId)}` };
}

export async function saveManifestNumber(db: D1Database, manifestId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const number = clip(form.get("metrc_manifest_number"), 40);
  if (!number) throw new HttpError(400, "Type the Metrc manifest number.");
  const manifest = await db
    .prepare(`SELECT id, metrc_manifest_number FROM test_manifests WHERE id = ? AND deleted_at IS NULL`)
    .bind(manifestId)
    .first<{ id: string; metrc_manifest_number: string | null }>();
  if (!manifest) throw new HttpError(404, "Unknown manifest.");
  const orders = await manifestOrders(db, manifestId);
  if (orders.some((o) => o.status === "sampled")) {
    throw new HttpError(400, "Mark the manifest sent before the Metrc number.");
  }
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE test_manifests SET metrc_manifest_number = ?, updated_at = ?, updated_by = ? WHERE id = ?`
      )
      .bind(number, ts, actor.id, manifestId),
    insertLog(db, {
      record_table: "test_manifests",
      record_id: manifestId,
      field: "metrc_manifest_number",
      old_value: manifest.metrc_manifest_number,
      new_value: number,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.test_at_lab,
      changed_at: ts,
    }),
  ];
  for (const order of orders) {
    if (order.status !== "in_transit") continue;
    stmts.push(
      db
        .prepare(`UPDATE test_orders SET status = 'at_lab', updated_at = ?, updated_by = ? WHERE id = ?`)
        .bind(ts, actor.id, order.id),
      insertLog(db, {
        record_table: "test_orders",
        record_id: order.id,
        field: "status",
        old_value: "in_transit",
        new_value: "at_lab",
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.test_at_lab,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `/testing?ok=test_at_lab&manifest=${encodeURIComponent(manifestId)}` };
}

export async function saveTestResults(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const orderId = textOrNull(form.get("order_id"));
  if (!orderId) throw new HttpError(400, "Pick an order.");
  const order = await db
    .prepare(`SELECT id, status FROM test_orders WHERE id = ? AND deleted_at IS NULL`)
    .bind(orderId)
    .first<{ id: string; status: string }>();
  if (!order) throw new HttpError(404, "Unknown order.");
  if (order.status !== "at_lab") throw new HttpError(400, "Results are recorded once the order is at the lab.");
  const sample = await db
    .prepare(
      `SELECT id FROM test_samples WHERE order_id = ? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`
    )
    .bind(orderId)
    .first<{ id: string }>();
  if (!sample) throw new HttpError(400, "That order has no sample.");
  const recorded: Array<{ type: TestType; passed: number; value: number | null }> = [];
  for (const type of TEST_TYPES) {
    const flag = textOrNull(form.get(`passed__${type}`));
    if (flag !== "1" && flag !== "0") continue;
    recorded.push({ type, passed: flag === "1" ? 1 : 0, value: optionalNumber(form.get(`value__${type}`), TEST_TYPE_LABELS[type]) });
  }
  if (recorded.length === 0) throw new HttpError(400, "Record at least one test.");
  const failed = recorded.some((row) => row.passed === 0);
  const overall = failed ? 0 : 1;
  const next = failed ? "failed" : "passed";
  const ts = nowIso();
  const resultDate = textOrNull(form.get("result_date")) || ts.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resultDate)) throw new HttpError(400, "Result date must be a date.");
  const failureNote = clip(form.get("failure_note"), 400);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE test_samples SET overall_passed = ?, thc_total_pct = ?, thca_pct = ?, cbd_total_pct = ?,
                water_activity_aw = ?, coa_url = ?, lab_sample_id = ?, results_at = ?, failure_note = ?,
                updated_at = ?, updated_by = ?
         WHERE id = ?`
      )
      .bind(
        overall,
        optionalNumber(form.get("thc_total_pct"), "THC"),
        optionalNumber(form.get("thca_pct"), "THCa"),
        optionalNumber(form.get("cbd_total_pct"), "CBD"),
        optionalNumber(form.get("water_activity_aw"), "Water activity"),
        clip(form.get("coa_url"), 300),
        clip(form.get("lab_sample_id"), 80),
        ts,
        failureNote,
        ts,
        actor.id,
        sample.id
      ),
    db
      .prepare(
        `UPDATE test_orders SET status = ?, failure_note = ?, updated_at = ?, updated_by = ? WHERE id = ?`
      )
      .bind(next, failureNote, ts, actor.id, orderId),
    insertLog(db, {
      record_table: "test_orders",
      record_id: orderId,
      field: "status",
      old_value: order.status,
      new_value: next,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.test_result,
      changed_at: ts,
    }),
  ];
  for (const row of recorded) {
    const id = crypto.randomUUID();
    stmts.push(
      db
        .prepare(
          `INSERT INTO test_results (
            id, sample_id, test_type, passed, value, unit, qualifier, notes, result_date, metrc_result_id,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, NULL, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, sample.id, row.type, row.passed, row.value, resultDate, ts, actor.id, ts, actor.id),
      insertLog(db, {
        record_table: "test_results",
        record_id: id,
        field: "passed",
        old_value: null,
        new_value: String(row.passed),
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.test_result,
        changed_at: ts,
      })
    );
  }
  await db.batch(stmts);
  return { redirect: `/testing?ok=test_${next}&order=${encodeURIComponent(orderId)}` };
}

export async function scheduleRetest(db: D1Database, orderId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const order = await db
    .prepare(`SELECT * FROM test_orders WHERE id = ? AND deleted_at IS NULL`)
    .bind(orderId)
    .first<Record<string, unknown>>();
  if (!order) throw new HttpError(404, "Unknown order.");
  if (order.status !== "failed") throw new HttpError(400, "A retest starts from a failed order.");
  if (await openOrderId(db, String(order.lot_id))) throw new HttpError(400, "This lot already has an open test order.");
  const pickup = requireDate(form.get("pickup_date"), "Pickup date");
  const id = crypto.randomUUID();
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO test_orders (
          id, lot_id, source_package_tag, source_package_code, item_name, license_value, market,
          lab_id, panel, required_lab_test_batch, batch_grams, sample_grams, status, pickup_date, notes,
          metrc_lab_testing_state, metrc_state_date,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'retest_scheduled', ?, ?, NULL, NULL, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(
        id,
        order.lot_id,
        order.source_package_tag,
        order.source_package_code,
        order.item_name,
        order.license_value,
        order.market,
        order.lab_id,
        order.panel,
        order.required_lab_test_batch,
        order.batch_grams,
        order.sample_grams,
        pickup,
        RETEST_WORDS,
        ts,
        actor.id,
        ts,
        actor.id
      ),
    insertLog(db, {
      record_table: "test_orders",
      record_id: id,
      field: "status",
      old_value: null,
      new_value: "retest_scheduled",
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.test_retest,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/testing?ok=test_retest&order=${encodeURIComponent(id)}` };
}

export async function markRemediated(db: D1Database, orderId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = clip(form.get("reason"), 400);
  const cra = clip(form.get("cra_approval_ref"), 80);
  const day = requireDate(form.get("remediated_date"), "Remediated date");
  if (!reason) throw new HttpError(400, "A remediation needs a reason.");
  if (!cra) throw new HttpError(400, "A remediation needs the CRA approval reference.");
  const order = await db
    .prepare(`SELECT id, status FROM test_orders WHERE id = ? AND deleted_at IS NULL`)
    .bind(orderId)
    .first<{ id: string; status: string }>();
  if (!order) throw new HttpError(404, "Unknown order.");
  if (order.status !== "failed") throw new HttpError(400, "Only a failed order can be marked remediated.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE test_orders SET status = 'remediated', remediated_reason = ?, cra_approval_ref = ?,
                remediated_date = ?, updated_at = ?, updated_by = ? WHERE id = ?`
      )
      .bind(reason, cra, day, ts, actor.id, orderId),
    insertLog(db, {
      record_table: "test_orders",
      record_id: orderId,
      field: "status",
      old_value: "failed",
      new_value: "remediated",
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.test_remediated,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "test_orders",
      record_id: orderId,
      field: "cra_approval_ref",
      old_value: null,
      new_value: cra,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.test_remediated,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/testing?ok=test_remediated&order=${encodeURIComponent(orderId)}` };
}

export async function saveTestingLab(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const name = clip(form.get("name"), 80);
  if (!name) throw new HttpError(400, "A lab needs a name.");
  const portal = String(form.get("portal_kind") ?? "");
  if (portal !== "tagleaf" && portal !== "slingr" && portal !== "other") {
    throw new HttpError(400, "Portal must be tagleaf, slingr, or other.");
  }
  const active = form.getAll("active").some((v) => v === "1" || v === "on") ? 1 : 0;
  const fields = {
    name,
    portal_kind: portal,
    portal_url: clip(form.get("portal_url"), 300),
    med_license: clip(form.get("med_license"), 40),
    au_license: clip(form.get("au_license"), 40),
    turnaround_days: optionalWhole(form.get("turnaround_days"), "Turnaround days"),
    pickup_cutoff: clip(form.get("pickup_cutoff"), 20),
    sample_increment_grams: optionalWhole(form.get("sample_increment_grams"), "Sample increment"),
    active,
  };
  const existingId = textOrNull(form.get("id"));
  const ts = nowIso();
  if (existingId) {
    const current = await labById(db, existingId);
    if (!current) throw new HttpError(404, "Unknown lab.");
    const stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `UPDATE testing_labs SET name = ?, portal_kind = ?, portal_url = ?, med_license = ?, au_license = ?,
                  turnaround_days = ?, pickup_cutoff = ?, sample_increment_grams = ?, active = ?,
                  updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(
          fields.name,
          fields.portal_kind,
          fields.portal_url,
          fields.med_license,
          fields.au_license,
          fields.turnaround_days,
          fields.pickup_cutoff,
          fields.sample_increment_grams,
          fields.active,
          ts,
          actor.id,
          existingId
        ),
    ];
    const before: Record<string, unknown> = { ...current };
    for (const [field, value] of Object.entries(fields)) {
      const oldValue = before[field];
      if (String(oldValue ?? "") === String(value ?? "")) continue;
      stmts.push(
        insertLog(db, {
          record_table: "testing_labs",
          record_id: existingId,
          field,
          old_value: oldValue == null ? null : String(oldValue),
          new_value: value == null ? null : String(value),
          actor_person_id: actor.id,
          reason: SYSTEM_REASON.test_lab,
          changed_at: ts,
        })
      );
    }
    await db.batch(stmts);
    return { redirect: "/admin/lookups/testing_labs?ok=1" };
  }
  const id = crypto.randomUUID();
  const record = { id, ...fields, created_at: ts, created_by: actor.id, updated_at: ts, updated_by: actor.id };
  await db.batch([
    db
      .prepare(
        `INSERT INTO testing_labs (
          id, name, portal_kind, portal_url, med_license, au_license, turnaround_days, pickup_cutoff,
          sample_increment_grams, active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(
        id,
        fields.name,
        fields.portal_kind,
        fields.portal_url,
        fields.med_license,
        fields.au_license,
        fields.turnaround_days,
        fields.pickup_cutoff,
        fields.sample_increment_grams,
        fields.active,
        ts,
        actor.id,
        ts,
        actor.id
      ),
    ...logsForInsert(db, "testing_labs", id, record, actor.id, SYSTEM_REASON.test_lab, ts),
  ]);
  return { redirect: "/admin/lookups/testing_labs?ok=1" };
}

type BuiltCsv = { body: string; filename: string; harvest_batch_id: string };

export async function buildTestSampleCsv(db: D1Database, manifestId: string): Promise<BuiltCsv> {
  const manifest = await db
    .prepare(
      `SELECT id, manifest_date, harvest_batch_id FROM test_manifests WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(manifestId)
    .first<{ id: string; manifest_date: string; harvest_batch_id: string }>();
  if (!manifest) throw new HttpError(404, "Unknown manifest.");
  const result = await db
    .prepare(
      `SELECT s.sample_tag, s.net_grams, s.sampled_at, o.item_name, o.source_package_tag, o.source_package_code
       FROM test_samples s
       JOIN test_orders o ON o.id = s.order_id
       WHERE s.manifest_id = ? AND s.deleted_at IS NULL
       ORDER BY s.created_at ASC`
    )
    .bind(manifestId)
    .all<{
      sample_tag: string;
      net_grams: number;
      sampled_at: string;
      item_name: string | null;
      source_package_tag: string | null;
      source_package_code: string | null;
    }>();
  const lines = rowsOf(result);
  if (lines.length === 0) throw new HttpError(404, "That manifest has no samples.");
  const body = testSampleCsv(
    lines.map((row) => ({
      sample_tag: row.sample_tag,
      item_name: row.item_name || "",
      net_grams: Number(row.net_grams),
      actual_date: String(row.sampled_at).slice(0, 10),
      source_package: isMetrcTag(row.source_package_tag)
        ? String(row.source_package_tag).toUpperCase()
        : String(row.source_package_code ?? ""),
    }))
  );
  return { body, filename: testSampleFilename(manifest.manifest_date, manifest.id), harvest_batch_id: manifest.harvest_batch_id };
}

export async function manifestWorksheetCsv(db: D1Database, manifestId: string): Promise<BuiltCsv> {
  const page = await loadManifestSheet(db, manifestId);
  const header = [
    "Transfer type",
    "Lab",
    "License",
    "Manifest date",
    "Sample tag",
    "Net grams",
    "Gross grams",
    "Driver",
    "Driver license",
    "Phone",
    "Vehicle make",
    "Vehicle model",
    "Plate",
    "Route note",
  ];
  const lines = [header.join(",")];
  for (const row of page.samples) {
    lines.push(
      [
        csvCell(TESTING_TRANSFER_TYPE),
        csvCell(page.lab_name),
        csvCell(page.license_value),
        csvCell(page.manifest_date),
        csvCell(row.sample_tag),
        csvCell(row.net_grams),
        csvCell(row.gross_grams),
        csvCell(page.driver_name),
        csvCell(page.driver_license),
        csvCell(page.driver_phone),
        csvCell(page.vehicle_make),
        csvCell(page.vehicle_model),
        csvCell(page.vehicle_plate),
        csvCell(page.route_note),
      ].join(",")
    );
  }
  return {
    body: lines.join("\r\n") + "\r\n",
    filename: `manifest_worksheet_${page.manifest_date}_${manifestId.slice(0, 8)}.csv`,
    harvest_batch_id: page.harvest_batch_id,
  };
}

type ManifestSheet = {
  id: string;
  lab_name: string;
  portal_url: string | null;
  license_value: string;
  manifest_date: string;
  metrc_manifest_number: string | null;
  driver_name: string | null;
  driver_license: string | null;
  driver_phone: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  route_note: string | null;
  harvest_batch_id: string;
  samples: Array<{ sample_tag: string; net_grams: number; gross_grams: number | null; item_name: string | null }>;
};

async function loadManifestSheet(db: D1Database, manifestId: string): Promise<ManifestSheet> {
  const manifest = await db
    .prepare(
      `SELECT m.id, l.name AS lab_name, l.portal_url, m.license_value, m.manifest_date, m.metrc_manifest_number,
              m.driver_name, m.driver_license, m.driver_phone, m.vehicle_make, m.vehicle_model, m.vehicle_plate,
              m.route_note, m.harvest_batch_id
       FROM test_manifests m
       JOIN testing_labs l ON l.id = m.lab_id
       WHERE m.id = ? AND m.deleted_at IS NULL`
    )
    .bind(manifestId)
    .first<Omit<ManifestSheet, "samples">>();
  if (!manifest) throw new HttpError(404, "Unknown manifest.");
  const samples = await db
    .prepare(
      `SELECT s.sample_tag, s.net_grams, s.gross_grams, o.item_name
       FROM test_samples s
       JOIN test_orders o ON o.id = s.order_id
       WHERE s.manifest_id = ? AND s.deleted_at IS NULL
       ORDER BY s.created_at ASC`
    )
    .bind(manifestId)
    .all<ManifestSheet["samples"][number]>();
  return { ...manifest, samples: rowsOf(samples) };
}

export async function manifestPrintPage(db: D1Database, manifestId: string, locale: Locale): Promise<string> {
  const page = await loadManifestSheet(db, manifestId);
  const rows = page.samples
    .map(
      (row) => `<tr>
        <td>${esc(row.sample_tag)}</td>
        <td>${esc(row.item_name ?? "")}</td>
        <td>${esc(formatGrams(row.net_grams))}</td>
        <td>${esc(formatGrams(row.gross_grams ?? row.net_grams))}</td>
      </tr>`
    )
    .join("");
  return `<article class="testing-desk" data-manifest-print="${esc(page.id)}">
    <h1>${esc(t(locale, "Manifest"))}</h1>
    <p>${esc(TESTING_TRANSFER_TYPE)}</p>
    <p>${esc(page.lab_name)} · ${esc(page.license_value)} · ${esc(page.manifest_date)}</p>
    <p>${esc(t(locale, "Driver"))}: ${esc(page.driver_name ?? "")} · ${esc(page.driver_license ?? "")} · ${esc(page.driver_phone ?? "")}</p>
    <p>${esc(t(locale, "Vehicle"))}: ${esc(page.vehicle_make ?? "")} ${esc(page.vehicle_model ?? "")} · ${esc(page.vehicle_plate ?? "")}</p>
    <p>${esc(t(locale, "Route note"))}: ${esc(page.route_note ?? "")}</p>
    <table class="data">
      <thead><tr><th>${esc(t(locale, "Sample tag"))}</th><th>${esc(t(locale, "Item"))}</th><th>${esc(t(locale, "Net grams"))}</th><th>${esc(t(locale, "Gross grams"))}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </article>`;
}

function labOptions(labs: TestingLab[], selected = ""): string {
  return labs
    .map((lab) => {
      const mark = lab.id === "sc-labs-michigan" ? "sc" : lab.id === "act-laboratories" ? "act" : "";
      const sel = lab.id === selected ? " selected" : "";
      return `<option value="${esc(lab.id)}" data-lab="${mark}"${sel}>${esc(lab.name)}</option>`;
    })
    .join("");
}

function panelOptions(): string {
  return TEST_PANELS.map((key) => `<option value="${key}">${esc(TEST_PANEL_LABELS[key])}</option>`).join("");
}

export function testingDeskPage(desk: TestingDesk, locale: Locale): string {
  const readyRows = desk.ready
    .map((lot) => {
      const grams = roundGrams(Number(lot.dry_grams));
      const size = sampleGrams(grams, null);
      const serial = shortLotId(lot.hbn, lot.metrc_harvest_tag);
      const market = marketOf(lot.license_value);
      const tagged = isMetrcTag(lot.metrc_tag) ? "1" : "0";
      const action = `<form method="post" action="/testing/schedule" class="stack">
            <input type="hidden" name="lot_id" value="${esc(lot.lot_id)}">
            <label class="field">${esc(t(locale, "Lab"))} <select name="lab_id" required><option value=""></option>${labOptions(desk.labs)}</select></label>
            <label class="field">${esc(t(locale, "Panel"))} <select name="panel" required><option value=""></option>${panelOptions()}</select></label>
            <label class="field">${esc(t(locale, "Pickup date"))} <input type="date" name="pickup_date" required></label>
            <button type="submit">${esc(t(locale, "Schedule"))}</button>
          </form>`;
      return `<tr data-ready="${esc(lot.lot_id)}" data-sample-grams="${size}" data-source-tag="${tagged}" data-package="${esc(lot.package_code ?? "")}">
        <td>${esc(serial)}</td>
        <td>${esc(lot.strain_name)}</td>
        <td>${esc(lot.farm_code)}</td>
        <td>${esc(lot.strain_name)}</td>
        <td>${esc(lot.license_value)}</td>
        <td>${esc(market)}</td>
        <td>${esc(formatGrams(grams))}</td>
        <td>${esc(formatGrams(size))}</td>
        <td>${action}</td>
      </tr>`;
    })
    .join("");
  const readyTable =
    desk.ready.length === 0
      ? `<p class="muted">${esc(t(locale, "No lots ready."))}</p>`
      : `<table class="data"><thead><tr>
          <th>${esc(t(locale, "HBN"))}</th><th>${esc(t(locale, "Strain"))}</th><th>${esc(t(locale, "Farm"))}</th>
          <th>${esc(t(locale, "Item"))}</th><th>${esc(t(locale, "License"))}</th><th>${esc(t(locale, "Market"))}</th>
          <th>${esc(t(locale, "Dry grams"))}</th><th>${esc(t(locale, "Sample size"))}</th><th></th>
        </tr></thead><tbody>${readyRows}</tbody></table>`;

  const sampleOrders = desk.orders.filter((o) => o.status === "scheduled" || o.status === "retest_scheduled");
  const sampleRows = sampleOrders
    .map((order) => {
      const nextAttempt = Number(order.prior_samples) + 1;
      return `<form method="post" action="/testing/samples" class="stack" data-sample-order="${esc(order.id)}" data-order-source="${esc(order.source ?? "desk")}">
        <input type="hidden" name="order_id" value="${esc(order.id)}">
        <p>${esc(shortLotId(order.hbn, null))} · ${esc(order.lab_name)} · ${esc(t(locale, STATUS_LABEL[order.status] ?? order.status))} · ${esc(t(locale, "Attempt"))} ${nextAttempt} · ${esc(formatGrams(order.sample_grams))} g</p>
        <label class="field">${esc(t(locale, "Sample tag"))} <input type="text" name="sample_tag" required placeholder="1A..."></label>
        <label class="field">${esc(t(locale, "Net grams"))} <input type="number" name="net_grams" min="1" step="1" required value="${esc(order.sample_grams)}"></label>
        <label class="field">${esc(t(locale, "Gross grams"))} <input type="number" name="gross_grams" min="1" step="1"></label>
        <label class="field">${esc(t(locale, "Sampler"))} <input type="text" name="sampler_name"></label>
        <label class="field">${esc(t(locale, "Grower witness"))} <input type="text" name="grower_witness"></label>
        <label class="field">${esc(t(locale, "Chain of custody"))} <input type="text" name="chain_of_custody_ref"></label>
        <label class="field">${esc(t(locale, "Sealed container"))} <input type="text" name="sealed_container_ref"></label>
        <button type="submit">${esc(t(locale, "Save sample"))}</button>
      </form>`;
    })
    .join("");

  const manifestOrders = desk.orders.filter((o) => o.status === "sampled" && !o.manifest_id);
  const checks = manifestOrders
    .map(
      (order) => `<label><input type="checkbox" name="order_id" value="${esc(order.id)}" data-manifest-order="${esc(order.id)}"> ${esc(shortLotId(order.hbn, null))} · ${esc(order.lab_name)} · ${esc(order.pickup_date ?? "")} · ${esc(order.sample_tag ?? "")}</label>`
    )
    .join("");
  const manifestForm =
    manifestOrders.length === 0
      ? `<p class="muted">${esc(t(locale, "No orders."))}</p>`
      : `<form method="post" action="/testing/manifests" class="stack">
          ${checks}
          <label class="field">${esc(t(locale, "Lab"))} <select name="lab_id" required><option value=""></option>${labOptions(desk.labs)}</select></label>
          <label class="field">${esc(t(locale, "Manifest date"))} <input type="date" name="manifest_date" required></label>
          <label class="field">${esc(t(locale, "Driver"))} <input type="text" name="driver_name"></label>
          <label class="field">${esc(t(locale, "Driver license"))} <input type="text" name="driver_license"></label>
          <label class="field">${esc(t(locale, "Phone"))} <input type="text" name="driver_phone"></label>
          <label class="field">${esc(t(locale, "Vehicle make"))} <input type="text" name="vehicle_make"></label>
          <label class="field">${esc(t(locale, "Vehicle model"))} <input type="text" name="vehicle_model"></label>
          <label class="field">${esc(t(locale, "Plate"))} <input type="text" name="vehicle_plate"></label>
          <label class="field">${esc(t(locale, "Route note"))} <input type="text" name="route_note"></label>
          <button type="submit">${esc(t(locale, "Manifest"))}</button>
        </form>`;

  const manifestList = desk.manifests
    .map((row) => {
      const sent = row.order_status === "in_transit" || row.order_status === "at_lab" || row.order_status === "passed" || row.order_status === "failed";
      const atLab = row.order_status === "at_lab" || row.order_status === "passed" || row.order_status === "failed";
      const send = sent
        ? ""
        : `<form method="post" action="/testing/manifests/${esc(row.id)}/sent"><button type="submit">${esc(t(locale, "Mark sent"))}</button></form>`;
      const number = atLab
        ? `<p>${esc(t(locale, "Manifest number"))}: ${esc(row.metrc_manifest_number ?? "")}</p>`
        : `<form method="post" action="/testing/manifests/${esc(row.id)}/number" class="stack">
            <label class="field">${esc(t(locale, "Manifest number"))} <input type="text" name="metrc_manifest_number" required></label>
            <button type="submit">${esc(t(locale, "Save"))}</button>
          </form>`;
      return `<article data-manifest="${esc(row.id)}" data-manifest-status="${esc(row.order_status ?? "")}">
        <p>${esc(row.lab_name)} · ${esc(row.license_value)} · ${esc(row.manifest_date)} · ${esc(row.tags)}</p>
        <p><a href="/admin/uploads/test_sample/${esc(row.id)}.csv">${esc(t(locale, "Download"))}</a>
           · <a href="/testing/manifests/${esc(row.id)}/worksheet.csv">${esc(t(locale, "Worksheet"))}</a>
           · <a href="/testing/manifests/${esc(row.id)}">${esc(t(locale, "Print"))}</a></p>
        ${send}
        ${number}
      </article>`;
    })
    .join("");

  const resultOrders = desk.orders.filter((o) => o.status === "at_lab");
  const typeRows = TEST_TYPES.map(
    (type) => `<tr>
      <td>${esc(t(locale, TEST_TYPE_LABELS[type]))}</td>
      <td><select name="passed__${type}"><option value=""></option><option value="1">${esc(t(locale, "Pass"))}</option><option value="0">${esc(t(locale, "Fail"))}</option></select></td>
      <td><input type="text" name="value__${type}"></td>
    </tr>`
  ).join("");
  const resultForms = resultOrders
    .map(
      (order) => `<form method="post" action="/testing/results" class="stack" data-results-order="${esc(order.id)}">
        <input type="hidden" name="order_id" value="${esc(order.id)}">
        <p>${esc(shortLotId(order.hbn, null))} · ${esc(order.sample_tag ?? "")} · ${esc(order.lab_name)}</p>
        <table class="data"><thead><tr><th>${esc(t(locale, "Test"))}</th><th>${esc(t(locale, "Pass"))}</th><th>${esc(t(locale, "Value"))}</th></tr></thead><tbody>${typeRows}</tbody></table>
        <label class="field">${esc(t(locale, "THC total %"))} <input type="text" name="thc_total_pct"></label>
        <label class="field">${esc(t(locale, "THCa %"))} <input type="text" name="thca_pct"></label>
        <label class="field">${esc(t(locale, "CBD total %"))} <input type="text" name="cbd_total_pct"></label>
        <label class="field">${esc(t(locale, "Water activity"))} <input type="text" name="water_activity_aw"></label>
        <label class="field">${esc(t(locale, "COA link"))} <input type="text" name="coa_url"></label>
        <label class="field">${esc(t(locale, "Lab sample id"))} <input type="text" name="lab_sample_id"></label>
        <label class="field">${esc(t(locale, "Result date"))} <input type="date" name="result_date"></label>
        <label class="field">${esc(t(locale, "Failure note"))} <input type="text" name="failure_note"></label>
        <button type="submit">${esc(t(locale, "Save results"))}</button>
      </form>`
    )
    .join("");

  const failedOrders = desk.orders.filter((o) => o.status === "failed");
  const failedBlocks = failedOrders
    .map(
      (order) => `<article data-failed-order="${esc(order.id)}" data-order-source="${esc(order.source ?? "desk")}">
        <p>${esc(shortLotId(order.hbn, null))} · ${esc(order.failed_types)} · ${esc(order.failure_note ?? "")}</p>
        <p>${esc(t(locale, RETEST_WORDS))}</p>
        <form method="post" action="/testing/orders/${esc(order.id)}/retest" class="stack">
          <label class="field">${esc(t(locale, "Pickup date"))} <input type="date" name="pickup_date" required></label>
          <button type="submit">${esc(t(locale, "Schedule retest"))}</button>
        </form>
        <form method="post" action="/testing/orders/${esc(order.id)}/remediate" class="stack">
          <label class="field">${esc(t(locale, "Reason"))} <input type="text" name="reason" required></label>
          <label class="field">${esc(t(locale, "CRA approval"))} <input type="text" name="cra_approval_ref" required></label>
          <label class="field">${esc(t(locale, "Date"))} <input type="date" name="remediated_date" required></label>
          <button type="submit">${esc(t(locale, "Mark remediated"))}</button>
        </form>
      </article>`
    )
    .join("");

  const passed = desk.orders.filter((o) => o.status === "passed" || o.status === "remediated");
  const passedList = passed
    .map(
      (order) => `<li data-closed-order="${esc(order.id)}" data-order-status="${esc(order.status)}" data-order-source="${esc(order.source ?? "desk")}">${esc(shortLotId(order.hbn, null))} · ${esc(t(locale, STATUS_LABEL[order.status] ?? order.status))}${
        order.source === "sheet" ? ` · ${esc(t(locale, "sheet"))}` : ""
      } · ${esc(order.sample_tag ?? "")}</li>`
    )
    .join("");

  const portals = desk.labs
    .filter((lab) => lab.portal_url)
    .map((lab) => `<a href="${esc(lab.portal_url)}">${esc(lab.name)}</a>`)
    .join(" · ");

  return `<div class="testing-desk" data-testing-desk>
    <h1>${esc(t(locale, "Testing desk"))}</h1>
    <p>${esc(t(locale, PORTAL_WORDS))}</p>
    <p>${portals}</p>
    <h2>${esc(t(locale, "Ready to schedule"))}</h2>
    ${readyTable}
    <h2>${esc(t(locale, "Sample"))}</h2>
    ${sampleRows || `<p class="muted">${esc(t(locale, "No orders."))}</p>`}
    <h2>${esc(t(locale, "Manifest"))}</h2>
    ${manifestForm}
    ${manifestList}
    <h2>${esc(t(locale, "Results"))}</h2>
    ${resultForms || `<p class="muted">${esc(t(locale, "No orders."))}</p>`}
    <h2>${esc(t(locale, "Failed"))}</h2>
    ${failedBlocks || `<p class="muted">${esc(t(locale, "No orders."))}</p>`}
    <h2>${esc(t(locale, "Closed"))}</h2>
    ${passedList ? `<ul>${passedList}</ul>` : `<p class="muted">${esc(t(locale, "No orders."))}</p>`}
  </div>`;
}

const PORTAL_KINDS = ["tagleaf", "slingr", "other"] as const;

function labForm(lab: TestingLab | null, locale: Locale): string {
  const id = lab?.id ?? "";
  const kind = lab?.portal_kind ?? "other";
  const kinds = PORTAL_KINDS.map(
    (k) => `<option value="${k}"${k === kind ? " selected" : ""}>${k}</option>`
  ).join("");
  const active = !lab || Number(lab.active) === 1 ? " checked" : "";
  return `<form method="post" action="/admin/lookups/testing_labs" class="stack" data-lab-row="${esc(id)}" data-active="${lab ? String(lab.active) : "1"}">
    <input type="hidden" name="id" value="${esc(id)}">
    <label class="field">${esc(t(locale, "Name"))} <input type="text" name="name" required value="${esc(lab?.name ?? "")}"></label>
    <label class="field">${esc(t(locale, "Portal"))} <select name="portal_kind">${kinds}</select></label>
    <label class="field">${esc(t(locale, "Portal URL"))} <input type="text" name="portal_url" value="${esc(lab?.portal_url ?? "")}"></label>
    <label class="field">${esc(t(locale, "Med license"))} <input type="text" name="med_license" value="${esc(lab?.med_license ?? "")}"></label>
    <label class="field">${esc(t(locale, "Adult-use license"))} <input type="text" name="au_license" value="${esc(lab?.au_license ?? "")}"></label>
    <label class="field">${esc(t(locale, "Turnaround days"))} <input type="number" name="turnaround_days" min="1" step="1" value="${esc(lab?.turnaround_days ?? "")}"></label>
    <label class="field">${esc(t(locale, "Pickup cutoff"))} <input type="text" name="pickup_cutoff" value="${esc(lab?.pickup_cutoff ?? "")}"></label>
    <label class="field">${esc(t(locale, "Sample increment (g)"))} <input type="number" name="sample_increment_grams" min="1" step="1" value="${esc(lab?.sample_increment_grams ?? "")}"></label>
    <label class="field"><span><input type="checkbox" name="active" value="1"${active}> ${esc(t(locale, "Active"))}</span></label>
    <button type="submit">${esc(t(locale, lab ? "Save lab" : "Add lab"))}</button>
  </form>`;
}

export function testingLabsPage(labs: TestingLab[], locale: Locale): string {
  const blocks = labs.map((lab) => labForm(lab, locale)).join("");
  return `<div class="testing-desk" data-testing-labs>
    <h1>${esc(t(locale, "Testing labs"))}</h1>
    <p class="muted">${esc(t(locale, "The desk's labs. Driver names stay off this page; a manifest types its own driver."))}</p>
    ${blocks}
    <h2>${esc(t(locale, "Add lab"))}</h2>
    ${labForm(null, locale)}
  </div>`;
}
