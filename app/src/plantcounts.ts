/**
 * ASSIGN PLANT COUNTS (canon 0.30.416). Harvest Operations lists every live lot
 * of the harvest year that has no plant count, and >> writes one. << only
 * brings a lot back onto the left pane for another >>; it writes nothing.
 */

import { HttpError, nowIso, parsePlantCount, textOrNull } from "./audit";
import { insertLog } from "./db";
import { etWallClock } from "./farmday";
import { t, type Locale } from "./i18n";
import { formatLotToken } from "./mint";
import { ownLotSql } from "./toll";
import { esc } from "./ui";

export const ASSIGN_PLANT_COUNTS_PATH = "/station/assign_plant_counts";
export const ASSIGN_PLANT_COUNTS_REASON = "assign plant counts";

export type PlantLot = {
  id: string;
  hbn: string;
  lot: string;
  farm: string;
  status: string;
  farmDay: string;
  createdAt: string;
  plantCount: number | null;
};

export type AssignedLot = PlantLot & {
  plantCount: number;
  who: string;
  when: string;
};

type UncountedRow = {
  id: string;
  hbn: string;
  harvest_year: number;
  lot_serial: number;
  farm_code: string | null;
  status: string;
  plant_count: number | null;
  farm_day: string;
  created_at: string;
};

type AssignedRow = UncountedRow & {
  changed_at: string;
  display_name: string | null;
};

/** A weighing lot says so. Every other state keeps its stored word. */
export function plantCountState(status: string): string {
  return status === "weighing" ? "still weighing" : status;
}

