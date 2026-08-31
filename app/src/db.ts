import { HttpError } from "./audit";
import type { LookupName, QueueDef } from "./pipeline";

export type PersonRow = {
  id: string;
  display_name: string;
  is_active: number;
};

export type LookupOption = { value: string; label: string };

export type QueueRow = {
  id: string;
  values: Record<string, string>;
};

export async function listPeople(db: D1Database, activeOnly: boolean): Promise<PersonRow[]> {
  const sql = activeOnly
    ? `SELECT id, display_name, is_active FROM people WHERE deleted_at IS NULL AND is_active = 1 ORDER BY display_name`
    : `SELECT id, display_name, is_active FROM people WHERE deleted_at IS NULL ORDER BY display_name`;
  const result = await db.prepare(sql).all<PersonRow>();
  return result.results ?? [];
}

export async function getPerson(db: D1Database, id: string): Promise<PersonRow | null> {
  return db
    .prepare(
      `SELECT id, display_name, is_active FROM people WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<PersonRow>();
}

export async function requireActor(db: D1Database, personId: string | null): Promise<PersonRow> {
  if (!personId) throw new HttpError(400, "Select a person.");
  const person = await getPerson(db, personId);
  if (!person || person.is_active !== 1) {
    throw new HttpError(400, "Select an active person.");
  }
  return person;
}

export async function listLookup(db: D1Database, name: LookupName): Promise<LookupOption[]> {
  switch (name) {
    case "farms":
      return mapLookup(
        await db
          .prepare(
            `SELECT code AS value, display_name AS label FROM farms WHERE deleted_at IS NULL ORDER BY code`
          )
          .all<LookupOption>()
      );
    case "grow_methods":
      return mapLookup(
        await db
          .prepare(
            `SELECT code AS value, display_name AS label FROM grow_methods WHERE deleted_at IS NULL ORDER BY code`
          )
          .all<LookupOption>()
      );
    case "strains":
      return mapLookup(
        await db
          .prepare(
            `SELECT id AS value, name || ' (' || hbn_code || ')' AS label FROM strains WHERE deleted_at IS NULL ORDER BY name`
          )
          .all<LookupOption>()
      );
    case "dry_spaces":
      return mapLookup(
        await db
          .prepare(
            `SELECT id AS value, name AS label FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name`
          )
          .all<LookupOption>()
      );
    case "package_types":
      return mapLookup(
        await db
          .prepare(
            `SELECT code AS value, display_name AS label FROM package_types WHERE deleted_at IS NULL ORDER BY code`
          )
          .all<LookupOption>()
      );
    case "people":
      return mapLookup(
        await db
          .prepare(
            `SELECT id AS value, display_name AS label FROM people WHERE deleted_at IS NULL AND is_active = 1 ORDER BY display_name`
          )
          .all<LookupOption>()
      );
  }
}

function mapLookup(result: D1Result<LookupOption>): LookupOption[] {
  return result.results ?? [];
}

export async function countQueue(db: D1Database, def: QueueDef): Promise<number> {
  const table = def.entity;
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL AND status = ?`
    )
    .bind(def.predicate.value)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/** Pane-only hide (owner ruling 2026-08-28): a finished lot (drying, in_transit, or trimmed,
 * non-voided) removes its batch from the wet weight pane; a weighing lot keeps it visible for
 * resume. Written against the b alias of the hbn_queue query in listHarvestQueueRows. */
export const NO_FINISHED_LOT_SQL =
  "AND NOT EXISTS (SELECT 1 FROM wet_weight_entries w WHERE w.harvest_batch_id = b.id AND w.deleted_at IS NULL AND w.status IN ('drying', 'in_transit', 'trimmed'))";

/** Left pane rows only: listQueueRows plus the station's paneFilter. The Data Queues
 * tables, /export CSVs, and the queue_pick select fallback keep listQueueRows unfiltered. */
export async function listPaneRows(
  db: D1Database,
  def: QueueDef,
  paneFilter?: "no_finished_lot"
): Promise<QueueRow[]> {
  if (paneFilter === "no_finished_lot" && def.entity === "harvest_batches") {
    return listHarvestQueueRows(db, def, NO_FINISHED_LOT_SQL);
  }
  return listQueueRows(db, def);
}

async function listHarvestQueueRows(
  db: D1Database,
  def: QueueDef,
  filterSql: string
): Promise<QueueRow[]> {
  const result = await db
    .prepare(
      `SELECT b.id, b.hbn, b.entry_date, b.farm_code, s.name AS strain_name, b.created_at
       FROM harvest_batches b
       LEFT JOIN strains s ON s.id = b.strain_id
       WHERE b.deleted_at IS NULL AND b.status = ? ${filterSql}
       ORDER BY b.created_at DESC`
    )
    .bind(def.predicate.value)
    .all<Record<string, unknown>>();
  return toQueueRows(result.results ?? []);
}

export async function listQueueRows(db: D1Database, def: QueueDef): Promise<QueueRow[]> {
  if (def.entity === "harvest_batches") {
    return listHarvestQueueRows(db, def, "");
  }
  if (def.entity === "wet_weight_entries") {
    const result = await db
      .prepare(
        `SELECT w.id, b.hbn, w.weight_grams, w.wet_spear_weight_grams, d.name AS dry_space_name, w.truck_number, w.notes, w.created_at
         FROM wet_weight_entries w
         LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
         LEFT JOIN dry_spaces d ON d.id = w.dry_space_id
         WHERE w.deleted_at IS NULL AND w.status = ?
         ORDER BY d.name, w.created_at DESC`
      )
      .bind(def.predicate.value)
      .all<Record<string, unknown>>();
    return toQueueRows(result.results ?? []);
  }
  const result = await db
    .prepare(
      `SELECT p.id, p.package_code, p.package_type_code, p.weight_grams, p.cryo_weight_grams,
              b.hbn, p.created_at
       FROM wip_packages p
       LEFT JOIN wet_weight_entries w ON w.id = p.wet_weight_entry_id
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       WHERE p.deleted_at IS NULL AND p.status = ?
       ORDER BY p.created_at DESC`
    )
    .bind(def.predicate.value)
    .all<Record<string, unknown>>();
  return toQueueRows(result.results ?? []);
}

function toQueueRows(rows: Record<string, unknown>[]): QueueRow[] {
  return rows.map((row) => {
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (key === "id") continue;
      values[key] = value == null ? "" : String(value);
    }
    return { id: String(row.id), values };
  });
}

