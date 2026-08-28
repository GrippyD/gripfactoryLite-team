import {
  applyTransition,
  HARVEST_STATUS,
  initialWipStatus,
  isTestOutcome,
  LOT_STATUS,
  roundGrams,
  SYSTEM_REASON,
  type TransitionName,
} from "./config";
import { HttpError, nowIso, parseGrams, requireReason, requireText, textOrNull } from "./audit";
import { assertHbnAvailable, harvestYearFromEntryDate, HbnCollisionError, mintHbn, nextLotSerial } from "./mint";
import {
  assertTable,
  getHarvestByHbn,
  getRow,
  insertLog,
  logsForInsert,
  requireActor,
} from "./db";
import { EDITABLE_FIELDS } from "./pipeline";

export type ActionOk = { redirect: string };

function personIdFrom(form: FormData): string | null {
  return textOrNull(form.get("person_id"));
}

function checkbox01(form: FormData, name: string): number {
  const v = form.get(name);
  return v === "1" || v === "on" ? 1 : 0;
}

function nextStatus(name: TransitionName, status: string): string {
  try {
    return applyTransition(name, status);
  } catch (err) {
    throw new HttpError(409, err instanceof Error ? err.message : "Invalid status transition.");
  }
}

export async function createHarvestBatch(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const entryDate = requireText(form.get("entry_date"), "Date");
  const farmCode = requireText(form.get("farm_code"), "Farm");
  const growMethodCode = requireText(form.get("grow_method_code"), "Grow Method");
  const strainId = requireText(form.get("strain_id"), "Strain");
  const manicure = checkbox01(form, "manicure") as 0 | 1;
  const siloNumber = textOrNull(form.get("silo_number"));
  const startTime = textOrNull(form.get("start_time"));
  const zone = textOrNull(form.get("zone"));
  const rowsText = textOrNull(form.get("rows_text"));
  const metrc = textOrNull(form.get("metrc_harvest_tag"));

  const grow = await db
    .prepare(`SELECT hbn_code FROM grow_methods WHERE code = ? AND deleted_at IS NULL`)
    .bind(growMethodCode)
    .first<{ hbn_code: string }>();
  if (!grow) throw new HttpError(400, "Unknown grow method.");
  const strain = await db
    .prepare(`SELECT hbn_code FROM strains WHERE id = ? AND deleted_at IS NULL`)
    .bind(strainId)
    .first<{ hbn_code: string }>();
  if (!strain) throw new HttpError(400, "Unknown strain.");

  const harvestYear = harvestYearFromEntryDate(entryDate);
  const id = crypto.randomUUID();
  const ts = nowIso();
  const maxAttempts = 8;
  let hbn = "";
  let lotSerial = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Next serial is 1 + MAX for this harvest_year, including voided rows (no reuse).
    // Insert and log rows share one db.batch(). UNIQUE(harvest_year, lot_serial) plus
    // retry stops two stations from keeping the same serial.
    const maxRow = await db
      .prepare(`SELECT MAX(lot_serial) AS m FROM harvest_batches WHERE harvest_year = ?`)
      .bind(harvestYear)
      .first<{ m: number | null }>();
    lotSerial = nextLotSerial(maxRow?.m ?? null);
    hbn = mintHbn({
      entryDate,
      farmCode,
      growHbnCode: grow.hbn_code,
      strainHbnCode: strain.hbn_code,
      manicure,
      siloNumber,
      lotSerial,
    });
    try {
      assertHbnAvailable(await getHarvestByHbn(db, hbn), hbn);
    } catch (err) {
      if (err instanceof HbnCollisionError && attempt < maxAttempts - 1) continue;
      if (err instanceof HbnCollisionError) throw new HttpError(409, err.message);
      throw err;
    }

    const record = {
      id,
      entry_date: entryDate,
      farm_code: farmCode,
      grow_method_code: growMethodCode,
      strain_id: strainId,
      manicure,
      silo_number: siloNumber,
      start_time: startTime,
      zone,
      rows_text: rowsText,
      metrc_harvest_tag: metrc,
      hbn,
      lot_serial: lotSerial,
      harvest_year: harvestYear,
      status: HARVEST_STATUS.open,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    const stmts: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO harvest_batches (
          id, entry_date, farm_code, grow_method_code, strain_id, manicure, silo_number,
          start_time, zone, rows_text, metrc_harvest_tag, hbn, lot_serial, harvest_year, status,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(
          id,
          entryDate,
          farmCode,
          growMethodCode,
          strainId,
          manicure,
          siloNumber,
          startTime,
          zone,
          rowsText,
          metrc,
          hbn,
          lotSerial,
          harvestYear,
          HARVEST_STATUS.open,
          ts,
          actor.id,
          ts,
          actor.id
        ),
      ...logsForInsert(db, "harvest_batches", id, record, actor.id, SYSTEM_REASON.create, ts),
    ];
    try {
      await db.batch(stmts);
      return { redirect: `/station/acquire_hbn?minted=${encodeURIComponent(hbn)}` };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("unique") && attempt < maxAttempts - 1) {
        continue;
      }
      if (message.toLowerCase().includes("unique")) {
        throw new HttpError(
          409,
          `HBN already exists: ${hbn}. The mint was not changed. Adjust the batch fields and try again.`
        );
      }
      throw err;
    }
  }
  throw new HttpError(409, `Could not allocate a lot serial for ${harvestYear}.`);
}