function byFarmDay(a: PlantLot, b: PlantLot): number {
  if (a.farmDay !== b.farmDay) return a.farmDay < b.farmDay ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

/** The left pane is every lot with no count, plus the one << pulled back.
 * That pulled lot leaves the right pane until the next visit. */
export function shownPlantCounts(
  uncounted: PlantLot[],
  assigned: AssignedLot[],
  editId: string
): { left: PlantLot[]; right: AssignedLot[] } {
  const pulled = assigned.find((row) => row.id === editId) ?? null;
  const left = [...uncounted];
  if (pulled && !left.some((row) => row.id === pulled.id)) left.push(pulled);
  left.sort(byFarmDay);
  const onLeft = new Set(left.map((row) => row.id));
  return { left, right: assigned.filter((row) => !onLeft.has(row.id)) };
}

/** The box under the list. A refusal keeps what was typed. << fills the stored count. */
export function plantCountFieldValue(left: PlantLot[], editId: string, typed: string | null): string {
  if (typed != null) return typed;
  const row = left.find((item) => item.id === editId);
  return row && row.plantCount != null ? String(row.plantCount) : "";
}

function lotFrom(row: UncountedRow): PlantLot {
  return {
    id: row.id,
    hbn: row.hbn,
    lot: formatLotToken(Number(row.harvest_year), Number(row.lot_serial)),
    farm: row.farm_code ?? "",
    status: row.status,
    farmDay: row.farm_day,
    createdAt: row.created_at,
    plantCount: row.plant_count == null ? null : Number(row.plant_count),
  };
}

const LOT_SQL = `SELECT w.id, b.hbn, b.harvest_year, b.lot_serial, b.farm_code, w.status, w.plant_count,
       COALESCE(NULLIF(w.effective_date, ''), b.entry_date) AS farm_day, w.created_at`;

/** Live lots of the year with no plant count, oldest farm day first. */
export async function listUncountedLots(db: D1Database, year: number): Promise<PlantLot[]> {
  const rows = await db
    .prepare(
      `${LOT_SQL}
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       WHERE w.deleted_at IS NULL AND w.plant_count IS NULL AND b.harvest_year = ? AND ${ownLotSql("b")}
       ORDER BY farm_day, w.created_at, w.id`
    )
    .bind(year)
    .all<UncountedRow>();
  return (rows.results ?? []).map(lotFrom);
}

/** Lots given a count on this screen, newest assignment first. A lot with no count stays out. */
export async function listAssignedLots(db: D1Database): Promise<AssignedLot[]> {
  const rows = await db
    .prepare(
      `${LOT_SQL}, l.changed_at, p.display_name
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       JOIN record_change_log l ON l.id = (
         SELECT l2.id FROM record_change_log l2
         WHERE l2.record_table = 'wet_weight_entries' AND l2.record_id = w.id
           AND l2.field = 'plant_count' AND l2.reason = ?
         ORDER BY l2.changed_at DESC, l2.id DESC
         LIMIT 1
       )
       LEFT JOIN people p ON p.id = l.actor_person_id
       WHERE w.deleted_at IS NULL AND w.plant_count IS NOT NULL
       ORDER BY l.changed_at DESC, w.id`
    )
    .bind(ASSIGN_PLANT_COUNTS_REASON)
    .all<AssignedRow>();
  return (rows.results ?? []).map((row) => ({
    ...lotFrom(row),
    plantCount: Number(row.plant_count),
    who: row.display_name ?? "",
    when: row.changed_at,
  }));
}

/** A whole number of one or more. Blank and a bad number throw, and nothing is written. */
export function readAssignedPlantCount(raw: unknown): number {
  const n = parsePlantCount(raw, "Plant count");
  if (n == null) {
    throw new HttpError(400, "Plant count must be a whole number of plants, one or more.");
  }
  return n;
}

/** >> writes the count and logs it. The first count logs a null old value. */
export async function assignPlantCount(
  db: D1Database,
  form: FormData,
  year: number
): Promise<{ redirect: string }> {
  const id = textOrNull(form.get("entry_id"));
  if (!id) throw new HttpError(400, "Pick a lot.");
  const count = readAssignedPlantCount(form.get("plant_count"));
  const actor = textOrNull(form.get("person_id"));
  const row = await db
    .prepare(
      `SELECT w.plant_count AS plant_count
       FROM wet_weight_entries w
       JOIN harvest_batches b ON b.id = w.harvest_batch_id AND b.deleted_at IS NULL
       WHERE w.id = ? AND w.deleted_at IS NULL AND b.harvest_year = ? AND ${ownLotSql("b")}`
    )
    .bind(id, year)
    .first<{ plant_count: number | null }>();
  if (!row) throw new HttpError(400, "That lot is not on this list.");
  const ts = nowIso();
  await db.batch([
    db
      .prepare(
        `UPDATE wet_weight_entries SET plant_count = ?, updated_at = ?, updated_by = ? WHERE id = ? AND deleted_at IS NULL`
      )
      .bind(count, ts, actor, id),
    insertLog(db, {
      record_table: "wet_weight_entries",
      record_id: id,
      field: "plant_count",
      old_value: row.plant_count == null ? null : String(row.plant_count),
      new_value: String(count),
      actor_person_id: actor,
      reason: ASSIGN_PLANT_COUNTS_REASON,
      changed_at: ts,
    }),
  ]);
  return { redirect: ASSIGN_PLANT_COUNTS_PATH };
}

function lotLine(row: PlantLot, locale: Locale): string {
  const state = plantCountState(row.status);
  return `${esc(row.hbn)} ${esc(row.lot)} ${esc(row.farm)} ${esc(t(locale, state))}`;
}

export function plantCountPage(input: {
  locale: Locale;
  uncounted: PlantLot[];
  assigned: AssignedLot[];
  editId: string;
  typed: string | null;
}): string {
  const locale = input.locale;
  const shown = shownPlantCounts(input.uncounted, input.assigned, input.editId);
  const field = plantCountFieldValue(shown.left, input.editId, input.typed);
  const selected = shown.left.some((row) => row.id === input.editId) ? input.editId : "";
  const leftItems = shown.left
    .map((row) => {
      const on = row.id === selected ? " selected" : "";
      const href = `${ASSIGN_PLANT_COUNTS_PATH}?entry=${encodeURIComponent(row.id)}`;
      return `<li><a class="queue-pane-item${on}" href="${esc(href)}" data-plant-entry="${esc(row.id)}" data-plant-lot="${esc(row.lot)}" data-plant-state="${esc(plantCountState(row.status))}">${lotLine(row, locale)}</a></li>`;
    })
    .join("");
  const rightItems = shown.right
    .map((row) => {
      const href = `${ASSIGN_PLANT_COUNTS_PATH}?entry=${encodeURIComponent(row.id)}`;
      return `<li data-plant-assigned="${esc(row.id)}" data-plant-lot="${esc(row.lot)}">
        <p>${lotLine(row, locale)}</p>
        <p data-plant-count-shown>${esc(String(row.plantCount))}</p>
        <p data-plant-who>${esc(row.who)}</p>
        <p><time datetime="${esc(row.when)}">${esc(etWallClock(row.when))}</time></p>
        <p><a class="shuttle-btn plant-count-btn" href="${esc(href)}" title="&lt;&lt;" aria-label="&lt;&lt;">&lt;&lt;</a></p>
      </li>`;
    })
    .join("");
  const left = `<aside class="queue-pane" data-plant-pane="none">
      <h2>${esc(t(locale, "No plant count"))} <span class="tile-count">${shown.left.length}</span></h2>
      ${leftItems ? `<ul>${leftItems}</ul>` : `<p class="muted">${esc(t(locale, "No rows waiting."))}</p>`}
      <form method="post" action="${esc(ASSIGN_PLANT_COUNTS_PATH)}" class="plant-count-form">
        <input type="hidden" name="entry_id" value="${esc(selected)}">
        <label class="field">${esc(t(locale, "Plant count"))}<input name="plant_count" inputmode="numeric" value="${esc(field)}" data-plant-count autocomplete="off"></label>
        <button type="submit" class="shuttle-btn plant-count-btn" title="&gt;&gt;" aria-label="&gt;&gt;">&gt;&gt;</button>
      </form>
    </aside>`;
  const right = `<aside class="queue-pane" data-plant-pane="assigned">
      <h2>${esc(t(locale, "Assigned"))} <span class="tile-count">${shown.right.length}</span></h2>
      ${rightItems ? `<ul>${rightItems}</ul>` : `<p class="muted">${esc(t(locale, "No rows waiting."))}</p>`}
    </aside>`;
  return `<h1>${esc(t(locale, "Assign Plant Counts"))}</h1>
    <div class="plant-panes">
      ${left}
      ${right}
    </div>`;
}
