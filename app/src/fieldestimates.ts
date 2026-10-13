/**
 * FE1: field estimates, effective dated.
 * The key is strain and farm. For a date D, the estimate is the live row
 * with the greatest effective_date on or before D. A later row replaces the
 * older one only from its own date forward. The same date replaces that row.
 * Dry pounds are hand entered at GRAMS_PER_LB (448 g) and stored as typed.
 */
import { nowIso, refusal, textOrNull } from "./audit";
import { GRAMS_PER_LB } from "./config";
import { insertLog, logsForInsert, requireActor } from "./db";
import { farmToday } from "./effective";
import { isCalendarDate } from "./farmday";
import { t, type Locale } from "./i18n";
import { esc, fieldBlock } from "./ui";

/** One pound, the app pound. Save does not multiply by this. */
export const FIELD_ESTIMATE_GRAMS_PER_LB = GRAMS_PER_LB;

export const FIELD_ESTIMATES_PATH = "/admin/field_estimates";

/** The change log reason when the memo is blank. */
export const FIELD_ESTIMATE_LOG_REASON = "field estimate";

export const FIELD_ESTIMATES_LIVE_INDEX = "field_estimates_live";
export const FIELD_ESTIMATES_LOOKUP_INDEX = "field_estimates_lookup";

/** Resolution read. The live index is (strain_id, farm_code, effective_date). */
export const ESTIMATE_FOR_SQL = `SELECT id, strain_id, farm_code, effective_date, est_dry_weight, reason
FROM field_estimates
WHERE deleted_at IS NULL
  AND strain_id = ?
  AND farm_code = ?
  AND effective_date <= ?
ORDER BY effective_date DESC
LIMIT 1`;

/** One live row per strain and farm: the row estimateFor would return for that pair. */
export const ESTIMATES_AS_OF_SQL = `SELECT e.id, e.strain_id, e.farm_code, e.effective_date, e.est_dry_weight, e.reason
FROM field_estimates e
WHERE e.deleted_at IS NULL
  AND e.effective_date <= ?
  AND e.effective_date = (
    SELECT MAX(n.effective_date)
    FROM field_estimates n
    WHERE n.deleted_at IS NULL
      AND n.strain_id = e.strain_id
      AND n.farm_code = e.farm_code
      AND n.effective_date <= ?
  )
ORDER BY e.strain_id, e.farm_code`;

const LIST_SQL = `SELECT e.id, e.strain_id, COALESCE(s.name, '') AS strain_name, e.farm_code,
       e.effective_date, e.est_dry_weight, e.reason
FROM field_estimates e
LEFT JOIN strains s ON s.id = e.strain_id
WHERE e.deleted_at IS NULL
ORDER BY strain_name, e.farm_code, e.effective_date DESC`;

export type FieldEstimate = {
  id: string;
  strain_id: string;
  farm_code: string;
  effective_date: string;
  est_dry_weight: number;
  reason: string | null;
};

export type FieldEstimateListRow = FieldEstimate & {
  strain_name: string;
  in_force: boolean;
};

export type FieldEstimatesPageModel = {
  today: string;
  strains: Array<{ id: string; name: string }>;
  farms: Array<{ code: string; name: string }>;
  rows: FieldEstimateListRow[];
};

type EstimateRow = {
  id: string;
  strain_id: string;
  farm_code: string;
  effective_date: string;
  est_dry_weight: number;
  reason: string | null;
};

type ListRow = EstimateRow & { strain_name: string };

function asEstimate(row: EstimateRow): FieldEstimate {
  return {
    id: String(row.id),
    strain_id: String(row.strain_id),
    farm_code: String(row.farm_code),
    effective_date: String(row.effective_date),
    est_dry_weight: Number(row.est_dry_weight),
    reason: row.reason == null || row.reason === "" ? null : String(row.reason),
  };
}

/** Display only. The stored number is the number that was typed. */
export function formatDryPounds(value: number): string {
  if (!Number.isFinite(value)) return "";
  const text = value.toFixed(6);
  if (!text.includes(".")) return text;
  return text.replace(/0+$/, "").replace(/\.$/, "");
}

function positivePounds(raw: unknown): number {
  const text = textOrNull(raw);
  if (text == null || !/^\d+(\.\d+)?$/.test(text)) {
    throw refusal(400, { key: "Dry weight must be a positive number.", vars: {} });
  }
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) {
    throw refusal(400, { key: "Dry weight must be a positive number.", vars: {} });
  }
  return n;
}

function effectiveDateOf(raw: unknown): string {
  const text = textOrNull(raw);
  if (!text) throw refusal(400, { key: "Effective date is required.", vars: {} });
  if (!isCalendarDate(text)) throw refusal(400, { key: "Effective date must be YYYY-MM-DD.", vars: {} });
  return text;
}

function logReason(memo: string | null): string {
  return memo ?? FIELD_ESTIMATE_LOG_REASON;
}