export async function farmDisplayName(db: D1Database, code: string): Promise<string> {
  if (!code) return "";
  const row = await db
    .prepare(`SELECT display_name FROM farms WHERE code = ? AND deleted_at IS NULL`)
    .bind(code)
    .first<{ display_name: string }>();
  return row?.display_name ?? code;
}

export type DrySpaceOptionRow = LookupOption & { kind: string; farm_code: string | null };

/** The Move To rule: the row's kind is allowed for the batch's farm AND the row is
 * shared (farm_code NULL) or scoped to that farm (owner ruling 2026-08-28). */
export function filterDrySpaces(
  rows: readonly DrySpaceOptionRow[],
  kinds: readonly string[],
  farmCode: string
): LookupOption[] {
  const allowed = new Set(kinds);
  return rows
    .filter((row) => allowed.has(row.kind) && (row.farm_code == null || row.farm_code === farmCode))
    .map((row) => ({ value: row.value, label: row.label }));
}

/** Dry spaces limited to the given kinds and farm, for the farm-filtered Move To select. */
export async function listDrySpacesByKinds(
  db: D1Database,
  kinds: readonly string[],
  farmCode: string
): Promise<LookupOption[]> {
  const result = await db
    .prepare(
      `SELECT id AS value, name AS label, kind, farm_code FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name`
    )
    .all<DrySpaceOptionRow>();
  return filterDrySpaces(result.results ?? [], kinds, farmCode);
}

export type LotSummary = { id: string; created_at: string; weight_grams: number };

/** Lots for one harvest batch in one status, newest first (resume links on the picked page). */
export async function listLotsByStatus(
  db: D1Database,
  harvestBatchId: string,
  status: string
): Promise<LotSummary[]> {
  const result = await db
    .prepare(
      `SELECT id, created_at, weight_grams FROM wet_weight_entries
       WHERE harvest_batch_id = ? AND status = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`
    )
    .bind(harvestBatchId, status)
    .all<LotSummary>();
  return result.results ?? [];
}

export type LotRow = {
  id: string;
  status: string;
  notes: string | null;
  weight_grams: number;
  harvest_batch_id: string;
  hbn: string | null;
  farm_code: string | null;
  dry_space_name: string | null;
  dry_space_kind: string | null;
  lead_name: string | null;
  created_at: string;
};

export async function getLot(db: D1Database, id: string): Promise<LotRow | null> {
  return db
    .prepare(
      `SELECT w.id, w.status, w.notes, w.weight_grams, w.harvest_batch_id, w.created_at,
              b.hbn, b.farm_code, d.name AS dry_space_name, d.kind AS dry_space_kind,
              p.display_name AS lead_name
       FROM wet_weight_entries w
       LEFT JOIN harvest_batches b ON b.id = w.harvest_batch_id
       LEFT JOIN dry_spaces d ON d.id = w.dry_space_id
       LEFT JOIN people p ON p.id = COALESCE(w.lead_person_id, w.created_by)
       WHERE w.id = ? AND w.deleted_at IS NULL`
    )
    .bind(id)
    .first<LotRow>();
}

export type LotWeightRow = { id: string; weight_grams: number; created_at: string };

export async function listLotWeights(db: D1Database, lotId: string): Promise<LotWeightRow[]> {
  const result = await db
    .prepare(
      `SELECT id, weight_grams, created_at FROM wet_weights
       WHERE wet_weight_entry_id = ? AND deleted_at IS NULL
       ORDER BY created_at DESC`
    )
    .bind(lotId)
    .all<LotWeightRow>();
  return result.results ?? [];
}