export async function createWetWeight(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const harvestBatchId = requireText(form.get("harvest_batch_id"), "HBN");
  const weight = parseGrams(form.get("weight_grams"), "Weight");
  const drySpaceId = requireText(form.get("dry_space_id"), "Dry space");
  const notes = textOrNull(form.get("notes"));
  const batch = await db
    .prepare(
      `SELECT id, status FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(harvestBatchId)
    .first<{ id: string; status: string }>();
  if (!batch) throw new HttpError(400, "Unknown harvest batch.");
  if (batch.status !== HARVEST_STATUS.open) {
    throw new HttpError(400, "That batch is not in the HBN Queue.");
  }
  const space = await db
    .prepare(`SELECT id FROM dry_spaces WHERE id = ? AND deleted_at IS NULL`)
    .bind(drySpaceId)
    .first<{ id: string }>();
  if (!space) throw new HttpError(400, "Unknown dry space.");

  const id = crypto.randomUUID();
  const ts = nowIso();
  const record = {
    id,
    harvest_batch_id: harvestBatchId,
    weight_grams: weight,
    dry_space_id: drySpaceId,
    notes,
    status: LOT_STATUS.drying,
    created_at: ts,
    created_by: actor.id,
    updated_at: ts,
    updated_by: actor.id,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO wet_weight_entries (
          id, harvest_batch_id, weight_grams, dry_space_id, notes, status,
          created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, harvestBatchId, weight, drySpaceId, notes, LOT_STATUS.drying, ts, actor.id, ts, actor.id),
    ...logsForInsert(db, "wet_weight_entries", id, record, actor.id, SYSTEM_REASON.create, ts),
  ]);
  return { redirect: "/station/wet_weight?ok=wet" };
}

export async function createTrimPackages(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const lotId = requireText(form.get("wet_weight_entry_id"), "Lot");
  const lot = await db
    .prepare(`SELECT id, status FROM wet_weight_entries WHERE id = ? AND deleted_at IS NULL`)
    .bind(lotId)
    .first<{ id: string; status: string }>();
  if (!lot) throw new HttpError(400, "Unknown lot.");
  if (lot.status !== LOT_STATUS.drying) {
    throw new HttpError(400, "That lot is not in the Dry Space Queue.");
  }
  const codes = form.getAll("package_code").map((v) => String(v).trim());
  const types = form.getAll("package_type_code").map((v) => String(v).trim());
  const weights = form.getAll("weight_grams").map((v) => String(v).trim());
  if (codes.length === 0) throw new HttpError(400, "Add at least one package.");
  if (codes.length !== types.length || codes.length !== weights.length) {
    throw new HttpError(400, "Each package needs a code, type, and weight.");
  }

  const stmts: D1PreparedStatement[] = [];
  const ts = nowIso();
  for (let i = 0; i < codes.length; i++) {
    if (!codes[i] || !types[i] || !weights[i]) {
      throw new HttpError(400, "Each package needs a code, type, and weight.");
    }
    const pkgType = await db
      .prepare(
        `SELECT code, is_bud FROM package_types WHERE code = ? AND deleted_at IS NULL`
      )
      .bind(types[i])
      .first<{ code: string; is_bud: number }>();
    if (!pkgType) throw new HttpError(400, `Unknown package type: ${types[i]}`);
    const weight = roundGrams(Number(weights[i]));
    if (!Number.isFinite(weight) || weight < 0) {
      throw new HttpError(400, "Weight must be a number of grams, zero or greater.");
    }
    const status = initialWipStatus(pkgType.is_bud);
    const id = crypto.randomUUID();
    const record = {
      id,
      wet_weight_entry_id: lotId,
      package_code: codes[i],
      package_type_code: types[i],
      weight_grams: weight,
      status,
      created_at: ts,
      created_by: actor.id,
      updated_at: ts,
      updated_by: actor.id,
    };
    stmts.push(
      db
        .prepare(
          `INSERT INTO wip_packages (
            id, wet_weight_entry_id, package_code, package_type_code, weight_grams,
            cryo_weight_grams, status, test_outcome,
            created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
          ) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?, ?, NULL, NULL)`
        )
        .bind(id, lotId, codes[i], types[i], weight, status, ts, actor.id, ts, actor.id)
    );
    stmts.push(...logsForInsert(db, "wip_packages", id, record, actor.id, SYSTEM_REASON.create, ts));
  }
  await db.batch(stmts);
  return { redirect: "/station/trim_packages?ok=trim" };
}

export async function setCryoWeight(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const ids = form.getAll("package_id").map((v) => String(v));
  const weights = form.getAll("cryo_weight_grams").map((v) => String(v).trim());
  if (ids.length !== weights.length) {
    throw new HttpError(400, "Each package needs a matching cryo weight field.");
  }
  const stmts: D1PreparedStatement[] = [];
  const ts = nowIso();
  let applied = 0;
  for (let i = 0; i < ids.length; i++) {
    if (!weights[i]) continue;
    const grams = roundGrams(Number(weights[i]));
    if (!Number.isFinite(grams) || grams < 0) {
      throw new HttpError(400, "Cryo weight must be a number of grams, zero or greater.");
    }
    const row = await db
      .prepare(
        `SELECT id, status, cryo_weight_grams FROM wip_packages WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ids[i])
      .first<{ id: string; status: string; cryo_weight_grams: number | null }>();
    if (!row) throw new HttpError(400, "Unknown package.");
    const next = nextStatus("cryo_weighed", row.status);
    stmts.push(
      db
        .prepare(
          `UPDATE wip_packages SET cryo_weight_grams = ?, status = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(grams, next, ts, actor.id, row.id)
    );
    stmts.push(
      insertLog(db, {
        record_table: "wip_packages",
        record_id: row.id,
        field: "cryo_weight_grams",
        old_value: row.cryo_weight_grams == null ? null : String(row.cryo_weight_grams),
        new_value: String(grams),
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.cryo_weight,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "wip_packages",
        record_id: row.id,
        field: "status",
        old_value: row.status,
        new_value: next,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.cryo_weight,
        changed_at: ts,
      })
    );
    applied += 1;
  }
  if (applied === 0) throw new HttpError(400, "Enter at least one cryo weight.");
  await db.batch(stmts);
  return { redirect: "/station/cryo_weight?ok=cryo" };
}

export async function runQueueControl(
  db: D1Database,
  control: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const id = requireText(form.get("id"), "Record");
  const ts = nowIso();
  if (control === "mark_complete") {
    const row = await db
      .prepare(`SELECT id, status FROM harvest_batches WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .first<{ id: string; status: string }>();
    if (!row) throw new HttpError(404, "Unknown batch.");
    const next = nextStatus("harvest_complete", row.status);
    await db.batch([
      db
        .prepare(
          `UPDATE harvest_batches SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(next, ts, actor.id, id),
      insertLog(db, {
        record_table: "harvest_batches",
        record_id: id,
        field: "status",
        old_value: row.status,
        new_value: next,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.queue_control,
        changed_at: ts,
      }),
    ]);
    return { redirect: "/queue/hbn_queue?ok=complete" };
  }
  if (control === "mark_trimmed") {
    const row = await db
      .prepare(`SELECT id, status FROM wet_weight_entries WHERE id = ? AND deleted_at IS NULL`)
      .bind(id)
      .first<{ id: string; status: string }>();
    if (!row) throw new HttpError(404, "Unknown lot.");
    const next = nextStatus("lot_trimmed", row.status);
    await db.batch([
      db
        .prepare(
          `UPDATE wet_weight_entries SET status = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(next, ts, actor.id, id),
      insertLog(db, {
        record_table: "wet_weight_entries",
        record_id: id,
        field: "status",
        old_value: row.status,
        new_value: next,
        actor_person_id: actor.id,
        reason: SYSTEM_REASON.queue_control,
        changed_at: ts,
      }),
    ]);
    return { redirect: "/queue/dry_space_queue?ok=trimmed" };
  }
  if (control === "release") {
    const outcome = requireText(form.get("outcome"), "Outcome");
    if (!isTestOutcome(outcome)) throw new HttpError(400, "Unknown outcome.");
    const note = textOrNull(form.get("note"));
    const reason = note ? `${SYSTEM_REASON.release}: ${outcome}; note: ${note}` : `${SYSTEM_REASON.release}: ${outcome}`;
    const row = await db
      .prepare(
        `SELECT id, status, test_outcome FROM wip_packages WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(id)
      .first<{ id: string; status: string; test_outcome: string | null }>();
    if (!row) throw new HttpError(404, "Unknown package.");
    const next = nextStatus("released", row.status);
    await db.batch([
      db
        .prepare(
          `UPDATE wip_packages SET status = ?, test_outcome = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .bind(next, outcome, ts, actor.id, id),
      insertLog(db, {
        record_table: "wip_packages",
        record_id: id,
        field: "status",
        old_value: row.status,
        new_value: next,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
      insertLog(db, {
        record_table: "wip_packages",
        record_id: id,
        field: "test_outcome",
        old_value: row.test_outcome,
        new_value: outcome,
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      }),
    ]);
    return { redirect: "/queue/testing_queue?ok=released" };
  }
  throw new HttpError(400, `Unknown control: ${control}`);
}

export const STATION_ACTIONS: Record<
  string,
  (db: D1Database, form: FormData) => Promise<ActionOk>
> = {
  create_harvest_batch: createHarvestBatch,
  create_wet_weight: createWetWeight,
  create_trim_packages: createTrimPackages,
  set_cryo_weight: setCryoWeight,
};

const GRAM_FIELDS = new Set(["weight_grams", "cryo_weight_grams"]);
const BOOL_FIELDS = new Set(["manicure", "is_bud", "is_active"]);

export async function editRecord(
  db: D1Database,
  table: string,
  id: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  assertTable(table);
  const fields = EDITABLE_FIELDS[table];
  if (!fields) throw new HttpError(400, "This table is not editable.");
  const pk = table === "package_types" ? "code" : "id";
  const existing = await getRow(db, table, id);
  if (!existing || existing.deleted_at) throw new HttpError(404, "Record not found.");

  const sets: string[] = [];
  const values: unknown[] = [];
  const logs: D1PreparedStatement[] = [];
  const ts = nowIso();

  for (const field of fields) {
    let next: unknown;
    if (field.input === "checkbox") {
      next = checkbox01(form, field.name);
    } else if (GRAM_FIELDS.has(field.name)) {
      const raw = textOrNull(form.get(field.name));
      next = raw == null ? null : parseGrams(form.get(field.name), field.label);
    } else {
      next = textOrNull(form.get(field.name));
    }
    const prev = existing[field.name];
    const prevNorm = normalize(prev, field.name);
    const nextNorm = normalize(next, field.name);
    if (prevNorm === nextNorm) continue;
    sets.push(`${field.name} = ?`);
    values.push(next);
    logs.push(
      insertLog(db, {
        record_table: table,
        record_id: id,
        field: field.name,
        old_value: prev == null ? null : String(prev),
        new_value: next == null ? null : String(next),
        actor_person_id: actor.id,
        reason,
        changed_at: ts,
      })
    );
  }
  if (sets.length === 0) throw new HttpError(400, "No fields changed.");
  sets.push("updated_at = ?", "updated_by = ?");
  values.push(ts, actor.id, id);
  await db.batch([
    db
      .prepare(`UPDATE ${table} SET ${sets.join(", ")} WHERE ${pk} = ? AND deleted_at IS NULL`)
      .bind(...values),
    ...logs,
  ]);
  return { redirect: `/record/${table}/${id}/edit?ok=saved` };
}

function normalize(value: unknown, field: string): string {
  if (value == null || value === "") return "";
  if (BOOL_FIELDS.has(field)) return Number(value) === 1 ? "1" : "0";
  if (GRAM_FIELDS.has(field)) return String(roundGrams(Number(value)));
  return String(value);
}

export async function voidRecord(
  db: D1Database,
  table: string,
  id: string,
  form: FormData
): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  assertTable(table);
  if (table === "record_change_log") {
    throw new HttpError(400, "The change log cannot be voided.");
  }
  const pk = table === "package_types" ? "code" : "id";
  const existing = await getRow(db, table, id);
  if (!existing) throw new HttpError(404, "Record not found.");
  if (existing.deleted_at) throw new HttpError(400, "Record is already voided.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE ${table} SET deleted_at = ?, deleted_by = ?, updated_at = ?, updated_by = ? WHERE ${pk} = ?`
      )
      .bind(ts, actor.id, ts, actor.id, id),
    insertLog(db, {
      record_table: table,
      record_id: id,
      field: "deleted_at",
      old_value: null,
      new_value: ts,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: `/?ok=voided` };
}

export async function addPerson(db: D1Database, form: FormData): Promise<ActionOk> {
  const name = requireText(form.get("display_name"), "Name");
  const ts = nowIso();
  const id = crypto.randomUUID();
  const actorId = textOrNull(form.get("person_id"));
  const actor = actorId ? await requireActor(db, actorId) : null;
  const createdBy = actor?.id ?? id;
  await db.batch([
    db
      .prepare(
        `INSERT INTO people (
          id, display_name, is_active, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, 1, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, name, ts, createdBy, ts, createdBy),
    ...logsForInsert(
      db,
      "people",
      id,
      { id, display_name: name, is_active: 1, created_at: ts, created_by: createdBy },
      createdBy,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  return { redirect: `/admin/lookups?ok=person&person_id=${encodeURIComponent(id)}` };
}

export async function deactivatePerson(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const reason = requireReason(textOrNull(form.get("reason")));
  const id = requireText(form.get("id"), "Person");
  const row = await db
    .prepare(`SELECT id, is_active FROM people WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string; is_active: number }>();
  if (!row) throw new HttpError(404, "Unknown person.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE people SET is_active = 0, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(ts, actor.id, id),
    insertLog(db, {
      record_table: "people",
      record_id: id,
      field: "is_active",
      old_value: String(row.is_active),
      new_value: "0",
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: "/admin/lookups?ok=deactivated" };
}

export async function addStrain(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const name = requireText(form.get("name"), "Name");
  const abbr = textOrNull(form.get("abbr"));
  const hbnCode = requireText(form.get("hbn_code"), "HBN code");
  const id = crypto.randomUUID();
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO strains (
          id, name, abbr, hbn_code, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, name, abbr, hbnCode, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "strains",
      id,
      { id, name, abbr, hbn_code: hbnCode, created_at: ts, created_by: actor.id },
      actor.id,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  return { redirect: "/admin/lookups?ok=strain" };
}

export async function addDrySpace(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const name = requireText(form.get("name"), "Name");
  const kind = requireText(form.get("kind"), "Kind");
  const id = crypto.randomUUID();
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO dry_spaces (
          id, name, kind, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(id, name, kind, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "dry_spaces",
      id,
      { id, name, kind, created_at: ts, created_by: actor.id },
      actor.id,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  return { redirect: "/admin/lookups?ok=space" };
}

export async function addPackageType(db: D1Database, form: FormData): Promise<ActionOk> {
  const actor = await requireActor(db, personIdFrom(form));
  const code = requireText(form.get("code"), "Code");
  const displayName = requireText(form.get("display_name"), "Display name");
  const isBud = checkbox01(form, "is_bud");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `INSERT INTO package_types (
          code, display_name, is_bud, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL)`
      )
      .bind(code, displayName, isBud, ts, actor.id, ts, actor.id),
    ...logsForInsert(
      db,
      "package_types",
      code,
      { code, display_name: displayName, is_bud: isBud, created_at: ts, created_by: actor.id },
      actor.id,
      SYSTEM_REASON.create,
      ts
    ),
  ]);
  return { redirect: "/admin/lookups?ok=type" };
}