async function requireLiveStrain(db: D1Database, id: string | null): Promise<string> {
  if (!id) throw refusal(400, { key: "Pick a live strain.", vars: {} });
  const row = await db
    .prepare(`SELECT id FROM strains WHERE id = ? AND deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string }>();
  if (!row) throw refusal(400, { key: "Pick a live strain.", vars: {} });
  return String(row.id);
}

async function requireLiveFarm(db: D1Database, code: string | null): Promise<string> {
  if (!code) throw refusal(400, { key: "Pick a live farm.", vars: {} });
  const row = await db
    .prepare(`SELECT code FROM farms WHERE code = ? AND deleted_at IS NULL`)
    .bind(code)
    .first<{ code: string }>();
  if (!row) throw refusal(400, { key: "Pick a live farm.", vars: {} });
  return String(row.code);
}

/** The live estimate in force for this strain, farm, and date, or null. */
export async function estimateFor(
  db: D1Database,
  strainId: string,
  farmCode: string,
  date: string
): Promise<FieldEstimate | null> {
  const row = await db.prepare(ESTIMATE_FOR_SQL).bind(strainId, farmCode, date).first<EstimateRow>();
  return row ? asEstimate(row) : null;
}

/** One live row per strain and farm pair in force on this date. */
export async function estimatesAsOf(db: D1Database, date: string): Promise<FieldEstimate[]> {
  const listed = await db.prepare(ESTIMATES_AS_OF_SQL).bind(date, date).all<EstimateRow>();
  return (listed.results ?? []).map(asEstimate);
}

export async function loadFieldEstimatesPage(db: D1Database, now: string): Promise<FieldEstimatesPageModel> {
  const today = await farmToday(db, now);
  const [strains, farms, listed, inForce] = await Promise.all([
    db.prepare(`SELECT id, name FROM strains WHERE deleted_at IS NULL ORDER BY name`).all<{ id: string; name: string }>(),
    db
      .prepare(`SELECT code, display_name AS name FROM farms WHERE deleted_at IS NULL ORDER BY code`)
      .all<{ code: string; name: string }>(),
    db.prepare(LIST_SQL).all<ListRow>(),
    estimatesAsOf(db, today),
  ]);
  const inForceIds = new Set(inForce.map((row) => row.id));
  return {
    today,
    strains: (strains.results ?? []).map((row) => ({ id: String(row.id), name: String(row.name) })),
    farms: (farms.results ?? []).map((row) => ({ code: String(row.code), name: String(row.name) })),
    rows: (listed.results ?? []).map((row) => {
      const estimate = asEstimate(row);
      return {
        ...estimate,
        strain_name: String(row.strain_name || row.strain_id),
        in_force: inForceIds.has(estimate.id),
      };
    }),
  };
}

export async function saveFieldEstimate(db: D1Database, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const strainId = await requireLiveStrain(db, textOrNull(form.get("strain_id")));
  const farmCode = await requireLiveFarm(db, textOrNull(form.get("farm_code")));
  const date = effectiveDateOf(form.get("effective_date"));
  const weight = positivePounds(form.get("est_dry_weight"));
  const reason = textOrNull(form.get("reason"));
  const ts = nowIso();
  const existing = await db
    .prepare(
      `SELECT id, est_dry_weight, reason FROM field_estimates
       WHERE strain_id = ? AND farm_code = ? AND effective_date = ? AND deleted_at IS NULL`
    )
    .bind(strainId, farmCode, date)
    .first<{ id: string; est_dry_weight: number; reason: string | null }>();
  if (existing) {
    const sameWeight = Number(existing.est_dry_weight) === weight;
    const sameReason = (existing.reason ?? null) === reason;
    if (sameWeight && sameReason) return { redirect: `${FIELD_ESTIMATES_PATH}?ok=saved` };
    const reasonText = logReason(reason);
    const logs: D1PreparedStatement[] = [];
    if (!sameWeight) {
      logs.push(
        insertLog(db, {
          record_table: "field_estimates",
          record_id: String(existing.id),
          field: "est_dry_weight",
          old_value: String(existing.est_dry_weight),
          new_value: String(weight),
          actor_person_id: actor.id,
          reason: reasonText,
          changed_at: ts,
        })
      );
    }
    if (!sameReason) {
      logs.push(
        insertLog(db, {
          record_table: "field_estimates",
          record_id: String(existing.id),
          field: "reason",
          old_value: existing.reason,
          new_value: reason,
          actor_person_id: actor.id,
          reason: reasonText,
          changed_at: ts,
        })
      );
    }
    await db.batch([
      db
        .prepare(`UPDATE field_estimates SET est_dry_weight = ?, reason = ? WHERE id = ? AND deleted_at IS NULL`)
        .bind(weight, reason, existing.id),
      ...logs,
    ]);
    return { redirect: `${FIELD_ESTIMATES_PATH}?ok=saved` };
  }
  const id = crypto.randomUUID();
  const record = {
    strain_id: strainId,
    farm_code: farmCode,
    effective_date: date,
    est_dry_weight: weight,
    reason,
    created_by: actor.id,
    created_at: ts,
  };
  await db.batch([
    db
      .prepare(
        `INSERT INTO field_estimates (
           id, strain_id, farm_code, effective_date, est_dry_weight, reason, created_by, created_at, deleted_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .bind(id, strainId, farmCode, date, weight, reason, actor.id, ts),
    ...logsForInsert(db, "field_estimates", id, record, actor.id, logReason(reason), ts),
  ]);
  return { redirect: `${FIELD_ESTIMATES_PATH}?ok=saved` };
}