export async function countLotWeights(db: D1Database, lotId: string): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM wet_weights WHERE wet_weight_entry_id = ? AND deleted_at IS NULL`
    )
    .bind(lotId)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

/** Owner ruling 2026-08-28: the lot's weight_grams is the live total of its non-voided
 * wet_weights rows. Runs inside the same db.batch as the add, edit, or void it follows. */
export function lotTotalRecomputeStmt(
  db: D1Database,
  lotId: string,
  actorId: string,
  ts: string
): D1PreparedStatement {
  return db
    .prepare(
      `UPDATE wet_weight_entries SET weight_grams = (
         SELECT COALESCE(ROUND(SUM(weight_grams), 2), 0) FROM wet_weights
         WHERE wet_weight_entry_id = ? AND deleted_at IS NULL
       ), updated_at = ?, updated_by = ?
       WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(lotId, ts, actorId, lotId);
}

/** app_config values (canon L-4: values live in data). NULL when the key is absent. */
export async function getConfigValue(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT value FROM app_config WHERE key = ? AND deleted_at IS NULL`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function getHarvestByHbn(
  db: D1Database,
  hbn: string
): Promise<{ id: string } | null> {
  return db
    .prepare(`SELECT id FROM harvest_batches WHERE hbn = ?`)
    .bind(hbn)
    .first<{ id: string }>();
}

export async function getRow(
  db: D1Database,
  table: string,
  id: string
): Promise<Record<string, unknown> | null> {
  assertTable(table);
  if (table === "package_types") {
    return db
      .prepare(`SELECT * FROM package_types WHERE code = ?`)
      .bind(id)
      .first<Record<string, unknown>>();
  }
  if (table === "farms" || table === "grow_methods") {
    return db
      .prepare(`SELECT * FROM ${table} WHERE code = ?`)
      .bind(id)
      .first<Record<string, unknown>>();
  }
  return db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first<Record<string, unknown>>();
}

export async function listTable(
  db: D1Database,
  table: string
): Promise<Record<string, unknown>[]> {
  assertTable(table);
  if (table === "record_change_log") {
    const result = await db
      .prepare(`SELECT * FROM record_change_log ORDER BY changed_at DESC`)
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(`SELECT * FROM ${table} WHERE deleted_at IS NULL ORDER BY created_at DESC`)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listChangeLog(
  db: D1Database,
  limit = 200
): Promise<Record<string, unknown>[]> {
  const result = await db
    .prepare(
      `SELECT l.*, p.display_name AS actor_name
       FROM record_change_log l
       LEFT JOIN people p ON p.id = l.actor_person_id
       ORDER BY l.changed_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

export async function listAdminRows(
  db: D1Database,
  table: "people" | "farms" | "strains" | "dry_spaces" | "package_types"
): Promise<Record<string, unknown>[]> {
  if (table === "farms") {
    const result = await db
      .prepare(
        `SELECT code AS id, code, display_name, created_at FROM farms WHERE deleted_at IS NULL ORDER BY code`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (table === "people") {
    const result = await db
      .prepare(
        `SELECT id, display_name, email, is_active, created_at FROM people WHERE deleted_at IS NULL ORDER BY display_name`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (table === "strains") {
    const result = await db
      .prepare(
        `SELECT id, name, abbr, hbn_code, created_at FROM strains WHERE deleted_at IS NULL ORDER BY name`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  if (table === "dry_spaces") {
    const result = await db
      .prepare(
        `SELECT id, name, kind, farm_code, created_at FROM dry_spaces WHERE deleted_at IS NULL ORDER BY name`
      )
      .all<Record<string, unknown>>();
    return result.results ?? [];
  }
  const result = await db
    .prepare(
      `SELECT code AS id, code, display_name, is_bud, created_at FROM package_types WHERE deleted_at IS NULL ORDER BY code`
    )
    .all<Record<string, unknown>>();
  return result.results ?? [];
}

const ALLOWED_TABLES = new Set([
  "farms",
  "grow_methods",
  "strains",
  "dry_spaces",
  "package_types",
  "people",
  "harvest_batches",
  "wet_weight_entries",
  "wet_weights",
  "wip_packages",
  "record_change_log",
]);

export function assertTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new HttpError(404, `Unknown table: ${table}`);
  }
}

export function insertLog(
  db: D1Database,
  row: {
    record_table: string;
    record_id: string;
    field: string;
    old_value: string | null;
    new_value: string | null;
    actor_person_id: string | null;
    reason: string;
    changed_at: string;
  }
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO record_change_log (
        id, record_table, record_id, field, old_value, new_value, actor_person_id, reason, changed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      crypto.randomUUID(),
      row.record_table,
      row.record_id,
      row.field,
      row.old_value,
      row.new_value,
      row.actor_person_id,
      row.reason,
      row.changed_at
    );
}

export function logsForInsert(
  db: D1Database,
  table: string,
  id: string,
  record: Record<string, unknown>,
  actorId: string | null,
  reason: string,
  changedAt: string
): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = [];
  for (const [field, value] of Object.entries(record)) {
    if (value == null || value === "") continue;
    stmts.push(
      insertLog(db, {
        record_table: table,
        record_id: id,
        field,
        old_value: null,
        new_value: String(value),
        actor_person_id: actorId,
        reason,
        changed_at: changedAt,
      })
    );
  }
  return stmts;
}
