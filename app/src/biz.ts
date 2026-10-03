import { HttpError, nowIso, parseGrams, requireReason, requireText, textOrNull } from "./audit";
import { CONFIG_KEYS, ITEM_KIND_FG, ITEM_KIND_WIP, roundGrams, SYSTEM_REASON } from "./config";
import { parseInstrumentCsv, isInstrumentSource, IMPORT_STATUS, assertImportUpload, importBasename } from "./imports";
import { LABEL_FIELD_KEYS, type LabelFieldKey, serializeLabelFields, stockMm } from "./labels";
import { mintSoNumber, splitChildCode } from "./marketplace";
import { dollarsToCents, mintPoNumber } from "./purchasing";
import {
  getConfigValue,
  getRow,
  insertLog,
  listSplitChildren,
  logsForInsert,
  maxPoSeq,
  maxSoSeq,
  newestFinishedInternalAudit,
  requireActor,
} from "./db";
import { auditUpToDate, ftqRate, gramsToLbs, internalAuditIntervalDays, paretoFromFailures } from "./compliance";
import { LAB_ATTEMPT_SQL, LAB_CONSOLE_SET_SQL, LAB_OUTCOME_SQL } from "./labvocab";

export type ActionOk = { redirect: string };

function personIdFrom(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

/** THE LAB STATION (canon 0.30.362). The Compliance Console reads the lab
 * station's compliance samples (labvocab's set: R&D out, voided out). Lbs in
 * testing is the batch weight of the samples in_testing. The pareto splits each
 * failed sample's fail_reason on commas (V19). The FTQ is first tests only (a
 * status that is not a retest one), all seasons (V19 law 5); an open first test
 * stays out of the denominator. */
export async function loadComplianceKpis(db: D1Database) {
  const inTesting = await db
    .prepare(
      `SELECT batch_weight_g FROM lab_compliance_samples
       WHERE ${LAB_CONSOLE_SET_SQL} AND status = 'in_testing'`
    )
    .all<{ batch_weight_g: number | null }>();
  const grams = (inTesting.results ?? []).reduce((sum, row) => sum + (Number.isFinite(Number(row.batch_weight_g)) ? Number(row.batch_weight_g) : 0), 0);
  const lbs = { grams: roundGrams(grams), lbs: gramsToLbs(grams), source: "external" as const };
  const failed = await db
    .prepare(
      `SELECT fail_reason FROM lab_compliance_samples
       WHERE ${LAB_CONSOLE_SET_SQL}
         AND ${LAB_OUTCOME_SQL} = 'failed'
         AND fail_reason IS NOT NULL AND trim(fail_reason) <> ''`
    )
    .all<{ fail_reason: string }>();
  const ftqRows = await db
    .prepare(
      `SELECT sample_tag, ${LAB_ATTEMPT_SQL} AS attempt, ${LAB_OUTCOME_SQL} AS status
       FROM lab_compliance_samples
       WHERE ${LAB_CONSOLE_SET_SQL}
         AND sample_tag IS NOT NULL AND trim(sample_tag) <> ''
       ORDER BY scheduled_at, id`
    )
    .all<{ sample_tag: string; attempt: number; status: string | null }>();
  const interval = internalAuditIntervalDays(
    await getConfigValue(db, CONFIG_KEYS.internal_audit_interval_days)
  );
  return {
    lbs,
    pareto: paretoFromFailures((failed.results ?? []).map((row) => row.fail_reason)),
    ftq: ftqRate(ftqRows.results ?? []),
    audit: auditUpToDate(await newestFinishedInternalAudit(db), interval),
  };
}

export async function startAudit(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const kind = requireText(form.get("kind"), "Kind");
  if (kind !== "internal" && kind !== "external") throw new HttpError(400, "Kind must be internal or external.");
  const id = crypto.randomUUID();
  const ts = nowIso();
  const gripRep = textOrNull(form.get("grip_rep")) ?? actor.display_name;
  const agency = kind === "external" ? requireText(form.get("agency"), "Agency") : null;
  const contact = textOrNull(form.get("agency_contact"));
  const record = { id, kind, agency, agency_contact: contact, grip_rep: gripRep, started_at: ts, created_at: ts, created_by: actor.id };
  await db.batch([
    db
      .prepare(
        `INSERT INTO audits (
          id, kind, agency, agency_contact, grip_rep, started_at, finished_at,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, kind, agency, contact, gripRep, ts, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "audits", id, record, actor.id, SYSTEM_REASON.create, ts),
  ]);
  return { redirect: `/compliance/audits?kind=${kind}&audit=${id}` };
}

export async function saveAuditHeader(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const existing = await getRow(db, "audits", id);
  if (!existing || existing.deleted_at) throw new HttpError(404, "Record not found.");
  const ts = nowIso();
  const agency = requireText(form.get("agency"), "Agency");
  const contact = textOrNull(form.get("agency_contact"));
  const gripRep = requireText(form.get("grip_rep"), "Grip Rep");
  await db.batch([
    db
      .prepare(
        `UPDATE audits SET agency = ?, agency_contact = ?, grip_rep = ?, updated_at = ?, updated_by = ? WHERE id = ?`
      )
      .bind(agency, contact, gripRep, ts, actor.id, id),
    insertLog(db, {
      record_table: "audits",
      record_id: id,
      field: "agency",
      old_value: existing.agency == null ? null : String(existing.agency),
      new_value: agency,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.create,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/compliance/audits?kind=external&audit=${id}` };
}

export async function addAuditNote(db: D1Database, auditId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const audit = await getRow(db, "audits", auditId);
  if (!audit || audit.deleted_at) throw new HttpError(404, "Record not found.");
  const body = requireText(form.get("body"), "Note");
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = { id, audit_id: auditId, body, created_at: ts, created_by: actor.id };
  await db.batch([
    db
      .prepare(
        `INSERT INTO audit_notes (
          id, audit_id, body, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, auditId, body, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "audit_notes", id, record, actor.id, SYSTEM_REASON.create, ts),
  ]);
  const kind = String(audit.kind);
  const rapid = String(form.get("rapid_add") ?? "") === "1" ? "&rapid=1" : "";
  return { redirect: `/compliance/audits?kind=${kind}&audit=${auditId}${rapid}` };
}

export async function finishAudit(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const existing = await getRow(db, "audits", id);
  if (!existing || existing.deleted_at) throw new HttpError(404, "Record not found.");
  if (existing.finished_at) throw new HttpError(400, "That audit is already finished.");
  const ts = nowIso();
  await db.batch([
    db.prepare(`UPDATE audits SET finished_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(ts, ts, actor.id, id),
    insertLog(db, {
      record_table: "audits",
      record_id: id,
      field: "finished_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.create,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/compliance/audits?kind=${String(existing.kind)}` };
}

export async function queueInstrumentImport(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const sourceRaw = requireText(form.get("source"), "Source");
  if (!isInstrumentSource(sourceRaw)) throw new HttpError(400, "Source must be orange_photonics or aqualab.");
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(400, "A file is required.");
  const filename = importBasename(file.name);
  const buf = new Uint8Array(await file.arrayBuffer());
  assertImportUpload(filename, buf.byteLength);
  const text = new TextDecoder().decode(buf);
  const parsed = parseInstrumentCsv(sourceRaw, text);
  if (parsed.error) throw new HttpError(400, parsed.error);
  const importId = crypto.randomUUID();
  const ts = nowIso();
  const stmts = [
    db
      .prepare(
        `INSERT INTO import_queue (
          id, filename, kind, byte_size, content, status, notes,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, 'csv', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(importId, filename, buf.byteLength, buf, IMPORT_STATUS.queued, sourceRaw, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "import_queue",
      importId,
      { id: importId, filename, kind: "csv", status: IMPORT_STATUS.queued, notes: sourceRaw },
      actor.id,
      SYSTEM_REASON.import_queued,
      ts
    ),
  ];
  for (const row of parsed.rows) {
    const id = crypto.randomUUID();
    const record = { id, source: sourceRaw, ...row, import_id: importId, created_at: ts, created_by: actor.id };
    stmts.push(
      db
        .prepare(
          `INSERT INTO internal_test_results (
            id, source, package_tag, hbn, sample_id, tested_at, analyte, value, unit, import_id,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(
          id,
          sourceRaw,
          row.package_tag,
          row.hbn,
          row.sample_id,
          row.tested_at,
          row.analyte,
          row.value,
          row.unit,
          importId,
          ts,
          actor.id,
          ts,
          actor.id
        ),
      ...logsForInsert(db, "internal_test_results", id, record, actor.id, SYSTEM_REASON.instrument_parsed, ts)
    );
  }
  await db.batch(stmts);
  return {
    redirect: `/compliance/testing?tab=internal&ok=parsed&parsed=${parsed.parsed}&skipped=${parsed.skipped}`,
  };
}

export async function saveExternalResult(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  requireReason(textOrNull(form.get("reason")));
  const sampleTag = requireText(form.get("sample_tag"), "Sample Tag");
  let attempt = Number(form.get("attempt") ?? 1);
  if (!Number.isInteger(attempt) || attempt < 1) attempt = 1;
  const existing = await db
    .prepare(
      `SELECT MAX(attempt) AS m FROM external_test_results
       WHERE deleted_at IS NULL AND sample_tag = ?`
    )
    .bind(sampleTag)
    .first<{ m: number | null }>();
  if (existing?.m && attempt <= Number(existing.m)) attempt = Number(existing.m) + 1;
  const id = crypto.randomUUID();
  const ts = nowIso();
  const num = (name: string) => {
    const v = textOrNull(form.get(name));
    return v == null ? null : Number(v);
  };
  const record = {
    id,
    license_number: textOrNull(form.get("license_number")),
    med_au: textOrNull(form.get("med_au")),
    strain: textOrNull(form.get("strain")),
    item_name: textOrNull(form.get("item_name")),
    source_metrc_tag: textOrNull(form.get("source_metrc_tag")),
    batch_weight_grams: num("batch_weight_grams"),
    hbn: textOrNull(form.get("hbn")),
    sample_tag: sampleTag,
    required_test: textOrNull(form.get("required_test")),
    net_weight_grams: num("net_weight_grams"),
    testing_facility: textOrNull(form.get("testing_facility")),
    entered_testing: textOrNull(form.get("entered_testing")),
    finished_testing: textOrNull(form.get("finished_testing")),
    attempt,
    potency_result: num("potency_result"),
    finalized_potency: num("finalized_potency"),
    status: textOrNull(form.get("status")) ?? "Pending",
    failure_mode: textOrNull(form.get("failure_mode")),
    created_at: ts,
    created_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO external_test_results (
          id, license_number, med_au, strain, item_name, source_metrc_tag, batch_weight_grams, hbn,
          sample_tag, required_test, net_weight_grams, testing_facility, entered_testing, finished_testing,
          attempt, potency_result, finalized_potency, status, failure_mode,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(
        id,
        record.license_number,
        record.med_au,
        record.strain,
        record.item_name,
        record.source_metrc_tag,
        record.batch_weight_grams,
        record.hbn,
        sampleTag,
        record.required_test,
        record.net_weight_grams,
        record.testing_facility,
        record.entered_testing,
        record.finished_testing,
        attempt,
        record.potency_result,
        record.finalized_potency,
        record.status,
        record.failure_mode,
        ts,
        actor.id,
        ts,
        actor.id
      ),
    ...logsForInsert(db, "external_test_results", id, record, actor.id, requireReason(textOrNull(form.get("reason"))), ts),
  ]);
  return { redirect: "/compliance/testing?tab=external&ok=saved" };
}

export async function saveLabelTemplate(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const name = requireText(form.get("name"), "Name");
  const stock = textOrNull(form.get("stock")) ?? "";
  const mm = stockMm(stock, textOrNull(form.get("width_mm")), textOrNull(form.get("height_mm")));
  const picked = form.getAll("field").map((v) => String(v)).filter((k): k is LabelFieldKey =>
    (LABEL_FIELD_KEYS as readonly string[]).includes(k)
  );
  const fields_json = serializeLabelFields({
    fields: picked,
    free_text: textOrNull(form.get("free_text")) ?? undefined,
    barcode_mode: (textOrNull(form.get("barcode_mode")) as "1d" | "2d" | "both") ?? "1d",
  });
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = { id, name, width_mm: mm.width_mm, height_mm: mm.height_mm, fields_json, created_at: ts };
  await db.batch([
    db
      .prepare(
        `INSERT INTO label_templates (
          id, name, width_mm, height_mm, fields_json,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, name, mm.width_mm, mm.height_mm, fields_json, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "label_templates", id, record, actor.id, SYSTEM_REASON.create, ts),
  ]);
  return { redirect: "/compliance/labels?ok=saved" };
}

export async function addSupplier(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const company = requireText(form.get("company_name"), "Company");
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    company_name: company,
    main_contact: textOrNull(form.get("main_contact")),
    phone: textOrNull(form.get("phone")),
    notes: textOrNull(form.get("notes")),
    status: "active",
    created_at: ts,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO suppliers (
          id, company_name, main_contact, phone, notes, status,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, company, record.main_contact, record.phone, record.notes, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "suppliers", id, record, actor.id, SYSTEM_REASON.create, ts),
  ]);
  const next = textOrNull(form.get("next")) ?? "/purchasing/suppliers";
  return { redirect: `${next}?ok=saved` };
}

export async function deactivateSupplier(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const existing = await getRow(db, "suppliers", id);
  if (!existing || existing.deleted_at) throw new HttpError(404, "Record not found.");
  const ts = nowIso();
  await db.batch([
    db.prepare(`UPDATE suppliers SET status = 'inactive', updated_at = ?, updated_by = ? WHERE id = ?`).bind(ts, actor.id, id),
    insertLog(db, {
      record_table: "suppliers",
      record_id: id,
      field: "status",
      old_value: String(existing.status ?? ""),
      new_value: "inactive",
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: "/purchasing/suppliers?ok=saved" };
}

export async function createPurchaseOrder(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const name = requireText(form.get("name"), "Name");
  const supplierId = requireText(form.get("supplier_id"), "Supplier");
  const farm = textOrNull(form.get("farm")) ?? "PNN";
  const year = new Date().getUTCFullYear();
  const yy = String(year).slice(-2);
  const seq = (await maxPoSeq(db, farm, yy)) + 1;
  const poNumber = mintPoNumber(farm, year, seq);
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    po_number: poNumber,
    name,
    po_class: textOrNull(form.get("po_class")),
    project: textOrNull(form.get("project")),
    supplier_id: supplierId,
    status: "draft",
    created_at: ts,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO purchase_orders (
          id, po_number, name, po_class, project, supplier_id, status, issued_at, closed_at,
          eval_quality, eval_documents, eval_timing, eval_notes,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, poNumber, name, record.po_class, record.project, supplierId, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "purchase_orders", id, record, actor.id, SYSTEM_REASON.create, ts),
  ]);
  return { redirect: `/purchasing/po/${id}` };
}

export async function addPoLine(db: D1Database, poId: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const po = await getRow(db, "purchase_orders", poId);
  if (!po || po.deleted_at) throw new HttpError(404, "Record not found.");
  const description = requireText(form.get("description"), "Description");
  const qty = Number(form.get("qty") ?? 0);
  const cents = dollarsToCents(String(form.get("unit_price") ?? "0"));
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    purchase_order_id: poId,
    item_code: textOrNull(form.get("item_code")),
    description,
    uom: textOrNull(form.get("uom")) ?? "each",
    qty,
    unit_price_cents: cents,
    created_at: ts,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO purchase_order_lines (
          id, purchase_order_id, item_code, description, uom, qty, unit_price_cents,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, poId, record.item_code, description, record.uom, qty, cents, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "purchase_order_lines", id, record, actor.id, SYSTEM_REASON.create, ts),
  ]);
  const rapid = String(form.get("rapid_add") ?? "") === "1" ? "&rapid=1" : "";
  return { redirect: `/purchasing/po/${poId}?ok=saved${rapid}` };
}

async function setPoStatus(db: D1Database, id: string, form: FormData, status: string, extra: Record<string, string | null>): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = status === "open" ? SYSTEM_REASON.create : requireReason(textOrNull(form.get("reason")));
  const existing = await getRow(db, "purchase_orders", id);
  if (!existing || existing.deleted_at) throw new HttpError(404, "Record not found.");
  const ts = nowIso();
  const issued = extra.issued_at ?? (existing.issued_at as string | null);
  const closed = extra.closed_at ?? (existing.closed_at as string | null);
  await db.batch([
    db
      .prepare(`UPDATE purchase_orders SET status = ?, issued_at = ?, closed_at = ?, updated_at = ?, updated_by = ? WHERE id = ?`)
      .bind(status, issued, closed, ts, actor.id, id),
    insertLog(db, {
      record_table: "purchase_orders",
      record_id: id,
      field: "status",
      old_value: String(existing.status ?? ""),
      new_value: status,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/purchasing/po/${id}?ok=saved` };
}

export async function issuePurchaseOrder(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const existing = await getRow(db, "purchase_orders", id);
  if (!existing || existing.status !== "draft") throw new HttpError(400, "Only a draft can be issued.");
  return setPoStatus(db, id, form, "open", { issued_at: nowIso() });
}

export async function closePurchaseOrder(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const existing = await getRow(db, "purchase_orders", id);
  if (!existing || existing.status !== "open") throw new HttpError(400, "Only an open PO can be closed.");
  return setPoStatus(db, id, form, "closed", { closed_at: nowIso() });
}

export async function cancelPurchaseOrder(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const existing = await getRow(db, "purchase_orders", id);
  if (!existing || existing.status !== "open") throw new HttpError(400, "Only an open PO can be cancelled.");
  return setPoStatus(db, id, form, "cancelled", { closed_at: nowIso() });
}

export async function savePoEval(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const existing = await getRow(db, "purchase_orders", id);
  if (!existing || existing.status !== "closed") throw new HttpError(400, "Evaluation saves on a closed PO.");
  const ts = nowIso();
  const quality = Number(form.get("eval_quality") ?? 0);
  const documents = Number(form.get("eval_documents") ?? 0);
  const timing = Number(form.get("eval_timing") ?? 0);
  const notes = textOrNull(form.get("eval_notes"));
  await db.batch([
    db
      .prepare(
        `UPDATE purchase_orders SET eval_quality = ?, eval_documents = ?, eval_timing = ?, eval_notes = ?, updated_at = ?, updated_by = ? WHERE id = ?`
      )
      .bind(quality, documents, timing, notes, ts, actor.id, id),
    insertLog(db, {
      record_table: "purchase_orders",
      record_id: id,
      field: "eval_quality",
      old_value: existing.eval_quality == null ? null : String(existing.eval_quality),
      new_value: String(quality),
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/purchasing/po/${id}?ok=saved` };
}

export async function addListing(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const item = requireText(form.get("item_name"), "Item");
  const label = textOrNull(form.get("package_label"));
  const packageItemId = textOrNull(form.get("package_item_id"));
  const category = textOrNull(form.get("category"));
  const fromSplitChild = String(form.get("from_split_child") ?? "") === "1";
  const qty = parseGrams(form.get("qty_grams"), "Quantity grams");
  if (fromSplitChild && !packageItemId) {
    throw new HttpError(400, "A listing from a split child needs the internal package.");
  }
  let linked: Record<string, unknown> | null = null;
  if (packageItemId) {
    linked = await getRow(db, "local_inventory_items", packageItemId);
    if (!linked || linked.deleted_at) throw new HttpError(400, "Unknown inventory item.");
    if (fromSplitChild && !linked.parent_item_id) {
      throw new HttpError(400, "A listing from a split child needs the internal package.");
    }
  }
  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    item_name: item,
    package_label: label,
    package_item_id: packageItemId,
    category,
    qty_grams: qty,
    listed: 1,
    created_at: ts,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO listings (
          id, item_name, package_tag, package_label, package_item_id, category, qty_grams, listed,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, 1, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, item, label, packageItemId, category, qty, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "listings", id, record, actor.id, SYSTEM_REASON.create, ts),
  ]);
  return { redirect: "/marketplace?pane=listings&ok=saved" };
}

export async function toggleListing(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const existing = await getRow(db, "listings", id);
  if (!existing || existing.deleted_at) throw new HttpError(404, "Record not found.");
  const listed = String(form.get("listed") ?? "0") === "1" ? 1 : 0;
  const ts = nowIso();
  await db.batch([
    db.prepare(`UPDATE listings SET listed = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(listed, ts, actor.id, id),
    insertLog(db, {
      record_table: "listings",
      record_id: id,
      field: "listed",
      old_value: String(existing.listed ?? ""),
      new_value: String(listed),
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: "/marketplace?pane=listings&ok=saved" };
}

export async function createSalesOrder(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const buyer = requireText(form.get("buyer"), "Buyer");
  const listingId = requireText(form.get("listing_id"), "Listing");
  const qty = parseGrams(form.get("qty_grams"), "Quantity grams");
  const year = new Date().getUTCFullYear();
  const yy = String(year).slice(-2);
  const seq = (await maxSoSeq(db, yy)) + 1;
  const soNumber = mintSoNumber(year, seq);
  const id = crypto.randomUUID();
  const lineId = crypto.randomUUID();
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO sales_orders (
          id, so_number, buyer, status, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, 'new', ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(id, soNumber, buyer, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "sales_orders", id, { id, so_number: soNumber, buyer, status: "new" }, actor.id, SYSTEM_REASON.create, ts),
    db
      .prepare(
        `INSERT INTO sales_order_lines (
          id, sales_order_id, listing_id, qty_grams,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
      )
      .bind(lineId, id, listingId, qty, ts, actor.id, ts, actor.id),
  ]);
  return { redirect: `/marketplace/orders/${id}` };
}

export async function stepSalesOrder(db: D1Database, id: string, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const next = requireText(form.get("status"), "Status");
  const existing = await getRow(db, "sales_orders", id);
  if (!existing || existing.deleted_at) throw new HttpError(404, "Record not found.");
  const from = String(existing.status);
  const allowed =
    (from === "new" && (next === "confirmed" || next === "cancelled")) ||
    (from === "confirmed" && (next === "fulfilled" || next === "cancelled"));
  if (!allowed) throw new HttpError(400, "That status step is not allowed.");
  const ts = nowIso();
  await db.batch([
    db.prepare(`UPDATE sales_orders SET status = ?, updated_at = ?, updated_by = ? WHERE id = ?`).bind(next, ts, actor.id, id),
    insertLog(db, {
      record_table: "sales_orders",
      record_id: id,
      field: "status",
      old_value: from,
      new_value: next,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/marketplace/orders/${id}?ok=saved` };
}

export async function splitPackage(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const parentId = requireText(form.get("parent_item_id"), "Parent package");
  const parent = await getRow(db, "local_inventory_items", parentId);
  if (!parent || parent.deleted_at) throw new HttpError(404, "Unknown inventory item.");
  const kind = String(parent.item_kind ?? "");
  if (kind !== ITEM_KIND_FG && kind !== ITEM_KIND_WIP) {
    throw new HttpError(400, "Split only from FG or WIP.");
  }
  const rawQtys = form.getAll("child_qty_grams").map((v) => String(v).trim());
  const rawNotes = form.getAll("child_label_note").map((v) => String(v).trim());
  while (rawNotes.length < rawQtys.length) rawNotes.push("");
  const qtys: number[] = [];
  const notes: string[] = [];
  for (let i = 0; i < rawQtys.length; i++) {
    const blank = !rawQtys[i] && !rawNotes[i];
    if (blank) continue;
    if (!rawQtys[i]) throw new HttpError(400, "Each split child needs a quantity.");
    qtys.push(parseGrams(rawQtys[i], "Child quantity grams"));
    notes.push(rawNotes[i] ?? "");
  }
  const plusOne = String(form.get("plus_one") ?? "") === "1";
  if (qtys.length === 0) {
    if (plusOne) throw new HttpError(400, "Type a quantity before pressing the plus.");
    throw new HttpError(400, "Add at least one split child.");
  }
  const existing = await listSplitChildren(db, parentId);
  const ts = nowIso();
  const stmts: D1PreparedStatement[] = [];
  let parentQty = Number(parent.qty);
  for (let i = 0; i < qtys.length; i++) {
    const n = existing.length + i + 1;
    const childId = crypto.randomUUID();
    const code = splitChildCode(String(parent.package_code), n);
    const qty = qtys[i];
    const note = notes[i] ?? "";
    parentQty = roundGrams(parentQty - qty);
    const child = {
      id: childId,
      item_kind: parent.item_kind,
      package_code: code,
      harvest_batch_id: parent.harvest_batch_id,
      wet_weight_entry_id: parent.wet_weight_entry_id,
      wip_package_id: parent.wip_package_id,
      strain_id: parent.strain_id,
      qty,
      uom: parent.uom ?? "g",
      farm_code: parent.farm_code,
      license_value: parent.license_value,
      location: parent.location,
      parent_item_id: parentId,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO local_inventory_items (
            id, item_kind, package_code, harvest_batch_id, wet_weight_entry_id, wip_package_id,
            strain_id, qty, uom, farm_code, license_value, location, parent_item_id,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by, delete_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`
        )
        .bind(
          childId,
          child.item_kind,
          child.package_code,
          child.harvest_batch_id,
          child.wet_weight_entry_id,
          child.wip_package_id,
          child.strain_id,
          child.qty,
          child.uom,
          child.farm_code,
          child.license_value,
          child.location,
          parentId,
          ts,
          actor.id,
          ts,
          actor.id
        ),
      ...logsForInsert(db, "local_inventory_items", childId, { ...child, note }, actor.id, SYSTEM_REASON.inv_split, ts)
    );
  }
  stmts.push(
    db
      .prepare(
        `UPDATE local_inventory_items SET qty = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(parentQty, ts, actor.id, parentId),
    insertLog(db, {
      record_table: "local_inventory_items",
      record_id: parentId,
      field: "qty",
      old_value: String(parent.qty),
      new_value: String(parentQty),
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.inv_split,
      changed_at: ts,
    }),
    insertLog(db, {
      record_table: "local_inventory_items",
      record_id: parentId,
      field: "split",
      old_value: null,
      new_value: String(qtys.length),
      actor_person_id: actor.id,
      reason: SYSTEM_REASON.inv_split,
      changed_at: ts,
    })
  );
  await db.batch(stmts);
  return { redirect: `/marketplace?pane=listings&split=${encodeURIComponent(parentId)}&ok=split` };
}