export async function deleteFieldEstimate(db: D1Database, id: string, form: FormData): Promise<{ redirect: string }> {
  const actor = await requireActor(db, textOrNull(form.get("person_id")));
  const row = await db
    .prepare(
      `SELECT id, est_dry_weight FROM field_estimates WHERE id = ? AND deleted_at IS NULL`
    )
    .bind(id)
    .first<{ id: string; est_dry_weight: number }>();
  if (!row) throw refusal(404, { key: "That estimate is not on the list.", vars: {} });
  const reason = textOrNull(form.get("reason"));
  if (!reason) throw refusal(400, { key: "Reason is required.", vars: {} });
  const ts = nowIso();
  await db.batch([
    db.prepare(`UPDATE field_estimates SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`).bind(ts, row.id),
    insertLog(db, {
      record_table: "field_estimates",
      record_id: String(row.id),
      field: "est_dry_weight",
      old_value: String(row.est_dry_weight),
      new_value: null,
      actor_person_id: actor.id,
      reason,
      changed_at: ts,
    }),
  ]);
  return { redirect: `${FIELD_ESTIMATES_PATH}?ok=saved` };
}

function options(rows: Array<{ value: string; label: string }>): string {
  return [`<option value=""></option>`, ...rows.map((row) => `<option value="${esc(row.value)}">${esc(row.label)}</option>`)].join("");
}

/** The Admin page: the form defaults its date to the farm's today, and the list marks the row in force. */
export function fieldEstimatesPage(model: FieldEstimatesPageModel, locale: Locale = "en"): string {
  const strainOptions = options(model.strains.map((row) => ({ value: row.id, label: row.name })));
  const farmOptions = options(model.farms.map((row) => ({ value: row.code, label: row.name })));
  const form = `<form class="stack" method="post" action="${FIELD_ESTIMATES_PATH}" data-field-estimates-form>
      ${fieldBlock(locale, "Strain", `<select name="strain_id" required>${strainOptions}</select>`, "The strain this estimate is for.")}
      ${fieldBlock(locale, "Farm", `<select name="farm_code" required>${farmOptions}</select>`, "The farm this estimate is for.")}
      ${fieldBlock(
        locale,
        "Effective date",
        `<input type="date" name="effective_date" required value="${esc(model.today)}" data-field-estimate-date>`,
        "An older date stands until this date."
      )}
      ${fieldBlock(
        locale,
        "dry lb (448 g)",
        `<input type="text" name="est_dry_weight" inputmode="decimal" required data-field-estimate-weight>`,
        "Hand entered dry pounds at 448 g. The number is stored as typed."
      )}
      ${fieldBlock(locale, "Reason", `<textarea name="reason" rows="3" data-field-estimate-reason></textarea>`, "Memo, optional.")}
      <button type="submit">${esc(t(locale, "Save"))}</button>
    </form>`;
  const table =
    model.rows.length === 0
      ? `<p class="muted" data-field-estimates-empty>${esc(t(locale, "No field estimates yet."))}</p>`
      : `<table data-field-estimates>
      <thead><tr>
        <th>${esc(t(locale, "Strain"))}</th>
        <th>${esc(t(locale, "Farm"))}</th>
        <th>${esc(t(locale, "Effective date"))}</th>
        <th>${esc(t(locale, "dry lb (448 g)"))}</th>
        <th>${esc(t(locale, "Reason"))}</th>
        <th></th>
        <th></th>
      </tr></thead>
      <tbody>
      ${model.rows
        .map(
          (row) => `<tr data-field-estimate="${esc(row.id)}" data-strain-id="${esc(row.strain_id)}" data-farm="${esc(row.farm_code)}" data-effective="${esc(row.effective_date)}" data-in-force="${row.in_force ? "1" : "0"}">
        <td>${esc(row.strain_name)}</td>
        <td>${esc(row.farm_code)}</td>
        <td>${esc(row.effective_date)}</td>
        <td data-field-estimate-weight>${esc(formatDryPounds(row.est_dry_weight))}</td>
        <td>${esc(row.reason ?? "")}</td>
        <td>${row.in_force ? esc(t(locale, "In force")) : ""}</td>
        <td><form method="post" action="${FIELD_ESTIMATES_PATH}/${esc(row.id)}/delete">
          <input type="text" name="reason" required aria-label="${esc(t(locale, "Reason"))}">
          <button type="submit">${esc(t(locale, "Remove"))}</button>
        </form></td>
      </tr>`
        )
        .join("\n")}
      </tbody>
    </table>`;
  return `<h1>${esc(t(locale, "Field estimates"))}</h1>
    <p class="muted">${esc(t(locale, "Dry pounds, hand entered. One pound is 448 g."))}</p>
    <p class="muted">${esc(t(locale, "An older date stands until a later date replaces it. Saving the same date replaces that row."))}</p>
    ${form}
    ${table}`;
}
